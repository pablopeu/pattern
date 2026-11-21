import type { Geometry } from '../app/model';
import type { DiskSettings, DiskRepresentation } from './representation';
import type { DiskWorkerReply } from './worker';
/** A job owns its worker, so abort really stops synchronous geometry work.
 * Consumers can abort the previous job before submitting a newer source/view.
 */
export function deriveDiskInWorker(
  shapes: Geometry[],
  settings: DiskSettings,
  signal?: AbortSignal,
): Promise<DiskRepresentation> {
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
      worker.postMessage({ shapes, settings });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
