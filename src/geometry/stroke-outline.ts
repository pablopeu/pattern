import ClipperLib from 'clipper-lib';
import type { Geometry } from '../app/model';
import { geometry } from '../app/model';
import { profileWidth } from '../app/styles';
import { IDENTITY, multiply, linearScaleBound, type Matrix, type Point } from './matrix';
import { paperPath, paperData, pathToGeometry, flattened, scope } from './paper';
export const STROKE_LIMITS = {
  samples: 24000,
  polygons: 100000,
  vertices: 400000,
  curves: 4096,
  paintedAxes: 2048,
} as const;
function strokePrecision(tolerance: number, full: Matrix) {
  const scale = Math.max(1, linearScaleBound(full)),
    local = tolerance / scale,
    factor = Math.max(100000, Math.ceil(16 / local));
  if (!Number.isFinite(factor) || factor > 1e9)
    throw Error(
      'La precisión solicitada excede el rango numérico; aumentá la tolerancia o reducí la escala.',
    );
  return { local, factor };
}
function roundSteps(radius: number, sweep: number, tolerance: number, min: number): number {
  const angle = 2 * Math.acos(Math.max(-1, 1 - tolerance / radius)),
    wanted = Math.max(min, Math.ceil(Math.abs(sweep) / angle));
  if (!Number.isFinite(wanted) || wanted > 4096)
    throw Error(
      'La precisión del arco requiere más de4096 segmentos; aumentá la tolerancia o reducí el grosor.',
    );
  return wanted;
}
function checkIntegerRange(points: Point[], factor: number, padding = 0) {
  if (
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        (Math.max(Math.abs(p.x), Math.abs(p.y)) + padding) * factor > 1e14,
    )
  )
    throw Error('El contorno excede el rango numérico de coordenadas para esta tolerancia.');
}
function checkSourceRange(source: paper.PathItem, factor: number, padding: number) {
  const bounds = source.bounds,
    paths = source instanceof scope.CompoundPath ? source.children : [source];
  if (paths.reduce((n, p) => n + (p as paper.Path).curves.length, 0) > STROKE_LIMITS.curves)
    throw Error(
      `El trazo supera ${STROKE_LIMITS.curves} curvas para expansión. Simplificá el eje.`,
    );
  checkIntegerRange(
    [
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.bottom },
    ],
    factor,
    padding,
  );
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
          const steps = roundSteps(radius, 2 * Math.PI, tolerance, 8);
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
    { local: localTolerance, factor } = strokePrecision(tolerance, full);
  const raw = paperPath({ ...shape, transform: IDENTITY });
  let curved = false;
  try {
    checkSourceRange(raw, factor, shape.strokeWidth * Math.max(1, shape.miterLimit));
    curved = (raw instanceof scope.CompoundPath ? raw.children : [raw]).some(
      (p) =>
        (p as paper.Path).curves.some((c) => !c.isStraight()) ||
        ((p as paper.Path).curves.length > 0 && (p as paper.Path).length < 1e-9),
    );
  } finally {
    raw.remove();
  }
  if (curved) return variableStrokeRegion(shape, matrix, tolerance);
  const paths = flattened({ ...shape, transform: IDENTITY }, localTolerance * 0.4);
  if (paths.reduce((n, p) => n + p.points.length, 0) > STROKE_LIMITS.samples)
    throw Error('La expansión supera el presupuesto de puntos; aumentá la tolerancia.');
  for (const path of paths)
    checkIntegerRange(path.points, factor, shape.strokeWidth * Math.max(1, shape.miterLimit));
  const offset = new ClipperLib.ClipperOffset(shape.miterLimit, localTolerance * 0.25 * factor),
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
      ...bevelOutline(paths, shape.strokeWidth / 2, shape.strokeCap, localTolerance * 0.25, factor),
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
  while (
    index < d.length - 1 &&
    offset >= d[index] &&
    !(offset === 0 && d[index] === 0 && index % 2 === 0)
  ) {
    offset -= d[index];
    index++;
  }
  const endpointEpsilon = Math.max(1e-12, Number.EPSILON * Math.abs(length) * 16);
  let position = -offset;
  const result: [number, number][] = [];
  for (let steps = 0; position < length - endpointEpsilon && steps < 8192; steps++) {
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
    { local: tol, factor } = strokePrecision(tolerance, full),
    source = paperPath({ ...shape, transform: IDENTITY }),
    polygons: ClipperLib.Paths = [];
  let totalSamples = 0,
    totalVertices = 0;
  const add = (points: Point[]) => {
    totalVertices += points.length;
    if (polygons.length >= STROKE_LIMITS.polygons || totalVertices > STROKE_LIMITS.vertices)
      throw Error(
        'El contorno excede el presupuesto de polígonos. Simplificá el perfil o aumentá la tolerancia.',
      );
    checkIntegerRange(points, factor);
    const p = points.map((p) => ({ X: Math.round(p.x * factor), Y: Math.round(p.y * factor) }));
    if (p.length < 3) return;
    if (!ClipperLib.Clipper.Orientation(p)) p.reverse();
    polygons.push(p);
  };
  const disk = (p: Point, r: number) => {
    if (r < 1e-8) return;
    const steps = roundSteps(r, 2 * Math.PI, tol * 0.25, 12);
    add(
      Array.from({ length: steps }, (_, i) => ({
        x: p.x + r * Math.cos((i * 2 * Math.PI) / steps),
        y: p.y + r * Math.sin((i * 2 * Math.PI) / steps),
      })),
    );
  };
  const arc = (p: Point, r: number, start: number, sweep: number) => {
    if (r < 1e-8 || Math.abs(sweep) < 1e-10) return;
    const steps = roundSteps(r, sweep, tol * 0.25, 1);
    add([
      p,
      ...Array.from({ length: steps + 1 }, (_, i) => ({
        x: p.x + r * Math.cos(start + (sweep * i) / steps),
        y: p.y + r * Math.sin(start + (sweep * i) / steps),
      })),
    ]);
  };
  const square = (p: Point, r: number, tangent: Point) => {
    if (r < 1e-12) return;
    const len = Math.hypot(tangent.x, tangent.y),
      d = len > 1e-12 ? { x: tangent.x / len, y: tangent.y / len } : { x: 1, y: 0 },
      n = { x: -d.y, y: d.x };
    add([
      { x: p.x + r * (d.x + n.x), y: p.y + r * (d.y + n.y) },
      { x: p.x + r * (d.x - n.x), y: p.y + r * (d.y - n.y) },
      { x: p.x - r * (d.x + n.x), y: p.y - r * (d.y + n.y) },
      { x: p.x - r * (d.x - n.x), y: p.y - r * (d.y - n.y) },
    ]);
  };
  try {
    checkSourceRange(source, factor, shape.strokeWidth * Math.max(1, shape.miterLimit));
    for (const item of source instanceof scope.CompoundPath ? source.children : [source]) {
      const path = item as paper.Path,
        length = path.length;
      if (path.curves.length > STROKE_LIMITS.curves)
        throw Error(`El trazo variable supera ${STROKE_LIMITS.curves} curvas. Simplificá el eje.`);
      if (length < 1e-9) {
        if (
          path.curves.length &&
          (!shape.strokeDash.length ||
            dashIntervals(1e-6, shape.strokeDash, shape.strokeDashOffset).some(([a]) => a === 0))
        ) {
          const p = path.firstSegment.point,
            r = shape.strokeWidth * 0.5 * profileWidth(shape.strokeProfile, 0);
          if (shape.strokeCap === 'round') disk(p, r);
          if (shape.strokeCap === 'square') square(p, r, { x: 1, y: 0 });
        }
        continue;
      }
      const radius = (d: number) =>
        (shape.strokeWidth / 2) * profileWidth(shape.strokeProfile, d / length);
      let rangeOffset = 0;
      const ranges = path.curves.map((curve) => {
        const start = rangeOffset;
        rangeOffset += curve.length;
        return { curve, start, end: rangeOffset };
      });
      const rangeAt = (offset: number) => {
        let low = 0,
          high = ranges.length - 1;
        while (low < high) {
          const mid = (low + high) >> 1;
          if (offset > ranges[mid].end) low = mid + 1;
          else high = mid;
        }
        return ranges[low];
      };
      for (const [start, end] of dashIntervals(length, shape.strokeDash, shape.strokeDashOffset)) {
        if (end - start < 1e-9) {
          const p = path.getPointAt(start);
          if (!p) continue;
          const r = radius(start);
          if (shape.strokeCap === 'round') disk(p, r);
          if (shape.strokeCap === 'square') square(p, r, path.getTangentAt(start));
          continue;
        }
        const knots = new Set<number>([start, end]);
        for (const range of ranges) if (range.end > start && range.end < end) knots.add(range.end);
        for (const p of shape.strokeProfile.points) {
          const d = p.at * length;
          if (d > start && d < end) knots.add(d);
        }
        if (path.curves.some((c) => !c.isStraight()))
          for (let i = 1; i < 8; i++) knots.add(start + ((end - start) * i) / 8);
        const samples: { p: Point; r: number; offset: number }[] = [];
        const at = (d: number) => ({
          p: path.getPointAt(Math.min(length, Math.max(0, d)))!,
          r: radius(d),
          offset: d,
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
          const range = rangeAt((a + b) / 2),
            normal = (d: number) =>
              range.curve.getNormalAt(Math.max(0, Math.min(range.curve.length, d - range.start))),
            na = normal(a),
            nb = normal(b);
          if (na && nb)
            for (const t of [0.25, 0.5, 0.75]) {
              const d = a + (b - a) * t,
                v = at(d),
                n = normal(d);
              if (!n) continue;
              for (const sign of [-1, 1])
                error = Math.max(
                  error,
                  Math.hypot(
                    v.p.x +
                      sign * n.x * v.r -
                      (va.p.x + sign * na.x * va.r) * (1 - t) -
                      (vb.p.x + sign * nb.x * vb.r) * t,
                    v.p.y +
                      sign * n.y * v.r -
                      (va.p.y + sign * na.y * va.r) * (1 - t) -
                      (vb.p.y + sign * nb.y * vb.r) * t,
                  ),
                );
            }
          if (error > tol * 0.4 && depth >= 18)
            throw Error(
              'El perfil requiere demasiada precisión cerca de una cúspide; aumentá la tolerancia o dividí la curva.',
            );
          if (error > tol * 0.4 && depth < 18) {
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
          endNormals: Point[] = [],
          directions: Point[] = [],
          endDirections: Point[] = [];
        for (let i = 0; i < samples.length - 1; i++) {
          const a = samples[i],
            b = samples[i + 1],
            range = rangeAt((a.offset + b.offset) / 2),
            length = Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y) || 1,
            fallback = { x: (b.p.x - a.p.x) / length, y: (b.p.y - a.p.y) / length },
            direction = (offset: number) => {
              const t = range.curve.getTangentAt(
                Math.max(0, Math.min(range.curve.length, offset - range.start)),
              );
              return t && Math.hypot(t.x, t.y) > 1e-12 ? t : fallback;
            },
            da = direction(a.offset),
            db = direction(b.offset),
            na = { x: -da.y, y: da.x },
            nb = { x: -db.y, y: db.x };
          normals.push(na);
          endNormals.push(nb);
          directions.push(da);
          endDirections.push(db);
          const leftA = { x: a.p.x + na.x * a.r, y: a.p.y + na.y * a.r },
            leftB = { x: b.p.x + nb.x * b.r, y: b.p.y + nb.y * b.r },
            rightA = { x: a.p.x - na.x * a.r, y: a.p.y - na.y * a.r },
            rightB = { x: b.p.x - nb.x * b.r, y: b.p.y - nb.y * b.r };
          add([leftA, leftB, rightA]);
          add([rightA, leftB, rightB]);
        }
        const closed =
          path.closed && !shape.strokeDash.length && Math.abs(radius(0) - radius(length)) < 1e-10;
        for (let i = closed ? 0 : 1; i < (closed ? samples.length - 1 : samples.length - 1); i++) {
          const a = endNormals[(i - 1 + normals.length) % normals.length],
            b = normals[i % normals.length],
            v = samples[i];
          if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-12) continue;
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
              d = endIndex ? endDirections[endDirections.length - 1] : directions[0],
              n = endIndex ? endNormals[endNormals.length - 1] : normals[0],
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
const contourCache = new Map<string, { geometry: Geometry; cost: number }>();
let contourCacheCost = 0;
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
  if (cached) return structuredClone(cached.geometry);
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
  const cost = key.length + JSON.stringify(result).length;
  while (contourCache.size && (contourCache.size >= 128 || contourCacheCost + cost > 16000000)) {
    const oldest = contourCache.keys().next().value!;
    contourCacheCost -= contourCache.get(oldest)!.cost;
    contourCache.delete(oldest);
  }
  if (cost <= 16000000) {
    contourCache.set(key, { geometry: structuredClone(result), cost });
    contourCacheCost += cost;
  }
  return result;
}
