<?php
/**
 * Drop this folder onto the CraftX site document root (public_html).
 * EPS only accepts callback URLs on craftx.corecraftsolutions.com.
 * This forwards those hits to the LMS backend on nexus-back.
 */
$NEXUS_BACKEND = 'https://nexus-back.corecraftsolutions.com';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$query = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_QUERY);
$target = rtrim($NEXUS_BACKEND, '/') . $path;
if ($query) {
  $target .= '?' . $query;
}

$headers = [];
foreach (getallheaders() ?: [] as $name => $value) {
  $lower = strtolower($name);
  if (in_array($lower, ['host', 'content-length', 'connection'], true)) {
    continue;
  }
  $headers[] = $name . ': ' . $value;
}
$headers[] = 'X-Forwarded-Host: ' . ($_SERVER['HTTP_HOST'] ?? 'craftx.corecraftsolutions.com');
$headers[] = 'X-Forwarded-Proto: https';
$headers[] = 'X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? '');

$ch = curl_init($target);
curl_setopt_array($ch, [
  CURLOPT_CUSTOMREQUEST => $_SERVER['REQUEST_METHOD'] ?? 'GET',
  CURLOPT_HTTPHEADER => $headers,
  CURLOPT_POSTFIELDS => file_get_contents('php://input'),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HEADER => true,
  CURLOPT_FOLLOWLOCATION => false,
  CURLOPT_TIMEOUT => 60,
]);

$response = curl_exec($ch);
if ($response === false) {
  http_response_code(502);
  header('Content-Type: application/json');
  echo json_encode(['message' => 'EPS bridge failed', 'error' => curl_error($ch)]);
  exit;
}

$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$rawHeaders = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);

http_response_code($status);
foreach (explode("\r\n", $rawHeaders) as $line) {
  if ($line === '' || stripos($line, 'HTTP/') === 0) {
    continue;
  }
  if (stripos($line, 'Transfer-Encoding:') === 0) {
    continue;
  }
  header($line, false);
}
echo $body;
