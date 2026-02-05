from flask import Flask, request, jsonify
from flask_cors import CORS
from threading import Timer
from datetime import datetime
from notifier import send_email_alert, send_sms_alert
import database
import os

app = Flask(__name__)
CORS(app)

timers = {}
database.create_table()



# AUTO SOS TRIGGER (Timer Expiry)

def auto_sos(user_id):
    timestamp = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    # Save alert into SQLite
    database.insert_alert(user_id, "Check-in timer expired", timestamp)

    # Alert message
    alert_message = f"""
🚨 RakshaNet Emergency Alert!

User: {user_id}
Reason: Safety timer expired
Time: {timestamp}

Please check immediately.
"""

    # Send Email + SMS
    send_email_alert(alert_message)
    send_sms_alert(alert_message)

    print("✅ Alert saved + Notification sent")



# START TIMER API

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



# CHECK-IN API (Cancel Timer)

@app.route("/check-in", methods=["POST"])
def check_in():
    data = request.json
    user_id = data["userId"]

    # Cancel timer if running
    if user_id in timers:
        timers[user_id].cancel()
        del timers[user_id]

    timestamp = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    # Save check-in log
    database.insert_alert(user_id, "User checked in safely", timestamp)

    print(f"✅ User checked in: {user_id}")

    return jsonify({"message": "Timer cancelled successfully"})



# LOGS API (SQLite Alerts)

@app.route("/logs", methods=["GET"])
def logs():
    rows = database.fetch_alerts()
    return jsonify([
        {"user": r[0], "reason": r[1], "time": r[2]}
        for r in rows
    ])



# HOME ROUTE

@app.route("/")
def home():
    return "RakshaNet Python Service Running ✅"


# 
# RUN SERVER (Render Compatible)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
