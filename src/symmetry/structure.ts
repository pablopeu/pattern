import type { Symmetry } from '../app/model';
import {
  apply,
  inverse,
  multiply,
  translate,
  IDENTITY,
  type Matrix,
  type Point,
} from '../geometry/matrix';
import { cosets, lattice, fundamentalDomain, visibleInstances, type Bounds } from './groups';

export interface StructureAxis {
  a: Point;
  b: Point;
  origin: Point;
  direction: Point;
  glide: boolean;
  operation: Matrix;
}
export interface StructureCenter {
  point: Point;
  order: number;
  operation: Matrix;
}
export interface StructureSegment {
  a: Point;
  b: Point;
}
export interface SymmetryStructure {
  axes: StructureAxis[];
  centers: StructureCenter[];
  domain: StructureSegment[];
  primitive: StructureSegment[];
  limited: boolean;
}
const key = (p: Point) => `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)}`;
const corners = (b: Bounds) => [
  { x: b.x, y: b.y },
  { x: b.x + b.width, y: b.y },
  { x: b.x + b.width, y: b.y + b.height },
  { x: b.x, y: b.y + b.height },
];
const inside = (p: Point, b: Bounds) =>
  p.x >= b.x - 1e-7 &&
  p.y >= b.y - 1e-7 &&
  p.x <= b.x + b.width + 1e-7 &&
  p.y <= b.y + b.height + 1e-7;
function range(points: Point[]) {
  return {
    x0: Math.floor(Math.min(...points.map((p) => p.x))) - 1,
    x1: Math.ceil(Math.max(...points.map((p) => p.x))) + 1,
    y0: Math.floor(Math.min(...points.map((p) => p.y))) - 1,
    y1: Math.ceil(Math.max(...points.map((p) => p.y))) + 1,
  };
}
/** Clip finite segments and infinite mathematical lines to the actual viewport. */
export function clipLine(
  origin: Point,
  direction: Point,
  b: Bounds,
  segment = false,
): StructureSegment | null {
  let lo = segment ? 0 : -Infinity,
    hi = segment ? 1 : Infinity;
  for (const axis of ['x', 'y'] as const) {
    const d = direction[axis],
      o = origin[axis],
      min = b[axis],
      max = min + (axis === 'x' ? b.width : b.height);
    if (Math.abs(d) < 1e-10) {
      if (o < min - 1e-7 || o > max + 1e-7) return null;
    } else {
      const a = (min - o) / d,
        c = (max - o) / d;
      lo = Math.max(lo, Math.min(a, c));
      hi = Math.min(hi, Math.max(a, c));
    }
  }
  if (lo > hi || !Number.isFinite(lo) || !Number.isFinite(hi) || hi - lo < 1e-9) return null;
  return {
    a: { x: origin.x + lo * direction.x, y: origin.y + lo * direction.y },
    b: { x: origin.x + hi * direction.x, y: origin.y + hi * direction.y },
  };
}
export function rotationOrder(m: Matrix): number {
  let power: Matrix = IDENTITY;
  for (let n = 1; n <= 128; n++) {
    power = multiply(power, [m[0], m[1], m[2], m[3], 0, 0]);
    if (
      n > 1 &&
      Math.max(
        Math.abs(power[0] - 1),
        Math.abs(power[1]),
        Math.abs(power[2]),
        Math.abs(power[3] - 1),
      ) < 1e-7
    )
      return n;
  }
  return 0;
}
const domains = new Map<string, Point[]>();
function cachedDomain(s: Symmetry) {
  const id = JSON.stringify(s);
  let d = domains.get(id);
  if (!d) {
    d = fundamentalDomain(s);
    if (domains.size >= 128) domains.delete(domains.keys().next().value!);
    domains.set(id, d);
  }
  return d;
}

