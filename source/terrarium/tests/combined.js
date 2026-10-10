// node tests/combined.js [dist/terrarium] -> title screen, pick, play mantis, switch to jumpers via the ⋯ menu, back to title
const { chromium } = require('playwright'); const path = require('path');
const dir = path.resolve(process.argv[2] || 'dist/terrarium'); const shots = process.env.OUT || '/data/comb';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 760 } }); const errs = []; p.on('pageerror', e => errs.push(p.url().split('/').pop() + ': ' + e.message));
  const res = {};
  await p.goto('file://' + dir + '/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.screenshot({ path: shots + '_1title.png' }); res.title = await p.title();
  await p.click('#choose'); await p.waitForTimeout(900); await p.screenshot({ path: shots + '_2pick.png' });
  res.cards = await p.$$eval('.card .chips', es => es.map(e => e.innerText.replace(/\n/g, ' · ')));
  await p.click('.card[data-g="mantis"] .go'); await p.waitForURL(/mantis\.html/); await p.waitForTimeout(3500);
  res.mantisPack = await p.evaluate(() => window.JT_PACK && window.JT_PACK.id); res.mantisTitle = await p.title();
  await p.click('text=Continue'); await p.waitForTimeout(400); await p.click('text=Continue'); await p.waitForTimeout(400); await p.click('text=Create habitat'); await p.waitForTimeout(1500);
  await p.evaluate(() => JT.UI.moreSheet()); await p.waitForTimeout(600); await p.screenshot({ path: shots + '_3menu.png' });
  res.menuText = await p.evaluate(() => document.querySelector('#modalBody .msect').innerText);
  await p.click('text=Switch to Jumping Spiders'); await p.waitForURL(/jumper\.html/); await p.waitForTimeout(3500);
  res.jumperPack = await p.evaluate(() => (window.JT_PACK && window.JT_PACK.id) || 'jumper'); res.mantisSaved = await p.evaluate(() => !!localStorage.getItem('mantisTerrarium.v1.save'));
  await p.screenshot({ path: shots + '_4jumper.png' });
  await p.evaluate(() => { try { JT.UI.closeModal(); } catch (e) {} JT.UI.moreSheet(); }); await p.waitForTimeout(500);
  res.menuText2 = await p.evaluate(() => document.querySelector('#modalBody .msect').innerText);
  await p.click('text=Title screen'); await p.waitForURL(/index\.html/); await p.waitForTimeout(1200); res.titleMenu = await p.$eval('#menu', e => e.textContent); await p.click('#choose'); await p.waitForTimeout(900);
  res.cards2 = await p.$$eval('.card .chips', es => es.map(e => e.innerText.replace(/\n/g, ' · '))); res.firstCard = await p.$eval('.card', c => c.getAttribute('data-g')); res.shots = await p.evaluate(() => ['jumper', 'mantis'].map(g => !!localStorage.getItem('terrarium.shot.' + g)));
  await p.screenshot({ path: shots + '_5pick.png' });
  console.log(JSON.stringify({ res, errs }, null, 1)); await b.close();
})();
