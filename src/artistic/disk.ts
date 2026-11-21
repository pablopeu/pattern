import type { Project } from '../app/model';
import { apply, type Point } from '../geometry/matrix';
import { adaptiveMapCubic, type Cubic } from '../geometry/nonlinear';
import { preparePaintSource, type SourceContour } from '../geometry/paint-source';
import { prepareFlatPaintSource, type FlatSourceSelection } from '../patterns/finite-source';
import { escapeXML } from '../export/svg';

export interface ArtisticDiskSettings {
  radiusMm: number;
  toleranceMm: number;
  compression: number;
  angle: number;
  center: Point;
  maxSegments?: number;
  maxCurves?: number;
  strokeTolerance?: number;
}
function validateMap(settings: Pick<ArtisticDiskSettings, 'compression' | 'angle' | 'center'>) {
  if (
    !Number.isFinite(settings.compression) ||
    settings.compression < 0.1 ||
    settings.compression > 64 ||
    !Number.isFinite(settings.angle) ||
    !Number.isFinite(settings.center.x) ||
    !Number.isFinite(settings.center.y) ||
    Math.hypot(settings.center.x, settings.center.y) > 2
  )
    throw Error('Compresión, orientación o centro artístico inválidos.');
}
/** Smooth orientation-preserving radial map of the plane into the unit disk.
 * F(v)=R(angle)·u/sqrt(1+|u|²), u=compression·(v-center).
 * This is an artistic deformation, not a hyperbolic tessellation/isometry.
 */
export function artisticPoint(
  point: Point,
  settings: Pick<ArtisticDiskSettings, 'compression' | 'angle' | 'center'>,
): Point {
  validateMap(settings);
  const x = settings.compression * (point.x - settings.center.x),
    y = settings.compression * (point.y - settings.center.y),
    d = Math.hypot(1, x, y),
    c = Math.cos(settings.angle),
    s = Math.sin(settings.angle);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Punto artístico no finito.');
  return { x: (c * x - s * y) / d, y: (s * x + c * y) / d };
}
/** Bound for distance to the mapped endpoint chord. For g(u)=u/sqrt(1+|u|²),
 * ||Dg||≤1/sqrt(1+r²), ||D²g||≤6/(1+r²). The nearest point of the control
 * box to center gives a lower bound for r throughout its convex hull.
 * Rotation preserves distances. As with Poincare: L·deviation+M·chord²/8.
 */
