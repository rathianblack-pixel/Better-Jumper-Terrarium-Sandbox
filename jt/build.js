// Produces dist/jumper-terrarium.html — a single self-contained file (inline CSS + JS).
const fs = require('fs'), path = require('path');
const root = __dirname; let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="style.css">/, () => '<style>\n' + fs.readFileSync(path.join(root, 'style.css'), 'utf8') + '\n</style>');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>\n?/g, (m, src) => '<script>\n' + fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>\n');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'jumper-terrarium.html'), html);
console.log('dist/jumper-terrarium.html', (html.length / 1024).toFixed(0) + ' KB');
