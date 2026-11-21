import { geometry, node, type Geometry, type Node } from '../app/model';
import {
  apply,
  multiply,
  inverse,
  rotate,
  translate,
  IDENTITY,
  type Matrix,
  type Point,
} from '../geometry/matrix';
import type { Bounds } from '../symmetry/groups';
import type { IsohedralDefinition } from '../isohedral/model';
import {
  newIsohedral,
  isohedralLayout,
  isohedralInstances,
  isohedralConstraints,
} from '../isohedral/engine';
export type TileKind =
  | 'square'
  | 'rectangle'
  | 'parallelogram'
  | 'triangle'
  | 'hexagon'
  | 'isohedral';
export interface TilingDefinition {
  version: 1;
  kind: TileKind;
  width: number;
  height: number;
  shear: number;
  origin: Point;
  rotation: number;
  edges: Node[][];
  showOutline: boolean;
  isohedral?: Omit<IsohedralDefinition, 'edges'>;
}
export interface TileInstance {
  id: string;
  matrix: Matrix;
  cell: [number, number];
  orientation: number;
}
export interface EdgePair {
  master: number;
  partner: number;
  matrix: Matrix;
  reverse: boolean;
  self: boolean;
}
export const tileNames: Record<TileKind, string> = {
  square: 'Cuadrado',
  rectangle: 'Rectángulo',
  parallelogram: 'Paralelogramo',
  triangle: 'Triángulo equilátero',
  hexagon: 'Hexágono regular',
  isohedral: 'Isoédrica IH',
};
export function newTiling(kind: TileKind = 'square'): TilingDefinition {
  if (kind === 'isohedral') return newIsohedralTiling(1);
  return {
    version: 1,
    kind,
    width: 60,
    height: 60,
    shear: 15,
    origin: { x: 0, y: 0 },
    rotation: 0,
    edges: Array.from({ length: kind === 'triangle' || kind === 'hexagon' ? 3 : 2 }, () => [
      node(0, 0),
      node(kind === 'triangle' ? 0.25 : 0.5, 0),
      node(kind === 'triangle' ? 0.5 : 1, 0),
    ]),
    showOutline: true,
  };
}
export function newIsohedralTiling(type: number): TilingDefinition {
  const { edges, ...isohedral } = newIsohedral(type);
  return { ...newTiling('square'), kind: 'isohedral', isohedral, edges };
}
/** Canonical edges are stored once, alongside the tiling's ordinary Bézier paths. */
export function isohedralDefinition(t: TilingDefinition): IsohedralDefinition {
  if (t.kind !== 'isohedral' || !t.isohedral) throw Error('Falta la definición isoédrica.');
  return { ...t.isohedral, edges: t.edges };
}
export function tileVertices(t: TilingDefinition): Point[] {
  if (t.kind === 'isohedral') return isohedralLayout(isohedralDefinition(t), t.width).vertices;
  const w = t.width,
    h = t.kind === 'square' ? w : t.height;
  if (t.kind === 'triangle')
    return [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w / 2, y: (w * Math.sqrt(3)) / 2 },
    ];
  if (t.kind === 'hexagon') {
    const r = w / 2;
    return Array.from({ length: 6 }, (_, i) => ({
      x: r + Math.cos((i * Math.PI) / 3) * r,
      y: (r * Math.sqrt(3)) / 2 + Math.sin((i * Math.PI) / 3) * r,
    }));
  }
  const shear = t.kind === 'parallelogram' ? t.shear : 0;
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w + shear, y: h },
    { x: shear, y: h },
  ];
}
export function tileBasis(t: TilingDefinition): Matrix {
  if (t.kind === 'isohedral') return isohedralLayout(isohedralDefinition(t), t.width).basis;
  const w = t.width;
  if (t.kind === 'triangle') return [w, 0, w / 2, (w * Math.sqrt(3)) / 2, 0, 0];
  if (t.kind === 'hexagon')
    return [w * 0.75, (w * Math.sqrt(3)) / 4, 0, (w * Math.sqrt(3)) / 2, 0, 0];
  return [w, 0, t.kind === 'parallelogram' ? t.shear : 0, t.kind === 'square' ? w : t.height, 0, 0];
}
export const tileFrame = (t: TilingDefinition) =>
  multiply(translate(t.origin.x, t.origin.y), rotate(t.rotation));
