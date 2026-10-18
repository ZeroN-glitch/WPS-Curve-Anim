"""把入场特效剥掉，只留纯属性动画；给目标形状写一个纯红填充，便于录屏追踪

用法: python make_pure_motion.py <in.pptx> <out.pptx> <spid> [duration_ms] [total_frac]
"""
import sys, zipfile, shutil
from lxml import etree

NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
}
P = '{%s}' % NS['p']
A = '{%s}' % NS['a']

src, dst = sys.argv[1], sys.argv[2]
spid = sys.argv[3]
dur = sys.argv[4] if len(sys.argv) > 4 else '2000'
total_frac = float(sys.argv[5]) if len(sys.argv) > 5 else 0.5
color = sys.argv[6] if len(sys.argv) > 6 else 'FF0000'

with zipfile.ZipFile(src) as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

root = etree.fromstring(data['ppt/slides/slide1.xml'])

# ---------- 1. 给目标形状设纯红填充 ----------
for sp in root.findall('.//p:sp', NS):
    cNvPr = sp.find('.//p:cNvPr', NS)
    if cNvPr is None or cNvPr.get('id') != spid:
        continue
    spPr = sp.find('./p:spPr', NS)
    if spPr is None:
        continue
    # 去掉原有的填充节点
    for tag in ('solidFill', 'noFill', 'gradFill', 'pattFill', 'blipFill', 'grpFill'):
        for e in spPr.findall('./a:' + tag, NS):
            spPr.remove(e)
    fill = etree.SubElement(spPr, A + 'solidFill')
    clr = etree.SubElement(fill, A + 'srgbClr')
    clr.set('val', color)   # 纯色填充
    # 去掉边框，避免干扰
    for e in spPr.findall('./a:ln', NS):
        spPr.remove(e)
    ln = etree.SubElement(spPr, A + 'ln')
    etree.SubElement(ln, A + 'noFill')
    print('shape fill ->', color, spid)
    break

# ---------- 2. 剥掉入场特效，只留 p:anim ----------
removed = {'set': 0, 'animEffect': 0}
for eff_ctn in root.findall('.//p:cTn[@nodeType="clickEffect"]', NS):
    eff_ctn.set('nodeType', 'afterEffect')
    child = eff_ctn.find('./p:childTnLst', NS)
    if child is None:
        continue
    for tag in ('set', 'animEffect'):
        for e in child.findall('./p:' + tag, NS):
            child.remove(e)
            removed[tag] += 1

# ---------- 2b. 解除“等待点击”：indefinite 延时改 0 ----------
delay_fixed = 0
for ctn in root.findall('.//p:cTn', NS):
    if ctn.get('nodeType') in ('tmRoot', 'mainSeq'):
        continue
    for cond in ctn.findall('./p:stCondLst/p:cond', NS):
        if cond.get('delay') == 'indefinite':
            cond.set('delay', '0')
            delay_fixed += 1
print('delay indefinite -> 0:', delay_fixed)

# ---------- 3. 时长与关键帧 ----------
for anim in root.findall('.//p:anim', NS):
    ctn = anim.find('.//p:cTn', NS)
    if ctn is not None:
        ctn.set('dur', dur)
    for tav in anim.findall('.//p:tav', NS):
        t = int(tav.get('tm')) / 100000.0
        sv = tav.find('.//p:strVal', NS)
        if sv is not None:
            sv.set('val', '#ppt_x+%.6f' % ((t ** 3) * total_frac))

data['ppt/slides/slide1.xml'] = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)

with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])

print(f'removed entry-effect nodes: {removed}  dur={dur} frac={total_frac} -> {dst}')
