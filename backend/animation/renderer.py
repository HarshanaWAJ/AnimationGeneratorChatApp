"""
Matplotlib Frame Renderer
Renders each frame of the stick figure animation to a numpy RGB array (800×800).

Features:
  - Thin black bone lines (lw=2.5)
  - White joint dots with black outline
  - Cyan glow trails (last 6 positions per joint)
  - Speech bubble with wobble
  - Floating hair lines on head
  - Emotion-aware facial expressions (eyes/mouth)
  - Per-frame body rotation (matplotlib transform)
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.patheffects as pe
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.transforms import Affine2D
import io
from typing import List, Optional
from .skeleton import JointState, CANVAS_W, CANVAS_H, BONE_LENGTHS
from .poses import _body_rotation_deg, TOTAL_FRAMES, _antigravity_y_offset

# DPI — 800px / 100dpi = 8in figure
DPI = 100
FIG_SIZE = CANVAS_W / DPI  # 8 inches


def _joint_trail_alpha(idx: int, trail_len: int = 6) -> float:
    """Older trail points get lower alpha."""
    alphas = [0.04, 0.08, 0.13, 0.20, 0.32, 0.50]
    if idx < len(alphas):
        return alphas[idx]
    return 0.1


def _speech_bubble_wobble(frame: int) -> tuple:
    """Returns (dx, dy) pixel wobble for the speech bubble."""
    t = frame / TOTAL_FRAMES
    dx = 3 * np.sin(t * 6 * np.pi)
    dy = 2 * np.cos(t * 8 * np.pi)
    return dx, dy


def _bubble_alpha(frame: int) -> float:
    """Fade in frames 0–12, fade out frames 180–192."""
    if frame < 12:
        return frame / 12.0
    elif frame > 180:
        return (192 - frame) / 12.0
    return 1.0


def _hair_lines(ax, head_pos: np.ndarray, torso_angle: float, frame: int):
    """Draw 5 floating hair lines above the head."""
    rng = np.random.default_rng(frame // 3)  # slow, deterministic animation
    n_hairs = 5
    for i in range(n_hairs):
        angle_offset = -60 + i * 30  # spread 120°
        base_angle = torso_angle - 90 + angle_offset
        length = 10 + rng.integers(5, 15)
        wobble = rng.uniform(-8, 8)
        rad = np.deg2rad(base_angle + wobble)
        x0, y0 = head_pos
        x1 = x0 + np.cos(rad) * length
        y1 = y0 + np.sin(rad) * length
        ax.plot([x0, x1], [y0, y1], color="black", lw=1.0, alpha=0.6,
                solid_capstyle="round")


def _draw_speech_bubble(ax, head_pos: np.ndarray, text: str, frame: int):
    """Render a cartoon speech bubble above the head."""
    alpha = _bubble_alpha(frame)
    if alpha < 0.01:
        return

    dx, dy = _speech_bubble_wobble(frame)
    bx = head_pos[0] - 10 + dx
    by = head_pos[1] - 100 + dy  # above head

    # Create rounded bubble body
    bbox = dict(
        boxstyle="round,pad=0.5",
        facecolor="#FAFAFA",
        edgecolor="black",
        linewidth=2.5,
        alpha=alpha,
    )
    ax.text(
        bx, by, text,
        fontsize=11,
        fontweight="bold",
        fontfamily="DejaVu Sans",
        ha="center", va="center",
        bbox=bbox,
        color="black",
        alpha=alpha,
        zorder=20,
    )

    # Pointer tail (triangle pointing down to mouth)
    tail_pts = np.array([
        [bx - 11, by + 22],
        [bx + 1,  by + 22],
        [head_pos[0] + dx, head_pos[1] - 5],
    ])
    tail_patch = plt.Polygon(
        tail_pts, closed=True,
        facecolor="#FAFAFA", edgecolor="black",
        linewidth=2.0, alpha=alpha, zorder=19
    )
    ax.add_patch(tail_patch)


def _draw_face(ax, head_pos: np.ndarray, action: str, frame: int):
    """Draw simple eyes and mouth that reflect the current emotion."""
    x, y = head_pos
    s = BONE_LENGTHS["head"]
    
    # Eye positions (relative to head center)
    ex_l, ex_r = -s*0.35, s*0.35
    ey = -s*0.15
    
    # Mouth positions
    mx_l, mx_r = -s*0.3, s*0.3
    my = s*0.35

    # Default: neutral dots
    if action in ["idle", "walk", "float", "stretch", "run", "jump", "spin", "wave"]:
        ax.scatter([x+ex_l, x+ex_r], [y+ey, y+ey], s=3, color="black", zorder=15)
        ax.plot([x+mx_l, x+mx_r], [y+my, y+my], color="black", lw=1.0, zorder=15)
    
    elif action in ["happy", "celebrate", "laugh", "dance", "proud"]:
        # Smiling eyes (arcs) and big grin
        ax.scatter([x+ex_l, x+ex_r], [y+ey, y+ey], s=4, color="black", zorder=15)
        mouth_arc = mpatches.Arc((x, y+my-s*0.1), s*0.6, s*0.4, theta1=0, theta2=180, 
                                color="black", lw=1.5, zorder=15)
        ax.add_patch(mouth_arc)
        
    elif action in ["sad", "cry", "tired", "bored"]:
        # Sad eyes and frowny mouth
        ax.scatter([x+ex_l, x+ex_r], [y+ey, y+ey], s=3, color="black", zorder=15)
        frown_arc = mpatches.Arc((x, y+my+s*0.1), s*0.5, s*0.3, theta1=180, theta2=360, 
                                 color="black", lw=1.5, zorder=15)
        ax.add_patch(frown_arc)
        
    elif action in ["angry", "panic"]:
        # V-shaped angry eyes and screaming mouth
        ax.plot([x+ex_l-2, x+ex_l+2], [y+ey-2, y+ey+2], color="black", lw=1.5, zorder=15)
        ax.plot([x+ex_r-2, x+ex_r+2], [y+ey+2, y+ey-2], color="black", lw=1.5, zorder=15)
        scream = mpatches.Ellipse((x, y+my), s*0.4, s*0.3, color="black", zorder=15)
        ax.add_patch(scream)
        
    elif action in ["surprised", "scared", "excited"]:
        # Wide O eyes and O mouth
        ax.scatter([x+ex_l, x+ex_r], [y+ey, y+ey], s=8, color="black", zorder=15)
        wow = mpatches.Circle((x, y+my), s*0.2, color="black", zorder=15)
        ax.add_patch(wow)
        
    elif action in ["think", "confused", "meditate"]:
        # One high eye, one low, flat mouth
        ax.scatter([x+ex_l], [y+ey-2], s=3, color="black", zorder=15)
        ax.scatter([x+ex_r], [y+ey+2], s=3, color="black", zorder=15)
        ax.plot([x+mx_l, x+mx_r], [y+my, y+my], color="black", lw=1.0, zorder=15)

    elif action == "love":
        # Heart eyes
        ax.text(x+ex_l, y+ey, "♥", color="red", fontsize=10, ha="center", va="center", zorder=15)
        ax.text(x+ex_r, y+ey, "♥", color="red", fontsize=10, ha="center", va="center", zorder=15)
        ax.plot([x+mx_l, x+mx_r], [y+my], color="black", lw=1.0, zorder=15)
        
    else:
        # Default
        ax.scatter([x+ex_l, x+ex_r], [y+ey, y+ey], s=3, color="black", zorder=15)


def _draw_skeleton(ax, js: JointState, trail_history: List[JointState], frame: int, action: str = "idle"):
    """Draw the stick figure bones, joints, glow trails, hair, and face."""

    BONE_COLOR  = "#111111"
    JOINT_COLOR = "white"
    JOINT_EDGE  = "#111111"
    GLOW_COLOR  = "#00FFFF"   # cyan

    # ── 1. Cyan glow trails ───────────────────────────────────────────────────
    trail_joints = ["hand_l", "hand_r", "foot_l", "foot_r",
                    "elbow_l", "elbow_r", "knee_l", "knee_r"]

    for past_idx, past_js in enumerate(trail_history):
        alpha = _joint_trail_alpha(past_idx, len(trail_history))
        size = 18 + past_idx * 4   # larger for newer trail
        for jname in trail_joints:
            pos = getattr(past_js, jname)
            ax.scatter(pos[0], pos[1], s=size, color=GLOW_COLOR,
                       alpha=alpha, zorder=5, linewidths=0)

    # ── 2. Bones (lines) ─────────────────────────────────────────────────────
    bones = [
        (js.hip,        js.spine_top),      # torso
        (js.spine_top,  js.shoulder_l),     # collar L
        (js.spine_top,  js.shoulder_r),     # collar R
        (js.shoulder_l, js.elbow_l),        # upper arm L
        (js.elbow_l,    js.hand_l),         # forearm L
        (js.shoulder_r, js.elbow_r),        # upper arm R
        (js.elbow_r,    js.hand_r),         # forearm R
        (js.hip,        js.knee_l),         # upper leg L
        (js.knee_l,     js.foot_l),         # lower leg L
        (js.hip,        js.knee_r),         # upper leg R
        (js.knee_r,     js.foot_r),         # lower leg R
    ]

    for (p0, p1) in bones:
        ax.plot([p0[0], p1[0]], [p0[1], p1[1]],
                color=BONE_COLOR, lw=2.5, solid_capstyle="round",
                solid_joinstyle="round", zorder=10)

    # ── 3. Head circle ────────────────────────────────────────────────────────
    head_circle = plt.Circle(
        (js.head[0], js.head[1]),
        BONE_LENGTHS["head"],
        color=JOINT_COLOR, ec=BONE_COLOR, lw=2.5, zorder=11
    )
    ax.add_patch(head_circle)

    # ── 4. Joint dots ─────────────────────────────────────────────────────────
    joint_dots = [
        js.elbow_l, js.hand_l, js.elbow_r, js.hand_r,
        js.knee_l,  js.foot_l, js.knee_r,  js.foot_r,
        js.spine_top, js.hip,
    ]
    for pt in joint_dots:
        ax.scatter(pt[0], pt[1], s=40, color=JOINT_COLOR,
                   edgecolors=JOINT_EDGE, linewidths=1.5, zorder=12)

    # ── 5. Floating hair lines ────────────────────────────────────────────────
    _hair_lines(ax, js.head, 270, frame)
    
    # ── 6. Face expressions ───────────────────────────────────────────────────
    _draw_face(ax, js.head, action, frame)


def render_frame(
    js: JointState,
    trail_history: List[JointState],
    speech_text: str,
    frame: int,
    action: str = "idle",
    body_rotation_deg: float = 0.0,
) -> np.ndarray:
    """
    Render a single frame. Returns an (H, W, 3) uint8 numpy array.
    """
    fig, ax = plt.subplots(figsize=(FIG_SIZE, FIG_SIZE), dpi=DPI)
    ax.set_facecolor("white")
    fig.patch.set_facecolor("white")
    ax.set_xlim(0, CANVAS_W)
    ax.set_ylim(CANVAS_H, 0)   # flip y so 0 is top
    ax.set_aspect("equal")
    ax.axis("off")
    ax.margins(0)

    # Apply body rotation transform centered on figure's hip
    if abs(body_rotation_deg) > 0.001:
        cx, cy = js.hip[0], js.hip[1]
        transform = (
            Affine2D()
            .translate(-cx, -cy)
            .rotate_deg(body_rotation_deg)
            .translate(cx, cy)
            + ax.transData
        )
        ax.set_transform(transform)

    _draw_skeleton(ax, js, trail_history, frame, action=action)
    _draw_speech_bubble(ax, js.head, speech_text, frame)

    # Convert figure to numpy array
    fig.tight_layout(pad=0)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=DPI, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)

    buf.seek(0)
    from PIL import Image
    img = Image.open(buf).convert("RGB").resize((CANVAS_W, CANVAS_H))
    return np.array(img)
