import cv2, numpy as np, potrace, cairosvg
S = 4
tile = np.load('tile.npy'); h, w = tile.shape
g = cv2.GaussianBlur(np.tile(tile, (1, 3)), (0, 0), 0.8)
g8 = cv2.normalize(g, None, 0, 255, cv2.NORM_MINMAX).astype('uint8')
t, _ = cv2.threshold(g8, 0, 255, cv2.THRESH_OTSU); bits = g8 > t + 15
pl = potrace.Bitmap(~bits).trace(turdsize=40, alphamax=1.1, opticurve=True, opttolerance=0.4)
sc = 1 / S; d = []
f = lambda p: f'{p.x*sc:.2f},{p.y*sc:.2f}'
for c in pl:
    # keep only curves touching the middle period
    xs = [c.start_point.x] + [s.end_point.x for s in c.segments]
    if max(xs) < w - 2 or min(xs) > 2 * w + 2: continue
    d.append('M' + f(c.start_point))
    for s in c.segments:
        d.append(f'L{f(s.c)}L{f(s.end_point)}' if s.is_corner else f'C{f(s.c1)} {f(s.c2)} {f(s.end_point)}')
    d.append('Z')
W, Hh, X0 = w * sc, h * sc, w * sc
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{X0:.2f} 0 {W:.2f} {Hh:.2f}" width="{W*4:.0f}" height="{Hh*4:.0f}">'
       f'<defs><clipPath id="tile"><rect x="{X0:.2f}" y="0" width="{W:.2f}" height="{Hh:.2f}"/></clipPath></defs>'
       f'<path clip-path="url(#tile)" fill="#c9a54a" fill-rule="evenodd" d="{"".join(d)}"/></svg>')
open('/home/claude/anthemion_tile.svg', 'w').write(svg)
# preview: tile repeated 3x on dark ground, to check seams
prev = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {3*W:.2f} {Hh:.2f}" width="1200">'
        f'<rect width="100%" height="100%" fill="#1d2a24"/>' +
        ''.join(f'<svg x="{i*W:.2f}" width="{W:.2f}" height="{Hh:.2f}" viewBox="{X0:.2f} 0 {W:.2f} {Hh:.2f}">{svg[svg.index(">")+1:-6]}</svg>' for i in range(3)) + '</svg>')
cairosvg.svg2png(bytestring=prev.encode(), write_to='tile_check.png')
print(W, Hh, len(svg))
