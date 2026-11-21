import type { IsohedralDefinition } from './model';
import {
  isohedralConstraints,
  isohedralInstances,
  isohedralLayout,
  nodeBounds,
  newIsohedral,
} from './engine';
import { paperPath } from '../geometry/paper';
import { IDENTITY } from '../geometry/matrix';

/** Exact construction plus independent Bézier area, crossing and neighbour checks. */
export function isohedralIssue(def: IsohedralDefinition, size = 60): string | null {
  try {
    const constraints = isohedralConstraints(def);
    for (const [i, edge] of def.edges.entries()) {
      if (edge.length < 2 || edge.length > 32) return 'Cada borde admite entre2 y32 nodos.';
      for (const n of edge)
        if (
          ![n.x, n.y, n.in.x, n.in.y, n.out.x, n.out.y].every(Number.isFinite) ||
          Math.abs(n.x) > 4 ||
          Math.abs(n.y) > 4 ||
          Math.max(Math.abs(n.in.x), Math.abs(n.in.y), Math.abs(n.out.x), Math.abs(n.out.y)) > 4
        )
          return 'El borde excede el rango numérico editable.';
      const a = edge[0],
        b = edge.at(-1)!;
      if (
        Math.abs(a.x) > 1e-9 ||
        Math.abs(a.y) > 1e-9 ||
        Math.abs(b.x - 1) > 1e-9 ||
        (constraints[i] !== 'mirror' && Math.abs(b.y) > 1e-9)
      )
        return 'No se pueden separar los vértices estructurales.';
      if (
        constraints[i] === 'straight' &&
        edge.some((n) => Math.abs(n.y) + Math.abs(n.in.y) + Math.abs(n.out.y) > 1e-9)
      )
        return 'Este borde es un eje de espejo: debe conservarse recto.';
    }
    const layout = isohedralLayout(def, size),
      path = paperPath(layout.boundary),
      expected =
        Math.abs(layout.basis[0] * layout.basis[3] - layout.basis[1] * layout.basis[2]) /
        layout.aspects.length,
      tolerance = Math.max(1e-7, expected * 1e-8);
    try {
      if (!Number.isFinite(expected) || expected < 1e-5) return 'La red isoédrica es degenerada.';
      if (path.getCrossings(path).length)
        return 'La silueta se autointerseca; se conserva la última edición válida.';
      const signed = (path as paper.CompoundPath).area,
        vertices = isohedralLayout(newIsohedral(def.type), size).vertices,
        orientation = Math.sign(
          vertices.reduce(
            (sum, p, i) =>
              sum +
              p.x * vertices[(i + 1) % vertices.length].y -
              p.y * vertices[(i + 1) % vertices.length].x,
            0,
          ),
        ),
        area = Math.abs(signed);
      if (signed * orientation <= tolerance)
        return 'La edición invierte la orientación de la tesela.';
      if (area < tolerance || Math.abs(area - expected) > tolerance)
        return 'La silueta no conserva el área requerida por su red.';
      const b = nodeBounds(layout.boundary.nodes);
      for (const item of isohedralInstances(def, size, b)) {
        if (item.matrix.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-7)) continue;
        const neighbor = paperPath(layout.boundary, item.matrix);
        try {
          if (!path.bounds.intersects(neighbor.bounds)) continue;
          const overlap = path.intersect(neighbor, { insert: false });
          const overlapArea = Math.abs((overlap as paper.CompoundPath).area);
          overlap.remove();
          if (overlapArea > tolerance) return 'La silueta se superpone con una tesela vecina.';
        } finally {
          neighbor.remove();
        }
      }
      // Periodic density=1 and disjoint interiors imply full coverage (no positive-area gaps).
    } finally {
      path.remove();
    }
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
