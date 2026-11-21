import { expect, it } from 'vitest';
import { regularHyperbolicPatch, validPQ, diskPoint } from '../hyperbolic/disk';
import {
  rootChambers,
  chamberPoint,
  chamberKleinPoint,
  chamberCubicError,
  poincareToKlein,
  kleinToPoincare,
} from '../hyperbolic/chamber-map';
import { canonicalHyperbolicTopology } from '../hyperbolic/topology';
import { apply, distance } from '../geometry/matrix';
import { adaptiveMapCubic, type Cubic } from '../geometry/nonlinear';
import * as iso from '../vendor/poincare/iso';
const pairs = Array.from({ length: 10 }, (_, i) => i + 3).flatMap((p) =>
  Array.from({ length: 10 }, (_, i) => i + 3)
    .filter((q) => validPQ(p, q))
    .map((q) => ({ p, q })),
);
it.each(pairs)(
  '{$p,$q}: 2p chambers partition the Klein polygon and both source pieces match',
  ({ p, q }) => {
    const patch = regularHyperbolicPatch(p, q, { depth: 0 }),
      chambers = rootChambers(patch),
      vertices = patch.root.map(poincareToKlein),
      polygonArea = Math.abs(
        vertices.reduce((sum, a, i) => {
          const b = vertices[(i + 1) % p];
          return sum + a.x * b.y - a.y * b.x;
        }, 0) / 2,
      );
    expect(chambers.length).toBe(2 * p);
    let area = 0;
    for (const chamber of chambers) {
      const [a, b] = chamber.affines,
        detA = a[0] * a[3] - a[1] * a[2],
        detB = b[0] * b[3] - b[1] * b[2];
      expect(detA * detB).toBeGreaterThan(0);
      area += (Math.abs(detA) + Math.abs(detB)) / 2;
      for (let i = 0; i <= 10; i++) {
        const v = { x: i / 10, y: 1 - i / 10 };
        expect(distance(apply(a, v), apply(b, v))).toBeLessThan(1e-12);
      }
      expect(
        distance(chamberPoint(chamber, { x: 0, y: 0 }, iso.IDENTITY), { x: 0, y: 0 }),
      ).toBeLessThan(1e-12);
      expect(
        distance(chamberPoint(chamber, { x: 1, y: 0 }, iso.IDENTITY), chamber.edgeMidpoint),
      ).toBeLessThan(1e-10);
      expect(
        distance(chamberPoint(chamber, { x: 1, y: 1 }, iso.IDENTITY), chamber.corner),
      ).toBeLessThan(1e-10);
      const A = vertices[chamber.edge],
        B = vertices[(chamber.edge + 1) % p],
        E = poincareToKlein(chamber.edgeMidpoint);
      expect(distance(E, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 })).toBeLessThan(1e-10);
    }
    expect(area).toBeCloseTo(polygonArea, 10);
  },
);
it('Klein/Poincaré conversion has an independent rational inverse throughout the disk', () => {
  for (const r of [0, 0.1, 0.5, 0.9, 0.99, 0.999])
    for (let i = 0; i < 12; i++) {
      const p = { x: r * Math.cos(i), y: r * Math.sin(i) },
        k = poincareToKlein(p),
        back = kleinToPoincare(k);
      expect(distance(p, back)).toBeLessThan(1e-10);
    }
  expect(() => kleinToPoincare({ x: 1, y: 0 })).toThrow();
});
it.each([
  { p: 3, q: 7 },
  { p: 4, q: 5 },
  { p: 7, q: 3 },
  { p: 12, q: 12 },
])(
  '{$p,$q}: topological identity keeps reciprocal edges and vertex valency under camera',
  ({ p, q }) => {
    for (const center of [
      { x: 0, y: 0 },
      { x: 0.8, y: 0.1 },
    ]) {
      const patch = regularHyperbolicPatch(p, q, {
          depth: 1,
          maxCells: 128,
          radius: 0.98,
          view: { center, angle: 0.4 },
        }),
        top = canonicalHyperbolicTopology(patch);
      expect(top.vertices.size - top.edges.size + patch.cells.length).toBe(1);
      expect(top.maxEndpointMismatch).toBeLessThan(1e-7);
      for (const v of top.vertices.values()) expect(v.members.length).toBeLessThanOrEqual(q);
      for (const edge of top.edges.values()) {
        if (edge.owners.length === 2) {
          const [a, b] = edge.owners,
            ca = patch.cells.find((c) => c.id === a.cellId)!,
            cb = patch.cells.find((c) => c.id === b.cellId)!;
          expect(ca.neighbors[a.edge]).toBe(b.cellId);
          expect(cb.neighbors[b.edge]).toBe(a.cellId);
        }
        const [a, b] = edge.vertices.map((id) => top.vertices.get(id)!.point),
          m = edge.midpoint,
          metric = (a: { x: number; y: number }, b: { x: number; y: number }) =>
            2 *
            Math.asinh(
              distance(a, b) / Math.sqrt((1 - a.x * a.x - a.y * a.y) * (1 - b.x * b.x - b.y * b.y)),
            );
        expect(Math.abs(metric(a, m) - metric(m, b))).toBeLessThan(1e-6);
        expect(Math.abs(metric(a, b) - metric(a, m) - metric(m, b))).toBeLessThan(1e-6);
      }
    }
  },
);
const curves: Cubic[] = [
  [
    { x: 0.05, y: 0.05 },
    { x: 0.05, y: 0.95 },
    { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 },
  ],
  [
    { x: 0.2, y: 0.3 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0.2, y: 0.3 },
  ],
  [
    { x: 0.1, y: 0.1 },
    { x: 0.4, y: 0.4 },
    { x: 0.7, y: 0.7 },
    { x: 0.9, y: 0.9 },
  ],
  [
    { x: 0, y: 1 },
    { x: 0.3, y: 0.7 },
    { x: 0.7, y: 0.3 },
    { x: 1, y: 0 },
  ],
];
const cubic = (c: Cubic, t: number) => ({
  x:
    (1 - t) ** 3 * c[0].x +
    3 * (1 - t) ** 2 * t * c[1].x +
    3 * (1 - t) * t * t * c[2].x +
    t ** 3 * c[3].x,
  y:
    (1 - t) ** 3 * c[0].y +
    3 * (1 - t) ** 2 * t * c[1].y +
    3 * (1 - t) * t * t * c[2].y +
    t ** 3 * c[3].y,
});
function polylineDistance(p: { x: number; y: number }, points: { x: number; y: number }[]) {
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
it.each([
  { p: 3, q: 7 },
  { p: 4, q: 5 },
  { p: 7, q: 3 },
])(
  '{$p,$q}: error bound covers seam-crossing curves/loops under direct and reflected isometries',
  ({ p, q }) => {
    const chamber = rootChambers(regularHyperbolicPatch(p, q, { depth: 0 }))[0],
      base = iso.compose(iso.translation(0.4, 0.2), iso.rotation(0.7));
    for (const frame of [base, { ...base, conj: true }])
      for (const c of curves) {
        const result = adaptiveMapCubic(
          c,
          (p) => chamberPoint(chamber, p, frame),
          (c) => chamberCubicError(c, chamber, frame),
          0.0002,
          { maxSegments: 20000 },
        );
        expect(result.errorBound).toBeLessThanOrEqual(0.0002);
        for (let i = 0; i <= 500; i++)
          expect(
            polylineDistance(chamberPoint(chamber, cubic(c, i / 500), frame), result.points),
          ).toBeLessThanOrEqual(0.0002 + 1e-10);
        expect(result.points.every((p) => Math.hypot(p.x, p.y) < 1)).toBe(true);
      }
  },
);
it('neighbor cameras share the same E/V parametrization before caching, not only the endpoints', () => {
  const patch = regularHyperbolicPatch(7, 3, { depth: 1 }),
    templates = rootChambers(patch),
    top = canonicalHyperbolicTopology(patch);
  for (const edge of top.edges.values())
    if (edge.owners.length === 2) {
      const [a, b] = edge.owners,
        ca = patch.cells.find((c) => c.id === a.cellId)!,
        cb = patch.cells.find((c) => c.id === b.cellId)!;
      for (const vertexId of edge.vertices) {
        const ta = templates.find(
            (t) => t.edge === a.edge && top.corners.get(a.cellId)![t.vertex] === vertexId,
          )!,
          tb = templates.find(
            (t) => t.edge === b.edge && top.corners.get(b.cellId)![t.vertex] === vertexId,
          )!;
        for (let i = 0; i <= 20; i++)
          expect(
            distance(
              chamberPoint(ta, { x: 1, y: i / 20 }, ca.display.frame),
              chamberPoint(tb, { x: 1, y: i / 20 }, cb.display.frame),
            ),
          ).toBeLessThan(1e-9);
      }
    }
  const c = templates[0];
  expect(distance(chamberKleinPoint(c, { x: 0, y: 1 }), poincareToKlein(c.corner))).toBeGreaterThan(
    0,
  );
  expect(distance(diskPoint(iso.IDENTITY, c.corner), c.corner)).toBe(0);
});
