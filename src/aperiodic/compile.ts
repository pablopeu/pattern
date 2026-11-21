import {
  buildHat,
  outline as hatOutline,
  type HatTree,
  type UpstreamMatrix,
} from '../vendor/aperiodic/hat';
import { buildSpectre, type SpectreTree } from '../vendor/aperiodic/spectre';
import { IDENTITY, apply, multiply, scale, type Matrix, type Point } from '../geometry/matrix';
export type AperiodicKind = 'hat' | 'spectre';
export const seeds = {
  hat: ['H', 'T', 'P', 'F'],
  spectre: ['Delta', 'Gamma', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi'],
} as const;
export interface AperiodicLeaf {
  id: string;
  matrix: Matrix;
  label: string;
  ancestry: number[];
}
export interface AperiodicGuide {
  id: string;
  matrix: Matrix;
  points: Point[];
  level: number;
}
export interface AperiodicPatch {
  leaves: AperiodicLeaf[];
  guides: AperiodicGuide[];
  /** Hat vertices; Spectre cubic start followed by control/control/end triples. */
  points: Point[];
  curved: boolean;
  depth: number;
  seed: string;
}
const fromUpstream = (m: UpstreamMatrix): Matrix => [m[0], m[3], m[1], m[4], m[2], m[5]];
const cache = new Map<string, AperiodicPatch>();
/** Finite patches of the published substitution systems. Returned data is read-only by contract. */
export function compileAperiodic(
  kind: AperiodicKind,
  depth: number,
  seed: string = seeds[kind][0],
): AperiodicPatch {
  if (!Number.isInteger(depth) || depth < 0 || depth > 4)
    throw Error('Sustituciones: entero de0 a4.');
  if (!(seeds[kind] as readonly string[]).includes(seed))
    throw Error('Semilla de sustitución desconocida.');
  const key = `${kind}/${depth}/${seed}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const leaves: AperiodicLeaf[] = [],
    guides: AperiodicGuide[] = [];
  let points: Point[] = hatOutline;
  // Upstream's Spectre substitutions reverse the whole coordinate frame each step.
  // Reverse it back globally on odd generations: every leaf is then a direct isometry
  // of the SAME curved Spectre, rather than permitting reflected physical tiles.
  const root = kind === 'spectre' && depth % 2 ? scale(-1, 1) : IDENTITY;
  if (kind === 'hat') {
    const visit = (n: HatTree, matrix: Matrix, ancestry: number[]) => {
      const id = `${key}/${ancestry.join('.')}`;
      if (n.children) {
        if (n.shape?.length) guides.push({ id, matrix, points: n.shape, level: ancestry.length });
        n.children.forEach((c, i) =>
          visit(c.geom, multiply(matrix, fromUpstream(c.T)), [...ancestry, i]),
        );
      } else leaves.push({ id, matrix, label: n.label!, ancestry });
    };
    visit(buildHat(depth, seed), root, []);
  } else {
    const visit = (n: SpectreTree, matrix: Matrix, ancestry: number[]) => {
      const id = `${key}/${ancestry.join('.')}`;
      if (n.geoms) {
        // Gamma contains two leaves at the base; it is not an extra substitution.
        if (ancestry.length < depth && n.quad.length)
          guides.push({ id, matrix, points: n.quad, level: ancestry.length });
        n.geoms.forEach((c, i) =>
          visit(c.geom, multiply(matrix, fromUpstream(c.xform)), [...ancestry, i]),
        );
      } else {
        points = n.pts!;
        leaves.push({ id, matrix, label: n.label!, ancestry });
      }
    };
    visit(buildSpectre(depth, seed), root, []);
  }
  if (leaves.length > 12000)
    throw Error('El parche excede12000 teselas. Reducí las sustituciones.');
  const patch = { leaves, guides, points, curved: kind === 'spectre', depth, seed };
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(key, patch);
  return patch;
}
export function aperiodicPath(patch: Pick<AperiodicPatch, 'points' | 'curved'>): string {
  const [start, ...rest] = patch.points;
  if (!patch.curved)
    return `M${start.x} ${start.y}` + rest.map((p) => `L${p.x} ${p.y}`).join('') + 'Z';
  let d = `M${start.x} ${start.y}`;
  for (let i = 0; i < rest.length; i += 3)
    d += `C${rest[i].x} ${rest[i].y} ${rest[i + 1].x} ${rest[i + 1].y} ${rest[i + 2].x} ${rest[i + 2].y}`;
  return d + 'Z';
}
/** Conservative control-polygon bounds, independent of viewport and export resolution. */
export function patchBounds(p: AperiodicPatch) {
  let x = Infinity,
    y = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const leaf of p.leaves)
    for (const point of p.points) {
      const q = apply(leaf.matrix, point);
      x = Math.min(x, q.x);
      y = Math.min(y, q.y);
      maxX = Math.max(maxX, q.x);
      maxY = Math.max(maxY, q.y);
    }
  return { x, y, width: maxX - x, height: maxY - y };
}
