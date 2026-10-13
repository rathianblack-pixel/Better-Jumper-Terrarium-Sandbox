// Scenario + metrics runner for the jumper AI. Usage: node tests/sim.js [file] -> JSON metrics
const { load } = require('./harness');
const file = process.argv[2];
const JT = load(file); const M = JT.M, AI = JT.SpiderAI;
const lenOf = (e) => e.species ? AI.len(e) : (JT.PREY_BY_ID[e.type] || { len: 3 }).len;
function surf(hab, e, lift) { const fr = e.sup && e.sup.k !== 'air' && JT.Nav.validSup(hab, e.sup) ? JT.Nav.supFrame(hab, e.sup) : { n: [0, 1, 0], r: 0 }; return M.add(e.pos, M.mul(fr.n, (fr.r || 0) + (lift || 0))); }
function blocked(hab, a, b, skip) { // independent solid test (does not use the AI's own helper)
  const L = M.dist(a, b); const n = Math.max(2, Math.ceil(L / 1.0));
  for (let k = 1; k < n; k++) { const t = k / n; if (t * L < skip || (1 - t) * L < skip) continue; const p = M.lerp3(a, b, t);
    for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (!g) continue; const h = JT.Solid.at(g, p, 0); if (h && h.d > 0.6) return true; } }
  return false;
}
function mkHab(type, theme, seed) {
  JT.reseed(seed); const hab = new JT.Habitat({ type: type || 'standard' }); if (theme) JT.Presets.generate(hab, theme, seed);
  hab._t = 0; hab.events = []; hab.event = (t, i) => hab.events.push([hab._t, t, i]); return hab;
}
function step(hab, secs, mon) { const dt = 1 / 30; for (let t = 0; t < secs; t += dt) { hab._t += dt; hab.update(dt, true); if (mon) mon(hab, dt); } }

function generic(seed, theme, mins) {
  const hab = mkHab('standard', theme, seed);
  const sps = ['bold', 'regal', 'zebra', 'bold'].map((s, i) => hab.addSpider(JT.SPECIES_BY_ID[s] ? s : 'bold', { sat: 0.3, stage: 1 + (i % 4) }));
  ['fruitfly', 'pinhead', 'housefly', 'cricket', 'dubia', 'gnat'].forEach(p => hab.addPrey(p));
  const m = { pounces: 0, through: 0, catches: 0, misses: 0, notices: 0, seenThrough: 0, switches: 0, neighbourChecks: 0, neighbourFled: 0, glances: 0, slips: 0, paceSamples: [], ttc: [] };
  const lastT = {}; const noticeAt = {}; const pend = [];
  const mon = (h) => {
    for (const sp of h.spiders) {
      const tid = sp.target && sp.target.id;
      if (tid && tid !== lastT[sp.id]) { const e = AI.targetEnt(h, sp); if (lastT[sp.id] && AI.HUNT.has(sp.state)) m.switches++; else { m.notices++; noticeAt[sp.id] = h._t; } if (e && blocked(h, surf(h, sp, lenOf(sp) * 0.35), surf(h, e, 0.6), 1.2)) m.seenThrough++; }
      lastT[sp.id] = tid;
      if ((sp.state === 'stalk' || sp.state === 'creep') && sp._paceNow != null) m.paceSamples.push(sp._paceNow);
      if (sp.state === 'carry' && sp._pst !== 'carry') { m.carries = (m.carries || 0) + 1; if (/away from/.test(sp.thought)) m.carryAway = (m.carryAway || 0) + 1; }
      if (sp.state === 'peek' && sp._pst !== 'peek') m.peeks = (m.peeks || 0) + 1; if (sp.state === 'avoid' && sp._pst !== 'avoid') m.backoffs = (m.backoffs || 0) + 1; sp._pst = sp.state;
      m.states = m.states || {}; m.states[sp.state] = (m.states[sp.state] || 0) + 1;
    }
    while (h.events.length) { const [t, type, info] = h.events.shift(); const sp = info.sp;
      if (type === 'pounce' && sp && sp._air) { m.pounces++; const a = sp._air.from, b = sp._air.to; if (blocked(h, a, b, Math.max(1.2, lenOf(sp) * 0.5))) m.through++;
        const e = AI.targetEnt(h, sp); if (e) { const nb = h.prey.filter(q => q !== e && !q.owner && !q.buried && M.dist(q.pos, e.pos) < 18).map(q => [q, q.pos.slice()]); if (nb.length) pend.push({ t: h._t + 1.5, nb }); } }
      if (type === 'catch') { m.catches++; if (noticeAt[sp.id] != null) m.ttc.push(h._t - noticeAt[sp.id]); }
      if (type === 'miss') m.misses++;
      if (type === 'glance') m.glances++; if (type === 'slip') m.slips++;
    }
    for (let i = pend.length - 1; i >= 0; i--) if (h._t >= pend[i].t) { for (const [q, p0] of pend[i].nb) { m.neighbourChecks++; if (['flee', 'fly', 'hop', 'buried', 'freeze'].includes(q.state) || M.dist(q.pos, p0) > 4) m.neighbourFled++; } pend.splice(i, 1); }
    if (h.prey.filter(p => !p.owner && JT.PREY_BY_ID[p.type].huntable).length < 6) ['fruitfly', 'pinhead', 'housefly'].forEach(p => h.addPrey(p, 2));
    for (const sp of h.spiders) if (sp.sat > 0.6 && !sp.hold) sp.sat = 0.3; // keep them hunting
  };
  step(hab, mins * 60, mon);
  const ps = m.paceSamples; const mean = ps.reduce((a, b) => a + b, 0) / (ps.length || 1); const sd = Math.sqrt(ps.reduce((a, b) => a + (b - mean) ** 2, 0) / (ps.length || 1));
  delete m.paceSamples; m.paceMean = +mean.toFixed(3); m.paceSD = +sd.toFixed(3); m.ttcMean = +(m.ttc.reduce((a, b) => a + b, 0) / (m.ttc.length || 1)).toFixed(1); delete m.ttc;
  return m;
}
const t0 = Date.now(); const out = {}; const runs = [[11, 'jungle'], [22, 'forest'], [33, 'meadow'], [44, 'ruin']];
const themes = JT.PRESETS ? [...new Set(JT.PRESETS.map(p => p[1]))] : [];
const tot = {};
for (const [s, th] of runs) { const r = generic(s, themes.includes(th) ? th : themes[s % themes.length], +(process.env.MINS || 6)); for (const k in r) { if (k === 'states') { tot.states = tot.states || {}; for (const q in r.states) tot.states[q] = (tot.states[q] || 0) + r.states[q]; } else tot[k] = (tot[k] || 0) + r[k]; } }
for (const k of ['paceMean', 'paceSD', 'ttcMean']) tot[k] = +(tot[k] / runs.length).toFixed(3);
if (tot.states) { const T = Object.values(tot.states).reduce((a, b) => a + b, 0); for (const q in tot.states) tot.states[q] = +(tot.states[q] / T * 100).toFixed(1); tot.states = Object.fromEntries(Object.entries(tot.states).sort((a, b) => b[1] - a[1]).slice(0, 14)); }
out.generic = tot; out.ms = Date.now() - t0;
console.log(JSON.stringify(out));
