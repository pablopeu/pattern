import type { Geometry } from '../app/model';
import { IDENTITY, type Matrix, type Point } from '../geometry/matrix';
import { paperPath, paperData, scope } from '../geometry/paper';
import type { Bounds } from '../symmetry/groups';
/** Curve arrangement uses true cubic sub-curves, never raster pixels or flattened borders. */
export const PLANAR_LIMITS = { curves: 1200, intersections: 20000, halfEdges: 40000, faces: 2000 };
export const NUMERICAL_CLOSURE = 1e-6;
export const isFillBudgetError = (error: unknown): boolean =>
  error instanceof Error && /^Fill (admite|excede)/.test(error.message);
export interface BoundaryInput {
  id: string;
  patternId: string;
  shapeId: string;
  geometry: Geometry;
  matrix: Matrix;
  z: number;
}
export interface BoundaryRef {
  inputId: string;
  patternId: string;
  shapeId: string;
  matrix: Matrix;
  curve: number;
  part: number;
  direction: 1 | -1;
}
export interface PlanarFace {
  key: string;
  pathData: string;
  area: number;
  bounds: Bounds;
  refs: BoundaryRef[];
  z: number;
  approximate: boolean;
}
export interface Arrangement {
  faces: PlanarFace[];
  curves: number;
  intersections: number;
  closeTolerance: number;
  approximate: boolean;
}
interface CurveRecord {
  curve: paper.Curve;
  owner: BoundaryInput;
  index: number;
  cuts: number[];
  overrides: Map<number, Point>;
}
interface Vertex {
  point: Point;
  outgoing: number[];
}
interface HalfEdge {
  from: number;
  to: number;
  values: number[];
  refs: BoundaryRef[];
  twin: number;
  angle: number;
}
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const number = (v: number) => Number(v.toPrecision(14));
function edgeData(values: number[], move = false) {
  return `${move ? 'M' + number(values[0]) + ' ' + number(values[1]) : ''}C${values.slice(2).map(number).join(' ')}`;
}
function reverse(values: number[]) {
  return [values[6], values[7], values[4], values[5], values[2], values[3], values[0], values[1]];
}
function rotationKey(parts: string[]) {
  let best = '';
  for (let i = 0; i < parts.length; i++) {
    const key = [...parts.slice(i), ...parts.slice(0, i)].join('|');
    if (!best || key < best) best = key;
  }
  return best;
}
function refToken(r: BoundaryRef) {
  return `${r.inputId}:${r.curve}:${r.part}:${r.direction}`;
}

