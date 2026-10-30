#!/usr/bin/env python3
"""Build Bear Beat's two deliverables from index.html + assets/bear.glb.

  bear.json                       base64 GLB beside index.html (the claude.ai artifact host
                                  serves .json but refuses .glb, so the page fetches this)
  dist/bear-beat-standalone.html  single file with the model inlined in
                                  <script type="application/json" id="bearData">; open it
                                  locally and the microphone works (artifacts block it)

Usage: python3 tools/build.py
"""
import base64, json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
glb = (root / 'assets' / 'bear.glb').read_bytes()
payload = json.dumps({'format': 'glb-base64', 'bytes': len(glb), 'data': base64.b64encode(glb).decode()})
(root / 'bear.json').write_text(payload)

# index.html is written for the artifact host, which wraps it in a doctype/head/body skeleton.
# The standalone build supplies that skeleton itself.
page = (root / 'index.html').read_text()
skeleton = ('<!doctype html><html><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>'
            '</head><body>')
out = skeleton + page + '\n<script type="application/json" id="bearData">' + payload + '</script>\n</body></html>'
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'bear-beat-standalone.html').write_text(out)
print(f'bear.json {len(payload)/1e6:.1f} MB, dist/bear-beat-standalone.html {len(out)/1e6:.1f} MB')
