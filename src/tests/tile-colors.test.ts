import { describe, it, expect } from 'vitest';
import { newProject } from '../app/model';
import {
  newIsohedralTiling,
  tileBasis,
  tilePaintBasis,
  tileCellCorners,
  tileInstances,
} from '../tiling/tiles';
import { tileColorIndex, geometricTiling } from '../tiling/colors';
import { supportedIsohedralTypes } from '../isohedral/engine';
import { parseProject, serialize } from '../persistence/schema';
import { figurativeExamples } from '../examples/figurative';
import { buildScene } from '../patterns/engine';
import { fillContext, axesFingerprint } from '../fill/service';
import { collectFillInputs } from '../fill/service';
import { prepareExport } from '../export/svg';
describe('alternancia de color y celda exportable', () => {
  for (const type of supportedIsohedralTypes)
    it(`IH${type}: clases periódicas y geometría independiente del color`, () => {
      const t = newIsohedralTiling(type),
        basis = tileBasis(t),
        before = tileInstances(t, { x: -50, y: -50, width: 100, height: 100 }).map((t) => t.matrix);
      t.version = 2;
      t.colors = { enabled: true, palette: ['#c78046', '#e3c792', '#71978c'] };
      expect(tileBasis(t)).toEqual(basis);
      expect(
        tileInstances(t, { x: -50, y: -50, width: 100, height: 100 }).map((t) => t.matrix),
      ).toEqual(before);
      const paint = tilePaintBasis(t);
      for (let k = 0; k < 4; k++) expect(paint[k]).toBeCloseTo(basis[k] * 3, 8);
      for (const tile of tileInstances(t, { x: -100, y: -100, width: 200, height: 200 }).slice(
        0,
        30,
      )) {
        expect(tileColorIndex(t, tile)).toBe(
          tileColorIndex(t, { ...tile, cell: [tile.cell[0] + 3, tile.cell[1] - 6] }),
        );
        expect(tileColorIndex(t, tile)).toBeGreaterThanOrEqual(0);
        expect(tileColorIndex(t, tile)).toBeLessThan(3);
      }
    });
  it('paleta no invalida vínculos ni ejes; fuente única y grupos pintados conservan todos los tiles', () => {
    const p = figurativeExamples[0].create(),
      pat = p.patterns[0],
      original = structuredClone(pat.sourceGeometry),
      context = fillContext(p, [pat.id]),
      fingerprint = axesFingerprint(p),
      scene = buildScene(pat, { x: -100, y: -100, width: 200, height: 200 });
    expect(scene.fills).toHaveLength(2);
    expect(() =>
      collectFillInputs([{ pattern: pat, scene }], { x: -100, y: -100, width: 200, height: 200 }),
    ).not.toThrow();
    expect(new Set(scene.fills.map((f) => f.geometry.fill)).size).toBe(2);
    expect(scene.fills.reduce((sum, f) => sum + f.matrices.length, 0)).toBe(
      scene.tiling!.tiles.length,
    );
    expect(pat.sourceGeometry).toEqual(original);
    pat.tiling!.colors!.palette[1] = '#ee3344';
    expect(fillContext(p, [pat.id])).toBe(context);
    expect(axesFingerprint(p)).toBe(fingerprint);
    expect(parseProject(serialize(p))).toEqual(p);
    const old = structuredClone(pat.tiling!);
    old.version = 1;
    expect(geometricTiling(old)).not.toHaveProperty('colors');
    const invalid = newProject();
    invalid.patterns[0].tiling = old;
    expect(() => parseProject(serialize(invalid))).toThrow();
  });
  it('SVG lattice incluye la supercelda de color, no la celda geométrica incompleta', () => {
    const p = figurativeExamples[0].create(),
      pat = p.patterns[0],
      t = pat.tiling!,
      corners = tileCellCorners(t),
      svg = prepareExport(p, {
        patternId: pat.id,
        target: 'lattice',
        format: 'svg',
        representation: 'editable',
        width: 180,
        height: 140,
        dpi: 96,
        background: '#ffffff',
        transparent: false,
        quality: 1,
        tolerance: 0.02,
        outlineStrokes: true,
      });
    expect(svg.bounds.width).toBeCloseTo(
      Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x)),
      6,
    );
    expect(svg.svg).toContain(t.colors!.palette[0]);
    expect(svg.svg).toContain(t.colors!.palette[1]);
  });
});
