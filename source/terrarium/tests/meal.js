// node tests/meal.js <dist-dir> <out.png> [yaw] [pitch]: a mantis holding each prey family at several stages of being eaten
const { chromium } = require('playwright'); const fs = require('fs');
const [dir, out, yaw, pitch] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + require('path').resolve(dir) + '/index.html'); await page.waitForTimeout(2500); if (process.env.BIG) await page.evaluate(() => { window._cell = 420; window._us = [0.03, 0.3, 0.5, 0.85]; });
  const url = await page.evaluate(([yaw, pitch]) => {
    const D = JT.Draw, MM = JT.MantisMeal; const preys = window._preys || ['housefly', 'moth', 'cricket', 'mealworm', 'dubia', 'jumperMeal']; const us = (window._us || [0, 0.2, 0.42, 0.62, 0.8, 0.96]);
    const cell = window._cell || 210, c = document.createElement('canvas'); c.width = cell * us.length; c.height = cell * preys.length; const ctx = c.getContext('2d'); ctx.fillStyle = '#e9e0cc'; ctx.fillRect(0, 0, c.width, c.height); ctx.font = '11px serif';
    const fakeR = { time: 1.3, particles: [] };
    preys.forEach((type, r) => us.forEach((u, k) => {
      const S = JT.SPECIES_BY_ID.chinese; const L = S.len; const V = new JT.View(+yaw || 0.5, +pitch || 0.35, cell / (L * 1.1), k * cell + cell * 0.45, r * cell + cell * 0.66, [0, 0, 0]);
      const sp = { species: 'chinese', state: 'feed', stage: 5, seed: 3, sat: 0.6, _walk: 0, _crouch: 0 };
      const p = { id: 'x', type, len: type === 'jumperMeal' ? 18 : undefined, species: 'carolina', stage: 5, _mEat: u, _mGone: {} };
      for (const q of MM.partsOf(MM.famOf(p), p)) if (u >= q.at) p._mGone[q.id] = 1;
      const hug = { k: 1, pl: Math.min((JT.PREY_BY_ID[type] || { len: 18 }).len || 18, L) * 0.8, big: 0 };
      try { JT.withBaseLight(() => D.spider(ctx, V, sp, { p: [0, 0, 0], f: [1, 0, 0], s: [0, 0, 1], n: [0, 1, 0] }, { len: L, time: 1.3, alpha: 1, hug, meal: (mp, fg, sg, n) => MM.drawMeal(fakeR, ctx, V, sp, p, mp, fg, sg, n, L) })); } catch (e) { ctx.fillStyle = 'red'; ctx.fillText(e.message.slice(0, 40), k * cell + 4, r * cell + 30); }
      ctx.fillStyle = '#333'; ctx.fillText(type + ' eaten ' + Math.round(u * 100) + '%', k * cell + 4, r * cell + 12);
    }));
    return c.toDataURL('image/png');
  }, [yaw, pitch]);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(JSON.stringify({ errors })); await browser.close();
})();
