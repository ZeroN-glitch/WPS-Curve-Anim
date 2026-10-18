"""分析录屏：逐帧找红块质心，还原位移进度曲线"""
import glob, os, sys
import numpy as np
from PIL import Image

framedir = sys.argv[1] if len(sys.argv) > 1 else 'out/vf'
fps = float(sys.argv[2]) if len(sys.argv) > 2 else 15.0
dur = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0

files = sorted(glob.glob(os.path.join(framedir, '*.png')))
print(f'frames: {len(files)}')

recs = []
for i, fn in enumerate(files):
    arr = np.asarray(Image.open(fn).convert('RGB'), dtype=np.uint8)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    mask = (r > 150) & (g < 90) & (b < 90)
    # 只看幻灯片内容区，避开工具栏/桌面图标的红色
    mask[:100, :] = False
    mask[500:, :] = False
    cnt = int(mask.sum())
    if cnt > 0:
        ys, xs = np.nonzero(mask)
        recs.append((i, i / fps, cnt, float(xs.mean()), float(xs.min()), float(xs.max())))
    else:
        recs.append((i, i / fps, 0, float('nan'), float('nan'), float('nan')))

visible = [r for r in recs if r[2] > 1500]
print(f'frames with big red blob: {len(visible)}')
if not visible:
    print('--- 红块像素数最大的 10 帧 ---')
    for r in sorted(recs, key=lambda x: -x[2])[:10]:
        print(f'  frame={r[0]} t={r[1]:.2f} cnt={r[2]}')
    sys.exit(0)

i0 = visible[0][0]
i1 = visible[-1][0]
print(f'红块可见窗口: frame {i0}..{i1}  ({visible[0][1]:.2f}s .. {visible[-1][1]:.2f}s)')

xs_all = [r[3] for r in visible]
xmin, xmax = min(xs_all), max(xs_all)
print(f'质心 x 范围: {xmin:.1f} .. {xmax:.1f}  (位移 {xmax-xmin:.1f}px)')

print('\n  t(s)  进度   理论t^3(2s)  线性(2s)')
for k in range(0, 21):
    tt = k * 0.1
    idx = i0 + int(round(tt * fps))
    if idx > i1:
        break
    rec = recs[idx]
    prog = (rec[3] - xmin) / (xmax - xmin) if xmax != xmin and rec[2] > 0 else float('nan')
    nt = min(tt / dur, 1.0)
    print(f'  {tt:4.1f}  {prog:6.3f}   {nt**3:8.3f}   {nt:6.3f}')

# 早期特征判定
early = []
for r in visible:
    tt = (r[0] - i0) / fps
    if tt <= dur * 0.4:
        early.append((r[3] - xmin) / (xmax - xmin) if xmax != xmin else 0)
if early:
    m = sum(early) / len(early)
    print(f'\n前 40% 时间内平均进度 = {m:.3f}')
    print('  理论: t^3 曲线 ~0.026  |  线性 ~0.200')
    print('  判定:', '关键帧曲线生效' if m < 0.12 else '按线性插值（曲线被忽略）')

# 单调性检查（回弹曲线才会非单调）
mono = all(visible[i][3] <= visible[i + 1][3] + 1.5 for i in range(len(visible) - 1))
print('质心单调递增:', mono)
