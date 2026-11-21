import * as iso from '../vendor/poincare/iso';
import { makeTiling, type Tiling } from '../vendor/poincare/tiling';
import { geodesicPath, type GeodesicPath } from '../vendor/poincare/geometry';
import type { Point, Matrix } from '../geometry/matrix';
export interface HyperbolicCell {
  id: string;
  frame: iso.Iso;
  center: Point;
  vertices: Point[];
  depth: number;
  neighbors: (string | null)[];
}
export interface HyperbolicPatch {
  p: number;
  q: number;
  root: Point[];
  cells: HyperbolicCell[];
  inradius: number;
  circumradius: number;
  area: number;
  limited: { depth: boolean; budget: boolean; numeric: number };
}
export interface HyperbolicOptions {
  depth: number;
  maxCells: number;
  radius: number;
}
const defaults: HyperbolicOptions = { depth: 6, maxCells: 1024, radius: 0.97 };
export function validPQ(p: number, q: number) {
  return (
    Number.isInteger(p) &&
    Number.isInteger(q) &&
    p >= 3 &&
    q >= 3 &&
    p <= 12 &&
    q <= 12 &&
    (p - 2) * (q - 2) > 4
  );
}
export function diskPoint(frame: iso.Iso, p: Point): Point {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.hypot(p.x, p.y) >= 1)
    throw Error('El punto debe estar dentro del disco.');
  const [x, y] = iso.apply(frame, p.x, p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw Error('Isometría fuera del rango numérico.');
  return { x, y };
}
const norm = (p: Point) => Math.hypot(p.x, p.y),
  key = (p: Point) => `${Math.round(p.x * 1e8)},${Math.round(p.y * 1e8)}`;
