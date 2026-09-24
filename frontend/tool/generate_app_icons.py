"""Regenerate the Android and iOS launcher icons from ../assets/Frame.png.

    pip install pillow
    python frontend/tool/generate_app_icons.py        # run from the repo root

The source is a flat mark exported on a solid black canvas (no real alpha), which
neither platform can use directly:

* iOS rejects alpha in app icons (the 1024px marketing icon especially), so
  every slot is flattened onto BACKGROUND.
* Android 8+ composes an *adaptive* icon from a separate background and
  foreground layer and lets the launcher mask it to whatever shape the device
  uses, so the artwork has to sit inside the central 66dp safe zone of a 108dp
  canvas or the corners get clipped. Older launchers fall back to the legacy
  square bitmaps, which get their own rounded-rect plate here.

BACKGROUND is AppColors.ink900 (lib/core/theme/app_colors.dart), so the icon
plate matches the app's own dark surface.
"""

import json
import os

from PIL import Image, ImageDraw

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(REPO_ROOT, "assets", "Frame.png")
ANDROID_RES = os.path.join(REPO_ROOT, "frontend", "android", "app", "src", "main", "res")
IOS_APPICON = os.path.join(
    REPO_ROOT, "frontend", "ios", "Runner", "Assets.xcassets", "AppIcon.appiconset"
)

BACKGROUND = (13, 15, 21)  # #0D0F15 - oklch(0.17 0.012 265), AppColors.ink900

# Fraction of the canvas the artwork's longest side occupies.
IOS_SCALE = 0.72
LEGACY_SCALE = 0.64
# 108dp canvas, 66dp safe zone. 0.60 puts the art at 64.8dp - just inside it.
ADAPTIVE_SCALE = 0.60

# dpi bucket -> legacy launcher px, adaptive layer px (108dp at that density)
ANDROID_DENSITIES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}


def _key_out_black(img, threshold=16):
    """Sources exported on a solid black canvas carry no real alpha (every
    pixel is opaque). Treat near-black as transparent so the art composites
    onto BACKGROUND like a proper cutout instead of painting over it."""
    mask = img.convert("L").point(lambda p: 0 if p <= threshold else 255)
    img.putalpha(mask)
    return img


def load_artwork():
    """The source cropped to its opaque bounds, so scaling is about the art
    rather than about however much empty margin the export happened to have."""
    art = Image.open(SOURCE).convert("RGBA")
    if art.getchannel("A").getextrema() == (255, 255):
        art = _key_out_black(art)
    return art.crop(art.getbbox())


def place(art, canvas_size, scale):
    """[art] centred on a transparent [canvas_size] square, its longest side
    taking up [scale] of the canvas."""
    target = max(1, round(canvas_size * scale))
    ratio = target / max(art.size)
    resized = art.resize(
        (max(1, round(art.width * ratio)), max(1, round(art.height * ratio))),
        Image.LANCZOS,
    )
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.alpha_composite(
        resized,
        ((canvas_size - resized.width) // 2, (canvas_size - resized.height) // 2),
    )
    return canvas


def rounded_plate(size):
    """Opaque rounded square in BACKGROUND - the legacy (pre-API-26) plate,
    which launchers of that era draw unmasked."""
    plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(plate).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=round(size * 0.22), fill=BACKGROUND + (255,)
    )
    return plate


def circle_plate(size):
    plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(plate).ellipse((0, 0, size - 1, size - 1), fill=BACKGROUND + (255,))
    return plate


def write_png(image, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, "PNG", optimize=True)
    print(f"  {os.path.relpath(path, REPO_ROOT)}")


def generate_android(art):
    print("android:")
    for bucket, (legacy_px, adaptive_px) in ANDROID_DENSITIES.items():
        mipmap = os.path.join(ANDROID_RES, f"mipmap-{bucket}")

        square = rounded_plate(legacy_px)
        square.alpha_composite(place(art, legacy_px, LEGACY_SCALE))
        write_png(square, os.path.join(mipmap, "ic_launcher.png"))

        round_icon = circle_plate(legacy_px)
        round_icon.alpha_composite(place(art, legacy_px, LEGACY_SCALE))
        write_png(round_icon, os.path.join(mipmap, "ic_launcher_round.png"))

        # Adaptive foreground: art only, on transparency. The background layer
        # is a colour resource, so it needs no bitmap.
        write_png(
            place(art, adaptive_px, ADAPTIVE_SCALE),
            os.path.join(mipmap, "ic_launcher_foreground.png"),
        )


def generate_ios(art):
    print("ios:")
    with open(os.path.join(IOS_APPICON, "Contents.json"), encoding="utf-8") as fh:
        contents = json.load(fh)

    # Several slots share a filename across idioms (e.g. 20x20@2x is listed for
    # both iphone and ipad); render each file once, at its largest requested px.
    wanted = {}
    for entry in contents["images"]:
        filename = entry.get("filename")
        if not filename:
            continue
        points = float(entry["size"].split("x")[0])
        pixels = round(points * float(entry["scale"].rstrip("x")))
        wanted[filename] = max(wanted.get(filename, 0), pixels)

    for filename, pixels in sorted(wanted.items(), key=lambda kv: kv[1]):
        icon = Image.new("RGBA", (pixels, pixels), BACKGROUND + (255,))
        icon.alpha_composite(place(art, pixels, IOS_SCALE))
        # Flatten to RGB: iOS app icons must carry no alpha channel at all.
        write_png(icon.convert("RGB"), os.path.join(IOS_APPICON, filename))


if __name__ == "__main__":
    artwork = load_artwork()
    print(f"source {os.path.relpath(SOURCE, REPO_ROOT)} cropped to {artwork.size}")
    generate_android(artwork)
    generate_ios(artwork)
