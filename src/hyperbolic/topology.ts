import type { Point } from '../geometry/matrix';
import { distance } from '../geometry/matrix';
import type { HyperbolicPatch } from './disk';
import { diskPoint } from './disk';
import * as iso from '../vendor/poincare/iso';
export interface CanonicalVertex {
  id: string;
  point: Point;
  members: string[];
}
export interface CanonicalEdge {
  id: string;
  vertices: [string, string];
  midpoint: Point;
  owners: { cellId: string; edge: number }[];
}
export function geodesicMidpoint(a: Point, b: Point): Point {
  const near = diskPoint(iso.translation(-a.x, -a.y), b),
    d = 1 + Math.sqrt(Math.max(0, 1 - near.x * near.x - near.y * near.y));
  return diskPoint(iso.translation(a.x, a.y), { x: near.x / d, y: near.y / d });
}
/** Derive vertex/edge identity from reciprocal cell adjacency, never from a new
 * fixed coordinate quantization. The patch owns its existing numeric topology.
 */
export function canonicalHyperbolicTopology(patch: HyperbolicPatch) {
  const byId = new Map(patch.cells.map((cell) => [cell.id, cell])),
    parent = new Map<string, string>(),
    points = new Map<string, Point>(),
    node = (id: string, index: number) => `${id}/v${index}`;
  const find = (id: string): string => {
    const p = parent.get(id)!;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
  };
  for (const cell of patch.cells)
    for (let i = 0; i < patch.p; i++) {
      const id = node(cell.id, i);
      parent.set(id, id);
      points.set(id, cell.vertices[i]);
    }
  let maxEndpointMismatch = 0;
  for (const cell of patch.cells)
    for (let e = 0; e < patch.p; e++) {
      const other = byId.get(cell.neighbors[e] ?? '');
      if (!other || cell.id > other.id) continue;
      const candidates = other.neighbors
        .map((id, i) => (id === cell.id ? i : -1))
        .filter((i) => i >= 0);
      if (candidates.length !== 1) throw Error('Adyacencia hiperbólica no recíproca o ambigua.');
      const j = candidates[0],
        a = cell.vertices[e],
        b = cell.vertices[(e + 1) % patch.p],
        c = other.vertices[j],
        d = other.vertices[(j + 1) % patch.p],
        reverse = distance(a, d) + distance(b, c) <= distance(a, c) + distance(b, d),
        pairs = reverse
          ? [
              [e, (j + 1) % patch.p],
              [(e + 1) % patch.p, j],
            ]
          : [
              [e, j],
              [(e + 1) % patch.p, (j + 1) % patch.p],
            ];
      for (const [i, k] of pairs) {
        const mismatch = distance(cell.vertices[i], other.vertices[k]);
        maxEndpointMismatch = Math.max(maxEndpointMismatch, mismatch);
        if (mismatch > 1e-7) throw Error('Extremos adyacentes no coincidentes.');
        union(node(cell.id, i), node(other.id, k));
      }
    }
  const vertices = new Map<string, CanonicalVertex>(),
    corners = new Map<string, string[]>();
  for (const cell of patch.cells) {
    const ids = cell.vertices.map((_, i) => {
      const member = node(cell.id, i),
        id = find(member);
      let v = vertices.get(id);
      if (!v) {
        v = { id, point: points.get(id)!, members: [] };
        vertices.set(id, v);
      }
      v.members.push(member);
      return id;
    });
    corners.set(cell.id, ids);
  }
  for (const v of vertices.values())
    if (v.members.length > patch.q) throw Error('Vértice con valencia superior a q.');
  const edges = new Map<string, CanonicalEdge>(),
    cellEdges = new Map<string, string[]>();
  for (const cell of patch.cells) {
    const ids: string[] = [];
    for (let e = 0; e < patch.p; e++) {
      const a = corners.get(cell.id)![e],
        b = corners.get(cell.id)![(e + 1) % patch.p],
        id = a < b ? `${a}|${b}` : `${b}|${a}`;
      let edge = edges.get(id);
      if (!edge) {
        edge = {
          id,
          vertices: [a, b],
          midpoint: geodesicMidpoint(vertices.get(a)!.point, vertices.get(b)!.point),
          owners: [],
        };
        edges.set(id, edge);
      }
      edge.owners.push({ cellId: cell.id, edge: e });
      if (edge.owners.length > 2) throw Error('Arista no manifold.');
      ids.push(id);
    }
    cellEdges.set(cell.id, ids);
  }
  return { vertices, edges, corners, cellEdges, maxEndpointMismatch };
}
