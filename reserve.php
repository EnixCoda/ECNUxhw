<?php
// extract request form
$postdata = file_get_contents('php://input');
$request = json_decode($postdata);

$stuID     = $request->stuID;
$stuPsw    = $request->stuPsw;
$room      = $request->room;
$date      = $request->date;
$beginTime = $request->beginTime;
$endTime   = $request->endTime;
$followers = isset($request->followers) ? $request->followers : [];
$roomType  = $request->roomType;
$response  = '';

// validate request
if (!preg_match('/^\d{11}$/', $stuID)
  || strval(intval($date)) !== $date
  || ($beginTime < 800 || $beginTime > 2130)
  || ($endTime < 830 || $endTime > 2200)
  || $endTime - $beginTime < 30) {
	die('INFO ERROR');
}

if ($roomType === 'medium') {
	foreach ($followers as $follower) {
		if (!preg_match('/^\d{11}$/', $follower)) {
			die('INFO ERROR');
		}
	}
}

// validate user account
$loginUrl = 'http://202.120.82.2:8081/ClientWeb/pro/ajax/login.aspx';
$data = array(
	'id' => $request->stuID,
	'pwd' => $request->stuPsw,
	'act' => 'login'
);
// use key 'http' even if you send the request to https://...
$options = array(
	'http' => array(
		'header'  => 'Content-type: application/x-www-form-urlencoded\r\n',
		'method'  => 'POST',
		'content' => http_build_query($data),
	),
);
$context  = stream_context_create($options);
$result = file_get_contents($loginUrl, false, $context);
if ($result === FALSE) {
	die('CONNECTION ERROR');
} else {
	$data = json_decode($result, true);
	if ($data['ret'] === 0) {
		die('LOGIN FAIL');
	} else {
		$credit = $data['data']['credit'][0];
		if ($credit[1] === '0') {
			die('NO CREDIT');
		}
	}
}

// save reservation
$allReservations = file_exists('reservations.json') ? json_decode(file_get_contents('reservations.json'), true) : [];
if (!isset($allReservations[$date]) || !is_array($allReservations[$date])) {
	$allReservations[$date] = [];
}
$reservationsOnDate = $allReservations[$date];
if (count($reservationsOnDate) >= 5) {
	die('FULL');
}

$timeZones = [
// 'C413': [[0800, 0900], [0900, 2200]]
];

foreach ($reservationsOnDate as $_ => $reservation) {
	if ($reservation['room'] === $room) {
		array_push($timeZones, [intval($reservation['beginTime']), intval($reservation['endTime'])]);
	}
}
foreach ($timeZones as $timeZone) {
	$begin_time = $timeZone[0];
	$end_time = $timeZone[1];
	if (!($endTime <= $begin_time || $end_time <= $beginTime)) {
		die('CONFLICT');
	}
}

array_push($allReservations[$date], array(
	'stuID'     => $request->stuID,
	'stuPsw'    => $request->stuPsw,
	'room'      => $request->room,
	'date'      => $request->date,
	'beginTime' => $request->beginTime,
	'endTime'   => $request->endTime,
	'followers' => isset($request->followers) ? $request->followers : NULL,
	'roomType'  => $request->roomType
));
file_put_contents('reservations.json', json_encode($allReservations));
die('SUCCESS');
