<?php
/**
 * POST (signed in) -> save the whole site content.
 * Keeps the 30 most recent versions in data/backups so any edit can be undone.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if (!is_post()) {
    fail('Use POST to save content.', 405);
}
require_login();
require_csrf();

$content = read_json_body();
foreach (['site', 'hero', 'statement', 'services', 'work', 'contact', 'footer'] as $key) {
    if (!isset($content[$key]) || !is_array($content[$key])) {
        fail('The content is missing the "' . $key . '" section, so it was not saved.');
    }
}

/* Images must be uploaded files, not pasted data. */
$embedded = false;
array_walk_recursive($content, function ($v) use (&$embedded) {
    if (is_string($v) && strncmp($v, 'data:', 5) === 0) {
        $embedded = true;
    }
});
if ($embedded) {
    fail('Some images were added in demo mode. Upload them again through the editor, then publish.');
}

ensure_data_dir();
if (is_file(CONTENT_JSON)) {
    $backupDir = DATA_DIR . '/backups';
    if (!is_dir($backupDir)) {
        @mkdir($backupDir, 0750, true);
    }
    @copy(CONTENT_JSON, $backupDir . '/content-' . date('Ymd-His') . '.json');
    $old = glob($backupDir . '/content-*.json') ?: [];
    rsort($old);
    foreach (array_slice($old, 30) as $f) {
        @unlink($f);
    }
}

$flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT;
$json = json_encode($content, $flags);
$js = "/* Website content. Edited through the admin panel (yoursite/#admin). */\nwindow.SITE_CONTENT = "
    . json_encode($content, $flags | JSON_HEX_TAG | JSON_HEX_AMP) . ";\n";

write_atomic(CONTENT_JSON, $json);
write_atomic(CONTENT_JS, $js);

json_out(['ok' => true, 'saved' => time()]);
