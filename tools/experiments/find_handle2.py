import numpy as np
from PIL import Image

img = np.asarray(Image.open('out/before-drag.png').convert('RGB'), dtype=np.int16)
h, w, _ = img.shape
x0 = int(w * 0.62)
sub = img[:, x0:]
r, g, b = sub[:, :, 0], sub[:, :, 1], sub[:, :, 2]
mask = (b > 200) & (r > 20) & (r < 90) & (g > 95) & (g < 155)
m = mask.astype(np.int32)
k = 9
ii = np.zeros((m.shape[0] + 1, m.shape[1] + 1), dtype=np.int64)
ii[1:, 1:] = m.cumsum(0).cumsum(1)
s = ii[k:, k:] - ii[:-k, k:] - ii[k:, :-k] + ii[:-k, :-k]

# 取局部极大值，彼此至少隔开 40px
flat = np.argsort(s.ravel())[::-1]
picked = []
for fi in flat:
    y, x = divmod(int(fi), s.shape[1])
    cy, cx = y + k // 2, x + k // 2
    if any(abs(cx - px) < 40 and abs(cy - py) < 40 for px, py in picked):
        continue
    picked.append((cx, cy))
    print(f'候选 屏幕=({cx + x0}, {cy})  密度={int(s.ravel()[fi])}')
    if len(picked) >= 6:
        break
