import os
import json
import logging
from dotenv import load_dotenv
import google.generativeai as genai

from pathlib import Path

# Explicitly load from backend/.env
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an expert 2D stick-figure animator. 
Your job is to translate a user's action prompt into a JSON array of animation keyframes.
The animation lasts 8 seconds and the timeline goes from t=0.0 to t=1.0. 
You must return only valid JSON, without markdown blocks.

The stick figure uses screen coordinates where Y grows downwards.
- torso_angle: 270 means standing straight up.
- head_tilt: offset from torso (0 is looking straight ahead).
- l_shoulder / r_shoulder: angle offset from torso. Negative is forward/up, positive is back/down depending on convention (usually 0 is resting flat on side, but for this system, negative is up/forward, positive is back).
- l_elbow / r_elbow: elbow bend angle (absolute degrees of bending).
- l_hip / r_hip: leg angle offset from downward.
- l_knee / r_knee: knee bend angle.

It is crucial that you return AT LEAST 3 keyframes (t=0.0, a mid frame, and t=1.0). For a looping animation, t=1.0 should match t=0.0. For continuous motions, interpolate accordingly.

Output ONLY a JSON array of objects. Example:
[
  {"t":0.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-20,"l_elbow":30,"r_shoulder":20, "r_elbow":30,"l_hip":-10,"l_knee":20, "r_hip":10, "r_knee":20},
  {"t":0.5, "torso_angle":270,"head_tilt":10, "l_shoulder":-60,"l_elbow":60,"r_shoulder":60, "r_elbow":60,"l_hip":-30,"l_knee":60, "r_hip":30, "r_knee":60},
  {"t":1.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-20,"l_elbow":30,"r_shoulder":20, "r_elbow":30,"l_hip":-10,"l_knee":20, "r_hip":10, "r_knee":20}
]
"""

def generate_dynamic_keyframes(prompt: str) -> list[dict]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        logger.error("GEMINI_API_KEY not found or invalid in environment.")
        return []
    
    genai.configure(api_key=api_key)

    try:
        model = genai.GenerativeModel('gemini-flash-latest', system_instruction=SYSTEM_PROMPT)
        response = model.generate_content(f"Generate keyframes for action: '{prompt}'")
        
        text = response.text.replace("```json", "").replace("```", "").strip()
        keyframes = json.loads(text)
        
        # Validation
        if not isinstance(keyframes, list) or len(keyframes) < 2:
            return []
            
        for kf in keyframes:
            # check necessary keys
            if "t" not in kf or "torso_angle" not in kf:
                return []
                
        return keyframes
    except Exception as e:
        logger.error(f"Error generating dynamic keyframes via Gemini: {e}")
        return []
