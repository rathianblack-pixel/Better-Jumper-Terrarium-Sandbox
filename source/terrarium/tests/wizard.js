const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 820 } }); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///data/terrarium/dist/mantis-terrarium/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(3000);
  await p.click('text=Continue'); await p.waitForTimeout(800); await p.screenshot({ path: '/data/wiz_2.png' });
  await p.click('text=Continue'); await p.waitForTimeout(800); await p.screenshot({ path: '/data/wiz_3.png' });
  const txt = await p.evaluate(() => document.getElementById('modalBody').innerText.slice(0, 1500)); console.log(txt);
  console.log('errors', errs); await b.close();
})();
