/**
 * Pruebas de integración del backend PHP real (PRD v3.1 §18 — no sólo mocks).
 * Levanta `php -S` con el router de desarrollo y ejercita publicar/recuperar/
 * idempotencia/rate limit/cuotas/borrado/seguridad. Uso: node scripts/share-php-test.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const phpAvailable = spawnSync('php', ['-v'], { encoding: 'utf8' });
if (phpAvailable.status !== 0) {
  console.error('PHP no está disponible; prueba de integración omitida.');
  process.exit(2);
}

const assert = (condition, message) => {
  if (!condition) throw Error(`FALLÓ: ${message}`);
  console.log(`  ok · ${message}`);
};

const doc = (suffix = 'a') =>
  JSON.stringify({
    schemaVersion: 7,
    metadata: { id: `local-${suffix}` },
    patterns: [{ id: `pattern-${suffix}` }],
    payload: suffix.repeat(120),
  });

async function startServer(env = {}) {
  const storage = await mkdtemp(join(tmpdir(), 'pattern-shares-')),
    port = 8100 + Math.floor(Math.random() * 700);
  const server = spawn(
    'php',
    ['-S', `127.0.0.1:${port}`, '-t', 'public', 'scripts/php-dev-router.php'],
    {
      env: {
        ...process.env,
        SHARE_STORAGE: storage,
        SHARE_PUBLIC_BASE: `http://127.0.0.1:${port}/`,
        SHARE_GLOBAL_BYTES: String(64 * 1024 * 1024),
        ...env,
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base + 'api/index.php');
      if (r.status === 400 || r.status === 405 || r.status === 503) break;
    } catch {
      /* arrancando */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { server, base, storage, stop: async () => { server.kill('SIGKILL'); await rm(storage, { recursive: true, force: true }); } };
}

const preview = `data:image/jpeg;base64,${(await readFile('public/share-default.jpg')).toString('base64')}`;

