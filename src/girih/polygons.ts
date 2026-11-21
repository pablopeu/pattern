import type { Point } from '../geometry/matrix';
export const GIRIH_EPS = 1e-8;
export type GirihKind = 'decagon' | 'pentagon' | 'hexagon' | 'bowtie' | 'rhombus';
export const girihNames: Record<GirihKind, string> = {
  decagon: 'Decágono',
  pentagon: 'Pentágono',
  hexagon: 'Hexágono alargado',
  bowtie: 'Corbatín',
  rhombus: 'Rombo72°',
};
export const girihAngles: Record<GirihKind, number[]> = {
  decagon: Array(10).fill(144),
  pentagon: Array(5).fill(108),
  hexagon: [72, 144, 144, 72, 144, 144],
  bowtie: [72, 72, 216, 72, 72, 216],
  rhombus: [72, 108, 72, 108],
};
export const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function polygonArea(points: Point[]) {
  return points.reduce((sum, p, i) => sum + cross(p, points[(i + 1) % points.length]), 0) / 2;
}
const polygons = new Map<GirihKind, Point[]>();
/** Unit-edge, counterclockwise mathematical prototypes. No image coordinates. */
export function girihPolygon(kind: GirihKind): Point[] {
  const cached = polygons.get(kind);
  if (cached) return cached;
  const angles = girihAngles[kind];
  let p = { x: 0, y: 0 },
    direction = 0;
  const vertices: Point[] = [];
  for (let i = 0; i < angles.length; i++) {
    vertices.push(p);
    p = { x: p.x + Math.cos(direction), y: p.y + Math.sin(direction) };
    direction += ((180 - angles[(i + 1) % angles.length]) * Math.PI) / 180;
  }
  if (Math.hypot(p.x, p.y) > 1e-7) throw Error('El prototipo Girih no cierra.');
  const center = {
    x: vertices.reduce((s, p) => s + p.x, 0) / vertices.length,
    y: vertices.reduce((s, p) => s + p.y, 0) / vertices.length,
  };
  const points = vertices.map((p) => sub(p, center));
  polygons.set(kind, points);
  return points;
}
export function pointInside(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j],
      b = polygon[i],
      ab = sub(b, a),
      ap = sub(p, a);
    if (
      Math.abs(cross(ab, ap)) < GIRIH_EPS &&
      ap.x * ab.x + ap.y * ab.y >= -GIRIH_EPS &&
      ap.x * ab.x + ap.y * ab.y <= ab.x * ab.x + ab.y * ab.y + GIRIH_EPS
    )
      return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function lineMeet(a: Point, u: Point, b: Point, v: Point) {
  const det = cross(u, v);
  if (Math.abs(det) < GIRIH_EPS) return null;
  const delta = sub(b, a);
  const t = cross(delta, v) / det,
    s = cross(delta, u) / det;
  return { t, s, point: { x: a.x + u.x * t, y: a.y + u.y * t } };
}
/** Split at every boundary intersection, then check each open interval exactly. */
export function segmentInside(a: Point, b: Point, polygon: Point[]) {
  const u = sub(b, a),
    cuts = [0, 1];
  for (let i = 0; i < polygon.length; i++) {
    const hit = lineMeet(a, u, polygon[i], sub(polygon[(i + 1) % polygon.length], polygon[i]));
    if (
      hit &&
      hit.t > GIRIH_EPS &&
      hit.t < 1 - GIRIH_EPS &&
      hit.s >= -GIRIH_EPS &&
      hit.s <= 1 + GIRIH_EPS
    )
      cuts.push(hit.t);
  }
  cuts.sort((a, b) => a - b);
  return cuts.slice(1).every((t, i) => pointInside(lerp(a, b, (t + cuts[i]) / 2), polygon));
}
export const polygonPath = (p: Point[]) =>
  p.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('') + 'Z';
