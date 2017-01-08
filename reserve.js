const moment = require('moment')
const request = require('request')
const fs = require('fs')

/**
 * run promiseFunc until it resolves
 * if set stopFunc, it would also stop when stopFunc returns true
 * 
 * @param {function} promiseFunc return a Promise
 * @param {function} stopFunc return a Boolean
 * @param {number} minimumEscape milliseconds after last run
 */
const promiseLoopWhile = function(promiseFunc, stopFunc = () => false, minimumEscape = 0) {
  return new Promise((resolve, reject) => {
    if (stopFunc()) resolve()
    else {
      const start = Date.now()
      promiseFunc().then(() => {
        resolve()
      }, () => {
        const end = Date.now()
        const duration = end - start
        const timeToWait = Math.max(minimumEscape - duration, 0)
        setTimeout(() => {
          promiseLoopWhile.apply(null, arguments).then(() => resolve())
        }, timeToWait)
      }).catch(err => promiseLoopWhile.apply(null, arguments))
    }
  })
}

const print = function() {
  console.log(Array.prototype.join.call(arguments, ', '))
}

let count = 0
const isAfterLimitTime = () => {
  if (count++ > 5) return true
  let [currentHour, currentMinute] = [moment().hour(), moment().minute()]
  if (currentHour === 0 && currentMinute > 5) {
    print('本次预约已超时', moment().format())
    return true
  } else {
    return false
  }
}

const extend = (base, patch) => {
  let combination = {}
  for(let i in base) combination[i] = base[i]
  for(let i in patch) combination[i] = patch[i]
  return combination
}

const loadRawReservations = () => {
  let reservationFileName
  if (process.argv.length > 2) reservationFileName = process.argv[2]
  else reservationFileName = 'reservations.json'

  const DAYS_AHEAD_FOR_MEDIUM = 4
  const DAYS_AHEAD_FOR_SMALL = 2
  return new Promise((resolve, reject) => {
    fs.readFile(reservationFileName, 'utf-8', (error, data) => {
      if (error) throw error
      const rawReservations = []
      try {
        const allReservations = JSON.parse(data)
        const dateForMedium = moment().add(DAYS_AHEAD_FOR_MEDIUM, 'day').format('YYYYMMDD')
        if (allReservations[dateForMedium]) {
          rawReservations.push(...allReservations[dateForMedium].filter(reservation => reservation.roomType === 'medium'))
        }
        const dateForSmall = moment().add(DAYS_AHEAD_FOR_SMALL, 'day').format('YYYYMMDD')
        if (allReservations[dateForSmall]) {
          rawReservations.push(...allReservations[dateForSmall].filter(reservation => reservation.roomType === 'wood' || reservation.roomType === 'glass'))
        }
      } catch(error) {
        print(error.message)
      } finally {
        resolve(rawReservations)
      }
    })
  })
}

const login = (request, rawReservation) => {
  /**
   * resolve(success)
   * reject(): one more turn
   * 
   * @param {request} request instance of request
   * @param {object} rawReservation
   */
  const loginUrl = 'http://202.120.82.2:8081/ClientWeb/pro/ajax/login.aspx'
  return new Promise((resolve, reject) => {
    request.get({
      uri: loginUrl,
      form: {
        id: rawReservation.stuID,
        pwd: rawReservation.stuPsw,
        act: 'login'
      }
    }).on('data', data => {
      const parsedResponse = JSON.parse(data.toString())
      if (parsedResponse.ret === 1) {
        const credit = parsedResponse.data.credit[0]
        if (+credit[1] === 0) {
          print(`${rawReservation.stuID}积分不足`)
          resolve(false)
        } else {
          print(`${rawReservation.stuID} ${parsedResponse.data.name} 登录成功`)
          resolve()
        }
      } else {
        print(`${rawReservation.stuID}登录失败`)
        resolve(false)
      }
    }).on('error', error => {
      print(error.message)
      reject()
    })
  })
}

