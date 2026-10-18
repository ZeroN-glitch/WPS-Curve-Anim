"""从逐帧质心数据拟合动画起点，判定实际轨迹更接近 t^3 曲线还是线性，并画对比图"""
import re, sys
import numpy as np
from PIL import Image, ImageDraw

dump = sys.argv[1] if len(sys.argv) > 1 else 'out/green_dump.txt'
raw = open(dump, 'rb').read()
for enc in ('utf-8-sig', 'utf-16', 'utf-16-le', 'latin-1'):
    try:
        text = raw.decode(enc)
        break
    except UnicodeDecodeError:
        continue
rows = []
for line in text.splitlines():
    m = re.match(r'\s*(\d+)\s+t=\s*([\d.]+)\s+cnt=\s*(\d+)\s+cx=\s*([\d.]+)', line)
    if m:
        rows.append((int(m.group(1)), float(m.group(2)), int(m.group(3)), float(m.group(4))))

# 只看运动可能发生的窗口（避开编辑器早期画面）
win = [(i, r) for i, r in enumerate(rows) if r[1] > 9.0]
xs = [r[3] for r in rows]
widx = [i for i, r in win]
base = min(xs[i] for i in widx)          # 静止时的位置
imax = max(widx, key=lambda i: xs[i])    # 位移终点
x1 = xs[imax]
# 起点 = 最后一个仍停在基线上的帧
i0 = max(i for i in widx if i < imax and xs[i] < base + 2.5)
print(f'基线 cx={base:.1f}  起点帧={i0}(t={rows[i0][1]:.2f}s)  终点帧={imax}(t={rows[imax][1]:.2f}s)')
print(f'位移={x1-base:.1f}px   时长={(imax-i0)/25:.2f}s')

def resid(power):
    idx = list(range(i0, imax + 1))
    t = np.array([(i - i0) / (imax - i0) for i in idx])
    p = np.array([(xs[i] - base) / (x1 - base) for i in idx])
    return float(np.sum((p - t ** power) ** 2))

e3, e2, e1 = resid(3.0), resid(2.0), resid(1.0)
print(f'残差  t^3={e3:.5f}   t^2={e2:.5f}   线性={e1:.5f}')
print('=> 判定:', 't^3 关键帧曲线生效（远优于线性）' if e3 < e1 / 3 else '更接近线性，曲线被忽略')

# 生成对比图
W, H = 900, 560
img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)
L, R, T, B = 80, W - 40, 40, H - 70
d.rectangle([L, T, R, B], outline=(200, 200, 200))
# 坐标轴
for k in range(6):
    x = L + (R - L) * k / 5
    d.line([x, T, x, B], fill=(235, 235, 235))
    d.text((x - 10, B + 8), f'{k/5:.1f}', fill=(90, 90, 90))
    y = B - (B - T) * k / 5
    d.line([L, y, R, y], fill=(235, 235, 235))
    d.text((L - 34, y - 6), f'{k/5:.1f}', fill=(90, 90, 90))

def plot(fn, color, width=2):
    pts = []
    for k in range(101):
        t = k / 100
        x = L + (R - L) * t
        y = B - (B - T) * fn(t)
        pts.append((x, y))
    d.line(pts, fill=color, width=width)

plot(lambda t: t ** 3, (70, 130, 200), 3)   # 蓝：t^3
plot(lambda t: t, (170, 170, 170), 2)      # 灰：线性

# 实测点
meas = []
for i in range(i0, imax + 1):
    t = (i - i0) / (imax - i0)
    p = max(0.0, min(1.0, (xs[i] - base) / (x1 - base)))
    meas.append((L + (R - L) * t, B - (B - T) * p))
d.line(meas, fill=(220, 60, 60), width=3)

d.text((L, 10), 'WPS playback: measured (red)  vs  t^3 keyframes (blue)  vs  linear (grey)', fill=(30, 30, 30))
d.text((L, B + 30), 'normalized time ->', fill=(90, 90, 90))
out = 'out/curve_proof.png'
img.save(out)
print('saved', out)
