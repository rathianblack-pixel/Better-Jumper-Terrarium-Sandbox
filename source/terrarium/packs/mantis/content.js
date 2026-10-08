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
  ];
  JT.SPECIES.forEach(s => { s.look = Object.assign({}, base, { gait: 'patient', fuzz: 0, tufts: null, palp: 'plain', irid: 0, note: s.desc }); });
  JT.SPECIES_BY_ID = {}; JT.SPECIES.forEach(s => JT.SPECIES_BY_ID[s.id] = s);
  // mantises eat each other: at most two share a tank (cannibalism arrives with the behaviour pack)
  for (const k in JT.HABITATS) JT.HABITATS[k].cap = Math.min(JT.HABITATS[k].cap, 2);
  JT.STAGES = ['Hatchling', 'Nymph', 'Juvenile', 'Sub-adult', 'Young Adult', 'Adult'];
  JT.NAMES = ['Mantra', 'Twig', 'Basil', 'Sage', 'Prayer', 'Clove', 'Fennel', 'Reed', 'Hazel', 'Wren', 'Petal', 'Thistle', 'Moss', 'Ginger', 'Pistachio', 'Matcha', 'Fern', 'Willow', 'Juniper', 'Olive', 'Bramble', 'Cricket', 'Sorrel', 'Tansy', 'Lichen', 'Rook', 'Ash', 'Pip', 'Sprig', 'Dill', 'Chive', 'Lotus', 'Orchid', 'Ghost', 'Vesper', 'Sickle', 'Hook', 'Monk', 'Zen', 'Biscuit'];
  // jumper-only journal entries (hybrids, silk, peacock dances...) are hidden; mantis entries arrive with the behaviour pack
  if (JT.JOURNAL_CATS) JT.JOURNAL_CATS = JT.JOURNAL_CATS.filter(c => c[0] !== 'hybrid').map(c => c[0] === 'social' ? [c[0], 'Mantises together'] : c[0] === 'you' ? [c[0], 'You & your mantises'] : c);
})(typeof window !== 'undefined' ? window : globalThis);
