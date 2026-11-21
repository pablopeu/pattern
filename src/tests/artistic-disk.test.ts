import { expect, it } from 'vitest';
import { geometry, newProject } from '../app/model';
import {
  artisticPoint,
  artisticCubicError,
  deriveArtisticDisk,
  artisticDiskSVG,
  artisticSourcePoint,
} from '../artistic/disk';
import { adaptiveMapCubic, type Cubic } from '../geometry/nonlinear';
import { paperPath, scope } from '../geometry/paper';
const curves: Cubic[] = [
  [
    { x: -0.9, y: 0 },
    { x: -0.2, y: 1.2 },
    { x: 0.2, y: -1.2 },
    { x: 0.9, y: 0 },
  ],
  [
    { x: 0, y: 0 },
    { x: 1.2, y: 1.2 },
    { x: -1.2, y: 1.2 },
    { x: 0, y: 0 },
  ],
  [
    { x: -1, y: 0 },
    { x: -0.33, y: 0 },
    { x: 0.33, y: 0 },
    { x: 1, y: 0 },
  ],
  [
    { x: 0.4, y: -0.2 },
    { x: 1.2, y: 0.8 },
    { x: -0.3, y: 1.1 },
    { x: 0.4, y: -0.2 },
  ],
];
const evaluate = (curve: Cubic, t: number) => ({
  x:
    (1 - t) ** 3 * curve[0].x +
    3 * t * (1 - t) ** 2 * curve[1].x +
    3 * t * t * (1 - t) * curve[2].x +
    t ** 3 * curve[3].x,
  y:
    (1 - t) ** 3 * curve[0].y +
    3 * t * (1 - t) ** 2 * curve[1].y +
    3 * t * t * (1 - t) * curve[2].y +
    t ** 3 * curve[3].y,
});
function distanceToPolyline(p: { x: number; y: number }, points: { x: number; y: number }[]) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
      );
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}
it.each([0.1, 1, 8, 64])(
  'radial compression%s stays inside disk and has an independent inverse',
  (compression) => {
    const settings = { compression, angle: 0.7, center: { x: 0.2, y: -0.1 } };
    for (const point of [
      { x: 0, y: 0 },
      { x: 0.9, y: 0.9 },
      { x: -1, y: 1 },
      { x: 0.2, y: -0.1 },
    ]) {
      const p = artisticPoint(point, settings),
        norm = Math.hypot(p.x, p.y),
        c = Math.cos(-settings.angle),
        s = Math.sin(-settings.angle),
        x = c * p.x - s * p.y,
        y = s * p.x + c * p.y,
        den = compression * Math.sqrt(1 - norm ** 2);
      expect(norm).toBeLessThan(1);
      expect(x / den + settings.center.x).toBeCloseTo(point.x, 9);
      expect(y / den + settings.center.y).toBeCloseTo(point.y, 9);
    }
  },
);
it.each([0.1, 1, 8, 64])(
  'analytical bound covers dense independent samples, including S/loops, compression%s',
  (compression) => {
    const settings = { compression, angle: 1.1, center: { x: 0.15, y: -0.2 } },
      tolerance = 0.0001;
    for (const curve of curves) {
      const projected = adaptiveMapCubic(
        curve,
        (p) => artisticPoint(p, settings),
        (c) => artisticCubicError(c, settings),
        tolerance,
        { maxSegments: 10000 },
      );
      expect(projected.errorBound).toBeLessThanOrEqual(tolerance);
      for (let i = 0; i <= 1000; i++)
        expect(
          distanceToPolyline(artisticPoint(evaluate(curve, i / 1000), settings), projected.points),
        ).toBeLessThanOrEqual(tolerance + 1e-10);
      expect(projected.points.every((p) => Math.hypot(p.x, p.y) < 1)).toBe(true);
    }
  },
);
function fixture() {
  const p = newProject();
  p.patterns[0].sourceGeometry = [
    {
      ...geometry('compound', [], true),
      pathData: 'M-10 -10H10V10H-10Z M-3 -3H3V3H-3Z',
      fill: '#3b82f6',
      stroke: '#222222',
      strokeWidth: 0.4,
      fillRule: 'evenodd',
      opacity: 0.5,
      fillOpacity: 0.4,
      strokeOpacity: 0.8,
    },
  ];
  return p;
}
const selection = { target: 'view' as const, bounds: { x: -10, y: -10, width: 20, height: 20 } },
  settings = {
    compression: 4,
    angle: 0.4,
    center: { x: 0.2, y: -0.1 },
    radiusMm: 100,
    toleranceMm: 0.01,
  };
