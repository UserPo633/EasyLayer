<?php
// Same-origin local proxy. Credentials remain in planner service.
header('Content-Type: application/json');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_SERVER['HTTP_X_EASYLAYER'] ?? '') !== '1') {http_response_code(403);echo '{"error":"Unsupported request"}';exit;}
$body=file_get_contents('php://input', false, null, 0, 40001);
if(strlen($body)>40000){http_response_code(413);echo '{"error":"Request too large"}';exit;}
$c=curl_init('http://planner:8091/interpret');
curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>28]);
$result=curl_exec($c);$code=curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);
if($result===false||!$code){http_response_code(503);echo '{"error":"Bedrock unavailable"}';exit;}
http_response_code($code);echo $result;
