import type { Geometry } from '../app/model';
import { linearScaleBound, type Matrix } from './matrix';
/** Conservative reach of ink beyond the transformed axis; profile interpolation has no overshoot. */
export function strokeExtent(g: Geometry): number {
  if (g.stroke === 'none' || g.strokeWidth <= 0 || g.strokeOpacity <= 0 || g.opacity <= 0) return 0;
  const relative = Math.max(1, ...g.strokeProfile.points.map((p) => p.width)),
    join = g.strokeJoin === 'miter' ? Math.max(1, g.miterLimit) : 1,
    cap = g.strokeCap === 'square' ? Math.SQRT2 : 1;
  return g.strokeWidth * 0.5 * relative * linearScaleBound(g.transform) * Math.max(join, cap);
}
export function strokePadding(shapes: Geometry[], placements: Matrix[]): number {
  const source = shapes.reduce((max, g) => Math.max(max, strokeExtent(g)), 0),
    scale = placements.reduce((max, m) => Math.max(max, linearScaleBound(m)), 1),
    padding = Math.max(1, source * scale);
  if (!Number.isFinite(padding))
    throw Error('La escala y el grosor efectivos exceden el rango numérico.');
  return padding;
}
