// 曲线逻辑单测：贝塞尔求值 + 关键帧烘焙。不依赖 WPS，纯 Node 跑。
// 用法: node tools/tests/curve.test.js

const fs = require('fs')
const path = require('path')

const srcPath = path.join(__dirname, '..', '..', 'addin', 'js', 'curve.js')
const src = fs.readFileSync(srcPath, 'utf8')
// curve.js 是给浏览器用的普通脚本，包一层拿到导出对象
const mockWindow = {
    Application: {
        Enum: {},
        ActivePresentation: { PageSetup: { SlideWidth: 960, SlideHeight: 540 } }
    }
}
const CurveAnim = new Function('window', 'location', src + '\n;return CurveAnim')(mockWindow, { port: '' })
const { bezier, bakeFrames, PRESETS } = CurveAnim

let pass = 0, fail = 0
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ok   ' + name + (detail ? '  (' + detail + ')' : '')) }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')) }
}

console.log('== 贝塞尔求值 ==')
const lin = bezier(0, 0, 1, 1)
ok('线性 t=0.25 精确', Math.abs(lin(0.25) - 0.25) < 1e-9, lin(0.25).toFixed(9))
ok('线性 t=0.73 精确', Math.abs(lin(0.73) - 0.73) < 1e-9, lin(0.73).toFixed(9))

const eio = bezier(0.65, 0, 0.35, 1)
ok('缓入缓出 中点=0.5', Math.abs(eio(0.5) - 0.5) < 1e-6, eio(0.5).toFixed(9))
ok('缓入缓出 前段慢', eio(0.25) < 0.25, eio(0.25).toFixed(6))
ok('缓入缓出 后段慢', eio(0.75) > 0.75, eio(0.75).toFixed(6))

const ein = bezier(...PRESETS.easeIn.p)
const eout = bezier(...PRESETS.easeOut.p)
ok('缓入 落后线性', ein(0.5) < 0.5, ein(0.5).toFixed(6))
ok('缓出 领先线性', eout(0.5) > 0.5, eout(0.5).toFixed(6))

console.log('\n== 预设端点与单调性 ==')
for (const k of Object.keys(PRESETS)) {
    const f = bezier(...PRESETS[k].p)
    ok(PRESETS[k].name + ' 端点', Math.abs(f(0)) < 1e-12 && Math.abs(f(1) - 1) < 1e-12)
    if (k === 'back') continue   // 回弹本来就非单调
    let mono = true, prev = -1e9
    for (let i = 0; i <= 400; i++) { const v = f(i / 400); if (v < prev - 1e-9) mono = false; prev = v }
    ok(PRESETS[k].name + ' 单调递增', mono)
}

const back = bezier(...PRESETS.back.p)
let maxBack = 0, nonMono = false, prevB = -1e9
for (let i = 0; i <= 400; i++) {
    const v = back(i / 400)
    maxBack = Math.max(maxBack, v)
    if (v < prevB - 1e-9) nonMono = true
    prevB = v
}
ok('回弹 有超调', maxBack > 1.02, 'max=' + maxBack.toFixed(4))
ok('回弹 非单调（超调后回落）', nonMono)
ok('回弹 收敛到 1', Math.abs(back(1) - 1) < 1e-12)

console.log('\n== 关键帧烘焙 ==')
const f5 = bakeFrames({ p: PRESETS.easeInOut.p, frames: 5, distance: 0.35, direction: 1 })
console.log('  5 帧:', f5.map(x => x.t.toFixed(2) + ':' + x.v.toFixed(6)).join('  '))
ok('帧数正确', f5.length === 5)
ok('起点为 0', Math.abs(f5[0].v) < 1e-12)
ok('终点 = 距离', Math.abs(f5[4].v - 0.35) < 1e-12, f5[4].v.toFixed(9))
ok('时间均匀', Math.abs(f5[2].t - 0.5) < 1e-12)
ok('中点值 = 曲线(0.5)×距离', Math.abs(f5[2].v - eio(0.5) * 0.35) < 1e-12)
ok('前半段推进 < 线性', f5[1].v < 0.35 * 0.25)

const neg = bakeFrames({ p: PRESETS.linear.p, frames: 3, distance: 0.3, direction: -1 })
ok('负方向取负', Math.abs(neg[2].v + 0.3) < 1e-12, neg[2].v.toFixed(6))
ok('frames=1 退化为 2 帧', bakeFrames({ p: PRESETS.linear.p, frames: 1, distance: 0.1, direction: 1 }).length === 2)

const m24 = bakeFrames({ p: PRESETS.easeInOut.p, frames: 24, distance: 0.5, direction: 1 })
let mono24 = true
for (let i = 1; i < m24.length; i++) if (m24[i].v < m24[i - 1].v - 1e-12) mono24 = false
ok('24 帧单调递增', mono24)
ok('24 帧首尾正确', Math.abs(m24[0].v) < 1e-12 && Math.abs(m24[23].v - 0.5) < 1e-12)

const b30 = bakeFrames({ p: PRESETS.back.p, frames: 30, distance: 0.4, direction: 1 })
ok('回弹烘焙后中途超出终点', Math.max(...b30.map(x => x.v)) > 0.4,
    'max=' + Math.max(...b30.map(x => x.v)).toFixed(4))

