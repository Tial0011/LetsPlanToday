from PIL import Image, ImageDraw
import math, os

INK = (27, 46, 42, 255)
PAPER = (243, 242, 237, 255)
MARIGOLD = (226, 163, 61, 255)
MARIGOLD_DARK = (198, 134, 42, 255)
DAWN = (127, 166, 176, 255)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SCRIPT_DIR, "..", "assets", "icons")
os.makedirs(OUT, exist_ok=True)

def draw_mark(size, padding_px, bg, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background
    if maskable:
        d.rectangle([0, 0, size, size], fill=bg)
    else:
        r = int(size * 0.22)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg)

    cx, cy = size / 2, size / 2
    pad = padding_px
    sun_r = (size - 2 * pad) * 0.30

    # day-arc gradient ring behind the sun (dawn -> marigold), drawn as an arc
    ring_r = (size - 2 * pad) * 0.46
    ring_w = max(2, size * 0.045)
    steps = 60
    for i in range(steps):
        t = i / (steps - 1)
        start = -150 + t * 300
        end = start + 300 / steps + 1
        col = tuple(int(DAWN[c] + (MARIGOLD[c] - DAWN[c]) * t) for c in range(3)) + (255,)
        d.arc([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r], start, end, fill=col, width=int(ring_w))

    # sun disc
    d.ellipse([cx - sun_r, cy - sun_r, cx + sun_r, cy + sun_r], fill=MARIGOLD)

    # rays
    ray_len = sun_r * 0.55
    ray_start = sun_r * 1.25
    ray_w = max(2, size * 0.018)
    for i in range(8):
        ang = math.radians(i * 45)
        x1 = cx + ray_start * math.cos(ang)
        y1 = cy + ray_start * math.sin(ang)
        x2 = cx + (ray_start + ray_len) * math.cos(ang)
        y2 = cy + (ray_start + ray_len) * math.sin(ang)
        d.line([x1, y1, x2, y2], fill=MARIGOLD_DARK, width=int(ray_w))

    return img

# Standard (any) icons — rounded square, transparent-safe
for size in [192, 512]:
    img = draw_mark(size, padding_px=size * 0.14, bg=PAPER, maskable=False)
    img.save(f"{OUT}/icon-{size}.png")

# Maskable icons — full-bleed bg, content kept inside the safe zone (~40% padding)
for size in [192, 512]:
    img = draw_mark(size, padding_px=size * 0.22, bg=INK, maskable=True)
    img.save(f"{OUT}/icon-{size}-maskable.png")

# Apple touch icon (no transparency, rounded handled by iOS itself)
img = draw_mark(180, padding_px=180 * 0.16, bg=PAPER, maskable=False)
img.convert("RGB").save(f"{OUT}/apple-touch-icon.png")

# Favicon
img = draw_mark(64, padding_px=64 * 0.12, bg=PAPER, maskable=False)
img.save(f"{OUT}/favicon-64.png")
img32 = img.resize((32, 32), Image.LANCZOS)
img32.save(f"{OUT}/favicon-32.png")

print("done")