const angle = (v: number) =>
  ((((v + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
export function diskGeodesic(a: Point, b: Point): GeodesicPath {
  return geodesicPath(a.x, a.y, b.x, b.y);
}
function arcMinimum(a: Point, b: Point) {
  const g = diskGeodesic(a, b);
  if (g.kind === 'line') {
    const u = { x: b.x - a.x, y: b.y - a.y },
      t = Math.max(0, Math.min(1, -(a.x * u.x + a.y * u.y) / (u.x * u.x + u.y * u.y || 1)));
    return Math.hypot(a.x + t * u.x, a.y + t * u.y);
  }
  const delta = angle(g.end - g.start),
    d = angle(Math.atan2(-g.cy, -g.cx) - g.start);
  return (delta >= 0 ? d >= -1e-10 && d <= delta + 1e-10 : d <= 1e-10 && d >= delta - 1e-10)
    ? Math.min(norm(a), norm(b), 1 / (Math.hypot(g.cx, g.cy) + g.r))
    : Math.min(norm(a), norm(b));
}
function inRoot(t: Tiling, p: Point) {
  if (norm(p) >= 1) return false;
  for (let i = 0; i < t.p; i++) {
    const a = (2 * Math.PI * i) / t.p;
    if (
      1 + p.x * p.x + p.y * p.y - 2 * t.circle.c * (Math.cos(a) * p.x + Math.sin(a) * p.y) <
      -1e-9
    )
      return false;
  }
  return true;
}
function minimumRadius(t: Tiling, frame: iso.Iso, vertices: Point[]) {
  if (inRoot(t, diskPoint(iso.inverse(frame), { x: 0, y: 0 }))) return 0;
  return Math.min(...vertices.map((p, i) => arcMinimum(p, vertices[(i + 1) % vertices.length])));
}
/** One direct frame per polygon, independent of reflection word and traversal/camera order. */
function canonicalFrame(center: Point, vertices: Point[], p: number) {
  const move = iso.translation(center.x, center.y),
    v = diskPoint(iso.inverse(move), vertices[0]),
    period = (2 * Math.PI) / p;
  let phase = (((Math.atan2(v.y, v.x) + Math.PI / p) % period) + period) % period;
  if (phase < 1e-9 || period - phase < 1e-9) phase = 0;
  return iso.compose(move, iso.rotation(phase));
}
/** Finite exact-model patch. Limits are reported; no claim of covering the infinite disk. */
export function regularHyperbolicPatch(
  p: number,
  q: number,
  options: Partial<HyperbolicOptions> = {},
): HyperbolicPatch {
  if (!validPQ(p, q)) throw Error('Poincaré: p/q enteros3–12 y (p−2)(q−2)>4.');
  const o = { ...defaults, ...options };
  if (
    !Number.isInteger(o.depth) ||
    o.depth < 0 ||
    o.depth > 8 ||
    !Number.isInteger(o.maxCells) ||
    o.maxCells < 1 ||
    o.maxCells > 4096 ||
    !Number.isFinite(o.radius) ||
    o.radius <= 0 ||
    o.radius > 0.995
  )
    throw Error('Límites de parche hiperbólico inválidos.');
  const t = makeTiling(p, q),
    r = Math.hypot(...t.vertex),
    root = Array.from({ length: p }, (_, i) => ({
      x: r * Math.cos(((2 * i - 1) * Math.PI) / p),
      y: r * Math.sin(((2 * i - 1) * Math.PI) / p),
    })),
    mirrors = Array.from({ length: p }, (_, i) =>
      iso.compose(
        iso.rotation((2 * Math.PI * i) / p),
        iso.compose(t.mirrors[2], iso.rotation((-2 * Math.PI * i) / p)),
      ),
    ),
    cells: HyperbolicCell[] = [],
    seen = new Map<string, HyperbolicCell>(),
    limited = { depth: false, budget: false, numeric: 0 };
  const add = (frame: iso.Iso, depth: number) => {
    const center = diskPoint(frame, { x: 0, y: 0 }),
      id = key(center),
      old = seen.get(id);
    if (old) return old;
    let vertices = root.map((p) => diskPoint(frame, p));
    if (minimumRadius(t, frame, vertices) > o.radius + 1e-9) return null;
    if (cells.length >= o.maxCells) {
      limited.budget = true;
      return null;
    }
    frame = canonicalFrame(center, vertices, p);
    vertices = root.map((p) => diskPoint(frame, p));
    const cell = {
      id: `h-${p}-${q}/${id}`,
      center,
      frame,
      vertices,
      depth,
      neighbors: Array<string | null>(p).fill(null),
    };
    cells.push(cell);
    seen.set(id, cell);
    return cell;
  };
  add(iso.IDENTITY, 0);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.depth >= o.depth) {
      limited.depth = true;
      continue;
    }
    for (const mirror of mirrors) {
      try {
        add(iso.compose(cell.frame, mirror), cell.depth + 1);
      } catch {
        limited.numeric++;
      }
    }
    if (limited.budget) break;
  }
  // Rebuild reciprocal adjacency from actual geodesic endpoints, including cells
  // on the last BFS layer, whose words have intentionally not been expanded.
  const edges = new Map<string, { cell: HyperbolicCell; edge: number }>();
  for (const cell of cells)
    for (let e = 0; e < p; e++) {
      const a = key(cell.vertices[e]),
        b = key(cell.vertices[(e + 1) % p]),
        id = a < b ? `${a}/${b}` : `${b}/${a}`,
        previous = edges.get(id);
      if (previous) {
        cell.neighbors[e] = previous.cell.id;
        previous.cell.neighbors[previous.edge] = cell.id;
      } else edges.set(id, { cell, edge: e });
    }
  return {
    p,
    q,
    root,
    cells,
    inradius: t.mid,
    circumradius: r,
    area: Math.PI * (p - 2 - (2 * p) / q),
    limited,
  };
}
export function hyperbolicCellPath(vertices: Point[], radius = 1) {
  if (!Number.isFinite(radius) || radius <= 0) throw Error('Radio físico inválido.');
  let d = `M${vertices[0].x * radius} ${vertices[0].y * radius}`;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length],
      g = diskGeodesic(a, b);
    d +=
      g.kind === 'line'
        ? `L${b.x * radius} ${b.y * radius}`
        : `A${g.r * radius} ${g.r * radius} 0 0 ${g.ccw ? 0 : 1} ${b.x * radius} ${b.y * radius}`;
  }
  return d + 'Z';
}
/** Fits the entire control polygon in a safe disk inside the regular polygon. */
export function sourceEmbedding(
  p: number,
  q: number,
  b: { x: number; y: number; width: number; height: number },
): { matrix: Matrix; maxRadius: number } {
  if (
    !validPQ(p, q) ||
    Object.values(b).some((n) => !Number.isFinite(n)) ||
    b.width < 0 ||
    b.height < 0 ||
    Math.hypot(b.width, b.height) < 1e-9
  )
    throw Error('Marco fuente inválido.');
  const maxRadius = makeTiling(p, q).mid * 0.85,
    s = (maxRadius * 2) / Math.hypot(b.width, b.height);
  return { matrix: [s, 0, 0, s, -(b.x + b.width / 2) * s, -(b.y + b.height / 2) * s], maxRadius };
}
