import type { Geometry } from '../app/model';
import type { Point, Matrix } from './matrix';
import { apply } from './matrix';
import type { Bounds } from '../symmetry/groups';
import type { ClippedPaint } from '../application/clipping';
import { paperPath, scope } from './paper';
import type { Cubic } from './nonlinear';
export interface SourceContour {
  sourceId: string;
  paint: 'fill' | 'stroke';
  color: string;
  opacity: number;
  fillRule: 'nonzero' | 'evenodd';
  paths: Cubic[][];
}
export interface PreparedPaintSource {
  contours: SourceContour[];
  embedding: { matrix: Matrix; maxRadius: number };
  /** Requested tolerance of the existing stroke outliner, in source mm.
   * It is NOT a certified bound of that algorithm, nor of the whole pipeline. */
  strokeOutlineTolerance: number;
  hasOutlinedStrokes: boolean;
  hasUncertifiedClippingStep: boolean;
}
const defaults = { maxShapes: 256, maxCurves: 4096 };
export function validateSourceOptions(options: { strokeTolerance?: number; maxCurves?: number }) {
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
}
export function preparePaintSource(
  paints: ClippedPaint[],
  embeddingForBounds: (bounds: Bounds) => PreparedPaintSource['embedding'],
  options: { strokeTolerance?: number; maxCurves?: number; clipped?: boolean } = {},
): PreparedPaintSource {
  validateSourceOptions(options);
  if (paints.length > defaults.maxShapes * 2)
    throw Error('La fuente supera512 regiones de pintura; prepará un recorte menor.');
  const tolerance = options.strokeTolerance ?? 0.02,
    maxCurves = options.maxCurves ?? defaults.maxCurves;
  const contours: SourceContour[] = [],
    points: Point[] = [];
  let curveCount = 0;
  const hasOutlinedStrokes = paints.some((entry) => entry.paint === 'stroke');
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
  for (const role of ['fill', 'stroke'] as const)
    for (const entry of paints)
      if (entry.paint === role && entry.geometry.visible && entry.geometry.opacity > 0)
        add(entry.geometry, entry.sourceId, entry.paint);
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
  const embedding = embeddingForBounds({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
  for (const contour of contours)
    contour.paths = contour.paths.map((path) =>
      path.map((c) => c.map((v) => apply(embedding.matrix, v)) as unknown as Cubic),
    );
  return {
    contours,
    embedding,
    strokeOutlineTolerance: tolerance,
    hasOutlinedStrokes,
    hasUncertifiedClippingStep: options.clipped ?? false,
  };
}
