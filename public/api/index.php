<?php
/**
 * API mínima de publicaciones (PRD v3.1 §6).
 * Rutas admitidas (las bonitas llegan por rewrite o router de desarrollo):
 *   POST   api/index.php                     → publicar
 *   GET    api/index.php?id=<16 Base62>      → recuperar documento
 *   DELETE api/index.php?id=<16 Base62>      → retirar con X-Share-Secret
 */
declare(strict_types=1);

require __DIR__ . '/lib.php';

$config = share_config();
if ($config['maintenance']) {
    share_fail(503, 'maintenance', 'Publicaciones en mantenimiento.');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = (string) ($_GET['id'] ?? '');
// Compatibilidad con /api/shares/{id} reescrito: PATH_INFO o ruta original.
if ($id === '' && preg_match('#/api/shares/([0-9A-Za-z]{16})#', $_SERVER['REQUEST_URI'] ?? '', $m)) {
    $id = $m[1];
}

if ($method === 'OPTIONS') {
    share_assert_origin();
    header('Allow: GET, POST, DELETE, OPTIONS');
    http_response_code(204);
    exit;
}

if ($method === 'POST' && $id === '') {
    share_assert_origin();
    if (!$config['enabled']) {
        share_fail(503, 'disabled', 'Las publicaciones están deshabilitadas.');
    }
    $declared = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($declared > $config['limits']['request_bytes']) {
        share_fail(413, 'request_too_large', 'La solicitud supera el tamaño permitido.');
    }
    $raw = file_get_contents('php://input', false, null, 0, $config['limits']['request_bytes'] + 1);
    if ($raw === false || strlen($raw) > $config['limits']['request_bytes']) {
        share_fail(413, 'request_too_large', 'La solicitud supera el tamaño permitido.');
    }
    $payload = json_decode($raw, true, 8);
    if (!is_array($payload) || ($payload['protocol'] ?? null) !== $config['protocol']) {
        share_fail(415, 'protocol', 'Versión de protocolo no admitida.');
    }
    $document = $payload['document'] ?? null;
    if (!is_string($document)) {
        share_fail(422, 'invalid_document', 'Falta el documento de la publicación.');
    }
    share_validate_document($document);

    $idemKey = (string) ($_SERVER['HTTP_X_IDEMPOTENCY_KEY'] ?? '');
    $existing = $idemKey !== '' ? share_idempotent($idemKey) : null;
    if ($existing !== null && share_read_meta($existing) !== null) {
        share_json_response(200, [
            'id' => $existing,
            'link' => share_link($existing),
            'idempotent' => true,
        ]);
    }

    $preview = share_process_preview(is_string($payload['preview'] ?? null) ? $payload['preview'] : null);
    $compressed = gzencode($document, 9);
    if ($compressed === false || strlen($compressed) > $config['limits']['compressed_bytes']) {
        share_fail(413, 'document_too_large', 'El proyecto comprimido supera el límite.');
    }
    $bytes = strlen($compressed);

    // Controles de abuso bajo locks breves e independientes por archivo.
    $rateFile = share_rate_file();
    share_counter_update($rateFile, static function (array $state) use ($config) {
        if ((int) $state['count'] >= $config['rate']['per_id_window']) {
            share_fail(429, 'rate_limited', 'Alcanzaste el límite de publicaciones de esta ventana.');
        }
        return $state;
    });
    share_counter_update(share_global_file(), static function (array $state) use ($config, $bytes) {
        if (
            (int) $state['bytes'] + $bytes > $config['rate']['global_bytes'] ||
            (int) $state['files'] + 1 > $config['rate']['global_files']
        ) {
            share_fail(429, 'quota', 'La cuota global de publicaciones está completa.');
        }
        return $state;
    });

    // Identificador con verificación de colisión y creación atómica sin sobrescribir.
    $id = '';
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $candidate = share_random_id();
        if (share_read_meta($candidate) === null && !is_file(share_path('document', $candidate))) {
            $id = $candidate;
            break;
        }
    }
    if ($id === '') {
        share_fail(503, 'collision', 'No se pudo reservar un identificador.');
    }

    $secret = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $meta = [
        'id' => $id,
        'createdAt' => gmdate('c'),
        'projectSchema' => 7,
        'compressedBytes' => $bytes,
        'documentBytes' => strlen($document),
        'contentHash' => hash('sha256', $document),
        'preview' => $preview !== null ? 'jpeg' : 'none',
        'previewVersion' => 1,
        'previewWidth' => 1200,
        'previewHeight' => 630,
        'title' => share_truncate((string) ($payload['title'] ?? 'Creación'), 120),
        'description' => share_truncate((string) ($payload['description'] ?? ''), 300),
        'secretHash' => hash('sha256', $secret),
    ];
    if ($preview !== null) {
        $dims = @getimagesizefromstring($preview);
        if (is_array($dims) && $dims[0] > 0 && $dims[1] > 0) {
            $meta['previewWidth'] = (int) $dims[0];
            $meta['previewHeight'] = (int) $dims[1];
        }
    }
    try {
        if ($preview !== null) {
            share_atomic_write(share_path('preview', $id), $preview);
        }
        share_write_meta($id, $meta);
        share_atomic_write(share_path('document', $id), $compressed);
    } catch (Throwable $e) {
        @unlink(share_path('preview', $id));
        @unlink(share_path('meta', $id));
        share_fail(503, 'storage_unavailable', 'No se pudo guardar la publicación.');
    }

    share_counter_update($rateFile, static function (array $state) {
        $state['count'] = (int) $state['count'] + 1;
        $state['bytes'] = (int) ($state['bytes'] ?? 0) + 1;
        return $state;
    });
    share_counter_update(share_global_file(), static function (array $state) use ($bytes) {
        $state['files'] = (int) $state['files'] + 1;
        $state['bytes'] = (int) $state['bytes'] + $bytes;
        return $state;
    });
    if ($idemKey !== '') {
        share_remember_idempotent($idemKey, $id);
    }

    share_json_response(201, [
        'id' => $id,
        'link' => share_link($id),
        'secret' => $secret,
        'preview' => $preview !== null,
    ], ['Location' => share_link($id)]);
}

