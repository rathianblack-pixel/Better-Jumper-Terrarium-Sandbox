/* Jumper Terrarium — prey & cleanup fauna. Locomotion is driven by explicit capability flags:
   fly, hop, burrow, climb (decor climbing), hide, slow, land (can land on plants but NOT crawl them). */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, Nav = JT.Nav, Loco = JT.Loco;
  const PA = JT.PreyAI = {};
  const def = (p) => JT.PREY_BY_ID[p.type];
  PA.caps = (d) => ({ climb: !!d.climb, jump: d.id === 'tinyjumper' ? 30 : 0, drop: !!d.climb, carry: false });

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
    let a = 0; const range = (d.sense || 20) * 1.3;
    let nearest = null, nd = 1e9;
    for (const s of hab.data.spiders) {
      if (s.state === 'sleep' || s.state === 'premolt' || s.state === 'molting') continue;
      const dist = M.dist(s.pos, p.pos); if (dist > range) continue;
      if (dist < nd) { nd = dist; nearest = s; }
      const spd = s._speedNow || 0; const sneaking = s.state === 'crouch' || s.state === 'creep' || s.state === 'stalk';
      let vis = spd > 0.5 ? M.clamp(spd / 14, 0.3, 1.5) : 0.12;
      if (sneaking) vis *= 0.5;
      vis *= 1 - s.traits.stealth * 0.5;
      const to = M.norm([s.pos[0] - p.pos[0], 0, s.pos[2] - p.pos[2]]);
      const cone = d.fly ? 0.85 : (M.dot(p.fwd || [1, 0, 0], to) > 0.3 ? 1 : 0.35);
      const hgt = !d.fly && s.pos[1] - p.pos[1] > 10 ? 0.5 : 1;
      const cov = 1 - Nav.coverAt(hab, s.pos) * 0.6;
      a += vis * cone * hgt * cov * (1 - dist / range);
    }
    p.alert = M.clamp((p.alert || 0) + a * dt * 2.2 - dt * 0.12, 0, 1.5);
    if (p.alert > 1 && nearest && p.state !== 'flee' && p.state !== 'hop') PA.escape(hab, p, nearest, false);
  }

  PA.startle = function (hab, p, amt) { p.alert = Math.min(1.2, (p.alert || 0) + amt); const d = def(p); if (d.fly && p.state !== 'fly' && JT.R() < 0.6) takeOff(hab, p, null); };

  /** Type-appropriate escape (fly, hop, run, hide, burrow). */
  PA.escape = function (hab, p, hunter, pounce) {
    const d = def(p); if (p.owner) return;
    p.alert = 0.45; const away = hunter ? M.norm([p.pos[0] - hunter.pos[0], 0, p.pos[2] - hunter.pos[2]]) : [1, 0, 0];
    if (p.buried) return;
    if (d.fly) { takeOff(hab, p, hunter); return; }
    if (d.burrow && p.sup.k === 'floor' && (JT.SUBSTRATES[hab.data.substrate] || {}).burrow > JT.R() * 1.2) { burrow(hab, p); return; }
    if (d.hop) { hop(hab, p, away, 14 + JT.R() * 18); return; }
    run(hab, p, hunter);
  };
  function takeOff(hab, p, hunter) {
    const d = def(p); p.state = 'fly'; p.st = 0; p._route = null;
    const up = [0, 1, 0]; const away = hunter ? M.norm([p.pos[0] - hunter.pos[0], 0.6, p.pos[2] - hunter.pos[2]]) : up;
    p._v = M.mul(M.norm(M.add(away, [JT.R() - .5, .5, JT.R() - .5])), d.spd);
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
        target = { pos: [x, r.y, z], sup: JT.deepClone(p.sup) };
      }
      if (!target && key !== 'F') { const b = Nav.supportBelow(hab, [p.pos[0] + dir[0] * dist, 0, p.pos[2] + dir[2] * dist]); target = b; }
    } else { const b = Nav.supportBelow(hab, [p.pos[0] + dir[0] * 8, p.pos[1], p.pos[2] + dir[2] * 8]); target = b; }
    if (!target) { run(hab, p, null); return; }
    p._route = { steps: [{ pos: target.pos, mode: 'jump', arrive: target.sup }], i: 0 }; p.state = 'hop'; p.st = 0;
  }
  function run(hab, p, hunter) {
    const d = def(p);
    const n = pickWalkGoal(hab, p, hunter, d.hide);
    if (n) { p._route = Nav.route(hab, p.sup, p.pos, n.sup, n.pos, PA.caps(d)); }
    p.state = p._route ? 'flee' : 'idle'; p.st = 0;
  }
  function burrow(hab, p) { p.buried = true; p.state = 'buried'; p.st = 0; p.dur = 15 + JT.R() * 30; p._route = null; for (const s of hab.data.spiders) if (s.target && s.target.id === p.id) JT.SpiderAI.dropTarget(hab, s); }

  function pickLanding(hab, p, hunter) {
    const d = def(p); const nav = hab.nav; const R = JT.R;
    let best = null, bs = -1e9;
    const lit = hab.daylight() < 0.3 && hab.lampsOn().length > 0; const rest = p._lampRest; p._lampRest = false;
    const consider = (pos, sup, bonus) => { let s = bonus + R() * 3; if (lit) s += hab.warmthAt(pos) * (rest ? 8 : 3); if (hunter) s += Math.min(60, M.dist(pos, hunter.pos)) * 0.08; s -= M.dist(pos, p.pos) * 0.01; if (s > bs) { bs = s; best = { pos: pos.slice(), sup: JT.deepClone(sup) }; } };
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
      if (caps.climb) { const n = nav.nodes[Math.floor(R() * nav.nodes.length)]; if (!n || n.kind === 'face') continue; pos = n.pos; sup = n.sup; }
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
      if (wantCover) s += Nav.coverAt(hab, pos) * 4;
      if (d.moist) s += moistAt(hab, pos) * 3 * d.moist;
      if (hunter) s += Math.min(50, M.dist(pos, hunter.pos)) * 0.1;
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
    if (p.owner) return;
    const d = def(p); p.st += dt;
    const before = p.pos.slice();
    p._aT = (p._aT || 0) - dt; if (p._aT <= 0) { p._aT = 0.25; if (d.huntable) updateAlert(hab, p, d, 0.25); }
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
    const sp = d.spd * (d.slow ? 1 : 0.35) * (hab.daylight() < 0.3 && d.night ? 1.3 : 1);
    const r = Loco.follow(hab, p, dt, sp);
    if (r !== 'moving') { p._route = null; p.state = p._clean ? 'clean' : 'idle'; p.st = 0; }
  };
  PH.flee = function (hab, p, d, dt) {
    const r = Loco.follow(hab, p, dt, d.spd * (d.slow ? 1.2 : 1));
    if (r !== 'moving') { p._route = null; p.state = 'idle'; p.st = 0; }
  };
  PH.hop = function (hab, p, d, dt) {
    const r = Loco.follow(hab, p, dt, d.spd);
    if (r !== 'moving') { p._route = null; p.state = 'idle'; p.st = 0; p.dur = 0.5 + JT.R() * 2; }
  };
  PH.buried = function (hab, p, d, dt) { if (p.st > p.dur) { p.buried = false; p.state = 'idle'; p.st = 0; } };
  PH.fly = function (hab, p, d, dt) {
    const H = hab.dims.h; const night = hab.daylight() < 0.3;
    if (!p._goal || (p._goalT = (p._goalT || 0) + dt) > 14) { p._goal = lampGoal(hab, p, d) || pickLanding(hab, p, null); p._goalT = 0; }
    const g = p._goal; const to = g ? M.sub(g.pos, p.pos) : [0, 0, 0]; const dist = M.len(to);
    const cruise = d.spd * (d.id === 'moth' && !night ? 0.6 : 1);
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
    // never fly through solid decor
    for (const inst of hab.data.decor) { const gg = hab.geoms[inst.id]; if (!gg) continue; for (const tp of gg.tops) if (p.pos[1] < tp.y && p.pos[1] > gg.baseY - 1 && JT.G.pointInPoly(p.pos[0], p.pos[2], tp.poly)) p.pos[1] = tp.y + 0.6; }
    if (M.len([p._v[0], 0, p._v[2]]) > 0.5) p.fwd = M.norm([p._v[0], 0, p._v[2]]);
    if (g && g.orbit && dist < 2.2) { p._goal = lampGoal(hab, p, d) || pickLanding(hab, p, null); p._goalT = 0; }
    else if (g && dist < 1.6) {
      if (Nav.validSup(hab, g.sup)) { p.pos = Nav.supPos(hab, g.sup, g.pos); p.sup = JT.deepClone(g.sup); p.state = 'idle'; p.st = 0; p.dur = 2 + JT.R() * (d.id === 'moth' && !night ? 40 : 10); p._goal = null; p._v = [0, 0, 0]; }
      else p._goal = null;
    }
  };
  /** Cleaners actively look for husks AND molt skins, then gather in a loose ring around them. */
  function seekRemains(hab, p, d) {
    const rs = hab.data.remains; if (!rs.length) return false;
    if (p._seekCD > hab.time) return false;
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
