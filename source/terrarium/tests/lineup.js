// node tests/lineup.js <dist-dir> <out.png> [view yaw] [pitch]: draws every species x stage x pose on one sheet (visual check of the critter drawer)
const { chromium } = require('playwright'); const fs = require('fs');
const [dir, out, yaw, pitch] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + require('path').resolve(dir) + '/index.html'); await page.waitForTimeout(2500); if (process.env.S3) await page.evaluate(() => { window._s3 = true; }); if (process.env.ONLY) await page.evaluate(([o, c]) => { window._only = o.split(','); window._cell = +c; }, [process.env.ONLY, process.env.CELL || '150']);
  const url = await page.evaluate(([yaw, pitch]) => {
    const M = JT.M, D = JT.Draw; const poses = [['idle', {}], ['walk', { _moving: true, _walk: 0.5 }], ['stalk', { state: 'stalk' }], ['strike', { state: 'pounce' }, { airborne: true }], ['threat', { state: 'display' }], ['groom', { state: 'groom' }], ['sleep', { state: 'sleep' }], ['hold', {}, { meal: true }]];
    if (window._s3) poses.splice(0, poses.length, ['crouch', { state: 'crouch', _crouch: 1 }], ['strike t.15', { state: 'pounce', _air: { t: 0.15 } }, { airborne: true }], ['strike t.6', { state: 'pounce', _air: { t: 0.6 }, _sweep: 0.2 }, { airborne: true }], ['sweep', { state: 'pounce', _air: { t: 0.95 }, _sweep: 0.9 }, { airborne: true }],
      ['threat', { state: 'display' }], ['fly', { _mFly: true, _air: { t: 0.5, fly: true } }, { airborne: true, time: 1.31 }], ['hang premolt', { state: 'premolt', _mHangK: 1 }], ['molting', { state: 'molting', _mHangK: 1, _mSlide: 0.55 }], ['postMolt', { state: 'postMolt', _mHangK: 1, _mSlide: 1 }]);
    const sps = (window._only ? JT.SPECIES.filter(s => window._only.includes(s.id)) : JT.SPECIES); const cell = window._cell || 150, cols = poses.length + 2, rows = sps.length;
    const c = document.createElement('canvas'); c.width = cell * cols; c.height = cell * rows; const ctx = c.getContext('2d'); ctx.fillStyle = '#e9e0cc'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = '11px serif'; ctx.fillStyle = '#333';
    sps.forEach((S, r) => {
      const cellsDef = [[1, 'idle', {}, {}], [3, 'idle', {}, {}]].concat(poses.map(p => [5, p[0], p[1], p[2] || {}]));
      cellsDef.forEach(([stage, label, spx, ox], k) => {
        const V = new JT.View(+yaw || 0.9, +pitch || 0.55, cell / (S.len * 1.25), k * cell + cell / 2, r * cell + cell * (spx._mHangK ? 0.18 : 0.62), [0, 0, 0]);
        const sp = Object.assign({ species: S.id, state: 'idle', _walk: 0, _moving: false, _crouch: 0, seed: 3, sat: 0.6, stage }, spx);
        const L = S.len * JT.STAGE_SCALE[stage];
        const o = Object.assign({ len: L, time: 1.3, alpha: 1 }, ox);
        if (ox.meal) { o.hug = { k: 1, pl: L * 0.35, big: 0 }; o.meal = (mp, fg, sg, n) => { const P = V.P(mp); ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc(P[0], P[1], L * 0.06 * V.s, 0, 6.3); ctx.fill(); }; }
        try { JT.withBaseLight(() => D.spider(ctx, V, sp, { p: [0, 0, 0], f: [1, 0, 0], s: [0, 0, 1], n: [0, 1, 0] }, o)); } catch (e) { ctx.fillStyle = 'red'; ctx.fillText(e.message.slice(0, 30), k * cell + 4, r * cell + 30); }
        ctx.fillStyle = '#333'; ctx.fillText(S.id + ' s' + stage + ' ' + label, k * cell + 4, r * cell + 12);
      });
    });
    return c.toDataURL('image/png');
  }, [yaw, pitch]);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(JSON.stringify({ errors })); await browser.close();
})();
