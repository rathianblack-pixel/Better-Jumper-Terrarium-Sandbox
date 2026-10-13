// Browser check (Playwright): tap the slow-motion offer instantly / shortly after a catch; the replay must start before the leap, never already holding prey. NODE_PATH=... node tests/replay_browser.js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/vercel/sandbox/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file:///data/game/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = JT.app.game, h = g.hab, sp = h.spiders[0]; JT.UI.toggleObserve(true, sp.id); window._log = [];
    const R0 = JT.app.R.render.bind(JT.app.R); // what the renderer actually draws during a replay
    JT.app.R.render = (dt) => { const A = JT.Replay.active; if (A) { const s = h.spider(A.id); window._log.push({ i: A.i, settle: A.settle > 0, st: s.state, pos: s.pos.slice(), hold: s.hold || null }); } return R0(dt); };
  });
  const trial = async (delayMs, shot) => {
    await page.evaluate(() => { const h = JT.app.game.hab; const sp = h.spiders[0]; sp.sat = 0.05; h.data.prey = h.data.prey.filter(p => p.owner); h.addPrey('fruitfly', 3); h.addPrey('aphid', 3); window._log = []; window._tc = null; });
    let got = false; for (let i = 0; i < 160 && !got; i++) { await page.waitForTimeout(250); got = await page.evaluate(() => !!(JT.Replay.offer && JT.Replay.offer !== window._seen && (window._seen = JT.Replay.offer))); }
    if (!got) return { got };
    await page.waitForTimeout(delayMs);
    const info = await page.evaluate(() => { const o = JT.Replay.offer; window._visible = !!(o.el && document.body.contains(o.el)); const h = JT.app.game.hab; const sp = h.spider(o.id); const live = { st: sp.state, pos: sp.pos.slice() }; JT.Replay.start(JT.UI, o.id, o.tc); const A = JT.Replay.active; if (!A) return { started: false };
      const rec = (k) => A.frames[k].ents.find(x => x[0].id === o.id)[1]; return { started: true, toastVisible: window._visible, live, n: A.frames.length, pounceI: A.pounceI, catchI: A.catchI, f0: rec(0).state, fP: rec(A.pounceI).state, launch: rec(Math.max(0, A.pounceI - 1)).pos, catchPos: rec(A.catchI).pos }; });
    if (shot) { await page.waitForTimeout(700); await page.screenshot({ path: '/tmp/r_' + shot + '.png' }); }
    let done = false; for (let i = 0; i < 80 && !done; i++) { await page.waitForTimeout(250); done = await page.evaluate(() => !JT.Replay.active); }
    const lg = await page.evaluate(() => window._log);
    const first = lg[0]; const prePounce = lg.filter(l => l.i < info.pounceI - 0.5);
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    return { delayMs, ...info, done, frames: lg.length, firstState: first && first.st, firstHold: first && first.hold, firstAtLaunch: first ? +d(first.pos, info.launch).toFixed(2) : null, firstToLive: first ? +d(first.pos, info.live.pos).toFixed(2) : null,
      prePounceRendered: prePounce.length, prePounceHolding: prePounce.filter(l => l.hold).length, leadSec: +(info.pounceI / 30).toFixed(2), jumpDist: +d(info.launch, info.catchPos).toFixed(1) };
  };
  const out = [];
  out.push(await trial(0, 'fast')); out.push(await trial(0, null)); out.push(await trial(800, 'mid'));
  console.log(JSON.stringify({ out, errors: errors.slice(0, 5) }, null, 1)); await browser.close();
})();
