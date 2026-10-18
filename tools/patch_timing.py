"""直接修补 pptx 的时间轴：把动画时长从 indefinite 改成真实毫秒数，并按 t^3 重设关键帧值

用法: python patch_timing.py <in.pptx> <out.pptx> [duration_ms] [total_frac]
"""
import sys, zipfile, shutil, os
from lxml import etree

NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
}
P = '{%s}' % NS['p']

src = sys.argv[1]
dst = sys.argv[2]
dur = sys.argv[3] if len(sys.argv) > 3 else '2000'
total_frac = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5

shutil.copyfile(src, dst)

with zipfile.ZipFile(src) as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

slide_name = 'ppt/slides/slide1.xml'
root = etree.fromstring(data[slide_name])

fixed_dur = 0
fixed_vals = 0
fixed_delay = 0

# 0. 让动画自动开始：把“等待点击”的 indefinite 延时改成 0
for ctn in root.findall('.//p:cTn', NS):
    if ctn.get('nodeType'):      # tmRoot / mainSeq 不动
        continue
    for cond in ctn.findall('./p:stCondLst/p:cond', NS):
        if cond.get('delay') == 'indefinite':
            cond.set('delay', '0')
            fixed_delay += 1

# 1. 把所有 p:anim 里的 cTn dur="indefinite" 改成真实时长
for anim in root.findall('.//p:anim', NS):
    ctn = anim.find('.//p:cTn', NS)
    if ctn is not None and ctn.get('dur') == 'indefinite':
        ctn.set('dur', dur)
        fixed_dur += 1

    # 2. 按 t^3 重算关键帧数值（保持 tm 不变）
    tavs = anim.findall('.//p:tav', NS)
    for tav in tavs:
        tm = int(tav.get('tm'))
        t = tm / 100000.0
        frac = (t ** 3) * total_frac
        strval = tav.find('.//p:strVal', NS)
        if strval is not None:
            strval.set('val', '#ppt_x+%.6f' % frac)
            fixed_vals += 1

data[slide_name] = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)

with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])

print(f'patched dur={dur} nodes={fixed_dur} delay={fixed_delay} tavs={fixed_vals} total_frac={total_frac} -> {dst}')
