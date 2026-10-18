// 资源完整性检查：扫描加载项里引用的静态文件，确认发布产物里一个都不缺。
// 少一个 svg / js，WPS 里就是白屏或没图标，而且不会有任何报错——所以必须自动查。
// 用法: node tools/tests/assets.test.js

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const ADDIN = path.join(ROOT, 'addin')
const SHIPPED = path.join(ROOT, 'docs', 'addon')

let pass = 0, fail = 0
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ok   ' + name) }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')) }
}

// 收集要检查的文本文件
function walk(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === 'wps-addon-build' || e.name === 'wps-addon-publish') continue
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p, out)
        else if (/\.(html|js|xml)$/.test(e.name)) out.push(p)
    }
    return out
}

// 从文本里抽出可能的资源引用
function refsIn(text) {
    const out = new Set()
    const re = /['"]([^'"\s]+\.(?:js|css|svg|png|json))['"]/g
    let m
    while ((m = re.exec(text)) !== null) {
        const v = m[1]
        if (/^(https?:)?\/\//.test(v) || v.startsWith('data:')) continue
        out.add(v)
    }
    // html 里的 src= / href=（不带引号的情况也能覆盖到，上面已按引号处理）
    return out
}

const files = walk(ADDIN, [])
console.log('== 扫描 ' + files.length + ' 个源文件 ==')

const missing = []
const seen = new Set()
let checked = 0
const samples = []
for (const f of files) {
    const rel = path.relative(ADDIN, f)
    const text = fs.readFileSync(f, 'utf8')
    for (const r of refsIn(text)) {
        const cleaned = r.replace(/^\.\//, '')
        // 引用可能是相对当前文件，也可能相对加载项根目录
        const cands = [
            path.resolve(path.dirname(f), cleaned),
            path.resolve(ADDIN, cleaned)
        ]
        const hit = cands.find(p => fs.existsSync(p))
        const key = rel + ' -> ' + cleaned
        if (!hit) {
            if (!seen.has(key)) { seen.add(key); missing.push(key) }
        } else {
            if (!seen.has(key)) { checked++; if (samples.length < 6) samples.push(key) }
            seen.add(key)
            // 同步确认发布产物里也有
            const shipPath = path.join(SHIPPED, path.relative(ADDIN, hit))
            if (!fs.existsSync(shipPath)) {
                missing.push('发布产物缺少: ' + path.relative(ADDIN, hit))
            }
        }
    }
}

console.log('  检查到 ' + checked + ' 条不同引用，例如：')
samples.forEach(s => console.log('    ' + s))

// 防止“一条引用都没扫到”导致的假通过
ok('确实扫到了资源引用（>= 5 条）', checked >= 5, '实际 ' + checked)
ok('引用的资源全部存在（源码 + docs/addon）', missing.length === 0, missing.join(' | '))

// 关键入口文件必须齐
const required = ['index.html', 'main.js', 'manifest.xml', 'ribbon.xml',
    'js/curve.js', 'js/ribbon.js', 'ui/editor.html', 'images/curve.svg']
for (const r of required) {
    ok('发布产物包含 ' + r, fs.existsSync(path.join(SHIPPED, r)))
}

// 发布产物不能夹带开发文件
for (const r of ['package.json', 'package-lock.json']) {
    ok('发布产物不含 ' + r, !fs.existsSync(path.join(SHIPPED, r)))
}

console.log('\n' + (fail === 0 ? `全部通过（${pass} 项）` : `失败 ${fail} 项，通过 ${pass} 项`))
process.exit(fail === 0 ? 0 : 1)
