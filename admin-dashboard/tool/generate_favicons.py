"""Regenerate the admin-dashboard's favicons from ../assets/Frame.png.

    pip install pillow
    python admin-dashboard/tool/generate_favicons.py        # run from the repo root

Frame.png is a flat mark exported on a solid black canvas (no real alpha) - the
near-black background is keyed out to transparency, then flattened onto
BACKGROUND (the same AppColors.ink900 used for the Flutter launcher icon, see
../frontend/tool/generate_app_icons.py) so the mark reads the same way across
both deployables.

Writes:
* src/app/favicon.ico     - multi-resolution (16/32/48), Next.js's App Router
                             auto-serves this at /favicon.ico.
* src/app/icon.png        - Next.js App Router auto-icon convention (512px).
* src/app/apple-icon.png  - Next.js App Router auto Apple touch icon (180px).
* public/favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png,
  android-chrome-192x192.png, android-chrome-512x512.png, site.webmanifest
                             - the conventional static favicon set, for any
                               consumer that looks for explicit <link> tags
                               or a web manifest instead of the app-router
                               auto-detected files above.
"""

import json
import os

from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(REPO_ROOT, "assets", "Frame.png")
APP_DIR = os.path.join(REPO_ROOT, "admin-dashboard", "src", "app")
PUBLIC_DIR = os.path.join(REPO_ROOT, "admin-dashboard", "public")

BACKGROUND = (13, 15, 21)  # #0D0F15 - oklch(0.17 0.012 265), AppColors.ink900
SCALE = 0.72  # fraction of the canvas the artwork's longest side occupies


def _key_out_black(img, threshold=16):
    mask = img.convert("L").point(lambda p: 0 if p <= threshold else 255)
    img.putalpha(mask)
    return img


def load_artwork():
    art = Image.open(SOURCE).convert("RGBA")
    if art.getchannel("A").getextrema() == (255, 255):
        art = _key_out_black(art)
    return art.crop(art.getbbox())


def render(art, size, rgba=False):
    target = max(1, round(size * SCALE))
    ratio = target / max(art.size)
    resized = art.resize(
        (max(1, round(art.width * ratio)), max(1, round(art.height * ratio))),
        Image.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), BACKGROUND + (255,))
    canvas.alpha_composite(
        resized, ((size - resized.width) // 2, (size - resized.height) // 2)
    )
    return canvas if rgba else canvas.convert("RGB")


def write_png(image, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, "PNG", optimize=True)
    print(f"  {os.path.relpath(path, REPO_ROOT)}")


def write_webmanifest(path):
    manifest = {
        "name": "Miravelt Admin",
        "short_name": "Miravelt Admin",
        "icons": [
            {"src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png"},
        ],
        "theme_color": "#0D0F15",
        "background_color": "#0D0F15",
        "display": "standalone",
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")
    print(f"  {os.path.relpath(path, REPO_ROOT)}")


if __name__ == "__main__":
    artwork = load_artwork()
    print(f"source {os.path.relpath(SOURCE, REPO_ROOT)} cropped to {artwork.size}")

    print("app router auto-icons:")
    write_png(render(artwork, 512), os.path.join(APP_DIR, "icon.png"))
    write_png(render(artwork, 180), os.path.join(APP_DIR, "apple-icon.png"))
    # ICO frames must be RGBA - Next/Turbopack's decoder rejects RGB PNG frames.
    render(artwork, 48, rgba=True).save(
        os.path.join(APP_DIR, "favicon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print(f"  {os.path.relpath(os.path.join(APP_DIR, 'favicon.ico'), REPO_ROOT)}")

    print("static favicon set:")
    write_png(render(artwork, 16), os.path.join(PUBLIC_DIR, "favicon-16x16.png"))
    write_png(render(artwork, 32), os.path.join(PUBLIC_DIR, "favicon-32x32.png"))
    write_png(render(artwork, 180), os.path.join(PUBLIC_DIR, "apple-touch-icon.png"))
    write_png(render(artwork, 192), os.path.join(PUBLIC_DIR, "android-chrome-192x192.png"))
    write_png(render(artwork, 512), os.path.join(PUBLIC_DIR, "android-chrome-512x512.png"))
    write_webmanifest(os.path.join(PUBLIC_DIR, "site.webmanifest"))
