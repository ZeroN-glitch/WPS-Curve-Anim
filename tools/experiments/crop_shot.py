from PIL import Image
src = Image.open('out/wps-pane3.png')
src.crop((1230, 95, 1920, 890)).save('docs/wps-in-app.png')
src.crop((1406, 150, 1920, 870)).save('docs/pane-only.png')
print('in-app', Image.open('docs/wps-in-app.png').size)
print('pane  ', Image.open('docs/pane-only.png').size)
