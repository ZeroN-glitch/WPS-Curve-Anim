"""分析采样结果：比较红块(t^3 曲线)和蓝块(线性)的位移进度"""
import csv, sys, math

path = sys.argv[1] if len(sys.argv) > 1 else 'out/frames.csv'
rows = list(csv.DictReader(open(path, encoding='utf-8')))
print(f'frames: {len(rows)}')

def f(v):
    try:
        x = float(v)
        return None if math.isnan(x) else x
    except Exception:
        return None

# 只保留同时看到两种方块的帧（放映期间）
ok = [r for r in rows if f(r['rn']) and f(r['bn']) and int(r['rn']) > 200 and int(r['bn']) > 200]
print(f'frames with both shapes: {len(ok)}')
if not ok:
    # 看看分别有多少帧能看见
    nr = sum(1 for r in rows if f(r['rn']) and int(r['rn']) > 200)
    nb = sum(1 for r in rows if f(r['bn']) and int(r['bn']) > 200)
    print(f'only red visible: {nr}, only blue visible: {nb}')
    print('--- 前 40 帧原始数据 ---')
    for r in rows[:40]:
        print(r['t'], 'rn=', r['rn'], 'rx=', r['rx'], '| bn=', r['bn'], 'bx=', r['bx'])
    sys.exit(0)

rx = [f(r['rx']) for r in ok]
bx = [f(r['bx']) for r in ok]
ts = [float(r['t']) for r in ok]

x0r, x1r = rx[0], rx[-1]
x0b, x1b = bx[0], bx[-1]
print(f'red  x: {x0r:.1f} -> {x1r:.1f}  (移动 {x1r-x0r:.1f}px)')
print(f'blue x: {x0b:.1f} -> {x1b:.1f}  (移动 {x1b-x0b:.1f}px)')

print('\n  t(相对)   红进度   蓝进度   理论t^3')
t_start = ts[0]
dur = ts[-1] - t_start
N = 16
for i in range(N + 1):
    tt = i / N
    target_t = t_start + tt * dur
    # 找最近的帧
    k = min(range(len(ts)), key=lambda j: abs(ts[j] - target_t))
    pr = (rx[k] - x0r) / (x1r - x0r) if x1r != x0r else 0
    pb = (bx[k] - x0b) / (x1b - x0b) if x1b != x0b else 0
    print(f'  {tt:5.2f}   {pr:7.3f}  {pb:7.3f}   {tt**3:7.3f}')

# 判断：曲线特征 = 早期红进度显著低于蓝，后期追上
early = []
for r_i, t_i in enumerate(ts):
    if (t_i - t_start) / dur < 0.4:
        pr = (rx[r_i] - x0r) / (x1r - x0r) if x1r != x0r else 0
        pb = (bx[r_i] - x0b) / (x1b - x0b) if x1b != x0b else 0
        early.append(pr - pb)
if early:
    print(f'\n前 40% 时间里 (红进度 - 蓝进度) 平均 = {sum(early)/len(early):+.3f}')
    print('  明显为负  => tavLst 曲线生效（红块被拖慢）')
    print('  接近 0    => 引擎忽略关键帧，按线性插值')
