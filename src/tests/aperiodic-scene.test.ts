import { axesFingerprint, fillContext } from '../fill/service';
import { apply } from '../geometry/matrix';
import { describe, expect, it } from 'vitest';
import { aperiodicExamples } from '../examples/aperiodic';
import { buildScene } from '../patterns/engine';
import { sceneLayers } from '../patterns/layers';
import { parseProject, serialize } from '../persistence/schema';
import { commonRectangularCell, resolvePattern } from '../symmetry/config';
import { prepareExport } from '../export/svg';
import { generate } from '../generators';
const view = { x: -150, y: -150, width: 300, height: 300 };
describe('Hat/Spectre integrados, fuente única y archivos', () => {
  it('culling conserva IDs/clases, y la apariencia no invalida caras', () => {
    const p = aperiodicExamples[1].create(),
      pat = p.patterns[0];
    pat.generator.frequency = 4;
    const full = buildScene(pat, view),
      id = pat.id,
      fingerprint = axesFingerprint(p),
      context = fillContext(p, [id]);
    const q = apply(full.generated.placements[4000], { x: 10, y: 0 }),
      crop = buildScene(pat, { x: q.x - 1, y: q.y - 1, width: 2, height: 2 }, undefined, 10);
    expect(crop.generated.placements.length).toBeGreaterThan(0);
    expect(crop.generated.placements.length).toBeLessThan(full.generated.placements.length);
    for (const [i, key] of crop.generated.aperiodic!.ids.entries()) {
      const original = full.generated.aperiodic!.ids.indexOf(key);
      expect(crop.generated.placements[i]).toEqual(full.generated.placements[original]);
      expect(crop.generated.aperiodic!.classes[i]).toBe(
        full.generated.aperiodic!.classes[original],
      );
    }
    pat.generator.aperiodic!.palette[0] = '#ee3366';
    pat.generator.aperiodic!.generation = 3;
    pat.generator.aperiodic!.showHierarchy = false;
    expect(axesFingerprint(p)).toBe(fingerprint);
    expect(fillContext(p, [id])).toBe(context);
  });
  for (const entry of aperiodicExamples)
    it(`${entry.id}: nativo, finito, paleta y fuente intacta`, () => {
      const p = entry.create(),
        pat = resolvePattern(p.patterns[0], p),
        source = structuredClone(pat.sourceGeometry),
        scene = buildScene(pat, view);
      expect(parseProject(serialize(p))).toEqual(p);
      expect(p.metadata.example?.validity).toBe('EXACT');
      expect(scene.status).toBe('FINITE_NONPERIODIC');
      expect(scene.instances).toHaveLength(1);
      expect(commonRectangularCell([pat])).toBeNull();
      for (const target of ['tile', 'lattice', 'fundamental'] as const)
        expect(() =>
          prepareExport(p, {
            patternId: pat.id,
            target,
            format: 'svg',
            representation: 'editable',
            width: 180,
            height: 140,
            dpi: 96,
            background: '#fff',
            transparent: true,
            quality: 1,
            tolerance: 0.02,
            outlineStrokes: true,
          }),
        ).toThrow();
      if (scene.generated.aperiodic) {
        const a = scene.generated.aperiodic,
          layers = sceneLayers(scene, pat),
          bodies = layers.filter(
            (l) => l.kind === 'motif' && l.geometry.some((g) => g.id === a.bodyId),
          );
        expect(scene.generated.geometry.filter((g) => g.id === a.bodyId)).toHaveLength(1);
        expect(bodies.length).toBeGreaterThan(1);
        expect(
          bodies.reduce((sum, l) => sum + (l.kind === 'motif' ? l.placements!.length : 0), 0),
        ).toBe(scene.generated.placements.length);
        expect(scene.generated.geometry.length).toBeLessThan(4);
        expect(pat.sourceGeometry).toEqual(source);
        const broken = structuredClone(p);
        broken.patterns[0].generator.version = 1;
        expect(() => parseProject(serialize(broken))).toThrow();
        const edited = structuredClone(pat);
        edited.sourceGeometry[0].pathData =
          edited.generator.kind === 'hat' ? 'M5 -5L12 -5' : 'M10 8L17 8';
        expect(
          buildScene(edited, view).generated.geometry.find((g) => g.id === source[0].id)!.pathData,
        ).not.toBe(scene.generated.geometry.find((g) => g.id === source[0].id)!.pathData);
        expect(edited.sourceGeometry).toHaveLength(1);
        edited.generator.kind = 'motif';
        expect(generate(edited.generator, edited.sourceGeometry).geometry).toEqual(
          edited.sourceGeometry,
        );
      }
    });
});
