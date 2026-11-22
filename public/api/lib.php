<?php
/**
 * Librería del backend de publicaciones (PRD v3.1 §3–§6, §12).
 * PHP 8.1+, sin base de datos: archivos GZIP, metadatos mínimos y contadores
 * pequeños con flock. Nunca ejecuta contenido del usuario.
 */
declare(strict_types=1);

const SHARE_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SHARE_ID_PATTERN = '/^[0-9A-Za-z]{16}$/';

function share_config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}

function share_json_response(int $status, array $body, array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function share_fail(int $status, string $code, string $message): never
{
    share_json_response($status, ['error' => $code, 'message' => $message]);
}

/** Identificador Base62 de 16 caracteres generado con random_bytes y rechazo sin sesgo. */
function share_random_id(): string
{
    $out = '';
    while (strlen($out) < 16) {
        $bytes = random_bytes(32);
        for ($i = 0; $i < strlen($bytes) && strlen($out) < 16; $i++) {
            $value = ord($bytes[$i]);
            // 62*4 = 248: valores ≥248 se rechazan para eliminar el sesgo del módulo.
            if ($value >= 248) {
                continue;
            }
            $out .= SHARE_ID_ALPHABET[$value % 62];
        }
    }
    return $out;
}

function share_valid_id(string $id): bool
{
    return preg_match(SHARE_ID_PATTERN, $id) === 1;
}

function share_truncate(string $value, int $limit): string
{
    return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit);
}

function share_storage(): string
{
    $config = share_config();
    $dir = rtrim($config['storage'], '/\\');
    foreach (['', '/shares', '/meta', '/previews', '/_limits', '/_idem', '/_tmp'] as $part) {
        $path = $dir . $part;
        if (!is_dir($path) && !mkdir($path, 0750, true) && !is_dir($path)) {
            share_fail(503, 'storage_unavailable', 'Almacenamiento no disponible.');
        }
    }
    // Defensa adicional cuando el directorio queda dentro del sitio desplegado.
    $htaccess = $dir . '/.htaccess';
    if (!is_file($htaccess)) {
        @file_put_contents(
            $htaccess,
            "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n"
        );
    }
    return $dir;
}

/** Ruta distribuida por prefijos: shares/AB/CD/<id>.json.gz */
function share_path(string $kind, string $id): string
{
    $dir = share_storage();
    $base = match ($kind) {
        'document' => $dir . '/shares/' . substr($id, 0, 2) . '/' . substr($id, 2, 2),
        'meta' => $dir . '/meta/' . substr($id, 0, 2) . '/' . substr($id, 2, 2),
        'preview' => $dir . '/previews/' . substr($id, 0, 2) . '/' . substr($id, 2, 2),
        default => throw new InvalidArgumentException('kind'),
    };
    if (!is_dir($base)) {
        mkdir($base, 0750, true);
    }
    return match ($kind) {
        'document' => $base . '/' . $id . '.json.gz',
        'meta' => $base . '/' . $id . '.json',
        'preview' => $base . '/' . $id . '.jpg',
    };
}

/** Escritura atómica: temporal en el mismo filesystem + rename. */
function share_atomic_write(string $target, string $data): void
{
    $dir = dirname($target);
    $tmp = tempnam($dir, 'tmp_');
    if ($tmp === false) {
        share_fail(503, 'storage_unavailable', 'No se pudo escribir temporalmente.');
    }
    try {
        $ok = file_put_contents($tmp, $data, LOCK_EX);
        if ($ok !== strlen($data)) {
            throw new RuntimeException('short write');
        }
        if (!rename($tmp, $target)) {
            throw new RuntimeException('rename');
        }
    } catch (Throwable $e) {
        @unlink($tmp);
        share_fail(503, 'storage_unavailable', 'No se pudo confirmar la escritura.');
    }
}

function share_read_meta(string $id): ?array
{
    $path = share_path('meta', $id);
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false || strlen($raw) > share_config()['limits']['meta_bytes']) {
        return null;
    }
    $meta = json_decode($raw, true);
    return is_array($meta) && ($meta['id'] ?? null) === $id ? $meta : null;
}

