<?php
/**
 * GET  (signed in) -> saved enquiries, newest first.
 * POST (signed in) {action: "delete", id}
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

require_login();

if (!is_post()) {
    json_out(['ok' => true, 'items' => read_data('enquiries.json', [])]);
}

require_csrf();
$body = read_json_body(2000);
if (($body['action'] ?? '') !== 'delete') {
    fail('Unknown action.');
}
$id = (string)($body['id'] ?? '');
$all = read_data('enquiries.json', []);
$left = array_values(array_filter($all, function ($q) use ($id) { return ($q['id'] ?? '') !== $id; }));
if (count($left) === count($all)) {
    fail('That enquiry was already deleted.', 404);
}
write_data('enquiries.json', $left);
json_out(['ok' => true]);
