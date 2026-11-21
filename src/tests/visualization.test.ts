import { hyperbolicProject } from '../examples/hyperbolic';
import { expect, it } from 'vitest';
import { geometry, newProject, newStudy, node } from '../app/model';
import { defaultVisualization } from '../visualization/model';
import { parseProject, serialize } from '../persistence/schema';
import { migrateDocument } from '../persistence/migrations';
import { deriveProjectDisk } from '../hyperbolic/flat-source';
it('migrates JSON6 purely without adding a view or changing editable geometry and generator', () => {
  const p = newStudy();
  p.patterns[0].sourceGeometry = [geometry('path', [node(2, 3), node(8, 9)])];
  const legacy = { ...p, schemaVersion: 6 },
    saved = structuredClone(legacy),
    restored = parseProject(JSON.stringify(legacy));
  expect(restored.schemaVersion).toBe(7);
  expect(restored.visualization).toBeUndefined();
  expect(restored.patterns).toEqual(p.patterns);
  expect(legacy).toEqual(saved);
  expect(migrateDocument(restored)).toEqual(restored);
});
it('serializes representation version separately from generator and keeps active/source/settings through JSON', () => {
  const p = newStudy(),
    pat = p.patterns[0];
  pat.sourceGeometry = [geometry('path', [node(2, 3), node(8, 9)])];
  const original = structuredClone(p.patterns);
  p.visualization = defaultVisualization(p, pat.id);
  expect(p.visualization.source.selection.target).toBe('lattice');
  expect(parseProject(serialize(p))).toEqual(p);
  expect(p.patterns).toEqual(original);
  p.visualization.active = false;
  expect(parseProject(serialize(p)).visualization?.active).toBe(false);
  expect(pat.generator.version).toBe(1);
  expect(JSON.parse(serialize(p)).schemaVersion).toBe(7);
});
it('rejects unknown future schema/view versions, foreign kinds, invalid p/q and dangling source links', () => {
  const p = newProject();
  p.visualization = defaultVisualization(p, p.patterns[0].id);
  for (const patch of [
    { version: 2 },
    { kind: 'sphere' },
    { source: { ...p.visualization.source, patternId: 'missing' } },
    { settings: { ...p.visualization.settings, p: 4, q: 4 } },
    { settings: { ...p.visualization.settings, maxCells: 4097 } },
    { settings: { ...p.visualization.settings, view: { center: { x: 0.8, y: 0.8 }, angle: 0 } } },
    { unsupported: true },
  ])
    expect(() =>
      parseProject(JSON.stringify({ ...p, visualization: { ...p.visualization, ...patch } })),
    ).toThrow();
  expect(() => parseProject(JSON.stringify({ ...p, schemaVersion: 8 }))).toThrow(
    /admite hasta la versión 7/,
  );
});
it('derives after native reload and returns to the same canonical source', () => {
  const p = newProject(),
    pat = p.patterns[0];
  pat.sourceGeometry = [
    { ...geometry('compound', [], true), pathData: 'M-5 -5H5V5H-5Z', fill: '#3b82f6' },
  ];
  p.visualization = defaultVisualization(p, pat.id);
  p.visualization.settings.depth = 1;
  const native = serialize(p),
    restored = parseProject(native),
    v = restored.visualization!,
    before = structuredClone(restored);
  const disk = deriveProjectDisk(restored, v.source.patternId, v.source.selection, v.settings);
  expect(disk.cells.length).toBeGreaterThan(1);
  expect(restored).toEqual(before);
  restored.visualization!.active = false;
  expect(restored.patterns).toEqual(p.patterns);
  expect(parseProject(serialize(restored)).visualization?.active).toBe(false);
});

it.each(['fish', 'bird'] as const)(
  'public %s example regenerates after JSON without altering its editable source',
  (id) => {
    const original = hyperbolicProject(id),
      restored = parseProject(serialize(original)),
      v = restored.visualization!;
    expect(original.metadata.example!.validity).toBe('APPROXIMATED');
    expect(restored).toEqual(original);
    const before = structuredClone(restored),
      disk = deriveProjectDisk(restored, v.source.patternId, v.source.selection, v.settings);
    expect(disk.cells.length).toBe(100);
    expect(disk.report.resources.segments).toBeLessThanOrEqual(250000);
    expect(disk.report.model.validity).toBe('EXACT');
    expect(disk.report.motif.borderCorrespondence).toBe('NOT_GUARANTEED');
    expect(restored).toEqual(before);
  },
);
