import { recalculateRegion } from '../fill/recalculate';
import { previewSVG } from '../ui/SymmetryGallery';
import { generate } from '../generators';
import { sceneLayers } from '../patterns/layers';
import { describe, it, expect } from 'vitest';
import { newProject, newPattern, geometry, node, type Geometry } from '../app/model';
import { defaultDrawingStyle } from '../app/styles';
import { buildScene } from '../patterns/engine';
import { resolvePattern } from '../symmetry/config';
import { buildArrangement, facesAt } from '../fill/planar';
import {
  equivalentFaces,
  fillCandidatesAt,
  collectFillInputs,
  localFillArrangement,
  createFaceFill,
  createTileFill,
  immediateFillCandidates,
  refreshLinkedFills,
} from '../fill/service';
import { IDENTITY, scale, translate } from '../geometry/matrix';
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

it('recolorear desde otra celda reutiliza el objeto derivado y omite una cara idéntica', () => {
  const { p, pattern, fill } = prepared(true),
    effective = resolvePattern(pattern, p),
    scene = buildScene(effective, bounds),
    layers = [{ pattern: effective, scene }],
    a = buildArrangement(collectFillInputs(layers, bounds)),
    point = { x: 30, y: 30 },
    candidates = fillCandidatesAt(layers, point, facesAt(a, point));
  expect(candidates[0]).toMatchObject({ kind: 'object', shapeId: fill.id, derived: true });
  expect(candidates.some((c) => c.kind === 'face')).toBe(false);
  expect(pattern.sourceGeometry).toHaveLength(3);
});
it('miniaturas muestran órbitas/fondos y una preparación externa no duplica la fuente Fill', () => {
  const { p, pattern, fill } = prepared(),
    effective = resolvePattern(pattern, p),
    precomputed = generate(pattern.generator, pattern.sourceGeometry),
    scene = buildScene(effective, bounds, precomputed);
  expect(scene.generated.geometry.filter((g) => g.id === fill.id)).toHaveLength(1);
  expect(previewSVG(effective, bounds, precomputed).match(/fill="#ef3344"/g) ?? []).toHaveLength(1);
  fill.fillRegion!.scope = 'orbit';
  expect(previewSVG(resolvePattern(pattern, p), bounds)).toContain('fill="#ef3344"');
  const tileProject = newProject(),
    tile = tileProject.patterns[0];
  tile.tiling = newTiling('square');
  const tileEffective = resolvePattern(tile, tileProject),
    tileScene = buildScene(tileEffective, bounds),
    candidate = immediateFillCandidates([{ pattern: tileEffective, scene: tileScene }], {
      x: 10,
      y: 10,
    }).find((c) => c.kind === 'tile')!;
  if (candidate.kind !== 'tile') throw Error();
  tile.sourceGeometry.push(createTileFill(tileProject, tile, candidate, style));
  expect(previewSVG(resolvePattern(tile, tileProject), bounds)).toContain('fill="#ef3344"');
});
it('un conjunto capturado ajeno a la frontera no invalida un contexto intacto', () => {
  const p = newProject(),
    pattern = p.patterns[0],
    other = newPattern();
  pattern.sourceGeometry = source();
  other.sourceGeometry = [geometry('path', [node(50, 50), node(55, 50)])];
  p.patterns.push(other);
  const layers = p.patterns.map((pattern) => {
      const effective = resolvePattern(pattern, p);
      return { pattern: effective, scene: buildScene(effective, bounds) };
    }),
    inputs = collectFillInputs(layers, bounds),
    a = buildArrangement(inputs),
    face = facesAt(a, { x: 10, y: 10 })[0],
    fill = createFaceFill(p, layers[0].pattern, layers[0].scene, face, a, inputs, style);
  pattern.sourceGeometry.unshift(fill);
  expect(fill.fillRegion?.scope).toBe('orbit');
  expect(refreshLinkedFills(p).get(fill.id)?.fillRegion?.status).toBe('linked');
});
it('hacer un límite completamente transparente invalida el vínculo sin borrar la región', () => {
  const { p, pattern, fill } = prepared();
  pattern.sourceGeometry[2].opacity = 0;
  const updated = refreshLinkedFills(p).get(fill.id)!;
  expect(updated.fillRegion?.status).toBe('stale');
  expect(updated.pathData).toBe(fill.pathData);
});

