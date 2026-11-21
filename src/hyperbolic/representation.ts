import type { Geometry } from '../app/model';
import {
  regularHyperbolicPatch,
  visibleHyperbolicCells,
  hyperbolicCellPath,
  validPQ,
  type HyperbolicOptions,
} from './disk';
import { prepareDiskSource, projectDiskSource, type PreparedDiskSource } from './source';
export interface DiskSettings extends Partial<HyperbolicOptions> {
  p: number;
  q: number;
  radiusMm: number;
  toleranceMm: number;
  minimumDiameter?: number;
  maxSegments?: number;
  strokeTolerance?: number;
}
function validateDiskSettings(settings: DiskSettings) {
  if (!validPQ(settings.p, settings.q)) throw Error('Poincaré: p/q enteros3–12 y (p−2)(q−2)>4.');
  const maximum = settings.maxSegments ?? 250000;
  if (
    !Number.isInteger(maximum) ||
    maximum < 1 ||
    maximum > 1000000 ||
    !Number.isFinite(settings.radiusMm) ||
    settings.radiusMm <= 0 ||
    !Number.isFinite(settings.toleranceMm) ||
    settings.toleranceMm <= 0
  )
    throw Error('Radio, precisión o presupuesto global inválidos.');
  return maximum;
}
/** Synchronous bounded worker-friendly core. Not a native/UI representation yet.
 * Throws atomically on excess: consumers must keep the flat source recoverable.
 */
export function deriveDisk(shapes: Geometry[], settings: DiskSettings) {
  validateDiskSettings(settings);
  return derivePreparedDisk(
    prepareDiskSource(shapes, settings.p, settings.q, {
      strokeTolerance: settings.strokeTolerance,
    }),
    settings,
  );
}
/** Reuse a finite prepared source without losing its clipping/outline provenance. */
export function derivePreparedDisk(source: PreparedDiskSource, settings: DiskSettings) {
  const maximum = validateDiskSettings(settings);
  if (source.model.p !== settings.p || source.model.q !== settings.q)
    throw Error('La fuente preparada corresponde a otra configuración p/q.');
  const patch = regularHyperbolicPatch(settings.p, settings.q, settings),
    visible = visibleHyperbolicCells(patch, settings.minimumDiameter ?? 0.008);
  let remaining = maximum,
    curveProjectionBoundMm = 0,
    outlineEstimateMm = 0;
  const cells = visible.cells.map((cell) => {
    if (remaining < 1) throw Error('El disco excede su presupuesto global de segmentos.');
    const projection = projectDiskSource(
      source,
      cell.display.frame,
      settings.radiusMm,
      settings.toleranceMm,
      remaining,
    );
    remaining -= projection.segments;
    curveProjectionBoundMm = Math.max(curveProjectionBoundMm, projection.curveProjectionBoundMm);
    outlineEstimateMm = Math.max(outlineEstimateMm, projection.outlineToleranceMappedEstimateMm);
    return {
      id: cell.id,
      depth: cell.depth,
      boundary: hyperbolicCellPath(cell.display.vertices, settings.radiusMm),
      contours: projection.contours,
    };
  });
  return {
    cells,
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
        method: 'inscribed-control-hull',
        borderCorrespondence: 'NOT_GUARANTEED' as const,
      },
      numeric: {
        curveProjectionBoundMm,
        requestedToleranceMm: settings.toleranceMm,
        outlineToleranceEstimateMm: outlineEstimateMm,
        hasUncertifiedOutlineStep: source.hasOutlinedStrokes,
        hasUncertifiedClippingStep: source.hasUncertifiedClippingStep,
      },
      resources: {
        generated: patch.cells.length,
        visible: cells.length,
        omitted: visible.omitted,
        segments: maximum - remaining,
        maxSegments: maximum,
        limited: patch.limited,
      },
      source: {
        ids: [...new Set(source.contours.map((c) => c.sourceId))],
        embedding: source.embedding,
        strokeTolerance: source.strokeOutlineTolerance,
      },
      view: structuredClone(settings.view ?? { center: { x: 0, y: 0 }, angle: 0 }),
    },
  };
}
export type DiskRepresentation = ReturnType<typeof deriveDisk>;
const xml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
/** Diagnostic SVG in physical mm, independent of app export routes. */
export function diskPreviewSVG(disk: DiskRepresentation, structure = false) {
  const r = disk.radiusMm,
    diameter = 2 * r;
  const body = disk.cells
    .map(
      (cell) =>
        `<g data-cell="${xml(cell.id)}">` +
        cell.contours
          .map(
            (c) =>
              `<path data-source="${xml(c.sourceId)}" d="${c.paths.map((path) => 'M' + path.map((v) => `${v.x} ${v.y}`).join('L') + 'Z').join('')}" fill="${xml(c.color)}" fill-rule="${c.fillRule}" opacity="${c.opacity}"/>`,
          )
          .join('') +
        (structure
          ? `<path d="${cell.boundary}" fill="none" stroke="#111111" stroke-width="0.1"/>`
          : '') +
        '</g>',
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}mm" height="${diameter}mm" viewBox="${-r} ${-r} ${diameter} ${diameter}"><metadata>${xml(JSON.stringify(disk.report))}</metadata><defs><clipPath id="disk-clip"><circle r="${r}"/></clipPath></defs><g clip-path="url(#disk-clip)">${body}</g></svg>`;
}
