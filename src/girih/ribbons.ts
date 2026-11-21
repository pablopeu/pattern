import { geometry, node, type Geometry } from '../app/model';
import { strokeRegion } from '../geometry/stroke-outline';
import { paperPath, pathToGeometry } from '../geometry/paper';
import { distance, lerp } from './polygons';
import type { Strand, WeaveResult } from './weave';
/** Follow the actual polyline around a crossing, including corners and a closed seam. */
function windowAt(strand: Strand, arc: number, radius: number) {
  const edges: {
    a: (typeof strand.points)[number];
    b: (typeof strand.points)[number];
    start: number;
    length: number;
  }[] = [];
  let length = 0;
  for (let i = 0; i < (strand.closed ? strand.points.length : strand.points.length - 1); i++) {
    const a = strand.points[i],
      b = strand.points[(i + 1) % strand.points.length],
      size = distance(a, b);
    if (size < 1e-8) continue;
    edges.push({ a, b, start: length, length: size });
    length += size;
  }
  radius = Math.min(radius, length * 0.4);
  const low = arc - radius,
    high = arc + radius,
    points: Strand['points'] = [];
  for (const cycle of strand.closed ? [-1, 0, 1] : [0])
    for (const edge of edges) {
      const start = edge.start + cycle * length,
        a = Math.max(start, low),
        b = Math.min(start + edge.length, high);
      if (b - a < 1e-8) continue;
      const p = lerp(edge.a, edge.b, (a - start) / edge.length),
        q = lerp(edge.a, edge.b, (b - start) / edge.length);
      if (!points.length) points.push(p);
      points.push(q);
    }
  return points;
}
function axis(points: Strand['points'], width: number, closed = false): Geometry {
  return {
    ...geometry(
      'path',
      points.map((p) => node(p.x, p.y)),
      closed,
    ),
    strokeWidth: width,
    strokeJoin: 'round',
    strokeCap: 'butt',
  };
}
/** Filled vector bands with true boolean gaps, including same-strand self-crossings. */
export function weaveRibbons(
  strands: Strand[],
  weave: WeaveResult,
  width: number,
  gap: number,
  palette: string[],
): Geometry[] {
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    width > 20 ||
    !Number.isFinite(gap) ||
    gap < 0 ||
    gap > width ||
    !palette.length
  )
    throw Error('Ancho o separación de banda inválidos.');
  return strands.map((strand, index) => {
    let result: paper.PathItem = paperPath(strokeRegion(axis(strand.points, width, strand.closed)));
    const bridges: paper.PathItem[] = [];
    try {
      if (weave.valid)
        for (const crossing of weave.crossings) {
          const under = crossing.incidences.find((i) => i.strand === index && !i.over);
          if (!under) continue;
          const over = crossing.incidences.find((i) => i.over)!,
            points = windowAt(strands[over.strand], over.arc, width * 2 + gap),
            mask = paperPath(strokeRegion(axis(points, width + 2 * gap + 0.12))),
            old = result;
          result = old.subtract(mask, { insert: false });
          old.remove();
          mask.remove();
          if (over.strand === index) bridges.push(paperPath(strokeRegion(axis(points, width))));
        }
      // Restore only the local overpass of a self-crossing, then unite it so no
      // artificial cap stroke is left across the continuous band.
      for (const bridge of bridges) {
        const old = result;
        result = old.unite(bridge, { insert: false });
        old.remove();
      }
      const g = pathToGeometry(result);
      return {
        ...g,
        id: `woven-${strand.id}`,
        name: `Banda ${index + 1}`,
        fill: palette[index % palette.length],
        stroke: '#253b35',
        strokeWidth: 0.12,
      };
    } finally {
      result.remove();
      bridges.forEach((p) => p.remove());
    }
  });
}
