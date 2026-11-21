import type { Point } from './matrix';
export type Cubic = readonly [Point, Point, Point, Point];
const mix = (a: Point, b: Point, t = 0.5): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export function splitCubic([a, b, c, d]: Cubic): [Cubic, Cubic] {
  const ab = mix(a, b),
    bc = mix(b, c),
    cd = mix(c, d),
    abc = mix(ab, bc),
    bcd = mix(bc, cd),
    mid = mix(abc, bcd);
  return [
    [a, ab, abc, mid],
    [mid, bcd, cd, d],
  ];
}
/** Adaptive de Casteljau projection with an analytical error bound per hull.
 * Resource excess fails atomically; cancellation belongs to the owning worker.
 */
export function adaptiveMapCubic(
  curve: Cubic,
  mapPoint: (point: Point) => Point,
  errorBound: (curve: Cubic) => number,
  tolerance: number,
  limits: { maxDepth?: number; maxSegments?: number } = {},
) {
  const maxDepth = limits.maxDepth ?? 18,
    maxSegments = limits.maxSegments ?? 4096;
  if (
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    !Number.isInteger(maxDepth) ||
    maxDepth < 0 ||
    maxDepth > 20 ||
    !Number.isInteger(maxSegments) ||
    maxSegments < 1 ||
    maxSegments > 100000
  )
    throw Error('Precisión o presupuesto de proyección inválidos.');
  const mapped = (p: Point) => {
    const result = mapPoint(p);
    if (!Number.isFinite(result.x) || !Number.isFinite(result.y))
      throw Error('La proyección produjo un punto no finito.');
    return result;
  };
  const points: Point[] = [mapped(curve[0])];
  let bound = 0;
  const visit = (c: Cubic, depth: number) => {
    const error = errorBound(c);
    if (!Number.isFinite(error) || error < 0) throw Error('Cota de proyección inválida.');
    if (error <= tolerance) {
      if (points.length > maxSegments)
        throw Error('La proyección excede su presupuesto de segmentos.');
      points.push(mapped(c[3]));
      bound = Math.max(bound, error);
      return;
    }
    if (depth >= maxDepth) throw Error('La profundidad no alcanza la tolerancia de proyección.');
    const [left, right] = splitCubic(c);
    visit(left, depth + 1);
    visit(right, depth + 1);
  };
  visit(curve, 0);
  return { points, errorBound: bound, segments: points.length - 1 };
}
