// Focused behaviour scenarios. node tests/scenarios.js [index.html] -> one line per scenario (JSON)
const { load } = require('./harness');
const JT = load(process.argv[2]); const M = JT.M, AI = JT.SpiderAI, Nav = JT.Nav;
const NEW = !!AI.canSee; const ONLY = process.env.ONLY;
const lenOf = (e) => e.species ? AI.len(e) : (JT.PREY_BY_ID[e.type] || { len: 3 }).len;
function surf(hab, e, lift) { const fr = e.sup && e.sup.k !== 'air' && Nav.validSup(hab, e.sup) ? Nav.supFrame(hab, e.sup) : { n: [0, 1, 0], r: 0 }; return M.add(e.pos, M.mul(fr.n, (fr.r || 0) + (lift || 0))); }
function blocked(hab, a, b, skip) { const L = M.dist(a, b); const n = Math.max(2, Math.ceil(L / 1.0));
  for (let k = 1; k < n; k++) { const t = k / n; if (t * L < skip || (1 - t) * L < skip) continue; const p = M.lerp3(a, b, t);
    for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (!g) continue; const h = JT.Solid.at(g, p, 0); if (h && h.d > 0.6) return true; } } return false; }
function mkHab(seed, theme, type) { JT.reseed(seed); const hab = new JT.Habitat({ type: type || 'standard' }); if (theme) JT.Presets.generate(hab, theme, seed); hab._t = 0; hab.events = []; hab.event = (t, i) => hab.events.push([hab._t, t, i]); return hab; }
const origPrey = JT.PreyAI.update; JT.PreyAI.update = (hab, p, dt) => { if (p._frozen) { p._vel = p._fakeVel || [0, 0, 0]; return; } origPrey(hab, p, dt); };
function run(hab, secs, mon) { const dt = 1 / 30; for (let t = 0; t < secs; t += dt) { hab._t += dt;
  const fz = hab.data.prey.filter(p => p._frozen && !p.owner).map(p => [p, p.pos.slice(), JSON.stringify(p.sup), (p.fwd || [1, 0, 0]).slice(), p.state]);
  hab.update(dt, true);
  for (const [p, pos, sup, fwd, st] of fz) if (!p.owner && hab.data.prey.includes(p)) { p.pos = pos; p.sup = JSON.parse(sup); p.fwd = fwd; p.state = st === 'held' ? st : 'idle'; p._vel = (p._fakeVel || [0, 0, 0]).slice(); p._route = null; p._air = null; } if (mon && mon(hab) === true) return true; } return false; }
const out = {};
const themes = [...new Set(JT.PRESETS.map(p => p[1]))];

