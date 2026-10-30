import cv2, numpy as np, json, potrace, cairosvg

S = 4
stack = np.load('stack.npy')
period = json.load(open('period.json'))['period4x']

# --- crop to the main band: rows between the outer rules (rows with strong b* everywhere)
rowm = stack.mean(1)
print('row profile', [int(v) for v in rowm[::8]])

def symmetrise(a):
    best = None
    w = a.shape[1]
    for c2 in range(int(w * 0.8), int(w * 1.2)):  # c2 = 2*axis
        lo = max(0, c2 - w + 1); hi = min(w, c2 + 1)
        A = a[:, lo:hi]; Bf = a[:, c2 - np.arange(lo, hi)]
        if hi - lo < w * 0.6: continue
        sc = np.corrcoef(A.ravel(), Bf.ravel())[0, 1]
        if best is None or sc > best[0]: best = (sc, c2)
    sc, c2 = best
    print('mirror axis', c2 / 2, 'corr', round(sc, 4))
    # mirror via remap around axis, with periodic wrap
    xs = (c2 - np.arange(w)) % w
    return (a + a[:, xs]) / 2, c2 / 2

def periodic_tile(a, period):
    # stretch tile (width w) to exactly one period
    return cv2.resize(a, (int(round(period)), a.shape[0]), interpolation=cv2.INTER_CUBIC)

def to_svg(bits, scale, fname, alphamax=1.0, turd=2, opttol=0.2, fill='#c9a54a', bg='#1d2a24'):
    bm = potrace.Bitmap(~bits)
    plist = bm.trace(turdsize=turd, alphamax=alphamax, opticurve=True, opttolerance=opttol)
    d = []; nseg = 0
    for curve in plist:
        sp = curve.start_point; d.append(f'M{sp.x*scale:.2f},{sp.y*scale:.2f}')
        for seg in curve.segments:
            nseg += 1
            if seg.is_corner:
                d.append(f'L{seg.c.x*scale:.2f},{seg.c.y*scale:.2f}L{seg.end_point.x*scale:.2f},{seg.end_point.y*scale:.2f}')
            else:
                d.append(f'C{seg.c1.x*scale:.2f},{seg.c1.y*scale:.2f} {seg.c2.x*scale:.2f},{seg.c2.y*scale:.2f} {seg.end_point.x*scale:.2f},{seg.end_point.y*scale:.2f}')
        d.append('Z')
    h, w = bits.shape
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w*scale:.1f} {h*scale:.1f}" '
           f'width="{w*scale:.0f}" height="{h*scale:.0f}"><rect width="100%" height="100%" fill="{bg}"/>'
           f'<path fill="{fill}" fill-rule="evenodd" d="{"".join(d)}"/></svg>')
    open(fname, 'w').write(svg)
    print(fname, 'paths', len(plist), 'segments', nseg, 'bytes', len(svg))
    return svg

# ---------- improved pipeline ----------
sym, axis = symmetrise(stack)
tile = periodic_tile(sym, period)[30:432]
np.save('tile.npy', tile)
N = 7
strip = np.tile(tile, (1, N))
g = cv2.GaussianBlur(strip, (0, 0), 0.8)
g8 = cv2.normalize(g, None, 0, 255, cv2.NORM_MINMAX).astype('uint8')
t, _ = cv2.threshold(g8, 0, 255, cv2.THRESH_OTSU); bw = ((g8 > t + 15) * 255).astype('uint8')
cv2.imwrite('improved_bits.png', bw)
to_svg(bw > 0, 1 / S, 'frieze_improved.svg', alphamax=1.1, turd=40, opttol=0.4)

# ---------- baseline: Vectorious-style (luminance, Otsu, turdsize 2, alphamax 1) ----------
im = cv2.imread('/mnt/user-data/uploads/birdsAustraliav6Goul_0344.jpeg')
gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
# same physical region: top band, 7 repeats
y0, x0 = 95 + 30 // S, 460
crop = gray[y0:y0 + strip.shape[0] // S, x0:x0 + strip.shape[1] // S]
_, bb = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
cv2.imwrite('baseline_bits.png', bb)
to_svg(bb > 0, 1, 'frieze_potrace_baseline.svg', alphamax=1.0, turd=2, opttol=0.2)
cv2.imwrite('orig_crop.png', im[y0:y0 + strip.shape[0] // S, x0:x0 + strip.shape[1] // S])
