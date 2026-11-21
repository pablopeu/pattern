import { describe, it, expect } from 'vitest';
import { figurativeExamples } from '../examples/figurative';
import { isohedralIssue } from '../isohedral/validate';
import { isohedralDefinition, tileBoundary, tileWorldBounds } from '../tiling/tiles';
import { buildScene } from '../patterns/engine';
import { parseProject, serialize } from '../persistence/schema';
import { pathData } from '../geometry/paths';
import { defaultComposition } from '../composition/model';
import { compositionSource } from '../composition/source';
import { prepareExport } from '../export/svg';

describe('figuras originales enlazadas con teselas verificadas', () => {
  for (const entry of figurativeExamples)
    it(`${entry.title}: silueta/detalles, native y modificación válida`, () => {
      const p = entry.create(),
        pattern = p.patterns[0],
        tile = pattern.tiling!,
        details = structuredClone(pattern.sourceGeometry.slice(1)),
        count = pattern.sourceGeometry.length;
      expect(isohedralIssue(isohedralDefinition(tile))).toBeNull();
      expect(parseProject(serialize(p))).toEqual(p);
      expect(p.metadata.example?.artwork).toBe('original');
      if (tile.isohedral!.type === 63) {
        const scene = buildScene(pattern, { x: -100, y: -100, width: 200, height: 200 });
        expect(scene.tiling!.inner.instances.length).toBeGreaterThanOrEqual(4);
        return;
      }
      const oldCache = structuredClone(pattern.sourceGeometry[0].nodes);
      tile.edges[0][1].y += 0.015;
      expect(isohedralIssue(isohedralDefinition(tile))).toBeNull();
      let scene = buildScene(pattern, { x: -100, y: -100, width: 200, height: 200 });
      const body = scene.fills.find(
        (g) => g.geometry.id === pattern.sourceGeometry[0].id,
      )!.geometry;
      expect(pathData(body)).toBe(pathData(tileBoundary(tile)));
      expect(body.nodes).not.toEqual(oldCache);
      expect(pattern.sourceGeometry[0].nodes).toEqual(oldCache);
      expect(pattern.sourceGeometry.slice(1)).toEqual(details);
      pattern.composition = defaultComposition('recursive', tileWorldBounds(tile));
      if (pattern.composition.kind === 'recursive') pattern.composition.depth = 1;
      scene = buildScene(pattern, { x: -100, y: -100, width: 200, height: 200 });
      expect(scene.generated.finite).toBe(true);
      expect(scene.tiling).toBeUndefined();
      expect(scene.generated.geometry).toHaveLength(count);
      expect(scene.generated.geometry.find((g) => g.id === body.id)!.fill).toBe(body.fill);
      const svg = prepareExport(p, {
        patternId: pattern.id,
        target: 'view',
        format: 'svg',
        representation: 'editable',
        width: 220,
        height: 160,
        dpi: 96,
        background: '#fff',
        transparent: false,
        quality: 1,
        tolerance: 0.02,
        outlineStrokes: true,
      }).svg;
      expect(svg).toContain(body.fill);
      expect(pattern.sourceGeometry).toHaveLength(count);
    });
  it('incorporar una silueta al motivo es explícito al componer y no altera originales ni tipos con marcas interiores', () => {
    const p = figurativeExamples[0].create().patterns[0];
    p.sourceGeometry[0].fillRegion!.scope = 'tile';
    expect(compositionSource(p)[0].fillRegion!.scope).toBe('source');
    expect(p.sourceGeometry[0].fillRegion!.scope).toBe('tile');
    const marked = figurativeExamples[3].create().patterns[0];
    expect(compositionSource(marked)[0].fillRegion!.scope).toBe('tile');
  });
});
