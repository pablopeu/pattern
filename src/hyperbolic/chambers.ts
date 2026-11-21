import type { Project } from '../app/model';
import { distance, linearScaleBound, type Point } from '../geometry/matrix';
import { adaptiveMapCubic, type Cubic } from '../geometry/nonlinear';
import { preparePaintSource } from '../geometry/paint-source';
import { prepareFlatPaintSource, type FlatSourceSelection } from '../patterns/finite-source';
import { escapeXML } from '../export/svg';
import {
  regularHyperbolicPatch,
  visibleHyperbolicCells,
  diskPoint,
  diskGeodesic,
  type HyperbolicCell,
} from './disk';
import {
  rootChambers,
  chamberPoint,
  chamberCubicError,
  poincareToKlein,
  type RootChamber,
} from './chamber-map';
import { canonicalHyperbolicTopology } from './topology';
import { validateDiskSettings, type DiskSettings } from './representation';
import type { ProjectedDiskContour } from './source';
import type { Iso } from '../vendor/poincare/iso';
export interface ChamberSettings extends DiskSettings {
  maxCurves?: number;
  debugBoundaries?: boolean;
}
export interface ChamberContour extends ProjectedDiskContour {
  paintIndex: number;
  chamberIndex: number;
}
const EPS = 1e-12;
const close = (a: number, b: number) => Math.abs(a - b) <= EPS;
const coordinate = (n: number) => Number(n.toPrecision(15)).toString();
/** Equal straight edges may have different Bezier parameter speeds. Normalize
 * their geometric interval, after stroke/dash/profile paint is already outlined.
 */
function canonicalCurve(input: Cubic) {
  let curve = input;
  const [a, b, c, d] = curve,
    dx = d.x - a.x,
    dy = d.y - a.y,
    n2 = dx * dx + dy * dy;
  if (
    n2 > 1e-28 &&
    [b, c].every((p) => {
      const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / n2;
      return (
        t >= -EPS &&
        t <= 1 + EPS &&
        Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) <= EPS * Math.sqrt(n2)
      );
    })
  )
    curve = [
      a,
      { x: a.x + dx / 3, y: a.y + dy / 3 },
      { x: a.x + (2 * dx) / 3, y: a.y + (2 * dy) / 3 },
      d,
    ];
  const key = (c: Cubic) => c.map((p) => `${coordinate(p.x)},${coordinate(p.y)}`).join('/'),
    forward = key(curve),
    backward = key([...curve].reverse() as unknown as Cubic),
    reverse = backward < forward;
  return {
    curve: reverse ? ([...curve].reverse() as unknown as Cubic) : curve,
    key: reverse ? backward : forward,
    reverse,
  };
}
function evaluate(c: Cubic, t: number): Point {
  return {
    x:
      (1 - t) ** 3 * c[0].x +
      3 * (1 - t) ** 2 * t * c[1].x +
      3 * (1 - t) * t * t * c[2].x +
      t ** 3 * c[3].x,
    y:
      (1 - t) ** 3 * c[0].y +
      3 * (1 - t) ** 2 * t * c[1].y +
      3 * (1 - t) * t * t * c[2].y +
      t ** 3 * c[3].y,
  };
}
function arcPath(a: Point, b: Point, radius: number) {
  const g = diskGeodesic(a, b);
  if (g.kind === 'line') return `M${a.x * radius} ${a.y * radius}L${b.x * radius} ${b.y * radius}`;
  let delta = g.end - g.start;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return `M${a.x * radius} ${a.y * radius}A${g.r * radius} ${g.r * radius} 0 0 ${delta >= 0 ? 1 : 0} ${b.x * radius} ${b.y * radius}`;
}
interface CachedCurve {
  points: Point[];
  segments: number;
  bound: number;
  curve: Cubic;
  chamber: RootChamber;
  frame: Iso;
  uses: number;
  owners: Set<string>;
}
/** Additional adaptation, leaving the public inscribed motif mode untouched.
 * Reflection chambers impose shared geometric C0 boundaries, not C1 derivatives
 * or preservation of the planar pattern's original symmetry.
 */
