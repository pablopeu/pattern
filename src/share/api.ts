/**
 * Cliente de publicaciones (PRD v3.1 §6, §8, §15).
 * Usa rutas relativas al documento: funcionan tanto en la app como en /s/{id}
 * y respetan la subruta real de producción.
 */
import type { Project } from '../app/model';
import { parseProject } from '../persistence/schema';
import { shareDocument, validateSharePayload, SHARE_LIMITS } from './document';

export interface PublishedShare {
  id: string;
  link: string;
  secret: string;
  preview: boolean;
}
export interface ShareError extends Error {
  status?: number;
  code?: string;
}

const secretsKey = 'pattern.share.secrets';
const publishKey = 'pattern.share.published';
const suggestionKey = 'pattern.share.suggestAfterSave';

function apiUrl(query: string) {
  // Producción: misma ruta que el documento. Pruebas/cross-origin: base explícita.
  const override = (window as unknown as { __SHARE_API_BASE__?: string }).__SHARE_API_BASE__;
  return override
    ? new URL(override.replace(/\/$/, '') + query).href
    : new URL(`api/index.php${query}`, document.baseURI).href;
}

function readMap(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}
function writeMap(key: string, value: Record<string, unknown>) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento local no disponible: la publicación sigue funcionando */
  }
}

/** secreto por publicación, guardado sólo en este navegador. */
export function rememberSecret(id: string, secret: string) {
  writeMap(secretsKey, { ...readMap(secretsKey), [id]: secret });
}
export function secretFor(id: string): string | undefined {
  const value = readMap(secretsKey)[id];
  return typeof value === 'string' ? value : undefined;
}
export function forgetSecret(id: string) {
  const map = readMap(secretsKey);
  delete map[id];
  writeMap(secretsKey, map);
}

export function publishedFor(projectLocalId: string): { id: string; link: string; hash: string } | undefined {
  const value = readMap(publishKey)[projectLocalId];
  return value && typeof value === 'object' ? (value as { id: string; link: string; hash: string }) : undefined;
}
export function rememberPublished(projectLocalId: string, entry: { id: string; link: string; hash: string }) {
  writeMap(publishKey, { ...readMap(publishKey), [projectLocalId]: entry });
}
export function forgetPublished(projectLocalId: string) {
  const map = readMap(publishKey);
  delete map[projectLocalId];
  writeMap(publishKey, map);
}

export function suggestionEnabled(): boolean {
  try {
    return localStorage.getItem(suggestionKey) !== 'off';
  } catch {
    return true;
  }
}
export function setSuggestionEnabled(enabled: boolean) {
  try {
    localStorage.setItem(suggestionKey, enabled ? 'on' : 'off');
  } catch {
    /* preferencia cosmética: sin almacenamiento se mantiene el valor por defecto */
  }
}

export async function documentHash(document: string): Promise<string> {
  const bytes = new TextEncoder().encode(document);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${bytes.length}:${document.length}`;
}

export function sharedIdFromLocation(): string | undefined {
  const injected = (window as unknown as { __SHARE_ID__?: string }).__SHARE_ID__;
  if (typeof injected === 'string' && /^[0-9A-Za-z]{16}$/.test(injected)) return injected;
  const path = /\/s\/([0-9A-Za-z]{16})(?:\/|$)/.exec(location.pathname);
  if (path) return path[1];
  const query = new URLSearchParams(location.search).get('share');
  return query && /^[0-9A-Za-z]{16}$/.test(query) ? query : undefined;
}

export async function publishShare(
  project: Project,
  preview: string | undefined,
  title: string,
  description: string,
): Promise<PublishedShare> {
  const document = shareDocument(project);
  validateSharePayload({ protocol: SHARE_LIMITS.protocol, document, preview });
  const key =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let response: Response;
  try {
    response = await fetch(apiUrl(''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': key },
      body: JSON.stringify({ protocol: SHARE_LIMITS.protocol, document, preview, title, description }),
    });
  } catch {
    const error = Error('No hay conexión con el servidor de publicaciones.') as ShareError;
    error.code = 'offline';
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Error(
      body?.message ??
        (response.status === 413
          ? 'El proyecto es demasiado grande para publicarse; seguí guardándolo localmente.'
          : response.status === 429
            ? 'Se alcanzó el límite de publicaciones; probá más tarde.'
            : response.status >= 500
              ? 'El servidor de publicaciones no está disponible ahora.'
              : 'No se pudo publicar la creación.'),
    ) as ShareError;
    error.status = response.status;
    error.code = body?.error;
    throw error;
  }
  if (!/^[0-9A-Za-z]{16}$/.test(body.id) || typeof body.link !== 'string')
    throw Error('Respuesta del servidor inválida.');
  rememberSecret(body.id, body.secret);
  rememberPublished(project.metadata.id, { id: body.id, link: body.link, hash: await documentHash(document) });
  return { id: body.id, link: body.link, secret: body.secret, preview: !!body.preview };
}

export async function fetchShare(id: string): Promise<Project> {
  const response = await fetch(apiUrl(`?id=${encodeURIComponent(id)}`));
  if (response.status === 404) throw Error('La publicación no existe o fue retirada.');
  if (!response.ok) throw Error('No se pudo recuperar la creación compartida.');
  const text = await response.text();
  const project = parseProject(text);
  if (!project) throw Error('La publicación no contiene un proyecto válido.');
  return project;
}

export async function deleteShare(id: string): Promise<void> {
  const secret = secretFor(id);
  if (!secret) throw Error('Este dispositivo no guarda el secreto de esta publicación.');
  const response = await fetch(apiUrl(`?id=${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { 'X-Share-Secret': secret },
  });
  if (!response.ok && response.status !== 404)
    throw Error('No se pudo retirar la publicación.');
  forgetSecret(id);
}
