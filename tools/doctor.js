// 环境体检：装不上/看不到选项卡时先跑这个，把 FAQ 里的排查步骤自动化。
// 用法: node tools/doctor.js [发布地址]
// 只读，不改任何东西。

const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const https = require('https')
const crypto = require('crypto')
const { execSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const ADDIN = path.join(ROOT, 'addin')
const SHIPPED = path.join(ROOT, 'docs', 'addon')
const PUBLISH_XML = path.join(process.env.APPDATA || '', 'kingsoft', 'wps', 'jsaddons', 'publish.xml')

const results = []
function add(level, title, detail) {
    results.push({ level, title, detail })
    const mark = level === 'ok' ? '  ✓' : level === 'warn' ? '  !' : '  ✗'
    console.log(mark + ' ' + title)
    if (detail) console.log('      ' + String(detail).replace(/\n/g, '\n      '))
}

function sha(p) {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function probe(url, timeoutMs) {
    return new Promise(resolve => {
        let done = false
        const finish = r => { if (!done) { done = true; resolve(r) } }
        let lib
        try { lib = url.startsWith('https:') ? https : http } catch (e) { return finish({ ok: false, err: '地址格式不对' }) }
        const req = lib.get(url, res => {
            let body = ''
            res.setEncoding('utf8')
            res.on('data', c => { if (body.length < 400) body += c })
            res.on('end', () => finish({ ok: res.statusCode === 200, status: res.statusCode, head: body.slice(0, 80) }))
        })
        req.on('error', e => finish({ ok: false, err: e.message }))
        req.setTimeout(timeoutMs || 4000, () => { req.destroy(); finish({ ok: false, err: '超时' }) })
    })
}

async function main() {
    console.log('== WPS 动画曲线 · 环境体检');
    console.log('   项目目录: ' + ROOT);

    // 1. Node
    const major = parseInt(process.versions.node.split('.')[0], 10)
    add(major >= 14 ? 'ok' : 'fail', 'Node.js ' + process.versions.node,
        major >= 14 ? null : '需要 Node 14 以上')

    // 2. 仓库文件
    const need = ['addin/index.html', 'addin/ribbon.xml', 'addin/js/curve.js',
        'addin/js/ribbon.js', 'addin/ui/editor.html', 'addin/images/curve.svg']
    const lack = need.filter(f => !fs.existsSync(path.join(ROOT, f)))
    add(lack.length === 0 ? 'ok' : 'fail', '加载项源文件', lack.length ? '缺少: ' + lack.join(', ') : '6 个关键文件齐全')

    // 3. 发布产物一致性
    if (!fs.existsSync(SHIPPED)) {
        add('warn', '发布产物 docs/addon', '还没生成，跑一次 npm run release')
    } else {
        const diff = need.map(f => f.replace('addin/', '')).filter(f => {
            const a = path.join(ADDIN, f), b = path.join(SHIPPED, f)
            if (!fs.existsSync(a) || !fs.existsSync(b)) return true
            return sha(a) !== sha(b)
        })
        add(diff.length === 0 ? 'ok' : 'warn', '源码与发布产物一致',
            diff.length ? '这些文件不一致（需重新 npm run release）: ' + diff.join(', ') : null)
    }

    // 4. publish.xml
    let url = process.argv[2]
    if (!fs.existsSync(PUBLISH_XML)) {
        add('fail', '没有找到加载项注册文件', PUBLISH_XML + '\nWPS 不会加载任何第三方加载项。见 README「方式一：本地调试」')
    } else {
        const xml = fs.readFileSync(PUBLISH_XML, 'utf8')
        const m = xml.match(/name="WpsCurveAnim"[^>]*url="([^"]+)"/)
        if (!m) {
            add('fail', '注册文件里没有 WpsCurveAnim', '内容: ' + xml.trim().slice(0, 200))
        } else {
            add('ok', '加载项已注册', 'url = ' + m[1])
            url = url || m[1]
        }
    }

    // 5. 地址可达性
    if (!url) {
        add('warn', '跳过地址探测', '没有可探测的加载项地址')
    } else {
        const base = url.endsWith('/') ? url : url + '/'
        const r = await probe(base + 'ribbon.xml')
        if (r.ok && /<customUI/.test(r.head)) {
            add('ok', '发布地址可达，ribbon.xml 正常', base + 'ribbon.xml')
        } else if (r.ok) {
            add('warn', '地址能通但 ribbon.xml 内容可疑', '开头是: ' + r.head)
        } else {
            add('fail', '拉不到 ribbon.xml', (r.err || ('HTTP ' + r.status)) +
                '\nWPS 启动时第一件事就是拉它，拉不到插件就不会出现。')
        }
    }

    // 6. WPS 是否安装
    try {
        const out = execSync('reg query "HKEY_CLASSES_ROOT\\KWPS.Document.12\\shell\\open\\command" /ve',
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        const exe = (out.match(/"([^"]+wps\.exe)"/i) || [])[1]
        add('ok', 'WPS 已安装', exe || out.trim().split('\n')[0])
    } catch (e) {
        add('warn', '没能从注册表确认 WPS', '可能未安装，或不是标准安装')
    }

    // 7. 进程
    try {
        const ps = execSync('tasklist /fi "imagename eq wpp.exe" /nh', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        const running = /wpp\.exe/i.test(ps)
        add('ok', running ? 'WPS 演示正在运行' : 'WPS 演示未运行',
            running ? null : '提示：改完配置需要完全退出再打开 WPS；且必须打开一个文档才会加载加载项')
    } catch (e) { /* 忽略 */ }

    const bad = results.filter(r => r.level === 'fail').length
    console.log('\n' + (bad === 0 ? '体检通过。' : '有 ' + bad + ' 项需要处理，见上面的 ✗。'));
    if (bad > 0) {
        console.log('排查顺序参考 FAQ.md：装不上 / 看不到');
    }
    process.exit(bad === 0 ? 0 : 1)
}

main()