export function deriveChamberDisk(
  project: Project,
  patternId: string,
  selection: FlatSourceSelection,
  settings: ChamberSettings,
) {
  const maximum = validateDiskSettings(settings),
    flat = prepareFlatPaintSource(project, patternId, selection, {
      tolerance: settings.strokeTolerance,
      maxCurves: settings.maxCurves,
    }),
    bounds = flat.report.bounds,
    source = preparePaintSource(
      flat.paints,
      () => ({
        matrix: [
          1 / bounds.width,
          0,
          0,
          1 / bounds.height,
          -bounds.x / bounds.width,
          -bounds.y / bounds.height,
        ],
        maxRadius: Math.SQRT2,
      }),
      { strokeTolerance: settings.strokeTolerance, maxCurves: settings.maxCurves, clipped: true },
    ),
    patch = regularHyperbolicPatch(settings.p, settings.q, settings),
    templates = rootChambers(patch),
    topology = canonicalHyperbolicTopology(patch),
    visible = visibleHyperbolicCells(patch, settings.minimumDiameter ?? 0.008),
    vertexPoints = new Map(
      [...topology.vertices].map(([id, v]) => [id, diskPoint(patch.view, v.point)]),
    ),
    edgePoints = new Map(
      [...topology.edges].map(([id, e]) => [id, diskPoint(patch.view, e.midpoint)]),
    ),
    pointCache = new Map<string, Point>(),
    curveCache = new Map<string, CachedCurve>();
  let remaining = maximum,
    bound = 0,
    adjustment = 0,
    curveHits = 0,
    boundaryHits = 0,
    outlineEstimate = 0;
  source.embedding.maxRadius = 0;
  for (const contour of source.contours)
    for (const path of contour.paths)
      for (const curve of path)
        for (const p of curve)
          source.embedding.maxRadius = Math.max(source.embedding.maxRadius, Math.hypot(p.x, p.y));
  const recordAdjustment = (a: Point, b: Point) => {
    adjustment = Math.max(adjustment, distance(a, b) * settings.radiusMm);
    if (adjustment > settings.toleranceMm * 0.1)
      throw Error('La discrepancia numérica del borde supera la precisión disponible.');
  };
  const edgeIdentity = (
    cell: HyperbolicCell,
    t: RootChamber,
    side: 'left' | 'right' | 'bottom' | 'top',
  ) => {
    const vertex = topology.corners.get(cell.id)![t.vertex],
      edge = topology.cellEdges.get(cell.id)![t.edge];
    return side === 'right'
      ? `EV:${edge}:${vertex}`
      : side === 'bottom'
        ? `OE:${cell.id}:${edge}`
        : `OV:${cell.id}:${vertex}`;
  };
  const curveSide = (c: Cubic): 'left' | 'right' | 'bottom' | 'top' | null =>
    c.every((p) => close(p.x, 0))
      ? 'left'
      : c.every((p) => close(p.x, 1))
        ? 'right'
        : c.every((p) => close(p.y, 0))
          ? 'bottom'
          : c.every((p) => close(p.y, 1))
            ? 'top'
            : null;
  const mapped = (cell: HyperbolicCell, t: RootChamber, p: Point): Point => {
    const original = chamberPoint(t, p, cell.display.frame),
      vertex = topology.corners.get(cell.id)![t.vertex],
      edge = topology.cellEdges.get(cell.id)![t.edge];
    let key: string | undefined, value: Point | undefined;
    if (close(p.x, 0) && close(p.y, 0)) {
      key = `O:${cell.id}`;
      value = cell.display.center;
    } else if (close(p.x, 1) && close(p.y, 0)) {
      key = `E:${edge}`;
      value = edgePoints.get(edge)!;
    } else if (close(p.x, 1) && close(p.y, 1)) {
      key = `V:${vertex}`;
      value = vertexPoints.get(vertex)!;
    } else {
      const side = close(p.x, 0)
        ? 'left'
        : close(p.x, 1)
          ? 'right'
          : close(p.y, 0)
            ? 'bottom'
            : close(p.y, 1)
              ? 'top'
              : null;
      if (side) {
        const u =
          side === 'left'
            ? p.y / 2
            : side === 'top'
              ? 0.5 + p.x / 2
              : side === 'bottom'
                ? p.x
                : p.y;
        key = `${edgeIdentity(cell, t, side)}:${coordinate(u)}`;
      }
    }
    if (key) {
      const cached = pointCache.get(key);
      if (cached) {
        recordAdjustment(original, cached);
        return cached;
      }
      const chosen = value ?? original;
      recordAdjustment(original, chosen);
      pointCache.set(key, chosen);
      return chosen;
    }
    return original;
  };
  const projectCurve = (cell: HyperbolicCell, t: RootChamber, input: Cubic) => {
    const canonical = canonicalCurve(input),
      side = curveSide(canonical.curve),
      owner = `${cell.id}/c${t.index}`,
      key = (side ? edgeIdentity(cell, t, side) : owner) + '/' + canonical.key;
    let cached = curveCache.get(key);
    if (cached) {
      curveHits++;
      if (side) boundaryHits++;
      // Numeric consistency diagnostic; the mathematical edge parametrization is
      // common. This estimate is kept separate from the analytical curve bound.
      for (const u of [0, 0.25, 0.5, 0.75, 1])
        recordAdjustment(
          chamberPoint(t, evaluate(canonical.curve, u), cell.display.frame),
          chamberPoint(cached.chamber, evaluate(cached.curve, u), cached.frame),
        );
    } else {
      if (remaining < 1) throw Error('Las cámaras exceden el presupuesto global de segmentos.');
      const projected = adaptiveMapCubic(
        canonical.curve,
        (p) => mapped(cell, t, p),
        (c) => chamberCubicError(c, t, cell.display.frame),
        (settings.toleranceMm / settings.radiusMm) * 0.5,
        { maxSegments: Math.min(remaining, 100000) },
      );
      cached = {
        points: projected.points.map((p) => ({
          x: p.x * settings.radiusMm,
          y: p.y * settings.radiusMm,
        })),
        segments: projected.segments,
        bound: projected.errorBound * settings.radiusMm,
        curve: canonical.curve,
        chamber: t,
        frame: cell.display.frame,
        uses: 0,
        owners: new Set(),
      };
      curveCache.set(key, cached);
    }
    if (cached.segments > remaining)
      throw Error('Las cámaras exceden el presupuesto global de segmentos.');
    remaining -= cached.segments;
    bound = Math.max(bound, cached.bound);
    cached.uses++;
    cached.owners.add(owner);
    return canonical.reverse ? [...cached.points].reverse() : cached.points;
  };
  const cells = visible.cells.map((cell) => {
    const contours: ChamberContour[] = [];
    for (const t of templates)
      source.contours.forEach((contour, paintIndex) => {
        const paths = contour.paths.map((path) => {
          const result: Point[] = [];
          for (const curve of path) {
            const projected = projectCurve(cell, t, curve);
            for (let i = result.length ? 1 : 0; i < projected.length; i++)
              result.push(projected[i]);
          }
          return result;
        });
        contours.push({ ...contour, paths, paintIndex, chamberIndex: t.index });
      });
    const points = topology.corners.get(cell.id)!.map((id) => vertexPoints.get(id)!);
    return {
      id: cell.id,
      depth: cell.depth,
      boundary: points
        .map((a, i) => arcPath(a, points[(i + 1) % points.length], settings.radiusMm))
        .join(''),
      contours,
    };
  });
  const activeIds = new Set(visible.cells.map((cell) => cell.id)),
    edges = [...topology.edges.values()]
      .filter((e) => e.owners.some((owner) => activeIds.has(owner.cellId)))
      .map((e) => {
        const a = vertexPoints.get(e.vertices[0])!,
          b = vertexPoints.get(e.vertices[1])!;
        return {
          id: e.id,
          a,
          b,
          midpoint: edgePoints.get(e.id)!,
          path: arcPath(a, b, settings.radiusMm),
          owners: e.owners,
        };
      });
  if (source.hasOutlinedStrokes) {
    const rK = Math.max(
        ...patch.root.map((p) => {
          const v = poincareToKlein(p);
          return Math.hypot(v.x, v.y);
        }),
      ),
      LP = 1 / Math.sqrt(1 - rK * rK),
      rootScale = Math.max(...templates.flatMap((t) => t.affines.map(linearScaleBound)));
    for (const cell of visible.cells) {
      const f = cell.display.frame,
        alpha = Math.hypot(f.ar, f.ai),
        beta = Math.hypot(f.br, f.bi),
        den = alpha - beta * patch.circumradius,
        lip = (Math.abs(alpha * alpha - beta * beta) / (den * den)) * LP * rootScale;
      outlineEstimate = Math.max(
        outlineEstimate,
        source.strokeOutlineTolerance *
          linearScaleBound(source.embedding.matrix) *
          lip *
          settings.radiusMm,
      );
    }
  }
  const boundaryTraces = settings.debugBoundaries
    ? [...curveCache]
        .filter(([key]) => key.startsWith('EV:') || key.startsWith('OE:') || key.startsWith('OV:'))
        .map(([key, c]) => ({ key, points: c.points, owners: [...c.owners], uses: c.uses }))
    : [];
  return {
    cells,
    flatSource: flat.report,
    edges,
    boundaryTraces,
    radiusMm: settings.radiusMm,
    report: {
      representation: 'poincare' as const,
      version: 1 as const,
      model: {
        validity: 'EXACT' as const,
        p: settings.p,
        q: settings.q,
        curvature: -1,
        finitePatch: true,
      },
      motif: {
        validity: 'APPROXIMATED' as const,
        method: 'mirrored-chambers',
        borderCorrespondence: 'CANONICAL_C0' as const,
        derivativesMatched: false,
      },
      numeric: {
        curveProjectionBoundMm: bound,
        requestedToleranceMm: settings.toleranceMm,
        canonicalAdjustmentEstimateMm: adjustment,
        canonicalNumericStepCertified: false,
        hasUncertifiedCanonicalStep: true,
        hasUncertifiedClippingStep: true,
        hasUncertifiedOutlineStep: source.hasOutlinedStrokes,
        outlineToleranceEstimateMm: outlineEstimate,
      },
      resources: {
        generated: patch.cells.length,
        visible: cells.length,
        omitted: visible.omitted,
        chambers: cells.length * templates.length,
        segments: maximum - remaining,
        maxSegments: maximum,
        limited: patch.limited,
        curveCacheHits: curveHits,
        boundaryCurveCacheHits: boundaryHits,
        canonicalVertices: topology.vertices.size,
        canonicalEdges: topology.edges.size,
        maxTopologyMismatch: topology.maxEndpointMismatch,
      },
      source: {
        ids: [...new Set(source.contours.map((c) => c.sourceId))],
        embedding: source.embedding,
        flatPreparation: flat.report,
        strokeTolerance: source.strokeOutlineTolerance,
      },
      view: structuredClone(settings.view ?? { center: { x: 0, y: 0 }, angle: 0 }),
    },
  };
}
export type ChamberDiskRepresentation = ReturnType<typeof deriveChamberDisk>;
/** One SVG paint per prepared contour, across all disjoint chambers. This keeps
 * common edges out of the rasterizer's alpha boundaries instead of overpainting.
 */
