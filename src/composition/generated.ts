import type { Geometry } from '../app/model';
import type { Generated } from '../generators';
import { geometryBounds } from '../application/clipping';
import { apply, multiply, type Matrix } from '../geometry/matrix';
import type { Bounds } from '../symmetry/groups';
import type { Composition } from './model';
import { compileComposition, MAX_COMPOSITION_INSTANCES } from './evaluate';

export function generatedBounds(generated: Pick<Generated, 'geometry' | 'placements'>): Bounds {
  const b = geometryBounds(generated.geometry),
    corners = [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
    ];
  const points = generated.placements.flatMap((m) => corners.map((p) => apply(m, p)));
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
export function composeGenerated(base: Generated, c: Composition): Generated {
  const maximum = Math.max(
      1,
      Math.floor(MAX_COMPOSITION_INSTANCES / Math.max(1, base.placements.length)),
    ),
    report = compileComposition(c, { maxInstances: maximum }),
    placements: Matrix[] = [],
    levels: number[] = [],
    ids: string[] = [];
  for (const leaf of report.leaves)
    for (const [index, matrix] of base.placements.entries()) {
      if (placements.length >= MAX_COMPOSITION_INSTANCES) {
        report.limited = true;
        break;
      }
      placements.push(multiply(leaf.matrix, matrix));
      levels.push(leaf.level);
      ids.push(`${leaf.id}/source-${index}`);
    }
  return { ...base, placements, finite: true, composition: { definition: c, report, levels, ids } };
}
/** Recolor the first source fill class; eyes, strokes and contrasting detail stay intact. */
export function levelGeometry(geometry: Geometry[], palette: string[], level: number): Geometry[] {
  const primary = geometry.find((g) => g.fill !== 'none')?.fill;
  if (!primary) return geometry;
  const color = palette[level % palette.length];
  return geometry.map((g) => (g.fill === primary ? { ...g, fill: color } : g));
}
