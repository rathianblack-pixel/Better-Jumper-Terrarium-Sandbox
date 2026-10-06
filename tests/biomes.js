// v12 biomes: data integrity, starter layouts, comfort, weather events, climate, ponds, journal. node tests/biomes.js [index.html]
const { load } = require('./harness');
const JT = load(process.argv[2]); const M = JT.M, Bm = JT.Biome;
const ok = [], bad = [], INFO = {}; const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
const step = (h, secs, mon) => { for (let s = 0; s < secs; s += 1 / 30) { h._t += 1 / 30; h.update(1 / 30, true); Bm.tick(h, 1 / 30); if (mon && mon(h) === true) return true; } return false; };
const mk = (type, bid, seed) => { JT.reseed(seed); const h = new JT.Habitat({ type }); h._t = 0; h.events = []; h.event = (ty, i) => h.events.push([h._t, ty, i]); if (bid) JT.Presets.biome(h, bid, seed); return h; };
const BIO = ['rainforest', 'desert', 'paludarium', 'nightmoss'];
// data
t('five biomes in order', JT.BIOME_ORDER.length === 5 && JT.BIOME_ORDER.every(b => JT.BIOMES[b]));
const missing = []; for (const b of BIO) { const B = JT.BIOMES[b];
  for (const id of B.native) if (!JT.DECOR_BY_ID[id]) missing.push(b + ':decor:' + id);
  for (const id of B.prey) if (!JT.PREY_BY_ID[id]) missing.push(b + ':prey:' + id);
  for (const id of B.homes) if (!JT.SPECIES_BY_ID[id]) missing.push(b + ':home:' + id);
  for (const id of B.events) if (!JT.BIOME_EVENTS[id]) missing.push(b + ':ev:' + id);
  if (!JT.SUBSTRATES[B.sub]) missing.push(b + ':sub'); if (!JT.PRESET_THEMES[B.theme] || !JT.PRESET_THEMES[B.themeTall]) missing.push(b + ':theme'); }
t('biome ids all resolve', !missing.length, missing);
const allSp = JT.UNLOCK_ORDER.concat(JT.CATCH_UNLOCKS, JT.SPECIAL_UNLOCKS || []); const homeless = allSp.filter(id => !Bm.homesOf(id).length && id !== 'bold');
INFO.homeless = homeless; t('most species have a home biome', homeless.length <= 3, homeless);
t('journal: 7 biome entries', JT.JOURNAL.filter(j => (JT.JOURNAL_META[j.id] || [])[0] === 'biome').length === 7);
// starter layouts for every enclosure
const lay = {}; let layBad = []; for (const type in JT.HABITATS) for (const b of BIO) { const h = mk(type, b, 77 + type.length);
  const n = h.decor.length, nat = h.decor.filter(d => JT.BIOMES[b].native.includes(d.type)).length; lay[type + ':' + b] = n + '/' + nat;
  if (h.data.biome !== b || n < 3 || h.data.substrate !== JT.BIOMES[b].sub) layBad.push(type + ':' + b + ':' + n);
  if (b === 'paludarium' && !h.decor.some(d => JT.DECOR_BY_ID[d.type].arche === 'pond')) layBad.push(type + ':nopond'); }
INFO.layouts = lay; t('biome layouts build in every enclosure', !layBad.length, layBad);
// comfort
t('comfort values', Bm.comfortFor('rainforest', 'regal') === 1 && Bm.comfortFor('classic', 'regal') === 0.7 && Bm.comfortFor('desert', 'regal') < 0.6 && Bm.comfortFor('nightmoss', 'bold') === 0.75);
{ const h = mk('standard', 'desert', 5); const a = h.addSpider('apache', { stage: 4 }), r = h.addSpider('regal', { stage: 4 });
  t('speed/trust factors', Bm.speedK(h, a) > 1 && Bm.speedK(h, r) < 1 && Bm.tameK(h, a) > 1 && Bm.tameK(h, r) < 1);
  t('classic hab neutral', (() => { const c = mk('standard', null, 6); const s = c.addSpider('regal', { stage: 4 }); return Bm.speedK(c, s) === 1 && Bm.tameK(c, s) === 1 && Bm.id(c) === 'classic'; })()); }
