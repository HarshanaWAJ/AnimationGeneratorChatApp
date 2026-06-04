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

from dotenv import load_dotenv
from pathlib import Path

# Load environment variables early
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

import io
import time
import logging
import json
import speech_recognition as sr
from typing import Optional
import os
import cv2
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

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

# Load SentenceTransformer Model
MODEL_DIR = Path(__file__).parent / "model"
DATA_DIR = Path(__file__).parent / "data" / "animations"

logger.info("Loading SentenceTransformer models...")
try:
    model_path = MODEL_DIR / "finetuned_model"
    if model_path.exists():
        embedder = SentenceTransformer(str(model_path))
    else:
        embedder = SentenceTransformer('all-MiniLM-L6-v2')
    
    npz_path = MODEL_DIR / "embeddings.npz"
    data_npz = np.load(str(npz_path))
    train_embeddings = data_npz['X']
    train_labels = data_npz['labels']
    logger.info(f"Loaded {len(train_labels)} embeddings successfully.")
except Exception as e:
    logger.error(f"Error loading LLM models: {e}")
    embedder = None
    train_embeddings = None
    train_labels = None

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
        logger.info(f"[transcribe] Received file: {file.filename}, size: {len(audio_data)} bytes, content_type: {file.content_type}")

        if len(audio_data) == 0:
            logger.error("[transcribe] Empty audio file received")
            raise HTTPException(status_code=400, detail="Empty audio file received")

        # Open as a source for SpeechRecognition (expects PCM WAV)
        with sr.AudioFile(io.BytesIO(audio_data)) as source:
            logger.info(f"[transcribe] Audio source opened — sample_rate={source.SAMPLE_RATE}, channels={source.SAMPLE_WIDTH}")
            # Adjust for ambient noise to improve accuracy
            recognizer.adjust_for_ambient_noise(source, duration=0.3)
            audio = recognizer.record(source)

        logger.info("[transcribe] Sending audio to Google Speech API...")
        text = recognizer.recognize_google(audio)
        logger.info(f"[transcribe] Result: '{text}'")
        return {"text": text}

    except sr.UnknownValueError:
        logger.warning("[transcribe] Speech was unintelligible — Google could not understand the audio")
        return {"text": "", "error": "Speech was unintelligible"}
    except sr.RequestError as e:
        logger.error(f"[transcribe] Google Speech API request failed: {e}")
        raise HTTPException(status_code=503, detail=f"Google Speech API unavailable: {e}")
    except Exception as e:
        logger.error(f"[transcribe] Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


@app.post("/api/animate")
async def animate(req: AnimateRequest):
    if not req.action or not req.action.strip():
        raise HTTPException(status_code=400, detail="Action text cannot be empty")

    user_text = req.action.strip()
    logger.info(f"[animate] Input: {user_text!r}")

    # --- 1. LLM Matcher Logic ---
    if embedder is not None and train_embeddings is not None:
        try:
            emb = embedder.encode([user_text])
            similarities = cosine_similarity(emb, train_embeddings)[0]
            best_idx = np.argmax(similarities)
            best_score = float(similarities[best_idx])
            best_score_rounded = round(best_score, 2)
            
            logger.info(f"[animate] LLM match score: {best_score_rounded:.2f} for label: {train_labels[best_idx]}")
            
            if best_score_rounded >= 0.50:  # >= so that score=0.5 uses existing animation
                pred_label = train_labels[best_idx]
                mp4_path = DATA_DIR / f"{pred_label}.mp4"
                if mp4_path.exists():
                    logger.info(f"[animate] Using existing animation: {mp4_path.name}")
                    t_llm = time.time()
                    
                    # Read MP4 with cv2
                    cap = cv2.VideoCapture(str(mp4_path))
                    frames = []
                    while True:
                        ret, frame = cap.read()
                        if not ret:
                            break
                        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        frames.append(frame_rgb)
                    cap.release()
                    
                    logger.info(f"[animate] Read {len(frames)} frames from {mp4_path.name}")
                    
                    if frames:
                        # Convert to GIF
                        gif_bytes = frames_to_gif(
                            frames,
                            output_size=(req.output_width, req.output_height)
                        )
                        logger.info(f"[animate] LLM MP4->GIF export: {time.time() - t_llm:.2f}s — size: {len(gif_bytes)/1024:.1f} KB")
                        
                        return Response(
                            content=gif_bytes,
                            media_type="image/gif",
                            headers={
                                "X-Action": pred_label,
                                "X-Confidence": str(best_score),
                                "X-Source": "llm-existing",
                            }
                        )
                else:
                    logger.warning(f"[animate] File {mp4_path} not found. Falling back to backend generation.")
            else:
                logger.info(f"[animate] LLM score too low ({best_score_rounded:.2f} < 0.50). Falling back to backend generation.")
        except Exception as e:
            logger.error(f"[animate] LLM matcher error: {e}. Falling back to backend generation.")

    # --- 2. Fallback: Procedural Backend Generation ---
    # Per requirements: if 1st classification fails, must generate new animations.
    action = "dynamic"
    confidence = 1.0
    display_text = extract_display_text(user_text)
    logger.info(f"[animate] Forcing new animation generation (action='dynamic')")

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
