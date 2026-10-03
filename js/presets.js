/* Jumper Terrarium — adaptive habitat presets (themes generated for any enclosure shape),
   custom presets, and the starter layouts. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  const P = JT.Presets = {};
  P.forType = (type) => JT.PRESETS.filter(p => p[2].includes(type)).map(p => ({ name: p[0], theme: p[1] }));

  function tryPlace(hab, type, rng, region, tries) {
    const W = hab.dims.w, D = hab.dims.d;
    for (let k = 0; k < (tries || 25); k++) {
      const x = region ? rng.range(region[0], region[1]) : rng.range(10, W - 10);
      const z = region && region[2] != null ? rng.range(region[2], region[3]) : rng.range(12, D - 12);
      const rot = rng.int(0, 3); const seed = (rng() * 1e9) | 0;
      if (hab.canPlace(type, x, z, rot, seed).ok) return hab.addDecor(type, x, z, rot, seed);
    }
    return null;
  }
  function stackOn(hab, type, rng) {
    const plats = hab.decor.filter(d => JT.DECOR_BY_ID[d.type].platform && hab.geoms[d.id] && hab.geoms[d.id].tops.length);
    for (let k = 0; k < 12 && plats.length; k++) {
      const pd = rng.pick(plats); const g = hab.geoms[pd.id]; const t = g.tops[g.tops.length - 1]; const c = JT.G.centroid(t.poly);
      const q = JT.G.scalePoly(t.poly, 0.45, c); const v = rng.pick(q); const x = M.lerp(c[0], v[0], rng()), z = M.lerp(c[1], v[1], rng());
      const rot = rng.int(0, 3), seed = (rng() * 1e9) | 0;
      if (hab.canPlace(type, x, z, rot, seed).ok) return hab.addDecor(type, x, z, rot, seed);
    }
    return null;
  }
  /** Generate a themed layout adapted to the target enclosure. */
  P.generate = function (hab, themeId, seed) {
    const th = JT.PRESET_THEMES[themeId]; if (!th) return;
    const rng = JT.makeRng(seed || ((JT.R() * 1e9) | 0));
    hab.data.decor = []; hab.rebuild();
    hab.data.substrate = th.sub; hab.data.bg = th.bg;
    const t = hab.data.type, W = hab.dims.w, D = hab.dims.d;
    const compact = t === 'nano' || t === 'breeder';
    const filt = (arr) => { const a = compact ? arr.filter(id => JT.DECOR_BY_ID[id].small) : arr; return a.length ? a : arr; };
    const area = W * D / 18000;
    const nTall = compact ? 1 : Math.max(1, Math.round(area * 0.9 + (hab.dims.h > 130 ? 1 : 0)));
    const nMid = compact ? 1 : Math.round(1.5 + area * 1.2);
    const nPlant = compact ? 3 : Math.round(3 + area * 2.2);
    const nGround = compact ? 2 : Math.round(2 + area);
    const tall = filt(th.tall), mid = filt(th.mid), plants = filt(th.plants), ground = filt(th.ground);
    for (let i = 0; i < nTall; i++) { const seg = W / nTall; tryPlace(hab, tall[i % tall.length], rng, [seg * i + seg * 0.2, seg * (i + 1) - seg * 0.2, D * 0.35, D * 0.75]); }
    for (let i = 0; i < nMid; i++) tryPlace(hab, mid[i % mid.length], rng);
    for (let i = 0; i < nPlant; i++) { const id = plants[i % plants.length]; if (!(rng() < 0.35 && JT.DECOR_BY_ID[id].stack && stackOn(hab, id, rng))) tryPlace(hab, id, rng); }
    for (let i = 0; i < nGround; i++) tryPlace(hab, ground[i % ground.length], rng);
    if (!hab.decor.some(d => JT.DECOR_BY_ID[d.type].water)) tryPlace(hab, 'waterdish', rng);
    hab.decor.forEach(d => { d.novel = false; });
  };
  P.saveCustom = function (game, hab, name) {
    const items = hab.sortedDecor().map(d => ({ type: d.type, fx: d.x / hab.dims.w, fz: d.z / hab.dims.d, rot: d.rot, seed: d.seed }));
    game.state.customPresets.push({ name, items, sub: hab.data.substrate, bg: hab.data.bg, from: hab.data.type });
  };
  P.applyCustom = function (hab, preset) {
    hab.data.decor = []; hab.rebuild();
    hab.data.substrate = preset.sub; hab.data.bg = preset.bg; let ok = 0;
    for (const it of preset.items) { const x = it.fx * hab.dims.w, z = it.fz * hab.dims.d; if (hab.canPlace(it.type, x, z, it.rot, it.seed).ok) { hab.addDecor(it.type, x, z, it.rot, it.seed); ok++; } }
    hab.decor.forEach(d => { d.novel = false; });
    return ok;
  };
  /** Hand-arranged Starter Terrarium (Standard 200 x 90). */
  P.starter = function (hab) {
    const L = [['mosspatch', 40, 62, 0], ['leaflitter', 150, 70, 0], ['waterdish', 172, 22, 0], ['corkbark', 120, 70, 0], ['corktower', 30, 38, 0], ['driftwood', 92, 40, 1],
      ['fern', 63, 66, 0], ['tallgrass', 186, 55, 0], ['succulent', 128, 70, 0], ['glowshroom', 14, 72, 0], ['flatstone', 150, 38, 0], ['pinkflowers', 108, 22, 0], ['tinytree', 62, 24, 0], ['pothos', 30, 38, 0], ['oaklitter', 92, 75, 0]];
    let s = 11;
    for (const [t, x, z, r] of L) { s += 7; if (hab.canPlace(t, x, z, r, s).ok) hab.addDecor(t, x, z, r, s); }
    hab.data.substrate = 'coco'; hab.data.bg = 'mossy';
    hab.decor.forEach(d => { d.novel = false; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
