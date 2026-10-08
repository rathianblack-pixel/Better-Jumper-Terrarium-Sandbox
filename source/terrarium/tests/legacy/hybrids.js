// v11 hybrids: unlock rule, looks, and one signature behaviour each. node tests/hybrids.js [index.html]
const { load } = require('./harness');
const JT = load(process.argv[2]); const M = JT.M, AI = JT.SpiderAI;
const ok = [], bad = [], INFO = {}; const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
function mk(seed, theme) { JT.reseed(seed); const h = new JT.Habitat({ type: 'standard' }); JT.Presets.generate(h, theme || 'jungle', seed); h._t = 0; h.events = []; h.event = (ty, i) => h.events.push([h._t, ty, i]); return h; }
const step = (h, secs, mon) => { for (let s = 0; s < secs; s += 1 / 30) { h._t += 1 / 30; h.update(1 / 30, true); if (mon && mon(h) === true) return true; } return false; };
const jcount = (h, id) => h.events.filter(e => e[1] === 'journal' && e[2].id === id).length;
const HY = ['auralis', 'hyalina', 'ignicard', 'titanica', 'saltator'];
t('five hybrids defined', HY.every(id => JT.SPECIES_BY_ID[id] && JT.SPECIES_BY_ID[id].hybrid && JT.SPECIES_BY_ID[id].unlock.parents.length === 2 && JT.SPECIES_BY_ID[id].unlock.parents.every(p => JT.SPECIES_BY_ID[p])));
t('chain still 20 long', JT.UNLOCK_ORDER.length === 20 && HY.every(id => !JT.UNLOCK_ORDER.includes(id)));
t('scientific names', HY.every(id => / /.test(JT.SPECIES_BY_ID[id].sci)));
t('looks + gaits', HY.every(id => AI.GAIT[JT.SPECIES_BY_ID[id].look.gait]), HY.map(id => JT.SPECIES_BY_ID[id].look.gait));
t('hybrid journal chapter (5)', JT.JOURNAL.filter(j => (JT.JOURNAL_META[j.id] || [])[0] === 'hybrid').length === 5 && JT.JOURNAL_CATS.some(c => c[0] === 'hybrid'));
// unlock: only when both parents reached Adult
{ const g = new JT.Game(); g.newGame(); const st = g.state; st.best = st.best || {};
  st.best.peacock = 5; st.best.emerald = 4; g.checkUnlocks(true); t('auralis waits for both parents', !g.isUnlocked('auralis'));
  st.best.emerald = 5; g.checkUnlocks(true); t('auralis unlocks with both adults', g.isUnlocked('auralis'));
  let ev = []; g.emit = (ty, i) => ev.push([ty, i]); st.best.giant = 5; st.best.portia = 5; g.checkUnlocks(false); t('titanica unlock announced', g.isUnlocked('titanica') && ev.some(e => e[0] === 'unlock' && e[1].S.id === 'titanica' && /hybrid/.test(e[1].why)), ev.map(e => e[0]));
  t('others still locked', !g.isUnlocked('hyalina') && !g.isUnlocked('ignicard') && !g.isUnlocked('saltator'));
  st.best.ant = 5; st.best.magnolia = 5; st.best.orange = 5; st.best.cardinal = 5; st.best.hasarius = 5; st.best.paradise = 5; g.checkUnlocks(true); t('all five unlockable', HY.every(id => g.isUnlocked(id)), st.species); }
// each hybrid lives stably for a while
{ const res = {}; for (const id of HY) { const h = mk(900 + HY.indexOf(id)); const sp = h.addSpider(id, { stage: 4, sat: 0.5 }); h.addPrey('fruitfly', 5); h.addPrey('cricket', 2); let badPos = 0; step(h, 120, () => { if (!M.finite3(sp.pos)) badPos++; }); res[id] = { catches: sp.catches, st: sp.state, bad: badPos }; }
  INFO.live = res; t('hybrids run stably (no NaN)', HY.every(id => res[id].bad === 0), res); t('hybrids hunt', HY.filter(id => res[id].catches > 0).length >= 4, res); }
