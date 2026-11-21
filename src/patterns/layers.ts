import { levelGeometry } from '../composition/generated';
import type { Geometry, Pattern } from '../app/model';
import type { Scene } from './engine';
import type { Matrix } from '../geometry/matrix';
export type SceneLayer =
  | { kind: 'motif'; geometry: Geometry[]; placements?: Matrix[]; level?: number }
  | { kind: 'fill'; geometry: Geometry; matrices: Matrix[] };
/** Derived region paint stays below its boundary strokes, regardless of creation order. */
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
  const remaining = scene.generated.geometry.map((g) =>
      split.has(g.id) ? { ...g, fill: 'none' } : g,
    ),
    sourceFills = remaining.filter((g) => g.fillRegion),
    motif = remaining.filter((g) => !g.fillRegion),
    paint: SceneLayer[] = [
      ...sourceFills.map((g) => ({ kind: 'motif' as const, geometry: [g] })),
      ...fills.map((fill) => ({ kind: 'fill' as const, ...fill })),
    ];
  paint.sort(
    (a, b) =>
      rank(a.kind === 'fill' ? a.geometry : a.geometry[0]) -
      rank(b.kind === 'fill' ? b.geometry : b.geometry[0]),
  );
  for (const layer of paint) {
    const previous = result.at(-1);
    if (
      layer.kind === 'motif' &&
      previous?.kind === 'motif' &&
      previous.geometry.every((g) => g.fillRegion)
    )
      previous.geometry.push(...layer.geometry);
    else result.push(layer);
  }
  if (motif.length || !result.some((l) => l.kind === 'motif'))
    result.push({ kind: 'motif', geometry: motif });
  const aperiodic = scene.generated.aperiodic;
  if (aperiodic) {
    const composition = scene.generated.composition,
      palette = composition?.definition.colorByLevel
        ? composition.definition.palette
        : aperiodic.palette;
    const groups = new Map<number, Matrix[]>();
    scene.generated.placements.forEach((matrix, index) => {
      const value = composition?.definition.colorByLevel
          ? (composition.levels[index] ?? 0)
          : (aperiodic.classes[index] ?? 0),
        color = ((value % palette.length) + palette.length) % palette.length;
      const placements = groups.get(color) ?? [];
      placements.push(matrix);
      groups.set(color, placements);
    });
    return [
      ...result.flatMap((layer): SceneLayer[] =>
        layer.kind === 'fill'
          ? [layer]
          : [...groups].map(([color, placements]) => ({
              kind: 'motif',
              geometry: layer.geometry.map((g) =>
                g.id === aperiodic.bodyId && g.fill !== 'none' ? { ...g, fill: palette[color] } : g,
              ),
              placements,
              level: color,
            })),
      ),
      ...aperiodic.guides.map((guide) => ({ kind: 'fill' as const, ...guide })),
    ];
  }
  const composition = scene.generated.composition;
  if (!composition?.definition.colorByLevel) return result;
  const groups = new Map<number, Matrix[]>();
  const primary =
    sourceFills.find((g) => g.fill !== 'none')?.fill ??
    scene.generated.geometry.find((g) => g.fill !== 'none')?.fill;
  scene.generated.placements.forEach((matrix, index) => {
    const level = composition.levels[index] ?? 0;
    const placements = groups.get(level) ?? [];
    placements.push(matrix);
    groups.set(level, placements);
  });
  return result.flatMap((layer): SceneLayer[] =>
    layer.kind === 'fill'
      ? [layer]
      : [...groups].map(([level, placements]) => ({
          kind: 'motif',
          level,
          placements,
          geometry: levelGeometry(layer.geometry, composition.definition.palette, level, primary),
        })),
  );
}
