from PIL import Image
src = Image.open('out/wps-pane3.png')
src.crop((1596, 158, 1866, 880)).save('docs/pane-only.png')
print('pane', Image.open('docs/pane-only.png').size)
