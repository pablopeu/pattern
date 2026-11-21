import type { Geometry } from '../app/model';
import type { Point } from '../geometry/matrix';
import { apply } from '../geometry/matrix';
import { hasFillBoundary } from '../geometry/paths';
import { paperPath, scope } from '../geometry/paper';
import { strokeRegion } from '../geometry/stroke-outline';
import type { Iso } from '../vendor/poincare/iso';
import { sourceEmbedding } from './disk';
import { projectCubic, type Cubic } from './project';
export interface SourceContour {
  sourceId: string;
  paint: 'fill' | 'stroke';
  color: string;
  opacity: number;
  fillRule: 'nonzero' | 'evenodd';
  paths: Cubic[][];
}
export interface PreparedDiskSource {
  contours: SourceContour[];
  embedding: ReturnType<typeof sourceEmbedding>;
  /** Requested tolerance of the existing stroke outliner, in source mm.
   * It is NOT a certified bound of that algorithm, nor of the whole pipeline. */
  strokeOutlineTolerance: number;
  hasOutlinedStrokes: boolean;
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
  const tolerance = options.strokeTolerance ?? 0.02,
    maxCurves = options.maxCurves ?? defaults.maxCurves;
  if (
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    !Number.isInteger(maxCurves) ||
    maxCurves < 1 ||
    maxCurves > 24000
  )
    throw Error('Precisión o presupuesto de fuente inválidos.');
  if (shapes.length > defaults.maxShapes)
    throw Error('La fuente supera256 objetos; prepará un recorte menor.');
  const contours: SourceContour[] = [],
    points: Point[] = [];
  let curveCount = 0,
    hasOutlinedStrokes = false;
  const add = (shape: Geometry, sourceId: string, paint: SourceContour['paint']) => {
    if (shape.fill === 'none' || shape.opacity * shape.fillOpacity <= 0) return;
    const item = paperPath(shape);
    try {
      const children = item instanceof scope.CompoundPath ? item.children : [item],
        paths: Cubic[][] = [];
      for (const child of children) {
        const path = child as paper.Path;
        if (!path.closed) {
          if (
            path.segments.length < 2 ||
            path.firstSegment.point.getDistance(path.lastSegment.point) > 1e-7
          )
            continue;
          path.closed = true;
        }
        const curves: Cubic[] = [];
        for (const curve of path.curves) {
          if (++curveCount > maxCurves) throw Error('La fuente excede su presupuesto de curvas.');
          const values = curve.values,
            cubic: Cubic = [0, 2, 4, 6].map((i) => ({
              x: values[i],
              y: values[i + 1],
            })) as unknown as Cubic;
          if (cubic.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.y)))
            throw Error('Fuente con coordenadas no finitas.');
          points.push(...cubic);
          curves.push(cubic);
        }
        if (curves.length) paths.push(curves);
      }
      if (paths.length)
        contours.push({
          sourceId,
          paint,
          color: shape.fill,
          opacity: shape.opacity * shape.fillOpacity,
          fillRule: shape.fillRule,
          paths,
        });
    } finally {
      item.remove();
    }
  };
  const visible = shapes.filter((s) => s.visible && s.opacity > 0);
  for (const shape of visible) if (hasFillBoundary(shape)) add(shape, shape.id, 'fill');
  for (const shape of visible)
    if (shape.stroke !== 'none' && shape.strokeWidth > 0 && shape.strokeOpacity > 0) {
      add(strokeRegion(shape, undefined, tolerance), shape.id, 'stroke');
      hasOutlinedStrokes = true;
    }
  if (!points.length) throw Error('La fuente no contiene regiones ni trazos visibles.');
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const v of points) {
    left = Math.min(left, v.x);
    top = Math.min(top, v.y);
    right = Math.max(right, v.x);
    bottom = Math.max(bottom, v.y);
  }
  const embedding = sourceEmbedding(p, q, {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
  for (const contour of contours)
    contour.paths = contour.paths.map((path) =>
      path.map((c) => c.map((v) => apply(embedding.matrix, v)) as unknown as Cubic),
    );
  return { contours, embedding, strokeOutlineTolerance: tolerance, hasOutlinedStrokes };
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
  };
}
