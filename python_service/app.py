"""
app.py — RakshaNet Flask Backend
=================================
Demonstrates:
  ✅ datetime module  — timestamps, formatting, arithmetic, IST timezone
  ✅ sqlite3 module   — via database.py (CREATE TABLE, INSERT, SELECT, DELETE)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from threading import Timer
from datetime import datetime, timedelta
import pytz
import os

from notifier import send_email_alert, send_sms_alert
import database

# ──────────────────────────────────────
#  App Setup
# ──────────────────────────────────────
app = Flask(__name__)
CORS(app)

database.create_table()   # creates sqlite3 tables on startup

IST = pytz.timezone("Asia/Kolkata")

# In-memory timer store  {user_id: Timer}
timers = {}


# ──────────────────────────────────────
#  DATETIME HELPERS  (used throughout)
# ──────────────────────────────────────
def now_ist():
    """Current datetime in IST."""
    return datetime.now(IST)

def fmt(dt):
    """Format a datetime object → human-readable IST string."""
    return dt.strftime("%d-%m-%Y %H:%M:%S")

def deadline_str(minutes):
    """Return the wall-clock time when the timer will fire."""
    deadline = now_ist() + timedelta(minutes=minutes)
    return deadline.strftime("%H:%M:%S")


# ──────────────────────────────────────
#  AUTO-SOS  (timer callback)
# ──────────────────────────────────────
def auto_sos(user_id):
    """
    Fires when the safety timer expires.
    Uses datetime to stamp the event and sqlite3 (via database) to store it.
    """
    triggered_at = now_ist()   # datetime object

    # Build a rich timestamp string using strftime
    timestamp = triggered_at.strftime("%d-%m-%Y %H:%M:%S")
    weekday   = triggered_at.strftime("%A")          # e.g. "Tuesday"
    week_num  = triggered_at.isocalendar()[1]        # ISO week number

    # ── sqlite3: save alert ──
    database.insert_alert(user_id, "Check-in timer expired")
    database.log_session(user_id, "timer_expired")

    alert_message = f"""
🚨 RakshaNet Emergency Alert!

User    : {user_id}
Reason  : Safety timer expired — no check-in received
Triggered: {timestamp}  ({weekday}, Week {week_num})

Please check on this person immediately.
"""

    send_email_alert(alert_message)

    contacts = database.get_contacts(user_id)
    if not contacts:
        print("⚠️  No emergency contacts saved for", user_id)
    else:
        for phone in contacts:
            send_sms_alert(alert_message, phone)

    print(f"✅ Auto-SOS fired for {user_id} at {timestamp}")


# ──────────────────────────────────────
#  ROUTES
# ──────────────────────────────────────

@app.route("/")
def home():
    # Show server time using datetime
    now = now_ist()
    return jsonify({
        "status":  "RakshaNet backend running ✅",
        "time_ist": fmt(now),
        "day":      now.strftime("%A"),
        "week":     now.isocalendar()[1],
    })


# ── Start safety timer ──
@app.route("/start-timer", methods=["POST"])
def start_timer():
    data     = request.json
    user_id  = data["userId"]
    minutes  = int(data.get("minutes", 1))

    # Cancel existing timer for this user
    if user_id in timers:
        timers[user_id].cancel()

    # datetime: calculate when it will fire
    fires_at = deadline_str(minutes)

    # Start new threading.Timer
    t = Timer(minutes * 60, auto_sos, args=[user_id])
    timers[user_id] = t
    t.start()

    # sqlite3: log session event
    database.log_session(user_id, "timer_started")

    started_at = fmt(now_ist())
    print(f"⏱  Timer started for {user_id} | fires at {fires_at}")

    return jsonify({
        "message":    "Safety timer started",
        "started_at": started_at,
        "fires_at":   fires_at,
        "duration_min": minutes,
    })


# ── Check-in (cancel timer) ──
@app.route("/check-in", methods=["POST"])
def check_in():
    data    = request.json
    user_id = data["userId"]

    if user_id in timers:
        timers[user_id].cancel()
        del timers[user_id]

    checkin_time = fmt(now_ist())

    # sqlite3: record check-in
    database.insert_alert(user_id, "User checked in safely")
    database.log_session(user_id, "checkin")

    print(f"✅ Check-in: {user_id} at {checkin_time}")

    return jsonify({
        "message":    "Timer cancelled — you are safe!",
        "checked_in": checkin_time,
    })


# ── SOS button ──
@app.route("/sos", methods=["POST"])
def sos():
    data    = request.json
    user_id = data["userId"]
    lat     = data.get("lat")
    lng     = data.get("lng")

    sos_time = fmt(now_ist())
    weekday  = now_ist().strftime("%A")

    # sqlite3: store SOS with coordinates
    database.insert_alert(user_id, "SOS button triggered", lat=lat, lng=lng)
    database.log_session(user_id, "sos")

    maps_link = f"https://maps.google.com/?q={lat},{lng}" if lat and lng else "No location"

    message = f"""