function share_write_meta(string $id, array $meta): void
{
    $json = json_encode($meta, JSON_UNESCAPED_SLASHES);
    if ($json === false || strlen($json) > share_config()['limits']['meta_bytes']) {
        share_fail(500, 'meta_failed', 'No se pudieron preparar los metadatos.');
    }
    share_atomic_write(share_path('meta', $id), $json);
}

/** Validación mínima e independiente del documento (el esquema Zod vive en el cliente). */
function share_validate_document(string $json): void
{
    $config = share_config();
    if ($json === '' || strlen($json) > $config['limits']['document_bytes']) {
        share_fail(413, 'document_too_large', 'El proyecto supera el límite de publicación.');
    }
    $doc = json_decode($json, true, 64);
    if (!is_array($doc)) {
        share_fail(422, 'invalid_document', 'El documento no es un JSON válido.');
    }
    if (($doc['schemaVersion'] ?? null) !== 7) {
        share_fail(415, 'unsupported_schema', 'Versión de documento no admitida.');
    }
    if (!is_array($doc['patterns'] ?? null) || count($doc['patterns']) > 64) {
        share_fail(422, 'invalid_document', 'Estructura de documento inválida.');
    }
    foreach ($doc['patterns'] as $pattern) {
        if (!is_array($pattern) || !is_string($pattern['id'] ?? null)) {
            share_fail(422, 'invalid_document', 'Estructura de documento inválida.');
        }
    }
    if (($doc['metadata']['id'] ?? null) === null) {
        share_fail(422, 'invalid_document', 'Falta la identidad del proyecto.');
    }
}

/** Miniatura: sólo JPEG real, re-codificada con GD cuando está disponible. */
function share_process_preview(?string $dataUrl): ?string
{
    $config = share_config();
    if ($dataUrl === null || $dataUrl === '') {
        return null;
    }
    if (!preg_match('/^data:image\/jpeg;base64,([A-Za-z0-9+\/=\r\n]+)$/', $dataUrl, $m)) {
        share_fail(415, 'preview_format', 'La miniatura debe ser JPEG.');
    }
    $binary = base64_decode(preg_replace('/\s+/', '', $m[1]), true);
    if ($binary === false || strlen($binary) > $config['limits']['preview_bytes']) {
        share_fail(413, 'preview_too_large', 'La miniatura supera el límite.');
    }
    $info = @getimagesizefromstring($binary);
    if ($info === false || $info[2] !== IMAGETYPE_JPEG) {
        share_fail(415, 'preview_format', 'La miniatura no es un JPEG válido.');
    }
    // Sin GD no se acepta una imagen suministrada: se usa la tarjeta genérica.
    if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
        return null;
    }
    $image = @imagecreatefromstring($binary);
    if ($image === false) {
        share_fail(415, 'preview_format', 'La miniatura no se pudo decodificar.');
    }
    ob_start();
    imagejpeg($image, null, 82);
    $reencoded = ob_get_clean();
    imagedestroy($image);
    if ($reencoded === false || strlen($reencoded) > $config['limits']['preview_bytes']) {
        return null;
    }
    return $reencoded;
}

function share_client_ip(): string
{
    $config = share_config();
    $remote = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    // Sólo se acepta X-Forwarded-For desde un proxy declarado confiable.
    if ($config['trusted_proxy'] !== '' && $remote === $config['trusted_proxy']) {
        $forwarded = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0] ?? '');
        if (filter_var($forwarded, FILTER_VALIDATE_IP)) {
            return $forwarded;
        }
    }
    return $remote;
}

function share_window_key(): string
{
    $config = share_config();
    $window = $config['rate']['window_seconds'] > 0 ? $config['rate']['window_seconds'] : 86400;
    return (string) intdiv(time(), $window);
}

