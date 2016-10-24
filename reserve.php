<?php
$postdata = file_get_contents("php://input");
$request = json_decode($postdata);

$stuID     = $request->stuID;
$stuPsw    = $request->stuPsw;
$room      = $request->room;
$date      = $request->date;
$beginTime = $request->beginTime;
$endTime   = $request->endTime;
$followers = $request->followers;
$roomType  = $request->roomType;
$response  = "";

if (!preg_match('/^\d{11}$/', $stuID)) {
	$response = "INFO_ERROR";
	echo json_encode($response);
	die();
}
if ($roomType == 'medium') {
	foreach ($followers as $follower) {
		if (!preg_match('/^\d{11}$/', $follower)) {
			$response = "INFO_ERROR";
			echo json_encode($response);
			die();
		}
	}
}
if (strval(intval($date)) != $date) {
	$response = "INFO_ERROR";
	echo json_encode($response);
	die();
}
if ($beginTime < 800 || $beginTime > 2130) {
	$response = "INFO_ERROR";
	echo json_encode($response);
	die();
}
if ($endTime < 830 || $endTime > 2200) {
	$response = "INFO_ERROR";
	echo json_encode($response);
	die();
}
if ($endTime - $beginTime < 30) {
	$response = "INFO_ERROR";
	echo json_encode($response);
	die();
}

$loginUrl = 'http://202.120.82.2:8081/ClientWeb/pro/ajax/login.aspx';
$data = array(
	'id' => $request->stuID,
	'pwd' => $request->stuPsw,
	'act' => 'login'
	);

// use key 'http' even if you send the request to https://...
$options = array(
    'http' => array(
        'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
        'method'  => 'POST',
        'content' => http_build_query($data),
    ),
);
$context  = stream_context_create($options);

$result = file_get_contents($loginUrl, false, $context);
if ($result === FALSE) { die("CONNECTION ERROR"); }
else {
	$data = json_decode($result, true);
	if ($data["ret"] == 0) {
		die("LOGIN FAIL");
	}
}

$allReservations = json_decode(file_get_contents('reservations'), true);
if (!isset($allReservations[$date])) {
	$allReservations[$date] = [];
}
$reservations = $allReservations[$date];
if (count($reservations) == 5) {
	$response = "FULL";
} else {
	$timeZones = [
	// "C413": [[0800, 0900], [0900, 2200]]
	];
	$conflict = false;
	foreach ($reservations as $_ => $reservation) {
		if ($reservation["room"] == $room) {
			array_push($timeZones, [intval($reservation["beginTime"]), intval($reservation["endTime"])]);
		}
	}
	foreach ($timeZones as $timeZone) {
		$begin_time = $timeZone[0];
		$end_time = $timeZone[1];
		if ($endTime <= $begin_time || $end_time <= $beginTime) {
			# code...
		} else {
			$conflict = true;
		}
	}
	if (!$conflict) {
		array_push($allReservations[$date], array(
			"stuID"     => $request->stuID,
			"stuPsw"    => $request->stuPsw,
			"room"      => $request->room,
			"date"      => $request->date,
			"beginTime" => $request->beginTime,
			"endTime"   => $request->endTime,
			"followers" => $request->followers,
			"roomType"  => $request->roomType
		));
		$response = "SUCCESS";
	} else {
		$response = "CONFLICT";
	}
}
echo $response;
file_put_contents('reservations', json_encode($allReservations));
?>