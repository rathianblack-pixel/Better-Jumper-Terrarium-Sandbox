// Mantis build: core game rules (headless). node tests/mantis_core.js [dist/mantis-terrarium/index.html]
const path = require('path'); const { load } = require('./legacy/harness');
const JT = load(process.argv[2] || path.join(__dirname, '..', 'dist/mantis-terrarium/index.html'));
const ok = [], bad = []; const t = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' :: ' + JSON.stringify(i)));
const SP = ['carolina', 'chinese', 'european', 'ghost', 'spiny', 'orchid'];
t('pack identity', JT.PACK ? JT.PACK.id === 'mantis' : true, JT.PACK);
t('6 mantis species', SP.every(s => JT.SPECIES_BY_ID[s]) && JT.SPECIES.length === 6, JT.SPECIES.map(s => s.id));
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
for (const id of ['crossperch', 'tallTwig', 'twigtangle', 'flowerspike', 'orchidspray', 'deadleafbranch']) { const d = JT.DECOR_BY_ID[id]; t('decor ' + id, !!d && !!JT.Geo.build({ id: 'x', type: id, x: 50, z: 30, rot: 0, seed: 3 })); }
t('biomes', ['orchidgarden', 'dryleaf'].every(b => JT.BIOMES[b] && JT.BIOME_ORDER.includes(b) && JT.BIOMES[b].icon), JT.BIOME_ORDER);
t('homes', JT.Biomes.homeOf('orchid') === 'orchidgarden' && JT.Biomes.homeOf('ghost') === 'dryleaf' && JT.Biomes.homeOf('carolina') === 'oldbark');
for (const b of ['orchidgarden', 'dryleaf']) { const hb = g.createHabitat('standard'); const th = JT.Biome.layout(hb, b, 99); t('layout ' + b, th === b && hb.decor.length > 4, [th, hb.decor.length]); }
t('journal: no spider entries', !JT.JOURNAL.some(e => ['retreat', 'safety', 'dangle', 'semaphore'].includes(e.id)));
t('journal: mantis entries', ['eatenAlive', 'leftovers', 'mantisGroom', 'hangMolt', 'mantisFlight', 'mantisThreat', 'flowerLure', 'camoHunt'].every(id => JT.JOURNAL.some(e => e.id === id) && JT.JOURNAL_META[id]));
t('no silk', JT.SpiderAI.NO_SILK === true);
// simulate every species a few minutes with prey; count meals, no exceptions
const meals = {}; let err = null;
for (const s of SP) { try { const hb = g.createHabitat('standard'); JT.Biome.layout(hb, JT.Biomes.homeOf(s), 7); hb.spiders.length = 0; const sp = hb.addSpider(s, { stage: 3 }); sp.sat = 0.2;
  for (let k = 0; k < 6; k++) hb.addPrey(k % 2 ? 'housefly' : 'cricket'); g.hab = hb; for (let i = 0; i < 60 * 300; i++) hb.update ? hb.update(1 / 60) : g.tick(1 / 60); meals[s] = sp.meals || 0;
  t(s + ': finite pos', sp.pos.every(Number.isFinite), sp.pos); } catch (e) { err = s + ': ' + e.stack.split('\n').slice(0, 3).join(' | '); break; } }
t('sim no exceptions', !err, err); t('every species ate', SP.every(s => meals[s] > 0), meals);
g.save(); const g2 = new JT.Game(); t('save/load roundtrip', g2.load() === true && g2.habs.length === g.habs.length && g2.isUnlocked('chinese'), g2.habs.length);
t('save key is mantis-only', !!JT.Store.get('mantisTerrarium.v1.save') && JT.Store.get('jumperTerrarium.v14.save') == null);
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, meals })); if (bad.length) { console.log('FAILED:\n' + bad.join('\n')); process.exit(1); }
