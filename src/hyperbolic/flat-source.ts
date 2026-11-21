import { prepareFlatPaintSource, type FlatSourceSelection } from '../patterns/finite-source';
import type { Project } from '../app/model';
import { validPQ } from './disk';
import { derivePreparedDisk, type DiskSettings } from './representation';
import { preparePaintedDiskSource } from './source';

export type { FlatSourceSelection } from '../patterns/finite-source';
export function prepareFlatDiskSource(
  project: Project,
  patternId: string,
  selection: FlatSourceSelection,
  p: number,
  q: number,
  options: { tolerance?: number; maxPaints?: number; maxCurves?: number } = {},
) {
  if (!validPQ(p, q)) throw Error('Poincaré: p/q enteros3–12 y (p−2)(q−2)>4.');
  const flat = prepareFlatPaintSource(project, patternId, selection, options);
  return {
    source: preparePaintedDiskSource(flat.paints, p, q, {
      strokeTolerance: options.tolerance,
      maxCurves: options.maxCurves,
      clipped: true,
    }),
    report: flat.report,
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