// A) occlusion: never notice / pounce on prey hidden behind solid decor; still notice visible prey
(ONLY && !ONLY.includes('A')) || (() => {
  let noticedWhileHidden = 0, hiddenTrials = 0, hiddenNoticed = 0, clearTrials = 0, clearNoticed = 0, through = 0, pounces = 0;
  for (let s = 0; s < 70; s++) {
    const hab = mkHab(100 + s, themes[s % themes.length]); const nodes = hab.nav.nodes.filter(n => n.kind !== 'face' && n.sup);
    for (let k = 0; k < 6; k++) {
      const a = nodes[Math.floor(JT.R() * nodes.length)], b = nodes[Math.floor(JT.R() * nodes.length)]; if (!a || !b || M.dist(a.pos, b.pos) < 14 || M.dist(a.pos, b.pos) > 55) continue;
      hab.data.spiders = []; hab.data.prey = [];
      const sp = hab.addSpider('bold', { sat: 0.25, stage: 3, pos: a.pos.slice(), sup: JT.deepClone(a.sup) }); sp.traits.tactics = 1;
      sp.fwd = M.norm([b.pos[0] - a.pos[0], 0, b.pos[2] - a.pos[2]]);
      const p = JT.PreyAI.create(hab, 'dubia'); p.pos = b.pos.slice(); p.sup = JT.deepClone(b.sup); p.state = 'idle'; p._frozen = true; p._fakeVel = [2.5, 0, 0]; hab.data.prey.push(p);
      const hid = blocked(hab, surf(hab, sp, lenOf(sp) * 0.35), surf(hab, p, 0.8), 1.3);
      let noticed = false;
      let hidAtNotice = false;
      run(hab, 5, (h) => { if (!noticed && sp.target && sp.target.id === p.id) { noticed = true; hidAtNotice = blocked(h, surf(h, sp, lenOf(sp) * 0.35), surf(h, p, 0.8), 1.3); } while (h.events.length) { const [t, ty] = h.events.shift(); if (ty === 'pounce' && sp._air) { pounces++; if (blocked(h, sp._air.from, sp._air.to, Math.max(1.2, lenOf(sp) * 0.5))) through++; } } return noticed && !hid; });
      if (hidAtNotice) noticedWhileHidden++;
      if (hid) { hiddenTrials++; if (noticed) hiddenNoticed++; } else { clearTrials++; if (noticed) clearNoticed++; }
    }
  }
  out.occlusion = { hiddenTrials, hiddenNoticed, noticedWhileHidden, clearTrials, clearNoticed, pounces, through };
})();

// B) face to face: prey walks toward the jumper inside its reach -> pounce quickly anyway
(ONLY && !ONLY.includes('B')) || (() => {
  const times = [];
  for (let s = 0; s < 20; s++) {
    const hab = mkHab(300 + s); const sp = hab.addSpider('bold', { sat: 0.25, stage: 3, pos: [60, 0, 45] }); sp.fwd = [1, 0, 0];
    const J = AI.jump(sp); const p = JT.PreyAI.create(hab, 'pinhead'); p.pos = [60 + J * 1.6, 0, 45]; p.sup = { k: 'floor' }; p.fwd = [-1, 0, 0]; p._frozen = true; p._fakeVel = [-1.5, 0, 0]; hab.data.prey.push(p);
    let t0 = null, tp = null;
    run(hab, 25, (h) => { if (p._frozen && p.pos[0] > 60 + J * 0.55) p.pos[0] -= 1.5 / 30; if (sp.target && t0 == null) t0 = h._t; if (sp.state === 'pounce' && tp == null) { tp = h._t; return true; } });
    times.push(tp != null && t0 != null ? +(tp - t0).toFixed(2) : 99);
  }
  times.sort((a, b) => a - b); out.faceToFace = { median: times[10], max: times[19], fails: times.filter(t => t === 99).length };
})();

// C) stalking pace: far vs near, prey back turned / walking / facing
(ONLY && !ONLY.includes('C')) || (() => {
  const res = {};
  for (const [lbl, fwd, vel] of [['facingAway', [1, 0, 0], [0, 0, 0]], ['awayWalking', [1, 0, 0], [1.6, 0, 0]], ['side', [0, 0, 1], [0, 0, 0]]]) {
    const samples = { far: [], mid: [], near: [] };
    for (let s = 0; s < 6; s++) {
      const hab = mkHab(500 + s); const sp = hab.addSpider('bold', { sat: 0.3, stage: 3, pos: [20, 0, 45] }); sp.fwd = [1, 0, 0]; const J = AI.jump(sp);
      const p = JT.PreyAI.create(hab, 'cricket'); p.pos = [20 + J * 2.3, 0, 45]; sp.traits.tactics = 1; p.sup = { k: 'floor' }; p.fwd = fwd; p._frozen = true; p._fakeVel = vel; hab.data.prey.push(p);
      sp._seen = { [p.id]: 0 }; AI.noteSeen && AI.noteSeen(hab, sp, p); sp.target = { kind: 'prey', id: p.id, since: 0 }; AI.setState(sp, 'assess');
      run(hab, 30, (h) => { if (vel[0]) p.pos[0] = Math.min(190, p.pos[0] + vel[0] / 30 * 0.3);
        if ((sp.state === 'stalk' || sp.state === 'creep') && sp._paceNow != null) { const r = M.dist(sp.pos, p.pos) / J; (r > 1.8 ? samples.far : r > 1.2 ? samples.mid : samples.near).push(sp._paceNow); }
        return sp.state === 'pounce'; });
    }
    const avg = (a) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null;
    res[lbl] = { far: avg(samples.far), mid: avg(samples.mid), near: avg(samples.near) };
  }
  out.pace = res;
})();

