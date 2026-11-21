import { isohedralInstances, isohedralLayout, nodeBounds } from './engine';
import { isohedralPreset } from './catalog';
import { pathData } from '../geometry/paths';
import { matrixString } from '../geometry/matrix';

export function isohedralThumbnail(type: number, repeat = false, curved = false): string {
  const definition = isohedralPreset(type, curved),
    layout = isohedralLayout(definition),
    b = nodeBounds(layout.boundary.nodes),
    unit = Math.max(b.width, b.height),
    size = unit * (repeat ? 2.7 : 1.2),
    view = {
      x: b.x + b.width / 2 - size / 2,
      y: b.y + b.height / 2 - size / 2,
      width: size,
      height: size,
    },
    colors = ['#c79455', '#487b77', '#a15e54', '#8a9664'],
    d = pathData(layout.boundary),
    body = repeat
      ? isohedralInstances(definition, 60, view)
          .map((item) => {
            const index = (((item.cell[0] + item.cell[1] * 2 + item.orientation) % 4) + 4) % 4;
            return `<path d="${d}" transform="${matrixString(item.matrix)}" fill="${colors[index]}"/>`;
          })
          .join('')
      : `<path d="${d}" fill="${colors[0]}"/>`;
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.x} ${view.y} ${view.width} ${view.height}"><rect x="${view.x}" y="${view.y}" width="${size}" height="${size}" fill="#f3eddf"/><g stroke="#314940" stroke-width="${unit * 0.008}" stroke-linejoin="round">${body}</g></svg>`,
    )
  );
}
