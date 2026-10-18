"""把 editor.html 包成可在普通浏览器里预览的页面：注入 mock Application，替换资源路径"""
import os, re, sys

ws = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ws, 'addin', 'ui', 'editor.html')
outdir = os.path.join(ws, 'out', 'preview')
os.makedirs(outdir, exist_ok=True)

html = open(src, encoding='utf-8').read()

# 资源路径改为同目录（curve.js 会被复制过来）
html = html.replace('src="../js/curve.js"', 'src="curve.js"')

MOCK = r"""
<script>
// 预览用假 Application：只为让页面在没有 WPS 的环境里渲染出真实状态
(function () {
  var SHAPES = [
    { Id: 3, Name: '标题框', Left: 120, Top: 260, Width: 180, Height: 120 },
    { Id: 4, Name: '示意图', Left: 400, Top: 260, Width: 140, Height: 140 },
    { Id: 5, Name: '装饰线', Left: 680, Top: 260, Width: 200, Height: 60 }
  ];
  function ShapeCollection() {
    var self = {
      Count: SHAPES.length,
      Item: function (i) { return SHAPES[i - 1]; }
    };
    return self;
  }
  var SLIDE = {
    Shapes: ShapeCollection(),
    TimeLine: {
      MainSequence: {
        Count: 0,
        AddEffect: function () {
          return {
            Behaviors: { Count: 1, Add: function () {
              return { Timing: {}, PropertyEffect: { Points: { Count: 0, Add: function () { return { Time: 0, Value: '' }; } } } };
            } },
            Timing: {}
          };
        }
      }
    }
  };
  window.Application = {
    Enum: {
      msoAnimX: 1, msoAnimY: 2, msoAnimTypeProperty: 5, msoAnimTypeSet: 8,
      msoAnimEffectCustom: 0, msoAnimTriggerOnPageClick: 1,
      msoAnimTriggerWithPrevious: 2, msoAnimTriggerAfterPrevious: 3,
      msoCTPDockPositionLeft: 0, msoCTPDockPositionRight: 2
    },
    ActiveWindow: {
      View: { Slide: SLIDE },
      Selection: {
        ShapeRange: { Count: 1, Item: function (i) { return SHAPES[i - 1]; } }
      }
    },
    ActivePresentation: {
      PageSetup: { SlideWidth: 960, SlideHeight: 540 },
      Slides: { Item: function () { return SLIDE; } },
      SaveCopyAs: function () { }
    }
  };
})();
</script>
"""

# 在 curve.js 之前注入 mock
html = html.replace(
    '<script type="text/javascript" src="curve.js"></script>',
    MOCK + '\n    <script type="text/javascript" src="curve.js"></script>'
)

dst = os.path.join(outdir, 'editor-preview.html')
open(dst, 'w', encoding='utf-8').write(html)

# 复制依赖
import shutil
shutil.copyfile(os.path.join(ws, 'addin', 'js', 'curve.js'), os.path.join(outdir, 'curve.js'))
print('preview ->', dst)
print('curve.js copied:', os.path.getsize(os.path.join(outdir, 'curve.js')), 'bytes')


