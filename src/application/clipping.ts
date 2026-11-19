import ClipperLib from 'clipper-lib';
import type { Geometry, Region } from '../app/model';
import { geometry } from '../app/model';
import { IDENTITY, multiply, type Matrix } from '../geometry/matrix';
import { paperPath, paperData, pathToGeometry, flattened, scope } from '../geometry/paper';
import { pathData } from '../geometry/paths';
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
function bevelOutline(
  paths: ReturnType<typeof flattened>,
  radius: number,
  cap: Geometry['strokeCap'],
  tolerance: number,
  factor: number,
): ClipperLib.Paths {
  const polygons: ClipperLib.Paths = [];
  const add = (points: { x: number; y: number }[]) => {
    const poly = points.map((p) => ({ X: Math.round(p.x * factor), Y: Math.round(p.y * factor) }));
    if (!ClipperLib.Clipper.Orientation(poly)) poly.reverse();
    polygons.push(poly);
  };
  for (const { points, closed } of paths) {
    const count = closed ? points.length : points.length - 1,
      normals: { x: number; y: number }[] = [],
      directions: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        len = Math.hypot(b.x - a.x, b.y - a.y) || 1,
        dx = (b.x - a.x) / len,
        dy = (b.y - a.y) / len,
        n = { x: -dy * radius, y: dx * radius };
      normals.push(n);
      directions.push({ x: dx, y: dy });
      add([
        { x: a.x + n.x, y: a.y + n.y },
        { x: b.x + n.x, y: b.y + n.y },
        { x: b.x - n.x, y: b.y - n.y },
        { x: a.x - n.x, y: a.y - n.y },
      ]);
    }
    for (let i = closed ? 0 : 1; i < (closed ? points.length : points.length - 1); i++) {
      const p = points[i],
        a = normals[(i - 1 + count) % count],
        b = normals[i % count];
      for (const sign of [-1, 1])
        add([
          p,
          { x: p.x + sign * a.x, y: p.y + sign * a.y },
          { x: p.x + sign * b.x, y: p.y + sign * b.y },
        ]);
    }
    if (!closed && count > 0)
      for (const endpoint of [0, 1]) {
        const p = points[endpoint ? points.length - 1 : 0],
          d = directions[endpoint ? count - 1 : 0],
          n = normals[endpoint ? count - 1 : 0],
          sign = endpoint ? 1 : -1;
        if (cap === 'square')
          add([
            { x: p.x + n.x, y: p.y + n.y },
            { x: p.x + n.x + sign * d.x * radius, y: p.y + n.y + sign * d.y * radius },
            { x: p.x - n.x + sign * d.x * radius, y: p.y - n.y + sign * d.y * radius },
            { x: p.x - n.x, y: p.y - n.y },
          ]);
        if (cap === 'round') {
          const steps = Math.min(
            4096,
            Math.max(8, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - tolerance / radius)))),
          );
          add(
            Array.from({ length: steps }, (_, i) => ({
              x: p.x + radius * Math.cos((i * 2 * Math.PI) / steps),
              y: p.y + radius * Math.sin((i * 2 * Math.PI) / steps),
            })),
          );
        }
      }
  }
  const clipper = new ClipperLib.Clipper(),
    result: ClipperLib.Paths = [];
  clipper.AddPaths(polygons, ClipperLib.PolyType.ptSubject, true);
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    result,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return result;
}
export function strokeRegion(
  shape: Geometry,
  matrix: Matrix = IDENTITY,
  tolerance = 0.02,
): Geometry {
  const full = multiply(matrix, shape.transform),
    maxScale = Math.max(1, Math.hypot(full[0], full[1], full[2], full[3])),
    localTolerance = tolerance / maxScale;
  const paths = flattened({ ...shape, transform: IDENTITY }, localTolerance),
    factor = 100000;
  const offset = new ClipperLib.ClipperOffset(shape.miterLimit, localTolerance * factor),
    solution: ClipperLib.Paths = [];
  // Construct the stroke in the path's own coordinate system before the affine transform.
  // This preserves anisotropic scaling, including elliptical caps and joins.
  for (const path of paths)
    if (path.points.length > 1)
      offset.AddPath(
        path.points.map((p) => ({ X: Math.round(p.x * factor), Y: Math.round(p.y * factor) })),
        {
          round: ClipperLib.JoinType.jtRound,
          miter: ClipperLib.JoinType.jtMiter,
          bevel: ClipperLib.JoinType.jtSquare,
        }[shape.strokeJoin],
        path.closed
          ? ClipperLib.EndType.etClosedLine
          : {
              round: ClipperLib.EndType.etOpenRound,
              butt: ClipperLib.EndType.etOpenButt,
              square: ClipperLib.EndType.etOpenSquare,
            }[shape.strokeCap],
      );
  if (shape.strokeJoin === 'bevel')
    solution.push(
      ...bevelOutline(paths, shape.strokeWidth / 2, shape.strokeCap, localTolerance, factor),
    );
  else offset.Execute(solution, (shape.strokeWidth / 2) * factor);
  const g = geometry('compound', [], true);
  g.fill = shape.stroke;
  g.stroke = 'none';
  g.opacity = shape.opacity;
  g.fillOpacity = shape.strokeOpacity;
  g.pathData = solution
    .map((p) => p.map((v, i) => `${i ? 'L' : 'M'}${v.X / factor} ${v.Y / factor}`).join('') + 'Z')
    .join('');
  const source = paperPath(g, multiply(matrix, shape.transform));
  const result = pathToGeometry(source, g);
  return result;
}
export function clipGeometry(
  shape: Geometry,
  region: Region,
  transform: Matrix = IDENTITY,
  outlineStroke = false,
  tolerance = 0.02,
): Geometry[] {
  const mask = regionPath(region),
    out: Geometry[] = [];
  try {
    if (shape.closed && shape.fill !== 'none') {
      const source = paperPath(shape, transform);
      const result = source.intersect(mask, { insert: false });
      source.remove();
      if (result.pathData) {
        const g = pathToGeometry(result, shape);
        g.stroke = 'none';
        out.push(g);
      } else result.remove();
    }
    if (shape.stroke !== 'none' && shape.strokeWidth > 0) {
      const stroked = outlineStroke ? strokeRegion(shape, transform, tolerance) : shape;
      const source = paperPath(stroked, outlineStroke ? IDENTITY : transform);
      const result = source.intersect(mask, { insert: false, trace: outlineStroke });
      source.remove();
      if (result.pathData) {
        const g = pathToGeometry(result, stroked);
        if (!outlineStroke) {
          g.fill = 'none';
          g.closed = false;
          const full = multiply(transform, shape.transform);
          g.strokeWidth =
            shape.strokeWidth * Math.sqrt(Math.abs(full[0] * full[3] - full[1] * full[2]));
        }
        out.push(g);
      } else result.remove();
    }
    return out;
  } finally {
    mask.remove();
  }
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
