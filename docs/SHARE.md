# Publicaciones y enlaces compartibles (v3.1)

Permite publicar voluntariamente un estudio y obtener un enlace permanente con
miniatura Open Graph. El editor sigue funcionando sin Internet ni backend.

## Arquitectura

- Frontend estático (el actual). El navegador serializa, comprime la estimación y
  sube el JSON nativo; el servidor no ejecuta geometría.
- Backend PHP 8.1+ sin base de datos: `api/index.php` (publicar, recuperar,
  retirar), `s/index.php` (página pública con OG), `s/preview.php` (miniatura).
- Almacenamiento privado: JSON compacto GZIP, metadatos mínimos y miniatura JPEG,
  distribuidos por prefijos `shares/AB/CD/<id>.json.gz`.

## Configuración (`api/config.php` o variables de entorno)

| Ajuste | Variable | Predeterminado |
|---|---|---|
| Habilitar publicaciones | `SHARE_ENABLED=1` | habilitado |
| Mantenimiento | `SHARE_MAINTENANCE=1` | deshabilitado |
| Directorio de datos | `SHARE_STORAGE=/ruta/privada` | `<sitio>/../pattern_shares` |
| URL pública base | `SHARE_PUBLIC_BASE=https://ejemplo/pattern/` | autodetectada |
| Documento máx. | `SHARE_MAX_DOCUMENT` (bytes) | 2 MiB |
| Comprimido máx. | `SHARE_MAX_COMPRESSED` (bytes) | 256 KiB |
| Miniatura máx. | `SHARE_MAX_PREVIEW` (bytes) | 100 KiB |
| Solicitud máx. | `SHARE_MAX_REQUEST` (bytes) | 512 KiB |
| Publicaciones por ventana | `SHARE_RATE_PER_WINDOW` | 10 |
| Ventana (s) | `SHARE_RATE_WINDOW` | 86400 |
| Cuota global | `SHARE_GLOBAL_BYTES`, `SHARE_GLOBAL_FILES` | 2 GiB, 100000 |
| Orígenes permitidos | `SHARE_ALLOWED_ORIGINS` (coma) | mismo origen |
| Proxy confiable | `SHARE_TRUSTED_PROXY` (IP) | ninguno |

Recomendado: ubicar `SHARE_STORAGE` **fuera de `public_html`**. Si no es posible,
el backend crea un `.htaccess` de denegación en ese directorio; verificá que
`https://sitio/pattern_shares/...` responda 403/404.

## Rutas

- `POST api/index.php` con `{protocol:1, document, preview?, title, description}` y
  `X-Idempotency-Key` → `201 {id, link, secret}` (sin reescrituras; las rutas
  bonitas `/api/shares/{id}` y `/s/{id}` las provee `.htaccess` si hay mod_rewrite).
- `GET api/index.php?id=<16 Base62>` → documento JSON con ETag = SHA-256.
- `DELETE api/index.php?id=` + `X-Share-Secret` → 204.
- `GET s/?id=<id>` (o `/s/{id}`) → HTML con OG/Twitter antes de cargar React.
- `GET s/preview.php?id=` → JPEG con cache inmutable y regresión a tarjeta genérica.

Sin mod_rewrite, el frontend usa `api/index.php` y la página `s/?id=`; los enlaces
bonitos funcionan con Apache.

## Operación

- **Retirar una publicación**: en el dispositivo que publicó, botón «Retirar
  publicación» del diálogo Compartir (secreto guardado en `localStorage`). En
  servidor: `php api/admin.php delete <id>` (CLI únicamente).
- **Estadísticas**: `php api/admin.php stats` (archivos y bytes de la cuota).
- **Backup**: copiar `SHARE_STORAGE` completo (comprimido). Restaurar el directorio
  recrea los enlaces; ejecutar `stats` para verificar contadores.
- **Open Graph**: validar una publicación con el depurador de la plataforma;
  comprobar que `/s/{id}` responde 200 sin ejecutar JS y que `og:image` responde
  `image/jpeg`. Las plataformas pueden conservar vistas previas tras retirar.
- **GD ausente**: el servidor no acepta miniaturas subidas y usa
  `share-default.jpg`; publicar sigue funcionando.
- **Miniatura sin presupuesto**: el cliente intenta 1200×630 y escala hasta 600×315
  con calidades decrecientes; si aun así supera 100 KiB, la publicación continúa
  con la tarjeta genérica (nunca se bloquea el enlace). Las dimensiones reales de
  la miniatura se guardan y se emiten en Open Graph.
- **Rate limit/cuota alcanzados**: responden 429 sin afectar publicaciones previas.

## Seguridad

- ID = 16 caracteres Base62 con `random_bytes` sin sesgo de módulo y verificación
  de colisión; escritura atómica (temporal + rename); nunca sobrescribe.
- Solicitudes: límite de cuerpo, JSON con profundidad acotada, `schemaVersion`
  admitido, documentación escapada en HTML, CSP en la página pública, CORS sólo
  para orígenes configurados, `POST` obligatorio para publicar.
- Sin `unserialize`, sin ejecución de contenido subido, sin rutas provistas por el
  cliente; los archivos privados se sirven sólo a través del PHP.
- El secreto de retiro se guarda como SHA-256 en el servidor y nunca viaja dentro
  del documento ni del enlace.

## Pruebas

- `npm run test:share:php` — integración con PHP real (publicar, recuperar,
  idempotencia, rate limit, cuotas, retiro, path traversal, mantenimiento, OG).
- `tests/share.spec.ts` — E2E de la UX con un stub del contrato (el backend real
  se cubre con la integración anterior).
- `npm run share:benchmark` — tamaños y compresión de los 19 estudios
  (`.runtime/share-benchmark.json`).
