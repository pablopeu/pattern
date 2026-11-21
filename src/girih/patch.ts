import { geometry, type Geometry } from '../app/model';
import {
  IDENTITY,
  apply,
  multiply,
  translate,
  rotate,
  type Matrix,
  type Point,
} from '../geometry/matrix';
import { paperPath, scope } from '../geometry/paper';
import { girihPolygon, polygonPath, sub, cross, distance, type GirihKind } from './polygons';
export interface GirihTile {
  id: string;
  kind: GirihKind;
  matrix: Matrix;
}
export interface GirihAdjacency {
  a: number;
  edgeA: number;
  b: number;
  edgeB: number;
}
export function girihBody(kind: GirihKind): Geometry {
  return {
    ...geometry('compound', [], true),
    id: `girih-${kind}`,
    name: kind,
    pathData: polygonPath(girihPolygon(kind)),
    fill: '#e5cf9c',
    stroke: '#485b4b',
    strokeWidth: 0.015,
  };
}
export const worldPolygon = (t: GirihTile) => girihPolygon(t.kind).map((p) => apply(t.matrix, p));
export function attachGirih(
  patch: GirihTile[],
  base: number,
  edge: number,
  kind: GirihKind,
  incomingEdge = 0,
): GirihTile[] {
  const tile = patch[base];
  if (!tile) throw Error('No existe la tesela base.');
  const target = worldPolygon(tile),
    source = girihPolygon(kind);
  if (edge < 0 || edge >= target.length || incomingEdge < 0 || incomingEdge >= source.length)
    throw Error('Borde Girih desconocido.');
  const a = source[incomingEdge],
    b = source[(incomingEdge + 1) % source.length],
    p = target[(edge + 1) % target.length],
    q = target[edge],
    u = sub(b, a),
    v = sub(q, p),
    length = u.x * u.x + u.y * u.y,
    real = (u.x * v.x + u.y * v.y) / length,
    imag = cross(u, v) / length,
    matrix: Matrix = [
      real,
      imag,
      -imag,
      real,
      p.x - real * a.x + imag * a.y,
      p.y - imag * a.x - real * a.y,
    ];
  const next = [...patch, { id: `girih-tile-${patch.length}`, kind, matrix }];
  const report = validateGirihPatch(next),
    issue = report.issues[0] ?? (report.holes ? 'El parche deja huecos internos.' : undefined);
  if (issue) throw Error(issue);
  return next;
}
export function girihRosette(): GirihTile[] {
  let result: GirihTile[] = [{ id: 'girih-tile-0', kind: 'decagon', matrix: IDENTITY }];
  for (let i = 0; i < 10; i++) result = attachGirih(result, 0, i, 'pentagon');
  return result;
}
/** Five acute72° vertices meet at the center: a valid star-shaped finite patch. */
export function girihStar(): GirihTile[] {
  const p = girihPolygon('rhombus')[0];
  return Array.from({ length: 5 }, (_, i) => ({
    id: `girih-tile-${i}`,
    kind: 'rhombus',
    matrix: multiply(rotate(i * 72), translate(-p.x, -p.y)),
  }));
}
export function girihGrid(rows: number, columns: number): GirihTile[] {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < 1 ||
    columns < 1 ||
    rows * columns > 128
  )
    throw Error('Red Girih:1–128 teselas.');
  const p = girihPolygon('rhombus'),
    u = sub(p[1], p[0]),
    v = sub(p[3], p[0]);
  return Array.from({ length: rows * columns }, (_, index) => {
    const i = (index % columns) - (columns - 1) / 2,
      j = Math.floor(index / columns) - (rows - 1) / 2;
    return {
      id: `girih-tile-${index}`,
      kind: 'rhombus' as const,
      matrix: translate(u.x * i + v.x * j, u.y * i + v.y * j),
    };
  });
}
export function validateGirihPatch(tiles: GirihTile[]): {
  issues: string[];
  adjacencies: GirihAdjacency[];
  boundaryEdges: number;
  holes: number;
} {
  const issues: string[] = [],
    adjacencies: GirihAdjacency[] = [];
  if (!tiles.length || tiles.length > 128)
    return {
      issues: ['El parche requiere1–128 teselas.'],
      adjacencies,
      boundaryEdges: 0,
      holes: 0,
    };
  if (new Set(tiles.map((t) => t.id)).size !== tiles.length) issues.push('IDs Girih repetidos.');
  if (
    tiles.some(
      (t) =>
        t.matrix.some((n) => !Number.isFinite(n)) ||
        Math.abs(t.matrix[0] * t.matrix[3] - t.matrix[1] * t.matrix[2] - 1) > 1e-7 ||
        Math.abs(Math.hypot(t.matrix[0], t.matrix[1]) - 1) > 1e-7 ||
        Math.abs(t.matrix[0] * t.matrix[2] + t.matrix[1] * t.matrix[3]) > 1e-7,
    )
  )
    return {
      issues: ['La colocación Girih debe ser una isometría directa.'],
      adjacencies,
      boundaryEdges: 0,
      holes: 0,
    };
  const polygons = tiles.map(worldPolygon),
    edgeCount = polygons.reduce((n, p) => n + p.length, 0),
    paths = tiles.map((t) => paperPath(girihBody(t.kind), t.matrix));
  let union: paper.PathItem | undefined,
    holes = 0;
  try {
    for (let i = 0; i < tiles.length; i++) {
      const m = tiles[i].matrix;
      if (
        Math.abs(m[0] * m[3] - m[1] * m[2] - 1) > 1e-7 ||
        Math.abs(m[0] * m[2] + m[1] * m[3]) > 1e-7 ||
        Math.abs(Math.hypot(m[0], m[1]) - 1) > 1e-7
      )
        issues.push('La colocación Girih debe ser una isometría directa.');
      for (let j = 0; j < i; j++) {
        const a = paths[i].bounds,
          b = paths[j].bounds;
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1e-8 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1e-8
        ) {
          const overlap = paths[i].intersect(paths[j], { insert: false });
          if (Math.abs((overlap as paper.CompoundPath).area) > 1e-7)
            issues.push('Las teselas se superponen.');
          overlap.remove();
        }
        for (let ei = 0; ei < polygons[i].length; ei++)
          for (let ej = 0; ej < polygons[j].length; ej++) {
            const p = polygons[i][ei],
              q = polygons[i][(ei + 1) % polygons[i].length],
              r = polygons[j][ej],
              s = polygons[j][(ej + 1) % polygons[j].length];
            if (distance(p, s) < 1e-7 && distance(q, r) < 1e-7)
              adjacencies.push({ a: i, edgeA: ei, b: j, edgeB: ej });
            else if (
              Math.abs(cross(sub(q, p), sub(r, p))) < 1e-8 &&
              Math.abs(cross(sub(q, p), sub(s, p))) < 1e-8
            ) {
              const u = sub(q, p),
                t = (v: Point) => (sub(v, p).x * u.x + sub(v, p).y * u.y) / (u.x * u.x + u.y * u.y),
                a = t(r),
                b = t(s),
                overlap = Math.min(1, Math.max(a, b)) - Math.max(0, Math.min(a, b));
              if (overlap > 1e-7) issues.push('Las aristas compartidas deben coincidir completas.');
            }
          }
      }
      if (!union) union = paths[i].clone({ insert: false });
      else {
        const old = union;
        union = old.unite(paths[i], { insert: false });
        old.remove();
      }
    }
    const connected = new Set([0]);
    for (let n = 0; n < tiles.length; n++)
      for (const a of adjacencies) {
        if (connected.has(a.a)) connected.add(a.b);
        if (connected.has(a.b)) connected.add(a.a);
      }
    if (connected.size !== tiles.length)
      issues.push('El parche debe conectar todas sus teselas por bordes.');
    const children = union instanceof scope.CompoundPath ? union.children : [union!],
      sign = Math.sign((union as paper.CompoundPath).area);
    holes = children.filter(
      (p) => Math.abs((p as paper.Path).area) > 1e-8 && Math.sign((p as paper.Path).area) !== sign,
    ).length;
  } finally {
    paths.forEach((p) => p.remove());
    union?.remove();
  }
  return {
    issues: [...new Set(issues)],
    adjacencies,
    boundaryEdges: edgeCount - 2 * adjacencies.length,
    holes,
  };
}
export const transformGirih = (tiles: GirihTile[], matrix: Matrix) =>
  tiles.map((t) => ({ ...t, matrix: multiply(matrix, t.matrix) }));
