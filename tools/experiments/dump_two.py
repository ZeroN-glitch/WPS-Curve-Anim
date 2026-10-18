import glob, numpy as np
from PIL import Image
files = sorted(glob.glob('out/vf6/*.png'))
print('n=', len(files))
for i, fn in enumerate(files):
    arr = np.asarray(Image.open(fn).convert('RGB'), dtype=np.int16)
    r,g,b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    gm = (g>150)&(r<90)&(b<90)
    ym = (abs(r-153)<16)&(abs(g-153)<16)&(abs(b-153)<16)
    gx = np.nonzero(gm)[1].mean() if gm.sum()>800 else float('nan')
    yx = np.nonzero(ym)[1].mean() if ym.sum()>800 else float('nan')
    print(f'{i:4d} t={i/25:5.2f} g={gx:7.1f} y={yx:7.1f}')
