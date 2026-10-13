// Personality + "curiosity about you" checks. node tests/personality.js [index.html]
const { load } = require('./harness');
const JT = load(process.argv[2]); const M = JT.M, AI = JT.SpiderAI;
const ok = [], bad = []; const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
function mk(seed) { JT.reseed(seed); const h = new JT.Habitat({ type: 'standard' }); JT.Presets.generate(h, 'jungle', seed); h._t = 0; h.events = []; h.event = (ty, i) => h.events.push([h._t, ty, i]); return h; }
const step = (h, secs, mon) => { for (let s = 0; s < secs; s += 1 / 30) { h._t += 1 / 30; h.update(1 / 30, true); if (mon && mon(h) === true) return true; } return false; };
// 1) every jumper gets a stable personality with a title and 2 visible traits
{ const h = mk(3); const titles = new Set(); let stable = true, n = 0;
  for (const id of JT.SPECIES.map(S => S.id)) for (let k = 0; k < 6; k++) { const sp = h.addSpider(id, { stage: 3 }); const a = AI.personality(sp), b = AI.personality(sp); n++;
    if (!a || !a.title || a.shown.length < 2 || JSON.stringify(a) !== JSON.stringify(b)) stable = false; titles.add(a && a.title); h.removeEntity(sp, 'player'); }
  t('personality stable + titled', stable, n); t('variety of titles', titles.size >= 8, [...titles]); }
// 2) finger reactions by temperament
function trial(ids, opts) { const out = { states: {}, cover: 0, curious: 0, journal: {} };
  for (let s = 0; s < 12; s++) { const h = mk(40 + s); const sp = h.addSpider('regal', { stage: 4, sat: 0.95 }); sp.tame = opts.tame || 0;
    step(h, 3); if ((AI.PRI[sp.state] || 0) >= 15) step(h, 6); sp._pc = { t: sp.stage | 0, ids };
    const fp = [M.clamp(sp.pos[0] + 14, 2, h.dims.w - 2), sp.pos[1], M.clamp(sp.pos[2] - 6, 2, h.dims.d - 2)];
    let seen = null; h.finger = { id: 1, pos: fp, t: h._t, held: !!opts.held, fast: !!opts.fast };
    step(h, 4, () => { if (opts.held) h.finger.t = h._t; if (!seen && ['curious', 'fingerWatch', 'display', 'explore'].includes(sp.state) && sp.st < 0.5) seen = sp.state; });
    out.states[seen] = (out.states[seen] || 0) + 1; if (/cover|hiding/i.test(sp.thought || '') || seen === 'explore') out.cover++; if (seen === 'curious') out.curious++;
    for (const e of h.events) if (e[1] === 'journal') out.journal[e[2].id] = (out.journal[e[2].id] || 0) + 1;
    if (opts.check) opts.check(h, sp, fp, out); }
  return out; }
const curious = trial(['curious', 'bold'], {}); t('curious jumpers come to look', curious.curious >= 9 && curious.journal.fingerCurious >= 9, curious);
const shy = trial(['shy', 'restless'], {}); t('shy jumpers hide or watch warily', shy.curious <= 2 && (shy.states.explore || 0) + (shy.states.fingerWatch || 0) >= 8, shy);
const fast = trial(['curious', 'busy'], { fast: true }); t('fast swipe startles even curious ones', fast.curious <= 1, fast);
let closer = 0; trial(['curious', 'bold'], { held: true, check: (h, sp, fp) => { const d0 = M.dist(sp.pos, fp); step(h, 8, () => { h.finger.t = h._t; }); if (M.dist(sp.pos, fp) < d0 - 1 || M.dist(sp.pos, fp) < 10) closer++; } });
t('held finger: curious jumper creeps closer', closer >= 5, closer);
// 3) taming grows with gentle visits and persists in saves
{ const h = mk(9); const sp = h.addSpider('regal', { stage: 4, sat: 0.95 }); sp._pc = { t: 4, ids: ['curious', 'patient'] }; step(h, 3);
  for (let k = 0; k < 15; k++) { h.finger = { id: 100 + k, pos: [sp.pos[0] + 10, sp.pos[1], sp.pos[2]], t: h._t, held: false, fast: false }; sp._fingerCD = 0; step(h, 6); }
  t('tameness grows', sp.tame > 0.25, sp.tame); const g = new JT.Game(); g.newGame(); g.hab.data.spiders[0].tame = 0.5; g.save(); const g2 = new JT.Game(); g2.load(); t('tameness saved', g2.hab.data.spiders[0].tame === 0.5, g2.hab.data.spiders[0].tame); }
// 4) no finger => no change to the deterministic sim (finger code draws no random numbers)
{ const a = mk(77); const s1 = a.addSpider('regal', { stage: 3 }); step(a, 30); const b = mk(77); const s2 = b.addSpider('regal', { stage: 3 }); b.finger = null; step(b, 30);
  t('deterministic without finger', JSON.stringify(s1.pos) === JSON.stringify(s2.pos), [s1.pos, s2.pos]); }
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, bad }));
