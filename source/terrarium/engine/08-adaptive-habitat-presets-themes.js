/* Jumper Terrarium — adaptive habitat presets (themes generated for any enclosure shape),
   custom presets, and the starter layouts. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  const P = JT.Presets = {};
  P.forType = (type) => JT.PRESETS.filter(p => p[2].includes(type)).map(p => ({ name: p[0], theme: p[1] }));

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
  /** Generate a calm, minimal themed layout for the target enclosure: one hero piece off-centre at the back, a
      quieter partner on the other third, small plant groups tucked round their bases, a little ground cover and
      open floor left in front (room to watch a hunt). Mirrored at random so presets don't all look alike. */
  P.generate = function (hab, themeId, seed, vary, keep) {
    const th = JT.PRESET_THEMES[themeId]; if (!th) return;
    const rng = JT.makeRng(seed || ((JT.R() * 1e9) | 0));
    hab.data.decor = (keep || []).slice(); hab.rebuild();
    hab.data.substrate = th.sub; hab.data.bg = th.bg;
    const t = hab.data.type, W = hab.dims.w, D = hab.dims.d;
    const compact = t === 'nano' || t === 'breeder', wide = W >= 240, tall = hab.dims.h >= 140;
    const fits = (id) => !!JT.DECOR_BY_ID[id] && (!compact || JT.DECOR_BY_ID[id].small);
    const offs = new Map(); // each generation rotates through the theme pools, so newer pieces show up too (fixed layouts pass vary = false)
    const pickFrom = (arr, i) => { const a = arr.filter(fits); if (!a.length) return null; const k = arr.join(); if (!offs.has(k)) offs.set(k, vary === false ? 0 : rng.int(0, a.length - 1)); return a[(i + offs.get(k)) % a.length]; };
    const flip = rng() < 0.5; const X = (f) => (flip ? 1 - f : f) * W;
    // place near an anchor: the exact spot first, then a widening spiral (front side preferred when asked)
    const near = (type, ax, az, rad, front) => {
      if (!type) return null;
      for (let k = 0; k < 36; k++) {
        const r = k === 0 ? 0 : rad * (0.25 + 0.75 * k / 36); let a = k * 2.399 + rng() * 0.6; if (front) a = Math.PI + 0.5 + (a % (Math.PI - 1.0));
        const x = M.clamp(ax + Math.cos(a) * r, 8, W - 8), z = M.clamp(az + Math.sin(a) * r * 0.75, 8, D - 8);
        const rot = rng.int(0, 3), sd = (rng() * 1e9) | 0;
        if (hab.canPlace(type, x, z, rot, sd).ok) return hab.addDecor(type, x, z, rot, sd);
      }
      return null;
    };
    const radiusOf = (inst) => { const g = inst && hab.geoms[inst.id]; if (!g || !g.foot) return 6; return Math.sqrt(Math.abs(JT.G.polyArea(g.foot)) / Math.PI); };
    // a small group of plants tucked round the front and sides of a piece
    const tuck = (inst, kinds, n) => { if (!inst) return; const c = [inst.x, inst.z]; const R0 = radiusOf(inst);
      for (let i = 0; i < n; i++) { const id = kinds[i % kinds.length]; if (!id) continue; const a = Math.PI + 0.35 + (i / Math.max(1, n - 1 || 1)) * (Math.PI - 0.7) + (rng() - 0.5) * 0.3; const d = R0 + 3 + rng() * 5;
        near(id, c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d * 0.8, 10, false); } };
    const plants = [pickFrom(th.plants, 0), pickFrom(th.plants, 1), pickFrom(th.plants, 2)];
    const anchors = [];
    // back-wall themes: the wall is the hero; hang one or two mounts on it
    let hero = null;
    if (th.back && JT.DECOR_BY_ID[th.tall[0]].arche === 'backwall') {
      hero = near(th.tall[0], W / 2, D - 8, 3, false);
      if (hero) P.dressWall(hab, rng, compact ? 2 : 4, false);
      const free = pickFrom(th.tall.slice(1).concat(th.mid.filter(id => !JT.DECOR_BY_ID[id].mount)), 0);
      if (!compact && free) anchors.push(near(free, X(0.78), D * 0.42, 14, false));
    } else {
      const heroId = pickFrom(th.tall.filter(fits).length ? th.tall : th.tall.concat(th.mid.filter(id => !JT.DECOR_BY_ID[id].mount), ['corkround', 'branchperch', 'flatstone']), 0);
      hero = near(heroId, X(compact ? 0.38 : 0.33), D * (tall ? 0.55 : 0.6), 16, false);
      anchors.push(hero);
      const midFree = th.mid.filter(id => !JT.DECOR_BY_ID[id].mount);
      if (!compact) anchors.push(near(pickFrom(midFree, 0), X(0.7), D * 0.45, 18, false));
      else if (midFree.some(fits)) anchors.push(near(pickFrom(midFree, 0), X(0.74), D * 0.5, 12, false)); // nano / breeder: a perch plus one small ledge or hide
      // tall tanks: a climbing route up beside the hero so the height is usable
      const climb = tall && hero && !plants.slice(0, 2).some(id => id && JT.DECOR_BY_ID[id].arche === 'vine') && th.plants.concat(th.tall).find(id => JT.DECOR_BY_ID[id] && JT.DECOR_BY_ID[id].arche === 'vine');
      if (climb) near(climb, hero.x + (flip ? 1 : -1) * (radiusOf(hero) + 6), hero.z + 4, 10, false);
      if (wide) anchors.push(near(pickFrom(th.mid.filter(id => !JT.DECOR_BY_ID[id].mount), 1), X(0.9), D * 0.3, 14, false));
    }
    // plants: a group of two or three at the hero, one or two at its partner, maybe one up on the hero
    if (hero) tuck(hero, [plants[0], plants[1] || plants[0], plants[0]], compact ? 2 : 3);
    if (anchors[1]) tuck(anchors[1], [plants[1] || plants[0], plants[2] || plants[0]], wide ? 2 : 1 + (rng() < 0.5 ? 1 : 0));
    if (anchors[2]) tuck(anchors[2], [plants[2] || plants[0]], 1);
    if (!compact && hero && JT.DECOR_BY_ID[hero.type].platform && rng() < 0.7) { const small = th.plants.filter(id => JT.DECOR_BY_ID[id].stack && JT.DECOR_BY_ID[id].small); if (small.length) stackOn(hab, small[0], rng); }
    // ground cover: a single patch where the plants gather; a second one on bigger floors
    const g0 = pickFrom(th.ground, 0), g1 = pickFrom(th.ground, 1);
    if (hero) near(g0, hero.x + (flip ? -1 : 1) * 10, Math.max(14, hero.z - radiusOf(hero) - 8), 14, true);
    if (!compact && anchors[1] && g1) near(g1, anchors[1].x, Math.max(14, anchors[1].z - radiusOf(anchors[1]) - 6), 12, true);
    // water tucked by a front corner, near the partner piece
    if (!hab.decor.some(d => JT.DECOR_BY_ID[d.type].water)) near('waterdish', X(compact ? 0.8 : 0.86), D * 0.2, 12, false) || near('waterdish', X(0.6), D * 0.25, 60, false) || near('waterdish', W / 2, D / 2, Math.max(W, D), false);
    hab.decor.forEach(d => { d.novel = false; });
  };
  /** Dress the back wall with a small, composed set of free pieces from its kit (replaces earlier kit pieces). */
  P.dressWall = function (hab, rng, n, placedBy) {
    const w = hab.backWall(); if (!w) return 0; rng = rng || JT.makeRng((JT.R() * 1e9) | 0);
    const old = hab.data.decor.filter(d => d.wall === w.id && (JT.DECOR_BY_ID[d.type] || {}).kit);
    if (old.length) { hab.data.decor = hab.data.decor.filter(d => !old.includes(d)); hab.rebuild(); }
    const theme = (JT.WALL_KITS[w.type] || []).slice(), extra = (JT.WALL_TANK_KITS[hab.data.type] || []).filter(id => !theme.includes(id));
    for (let i = theme.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [theme[i], theme[j]] = [theme[j], theme[i]]; }
    const pick = theme.slice(0, Math.max(1, (n || 4) - (extra.length ? 1 : 0))); if (extra.length) pick.splice(1, 0, extra[Math.floor(rng() * extra.length)]);
    const ww = w.ww || hab.dims.w, H = w.wh || hab.dims.h, flip = rng() < 0.5;
    const slots = [[0.24, 0.6], [0.52, 0.36], [0.77, 0.7], [0.4, 0.84], [0.66, 0.2]].map(([fx, fy]) => [flip ? 1 - fx : fx, fy]);
    let placed = 0;
    for (let i = 0; i < pick.length; i++) {
      const id = pick[i], def = JT.DECOR_BY_ID[id]; let sl = slots[i % slots.length];
      if (def.p.kind === 'vine') sl = [sl[0], Math.max(sl[1], 0.72)]; // vines hang from high up
      for (let k = 0; k < 10; k++) {
        const x = w.x - ww / 2 + ww * M.clamp(sl[0] + (rng() - 0.5) * 0.08 * (1 + k * 0.3), 0.06, 0.94), my = H * M.clamp(sl[1] + (rng() - 0.5) * 0.06 * (1 + k * 0.4), 0.12, 0.9), sd = (rng() * 1e9) | 0;
        const c = hab.canPlace(id, x, w.z - 8, 0, sd, null, my);
        if (c.ok && hab.addDecor(id, c.x, c.z, c.rot, sd, placedBy, c.my)) { placed++; break; }
      }
    }
    return placed;
  };
  P.saveCustom = function (game, hab, name) {
    const items = hab.sortedDecor().map(d => ({ type: d.type, fx: d.x / hab.dims.w, fz: d.z / hab.dims.d, rot: d.rot, seed: d.seed, my: d.my, bare: d.bare || undefined }));
    game.state.customPresets.push({ name, items, sub: hab.data.substrate, bg: hab.data.bg, from: hab.data.type });
  };
  P.applyCustom = function (hab, preset) {
    hab.data.decor = []; hab.rebuild();
    hab.data.substrate = preset.sub; hab.data.bg = preset.bg; let ok = 0;
    for (const it of preset.items) { const x = it.fx * hab.dims.w, z = it.fz * hab.dims.d; if (hab.canPlace(it.type, x, z, it.rot, it.seed, null, it.my).ok) { hab.addDecor(it.type, x, z, it.rot, it.seed, false, it.my, { bare: it.bare }); ok++; } }
    hab.decor.forEach(d => { d.novel = false; });
    return ok;
  };
  /** Moss Tower (Vertical Tower 100 x 84): the minimal moss-wall layout, fixed so every new tower looks the same. */
  P.tower = function (hab) { P.generate(hab, 'mosswall', 5, false); };
  /** Hand-arranged Starter Terrarium (Standard 200 x 90): a cork tower on the left third with a pothos on top, a flat
      stone on the right third, small plant groups at their feet, open floor in the middle for hunting. */
  P.starter = function (hab) {
    const L = [['corktower', 64, 56, 0], ['fern', 44, 44, 0], ['glowshroom', 84, 40, 0], ['mosspatch', 60, 30, 0],
      ['flatstone', 140, 50, 0], ['tallgrass', 160, 64, 0], ['succulent', 124, 36, 0], ['leaflitter', 150, 28, 0], ['waterdish', 178, 20, 0]];
    let s = 11;
    for (const [t, x, z, r] of L) { s += 7; const rr = JT.makeRng(s); for (let k = 0; k < 30; k++) { const sp = k ? 2 + k * 0.5 : 0; const xx = x + (k ? (rr() - 0.5) * 2 * sp : 0), zz = z + (k ? (rr() - 0.5) * 2 * sp : 0); if (hab.canPlace(t, xx, zz, r, s).ok) { hab.addDecor(t, xx, zz, r, s); break; } } }
    const tower = hab.decor.find(d => d.type === 'corktower'); if (tower) { const g = hab.geoms[tower.id]; const tp = g && g.tops[g.tops.length - 1]; if (tp) { const c = JT.G.centroid(tp.poly); if (hab.canPlace('pothos', c[0], c[1], 0, 5).ok) hab.addDecor('pothos', c[0], c[1], 0, 5); } }
    hab.data.substrate = 'coco'; hab.data.bg = 'mossy';
    hab.decor.forEach(d => { d.novel = false; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