const cutTime = (startTime, endTime) => {
  const TIME_BLOCK_UNIT = 30
  const TIME_LIMIT = 60 * 4
  const times = []
  let reserveTimeLength = endTime - startTime - (Math.floor(endTime / 100) - Math.floor(startTime / 100)) * 40
  let curStartTime = startTime, curEndTime
  let timeBuffer
  while(reserveTimeLength >= TIME_BLOCK_UNIT) {
    timeBuffer = 0
    while(timeBuffer < TIME_LIMIT && reserveTimeLength > 0) {
      if (timeBuffer + TIME_BLOCK_UNIT === TIME_LIMIT
        && reserveTimeLength - TIME_BLOCK_UNIT < TIME_BLOCK_UNIT
        && reserveTimeLength - TIME_BLOCK_UNIT > 0)
        break
      const timeBlock = Math.min(reserveTimeLength, TIME_BLOCK_UNIT)
      timeBuffer += timeBlock
      reserveTimeLength -= timeBlock
    }
    curEndTime = curStartTime + Math.floor(timeBuffer / 60) * 100 + (timeBuffer % 60)
    if (curEndTime % 100 >= 60 || curStartTime % 100 + timeBuffer % 100 === 100) {
      curEndTime += 40
    }
    times.push([curStartTime, curEndTime])
    curStartTime = curEndTime
  }
  return times
}

/**
 * @param {string} date        like '20150101'
 * @param {number} startTime   like 246
 * @param {number} endTime     like 1357
 */
const formatTime = (date, startTime, endTime) => {
  startTime = ('0000' + startTime).substr(-4)
  endTime = ('0000' + endTime).substr(-4)
  date = [date.substr(0, 4), date.substr(4, 2), date.substr(6, 2)].join('-') // '2015-01-01'
  startTime = [startTime.substr(-4, 2), startTime.substr(-2)].join(':')   // '02:46'
  endTime = [endTime.substr(-4, 2), endTime.substr(-2)].join(':')         // '13:57'
  return {
    'start_time': startTime,
    'end_time': endTime,
    'start': date + ' ' + startTime,
    'end': date + ' ' + endTime
  }
}

