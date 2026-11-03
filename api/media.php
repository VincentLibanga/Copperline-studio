<?php
/** GET (signed in) -> every image in /uploads and /images, newest first, for the image library. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

require_login();

$files = [];
foreach (['uploads', 'images'] as $dir) {
    foreach (glob(SITE_ROOT . '/' . $dir . '/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', GLOB_BRACE) ?: [] as $path) {
        $files[] = ['path' => $dir . '/' . basename($path), 'size' => filesize($path), 'modified' => filemtime($path)];
    }
}
usort($files, function ($a, $b) { return $b['modified'] <=> $a['modified']; });

json_out(['ok' => true, 'files' => $files]);
