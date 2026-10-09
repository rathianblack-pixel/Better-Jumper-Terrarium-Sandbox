/* Mantis Terrarium pack — species, growth stages and names (replaces the jumper roster in the shared content). */
(function (root) {
  'use strict';
  const JT = root.JT;
  const base = JT.SPECIES[0].look; // engine look defaults (gait keys etc.)
  // pal: body / body2 (second tone) / wing (folded forewings) / wingEdge / hind (hind wings, seen in the threat display)
  //      leg / eye / accent / belly. ceph/abd/mark/chel/hair are kept for engine UI that reads jumper palette keys.
  // mlook: pro (prothorax length) · head (head width) · arm (raptorial leg size) · abdW (abdomen width) · wingLen (0..1 of abdomen)
  //        stripe (green edge stripe on the forewing) · coxaSpot (black eyespot inside the front coxa) · wingSpot (dark forewing spot)
  //        lobes ('petal' leg lobes) · leafy (crown + leaf flaps + shield) · spines (abdomen spines) · spiral (spiral eyespots on the forewings)
  //        curl (how strongly the nymph abdomen curls up) · antL (antenna length)
  const MS = (id, name, sci, len, pal, mlook, traits, prefs, desc) => {
    const p = Object.assign({ ceph: pal.body, abd: pal.body, mark: pal.accent, chel: pal.body2, hair: pal.body2, belly: pal.belly }, pal);
    return { id, name, sci, len, pal: p, pattern: 'mantis', traits, prefs, desc, mlook: Object.assign({ pro: 1, head: 1, arm: 1, abdW: 1, wingLen: 1, curl: 1, antL: 1 }, mlook) };
  };
  JT.SPECIES = [
    MS('carolina', 'Carolina Mantis', 'Stagmomantis carolina', 20,
      { body: '#8c7f66', body2: '#6a5d48', wing: '#9a8d70', wingEdge: '#5e5240', hind: '#b8a888', leg: '#857860', eye: '#b8ab8a', accent: '#3b2f22', belly: '#a89c80' },
      { wingLen: 0.78, wingSpot: true, abdW: 1.1 },
      { stealth: .65, patience: .75, jump: .3, bold: .6, tactics: .55 }, { height: .65, foliage: .55, rear: .3, display: .2, activity: .45 },
      'A small, mottled bark-coloured mantis from North American gardens. Steady, forgiving and happy on twigs and flowers alike.'),
    MS('chinese', 'Chinese Mantis', 'Tenodera sinensis', 30,
      { body: '#93a160', body2: '#6c7a42', wing: '#a5ad74', wingEdge: '#4f8a34', hind: '#8a6d86', leg: '#8e9a5c', eye: '#cfcf98', accent: '#5c9a3a', belly: '#b3b884' },
      { pro: 1.12, stripe: true, abdW: 0.95 },
      { stealth: .55, patience: .65, jump: .25, bold: .9, tactics: .5 }, { height: .7, foliage: .6, rear: .3, display: .25, activity: .55 },
      'The big, long-necked classic. Tan with a bright green stripe down each wing edge; bold enough to take a cricket head on.'),
    MS('european', 'European Mantis', 'Mantis religiosa', 26,
      { body: '#7fba4c', body2: '#5a9236', wing: '#8cc45a', wingEdge: '#4d8a2c', hind: '#d6dcaa', leg: '#7ab449', eye: '#cbe39a', accent: '#151515', belly: '#a6cf7a' },
      { coxaSpot: true },
      { stealth: .6, patience: .7, jump: .3, bold: .75, tactics: .55 }, { height: .65, foliage: .7, rear: .3, display: .35, activity: .5 },
      'Leaf-green and graceful. Raise its arms and you will see the black, white-ringed eyespot it hides inside each front leg.'),
    MS('ghost', 'Ghost Mantis', 'Phyllocrania paradoxa', 18,
      { body: '#5e4632', body2: '#3f2e20', wing: '#6b5238', wingEdge: '#3a2a1c', hind: '#8a6a48', leg: '#5a4430', eye: '#9a7e5a', accent: '#2c2016', belly: '#7a6248' },
      { leafy: true, pro: 0.9, head: 0.95, wingLen: 0.85, curl: 1.3 },
      { stealth: .9, patience: .9, jump: .2, bold: .35, tactics: .6 }, { height: .75, foliage: .9, rear: .4, display: .2, activity: .3 },
      'A crumpled dead leaf with eyes. Hangs among dry leaves and barely moves; a leafy crown sits on top of its head.'),
    MS('spiny', 'Spiny Flower Mantis', 'Pseudocreobotra wahlbergii', 14,
      { body: '#e2dcae', body2: '#9cbf6a', wing: '#e6dfb2', wingEdge: '#7aa64e', hind: '#e8c86a', leg: '#d8cf9e', eye: '#d9d1a0', accent: '#5f9a3e', belly: '#efe8c4' },
      { spines: true, spiral: true, wingLen: 0.7, abdW: 1.25, curl: 1.4, pro: 0.85 },
      { stealth: .75, patience: .8, jump: .35, bold: .5, tactics: .6 }, { height: .6, foliage: .6, rear: .3, display: .6, activity: .45 },
      'Small, spiky and flower-coloured. Startle it and it flashes a green-and-yellow spiral eye on each wing.'),
    MS('orchid', 'Orchid Mantis', 'Hymenopus coronatus', 22,
      { body: '#f3e6ea', body2: '#e6b4c8', wing: '#f6ecef', wingEdge: '#d99ab4', hind: '#f4dbe4', leg: '#efdbe2', eye: '#e2a9bc', accent: '#d27aa0', belly: '#fbf3f5' },
      { lobes: 'petal', wingLen: 0.72, abdW: 1.2, head: 1.05 },
      { stealth: .85, patience: .85, jump: .3, bold: .55, tactics: .7 }, { height: .6, foliage: .5, rear: .3, display: .3, activity: .35 },
      'A living orchid. Petal-shaped flaps on its legs and a pink-white body draw in flies that think it is a flower.'),
    // ---- v1.2: eight more species (appended; the first six are unchanged) ----
    MS('boxer', 'Boxer Mantis', 'Ephestiasula sp.', 10,
      { body: '#4e443a', body2: '#2c2620', wing: '#5c5246', wingEdge: '#2a221c', hind: '#8a7a6a', leg: '#40382f', eye: '#cbbb92', accent: '#f0ece0', belly: '#6e6254' },
      { bands: true, head: 1.25, pro: 0.72, abdW: 1.15, wingLen: 0.7, curl: 1.3, antL: 0.9 },
      { stealth: .6, patience: .5, jump: .45, bold: .7, tactics: .55 }, { height: .55, foliage: .5, rear: .3, display: .4, activity: .7 },
      'A tiny, quick mantis from Asian forests. It holds up black-and-white banded forelegs and pumps them like a boxer when anything comes close.'),
    MS('budwing', 'Budwing Mantis', 'Parasphendale affinis', 18,
      { body: '#8e7a5a', body2: '#6a5a40', wing: '#a08a62', wingEdge: '#5a4a34', hind: '#e8642a', leg: '#86735a', eye: '#c2b088', accent: '#d8502a', belly: '#b09a78' },
      { stub: true, wingLen: 0.42, abdW: 0.88, thin: 0.9, pro: 1.05 },
      { stealth: .6, patience: .65, jump: .3, bold: .65, tactics: .5 }, { height: .6, foliage: .45, rear: .3, display: .5, activity: .5 },
      'A slim East African mantis whose wings stay short buds even when grown. Startle it and the stubs buzz with a dry rattle and a flash of orange.'),
    MS('bark', 'Bark Mantis', 'Liturgusa sp.', 16,
      { body: '#7f8a6e', body2: '#59634f', wing: '#8a9478', wingEdge: '#4a5440', hind: '#a0a890', leg: '#77816a', eye: '#a8b090', accent: '#3e4636', belly: '#9aa28a' },
      { lichen: true, flat: true, abdW: 1.2, wingLen: 0.95, wideWing: 1.15, pro: 0.8, legL: 1.2, curl: 0.7 },
      { stealth: .9, patience: .55, jump: .4, bold: .55, tactics: .6 }, { height: .75, foliage: .2, rear: .4, display: .2, activity: .7 },
      'A flat, lichen-mottled runner of tree trunks. It sprints across bark in quick bursts, then presses itself flat and vanishes.'),
    MS('stick', 'Stick Mantis', 'Brunneria borealis', 30,
      { body: '#9a8a64', body2: '#76684a', wing: '#a8986e', wingEdge: '#6a5c40', hind: '#bcae88', leg: '#90805c', eye: '#c0b088', accent: '#5a4c34', belly: '#b0a07a' },
      { thin: 0.5, pro: 1.5, head: 0.62, arm: 0.88, abdW: 0.62, aLen: 1.22, wingLen: 0.34, legL: 1.35, antL: 0.7, curl: 0.6 },
      { stealth: .95, patience: .95, jump: .2, bold: .4, tactics: .6 }, { height: .65, foliage: .55, rear: .3, display: .15, activity: .2 },
      'Long, thin and slow. It lies flat along a twig with its forelegs stretched out in front and simply becomes part of the plant.'),
    MS('deadleaf', 'Dead Leaf Mantis', 'Deroplatys desiccata', 26,
      { body: '#7a5636', body2: '#5a3e26', wing: '#8a6440', wingEdge: '#4a3220', hind: '#a37a50', leg: '#6e4e32', eye: '#a88660', accent: '#3a2818', belly: '#94704c' },
      { shield: 'leaf', shieldW: 2.1, ragged: true, veins: true, abdW: 1.3, wideWing: 1.5, pro: 0.85, head: 0.95, leafRock: 1, curl: 1.2 },
      { stealth: .95, patience: .9, jump: .2, bold: .3, tactics: .6 }, { height: .6, foliage: .85, rear: .4, display: .3, activity: .25 },
      'A crumpled brown leaf with a wide shield over its neck. When startled it drops and lies flat and still, just one more dead leaf.'),
    MS('violin', 'Wandering Violin Mantis', 'Gongylus gongylodes', 32,
      { body: '#a08a5c', body2: '#7a6640', wing: '#ae9a6a', wingEdge: '#6a5838', hind: '#c09a70', leg: '#9a865a', eye: '#c8b47e', accent: '#5a7a3a', belly: '#b8a47a' },
      { thin: 0.6, pro: 1.9, shield: 'diamond', shieldW: 1.2, crown: 1.2, legLobes: true, abdW: 0.85, wingLen: 0.9, antL: 0.8, curl: 1.1 },
      { stealth: .85, patience: .95, jump: .2, bold: .4, tactics: .65 }, { height: .75, foliage: .45, rear: .3, display: .3, activity: .2 },
      'An impossibly thin mantis with a violin-shaped neck, a pointed crown and leafy flaps on its legs. Rocks slowly as it walks, and only eats things that fly.'),
    MS('giantasian', 'Giant Asian Mantis', 'Hierodula membranacea', 32,
      { body: '#6fae3e', body2: '#4f8a2a', wing: '#7cbc4a', wingEdge: '#3f7a24', hind: '#a8c88a', leg: '#6aa63a', eye: '#d4e6a0', accent: '#e8e070', belly: '#9ccc6a' },
      { arm: 1.3, abdW: 1.3, head: 1.08, pro: 1.05, wideWing: 1.35, stigma: '#f2f0d0' },
      { stealth: .5, patience: .6, jump: .3, bold: .98, tactics: .5 }, { height: .65, foliage: .6, rear: .3, display: .3, activity: .6 },
      'Big, bright green and fearless. Takes the largest prey in the tank and often comes to the glass to look you in the eye.'),
    MS('devilsflower', "Devil's Flower Mantis", 'Idolomantis diabolica', 34,
      { body: '#93aa6c', body2: '#6d8a4c', wing: '#a8bb80', wingEdge: '#5d7a3e', hind: '#c8b7d8', leg: '#94ab70', eye: '#d8d6a6', accent: '#c23a3a', belly: '#d6dcc0' },
      { pro: 1.55, head: 0.9, arm: 1.2, abdW: 0.82, thin: 0.8, wingLen: 0.9, crown: 1.45, shield: 'flare', shieldW: 1.4, armLobe: { out: '#c4d2a2', edge: '#8aa06a', inner: ['#f4f1ea', '#7a3fa0', '#2f5fb8', '#c8323a'] }, legLobes: true, curl: 1.1 },
      { stealth: .85, patience: .9, jump: .25, bold: .55, tactics: .65 }, { height: .85, foliage: .5, rear: .3, display: .65, activity: .3 },
      "The largest flower mantis. Hangs upside-down from a tip and sways like a bloom; when threatened it spreads leafy forelegs to show red, blue and purple inside."),
  ];
  JT.SPECIES.forEach(s => { s.look = Object.assign({}, base, { gait: 'patient', fuzz: 0, tufts: null, palp: 'plain', irid: 0, note: s.desc }); });
  // v1.2 per-species behaviour flags (read by mantis-ai2.js / mantis-life.js)
  const FLAGS = {
    ghost: { night: true, morph: true }, violin: { night: true, flyOnly: true, slow: 0.6, hangs: true, rockWalk: true, morph: false }, deadleaf: { night: true, morph: true, playDead: true },
    devilsflower: { night: true, hangs: true, display: 'flower' }, chinese: { morph: true }, european: { morph: true }, carolina: { morph: true },
    stick: { morph: true, slow: 0.55, flat: true }, giantasian: { morph: true, bigPrey: 0.35, curious: true }, budwing: { noFly: true, display: 'buzz' },
    boxer: { box: true }, bark: { sprint: true },
  };
  for (const id in FLAGS) { const S = JT.SPECIES.find(x => x.id === id); if (S) S.mflags = FLAGS[id]; }
  const GAITS = { boxer: 'twitchy', bark: 'stopgo' };
  for (const id in GAITS) { const S = JT.SPECIES.find(x => x.id === id); if (S) S.look.gait = GAITS[id]; }
  // egg-case shape per species (mantis-life.js): k = shape, n = typical clutch
  const OOTH = { carolina: ['long', 40], chinese: ['round', 60], european: ['elong', 50], ghost: ['thin', 25], spiny: ['round', 30], orchid: ['flat', 45],
    boxer: ['tiny', 12], budwing: ['elong', 30], bark: ['flat', 20], stick: ['thin', 30], deadleaf: ['long', 35], violin: ['thin', 25], giantasian: ['round', 70], devilsflower: ['ribbon', 55] };
  for (const S of JT.SPECIES) { const o = OOTH[S.id] || ['elong', 30]; S.ooth = { k: o[0], n: o[1] }; }
  JT.SPECIES_BY_ID = {}; JT.SPECIES.forEach(s => JT.SPECIES_BY_ID[s.id] = s);
  // mantises eat each other: at most two share a tank (cannibalism arrives with the behaviour pack)
  for (const k in JT.HABITATS) JT.HABITATS[k].cap = Math.min(JT.HABITATS[k].cap, 2);
  JT.STAGES = ['Hatchling', 'Nymph', 'Juvenile', 'Sub-adult', 'Young Adult', 'Adult'];
  JT.NAMES = ['Mantra', 'Twig', 'Basil', 'Sage', 'Prayer', 'Clove', 'Fennel', 'Reed', 'Hazel', 'Wren', 'Petal', 'Thistle', 'Moss', 'Ginger', 'Pistachio', 'Matcha', 'Fern', 'Willow', 'Juniper', 'Olive', 'Bramble', 'Cricket', 'Sorrel', 'Tansy', 'Lichen', 'Rook', 'Ash', 'Pip', 'Sprig', 'Dill', 'Chive', 'Lotus', 'Orchid', 'Ghost', 'Vesper', 'Sickle', 'Hook', 'Monk', 'Zen', 'Biscuit'];
  // jumper-only journal entries (hybrids, silk, peacock dances...) are hidden; mantis entries arrive with the behaviour pack
  if (JT.JOURNAL_CATS) JT.JOURNAL_CATS = JT.JOURNAL_CATS.filter(c => c[0] !== 'hybrid').map(c => c[0] === 'social' ? [c[0], 'Mantises together'] : c[0] === 'you' ? [c[0], 'You & your mantises'] : c);
})(typeof window !== 'undefined' ? window : globalThis);
