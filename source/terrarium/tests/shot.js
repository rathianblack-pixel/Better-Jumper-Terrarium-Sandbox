// node tests/shot.js <dist-dir> <out-prefix> [setup-js-file]  -> screenshots + console errors (JSON)
const { chromium } = require('playwright');
const fs = require('fs'); const [dir, out, setup] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | '))); page.on('console', m => { if (m.type() === 'error' && !/GPU stall|vibrate|ERR_FILE/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('file://' + require('path').resolve(dir) + '/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(3500);
  await page.screenshot({ path: out + '_start.png' });
  const res = setup ? await page.evaluate(fs.readFileSync(setup, 'utf8')) : null;
  const shots = (res && res.shots) || [3000];
  for (let i = 0; i < shots.length; i++) { await page.waitForTimeout(shots[i]); const info = await page.evaluate(() => window._probe ? window._probe() : null); if (info && info.clip) await page.screenshot({ path: out + '_' + i + '.png', clip: info.clip }); else await page.screenshot({ path: out + '_' + i + '.png' }); if (info) console.log(JSON.stringify(info.data || info)); }
  console.log(JSON.stringify({ res, errors: errors.slice(0, 8) })); await browser.close();
})();
