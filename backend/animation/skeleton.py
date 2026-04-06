"""
Skeleton Data Model
12-bone 2D stick figure with forward-kinematics helpers.

Bone index map:
  0  head (circle)
  1  torso
  2  upper_arm_L
  3  forearm_L
  4  hand_L   (dot)
  5  upper_arm_R
  6  forearm_R
  7  hand_R   (dot)
  8  upper_leg_L
  9  lower_leg_L
  10 foot_L   (dot)
  11 upper_leg_R
  12 lower_leg_R
  13 foot_R   (dot)
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple


# ── Bone lengths (in canvas pixels, 800×800 coord space) ─────────────────────
BONE_LENGTHS = {
    "head":        30,   # radius of head circle
    "torso":       90,
    "upper_arm":   55,
    "forearm":     45,
    "upper_leg":   65,
    "lower_leg":   55,
}

# ── Canvas ────────────────────────────────────────────────────────────────────
CANVAS_W = 800
CANVAS_H = 800
ROOT_GROUND = np.array([400.0, 580.0])   # hip position when grounded


@dataclass
class JointState:
    """Represents a single frame's full joint positions."""
    # all positions as (x, y) in canvas pixels
    hip:        np.ndarray = field(default_factory=lambda: ROOT_GROUND.copy())
    spine_top:  np.ndarray = field(default_factory=lambda: np.zeros(2))
    head:       np.ndarray = field(default_factory=lambda: np.zeros(2))
    shoulder_l: np.ndarray = field(default_factory=lambda: np.zeros(2))
    elbow_l:    np.ndarray = field(default_factory=lambda: np.zeros(2))
    hand_l:     np.ndarray = field(default_factory=lambda: np.zeros(2))
    shoulder_r: np.ndarray = field(default_factory=lambda: np.zeros(2))
    elbow_r:    np.ndarray = field(default_factory=lambda: np.zeros(2))
    hand_r:     np.ndarray = field(default_factory=lambda: np.zeros(2))
    knee_l:     np.ndarray = field(default_factory=lambda: np.zeros(2))
    foot_l:     np.ndarray = field(default_factory=lambda: np.zeros(2))
    knee_r:     np.ndarray = field(default_factory=lambda: np.zeros(2))
    foot_r:     np.ndarray = field(default_factory=lambda: np.zeros(2))

    def all_joints(self) -> List[Tuple[str, np.ndarray]]:
        return [
            ("hip", self.hip),
            ("spine_top", self.spine_top),
            ("head", self.head),
            ("shoulder_l", self.shoulder_l),
            ("elbow_l", self.elbow_l),
            ("hand_l", self.hand_l),
            ("shoulder_r", self.shoulder_r),
            ("elbow_r", self.elbow_r),
            ("hand_r", self.hand_r),
            ("knee_l", self.knee_l),
            ("foot_l", self.foot_l),
            ("knee_r", self.knee_r),
            ("foot_r", self.foot_r),
        ]


def build_joint_state(
    hip: np.ndarray,
    torso_angle: float,        # degrees, 90=up
    head_tilt: float,          # degrees relative to torso top
    l_shoulder_angle: float,   # degrees from vertical (torso axis), + = forward
    l_elbow_angle: float,      # degrees, bend of elbow
    r_shoulder_angle: float,
    r_elbow_angle: float,
    l_hip_angle: float,        # degrees from downward vertical
    l_knee_angle: float,       # knee bend
    r_hip_angle: float,
    r_knee_angle: float,
) -> JointState:
    """
    Forward kinematics: given root + joint angles → all joint positions.
    All angles in degrees.  Coordinate: y increases downward (screen space).
    """
    js = JointState()
    js.hip = hip.copy()

    def polar(origin: np.ndarray, angle_deg: float, length: float) -> np.ndarray:
        """Move from origin in direction angle_deg (0=right, 90=down in screen)."""
        rad = np.deg2rad(angle_deg)
        return origin + np.array([np.cos(rad), np.sin(rad)]) * length

    # torso goes upward from hip → angle 90° means straight up (screen: -y)
    # In screen coords: "up" is -y, so torso_angle=90 means angle_deg = -90 (pointing up)
    spine_dir = torso_angle  # user passes 270 for straight-up in screen coords
    js.spine_top = polar(hip, spine_dir, BONE_LENGTHS["torso"])

    # Head sits on top of spine
    head_dir = spine_dir + head_tilt
    js.head = polar(js.spine_top, head_dir, BONE_LENGTHS["head"] + 5)

    # Shoulders at 80% of torso
    shoulder_base = hip + (js.spine_top - hip) * 0.82

    # Left arm
    l_arm_dir = spine_dir + 90 + l_shoulder_angle   # left = +90 from torso
    js.shoulder_l = shoulder_base.copy()
    js.elbow_l = polar(js.shoulder_l, l_arm_dir, BONE_LENGTHS["upper_arm"])
    js.hand_l   = polar(js.elbow_l,   l_arm_dir + l_elbow_angle, BONE_LENGTHS["forearm"])

    # Right arm (mirror side)
    r_arm_dir = spine_dir - 90 + r_shoulder_angle
    js.shoulder_r = shoulder_base.copy()
    js.elbow_r = polar(js.shoulder_r, r_arm_dir, BONE_LENGTHS["upper_arm"])
    js.hand_r   = polar(js.elbow_r,   r_arm_dir - r_elbow_angle, BONE_LENGTHS["forearm"])

    # Left leg
    l_leg_dir = 90 + l_hip_angle   # 90 = straight down in screen, + = forward
    js.knee_l = polar(hip, l_leg_dir, BONE_LENGTHS["upper_leg"])
    js.foot_l = polar(js.knee_l, l_leg_dir + l_knee_angle, BONE_LENGTHS["lower_leg"])

    # Right leg
    r_leg_dir = 90 + r_hip_angle
    js.knee_r = polar(hip, r_leg_dir, BONE_LENGTHS["upper_leg"])
    js.foot_r = polar(js.knee_r, r_leg_dir + r_knee_angle, BONE_LENGTHS["lower_leg"])

    return js
