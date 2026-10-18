"""分析录屏里绿方块的位移轨迹，自动定位“开始运动”时刻，和 t^3 / 线性做比对"""
import glob, os, sys
import numpy as np
from PIL import Image

framedir = sys.argv[1] if len(sys.argv) > 1 else 'out/vfg'
fps = float(sys.argv[2]) if len(sys.argv) > 2 else 25.0

files = sorted(glob.glob(os.path.join(framedir, '*.png')))
print(f'frames: {len(files)}')

cx_series = []
for i, fn in enumerate(files):
    arr = np.asarray(Image.open(fn).convert('RGB'), dtype=np.uint8)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    mask = (g > 150) & (r < 90) & (b < 90)
    cnt = int(mask.sum())
    if cnt > 800:
        ys, xs = np.nonzero(mask)
        cx_series.append((i, float(xs.mean()), cnt))
    else:
        cx_series.append((i, float('nan'), cnt))

valid = [c for c in cx_series if not np.isnan(c[1])]
print(f'frames with green blob: {len(valid)}')
if len(valid) < 5:
    print('绿块太少，最大像素数:')
    for c in sorted(cx_series, key=lambda x: -x[2])[:8]:
        print('  frame', c[0], 'cnt', c[2])
    sys.exit(0)

# 自动找开始运动的帧：连续 3 帧位移超过阈值
start = None
for k in range(1, len(cx_series) - 3):
    if np.isnan(cx_series[k][1]) or np.isnan(cx_series[k - 1][1]):
        continue
    d = abs(cx_series[k][1] - cx_series[k - 1][1])
    d2 = abs(cx_series[k + 1][1] - cx_series[k][1]) if not np.isnan(cx_series[k + 1][1]) else 0
    if d > 4 and d2 > 4:
        start = k - 1
        break

if start is None:
    print('没检测到运动，绿块质心范围:', min(c[1] for c in valid), max(c[1] for c in valid))
    sys.exit(0)

print(f'检测到开始运动: frame {start} ({start/fps:.2f}s)  质心x={cx_series[start][1]:.1f}')

# 终点：从 start 往后找最后一个有效帧
end = start
for k in range(start, len(cx_series)):
    if not np.isnan(cx_series[k][1]):
        end = k
print(f'结束: frame {end} ({end/fps:.2f}s)  质心x={cx_series[end][1]:.1f}')

x0 = cx_series[start][1]
x1 = cx_series[end][1]
span = x1 - x0
print(f'位移 {span:.1f}px  用时约 {(end-start)/fps:.2f}s\n')

print('  时间(s)   进度     理论t^3    线性')
dur = (end - start) / fps
for k in range(0, 21):
    tt = k * dur / 20
    idx = start + int(round(tt * fps))
    if idx > end or np.isnan(cx_series[idx][1]):
        continue
    prog = (cx_series[idx][1] - x0) / span if span != 0 else 0
    nt = min(tt / 2.0, 1.0)   # 动画设定 2 秒
    print(f'  {tt:6.2f}  {prog:7.3f}   {nt**3:8.3f}  {nt:6.3f}')

# 早期进度判定（前 30% 时间）
early = []
for k in range(start, start + max(1, int(0.3 * (end - start)))):
    if np.isnan(cx_series[k][1]):
        continue
    early.append((cx_series[k][1] - x0) / span if span != 0 else 0)
if early:
    m = sum(early) / len(early)
    print(f'\n前 30% 时间平均进度 = {m:.3f}')
    print('  t^3 理论 ≈ 0.015   |   线性 ≈ 0.150')
    print('  判定:', '关键帧曲线生效' if m < 0.09 else ('接近线性，曲线被忽略' if m > 0.11 else '介于两者之间'))
