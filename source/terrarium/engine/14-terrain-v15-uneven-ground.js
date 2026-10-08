/* Jumper Terrarium — terrain (v15): uneven ground per substrate, ground shape, mist pools, footprints and burrow marks.
   The simulation stays on its flat floor (y = 0); the ground is a height field that the renderer lifts everything near
   the floor onto. Ground flattens to 0 under every standing piece and near the front/side glass, so decor, climbing routes
   and wall-climbing stay exactly where the navigation expects them (the "house jumper on the wall" case). */
(function (root) {
  'use strict';
  const JT = root.JT = root.JT || {}; const M = JT.M;
  const T = JT.Terrain = {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v); const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // ---------- settings ----------
  T.SHAPES = { flat: { name: 'Flat', k: 0, back: 0 }, gentle: { name: 'Gentle', k: 0.55, back: 1.2 }, rolling: { name: 'Rolling', k: 0.8, back: 1.5 }, rugged: { name: 'Rugged', k: 1, back: 1.8 } };
  T.SHAPE_ORDER = ['flat', 'gentle', 'rolling', 'rugged'];
  // kind, feature size, max height (units), extras. A spider is a few units long, so 3 units is already a hill.
  T.STYLE = {
    desert:   { kind: 'dune', feat: 50, max: 3, rip: 0.07, label: 'Soft dunes, fine wind ripples' },
    beach:    { kind: 'dune', feat: 52, max: 2, rip: 0.06, tilt: 0.35, label: 'Gentle slope, small ripples' },
    redsand:  { kind: 'dune', feat: 42, max: 4, rip: 0.08, sharp: 1, label: 'Steeper dunes, rippled ridges' },
    dune:     { kind: 'dune', feat: 48, max: 3, rake: 0.05, label: 'Raked dunes' },
    coco:     { kind: 'crumb', feat: 14, max: 2.5, label: 'Coarse crumbly clumps' },
    black:    { kind: 'mound', feat: 16, max: 2, label: 'Fine crumbs, small mounds' },
    peat:     { kind: 'mound', feat: 20, max: 1.5, soft: 1, label: 'Spongy, low and rounded' },
    moss:     { kind: 'hummock', feat: 20, max: 3, label: 'Cushiony hummocks' },
    sphagnum: { kind: 'hummock', feat: 22, max: 4, lumpy: 1, label: 'Tall springy hummocks' },
    clay:     { kind: 'plates', feat: 22, max: 2, label: 'Cracked plates and terraces' },
    gravel:   { kind: 'stones', feat: 4.5, max: 3, label: 'Piles of rounded stones' },
    lime:     { kind: 'grit', feat: 6, max: 3, label: 'Angular chunks, low steps' },
    forest:   { kind: 'litter', feat: 20, max: 2.5, label: 'Low mounds and root ridges' },
    jungle:   { kind: 'litter', feat: 20, max: 3, vary: 1, label: 'Roots, humps and deep dips' },
    leafmould:{ kind: 'drift', feat: 28, max: 3, label: 'Soft leaf drifts' },
    mud:      { kind: 'flats', feat: 30, max: 1.5, label: 'Glossy flats, damp dips' },
  };
  // how clearly footprints show (0 = none: moss, sphagnum, gravel, grit)
  T.PRINT = { desert: 1, beach: 1, redsand: 1, dune: 1, mud: 0.9, coco: 0.45, black: 0.5, peat: 0.55, clay: 0.3, forest: 0.35, jungle: 0.35, leafmould: 0.3, moss: 0, sphagnum: 0, gravel: 0, lime: 0 };
  T.WET = { sphagnum: 1, moss: 0.9, peat: 0.9, jungle: 0.8, mud: 1, black: 0.5, leafmould: 0.5, forest: 0.4, coco: 0.4 }; // mist pools + wet hollows
  T.BURROW = (sub) => !['gravel', 'lime'].includes(sub) && ((JT.SUBSTRATES[sub] || {}).burrow || 0) > 0.3;
  const BIOME_GROUND = { desert: { shape: 'rolling' }, nightmoss: { kind: 'hummock', feat: 18, max: 3.5 }, paludarium: { basin: 1 } };
  T.conf = function (hab) {
    const d = hab.data; const t = d.terrain || (d.terrain = {}); if (!(t.seed >= 0)) t.seed = (JT.hashStr ? JT.hashStr(String(d.id)) : 1) % 1000003;
    const bg = BIOME_GROUND[d.biome] || {}; const shape = T.SHAPES[t.shape] ? t.shape : (bg.shape || 'gentle');
    const st = Object.assign({}, T.STYLE[d.substrate] || T.STYLE.coco); if (bg.kind) Object.assign(st, { kind: bg.kind, feat: bg.feat, max: bg.max, lumpy: 1 });
    return { shape, seed: t.seed, style: st, basin: !!bg.basin, auto: !T.SHAPES[t.shape] };
  };
  // ---------- noise ----------
  const hash = (s, i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const vn = (s, x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j; const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = hash(s, i, j), b = hash(s, i + 1, j), c = hash(s, i, j + 1), d = hash(s, i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm = (s, x, z, oct) => { let a = 0, amp = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { a += amp * vn(s + o * 31, x * f, z * f); n += amp; amp *= 0.5; f *= 2.03; } return a / n; };
  const nf = (s, x, z, oct) => clamp((fbm(s, x, z, oct) - 0.25) / 0.5, 0, 1); // ~0..1
  const worley = (s, x, z, c) => { const i = Math.floor(x / c), j = Math.floor(z / c); let d1 = 1e9, d2 = 1e9, id = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const px = (i + a + hash(s, i + a, j + b)) * c, pz = (j + b + hash(s + 7, i + a, j + b)) * c; const d = Math.hypot(x - px, z - pz); if (d < d1) { d2 = d1; d1 = d; id = hash(s + 13, i + a, j + b); } else if (d < d2) d2 = d; }
    return { d1, d2, id }; };
  // ---------- one height sample (0..1 of the style's max) ----------
  function styleH(st, s, x, z, W, D) {
    const F = st.feat;
    switch (st.kind) {
      case 'dune': { const th = (hash(s, 3, 9) - 0.5) * 1.2; const u0 = x * Math.cos(th) + z * Math.sin(th); const w = (fbm(s + 5, x / 60, z / 60, 2) - 0.5) * F * 0.9;
        const ph = (u0 + w) / F + hash(s, 1, 1); let q = ph - Math.floor(ph); let p = q < 0.72 ? sst(0, 0.72, q) : 1 - sst(0.72, 1, q); if (st.sharp) p = Math.pow(p, 0.75);
        const m = 0.5 + 0.5 * nf(s + 11, x / 70, z / 40, 2); let h = p * m;
        if (st.rip) { const u2 = x * Math.cos(th + 0.25) + z * Math.sin(th + 0.25); h += st.rip * Math.sin(u2 * 6.283 / 5) * (0.4 + 0.6 * p); }
        if (st.rake) h += st.rake * Math.sin(z * 6.283 / 3.2 + Math.sin(x * 0.05) * 0.8);
        if (st.tilt) h = h * (1 - st.tilt) + st.tilt * clamp(z / D, 0, 1);
        return h; }
      case 'crumb': { const n = nf(s, x / F, z / F, 3); const w = worley(s + 2, x, z, 5); const clod = Math.max(0, 1 - w.d1 / 2.6) * (0.5 + w.id * 0.5); const r = 1 - Math.abs(2 * fbm(s + 4, x / (F * 1.8), z / (F * 1.8), 2) - 1);
        return 0.62 * n + 0.28 * clod + 0.12 * Math.pow(r, 6); }
      case 'mound': { const n = nf(s, x / F, z / F, st.soft ? 2 : 3); return st.soft ? sst(0.1, 1, n) * 0.95 : sst(0.15, 1, n); }
      case 'hummock': { let n = nf(s, x / F, z / F, 3); let h = Math.pow(sst(0.25, 0.8, n), 0.85); if (st.lumpy) h = h * 0.78 + 0.22 * nf(s + 9, x / (F * 0.45), z / (F * 0.45), 2); return h; }
      case 'plates': { const w = worley(s, x, z, F); const lvl = Math.floor(w.id * 3) / 2; const crack = sst(0.6, 2.2, w.d2 - w.d1); return (0.3 + 0.62 * lvl) * crack + 0.08 * nf(s + 3, x / 9, z / 9, 2); }
      case 'stones': { const pile = nf(s, x / 25, z / 25, 2); const w = worley(s + 1, x, z, F); const r = (0.55 + 0.45 * w.id) * F * 0.5; const st1 = Math.sqrt(Math.max(0, 1 - (w.d1 / r) * (w.d1 / r))) * (r / (F * 0.5));
        return 0.45 * pile + 0.5 * st1 * (0.45 + 0.55 * pile); }
      case 'grit': { const w = worley(s + 1, x, z, F); const cone = Math.max(0, 1 - w.d1 / (F * 0.62)); const q = (v, n) => Math.round(v * n) / n; return 0.55 * q(cone * (0.5 + 0.5 * w.id), 4) + 0.45 * q(nf(s, x / 20, z / 20, 2), 3); }
      case 'litter': { const n = nf(s, x / F, z / F, 3); const root = Math.pow(1 - Math.abs(2 * fbm(s + 6, x / (F * 1.6), z / (F * 1.6), 2) - 1), 7); return st.vary ? 0.75 * sst(0.05, 0.95, n) + 0.32 * root : 0.7 * n + 0.3 * root; }
      case 'drift': { const n = nf(s, x / (F * 1.4), z / (F * 0.8), 3); return sst(0.15, 0.95, n); }
      case 'flats': { const d = sst(0.55, 0.78, fbm(s, x / F, z / F, 3)); return 0.62 * (1 - d) + 0.12 * nf(s + 2, x / 8, z / 8, 2); }
    }
    return 0;
  }
  // ---------- build the height field ----------
  /** Side profile for the Ground shape cards: n samples along the middle of the tank, in units. */
  T.profile = function (hab, shape, seed, n) { const c = T.conf(hab), st = c.style, SH = T.SHAPES[shape] || T.SHAPES.gentle; const W = Math.min(140, hab.dims.w), out = [];
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * W; const e = sst(0, 10, x) * sst(0, 10, W - x); out.push((clamp(styleH(st, seed, x, hab.dims.d * 0.55, hab.dims.w, hab.dims.d), 0, 1.15) * st.max * SH.k + SH.back * 0.5) * e); }
    return out; };
  T.CS = 1.25;
  T.key = (hab) => { const c = T.conf(hab); return [hab.data.substrate, c.shape, c.seed, hab.data.biome || 'classic', hab.data.type, hab._geomVersion].join('|'); };
  T.rides = (def) => !!def && def.cat === 'ground'; // ground cover follows the ground
  T.noPad = (def) => T.rides(def) || !!def.mount || def.arche === 'wallmount';
  T.get = function (hab) {
    const d0 = hab.data, tc = d0.terrain, F = hab._ter; // fast path (called many times a frame)
    if (F && tc && F._gv === hab._geomVersion && F._sub === d0.substrate && F._sh === tc.shape && F._sd === tc.seed && F._bi === d0.biome && F._ty === d0.type) return F;
    const key = T.key(hab); if (F && F.key === key) { Object.assign(F, { _gv: hab._geomVersion, _sub: d0.substrate, _sh: d0.terrain.shape, _sd: d0.terrain.seed, _bi: d0.biome, _ty: d0.type }); F.cv = T.cover(hab); return F; }
    const t0 = Date.now(); const c = T.conf(hab), dm = hab.dims, W = dm.w, D = dm.d, cs = T.CS; const nx = Math.max(2, Math.ceil(W / cs)), nz = Math.max(2, Math.ceil(D / cs)); const sx = W / nx, sz = D / nz;
    const N = (nx + 1) * (nz + 1); const H = new Float32Array(N), att = new Float32Array(N), pad = new Uint8Array(N); const S = c.shape, SH = T.SHAPES[S]; const st = c.style;
    const circ = dm.shape === 'circle'; const R = W / 2, Rz = D / 2;
    const glass = (x, z) => circ ? R - Math.hypot(x - R, (z - Rz) * R / Rz) : Math.min(x, W - x, z, D - z);
    // the noise field depends only on substrate/shape/seed/size; decor changes reuse it and only redo pads, slopes and hollows
    const ponds = c.basin ? hab.data.decor.filter(i => i.type === 'pond' || i.type === 'lilypond' || (JT.DECOR_BY_ID[i.type] || {}).arche === 'pond').map(i => { const g = hab.geoms[i.id]; if (!g || !g.foot) return null; const cc = JT.G.centroid(g.foot); return { c: cc, r: Math.sqrt(Math.abs(JT.G.polyArea(g.foot)) / Math.PI) }; }).filter(Boolean) : [];
    const bkey = [JSON.stringify(ponds.map(p => [p.c[0].toFixed(1), p.c[1].toFixed(1), p.r.toFixed(1)])), hab.data.substrate, S, c.seed, hab.data.biome || 'classic', W, D, dm.shape].join('|');
    let base = hab._terBase; if (!base || base.key !== bkey) { base = null; }
    if (SH.k > 0 && base) { H.set(base.H); att.set(base.att); }
    else if (SH.k > 0) {
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = i * sx, z = j * sz, k = j * (nx + 1) + i; const gd = glass(x, z); const a = sst(1.5, 9, gd); att[k] = a;
        let h = clamp(styleH(st, c.seed, x, z, W, D), 0, 1.15) * st.max * SH.k * a;
        const side = circ ? sst(1.5, 9, gd) : sst(1.5, 9, Math.min(x, W - x)); h += SH.back * sst(0.35, 1, z / D) * side * (circ ? 1 : sst(-1, 3, D - z)); // higher at the back
        for (const p of ponds) { const dd = Math.hypot(x - p.c[0], z - p.c[1]) - p.r; if (dd < 18) h = h * sst(0, 14, dd) + Math.exp(-(((dd - 6) / 3.5) ** 2)) * 1.1 * Math.max(0.5, SH.k) * a; }
        H[k] = Math.min(4, h); }
      hab._terBase = { key: bkey, H: H.slice(), att: att.slice() };
    }
    // pads: flat under everything standing in the substrate
    const mark = (poly, grow) => { if (!poly || poly.length < 3) return; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of poly) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
      const cc = JT.G.centroid(poly); const i0 = Math.max(0, Math.floor((x0 - grow) / sx)), i1 = Math.min(nx, Math.ceil((x1 + grow) / sx)), j0 = Math.max(0, Math.floor((z0 - grow) / sz)), j1 = Math.min(nz, Math.ceil((z1 + grow) / sz));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = i * sx, z = j * sz; let inside = JT.G.pointInPoly(x, z, poly);
        if (!inside) { const dx = x - cc[0], dz = z - cc[1], L = Math.hypot(dx, dz) || 1; inside = JT.G.pointInPoly(x - dx / L * grow, z - dz / L * grow, poly); }
        if (inside) pad[j * (nx + 1) + i] = 1; } };
    for (const inst of hab.data.decor) { const g = hab.geoms[inst.id]; const def = JT.DECOR_BY_ID[inst.type]; if (!g || !def || inst.parent || T.noPad(def) || inst.type === 'heatlamp') continue;
      let polys = (g.solids || []).concat(g.soft || []); if (g.foot) polys = polys.concat([g.foot]); if (!polys.length && g.contacts && g.contacts.length) { const cc = JT.G.centroid(g.contacts.length >= 3 ? g.contacts : [g.contacts[0], g.contacts[0], g.contacts[0]]); polys = [JT.G.circlePoly(cc[0], cc[1], 2.2, 2.2, 10)]; }
      for (const p of polys) mark(p, 1.3); }
    for (let k = 0; k < N; k++) if (pad[k]) H[k] = 0;
    // slopes capped near 30 degrees (chamfer sweeps: the largest field under the original whose slope never exceeds the cap)
    const cap = 0.55, dx = cap * sx, dz = cap * sz, dd = cap * Math.hypot(sx, sz), W1 = nx + 1;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const k = j * W1 + i; let v = H[k]; if (i > 0) v = Math.min(v, H[k - 1] + dx); if (j > 0) { v = Math.min(v, H[k - W1] + dz); if (i > 0) v = Math.min(v, H[k - W1 - 1] + dd); if (i < nx) v = Math.min(v, H[k - W1 + 1] + dd); } H[k] = v; }
      for (let j = nz; j >= 0; j--) for (let i = nx; i >= 0; i--) { const k = j * W1 + i; let v = H[k]; if (i < nx) v = Math.min(v, H[k + 1] + dx); if (j < nz) { v = Math.min(v, H[k + W1] + dz); if (i < nx) v = Math.min(v, H[k + W1 + 1] + dd); if (i > 0) v = Math.min(v, H[k + W1 - 1] + dd); } H[k] = v; }
    }
    // hollows and crests: compared with a blurred copy (~5 units around)
    const blur = (src, r) => { const a = new Float32Array(N), b = new Float32Array(N);
      for (let j = 0; j <= nz; j++) { let s = 0, n = 0; for (let i = -r; i <= nx + r; i++) { if (i + r <= nx && i + r >= 0) { s += src[j * W1 + i + r]; n++; } if (i - r - 1 >= 0 && i - r - 1 <= nx) { s -= src[j * W1 + i - r - 1]; n--; } if (i >= 0 && i <= nx) a[j * W1 + i] = s / Math.max(1, n); } }
      for (let i = 0; i <= nx; i++) { let s = 0, n = 0; for (let j = -r; j <= nz + r; j++) { if (j + r <= nz && j + r >= 0) { s += a[(j + r) * W1 + i]; n++; } if (j - r - 1 >= 0 && j - r - 1 <= nz) { s -= a[(j - r - 1) * W1 + i]; n--; } if (j >= 0 && j <= nz) b[j * W1 + i] = s / Math.max(1, n); } }
      return b; };
    const B1 = blur(blur(H, 4), 2); const sc = 0.18 * st.max * Math.max(0.3, SH.k) + 0.15; const near = blur(Float32Array.from(pad), 2);
    const hol = new Float32Array(N), cre = new Float32Array(N);
    if (SH.k > 0) for (let k = 0; k < N; k++) { const ok = att[k] * (1 - clamp(near[k] * 3, 0, 1)); hol[k] = clamp((B1[k] - H[k]) / sc, 0, 1) * ok; cre[k] = clamp((H[k] - B1[k]) / sc, 0, 1) * ok; }
    let mx = 0; for (let k = 0; k < N; k++) mx = Math.max(mx, H[k]);
    const ter = { key, nx, nz, sx, sz, H, hol, cre, pad, max: mx, shape: S, style: st, ms: Date.now() - t0, pools: null };
    Object.assign(ter, { _gv: hab._geomVersion, _sub: d0.substrate, _sh: d0.terrain.shape, _sd: d0.terrain.seed, _bi: d0.biome, _ty: d0.type }); ter.cv = T.cover(hab); hab._ter = ter; return ter;
  };
  const samp = (ter, A, x, z) => { const fx = clamp(x / ter.sx, 0, ter.nx), fz = clamp(z / ter.sz, 0, ter.nz); const i = Math.min(ter.nx - 1, Math.floor(fx)), j = Math.min(ter.nz - 1, Math.floor(fz)); const u = fx - i, v = fz - j, W1 = ter.nx + 1, k = j * W1 + i;
    return A[k] * (1 - u) * (1 - v) + A[k + 1] * u * (1 - v) + A[k + W1] * (1 - u) * v + A[k + W1 + 1] * u * v; };
  /** Ground height at (x, z). */
  T.at = (hab, x, z) => { const t = T.get(hab); return t.max > 0 ? samp(t, t.H, x, z) : 0; };
  T.hollow = (hab, x, z) => { const t = T.get(hab); return t.max > 0 ? samp(t, t.hol, x, z) : 0; };
  T.crest = (hab, x, z) => { const t = T.get(hab); return t.max > 0 ? samp(t, t.cre, x, z) : 0; };
  /** How far something at height y (above the flat floor) is raised onto the ground: fully on the floor, fading out by ~6 units up. */
  T.fade = (y) => y <= 0.6 ? 1 : Math.max(0, 1 - (y - 0.6) / 5.4);
  T.lift = (hab, x, z, y) => { const t = T.get(hab); if (!(t.max > 0)) return 0; const f = T.fade(y || 0); return f > 0 ? samp(t, t.H, x, z) * f : 0; };
  /** v21 ground cover relief (draw only): bulgy cover (moss cushions, pebbles, pods, cones, twigs) is walked OVER, flat litter
   *  (leaves, chips) is walked on normally. A fine height grid of the cover tops, widened and smoothed so bodies ride up gently. */
  T.COVER_CS = 0.5; T.COVER_MIN = 0.35;
  T.cover = function (hab) {
    const gv = hab._geomVersion; const C0 = hab._cov; if (C0 && C0._gv === gv && C0._n === hab.data.decor.length) return C0;
    const dm = hab.dims, cs = T.COVER_CS, nx = Math.max(2, Math.ceil(dm.w / cs)), nz = Math.max(2, Math.ceil(dm.d / cs)), W1 = nx + 1, N = W1 * (nz + 1);
    let A = null, any = false, bi0 = 1e9, bi1 = -1, bj0 = 1e9, bj1 = -1; const put = (x0, x1, z0, z1, fn) => { const i0 = Math.max(0, Math.floor(x0 / cs)), i1 = Math.min(nx, Math.ceil(x1 / cs)), j0 = Math.max(0, Math.floor(z0 / cs)), j1 = Math.min(nz, Math.ceil(z1 / cs));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const v = fn(i * cs, j * cs); if (v > T.COVER_MIN) { if (!A) A = new Float32Array(N); const k = j * W1 + i; if (v > A[k]) A[k] = v; if (!any || i < bi0) bi0 = i; if (i > bi1) bi1 = i; if (j < bj0) bj0 = j; if (j > bj1) bj1 = j; any = true; } } };
    for (const inst of hab.data.decor) { const g = hab.geoms[inst.id]; const def = JT.DECOR_BY_ID[inst.type]; if (!g || !def || def.arche !== 'scatter' || inst.parent || (g.baseY || 0) > 0.5) continue; const b0 = g.baseY || 0;
      for (const pr of g.prims) {
        if (pr.t === 'moss') for (const b of pr.blobs) { const r = b[2], hy = Math.min(1.6, r * 0.32); put(b[0] - r, b[0] + r, b[1] - r, b[1] + r, (x, z) => { const d2 = ((x - b[0]) ** 2 + (z - b[1]) ** 2) / (r * r); return d2 < 1 ? 0.05 + hy * Math.sqrt(1 - d2) : 0; }); }
        else if (pr.t === 'pebble' && pr.o) { const r = pr.r, a = pr.ang || 0, cn = pr.kind === 'cones', pd = pr.kind === 'pods'; const ax = cn ? r * 1.3 : r, az = cn ? r * 0.7 : pd ? r * 0.45 : r * 0.8, ry = cn ? r * 0.6 : pd ? r * 0.45 : r * 0.55, cy = pr.o[1] - b0 + (cn ? r * 0.4 : ry * 0.4);
          const ca = Math.cos(a), sa = Math.sin(a), R = Math.max(ax, az); put(pr.o[0] - R, pr.o[0] + R, pr.o[2] - R, pr.o[2] + R, (x, z) => { const dx = x - pr.o[0], dz = z - pr.o[2]; const u = dx * ca + dz * sa, w = -dx * sa + dz * ca; const d2 = (u / ax) ** 2 + (w / az) ** 2; return d2 < 1 ? cy + ry * Math.sqrt(1 - d2) : 0; }); }
        else if (pr.t === 'tube' && pr.pts && pr.pts.length === 2 && pr.pts[0][1] - b0 < 1.5) { const p0 = pr.pts[0], p1 = pr.pts[1], rr = Math.max(pr.r0 || 0.5, pr.r1 || 0.5), yy = (p0[1] + p1[1]) / 2 - b0; const ex = p1[0] - p0[0], ez = p1[2] - p0[2], L2 = ex * ex + ez * ez || 1;
          put(Math.min(p0[0], p1[0]) - rr, Math.max(p0[0], p1[0]) + rr, Math.min(p0[2], p1[2]) - rr, Math.max(p0[2], p1[2]) + rr, (x, z) => { const t = Math.max(0, Math.min(1, ((x - p0[0]) * ex + (z - p0[2]) * ez) / L2)); const d2 = ((x - p0[0] - ex * t) ** 2 + (z - p0[2] - ez * t) ** 2) / (rr * rr); return d2 < 1 ? yy + rr * Math.sqrt(1 - d2) : 0; }); }
      } }
    let H = null, mx = 0;
    if (any) { /* widen by a body's half-width so feet rest on the edge, then smooth so the ride up and over is gentle (only inside the cover's own box) */
      const I0 = Math.max(0, bi0 - 6), I1 = Math.min(nx, bi1 + 6), J0 = Math.max(0, bj0 - 6), J1 = Math.min(nz, bj1 + 6);
      const pass = (src, r, mode) => { const a = new Float32Array(N), b = new Float32Array(N);
        for (let j = J0; j <= J1; j++) for (let i = I0; i <= I1; i++) { let v = 0, n = 0; for (let d = -r; d <= r; d++) { const ii = i + d; if (ii >= 0 && ii <= nx) { const q = src[j * W1 + ii]; if (mode) { if (q > v) v = q; } else { v += q; n++; } } } a[j * W1 + i] = mode ? v : v / n; }
        for (let j = J0; j <= J1; j++) for (let i = I0; i <= I1; i++) { let v = 0, n = 0; for (let d = -r; d <= r; d++) { const jj = j + d; if (jj >= 0 && jj <= nz) { const q = a[jj * W1 + i]; if (mode) { if (q > v) v = q; } else { v += q; n++; } } } b[j * W1 + i] = mode ? v : v / n; } return b; };
      H = pass(pass(pass(A, 2, 1), 2, 0), 1, 0); for (let j = J0; j <= J1; j++) for (let i = I0; i <= I1; i++) { const k = j * W1 + i; if (H[k] < 0.05) H[k] = 0; if (H[k] > mx) mx = H[k]; } }
    const C = { _gv: gv, _n: hab.data.decor.length, nx, nz, sx: cs, sz: cs, H, max: mx }; hab._cov = C; return C;
  };
  T.coverAt = (hab, x, z) => { const c = T.cover(hab); return c.max > 0 ? samp(c, c.H, x, z) : 0; };
  T.liftWith = (t, p) => { if (!t || !p) return p; const c = t.cv; if (!(t.max > 0) && !(c && c.max > 0)) return p; const f = T.fade(p[1] || 0); if (f <= 0) return p; let l = t.max > 0 ? samp(t, t.H, p[0], p[2]) : 0; if (c && c.max > 0) l += samp(c, c.H, p[0], p[2]); l *= f; return l > 0.002 ? [p[0], p[1] + l, p[2]] : p; };
  T.liftP = (hab, p) => { if (!p) return p; const l = T.lift(hab, p[0], p[2], p[1]); return l > 0.002 ? [p[0], p[1] + l, p[2]] : p; };
  /** A crest between eye and target (both near the floor) hides small things behind it. */
  T.blocks = function (hab, a, b) {
    const t = T.get(hab); if (!(t.max > 0.6) || a[1] > 6 || b[1] > 6) return false;
    const ya = a[1] + T.lift(hab, a[0], a[2], a[1]), yb = b[1] + T.lift(hab, b[0], b[2], b[1]); const L = Math.hypot(b[0] - a[0], b[2] - a[2]); if (L < 6) return false;
    const n = Math.min(10, Math.ceil(L / 4)); for (let i = 1; i < n; i++) { const u = i / n; const x = a[0] + (b[0] - a[0]) * u, z = a[2] + (b[2] - a[2]) * u; if (samp(t, t.H, x, z) > ya + (yb - ya) * u + 0.35) return true; }
    return false;
  };
  /** Low spots where mist water collects (wet substrates only). */
  T.poolSpots = function (hab) {
    const t = T.get(hab); if (t.pools) return t.pools; const out = [];
    if (t.max > 0.4 && (T.WET[hab.data.substrate] || 0) >= 0.4) { const W1 = t.nx + 1; const c = [];
      for (let j = 2; j < t.nz - 1; j += 2) for (let i = 2; i < t.nx - 1; i += 2) { const k = j * W1 + i; if (t.hol[k] > 0.5 && !t.pad[k]) c.push([t.hol[k], i * t.sx, j * t.sz]); }
      c.sort((a, b) => b[0] - a[0]); for (const [, x, z] of c) { if (out.length >= 10) break; if (out.some(q => Math.hypot(q[0] - x, q[2] - z) < 9)) continue; if (JT.Nav && !JT.Nav.inside(hab, x, z, 4)) continue; const b = JT.Nav.supportBelow(hab, [x, 0.2, z]); if (b.sup.k !== 'floor') continue; out.push([x, 0, z]); } }
    t.pools = out; return out;
  };
  // ---------- runtime marks: footprints and burrow mounds (not saved) ----------
  T.PRINT_LIFE = 45; T.MARK_LIFE = 150;
  T.track = function (hab) {
    const sub = hab.data.substrate; const pk = T.PRINT[sub] || 0; const now = hab.time; const P = hab._prints || (hab._prints = []); const MK = hab._marks || (hab._marks = []);
    if (P.length && now - P[0].t > T.PRINT_LIFE) { let n = 0; while (n < P.length && now - P[n].t > T.PRINT_LIFE) n++; P.splice(0, n); }
    if (MK.length && now - MK[0].t > T.MARK_LIFE) { let n = 0; while (n < MK.length && now - MK[n].t > T.MARK_LIFE) n++; MK.splice(0, n); }
    const step = (e, L, kind) => { if (!e.sup || e.sup.k !== 'floor' || e._air || e.owner || e.buried || !M.finite3(e.pos)) { e._pr = null; return; }
      const q = e._pr; const stride = Math.max(0.9, L * 0.55); if (q && Math.abs(q[0] - e.pos[0]) + Math.abs(q[1] - e.pos[2]) < stride) return;
      const dir = q ? Math.atan2(e.pos[2] - q[1], e.pos[0] - q[0]) : Math.atan2((e.fwd || [1, 0, 0])[2], (e.fwd || [1, 0, 0])[0]);
      e._pr = [e.pos[0], e.pos[2]]; if (!q || !pk) return; e._ps = !e._ps; P.push({ x: e.pos[0], z: e.pos[2], a: dir, t: now, s: L, k: kind, side: e._ps ? 1 : -1 }); if (P.length > 260) P.shift(); };
    for (const sp of hab.data.spiders) step(sp, JT.SpiderAI ? JT.SpiderAI.len(sp) : 6, 'spider');
    if (!((T.WET[sub] || 0) >= 0.4) && hab.data.drops.some(d => d.pool)) hab.data.drops = hab.data.drops.filter(d => !d.pool); // pools soak away on dry ground
    const bur = T.BURROW(sub);
    for (const p of hab.data.prey) { const d = JT.PREY_BY_ID[p.type]; if (!d) continue;
      if (bur && !!p.buried !== !!p._wasBur && M.finite3(p.pos)) { MK.push({ x: p.pos[0], z: p.pos[2], t: now, r: Math.max(1, (d.len || 3) * 0.45), out: !p.buried }); if (MK.length > 60) MK.shift(); }
      p._wasBur = !!p.buried; if (!d.fly && !d.flies && (d.len || 3) >= 2.5) step(p, d.len || 3, 'prey'); }
  };
  // ---------- hooks into the habitat model ----------
  const HP = JT.Habitat && JT.Habitat.prototype;
  if (HP && !HP._terHook) { HP._terHook = true;
    const up = HP.update; HP.update = function (dt) { const r = up.apply(this, arguments); try { T.track(this); } catch (e) { /* cosmetic */ } return r; };
    const mi = HP.mist; HP.mist = function () { const r = mi.apply(this, arguments); try { T.addPools(this); } catch (e) { /* cosmetic */ } return r; };
  }
  /** Misting a wet substrate: water runs into the hollows and pools there; thirsty jumpers drink from them. */
  T.addPools = function (hab) {
    const sp = T.poolSpots(hab); if (!sp.length) return 0; const n = Math.min(sp.length, 2 + Math.floor(JT.R() * 3)); let k = 0; const D = hab.data.drops;
    for (let i = 0; i < sp.length && k < n; i++) { const q = sp[(i + Math.floor(JT.R() * sp.length)) % sp.length]; if (D.some(d => d.pool && Math.hypot(d.pos[0] - q[0], d.pos[2] - q[2]) < 6)) continue;
      D.push({ id: JT.newId('w'), pos: q.slice(), sup: { k: 'floor' }, decor: null, life: 240 + JT.R() * 160, r: 2.4 + JT.R() * 1.4, pool: true }); k++; }
    while (D.length > 34) { const j = D.findIndex(d => !d.pool); D.splice(j >= 0 ? j : 0, 1); }
    return k;
  };
})(typeof window !== 'undefined' ? window : globalThis);