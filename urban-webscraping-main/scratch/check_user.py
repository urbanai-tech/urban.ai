import pymysql
import sys

try:
    conn = pymysql.connect(
        host='switchback.proxy.rlwy.net',
        port=56406,
        user='root',
        password='jpXtfdmHCyOUzfTdgjadxqkRnXEMNfpr',
        database='railway',
        cursorclass=pymysql.cursors.DictCursor
    )
    with conn.cursor() as cursor:
        cursor.execute("SELECT id, email, password FROM user WHERE email = 'collector@urban.ai'")
        user = cursor.fetchone()
        if user:
            print('User found:', user)
        else:
            print('User not found!')
except Exception as e:
    print('Error:', e)
