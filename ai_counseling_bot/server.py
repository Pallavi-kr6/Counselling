from flask import Flask, request, jsonify
from dotenv import load_dotenv
from flask_cors import CORS
import os
from groq import Groq
from app import generate_response, detect_risk, EMERGENCY_CONTACTS

# Create Flask app
app = Flask(__name__)
CORS(app)

# Load environment variables
load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
print("Loaded key:", api_key)

client = Groq(api_key=api_key)







@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_input = data.get("message")

    # Basic risk detection for HTTP API (mirrors app.py logic)
    risk_level = detect_risk(user_input or "")

    if risk_level == "high":
        reply = (
            "I'm really sorry you're feeling this much pain. You matter, and you’re not alone.\n\n"
            "I’m not a replacement for a professional, but I strongly encourage you to reach out "
            "to a trusted counselor or mental health professional as soon as possible.\n\n"
            f"{EMERGENCY_CONTACTS}\n\n"
            "If you are in immediate danger or feel you might harm yourself, please contact local "
            "emergency services or go to the nearest hospital right away."
        )
    else:
        reply = generate_response(user_input, risk_level=risk_level)

    return jsonify({"reply": reply})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)