import { strokeRegion } from '../geometry/stroke-outline';
export { strokeRegion } from '../geometry/stroke-outline';
import type { Geometry, Region } from '../app/model';
import { IDENTITY, multiply, type Matrix } from '../geometry/matrix';
import { paperPath, paperData, pathToGeometry, scope } from '../geometry/paper';
import { pathData, hasFillBoundary } from '../geometry/paths';
export function regionPath(region: Region): paper.CompoundPath {
  if (!region.geometry.length) return new scope.CompoundPath({ insert: false });
  let result = paperPath(region.geometry[0]);
  try {
    // Resolve each shape's own fill rule before combining independent components.
    const normalized = result.unite(result, { insert: false });
    result.remove();
    result = normalized;
    for (const g of region.geometry.slice(1)) {
      const next = paperPath(g),
        old = result;
      try {
        result = old.unite(next, { insert: false });
      } finally {
        old.remove();
        next.remove();
      }
    }
    return new scope.CompoundPath({
      pathData: paperData(result),
      fillRule: 'evenodd',
      insert: false,
    });
  } finally {
    result.remove();
  }
}
export function regionData(region: Region): string {
  const p = regionPath(region);
  const d = paperData(p);
  p.remove();
  return d;
}
export interface ClippedPaint {
  geometry: Geometry;
  sourceId: string;
  paint: 'fill' | 'stroke';
}
/** Keep the originating paint separate after strokes become filled regions. */
export function clipPaintGeometry(
  shape: Geometry,
  region: Region,
  transform: Matrix = IDENTITY,
  outlineStroke = false,
  tolerance = 0.02,
): ClippedPaint[] {
  const mask = regionPath(region),
    out: ClippedPaint[] = [];
  try {
    if (
      (shape.closed || shape.kind === 'path') &&
      hasFillBoundary(shape) &&
      shape.fill !== 'none'
    ) {
      const source = paperPath(shape, transform);
      const result = source.intersect(mask, { insert: false });
      source.remove();
      if (result.pathData) {
        const g = pathToGeometry(result, shape);
        g.stroke = 'none';
        out.push({ geometry: g, sourceId: shape.id, paint: 'fill' });
      } else result.remove();
    }
    if (shape.stroke !== 'none' && shape.strokeWidth > 0) {
      outlineStroke =
        outlineStroke || shape.strokeDash.length > 0 || shape.strokeProfile.kind !== 'uniform';
      const stroked = outlineStroke ? strokeRegion(shape, transform, tolerance) : shape;
      const source = paperPath(stroked, outlineStroke ? IDENTITY : transform);
      const axes =
        !outlineStroke && source instanceof scope.CompoundPath ? [...source.children] : [source];
      let joined: Geometry | undefined;
      try {
        for (const axis of axes) {
          const result = (axis as paper.PathItem).intersect(mask, {
            insert: false,
            trace: outlineStroke,
          });
          if (result.pathData) {
            const g = pathToGeometry(result, stroked);
            if (!outlineStroke) {
              g.fill = 'none';
              g.closed = false;
              const full = multiply(transform, shape.transform);
              g.strokeWidth =
                shape.strokeWidth * Math.sqrt(Math.abs(full[0] * full[3] - full[1] * full[2]));
            }
            if (!outlineStroke && joined)
              joined.pathData = (joined.pathData ?? '') + (g.pathData ?? '');
            else {
              out.push({ geometry: g, sourceId: shape.id, paint: 'stroke' });
              if (!outlineStroke) joined = g;
            }
          } else result.remove();
        }
      } finally {
        source.remove();
      }
    }
    return out;
  } finally {
    mask.remove();
  }
}
export function clipGeometry(
  shape: Geometry,
  region: Region,
  transform: Matrix = IDENTITY,
  outlineStroke = false,
  tolerance = 0.02,
): Geometry[] {
  return clipPaintGeometry(shape, region, transform, outlineStroke, tolerance).map(
    (paint) => paint.geometry,
  );
}
export function geometryBounds(shapes: Geometry[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (!shapes.length) return { x: -100, y: -100, width: 200, height: 200 };
  const paths = shapes.map((g) => paperPath(g));
  let bounds = paths[0].bounds.clone();
  for (const p of paths.slice(1)) bounds = bounds.unite(p.bounds);
  paths.forEach((p) => p.remove());
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(1e-8, bounds.width),
    height: Math.max(1e-8, bounds.height),
  };
}
export function hasClosedGeometry(shape: Geometry): boolean {
  if (!shape.closed) return false;
  const p = paperPath(shape);
  try {
    const paths = p instanceof scope.CompoundPath ? p.children : [p];
    if (!paths.every((c) => (c as paper.Path).closed)) return false;
    if (Math.abs((p as paper.CompoundPath).area) > 1e-8) return true;
    const resolved = p.unite(p, { insert: false });
    try {
      return Math.abs((resolved as paper.CompoundPath).area) > 1e-8;
    } finally {
      resolved.remove();
    }
  } finally {
    p.remove();
  }
}
export { pathData };
