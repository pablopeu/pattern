import { apply, linearScaleBound, type Matrix, type Point } from '../geometry/matrix';
import type { Cubic } from '../geometry/nonlinear';
import type { HyperbolicPatch } from './disk';
import { diskPoint } from './disk';
import type { Iso } from '../vendor/poincare/iso';
export interface RootChamber {
  index: number;
  edge: number;
  vertex: number;
  edgeMidpoint: Point;
  corner: Point;
  affines: [Matrix, Matrix];
}
export function poincareToKlein(p: Point): Point {
  const r2 = p.x * p.x + p.y * p.y;
  if (!Number.isFinite(r2) || r2 >= 1) throw Error('Punto fuera del disco de Poincaré.');
  return { x: (2 * p.x) / (1 + r2), y: (2 * p.y) / (1 + r2) };
}
export function kleinToPoincare(p: Point): Point {
  const r2 = p.x * p.x + p.y * p.y;
  if (!Number.isFinite(r2) || r2 >= 1) throw Error('Punto fuera del disco de Klein.');
  const d = 1 + Math.sqrt(1 - r2);
  return { x: p.x / d, y: p.y / d };
}
/** O/E/V right triangles of the regular polygon. M=V/2 is in Klein space.
 * The two affine pieces meet on x+y=1 without collapsing half the source.
 */
export function rootChambers(
  patch: Pick<HyperbolicPatch, 'p' | 'root' | 'inradius'>,
): RootChamber[] {
  if (
    patch.root.length !== patch.p ||
    patch.p < 3 ||
    !Number.isFinite(patch.inradius) ||
    patch.inradius <= 0
  )
    throw Error('Polígono raíz inválido.');
  return patch.root.flatMap((a, edge) => {
    const b = patch.root[(edge + 1) % patch.p],
      norm = Math.hypot(a.x + b.x, a.y + b.y),
      edgeMidpoint = {
        x: ((a.x + b.x) * patch.inradius) / norm,
        y: ((a.y + b.y) * patch.inradius) / norm,
      },
      E = poincareToKlein(edgeMidpoint);
    return [edge, (edge + 1) % patch.p].map((vertex, side) => {
      const corner = patch.root[vertex],
        V = poincareToKlein(corner),
        M = { x: V.x / 2, y: V.y / 2 };
      return {
        index: 2 * edge + side,
        edge,
        vertex,
        edgeMidpoint,
        corner,
        affines: [
          [E.x, E.y, M.x, M.y, 0, 0],
          [V.x - M.x, V.y - M.y, V.x - E.x, V.y - E.y, E.x + M.x - V.x, E.y + M.y - V.y],
        ] as [Matrix, Matrix],
      };
    });
  });
}
export function chamberKleinPoint(chamber: RootChamber, p: Point): Point {
  return apply(chamber.affines[p.x + p.y <= 1 ? 0 : 1], p);
}
export function chamberPoint(chamber: RootChamber, p: Point, frame: Iso): Point {
  return diskPoint(frame, kleinToPoincare(chamberKleinPoint(chamber, p)));
}
/** Bound the radius of both piecewise-affine images of a control rectangle.
 * Corners plus intersections with x+y=1 contain the vertices of both pieces.
 */
function mappedHullRadius(chamber: RootChamber, curve: Cubic) {
  const xs = curve.map((p) => p.x),
    ys = curve.map((p) => p.y),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys),
    points: Point[] = [
      { x: x0, y: y0 },
      { x: x0, y: y1 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
    ];
  for (const x of [x0, x1]) if (1 - x >= y0 && 1 - x <= y1) points.push({ x, y: 1 - x });
  for (const y of [y0, y1]) if (1 - y >= x0 && 1 - y <= x1) points.push({ x: 1 - y, y });
  return Math.max(
    ...points.map((p) => {
      const k = chamberKleinPoint(chamber, p);
      return Math.hypot(k.x, k.y);
    }),
  );
}
/** Smooth hulls use second-order bounds. Across the piecewise-affine seam use
 * only Lipschitz continuity; a Hessian bound does not apply to that seam.
 */
export function chamberCubicError(curve: Cubic, chamber: RootChamber, frame: Iso) {
  const rK = mappedHullRadius(chamber, curve);
  if (!Number.isFinite(rK)) throw Error('Hull no finito.');
  if (rK >= 1) return Number.MAX_VALUE; // refine until the hull is inside Klein
  const s = Math.sqrt(1 - rK * rK),
    rP = rK / (1 + s),
    alpha = Math.hypot(frame.ar, frame.ai),
    beta = Math.hypot(frame.br, frame.bi),
    den = alpha - beta * rP,
    det = Math.abs(alpha * alpha - beta * beta);
  if (!Number.isFinite(den) || den <= 1e-12 || det <= 0) throw Error('Marco de cámara degenerado.');
  const signs = curve.map((p) => p.x + p.y - 1),
    piece = signs.every((v) => v <= 0) ? 0 : signs.every((v) => v >= 0) ? 1 : null,
    scale =
      piece === null
        ? Math.max(...chamber.affines.map(linearScaleBound))
        : linearScaleBound(chamber.affines[piece]),
    Lf = det / (den * den),
    Mf = (2 * det * beta) / den ** 3,
    LP = 1 / s,
    MP = 6 / s ** 3,
    L = Lf * LP * scale,
    [a, b, c, d] = curve,
    len = Math.hypot(d.x - a.x, d.y - a.y),
    delta = Math.max(
      Math.hypot(b.x - (2 * a.x + d.x) / 3, b.y - (2 * a.y + d.y) / 3),
      Math.hypot(c.x - (a.x + 2 * d.x) / 3, c.y - (a.y + 2 * d.y) / 3),
    );
  if (piece === null) return L * (delta + len / 2);
  const M = (Mf * LP * LP + Lf * MP) * scale * scale;
  return L * delta + (M * len * len) / 8;
}
