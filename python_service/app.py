from flask import Flask, request, jsonify
from flask_cors import CORS
from threading import Timer
from datetime import datetime
from notifier import send_email_alert, send_sms_alert
import database
import os

# Flask App Setup
app = Flask(__name__)
CORS(app)

# Store active timers in memory
timers = {}

# Create SQLite tables at startup
database.create_table()

# AUTO SOS FUNCTION (Timer Expiry)
def auto_sos(user_id):
    timestamp = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    # Save alert into SQLite database
    database.insert_alert(user_id, "Check-in timer expired", timestamp)

    # Emergency alert message
    alert_message = f"""
🚨 RakshaNet Emergency Alert!

User: {user_id}
Reason: Safety timer expired
Time: {timestamp}

Please check immediately.
"""

    # ✅ Send Email Alert
    send_email_alert(alert_message)

    # ✅ Send SMS to all emergency contacts saved in SQLite
    contacts = database.get_contacts(user_id)

    if len(contacts) == 0:
        print("⚠️ No emergency contacts found.")
    else:
        for phone in contacts:
            send_sms_alert(alert_message, phone)

    print("✅ Alert saved + Notifications sent successfully!")


# --- START TIMER API ---
@app.route("/start-timer", methods=["POST"])
def start_timer():
    data = request.json
    user_id = data["userId"]
    minutes = int(data["minutes"])

    # Cancel old timer if already running
    if user_id in timers:
        timers[user_id].cancel()

    # Start new timer
    timer = Timer(minutes * 60, auto_sos, args=[user_id])
    timers[user_id] = timer
    timer.start()

    print(f"⏱ Timer started for {user_id} ({minutes} min)")

    return jsonify({"message": "Safety timer started"})


# --- CHECK-IN API (Cancel Timer) ---
@app.route("/check-in", methods=["POST"])
def check_in():
    data = request.json
    user_id = data["userId"]

    # Cancel timer if running
    if user_id in timers:
        timers[user_id].cancel()
        del timers[user_id]

    timestamp = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    # Save check-in log into SQLite
    database.insert_alert(user_id, "User checked in safely", timestamp)

    print(f"✅ User checked in safely: {user_id}")

    return jsonify({"message": "Timer cancelled successfully"})


# --- LOGS API (Fetch Alerts from SQLite) ---
@app.route("/logs/<user_id>", methods=["GET"])
def logs(user_id):
    rows = database.fetch_alerts_for_user(user_id)
    return jsonify([
        {"user": r[0], "reason": r[1], "time": r[2]}
        for r in rows
    ])


# --- ADD CONTACT API ---
@app.route("/add-contact", methods=["POST"])
def add_contact():
    data = request.json
    user_id = data["userId"]
    phone = data["phone"]

    database.add_contact(user_id, phone)

    print(f"📌 Contact added: {phone} for {user_id}")

    return jsonify({"message": "Emergency contact saved successfully"})

@app.route("/contacts/<user_id>", methods=["GET"])
def get_contacts(user_id):
    contacts = database.get_contacts(user_id)
    return jsonify({"contacts": contacts})



@app.route("/get-contacts", methods=["GET"])
def get_contacts():
    user_id = request.args.get("userId")
    contacts = database.get_contacts(user_id)

    return jsonify([
        {"phone": phone}
        for phone in contacts
    ])

@app.route("/get-contacts", methods=["GET"])
def get_contacts():
    user_id = request.args.get("userId")

    contacts = database.get_contacts(user_id)

    return jsonify([
        {"phone": phone}
        for phone in contacts
    ])



# HOME ROUTE
@app.route("/")
def home():
    return "RakshaNet Python Service Running ✅"


# --- RUN SERVER (Render Compatible) ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
