// 通过 GitHub API 把整个项目发布到仓库，并开启 GitHub Pages
// 用法:
//   node tools/gh_publish.js --repo WPS-Curve-Anim --token-file C:\Users\你\.gh_token
//   可选: --private（默认公开，Pages 免费只对公开仓库开放）
//         --skip-release（不重新生成安装页）
//
// 令牌不会打印、不会写进任何文件。建议用完后到 GitHub 里吊销。

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const API = 'https://api.github.com'

function arg(name, def) {
    const i = process.argv.indexOf('--' + name)
    if (i < 0) return def
    const v = process.argv[i + 1]
    return v && !v.startsWith('--') ? v : true
}

const repo = arg('repo', 'WPS-Curve-Anim')
const privateRepo = process.argv.includes('--private')
const skipRelease = process.argv.includes('--skip-release')
const dryRun = process.argv.includes('--dry-run')
const tokenFile = arg('token-file', path.join(require('os').homedir(), '.gh_token'))

function requireToken() {
    let t = process.env.GH_TOKEN || ''
    if (!t && fs.existsSync(tokenFile)) t = fs.readFileSync(tokenFile, 'utf8').trim()
    if (!t) {
        console.error('没找到令牌。把 GitHub 令牌存到这个文件里（只写一行）：')
        console.error('  ' + tokenFile)
        console.error('或者设置环境变量 GH_TOKEN。')
        process.exit(1)
    }
    return t
}
let token = ''

async function api(method, url, body) {
    const headers = {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'wps-curve-addin-publisher',
        'X-GitHub-Api-Version': '2022-11-28'
    }
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch (e) { data = text }
    if (!res.ok) {
        const msg = (data && data.message) || text.slice(0, 200)
        const err = new Error(method + ' ' + url + ' -> ' + res.status + ' ' + msg)
        err.status = res.status
        err.data = data
        throw err
    }
    return data
}

// ---------- 收集要上传的文件（与 .gitignore 一致） ----------
// release/ 整个不传：7z 走 GitHub Releases，lan 是带本机 IP 的临时分发包
const IGNORE_DIRS = ['node_modules', '.npm-cache', 'out', 'wps-addon-build', 'wps-addon-publish', 'release', 'spike', '.git']
const IGNORE_FILES = ['package-lock.json', '.DS_Store', 'Thumbs.db']

function collect(dir, base) {
    const out = []
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name)
        const rel = base ? base + '/' + name : name
        const st = fs.statSync(full)
        if (st.isDirectory()) {
            if (IGNORE_DIRS.includes(name)) continue
            if (rel === 'test/preview') continue
            out.push(...collect(full, rel))
        } else {
            if (IGNORE_FILES.includes(name)) continue
            if (rel.startsWith('release/')) continue
            if (/\.log$/i.test(name)) continue
            out.push({ rel, full, size: st.size })
        }
    }
    return out
}

function run(cmd, args, opts) {
    console.log('  $ ' + [cmd].concat(args).join(' '))
    execFileSync(cmd, args, Object.assign({ cwd: ROOT, stdio: 'inherit' }, opts || {}))
}

// 只检查要传哪些文件，不碰网络
if (dryRun) {
    const list = collect(ROOT, '')
    const total = list.reduce((a, f) => a + f.size, 0)
    console.log('将要上传 ' + list.length + ' 个文件，共 ' + Math.round(total / 1024) + ' KB：')
    list.forEach(f => console.log('  ' + f.rel + '  (' + f.size + ')'))
    process.exit(0)
}

