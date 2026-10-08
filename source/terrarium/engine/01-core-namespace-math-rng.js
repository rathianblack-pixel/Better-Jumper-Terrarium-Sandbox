/* Jumper Terrarium — core: namespace, math, RNG, geometry helpers.
   No DOM access. Shared by simulation, renderer and headless tests. */
(function (root) {
  'use strict';
  const JT = root.JT = root.JT || {};
  JT.DEV = false;

  // ---------- Seeded RNG ----------
  JT.makeRng = function (seed) {
    let a = (seed >>> 0) || 1;
    const f = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    f.state = () => a;
    f.setState = (s) => { a = s | 0; };
    return f;
  };
  // Global simulation RNG (reseedable for deterministic tests)
  JT.R = JT.makeRng(Date.now() & 0xffffffff);
  JT.reseed = (s) => { JT.R = JT.makeRng(s); };
  JT.hashStr = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // ---------- Math ----------
  const M = JT.M = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    smooth: (t) => t * t * (3 - 2 * t),
    wrapAngle: (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; },
    v: (x, y, z) => [x, y, z],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    dist2: (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp3: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    finite3: (a) => a && isFinite(a[0]) && isFinite(a[1]) && isFinite(a[2]),
  };

  // ---------- 2D polygon helpers (x,z plane) ----------
  const G = JT.G = {};
  G.pointInPoly = function (x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi)) inside = !inside;
    }
    return inside;
  };
  G.centroid = function (poly) {
    let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; }
    return [x / poly.length, z / poly.length];
  };
  G.scalePoly = function (poly, s, c) {
    c = c || G.centroid(poly);
    return poly.map(p => [c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s]);
  };
  // Expand a (near-)convex polygon outward by r units.
  G.expandPoly = function (poly, r) {
    const c = G.centroid(poly);
    return poly.map(p => { const dx = p[0] - c[0], dz = p[1] - c[1]; const l = Math.hypot(dx, dz) || 1; return [p[0] + dx / l * r, p[1] + dz / l * r]; });
  };
  G.hull = function (pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
  };
  function segInter(a, b, c, d) {
    const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]);
    const d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  // Does segment a-b pass through polygon interior?
  G.segHitsPoly = function (a, b, poly) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segInter(a, b, poly[j], poly[i])) return true;
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return G.pointInPoly(m[0], m[1], poly);
  };
  G.polysOverlap = function (A, B) {
    for (const p of A) if (G.pointInPoly(p[0], p[1], B)) return true;
    for (const p of B) if (G.pointInPoly(p[0], p[1], A)) return true;
    for (let i = 0, j = A.length - 1; i < A.length; j = i++)
      for (let k = 0, l = B.length - 1; k < B.length; l = k++) if (segInter(A[j], A[i], B[l], B[k])) return true;
    return false;
  };
  G.polyArea = function (poly) {
    let s = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    return Math.abs(s / 2);
  };
  G.circlePoly = function (cx, cz, rx, rz, n, rng, jitter) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2; const j = rng ? 1 - jitter * rng() : 1;
      out.push([cx + Math.cos(a) * rx * j, cz + Math.sin(a) * rz * j]);
    }
    return out;
  };
  // Closest point within polygon (clamp toward centroid if outside)
  G.clampIntoPoly = function (x, z, poly, margin) {
    if (G.pointInPoly(x, z, poly)) return [x, z];
    const c = G.centroid(poly);
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; const px = c[0] + (x - c[0]) * m, pz = c[1] + (z - c[1]) * m; if (G.pointInPoly(px, pz, poly)) lo = m; else hi = m; }
    const m = lo * (margin || 0.97);
    return [c[0] + (x - c[0]) * m, c[1] + (z - c[1]) * m];
  };

  // ---------- Misc ----------
  JT.assert = function (cond, msg) { if (!cond) { if (JT.DEV) console.warn('[JT assert] ' + msg); return false; } return true; };
  JT.deepClone = (o) => JSON.parse(JSON.stringify(o));
  JT.fmtTime = function (tod) {
    const mins = Math.floor(tod * 24 * 60); const h = Math.floor(mins / 60) % 24, m = mins % 60;
    return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm');
  };
})(typeof window !== 'undefined' ? window : globalThis);
