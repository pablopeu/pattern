import { describe, expect, it } from 'vitest';
import { geometry, node } from '../app/model';
import { translate, multiply, rotate, scale, apply } from '../geometry/matrix';
import * as iso from '../vendor/poincare/iso';
import { regularHyperbolicPatch, diskPoint } from '../hyperbolic/disk';
import { prepareDiskSource, projectDiskSource } from '../hyperbolic/source';
import { paperPath, scope } from '../geometry/paper';
function line() {
  return {
    ...geometry('path', [node(-4, 0), node(4, 0)], false),
    fill: '#ff0000',
    stroke: '#000000',
    strokeWidth: 0.5,
  };
}
function ring() {
  return {
    ...geometry('compound', [], true),
    pathData: 'M-5 -5H5V5H-5Z M-2 -2H2V2H-2Z',
    fill: '#3b82f6',
    stroke: 'none',
    fillRule: 'evenodd' as const,
  };
}
describe('prepared planar source → derived disk contours', () => {
  it('does not implicitly fill an open Bézier; outlines its stroke before mapping', () => {
    const s = line(),
      saved = structuredClone(s),
      p = prepareDiskSource([s], 7, 3),
      r = projectDiskSource(p, iso.IDENTITY, 100, 0.01);
    expect(p.contours.map((c) => c.paint)).toEqual(['stroke']);
    expect(p.contours[0].color).toBe('#000000');
    expect(s).toEqual(saved);
    expect(r.curveProjectionCertified).toBe(true);
    expect(r.hasUncertifiedOutlineStep).toBe(true);
    expect(r.outlineToleranceMappedEstimateMm).toBeGreaterThan(0);
    expect(r.curveProjectionBoundMm).toBeLessThanOrEqual(0.01);
  });
  it('preserves compound holes, fill rule, opacity and transformed control hull', () => {
    const s = {
        ...ring(),
        opacity: 0.5,
        fillOpacity: 0.4,
        transform: multiply(translate(23, -17), multiply(rotate(43), scale(2, 0.5))),
      },
      saved = structuredClone(s),
      p = prepareDiskSource([s], 7, 3),
      r = projectDiskSource(p, iso.translation(0.5, 0.2), 100, 0.01);
    expect(p.contours).toHaveLength(1);
    expect(p.contours[0].paths).toHaveLength(2);
    expect(r.contours[0].fillRule).toBe('evenodd');
    expect(r.contours[0].opacity).toBeCloseTo(0.2);
    expect(r.curveProjectionCertified).toBe(true);
    expect(r.hasUncertifiedOutlineStep).toBe(false);
    expect(r.outlineToleranceMappedEstimateMm).toBe(0);
    expect(s).toEqual(saved);
    const contour = r.contours[0],
      d = contour.paths
        .map((path) => 'M' + path.map((v) => `${v.x} ${v.y}`).join('L') + 'Z')
        .join(''),
      g = { ...ring(), pathData: d };
    const paper = paperPath(g);
    try {
      expect(paper.contains(new scope.Point(50, 20))).toBe(false);
      const inside = diskPoint(
        iso.translation(0.5, 0.2),
        apply(p.embedding.matrix, apply(s.transform, { x: 4, y: 0 })),
      );
      expect(paper.contains(new scope.Point(inside.x * 100, inside.y * 100))).toBe(true);
    } finally {
      paper.remove();
    }
  });
  it('all fills paint below all boundaries and retain each source ID', () => {
    const a = { ...ring(), stroke: '#111111', strokeWidth: 0.4 },
      b = { ...ring(), id: 'second', fill: '#00ff00', stroke: '#222222', strokeWidth: 0.3 };
    const p = prepareDiskSource([a, b], 5, 4);
    expect(p.contours.map((c) => c.paint)).toEqual(['fill', 'fill', 'stroke', 'stroke']);
    expect(p.contours.map((c) => c.sourceId)).toEqual([a.id, b.id, a.id, b.id]);
  });
  it('keeps dashes, pressure contours, caps and joins derived from the source', () => {
    const a = { ...line(), strokeDash: [1, 0.5], strokeCap: 'square' as const },
      b = {
        ...line(),
        id: 'pressure',
        strokeProfile: {
          version: 1 as const,
          kind: 'custom' as const,
          points: [
            { at: 0, width: 0.2 },
            { at: 1, width: 1 },
          ],
        },
      };
    const p = prepareDiskSource([a, b], 4, 5);
    expect(p.contours).toHaveLength(2);
    expect(p.contours.every((c) => c.paths.length > 0)).toBe(true);
  });
  it('respects visibility/none and rejects an empty source without altering it', () => {
    const s = { ...ring(), visible: false };
    expect(() => prepareDiskSource([s], 7, 3)).toThrow(/no contiene/);
    expect(s.visible).toBe(false);
    expect(() => prepareDiskSource([{ ...line(), stroke: 'none' }], 7, 3)).toThrow(/no contiene/);
  });
  it('rejects shape/curve/global-segment excess explicitly', () => {
    expect(() => prepareDiskSource(Array.from({ length: 257 }, ring), 7, 3)).toThrow(/256/);
    expect(() => prepareDiskSource([ring()], 7, 3, { maxCurves: 2 })).toThrow(/curvas/);
    const p = prepareDiskSource([ring()], 7, 3);
    expect(() => projectDiskSource(p, iso.IDENTITY, 100, 0.01, 5)).toThrow(/presupuesto/);
    expect(() => projectDiskSource(p, iso.IDENTITY, 0, 0.01)).toThrow();
  });
  it('scales physical coordinates and tolerance consistently without modifying the prepared source', () => {
    const p = prepareDiskSource([ring()], 7, 3),
      saved = structuredClone(p),
      f = regularHyperbolicPatch(7, 3, { depth: 1 }).cells[1].frame,
      a = projectDiskSource(p, f, 100, 0.01),
      b = projectDiskSource(p, f, 200, 0.02);
    expect(a.segments).toBe(b.segments);
    for (let i = 0; i < a.contours[0].paths[0].length; i++) {
      expect(b.contours[0].paths[0][i].x).toBeCloseTo(a.contours[0].paths[0][i].x * 2, 10);
      expect(b.contours[0].paths[0][i].y).toBeCloseTo(a.contours[0].paths[0][i].y * 2, 10);
    }
    expect(p).toEqual(saved);
  });
});
