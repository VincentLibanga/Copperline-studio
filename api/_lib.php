<?php
/**
 * Copperline CMS — shared helpers for the API endpoints.
 * Requires PHP 7.4 or newer. No database needed: content and settings are JSON files.
 */
declare(strict_types=1);

define('SITE_ROOT', dirname(__DIR__));
// Private data (password hash, enquiries, backups). Protected by data/.htaccess on Apache.
// On Nginx, or for extra safety, point CMS_DATA_DIR at a folder outside the web root.
define('DATA_DIR', rtrim(getenv('CMS_DATA_DIR') ?: SITE_ROOT . '/data', '/'));
define('CONTENT_JSON', SITE_ROOT . '/content/content.json');
define('CONTENT_JS', SITE_ROOT . '/content/content.js');
define('UPLOAD_DIR', SITE_ROOT . '/uploads');
define('MAX_CONTENT_BYTES', 3 * 1024 * 1024);
define('MAX_UPLOAD_BYTES', 12 * 1024 * 1024);
define('SESSION_IDLE_SECONDS', 2 * 3600);
define('SESSION_MAX_SECONDS', 12 * 3600);

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

function json_out(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $code = 400): void
{
    json_out(['ok' => false, 'error' => $message], $code);
}

function is_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

function read_json_body(int $limit = MAX_CONTENT_BYTES): array
{
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > $limit) {
        fail('That is too much data to save at once.', 413);
    }
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($raw === false || strlen($raw) > $limit) {
        fail('That is too much data to save at once.', 413);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail('The request was not valid JSON.');
    }
    return $data;
}

/* ---------------------------------------------------------------- private data files */

function ensure_data_dir(): void
{
    if (!is_dir(DATA_DIR) && !@mkdir(DATA_DIR, 0750, true)) {
        fail('The server cannot create the data folder. Check folder permissions.', 500);
    }
    $ht = DATA_DIR . '/.htaccess';
    if (!file_exists($ht)) {
        @file_put_contents($ht, "Require all denied\nDeny from all\n");
    }
    if (!file_exists(DATA_DIR . '/index.html')) {
        @file_put_contents(DATA_DIR . '/index.html', '');
    }
}

function data_file(string $name): string
{
    return DATA_DIR . '/' . $name;
}

function read_data(string $name, $default)
{
    $file = data_file($name);
    if (!is_file($file)) {
        return $default;
    }
    $data = json_decode((string)file_get_contents($file), true);
    return $data === null ? $default : $data;
}

function write_atomic(string $file, string $contents): void
{
    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0750, true)) {
        fail('The server cannot create a folder it needs. Check folder permissions.', 500);
    }
    $tmp = $dir . '/.' . basename($file) . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, $contents, LOCK_EX) === false || !@rename($tmp, $file)) {
        @unlink($tmp);
        fail('The server could not save the file. Check that the folder is writable.', 500);
    }
}

function write_data(string $name, $value): void
{
    ensure_data_dir();
    write_atomic(data_file($name), json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

/* ---------------------------------------------------------------- sessions and auth */

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('cms_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function is_logged_in(): bool
{
    start_session();
    if (empty($_SESSION['admin'])) {
        return false;
    }
    $now = time();
    if ($now - (int)($_SESSION['seen'] ?? 0) > SESSION_IDLE_SECONDS || $now - (int)($_SESSION['since'] ?? 0) > SESSION_MAX_SECONDS) {
        $_SESSION = [];
        return false;
    }
    $_SESSION['seen'] = $now;
    return true;
}

function require_login(): void
{
    if (!is_logged_in()) {
        fail('Please sign in again.', 401);
    }
}

function csrf_token(): string
{
    start_session();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function require_csrf(): void
{
    start_session();
    $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($sent === '' || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        fail('Your session expired. Reload the page and sign in again.', 403);
    }
}

function client_key(): string
{
    return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '|copperline');
}

/** Allow at most $max events per $window seconds for this visitor in $bucket. */
function rate_limit(string $bucket, int $max, int $window): void
{
    ensure_data_dir();
    $file = data_file('rate-limits.json');
    $fh = @fopen($file, 'c+');
    if (!$fh) {
        return;
    }
    flock($fh, LOCK_EX);
    $all = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];
    $now = time();
    $key = $bucket . ':' . client_key();
    foreach ($all as $k => $times) {
        $all[$k] = array_values(array_filter((array)$times, function ($t) use ($now, $window) { return $now - (int)$t < max($window, 3600); }));
        if (!$all[$k]) {
            unset($all[$k]);
        }
    }
    $recent = array_filter($all[$key] ?? [], function ($t) use ($now, $window) { return $now - (int)$t < $window; });
    $blocked = count($recent) >= $max;
    if (!$blocked) {
        $all[$key][] = $now;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($all));
    flock($fh, LOCK_UN);
    fclose($fh);
    if ($blocked) {
        fail('Too many attempts. Wait a few minutes and try again.', 429);
    }
}

function clean_text($value, int $max): string
{
    $s = trim(str_replace(["\r\n", "\r"], "\n", (string)$value));
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
}
