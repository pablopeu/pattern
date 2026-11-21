import { geometry, node, type Geometry, type Node } from '../app/model';
import { apply, type Matrix, type Point } from '../geometry/matrix';
export function mapCanonicalNodes(nodes: Node[], m: Matrix, reverse = false): Node[] {
  const vector = (p: Point) => ({ x: m[0] * p.x + m[2] * p.y, y: m[1] * p.x + m[3] * p.y });
  return (reverse ? [...nodes].reverse() : nodes).map((n) => ({
    ...apply(m, n),
    in: vector(reverse ? n.out : n.in),
    out: vector(reverse ? n.in : n.out),
  }));
}
export function boundaryFromEdges(edges: Node[][], name: string, tolerance: number): Geometry {
  const nodes: Node[] = [];
  for (const [i, raw] of edges.entries()) {
    if (raw.length < 2) throw Error('Borde isoédrico incompleto.');
    const edge = structuredClone(raw),
      previous = edges[(i + edges.length - 1) % edges.length].at(-1)!;
    if (Math.hypot(edge[0].x - previous.x, edge[0].y - previous.y) > tolerance)
      throw Error('Los bordes relacionados no cierran en sus vértices.');
    edge[0].in = { ...previous.in };
    nodes.push(...edge.slice(0, -1));
  }
  return {
    ...geometry('path', nodes, true),
    id: 'isohedral-boundary',
    name,
    fill: 'none',
    stroke: '#6d8977',
    strokeWidth: 0.25,
  };
}
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
