// 动画曲线核心：贝塞尔求值 / 烘焙关键帧 / 写入 WPS 演示动画对象模型
// 依赖 WPS 演示加载项环境下的 window.Application

var CurveAnim = (function () {

    // ---------- 三次贝塞尔求值（与 CSS cubic-bezier 同语义） ----------
    function bezier(x1, y1, x2, y2) {
        var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
        var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by

        function sampleX(t) { return ((ax * t + bx) * t + cx) * t }
        function sampleY(t) { return ((ay * t + by) * t + cy) * t }

        // 已知 x 反解 t：纯二分，稳定且精度足够（50 次约 1e-15）
        function solveT(x) {
            var lo = 0, hi = 1, t = x
            for (var i = 0; i < 50; i++) {
                var e = sampleX(t) - x
                if (Math.abs(e) < 1e-9) return t
                if (e > 0) hi = t; else lo = t
                t = (lo + hi) / 2
            }
            return t
        }

        return function (x) {
            if (x <= 0) return 0
            if (x >= 1) return 1
            return sampleY(solveT(x))
        }
    }

    var PRESETS = {
        linear: { name: '线性', p: [0, 0, 1, 1] },
        easeIn: { name: '缓入', p: [0.32, 0, 0.67, 0] },
        easeOut: { name: '缓出', p: [0.33, 1, 0.68, 1] },
        easeInOut: { name: '缓入缓出', p: [0.65, 0, 0.35, 1] },
        snap: { name: '冲击', p: [0.1, 0.9, 0.2, 1] },
        back: { name: '回弹', p: [0.34, 1.56, 0.64, 1] }
    }

    // ---------- 环境/选择 ----------
    function app() {
        if (!window.Application) throw new Error('不在 WPS 加载项环境里')
        return window.Application
    }

    function C(name, fb) {
        try {
            var e = app().Enum
            if (e && typeof e[name] === 'number') return e[name]
        } catch (err) { }
        return fb
    }

    // 当前选中的形状列表
    function selectedShapes() {
        var a = app()
        var w = a.ActiveWindow
        if (!w) throw new Error('没有活动窗口')
        var sel = w.Selection
        if (!sel) throw new Error('没有选择内容')
        var out = []
        try {
            var sr = sel.ShapeRange
            if (sr && sr.Count > 0) {
                for (var i = 1; i <= sr.Count; i++) out.push(sr.Item(i))
                return out
            }
        } catch (e) { }
        throw new Error('请在幻灯片里先选中一个形状')
    }

    function activeSlide() {
        var a = app()
        var pres = a.ActivePresentation
        if (!pres) throw new Error('没有打开的演示文稿')
        var w = a.ActiveWindow
        try {
            var v = w.View
            if (v && v.Slide) return v.Slide
        } catch (e) { }
        return pres.Slides.Item(1)
    }

    // 便宜的“页面指纹”：两次 COM 调用就能判断形状列表要不要重建，
    // 避免每 1.5 秒把整页形状枚举一遍（几十个形状时开销明显）
    function slideKey() {
        var slide = activeSlide()
        var n = 0, idx = 0
        try { n = slide.Shapes.Count } catch (e) { }
        try { idx = slide.SlideIndex } catch (e) { }
        return idx + ':' + n
    }

    // 列出当前页所有形状（不依赖选区，Shapes.Count/Item 已实测可用）
    function listShapes() {
        var slide = activeSlide()
        var shapes = slide.Shapes
        var out = []
        var n = shapes.Count
        for (var i = 1; i <= n; i++) {
            var s = shapes.Item(i)
            var name = ''
            try { name = s.Name } catch (e) { name = '(无名)' }
            out.push({ id: s.Id, name: name })
        }
        return out
    }

    function findShapeById(id) {
        var shapes = activeSlide().Shapes
        var n = shapes.Count
        for (var i = 1; i <= n; i++) {
            var s = shapes.Item(i)
            if (s.Id === id) return s
        }
        throw new Error('找不到 id=' + id + ' 的形状（可能已删除或换了页）')
    }

    // ---------- 版心坐标：把 pt 换算成 0~1 的相对位置 ----------
    function slideSize() {
        var ps = app().ActivePresentation.PageSetup
        return { w: ps.SlideWidth, h: ps.SlideHeight }
    }

    // 形状在版心上的归一化位置。
    // 注意用「中心点」而不是 Left/Top：版心小图上那个虚线标记代表的是形状本体，
    // 用左上角会让标记比形状实际位置偏上一半高度、偏左一半宽度。
    function shapeNormPos(shape) {
        var s = slideSize()
        var l = 0, t = 0, w = 0, h = 0
        try { l = shape.Left } catch (e) { }
        try { t = shape.Top } catch (e) { }
        try { w = shape.Width } catch (e) { }
        try { h = shape.Height } catch (e) { }
        return {
            x: (l + (w || 0) / 2) / s.w,
            y: (t + (h || 0) / 2) / s.h
        }
    }

    // 给面板用：某个形状的归一化位置
    function targetPos(id) {
        var shape = findShapeById(id)
        var p = shapeNormPos(shape)
        return { id: id, x: p.x, y: p.y }
    }

    // ---------- 核心：把曲线烘焙成一条路径的关键帧（纯函数，可单测） ----------
    // from / to: 版心归一化坐标 {x,y}；shape: 形状当前归一化位置
    // 返回 [{t, ox, oy}]，ox/oy 是相对形状当前位置的偏移，按曲线加权
    function bakePath(opts) {
        var ease = bezier(opts.p[0], opts.p[1], opts.p[2], opts.p[3])
        var n = Math.max(2, opts.frames | 0)
        var ox0 = opts.from.x - opts.shape.x, oy0 = opts.from.y - opts.shape.y
        var ox1 = opts.to.x - opts.shape.x, oy1 = opts.to.y - opts.shape.y
        var out = []
        for (var i = 0; i < n; i++) {
            var t = i / (n - 1)
            var e = ease(t)
            out.push({ t: t, ox: ox0 + (ox1 - ox0) * e, oy: oy0 + (oy1 - oy0) * e })
        }
        return out
    }

    function varies(list, key) {
        var lo = Infinity, hi = -Infinity
        for (var i = 0; i < list.length; i++) {
            if (list[i][key] < lo) lo = list[i][key]
            if (list[i][key] > hi) hi = list[i][key]
        }
        return (hi - lo) > 1e-6
    }

    // ---------- 核心：把曲线烘焙成关键帧序列（纯函数，可单测） ----------
    // 返回 [{t: 0~1, v: 相对位移}]，t 均匀分布，v 按曲线加权
    // mode='out'（默认）：从原位移开  v: 0 -> total
    // mode='in'       ：从偏移移回原位 v: total -> 0（用于入场）
    function bakeFrames(opts) {
        var ease = bezier(opts.p[0], opts.p[1], opts.p[2], opts.p[3])
        var n = Math.max(2, opts.frames | 0)
        var total = opts.distance * (opts.direction || 1)
        var incoming = (opts.mode === 'in')
        var out = []
        for (var i = 0; i < n; i++) {
            var t = i / (n - 1)
            var e = ease(t)
            out.push({ t: t, v: incoming ? total * (1 - e) : e * total })
        }
        return out
    }

    // ---------- 核心：把曲线写成一个形状的位置动画 ----------
    // opts: {p:[x1,y1,x2,y2], duration, frames, distance, axis:'x'|'y', direction:1|-1}
    function applyToShape(shape, opts, slide) {
        var seq = slide.TimeLine.MainSequence
        var effectType = C('msoAnimEffectCustom', 0)

        var eff = seq.AddEffect(shape, effectType)

        // 注意：不要用 Behavior.Delete() 清理 AddEffect 自带的 style.visibility set。
        // 实测那样做会连带删掉共享的 cBhvr，导致动画失去 spTgt、dur 变回 indefinite。
        // 该 set 在 delay=0 时会在动画一开始就执行，形状不会被藏住，留着无害。

        // 时长：不设就是 indefinite，动画根本不会走
        try { eff.Timing.Duration = opts.duration } catch (e) { }

        // 播放时机：auto=上一动画之后（进页自动播），with=与上一动画同时，click=单击时
        var trig = (opts.trigger === 'click') ? C('msoAnimTriggerOnPageClick', 1)
            : (opts.trigger === 'with') ? C('msoAnimTriggerWithPrevious', 2)
                : C('msoAnimTriggerAfterPrevious', 3)
        try { eff.Timing.TriggerType = trig } catch (e) { }

        // 关键帧：新接口按「起点→终点」两条轴各写一条行为；旧接口是单轴相对位移
        var tracks = []
        if (opts.path) {
            var pos = shapeNormPos(shape)
            var pf = bakePath({
                p: opts.p, frames: opts.frames, shape: pos,
                from: opts.path.from, to: opts.path.to
            })
            if (varies(pf, 'ox')) tracks.push({ axis: 'x', frames: pf.map(function (f) { return { t: f.t, v: f.ox } }) })
            if (varies(pf, 'oy')) tracks.push({ axis: 'y', frames: pf.map(function (f) { return { t: f.t, v: f.oy } }) })
            if (!tracks.length) throw new Error('起点和终点重合，没有可动的距离')
        } else {
            tracks.push({ axis: (opts.axis === 'y') ? 'y' : 'x', frames: bakeFrames(opts) })
        }

        for (var k = 0; k < tracks.length; k++) {
            var tr = tracks[k]
            var beh = eff.Behaviors.Add(C('msoAnimTypeProperty', 5))
            // 时长必须也写到行为层：p:anim 里 cBhvr/cTn 的 dur 才是引擎真正读的那个
            try { beh.Timing.Duration = opts.duration } catch (e) { }
            var pe = beh.PropertyEffect
            pe.Property = (tr.axis === 'y') ? C('msoAnimY', 2) : C('msoAnimX', 1)

            var attr = (tr.axis === 'y') ? '#ppt_y' : '#ppt_x'
            var pts = pe.Points
            for (var i = 0; i < tr.frames.length; i++) {
                var pt = pts.Add()
                pt.Time = tr.frames[i].t
                var v = tr.frames[i].v
                pt.Value = attr + (v >= 0 ? '+' : '') + v.toFixed(6)
            }
        }
        return {
            shapeId: shape.Id,
            points: tracks[0].frames.length,
            duration: opts.duration,
            axes: tracks.map(function (t) { return t.axis }).join('')
        }
    }

    function applyToSelection(opts) {
        var shapes = selectedShapes()
        var slide = activeSlide()
        var res = []
        for (var i = 0; i < shapes.length; i++) {
            res.push(applyToShape(shapes[i], opts, slide))
        }
        return res
    }

    // 按形状 id 应用；id 为空时回退到“当前选区”
    function applyToTarget(id, opts) {
        if (id === null || id === undefined || id === '') {
            return applyToSelection(opts)
        }
        var shape = findShapeById(id)
        return [applyToShape(shape, opts, activeSlide())]
    }

    // ---------- 自测：造形状 + 上曲线，验证整条链路 ----------
    function selfTest(log) {
        log = log || function () { }
        var a = app()
        var pres = a.ActivePresentation
        if (!pres) throw new Error('没有打开的演示文稿')
        var slide = pres.Slides.Item(1)
        var shapes = slide.Shapes

        var s1 = shapes.AddShape(1, 60, 160, 80, 80)
        var s2 = shapes.AddShape(1, 60, 320, 80, 80)
        try {
            s1.Fill.ForeColor.RGB = 0xFF00FF   // BGR -> 品红，便于录屏追踪
            s2.Fill.ForeColor.RGB = 0xFFFF00   // BGR -> 黄色
        } catch (e) { log('[warn] 填色失败 ' + e) }

        var slideObj = activeSlide()
        var r1 = applyToShape(s1, { p: [0.65, 0, 0.35, 1], duration: 3, frames: 24, distance: 0.35, axis: 'x', direction: 1, trigger: 'auto' }, slideObj)
        var r2 = applyToShape(s2, { p: [0, 0, 1, 1], duration: 3, frames: 2, distance: 0.35, axis: 'x', direction: 1, trigger: 'with' }, slideObj)

        log('[selftest] 绿色(缓入缓出) ' + JSON.stringify(r1))
        log('[selftest] 灰色(线性)   ' + JSON.stringify(r2))

        // 开发环境下存一份副本，方便外部检查生成的 XML
        try {
            if (location.port === '39123' && pres.SaveCopyAs) {
                fetch('http://127.0.0.1:39123/config')
                    .then(function (r) { return r.json() })
                    .then(function (cfg) {
                        var target = cfg.outDir + '\\selftest.pptx'
                        try {
                            pres.SaveCopyAs(target, 24)
                            log('[save] SaveCopyAs ok -> ' + target)
                        } catch (e) {
                            log('[save] SaveCopyAs 失败: ' + e)
                        }
                    })
            }
        } catch (e) { log('[save] 异常 ' + e) }

        return [r1, r2]
    }

    return {
        bezier: bezier,
        bakeFrames: bakeFrames,
        bakePath: bakePath,
        PRESETS: PRESETS,
        selectedShapes: selectedShapes,
        listShapes: listShapes,
        slideKey: slideKey,
        targetPos: targetPos,
        shapeNormPos: shapeNormPos,
        applyToSelection: applyToSelection,
        applyToTarget: applyToTarget,
        selfTest: selfTest
    }
})()
