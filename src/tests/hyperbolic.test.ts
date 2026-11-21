import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as iso from '../vendor/poincare/iso';
import { angleAt, distance, measureTriangle } from '../vendor/poincare/geometry';
import { makeTiling } from '../vendor/poincare/tiling';
import manifest from '../vendor/poincare/upstream.json';
import {
  diskPoint,
  diskGeodesic,
  regularHyperbolicPatch,
  hyperbolicCellPath,
  sourceEmbedding,
  validPQ,
} from '../hyperbolic/disk';
import { projectCubic, projectedCubicError, type Cubic } from '../hyperbolic/project';
import { apply, type Point } from '../geometry/matrix';
const tuple = (p: Point): [number, number] => [p.x, p.y];
const norm = (p: Point) => Math.hypot(p.x, p.y);
const pairs = [
  [3, 7],
  [7, 3],
  [4, 5],
  [5, 4],
  [8, 3],
  [12, 12],
] as const;
function near(a: Point, b: Point, tol = 1e-8) {
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(tol);
}
function cubic(c: Cubic, t: number): Point {
  const s = 1 - t;
  return {
    x: s ** 3 * c[0].x + 3 * s * s * t * c[1].x + 3 * s * t * t * c[2].x + t ** 3 * c[3].x,
    y: s ** 3 * c[0].y + 3 * s * s * t * c[1].y + 3 * s * t * t * c[2].y + t ** 3 * c[3].y,
  };
}
function toSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
describe('Poincaré mathematical core, not yet a UI representation', () => {
  it('preserves the pinned upstream files byte for byte', () => {
    expect(manifest.commit).toBe('38abc004bb57133c894b7abeb1e8b07a255d1b77');
    for (const [file, sha] of Object.entries(manifest.sha256))
      expect(
        createHash('sha256')
          .update(readFileSync(`src/vendor/poincare/${file}`))
          .digest('hex'),
      ).toBe(sha);
  });
  it('rejects spherical, Euclidean, fractional and unbounded parameters', () => {
    for (const [p, q] of [
      [3, 3],
      [3, 6],
      [4, 4],
      [6, 3],
      [2, 7],
      [3.5, 7],
      [13, 3],
      [3, Infinity],
    ]) {
      expect(validPQ(p, q)).toBe(false);
      expect(() => regularHyperbolicPatch(p, q)).toThrow();
    }
    for (const o of [
      { depth: 9 },
      { depth: -1 },
      { maxCells: 0 },
      { maxCells: 4097 },
      { radius: 1 },
      { radius: NaN },
    ])
      expect(() => regularHyperbolicPatch(7, 3, o)).toThrow();
  });
  it.each(pairs)('{%i,%i}: equal sides, conformal angles and Gauss–Bonnet area', (p, q) => {
    const patch = regularHyperbolicPatch(p, q, { depth: 0 }),
      t = makeTiling(p, q),
      v = patch.root,
      edge = distance(tuple(v[0]), tuple(v[1]));
    expect(patch.circumradius).toBeCloseTo(
      Math.sqrt(Math.cos(Math.PI / p + Math.PI / q) / Math.cos(Math.PI / p - Math.PI / q)),
      10,
    );
    for (let i = 0; i < p; i++) {
      expect(distance(tuple(v[i]), tuple(v[(i + 1) % p]))).toBeCloseTo(edge, 10);
      expect(angleAt(tuple(v[i]), tuple(v[(i + p - 1) % p]), tuple(v[(i + 1) % p]))).toBeCloseTo(
        (2 * Math.PI) / q,
        10,
      );
    }
    expect(patch.area).toBeGreaterThan(0);
    expect(2 * p * measureTriangle(...t.corners).area).toBeCloseTo(patch.area, 10);
  });
  it.each(pairs)('{%i,%i}: finite unique cells and reciprocal shared geodesics', (p, q) => {
    const patch = regularHyperbolicPatch(p, q, { depth: 4, maxCells: 400, radius: 0.94 }),
      map = new Map(patch.cells.map((c) => [c.id, c]));
    expect(patch.cells.length).toBeGreaterThan(p);
    expect(patch.limited.numeric).toBe(0);
    expect(map.size).toBe(patch.cells.length);
    for (const cell of patch.cells) {
      expect(cell.frame.conj).toBe(false);
      near(diskPoint(cell.frame, { x: 0, y: 0 }), cell.center);
      expect(cell.vertices.every((v) => norm(v) < 1)).toBe(true);
      for (let e = 0; e < p; e++) {
        const id = cell.neighbors[e];
        if (!id) continue;
        const n = map.get(id)!;
        expect(n.neighbors).toContain(cell.id);
        expect(
          n.vertices.some(
            (v) => Math.hypot(v.x - cell.vertices[e].x, v.y - cell.vertices[e].y) < 1e-7,
          ),
        ).toBe(true);
        expect(
          n.vertices.some(
            (v) =>
              Math.hypot(v.x - cell.vertices[(e + 1) % p].x, v.y - cell.vertices[(e + 1) % p].y) <
              1e-7,
          ),
        ).toBe(true);
      }
    }
    expect(patch.cells[0].neighbors.filter(Boolean)).toHaveLength(p);
  });
  it.each([
    [7, 3, 2],
    [3, 7, 5],
    [4, 5, 3],
  ])('has q polygons incident on a root vertex for {%i,%i}', (p, q, depth) => {
    const patch = regularHyperbolicPatch(p, q, { depth, maxCells: 4096, radius: 0.95 }),
      vertex = patch.root[0];
    expect(
      patch.cells.filter((c) =>
        c.vertices.some((v) => Math.hypot(v.x - vertex.x, v.y - vertex.y) < 1e-7),
      ),
    ).toHaveLength(q);
  });
  it('canonical frames stay stable as depth/radius/budgets change', () => {
    const a = regularHyperbolicPatch(3, 7, { depth: 4, maxCells: 300, radius: 0.8 }),
      b = regularHyperbolicPatch(3, 7, { depth: 6, maxCells: 1500, radius: 0.97 });
    const map = new Map(b.cells.map((c) => [c.id, c]));
    for (const c of a.cells) {
      const d = map.get(c.id)!;
      expect(d).toBeDefined();
      near(diskPoint(c.frame, { x: 0.11, y: 0.08 }), diskPoint(d.frame, { x: 0.11, y: 0.08 }));
    }
  });
  it('reports finite truncation rather than claiming the entire infinite disk', () => {
    expect(regularHyperbolicPatch(7, 3, { depth: 0 }).limited.depth).toBe(true);
    const p = regularHyperbolicPatch(7, 3, { maxCells: 10, depth: 8 });
    expect(p.cells).toHaveLength(10);
    expect(p.limited.budget).toBe(true);
    const small = regularHyperbolicPatch(7, 3, { radius: 0.01 });
    expect(small.cells).toHaveLength(1);
    expect(small.limited.depth).toBe(false);
  });
  it('retains polygons reaching the cutoff even if their centers lie outside it', () => {
    const p = regularHyperbolicPatch(12, 12, { radius: 0.97, depth: 2, maxCells: 1000 });
    expect(p.cells.some((c) => norm(c.center) > 0.97)).toBe(true);
  });
  it('composition/inversion and mirrors preserve hyperbolic distance', () => {
    const a = { x: 0.12, y: -0.24 },
      b = { x: -0.35, y: 0.22 },
      t = makeTiling(7, 3);
    for (const f of [iso.compose(iso.translation(0.8, 0.1), iso.rotation(0.74)), ...t.mirrors]) {
      const fa = diskPoint(f, a),
        fb = diskPoint(f, b);
      near(diskPoint(iso.inverse(f), fa), a);
      expect(distance(tuple(fa), tuple(fb))).toBeCloseTo(distance(tuple(a), tuple(b)), 10);
      near(diskPoint(iso.compose(iso.inverse(f), f), a), a);
    }
    for (const f of t.mirrors) near(diskPoint(iso.compose(f, f), a), a);
  });
  it('geodesic arcs are orthogonal to the boundary; diameters stay straight', () => {
    expect(diskGeodesic({ x: -0.4, y: 0 }, { x: 0.6, y: 0 }).kind).toBe('line');
    const p = regularHyperbolicPatch(7, 3, { depth: 2, maxCells: 80 });
    for (const c of p.cells)
      for (let i = 0; i < 7; i++) {
        const a = c.vertices[i],
          b = c.vertices[(i + 1) % 7],
          g = diskGeodesic(a, b);
        if (g.kind === 'line') continue;
        expect(g.cx * g.cx + g.cy * g.cy - g.r * g.r).toBeCloseTo(1, 7);
        expect(Math.hypot(a.x - g.cx, a.y - g.cy)).toBeCloseTo(g.r, 9);
        expect(Math.hypot(b.x - g.cx, b.y - g.cy)).toBeCloseTo(g.r, 9);
      }
    const d = hyperbolicCellPath(p.root, 100);
    expect(d.match(/A/g)).toHaveLength(7);
    expect(d.endsWith('Z')).toBe(true);
  });
  it('normalizes the complete source control hull safely inside the root', () => {
    const b = { x: -10, y: 50, width: 120, height: 80 },
      copy = structuredClone(b),
      f = sourceEmbedding(7, 3, b);
    for (const x of [b.x, b.x + b.width])
      for (const y of [b.y, b.y + b.height])
        expect(norm(apply(f.matrix, { x, y }))).toBeCloseTo(f.maxRadius, 12);
    expect(f.maxRadius).toBeLessThan(makeTiling(7, 3).mid);
    expect(b).toEqual(copy);
    expect(() => sourceEmbedding(7, 3, { x: 0, y: 0, width: 0, height: 0 })).toThrow();
  });
  const curves: Cubic[] = [
    [
      { x: -0.5, y: 0 },
      { x: -0.3, y: 0.65 },
      { x: 0.3, y: -0.65 },
      { x: 0.5, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0.65, y: 0.4 },
      { x: -0.65, y: -0.4 },
      { x: 0, y: 0 },
    ],
    [
      { x: -0.2, y: -0.2 },
      { x: 0.1, y: 0.5 },
      { x: 0.4, y: 0.4 },
      { x: 0.5, y: -0.1 },
    ],
  ];
  it.each(curves.map((c, i) => ({ c, i })))(
    'certifies an S-curve/loop/general cubic $i against dense samples',
    ({ c }) => {
      const saved = structuredClone(c),
        tolerance = 0.0001;
      for (const f of [
        iso.IDENTITY,
        iso.compose(iso.translation(0.96, 0), iso.rotation(0.71)),
        makeTiling(5, 4).mirrors[2],
      ]) {
        const r = projectCubic(c, f, tolerance);
        expect(r.segments).toBeGreaterThan(1);
        expect(r.errorBound).toBeLessThanOrEqual(tolerance);
        let error = 0;
        for (let i = 0; i <= 2000; i++) {
          const p = diskPoint(f, cubic(c, i / 2000));
          error = Math.max(
            error,
            Math.min(...r.points.slice(1).map((b, j) => toSegment(p, r.points[j], b))),
          );
        }
        expect(error).toBeLessThanOrEqual(tolerance);
        expect(c).toEqual(saved);
      }
    },
  );
  it('does not silently return a coarse projection when precision cannot be met', () => {
    expect(projectedCubicError(curves[1], iso.IDENTITY)).toBeGreaterThan(0.1);
    expect(() => projectCubic(curves[0], iso.IDENTITY, 1e-8, { maxDepth: 0 })).toThrow(
      /profundidad/,
    );
    expect(() => projectCubic(curves[0], iso.IDENTITY, 1e-8, { maxSegments: 2 })).toThrow(
      /presupuesto/,
    );
    expect(() => projectCubic(curves[0], iso.IDENTITY, 0)).toThrow();
    expect(() =>
      projectCubic(
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        iso.IDENTITY,
        0.001,
      ),
    ).toThrow(/disco/);
  });
});
