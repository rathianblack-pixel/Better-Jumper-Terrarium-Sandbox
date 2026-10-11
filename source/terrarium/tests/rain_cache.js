// node tests/rain_cache.js <index.html> : how often the static ground layer is rebuilt + sprites repainted, dry vs rain (still camera)
const { chromium } = require('playwright'); const path = require('path'); const [file] = process.argv.slice(2);
(async () => { const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 700, height: 450 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(file)); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(3500);
  await p.evaluate(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs); try { JT.UI.closeModal(); } catch (e) {}
    const R = JT.app.R; const G = R.gl2r || R.glr || R.G || null; window._cm = {}; window._paint = 0;
    const hook = (o) => { if (!o || o._hk) return; const P = Object.getPrototypeOf(o); if (!P.cacheMode || P._hk) return; P._hk = 1; const c0 = P.cacheMode; P.cacheMode = function () { const m = c0.apply(this, arguments); window._cm[m] = (window._cm[m] || 0) + 1; return m; }; };
    for (const k in R) { try { hook(R[k]); } catch (e) {} }
    const D = JT.Draw; const d0 = D.drop; D.drop = function () { window._paint++; return d0.apply(this, arguments); };
    try { JT.app.game.cam && (JT.app.game.cam.follow = null); } catch (e) {} });
  const meas = async (label) => { await p.evaluate(() => { window._cm = {}; window._paint = 0; }); await p.waitForTimeout(8000); return p.evaluate((label) => label + ' ' + JSON.stringify(window._cm) + ' dropPaints ' + window._paint + ' drops ' + JT.app.game.hab.data.drops.length, label); };
  const out = []; out.push(await meas('dry '));
  await p.evaluate(() => { JT.Biome.start(JT.app.game.hab, 'rain'); JT.app.game.hab.mist && JT.app.game.hab.mist(); });
  out.push(await meas('rain')); out.push(await meas('rain2'));
  console.log(out.join('\n'), errs.slice(0, 3)); await b.close(); })();
