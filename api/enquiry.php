<?php
/**
 * POST (public) -> booking form submissions from the website.
 * Saves each enquiry for the editor's Enquiries tab and emails it to the address in Brand & contact.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if (!is_post()) {
    fail('Use POST to send an enquiry.', 405);
}

$in = read_json_body(20000);

// Hidden "company" field: people never fill it, spam bots do.
if (trim((string)($in['company'] ?? '')) !== '') {
    json_out(['ok' => true]);
}
rate_limit('enquiry', 5, 600);

$q = [
    'name' => clean_text($in['name'] ?? '', 120),
    'email' => clean_text($in['email'] ?? '', 160),
    'phone' => clean_text($in['phone'] ?? '', 40),
    'service' => clean_text($in['service'] ?? '', 80),
    'budget' => clean_text($in['budget'] ?? '', 60),
    'location' => clean_text($in['location'] ?? '', 80),
    'date' => clean_text($in['date'] ?? '', 20),
    'message' => clean_text($in['message'] ?? '', 4000),
];
if ($q['name'] === '') {
    fail('Add your name so we know who to reply to.');
}
if (!filter_var($q['email'], FILTER_VALIDATE_EMAIL)) {
    fail('Enter a valid email address.');
}
if ($q['date'] !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $q['date'])) {
    $q['date'] = '';
}
$q['id'] = bin2hex(random_bytes(8));
$q['received'] = time();

ensure_data_dir();
$all = read_data('enquiries.json', []);
array_unshift($all, $q);
write_data('enquiries.json', array_slice($all, 0, 1000));

/* Email notification (uses the hosting's mail function; set up an email account on your hosting). */
$site = json_decode((string)@file_get_contents(CONTENT_JSON), true)['site'] ?? [];
$to = (string)($site['email'] ?? '');
if (filter_var($to, FILTER_VALIDATE_EMAIL) && function_exists('mail')) {
    $host = preg_replace('/[^a-z0-9.-]/i', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost'));
    $host = preg_replace('/^www\./i', '', $host) ?: 'localhost';
    $subject = 'New enquiry: ' . ($q['service'] ?: 'website') . ' from ' . $q['name'];
    $lines = [];
    foreach (['name' => 'Name', 'phone' => 'Phone', 'email' => 'Email', 'service' => 'Service', 'date' => 'Date', 'location' => 'Location', 'budget' => 'Budget'] as $k => $label) {
        if ($q[$k] !== '') {
            $lines[] = $label . ': ' . $q[$k];
        }
    }
    $lines[] = '';
    $lines[] = $q['message'];
    $lines[] = '';
    $lines[] = 'Sent from the booking form on ' . $host . '. Also saved in the site editor under Enquiries.';
    $headers = implode("\r\n", [
        'From: Website <no-reply@' . $host . '>',
        'Reply-To: ' . str_replace(["\r", "\n"], '', $q['email']),
        'Content-Type: text/plain; charset=UTF-8',
    ]);
    @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', implode("\n", $lines), $headers);
}

json_out(['ok' => true]);
