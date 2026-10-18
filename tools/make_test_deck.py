"""生成对照测试稿：一页三个相同方块 + 一页其他形状，用来并排比较不同速率曲线"""
import sys
from pptx import Presentation
from pptx.util import Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

out = sys.argv[1] if len(sys.argv) > 1 else 'test/curve-test.pptx'

prs = Presentation()
prs.slide_width = Emu(12192000)    # 960pt (13.333in)，标准 16:9
prs.slide_height = Emu(6858000)    # 540pt

blank = prs.slide_layouts[6]

# ---------- 第 1 页：三个相同方块，用来对比三种曲线 ----------
s1 = prs.slides.add_slide(blank)
title = s1.shapes.add_textbox(Pt(60), Pt(36), Pt(840), Pt(50))
tf = title.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
r = p.add_run()
r.text = '同一动画，三种速率曲线 —— 分别选中三个方块，套用不同曲线后按 F5'
r.font.size = Pt(20)
r.font.bold = True
r.font.color.rgb = RGBColor(0x2B, 0x33, 0x40)

colors = [RGBColor(0x3B, 0x82, 0xF6), RGBColor(0xF5, 0x9E, 0x0B), RGBColor(0xE5, 0x4B, 0x4B)]
labels = ['①  线性 / 缓入缓出 / 回弹  都套一遍', '②', '③']
for i in range(3):
    x = Pt(110 + i * 250)
    shp = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Pt(300), Pt(140), Pt(140))
    shp.fill.solid()
    shp.fill.fore_color.rgb = colors[i]
    shp.line.fill.background()
    shp.name = f'方块{i + 1}'
    # 编号
    t = shp.text_frame
    t.text = str(i + 1)
    t.paragraphs[0].alignment = PP_ALIGN.CENTER
    t.vertical_anchor = MSO_ANCHOR.MIDDLE
    for run in t.paragraphs[0].runs:
        run.font.size = Pt(36)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

note = s1.shapes.add_textbox(Pt(60), Pt(470), Pt(840), Pt(40))
p2 = note.text_frame.paragraphs[0]
r2 = p2.add_run()
r2.text = '建议：三个方块都设 距离 30%、时长 2s、关键帧 24，只改曲线，差异最明显'
r2.font.size = Pt(13)
r2.font.color.rgb = RGBColor(0x7A, 0x84, 0x94)

# ---------- 第 2 页：别的形状，验证在非矩形上也正常 ----------
s2 = prs.slides.add_slide(blank)
shapes = [
    (MSO_SHAPE.OVAL, 120, 160, RGBColor(0x10, 0xB9, 0x81), '圆形'),
    (MSO_SHAPE.STAR_5_POINT, 380, 160, RGBColor(0xF5, 0x9E, 0x0B), '星形'),
    (MSO_SHAPE.RIGHT_ARROW, 640, 160, RGBColor(0x63, 0x66, 0xF1), '箭头'),
]
for kind, x, y, color, name in shapes:
    shp = s2.shapes.add_shape(kind, Pt(x), Pt(y), Pt(150), Pt(150))
    shp.fill.solid()
    shp.fill.fore_color.rgb = color
    shp.line.fill.background()
    shp.name = name

cap = s2.shapes.add_textbox(Pt(60), Pt(40), Pt(840), Pt(60))
r3 = cap.text_frame.paragraphs[0].add_run()
r3.text = '第 2 页：圆形 / 星形 / 箭头 —— 验证曲线在非矩形形状上同样生效'
r3.font.size = Pt(20)
r3.font.bold = True
r3.font.color.rgb = RGBColor(0x2B, 0x33, 0x40)

# ---------- 第 3 页：沿不同方向 ----------
s3 = prs.slides.add_slide(blank)
cap3 = s3.shapes.add_textbox(Pt(60), Pt(40), Pt(840), Pt(60))
r4 = cap3.text_frame.paragraphs[0].add_run()
r4.text = '第 3 页：方向测试 —— 向上 / 向下 / 向左 各套一条曲线'
r4.font.size = Pt(20)
r4.font.bold = True
r4.font.color.rgb = RGBColor(0x2B, 0x33, 0x40)

for i, (dx, dy) in enumerate([(140, 180), (420, 180), (700, 180)]):
    shp = s3.shapes.add_shape(MSO_SHAPE.PENTAGON, Pt(dx), Pt(dy), Pt(110), Pt(110))
    shp.fill.solid()
    shp.fill.fore_color.rgb = colors[i]
    shp.line.fill.background()
    shp.name = f'方向{i + 1}'

import os
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
prs.save(out)
print('saved', out, 'slides:', len(prs.slides._sldIdLst))
