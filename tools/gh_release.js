// 往 GitHub Release 上传附件
//   node tools/gh_release.js --tag v0.1.0 --file release/WpsCurveAnim-一键注册.bat
//   node tools/gh_release.js --tag v0.1.0 --file a.bat --file b.7z

const fs = require('fs')
const path = require('path')
const os = require('os')

const OWNER = 'ZeroN-glitch'
const REPO = 'WPS-Curve-Anim'

function arg(name, def) {
    const i = process.argv.indexOf('--' + name)
    return i < 0 ? def : process.argv[i + 1]
}
function argAll(name) {
    const out = []
    process.argv.forEach((a, i) => { if (a === '--' + name && process.argv[i + 1]) out.push(process.argv[i + 1]) })
    return out
}

function findToken() {
    if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim()
    const home = os.homedir()
    for (const n of ['.gh_token', '.gh_token.txt', 'gh_token.txt', 'gh_token']) {
        const p = path.join(home, n)
        if (fs.existsSync(p)) {
            const t = fs.readFileSync(p, 'utf8').trim()
            if (t) return t
        }
    }
    return ''
}

const token = findToken()
if (!token) { console.error('没找到令牌'); process.exit(1) }

const H = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'wps-curve-addin-release'
}

async function api(method, url, body, raw) {
    const headers = Object.assign({}, H)
    if (body && !raw) headers['Content-Type'] = 'application/json'
    if (raw) headers['Content-Type'] = 'application/octet-stream'
    const res = await fetch('https://api.github.com' + url, {
        method, headers, body: raw ? raw : (body ? JSON.stringify(body) : undefined)
    })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch (e) { data = text }
    if (!res.ok) {
        const e = new Error(method + ' ' + url + ' -> ' + res.status + ' ' + ((data && data.message) || ''))
        e.status = res.status
        throw e
    }
    return data
}

;(async () => {
    const tag = arg('tag', 'v0.1.0')
    const files = argAll('file')
    if (!files.length) { console.error('用法: --tag v0.1.0 --file 路径'); process.exit(1) }

    // 找已有 release
    const list = await api('GET', '/repos/' + OWNER + '/' + REPO + '/releases')
    let rel = Array.isArray(list) ? list.find(r => r.tag_name === tag) : null
    if (!rel) {
        console.log('没找到 ' + tag + '，先建一个')
        rel = await api('POST', '/repos/' + OWNER + '/' + REPO + '/releases', {
            tag_name: tag,
            name: tag,
            body: 'WPS 演示动画曲线编辑加载项'
        })
    }
    console.log('Release: ' + rel.html_url)

    for (const f of files) {
        const p = path.resolve(f)
        if (!fs.existsSync(p)) { console.log('  跳过（不存在）: ' + f); continue }
        const name = path.basename(p)
        const buf = fs.readFileSync(p)

        const existing = (rel.assets || []).find(a => a.name === name)
        if (existing) {
            console.log('  已存在，先删旧附件: ' + name)
            await api('DELETE', '/repos/' + OWNER + '/' + REPO + '/releases/assets/' + existing.id)
        }

        const up = await fetch(
            'https://uploads.github.com/repos/' + OWNER + '/' + REPO + '/releases/' + rel.id + '/assets?name=' + encodeURIComponent(name),
            { method: 'POST', headers: Object.assign({}, H, { 'Content-Type': 'application/octet-stream' }), body: buf }
        )
        const asset = await up.json()
        if (!up.ok) { console.log('  上传失败 ' + name + ': ' + up.status + ' ' + asset.message); continue }
        console.log('  ' + name + '  ' + Math.round(asset.size / 1024) + ' KB')
        console.log('  ' + asset.browser_download_url)
    }
})().catch(e => { console.error('失败: ' + e.message); process.exit(1) })
