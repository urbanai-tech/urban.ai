import pymysql

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
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id VARCHAR(36) PRIMARY KEY,
                userId VARCHAR(36) NOT NULL,
                tokenHash VARCHAR(64) NOT NULL,
                expiresAt DATETIME NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                revokedAt DATETIME NULL,
                userAgent VARCHAR(255) NULL,
                ip VARCHAR(64) NULL,
                CONSTRAINT FK_refresh_tokens_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
            );
        """)
        
        # also create the unique index
        cursor.execute("""
            CREATE UNIQUE INDEX IDX_refresh_tokens_tokenHash ON refresh_tokens (tokenHash);
        """)
        cursor.execute("""
            CREATE INDEX IDX_refresh_tokens_user_revoked ON refresh_tokens (userId, revokedAt);
        """)

        conn.commit()
        print('Table created successfully.')
except Exception as e:
    print('Error:', e)
