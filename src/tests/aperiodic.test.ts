import { describe, expect, it } from 'vitest';
import { compileAperiodic, aperiodicPath, patchBounds, seeds } from '../aperiodic/compile';
import { geometry } from '../app/model';
import { paperPath, scope } from '../geometry/paper';

describe('sustituciones publicadas Hat y Spectre', () => {
  for (const kind of ['hat', 'spectre'] as const) {
    it(`${kind}: determinismo, jerarquía, isometrías y quiralidad`, () => {
      const counts = kind === 'hat' ? [4, 25, 169, 1156, 7921] : [1, 9, 71, 559, 4401];
      for (let depth = 0; depth <= 4; depth++) {
        const p = compileAperiodic(kind, depth),
          snapshot = JSON.stringify(p);
        expect(p.leaves).toHaveLength(counts[depth]);
        expect(new Set(p.leaves.map((l) => l.id)).size).toBe(counts[depth]);
        expect(JSON.stringify(compileAperiodic(kind, depth))).toBe(snapshot);
        const b = patchBounds(p);
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
        const determinants = p.leaves.map((l) => {
          const m = l.matrix;
          expect(m[0] * m[2] + m[1] * m[3]).toBeCloseTo(0, 7);
          expect(Math.hypot(m[0], m[1])).toBeCloseTo(kind === 'hat' ? 0.5 : 1, 7);
          expect(Math.hypot(m[2], m[3])).toBeCloseTo(kind === 'hat' ? 0.5 : 1, 7);
          return m[0] * m[3] - m[1] * m[2];
        });
        if (kind === 'spectre') expect(determinants.every((d) => d > 0)).toBe(true);
        else expect(determinants.some((d) => d < 0)).toBe(true);
      }
    });
    for (const seed of seeds[kind])
      it(`${kind}/${seed}: parche conectado sin solapamientos interiores ni agujeros`, () => {
        const p = compileAperiodic(kind, 2, seed),
          g = { ...geometry('compound', [], true), pathData: aperiodicPath(p) },
          base = paperPath(g);
        expect(Math.abs((base as paper.CompoundPath).area)).toBeGreaterThan(1);
        base.remove();
        const paths = p.leaves.map((l) => paperPath(g, l.matrix));
        let sum = 0;
        let union: paper.PathItem | undefined;
        try {
          for (const path of paths) {
            sum += Math.abs((path as paper.CompoundPath).area);
            if (!union) union = path.clone({ insert: false });
            else {
              const before = union;
              union = before.unite(path, { insert: false });
              before.remove();
            }
          }
          expect(Math.abs((union as paper.CompoundPath).area)).toBeCloseTo(sum, 5);
          const children = union instanceof scope.CompoundPath ? union.children : [union!];
          // Paper may retain zero-area cubic seams (~1e-15), not physical holes.
          expect(children.filter((c) => Math.abs((c as paper.Path).area) > 1e-9)).toHaveLength(1);
        } finally {
          paths.forEach((p) => p.remove());
          union?.remove();
        }
      });
  }
  it('rechaza parámetros fuera del presupuesto antes de construir', () => {
    expect(() => compileAperiodic('hat', 5)).toThrow();
    expect(() => compileAperiodic('spectre', 1.5)).toThrow();
    expect(() => compileAperiodic('spectre', 1, 'H')).toThrow();
  });
});
