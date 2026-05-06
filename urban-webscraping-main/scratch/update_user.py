import pymysql
import bcrypt

try:
    conn = pymysql.connect(
        host='switchback.proxy.rlwy.net',
        port=56406,
        user='root',
        password='jpXtfdmHCyOUzfTdgjadxqkRnXEMNfpr',
        database='railway',
        cursorclass=pymysql.cursors.DictCursor
    )
    # create hash
    pwd = "Urban_Coll3ct0r!2026"
    hashed = bcrypt.hashpw(pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    with conn.cursor() as cursor:
        cursor.execute("UPDATE user SET password = %s WHERE email = 'collector@urban.ai'", (hashed,))
        conn.commit()
        print('Password updated to:', hashed)
except Exception as e:
    print('Error:', e)
