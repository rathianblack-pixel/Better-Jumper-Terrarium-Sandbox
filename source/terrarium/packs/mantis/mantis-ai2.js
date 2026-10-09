/* Mantis Terrarium pack v1.2 — species signatures and behaviour polish (wraps JT.SpiderAI after mantis-ai.js).
   Species (S.mflags): playDead (dead leaf), box (boxer), display:'buzz' + noFly (budwing), display:'flower' + hangs
   (devil's flower), flyOnly + rockWalk + hangs (violin), bigPrey + curious (giant Asian), flat (stick), sprint (bark),
   slow, night, morph.
   Polish for every mantis: peering before a strike, missed strikes, swaying in the breeze, eye wiping, sipping
   droplets (nymphs pick the tiny beads), head-first finger tracking, a night shift for night species, cold-dark
   colours that brighten as it warms, colour shift toward its surroundings at a molt (morph species), old age. */
(function (root) {
  'use strict';
  const JT = root.JT, AI = JT.SpiderAI, H = AI.H, M = JT.M, Nav = JT.Nav, PRI = AI.PRI;
  const R = () => JT.R();
  const FL = (sp) => ((JT.SPECIES_BY_ID[sp.species] || {}).mflags) || {};
  const DAY = JT.DAY || 480;
  const MOLTH = new Set(['moltSeek', 'moltSilk', 'premolt', 'molting', 'postMolt']);
  const CALM = new Set(['idle', 'explore', 'lookout', 'groom', 'rest', 'watch', 'look', 'stretch', 'homeSeek', 'postFeed', 'mHang']);
  const preyDef = (p) => p && JT.PREY_BY_ID[p.type];
  const preyNm = (p) => p && p.type === 'jumperMeal' ? 'mantis' : ((preyDef(p) || {}).name || 'prey').toLowerCase();
  const J = (hab, id, sp, soft) => hab.event('journal', { id, sp, soft: !!soft });
  const watched = (hab) => !!(hab.game && hab.game.hab === hab);
  AI.MFL = FL;

  // ---- new states ----
  Object.assign(PRI, { mDead: 62, mBox: 20, mHang: 8, mHangSeek: 9, mMiss: 30 });
  const LINES = { mDead: 'Playing dead', mBox: 'Boxing', mHang: 'Hanging like a flower', mHangSeek: 'Climbing to hang', mMiss: 'Missed — regrouping' };
  AI.M_LINES = LINES;
  const line0 = AI.stateLine;
  AI.stateLine = function (hab, sp) {
    if (LINES[sp.state]) return LINES[sp.state];
    if (sp.state === 'display' && FL(sp).display === 'buzz') return 'Buzzing its wing stubs';
    if (sp.state === 'display' && FL(sp).display === 'flower') return 'Flower display';
    if (sp.state === 'cleanEyes') return 'Wiping its eyes';
    if (sp.state === 'drink') return 'Sipping a droplet';
    return line0.apply(this, arguments);
  };
  const restore0 = AI.restore;
  AI.restore = function (hab, sp) {
    const st = sp.state; if (/^m[A-Z]/.test(st || '')) { sp.state = 'idle'; sp.st = 0; }
    restore0.apply(this, arguments);
    if (st === 'mDead') sp.thought = 'Settling in and looking around.';
  };

  // on bark: a climbable face (trunk, slab, cork wall) or a thick barky branch
  function onBark(hab, sp) {
    const u = sp.sup; if (!u || !hab) return false; if (u.k === 'face') return true; if (u.k !== 'path' || u.d == null) return false;
    const g = hab.geoms[u.d]; const pa = g && g.paths[u.p]; if (!pa) return false; if (pa.kind === 'face') return true;
    return (pa.r || 0) >= 2 && !!(JT.Biomes && JT.Biomes.tags(g.def).bark);
  }
  AI.mantisOnBark = onBark;
  // ---- movement: slow species, bark sprinters, old age ----
  const speed0 = AI.speed;
  AI.speed = function (sp) {
    const f = FL(sp); let k = f.slow || 1;
    if (f.sprint && onBark(AI._mHab, sp)) k *= 1.8; // bursts up the bark
    if (sp._mAge) k *= 1 - 0.3 * sp._mAge;
    return speed0(sp) * k;
  };
  // budwing: stubby wings, never flies
  const caps0 = AI.caps;
  AI.caps = function (sp, carry, hunt) {
    if (!FL(sp).noFly) return caps0(sp, carry, hunt);
    const fu = sp._mFlyUntil; sp._mFlyUntil = 0; try { return caps0(sp, carry, hunt); } finally { sp._mFlyUntil = fu; }
  };
  // violin: only things that fly (unless starving); giant Asian: the biggest prey
  const hf0 = AI.huntableFor;
  AI.huntableFor = function (sp, d) { if (!hf0(sp, d)) return false; if (FL(sp).flyOnly && d && !d.fly && sp.sat > 0.12) return false; return true; };
  const size0 = AI.sizeLimit;
  AI.sizeLimit = function (sp) { const k = size0(sp); const b = FL(sp).bigPrey; return b && sp.stage >= 3 ? k + b : k; };

  // ---- peering: a few side-to-side head rocks to judge the distance, then the strike ----
  const crouch0 = H.crouch;
  H.crouch = function (hab, sp, dt) {
    const e = AI.targetEnt(hab, sp);
    if (e && sp._mPeerId !== e.id) { sp._mPeerId = e.id; sp._mPeerT = e.sup && e.sup.k === 'air' ? 0 : 0.55 + R() * 0.6; if (sp._mPeerT) { sp.thought = 'Rocking its head side to side — measuring the distance.'; J(hab, 'peering', sp, true); } }
    if (sp._mPeerT > 0) { sp._mPeerT -= dt; sp.st = Math.max(0, sp.st - dt); }
    return crouch0(hab, sp, dt);
  };

  // ---- missed strikes: some strikes close on nothing (fast or flying prey, young nymphs, a long reach) ----
  function rollMiss(hab, sp, A) {
    A._mm = 1; const e = AI.targetEnt(hab, sp); if (!e || !sp.target || sp.target.kind !== 'prey') return;
    const d = preyDef(e) || {}; const L = AI.len(sp); const v = e._vel ? M.len(e._vel) : 0;
    let p = 0.07 + (d.fly ? 0.12 : 0) + (e.sup && e.sup.k === 'air' ? 0.12 : 0) + M.clamp((v - 3) * 0.02, 0, 0.12) + ((sp.stage | 0) <= 2 ? 0.1 : 0) + (M.dist(A.from, e.pos) > L * 0.9 ? 0.07 : 0) - (sp.traits.patience - 0.5) * 0.08 + (sp._mAge || 0) * 0.1;
    if (sp._mForceMiss) { p = sp._mForceMiss; sp._mForceMiss = 0; }
    if (sp._mAge) A.dur *= 1 + 0.4 * sp._mAge;
    if (R() < p) { A._miss = e.id; JT.PreyAI.escape(hab, e, sp, true); }
  }
  const pounce0 = H.pounce;
  H.pounce = function (hab, sp, dt) {
    const A = sp._air;
    if (!A || !A._miss) return pounce0(hab, sp, dt);
    const tg = sp.target; sp.target = null; const mem = sp.mem.misses;
    pounce0(hab, sp, dt);
    if (sp.state === 'pounce') { sp.target = tg; return; }
    sp.target = tg; const e = tg && (hab.preyById(tg.id)); const nm = preyNm(e);
    if (e && e.type) { const pt = sp.mem.ptype || (sp.mem.ptype = {}); const r = pt[e.type] || (pt[e.type] = { c: 0, m: 0 }); r.m++; }
    AI.dropTarget(hab, sp); void mem;
    if (sp.state === 'idle' || sp.state === 'rest' || sp.state === 'assess') { AI.setState(sp, 'mMiss', 'Missed! The ' + nm + ' got away — a short pause before it settles back to wait.'); sp._mMissDur = 1.2 + R() * 1.4; }
    else if (sp.state === 'fall') sp._afterFall = 'mMiss';
    sp._mMissN = (sp._mMissN || 0) + 1; J(hab, 'missedStrike', sp);
  };
  H.mMiss = function (hab, sp, dt) { if (sp.st > (sp._mMissDur || 1.5)) AI.setState(sp, 'lookout', 'Still again, watching for the next chance.'); };

  // ---- play dead (dead leaf mantis): drops and lies flat like a fallen leaf, then slowly recovers ----
  function startDead(hab, sp, why) {
    sp._mDeadCD = hab.time + 40 + R() * 30; sp._route = null; AI.dropTarget(hab, sp); sp._mDeadDur = 7 + R() * 7;
    sp.thought = why + ' — drops and lies still, legs tucked: just a dead leaf.';
    J(hab, 'playDead', sp);
    if (sp.sup && sp.sup.k !== 'floor' && sp.sup.k !== 'air' && !sp._air) {
      const b = Nav.supportBelow(hab, [sp.pos[0], sp.pos[1] - 0.6, sp.pos[2]]);
      const drop = sp.pos[1] - b.pos[1];
      if (drop > 1.5 && b.sup && b.sup.k !== 'air') { sp._air = { from: sp.pos.slice(), to: b.pos.slice(), t: 0, dur: 0.22 + drop / 140, apex: 0, land: JT.deepClone(b.sup) }; sp.sup = { k: 'air' }; sp._afterFall = 'mDead'; AI.setState(sp, 'fall', sp.thought); return; }
    }
    AI.setState(sp, 'mDead', sp.thought);
  }
  AI.mantisPlayDead = startDead;
  H.mDead = function (hab, sp, dt) {
    if (sp.st > sp._mDeadDur) { if (!sp._mRise) { sp._mRise = 1; sp.thought = 'Slowly rolls back onto its feet.'; } if (sp.st > sp._mDeadDur + 1.6) { sp._mRise = 0; AI.setState(sp, 'lookout', 'Up again, swaying gently like a leaf.'); } }
  };

  // ---- boxing (boxer mantis): pumps its forelegs at a nearby mantis or your finger ----
  function startBox(hab, sp, pos, who) { sp._mBoxCD = hab.time + 14 + R() * 10; sp._watchPos = pos.slice(); sp._mBoxDur = 2 + R() * 1.6; AI.setState(sp, 'mBox', 'Boxing at ' + who + ' — forelegs pumping up and down.'); J(hab, 'boxing', sp); }
  H.mBox = function (hab, sp, dt) { if (sp._watchPos) faceSlow(sp, sp._watchPos, dt, 2); if (sp.st > sp._mBoxDur) { sp._watchPos = null; AI.setState(sp, 'lookout'); } };

  // ---- hanging (devil's flower, violin): climbs to a high tip and hangs upside-down, swaying like a flower ----
  function startHangSeek(hab, sp) {
    sp._mHangCD = hab.time + 45 + R() * 40;
    const spot = AI.chooseSpot(hab, sp, 'molt'); if (!spot) return false;
    sp._route = spot.route; sp._routeStart = hab.time; sp._mHangGoal = spot.node.pos.slice();
    AI.setState(sp, 'mHangSeek', FL(sp).display === 'flower' ? 'Climbing to a high tip to hang like a flower.' : 'Climbing to a high twig to hang and wait.');
    return true;
  }
  AI.mantisHangSeek = startHangSeek;
  function beginHang(hab, sp) {
    const L = AI.len(sp); sp._route = null; sp._mPiv = null; sp._mNh = null;
    if (!(sp.sup && sp.sup.k === 'path' && AI.clearBelow(hab, sp.pos) > L * 1.4)) { AI.setState(sp, 'idle'); return; }
    sp._mHangOK = true; sp._mHangDur = 40 + R() * 50;
    AI.setState(sp, 'mHang', FL(sp).display === 'flower' ? 'Hanging upside-down from the tip, swaying gently — a flower on its stem.' : 'Hanging patiently beneath the twig, waiting for something to fly by.');
    J(hab, 'flowerHang', sp);
  }
  AI.mantisBeginHang = beginHang;
  H.mHangSeek = function (hab, sp, dt) {
    const r = JT.Loco.follow(hab, sp, dt, AI.speed(sp) * 0.75);
    if (r === 'done' || r === 'none') beginHang(hab, sp);
    else if (hab.time - (sp._routeStart || 0) > 40) { sp._route = null; AI.setState(sp, 'idle'); }
  };
  H.mHang = function (hab, sp, dt) { if (sp.st > sp._mHangDur) AI.setState(sp, 'idle', 'Climbs back up onto the twig.'); };

  // ---- drinking: nymphs choose the tiny beads; the head lowers and the drop shrinks away ----
  const drink0 = H.drink;
  H.drink = function (hab, sp, dt) {
    const dr = sp._drink && sp._drink.id ? hab.data.drops.find(d => d.id === sp._drink.id) : null;
    if (dr && !dr.pool) { if (dr._r0 == null) dr._r0 = dr.r || 1; dr.r = Math.max(0.15, dr._r0 * (1 - M.clamp(sp.st / 3, 0, 1) * 0.85)); }
    const tiny = dr && dr.tiny; const st0 = sp.state;
    if (sp.st < dt * 1.5) sp.thought = tiny ? 'Head lowered to a tiny bead of water, sipping.' : 'Head lowered to the droplet, sipping.';
    drink0(hab, sp, dt);
    if (st0 === 'drink' && sp.state !== 'drink' && tiny && (sp.stage | 0) <= 2) J(hab, 'beadSip', sp);
  };
  function preferTiny(hab, sp) {
    const cur = sp._drink; if (!cur || !cur.id) return;
    const cd = hab.data.drops.find(d => d.id === cur.id); if (cd && cd.tiny) return;
    let best = null, bd = 1e9; for (const d of hab.data.drops) { if (!d.tiny) continue; const k = M.dist(d.pos, sp.pos); if (k < bd) { bd = k; best = d; } }
    if (!best || bd > M.dist(cur.pos, sp.pos) + 45) return;
    const r = Nav.route(hab, sp.sup, sp.pos, best.sup, best.pos, AI.caps(sp)); if (!r) return;
    sp._route = r; sp._routeStart = hab.time; sp._drink = { pos: best.pos, sup: best.sup, id: best.id, decor: best.decor, pool: false };
    sp.thought = 'Thirsty — picking out one of the tiny water beads.';
  }

  // ---- finger tracking: the head turns first, then the body follows slowly ----
  function faceSlow(sp, target, dt, rate) {
    const d = M.sub(target, sp.pos); d[1] = 0; if (M.len(d) < 1e-3) return; const want = M.norm(d); const f = sp.fwd || [1, 0, 0]; const k = Math.min(1, dt * rate);
    const nf = M.norm([M.lerp(f[0], want[0], k), sp.sup && sp.sup.k === 'path' ? f[1] * (1 - k) : 0, M.lerp(f[2], want[2], k)]); if (M.finite3(nf)) sp.fwd = nf;
  }
  function headFirst(hab, sp, dt, pos) {
    const a = AI.aimResidual(hab, sp, pos); sp._gaze = M.clamp(a, -0.75, 0.75) / 0.3; sp._gazeT = 0.5;
    if (Math.abs(a) < 0.3) { sp._mTurnT = 0; return; }
    sp._mTurnT = (sp._mTurnT || 0) + dt; if (sp._mTurnT > 0.45) faceSlow(sp, pos, dt, 0.9); // the body turns only after the head has
  }
  for (const k of ['fingerWatch', 'curious', 'display', 'watch']) {
    const h0 = H[k]; if (!h0) continue;
    H[k] = function (hab, sp, dt) {
      const f = hab.finger; const live = f && f.pos && hab.time - f.t < 2 && sp._fingerT != null && hab.time - sp._fingerT < 2.5;
      const w = sp._watchPos; if (!w || sp._route) return h0(hab, sp, dt);
      sp._watchPos = null; h0(hab, sp, dt); if (sp.state === k && sp._watchPos == null) sp._watchPos = live && k !== 'watch' ? f.pos.slice() : w;
      if (sp._watchPos && sp.state === k) headFirst(hab, sp, dt, sp._watchPos);
    };
  }

  // ---- colours: cold-dark mornings, molt colour morphs, old age ----
  const GREEN = new Set(['rainforest', 'orchidgarden', 'tropical', 'meadow', 'classic', 'cloud', 'mossy', 'jungle']);
  const BROWN = new Set(['desert', 'dryleaf', 'oldbark', 'heath', 'prairie', 'scrub', 'savanna', 'arid']);
  function biomeTone(hab) { const id = JT.Biomes && JT.Biomes.id ? JT.Biomes.id(hab) : 'classic'; return BROWN.has(id) ? 'brown' : GREEN.has(id) ? 'green' : null; }
  function baseTone(S) { const c = (S.pal && (S.pal.body || S.pal.abd)) || '#888888'; const h = c.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16); return g > r + 8 ? 'green' : 'brown'; }
  function moltColour(hab, sp) {
    if (!FL(sp).morph) return; const want = biomeTone(hab); if (!want) return; const S = JT.SPECIES_BY_ID[sp.species]; const base = baseTone(S);
    const mo = sp.morph || null; const a0 = mo ? mo.a : 0; let next;
    if (want === base) next = mo && mo.a > 0 ? { k: mo.k, a: Math.max(0, mo.a - 0.5) } : null; // back toward its natural colours
    else next = mo && mo.k === want ? { k: want, a: Math.min(1, mo.a + 0.5) } : mo && mo.a > 0.25 ? { k: mo.k, a: mo.a - 0.5 } : { k: want, a: 0.5 };
    if (next && next.a <= 0.02) next = null; sp.morph = next;
    const a1 = next ? next.a : 0; if (Math.abs(a1 - a0) < 0.05) return;
    const word = next ? (next.k === 'green' ? 'greener' : 'browner') : (base === 'green' ? 'greener' : 'browner');
    sp.thought = 'Out of its old skin a little ' + word + ', closer to its surroundings.';
    if (hab.game && hab.game.diary) hab.game.diary(sp, 'Molted into ' + word + ' colours to match the ' + ((JT.Biome && JT.Biome.of(hab) && JT.Biome.of(hab).name) || 'tank').toLowerCase() + '.');
    J(hab, 'colourShift', sp);
  }
  AI.mantisMoltColour = moltColour;
  function warmth(hab, sp, dt) {
    const dl = hab.daylight(); const tod = hab.game && hab.game.tod ? hab.game.tod() : 0.4; const warm = hab.warmthAt ? hab.warmthAt(sp.pos) : 0;
    let tgt = dl < 0.3 ? 0.85 : tod < 0.34 ? 0.55 : 0; if (warm > 0.25 || sp.state === 'bask') tgt = 0;
    const c0 = sp._mCold == null ? tgt : sp._mCold; const rate = tgt < c0 ? (sp.state === 'bask' ? 0.05 : 0.012) : 0.008;
    sp._mCold = c0 + M.clamp(tgt - c0, -rate * dt, rate * dt);
    if (c0 > 0.5) sp._mWasCold = true;
    if (sp.state === 'bask' && sp._mWasCold && sp._mCold < 0.2 && tod < 0.5) { sp._mWasCold = false; sp.thought = 'Warmed through under the lamp — its colours are brighter now.'; J(hab, 'morningBask', sp); }
  }

  // ---- the per-tick wrapper ----
  const update0 = AI.update;
  AI.update = function (hab, sp, dt) {
    const f = FL(sp), L = AI.len(sp), stg0 = sp.stage, s0 = sp.state, hold0 = sp.hold;
    if (f.noFly && sp._air && sp._air.mode === 'jump') sp._air._m = 1;
    // giant Asian: barely bothered by your finger while eating
    if (f.curious && sp.hold && hab.finger && hab.finger.id !== sp._mPokeSeen && R() > 0.15) sp._mPokeSeen = hab.finger.id;
    // night shift: night species stay up after dark while they are not full
    let dlOwn = null; const dl = hab.daylight();
    if (f.night && dl < 0.2 && sp.sat < 0.9) { dlOwn = Object.getOwnPropertyDescriptor(hab, 'daylight'); const d0 = hab.daylight; hab.daylight = function () { return Math.max(0.3, d0.call(this)); }; }
    try { update0.call(this, hab, sp, dt); }
    finally { if (dlOwn) Object.defineProperty(hab, 'daylight', dlOwn); else if (f.night && dl < 0.2 && sp.sat < 0.9) delete hab.daylight; }
    const st = sp.state, fresh = hab.finger && hab.finger.pos && hab.time - hab.finger.t < 0.6 ? hab.finger : null;
    if (f.noFly) sp._mFlyUntil = 0;
    // a strike just launched: roll for a miss
    if (st === 'pounce' && sp._air && sp._air.straight && !sp._air._mm) rollMiss(hab, sp, sp._air);
    // a catch: species / night journal moments
    if (sp.hold && sp.hold !== hold0 && (st === 'subdue' || st === 'secure' || st === 'feed' || st === 'fall')) {
      const p = hab.preyById(sp.hold); const d = preyDef(p) || {};
      if (f.flyOnly && d.fly) J(hab, 'violinFlyer', sp);
      if (f.night && dl < 0.2 && (d.fly || /moth/.test(p && p.type || ''))) { sp.thought = 'A night hunter: caught a ' + preyNm(p) + ' in the dark.'; J(hab, 'nightShift', sp); }
    }
    if (st !== s0) {
      if (st === 'drinkSeek' && (sp.stage | 0) <= 2) preferTiny(hab, sp);
      // dead leaf: startled → plays dead instead of running or displaying
      if (f.playDead && (st === 'flee' || st === 'display' || st === 'avoid' || (st === 'fingerWatch' && fresh && fresh.fast)) && !(sp._mDeadCD > hab.time) && (st !== 'display' || R() < 0.75)) startDead(hab, sp, fresh ? 'Startled by your finger' : 'Startled');
      else if (st === 'display') {
        if (f.display === 'buzz') { sp._mBuzzOn = true; sp.thought = 'Wing stubs buzzing — a dry, clicking rattle!'; J(hab, 'wingBuzz', sp); if (watched(hab)) rattle(); }
        else if (f.display === 'flower') { sp.thought = 'Rears up and spreads its flower-coloured forelegs and wings — a sudden bloom!'; J(hab, 'flowerDisplay', sp); }
        if (sp._mHangOK) sp._mHangOK = false;
      }
      if (s0 === 'display') sp._mBuzzOn = false;
      if (s0 === 'mHang' && st !== 'mHang' && !MOLTH.has(st)) { sp._mHangOK = false; sp._mPiv = null; }
    }
    if (sp.state !== 'mHang' && !MOLTH.has(sp.state) && sp._mHangOK) { sp._mHangOK = false; sp._mPiv = null; }
    const st2 = sp.state, calm = CALM.has(st2) && !sp.hold && !sp._air;
    // boxer: pump the forelegs at a mantis or a finger coming close
    if (f.box && (calm || ((st2 === 'curious' || st2 === 'fingerWatch' || st2 === 'watch') && !sp.hold && !sp._air)) && st2 !== 'mHang' && !(sp._mBoxCD > hab.time) && (sp._mBoxT = (sp._mBoxT || 0) - dt) <= 0) {
      sp._mBoxT = 0.5;
      if (fresh && M.dist(fresh.pos, sp.pos) < 34) startBox(hab, sp, fresh.pos, 'your finger');
      else for (const o of hab.data.spiders) { if (o !== sp && M.dist(o.pos, sp.pos) < L * 3 + AI.len(o) + 8 && !MOLTH.has(o.state)) { startBox(hab, sp, o.pos, o.name); break; } }
    }
    // hangers: now and then climb up to hang
    if (f.hangs && (st2 === 'idle' || st2 === 'lookout' || st2 === 'rest') && sp.sat > 0.25 && !(sp._mHangCD > hab.time) && (sp.stage | 0) >= 2 && sp.soft <= 0) {
      if (sp._mHangCD == null) sp._mHangCD = hab.time + 8 + R() * 20; else if (R() < 0.5) startHangSeek(hab, sp); else sp._mHangCD = hab.time + 15;
    }
    // giant Asian: comes right up to the glass to stare at your finger
    if (f.curious && st2 === 'curious' && fresh && M.dist(sp.pos, fresh.pos) < L * 1.5 + 12 && !(sp._mStareJ > hab.time)) { sp._mStareJ = hab.time + 60; sp.thought = 'Right up at the glass, staring at your finger with its big eyes.'; J(hab, 'giantStare', sp); }
    if (f.curious && st2 === 'fingerWatch' && fresh && !fresh.fast && R() < 0.3) { sp._fingerT = hab.time; AI.setState(sp, 'curious', 'Turns its whole head toward your finger, curious.'); }
    // eye wiping (now and then while resting)
    if (calm && (st2 === 'idle' || st2 === 'rest' || st2 === 'lookout') && (sp._mEyeT = (sp._mEyeT == null ? 40 + R() * 60 : sp._mEyeT) - dt) <= 0) {
      sp._mEyeT = 70 + R() * 90; AI.setState(sp, 'cleanEyes', 'Drawing a foreleg over one big eye, then the other.'); J(hab, 'eyeWipe', sp, true);
    }
    // a molt just finished: colour shift toward the surroundings
    if (sp.stage !== stg0 && sp.stage > stg0) moltColour(hab, sp);
    // old age (no death: only slower and a little faded)
    sp._mAge = (sp.stage | 0) >= 5 ? M.clamp(((sp.adultDays || 0) - 16) / 12, 0, 1) : 0;
    if (sp._mAge > 0.3 && !sp.elderNoted) { sp.elderNoted = true; if (hab.game && hab.game.diary) hab.game.diary(sp, 'Getting old: slower now, its colours a little faded.'); J(hab, 'elder', sp); }
    warmth(hab, sp, dt);
    // ---- animation drivers for the drawing ----
    const k8 = Math.min(1, dt * 8), k4 = Math.min(1, dt * 4);
    const deadT = st2 === 'mDead' && !sp._mRise ? 1 : (st2 === 'fall' && sp._afterFall === 'mDead') ? 0.6 : 0;
    sp._mDead = M.lerp(sp._mDead || 0, deadT, Math.min(1, dt * (deadT ? 7 : 1.4))); if (sp._mDead < 0.003) sp._mDead = 0;
    const bark = f.sprint && onBark(hab, sp); const onTwig = sp.sup && (sp.sup.k === 'path' || bark);
    const still = !sp._moving && (st2 === 'idle' || st2 === 'rest' || st2 === 'lookout' || st2 === 'sleep' || st2 === 'watch');
    if (still) sp._mStillT = (sp._mStillT || 0) + dt; else sp._mStillT = 0;
    const flatT = (f.flat && onTwig && sp._mStillT > 2.5) || (bark && sp._mStillT > 0.6) ? 1 : 0;
    sp._mFlatK = M.lerp(sp._mFlatK || 0, flatT, Math.min(1, dt * (f.sprint ? 5 : 1.2))); if (sp._mFlatK < 0.003) sp._mFlatK = 0;
    if (flatT && sp._mFlatK > 0.9 && !(sp._mFlatJ > hab.time)) { sp._mFlatJ = hab.time + 120; if (f.flat) { sp.thought = 'Pressed flat along the twig, forelegs stretched out in front — just another stick.'; J(hab, 'stickFlat', sp); } }
    if (bark && sp._moving && !(sp._mSprJ > hab.time)) { sp._mSprJ = hab.time + 90; sp.thought = 'A quick dash up the bark — then frozen flat again.'; J(hab, 'barkSprint', sp); }
    sp._mBuzz = M.lerp(sp._mBuzz || 0, st2 === 'display' && sp._mBuzzOn ? 1 : 0, k8);
    sp._mBox = M.lerp(sp._mBox || 0, st2 === 'mBox' ? 1 : 0, k8);
    sp._mSip = M.lerp(sp._mSip || 0, st2 === 'drink' ? 1 : 0, k4);
    sp._mEyeW = M.lerp(sp._mEyeW || 0, st2 === 'cleanEyes' ? 1 : 0, k4);
    sp._mPeer = M.lerp(sp._mPeer || 0, st2 === 'crouch' && sp._mPeerT > 0 ? 1 : 0, Math.min(1, dt * 10));
    sp._mHangSway = M.lerp(sp._mHangSway || 0, st2 === 'mHang' ? (f.display === 'flower' ? 1 : 0.6) * (1 + windK(hab) * 0.8) : 0, Math.min(1, dt * 1.5));
    for (const k of ['_mBuzz', '_mBox', '_mSip', '_mEyeW', '_mPeer', '_mHangSway']) if (sp[k] < 0.003) sp[k] = 0;
    // breeze: rocks in time with the swaying stems (the same spring as the decor)
    const W = hab._mWind; const wk = windK(hab);
    if (W && (wk > 0 || Math.abs(W.x) > 0.002) && !sp._air && sp._mDead < 0.3 && !MOLTH.has(st2)) {
      const kk = f.playDead || f.display === 'flower' ? 1.8 : 1; sp._mRock = M.clamp(W.x * 5.5 * kk, -1.5, 1.5);
      if (wk > 0 && Math.abs(sp._mRock) > 0.35 && calm && !(sp._mBreezeJ > hab.time)) { sp._mBreezeJ = hab.time + 200; sp.thought = 'Rocking gently in time with the breeze, like a leaf.'; J(hab, 'breezeSway', sp, true); }
    } else sp._mRock = M.lerp(sp._mRock || 0, 0, k4);
    if (Math.abs(sp._mRock) < 0.002) sp._mRock = 0;
  };
  function windK(hab) { const w = hab.data && (hab.data.bev || hab.data.wx); return w && w.id === 'wind' ? 1 : 0; }
  AI.mantisWindK = windK;
  function rattle() {
    const A = JT.Audio; if (!A || !A.started || !A.noise) return;
    for (let i = 0; i < 16; i++) A.noise('effects', 0.016, { f: 3400 + (i % 3) * 500, q: 4, vol: 0.06 * (1 - i / 22), att: 0.002, delay: i * 0.032 });
  }
  AI.mantisRattle = rattle;
})(typeof window !== 'undefined' ? window : globalThis);
