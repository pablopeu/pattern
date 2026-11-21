import { describe, expect, it } from 'vitest';
import { geometry } from '../app/model';
import { deriveDisk, diskPreviewSVG } from '../hyperbolic/representation';
function source() {
  return {
    ...geometry('compound', [], true),
    id: 'source<&"',
    pathData: 'M-5 -5H5V5H-5Z M-2 -2H2V2H-2Z',
    fill: '#3b82f6',
    fillRule: 'evenodd' as const,
    stroke: '#000000',
    strokeWidth: 0.3,
  };
}
const settings = { p: 7, q: 3, radiusMm: 100, toleranceMm: 0.01, depth: 2, maxCells: 80 };
describe('bounded derived disk pipeline', () => {
  it('uses one prepared canonical source, preserves it, separates model/adaptation/outline claims', () => {
    const shapes = [source()],
      saved = structuredClone(shapes),
      disk = deriveDisk(shapes, settings);
    expect(shapes).toEqual(saved);
    expect(disk.report.source.ids).toEqual([shapes[0].id]);
    expect(disk.cells.length).toBeGreaterThan(7);
    expect(disk.report.model.validity).toBe('EXACT');
    expect(disk.report.motif.validity).toBe('APPROXIMATED');
    expect(disk.report.motif.borderCorrespondence).toBe('NOT_GUARANTEED');
    expect(disk.report.numeric.hasUncertifiedOutlineStep).toBe(true);
    expect(disk.report.numeric.curveProjectionBoundMm).toBeLessThanOrEqual(0.01);
  });
  it('enforces one global segment budget across cells and fails without changing the source', () => {
    const s = [source()],
      saved = structuredClone(s),
      one = deriveDisk(s, { ...settings, depth: 0 }),
      budget = one.report.resources.segments + 5;
    expect(() => deriveDisk(s, { ...settings, maxSegments: budget })).toThrow(/presupuesto/);
    expect(s).toEqual(saved);
  });
  it('is deterministic, reports LOD/finite limits, serializes physical units and escapes metadata/IDs', () => {
    const s = [source()],
      a = deriveDisk(s, { ...settings, depth: 4, minimumDiameter: 0.2 }),
      b = deriveDisk(s, { ...settings, depth: 4, minimumDiameter: 0.2 });
    expect(a).toEqual(b);
    expect(a.report.resources.omitted).toBeGreaterThan(0);
    expect(a.report.resources.limited.budget).toBe(true);
    const svg = diskPreviewSVG(a, true);
    expect(svg).toContain('width="200mm" height="200mm"');
    expect(svg).toContain('source&lt;&amp;&quot;');
    expect(svg).toContain('clip-path="url(#disk-clip)"');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).not.toContain('data-source="source<&"');
  });
  it('validates physical precision and global resources before projection', () => {
    for (const o of [
      { radiusMm: 0 },
      { toleranceMm: NaN },
      { maxSegments: 1.5 },
      { maxSegments: 1000001 },
    ])
      expect(() => deriveDisk([source()], { ...settings, ...o })).toThrow();
  });
});
