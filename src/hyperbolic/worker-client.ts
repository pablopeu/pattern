import { runGeometryWorker } from '../geometry/worker-job';
import type { Geometry, Project } from '../app/model';
import type { DiskSettings, DiskRepresentation } from './representation';
import type { FlatSourceSelection, ProjectDiskRepresentation } from './flat-source';
import type { DiskWorkerRequest, DiskWorkerResult } from './worker';
/** A job owns its worker, so abort really stops synchronous geometry work.
 * Consumers can abort the previous job before submitting a newer source/view.
 */
export function deriveDiskInWorker(
  shapes: Geometry[],
  settings: DiskSettings,
  signal?: AbortSignal,
): Promise<DiskRepresentation> {
  return runDiskWorker({ kind: 'shapes', shapes, settings }, signal);
}
export async function deriveProjectDiskInWorker(
  project: Project,
  patternId: string,
  selection: FlatSourceSelection,
  settings: DiskSettings,
  signal?: AbortSignal,
): Promise<ProjectDiskRepresentation> {
  const result = await runDiskWorker(
    { kind: 'project', project, patternId, selection, settings },
    signal,
  );
  if (!result.flatSource) throw Error('Falta el informe de preparación plana.');
  return {
    ...result,
    report: {
      ...result.report,
      source: { ...result.report.source, flatPreparation: result.flatSource },
    },
    flatSource: result.flatSource,
  };
}
function runDiskWorker(
  request: DiskWorkerRequest,
  signal?: AbortSignal,
): Promise<DiskWorkerResult> {
  return runGeometryWorker<DiskWorkerRequest, DiskWorkerResult>(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    request,
    signal,
  );
}
