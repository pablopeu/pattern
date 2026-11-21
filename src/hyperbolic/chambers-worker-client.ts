import type { Project } from '../app/model';
import type { FlatSourceSelection } from '../patterns/finite-source';
import { runGeometryWorker } from '../geometry/worker-job';
import type { ChamberRequest } from './chambers-worker';
import type { ChamberSettings, ChamberDiskRepresentation } from './chambers';
export function deriveChamberDiskInWorker(
  project: Project,
  patternId: string,
  selection: FlatSourceSelection,
  settings: ChamberSettings,
  signal?: AbortSignal,
) {
  return runGeometryWorker<ChamberRequest, ChamberDiskRepresentation>(
    () => new Worker(new URL('./chambers-worker.ts', import.meta.url), { type: 'module' }),
    { project, patternId, selection, settings },
    signal,
  );
}
