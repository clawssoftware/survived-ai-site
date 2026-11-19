#!/usr/bin/env python3
"""
Landing-page stills: frames from the SurvivedAI shorts, cropped above the
burned-in captions (captions sit around y=1500..1600 in the 1080x1920 frames),
graded, and encoded to AVIF + WebP. Output is committed to site/assets/img,
so there is no build step at deploy time.

  python3 tools/build-stills.py

Needs ffmpeg (FFMPEG env var or ~/.local/bin/ffmpeg) and Pillow with AVIF.
"""
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EP = os.path.join(os.path.dirname(ROOT), "episodes")
OUT = os.path.join(ROOT, "site", "assets", "img")
FFMPEG = os.environ.get("FFMPEG", os.path.expanduser("~/.local/bin/ffmpeg"))


def clean_mp4(ep):
    d = next(x for x in os.listdir(EP) if x.startswith(ep + "-"))
    clean = os.path.join(EP, d, "out", "clean")
    return os.path.join(clean, next(f for f in os.listdir(clean) if f.endswith(".mp4")))


# The aliens short has no captionless "clean" export; its captions sit in the same band.
ALIENS = os.path.join(EP, "103-whatif-aliens", "out", "SurvivedAI-WhatIf-Aliens.mp4")


def grab(ep, t):
    return grab_file(clean_mp4(ep), t)


def grab_file(video, t):
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        path = tmp.name
    subprocess.run([FFMPEG, "-v", "error", "-y", "-ss", str(t), "-i", video,
                    "-frames:v", "1", path], check=True)
    im = Image.open(path).convert("RGB")
    im.load()
    os.unlink(path)
    return im


def grade(im, cool=0.0, dim=1.0, sat=1.0):
    """Teal/ember grade: pull purple + green toward cool slate, keep orange hot."""
    hsv = np.asarray(im.convert("HSV")).astype(np.float32)
    h, s, v = hsv[..., 0] * (360 / 255), hsv[..., 1], hsv[..., 2]

    def band(x, lo, hi, soft):  # 1 inside [lo, hi], smooth falloff over `soft` degrees
        return np.clip(np.minimum(x - lo + soft, hi - x + soft) / soft, 0, 1)

    def smooth(x, a, b):
        t = np.clip((x - a) / (b - a), 0, 1)
        return t * t * (3 - 2 * t)

    hue_warm = np.maximum(band(h, -20, 40, 20), band(h, 340, 380, 20))
    # Protect the ember (warm, saturated) and its glow (bright) from dimming.
    keep = np.maximum(hue_warm * smooth(s, 30, 110), smooth(v, 170, 245))
    if cool:
        purple = band(h, 250, 320, 25) * cool
        green = band(h, 80, 180, 25) * cool * 0.8
        h = h + (215 - h) * purple
        h = h + (195 - h) * green
        s = s * (1 - 0.55 * np.maximum(purple, green))
    s = s * (sat + (1.05 - sat) * keep)
    v = v * (dim + (1 - dim) * keep)
    out = np.stack([h * 255 / 360, s, v], axis=-1).clip(0, 255).astype(np.uint8)
    return Image.merge("HSV", [Image.fromarray(out[..., i]) for i in range(3)]).convert("RGB")


def encode(im, name, widths, q_avif=52, q_webp=72):
    for w in widths:
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(os.path.join(OUT, f"{name}-{w}.avif"), quality=q_avif, speed=4)
        r.save(os.path.join(OUT, f"{name}-{w}.webp"), quality=q_webp, method=6)
        print(f"{name}-{w}", r.size)


def paste_ufo(base, ufo_frame):
    """Alien hero: drop the mothership from the cold open (same short, same night sky)
    into the empty sky above the truck shot, so Marcus, the ember and the UFO share a frame."""
    src = np.asarray(ufo_frame.crop((0, 600, 500, 1220))).astype(np.float32)
    bg = np.median(src[-60:, 200:420].reshape(-1, 3), axis=0)  # the navy sky behind the saucer
    dist = np.sqrt(((src - bg) ** 2).sum(-1))
    alpha = np.clip((dist - 14) / 30, 0, 1)
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    alpha *= np.clip((h - 1 - yy) / 40, 0, 1) * np.clip((w - 1 - xx) / 40, 0, 1)  # soften the crop edges
    scale = 0.86
    size = (round(w * scale), round(h * scale))
    sa = Image.fromarray((alpha * 255).astype(np.uint8)).resize(size, Image.LANCZOS)
    si = Image.fromarray(src.astype(np.uint8)).resize(size, Image.LANCZOS)
    out = base.copy()
    out.paste(si, (0, 10), sa)
    return out


# Hero: one still per rotating situation. Same output size so the layout never moves.
# (episode, seconds, crop box above the captions, grade)
HEROES = {
    "blackout": ("130", 21, (0, 0, 1080, 1180), dict(cool=0.75, dim=0.82, sat=0.9)),
    "storm": ("122", 8.5, (60, 420, 960, 1403), dict(cool=0.45, dim=0.82, sat=0.88)),
    "earthquake": ("127", 11.5, (0, 180, 1080, 1360), dict(dim=0.84, sat=0.9)),
    "alien": ("103", 27, (0, 0, 1080, 1180), dict(dim=0.9, sat=0.95)),
}
ONLY = os.environ.get("ONLY")
for name, (ep, t, box, g) in HEROES.items():
    if ONLY and ONLY != name:
        continue
    frame = grab(ep, t) if ep != "103" else grab_file(ALIENS, t)
    if name == "alien":
        frame = paste_ufo(frame, grab_file(ALIENS, 0.3))
    im = frame.crop(box).resize((1080, 1180), Image.LANCZOS)
    encode(grade(im, **g), f"hero-{name}", [720, 1080], q_avif=60, q_webp=74)
if ONLY:
    raise SystemExit

# Closing poster: the ember bot close-up from the "Bunker" short (power out, fridge food).
ember = grab("116", 19.8).crop((0, 60, 1080, 1260))
encode(grade(ember, dim=0.8, sat=0.85), "ember", [720, 1080])

# Shorts strip: 9:16 crops (810x1440) above the captions.
shorts = [
    ("tornado", "135", 12, 135),
    ("avalanche", "121", 13, 135),
    ("flood", "128", 4.5, 170),
    ("iceage", "134", 18, 90),
    ("gator", "112", 20, 135),
    ("quake", "127", 4.5, 135),
    ("tsunami", "113", 12, 200),
    ("wildfire", "126", 6, 120),
]
for name, ep, t, x in shorts:
    frame = grab(ep, t).crop((x, 30, x + 810, 1470))
    encode(grade(frame, dim=0.94, sat=0.95), f"short-{name}", [360, 600], q_avif=50, q_webp=70)
