// node tests/behave.js <dist-dir>  -> runs mantis behaviour scenarios in fast-forward, prints a JSON report
const { chromium } = require('playwright');
const dir = process.argv[2] || 'dist/mantis-terrarium';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | '))); page.on('console', m => { if (m.type() === 'error' && !/GPU stall|vibrate|ERR_FILE/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('file://' + require('path').resolve(dir) + '/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(3000);
  const report = await page.evaluate(() => {
    try { JT.UI.closeModal(); } catch (e) {}
    const g = JT.app.game, h = g.hab, AI = JT.SpiderAI, M = JT.M; const out = {};
    const run = (secs, each) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) { g.tick(1 / 60); if (each) each(i / 60); } };
    const watch = (sp) => { const seq = []; let last = null; return { f: () => { if (sp.state !== last) { last = sp.state; seq.push(sp.state); } }, seq }; };
    const sp = h.spiders[0]; const L = AI.len(sp);
    // 1. hunt + feed on the spot (adult, hungry)
    sp.species = 'chinese'; sp.stage = 5; const L5 = AI.len(sp); sp.sat = 0.15; h.addPrey('cricket', 2); h.addPrey('housefly', 3);
    let w = watch(sp); const strikes = []; let fly = 0, carry = 0, flown = 0;
    run(150, () => { w.f(); const A = sp._air; if (sp.state === 'pounce' && A && A._m && !A._seen) { A._seen = 1; strikes.push({ d: +(A.reachD || 0).toFixed(1), lunge: +M.dist(A.from, A.to).toFixed(1), L: +L5.toFixed(1) }); } if (sp.state === 'carry') carry++; });
    out.hunt = { seq: w.seq.join(' > ').slice(0, 900), strikes: strikes.slice(0, 8), carryFrames: carry, catches: sp.catches, sat: +sp.sat.toFixed(2) };
    // 2. poke while feeding -> carry away
    sp.sat = 0.1; h.addPrey('housefly', 4); let poked = false; w = watch(sp);
    run(120, () => { w.f(); if (!poked && sp.state === 'feed' && sp.st > 1) { poked = true; h.finger = { id: 'f1', pos: M.add(sp.pos, [3, 2, 3]), t: h.time, fast: true }; } });
    out.poke = { poked, seq: w.seq.join(' > ').slice(0, 600) };
    // 3. startle -> threat display
    h.finger = null; const dl0 = h.daylight; h.daylight = () => 1; h.data.prey.length = 0; run(3); AI.dropTarget(h, sp); AI.setState(sp, 'idle'); sp._mDispCD = 0; sp._fingerCD = 0; sp.tame = 0; w = watch(sp); let shown = 0;
    run(8, (t) => { w.f(); if (Math.abs(t - 0.5) < 0.01) h.finger = { id: 'f2', pos: M.add(sp.pos, [2, 3, 2]), t: h.time, fast: true }; if (sp.state === 'display') shown++; });
    out.display = { seq: w.seq.join(' > '), frames: shown, thought: sp.thought };
    // 4. flight permission
    h.finger = null; sp._mFlyUntil = h.time + 300; sp.sat = 1; w = watch(sp);
    const jumps = []; run(200, () => { w.f(); if (sp._mFly) flown++; const A = sp._air; if (A && A.mode === 'jump' && !A._j) { A._j = 1; jumps.push(+M.dist(A.from, A.to).toFixed(1) + (A.fly ? 'F' : '')); } });
    h.daylight = dl0;
    out.flight = { flyFrames: flown, jumps: jumps.slice(0, 20), capJ: +AI.caps(sp).jump.toFixed(1), hop: +AI.jump(sp).toFixed(1), seq: w.seq.join(' > ').slice(0, 500) };
    // 5. molt: a nymph ready to molt
    sp.stage = 3; sp.sat = 0.9; sp.meals = 99; sp.soft = 0; AI.setState(sp, 'idle'); w = watch(sp); let hangMax = 0, slideMax = 0, supK = '';
    run(110, () => { w.f(); hangMax = Math.max(hangMax, sp._mHangK || 0); slideMax = Math.max(slideMax, sp._mSlide || 0); if (sp.state === 'premolt') supK = sp.sup.k; });
    out.molt = { seq: w.seq.join(' > '), stage: sp.stage, hangMax: +hangMax.toFixed(2), slideMax: +slideMax.toFixed(2), supK, nests: (h.data.nests || []).length, thought: sp.thought };
    return out;
  });
  console.log(JSON.stringify({ report, errors: errors.slice(0, 8) }, null, 1)); await browser.close();
})();