it('recálculo explícito vuelve a vincular una cara equivalente tras cambiar de grupo', () => {
  const { p, pattern, fill } = prepared();
  p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p1', width: 60, height: 60 };
  const stale = refreshLinkedFills(p).get(fill.id)!;
  expect(stale.fillRegion?.status).toBe('stale');
  pattern.sourceGeometry[0] = stale;
  const before = serialize(p),
    updated = recalculateRegion(p, fill.id, IDENTITY);
  expect(updated.id).toBe(fill.id);
  expect(updated.fill).toBe(fill.fill);
  expect(updated.fillRegion?.status).toBe('linked');
  expect(updated.fillRegion?.context).not.toBe(fill.fillRegion?.context);
  expect(area(updated)).toBeCloseTo(400);
  expect(serialize(p)).toBe(before);
});
it('recálculo rechaza cambio de topología o relleno bloqueado y conserva el anterior', () => {
  const { p, pattern, fill } = prepared(),
    before = fill.pathData;
  pattern.sourceGeometry.push({ ...geometry('compound'), pathData: 'M0 10L20 10' });
  expect(() => recalculateRegion(p, fill.id, IDENTITY)).toThrow(/equivalente/);
  expect(fill.pathData).toBe(before);
  fill.locked = true;
  expect(() => recalculateRegion(p, fill.id, IDENTITY)).toThrow(/Desbloqueá/);
});
it('recálculo explícito adopta familia nueva de tesela conservando estilo y entidad', () => {
  const p = newProject(),
    pattern = p.patterns[0];
  pattern.tiling = newTiling('square');
  const effective = resolvePattern(pattern, p),
    scene = buildScene(effective, bounds),
    candidate = immediateFillCandidates([{ pattern: effective, scene }], { x: 10, y: 10 }).find(
      (c) => c.kind === 'tile',
    )!;
  if (candidate.kind !== 'tile') throw Error();
  const fill = createTileFill(p, pattern, candidate, { ...style, fillOpacity: 0.4 });
  pattern.sourceGeometry = [fill];
  pattern.tiling = newTiling('hexagon');
  const update = recalculateRegion(p, fill.id, IDENTITY);
  expect(update.id).toBe(fill.id);
  expect(update.fillOpacity).toBe(0.4);
  expect(update.fillRegion?.status).toBe('linked');
  expect(update.fillRegion?.context).toContain('hexagon');
  expect(area(update)).toBeGreaterThan(0);
});

it('equivalencia de regiones admite recorrido invertido, incluidos huecos orientados', () => {
  const a = 'M0 0L20 0L20 20L0 20Z M5 5L5 15L15 15L15 5Z',
    b = 'M0 0L0 20L20 20L20 0Z M5 5L15 5L15 15L5 15Z';
  expect(equivalentFaces(a, b)).toBe(true);
  expect(equivalentFaces(a, 'M0 0L20 0L20 20L0 20Z')).toBe(false);
});
it('órbita concreta verifica también una copia reflejada con orientación opuesta', () => {
  const p = newProject(),
    pattern = p.patterns[0];
  pattern.generator.kind = 'freeform';
  pattern.generator.placements = [IDENTITY, scale(-1, 1)];
  pattern.sourceGeometry = ['M10 2L14 2', 'M14 2L14 5', 'M14 5L10 5', 'M10 5L10 2'].map(
    (pathData) => ({ ...geometry('compound'), pathData }),
  );
  const effective = resolvePattern(pattern, p),
    scene = buildScene(effective, bounds),
    inputs = collectFillInputs([{ pattern: effective, scene }], bounds),
    arrangement = buildArrangement(inputs),
    face = facesAt(arrangement, { x: 12, y: 3.5 })[0],
    fill = createFaceFill(p, effective, scene, face, arrangement, inputs, style);
  expect(fill.fillRegion?.scope).toBe('orbit');
  expect(fill.fillRegion?.orbitMatrices).toHaveLength(2);
});

