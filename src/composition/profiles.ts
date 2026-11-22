import type { Pattern } from '../app/model';
import type { Composition } from './model';
const key = (c: Composition) => `${c.kind}:${c.recipe}`;
export function rememberComposition(pattern: Pattern) {
  const c = pattern.composition;
  if (!c) return;
  pattern.compositionProfiles ??= {};
  pattern.compositionProfiles[c.kind] = structuredClone(c);
  pattern.compositionProfiles[key(c)] = structuredClone(c);
}
const common = (c: Composition) => ({
  size: c.size,
  center: structuredClone(c.center),
  sourceFrame: structuredClone(c.sourceFrame),
  minSize: c.minSize,
  colorByLevel: c.colorByLevel,
  palette: [...c.palette],
});
/** Family exploration remembers each last view and never rewrites the motif. */
export function switchCompositionFamily(pattern: Pattern, definition: Composition) {
  const previous = pattern.composition;
  rememberComposition(pattern);
  const saved = pattern.compositionProfiles?.[definition.kind];
  pattern.composition = structuredClone(
    saved ?? { ...definition, ...(previous ? common(previous) : {}) },
  );
  pattern.composition.enabled = true;
  rememberComposition(pattern);
}
export function switchCompositionRecipe(pattern: Pattern, recipe: Composition['recipe']) {
  const c = pattern.composition;
  if (!c) return;
  rememberComposition(pattern);
  const saved = pattern.compositionProfiles?.[`${c.kind}:${recipe}`];
  if (saved) {
    pattern.composition = structuredClone(saved);
    rememberComposition(pattern);
    return;
  }
  if (c.kind === 'recursive') {
    if (!['square-limit', 'henderson', 'quadrants', 'branching'].includes(recipe))
      throw Error('Receta recursiva inválida.');
    c.recipe = recipe as typeof c.recipe;
    if (recipe === 'henderson') {
      c.depth = Math.min(c.depth, 5);
      c.angle = 0;
      c.mirror = false;
    }
  } else {
    if (!['discrete', 'logarithmic', 'rosette', 'fixed-point'].includes(recipe))
      throw Error('Receta espiral inválida.');
    c.recipe = recipe as typeof c.recipe;
    if (recipe === 'rosette') c.arms = 6;
    if (recipe === 'fixed-point') {
      c.angle = 0;
      c.ratio = 0.85;
      c.offset = { x: 0, y: 0 };
    }
  }
  rememberComposition(pattern);
}
/** Loading a named saved preset is deliberate; family exploration uses the helper above. */
export function applyCompositionPreset(pattern: Pattern, definition: Composition) {
  rememberComposition(pattern);
  pattern.composition = structuredClone(definition);
  rememberComposition(pattern);
}
