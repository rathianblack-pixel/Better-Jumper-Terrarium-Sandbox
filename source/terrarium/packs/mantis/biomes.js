/* Mantis Terrarium pack — two extra biomes (loaded after the biome table, before the runtime patches). */
(function (root) {
  const JT = root.JT; if (!JT || !JT.BIOMES) return;
  const B = (o) => Object.assign({ sub: null, bg: null, hum: [0.15, 1], temp: 24, swing: 3, themes: [], ideal: [], ok: [], bad: [], wx: { clear: 1 } }, o);
  JT.BIOMES.orchidgarden = B({ name: 'Orchid Garden', short: 'Warm blooms, sprays and humid air', desc: 'A humid tropical garden of orchid sprays and flower spikes. Flower mimics sit among the blooms and wait for pollinators.', sub: 'jungle', bg: 'canopy', hum: [0.6, 0.85], temp: 26, swing: 3, themes: ['orchidgarden', 'paradise', 'flower'], ideal: ['flower', 'tropical'], ok: ['wet', 'bark'], bad: ['dry'], wx: { clear: 3, overcast: 2, rain: 2, mist: 2 } });
  JT.BIOMES.dryleaf = B({ name: 'Dry Leaf Forest', short: 'Crisp litter, twigs and dead leaves', desc: 'A seasonal woodland floor of curled brown leaves and bare twigs. Dead-leaf and bark mantises disappear against it.', sub: 'leafmould', bg: 'log', hum: [0.4, 0.65], temp: 23, swing: 6, themes: ['dryleaf', 'forest'], ideal: ['litter', 'bark'], ok: ['temperate', 'fungi', 'rock'], bad: ['wet'], wx: { clear: 3, overcast: 2, wind: 2, rain: 1 } });
  for (const id of ['orchidgarden', 'dryleaf']) if (!JT.BIOME_ORDER.includes(id)) JT.BIOME_ORDER.push(id);
})(typeof window !== 'undefined' ? window : globalThis);
