<?php
$reservations = json_decode(file_get_contents('reservations'), true);

$twoDaysLater = date("Ymd", time() + 2 * 24 * 60 * 60);
$fourDaysLater = date("Ymd", time() + 4 * 24 * 60 * 60);

$push = array();
if (isset($reservations[$twoDaysLater])) {
	$push[$twoDaysLater] = $reservations[$twoDaysLater];
}

if (isset($reservations[$fourDaysLater])) {
	$push[$fourDaysLater] = $reservations[$fourDaysLater];
}

echo json_encode($push);
?>