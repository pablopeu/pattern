import type { Geometry, Project } from '../app/model';
import type { DiskSettings, DiskRepresentation } from './representation';
import type { FlatSourceSelection, ProjectDiskRepresentation } from './flat-source';
import type { DiskWorkerReply, DiskWorkerRequest, DiskWorkerResult } from './worker';
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
  return new Promise((resolve, reject) => {
    const aborted = () => new DOMException('Representación cancelada.', 'AbortError');
    if (signal?.aborted) {
      reject(aborted());
      return;
    }
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(aborted());
    };
    worker.onmessage = (event: MessageEvent<DiskWorkerReply>) => {
      cleanup();
      if (event.data.ok) resolve(event.data.result);
      else reject(Error(event.data.error));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(Error(event.message || 'Error del worker hiperbólico.'));
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(Error('Respuesta hiperbólica no legible.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      worker.postMessage(request);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
