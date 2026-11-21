import { describe, it, expect } from 'vitest';
import {
  girihPolygon,
  girihAngles,
  girihNames,
  polygonArea,
  distance,
  segmentInside,
} from '../girih/polygons';
import { girihOrnament } from '../girih/ornament';
import { girihRosette, girihGrid, validateGirihPatch, attachGirih } from '../girih/patch';
import { IDENTITY, translate } from '../geometry/matrix';
describe('Girih: prototipos, puertos54° y adyacencias', () => {
  for (const kind of Object.keys(girihNames) as (keyof typeof girihNames)[])
    it(`${kind}: equilátero, ángulos exactos y todos los rayos emparejados`, () => {
      const p = girihPolygon(kind);
      expect(p).toHaveLength(girihAngles[kind].length);
      expect(polygonArea(p)).toBeGreaterThan(0);
      p.forEach((a, i) => {
        expect(distance(a, p[(i + 1) % p.length])).toBeCloseTo(1, 8);
        const prev = p[(i + p.length - 1) % p.length],
          next = p[(i + 1) % p.length],
          u = { x: a.x - prev.x, y: a.y - prev.y },
          v = { x: next.x - a.x, y: next.y - a.y },
          angle = 180 - (Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y) * 180) / Math.PI;
        expect(angle).toBeCloseTo(girihAngles[kind][i], 7);
      });
      const ornament = girihOrnament(kind);
      expect(ornament.unmatched).toEqual([]);
      expect(ornament.paths).toHaveLength(p.length);
      expect(new Set(ornament.paths.flatMap((p) => p.ports)).size).toBe(p.length * 2);
      for (const path of ornament.paths)
        for (let i = 1; i < path.points.length; i++)
          expect(segmentInside(path.points[i - 1], path.points[i], p)).toBe(true);
    });
  it('roseta decagonal y red de rombos cierran adyacencias sin solapamientos', () => {
    const rose = girihRosette(),
      grid = girihGrid(4, 5);
    expect(rose).toHaveLength(11);
    for (const patch of [rose, grid]) {
      const report = validateGirihPatch(patch);
      expect(report.issues).toEqual([]);
      expect(report.holes).toBe(0);
      expect(report.adjacencies.length).toBeGreaterThan(10);
      expect(report.boundaryEdges).toBeGreaterThan(0);
    }
  });
  it('rechaza colisión/tesela aislada sin mutar último estado válido', () => {
    const root = [{ id: 'root', kind: 'decagon' as const, matrix: IDENTITY }],
      snapshot = JSON.stringify(root);
    expect(() => attachGirih(girihRosette(), 0, 0, 'pentagon')).toThrow();
    expect(JSON.stringify(root)).toBe(snapshot);
    expect(
      validateGirihPatch([...root, { id: 'bad', kind: 'decagon', matrix: translate(10, 10) }])
        .issues,
    ).toContain('El parche debe conectar todas sus teselas por bordes.');
  });
});
