<?php
/** POST multipart "file" (signed in) -> stores a JPG, PNG or WebP in /uploads and returns its path. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if (!is_post()) {
    fail('Use POST to upload.', 405);
}
require_login();
require_csrf();
rate_limit('upload', 120, 3600);

$f = $_FILES['file'] ?? null;
if (!$f || !is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $code = (int)($f['error'] ?? UPLOAD_ERR_NO_FILE);
    fail($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE
        ? 'That image is larger than your hosting allows. Try a smaller one.'
        : 'No image arrived. Try again.');
}
if ((int)$f['size'] > MAX_UPLOAD_BYTES) {
    fail('Images must be under 12 MB.');
}
if (!is_uploaded_file($f['tmp_name'])) {
    fail('Upload rejected.');
}

$types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$mime = '';
if (class_exists('finfo')) {
    $mime = (string)(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
} else {
    $info = @getimagesize($f['tmp_name']);
    $mime = $info ? (string)$info['mime'] : '';
}
if (!isset($types[$mime]) || !@getimagesize($f['tmp_name'])) {
    fail('Use a JPG, PNG or WebP image.');
}

$base = strtolower(pathinfo((string)$f['name'], PATHINFO_FILENAME));
$base = trim(preg_replace('/[^a-z0-9]+/', '-', $base) ?? '', '-');
$base = substr($base !== '' ? $base : 'image', 0, 50);
$name = $base . '-' . bin2hex(random_bytes(3)) . '.' . $types[$mime];

if (!is_dir(UPLOAD_DIR) && !@mkdir(UPLOAD_DIR, 0755, true)) {
    fail('The uploads folder is missing and could not be created.', 500);
}
if (!@move_uploaded_file($f['tmp_name'], UPLOAD_DIR . '/' . $name)) {
    fail('The image could not be saved. Check that the uploads folder is writable.', 500);
}
@chmod(UPLOAD_DIR . '/' . $name, 0644);

json_out(['ok' => true, 'path' => 'uploads/' . $name]);
