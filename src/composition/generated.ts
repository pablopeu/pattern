import type { Geometry } from '../app/model';
import type { Generated } from '../generators';
import { geometryBounds } from '../application/clipping';
import { apply, multiply, type Matrix } from '../geometry/matrix';
import type { Bounds } from '../symmetry/groups';
import type { Composition } from './model';
import { compileComposition, MAX_COMPOSITION_INSTANCES, sourceNormalization } from './evaluate';
import { strokePadding } from '../geometry/stroke-bounds';

export function generatedBounds(
  generated: Pick<Generated, 'geometry' | 'placements'> & Partial<Pick<Generated, 'aperiodic'>>,
  includeGuides = false,
): Bounds {
  const b = geometryBounds(generated.geometry),
    corners = [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
    ];
  const points = generated.placements.flatMap((m) => corners.map((p) => apply(m, p)));
  if (includeGuides && generated.aperiodic)
    for (const guide of generated.aperiodic.guides)
      for (const matrix of guide.matrices) {
        const box = geometryBounds([
          { ...guide.geometry, transform: multiply(matrix, guide.geometry.transform) },
        ]);
        points.push({ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y + box.height });
      }
  if (!points.length) return b;
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x,
    height: Math.max(...points.map((p) => p.y)) - y,
  };
}
export function composeGenerated(
  base: Generated,
  c: Composition,
  options: { bounds?: Bounds; minSize?: number } = {},
): Generated {
  const content = generatedBounds(base),
    padding = strokePadding(base.geometry, base.placements),
    normalized = [
      { x: content.x - padding, y: content.y - padding },
      { x: content.x + content.width + padding, y: content.y + content.height + padding },
    ].map((p) => apply(sourceNormalization(c), p));
  const maximum = Math.max(
      1,
      Math.floor(MAX_COMPOSITION_INSTANCES / Math.max(1, base.placements.length)),
    ),
    report = compileComposition(c, {
      ...options,
      maxInstances: maximum,
      contentBounds: {
        x: normalized[0].x,
        y: normalized[0].y,
        width: normalized[1].x - normalized[0].x,
        height: normalized[1].y - normalized[0].y,
      },
    }),
    placements: Matrix[] = [],
    levels: number[] = [],
    ids: string[] = [],
    classes: number[] = [];
  for (const leaf of report.leaves)
    for (const [index, matrix] of base.placements.entries()) {
      if (placements.length >= MAX_COMPOSITION_INSTANCES) {
        report.limited = true;
        break;
      }
      placements.push(multiply(leaf.matrix, matrix));
      levels.push(leaf.level);
      if (base.aperiodic) classes.push(base.aperiodic.classes[index]);
      ids.push(`${leaf.id}/source-${index}`);
    }
  return {
    ...base,
    ...(base.aperiodic ? { aperiodic: { ...base.aperiodic, classes, ids, guides: [] } } : {}),
    placements,
    finite: true,
    composition: { definition: c, report, levels, ids },
  };
}
/** Recolor the first source fill class; eyes, strokes and contrasting detail stay intact. */
export function levelGeometry(
  geometry: Geometry[],
  palette: string[],
  level: number,
  primary = geometry.find((g) => g.fill !== 'none')?.fill,
): Geometry[] {
  if (!primary) return geometry;
  const color = palette[level % palette.length];
  return geometry.map((g) => (g.fill === primary ? { ...g, fill: color } : g));
}
