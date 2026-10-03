const { chromium } = require('playwright');
(async () => {
  const exe = require('child_process').execSync('which chromium').toString().trim();
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const url = process.env.URL || ('file://' + require('path').resolve(__dirname, '../index.html'));
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(2500);
  const themes = (process.argv[2] || 'barkwall,stonewall,leafwall,trunkwall,rootwall,sandwall,driftwall,mosswall').split(',');
  for (const th of themes) {
    const info = await p.evaluate((th) => { const h = JT.app.game.hab; JT.Presets.generate(h, th, 9); return h.data.type + ' ' + h.decor.map(d => d.type).join(','); }, th);
    await p.waitForTimeout(+(process.env.WAIT || 1500));
    await p.screenshot({ path: '/data/shots/wall-' + th + '.png' }); console.log(th, info);
  }
  console.log('errors', errs.slice(0, 10)); await b.close();
})();
