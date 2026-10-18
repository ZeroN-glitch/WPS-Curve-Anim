"""检查加载项生成的动画：nodeType / 延时 / 时长 / 关键帧数 / 曲线形状"""
import sys, zipfile
from lxml import etree

NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
path = sys.argv[1] if len(sys.argv) > 1 else 'out/selftest.pptx'

with zipfile.ZipFile(path) as z:
    root = etree.fromstring(z.read('ppt/slides/slide1.xml'))

print('=' * 60)
for anim in root.findall('.//p:anim', NS):
    cbhvr = anim.find('./p:cBhvr', NS)
    ctn = cbhvr.find('./p:cTn', NS)
    attr = cbhvr.find('.//p:attrName', NS)
    tgt = cbhvr.find('.//p:spTgt', NS)
    tavs = anim.findall('.//p:tav', NS)
    print(f'anim attr={attr.text if attr is not None else "?"}  spid={tgt.get("spid") if tgt is not None else "?"}')
    print(f'  dur={ctn.get("dur")}  accel={ctn.get("accel")} decel={ctn.get("decel")}  frames={len(tavs)}')
    vals = []
    for tav in tavs:
        sv = tav.find('.//p:strVal', NS)
        v = sv.get('val') if sv is not None else '?'
        vals.append((int(tav.get('tm')), v))
    if len(vals) <= 4:
        print('  points:', vals)
    else:
        print('  first3:', vals[:3])
        print('  mid   :', vals[len(vals) // 2])
        print('  last3 :', vals[-3:])

print('-' * 60)
for ctn in root.findall('.//p:cTn', NS):
    nt = ctn.get('nodeType')
    if nt in ('tmRoot', 'mainSeq'):
        continue
    conds = [c.get('delay') for c in ctn.findall('./p:stCondLst/p:cond', NS)]
    if nt or conds:
        print(f'cTn id={ctn.get("id")} nodeType={nt} dur={ctn.get("dur")} delay={conds}')

print('-' * 60)
print('entry set/animEffect nodes:',
      len(root.findall('.//p:set', NS)), len(root.findall('.//p:animEffect', NS)))
print('indefinite delays:', len([c for c in root.findall('.//p:cond', NS) if c.get('delay') == 'indefinite']))
