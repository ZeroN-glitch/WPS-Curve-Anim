import sys
import numpy as np
from PIL import Image

img = np.asarray(Image.open('out/before-drag.png').convert('RGB'), dtype=np.int16)
h, w, _ = img.shape
# 只看右侧 1/3（任务窗格所在）
x0 = int(w * 0.62)
sub = img[:, x0:]
r, g, b = sub[:, :, 0], sub[:, :, 1], sub[:, :, 2]
mask = (b > 200) & (r > 20) & (r < 90) & (g > 95) & (g < 155)
print('蓝色像素数:', int(mask.sum()))
if mask.sum() == 0:
    sys.exit('没找到蓝色，截图可能不是任务窗格界面')

# 用 k×k 盒求和找最“实”的蓝色小块（控制点是实心圆，曲线是细线）
k = 9
m = mask.astype(np.int32)
ii = np.zeros((m.shape[0] + 1, m.shape[1] + 1), dtype=np.int64)
ii[1:, 1:] = m.cumsum(0).cumsum(1)
s = ii[k:, k:] - ii[:-k, k:] - ii[k:, :-k] + ii[:-k, :-k]
idx = np.unravel_index(np.argmax(s), s.shape)
cy, cx = idx[0] + k // 2, idx[1] + k // 2
print('最密蓝块(窗格内坐标):', cx, cy, ' 密度=', int(s[idx]))
print('屏幕坐标:', cx + x0, cy)
