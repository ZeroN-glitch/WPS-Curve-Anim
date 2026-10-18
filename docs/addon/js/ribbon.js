// 功能区回调 + 任务窗格管理

var WPS_Enum = { msoCTPDockPositionLeft: 0, msoCTPDockPositionRight: 2 }

function GetUrlPath() {
    var e = decodeURI(document.location.toString())
    return e.substring(0, e.lastIndexOf('/'))
}

// 只在本地调试端口上回传日志，正式发布时自动静默
function devLog(msg) {
    try {
        if (location.port !== '39123') return
        fetch('http://127.0.0.1:39123/log', { method: 'POST', body: String(msg) })
    } catch (e) { }
}

function OnAddinLoad(ribbonUI) {
    try {
        window.Application.ribbonUI = ribbonUI
        if (typeof (window.Application.Enum) != 'object') window.Application.Enum = WPS_Enum
    } catch (e) { }
    devLog('[load] 曲线加载项已加载')
    devAutoTest()
    devProbe()
    devProbeEntrance()
    return true
}

// 开发自测开关：会自动往当前文档加两个方块并立刻放映。
// 交给他人验收时必须保持 false。
var DEV_AUTOTEST = false

// 入场行为实验：造一个方块，写入「单击时播放」的移入动画，存副本供外部观察
var DEV_ENTRANCE = false

function devProbeEntrance() {
    if (!DEV_ENTRANCE || location.port !== '39123') return
    setTimeout(function () {
        try {
            var app = window.Application
            var pres = app.ActivePresentation
            if (!pres) { devLog('[entr] 没有文档'); return }
            var slide = pres.Slides.Item(1)
            var shapes = slide.Shapes
            var shp = shapes.AddShape(1, 120, 260, 140, 140)
            try { shp.Fill.ForeColor.RGB = 0xFF00FF } catch (e) { }
            devLog('[entr] 已造方块 id=' + shp.Id)

            var res = CurveAnim.applyToTarget(shp.Id, {
                p: [0.65, 0, 0.35, 1], duration: 3, frames: 20,
                distance: 0.4, axis: 'x', direction: 1, mode: 'in', trigger: 'click'
            })
            devLog('[entr] 写入移入动画 -> ' + JSON.stringify(res))

            fetch('http://127.0.0.1:39123/config')
                .then(function (r) { return r.json() })
                .then(function (cfg) {
                    try {
                        pres.SaveCopyAs(cfg.outDir + '\\entrance-click.pptx', 24)
                        devLog('[entr] 已保存 entrance-click.pptx')
                    } catch (e) { devLog('[entr] 保存失败: ' + e) }
                })
        } catch (e) { devLog('[entr] 异常: ' + e) }
    }, 2600)
}

// 真机环境探针：只在本地调试端口生效，用来验证真实 WPS 对象模型的行为。
// 验收/发布前必须为 false，否则每次打开文档都会自动写一条动画。
var DEV_PROBE = false

