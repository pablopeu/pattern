import type { Project } from '../app/model';
import type { ClippedPaint } from '../application/clipping';
import { prepareFlatPatternExport, type ExportOptions } from '../export/svg';
import type { Bounds } from '../symmetry/groups';
import { validPQ } from './disk';
import { derivePreparedDisk, type DiskSettings } from './representation';
import { preparePaintedDiskSource } from './source';

export type FlatSourceSelection =
  | { target: 'view'; bounds: Bounds }
  | { target: 'tile' | 'lattice' | 'fundamental' };

/** Build a finite flat scene, including symmetry copies, tile clipping and linked
 * Fill. This does not write to the project or select a public representation.
 * The export route outlines original strokes before any crop. Numerical Paper
 * clipping and stroke outlining remain separate, uncertified preparation steps.
 */
export function prepareFlatDiskSource(
  project: Project,
  patternId: string,
  selection: FlatSourceSelection,
  p: number,
  q: number,
  options: { tolerance?: number; maxPaints?: number; maxCurves?: number } = {},
) {
  if (!validPQ(p, q)) throw Error('Poincaré: p/q enteros3–12 y (p−2)(q−2)>4.');
  const tolerance = options.tolerance ?? 0.02,
    maxPaints = options.maxPaints ?? 256;
  if (
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    !Number.isInteger(maxPaints) ||
    maxPaints < 1 ||
    maxPaints > 512 ||
    (options.maxCurves !== undefined &&
      (!Number.isInteger(options.maxCurves) || options.maxCurves < 1 || options.maxCurves > 24000))
  )
    throw Error('Precisión o presupuesto de preparación inválidos.');
  const bounds = selection.target === 'view' ? selection.bounds : undefined;
  if (
    bounds &&
    ([bounds.x, bounds.y, bounds.width, bounds.height].some((v) => !Number.isFinite(v)) ||
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      !Number.isFinite(bounds.x + bounds.width) ||
      !Number.isFinite(bounds.y + bounds.height))
  )
    throw Error('La ventana fuente debe ser finita y tener tamaño positivo.');
  const paints: ClippedPaint[] = [],
    exportOptions: ExportOptions = {
      target: selection.target,
      patternId,
      scope: 'pattern',
      format: 'svg',
      representation: 'expanded',
      outlineStrokes: true,
      width: bounds?.width ?? 100,
      height: bounds?.height ?? 100,
      dpi: 96,
      quality: 1,
      background: '#ffffff',
      transparent: true,
      tolerance,
    },
    result = prepareFlatPatternExport(project, exportOptions, undefined, bounds, (paint) => {
      if (paints.length >= maxPaints)
        throw Error(`La fuente supera${maxPaints} regiones de pintura; elegí un recorte menor.`);
      paints.push(paint);
    }),
    source = preparePaintedDiskSource(paints, p, q, {
      strokeTolerance: tolerance,
      maxCurves: options.maxCurves,
      clipped: true,
    });
  return {
    source,
    report: {
      kind: 'finite-flat-scene' as const,
      patternId,
      target: selection.target,
      bounds: structuredClone(result.bounds),
      preparationToleranceMm: tolerance,
      preparationCertified: false as const,
      paints: paints.length,
      sourceIds: [...new Set(paints.map((entry) => entry.sourceId))],
      warnings: [...result.warnings],
    },
  };
}

/** Entire finite preparation and projection can run inside the disposable worker. */
export function deriveProjectDisk(
  project: Project,
  patternId: string,
  selection: FlatSourceSelection,
  settings: DiskSettings,
) {
  const prepared = prepareFlatDiskSource(project, patternId, selection, settings.p, settings.q, {
    tolerance: settings.strokeTolerance,
  });
  const disk = derivePreparedDisk(prepared.source, settings);
  return {
    ...disk,
    report: { ...disk.report, source: { ...disk.report.source, flatPreparation: prepared.report } },
    flatSource: prepared.report,
  };
}
export type ProjectDiskRepresentation = ReturnType<typeof deriveProjectDisk>;
