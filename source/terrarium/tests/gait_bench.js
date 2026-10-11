// node tests/gait_bench.js <dist-dir> : cost of drawing one critter (CPU sprite canvas, like the real sprite sheet) + spring stability at slow frame rates
const { chromium } = require('playwright'); const path = require('path'); const [dir] = process.argv.slice(2);
(async () => { const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(dir) + '/index.html'); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const M = JT.M; const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d', { willReadFrequently: true });
    const S = JT.SPECIES[0]; const L = S.len; const V = new JT.View(0.9, 0.62, 256 / (L * 3), 128, 150, [0, 0, 0]); const out = {};
    for (const [label, step] of [['60fps', 1 / 60], ['15fps', 1 / 15], ['8fps', 1 / 8]]) {
      const sp = { id: 'b' + label, species: S.id, state: 'idle', seed: 3, sat: 0.6, stage: 5, _walk: 0, _moving: false }; let t = 0, x = 0, bobMax = 0, bobMove = 0, last = 0; const N = 240; const t0 = performance.now();
      for (let i = 0; i < N; i++) { t += step; const walk = i > 60 && i < 150; if (walk) { x += 6 * step; sp._moving = true; sp._walk += 6 * step / (L * 0.32); } else sp._moving = false;
        g.clearRect(0, 0, 256, 256); JT.withBaseLight(() => JT.Draw.spider(g, V, sp, { p: [x, 0, 0], f: [1, 0, 0], s: [0, 0, 1], n: [0, 1, 0] }, { len: L, time: t, alpha: 1 }));
        g.getImageData(0, 0, 1, 1); const R = sp._rig; if (R && i > 170) { bobMax = Math.max(bobMax, Math.abs(R.bob) / L); bobMove += Math.abs(R.bob - last) / L; last = R.bob; } }
      out[label] = { msPerDraw: +((performance.now() - t0) / N).toFixed(3), idleBobMax: +bobMax.toFixed(5), idleBobTravel: +bobMove.toFixed(5) }; }
    return out; });
  console.log(JSON.stringify({ r, errs })); await b.close(); })();
