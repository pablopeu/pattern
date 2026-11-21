import type { Geometry } from '../app/model';
import { apply, distance, multiply, type Matrix, type Point } from '../geometry/matrix';

export interface JunctionNode {
  id: string;
  index: number;
  matrix: Matrix;
}
export interface NodeHit {
  point: Point;
  id: string;
  index: number;
  instance: Matrix;
}
/** Exact coincident nodes are one geometric vertex; proximity alone never welds them. */
export function junctionNodes(
  point: Point,
  shapes: Geometry[],
  instances: Matrix[],
): JunctionNode[] {
  const result = new Map<string, JunctionNode>();
  for (const instance of instances)
    for (const g of shapes) {
      if (!g.visible || g.locked || g.fillRegion || g.parameters) continue;
      const matrix = multiply(instance, g.transform);
      g.nodes.forEach((n, index) => {
        if (distance(point, apply(matrix, n)) < 1e-7)
          result.set(`${g.id}/${index}`, { id: g.id, index, matrix });
      });
    }
  return [...result.values()];
}

/** Search in display coordinates, then let the caller map back to its captured source. */
export function nearestNodeHit(
  point: Point,
  shapes: Geometry[],
  instances: Matrix[],
  radius: number,
  exclude?: { id: string; index?: number },
  junction: JunctionNode[] = [],
): NodeHit | null {
  let best: NodeHit | null = null,
    limit = radius;
  for (const instance of instances)
    for (const g of shapes) {
      if (!g.visible || g.locked || g.fillRegion || g.parameters) continue;
      const matrix = multiply(instance, g.transform);
      for (const [index, n] of g.nodes.entries()) {
        if (junction.some((member) => member.id === g.id && member.index === index)) continue;
        if (g.id === exclude?.id && (exclude.index === undefined || index === exclude.index))
          continue;
        const q = apply(matrix, n),
          d = distance(point, q);
        if (d <= limit) {
          best = { point: q, id: g.id, index, instance };
          limit = d;
        }
      }
    }
  return best;
}
export function nearestNode(...args: Parameters<typeof nearestNodeHit>): Point | null {
  return nearestNodeHit(...args)?.point ?? null;
}
