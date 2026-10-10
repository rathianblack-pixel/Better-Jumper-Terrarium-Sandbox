/* Jumper Terrarium — prey & cleanup fauna. Locomotion is driven by explicit capability flags:
   fly, hop, burrow, climb (decor climbing), hide, slow, land (can land on plants but NOT crawl them). */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, Nav = JT.Nav, Loco = JT.Loco;
  const PA = JT.PreyAI = {};
  const def = (p) => JT.PREY_BY_ID[p.type];
  PA.caps = (d) => ({ climb: !!d.climb, jump: d.id === 'tinyjumper' ? 30 : 0, drop: !!d.climb, carry: false });
  /** Weakened escapee: a part dose of venom leaves it slow, dull-sensed and wobbly. It never dies of it and is fully
      recovered two minutes later (dose fades linearly). A heavy dose can leave it on its back, legs twitching. */
  PA.WEAK_T = 120;
  PA.weaken = function (hab, p, dose) {
    p.weak = { dose: M.clamp(dose, 0, 1), t: PA.WEAK_T };
    if (dose > 0.45 && p.sup && p.sup.k !== 'air' && JT.R() < dose * 0.8) { p.state = 'twitch'; p.st = 0; p.dur = 2 + dose * 5; p._route = null; p._air = null; p._flip = 1; }
  };
  PA.weakK = (p) => p && p.weak ? p.weak.dose * M.clamp(p.weak.t / PA.WEAK_T, 0, 1) : 0;
  const slowK = (p) => 1 - 0.6 * PA.weakK(p);

  PA.create = function (hab, type) {
    const d = JT.PREY_BY_ID[type]; const R = JT.R;
    const p = { id: JT.newId('p'), type, pos: null, sup: { k: 'floor' }, state: 'idle', st: 0, alert: 0, fwd: [1, 0, 0], owner: null, full: 1, buried: false, seed: (R() * 1e9) | 0, dur: 1 + R() * 3 };
    if (d.fly) { const q = hab.randomFloorPoint(); p.pos = [q[0], hab.dims.h * (0.3 + R() * 0.35), q[2]]; p.sup = { k: 'air' }; p.state = 'fly'; p._v = [0, 0, 0]; p._goal = null; }
    else { p.pos = hab.randomFloorPoint(); const a = R() * 6.28; p.fwd = [Math.cos(a), 0, Math.sin(a)]; }
    return p;
  };

  // ---------------- perception ----------------
  function nearestHunter(hab, p) { let b = null, bd = 60; for (const s of hab.data.spiders) { const d = M.dist(s.pos, p.pos); if (d < bd) { bd = d; b = s; } } return b; }
  function updateAlert(hab, p, d, dt) {
    const wk = PA.weakK(p); let a = 0; const range = (d.sense || 20) * 1.3 * (1 - 0.6 * wk);
    let nearest = null, nd = 1e9;
    for (const s of hab.data.spiders) {
      if (s.state === 'sleep' || s.state === 'premolt' || s.state === 'molting') continue;
      const glass = JT.SPECIES_BY_ID[s.species] && JT.SPECIES_BY_ID[s.species].sig === 'glass'; // Hyalina: nearly invisible
      const dist = M.dist(s.pos, p.pos); if (dist > range * (glass ? 0.55 : 1)) continue;
      if (dist < nd) { nd = dist; nearest = s; }
      const spd = s._speedNow || 0; const sneaking = s.state === 'crouch' || s.state === 'creep' || s.state === 'stalk';
      let vis = spd > 0.5 ? M.clamp(spd / 14, 0.3, 1.5) : 0.12;
      if (sneaking) vis *= 0.5;
      const camo = JT.SpiderAI.camoK ? JT.SpiderAI.camoK(hab, s) : 1; vis *= camo; // colour-matched perch: harder to pick out
      vis *= 1 - s.traits.stealth * 0.5; if (glass) vis *= 0.45;
      const to = M.norm([s.pos[0] - p.pos[0], 0, s.pos[2] - p.pos[2]]);
      const cone = d.fly ? 0.85 : (M.dot(p.fwd || [1, 0, 0], to) > 0.3 ? 1 : 0.35);
      const hgt = !d.fly && s.pos[1] - p.pos[1] > 10 ? 0.5 : 1;
      const cov = 1 - Nav.coverAt(hab, s.pos) * 0.6;
      const nk = JT.SpiderAI.noticeK ? JT.SpiderAI.noticeK(hab, s, p, dist, range) : 1; // packs: how readily this hunter is picked out at all (mantis camouflage)
      a += vis * cone * hgt * cov * (1 - dist / range) * nk;
      // a big shape this close is felt even when it keeps still (compound eyes, air currents, vibration)
      const near = range * (glass ? 0.22 : 0.42); if (dist < near) a += (1 - dist / near) * (sneaking ? 0.3 : 0.9) * (d.fly ? 1.3 : 1) * cov * (1 - s.traits.stealth * 0.3) * (camo < 1 ? 0.8 : 1) * (JT.SpiderAI.feltK ? JT.SpiderAI.feltK(hab, s, p, dist) : 1);
    }
    // nervous neighbours make a group jumpy
    if (nearest) { let nv = 0; for (const q of hab.data.prey) if (q !== p && !q.owner && (q.alert || 0) > 0.6 && M.dist(q.pos, p.pos) < 10) nv++; a += Math.min(3, nv) * 0.12 * (JT.SpiderAI.groupK ? JT.SpiderAI.groupK(hab, nearest, p) : 1); }
    const spooked = p._spook && hab.time < p._spook.until;
    p.alert = M.clamp((p.alert || 0) + a * dt * 2.2 * (spooked ? 1.35 : 1) * (1 - 0.5 * wk) - dt * 0.12, spooked ? 0.3 : 0, 1.5);
    if (p.alert > 1 && nearest && p.state !== 'flee' && p.state !== 'hop' && p.state !== 'twitch') PA.escape(hab, p, nearest, false);
  }

  PA.startle = function (hab, p, amt) { p.alert = Math.min(1.2, (p.alert || 0) + amt); const d = def(p); if (d.fly && p.state !== 'fly' && JT.R() < 0.6) takeOff(hab, p, null); };

  /** Alarm spreading through a group: nearby prey get a jolt of alertness after a short, staggered delay. */
  PA.alarm = function (hab, pos, radius, amt, except, hunter) {
    for (const q of hab.data.prey) {
      if (q === except || q.owner || q.buried || q.dead) continue;
      const d = M.dist(q.pos, pos); if (d > radius) continue;
      const dd = def(q); const a = amt * (1 - (d / radius) * 0.6) * (dd.fly ? 1.25 : 1);
      if (q._alarm && q._alarm.a >= a) continue;
      q._alarm = { t: hab.time + 0.04 + JT.R() * 0.22 + (d / radius) * 0.25, a, h: hunter ? hunter.id : null };
    }
  };
  /** Type-appropriate escape: flies scatter, crickets freeze then spring for cover, springtails pop away,
      runners dash for shelter, burrowers dig in. The escapee stays nervous (and avoids the spot) for a while. */
  PA.escape = function (hab, p, hunter, pounce, chained) {
    const d = def(p); if (p.owner || p.state === 'twitch') return;
    p.alert = Math.max(p.alert || 0, 0.45); const away = hunter ? M.norm([p.pos[0] - hunter.pos[0], 0, p.pos[2] - hunter.pos[2]]) : [1, 0, 0];
    if (p.buried) return;
    p._spook = { pos: (hunter || p).pos.slice(), until: hab.time + 25 + JT.R() * 25 };
    if (hunter && !chained) PA.alarm(hab, p.pos, 14, 0.55, p, hunter);
    if (d.fly && PA.weakK(p) > 0.6 && JT.R() < 0.7) { p.state = 'twitch'; p.st = 0; p.dur = 0.8 + JT.R() * 1.5; p._route = null; return; } // too groggy to take off
    if (d.fly) { takeOff(hab, p, hunter); return; }
    if (d.burrow && p.sup.k === 'floor' && (JT.SUBSTRATES[hab.data.substrate] || {}).burrow > JT.R() * 1.2) { burrow(hab, p); return; }
    if (d.id === 'springtail') { hop(hab, p, rot(away, (JT.R() - 0.5) * 1.6), 5 + JT.R() * 8); return; }
    if (d.hop) {
      if (!pounce && d.shape === 'cricket' || !pounce && d.shape === 'locust' && JT.R() < 0.6) { p.state = 'freeze'; p.st = 0; p.dur = 0.25 + JT.R() * 0.7; p._route = null; p._fleeFrom = hunter ? hunter.id : null; return; }
      hop(hab, p, coverDir(hab, p, away), 14 + JT.R() * 18); return;
    }
    run(hab, p, hunter);
  };
  const rot = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[2] * s, 0, v[0] * s + v[2] * c]; };
  /** A flight direction that is mostly away from the threat but bends toward nearby shelter. */
  function coverDir(hab, p, away) {
    let best = away, bs = -1e9;
    for (let k = 0; k < 8; k++) { const dir = rot(away, (k - 3.5) * 0.35); const q = [p.pos[0] + dir[0] * 20, 0, p.pos[2] + dir[2] * 20]; if (!Nav.inside(hab, q[0], q[2], 3)) continue; const s = Nav.coverAt(hab, q) * 3 + M.dot(dir, away) * 2 + JT.R() * 0.4; if (s > bs) { bs = s; best = dir; } }
    return best;
  }
  function takeOff(hab, p, hunter) {
    const d = def(p); p.state = 'fly'; p.st = 0; p._route = null;
    const up = [0, 1, 0]; const away = hunter ? M.norm([p.pos[0] - hunter.pos[0], 0.6, p.pos[2] - hunter.pos[2]]) : up;
    const spread = hunter ? 1.4 : 1; // scatter: every fly bursts off on its own line
    p._v = M.mul(M.norm(M.add(away, [(JT.R() - .5) * spread, .5, (JT.R() - .5) * spread])), d.spd * (hunter ? 1.15 : 1));
    p.sup = { k: 'air' }; p._goal = pickLanding(hab, p, hunter); p.pos = [p.pos[0], p.pos[1] + 0.5, p.pos[2]];
  }
  function hop(hab, p, dir, dist) {
    const key = Nav.regionKey(p.sup);
    let target = null;
    if (key) {
      const r = hab.nav.regions[key];
      for (let k = 0; k < 8 && !target; k++) {
        const a = Math.atan2(dir[2], dir[0]) + (JT.R() - 0.5) * (0.6 + k * 0.4); const L = dist * (1 - k * 0.08);
        const x = p.pos[0] + Math.cos(a) * L, z = p.pos[2] + Math.sin(a) * L;
        if (key === 'F' ? !Nav.inside(hab, x, z, 3) : !JT.G.pointInPoly(x, z, r.poly)) continue;
        if (r.obstacles.some(o => JT.G.pointInPoly(x, z, o))) continue;
        if (!Nav.regionClear(hab.nav, r, p.pos, [x, r.y, z])) continue; // v21: a low hop never passes through a trunk or rock
        target = { pos: [x, r.y, z], sup: JT.deepClone(p.sup) };
      }
      if (!target && key !== 'F') { const b = Nav.supportBelow(hab, [p.pos[0] + dir[0] * dist, 0, p.pos[2] + dir[2] * dist]); target = b; }
    } else { const b = Nav.supportBelow(hab, [p.pos[0] + dir[0] * 8, p.pos[1], p.pos[2] + dir[2] * 8]); target = b; }
    if (!target) { run(hab, p, null); return; }
    p._route = { steps: [{ pos: target.pos, mode: 'jump', arrive: target.sup }], i: 0 }; p.state = 'hop'; p.st = 0;
  }
  function run(hab, p, hunter) {
    const d = def(p);
    const n = pickWalkGoal(hab, p, hunter, true);
    if (n) { p._route = Nav.route(hab, p.sup, p.pos, n.sup, n.pos, PA.caps(d)); }
    p.state = p._route ? 'flee' : 'idle'; p.st = 0;
  }
  function burrow(hab, p) { p.buried = true; p.state = 'buried'; p.st = 0; p.dur = 15 + JT.R() * 30; p._route = null; for (const s of hab.data.spiders) if (s.target && s.target.id === p.id) JT.SpiderAI.dropTarget(hab, s); }

  function pickLanding(hab, p, hunter) {
    const d = def(p); const nav = hab.nav; const R = JT.R;
    let best = null, bs = -1e9;
    const lit = hab.daylight() < 0.3 && hab.lampsOn().length > 0; const rest = p._lampRest; p._lampRest = false;
    const spook = p._spook && hab.time < p._spook.until ? p._spook.pos : null;
    const consider = (pos, sup, bonus) => { let s = bonus + R() * 3; if (lit) s += hab.warmthAt(pos) * (rest ? 8 : 3); if (hunter) s += Math.min(60, M.dist(pos, hunter.pos)) * 0.08; s -= M.dist(pos, p.pos) * 0.01; if (spook) s -= Math.max(0, 26 - M.dist(pos, spook)) * 0.3; if (s > bs) { bs = s; best = { pos: pos.slice(), sup: JT.deepClone(sup) }; } };
    for (let k = 0; k < 6; k++) { const id = nav.flowers[Math.floor(R() * nav.flowers.length)]; if (id != null) { const n = nav.nodes[id]; consider(n.pos, n.sup, (d.flowers || 0) * 4); } }
    for (let k = 0; k < 8; k++) { const id = nav.perches[Math.floor(R() * nav.perches.length)]; if (id != null) { const n = nav.nodes[id]; consider(n.pos, n.sup, 1); } }
    for (let k = 0; k < 3; k++) { const q = hab.randomFloorPoint(); consider(q, { k: 'floor' }, d.id === 'gnat' ? 2 : 0); }
    if (lit) for (const L of hab.lampsOn()) { const b = Nav.supportBelow(hab, [L.pool[0] + (R() - 0.5) * L.r, L.head[1] - 2, L.pool[2] + (R() - 0.5) * L.r]); if (b.sup.k !== 'air' && Nav.inside(hab, b.pos[0], b.pos[2], 3)) consider(b.pos, b.sup, rest ? 3 : 1); }
    return best;
  }
  function pickWalkGoal(hab, p, hunter, wantCover) {
    const d = def(p); const nav = hab.nav; const R = JT.R; const caps = PA.caps(d);
    let best = null, bs = -1e9;
    for (let k = 0; k < 14; k++) {
      let pos, sup;
      if (caps.climb) { const n = nav.nodes[Math.floor(R() * nav.nodes.length)]; if (!n || n.kind === 'face' || n.buried) continue; pos = n.pos; sup = n.sup; }
      else {
        const key = Nav.regionKey(p.sup) || 'F'; const r = nav.regions[key]; if (!r) continue;
        const a = R() * 6.28, L = 10 + R() * 40; let x = p.pos[0] + Math.cos(a) * L, z = p.pos[2] + Math.sin(a) * L;
        if (key === 'F') { if (!Nav.inside(hab, x, z, 3)) continue; } else if (!JT.G.pointInPoly(x, z, r.poly)) continue;
        if (r.obstacles.some(o => JT.G.pointInPoly(x, z, o))) continue;
        if (!Nav.regionClear(nav, r, p.pos, [x, 0, z])) continue;
        pos = [x, r.y, z]; sup = JT.deepClone(p.sup);
      }
      if (M.dist(pos, p.pos) > 90) continue;
      let s = R() * 2;
      if (JT.Terrain && sup && sup.k === 'floor' && !d.fly && (d.len || 3) < 6) s += JT.Terrain.hollow(hab, pos[0], pos[2]) * 2.5; // v15: small prey keep to the hollows
      if (wantCover) s += Nav.coverAt(hab, pos) * 4;
      if (d.moist) s += moistAt(hab, pos) * 3 * d.moist;
      if (d.foliage && sup && sup.d) { const g = hab.geoms[sup.d]; if (g && g.def && g.def.cat === 'plants') s += 4 * d.foliage; }
      if (hunter) s += Math.min(50, M.dist(pos, hunter.pos)) * 0.1;
      if (p._spook && hab.time < p._spook.until) s -= Math.max(0, 22 - M.dist(pos, p._spook.pos)) * 0.3;
      if (s > bs) { bs = s; best = { pos: pos.slice(), sup: JT.deepClone(sup) }; }
    }
    return best;
  }
  function moistAt(hab, pos) {
    let m = hab.data.humidity * 0.3;
    for (const inst of hab.data.decor) { const g = hab.geoms[inst.id]; if (!g) continue; const dd = Math.hypot(pos[0] - g.center[0], pos[2] - g.center[2]); if (dd < g.coverR && (g.def.moist || g.def.cat === 'plants')) m += (g.def.moist || 0.3) * (1 - dd / g.coverR); }
    return Math.min(1, m);
  }

  // ---------------- update ----------------
  PA.update = function (hab, p, dt) {
    if (p.weak) { p.weak.t -= dt; if (p.weak.t <= 0) { p.weak = null; p._flip = 0; if (p.state === 'twitch') { p.state = 'idle'; p.st = 0; } } }
    if (p.owner) return;
    const d = def(p); p.st += dt;
    if (p._dazzle) { if (hab.time < p._dazzle && p.sup && p.sup.k !== 'air') { p.alert = 0; p._anim = (p._anim || 0) + dt * 0.2; return; } p._dazzle = null; } // Auralis prism display: transfixed for a moment
    const before = p.pos.slice();
    p._aT = (p._aT || 0) - dt; if (p._aT <= 0) { p._aT = 0.25; if (d.huntable) updateAlert(hab, p, d, 0.25); }
    if (p._alarm && hab.time >= p._alarm.t) {
      const al = p._alarm; p._alarm = null; p.alert = Math.min(1.5, (p.alert || 0) + al.a);
      if (p.alert > 0.7 && !['flee', 'hop', 'fly', 'freeze', 'buried'].includes(p.state)) PA.escape(hab, p, (al.h && hab.spider(al.h)) || nearestHunter(hab, p), false, true);
    }
    const h = PH[p.state] || PH.idle; h(hab, p, d, dt);
    if (p._air && p._air.mode && (!p._route || p._route.steps[p._route.i] !== p._air.step)) { p._air = null; if (p.state !== 'fly') { const b = Nav.supportBelow(hab, p.pos); p._route = { steps: [{ pos: b.pos, mode: 'drop', arrive: b.sup }], i: 0 }; p.sup = { k: 'air' }; p.state = 'walk'; } }
    if (!M.finite3(p.pos)) { p.pos = hab.randomFloorPoint(); p.sup = { k: 'floor' }; p._route = null; p.state = 'idle'; }
    const v = M.mul(M.sub(p.pos, before), 1 / Math.max(dt, 1e-3));
    p._vel = p._vel ? M.lerp3(p._vel, v, Math.min(1, dt * 6)) : v;
    if (M.len([v[0], 0, v[2]]) > 0.5 && p.state !== 'fly') p.fwd = M.norm([v[0], p.sup.k === 'path' ? v[1] : 0, v[2]]);
    // idle prey look around now and then (gives a stalking jumper windows to move); alert prey turn toward the threat
    else if (p.state === 'idle' && p.sup.k !== 'air') {
      p._lookT = (p._lookT || 0) - dt;
      if (p._lookT <= 0) { p._lookT = 1.2 + JT.R() * 3.5; const f = p.fwd || [1, 0, 0]; let a = Math.atan2(f[2], f[0]) + (JT.R() - 0.5) * 2.6;
        if ((p.alert || 0) > 0.5 && JT.R() < 0.5) { const s = nearestHunter(hab, p); if (s) a = Math.atan2(s.pos[2] - p.pos[2], s.pos[0] - p.pos[0]) + (JT.R() - 0.5) * 0.6; }
        p._lookTo = [Math.cos(a), 0, Math.sin(a)]; }
      if (p._lookTo) { const f = p.fwd || [1, 0, 0]; const k = Math.min(1, dt * 5); const nf = M.norm([M.lerp(f[0], p._lookTo[0], k), 0, M.lerp(f[2], p._lookTo[2], k)]); if (M.finite3(nf)) p.fwd = nf; }
    }
    if (p.sup.k === 'path' && JT.R() < dt * 2 && M.len(v) > 1) hab.nudge(p.sup.d, v[0] * 0.01 * d.len, v[2] * 0.01 * d.len);
    p._anim = (p._anim || 0) + dt; p._walk = (p._walk || 0) + M.dist(before, p.pos) / Math.max(0.4, d.len * 0.3);
  };
  const PH = PA.H = {};
  PH.idle = function (hab, p, d, dt) {
    if (p.sup.k === 'air') { const b = Nav.supportBelow(hab, p.pos); p._route = { steps: [{ pos: b.pos, mode: 'drop', arrive: b.sup }], i: 0 }; p.state = 'walk'; return; }
    const night = hab.daylight() < 0.3;
    let dur = p.dur;
    if (d.night) dur *= night ? 0.5 : 1 + d.night * 3;
    if (d.fly && night && hab.lampsOn().length) dur *= 0.5;
    if (d.cleaner && hab.data.remains.length && p.st > 0.6 && !(p._seekCD > hab.time)) { p.st = 0; if (seekRemains(hab, p, d)) return; }
    if (p.st < dur) return;
    p.st = 0; p.dur = (d.slow ? 3 : 1.5) + JT.R() * (d.fly ? 9 : 5);
    if (d.cleaner && seekRemains(hab, p, d)) return;
    if (d.fly) { if (p.sup.k !== 'air' && JT.R() < (d.night && !night ? 0.25 : 0.65)) { takeOff(hab, p, null); return; } }
    if (d.fly && p.sup.k === 'path') return; // can land on plants but cannot crawl them
    if (d.burrow && p.sup.k === 'floor' && JT.R() < 0.18 * ((JT.SUBSTRATES[hab.data.substrate] || {}).burrow || 0)) { burrow(hab, p); return; }
    if (d.hop && JT.R() < 0.15) { const a = JT.R() * 6.28; hop(hab, p, [Math.cos(a), 0, Math.sin(a)], 6 + JT.R() * 10); return; }
    if (d.fly && JT.R() < 0.6) return;
    const wantCover = d.hide && hab.daylight() > 0.5 && !(d.night);
    const g = pickWalkGoal(hab, p, null, wantCover);
    if (g) { p._route = Nav.route(hab, p.sup, p.pos, g.sup, g.pos, PA.caps(d)); if (p._route) p.state = 'walk'; }
  };
  PH.walk = function (hab, p, d, dt) {
    const sp = d.spd * (d.slow ? 1 : 0.35) * (hab.daylight() < 0.3 && d.night ? 1.3 : 1) * slowK(p);
    const r = Loco.follow(hab, p, dt, sp);
    if (r !== 'moving') { p._route = null; p.state = p._clean ? 'clean' : 'idle'; p.st = 0; }
  };
  PH.flee = function (hab, p, d, dt) {
    const r = Loco.follow(hab, p, dt, d.spd * (d.slow ? 1.2 : 1) * slowK(p));
    if (r !== 'moving') { p._route = null; p.state = 'idle'; p.st = 0; }
  };
  PH.hop = function (hab, p, d, dt) {
    const r = Loco.follow(hab, p, dt, d.spd * slowK(p));
    if (r !== 'moving') { p._route = null; p.state = 'idle'; p.st = 0; p.dur = 0.5 + JT.R() * 2; }
  };
  /** Groggy from a part dose of venom: lying still (often on its back), legs twitching, then it rights itself. */
  PH.twitch = function (hab, p, d, dt) {
    p._anim = (p._anim || 0) + dt * 3;
    if (p.st > p.dur) { p.state = 'idle'; p.st = 0; p.dur = 0.5 + JT.R() * 1.5; p._flip = 0; }
  };
  PH.freeze = function (hab, p, d, dt) { // dead still for a moment, then a spring for cover
    const h = p._fleeFrom && hab.spider(p._fleeFrom); const close = h && M.dist(h.pos, p.pos) < (d.sense || 20) * 0.35;
    if (p.st > p.dur || close) { const away = h ? M.norm([p.pos[0] - h.pos[0], 0, p.pos[2] - h.pos[2]]) : [1, 0, 0]; p._fleeFrom = null; hop(hab, p, coverDir(hab, p, away), 14 + JT.R() * 18); }
  };
  PH.buried = function (hab, p, d, dt) { if (p.st > p.dur) { p.buried = false; p.state = 'idle'; p.st = 0; } };
  /** Push a flying insect out of any solid decor it has drifted into, along the nearest way out, and cancel the
      part of its velocity that points back in. Exits behind the glass are refused (it is lifted over instead). */
  PA.unclipFlyer = function (hab, p) {
    const S = JT.Solid; if (!S) return;
    const solidAt = (q) => { let hit = null; for (const inst of hab.data.decor) { const g = hab.geoms[inst.id]; if (!g) continue; const h = S.at(g, q, 0.6); if (h && (!hit || h.d > hit.d)) hit = h; } return hit; };
    const hit = solidAt(p.pos); if (!hit) return;
    // shortest way out that is clear of every piece (a shelf pressed against a wall must not bounce the fly into the wall)
    // and still inside the glass; the touched surface's own outward direction wins ties
    const gr = S.grad(p.pos, hit.pr); const dirs = [gr, [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]];
    let best = null;
    for (let k = 0; k < dirs.length; k++) { const n = dirs[k];
      for (let L = 0.3; L <= 24 && (!best || L < best.L - 0.01); L += L < 3 ? 0.3 : 1) {
        const q = M.add(p.pos, M.mul(n, L)); if (q[1] < 1.2 || q[1] > hab.dims.h - 1 || !Nav.inside(hab, q[0], q[2], 2)) break;
        if (!solidAt(q)) { const q2 = M.add(q, M.mul(n, 0.4)); best = { L, n, q: q2 }; break; } }
    }
    if (!best) return; // boxed in: leave it be rather than teleport (the next frames' steering carries it clear)
    p.pos = best.q;
    if (p._v) { const vn = M.dot(p._v, best.n); if (vn < 0) p._v = M.sub(p._v, M.mul(best.n, vn)); }
  };
  PH.fly = function (hab, p, d, dt) {
    const H = hab.dims.h; const night = hab.daylight() < 0.3;
    if (!p._goal || (p._goalT = (p._goalT || 0) + dt) > 14) { p._goal = lampGoal(hab, p, d) || pickLanding(hab, p, null); p._goalT = 0; }
    const g = p._goal; const to = g ? M.sub(g.pos, p.pos) : [0, 0, 0]; const dist = M.len(to);
    const cruise = d.spd * (d.id === 'moth' && !night ? 0.6 : 1) * (1 - 0.5 * PA.weakK(p));
    let want = dist > 0.01 ? M.mul(M.norm(to), Math.min(cruise, dist * 2.5 + 2)) : [0, 0, 0];
    const wob = d.id === 'moth' ? 10 : d.id === 'lacewing' ? 4 : d.id === 'housefly' || d.id === 'bluebottle' ? 14 : 7;
    const t = p._anim || 0; const ph = (p.seed % 100) / 10;
    want = M.add(want, [Math.sin(t * 5.1 + ph) * wob, Math.sin(t * 3.7 + ph * 2) * wob * 0.5, Math.cos(t * 4.3 + ph) * wob]);
    // soft containment steering — no visible or invisible walls to bounce off
    const c = [hab.dims.w / 2, H / 2, hab.dims.d / 2];
    if (!Nav.inside(hab, p.pos[0], p.pos[2], 10)) want = M.add(want, M.mul(M.norm([c[0] - p.pos[0], 0, c[2] - p.pos[2]]), cruise));
    if (p.pos[1] > H - 8) want[1] -= cruise; if (p.pos[1] < 4) want[1] += cruise;
    p._v = M.lerp3(p._v || [0, 0, 0], want, Math.min(1, dt * 3));
    p.pos = M.add(p.pos, M.mul(p._v, dt));
    const cl = Nav.clampInside(hab, p.pos[0], p.pos[2], 2); p.pos[0] = cl[0]; p.pos[2] = cl[1]; p.pos[1] = M.clamp(p.pos[1], 1.2, H - 2);
    // never fly through solid decor: slide off the surface it touched (along a wall face, around a rock) instead of
    // popping up onto its top — the old footprint test teleported flies onto a tall back wall's crest and back
    PA.unclipFlyer(hab, p);
    if (M.len([p._v[0], 0, p._v[2]]) > 0.5) p.fwd = M.norm([p._v[0], 0, p._v[2]]);
    if (g && g.orbit && dist < 2.2) { p._goal = lampGoal(hab, p, d) || pickLanding(hab, p, null); p._goalT = 0; }
    else if (g && dist < 1.6) {
      if (Nav.validSup(hab, g.sup)) { p.pos = Nav.supPos(hab, g.sup, g.pos); p.sup = JT.deepClone(g.sup); p.state = 'idle'; p.st = 0; p.dur = 2 + JT.R() * (d.id === 'moth' && !night ? 40 : 10); p._goal = null; p._v = [0, 0, 0]; }
      else p._goal = null;
    }
  };
  /** Cleaners actively look for husks AND molt skins, then gather in a loose ring around them. */
  /** Cleaners only come for remains once they have lain a while (60-90 s, set per item), never while still falling,
      and not while a jumper close by is feeding, guarding its catch, moulting or still soft. */
  const BUSY_NEAR = new Set(['feed', 'postFeed', 'secure', 'subdue', 'emerge']);
  PA.remainsReady = function (hab, r) {
    if (r._fall) return false; if (r.ripe == null) r.ripe = 60 + JT.R() * 30; if ((r.age || 0) < r.ripe) return false;
    for (const sp of hab.data.spiders) { if (M.dist(sp.pos, r.pos) > 15) continue; if (BUSY_NEAR.has(sp.state) || (JT.SpiderAI.MOLT && JT.SpiderAI.MOLT.has(sp.state)) || sp.soft > 0) return false; }
    return true;
  };
  function seekRemains(hab, p, d) {
    if (!hab.data.remains.length) return false;
    if (p._seekCD > hab.time) return false;
    const rs = hab.data.remains.filter(r => PA.remainsReady(hab, r)); if (!rs.length) { p._seekCD = hab.time + 3 + JT.R() * 3; return false; }
    let best = null, bc = 1e9; const dj = Nav.dijkstra(hab, p.sup, p.pos, PA.caps(d));
    for (const r of rs) { const gc = Nav.goalCost(hab, dj, r.sup, r.pos); if (!gc) continue; const crowd = PA.cleanersOn(hab, r.id) * 4; if (gc.cost + crowd < bc) { bc = gc.cost + crowd; best = r; } }
    if (!best || bc > 400) { p._seekCD = hab.time + 4 + JT.R() * 4; return false; }
    const a = ((p.seed % 360) / 57.3) + JT.R() * 0.5, rad = 0.7 + JT.R() * 0.6;
    const route = Nav.buildRoute(hab, dj, best.sup, [best.pos[0] + Math.cos(a) * rad, best.pos[1], best.pos[2] + Math.sin(a) * rad]);
    if (!route) { p._seekCD = hab.time + 4; return false; }
    p._route = route; p._clean = best.id; p.state = 'walk'; return true;
  }
  PA.cleanersOn = function (hab, rid) { let n = 0; for (const q of hab.data.prey) if (q._clean === rid) n++; return n; };
  /** Per-cleaner nibble rate (fraction of the remains per second). Many springtails clear things quickly. */
  PA.cleanRate = function (d, r) { return (d.id === 'springtail' ? 0.022 : 0.035) * (r.cat === 'spider' ? 0.4 : r.cat === 'exuvia' ? 0.8 : 1); };
  PH.clean = function (hab, p, d, dt) {
    const r = hab.data.remains.find(x => x.id === p._clean);
    if (!r || M.dist(r.pos, p.pos) > 4) { p._clean = null; p.state = 'idle'; p.st = 0; p.dur = 0.3 + JT.R(); return; }
    // nibbling: face the remains with small head-jitter turns; brief pauses
    p._nibT = (p._nibT || 0) - dt;
    if (p._nibT <= 0) { p._nibT = 0.4 + JT.R() * 0.9; const to = [r.pos[0] - p.pos[0], 0, r.pos[2] - p.pos[2]]; const a = Math.atan2(to[2], to[0]) + (JT.R() - 0.5) * 0.9; p.fwd = [Math.cos(a), 0, Math.sin(a)]; p._nib = JT.R() < 0.25 ? 0 : 1; }
    if (p._nib === 0) return;
    r.clean -= dt * PA.cleanRate(d, r);
    if (r.clean <= 0) { hab.data.remains = hab.data.remains.filter(x => x !== r); for (const q of hab.data.prey) if (q._clean === r.id) { q._clean = null; if (q.state === 'clean') { q.state = 'idle'; q.st = 0; q.dur = 0.5 + JT.R() * 2; } } hab.event('journal', { id: 'cleanup' }); }
  };
  // ---------------- night lights ----------------
  /** Flying insects are drawn to a lit lamp at night: loose loops around the head, then settle near its pool of light. */
  function lampGoal(hab, p, d) {
    if (hab.daylight() > 0.3) return null; const L = hab.lampsOn(); if (!L.length) return null;
    const pull = d.id === 'moth' ? 0.85 : d.id === 'lacewing' ? 0.6 : 0.4;
    if (p._orb == null && JT.R() > pull) return null;
    const lamp = L[(p.seed >>> 3) % L.length]; p._orb = (p._orb || 0) + 1;
    if (p._orb > 3 + (p.seed % 4)) { p._orb = null; p._lampRest = true; return null; }
    const a = JT.R() * 6.28, rr = 3 + JT.R() * 5; const H = hab.dims.h;
    return { pos: [lamp.head[0] + Math.cos(a) * rr, M.clamp(lamp.head[1] - 4 + JT.R() * 5, 3, H - 3), lamp.head[2] + Math.sin(a) * rr], sup: { k: 'air' }, orbit: true };
  }
  PA.lampGoal = lampGoal;
})(typeof window !== 'undefined' ? window : globalThis);
