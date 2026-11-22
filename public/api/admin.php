<?php
/**
 * Administración por línea de comandos (PRD v3.1 §12.8).
 * Solo CLI: nunca se sirve por HTTP.
 *   php api/admin.php delete <id>
 *   php api/admin.php stats
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/lib.php';

$command = $argv[1] ?? '';
if ($command === 'delete') {
    $id = $argv[2] ?? '';
    if (!share_valid_id($id)) {
        fwrite(STDERR, "Identificador inválido.\n");
        exit(2);
    }
    if (share_read_meta($id) === null) {
        fwrite(STDERR, "La publicación no existe.\n");
        exit(1);
    }
    share_delete_files($id);
    echo "Publicación $id retirada.\n";
    exit(0);
}
if ($command === 'stats') {
    $global = share_storage() . '/_limits/global.json';
    $state = is_file($global) ? json_decode((string) file_get_contents($global), true) : null;
    echo json_encode(
        is_array($state) ? $state : ['files' => 0, 'bytes' => 0],
        JSON_UNESCAPED_SLASHES
    ) . "\n";
    exit(0);
}
fwrite(STDERR, "Uso: php api/admin.php delete <id> | stats\n");
exit(2);
