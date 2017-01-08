<?php
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);

$postdata = file_get_contents('php://input');
$checkInfo = json_decode($postdata);

if (isset($checkInfo->date) && strval(intval($checkInfo->date))) {
	$date = $checkInfo->date;
} else {
	die();
}

$reservations = file_exists('reservations.json') ? json_decode(file_get_contents('reservations.json')) : [];
header('Content-type: application/json');
echo json_encode(array(
	'date' => $date,
	'countReservations' => isset($reservations->$date) ? count($reservations->$date) : 0,
	'limit' => 5,
));
