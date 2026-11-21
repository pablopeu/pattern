import { finiteGenerator } from '../aperiodic/model';
import type { Pattern, Geometry, Region } from '../app/model';
import { buildScene, expandedTransforms } from '../patterns/engine';
import { clipGeometry } from '../application/clipping';
import { IDENTITY } from '../geometry/matrix';
import type { Bounds } from '../symmetry/groups';
/** Export-only derived template; never replaces canonical source geometry. */
export function materializeTiling(
  pattern: Pattern,
  view: Bounds,
  outlineStrokes = true,
  tolerance = 0.02,
): Pattern {
  const t = pattern.tiling;
  if (!t || finiteGenerator(pattern.generator)) return pattern;
  const scene = buildScene(pattern, view),
    inner = scene.tiling!.inner,
    boundary = scene.tiling!.boundary,
    region: Region = { id: 'tile-clip', name: 'Interior de tesela', geometry: [boundary] },
    geometry: Geometry[] = [],
    transforms = expandedTransforms(inner);
  if (transforms.length * inner.generated.geometry.length > 150000)
    throw Error(
      'El motivo de la tesela excede el límite de exportación. Simplificá su simetría o generador.',
    );
  for (const matrix of transforms)
    for (const source of inner.generated.geometry)
      geometry.push(...clipGeometry(source, region, matrix, outlineStrokes, tolerance));
  const original = scene.fills.map(({ geometry: g, matrices }) => ({
    ...g,
    fillRegion: {
      ...g.fillRegion!,
      scope: 'orbit' as const,
      orbitMatrices: matrices,
      linked: false,
      status: 'fixed' as const,
    },
  }));
  return {
    ...pattern,
    tiling: undefined,
    sourceGeometry: [...original, ...geometry],
    placementTransform: IDENTITY,
    symmetryMode: 'own',
    symmetry: { ...pattern.symmetry, family: 'none', group: 'none' },
    generator: {
      ...pattern.generator,
      kind: 'freeform',
      placements: scene.tiling!.tiles.map((tile) => tile.matrix),
    },
  };
}
