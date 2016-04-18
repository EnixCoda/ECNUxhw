angular
  .module('App', ['ngMaterial'])
  .config(function ($mdThemingProvider) {
    $mdThemingProvider.theme('default')
      .primaryPalette('blue')
      .accentPalette('orange');
  })
  .config(function ($mdThemingProvider) {
    $mdThemingProvider.theme('error-toast');
  })
  .config(function ($mdThemingProvider) {
    $mdThemingProvider.theme('success-toast');
  })
  .config(function ($mdThemingProvider) {
    $mdThemingProvider.theme('warning-toast');
  });
angular.module('App').controller('AppCtrl', function($scope, $http, $mdToast) {
  $scope.reservation = {
    beginTime: {
      hour: undefined,
      minute: undefined
    },
    endTime: {
      hour: undefined,
      minute: undefined
    }
  };
  $scope.hours = (function() {
    arr = [];
    for (var i = 8; i < 23; i++) {
      arr.push(('0' + i).substr(-2))
    }
    return arr;
    })();
  $scope.minutes = (function () {
    arr = [];
    for (var i = 0; i < 60; i += 5) {
      arr.push(('0' + i).substr(-2))
    }
    return arr;
    })();
  $scope.roomTypes = [
    {
      c: "木门",
      e: "wood",
    }, 
    {
      c: "玻璃门",
      e: "glass",
    }, 
    {
      c: "中型讨论室",
      e: "medium",
    }
  ];
  $scope.rooms = {
    "wood":   ["C421", "C422", "C423", "C424", "C425", "C426", "C427", "C428", "C429"],
    "glass":  ["C411", "C412", "C413", "C414", "C415"],
    "medium": ["B411", "B412"]
  };
  $scope.theDayAfterTomorrow = (function () {
    var today = new Date();
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 2
    );
  })();
  $scope.nextMonthsToday = (function () {
    var today = new Date();
    return new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate()
    );
  })();
  function showToast(type, textC) {
    $mdToast.show(
      $mdToast.simple()
        .textContent(textC)
        .position('bottom right')
        .hideDelay(3000)
        .theme(type + "-toast")
        .parent(angular.element(document.getElementById('mainPanel')))
    );
  }
  $scope.submit = function() {
    var reservation = $scope.reservation;
    try {
      if (!$scope.selectedRoomType) {
        throw "roomType";
      }
      if (!reservation.room) {
        throw "room";
      }
      var roomTypeMatch = false;
      for (var i = 0; i < $scope.rooms[$scope.selectedRoomType].length; i++) {
        if (reservation.room == $scope.rooms[$scope.selectedRoomType][i]) {
          roomTypeMatch = true;
        }
      }
      if (!roomTypeMatch) {
        throw "room";
      }
      if (!reservation.date) {
        throw "date";
      }
      if (!reservation.beginTime.hour || !reservation.beginTime.minute) {
        throw "beginTime";
      }
      if (!reservation.endTime.hour || !reservation.endTime.minute) {
        throw "endTime";
      }
      if (parseInt(reservation.endTime.hour) * 100 + parseInt(reservation.endTime.minute) - parseInt(reservation.beginTime.hour) * 100 - parseInt(reservation.beginTime.minute) < 30) {
        throw "short";
      }
      if (!reservation.stuID) {
        throw "stuID";
      }
      if (!reservation.stuID.trim().match(/^\d{11}$/)) {
        throw "incompleteStuID";
      }
      if (!reservation.stuPsw){
        throw "stuPsw";
      }
      var reserveRequest = {
        room:      reservation.room,
        roomType:  $scope.selectedRoomType,
        stuID:     reservation.stuID.trim(),
        stuPsw:    reservation.stuPsw.trim(),
        date:      '' + reservation.date.getFullYear() + ('0' + (reservation.date.getMonth() + 1)).substr(-2) + ('0' + reservation.date.getDate()).substr(-2),
        beginTime: reservation.beginTime.hour + reservation.beginTime.minute,
        endTime:   reservation.endTime.hour + reservation.endTime.minute,
        followers: []
      }
      if ($scope.selectedRoomType == 'medium') {
        if (!reservation.stuID1 || !reservation.stuID2 || !reservation.stuID3 || !reservation.stuID4) {
          throw "emptyFollowers";
        } else if (!reservation.stuID1.trim().match(/^\d{11}$/) || !reservation.stuID2.trim().match(/^\d{11}$/) || !reservation.stuID3.trim().match(/^\d{11}$/) || !reservation.stuID4.trim().match(/^\d{11}$/)) {
          throw "incompleteFollowers";
        } else {
          reserveRequest.followers = [reservation.stuID.trim(), reservation.stuID1, reservation.stuID2, reservation.stuID3, reservation.stuID4];
        }
      }
      showToast('warning', '正在登记');
      $http.post('reserve.php', reserveRequest)
        .then(function (response) {
          var textContent = '';
          var status = response.data;
          var type = 'success';
          switch (status) {
            case "SUCCESS":
              type = "success";
              textContent = "登记成功";
              break;
            case "EDIT_SUCCESS":
              type = "success";
              textContent = "修改成功";
              break;
            case "LOGIN FAIL":
              type = "error";
              textContent = "登录失败，请检查学号、密码";
              break;
            case "CONFLICT":
              type = "error";
              textContent = "时间段冲突";
              break;
            case "FULL":
              type = "error";
              textContent = "当日登记已满";
              break;
            case "INFO_ERROR":
              throw "";
            default:
              throw "";
              break;
          }
          showToast(type, textContent)
        });
    } catch (err) {
      type = "error";
      switch (err) {
        case "roomType":
          textContent = "未选择房间类型";
          break;
        case "stuID":
          textContent = "未输入学号";
          break;
        case "stuPsw":
          textContent = "未输入密码";
          break;
        case "room":
          textContent = "未选择房间";
          break;
        case "date":
          textContent = "未选择日期";
          break;
        case "beginTime":
          textContent = "起始时间错误";
          break;
        case "endTime":
          textContent = "结束时间错误";
          break;
        case "short":
          textContent = "时间错误";
          break;
        case "emptyFollowers":
          textContent = "存在未输入的其他学号";
          break;
        case "incompleteFollowers":
          textContent = "学号不正确";
          break;
        case "incompleteStuID":
          textContent = "学号不正确";
          break;
        default:
          textContent = "未知错误";
          break;
      }
      showToast(type, textContent)
    }
  }
  $scope.checkReservations = function () {
    $scope.reservesOnDate = "-";
    $scope.reserveLimit = "-";
    $http.post('reservesOnDate.php', {
      "date": '' + $scope.reservation.date.getFullYear() + ('0' + ($scope.reservation.date.getMonth() + 1)).substr(-2) + ('0' + $scope.reservation.date.getDate()).substr(-2)
    }).then(function(response) {
      $scope.reservesOnDate = response.data.countReservations;
      $scope.reserveLimit = response.data.limit;
    })
  };
});
