const { chromium } = require('playwright');
(async () => {
  const exe = require('child_process').execSync('which chromium').toString().trim();
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto(process.env.URL || 'file://' + require('path').resolve(__dirname, '../dist/jumper-terrarium.html')); await p.waitForTimeout(1500);
  // buy food, add a spider, place decor, remove decor, mist, clean, journal, switch habitats, observe
  await p.click('#toolbar [data-tool=food]'); await p.click('#drawerBody .card:nth-child(1)'); await p.click('#drawerBody .card:nth-child(4)'); await p.keyboard.press('Escape');
  await p.click('#toolbar [data-tool=jumpers]'); await p.click('.entry:nth-child(4) .modal-btn'); await p.waitForTimeout(300);
  await p.click('#toolbar [data-tool=decor]'); await p.click('#drawerBody .card:nth-child(1)'); await p.mouse.move(640, 560); await p.keyboard.press('r'); await p.mouse.move(650, 570); await p.mouse.click(650, 570);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await p.click('#toolbar [data-tool=remove]'); await p.mouse.click(640, 470); await p.keyboard.press('Escape');
  await p.click('#toolbar [data-tool=mist]'); await p.click('#toolbar [data-tool=clean]');
  // fast-forward the simulation in page to exercise long play including rendering
  const r = await p.evaluate(async () => { const g = JT.app.game; for (let i = 0; i < 20; i++) { for (let k = 0; k < 900; k++) g.tick(1 / 30); await new Promise(r => setTimeout(r, 50)); } return { day: g.day(), catches: g.state.catches, coins: g.state.coins, spiders: g.habs.map(h => h.spiders.map(s => s.name + ':' + s.stage + ':' + s.state).join(',')), journal: Object.keys(g.state.journal).length }; });
  console.log(JSON.stringify(r));
  await p.keyboard.press('o'); await p.waitForTimeout(3000); await p.screenshot({ path: '/data/shots/stress_obs.png' }); await p.keyboard.press('Escape');
  await p.click('#habTabs button:nth-child(2)'); await p.waitForTimeout(500); await p.click('#habTabs button:nth-child(1)');
  await p.reload(); await p.waitForTimeout(1500); const r2 = await p.evaluate(() => ({ catches: JT.app.game.state.catches, coins: JT.app.game.state.coins }));
  console.log('after reload', JSON.stringify(r2)); await p.screenshot({ path: '/data/shots/stress_reload.png' });
  console.log('errors', errs.length); errs.slice(0, 10).forEach(e => console.log(' ', e.slice(0, 300))); await b.close();
})();
