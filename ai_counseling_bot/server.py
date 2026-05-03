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
    user_input = data.get("message", "")
    history = data.get("history", [])
    risk_level = detect_risk(user_input)

    if risk_level == "high":
        reply = (
            "I'm really sorry you're feeling this much pain. You matter, and you're not alone.\n\n"
            f"{EMERGENCY_CONTACTS}\n\n"
            "Please contact local emergency services or go to the nearest hospital right away."
        )
    else:
        reply = generate_response(user_input, risk_level=risk_level, history=history)

    return jsonify({"reply": reply})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=5001)