// D) flies on a flower: after the pounce the rest of the group scatters
(ONLY && !ONLY.includes('D')) || (() => {
  let others = 0, fled = 0, leftEarly = 0, trials = 0;
  for (let s = 0; s < 12; s++) {
    const hab = mkHab(700 + s); const inst = hab.addDecor('pinkflowers', 120, 45, 0, 11 + s); if (!inst) continue;
    const fl = hab.nav.flowers.map(i => hab.nav.nodes[i]); if (!fl.length) continue;
    const sp = hab.addSpider('bold', { sat: 0.2, stage: 4, pos: [70, 0, 45] }); sp.fwd = [1, 0, 0];
    const flies = []; for (let k = 0; k < 6; k++) { const n = fl[k % fl.length]; const p = JT.PreyAI.create(hab, 'housefly'); p.pos = n.pos.slice(); p.sup = JT.deepClone(n.sup); p.state = 'idle'; p.dur = 999; p._v = [0, 0, 0]; hab.data.prey.push(p); flies.push(p); }
    trials++; let tp = null;
    run(hab, 40, (h) => { if (tp == null && sp.state === 'pounce') { tp = h._t; leftEarly += flies.filter(f => f.state === 'fly').length; } if (tp != null && h._t > tp + 1.5) return true; });
    if (tp != null) { const tgt = sp.hold; for (const f of flies) if (f.id !== tgt && f.state !== 'fly' || true) { if (f.id === tgt || f.owner) continue; others++; if (f.state === 'fly') fled++; } }
  }
  out.flowerFlies = { trials, others, fledAfterPounce: fled, alreadyLeftBeforePounce: leftEarly };
})();

// E) feeding jumper with a big cricket walking right at it
(ONLY && !ONLY.includes('E')) || (() => {
  let react = 0, carry = 0, n = 0;
  for (let s = 0; s < 10; s++) {
    const hab = mkHab(900 + s); const sp = hab.addSpider('bold', { sat: 0.5, stage: 2, pos: [80, 0, 45] }); sp.fwd = [1, 0, 0];
    const meal = JT.PreyAI.create(hab, 'fruitfly'); meal.owner = sp.id; meal.state = 'held'; hab.data.prey.push(meal); sp.hold = meal.id; sp._feedDur = 60; sp._feedNut = 0.1; AI.setState(sp, 'feed', 'Feeding.');
    const c = JT.PreyAI.create(hab, 'locust'); c.pos = [80 + 30, 0, 45]; c.sup = { k: 'floor' }; c.fwd = [-1, 0, 0]; c._frozen = true; c._fakeVel = [-4, 0, 0]; hab.data.prey.push(c);
    n++; let r = false, cr = false;
    run(hab, 12, (h) => { if (c.pos[0] > sp.pos[0] + 3) c.pos[0] -= 4 / 30; while (h.events.length) { const [t, ty, i] = h.events.shift(); if (ty === 'glance' && i.sp === sp) r = true; } if (sp.state === 'carry') cr = true; });
    if (r || (sp._shield)) react++; if (cr) carry++;
  }
  out.feedIntruder = { trials: n, reacted: react, carriedAway: carry };
})();

