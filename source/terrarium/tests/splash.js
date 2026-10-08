// node tests/splash.js <page.html> <out.png>  -> screenshot of the game's own start (splash) screen
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 900, height: 760 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('file://' + require('path').resolve(process.argv[2]) + '?splash=1&attract=0'); await p.waitForTimeout(+(process.env.WAIT || 700)); await p.screenshot({ path: process.argv[3] });
 console.log(JSON.stringify({ title: await p.evaluate(() => { const e = document.querySelector('.sp-title'); return e ? e.textContent : null; }), tag: await p.evaluate(() => { const e = document.querySelector('.sp-tag'); return e ? e.textContent : null; }), errs })); await b.close(); })();
