import type { TilingDefinition } from './tiles';
import {
  constrainTiling,
  tileBoundary,
  tileArea,
  tileBounds,
  tileInstances,
  isohedralDefinition,
} from './tiles';
import { isohedralIssue } from '../isohedral/validate';
import { paperPath } from '../geometry/paper';
import { IDENTITY } from '../geometry/matrix';
/** Conservative editable corridors + exact edge construction + independent area/adjacency checks. */
export function tilingIssue(def: TilingDefinition): string | null {
  if (def.kind === 'isohedral') {
    if (!def.isohedral) return 'Falta la definición isoédrica.';
    return isohedralIssue(isohedralDefinition(def), def.width);
  }
  if (def.isohedral) return 'Una tesela clásica no puede declarar un tipo IH.';
  const expected = def.kind === 'triangle' || def.kind === 'hexagon' ? 3 : 2;
  if (def.edges.length !== expected || def.edges.some((e) => e.length < 3 || e.length > 16))
    return 'La familia requiere sus bordes maestros y entre 3 y 16 nodos por borde.';
  const constrained = constrainTiling(def);
  for (let e = 0; e < def.edges.length; e++)
    for (let i = 0; i < def.edges[e].length; i++) {
      const a = def.edges[e][i],
        b = constrained.edges[e][i];
      for (const [x, y] of [
        [a.x, b.x],
        [a.y, b.y],
        [a.in.x, b.in.x],
        [a.in.y, b.in.y],
        [a.out.x, b.out.x],
        [a.out.y, b.out.y],
      ])
        if (!Number.isFinite(x) || Math.abs(x - y) > 1e-9)
          return 'El borde excede el corredor que garantiza el encastre o altera un vértice estructural.';
    }
  const local = { ...def, origin: { x: 0, y: 0 }, rotation: 0 },
    shape = tileBoundary(local),
    path = paperPath(shape),
    tolerance = Math.max(1e-7, tileArea(local) * 1e-9);
  try {
    if (path.getCrossings(path).length) return 'El borde genera una autointersección.';
    if (Math.abs(Math.abs((path as paper.CompoundPath).area) - tileArea(local)) > tolerance)
      return 'La edición no conserva el área de esta construcción teselable.';
    for (const instance of tileInstances(local, tileBounds(local))) {
      if (instance.matrix.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-8)) continue;
      const neighbor = paperPath(shape, instance.matrix);
      try {
        if (!path.bounds.intersects(neighbor.bounds)) continue;
        const overlap = path.intersect(neighbor, { insert: false });
        const area = Math.abs((overlap as paper.CompoundPath).area);
        overlap.remove();
        if (area > tolerance) return 'La edición produce solapamiento con una tesela vecina.';
      } finally {
        neighbor.remove();
      }
    }
  } finally {
    path.remove();
  }
  return null;
}