/** All displayed marks have a real affine isometry witness; no decorative lattice. */
export function symmetryStructure(
  s: Symmetry,
  viewport: Bounds,
  maxOperations = 20000,
): SymmetryStructure {
  const result: SymmetryStructure = {
    axes: [],
    centers: [],
    domain: [],
    primitive: [],
    limited: false,
  };
  if (s.family === 'none') return result;
  const margin = Math.min(s.width, s.height) * 0.03,
    b = {
      x: viewport.x - margin,
      y: viewport.y - margin,
      width: viewport.width + 2 * margin,
      height: viewport.height + 2 * margin,
    };
  const basis = lattice(s),
    inv = inverse(basis),
    axes = new Map<string, StructureAxis>(),
    centers = new Map<string, StructureCenter>();
  let used = 0;
  const inspect = (m: Matrix) => {
    if (++used > maxOperations) {
      result.limited = true;
      return;
    }
    const det = m[0] * m[3] - m[1] * m[2];
    if (det < 0) {
      let d: Point =
        Math.abs(m[2]) > 1e-8
          ? { x: m[2], y: 1 - m[0] }
          : Math.abs(m[0] - 1) < 1e-8
            ? { x: 1, y: 0 }
            : { x: 0, y: 1 };
      const len = Math.hypot(d.x, d.y);
      d = { x: d.x / len, y: d.y / len };
      if (d.x < -1e-8 || (Math.abs(d.x) < 1e-8 && d.y < 0)) d = { x: -d.x, y: -d.y };
      const n = { x: -d.y, y: d.x },
        shift = (n.x * m[4] + n.y * m[5]) / 2,
        origin = { x: n.x * shift, y: n.y * shift },
        segment = clipLine(origin, d, viewport);
      if (!segment) return;
      const id = `${key(d)}:${Math.round(shift * 1e6)}`,
        glide = Math.abs(d.x * m[4] + d.y * m[5]) > 1e-7,
        old = axes.get(id);
      if (!old || (old.glide && !glide))
        axes.set(id, { ...segment, origin, direction: d, glide, operation: m });
    } else if (Math.abs(m[0] - 1) + Math.abs(m[1]) + Math.abs(m[2]) + Math.abs(m[3] - 1) > 1e-8) {
      const fixed: Matrix = [1 - m[0], -m[1], -m[2], 1 - m[3], 0, 0];
      try {
        const point = apply(inverse(fixed), { x: m[4], y: m[5] }),
          order = rotationOrder(m);
        if (!inside(point, b) || !order) return;
        const id = key(point),
          old = centers.get(id);
        if (!old || order > old.order) centers.set(id, { point, order, operation: m });
      } catch {
        /* Pure translations do not have a finite fixed center. */
      }
    }
  };
  for (const op of cosets(s)) {
    if (s.family === 'radial') {
      inspect(op);
      continue;
    }
    if (Math.abs(op[0] - 1) + Math.abs(op[1]) + Math.abs(op[2]) + Math.abs(op[3] - 1) < 1e-8)
      continue;
    // t = (I-A)x - t_op for fixed points; a small tangential margin also captures glides.
    const r = range(
      corners(b).map((p) =>
        apply(inv, {
          x: (1 - op[0]) * p.x - op[2] * p.y - op[4],
          y: -op[1] * p.x + (1 - op[3]) * p.y - op[5],
        }),
      ),
    );
    if (s.family === 'frieze') r.y0 = r.y1 = 0;
    if ((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) + used > maxOperations) {
      result.limited = true;
      continue;
    }
    for (let j = r.y0; j <= r.y1; j++)
      for (let i = r.x0; i <= r.x1; i++) {
        const p = apply(basis, { x: i, y: j });
        inspect(multiply(translate(p.x, p.y), op));
      }
  }
  result.axes = [...axes.values()];
  result.centers = [...centers.values()];
  const segmentKey = (a: Point, b: Point) => [key(a), key(b)].sort().join(':');
  const addEdges = (points: Point[], map: Map<string, StructureSegment>) => {
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        c = points[(i + 1) % points.length],
        edge = clipLine(a, { x: c.x - a.x, y: c.y - a.y }, viewport, true);
      if (edge) map.set(segmentKey(edge.a, edge.b), edge);
    }
  };
  const primitive = new Map<string, StructureSegment>(),
    domain = new Map<string, StructureSegment>();
  if (s.family === 'wallpaper') {
    const origin = s.origin,
      cell = [
        origin,
        { x: origin.x + basis[0], y: origin.y + basis[1] },
        { x: origin.x + basis[0] + basis[2], y: origin.y + basis[1] + basis[3] },
        { x: origin.x + basis[2], y: origin.y + basis[3] },
      ],
      r = range(corners(b).map((p) => apply(inv, { x: p.x - origin.x, y: p.y - origin.y })));
    if ((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) < maxOperations / 4) {
      for (let j = r.y0; j <= r.y1; j++)
        for (let i = r.x0; i <= r.x1; i++) {
          const p = apply(basis, { x: i, y: j });
          addEdges(
            cell.map((q) => ({ x: q.x + p.x, y: q.y + p.y })),
            primitive,
          );
        }
    } else result.limited = true;
    const d = cachedDomain(s),
      xs = d.map((p) => p.x),
      ys = d.map((p) => p.y);
    if (d.length)
      try {
        const instances = visibleInstances(s, b, {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        });
        if (instances.length < maxOperations)
          for (const instance of instances)
            addEdges(
              d.map((p) => apply(instance.matrix, p)),
              domain,
            );
        else result.limited = true;
      } catch {
        result.limited = true;
      }
  } else if (s.family === 'frieze') {
    const a = { x: basis[0], y: basis[1] },
      length = Math.hypot(a.x, a.y),
      normal = { x: -a.y / length, y: a.x / length },
      local = corners(b).map((p) => apply(inv, { x: p.x - s.origin.x, y: p.y - s.origin.y }));
    const lo = Math.floor(Math.min(...local.map((p) => p.x))) - 1,
      hi = Math.ceil(Math.max(...local.map((p) => p.x))) + 1;
    if (hi - lo < maxOperations)
      for (let i = lo; i <= hi; i++) {
        const edge = clipLine(
          { x: s.origin.x + i * a.x, y: s.origin.y + i * a.y },
          normal,
          viewport,
        );
        if (edge) primitive.set(segmentKey(edge.a, edge.b), edge);
      }
    else result.limited = true;
  } else if (s.family === 'radial') {
    const count = s.sectors * (s.group === 'Dn' ? 2 : 1),
      radius = Math.hypot(b.width, b.height) + Math.hypot(b.x - s.center.x, b.y - s.center.y);
    for (let i = 0; i < count; i++) {
      const angle = ((s.orientation + (i * 360) / count) * Math.PI) / 180,
        edge = clipLine(
          s.center,
          { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
          viewport,
          true,
        );
      if (edge) domain.set(segmentKey(edge.a, edge.b), edge);
    }
  }
  result.primitive = [...primitive.values()];
  result.domain = [...domain].filter(([id]) => !primitive.has(id)).map(([, segment]) => segment);
  return result;
}

