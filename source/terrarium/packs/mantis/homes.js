/* Mantis Terrarium pack — home biomes per species ([home, second-best]) and runtime data for the pack biomes. */
(function (root) {
  const JT = root.JT, Bm = JT.Biomes, H = Bm && Bm.HOME; if (!H) return;
  for (const k of Object.keys(H)) delete H[k];
  Object.assign(H, { carolina: ['oldbark', 'dryleaf'], chinese: ['prairie', 'oldbark'], european: ['prairie', 'dryleaf'], ghost: ['dryleaf', 'rainforest'], spiny: ['orchidgarden', 'heath'], orchid: ['orchidgarden', 'rainforest'],
    boxer: ['rainforest', 'oldbark'], budwing: ['heath', 'prairie'], bark: ['oldbark', 'rainforest'], stick: ['prairie', 'dryleaf'], deadleaf: ['dryleaf', 'rainforest'], violin: ['desert', 'heath'], giantasian: ['rainforest', 'prairie'], devilsflower: ['orchidgarden', 'heath'] });
  const extra = {
    orchidgarden: { icon: '🌸', tint: [1.02, 1, 1.02], light: 'Dappled bloom', prey: ['housefly', 'fruitfly', 'moth', 'hydei'], events: ['rain', 'mist'] },
    dryleaf: { icon: '🍂', tint: [1.04, 1, 0.92], light: 'Autumn shade', prey: ['cricket', 'housefly', 'mealmoth', 'fruitfly'], events: ['wind', 'rain'] },
  };
  const B = JT.Biome || Bm;
  for (const id in extra) {
    const d = JT.BIOMES[id]; if (!d) continue; const e = extra[id];
    if (B.icons) B.icons[id] = e.icon;
    Object.assign(d, { id, icon: e.icon, tint: e.tint, light: e.light, blurb: d.desc, events: e.events.slice(), dusk: 0 });
    d.prey = e.prey.filter(x => JT.PREY_BY_ID && JT.PREY_BY_ID[x]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
/* v1.2: decor with an explicit mantis tag list (def.mtags) uses exactly those biome tags (Spanish moss is not "wet",
   the bark slab is not "urban"); water/lamps stay essential. */
(function (root) {
  const JT = root.JT; if (!JT || !JT.Biomes || !JT.Biomes.tags) return;
  const B = JT.Biomes, t0 = B.tags, cache = new Map();
  B.tags = function (def) {
    if (!def || !def.mtags) return t0.apply(this, arguments);
    let t = cache.get(def.id); if (t) return t; t = {}; for (const k of def.mtags) t[k] = true; if (def.flowers) t.flower = true; cache.set(def.id, t); return t;
  };
})(typeof window !== 'undefined' ? window : globalThis);
