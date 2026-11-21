import { describe, expect, it } from 'vitest';
import { geometry, newProject, node } from '../app/model';
import { defaultComposition } from '../composition/model';
import { generatedBounds } from '../composition/generated';
import { buildScene, expandedTransforms } from '../patterns/engine';
import { sceneLayers } from '../patterns/layers';
import { parseProject, serialize } from '../persistence/schema';
import { parsePreset } from '../persistence/presets';
import { prepareExport, type ExportOptions } from '../export/svg';
import { commonRectangularCell } from '../symmetry/config';
import { newTiling } from '../tiling/tiles';
import { apply, multiply, rotate, translate } from '../geometry/matrix';
import { axesFingerprint, collectFillInputs, createTileFill, fillContext } from '../fill/service';
import { drawingStyle } from '../app/styles';
import { exampleCatalog } from '../examples/catalog';

function fixture() {
  const project = newProject(),
    pattern = project.patterns[0];
  pattern.symmetryMode = 'own';
  pattern.symmetry = { ...pattern.symmetry, family: 'wallpaper', group: 'p3', width: 60 };
  const body = geometry('path', [node(0, 0), node(20, 0), node(20, 10), node(0, 10)], true);
  body.fill = '#c78039';
  body.stroke = 'none';
  const eye = geometry('ellipse', [], true);
  eye.parameters = { x: 12, y: 2, width: 2, height: 2, radius: 0, sides: 4 };
  eye.fill = '#ffffff';
  eye.stroke = 'none';
  pattern.sourceGeometry = [body, eye];
  pattern.composition = defaultComposition('recursive', { x: 0, y: 0, width: 20, height: 10 });
  pattern.composition.colorByLevel = true;
  if (pattern.composition.kind === 'recursive') pattern.composition.depth = 1;
  return project;
}
const viewport = { x: -100, y: -100, width: 200, height: 200 };
describe('composición integrada con fuente/archivos/Scene', () => {
  it('todos los ejemplos nuevos son originales, portables y reproducen la misma disposición', () => {
    expect(exampleCatalog).toHaveLength(12);
    expect(new Set(exampleCatalog.map((e) => e.id)).size).toBe(12);
    for (const entry of exampleCatalog.filter((e) => e.featured)) {
      const project = entry.create(),
        restored = parseProject(serialize(project));
      expect(project.metadata.example?.artwork).toBe('original');
      expect(project.metadata.example?.references).toEqual(entry.references);
      for (const reference of entry.references) expect(reference.url).toMatch(/^https:\/\//);
      expect(restored).toEqual(project);
      const a = buildScene(project.patterns[0], viewport),
        b = buildScene(entry.create().patterns[0], viewport);
      expect(a.generated.placements).toEqual(b.generated.placements);
      expect(a.generated.composition!.ids).toEqual(b.generated.composition!.ids);
      expect(a.generated.geometry.length).toBeLessThan(12);
    }
  });
  it('culling respeta la colocación, IDs y tinta editada fuera del marco original', () => {
    const p = fixture().patterns[0];
    p.placementTransform = multiply(translate(21, -13), rotate(23));
    p.sourceGeometry[0].stroke = '#000000';
    p.sourceGeometry[0].transform = translate(80, 50);
    const full = buildScene(p, viewport),
      m = full.generated.placements[0],
      point = apply(m, { x: 90, y: 55 }),
      crop = { x: point.x - 1, y: point.y - 1, width: 2, height: 2 },
      visible = buildScene(p, crop, undefined, 8);
    expect(visible.generated.placements.length).toBeGreaterThan(0);
    expect(visible.generated.placements.length).toBeLessThan(full.generated.placements.length);
    expect(visible.generated.composition!.report.culled).toBeGreaterThan(0);
    for (const [i, id] of visible.generated.composition!.ids.entries())
      expect(visible.generated.placements[i]).toEqual(
        full.generated.placements[full.generated.composition!.ids.indexOf(id)],
      );
    const all = collectFillInputs([{ pattern: p, scene: full }], crop),
      culled = collectFillInputs([{ pattern: p, scene: visible }], crop);
    expect(culled.map((c) => c.id)).toEqual(all.map((c) => c.id));
    const lowDetail = buildScene(p, viewport, undefined, 0.01);
    expect(lowDetail.generated.composition!.report.detailOmitted).toBeGreaterThan(0);
    // Export/model evaluation never depends on the viewport's pixel scale.
    expect(buildScene(p, crop).generated.placements).toEqual(full.generated.placements);
  });
  it('Fill distingue cambios geométricos de paletas y suspende sólo el fondo de tesela', () => {
    const project = fixture(),
      p = project.patterns[0],
      context = fillContext(project, [p.id]),
      axes = axesFingerprint(project);
    p.composition!.palette[0] = '#123456';
    p.composition!.colorByLevel = !p.composition!.colorByLevel;
    expect(fillContext(project, [p.id])).toBe(context);
    expect(axesFingerprint(project)).toBe(axes);
    p.composition!.angle += 5;
    expect(fillContext(project, [p.id])).not.toBe(context);
    expect(axesFingerprint(project)).not.toBe(axes);
    p.tiling = newTiling('square');
    const background = createTileFill(
      project,
      p,
      {
        kind: 'tile',
        key: 'tile',
        pathData: '',
        patternId: p.id,
        matrix: [1, 0, 0, 1, 0, 0],
        z: 0,
      },
      drawingStyle({}),
    );
    const orbit = structuredClone(background);
    orbit.id = 'orbit';
    orbit.fillRegion!.scope = 'orbit';
    orbit.fillRegion!.kind = 'face';
    p.sourceGeometry.push(background, orbit);
    const source = structuredClone(p.sourceGeometry),
      finite = buildScene(p, viewport);
    expect(finite.fills.map((f) => f.geometry.id)).toEqual([orbit.id]);
    expect(finite.generated.geometry).toHaveLength(2);
    p.composition!.enabled = false;
    expect(buildScene(p, viewport).fills.map((f) => f.geometry.id)).toContain(background.id);
    expect(p.sourceGeometry).toEqual(source);
  });
  it('evalúa matrices finitas, suspende wallpaper y conserva fuente/configuración anterior', () => {
    const project = fixture(),
      p = project.patterns[0],
      original = structuredClone(p);
    p.tiling = newTiling('square');
    const scene = buildScene(p, viewport);
    expect(scene.status).toBe('FINITE_NONPERIODIC');
    expect(scene.tiling).toBeUndefined();
    expect(scene.generated.geometry.map((g) => g.id)).toEqual(p.sourceGeometry.map((g) => g.id));
    expect(expandedTransforms(scene)).toHaveLength(24);
    expect(scene.generated.composition?.ids).toHaveLength(24);
    expect(commonRectangularCell([p])).toBeNull();
    expect(p.sourceGeometry).toEqual(original.sourceGeometry);
    p.composition!.enabled = false;
    expect(buildScene(p, viewport).status).toBe('PERIODIC_SEAMLESS');
    expect(p.symmetry).toEqual(original.symmetry);
  });
  it('paleta por nivel comparte placements sin recolorear ojos ni modificar fuentes', () => {
    const project = fixture(),
      p = project.patterns[0],
      scene = buildScene(p, viewport),
      layers = sceneLayers(scene, p);
    const motif = layers.filter((l) => l.kind === 'motif');
    expect(motif).toHaveLength(2);
    expect(motif.reduce((n, l) => n + (l.placements?.length ?? 0), 0)).toBe(
      scene.generated.placements.length,
    );
    expect(motif[1].geometry[0].fill).toBe(p.composition!.palette[1]);
    expect(motif[1].geometry[1].fill).toBe('#ffffff');
    expect(p.sourceGeometry[0].fill).toBe('#c78039');
    const bounds = generatedBounds(scene.generated);
    expect(bounds.width).toBeGreaterThan(80);
    expect(bounds.width).toBeLessThanOrEqual(150);
  });
  it('JSON5/preset5/snapshot conservan recetas sin cachés y migración4 no cambia geometría', () => {
    const project = fixture(),
      p = project.patterns[0];
    project.metadata.example = {
      id: 'original',
      category: 'recursive',
      description: 'Original',
      construction: 'Anillos afines',
      validity: 'EXACT',
      artwork: 'original',
      author: 'Pattern Studio',
      references: [],
    };
    project.applications = [
      {
        id: 'snapshot',
        name: 'Snapshot',
        patternId: p.id,
        regionId: 'region',
        placementTransform: [1, 0, 0, 1, 0, 0],
        linked: false,
        frozenPattern: structuredClone(p),
        showOutline: false,
      },
    ];
    project.regions = [{ id: 'region', name: 'Región', geometry: [p.sourceGeometry[0]] }];
    project.regions[0].geometry = [{ ...p.sourceGeometry[0], id: 'region-shape' }];
    const text = serialize(project),
      restored = parseProject(text);
    expect(restored).toEqual(project);
    expect(text).not.toContain('composition/source-');
    expect(restored.applications[0].frozenPattern?.composition).toEqual(p.composition);
    const preset = parsePreset(JSON.stringify({ presetVersion: 5, pattern: p }));
    expect(preset.composition).toEqual(p.composition);
    expect(preset.id).not.toBe(p.id);
    const legacy = { ...newProject(), schemaVersion: 4 };
    legacy.patterns[0].sourceGeometry = structuredClone(p.sourceGeometry);
    expect(parseProject(JSON.stringify(legacy)).patterns).toEqual(legacy.patterns);
    const malformed = structuredClone(project);
    malformed.patterns[0].composition!.sourceFrame.width = 0;
    expect(() => parseProject(JSON.stringify(malformed))).toThrow();
  });
  it('SVG editable/expandido conserva colores y no ofrece una celda periódica falsa', () => {
    const project = fixture(),
      p = project.patterns[0];
    const options: ExportOptions = {
      patternId: p.id,
      target: 'view',
      format: 'svg',
      representation: 'editable',
      width: 180,
      height: 180,
      dpi: 96,
      background: '#ffffff',
      transparent: true,
      quality: 1,
      tolerance: 0.02,
      outlineStrokes: true,
    };
    p.symmetryMode = 'free';
    const editable = prepareExport(project, options);
    expect(editable.svg).toContain(p.composition!.palette[1]);
    expect(editable.svg).toContain('#ffffff');
    expect(editable.svg).toContain('<use');
    expect(editable.svg).toContain('<defs><g id="motif"');
    const expanded = prepareExport(project, { ...options, representation: 'expanded' });
    expect(expanded.svg).not.toContain('<use');
    expect(new Set(expanded.geometries.map((g) => g.fill))).toContain(p.composition!.palette[1]);
    expect(expanded.geometries.length).toBeGreaterThan(20);
    for (const target of ['tile', 'lattice', 'fundamental'] as const)
      expect(() => prepareExport(project, { ...options, target })).toThrow(/finita/);
  });
});
