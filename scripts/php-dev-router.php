<?php
/**
 * Router para el servidor embebido de PHP en desarrollo:
 *   php -S 127.0.0.1:8090 -t public public/api/dev-router.php
 * En producción Apache usa public/.htaccess. Nunca se despliega como ruta pública.
 */
declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (preg_match('#(?:^|/)api/shares/([0-9A-Za-z]{16})$#', $uri, $m)) {
    $_GET['id'] = $m[1];
    require __DIR__ . '/../public/api/index.php';
    return true;
}
if (preg_match('#(?:^|/)api/shares/?$#', $uri)) {
    require __DIR__ . '/../public/api/index.php';
    return true;
}
if (preg_match('#(?:^|/)s/([0-9A-Za-z]{16})/preview\.jpg$#', $uri, $m)) {
    $_GET['id'] = $m[1];
    require __DIR__ . '/../public/s/preview.php';
    return true;
}
if (preg_match('#(?:^|/)s/([0-9A-Za-z]{16})/?$#', $uri, $m)) {
    $_GET['id'] = $m[1];
    require __DIR__ . '/../public/s/index.php';
    return true;
}
return false;
