"""验证放映轨迹：品红=缓入缓出曲线，黄=线性对照"""
import glob, sys
import numpy as np
from PIL import Image


def cb(x1, y1, x2, y2):
    def f(x):
        if x <= 0: return 0.0
        if x >= 1: return 1.0
        lo, hi, t = 0.0, 1.0, x
        for _ in range(40):
            cx = 3 * x1; bx = 3 * (x2 - x1) - cx; ax = 1 - cx - bx
            xt = ((ax * t + bx) * t + cx) * t
            if abs(xt - x) < 1e-7: break
            if xt < x: lo = t
            else: hi = t
            t = (lo + hi) / 2
        cy = 3 * y1; by = 3 * (y2 - y1) - cy; ay = 1 - cy - by
        return ((ay * t + by) * t + cy) * t
    return f


framedir = sys.argv[1] if len(sys.argv) > 1 else 'out/vf7'
fps = float(sys.argv[2]) if len(sys.argv) > 2 else 25.0

files = sorted(glob.glob(framedir + '/*.png'))
mag, yel = [], []
for fn in files:
    arr = np.asarray(Image.open(fn).convert('RGB'), dtype=np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    m = (r > 150) & (b > 150) & (g < 90)          # 品红
    y = (r > 150) & (g > 150) & (b < 90)          # 黄
    mag.append(float(np.nonzero(m)[1].mean()) if m.sum() > 800 else np.nan)
    yel.append(float(np.nonzero(y)[1].mean()) if y.sum() > 800 else np.nan)

print(f'frames={len(files)} magenta={sum(1 for v in mag if not np.isnan(v))} yellow={sum(1 for v in yel if not np.isnan(v))}')

# 找品红连续出现的区间
runs, cur = [], []
for i, v in enumerate(mag):
    if not np.isnan(v):
        cur.append(i)
    elif cur:
        runs.append(cur); cur = []
if cur: runs.append(cur)
if not runs:
    print('品红没出现'); sys.exit(0)
run = max(runs, key=len)
i0, i1 = run[0], run[-1]
print(f'品红可见区间 frame {i0}..{i1} ({(i1-i0)/fps:.2f}s)')

# 用可见区间内首末帧做归一化
def progress(series, a, b):
    vals = [series[i] for i in range(a, b + 1) if not np.isnan(series[i])]
    if len(vals) < 5: return None
    lo, hi = min(vals), max(vals)
    if hi - lo < 20: return None
    return lo, hi

pm = progress(mag, i0, i1)
py_ = progress(yel, i0, i1)
print('品红位移范围:', pm, ' 黄色位移范围:', py_)

ref = cb(0.65, 0, 0.35, 1)
print('\n  t     品红进度  黄色进度   曲线预期   线性预期')
n = i1 - i0
for k in range(0, 11):
    idx = i0 + int(round(k / 10 * n))
    tm = (idx - i0) / n
    mv = (mag[idx] - pm[0]) / (pm[1] - pm[0]) if pm and not np.isnan(mag[idx]) else float('nan')
    yv = (yel[idx] - py_[0]) / (py_[1] - py_[0]) if py_ and not np.isnan(yel[idx]) else float('nan')
    print(f'  {tm:4.2f}   {mv:7.3f}   {yv:7.3f}    {ref(tm):7.3f}   {tm:7.3f}')

# 数值判定
if pm:
    ts = np.array([(i - i0) / n for i in range(i0, i1 + 1) if not np.isnan(mag[i])])
    vs = np.array([(mag[i] - pm[0]) / (pm[1] - pm[0]) for i in range(i0, i1 + 1) if not np.isnan(mag[i])])
    e_curve = float(np.sum((vs - np.array([ref(t) for t in ts])) ** 2))
    e_lin = float(np.sum((vs - ts) ** 2))
    print(f'\n品红 对曲线残差={e_curve:.4f}  对线性残差={e_lin:.4f}')
    print('判定:', '曲线生效' if e_curve < e_lin else '更像线性')
