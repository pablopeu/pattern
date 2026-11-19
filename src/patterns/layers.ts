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
  let remaining = [...scene.generated.geometry];
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
