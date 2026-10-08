// node tests/ui_check.js <dist>  -> opens Build drawer, lists new decor, tries selecting the lid by clicking it
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 760 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(process.argv[2]) + '/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(3000);
  await p.click('text=Continue'); await p.waitForTimeout(400); await p.click('text=Continue'); await p.waitForTimeout(400); await p.click('text=Create habitat'); await p.waitForTimeout(1500);
  await p.click('text=Build'); await p.waitForTimeout(700); await p.screenshot({ path: '/data/ui_build.png' });
  const txt = await p.evaluate(() => document.body.innerText);
  const names = ['Molting Cross-Perch', 'Flower Spike', 'Orchid Spray', 'Dead Leaf Branch', 'Twig Tangle', 'Tall Twig', 'Mesh Lid'];
  const found = {}; for (const n of names) found[n] = txt.includes(n);
  // try to pick the lid: project a lid point to the screen and click it
  const pick = await p.evaluate(() => { const a = JT.app, h = a.game.hab; const lid = h.data.decor.find(d => d.type === 'meshlid'); const r = a.R || a.renderer;
    const hit = []; for (let y = 120; y < 600; y += 30) for (let x = 200; x < 900; x += 40) { try { const o = r.pick(x, y, {}); if (o && o.kind === 'decor') hit.push(o.ent.type); } catch (e) { return 'err ' + e.message; } }
    return { lid: lid && lid.id, picked: [...new Set(hit)], hasPick: !!(r && r.pick) }; });
  for (const q of ['perch', 'flower', 'leaf']) { await p.fill('input[placeholder*="Find"]', q); await p.waitForTimeout(1500); await p.screenshot({ path: '/data/ui_find_' + q + '.png' }); }
  console.log(JSON.stringify({ found, pick, errs }));
  await b.close();
})();
