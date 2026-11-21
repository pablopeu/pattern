import { expect, it } from 'vitest';
import { regularHyperbolicPatch, validPQ } from '../hyperbolic/disk';
const pairs = Array.from({ length: 10 }, (_, i) => i + 3)
  .flatMap((p) => Array.from({ length: 10 }, (_, i) => [p, i + 3]))
  .filter(([p, q]) => validPQ(p, q));
it.each(pairs)(
  'audits every supported pair {%i,%i}: full vertex cycle and root adjacency',
  (p, q) => {
    const root = regularHyperbolicPatch(p, q, { depth: 0 }),
      patch = regularHyperbolicPatch(p, q, {
        depth: Math.ceil(q / 2) + 1,
        radius: Math.min(0.99, root.circumradius + 0.0001),
        maxCells: 4096,
      }),
      v = root.root[0];
    expect(patch.limited.numeric).toBe(0);
    expect(patch.cells[0].neighbors.filter(Boolean)).toHaveLength(p);
    expect(
      patch.cells.filter((c) => c.vertices.some((w) => Math.hypot(w.x - v.x, w.y - v.y) < 1e-7)),
    ).toHaveLength(q);
  },
);
it.each(pairs)('audits the safe camera boundary for {%i,%i}', (p, q) => {
  const patch = regularHyperbolicPatch(p, q, {
    depth: 4,
    maxCells: 512,
    radius: 0.97,
    view: { center: { x: 0.9, y: 0 }, angle: 1.2 },
  });
  expect(patch.limited.numeric).toBe(0);
  expect(new Set(patch.cells.map((c) => c.id)).size).toBe(patch.cells.length);
  expect(patch.cells.length).toBeGreaterThan(1);
  for (const c of patch.cells)
    for (const v of c.display.vertices) expect(Math.hypot(v.x, v.y)).toBeLessThan(1);
});
