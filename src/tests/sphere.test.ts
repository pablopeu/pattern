import { describe, expect, it } from 'vitest';
import { baseFaces, faceNormal, geodesicFaces, solids } from '../sphere/geometry';
import { defaultSphereSettings, validateSphereSettings, type SphereSettings } from '../sphere/model';
import { visualizationSchema } from '../visualization/schema';
import { defaultSphereVisualization, changeVisualizationKind, defaultVisualization } from '../visualization/model';
import { newStudy } from '../app/model';

const count = (kind: Parameters<typeof baseFaces>[0]) => baseFaces(kind).length;

describe('sólidos platónicos proyectados', () => {
  it('cada sólido proyecta sus caras polígonales con la cantidad esperada', () => {
    expect(count('tetra')).toBe(4);
    expect(count('cube')).toBe(6);
    expect(count('octa')).toBe(8);
    expect(count('dodeca')).toBe(12);
    expect(count('icosa')).toBe(20);
    // Los polígonos de nivel 0 no traen diagonales de abanico.
    expect(baseFaces('cube').every((f) => f.vertices.length === 4)).toBe(true);
    expect(baseFaces('dodeca').every((f) => f.vertices.length === 5)).toBe(true);
  });
  it('la cobertura esférica no deja huecos tras proyectar', () => {
    const faces = geodesicFaces('icosa', 2),
      det = (u: number[], v: number[], w: number[]) =>
        u[0] * (v[1] * w[2] - v[2] * w[1]) -
        u[1] * (v[0] * w[2] - v[2] * w[0]) +
        u[2] * (v[0] * w[1] - v[1] * w[0]);
    let misses = 0;
    for (let i = 0; i < 1500; i++) {
      const z = 1 - (2 * (i + 0.5)) / 1500,
        phi = i * 2.399963229728653,
        r = Math.sqrt(1 - z * z),
        p = [r * Math.cos(phi), r * Math.sin(phi), z];
      const hit = faces.some((f) => {
        const [a, b, c] = f.vertices as unknown as [number[], number[], number[]],
          d = det(a, b, c);
        return (
          Math.abs(d) > 1e-12 &&
          det(p, b, c) / d > -1e-9 &&
          det(a, p, c) / d > -1e-9 &&
          det(a, b, p) / d > -1e-9
        );
      });
      if (!hit) misses++;
    }
    expect(misses).toBe(0);
  });
  it('todos los vértices son unitarios y las normales miran hacia afuera', () => {
    for (const { kind } of solids)
      for (const face of baseFaces(kind)) {
        for (const v of face.vertices) expect(Math.hypot(...v)).toBeCloseTo(1, 12);
        const n = faceNormal(face.vertices),
          c = face.vertices.reduce(
            (a, v) => [a[0] + v[0] / 3, a[1] + v[1] / 3, a[2] + v[2] / 3],
            [0, 0, 0],
          );
        expect(n[0] * c[0] + n[1] * c[1] + n[2] * c[2]).toBeGreaterThan(0);
      }
  });
  it('la subdivisión geodésica cuadruplica caras, proyecta a la esfera y es determinística', () => {
    for (const { kind } of solids) {
      const triangles = baseFaces(kind).reduce((n, f) => n + f.vertices.length - 2, 0);
      expect(geodesicFaces(kind, 0)).toHaveLength(baseFaces(kind).length);
      for (const level of [1, 2])
        expect(geodesicFaces(kind, level)).toHaveLength(triangles * 4 ** (level - 1));
      expect(JSON.stringify(geodesicFaces(kind, 2))).toBe(JSON.stringify(geodesicFaces(kind, 2)));
    }
    expect(geodesicFaces('icosa', 4)).toHaveLength(20 * 4 ** 3);
    expect(() => geodesicFaces('cube', 5)).toThrow(/nivel/);
  });
});

describe('ajustes y persistencia de la esfera', () => {
  it('valida sólidos, vista y paleta', () => {
    const ok = defaultSphereSettings();
    expect(() => validateSphereSettings(ok)).not.toThrow();
    expect(() =>
      validateSphereSettings({ ...ok, solid: 'pirámide' as SphereSettings['solid'] }),
    ).toThrow(/esféricos/);
    expect(() => validateSphereSettings({ ...ok, level: 9 })).toThrow(/esféricos/);
    expect(() =>
      validateSphereSettings({ ...ok, view: { ...ok.view, pitch: 120 } }),
    ).toThrow(/esféricos/);
    expect(() => validateSphereSettings({ ...ok, palette: ['#123456'] })).toThrow(/esféricos/);
  });
  it('persiste la visualización esférica y alterna con los discos conservando la fuente', () => {
    const project = newStudy(),
      patternId = project.patterns[0].id,
      sphere = defaultSphereVisualization(project, patternId);
    expect(visualizationSchema.safeParse(sphere).success).toBe(true);
    const poincare = changeVisualizationKind(project, sphere, 'poincare');
    expect(poincare.kind).toBe('poincare');
    expect(poincare.source).toEqual(sphere.source);
    const back = changeVisualizationKind(project, poincare, 'sphere');
    expect(back.kind).toBe('sphere');
    expect(back.source).toEqual(sphere.source);
    expect(
      visualizationSchema.safeParse({
        ...sphere,
        settings: { ...sphere.settings, palette: ['no-es-color'] },
      }).success,
    ).toBe(false);
    const legacy = defaultVisualization(project, patternId);
    expect(visualizationSchema.safeParse(legacy).success).toBe(true);
  });
});
