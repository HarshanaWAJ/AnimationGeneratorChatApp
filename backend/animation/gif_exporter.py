"""
GIF Exporter — assembles rendered numpy frames into an 8-second looping GIF.
"""

import io
import numpy as np
from PIL import Image
from typing import List


FRAME_DURATION_MS = 42   # ≈ 24 fps  (1000 / 24 ≈ 41.67)


def frames_to_gif(frames: List[np.ndarray], output_size: tuple = (400, 400)) -> bytes:
    """
    Convert a list of (H, W, 3) uint8 numpy arrays to an optimized looping GIF.

    Args:
        frames: List of RGB numpy arrays
        output_size: (width, height) to resize to — smaller = faster transfer

    Returns:
        Raw bytes of the GIF file
    """
    pil_frames = []
    for frame_arr in frames:
        img = Image.fromarray(frame_arr, mode="RGB")
        img = img.resize(output_size, Image.LANCZOS)
        # Convert to palette mode for smaller GIF size
        img = img.convert("P", palette=Image.ADAPTIVE, colors=128)
        pil_frames.append(img)

    buf = io.BytesIO()
    pil_frames[0].save(
        buf,
        format="GIF",
        save_all=True,
        append_images=pil_frames[1:],
        loop=0,                     # infinite loop
        duration=FRAME_DURATION_MS,
        optimize=True,
        disposal=2,                 # restore to background between frames
    )
    buf.seek(0)
    return buf.read()


def frames_to_gif_file(frames: List[np.ndarray], path: str, output_size: tuple = (400, 400)):
    """Write GIF directly to a file path."""
    data = frames_to_gif(frames, output_size)
    with open(path, "wb") as f:
        f.write(data)
    print(f"[GIF] Saved {len(frames)} frames to {path}")
