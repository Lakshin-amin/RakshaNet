"""
app.py — RakshaNet Flask Backend
=================================
Demonstrates:
  ✅ datetime module  — timestamps, formatting, arithmetic, IST timezone
  ✅ sqlite3 module   — via database.py (CREATE, INSERT, SELECT, DELETE)
  ✅ csv module       — alert export to downloadable CSV file
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from threading import Timer
from datetime import datetime, timedelta
import pytz, os, csv, io

from notifier import send_email_alert, send_sms_alert
import database

# ── Setup ──────────────────────────────
app    = Flask(__name__)
CORS(app)
database.create_table()
IST    = pytz.timezone("Asia/Kolkata")
timers = {}

# ── Datetime helpers ───────────────────
def now_ist():
    return datetime.now(IST)

def fmt(dt):
    return dt.strftime("%d-%m-%Y %H:%M:%S")

def deadline_str(minutes):
    return (now_ist() + timedelta(minutes=minutes)).strftime("%H:%M:%S")

# ── Auto-SOS ───────────────────────────
def auto_sos(user_id):
    triggered_at = now_ist()
    timestamp    = triggered_at.strftime("%d-%m-%Y %H:%M:%S")
    weekday      = triggered_at.strftime("%A")
    week_num     = triggered_at.isocalendar()[1]

    database.insert_alert(user_id, "Check-in timer expired")
    database.log_session(user_id, "timer_expired")

    msg = (
        f"🚨 RakshaNet Emergency Alert!\n"
        f"User     : {user_id}\n"
        f"Reason   : Safety timer expired — no check-in received\n"
        f"Triggered: {timestamp}  ({weekday}, Week {week_num})\n"
        f"Please check on this person immediately."
    )
    send_email_alert(msg)
    for phone in database.get_contacts(user_id):
        send_sms_alert(msg, phone)

    print(f"✅ Auto-SOS fired for {user_id} at {timestamp}")

# ═══════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════

@app.route("/")
def home():
    now = now_ist()
    return jsonify({
        "status":   "RakshaNet backend ✅",
        "time_ist": fmt(now),
        "day":      now.strftime("%A"),
        "week":     now.isocalendar()[1],
        "docs":     "/api-docs"
    })

@app.route("/start-timer", methods=["POST"])
def start_timer():
    data    = request.json
    user_id = data["userId"]
    minutes = int(data.get("minutes", 1))

    if user_id in timers:
        timers[user_id].cancel()

    fires_at = deadline_str(minutes)
    t = Timer(minutes * 60, auto_sos, args=[user_id])
    timers[user_id] = t
    t.start()

    database.log_session(user_id, "timer_started")
    return jsonify({"message": "Safety timer started", "started_at": fmt(now_ist()), "fires_at": fires_at})

@app.route("/check-in", methods=["POST"])
def check_in():
    data    = request.json
    user_id = data["userId"]

    if user_id in timers:
        timers[user_id].cancel()
        del timers[user_id]

    database.insert_alert(user_id, "User checked in safely")
    database.log_session(user_id, "checkin")
    return jsonify({"message": "Timer cancelled — safe!", "checked_in": fmt(now_ist())})

@app.route("/sos", methods=["POST"])
def sos():
    data    = request.json
    user_id = data["userId"]
    lat     = data.get("lat")
    lng     = data.get("lng")

    database.insert_alert(user_id, "SOS button triggered", lat=lat, lng=lng)
    database.log_session(user_id, "sos")

    maps = f"https://maps.google.com/?q={lat},{lng}" if lat else "No location"
    msg  = (
        f"🚨 SOS ALERT — RakshaNet\n"
        f"User    : {user_id}\n"
        f"Time    : {fmt(now_ist())} ({now_ist().strftime('%A')})\n"
        f"Location: {maps}"
    )
    send_email_alert(msg)
    for phone in database.get_contacts(user_id):
        send_sms_alert(msg, phone)

    return jsonify({"message": "SOS sent", "time": fmt(now_ist()), "location": maps})

@app.route("/logs/<user_id>", methods=["GET"])
def logs(user_id):
    return jsonify(database.fetch_alerts_for_user(user_id))

@app.route("/logs/<user_id>/date/<date_str>", methods=["GET"])
def logs_by_date(user_id, date_str):
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Use YYYY-MM-DD format"}), 400
    return jsonify(database.fetch_alerts_by_date(user_id, date_str))

@app.route("/stats/<user_id>", methods=["GET"])
def stats(user_id):
    return jsonify(database.get_user_stats(user_id))

@app.route("/add-contact", methods=["POST"])
def add_contact():
    d = request.json
    database.add_contact(d["userId"], d["phone"])
    return jsonify({"message": "Contact saved", "added_at": fmt(now_ist())})

@app.route("/delete-contact", methods=["POST"])
def delete_contact():
    d = request.json
    database.delete_contact(d["userId"], d["phone"])
    return jsonify({"message": "Contact removed"})

@app.route("/contacts/<user_id>", methods=["GET"])
def get_contacts(user_id):
    contacts = database.get_contacts(user_id)
    return jsonify({"contacts": contacts, "count": len(contacts), "fetched_at": fmt(now_ist())})

# ════════════════════════════════════════
#  CSV EXPORT
#  Uses: csv module + datetime + sqlite3
# ════════════════════════════════════════
@app.route("/export/csv/<user_id>", methods=["GET"])
def export_csv(user_id):
    """
    Export all alerts for a user as a downloadable CSV file.
    
    Demonstrates:
      - csv.writer  to build structured tabular output
      - io.StringIO so we never touch the filesystem
      - datetime.strptime / strftime to reformat timestamps
      - sqlite3 SELECT (via database.fetch_alerts_for_user)
    
    Usage: GET /export/csv/user@email.com
    """
    rows = database.fetch_alerts_for_user(user_id)

    # StringIO acts as an in-memory file — no disk writes needed
    output = io.StringIO()
    writer = csv.writer(output)

    # ── Header row ──
    writer.writerow([
        "No.", "User", "Reason",
        "Date", "Time (IST)",
        "Latitude", "Longitude", "Google Maps Link"
    ])

    # ── Data rows ──
    for idx, row in enumerate(rows, start=1):
        raw  = row.get("time") or row.get("created_at") or ""
        try:
            # Handle both ISO format and DD-MM-YYYY format
            dt       = datetime.fromisoformat(raw) if "T" in raw \
                       else datetime.strptime(raw, "%d-%m-%Y %H:%M:%S")
            date_str = dt.strftime("%d %B %Y")     # 15 June 2025
            time_str = dt.strftime("%I:%M:%S %p")  # 09:45:30 AM
        except Exception:
            date_str, time_str = raw, ""

        lat  = row.get("latitude")  or ""
        lng  = row.get("longitude") or ""
        maps = f"https://maps.google.com/?q={lat},{lng}" if lat and lng else ""

        writer.writerow([idx, user_id, row.get("reason", ""),
                         date_str, time_str, lat, lng, maps])

    # ── Footer metadata ──
    writer.writerow([])
    writer.writerow(["Exported by", "RakshaNet Safety App"])
    writer.writerow(["Export time (IST)", fmt(now_ist())])
    writer.writerow(["Day", now_ist().strftime("%A")])
    writer.writerow(["Total records", len(rows)])

    csv_bytes = output.getvalue().encode("utf-8")
    output.close()

    filename = f"rakshanet_alerts_{now_ist().strftime('%Y%m%d_%H%M')}.csv"

    return Response(
        csv_bytes,
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8",
        }
    )


#  API DOCUMENTATION  (auto-generated)

@app.route("/api-docs")
def api_docs():
    now  = fmt(now_ist())
    base = request.host_url.rstrip("/")

    ENDPOINTS = [
        {"method":"GET",  "path":"/",                              "tag":"Info",      "color":"#4a8eff",
         "desc":"Server status, current IST time, weekday and ISO week number."},
        {"method":"POST", "path":"/start-timer",                   "tag":"Timer",     "color":"#f5a623",
         "desc":"Start a safety timer. Auto-fires SOS + email + SMS if no check-in.",
         "body":'{ "userId": "user@email.com", "minutes": 30 }'},
        {"method":"POST", "path":"/check-in",                      "tag":"Timer",     "color":"#f5a623",
         "desc":"Cancel the active timer — user arrived safely.",
         "body":'{ "userId": "user@email.com" }'},
        {"method":"POST", "path":"/sos",                           "tag":"Emergency", "color":"#e8193c",
         "desc":"Trigger SOS immediately with optional GPS coordinates.",
         "body":'{ "userId": "user@email.com", "lat": 19.076, "lng": 72.877 }'},
        {"method":"GET",  "path":"/logs/{user_id}",                "tag":"Logs",      "color":"#1dd882",
         "desc":"All alerts for a user, newest first (sqlite3 SELECT ORDER BY id DESC)."},
        {"method":"GET",  "path":"/logs/{user_id}/date/YYYY-MM-DD","tag":"Logs",      "color":"#1dd882",
         "desc":"Filter alerts by date. Uses datetime.strptime for validation."},
        {"method":"GET",  "path":"/stats/{user_id}",               "tag":"Stats",     "color":"#a259ff",
         "desc":"Total alerts, today count, this week count, first/last alert, current day & week number."},
        {"method":"POST", "path":"/add-contact",                   "tag":"Contacts",  "color":"#4a8eff",
         "desc":"Save an emergency phone number.",
         "body":'{ "userId": "user@email.com", "phone": "+91XXXXXXXXXX" }'},
        {"method":"POST", "path":"/delete-contact",                "tag":"Contacts",  "color":"#4a8eff",
         "desc":"Remove an emergency contact.",
         "body":'{ "userId": "user@email.com", "phone": "+91XXXXXXXXXX" }'},
        {"method":"GET",  "path":"/contacts/{user_id}",            "tag":"Contacts",  "color":"#4a8eff",
         "desc":"List all saved emergency contacts for a user."},
        {"method":"GET",  "path":"/export/csv/{user_id}",          "tag":"Export",    "color":"#1dd882",
         "desc":"Download all alerts as a CSV file. Uses Python csv module + datetime formatting + sqlite3."},
    ]

    MC = {"GET":"#1dd882","POST":"#f5a623","DELETE":"#e8193c"}

    cards = ""
    for ep in ENDPOINTS:
        mc  = MC.get(ep["method"], "#6e6e82")
        bd  = f'<div class="ep-body"><div class="bl">Request body</div><pre>{ep["body"]}</pre></div>' if ep.get("body") else ""
        try_path = ep["path"].replace("{user_id}","test%40email.com").replace("{YYYY-MM-DD}","2025-06-15")
        tr  = f'<a class="try" href="{base}{try_path}" target="_blank">↗ Try</a>' if ep["method"]=="GET" else ""
        cards += f"""<div class="ep">
  <div class="ep-top">
    <span class="mth" style="background:{mc}22;color:{mc}">{ep["method"]}</span>
    <code class="pth">{ep["path"]}</code>
    <span class="tag" style="border-color:{ep["color"]}44;color:{ep["color"]}">{ep["tag"]}</span>
    {tr}
  </div>
  <div class="dsc">{ep["desc"]}</div>
  {bd}
