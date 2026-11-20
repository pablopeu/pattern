import { sceneLayers } from '../patterns/layers';
import { describe, it, expect } from 'vitest';
import { newProject, newPattern, geometry, node, type Geometry } from '../app/model';
import { defaultDrawingStyle } from '../app/styles';
import { buildScene } from '../patterns/engine';
import { resolvePattern } from '../symmetry/config';
import { buildArrangement, facesAt } from '../fill/planar';
import {
  collectFillInputs,
  createFaceFill,
  createTileFill,
  immediateFillCandidates,
  refreshLinkedFills,
} from '../fill/service';
import { translate } from '../geometry/matrix';
import { parseProject, serialize } from '../persistence/schema';
import { prepareExport, type ExportOptions } from '../export/svg';
import { newTiling } from '../tiling/tiles';
import { paperPath } from '../geometry/paper';
const bounds = { x: -40, y: -40, width: 100, height: 100 },
  style = { ...defaultDrawingStyle(), fill: '#ef3344' };
function source() {
  return ['M0 0L30 0', 'M20 0L20 20', 'M30 20L0 20', 'M0 20L0 0'].map((pathData) => ({
    ...geometry('compound'),
    pathData,
  }));
}
function prepared(periodic = false) {
  const p = newProject(),
    pattern = p.patterns[0];
  pattern.sourceGeometry = source();
  if (periodic) {
    p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p1', width: 20, height: 20 };
    pattern.sourceGeometry = [
      geometry('path', [node(0, 0), node(20, 0)]),
      geometry('path', [node(0, 0), node(0, 20)]),
    ];
  }
  const effective = resolvePattern(pattern, p),
    scene = buildScene(effective, bounds),
    inputs = collectFillInputs([{ pattern: effective, scene }], bounds),
    arrangement = buildArrangement(inputs),
    face = facesAt(arrangement, { x: 10, y: 10 })[0],
    fill = createFaceFill(p, effective, scene, face, arrangement, inputs, style);
  pattern.sourceGeometry.unshift(fill);
  return { p, pattern, fill };
}
function area(g: Geometry) {
  const p = paperPath(g);
  try {
    return Math.abs((p as paper.CompoundPath).area);
  } finally {
    p.remove();
  }
}
const options = (id: string): ExportOptions => ({
  target: 'view',
  format: 'svg',
  representation: 'expanded',
  width: 80,
  height: 80,
  dpi: 120,
  background: '#ffffff',
  transparent: true,
  quality: 0.9,
  tolerance: 0.01,
  outlineStrokes: true,
  patternId: id,
});
describe('v2.2 Fill · entidades e integración vectorial', () => {
  it('cuatro fuentes más un relleno, una fuente por resultado y persistencia', () => {
    const { p, pattern, fill } = prepared();
    expect(pattern.sourceGeometry).toHaveLength(5);
    expect(fill.fillRegion).toMatchObject({
      kind: 'face',
      scope: 'source',
      linked: true,
      status: 'linked',
    });
    expect(area(fill)).toBeCloseTo(400);
    expect(parseProject(serialize(p))).toEqual(p);
  });
  it('actualiza contorno vinculado al mover un límite manteniendo fuente única', () => {
    const { p, pattern, fill } = prepared();
    pattern.sourceGeometry[2].transform = translate(5, 0);
    const update = refreshLinkedFills(p).get(fill.id)!;
    expect(update.fillRegion?.status).toBe('linked');
    expect(area(update)).toBeCloseTo(500);
    expect(pattern.sourceGeometry).toHaveLength(5);
    expect(area(fill)).toBeCloseTo(400);
  });
  it('fijo conserva contorno y un límite abierto conserva último válido con aviso', () => {
    const { p, pattern, fill } = prepared();
    fill.fillRegion!.linked = false;
    pattern.sourceGeometry[2].transform = translate(5, 0);
    expect(refreshLinkedFills(p).has(fill.id)).toBe(false);
    fill.fillRegion!.linked = true;
    pattern.sourceGeometry.splice(2, 1);
    const update = refreshLinkedFills(p).get(fill.id)!;
    expect(update.fillRegion?.status).toBe('stale');
    expect(update.pathData).toBe(fill.pathData);
  });
  it('nuevos límites que cambian la topología no mantienen un vínculo falso', () => {
    const { p, pattern, fill } = prepared();
    pattern.sourceGeometry.push({ ...geometry('compound'), pathData: 'M0 10L20 10' });
    const update = refreshLinkedFills(p).get(fill.id)!;
    expect(update.fillRegion?.status).toBe('stale');
    expect(update.pathData).toBe(fill.pathData);
  });
  it('cara entre distintas instancias cruza celdas y se propaga por la simetría', () => {
    const { p, pattern, fill } = prepared(true);
    expect(new Set(fill.fillRegion!.refs.map((r) => r.matrix.join(','))).size).toBeGreaterThan(1);
    expect(fill.fillRegion?.scope).toBe('source');
    const scene = buildScene(resolvePattern(pattern, p), bounds);
    expect(scene.generated.geometry.filter((g) => g.id === fill.id)).toHaveLength(1);
    expect(scene.instances.length).toBeGreaterThan(4);
    expect(
      prepareExport(p, options(pattern.id)).geometries.filter((g) => g.fill === '#ef3344').length,
    ).toBeGreaterThan(4);
  });
  it('vínculo de cara entre celdas sigue límites sin depender sólo de un cursor', () => {
    const { p, pattern, fill } = prepared(true);
    pattern.sourceGeometry.find(
      (g) => !g.fillRegion && g.nodes[0]?.x === 0 && g.nodes[1]?.y === 20,
    )!.transform = translate(2, 0);
    const update = refreshLinkedFills(p).get(fill.id)!;
    expect(update.fillRegion?.status).toBe('linked');
    expect(area(update)).toBeCloseTo(400);
    expect(update.pathData).not.toBe(fill.pathData);
  });
  it('cambio de grupo preserva contorno y explica configuración anterior', () => {
    const { p, fill } = prepared(true);
    p.mainSymmetry.group = 'pm';
    const update = refreshLinkedFills(p).get(fill.id)!;
    expect(update.fillRegion?.status).toBe('stale');
    expect(update.pathData).toBe(fill.pathData);
  });
  it('tesela usa frontera real, se actualiza vinculada y se exporta en todas sus copias', () => {
    const p = newProject(),
      pattern = p.patterns[0];
    pattern.tiling = newTiling('square');
    const effective = resolvePattern(pattern, p),
      scene = buildScene(effective, bounds),
      candidate = immediateFillCandidates([{ pattern: effective, scene }], { x: 10, y: 10 }).find(
        (c) => c.kind === 'tile',
      )!;
    if (candidate.kind !== 'tile') throw Error();
    const fill = createTileFill(p, pattern, candidate, style);
    pattern.sourceGeometry.push(fill);
    const before = area(fill);
    pattern.tiling.width += 10;
    const update = refreshLinkedFills(p).get(fill.id)!;
    expect(update.fillRegion?.status).toBe('linked');
    expect(area(update)).toBeGreaterThan(before);
    pattern.sourceGeometry[0] = update;
    const result = prepareExport(p, options(pattern.id));
    expect(result.geometries.filter((g) => g.fill === '#ef3344').length).toBeGreaterThan(1);
    expect(result.svg).toContain('#ef3344');
  });
});