export function buildArrangement(
  inputs: BoundaryInput[],
  closeTolerance = 0,
  cancelled: () => boolean = () => false,
  bounds?: Bounds,
): Arrangement {
  if (!Number.isFinite(closeTolerance) || closeTolerance < 0 || closeTolerance > 5)
    throw Error('La tolerancia de cierre debe estar entre 0 y 5 mm.');
  const records: CurveRecord[] = [],
    paths: paper.PathItem[] = [],
    window = bounds ? new scope.Rectangle(bounds).expand(closeTolerance + NUMERICAL_CLOSURE) : null,
    vertices: Vertex[] = [],
    edges: HalfEdge[] = [],
    buckets = new Map<string, number[]>(),
    edgeKeys = new Map<string, number>();
  let intersections = 0,
    approximate = false;
  const check = () => {
    if (cancelled()) throw Error('Cálculo de relleno cancelado.');
  };
  const vertex = (p: Point) => {
    const x = Math.floor(p.x / NUMERICAL_CLOSURE),
      y = Math.floor(p.y / NUMERICAL_CLOSURE);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const id of buckets.get(`${x + dx},${y + dy}`) ?? [])
          if (dist(vertices[id].point, p) <= NUMERICAL_CLOSURE) return id;
    const id = vertices.length;
    vertices.push({ point: { x: p.x, y: p.y }, outgoing: [] });
    const key = `${x},${y}`;
    buckets.set(key, [...(buckets.get(key) ?? []), id]);
    return id;
  };
  const addCut = (r: CurveRecord, t: number) => {
    if (Number.isFinite(t) && t >= -1e-8 && t <= 1 + 1e-8) r.cuts.push(Math.max(0, Math.min(1, t)));
  };
  try {
    for (const input of inputs) {
      if (!input.geometry.visible || input.geometry.locked) continue;
      const path = paperPath(input.geometry, input.matrix ?? IDENTITY);
      paths.push(path);
      let index = 0;
      for (const child of path instanceof scope.CompoundPath ? path.children : [path])
        for (const curve of (child as paper.Path).curves) {
          const curveIndex = index++;
          // Keep original curve indices for persistent boundary references. A local
          // arrangement retains complete Béziers, never clipped/raster approximations.
          if (window && !curve.bounds.intersects(window)) continue;
          records.push({
            curve,
            owner: input,
            index: curveIndex,
            cuts: [0, 1],
            overrides: new Map(),
          });
          if (records.length > PLANAR_LIMITS.curves)
            throw Error(
              `Fill admite hasta ${PLANAR_LIMITS.curves} curvas visibles. Acercá el zoom u ocultá conjuntos.`,
            );
        }
    }
    for (let i = 0; i < records.length; i++) {
      check();
      const a = records[i];
      for (const hit of a.curve.getIntersections(a.curve)) {
        addCut(a, hit.time);
        addCut(a, hit.intersection.time);
        intersections++;
      }
      for (let j = i + 1; j < records.length; j++) {
        const b = records[j];
        if (!a.curve.bounds.expand(NUMERICAL_CLOSURE).intersects(b.curve.bounds)) continue;
        for (const hit of a.curve.getIntersections(b.curve)) {
          addCut(a, hit.time);
          addCut(b, hit.intersection.time);
          intersections++;
          if (intersections > PLANAR_LIMITS.intersections)
            throw Error(
              `Fill excede ${PLANAR_LIMITS.intersections} intersecciones; reducí la región visible.`,
            );
        }
      }
    }
    // First join endpoint components, choosing one deterministic coordinate for both ends.
    // Connected vertices are never pulled toward nearby curves by the optional gap setting.
    const tolerance = Math.max(NUMERICAL_CLOSURE, closeTolerance),
      endpoints = records.flatMap((r) =>
        [0, 1].map((t) => ({ r, t, p: r.curve.getPointAtTime(t) })),
      ),
      parent = endpoints.map((_, i) => i),
      sizes = endpoints.map(() => 1);
    const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
    const unite = (i: number, j: number) => {
      i = root(i);
      j = root(j);
      if (i !== j) {
        parent[j] = i;
        sizes[i] += sizes[j];
      }
    };
    for (let i = 0; i < endpoints.length; i++)
      for (let j = i + 1; j < endpoints.length; j++)
        if (dist(endpoints[i].p, endpoints[j].p) <= NUMERICAL_CLOSURE) unite(i, j);
    const isolated = endpoints.map((_, i) => sizes[root(i)] === 1);
    if (closeTolerance > NUMERICAL_CLOSURE)
      for (let i = 0; i < endpoints.length; i++)
        for (let j = i + 1; j < endpoints.length; j++) {
          if (!isolated[i] && !isolated[j]) continue;
          const d = dist(endpoints[i].p, endpoints[j].p);
          if (d <= tolerance) {
            unite(i, j);
            if (d > NUMERICAL_CLOSURE) approximate = true;
          }
        }
    const positions = new Map<number, Point>();
    for (let i = 0; i < endpoints.length; i++) {
      const id = root(i),
        p = endpoints[i].p,
        old = positions.get(id);
      if (!old || p.x < old.x || (p.x === old.x && p.y < old.y)) positions.set(id, p);
    }
    for (let i = 0; i < endpoints.length; i++) {
      const { r: a, t, p: endpoint } = endpoints[i],
        p = positions.get(root(i))!;
      a.overrides.set(t, { x: p.x, y: p.y });
      if (sizes[root(i)] > 1) continue;
      check();
      let best: { r: CurveRecord; t: number; p: Point; distance: number } | undefined;
      for (const b of records) {
        if (a === b || !b.curve.bounds.expand(2 * tolerance).contains(endpoint)) continue;
        const hit = b.curve.getNearestLocation(endpoint);
        if (!hit || hit.time < 1e-8 || hit.time > 1 - 1e-8) continue;
        const d = dist(endpoint, hit.point);
        if (d > tolerance || d <= 1e-9) continue;
        if (
          !best ||
          d < best.distance - 1e-10 ||
          (Math.abs(d - best.distance) < 1e-10 && b.owner.id < best.r.owner.id)
        )
          best = { r: b, t: hit.time, p: hit.point, distance: d };
      }
      if (best) {
        addCut(best.r, best.t);
        a.overrides.set(t, { x: best.p.x, y: best.p.y });
        if (best.distance > NUMERICAL_CLOSURE) approximate = true;
      }
    }
    for (const r of records) {
      check();
      const cuts = [...r.cuts]
        .sort((a, b) => a - b)
        .filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-8);
      for (let part = 0; part < cuts.length - 1; part++) {
        const c = r.curve.getPart(cuts[part], cuts[part + 1]),
          values = c.values.slice();
        for (const side of [0, 1]) {
          const t = cuts[part + side],
            p = r.overrides.get(t);
          if (p) {
            const index = side ? 6 : 0,
              dx = p.x - values[index],
              dy = p.y - values[index + 1];
            values[index] += dx;
            values[index + 1] += dy;
            values[side ? 4 : 2] += dx;
            values[side ? 5 : 3] += dy;
          }
        }
        if (c.length < NUMERICAL_CLOSURE) continue;
        if (c.isStraight()) {
          values[2] = values[0];
          values[3] = values[1];
          values[4] = values[6];
          values[5] = values[7];
        }
        const from = vertex({ x: values[0], y: values[1] }),
          to = vertex({ x: values[6], y: values[7] });
        for (const [id, k, control] of [
          [from, 0, 2],
          [to, 6, 4],
        ]) {
          const p = vertices[id].point,
            dx = p.x - values[k],
            dy = p.y - values[k + 1];
          values[k] = p.x;
          values[k + 1] = p.y;
          values[control] += dx;
          values[control + 1] += dy;
        }
        const fkey = values.map((v) => Math.round(v / NUMERICAL_CLOSURE)).join(','),
          rkey = reverse(values)
            .map((v) => Math.round(v / NUMERICAL_CLOSURE))
            .join(','),
          existing = edgeKeys.get(fkey) ?? edgeKeys.get(rkey),
          forward = edgeKeys.has(fkey);
        const ref: BoundaryRef = {
          inputId: r.owner.id,
          patternId: r.owner.patternId,
          shapeId: r.owner.shapeId,
          matrix: r.owner.matrix,
          curve: r.index,
          part,
          direction: 1,
        };
        if (existing !== undefined) {
          const index = forward ? existing : edges[existing].twin;
          edges[index].refs.push(ref);
          edges[edges[index].twin].refs.push({ ...ref, direction: -1 });
          continue;
        }
        const index = edges.length,
          angle = (v: number[]) => {
            let dx = v[2] - v[0],
              dy = v[3] - v[1];
            if (Math.hypot(dx, dy) < 1e-9) {
              dx = v[4] - v[0];
              dy = v[5] - v[1];
            }
            if (Math.hypot(dx, dy) < 1e-9) {
              dx = v[6] - v[0];
              dy = v[7] - v[1];
            }
            const angle = Math.atan2(dy, dx);
            return angle < 0 ? angle + 2 * Math.PI : angle;
          },
          back = reverse(values);
        edges.push(
          { from, to, values, refs: [ref], twin: index + 1, angle: angle(values) },
          {
            from: to,
            to: from,
            values: back,
            refs: [{ ...ref, direction: -1 }],
            twin: index,
            angle: angle(back),
          },
        );
        vertices[from].outgoing.push(index);
        vertices[to].outgoing.push(index + 1);
        edgeKeys.set(fkey, index);
        if (edges.length > PLANAR_LIMITS.halfEdges)
          throw Error('Fill excede 40000 medias aristas; reducí la complejidad.');
      }
    }
    const bend = (edge: HalfEdge) => {
      const v = edge.values,
        t = 1e-4,
        u = 1 - t,
        dx =
          3 * u * u * t * (v[2] - v[0]) + 3 * u * t * t * (v[4] - v[0]) + t * t * t * (v[6] - v[0]),
        dy =
          3 * u * u * t * (v[3] - v[1]) + 3 * u * t * t * (v[5] - v[1]) + t * t * t * (v[7] - v[1]);
      return Math.atan2(
        Math.cos(edge.angle) * dy - Math.sin(edge.angle) * dx,
        Math.cos(edge.angle) * dx + Math.sin(edge.angle) * dy,
      );
    };
    for (const v of vertices)
      v.outgoing.sort(
        (i, j) =>
          (Math.abs(edges[i].angle - edges[j].angle) > 1e-10
            ? edges[i].angle - edges[j].angle
            : bend(edges[i]) - bend(edges[j])) ||
          refToken(edges[i].refs[0]).localeCompare(refToken(edges[j].refs[0])),
      );
    const visited = new Set<number>(),
      cycles: { path: paper.PathItem; face: PlanarFace; parent: number }[] = [];
    for (let first = 0; first < edges.length; first++) {
      if (visited.has(first)) continue;
      check();
      const cycle: number[] = [];
      let current = first;
      while (!visited.has(current)) {
        visited.add(current);
        cycle.push(current);
        const e = edges[current],
          out = vertices[e.to].outgoing,
          index = out.indexOf(e.twin);
        current = out[(index - 1 + out.length) % out.length];
        if (cycle.length > edges.length) throw Error('Topología de relleno inconsistente.');
      }
      if (current !== first || cycle.length < 2) continue;
      const data = cycle.map((id, i) => edgeData(edges[id].values, i === 0)).join('') + 'Z',
        path = new scope.CompoundPath({ pathData: data, fillRule: 'evenodd', insert: false });
      if (path.area <= NUMERICAL_CLOSURE * NUMERICAL_CLOSURE) {
        path.remove();
        continue;
      }
      const refs = cycle.map(
          (id) => [...edges[id].refs].sort((a, b) => refToken(a).localeCompare(refToken(b)))[0],
        ),
        owners = refs.map((r) => inputs.find((i) => i.id === r.inputId)?.z ?? 0),
        b = path.bounds;
      cycles.push({
        path,
        parent: -1,
        face: {
          key: rotationKey(refs.map(refToken)),
          pathData: paperData(path),
          area: path.area,
          bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
          refs,
          z: Math.max(...owners),
          approximate,
        },
      });
      if (cycles.length > PLANAR_LIMITS.faces)
        throw Error(`Fill excede ${PLANAR_LIMITS.faces} caras; reducí la región visible.`);
    }
    try {
      // Disconnected nested cycles: each bounded face excludes its immediate children.
      for (let i = 0; i < cycles.length; i++) {
        const c = cycles[i];
        let parent = -1;
        for (let j = 0; j < cycles.length; j++) {
          const p = cycles[j];
          if (i === j || p.face.area <= c.face.area + 1e-8) continue;
          if (parent >= 0 && cycles[parent].face.area < p.face.area) continue;
          if (p.path.contains(c.path.interiorPoint)) parent = j;
        }
        c.parent = parent;
      }
      const faces = cycles
        .map((c, i) => {
          const children = cycles.filter((k) => k.parent === i),
            refs = [
              ...c.face.refs,
              ...children.flatMap((c) =>
                c.face.refs.map((r) => ({ ...r, direction: -r.direction as 1 | -1 })),
              ),
            ];
          return {
            ...c.face,
            pathData:
              c.face.pathData +
              children
                .map((c) => {
                  const p = new scope.CompoundPath({ pathData: c.face.pathData, insert: false });
                  p.reverse();
                  const data = paperData(p);
                  p.remove();
                  return data;
                })
                .join(''),
            area: c.face.area - children.reduce((n, c) => n + c.face.area, 0),
            key:
              c.face.key +
              children
                .map((c) => '!' + c.face.key)
                .sort()
                .join(''),
            refs,
          };
        })
        .filter((f) => f.area > NUMERICAL_CLOSURE * NUMERICAL_CLOSURE);
      return { faces, curves: records.length, intersections, closeTolerance, approximate };
    } finally {
      cycles.forEach((c) => c.path.remove());
    }
  } finally {
    paths.forEach((p) => p.remove());
  }
}
export function facesAt(arrangement: Arrangement, point: Point): PlanarFace[] {
  const p = new scope.Point(point.x, point.y);
  return arrangement.faces
    .filter((f) => {
      if (!new scope.Rectangle(f.bounds).contains(p)) return false;
      const path = new scope.CompoundPath({
        pathData: f.pathData,
        fillRule: 'evenodd',
        insert: false,
      });
      try {
        return path.contains(p);
      } finally {
        path.remove();
      }
    })
    .sort((a, b) => b.z - a.z || a.area - b.area || a.key.localeCompare(b.key));
}

/** Reusable point index: hover does not rebuild curves or reparse every face. */
export function faceIndex(arrangement: Arrangement) {
  const index = arrangement.faces.map((face) => ({
    face,
    path: new scope.CompoundPath({ pathData: face.pathData, fillRule: 'evenodd', insert: false }),
    bounds: new scope.Rectangle(face.bounds),
  }));
  return {
    at: (point: Point) => {
      const p = new scope.Point(point.x, point.y);
      return index
        .filter((i) => i.bounds.contains(p) && i.path.contains(p))
        .map((i) => i.face)
        .sort((a, b) => b.z - a.z || a.area - b.area || a.key.localeCompare(b.key));
    },
    dispose: () => index.forEach((i) => i.path.remove()),
  };
}
