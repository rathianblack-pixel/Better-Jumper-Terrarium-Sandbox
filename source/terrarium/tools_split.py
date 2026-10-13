import re, os, json
src = open('/data/game/index.html').read()
lines = src.split('\n')
os.makedirs('engine', exist_ok=True); os.makedirs('packs/jumper/shell', exist_ok=True)
order = []; buf = []; i = 0; n = 0; shell_n = 0
def slug(s):
    s = re.sub(r'^/\*\s*', '', s); s = re.sub(r'Jumper Terrarium( v14)?\s*[—-]\s*', '', s)
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s.lower()).strip('-')
    return '-'.join(s.split('-')[:4]) or 'block'
while i < len(lines):
    if lines[i] == '<script>':
        # flush shell
        name = 'packs/jumper/shell/%02d.html' % shell_n; shell_n += 1
        open(name, 'w').write('\n'.join(buf)); order.append({'shell': '%02d.html' % shell_n if False else os.path.basename(name)}); buf = []
        j = i + 1; body = []
        while lines[j] != '</script>': body.append(lines[j]); j += 1
        n += 1; fn = 'engine/%02d-%s.js' % (n, slug(body[0] if body else 'x'))
        open(fn, 'w').write('\n'.join(body)); order.append({'engine': os.path.basename(fn)})
        i = j + 1
    else:
        buf.append(lines[i]); i += 1
name = 'packs/jumper/shell/%02d.html' % shell_n; open(name, 'w').write('\n'.join(buf)); order.append({'shell': os.path.basename(name)})
json.dump(order, open('engine/order.json', 'w'), indent=1)
print(n, 'engine files,', shell_n + 1, 'shell parts')
