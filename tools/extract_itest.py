"""把生成的 itest.html 里的内联脚本抠出来，便于 node --check 做语法检查"""
import re, sys

path = sys.argv[1] if len(sys.argv) > 1 else 'out/preview/itest.html'
out = sys.argv[2] if len(sys.argv) > 2 else 'out/itest-inline.js'

html = open(path, encoding='utf-8').read()
blocks = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', html, re.S)
src = '\n;\n'.join(blocks)
open(out, 'w', encoding='utf-8').write(src)
print('内联脚本块:', len(blocks), ' 字符:', len(src), ' ->', out)
