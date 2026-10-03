// Screenshots of the new features on desktop, phone portrait and phone landscape; fails on console errors.
//   node tests/feature-shots.js            (index.html)      URL=file:///…/dist/jumper-terrarium.html node tests/feature-shots.js
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const exe = require('child_process').execSync('which chromium').toString().trim();
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const url = process.env.URL || ('file://' + path.resolve(__dirname, '../index.html'));
  const out = process.env.OUT || '/data/shots'; fs.mkdirSync(out, { recursive: true }); const tag = process.env.TAG || '';
  const VPS = { desktop: { viewport: { width: 1440, height: 900 } }, portrait: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
  const setup = () => { // lamp in the starter habitat, a few springtails and a husk
    const g = JT.app.game; g.state.active = 0; JT.app.R.cur = null; const h = g.hab; JT.app.UI.hidePanel();
    if (!h.decor.some(d => d.type === 'heatlamp')) { const spots = [[0.56, 0.42], [0.3, 0.6], [0.7, 0.6], [0.45, 0.3]]; for (const s of spots) if (h.addDecor('heatlamp', h.dims.w * s[0], h.dims.d * s[1], 1, 3)) break; }
    h.addPrey('springtail', 5); const q = h.randomFloorPoint(); h.addRemains('cricket', q, { k: 'floor' }, 'husk');
    JT.app.UI.refreshHeader();
  };
  let errors = 0;
  const run = async (vp, name, act, wait) => {
    const ctx = await b.newContext(VPS[vp]); const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto(url); await p.waitForTimeout(1500); await p.evaluate(setup);
    if (act) await p.evaluate(act); await p.waitForTimeout(wait || 2500);
    const file = path.join(out, tag + vp + '-' + name + '.png'); await p.screenshot({ path: file });
    const info = await p.evaluate(() => { const h = JT.app.game.hab; return h.spiders.map(s => s.name + ':' + s.state).join(' ') + ' | cam ' + JT.app.R.cam.mode + ' | ' + JT.app.R.fps.toFixed(0) + ' fps'; });
    console.log(vp + '-' + name, info, errs.length ? 'ERRORS: ' + errs.join(' / ') : 'no console errors'); errors += errs.length; await ctx.close();
  };
  const follow = () => { const h = JT.app.game.hab; const sp = h.spiders[0]; JT.app.UI.showPanel(sp.id); JT.app.UI.follow(sp.id); };
  const night = () => { JT.app.UI.setTimeMode('night'); const h = JT.app.game.hab; const L = h.lampsOn()[0]; if (L) for (const sp of h.spiders) { const b = JT.Nav.supportBelow(h, [L.pool[0] + 2, L.head[1] - 3, L.pool[2] + 2]); sp.pos = b.pos; sp.sup = b.sup; sp._route = null; sp.state = 'bask'; sp.st = 0; sp._baskDur = 300; } h.addPrey('moth', 3); };
  const hungry = () => { const h = JT.app.game.hab; for (const p of h.prey.slice()) if (JT.PREY_BY_ID[p.type].huntable) h.removeEntity(p, 'player'); for (const s of h.spiders) s.sat = 0.25; JT.app.UI.showPanel(h.spiders[0].id); JT.app.UI.openDrawer('food'); };
  for (const vp of (process.env.VPS || 'desktop,portrait,landscape').split(',')) {
    await run(vp, 'overview');
    await run(vp, 'follow', follow, 4500);
    await run(vp, 'night-lamp', night, 4000);
    await run(vp, 'hungry-food', hungry, 4000);
  }
  await b.close(); console.log(errors ? errors + ' console errors' : 'all clean'); process.exit(errors ? 1 : 0);
})();
