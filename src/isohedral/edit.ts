import { node, type Node } from '../app/model';
import type { Point } from '../geometry/matrix';
/** de Casteljau subdivision: adding a node preserves the complete Bézier silhouette. */
export function splitCanonicalEdge(edge: Node[], index: number): void {
  const a = edge[index],
    b = edge[index + 1];
  if (!a || !b) throw Error('Segmento de borde inexistente.');
  const midpoint = (p: Point, q: Point) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }),
    c1 = { x: a.x + a.out.x, y: a.y + a.out.y },
    c2 = { x: b.x + b.in.x, y: b.y + b.in.y },
    p = midpoint(a, c1),
    q = midpoint(c1, c2),
    r = midpoint(c2, b),
    u = midpoint(p, q),
    v = midpoint(q, r),
    center = midpoint(u, v),
    inserted = node(center.x, center.y);
  a.out = { x: p.x - a.x, y: p.y - a.y };
  b.in = { x: r.x - b.x, y: r.y - b.y };
  inserted.in = { x: u.x - center.x, y: u.y - center.y };
  inserted.out = { x: v.x - center.x, y: v.y - center.y };
  edge.splice(index + 1, 0, inserted);
}