console.log('\n== 移入模式（入场用）==')
const inLin = bakeFrames({ p: PRESETS.linear.p, frames: 5, distance: 0.3, direction: 1, mode: 'in' })
ok('移入 起点 = 距离', Math.abs(inLin[0].v - 0.3) < 1e-12, inLin[0].v.toFixed(6))
ok('移入 终点 = 0', Math.abs(inLin[4].v) < 1e-12)
ok('移入 线性时中点 = 一半', Math.abs(inLin[2].v - 0.15) < 1e-12)

const inEase = bakeFrames({ p: PRESETS.easeInOut.p, frames: 9, distance: 0.3, direction: -1, mode: 'in' })
ok('移入 负方向起点为负', inEase[0].v < -0.299, inEase[0].v.toFixed(6))
ok('移入 终点归零', Math.abs(inEase[8].v) < 1e-12)
// 注意方向可为负：v 从 -0.3 走到 0 数值上是递增的，
// 真正要验的是“离原位的距离”单调减小
let shrinking = true
for (let i = 1; i < inEase.length; i++) {
    if (Math.abs(inEase[i].v) > Math.abs(inEase[i - 1].v) + 1e-12) shrinking = false
}
ok('移入 离原位距离单调减小', shrinking)

const outEase = bakeFrames({ p: PRESETS.easeInOut.p, frames: 9, distance: 0.3, direction: -1 })
let compOk = true
for (let i = 0; i < 9; i++) if (Math.abs(outEase[i].v + inEase[i].v - (-0.3)) > 1e-12) compOk = false
ok('移入 / 移出 逐帧互补', compOk)

console.log('\n== 起止点路径（当前界面用的模型）==')
const { bakePath } = CurveAnim
const shape = { x: 0.125, y: 0.481 }

// 起点终点相同 -> 全程静止
const still = bakePath({ p: PRESETS.linear.p, frames: 5, shape, from: shape, to: shape })
ok('起止点重合时偏移全为 0',
    still.every(f => Math.abs(f.ox) < 1e-12 && Math.abs(f.oy) < 1e-12))

// 从版心左上角走到右下角
const diag = bakePath({ p: PRESETS.linear.p, frames: 5, shape: { x: 0, y: 0 }, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } })
ok('线性路径 终点到位', Math.abs(diag[4].ox - 1) < 1e-12 && Math.abs(diag[4].oy - 1) < 1e-12)
ok('线性路径 中点为一半', Math.abs(diag[2].ox - 0.5) < 1e-12 && Math.abs(diag[2].oy - 0.5) < 1e-12)

// 入场：从偏移处回到形状原位
const enter = bakePath({ p: PRESETS.linear.p, frames: 5, shape, from: { x: 0.025, y: 0.181 }, to: shape })
ok('入场 首帧偏移 = 起点 - 形状位置',
    Math.abs(enter[0].ox - (0.025 - 0.125)) < 1e-12 && Math.abs(enter[0].oy - (0.181 - 0.481)) < 1e-12)
ok('入场 末帧回到原位（偏移 0）', Math.abs(enter[4].ox) < 1e-12 && Math.abs(enter[4].oy) < 1e-12)

// 两轴同时变，且曲线作用于两轴
const both = bakePath({ p: PRESETS.easeInOut.p, frames: 9, shape, from: { x: 0.125, y: 0.481 }, to: { x: 0.725, y: 0.981 } })
const eioRef = bezier(...PRESETS.easeInOut.p)
ok('两轴同帧同曲线', Math.abs((both[4].ox - both[0].ox) / (both[8].ox - both[0].ox) - eioRef(0.5)) < 1e-9)
ok('X 轴总位移 = 版心 60%', Math.abs((both[8].ox - both[0].ox) - 0.6) < 1e-12,
    (both[8].ox - both[0].ox).toFixed(6))
ok('Y 轴总位移 = 版心 50%', Math.abs((both[8].oy - both[0].oy) - 0.5) < 1e-12,
    (both[8].oy - both[0].oy).toFixed(6))

console.log('\n== 形状在版心上的位置（必须是中心，不是左上角）==')
const { shapeNormPos } = CurveAnim
const s1 = shapeNormPos({ Left: 120, Top: 260, Width: 180, Height: 120 })
ok('X 取中心', Math.abs(s1.x - (120 + 90) / 960) < 1e-12, s1.x.toFixed(5))
ok('Y 取中心', Math.abs(s1.y - (260 + 60) / 540) < 1e-12, s1.y.toFixed(5))
ok('不是左上角', Math.abs(s1.y - 260 / 540) > 1e-6, '左上角会是 ' + (260 / 540).toFixed(5))

// 形状贴左上角时，中心应是半宽半高
const s2 = shapeNormPos({ Left: 0, Top: 0, Width: 96, Height: 54 })
ok('贴边形状 中心 = 半宽半高', Math.abs(s2.x - 0.05) < 1e-12 && Math.abs(s2.y - 0.05) < 1e-12,
    s2.x.toFixed(4) + ', ' + s2.y.toFixed(4))

// 拿不到宽高时退化回左上角，不要算出 NaN
const s3 = shapeNormPos({ Left: 480, Top: 270 })
ok('缺宽高时退化为 Left/Top', Math.abs(s3.x - 0.5) < 1e-12 && Math.abs(s3.y - 0.5) < 1e-12)

console.log('\n' + (fail === 0 ? `全部通过（${pass} 项）` : `失败 ${fail} 项，通过 ${pass} 项`))
process.exit(fail === 0 ? 0 : 1)