const reserve = ([rawReservation, timeBlock, followerStr]) => {
  const HOMEPAGE_URL = 'http://202.120.82.2:8081/ClientWeb/xcus/ic2/Default.aspx'
  const req = request.defaults({ jar: true })

  promiseLoopWhile(() => {
    return new Promise((resolve, reject) => {
      req.get(HOMEPAGE_URL)
        .on('complete', () => {
          resolve()
        }).on('error', error => {
          print(error.message)
          reject()
        })
    })
  }, undefined, 2000)
    .then(() => {
      promiseLoopWhile(() => {
        return login(req, rawReservation)
      }, undefined, 2000)
        .then(succeeded => {
          if (!succeeded) return
          // generate submit form for set_resv
          const ROOM_ID = {
            'B411': { 'dev_id': '3676491', 'kind_id': '3675179' },
            'B412': { 'dev_id': '3676497', 'kind_id': '3675179' },
            'C421': { 'dev_id': '3676503', 'kind_id': '3675133' },
            'C422': { 'dev_id': '3676511', 'kind_id': '3675133' },
            'C423': { 'dev_id': '3676515', 'kind_id': '3675133' },
            'C424': { 'dev_id': '3676522', 'kind_id': '3675133' },
            'C425': { 'dev_id': '3676538', 'kind_id': '3675133' },
            'C426': { 'dev_id': '3676547', 'kind_id': '3675133' },
            'C427': { 'dev_id': '3676566', 'kind_id': '3675133' },
            'C428': { 'dev_id': '3676574', 'kind_id': '3675133' },
            'C429': { 'dev_id': '3676580', 'kind_id': '3675133' },
            'C411': { 'dev_id': '3676604', 'kind_id': '3674969' },
            'C412': { 'dev_id': '3676641', 'kind_id': '3674969' },
            'C413': { 'dev_id': '3676645', 'kind_id': '3674969' },
            'C414': { 'dev_id': '3676656', 'kind_id': '3674969' },
            'C415': { 'dev_id': '3676664', 'kind_id': '3674969 '}
          }
          let reserveData = {
            'act': 'set_resv',
            'lab_id': '3674920',
            'memo': '',
            'prop': '',
            'term': '',
            'test_id': '',
            'test_name': '',
            'type': 'dev',
            'up_file': '',
            '_': '' + new Date()
          }
          if (rawReservation.roomType === 'medium') {
            const mediumRoomAdditionalData = {
              'mb_list': followerStr,
              'min_user': '5',
              'max_user': '10'
            }
            reserveData = extend(reserveData, mediumRoomAdditionalData)
          }
          reserveData = extend(reserveData, timeBlock)
          reserveData = extend(reserveData, ROOM_ID[rawReservation.room])

          // ready to go
          let interval = setInterval(() => {
            if (isAfterLimitTime()) {
              interval && clearInterval(interval)
              return
            }
            const RESERVE_URL = 'http://202.120.82.2:8081/ClientWeb/pro/ajax/reserve.aspx'
            let buffer
            req.get({
              uri: RESERVE_URL,
              form: reserveData
            }).on('data', data => {
              buffer = buffer ? buffer.concat(data) : data
            }).on('complete', () => {
              const rawData = buffer.toString()
              const responseContent = JSON.parse(rawData)
              if (responseContent['ret'] === 1) {
                // success
                print(`预约${rawReservation.room}自${timeBlock.start}至${timeBlock.end} 成功!`)
                print(moment().format())
                clearInterval(interval)
              } else if (responseContent['msg'].substr(10) === '只能提前[1]天预约') {
                // do nothing, keep trying
              } else if (responseContent['msg'].substr(10) === '只能提前[3]天预约') {
                // do nothing, keep trying
              } else {
                // fail
                if (responseContent['msg'].substr(-6) === '期间禁止预约') {
                  print(`预约${rawReservation.room}自${timeBlock.start}至${timeBlock.end} 失败! 积分不足`)
                } else if (responseContent['msg'].substr(10) === '预约与现有预约冲突') {
                  print(`预约${rawReservation.room}自${timeBlock.start}至${timeBlock.end} 失败! 与其他预约冲突`)
                } else if (responseContent['msg'].substr(10) === '最少需5人同时使用') {
                  print(`预约${rawReservation.room}自${timeBlock.start}至${timeBlock.end} 失败! 存在非法学号`)
                } else if (responseContent['msg'] === '未登录或登录超时，请重新登录。') {
                  print(`${loginInfo.id} 未登录或登录超时`)
                } else {
                  print('出现了意外的响应:')
                  print(rawData)
                }
                clearInterval(interval)
                print(moment().format())
              }
            }).on('error', error => {
              print(error.message)
            })
          }, 2000)
        })
    })
}

const main = () => {
  loadRawReservations()
    .then(rawReservations => {
      if (rawReservations.length === 0) {
        print('今日无预约')
        return
      }

      const reservations = [].concat(...rawReservations.map(rawReservation => {
        const [startTime, endTime] = [+rawReservation.beginTime, +rawReservation.endTime]
        const timeBlocks = cutTime(startTime, endTime).map(([start, end]) => formatTime(rawReservation.date, start, end))
        return timeBlocks.map(timeBlock => {
          print(`${rawReservation.stuID} 预约 ${rawReservation.room}自${timeBlock.start}至${timeBlock.end}`)
          let followersStr = rawReservation.followers ? rawReservation.followers.join(',') : ''
          const reservation = [
            rawReservation,
            timeBlock,
            followersStr
          ]
          return reservation
        })
      }))

      print('预约信息就绪', '开始倒计时', moment().format())
      const timeOffset = 60 * 2 // use second as unit
      const timeToWait = (60 * 60 - moment().minute() * 60 - moment().second() - timeOffset) * 1000
      setTimeout(() => {
        print('倒计时结束', moment().format())
        reservations.map(reservation => reserve(reservation))
      }, timeToWait)
    }).catch(error => {
      print(error.message)
    })
}


process.on('exit', () => {
  print('program end')
})

main()
