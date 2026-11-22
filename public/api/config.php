<?php
/**
 * Configuración del backend de publicaciones (PRD v3.1 §12.7).
 * Editable por el operador; nunca contiene secretos del cliente.
 * Los valores pueden sobreescribirse con variables de entorno (útil en PHP CLI).
 */
declare(strict_types=1);

function share_env(string $name, ?string $default = null): ?string
{
    $value = getenv($name);
    return $value === false ? $default : $value;
}

return [
    // Habilitar/deshabilitar publicaciones sin tocar el código.
    'enabled' => share_env('SHARE_ENABLED', '1') === '1',
    'maintenance' => share_env('SHARE_MAINTENANCE', '0') === '1',
    // Directorio privado de almacenamiento. Recomendado: fuera de public_html.
    // Por defecto queda junto al sitio desplegado y se protege con .htaccess.
    'storage' => share_env('SHARE_STORAGE')
        ?: dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'pattern_shares',
    // URL pública base del sitio (termina en /). Vacío = autodetectar del pedido.
    'public_base' => share_env('SHARE_PUBLIC_BASE', ''),
    // Límites iniciales (PRD §5.2).
    'limits' => [
        'document_bytes' => (int) (share_env('SHARE_MAX_DOCUMENT', (string) (2 * 1024 * 1024))),
        'compressed_bytes' => (int) (share_env('SHARE_MAX_COMPRESSED', (string) (256 * 1024))),
        'preview_bytes' => (int) (share_env('SHARE_MAX_PREVIEW', (string) (100 * 1024))),
        'meta_bytes' => 4096,
        'request_bytes' => (int) (share_env('SHARE_MAX_REQUEST', (string) (512 * 1024))),
    ],
    // Abuso: publicaciones por IP y por ventana diaria, y cuota global.
    'rate' => [
        'per_id_window' => (int) (share_env('SHARE_RATE_PER_WINDOW', '10')),
        'window_seconds' => (int) (share_env('SHARE_RATE_WINDOW', (string) (24 * 3600))),
        'global_bytes' => (int) (share_env('SHARE_GLOBAL_BYTES', (string) (2 * 1024 * 1024 * 1024))),
        'global_files' => (int) (share_env('SHARE_GLOBAL_FILES', '100000')),
    ],
    // Orígenes permitidos para el navegador (vacío = mismo origen solamente).
    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', share_env('SHARE_ALLOWED_ORIGINS', '') ?: '')
    ))),
    // Proxy de confianza: sólo aceptar cabeceras de cliente desde esta IP/grupo.
    'trusted_proxy' => share_env('SHARE_TRUSTED_PROXY', ''),
    'protocol' => 1,
];