export function edgeFrame(t: TilingDefinition, index: number): Matrix {
  if (t.kind === 'isohedral') {
    const part = isohedralLayout(isohedralDefinition(t), t.width).parts.find(
      (p) => p.master === index,
    );
    if (!part) throw Error('Borde maestro inexistente.');
    return part.matrix;
  }
  const v = tileVertices(t),
    a = v[index],
    b = v[(index + 1) % v.length],
    dx = b.x - a.x,
    dy = b.y - a.y;
  return [dx, dy, -dy, dx, a.x, a.y];
}
const vector = (m: Matrix, p: Point) => ({
  x: m[0] * p.x + m[2] * p.y,
  y: m[1] * p.x + m[3] * p.y,
});
export function transformNodes(nodes: Node[], m: Matrix, reverse = false): Node[] {
  return (reverse ? [...nodes].reverse() : nodes).map((n) => ({
    ...apply(m, n),
    in: vector(m, reverse ? n.out : n.in),
    out: vector(m, reverse ? n.in : n.out),
  }));
}
export function edgePairs(t: TilingDefinition): EdgePair[] {
  if (t.kind === 'isohedral') {
    const parts = isohedralLayout(isohedralDefinition(t), t.width).parts;
    return parts.flatMap((p, i) => {
      const master = parts.findIndex((a) => a.master === p.master);
      return i === master
        ? []
        : [
            {
              master,
              partner: i,
              matrix: multiply(p.matrix, inverse(parts[master].matrix)),
              reverse: p.reverse !== parts[master].reverse,
              self: false,
            },
          ];
    });
  }
  const v = tileVertices(t);
  if (t.kind === 'triangle')
    return v.map((a, i) => ({
      master: i,
      partner: i,
      matrix: [-1, 0, 0, -1, a.x + v[(i + 1) % 3].x, a.y + v[(i + 1) % 3].y],
      reverse: true,
      self: true,
    }));
  if (t.kind === 'hexagon')
    return [0, 1, 2].map((i) => ({
      master: i,
      partner: i + 3,
      matrix: translate(v[i + 3].x - v[i + 1].x, v[i + 3].y - v[i + 1].y),
      reverse: true,
      self: false,
    }));
  return [
    { master: 0, partner: 2, matrix: translate(v[3].x, v[3].y), reverse: true, self: false },
    { master: 1, partner: 3, matrix: translate(-v[1].x, -v[1].y), reverse: true, self: false },
  ];
}
export function tileEdges(t: TilingDefinition): Node[][] {
  if (t.kind === 'isohedral') return isohedralLayout(isohedralDefinition(t), t.width).edges;
  const vertices = tileVertices(t),
    edges: Node[][] = Array.from({ length: vertices.length }, () => []);
  for (let i = 0; i < t.edges.length; i++) {
    const first = transformNodes(t.edges[i], edgeFrame(t, i));
    if (t.kind === 'triangle') {
      const op = edgePairs(t)[i].matrix,
        last = first.at(-1)!;
      last.out = vector(op, last.in);
      edges[i] = [...first, ...transformNodes(first.slice(0, -1), op, true)];
    } else edges[i] = first;
  }
  if (t.kind !== 'triangle')
    for (const pair of edgePairs(t))
      edges[pair.partner] = transformNodes(edges[pair.master], pair.matrix, true);
  return edges;
}
export function tileBoundary(t: TilingDefinition): Geometry {
  const edges = tileEdges(t),
    nodes: Node[] = [];
  for (let i = 0; i < edges.length; i++) {
    const edge = structuredClone(edges[i]);
    edge[0].in = structuredClone(edges[(i + edges.length - 1) % edges.length].at(-1)!.in);
    nodes.push(...edge.slice(0, -1));
  }
  return {
    ...geometry('path', nodes, true),
    id: 'tile-boundary',
    name: 'Contorno de tesela',
    stroke: '#6d8977',
    strokeWidth: 0.25,
    fill: 'none',
  };
}
export function tileArea(t: TilingDefinition): number {
  if (t.kind === 'isohedral') {
    const { basis: b, aspects } = isohedralLayout(isohedralDefinition(t), t.width);
    return Math.abs(b[0] * b[3] - b[1] * b[2]) / aspects.length;
  }
  if (t.kind === 'triangle') return (t.width * t.width * Math.sqrt(3)) / 4;
  if (t.kind === 'hexagon') return (3 * Math.sqrt(3) * t.width * t.width) / 8;
  return t.width * (t.kind === 'square' ? t.width : t.height);
}
export function edgeOffsetLimit(t: TilingDefinition, edge: number, x: number): number {
  const f = edgeFrame(t, edge),
    length = Math.hypot(f[0], f[1]),
    v = tileVertices(t),
    maxLength = Math.max(
      ...v.map((a, i) => Math.hypot(a.x - v[(i + 1) % v.length].x, a.y - v[(i + 1) % v.length].y)),
    ),
    altitude =
      t.kind === 'triangle'
        ? (t.width * Math.sqrt(3)) / 2
        : t.kind === 'hexagon'
          ? (t.width * Math.sqrt(3)) / 4
          : tileArea(t) / maxLength,
    end = t.kind === 'triangle' ? 0.5 : 1;
  return (Math.min(0.07, (0.07 * altitude) / length) * Math.max(0, Math.min(x, end - x)) * 2) / end;
}
export function constrainTiling(t: TilingDefinition): TilingDefinition {
  if (t.kind === 'isohedral') {
    const next = structuredClone(t),
      constraints = isohedralConstraints(isohedralDefinition(next));
    next.edges.forEach((edge, e) => {
      edge[0].x = 0;
      edge[0].y = 0;
      edge.at(-1)!.x = 1;
      if (constraints[e] !== 'mirror') edge.at(-1)!.y = 0;
    });
    // Free curves are accepted only after the independent geometric validator.
    return next;
  }
  const next = structuredClone(t),
    end = next.kind === 'triangle' ? 0.5 : 1;
  next.edges = next.edges.map((edge, e) =>
    edge.map((n, i) => {
      const start = i === 0,
        finish = i === edge.length - 1,
        x = start
          ? 0
          : finish
            ? end
            : Math.max(edge[i - 1].x + 0.005, Math.min(edge[i + 1].x - 0.005, n.x)),
        limit = edgeOffsetLimit(next, e, x),
        y = start || finish ? 0 : Math.max(-limit, Math.min(limit, n.y));
      const control = (p: Point, incoming: boolean) => {
        const lo = incoming ? (edge[i - 1]?.x ?? 0) : x,
          hi = incoming ? x : (edge[i + 1]?.x ?? end),
          cx = Math.max(lo, Math.min(hi, x + p.x)),
          cl = edgeOffsetLimit(next, e, cx),
          cy = Math.max(-cl, Math.min(cl, y + p.y));
        return { x: cx - x, y: cy - y };
      };
      return { x, y, in: control(n.in, true), out: control(n.out, false) };
    }),
  );
  return next;
}
export function tileBounds(t: TilingDefinition): Bounds {
  const p = tileBoundary(t),
    points = p.nodes.flatMap((n) => [
      n,
      { x: n.x + n.in.x, y: n.y + n.in.y },
      { x: n.x + n.out.x, y: n.y + n.out.y },
    ]);
  const xs = points.map((q) => q.x),
    ys = points.map((q) => q.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
export function tileInstances(t: TilingDefinition, view: Bounds, limit = 12000): TileInstance[] {
  return tileOperations(t, view, tileBounds(t), limit);
}
export function tileOperations(
  t: TilingDefinition,
  view: Bounds,
  contentBounds: Bounds,
  limit = 12000,
): TileInstance[] {
  if (t.kind === 'isohedral') {
    const frame = tileFrame(t),
      inv = inverse(frame),
      points = [
        { x: view.x, y: view.y },
        { x: view.x + view.width, y: view.y },
        { x: view.x + view.width, y: view.y + view.height },
        { x: view.x, y: view.y + view.height },
      ].map((p) => apply(inv, p)),
      x = Math.min(...points.map((p) => p.x)),
      y = Math.min(...points.map((p) => p.y)),
      local = {
        x,
        y,
        width: Math.max(...points.map((p) => p.x)) - x,
        height: Math.max(...points.map((p) => p.y)) - y,
      };
    return isohedralInstances(isohedralDefinition(t), t.width, local, contentBounds, limit).map(
      (item) => ({ ...item, matrix: multiply(frame, item.matrix) }),
    );
  }
  const frame = tileFrame(t),
    invFrame = inverse(frame),
    basis = tileBasis(t),
    invBasis = inverse(basis),
    corners = (b: Bounds) => [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x, y: b.y + b.height },
      { x: b.x + b.width, y: b.y + b.height },
    ],
    extent = (points: Point[]) => ({
      minX: Math.min(...points.map((p) => p.x)),
      minY: Math.min(...points.map((p) => p.y)),
      maxX: Math.max(...points.map((p) => p.x)),
      maxY: Math.max(...points.map((p) => p.y)),
    }),
    viewport = extent(corners(view).map((p) => apply(invBasis, apply(invFrame, p)))),
    bounds = contentBounds,
    b = tileBasis(t),
    ops: Matrix[] =
      t.kind === 'triangle' ? [IDENTITY, [-1, 0, 0, -1, b[0] + b[2], b[1] + b[3]]] : [IDENTITY],
    out: TileInstance[] = [];
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k],
      content = extent(corners(bounds).map((p) => apply(invBasis, apply(op, p)))),
      x0 = Math.ceil(viewport.minX - content.maxX),
      x1 = Math.floor(viewport.maxX - content.minX),
      y0 = Math.ceil(viewport.minY - content.maxY),
      y1 = Math.floor(viewport.maxY - content.minY);
    if (out.length + (x1 - x0 + 1) * (y1 - y0 + 1) > limit)
      throw Error('Demasiadas teselas visibles. Acercá el zoom o aumentá su tamaño.');
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const p = apply(basis, { x, y });
        out.push({
          id: `tile-${x}:${y}:${k}`,
          matrix: multiply(frame, multiply(translate(p.x, p.y), op)),
          cell: [x, y],
          orientation: k,
        });
      }
  }
  return out;
}
export function tileRectangularCell(t: TilingDefinition): { width: number; height: number } | null {
  if (t.kind === 'isohedral') return null;
  if (Math.abs(t.rotation / 90 - Math.round(t.rotation / 90)) > 1e-7) return null;
  let cell: { width: number; height: number } | null;
  if (t.kind === 'triangle') cell = { width: t.width, height: t.width * Math.sqrt(3) };
  else if (t.kind === 'hexagon')
    cell = { width: t.width * 1.5, height: (t.width * Math.sqrt(3)) / 2 };
  else if (t.kind === 'parallelogram' && Math.abs(t.shear) > 1e-8) cell = null;
  else cell = { width: t.width, height: t.kind === 'square' ? t.width : t.height };
  if (!cell) return null;
  return Math.abs(Math.round(t.rotation / 90)) % 2
    ? { width: cell.height, height: cell.width }
    : cell;
}

