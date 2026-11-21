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
    d = pathData(layout.boundary);
  let marks = '';
  if (layout.marked) {
    const center = {
        x: layout.vertices.reduce((n, p) => n + p.x, 0) / layout.vertices.length,
        y: layout.vertices.reduce((n, p) => n + p.y, 0) / layout.vertices.length,
      },
      radius =
        0.7 *
        Math.min(
          ...layout.vertices.map((p, i) => {
            const q = layout.vertices[(i + 1) % layout.vertices.length];
            return (
              Math.abs((q.x - p.x) * (center.y - p.y) - (q.y - p.y) * (center.x - p.x)) /
              Math.hypot(q.x - p.x, q.y - p.y)
            );
          }),
        ),
      points = [
        [0.17, 0.11],
        [0.78, 0.16],
        [0.42, 0.53],
      ]
        .map(([x, y]) => `${center.x + x * radius},${center.y + y * radius}`)
        .join(' ');
    marks = layout.motifSymmetries
      .map(
        (h) =>
          `<polygon points="${points}" transform="${matrixString(h)}" fill="#203d36" stroke="none"/>`,
      )
      .join('');
  }
  const body = repeat
    ? isohedralInstances(definition, 60, view)
        .map((item) => {
          const index = (((item.cell[0] + item.cell[1] * 2 + item.orientation) % 4) + 4) % 4;
          return `<g transform="${matrixString(item.matrix)}"><path d="${d}" fill="${colors[layout.marked ? 0 : index]}"/>${marks}</g>`;
        })
        .join('')
    : `<path d="${d}" fill="${colors[0]}"/>${marks}`;
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.x} ${view.y} ${view.width} ${view.height}"><rect x="${view.x}" y="${view.y}" width="${size}" height="${size}" fill="#f3eddf"/><g stroke="#314940" stroke-width="${unit * 0.008}" stroke-linejoin="round">${body}</g></svg>`,
    )
  );
}
