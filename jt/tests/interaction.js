// Browser interaction checks: tap jumper → follow, tap empty → stop, tap lamp → toggle, drag while following → orbit + pause.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const exe = require('child_process').execSync('which chromium').toString().trim();
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const url = process.env.URL || ('file://' + path.resolve(__dirname, '../index.html'));
  let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
  for (const vp of [{ name: 'desktop', o: { viewport: { width: 1440, height: 900 } } }, { name: 'phone', o: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }]) {
    console.log(vp.name);
    const ctx = await b.newContext(vp.o); const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForTimeout(1500);
    await p.evaluate(() => { const g = JT.app.game, h = g.hab; JT.app.UI.hidePanel(); for (const pr of h.prey.slice()) h.removeEntity(pr, 'player'); for (const s of h.spiders) { s.sat = 0.9; s._route = null; s.state = 'rest'; s.st = 0; } JT.app.R.setMode('iso'); });
    await p.waitForTimeout(1500);
    const tap = async (x, y) => { if (vp.name === 'phone') await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); await p.waitForTimeout(400); };
    const spPos = () => p.evaluate(() => { const sp = JT.app.game.hab.spiders[0]; const L = JT.SpiderAI.len(sp); const fr = JT.Draw.frame(JT.app.game.hab, sp, 0.05); return JT.app.R.project(JT.M.add(fr.p, JT.M.mul(fr.n, L * 0.15))); });
    let q = await spPos(); await tap(q[0], q[1]);
    ok(await p.evaluate(() => JT.app.R.cam.mode === 'follow'), 'tap on jumper starts following');
    ok(await p.evaluate(() => !document.getElementById('spiderPanel').classList.contains('hidden')), 'jumper panel shows');
    ok(await p.evaluate(() => document.querySelector('#spiderPanel .state').textContent.length > 3), 'panel shows a short state line');
    await p.waitForTimeout(2500);
    // drag to orbit while following
    const y0 = await p.evaluate(() => JT.app.R.fcam.st.yaw);
    if (vp.name === 'desktop') { await p.mouse.move(300, 450); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(300 + i * 15, 450); await p.mouse.up(); }
    else { const cdp = await ctx.newCDPSession(p); const T = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: 600 }] });
      await T('touchStart', 80); for (let i = 1; i <= 10; i++) { await T('touchMove', 80 + i * 15); await p.waitForTimeout(16); } await T('touchEnd', 230); }
    await p.waitForTimeout(200);
    ok(await p.evaluate((y0) => Math.abs(JT.M.wrapAngle(JT.app.R.fcam.st.yaw - y0)) > 0.3 && JT.app.R.fcam.paused, y0), 'drag orbits the follow camera and pauses auto-rotation');
    ok(await p.evaluate(() => JT.app.R.cam.mode === 'follow'), 'still following after the drag');
    // tap empty space → stop following
    await tap(vp.name === 'phone' ? 30 : 60, vp.name === 'phone' ? 520 : 600);
    ok(await p.evaluate(() => JT.app.R.cam.mode !== 'follow'), 'tap on empty space stops following');
    // Follow control toggles
    if (vp.name === 'phone') { await p.tap('#dock [data-dock=follow]'); await p.waitForTimeout(300); ok(await p.evaluate(() => JT.app.R.cam.mode === 'follow'), 'Follow in the dock starts following'); await p.tap('#dock [data-dock=follow]'); await p.waitForTimeout(300); ok(await p.evaluate(() => JT.app.R.cam.mode !== 'follow'), 'Follow again stops'); }
    else { await p.click('#cams [data-cam=follow]'); await p.waitForTimeout(300); ok(await p.evaluate(() => JT.app.R.cam.mode === 'follow'), 'Follow control starts following'); await p.click('#cams [data-cam=iso]'); await p.waitForTimeout(300); }
    // lamp tap toggles
    await p.evaluate(() => { const h = JT.app.game.hab; for (const s of [[0.56, 0.42], [0.3, 0.6], [0.7, 0.6], [0.45, 0.3]]) if (h.addDecor('heatlamp', h.dims.w * s[0], h.dims.d * s[1], 1, 3)) break; });
    await p.waitForTimeout(3000);
    const lq = await p.evaluate(() => { const h = JT.app.game.hab; const L = h.lampsOn()[0]; return JT.app.R.project([L.head[0], L.head[1] + 1, L.head[2]]); });
    await tap(lq[0], lq[1]);
    ok(await p.evaluate(() => JT.app.game.hab.decor.find(d => d.type === 'heatlamp').on === false), 'tapping the lamp switches it off');
    await tap(lq[0], lq[1]);
    ok(await p.evaluate(() => JT.app.game.hab.decor.find(d => d.type === 'heatlamp').on !== false), 'tapping again switches it on');
    // no emoji anywhere in the visible interface
    ok(await p.evaluate(() => !/[\u2190-\u2BFF\u2600-\u27BF\u{1F000}-\u{1FFFF}]/u.test(document.body.innerText)), 'no emoji or icon glyphs in the interface');
    // touch targets
    const small = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 43.5 || b.getBoundingClientRect().width < 43.5)).map(b => b.id || b.textContent).slice(0, 5));
    ok(!small.length, 'all visible buttons are at least 44px (' + small.join(', ') + ')');
    ok(!errs.length, 'no console errors ' + errs.join(' / '));
    await ctx.close();
  }
  await b.close(); console.log(fails ? fails + ' failed' : 'all interaction checks passed'); process.exit(fails ? 1 : 0);
})();