export function tileWorldBounds(t: TilingDefinition): Bounds {
  const b = tileBounds(t),
    frame = tileFrame(t),
    points = [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
    ].map((p) => apply(frame, p));
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
/** The same translation cell is used for clipping, the visible frame and its camera. */
export function tileCellCorners(t: TilingDefinition): Point[] {
  const b = tileBasis(t),
    frame = tileFrame(t);
  return [
    { x: 0, y: 0 },
    { x: b[0], y: b[1] },
    { x: b[0] + b[2], y: b[1] + b[3] },
    { x: b[2], y: b[3] },
  ].map((p) => apply(frame, p));
}
export function tileCellBounds(t: TilingDefinition): Bounds {
  const points = tileCellCorners(t),
    x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x,
    height: Math.max(...points.map((p) => p.y)) - y,
  };
}

/** Open boundary curves, deduplicated irrespective of traversal direction. */
export function tileContours(def: TilingDefinition, tiles: TileInstance[]): Geometry[] {
  const edges = tileEdges(def),
    unique = new Map<string, Geometry>();
  const signature = (nodes: Node[]) =>
    nodes
      .map((n, i) =>
        [
          n.x,
          n.y,
          i ? n.in.x : 0,
          i ? n.in.y : 0,
          i === nodes.length - 1 ? 0 : n.out.x,
          i === nodes.length - 1 ? 0 : n.out.y,
        ]
          .map((v) => Math.round(v * 1e7))
          .join(','),
      )
      .join(';');
  for (const tile of tiles)
    for (let e = 0; e < edges.length; e++) {
      const nodes = transformNodes(edges[e], tile.matrix),
        id = [signature(nodes), signature(transformNodes(nodes, IDENTITY, true))].sort()[0];
      if (!unique.has(id))
        unique.set(id, {
          ...geometry('path', nodes),
          id: `tile-contour-${unique.size}`,
          name: 'Contorno de tesela',
          fill: 'none',
          stroke: '#738c7a',
          strokeWidth: 0.25,
        });
    }
  return [...unique.values()];
}
