// 手动注册加载项：把 publish.xml 指向一个在线地址
// 用在你「点安装页没反应」的时候——安装页依赖 WPS 的本地服务 127.0.0.1:58890，
// 那个服务没起来时页面会静默失败，只能直接写注册文件。
//
//   node tools/register_addin.js                     用默认地址
//   node tools/register_addin.js https://你的地址/addon/
//   node tools/register_addin.js --restore           还原最近一次备份
//   node tools/register_addin.js --show              只看当前注册状态

const fs = require('fs')
const path = require('path')
const os = require('os')

const NAME = 'WpsCurveAnim'
const TYPE = 'wpp'
const DEFAULT_URL = 'https://zeron-glitch.github.io/WPS-Curve-Anim/addon/'
const DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'kingsoft', 'wps', 'jsaddons')
const FILE = path.join(DIR, 'publish.xml')

function readCurrent() {
    if (!fs.existsSync(FILE)) return null
    return fs.readFileSync(FILE, 'utf8')
}

function show() {
    console.log('注册文件: ' + FILE)
    const cur = readCurrent()
    if (!cur) {
        console.log('  不存在（等于没装）')
        return
    }
    const m = cur.match(/url="([^"]*)"/)
    console.log('  当前地址: ' + (m ? m[1] : '(没解析出来)'))
    console.log('  修改时间: ' + fs.statSync(FILE).mtime.toLocaleString())
}

function restore() {
    if (!fs.existsSync(DIR)) {
        console.log('目录不存在: ' + DIR)
        process.exit(1)
    }
    const baks = fs.readdirSync(DIR)
        .filter(n => /^publish\.backup-.*\.xml$/.test(n))
        .sort()
    if (!baks.length) {
        console.log('没有找到备份文件')
        process.exit(1)
    }
    const last = baks[baks.length - 1]
    fs.copyFileSync(path.join(DIR, last), FILE)
    console.log('已还原: ' + last)
    show()
}

async function main() {
    const args = process.argv.slice(2)
    if (args.includes('--show')) { show(); return }
    if (args.includes('--restore')) { restore(); return }

    let url = args.find(a => !a.startsWith('--')) || DEFAULT_URL
    if (!url.endsWith('/')) url += '/'

    // 地址必须能真的取到 ribbon.xml，否则装了也是白装
    if (!args.includes('--no-check')) {
        process.stdout.write('检查地址… ')
        try {
            const res = await fetch(url + 'ribbon.xml', { redirect: 'follow' })
            const text = await res.text()
            if (!res.ok) throw new Error('HTTP ' + res.status)
            if (!text.trimStart().startsWith('<customUI')) throw new Error('返回的不是 ribbon.xml')
            console.log('OK（' + text.length + ' 字节）')
        } catch (e) {
            console.log('失败: ' + e.message)
            console.error('地址不可用，已中止。确认地址后再试，或加 --no-check 跳过检查。')
            process.exit(1)
        }
    }

    fs.mkdirSync(DIR, { recursive: true })
    if (fs.existsSync(FILE)) {
        const bak = path.join(DIR, 'publish.backup-' +
            new Date().toISOString().replace(/[-:T]/g, '').slice(4, 12) + '.xml')
        fs.copyFileSync(FILE, bak)
        console.log('已备份到: ' + path.basename(bak))
    }

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<jsplugins>\n' +
        '  <jspluginonline name="' + NAME + '" type="' + TYPE + '" url="' + url + '"' +
        ' debug="" enable="enable_dev" install="null" customDomain=""/>\n' +
        '</jsplugins>\n'
    fs.writeFileSync(FILE, xml, { encoding: 'utf8' })

    console.log('已写入: ' + FILE)
    console.log('加载项地址: ' + url)
    console.log('')
    console.log('下一步：完全退出 WPS 演示（所有 wps/wpp 窗口），再重新打开。')
    console.log('如果打开后还是不显示，用 --show 看地址有没有被 WPS 改回去。')
}

main()
