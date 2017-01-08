<?php
$reservations = json_decode(file_get_contents('reservations.json'), true);

$twoDaysLater = date('Ymd', time() + 2 * 24 * 60 * 60);
$fourDaysLater = date('Ymd', time() + 4 * 24 * 60 * 60);

$push = [];
if (isset($reservations[$twoDaysLater])) {
	$push[$twoDaysLater] = $reservations[$twoDaysLater];
}

if (isset($reservations[$fourDaysLater])) {
	$push[$fourDaysLater] = $reservations[$fourDaysLater];
}

header('Content-type: application/json');
echo json_encode($push, JSON_PRETTY_PRINT);
?>