# Before / after pictures of what a batch of changes did to the screens: one page per changed screen, "before" left, "after" right,
# the changed areas boxed in red on the "after" picture. Usage: python before-after-pdf.py <before-dir> <after-dir> <captions.json> <out.pdf>
import sys, os, json
from collections import deque
from PIL import Image, ImageChops, ImageDraw, ImageFont

before_dir, after_dir, captions_file, out_pdf = sys.argv[1:5]
captions = json.load(open(captions_file, encoding="utf8"))

def font(size):
    for p in ["C:/Windows/Fonts/tahoma.ttf", "C:/Windows/Fonts/leelawad.ttf", "C:/Windows/Fonts/segoeui.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def boxes(a, b, cell=16, thresh=30, pad=2):
    """bounding boxes (in full-size pixels) of the areas where two same-size pictures differ"""
    d = ImageChops.difference(a.convert("L"), b.convert("L")).point(lambda v: 255 if v > thresh else 0)
    gw, gh = d.width // cell + 1, d.height // cell + 1
    g = [[False] * gw for _ in range(gh)]
    px = d.load()
    for y in range(d.height):
        for x in range(d.width):
            if px[x, y]:
                g[y // cell][x // cell] = True
    seen = [[False] * gw for _ in range(gh)]
    out = []
    for gy in range(gh):
        for gx in range(gw):
            if not g[gy][gx] or seen[gy][gx]:
                continue
            q = deque([(gx, gy)]); seen[gy][gx] = True
            x0 = x1 = gx; y0 = y1 = gy
            while q:
                cx, cy = q.popleft()
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for dx in range(-pad, pad + 1):
                    for dy in range(-pad, pad + 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < gw and 0 <= ny < gh and g[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True; q.append((nx, ny))
            out.append(((x0 - 1) * cell, (y0 - 1) * cell, (x1 + 2) * cell, (y1 + 2) * cell))
    return out

W = 1500
pages = []
for name, caption in captions.items():
    fb, fa = os.path.join(before_dir, name + ".png"), os.path.join(after_dir, name + ".png")
    b, a = Image.open(fb).convert("RGB"), Image.open(fa).convert("RGB")
    marked = a.copy()
    dr = ImageDraw.Draw(marked)
    for (x0, y0, x1, y1) in boxes(b, a):
        for k in range(6):
            dr.rectangle([x0 - k, y0 - k, x1 + k, y1 + k], outline=(225, 29, 72))
    h = int(W * b.height / b.width)
    page = Image.new("RGB", (W * 2 + 60, h + 230), "white")
    d = ImageDraw.Draw(page)
    d.text((30, 18), name, fill=(90, 90, 90), font=font(26))
    d.text((30, 56), caption, fill=(20, 20, 20), font=font(40))
    d.text((30, 150), "ก่อน (Before)", fill=(120, 20, 20), font=font(34))
    d.text((W + 60, 150), "หลัง (After) — กรอบแดง = จุดที่เปลี่ยน", fill=(10, 100, 70), font=font(34))
    page.paste(b.resize((W, h), Image.LANCZOS), (30, 200))
    page.paste(marked.resize((W, h), Image.LANCZOS), (W + 30, 200))
    pages.append(page)

pages[0].save(out_pdf, save_all=True, append_images=pages[1:], resolution=150)
print("pages", len(pages), out_pdf)