export function chamberDiskSVG(disk: ChamberDiskRepresentation, structure = false) {
  const groups = new Map<number, ChamberContour>();
  for (const cell of disk.cells)
    for (const contour of cell.contours) {
      const previous = groups.get(contour.paintIndex);
      if (previous) previous.paths.push(...contour.paths);
      else groups.set(contour.paintIndex, { ...contour, paths: [...contour.paths] });
    }
  const r = disk.radiusMm,
    d = 2 * r,
    body = [...groups.values()]
      .map(
        (c) =>
          `<path data-source="${escapeXML(c.sourceId)}" d="${c.paths.map((path) => 'M' + path.map((p) => `${p.x} ${p.y}`).join('L') + 'Z').join('')}" fill="${escapeXML(c.color)}" fill-rule="${c.fillRule}" opacity="${c.opacity}"/>`,
      )
      .join(''),
    mesh = structure
      ? disk.edges
          .map((edge) => `<path d="${edge.path}" fill="none" stroke="#111111" stroke-width="0.1"/>`)
          .join('')
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${d}mm" height="${d}mm" viewBox="${-r} ${-r} ${d} ${d}"><title>Patterns · Poincaré por cámaras reflejadas</title><metadata>${escapeXML(JSON.stringify(disk.report))}</metadata><defs><clipPath id="chamber-clip"><circle r="${r}"/></clipPath></defs><g clip-path="url(#chamber-clip)">${body}${mesh}</g></svg>`;
}
