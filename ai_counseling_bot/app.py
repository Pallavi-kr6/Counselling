import streamlit as st
import csv
from pathlib import Path

from groq import Groq 
import os
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


st.set_page_config(page_title="AI Counseling Assistant", layout="centered")

st.markdown("##AI Counseling Assistant")
st.caption("Confidential • Empathetic • First-level student support")
st.divider()

st.markdown("""
<style>
[data-testid="stChatMessage"] {
    border-radius: 12px;
    padding: 8px;
}
</style>
""", unsafe_allow_html=True)

# Chat Memory
if "messages" not in st.session_state:
    st.session_state.messages = []


#Loading Mental Health FAQ Dataset
@st.cache_data
def load_faq_dataset():
    faq = []
    path = Path("data/mental_health_faq.csv")
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            faq.append(row)
    return faq

faq_data = load_faq_dataset()

def retrieve_relevant_faq(user_input):
    user_input = user_input.lower()
    for item in faq_data:
        if any(word in user_input for word in item["question"].lower().split()):
            return item["answer"]
    return None


@st.cache_data
def load_public_resources():
    path = Path("data/public_resources.txt")
    return path.read_text(encoding="utf-8")

public_knowledge = load_public_resources()


#Loading Scraped Government / Public Health Data 
@st.cache_data
def load_gov_health_data():
    path = Path("data/gov_health.txt")
    return path.read_text(encoding="utf-8")

gov_health_data = load_gov_health_data()


# Local college emergency / counselling contacts
EMERGENCY_CONTACTS = """
If you are a student at this college and need urgent support, please reach out to the official counselling faculty:

1. Dr. V. M. Gayathri – Associate Professor
   Email: gvarathm@srmist.edu.in
   Room No: TP2 – 916
   Mobile: 9672938751

2. Dr. A. Helen Victoria – Associate Professor
   Email: helenvia@srmist.edu.in
   Room No: TP2 – 910
   Mobile: 9790836572

3. Dr. P. Supraja – Associate Professor
   Email: suprajasp@srmist.edu.in
   Room No: Value Education Cell, UB 4th Floor
   Mobile: 9786331333

4. Dr. A. Arun – Associate Professor
   Email: aruna2@srmist.edu.in
   Room No: TP406a
   Mobile: 9884011783

5. Dr. Lakshmi Narayanan K – Associate Professor
   Email: lakshmir4@srmist.edu.in
   Room No: TP406a
   Mobile: 9790408011

6. Dr. M. Vaishnavi Moorthy – Associate Professor
   Email: vaishnam@srmist.edu.in
   Room No: TP1506a
   Mobile: 9952066681
"""

def chunk_text(text, chunk_size=400):
    lines = text.split("\n")
    chunks = []
    current_chunk = ""

    for line in lines:
        if line.startswith("SOURCE:") or line.strip() == "":
            continue

        current_chunk += line + " "

        if len(current_chunk) >= chunk_size:
            chunks.append(current_chunk.strip())
            current_chunk = ""

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


gov_chunks = chunk_text(gov_health_data)




def retrieve_gov_guidance(user_input, max_chunks=2):
    user_input = user_input.lower()
    matched = []

    for chunk in gov_chunks:
        if any(word in chunk.lower() for word in user_input.split()):
            matched.append(chunk)

        if len(matched) >= max_chunks:
            break

    return "\n".join(matched)




# User Context
if "user_context" not in st.session_state:
    st.session_state.user_context = {
        "academic_focus": None,
        "current_concern": None,
        "risk_level": "low",
        "conversation_summary": ""
    }


def update_user_context(text, risk):
    ctx = st.session_state.user_context
    text_lower = text.lower()

    if "exam" in text_lower or "study" in text_lower:
        ctx["academic_focus"] = "exams"

    if risk in ["medium", "high"]:
        ctx["current_concern"] = "emotional stress"

    ctx["risk_level"] = risk



#Tone Detection
def detect_risk(text):
    text = text.lower()

    high_risk = [
        "suicide", "kill myself", "end my life",
        "worthless", "no reason to live", "can't go on"
    ]

    medium_risk = [
        "anxious", "depressed", "overwhelmed",
        "panic", "burnout", "stressed"
    ]

    if any(word in text for word in high_risk):
        return "high"
    elif any(word in text for word in medium_risk):
        return "medium"
    else:
        return "low"
    