// F) switching to a closer, easier prey that comes into view
(ONLY && !ONLY.includes('F')) || (() => {
  let sw = 0, n = 0;
  for (let s = 0; s < 12; s++) {
    const hab = mkHab(1100 + s); const sp = hab.addSpider('bold', { sat: 0.25, stage: 3, pos: [30, 0, 45] }); sp.fwd = [1, 0, 0]; const J = AI.jump(sp);
    const a = JT.PreyAI.create(hab, 'cricket'); a.pos = [30 + J * 4.5, 0, 45]; sp._seen = { [a.id]: 0 }; AI.noteSeen && AI.noteSeen(hab, sp, a); sp.target = { kind: 'prey', id: a.id, since: 0 }; AI.setState(sp, 'assess'); a.sup = { k: 'floor' }; a.fwd = [-1, 0, 0]; a._frozen = true; a._fakeVel = [0, 0, 0]; hab.data.prey.push(a);
    let b = null, done = false;
    run(hab, 20, (h) => {
      if (!b && sp.target && sp.target.id === a.id && (sp.state === 'stalk' || sp.state === 'creep') && M.dist(sp.pos, a.pos) > J * 2.4) { b = JT.PreyAI.create(h, 'pinhead'); b.pos = [sp.pos[0] + J * 1.2, 0, sp.pos[2] + 4]; b.sup = { k: 'floor' }; b.fwd = [0, 0, 1]; b._frozen = true; b._fakeVel = [0, 0, 1.6]; h.data.prey.push(b); b._t0 = h._t; }
      if (b && sp.target && sp.target.id === b.id) { done = true; return true; } if (b && h._t - b._t0 > 4) return true; });
    if (b) { n++; if (done) sw++; }
  }
  out.switching = { trials: n, switched: sw };
})();

// G) catches on thin footing: some slip, hang on the dragline, climb back up before eating; ground catches never slip
(ONLY && !ONLY.includes('G')) || (() => {
  if (!NEW) { out.slip = 'n/a'; return; }
  let n = 0, slipped = 0, ateHanging = 0, climbedBack = 0, ground = 0, groundSlip = 0;
  for (let s = 0; s < 40; s++) {
    const hab = mkHab(1300 + s); const inst = hab.addDecor('ficus', 100, 45, 0, 3 + s); if (!inst) continue;
    const g = hab.geoms[inst.id]; const pa = 1 + (s % (g.paths.length - 1)); const seg = g.paths[pa].pts.length - 2;
    const onTree = s % 4 !== 0;
    const sp = hab.addSpider('bold', { sat: 0.3, stage: 1, pos: onTree ? g.paths[pa].pts[seg].slice() : [40, 0, 45], sup: onTree ? { k: 'path', d: inst.id, p: pa, s: seg, t: 0 } : { k: 'floor' } });
    const meal = JT.PreyAI.create(hab, 'housefly'); meal.owner = sp.id; meal.state = 'held'; hab.data.prey.push(meal); sp.hold = meal.id;
    AI.H.subdue && (AI.setState(sp, 'subdue'), 0); sp._subdueDur = 1; // replaced by beginSubdue below
    JT.SpiderAI._beginSubdue ? JT.SpiderAI._beginSubdue(hab, sp) : null;
    let sl = false, hangFeed = false, back = false;
    run(hab, 30, (h) => { if (sp._hang) sl = true; if (sp.state === 'feed' && sp._hang) hangFeed = true; if (sl && !sp._hang && (sp.state === 'carry' || sp.state === 'feed')) back = true; return sp.state === 'feed' || sp.state === 'postFeed'; });
    if (onTree) { n++; if (sl) slipped++; if (hangFeed) ateHanging++; if (back) climbedBack++; } else { ground++; if (sl) groundSlip++; }
  }
  out.slip = { treeCatches: n, slipped, climbedBack, ateHanging, groundCatches: ground, groundSlips: groundSlip };
})();
for (const k in out) console.log(k.padEnd(13), JSON.stringify(out[k]));
