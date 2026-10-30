#!/usr/bin/env python3
"""Write the jermolene.com toy's bear-model.js from assets/bear.glb.

The toy must work when opened from disk, where fetch() of a .json file fails,
so the model arrives as a script that sets window.BEAR_GLB to base64 GLB.

Usage: python3 tools/build_toy_model.py ../../static-assets/toys/bear-beat/bear-model.js
"""
import base64, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
glb = (root / 'assets' / 'bear.glb').read_bytes()
out = pathlib.Path(sys.argv[1])
out.write_text('// "Realistic Animated Bear 3D Model" by WildMesh 3D (CC BY 4.0) as base64 GLB\n'
               'window.BEAR_GLB="' + base64.b64encode(glb).decode() + '";\n')
print(f'{out} {out.stat().st_size/1e6:.1f} MB')
