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

    // ---------------- v1.2 scenarios ----------------
    const T = (name, fn) => { try { out[name] = fn(); } catch (e) { out[name] = { error: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }; } };
    const J0 = () => Object.keys(g.state.journal || {}).length; const jHas = (id) => !!(g.state.journal || {})[id];
    const fresh = (species, stage) => { h.finger = null; h.data.prey.length = 0; h.data.drops.length = 0; AI.dropTarget(h, sp); sp._route = null; sp._air = null; sp.hold = null; sp.species = species; sp.stage = stage; sp.soft = 0; sp.sat = 0.8; sp.hyd = 0.9; sp.meals = 0; sp._mDispCD = 0; sp._fingerCD = 0; sp._mDeadCD = 0; sp._mBoxCD = 0; sp._mEyeT = 999; sp._mHangCD = h.time + 999; if (sp.sup.k === 'air') { const b = JT.Nav.supportBelow(h, sp.pos); sp.pos = b.pos; sp.sup = b.sup; } AI.setState(sp, 'idle'); };
    h.daylight = () => 1;
    T('peering', () => { fresh('chinese', 5); sp.sat = 0.1; h.addPrey('cricket', 2); h.addPrey('housefly', 2); let pk = 0, crouchWithPeer = 0; w = watch(sp);
      run(90, () => { w.f(); pk = Math.max(pk, sp._mPeer || 0); if (sp.state === 'crouch' && sp._mPeerT > 0) crouchWithPeer++; }); return { peerMax: +pk.toFixed(2), crouchPeerFrames: crouchWithPeer, journal: jHas('peering'), catches: sp.catches }; });
    T('missedStrike', () => { fresh('chinese', 5); sp.sat = 0.1; h.addPrey('cricket', 3); let missed = 0, seq = []; w = watch(sp);
      run(90, () => { w.f(); if (sp.state === 'crouch' && !sp._mForceMiss && !missed) sp._mForceMiss = 1; if (sp.state === 'mMiss' && !missed) { missed = 1; seq = w.seq.slice(-4); } }); return { missed, seq: seq.join(' > '), thought: missed ? 'ok' : sp.thought, journal: jHas('missedStrike') }; });
    T('drinkTinyBead', () => { fresh('chinese', 1); sp.hyd = 0.1; const p0 = sp.pos; const mk = (dx, tiny) => { const b = JT.Nav.supportBelow(h, [Math.min(h.dims.w - 6, Math.max(6, p0[0] + dx)), h.dims.h, p0[2]]); const d = { id: 'w' + Math.random().toString(36).slice(2, 7), pos: b.pos, sup: b.sup, decor: b.sup.d || null, life: 900, r: tiny ? 0.45 : 1.3, tiny: !!tiny }; h.data.drops.push(d); return d; };
      const big = mk(8, false), tiny = mk(-14, true); let target = null, sipMax = 0, shrunk = 9; w = watch(sp);
      run(60, () => { w.f(); if (sp._drink && !target) target = sp._drink.id === tiny.id ? 'tiny' : 'big'; sipMax = Math.max(sipMax, sp._mSip || 0); if (sp.state === 'drink') { const d = h.data.drops.find(x => x.id === tiny.id); if (d) shrunk = Math.min(shrunk, d.r); } });
      return { target, sipMax: +sipMax.toFixed(2), tinyShrankTo: +shrunk.toFixed(2), tinyGone: !h.data.drops.some(x => x.id === tiny.id), bigLeft: h.data.drops.some(x => x.id === big.id), hyd: +sp.hyd.toFixed(2), journal: jHas('beadSip'), seq: w.seq.join(' > ').slice(0, 200) }; });
    T('playDead', () => { fresh('deadleaf', 5); sp.tame = 0; let dm = 0; w = watch(sp);
      run(30, (t) => { w.f(); if (Math.abs(t - 0.5) < 0.01) h.finger = { id: 'fd', pos: M.add(sp.pos, [2, 3, 2]), t: h.time, fast: true }; dm = Math.max(dm, sp._mDead || 0); });
      return { seq: w.seq.join(' > '), deadMax: +dm.toFixed(2), recovered: sp.state !== 'mDead' && (sp._mDead || 0) < 0.1, journal: jHas('playDead') }; });
    T('wingBuzz', () => { fresh('budwing', 5); sp.tame = 0; let bz = 0; w = watch(sp);
      run(10, (t) => { w.f(); if (Math.abs(t - 0.5) < 0.01) h.finger = { id: 'fb', pos: M.add(sp.pos, [2, 3, 2]), t: h.time, fast: true }; bz = Math.max(bz, sp._mBuzz || 0); });
      return { seq: w.seq.join(' > '), buzzMax: +bz.toFixed(2), noFly: !AI.caps(sp).fly, journal: jHas('wingBuzz') }; });
    T('boxing', () => { fresh('boxer', 5); let bx = 0; w = watch(sp);
      run(8, (t) => { w.f(); if (t > 0.5 && t < 3) h.finger = { id: 'fx', pos: M.add(sp.pos, [6, 4, 6]), t: h.time, fast: false, held: true }; bx = Math.max(bx, sp._mBox || 0); });
      return { seq: w.seq.join(' > '), boxMax: +bx.toFixed(2), journal: jHas('boxing') }; });
    T('lifeCycle', () => { fresh('chinese', 5); h.finger = null; const keep = h.spiders.slice(); sp.sex = 'f'; sp.gravid = null; sp.sat = 0.9; const m = h.addSpider('chinese', { stage: 5, sex: 'm' }); m.sat = 0.9; AI.mantisStartCourt(h, m, sp); m._mForceEat = 0;
      const states = new Set(); let mountMax = 0; run(240, () => { states.add(m.state); mountMax = Math.max(mountMax, m._mMount || 0); if (m.state === 'idle' && !sp.gravid && !states.has('mPaired')) { AI.mantisStartCourt(h, m, sp); m._mForceEat = 0; } });
      const paired = states.has('mPaired'), gravid = !!sp.gravid; if (sp.gravid) sp.gravid.d = sp.ageDays - 1; let layMax = 0;
      run(150, () => { layMax = Math.max(layMax, sp._mLay || 0); });
      const o = (h.data.ooth || [])[0]; const res = { paired, gravid, mountMax: +mountMax.toFixed(1), layMax: +layMax.toFixed(2), laid: !!o, oothState0: o && o.state };
      if (o) { o.age = AI.LIFE.HARD_DAYS + 0.01; run(0.2); res.hard = o.state; o.age = AI.LIFE.HATCH_DAYS + 0.01; run(0.2); res.hatching = o.state; let vis = 0; run(3, () => { const hv = (h._mHatch || [])[0]; if (hv) vis = Math.max(vis, hv.nym.length); }); run(10); res.after = o.state; res.result = o.result; res.visNymphs = vis; res.tankCount = h.spiders.length; res.cap = h.dims.cap; }
      res.journal = ['courtship', 'mating', 'oothLaid', 'oothHard', 'hatchDay'].filter(jHas);
      // tidy: back to one mantis
      for (const s2 of h.spiders.slice()) if (s2 !== sp) h.removeEntity(s2, 'player'); h.data.ooth = []; return res; });
    T('windSway', () => { fresh('deadleaf', 4); const b0 = h.data.biome; h.data.biome = 'dryleaf'; h.data.wx = { id: 'wind', t: 0 }; h.data.bev = { id: 'wind' }; let rk = 0, sw = 0, leaves = 0, snaps0 = sp._mLeafSnaps || 0, landed = 0;
      run(40, () => { rk = Math.max(rk, Math.abs(sp._mRock || 0)); for (const inst of h.decor) if (inst._sw) sw = Math.max(sw, Math.abs(inst._sw.x)); const L2 = h._mLeaves || []; leaves = Math.max(leaves, L2.filter(l => l.falling).length); landed = Math.max(landed, L2.filter(l => !l.falling).length); h.data.wx = { id: 'wind', t: 0 }; h.data.bev = { id: 'wind' }; });
      const r = { rockMax: +rk.toFixed(2), decorSwayMax: +sw.toFixed(3), fallingLeavesMax: leaves, restingLeavesMax: landed, leafCap: JT.MAtmos.LEAF_CAP, headSnaps: (sp._mLeafSnaps || 0) - snaps0, journal: jHas('breezeSway') }; h.data.wx = null; h.data.bev = null; h.data.biome = b0; return r; });
    T('baskColour', () => { fresh('chinese', 5); h.daylight = () => 0.1; sp._mCold = 0; run(60); const coldNight = +(sp._mCold || 0).toFixed(2); const wa = h.warmthAt; h.warmthAt = () => 1; h.daylight = () => 0.7; AI.setState(sp, 'bask'); sp._baskDur = 999; run(25); const warmed = +(sp._mCold || 0).toFixed(2); h.warmthAt = wa; h.daylight = () => 1;
      const tone = JT.Draw.mantisTone ? JT.Draw.mantisTone(JT.SPECIES_BY_ID.chinese, { _mCold: 0.8 }) : null; return { coldNight, afterBask: warmed, darkerWhenCold: !!tone && tone.body !== JT.SPECIES_BY_ID.chinese.pal.body }; });
    T('moltColour', () => { fresh('chinese', 3); const b0 = h.data.biome; h.data.biome = 'dryleaf'; sp.morph = null; sp.meals = 99; sp.sat = 0.95; const st0 = sp.stage; run(140); const r = { stage0: st0, stage: sp.stage, morph: sp.morph, journal: jHas('colourShift') }; h.data.biome = b0; return r; });
    T('pollinators', () => { fresh('orchid', 5); sp.sat = 1; JT.Biome.layout(h, 'orchidgarden', 11); h.spiders.length = 0; h.data.spiders.push(sp); const b = JT.Nav.supportBelow(h, [h.dims.w / 2, h.dims.h, h.dims.d / 2]); sp.pos = b.pos; sp.sup = b.sup; AI.setState(sp, 'idle'); h.data.prey.length = 0; h.addPrey('housefly', 4); h.addPrey('moth', 2); h._mVisits = 0; let hov = 0;
      run(90, () => { for (const p of h.data.prey) if (p._hover) hov++; }); return { flowers: (h.nav.flowers || []).length, hoverFrames: hov, flowerLandings: h._mVisits }; });
    h.daylight = dl0;
    return out;
  });
  console.log(JSON.stringify({ report, errors: errors.slice(0, 8) }, null, 1)); await browser.close();
})();
