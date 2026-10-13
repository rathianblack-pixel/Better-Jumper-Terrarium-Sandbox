/* Jumper Terrarium — procedural decor geometry.
   ONE generator per archetype produces BOTH the render primitives and the physical
   navigation surfaces (tops, faces, plant paths), so visible geometry and navigation agree.
   Local coordinates: x right, y up, z depth. Rotation (k * 90deg) and stacking height are
   applied by a single transform, so rotated/stacked objects move render + nav together. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, G = JT.G;
  const Geo = JT.Geo = {};

  function Builder(rng) {
    this.rng = rng; this.prims = []; this.paths = []; this.tops = []; this.solids = [];
    this.water = []; this.flowers = []; this.contacts = []; this.coverR = 10; this.height = 5;
  }
  Builder.prototype.path = function (pts, r, kind, o) {
    o = o || {};
    this.paths.push({ pts, r, kind, flex: o.flex != null ? o.flex : 0.4, side: o.side || null, nrm: o.nrm || null,
      perch: o.perch !== false, startTop: o.startTop, endTop: o.endTop, flower: o.flower || false });
    return this.paths.length - 1;
  };
  Builder.prototype.prim = function (p) { this.prims.push(p); return p; };
  Builder.prototype.top = function (poly, y) { this.tops.push({ poly, y }); return this.tops.length - 1; };

  // ---- helpers (local space) ----
  function bez(a, b, c, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1], u * u * a[2] + 2 * u * t * b[2] + t * t * c[2]]); } return out; }
  function cubic(a, b, c, d, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([0, 1, 2].map(k => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k])); } return out; }
  function rockPoly(rng, w, d, n, jit) {
    const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rng() * 0.25; const j = 1 - jit * rng(); pts.push([Math.cos(a) * w / 2 * j, Math.sin(a) * d / 2 * j]); }
    return G.hull(pts);
  }
  function rectPoly(w, d, cut) { const c = cut || 0; return [[-w / 2 + c, -d / 2], [w / 2 - c, -d / 2], [w / 2, -d / 2 + c], [w / 2, d / 2 - c], [w / 2 - c, d / 2], [-w / 2 + c, d / 2], [-w / 2, d / 2 - c], [-w / 2, -d / 2 + c]]; }

  // Climbable faces: vertical-ish paths from the base up to a top region, derived from the same polygon as the prism.
  function addFaces(B, base, topPoly, y0, y1, topIdx, count, startTop) {
    const n = base.length, used = new Set();
    const cnt = Math.min(count, n);
    for (let k = 0; k < cnt; k++) {
      const i = Math.floor((k + 0.5) * n / cnt) % n; if (used.has(i)) continue; used.add(i);
      const j = (i + 1) % n;
      const bx = (base[i][0] + base[j][0]) / 2, bz = (base[i][1] + base[j][1]) / 2;
      // matching top point = closest top vertex midpoint in same direction
      const ang = Math.atan2(bz, bx); let best = null, bd = 1e9;
      for (let q = 0; q < topPoly.length; q++) { const r = (q + 1) % topPoly.length; const mx = (topPoly[q][0] + topPoly[r][0]) / 2, mz = (topPoly[q][1] + topPoly[r][1]) / 2; const da = Math.abs(M.wrapAngle(Math.atan2(mz, mx) - ang)); if (da < bd) { bd = da; best = [mx, mz]; } }
      const ex = bx, ez = bz; const ol = Math.hypot(ex, ez) || 1; const ox = ex / ol, oz = ez / ol;
      const tx = best[0] * 0.9, tz = best[1] * 0.9;
      const pts = [];
      const steps = Math.max(2, Math.round((y1 - y0) / 7));
      pts.push([bx + ox * 1.6, y0, bz + oz * 1.6]);
      for (let s = 1; s < steps; s++) { const t = s / steps; pts.push([M.lerp(bx, best[0], t) + ox * 0.6, M.lerp(y0, y1, t), M.lerp(bz, best[1], t) + oz * 0.6]); }
      pts.push([best[0] + ox * 0.3, y1, best[1] + oz * 0.3]);
      pts.push([tx, y1, tz]);
      const nrm = []; for (let s = 0; s < pts.length - 1; s++) nrm.push(s >= pts.length - 2 ? [0, 1, 0] : [ox, 0, oz]);
      B.path(pts, 0.2, 'face', { flex: 0, nrm, endTop: topIdx, startTop: startTop, perch: false });
    }
  }

  const ARCH = {};
  ARCH.rock = function (B, p, sc) {
    const rng = B.rng, layers = p.layers || 1, h = p.h * sc;
    const base = p.round ? rockPoly(rng, p.w, p.d, 14, 0.06) : (p.style === 'cork' || p.style === 'wood' ? rockPoly(rng, p.w, p.d, 8, 0.08) : rockPoly(rng, p.w, p.d, 9, 0.14));
    let poly = base, y = 0;
    for (let i = 0; i < layers; i++) {
      const y1 = h * (i + 1) / layers;
      B.prim({ t: 'prism', poly, y0: y, y1, style: p.style, layer: i, round: !!p.round, ledge: p.ledge && i === layers - 1 });
      if (i < layers - 1) { const ox = (rng() - 0.5) * p.w * 0.06, oz = (rng() - 0.5) * p.d * 0.06; poly = G.hull(G.scalePoly(poly, 0.9 - rng() * 0.05).map(q => [q[0] + ox, q[1] + oz])); }
      y = y1;
    }
    B.solids.push(base);
    const ti = B.top(poly, h);
    addFaces(B, base, poly, 0, h, ti, h > 30 ? 5 : 4);
    if (p.dew) for (let i = 0; i < 3; i++) B.water.push({ local: [(rng() - 0.5) * p.w * 0.4, h, (rng() - 0.5) * p.d * 0.4], top: ti });
    B.height = h; B.coverR = Math.max(p.w, p.d) * 0.6;
  };
  ARCH.slab = function (B, p, sc) {
    const base = rectPoly(p.w, p.d, p.d * 0.3).map(q => [q[0] + (B.rng() - 0.5) * 2, q[1] + (B.rng() - 0.5) * 2]);
    B.prim({ t: 'prism', poly: base, y0: 0, y1: p.h, style: p.style, curved: true });
    B.solids.push(base); const ti = B.top(G.scalePoly(base, 0.96), p.h);
    addFaces(B, base, G.scalePoly(base, 0.96), 0, p.h, ti, 4);
    B.height = p.h; B.coverR = p.w * 0.6;
  };
  ARCH.tower = function (B, p, sc) {
    const h = Math.max(8, p.h * sc);
    const base = rockPoly(B.rng, p.r * 2, p.r * 2, 11, 0.1);
    const top = G.scalePoly(base, p.taper || 0.92);
    B.prim({ t: 'prism', poly: base, topPoly: top, y0: 0, y1: h, style: p.style });
    B.solids.push(base); const ti = B.top(top, h);
    addFaces(B, base, top, 0, h, ti, 4);
    B.height = h; B.coverR = p.r * 1.6;
  };
  ARCH.hide = function (B, p, sc) {
    const base = p.dome ? rockPoly(B.rng, p.w, p.d, 12, 0.04) : rectPoly(p.w, p.d, Math.min(p.w, p.d) * 0.12);
    const top = G.scalePoly(base, p.dome ? 0.55 : 0.94);
    B.prim({ t: 'prism', poly: base, topPoly: top, y0: 0, y1: p.h, style: p.style, door: true, dome: !!p.dome });
    B.solids.push(base); const ti = B.top(top, p.h);
    addFaces(B, base, top, 0, p.h, ti, 4);
    B.height = p.h; B.coverR = Math.max(p.w, p.d) * 0.7;
  };
  ARCH.dish = function (B, p) {
    const base = G.circlePoly(0, 0, p.r, p.r, 14);
    B.prim({ t: 'prism', poly: base, topPoly: G.scalePoly(base, 0.96), y0: 0, y1: p.h, style: 'dish' });
    B.solids.push(base); const ti = B.top(G.scalePoly(base, 0.8), p.h);
    addFaces(B, base, G.scalePoly(base, 0.8), 0, p.h, ti, 3);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; B.water.push({ local: [Math.cos(a) * p.r * 0.55, p.h, Math.sin(a) * p.r * 0.55], top: ti, permanent: true }); }
    B.height = p.h; B.coverR = p.r;
  };
  /** Basking lamp: weighted foot, brass pole and arm, a small dome shade that throws a warm pool of light below. */
  ARCH.lamp = function (B, p, sc) {
    const H = Math.max(22, p.h * sc), R = p.reach;
    const foot = G.circlePoly(0, 0, 4.2, 4.2, 12); B.solids.push(foot);
    B.prim({ t: 'lampfoot', o: [0, 0, 0], r: 4.2 });
    B.prim({ t: 'tube', pts: [[0, 0.8, 0], [0, H * 0.5, 0], [0, H, 0]], r0: 0.55, r1: 0.5, col: '#8c7650', style: 'rod' });
    B.prim({ t: 'tube', pts: bez([0, H, 0], [R * 0.45, H + 4, 0], [R, H + 1, 0], 6), r0: 0.45, r1: 0.42, col: '#8c7650', style: 'rod' });
    B.prim({ t: 'lamp', o: [R, H - 1.5, 0], r: 4.6 });
    B.lampLocal = [R, H - 3, 0]; B.height = H + 4; B.coverR = 6;
  };
  ARCH.log = function (B, p) {
    const L = p.L, r = p.r, half = !!p.half;
    const hh = half ? r : r * 2;
    const base = rectPoly(L, r * 1.9, r * 0.4);
    B.prim({ t: 'log', a: [-L / 2, r * (half ? 0.0 : 1), 0], b: [L / 2, r * (half ? 0.0 : 1), 0], r, style: p.style, hollow: p.hollow, half });
    B.solids.push(base);
    const topPoly = rectPoly(L * 0.86, r * 0.7, 0);
    const ti = B.top(topPoly.map(q => [q[0], q[1]]), hh * 0.98);
    // faces curve over the cylinder (front & back, two positions each)
    for (const side of [-1, 1]) for (const fx of [-0.25, 0.25]) {
      const pts = []; const cx = fx * L;
      for (let i = 0; i <= 5; i++) { const a = i / 5 * Math.PI * 0.5; const zz = side * (Math.cos(a) * r * 1.0 + 0.8), yy = half ? Math.sin(a) * r : r + Math.sin(a) * r - (i === 0 ? r : 0) * 0; pts.push([cx, i === 0 ? 0 : (half ? Math.sin(a) * r : r * (1 + Math.sin(a) * 0.98) - (1 - Math.sin(a)) * 0), zz]); }
      pts[0] = [cx, 0, side * (r + 1.6)];
      pts.push([cx, hh * 0.98, side * r * 0.2]);
      const nrm = []; for (let i = 0; i < pts.length - 1; i++) { const a = (i + 0.5) / 5 * Math.PI * 0.5; nrm.push(i >= 5 ? [0, 1, 0] : [0, Math.sin(a), side * Math.cos(a)]); }
      B.path(pts, 0.2, 'face', { flex: 0, nrm, endTop: ti, perch: false });
    }
    B.height = hh; B.coverR = L * 0.55;
  };
  ARCH.ruin = function (B, p) {
    const w = p.w, d = p.d, h = p.h;
    const A = [[-w / 2, -d / 2], [w * 0.08, -d / 2], [w * 0.08, d / 2], [-w / 2, d / 2]];
    const Bp = [[w * 0.08, -d * 0.4], [w / 2, -d * 0.4], [w / 2, d * 0.4], [w * 0.08, d * 0.4]];
    const ha = h * 0.42;
    B.prim({ t: 'prism', poly: A, y0: 0, y1: ha, style: 'ruin' });
    B.prim({ t: 'prism', poly: Bp, y0: 0, y1: h, style: 'ruin' });
    B.solids.push(A, Bp);
    const ta = B.top(G.scalePoly(A, 0.94), ha), tb = B.top(G.scalePoly(Bp, 0.92), h);
    addFaces(B, A, G.scalePoly(A, 0.94), 0, ha, ta, 3);
    addFaces(B, Bp, G.scalePoly(Bp, 0.92), 0, h, tb, 3);
    // face from lower block top up the tall block's side
    const pts = [[w * 0.0, ha, 0], [w * 0.06, ha, 0]]; for (let i = 1; i <= 4; i++) pts.push([w * 0.075, ha + (h - ha) * i / 4, 0]); pts.push([w * 0.16, h, 0]);
    const nrm = pts.slice(1).map((q, i) => i === 0 || i === pts.length - 2 ? [0, 1, 0] : [-1, 0, 0]);
    B.path(pts, 0.2, 'face', { flex: 0, nrm, startTop: ta, endTop: tb, perch: false });
    B.height = h; B.coverR = w * 0.6;
  };

  // ---- themed back walls: living, climbable backdrops for tall (portrait) habitats ----
  // Each style: surface texture (draw-decor STY/makeTex), front-face shape, integrated ledges on the climbing
  // routes, and wall-mounted living details on both faces.
  const WALLS = {
    mosswall:  { bulge: 0, jit: 0, ledges: 2, ledgeStyle: 'cork' },
    barkwall:  { bulge: 2.5, jit: 1.2, ledges: 2, ledgeStyle: 'cork' },
    stonewall: { bulge: 1, jit: 1.4, ledges: 3, ledgeStyle: 'slate' },
    leafwall:  { bulge: 1.5, jit: 0.8, ledges: 1, ledgeStyle: 'wood' },
    trunkwall: { bulge: 6, jit: 0.4, ledges: 2, ledgeStyle: 'fungus' },
    rootwall:  { bulge: 2, jit: 1.6, ledges: 2, ledgeStyle: 'wood' },
    sandwall:  { bulge: 0.8, jit: 0.6, ledges: 3, ledgeStyle: 'sand' },
    driftwall: { bulge: 1.2, jit: 1, ledges: 2, ledgeStyle: 'drift' },
  };
  JT.WALL_STYLES = Object.keys(WALLS);
  function halfDisc(x, zf, lw, dp, n, rng, jit) {
    const pts = [[x + lw / 2, zf + 1.4], [x - lw / 2, zf + 1.4]];
    for (let i = 0; i <= n; i++) { const a = Math.PI - i / n * Math.PI, j = 1 - (jit || 0) * rng(); pts.push([x + Math.cos(a) * lw / 2 * (i === 0 || i === n ? 1 : j), zf - Math.sin(a) * dp * j]); }
    return G.hull(pts);
  }
  ARCH.backwall = function (B, p, sc) {
    const rng = B.rng, h = Math.max(20, p.h * sc), w = p.w, d = p.d, AF = Math.max(1, Math.sqrt((w * h) / (92 * 140))), c = d * 0.45, S = p.style || 'mosswall', cfg = WALLS[S] || WALLS.mosswall;
    // front face (local -z) as a gently irregular / convex polyline so bark, trunks and stone read as real material
    const N = cfg.bulge || cfg.jit ? 8 : 1;
    // square ends flush with the tank sides; in the round jar the ends follow the glass (half-width at a local depth zl)
    const hwAt = (zl) => p.arc ? Math.max(4, Math.sqrt(Math.max(0, p.arc.R * p.arc.R - (zl - p.arc.cz) ** 2)) - 0.6) : w / 2;
    const x1 = hwAt(-d / 2), x0 = -x1;
    const jz = []; for (let i = 0; i <= N; i++) jz.push(i === 0 || i === N ? 0 : (rng() - 0.5) * cfg.jit);
    const zAt = (x) => { const u = M.clamp((x - x0) / (x1 - x0), 0, 1); const k = Math.min(N - 1, Math.floor(u * N)), t = u * N - k; const q = 2 * u - 1; return -d / 2 - cfg.bulge * (1 - q * q) + M.lerp(jz[k], jz[k + 1], t); };
    const base = [];
    for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N; base.push([x, zAt(x)]); }
    base.push([hwAt(0), 0]);
    base.push([hwAt(d / 2), d / 2], [-hwAt(d / 2), d / 2]);
    base.push([-hwAt(0), 0]);
    const top = base.map(q => q.slice()); // vertical sides: the ends stay flush all the way up
    B.prim({ t: 'prism', poly: base, topPoly: top, y0: 0, y1: h, style: S, cols: p.cols });
    B.solids.push(base); const ti = B.top(top, h);
    B.front = base.slice(0, N + 1).map(q => [q[0], q[1] - 0.6]); // used to snap wall-mounted pieces
    // climbing routes up the front face, broken by integrated ledges the jumper can stop and perch on
    const nR = Math.max(3, Math.round(w / 34)); const routes = []; for (let i = 0; i < nR; i++) routes.push(M.clamp((i / (nR - 1) - 0.5) * 0.66 * w * (nR > 3 ? 1.36 : 1) + (rng() - 0.5) * 6, -(x1 - 12), x1 - 12)); // ledges (up to 19 wide) stay on the face
    const ledgeAt = {}; // route index -> [heights]
    const nL = Math.round(cfg.ledges * nR / 3 * Math.min(1.6, Math.max(1, h / 140))); for (let k = 0; k < nL; k++) { const r = (k * 2 + Math.floor(k / nR)) % nR; const kk = Math.floor(k / nR) % 3; (ledgeAt[r] = ledgeAt[r] || []).push(h * (kk === 0 ? 0.38 + (r % 2) * 0.1 : kk === 1 ? 0.6 : 0.78) + (rng() - 0.5) * 8); }
    routes.forEach((x, r) => {
      const zf = zAt(x); const hs = (ledgeAt[r] || []).sort((a, b) => a - b);
      let y = 0, start = null;
      for (const yl of hs.concat([h])) {
        const crest = yl === h; let topIdx, dp = 0;
        if (!crest) {
          const lw = 10 + rng() * 4; dp = 4.5 + rng() * 1.8; const th = 2.4 + rng() * 0.8;
          const poly = halfDisc(x, zf, lw, dp, 8, rng, 0.08);
          B.prim({ t: 'prism', poly, topPoly: G.scalePoly(poly, 0.94), y0: yl - th, y1: yl, style: S, cols: p.cols, ws: [0, 0, -1] });
          topIdx = B.top(G.scalePoly(poly, 0.88), yl);
        } else topIdx = ti;
        const pts = start ? [start] : [[x, 0, zf - 1.6]]; const nrm = [];
        const y0 = start ? y + 2 : 0; const steps = Math.max(2, Math.round((yl - y0) / 8));
        if (start) { pts.push([x, y + 2, zf - 0.7]); nrm.push([0, 0, -1]); }
        for (let k = 1; k < steps; k++) { pts.push([x + Math.sin((y0 + (yl - y0) * k / steps) * 0.16) * 2.5, y0 + (yl - y0) * k / steps, zf - 0.7]); nrm.push([0, 0, -1]); }
        if (crest) { pts.push([x, h, zf * 0.6]); nrm.push([0, 0, -1]); pts.push([x * 0.95, h, 0]); nrm.push([0, 1, 0]); }
        else { pts.push([x, yl - 3.5, zf - 0.7]); nrm.push([0, 0, -1]); pts.push([x, yl, zf - dp * 0.45]); nrm.push([0, 1, 0]); }
        B.path(pts, 0.2, 'face', { flex: 0, nrm, endTop: topIdx, startTop: start ? start.top : undefined, perch: false });
        if (!crest) { start = [x + 1.5, yl, zf - dp * 0.3]; start.top = topIdx; y = yl; }
      }
    });
    // plain face: the texture comes from the material; dressing is the player's (free wall decorations)
    const p0 = B.prims.length;
    // keep every tuft, shelf, leaf and root inside the wall's left / right edges (slide inward along the face)
    const lim = x1 - 0.5;
    for (let i = p0; i < B.prims.length; i++) { const q = B.prims[i]; let lo, hi;
      if (q.t === 'tube' && q.pts) { const r = q.r0 || 1; lo = Math.min(...q.pts.map(v => v[0])) - r; hi = Math.max(...q.pts.map(v => v[0])) + r; }
      else if (q.o && q.t === 'leaf' && q.a) { const bx = Math.abs((q.b || [0])[0]); lo = q.o[0] + Math.min(0, q.a[0]) - bx; hi = q.o[0] + Math.max(0, q.a[0]) + bx; }
      else if (q.o) { const r = q.r || 2; lo = q.o[0] - r; hi = q.o[0] + r; } else continue;
      if (hi - lo > 2 * lim) continue; const dx = lo < -lim ? -lim - lo : hi > lim ? lim - hi : 0; if (!dx) continue;
      if (q.t === 'tube' && q.pts) q.pts = q.pts.map(v => [v[0] + dx, v[1], v[2] + (v[2] < 0 ? zAt(v[0] + dx) - zAt(v[0]) : 0)]);
      else { const ox = q.o[0]; q.o = [ox + dx, q.o[1], q.o[2] + (q.o[2] < 0 && q.o[1] < h ? zAt(ox + dx) - zAt(ox) : 0)]; }
    }
    B.height = h + 4; B.coverR = w * 0.45;
  };

  // ---- wall-mounted pieces: snap onto a back wall's face (local -z points out from the wall) ----
  /** Grow another archetype (a small plant, mushrooms...) into this builder, shifted by off: used for wall pockets and tips. */
  function embed(B, arche, p, off) {
    const S = new Builder(B.rng); S.inst = B.inst; ARCH[arche](S, p, 1);
    const np = B.paths.length, nt = B.tops.length, T3 = (v) => [v[0] + off[0], v[1] + off[1], v[2] + off[2]], T2 = (v) => [v[0] + off[0], v[1] + off[2]];
    for (const q of S.prims) {
      if (q.o) q.o = T3(q.o); if (q.pts) q.pts = q.pts.map(T3); if (q.poly) q.poly = q.poly.map(T2); if (q.topPoly) q.topPoly = q.topPoly.map(T2);
      if (q.y0 != null) q.y0 += off[1]; if (q.y1 != null) q.y1 += off[1]; if (q.h != null) q.h += off[1]; if (q.t === 'log') { q.a = T3(q.a); q.b = T3(q.b); }
      B.prims.push(q);
    }
    for (const t of S.tops) B.tops.push({ poly: t.poly.map(T2), y: t.y + off[1] });
    for (const pa of S.paths) B.paths.push(Object.assign({}, pa, { pts: pa.pts.map(T3), startTop: pa.startTop != null ? pa.startTop + nt : undefined, endTop: pa.endTop != null ? pa.endTop + nt : undefined }));
    for (const w of S.water) B.water.push(Object.assign({}, w, { local: T3(w.local), top: w.top != null ? w.top + nt : undefined, path: w.path != null ? w.path + np : undefined }));
    for (const f of S.flowers) B.flowers.push({ local: T3(f.local), path: f.path + np });
  }
  ARCH.wallmount = function (B, p) {
    const rng = B.rng, y = (B.inst && B.inst.my) || 40, K = p.kind;
    const shelf = (x, z0, yl, lw, dp, th, style, jit) => { const poly = halfDisc(x, z0, lw, dp, 8, rng, jit); B.prim({ t: 'prism', poly, topPoly: G.scalePoly(poly, 0.94), y0: yl - th, y1: yl, style }); return { poly, ti: B.top(G.scalePoly(poly, 0.88), yl) }; };
    if (K === 'shelf') {
      const s1 = shelf(0, 0, y, p.w, p.d, p.th || 3.5, p.style, p.style === 'slate' ? 0.2 : 0.08);
      B.prim({ t: 'prism', poly: G.scalePoly(s1.poly, 0.62), y0: y - (p.th || 3.5) - 3, y1: y - (p.th || 3.5) + 0.2, style: p.style }); // bracket beneath
      if (p.moss) for (let k = 0; k < 4; k++) B.prim({ t: 'tuft', o: [(rng() - 0.5) * p.w * 0.7, y + 0.4, -p.d * (0.15 + rng() * 0.5)], r: 1.6 + rng() * 1.6, col: ['#5f8f2e', '#79a83a'][k % 2], nv: [0, 1, 0], seed: (rng() * 1e6) | 0, h: y });
    } else if (K === 'fungi') {
      const k = p.s || 1, spots = [[0, 0, 13, 7.5], [-7, -8, 10, 6], [6, -15, 8, 5]].slice(0, p.n || 3).map(q => q.map(v => v * k)); let prev = null;
      for (const [dx, dy, lw, dp] of spots) {
        const poly = halfDisc(dx, 0, lw, dp, 8, rng, 0.1); B.prim({ t: 'prism', poly, topPoly: G.scalePoly(poly, 0.94), y0: y + dy - 2, y1: y + dy, style: 'fungus', cols: p.fcols });
        const s1 = { poly, ti: B.top(G.scalePoly(poly, 0.88), y + dy) };
        B.prim({ t: 'prism', poly: G.scalePoly(s1.poly, 0.66), y0: y + dy - 3.4, y1: y + dy - 1.9, style: 'fungus', cols: p.fcols });
        if (prev) { // short climb on the wall between neighbouring brackets
          const a = [dx, y + dy, -dp * 0.35], b = [prev.x, prev.y, -prev.dp * 0.35];
          B.path([a, [dx * 0.6 + prev.x * 0.4, y + dy + 1.6, -0.6], [prev.x * 0.6 + dx * 0.4, prev.y - 3.5, -0.6], b], 0.2, 'face', { flex: 0, nrm: [[0, 0, -1], [0, 0, -1], [0, 1, 0]], startTop: s1.ti, endTop: prev.ti, perch: false });
        }
        prev = { x: dx, y: y + dy, dp, ti: s1.ti };
      }
    } else if (K === 'planter') {
      const poly = halfDisc(0, 0, 15, 9, 8, rng, 0.04); const th = 9;
      B.prim({ t: 'prism', poly: G.scalePoly(poly, 0.8), topPoly: poly, y0: y - th, y1: y, style: 'coir' });
      const ti = B.top(G.scalePoly(poly, 0.85), y);
      for (let j = 0; j < 9; j++) leaf(B, [(rng() - 0.5) * 6, y + 0.5, -3 - rng() * 2], -Math.PI / 2 + (j - 4) * 0.42, 5 + rng() * 2.5, 3, shade('#4f8a30', (rng() - .5) * .2), null, 'heart', 0.15 + rng() * 0.5, y, { variegate: '#d8d070' });
      // trailing vines down the wall: climbable from below straight up into the pocket
      for (let v = 0; v < 3; v++) {
        const x = (v - 1) * 5 + (rng() - 0.5) * 2, len = 28 + rng() * 36; const yb = Math.max(0.5, y - th - len);
        const pts = []; const n = Math.max(3, Math.round((y - yb) / 5));
        for (let k = 0; k <= n; k++) { const t = k / n; pts.push([x + Math.sin(t * 5 + v) * 1.6 * (1 - t), M.lerp(yb, y - 1, t), k === n ? -4.5 : -0.9 - (1 - t) * 0.4]); }
        const nrm = pts.slice(1).map((_, k) => k === n - 1 ? [0, 1, 0] : [0, 0, -1]);
        B.path(pts, 0.25, 'face', { flex: 0, nrm, endTop: ti, perch: false });
        B.prim({ t: 'tube', pts: pts.slice(0, n), r0: 0.35, r1: 0.5, col: '#4a6a2a', style: 'stem', nv: [0, 0, -1] });
        for (let k = 0; k < n - 1; k += 1) { const q = pts[k]; leaf(B, [q[0], q[1], q[2] - 0.3], -Math.PI / 2 + (k % 2 ? 0.9 : -0.9), 3 + rng() * 1.5, 2, shade('#4f8a30', (rng() - .5) * .25), null, 'heart', -0.6, q[1], { nv: [0, 0, -1], variegate: k % 3 ? null : '#d8d070' }); }
      }
    } else if (K === 'pocket') { // a small coir pocket with a plant growing out of it
      const pw = p.pw || 13, dp = pw * 0.6, th = 7; const poly = halfDisc(0, 0, pw, dp, 8, rng, 0.04);
      B.prim({ t: 'prism', poly: G.scalePoly(poly, 0.8), topPoly: poly, y0: y - th, y1: y, style: 'coir' });
      B.top(G.scalePoly(poly, 0.8), y);
      embed(B, p.plant.arche, p.plant.p, [0, y - 0.6, -dp * 0.45]);
    } else if (K === 'stick') { // a branch stub out of the wall, or (run) a branch arching along it
      const r = p.r || 1.6, col = p.col || '#6a4e34', st = p.style || 'bark'; let pts;
      if (p.run) pts = bez([-p.run / 2, y - (p.drop || 0), 0.4], [0, y + (p.up || 3), -(p.L || 7)], [p.run / 2, y, 0.4], 10);
      else pts = bez([0, y, 0.6], [(p.lean || 0) * p.L * 0.2, y + (p.up || 0) * 0.35, -p.L * 0.55], [(p.lean || 0) * p.L * 0.4, y + (p.up || 0), -p.L], 6);
      B.prim({ t: 'tube', pts, r0: r, r1: r * (p.run ? 0.8 : 0.55), col, style: st }); B.path(pts, r, 'branch', { flex: 0.04 });
      if (p.fork) { const s0 = pts[Math.floor(pts.length / 2)], f = bez(s0, [s0[0] + 2.5, s0[1] + 5, s0[2] - 1.5], [s0[0] + 4, s0[1] + 9, s0[2] - 2.5], 3); B.prim({ t: 'tube', pts: f, r0: r * 0.55, r1: r * 0.3, col, style: st }); B.path(f, r * 0.5, 'branch', { flex: 0.1 }); }
      if (p.leaves) for (let k = 2; k < pts.length - 1; k += 2) leaf(B, pts[k], rng() * 6.28, 3.5 + rng() * 2, 2, shade(p.leaves, (rng() - .5) * .2), null, 'oval', 0.4, pts[k][1]);
      if (p.tip) { const e = pts[pts.length - 1]; embed(B, p.tip.arche, p.tip.p, [e[0], e[1] + r * 0.6, e[2]]); }
    } else if (K === 'vine') { // strands hanging down the face: climbable, with leaves (or bare roots)
      const n = p.n || 3;
      for (let v = 0; v < n; v++) {
        const x = (v - (n - 1) / 2) * (p.gap || 3.5) + (rng() - 0.5) * 1.5, len = p.len * (0.65 + rng() * 0.45), m = Math.max(4, Math.round(len / 4)); const pts = [];
        for (let k = 0; k <= m; k++) { const t = k / m; pts.push([x + Math.sin(t * 4 + v * 1.7) * (p.wave || 1.6), y - len * t, -0.8 - Math.sin(t * 3.1) * 0.5]); }
        B.prim({ t: 'tube', pts, r0: p.r || 0.45, r1: (p.r || 0.45) * 0.6, col: p.col || '#4a6a2a', style: p.leaf ? 'stem' : 'bark', nv: [0, 0, -1] });
        B.path(pts.slice().reverse(), 0.3, 'stem', { flex: 0.15, perch: false });
        if (p.leaf) for (let k = 1; k < m; k += p.sparse ? 2 : 1) { const q = pts[k]; leaf(B, [q[0], q[1], q[2] - 0.3], -Math.PI / 2 + (k % 2 ? 0.9 : -0.9), (p.leafL || 3) + rng() * 1.5, (p.leafL || 3) * 0.65, shade(p.leaf, (rng() - .5) * .25), null, p.shape || 'heart', -0.6, q[1], { nv: [0, 0, -1] }); }
      }
      B.prim({ t: 'tuft', o: [0, y + 0.5, -0.9], r: 2.2, col: p.col || '#4a6a2a', nv: [0, 0, -1], seed: (rng() * 1e6) | 0, h: y });
    } else if (K === 'pad') { // flat dressing that hugs the face: moss, lichen, dry leaves, seed pods
      for (let k = 0; k < (p.n || 10); k++) {
        const x = (rng() - 0.5) * p.w, yy = y + (rng() - 0.5) * (p.hgt || p.w * 0.7), col = p.cols[k % p.cols.length];
        if (p.mode === 'leaves') { const ang = rng() * 6.28, L = 3.5 + rng() * 2.5, W = L * 0.55; B.prim({ t: 'leaf', o: [x, yy, -0.5 - rng() * 0.4], a: [Math.cos(ang) * L, Math.sin(ang) * L, -L * 0.12], b: [-Math.sin(ang) * W, Math.cos(ang) * W, 0], col, shape: 'oval', h: yy, nv: [0, 0, -1] }); }
        else B.prim({ t: 'tuft', o: [x, yy, -0.7], r: (p.r || 2.4) * (0.55 + rng() * 0.7), col, nv: [0, 0, -1], seed: (rng() * 1e6) | 0, h: yy });
      }
    } else if (K === 'staghorn') {
      const plaque = [[-7, -2.4], [7, -2.4], [7, 0.8], [-7, 0.8]];
      B.prim({ t: 'prism', poly: plaque, y0: y - 18, y1: y, style: 'cork' });
      const ti = B.top(G.scalePoly(plaque, 0.85), y);
      B.path([[0, y - 18, -3.2], [0.8, y - 12, -3], [-0.6, y - 6, -3], [0, y - 2, -3], [0, y, -0.8]], 0.2, 'face', { flex: 0, nrm: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 1, 0]], endTop: ti, perch: false });
      // shield frond hugging the plaque, antler fronds forking out and down
      B.prim({ t: 'leaf', o: [-6, y - 9, -2.8], a: [12, 0.5, -0.6], b: [0, 6, 0], col: '#7a9a4a', col2: '#a89a5a', shape: 'round', h: y, nv: [0, 0, -1] });
      for (let j = 0; j < 6; j++) { const ang = -Math.PI / 2 + (j - 2.5) * 0.5; const o = [(j - 2.5) * 1.6, y - 8 + (j % 2) * 2, -3.2]; const L = 9 + rng() * 5; leaf(B, o, ang, L, 2.2, shade('#6a9a48', (rng() - .5) * .2), '#9ab878', 'lance', -0.2 - rng() * 0.6, y, {}); const tip = [o[0] + Math.cos(ang) * L * 0.85, o[1] - L * 0.35, o[2] + Math.sin(ang) * L * 0.85]; for (const sdj of [-1, 1]) leaf(B, tip, ang + sdj * 0.5, 4 + rng() * 2, 1.2, shade('#6a9a48', -0.05), null, 'lance', -0.4, y, {}); }
    }
    B.height = 6; B.coverR = 12;
  };

  // ---- branches ----
  ARCH.branch = function (B, p, sc) {
    const rng = B.rng, L = p.L, h = p.h * sc, r = p.r, col = p.col, k = p.kind;
    const tube = (pts, r0, r1, o) => B.prim(Object.assign({ t: 'tube', pts, r0, r1, col, style: 'bark', spots: p.spots || null }, o || {}));
    const P = (pts, rr, o) => B.path(pts, rr, 'branch', Object.assign({ flex: 0.08 }, o || {}));
    if (k === 'perch') {
      const pts = bez([-L / 2, 0, -3], [-L * 0.1, h * 0.75, 4], [L / 2, h, 0], 9); tube(pts, r * 1.2, r * 0.7); P(pts, r);
      const tw = bez(pts[6], [pts[6][0] + 4, pts[6][1] + 10, pts[6][2] + 6], [pts[6][0] + 8, pts[6][1] + 14, pts[6][2] + 8], 3); tube(tw, r * 0.55, r * 0.3); P(tw, r * 0.5);
    } else if (k === 'drift') {
      const pts = cubic([-L / 2, 0, -5], [-L * 0.3, h * 0.9, 0], [L * 0.1, h * 1.05, 4], [L / 2, h * 0.35, 6], 12); tube(pts, r * 1.5, r * 0.9, { style: 'drift' }); P(pts, r * 1.2);
      const s = pts[5]; const br = bez(s, [s[0] - 6, s[1] + 12, s[2] - 6], [s[0] - 12, s[1] + 16, s[2] - 10], 4); tube(br, r * 0.8, r * 0.4, { style: 'drift' }); P(br, r * 0.7);
      pts[pts.length - 1][1] = 0; // tail rests on ground
    } else if (k === 'forked') {
      const tr = bez([0, 0, 0], [1, h * 0.25, 1], [2, h * 0.5, 0], 5); tube(tr, r * 1.4, r * 1.1); P(tr, r * 1.2);
      const j = tr[tr.length - 1];
      const b1 = bez(j, [j[0] - L * 0.2, j[1] + h * 0.3, -3], [-L * 0.42, h, -6], 6); tube(b1, r, r * 0.55); P(b1, r);
      const b2 = bez(j, [j[0] + L * 0.2, j[1] + h * 0.25, 3], [L * 0.42, h * 0.88, 6], 6); tube(b2, r, r * 0.55); P(b2, r);
    } else if (k === 'grape') {
      const mk = (z0, ph) => { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([-L / 2 + L * t, Math.sin(t * Math.PI) * h + Math.sin(t * 9 + ph) * 3, z0 + Math.cos(t * 7 + ph) * 4]); } pts[0][1] = 0; pts[14][1] = 0; return pts; };
      const a = mk(-4, 0), b = mk(4, 2); tube(a, r * 1.3, r); tube(b, r * 1.1, r * 0.8); P(a, r); P(b, r);
    } else if (k === 'arch' || k === 'bridge') {
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([-L / 2 + L * t, Math.sin(t * Math.PI) * h, Math.sin(t * 5) * (k === 'arch' ? 3 : 0)]); }
      if (k === 'bridge') { tube(pts, r, r, { style: 'plank', w: 9 }); P(pts, r, { flex: 0.02 }); }
      else { tube(pts, r * 1.3, r * 1.1); P(pts, r); const pts2 = pts.map(q => [q[0] * 0.9, q[1] * 0.8, q[2] + 6]); tube(pts2, r * 0.8, r * 0.7); P(pts2, r * 0.7); }
    } else if (k === 'canopy') {
      const legL = bez([-L / 2, 0, 0], [-L / 2 + 2, h * 0.5, 2], [-L / 2 + 8, h, 0], 8);
      const span = cubic(legL[8], [-L * 0.15, h + 6, -4], [L * 0.15, h - 2, 4], [L / 2 - 8, h - 6, 0], 10);
      const legR = bez(span[10], [L / 2 - 2, h * 0.45, -2], [L / 2, 0, 0], 8);
      const all = legL.concat(span.slice(1), legR.slice(1));
      tube(all, r * 1.2, r); P(all, r);
      for (const idx of [12, 17, 22]) { const s = all[idx]; const tw = bez(s, [s[0] + 3, s[1] + 8, s[2] + 5], [s[0] + 5, s[1] + 14, s[2] + 7], 3); tube(tw, r * 0.5, r * 0.25); P(tw, r * 0.45); }
    } else if (k === 'vine') {
      const legL = bez([-L / 2, 0, -4], [-L / 2 + 2, h * 0.6, -2], [-L / 2 + 6, h, 0], 7);
      const span = []; for (let i = 1; i <= 12; i++) { const t = i / 12; span.push([M.lerp(-L / 2 + 6, L / 2 - 6, t), h - Math.sin(t * Math.PI) * h * 0.18, Math.sin(t * 6) * 3]); }
      const legR = bez(span[11], [L / 2 - 2, h * 0.5, 2], [L / 2, 0, 4], 7);
      const all = legL.concat(span, legR.slice(1)); tube(all, r * 1.3, r, { style: 'vine' }); P(all, r * 1.2, { flex: 0.25 });
      const twist = all.map((q, i) => [q[0], q[1] + Math.sin(i * 1.3) * 1.6, q[2] + Math.cos(i * 1.3) * 1.6]); tube(twist, r * 0.7, r * 0.5, { style: 'vine' });
      for (let i = 2; i < all.length - 2; i += 2) leaf(B, all[i], rng() * 6.28, 4 + rng() * 2, 2.6, p.leaves || '#5a8a3a', null, 'oval', 0.5, all[i][1]);
    } else if (k === 'beads') {
      // a hanging chain of cork beads strung between two vine stems
      const legL = bez([-L / 2, 0, -3], [-L / 2 + 1, h * 0.55, -1], [-L / 2 + 5, h, 0], 8);
      const span = []; for (let i = 1; i <= 16; i++) { const t = i / 16; span.push([M.lerp(-L / 2 + 5, L / 2 - 5, t), h - Math.sin(t * Math.PI) * h * 0.26 + Math.sin(t * 9) * 1.2, Math.sin(t * 4) * 4]); }
      const legR = bez(span[15], [L / 2 - 1, h * 0.5, 1], [L / 2, 0, 3], 8);
      tube(legL, r * 1.5, r * 1.1); tube(legR, r * 1.1, r * 1.5);
      tube(span, r * 0.7, r * 0.7, { style: 'vine', col: '#5a4026' });
      const all = legL.concat(span, legR.slice(1)); P(all, r * 1.4, { flex: 0.3 });
      for (let i = 1; i < 15; i += 2) { const a = span[i - 1], b = span[i + 1], m = span[i]; const dir = M.norm(M.sub(b, a)); const bl = 1.6 + rng() * 0.8;
        B.prim({ t: 'log', a: M.sub(m, M.mul(dir, bl)), b: M.add(m, M.mul(dir, bl)), r: 2.1 + rng() * 0.6, style: 'cork', bead: true }); }
      for (let i = 2; i < all.length - 2; i += 3) if (rng() < 0.55) leaf(B, all[i], rng() * 6.28, 3.5 + rng() * 2, 2.2, p.leaves || '#5a8a3a', null, 'oval', 0.4, all[i][1]);
    } else if (k === 'mangrove') {
      const tr = bez([0, 0, 0], [2, h * 0.5, -1], [0, h, 0], 9); tube(tr, r * 1.5, r); P(tr, r * 1.2);
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + 0.4; const s = tr[3];
        const rt = bez(s, [Math.cos(a) * L * 0.3, s[1] + 4, Math.sin(a) * L * 0.25], [Math.cos(a) * L * 0.5, 0, Math.sin(a) * L * 0.38], 6);
        tube(rt, r * 0.9, r * 0.7); P(rt, r * 0.8);
      }
      for (let i = 0; i < 3; i++) { const s = tr[7 + (i % 2)]; const a = i * 2.1; const br = bez(s, [s[0] + Math.cos(a) * 10, s[1] + 6, s[2] + Math.sin(a) * 8], [s[0] + Math.cos(a) * 20, s[1] + 10, s[2] + Math.sin(a) * 14], 4); tube(br, r * 0.6, r * 0.35); P(br, r * 0.6); for (let q = 0; q < 6; q++) leaf(B, br[4], rng() * 6.28, 5, 2.6, '#4a7a34', null, 'oval', 0.6, br[4][1]); }
    }
    let mh = 0; for (const pa of B.paths) for (const q of pa.pts) mh = Math.max(mh, q[1]); B.height = mh + 2; B.coverR = L * 0.4;
  };

  // A leaf primitive: base o, direction yaw ang, length L, half-width W, pitch (upward tilt)
  function leaf(B, o, ang, L, W, col, col2, shape, pitch, hgt, o2) {
    const p = pitch || 0; const ca = Math.cos(ang), sa = Math.sin(ang);
    const a = [ca * Math.cos(p) * L, Math.sin(p) * L, sa * Math.cos(p) * L];
    const roll = (o2 && o2.roll) || 0;
    const b = [-sa * W * Math.cos(roll), W * Math.sin(roll), ca * W * Math.cos(roll)];
    return B.prim(Object.assign({ t: 'leaf', o: o.slice(), a, b, col, col2: col2 || null, shape: shape || 'oval', h: hgt != null ? hgt : o[1] }, o2 || {}));
  }
  Geo._leaf = leaf; Geo.ARCH = ARCH; Geo._bez = bez; Geo._cubic = cubic; // shared with game packs (extra decor shapes)

  // ---- trees ----
  ARCH.tree = function (B, p, sc) {
    const rng = B.rng, h = p.h * sc, r = p.r, spread = p.spread, k = p.kind;
    const bark = k === 'bonsai' ? '#5a4232' : k === 'grand' ? '#4e3a2a' : '#5e4630';
    const tube = (pts, r0, r1) => B.prim({ t: 'tube', pts, r0, r1, col: bark, style: 'bark' });
    const trunkTop = k === 'grand' ? 0.62 : k === 'bonsai' ? 0.7 : 0.66;
    const lean = (rng() - 0.5) * 8;
    let trunk;
    if (k === 'bonsai') trunk = cubic([0, 0, 0], [8, h * 0.3, 2], [-8, h * 0.55, -2], [2, h * trunkTop, 0], 9);
    else trunk = cubic([0, 0, 0], [lean * 0.2, h * 0.25, 0], [lean * 0.8, h * 0.5, 1], [lean, h * trunkTop, 0], k === 'grand' ? 12 : 9);
    tube(trunk, r * 1.25, r * 0.6);
    B.path(trunk, r, 'trunk', { flex: k === 'grand' ? 0.02 : 0.08, perch: false });
    if (k === 'grand') for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + rng(); B.prim({ t: 'tube', pts: bez([Math.cos(a) * r * 2.2, 0, Math.sin(a) * r * 2.2], [Math.cos(a) * r * 0.9, 4, Math.sin(a) * r * 0.9], [0, 10, 0], 4), r0: r * 0.55, r1: r * 0.8, col: bark, style: 'bark' }); }
    if (p.pot) B.prim({ t: 'pot', r: 9, h: 7, col: '#8a4a32' });
    const nb = k === 'grand' ? 7 : k === 'bonsai' ? 4 : 5;
    const ends = [];
    for (let i = 0; i < nb; i++) {
      const idx = Math.min(trunk.length - 1, Math.floor(trunk.length * (0.35 + 0.65 * (i + 1) / nb)));
      const s = trunk[idx]; const a = i * 2.4 + rng() * 0.8;
      const reach = spread * (0.32 + rng() * 0.22) * (k === 'bonsai' ? 1.1 : 1);
      const up = k === 'bonsai' ? 2 + rng() * 3 : (h * (0.12 + rng() * 0.18));
      const end = [s[0] + Math.cos(a) * reach, Math.min(s[1] + up, h - 2), s[2] + Math.sin(a) * reach * 0.75];
      const mid = [s[0] + Math.cos(a) * reach * 0.5, s[1] + up * 0.75, s[2] + Math.sin(a) * reach * 0.38];
      const br = bez(s, mid, end, 5); tube(br, r * 0.6, r * 0.28);
      B.path(br, r * 0.55, 'branch', { flex: 0.25 });
      ends.push(end);
      if (k === 'grand' && i % 2 === 0) { const s2 = br[3]; const e2 = [s2[0] + Math.cos(a + 0.9) * 14, s2[1] + 8, s2[2] + Math.sin(a + 0.9) * 10]; const b2 = bez(s2, [s2[0] + Math.cos(a + 0.9) * 7, s2[1] + 6, s2[2] + Math.sin(a + 0.9) * 5], e2, 3); tube(b2, r * 0.3, r * 0.16); B.path(b2, r * 0.3, 'branch', { flex: 0.35 }); ends.push(e2); }
    }
    ends.push(trunk[trunk.length - 1]);
    // foliage clusters around branch ends (render only; branch ends are the perches). Bare variant: no leaves.
    const leafCol = p.leaf;
    if (!(B.inst && B.inst.bare)) for (const e of ends) {
      const n = k === 'grand' ? 26 : k === 'bonsai' ? 22 : 16;
      const cr = k === 'grand' ? 13 : k === 'bonsai' ? 9 : 9;
      for (let q = 0; q < n; q++) {
        const ang = rng() * 6.28, rr = Math.sqrt(rng()) * cr;
        const o = [e[0] + Math.cos(ang) * rr, e[1] + (rng() - 0.3) * (k === 'bonsai' ? 3 : 7), e[2] + Math.sin(ang) * rr * 0.8];
        leaf(B, o, rng() * 6.28, k === 'ficus' ? 4.5 : 4 + rng() * 2, k === 'ficus' ? 2.4 : 1.9, shade(leafCol, (rng() - 0.5) * 0.25), null, 'oval', (rng() - 0.3) * 0.9, o[1]);
      }
    }
    B.height = h; B.coverR = spread * 0.55;
  };

  // ---- ferns & palms ----
  ARCH.fern = function (B, p, sc) {
    const rng = B.rng;
    for (let i = 0; i < p.n; i++) {
      const a = i / p.n * Math.PI * 2 + rng() * 0.5; const L = p.L * (0.75 + rng() * 0.35), H = p.h * sc * (0.75 + rng() * 0.4);
      const pts = []; for (let s = 0; s <= 7; s++) { const t = s / 7; const hz = L * t; pts.push([Math.cos(a) * hz, 0.4 + Math.sin(t * Math.PI * 0.82) * H, Math.sin(a) * hz * 0.85]); }
      B.prim({ t: 'tube', pts, r0: 0.7, r1: 0.25, col: shade(p.leaf, -0.25), style: 'stem' });
      B.path(pts, 0.6, 'frond', { flex: 0.9 });
      for (let s = 1; s <= 7; s++) {
        const q = pts[s]; const t = s / 7; const lw = (p.fine ? 2.2 : 3.4) * (1.1 - t * 0.6);
        const dir = Math.atan2(pts[s][2] - pts[s - 1][2], pts[s][0] - pts[s - 1][0]);
        for (const sd of [-1, 1]) leaf(B, q, dir + sd * 1.25, lw * (p.fine ? 1.1 : 1.7), lw * (p.fine ? 0.7 : 0.38), shade(p.leaf, (rng() - 0.5) * 0.2), null, p.fine ? 'round' : 'lance', 0.15 - t * 0.6, q[1]);
      }
    }
    B.height = p.h * sc + 3; B.coverR = p.L * 0.9;
  };
  ARCH.palm = function (B, p, sc) {
    const rng = B.rng; let top = [0, 0.4, 0];
    if (p.trunk) { const tr = bez([0, 0, 0], [1, p.trunk * 0.5, 0], [0, p.trunk * sc, 0], 6); B.prim({ t: 'tube', pts: tr, r0: 2.2, r1: 1.6, col: '#7a6040', style: 'palm' }); B.path(tr, 1.8, 'trunk', { flex: 0.15, perch: false }); top = tr[tr.length - 1]; }
    for (let i = 0; i < p.n; i++) {
      const a = i / p.n * 6.28 + rng() * 0.4; const L = p.L * (0.8 + rng() * 0.3);
      const H = p.trunk ? 6 : p.h * sc * (0.7 + rng() * 0.35);
      const pts = []; for (let s = 0; s <= 6; s++) { const t = s / 6; pts.push([top[0] + Math.cos(a) * L * t, top[1] + Math.sin(t * Math.PI * (p.trunk ? 0.7 : 0.55)) * H - (p.trunk ? t * t * 10 : 0), top[2] + Math.sin(a) * L * t * 0.85]); }
      B.prim({ t: 'tube', pts, r0: 0.8, r1: 0.4, col: shade(p.leaf, -0.2), style: 'stem' });
      B.path(pts, 0.7, 'frond', { flex: 0.7 });
      const e = pts[6];
      if (p.fan) { for (let q = -4; q <= 4; q++) leaf(B, e, a + q * 0.22, 10, 1.1, shade(p.leaf, q * 0.02), null, 'lance', 0.4, e[1]); }
      else for (let s = 2; s <= 6; s++) for (const sd of [-1, 1]) leaf(B, pts[s], a + sd * 1.0, 7 - s * 0.5, 0.9, shade(p.leaf, (rng() - .5) * .2), null, 'lance', -0.5, pts[s][1]);
    }
    B.height = (p.trunk ? p.trunk * sc + 8 : p.h * sc) + 4; B.coverR = p.L;
  };
  ARCH.grass = function (B, p, sc) {
    const rng = B.rng; let navCount = 0;
    for (let i = 0; i < p.n; i++) {
      const a = rng() * 6.28, r0 = rng() * 3; const base = [Math.cos(a) * r0, 0, Math.sin(a) * r0 * 0.8];
      const H = p.h * sc * (0.6 + rng() * 0.5), L = p.L * (0.6 + rng() * 0.6);
      const pts = []; for (let s = 0; s <= 6; s++) { const t = s / 6; const out = p.arch ? Math.sin(t * Math.PI * 0.5) * L : t * t * L * 0.5; const y = p.arch ? Math.sin(t * Math.PI * 0.75) * H : t * H; pts.push([base[0] + Math.cos(a) * out, y, base[2] + Math.sin(a) * out * 0.8]); }
      B.prim({ t: 'tube', pts, r0: p.arch ? 1.2 : 0.8, r1: 0.1, col: shade(p.leaf, (rng() - 0.5) * 0.3), style: 'blade', stripe: p.stripe || null });
      if (i % 3 === 0 && navCount < 5) { B.path(pts.slice(0, 6), 0.4, 'blade', { flex: 1 }); navCount++; }
    }
    B.height = p.h * sc; B.coverR = Math.max(10, p.L * 0.8);
  };
  ARCH.rosette = function (B, p, sc) {
    const rng = B.rng; let nav = 0;
    for (let i = 0; i < p.n; i++) {
      const a = i / p.n * 6.28 * (p.n > 8 ? 1.618 : 1) + rng() * 0.3; const L = p.L * (0.75 + rng() * 0.4); const pitch = (p.fat ? 0.35 : 0.8) + rng() * 0.35;
      const tip = [Math.cos(a) * Math.cos(pitch) * L, 0.6 + Math.sin(pitch) * L * (p.h / p.L) * 1.2, Math.sin(a) * Math.cos(pitch) * L * 0.85];
      leaf(B, [0, 0.6, 0], a, L, p.fat ? L * 0.3 : (p.thin ? L * 0.08 : L * 0.16), shade(p.leaf, (rng() - 0.5) * 0.18), p.tip || null, p.fat ? 'fat' : 'lance', pitch * (p.h / p.L) * 1.4, 1, { fat: !!p.fat });
      if (!p.thin && nav < 4 && L > 9 && i % 2 === 0) { const pts = bez([0, 0.6, 0], M.lerp3([0, 0.6, 0], tip, 0.5), tip, 3); B.path(pts, 0.6, 'leaf', { flex: 0.5 }); nav++; }
    }
    if (p.cup) B.water.push({ local: [0, p.h * 0.5, 0], path: 0, permanent: true });
    B.height = p.h + 3; B.coverR = p.L * 0.9;
  };
  ARCH.broadleaf = function (B, p, sc) {
    const rng = B.rng;
    for (let i = 0; i < p.n; i++) {
      const a = i / p.n * 6.28 + rng() * 0.6;
      const H = p.h * sc * (p.trailing ? 0.4 + rng() * 0.6 : 0.65 + rng() * 0.4);
      const reach = p.trailing ? 6 + rng() * 10 : p.droop ? 3 + rng() * 5 : (p.upright ? 2 + rng() * 3 : 4 + rng() * 6);
      const end = [Math.cos(a) * reach, H, Math.sin(a) * reach * 0.8];
      const stem = bez([0, 0, 0], [Math.cos(a) * reach * 0.3, H * 0.7, Math.sin(a) * reach * 0.25], end, 5);
      B.prim({ t: 'tube', pts: stem, r0: 0.7, r1: 0.45, col: shade(p.leaf, -0.15), style: 'stem' });
      const pitch = p.droop ? -0.75 - rng() * 0.45 : p.upright ? 1.05 : (p.roof ? -0.05 : 0.15 - rng() * 0.35);
      const L = p.leafL * (0.8 + rng() * 0.35), W = p.leafW * 0.5 * (0.8 + rng() * 0.3);
      const lf = leaf(B, end, a, L, W, shade(p.leaf, (rng() - .5) * .15), p.leaf2 || null, p.heart ? 'heart' : 'oval', pitch, end[1], { split: !!p.split, stripe: !!p.stripe, vein: p.vein || null, variegate: p.variegate || null });
      // nav: stem continues along the leaf midrib so a spider walks stem -> leaf surface without a jump
      const n = M.norm(M.cross(lf.a, lf.b)); const nn = n[1] < 0 ? M.mul(n, -1) : n;
      const rib = []; for (let s = 1; s <= 4; s++) rib.push(M.add(end, M.add(M.mul(lf.a, s / 4 * 0.85), M.mul(nn, 0.3))));
      const pts = stem.concat(rib);
      const nrm = []; for (let s = 0; s < pts.length - 1; s++) nrm.push(s >= stem.length - 1 ? nn : null);
      B.path(pts, 0.5, 'leaf', { flex: 0.6, nrm });
    }
    B.height = p.h * sc + p.leafL * 0.6; B.coverR = p.leafL * (p.roof ? 1.3 : 1.0);
  };
  ARCH.mushroom = function (B, p, sc) {
    const rng = B.rng;
    for (let i = 0; i < p.n; i++) {
      const a = rng() * 6.28, rr = rng() * 6; const H = p.h * (0.4 + rng() * 0.7);
      const base = [Math.cos(a) * rr, 0, Math.sin(a) * rr];
      const pts = bez(base, [base[0], H * 0.6, base[2]], [base[0] + (rng() - .5) * 2, H, base[2]], 4);
      const capR = p.cap * (0.6 + rng() * 0.6);
      B.prim({ t: 'tube', pts, r0: capR * (p.spots ? 0.22 : 0.32), r1: capR * (p.spots ? 0.18 : 0.24), col: p.stem || '#e8e0c8', style: 'stem' });
      B.prim({ t: 'cap', o: pts[4], r: capR, col: p.col, glow: p.glow, spots: !!p.spots, cone: !!p.spots, h: H });
      pts.push([pts[4][0], H + capR * 0.5, pts[4][2]]);
      B.path(pts, capR * 0.2, 'stem', { flex: 0.05 });
    }
    B.height = p.h * 1.2; B.coverR = 8;
  };
  ARCH.vine = function (B, p, sc) {
    const rng = B.rng, H = p.h * sc;
    if (p.creep) { for (let i = 0; i < 30; i++) { const a = rng() * 6.28, rr = Math.sqrt(rng()) * 12; leaf(B, [Math.cos(a) * rr, 0.6 + rng() * 2.5, Math.sin(a) * rr * 0.8], rng() * 6.28, 3, 2, shade(p.leaf, (rng() - .5) * .2), null, 'heart', 0.2, 1); } }
    const stake = bez([0, 0, 0], [1.5, H * 0.5, 0.5], [0, H, 0], 9);
    B.prim({ t: 'tube', pts: stake, r0: 1.3, r1: 1.0, col: p.creep ? '#6a5040' : '#7a6a4a', style: 'bark' });
    B.path(stake, 1.2, 'stem', { flex: 0.12, perch: true });
    const wrap = []; for (let i = 0; i <= 30; i++) { const t = i / 30; const q = stake[Math.min(9, Math.floor(t * 9))]; wrap.push([q[0] + Math.cos(t * 22) * 1.8, t * H, q[2] + Math.sin(t * 22) * 1.8]); }
    B.prim({ t: 'tube', pts: wrap, r0: 0.6, r1: 0.4, col: shade(p.leaf, -0.3), style: 'vine' });
    for (let i = 2; i < 30; i += 1) { if (rng() < 0.3) continue; const q = wrap[i]; leaf(B, q, i * 1.7, p.ivy ? 5 : 4, p.ivy ? 3 : 2.6, shade(p.leaf, (rng() - .5) * .2), null, p.ivy ? 'ivy' : 'heart', (rng() - .4) * 0.8, q[1]); }
    if (p.ivy) for (let i = 0; i < 12; i++) { const a = rng() * 6.28, rr = 4 + rng() * 10; leaf(B, [Math.cos(a) * rr, 0.5, Math.sin(a) * rr * 0.8], rng() * 6.28, 4.5, 3, shade(p.leaf, (rng() - .5) * .2), null, 'ivy', 0.1, 0.5); }
    B.height = H + 3; B.coverR = 9;
  };
  ARCH.flower = function (B, p, sc) {
    const rng = B.rng;
    if (p.leaves) for (let i = 0; i < 4; i++) leaf(B, [0, 0.5, 0], i * 1.6 + rng(), 12, 3.4, '#3a6a2a', null, 'lance', 0.25, 1);
    else for (let i = 0; i < 6; i++) leaf(B, [0, 0.5, 0], i * 1.05 + rng(), 6, 1.2, p.dried ? '#8a7a5a' : '#4a7a30', null, 'lance', 0.5, 1);
    for (let i = 0; i < p.n; i++) {
      const a = rng() * 6.28, rr = rng() * 4;
      const H = p.h * sc * (0.65 + rng() * 0.45);
      const base = [Math.cos(a) * rr, 0, Math.sin(a) * rr * 0.8];
      const tipOut = p.orchid ? 10 : 3 + rng() * 4;
      const head = [base[0] + Math.cos(a) * tipOut, H, base[2] + Math.sin(a) * tipOut * 0.8];
      const pts = bez(base, [base[0] + Math.cos(a) * tipOut * 0.2, H * (p.orchid ? 1.1 : 0.6), base[2]], head, 6);
      B.prim({ t: 'tube', pts, r0: 0.6, r1: 0.4, col: p.dried ? '#8a6a4a' : '#4a7a30', style: 'stem' });
      B.path(pts, 0.5, 'stem', { flex: 0.8, flower: !p.dried });
      if (p.spike) { for (let s = 0; s < 8; s++) { const t = 0.55 + s * 0.06; const q = pts[Math.min(6, Math.round(t * 6))]; B.prim({ t: 'bloom', o: [q[0], q[1] + s * 0.6, q[2]], r: 1.2, col: shade(p.petal, (rng() - .5) * .2), kind: 'bud', h: q[1] }); } }
      else if (p.orchid) { for (let s = 3; s <= 6; s++) B.prim({ t: 'bloom', o: pts[s], r: 3.4, col: p.petal, col2: p.center, kind: 'orchid', h: pts[s][1], ang: a }); }
      else B.prim({ t: 'bloom', o: head, r: p.cluster ? 3.5 : p.daisy ? 3.6 : 3.2, col: p.petal, col2: p.center, kind: p.cluster ? 'cluster' : p.daisy ? 'daisy' : p.dried ? 'dried' : 'poppy', h: H, ang: a });
      if (!p.dried) B.flowers.push({ local: head, path: B.paths.length - 1 });
    }
    B.height = p.h * sc + 4; B.coverR = 9;
  };
  ARCH.scatter = function (B, p) {
    const rng = B.rng, r = p.r, k = p.kind;
    const rp = () => { const a = rng() * 6.28, rr = Math.sqrt(rng()) * r; return [Math.cos(a) * rr, 0.25, Math.sin(a) * rr * 0.7]; };
    if (k === 'moss' || k === 'lichen' || k === 'clover') {
      const blobs = []; for (let i = 0; i < (k === 'clover' ? 26 : 50); i++) { const q = rp(); blobs.push([q[0], q[2], 1.5 + rng() * 3, (rng() - .5) * .3]); }
      B.prim({ t: 'moss', blobs, col: p.col, kind: k });
    } else if (k === 'pebbles' || k === 'pods' || k === 'cones') {
      for (let i = 0; i < p.n; i++) { const q = rp(); B.prim({ t: 'pebble', o: q, r: k === 'cones' ? 4 : k === 'pods' ? 2.5 : 1.4 + rng() * 2.2, col: shade(p.col, (rng() - .5) * .3), kind: k, ang: rng() * 6.28 }); }
    } else if (k === 'twigs' || k === 'chips') {
      for (let i = 0; i < p.n; i++) { const q = rp(); const a = rng() * 6.28, L = k === 'twigs' ? 8 + rng() * 10 : 3 + rng() * 3; if (k === 'twigs') B.prim({ t: 'tube', pts: [[q[0], 0.6, q[2]], [q[0] + Math.cos(a) * L, 0.6, q[2] + Math.sin(a) * L * 0.7]], r0: 0.6, r1: 0.4, col: shade(p.col, (rng() - .5) * .3), style: 'bark' }); else leaf(B, q, a, L, L * 0.45, shade(p.col, (rng() - .5) * .3), null, 'chip', 0.02, 0); }
    } else {
      for (let i = 0; i < p.n; i++) { const q = rp(); const big = k === 'magnolia'; leaf(B, q, rng() * 6.28, big ? 10 + rng() * 5 : 5 + rng() * 3, big ? 3.6 : 2.2, shade(p.col2 && rng() < 0.5 ? p.col2 : p.col, (rng() - .5) * .35), shade(p.col, -.25), k === 'oak' ? 'oak' : 'oval', (rng() - .5) * 0.15, 0, { roll: (rng() - .5) * 0.4 }); }
    }
    B.height = 2; B.coverR = r;
  };

  // ---- color helper ----
  function shade(hex, amt) {
    let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
  }
  JT.shade = shade;

  // ---- wall decorations take on their wall's look (walls are built from the tank's substrate colours) ----
  const hexRgb = (h) => { let c = String(h || '#888888').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c, 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const rgbHex = (c) => '#' + c.map(v => Math.round(M.clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  function toHsl(c) { const [r, g, b] = c, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, s, l]; }
  function fromHsl([h, s, l]) { if (!s) return [l, l, l]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; }
  const mixHex = (a, b, t) => { const A = hexRgb(a), B2 = hexRgb(b); return rgbHex(A.map((v, i) => v + (B2[i] - v) * t)); };
  /** A living colour (leaf, moss, petal) keeps its own hue family but borrows the wall's warmth, light and saturation. */
  function leanHex(c, ref, k) {
    const A = toHsl(hexRgb(c)), R = toHsl(hexRgb(ref)); let dh = R[0] - A[0]; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
    const h = A[0] + (R[1] > 0.08 ? dh * k * 0.3 : 0), sat = A[1] + (Math.min(A[1], R[1] + 0.12) - A[1]) * k * 0.8, l = A[2] + (M.clamp(R[2] + 0.12, 0.18, 0.72) - A[2]) * k * 0.55;
    return rgbHex(fromHsl([h, M.clamp(sat, 0, 1), M.clamp(l, 0.06, 0.94)]));
  }
  const HARD = { cork: 1, slate: 1, drift: 1, rock: 1, wood: 1, sand: 1, coir: 1, river: 1, coconut: 1 };
  /** Re-colour a wall piece's primitives so it reads as part of its wall: hard parts (shelves, pockets, plaques,
      branch stubs, roots) are made from the wall's own colours; plants, moss and flowers keep their kind but are
      graded into the wall's palette. look = { style, cols:{side, top, mark, hi} }. */
  Geo.wallTint = function (prims, look) {
    if (!look || !look.cols) return; const W = look.cols, STY = (JT.Draw && JT.Draw.STY) || {};
    const wood = mixHex(W.side, W.mark, 0.35);
    for (const pr of prims) {
      if (pr._wt) continue; pr._wt = 1;
      if (pr.t === 'prism') {
        const fungus = pr.style === 'fungus'; if (!fungus && !HARD[pr.style] && !pr.cols) continue;
        const base = pr.cols || STY[pr.style] || STY.rock || W; const k = fungus ? 0.5 : pr.style === 'coir' ? 0.72 : 0.78;
        if (!pr.cols) pr.keepPat = true; // keep the material's own surface pattern, in the wall's colours
        pr.cols = { side: mixHex(base.side, W.side, k), top: mixHex(base.top, W.top, k), mark: mixHex(base.mark, W.mark, k), hi: mixHex(base.hi, W.hi, k) };
        continue;
      }
      const woody = pr.t === 'tube' && (pr.style === 'bark' || pr.style === 'drift');
      if (woody) { if (pr.col) pr.col = mixHex(pr.col, wood, 0.7); continue; }
      const k = pr.t === 'bloom' ? 0.3 : pr.t === 'cap' ? 0.42 : 0.5;
      for (const f of ['col', 'col2', 'variegate']) if (typeof pr[f] === 'string' && pr[f][0] === '#') pr[f] = leanHex(pr[f], W.side, k);
    }
  };

  // ---- world transform ----
  function makeXf(inst, baseY) {
    const a = (inst.rot || 0) * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
    const P = (q) => [inst.x + q[0] * c - q[2] * s, baseY + q[1], inst.z + q[0] * s + q[2] * c];
    const V = (q) => [q[0] * c - q[2] * s, q[1], q[0] * s + q[2] * c];
    const P2 = (q) => [inst.x + q[0] * c - q[1] * s, inst.z + q[0] * s + q[1] * c];
    return { P, V, P2 };
  }

  /** Build complete world-space geometry for a decor instance at support height baseY. */
  Geo.build = function (inst, baseY, maxH, look) {
    const def = JT.DECOR_BY_ID[inst.type];
    const rng = JT.makeRng(inst.seed || 1);
    const B = new Builder(rng); B.inst = inst;
    const pp = def.arche === 'backwall' && inst.ww ? Object.assign({}, def.p, { w: inst.ww, h: inst.wh || def.p.h, arc: inst.arc || null, cols: JT.wallCols(inst.sub) }) : def.p; // back walls span the whole back of their tank
    const nominal = pp.h || 10;
    const sc = Math.min(1, Math.max(0.35, (maxH - baseY - 6) / nominal));
    ARCH[def.arche](B, pp, sc);
    const X = makeXf(inst, baseY);
    const g = { id: inst.id, type: inst.type, def, baseY, height: B.height, coverR: B.coverR, cover: inst.bare ? (def.cover || 0) * 0.3 : def.cover,
      prims: [], paths: [], tops: [], solids: [], water: [], flowers: [], extent: [] };
    for (const pr of B.prims) {
      const q = Object.assign({}, pr);
      if (q.poly) q.poly = q.poly.map(X.P2);
      if (q.topPoly) q.topPoly = q.topPoly.map(X.P2);
      if (q.y0 != null) { q.y0 += baseY; q.y1 += baseY; }
      if (q.pts) q.pts = q.pts.map(X.P);
      if (q.o) q.o = X.P(q.o);
      if (q.a && q.t === 'leaf') { q.a = X.V(q.a); q.b = X.V(q.b); }
      if (q.t === 'log') { q.a = X.P(q.a); q.b = X.P(q.b); }
      if (q.t === 'moss') q.blobs = q.blobs.map(b => { const w = X.P2([b[0], b[1]]); return [w[0], w[1], b[2], b[3]]; });
      if (q.t === 'pot') q.o = X.P([0, 0, 0]);
      if (q.door) q.doorDir = X.V([0, 0, -1]);
      if (q.nv) q.nv = X.V(q.nv);
      if (q.ws) q.ws = X.V(q.ws);
      if (q.h != null) q.h = q.h; // height above base for sway
      q.base = baseY;
      g.prims.push(q);
    }
    for (const pa of B.paths) {
      const q = Object.assign({}, pa);
      q.pts = pa.pts.map(X.P);
      q.nrm = pa.nrm ? pa.nrm.map(n => n ? X.V(n) : null) : null;
      g.paths.push(q);
      for (const pt of q.pts) g.extent.push([pt[0], pt[2]]);
    }
    for (const t of B.tops) g.tops.push({ poly: t.poly.map(X.P2), y: t.y + baseY });
    for (const s of B.solids) { const w = s.map(X.P2); g.solids.push(w); for (const pt of w) g.extent.push(pt); }
    for (const w of B.water) g.water.push(Object.assign({}, w, { pos: X.P(w.local) }));
    for (const f of B.flowers) g.flowers.push({ pos: X.P(f.local), path: f.path });
    for (const pr of g.prims) { if (pr.o && pr.t !== 'leaf') g.extent.push([pr.o[0], pr.o[2]]); }
    if (def.arche === 'scatter') { const r = def.p.r; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; g.extent.push(X.P2([Math.cos(a) * r, Math.sin(a) * r * 0.7])); } }
    // base footprint used for overlap rules
    if (g.solids.length) g.foot = G.hull([].concat(...g.solids));
    else { const r = def.arche === 'scatter' ? def.p.r : def.arche === 'branch' ? 5 : def.arche === 'tree' ? (def.p.pot ? 9 : 6) : 6; g.foot = G.circlePoly(inst.x, inst.z, r, r * (def.arche === 'scatter' ? 0.7 : 1), 10); }
    // soft footprints: trunks, stems and logs that touch the ground (floor walkers go round them; their own climb paths still connect)
    g.soft = [];
    for (const pr of g.prims) {
      const segs = pr.t === 'tube' && pr.style !== 'blade' && pr.style !== 'plank' && Math.max(pr.r0, pr.r1) >= 0.9 ? pr.pts.map((q, i) => [q, M.lerp(pr.r0, pr.r1, i / Math.max(1, pr.pts.length - 1))])
        : pr.t === 'log' ? [[pr.a, pr.r], [pr.b, pr.r]] : pr.t === 'pot' ? [[pr.o, pr.r], [[pr.o[0], pr.o[1] + 0.1, pr.o[2]], pr.r]] : null;
      if (!segs) continue;
      for (let i = 0; i + 1 < segs.length; i++) { const pts = [];
        for (let k = 0; k <= 6; k++) { const t = k / 6; const q = M.lerp3(segs[i][0], segs[i + 1][0], t), r = M.lerp(segs[i][1], segs[i + 1][1], t); if (q[1] - r < baseY + 3) for (let a = 0; a < 8; a++) pts.push([q[0] + Math.cos(a * 0.785) * (r + 0.4), q[2] + Math.sin(a * 0.785) * (r + 0.4)]); }
        if (pts.length >= 8) { const h = G.hull(pts); h.soft = true; g.soft.push(h); } }
    }
    // contact points of non-solid objects (path points resting on the support)
    g.contacts = [];
    for (const pa of g.paths) for (const pt of pa.pts) if (pt[1] - baseY < 1.25) g.contacts.push([pt[0], pt[2]]);
    g.center = [inst.x, baseY, inst.z];
    if (B.front) { g.front = B.front.map(X.P2); g.out = X.V([0, 0, -1]); g.wallH = B.height - 4; }
    if (def.arche === 'wallmount') { g.center = [inst.x, inst.my || 40, inst.z]; g.wallOut = X.V([0, 0, -1]); g.foot = G.circlePoly(inst.x, inst.z, (def.p.w || 14) / 2, 3, 8); }
    if (B.lampLocal) { const hd = X.P(B.lampLocal); g.lamp = { head: hd, pool: [hd[0], baseY, hd[2]], r: def.p.pool || 24 }; g.lampOn = inst.on !== false; }
    g.flexible = g.paths.some(p => p.flex > 0.2) || def.cat === 'plants';
    if (look && def.arche === 'wallmount') { Geo.wallTint(g.prims, look); g.look = look.style + '|' + look.cols.side; }
    return g;
  };

  // ---- solid volumes of decor primitives (render-side de-penetration + tests) ----
  const Solid = JT.Solid = {};
  function segD(p, a, b) { const ab = M.sub(b, a); const L2 = M.dot(ab, ab) || 1; const t = Math.max(0, Math.min(1, M.dot(M.sub(p, a), ab) / L2)); return [M.dist(p, M.add(a, M.mul(ab, t))), t]; }
  function edgeD(x, z, P) { let m = 1e9; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; const ex = c[0] - a[0], ez = c[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1))); m = Math.min(m, Math.hypot(a[0] + ex * t - x, a[1] + ez * t - z)); } return m; }
  /** v16: outline of a prism at height y (straight sides between the base and top outline). */
  Solid.slice = function (pr, y) { const P = pr.poly; if (!pr.topPoly || pr.topPoly.length !== P.length) return P; const k = M.clamp((y - pr.y0) / ((pr.y1 - pr.y0) || 1), 0, 1); return P.map((q, i) => [M.lerp(q[0], pr.topPoly[i][0], k), M.lerp(q[1], pr.topPoly[i][1], k)]); };
  /** v16: smooth rocks are drawn with a raised, domed top (centre up to 2.5 above the rim) - the solid includes it. Mirrors the GL prism mesh. */
  Solid.dome = function (pr) {
    if (pr._dome != null) return pr._dome; const n = pr.poly.length; const smooth = pr.style !== 'dish' && (pr.round || pr.curved || pr.dome || ['rock', 'river', 'cork', 'coconut', 'drift', 'moss'].includes(pr.style) || n > 10);
    return (pr._dome = smooth ? Math.min(2.5, (pr.y1 - pr.y0) * 0.12) : 0); };
  /** v16: height of the drawn top surface (flat rim, linear fan up to the raised centre). */
  Solid.domeY = function (pr, x, z) {
    const b = Solid.dome(pr); if (!b) return pr.y1; const top = pr.topPoly || pr.poly; const c = pr._ct || (pr._ct = G.centroid(top));
    const dx = x - c[0], dz = z - c[1], d = Math.hypot(dx, dz); if (d < 1e-6) return pr.y1 + b;
    let R = 1e9; for (let i = 0; i < top.length; i++) { const a = top[i], q = top[(i + 1) % top.length]; const ex = q[0] - a[0], ez = q[1] - a[1]; const den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - c[0]) * ez - (a[1] - c[1]) * ex) / den, u = ((a[0] - c[0]) * dz - (a[1] - c[1]) * dx) / den; if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) R = Math.min(R, t * d); }
    return R > 1e8 ? pr.y1 : pr.y1 + b * Math.max(0, 1 - d / R); };
  /** How deep a point sits inside one primitive (0 = outside). */
  Solid.depth = function (pt, pr) {
    if (pr.t === 'prism') { if (pt[1] <= pr.y0) return 0; if (pt[1] >= pr.y1) { const b = Solid.dome(pr); if (!b || pt[1] >= pr.y1 + b) return 0; const top = pr.topPoly || pr.poly; if (!G.pointInPoly(pt[0], pt[2], top)) return 0; const sy = Solid.domeY(pr, pt[0], pt[2]); return sy > pt[1] ? Math.min(sy - pt[1], edgeD(pt[0], pt[2], top)) : 0; }
      const P = Solid.slice(pr, pt[1]); if (!G.pointInPoly(pt[0], pt[2], P)) return 0; return Math.min(edgeD(pt[0], pt[2], P), pr.y1 - pt[1] + Solid.dome(pr), pt[1] - pr.y0); }
    if (pr.t === 'tube') { let best = 0; for (let i = 0; i + 1 < pr.pts.length; i++) { const r = segD(pt, pr.pts[i], pr.pts[i + 1]); const rr = M.lerp(pr.r0, pr.r1, (i + r[1]) / (pr.pts.length - 1)); if (rr - r[0] > best) best = rr - r[0]; } return best; }
    if (pr.t === 'log') { const d = segD(pt, pr.a, pr.b)[0]; if (d >= pr.r) return 0; if (pr.hollow) return d < pr.r * 0.72 ? 0 : Math.min(pr.r - d, d - pr.r * 0.72); if (pr.half && pt[1] < Math.min(pr.a[1], pr.b[1])) return 0; return pr.r - d; }
    if (pr.t === 'cap') { const ry = pr.cone ? pr.r * 0.95 : pr.r * 0.42; const dx = (pt[0] - pr.o[0]) / pr.r, dy = (pt[1] - pr.o[1]) / ry, dz = (pt[2] - pr.o[2]) / pr.r; if (dy < -0.15) return 0; const q = Math.hypot(dx, Math.max(0, dy), dz); return q < 1 ? (1 - q) * ry : 0; }
    if (pr.t === 'pot') { const d = Math.hypot(pt[0] - pr.o[0], pt[2] - pr.o[2]); if (pt[1] < pr.o[1] || pt[1] > pr.o[1] + pr.h || d > pr.r) return 0; return Math.min(pr.r - d, pr.o[1] + pr.h - pt[1]); }
    if (pr.t === 'lamp') { const d = M.dist(pt, pr.o); return d < pr.r ? pr.r - d : 0; }
    return 0;
  };
  /** Solid primitives of a geometry with a bounding box (cached). */
  Solid.of = function (g) {
    if (g._solid) return g._solid;
    const list = g.prims.filter(pr => pr.t === 'prism' || pr.t === 'log' || pr.t === 'cap' || pr.t === 'pot' || pr.t === 'lamp' || (pr.t === 'tube' && pr.style !== 'blade' && pr.style !== 'plank' && Math.max(pr.r0, pr.r1) >= 0.8));
    const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; const add = (x, y, z, r) => { bb[0] = Math.min(bb[0], x - r); bb[1] = Math.min(bb[1], y - r); bb[2] = Math.min(bb[2], z - r); bb[3] = Math.max(bb[3], x + r); bb[4] = Math.max(bb[4], y + r); bb[5] = Math.max(bb[5], z + r); };
    for (const pr of list) { if (pr.poly) for (const q of pr.poly.concat(pr.topPoly || [])) { add(q[0], pr.y0, q[1], 0); add(q[0], pr.y1, q[1], 0); } if (pr.pts) for (const q of pr.pts) add(q[0], q[1], q[2], Math.max(pr.r0, pr.r1)); if (pr.t === 'log') { add(pr.a[0], pr.a[1], pr.a[2], pr.r); add(pr.b[0], pr.b[1], pr.b[2], pr.r); } if (pr.o) add(pr.o[0], pr.o[1] + (pr.h || 0), pr.o[2], pr.r); if (pr.o) add(pr.o[0], pr.o[1], pr.o[2], pr.r); }
    let dome = 0; for (const pr of list) if (pr.t === 'prism') dome = Math.max(dome, Solid.dome(pr));
    // v16: per-primitive boxes so point queries skip far parts of a big tree / wall quickly
    for (const pr of list) { const b2 = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; const ad = (x, y, z, r) => { b2[0] = Math.min(b2[0], x - r); b2[1] = Math.min(b2[1], y - r); b2[2] = Math.min(b2[2], z - r); b2[3] = Math.max(b2[3], x + r); b2[4] = Math.max(b2[4], y + r); b2[5] = Math.max(b2[5], z + r); };
      if (pr.poly) { for (const q of pr.poly.concat(pr.topPoly || [])) { ad(q[0], pr.y0, q[1], 0); ad(q[0], pr.y1 + (pr.t === 'prism' ? Solid.dome(pr) : 0), q[1], 0); } }
      if (pr.pts) for (const q of pr.pts) ad(q[0], q[1], q[2], Math.max(pr.r0, pr.r1));
      if (pr.t === 'log') { ad(pr.a[0], pr.a[1], pr.a[2], pr.r); ad(pr.b[0], pr.b[1], pr.b[2], pr.r); }
      if (pr.o) { ad(pr.o[0], pr.o[1] + (pr.h || 0), pr.o[2], pr.r); ad(pr.o[0], pr.o[1], pr.o[2], pr.r); }
      pr._bb = b2[0] < 1e8 ? b2 : null; }
    return (g._solid = { list, bb, dome });
  };
  /** Deepest penetration of a point into a geometry: {d, pr}. */
  Solid.at = function (g, pt, pad) {
    const S = Solid.of(g), b = S.bb; pad = pad || 0; let best = null; const dm = S.dome || 0;
    if (pt[0] < b[0] - pad || pt[1] < b[1] - pad || pt[2] < b[2] - pad || pt[0] > b[3] + pad || pt[1] > b[4] + pad + dm || pt[2] > b[5] + pad) return null;
    for (const pr of S.list) { const q = pr._bb; if (q && (pt[0] < q[0] || pt[0] > q[3] || pt[1] < q[1] || pt[1] > q[4] || pt[2] < q[2] || pt[2] > q[5])) continue; const d = Solid.depth(pt, pr); if (d > 0 && (!best || d > best.d)) best = { d, pr }; }
    return best;
  };
  /** v16: shortest way out of a primitive while staying on the surface a critter walks on (plane with normal n):
      sideways round a rock wall / trunk / cap instead of "out through the floor". Returns {dir, d} or null. */
  Solid.slide = function (pt, pr, n) {
    let v = null, d = 0;
    if (pr.t === 'prism') { const y = M.clamp(pt[1], pr.y0, pr.y1); const P = Solid.slice(pr, y); let best = 1e9, bx = 0, bz = 0;
      for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; const ex = c[0] - a[0], ez = c[1] - a[1]; const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * ex + (pt[2] - a[1]) * ez) / (ex * ex + ez * ez || 1))); const qx = a[0] + ex * t, qz = a[1] + ez * t; const dd = Math.hypot(qx - pt[0], qz - pt[2]); if (dd < best) { best = dd; bx = qx; bz = qz; } }
      if (best > 1e8) return null; v = [bx - pt[0], 0, bz - pt[2]]; d = best; if (M.len(v) < 1e-6) { const c = G.centroid(P); v = [pt[0] - c[0], 0, pt[2] - c[1]]; }
      if (n && Math.abs(n[1]) < 0.8) { // on a wall / stem (surface plane is not level): leaving through the top or a raised piece's underside can be shorter
        const cands = [v, [0, 1, 0]]; if (pr.y0 > 0.5) cands.push([0, -1, 0]); let bestE = Infinity, bv = null;
        for (const c of cands) { let w = M.sub(c, M.mul(n, M.dot(c, n))); const l = M.len(w); if (l < 0.3) continue; w = M.mul(w, 1 / l); let hi = 2; for (let k = 0; k < 5 && Solid.depth(M.add(pt, M.mul(w, hi)), pr) > 0; k++) hi *= 2; const e = Solid.exitAlong(pt, pr, w, hi); if (e < bestE) { bestE = e; bv = w; } }
        if (bv) return { dir: bv, d: bestE }; } }
    else if (pr.t === 'tube' || pr.t === 'log') { const pts = pr.t === 'log' ? [pr.a, pr.b] : pr.pts; let best = -1e9, ax = null;
      for (let i = 0; i + 1 < pts.length; i++) { const r = segD(pt, pts[i], pts[i + 1]); const rr = pr.t === 'log' ? pr.r : M.lerp(pr.r0, pr.r1, (i + r[1]) / (pts.length - 1)); if (rr - r[0] > best) { best = rr - r[0]; ax = M.add(pts[i], M.mul(M.sub(pts[i + 1], pts[i]), r[1])); } }
      if (!ax) return null; v = M.sub(pt, ax); d = Math.max(0, best); }
    else if (pr.o) { const c = pr.t === 'pot' ? [pr.o[0], pt[1], pr.o[2]] : pr.o; v = M.sub(pt, c); d = Solid.depth(pt, pr); }
    if (!v) return null;
    if (n) v = M.sub(v, M.mul(n, M.dot(v, n)));
    const L = M.len(v); if (L < 1e-4) return null; v = M.mul(v, 1 / L);
    if (n) { // distance to leave along the in-plane direction (round parts and sloped sides are not a straight edge distance)
      let hi = Math.max(0.5, d * 1.5 + 0.5); for (let k = 0; k < 4 && Solid.depth(M.add(pt, M.mul(v, hi)), pr) > 0; k++) hi *= 2;
      const e = Solid.exitAlong(pt, pr, v, hi); if (Number.isFinite(e)) d = e; }
    return { dir: v, d };
  };
  /** v16: distance to leave a primitive straight along a direction (bisection; Infinity if not within max). */
  Solid.exitAlong = function (pt, pr, dir, max) { if (Solid.depth(M.add(pt, M.mul(dir, max)), pr) > 0) return Infinity; let lo = 0, hi = max; for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (Solid.depth(M.add(pt, M.mul(dir, m)), pr) > 0) lo = m; else hi = m; } return hi; };
  /** Outward direction from a primitive at a point (numerical gradient of depth). */
  Solid.grad = function (pt, pr) {
    const e = 0.25, f = (q) => Solid.depth(q, pr); const gx = f([pt[0] - e, pt[1], pt[2]]) - f([pt[0] + e, pt[1], pt[2]]), gy = f([pt[0], pt[1] - e, pt[2]]) - f([pt[0], pt[1] + e, pt[2]]), gz = f([pt[0], pt[1], pt[2] - e]) - f([pt[0], pt[1], pt[2] + e]);
    const L = Math.hypot(gx, gy, gz); return L > 1e-6 ? [gx / L, gy / L, gz / L] : [0, 1, 0];
  };
})(typeof window !== 'undefined' ? window : globalThis);
