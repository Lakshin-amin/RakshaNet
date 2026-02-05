# --- EMAIL SETTINGS ---
EMAIL_ENABLED = True

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

SENDER_EMAIL = "abc@gmail.com" 
SENDER_PASSWORD = "abcd efgh ijklm nopqr"  # use App Password if 2FA is enabled

RECEIVER_EMAIL = "abc@gmail.com"


# --- SMS SETTINGS (TWILIO) --- 
SMS_ENABLED = False   # turn True only when ready

TWILIO_ACCOUNT_SID = "your_sid"
TWILIO_AUTH_TOKEN = "your_auth_token"

TWILIO_PHONE_NUMBER = "+1234567890"
RECEIVER_PHONE_NUMBER = "+91xxxxxxxxxx"   # only your own verified number
