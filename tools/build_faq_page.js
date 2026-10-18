// 把仓库根目录的 FAQ.md 编译成 docs/faq.html，让 GitHub Pages 上也能看到排查指南。
// 只实现 FAQ.md 用到的那部分 Markdown，不引入依赖。
// 用法: node tools/build_faq_page.js

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'FAQ.md')
const OUT = path.join(ROOT, 'docs', 'faq.html')

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function inline(s) {
    let t = esc(s)
    // `code` 先处理，避免里面的星号被当成加粗
    const codes = []
    t = t.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000' })
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    t = t.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[i] + '</code>')
    return t
}

function convert(md) {
    const lines = md.split(/\r?\n/)
    const out = []
    let i = 0
    let listType = null

    const closeList = () => { if (listType) { out.push('</' + listType + '>'); listType = null } }

    while (i < lines.length) {
        const line = lines[i]

        // 代码块
        if (/^```/.test(line)) {
            closeList()
            const buf = []
            i++
            while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++ }
            i++
            out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>')
            continue
        }

        // 表格
        if (/^\|/.test(line) && /^\|[\s:|-]+\|$/.test((lines[i + 1] || '').trim())) {
            closeList()
            const head = line.split('|').slice(1, -1).map(c => c.trim())
            i += 2
            const rows = []
            while (i < lines.length && /^\|/.test(lines[i])) {
                rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()))
                i++
            }
            out.push('<table><thead><tr>' + head.map(h => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>')
            rows.forEach(r => {
                out.push('<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>')
            })
            out.push('</tbody></table>')
            continue
        }

        // 标题
        let m = line.match(/^(#{1,4})\s+(.*)$/)
        if (m) {
            closeList()
            const lv = m[1].length
            out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>')
            i++
            continue
        }

        // 分隔线
        if (/^---+$/.test(line.trim())) { closeList(); out.push('<hr>'); i++; continue }

        // 引用
        if (/^>\s?/.test(line)) {
            closeList()
            const buf = []
            while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++ }
            out.push('<blockquote>' + inline(buf.join(' ')) + '</blockquote>')
            continue
        }

        // 有序 / 无序列表
        m = line.match(/^\s*(\d+)\.\s+(.*)$/)
        if (m) {
            if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol' }
            out.push('<li>' + inline(m[2]) + '</li>')
            i++
            continue
        }
        m = line.match(/^\s*-\s+(.*)$/)
        if (m) {
            if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul' }
            out.push('<li>' + inline(m[1]) + '</li>')
            i++
            continue
        }

        // 空行
        if (line.trim() === '') { closeList(); i++; continue }

        // 列表项的缩进续行：接到上一个 <li> 里，否则列表会被切断、编号重来
        if (listType && out.length && /<\/li>$/.test(out[out.length - 1])) {
            out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ' ' + inline(line.trim()) + '</li>')
            i++
            continue
        }

        // 段落（合并连续行）
        closeList()
        const buf = [line]
        i++
        while (i < lines.length && lines[i].trim() !== '' &&
            !/^(#{1,4}\s|```|>|\||\s*-\s|\s*\d+\.\s|---)/.test(lines[i])) {
            buf.push(lines[i]); i++
        }
        out.push('<p>' + inline(buf.join(' ')) + '</p>')
    }
    closeList()
    return out.join('\n')
}

const md = fs.readFileSync(SRC, 'utf8')
// 去掉一级标题，页面标题单独写
const body = convert(md.replace(/^#\s+.*$/m, ''))
const title = (md.match(/^#\s+(.*)$/m) || [, '常见问题'])[1]

const html = `<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)} · 动画曲线</title>
    <style>
        :root { --blue: #2f7cf6; --ink: #1c2230; --muted: #6b7688; --line: #e6eaf2; }
        * { box-sizing: border-box; }
        body {
            margin: 0; color: var(--ink); background: #fbfcfe;
            font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
            line-height: 1.75; -webkit-font-smoothing: antialiased;
        }
        .wrap { max-width: 760px; margin: 0 auto; padding: 56px 24px 80px; }
        .back { font-size: 13px; color: var(--muted); text-decoration: none; }
        .back:hover { color: var(--blue); }
        h1 { font-size: 30px; margin: 12px 0 8px; letter-spacing: -.02em; }
        h2 { font-size: 21px; margin: 42px 0 10px; padding-top: 18px; border-top: 1px solid var(--line); }
        h3 { font-size: 16px; margin: 26px 0 8px; color: var(--blue); }
        p { margin: 10px 0; }
        a { color: var(--blue); }
        code {
            background: #f1f4f9; padding: 1px 6px; border-radius: 4px;
            font-family: Consolas, ui-monospace, monospace; font-size: .9em;
        }
        pre {
            background: #11161f; color: #d8e2f0; padding: 14px 16px; border-radius: 8px;
            overflow-x: auto; font-size: 13px; line-height: 1.6;
        }
        pre code { background: none; padding: 0; color: inherit; }
        table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 14px; }
        th, td { border: 1px solid var(--line); padding: 7px 10px; text-align: left; vertical-align: top; }
        th { background: #f4f7fc; font-weight: 600; }
        blockquote {
            margin: 14px 0; padding: 10px 14px; background: #eef3fd;
            border-left: 3px solid var(--blue); border-radius: 0 6px 6px 0; color: #2f4a73;
        }
        ul, ol { padding-left: 22px; }
        li { margin: 4px 0; }
        hr { border: 0; border-top: 1px solid var(--line); margin: 34px 0; }
        footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); }
    </style>
</head>

<body>
    <div class="wrap">
        <a class="back" href="./index.html">← 返回介绍页</a>
        <h1>${esc(title)}</h1>
        ${body}
        <footer>
            装不上或行为异常，先跑 <code>npm run doctor</code> 做一次环境体检。
        </footer>
    </div>
</body>

</html>
`

fs.writeFileSync(OUT, html)
console.log('faq 页面 ->', path.relative(ROOT, OUT), '（' + html.length + ' 字符）')
