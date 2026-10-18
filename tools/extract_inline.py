import re, sys
html = open('addin/ui/editor.html', encoding='utf-8').read()
blocks = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', html, re.S)
src = '\n;\n'.join(blocks)
open('out/editor-inline.js','w',encoding='utf-8').write(src)
print('extracted', len(blocks), 'inline block(s),', len(src), 'chars')
