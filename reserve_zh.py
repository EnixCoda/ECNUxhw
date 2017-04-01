#coding: utf-8
"""
    read from reservations file, post reservations at midnight
"""
import os
import sys
import multiprocessing
import json
import random
import time
import datetime
import requests


def formatted_current_time():
    """
    return current time in format like '23:59:59'
    """
    return datetime.datetime.now().strftime('%X')


def print_current_time():
    """
    print time from formatted_current_time
    """
    print '当前时间: %s' % (formatted_current_time())


def combine_dicts(dict1, dict2):
    """
    combine two dict objects into a new one
    """
    return dict(dict1.items() + dict2.items())


def reserve((login_info, room_type, room, time_data, mb_list)):
    """
    submit reservation
    """
    def login(session):
        """
        login using session
        """
        # user login
        LOGIN_URL = 'http://202.120.82.2:8081/ClientWeb/pro/ajax/login.aspx'
        while True:
            try:
                response = session.get(LOGIN_URL, params=login_info, timeout=5)
                login_response_content = json.loads(response.content)
                if 'ret' in login_response_content and login_response_content['ret'] == 1:
                    print '登录成功:', login_response_content['data']['name'].encode('utf-8')
                    return True
                else:
                    print '登录失败:', login_info['id']
                    print response.content
                    return False
            except Exception, error:
                print error
                time.sleep(1)

    poster = requests.session()
    if not login(poster):
        return

    # generate data
    ROOM_DATA = {
        'B411': {'dev_id': '3676491', 'kind_id': '3675179'},
        'B412': {'dev_id': '3676497', 'kind_id': '3675179'},
        'C421': {'dev_id': '3676503', 'kind_id': '3675133'},
        'C422': {'dev_id': '3676511', 'kind_id': '3675133'},
        'C423': {'dev_id': '3676515', 'kind_id': '3675133'},
        'C424': {'dev_id': '3676522', 'kind_id': '3675133'},
        'C425': {'dev_id': '3676538', 'kind_id': '3675133'},
        'C426': {'dev_id': '3676547', 'kind_id': '3675133'},
        'C427': {'dev_id': '3676566', 'kind_id': '3675133'},
        'C428': {'dev_id': '3676574', 'kind_id': '3675133'},
        'C429': {'dev_id': '3676580', 'kind_id': '3675133'},
        'C411': {'dev_id': '3676604', 'kind_id': '3674969'},
        'C412': {'dev_id': '3676641', 'kind_id': '3674969'},
        'C413': {'dev_id': '3676645', 'kind_id': '3674969'},
        'C414': {'dev_id': '3676656', 'kind_id': '3674969'},
        'C415': {'dev_id': '3676664', 'kind_id': '3674969'}
    }
    reserve_form = {
        'lab_id': '3674920',
        'type': 'dev',
        'prop': '',
        'test_id': '',
        'term': '',
        'test_name': '',
        'up_file': '',
        'memo': '',
        'act': 'set_resv',
        '_': ''
    }
    if room_type == 'medium':
        medium_room_additional_data = {
            'mb_list': mb_list,
            'min_user': '5',
            'max_user': '10'
        }
        reserve_form = combine_dicts(reserve_form, medium_room_additional_data)
    reserve_form = combine_dicts(reserve_form, time_data)
    reserve_form = combine_dicts(reserve_form, ROOM_DATA[room])

    # ready to go
    RESERVE_URL = 'http://202.120.82.2:8081/ClientWeb/pro/ajax/reserve.aspx'
    (_, _, _, _, _, last_second, _, _, _) = time.localtime()
    while True:
        try:
            time_seed = str(int(time.time())) + str(random.randint(100, 199))
            reserve_form['_'] = time_seed
            response_content = poster.get(RESERVE_URL, params=reserve_form, timeout=5).content
            response_content = json.loads(response_content)
            if 'ret' in response_content:
                while True:
                    if response_content['ret'] == 1:
                        print '预约%s自%s至%s成功' % \
                            (room.encode('utf-8'), time_data['start'].encode('utf-8'), time_data['end'].encode('utf-8'))
                        print_current_time()
                        return
                    if response_content['msg'][10:] == u'预约与现有预约冲突':
                        print '预约%s自%s至%s冲突' % \
                            (room.encode('utf-8'), time_data['start'].encode('utf-8'), time_data['end'].encode('utf-8'))
                        print_current_time()
                        return
                    if response_content['msg'][10:] == u'最少需5人同时使用':
                        print '预约%s自%s至%s失败, 存在非法的学号' % \
                            (room.encode('utf-8'), time_data['start'].encode('utf-8'), time_data['end'].encode('utf-8'))
                        print_current_time()
                        return
                    if response_content['msg'][10:] == u'预约时间不在开放时间内':
                        break
                    if response_content['msg'][10:] == u'要到[21:00]方可预约':
                        break
                    if response_content['msg'][10:] == u'只能提前[1]天预约':
                        break
                    if response_content['msg'][10:] == u'只能提前[3]天预约':
                        break
                    print '响应格式可解析，未定义对应的策略:'
                    print json.dumps(response_content)
                    return
            else:
                print '意料之外的响应:'
                print json.dumps(response_content)
                return
        except Exception, error:
            print error
            print room, time_data['start'], time_data['end']
        (_, _, _, new_hour, new_minute, new_second, _, _, _) = time.localtime()
        if new_hour == 0 and new_minute > 2:
            print '预约%s自%s至%s超时' % (room.encode('utf-8'), time_data['start'].encode('utf-8'), time_data['end'].encode('utf-8'))
            return
        if new_second == last_second:
            time.sleep(1)
        last_second = new_second


