const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file:///data/jt/index.html'); await p.waitForTimeout(1500);
  // put the jumper behind the stump-like decor: find the tallest decor, place spider directly behind it relative to camera
  await p.evaluate(async () => { const A = JT.app, hab = A.game.hab, R = A.R; R.setMode('follow'); A.game.tick = () => {};
    const sp = hab.spiders[0]; let best = null; for (const id in hab.geoms) { const g = hab.geoms[id]; if (!best || g.height > best.height) best = g; }
    for (let i = 0; i < 120; i++) R.render(0.033);
    const V = R.V; const back = [-V.toCam[0], 0, -V.toCam[2]]; const n = Math.hypot(back[0], back[2]);
    sp.pos = [best.center[0] + back[0] / n * (best.coverR + 3), 0, best.center[2] + back[2] / n * (best.coverR + 3)]; sp.sup = { k: 'floor' };
    for (let i = 0; i < 90; i++) R.render(0.033); window.__best = best.def.id; });
  await p.screenshot({ path: process.env.OUT || 'xray.png' });
  console.log(await p.evaluate(() => window.__best), errs);
  await b.close(); })();
