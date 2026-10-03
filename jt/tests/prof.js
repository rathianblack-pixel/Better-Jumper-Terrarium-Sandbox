// Per-section render profile in follow mode: still camera vs moving camera.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: require('child_process').execSync('which chromium').toString().trim(), args: ['--no-sandbox'] });
  const vp = (process.env.VP || '1440x900').split('x').map(Number);
  const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: +(process.env.DPR || 1) }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.env.URL || 'file:///data/jt/index.html'); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const R = JT.app.R, D = JT.Draw; const T = {}; const C = {}; const FL = true;
    const wrap = (o, n, lab) => { const f = o[n]; o[n] = function () { const t0 = performance.now(); try { return f.apply(this, arguments); } finally { if (FL) { (R.scene || R.cv).getContext('2d').getImageData(0, 0, 1, 1); R.ctx.getImageData(0, 0, 1, 1); } T[lab] = (T[lab] || 0) + performance.now() - t0; C[lab] = (C[lab] || 0) + 1; } }; return () => o[n] = f; };
    const un = [wrap(R, 'drawBase', 'base'), wrap(R, 'drawScene', 'scene'), wrap(R, 'postProcess', 'post'), wrap(R, 'drawEffects', 'fx'), wrap(R, 'background', 'bg'), wrap(R, 'drawLampPools', 'lamp')];
    const out = {};
    for (const [lab, mode, move] of [['iso', 'iso', 0], ['followStill', 'follow', 0], ['followMove', 'follow', 1]]) {
      R.setMode(mode); for (let i = 0; i < 300; i++) R.render(0.033); let mv = 0;
      for (const k in T) delete T[k]; for (const k in C) delete C[k];
      const N = 40; const t0 = performance.now();
      for (let i = 0; i < N; i++) { if (move && R.fcam) { R.fcam.orbit(0.012, 0.004 * Math.sin(i / 5)); } R.render(0.033); mv += R._moving ? 1 : 0; }
      const o = { total: ((performance.now() - t0) / N).toFixed(1), moving: mv + '/' + N }; for (const k in T) o[k] = (T[k] / N).toFixed(1) + (k === 'decorDirect' || k === 'spider' ? ' x' + (C[k] / N).toFixed(0) : ''); out[lab] = o;
    }
    un.forEach(f => f()); R.setMode('iso'); return out;
  });
  for (const k in r) console.log(k.padEnd(12), JSON.stringify(r[k])); if (errs.length) console.log(errs);
  await b.close(); })();