function devProbe() {
    if (!DEV_PROBE || location.port !== '39123') return
    setTimeout(function () {
        var app = window.Application
        devLog('[probe] ===== 开始 =====')
        try {
            var pres = app.ActivePresentation
            devLog('[probe] 文档=' + (pres ? pres.Name : 'null'))
            var slide = pres.Slides.Item(1)
            var shapes = slide.Shapes
            devLog('[probe] 形状数=' + shapes.Count)

            var list = []
            for (var i = 1; i <= shapes.Count; i++) {
                var s = shapes.Item(i)
                list.push(s.Id + ':' + s.Name)
            }
            devLog('[probe] 形状列表=' + list.join(' | '))

            var first = shapes.Item(1)

            // 1) 选区 API
            try {
                var sel = app.ActiveWindow.Selection
                devLog('[probe] Selection.ShapeRange 存在=' + (sel.ShapeRange ? 'yes' : 'no'))
                try { first.Select() } catch (e) { devLog('[probe] Shape.Select 失败: ' + e) }
                try {
                    devLog('[probe] 选中后 ShapeRange.Count=' + sel.ShapeRange.Count)
                    devLog('[probe] 选区首个 id=' + sel.ShapeRange.Item(1).Id)
                } catch (e) { devLog('[probe] 读 ShapeRange 失败: ' + e) }
                try {
                    devLog('[probe] selectedShapes()=' + CurveAnim.selectedShapes().length)
                } catch (e) { devLog('[probe] selectedShapes 抛错: ' + e) }
                try {
                    devLog('[probe] listShapes()=' + CurveAnim.listShapes().length)
                } catch (e) { devLog('[probe] listShapes 抛错: ' + e) }
            } catch (e) { devLog('[probe] 选区整体失败: ' + e) }

            // 2) 真机写入 + 存副本
            try {
                var res = CurveAnim.applyToTarget(first.Id, {
                    p: [0.65, 0, 0.35, 1], duration: 2.5, frames: 20,
                    distance: 0.3, axis: 'x', direction: 1, trigger: 'auto'
                })
                devLog('[probe] applyToTarget -> ' + JSON.stringify(res))
            } catch (e) { devLog('[probe] 写入失败: ' + e) }

            try {
                fetch('http://127.0.0.1:39123/config')
                    .then(function (r) { return r.json() })
                    .then(function (cfg) {
                        try {
                            pres.SaveCopyAs(cfg.outDir + '\\probe.pptx', 24)
                            devLog('[probe] SaveCopyAs ok')
                        } catch (e) { devLog('[probe] SaveCopyAs 失败: ' + e) }
                    })
            } catch (e) { devLog('[probe] config 请求失败: ' + e) }

            // 3) 任务窗格
            try {
                openEditor()
                devLog('[probe] CreateTaskPane 已调用')
            } catch (e) { devLog('[probe] 任务窗格失败: ' + e) }

        } catch (e) {
            devLog('[probe] 异常: ' + e)
        }
    }, 2500)
}

function devAutoTest() {
    if (!DEV_AUTOTEST) return
    if (location.port !== '39123') return
    setTimeout(function () {
        try {
            runSelfTest()
        } catch (e) { devLog('[autotest] 失败: ' + e) }
        setTimeout(function () {
            try {
                window.Application.ActivePresentation.SlideShowSettings.Run()
                devLog('[show] 已请求放映')
            } catch (e) { devLog('[show] 放映失败: ' + e) }
        }, 1500)
    }, 2500)
}

function OnGetEnabled() { return true }
function OnGetVisible() { return true }
function GetImage() { return 'images/curve.svg' }

function OnAction(control) {
    var id = control.Id
    if (id === 'btnEditor') {
        openEditor()
    }
    return true
}

function openEditor() {
    try {
        var app = window.Application
        var tsId = app.PluginStorage.getItem('curve_taskpane_id')
        if (tsId) {
            var tp = app.GetTaskPane(tsId)
            if (tp) {
                tp.Visible = true
                return
            }
        }
        var pane = app.CreateTaskPane(GetUrlPath() + '/ui/editor.html')
        app.PluginStorage.setItem('curve_taskpane_id', pane.ID)
        try { pane.DockPosition = app.Enum.msoCTPDockPositionRight } catch (e) { }
        pane.Visible = true
        devLog('[pane] 已创建任务窗格 id=' + pane.ID)
    } catch (e) {
        devLog('[pane] 创建失败: ' + e)
        alert('打开曲线编辑器失败：' + e.message)
    }
}

function runSelfTest() {
    try {
        var res = CurveAnim.selfTest(devLog)
        devLog('[selftest] ' + JSON.stringify(res))
        return res
    } catch (e) {
        devLog('[selftest] 失败: ' + e)
        alert('自测失败：' + e.message)
    }
}