def format_time(date, start_time, end_time):
    """
    :param date: string      e.g. '20150101'
    :param start_time: int   e.g. 0246
    :param end_time: int     e.g. 1357
    """
    start_time = str(start_time)
    end_time = str(end_time)
    date = '-'.join((date[0:4], date[4:6], date[6:8]))
    start_time = ':'.join((start_time[-4:-2], start_time[-2:]))
    end_time = ':'.join((end_time[-4:-2], end_time[-2:]))
    return {
        'start_time': start_time,
        'end_time': end_time,
        'start': date + ' ' + start_time,
        'end': date + ' ' + end_time
    }

def time_cutter(date, start_time, end_time):
    """cut start_time and end_time, limit blocks within 240 minutes"""
    TIME_BLOCK_UNIT = 30
    TIME_LIMIT_RAW = 400
    TIME_LIMIT = TIME_LIMIT_RAW / 100 * 60
    reserve_time_length = end_time - start_time - (int(end_time / 100) - int(start_time / 100)) * 40
    cur_start_time = start_time
    times = []
    while reserve_time_length >= TIME_BLOCK_UNIT:
        time_buffer = 0
        while time_buffer < TIME_LIMIT and reserve_time_length > 0:
            if time_buffer + TIME_BLOCK_UNIT == TIME_LIMIT \
                and reserve_time_length - TIME_BLOCK_UNIT < TIME_BLOCK_UNIT \
                and reserve_time_length - TIME_BLOCK_UNIT > 0:
                break
            time_block = min(reserve_time_length, TIME_BLOCK_UNIT)
            time_buffer += time_block
            reserve_time_length -= time_block
        cur_end_time = cur_start_time + int(time_buffer / 60) * 100 + (time_buffer % 60)
        if cur_end_time % 100 >= 60 or cur_start_time % 100 + time_buffer % 100 == 100:
            cur_end_time += 40
        times.append(format_time(date, cur_start_time, cur_end_time))
        cur_start_time = cur_end_time
    return times


def load_quests(reservation_file_name):
    """ load quests from file reservation_file_name"""
    DAYS_AHEAD_4_MEDIUM = 3
    DAYS_AHEAD_4_SMALL = 1
    quests = []
    if not os.path.exists(reservation_file_name):
        return quests
    with open(reservation_file_name, 'r') as reservation_file:
        all_reservations = json.load(reservation_file)
        date4 = (datetime.date.today() + datetime.timedelta(DAYS_AHEAD_4_MEDIUM)).strftime('%Y%m%d')
        if date4 in all_reservations:
            reservations = all_reservations[date4]
            for reservation in reservations:
                if reservation['roomType'] == 'medium':
                    quests.append(reservation)
        date2 = (datetime.date.today() + datetime.timedelta(DAYS_AHEAD_4_SMALL)).strftime('%Y%m%d')
        if date2 in all_reservations:
            reservations = all_reservations[date2]
            for reservation in reservations:
                if reservation['roomType'] == 'wood' or reservation['roomType'] == 'glass':
                    quests.append(reservation)
    return quests


def main():
    """everything begins from here"""
    if len(sys.argv) > 1:
        reservation_file_name = sys.argv[1]
    else:
        reservation_file_name = 'reservations.json'

    quests = load_quests(reservation_file_name)
    if len(quests) == 0:
        print '无预约'
        return

    reservations = []
    for quest in quests:
        start_time, end_time, room = int(quest['beginTime']), int(quest['endTime']), quest['room']
        times = time_cutter(quest['date'], start_time, end_time)

        print '预约时间分配'
        times_length = len(times)
        for index in range(times_length):
            print '%s预约%s自%s至%s' % (
                quest['stuID'].encode('utf-8'),
                room.encode('utf-8'),
                times[index]['start'].encode('utf-8'),
                times[index]['end'].encode('utf-8')
            )
            followers_str = ''
            if 'followers' in quest and quest['followers'] is not None:
                followers_str = ','.join(quest['followers'])
            reservation = (
                {
                    'id': quest['stuID'],
                    'pwd': quest['stuPsw'],
                    'act': 'login'
                },
                quest['roomType'],
                room,
                times[index],
                followers_str
            )
            reservations.append(reservation)

    pool = multiprocessing.Pool(processes=len(reservations))
    pool.map(reserve, reservations)
    pool.close()
    pool.join()


if __name__ == '__main__':
    print '****************************************'
    main()
    print '执行完毕'
