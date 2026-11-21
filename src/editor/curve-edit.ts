import { node, type Geometry } from '../app/model';
import type { Point } from '../geometry/matrix';

/** Split the clicked cubic by de Casteljau, preserving shape and endpoint junctions. */
export function insertCurveNode(g: Geometry, index: number, time: number): number {
  const a = g.nodes[index],
    b = g.nodes[(index + 1) % g.nodes.length];
  if (g.kind !== 'path' || !a || !b || (!g.closed && index >= g.nodes.length - 1))
    throw Error('Segmento inexistente.');
  const t = Math.max(1e-6, Math.min(1 - 1e-6, time)),
    mix = (p: Point, q: Point) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }),
    p = mix(a, { x: a.x + a.out.x, y: a.y + a.out.y }),
    q = mix({ x: a.x + a.out.x, y: a.y + a.out.y }, { x: b.x + b.in.x, y: b.y + b.in.y }),
    r = mix({ x: b.x + b.in.x, y: b.y + b.in.y }, b),
    u = mix(p, q),
    v = mix(q, r),
    center = mix(u, v),
    n = node(center.x, center.y);
  a.out = { x: p.x - a.x, y: p.y - a.y };
  b.in = { x: r.x - b.x, y: r.y - b.y };
  n.in = { x: u.x - center.x, y: u.y - center.y };
  n.out = { x: v.x - center.x, y: v.y - center.y };
  g.nodes.splice(index + 1, 0, n);
  return index + 1;
}
