"""
Quick smoke test — verifies the core pipeline without starting the server.
Run from project root:
  .\\venv\\Scripts\\python.exe test_pipeline.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

print("1. Testing NLP classifier...")
from backend.nlp.classifier import classify_action, extract_display_text

tests = [
    ("jumping high",       "jump"),
    ("Go to the hell",     "idle"),
    ("dancing wildly",     "dance"),
    ("spinning around",    "spin"),
    ("wave hello",         "wave"),
    ("run as fast as you can", "run"),
    ("floating in space",  "float"),
    ("xyzqwerty",          "idle"),
]
all_pass = True
for text, expected in tests:
    action, conf = classify_action(text)
    status = "✅" if action == expected else "❌"
    if action != expected:
        all_pass = False
    print(f"  {status} '{text}' → {action} ({conf:.2f})  [expected: {expected}]")

print()
print("2. Testing skeleton FK...")
from backend.animation.skeleton import build_joint_state
import numpy as np
js = build_joint_state(
    hip=np.array([400.0, 400.0]),
    torso_angle=270, head_tilt=0,
    l_shoulder_angle=-20, l_elbow_angle=30,
    r_shoulder_angle=20,  r_elbow_angle=30,
    l_hip_angle=0, l_knee_angle=15,
    r_hip_angle=0, r_knee_angle=15,
)
print(f"  ✅ Hip: {js.hip}, Head: {js.head.round(1)}, Hand_L: {js.hand_l.round(1)}")

print()
print("3. Testing pose generation (all frames)...")
from backend.animation.poses import generate_all_frames, TOTAL_FRAMES
states = generate_all_frames("jump")
print(f"  ✅ Generated {len(states)} frames (expected {TOTAL_FRAMES})")
assert len(states) == TOTAL_FRAMES

print()
print("4. Testing renderer (first frame only)...")
from backend.animation.renderer import render_frame
trail = states[:6][::-1]
frame_arr = render_frame(states[0], trail, "jumping high!", frame=0, body_rotation_deg=0)
print(f"  ✅ Frame shape: {frame_arr.shape}  dtype: {frame_arr.dtype}")
assert frame_arr.shape == (800, 800, 3)

print()
print("5. Testing GIF export (5 frames)...")
from backend.animation.gif_exporter import frames_to_gif
import time
t0 = time.time()
gif_bytes = frames_to_gif([frame_arr] * 5, output_size=(200, 200))
elapsed = time.time() - t0
print(f"  ✅ GIF size: {len(gif_bytes)//1024} KB  ({elapsed:.2f}s)")
assert len(gif_bytes) > 1000

print()
if all_pass:
    print("🎉 All tests passed! Ready to run servers.")
else:
    print("⚠️  Some NLP tests failed — check classifier.py")
