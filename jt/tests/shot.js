const { chromium } = require('playwright');
(async () => {
  const exe = require('child_process').execSync('which chromium').toString().trim();
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const url = process.env.URL || ('file://' + require('path').resolve(__dirname, '../index.html'));
  const run = async (name, opts, actions) => {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto(url); await p.waitForTimeout(+(process.env.WAIT || 3000));
    if (actions) await actions(p);
    await p.screenshot({ path: '/data/shots/' + name + '.png' });
    const info = await p.evaluate(() => { const g = JT.app.game; const h = g.hab; return { fps: JT.app.R.fps.toFixed(0), states: h.spiders.map(s => s.name + ':' + s.state + ':' + s.sup.k), prey: h.prey.length, coins: g.state.coins }; });
    console.log(name, JSON.stringify(info)); errs.slice(0, 15).forEach(e => console.log('  ', e));
    await ctx.close();
  };
  const which = process.argv[2] || 'all';
  if (which === 'all' || which === 'desk') await run('desktop', { viewport: { width: 1440, height: 900 } });
  if (which === 'all' || which === 'mob') await run('portrait', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  if (process.env.EXTRA) await run('extra', { viewport: { width: 1440, height: 900 } }, eval(process.env.EXTRA));
  await b.close();
})();
