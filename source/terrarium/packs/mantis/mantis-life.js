/* Mantis Terrarium pack v1.2 — life cycle: sex, courtship, mating, egg cases (oothecae) and hatching day.
   - every mantis has sp.sex ('f' | 'm'); old saves get one at random on load
   - an adult male creeps up on an adult female of his species from behind, slowly, freezing whenever she looks his way
   - he climbs onto her back and the pair stay together for a while; now and then she eats him (more likely when hungry)
   - some time later she climbs to a high twig and lays a foamy egg case: pale and soft, it hardens and darkens
   - after a few days dozens of tiny nymphs stream out on short threads and scatter; the tank keeps what fits
     (tank cap and per-species limit), a few wait in the holding cup and the rest are released — one calm toast
   Egg cases live in hab.data.ooth (saved with the tank). */
(function (root) {
  'use strict';
  const JT = root.JT, AI = JT.SpiderAI, H = AI.H, M = JT.M, Nav = JT.Nav, PRI = AI.PRI;
  const R = () => JT.R(); const DAY = JT.DAY || 480;
  const MOLTH = new Set(['moltSeek', 'moltSilk', 'premolt', 'molting', 'postMolt', 'emerge']);
  const J = (hab, id, sp, soft) => hab.event('journal', { id, sp, soft: !!soft });
  const diary = (hab, sp, t) => { if (hab.game && hab.game.diary && sp) hab.game.diary(sp, t); };
  const L = AI.LIFE = { LAY_DAYS: 0.5, HARD_DAYS: 0.5, HATCH_DAYS: 2.5, EMPTY_DAYS: 1.5, MATE_CD_DAYS: 1.5, CUP_MAX: 3, VIS_MAX: 36 };
  Object.assign(PRI, { mCourt: 61, mMount: 66, mPaired: 66, mLaySeek: 48, mLay: 88 });
  Object.assign(AI.M_LINES || (AI.M_LINES = {}), { mCourt: 'Courting', mMount: 'Climbing onto her back', mPaired: 'Paired', mLaySeek: 'Looking for a place to lay', mLay: 'Laying an egg case' });
  const rndSex = () => (R() < 0.5 ? 'f' : 'm');

  // ---- sex: new mantises, restored mantises, old saves (tanks + holding cup) ----
  const create0 = AI.create;
  AI.create = function (hab, speciesId, o) { const sp = create0.apply(this, arguments); if (sp) sp.sex = (o && (o.sex === 'f' || o.sex === 'm')) ? o.sex : rndSex(); return sp; };
  const restore0 = AI.restore;
  AI.restore = function (hab, sp) { if (sp.sex !== 'f' && sp.sex !== 'm') sp.sex = rndSex(); return restore0.apply(this, arguments); };
  const adult = (sp) => (sp.stage | 0) >= 5;
  const busy = (sp) => MOLTH.has(sp.state) || sp.state === 'sleep' || sp.state === 'mDead' || /^m(Court|Mount|Paired|Lay)/.test(sp.state) || sp.soft > 0;
  function canCourt(hab, m) {
    if (m.sex !== 'm' || !adult(m) || busy(m) || m.hold || m._air || m.sat < 0.25) return null;
    if (m.lastMate != null && (m.ageDays || 0) - m.lastMate < L.MATE_CD_DAYS) return null;
    if ((PRI[m.state] || 0) >= 30) return null;
    let best = null, bd = 1e9;
    for (const f of hab.data.spiders) {
      if (f === m || f.species !== m.species || f.sex !== 'f' || !adult(f) || busy(f) || f.hold || f.gravid || f._air) continue;
      if ((PRI[f.state] || 0) >= 40) continue; const d = M.dist(f.pos, m.pos); if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  AI.mantisCanCourt = canCourt;
  function startCourt(hab, m, f) {
    m._mMate = f.id; m._route = null; m._mCourtT0 = hab.time; m._mReplan = 0; AI.dropTarget(hab, m);
    AI.setState(m, 'mCourt', 'Has seen ' + f.name + ' — creeping toward her from behind, very slowly.');
    J(hab, 'courtship', m); diary(hab, m, 'Courted ' + f.name + '.');
  }
  AI.mantisStartCourt = startCourt;
  const horiz = (v) => { const h = [v[0], 0, v[2]]; const l = Math.hypot(h[0], h[2]); return l > 1e-6 ? [h[0] / l, 0, h[2] / l] : [1, 0, 0]; };
  H.mCourt = function (hab, m, dt) {
    const f = hab.spider(m._mMate);
    if (!f || f.gravid || busy(f) && !/^m(Mount|Paired)/.test(f.state) || f.hold) { m._route = null; m.lastMate = (m.ageDays || 0) - L.MATE_CD_DAYS * 0.7; AI.setState(m, 'idle', 'Gives up on courting for now.'); return; }
    if (hab.time - (m._mCourtT0 || 0) > 150) { m._route = null; m.lastMate = (m.ageDays || 0) - L.MATE_CD_DAYS * 0.5; AI.setState(m, 'idle', 'Gives up on courting for now.'); return; }
    const Lm = AI.len(m), Lf = AI.len(f); const d = M.dist(m.pos, f.pos);
    if (d < Lm * 0.3 + Lf * 0.2 + 1.5) { mount(hab, m, f); return; }
    // she looks his way: freeze mid-step
    const toM = horiz(M.sub(m.pos, f.pos)); const looks = (M.dot(horiz(f.fwd || [1, 0, 0]), toM) > 0.6 && d < 60) || (f._glance && f._glance.id === m.id && hab.time < f._glance.until);
    if (looks && !(m._mFreeze > hab.time) && !(m._mFreezeCD > hab.time)) { m._mFreeze = hab.time + 1.4 + R() * 2; m._mFreezeCD = m._mFreeze + 1.2; m.thought = 'Frozen mid-step — ' + f.name + ' turned her head his way.'; }
    const wantFace = f.pos; const dd = horiz(M.sub(wantFace, m.pos)); const fw = m.fwd || [1, 0, 0]; const k = Math.min(1, dt * 1.5);
    if (m._mFreeze > hab.time) { m._gaze = 0; return; }
    if (m.thought && /^Frozen/.test(m.thought)) m.thought = 'Creeping closer again, one slow step at a time.';
    if ((m._mReplan -= dt) <= 0 || !m._route) {
      m._mReplan = 2.5; let gpos = f.pos, gsup = f.sup;
      if (f.sup && f.sup.k === 'floor') { const b = M.add(f.pos, M.mul(horiz(f.fwd || [1, 0, 0]), -Lf * 0.7)); if (Nav.inside(hab, b[0], b[2], 2)) { gpos = [b[0], f.pos[1], b[2]]; gsup = { k: 'floor' }; } }
      m._route = Nav.route(hab, m.sup, m.pos, gsup, gpos, AI.caps(m)) || Nav.route(hab, m.sup, m.pos, f.sup, f.pos, AI.caps(m)); m._routeStart = hab.time;
    }
    const r = JT.Loco.follow(hab, m, dt, AI.speed(m) * (d < Lm * 2 ? 0.12 : 0.2));
    if (r === 'done' || r === 'none') { m._route = null; if (m.sup && m.sup.k !== 'path') m.fwd = M.norm([M.lerp(fw[0], dd[0], k), 0, M.lerp(fw[2], dd[2], k)]); }
  };
  function mount(hab, m, f) {
    m._route = null; f._route = null; AI.dropTarget(hab, f); AI.dropTarget(hab, m);
    m._mPairDur = 40 + R() * 45; m._mEatAt = null;
    const pEat = m._mForceEat != null ? m._mForceEat : 0.1 + (f.sat < 0.35 ? 0.3 : f.sat < 0.6 ? 0.1 : 0) + ((f.pers && f.pers.cannibal) || 0.6) * 0.1 - 0.06;
    if (R() < pEat) m._mEatAt = 4 + R() * (m._mPairDur - 6);
    m._mForceEat = null;
    AI.setState(m, 'mMount', 'Climbs carefully onto ' + f.name + '\u2019s back.');
    AI.setState(f, 'mPaired', 'Stands still while ' + m.name + ' climbs onto her back.'); f._mMate = m.id;
  }
  AI.mantisMount = mount;
  function stickTo(m, f) { m.pos = f.pos.slice(); m.sup = JT.deepClone(f.sup); m.fwd = (f.fwd || [1, 0, 0]).slice(); }
  H.mMount = function (hab, m, dt) {
    const f = hab.spider(m._mMate); if (!f || f.state !== 'mPaired') { AI.setState(m, 'idle'); return; }
    stickTo(m, f); if (m.st > 2) { AI.setState(m, 'mPaired', 'Paired with ' + f.name + ' — the two stay together for a long while.'); J(hab, 'mating', m); diary(hab, m, 'Mated with ' + f.name + '.'); diary(hab, f, 'Mated with ' + m.name + '.'); }
  };
  H.mPaired = function (hab, sp, dt) {
    if (sp.sex === 'f') { const m = hab.spider(sp._mMate); if (!m || (m.state !== 'mPaired' && m.state !== 'mMount')) { sp._mMate = null; AI.setState(sp, 'idle'); } return; }
    const m = sp, f = hab.spider(m._mMate); if (!f || f.state !== 'mPaired') { AI.setState(m, 'idle'); return; }
    stickTo(m, f);
    if (m._mEatAt != null && m.st > m._mEatAt) { eatenByMate(hab, f, m); return; }
    if (m.st > m._mPairDur) {
      m.lastMate = m.ageDays || 0; f.gravid = { d: f.ageDays || 0 }; f._mMate = null; m._mMate = null; m._mMount = 0;
      AI.setState(f, 'idle', 'The male has gone. She grooms her forelegs.');
      AI.setState(m, 'idle', 'Climbs down and walks away, carefully.');
      const b = Nav.supportBelow(hab, M.add(m.pos, M.mul(horiz(m.fwd || [1, 0, 0]), -AI.len(m) * 0.8))); if (b && b.sup && b.sup.k !== 'air' && Nav.inside(hab, b.pos[0], b.pos[2], 2) && Math.abs(b.pos[1] - m.pos[1]) < 6) { m.pos = b.pos; m.sup = b.sup; }
    }
  };
  function eatenByMate(hab, f, m) {
    const Lm = AI.len(m); const pos = m.pos.slice(); const nm = m.name;
    hab.removeEntity(m, 'eaten');
    const meal = { id: JT.newId('p'), type: 'jumperMeal', species: m.species, stage: m.stage, vname: nm, len: Lm, pos, sup: { k: 'air' }, state: 'held', owner: f.id, full: 1, fwd: (f.fwd || [1, 0, 0]).slice() };
    hab.data.prey.push(meal); f.hold = meal.id; f._mMate = null; f.gravid = { d: f.ageDays || 0 }; f.target = null;
    AI.setState(f, 'subdue', 'Turned round and seized ' + nm + ' — she is eating her mate.');
    if (AI._beginSubdue) AI._beginSubdue(hab, f);
    J(hab, 'eatenByMate', f); diary(hab, f, 'Ate her mate, ' + nm + '.');
    if (hab.game && hab.game.hab === hab && JT.UI && JT.UI.toast) JT.UI.toast('<b>' + esc(f.name) + '</b> ate her mate, ' + esc(nm) + '.');
  }
  AI.mantisEatenByMate = eatenByMate;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- laying ----
  function startLay(hab, f) {
    f._mLayCD = hab.time + 30;
    const spot = AI.chooseSpot(hab, f, 'molt');
    if (spot) { f._route = spot.route; f._routeStart = hab.time; AI.setState(f, 'mLaySeek', 'Heavy with eggs — climbing to a high twig to lay.'); return true; }
    if (f.sup && (f.sup.k === 'path' || f.sup.k === 'face')) { beginLay(hab, f); return true; }
    return false;
  }
  AI.mantisStartLay = startLay;
  function beginLay(hab, f) { f._route = null; f._mLayDur = 22 + R() * 10; AI.setState(f, 'mLay', 'Working a foamy egg case onto the twig with the tip of her abdomen.'); }
  H.mLaySeek = function (hab, f, dt) {
    const r = JT.Loco.follow(hab, f, dt, AI.speed(f) * 0.7);
    if (r === 'done' || r === 'none') beginLay(hab, f);
    else if (hab.time - (f._routeStart || 0) > 60) { f._route = null; if (f.sup && f.sup.k !== 'floor') beginLay(hab, f); else AI.setState(f, 'idle'); }
  };
  H.mLay = function (hab, f, dt) { if (f.st > f._mLayDur) layOoth(hab, f); };
  function layOoth(hab, f) {
    const S = JT.SPECIES_BY_ID[f.species] || {}; const Lf = AI.len(f); const fr = JT.Draw && JT.Draw.frame ? JT.Draw.frame(hab, f, 0.05) : { p: f.pos, f: f.fwd || [1, 0, 0], n: [0, 1, 0] };
    const pos = M.add(fr.p, M.mul(fr.f, -Lf * 0.42));
    const o = { id: JT.newId('o'), species: f.species, pos, up: fr.n.slice(), dir: fr.f.slice(), decor: f.sup && f.sup.d != null ? f.sup.d : null, sup: JT.deepClone(f.sup), age: 0, hard: false, k: (S.ooth || {}).k || 'elong', n: (S.ooth || {}).n || 30, size: Lf, mom: f.name, momId: f.id, state: 'fresh', seed: (R() * 1e6) | 0 };
    (hab.data.ooth || (hab.data.ooth = [])).push(o);
    f.gravid = null; f.layN = (f.layN || 0) + 1;
    AI.setState(f, 'idle', 'Done — a pale, foamy egg case hangs from the twig.');
    J(hab, 'oothLaid', f); diary(hab, f, 'Laid an egg case.');
    return o;
  }
  AI.mantisLayOoth = layOoth;

  // ---- per-mantis tick ----
  const update0 = AI.update;
  AI.update = function (hab, sp, dt) {
    update0.call(this, hab, sp, dt);
    if (!hab.data.spiders.includes(sp)) return;
    const st = sp.state;
    sp._mMount = M.lerp(sp._mMount || 0, (st === 'mPaired' || st === 'mMount') && sp.sex === 'm' ? AI.len(sp) * 0.2 * (st === 'mMount' ? M.clamp(sp.st / 2, 0, 1) : 1) : 0, Math.min(1, dt * 4)); if (sp._mMount < 0.01) sp._mMount = 0;
    sp._mLay = M.lerp(sp._mLay || 0, st === 'mLay' ? 1 : 0, Math.min(1, dt * 2)); if (sp._mLay < 0.003) sp._mLay = 0;
    if ((sp._mLifeT = (sp._mLifeT || R() * 3) - dt) > 0) return; sp._mLifeT = 2.5 + R();
    if (sp.sex === 'm') { if (R() < 0.4) { const f = canCourt(hab, sp); if (f) startCourt(hab, sp, f); } }
    else if (sp.gravid && (sp.ageDays || 0) - sp.gravid.d > L.LAY_DAYS && !busy(sp) && !sp.hold && (PRI[st] || 0) < 40 && !(sp._mLayCD > hab.time)) startLay(hab, sp);
  };
  const restoreL = AI.restore;
  AI.restore = function (hab, sp) { const r = restoreL.apply(this, arguments); sp._mMate = null; sp._mMount = 0; return r; };

  // ---- egg cases: harden, hatch, empty case fades ----
  function oothTick(hab, dt) {
    const os = hab.data.ooth; if (!os || !os.length) return;
    const dd = dt / DAY;
    for (const o of os.slice()) {
      o.age = (o.age || 0) + dd;
      if (o.decor != null && !hab.geoms[o.decor]) { const b = Nav.supportBelow(hab, [o.pos[0], o.pos[1] + 0.3, o.pos[2]]); o.pos = b.pos; o.decor = null; o.sup = b.sup; o.up = [0, 1, 0]; o.fallen = true; }
      if (o.state === 'fresh' && o.age >= L.HARD_DAYS) { o.state = 'hard'; o.hard = true; const mom = hab.spider(o.momId) || hab.data.spiders[0]; if (mom) J(hab, 'oothHard', mom); if (mom && mom.id === o.momId) diary(hab, mom, 'Her egg case has hardened.'); }
      if (o.state === 'hard' && o.age >= L.HATCH_DAYS) startHatch(hab, o);
      if (o.state === 'hatching') { const hv = (hab._mHatch || []).find(h => h.o === o); if (!hv) finishHatch(hab, o); else { hv.t += dt; if (hv.t > 9 && !hv.done) { hv.done = true; finishHatch(hab, o); } } }
      if (o.state === 'empty' && o.age - (o.emptyAt || o.age) > L.EMPTY_DAYS) hab.data.ooth = hab.data.ooth.filter(x => x !== o);
    }
    if (hab._mHatch) { for (const h of hab._mHatch) if (h.o.state !== 'hatching') h.t += dt; hab._mHatch = hab._mHatch.filter(h => h.t < 22 && (hab.data.ooth || []).includes(h.o)); }
  }
  AI.mantisOothTick = oothTick;
  function startHatch(hab, o) {
    o.state = 'hatching';
    const n = Math.min(L.VIS_MAX, o.n || 30); const b = Nav.supportBelow(hab, [o.pos[0], o.pos[1] - 0.5, o.pos[2]]);
    const nym = []; for (let i = 0; i < n; i++) { const a = R() * 6.283, r = 6 + R() * 22; let x = b.pos[0] + Math.cos(a) * r, z = b.pos[2] + Math.sin(a) * r; const c = Nav.clampInside(hab, x, z, 3); nym.push({ dl: i * 0.16 + R() * 0.2, th: 2 + R() * 4, hang: 1 + R() * 1.5, to: [c[0], 0, c[1]], ph: R() * 6.28, run: 2.5 + R() * 3 }); }
    (hab._mHatch || (hab._mHatch = [])).push({ o, t: 0, floor: b.pos.slice(), nym });
  }
  AI.mantisStartHatch = startHatch;
  function finishHatch(hab, o) {
    if (o.state !== 'hatching') return null; o.state = 'empty'; o.emptyAt = o.age;
    const g = hab.game; const S = JT.SPECIES_BY_ID[o.species]; const total = o.n || 30;
    const cap = hab.dims.cap || 2; const per = JT.PER_SPECIES || 2;
    const same = hab.data.spiders.filter(s => s.species === o.species).length;
    const keep = Math.max(0, Math.min(cap - hab.data.spiders.length, per - same, total));
    const b = Nav.supportBelow(hab, [o.pos[0], o.pos[1] - 0.5, o.pos[2]]); const kept = [];
    for (let i = 0; i < keep; i++) { const a = R() * 6.283; const c = Nav.clampInside(hab, b.pos[0] + Math.cos(a) * (5 + R() * 10), b.pos[2] + Math.sin(a) * (5 + R() * 10), 3); const nb = Nav.supportBelow(hab, [c[0], hab.dims.h, c[1]]); const sp = hab.addSpider(o.species, { stage: 1, pos: nb.pos, sup: nb.sup, sat: 0.6 }); if (sp) kept.push(sp); else { const last = hab.data.spiders[hab.data.spiders.length - 1]; if (last && last.species === o.species && last.stage === 1) kept.push(last); } }
    for (const sp of kept) { sp.thought = 'Just hatched — a tiny nymph, already looking for something to catch.'; sp.born = 'hatched'; diary(hab, sp, 'Hatched from ' + (o.mom ? o.mom + '\u2019s' : 'an') + ' egg case.'); }
    let cupN = 0;
    if (g && g.state) { const cup = g.state.cup || (g.state.cup = []); const room = Math.max(0, Math.min(L.CUP_MAX, total - keep, 8 - cup.length));
      for (let i = 0; i < room; i++) { const sp = AI.create(hab, o.species, { stage: 1, pos: [0, 0, 0], sup: { k: 'floor' }, sat: 0.6 }); for (const k of Object.keys(sp)) if (k[0] === '_') delete sp[k]; sp.born = 'hatched'; cup.push(sp); cupN++; diary(hab, sp, 'Hatched from ' + (o.mom ? o.mom + '\u2019s' : 'an') + ' egg case — waiting in the holding cup.'); } }
    const rel = Math.max(0, total - keep - cupN);
    const mom = hab.spider(o.momId); const who = kept[0] || mom || hab.data.spiders[0];
    if (who) J(hab, 'hatchDay', who); if (mom) diary(hab, mom, 'Her egg case hatched: ' + total + ' nymphs.');
    const nm = S ? S.name.toLowerCase() : 'mantis';
    const msg = 'Hatching day! ' + total + ' tiny ' + nm + ' nymphs streamed out of the egg case. ' + (keep ? keep + ' stayed in this tank' : 'None stayed (the tank is full)') + (cupN ? ', ' + cupN + ' went to the holding cup' : '') + (rel ? ' and ' + rel + ' were released.' : '.');
    o.result = { total, keep, cup: cupN, released: rel };
    if (g && g.hab === hab && JT.UI && JT.UI.toast) JT.UI.toast(msg);
    hab._mLastHatch = o.result;
    return o.result;
  }
  AI.mantisFinishHatch = finishHatch;
  if (JT.Habitat) {
    const HP = JT.Habitat.prototype, up0 = HP.update;
    HP.update = function (dt, full) { up0.apply(this, arguments); if (dt > 0) oothTick(this, dt); };
  }
})(typeof window !== 'undefined' ? window : globalThis);
