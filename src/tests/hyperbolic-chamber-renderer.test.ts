import { expect, it } from 'vitest';
import { geometry, newProject } from '../app/model';
import { deriveChamberDisk, chamberDiskSVG } from '../hyperbolic/chambers';
const selection = { target: 'view' as const, bounds: { x: 0, y: 0, width: 100, height: 100 } },
  settings = {
    p: 7,
    q: 3,
    radiusMm: 100,
    toleranceMm: 0.01,
    depth: 1,
    maxCells: 20,
    debugBoundaries: true,
  };
function source() {
  const project = newProject();
  project.patterns[0].sourceGeometry = [
    {
      ...geometry('compound', [], true),
      pathData: 'M0 0H100V100H0Z',
      fill: '#3b82f6',
      stroke: 'none',
      opacity: 0.5,
    },
  ];
  return project;
}
it('canonical reflected chambers preserve source and reuse actual shared edge point arrays', () => {
  const project = source(),
    before = structuredClone(project),
    disk = deriveChamberDisk(project, project.patterns[0].id, selection, settings);
  expect(project).toEqual(before);
  expect(disk.cells.length).toBe(8);
  expect(disk.report.resources.chambers).toBe(112);
  expect(disk.report.motif.borderCorrespondence).toBe('CANONICAL_C0');
  expect(disk.report.motif.derivativesMatched).toBe(false);
  expect(disk.report.resources.boundaryCurveCacheHits).toBeGreaterThan(100);
  const shared = disk.boundaryTraces.filter((t) => t.owners.length > 1);
  expect(shared.length).toBeGreaterThan(50);
  expect(shared.every((t) => t.points.length > 1 && t.uses >= t.owners.length)).toBe(true);
  for (const trace of shared) {
    // Every cached point is emitted by each actual owning chamber, not only an ID in metadata.
    for (const owner of trace.owners) {
      const [id, index] = owner.split('/c'),
        cell = disk.cells.find((c) => c.id === id)!;
      expect(cell).toBeDefined();
      const paths = cell.contours
        .filter((c) => c.chamberIndex === Number(index))
        .flatMap((c) => c.paths);
      for (const point of trace.points)
        expect(
          paths.some((path) =>
            path.some((p) => Object.is(p.x, point.x) && Object.is(p.y, point.y)),
          ),
        ).toBe(true);
    }
  }
  expect(disk.report.numeric.curveProjectionBoundMm).toBeLessThanOrEqual(0.005);
  expect(disk.report.numeric.canonicalAdjustmentEstimateMm).toBeLessThan(1e-7);
});
it('source shared curves are cached even when their straight cubic parameter speeds/directions differ', () => {
  const p = source();
  p.patterns[0].sourceGeometry = [
    { ...p.patterns[0].sourceGeometry[0], pathData: 'M0 0H50V100H0Z' },
    {
      ...geometry('compound', [], true),
      pathData: 'M50 0H100V100H50C50 75 50 25 50 0Z',
      fill: '#ef3344',
      stroke: 'none',
    },
  ];
  const disk = deriveChamberDisk(p, p.patterns[0].id, selection, { ...settings, depth: 0 });
  expect(disk.report.resources.curveCacheHits).toBeGreaterThan(
    disk.report.resources.boundaryCurveCacheHits,
  );
  const cell = disk.cells[0],
    a = cell.contours.find((c) => c.chamberIndex === 0 && c.paintIndex === 0)!,
    b = cell.contours.find((c) => c.chamberIndex === 0 && c.paintIndex === 1)!;
  const pointsA = new Set(a.paths.flat()),
    common = b.paths.flat().filter((p) => pointsA.has(p));
  expect(common.length).toBeGreaterThan(4);
});
it('SVG merges disjoint copies of each paint without mutating the result and keeps alpha/physical size', () => {
  const p = source(),
    disk = deriveChamberDisk(p, p.patterns[0].id, selection, settings),
    before = structuredClone(disk),
    svg = chamberDiskSVG(disk);
  expect(svg.match(/<path data-source=/g)).toHaveLength(1);
  expect(svg).toContain('opacity="0.5"');
  expect(svg).toContain('width="200mm"');
  expect(svg).toContain('CANONICAL_C0');
  expect(svg).toContain('canonicalNumericStepCertified');
  expect(disk).toEqual(before);
});
it('counts cached segments toward the global budget and fails atomically when the source or detail exceeds limits', () => {
  const p = source(),
    before = structuredClone(p),
    id = p.patterns[0].id;
  expect(() => deriveChamberDisk(p, id, selection, { ...settings, maxSegments: 2 })).toThrow(
    /presupuesto/,
  );
  expect(() => deriveChamberDisk(p, id, selection, { ...settings, maxCurves: 1 })).toThrow(
    /curvas/,
  );
  expect(p).toEqual(before);
});

it.each([
  { p: 3, q: 7 },
  { p: 4, q: 5 },
  { p: 7, q: 3 },
  { p: 12, q: 12 },
])('{$p,$q}: camera and non-square source retain canonical joins within budgets', ({ p, q }) => {
  const project = source();
  project.patterns[0].sourceGeometry[0].pathData = 'M-50 20H70V100H-50Z';
  const before = structuredClone(project),
    disk = deriveChamberDisk(
      project,
      project.patterns[0].id,
      { target: 'view', bounds: { x: -50, y: 20, width: 120, height: 80 } },
      { ...settings, p, q, maxSegments: 750000, view: { center: { x: 0.6, y: 0.2 }, angle: 0.4 } },
    );
  expect(disk.cells.length).toBeGreaterThan(1);
  expect(disk.report.resources.boundaryCurveCacheHits).toBeGreaterThan(0);
  expect(disk.report.numeric.canonicalAdjustmentEstimateMm).toBeLessThan(0.001);
  expect(disk.report.numeric.curveProjectionBoundMm).toBeLessThanOrEqual(0.005);
  expect(disk.report.resources.segments).toBeLessThanOrEqual(750000);
  expect(project).toEqual(before);
});