it('vínculo de cara entre teselas sigue perfiles válidos y no depende del overlay de contorno', () => {
  const p = newProject(),
    pattern = p.patterns[0];
  pattern.tiling = newTiling('square');
  pattern.sourceGeometry = [
    geometry('path', [node(-5, 15), node(65, 15)]),
    geometry('path', [node(15, -5), node(15, 65)]),
  ];
  const view = { x: -20, y: -20, width: 130, height: 130 },
    effective = resolvePattern(pattern, p),
    scene = buildScene(effective, view),
    inputs = collectFillInputs([{ pattern: effective, scene }], view),
    arrangement = buildArrangement(inputs),
    face = facesAt(arrangement, { x: 45, y: 45 })[0],
    fill = createFaceFill(p, effective, scene, face, arrangement, inputs, style);
  pattern.sourceGeometry.unshift(fill);
  expect(fill.fillRegion?.scope).toBe('orbit');
  expect(area(fill)).toBeCloseTo(3600);
  pattern.tiling.showOutline = !pattern.tiling.showOutline;
  let update = refreshLinkedFills(p).get(fill.id)!;
  expect(update.fillRegion?.status).toBe('linked');
  pattern.sourceGeometry[0] = update;
  pattern.tiling.edges[0][1].y = 0.02;
  update = refreshLinkedFills(p).get(fill.id)!;
  expect(update.fillRegion?.status).toBe('linked');
  expect(area(update)).toBeCloseTo(3600);
});
it('una órbita vinculada no propaga un contorno editado donde dejó de ser una cara', () => {
  const p = newProject(),
    a = p.patterns[0],
    b = newPattern();
  p.patterns.push(b);
  a.generator.kind = 'freeform';
  a.generator.placements = [IDENTITY, translate(40, 0)];
  a.sourceGeometry = ['M0 0L30 0', 'M0 20L30 20'].map((pathData) => ({
    ...geometry('compound'),
    pathData,
  }));
  b.sourceGeometry = [0, 20, 40, 60].map((x) => geometry('path', [node(x, 0), node(x, 20)]));
  const view = { x: -10, y: -10, width: 90, height: 50 },
    layers = p.patterns.map((raw) => {
      const pattern = resolvePattern(raw, p);
      return { pattern, scene: buildScene(pattern, view) };
    }),
    inputs = collectFillInputs(layers, view),
    arrangement = buildArrangement(inputs),
    face = facesAt(arrangement, { x: 10, y: 10 })[0],
    fill = createFaceFill(p, layers[0].pattern, layers[0].scene, face, arrangement, inputs, style);
  a.sourceGeometry.unshift(fill);
  expect(fill.fillRegion?.orbitMatrices).toHaveLength(2);
  b.sourceGeometry[1].transform = translate(5, 0);
  const update = refreshLinkedFills(p).get(fill.id)!;
  expect(update.fillRegion?.status).toBe('stale');
  expect(update.fillRegion?.reason).toContain('órbita');
  expect(update.pathData).toBe(fill.pathData);
});

