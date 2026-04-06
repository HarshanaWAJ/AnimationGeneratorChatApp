"""
FastAPI Backend — Main Entry Point

POST /api/animate
  Body: { "action": "user text input" }
  Returns: GIF binary stream (image/gif)

GET /api/health
  Returns: { "status": "ok" }

GET /api/actions
  Returns: list of supported action labels
"""

import io
import time
import logging
import speech_recognition as sr
from typing import Optional

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel

from backend.nlp.classifier import classify_action, extract_display_text, get_all_states
from backend.animation.poses import generate_all_frames, TOTAL_FRAMES, _body_rotation_deg, POSE_KEYFRAMES
from backend.animation.renderer import render_frame
from backend.animation.gif_exporter import frames_to_gif
from backend.nlp.gemini_generator import generate_dynamic_keyframes

# Initialize Recognizer
recognizer = sr.Recognizer()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Antigravity Stick Figure Animator",
    description="NLP-driven 2D stick figure animation generator",
    version="1.0.0",
)

# ── CORS — allow React dev server ────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnimateRequest(BaseModel):
    action: str
    output_width:  Optional[int] = 500
    output_height: Optional[int] = 500


@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}


@app.get("/api/actions")
async def list_actions():
    return {"actions": get_all_states()}


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    try:
        # Read WAV file bytes
        audio_data = await file.read()
        
        # Open as a source for SpeechRecognition
        with sr.AudioFile(io.BytesIO(audio_data)) as source:
            audio = recognizer.record(source)
            
        # Transcribe using Google (Free)
        text = recognizer.recognize_google(audio)
        logger.info(f"[transcribe] Result: {text}")
        
        return {"text": text}
    except sr.UnknownValueError:
        logger.warning("[transcribe] Speech was unintelligible")
        return {"text": "", "error": "Speech was unintelligible"}
    except Exception as e:
        logger.error(f"[transcribe] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/animate")
async def animate(req: AnimateRequest):
    if not req.action or not req.action.strip():
        raise HTTPException(status_code=400, detail="Action text cannot be empty")

    user_text = req.action.strip()
    logger.info(f"[animate] Input: {user_text!r}")

    # 1. Classify action
    action, confidence = classify_action(user_text)
    display_text = extract_display_text(user_text)
    logger.info(f"[animate] Classified as: {action} (confidence={confidence:.2f})")

    if action == "dynamic":
        logger.info("[animate] Action 'dynamic' chosen. Generating keyframes with Gemini...")
        dynamic_keys = generate_dynamic_keyframes(user_text)
        if dynamic_keys:
            POSE_KEYFRAMES["dynamic"] = dynamic_keys
        else:
            logger.warning("[animate] Gemini failed to generate valid keyframes. Falling back to idle.")
            action = "idle"

    # 2. Generate all 192 frame joint states
    t0 = time.time()
    joint_states = generate_all_frames(action)
    logger.info(f"[animate] Pose generation: {time.time() - t0:.2f}s")

    # 3. Render all frames to numpy arrays
    t1 = time.time()
    rendered_frames = []
    trail_window = 6

    for i, js in enumerate(joint_states):
        # Build trail history (last N states before current)
        trail_start = max(0, i - trail_window)
        trail_history = joint_states[trail_start:i]  # oldest first
        trail_history = list(reversed(trail_history))  # newest first for alpha indexing

        rotation = _body_rotation_deg(i, TOTAL_FRAMES)

        frame_arr = render_frame(
            js=js,
            trail_history=trail_history,
            speech_text=display_text,
            frame=i,
            action=action,
            body_rotation_deg=rotation,
        )
        rendered_frames.append(frame_arr)

        if i % 24 == 0:
            logger.info(f"[animate] Rendered frame {i}/{TOTAL_FRAMES}")

    logger.info(f"[animate] Frame rendering: {time.time() - t1:.2f}s")

    # 4. Export GIF
    t2 = time.time()
    gif_bytes = frames_to_gif(
        rendered_frames,
        output_size=(req.output_width, req.output_height)
    )
    logger.info(f"[animate] GIF export: {time.time() - t2:.2f}s — size: {len(gif_bytes)/1024:.1f} KB")

    return Response(
        content=gif_bytes,
        media_type="image/gif",
        headers={
            "X-Action":     action,
            "X-Confidence": str(confidence),
            "X-Frames":     str(TOTAL_FRAMES),
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
