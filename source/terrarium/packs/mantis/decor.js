/* Mantis Terrarium pack — mantis decor (stage 4): thin twigs and perches, a molting cross-perch, tall flower spikes.
   No lid: mantises hang (and molt) from the high tips of twigs, stems, flower spikes and bark with open air below.
   Injected after the decor geometry (03), before navigation (04). */
(function (root) {
  'use strict';
  const JT = root.JT, Geo = JT.Geo, ARCH = Geo.ARCH, bez = Geo._bez; if (!ARCH) return;
  const DOWN = [0, -1, 0];
  const shade = (hex, a) => { const h = hex.replace('#', ''); const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return '#' + c.map(v => Math.round(M.clamp(a < 0 ? v * (1 + a) : v + (255 - v) * a, 0, 255)).toString(16).padStart(2, '0')).join(''); };
  const M = JT.M;

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

  // ---- v1.2: bamboo stalks — segmented canes with pale nodes and a few lance leaves near the top ----
  ARCH.bamboo = function (B, p, sc) {
    const rng = B.rng, n = p.n || 4; let top = 0;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.28 + rng() * 0.8, r0 = 2 + rng() * 4; const bx = Math.cos(a) * r0, bz = Math.sin(a) * r0 * 0.8;
      const H = p.h * sc * (0.7 + rng() * 0.35), lean = (rng() - 0.5) * 6, r = p.r * (0.8 + rng() * 0.35); top = Math.max(top, H);
      const pts = []; for (let s = 0; s <= 8; s++) { const t = s / 8; pts.push([bx + lean * t * t, t * H, bz + lean * 0.4 * t * t]); }
      const col = shade(p.col, (rng() - 0.5) * 0.2);
      B.prim({ t: 'tube', pts, r0: r, r1: r * 0.75, col, style: 'stem' });
      const seg = 4 + Math.floor(rng() * 2);
      for (let k = 1; k < seg; k++) { const t = k / seg; const q = pts[Math.round(t * 8)]; const rr = r * (1 - 0.25 * t) * 1.18; B.prim({ t: 'tube', pts: [[q[0], q[1] - 0.5, q[2]], [q[0], q[1] + 0.5, q[2]]], r0: rr, r1: rr, col: p.node, style: 'stem' }); }
      B.path(pts, r, 'stem', { flex: 0.3, perch: true });
      for (let k = 0; k < 4; k++) { const q = pts[5 + Math.floor(rng() * 4)]; Geo._leaf(B, q, rng() * 6.28, 9 + rng() * 5, 1.8, p.leaf, null, 'lance', -0.25 - rng() * 0.4, q[1]); }
    }
    B.height = top + 3; B.coverR = 9;
  };
  // ---- v1.2: Spanish moss — a bare stand with grey-green strands hanging from its arms ----
  ARCH.moss = function (B, p, sc) {
    const rng = B.rng, H = p.h * sc;
    const post = [[0, 0, 0], [0.6, H * 0.35, 0.2], [-0.3, H * 0.7, -0.2], [0.2, H, 0]];
    B.prim({ t: 'tube', pts: post, r0: 1.6, r1: 1.1, col: p.col, style: 'bark' }); B.path(post, 1.4, 'branch', { flex: 0.05 });
    const arms = [[H * 0.95, 0, p.arm], [H * 0.78, 2.4, p.arm * 0.75]];
    for (const [y, ang, L] of arms) {
      const d = [Math.cos(ang), 0, Math.sin(ang) * 0.8]; const pts = [-0.5, -0.25, 0, 0.25, 0.5].map((t, i) => [d[0] * t * L, y + (i === 2 ? 0.5 : 0) - Math.abs(t) * 2, d[2] * t * L]);
      B.prim({ t: 'tube', pts, r0: 0.9, r1: 0.7, col: p.col, style: 'bark' }); B.path(pts, 0.8, 'branch', { flex: 0.08, perch: true });
      const ns = p.strands || 8;
      for (let k = 0; k < ns; k++) {
        const t = -0.45 + 0.9 * (k + rng() * 0.6) / ns; const o = [d[0] * t * L, y - Math.abs(t) * 2 - 0.3, d[2] * t * L]; const len = 10 + rng() * (y * 0.35);
        const st = []; for (let s = 0; s <= 6; s++) { const u = s / 6; st.push([o[0] + Math.sin(u * 5 + k) * 1.4 * u, o[1] - u * len, o[2] + Math.cos(u * 4 + k) * 1.1 * u]); }
        B.prim({ t: 'tube', pts: st, r0: 0.9, r1: 0.3, col: shade(p.moss, (rng() - 0.5) * 0.25), style: 'vine' });
        for (let s = 1; s < 6; s++) if (rng() < 0.8) Geo._leaf(B, st[s], rng() * 6.28, 3.2, 0.9, shade(p.moss, (rng() - 0.5) * 0.2), null, 'lance', -1.25, st[s][1]);
        if (k % 3 === 1) B.path(st.slice().reverse(), 0.4, 'stem', { flex: 0.7 });
      }
    }
    B.height = H + 2; B.coverR = p.arm * 0.45;
  };
  // ---- v1.2: dead-leaf cluster — a curved twig hung with curled brown leaves ----
  ARCH.leafcluster = function (B, p, sc) {
    const rng = B.rng, H = p.h * sc;
    const pts = bez([0, 0, 0], [3, H * 0.6, 1], [p.reach, H, 0], 9);
    B.prim({ t: 'tube', pts, r0: 1.4, r1: 0.6, col: p.col, style: 'bark' }); B.path(pts, 1.0, 'branch', { flex: 0.25, perch: true });
    const tw = bez(pts[5], [pts[5][0] - 5, pts[5][1] + 6, 4], [pts[5][0] - 9, pts[5][1] + 4, 7], 5);
    B.prim({ t: 'tube', pts: tw, r0: 0.6, r1: 0.35, col: p.col, style: 'bark' }); B.path(tw, 0.5, 'branch', { flex: 0.35 });
    const cols = p.leaves;
    for (let k = 0; k < (p.n || 16); k++) {
      const src = rng() < 0.35 ? tw : pts; const q = src[Math.max(2, Math.floor(src.length * (0.35 + rng() * 0.65)) - 1)];
      const c = cols[Math.floor(rng() * cols.length)];
      Geo._leaf(B, [q[0] + (rng() - 0.5) * 2, q[1] - 0.5, q[2] + (rng() - 0.5) * 2], rng() * 6.28, 5 + rng() * 3, 2.6 + rng(), c, shade(c, -0.25), 'oval', -0.9 - rng() * 0.5, q[1], { roll: 0.6 + rng() * 0.6 });
    }
    B.height = H + 2; B.coverR = Math.max(8, p.reach * 0.6);
  };
  const DD = (id, name, cat, arche, p, f) => Object.assign({ id, name, cat, arche, p: p || {}, platform: false, stack: false, cover: 0, small: false }, f || {});
  const add = [
    DD('crossperch', 'Molting Cross-Perch', 'decor', 'mcross', { h: 70, r: 1.4, bar: 26, col: '#6a4e34' }, { small: true, desc: 'High crossbars with open air below: room to hang and molt' }),
    DD('tallTwig', 'Tall Twig', 'decor', 'branch', { kind: 'perch', L: 28, h: 72, r: 1.1, col: '#5e4630' }, { small: true, desc: 'A thin upright twig, ideal for hanging' }),
    DD('twigtangle', 'Twig Tangle', 'decor', 'branch', { kind: 'forked', L: 54, h: 58, r: 1.3, col: '#6a5038' }, { small: true, cover: .1, desc: 'Crossing twigs for ambush perches' }),
    DD('flowerspike', 'Flower Spike', 'plants', 'flower', { n: 4, h: 58, petal: '#f4ecf6', center: '#e8c840', spike: true }, { stack: true, cover: .25, flowers: true, small: true, desc: 'Tall blooms: flies come to them, mantises wait on them' }),
    DD('orchidspray', 'Orchid Spray', 'plants', 'flower', { n: 4, h: 50, petal: '#fae6f2', center: '#d0508a', orchid: true, leaves: true }, { stack: true, cover: .3, flowers: true, desc: 'Pale orchids: an orchid mantis vanishes among them' }),
    DD('deadleafbranch', 'Dead Leaf Branch', 'decor', 'branch', { kind: 'vine', L: 80, h: 50, r: 1.6, col: '#6a5038', leaves: '#9a6a34' }, { cover: .3, desc: 'Brown curled leaves: a ghost mantis hides as one' }),
    DD('bamboo', 'Bamboo Stalks', 'plants', 'bamboo', { n: 4, h: 72, r: 1.5, col: '#8ea24a', node: '#c8c890', leaf: '#6f9a3c' }, { stack: true, cover: .2, small: true, mtags: ['tropical', 'grass'], blend: ['stick', 'chinese'], desc: 'Segmented canes with a few leaves on top: tall, springy perches' }),
    DD('spanishmoss', 'Spanish Moss Hangings', 'decor', 'moss', { h: 64, arm: 34, strands: 10, col: '#5e4a36', moss: '#a3ad94' }, { cover: .25, mtags: ['tropical', 'bark'], blend: ['ghost', 'violin', 'bark'], desc: 'Grey-green strands hanging from a bare stand' }),
    DD('leafcluster', 'Dead-Leaf Cluster', 'decor', 'leafcluster', { h: 48, reach: 18, n: 18, col: '#5a4430', leaves: ['#8a5a2e', '#a8743c', '#6e4a2a', '#b88a4a'] }, { cover: .3, small: true, mtags: ['litter', 'bark'], blend: ['deadleaf', 'ghost'], desc: 'Curled brown leaves on a bent twig: a dead leaf mantis vanishes here' }),
    DD('barkslab', 'Upright Bark Slab', 'decor', 'slab', { w: 26, d: 5, h: 62, style: 'cork' }, { cover: .15, mtags: ['bark'], blend: ['bark', 'giantasian'], desc: 'A tall flat slab of bark: bark mantises sprint up it and freeze' }),
  ];
  for (const d of add) if (!JT.DECOR_BY_ID[d.id]) { JT.DECOR.push(d); JT.DECOR_BY_ID[d.id] = d; }

  // ---- presets for the new biomes ----
  Object.assign(JT.PRESET_THEMES, {
    orchidgarden: { sub: 'jungle', bg: 'canopy', tall: ['crossperch', 'tinytree', 'tallTwig'], mid: ['twigperch', 'branchperch', 'corkround'], plants: ['orchidspray', 'orchid', 'flowerspike', 'miniorchid', 'pinkflowers', 'bromeliad'], ground: ['mosspatch', 'leaflitter'] },
    dryleaf: { sub: 'leafmould', bg: 'log', tall: ['crossperch', 'forked', 'tallTwig'], mid: ['deadleafbranch', 'twigtangle', 'driftwood', 'hollowlog'], plants: ['driedflowers', 'fern', 'tallgrass'], ground: ['oaklitter', 'leaflitter', 'twigs'] },
  });

  // v1.2 decor in the themes
  const addTo = (th, key, ids) => { const T = JT.PRESET_THEMES[th]; if (!T) return; const a = T[key] || (T[key] = []); for (const id of ids) if (!a.includes(id)) a.push(id); };
  addTo('orchidgarden', 'tall', ['bamboo']); addTo('orchidgarden', 'mid', ['spanishmoss']);
  addTo('dryleaf', 'mid', ['leafcluster', 'barkslab']);
  addTo('jungle', 'tall', ['bamboo', 'spanishmoss']); addTo('canopy', 'mid', ['spanishmoss']); addTo('paradise', 'tall', ['bamboo']);
  addTo('barkwall', 'tall', ['barkslab']); addTo('trunkwall', 'tall', ['barkslab']); addTo('forest', 'mid', ['leafcluster']); addTo('birch', 'mid', ['leafcluster']);
  JT.PRESETS.unshift(['Orchid Garden', 'orchidgarden', ['standard', 'wide', 'cube', 'arboreal', 'panoramic']], ['Dry Leaf Forest', 'dryleaf', ['standard', 'wide', 'cube', 'arboreal']]);
})(typeof window !== 'undefined' ? window : globalThis);
