import type { Geometry, Pattern } from '../app/model';
import type { Scene } from './engine';
import type { Matrix } from '../geometry/matrix';
export type SceneLayer =
  | { kind: 'motif'; geometry: Geometry[] }
  | { kind: 'fill'; geometry: Geometry; matrices: Matrix[] };
/** Preserve canonical layer order even when some regions have restricted instance orbits. */
export function sceneLayers(scene: Scene, pattern: Pattern): SceneLayer[] {
  const order = new Map(pattern.sourceGeometry.map((g, i) => [g.id, i])),
    rank = (g: Geometry) => order.get(g.id) ?? pattern.sourceGeometry.length,
    fills = [...scene.fills].sort((a, b) => rank(a.geometry) - rank(b.geometry)),
    result: SceneLayer[] = [];
  const generated = new Set(
    scene.generated.geometry.filter((g) => !order.has(g.id)).map((g) => g.id),
  );
  // Generated faces (e.g. Penrose) have their own opaque colors. Paint those
  // backgrounds before canonical Fill regions, and leave their original strokes
  // in the normal motif pass so a new fill cannot hide the perimeter.
  const fillsGeneratedFace = pattern.sourceGeometry.some(
    (g) =>
      g.visible &&
      g.fillRegion?.kind === 'face' &&
      g.fillRegion.refs.some((ref) => ref.patternId === pattern.id && generated.has(ref.shapeId)),
  );
  const backgrounds = fillsGeneratedFace
    ? scene.generated.geometry.filter((g) => generated.has(g.id) && g.fill !== 'none')
    : [];
  const split = new Set(backgrounds.map((g) => g.id));
  if (backgrounds.length)
    result.push({ kind: 'motif', geometry: backgrounds.map((g) => ({ ...g, stroke: 'none' })) });
  let remaining = scene.generated.geometry.map((g) =>
    split.has(g.id) ? { ...g, fill: 'none' } : g,
  );
  for (const fill of fills) {
    const before = remaining.filter((g) => rank(g) < rank(fill.geometry));
    remaining = remaining.filter((g) => rank(g) >= rank(fill.geometry));
    if (before.length) result.push({ kind: 'motif', geometry: before });
    result.push({ kind: 'fill', ...fill });
  }
  if (remaining.length || !result.some((l) => l.kind === 'motif'))
    result.push({ kind: 'motif', geometry: remaining });
  return result;
}
