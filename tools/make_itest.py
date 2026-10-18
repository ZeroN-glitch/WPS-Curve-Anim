"""生成集成测试页：mock WPS 记录 API 调用，页面加载后自动操作一遍，并把结果画在页面上

截图后可直接读出写入了几个行为、每条的关键帧数值。
"""
import os, shutil

ws = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ws, 'addin', 'ui', 'editor.html')
outdir = os.path.join(ws, 'out', 'preview')
os.makedirs(outdir, exist_ok=True)

html = open(src, encoding='utf-8').read().replace('src="../js/curve.js"', 'src="curve.js"')

MOCK = r"""
<script>
// ---- 记录式 mock：模拟 WPS 对象模型并把调用结果存进 window.__REC ----
(function () {
  var REC = { effects: [], errors: [] };
  window.__REC = REC;

  // 版心 960x540pt，形状放在不同位置，方便验证“起点/终点按版心坐标”
  var SHAPES = [
    { Id: 3, Name: '方块1', Left: 120, Top: 260, Width: 180, Height: 120 },
    { Id: 4, Name: '方块2', Left: 400, Top: 260, Width: 140, Height: 140 },
    { Id: 5, Name: '方块3', Left: 680, Top: 260, Width: 200, Height: 60 }
  ];

  var selCount = 1;
  window.__setSelection = function (n) { selCount = n; };

  var SLIDE = {
    Shapes: {
      get Count() { return SHAPES.length; },
      Item: function (i) { return SHAPES[i - 1]; }
    },
    TimeLine: {
      MainSequence: {
        Count: 0,
        AddEffect: function (shape, effectType) {
          var rec = { shapeId: shape.Id, effectType: effectType, tracks: [] };
          rec.points = [];            // 兼容旧断言：指向最后一条行为
          REC.effects.push(rec);
          return {
            EffectType: effectType,
            Timing: {
              set Duration(v) { rec.timingDuration = v; },
              get Duration() { return rec.timingDuration; },
              set TriggerType(v) { rec.triggerType = v; },
              get TriggerType() { return rec.triggerType; }
            },
            Behaviors: {
              Count: 1,
              Add: function (type) {
                var track = { behaviorType: type, property: null, points: [] };
                rec.tracks.push(track);
                rec.points = track.points;
                rec.behaviorType = type;
                return {
                  Timing: {
                    set Duration(v) { track.duration = v; },
                    get Duration() { return track.duration; }
                  },
                  PropertyEffect: {
                    get Property() { return track.property; },
                    set Property(v) { track.property = v; rec.property = v; },
                    Points: {
                      get Count() { return track.points.length; },
                      Add: function () {
                        var pt = { Time: null, Value: null };
                        track.points.push(pt);
                        return pt;
                      }
                    }
                  }
                };
              }
            }
          };
        }
      }
    }
  };

  window.Application = {
    Enum: {
      msoAnimX: 1, msoAnimY: 2, msoAnimTypeProperty: 5, msoAnimTypeSet: 8,
      msoAnimEffectCustom: 0, msoAnimTriggerOnPageClick: 1,
      msoAnimTriggerWithPrevious: 2, msoAnimTriggerAfterPrevious: 3
    },
    ActiveWindow: {
      View: { Slide: SLIDE },
      Selection: {
        ShapeRange: {
          get Count() { return selCount; },
          Item: function (i) { return SHAPES[i - 1]; }
        }
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

DRIVER = r"""
<script>
// ---- 自动操作：点预设、改参数、拖控制点、拖起点、把终点设回形状位置、应用 ----
window.addEventListener('load', function () {
  setTimeout(function () {
    var log = [];
    function step(name, fn) {
      try { fn(); log.push('OK   ' + name); }
      catch (e) { log.push('FAIL ' + name + ' :: ' + e.message); }
    }

    var hasPointer = !!window.PointerEvent;
    function canvasDrag(cv, fromPx, toPx) {
      // 合成指针/鼠标事件，走页面自己的拖拽逻辑
      function fire(target, type, x, y) {
        var evt = hasPointer
          ? new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1 })
          : new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
        target.dispatchEvent(evt);
      }
      fire(cv, 'pointerdown', fromPx.x, fromPx.y);
      fire(cv, 'pointermove', toPx.x, toPx.y);
      fire(cv, 'pointerup', toPx.x, toPx.y);
    }

    step('点「回弹」预设', function () {
      var found = null;
      document.querySelectorAll('#chips .chip').forEach(function (c) {
        if (c.textContent === '回弹') found = c;
      });
      if (!found) throw new Error('找不到回弹预设');
      found.click();
    });

    step('时长设为 1.5s', function () {
      var el = document.getElementById('dur');
      el.value = '1.5';
      el.dispatchEvent(new Event('input'));
    });

    step('关键帧设为 12', function () {
      var el = document.getElementById('frames');
      el.value = '12';
      el.dispatchEvent(new Event('input'));
    });

    step('拖动速率曲线控制点', function () {
      var cv = document.getElementById('cv');
      var r = cv.getBoundingClientRect();
      var W = cv.width, H = cv.height, PAD = 46, YMIN = -0.22, YMAX = 1.7;
      function tx(t) { return PAD + t * (W - 2 * PAD); }
      function ty(v) { return H - PAD - ((v - YMIN) / (YMAX - YMIN)) * (H - 2 * PAD); }
      var p = window.state.p;
      var before = [p[0], p[1]];
      var sx = r.left + tx(p[0]) * (r.width / W);
      var sy = r.top + ty(p[1]) * (r.height / H);
      canvasDrag(cv, { x: sx, y: sy }, { x: sx + 28, y: sy + 34 });
      window.__CURVE = { from: before, to: [window.state.p[0], window.state.p[1]] };
      if (Math.abs(window.state.p[1] - before[1]) < 0.005) throw new Error('控制点没动');
    });

    step('拖动版心小图的起点', function () {
      var cv = document.getElementById('map');
      var r = cv.getBoundingClientRect();
      var MW = cv.width, MH = cv.height, PAD = 16;
      // 和页面里保持一致：可放点范围是 -0.25 ~ 1.25
      var MLO = -0.14, MHI = 1.14;
      function mx(n) { return PAD + ((n - MLO) / (MHI - MLO)) * (MW - 2 * PAD); }
      function my(n) { return PAD + ((n - MLO) / (MHI - MLO)) * (MH - 2 * PAD); }
      var f = window.state.from;
      var before = [f.x, f.y];
      var sx = r.left + mx(f.x) * (r.width / MW);
      var sy = r.top + my(f.y) * (r.height / MH);
      // 往左上拖，让两个轴都产生位移
      canvasDrag(cv, { x: sx, y: sy }, { x: sx - 40, y: sy - 50 });
      window.__MAP = { from: before, to: [window.state.from.x, window.state.from.y] };
      if (Math.abs(window.state.from.x - before[0]) < 0.01) throw new Error('起点没动');
    });

    step('把终点设回形状位置（= 入场）', function () {
      document.getElementById('toCur').click();
      var sp = window.state.shapePos;
      if (!sp) throw new Error('拿不到形状位置');
      var t = window.state.to;
      if (Math.abs(t.x - sp.x) > 1e-9 || Math.abs(t.y - sp.y) > 1e-9) throw new Error('终点没对齐');
    });

    step('点「应用」', function () {
      document.getElementById('btnApply').click();
    });

    setTimeout(report, 500);

    function report() {
      var REC = window.__REC;
      var lines = log.slice();
      lines.push('');
      lines.push('effects 数量: ' + REC.effects.length);
      if (REC.effects.length) {
        var e = REC.effects[0];
        lines.push('shapeId=' + e.shapeId + '  timingDuration=' + e.timingDuration + '  trigger=' + e.triggerType);
        lines.push('行为条数=' + e.tracks.length);
        e.tracks.forEach(function (tr) {
          var attr = tr.property === 1 ? 'X' : tr.property === 2 ? 'Y' : ('?' + tr.property);
          var vs = tr.points.map(function (p) {
            return parseFloat(String(p.Value).replace('#ppt_x', '').replace('#ppt_y', ''));
          });
          lines.push('  [' + attr + '] 帧=' + tr.points.length +
            '  首=' + vs[0].toFixed(4) + '  末=' + vs[vs.length - 1].toFixed(4) +
            '  最大=' + Math.max.apply(null, vs).toFixed(4) +
            '  最小=' + Math.min.apply(null, vs).toFixed(4));
        });
      }
      if (window.__CURVE) {
        lines.push('');
        lines.push('曲线拖拽: (' + window.__CURVE.from.map(function (v) { return v.toFixed(3); }).join(',') +
          ') -> (' + window.__CURVE.to.map(function (v) { return v.toFixed(3); }).join(',') + ')');
      }
      if (window.__MAP) {
        lines.push('起点拖拽: (' + window.__MAP.from.map(function (v) { return v.toFixed(3); }).join(',') +
          ') -> (' + window.__MAP.to.map(function (v) { return v.toFixed(3); }).join(',') + ')');
      }
      if (window.state && window.state.shapePos) {
        lines.push('形状位置: ' + window.state.shapePos.x.toFixed(3) + ', ' + window.state.shapePos.y.toFixed(3));
      }
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:99999;background:#111;color:#7CFC00;' +
        'font:bold 13px/1.55 monospace;padding:8px;white-space:pre-wrap;word-break:break-all';
      d.textContent = lines.join('\n');
      document.body.appendChild(d);
    }
  }, 600);
});
</script>
</body>
"""

html = html.replace('<script type="text/javascript" src="curve.js"></script>',
                    MOCK + '\n    <script type="text/javascript" src="curve.js"></script>')
html = html.replace('</body>', DRIVER)

dst = os.path.join(outdir, 'itest.html')
open(dst, 'w', encoding='utf-8').write(html)
shutil.copyfile(os.path.join(ws, 'addin', 'js', 'curve.js'), os.path.join(outdir, 'curve.js'))
print('itest ->', dst)




