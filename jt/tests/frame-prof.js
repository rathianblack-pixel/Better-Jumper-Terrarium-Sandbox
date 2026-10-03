// Where does a real frame go? Wraps sim tick, UI update, audio and render over a few seconds of the live loop.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: require('child_process').execSync('which chromium').toString().trim(), args: ['--no-sandbox'] });
  const vp = (process.env.VP || '1440x900').split('x').map(Number);
  const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: +(process.env.DPR || 1) }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(process.env.URL || 'file:///data/jt/index.html'); await p.waitForTimeout(2000);
  for (const mode of ['iso', 'follow']) {
    const r = await p.evaluate(async (mode) => { const A = JT.app; A.R.setMode(mode); await new Promise(r => setTimeout(r, 1500));
      const T = {}, C = {}; const wrap = (o, n, lab) => { const f = o[n]; o[n] = function () { const t0 = performance.now(); try { return f.apply(this, arguments); } finally { T[lab] = (T[lab] || 0) + performance.now() - t0; C[lab] = (C[lab] || 0) + 1; } }; return () => { o[n] = f; }; };
      const un = [wrap(A.game, 'tick', 'tick'), wrap(JT.UI, 'update', 'ui'), wrap(JT.Audio, 'update', 'audio'), wrap(A.R, 'render', 'render')];
      let frames = 0, run = true; const t0 = performance.now(); const cnt = () => { frames++; if (run) requestAnimationFrame(cnt); }; requestAnimationFrame(cnt);
      await new Promise(r => setTimeout(r, 4000)); run = false; un.forEach(f => f()); const secs = (performance.now() - t0) / 1000;
      const o = { fps: (frames / secs).toFixed(0) }; for (const k in T) o[k] = (T[k] / frames).toFixed(2) + 'ms/f'; o.ticks = C.tick; return o; }, mode);
    console.log(mode, JSON.stringify(r)); }
  await b.close(); })();
