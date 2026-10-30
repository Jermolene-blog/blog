#!/usr/bin/env python3
"""Inline assets/bear.glb (base64) into src/bowling-bear.src.html -> dist/bowling-bear.html"""
import base64, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'src/bowling-bear.src.html').read_text()
b64 = base64.b64encode((root / 'assets/bear.glb').read_bytes()).decode()
assert src.count('__BEAR_B64__') == 1
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/bowling-bear.html').write_text(src.replace('__BEAR_B64__', b64))
print('wrote dist/bowling-bear.html')