// Auralis prism display dazzles prey
{ let n = 0, frozen = 0; for (let k = 0; k < 8; k++) { const h = mk(1000 + k, 'flower'); const sp = h.addSpider('auralis', { stage: 5, sat: 0.97 }); h.addPrey('cricket', 3); h.addPrey('pinhead', 4);
    step(h, 200, () => { if (h.data.prey.some(q => q._dazzle && q._dazzle > h._t)) frozen++; }); n += jcount(h, 'prismDisplay'); }
  INFO.prism = { n, frozen }; t('Auralis prism display', n >= 2 && frozen > 0, INFO.prism); }
// Hyalina: prey notice it less than the plain ant mimic
{ const alert = {}; for (const id of ['ant', 'hyalina']) { let a = 0, c = 0; for (let k = 0; k < 6; k++) { const h = mk(1100 + k); const sp = h.addSpider(id, { stage: 4, sat: 0.3 }); h.addPrey('cricket', 3); h.addPrey('fruitfly', 4); step(h, 90, () => { for (const q of h.data.prey) { a += q.alert || 0; c++; } }); } alert[id] = +(a / c).toFixed(3); }
  INFO.glass = alert; t('Hyalina is harder to notice', alert.hyalina < alert.ant * 0.8, alert); }
// Ignicard: awake at night, quicker under a lamp
{ const h = mk(1200); const sp = h.addSpider('ignicard', { stage: 4, sat: 0.6 }); const o = h.addSpider('regal', { stage: 4, sat: 0.6 }); h.daylight = () => 0.05; let sI = 0, sR = 0;
  step(h, 240, () => { if (sp.state === 'sleep') sI++; if (o.state === 'sleep') sR++; }); INFO.ember = { sI, sR }; t('Ignicard stays up at night', sI < sR * 0.5 || (sR > 0 && sI === 0), INFO.ember); }
// Titanica: bigger prey + stronger leap
{ const base = { stage: 5, traits: { jump: 0.8, bold: 0.5 }, soft: 0, sat: 0.2 };
  t('Titanica leaps further than Giant', AI.jump(Object.assign({ species: 'titanica' }, base)) > AI.jump(Object.assign({ species: 'giant' }, base)) * 1.05);
  t('Titanica takes bigger prey', AI.sizeLimit(Object.assign({ species: 'titanica' }, base)) > AI.sizeLimit(Object.assign({ species: 'giant' }, base)));
  let det = 0, leaps = 0; for (let k = 0; k < 8; k++) { const h = mk(1300 + k, k % 2 ? 'canopy' : 'cork'); h.addSpider('titanica', { stage: 5, sat: 0.25 }); h.addPrey('cricket', 3); h.addPrey('dubia', 2); step(h, 200); det += jcount(h, 'portiaDetour'); leaps += jcount(h, 'giantLeap'); }
  INFO.titan = { det, leaps }; t('Titanica detours and power-leaps', det >= 1 && leaps >= 1, INFO.titan); }
// Saltator: trust twice as fast, waves at the finger
{ const g = (id) => { const h = mk(1400); const sp = h.addSpider(id, { stage: 4, sat: 0.95 }); step(h, 3); sp._pc = { t: 4, ids: ['curious', 'bold'] }; let sem = 0;
    for (let k = 0; k < 6; k++) { h.finger = { id: k + 1, pos: [M.clamp(sp.pos[0] + 12, 2, h.dims.w - 2), sp.pos[1], sp.pos[2]], t: h._t, held: false, fast: false }; step(h, 4); h.finger = null; step(h, 2); }
    sem = jcount(h, 'semaphore'); return { tame: +(sp.tame || 0).toFixed(3), sem }; };
  const a = g('saltator'), b = g('hasarius'); INFO.salt = { a, b }; t('Saltator waves at your finger', a.sem >= 1, INFO.salt); t('Saltator warms to you faster', a.tame >= b.tame, INFO.salt); }
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, bad, info: INFO }));
