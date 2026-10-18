// 生成「内网分发」版本：把 docs/ 复制一份，并把安装页里的地址改成内网地址
// 用法: node tools/make_lan_package.js http://10.222.214.186:39124/
// 产物: release/lan/   （用 server.js --docs release/lan 托管）

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DOCS = path.join(ROOT, 'docs')
const OUT = path.join(ROOT, 'release', 'lan')

let base = process.argv[2]
if (!base) {
    console.error('用法: node tools/make_lan_package.js http://<内网IP>:<端口>/')
    process.exit(1)
}
if (!base.endsWith('/')) base += '/'
if (!/^https?:\/\//.test(base)) {
    console.error('地址要以 http:// 或 https:// 开头')
    process.exit(1)
}
const addonUrl = base + 'addon/'

if (!fs.existsSync(path.join(DOCS, 'addon', 'ribbon.xml'))) {
    console.error('docs/addon 还不存在，先跑一次 npm run release')
    process.exit(1)
}

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
fs.cpSync(DOCS, OUT, { recursive: true })

// 重写安装页里写死的加载项地址
const pubPath = path.join(OUT, 'publish.html')
let html = fs.readFileSync(pubPath, 'utf8')
const m = html.match(/var curList = (\[.*?\]);/s)
if (!m) {
    console.error('publish.html 里没找到 curList')
    process.exit(1)
}
const list = JSON.parse(m[1])
list.forEach(item => { item.url = addonUrl })
html = html.replace(m[0], 'var curList = ' + JSON.stringify(list) + ';')
fs.writeFileSync(pubPath, html)

console.log('内网分发包已生成: ' + path.relative(ROOT, OUT))
console.log('  加载项地址: ' + addonUrl)
console.log('  安装页地址: ' + base + 'publish.html')
console.log('')
console.log('下一步：把这个目录托管起来，例如')
console.log('  node server.js --lan --docs ' + path.relative(ROOT, OUT))
console.log('然后把这个链接发给同一局域网的人：')
console.log('  ' + base + 'publish.html')
