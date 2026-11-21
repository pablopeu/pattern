import type { Project } from '../app/model';
import type { FlatSourceSelection } from '../patterns/finite-source';
import { runGeometryWorker } from '../geometry/worker-job';
import type { ArtisticDiskRequest } from './worker';
import type { ArtisticDiskSettings, ArtisticDiskRepresentation } from './disk';
export function deriveArtisticDiskInWorker(
  project: Project,
  patternId: string,
  selection: FlatSourceSelection,
  settings: ArtisticDiskSettings,
  signal?: AbortSignal,
) {
  return runGeometryWorker<ArtisticDiskRequest, ArtisticDiskRepresentation>(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    { project, patternId, selection, settings },
    signal,
  );
}