export function artisticCubicError(
  curve: Cubic,
  settings: Pick<ArtisticDiskSettings, 'compression' | 'angle' | 'center'>,
) {
  validateMap(settings);
  const xs = curve.map((p) => p.x - settings.center.x),
    ys = curve.map((p) => p.y - settings.center.y),
    lower = (values: number[]) => Math.max(0, Math.min(...values), -Math.max(...values)),
    r = settings.compression * Math.hypot(lower(xs), lower(ys)),
    den = 1 + r * r,
    L = settings.compression / Math.sqrt(den),
    M = (6 * settings.compression ** 2) / den,
    [a, b, c, d] = curve,
    deviation = Math.max(
      Math.hypot(b.x - (2 * a.x + d.x) / 3, b.y - (2 * a.y + d.y) / 3),
      Math.hypot(c.x - (a.x + 2 * d.x) / 3, c.y - (a.y + 2 * d.y) / 3),
    );
  return L * deviation + (M * ((d.x - a.x) ** 2 + (d.y - a.y) ** 2)) / 8;
}
export type ArtisticContour = Omit<SourceContour, 'paths'> & { paths: Point[][] };
export function deriveArtisticDisk(
  project: Project,
  patternId: string,
  selection: FlatSourceSelection,
  settings: ArtisticDiskSettings,
) {
  validateMap(settings);
  const maximum = settings.maxSegments ?? 250000;
  if (
    !Number.isFinite(settings.radiusMm) ||
    settings.radiusMm <= 0 ||
    !Number.isFinite(settings.toleranceMm) ||
    settings.toleranceMm <= 0 ||
    !Number.isInteger(maximum) ||
    maximum < 1 ||
    maximum > 1000000
  )
    throw Error('Radio, precisión o presupuesto artístico inválidos.');
  const flat = prepareFlatPaintSource(project, patternId, selection, {
      tolerance: settings.strokeTolerance,
      maxCurves: settings.maxCurves,
    }),
    source = preparePaintSource(
      flat.paints,
      (bounds) => {
        const diagonal = Math.hypot(bounds.width, bounds.height);
        if (!Number.isFinite(diagonal) || diagonal < 1e-9)
          throw Error('Marco artístico degenerado.');
        const s = 2 / diagonal;
        return {
          matrix: [
            s,
            0,
            0,
            s,
            -(bounds.x + bounds.width / 2) * s,
            -(bounds.y + bounds.height / 2) * s,
          ],
          maxRadius: 1,
        };
      },
      { strokeTolerance: settings.strokeTolerance, maxCurves: settings.maxCurves, clipped: true },
    );
  let remaining = maximum,
    bound = 0;
  const contours: ArtisticContour[] = source.contours.map((contour) => ({
    ...contour,
    paths: contour.paths.map((path) => {
      const points: Point[] = [];
      for (const curve of path) {
        if (remaining < 1)
          throw Error('El disco artístico excede su presupuesto global de segmentos.');
        const result = adaptiveMapCubic(
          curve,
          (p) => artisticPoint(p, settings),
          (c) => artisticCubicError(c, settings),
          settings.toleranceMm / settings.radiusMm,
          { maxSegments: Math.min(remaining, 100000) },
        );
        remaining -= result.segments;
        bound = Math.max(bound, result.errorBound * settings.radiusMm);
        for (let i = points.length ? 1 : 0; i < result.points.length; i++)
          points.push({
            x: result.points[i].x * settings.radiusMm,
            y: result.points[i].y * settings.radiusMm,
          });
      }
      return points;
    }),
  }));
  return {
    contours,
    radiusMm: settings.radiusMm,
    report: {
      representation: 'artistic-disk' as const,
      version: 1 as const,
      validity: 'ARTISTIC' as const,
      hyperbolicTessellation: false as const,
      mapping: 'radial u/sqrt(1+|u|²)',
      source: { ...flat.report, embedding: source.embedding },
      parameters: {
        compression: settings.compression,
        angle: settings.angle,
        center: { ...settings.center },
      },
      numeric: {
        requestedToleranceMm: settings.toleranceMm,
        curveProjectionBoundMm: bound,
        curveProjectionCertified: true,
        hasUncertifiedClippingStep: source.hasUncertifiedClippingStep,
        hasUncertifiedOutlineStep: source.hasOutlinedStrokes,
        outlineToleranceEstimateMm: source.hasOutlinedStrokes
          ? source.strokeOutlineTolerance *
            source.embedding.matrix[0] *
            settings.radiusMm *
            settings.compression
          : 0,
      },
      resources: {
        paints: source.contours.length,
        segments: maximum - remaining,
        maxSegments: maximum,
      },
    },
  };
}
export type ArtisticDiskRepresentation = ReturnType<typeof deriveArtisticDisk>;
export function artisticDiskSVG(disk: ArtisticDiskRepresentation) {
  const r = disk.radiusMm,
    d = r * 2,
    body = disk.contours
      .map(
        (contour) =>
          `<path data-source="${escapeXML(contour.sourceId)}" d="${contour.paths.map((path) => 'M' + path.map((p) => `${p.x} ${p.y}`).join('L') + 'Z').join('')}" fill="${escapeXML(contour.color)}" fill-rule="${contour.fillRule}" opacity="${contour.opacity}"/>`,
      )
      .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${d}mm" height="${d}mm" viewBox="${-r} ${-r} ${d} ${d}"><title>Patterns · Disco artístico</title><metadata>${escapeXML(JSON.stringify(disk.report))}</metadata><defs><clipPath id="artistic-clip"><circle r="${r}"/></clipPath></defs><g clip-path="url(#artistic-clip)">${body}</g></svg>`;
}
/** Original planar coordinates to the derived disk, useful for independent probes. */
export function artisticSourcePoint(disk: ArtisticDiskRepresentation, point: Point) {
  const p = artisticPoint(
    apply(disk.report.source.embedding.matrix, point),
    disk.report.parameters,
  );
  return { x: p.x * disk.radiusMm, y: p.y * disk.radiusMm };
}
