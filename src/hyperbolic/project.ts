import type { Point } from '../geometry/matrix';
import type { Iso } from '../vendor/poincare/iso';
import { diskPoint } from './disk';
export type Cubic = readonly [Point, Point, Point, Point];
const mix = (a: Point, b: Point, t = 0.5): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
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
/** Certified upper bound for distance to the mapped endpoint chord.
 * L·BezierDeviation + sup|f''|·chordLength²/8, over the control hull.
 * This detects loops/S-curves that a midpoint-only flatness test can miss.
 */
export function projectedCubicError(curve: Cubic, f: Iso) {
  const [a, b, c, d] = curve,
    r = Math.max(...curve.map((p) => Math.hypot(p.x, p.y)));
  if (r >= 1 || !Number.isFinite(r)) throw Error('El polígono de control sale del disco.');
  const alpha = Math.hypot(f.ar, f.ai),
    beta = Math.hypot(f.br, f.bi),
    den = alpha - beta * r,
    det = Math.abs(alpha * alpha - beta * beta);
  if (den <= 1e-12 || !Number.isFinite(den) || det <= 0)
    throw Error('Proyección numéricamente degenerada.');
  const deviation = Math.max(distance(b, mix(a, d, 1 / 3)), distance(c, mix(a, d, 2 / 3))),
    length = distance(a, d);
  return (det * deviation) / (den * den) + (det * beta * length * length) / (4 * den * den * den);
}
export function projectCubic(
  curve: Cubic,
  f: Iso,
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
  const points: Point[] = [diskPoint(f, curve[0])];
  let bound = 0;
  const visit = (c: Cubic, depth: number) => {
    const error = projectedCubicError(c, f);
    if (error <= tolerance) {
      if (points.length > maxSegments)
        throw Error('La proyección excede su presupuesto de segmentos.');
      points.push(diskPoint(f, c[3]));
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
