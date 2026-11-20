import { describe, it, expect } from 'vitest';
import { geometry, newProject, node, type Geometry } from '../app/model';
import { profile, profileWidth } from '../app/styles';
import {
  apply,
  IDENTITY,
  linearScaleBound,
  multiply,
  rotate,
  scale,
  type Matrix,
} from '../geometry/matrix';
import { paperPath, scope } from '../geometry/paper';
import { dashIntervals, strokeRegion } from '../geometry/stroke-outline';
import { svgPath, prepareExport } from '../export/svg';
/** Compare derived boundaries against dense normals on the untouched cubic axis. */
function boundaryError(
  axis: Geometry,
  contour: Geometry,
  matrix: Matrix = axis.transform,
  samples = 180,
): number {
  const p = paperPath({ ...axis, transform: IDENTITY }),
    path = p.children[0] as paper.Path,
    out = paperPath(contour);
  let max = 0;
  try {
    for (let i = 0; i < samples; i++) {
      const d = (path.length * (i + 0.371)) / samples,
        center = path.getPointAt(d),
        normal = path.getNormalAt(d),
        radius = axis.strokeWidth * 0.5 * profileWidth(axis.strokeProfile, d / path.length);
      for (const sign of [-1, 1]) {
        const q = apply(matrix, {
            x: center.x + sign * normal.x * radius,
            y: center.y + sign * normal.y * radius,
          }),
          near = out.getNearestPoint(new scope.Point(q.x, q.y));
        max = Math.max(max, Math.hypot(q.x - near.x, q.y - near.y));
      }
    }
    return max;
  } finally {
    p.remove();
    out.remove();
  }
}
const ellipse = () => ({
  ...geometry('ellipse', [], true),
  parameters: { x: 0, y: 0, width: 40, height: 30, radius: 0, sides: 4 },
  strokeWidth: 3,
  strokeProfile: {
    version: 1 as const,
    kind: 'custom' as const,
    points: [
      { at: 0, width: 0.5 },
      { at: 0.3, width: 1.8 },
      { at: 0.7, width: 0.3 },
      { at: 1, width: 0.5 },
    ],
  },
});
describe('v2.2 · precisión física de contornos', () => {
  it('cota de escala afín incluye anisotropía, rotación y shear sin overflow', () => {
    expect(linearScaleBound(IDENTITY)).toBe(1);
    expect(linearScaleBound(scale(3, 0.5))).toBe(3);
    expect(linearScaleBound(multiply(rotate(71), scale(3, 0.5)))).toBeCloseTo(3);
    const shear: Matrix = [2, 0.4, 1.7, 0.8, 0, 0],
      bound = linearScaleBound(shear);
    for (let i = 0; i < 1000; i++) {
      const a = (i * Math.PI) / 500,
        q = apply(shear, { x: Math.cos(a), y: Math.sin(a) });
      expect(Math.hypot(q.x, q.y)).toBeLessThanOrEqual(bound + 1e-12);
    }
    expect(Number.isFinite(linearScaleBound(scale(1e200, 1e199)))).toBe(true);
  });
  it('cuantización de expansión uniforme respeta tolerancia tras ampliar1000 veces', () => {
    const g = {
        ...geometry('path', [node(0.00001234, 0.123456789), node(1.00001234, 0.123456789)]),
        strokeWidth: 0.222333,
        strokeCap: 'butt' as const,
        transform: scale(1000, 1000),
      },
      tolerance = 0.0001,
      contour = strokeRegion(g, IDENTITY, tolerance);
    expect(boundaryError(g, contour, g.transform, 50)).toBeLessThanOrEqual(tolerance);
  });
  it('perfil sobre Bézier conserva precisión con transformación anisótropa', () => {
    const g = { ...ellipse(), transform: multiply(rotate(23), scale(7, 0.4)) },
      tolerance = 0.01,
      contour = strokeRegion(g, IDENTITY, tolerance);
    expect(boundaryError(g, contour)).toBeLessThanOrEqual(tolerance);
  });
  it('template SVG compartido descuenta escala de placement del generador', () => {
    const p = newProject(),
      pattern = p.patterns[0],
      g = ellipse();
    g.parameters = { ...g.parameters, width: 4, height: 3 };
    g.strokeWidth = 0.08;
    p.mainSymmetry = {
      ...p.mainSymmetry,
      family: 'wallpaper',
      group: 'p1',
      width: 100,
      height: 100,
    };
    pattern.generator.kind = 'freeform';
    pattern.generator.placements = [scale(10, 10)];
    pattern.sourceGeometry = [g];
    const tolerance = 0.005,
      result = prepareExport(p, {
        target: 'view',
        format: 'svg',
        representation: 'editable',
        width: 200,
        height: 200,
        dpi: 200,
        background: '#ffffff',
        transparent: true,
        quality: 1,
        tolerance,
        outlineStrokes: true,
        patternId: pattern.id,
      }),
      path = result.svg.match(/<path d="([^"]+)" transform="[^"]+" fill="#233b2d" stroke="none"/);
    expect(path).toBeTruthy();
    const contour = {
      ...geometry('compound', [], true),
      pathData: path![1],
      transform: scale(10, 10),
    };
    expect(boundaryError(g, contour, scale(10, 10))).toBeLessThanOrEqual(tolerance);
  });
  it('rechaza precisión imposible en arcos y escalas sin fingir tolerancia', () => {
    const g = {
      ...geometry('path', [node(0, 0), node(1000, 0)]),
      strokeWidth: 1000,
      strokeDash: [0, 1],
      strokeProfile: profile('custom'),
    };
    expect(() => strokeRegion(g, IDENTITY, 0.00001)).toThrow(/precisión del arco/);
    expect(() => strokeRegion({ ...g, transform: scale(1e12, 1) }, IDENTITY, 0.02)).toThrow(
      /precisión solicitada/,
    );
  });
});

