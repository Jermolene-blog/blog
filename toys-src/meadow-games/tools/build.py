#!/usr/bin/env python3
"""Build single-file pages into dist/.

Each app is <app>/shell.html (title, style, markup) + <app>/app.js (ES module).
The 12 animal GLBs are base64-inlined as a JSON <script id="models"> block, because the
claude.ai artifact sandbox can't fetch or serve .glb files. three.js comes from jsDelivr
via an import map (the only allowed CDNs are cdnjs, jsdelivr/npm, unpkg).

usage: python3 tools/build.py            # builds all apps
       python3 tools/build.py games      # builds one
       python3 tools/build.py --site     # builds the jermolene.com toy

The --site build writes Meadow Games into the blog repo at static-assets/toys/meadow-games as
index.html (the toy's skeleton, PWA and index tags, shell and module) plus models.js, which sets
window.MEADOW_MODELS. Keeping the 7 MB of models in their own file means a code change doesn't add
another 7 MB to the blog's history, and a classic script still loads when the page is opened from disk.
"""
import base64, json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
APPS = {'games': 'meadow-games.html', 'meadow': 'animal-meadow.html', 'lineup': 'animal-lineup.html'}
THREE = '0.160.0'
IMPORTMAP = ('<script type="importmap">\n{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@%s/build/three.module.js",'
             '"three/addons/":"https://cdn.jsdelivr.net/npm/three@%s/examples/jsm/"}}\n</script>') % (THREE, THREE)

def models_block():
    d = {p.stem: base64.b64encode(p.read_bytes()).decode() for p in sorted((ROOT / 'assets/animals').glob('*.glb'))}
    return '<script type="application/json" id="models">' + json.dumps(d) + '</script>'

SITE = ROOT.parent.parent / 'static-assets/toys/meadow-games'
SITE_HEAD = ('<!doctype html><!-- Built by toys-src/meadow-games/tools/build.py --site in the blog repo: edit the source there, not this file --><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>' + '''
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#bfe3f2">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<script src="../pwa.js" defer></script>
</head><body>
<title>Meadow Games</title>
<meta name="description" content="Five tap-only 3D games for toddlers with a herd of cows, horses, foxes and friends: peekaboo, all fall down, bedtime in the barn, find the same and pairs">
<meta name="toy-category" content="games">
''')

def build_site():
    shell = (ROOT / 'games/shell.html').read_text()
    shell = '\n'.join(l for l in shell.splitlines() if not l.startswith(('<title>', '<meta name="claude:')))
    js = (ROOT / 'games/app.js').read_text()
    d = {p.stem: base64.b64encode(p.read_bytes()).decode() for p in sorted((ROOT / 'assets/animals').glob('*.glb'))}
    SITE.mkdir(exist_ok=True)
    (SITE / 'models.js').write_text('// The 12 Quaternius animals (CC0, quaternius.com) as base64 GLB, built from assets/animals\nwindow.MEADOW_MODELS=' + json.dumps(d) + ';\n')
    (SITE / 'index.html').write_text(SITE_HEAD + shell.strip() + '\n<script src="models.js"></script>\n' + IMPORTMAP + '\n<script type="module">\n' + js + '\n</script>\n</body></html>\n')
    for f in ('index.html', 'models.js'):
        print(f'{SITE / f}  {(SITE / f).stat().st_size / 1e6:.2f} MB')

def build(app):
    shell = (ROOT / app / 'shell.html').read_text()
    js = (ROOT / app / 'app.js').read_text()
    out = ROOT / 'dist' / APPS[app]
    out.write_text(shell.rstrip() + '\n' + models_block() + '\n' + IMPORTMAP + '\n<script type="module">\n' + js + '\n</script>\n')
    mb = out.stat().st_size / 1e6
    print(f'{out.relative_to(ROOT)}  {mb:.2f} MB' + ('   WARNING: artifact limit is 16 MB' if mb > 15 else ''))

if __name__ == '__main__':
    if sys.argv[1:] == ['--site']:
        build_site()
        sys.exit()
    (ROOT / 'dist').mkdir(exist_ok=True)
    for a in (sys.argv[1:] or APPS):
        build(a)
