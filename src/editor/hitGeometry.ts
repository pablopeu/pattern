import type { Geometry } from '../app/model';
import { distance, linearScaleBound, type Point } from '../geometry/matrix';
import { paperPath, scope } from '../geometry/paper';
import { strokeExtent } from '../geometry/stroke-bounds';
import { strokeRegion } from '../geometry/stroke-outline';
/** Axis tolerance keeps node editing usable; wide painted profiles use their actual derived contour. */
export function geometryHit(
  g: Geometry,
  path: paper.PathItem,
  point: Point,
  tolerance: number,
): boolean {
  const p = new scope.Point(point.x, point.y),
    nearest = path.getNearestPoint(p),
    axisDistance = nearest ? distance(point, nearest) : Infinity;
  if (g.fill !== 'none' && path.contains(p)) return true;
  if (axisDistance <= tolerance) return true;
  const extent = strokeExtent(g);
  if (
    !extent ||
    !Number.isFinite(extent) ||
    !path.bounds.expand(2 * (extent + tolerance)).contains(p)
  )
    return false;
  try {
    const outline = paperPath(strokeRegion(g));
    try {
      if (outline.contains(p)) return true;
      const near = outline.getNearestPoint(p);
      return !!near && distance(point, near) <= tolerance;
    } finally {
      outline.remove();
    }
  } catch {
    return (
      axisDistance <=
      tolerance +
        (g.strokeProfile.kind === 'uniform' && !g.strokeDash.includes(0)
          ? extent
          : 0.3 * linearScaleBound(g.transform))
    );
  }
}
