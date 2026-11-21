import type { Pattern } from '../app/model';
import { isohedralLayout } from '../isohedral/engine';
import { isohedralDefinition } from '../tiling/tiles';
/** A single, untransformed motif can carry its linked tile silhouette into a composition. */
export function compositionSource(pattern: Pattern) {
  if (!pattern.tiling || pattern.symmetry.family !== 'none' || pattern.generator.kind !== 'motif')
    return pattern.sourceGeometry;
  if (
    pattern.tiling.isohedral &&
    isohedralLayout(isohedralDefinition(pattern.tiling)).motifSymmetries.length !== 1
  )
    return pattern.sourceGeometry;
  return pattern.sourceGeometry.map((g) =>
    g.fillRegion?.kind === 'tile' && g.fillRegion.scope === 'tile' && g.fillRegion.linked
      ? { ...g, fillRegion: { ...g.fillRegion, scope: 'source' as const } }
      : g,
  );
}
