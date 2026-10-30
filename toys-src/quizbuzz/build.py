#!/usr/bin/env python3
"""Build quizbuzz.html: embed the question bank, lightly scrambled."""
import base64, hashlib, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
KEY = b"quizbuzz"
CATS = ["hist", "geo", "tv", "film", "music", "sport", "food", "words", "sci", "xmas"]
src = sys.argv[1] if len(sys.argv) > 1 else "questions/verified"

bank, seen = [], set()
for c in CATS:
    path = os.path.join(ROOT, src, c + ".json")
    if not os.path.exists(path):
        path = os.path.join(ROOT, "q", c + ".json")
    items = json.load(open(path, encoding="utf-8"))
    for extra in (".pending.json", ".unverified.json"):
        xp = os.path.join(ROOT, src, c + extra)
        if os.path.exists(xp):
            items = items + json.load(open(xp, encoding="utf-8"))
    for i, it in enumerate(items):
        a = it["a"]
        assert len(a) == 4 and len(set(a)) == 4, (c, i, it)
        assert it["k"] in (0, 1, 2, 3) and it["d"] in (1, 2, 3), (c, i, it)
        key = it["q"].strip().lower()
        if key in seen:
            continue
        seen.add(key)
        bank.append({"id": c + "-" + hashlib.sha1(key.encode()).hexdigest()[:6], "c": c, "d": it["d"], "q": it["q"].strip(), "a": [s.strip() for s in a], "k": it["k"]})

raw = json.dumps(bank, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
enc = base64.b64encode(bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(raw))).decode()
FONTS = [("Shrikhand", 400, "fontsource-shrikhand-5.3.0/package/files/shrikhand-latin-400-normal.woff2"),
         ("Michroma", 400, "fontsource-michroma-5.3.0/package/files/michroma-latin-400-normal.woff2")] + \
        [("Jost", w, f"fontsource-jost-5.3.0/package/files/jost-latin-{w}-normal.woff2") for w in (400, 500, 600, 700, 800)]
faces = "".join(
    "@font-face{font-family:'%s';font-weight:%d;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}"
    % (fam, w, base64.b64encode(open(os.path.join(ROOT, "fonts", p), "rb").read()).decode()) for fam, w, p in FONTS)
html = open(os.path.join(ROOT, "src", "game.html"), encoding="utf-8").read().replace("__BANK__", enc).replace("/*__FONTS__*/", faces)
vendor = "".join("<script>" + open(os.path.join(ROOT, "vendor", f), encoding="utf-8").read().replace("</script", "<\\/script") + "</script>\n" for f in ("qrcode.min.js", "jsQR.min.js"))
html = html.replace("<!--__VENDOR__-->", vendor)
out = os.path.join(ROOT, "quizbuzz.html")
open(out, "w", encoding="utf-8").write(html)
print(f"{len(bank)} questions -> {out} ({len(html)//1024} KB)")
standalone = os.path.join(ROOT, "quizbuzz-standalone.html")
open(standalone, "w", encoding="utf-8").write('<!doctype html>\n<html lang="en-GB">\n' + html + "\n</html>\n")
print("standalone ->", standalone)

# ---- the toy on jermolene.com: static-assets/toys/quizbuzz/index.html in the blog repo ----
# The site's shared service worker (../pwa.js) and generated manifest make it work offline and installable.
site = os.path.normpath(os.path.join(ROOT, "..", "..", "static-assets", "toys", "quizbuzz"))
os.makedirs(site, exist_ok=True)
meta = ('<meta name="description" content="A family quiz show for Christmas: a 1960s TV studio on the big screen, '
        'a buzzer on everyone\'s phone, joined by QR code over the same Wi-Fi, and a toddler button with real power">\n'
        '<meta name="toy-category" content="games">\n<meta name="theme-color" content="#1d1411">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n<script src="../pwa.js" defer></script>\n')
page = '<!doctype html>\n<!-- Built by toys-src/quizbuzz/build.py in the blog repo: edit the source there, not this file -->\n<html lang="en-GB">\n' + html.replace("<title>Quizbuzz</title>\n", "<title>Quizbuzz</title>\n" + meta, 1) + "\n</html>\n"
assert meta in page
open(os.path.join(site, "index.html"), "w", encoding="utf-8").write(page)
print("site ->", site)
