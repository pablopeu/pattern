import type { Point } from '../geometry/matrix';
import {
  girihPolygon,
  cross,
  sub,
  distance,
  lerp,
  lineMeet,
  segmentInside,
  type GirihKind,
  GIRIH_EPS,
} from './polygons';
export interface OrnamentPath {
  id: string;
  points: Point[];
  ports: [number, number];
}
export interface GirihOrnament {
  paths: OrnamentPath[];
  unmatched: number[];
  angle: number;
}
const cache = new Map<string, GirihOrnament>();
/** Independent polygons-in-contact inference, following Kaplan2005, fixed Girih contact54°. */
export function girihOrnament(kind: GirihKind, angle = 54): GirihOrnament {
  if (!Number.isFinite(angle) || angle < 15 || angle > 75)
    throw Error('Ángulo ornamental fuera de15–75°.');
  const key = `${kind}/${angle}`,
    old = cache.get(key);
  if (old) return old;
  const polygon = girihPolygon(kind),
    radians = (angle * Math.PI) / 180;
  const rays = polygon.flatMap((a, i) => {
    const b = polygon[(i + 1) % polygon.length],
      e = sub(b, a),
      length = Math.hypot(e.x, e.y),
      m = lerp(a, b, 0.5);
    return [1, -1].map((sign) => ({
      point: m,
      direction: {
        x: (sign * Math.cos(radians) * e.x) / length - (Math.sin(radians) * e.y) / length,
        y: (sign * Math.cos(radians) * e.y) / length + (Math.sin(radians) * e.x) / length,
      },
    }));
  });
  type Pair = { a: number; b: number; points: Point[]; cost: number };
  const pairs: Pair[] = [];
  for (let a = 0; a < rays.length; a++)
    for (let b = a + 1; b < rays.length; b++) {
      const u = rays[a],
        v = rays[b];
      if (distance(u.point, v.point) < GIRIH_EPS) continue;
      const hit = lineMeet(u.point, u.direction, v.point, v.direction);
      if (
        hit &&
        hit.t > GIRIH_EPS &&
        hit.s > GIRIH_EPS &&
        segmentInside(u.point, hit.point, polygon) &&
        segmentInside(v.point, hit.point, polygon)
      )
        pairs.push({ a, b, points: [u.point, hit.point, v.point], cost: hit.t + hit.s });
      else if (
        !hit &&
        Math.abs(cross(sub(v.point, u.point), u.direction)) < GIRIH_EPS &&
        sub(v.point, u.point).x * u.direction.x + sub(v.point, u.point).y * u.direction.y > 0 &&
        u.direction.x * v.direction.x + u.direction.y * v.direction.y < 0 &&
        segmentInside(u.point, v.point, polygon)
      )
        pairs.push({ a, b, points: [u.point, v.point], cost: distance(u.point, v.point) });
    }
  pairs.sort((a, b) => a.cost - b.cost || a.a - b.a || a.b - b.b);
  const used = new Set<number>(),
    chosen: Pair[] = [];
  for (const p of pairs)
    if (!used.has(p.a) && !used.has(p.b)) {
      chosen.push(p);
      used.add(p.a);
      used.add(p.b);
    }
  // On concave shapes, bounded exact matching repairs a greedy dead end.
  if (used.size !== rays.length) {
    const byRay = rays.map((_, i) => pairs.filter((p) => p.a === i || p.b === i)),
      memo = new Map<number, { cost: number; pairs: Pair[] } | null>();
    let states = 0;
    const solve = (mask: number): { cost: number; pairs: Pair[] } | null => {
      if (!mask) return { cost: 0, pairs: [] };
      if (memo.has(mask)) return memo.get(mask)!;
      if (++states > 200000) throw Error('La inferencia ornamental excede el presupuesto.');
      let first = 0;
      while (!(mask & (1 << first))) first++;
      let best: { cost: number; pairs: Pair[] } | null = null;
      for (const p of byRay[first]) {
        const other = p.a === first ? p.b : p.a;
        if (!(mask & (1 << other))) continue;
        const rest = solve(mask ^ (1 << first) ^ (1 << other));
        if (rest && (!best || rest.cost + p.cost < best.cost))
          best = { cost: rest.cost + p.cost, pairs: [p, ...rest.pairs] };
      }
      memo.set(mask, best);
      return best;
    };
    const exact = solve((1 << rays.length) - 1);
    if (exact) {
      chosen.splice(0, chosen.length, ...exact.pairs);
      used.clear();
      for (const p of chosen) {
        used.add(p.a);
        used.add(p.b);
      }
    }
  }
  const result = {
    paths: chosen.map((p) => ({
      id: `${key}/${p.a}-${p.b}`,
      points: p.points,
      ports: [p.a, p.b] as [number, number],
    })),
    unmatched: rays.map((_, i) => i).filter((i) => !used.has(i)),
    angle,
  };
  cache.set(key, result);
  return result;
}
