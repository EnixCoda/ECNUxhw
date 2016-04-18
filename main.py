# -*- coding: utf-8 -*-
import urllib
import urllib2
import cookielib
import json
import random
import time
import sys
import multiprocessing
import datetime


def get_time(content):
    content = content.split('<table id="my_resv_tbl" class="list_style_tbl">')[1].split('</table>')[0]


def main(login_info):
    cookie = cookielib.CookieJar()
    handler = urllib2.HTTPCookieProcessor(cookie)
    opener = urllib2.build_opener(handler)

    # user login
    login_url = 'http://202.120.82.2:8081/ClientWeb/pro/ajax/login.aspx'
    not_succeeded = True
    times_to_try = 3
    response = {}
    while not_succeeded and times_to_try > 0:
        try:
            response = json.loads(opener.open(login_url, urllib.urlencode(login_info), timeout=5).read())
            if response['ret'] == 1:
                not_succeeded = False
        except Exception, e:
            print e
        times_to_try -= 1
    if not response:
        print "connection error"
    if not_succeeded:
        print login_info['id'], login_info['pwd'], 'login fail'
        return

    user_center_url = "http://202.120.82.2:8081/ClientWeb/xcus/a/center.aspx"
    not_succeeded = True
    times_to_try = 3
    response = ""
    while not_succeeded and times_to_try > 0:
        try:
            time_seed = str(int(time.time())) + str(random.randint(100, 199))
            response = opener.open(user_center_url, urllib.urlencode(time_seed), timeout=5).read()
            not_succeeded = False
        except Exception, e:
            print e
        times_to_try -= 1

    response
