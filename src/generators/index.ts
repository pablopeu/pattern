import { defaultGenerator, geometry, node, type Generator, type Geometry } from '../app/model';
import {
  IDENTITY,
  multiply,
  rotate,
  scale,
  translate,
  type Matrix,
  type Point,
} from '../geometry/matrix';
export const generatorLabels: Record<Generator['kind'], string> = {
  motif: 'Motivo propio',
  grid: 'Basic Grid',
  warp: 'Warp Grid',
  radial: 'Radial',
  rosette: 'Rosette',
  wave: 'Wave',
  guilloche: 'Guilloché',
  spirograph: 'Spirograph',
  lattice: 'Lattice',
  tessellation: 'Tessellation',
  freeform: 'Freeform Arrangement',
  penrose: 'Penrose',
};
export function random(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export interface Generated {
  geometry: Geometry[];
  placements: Matrix[];
  finite: boolean;
}
function curve(points: Point[], closed: boolean, name: string): Geometry {
  const g = geometry(
    'path',
    points.map((p) => node(p.x, p.y)),
    closed,
  );
  g.id = `generated-${name}`;
  g.name = name;
  return g;
}
/** Robinson triangles: substitution by golden ratio, finite P3 patch. */
export function penrose(depth: number, radius: number): Geometry[] {
  type Triangle = { type: 0 | 1; a: Point; b: Point; c: Point };
  const phi = (1 + Math.sqrt(5)) / 2,
    lerp = (a: Point, b: Point, t: number): Point => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
  let triangles: Triangle[] = Array.from({ length: 10 }, (_, i) => {
    let b = {
        x: radius * Math.cos(((2 * i - 1) * Math.PI) / 10),
        y: radius * Math.sin(((2 * i - 1) * Math.PI) / 10),
      },
      c = {
        x: radius * Math.cos(((2 * i + 1) * Math.PI) / 10),
        y: radius * Math.sin(((2 * i + 1) * Math.PI) / 10),
      };
    if (i % 2 === 0) [b, c] = [c, b];
    return { type: 0, a: { x: 0, y: 0 }, b, c };
  });
  for (let i = 0; i < Math.min(7, depth); i++)
    triangles = triangles.flatMap(({ type, a, b, c }): Triangle[] => {
      if (type === 0) {
        const p = lerp(a, b, 1 / phi);
        return [
          { type: 0, a: c, b: p, c: b },
          { type: 1, a: p, b: c, c: a },
        ];
      }
      const q = lerp(b, a, 1 / phi),
        r = lerp(b, c, 1 / phi);
      return [
        { type: 1, a: r, b: c, c: a },
        { type: 1, a: q, b: r, c: b },
        { type: 0, a: r, b: q, c: a },
      ];
    });
  return triangles.map((t, i) => {
    const g = curve([t.a, t.b, t.c], true, `Penrose ${i}`);
    g.fill = t.type === 0 ? '#d3dfb0' : '#7a9a7d';
    g.strokeWidth = 0.25;
    return g;
  });
}
export function generate(g: Generator, source: Geometry[]): Generated {
  const rand = random(g.seed),
    result: Generated = {
      geometry: source.filter((s) => s.visible),
      placements: [IDENTITY],
      finite: g.kind === 'penrose',
    };
  if (g.kind === 'motif') return result;
  if (g.kind === 'freeform') {
    result.placements = g.placements;
    return result;
  }
  if (g.kind === 'penrose') {
    result.geometry = penrose(Math.round(g.frequency), g.radius);
    return result;
  }
  if (['wave', 'guilloche', 'spirograph', 'rosette'].includes(g.kind)) {
    const points: Point[] = [],
      steps = Math.min(12000, Math.max(400, g.count * 180));
    const turns = g.kind === 'spirograph' ? Math.max(1, Math.round(g.count)) : 1;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 * Math.PI * turns,
        phase = (g.phase * Math.PI) / 180;
      let x = 0,
        y = 0;
      if (g.kind === 'wave') {
        x = (i / steps - 0.5) * g.radius * 2;
        y = g.amplitude * Math.sin(t * g.frequency + phase);
      }
      if (g.kind === 'rosette') {
        const r = g.radius + g.amplitude * Math.cos(g.frequency * t + phase);
        x = r * Math.cos(t);
        y = r * Math.sin(t);
      }
      if (g.kind === 'guilloche') {
        x =
          (g.radius + g.amplitude * Math.cos(g.frequency * t + phase)) * Math.cos(t) +
          (g.amplitude / 2) * Math.cos(g.count * t);
        y =
          (g.radius + g.amplitude * Math.cos(g.frequency * t + phase)) * Math.sin(t) +
          (g.amplitude / 2) * Math.sin(g.count * t);
      }
      if (g.kind === 'spirograph') {
        const R = g.radius,
          r = R * Math.max(0.05, g.ratio),
          d = g.amplitude;
        x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t + phase);
        y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t + phase);
      }
      points.push({ x, y });
    }
    // Trochoids may be open when radius ratios are not commensurate.
    const closed =
      g.kind !== 'wave' &&
      Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y) < 1e-6;
    result.geometry = [...result.geometry, curve(points, closed, g.kind)];
    return result;
  }
  const placements: Matrix[] = [];
  if (g.kind === 'radial' || (g.kind === 'warp' && g.distribution === 'circular')) {
    for (let i = 0; i < g.count; i++) {
      const a = (i * 360) / g.count,
        t = (a * Math.PI) / 180;
      const radius =
        g.kind === 'warp'
          ? g.radius + g.amplitude * Math.sin(g.frequency * t + (g.phase * Math.PI) / 180)
          : g.radius;
      const factor =
        g.kind === 'warp'
          ? g.scale * (1 + (g.scaleRatio - 1) * Math.sin(g.frequency * t))
          : g.scale * Math.pow(g.scaleRatio, i);
      placements.push(
        multiply(
          translate(radius * Math.cos(t), radius * g.aspectRatio * Math.sin(t)),
          multiply(rotate(a + g.rotation), scale(factor)),
        ),
      );
    }
  } else {
    for (let row = 0; row < g.rows; row++)
      for (let col = 0; col < g.columns; col++) {
        let x = (col - (g.columns - 1) / 2) * g.spacing,
          y = (row - (g.rows - 1) / 2) * g.spacing;
        if (g.kind === 'grid') {
          if (g.staggerAxis === 'rows') x += (row % 2) * g.offset * g.spacing;
          else y += (col % 2) * g.offset * g.spacing;
        }
        if (g.kind === 'lattice' || g.kind === 'tessellation') {
          x += ((row % 2) * g.spacing) / 2;
          y *= Math.sqrt(3) / 2;
        }
        if (g.kind === 'warp') {
          const u = col / Math.max(1, g.columns),
            v = row / Math.max(1, g.rows);
          x += g.amplitude * Math.sin(2 * Math.PI * g.frequency * v + (g.phase * Math.PI) / 180);
          y += g.amplitude * Math.sin(2 * Math.PI * g.frequency * u + (g.phase * Math.PI) / 180);
        }
        if (g.kind === 'warp' && g.distribution === 'freeform') {
          x += (rand() - 0.5) * g.amplitude;
          y += (rand() - 0.5) * g.amplitude;
        }
        const s =
          g.kind === 'warp'
            ? g.scale *
              (1 +
                (g.scaleRatio - 1) *
                  Math.sin(((row + col) * Math.PI) / Math.max(g.columns, g.rows)))
            : g.scale;
        placements.push(
          multiply(
            translate(x, y),
            multiply(
              rotate(g.rotation + (g.kind === 'tessellation' ? ((col + row) % 2) * 180 : 0)),
              scale(s),
            ),
          ),
        );
      }
  }
  result.placements = placements;
  return result;
}
export const generatorParameters: Record<Generator['kind'], (keyof Generator)[]> = {
  motif: [],
  grid: ['rows', 'columns', 'spacing', 'staggerAxis', 'offset', 'scale', 'rotation'],
  warp: [
    'distribution',
    'rows',
    'columns',
    'spacing',
    'scale',
    'scaleRatio',
    'amplitude',
    'frequency',
    'phase',
    'seed',
  ],
  radial: ['count', 'radius', 'aspectRatio', 'scale', 'scaleRatio', 'rotation'],
  rosette: ['radius', 'amplitude', 'frequency', 'phase'],
  wave: ['radius', 'amplitude', 'frequency', 'phase'],
  guilloche: ['radius', 'amplitude', 'frequency', 'count', 'phase'],
  spirograph: ['radius', 'ratio', 'amplitude', 'count', 'phase'],
  lattice: ['rows', 'columns', 'spacing', 'scale', 'rotation'],
  tessellation: ['rows', 'columns', 'spacing', 'scale', 'rotation'],
  freeform: [],
  penrose: ['radius', 'frequency'],
};
export { defaultGenerator };
