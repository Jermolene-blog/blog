#!/usr/bin/env python3
"""Write the jermolene.com toy's car-model.js from assets/car.glb.

The toy must work when opened from disk, where fetch() of a .glb file fails,
so the model arrives as a script that sets window.CAR_GLB to base64 GLB.

Usage: python3 tools/build_car_model.py ../../static-assets/toys/trackaholic/car-model.js
"""
import base64, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
glb = (root / 'assets' / 'car.glb').read_bytes()
out = pathlib.Path(sys.argv[1])
out.write_text('// "Car Concept" by Eric Chadwick / Darmstadt Graphics Group (CC BY 4.0) as base64 GLB\n'
               'window.CAR_GLB="' + base64.b64encode(glb).decode() + '";\n')
print(f'{out} {out.stat().st_size/1e6:.1f} MB')
