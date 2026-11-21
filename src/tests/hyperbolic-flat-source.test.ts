import { expect, it } from 'vitest';
import { geometry, newProject, node, type Geometry } from '../app/model';
import { apply, inverse, IDENTITY } from '../geometry/matrix';
import { paperPath, scope } from '../geometry/paper';
import { prepareFlatDiskSource } from '../hyperbolic/flat-source';
import { derivePreparedDisk } from '../hyperbolic/representation';
import { projectDiskSource, type PreparedDiskSource } from '../hyperbolic/source';
import * as iso from '../vendor/poincare/iso';
import { newTiling } from '../tiling/tiles';
import { resolvePattern } from '../symmetry/config';
import { cosets } from '../symmetry/groups';
import { buildScene } from '../patterns/engine';
import { joinNodes } from '../editor/junctions';
import { collectFillInputs, createFaceFill } from '../fill/service';
import { buildArrangement, facesAt } from '../fill/planar';

function contains(
  source: PreparedDiskSource,
  point: { x: number; y: number },
  role: 'fill' | 'stroke',
  color?: string,
) {
  const mapped = apply(source.embedding.matrix, point),
    result = projectDiskSource(source, iso.IDENTITY, 1, 0.00001);
  return result.contours.some((contour) => {
    if (contour.paint !== role || (color && contour.color !== color)) return false;
    const path = paperPath({
      ...geometry('compound', [], true),
      pathData: contour.paths
        .map((points) => 'M' + points.map((p) => `${p.x} ${p.y}`).join('L') + 'Z')
        .join(''),
      fillRule: contour.fillRule,
    });
    try {
      return path.contains(new scope.Point(mapped.x, mapped.y));
    } finally {
      path.remove();
    }
  });
}
function rectangle(): Geometry {
  return {
    ...geometry('compound', [], true),
    pathData: 'M0 0H20V20H0Z M5 5H15V15H5Z',
    fill: '#3b82f6',
    fillRule: 'evenodd',
    stroke: '#111111',
    strokeWidth: 0.4,
    opacity: 0.5,
    fillOpacity: 0.6,
    strokeOpacity: 0.8,
  };
}
const window = { target: 'view' as const, bounds: { x: 0, y: 0, width: 20, height: 20 } };
it('finite window keeps compound holes, opacity, paint priority and source IDs without mutating the document', () => {
  const p = newProject(),
    g = rectangle();
  p.patterns[0].sourceGeometry = [g];
  const before = structuredClone(p),
    { source, report } = prepareFlatDiskSource(p, p.patterns[0].id, window, 7, 3);
  expect(source.contours.map((c) => c.paint)).toEqual(['fill', 'stroke']);
  expect(source.contours.map((c) => c.sourceId)).toEqual([g.id, g.id]);
  expect(source.contours.map((c) => c.opacity)).toEqual([0.3, 0.4]);
  expect(contains(source, { x: 2, y: 2 }, 'fill')).toBe(true);
  expect(contains(source, { x: 10, y: 10 }, 'fill')).toBe(false);
  expect(contains(source, { x: -0.1, y: 2 }, 'stroke')).toBe(false);
  expect(report.bounds).toEqual(window.bounds);
  expect(report.preparationCertified).toBe(false);
  expect(p).toEqual(before);
});
it('outlines a dashed pressure stroke before cropping: neither phase nor pressure restarts at the crop', () => {
  const p = newProject(),
    g = geometry('path', [node(-10, 10), node(30, 10)]);
  Object.assign(g, {
    fill: 'none',
    stroke: '#000000',
    strokeWidth: 2,
    strokeDash: [4, 4],
    strokeCap: 'butt',
    strokeProfile: {
      version: 1,
      kind: 'custom',
      points: [
        { at: 0, width: 0.2 },
        { at: 1, width: 1 },
      ],
    },
  });
  p.patterns[0].sourceGeometry = [g];
  const { source } = prepareFlatDiskSource(p, p.patterns[0].id, window, 7, 3);
  expect(source.contours.every((c) => c.paint === 'stroke')).toBe(true);
  expect(contains(source, { x: 1, y: 10 }, 'stroke')).toBe(true);
  expect(contains(source, { x: 3, y: 10 }, 'stroke')).toBe(false);
  expect(contains(source, { x: 1, y: 10.6 }, 'stroke')).toBe(false);
  expect(contains(source, { x: 17, y: 10.6 }, 'stroke')).toBe(true);
  expect(contains(source, { x: -1, y: 10 }, 'stroke')).toBe(false);
});
it('a translated window uses its actual bounds rather than a centered export crop', () => {
  const p = newProject();
  p.patterns[0].sourceGeometry = [rectangle()];
  const { source, report } = prepareFlatDiskSource(
    p,
    p.patterns[0].id,
    { target: 'view', bounds: { x: 16, y: 0, width: 10, height: 20 } },
    7,
    3,
  );
  expect(contains(source, { x: 18, y: 10 }, 'fill')).toBe(true);
  expect(contains(source, { x: 2, y: 2 }, 'fill')).toBe(false);
  expect(report.bounds.x).toBe(16);
});
it('cell source contains the periodic copies that intersect it, including a source drawn outside the cell', () => {
  const p = newProject();
  p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p1', width: 20, height: 20 };
  p.patterns[0].sourceGeometry = [{ ...rectangle(), pathData: 'M22 2H26V6H22Z', stroke: 'none' }];
  const saved = structuredClone(p),
    { source } = prepareFlatDiskSource(p, p.patterns[0].id, { target: 'tile' }, 7, 3);
  expect(contains(source, { x: 4, y: 4 }, 'fill')).toBe(true);
  expect(contains(source, { x: 24, y: 4 }, 'fill')).toBe(false);
  expect(p).toEqual(saved);
});
it('tile materialization retains original stroke identity and its uncertified outline provenance', () => {
  const p = newProject(),
    pat = p.patterns[0],
    line = geometry('path', [node(5, 5), node(15, 5)]);
  line.stroke = '#ff00ff';
  line.strokeWidth = 1;
  pat.sourceGeometry = [line];
  pat.tiling = newTiling('square');
  const before = structuredClone(p),
    { source } = prepareFlatDiskSource(p, pat.id, window, 7, 3);
  const strokes = source.contours.filter((c) => c.sourceId === line.id);
  expect(strokes.length).toBeGreaterThan(0);
  expect(strokes.every((c) => c.paint === 'stroke' && c.color === '#ff00ff')).toBe(true);
  expect(source.hasOutlinedStrokes).toBe(true);
  expect(source.hasUncertifiedClippingStep).toBe(true);
  expect(contains(source, { x: 10, y: 5 }, 'stroke', '#ff00ff')).toBe(true);
  expect(p).toEqual(before);
});
it('two open Béziers joined across different P3 copies retain their actual linked Fill in the finite scene', () => {
  const p = newProject(),
    pat = p.patterns[0];
  p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p3' };
  const mb = cosets(p.mainSymmetry)[1],
    inv = inverse(mb),
    a = geometry('path', [node(10, 7), node(25, 7)]),
    first = apply(inv, { x: 25, y: 7 }),
    last = apply(inv, { x: 10, y: 7 }),
    b = geometry('path', [node(first.x, first.y), node(last.x, last.y)]);
  a.nodes[0].out = { x: 5, y: -10 };
  a.nodes[1].in = { x: -5, y: -10 };
  const c = apply(inv, { x: 20, y: 17 }),
    d = apply(inv, { x: 15, y: 17 });
  b.nodes[0].out = { x: c.x - first.x, y: c.y - first.y };
  b.nodes[1].in = { x: d.x - last.x, y: d.y - last.y };
  pat.sourceGeometry = [a, b];
  joinNodes(
    pat.sourceGeometry,
    { id: b.id, index: 0, instance: mb },
    { id: a.id, index: 1, instance: IDENTITY },
  );
  joinNodes(
    pat.sourceGeometry,
    { id: b.id, index: 1, instance: mb },
    { id: a.id, index: 0, instance: IDENTITY },
  );
  const bounds = { x: -35, y: -35, width: 90, height: 90 },
    effective = resolvePattern(pat, p),
    scene = buildScene(effective, bounds),
    inputs = collectFillInputs([{ pattern: effective, scene }], bounds),
    arrangement = buildArrangement(inputs),
    face = facesAt(arrangement, { x: 17.5, y: 7 })[0],
    fill = createFaceFill(p, effective, scene, face, arrangement, inputs, {
      ...p.drawingStyle,
      fill: '#3b82f6',
    });
  pat.sourceGeometry.unshift(fill);
  const before = structuredClone(p),
    { source } = prepareFlatDiskSource(
      p,
      pat.id,
      { target: 'view', bounds: { x: 5, y: -5, width: 25, height: 25 } },
      7,
      3,
    );
  expect(contains(source, { x: 17.5, y: 7 }, 'fill', '#3b82f6')).toBe(true);
  expect(source.contours.some((c) => c.sourceId === fill.id)).toBe(true);
  expect(p).toEqual(before);
});
it('reports clipping separately from the certified projection and rejects a mismatched prepared model', () => {
  const p = newProject();
  p.patterns[0].sourceGeometry = [rectangle()];
  const { source } = prepareFlatDiskSource(p, p.patterns[0].id, window, 7, 3),
    saved = structuredClone(source),
    disk = derivePreparedDisk(source, { p: 7, q: 3, radiusMm: 100, toleranceMm: 0.01, depth: 0 });
  expect(disk.report.numeric.curveProjectionBoundMm).toBeLessThanOrEqual(0.01);
  expect(disk.report.numeric.hasUncertifiedOutlineStep).toBe(true);
  expect(disk.report.numeric.hasUncertifiedClippingStep).toBe(true);
  expect(() =>
    derivePreparedDisk(source, { p: 5, q: 4, radiusMm: 100, toleranceMm: 0.01 }),
  ).toThrow(/otra configuración/);
  expect(source).toEqual(saved);
});
it('preparation is atomic on paint/curve excess, invalid windows and nonperiodic cell requests', () => {
  const p = newProject();
  p.patterns[0].sourceGeometry = [rectangle()];
  const before = structuredClone(p),
    id = p.patterns[0].id;
  expect(() => prepareFlatDiskSource(p, id, window, 7, 3, { maxPaints: 1 })).toThrow(
    /regiones de pintura/,
  );
  expect(() => prepareFlatDiskSource(p, id, window, 7, 3, { maxCurves: 1 })).toThrow(/curvas/);
  expect(() =>
    prepareFlatDiskSource(
      p,
      id,
      { target: 'view', bounds: { x: NaN, y: 0, width: 1, height: 1 } },
      7,
      3,
    ),
  ).toThrow(/ventana fuente/);
  expect(() =>
    prepareFlatDiskSource(
      p,
      id,
      { target: 'view', bounds: { x: 0, y: 0, width: 0, height: 1 } },
      7,
      3,
    ),
  ).toThrow(/ventana fuente/);
  expect(() => prepareFlatDiskSource(p, id, { target: 'tile' }, 7, 3)).toThrow(/celda rectangular/);
  expect(() => prepareFlatDiskSource(p, id, window, 4, 4)).toThrow(/p\/q/);
  expect(p).toEqual(before);
});
