// 本地开发用静态服务器：托管加载项 + 收日志
//   node server.js            只监听本机 127.0.0.1
//   node server.js --lan      同时监听内网地址，方便同一局域网的人安装（会打印地址）
const express = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')

const PORT = Number(process.env.PORT || 39123)
const LAN = process.argv.includes('--lan')
// --docs <目录>：改成托管某个静态目录（例如 release/lan），默认托管 addin/
const docsIdx = process.argv.indexOf('--docs')
const DOCS_DIR = docsIdx > 0 ? process.argv[docsIdx + 1] : null
const ROOT = __dirname
const ADDIN = DOCS_DIR ? path.resolve(ROOT, DOCS_DIR) : path.join(ROOT, 'addin')
const OUT = path.join(ROOT, 'out')
fs.mkdirSync(OUT, { recursive: true })

const LOGFILE = path.join(OUT, 'addin.log')
const REPORTFILE = path.join(OUT, 'report.json')
fs.writeFileSync(LOGFILE, '')

const app = express()
app.use(express.text({ type: '*/*', limit: '5mb' }))

app.get('/config', (req, res) => {
    res.json({ outPptx: path.join(OUT, 'diag.pptx'), outDir: OUT, port: PORT })
})

app.post('/log', (req, res) => {
    const line = String(req.body || '')
    fs.appendFileSync(LOGFILE, line + '\n')
    console.log('[addin] ' + line)
    res.send('ok')
})

app.post('/report', (req, res) => {
    fs.writeFileSync(REPORTFILE, String(req.body || '{}'))
    console.log('[addin] === report written ===')
    res.send('ok')
})

// 调试模式下 publish.xml 返回空内容，与官方 wpsjs debug 行为一致
app.get('/publish.xml', (req, res) => {
    res.type('text/xml').send('')
})

app.use(express.static(ADDIN))

function lanAddresses() {
    const out = []
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets)) {
        for (const ni of nets[name] || []) {
            if (ni.family === 'IPv4' && !ni.internal) out.push({ name, address: ni.address })
        }
    }
    return out
}

const host = LAN ? '0.0.0.0' : '127.0.0.1'
app.listen(PORT, host, () => {
    console.log('服务已启动，监听 ' + host + ':' + PORT)
    console.log('本机访问: http://127.0.0.1:' + PORT + '/')
    if (LAN) {
        const addrs = lanAddresses()
        if (addrs.length) {
            console.log('同一局域网的人可以用这些地址:')
            addrs.forEach(a => console.log('  http://' + a.address + ':' + PORT + '/publish.html    (' + a.name + ')'))
            console.log('注意：安装页里写死的地址必须与上面某个一致，否则对方装了也拉不到文件。')
        } else {
            console.log('没找到内网地址')
        }
    }
    console.log('托管目录: ' + ADDIN)
})
