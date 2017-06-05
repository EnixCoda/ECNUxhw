angular
  .module('ECNUxhw', ['ngMaterial'])
  .config(function ($mdThemingProvider) {
    $mdThemingProvider.theme('default')
      .primaryPalette('blue')
      .accentPalette('orange')
    $mdThemingProvider.theme('success-toast')
    $mdThemingProvider.theme('warning-toast')
    $mdThemingProvider.theme('error-toast')
  })

angular.module('ECNUxhw').controller('ECNUxhwCtrl', function($scope, $http, $mdToast, $window) {
  var reservation = {
    beginTime: { hour: undefined, minute: undefined },
    endTime: { hour: undefined, minute: undefined }
  }

  var roomTypes = [
    { zh: '木门', en: 'wood' },
    { zh: '玻璃门', en: 'glass' },
    { zh: '中型讨论室', en: 'medium' }
  ]

  // generate hours string form '08' to '22'
  var hours = (function() {
    arr = []
    for (var i = 8; i < 23; i++) {
      arr.push(('0' + i).substr(-2))
    }
    return arr
  })()

  // generate minutes string form '00' to '55', step by 5
  var minutes = (function () {
    arr = []
    for (var i = 0; i < 60; i += 5) {
      arr.push(('0' + i).substr(-2))
    }
    return arr
  })()

  var rooms = {
    'wood':   ['C421', 'C422', 'C423', 'C424', 'C425', 'C426', 'C427', 'C428', 'C429'],
    'glass':  ['C411', 'C412', 'C413', 'C414', 'C415'],
    'medium': ['B411', 'B412']
  }

  var theDayAfterTomorrow = (function () {
    var now = new Date()
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 2
    )
  })()

  var nextMonthsToday = (function () {
    var now = new Date()
    return new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    )
  })()

  var loadNotice = function () {
    $http.get('./message.json')
      .then(function(response) {
        $scope.dynamicMsg = response.data.message
      }, function(err) {
        console.log(err)
      })
  }

  var showToast = function(type, textContent) {
    $mdToast.show(
      $mdToast.simple()
        .textContent(textContent)
        .position('top right')
        .hideDelay(3000)
        .theme(type + '-toast')
        .parent($window.document.querySelector('#main-panel'))
    )
  }

  loadNotice()

  Object.assign($scope, {
    reservation,
    roomTypes,
    hours,
    minutes,
    rooms,
    theDayAfterTomorrow,
    nextMonthsToday,
  })

  $scope.handleForm = function() {
    var result = validateForm()
    if (result === 'success') submitForm()
    else showToast('error', result)
  }

  var validateForm = function() {
    if (! $scope.selectedRoomType) return '未选择房间类型'
    if (! reservation.room) return '未选择房间'
    if (! (rooms[$scope.selectedRoomType].indexOf(reservation.room) > -1)) return '未选择房间'
    if (! reservation.date) return '未选择日期'
    if (! reservation.beginTime.hour || ! reservation.beginTime.minute) return '起始时间错误'
    if (! reservation.endTime.hour || ! reservation.endTime.minute) return '结束时间错误'
    if (! ((reservation.endTime.hour - reservation.beginTime.hour) * 60 + reservation.endTime.minute - reservation.beginTime.minute >= 30)) return '预约时间过短'
    if (! reservation.stuID) return '未输入学号'
    if (! reservation.stuID.trim().match(/^\d{11}$/)) return '学号不正确'
    if (! reservation.stuPsw) return '未输入密码'
    if ($scope.selectedRoomType == 'medium') {
      if (!reservation.stuID1 || !reservation.stuID2 || !reservation.stuID3 || !reservation.stuID4) {
        return '存在未输入的其他学号'
      } else if (!reservation.stuID1.trim().match(/^\d{11}$/)
        || !reservation.stuID2.trim().match(/^\d{11}$/)
        || !reservation.stuID3.trim().match(/^\d{11}$/)
        || !reservation.stuID4.trim().match(/^\d{11}$/)) {
        return '存在错误的学号'
      }
    }
    return 'success'
  }

  var submitForm = function () {
    var reserveRequest = {
      room:      reservation.room,
      roomType:  $scope.selectedRoomType,
      stuID:     reservation.stuID.trim(),
      stuPsw:    reservation.stuPsw.trim(),
      date:      reservation.date.getFullYear() + ('0' + (reservation.date.getMonth() + 1)).substr(-2) + ('0' + reservation.date.getDate()).substr(-2),
      beginTime: reservation.beginTime.hour + reservation.beginTime.minute,
      endTime:   reservation.endTime.hour + reservation.endTime.minute,
      followers: [reservation.stuID, reservation.stuID1, reservation.stuID2, reservation.stuID3, reservation.stuID4]
    }
    showToast('warning', '正在登记')
    $scope.requesting = true
    $http.post('reserve.php', reserveRequest)
      .then(function (response) {
        var textContent = ''
        var status = response.data
        var type = 'success'
        switch (status) {
          case 'SUCCESS':
            type = 'success'
            textContent = '登记成功'
            break
          // not implemented yet
          case 'EDIT_SUCCESS':
            type = 'success'
            textContent = '修改成功'
            break
          case 'LOGIN FAIL':
            type = 'error'
            textContent = '登录失败，请检查学号、密码'
            break
          case 'CONFLICT':
            type = 'error'
            textContent = '时间段冲突'
            break
          case 'FULL':
            type = 'error'
            textContent = '当日登记已满'
            break
          case 'NO CREDIT':
            type = 'error'
            textContent = '违约次数过多，信用度不足'
            break
          case 'INFO ERROR':
            type = 'error'
            textContent = '未知错误'
          default:
            throw ''
        }
        showToast(type, textContent)
      }, function() {
        showToast('error', '无法连接到服务器')
      }).then(function() {
        $scope.requesting = false
      })
  }

  $scope.checkReservations = function () {
    $scope.reservesOnDate = '-'
    $scope.reserveLimit = '-'
    $http.post('reservesOnDate.php', {
      'date': '' + $scope.reservation.date.getFullYear() + ('0' + ($scope.reservation.date.getMonth() + 1)).substr(-2) + ('0' + $scope.reservation.date.getDate()).substr(-2)
    }).then(function(response) {
      $scope.reservesOnDate = response.data.countReservations
      $scope.reserveLimit = response.data.limit
    })
  }
})
