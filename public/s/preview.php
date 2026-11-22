<?php
/**
 * Miniatura pública de una creación (PRD v3.1 §7, §13.1).
 * Inmutable: se sirve con cache larga y ETag. Nunca sirve SVG ni contenido activo.
 */
declare(strict_types=1);

require __DIR__ . '/../api/lib.php';

$id = (string) ($_GET['id'] ?? '');
if (!share_valid_id($id)) {
    http_response_code(400);
    exit;
}
$meta = share_read_meta($id);
$file = share_path('preview', $id);
if ($meta === null || ($meta['preview'] ?? 'none') !== 'jpeg' || !is_file($file)) {
    // Fallback seguro: tarjeta genérica del sitio.
    header('Location: ../share-default.jpg', true, 302);
    exit;
}
$etag = '"' . hash_file('sha256', $file) . '"';
if (trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}
header('Content-Type: image/jpeg');
header('Content-Length: ' . filesize($file));
header('ETag: ' . $etag);
header('Cache-Control: public, max-age=31536000, immutable');
header('X-Content-Type-Options: nosniff');
readfile($file);
