"""
Pose Library + Physics Layer
Defines keyframe poses for all actions AND emotions, then applies:
  - Antigravity liftoff curve (root Y)
  - Body tilt (torso lean 15° back during ascent)
  - 360° body rotation over 8 seconds
  - Smooth cubic interpolation between keyframes

Supported states: jump, run, dance, spin, wave, walk, float, stretch,
                  happy, sad, angry, excited, scared, surprised, tired,
                  confused, proud, bored, love, nervous, celebrate,
                  cry, laugh, think, panic, meditate, idle
"""

import numpy as np
from typing import List
from .skeleton import JointState, build_joint_state, ROOT_GROUND

TOTAL_FRAMES = 192   # 8s × 24fps
FPS = 24


# ─── Helpers ────────────────────────────────────────────────────────────────

def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _ease_in_out(t: float) -> float:
    """Cubic ease-in-out."""
    return t * t * (3 - 2 * t)


def _ease_out_back(t: float) -> float:
    """Overshoots then settles — good for happy/celebrate."""
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def _interpolate_pose(keyframes: list, t: float) -> dict:
    """Interpolate between keyframes for time t ∈ [0, 1]."""
    if t <= keyframes[0]["t"]:
        return keyframes[0]
    if t >= keyframes[-1]["t"]:
        return keyframes[-1]
    for i in range(len(keyframes) - 1):
        k0, k1 = keyframes[i], keyframes[i + 1]
        if k0["t"] <= t <= k1["t"]:
            local_t = (t - k0["t"]) / (k1["t"] - k0["t"])
            local_t = _ease_in_out(local_t)
            return {key: _lerp(k0[key], k1[key], local_t)
                    for key in k0 if key != "t"}
    return keyframes[-1]


# ─── Physics helpers ─────────────────────────────────────────────────────────

def _antigravity_y_offset(frame: int, action: str, total: int = TOTAL_FRAMES) -> float:
    """
    Upward displacement in pixels, now action-dependent.
    0-12%: liftoff  |  12-75%: float+oscillation  |  75-88%: descend  |  88-100%: bounce-settle
    """
    # ── 1. Define max lift based on action type ──
    if action in ["jump", "celebrate", "excited", "panic", "dance", "surprised", "cry", "laugh"]:
        max_lift = 120.0
    elif action in ["float", "meditate", "climb"]:
        max_lift = 140.0   # Sustained high float
    elif action in ["run", "walk", "stretch", "happy", "sad", "tired", "bored", "lift"]:
        max_lift = 35.0    # Lower-G "grounded" feel
    elif action in ["idle", "think", "confused", "nervous", "proud", "love", "eat", "toast", "gesturing", "offer", "steer"]:
        max_lift = 12.0    # Subtle breathing-like lift
    elif action in ["sleep", "sit", "desk_work", "scrub"]:
        max_lift = 0.0     # Completely grounded
    else:
        max_lift = 20.0

    t = frame / total
    
    # Persistent high-float logic
    if action in ["float", "meditate"]:
        if t < 0.12: return max_lift * _ease_in_out(t / 0.12)
        osc = np.sin((t - 0.12) / 0.88 * 4 * np.pi) * 10
        return max_lift + osc

    # Standard liftoff-return curve
    if t < 0.12:
        return max_lift * _ease_in_out(t / 0.12)
    elif t < 0.75:
        osc = np.sin((t - 0.12) / 0.63 * 2 * np.pi) * (max_lift * 0.08)
        return max_lift + osc
    elif t < 0.88:
        return max_lift * (1 - _ease_in_out((t - 0.75) / 0.13))
    else:
        bounce_t = (t - 0.88) / 0.12
        return (max_lift * 0.05) * np.sin(bounce_t * np.pi) * (1 - bounce_t)


def _body_tilt_degrees(frame: int, action: str, total: int = TOTAL_FRAMES) -> float:
    """Lean back/forward during action, settle to gentle sway."""
    # ── 1. Define base tilt based on action type ──
    if action in ["jump", "surprised", "excited", "panic", "celebrate"]:
        max_tilt = 15.0     # Lean back
    elif action in ["run", "walk"]:
        max_tilt = -12.0    # Lean forward into momentum
    elif action == "sad":
        max_tilt = 8.0      # Slump
    else:
        max_tilt = 0.0      # Neutral

    t = frame / total
    if t < 0.12:
        return max_tilt * _ease_in_out(t / 0.12)
    elif t < 0.25:
        return max_tilt
    elif t < 0.40:
        return max_tilt * (1 - _ease_in_out((t - 0.25) / 0.15))
    else:
        return 2 * np.sin(t * 4 * np.pi) * max(0.0, 1 - t)


def _body_rotation_deg(frame: int, total: int = TOTAL_FRAMES) -> float:
    """Full 360° CCW rotation over the 8-second loop."""
    return -360 * (frame / total)


def _locomotion_bobbing(frame: int, action: str, total: int = TOTAL_FRAMES) -> float:
    """High-frequency vertical oscillation to simulate steps."""
    t = frame / total
    if action == "run":
        # 8 steps per cycle
        return 10 * np.abs(np.sin(t * 8 * np.pi))
    elif action == "walk":
        # 4 steps per cycle
        return 8 * np.abs(np.sin(t * 4 * np.pi))
    return 0.0


# ─── Pose Keyframe Library ────────────────────────────────────────────────────
# Keys per keyframe:
#   t            : float  0.0–1.0
#   torso_angle  : degrees  (270 = straight up in screen-y-down coords)
#   head_tilt    : degrees offset from torso direction
#   l_shoulder   : left shoulder angle offset from torso axis
#   l_elbow      : elbow bend angle
#   r_shoulder   : right shoulder angle offset
#   r_elbow      : right elbow bend
#   l_hip        : left hip angle offset from downward
#   l_knee       : left knee bend
#   r_hip        : right hip angle offset
#   r_knee       : right knee bend