if ($method === 'GET' && $id !== '') {
    if (!share_valid_id($id)) {
        share_fail(400, 'invalid_id', 'Identificador inválido.');
    }
    $meta = share_read_meta($id);
    if ($meta === null || !is_file(share_path('document', $id))) {
        share_fail(404, 'not_found', 'La publicación no existe.');
    }
    $compressed = file_get_contents(share_path('document', $id));
    if ($compressed === false || strlen($compressed) > $config['limits']['compressed_bytes']) {
        share_fail(500, 'integrity', 'Archivo de publicación inválido.');
    }
    $document = gzdecode($compressed);
    if (
        $document === false ||
        strlen($document) > $config['limits']['document_bytes'] ||
        !hash_equals((string) $meta['contentHash'], hash('sha256', $document))
    ) {
        share_fail(500, 'integrity', 'La integridad de la publicación no coincide.');
    }
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('ETag: "' . $meta['contentHash'] . '"');
    header('Cache-Control: public, max-age=31536000, immutable');
    echo $document;
    exit;
}

if ($method === 'DELETE' && $id !== '') {
    share_assert_origin();
    if (!share_valid_id($id)) {
        share_fail(400, 'invalid_id', 'Identificador inválido.');
    }
    $meta = share_read_meta($id);
    if ($meta === null) {
        share_fail(404, 'not_found', 'La publicación no existe.');
    }
    $secret = (string) ($_SERVER['HTTP_X_SHARE_SECRET'] ?? '');
    if ($secret === '' || !hash_equals((string) $meta['secretHash'], hash('sha256', $secret))) {
        share_fail(403, 'forbidden', 'Secreto de publicación inválido.');
    }
    share_delete_files($id);
    http_response_code(204);
    exit;
}

share_fail($method === 'GET' ? 400 : 405, 'route', 'Ruta o método no admitidos.');
