import type { Project } from '../app/model';
import type { Visualization } from './model';
import { visualizationSchema } from './schema';
import { deriveProjectDiskInWorker } from '../hyperbolic/worker-client';
import { diskPreviewSVG } from '../hyperbolic/representation';
import { deriveChamberDiskInWorker } from '../hyperbolic/chambers-worker-client';
import { chamberDiskSVG } from '../hyperbolic/chambers';
import { deriveArtisticDiskInWorker } from '../artistic/worker-client';
import { artisticDiskSVG } from '../artistic/disk';
/** Native discriminants select the actual engine, never silently an older view. */
export async function deriveVisualizationInWorker(
  project: Project,
  visualization: Visualization,
  signal?: AbortSignal,
) {
  visualizationSchema.parse(visualization);
  const v = visualization;
  if (v.kind === 'poincare') {
    if (v.settings.adaptation === 'mirrored-chambers') {
      const disk = await deriveChamberDiskInWorker(
        project,
        v.source.patternId,
        v.source.selection,
        v.settings,
        signal,
      );
      return { disk, svg: chamberDiskSVG(disk, v.showStructure) };
    }
    const disk = await deriveProjectDiskInWorker(
      project,
      v.source.patternId,
      v.source.selection,
      v.settings,
      signal,
    );
    return { disk, svg: diskPreviewSVG(disk, v.showStructure) };
  }
  const disk = await deriveArtisticDiskInWorker(
    project,
    v.source.patternId,
    v.source.selection,
    { ...v.settings, angle: v.settings.view.angle, center: v.settings.view.center },
    signal,
  );
  return { disk, svg: artisticDiskSVG(disk) };
}
export type DerivedDisk = Awaited<ReturnType<typeof deriveVisualizationInWorker>>['disk'];
