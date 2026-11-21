import { geometry, node, type Node } from '../app/model';
import {
  apply,
  inverse,
  multiply,
  scale,
  translate,
  type Matrix,
  type Point,
} from '../geometry/matrix';
import {
  IsohedralTiling,
  EdgeShape,
  tilingTypes,
  type TactileMatrix,
} from '../vendor/tactile/tactile';
import type { Bounds } from '../symmetry/groups';
import type { EdgeConstraint, IsohedralDefinition } from './model';

export const supportedIsohedralTypes: readonly number[] = Object.freeze([...tilingTypes]);
export const markedIsohedralTypes: readonly number[] = Object.freeze(
  Array.from({ length: 93 }, (_, i) => i + 1).filter((id) => !supportedIsohedralTypes.includes(id)),
);
const constraint = (shape: number): EdgeConstraint =>
  shape === EdgeShape.I
    ? 'straight'
    : shape === EdgeShape.S
      ? 'halfturn'
      : shape === EdgeShape.U
        ? 'mirror'
        : 'free';
/** Upstream stores two matrix rows; all application consumers use SVG column order. */
export const tactileMatrix = (m: TactileMatrix): Matrix => [m[0], m[3], m[1], m[4], m[2], m[5]];

function tiling(def: IsohedralDefinition): IsohedralTiling {
  if (def.version !== 1 || !supportedIsohedralTypes.includes(def.type))
    throw Error(`IH${def.type} no está implementado en este motor; no se sustituye por otro tipo.`);
  const t = new IsohedralTiling(def.type);
  if (
    def.parameters.length !== t.numParameters() ||
    def.parameters.some((n) => !Number.isFinite(n) || Math.abs(n) > 4)
  )
    throw Error('Parámetros isoédricos inválidos.');
  t.setParameters(def.parameters);
  if (def.edges.length !== t.numEdgeShapes())
    throw Error('La definición requiere sus bordes canónicos.');
  return t;
}
export function newIsohedral(type: number): IsohedralDefinition {
  if (!supportedIsohedralTypes.includes(type)) throw Error(`IH${type} no implementado.`);
  const t = new IsohedralTiling(type);
  return {
    version: 1,
    type,
    parameters: t.getParameters(),
    edges: Array.from({ length: t.numEdgeShapes() }, () => [node(0, 0), node(0.5, 0), node(1, 0)]),
  };
}
export function isohedralConstraints(def: IsohedralDefinition): EdgeConstraint[] {
  const t = tiling(def);
  return def.edges.map((_, i) => constraint(t.getEdgeShape(i)));
}
function mapNodes(nodes: Node[], m: Matrix, reverse: boolean): Node[] {
  const vector = (p: Point) => ({ x: m[0] * p.x + m[2] * p.y, y: m[1] * p.x + m[3] * p.y });
  return (reverse ? [...nodes].reverse() : nodes).map((n) => ({
    ...apply(m, n),
    in: vector(reverse ? n.out : n.in),
    out: vector(reverse ? n.in : n.out),
  }));
}
export function isohedralLayout(def: IsohedralDefinition, size = 60) {
  if (!Number.isFinite(size) || size < 1 || size > 1000) throw Error('Escala de tesela inválida.');
  const t = tiling(def),
    toMm = scale(size),
    fromMm = scale(1 / size),
    t1 = t.getT1(),
    t2 = t.getT2(),
    basis: Matrix = [size * t1.x, size * t1.y, size * t2.x, size * t2.y, 0, 0],
    parts = [...t.parts()].map((p, index) => ({
      id: `IH${def.type}/part-${index}`,
      master: p.id,
      constraint: constraint(p.shape),
      matrix: multiply(toMm, tactileMatrix(p.T)),
      reverse: p.rev,
      second: p.second,
    })),
    edges = parts.map((p) => mapNodes(def.edges[p.master], p.matrix, p.reverse)),
    nodes: Node[] = [];
  for (const [i, raw] of edges.entries()) {
    if (raw.length < 2) throw Error('Borde isoédrico incompleto.');
    const edge = structuredClone(raw),
      previous = edges[(i + edges.length - 1) % edges.length].at(-1)!;
    if (Math.hypot(edge[0].x - previous.x, edge[0].y - previous.y) > 1e-7 * size)
      throw Error('Los bordes relacionados no cierran en sus vértices.');
    edge[0].in = { ...previous.in };
    nodes.push(...edge.slice(0, -1));
  }
  const boundary = {
      ...geometry('path', nodes, true),
      id: 'isohedral-boundary',
      name: `Silueta IH${def.type}`,
      fill: 'none',
      stroke: '#6d8977',
      strokeWidth: 0.25,
    },
    aspects = Array.from({ length: t.numAspects() }, (_, i) =>
      multiply(toMm, multiply(tactileMatrix(t.getAspectTransform(i)), fromMm)),
    ),
    vertices = t.vertices().map((p) => apply(toMm, p));
  return { basis, parts, edges, boundary, aspects, vertices };
}
export function isohedralParameterDefaults(type: number): number[] {
  return newIsohedral(type).parameters;
}
export function nodeBounds(nodes: Node[]): Bounds {
  const points = nodes.flatMap((n) => [
      n,
      { x: n.x + n.in.x, y: n.y + n.in.y },
      { x: n.x + n.out.x, y: n.y + n.out.y },
    ]),
    x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x,
    height: Math.max(...points.map((p) => p.y)) - y,
  };
}
export function isohedralInstances(
  def: IsohedralDefinition,
  size: number,
  view: Bounds,
  contentBounds?: Bounds,
  limit = 12000,
) {
  const layout = isohedralLayout(def, size),
    inv = inverse(layout.basis),
    corners = (b: Bounds) => [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
    ],
    extent = (points: Point[]) => ({
      x0: Math.min(...points.map((p) => p.x)),
      x1: Math.max(...points.map((p) => p.x)),
      y0: Math.min(...points.map((p) => p.y)),
      y1: Math.max(...points.map((p) => p.y)),
    }),
    viewport = extent(corners(view).map((p) => apply(inv, p))),
    content = contentBounds ?? nodeBounds(layout.boundary.nodes),
    result: { id: string; matrix: Matrix; cell: [number, number]; orientation: number }[] = [];
  for (const [index, aspect] of layout.aspects.entries()) {
    const footprint = extent(corners(content).map((p) => apply(inv, apply(aspect, p)))),
      x0 = Math.ceil(viewport.x0 - footprint.x1),
      x1 = Math.floor(viewport.x1 - footprint.x0),
      y0 = Math.ceil(viewport.y0 - footprint.y1),
      y1 = Math.floor(viewport.y1 - footprint.y0),
      count = Math.max(0, x1 - x0 + 1) * Math.max(0, y1 - y0 + 1);
    if (result.length + count > limit)
      throw Error('Demasiadas teselas isoédricas; acercá el zoom o aumentá su escala.');
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const offset = apply(layout.basis, { x, y });
        result.push({
          id: `IH${def.type}/${x}:${y}:${index}`,
          matrix: multiply(translate(offset.x, offset.y), aspect),
          cell: [x, y],
          orientation: index,
        });
      }
  }
  return result;
}
