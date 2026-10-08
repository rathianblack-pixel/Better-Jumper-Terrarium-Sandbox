/* Mantis Terrarium pack — home biomes per species ([home, second-best]) and runtime data for the pack biomes. */
(function (root) {
  const JT = root.JT, Bm = JT.Biomes, H = Bm && Bm.HOME; if (!H) return;
  for (const k of Object.keys(H)) delete H[k];
  Object.assign(H, { carolina: ['oldbark', 'dryleaf'], chinese: ['prairie', 'oldbark'], european: ['prairie', 'dryleaf'], ghost: ['dryleaf', 'rainforest'], spiny: ['orchidgarden', 'heath'], orchid: ['orchidgarden', 'rainforest'] });
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
