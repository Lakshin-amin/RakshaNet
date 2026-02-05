import smtplib
from email.message import EmailMessage
from twilio.rest import Client

from config import *


# --- EMAIL ALERT ---
def send_email_alert(message):
    if not EMAIL_ENABLED:
        return

    try:
        msg = EmailMessage()
        msg["Subject"] = "🚨 RakshaNet Safety Alert"
        msg["From"] = SENDER_EMAIL
        msg["To"] = RECEIVER_EMAIL
        msg.set_content(message)

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()

        print("✅ Email alert sent successfully")

    except Exception as e:
        print("❌ Email failed:", e)


# --- SMS ALERT --- 
def send_sms_alert(message):
    if not SMS_ENABLED:
        return

    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        sms = client.messages.create(
            body=message,
            from_= +911234567890,  # replace with your Twilio number
            to= +911234567890  # replace with your verified phone number
        )

        print("✅ SMS sent:", sms.sid)

    except Exception as e:
        print("❌ SMS failed:", e)
