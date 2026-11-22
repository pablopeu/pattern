/**
 * Documento compartible (PRD v3.1 §2.3, §5.2).
 * Se reutiliza la serialización nativa y el esquema vigentes; el servidor solo
 * transporta y guarda el JSON comprimido. Nada se redondea ni se recorta.
 */
import type { Project } from '../app/model';
import { parseProject, serialize } from '../persistence/schema';

export const SHARE_LIMITS = {
  /** JSON descomprimido máximo aceptado al publicar. */
  documentBytes: 2 * 1024 * 1024,
  /** Miniatura JPEG máxima. */
  previewBytes: 100 * 1024,
  /** Cuerpo HTTP total razonable (documento + miniatura + margen de protocolo). */
  requestBytes: 512 * 1024,
  protocol: 1,
} as const;

export interface SharePayload {
  protocol: number;
  document: string;
  preview?: string;
}

/** JSON compacto validado con el esquema vigente. Lanza si el documento no es válido. */
export function shareDocument(project: Project): string {
  const restored = parseProject(serialize(project));
  return JSON.stringify(restored);
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Estimación de tamaño comprimido para informar antes de publicar. */
export async function gzipSize(text: string): Promise<number> {
  if (typeof CompressionStream === 'undefined') return Math.ceil(byteLength(text) / 2);
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')),
    buffer = await new Response(stream).arrayBuffer();
  return buffer.byteLength;
}

export function validateSharePayload(payload: SharePayload) {
  if (!payload || payload.protocol !== SHARE_LIMITS.protocol)
    throw Error('Versión de protocolo de publicación no admitida.');
  if (typeof payload.document !== 'string') throw Error('Documento de publicación inválido.');
  const size = byteLength(payload.document);
  if (size > SHARE_LIMITS.documentBytes)
    throw Error(
      `El proyecto supera el límite de publicación (${Math.round(size / 1024)} KiB > 2 MiB). Seguí guardándolo localmente.`,
    );
  // Valida la migración localmente antes de enviar: nunca se publica algo que no reabre.
  parseProject(payload.document);
  if (payload.preview !== undefined) {
    if (!/^data:image\/jpeg;base64,/.test(payload.preview))
      throw Error('La miniatura debe ser un JPEG.');
    const bytes = Math.ceil((payload.preview.length - payload.preview.indexOf(',') - 1) * 0.75);
    if (bytes > SHARE_LIMITS.previewBytes) throw Error('La miniatura supera 100 KiB.');
  }
  const total =
    byteLength(payload.document) + (payload.preview ? Math.ceil(payload.preview.length * 0.75) : 0);
  if (total > SHARE_LIMITS.requestBytes)
    throw Error('La publicación supera el tamaño total permitido (512 KiB).');
  return payload;
}
