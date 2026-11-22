import { it, expect } from 'vitest';
import { functionalGeometryProject } from '../examples/functional-geometry';
import { defaultComposition } from '../composition/model';
import {
  rememberComposition,
  switchCompositionFamily,
  switchCompositionRecipe,
} from '../composition/profiles';
import { parseProject, serialize } from '../persistence/schema';
import { buildScene } from '../patterns/engine';
import { sceneLayers } from '../patterns/layers';
import { figurativeProject } from '../examples/figurative';
const bounds = { x: -100, y: -100, width: 200, height: 200 };
it('family and recipe exploration restores exact colors, placement and source frame after native reload', () => {
  let p = functionalGeometryProject(),
    pat = p.patterns[0],
    c = pat.composition!;
  c.colorByLevel = true;
  c.palette = ['#c46e45', '#326d70', '#dcc489'];
  c.size = 140;
  c.center = { x: 7, y: -5 };
  rememberComposition(pat);
  const original = structuredClone(c),
    source = structuredClone(pat.sourceGeometry),
    before = sceneLayers(buildScene(pat, bounds), pat);
  switchCompositionFamily(
    pat,
    defaultComposition('spiral', { x: -0.1, y: -0.1, width: 2, height: 2 }),
  );
  expect(pat.composition!.palette).toEqual(original.palette);
  expect(pat.composition!.colorByLevel).toBe(true);
  expect(pat.composition!.sourceFrame).toEqual(original.sourceFrame);
  switchCompositionRecipe(pat, 'rosette');
  pat.composition!.palette[0] = '#dd3366';
  rememberComposition(pat);
  p = parseProject(serialize(p));
  pat = p.patterns[0];
  switchCompositionFamily(
    pat,
    defaultComposition('recursive', { x: 0, y: 0, width: 2, height: 2 }),
  );
  expect(pat.composition).toEqual(original);
  expect(pat.sourceGeometry).toEqual(source);
  expect(sceneLayers(buildScene(pat, bounds), pat)).toEqual(before);
  switchCompositionRecipe(pat, 'branching');
  switchCompositionRecipe(pat, 'henderson');
  expect(pat.composition).toEqual(original);
  switchCompositionFamily(pat, defaultComposition('spiral', { x: 0, y: 0, width: 2, height: 2 }));
  expect(pat.composition!.recipe).toBe('rosette');
  expect(pat.composition!.palette[0]).toBe('#dd3366');
});
it('composing an IH silhouette never rewrites its canonical Fill scope or tile color data', () => {
  const p = figurativeProject('fish'),
    pat = p.patterns[0],
    source = structuredClone(pat.sourceGeometry),
    tiling = structuredClone(pat.tiling);
  switchCompositionFamily(
    pat,
    defaultComposition('recursive', { x: -40, y: -40, width: 80, height: 80 }),
  );
  const scene = buildScene(pat, bounds);
  expect(scene.generated.geometry.some((g) => g.fillRegion?.scope === 'source')).toBe(true);
  expect(pat.sourceGeometry).toEqual(source);
  expect(pat.tiling).toEqual(tiling);
  pat.composition!.enabled = false;
  buildScene(pat, bounds);
  expect(pat.sourceGeometry).toEqual(source);
  expect(pat.tiling).toEqual(tiling);
});
it('profile keys are bounded and must identify the stored family/recipe', () => {
  const p = functionalGeometryProject(),
    pat = p.patterns[0];
  rememberComposition(pat);
  expect(parseProject(serialize(p))).toEqual(p);
  pat.compositionProfiles!['spiral:rosette'] = pat.composition!;
  expect(() => parseProject(serialize(p))).toThrow(/Perfiles/);
});
