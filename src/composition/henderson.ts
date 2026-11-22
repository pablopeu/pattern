import type { CompositionNode } from './model';
import { above, beside, motif, over, quartet, transform, turn } from './functional';
/** Classical side/corner/nonet construction, using our affine operator tree.
 * Unit coordinates are SVG (y downward). A quarter-turn is therefore -90°;
 * the lifted reflected half tile is [-.5,-.5,-.5,.5,1,0]. This is a finite
 * functional composition, not a certificate that an arbitrary motif tiles.
 */
export function hendersonTree(depth: number): CompositionNode {
  const small = (level: number) => transform('flip', [-0.5, -0.5, -0.5, 0.5, 1, 0], motif(level));
  const triangle = (level: number) => over(motif(level), small(level), turn(small(level), 90));
  const center = (level: number) =>
    over(...[0, -90, -180, -270].map((angle) => turn(small(level), angle)));
  const side = (n: number, level: number): CompositionNode =>
    n
      ? quartet(
          side(n - 1, level + 1),
          side(n - 1, level + 1),
          turn(triangle(level), -90),
          triangle(level),
        )
      : over();
  const corner = (n: number, level: number): CompositionNode =>
    n
      ? quartet(
          corner(n - 1, level + 1),
          side(n - 1, level + 1),
          turn(side(n - 1, level + 1), -90),
          center(level),
        )
      : over();
  const rows = [
    [corner(depth, 0), side(depth, 0), turn(corner(depth, 0), 90)],
    [turn(side(depth, 0), -90), center(0), turn(side(depth, 0), 90)],
    [turn(corner(depth, 0), -90), turn(side(depth, 0), -180), turn(corner(depth, 0), -180)],
  ].map(([a, b, c]) => beside(a, beside(b, c), 1 / 3));
  return { ...above(rows[0], above(rows[1], rows[2]), 1 / 3), operator: 'subdivide' };
}