POSE_KEYFRAMES: dict[str, list[dict]] = {

    # ── idle ─────────────────────────────────────────────────────────────────
    "idle": [
        {"t":0.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-15,"l_elbow":20,"r_shoulder":15, "r_elbow":20,"l_hip":-8, "l_knee":10,"r_hip":8,  "r_knee":10},
        {"t":0.5, "torso_angle":270,"head_tilt":5,  "l_shoulder":-10,"l_elbow":15,"r_shoulder":10, "r_elbow":15,"l_hip":-5, "l_knee":8, "r_hip":5,  "r_knee":8},
        {"t":1.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-15,"l_elbow":20,"r_shoulder":15, "r_elbow":20,"l_hip":-8, "l_knee":10,"r_hip":8,  "r_knee":10},
    ],

    # ── eat / drink ──────────────────────────────────────────────────────────
    "eat": [
        {"t":0.0, "torso_angle":270,"head_tilt":5, "l_shoulder":-10,"l_elbow":20,"r_shoulder":-45,"r_elbow":120,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.4, "torso_angle":272,"head_tilt":-5, "l_shoulder":-15,"l_elbow":15,"r_shoulder":-30,"r_elbow":40,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.8, "torso_angle":270,"head_tilt":5, "l_shoulder":-10,"l_elbow":20,"r_shoulder":-45,"r_elbow":120,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":1.0, "torso_angle":270,"head_tilt":5, "l_shoulder":-10,"l_elbow":20,"r_shoulder":-45,"r_elbow":120,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
    ],

    # ── toast ────────────────────────────────────────────────────────────────
    "toast": [
        {"t":0.0, "torso_angle":268,"head_tilt":-10,"l_shoulder":-15,"l_elbow":10,"r_shoulder":-120,"r_elbow":20,"l_hip":-5,"l_knee":5,"r_hip":5,"r_knee":5},
        {"t":0.5, "torso_angle":265,"head_tilt":-15,"l_shoulder":-20,"l_elbow":5, "r_shoulder":-130,"r_elbow":10,"l_hip":-8,"l_knee":8,"r_hip":8,"r_knee":8},
        {"t":1.0, "torso_angle":268,"head_tilt":-10,"l_shoulder":-15,"l_elbow":10,"r_shoulder":-120,"r_elbow":20,"l_hip":-5,"l_knee":5,"r_hip":5,"r_knee":5},
    ],

    # ── scrub (wash/clean/build) ─────────────────────────────────────────────
    "scrub": [
        {"t":0.0, "torso_angle":275,"head_tilt":15,"l_shoulder":-50,"l_elbow":80,"r_shoulder":50,"r_elbow":80,"l_hip":10,"l_knee":15,"r_hip":-10,"r_knee":15},
        {"t":0.25,"torso_angle":277,"head_tilt":15,"l_shoulder":-60,"l_elbow":40,"r_shoulder":30,"r_elbow":100,"l_hip":12,"l_knee":20,"r_hip":-8,"r_knee":20},
        {"t":0.5, "torso_angle":275,"head_tilt":15,"l_shoulder":-50,"l_elbow":80,"r_shoulder":50,"r_elbow":80,"l_hip":10,"l_knee":15,"r_hip":-10,"r_knee":15},
        {"t":0.75,"torso_angle":273,"head_tilt":15,"l_shoulder":-30,"l_elbow":100,"r_shoulder":60,"r_elbow":40,"l_hip":8,"l_knee":10,"r_hip":-12,"r_knee":10},
        {"t":1.0, "torso_angle":275,"head_tilt":15,"l_shoulder":-50,"l_elbow":80,"r_shoulder":50,"r_elbow":80,"l_hip":10,"l_knee":15,"r_hip":-10,"r_knee":15},
    ],

    # ── sleep (horizontal) ───────────────────────────────────────────────────
    "sleep": [
        {"t":0.0, "torso_angle":180,"head_tilt":0,"l_shoulder":10,"l_elbow":10,"r_shoulder":10,"r_elbow":10,"l_hip":0,"l_knee":0,"r_hip":0,"r_knee":0},
        {"t":0.5, "torso_angle":180,"head_tilt":5,"l_shoulder":15,"l_elbow":15,"r_shoulder":15,"r_elbow":15,"l_hip":0,"l_knee":0,"r_hip":0,"r_knee":0},
        {"t":1.0, "torso_angle":180,"head_tilt":0,"l_shoulder":10,"l_elbow":10,"r_shoulder":10,"r_elbow":10,"l_hip":0,"l_knee":0,"r_hip":0,"r_knee":0},
    ],

    # ── desk_work (study/read/write) ─────────────────────────────────────────
    "desk_work": [
        {"t":0.0, "torso_angle":280,"head_tilt":15,"l_shoulder":-45,"l_elbow":90,"r_shoulder":45,"r_elbow":90,"l_hip":80,"l_knee":90,"r_hip":80,"r_knee":90},
        {"t":0.5, "torso_angle":282,"head_tilt":18,"l_shoulder":-40,"l_elbow":85,"r_shoulder":50,"r_elbow":95,"l_hip":80,"l_knee":90,"r_hip":80,"r_knee":90},
        {"t":1.0, "torso_angle":280,"head_tilt":15,"l_shoulder":-45,"l_elbow":90,"r_shoulder":45,"r_elbow":90,"l_hip":80,"l_knee":90,"r_hip":80,"r_knee":90},
    ],

    # ── gesturing (talk/explain) ─────────────────────────────────────────────
    "gesturing": [
        {"t":0.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-45,"l_elbow":60,"r_shoulder":45,"r_elbow":60,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.3, "torso_angle":268,"head_tilt":-5, "l_shoulder":-60,"l_elbow":30,"r_shoulder":30,"r_elbow":80,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.6, "torso_angle":272,"head_tilt":5,  "l_shoulder":-30,"l_elbow":80,"r_shoulder":60,"r_elbow":30,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":1.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-45,"l_elbow":60,"r_shoulder":45,"r_elbow":60,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
    ],

    # ── offer (give/take/buy) ────────────────────────────────────────────────
    "offer": [
        {"t":0.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-60,"l_elbow":20,"r_shoulder":60,"r_elbow":20,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.5, "torso_angle":272,"head_tilt":5,  "l_shoulder":-65,"l_elbow":10,"r_shoulder":65,"r_elbow":10,"l_hip":-8,"l_knee":12,"r_hip":8,"r_knee":12},
        {"t":1.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-60,"l_elbow":20,"r_shoulder":60,"r_elbow":20,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
    ],

    # ── steer (drive/ride) ───────────────────────────────────────────────────
    "steer": [
        {"t":0.0, "torso_angle":275,"head_tilt":0,  "l_shoulder":-60,"l_elbow":70,"r_shoulder":60,"r_elbow":70,"l_hip":80,"l_knee":80,"r_hip":80,"r_knee":80},
        {"t":0.3, "torso_angle":275,"head_tilt":-5, "l_shoulder":-70,"l_elbow":60,"r_shoulder":50,"r_elbow":80,"l_hip":80,"l_knee":80,"r_hip":80,"r_knee":80},
        {"t":0.6, "torso_angle":275,"head_tilt":5,  "l_shoulder":-50,"l_elbow":80,"r_shoulder":70,"r_elbow":60,"l_hip":80,"l_knee":80,"r_hip":80,"r_knee":80},
        {"t":1.0, "torso_angle":275,"head_tilt":0,  "l_shoulder":-60,"l_elbow":70,"r_shoulder":60,"r_elbow":70,"l_hip":80,"l_knee":80,"r_hip":80,"r_knee":80},
    ],

    # ── climb ────────────────────────────────────────────────────────────────
    "climb": [
        {"t":0.0, "torso_angle":270,"head_tilt":-20,"l_shoulder":-140,"l_elbow":30,"r_shoulder":60, "r_elbow":50,"l_hip":-40,"l_knee":60, "r_hip":30, "r_knee":10},
        {"t":0.5, "torso_angle":268,"head_tilt":-25,"l_shoulder":-60, "l_elbow":50,"r_shoulder":140,"r_elbow":30,"l_hip":-30,"l_knee":10, "r_hip":40, "r_knee":60},
        {"t":1.0, "torso_angle":270,"head_tilt":-20,"l_shoulder":-140,"l_elbow":30,"r_shoulder":60, "r_elbow":50,"l_hip":-40,"l_knee":60, "r_hip":30, "r_knee":10},
    ],

    # ── lift (exercise/push) ─────────────────────────────────────────────────
    "lift": [
        {"t":0.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-150,"l_elbow":10,"r_shoulder":150,"r_elbow":10,"l_hip":-10,"l_knee":5, "r_hip":10, "r_knee":5},
        {"t":0.5, "torso_angle":275,"head_tilt":10, "l_shoulder":-90, "l_elbow":90,"r_shoulder":90, "r_elbow":90,"l_hip":-30,"l_knee":60,"r_hip":30, "r_knee":60},
        {"t":1.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-150,"l_elbow":10,"r_shoulder":150,"r_elbow":10,"l_hip":-10,"l_knee":5, "r_hip":10, "r_knee":5},
    ],

    # ── sit ──────────────────────────────────────────────────────────────────
    "sit": [
        {"t":0.0, "torso_angle":270,"head_tilt":0,"l_shoulder":-15,"l_elbow":30,"r_shoulder":15,"r_elbow":30,"l_hip":90,"l_knee":90,"r_hip":90,"r_knee":90},
        {"t":0.5, "torso_angle":272,"head_tilt":2,"l_shoulder":-10,"l_elbow":25,"r_shoulder":10,"r_elbow":25,"l_hip":90,"l_knee":90,"r_hip":90,"r_knee":90},
        {"t":1.0, "torso_angle":270,"head_tilt":0,"l_shoulder":-15,"l_elbow":30,"r_shoulder":15,"r_elbow":30,"l_hip":90,"l_knee":90,"r_hip":90,"r_knee":90},
    ],

    # ── jump ─────────────────────────────────────────────────────────────────
    "jump": [
        {"t":0.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-20,"l_elbow":30,"r_shoulder":20, "r_elbow":30,"l_hip":-10,"l_knee":20, "r_hip":10, "r_knee":20},
        {"t":0.1, "torso_angle":270,"head_tilt":10, "l_shoulder":-10,"l_elbow":60,"r_shoulder":10, "r_elbow":60,"l_hip":-30,"l_knee":60, "r_hip":30, "r_knee":60}, # SQUASH
        {"t":0.25,"torso_angle":270,"head_tilt":-10,"l_shoulder":-70,"l_elbow":10,"r_shoulder":70, "r_elbow":10,"l_hip":15, "l_knee":-20,"r_hip":-15,"r_knee":-20},# STRETCH
        {"t":0.45,"torso_angle":268,"head_tilt":-20,"l_shoulder":-80,"l_elbow":5, "r_shoulder":80, "r_elbow":5, "l_hip":30, "l_knee":-40,"r_hip":-30,"r_knee":-40},
        {"t":0.65,"torso_angle":270,"head_tilt":-15,"l_shoulder":-70,"l_elbow":8, "r_shoulder":70, "r_elbow":8, "l_hip":25, "l_knee":-30,"r_hip":-25,"r_knee":-30},
        {"t":0.85,"torso_angle":272,"head_tilt":5,  "l_shoulder":-30,"l_elbow":25,"r_shoulder":30, "r_elbow":25,"l_hip":5,  "l_knee":15, "r_hip":-5, "r_knee":15},
        {"t":1.0, "torso_angle":270,"head_tilt":0,  "l_shoulder":-20,"l_elbow":30,"r_shoulder":20, "r_elbow":30,"l_hip":-10,"l_knee":20, "r_hip":10, "r_knee":20},
    ],

    # ── run (8-phase realistic cycle) ──────────────────────────────────────────
    "run": [
        {"t":0.0,  "torso_angle":278,"head_tilt":-5,"l_shoulder":-60,"l_elbow":70,"r_shoulder":60, "r_elbow":70,"l_hip":-45,"l_knee":40, "r_hip":45, "r_knee":10}, # Contact
        {"t":0.12, "torso_angle":280,"head_tilt":0, "l_shoulder":-40,"l_elbow":80,"r_shoulder":40, "r_elbow":80,"l_hip":-10,"l_knee":60, "r_hip":60, "r_knee":5},  # Recoil
        {"t":0.25, "torso_angle":278,"head_tilt":-5,"l_shoulder":20, "l_elbow":70,"r_shoulder":-20,"r_elbow":70,"l_hip":30, "r_hip":-30,"l_knee":20,"r_knee":20}, # Passing
        {"t":0.37, "torso_angle":276,"head_tilt":-10,"l_shoulder":60,"l_elbow":60,"r_shoulder":-60,"r_elbow":60,"l_hip":50, "r_hip":-30,"l_knee":5, "r_knee":50}, # High point
        {"t":0.5,  "torso_angle":278,"head_tilt":-5,"l_shoulder":60, "l_elbow":70,"r_shoulder":-60,"r_elbow":70,"l_hip":45, "r_hip":-45, "l_knee":10,"r_knee":40}, # Mid-contact
        {"t":0.62, "torso_angle":280,"head_tilt":0, "l_shoulder":40, "l_elbow":80,"r_shoulder":-40,"r_elbow":80,"l_hip":60, "r_hip":-10, "l_knee":5, "r_knee":60}, # Recoil
        {"t":0.75, "torso_angle":278,"head_tilt":-5,"l_shoulder":-20,"l_elbow":70,"r_shoulder":20, "r_elbow":70,"l_hip":-30,"r_hip":30, "l_knee":20,"r_knee":20}, # Passing
        {"t":0.87, "torso_angle":276,"head_tilt":-10,"l_shoulder":-60,"l_elbow":60,"r_shoulder":60,"r_elbow":60,"l_hip":-30,"r_hip":50, "l_knee":50,"r_knee":5}, # High point
        {"t":1.0,  "torso_angle":278,"head_tilt":-5,"l_shoulder":-60,"l_elbow":70,"r_shoulder":60, "r_elbow":70,"l_hip":-45,"l_knee":40, "r_hip":45, "r_knee":10},
    ],

    # ── walk (8-phase realistic cycle) ─────────────────────────────────────────
    "walk": [
        {"t":0.0,  "torso_angle":270,"head_tilt":2, "l_shoulder":-30,"l_elbow":15,"r_shoulder":30, "r_elbow":15,"l_hip":-25,"l_knee":15, "r_hip":20, "r_knee":5},  # Contact
        {"t":0.12, "torso_angle":272,"head_tilt":4, "l_shoulder":-15,"l_elbow":20,"r_shoulder":15, "r_elbow":20,"l_hip":-10,"l_knee":30, "r_hip":15, "r_knee":10}, # Recoil
        {"t":0.25, "torso_angle":270,"head_tilt":2, "l_shoulder":10, "l_elbow":15,"r_shoulder":-10,"r_elbow":15,"l_hip":10, "r_hip":-10,"l_knee":10,"r_knee":10}, # Passing
        {"t":0.37, "torso_angle":268,"head_tilt":0, "l_shoulder":25, "l_elbow":10,"r_shoulder":-25,"r_elbow":10,"l_hip":25, "r_hip":-20,"l_knee":5, "r_knee":20}, # High point
        {"t":0.5,  "torso_angle":270,"head_tilt":2, "l_shoulder":30, "l_elbow":15,"r_shoulder":-30,"r_elbow":15,"l_hip":20, "r_hip":-25, "l_knee":5, "r_knee":15}, # Mid-contact
        {"t":0.62, "torso_angle":272,"head_tilt":4, "l_shoulder":15, "l_elbow":20,"r_shoulder":-15,"r_elbow":20,"l_hip":15, "r_hip":-10, "l_knee":10,"r_knee":30}, # Recoil
        {"t":0.75, "torso_angle":270,"head_tilt":2, "l_shoulder":-10,"l_elbow":15,"r_shoulder":10, "r_elbow":15,"l_hip":-10,"r_hip":10, "l_knee":10,"r_knee":10}, # Passing
        {"t":0.87, "torso_angle":268,"head_tilt":0, "l_shoulder":-25,"l_elbow":10,"r_shoulder":25,"r_elbow":10,"l_hip":-20,"r_hip":25, "l_knee":20,"r_knee":5},  # High point
        {"t":1.0,  "torso_angle":270,"head_tilt":2, "l_shoulder":-30,"l_elbow":15,"r_shoulder":30, "r_elbow":15,"l_hip":-25,"l_knee":15, "r_hip":20, "r_knee":5},
    ],

    # ── dance ────────────────────────────────────────────────────────────────
    "dance": [
        {"t":0.0, "torso_angle":268,"head_tilt":10, "l_shoulder":-90,"l_elbow":60,"r_shoulder":20, "r_elbow":30,"l_hip":-20,"l_knee":15,"r_hip":30, "r_knee":20},
        {"t":0.25,"torso_angle":272,"head_tilt":-10,"l_shoulder":20, "l_elbow":30,"r_shoulder":-90,"r_elbow":60,"l_hip":30, "l_knee":20,"r_hip":-20,"r_knee":15},
        {"t":0.5, "torso_angle":268,"head_tilt":15, "l_shoulder":-110,"l_elbow":70,"r_shoulder":30,"r_elbow":45,"l_hip":-25,"l_knee":10,"r_hip":35, "r_knee":25},
        {"t":0.75,"torso_angle":272,"head_tilt":-15,"l_shoulder":30, "l_elbow":45,"r_shoulder":-110,"r_elbow":70,"l_hip":35,"l_knee":25,"r_hip":-25,"r_knee":10},
        {"t":1.0, "torso_angle":268,"head_tilt":10, "l_shoulder":-90,"l_elbow":60,"r_shoulder":20, "r_elbow":30,"l_hip":-20,"l_knee":15,"r_hip":30, "r_knee":20},
    ],

    # ── spin ─────────────────────────────────────────────────────────────────
    "spin": [
        {"t":0.0, "torso_angle":270,"head_tilt":0,"l_shoulder":-90,"l_elbow":0,"r_shoulder":90, "r_elbow":0,"l_hip":20, "l_knee":-10,"r_hip":-20,"r_knee":-10},
        {"t":0.5, "torso_angle":270,"head_tilt":0,"l_shoulder":90, "l_elbow":0,"r_shoulder":-90,"r_elbow":0,"l_hip":-20,"l_knee":-10,"r_hip":20, "r_knee":-10},
        {"t":1.0, "torso_angle":270,"head_tilt":0,"l_shoulder":-90,"l_elbow":0,"r_shoulder":90, "r_elbow":0,"l_hip":20, "l_knee":-10,"r_hip":-20,"r_knee":-10},
    ],

    # ── wave ─────────────────────────────────────────────────────────────────
    "wave": [
        {"t":0.0, "torso_angle":270,"head_tilt":5,"l_shoulder":-130,"l_elbow":30,"r_shoulder":15,"r_elbow":20,"l_hip":-5,"l_knee":8,"r_hip":5,"r_knee":8},
        {"t":0.25,"torso_angle":270,"head_tilt":8,"l_shoulder":-110,"l_elbow":50,"r_shoulder":15,"r_elbow":20,"l_hip":-5,"l_knee":8,"r_hip":5,"r_knee":8},
        {"t":0.5, "torso_angle":270,"head_tilt":5,"l_shoulder":-130,"l_elbow":30,"r_shoulder":15,"r_elbow":20,"l_hip":-5,"l_knee":8,"r_hip":5,"r_knee":8},
        {"t":0.75,"torso_angle":270,"head_tilt":8,"l_shoulder":-110,"l_elbow":50,"r_shoulder":15,"r_elbow":20,"l_hip":-5,"l_knee":8,"r_hip":5,"r_knee":8},
        {"t":1.0, "torso_angle":270,"head_tilt":5,"l_shoulder":-130,"l_elbow":30,"r_shoulder":15,"r_elbow":20,"l_hip":-5,"l_knee":8,"r_hip":5,"r_knee":8},
    ],

    # ── walk ─────────────────────────────────────────────────────────────────
    "walk": [
        {"t":0.0, "torso_angle":272,"head_tilt":-3,"l_shoulder":-30,"l_elbow":25,"r_shoulder":30, "r_elbow":25,"l_hip":-25,"l_knee":15,"r_hip":25, "r_knee":-15},
        {"t":0.5, "torso_angle":272,"head_tilt":-3,"l_shoulder":30, "l_elbow":25,"r_shoulder":-30,"r_elbow":25,"l_hip":25, "l_knee":-15,"r_hip":-25,"r_knee":15},
        {"t":1.0, "torso_angle":272,"head_tilt":-3,"l_shoulder":-30,"l_elbow":25,"r_shoulder":30, "r_elbow":25,"l_hip":-25,"l_knee":15,"r_hip":25, "r_knee":-15},
    ],

    # ── float ────────────────────────────────────────────────────────────────
    "float": [
        {"t":0.0, "torso_angle":270,"head_tilt":-10,"l_shoulder":-60,"l_elbow":20,"r_shoulder":60, "r_elbow":20,"l_hip":20, "l_knee":15,"r_hip":-20,"r_knee":15},
        {"t":0.33,"torso_angle":268,"head_tilt":-15,"l_shoulder":-80,"l_elbow":30,"r_shoulder":80, "r_elbow":30,"l_hip":30, "l_knee":20,"r_hip":-30,"r_knee":20},
        {"t":0.66,"torso_angle":272,"head_tilt":-8, "l_shoulder":-50,"l_elbow":15,"r_shoulder":50, "r_elbow":15,"l_hip":15, "l_knee":10,"r_hip":-15,"r_knee":10},
        {"t":1.0, "torso_angle":270,"head_tilt":-10,"l_shoulder":-60,"l_elbow":20,"r_shoulder":60, "r_elbow":20,"l_hip":20, "l_knee":15,"r_hip":-20,"r_knee":15},
    ],

    # ── stretch ──────────────────────────────────────────────────────────────
    "stretch": [
        {"t":0.0, "torso_angle":270,"head_tilt":-20,"l_shoulder":-150,"l_elbow":10,"r_shoulder":150,"r_elbow":10,"l_hip":-5,"l_knee":5,"r_hip":5,"r_knee":5},
        {"t":0.5, "torso_angle":265,"head_tilt":-25,"l_shoulder":-160,"l_elbow":5, "r_shoulder":160,"r_elbow":5, "l_hip":-10,"l_knee":0,"r_hip":10,"r_knee":0},
        {"t":1.0, "torso_angle":270,"head_tilt":-20,"l_shoulder":-150,"l_elbow":10,"r_shoulder":150,"r_elbow":10,"l_hip":-5,"l_knee":5,"r_hip":5,"r_knee":5},
    ],

    # ════════════════════════════════════════════════════════════════════════
    # EMOTION POSES
    # ════════════════════════════════════════════════════════════════════════

    # ── happy — bouncy, arms swinging up, bubbly ─────────────────────────────
    "happy": [
        {"t":0.0, "torso_angle":270,"head_tilt":-10,"l_shoulder":-70,"l_elbow":25,"r_shoulder":70, "r_elbow":25,"l_hip":-15,"l_knee":-10,"r_hip":15,"r_knee":-10},
        {"t":0.2, "torso_angle":268,"head_tilt":-15,"l_shoulder":-100,"l_elbow":15,"r_shoulder":100,"r_elbow":15,"l_hip":-20,"l_knee":-20,"r_hip":20,"r_knee":-20},
        {"t":0.4, "torso_angle":272,"head_tilt":-8, "l_shoulder":-60,"l_elbow":30,"r_shoulder":60, "r_elbow":30,"l_hip":-10,"l_knee":-5,"r_hip":10,"r_knee":-5},
        {"t":0.6, "torso_angle":268,"head_tilt":-15,"l_shoulder":-110,"l_elbow":10,"r_shoulder":110,"r_elbow":10,"l_hip":-25,"l_knee":-25,"r_hip":25,"r_knee":-25},
        {"t":0.8, "torso_angle":270,"head_tilt":-12,"l_shoulder":-80,"l_elbow":20,"r_shoulder":80, "r_elbow":20,"l_hip":-15,"l_knee":-15,"r_hip":15,"r_knee":-15},
        {"t":1.0, "torso_angle":270,"head_tilt":-10,"l_shoulder":-70,"l_elbow":25,"r_shoulder":70, "r_elbow":25,"l_hip":-15,"l_knee":-10,"r_hip":15,"r_knee":-10},
    ],

    # ── sad — slumped posture, hanging arms, drooping head ────────────────────
    "sad": [
        {"t":0.0, "torso_angle":280,"head_tilt":25,"l_shoulder":20, "l_elbow":40,"r_shoulder":-20,"r_elbow":40,"l_hip":5,  "l_knee":15,"r_hip":-5, "r_knee":15},
        {"t":0.3, "torso_angle":282,"head_tilt":30,"l_shoulder":25, "l_elbow":45,"r_shoulder":-25,"r_elbow":45,"l_hip":8,  "l_knee":20,"r_hip":-8, "r_knee":20},
        {"t":0.6, "torso_angle":280,"head_tilt":28,"l_shoulder":22, "l_elbow":42,"r_shoulder":-22,"r_elbow":42,"l_hip":6,  "l_knee":17,"r_hip":-6, "r_knee":17},
        {"t":1.0, "torso_angle":280,"head_tilt":25,"l_shoulder":20, "l_elbow":40,"r_shoulder":-20,"r_elbow":40,"l_hip":5,  "l_knee":15,"r_hip":-5, "r_knee":15},
    ],

    # ── angry — aggressive stance, fists clenched, stomping ──────────────────
    "angry": [
        {"t":0.0, "torso_angle":274,"head_tilt":-5,"l_shoulder":-40,"l_elbow":80,"r_shoulder":40, "r_elbow":80,"l_hip":-15,"l_knee":5, "r_hip":15, "r_knee":5},
        {"t":0.15,"torso_angle":273,"head_tilt":-8,"l_shoulder":-60,"l_elbow":90,"r_shoulder":15, "r_elbow":80,"l_hip":-30,"l_knee":15,"r_hip":5,  "r_knee":20},
        {"t":0.3, "torso_angle":273,"head_tilt":-5,"l_shoulder":-40,"l_elbow":80,"r_shoulder":60, "r_elbow":90,"l_hip":-5, "l_knee":20,"r_hip":-30,"r_knee":15},
        {"t":0.45,"torso_angle":274,"head_tilt":-8,"l_shoulder":-65,"l_elbow":85,"r_shoulder":20, "r_elbow":80,"l_hip":-25,"l_knee":10,"r_hip":5,  "r_knee":20},
        {"t":0.6, "torso_angle":273,"head_tilt":-5,"l_shoulder":-40,"l_elbow":80,"r_shoulder":65, "r_elbow":85,"l_hip":-5, "l_knee":20,"r_hip":-25,"r_knee":10},
        {"t":0.75,"torso_angle":274,"head_tilt":-8,"l_shoulder":-55,"l_elbow":88,"r_shoulder":25, "r_elbow":80,"l_hip":-20,"l_knee":8, "r_hip":5,  "r_knee":18},
        {"t":1.0, "torso_angle":274,"head_tilt":-5,"l_shoulder":-40,"l_elbow":80,"r_shoulder":40, "r_elbow":80,"l_hip":-15,"l_knee":5, "r_hip":15, "r_knee":5},
    ],

    # ── excited — rapid arm pump + bouncing ───────────────────────────────────
    "excited": [
        {"t":0.0, "torso_angle":269,"head_tilt":-15,"l_shoulder":-120,"l_elbow":10,"r_shoulder":120,"r_elbow":10,"l_hip":-20,"l_knee":-25,"r_hip":20,"r_knee":-25},
        {"t":0.12,"torso_angle":271,"head_tilt":-10,"l_shoulder":-60, "l_elbow":40,"r_shoulder":60, "r_elbow":40,"l_hip":-10,"l_knee":-10,"r_hip":10,"r_knee":-10},
        {"t":0.25,"torso_angle":269,"head_tilt":-15,"l_shoulder":-120,"l_elbow":10,"r_shoulder":120,"r_elbow":10,"l_hip":-20,"l_knee":-25,"r_hip":20,"r_knee":-25},
        {"t":0.37,"torso_angle":271,"head_tilt":-10,"l_shoulder":-60, "l_elbow":40,"r_shoulder":60, "r_elbow":40,"l_hip":-10,"l_knee":-10,"r_hip":10,"r_knee":-10},
        {"t":0.5, "torso_angle":269,"head_tilt":-18,"l_shoulder":-130,"l_elbow":5, "r_shoulder":130,"r_elbow":5, "l_hip":-25,"l_knee":-30,"r_hip":25,"r_knee":-30},
        {"t":0.62,"torso_angle":271,"head_tilt":-10,"l_shoulder":-60, "l_elbow":40,"r_shoulder":60, "r_elbow":40,"l_hip":-10,"l_knee":-10,"r_hip":10,"r_knee":-10},
        {"t":0.75,"torso_angle":269,"head_tilt":-15,"l_shoulder":-120,"l_elbow":10,"r_shoulder":120,"r_elbow":10,"l_hip":-20,"l_knee":-25,"r_hip":20,"r_knee":-25},
        {"t":0.87,"torso_angle":271,"head_tilt":-10,"l_shoulder":-60, "l_elbow":40,"r_shoulder":60, "r_elbow":40,"l_hip":-10,"l_knee":-10,"r_hip":10,"r_knee":-10},
        {"t":1.0, "torso_angle":269,"head_tilt":-15,"l_shoulder":-120,"l_elbow":10,"r_shoulder":120,"r_elbow":10,"l_hip":-20,"l_knee":-25,"r_hip":20,"r_knee":-25},
    ],

    # ── scared — cowering, arms up protecting, crouching ─────────────────────
    "scared": [
        {"t":0.0, "torso_angle":283,"head_tilt":12,"l_shoulder":-40,"l_elbow":100,"r_shoulder":40,"r_elbow":100,"l_hip":10,"l_knee":35,"r_hip":-10,"r_knee":35},
        {"t":0.1, "torso_angle":286,"head_tilt":15,"l_shoulder":-50,"l_elbow":110,"r_shoulder":50,"r_elbow":110,"l_hip":15,"l_knee":40,"r_hip":-15,"r_knee":40},
        {"t":0.2, "torso_angle":283,"head_tilt":12,"l_shoulder":-40,"l_elbow":100,"r_shoulder":40,"r_elbow":100,"l_hip":10,"l_knee":35,"r_hip":-10,"r_knee":35},
        {"t":0.3, "torso_angle":286,"head_tilt":15,"l_shoulder":-50,"l_elbow":110,"r_shoulder":50,"r_elbow":110,"l_hip":15,"l_knee":40,"r_hip":-15,"r_knee":40},
        {"t":0.5, "torso_angle":284,"head_tilt":14,"l_shoulder":-45,"l_elbow":105,"r_shoulder":45,"r_elbow":105,"l_hip":12,"l_knee":38,"r_hip":-12,"r_knee":38},
        {"t":0.7, "torso_angle":283,"head_tilt":12,"l_shoulder":-40,"l_elbow":100,"r_shoulder":40,"r_elbow":100,"l_hip":10,"l_knee":35,"r_hip":-10,"r_knee":35},
        {"t":0.85,"torso_angle":286,"head_tilt":15,"l_shoulder":-50,"l_elbow":110,"r_shoulder":50,"r_elbow":110,"l_hip":15,"l_knee":40,"r_hip":-15,"r_knee":40},
        {"t":1.0, "torso_angle":283,"head_tilt":12,"l_shoulder":-40,"l_elbow":100,"r_shoulder":40,"r_elbow":100,"l_hip":10,"l_knee":35,"r_hip":-10,"r_knee":35},
    ],

    # ── surprised — stumble back, arms wide, lean back ────────────────────────
    "surprised": [
        {"t":0.0, "torso_angle":260,"head_tilt":-20,"l_shoulder":-120,"l_elbow":30,"r_shoulder":120,"r_elbow":30,"l_hip":20,"l_knee":10,"r_hip":-20,"r_knee":10},
        {"t":0.15,"torso_angle":255,"head_tilt":-25,"l_shoulder":-140,"l_elbow":20,"r_shoulder":140,"r_elbow":20,"l_hip":25,"l_knee":5, "r_hip":-25,"r_knee":5},
        {"t":0.3, "torso_angle":265,"head_tilt":-18,"l_shoulder":-110,"l_elbow":35,"r_shoulder":110,"r_elbow":35,"l_hip":18,"l_knee":12,"r_hip":-18,"r_knee":12},
        {"t":0.5, "torso_angle":260,"head_tilt":-20,"l_shoulder":-120,"l_elbow":30,"r_shoulder":120,"r_elbow":30,"l_hip":20,"l_knee":10,"r_hip":-20,"r_knee":10},
        {"t":0.75,"torso_angle":263,"head_tilt":-15,"l_shoulder":-100,"l_elbow":35,"r_shoulder":100,"r_elbow":35,"l_hip":15,"l_knee":12,"r_hip":-15,"r_knee":12},
        {"t":1.0, "torso_angle":260,"head_tilt":-20,"l_shoulder":-120,"l_elbow":30,"r_shoulder":120,"r_elbow":30,"l_hip":20,"l_knee":10,"r_hip":-20,"r_knee":10},
    ],

    # ── tired — slouched torso, droopy arms, slow sway ────────────────────────
    "tired": [
        {"t":0.0, "torso_angle":283,"head_tilt":20,"l_shoulder":15, "l_elbow":50,"r_shoulder":-15,"r_elbow":50,"l_hip":5, "l_knee":20,"r_hip":-5,"r_knee":20},
        {"t":0.4, "torso_angle":285,"head_tilt":25,"l_shoulder":20, "l_elbow":55,"r_shoulder":-20,"r_elbow":55,"l_hip":8, "l_knee":22,"r_hip":-8,"r_knee":22},
        {"t":0.8, "torso_angle":283,"head_tilt":22,"l_shoulder":17, "l_elbow":52,"r_shoulder":-17,"r_elbow":52,"l_hip":6, "l_knee":21,"r_hip":-6,"r_knee":21},
        {"t":1.0, "torso_angle":283,"head_tilt":20,"l_shoulder":15, "l_elbow":50,"r_shoulder":-15,"r_elbow":50,"l_hip":5, "l_knee":20,"r_hip":-5,"r_knee":20},
    ],

    # ── confused — head tilted, one arm raised + hand gesture ────────────────
    "confused": [
        {"t":0.0, "torso_angle":270,"head_tilt":15,"l_shoulder":-70,"l_elbow":50,"r_shoulder":10, "r_elbow":20,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.3, "torso_angle":271,"head_tilt":20,"l_shoulder":-80,"l_elbow":60,"r_shoulder":8,  "r_elbow":18,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.5, "torso_angle":269,"head_tilt":10,"l_shoulder":-65,"l_elbow":45,"r_shoulder":12, "r_elbow":22,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.7, "torso_angle":271,"head_tilt":20,"l_shoulder":-75,"l_elbow":55,"r_shoulder":8,  "r_elbow":18,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":1.0, "torso_angle":270,"head_tilt":15,"l_shoulder":-70,"l_elbow":50,"r_shoulder":10, "r_elbow":20,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
    ],

    # ── proud — puffed chest, head back, arms wide powerpose ─────────────────
    "proud": [
        {"t":0.0, "torso_angle":264,"head_tilt":-20,"l_shoulder":-80,"l_elbow":20,"r_shoulder":80,"r_elbow":20,"l_hip":-10,"l_knee":5,"r_hip":10,"r_knee":5},
        {"t":0.4, "torso_angle":262,"head_tilt":-25,"l_shoulder":-90,"l_elbow":15,"r_shoulder":90,"r_elbow":15,"l_hip":-12,"l_knee":4,"r_hip":12,"r_knee":4},
        {"t":0.7, "torso_angle":264,"head_tilt":-22,"l_shoulder":-85,"l_elbow":18,"r_shoulder":85,"r_elbow":18,"l_hip":-11,"l_knee":5,"r_hip":11,"r_knee":5},
        {"t":1.0, "torso_angle":264,"head_tilt":-20,"l_shoulder":-80,"l_elbow":20,"r_shoulder":80,"r_elbow":20,"l_hip":-10,"l_knee":5,"r_hip":10,"r_knee":5},
    ],

    # ── bored — slouch, head drooping side to side slowly ────────────────────
    "bored": [
        {"t":0.0, "torso_angle":278,"head_tilt":18,"l_shoulder":10,"l_elbow":30,"r_shoulder":-10,"r_elbow":30,"l_hip":3,"l_knee":12,"r_hip":-3,"r_knee":12},
        {"t":0.33,"torso_angle":280,"head_tilt":22,"l_shoulder":12,"l_elbow":32,"r_shoulder":-12,"r_elbow":32,"l_hip":5,"l_knee":14,"r_hip":-5,"r_knee":14},
        {"t":0.66,"torso_angle":276,"head_tilt":14,"l_shoulder":8, "l_elbow":28,"r_shoulder":-8, "r_elbow":28,"l_hip":2,"l_knee":10,"r_hip":-2,"r_knee":10},
        {"t":1.0, "torso_angle":278,"head_tilt":18,"l_shoulder":10,"l_elbow":30,"r_shoulder":-10,"r_elbow":30,"l_hip":3,"l_knee":12,"r_hip":-3,"r_knee":12},
    ],

    # ── love — swaying, arms making heart gesture ─────────────────────────────
    "love": [
        {"t":0.0, "torso_angle":268,"head_tilt":-8,"l_shoulder":-55,"l_elbow":55,"r_shoulder":55,"r_elbow":55,"l_hip":-8,"l_knee":8,"r_hip":8,"r_knee":8},
        {"t":0.25,"torso_angle":272,"head_tilt":-5,"l_shoulder":-45,"l_elbow":65,"r_shoulder":45,"r_elbow":65,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.5, "torso_angle":268,"head_tilt":-8,"l_shoulder":-60,"l_elbow":50,"r_shoulder":60,"r_elbow":50,"l_hip":-8,"l_knee":8,"r_hip":8,"r_knee":8},
        {"t":0.75,"torso_angle":272,"head_tilt":-5,"l_shoulder":-45,"l_elbow":65,"r_shoulder":45,"r_elbow":65,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":1.0, "torso_angle":268,"head_tilt":-8,"l_shoulder":-55,"l_elbow":55,"r_shoulder":55,"r_elbow":55,"l_hip":-8,"l_knee":8,"r_hip":8,"r_knee":8},
    ],

    # ── nervous — weight-shifting, fidgety arms ───────────────────────────────
    "nervous": [
        {"t":0.0, "torso_angle":271,"head_tilt":5, "l_shoulder":-20,"l_elbow":60,"r_shoulder":20,"r_elbow":60,"l_hip":-8,"l_knee":12,"r_hip":3, "r_knee":8},
        {"t":0.1, "torso_angle":269,"head_tilt":8, "l_shoulder":-25,"l_elbow":65,"r_shoulder":18,"r_elbow":58,"l_hip":-5,"l_knee":15,"r_hip":8, "r_knee":10},
        {"t":0.2, "torso_angle":272,"head_tilt":4, "l_shoulder":-18,"l_elbow":58,"r_shoulder":25,"r_elbow":62,"l_hip":-10,"l_knee":10,"r_hip":2,"r_knee":8},
        {"t":0.3, "torso_angle":270,"head_tilt":6, "l_shoulder":-22,"l_elbow":62,"r_shoulder":22,"r_elbow":60,"l_hip":-6,"l_knee":13,"r_hip":6, "r_knee":9},
        {"t":0.5, "torso_angle":271,"head_tilt":5, "l_shoulder":-20,"l_elbow":60,"r_shoulder":20,"r_elbow":60,"l_hip":-8,"l_knee":12,"r_hip":3, "r_knee":8},
        {"t":0.6, "torso_angle":269,"head_tilt":9, "l_shoulder":-28,"l_elbow":68,"r_shoulder":15,"r_elbow":56,"l_hip":-4,"l_knee":16,"r_hip":9, "r_knee":11},
        {"t":0.75,"torso_angle":272,"head_tilt":3, "l_shoulder":-16,"l_elbow":56,"r_shoulder":28,"r_elbow":64,"l_hip":-11,"l_knee":9,"r_hip":1, "r_knee":7},
        {"t":1.0, "torso_angle":271,"head_tilt":5, "l_shoulder":-20,"l_elbow":60,"r_shoulder":20,"r_elbow":60,"l_hip":-8,"l_knee":12,"r_hip":3, "r_knee":8},
    ],

    # ── celebrate — victory arms raised overhead ──────────────────────────────
    "celebrate": [
        {"t":0.0, "torso_angle":267,"head_tilt":-18,"l_shoulder":-150,"l_elbow":10,"r_shoulder":150,"r_elbow":10,"l_hip":-15,"l_knee":-20,"r_hip":15,"r_knee":-20},
        {"t":0.2, "torso_angle":265,"head_tilt":-22,"l_shoulder":-160,"l_elbow":5, "r_shoulder":160,"r_elbow":5, "l_hip":-20,"l_knee":-25,"r_hip":20,"r_knee":-25},
        {"t":0.4, "torso_angle":267,"head_tilt":-18,"l_shoulder":-145,"l_elbow":12,"r_shoulder":145,"r_elbow":12,"l_hip":-12,"l_knee":-18,"r_hip":12,"r_knee":-18},
        {"t":0.6, "torso_angle":265,"head_tilt":-22,"l_shoulder":-158,"l_elbow":6, "r_shoulder":158,"r_elbow":6, "l_hip":-18,"l_knee":-23,"r_hip":18,"r_knee":-23},
        {"t":0.8, "torso_angle":267,"head_tilt":-18,"l_shoulder":-150,"l_elbow":10,"r_shoulder":150,"r_elbow":10,"l_hip":-14,"l_knee":-19,"r_hip":14,"r_knee":-19},
        {"t":1.0, "torso_angle":267,"head_tilt":-18,"l_shoulder":-150,"l_elbow":10,"r_shoulder":150,"r_elbow":10,"l_hip":-15,"l_knee":-20,"r_hip":15,"r_knee":-20},
    ],

    # ── cry — hunched, shaking, arms covering face ────────────────────────────
    "cry": [
        {"t":0.0, "torso_angle":281,"head_tilt":22,"l_shoulder":-20,"l_elbow":90,"r_shoulder":20,"r_elbow":90,"l_hip":5,"l_knee":18,"r_hip":-5,"r_knee":18},
        {"t":0.08,"torso_angle":283,"head_tilt":24,"l_shoulder":-22,"l_elbow":95,"r_shoulder":22,"r_elbow":95,"l_hip":7,"l_knee":20,"r_hip":-7,"r_knee":20},
        {"t":0.16,"torso_angle":280,"head_tilt":21,"l_shoulder":-18,"l_elbow":88,"r_shoulder":18,"r_elbow":88,"l_hip":4,"l_knee":17,"r_hip":-4,"r_knee":17},
        {"t":0.25,"torso_angle":282,"head_tilt":23,"l_shoulder":-21,"l_elbow":92,"r_shoulder":21,"r_elbow":92,"l_hip":6,"l_knee":19,"r_hip":-6,"r_knee":19},
        {"t":0.33,"torso_angle":280,"head_tilt":21,"l_shoulder":-18,"l_elbow":88,"r_shoulder":18,"r_elbow":88,"l_hip":4,"l_knee":17,"r_hip":-4,"r_knee":17},
        {"t":0.5, "torso_angle":282,"head_tilt":23,"l_shoulder":-21,"l_elbow":92,"r_shoulder":21,"r_elbow":92,"l_hip":6,"l_knee":19,"r_hip":-6,"r_knee":19},
        {"t":0.66,"torso_angle":281,"head_tilt":22,"l_shoulder":-20,"l_elbow":90,"r_shoulder":20,"r_elbow":90,"l_hip":5,"l_knee":18,"r_hip":-5,"r_knee":18},
        {"t":0.75,"torso_angle":283,"head_tilt":24,"l_shoulder":-22,"l_elbow":95,"r_shoulder":22,"r_elbow":95,"l_hip":7,"l_knee":20,"r_hip":-7,"r_knee":20},
        {"t":0.87,"torso_angle":280,"head_tilt":21,"l_shoulder":-18,"l_elbow":88,"r_shoulder":18,"r_elbow":88,"l_hip":4,"l_knee":17,"r_hip":-4,"r_knee":17},
        {"t":1.0, "torso_angle":281,"head_tilt":22,"l_shoulder":-20,"l_elbow":90,"r_shoulder":20,"r_elbow":90,"l_hip":5,"l_knee":18,"r_hip":-5,"r_knee":18},
    ],

    # ── laugh — bent forward, shaking shoulders ───────────────────────────────
    "laugh": [
        {"t":0.0, "torso_angle":278,"head_tilt":-5,"l_shoulder":-30,"l_elbow":70,"r_shoulder":30,"r_elbow":70,"l_hip":10,"l_knee":15,"r_hip":-10,"r_knee":15},
        {"t":0.1, "torso_angle":280,"head_tilt":-3,"l_shoulder":-35,"l_elbow":75,"r_shoulder":35,"r_elbow":75,"l_hip":12,"l_knee":17,"r_hip":-12,"r_knee":17},
        {"t":0.2, "torso_angle":276,"head_tilt":-7,"l_shoulder":-25,"l_elbow":65,"r_shoulder":25,"r_elbow":65,"l_hip":8, "l_knee":13,"r_hip":-8, "r_knee":13},
        {"t":0.3, "torso_angle":280,"head_tilt":-3,"l_shoulder":-35,"l_elbow":75,"r_shoulder":35,"r_elbow":75,"l_hip":12,"l_knee":17,"r_hip":-12,"r_knee":17},
        {"t":0.5, "torso_angle":276,"head_tilt":-7,"l_shoulder":-25,"l_elbow":65,"r_shoulder":25,"r_elbow":65,"l_hip":8, "l_knee":13,"r_hip":-8, "r_knee":13},
        {"t":0.7, "torso_angle":280,"head_tilt":-3,"l_shoulder":-35,"l_elbow":75,"r_shoulder":35,"r_elbow":75,"l_hip":12,"l_knee":17,"r_hip":-12,"r_knee":17},
        {"t":0.85,"torso_angle":276,"head_tilt":-7,"l_shoulder":-25,"l_elbow":65,"r_shoulder":25,"r_elbow":65,"l_hip":8, "l_knee":13,"r_hip":-8, "r_knee":13},
        {"t":1.0, "torso_angle":278,"head_tilt":-5,"l_shoulder":-30,"l_elbow":70,"r_shoulder":30,"r_elbow":70,"l_hip":10,"l_knee":15,"r_hip":-10,"r_knee":15},
    ],

    # ── think — hand-on-chin, head tilted, slow sway ──────────────────────────
    "think": [
        {"t":0.0, "torso_angle":271,"head_tilt":12,"l_shoulder":-10,"l_elbow":75,"r_shoulder":20,"r_elbow":30,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.4, "torso_angle":269,"head_tilt":15,"l_shoulder":-8, "l_elbow":78,"r_shoulder":18,"r_elbow":28,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":0.7, "torso_angle":271,"head_tilt":10,"l_shoulder":-12,"l_elbow":72,"r_shoulder":22,"r_elbow":32,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
        {"t":1.0, "torso_angle":271,"head_tilt":12,"l_shoulder":-10,"l_elbow":75,"r_shoulder":20,"r_elbow":30,"l_hip":-5,"l_knee":10,"r_hip":5,"r_knee":10},
    ],

    # ── panic — frantic flailing, fast alternating ────────────────────────────
    "panic": [
        {"t":0.0, "torso_angle":276,"head_tilt":-5,"l_shoulder":-100,"l_elbow":30,"r_shoulder":40,"r_elbow":50,"l_hip":-35,"l_knee":30,"r_hip":25,"r_knee":-25},
        {"t":0.1, "torso_angle":273,"head_tilt":8, "l_shoulder":40,  "l_elbow":50,"r_shoulder":-100,"r_elbow":30,"l_hip":25,"l_knee":-25,"r_hip":-35,"r_knee":30},
        {"t":0.2, "torso_angle":277,"head_tilt":-8,"l_shoulder":-110,"l_elbow":25,"r_shoulder":35,"r_elbow":55,"l_hip":-30,"l_knee":35,"r_hip":30,"r_knee":-20},
        {"t":0.3, "torso_angle":272,"head_tilt":10,"l_shoulder":35,  "l_elbow":55,"r_shoulder":-110,"r_elbow":25,"l_hip":30,"l_knee":-20,"r_hip":-30,"r_knee":35},
        {"t":0.4, "torso_angle":276,"head_tilt":-5,"l_shoulder":-100,"l_elbow":30,"r_shoulder":40,"r_elbow":50,"l_hip":-35,"l_knee":30,"r_hip":25,"r_knee":-25},
        {"t":0.5, "torso_angle":273,"head_tilt":8, "l_shoulder":40,  "l_elbow":50,"r_shoulder":-100,"r_elbow":30,"l_hip":25,"l_knee":-25,"r_hip":-35,"r_knee":30},
        {"t":0.6, "torso_angle":277,"head_tilt":-8,"l_shoulder":-110,"l_elbow":25,"r_shoulder":35,"r_elbow":55,"l_hip":-30,"l_knee":35,"r_hip":30,"r_knee":-20},
        {"t":0.7, "torso_angle":272,"head_tilt":10,"l_shoulder":35,  "l_elbow":55,"r_shoulder":-110,"r_elbow":25,"l_hip":30,"l_knee":-20,"r_hip":-30,"r_knee":35},
        {"t":0.8, "torso_angle":276,"head_tilt":-5,"l_shoulder":-100,"l_elbow":30,"r_shoulder":40,"r_elbow":50,"l_hip":-35,"l_knee":30,"r_hip":25,"r_knee":-25},
        {"t":0.9, "torso_angle":273,"head_tilt":8, "l_shoulder":40,  "l_elbow":50,"r_shoulder":-100,"r_elbow":30,"l_hip":25,"l_knee":-25,"r_hip":-35,"r_knee":30},
        {"t":1.0, "torso_angle":276,"head_tilt":-5,"l_shoulder":-100,"l_elbow":30,"r_shoulder":40,"r_elbow":50,"l_hip":-35,"l_knee":30,"r_hip":25,"r_knee":-25},
    ],

    # ── meditate — serene lotus arms out, slow breathing sway ────────────────
    "meditate": [
        {"t":0.0, "torso_angle":270,"head_tilt":-5,"l_shoulder":-70,"l_elbow":0,"r_shoulder":70,"r_elbow":0,"l_hip":25,"l_knee":40,"r_hip":-25,"r_knee":40},
        {"t":0.33,"torso_angle":268,"head_tilt":-8,"l_shoulder":-72,"l_elbow":0,"r_shoulder":72,"r_elbow":0,"l_hip":25,"l_knee":40,"r_hip":-25,"r_knee":40},
        {"t":0.66,"torso_angle":272,"head_tilt":-3,"l_shoulder":-68,"l_elbow":0,"r_shoulder":68,"r_elbow":0,"l_hip":25,"l_knee":40,"r_hip":-25,"r_knee":40},
        {"t":1.0, "torso_angle":270,"head_tilt":-5,"l_shoulder":-70,"l_elbow":0,"r_shoulder":70,"r_elbow":0,"l_hip":25,"l_knee":40,"r_hip":-25,"r_knee":40},
    ],
}


def generate_all_frames(action: str) -> List[JointState]:
    """
    Generate JointState for all 192 frames of the given action/emotion.
    Applies antigravity physics on top of pose keyframes.
    """
    keyframes = POSE_KEYFRAMES.get(action, POSE_KEYFRAMES["idle"])
    states: List[JointState] = []

    for frame in range(TOTAL_FRAMES):
        t = frame / (TOTAL_FRAMES - 1)

        # 1. Interpolate pose angles
        pose = _interpolate_pose(keyframes, t)

        # 2. Antigravity physics
        y_offset = _antigravity_y_offset(frame, action=action)
        bobbing  = _locomotion_bobbing(frame, action=action)
        tilt     = _body_tilt_degrees(frame, action=action)

        hip = ROOT_GROUND.copy()
        hip[1] -= (y_offset + bobbing)   # combined lift and step impact

        # 3. Apply tilt to torso
        torso_angle = pose["torso_angle"] + tilt

        # 4. Forward kinematics → joint positions
        js = build_joint_state(
            hip=hip,
            torso_angle=torso_angle,
            head_tilt=pose["head_tilt"] - tilt * 0.5,
            l_shoulder_angle=pose["l_shoulder"],
            l_elbow_angle=abs(pose["l_elbow"]),
            r_shoulder_angle=pose["r_shoulder"],
            r_elbow_angle=abs(pose["r_elbow"]),
            l_hip_angle=pose["l_hip"],
            l_knee_angle=pose["l_knee"],
            r_hip_angle=pose["r_hip"],
            r_knee_angle=pose["r_knee"],
        )
        states.append(js)

    return states
