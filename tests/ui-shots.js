const { chromium } = require('playwright');
(async () => {
  const exe = require('child_process').execSync('which chromium').toString().trim();
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const url = process.env.URL || ('file://' + require('path').resolve(__dirname, '../index.html'));
  const errs = [];
  const page = async (opts) => { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + e.stack)); await p.goto(url); await p.waitForTimeout(1500); return p; };
  const S = (p, n) => p.screenshot({ path: '/data/shots/' + n + '.png' });
  // desktop
  let p = await page({ viewport: { width: 1440, height: 900 } });
  await p.click('#toolbar [data-tool=plants]'); await p.waitForTimeout(400); await S(p, 'd_plants');
  await p.click('#drawerBody .card:nth-child(3)'); await p.mouse.move(700, 560); await p.waitForTimeout(300); await p.mouse.move(720, 600); await p.waitForTimeout(400); await S(p, 'd_place');
  await p.mouse.click(720, 600); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await p.click('#toolbar [data-tool=jumpers]'); await p.waitForTimeout(500); await S(p, 'd_collection'); await p.keyboard.press('Escape');
  await p.click('#btnManage'); await p.waitForTimeout(400); await S(p, 'd_manage'); await p.keyboard.press('Escape');
  await p.click('#toolbar [data-tool=food]'); await p.waitForTimeout(400); await S(p, 'd_food'); await p.keyboard.press('Escape');
  await p.click('#timeMode [data-tm=night]'); await p.click('#toolbar [data-tool=mist]'); await p.waitForTimeout(1200); await S(p, 'd_night');
  await p.click('#timeMode [data-tm=auto]');
  await p.click('#habTabs button:nth-child(2)'); await p.waitForTimeout(1200); await S(p, 'd_canopy');
  await p.click('#habTabs button:nth-child(3)'); await p.waitForTimeout(1200); await S(p, 'd_wide');
  await p.click('#habTabs button:nth-child(1)'); await p.keyboard.press('o'); await p.waitForTimeout(2000); await S(p, 'd_observe'); await p.keyboard.press('Escape');
  await p.keyboard.press('2'); await p.waitForTimeout(1500); await S(p, 'd_observer'); await p.keyboard.press('4'); await p.waitForTimeout(1500); await S(p, 'd_reverse');
  // mobile
  p = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.tap('#dock [data-dock=build]'); await p.waitForTimeout(500); await S(p, 'm_build');
  await p.tap('#drawerBody .card:nth-child(2)'); await p.waitForTimeout(500); await S(p, 'm_place'); await p.tap('#modeCancel');
  await p.tap('#dock [data-dock=more]'); await p.waitForTimeout(400); await S(p, 'm_more'); await p.tap('#modalClose');
  await p.tap('#dock [data-dock=jumpers]'); await p.waitForTimeout(400); await S(p, 'm_jumpers');
  console.log('errors:', errs.length); errs.slice(0, 20).forEach(e => console.log(' ', e.slice(0, 300)));
  await b.close();
})();
