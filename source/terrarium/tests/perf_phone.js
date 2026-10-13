// node tests/perf_phone.js [dist-dir] -> phone viewport (390x844): sim cost per tick + renderer per-frame cost with
// leaf drift, wind, a hatching egg case and pollinators running (v1.2 extras present only when the build has them)
const { chromium } = require('playwright');
const dir = process.argv[2] || 'dist/mantis-terrarium';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto('file://' + require('path').resolve(dir) + '/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(3000);
  const res = await p.evaluate(async () => {
    try { JT.UI.closeModal(); } catch (e) {}
    const g = JT.app.game, AI = JT.SpiderAI; JT.Biome.layout(g.hab, 'dryleaf', 3); const h = g.hab; h.data.spiders.length = 0;
    const a = h.addSpider('chinese', { stage: 5, sex: 'f' }); const c = h.addSpider('chinese', { stage: 3 }); h.addPrey('housefly', 4); h.addPrey('cricket', 2);
    const v12 = !!AI.mantisLayOoth; h.data.wx = { id: 'wind' };
    if (v12) { for (let i = 0; i < 6; i++) JT.MAtmos.spawnLeaf(h); const o = AI.mantisLayOoth(h, a); o.age = AI.LIFE.HATCH_DAYS + 0.01; }
    const t0 = performance.now(); for (let i = 0; i < 600; i++) g.tick(1 / 60); const simMs = (performance.now() - t0) / 600;
    if (v12) { const o = h.data.ooth[0]; if (o) { o.state = 'hard'; o.age = AI.LIFE.HATCH_DAYS + 0.01; } }
    const R = JT.app.R; await new Promise(r => setTimeout(r, 300)); const fr0 = R.frames || 0; const pt0 = Object.assign({}, R.pt || {});
    const T = []; let last = performance.now(); await new Promise(res => { let n = 0; const f = () => { const t = performance.now(); T.push(t - last); last = t; if (++n < 120) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    T.sort((x, y) => x - y);
    return { v12, simMsPerTick: +simMs.toFixed(3), frameMedianMs: +T[60].toFixed(1), frameP90Ms: +T[108].toFixed(1), rendererBreakdown: R.pt ? Object.fromEntries(Object.entries(R.pt).map(([k, v]) => [k, +v.toFixed(2)])) : null, leaves: (h._mLeaves || []).length, hatch: (h._mHatch || []).length, sprites: null };
  });
  console.log(JSON.stringify({ res, errors })); await b.close();
})();
