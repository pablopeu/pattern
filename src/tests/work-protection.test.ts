import { expect, it } from 'vitest';
import { newStudy, geometry, node } from '../app/model';
import { hasProjectWork } from '../app/destructive-action';
it('distinguishes an empty study/preferences from existing visible or hidden work', () => {
  const p = newStudy();
  expect(hasProjectWork(p)).toBe(false);
  p.preferences.snap = false;
  p.metadata.name = 'Mi configuración';
  expect(hasProjectWork(p)).toBe(false);
  p.patterns[0].sourceGeometry.push({
    ...geometry('path', [node(0, 0), node(1, 1)]),
    visible: false,
  });
  expect(hasProjectWork(p)).toBe(true);
});
it('also protects generated content without a hand drawn source', () => {
  const p = newStudy();
  p.patterns[0].generator.kind = 'girih';
  expect(hasProjectWork(p)).toBe(true);
  const q = newStudy();
  q.regions.push({ id: 'r', name: 'Perímetro', geometry: [geometry('rectangle', [], true)] });
  expect(hasProjectWork(q)).toBe(true);
});
