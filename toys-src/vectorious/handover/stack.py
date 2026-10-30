import cv2, numpy as np, sys
from scipy.signal import find_peaks

im = cv2.imread('/mnt/user-data/uploads/birdsAustraliav6Goul_0344.jpeg')
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
B = lab[:, :, 2]
H, W = B.shape
S = 4  # upscale factor

# Horizontal strips, each rotated so the outer edge is at the top
strips = {
    'top':    B[95:255, 260:1290],
    'bottom': cv2.rotate(np.ascontiguousarray(B[2320:2480, 260:1290]), cv2.ROTATE_180),
    'left':   cv2.rotate(np.ascontiguousarray(B[300:2300, 85:245]), cv2.ROTATE_90_CLOCKWISE),
    'right':  cv2.rotate(np.ascontiguousarray(B[300:2300, 1415:1575]), cv2.ROTATE_90_COUNTERCLOCKWISE),
}

# Period from autocorrelation of the top strip's column profile
top = strips['top']
prof = top[30:130].mean(0); prof -= prof.mean()
ac = np.correlate(prof, prof, 'full')[len(prof)-1:]
pk, _ = find_peaks(ac[40:300]); period0 = pk[np.argmax(ac[40:300][pk])] + 40
print('coarse period', period0)

# Template: one period (plus margin) from top strip at full height
x0 = 200
tmpl = top[:, x0:x0 + period0].copy()

def up(a): return cv2.resize(a, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)

# Refine template by a first-pass stack on top strip, then use for all strips
def collect(strip, tmpl):
    # allow vertical slack: template shorter than strip
    th = tmpl[20:-20]
    r = cv2.matchTemplate(strip, th, cv2.TM_CCOEFF_NORMED)
    col = r.max(0)
    pk, _ = find_peaks(col, distance=int(period0 * 0.8), height=0.35)
    out = []
    for x in pk:
        y = int(np.argmax(r[:, x]))
        # subpixel refine on upscaled patch
        xs, ys = max(x - 3, 0), max(y - 3, 0)
        patch = strip[ys:ys + th.shape[0] + 6, xs:xs + th.shape[1] + 6]
        if patch.shape[0] < th.shape[0] + 6 or patch.shape[1] < th.shape[1] + 6: continue
        rr = cv2.matchTemplate(up(patch), up(th), cv2.TM_CCOEFF_NORMED)
        _, sc, _, (dx, dy) = cv2.minMaxLoc(rr)
        out.append((sc, (xs * S + dx), (ys * S + dy)))
    return out

tiles = []
template = tmpl
for it in range(2):
    tiles = []; spac = {}
    for name, st in strips.items():
        U = up(st)
        hits = collect(st, template)
        th, tw = (template.shape[0] - 40) * S, template.shape[1] * S
        for sc, X, Y in hits:
            t = U[Y - 14*S:Y + th, X:X + tw]
            if Y >= 14*S and t.shape == (th + 14*S, tw): tiles.append(t); spac.setdefault(name, []).append(X)
        if it == 1: print(name, len(hits), 'repeats, mean score', np.mean([h[0] for h in hits]).round(3))
    stack = np.median(np.stack(tiles), 0)
    template = np.pad(cv2.resize(stack[14*S:], None, fx=1/S, fy=1/S, interpolation=cv2.INTER_AREA), ((20, 20), (0, 0)), mode='edge')

print('total tiles', len(tiles))
np.save('stack.npy', stack)
np.save('tiles.npy', np.stack(tiles))

import json
per=[np.median(np.diff(sorted(v))) for v in spac.values() if len(v)>3]
print('period at 4x per band', per)
json.dump({'period4x': float(np.median(per))}, open('period.json','w'))