;(async () => {
    // 0. 令牌是谁的
    token = requireToken()
    const me = await api('GET', '/user')
    const owner = me.login
    const repoUrl = 'https://github.com/' + owner + '/' + repo
    const pagesUrl = 'https://' + owner.toLowerCase() + '.github.io/' + repo + '/'
    console.log('账号: ' + owner)
    console.log('仓库: ' + repoUrl)
    console.log('安装页将位于: ' + pagesUrl + 'publish.html')
    console.log('')

    // 1. 按真实地址重新生成安装页（地址是写死在 publish.html 里的）
    if (!skipRelease) {
        console.log('[1/6] 用真实地址重新生成安装页…')
        run(process.execPath, [path.join(__dirname, 'release.js'), pagesUrl + 'addon/'], { stdio: 'pipe' })
        console.log('     完成')
    } else {
        console.log('[1/6] 跳过重新生成')
    }

    // 2. 仓库
    console.log('[2/6] 检查仓库…')
    let repoInfo = null
    try {
        repoInfo = await api('GET', '/repos/' + owner + '/' + repo)
        console.log('     仓库已存在，将增量更新')
    } catch (e) {
        if (e.status !== 404) throw e
        repoInfo = await api('POST', '/user/repos', {
            name: repo,
            private: privateRepo,
            description: 'WPS 演示（PPT）动画速率曲线编辑加载项：拖贝塞尔曲线改缓动，烘焙成 p:tavLst 关键帧写入动画对象模型',
            homepage: pagesUrl,
            has_issues: true,
            has_wiki: false,
            auto_init: false
        })
        console.log('     已创建')
    }

    // 3. 取基础提交（已有仓库才有）
    // 注意：空仓库上调 Git Data API 会 409，所以先确保仓库里至少有一个提交
    const branch = repoInfo.default_branch || 'main'
    let baseSha = null
    let baseTree = null
    async function readRef() {
        const ref = await api('GET', '/repos/' + owner + '/' + repo + '/git/ref/heads/' + branch)
        baseSha = ref.object.sha
        const commit = await api('GET', '/repos/' + owner + '/' + repo + '/git/commits/' + baseSha)
        baseTree = commit.tree.sha
    }
    try {
        await readRef()
    } catch (e) {
        if (e.status !== 404 && e.status !== 409) throw e
        // 空仓库：先用 Contents API 落一个初始提交
        console.log('     空仓库，先建初始提交…')
        const readme = fs.readFileSync(path.join(ROOT, 'README.md'))
        await api('PUT', '/repos/' + owner + '/' + repo + '/contents/README.md', {
            message: '初始化仓库',
            content: readme.toString('base64'),
            branch: branch
        })
        await readRef()
    }

    // 4. 上传文件
    const files = collect(ROOT, '')
    console.log('[3/6] 上传 ' + files.length + ' 个文件…')
    const tree = []
    let done = 0
    for (const f of files) {
        const content = fs.readFileSync(f.full)
        const blob = await api('POST', '/repos/' + owner + '/' + repo + '/git/blobs', {
            content: content.toString('base64'),
            encoding: 'base64'
        })
        tree.push({ path: f.rel, mode: '100644', type: 'blob', sha: blob.sha })
        done++
        if (done % 10 === 0 || done === files.length) process.stdout.write('     ' + done + '/' + files.length + '\r')
    }
    console.log('     上传完成')

    // 5. 建树 + 提交 + 更新分支
    console.log('[4/6] 创建提交…')
    const treeBody = { tree }
    if (baseTree) treeBody.base_tree = baseTree
    const newTree = await api('POST', '/repos/' + owner + '/' + repo + '/git/trees', treeBody)

    const commitBody = {
        message: baseSha ? '更新：起止点编辑界面与内网/公网分发脚本' : '初始提交：WPS 演示动画曲线编辑加载项',
        tree: newTree.sha
    }
    if (baseSha) commitBody.parents = [baseSha]
    const newCommit = await api('POST', '/repos/' + owner + '/' + repo + '/git/commits', commitBody)

    if (baseSha) {
        await api('PATCH', '/repos/' + owner + '/' + repo + '/git/refs/heads/' + branch, { sha: newCommit.sha, force: false })
    } else {
        await api('POST', '/repos/' + owner + '/' + repo + '/git/refs', { ref: 'refs/heads/' + branch, sha: newCommit.sha })
    }
    console.log('     提交 ' + newCommit.sha.slice(0, 7))

    // 6. 开 Pages（指向 docs/）
    console.log('[5/6] 开启 GitHub Pages…')
    const pagesBody = { source: { branch: branch, path: '/docs' } }
    try {
        await api('POST', '/repos/' + owner + '/' + repo + '/pages', pagesBody)
        console.log('     已开启')
    } catch (e) {
        if (e.status === 409 || e.status === 422) {
            await api('PUT', '/repos/' + owner + '/' + repo + '/pages', pagesBody)
            console.log('     已更新配置')
        } else {
            console.log('     Pages 配置失败（可以去网页手动开启）：' + e.message)
        }
    }

    console.log('[6/6] 完成')
    console.log('')
    console.log('仓库:   ' + repoUrl)
    console.log('安装页: ' + pagesUrl + 'publish.html   （首次部署要等 1~2 分钟）')
    console.log('插件源: ' + pagesUrl + 'addon/')
})().catch(e => {
    console.error('')
    console.error('失败: ' + e.message)
    if (e.status === 401) console.error('令牌无效或已过期。')
    if (e.status === 403) console.error('令牌权限不够：需要 Contents + Workflows(PAT 的 workflow scope)，开 Pages 还需要 Pages 权限。')
    process.exit(1)
})


