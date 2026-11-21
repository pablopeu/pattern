import { adaptiveMapCubic, type Cubic } from '../geometry/nonlinear';
export { splitCubic, type Cubic } from '../geometry/nonlinear';
import type { Iso } from '../vendor/poincare/iso';
import { diskPoint } from './disk';
const mix = (a: Cubic[0], b: Cubic[0], t = 0.5) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const distance = (a: Cubic[0], b: Cubic[0]) => Math.hypot(a.x - b.x, a.y - b.y);
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
  return adaptiveMapCubic(
    curve,
    (p) => diskPoint(f, p),
    (c) => projectedCubicError(c, f),
    tolerance,
    limits,
  );
}
