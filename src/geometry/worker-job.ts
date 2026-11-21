export type GeometryWorkerReply<Result> =
  | { ok: true; result: Result }
  | { ok: false; error: string };
/** A job owns a module worker. Abort terminates synchronous geometry and cleanup
 * runs on every completion/error path, including failed structured cloning.
 */
export function runGeometryWorker<Request, Result>(
  createWorker: () => Worker,
  request: Request,
  signal?: AbortSignal,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const aborted = () => new DOMException('Representación cancelada.', 'AbortError');
    if (signal?.aborted) {
      reject(aborted());
      return;
    }
    const worker = createWorker();
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(aborted());
    };
    worker.onmessage = (event: MessageEvent<GeometryWorkerReply<Result>>) => {
      cleanup();
      if (event.data.ok) resolve(event.data.result);
      else reject(Error(event.data.error));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(Error(event.message || 'Error del worker de geometría.'));
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(Error('Respuesta de geometría no legible.'));
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
