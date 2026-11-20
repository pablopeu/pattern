import { IDENTITY, multiply, rotate, scale, translate, type Matrix } from '../geometry/matrix';
import type { CompositionNode, Operator } from './model';

export const motif = (level = 0): CompositionNode => ({
  operator: 'motif',
  matrix: IDENTITY,
  level,
  source: 'motif',
  children: [],
});
export function transform(
  operator: Operator,
  matrix: Matrix,
  child: CompositionNode,
): CompositionNode {
  return { operator, matrix, level: child.level, children: [child] };
}
export const turn = (child: CompositionNode, angle = 90) =>
  transform('rotate', rotate(angle, { x: 0.5, y: 0.5 }), child);
export const flip = (child: CompositionNode) =>
  transform('flip', multiply(translate(1, 0), scale(-1, 1)), child);
export const scaled = (child: CompositionNode, x: number, y = x) =>
  transform('scale', scale(x, y), child);
export const shifted = (child: CompositionNode, x: number, y: number) =>
  transform('translate', translate(x, y), child);
export const over = (...children: CompositionNode[]): CompositionNode => ({
  operator: 'over',
  matrix: IDENTITY,
  level: 0,
  children,
});
export function beside(
  left: CompositionNode,
  right: CompositionNode,
  ratio = 0.5,
): CompositionNode {
  return {
    ...over(scaled(left, ratio, 1), shifted(scaled(right, 1 - ratio, 1), ratio, 0)),
    operator: 'beside',
  };
}
export function above(top: CompositionNode, bottom: CompositionNode, ratio = 0.5): CompositionNode {
  return {
    ...over(scaled(top, 1, ratio), shifted(scaled(bottom, 1, 1 - ratio), 0, ratio)),
    operator: 'above',
  };
}
export function quartet(
  a: CompositionNode,
  b: CompositionNode,
  c: CompositionNode,
  d: CompositionNode,
  ratio = 0.5,
): CompositionNode {
  return { ...above(beside(a, b, ratio), beside(c, d, ratio), ratio), operator: 'quartet' };
}
export const cycle = (child: CompositionNode): CompositionNode => ({
  ...quartet(child, turn(child), turn(child, 270), turn(child, 180)),
  operator: 'cycle',
});
/** Squaring avoids drift from incrementally updating a camera/frame transform. */
export function affinePower(matrix: Matrix, exponent: number): Matrix {
  if (!Number.isInteger(exponent) || exponent < 0) throw Error('Exponente afín inválido.');
  let result = IDENTITY,
    power = matrix,
    remaining = exponent;
  while (remaining) {
    if (remaining % 2) result = multiply(result, power);
    remaining = Math.floor(remaining / 2);
    if (remaining) power = multiply(power, power);
  }
  return result;
}
