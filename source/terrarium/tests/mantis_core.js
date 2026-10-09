// Mantis build: core game rules (headless). node tests/mantis_core.js [dist/mantis-terrarium/index.html]
const path = require('path'); const { load } = require('./legacy/harness');
const JT = load(process.argv[2] || path.join(__dirname, '..', 'dist/mantis-terrarium/index.html'));
const ok = [], bad = []; const t = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' :: ' + JSON.stringify(i)));
const SP = ['carolina', 'chinese', 'european', 'ghost', 'spiny', 'orchid', 'boxer', 'budwing', 'bark', 'stick', 'deadleaf', 'violin', 'giantasian', 'devilsflower'];
const NEW = SP.slice(6); const M = JT.M;
t('pack identity', JT.PACK ? JT.PACK.id === 'mantis' : true, JT.PACK);
t('14 mantis species', SP.every(s => JT.SPECIES_BY_ID[s]) && JT.SPECIES.length === 14, JT.SPECIES.map(s => s.id));
t('unlock order', JT.UNLOCK_ORDER.join() === SP.join(), JT.UNLOCK_ORDER);
const g = new JT.Game(); g.newGame(); const st = g.state, h = g.hab;
t('start: carolina only', st.species.join() === 'carolina', st.species);
t('start: one tank, one carolina nymph', g.habs.length === 1 && h.spiders.length === 1 && h.spiders[0].species === 'carolina', h.spiders.map(s => s.species));
t('2nd carolina ok', g.canAdd(h, 'carolina').ok); h.addSpider('carolina', { stage: 1 });
t('3rd blocked (max 2 per tank)', !g.canAdd(h, 'carolina').ok, g.canAdd(h, 'carolina'));
t('locked chinese blocked', !g.canAdd(g.createHabitat('standard'), 'chinese').ok);
h.spiders[0].stage = 5; g.checkUnlocks(); t('adult carolina unlocks chinese', g.isUnlocked('chinese') && !g.isUnlocked('european'), st.species);
const nano = g.createHabitat('nano'); nano.addSpider('carolina', { stage: 1 }); t('nano cap 1', !g.canAdd(nano, 'carolina').ok, g.canAdd(nano, 'carolina'));
t('no mesh lid decor', !JT.DECOR_BY_ID.meshlid && g.habs.every(x => !x.data.decor.some(d => d.type === 'meshlid')));
const old = g.createHabitat('standard'); old.data.decor.push({ id: 'dLID', type: 'meshlid', x: 50, z: 30, rot: 0, seed: 1 }); old.rebuild(); t('old saves: lid stripped', !old.data.decor.some(d => d.type === 'meshlid'));
for (const id of ['crossperch', 'tallTwig', 'twigtangle', 'flowerspike', 'orchidspray', 'deadleafbranch', 'bamboo', 'spanishmoss', 'leafcluster', 'barkslab']) { const d = JT.DECOR_BY_ID[id]; t('decor ' + id, !!d && !!JT.Geo.build({ id: 'x', type: id, x: 50, z: 30, rot: 0, seed: 3 })); }
t('biomes', ['orchidgarden', 'dryleaf'].every(b => JT.BIOMES[b] && JT.BIOME_ORDER.includes(b) && JT.BIOMES[b].icon), JT.BIOME_ORDER);
t('homes', JT.Biomes.homeOf('orchid') === 'orchidgarden' && JT.Biomes.homeOf('ghost') === 'dryleaf' && JT.Biomes.homeOf('carolina') === 'oldbark');
for (const b of ['orchidgarden', 'dryleaf']) { const hb = g.createHabitat('standard'); const th = JT.Biome.layout(hb, b, 99); t('layout ' + b, th === b && hb.decor.length > 4, [th, hb.decor.length]); }
t('journal: no spider entries', !JT.JOURNAL.some(e => ['retreat', 'safety', 'dangle', 'semaphore'].includes(e.id)));
t('journal: mantis entries', ['eatenAlive', 'leftovers', 'mantisGroom', 'hangMolt', 'mantisFlight', 'mantisThreat', 'flowerLure', 'camoHunt'].every(id => JT.JOURNAL.some(e => e.id === id) && JT.JOURNAL_META[id]));
t('no silk', JT.SpiderAI.NO_SILK === true);

