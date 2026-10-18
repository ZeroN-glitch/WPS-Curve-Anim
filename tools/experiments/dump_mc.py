import glob, numpy as np
from PIL import Image
files = sorted(glob.glob('out/vf7/*.png'))[255:375]
for k, fn in enumerate(files):
    i = 255 + k
    arr = np.asarray(Image.open(fn).convert('RGB'), dtype=np.int16)
    r,g,b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    m = (r>150)&(b>150)&(g<90)
    c = (r<90)&(g>150)&(b>150)
    mx = np.nonzero(m)[1].mean() if m.sum()>800 else float('nan')
    cx = np.nonzero(c)[1].mean() if c.sum()>800 else float('nan')
    print(f'{i:4d} t={i/25:5.2f} mag={mx:7.1f} cyan={cx:7.1f}')
