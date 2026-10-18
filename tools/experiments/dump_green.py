import glob, os, numpy as np
from PIL import Image
files = sorted(glob.glob('out/vfg/*.png'))
prev = None
for i, fn in enumerate(files):
    arr = np.asarray(Image.open(fn).convert('RGB'), dtype=np.uint8)
    r = arr[:,:,0].astype(np.int16); g = arr[:,:,1].astype(np.int16); b = arr[:,:,2].astype(np.int16)
    m = (g > 150) & (r < 90) & (b < 90)
    cnt = int(m.sum())
    if cnt < 800:
        if prev is not None and i % 25 == 0:
            print(f'{i:4d} t={i/25:5.2f}  -')
        continue
    ys, xs = np.nonzero(m)
    print(f'{i:4d} t={i/25:5.2f} cnt={cnt:6d} cx={xs.mean():7.1f} bbox=[{xs.min()},{xs.max()}]')
