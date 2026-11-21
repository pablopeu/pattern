import type { Point } from '../geometry/matrix';
import { apply } from '../geometry/matrix';
import { girihOrnament } from './ornament';
import { validateGirihPatch, type GirihTile } from './patch';
import { distance, sub, cross, lineMeet, GIRIH_EPS } from './polygons';
export interface Strand {
  id: string;
  points: Point[];
  closed: boolean;
}
interface Incidence {
  strand: number;
  arc: number;
  arms: Point[];
  variable: number;
  over: boolean;
}
export interface WeaveCrossing {
  id: string;
  point: Point;
  incidences: [Incidence, Incidence];
}
export interface WeaveResult {
  crossings: WeaveCrossing[];
  conflicts: { strand: number; from: number; to: number }[];
  ambiguous: Point[];
  overlaps: number;
  breaks: number;
  valid: boolean;
}
/** Join only corresponding contact rays; two directions at one midpoint remain distinct. */
export function girihStrands(tiles: GirihTile[]): Strand[] {
  const report = validateGirihPatch(tiles);
  if (report.issues.length) throw Error(report.issues[0]);
  const pieces = tiles.flatMap((tile, i) => {
    const ornament = girihOrnament(tile.kind);
    if (ornament.unmatched.length) throw Error('Hay rayos Girih sin pareja.');
    return ornament.paths.map((path) => ({
      id: `${tile.id}/${path.id}`,
      points: path.points.map((p) => apply(tile.matrix, p)),
      ports: path.ports.map((p) => `${i}/${p}`),
    }));
  });
  const byPort = new Map<string, { index: number; end: number }>();
  pieces.forEach((p, i) => p.ports.forEach((port, end) => byPort.set(port, { index: i, end })));
  const joins = new Map<string, string>();
  for (const pair of report.adjacencies)
    for (let sign = 0; sign < 2; sign++) {
      const a = `${pair.a}/${2 * pair.edgeA + sign}`,
        b = `${pair.b}/${2 * pair.edgeB + sign}`;
      joins.set(a, b);
      joins.set(b, a);
    }
  const visited = new Set<number>(),
    strands: Strand[] = [];
  const order = pieces
    .map((p, index) => ({ index, end: p.ports.findIndex((port) => !joins.has(port)) }))
    .sort((a, b) => (a.end < 0 ? 1 : 0) - (b.end < 0 ? 1 : 0) || a.index - b.index);
  for (const start of order) {
    if (visited.has(start.index)) continue;
    let index = start.index,
      end = Math.max(0, start.end),
      closed = false;
    const points: Point[] = [],
      members: string[] = [];
    while (!visited.has(index)) {
      visited.add(index);
      const p = pieces[index];
      members.push(p.id);
      const next = end === 0 ? p.points : [...p.points].reverse();
      if (points.length && distance(points.at(-1)!, next[0]) > 1e-6)
        throw Error('Los puertos Girih no coinciden.');
      points.push(...(points.length ? next.slice(1) : next));
      const other = joins.get(p.ports[1 - end]);
      if (!other) break;
      const target = byPort.get(other)!;
      index = target.index;
      end = target.end;
      if (index === start.index) {
        closed = true;
        break;
      }
    }
    if (closed && distance(points[0], points.at(-1)!) < 1e-6) points.pop();
    strands.push({ id: `strand-${members.sort()[0]}`, points, closed });
  }
  return strands;
}
interface Segment {
  strand: number;
  a: Point;
  b: Point;
  offset: number;
  length: number;
}
function segmentsOf(strands: Strand[]) {
  const segments: Segment[] = [],
    lengths: number[] = [];
  strands.forEach((strand, index) => {
    let length = 0;
    for (let i = 0; i < (strand.closed ? strand.points.length : strand.points.length - 1); i++) {
      const a = strand.points[i],
        b = strand.points[(i + 1) % strand.points.length],
        len = distance(a, b);
      if (len < GIRIH_EPS) continue;
      segments.push({ strand: index, a, b, offset: length, length: len });
      length += len;
    }
    lengths.push(length);
  });
  if (segments.length > 4096) throw Error('El entrelazado admite hasta4096 segmentos.');
  return { segments, lengths };
}
/** A parity DSU keeps mandatory opposite crossings, then checks every strand cycle. */
class Parity {
  parent: number[];
  parity: number[];
  rank: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.parity = Array(n).fill(0);
    this.rank = Array(n).fill(0);
  }
  find(x: number): [number, number] {
    if (this.parent[x] === x) return [x, 0];
    const [root, parity] = this.find(this.parent[x]);
    this.parity[x] ^= parity;
    this.parent[x] = root;
    return [root, this.parity[x]];
  }
  join(a: number, b: number, difference: number) {
    let [ra, pa] = this.find(a),
      [rb, pb] = this.find(b);
    if (ra === rb) return (pa ^ pb) === difference;
    if (this.rank[ra] < this.rank[rb]) {
      [ra, rb] = [rb, ra];
      [pa, pb] = [pb, pa];
    }
    this.parent[rb] = ra;
    if (this.rank[ra] === this.rank[rb]) this.rank[ra]++;
    this.parity[rb] = pa ^ pb ^ difference;
    return true;
  }
}
export function solveWeave(strands: Strand[], phase = 0, allowBreaks = false): WeaveResult {
  const { segments, lengths } = segmentsOf(strands),
    groups = new Map<string, { point: Point; incidences: Incidence[] }>();
  let overlaps = 0;
  const arcAt = (s: Segment, t: number) => {
    const value = s.offset + Math.max(0, Math.min(1, t)) * s.length;
    return strands[s.strand].closed && (value < 1e-7 || Math.abs(value - lengths[s.strand]) < 1e-7)
      ? 0
      : value;
  };
  const complete = (s: Segment, arc: number) =>
    strands[s.strand].closed || (arc > 1e-7 && arc < lengths[s.strand] - 1e-7);
  for (let i = 0; i < segments.length; i++)
    for (let j = 0; j < i; j++) {
      const a = segments[i],
        b = segments[j];
      if (
        Math.max(a.a.x, a.b.x) < Math.min(b.a.x, b.b.x) - 1e-7 ||
        Math.min(a.a.x, a.b.x) > Math.max(b.a.x, b.b.x) + 1e-7 ||
        Math.max(a.a.y, a.b.y) < Math.min(b.a.y, b.b.y) - 1e-7 ||
        Math.min(a.a.y, a.b.y) > Math.max(b.a.y, b.b.y) + 1e-7
      )
        continue;
      const u = sub(a.b, a.a),
        v = sub(b.b, b.a),
        hit = lineMeet(a.a, u, b.a, v);
      if (!hit) {
        if (Math.abs(cross(sub(b.a, a.a), u)) < 1e-7) {
          const dot = (p: Point) =>
              (sub(p, a.a).x * u.x + sub(p, a.a).y * u.y) / (a.length * a.length),
            t = dot(b.a),
            s = dot(b.b);
          if (Math.min(1, Math.max(t, s)) - Math.max(0, Math.min(t, s)) > 1e-7) overlaps++;
        }
        continue;
      }
      if (hit.t < -1e-7 || hit.t > 1 + 1e-7 || hit.s < -1e-7 || hit.s > 1 + 1e-7) continue;
      const aa = arcAt(a, hit.t),
        ab = arcAt(b, hit.s);
      if (
        !complete(a, aa) ||
        !complete(b, ab) ||
        (a.strand === b.strand && Math.abs(aa - ab) < 1e-7)
      )
        continue;
      const key = `${Math.round(hit.point.x * 1e7)},${Math.round(hit.point.y * 1e7)}`,
        group = groups.get(key) ?? { point: hit.point, incidences: [] };
      groups.set(key, group);
      for (const [segment, t, arc] of [
        [a, hit.t, aa],
        [b, hit.s, ab],
      ] as const) {
        let incidence = group.incidences.find(
          (p) => p.strand === segment.strand && Math.abs(p.arc - arc) < 1e-6,
        );
        if (!incidence) {
          incidence = { strand: segment.strand, arc, arms: [], variable: 0, over: false };
          group.incidences.push(incidence);
        }
        const dir = {
          x: (segment.b.x - segment.a.x) / segment.length,
          y: (segment.b.y - segment.a.y) / segment.length,
        };
        const arms = [
          ...(t > 1e-7 ? [{ x: -dir.x, y: -dir.y }] : []),
          ...(t < 1 - 1e-7 ? [dir] : []),
        ];
        for (const arm of arms)
          if (!incidence.arms.some((a) => distance(a, arm) < 1e-6)) incidence.arms.push(arm);
      }
    }
  const crossings: WeaveCrossing[] = [],
    ambiguous: Point[] = [];
  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const incidence = group.incidences.sort((a, b) => a.strand - b.strand || a.arc - b.arc);
    if (incidence.length !== 2 || incidence.some((i) => i.arms.length !== 2)) {
      ambiguous.push(group.point);
      continue;
    }
    const around = incidence
      .flatMap((i, label) => i.arms.map((v) => ({ label, angle: Math.atan2(v.y, v.x) })))
      .sort((a, b) => a.angle - b.angle);
    if (around.some((p, i) => p.label === around[(i + 1) % 4].label)) continue; // tangency, not a transverse crossing
    crossings.push({
      id: key,
      point: group.point,
      incidences: incidence as [Incidence, Incidence],
    });
  }
  if (crossings.length > 4096) throw Error('El entrelazado admite hasta4096 cruces.');
  const parity = new Parity(crossings.length * 2),
    events = strands.map(() => [] as Incidence[]);
  crossings.forEach((cross, i) => {
    cross.incidences.forEach((inc, j) => {
      inc.variable = i * 2 + j;
      events[inc.strand].push(inc);
    });
    parity.join(i * 2, i * 2 + 1, 1);
  });
  const conflicts: WeaveResult['conflicts'] = [];
  events.forEach((list, strand) => {
    list.sort((a, b) => a.arc - b.arc);
    for (let i = 1; i < list.length + (strands[strand].closed && list.length ? 1 : 0); i++) {
      const a = list[i - 1],
        b = list[i % list.length];
      if (!parity.join(a.variable, b.variable, 1))
        conflicts.push({ strand, from: a.variable, to: b.variable });
    }
  });
  // Choose each component's phase from a stable strand/event anchor, not from
  // coordinate-sorted crossing numbers. Rigidly moving the drawing must not
  // exchange its overpasses and underpasses.
  const anchors = new Map<number, { key: string; parity: number }>();
  events.forEach((list, strand) =>
    list.forEach((inc, index) => {
      const [root, p] = parity.find(inc.variable),
        key = `${strands[strand].id}/${String(index).padStart(6, '0')}`,
        old = anchors.get(root);
      if (!old || key < old.key) anchors.set(root, { key, parity: p });
    }),
  );
  for (const crossing of crossings)
    for (const inc of crossing.incidences) {
      const [root, p] = parity.find(inc.variable);
      inc.over = !!(p ^ anchors.get(root)!.parity ^ (phase & 1));
    }
  return {
    crossings,
    conflicts,
    ambiguous,
    overlaps,
    breaks: allowBreaks ? conflicts.length : 0,
    valid: !ambiguous.length && !overlaps && (!conflicts.length || allowBreaks),
  };
}