</div>"""

    return Response(f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<title>API Docs — RakshaNet</title>
<style>
:root{{--bg:#0c0c0e;--card:#17171b;--card2:#1e1e24;--b:rgba(255,255,255,.07);--b2:rgba(255,255,255,.12);--t:#f2f2f6;--m:#6e6e82;--m2:#9898b0}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:var(--bg);color:var(--t);font-family:'Nunito',sans-serif;padding:40px 24px 80px}}
.w{{max-width:780px;margin:0 auto}}
h1{{font-family:'Bebas Neue',sans-serif;font-size:38px;letter-spacing:.05em;margin-bottom:6px}}
.meta{{font-size:12px;color:var(--m);margin-bottom:10px}}
.base{{background:var(--card2);border:1px solid var(--b2);border-radius:10px;padding:10px 16px;
       font-family:monospace;font-size:13px;color:var(--m2);margin-bottom:32px;display:inline-block}}
.base span{{color:#1dd882;font-weight:700}}
.sl{{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--m);
     margin:28px 0 14px;display:flex;align-items:center;gap:10px}}
.sl::after{{content:'';flex:1;height:1px;background:var(--b)}}
.ep{{background:var(--card);border:1px solid var(--b);border-radius:16px;padding:18px 20px;margin-bottom:10px}}
.ep-top{{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}}
.mth{{font-size:11px;font-weight:800;padding:3px 10px;border-radius:6px;letter-spacing:.04em;flex-shrink:0}}
.pth{{font-family:monospace;font-size:13px;color:var(--t);font-weight:600}}
.tag{{font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;border:1px solid;flex-shrink:0}}
.try{{margin-left:auto;font-size:12px;color:#4a8eff;text-decoration:none;font-weight:700}}
.try:hover{{text-decoration:underline}}
.dsc{{font-size:13px;color:var(--m2);line-height:1.55;margin-bottom:6px}}
.ep-body{{background:var(--card2);border-radius:10px;padding:12px 14px;margin-top:8px}}
.bl{{font-size:10px;color:var(--m);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;font-weight:700}}
pre{{font-family:monospace;font-size:12px;color:var(--m2);white-space:pre-wrap}}
.foot{{font-size:11px;color:var(--m);text-align:right;margin-top:28px}}
</style></head>
<body><div class="w">
<h1>RakshaNet API</h1>
<div class="meta">Auto-generated by Flask · SQLite3 backend · {now} IST</div>
<div class="base">Base URL: <span>{base}</span></div>
<div class="sl">All Endpoints ({len(ENDPOINTS)})</div>
{cards}
<div class="foot">Generated {now} IST &nbsp;·&nbsp; RakshaNet v1.0</div>
</div></body></html>""", mimetype="text/html")

# ── Run 
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"🚀 RakshaNet starting on :{port}")
    print(f"🕐 {fmt(now_ist())} IST  |  {now_ist().strftime('%A')}  |  Week {now_ist().isocalendar()[1]}")
    print(f"📖 API Docs: http://localhost:{port}/api-docs")
    app.run(host="0.0.0.0", port=port, debug=False)