"""Regenerate the landing-page's favicons and brand mark from ../assets/Frame.png.

    pip install pillow
    python landing-page/tool/generate_favicons.py        # run from the repo root

Frame.png is a flat mark exported on a solid black canvas (no real alpha) - the
near-black background is keyed out to transparency, matching how the same
source is turned into the Flutter launcher icon (../frontend/tool/generate_app_icons.py)
and the admin-dashboard's favicons (../admin-dashboard/tool/generate_favicons.py),
so the mark reads the same way across all three deployables.

Writes:
* src/app/favicon.ico     - multi-resolution (16/32/48), Next.js's App Router
                             auto-serves this at /favicon.ico.
* public/favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png,
  android-chrome-192x192.png, android-chrome-512x512.png
                             - the static favicon set referenced by the explicit
                               `icons` block in src/app/layout.tsx and by
                               src/app/manifest.ts.
* public/mstile-70x70.png, mstile-150x150.png, mstile-310x310.png,
  mstile-310x150.png        - Windows tiles referenced by public/browserconfig.xml.
* public/images/brand-mark-ink.png    - dark silhouette on transparent ground,
                               for use directly on the page's light background
                               (Header.tsx, next to the "Miravelt" wordmark).
* public/images/brand-mark-light.png  - light silhouette on transparent ground,
                               for use inside a dark badge (Footer.tsx).
"""

import os

from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(REPO_ROOT, "assets", "Frame.png")
LANDING_DIR = os.path.join(REPO_ROOT, "landing-page")
APP_DIR = os.path.join(LANDING_DIR, "src", "app")
PUBLIC_DIR = os.path.join(LANDING_DIR, "public")
IMAGES_DIR = os.path.join(PUBLIC_DIR, "images")

BACKGROUND = (2, 3, 3)  # #020203 - BRAND_INK, also the msapplication-TileColor
MARK_INK = (2, 3, 3)  # #020203 - BRAND_INK, silhouette for use on light ground
MARK_LIGHT = (242, 242, 242)  # #f2f2f2 - BRAND_BACKGROUND, silhouette for use on dark ground
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


def resized(art, target_long_side):
    ratio = target_long_side / max(art.size)
    return art.resize(
        (max(1, round(art.width * ratio)), max(1, round(art.height * ratio))),
        Image.LANCZOS,
    )


def render(art, width, height=None, rgba=False):
    height = height or width
    target = max(1, round(min(width, height) * SCALE))
    piece = resized(art, target)
    canvas = Image.new("RGBA", (width, height), BACKGROUND + (255,))
    canvas.alpha_composite(
        piece, ((width - piece.width) // 2, (height - piece.height) // 2)
    )
    return canvas if rgba else canvas.convert("RGB")


def render_silhouette(art, size, color):
    """Solid-`color` mark on a transparent square, sized to fit `size`."""
    piece = resized(art, max(1, round(size * SCALE)))
    solid = Image.new("RGBA", piece.size, color + (255,))
    solid.putalpha(piece.getchannel("A"))
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(solid, ((size - piece.width) // 2, (size - piece.height) // 2))
    return canvas


def write_png(image, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, "PNG", optimize=True)
    print(f"  {os.path.relpath(path, REPO_ROOT)}")


if __name__ == "__main__":
    artwork = load_artwork()
    print(f"source {os.path.relpath(SOURCE, REPO_ROOT)} cropped to {artwork.size}")

    print("app router auto-icon:")
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

    print("windows tiles:")
    write_png(render(artwork, 70), os.path.join(PUBLIC_DIR, "mstile-70x70.png"))
    write_png(render(artwork, 150), os.path.join(PUBLIC_DIR, "mstile-150x150.png"))
    write_png(render(artwork, 310), os.path.join(PUBLIC_DIR, "mstile-310x310.png"))
    write_png(render(artwork, 310, 150), os.path.join(PUBLIC_DIR, "mstile-310x150.png"))

    print("brand mark (header/footer):")
    write_png(render_silhouette(artwork, 128, MARK_INK), os.path.join(IMAGES_DIR, "brand-mark-ink.png"))
    write_png(render_silhouette(artwork, 128, MARK_LIGHT), os.path.join(IMAGES_DIR, "brand-mark-light.png"))
