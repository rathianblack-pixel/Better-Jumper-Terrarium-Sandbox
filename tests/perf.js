const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: require('child_process').execSync('which chromium').toString().trim(), args: ['--no-sandbox'] });
  for (const url of process.argv.slice(2)) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(url); await p.waitForTimeout(2500);
    const r = await p.evaluate(async () => { const R = JT.app.R; const out = {}; for (const cam of ['iso', 'follow']) { R.setMode(cam); for (let i = 0; i < 40; i++) R.render(0.016); const t0 = performance.now(); for (let i = 0; i < 60; i++) R.render(0.016); out[cam] = ((performance.now() - t0) / 60).toFixed(1) + 'ms'; } R.setMode('iso'); return out; });
    console.log(url.split('/').slice(-2).join('/'), JSON.stringify(r), errs.slice(0, 5));
    await p.close(); }
  await b.close(); })();
