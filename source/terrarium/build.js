// Mantis/Jumper Terrarium build: one shared engine (engine/*.js, order in engine/order.json) + a pack per game.
// A pack (packs/<id>/pack.json) supplies its page shell (head/tail HTML), static files, and extra scripts injected
// before named engine files. node build.js [pack...]  ->  dist/<pack.out>/
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const order = JSON.parse(R('engine/order.json')).scripts;
const copyDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d); } };
function page(id, extra) {
  extra = extra || {}; const dir = 'packs/' + id, P = JSON.parse(R(dir + '/pack.json'));
  const shellOf = (k) => P.shell && P.shell[k] ? P.shell[k] : 'packs/jumper/shell/' + k + '.html';
  let headTxt = R(shellOf('head')); for (const [a, b] of P.headReplace || []) { if (!headTxt.includes(a)) throw new Error(id + ': head text not found: ' + a.slice(0, 60)); headTxt = headTxt.split(a).join(b); }
  if (P.headAppend) headTxt = headTxt.replace('</style>', R(dir + '/' + P.headAppend) + '\n</style>');
  const out = [headTxt]; const inj = P.inject || {}; if (extra.combined) out.push('<script>window.JT_COMBINED = true;</script>');
  const script = (body) => { out.push('<script>'); out.push(body); out.push('</script>'); };
  for (const s of order) {
    if (s.gap) { out.push(...s.gap); continue; }
    for (const f of inj[s] || []) script(R(dir + '/' + f));
    script(R('engine/' + s));
  }
  for (const f of inj['@end'] || []) script(R(dir + '/' + f));
  for (const f of extra.end || []) script(R(f));
  out.push(R(shellOf('tail')));
  let html = out.join('\n');
  if (extra.title) html = html.replace(/<title>[^<]*<\/title>/, '<title>' + extra.title + '</title>').replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*"/, '$1' + extra.title + '"');
  return { P, html };
}
function build(id) {
  const P0 = JSON.parse(R('packs/' + id + '/pack.json'));
  if (P0.combine) return combine(id, P0);
  const { P, html } = page(id); const out = [html];
  const dist = path.join(__dirname, 'dist', P.out); fs.rmSync(dist, { recursive: true, force: true });
  for (const st of P.static || []) copyDir(path.join(__dirname, st), dist);
  fs.mkdirSync(dist, { recursive: true }); fs.writeFileSync(path.join(dist, 'index.html'), out.join('\n'));
  console.log('built', id, '->', 'dist/' + P.out, (out.join('\n').length / 1e6).toFixed(2) + ' MB');
}
// combined app: a title screen (index.html) + one page per game, sharing icons, manifest and service worker
function combine(id, P) {
  const C = P.combine, dist = path.join(__dirname, 'dist', P.out); fs.rmSync(dist, { recursive: true, force: true });
  for (const st of P.static || []) copyDir(path.join(__dirname, st), dist);
  fs.copyFileSync(path.join(__dirname, 'packs', id, C.index), path.join(dist, 'index.html'));
  let total = 0; for (const [file, game] of Object.entries(C.pages)) { const { html } = page(game, { end: (C.end || []).map(f => 'packs/' + id + '/' + f), title: C.title, combined: true }); fs.writeFileSync(path.join(dist, file), html); total += html.length; }
  const sw = path.join(dist, 'sw.js'); if (fs.existsSync(sw)) fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/const CACHE = 'tr-[^']*'/, "const CACHE = 'tr-" + Date.now().toString(36) + "'"));
  console.log('built', id, '->', 'dist/' + P.out, '(title screen + ' + Object.keys(C.pages).join(', ') + ')', (total / 1e6).toFixed(2) + ' MB');
}
const ids = process.argv.slice(2); (ids.length ? ids : fs.readdirSync(path.join(__dirname, 'packs'))).forEach(build);
