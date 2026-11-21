import { scale, rotate, translate } from '../geometry/matrix';
import { prepareExport } from '../export/svg';
import { geometry, node } from '../app/model';
import { describe, it, expect } from 'vitest';
import { girihExamples } from '../examples/girih';
import { parseProject, serialize } from '../persistence/schema';
import { buildScene } from '../patterns/engine';
import { commonRectangularCell, resolvePattern } from '../symmetry/config';
import { generate } from '../generators';
import { fillContext, axesFingerprint } from '../fill/service';
const view = { x: -200, y: -200, width: 400, height: 400 };
describe('Girih integrado: parámetros canónicos, fuente y exportación', () => {
  for (const entry of girihExamples)
    it(`${entry.id}: JSON6/generador3, bandas derivadas, fuente preservada`, () => {
      const p = entry.create(),
        pattern = p.patterns[0],
        source = structuredClone(pattern.sourceGeometry),
        scene = buildScene(resolvePattern(pattern, p), view),
        report = scene.generated.girih!;
      expect(parseProject(serialize(p))).toEqual(p);
      expect(scene.status).toBe('FINITE_NONPERIODIC');
      expect(report.woven).toBe(true);
      expect(report.conflicts).toBe(0);
      expect(report.crossings).toBeGreaterThan(10);
      expect(commonRectangularCell([pattern])).toBeNull();
      expect(scene.generated.placements).toHaveLength(1);
      expect(pattern.sourceGeometry).toEqual(source);
      const fingerprint = axesFingerprint(p),
        context = fillContext(p, [pattern.id]);
      pattern.generator.girih!.palette[0] = '#ee2244';
      expect(axesFingerprint(p)).toBe(fingerprint);
      expect(fillContext(p, [pattern.id])).toBe(context);
      const old = structuredClone(p);
      old.patterns[0].generator.version = 2;
      expect(() => parseProject(serialize(old))).toThrow();
      pattern.generator.kind = 'motif';
      expect(generate(pattern.generator, pattern.sourceGeometry).geometry).toEqual(source);
      expect(parseProject(serialize(p)).patterns[0].generator.girih).toBeDefined();
    });
  it('ejes fuente conservados, conflicto explícito y muestra con cortes declarada artística', () => {
    const p = girihExamples[0].create(),
      g = p.patterns[0].generator;
    g.girih!.recipe = 'single';
    g.girih!.weaveSource = true;
    const source = [
        [
          [0, 3],
          [-3, -2],
          [3, -2],
        ],
        [
          [0, 0],
          [0, 5],
        ],
        [
          [0, 0],
          [-5, -3],
        ],
        [
          [0, 0],
          [5, -3],
        ],
      ].map((pts, i) => ({
        ...geometry(
          'path',
          pts.map(([x, y]) => node(x, y)),
          i === 0,
        ),
        fill: 'none',
      })),
      original = structuredClone(source);
    const strict = generate(g, source);
    expect(strict.girih!.conflicts).toBeGreaterThan(0);
    expect(strict.girih!.woven).toBe(false);
    expect(strict.girih!.validity).toBe('INVALID');
    g.girih!.allowBreaks = true;
    const cut = generate(g, source);
    expect(cut.girih!.woven).toBe(true);
    expect(cut.girih!.breaks).toBeGreaterThan(0);
    expect(cut.girih!.validity).toBe('ARTISTIC');
    expect(cut.sourceGeometry).toEqual(original);
    expect(source).toEqual(original);
  });
  it('congruencia, afinidad artística y tolerancia física se clasifican por la colocación', () => {
    const p = girihExamples[0].create(),
      pat = p.patterns[0];
    for (const matrix of [translate(10, 5), rotate(37), scale(2), scale(-1, 1)]) {
      pat.placementTransform = matrix;
      expect(buildScene(pat, view).generated.girih!.validity).toBe('EXACT');
    }
    for (const matrix of [scale(2, 1), [1, 0.3, 0, 1, 0, 0] as const]) {
      pat.placementTransform = matrix;
      expect(buildScene(pat, view).generated.girih!.validity).toBe('ARTISTIC');
    }
    pat.placementTransform = scale(2);
    pat.generator.girih!.weaveSource = true;
    const svg = prepareExport(p, {
      patternId: pat.id,
      target: 'view',
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
    }).svg;
    expect(svg).toContain('&quot;sourceToleranceWorld&quot;:0.04');
  });
  it('rechaza un custom con colisión al importar', () => {
    const p = girihExamples[0].create(),
      g = p.patterns[0].generator;
    g.girih!.recipe = 'custom';
    g.girih!.tiles = [
      { id: 'a', kind: 'decagon', matrix: [1, 0, 0, 1, 0, 0] },
      { id: 'b', kind: 'pentagon', matrix: [1, 0, 0, 1, 0, 0] },
    ];
    expect(() => parseProject(serialize(p))).toThrow(/superponen/);
  });
});
