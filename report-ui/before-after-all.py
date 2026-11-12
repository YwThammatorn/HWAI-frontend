# One before / after PDF for the whole advisor-comment round (Phases 0-4): "before" = the app as it was before the round (git 32e75ea, built and captured with the same script,
# same 1280x900 at 2x), "after" = the final capture.
#   python report-ui/before-after-all.py <before-dir> <after-dir> <captions.json> <out.pdf>
# One page per changed screen, "before" left, "after" right, red boxes on the "after" picture where it differs. A screen that is new has no "before".
import sys, os, json
from collections import deque
from PIL import Image, ImageChops, ImageDraw, ImageFont

before_dir, after_dir, captions_file, out_pdf = sys.argv[1:5]
NEW_ONLY = set(filter(None, os.environ.get("NEW_ONLY", "").split(",")))   # screens that did not exist before: whatever the old app showed there is not a "before"
captions = json.load(open(captions_file, encoding="utf8"))

def font(size):
    for p in ["C:/Windows/Fonts/tahoma.ttf", "C:/Windows/Fonts/leelawad.ttf", "C:/Windows/Fonts/segoeui.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def boxes(a, b, cell=16, thresh=30, pad=2):
    """bounding boxes (full-size pixels) of the areas where two same-size pictures differ"""
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

# cover page: what the pictures are
cover = Image.new("RGB", (W * 2 + 60, 1100), "white")
c = ImageDraw.Draw(cover)
INTRO = json.load(open(os.environ["INTRO_FILE"], encoding="utf8")) if os.environ.get("INTRO_FILE") else None   # a different cover (title + lines) for a smaller round
c.text((60, 60), INTRO["title"] if INTRO else "HWAI — ภาพก่อน/หลัง การแก้ตามความเห็นอาจารย์ที่ปรึกษา (10–11 พ.ย. 2569)", fill=(20, 20, 20), font=font(52))
lines = [
    "ซ้าย = ก่อนแก้ (ชุดที่แคปไว้ก่อนเริ่มรอบนี้)   ขวา = หลังแก้ (ชุดแคปสุดท้าย)   กรอบแดง = จุดที่ต่างกัน",
    "หน้าที่ไม่มีภาพซ้าย คือหน้าใหม่ที่ไม่เคยมีมาก่อน",
    "",
    "รอบนี้แก้อะไร (เรียงตามช่วงงาน):",
    "  เฟส 0  ป้ายและคำ: ป้ายสถานะการตรวจแทน Overdue/Past due, 'N to grade' แทน '2 Active', ชุดคำ Counts as / AI suggested / You gave,",
    "         Total Sections, ปุ่มลบห่างปุ่มปิดบัญชี, คะแนนสอบ (ปุ่ม Save ใต้ตาราง, ไอคอนกุญแจ), หน้านำเข้าเรียงแถวที่ผิดไว้บนสุด, ป้าย partial ใน Score Book",
    "  เฟส 1  หน้าผลคะแนนนักศึกษา (ความเห็นอาจารย์และคะแนนรายเกณฑ์ขึ้นก่อน, ตัด 'Better than N%') และผล Calibration (exact agreement, ±1, weighted kappa)",
    "  เฟส 2  หน้าตรวจงานแสดงเฟรมงาน Figma ที่บันทึกไว้ตอนส่ง + เหตุผลของ AI ต่อเกณฑ์ + จุดอ้างอิง (ใน Calibration แบบ Blind ด้วย)",
    "  เฟส 3  งานของ TA: อาจารย์มอบหมายงานให้ TA, คิวงานรอตรวจ/ตรวจแล้ว, Grading และ Score Book เห็นเฉพาะงานที่ได้รับมอบหมาย",
    "  เฟส 4  ข้อมูลตัวอย่างตรงกันทั้งชุด (ความเห็นอาจารย์ในงานของนักศึกษา, หน้าที่ยังไม่เปิดให้ตรวจไม่มีผลตรวจ) และแคปใหม่ที่สูงขึ้นให้เมนูซ้ายครบ",
    "",
    "ทุกหน้าฝั่งอาจารย์มีเมนูใหม่ 'Assign work to TAs' ต่อจาก Collaborators (ไม่ได้ทำกรอบแดงซ้ำทุกหน้า)",
    "ภาพทั้งสองชุดแคปด้วยวิธีเดียวกัน ขนาดเดียวกัน (1280×900 เท่า 2) จากแอปก่อนเริ่มรอบนี้กับแอปหลังแก้",
]
y = 190
for ln in (INTRO["lines"] if INTRO else lines):
    c.text((60, y), ln, fill=(40, 40, 40), font=font(32)); y += 56
pages.append(cover)

n_new = n_changed = 0
for name, caption in captions.items():
    fa = os.path.join(after_dir, name + ".png")
    fb = os.path.join(before_dir, name + ".png")
    if not os.path.exists(fa):
        print("missing after:", name); continue
    a = Image.open(fa).convert("RGB")
    ha = int(W * a.height / a.width)
    af = a.resize((W, ha), Image.LANCZOS)
    has_before = os.path.exists(fb) and name not in NEW_ONLY
    if has_before:
        b = Image.open(fb).convert("RGB")
        hb = int(W * b.height / b.width)
        bf = b.resize((W, hb), Image.LANCZOS)
        common = min(ha, hb)
        marked = af.copy()
        dr = ImageDraw.Draw(marked)
        for (x0, y0, x1, y1) in boxes(bf.crop((0, 0, W, common)), af.crop((0, 0, W, common))):
            for k in range(5):
                dr.rectangle([x0 - k, y0 - k, x1 + k, y1 + k], outline=(225, 29, 72))
        n_changed += 1
    else:
        bf = None; marked = af; hb = 0; n_new += 1
    h = max(ha, hb)
    page = Image.new("RGB", (W * 2 + 60, h + 230), "white")
    d = ImageDraw.Draw(page)
    d.text((30, 18), name, fill=(90, 90, 90), font=font(26))
    d.text((30, 56), caption, fill=(20, 20, 20), font=font(38))
    d.text((30, 150), "ก่อน (Before)", fill=(120, 20, 20), font=font(34))
    d.text((W + 60, 150), "หลัง (After)" + (" — กรอบแดง = จุดที่เปลี่ยน" if has_before else " — หน้าใหม่"), fill=(10, 100, 70), font=font(34))
    if bf is not None:
        page.paste(bf, (30, 200))
    else:
        d.rectangle([30, 200, 30 + W, 200 + 600], outline=(190, 190, 190), width=3)
        d.text((60, 460), "ไม่มีหน้านี้ในชุดก่อนแก้", fill=(130, 130, 130), font=font(44))
    page.paste(marked, (W + 30, 200))
    pages.append(page)

pages[0].save(out_pdf, save_all=True, append_images=pages[1:], resolution=150)
print("pages", len(pages), "· changed", n_changed, "· new", n_new, "→", out_pdf)
