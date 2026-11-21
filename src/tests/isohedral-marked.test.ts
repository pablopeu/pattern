import { expect, it } from 'vitest';
import { newIsohedral, isohedralLayout, markedIsohedralTypes } from '../isohedral/engine';
import { isohedralIssue } from '../isohedral/validate';
import { isohedralCatalog } from '../isohedral/catalog';
import { apply, inverse, multiply, reflect, translate, type Matrix } from '../geometry/matrix';
import { geometry, newProject, node } from '../app/model';
import { newIsohedralTiling } from '../tiling/tiles';
import { buildScene } from '../patterns/engine';

const equal = (a: Matrix, b: Matrix) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
for (const type of markedIsohedralTypes) {
  it(`IH${type}: las reflexiones cierran módulo red/estabilizador y los detalles respetan el grupo`, () => {
    const layout = isohedralLayout(newIsohedral(type), 1),
      H = layout.motifSymmetries,
      center = {
        x: layout.vertices.reduce((s, p) => s + p.x, 0) / layout.vertices.length,
        y: layout.vertices.reduce((s, p) => s + p.y, 0) / layout.vertices.length,
      },
      inv = inverse(layout.basis);
    expect(layout.marked).toBe(true);
    // The stabilizer acts on this polygon and is a finite group.
    for (const h of H) {
      for (const k of H) expect(H.some((v) => equal(v, multiply(h, k)))).toBe(true);
      for (const p of layout.vertices) {
        const q = apply(h, p);
        expect(layout.vertices.some((v) => Math.hypot(v.x - q.x, v.y - q.y) < 1e-7)).toBe(true);
      }
    }
    // Reflecting across every actual edge reaches exactly an aspect+translation+stabilizer.
    for (const A of layout.aspects)
      for (const [index, p] of layout.vertices.entries()) {
        const q = layout.vertices[(index + 1) % layout.vertices.length],
          reflection = reflect((Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI, p),
          neighbor = multiply(A, reflection),
          c = apply(neighbor, center);
        const found = layout.aspects.some((B) => {
          const b = apply(B, center),
            v = apply(inv, { x: c.x - b.x, y: c.y - b.y });
          if (Math.abs(v.x - Math.round(v.x)) > 1e-6 || Math.abs(v.y - Math.round(v.y)) > 1e-6)
            return false;
          const offset = apply(layout.basis, { x: Math.round(v.x), y: Math.round(v.y) });
          return H.some((h) =>
            equal(neighbor, multiply(translate(offset.x, offset.y), multiply(B, h))),
          );
        });
        expect(found).toBe(true);
      }
    const linear = new Set(
        layout.aspects.flatMap((A) =>
          H.map((h) =>
            multiply(A, h)
              .slice(0, 4)
              .map((n) => Math.round(n * 1e6))
              .join(','),
          ),
        ),
      ),
      group = isohedralCatalog.find((r) => r.id === type)!.group,
      expectedOrder = ['pmm', 'cmm'].includes(group)
        ? 4
        : ['p3m1', 'p31m'].includes(group)
          ? 6
          : group === 'p6m'
            ? 12
            : 8;
    expect(linear.size).toBe(expectedOrder);
    const project = newProject(),
      pattern = project.patterns[0],
      marker = geometry('path', [node(0.1, 0.1), node(0.18, 0.12), node(0.13, 0.21)], true);
    marker.fill = '#a85840';
    pattern.sourceGeometry = [marker];
    pattern.tiling = newIsohedralTiling(type);
    const original = structuredClone(pattern.sourceGeometry),
      scene = buildScene(pattern, { x: -120, y: -120, width: 240, height: 240 }),
      actualH = isohedralLayout(newIsohedral(type), 60).motifSymmetries;
    for (const h of actualH)
      expect(scene.tiling!.inner.instances.some((i) => equal(i.matrix, h))).toBe(true);
    expect(scene.generated.geometry).toHaveLength(1);
    expect(pattern.sourceGeometry).toEqual(original);
  });
}
it('rectángulos marcados conservan isometrías y encastre al cambiar la proporción', () => {
  for (const type of [48, 60, 65])
    for (const ratio of [0.4, 0.8, 2.2, 3.5]) {
      const def = newIsohedral(type);
      def.parameters[0] = ratio;
      expect(isohedralIssue(def)).toBeNull();
      const layout = isohedralLayout(def);
      for (const m of [...layout.aspects, ...layout.motifSymmetries]) {
        expect(Math.abs(m[0] * m[3] - m[1] * m[2])).toBeCloseTo(1, 7);
        expect(m[0] * m[2] + m[1] * m[3]).toBeCloseTo(0, 7);
      }
    }
});
