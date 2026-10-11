// node tests/rain_fps.js <dist-dir> : frames rendered in fixed windows: dry, rain, rain without overlay effects, rain without wet ground
const { chromium } = require('playwright'); const path = require('path'); const [dir] = process.argv.slice(2);
(async () => { const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(dir) + '/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(3500);
  await p.evaluate(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs); try { JT.UI.closeModal(); } catch (e) {}
    const R = JT.app.R; const P = Object.getPrototypeOf(R); const r0 = P.render; window._n = 0; window._ov = 0; P.render = function (dt) { window._n++; const x = r0.call(this, dt); if (this._ovInk) window._ov++; return x; };
    JT.app.game.hab.data.biome = 'prairie'; });
  const win = async (label, setup) => { await p.evaluate(setup); await p.waitForTimeout(2500); await p.evaluate(() => { window._n = 0; window._ov = 0; }); await p.waitForTimeout(10000); return label + ': ' + await p.evaluate(() => (window._n / 10).toFixed(1) + ' fps, overlay inked ' + window._ov + ' frames'); };
  const out = [];
  out.push(await win('dry', () => {}));
  out.push(await win('rain', () => { const h = JT.app.game.hab; JT.Biome.start(h, 'rain'); const W = JT.app.R._wxF; if (W) { W.f.rain = 1; W.wet = 0.8; } }));
  out.push(await win('rain, no overlay fx', () => { const s = JT.app.R.set; s.perf = true; s.ptNoFx = true; }));
  console.log(out.join('\n'), JSON.stringify(errs.slice(0, 3))); await b.close(); })();
