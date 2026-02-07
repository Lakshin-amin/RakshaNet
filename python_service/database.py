import sqlite3

DB_NAME = "alerts.db"


# ---------------- CONNECT ----------------
def get_connection():
    return sqlite3.connect(DB_NAME, check_same_thread=False)


# ---------------- CREATE TABLES ----------------
def create_table():
    conn = get_connection()
    cursor = conn.cursor()

    # Alerts table (already working)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sos_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            reason TEXT,
            time TEXT
        )
    """)

    # Emergency Contacts table (NEW)
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


def fetch_alerts():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT user, reason, time FROM sos_alerts")
    rows = cursor.fetchall()

    conn.close()
    return rows


# ---------------- CONTACT FUNCTIONS (NEW) ----------------
def add_contact(user, phone):
    conn = get_connection()
    cursor = conn.cursor()

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

    # Return list of phone numbers
    return [r[0] for r in rows]
