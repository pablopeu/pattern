import { pngDensity, jpegDensity } from './density';
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Exportación cancelada.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
export async function rasterize(
  svg: string,
  widthMM: number,
  heightMM: number,
  dpi: number,
  format: 'png' | 'jpeg',
  quality: number,
  background: string,
  transparent: boolean,
  signal?: AbortSignal,
): Promise<Blob> {
  signal?.throwIfAborted();
  const w = Math.round((widthMM / 25.4) * dpi),
    h = Math.round((heightMM / 25.4) * dpi);
  if (w * h > 64_000_000 || w < 1 || h < 1)
    throw Error('La imagen debe tener entre 1 y 64 millones de píxeles. Ajustá dimensiones o DPI.');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Canvas no disponible.');
  if (format === 'jpeg' || !transparent) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await abortable(
      new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(Error('No se pudo rasterizar el SVG.'));
        image.src = url;
      }),
      signal,
    );
    signal?.throwIfAborted();
    ctx.drawImage(image, 0, 0, w, h);
    const encoded = await abortable(
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(Error('No se pudo generar la imagen.'))),
          `image/${format}`,
          quality,
        ),
      ),
      signal,
    );
    const bytes = new Uint8Array(await abortable(encoded.arrayBuffer(), signal));
    signal?.throwIfAborted();
    return new Blob([format === 'png' ? pngDensity(bytes, dpi) : jpegDensity(bytes, dpi)], {
      type: `image/${format}`,
    });
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}
