import type { Pattern } from '../app/model';
import type { Composition } from './model';
import { buildScene } from '../patterns/engine';
import { sceneLayers } from '../patterns/layers';
import { generatedBounds } from './generated';
import { matrixString, multiply } from '../geometry/matrix';
import { svgDocument, previewSVGPathAtTolerance } from '../export/svg';
import { tileCellBounds } from '../tiling/tiles';
import { tiledMarkup } from '../tiling/render';
import { geometricTiling } from '../tiling/colors';

/** Real scene, reduced detail for the thumbnail only; the stored recipe is untouched. */
export function compositionThumbnail(
  pattern: Pattern,
  definition?: Composition,
  background = '#f3eddf',
): string {
  const composition = definition
    ? structuredClone(definition)
    : pattern.composition
      ? structuredClone(pattern.composition)
      : undefined;
  if (composition?.kind === 'recursive') composition.depth = Math.min(2, composition.depth);
  if (composition?.kind === 'spiral') composition.count = Math.min(30, composition.count);
  const p = { ...pattern, composition },
    scene = buildScene(p, { x: -85, y: -85, width: 170, height: 170 }),
    raw = generatedBounds(scene.generated),
    finite = scene.generated.finite || p.symmetry.family === 'radial',
    bounds = finite
      ? {
          x: raw.x - 4,
          y: raw.y - 4,
          width: Math.max(10, raw.width + 8),
          height: Math.max(10, raw.height + 8),
        }
      : {
          x: -p.symmetry.width * 0.15,
          y: -p.symmetry.width * 0.15,
          width: p.symmetry.width * 1.6,
          height: p.symmetry.width * 1.6,
        };
  if (p.tiling && !composition?.enabled) {
    const cell = tileCellBounds(geometricTiling(p.tiling)!),
      view = {
        x: cell.x - cell.width * 0.6,
        y: cell.y - cell.height * 0.6,
        width: cell.width * 2.2,
        height: cell.height * 2.2,
      },
      tiled = buildScene(p, view),
      markup = sceneLayers(tiled, p)
        .map((layer, index) =>
          layer.kind === 'fill'
            ? layer.matrices
                .map((m) =>
                  previewSVGPathAtTolerance(
                    { ...layer.geometry, transform: multiply(m, layer.geometry.transform) },
                    0.08,
                  ),
                )
                .join('')
            : tiledMarkup(
                { ...tiled, generated: { ...tiled.generated, geometry: layer.geometry } },
                (g) => previewSVGPathAtTolerance(g, 0.08),
                `thumb-${index}`,
              ),
        )
        .join('');
    return 'data:image/svg+xml,' + encodeURIComponent(svgDocument(markup, view, background));
  }
  let body = '';
  for (const [index, layer] of sceneLayers(scene, p).entries()) {
    if (layer.kind === 'fill') continue;
    const id = `preview-${index}`;
    body += `<defs><g id="${id}">${layer.geometry.map((g) => previewSVGPathAtTolerance(g, 0.08)).join('')}</g></defs>`;
    const placements = layer.placements ?? scene.generated.placements;
    body += scene.instances
      .slice(0, 100)
      .flatMap((instance) =>
        placements
          .slice(0, 256)
          .map(
            (m) => `<use href="#${id}" transform="${matrixString(multiply(instance.matrix, m))}"/>`,
          ),
      )
      .join('');
  }
  return 'data:image/svg+xml,' + encodeURIComponent(svgDocument(body, bounds, background));
}
