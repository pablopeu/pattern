import {
  preparePaintSource,
  validateSourceOptions,
  type PreparedPaintSource,
  type SourceContour,
} from '../geometry/paint-source';
import type { Geometry } from '../app/model';
import type { Point } from '../geometry/matrix';
import { hasFillBoundary } from '../geometry/paths';
import type { ClippedPaint } from '../application/clipping';
import { strokeRegion } from '../geometry/stroke-outline';
import type { Iso } from '../vendor/poincare/iso';
import { sourceEmbedding } from './disk';
import { projectCubic } from './project';
export type { SourceContour } from '../geometry/paint-source';
export interface PreparedDiskSource extends PreparedPaintSource {
  model: { p: number; q: number };
}
const defaults = { maxShapes: 256, maxCurves: 4096, maxSegments: 100000 };
/** Consume a prepared finite flat source, not an infinite lattice/whole project.
 * Paint fills below the original boundaries. All work happens on derived paths.
 */
export function prepareDiskSource(
  shapes: Geometry[],
  p: number,
  q: number,
  options: { strokeTolerance?: number; maxCurves?: number } = {},
): PreparedDiskSource {
  validateSourceOptions(options);
  if (shapes.length > defaults.maxShapes)
    throw Error('La fuente supera256 objetos; prepará un recorte menor.');
  const tolerance = options.strokeTolerance ?? 0.02,
    visible = shapes.filter((s) => s.visible && s.opacity > 0),
    paints: ClippedPaint[] = [];
  for (const shape of visible)
    if (hasFillBoundary(shape)) paints.push({ geometry: shape, sourceId: shape.id, paint: 'fill' });
  for (const shape of visible)
    if (shape.stroke !== 'none' && shape.strokeWidth > 0 && shape.strokeOpacity > 0)
      paints.push({
        geometry: strokeRegion(shape, undefined, tolerance),
        sourceId: shape.id,
        paint: 'stroke',
      });
  return preparePaintedDiskSource(paints, p, q, options);
}
/** Normalize a finite prepared scene into the chosen hyperbolic root frame. */
export function preparePaintedDiskSource(
  paints: ClippedPaint[],
  p: number,
  q: number,
  options: { strokeTolerance?: number; maxCurves?: number; clipped?: boolean } = {},
): PreparedDiskSource {
  return {
    ...preparePaintSource(paints, (bounds) => sourceEmbedding(p, q, bounds), options),
    model: { p, q },
  };
}
export interface ProjectedDiskContour {
  sourceId: string;
  paint: SourceContour['paint'];
  color: string;
  opacity: number;
  fillRule: SourceContour['fillRule'];
  paths: Point[][];
}
/** Mapping tolerance is certified per cubic; stroke-outline error is separate.
 * One shared segment budget for ALL contours, not one budget per source path.
 */
export function projectDiskSource(
  source: PreparedDiskSource,
  frame: Iso,
  radiusMm: number,
  toleranceMm: number,
  maxSegments = defaults.maxSegments,
) {
  if (
    !Number.isFinite(radiusMm) ||
    radiusMm <= 0 ||
    !Number.isFinite(toleranceMm) ||
    toleranceMm <= 0 ||
    !Number.isInteger(maxSegments) ||
    maxSegments < 1 ||
    maxSegments > 1000000
  )
    throw Error('Radio, precisión o presupuesto de representación inválidos.');
  let remaining = maxSegments,
    curveProjectionBoundMm = 0;
  const contours: ProjectedDiskContour[] = source.contours.map((contour) => {
    const paths = contour.paths.map((curves) => {
      const points: Point[] = [];
      for (const curve of curves) {
        if (remaining < 1)
          throw Error('La representación excede su presupuesto global de segmentos.');
        const r = projectCubic(curve, frame, toleranceMm / radiusMm, {
          maxSegments: Math.min(remaining, 100000),
        });
        remaining -= r.segments;
        curveProjectionBoundMm = Math.max(curveProjectionBoundMm, r.errorBound * radiusMm);
        for (let i = points.length ? 1 : 0; i < r.points.length; i++) {
          const v = r.points[i];
          points.push({ x: v.x * radiusMm, y: v.y * radiusMm });
        }
      }
      return points;
    });
    const { paths: _, ...style } = contour;
    return { ...style, paths };
  });
  return {
    contours,
    segments: maxSegments - remaining,
    curveProjectionBoundMm,
    // A universal Lipschitz estimate for any disk isometry on this source hull.
    // Multiplying by the outliner's requested tolerance is only an estimate.
    outlineToleranceMappedEstimateMm: source.hasOutlinedStrokes
      ? (source.strokeOutlineTolerance * source.embedding.matrix[0] * radiusMm) /
        (1 - source.embedding.maxRadius ** 2)
      : 0,
    curveProjectionCertified: true,
    hasUncertifiedOutlineStep: source.hasOutlinedStrokes,
    hasUncertifiedClippingStep: source.hasUncertifiedClippingStep,
  };
}
