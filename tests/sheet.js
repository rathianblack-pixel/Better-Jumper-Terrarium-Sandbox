const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: require('child_process').execSync('which chromium').toString().trim(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + require('path').resolve(__dirname, 'critter-sheet.html') + (process.argv[2] ? '?s=' + process.argv[2] : '') + (process.argv[4] ? '&meal=' + process.argv[4] : '')); await p.waitForTimeout(500);
  await p.screenshot({ path: '/data/shots/' + (process.argv[3] || 'sheet') + '.png' }); console.log('errors', errs); await b.close(); })();