it('dash de punto incluye inicio y excluye extremo terminal como SVG', () => {
  expect(dashIntervals(5, [0, 2.5], 0)).toEqual([
    [0, 0],
    [2.5, 2.5],
  ]);
});

it('punteado de longitud cero usa contorno SVG estable entre rasterizadores', () => {
  const g = {
    ...geometry('path', [node(0, 0), node(5, 0)]),
    strokeDash: [0, 2.5],
    strokeCap: 'round' as const,
  };
  expect(svgPath(g)).toContain('fill="#233b2d" stroke="none"');
  expect(dashIntervals(50 + 1e-14, [0, 2.5], 0)).toHaveLength(20);
  expect(() => strokeRegion({ ...g, nodes: [node(0, 0), node(1e50, 1)] })).toThrow(
    /rango numérico/,
  );
});

it('punto cuadrado sigue tangente diagonal y la línea degenerada mantiene su tapa', () => {
  const diagonal = {
      ...geometry('path', [node(0, 0), node(20, 20)]),
      strokeWidth: 4,
      strokeCap: 'square' as const,
      strokeDash: [0, 10],
    },
    outline = paperPath(strokeRegion(diagonal));
  expect(outline.contains(new scope.Point(2.4, 0))).toBe(true);
  expect(outline.contains(new scope.Point(1.8, 1.8))).toBe(false);
  outline.remove();
  for (const cap of ['round', 'square'] as const) {
    const point = { ...geometry('path', [node(0, 0), node(0, 0)]), strokeWidth: 4, strokeCap: cap },
      p = paperPath(strokeRegion(point));
    expect(p.contains(new scope.Point(1, 1))).toBe(true);
    expect(p.contains(new scope.Point(2.1, 0))).toBe(false);
    p.remove();
  }
});
it('tapas cuadradas y rectas de una Bézier usan la tangente exacta del extremo', () => {
  for (const cap of ['butt', 'square'] as const) {
    const g = {
        ...geometry('compound'),
        pathData: 'M0 0C50 120 150 -40 200 30',
        strokeWidth: 2,
        strokeCap: cap,
      },
      contour = paperPath(strokeRegion(g, IDENTITY, 0.005)),
      d = { x: 5 / 13, y: 12 / 13 },
      n = { x: -d.y, y: d.x },
      extension = cap === 'square' ? 1 : 0;
    for (const sign of [-1, 1]) {
      const q = { x: sign * n.x - extension * d.x, y: sign * n.y - extension * d.y },
        near = contour.getNearestPoint(new scope.Point(q.x, q.y));
      expect(Math.hypot(q.x - near.x, q.y - near.y)).toBeLessThan(0.0001);
    }
    contour.remove();
  }
});