def detect_emotion_conflict(text):
    text = text.lower()

    positive = ["happy", "relieved", "excited", "okay", "fine", "good"]
    negative = ["sad", "anxious", "stressed", "empty", "overwhelmed", "low"]

    has_positive = any(word in text for word in positive)
    has_negative = any(word in text for word in negative)

    if has_positive and has_negative:
        return True
    return False








def analyze_emotion_intent(text):
    prompt = f"""
Classify the student's message.

Return ONLY in this format:
Emotion: happy | neutral | stressed | anxious | sad | distressed
Intent: academic | emotional | career | casual

Message:
"{text}"
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.75,
        frequency_penalty=0.6
    )

    return response.choices[0].message.content



# LLM Response
def generate_response(user_input, risk_level, history=[]):

    if risk_level == "high":
        return (
            "I'm really sorry you're feeling this much pain. You matter, and you’re not alone.\n\n"
            "I’m not a replacement for a professional, but I strongly encourage you to reach out "
            "to a trusted counselor or mental health professional as soon as possible.\n\n"
            f"{EMERGENCY_CONTACTS}\n\n"
            "If you are in immediate danger or feel you might harm yourself, please contact local "
            "emergency services or go to the nearest hospital right away."
        )
    
    emotion_conflict = detect_emotion_conflict(user_input)
    # emotion_data = analyze_emotion_intent(user_input)
    emotion_data = "stressed" if risk_level == "medium" else "distressed" if risk_level == "high" else "neutral"


    ctx = {
        "academic_focus": next((m["content"] for m in history if "exam" in m.get("content","").lower()), None),
        "current_concern": "emotional stress" if risk_level in ["medium","high"] else None,
        "risk_level": risk_level
    }
    faq_snippet = retrieve_relevant_faq(user_input)
    gov_guidance = retrieve_gov_guidance(user_input)

    grounding_text = ""

    if faq_snippet:
        grounding_text += f"\nMental Health FAQ Guidance:\n- {faq_snippet}\n"

    if gov_guidance:
        grounding_text += f"""
Authoritative Public Health Guidance (Scraped):
{gov_guidance}
"""

    grounding_text += f"""
Additional Public Resources:
{public_knowledge}

Local college emergency contacts:
{EMERGENCY_CONTACTS}
"""
    
    if emotion_conflict:
        grounding_text += """
    Note: The user's message contains mixed or conflicting emotions.
    Respond by acknowledging both emotions and gently inviting clarification.
    """



    system_prompt = f"""
You are an AI-powered counseling assistant for students.

STRICT RULES:
- Use ONLY the provided context and grounding information.
- Do NOT invent facts or medical advice.
- Do NOT diagnose.
- If unsure, ask the user.
- Validate emotions before giving guidance.
- Remember everything the user shares in this conversation including their name, subject, and concerns.
- Never repeat a response you already gave. Vary your wording and follow up on prior messages.
- Keep replies to 2-3 sentences unless the situation requires more. Ask only ONE question at a time.

You are a compassionate AI counselling assistant for students. You must NEVER respond to abusive, profane, or offensive language — instead, gently remind the student to maintain respectful communication. If a student expresses thoughts related to self-harm, suicide, hopelessness, or crisis, do NOT engage further on the topic. Immediately respond with: "I care about your wellbeing. I'm alerting a counsellor right now — please hold on, help is on the way." Then trigger an emergency alert internally.

Known User Context:
- Academic focus: {ctx['academic_focus']}
- Current concern: {ctx['current_concern']}
- Risk level: {ctx['risk_level']}
Detected emotion/intent: {emotion_data}
"""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-10:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": user_input})
    # Move grounding to a separate final user-turn note so it doesn't bury the rules:
    messages.append({"role": "system", "content": f"[Context reminder] {grounding_text[:800]}"})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.75,
        frequency_penalty=0.6
    )

    return response.choices[0].message.content






# Chat Interface
if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

user_input = st.chat_input("Share what's on your mind...")

if user_input:
    with st.chat_message("user"):
        st.markdown(user_input)

    st.session_state.messages.append(
        {"role": "user", "content": user_input}
    )

    risk = detect_risk(user_input)
    update_user_context(user_input, risk)

    reply = generate_response(user_input, risk, history=st.session_state.messages)

    st.session_state.messages.append(
        {"role": "assistant", "content": reply}
    )

    with st.chat_message("assistant"):
        st.markdown(reply)

    gov_used = retrieve_gov_guidance(user_input)
    with st.expander("Public Health Guidance Used"):
        if gov_used:
            st.text(gov_used)
        else:
            st.text("No directly relevant public health guidance retrieved.")
