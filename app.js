angular
  .module('ECNUxhw', ['ngMaterial'])
  .config(function ($mdThemingProvider) {
    $mdThemingProvider.theme('default')
      .primaryPalette('blue')
      .accentPalette('orange');
    $mdThemingProvider.theme('success-toast');
    $mdThemingProvider.theme('warning-toast');
    $mdThemingProvider.theme('error-toast');
  });

angular.module('ECNUxhw').controller('ECNUxhwCtrl', function($scope, $http, $mdToast, $window) {
  var reservation = {
    beginTime: { hour: undefined, minute: undefined },
    endTime: { hour: undefined, minute: undefined }
  };

  const loadMessage = function () {
    $http.get('./message.json')
      .then(response => {
        $scope.dynamicMsg = response.data.message
      }, err => {
        console.log(err)
      }).catch(excp => {
        console.log(excp)
      })
  }

  loadMessage()

  $scope.reservation = reservation;

  $scope.roomTypes = [
    { zh: '木门', en: 'wood' },
    { zh: '玻璃门', en: 'glass' },
    { zh: '中型讨论室', en: 'medium' }
  ];

  // generate hours string form '08' to '22'
  $scope.hours = (function() {
    arr = [];
    for (var i = 8; i < 23; i++) { arr.push(('0' + i).substr(-2)); }
    return arr;
  })();

  // generate minutes string form '00' to '55', step by 5
  $scope.minutes = (function () {
    arr = [];
    for (var i = 0; i < 60; i += 5) { arr.push(('0' + i).substr(-2)); }
    return arr;
  })();

  $scope.rooms = {
    'wood':   ['C421', 'C422', 'C423', 'C424', 'C425', 'C426', 'C427', 'C428', 'C429'],
    'glass':  ['C411', 'C412', 'C413', 'C414', 'C415'],
    'medium': ['B411', 'B412']
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

  var showToast = function(type, textContent) {
    $mdToast.show(
      $mdToast.simple()
        .textContent(textContent)
        .position('top right')
        .hideDelay(3000)
        .theme(type + '-toast')
        .parent($window.document.querySelector('#main-panel'))
    );
  }

  $scope.validateForm = function() {
    try {
      if (! $scope.selectedRoomType) throw 'roomType';
      if (! reservation.room) throw 'room';
      if (! ($scope.rooms[$scope.selectedRoomType].indexOf(reservation.room) > -1)) throw 'room';
      if (! reservation.date) throw 'date';
      if (! reservation.beginTime.hour || ! reservation.beginTime.minute) throw 'beginTime';
      if (! reservation.endTime.hour || ! reservation.endTime.minute) throw 'endTime';
      if (! ((reservation.endTime.hour - reservation.beginTime.hour) * 60 + reservation.endTime.minute - reservation.beginTime.minute >= 30)) throw 'short';
      if (!reservation.stuID) throw 'stuID';
      if (!reservation.stuID.trim().match(/^\d{11}$/)) throw 'stuIdformatMismatch';
      if (!reservation.stuPsw) throw 'stuPsw';
      if ($scope.selectedRoomType == 'medium') {
        if (!reservation.stuID1 || !reservation.stuID2 || !reservation.stuID3 || !reservation.stuID4) {
          throw 'needMoreFollowers';
        } else if (!reservation.stuID1.trim().match(/^\d{11}$/) || !reservation.stuID2.trim().match(/^\d{11}$/) || !reservation.stuID3.trim().match(/^\d{11}$/) || !reservation.stuID4.trim().match(/^\d{11}$/)) {
          throw 'incompleteFollowers';
        }
      }
      submitForm();
    } catch (err) {
      type = 'error';
      switch (err) {
        case 'roomType':
          textContent = '未选择房间类型';
          break;
        case 'stuID':
          textContent = '未输入学号';
          break;
        case 'stuPsw':
          textContent = '未输入密码';
          break;
        case 'room':
          textContent = '未选择房间';
          break;
        case 'date':
          textContent = '未选择日期';
          break;
        case 'beginTime':
          textContent = '起始时间错误';
          break;
        case 'endTime':
          textContent = '结束时间错误';
          break;
        case 'short':
          textContent = '预约时间过短';
          break;
        case 'needMoreFollowers':
          textContent = '存在未输入的其他学号';
          break;
        case 'incompleteFollowers':
          textContent = '学号不正确';
          break;
        case 'stuIdformatMismatch':
          textContent = '学号不正确';
          break;
        default:
          textContent = '未知错误';
          break;
      }
      showToast(type, textContent);
    }
  }

  var submitForm = function () {
    var reserveRequest = {
      room:      reservation.room,
      roomType:  $scope.selectedRoomType,
      stuID:     reservation.stuID.trim(),
      stuPsw:    reservation.stuPsw.trim(),
      date:      reservation.date.getFullYear() + ('0' + (reservation.date.getMonth() + 1)).substr(-2) + ('0' + reservation.date.getDate()).substr(-2),
      beginTime: reservation.beginTime.hour + reservation.beginTime.minute,
      endTime:   reservation.endTime.hour + reservation.endTime.minute
    }
    if ($scope.selectedRoomType == 'medium') {
      reserveRequest.followers = [reservation.stuID.trim(), reservation.stuID1, reservation.stuID2, reservation.stuID3, reservation.stuID4];
    }
    $scope.requesting = true;
    showToast('warning', '正在登记');
    $http.post('reserve.php', reserveRequest)
      .then(function (response) {
        $scope.requesting = false;
        var textContent = '';
        var status = response.data;
        var type = 'success';
        switch (status) {
          case 'SUCCESS':
            type = 'success';
            textContent = '登记成功';
            break;
          case 'EDIT_SUCCESS':
            type = 'success';
            textContent = '修改成功';
            break;
          case 'LOGIN FAIL':
            type = 'error';
            textContent = '登录失败，请检查学号、密码';
            break;
          case 'CONFLICT':
            type = 'error';
            textContent = '时间段冲突';
            break;
          case 'FULL':
            type = 'error';
            textContent = '当日登记已满';
            break;
          case 'NO CREDIT':
            type = 'error';
            textContent = '违约次数过多，信用度不足'
            break
          case 'INFO_ERROR':
            throw '';
          default:
            throw '';
        }
        showToast(type, textContent)
      }, function() {
        $scope.requesting = false;
        showToast('error', '无法连接到服务器')
      });
  }

  $scope.checkReservations = function () {
    $scope.reservesOnDate = '-';
    $scope.reserveLimit = '-';
    $http.post('reservesOnDate.php', {
      'date': '' + $scope.reservation.date.getFullYear() + ('0' + ($scope.reservation.date.getMonth() + 1)).substr(-2) + ('0' + $scope.reservation.date.getDate()).substr(-2)
    }).then(function(response) {
      $scope.reservesOnDate = response.data.countReservations;
      $scope.reserveLimit = response.data.limit;
    })
  };
});
