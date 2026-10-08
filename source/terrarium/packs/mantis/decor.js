/* Mantis Terrarium pack — mantis decor (stage 4): thin twigs and perches, a molting cross-perch, tall flower spikes.
   No lid: mantises hang (and molt) from the high tips of twigs, stems, flower spikes and bark with open air below.
   Injected after the decor geometry (03), before navigation (04). */
(function (root) {
  'use strict';
  const JT = root.JT, Geo = JT.Geo, ARCH = Geo.ARCH, bez = Geo._bez; if (!ARCH) return;
  const DOWN = [0, -1, 0];

  // ---- molting cross-perch: an upright twig with two crossbars high up, plenty of open air below them ----
  ARCH.mcross = function (B, p, sc) {
    const h = p.h * sc, r = p.r, col = p.col, rng = B.rng; const ys = [0, 0.2, 0.4, 0.62, 0.8, 0.88, 1].map(k => k * h);
    const post = ys.map((y, i) => [Math.sin(i * 1.3) * 0.6, y, Math.cos(i * 0.9) * 0.4]); B.prim({ t: 'tube', pts: post, r0: r * 1.3, r1: r * 0.8, col, style: 'bark' }); B.path(post, r, 'branch', { flex: 0.04 });
    for (const [k, dir, L] of [[3, 0, p.bar], [5, 1, p.bar * 0.8]]) {
      const c = post[k]; const a = dir ? [0, 0, 1] : [1, 0, 0]; const off = (rng() - 0.5) * 0.8;
      const pts = [-1, -0.5, 0, 0.5, 1].map(t => [c[0] + a[0] * t * L / 2, c[1] + (t === 0 ? 0 : off * Math.abs(t)), c[2] + a[2] * t * L / 2]);
      B.prim({ t: 'tube', pts, r0: r * 0.75, r1: r * 0.75, col, style: 'bark' }); B.path(pts, r * 0.7, 'branch', { flex: 0.05 });
    }
    B.height = h + 2; B.coverR = p.bar * 0.4;
  };
  const DD = (id, name, cat, arche, p, f) => Object.assign({ id, name, cat, arche, p: p || {}, platform: false, stack: false, cover: 0, small: false }, f || {});
  const add = [
    DD('crossperch', 'Molting Cross-Perch', 'decor', 'mcross', { h: 70, r: 1.4, bar: 26, col: '#6a4e34' }, { small: true, desc: 'High crossbars with open air below: room to hang and molt' }),
    DD('tallTwig', 'Tall Twig', 'decor', 'branch', { kind: 'perch', L: 28, h: 72, r: 1.1, col: '#5e4630' }, { small: true, desc: 'A thin upright twig, ideal for hanging' }),
    DD('twigtangle', 'Twig Tangle', 'decor', 'branch', { kind: 'forked', L: 54, h: 58, r: 1.3, col: '#6a5038' }, { small: true, cover: .1, desc: 'Crossing twigs for ambush perches' }),
    DD('flowerspike', 'Flower Spike', 'plants', 'flower', { n: 4, h: 58, petal: '#f4ecf6', center: '#e8c840', spike: true }, { stack: true, cover: .25, flowers: true, small: true, desc: 'Tall blooms: flies come to them, mantises wait on them' }),
    DD('orchidspray', 'Orchid Spray', 'plants', 'flower', { n: 4, h: 50, petal: '#fae6f2', center: '#d0508a', orchid: true, leaves: true }, { stack: true, cover: .3, flowers: true, desc: 'Pale orchids: an orchid mantis vanishes among them' }),
    DD('deadleafbranch', 'Dead Leaf Branch', 'decor', 'branch', { kind: 'vine', L: 80, h: 50, r: 1.6, col: '#6a5038', leaves: '#9a6a34' }, { cover: .3, desc: 'Brown curled leaves: a ghost mantis hides as one' }),
  ];
  for (const d of add) if (!JT.DECOR_BY_ID[d.id]) { JT.DECOR.push(d); JT.DECOR_BY_ID[d.id] = d; }

  // ---- presets for the new biomes ----
  Object.assign(JT.PRESET_THEMES, {
    orchidgarden: { sub: 'jungle', bg: 'canopy', tall: ['crossperch', 'tinytree', 'tallTwig'], mid: ['twigperch', 'branchperch', 'corkround'], plants: ['orchidspray', 'orchid', 'flowerspike', 'miniorchid', 'pinkflowers', 'bromeliad'], ground: ['mosspatch', 'leaflitter'] },
    dryleaf: { sub: 'leafmould', bg: 'log', tall: ['crossperch', 'forked', 'tallTwig'], mid: ['deadleafbranch', 'twigtangle', 'driftwood', 'hollowlog'], plants: ['driedflowers', 'fern', 'tallgrass'], ground: ['oaklitter', 'leaflitter', 'twigs'] },
  });
  JT.PRESETS.unshift(['Orchid Garden', 'orchidgarden', ['standard', 'wide', 'cube', 'arboreal', 'panoramic']], ['Dry Leaf Forest', 'dryleaf', ['standard', 'wide', 'cube', 'arboreal']]);
})(typeof window !== 'undefined' ? window : globalThis);
