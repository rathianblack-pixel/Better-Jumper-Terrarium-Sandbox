// node tests/gait_probe.js <dist-dir> <out-prefix> : v32 motion layer check — follows a critter, takes a burst of close-ups,
// and reports step counts, planted-foot slip (must be ~0), rig NaNs and page errors.
const { chromium } = require('playwright'); const fs = require('fs'); const [dir, out] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/GPU stall|vibrate|ERR_FILE/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + require('path').resolve(dir) + '/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(3500);
  await page.evaluate(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs); try { JT.UI.closeModal(); } catch (e) {}
    const h = JT.app.game.hab; const sp = h.spiders[0]; JT.UI.toggleObserve(true, sp.id);
    window._g = { steps: 0, slip: 0, slipN: 0, nan: 0, turns: 0, maxA: 0, frames: 0 }; const G = window._g; const prev = {};
    setInterval(() => { const R = sp._rig; if (!R) return; G.frames++; if (R.turning) G.turns++; const a = Math.abs(R._a || 0); G.maxA = Math.max(G.maxA, a);
      for (const k in R.legs) { const g = R.legs[k]; if (!M3(g.out)) G.nan++; const pv = prev[k]; if (pv && pv.k < 0 && g.k < 0 && pv.fid !== g.fid) { const d = Math.hypot(g.p[0] - pv.p[0], g.p[1] - pv.p[1], g.p[2] - pv.p[2]); G.slip = Math.max(G.slip, d); G.slipN++; }
        if (pv && pv.k < 0 && g.k >= 0) G.steps++; prev[k] = { k: g.k, p: g.p.slice(), fid: g.fid }; } }, 16);
    function M3(v) { return v && isFinite(v[0]) && isFinite(v[1]) && isFinite(v[2]); } });
  const clip = async () => page.evaluate(() => { const R = JT.app.R, s = JT.app.game.hab.spiders[0]; const p = R.V.P(s.pos); const cv = R.cv || document.querySelector('canvas'); const r = cv.getBoundingClientRect(); const k = r.width / cv.width;
    const x = r.left + p[0] * k, y = r.top + p[1] * k; return { x: Math.max(0, Math.min(1100 - 360, x - 180)), y: Math.max(0, Math.min(720 - 360, y - 180)), width: 360, height: 360, st: s.state }; });
  await page.waitForTimeout(4000); const states = [];
  for (let i = 0; i < 6; i++) { const c = await clip(); states.push(c.st); await page.screenshot({ path: out + '_' + i + '.png', clip: { x: c.x, y: c.y, width: c.width, height: c.height } }); await page.waitForTimeout(1500); }
  const g = await page.evaluate(() => window._g); console.log(JSON.stringify({ states, gait: g, errors: errors.slice(0, 6) })); await browser.close();
})();