it('recálculo vinculado respeta el marco afín editable del objeto', () => {
  const { p, fill } = prepared();
  fill.transform = translate(5, 7);
  const update = refreshLinkedFills(p).get(fill.id)!;
  expect(update.fillRegion?.status).toBe('linked');
  expect(update.transform).toEqual(fill.transform);
  const path = paperPath(update);
  expect(path.bounds.x).toBeCloseTo(0);
  expect(path.bounds.y).toBeCloseTo(0);
  expect(path.bounds.width).toBeCloseTo(20);
  path.remove();
  const tileProject = newProject(),
    tile = tileProject.patterns[0];
  tile.tiling = newTiling('square');
  const effective = resolvePattern(tile, tileProject),
    scene = buildScene(effective, bounds),
    candidate = immediateFillCandidates([{ pattern: effective, scene }], { x: 10, y: 10 }).find(
      (c) => c.kind === 'tile',
    )!;
  if (candidate.kind !== 'tile') throw Error();
  const background = createTileFill(tileProject, tile, candidate, style);
  background.transform = scale(2, 2);
  tile.sourceGeometry = [background];
  const updated = refreshLinkedFills(tileProject).get(background.id)!;
  expect(area(updated)).toBeCloseTo(3600);
  const rendered = buildScene(resolvePattern(tile, tileProject), bounds).fills[0].geometry;
  expect(area(rendered)).toBeCloseTo(3600);
});
it('fondo fijo conserva su fuente y se recorta al material de tesela nuevo', () => {
  const p = newProject(),
    pattern = p.patterns[0];
  pattern.tiling = newTiling('square');
  p.preferences.fillLinkedDefault = false;
  const effective = resolvePattern(pattern, p),
    scene = buildScene(effective, bounds),
    candidate = immediateFillCandidates([{ pattern: effective, scene }], { x: 10, y: 10 }).find(
      (c) => c.kind === 'tile',
    )!;
  if (candidate.kind !== 'tile') throw Error();
  const fill = createTileFill(p, pattern, candidate, style),
    nodes = structuredClone(fill.nodes);
  pattern.sourceGeometry = [fill];
  pattern.tiling.edges[0][1].y = 0.03;
  expect(refreshLinkedFills(p).has(fill.id)).toBe(false);
  const rendered = buildScene(resolvePattern(pattern, p), bounds).fills[0].geometry;
  expect(area(rendered)).toBeLessThan(3600);
  expect(area(rendered)).toBeGreaterThan(3400);
  expect(fill.nodes).toEqual(nodes);
  expect(area(fill)).toBeCloseTo(3600);
});

it('Fill local conserva huecos, índices y vínculo al superar 1200 curvas por repetición', () => {
  const p = newProject(),
    pattern = p.patterns[0];
  p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p1', width: 20, height: 20 };
  const sides = [
    [0, 0, 20, 0],
    [20, 0, 20, 20],
    [20, 20, 0, 20],
    [0, 20, 0, 0],
  ];
  pattern.sourceGeometry = sides.map(([x, y, ex, ey]) =>
    geometry(
      'path',
      Array.from({ length: 81 }, (_, i) => node(x + ((ex - x) * i) / 80, y + ((ey - y) * i) / 80)),
    ),
  );
  pattern.sourceGeometry.push({
    ...geometry('compound', [], true),
    pathData: 'M14 14L18 14L18 18L14 18Z',
  });
  const original = structuredClone(pattern.sourceGeometry);
  const effective = resolvePattern(pattern, p),
    scene = buildScene(effective, bounds),
    layers = [{ pattern: effective, scene }];
  expect(() => buildArrangement(collectFillInputs(layers, bounds))).toThrow(/1200/);
  const local = localFillArrangement(layers, bounds, { x: 4, y: 4 }, 0),
    face = facesAt(local.arrangement, { x: 4, y: 4 })[0];
  expect(face.area).toBeCloseTo(384);
  expect(local.arrangement.curves).toBeLessThanOrEqual(1200);
  expect(face.refs.some((ref) => ref.curve > 20)).toBe(true);
  const fill = createFaceFill(p, effective, scene, face, local.arrangement, local.inputs, style);
  expect(fill.fillRegion?.scope).toBe('source');
  pattern.sourceGeometry.unshift(fill);
  expect(pattern.sourceGeometry.slice(1)).toEqual(original);
  expect(refreshLinkedFills(p).get(fill.id)?.fillRegion?.status).toBe('linked');
  const recalculated = recalculateRegion(p, fill.id, fill.fillRegion!.captureMatrix);
  expect(recalculated.id).toBe(fill.id);
  expect(recalculated.fillRegion?.status).toBe('linked');
  expect(area(recalculated)).toBeCloseTo(384);
  expect(parseProject(serialize(p))).toEqual(p);
  expect(
    prepareExport(p, options(pattern.id)).geometries.filter((g) => g.fill === style.fill).length,
  ).toBeGreaterThan(1);
});
