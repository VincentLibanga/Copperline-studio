<?php
/**
 * GET  -> sign-in status for the editor.
 * POST {action: "setup", code, password}   first-time password (needs the code in data/setup-code.txt)
 * POST {action: "login", password}
 * POST {action: "logout"}
 * POST {action: "password", current, password}   change password (signed in)
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

ensure_data_dir();
start_session();
$auth = read_data('auth.json', null);
$setupNeeded = !is_array($auth) || empty($auth['hash']);

/* A one-time setup code stops strangers from claiming a fresh install. */
function setup_code(): string
{
    $file = data_file('setup-code.txt');
    if (!is_file($file)) {
        $code = strtoupper(substr(bin2hex(random_bytes(6)), 0, 10));
        write_atomic($file, $code . "\n");
    }
    return trim((string)file_get_contents($file));
}

if (!is_post()) {
    if ($setupNeeded) {
        setup_code();
    }
    json_out([
        'ok' => true,
        'setup_needed' => $setupNeeded,
        'logged_in' => !$setupNeeded && is_logged_in(),
        'csrf' => csrf_token(),
    ]);
}

$body = read_json_body(10000);
$action = (string)($body['action'] ?? '');
$password = (string)($body['password'] ?? '');

function sign_in(): void
{
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    $_SESSION['since'] = $_SESSION['seen'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

switch ($action) {
    case 'setup':
        if (!$setupNeeded) {
            fail('A password already exists. Sign in instead.', 409);
        }
        rate_limit('setup', 8, 900);
        if (!hash_equals(setup_code(), strtoupper(trim((string)($body['code'] ?? ''))))) {
            fail('That setup code is not right. Open data/setup-code.txt on your hosting to find it.', 403);
        }
        if (strlen($password) < 10) {
            fail('Use at least 10 characters.');
        }
        write_data('auth.json', ['hash' => password_hash($password, PASSWORD_DEFAULT), 'created' => time()]);
        @unlink(data_file('setup-code.txt'));
        sign_in();
        json_out(['ok' => true, 'csrf' => $_SESSION['csrf']]);

    case 'login':
        if ($setupNeeded) {
            fail('Create a password first.', 409);
        }
        rate_limit('login', 6, 900);
        if (!password_verify($password, (string)$auth['hash'])) {
            usleep(400000);
            fail('That password is not right.', 401);
        }
        if (password_needs_rehash((string)$auth['hash'], PASSWORD_DEFAULT)) {
            $auth['hash'] = password_hash($password, PASSWORD_DEFAULT);
            write_data('auth.json', $auth);
        }
        sign_in();
        json_out(['ok' => true, 'csrf' => $_SESSION['csrf']]);

    case 'logout':
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
        }
        session_destroy();
        json_out(['ok' => true]);

    case 'password':
        require_login();
        require_csrf();
        rate_limit('password', 6, 900);
        if (!password_verify((string)($body['current'] ?? ''), (string)$auth['hash'])) {
            fail('Your current password is not right.', 403);
        }
        if (strlen($password) < 10) {
            fail('Use at least 10 characters.');
        }
        $auth['hash'] = password_hash($password, PASSWORD_DEFAULT);
        $auth['changed'] = time();
        write_data('auth.json', $auth);
        json_out(['ok' => true]);

    default:
        fail('Unknown action.');
}
