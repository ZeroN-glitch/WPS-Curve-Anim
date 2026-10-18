"""屏幕采样：连续截屏，逐帧找红块/蓝块的质心，输出 CSV 供分析轨迹"""
import argparse, csv, time, sys
import numpy as np
from PIL import ImageGrab

ap = argparse.ArgumentParser()
ap.add_argument('--seconds', type=float, default=35)
ap.add_argument('--fps', type=float, default=14)
ap.add_argument('--out', default='out/frames.csv')
args = ap.parse_args()

interval = 1.0 / args.fps
rows = []
t0 = time.time()
n = 0

while time.time() - t0 < args.seconds:
    frame_start = time.time()
    try:
        img = ImageGrab.grab()
    except Exception as e:
        print('grab failed:', e, flush=True)
        break
    arr = np.asarray(img.convert('RGB'), dtype=np.uint8)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)

    red_mask = (r > 150) & (g < 90) & (b < 90)
    blue_mask = (b > 150) & (r < 90) & (g < 90)

    def centroid(mask):
        cnt = int(mask.sum())
        if cnt == 0:
            return (float('nan'), float('nan'), 0)
        ys, xs = np.nonzero(mask)
        return (float(xs.mean()), float(ys.mean()), cnt)

    rx, ry, rn = centroid(red_mask)
    bx, by, bn = centroid(blue_mask)

    rows.append({
        't': round(time.time() - t0, 3),
        'rx': rx, 'ry': ry, 'rn': rn,
        'bx': bx, 'by': by, 'bn': bn,
        'screen_h': arr.shape[0], 'screen_w': arr.shape[1],
    })
    n += 1
    # 补偿处理耗时
    sleep = interval - (time.time() - frame_start)
    if sleep > 0:
        time.sleep(sleep)

with open(args.out, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ['t'])
    w.writeheader()
    w.writerows(rows)

print(f'captured {len(rows)} frames over {time.time()-t0:.1f}s -> {args.out}', flush=True)
if rows:
    print('screen:', rows[0]['screen_w'], 'x', rows[0]['screen_h'], flush=True)
