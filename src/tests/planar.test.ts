import { paperPath, scope } from '../geometry/paper';
import { describe, it, expect } from 'vitest';
import { geometry, node } from '../app/model';
import { IDENTITY, rotate, scale, translate, multiply } from '../geometry/matrix';
import { buildArrangement, facesAt, type BoundaryInput } from '../fill/planar';
const input = (id: string, data: string, matrix = IDENTITY): BoundaryInput => ({
  id,
  patternId: 'p',
  shapeId: id,
  geometry: { ...geometry('compound'), pathData: data },
  matrix,
  z: 0,
});
const square = (gap = 0) => [
  input('a', `M${gap} 0L20 0`),
  input('b', 'M20 0L20 20'),
  input('c', 'M20 20L0 20'),
  input('d', 'M0 20L0 0'),
];
describe('v2.2 Fill · arreglo planar vectorial', () => {
  it('cuatro líneas independientes crean una única cara y ninguna exterior', () => {
    const source = square(),
      before = structuredClone(source),
      a = buildArrangement(source);
    expect(a.faces).toHaveLength(1);
    expect(a.faces[0].area).toBeCloseTo(400);
    expect(facesAt(a, { x: 10, y: 10 })).toHaveLength(1);
    expect(facesAt(a, { x: 25, y: 10 })).toEqual([]);
    expect(source).toEqual(before);
  });
  it('curvas Bézier conservan controles exactos de frontera', () => {
    const a = buildArrangement([
      input('a', 'M0 0C0 -10 20 -10 20 0'),
      input('b', 'M20 0C20 10 0 10 0 0'),
    ]);
    expect(a.faces).toHaveLength(1);
    expect(a.faces[0].pathData).toContain('c');
    expect(facesAt(a, { x: 10, y: 0 })).toHaveLength(1);
    expect(a.faces[0].area).toBeCloseTo(240);
  });
  it('intersecciones subdividen curvas y reconocen cuatro caras', () => {
    const a = buildArrangement([...square(), input('h', 'M0 10L20 10'), input('v', 'M10 0L10 20')]);
    expect(a.faces).toHaveLength(4);
    for (const f of a.faces) expect(f.area).toBeCloseTo(100);
    for (const p of [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 15 },
      { x: 5, y: 15 },
    ])
      expect(facesAt(a, p)).toHaveLength(1);
  });
  it('agujero anidado es una cara aparte, excluido del anillo', () => {
    const a = buildArrangement([...square(), input('inner', 'M5 5L15 5L15 15L5 15Z')]);
    expect(a.faces.map((f) => f.area).sort((a, b) => a - b)).toEqual([100, 300]);
    expect(facesAt(a, { x: 10, y: 10 })).toHaveLength(1);
    expect(facesAt(a, { x: 2, y: 2 })[0].area).toBe(300);
  });
  it('rechaza área abierta y sólo cierra hueco con tolerancia explícita', () => {
    const source = square(0.1),
      before = structuredClone(source);
    expect(buildArrangement(source).faces).toEqual([]);
    const a = buildArrangement(source, 0.11);
    expect(a.faces).toHaveLength(1);
    expect(a.approximate).toBe(true);
    expect(source).toEqual(before);
    expect(buildArrangement(source, 0.05).faces).toEqual([]);
  });
  it('cierra una unión T próxima sin alterar el eje', () => {
    const a = buildArrangement(
      [
        input('bottom', 'M0 0L30 0'),
        input('left', 'M5 .08L5 15'),
        input('top', 'M5 15L20 15'),
        input('right', 'M20 15L20 0'),
      ],
      0.1,
    );
    expect(facesAt(a, { x: 10, y: 5 })).toHaveLength(1);
    expect(a.approximate).toBe(true);
  });
  it('genera caras reflejadas y rotadas con refs de instancia', () => {
    const m = multiply(translate(50, 40), multiply(rotate(90), scale(-1, 1))),
      a = buildArrangement(square().map((g) => ({ ...g, matrix: m })));
    expect(a.faces).toHaveLength(1);
    expect(a.faces[0].area).toBeCloseTo(400);
    expect(facesAt(a, { x: 40, y: 30 })).toHaveLength(1);
    expect(a.faces[0].refs.every((r) => r.matrix === m)).toBe(true);
  });
  it('conserva identidad combinatoria al mover límites sin cambiar topología', () => {
    const a = buildArrangement(square()),
      b = buildArrangement(
        square().map((g) => ({ ...g, geometry: { ...g.geometry, transform: translate(3, 5) } })),
      );
    expect(a.faces[0].key).toBe(b.faces[0].key);
    expect(b.faces[0].bounds.x).toBeCloseTo(3);
  });
  it('ignora geometría oculta/bloqueada y cancela trabajo antes del grafo', () => {
    const source = square();
    source[0].geometry.visible = false;
    expect(buildArrangement(source).faces).toEqual([]);
    source[0].geometry.visible = true;
    source[0].geometry.locked = true;
    expect(buildArrangement(source).faces).toEqual([]);
    expect(() => buildArrangement(square(), 0, () => true)).toThrow(/cancelado/);
  });
  it('curva cúbica autointersectada tiene caras acotadas reales', () => {
    const a = buildArrangement([input('loop', 'M0 0C50 60 -10 60 40 0L0 0')]);
    expect(a.faces.length).toBeGreaterThan(0);
    expect(a.intersections).toBeGreaterThan(0);
    expect(a.faces.every((f) => f.area > 0)).toBe(true);
  });
  it('deduplica fronteras coincidentes y no crea caras de área cero', () => {
    const a = buildArrangement([...square(), input('repeat', 'M20 0L0 0')]);
    expect(a.faces).toHaveLength(1);
    expect(a.faces[0].area).toBeCloseTo(400);
  });
  it('limita complejidad explícitamente', () => {
    const source = Array.from({ length: 1201 }, (_, i) => ({
      ...input(String(i), `M${i} 0L${i} 1`),
      geometry: geometry('path', [node(i, 0), node(i, 1)]),
    }));
    expect(() => buildArrangement(source)).toThrow(/1200/);
  });
});

it('Fill deduplica rectas parcialmente coincidentes aunque difieran sus parámetros cúbicos', () => {
  const a = buildArrangement([...square(), input('partial', 'M0 0L10 0')]);
  expect(a.faces).toHaveLength(1);
  expect(a.faces[0].area).toBeCloseTo(400);
});
it('Fill distingue dos regiones curvas tangentes sin fusionarlas', () => {
  const a = buildArrangement(
    [0, 20].map((x, i) => ({
      ...input('circle' + i, 'M0 0'),
      geometry: {
        ...geometry('ellipse', [], true),
        parameters: { x, y: 0, width: 20, height: 20, radius: 0, sides: 4 },
      },
    })),
  );
  expect(a.faces).toHaveLength(2);
  expect(facesAt(a, { x: 10, y: 10 })).toHaveLength(1);
  expect(facesAt(a, { x: 30, y: 10 })).toHaveLength(1);
});
it('Fill conserva huecos con regla nonzero gracias a orientación opuesta', () => {
  const a = buildArrangement([...square(), input('inner', 'M5 5L15 5L15 15L5 15Z')]);
  const face = facesAt(a, { x: 2, y: 2 })[0],
    g = {
      ...geometry('compound', [], true),
      pathData: face.pathData,
      fillRule: 'nonzero' as const,
    },
    p = paperPath(g);
  expect(p.contains(new scope.Point(10, 10))).toBe(false);
  expect(p.contains(new scope.Point(2, 2))).toBe(true);
  p.remove();
});
