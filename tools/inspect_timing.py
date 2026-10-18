"""检查 pptx 里 slide 的动画 timing 树，确认 tavLst 是否真的落地"""
import sys, zipfile, re
from lxml import etree

NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
}

path = sys.argv[1] if len(sys.argv) > 1 else 'out/diag.pptx'

with zipfile.ZipFile(path) as z:
    names = [n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)]
    print('slides:', names)
    for name in names:
        xml = z.read(name)
        root = etree.fromstring(xml)
        timings = root.findall('.//p:timing', NS)
        print(f'\n===== {name}: {len(timings)} timing node(s) =====')
        for t in timings:
            print(etree.tostring(t, pretty_print=True, encoding='unicode'))

        # 统计关键帧
        taves = root.findall('.//p:tav', NS)
        print(f'--- tav count: {len(taves)} ---')
        for tav in taves:
            tm = tav.get('tm')
            val = tav.find('.//p:strVal', NS)
            flt = tav.find('.//p:fltVal', NS)
            v = val.get('val') if val is not None else (flt.get('val') if flt is not None else '?')
            print(f'  tm={tm}  val={v}')

        # 看属性动画的目标
        anims = root.findall('.//p:anim', NS)
        print(f'--- p:anim count: {len(anims)} ---')
        for a in anims:
            attr = a.find('.//p:attrName', NS)
            print(f'  attrName={attr.text if attr is not None else "?"} valueType={a.get("valueType")}')