it('Fill entre conjuntos conserva una órbita concreta y respeta el orden de capas al exportar', () => {
  const p = newProject(),
    a = p.patterns[0],
    b = newPattern();
  p.patterns.push(b);
  const lines = source();
  a.sourceGeometry = [lines[0], lines[2]];
  b.sourceGeometry = [lines[1], lines[3]];
  const layers = p.patterns.map((pattern) => {
      const effective = resolvePattern(pattern, p);
      return { pattern: effective, scene: buildScene(effective, bounds) };
    }),
    inputs = collectFillInputs(layers, bounds),
    arrangement = buildArrangement(inputs),
    face = facesAt(arrangement, { x: 10, y: 10 })[0],
    fill = createFaceFill(p, layers[0].pattern, layers[0].scene, face, arrangement, inputs, style);
  a.sourceGeometry.unshift(fill);
  expect(fill.fillRegion?.scope).toBe('orbit');
  expect(fill.fillRegion?.orbitMatrices).toHaveLength(1);
  let scene = buildScene(resolvePattern(a, p), bounds);
  expect(sceneLayers(scene, a).map((l) => l.kind)).toEqual(['fill', 'motif']);
  let result = prepareExport(p, options(a.id));
  expect(result.geometries[0].fill).toBe('#ef3344');
  a.sourceGeometry.push(a.sourceGeometry.shift()!);
  scene = buildScene(resolvePattern(a, p), bounds);
  expect(sceneLayers(scene, a).map((l) => l.kind)).toEqual(['motif', 'fill']);
  result = prepareExport(p, options(a.id));
  expect(result.geometries.at(-1)?.fill).toBe('#ef3344');
  expect(parseProject(serialize(p))).toEqual(p);
});

it('región excesiva se rechaza antes de añadir una entidad incompatible con el archivo', () => {
  const { p, pattern } = prepared(),
    effective = resolvePattern(pattern, p),
    scene = buildScene(effective, bounds),
    inputs = collectFillInputs([{ pattern: effective, scene }], bounds),
    arrangement = buildArrangement(inputs),
    face = facesAt(arrangement, { x: 10, y: 10 })[0];
  expect(() =>
    createFaceFill(
      p,
      effective,
      scene,
      { ...face, key: 'x'.repeat(200001) },
      arrangement,
      inputs,
      style,
    ),
  ).toThrow(/almacenamiento/);
  expect(() =>
    createFaceFill(
      p,
      effective,
      scene,
      { ...face, refs: Array.from({ length: 10001 }, () => face.refs[0]) },
      arrangement,
      inputs,
      style,
    ),
  ).toThrow(/almacenamiento/);
  expect(pattern.sourceGeometry).toHaveLength(5);
});
