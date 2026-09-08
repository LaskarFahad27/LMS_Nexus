<?php
/**
 * EPS bridge for CraftX → LMS Nexus
 *
 * Upload to CraftX public_html as:  /eps-bridge.php
 * EPS dashboard IPN URL:            https://craftx.corecraftsolutions.com/eps-bridge.php?action=ipn
 */

$NEXUS_BACKEND = 'https://nexus-back.corecraftsolutions.com';

$action = strtolower((string) ($_GET['action'] ?? $_POST['action'] ?? ''));
$query = $_GET;
unset($query['action']);

// Browser return after paying: send the user to Nexus. Do not stay on CraftX.
if ($action !== 'ipn') {
  $target = rtrim($NEXUS_BACKEND, '/') . '/api/payment/eps/callback';
  if ($query) {
    $target .= '?' . http_build_query($query);
  }
  header('Location: ' . $target, true, 302);
  exit;
}

// Server-to-server IPN: forward the body to Nexus and return EPS the 200 JSON.
$target = rtrim($NEXUS_BACKEND, '/') . '/api/payment/eps/ipn';
$body = file_get_contents('php://input');
$headers = ['Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'application/json')];

$ch = curl_init($target);
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => $headers,
  CURLOPT_POSTFIELDS => $body === false ? '' : $body,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 60,
  CURLOPT_SSL_VERIFYPEER => true,
]);
$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE) ?: 502;
$error = curl_error($ch);
curl_close($ch);

http_response_code($status ?: 502);
header('Content-Type: application/json');
if ($response === false) {
  echo json_encode(['status' => 'ERROR', 'message' => 'Bridge failed', 'error' => $error]);
  exit;
}
echo $response;