/** Contador pequeño con flock por archivo independiente (sin índice global). */
function share_counter_update(string $file, callable $mutate, int $lockTimeoutMs = 2000): array
{
    $handle = fopen($file, 'c+');
    if ($handle === false) {
        share_fail(503, 'storage_unavailable', 'Contadores no disponibles.');
    }
    $deadline = microtime(true) + $lockTimeoutMs / 1000;
    while (!flock($handle, LOCK_EX | LOCK_NB)) {
        if (microtime(true) > $deadline) {
            fclose($handle);
            share_fail(429, 'busy', 'Servidor ocupado; reintentá en un momento.');
        }
        usleep(20000);
    }
    try {
        $raw = stream_get_contents($handle);
        $state = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
        if (!is_array($state)) {
            $state = ['count' => 0, 'bytes' => 0, 'files' => 0];
        }
        $state = $mutate($state);
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($state, JSON_UNESCAPED_SLASHES));
        fflush($handle);
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
    return $state;
}

function share_rate_file(): string
{
    return share_storage() . '/_limits/ip_' . sha1(share_client_ip()) . '_' . share_window_key() . '.json';
}

function share_global_file(): string
{
    return share_storage() . '/_limits/global.json';
}

function share_assert_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return; // pedidos same-origin no envían Origin
    }
    $config = share_config();
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $same = (($_SERVER['HTTPS'] ?? '') === 'on' ? 'https://' : 'http://') . $host;
    $allowed = $config['allowed_origins'];
    if ($origin !== $same && !in_array($origin, $allowed, true)) {
        share_fail(403, 'origin', 'Origen no autorizado.');
    }
    if ($origin !== $same) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Idempotency-Key, X-Share-Secret');
        header('Access-Control-Max-Age: 600');
        header('Vary: Origin');
    }
}

function share_public_base(): string
{
    $config = share_config();
    if ($config['public_base'] !== '') {
        return rtrim($config['public_base'], '/') . '/';
    }
    $https = ($_SERVER['HTTPS'] ?? '') === 'on'
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    // La app vive en una subruta: /api/ y /s/ cuelgan del mismo prefijo.
    $script = $_SERVER['SCRIPT_NAME'] ?? '/api/index.php';
    $prefix = preg_replace('#/(api|s)/.*$#', '/', $script) ?: '/';
    return ($https ? 'https://' : 'http://') . $host . $prefix;
}

function share_link(string $id): string
{
    return share_public_base() . 's/' . $id;
}

function share_idempotent(string $key): ?string
{
    if (!preg_match('/^[A-Za-z0-9_-]{8,128}$/', $key)) {
        share_fail(400, 'idempotency', 'Clave de idempotencia inválida.');
    }
    $file = share_storage() . '/_idem/' . hash('sha256', $key) . '.json';
    if (!is_file($file)) {
        return null;
    }
    $state = json_decode((string) file_get_contents($file), true);
    return is_array($state) && is_string($state['id'] ?? null) && share_valid_id($state['id'])
        ? $state['id']
        : null;
}

function share_remember_idempotent(string $key, string $id): void
{
    if (!preg_match('/^[A-Za-z0-9_-]{8,128}$/', $key)) {
        return;
    }
    share_atomic_write(
        share_storage() . '/_idem/' . hash('sha256', $key) . '.json',
        json_encode(['id' => $id, 'createdAt' => gmdate('c')], JSON_UNESCAPED_SLASHES)
    );
}

function share_delete_files(string $id): bool
{
    $meta = share_read_meta($id);
    $doc = share_path('document', $id);
    $preview = share_path('preview', $id);
    $metaPath = share_path('meta', $id);
    $freed = 0;
    foreach ([$doc, $preview] as $file) {
        if (is_file($file)) {
            $freed += (int) filesize($file);
            @unlink($file);
        }
    }
    $removed = is_file($doc) || is_file($metaPath);
    @unlink($metaPath);
    if ($meta !== null) {
        share_counter_update(share_global_file(), static function (array $state) use ($meta, $freed) {
            $state['files'] = max(0, (int) $state['files'] - 1);
            $state['bytes'] = max(0, (int) $state['bytes'] - (int) ($meta['compressedBytes'] ?? $freed));
            return $state;
        });
    }
    return $removed;
}
