"""Regenerate the landing-page's header/footer brand mark from ../assets/Frame.png.

    pip install pillow
    python landing-page/tool/generate_brand_mark.py        # run from the repo root

Frame.png is a flat mark exported on a solid black canvas (no real alpha) - the
near-black background is keyed out to transparency, matching how the same
source is turned into the Flutter launcher icon (../frontend/tool/generate_app_icons.py)
and the admin-dashboard's favicons (../admin-dashboard/tool/generate_favicons.py).

The landing-page's own favicon set is intentionally NOT regenerated here - it
stays as its own static asset, independent of this source.

Writes:
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
IMAGES_DIR = os.path.join(REPO_ROOT, "landing-page", "public", "images")

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

    print("brand mark (header/footer):")
    write_png(render_silhouette(artwork, 128, MARK_INK), os.path.join(IMAGES_DIR, "brand-mark-ink.png"))
    write_png(render_silhouette(artwork, 128, MARK_LIGHT), os.path.join(IMAGES_DIR, "brand-mark-light.png"))
