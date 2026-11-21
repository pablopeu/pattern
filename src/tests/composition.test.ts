import { describe, expect, it } from 'vitest';
import {
  affinePower,
  above,
  beside,
  cycle,
  flip,
  motif,
  quartet,
  turn,
} from '../composition/functional';
import { compileComposition, compositionIssue } from '../composition/evaluate';
import { defaultComposition, type Composition, type CompositionNode } from '../composition/model';
import { apply, inverse, multiply, rotate, scale, translate } from '../geometry/matrix';
import type { Matrix } from '../geometry/matrix';

const frame = { x: -20, y: -10, width: 40, height: 20 };
const recursive = () => defaultComposition('recursive', frame);
function locations(
  node: CompositionNode,
  matrix: Matrix = [1, 0, 0, 1, 0, 0],
): { x: number; y: number }[] {
  const composed = multiply(matrix, node.matrix);
  return node.source
    ? [apply(composed, { x: 0.5, y: 0.5 })]
    : node.children.flatMap((child) => locations(child, composed));
}
describe('geometría funcional independiente', () => {
  it('beside/above/quartet cubren sus posiciones y preservan orientación declarada', () => {
    expect(locations(beside(motif(), motif()))).toEqual([
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.5 },
    ]);
    expect(locations(above(motif(), motif()))).toEqual([
      { x: 0.5, y: 0.25 },
      { x: 0.5, y: 0.75 },
    ]);
    expect(locations(quartet(motif(), motif(), motif(), motif()))).toEqual([
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.25, y: 0.75 },
      { x: 0.75, y: 0.75 },
    ]);
    expect(locations(cycle(motif()))).toHaveLength(4);
    const f = flip(motif()).matrix;
    expect(apply(f, apply(f, { x: 0.2, y: 0.3 })).x).toBeCloseTo(0.2, 12);
    const rotation = turn(motif()).matrix;
    expect(apply(affinePower(rotation, 4), { x: 0.2, y: 0.3 }).x).toBeCloseTo(0.2, 12);
  });
  it('la potencia afín respeta puntos fijos y traslaciones geométricas', () => {
    const m = multiply(
      translate(10, 20),
      multiply(rotate(30), multiply(scale(0.8), translate(-10, -20))),
    );
    for (const exponent of [0, 1, 2, 13, 200]) {
      const p = apply(affinePower(m, exponent), { x: 10, y: 20 });
      expect(p.x).toBeCloseTo(10, 10);
      expect(p.y).toBeCloseTo(20, 10);
    }
    expect(() => affinePower(m, 1.5)).toThrow();
  });
});
describe('composiciones finitas', () => {
  it('reduce el motivo hacia los bordes sin duplicar la geometría; IDs y parámetros determinísticos', () => {
    const c = recursive(),
      before = structuredClone(c),
      a = compileComposition(c),
      b = compileComposition(c);
    expect(a).toEqual(b);
    expect(c).toEqual(before);
    expect(a.periodicity).toBe('FINITE_NONPERIODIC');
    expect(a.validity).toBe('EXACT');
    const byLevel = new Map<number, number>();
    for (const leaf of a.leaves) {
      expect(leaf.matrix.every(Number.isFinite)).toBe(true);
      const determinant = Math.abs(
        leaf.matrix[0] * leaf.matrix[3] - leaf.matrix[1] * leaf.matrix[2],
      );
      byLevel.set(leaf.level, Math.sqrt(determinant));
      const p = apply(leaf.matrix, { x: 1, y: 2 }),
        recovered = apply(inverse(leaf.matrix), p);
      expect(recovered.x).toBeCloseTo(1, 9);
      expect(recovered.y).toBeCloseTo(2, 9);
    }
    expect(byLevel.get(1)!).toBeLessThan(byLevel.get(0)!);
    expect(byLevel.get(3)!).toBeLessThan(byLevel.get(2)!);
    expect(new Set(a.leaves.map((l) => l.id)).size).toBe(a.leaves.length);
    expect(a.nodes.some((n) => n.children.length)).toBe(true);
  });
  it('cuadrantes y ramificación cambian distribución, reflejo y escala de forma reproducible', () => {
    const c = recursive();
    if (c.kind !== 'recursive') throw Error();
    c.recipe = 'quadrants';
    c.depth = 2;
    const a = compileComposition(c);
    expect(a.leaves).toHaveLength(16);
    c.mirror = true;
    expect(
      compileComposition(c).leaves.some(
        (l) => l.matrix[0] * l.matrix[3] - l.matrix[1] * l.matrix[2] < 0,
      ),
    ).toBe(true);
    c.recipe = 'branching';
    expect(compileComposition(c).leaves).toHaveLength(7);
  });
  it('culling conserva matrices/IDs, y detalle mínimo y presupuestos son explícitos', () => {
    const c = recursive(),
      full = compileComposition(c),
      cropped = compileComposition(c, { bounds: { x: -8, y: -8, width: 16, height: 16 } });
    expect(cropped.leaves.length).toBeLessThan(full.leaves.length);
    expect(cropped.culled).toBeGreaterThan(0);
    for (const leaf of cropped.leaves)
      expect(full.leaves.find((l) => l.id === leaf.id)).toEqual(leaf);
    expect(compileComposition(c, { minSize: 20 }).detailOmitted).toBeGreaterThan(0);
    const bounded = compileComposition(c, { maxInstances: 10 });
    expect(bounded.leaves).toHaveLength(10);
    expect(bounded.limited).toBe(true);
    const windowed = compileComposition(c, {
      maxInstances: 10,
      bounds: { x: -8, y: -8, width: 16, height: 16 },
    });
    for (const leaf of windowed.leaves) expect(bounded.leaves).toContainEqual(leaf);
  });
  it.each(['discrete', 'logarithmic', 'rosette', 'fixed-point'] as const)(
    'espiral %s es finita e invertible y llega hacia el centro',
    (recipe) => {
      const c = defaultComposition('spiral', frame);
      if (c.kind !== 'spiral') throw Error();
      c.recipe = recipe;
      c.arms = 4;
      const result = compileComposition(c);
      expect(result.leaves.length).toBeGreaterThan(10);
      expect(result.leaves.length).toBeLessThanOrEqual(4 * c.count);
      const first = result.leaves[0],
        last = result.leaves[Math.min(c.count, result.leaves.length) - 1];
      expect(Math.hypot(last.matrix[0], last.matrix[1])).toBeLessThan(
        Math.hypot(first.matrix[0], first.matrix[1]),
      );
      for (const leaf of result.leaves) expect(() => inverse(leaf.matrix)).not.toThrow();
      expect(compileComposition(c)).toEqual(result);
    },
  );
  it('rechaza parámetros que producen geometría inválida antes de generar', () => {
    const invalid = recursive();
    invalid.sourceFrame.width = 0;
    expect(compositionIssue(invalid)).toMatch(/Marco/);
    expect(() => compileComposition(invalid)).toThrow();
    const c = defaultComposition('spiral', frame) as Composition;
    c.palette = ['url(evil)'];
    expect(compositionIssue(c)).toMatch(/paleta/);
  });
});
