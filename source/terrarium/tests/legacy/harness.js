// Headless simulation harness: loads the DOM-free modules (core..game) from index.html into a VM context.
const fs = require('fs'), vm = require('vm'), path = require('path');
function load(file) {
  const html = fs.readFileSync(file || process.env.GAME || path.join(__dirname, '..', 'index.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const store = {};
  const ctx = { console, Math, Date, JSON, setTimeout, clearTimeout, performance: { now: () => Date.now() },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  let n = 0;
  for (const b of blocks) { if (/Jumper Terrarium — (camera|smart follow)/.test(b)) break; vm.runInContext(b, ctx, { filename: 'block' + n++ }); }
  return ctx.JT;
}
module.exports = { load };
if (require.main === module) { const JT = load(); console.log('loaded', Object.keys(JT).length, 'keys; Solid', !!JT.Solid, 'Game', !!JT.Game); }
