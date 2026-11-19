import { tileContours } from './tiles';
import type { Scene } from '../patterns/engine';
import type { Geometry } from '../app/model';
import { pathData } from '../geometry/paths';
import { IDENTITY, matrixString, multiply, type Matrix } from '../geometry/matrix';
/** Reusable vector template, clipped once to its real Bézier tile boundary. */
export function tiledMarkup(
  scene: Scene,
  shapeMarkup: (g: Geometry) => string,
  id = 'tile',
  placement: Matrix = IDENTITY,
  outlines = scene.tiling?.definition.showOutline ?? false,
  underlay = '',
  physicalContours = false,
): string {
  const data = scene.tiling;
  if (!data) return '';
  const prefix =
      'tiles-' +
      Array.from(id)
        .map((c) => c.codePointAt(0)!.toString(16))
        .join('-'),
    source = `${prefix}-source`,
    clip = `${prefix}-clip`,
    unit = `${prefix}-unit`,
    boundary = pathData(data.boundary);
  const motif = data.inner.instances
    .flatMap((i) =>
      scene.generated.placements.map(
        (p) => `<use href="#${source}" transform="${matrixString(multiply(i.matrix, p))}"/>`,
      ),
    )
    .join('');
  const contours = outlines
    ? `<g data-tile-outlines="true" transform="${matrixString(placement)}">${tileContours(
        data.definition,
        data.tiles,
      )
        .map(
          (g) =>
            `<path data-tile-outline="true" d="${pathData(g)}" fill="none" stroke="#738c7a" stroke-width="${physicalContours ? 0.25 : 0.8}"${physicalContours ? '' : ' vector-effect="non-scaling-stroke"'}/>`,
        )
        .join('')}</g>`
    : '';
  return `<defs><g id="${source}">${scene.generated.geometry.map(shapeMarkup).join('')}</g><clipPath id="${clip}"><path d="${boundary}"/></clipPath><g id="${unit}"><g clip-path="url(#${clip})">${underlay}${motif}</g></g></defs>${data.tiles.map((t) => `<use data-tile-instance="${t.id}" href="#${unit}" transform="${matrixString(multiply(placement, t.matrix))}"/>`).join('')}${contours}`;
}
