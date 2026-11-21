import { chamberProject } from '../examples/chambers';
import { deriveChamberDisk } from '../hyperbolic/chambers';
import { artisticDiskProject } from '../examples/artistic';
import { deriveArtisticDisk } from '../artistic/disk';
import { hyperbolicProject } from '../examples/hyperbolic';
import { expect, it } from 'vitest';
import { geometry, newProject, newStudy, node } from '../app/model';
import {
  defaultVisualization,
  defaultArtisticVisualization,
  changeVisualizationKind,
} from '../visualization/model';
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
    { version: 3 },
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
  if (v.kind !== 'poincare') throw Error('Expected geometric fixture');
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
    if (v.kind !== 'poincare') throw Error('Expected geometric fixture');
    const before = structuredClone(restored),
      disk = deriveProjectDisk(restored, v.source.patternId, v.source.selection, v.settings);
    expect(disk.cells.length).toBe(100);
    expect(disk.report.resources.segments).toBeLessThanOrEqual(250000);
    expect(disk.report.model.validity).toBe('EXACT');
    expect(disk.report.motif.borderCorrespondence).toBe('NOT_GUARANTEED');
    expect(restored).toEqual(before);
  },
);

it('artistic native record and pure mode switching preserve the same editable source and physical settings', () => {
  const project = newStudy(),
    original = structuredClone(project.patterns),
    geom = defaultVisualization(project, project.patterns[0].id);
  geom.settings.radiusMm = 240;
  const art = changeVisualizationKind(project, geom, 'artistic-disk');
  expect(art.kind).toBe('artistic-disk');
  expect(art.settings.radiusMm).toBe(240);
  expect(art.source).toEqual(geom.source);
  expect(project.patterns).toEqual(original);
  project.visualization = art;
  expect(parseProject(serialize(project))).toEqual(project);
  art.settings.view.center = { x: 1.2, y: 1.6 };
  const back = changeVisualizationKind(project, art, 'poincare');
  expect(Math.hypot(back.settings.view.center.x, back.settings.view.center.y)).toBeLessThanOrEqual(
    0.9,
  );
  expect(back.source).toEqual(geom.source);
  expect(back.settings.radiusMm).toBe(240);
  project.visualization = back;
  expect(parseProject(serialize(project))).toEqual(project);
  expect(project.patterns).toEqual(original);
});
it('artistic reader rejects invalid models, geometry-only fields and unbounded compression', () => {
  const p = newProject();
  p.visualization = defaultArtisticVisualization(p, p.patterns[0].id);
  for (const patch of [
    { compression: 0 },
    { compression: 65 },
    { p: 7 },
    { maxSegments: 1000001 },
    { view: { center: { x: 2, y: 2 }, angle: 0 } },
  ])
    expect(() =>
      parseProject(
        JSON.stringify({
          ...p,
          visualization: {
            ...p.visualization,
            settings: { ...p.visualization!.settings, ...patch },
          },
        }),
      ),
    ).toThrow();
});

it.each(['fish', 'rings'] as const)(
  'original artistic %s example regenerates within its explicit budgets after JSON',
  (id) => {
    const p = artisticDiskProject(id),
      restored = parseProject(serialize(p)),
      v = restored.visualization!;
    if (v.kind !== 'artistic-disk') throw Error('Expected artistic fixture');
    expect(restored).toEqual(p);
    const original = structuredClone(restored),
      disk = deriveArtisticDisk(restored, v.source.patternId, v.source.selection, {
        ...v.settings,
        center: v.settings.view.center,
        angle: v.settings.view.angle,
      });
    expect(disk.report.validity).toBe('ARTISTIC');
    expect(disk.report.resources.segments).toBeLessThanOrEqual(v.settings.maxSegments);
    expect(disk.report.source.sourceIds).toHaveLength(p.patterns[0].sourceGeometry.length);
    expect(restored).toEqual(original);
  },
);

it('migrates component Poincare1 to2 purely and preserves an inscribed source', () => {
  const project = newStudy(),
    v = defaultVisualization(project, project.patterns[0].id),
    settings: Record<string, unknown> = { ...v.settings };
  delete settings.adaptation;
  delete settings.maxCurves;
  const legacy = { ...project, visualization: { ...v, version: 1, settings } },
    before = structuredClone(legacy),
    restored = parseProject(JSON.stringify(legacy));
  expect(restored.visualization?.version).toBe(2);
  if (restored.visualization?.kind !== 'poincare') throw Error('Expected geometric migration');
  expect(restored.visualization.settings.adaptation).toBe('inscribed');
  expect(restored.visualization.settings.maxCurves).toBe(4096);
  expect(restored.patterns).toEqual(project.patterns);
  expect(legacy).toEqual(before);
  expect(() =>
    parseProject(JSON.stringify({ ...project, visualization: { ...v, version: 1 } })),
  ).toThrow(/visualización1/);
});
it('component2 preserves chamber adaptation and rejects unknown methods without replacing the source', () => {
  const project = newStudy();
  project.visualization = defaultVisualization(project, project.patterns[0].id);
  project.visualization.settings.adaptation = 'mirrored-chambers';
  expect(parseProject(serialize(project))).toEqual(project);
  expect(() =>
    parseProject(
      JSON.stringify({
        ...project,
        visualization: {
          ...project.visualization,
          settings: { ...project.visualization!.settings, adaptation: 'affine' },
        },
      }),
    ),
  ).toThrow();
});

it('original chamber gallery example regenerates within its explicit budgets after JSON', () => {
  const project = chamberProject(),
    restored = parseProject(serialize(project)),
    v = restored.visualization!;
  if (v.kind !== 'poincare') throw Error('Expected geometric fixture');
  expect(restored).toEqual(project);
  const before = structuredClone(restored),
    disk = deriveChamberDisk(restored, v.source.patternId, v.source.selection, v.settings);
  expect(disk.report.motif.borderCorrespondence).toBe('CANONICAL_C0');
  expect(disk.report.resources.segments).toBeLessThanOrEqual(v.settings.maxSegments);
  expect(disk.report.resources.visible).toBeGreaterThan(0);
  expect(restored).toEqual(before);
});
