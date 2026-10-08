/* Jumper Terrarium — storybook renderer, part 1: turns the decor geometry primitives (the same ones that make the
   walkable surfaces) into small 3D meshes once per layout, so turning the camera costs almost nothing.
   Each vertex: position, shading normal, ink-outline direction, wash colour, mark colour, sway weight, flags.
   Flags: pattern (0-7) + 8 two-sided + 16 glows at night. Ink strokes (leaf ribs, bark marks, rings) are separate
   line segments drawn as screen-space ribbons. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, G = JT.G;
  const STRIDE = 17;
  const PAT = { none: 0, speck: 1, bands: 2, grain: 3, moss: 4, dots: 5 };
  const TWO = 8, GLOW = 16;
  const cache = new Map();
  function rgb(c) {
    if (Array.isArray(c)) return c; if (!c) return [0.5, 0.5, 0.5]; let v = cache.get(c); if (v) return v;
    if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); v = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
    else { const m = c.match(/[\d.]+/g); v = m ? [m[0] / 255, m[1] / 255, m[2] / 255] : [0.5, 0.5, 0.5]; }
    cache.set(c, v); return v;
  }
  const shade = (c, a) => rgb(JT.shade(typeof c === 'string' ? c : '#888888', a));
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const perp = (t) => { const a = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; return M.norm(M.cross(t, a)); };

  class MB {
    constructor(g) { this.v = []; this.i = []; this.n = 0; this.lines = []; this.g = g; const H = g ? Math.max(4, g.height) : 10; this.base = g ? g.baseY : 0; this.H = H; }
    sw(p) { const k = Math.min(1.2, Math.max(0, (p[1] - this.base) / this.H)); return k * k; }
    vert(p, n, o, c, c2, f) { const v = this.v; v.push(p[0], p[1], p[2], n[0], n[1], n[2], o[0], o[1], o[2], c[0], c[1], c[2], c2[0], c2[1], c2[2], this.sw(p), f || 0); return this.n++; }
    tri(a, b, c) { this.i.push(a, b, c); }
    quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
    line(a, b, w, al, col) { this.lines.push([a, b, w, al == null ? 0.8 : al, col || null]); }
    polyline(pts, w, al, col) { for (let i = 0; i + 1 < pts.length; i++) this.line(pts[i], pts[i + 1], w, al, col); }
  }

  // ---------- generic shapes ----------
  /** Ellipsoid (or upper half) with axes ax, ay (up), az. */
  function ell(mb, c, ax, ay, az, col, col2, f, o, nu, nv, half, ink) {
    nu = nu || 8; nv = nv || 5; const ids = []; const la = M.dot(ax, ax), lb = M.dot(ay, ay), lc = M.dot(az, az);
    const v0 = half ? 0 : -Math.PI / 2;
    for (let j = 0; j <= nv; j++) {
      const b = v0 + (Math.PI / 2 - v0) * j / nv, cb = Math.cos(b), sb = Math.sin(b); const row = [];
      for (let i = 0; i < nu; i++) {
        const a = i / nu * Math.PI * 2, x = Math.cos(a) * cb, y = sb, z = Math.sin(a) * cb;
        const p = [c[0] + ax[0] * x + ay[0] * y + az[0] * z, c[1] + ax[1] * x + ay[1] * y + az[1] * z, c[2] + ax[2] * x + ay[2] * y + az[2] * z];
        const n = M.norm([ax[0] * x / la + ay[0] * y / lb + az[0] * z / lc, ax[1] * x / la + ay[1] * y / lb + az[1] * z / lc, ax[2] * x / la + ay[2] * y / lb + az[2] * z / lc]);
        const cc = col2 && !Array.isArray(col2[0]) ? mixc(col, col2, Math.max(0, y) * 0.6) : col;
        row.push(mb.vert(p, n, M.mul(n, ink == null ? 1 : ink), cc, col2 || col, f));
      }
      ids.push(row);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const i2 = (i + 1) % nu; mb.quad(ids[j][i], ids[j][i2], ids[j + 1][i2], ids[j + 1][i]); }
    if (half) { const n = M.norm(M.mul(ay, -1)); const ci = mb.vert(c, n, [0, 0, 0], shade(hexOf(col), -0.3), col, f); for (let i = 0; i < nu; i++) mb.tri(ci, ids[0][(i + 1) % nu], ids[0][i]); }
  }
  function hexOf(c) { return '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0')).join(''); }
  /** Tube along a polyline, radius r0 -> r1. */
  function tube(mb, pts, r0, r1, col, col2, f, sides, caps, ink, colEnd) {
    const n = pts.length; if (n < 2) return; sides = sides || 6; let nrm = null; const rings = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let t = M.sub(b, a); if (M.len(t) < 1e-6) t = [0, 1, 0]; t = M.norm(t);
      nrm = nrm ? M.norm(M.sub(nrm, M.mul(t, M.dot(nrm, t)))) : perp(t); if (!M.finite3(nrm) || M.len(nrm) < 0.5) nrm = perp(t);
      const bin = M.norm(M.cross(t, nrm)); const r = M.lerp(r0, r1, i / (n - 1)); const row = [];
      const cc = colEnd ? mixc(col, colEnd, i / (n - 1)) : col;
      for (let k = 0; k < sides; k++) { const a2 = k / sides * Math.PI * 2; const d = M.add(M.mul(nrm, Math.cos(a2)), M.mul(bin, Math.sin(a2))); row.push(mb.vert(M.add(pts[i], M.mul(d, r)), d, M.mul(d, ink == null ? 1 : ink), cc, col2 || col, f)); }
      rings.push({ row, t, c: pts[i], r });
    }
    for (let i = 0; i + 1 < n; i++) for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; mb.quad(rings[i].row[k], rings[i].row[k2], rings[i + 1].row[k2], rings[i + 1].row[k]); }
    if (caps) for (const [R, s] of [[rings[0], -1], [rings[n - 1], 1]]) { const nn = M.mul(R.t, s); const ci = mb.vert(R.c, nn, M.mul(nn, 0.6), caps === true ? col : caps, col2 || col, f); for (let k = 0; k < sides; k++) { const p = mb.v; const id = R.row[k], id2 = R.row[(k + 1) % sides]; const P1 = [p[id * STRIDE], p[id * STRIDE + 1], p[id * STRIDE + 2]], P2 = [p[id2 * STRIDE], p[id2 * STRIDE + 1], p[id2 * STRIDE + 2]]; const a = mb.vert(P1, nn, M.norm(M.sub(P1, R.c)), caps === true ? col : caps, col2 || col, f), b = mb.vert(P2, nn, M.norm(M.sub(P2, R.c)), caps === true ? col : caps, col2 || col, f); mb.tri(ci, a, b); } }
    return rings;
  }
  /** Flat disc / fan in the plane (u, v) around c. */
  function disc(mb, c, u, v, n, col, f, seg, ink, rimCol) {
    seg = seg || 10; const ci = mb.vert(c, n, [0, 0, 0], col, col, f); const ids = [];
    for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; const d = M.add(M.mul(u, Math.cos(a)), M.mul(v, Math.sin(a))); ids.push(mb.vert(M.add(c, d), n, M.mul(M.norm(d), ink == null ? 1 : ink), rimCol || col, col, f)); }
    for (let i = 0; i < seg; i++) mb.tri(ci, ids[i], ids[(i + 1) % seg]);
  }

  // ---------- primitives ----------
  const STYP = (s) => ({ cork: PAT.speck, coconut: PAT.speck, rock: PAT.speck, river: PAT.speck, drift: PAT.grain, driftwall: PAT.grain, slate: PAT.bands, sand: PAT.bands, ruin: PAT.bands, sandwall: PAT.bands, wood: PAT.grain, terracotta: PAT.grain, trunkwall: PAT.grain, barkwall: PAT.speck, mosswall: PAT.moss, moss: PAT.moss, leafwall: PAT.dots, rootwall: PAT.dots, stonewall: PAT.speck, fungus: PAT.bands, coir: PAT.dots, birch: PAT.bands, lichen: PAT.moss, limestone: PAT.bands, mottled: PAT.dots, dish: 0 }[s] || 0);
  const B = {};
  B.prism = function (mb, pr, g) {
    const STY = JT.Draw.STY; const st = pr.cols || STY[pr.style] || STY.rock; const base = pr.poly, top = pr.topPoly || pr.poly; const n = base.length; if (n < 3) return;
    const c = G.centroid(base); const ct = G.centroid(top); const side = rgb(st.side), topC = rgb(st.top), mark = rgb(st.mark), hi = rgb(st.hi); const pat = STYP(pr.style);
    const smooth = pr.round || pr.curved || pr.dome || ['rock', 'river', 'cork', 'coconut', 'drift', 'moss'].includes(pr.style) || n > 10;
    const H = pr.y1 - pr.y0; const ccw = G.polyArea(base) > 0;
    // outward horizontal normals per edge and averaged per vertex
    const en = []; for (let i = 0; i < n; i++) { const a = base[i], b = base[(i + 1) % n]; let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; const mx = (a[0] + b[0]) / 2 - c[0], mz = (a[1] + b[1]) / 2 - c[1]; if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; } en.push([nx, 0, nz]); }
    const vn = []; for (let i = 0; i < n; i++) vn.push(M.norm(M.add(en[i], en[(i - 1 + n) % n])));
    const tilt = (i) => { const dx = Math.hypot(base[i][0] - c[0], base[i][1] - c[1]) - Math.hypot(top[i][0] - ct[0], top[i][1] - ct[1]); return Math.atan2(dx, Math.max(0.5, H)); };
    const bottomLift = pr.y0 > g.baseY + 0.4 ? 1 : 0; void ccw;
    const dark = shade(st.side, -0.18);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; const a = base[i], b = base[j], ta = top[i], tb = top[j];
      const na = smooth ? vn[i] : en[i], nb = smooth ? vn[j] : en[i];
      const ka = Math.sin(tilt(i)) * 0.8, kb = Math.sin(tilt(j)) * 0.8;
      const NA = M.norm([na[0], ka, na[2]]), NB = M.norm([nb[0], kb, nb[2]]);
      const oa = M.norm([vn[i][0], 0.15, vn[i][2]]), ob = M.norm([vn[j][0], 0.15, vn[j][2]]);
      const A0 = mb.vert([a[0], pr.y0, a[1]], NA, oa, dark, mark, pat), B0 = mb.vert([b[0], pr.y0, b[1]], NB, ob, dark, mark, pat);
      const B1 = mb.vert([tb[0], pr.y1, tb[1]], NB, ob, side, mark, pat), A1 = mb.vert([ta[0], pr.y1, ta[1]], NA, oa, side, mark, pat);
      mb.quad(A0, B0, B1, A1);
    }
    // top cap
    if (pr.style === 'dish') {
      const rimIds = top.map((q, i) => mb.vert([q[0], pr.y1, q[1]], [0, 1, 0], M.norm([vn[i][0], 0.3, vn[i][2]]), topC, mark, 0)); const ci = mb.vert([ct[0], pr.y1, ct[1]], [0, 1, 0], [0, 0, 0], topC, mark, 0);
      for (let i = 0; i < n; i++) mb.tri(ci, rimIds[i], rimIds[(i + 1) % n]);
      const inner = G.scalePoly(top, pr.w0 ? 0.9 : 0.82); const w0 = rgb(pr.w0 || '#7ab4d4'), w1 = rgb(pr.w1 || '#3f7a9e'); const wc = mb.vert([ct[0], pr.y1 + 0.08, ct[1]], [0, 1, 0], [0, 0, 0], w1, w1, 0);
      const wi = inner.map(q => mb.vert([q[0], pr.y1 + 0.08, q[1]], [0, 1, 0], [0, 0, 0], w0, w0, 0)); for (let i = 0; i < n; i++) mb.tri(wc, wi[i], wi[(i + 1) % n]);
      mb.polyline(inner.concat([inner[0]]).map(q => [q[0], pr.y1 + 0.1, q[1]]), 0.7, 0.5);
      return;
    }
    const tc = smooth ? mixc(topC, hi, 0.25) : topC;
    const ci = mb.vert([ct[0], pr.y1 + (smooth ? Math.min(2.5, H * 0.12) : 0), ct[1]], [0, 1, 0], [0, 1, 0], mixc(tc, hi, 0.2), mark, pat);
    const rim = top.map((q, i) => mb.vert([q[0], pr.y1, q[1]], smooth ? M.norm([vn[i][0] * 0.45, 1, vn[i][2] * 0.45]) : [0, 1, 0], M.norm([vn[i][0], 0.15, vn[i][2]]), tc, mark, pat));
    for (let i = 0; i < n; i++) mb.tri(ci, rim[i], rim[(i + 1) % n]);
    if (bottomLift) { const cb = mb.vert([c[0], pr.y0, c[1]], [0, -1, 0], [0, -1, 0], shade(st.side, -0.35), mark, pat); const rb = base.map((q, i) => mb.vert([q[0], pr.y0, q[1]], [0, -1, 0], M.norm([vn[i][0], -0.2, vn[i][2]]), shade(st.side, -0.35), mark, pat)); for (let i = 0; i < n; i++) mb.tri(cb, rb[(i + 1) % n], rb[i]); }
    // ink: crisp top rim for flat-topped blocks, a few marks on the sides
    if (!smooth) mb.polyline(top.concat([top[0]]).map(q => [q[0], pr.y1, q[1]]), 0.8, 0.55);
    const rng = JT.makeRng(JT.hashStr(String(g.id) + pr.y0 + pr.style));
    if (H > 3 && !st.soft) for (let k = 0; k < Math.min(8, n); k++) { const i = (rng() * n) | 0, j = (i + 1) % n; const u = 0.2 + rng() * 0.6, v0 = 0.15 + rng() * 0.4, v1 = v0 + 0.15 + rng() * 0.3; const at = (u2, v) => { const a = base[i], b = base[j], ta = top[i], tb = top[j]; const x0 = M.lerp(a[0], b[0], u2), z0 = M.lerp(a[1], b[1], u2), x1 = M.lerp(ta[0], tb[0], u2), z1 = M.lerp(ta[1], tb[1], u2); return [M.lerp(x0, x1, v) + en[i][0] * 0.08, M.lerp(pr.y0, pr.y1, v), M.lerp(z0, z1, v) + en[i][2] * 0.08]; }; mb.line(at(u, v0), at(u + (rng() - 0.5) * 0.1, v1), 0.6, 0.45); }
    // hide doorway on the face nearest its local front
    if (pr.door && pr.doorDir) {
      let bi = 0, bd = -2; for (let i = 0; i < n; i++) { const d = en[i][0] * pr.doorDir[0] + en[i][2] * pr.doorDir[2]; if (d > bd) { bd = d; bi = i; } }
      const a = base[bi], b = base[(bi + 1) % n], ta = top[bi], tb = top[(bi + 1) % n]; const nn = en[bi]; const blk = rgb('#140c06');
      const at = (u, v) => { const x0 = M.lerp(a[0], b[0], u), z0 = M.lerp(a[1], b[1], u), x1 = M.lerp(ta[0], tb[0], u), z1 = M.lerp(ta[1], tb[1], u); return [M.lerp(x0, x1, v) + nn[0] * 0.15, M.lerp(pr.y0, pr.y1, v), M.lerp(z0, z1, v) + nn[2] * 0.15]; };
      const ids = [], pts = []; const S = 10; for (let k = 0; k <= S; k++) { const t = k / S * Math.PI; const u = 0.5 - Math.cos(t) * 0.28, v = Math.sin(t) * 0.55; pts.push(at(u, v)); }
      const cc = mb.vert(at(0.5, 0.15), nn, [0, 0, 0], blk, blk, 0); for (const p of pts) ids.push(mb.vert(p, nn, [0, 0, 0], blk, blk, 0)); for (let k = 0; k < S; k++) mb.tri(cc, ids[k], ids[k + 1]);
      mb.polyline(pts, 1, 0.8);
    }
  };
  B.tube = function (mb, pr, g) {
    const n = pr.pts.length; if (n < 2) return; const col = rgb(pr.style === 'drift' ? '#9a8c78' : pr.col);
    if (pr.style === 'blade') {
      // a grass blade: a narrow, slightly folded ribbon so it never vanishes edge-on
      const gc = g.center || [0, 0, 0]; const ids = [];
      const tip = shade(pr.col, 0.18), root2 = shade(pr.col, -0.12), str = pr.stripe ? rgb(pr.stripe) : shade(pr.col, 0.25);
      for (let i = 0; i < n; i++) {
        const p = pr.pts[i], a = pr.pts[Math.max(0, i - 1)], b = pr.pts[Math.min(n - 1, i + 1)]; const t = M.norm(M.sub(b, a));
        let rad = [p[0] - gc[0], 0, p[2] - gc[2]]; if (M.len(rad) < 0.3) rad = [1, 0, 0]; rad = M.norm(rad);
        let s = M.cross(t, rad); s = M.len(s) < 0.2 ? perp(t) : M.norm(s); const nrm = M.norm(M.cross(s, t)); const w = M.lerp(pr.r0, pr.r1, i / (n - 1)) * 1.1; const k = i / (n - 1);
        const c0 = mixc(root2, tip, k); const fold = M.mul(nrm, w * 0.35);
        ids.push([mb.vert(M.add(M.add(p, M.mul(s, -w)), fold), nrm, M.mul(s, -1), c0, str, PAT.none + TWO), mb.vert(p, nrm, [0, 0, 0], mixc(c0, str, pr.stripe ? 0.6 : 0.25), str, TWO), mb.vert(M.add(M.add(p, M.mul(s, w)), fold), nrm, s, c0, str, TWO)]);
      }
      for (let i = 0; i + 1 < n; i++) { mb.quad(ids[i][0], ids[i][1], ids[i + 1][1], ids[i + 1][0]); mb.quad(ids[i][1], ids[i][2], ids[i + 1][2], ids[i + 1][1]); }
      return;
    }
    if (pr.style === 'plank') {
      const wd = (pr.w || 8) / 2; const cc = rgb(pr.col);
      for (let i = 0; i + 1 < n; i++) { const a = pr.pts[i], b = pr.pts[i + 1]; const t = M.norm(M.sub(b, a)); const s = M.norm(M.cross(t, [0, 1, 0])); const up = M.norm(M.cross(s, t)); const c2 = shade(pr.col, i % 2 ? 0.05 : -0.08);
        const P = (p, x, y) => M.add(M.add(p, M.mul(s, x)), M.mul(up, y)); const q = [P(a, -wd, 0.6), P(b, -wd, 0.6), P(b, wd, 0.6), P(a, wd, 0.6)];
        const ids = q.map((p, k) => mb.vert(p, up, M.norm(M.add(M.mul(s, k < 1 || k > 2 ? -1 : 1), M.mul(up, 0.2))), c2, shade(pr.col, -0.3), PAT.grain)); mb.quad(ids[0], ids[1], ids[2], ids[3]);
        const q2 = [P(a, -wd, -0.6), P(b, -wd, -0.6), P(b, wd, -0.6), P(a, wd, -0.6)]; const ids2 = q2.map((p, k) => mb.vert(p, s, M.mul(s, k < 1 || k > 2 ? -1 : 1), shade(pr.col, -0.25), cc, 0));
        mb.quad(ids2[0], ids2[1], ids[1], ids[0]); mb.quad(ids[3], ids[2], ids2[2], ids2[3]); mb.line(q[0], q[1], 0.6, 0.5); mb.line(q[3], q[2], 0.6, 0.5); }
      return;
    }
    const r0 = pr.r0, r1 = pr.r1; const thick = Math.max(r0, r1);
    const sides = thick > 2.5 ? 10 : thick > 1 ? 7 : 5;
    const pat = pr.style === 'bark' || pr.style === 'palm' ? PAT.grain : pr.style === 'drift' ? PAT.grain : 0;
    tube(mb, pr.pts, r0, r1, col, shade(hexOf(col), -0.35), pat, sides, thick > 1.4 ? shade(hexOf(col), 0.12) : false, thick < 0.5 ? 0.55 : 1);
    if ((pr.style === 'bark' || pr.style === 'palm') && thick > 1.5) { // a few bark marks
      const rng = JT.makeRng(JT.hashStr(String(g.id) + n + r0));
      for (let i = 0; i + 1 < n; i++) for (let q = 0; q < (pr.style === 'palm' ? 2 : 1); q++) { const t = rng(); const p = M.lerp3(pr.pts[i], pr.pts[i + 1], t); const d = M.norm(M.sub(pr.pts[i + 1], pr.pts[i])); const s = perp(d); const r = M.lerp(r0, r1, (i + t) / (n - 1)) * 1.02; const a = rng() * 6.28; const off = M.add(M.mul(s, Math.cos(a) * r), M.mul(M.cross(d, s), Math.sin(a) * r)); mb.line(M.add(p, off), M.add(M.add(p, off), M.mul(d, Math.min(3, r * 1.5))), 0.55, 0.45); }
    }
    if (pr.spots && thick > 0.9) { // lichen or ash blotches sitting on the bark
      const rng = JT.makeRng(JT.hashStr(String(g.id) + 'sp' + n + r0));
      for (let i = 0; i + 1 < n; i++) for (let q = 0; q < 3; q++) { if (rng() < 0.3) continue; const t = rng(); const p = M.lerp3(pr.pts[i], pr.pts[i + 1], t); const d = M.norm(M.sub(pr.pts[i + 1], pr.pts[i])); const s = perp(d); const r = M.lerp(r0, r1, (i + t) / (n - 1)); const a = rng() * 6.28;
        const nv = M.norm(M.add(M.mul(s, Math.cos(a)), M.mul(M.cross(d, s), Math.sin(a)))); const c = M.add(p, M.mul(nv, r * 0.9)); const rr = r * (0.4 + rng() * 0.45); const sd = M.norm(M.cross(nv, d));
        ell(mb, c, M.mul(d, rr * 1.4), M.mul(nv, Math.min(0.45, rr * 0.3)), M.mul(sd, rr * 0.9), shade(pr.spots, -0.1 + (rng() - 0.5) * 0.2), shade(pr.spots, 0.15), PAT.moss, null, 6, 2, true, 0.45); }
    }
  };
  // leaf outlines as half-width w(u) along the midrib (u 0..1)
  const LW = {
    oval: u => Math.pow(Math.sin(Math.PI * u), 0.85) * 0.78, lance: u => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 1.1) * 0.55,
    fat: u => Math.pow(Math.sin(Math.PI * u), 0.6) * 0.9, heart: u => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.7) * (0.9 + 0.2 * (1 - u)) * 0.85,
    round: u => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.55) * 0.95, ivy: u => (u < 0.3 ? u / 0.3 * 0.9 : u < 0.55 ? 0.9 - (u - 0.3) * 1.6 : 0.5 * (1 - u) / 0.45 * 1.0),
    oak: u => Math.sin(Math.PI * u) * (0.7 + 0.3 * Math.cos(u * 8 * 2.2)) * 0.95, chip: u => 0.75 + 0.15 * Math.sin(u * 7),
  };
  B.leaf = function (mb, pr, g) {
    const A = pr.a, Bv = pr.b; const L = M.len(A); if (L < 0.05) return; const wfn = LW[pr.shape] || LW.oval;
    let nrm = M.cross(A, Bv); if (M.len(nrm) < 1e-6) nrm = [0, 1, 0]; nrm = M.norm(nrm); if (nrm[1] < 0) nrm = M.mul(nrm, -1);
    const S = L > 6 ? 8 : L > 2.5 ? 6 : 4; const c0 = rgb(pr.col), c1 = pr.col2 ? rgb(pr.col2) : shade(pr.col, 0.08); const vein = pr.vein ? rgb(pr.vein) : shade(pr.col, 0.22);
    const cup = Math.min(0.35, L * 0.04); const f = TWO + (pr.stripe ? PAT.bands : 0); const mid = [], lft = [], rgt = [];
    const bend = M.mul(nrm, -L * 0.06); // tip droops a little
    const ub = M.norm(A), bb = M.len(Bv) > 1e-6 ? M.norm(Bv) : perp(ub);
    for (let k = 0; k <= S; k++) {
      const u = k / S; const w = wfn(u); const p = M.add(M.add(pr.o, M.mul(A, u)), M.mul(bend, u * u)); const col = mixc(c0, c1, u * 0.9);
      const tipO = k === S ? ub : k === 0 ? M.mul(ub, -1) : [0, 0, 0];
      mid.push(mb.vert(M.add(p, M.mul(nrm, -cup * w)), nrm, tipO, mixc(col, vein, 0.25), vein, f));
      const pl = M.add(M.add(p, M.mul(Bv, w)), M.mul(nrm, cup * w * 0.6)), prr = M.add(M.add(p, M.mul(Bv, -w)), M.mul(nrm, cup * w * 0.6));
      const nl = M.norm(M.add(nrm, M.mul(bb, -0.35))), nr = M.norm(M.add(nrm, M.mul(bb, 0.35)));
      const variegate = pr.variegate && k > S * 0.3 && k < S * 0.7 ? mixc(col, rgb(pr.variegate), 0.35) : col;
      lft.push(mb.vert(pl, nl, M.norm(M.add(bb, M.mul(tipO, 1))), variegate, vein, f)); rgt.push(mb.vert(prr, nr, M.norm(M.add(M.mul(bb, -1), M.mul(tipO, 1))), col, vein, f));
    }
    for (let k = 0; k < S; k++) { mb.quad(mid[k], mid[k + 1], lft[k + 1], lft[k]); mb.quad(mid[k], rgt[k], rgt[k + 1], mid[k + 1]); }
    if (L > 3) { const pts = []; for (let k = 0; k <= 4; k++) { const u = k / 4 * 0.92; pts.push(M.add(M.add(M.add(pr.o, M.mul(A, u)), M.mul(bend, u * u)), M.mul(nrm, 0.05))); } mb.polyline(pts, 0.5, 0.45, vein); }
    if (L > 9 && !pr.stripe) for (let k = 1; k <= 3; k++) { const u = k / 4.2; const p = M.add(M.add(pr.o, M.mul(A, u)), M.mul(bend, u * u)); for (const sd of [-1, 1]) mb.line(M.add(p, M.mul(nrm, 0.05)), M.add(M.add(M.add(p, M.mul(A, 0.1)), M.mul(Bv, sd * wfn(u) * 0.7)), M.mul(nrm, 0.05)), 0.35, 0.35, vein); }
  };
  B.bloom = function (mb, pr, g) {
    const o = pr.o, r = pr.r, k = pr.kind; const col = rgb(pr.col), col2 = pr.col2 ? rgb(pr.col2) : shade(pr.col, 0.3); const up = [0, 1, 0];
    const petal = (dir, len, wid, tiltUp, c, ink) => { // small flat petal from the centre outward
      const d = M.norm([dir[0], tiltUp, dir[2]]); const s = M.norm(M.cross(up, d)); const n = M.norm(M.cross(d, s)); const tip = M.add(o, M.mul(d, len));
      const m1 = M.add(M.add(o, M.mul(d, len * 0.5)), M.mul(s, wid)), m2 = M.add(M.add(o, M.mul(d, len * 0.5)), M.mul(s, -wid));
      const a = mb.vert(o, n, [0, 0, 0], shade(hexOf(c), -0.08), c, TWO), b = mb.vert(m1, n, M.mul(s, ink), c, c, TWO), cc = mb.vert(tip, n, M.mul(d, ink), shade(hexOf(c), 0.1), c, TWO), dd = mb.vert(m2, n, M.mul(s, -ink), c, c, TWO);
      mb.quad(a, b, cc, dd);
    };
    if (k === 'bud') { ell(mb, o, [r * 0.7, 0, 0], [0, r, 0], [0, 0, r * 0.7], col, shade(pr.col, 0.15), 0, null, 6, 4, false, 0.6); return; }
    if (k === 'cluster') { const rng = JT.makeRng(JT.hashStr(String(g.id) + o[0])); for (let i = 0; i < 7; i++) { const a = rng() * 6.28, d = rng() * r * 0.75; const c = [o[0] + Math.cos(a) * d, o[1] + rng() * r * 0.4, o[2] + Math.sin(a) * d]; const rr = r * 0.4; ell(mb, c, [rr, 0, 0], [0, rr * 0.8, 0], [0, 0, rr], shade(pr.col, (rng() - 0.5) * 0.25), col2, 0, null, 6, 3, true, 0.5); } return; }
    if (k === 'daisy' || k === 'dried') { const n = k === 'dried' ? 6 : 12; for (let i = 0; i < n; i++) { const a = i / n * 6.283; petal([Math.cos(a), 0, Math.sin(a)], r * 0.98, r * 0.17, 0.25, i % 2 ? col : shade(pr.col, 0.06), 0.5); } ell(mb, [o[0], o[1] + 0.15, o[2]], [r * 0.3, 0, 0], [0, r * 0.2, 0], [0, 0, r * 0.3], col2, col2, 0, null, 7, 3, true, 0.5); return; }
    if (k === 'poppy') { for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + 0.4; petal([Math.cos(a), 0, Math.sin(a)], r * 0.95, r * 0.5, 0.9, shade(pr.col, i % 2 ? -0.1 : 0.05), 0.8); } ell(mb, [o[0], o[1] + r * 0.15, o[2]], [r * 0.22, 0, 0], [0, r * 0.2, 0], [0, 0, r * 0.22], col2, col2, 0, null, 6, 3, false, 0.4); return; }
    if (k === 'orchid') { const fa = pr.ang || 0; const f = [Math.cos(fa), 0, Math.sin(fa)]; const s = M.norm(M.cross(up, f)); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 - 1.57; const d = M.add(M.mul(s, Math.cos(a)), M.mul(up, -Math.sin(a))); petal([d[0], 0, d[2]], r * 0.85, r * 0.3, d[1] * 1.5, col, 0.7); } ell(mb, M.add(o, M.mul(f, 0.3)), [r * 0.25, 0, 0], [0, r * 0.22, 0], [0, 0, r * 0.25], col2, col2, 0, null, 6, 3, false, 0.4); }
  };
  B.cap = function (mb, pr, g) {
    const o = pr.o, r = pr.r; const col = rgb(pr.col); const top = pr.glow ? rgb(typeof pr.glow === 'string' ? pr.glow : '#c8f0d0') : shade(pr.col, 0.25);
    const f = pr.glow ? GLOW : 0; const ry = pr.cone ? r * 0.95 : r * 0.42;
    if (pr.cone) { // conical cap
      const S = 10, ids = []; const apex = mb.vert([o[0], o[1] + ry, o[2]], [0, 1, 0], [0, 1, 0], top, col, f);
      for (let i = 0; i < S; i++) { const a = i / S * 6.283; const d = [Math.cos(a), 0, Math.sin(a)]; ids.push(mb.vert([o[0] + d[0] * r, o[1], o[2] + d[2] * r], M.norm([d[0], 0.7, d[2]]), d, col, col, f)); }
      for (let i = 0; i < S; i++) mb.tri(apex, ids[(i + 1) % S], ids[i]);
    } else ell(mb, o, [r, 0, 0], [0, ry, 0], [0, 0, r], col, top, f, null, 10, 4, true);
    disc(mb, [o[0], o[1] - 0.05, o[2]], [r * 0.95, 0, 0], [0, 0, r * 0.95], [0, -1, 0], shade(pr.col, -0.35), 0, 10, 0.3);
    if (pr.spots) { const sd = (o[0] * 7 + o[2] * 13) | 0; const w = rgb('#fff8e8'); for (let k = 0; k < 7; k++) { const a = ((sd + k * 47) % 100) / 100 * 6.283, b = 0.25 + ((sd * 3 + k * 61) % 100) / 100 * 0.6; const h = pr.cone ? (1 - b) : Math.sqrt(1 - b * b); const p = [o[0] + Math.cos(a) * r * b, o[1] + ry * h + 0.05, o[2] + Math.sin(a) * r * b]; const n = M.norm([Math.cos(a) * b, h, Math.sin(a) * b]); const u = M.norm(M.cross(n, [0, 0, 1])), v = M.cross(n, u); disc(mb, p, M.mul(u, r * 0.12), M.mul(v, r * 0.09), n, w, 0, 6, 0.2); } }
  };
  B.log = function (mb, pr, g) {
    const STY = JT.Draw.STY; const st = STY[pr.style] || STY.wood; const r = pr.r; const col = rgb(st.side);
    tube(mb, [pr.a, M.lerp3(pr.a, pr.b, 0.5), pr.b], r, r * 0.96, col, rgb(st.mark), STYP(pr.style) || PAT.grain, 12, rgb(st.top), 1);
    const ax = M.norm(M.sub(pr.b, pr.a)); const s = perp(ax), t = M.cross(ax, s);
    for (const [e, sg] of [[pr.a, -1], [pr.b, 1]]) { const c = M.add(e, M.mul(ax, sg * 0.05)); for (const rr of [0.4, 0.7]) { const pts = []; for (let k = 0; k <= 12; k++) { const a = k / 12 * 6.283; pts.push(M.add(c, M.add(M.mul(s, Math.cos(a) * r * rr), M.mul(t, Math.sin(a) * r * rr)))); } mb.polyline(pts, 0.5, 0.45); }
      if (pr.hollow) disc(mb, M.add(c, M.mul(ax, sg * 0.05)), M.mul(s, r * 0.7), M.mul(t, r * 0.7), M.mul(ax, sg), rgb('#160d06'), 0, 12, 0); }
    const rng = JT.makeRng(JT.hashStr(String(g.id) + 'log')); for (let k = 0; k < 7; k++) { const a = rng() * 6.28; const off = M.add(M.mul(s, Math.cos(a) * r * 1.01), M.mul(t, Math.sin(a) * r * 1.01)); const t0 = rng() * 0.6, t1 = t0 + 0.15 + rng() * 0.3; mb.line(M.add(M.lerp3(pr.a, pr.b, t0), off), M.add(M.lerp3(pr.a, pr.b, t1), off), 0.6, 0.45); }
  };
  B.pot = function (mb, pr) {
    const c = pr.o, r = pr.r, h = pr.h; const col = rgb(pr.col);
    tube(mb, [c, [c[0], c[1] + h * 0.5, c[2]], [c[0], c[1] + h, c[2]]], r * 0.8, r, col, shade(pr.col, -0.3), PAT.grain, 12, false);
    disc(mb, [c[0], c[1] + h - 0.3, c[2]], [r * 0.95, 0, 0], [0, 0, r * 0.95], [0, 1, 0], rgb('#3a2618'), 0, 12, 0);
    const pts = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * 6.283; pts.push([c[0] + Math.cos(a) * r, c[1] + h, c[2] + Math.sin(a) * r]); } mb.polyline(pts, 0.7, 0.6);
  };
  B.lampfoot = function (mb, pr) { tube(mb, [pr.o, [pr.o[0], pr.o[1] + 1, pr.o[2]]], pr.r, pr.r, rgb('#3a3026'), rgb('#2a2016'), 0, 10, rgb('#5a4a36')); };
  B.lamp = function (mb, pr, g) {
    const c = pr.o, r = pr.r; const on = g.lampOn !== false;
    ell(mb, [c[0], c[1] - r * 0.3, c[2]], [r, 0, 0], [0, r, 0], [0, 0, r], rgb('#5a4630'), rgb('#7a6444'), 0, null, 12, 4, true);
    disc(mb, [c[0], c[1] - r * 0.32, c[2]], [r * 0.92, 0, 0], [0, 0, r * 0.92], [0, -1, 0], on ? rgb('#f6dca0') : rgb('#3a3024'), on ? GLOW : 0, 12, 0.3);
    ell(mb, [c[0], c[1] - r * 0.45, c[2]], [r * 0.36, 0, 0], [0, r * 0.3, 0], [0, 0, r * 0.36], on ? rgb('#fff4d6') : rgb('#b8b0a2'), null, on ? GLOW : 0, null, 8, 4, false, 0.3);
  };
  B.tuft = function (mb, pr) {
    const n = pr.nv || [0, 1, 0]; const t1 = perp(n), t2 = M.cross(n, t1); const R = pr.r; const col = rgb(pr.col);
    const lob = (() => { const r = JT.makeRng(pr.seed || 1); const a = []; for (let k = 0; k < 6; k++) { const t = r() * 6.28, d = r() * 0.6; a.push([Math.cos(t) * d, Math.sin(t) * d * 0.8, 0.35 + r() * 0.35, (r() - 0.5) * 0.2]); } return a; })();
    ell(mb, pr.o, M.mul(t1, R), M.mul(n, R * 0.55), M.mul(t2, R), shade(pr.col, -0.15), col, PAT.moss, null, 8, 3, true);
    for (const b of lob) { const c = M.add(M.add(M.add(pr.o, M.mul(t1, b[0] * R)), M.mul(t2, b[1] * R)), M.mul(n, R * 0.25)); const rr = b[2] * R; ell(mb, c, M.mul(t1, rr), M.mul(n, rr * 0.8), M.mul(t2, rr), shade(pr.col, b[3]), shade(pr.col, 0.15 + b[3]), PAT.moss, null, 6, 3, true, 0.7); }
  };
  B.shelf = function (mb, pr) {
    const n = pr.nv, t = M.norm(M.cross([0, 1, 0], n)); const r = pr.r; const o = pr.o; const S = 12; const up = [0, 1, 0];
    const rings = [[1, shade(pr.col, 0)], [0.62, shade(pr.col, 0.25)], [0.3, shade(pr.col, 0.45)]];
    const pt = (a, k, dy) => M.add(M.add(M.add(o, M.mul(n, Math.sin(a) * r * k)), M.mul(t, Math.cos(a) * r * 1.15 * k)), [0, dy, 0]);
    const ids = rings.map(([k, c]) => { const row = []; for (let i = 0; i <= S; i++) { const a = i / S * Math.PI; row.push(mb.vert(pt(a, k, (1 - k) * r * 0.12), up, k === 1 ? M.norm(M.add(M.mul(n, Math.sin(a)), M.mul(t, Math.cos(a)))) : [0, 0, 0], c, c, 0)); } return row; });
    const cen = mb.vert(M.add(o, [0, r * 0.14, 0]), up, [0, 0, 0], shade(pr.col, 0.5), rings[2][1], 0);
    for (let j = 0; j < 2; j++) for (let i = 0; i < S; i++) mb.quad(ids[j][i], ids[j][i + 1], ids[j + 1][i + 1], ids[j + 1][i]);
    for (let i = 0; i < S; i++) mb.tri(cen, ids[2][i], ids[2][i + 1]);
    const under = []; for (let i = 0; i <= S; i++) under.push(mb.vert(pt(i / S * Math.PI, 1, -r * 0.28), [0, -1, 0], M.norm(M.add(M.mul(n, Math.sin(i / S * Math.PI)), [0, -0.5, 0])), shade(pr.col, -0.4), shade(pr.col, -0.4), 0));
    for (let i = 0; i < S; i++) mb.quad(ids[0][i], under[i], under[i + 1], ids[0][i + 1]);
  };
  B.moss = function (mb, pr, g) {
    const base = pr.kind === 'lichen' ? '#b8c4a0' : pr.kind === 'clover' ? '#4a8a3a' : pr.col;
    for (const b of pr.blobs) { const r = b[2]; const c = [b[0], g.baseY + 0.05, b[1]]; ell(mb, c, [r, 0, 0], [0, Math.min(1.6, r * 0.32), 0], [0, 0, r], shade(base, -0.2 + b[3]), shade(base, 0.12 + b[3]), PAT.moss, null, 8, 3, true, 0.6);
      if (pr.kind === 'clover') for (let k = 0; k < 3; k++) { const a = k * 2.09 + b[3] * 5; disc(mb, [b[0] + Math.cos(a) * r * 0.32, g.baseY + Math.min(1.6, r * 0.32) + 0.1, b[1] + Math.sin(a) * r * 0.32], [r * 0.3, 0, 0], [0, 0, r * 0.3], [0, 1, 0], shade(base, 0.1 + b[3]), 0, 7, 0.4); } }
  };
  B.pebble = function (mb, pr) {
    const r = pr.r, a = pr.ang || 0; const u = [Math.cos(a), 0, Math.sin(a)], w = [-Math.sin(a), 0, Math.cos(a)]; const col = rgb(pr.col);
    if (pr.kind === 'cones') { ell(mb, [pr.o[0], pr.o[1] + r * 0.4, pr.o[2]], M.mul(u, r * 1.3), [0, r * 0.6, 0], M.mul(w, r * 0.7), shade(pr.col, -0.15), shade(pr.col, 0.15), PAT.dots, null, 10, 4, false, 0.8); return; }
    const ry = pr.kind === 'pods' ? r * 0.45 : r * 0.55, rz = pr.kind === 'pods' ? r * 0.45 : r * 0.8;
    ell(mb, [pr.o[0], pr.o[1] + ry * 0.4, pr.o[2]], M.mul(u, r), [0, ry, 0], M.mul(w, rz), shade(pr.col, -0.1), shade(pr.col, 0.15), PAT.speck, null, 8, 4, false, r < 1.5 ? 0.5 : 0.8);
  };

  /** Build (or reuse) the mesh for one decor geometry. */
  function build(g) {
    if (g._mesh && g._mesh.lampOn === g.lampOn) return g._mesh;
    if (g._mesh && g._mesh.gl && g._mesh.vb) g._mesh.gl.free(g._mesh);
    const mb = new MB(g);
    for (const pr of g.prims) { const f = B[pr.t]; if (!f) continue; try { f(mb, pr, g); } catch (e) { if (JT.DEV) console.warn('mesh', pr.t, e); } }
    const verts = new Float32Array(mb.v); const idx = mb.n > 65000 ? new Uint32Array(mb.i) : new Uint16Array(mb.i);
    // ink strokes -> ribbon vertices (a, b, side/end, width, alpha, colour, sway a/b)
    const L = mb.lines; const lv = new Float32Array(L.length * 4 * 15); const li = (L.length * 4 > 65000 ? new Uint32Array(L.length * 6) : new Uint16Array(L.length * 6)); let o = 0;
    L.forEach((s, i) => { const [a, b, w, al, col] = s; const c = col || [0.16, 0.12, 0.09]; const wa = mb.sw(a), wb = mb.sw(b);
      for (const [sd, en] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { lv.set([a[0], a[1], a[2], b[0], b[1], b[2], sd, en, w, al, c[0], c[1], c[2], wa, wb], o); o += 15; }
      const k = i * 4; li.set([k, k + 1, k + 2, k, k + 2, k + 3], i * 6); });
    g._mesh = { verts, idx, n: mb.n, lines: lv, lidx: li, nl: L.length, lampOn: g.lampOn };
    return g._mesh;
  }
  JT.GLMesh = { build, rgb, STRIDE, PAT, TWO, GLOW, MB, ell, tube, disc };
})(typeof window !== 'undefined' ? window : globalThis);
