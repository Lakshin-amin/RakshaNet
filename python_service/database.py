"""
database.py — RakshaNet
Uses: sqlite3 (standard library)

Tables:
  sos_alerts  — every SOS / timer event
  contacts    — emergency phone numbers per user
  sessions    — login/logout tracking
"""

import sqlite3
from datetime import datetime
import pytz

DB_NAME = "alerts.db"
IST     = pytz.timezone("Asia/Kolkata")


# ──────────────────────────────────────
#  CONNECTION
# ──────────────────────────────────────
def get_connection():
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    conn.row_factory = sqlite3.Row   # rows behave like dicts
    conn.execute("PRAGMA journal_mode=WAL")  # better concurrency
    return conn


# ──────────────────────────────────────
#  CREATE TABLES
# ──────────────────────────────────────
def create_table():
    conn = get_connection()
    cursor = conn.cursor()

    # --- Alerts table (stores every SOS / timer event) ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sos_alerts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user        TEXT    NOT NULL,
            reason      TEXT    NOT NULL,
            latitude    REAL,
            longitude   REAL,
            created_at  TEXT    NOT NULL,   -- ISO-8601 timestamp
            date_only   TEXT    NOT NULL,   -- YYYY-MM-DD  (for date filtering)
            time_only   TEXT    NOT NULL    -- HH:MM:SS    (for time filtering)
        )
    """)

    # --- Contacts table ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user       TEXT NOT NULL,
            phone      TEXT NOT NULL,
            added_on   TEXT NOT NULL,       -- ISO-8601 timestamp
            UNIQUE(user, phone)             -- no duplicate contacts
        )
    """)

    # --- Sessions table (datetime module showcase) ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user       TEXT NOT NULL,
            event      TEXT NOT NULL,       -- 'login' | 'logout' | 'checkin'
            logged_at  TEXT NOT NULL,
            day_name   TEXT NOT NULL,       -- e.g. "Monday"
            week_num   INTEGER NOT NULL     -- ISO week number
        )
    """)

    conn.commit()
    conn.close()
    print("✅ Database tables ready")


# ──────────────────────────────────────
#  DATETIME HELPERS
# ──────────────────────────────────────
def now_ist():
    """Return current datetime object in IST."""
    return datetime.now(IST)

def now_str():
    """Human-readable IST timestamp: DD-MM-YYYY HH:MM:SS"""
    return now_ist().strftime("%d-%m-%Y %H:%M:%S")

def now_iso():
    """ISO-8601 timestamp for DB storage."""
    return now_ist().isoformat()

def now_date():
    """Date only: YYYY-MM-DD"""
    return now_ist().strftime("%Y-%m-%d")

def now_time():
    """Time only: HH:MM:SS"""
    return now_ist().strftime("%H:%M:%S")

def day_name():
    """Full weekday name: Monday, Tuesday …"""
    return now_ist().strftime("%A")

def week_number():
    """ISO week number of the year."""
    return now_ist().isocalendar()[1]


# ──────────────────────────────────────
#  ALERT FUNCTIONS
# ──────────────────────────────────────
def insert_alert(user, reason, lat=None, lng=None):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO sos_alerts
           (user, reason, latitude, longitude, created_at, date_only, time_only)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (user, reason, lat, lng, now_iso(), now_date(), now_time())
    )
    conn.commit()
    conn.close()


def fetch_alerts_for_user(user):
    """Return all alerts for a user, newest first."""
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT user, reason, created_at AS time, latitude, longitude
           FROM sos_alerts
           WHERE user = ?
           ORDER BY id DESC""",
        (user,)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def fetch_alerts_by_date(user, date_str):
    """Return alerts for a specific date (YYYY-MM-DD)."""
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT user, reason, created_at AS time, latitude, longitude
           FROM sos_alerts
           WHERE user = ? AND date_only = ?
           ORDER BY id DESC""",
        (user, date_str)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def count_alerts_today(user):
    """How many alerts has this user triggered today?"""
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM sos_alerts WHERE user = ? AND date_only = ?",
        (user, now_date())
    )
    count = cursor.fetchone()[0]
    conn.close()
    return count


# ──────────────────────────────────────
#  CONTACT FUNCTIONS
# ──────────────────────────────────────
def add_contact(user, phone):
    conn   = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO contacts (user, phone, added_on) VALUES (?, ?, ?)",
            (user, phone, now_iso())
        )
        conn.commit()
    except sqlite3.IntegrityError:
        pass   # duplicate — silently ignore
    finally:
        conn.close()


def get_contacts(user):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT phone FROM contacts WHERE user = ? ORDER BY id",
        (user,)
    )
    phones = [r[0] for r in cursor.fetchall()]
    conn.close()
    return phones


def delete_contact(user, phone):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM contacts WHERE user = ? AND phone = ?",
        (user, phone)
    )
    conn.commit()
    conn.close()


# ──────────────────────────────────────
#  SESSION LOGGING  (datetime showcase)
# ──────────────────────────────────────
def log_session(user, event):
    """
    Log a session event using multiple datetime features:
      - isoformat()   → storage
      - strftime()    → day name
      - isocalendar() → week number
    """
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO sessions (user, event, logged_at, day_name, week_num)
           VALUES (?, ?, ?, ?, ?)""",
        (user, event, now_iso(), day_name(), week_number())
    )
    conn.commit()
    conn.close()


def get_user_stats(user):
    """
    Return a stats dict using datetime arithmetic:
      - total alerts
      - alerts today
      - alerts this week
      - first alert ever
      - last alert
    """
    conn   = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM sos_alerts WHERE user=?", (user,))
    total = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM sos_alerts WHERE user=? AND date_only=?",
        (user, now_date())
    )
    today = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM sos_alerts WHERE user=? AND date_only >= ?",
        (user, now_ist().strftime("%Y-W%V"))   # week start
    )
    # simpler: filter by week_num would need join; use date range instead
    week_start = now_ist().strftime("%Y-%m-") + str(now_ist().day - now_ist().weekday()).zfill(2)
    cursor.execute(
        "SELECT COUNT(*) FROM sos_alerts WHERE user=? AND date_only >= ?",
        (user, week_start)
    )
    this_week = cursor.fetchone()[0]

    cursor.execute(
        "SELECT created_at FROM sos_alerts WHERE user=? ORDER BY id ASC LIMIT 1",
        (user,)
    )
    row = cursor.fetchone()
    first_alert = row[0] if row else None

    cursor.execute(
        "SELECT created_at FROM sos_alerts WHERE user=? ORDER BY id DESC LIMIT 1",
        (user,)
    )
    row = cursor.fetchone()
    last_alert = row[0] if row else None

    conn.close()

    return {
        "total_alerts":  total,
        "alerts_today":  today,
        "alerts_this_week": this_week,
        "first_alert":   first_alert,
        "last_alert":    last_alert,
        "current_time":  now_str(),
        "current_day":   day_name(),
        "week_number":   week_number(),
    }