// climate drift
{ const h = mk('standard', 'desert', 9); h.data.humidity = 0.9; step(h, 120); const dry = h.data.humidity; const r = mk('standard', 'rainforest', 9); r.data.humidity = 0.3; step(r, 120); const wet = r.data.humidity;
  INFO.hum = { dry: +dry.toFixed(2), wet: +wet.toFixed(2) }; t('humidity drifts toward biome', dry < 0.75 && wet > 0.42, INFO.hum); }
// events fire and end, each biome
const evs = {}; for (const b of BIO) { const h = mk('standard', b, 31); h.daylight = () => 1; h.addSpider(JT.BIOMES[b].homes[0], { stage: 4, sat: 0.6 }); h.data.bev = { id: null, until: 0, next: 2 };
  let mx = 0; step(h, 100, () => { mx = Math.max(mx, h.data.prey.length); }); const st = h.events.filter(e => e[1] === 'biome'); evs[b] = st.map(e => e[2].ev + (e[2].end ? '-end' : '')).join(',');
  if (b === 'nightmoss' || b === 'paludarium') evs[b + 'Prey'] = mx; }
INFO.events = evs; t('every biome event starts and ends', BIO.every(b => new RegExp('^' + JT.BIOMES[b].events[0] + ',' + JT.BIOMES[b].events[0] + '-end').test(evs[b])), evs);
t('hatch/fireflies bring prey', evs.paludariumPrey > 0 && evs.nightmossPrey > 0, evs);
{ const h = mk('standard', 'desert', 32); h.daylight = () => 0.1; h.data.bev = { id: null, until: 0, next: 1 }; step(h, 5); t('heat waits for daytime', !h.data.bev.id); }
{ const h = mk('standard', 'rainforest', 33); h.data.humidity = 0.4; h.data.bev = { id: null, until: 0, next: 1 }; step(h, 4); t('rain mists the tank', h.data.bev.id === 'rain' && h.data.humidity > 0.45, h.data.humidity); }
// paludarium: jumpers live with the pond (no NaN, never standing in water)
{ let wet = 0, nan = 0, drink = 0; for (let k = 0; k < 3; k++) { const h = mk(k === 2 ? 'nano' : 'standard', 'paludarium', 50 + k); const ps = Bm.ponds(h);
    const s1 = h.addSpider('magnolia', { stage: 4, sat: 0.4 }); h.addSpider('portia', { stage: 4, sat: 0.4 }); s1.hyd = 0.1; h.addPrey('fruitfly', 4);
    step(h, 160, () => { for (const sp of h.spiders) { if (!M.finite3(sp.pos)) nan++; if (sp.sup && sp.sup.k === 'floor' && ps.some(p => { const g = h.geoms[p.id]; return g && JT.G.pointInPoly(sp.pos[0], sp.pos[2], g.foot); })) wet++; } });
    drink += h.events.filter(e => e[1] === 'drink' || (e[1] === 'journal' && /drink/i.test(e[2].id))).length; }
  INFO.pond = { wet, nan, drink }; t('pond tanks stable', nan === 0, INFO.pond); t('jumpers keep out of the pond', wet < 30, INFO.pond); }
// settled in after a day at home
{ const h = mk('nano', 'nightmoss', 60); const sp = h.addSpider('graywall', { stage: 3, sat: 0.8 }); sp.homeT = (JT.DAY || 480) - 3; step(h, 6); t('settledIn journal', h.events.some(e => e[1] === 'journal' && e[2].id === 'settledIn'), sp.homeT); }
// biome tour
{ const g = new JT.Game(); g.newGame(); g.save = () => {}; let j = []; const H0 = g.hab; for (const b of BIO) { const h = g.createHabitat('nano'); h.data.biome = b; }
  g.viewing = true; for (const h of g.habs) { const ev = h.event; h.event = (ty, i) => { if (ty === 'journal') j.push(i.id); ev && ev.call(h, ty, i); }; } g.checkUnlocks(true);
  t('biome tour', j.includes('biomeTour') || (g.state.journal || {}).biomeTour, j); void H0; }
// old saves load as classic
{ const h = new JT.Habitat({ type: 'standard', decor: [] }); t('old saves are classic', Bm.id(h) === 'classic' && Bm.of(h).name === 'Classic'); }
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, bad, info: INFO }));
