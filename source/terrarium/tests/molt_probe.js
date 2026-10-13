const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] }); const p = await b.newPage();
 await p.goto('file:///data/terrarium/dist/mantis-terrarium/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(2500);
 console.log(await p.evaluate(() => { const g = JT.app.game, h = g.hab, sp = h.spiders[0]; sp.stage = 3; sp.sat = 0.9; sp.meals = 99; JT.SpiderAI.setState(sp, 'idle');
  for (let i = 0; i < 60 * 150 && sp.state !== 'postMolt'; i++) g.tick(1 / 60);
  const r = h.data.remains.filter(r => r.cat === 'exuvia'); return JSON.stringify({ st: sp.state, piv: sp._mPiv, ok: sp._mHangOK, r: r.map(x => ({ sup: x.sup.k, hang: !!x.hang, stage: x.stage })) }); }));
 await b.close(); })();