export function structureMarkup(data: SymmetryStructure, opacity = 0.22, pixelsPerMM = 1): string {
  const line = (e: StructureSegment, style: string) =>
    `<path d="M${e.a.x} ${e.a.y}L${e.b.x} ${e.b.y}" fill="none" vector-effect="non-scaling-stroke" ${style}/>`;
  const glyph = (c: StructureCenter) => {
    const r = 3 / Math.max(0.001, pixelsPerMM),
      { x, y } = c.point;
    if (c.order === 2)
      return `<ellipse data-rotation-order="2" cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.45}" fill="#728a7c"/>`;
    const n = Math.min(12, Math.max(3, c.order)),
      points = Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n - Math.PI / 2;
        return `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`;
      }).join(' ');
    return `<polygon data-rotation-order="${c.order}" points="${points}" fill="#728a7c"/>`;
  };
  return `<g data-symmetry-structure="true" pointer-events="none" opacity="${opacity}" stroke="#71887c">${data.primitive.map((e) => line(e, 'stroke-width="0.65" stroke-dasharray="4 3"')).join('')}${data.domain.map((e) => line(e, 'stroke-width="0.55"')).join('')}${data.axes.map((e) => line(e, `data-axis="${e.glide ? 'glide' : 'reflection'}" stroke-width="0.9"${e.glide ? ' stroke-dasharray="2 3"' : ''}`)).join('')}${data.centers.map(glyph).join('')}</g>`;
}

const structures = new Map<string, SymmetryStructure>();
/** Renderer cache: callers treat returned mathematical data as immutable. */
export function cachedStructure(s: Symmetry, view: Bounds): SymmetryStructure {
  const key = JSON.stringify([s, view]);
  let result = structures.get(key);
  if (!result) {
    result = symmetryStructure(s, view);
    if (structures.size >= 64) structures.delete(structures.keys().next().value!);
    structures.set(key, result);
  }
  return result;
}
