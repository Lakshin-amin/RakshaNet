from flask import Flask, request, jsonify
from flask_cors import CORS
from threading import Timer
from datetime import datetime
import database

app = Flask(__name__)
CORS(app)

timers = {}
database.create_table()

def auto_sos(user_id):
    timestamp = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    database.insert_alert(user_id, "Check-in timer expired", timestamp)

@app.route("/start-timer", methods=["POST"])
def start_timer():
    data = request.json
    user_id = data["userId"]
    minutes = int(data["minutes"])

    if user_id in timers:
        timers[user_id].cancel()

    timer = Timer(minutes * 60, auto_sos, args=[user_id])
    timers[user_id] = timer
    timer.start()

    return jsonify({"message": "Safety timer started"})

@app.route("/logs", methods=["GET"])
def logs():
    rows = database.fetch_alerts()
    return jsonify([
        {"user": r[0], "reason": r[1], "time": r[2]}
        for r in rows
    ])

@app.route("/")
def home():
    return "RakshaNet Python Service Running ✅"

if __name__ == "__main__":
    app.run(port=5001)
