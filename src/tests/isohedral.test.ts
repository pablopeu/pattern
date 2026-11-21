import { describe, expect, it } from 'vitest';
import {
  newIsohedral,
  supportedIsohedralTypes,
  markedIsohedralTypes,
  isohedralLayout,
  isohedralInstances,
  isohedralConstraints,
  nodeBounds,
} from '../isohedral/engine';
import { isohedralIssue } from '../isohedral/validate';
import { apply, inverse, multiply, IDENTITY } from '../geometry/matrix';
import { paperPath, scope } from '../geometry/paper';
import { node } from '../app/model';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

describe('IH · definiciones independientes por tipo', () => {
  it('declara81 tipos geométricos y12 marcados pendientes, sin aliases ficticios', () => {
    expect(supportedIsohedralTypes).toHaveLength(81);
    expect(new Set(supportedIsohedralTypes).size).toBe(81);
    expect(markedIsohedralTypes).toEqual([19, 35, 48, 60, 63, 65, 70, 75, 80, 87, 89, 92]);
    for (const id of markedIsohedralTypes)
      expect(() => newIsohedral(id)).toThrow(/no implementado/);
    expect(() => newIsohedral(94)).toThrow();
    const source = readFileSync('src/vendor/tactile/tactile.js');
    const blob = createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex');
    expect(blob).toBe('3d3df7097d91116c1f49041a3b02505c28fab1e8');
  });
  for (const id of supportedIsohedralTypes) {
    it(`IH${id}: área, matrices, cierre de ciclos y cobertura local sin solapamiento`, () => {
      const def = newIsohedral(id),
        original = structuredClone(def),
        layout = isohedralLayout(def),
        b = nodeBounds(layout.boundary.nodes),
        view = { x: b.x - 1, y: b.y - 1, width: b.width + 2, height: b.height + 2 },
        items = isohedralInstances(def, 60, view);
      expect(isohedralIssue(def)).toBeNull();
      expect(def).toEqual(original);
      expect(items).toEqual(isohedralInstances(def, 60, view));
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      for (const m of layout.aspects) {
        expect(Math.abs(m[0] * m[3] - m[1] * m[2])).toBeCloseTo(1, 7);
        expect(m[0] * m[2] + m[1] * m[3]).toBeCloseTo(0, 7);
        multiply(m, inverse(m)).forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i], 7));
      }
      const paths = items.map((item) => paperPath(layout.boundary, item.matrix));
      try {
        // Full 2π around every structural vertex: neighbour wedges close exactly once.
        for (const v of layout.vertices)
          for (let k = 0; k < 24; k++) {
            const a = ((k + 0.173) * Math.PI) / 12,
              p = new scope.Point(v.x + 0.01 * Math.cos(a), v.y + 0.01 * Math.sin(a));
            expect(paths.filter((path) => path.contains(p)).length).toBe(1);
          }
      } finally {
        paths.forEach((path) => path.remove());
      }
      // Instances remain invertible and refer to a single canonical definition.
      const q = apply(items[0].matrix, { x: 12, y: -3 });
      expect(apply(inverse(items[0].matrix), q).x).toBeCloseTo(12, 7);
    });
    it(`IH${id}: borde Bézier enlazado conserva área/adyacencia o exige espejo recto`, () => {
      const def = newIsohedral(id),
        constraints = isohedralConstraints(def),
        editable = constraints.findIndex((c) => c !== 'straight');
      if (editable >= 0) {
        def.edges[editable][1].y = 0.015;
        def.edges[editable][1].in = { x: -0.13, y: -0.01 };
        def.edges[editable][1].out = { x: 0.13, y: 0.01 };
        expect(isohedralIssue(def)).toBeNull();
        expect(isohedralLayout(def).boundary.nodes.some((n) => n.in.x !== 0 || n.in.y !== 0)).toBe(
          true,
        );
      } else {
        def.edges[0][1].y = 0.015;
        expect(isohedralIssue(def)).toMatch(/recto/);
      }
    });
  }
  it('rechaza parámetros degenerados, vértices separados, autointersecciones y exceso de copias', () => {
    const def = newIsohedral(1);
    def.edges[0][0].x = 0.2;
    expect(isohedralIssue(def)).toMatch(/vértices/);
    def.edges[0][0].x = 0;
    def.parameters.push(Number.NaN);
    expect(isohedralIssue(def)).toMatch(/Parámetros/);
    expect(() =>
      isohedralInstances(newIsohedral(1), 60, { x: -1e5, y: -1e5, width: 2e5, height: 2e5 }),
    ).toThrow(/Demasiadas/);
    const crossing = newIsohedral(1);
    crossing.edges[0] = [node(0, 0), node(0.8, 0.4), node(0.2, 0.4), node(0.8, -0.4), node(1, 0)];
    expect(isohedralIssue(crossing)).not.toBeNull();
  });
});
