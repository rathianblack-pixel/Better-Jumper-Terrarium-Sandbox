/* Mantis Terrarium pack — behaviour layer over the shared critter AI (stage 3).
   Everything here wraps or replaces exported pieces of JT.SpiderAI; the shared engine files stay untouched.
   - no silk: no draglines, retreats, hammocks or dangling (AI.NO_SILK); sleeps motionless on a perch
   - sway-stalk (drawing) and head snaps: the head jumps between fixes instead of gliding (sp._mGz)
   - two-phase strike: a short body lunge to arm's reach, the forelegs shoot out, then sweep back in (sp._sweep)
   - eats on the spot; only carries the meal off when disturbed (another mantis, your finger, decor moved nearby)
   - molts hanging head-down from a stem or branch with room below (sp._mHangK, sp._mMoltU)
   - short flights for adults only (≤ about a third of the tank), otherwise small nymph hops
   - deimatic threat display (wings fanned, forelegs spread) when startled or approached by another mantis
   - cannibalism: a hungry mantis treats a smaller tank-mate as prey */
(function (root) {
  'use strict';
  const JT = root.JT, AI = JT.SpiderAI, H = AI.H, M = JT.M, Nav = JT.Nav;
  AI.NO_SILK = true;
  AI.nestSiteOK = () => false;
  AI.nearestNestSite = () => null;
  const R = () => JT.R();
  const MOLTH = new Set(['premolt', 'molting', 'postMolt']);
  const CALM = new Set(['idle', 'explore', 'lookout', 'groom', 'rest', 'watch', 'look', 'cleanEyes', 'stretch', 'homeSeek', 'postFeed', 'scuttle', 'fingerWatch', 'curious']);
  const adultOf = (sp) => (sp.stage | 0) >= 5;
  const preyNm = (p) => p && p.type === 'jumperMeal' ? 'mantis' : ((JT.PREY_BY_ID[p && p.type] || {}).name || 'prey').toLowerCase();

  // a mantis lunges a short way (about one body length) — never a spider's leap
  AI.jump = (sp) => (5 + AI.len(sp) * 1.05) * (0.85 + sp.traits.jump * 0.3) * (sp.soft > 0 ? 0.7 : 1);

  // ---- personality: mantises are opportunists, a smaller tank-mate is food when hungry ----
  const create0 = AI.create;
  AI.create = function () { const sp = create0.apply(this, arguments); if (sp && sp.pers) sp.pers.cannibal = 0.6 + R() * 0.35; return sp; };

  // ---- flight: adults only, now and then, short (≤ ~1/3 of the tank); never while hunting or carrying ----
  const caps0 = AI.caps;
  AI.caps = function (sp, carry, hunt) {
    const c = caps0(sp, carry, hunt); const hab = AI._mHab;
    if (hab && adultOf(sp) && !carry && !hunt && !(sp.soft > 0) && hab.time < (sp._mFlyUntil || 0)) {
      const W = hab.dims && hab.dims.w ? hab.dims.w / 3 : 50; c.jump = Math.max(c.jump, Math.min(W, AI.len(sp) * 2.2 + 20)); c.fly = true;
    }
    return c;
  };

  // ---- where to feed / molt / sleep ----
  const choose0 = AI.chooseSpot;
  function clearBelow(hab, pos) { const b = Nav.supportBelow(hab, [pos[0], pos[1] - 0.5, pos[2]]); return b && b.pos ? pos[1] - b.pos[1] : 0; }
  AI.clearBelow = clearBelow;
  /** A stem, branch or twig with at least a body length and a bit of open air below: room to hang and pull free. */
  function moltSpot(hab, sp) {
    if (!hab.nav) return null; const L = AI.len(sp); const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp));
    const others = hab.data.spiders.filter(o => o !== sp); let best = null, bs = -1e9;
    for (const n of hab.nav.nodes) {
      if (!n.sup || n.sup.k !== 'path') continue; const c = dj.dist[n.id]; if (!isFinite(c)) continue;
      const clr = clearBelow(hab, n.pos); if (clr < L * 1.6 + 1) continue; // the body hangs below, and the new (bigger) one below the old skin
      let quiet = 60; for (const o of others) quiet = Math.min(quiet, M.dist(o.pos, n.pos));
      const gp = hab.geoms[n.sup.d], pa = gp && gp.paths[n.sup.p]; const tip = pa && pa.pts.length > 1 ? M.clamp(((n.sup.s || 0) + (n.sup.t || 0)) / (pa.pts.length - 1), 0, 1) : 0.5; // prefers the high tips of twigs, stems and flower spikes
      const s = Math.min(clr / L, 3) * 2 + tip * 1.5 + M.clamp(n.pos[1] / (hab.dims.h || 100), 0, 1) * 2 + (n.perch ? 1 : 0) + Nav.coverAt(hab, n.pos) * 3 + quiet * 0.06 - c * 0.012;
      if (s > bs) { bs = s; best = n; }
    }
    if (!best) return null; const route = Nav.buildRoute(hab, dj, best.sup, best.pos); if (!route) return null;
    return { node: best, route, high: true, plant: !!(best.decor && hab.geoms[best.decor] && hab.geoms[best.decor].def.cat === 'plants') };
  }
  AI.chooseSpot = function (hab, sp, mode, carry, avoid) {
    // eats right where it caught it; only another mantis close by makes it carry the meal off (prey wandering past does not)
    if (mode === 'feed') return avoid && hab.data.spiders.some(o => o !== sp && M.dist(o.pos, avoid) < 2) ? choose0.call(this, hab, sp, mode, carry, avoid) : null;
    if (mode === 'molt') return moltSpot(hab, sp);
    if (mode === 'sleep') return choose0.call(this, hab, sp, 'roost', carry, avoid);       // any quiet perch, no retreat
    return choose0.apply(this, arguments);
  };
  /** Disturbed while eating: take the meal somewhere quieter (at most twice per meal, with a cool-down). */
  function carryAway(hab, sp, pos, why) {
    if (!sp.hold || (sp._awayN || 0) >= 2 || sp._awayCD > hab.time) return false;
    const spot = choose0(hab, sp, 'feed', true, pos); if (!spot || M.dist(spot.node.pos, sp.pos) < 4) return false;
    sp._awayN = (sp._awayN || 0) + 1; sp._awayCD = hab.time + 15; hab.event('journal', { id: 'safeMeal', sp });
    sp._route = spot.route; sp._routeStart = hab.time; sp._feedSpot = spot.node.pos.slice(); sp._carrySafe = spot.high || spot.plant;
    AI.setState(sp, 'carry', 'Disturbed by ' + why + ' — carrying the ' + preyNm(hab.preyById(sp.hold)) + ' off somewhere quieter.');
    return true;
  }
  AI.mantisCarryAway = carryAway;
  function decorKey(hab, sp) {
    const R0 = AI.len(sp) * 2 + 14; const out = [];
    for (const d of hab.data.decor) { if (d.x == null) continue; if (Math.hypot(d.x - sp.pos[0], d.z - sp.pos[2]) < R0) out.push(d.id + ':' + Math.round(d.x) + ',' + Math.round(d.z)); }
    return out.sort().join('|');
  }

  // the strike connects only once the forelegs are fully out (the body never leaves its perch for it)
  const pounce0 = H.pounce;
  H.pounce = function (hab, sp, dt) {
    const A = sp._air; if (A && A._m) { const nt = A.t + dt / A.dur; if (nt > 0.35 && nt < 0.62) A.t = 0.62 - dt / A.dur; }
    return pounce0(hab, sp, dt);
  };
  // ---- molting: hang head-down from the twig, no hammock ----
  H.moltSilk = function (hab, sp) {
    const L = AI.len(sp); sp.nest = null; sp._route = null; sp._mPiv = null; sp._mNh = null;
    sp._mHangOK = !!(sp.sup && sp.sup.k === 'path' && clearBelow(hab, sp.pos) > L * 1.5);
    AI.setState(sp, 'premolt', sp._mHangOK ? 'Hanging head-down from the stem by its back legs, very still — about to molt.' : 'No room to hang here — clinging still, about to molt.');
  };
  // the shed skin keeps the nymph's size and stage, and stays hanging on the twig (it drops off later on its own)
  const molting0 = H.molting;
  H.molting = function (hab, sp, dt) {
    const stg = sp.stage, n0 = hab.data.remains.length;
    if (sp._mHangOK && !sp._mPiv && JT.Draw && JT.Draw.frame) { const fr = JT.Draw.frame(hab, sp, 0.05); const L = AI.len(sp); let nh = [fr.f[0], 0, fr.f[2]]; if (Math.hypot(nh[0], nh[2]) < 0.2) nh = [fr.n[0], 0, fr.n[2]]; if (Math.hypot(nh[0], nh[2]) < 0.1) nh = [1, 0, 0]; sp._mNh = M.norm(nh); sp._mPiv = M.add(fr.p, M.mul(fr.f, -L * 0.24)); }
    molting0(hab, sp, dt);
    if (sp.stage !== stg) { const r = hab.data.remains[hab.data.remains.length - 1]; if (r && r.cat === 'exuvia' && hab.data.remains.length >= Math.min(40, n0)) { r.stage = stg; if (sp._mHangOK && sp._mPiv && r.sup && r.sup.k === 'path') r.hang = { piv: sp._mPiv.slice(), nh: (sp._mNh || [1, 0, 0]).slice() }; } if (sp._mHangOK) hab.event('journal', { id: 'hangMolt', sp }); }
  };
  const postMolt0 = H.postMolt;
  H.postMolt = function (hab, sp, dt) { sp.nest = null; postMolt0(hab, sp, dt); if (sp.state !== 'postMolt') { sp._mHangOK = false; if (sp.state === 'stretch') sp.thought = 'Climbing back up onto its stem and stretching its new legs.'; } };
  // no retreats are ever kept (sleeping and molting happen out in the open)
  const nests0 = AI.updateNests;
  AI.updateNests = function (hab, dt) { if (hab.data.nests && hab.data.nests.length) { hab.data.nests.length = 0; for (const s of hab.data.spiders) s.nest = null; } };
  void nests0;

  // ---- no mesh lid: strip it from saves made with the stage-4 build ----
  if (JT.Habitat) {
    const HP = JT.Habitat.prototype, rb0 = HP.rebuild;
    HP.rebuild = function () { const d = this.data; if (d && d.decor && d.decor.some(x => x.type === 'meshlid')) d.decor = d.decor.filter(x => x.type !== 'meshlid'); return rb0.apply(this, arguments); };
  }
  // ---- thoughts: no silk talk ----
  const THOUGHTS = [
    [/Turning slowly on the spot, spinning a silk retreat for the night\./, 'Settling motionless on its perch for the night.'],
    [/Night is falling — heading to a sheltered retreat\./, 'Night is falling — heading for a quiet perch.'],
    [/Pre-molt — climbing to the safest high retreat\./, 'Pre-molt — climbing to a stem with room to hang below.'],
    [/Pre-molt — no high shelter here, heading for a quiet sheltered refuge\./, 'Pre-molt — looking for somewhere to hang.'],
    [/Pre-molt — weaving a molting hammock right here\./, 'Pre-molt — settling where it is.'],
    [/Waking up and stretching\./, 'Waking up — a slow stretch of the forelegs.'],
    [/silk retreat|silk hammock|molting hammock|retreat/g, 'perch'],
    [/dragline/g, 'grip'],
  ];
  function fixThought(sp) { const t = sp.thought; if (!t || t === sp._mTh) return; let u = t; for (const [re, s] of THOUGHTS) if (re.test(u)) { u = u.replace(re, s); if (!re.global) break; } sp.thought = u; sp._mTh = u; }

  // ---- the per-tick wrapper ----
  const update0 = AI.update;
  AI.update = function (hab, sp, dt) {
    AI._mHab = hab;
    if (sp.sup && sp.sup.k !== 'air' && Nav.validSup(hab, sp.sup)) sp._mSup = JT.deepClone(sp.sup);
    // a strike that has just been launched: shorten it to a lunge that stops at arm's reach, on its own perch
    const A0 = sp._air;
    if (sp.state === 'pounce' && A0 && A0.straight && !A0._m) mantisStrike(hab, sp, A0);
    if (A0 && A0.mode === 'jump' && !A0._m) { A0._m = 1; const d = M.dist(A0.from, A0.to); if (adultOf(sp) && d > AI.len(sp) * 0.5) { A0.fly = true; A0.dur = 0.4 + d / 75; A0.apex = 1 + d * 0.08; hab.event('journal', { id: 'mantisFlight', sp, soft: true }); } }
    const s0 = sp.state; const fd0 = s0 === 'feed' ? { st: sp.st, dur: sp._feedDur, nut: sp._feedNut, hold: sp.hold } : null;
    update0.call(this, hab, sp, dt);
    // a refused carry falls back to "start feeding": keep the meal's progress instead of starting it over
    if (fd0 && sp.state === 'feed' && sp.hold === fd0.hold && sp.st < fd0.st) { sp.st = fd0.st + dt; sp._feedDur = fd0.dur; sp._feedNut = fd0.nut; }
    const st = sp.state, L = AI.len(sp);

    // startled: rear up and flash the wings instead of (or before) running
    if (st !== s0 && !(sp._mDispCD > hab.time)) {
      const f = hab.finger; const fresh = f && f.pos && hab.time - f.t < 0.5 && M.dist(f.pos, sp.pos) < 34;
      const byFinger = fresh && (st === 'fingerWatch' || st === 'avoid' || st === 'flee') && R() < 0.8;
      const byMantis = st === 'flee' && !fresh && R() < 0.5;
      if (byFinger || byMantis) { sp._route = null; if (fresh) sp._watchPos = f.pos.slice(); startDisplay(hab, sp, byFinger ? 'Startled by your finger — rears up, forelegs spread wide' : 'Rears up at the other mantis'); }
    }
    // another mantis coming close while it is calm: a warning display
    if (CALM.has(sp.state) && !sp.hold && !(sp._mDispCD > hab.time) && (sp._mNearT = (sp._mNearT || 0) - dt) <= 0) {
      sp._mNearT = 0.4;
      for (const o of hab.data.spiders) {
        if (o === sp || MOLTH.has(o.state) || o.state === 'sleep') continue; const d = M.dist(o.pos, sp.pos); if (d > L * 1.6 + AI.len(o) * 0.6 + 6) continue;
        const v = o._vel || [0, 0, 0]; const appr = M.dot(v, M.norm(M.sub(sp.pos, o.pos))); if (appr < 1 && !(o.target && o.target.id === sp.id)) continue;
        sp._watchPos = o.pos.slice(); startDisplay(hab, sp, 'Warning ' + o.name + ' off — reared up, forelegs spread'); break;
      }
    }
    // a meal in its arms: carried off only when disturbed
    if (sp.hold && (st === 'feed' || st === 'secure')) {
      const f = hab.finger;
      if (f && f.pos && hab.time - f.t < 0.6 && f.id !== sp._mPokeSeen && M.dist(f.pos, sp.pos) < L * 2.5 + 10) { sp._mPokeSeen = f.id; carryAway(hab, sp, f.pos.slice(), 'your finger'); }
      else if ((sp._mDecT = (sp._mDecT || 0) - dt) <= 0) {
        sp._mDecT = 0.5; const k = decorKey(hab, sp);
        if (sp._mDecHold !== sp.hold) { sp._mDecHold = sp.hold; sp._mDecKey = k; sp._awayN = 0; }
        else if (k !== sp._mDecKey) { sp._mDecKey = k; carryAway(hab, sp, sp.pos.slice(), 'the moving decor'); }
      }
    } else if (!sp.hold) sp._mDecHold = null;
    // flight permission: now and then an adult is in the mood to fly (and always right after a scare)
    if (adultOf(sp) && (sp._mFlyRoll = (sp._mFlyRoll || 60 * R()) - dt) <= 0) { sp._mFlyRoll = 70 + R() * 60; if (R() < 0.35) sp._mFlyUntil = hab.time + 20; }
    if (st === 'flee' && adultOf(sp)) sp._mFlyUntil = Math.max(sp._mFlyUntil || 0, hab.time + 6);

    // ---- animation drivers for the drawing ----
    const A = sp._air;
    sp._sweep = st === 'pounce' && A ? M.clamp((A.t - 0.45) / 0.45, 0, 1) : M.lerp(sp._sweep || 0, 0, Math.min(1, dt * 8));
    sp._mFly = !!(A && A.fly);
    const hangT = sp._mHangOK && MOLTH.has(st) ? 1 : 0;
    sp._mHangK = M.lerp(sp._mHangK || 0, hangT, Math.min(1, dt * (hangT ? 0.7 : 1.2))); if (sp._mHangK < 0.002) sp._mHangK = 0;
    const slT = st === 'molting' ? M.smooth(M.clamp((sp.st - 1) / 9, 0, 1)) : st === 'postMolt' ? 1 : 0;
    sp._mSlide = M.lerp(sp._mSlide || 0, slT, Math.min(1, dt * (slT ? 3 : 0.9))); if (sp._mSlide < 0.002) sp._mSlide = 0;
    // head snaps: the head holds a fix, then jumps to the next one (no smooth glide)
    const g = sp._gazeNow || 0; if (sp._mGzT == null || Math.abs(g - sp._mGzT) > 0.32 || Math.abs(g) < 0.05) sp._mGzT = g;
    sp._mGz = M.lerp(sp._mGz || 0, sp._mGzT, Math.min(1, dt * 30));
    fixThought(sp);
  };
  function startDisplay(hab, sp, why) {
    sp._mDispCD = hab.time + 18 + R() * 10; AI.setState(sp, 'display', why + (adultOf(sp) ? ', wings fanned to look huge.' : ' to look as big as it can.'));
    sp.stats && (sp.stats.displays = (sp.stats.displays || 0) + 1); hab.event('journal', { id: 'mantisThreat', sp, soft: true });
  }
  /** Two-phase strike: the body lunges only as far as it must, the forelegs cover the last 45% of a body length. */
  function mantisStrike(hab, sp, A) {
    A._m = 1; const L = AI.len(sp); const reachL = L * 0.45;
    const dir = M.sub(A.to, A.from); const d = M.len(dir); A.reachD = d;
    let lunge = Math.min(Math.max(0, d - reachL), L * 1.1);
    let to = lunge < L * 0.08 || d < 1e-3 ? A.from.slice() : M.add(A.from, M.mul(dir, lunge / d));
    const base = sp._mSup;
    if (base && Nav.validSup(hab, base)) {
      let ok = false;
      if (base.k === 'floor') ok = Nav.inside(hab, to[0], to[2], 1);
      else if (base.k === 'top') { const tp = hab.geoms[base.d] && hab.geoms[base.d].tops[base.i]; ok = !!tp && JT.G.pointInPoly(to[0], to[2], tp.poly); }
      // on a stem or twig it stays gripping and strikes from where it is
      if (!ok && lunge > L * 0.25) { A.dur = Math.max(A.dur, 0.12); return; } // too far to reach from here: the full lunge across
      to = ok ? Nav.supPos(hab, base, to) : A.from.slice(); A.land = JT.deepClone(base);
    }
    A.to = to; A.dur = Math.max(A.dur, 0.12);
  }
})(typeof window !== 'undefined' ? window : globalThis);