// ---- v1.2 ----
const HOME12 = { boxer: 'rainforest', budwing: 'heath', bark: 'oldbark', stick: 'prairie', deadleaf: 'dryleaf', violin: 'desert', giantasian: 'rainforest', devilsflower: 'orchidgarden' };
t('v1.2 homes', NEW.every(s => JT.Biomes.homeOf(s) === HOME12[s]), NEW.map(s => JT.Biomes.homeOf(s)));
t('v1.2 species data', NEW.every(s => { const S = JT.SPECIES_BY_ID[s]; return S.desc && S.len && S.pal && S.traits && S.prefs && S.mlook && S.mflags && S.ooth; }), NEW.filter(s => !JT.SPECIES_BY_ID[s].mflags));
t('v1.2 species journal entries', ['boxing', 'wingBuzz', 'barkSprint', 'stickFlat', 'playDead', 'violinFlyer', 'giantStare', 'flowerDisplay', 'flowerHang'].every(id => JT.JOURNAL.some(e => e.id === id) && JT.JOURNAL_META[id] && JT.JOURNAL_META[id][1]));
t('v1.2 behaviour + life journal entries', ['missedStrike', 'peering', 'nightShift', 'breezeSway', 'eyeWipe', 'beadSip', 'morningBask', 'elder', 'colourShift', 'oothLaid', 'oothHard', 'hatchDay', 'courtship', 'mating', 'eatenByMate'].every(id => JT.JOURNAL.some(e => e.id === id) && JT.JOURNAL_META[id]));
{ // unlock chain: each adult unlocks the next
  const gu = new JT.Game(); gu.newGame(); let okc = true; const hu = gu.hab;
  for (let i = 0; i < SP.length - 1; i++) { if (gu.isUnlocked(SP[i + 1])) { okc = false; break; } hu.spiders.length = 0; const s = hu.addSpider(SP[i], { stage: 5 }); gu.checkUnlocks(); if (!gu.isUnlocked(SP[i + 1])) { okc = false; break; } }
  t('v1.2 unlock chain to devil\u2019s flower', okc && gu.isUnlocked('devilsflower'), gu.state.species);
}
t('decor tags: Spanish moss not wet, bark slab is bark', !JT.Biomes.tags(JT.DECOR_BY_ID.spanishmoss).wet && JT.Biomes.tags(JT.DECOR_BY_ID.barkslab).bark && !JT.Biomes.tags(JT.DECOR_BY_ID.barkslab).urban);
t('themes use new decor', JT.PRESET_THEMES.dryleaf.mid.includes('leafcluster') && JT.PRESET_THEMES.orchidgarden.tall.includes('bamboo'));
{ // sex: new mantises get one; old saves get one on load (tanks and holding cup)
  const gs = new JT.Game(); gs.newGame(); const a = gs.hab.addSpider('chinese', { stage: 2 });
  t('new mantis has a sex', a.sex === 'f' || a.sex === 'm', a.sex);
  const raw = JSON.parse(gs.serialize()); for (const h of raw.habitats) for (const s of h.spiders) delete s.sex; raw.cup = [Object.assign(JSON.parse(JSON.stringify(raw.habitats[0].spiders[0])), { id: 'cupX' })]; delete raw.cup[0].sex;
  JT.Store.set('mantisTerrarium.v1.save', JSON.stringify(raw)); const g3 = new JT.Game(); const okl = g3.load();
  t('old save: sex assigned on load', okl && g3.habs.every(h => h.spiders.every(s => s.sex === 'f' || s.sex === 'm')) && (g3.state.cup || []).every(s => s.sex === 'f' || s.sex === 'm'), g3.habs.map(h => h.spiders.map(s => s.sex)));
  g3.save(); const raw2 = JSON.parse(JT.Store.get('mantisTerrarium.v1.save')); t('sex persists in saves', raw2.habitats[0].spiders.every(s => s.sex === 'f' || s.sex === 'm'));
}
{ // courtship → pair → gravid → egg case → harden → hatch; tank cap respected
  const AI = JT.SpiderAI; const gl = new JT.Game(); gl.newGame(); const hl = gl.createHabitat('standard'); gl.state.active = gl.habs.indexOf(hl); JT.Biome.layout(hl, 'rainforest', 5); hl.spiders.length = 0;
  const f = hl.addSpider('chinese', { stage: 5, sex: 'f' }), m = hl.addSpider('chinese', { stage: 5, sex: 'm' }); f.sat = m.sat = 0.9;
  f.pos = hl.randomFloorPoint(); m.pos = M3(f.pos, 30); f.sup = { k: 'floor' }; m.sup = { k: 'floor' };
  AI.mantisStartCourt(hl, m, f); m._mForceEat = 0; let paired = false, err2 = null;
  try { for (let i = 0; i < 60 * 400 && !f.gravid; i++) { gl.tick(1 / 60); if (m.state === 'mPaired') paired = true; if (m.state === 'idle' && !paired && i > 60) { AI.mantisStartCourt(hl, m, f); m._mForceEat = 0; } } } catch (e) { err2 = e.stack.split('\n').slice(0, 3).join(' | '); }
  t('courtship leads to a pair', paired, [m.state, f.state, err2, m.thought, f.thought, m.sex, f.sex, m.stage, f.stage, JT.M.dist(m.pos, f.pos)]); t('female gravid after mating', !!f.gravid && hl.spiders.includes(m), [f.gravid, m.state]);
  if (f.gravid) f.gravid.d = (f.ageDays || 0) - 1; let o = null;
  try { for (let i = 0; i < 60 * 200 && !(hl.data.ooth && hl.data.ooth.length); i++) gl.tick(1 / 60); } catch (e) { err2 = e.stack.split('\n').slice(0, 3).join(' | '); }
  o = hl.data.ooth && hl.data.ooth[0]; t('egg case laid', !!o && o.species === 'chinese' && !f.gravid && M.finite3(o.pos), [f.state, err2]);
  if (o) {
    o.age = AI.LIFE.HARD_DAYS + 0.01; gl.tick(1 / 60); t('egg case hardens', o.state === 'hard' && o.hard, o.state);
    const cup0 = (gl.state.cup || []).length; o.age = AI.LIFE.HATCH_DAYS + 0.01; gl.tick(1 / 60); t('hatching starts', o.state === 'hatching' && hl._mHatch && hl._mHatch.length === 1, o.state);
    for (let i = 0; i < 60 * 12; i++) gl.tick(1 / 60);
    const r = o.result || {}; t('hatch: cap respected + per-species', o.state === 'empty' && hl.spiders.length <= hl.dims.cap && hl.spiders.filter(s => s.species === 'chinese').length <= JT.PER_SPECIES, [o.state, hl.spiders.length, hl.dims.cap]);
    t('hatch: dozens, the rest to cup or released', r.total >= 24 && r.keep + r.cup + r.released === r.total && r.cup <= 3 && (gl.state.cup || []).length - cup0 === r.cup, r);
  }
  // eaten by his mate
  const hm = gl.createHabitat('standard'); gl.state.active = gl.habs.indexOf(hm); hm.spiders.length = 0; const f2 = hm.addSpider('european', { stage: 5, sex: 'f' }), m2 = hm.addSpider('european', { stage: 5, sex: 'm' }); f2.sat = 0.2;
  m2.pos = f2.pos.slice(); m2.sup = JT.deepClone(f2.sup); AI.mantisStartCourt(hm, m2, f2); m2._mForceEat = 1;
  for (let i = 0; i < 60 * 120 && hm.spiders.includes(m2); i++) gl.tick(1 / 60);
  const meal = hm.preyById(f2.hold); t('eaten by his mate', !hm.spiders.includes(m2) && meal && meal.type === 'jumperMeal' && f2.gravid, [hm.spiders.length, f2.state]);
}
function M3(p, d) { return [Math.min(p[0] + d, 90), p[1], p[2]]; }
// simulate every species a few minutes with prey; count meals, no exceptions
const meals = {}; let err = null;
for (const s of SP) { try { const hb = g.createHabitat('standard'); JT.Biome.layout(hb, JT.Biomes.homeOf(s), 7); hb.spiders.length = 0; const sp = hb.addSpider(s, { stage: 3 }); sp.sat = 0.2;
  for (let k = 0; k < 6; k++) hb.addPrey(k % 2 ? 'housefly' : 'cricket'); g.hab = hb; for (let i = 0; i < 60 * 300; i++) hb.update ? hb.update(1 / 60) : g.tick(1 / 60); meals[s] = sp.meals || 0;
  t(s + ': finite pos', sp.pos.every(Number.isFinite), sp.pos); } catch (e) { err = s + ': ' + e.stack.split('\n').slice(0, 3).join(' | '); break; } }
t('sim no exceptions', !err, err); t('every species ate', SP.every(s => meals[s] > 0), meals);
g.save(); const g2 = new JT.Game(); t('save/load roundtrip', g2.load() === true && g2.habs.length === g.habs.length && g2.isUnlocked('chinese'), g2.habs.length);
t('save key is mantis-only', !!JT.Store.get('mantisTerrarium.v1.save') && JT.Store.get('jumperTerrarium.v14.save') == null);
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, meals })); if (bad.length) { console.log('FAILED:\n' + bad.join('\n')); process.exit(1); }
