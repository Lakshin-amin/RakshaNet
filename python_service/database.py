import sqlite3

DB_NAME = "alerts.db"

def get_connection():
    return sqlite3.connect(DB_NAME, check_same_thread=False)

def create_table():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sos_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            reason TEXT,
            time TEXT
        )
    """)
    conn.commit()
    conn.close()

def insert_alert(user, reason, time):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO sos_alerts (user, reason, time) VALUES (?, ?, ?)",
        (user, reason, time)
    )
    conn.commit()
    conn.close()

def fetch_alerts():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT user, reason, time FROM sos_alerts")
    rows = cursor.fetchall()
    conn.close()
    return rows
