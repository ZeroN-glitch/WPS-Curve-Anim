// 一键发布：在线构建 -> 生成安装页 -> 清理示例条目 -> 部署到 docs/ -> 打离线包
//
// 用法: node tools/release.js https://<用户名>.github.io/<仓库名>/addon/
// 不传参数则使用 package.json 里的 homepage 字段。
// 加 --allow-placeholder 可以带着占位符试跑整条流水线（只用于本地验证）。

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const ADDIN = path.join(ROOT, 'addin')
const DOCS = path.join(ROOT, 'docs')
const RELEASE = path.join(ROOT, 'release')

const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const allowPlaceholder = process.argv.includes('--allow-placeholder')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

let url = args[0] || pkg.homepage
if (!url) {
    console.error('缺少发布地址。用法: node tools/release.js https://user.github.io/repo/addon/')
    process.exit(1)
}
if (!url.endsWith('/')) url += '/'
if (/YOUR-NAME/.test(url) && !allowPlaceholder) {
    console.error('发布地址里还有占位符 YOUR-NAME。')
    console.error('先改 package.json 的 homepage（或直接传参），确认无误再发布。')
    console.error('只想本地试跑整条流水线可加 --allow-placeholder。')
    process.exit(1)
}

// build.js 在 require 时就会读取 cwd 下的 package.json（决定 7z 名字），
// 所以必须先进到 addin 目录再 require，否则离线包会被按根目录的包名命名。
process.chdir(ADDIN)
const { buildWithArgs } = require(path.join(ROOT, 'node_modules/wpsjs/src/lib/build.js'))

function step(name) { console.log('\n== ' + name) }

// build.js 的 Promise 在 7z 归档写完之前就 resolve 了，得等文件真的出现
function waitForFile(p, timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 15000)
    while (Date.now() < deadline) {
        try {
            const st = fs.statSync(p)
            if (st.size > 0) {
                // 再等一小会儿，确保句柄释放
                const t0 = Date.now()
                while (Date.now() - t0 < 150) { /* spin */ }
                return true
            }
        } catch (e) { /* 还没出现 */ }
        const t0 = Date.now()
        while (Date.now() - t0 < 100) { /* spin */ }
    }
    return false
}

async function main() {
    step('1/4 在线构建')
    await buildWithArgs({ pluginType: 'online' })
    console.log('   -> addin/wps-addon-build/')

    step('2/4 生成安装页')
    const wpsjs = path.join(ROOT, 'node_modules', '.bin', 'wpsjs.cmd')
    // Node 20+ 不允许直接 spawn .cmd，必须经过 cmd /c
    execFileSync('cmd', ['/c', wpsjs, 'publish', '-s', url], { cwd: ADDIN, stdio: 'inherit' })

    // wpsjs 会在 curList 里塞一个自带的示例条目 test123，必须去掉
    step('3/4 清理安装页并部署到 docs/')
    // FAQ 页面由 FAQ.md 生成，一起刷新，避免文档改了站点还是旧的
    execFileSync(process.execPath, [path.join(__dirname, 'build_faq_page.js')], { stdio: 'inherit' })

    const pubPath = path.join(ADDIN, 'wps-addon-publish', 'publish.html')
    let html = fs.readFileSync(pubPath, 'utf8')
    html = html.replace(/\{"name":"test123"[^}]*\},?/g, '')
    fs.mkdirSync(DOCS, { recursive: true })
    fs.writeFileSync(path.join(DOCS, 'publish.html'), html)

    const src = path.join(ADDIN, 'wps-addon-build')
    const dst = path.join(DOCS, 'addon')
    fs.rmSync(dst, { recursive: true, force: true })
    fs.cpSync(src, dst, { recursive: true })

    const m = html.match(/var curList = (\[.*?\]);/s)
    console.log('   安装页里的加载项:', m ? m[1] : '(没找到 curList)')

    step('4/4 打离线包')
    // 自己打包而不是用 wpsjs 的离线构建：它只丢一个裸文件夹进去，
    // 下载的人不知道该拿它怎么办。这里加上说明和 publish.xml 示例。
    const addinPkg = JSON.parse(fs.readFileSync(path.join(ADDIN, 'package.json'), 'utf8'))
    const stage = path.join(RELEASE, '.stage')
    fs.rmSync(stage, { recursive: true, force: true })
    const inner = path.join(stage, addinPkg.name + '_' + addinPkg.version)
    fs.mkdirSync(inner, { recursive: true })
    fs.cpSync(path.join(ADDIN, 'wps-addon-build'), inner, { recursive: true })

    fs.writeFileSync(path.join(stage, 'README.txt'), [
        'WPS 演示 · 动画速率曲线编辑器  v' + addinPkg.version,
        '',
        '这个压缩包里是加载项的全部静态文件（' + addinPkg.name + '_' + addinPkg.version + '/ 目录）。',
        '',
        '【个人版】不能直接用这个包安装。个人版从 12.1.0.16910 起，',
        '通过 oem.ini / jsplugins.xml 指向本地目录的部署方式已被官方限制，',
        '只能通过在线安装页安装：',
        '    <你的域名>/publish.html',
        '',
        '【专业版 / 企业版】可以离线部署：',
        '  1. 把 ' + addinPkg.name + '_' + addinPkg.version + '/ 放到任意固定目录',
        '  2. 在 jsplugins.xml 里把 url 指向该目录对应的本地路径',
        '  3. 详细格式见 publish.xml.sample',
        '',
        '【任何人都可以】把这个包当备份，或者用其中的文件自建静态托管。',
        ''
    ].join('\r\n'))

    fs.writeFileSync(path.join(stage, 'publish.xml.sample'), [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!-- 离线部署参考：把 url 换成你实际的本地路径或静态托管地址 -->',
        '<jsplugins>',
        '  <jspluginonline name="' + addinPkg.name + '" type="' + addinPkg.addonType + '"',
        '                  url="file:///C:/path/to/' + addinPkg.name + '_' + addinPkg.version + '/"',
        '                  debug="" enable="enable_dev" install="null" customDomain=""/>',
        '</jsplugins>',
        ''
    ].join('\r\n'))

    const sevenZipName = addinPkg.name + '.7z'
    const sevenZipPath = path.join(RELEASE, sevenZipName)
    fs.rmSync(sevenZipPath, { force: true })
    const z7 = require(path.join(ROOT, 'node_modules/7zip-bin')).path7za
    execFileSync(z7, ['a', '-t7z', '-mx=9', sevenZipPath, '.'], { cwd: stage, stdio: 'ignore' })
    fs.rmSync(stage, { recursive: true, force: true })
    if (!waitForFile(sevenZipPath, 10000)) throw new Error('离线包没有生成: ' + sevenZipPath)
    console.log('   -> release/' + sevenZipName + '（' + Math.round(fs.statSync(sevenZipPath).size / 1024) + ' KB）')

    console.log('\n全部完成。')
    console.log('把 docs/ 推到 GitHub 并开启 Pages，然后访问:')
    console.log('  ' + url.replace(/addon\/$/, '') + 'publish.html')
}

main().catch(e => { console.error('\n发布失败:', e.message); process.exit(1) })
