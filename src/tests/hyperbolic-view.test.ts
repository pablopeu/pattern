import { describe, expect, it } from 'vitest';
import { regularHyperbolicPatch, visibleHyperbolicCells, diskPoint } from '../hyperbolic/disk';
import { isoEquals, inverse } from '../vendor/poincare/iso';
import { makeTiling } from '../vendor/poincare/tiling';
const n = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);
describe('hyperbolic view isometry and conservative motif LOD', () => {
  it.each([
    [7, 3],
    [3, 7],
    [12, 12],
  ])('{%i,%i}: starts on screen, keeping world source frames independent of camera', (p, q) => {
    const center = { x: 0.8, y: 0.1 },
      a = regularHyperbolicPatch(p, q, { depth: 5, maxCells: 1500, radius: 0.97 }),
      b = regularHyperbolicPatch(p, q, {
        depth: 4,
        maxCells: 800,
        radius: 0.94,
        view: { center, angle: 0.7 },
      }),
      map = new Map(a.cells.map((c) => [c.id, c]));
    const origin = diskPoint(b.view, center);
    expect(n(origin)).toBeLessThan(1e-10);
    expect(b.limited.numeric).toBe(0);
    expect(b.cells.length).toBeGreaterThan(1);
    let common = 0;
    for (const c of b.cells) {
      expect(c.display.vertices.every((v) => n(v) < 1)).toBe(true);
      const d = map.get(c.id);
      if (d) {
        common++;
        expect(isoEquals(c.frame, d.frame, 1e-6)).toBe(true);
      }
    }
    expect(common).toBeGreaterThan(0);
    // The seed polygon actually contains the view center (now zero).
    const seed = b.cells[0],
      back = diskPoint(inverse(seed.display.frame), { x: 0, y: 0 }),
      t = makeTiling(p, q);
    for (let i = 0; i < p; i++)
      expect(
        1 +
          back.x ** 2 +
          back.y ** 2 -
          2 *
            t.circle.c *
            (Math.cos((2 * Math.PI * i) / p) * back.x + Math.sin((2 * Math.PI * i) / p) * back.y),
      ).toBeGreaterThanOrEqual(-1e-8);
  });
  it('rotation preserves topology and world frames while rotating display vertices', () => {
    const a = regularHyperbolicPatch(7, 3, { depth: 3 }),
      b = regularHyperbolicPatch(7, 3, {
        depth: 3,
        view: { center: { x: 0, y: 0 }, angle: Math.PI / 2 },
      });
    expect(a.cells.map((c) => c.id)).toEqual(b.cells.map((c) => c.id));
    for (let i = 0; i < a.cells.length; i++) {
      const u = a.cells[i],
        v = b.cells[i];
      expect(u.neighbors).toEqual(v.neighbors);
      expect(v.display.center.x).toBeCloseTo(-u.center.y, 10);
      expect(v.display.center.y).toBeCloseTo(u.center.x, 10);
    }
  });
  it('LOD only omits polygons with a proven small enclosing circle and never mutates a patch', () => {
    const patch = regularHyperbolicPatch(7, 3, { depth: 6, maxCells: 1500, radius: 0.99 }),
      saved = structuredClone(patch),
      all = visibleHyperbolicCells(patch, 0),
      coarse = visibleHyperbolicCells(patch, 0.05);
    expect(all.cells).toHaveLength(patch.cells.length);
    expect(coarse.omitted).toBeGreaterThan(0);
    expect(coarse.cells.length).toBeGreaterThan(0);
    expect(patch).toEqual(saved);
    const kept = new Set(coarse.cells.map((c) => c.id));
    for (const c of patch.cells)
      if (!kept.has(c.id))
        for (const a of c.display.vertices)
          for (const b of c.display.vertices)
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.05);
  });
  it('rejects invalid view centers/angles/detail thresholds', () => {
    for (const view of [
      { center: { x: 0.99, y: 0 }, angle: 0 },
      { center: { x: 0, y: 0 }, angle: NaN },
      { center: { x: NaN, y: 0 }, angle: 0 },
    ])
      expect(() => regularHyperbolicPatch(7, 3, { view })).toThrow(/vista/);
    expect(() => visibleHyperbolicCells(regularHyperbolicPatch(7, 3), -1)).toThrow();
  });
});
