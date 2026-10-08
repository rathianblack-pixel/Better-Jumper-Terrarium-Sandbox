/* Jumper Terrarium — biomes (v14): climates, weather, decor fit, species homes and biome layouts. */
(function (root) {
  'use strict';
  const JT = root.JT = root.JT || {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const B = (o) => Object.assign({ sub: null, bg: null, hum: [0.15, 1], temp: 24, swing: 3, themes: [], ideal: [], ok: [], bad: [], wx: { clear: 1 } }, o);
  JT.BIOMES = {
    classic: B({ name: 'Classic', short: 'Free build: any decor, any jumper', desc: 'The original sandbox. Every piece is allowed, every jumper is comfortable, and there is no weather.' }),
    rainforest: B({ name: 'Tropical Rainforest', short: 'Hot, wet and layered with leaves', desc: 'Steamy lowland forest. Broad leaves, bromeliads and moss hold the damp; rain showers bead every leaf with drops to drink.', sub: 'jungle', bg: 'canopy', hum: [0.72, 0.95], temp: 27, swing: 2, themes: ['jungle', 'paradise', 'canopy', 'rootwall', 'vertical'], ideal: ['tropical', 'wet'], ok: ['bark', 'fungi', 'litter', 'flower'], bad: ['dry'], wx: { clear: 2, overcast: 2, rain: 4, storm: 1, mist: 2 } }),
    desert: B({ name: 'Arid Desert', short: 'Sun-baked rock and sand', desc: 'Bright, dry and hot by day, cool at night. Rock tops bake in the afternoon heat; succulents and dead wood are the only shade.', sub: 'desert', bg: 'twilight', hum: [0.18, 0.4], temp: 33, swing: 10, themes: ['dry', 'canyon', 'sandwall', 'outback'], ideal: ['dry', 'rock'], ok: ['bark', 'grass'], bad: ['wet', 'tropical', 'fungi'], wx: { clear: 5, heat: 3, wind: 2 } }),
    paludarium: B({ name: 'Mangrove Paludarium', short: 'Water\u2019s edge, roots and reeds', desc: 'A humid shoreline of roots, moss and wet peat. Mist hangs low and the air never dries out.', sub: 'peat', bg: 'misty', hum: [0.8, 1], temp: 25, swing: 3, themes: ['bog', 'jungle', 'mosswall', 'rootwall', 'nursery'], ideal: ['wet'], ok: ['tropical', 'rock', 'fungi', 'grass', 'bark'], bad: ['dry'], wx: { clear: 2, overcast: 2, rain: 2, mist: 3 } }),
    nightmoss: B({ name: 'Night Moss Forest', short: 'Cool, dim and glowing', desc: 'A shaded forest floor of moss, fungi and rotting wood. On firefly nights soft lights drift between the caps.', sub: 'black', bg: 'dusk', hum: [0.7, 0.9], temp: 19, swing: 2, themes: ['mushroom', 'duskglade', 'mosswall', 'leafwall'], ideal: ['fungi', 'glow', 'wet'], ok: ['bark', 'litter', 'temperate', 'rock'], bad: ['dry', 'flower'], wx: { overcast: 2, mist: 3, glow: 3, clear: 1 } }),
    antkingdom: B({ name: 'Ant Kingdom', short: 'Acacia thorns and weaver-ant leaves', desc: 'Warm scrub and canopy shared with ants. Ant-mimics and plant-eating jumpers thrive among tropical leaves and bark.', sub: 'forest', bg: 'canopy', hum: [0.5, 0.75], temp: 28, swing: 5, themes: ['canopy', 'paradise', 'trunkwall', 'forest'], ideal: ['tropical', 'bark'], ok: ['grass', 'flower', 'litter', 'rock'], bad: ['fungi', 'glow'], wx: { clear: 3, overcast: 2, rain: 1, heat: 1 } }),
    heath: B({ name: 'Southern Heath', short: 'Open sand, low shrubs, dance stages', desc: 'Sunny heath and mallee: red sand, grass tufts and wildflowers, with open flat stones where little peacock males dance.', sub: 'redsand', bg: 'meadow', hum: [0.3, 0.55], temp: 24, swing: 8, themes: ['outback', 'meadow', 'dry', 'flower', 'sandwall'], ideal: ['dry', 'grass', 'flower'], ok: ['rock', 'litter', 'bark'], bad: ['wet', 'tropical', 'fungi'], wx: { clear: 4, wind: 2, heat: 1, overcast: 1 } }),
    oldbark: B({ name: 'Old Bark Forest', short: 'Peeling trunks, lichen and litter', desc: 'Temperate woodland of old trunks and fallen logs. Bark-coloured jumpers vanish against the wood and ambush from it.', sub: 'leafmould', bg: 'log', hum: [0.5, 0.75], temp: 20, swing: 4, themes: ['birch', 'forest', 'barkwall', 'trunkwall', 'cork'], ideal: ['bark', 'litter', 'fungi'], ok: ['temperate', 'wet', 'rock'], bad: ['dry', 'tropical'], wx: { clear: 2, overcast: 3, rain: 2, mist: 1 } }),
    urban: B({ name: 'Urban Garden', short: 'Sunny walls, pots and paving', desc: 'Garden walls, terracotta and paving stones warmed by the sun: the home turf of wall-hunting jumpers.', sub: 'gravel', bg: 'stone', hum: [0.35, 0.6], temp: 23, swing: 6, themes: ['ruin', 'rock', 'stonewall', 'minimal', 'driftwall'], ideal: ['rock', 'urban'], ok: ['bark', 'grass', 'flower', 'dry', 'litter'], bad: ['glow'], wx: { clear: 4, overcast: 2, rain: 1, heat: 1 } }),
    prairie: B({ name: 'Prairie Meadow', short: 'Tall grass, flowers and wind', desc: 'Open grassland and wildflowers. Warm breezes sway the stems and flush insects into the open.', sub: 'forest', bg: 'meadow', hum: [0.35, 0.6], temp: 24, swing: 7, themes: ['meadow', 'flower', 'forest'], ideal: ['grass', 'flower'], ok: ['temperate', 'dry', 'litter', 'bark'], bad: ['tropical', 'glow'], wx: { clear: 4, wind: 3, rain: 1, heat: 1 } }),
    cloudforest: B({ name: 'Cloud Forest', short: 'Cool mist, moss and bromeliads', desc: 'High montane forest wrapped in cloud. Everything drips; moss and ferns cover every branch.', sub: 'sphagnum', bg: 'misty', hum: [0.82, 1], temp: 18, swing: 2, themes: ['bog', 'mosswall', 'jungle', 'vertical', 'canopy'], ideal: ['wet', 'fungi'], ok: ['tropical', 'bark', 'temperate'], bad: ['dry'], wx: { mist: 5, rain: 2, overcast: 2 } }),
  };
  JT.BIOME_ORDER = Object.keys(JT.BIOMES);
  const WX = JT.WEATHER = {
    clear: { name: 'Clear', line: 'Clear skies', dh: 0, dt: 0, dur: [70, 150] },
    overcast: { name: 'Overcast', line: 'Clouds roll over and the light softens', dh: 0.0006, dt: -1, dur: [60, 130] },
    rain: { name: 'Rain', line: 'Rain shower: droplets bead on every leaf', dh: 0.004, dt: -2, dur: [45, 80], mist: 30 },
    storm: { name: 'Storm', line: 'Tropical storm: heavy rain, jumpers take cover', dh: 0.006, dt: -3, dur: [35, 60], mist: 20 },
    mist: { name: 'Mist', line: 'Low mist drifts through the tank', dh: 0.003, dt: -1, dur: [60, 120], mist: 45 },
    heat: { name: 'Heat', line: 'Hot afternoon: the rock tops bake', dh: -0.003, dt: 5, dur: [50, 90], day: true },
    wind: { name: 'Breeze', line: 'A warm breeze sways the grass', dh: -0.0015, dt: 0, dur: [40, 80] },
    glow: { name: 'Fireflies', line: 'Firefly night: soft lights drift through the moss', dh: 0, dt: 0, dur: [60, 110], night: true, prey: 'firefly' },
  };
  // [home, second-best]; bold is adaptable (comfortable everywhere)
  const HOME = {
    peacock: ['heath', 'desert'], zebra: ['urban', 'prairie'], regal: ['oldbark', 'prairie'], orange: ['oldbark', 'prairie'], canopy: ['oldbark', 'prairie'],
    graywall: ['urban', 'desert'], pantropical: ['urban', 'rainforest'], arc: ['heath', 'prairie'], emerald: ['prairie', 'rainforest'], twinflag: ['oldbark', 'urban'],
    cardinal: ['prairie', 'desert'], apache: ['desert', 'prairie'], imperial: ['heath', 'desert'], magnolia: ['paludarium', 'cloudforest'], ant: ['antkingdom', 'rainforest'],
    paradise: ['desert', 'prairie'], giant: ['rainforest', 'antkingdom'], portia: ['rainforest', 'nightmoss'], bagheera: ['antkingdom', 'rainforest'], hasarius: ['urban', 'rainforest'],
    auralis: ['heath', 'cloudforest'], hyalina: ['antkingdom', 'paludarium'], ignicard: ['nightmoss', 'desert'], titanica: ['rainforest', 'cloudforest'], saltator: ['urban', 'oldbark'],
    phaeacius: ['oldbark', 'rainforest'], cosmophasis: ['antkingdom', 'rainforest'], carrhotus: ['oldbark', 'prairie'], hyllus: ['cloudforest', 'rainforest'],
    putnam: ['prairie', 'oldbark'], johnson: ['desert', 'prairie'],
  };
  JT.BIOME_HOMES = HOME;
  const RX = {
    wet: /moss|fern|sphagnum|bromel|orchid|pothos|monstera|calathea|fittonia|babytear|baby's|peat|bog|lily|pond|dew|maiden|liana|curtain|glassleaf|humid|tilland|mist|damp|wet/,
    dry: /succul|echever|cholla|sand|desert|cact|dried|terracotta|mesa|bask|arid|outback|dune|jade|olive|fescue|lavender|drought/,
    rock: /stone|slate|pebble|gravel|limestone|cairn|boulder|rock|granite|cave/,
    bark: /cork|bark|log|drift|trunk|stump|twig|birch|wood|perch|branch|tube|bamboo|root/,
    tropical: /monstera|pothos|calathea|bromel|orchid|palm|croton|ficus|liana|tilland|bamboo|peperom|glassleaf|jungle|tropic|fittonia|heliconia|creepfig|staghorn|emerald/,
    temperate: /oak|birch|acorn|pinecone|clover|bluebell|buttercup|foxglove|ivy|dais|marigold|wildflower|lichen|inkcap|beech|bracken/,
    grass: /grass|sedge|fescue|clover|reed/,
    flower: /flower|dais|bluebell|marigold|foxglove|buttercup|lavender|orchid|bloom/,
    fungi: /mushroom|toadstool|glow|inkcap|fung|bracket|earthstar|agaric|bluecap|shell|caps/,
    glow: /glow/,
    urban: /terracotta|clay|pipe|ruin|brick|slab|limestone|slate|paving|pot\b/,
    litter: /litter|leaves|magnolia|seedpod|chips|twigs|acorn|pinecone/,
  };
  const ARCH = { rock: 'rock', branch: 'bark', log: 'bark', tower: 'bark', grass: 'grass', flower: 'flower', mushroom: 'fungi', scatter: 'litter', palm: 'tropical', fern: 'wet' };
  const tagCache = new Map();
  const Bi = JT.Biomes = {
    HOME,
    of(h) { const id = (h && h.data && h.data.biome) || 'classic'; return Object.assign({ id }, JT.BIOMES[id] || JT.BIOMES.classic); },
    id(h) { const id = h && h.data && h.data.biome; return JT.BIOMES[id] ? id : 'classic'; },
    tags(def) {
      if (!def) return {}; let t = tagCache.get(def.id); if (t) return t; t = {};
      const s = (def.id + ' ' + def.name + ' ' + ((def.p && def.p.style) || '') + ' ' + ((def.p && def.p.kind) || '') + ' ' + (def.desc || '')).toLowerCase();
      for (const k in RX) if (RX[k].test(s)) t[k] = true;
      if (ARCH[def.arche]) t[ARCH[def.arche]] = true;
      if (def.flowers) t.flower = true;
      if (def.water || def.lamp || def.arche === 'dish' || def.arche === 'lamp') t.essential = true;
      tagCache.set(def.id, t); return t;
    },
    /** 2 = native/ideal, 1 = suitable, 0 = does not belong. Classic accepts everything. */
    suit(def, bid) {
      if (!bid || bid === 'classic') return 2; const bm = JT.BIOMES[bid]; if (!bm || !def) return 1;
      const t = Bi.tags(def); if (t.essential) return 1;
      const bad = bm.bad.some(k => t[k]), ideal = bm.ideal.some(k => t[k]);
      if (ideal && !bad) return 2; if (bad) return ideal ? 1 : 0; return 1;
    },
    homeOf(sid) { const h = HOME[sid]; return h ? h[0] : null; },
    secondOf(sid) { const h = HOME[sid]; return h ? h[1] : null; },
    natives(bid) { return Object.keys(HOME).filter(s => HOME[s][0] === bid && JT.SPECIES_BY_ID[s]); },
    fit(sid, bid) {
      if (!bid || bid === 'classic' || sid === 'bold') return 0.8; const h = HOME[sid]; if (!h) return 0.65;
      return h[0] === bid ? 1 : h[1] === bid ? 0.85 : 0.5;
    },
    label(h, sid) {
      const bid = Bi.id(h), f = Bi.fit(sid, bid), hm = Bi.homeOf(sid);
      const k = f >= 0.95 ? 'home' : f >= 0.6 ? 'ok' : 'out';
      return { k, f, text: k === 'home' ? 'At home here' : k === 'ok' ? 'Comfortable' : 'Out of place', biome: JT.BIOMES[bid].name, home: hm ? JT.BIOMES[hm].name : 'anywhere' };
    },
    rank(sid) { return JT.BIOME_ORDER.filter(b => b !== 'classic').sort((a, b) => Bi.fit(sid, b) - Bi.fit(sid, a) || JT.BIOME_ORDER.indexOf(a) - JT.BIOME_ORDER.indexOf(b)).concat(['classic']); },
    weather(h) { const w = h && h.data && h.data.wx; return WX[(w && w.id) || 'clear'] || WX.clear; },
    temp(h) { const bm = Bi.of(h); const day = h.daylight ? h.daylight() : 1; return bm.temp + bm.swing * (day - 0.5) + (Bi.id(h) === 'classic' ? 0 : Bi.weather(h).dt); },
    forecast(h) { const w = h.data.wx; if (!w) return null; const W = WX[w.nx] || WX.clear; return { id: w.nx, name: W.name, secs: Math.max(0, w.until - h.time) }; },
    _r(d) { if (d.wxs == null) d.wxs = (JT.hashStr ? JT.hashStr(String(d.id || 'h')) : 12345) >>> 0; d.wxs = (Math.imul(d.wxs >>> 0, 1664525) + 1013904223) >>> 0; return d.wxs / 4294967296; },
    _pick(d, bm, ok) {
      const ws = Object.entries(bm.wx).filter(([id]) => WX[id] && (!ok || ok(id))); if (!ws.length) return 'clear';
      let tot = 0; for (const [, n] of ws) tot += n; let x = Bi._r(d) * tot; for (const [id, n] of ws) { x -= n; if (x <= 0) return id; } return ws[ws.length - 1][0];
    },
    roll(h, forced) {
      const d = h.data, bm = JT.BIOMES[d.biome] || JT.BIOMES.classic, t = h.time; const day = h.daylight ? h.daylight() : 1;
      const ok = (id) => { const W = WX[id]; return !(W.day && day < 0.55) && !(W.night && day > 0.45); };
      const id = forced && WX[forced] && bm.wx[forced] && ok(forced) ? forced : Bi._pick(d, bm, ok);
      const W = WX[id]; const dur = W.dur[0] + Bi._r(d) * (W.dur[1] - W.dur[0]);
      return { id, t0: t, until: t + dur, nx: Bi._pick(d, bm, null), lm: t };
    },
    /** Runs inside Habitat.update for biome tanks: weather, humidity pull, comfort. */
    tick(h, dt, full) {
      const d = h.data, bm = JT.BIOMES[d.biome]; if (!bm || d.biome === 'classic' || !(dt > 0)) return;
      const t = h.time; let w = d.wx;
      if (!w || !WX[w.id] || !(t < w.until) || t < w.t0 - 1) { const prev = w && w.id; w = d.wx = Bi.roll(h, w && w.nx); w.prev = prev || null; Bi.started(h, w); }
      const W = WX[w.id], tgt = (bm.hum[0] + bm.hum[1]) / 2;
      d.humidity = clamp(d.humidity + (tgt - d.humidity) * dt * 0.003 + W.dh * dt, 0.15, 1);
      if (W.mist && t - (w.lm || w.t0) >= W.mist) { w.lm = t; if (h.mist && h.nav) { const hv = d.humidity; try { h.mist(); } catch (e) { } d.humidity = Math.min(1, hv + 0.05); } }
      d.bt = (d.bt || 0) + dt; if (d.bt >= 3) { const k = d.bt; d.bt = 0; Bi.comfort(h, k); }
    },
    started(h, w) {
      const W = WX[w.id]; if (!W || !W.prey || !h.addPrey || !JT.PREY_BY_ID[W.prey]) return;
      if (h.livePreyCount && h.livePreyCount() < 14) { try { h.addPrey(W.prey, 1 + (Bi._r(h.data) < 0.5 ? 1 : 0)); } catch (e) { } }
    },
    comfort(h, k) {
      const d = h.data, bid = d.biome; const m = Bi.match(h); d.bmatch = m.score;
      for (const sp of d.spiders) {
        const f = Bi.fit(sp.species, bid), eff = f * (0.75 + 0.25 * m.score / 100); sp.comfort = Math.round(eff * 100) / 100;
        if (eff >= 0.88) sp.tame = Math.min(1, (sp.tame || 0) + 0.0012 * k / 3);
        else if (eff < 0.5) sp.tame = Math.max(0, (sp.tame || 0) - 0.0006 * k / 3);
        if (Bi._r(d) < 0.03 && !sp.target) { if (eff < 0.5) sp.thought = 'Seems a little unsettled in this climate.'; else if (eff >= 0.9) sp.thought = 'Settled and at home here.'; }
      }
    },
    match(h) {
      const d = h.data, id = Bi.id(h), bm = JT.BIOMES[id];
      if (id === 'classic') return { score: 100, label: 'Free build', issues: [], ideal: 0, off: 0, humOK: true, water: true, cover: 1, warm: 0 };
      let ideal = 0, off = 0, water = false, cover = 0, warm = 0, wet = 0;
      for (const inst of d.decor) { const def = JT.DECOR_BY_ID[inst.type]; if (!def) continue; const s = Bi.suit(def, id); if (s === 2) ideal++; else if (s === 0) off++; if (def.water) water = true; if (def.cover >= 0.4) cover++; if (def.platform && (def.arche === 'rock' || def.arche === 'slab')) warm++; if (Bi.tags(def).wet) wet++; }
      const hum = d.humidity, humOK = hum >= bm.hum[0] - 0.05 && hum <= bm.hum[1] + 0.05;
      const score = clamp(Math.round(35 + Math.min(30, ideal * 5) - Math.min(35, off * 8) + (humOK ? 20 : 0) + (water ? 10 : 0) + (cover ? 5 : 0)), 0, 100);
      const issues = [];
      if (off) issues.push(off + (off > 1 ? ' pieces do' : ' piece does') + ' not belong in a ' + bm.name + '.');
      if (ideal < 3) issues.push('Add native pieces: they are marked Native in the build drawer.');
      if (!humOK) issues.push(hum < bm.hum[0] ? 'Too dry for this climate: mist the tank or add moss and water.' : 'Too damp for this climate: let it dry out.');
      if (!water) issues.push('No water dish: jumpers rely on mist drops alone.');
      if (!cover) issues.push('Little cover: add a leafy plant or a hide.');
      return { score, label: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor', issues, ideal, off, humOK, water, cover, warm, wet };
    },
    micro(h) {
      const m = Bi.match(h); const z = [];
      z.push(m.warm ? m.warm + ' warm rock top' + (m.warm > 1 ? 's' : '') : 'no warm rock tops');
      z.push(m.cover ? m.cover + ' shady spot' + (m.cover > 1 ? 's' : '') : 'no shade');
      z.push(m.water || m.wet ? 'damp corners' : 'nowhere damp');
      return z.join(' \u00b7 ');
    },
    /** Weather for a paused tank, summarised (no simulation). Returns a short text or null. */
    skip(h, secs) {
      const d = h.data, bm = JT.BIOMES[d.biome]; if (!bm || d.biome === 'classic' || !(secs > 30)) return null;
      const n = Math.min(8, Math.floor(secs / 100)); const cnt = {};
      for (let i = 0; i < n; i++) { const id = Bi._pick(d, bm, null); if (id !== 'clear' && id !== 'overcast') cnt[id] = (cnt[id] || 0) + 1; }
      const tgt = (bm.hum[0] + bm.hum[1]) / 2; d.humidity = clamp(d.humidity + (tgt - d.humidity) * Math.min(1, secs * 0.003), 0.15, 1); d.wx = null;
      const parts = Object.keys(cnt).map(id => WX[id].name + (cnt[id] > 1 ? ' \u00d7' + cnt[id] : ''));
      return parts.length ? parts.join(', ') : null;
    },
    applyGround(h, bid) { const bm = JT.BIOMES[bid]; if (!bm || bid === 'classic') return; if (JT.SUBSTRATES[bm.sub]) h.data.substrate = bm.sub; if (JT.BACKGROUNDS[bm.bg]) h.data.bg = bm.bg; },
    setBiome(h, bid) { if (!JT.BIOMES[bid]) bid = 'classic'; const d = h.data; d.biome = bid; d.wx = null; d.bt = 0; if (bid !== 'classic') { const bm = JT.BIOMES[bid]; d.humidity = (bm.hum[0] + bm.hum[1]) / 2; } },
    themeFor(h, bid) {
      const bm = JT.BIOMES[bid]; const avail = JT.Presets.forType(h.data.type).map(p => p.theme);
      const extra = bm.hum[1] > 0.8 ? ['jungle', 'mosswall', 'nursery', 'vertical', 'bog'] : bm.hum[1] < 0.6 ? ['dry', 'sandwall', 'minimal', 'cork', 'stonewall'] : ['cork', 'minimal', 'forest', 'nursery', 'barkwall'];
      return bm.themes.concat(extra).find(t => avail.includes(t)) || avail[0] || null;
    },
    /** Builds a biome layout: a matching preset theme, the biome's ground, off-biome pieces removed, native accents added. */
    layout(h, bid, seed) {
      const bm = JT.BIOMES[bid]; if (!bm || bid === 'classic') return null; seed = (seed >>> 0) || 1;
      const theme = Bi.themeFor(h, bid); if (theme) JT.Presets.generate(h, theme, seed); else { h.data.decor = []; h.rebuild(); }
      Bi.applyGround(h, bid);
      for (const inst of h.decor.slice()) { const def = JT.DECOR_BY_ID[inst.type]; if (def && Bi.suit(def, bid) === 0 && h.decorById(inst.id)) h.removeDecor(inst.id); }
      const t = h.data.type, compact = t === 'nano' || t === 'breeder', W = h.dims.w, D = h.dims.d;
      const pool = JT.DECOR.filter(x => (x.cat === 'plants' || x.cat === 'ground') && x.arche !== 'wallmount' && x.arche !== 'backwall' && Bi.suit(x, bid) === 2 && (!compact || x.small));
      const rng = JT.makeRng((seed ^ 0x5bd1e995) >>> 0 || 7); let want = (W >= 240 ? 7 : W >= 150 ? 5 : 3) + Math.max(0, 3 - h.decor.length);
      for (let k = 0; k < 60 && want > 0 && pool.length; k++) {
        const type = pool[Math.floor(rng() * pool.length) % pool.length].id; const x = 10 + rng() * (W - 20), z = 10 + rng() * (D - 20), rot = Math.floor(rng() * 4) % 4, sd = (rng() * 1e9) | 0;
        if (h.canPlace(type, x, z, rot, sd).ok && h.addDecor(type, x, z, rot, sd)) want--;
      }
      if (!h.decor.some(x => (JT.DECOR_BY_ID[x.type] || {}).water) && JT.DECOR_BY_ID.waterdish) {
        for (let k = 0; k < 30; k++) { const x = 14 + rng() * (W - 28), z = D * 0.55 + rng() * (D * 0.4 - 10), sd = (rng() * 1e9) | 0; if (h.canPlace('waterdish', x, z, 0, sd).ok) { h.addDecor('waterdish', x, z, 0, sd); break; } }
      }
      return theme;
    },
    /** v14 fresh start: Pip's starter tank becomes a Southern Heath (its real home). */
    starter(game, seed) {
      const h = game.hab; if (!h) return; Bi.setBiome(h, 'heath'); Bi.layout(h, 'heath', seed || 20141);
      h.decor.forEach(x => { x.preset = true; });
      for (const sp of h.spiders) { sp.pos = h.randomFloorPoint(); sp.sup = { k: 'floor' }; sp._route = null; }
      h.data.prey = []; h.addPrey('aphid', 8); h.addPrey('fruitfly', 5); h.addPrey('gnat', 6);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);


