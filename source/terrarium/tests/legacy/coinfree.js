// Coin-free rework checks: unlock chain, per-species cap, free shelf, saves, new prey. node tests/coinfree.js
const { load } = require('./harness');
const JT = load(process.argv[2]); const ok = []; const bad = [];
const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
const g = new JT.Game(); g.newGame();
const st = g.state, h = g.hab;
t('no coins field', !('coins' in st) && !('slots' in st), Object.keys(st));
t('start: only peacock unlocked', st.species.length === 1 && st.species[0] === 'peacock', st.species);
t('start: one tank with a peacock sling', g.habs.length === 1 && h.spiders.length === 1 && h.spiders[0].species === 'peacock' && h.spiders[0].stage === 1, h.spiders.map(s => [s.species, s.stage]));
t('start: prey present', h.prey.some(p => p.type === 'aphid'), h.prey.map(p => p.type));
t('chain order', JT.UNLOCK_ORDER[0] === 'peacock' && JT.UNLOCK_ORDER[JT.UNLOCK_ORDER.length - 1] === 'orange' && !JT.UNLOCK_ORDER.includes('portia') && JT.UNLOCK_ORDER.length === 20, JT.UNLOCK_ORDER);
for (let i = 1; i < JT.UNLOCK_ORDER.length; i++) if (JT.SPECIES_BY_ID[JT.UNLOCK_ORDER[i]].len < JT.SPECIES_BY_ID[JT.UNLOCK_ORDER[i - 1]].len) t('chain sorted', false, i);
t('no species/decor/prey/habitat price data', JT.SPECIES.every(S => S.price == null && !S.starter && S.minStage == null) && JT.DECOR.every(d => d.price == null) && JT.PREY.every(p => p.price == null && p.val == null) && Object.values(JT.HABITATS).every(x => x.price == null) && Object.values(JT.SUBSTRATES).every(x => x.price == null), 0);
t('locked zebra cannot be added', !g.canAdd(h, 'zebra').ok, g.canAdd(h, 'zebra'));
// per-species cap: 2 per tank
t('2nd peacock ok', g.canAdd(h, 'peacock').ok); h.addSpider('peacock', { stage: 1 });
t('3rd peacock blocked', !g.canAdd(h, 'peacock').ok && /per tank/.test(g.canAdd(h, 'peacock').reason), g.canAdd(h, 'peacock'));
// growing peacock to adult unlocks zebra only
const evs = []; g.on((ty, d) => evs.push([ty, d && d.S && d.S.id]));
h.spiders[0].stage = 4; g.checkUnlocks(); t('young adult does not unlock', !g.isUnlocked('zebra'));
h.spiders[0].stage = 5; g.checkUnlocks();
t('adult peacock unlocks zebra', g.isUnlocked('zebra') && !g.isUnlocked('twinflag'), st.species);
t('unlock event emitted', evs.some(e => e[0] === 'unlock' && e[1] === 'zebra'), evs);
// unlock persists after rehoming; best kept
h.removeEntity(h.spiders[0], 'player'); g.checkUnlocks(); t('unlock persists after rehoming', g.isUnlocked('zebra') && st.best.peacock === 5, st.best);
// a real molt via the AI path to adult unlocks the next one
const z = h.addSpider('zebra', { stage: 4 }); z.meals = 99; z.sat = 0.9; JT.SpiderAI.setState ? 0 : 0;
st.best.zebra = 4; z.stage = 5; g.onEvent(h, 'molt', { sp: z }); t('molt event unlocks twinflag', g.isUnlocked('twinflag'), st.species);
// portia by catches only
st.catches = 29; g.checkUnlocks(); t('portia locked at 29', !g.isUnlocked('portia'));
g.onEvent(h, 'meal', { sp: z }); t('portia unlocked at 30 catches', g.isUnlocked('portia') && st.catches === 30, st.catches);
// tank cap still applies
const nano = g.createHabitat('nano'); t('createHabitat free', !!nano && g.habs.length === 2);
nano.addSpider('peacock', { stage: 1 }); t('nano cap 1', !g.canAdd(nano, 'zebra').ok && /full/.test(g.canAdd(nano, 'zebra').reason), g.canAdd(nano, 'zebra'));
while (g.createHabitat('standard')); t('max 30 tanks', g.habs.length === 30, g.habs.length);
t('changeType free', g.changeType(nano, 'cube') === true && nano.data.type === 'cube');
// save / load roundtrip
g.save(); const g2 = new JT.Game(); t('load v4 save', g2.load() === true && g2.habs.length === 30 && g2.isUnlocked('portia') && g2.state.best.peacock === 5 && !('coins' in g2.state), g2.state && Object.keys(g2.state));
// old (v3) save is wiped
JT.Store.set('jumperTerrarium.v14.save', JSON.stringify({ v: 3, coins: 9999, species: ['bold', 'regal', 'canopy', 'giant'], habitats: [{ name: 'x', type: 'standard', decor: [], spiders: [], prey: [] }], customPresets: [{ name: 'mine' }] }));
const g3 = new JT.Game(); const r3 = g3.load(); t('v3 save not loaded (fresh start)', r3 === false && g3._wiped === true && JT.Store.get('jumperTerrarium.v14.save') == null && !!JT.Store.get('jumperTerrarium.v14.save.pre4'));
g3.newGame(); t('fresh after wipe', g3.state.species.join() === 'peacock' && g3.state.customPresets.length === 0 && !('coins' in g3.state));
t('import of old save rejected', g3.importSave(JSON.stringify({ v: 3, coins: 5, habitats: [{ name: 'x', type: 'standard' }] })) === false && g3.state.species.join() === 'peacock');
// new prey: creatable, simulate a peacock sling + every new prey for a few minutes
const NEW = ['aphid', 'hydei', 'leafhopper', 'mosquito', 'mealmoth', 'redrunner', 'bsfl', 'hornworm'];
t('new prey defined', NEW.every(id => JT.PREY_BY_ID[id]), NEW.filter(id => !JT.PREY_BY_ID[id]));
JT.reseed(7); const hab = new JT.Habitat({ type: 'standard' }); JT.Presets.generate(hab, [...new Set(JT.PRESETS.map(p => p[1]))][0], 7);
hab._t = 0; const meals = {}; hab.event = (ty, info) => { if (ty === 'meal' && info.sp) meals[info.sp.species] = (meals[info.sp.species] || 0) + 1; };
const sps = [hab.addSpider('peacock', { stage: 1, sat: 0.2 }), hab.addSpider('giant', { stage: 5, sat: 0.2 }), hab.addSpider('emerald', { stage: 3, sat: 0.2 })];
NEW.forEach(id => hab.addPrey(id, JT.PREY_BY_ID[id].count || 1));
let errs = 0; const eaten = new Set(); const before = new Set(hab.prey.map(p => p.id + ':' + p.type));
for (let i = 0; i < 30 * 60 * 6; i++) { try { hab.update(1 / 30, true); } catch (e) { errs++; if (errs < 3) console.error(e); } for (const s of sps) if (s.sat > 0.6 && !s.hold) s.sat = 0.25; }
const after = new Set(hab.prey.map(p => p.id)); for (const k of before) if (!after.has(k.split(':')[0])) eaten.add(k.split(':')[1]);
t('6 min sim with new prey: no errors', errs === 0, errs);
t('new prey get hunted', eaten.size >= 3, [...eaten]);
t('positions finite', hab.prey.concat(hab.spiders).every(e => e.pos.every(Number.isFinite)));
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, eaten: [...eaten], meals }));
if (bad.length) { console.log('FAILED:\n' + bad.join('\n')); process.exit(1); }