const main = await startServer({ SHARE_RATE_PER_WINDOW: '50' });
try {
  const { base, storage } = main;
  console.log('Backend PHP real:', base);
  const publish = async (body, headers = {}) =>
    fetch(base + 'api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  const created = await publish({ protocol: 1, document: doc(), preview, title: 'Prueba <script>alert(1)</script>', description: 'Descripción & especial' });
  assert(created.status === 201, `publicar responde 201 (${created.status})`);
  const record = await created.json();
  assert(/^[0-9A-Za-z]{16}$/.test(record.id), 'ID Base62 de 16 caracteres');
  assert(record.link === `${base}s/${record.id}`, 'enlace público con la ruta real');

  const fetched = await fetch(base + `api/shares/${record.id}`);
  assert(fetched.status === 200, 'recuperar responde 200');
  const text = await fetched.text();
  assert(text === doc(), 'el documento recuperado es idéntico');
  assert(createHash('sha256').update(text).digest('hex') === (await fetched.headers.get('etag') ?? '').replaceAll('"', ''), 'ETag = SHA-256 del documento');

  const page = await fetch(base + `s/${record.id}`);
  const html = await page.text();
  assert(page.status === 200 && html.includes('property="og:title"'), 'página pública con OG');
  assert(html.includes('Prueba &lt;script&gt;'), 'título escapado sin inyección HTML');
  // Sin GD el servidor degrada al fallback seguro (PRD §7.3); con GD re-codifica y la sirve.
  if (record.preview) {
    assert(html.includes(`s/preview.php?id=${record.id}`), 'og:image apunta a la miniatura propia');
    const previewResponse = await fetch(base + `s/preview.php?id=${record.id}`);
    assert(previewResponse.headers.get('content-type') === 'image/jpeg', 'miniatura servida como JPEG');
  } else {
    assert(html.includes('share-default.jpg'), 'sin GD se usa la tarjeta genérica segura');
  }

  const idempotent = await publish({ protocol: 1, document: doc() }, { 'X-Idempotency-Key': 'clave-fija-123456' });
  const idemBody = await idempotent.json();
  const idempotent2 = await publish({ protocol: 1, document: doc() }, { 'X-Idempotency-Key': 'clave-fija-123456' });
  const idemBody2 = await idempotent2.json();
  assert(idempotent2.status === 200 && idemBody2.id === idemBody.id, 'reintento con la misma clave devuelve el mismo ID');

  assert((await fetch(base + 'api/index.php?id=../../etc/passwd')).status === 400, 'path traversal rechazado');
  assert((await fetch(base + 'api/index.php?id=AAAA')).status === 400, 'ID inválido rechazado');
  assert((await fetch(base + 'api/index.php?id=ZZZZZZZZZZZZZZZZ')).status === 404, 'publicación inexistente 404');
  assert((await publish({ protocol: 9, document: doc() })).status === 415, 'protocolo no admitido 415');
  assert((await publish({ protocol: 1, document: '{no json' })).status === 422, 'documento inválido 422');
  assert((await publish({ protocol: 1, document: JSON.stringify({ schemaVersion: 3, patterns: [] }) })).status === 415, 'esquema no admitido 415');

  const wrong = await fetch(base + `api/shares/${record.id}`, { method: 'DELETE', headers: { 'X-Share-Secret': 'mal' } });
  assert(wrong.status === 403, 'borrado con secreto incorrecto 403');
  const removed = await fetch(base + `api/shares/${record.id}`, { method: 'DELETE', headers: { 'X-Share-Secret': record.secret } });
  assert(removed.status === 204, 'borrado con secreto correcto 204');
  assert((await fetch(base + `api/shares/${record.id}`)).status === 404, 'la publicación retirada ya no existe');

  const parallel = await Promise.all(
    Array.from({ length: 10 }, (_, i) => publish({ protocol: 1, document: doc(`p${i}`) })),
  );
  const ids = await Promise.all(parallel.map(async (r) => (await r.json()).id));
  assert(new Set(ids).size === 10, '10 publicaciones concurrentes generan 10 IDs únicos');
  assert(parallel.every((r) => r.status === 201), 'todas las publicaciones concurrentes responden 201');

  const admin = spawnSync('php', ['public/api/admin.php', 'stats'], {
    env: { ...process.env, SHARE_STORAGE: storage },
    encoding: 'utf8',
  });
  const stats = JSON.parse(admin.stdout);
  assert(stats.files >= 10 && stats.bytes > 0, 'admin CLI informa archivos y bytes');
  const adminDelete = spawnSync('php', ['public/api/admin.php', 'delete', ids[0]], {
    env: { ...process.env, SHARE_STORAGE: storage },
    encoding: 'utf8',
  });
  assert(adminDelete.status === 0, 'admin CLI retira una publicación');
} finally {
  await main.stop();
}

const limited = await startServer({ SHARE_RATE_PER_WINDOW: '2', SHARE_MAX_REQUEST: '2048' });
try {
  const { base } = limited;
  const publish = (document, size) =>
    fetch(base + 'api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol: 1, document }).padEnd(size ?? 0, ' '),
    });
  assert((await publish(doc(), 4096)).status === 413, 'solicitud excedida 413');
  assert((await publish(doc('r1'))).status === 201, 'primera publicación dentro de límite');
  assert((await publish(doc('r2'))).status === 201, 'segunda publicación dentro de límite');
  assert((await publish(doc('r3'))).status === 429, 'rate limit por ventana 429');
} finally {
  await limited.stop();
}

const maintenance = await startServer({ SHARE_MAINTENANCE: '1' });
try {
  const response = await fetch(maintenance.base + 'api/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ protocol: 1, document: doc() }),
  });
  assert(response.status === 503, 'mantenimiento responde 503');
} finally {
  await maintenance.stop();
}

console.log('Integración PHP: TODAS LAS PRUEBAS PASARON');
