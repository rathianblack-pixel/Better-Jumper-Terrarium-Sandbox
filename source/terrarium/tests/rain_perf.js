// node tests/rain_perf.js <dist-dir> : CPU time per rendered frame (Renderer.render + sprite paint) with and without a rain shower
const { chromium } = require('playwright'); const path = require('path'); const [dir] = process.argv.slice(2);
(async () => { const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(dir) + '/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(3500);
  await p.evaluate(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs); try { JT.UI.closeModal(); } catch (e) {}
    const R = JT.app.R; const P = Object.getPrototypeOf(R); const r0 = P.render; window._pt = []; P.render = function (dt) { const t0 = performance.now(); const x = r0.call(this, dt); window._pt.push(performance.now() - t0); return x; };
    const h = JT.app.game.hab; h.data.biome = 'rainforest'; });
  const meas = async (label) => { await p.evaluate(() => { window._pt = []; }); await p.waitForTimeout(8000); return p.evaluate((label) => { const a = window._pt.slice().sort((x, y) => x - y); const avg = a.reduce((s, x) => s + x, 0) / a.length; return label + ': frames ' + a.length + ' avg ' + avg.toFixed(1) + 'ms p90 ' + a[Math.floor(a.length * 0.9)].toFixed(1) + 'ms'; }, label); };
  const out = []; out.push(await meas('dry'));
  out.push(await p.evaluate(() => { const h = JT.app.game.hab; const ok = JT.Biome.start(h, 'rain'); return 'rain started: ' + ok + ' drops ' + h.data.drops.length; }));
  out.push(await meas('rain'));
  out.push(await p.evaluate(() => { const h = JT.app.game.hab; return 'drops ' + h.data.drops.length + ' prey ' + h.data.prey.length + ' wx ' + JSON.stringify(h.data.wx && h.data.wx.id); }));
  console.log(out.join('\n'), errs.slice(0, 3)); await b.close(); })();
