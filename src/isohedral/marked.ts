import data from './marked-data.json';
import { node } from '../app/model';
import { apply, inverse, multiply, scale, type Matrix } from '../geometry/matrix';
import type { IsohedralDefinition, IsohedralLayout, IsohedralPart } from './model';
import { boundaryFromEdges, mapCanonicalNodes } from './edit';

/** Own mirror-cell constructions for the12 marked types, not aliases of unmarked IH. */
const matrix = (m: number[]): Matrix => {
  if (m.length !== 6 || m.some((n) => !Number.isFinite(n)))
    throw Error('Matriz de catálogo corrupta.');
  return [m[0], m[1], m[2], m[3], m[4], m[5]];
};
export const markedDefinitions = data.map((row) => ({
  ...row,
  basis: matrix(row.basis),
  aspects: row.aspects.map(matrix),
  stabilizer: row.stabilizer.map(matrix),
}));
export const markedTypes = Object.freeze(markedDefinitions.map((row) => row.type));
export function newMarkedIsohedral(type: number): IsohedralDefinition {
  const row = markedDefinitions.find((r) => r.type === type);
  if (!row) throw Error(`IH${type} no implementado.`);
  return {
    version: 1,
    type,
    parameters: row.rectangle ? [1.2] : [],
    edges: Array.from({ length: Math.max(...row.masters) + 1 }, () => [
      node(0, 0),
      node(0.5, 0),
      node(1, 0),
    ]),
  };
}
export function markedLayout(def: IsohedralDefinition, size: number): IsohedralLayout {
  const row = markedDefinitions.find((r) => r.type === def.type);
  if (!row || def.version !== 1) throw Error('Tipo marcado no compatible.');
  if (
    def.parameters.length !== (row.rectangle ? 1 : 0) ||
    def.parameters.some((n) => !Number.isFinite(n) || n <= 0 || n > 4)
  )
    throw Error('Parámetros de la construcción marcada inválidos.');
  if (def.edges.length !== Math.max(...row.masters) + 1)
    throw Error('Faltan los bordes maestros del tipo marcado.');
  const toMm = scale(size, size * (row.rectangle ? def.parameters[0] / 1.2 : 1)),
    fromMm = inverse(toMm),
    vertices = row.vertices.map((v) => apply(toMm, v)),
    parts: IsohedralPart[] = vertices.map((p, i) => {
      const q = vertices[(i + 1) % vertices.length],
        dx = q.x - p.x,
        dy = q.y - p.y;
      return {
        id: `IH${def.type}/part-${i}`,
        master: row.masters[i],
        constraint: 'straight',
        matrix: [dx, dy, -dy, dx, p.x, p.y],
        reverse: false,
        second: false,
      };
    }),
    edges = parts.map((p) => mapCanonicalNodes(def.edges[p.master], p.matrix));
  return {
    vertices,
    parts,
    edges,
    boundary: boundaryFromEdges(edges, `Silueta IH${def.type}`, size * 1e-7),
    basis: multiply(toMm, row.basis),
    aspects: row.aspects.map((m) => multiply(toMm, multiply(m, fromMm))),
    motifSymmetries: row.stabilizer.map((m) => multiply(toMm, multiply(m, fromMm))),
    marked: true,
  };
}
