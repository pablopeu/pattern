<?php
/**
 * Página pública de una creación (PRD v3.1 §6.3, §7.4).
 * Sirve HTML con Open Graph real ANTES de cargar React: los bots sociales no
 * ejecutan JavaScript. Todos los datos se escapan; nunca se inyecta HTML del usuario.
 */
declare(strict_types=1);

require __DIR__ . '/../api/lib.php';

$id = (string) ($_GET['id'] ?? '');
if ($id === '' && preg_match('#/s/([0-9A-Za-z]{16})#', $_SERVER['REQUEST_URI'] ?? '', $m)) {
    $id = $m[1];
}

function share_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header(
    "Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
);

$valid = share_valid_id($id);
$meta = $valid ? share_read_meta($id) : null;
if ($meta === null || !is_file(share_path('document', $id))) {
    http_response_code(404);
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Publicación no encontrada · Patterns</title></head><body style="font-family:system-ui;padding:2rem"><h1>Publicación no encontrada</h1><p>El enlace no existe o fue retirado.</p><p><a href="../">Abrir Pattern Studio</a></p></body></html>';
    exit;
}

$base = share_public_base();
$link = share_link($id);
$title = (string) ($meta['title'] ?? 'Creación');
$description = (string) ($meta['description'] ?? '');
if ($description === '') {
    $description = 'Creación realizada con Pattern Studio: geometría vectorial editable.';
}
$hasPreview = ($meta['preview'] ?? 'none') === 'jpeg' && is_file(share_path('preview', $id));
$image = $hasPreview
    ? $base . 's/preview.php?id=' . rawurlencode($id)
    : $base . 'share-default.jpg';

// Manifest generado en build con los assets reales de Vite.
$manifestPath = __DIR__ . '/../assets-manifest.json';
$manifest = is_file($manifestPath) ? json_decode((string) file_get_contents($manifestPath), true) : null;
$scripts = is_array($manifest['scripts'] ?? null) ? $manifest['scripts'] : [];
$styles = is_array($manifest['styles'] ?? null) ? $manifest['styles'] : [];
?>
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="../" />
    <title><?= share_escape($title) ?> · Patterns</title>
    <meta name="description" content="<?= share_escape($description) ?>" />
    <link rel="canonical" href="<?= share_escape($link) ?>" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Patterns · Pattern Studio 2D" />
    <meta property="og:locale" content="es_AR" />
    <meta property="og:title" content="<?= share_escape($title) ?>" />
    <meta property="og:description" content="<?= share_escape($description) ?>" />
    <meta property="og:url" content="<?= share_escape($link) ?>" />
    <meta property="og:image" content="<?= share_escape($image) ?>" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="<?= share_escape($title) ?>" />
    <meta name="twitter:description" content="<?= share_escape($description) ?>" />
    <meta name="twitter:image" content="<?= share_escape($image) ?>" />
    <link rel="icon" href="icons/favicon.ico" sizes="any" />
    <link rel="manifest" href="site.webmanifest" />
    <?php foreach ($styles as $href): ?>
    <link rel="stylesheet" href="<?= share_escape('../' . ltrim((string) $href, './')) ?>" />
    <?php endforeach; ?>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__SHARE_ID__ = <?= json_encode($id) ?>;</script>
    <?php foreach ($scripts as $src): ?>
    <script type="module" src="<?= share_escape('../' . ltrim((string) $src, './')) ?>"></script>
    <?php endforeach; ?>
  </body>
</html>
