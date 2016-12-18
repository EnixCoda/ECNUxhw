#coding: utf-8
"""
    read from reservations file, post reservations at midnight
"""
import json
import random
import time
import sys
import multiprocessing
import datetime
import requests

SKIP_COUNT_DOWN = True


def formatted_current_time():
    """
        return current time in format like '23:59:59'
    """
    return datetime.datetime.now().strftime('%X')


def print_current_time():
    """
        print time from formatted_current_time
    """
    print 'current time: %s' % (formatted_current_time())


def combine_dicts(dict1, dict2):
    combined_dict = dict(dict1.items() + dict2.items())
    return combined_dict


def reserve((login_info, room_type, room, time_data, mb_list)):
    def login(session):
        # user login
        LOGIN_URL = 'http://202.120.82.2:8081/ClientWeb/pro/ajax/login.aspx'
        try:
            response = session.get(LOGIN_URL, params=login_info, timeout=5)
            login_response_content = json.loads(response.content)
            if 'ret' in login_response_content and login_response_content['ret'] == 1:
                return True
            else:
                print response.content
                print 'login failed:', login_info['id'], login_info['pwd']
                return False
        except Exception, error:
            print error
            return False

    poster = requests.session()
    if not login(poster):
        return

    minute_adjust = get_minute_adjust()

    # generate data
    room_data = {
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
    reserve_data = {
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
    time_seed = str(int(time.time())) + str(random.randint(100, 199))
    reserve_data['_'] = time_seed
    if room_type == 'medium':
        medium_room_additional_data = {
            'mb_list': mb_list,
            'min_user': '5',
            'max_user': '10'
        }
        reserve_data = combine_dicts(reserve_data, medium_room_additional_data)
    reserve_data = combine_dicts(reserve_data, time_data)
    reserve_data = combine_dicts(reserve_data, room_data[room])

    # ready to go
    RESERVE_URL = 'http://202.120.82.2:8081/ClientWeb/pro/ajax/reserve.aspx'
    (_, _, _, _, _, last_second, _, _, _) = time.localtime()
    while True:
        try:
            response_content = json.loads(
                poster.get(RESERVE_URL, params=reserve_data, timeout=5).content
            )
            if 'ret' in response_content:
                while True:
                    if response_content['ret'] == 1:
                        print 'reserve %s from %s to %s succeeded.' % \
                            (room, time_data['start'], time_data['end'])
                        print_current_time()
                        return
                    if response_content['msg'][10:] == u'预约与现有预约冲突':
                        print 'reserve %s from %s to %s conflicted.' % \
                            (room, time_data['start'], time_data['end'])
                        print_current_time()
                        return
                    if response_content['msg'][10:] == u'最少需5人同时使用':
                        print 'reserve %s from %s to %s failed, invalid reserver existing.' % \
                            (room, time_data['start'], time_data['end'])
                        print_current_time()
                        return
                    if response_content['msg'][10:] == u'只能提前[1]天预约':
                        break
                    if response_content['msg'][10:] == u'只能提前[3]天预约':
                        break
                    print 'unexpected response, undefined situation:'
                    print json.dumps(response_content)
                    return
            else:
                print 'unexpected response'
                print response_content
                return
        except Exception, error:
            print error
            print room, time_data['start'], time_data['end']
        (_, _, _, new_hour, new_minute, new_second, _, _, _) = time.localtime()
        if new_hour == 0 and new_minute - minute_adjust > 2:
            print 'timeout: ', room, time_data['start'], time_data['end']
            return
        if new_second == last_second:
            time.sleep(1)
        last_second = new_second


def extract_login_info_from(reservation):
    login_info = {
        'id': reservation['stuID'],
        'pwd': reservation['stuPsw'],
        'act': 'login'
    }
    return login_info


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
    # TODO: fix calc bug, e.g. 1000 - 950 = 50 > 30
    TIME_LIMIT = 400
    reserve_time_length = end_time - start_time
    cur_start_time = start_time
    cur_end_time = start_time + max(((reserve_time_length - 1) % TIME_LIMIT + 1), 30)
    times = []
    while True:
        times.append(format_time(date, cur_start_time, cur_end_time))
        cur_start_time = cur_end_time
        cur_end_time += (end_time - cur_end_time - 1) % TIME_LIMIT + 1
        if cur_start_time >= end_time:
            break
    return times


def load_quests(reservation_file_name):
    DAYS_AHEAD_4_MEDIUM = 4
    DAYS_AHEAD_4_SMALL = 2
    quests = []
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


def get_minute_adjust():
    minute_adjust = 0
    HOMEPAGE_URL = "http://202.120.82.2:8081/ClientWeb/xcus/ic2/Default.aspx"
    response = requests.get(HOMEPAGE_URL)
    date = response.headers['Date']
    datetime_object = datetime.datetime.strptime(date, '%a, %d %b %Y %X %Z')
    if date[-3:] == 'GMT':
        datetime_object += datetime.timedelta(hours=8)
        minute_adjust = int((datetime.datetime.now() - datetime_object).seconds / 60)
    return minute_adjust


def main():
    if len(sys.argv) > 1:
        reservation_file_name = sys.argv[1]
    else:
        reservation_file_name = 'reservations'

    quests = load_quests(reservation_file_name)
    if len(quests) == 0:
        print 'no quest detected.'
        return

    reservations = []
    for quest in quests:
        (start_time, end_time, room) = (int(quest['beginTime']), int(quest['endTime']), quest['room'])
        if end_time - start_time < 30:
            print quest['room'], ': from ', start_time, ' to ', end_time, ' is too short.'
            continue
        times = time_cutter(quest['date'], start_time, end_time)

        print 'time divide:'
        times_length = len(times)
        for index in range(times_length):
            print '%s reserves %s from %s to %s' % \
                (quest['stuID'], quest['room'], times[index]['start'], times[index]['end'])
            followers_str = ''
            if 'followers' in quest:
                followers_str = ','.join(quest['followers'])
            reservation = (
                extract_login_info_from(quest),
                quest['roomType'],
                quest['room'],
                times[index],
                followers_str
            )
            reservations.append(reservation)

    # check server's time
    minute_adjust = get_minute_adjust()
    print 'got minute_adjust:', minute_adjust

    # reservations loaded
    time_to_sleep = 5
    print 'start waiting'
    print_current_time()
    while True:
        time.sleep(time_to_sleep)
        server_time = datetime.datetime.now() + datetime.timedelta(minutes=-minute_adjust)
        server_time = server_time.strftime('%H:%M')
        if server_time == '23:55' \
            or server_time == '23:56' \
            or server_time == '23:57' \
            or server_time == '23:58' \
            or server_time == '23:59' \
            or server_time[0:2] == '24' \
            or server_time[0:2] == '00' \
            or SKIP_COUNT_DOWN:
            break
    print 'stop waiting'
    print_current_time()

    pool = multiprocessing.Pool(processes=len(reservations))
    pool.map(reserve, reservations)
    pool.close()
    pool.join()


if __name__ == '__main__':
    print '****************************************'
    main()
    print 'program done'
