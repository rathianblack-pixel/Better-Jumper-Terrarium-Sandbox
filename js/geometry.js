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

  // ---- branches ----
  ARCH.branch = function (B, p, sc) {
    const rng = B.rng, L = p.L, h = p.h * sc, r = p.r, col = p.col, k = p.kind;
    const tube = (pts, r0, r1, o) => B.prim(Object.assign({ t: 'tube', pts, r0, r1, col, style: 'bark' }, o || {}));
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
  Geo._leaf = leaf;

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
    // foliage clusters around branch ends (render only; branch ends are the perches)
    const leafCol = p.leaf;
    for (const e of ends) {
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
      const reach = p.trailing ? 6 + rng() * 10 : (p.upright ? 2 + rng() * 3 : 4 + rng() * 6);
      const end = [Math.cos(a) * reach, H, Math.sin(a) * reach * 0.8];
      const stem = bez([0, 0, 0], [Math.cos(a) * reach * 0.3, H * 0.7, Math.sin(a) * reach * 0.25], end, 5);
      B.prim({ t: 'tube', pts: stem, r0: 0.7, r1: 0.45, col: shade(p.leaf, -0.15), style: 'stem' });
      const pitch = p.upright ? 1.05 : (p.roof ? -0.05 : 0.15 - rng() * 0.35);
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
      B.prim({ t: 'tube', pts, r0: capR * 0.32, r1: capR * 0.24, col: '#e8e0c8', style: 'stem' });
      B.prim({ t: 'cap', o: pts[4], r: capR, col: p.col, glow: p.glow, h: H });
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
      for (let i = 0; i < p.n; i++) { const q = rp(); const big = k === 'magnolia'; leaf(B, q, rng() * 6.28, big ? 10 + rng() * 5 : 5 + rng() * 3, big ? 3.6 : 2.2, shade(p.col, (rng() - .5) * .35), shade(p.col, -.25), k === 'oak' ? 'oak' : 'oval', (rng() - .5) * 0.15, 0, { roll: (rng() - .5) * 0.4 }); }
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

  // ---- world transform ----
  function makeXf(inst, baseY) {
    const a = (inst.rot || 0) * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
    const P = (q) => [inst.x + q[0] * c - q[2] * s, baseY + q[1], inst.z + q[0] * s + q[2] * c];
    const V = (q) => [q[0] * c - q[2] * s, q[1], q[0] * s + q[2] * c];
    const P2 = (q) => [inst.x + q[0] * c - q[1] * s, inst.z + q[0] * s + q[1] * c];
    return { P, V, P2 };
  }

  /** Build complete world-space geometry for a decor instance at support height baseY. */
  Geo.build = function (inst, baseY, maxH) {
    const def = JT.DECOR_BY_ID[inst.type];
    const rng = JT.makeRng(inst.seed || 1);
    const B = new Builder(rng);
    const nominal = def.p.h || 10;
    const sc = Math.min(1, Math.max(0.35, (maxH - baseY - 6) / nominal));
    ARCH[def.arche](B, def.p, sc);
    const X = makeXf(inst, baseY);
    const g = { id: inst.id, type: inst.type, def, baseY, height: B.height, coverR: B.coverR, cover: def.cover,
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
    // contact points of non-solid objects (path points resting on the support)
    g.contacts = [];
    for (const pa of g.paths) for (const pt of pa.pts) if (pt[1] - baseY < 1.25) g.contacts.push([pt[0], pt[2]]);
    g.center = [inst.x, baseY, inst.z];
    g.flexible = g.paths.some(p => p.flex > 0.2) || def.cat === 'plants';
    return g;
  };
})(typeof window !== 'undefined' ? window : globalThis);
