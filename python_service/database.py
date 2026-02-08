import sqlite3

DB_NAME = "alerts.db"


# ---------------- CONNECT ----------------
def get_connection():
    return sqlite3.connect(DB_NAME, check_same_thread=False)


# ---------------- CREATE TABLES ----------------
def create_table():
    conn = get_connection()
    cursor = conn.cursor()

    # Alerts Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sos_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            reason TEXT,
            time TEXT
        )
    """)

    # Emergency Contacts Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            phone TEXT
        )
    """)

    conn.commit()
    conn.close()


# ---------------- ALERT FUNCTIONS ----------------
def insert_alert(user, reason, time):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO sos_alerts (user, reason, time) VALUES (?, ?, ?)",
        (user, reason, time)
    )

    conn.commit()
    conn.close()


def fetch_alerts_for_user(user):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT user, reason, time FROM sos_alerts WHERE user=? ORDER BY id DESC",
        (user,)
    )

    rows = cursor.fetchall()
    conn.close()
    return rows


# ---------------- CONTACT FUNCTIONS ----------------
def add_contact(user, phone):
    conn = get_connection()
    cursor = conn.cursor()

    # Prevent duplicate contacts
    cursor.execute(
        "SELECT phone FROM contacts WHERE user=? AND phone=?",
        (user, phone)
    )

    if cursor.fetchone():
        conn.close()
        return

    cursor.execute(
        "INSERT INTO contacts (user, phone) VALUES (?, ?)",
        (user, phone)
    )

    conn.commit()
    conn.close()


def get_contacts(user):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT phone FROM contacts WHERE user=?",
        (user,)
    )

    rows = cursor.fetchall()
    conn.close()

    return [r[0] for r in rows]
