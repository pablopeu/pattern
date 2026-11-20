import ClipperLib from 'clipper-lib';
import type { Geometry } from '../app/model';
import { geometry } from '../app/model';
import { profileWidth } from '../app/styles';
import { IDENTITY, multiply, type Matrix, type Point } from './matrix';
import { paperPath, paperData, pathToGeometry, flattened, scope } from './paper';
export const STROKE_LIMITS = {
  samples: 24000,
  polygons: 100000,
  vertices: 400000,
  curves: 4096,
  paintedAxes: 2048,
} as const;
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
function uniformStrokeRegion(
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

/** Painted distances measured along each original axis, before any instance transform. */
export function dashIntervals(length: number, dash: number[], phase: number): [number, number][] {
  if (!dash.length) return [[0, length]];
  const d = dash.length % 2 ? [...dash, ...dash] : dash,
    period = d.reduce((a, b) => a + b, 0);
  if (period < 0.001 || !Number.isFinite(phase) || d.some((n) => n < 0 || !Number.isFinite(n)))
    throw Error('Secuencia de guiones inválida.');
  let offset = ((phase % period) + period) % period,
    index = 0;
  while (index < d.length - 1 && offset >= d[index]) {
    offset -= d[index];
    index++;
  }
  let position = -offset;
  const result: [number, number][] = [];
  for (let steps = 0; position <= length && steps < 8192; steps++) {
    const end = position + d[index];
    if (index % 2 === 0 && end >= 0) result.push([Math.max(0, position), Math.min(length, end)]);
    position = end;
    index = (index + 1) % d.length;
    if (result.length > 2048)
      throw Error('Demasiados segmentos discontinuos (máximo 2048 por eje).');
    if (steps === 8191) throw Error('La secuencia de guiones excede el límite de cálculo.');
  }
  return result;
}
function piece(path: paper.Path, start: number, end: number): paper.Path {
  let p = path.clone({ insert: false });
  if (start > 1e-9) {
    const rest = p.splitAt(start);
    p.remove();
    if (!rest) throw Error('No se pudo separar el guion.');
    p = rest;
  }
  if (end - start < p.length - 1e-9) {
    const rest = p.splitAt(end - start);
    rest?.remove();
  }
  p.closed = false;
  return p;
}
export function paintedAxes(shape: Geometry): Geometry[] {
  if (!shape.strokeDash.length) return [shape];
  const source = paperPath({ ...shape, transform: IDENTITY }),
    out: Geometry[] = [];
  try {
    for (const item of source instanceof scope.CompoundPath ? source.children : [source]) {
      const path = item as paper.Path;
      for (const [a, b] of dashIntervals(path.length, shape.strokeDash, shape.strokeDashOffset)) {
        if (b - a <= 1e-9) continue;
        const p = piece(path, a, b);
        if (out.length >= STROKE_LIMITS.paintedAxes)
          throw Error(
            `El trazo supera ${STROKE_LIMITS.paintedAxes} segmentos pintados. Simplificá la secuencia.`,
          );
        out.push({
          ...shape,
          pathData: paperData(p),
          kind: 'compound',
          nodes: [],
          parameters: undefined,
          closed: false,
          strokeDash: [],
          strokeDashOffset: 0,
        });
        p.remove();
      }
    }
  } finally {
    source.remove();
  }
  return out;
}
function variableStrokeRegion(shape: Geometry, matrix: Matrix, tolerance: number): Geometry {
  const full = multiply(matrix, shape.transform),
    maxScale = Math.max(1, Math.hypot(full[0], full[1], full[2], full[3])),
    tol = tolerance / maxScale,
    source = paperPath({ ...shape, transform: IDENTITY }),
    polygons: ClipperLib.Paths = [],
    factor = 100000;
  let totalSamples = 0,
    totalVertices = 0;
  const add = (points: Point[]) => {
    totalVertices += points.length;
    if (polygons.length >= STROKE_LIMITS.polygons || totalVertices > STROKE_LIMITS.vertices)
      throw Error(
        'El contorno excede el presupuesto de polígonos. Simplificá el perfil o aumentá la tolerancia.',
      );
    if (
      points.some(
        (p) =>
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          Math.abs(p.x) > 1e9 ||
          Math.abs(p.y) > 1e9,
      )
    )
      throw Error('El contorno excede el rango numérico de coordenadas.');
    const p = points.map((p) => ({ X: Math.round(p.x * factor), Y: Math.round(p.y * factor) }));
    if (p.length < 3) return;
    if (!ClipperLib.Clipper.Orientation(p)) p.reverse();
    polygons.push(p);
  };
  const disk = (p: Point, r: number) => {
    if (r < 1e-8) return;
    const steps = Math.min(
      1024,
      Math.max(12, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - tol / r)))),
    );
    add(
      Array.from({ length: steps }, (_, i) => ({
        x: p.x + r * Math.cos((i * 2 * Math.PI) / steps),
        y: p.y + r * Math.sin((i * 2 * Math.PI) / steps),
      })),
    );
  };
  const arc = (p: Point, r: number, start: number, sweep: number) => {
    if (r < 1e-8 || Math.abs(sweep) < 1e-10) return;
    const steps = Math.min(
      1024,
      Math.max(
        1,
        Math.ceil(Math.abs(sweep) / Math.max(0.001, 2 * Math.acos(Math.max(-1, 1 - tol / r)))),
      ),
    );
    add([
      p,
      ...Array.from({ length: steps + 1 }, (_, i) => ({
        x: p.x + r * Math.cos(start + (sweep * i) / steps),
        y: p.y + r * Math.sin(start + (sweep * i) / steps),
      })),
    ]);
  };
  try {
    for (const item of source instanceof scope.CompoundPath ? source.children : [source]) {
      const path = item as paper.Path,
        length = path.length;
      if (path.curves.length > STROKE_LIMITS.curves)
        throw Error(`El trazo variable supera ${STROKE_LIMITS.curves} curvas. Simplificá el eje.`);
      if (length < 1e-9) continue;
      const radius = (d: number) =>
        (shape.strokeWidth / 2) * profileWidth(shape.strokeProfile, d / length);
      for (const [start, end] of dashIntervals(length, shape.strokeDash, shape.strokeDashOffset)) {
        if (end - start < 1e-9) {
          const p = path.getPointAt(start);
          if (!p) continue;
          const r = radius(start);
          if (shape.strokeCap === 'round') disk(p, r);
          if (shape.strokeCap === 'square')
            add([
              { x: p.x - r, y: p.y - r },
              { x: p.x + r, y: p.y - r },
              { x: p.x + r, y: p.y + r },
              { x: p.x - r, y: p.y + r },
            ]);
          continue;
        }
        const knots = new Set<number>([start, end]);
        let cursor = 0;
        for (const c of path.curves) {
          cursor += c.length;
          if (cursor > start && cursor < end) knots.add(cursor);
        }
        for (const p of shape.strokeProfile.points) {
          const d = p.at * length;
          if (d > start && d < end) knots.add(d);
        }
        if (path.curves.some((c) => !c.isStraight()))
          for (let i = 1; i < 8; i++) knots.add(start + ((end - start) * i) / 8);
        const samples: { p: Point; r: number }[] = [];
        const at = (d: number) => ({
          p: path.getPointAt(Math.min(length, Math.max(0, d)))!,
          r: radius(d),
        });
        const refine = (a: number, b: number, depth: number) => {
          const va = at(a),
            vb = at(b);
          let error = 0;
          for (const t of [0.25, 0.5, 0.75]) {
            const v = at(a + (b - a) * t);
            error = Math.max(
              error,
              Math.hypot(
                v.p.x - va.p.x - (vb.p.x - va.p.x) * t,
                v.p.y - va.p.y - (vb.p.y - va.p.y) * t,
              ) + Math.abs(v.r - va.r - (vb.r - va.r) * t),
            );
          }
          if (error > tol / 2 && depth < 18) {
            const mid = (a + b) / 2;
            refine(a, mid, depth + 1);
            refine(mid, b, depth + 1);
          } else {
            samples.push(vb);
            totalSamples++;
          }
          if (totalSamples > STROKE_LIMITS.samples)
            throw Error(
              `El contorno supera ${STROKE_LIMITS.samples} muestras totales. Simplificá el perfil o aumentá la tolerancia.`,
            );
          if (samples.length > 16000)
            throw Error('El contorno supera 16000 muestras; aumentá la tolerancia.');
        };
        const sorted = [...knots].sort((a, b) => a - b);
        samples.push(at(start));
        totalSamples++;
        for (let i = 1; i < sorted.length; i++) refine(sorted[i - 1], sorted[i], 0);
        const normals: Point[] = [],
          directions: Point[] = [];
        for (let i = 0; i < samples.length - 1; i++) {
          const a = samples[i],
            b = samples[i + 1],
            len = Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y) || 1,
            d = { x: (b.p.x - a.p.x) / len, y: (b.p.y - a.p.y) / len },
            n = { x: -d.y, y: d.x };
          normals.push(n);
          directions.push(d);
          const leftA = { x: a.p.x + n.x * a.r, y: a.p.y + n.y * a.r },
            leftB = { x: b.p.x + n.x * b.r, y: b.p.y + n.y * b.r },
            rightA = { x: a.p.x - n.x * a.r, y: a.p.y - n.y * a.r },
            rightB = { x: b.p.x - n.x * b.r, y: b.p.y - n.y * b.r };
          add([leftA, leftB, rightA]);
          add([rightA, leftB, rightB]);
        }
        const closed = path.closed && !shape.strokeDash.length;
        for (let i = closed ? 0 : 1; i < (closed ? samples.length - 1 : samples.length - 1); i++) {
          const a = normals[(i - 1 + normals.length) % normals.length],
            b = normals[i % normals.length],
            v = samples[i];
          if (shape.strokeJoin === 'round') {
            const turn = Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y),
              sign = turn > 0 ? -1 : 1;
            arc(v.p, v.r, Math.atan2(sign * a.y, sign * a.x), turn);
          }
          for (const sign of [-1, 1]) {
            const p = { x: v.p.x + sign * a.x * v.r, y: v.p.y + sign * a.y * v.r },
              q = { x: v.p.x + sign * b.x * v.r, y: v.p.y + sign * b.y * v.r };
            add([v.p, p, q]);
            if (shape.strokeJoin === 'miter') {
              const den = 1 + a.x * b.x + a.y * b.y;
              if (den > 1e-10) {
                const tip = {
                  x: v.p.x + (sign * (a.x + b.x) * v.r) / den,
                  y: v.p.y + (sign * (a.y + b.y) * v.r) / den,
                };
                if (Math.hypot(tip.x - v.p.x, tip.y - v.p.y) <= v.r * shape.miterLimit)
                  add([p, tip, q]);
              }
            }
          }
        }
        if (!closed)
          for (const endIndex of [0, 1]) {
            const v = samples[endIndex ? samples.length - 1 : 0],
              d = directions[endIndex ? directions.length - 1 : 0],
              n = normals[endIndex ? normals.length - 1 : 0],
              sign = endIndex ? 1 : -1;
            if (shape.strokeCap === 'round')
              arc(v.p, v.r, Math.atan2(n.y, n.x), endIndex ? -Math.PI : Math.PI);
            if (shape.strokeCap === 'square')
              add([
                { x: v.p.x + n.x * v.r, y: v.p.y + n.y * v.r },
                {
                  x: v.p.x + n.x * v.r + sign * d.x * v.r,
                  y: v.p.y + n.y * v.r + sign * d.y * v.r,
                },
                {
                  x: v.p.x - n.x * v.r + sign * d.x * v.r,
                  y: v.p.y - n.y * v.r + sign * d.y * v.r,
                },
                { x: v.p.x - n.x * v.r, y: v.p.y - n.y * v.r },
              ]);
          }
      }
    }
  } finally {
    source.remove();
  }
  const clipper = new ClipperLib.Clipper(),
    solution: ClipperLib.Paths = [];
  clipper.AddPaths(polygons, ClipperLib.PolyType.ptSubject, true);
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  const g = geometry('compound', [], true);
  g.pathData = solution
    .map((p) => p.map((v, i) => `${i ? 'L' : 'M'}${v.X / factor} ${v.Y / factor}`).join('') + 'Z')
    .join('');
  g.fillRule = 'nonzero';
  g.fill = shape.stroke;
  g.stroke = 'none';
  g.opacity = shape.opacity;
  g.fillOpacity = shape.strokeOpacity;
  return pathToGeometry(paperPath(g, full), g);
}
const contourCache = new Map<string, Geometry>();
/** Single derived contour shared by editor, clipping, SVG and DXF. Axis stays editable. */
export function strokeRegion(
  shape: Geometry,
  matrix: Matrix = IDENTITY,
  tolerance = 0.02,
): Geometry {
  if (!Number.isFinite(tolerance) || tolerance <= 0)
    throw Error('La tolerancia de contorno debe ser positiva y finita.');
  const key = JSON.stringify([shape, matrix, tolerance]);
  const cached = contourCache.get(key);
  if (cached) return structuredClone(cached);
  let result: Geometry;
  if (shape.strokeProfile.kind === 'uniform' && !shape.strokeDash.length)
    result = uniformStrokeRegion(shape, matrix, tolerance);
  else if (shape.strokeProfile.kind === 'uniform' && shape.strokeDash.every((n) => n > 0)) {
    const parts = paintedAxes(shape).map((p) => uniformStrokeRegion(p, matrix, tolerance));
    result = geometry('compound', [], true);
    result.pathData = parts.map((p) => p.pathData).join('');
    result.fill = shape.stroke;
    result.stroke = 'none';
    result.opacity = shape.opacity;
    result.fillOpacity = shape.strokeOpacity;
    result.fillRule = 'nonzero';
  } else result = variableStrokeRegion(shape, matrix, tolerance);
  if (contourCache.size >= 128) contourCache.delete(contourCache.keys().next().value!);
  contourCache.set(key, structuredClone(result));
  return result;
}