🚨 SOS ALERT — RakshaNet

User      : {user_id}
Time      : {sos_time} ({weekday})
Location  : {maps_link}

Please respond immediately!
"""
    send_email_alert(message)

    contacts = database.get_contacts(user_id)
    for phone in contacts:
        send_sms_alert(message, phone)

    return jsonify({
        "message":  "SOS alert sent",
        "time":     sos_time,
        "location": maps_link,
    })


# ── Get alerts (logs) ──
@app.route("/logs/<user_id>", methods=["GET"])
def logs(user_id):
    rows = database.fetch_alerts_for_user(user_id)
    return jsonify(rows)


# ── Get alerts by date  (datetime filter demo) ──
@app.route("/logs/<user_id>/date/<date_str>", methods=["GET"])
def logs_by_date(user_id, date_str):
    """
    Filter alerts by date.
    date_str format: YYYY-MM-DD
    Example: /logs/user@email.com/date/2025-06-15
    """
    try:
        # Validate date string using datetime.strptime
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    rows = database.fetch_alerts_by_date(user_id, date_str)
    return jsonify(rows)


# ── User stats  (datetime arithmetic demo) ──
@app.route("/stats/<user_id>", methods=["GET"])
def stats(user_id):
    """
    Returns rich stats using datetime module:
      - alerts today, this week, total
      - first and last alert timestamps
      - current IST time, day name, week number
    Uses sqlite3 COUNT queries under the hood.
    """
    data = database.get_user_stats(user_id)
    return jsonify(data)


# ── Add contact ──
@app.route("/add-contact", methods=["POST"])
def add_contact():
    data    = request.json
    user_id = data["userId"]
    phone   = data["phone"]

    database.add_contact(user_id, phone)
    print(f"📌 Contact added: {phone} for {user_id} at {fmt(now_ist())}")

    return jsonify({
        "message": "Contact saved",
        "added_at": fmt(now_ist()),
    })


# ── Delete contact ──
@app.route("/delete-contact", methods=["POST"])
def delete_contact():
    data    = request.json
    user_id = data["userId"]
    phone   = data["phone"]

    database.delete_contact(user_id, phone)
    return jsonify({"message": "Contact removed"})


# ── Get contacts ──
@app.route("/contacts/<user_id>", methods=["GET"])
def get_contacts(user_id):
    contacts = database.get_contacts(user_id)
    return jsonify({
        "contacts":     contacts,
        "count":        len(contacts),
        "fetched_at":   fmt(now_ist()),
    })


# ──────────────────────────────────────
#  RUN
# ──────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"🚀 RakshaNet starting on port {port}")
    print(f"🕐 Server time (IST): {fmt(now_ist())}")
    print(f"📅 Day: {now_ist().strftime('%A')}, Week: {now_ist().isocalendar()[1]}")
    app.run(host="0.0.0.0", port=port, debug=False)