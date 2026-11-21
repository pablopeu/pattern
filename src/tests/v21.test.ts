import { describe, it, expect } from 'vitest';
import { newProject, newPattern, geometry, node, type Symmetry } from '../app/model';
import { wallpaperNames, friezeNames, cosets, lattice } from '../symmetry/groups';
import { symmetryStructure, rotationOrder } from '../symmetry/structure';
import { apply, distance, rotate } from '../geometry/matrix';
import { buildScene } from '../patterns/engine';
import { chooseCapture, capturedPoint } from '../editor/capture';
import { parseProject, serialize } from '../persistence/schema';
const view = { x: -61, y: -61, width: 182, height: 182 };
const sym = (group: string, family: Symmetry['family'] = 'wallpaper'): Symmetry => ({
  ...newPattern().symmetry,
  family,
  group,
  width: 60,
  height: 60,
  angle: 90,
});
describe('estructura matemática v2.1', () => {
  for (const group of wallpaperNames)
    it(`${group}: marcas visibles deduplicadas y operaciones testigo correctas`, () => {
      const s = { ...sym(group), origin: { x: 3, y: -7 }, orientation: 23 },
        data = symmetryStructure(s, view);
      expect(data.limited).toBe(false);
      expect(data.primitive.length).toBeGreaterThan(0);
      expect(data.domain.length).toBeGreaterThan(0);
      const axes = new Set<string>(),
        centers = new Set<string>();
      for (const c of data.centers) {
        expect(distance(apply(c.operation, c.point), c.point)).toBeLessThan(1e-6);
        expect(rotationOrder(c.operation)).toBe(c.order);
        const k = [c.point.x, c.point.y].map((n) => n.toFixed(5)).join(',');
        expect(centers.has(k)).toBe(false);
        centers.add(k);
      }
      for (const axis of data.axes) {
        const p = {
            x: axis.origin.x + axis.direction.x * 11,
            y: axis.origin.y + axis.direction.y * 11,
          },
          q = apply(axis.operation, p),
          normal = { x: -axis.direction.y, y: axis.direction.x };
        expect(Math.abs((q.x - p.x) * normal.x + (q.y - p.y) * normal.y)).toBeLessThan(1e-6);
        if (!axis.glide) expect(distance(p, q)).toBeLessThan(1e-6);
        else expect(distance(p, q)).toBeGreaterThan(1e-7);
        const k = [
          axis.direction.x,
          axis.direction.y,
          normal.x * axis.origin.x + normal.y * axis.origin.y,
        ]
          .map((n) => n.toFixed(5))
          .join(',');
        expect(axes.has(k)).toBe(false);
        axes.add(k);
      }
      expect(data.axes.length > 0).toBe(!['p1', 'p2', 'p3', 'p4', 'p6'].includes(group));
    });
  it('p2 incluye centros en medias traslaciones, no sólo imágenes del centro de una celda', () => {
    const d = symmetryStructure(sym('p2'), { x: -1, y: -1, width: 122, height: 122 });
    expect(d.centers).toHaveLength(25);
    expect(d.centers.some((c) => distance(c.point, { x: 30, y: 0 }) < 1e-6)).toBe(true);
  });
  it('p3m1 y p31m tienen ejes distintos; los grupos con glides muestran sus ejes reales', () => {
    const angles = (s: Symmetry) =>
      new Set(
        symmetryStructure(s, view).axes.map(
          (a) =>
            (Math.round((Math.atan2(a.direction.y, a.direction.x) * 180) / Math.PI) + 180) % 180,
        ),
      );
    expect(angles(sym('p3m1'))).toEqual(new Set([30, 90, 150]));
    expect(angles(sym('p31m'))).toEqual(new Set([0, 60, 120]));
    for (const group of ['pg', 'pgg', 'p4g'])
      expect(symmetryStructure(sym(group), view).axes.some((a) => a.glide)).toBe(true);
  });
  for (const group of friezeNames)
    it(`friso ${group}: estructura sin traslaciones verticales`, () => {
      const s = { ...sym(group, 'frieze'), origin: { x: 2, y: 14 } },
        d = symmetryStructure(s, view);
      expect(d.primitive.length).toBeGreaterThan(0);
      expect(d.domain).toHaveLength(0);
      for (const c of d.centers) expect(c.point.y).toBeCloseTo(14, 7);
      for (const a of d.axes)
        if (Math.abs(a.direction.x) > 0.5) expect(a.origin.y).toBeCloseTo(14, 7);
    });
  for (const group of ['Cn', 'Dn'])
    it(`${group}: un centro y ninguna red de traslación`, () => {
      const d = symmetryStructure(
        { ...sym(group, 'radial'), sectors: 5, center: { x: 9, y: 6 }, orientation: 17 },
        view,
      );
      expect(d.primitive).toHaveLength(0);
      expect(d.centers).toHaveLength(1);
      expect(d.centers[0].order).toBe(5);
      expect(d.axes.length).toBe(group === 'Dn' ? 5 : 0);
      expect(rotationOrder(rotate(144))).toBe(5);
    });
  it('Libre no inventa estructura y el zoom excesivo limita trabajo', () => {
    expect(symmetryStructure(sym('none', 'none'), view)).toEqual({
      axes: [],
      centers: [],
      domain: [],
      primitive: [],
      limited: false,
    });
    expect(
      symmetryStructure(sym('p6m'), { x: -10000, y: -10000, width: 20000, height: 20000 }, 500)
        .limited,
    ).toBe(true);
  });
});
describe('captura vacía canónica', () => {
  for (const [family, group] of [
    ['wallpaper', 'p6m'],
    ['wallpaper', 'p4g'],
    ['wallpaper', 'pg'],
    ['frieze', 'p2mg'],
    ['radial', 'Dn'],
  ] as const)
    it(`${family} ${group}: inicio distante, inversa fija y fuente independiente`, () => {
      const p = newPattern();
      p.symmetry = sym(group, family);
      const a = { x: 843, y: -637 },
        b = { x: 908, y: -613 },
        scene = buildScene(p, view),
        picked = chooseCapture(p, scene, a, 0.3),
        context = { patternId: p.id, tool: 'line', instance: picked.chosen };
      expect(distance(apply(picked.chosen.matrix, capturedPoint(context, a)), a)).toBeLessThan(
        1e-7,
      );
      expect(distance(apply(picked.chosen.matrix, capturedPoint(context, b)), b)).toBeLessThan(
        1e-7,
      );
      const first = picked.chosen.matrix;
      p.sourceGeometry = [geometry('path', [node(-10000, 9000), node(-9990, 8990)])];
      expect(chooseCapture(p, buildScene(p, view), a, 0.3).chosen.matrix).toEqual(first);
      expect(chooseCapture(p, scene, a, 0.3).chosen.id).toBe(picked.chosen.id);
      if (family === 'frieze') {
        const basis = lattice(p.symmetry);
        expect(Math.abs(first[5])).toBeLessThan(1e-7);
        expect(basis[1]).toBe(0);
      }
      expect(cosets(p.symmetry).length).toBeGreaterThan(0);
    });
  it('migra el formato v2 sin modificar ninguna entidad ni fuente', () => {
    const p = newProject(),
      old = JSON.parse(serialize(p));
    old.schemaVersion = 2;
    delete old.preferences.structureVisible;
    delete old.preferences.structureOpacity;
    const restored = parseProject(JSON.stringify(old));
    expect(restored.schemaVersion).toBe(6);
    expect(restored.patterns).toEqual(old.patterns);
    expect(restored.preferences.structureVisible).toBe(false);
    expect(restored.preferences.structureOpacity).toBe(0.22);
  });
});
