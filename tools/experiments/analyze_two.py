"""双色轨迹分析：绿色=缓入缓出曲线，灰色=线性对照，验证加载项写入的动画真实播放效果"""
import glob, os, sys
import numpy as np
from PIL import Image

framedir = sys.argv[1] if len(sys.argv) > 1 else 'out/vf6'
fps = float(sys.argv[2]) if len(sys.argv) > 2 else 25.0
DUR = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0


def cubic_bezier(x1, y1, x2, y2):
    def f(x):
        if x <= 0:
            return 0.0
        if x >= 1:
            return 1.0
        lo, hi, t = 0.0, 1.0, x
        for _ in range(40):
            cx = 3 * x1; bx = 3 * (x2 - x1) - cx; ax = 1 - cx - bx
            xt = ((ax * t + bx) * t + cx) * t
            if abs(xt - x) < 1e-7:
                break
            if xt < x:
                lo = t
            else:
                hi = t
            t = (lo + hi) / 2
        cy = 3 * y1; by = 3 * (y2 - y1) - cy; ay = 1 - cy - by
        return ((ay * t + by) * t + cy) * t
    return f


files = sorted(glob.glob(os.path.join(framedir, '*.png')))
print('frames:', len(files))

green, gray = [], []
for i, fn in enumerate(files):
    arr = np.asarray(Image.open(fn).convert('RGB'), dtype=np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    gm = (g > 150) & (r < 90) & (b < 90)
    ym = (abs(r - 153) < 16) & (abs(g - 153) < 16) & (abs(b - 153) < 16)
    def cent(m, need=800):
        if int(m.sum()) < need:
            return np.nan
        ys, xs = np.nonzero(m)
        return float(xs.mean())
    green.append(cent(gm))
    gray.append(cent(ym))

print('green frames:', sum(1 for v in green if not np.isnan(v)),
      ' gray frames:', sum(1 for v in gray if not np.isnan(v)))


def motion_window(series):
    """返回 (i0, i1, base, tip)：从静止基线出发、单调推进到最远点的一段"""
    xs = [v for v in series if not np.isnan(v)]
    if len(xs) < 10:
        return None
    tip = max(xs)
    i1 = max(i for i, v in enumerate(series) if not np.isnan(v) and v >= tip - 1.5)
    base = min(xs)
    i0 = max((i for i, v in enumerate(series) if i < i1 and not np.isnan(v) and v <= base + 2.5), default=None)
    if i0 is None:
        return None
    return i0, i1, base, tip


for name, series, ref_name, ref in (
        ('绿(缓入缓出)', green, 'cubic-bezier(0.65,0,0.35,1)', cubic_bezier(0.65, 0, 0.35, 1)),
        ('灰(线性)', gray, 'linear', lambda t: t)):
    w = motion_window(series)
    print(f'\n===== {name} =====')
    if not w:
        print('  没找到稳定运动段')
        continue
    i0, i1, base, tip = w
    span = tip - base
    print(f'  起点帧 {i0}  终点帧 {i1}  时长 {(i1-i0)/fps:.2f}s (设定 {DUR}s)  位移 {span:.1f}px')
    idx = list(range(i0, i1 + 1))
    t = np.array([(i - i0) / (i1 - i0) for i in idx])
    p = np.array([(series[i] - base) / span for i in idx])
    pred_ref = np.array([ref(x) for x in t])
    pred_lin = t
    e_ref = float(np.sum((p - pred_ref) ** 2))
    e_lin = float(np.sum((p - pred_lin) ** 2))
    print(f'  对 {ref_name} 残差 = {e_ref:.4f}')
    print(f'  对 线性          残差 = {e_lin:.4f}')
    verdict = '符合预期曲线' if e_ref < e_lin else '偏离预期曲线'
    print(f'  => {verdict}')
    print('   t     实测     预期')
    for k in range(0, 11):
        j = int(round(k / 10 * (len(idx) - 1)))
        print(f'  {t[j]:.2f}   {p[j]:7.3f}  {pred_ref[j]:7.3f}')
