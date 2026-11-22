import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { functionalGeometryProject } from '../examples/functional-geometry';
import { compileComposition, compositionIssue } from '../composition/evaluate';
import { parseProject, serialize } from '../persistence/schema';
import { apply, inverse, multiply } from '../geometry/matrix';
import { prepareExport } from '../export/svg';
import { buildScene } from '../patterns/engine';
it.each([
  [0, 4],
  [1, 44],
  [2, 156],
  [3, 412],
  [4, 956],
  [5, 2076],
])('classical functional construction depth%s has%s leaves from one source', (depth, count) => {
  const p = functionalGeometryProject(),
    pat = p.patterns[0],
    c = pat.composition!;
  if (c.kind !== 'recursive') throw Error('Expected recursive');
  c.depth = depth;
  const before = structuredClone(p),
    report = compileComposition(c);
  expect(report.leaves).toHaveLength(count);
  expect(new Set(report.leaves.map((l) => l.id)).size).toBe(count);
  expect(report.limited).toBe(false);
  expect(report.leaves.some((l) => l.matrix[0] * l.matrix[3] - l.matrix[1] * l.matrix[2] < 0)).toBe(
    true,
  );
  for (const leaf of report.leaves.slice(0, 20)) {
    const m = multiply(inverse(leaf.matrix), leaf.matrix),
      point = apply(m, { x: 0.37, y: 0.69 });
    expect(point.x).toBeCloseTo(0.37, 12);
    expect(point.y).toBeCloseTo(0.69, 12);
  }
  expect(p).toEqual(before);
  expect(parseProject(serialize(p))).toEqual(p);
  expect(pat.sourceGeometry).toHaveLength(1);
});
it('keeps the upstream fish/license exactly and credits the reusable source', () => {
  for (const [file, hash] of [
    ['fish.path', '42b1b75631ba2fc678a1a9397db8bfe67c029ab9'],
    ['LICENSE', '9cecc1d4669ee8af2ca727a5d8cde10cd8b2d7cc'],
  ]) {
    const data = readFileSync(`src/vendor/escher/${file}`);
    expect(createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')).toBe(
      hash,
    );
  }
  const p = functionalGeometryProject();
  expect(p.patterns[0].sourceGeometry[0].pathData).toBe(
    readFileSync('src/vendor/escher/fish.path', 'utf8'),
  );
  expect(p.metadata.example?.artwork).toBe('licensed');
  expect(p.metadata.example?.references.some((r) => r.url.endsWith('LICENSE.txt'))).toBe(true);
});
it('rejects depth6 explicitly and preserves the old ring recipe', () => {
  const p = functionalGeometryProject(),
    c = p.patterns[0].composition!;
  if (c.kind !== 'recursive') throw Error('Expected recursive');
  c.depth = 6;
  expect(compositionIssue(c)).toMatch(/profundidad/);
  expect(() => parseProject(serialize(p))).toThrow();
  c.recipe = 'square-limit';
  expect(compositionIssue(c)).toBeNull();
});
it('scene and placement round-trip preserve one editable source and stable instance IDs', () => {
  const p = functionalGeometryProject(),
    q = parseProject(serialize(p)),
    bounds = { x: -100, y: -100, width: 200, height: 200 },
    a = buildScene(p.patterns[0], bounds),
    b = buildScene(q.patterns[0], bounds);
  expect(a.generated.geometry).toHaveLength(1);
  expect(a.generated.placements).toHaveLength(412);
  expect(a.generated.placements).toEqual(b.generated.placements);
  expect(a.generated.composition?.ids).toEqual(b.generated.composition?.ids);
});

it('exported SVG carries source credits without interpreting XML from the author field', () => {
  const p = functionalGeometryProject();
  p.metadata.example!.author = '<script>hostile & author</script>';
  const out = prepareExport(p, {
    target: 'view',
    format: 'svg',
    representation: 'editable',
    width: 160,
    height: 160,
    dpi: 96,
    background: '#fff',
    transparent: false,
    quality: 0.9,
    tolerance: 0.02,
    outlineStrokes: false,
    patternId: p.patterns[0].id,
  });
  expect(out.svg).toContain('data-patterns-example="true"');
  expect(out.svg).toContain('mapio/programming-with-escher');
  expect(out.svg).toContain('&lt;script&gt;hostile &amp; author&lt;/script&gt;');
  expect(out.svg).not.toContain('<script>');
});
