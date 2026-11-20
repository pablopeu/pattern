import { describe, it, expect } from 'vitest';
import { geometry, newProject, node } from '../app/model';
import { geometryHit } from '../editor/hitGeometry';
import { paperPath } from '../geometry/paper';
import { scale, IDENTITY } from '../geometry/matrix';
import { buildScene } from '../patterns/engine';
import { resolvePattern } from '../symmetry/config';
import { collectFillInputs } from '../fill/service';
import { buildArrangement, facesAt } from '../fill/planar';
describe('v2.2 · interacción con tinta y bordes visibles', () => {
  it('selecciona la tinta de un perfil ancho afín sin seleccionar fuera de la punta fina', () => {
    const g = {
      ...geometry('path', [node(0, 0), node(20, 0)]),
      strokeWidth: 8,
      strokeCap: 'butt' as const,
      transform: scale(1, 2),
      strokeProfile: {
        version: 1 as const,
        kind: 'custom' as const,
        points: [
          { at: 0, width: 4 },
          { at: 1, width: 4 },
        ],
      },
    };
    let path = paperPath(g);
    expect(geometryHit(g, path, { x: 10, y: 25 }, 0.1)).toBe(true);
    expect(geometryHit(g, path, { x: 10, y: 35 }, 0.1)).toBe(false);
    path.remove();
    g.strokeProfile.points[0].width = 0.05;
    path = paperPath(g);
    expect(geometryHit(g, path, { x: 0.05, y: 3 }, 0.1)).toBe(false);
    path.remove();
  });
  it('no recorta una instancia cuyo perfil ancho entra al viewport aunque el eje quede afuera', () => {
    const p = newProject();
    p.mainSymmetry = {
      ...p.mainSymmetry,
      family: 'wallpaper',
      group: 'p1',
      width: 100,
      height: 100,
    };
    p.patterns[0].sourceGeometry = [
      {
        ...geometry('path', [node(0, 0), node(20, 0)]),
        strokeWidth: 16,
        strokeProfile: {
          version: 1,
          kind: 'custom',
          points: [
            { at: 0, width: 4 },
            { at: 1, width: 4 },
          ],
        },
      },
    ];
    const scene = buildScene(resolvePattern(p.patterns[0], p), {
      x: 8,
      y: 25,
      width: 4,
      height: 2,
    });
    expect(
      scene.instances.some((i) => i.matrix.every((v, n) => Math.abs(v - IDENTITY[n]) < 1e-9)),
    ).toBe(true);
  });
  it('reconoce una cara con sus cuatro ejes exactamente sobre los límites del viewport', () => {
    const p = newProject(),
      bounds = { x: 0, y: 0, width: 20, height: 20 };
    p.patterns[0].sourceGeometry = ['M0 0L20 0', 'M20 0L20 20', 'M20 20L0 20', 'M0 20L0 0'].map(
      (pathData) => ({ ...geometry('compound'), pathData }),
    );
    const pattern = resolvePattern(p.patterns[0], p),
      scene = buildScene(pattern, bounds);
    const inputs = collectFillInputs([{ pattern, scene }], bounds);
    expect(inputs).toHaveLength(4);
    expect(facesAt(buildArrangement(inputs), { x: 10, y: 10 })).toHaveLength(1);
  });
});
