# Share of pixels that differ between two sets of screenshots (new vs the set before the advisor-comment work) → imgdiff.json for build-review.js.
#   python report-ui/imgdiff.py report-ui/shots-before-phase0 report-ui/shots report-ui/imgdiff.json
# A shot that exists only in the new set is null ("new picture"). Sizes can differ in height (the page was captured taller): the top part both have is compared.
import sys, os, json
from PIL import Image, ImageChops
old_dir, new_dir, out = sys.argv[1:4]
res = {}
for f in sorted(os.listdir(new_dir)):
    if not f.endswith(".png"): continue
    name = f[:-4]
    po = os.path.join(old_dir, f)
    if not os.path.exists(po):
        res[name] = None; continue
    a, b = Image.open(po).convert("L"), Image.open(os.path.join(new_dir, f)).convert("L")
    w, h = min(a.width, b.width), min(a.height, b.height)
    d = ImageChops.difference(a.crop((0, 0, w, h)), b.crop((0, 0, w, h))).point(lambda v: 255 if v > 40 else 0)
    res[name] = round(sum(1 for v in d.getdata() if v) / (w * h), 4)
json.dump(res, open(out, "w"), indent=1)
print(len(res), "shots;", sum(1 for v in res.values() if v is None), "new")
