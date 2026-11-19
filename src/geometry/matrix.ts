export type Point = { x: number; y: number };
/** SVG affine coefficients: x'=a*x+c*y+e, y'=b*x+d*y+f. */
export type Matrix = readonly [number, number, number, number, number, number];
export const EPS = 1e-8;
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function apply(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}
export function inverse(m: Matrix): Matrix {
  const d = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(d) < EPS) throw new Error('La transformación no es invertible.');
  return [
    m[3] / d,
    -m[1] / d,
    -m[2] / d,
    m[0] / d,
    (m[2] * m[5] - m[3] * m[4]) / d,
    (m[1] * m[4] - m[0] * m[5]) / d,
  ];
}
export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scale = (x: number, y = x): Matrix => [x, 0, 0, y, 0, 0];
export function rotate(degrees: number, center: Point = { x: 0, y: 0 }): Matrix {
  const a = (degrees * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return multiply(
    translate(center.x, center.y),
    multiply([c, s, -s, c, 0, 0], translate(-center.x, -center.y)),
  );
}
export function reflect(angle: number, origin: Point = { x: 0, y: 0 }): Matrix {
  return multiply(
    translate(origin.x, origin.y),
    multiply(
      rotate(angle),
      multiply(scale(1, -1), multiply(rotate(-angle), translate(-origin.x, -origin.y))),
    ),
  );
}
export function matrixString(m: Matrix): string {
  return `matrix(${m.join(' ')})`;
}
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const unitFactor = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96 };
export type Unit = keyof typeof unitFactor;
export const fromMM = (value: number, unit: Unit) => value / unitFactor[unit];
export const toMM = (value: number, unit: Unit) => value * unitFactor[unit];