it('finite artistic disk preserves holes, opacity, paint order, source IDs and canonical geometry', () => {
  const project = fixture(),
    before = structuredClone(project),
    disk = deriveArtisticDisk(project, project.patterns[0].id, selection, settings);
  expect(project).toEqual(before);
  expect(disk.report.validity).toBe('ARTISTIC');
  expect(disk.report.hyperbolicTessellation).toBe(false);
  expect(disk.contours.map((c) => c.paint)).toEqual(['fill', 'stroke']);
  expect(disk.contours.map((c) => c.opacity)).toEqual([0.2, 0.4]);
  expect(disk.contours.every((c) => c.sourceId === project.patterns[0].sourceGeometry[0].id)).toBe(
    true,
  );
  for (const contour of disk.contours) {
    const p = paperPath({
      ...geometry('compound', [], true),
      pathData: contour.paths
        .map((path) => 'M' + path.map((v) => `${v.x} ${v.y}`).join('L') + 'Z')
        .join(''),
      fillRule: contour.fillRule,
    });
    try {
      const at = (x: number, y: number) => {
        const v = artisticSourcePoint(disk, { x, y });
        return p.contains(new scope.Point(v.x, v.y));
      };
      expect(at(0, 0)).toBe(false);
      expect(at(6, 0)).toBe(contour.paint === 'fill');
      if (contour.paint === 'stroke') expect(at(3.1, 0)).toBe(true);
      expect(at(-11, 0)).toBe(false);
    } finally {
      p.remove();
    }
    expect(contour.paths.flat().every((p) => Math.hypot(p.x, p.y) < 100)).toBe(true);
  }
  expect(disk.report.numeric.curveProjectionBoundMm).toBeLessThanOrEqual(0.01);
  expect(disk.report.numeric.hasUncertifiedOutlineStep).toBe(true);
  expect(disk.report.numeric.hasUncertifiedClippingStep).toBe(true);
});
it('physical scale doubles coordinates and retains tolerance when the same normalized bound is requested', () => {
  const p = fixture(),
    id = p.patterns[0].id,
    a = deriveArtisticDisk(p, id, selection, settings),
    b = deriveArtisticDisk(p, id, selection, { ...settings, radiusMm: 200, toleranceMm: 0.02 });
  expect(a.report.resources.segments).toBe(b.report.resources.segments);
  const av = a.contours[0].paths[0],
    bv = b.contours[0].paths[0];
  expect(av.length).toBe(bv.length);
  for (let i = 0; i < av.length; i++) {
    expect(bv[i].x).toBeCloseTo(2 * av[i].x, 10);
    expect(bv[i].y).toBeCloseTo(2 * av[i].y, 10);
  }
});
it('global source/segment budgets and invalid parameters fail without publishing partial geometry', () => {
  const p = fixture(),
    before = structuredClone(p),
    id = p.patterns[0].id;
  for (const patch of [
    { maxSegments: 1 },
    { maxCurves: 1 },
    { compression: 0 },
    { compression: 65 },
    { radiusMm: 0 },
    { toleranceMm: NaN },
    { center: { x: 3, y: 0 } },
  ])
    expect(() => deriveArtisticDisk(p, id, selection, { ...settings, ...patch })).toThrow();
  expect(() =>
    adaptiveMapCubic(
      curves[0],
      () => ({ x: NaN, y: 0 }),
      () => 0,
      0.01,
    ),
  ).toThrow(/no finito/);
  expect(() =>
    adaptiveMapCubic(
      curves[0],
      (p) => p,
      () => NaN,
      0.01,
    ),
  ).toThrow(/Cota/);
  expect(p).toEqual(before);
});
it('SVG escapes IDs/metadata and distinguishes artistic deformation from a geometric tessellation', () => {
  const p = fixture();
  p.patterns[0].sourceGeometry[0].id = 'body<&"';
  const disk = deriveArtisticDisk(p, p.patterns[0].id, selection, settings),
    svg = artisticDiskSVG(disk);
  expect(svg).toContain('width="200mm"');
  expect(svg).toContain('Disco artístico');
  expect(svg).toContain('ARTISTIC');
  expect(svg).toContain('body&lt;&amp;&quot;');
  expect(svg).not.toContain('data-source="body<&"');
  expect(svg).toContain('&quot;hyperbolicTessellation&quot;:false');
});
