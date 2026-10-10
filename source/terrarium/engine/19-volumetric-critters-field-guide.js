/* Jumper Terrarium — volumetric critters ("field-guide plate" style with macro-photo touches).
   Every body part is a true 3D ellipsoid: its silhouette is the exact projection for the current
   camera, so nothing collapses to a line from the side or while climbing. Markings are decals that
   wrap the body surface, legs are tapered inked limbs, and detail scales with on-screen size (LOD). */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, D = JT.Draw;
  const LG = JT.LIGHT;
  // ---------- cached colour helpers (string work is expensive per frame) ----------
  const shc = new Map();
  const hex6 = (c) => c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
  function sh(c, a) { const k = c + a; let v = shc.get(k); if (v === undefined) { v = JT.shade(hex6(c), a); if (shc.size > 4000) shc.clear(); shc.set(k, v); } return v; }
  const mixc = new Map();
  function mix(a, b, t) { t = Math.round(t * 20) / 20; if (t <= 0) return hex6(a); const k = a + b + t; let v = mixc.get(k); if (v === undefined) { v = D.mix(hex6(a), hex6(b), t); if (mixc.size > 4000) mixc.clear(); mixc.set(k, v); } return v; }
  const ink = (c) => mix(sh(c, -0.62), '#1a1008', 0.35);

  // ---------- projection of ellipsoids ----------
  function projEll(V, ax, ay, az) {
    const a = V.J(ax), b = V.J(ay), c = az ? V.J(az) : [0, 0];
    const sxx = a[0] * a[0] + b[0] * b[0] + c[0] * c[0], syy = a[1] * a[1] + b[1] * b[1] + c[1] * c[1], sxy = a[0] * a[1] + b[0] * b[1] + c[0] * c[1];
    const m = (sxx + syy) / 2, d = Math.sqrt((sxx - syy) * (sxx - syy) / 4 + sxy * sxy);
    return { r1: Math.sqrt(m + d), r2: Math.sqrt(Math.max(1e-6, m - d)), ang: 0.5 * Math.atan2(2 * sxy, sxx - syy) };
  }
  /** Surface point of an ellipsoid whose normal points along dir. */
  function surfToward(c, ax, ay, az, dir) {
    const k0 = M.dot(ax, dir), k1 = M.dot(ay, dir), k2 = M.dot(az, dir); const l = Math.hypot(k0, k1, k2) || 1;
    return [c[0] + (ax[0] * k0 + ay[0] * k1 + az[0] * k2) / l, c[1] + (ax[1] * k0 + ay[1] * k1 + az[1] * k2) / l, c[2] + (ax[2] * k0 + ay[2] * k1 + az[2] * k2) / l];
  }
  let HV = [0, 1, 0], HVkey = '';
  function halfVec(V) { const k = V.yaw.toFixed(3) + V.pitch.toFixed(3) + LG[0].toFixed(3) + LG[2].toFixed(3); if (k !== HVkey) { HVkey = k; HV = M.norm(M.add(LG, V.toCam)); } return HV; }

  /** Shaded ellipsoid. o: {gloss, ink, fuzz, hatch, hair, sheen, lod, alpha} */
  function blob(ctx, V, c, ax, ay, az, col, o) {
    const P = V.P(c); const e = projEll(V, ax, ay, az); const R = e.r1; if (R < 0.35) return;
    const lod = o.lod;
    ctx.beginPath(); ctx.ellipse(P[0], P[1], R, Math.max(0.3, e.r2), e.ang, 0, 6.283);
    if (lod === 0 || R < 2) { ctx.fillStyle = col; ctx.fill(); return; }
    const hp = V.P(surfToward(c, ax, ay, az, LG));
    if (lod === 1 || R < 5) {
      ctx.fillStyle = sh(col, -0.22); ctx.fill();
      ctx.fillStyle = sh(col, 0.18); ctx.beginPath(); ctx.ellipse(M.lerp(P[0], hp[0], 0.45), M.lerp(P[1], hp[1], 0.45), R * 0.62, Math.max(0.3, e.r2 * 0.62), e.ang, 0, 6.283); ctx.fill();
    } else {
      const gx = M.lerp(P[0], hp[0], 0.7), gy = M.lerp(P[1], hp[1], 0.7);
      const g = ctx.createRadialGradient(gx, gy, R * 0.04, M.lerp(P[0], hp[0], 0.15), M.lerp(P[1], hp[1], 0.15), R * 1.22);
      g.addColorStop(0, sh(col, 0.34)); g.addColorStop(0.42, col); g.addColorStop(0.85, sh(col, -0.42)); g.addColorStop(1, sh(col, -0.25)); // last stop = bounce light on the rim
      ctx.fillStyle = g; ctx.fill();
    }
    if (o.hatch && R > 15) hatch(ctx, P, e, hp, col);
    if (o.sheen) sheen(ctx, P, e, V, o.sheen, o.time || 0);
    if (o.ink !== false && R > 2.5) { ctx.beginPath(); ctx.ellipse(P[0], P[1], R, Math.max(0.3, e.r2), e.ang, 0, 6.283); ctx.lineWidth = Math.max(0.45, Math.min(1.5, R * 0.065)); ctx.strokeStyle = ink(col); ctx.stroke(); }
    if (o.fuzz && R > 7) fuzz(ctx, P, e, o.fuzzCol || sh(col, 0.25), o.fuzz, R);
    if (o.gloss && R > 2.5) {
      const gp = V.P(surfToward(c, ax, ay, az, halfVec(V)));
      ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * o.gloss).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(gp[0], gp[1], Math.max(0.6, R * 0.16), Math.max(0.4, R * 0.09), e.ang, 0, 6.283); ctx.fill();
      if (R > 8) { ctx.fillStyle = 'rgba(255,255,255,' + (0.18 * o.gloss).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(gp[0], gp[1], R * 0.34, R * 0.2, e.ang, 0, 6.283); ctx.fill(); }
    }
    return e;
  }
  function hatch(ctx, P, e, hp, col) { // engraved shading lines on the shadow side
    ctx.save(); ctx.beginPath(); ctx.ellipse(P[0], P[1], e.r1, e.r2, e.ang, 0, 6.283); ctx.clip();
    const dx = P[0] - hp[0], dy = P[1] - hp[1]; const l = Math.hypot(dx, dy) || 1; const ux = dx / l, uy = dy / l; const R = e.r1;
    ctx.strokeStyle = ink(col); ctx.globalAlpha *= 0.32; ctx.lineWidth = Math.max(0.5, R * 0.025); ctx.beginPath();
    for (let k = -6; k <= 6; k++) { const off = k * R * 0.13; const bx = P[0] + ux * R * 0.35 - uy * off, by = P[1] + uy * R * 0.35 + ux * off; ctx.moveTo(bx - ux * R * 0.2 - uy * R * 0.2, by - uy * R * 0.2 + ux * R * 0.2); ctx.lineTo(bx + ux * R * 0.9 + uy * R * 0.25, by + uy * R * 0.9 - ux * R * 0.25); }
    ctx.stroke(); ctx.restore();
  }
  function sheen(ctx, P, e, V, kind, t) { // iridescence that shifts with viewing angle
    const h = ((V.yaw * 57 + (kind === 3 ? 290 : kind === 2 ? 200 : 140) + Math.sin(t * 0.7) * 25) % 360 + 360) % 360;
    ctx.save(); ctx.beginPath(); ctx.ellipse(P[0], P[1], e.r1, e.r2, e.ang, 0, 6.283); ctx.clip();
    const g = ctx.createLinearGradient(P[0] - e.r1, P[1] - e.r1, P[0] + e.r1, P[1] + e.r1);
    g.addColorStop(0, 'hsla(' + h + ',90%,60%,0)'); g.addColorStop(0.45, 'hsla(' + h + ',90%,62%,0.42)'); g.addColorStop(0.6, 'hsla(' + ((h + 60) % 360) + ',90%,65%,0.3)'); g.addColorStop(1, 'hsla(' + h + ',90%,60%,0)');
    ctx.fillStyle = g; ctx.fillRect(P[0] - e.r1, P[1] - e.r1, e.r1 * 2, e.r1 * 2); ctx.restore();
  }
  function fuzz(ctx, P, e, col, amt, R) { // hair fringe on the silhouette
    const ca = Math.cos(e.ang), sa = Math.sin(e.ang); const n = Math.min(30, 10 + (R | 0));
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, R * 0.03); ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const th = i / n * 6.283 + (i % 3) * 0.07; const x = Math.cos(th) * e.r1, y = Math.sin(th) * e.r2;
      const px = P[0] + x * ca - y * sa, py = P[1] + x * sa + y * ca; const len = R * amt * (0.1 + ((i * 7) % 5) * 0.025);
      const nx = (x / e.r1) * ca - (y / e.r2) * sa, ny = (x / e.r1) * sa + (y / e.r2) * ca; const l = Math.hypot(nx, ny) || 1;
      ctx.moveTo(px - nx / l * len * 0.5, py - ny / l * len * 0.5); ctx.lineTo(px + nx / l * len, py + ny / l * len);
    }
    ctx.stroke();
  }
  /** Tapered, inked limb along a 3D polyline. */
  function limb(ctx, V, pts, widths, col, lod, joints) {
    const S = pts.map(p => V.P(p)); const wpx = widths.map(w => w * V.s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (lod === 0 || wpx[0] < 1.1) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, wpx[0] * 0.9); ctx.beginPath(); ctx.moveTo(S[0][0], S[0][1]); for (let i = 1; i < S.length; i++) ctx.lineTo(S[i][0], S[i][1]); ctx.stroke(); return S; }
    const ik = ink(col);
    for (let i = 0; i < S.length - 1; i++) { ctx.strokeStyle = ik; ctx.lineWidth = wpx[i] + 1.1; ctx.beginPath(); ctx.moveTo(S[i][0], S[i][1]); ctx.lineTo(S[i + 1][0], S[i + 1][1]); ctx.stroke(); }
    for (let i = 0; i < S.length - 1; i++) { ctx.strokeStyle = i === 0 ? sh(col, 0.08) : col; ctx.lineWidth = wpx[i]; ctx.beginPath(); ctx.moveTo(S[i][0], S[i][1]); ctx.lineTo(S[i + 1][0], S[i + 1][1]); ctx.stroke(); }
    if (lod === 2 && wpx[0] > 2.2) { // highlight along the upper edge of thick segments
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = Math.max(0.5, wpx[0] * 0.28);
      ctx.beginPath(); ctx.moveTo(S[0][0], S[0][1] - wpx[0] * 0.2); ctx.lineTo(S[1][0], S[1][1] - wpx[0] * 0.2); ctx.stroke();
    }
    if (joints) { for (let i = 1; i < S.length - 1; i++) { if (!joints[i]) continue; ctx.fillStyle = joints[i]; ctx.beginPath(); ctx.arc(S[i][0], S[i][1], Math.max(0.5, wpx[i - 1] * 0.36), 0, 6.283); ctx.fill(); } }
    return S;
  }
  function curve(ctx, V, a, m, b, w, col) { const A = V.P(a), B = V.P(m), C = V.P(b); ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.4, w * V.s); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(B[0], B[1], C[0], C[1]); ctx.stroke(); }
  /** Flat membrane (wing) with veins: discs are physically flat, so they may legitimately go edge-on. */
  function wing(ctx, V, c, ax, ay, fill, edge, veins, lod) {
    const P = V.P(c); const e = projEll(V, ax, ay, null); if (e.r1 < 0.5) return;
    ctx.beginPath(); ctx.ellipse(P[0], P[1], e.r1, Math.max(0.35, e.r2), e.ang, 0, 6.283); ctx.fillStyle = fill; ctx.fill();
    if (lod > 0 && e.r1 > 3) {
      ctx.lineWidth = Math.max(0.4, e.r1 * 0.03); ctx.strokeStyle = edge; ctx.stroke();
      if (veins && e.r1 > 6) { const r0 = V.P(M.sub(c, ax)); ctx.beginPath(); for (let k = -2; k <= 2; k++) { const q = V.P(M.add(M.add(c, M.mul(ax, 0.75)), M.mul(ay, k * 0.38))); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(q[0], q[1]); } ctx.globalAlpha *= 0.7; ctx.stroke(); ctx.globalAlpha /= 0.7; }
    }
  }
  // ---------- surface decals (markings wrap around the body) ----------
  function Part(c, ax, ay, az) { return { c, ax, ay, az, la: M.len(ax), lb: M.len(ay), lc: M.len(az) }; }
  function surf(pt, u, v) { const w = Math.sqrt(Math.max(0, 1 - u * u - v * v)); return [pt.c[0] + pt.ax[0] * u + pt.ay[0] * v + pt.az[0] * w, pt.c[1] + pt.ax[1] * u + pt.ay[1] * v + pt.az[1] * w, pt.c[2] + pt.ax[2] * u + pt.ay[2] * v + pt.az[2] * w]; }
  function facing(pt, u, v, V) { const w = Math.sqrt(Math.max(0, 1 - u * u - v * v)); const a = u / (pt.la * pt.la), b = v / (pt.lb * pt.lb), c = w / (pt.lc * pt.lc); const n = [pt.ax[0] * a / 1 + pt.ay[0] * b + pt.az[0] * c, pt.ax[1] * a + pt.ay[1] * b + pt.az[1] * c, pt.ax[2] * a + pt.ay[2] * b + pt.az[2] * c]; return M.dot(n, V.toCam) / (M.len(n) || 1); }
  function decals(ctx, V, pt, list, cols, alpha) {
    for (const d of list) {
      const col = cols[d.c || 'mark'] || d.c; ctx.fillStyle = col; ctx.strokeStyle = col;
      if (d.t === 'dot') {
        const f = facing(pt, d.u, d.v, V); if (f < 0.02) continue; ctx.globalAlpha = alpha * Math.min(1, f * 4) * (d.a || 1);
        const w = Math.max(0.2, Math.sqrt(Math.max(0, 1 - d.u * d.u - d.v * d.v)));
        const t1 = M.add(pt.ax, M.mul(pt.az, -d.u / w)), t2 = M.add(pt.ay, M.mul(pt.az, -d.v / w));
        const k = d.r; const e = projEll(V, M.mul(M.norm(t1), k * pt.lb), M.mul(M.norm(t2), k * pt.lb), null); const P = V.P(surf(pt, d.u, d.v));
        ctx.beginPath(); ctx.ellipse(P[0], P[1], e.r1, Math.max(0.2, e.r2), e.ang, 0, 6.283); ctx.fill();
      } else if (d.t === 'line') {
        ctx.lineWidth = Math.max(0.5, d.w * pt.lb * V.s); ctx.lineCap = 'round'; let open = false, fmin = 1; ctx.beginPath();
        for (const q of d.p) { const f = facing(pt, q[0], q[1], V); if (f < 0.02) { open = false; continue; } fmin = Math.min(fmin, f); const P = V.P(surf(pt, q[0], q[1])); if (open) ctx.lineTo(P[0], P[1]); else ctx.moveTo(P[0], P[1]); open = true; }
        ctx.globalAlpha = alpha * Math.min(1, fmin * 4) * (d.a || 1); ctx.stroke();
      } else if (d.t === 'poly') {
        let fmin = 1; const S = []; for (const q of d.p) { const f = facing(pt, q[0], q[1], V); fmin = Math.min(fmin, f); S.push(V.P(surf(pt, q[0], q[1]))); }
        if (fmin < 0.02) continue; ctx.globalAlpha = alpha * Math.min(1, fmin * 4) * (d.a || 1); ctx.beginPath(); S.forEach((P, i) => i ? ctx.lineTo(P[0], P[1]) : ctx.moveTo(P[0], P[1])); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = alpha;
  }
  const band = (u, w, c, span, a) => { const m = Math.sqrt(Math.max(0, 1 - u * u)) * (span || 0.92); const p = []; for (let k = 0; k <= 6; k++) p.push([u, -m + 2 * m * k / 6]); return { t: 'line', p, w, c, a }; };
  const stripe = (v, w, c, u0, u1, a) => { const p = []; for (let k = 0; k <= 6; k++) { const u = (u0 != null ? u0 : -0.8) + ((u1 != null ? u1 : 0.8) - (u0 != null ? u0 : -0.8)) * k / 6; if (u * u + v * v < 0.97) p.push([u, v]); } return { t: 'line', p, w, c, a }; };
  const dot = (u, v, r, c, a) => ({ t: 'dot', u, v, r, c, a });
  // abdomen markings, u = toward the head
  const PAT = {
    bold: () => [{ t: 'poly', p: [[0.38, 0], [-0.08, 0.24], [-0.08, -0.24]] }, dot(-0.42, 0.3, 0.11), dot(-0.42, -0.3, 0.11), dot(-0.72, 0.16, 0.08), dot(-0.72, -0.16, 0.08), band(0.8, 0.14)],
    regal: () => [dot(0.2, 0, 0.18), dot(-0.25, 0.32, 0.12), dot(-0.25, -0.32, 0.12), band(-0.55, 0.07, 'mark', 0.4), band(-0.7, 0.07, 'mark', 0.32), band(-0.83, 0.07, 'mark', 0.25), band(0.8, 0.14)],
    canopy: () => [stripe(0.68, 0.16), stripe(-0.68, 0.16), dot(0.1, 0, 0.12)],
    zebra: () => [band(0.55, 0.15), band(0.13, 0.15), band(-0.29, 0.15), band(-0.71, 0.15)],
    graywall: () => [stripe(0, 0.34, 'dark'), stripe(0.75, 0.18), stripe(-0.75, 0.18)],
    pantropical: () => [stripe(0, 0.22), dot(-0.4, 0.4, 0.1), dot(-0.4, -0.4, 0.1)],
    arc: () => { const p = []; for (let a = 1.9; a <= 4.4; a += 0.25) p.push([0.5 + 0.75 * Math.cos(a), 0.75 * Math.sin(a)]); return [{ t: 'line', p, w: 0.18 }]; },
    emerald: () => [stripe(0.82, 0.18), stripe(-0.82, 0.18)],
    peacock: () => [dot(0.1, 0, 0.55, '#e8501e'), dot(-0.3, 0, 0.36, '#3ad0c0'), dot(0.35, 0, 0.12, '#f0c030')],
    twinflag: () => [dot(-0.55, 0.3, 0.17), dot(-0.55, -0.3, 0.17), band(0.7, 0.2)],
    putnam: () => [0, 1, 2, 3, 4].map(k => dot(0.4 - k * 0.25, (k % 2 ? 1 : -1) * 0.3, 0.09)),
    red: () => [0, 1, 2].map(k => ({ t: 'line', p: [[-0.1 - k * 0.3, -0.4], [-0.3 - k * 0.3, 0], [-0.1 - k * 0.3, 0.4]], w: 0.08, c: 'dark', a: 0.5 })).concat([dot(0.5, 0, 0.12)]),
    johnson: () => [stripe(0, 0.32, '#141414')],
    imperial: () => [stripe(0, 0.42, '#1a120c', -0.85, 0.75, 0.9), band(0.42, 0.1, 'mark', 0.42), band(0.12, 0.1, 'mark', 0.42), band(-0.18, 0.1, 'mark', 0.4), band(-0.48, 0.09, 'mark', 0.36), stripe(0.82, 0.1, 'mark', -0.5, 0.6, 0.6), stripe(-0.82, 0.1, 'mark', -0.5, 0.6, 0.6)],
    magnolia: () => [dot(0.1, -0.2, 0.45, '#ffffff', 0.2)],
    ant: () => [],
    paradise: () => [stripe(0.62, 0.15), stripe(-0.62, 0.15), stripe(0, 0.14)],
    giant: () => [0.55, 0.17, -0.21, -0.59].map(u => band(u, 0.1, 'mark', 0.92, 0.8)),
    portia: (rng) => { const o = []; for (let k = 0; k < 8; k++) o.push(dot(rng() * 1.4 - 0.7, rng() * 1.2 - 0.6, 0.12 + rng() * 0.1, 'dark', 0.45)); for (let k = 0; k < 5; k++) o.push(dot(rng() * 1.2 - 0.6, rng() * 1.0 - 0.5, 0.07)); return o; },
  };
  PAT.orange = PAT.regal;
  // v11 hybrids
  PAT.auralis = () => [stripe(0.82, 0.16), stripe(-0.82, 0.16), dot(0.2, 0, 0.26, '#f0a040'), dot(-0.25, 0.25, 0.12, '#3ad0c0'), dot(-0.25, -0.25, 0.12, '#e8501e')];
  PAT.hyalina = () => [dot(0.1, -0.2, 0.45, '#ffffff', 0.25), stripe(0, 0.08, 'mark', -0.6, 0.6, 0.35)];
  PAT.ignicard = () => PAT.red().concat([[0.45, 0.35], [0.1, -0.45], [-0.25, 0.5], [-0.55, -0.2], [0.25, 0.05], [-0.7, 0.35], [-0.05, 0.25], [0.6, -0.25]].map(([u, v]) => dot(u, v, 0.07, '#ffc060', 0.95)));
  PAT.titanica = (rng) => PAT.portia(rng).concat([0.45, 0.05, -0.35].map(u => band(u, 0.08, 'mark', 0.85, 0.55)));
  PAT.saltator = () => [band(0.6, 0.16), band(0.18, 0.16), band(-0.26, 0.16), band(-0.68, 0.14), dot(0.86, 0, 0.12, '#d03a2a')];
  const patCache = {};
  function patFor(S, seed) { const k = S.pattern + (S.pattern === 'portia' || S.pattern === 'titanica' ? seed : ''); return patCache[k] || (patCache[k] = (PAT[S.pattern] || (() => []))(JT.makeRng(seed || 7))); }
  const CEPH_PAT = { zebra: 1, graywall: 1, paradise: 1, pantropical: 1, saltator: 1 };

  function lodFor(px, o) { return o.thumb ? 2 : px < 9 ? 0 : px < 32 ? 1 : 2; }
  function castShadow(ctx, V, p, f, s, n, L, h, alpha, wk) {
    wk = wk || 1;
    // soft contact shadow + a longer shadow cast away from the light along the support surface
    const Lt = M.sub(LG, M.mul(n, M.dot(LG, n))); const ln = Math.max(0.35, M.dot(LG, n));
    let off = M.mul(Lt, -h / ln); const ol = M.len(off); if (ol > L * 0.7) off = M.mul(off, L * 0.7 / ol);
    const sc = M.add(p, off); const e = projEll(V, M.mul(f, L * 0.5 + ol * 0.35), M.mul(s, L * 0.38 * wk), null); const P = V.P(sc);
    ctx.fillStyle = 'rgba(12,8,4,' + (0.16 * alpha * (0.25 + 0.75 * JT.SKY.kd)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(P[0], P[1], e.r1, Math.max(0.3, e.r2), e.ang, 0, 6.283); ctx.fill();
    const e2 = projEll(V, M.mul(f, L * 0.36), M.mul(s, L * 0.26 * wk), null); const P2 = V.P(p);
    ctx.fillStyle = 'rgba(12,8,4,' + (0.22 * alpha).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(P2[0], P2[1], e2.r1, Math.max(0.3, e2.r2), e2.ang, 0, 6.283); ctx.fill();
  }
  function sortDraw(parts) { parts.sort((a, b) => b.d - a.d); for (const q of parts) q.f(); }

  // ---------- species hair helpers (all screen-space, one path per call) ----------
  /** Hairs along a projected segment A→B, alternating sides, angled toward the tip. */
  function hairs(ctx, A, B, w, n, len, col, lw, tilt, seed) {
    const dx = B[0] - A[0], dy = B[1] - A[1]; const l = Math.hypot(dx, dy) || 1; const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, sd = k % 2 ? 1 : -1; const bx = A[0] + dx * t + nx * sd * w * 0.42, by = A[1] + dy * t + ny * sd * w * 0.42;
      const ll = len * (0.72 + ((k * 7 + seed) % 5) * 0.11); ctx.moveTo(bx, by); ctx.lineTo(bx + (nx * sd + ux * tilt) * ll, by + (ny * sd + uy * tilt) * ll);
    }
    ctx.stroke();
  }
  /** Radial puff of hair around a screen point (fluffy palps). */
  function puff(ctx, P, r, col, n, lw) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    for (let k = 0; k < n; k++) { const a = k / n * 6.283 + (k % 3) * 0.2; const r0 = r * 0.55, r1 = r * (1.25 + (k % 4) * 0.12); ctx.moveTo(P[0] + Math.cos(a) * r0, P[1] + Math.sin(a) * r0); ctx.lineTo(P[0] + Math.cos(a) * r1, P[1] + Math.sin(a) * r1); }
    ctx.stroke();
  }
  /** Tufts sticking out of a body part along a 3D direction: [u, v, dir, len] with dir in world space. */
  function tuftSet(ctx, V, pt, list, col, lw, curl) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath();
    for (const [u, v, d, len] of list) {
      const a = surf(pt, u, v); const b = M.add(a, M.mul(d, len)); const A = V.P(a), B = V.P(b);
      if (curl) { const m = V.P(M.add(M.lerp3(a, b, 0.5), M.mul(curl, len * 0.35))); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(m[0], m[1], B[0], B[1]); }
      else { ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }
    }
    ctx.stroke();
  }
  /** Head tufts per species: eyebrow tufts, imperial "horns", giant "eyelashes", Portia's ragged tufts. */
  function headTufts(ctx, V, cph, LK, L, px, fg, sg, nh, pal) {
    const kind = LK.tufts; const lw = (k) => Math.max(0.5, L * V.s * k);
    if (kind === 'brow' && px > 22) {
      const l = []; for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const d = M.norm(M.add(M.add(M.mul(nh, 1), M.mul(fg, 0.25 + 0.1 * k)), M.mul(sg, sd * (0.3 + 0.08 * k)))); l.push([0.74 - 0.05 * k, sd * (0.32 + 0.09 * k), d, L * (0.06 + 0.012 * (k % 2 ? 1 : 2))]); }
      tuftSet(ctx, V, cph, l, LK.tuftCol || '#15100b', lw(0.007), fg);
    } else if (kind === 'horn' && px > 12) {
      const l = []; for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const d = M.norm(M.add(M.add(nh, M.mul(sg, sd * (0.45 + 0.1 * k))), M.mul(fg, 0.2 - 0.12 * k))); l.push([0.6 - 0.04 * k, sd * (0.68 + 0.03 * k), d, L * (0.13 - 0.02 * k)]); }
      tuftSet(ctx, V, cph, l, LK.tuftCol || '#120c08', lw(0.016), null);
    } else if (kind === 'lash' && px > 20) {
      const l = []; for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { const d = M.norm(M.add(M.add(M.mul(fg, 0.85), M.mul(nh, 0.75)), M.mul(sg, sd * 0.15 * k))); l.push([0.8 - 0.035 * k, sd * (0.22 + 0.1 * k), d, L * (0.12 + 0.015 * (k % 3))]); }
      tuftSet(ctx, V, cph, l, LK.tuftCol || '#e8dcc4', lw(0.006), M.mul(nh, -1));
    } else if (kind === 'ragged' && px > 14) {
      const l = [], l2 = []; for (const sd of [-1, 1]) { for (const [u, v] of [[0.55, 0.62], [0.1, 0.75], [-0.35, 0.65]]) { const d = M.norm(M.add(M.mul(sg, sd * 0.8), M.mul(nh, 0.7))); l.push([u, sd * v, d, L * 0.06]); } l2.push([0.25, sd * 0.4, M.norm(M.add(nh, M.mul(sg, sd * 0.4))), L * 0.05]); }
      tuftSet(ctx, V, cph, l, LK.tuftCol || '#2a1e14', lw(0.016), null); tuftSet(ctx, V, cph, l2, sh(pal.hair, 0.25), lw(0.012), null);
    }
  }

  // ============================== JUMPING SPIDER ==============================
  D.spider = function (ctx, V, sp, fr, o) {
    const S = JT.SPECIES_BY_ID[sp.species] || JT.SPECIES[0]; const pal0 = o.palette || S.pal; const L = o.len;
    let { f, s, n } = fr; let p = fr.p; const t = o.time || 0;
    const LK = S.look || {}; const gait = LK.gait; const gp = sp._gPause || 0;
    // species gait offsets (visual only): ant mimics weave in zig-zags, magnolia greens sway and twitch
    if (!o.thumb && !o.airborne && !o.curled && !o.tucked && !o.hug && !o.meal) {
      let lat = 0, ang = 0;
      const zk = sp._zigK || 0; if (zk > 0.01) { const ph = (sp._walk || 0) * 0.55 + ((sp.seed || 1) % 7); lat += L * 0.18 * Math.sin(ph) * zk; ang += Math.atan(0.31 * Math.cos(ph)) * zk; }
      if (gait === 'twitchy') { lat += L * (0.015 * Math.sin(t * 1.7 + (sp.seed || 0)) + 0.012 * gp * Math.sin(t * 13)); ang += 0.05 * gp * Math.sin(t * 9.3); }
      if (lat || ang) { const ca = Math.cos(ang), sa = Math.sin(ang); const f2 = M.add(M.mul(f, ca), M.mul(s, sa)), s2 = M.sub(M.mul(s, ca), M.mul(f, sa)); f = f2; s = s2; p = M.add(p, M.mul(fr.s, lat)); }
    }
    const paleK = o.ghost ? 0.72 : (sp.soft > 0 ? Math.min(0.6, sp.soft / 120 * 0.65) : 0);
    const C = (c) => paleK > 0 ? mix(c, '#efe6d6', paleK) : hex6(c);
    const pal = {}; for (const k in pal0) pal[k] = C(pal0[k]);
    const px = L * V.s; const lod = lodFor(px, o); const alpha = (o.alpha != null ? o.alpha : 1) * (S.translucent ? 0.9 : 1) * (o.ghost ? 0.85 : 1);
    ctx.globalAlpha = alpha;
    const crouch = sp._crouch || 0, raise = sp._legRaise || 0, moving = sp._moving ? 1 : 0;
    const breath = Math.sin(sp._breath || 0) * 0.015; const ant = !!S.antShape;
    const flat = sp._flat || 0, strK = sp._stretchK || 0, wipe = sp._wipe || 0, flick = sp._flick || 0, hang = o.hang || 0;
    const wph = (sp._walk || 0) * Math.PI; const bob = moving && !o.airborne ? Math.abs(Math.sin(wph)) * (gait === 'bouncy' ? 0.03 : gait === 'hop' ? 0.022 : gait === 'heavy' ? 0.01 : gait === 'stopgo' ? 0.012 : 0) : 0;
    const gripK = o.grip && !o.airborne && !o.curled && !o.tucked && !o.thumb ? o.grip.k : 0; // belly hugs a thin stem
    const h0 = (1 - 0.3 * gripK) * L * (0.14 - 0.07 * crouch) * (1 - 0.42 * flat) * (1 - 0.45 * (LK.flat || 0)) + L * 0.035 * strK + L * bob;
    const W = (u, v, w) => [p[0] + f[0] * u + s[0] * v + n[0] * w, p[1] + f[1] * u + s[1] * v + n[1] * w, p[2] + f[2] * u + s[2] * v + n[2] * w];
    if (!o.airborne && !o.noShadow) castShadow(ctx, V, p, f, s, n, L, h0 + L * 0.12, alpha);
    const under = M.dot(n, V.toCam) < -0.05 && !o.thumb; // seen from below: belly colours
    const fat = (sp._fatNow != null ? M.clamp(sp._fatNow, 0.66, 1.28) : M.clamp(0.85 + (sp.sat != null ? sp.sat : 0.7) * 0.34, 0.85, 1.2)) * (1 + breath);
    // head turns independently: gaze + an occasional curious look at the camera ("selfie glance")
    let gz = (sp._gazeNow || 0) * 0.3;
    if (o.lookCam) { const cf = M.sub(V.toCam, M.mul(n, M.dot(V.toCam, n))); if (M.len(cf) > 0.2) { const c2 = M.norm(cf); const a = Math.atan2(M.dot(c2, s), M.dot(c2, f)); if (Math.abs(a) < 1.6) gz = M.lerp(gz, M.clamp(a, -0.55, 0.55), o.lookCam); } }
    const fg = M.norm(M.add(M.mul(f, Math.cos(gz)), M.mul(s, Math.sin(gz)))); let sg = M.norm(M.cross(n, fg)); let nh = n;
    // curious head tilt toward a close, still camera: roll the carapace a little about its long axis
    if (o.tilt > 0.01) { const sgn = M.dot(sg, V.toCam) >= 0 ? 1 : -1; const ra = 0.3 * o.tilt * sgn; const cr = Math.cos(ra), sr = Math.sin(ra); const sg2 = M.norm(M.add(M.mul(sg, cr), M.mul(n, sr))); nh = M.norm(M.sub(M.mul(n, cr), M.mul(sg, sr))); sg = sg2; }
    const stalk = ['stalk', 'creep', 'crouch'].includes(sp.state) ? 0.22 : sp.state === 'display' ? 0.35 : 0.05;
    const parts = [];
    const bodyCol = (c, belly) => under ? mix(c, belly, 0.75) : c;
    // --- cephalothorax (+ eyes) ---
    const cL = ant ? 1 : LK.cL || 1, cW = ant ? 1 : LK.cW || 1, cH = ant ? 1 : LK.cH || 1, dF = (cL - 1) * 0.375 * L; // dF: how far the face moves forward
    const cc = W((0.13 + 0.125 * (cL - 1)) * L, 0, h0 + L * (ant ? 0.06 : 0.1 * cH));
    const cph = Part(cc, M.mul(fg, L * (ant ? 0.2 : 0.25 * cL)), M.mul(sg, L * (ant ? 0.115 : 0.2 * cW)), M.mul(nh, L * (ant ? 0.1 : 0.15 * cH)));
    parts.push({ d: V.depth(cc), f: () => {
      blob(ctx, V, cph.c, cph.ax, cph.ay, cph.az, bodyCol(pal.ceph, pal.belly), { lod, gloss: S.pattern === 'ant' || S.pattern === 'johnson' ? 0.8 : 0.45, fuzz: lod === 2 && !ant ? (LK.fuzz != null ? LK.fuzz : 0.9) : 0, fuzzCol: pal.hair, hatch: lod === 2, sheen: S.pattern === 'emerald' ? 1 : 0, time: t });
      if (lod > 0 && !under) {
        const dk = sh(pal.ceph, -0.45);
        decals(ctx, V, cph, [{ t: 'poly', p: [[0.98, -0.2], [0.55, -0.62], [0.5, 0], [0.55, 0.62], [0.98, 0.2]], c: dk, a: 0.55 }].concat(CEPH_PAT[S.pattern] ? [stripe(0.82, 0.32, 'mark', -0.6, 0.7, 0.85), stripe(-0.82, 0.32, 'mark', -0.6, 0.7, 0.85)] : []).concat(S.pattern === 'magnolia' ? [dot(0.6, 0, 0.32, '#e05a3a')] : []), { mark: pal.mark, dark: dk }, alpha);
      }
      // eyes: big anterior medians (with catch-lights), laterals, posteriors
      const ae = 0.088 * (S.len < 6 ? 1.15 : 1) * (LK.eye || 1) / Math.sqrt(cL * cW); const eyes = [[0.93, 0.3, ae, 1], [0.93, -0.3, ae, 1], [0.8, 0.7, 0.032, 0], [0.8, -0.7, 0.032, 0], [-0.3, 0.82, 0.028, 0], [-0.3, -0.82, 0.028, 0]];
      for (const [u, v, r, big] of eyes) {
        const fc = facing(cph, u, v, V); if (fc < -0.15) continue;
        const ep = surf(cph, u, v); const P = V.P(ep); const rr = r * L * V.s; if (rr < 0.45) continue;
        ctx.globalAlpha = alpha * M.clamp((fc + 0.15) * 4, 0, 1);
        if (rr < 1.4) { ctx.fillStyle = '#050403'; ctx.beginPath(); ctx.arc(P[0], P[1], rr, 0, 6.283); ctx.fill(); continue; }
        const g = ctx.createRadialGradient(P[0], P[1], rr * 0.1, P[0], P[1], rr); g.addColorStop(0, big ? (LK.eyeCol || '#2a1c12') : '#120c08'); g.addColorStop(0.55, '#0a0705'); g.addColorStop(1, '#000');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P[0], P[1], rr, 0, 6.283); ctx.fill();
        if (big && rr > 2.5) { ctx.strokeStyle = LK.eyeCol ? 'rgba(190,130,60,0.55)' : 'rgba(120,90,60,0.35)'; ctx.lineWidth = Math.max(0.5, rr * 0.12); ctx.beginPath(); ctx.arc(P[0], P[1], rr * 0.62, 0, 6.283); ctx.stroke(); }
        const gp = V.J(M.mul(M.norm(M.add(LG, V.toCam)), r * L * 0.55)); const shine = big ? 0.92 : 0.7;
        if (big && rr > 2 && JT.HD2D && JT.HD2D.on && JT.HD2D.cup) { ctx.fillStyle = '#070504'; ctx.beginPath(); ctx.arc(P[0], P[1], rr, 0, 6.283); ctx.fill(); JT.HD2D.pie(ctx, P[0], P[1], rr, Math.atan2(gp[1], gp[0]) || -2.3); continue; }
        ctx.fillStyle = 'rgba(255,255,255,' + shine + ')'; ctx.beginPath(); ctx.arc(P[0] + gp[0], P[1] + gp[1], Math.max(0.5, rr * (big ? 0.32 : 0.35)), 0, 6.283); ctx.fill();
        if (big && rr > 2) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(P[0] - gp[0] * 0.7, P[1] - gp[1] * 0.7 + rr * 0.15, Math.max(0.4, rr * 0.13), 0, 6.283); ctx.fill(); }
      }
      ctx.globalAlpha = alpha;
      if (LK.tufts && lod > 0 && !under) headTufts(ctx, V, cph, LK, L, px, fg, sg, nh, pal);
    } });
    if (ant) { const nc = W(-0.08 * L, 0, h0 + L * 0.05); parts.push({ d: V.depth(nc), f: () => blob(ctx, V, nc, M.mul(f, L * 0.07), M.mul(s, L * 0.055), M.mul(n, L * 0.055), pal.ceph, { lod, gloss: 0.7 }) }); }
    // --- abdomen (raised while stalking, plump when fed) ---
    // spinning a retreat: abdomen tipped down so the spinnerets touch the surface, swaying with each hind-leg pull
    const spin = o.spin ? 1 : 0, spw = spin ? Math.sin(t * 4.2) : 0;
    const ta = stalk + crouch * 0.1 - (sp._prepT > 0 ? 0.28 : 0) - flat * 0.06 - 0.42 * spin; let af = M.add(M.mul(f, Math.cos(ta)), M.mul(n, Math.sin(ta))); const an = M.sub(M.mul(n, Math.cos(ta)), M.mul(f, Math.sin(ta)));
    if (spin) af = M.norm(M.add(af, M.mul(s, spw * 0.16)));
    const aL = ant ? 1 : LK.aL || 1, aW = ant ? 1 : LK.aW || 1, aH = ant ? 1 : LK.aH || 1;
    const ac = M.add(W(ant ? -0.33 * L : -(0.27 + 0.24 * (aL - 1) + 0.125 * (cL - 1)) * L, 0, h0 + L * 0.09 * (0.6 + 0.4 * aH)), M.mul(an, L * 0.02));
    const abd = Part(ac, M.mul(af, L * (ant ? 0.23 : 0.3 * aL) * (0.95 + fat * 0.05)), M.mul(s, L * (ant ? 0.13 : 0.22 * aW) * fat), M.mul(an, L * (ant ? 0.13 : 0.19 * aH) * fat));
    parts.push({ d: V.depth(ac), f: () => {
      blob(ctx, V, abd.c, abd.ax, abd.ay, abd.az, bodyCol(pal.abd, pal.belly), { lod, gloss: ant ? 0.9 : 0.6, fuzz: lod === 2 && !ant ? (LK.fuzz != null ? LK.fuzz * 1.1 : 1) : 0, fuzzCol: pal.hair, hatch: lod === 2, sheen: S.sheen != null ? S.sheen : S.pattern === 'emerald' ? 1 : S.pattern === 'peacock' ? 2 : 0, time: t });
      if (lod > 0 && !under) decals(ctx, V, abd, patFor(S, sp.seed), { mark: pal.mark, dark: sh(pal.abd, -0.5) }, alpha);
      if (LK.tufts === 'ragged' && lod > 0 && px > 14 && !under) { // debris-like tufts break up the outline
        const l = [], l2 = []; for (const sd of [-1, 1]) { for (const [u, v] of [[0.45, 0.75], [-0.1, 0.85], [-0.6, 0.65]]) l.push([u, sd * v, M.norm(M.add(M.mul(s, sd), M.mul(an, 0.5))), L * 0.07]); l2.push([-0.2, sd * 0.35, M.norm(M.add(an, M.mul(af, -0.3))), L * 0.06]); }
        l.push([-0.92, 0, M.norm(M.add(M.mul(af, -1), M.mul(an, 0.6))), L * 0.07]);
        tuftSet(ctx, V, abd, l, LK.tuftCol || '#2a1e14', Math.max(0.5, L * V.s * 0.018), null); tuftSet(ctx, V, abd, l2, sh(pal.mark, 0.1), Math.max(0.5, L * V.s * 0.016), null);
      }
      if (lod > 0 && under) decals(ctx, V, { c: abd.c, ax: abd.ax, ay: abd.ay, az: M.mul(abd.az, -1), la: abd.la, lb: abd.lb, lc: abd.lc }, [dot(-0.85, 0, 0.14, 'dark'), stripe(0, 0.12, 'dark', -0.6, 0.5, 0.4)], { dark: sh(pal.belly, -0.4) }, alpha);
    } });
    // peacock courtship fan (a flat flap: physically thin, so it may go edge-on)
    if ((S.pattern === 'peacock' || S.fan) && sp.state === 'display' && !under) {
      const fc = M.add(ac, M.mul(an, L * 0.22)); parts.push({ d: V.depth(fc) - 0.05, f: () => {
        wing(ctx, V, fc, M.mul(s, L * 0.42), M.add(M.mul(an, L * 0.28), M.mul(af, -L * 0.06)), S.fan ? S.fan[0] : '#2a5ad0', S.fan ? S.fan[1] : '#10204a', false, lod);
        if (S.fan) decals(ctx, V, { c: fc, ax: M.mul(an, L * 0.28), ay: M.mul(s, L * 0.42), az: M.mul(af, -L * 0.05), la: L * 0.28, lb: L * 0.42, lc: L * 0.05 }, [dot(0.55, 0, 0.16, '#e83a3a'), dot(0.3, 0.42, 0.14, '#f09a20'), dot(0.3, -0.42, 0.14, '#f0e040'), dot(-0.1, 0.55, 0.13, '#3ad06a'), dot(-0.1, -0.55, 0.13, '#3ab0f0'), dot(-0.45, 0, 0.15, '#9a5ae0')], {}, alpha);
        const pf = Part(fc, M.mul(s, L * 0.42), M.add(M.mul(an, L * 0.28), M.mul(af, -L * 0.06)), M.mul(af, L * 0.02));
        decals(ctx, V, { c: fc, ax: M.mul(an, L * 0.28), ay: M.mul(s, L * 0.42), az: M.mul(af, -L * 0.05), la: L * 0.28, lb: L * 0.42, lc: L * 0.05 }, [dot(0.3, 0, 0.32, '#e8501e'), dot(-0.25, 0, 0.22, '#3ad0c0'), dot(0.05, 0, 0.1, '#f0c030')], {}, alpha); void pf;
      } });
    }
    // --- chelicerae (iridescent) + palps ---
    for (const sd of [-1, 1]) {
      const ck = LK.chel || 1;
      const chc = M.add(W(0.33 * L + dF, sd * L * 0.055 * Math.sqrt(ck), h0 + L * 0.02), M.mul(fg, L * 0.04 * ck));
      parts.push({ d: V.depth(chc) - 0.01, f: () => blob(ctx, V, chc, M.mul(fg, L * 0.05 * ck), M.mul(sg, L * 0.045 * Math.sqrt(ck)), M.mul(n, L * 0.07 * ck), pal.chel, { lod, gloss: 1, sheen: LK.irid || 0, time: t }) });
      let pw = (sp.state === 'groom' || wipe > 0.2 ? Math.sin(t * 12 + sd) * 0.04 : Math.sin(t * 3 + sd * 2) * 0.01) * L;
      let fl = flick * Math.sin(flick * 9.4 + sd * 0.8) * L * 0.06; // quick alternating palp flicks
      if (LK.palp === 'flag') pw += gp * Math.sin(t * 8 + sd * 1.3) * L * 0.05; // twin-flagged: waves its white palps in each pause
      if (sp.state === 'semaphore') { fl += L * 0.1 * Math.sin(t * 7 + (sd > 0 ? 0 : Math.PI)); pw += L * 0.03; } // house jumper: palps flashed up and down in turn
      if (gait === 'choppy') { const jk = Math.sin(t * 4.2 + sd * 2.1 + (sp.seed || 0)); fl += L * 0.05 * Math.sign(jk) * Math.min(1, Math.abs(jk) * 4); } // Portia: palps jerk up and down
      const a = W(0.3 * L + dF, sd * L * 0.09, h0 + L * 0.02), b = M.add(W(0.45 * L + dF + pw, sd * L * 0.1, h0 + L * 0.06 + Math.abs(fl)), M.mul(fg, L * 0.02)), c = M.add(W(0.5 * L + dF + pw - Math.abs(fl) * 0.5, sd * L * 0.09, h0 + L * 0.0 + fl), M.mul(fg, L * 0.02));
      const pk = LK.palp || 'plain', pc = LK.palpCol || pal.hair;
      parts.push({ d: V.depth(b) - 0.02, f: () => {
        limb(ctx, V, [a, b, c], [L * 0.04, L * 0.036], pal.leg, lod, null);
        if (pk === 'flag') { limb(ctx, V, [M.lerp3(b, c, 0.15), c], [L * 0.055], pc, lod, null); blob(ctx, V, c, M.mul(fg, L * 0.045), M.mul(sg, L * 0.04), M.mul(n, L * 0.045), pc, { lod, ink: false, gloss: 0.3 }); return; }
        if (lod === 0) return;
        const r = pk === 'pompom' ? 0.065 : pk === 'fluffy' ? 0.045 : 0.035;
        blob(ctx, V, c, M.mul(fg, L * r), M.mul(sg, L * r * 0.88), M.mul(n, L * r * 0.88), pc, { lod, ink: pk === 'pompom' });
        const rr = r * L * V.s; if ((pk === 'pompom' || pk === 'fluffy') && rr > 2) puff(ctx, V.P(c), rr, pk === 'pompom' ? sh(pc, 0.15) : pc, pk === 'pompom' ? 14 : 9, Math.max(0.5, rr * 0.12));
      } });
    }
    // --- 8 legs: coxa→femur→tibia→tarsus, tapered and inked; front legs stout ---
    const dorsal = M.dot(n, V.toCam) > 0.45;
    const AU = [0.22, 0.17, 0.11, 0.05], FU = ant ? [0.55, 0.3, -0.12, -0.45] : [0.62, 0.3, -0.16, -0.5], FV = [0.42, 0.56, 0.57, 0.47];
    const ring = (S.pattern === 'bold' || S.pattern === 'regal' || S.pattern === 'orange' || S.pattern === 'zebra') ? pal.mark : null;
    const reach = o.airborne ? (sp._reach || 0) : 0, fore = sp._fore || 0;
    // held prey being secured / fed on: front legs (pair I, plus pair II for big prey) wrap around it
    const hg = o.hug && o.hug.k > 0.01 ? o.hug : null; let mc = null, hr = 0;
    let mp0 = null; if (hg) { mp0 = M.add(W(0.4 * L, 0, h0 * 0.35), M.mul(fg, L * 0.06)); mc = M.add(mp0, M.mul(fg, hg.pl * 0.25)); hr = Math.max(L * 0.07, hg.pl * 0.3); }
    // leg hair by zoom detail: dense fuzz, long pale bristles (Phidippus), dark fringe brushes (Portia)
    const legHair = (A, B, w, i, lk, seg) => {
      if (lod === 0 || !A || !B) return;
      const fr = LK.fringe || 0;
      if (fr > 0 && px > 14 && (seg === 1 || i < 2)) { // brushes read even when small
        const k0 = seg === 1 ? 0.2 : 0.35, k1 = seg === 1 ? 0.75 : 0.85; ctx.strokeStyle = LK.tuftCol || '#2a1e14'; ctx.lineWidth = w * (i < 2 ? 2.3 : 1.7) * fr; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(M.lerp(A[0], B[0], k0), M.lerp(A[1], B[1], k0)); ctx.lineTo(M.lerp(A[0], B[0], k1), M.lerp(A[1], B[1], k1)); ctx.stroke();
        if (lod === 2 && px > 44) hairs(ctx, A, B, w * 2, 9, w * 1.1, LK.tuftCol || '#2a1e14', Math.max(0.5, w * 0.18), 0.7, lk);
      }
      if (lod < 2) return;
      if ((LK.legHair || 0) > 0 && px > 60) hairs(ctx, A, B, w, Math.round(3 + 7 * LK.legHair * (i === 0 ? 1.3 : 1)), w * 0.55, pal.hair, Math.max(0.5, w * 0.12), 0.6, lk);
      if ((LK.bristle || 0) > 0 && px > 44) { ctx.globalAlpha = alpha * 0.85; hairs(ctx, A, B, w, Math.round((2 + 4 * LK.bristle) * (i === 0 ? 1.3 : 1)), w * 1.3 + 1.5, LK.bristleCol || '#f2eee4', 0.55, 0.9, lk + 3); ctx.globalAlpha = alpha; }
    };
    const sq = sp.state === 'subdue' ? 1 : 0.35; const seedP = ((sp.seed || 1) % 97) * 0.37;
    // gripping a twig/stem: feet close round it (tarsi hooked under) instead of splaying out over thin air
    let gc = null, ga = null, gb = null, gR = 0;
    if (gripK > 0.001) { ga = M.sub(o.grip.ax, M.mul(n, M.dot(o.grip.ax, n))); if (M.len(ga) > 0.2) { ga = M.norm(ga); gb = M.norm(M.cross(n, ga)); gR = o.grip.R + L * 0.025; gc = M.sub(p, M.mul(n, o.grip.R)); } }
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
      const lk = i * 2 + (sd > 0 ? 1 : 0); // leg index 0..7
      const lg = (LK.legLen || 1) * (i === 0 ? LK.front || 1 : i === 1 ? 1 + ((LK.front || 1) - 1) * 0.35 : 1);
      // Portia: every leg on its own rhythm (never in step), plus slow waving during its pauses
      const ph = gait === 'choppy' ? (sp._walk || 0) * Math.PI * (1 + 0.17 * lk) + lk * 1.37 : (sp._walk || 0) * Math.PI + (i % 2) * Math.PI + (sd > 0 ? Math.PI : 0);
      const sw = gait === 'glide' ? 0.7 : 1;
      let fu = FU[i] * L * lg + Math.sin(ph) * L * 0.12 * moving * lg * sw, fv = FV[i] * L * sd * (1 + crouch * 0.12) * (1 + (lg - 1) * 0.6), fw = Math.max(0, Math.cos(ph)) * L * 0.08 * moving * sw;
      if (gait === 'choppy' && i < 3) fw += L * 0.06 * gp * Math.max(0, Math.sin(t * (1.3 + 0.37 * lk) + lk * 2.3));
      if (LK.antennae && i === 0 && !o.curled && !o.tucked) { const ak = 1 - reach; fu += L * 0.1 * ak; fv *= 1 - 0.5 * ak; fw += L * (0.4 + (sp.state === 'antMarch' ? 0.16 : 0.07) * Math.sin(t * (sp.state === 'antMarch' ? 11 : 6.5) + sd * 1.9)) * ak; } // ant mimic: pair I up like antennae
      if (i === 0 && raise > 0) { fu += L * 0.2 * raise; fw += L * 0.18 * raise * (1 - 0.8 * fore); fv *= 1 - 0.1 * raise; }
      if (i < 2 && fore > 0.01) { // creeping in: pairs I+II point onward, each feeling forward on its own rhythm (never in step)
        const k = i * 2 + (sd > 0 ? 1 : 0);
        fu += L * (0.2 - 0.07 * i) * fore + L * 0.045 * fore * Math.sin(t * (1.3 + 0.41 * k) + seedP + k * 2.1);
        fv *= 1 - (0.22 - 0.08 * i) * fore;
        fw += L * 0.04 * fore * Math.max(0, Math.sin(t * (0.85 + 0.33 * k) + seedP * 1.7 + k * 1.3));
      }
      if (sp.state === 'display' && i <= (S.prefs.display > 0.7 ? 2 : 0)) fw += L * (0.26 + Math.sin(t * 7 + i + (sd > 0 ? 1 : 0)) * 0.12);
      if (sp.state === 'groom' && i === 0) { fw += L * 0.15 * (0.5 + 0.5 * Math.sin(t * 9 + sd)); fv *= 0.75; }
      if (wipe > 0.01 && i === 0) { const w = wipe * (0.65 + 0.35 * Math.sin(t * 10 + (sd > 0 ? 0 : 1.7))); fu = M.lerp(fu, L * 0.4, w); fv = M.lerp(fv, sd * L * 0.16, w); fw = M.lerp(fw, h0 + L * 0.16, w); }
      if (strK > 0.01) { if (i < 2) { fu += L * 0.16 * strK; fw += L * 0.05 * strK * (i === 0 ? 1 : 0); } else { fu -= L * 0.12 * strK; } fv *= 1 + 0.12 * strK; }
      if (flat > 0.01) { fv *= 1 + 0.2 * flat; fu *= 1 + 0.06 * flat; }
      if (hang > 0.01) { fv *= 1 - 0.25 * hang; fw += L * 0.05 * hang; }
      if (o.airborne) { if (i < 2) { fu += L * 0.22; fw += L * 0.06; fv *= 0.8; } else { fu -= L * 0.3; fv *= 0.7; } }
      if (i < 2 && reach > 0.01) { fu = M.lerp(fu, L * (0.98 - 0.16 * i) * Math.sqrt(lg), reach); fv = M.lerp(fv, sd * L * (0.2 + 0.15 * i), reach); fw = M.lerp(fw, h0 + L * (0.03 - 0.05 * i), reach); }
      if (spin && i >= 2) { // hind legs take turns drawing silk back from the spinnerets; pair III braces wide
        const ph2 = t * 4.2 + (sd > 0 ? Math.PI : 0), cpull = 0.5 + 0.5 * Math.sin(ph2);
        if (i === 3) { fu = M.lerp(fu, -L * 0.55, cpull); fv = M.lerp(fv, sd * L * 0.1, cpull * 0.85); fw += L * 0.08 * Math.max(0, Math.cos(ph2)); }
        else { fv *= 1.1; fu -= L * 0.04; }
      }
      if (o.curled) { fu *= 0.35; fv *= 0.55; fw = h0 + L * 0.14; }
      else if (o.tucked) { fu *= 0.6; fv *= 0.56; fw = L * 0.03; }
      // legs attach under the carapace edge and always swing out to the side (never across the head)
      const hip = W(AU[i] * L, sd * L * 0.15, h0 + L * 0.04); let foot = W(fu, fv, fw);
      const hk = hg ? hg.k * (i === 0 ? 1 : i === 1 ? hg.big : 0) : 0;
      if (hk > 0.001) { // clasp: claws close on the prey's sides, with a slow squeeze that is never in step
        const k = i * 2 + (sd > 0 ? 1 : 0); const pulse = 1 - 0.12 * sq * (0.5 + 0.5 * Math.sin(t * (5.2 + k * 0.9) + k * 1.9 + seedP));
        const hf = i === 0 ? M.add(M.add(M.add(mc, M.mul(fg, hr * 0.75)), M.mul(sg, sd * hr * 0.5 * pulse)), M.mul(n, hr * 0.2))
          : M.add(M.add(M.add(mc, M.mul(fg, -hg.pl * 0.18)), M.mul(sg, sd * hr * 0.9 * pulse)), M.mul(n, hr * 0.15));
        foot = M.lerp3(foot, hf, hk);
      }
      const gk = gc && hk < 0.01 ? gripK : 0; let gAnk = null;
      if (gk > 0.001) {
        const d = M.sub(foot, p); const ua = M.dot(d, ga), vb = M.dot(d, gb), up = Math.max(0, M.dot(d, n)) * 0.6;
        const th = Math.sign(vb || sd) * M.clamp(Math.abs(vb) / (gR + L * 0.18), 0.5, 2.4);
        const rad = (an, r) => M.add(M.mul(n, Math.cos(an) * r), M.mul(gb, Math.sin(an) * r));
        gAnk = M.add(M.add(gc, M.mul(ga, ua * 0.78)), rad(th * 0.55, gR + L * 0.08));
        foot = M.lerp3(foot, M.add(M.add(gc, M.mul(ga, ua * 0.82)), rad(th, gR + up)), gk);
      }
      const mid = M.lerp3(hip, foot, 0.4);
      const far = sd * M.dot(s, V.toCam) < -0.15 && !o.thumb; // far-side legs: keep the knee low so it never pokes up over the head
      let knee = M.add(M.add(mid, M.mul(n, L * (0.15 + crouch * 0.06) * Math.sqrt(lg) * sw * (1 - 0.35 * (LK.flat || 0)) * (1 - 0.45 * flat) * (o.curled ? 0.4 : o.tucked ? 0.7 : 1) * (far ? 0.45 : 1) * (i < 2 ? 1 - 0.65 * reach : 1) * (1 + 0.35 * hk) * (1 - 0.3 * gk))), M.mul(s, sd * L * (0.06 + 0.06 * hk)));
      const kv = M.dot(M.sub(knee, p), s) * sd, minV = L * (o.curled ? 0.24 : o.tucked ? 0.27 : far ? 0.4 : 0.33) * (1 + (lg - 1) * 0.5) * (1 - gk) + gk * (gR + L * 0.16); if (kv < minV) knee = M.add(knee, M.mul(s, sd * (minV - kv)));
      let ankle = M.add(M.lerp3(knee, foot, 0.62), M.mul(n, L * 0.05));
      if (gAnk) ankle = M.lerp3(ankle, gAnk, gk);
      if (hk > 0.001) { // embrace: knee lifted high and just outside the prey, tarsus hooking down and in around it
        const latTo = (q, v) => M.add(q, M.mul(sg, sd * v - M.dot(M.sub(q, mc), sg)));
        const kH = latTo(M.add(M.lerp3(hip, foot, 0.5), M.mul(n, L * (0.1 + 0.03 * i) + hr * 0.4)), hr * 1.0 + L * 0.1);
        knee = M.lerp3(knee, kH, hk);
        const aH = latTo(M.add(M.add(foot, M.mul(fg, i === 0 ? -hr * 0.45 : 0)), M.mul(n, hr * 0.55 + L * 0.03)), hr * 0.95 + L * 0.03);
        ankle = M.lerp3(ankle, aH, hk);
      }
      const wk = (i === 0 ? (LK.frontW || 1.3) : 1) * (LK.legW || 1);
      const col = i === 0 ? sh(pal.leg, -0.04) : pal.leg;
      let kd = V.depth(knee) + (M.dot(M.sub(knee, cc), V.toCam) > 0 ? -0.02 : 0.02);
      // femur base tucks under the body when seen from above
      let pd = dorsal ? Math.max(V.depth(cc), V.depth(ac)) + 0.015 : kd;
      if (hk > 0.5 && far && !dorsal) { const md = Math.max(V.depth(cc), V.depth(mp0)) + 0.03; kd = md + 0.01; pd = md + 0.012; } // far arm wraps behind the meal
      parts.push({ d: pd, f: () => {
        const Sx = limb(ctx, V, [hip, knee], [L * 0.066 * wk], col, lod, null);
        legHair(Sx[0], Sx[1], L * 0.066 * wk * V.s, i, lk, 0);
      } });
      parts.push({ d: kd, f: () => {
        const Sx = limb(ctx, V, [knee, ankle, foot], [L * 0.05 * wk, L * 0.03 * (LK.legW || 1)], col, lod, null);
        legHair(Sx[0], Sx[1], L * 0.05 * wk * V.s, i, lk, 1);
        const kr = L * 0.066 * wk * V.s * 0.5; if (lod > 0 && kr > 0.8) { ctx.fillStyle = ring || sh(col, 0.06); ctx.beginPath(); ctx.arc(Sx[0][0], Sx[0][1], kr, 0, 6.283); ctx.fill(); }
      } });
    }
    // --- held meal: tucked beneath the fangs, always drawn behind head + chelicerae ---
    if (o.meal) {
      const mp = M.add(W(0.4 * L, 0, h0 * 0.35), M.mul(fg, L * 0.06));
      const back = Math.max(V.depth(cc), V.depth(mp)) + 0.03;
      parts.push({ d: back, f: () => { o.meal(mp, fg, sg, n); ctx.globalAlpha = alpha; } });
    }
    sortDraw(parts);
    ctx.globalAlpha = 1;
  };

  // ============================== SILK SAC ==============================
  /** Silk retreat as a rounded 3D tube of woven silk, drawn in two layers around the jumper: the 'back' layer
      (contact shadow, inner wall, far-side strands) goes behind it, the 'front' layer (lit shell, near-side
      strands, the one doorway at the front with a glint of the jumper's face) goes over it. It thickens from a
      few frame lines to an opaque wrap while the jumper turns inside, laying silk. info: {glint, ceph, eye} */
  D.nest = function (ctx, V, n, up, night, layer, info) {
    const L = n.len, pr = M.clamp(n.prog, 0, 1); if (pr <= 0.02) return; info = info || {};
    let f = M.sub(n.fwd, M.mul(up, M.dot(n.fwd, up))); f = M.len(f) > 1e-3 ? M.norm(f) : M.norm(M.cross(up, [0, 0, 1])); const s = M.norm(M.cross(up, f));
    const k = 0.84 + 0.16 * pr; const A0 = L * 0.68 * k, B0 = L * 0.5 * k, C0 = L * 0.42 * k; // long, wide, tall (covers body and folded legs)
    const ax = M.mul(f, A0), ay = M.mul(s, B0), az = M.mul(up, C0);
    const c = M.add(n.pos, M.mul(up, L * 0.12)); const P = V.P(c); const e = projEll(V, ax, ay, az); if (e.r1 < 1) return;
    const vac = !n.owner, fade = vac ? Math.max(0.25, 1 - n.age / 1800) : 1;
    const cover = M.smooth(M.clamp((pr - 0.1) / 0.8, 0, 1)); // 0: a few lines .. 1: dense, opaque silk
    const tc = night ? [205, 215, 235] : [246, 247, 250]; const rgba = (cc, a) => 'rgba(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ',' + M.clamp(a, 0, 1).toFixed(3) + ')';
    const shade = (cc, m) => cc.map(v => Math.round(v * m));
    // a point on the shell: u along the tube (-1 back .. 1 front), th around it; the underside is flattened onto the surface
    const pt = (u, th) => { const r = Math.sqrt(Math.max(0, 1 - u * u)); const sn = Math.max(Math.sin(th), -0.3); return M.add(M.add(M.add(c, M.mul(ax, u)), M.mul(ay, Math.cos(th) * r)), M.mul(az, sn * r)); };
    const nrm = (u, th) => { const r = Math.sqrt(Math.max(0, 1 - u * u)); return M.norm(M.add(M.add(M.mul(f, u / A0), M.mul(s, Math.cos(th) * r / B0)), M.mul(up, Math.max(Math.sin(th), -0.3) * r / C0))); };
    const rng = JT.makeRng(n.seed || 1);
    // a soft, lumpy outline (silk bunches up unevenly) instead of a perfect ellipse
    const lump = []; for (let i = 0; i < 4; i++) lump.push([1 + i * 2 + Math.floor(rng() * 2), rng() * 6.283, (0.012 + rng() * 0.02) * (i < 2 ? 1.3 : 1)]);
    const blobPath = (sc) => { ctx.beginPath(); for (let j = 0; j <= 40; j++) { const a = j / 40 * 6.283; let r = 1; for (const [fq, ph, am] of lump) r += Math.sin(a * fq + ph) * am * (0.5 + 0.5 * cover); const x = Math.cos(a) * e.r1 * r * sc, y = Math.sin(a) * e.r2 * r * sc; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); };
    // woven strands: each a loose wrap around the tube, laid down as the jumper turns (more of them as it thickens)
    const nT = Math.round(8 + 56 * pr); const strands = [];
    for (let i = 0; i < 64; i++) { const u0 = rng() * 1.7 - 0.85, du = (rng() - 0.5) * 0.7, th0 = rng() * 6.283, wr = (0.55 + rng() * 0.7) * (rng() < 0.5 ? 1 : -1), w = rng(), g = rng(); if (i < nT) strands.push({ u0, du, th0, wr, w, g }); }
    const drawStrands = (front) => {
      ctx.lineCap = 'round';
      for (const st of strands) {
        const al = (front ? 0.22 + 0.4 * st.w : 0.1 + 0.16 * st.w) * fade * (0.6 + 0.4 * cover);
        const col = st.g < 0.35 ? shade(tc, 0.7) : st.g < 0.6 ? shade(tc, 0.86) : [255, 255, 255];
        ctx.strokeStyle = rgba(col, al); ctx.lineWidth = Math.max(0.3, V.s * (0.035 + 0.04 * st.w));
        let prev = null, on = false; ctx.beginPath();
        for (let j = 0; j <= 16; j++) { const t = j / 16, u = M.clamp(st.u0 + st.du * t, -0.97, 0.97), th = st.th0 + st.wr * 6.283 * t;
          const vis = M.dot(nrm(u, th), V.toCam) >= 0; const q = V.P(pt(u, th));
          if (vis === front) { if (!on && prev) ctx.moveTo(prev[0], prev[1]); else if (!on) ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1]); on = true; } else on = false;
          prev = q; }
        ctx.stroke();
      }
    };
    ctx.save();
    if (layer === 'back') {
      // soft contact shadow where the silk is tacked down
      const sh = projEll(V, M.mul(f, A0 * 1.08), M.mul(s, B0 * 1.08), M.mul(up, L * 0.01)); const Q = V.P(n.pos);
      ctx.save(); ctx.translate(Q[0], Q[1]); ctx.rotate(sh.ang); ctx.fillStyle = 'rgba(30,24,18,' + (0.16 * pr * fade).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(0, 0, sh.r1, sh.r2, 0, 0, 6.283); ctx.fill(); ctx.restore();
      // tacking threads out to the surface around it
      ctx.strokeStyle = rgba(tc, 0.3 * pr * fade); ctx.lineWidth = Math.max(0.35, V.s * 0.05);
      for (let i = 0; i < 6; i++) { const a = (i + rng() * 0.6) * 1.047; const dir = M.add(M.mul(f, Math.cos(a)), M.mul(s, Math.sin(a))); const q0 = V.P(pt(Math.cos(a) * 0.8, Math.sin(a) > 0 ? -0.2 : 3.34)); const q1 = V.P(M.add(n.pos, M.mul(dir, L * (0.85 + rng() * 0.25)))); ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke(); }
      // the inside of the far wall (seen through the gaps while it is still thin)
      ctx.save(); ctx.translate(P[0], P[1]); ctx.rotate(e.ang);
      const g = ctx.createRadialGradient(0, e.r2 * 0.2, e.r2 * 0.2, 0, 0, e.r1); g.addColorStop(0, rgba(shade(tc, 0.72), (0.08 + 0.4 * cover) * fade)); g.addColorStop(1, rgba(shade(tc, 0.86), (0.12 + 0.45 * cover) * fade));
      ctx.fillStyle = g; blobPath(1); ctx.fill(); ctx.restore();
      drawStrands(false);
      ctx.restore(); return;
    }
    // ---- front layer: lit, rounded shell over the jumper ----
    ctx.save(); ctx.translate(P[0], P[1]); ctx.rotate(e.ang);
    const lp = V.J(M.mul(M.norm(M.add(up, M.mul(V.toCam, 0.6))), 1)); const ll = Math.hypot(lp[0], lp[1]) || 1; const ca = Math.cos(-e.ang), sa = Math.sin(-e.ang);
    const lx = (lp[0] * ca - lp[1] * sa) / ll, ly = (lp[0] * sa + lp[1] * ca) / ll; // light-facing side of the shell, in the rotated frame
    const Af = (0.06 + 0.9 * cover) * fade;
    const g = ctx.createRadialGradient(lx * e.r1 * 0.3, ly * e.r2 * 0.45, e.r2 * 0.08, 0, 0, e.r1 * 1.02);
    g.addColorStop(0, rgba([255, 255, 255], Af)); g.addColorStop(0.45, rgba(tc, Af)); g.addColorStop(0.85, rgba(shade(tc, 0.86), Af)); g.addColorStop(1, rgba(shade(tc, 0.74), Af * 0.95));
    ctx.fillStyle = rgba(tc, Af * 0.22); blobPath(1.07); ctx.fill(); // loose fluff around the wrap
    ctx.fillStyle = g; blobPath(1); ctx.fill();
    // self-shadow on the side away from the light: reads as volume rather than a flat disc
    ctx.save(); blobPath(1); ctx.clip();
    const sg = ctx.createLinearGradient(lx * e.r1, ly * e.r2, -lx * e.r1, -ly * e.r2); sg.addColorStop(0.45, 'rgba(90,84,78,0)'); sg.addColorStop(1, 'rgba(90,84,78,' + (0.28 * cover * fade).toFixed(3) + ')');
    ctx.fillStyle = sg; ctx.fillRect(-e.r1, -e.r2, e.r1 * 2, e.r2 * 2); ctx.restore();
    // a second, smaller lit layer on top: the wrap looks built up from layers of silk
    const g2 = ctx.createRadialGradient(lx * e.r1 * 0.35, ly * e.r2 * 0.5, 0, lx * e.r1 * 0.2, ly * e.r2 * 0.3, e.r1 * 0.6); g2.addColorStop(0, rgba([255, 255, 255], 0.5 * cover * fade)); g2.addColorStop(1, rgba([255, 255, 255], 0));
    ctx.fillStyle = g2; blobPath(0.9); ctx.fill();
    ctx.strokeStyle = rgba(shade(tc, 0.8), (0.1 + 0.2 * cover) * fade); ctx.lineWidth = Math.max(0.5, V.s * 0.06); blobPath(0.99); ctx.stroke();
    ctx.restore();
    drawStrands(true);
    // fluffy loose fibres standing off the surface
    if (cover > 0.3) { ctx.strokeStyle = rgba([255, 255, 255], 0.35 * cover * fade); ctx.lineWidth = Math.max(0.3, V.s * 0.03);
      for (let i = 0; i < 26; i++) { const u = rng() * 1.6 - 0.8, th = rng() * 3.4 - 0.2; const a = pt(u, th), b = M.add(a, M.mul(nrm(u, th), L * (0.04 + rng() * 0.06))); if (M.dot(nrm(u, th), V.toCam) < 0) continue; const qa = V.P(a), qb = V.P(b); ctx.beginPath(); ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); ctx.stroke(); } }
    // while building: the live thread from the spinnerets out to the anchor it is pulling toward as it turns
    if (n.build && n.owner) {
      const a = n.spinA || 0; const fd = M.norm(M.add(M.mul(f, Math.cos(a)), M.mul(s, Math.sin(a)))); const sd = M.norm(M.cross(up, fd));
      const spn = M.add(M.add(n.pos, M.mul(fd, -L * 0.5)), M.mul(up, L * 0.06)); const S0 = V.P(spn);
      for (let j = 0; j < 4; j++) { const aj = a - j * 0.55; const dj = M.norm(M.add(M.mul(f, Math.cos(aj)), M.mul(s, Math.sin(aj))));
        const anc = M.add(M.add(n.pos, M.mul(dj, -L * 0.78)), M.mul(sd, (j % 2 ? 1 : -1) * L * 0.12)); const Q = V.P(anc);
        ctx.strokeStyle = rgba([255, 255, 255], (0.6 - j * 0.13) * fade); ctx.lineWidth = Math.max(0.35, V.s * 0.05); ctx.beginPath(); ctx.moveTo(S0[0], S0[1]); ctx.quadraticCurveTo((S0[0] + Q[0]) / 2, (S0[1] + Q[1]) / 2 - V.s * L * 0.08, Q[0], Q[1]); ctx.stroke(); }
    }
    // the one doorway, at the front end: small and dark while it rests, pulled wide when it leaves
    const vis = M.dot(f, V.toCam);
    if (cover > 0.35 && vis > -0.35) {
      const o = n.hole ? M.clamp(n.hole.open, 0, 1) : 0; const r = L * (0.16 + 0.12 * o) * M.clamp((cover - 0.35) * 2.5, 0.3, 1);
      const hc = M.add(pt(0.86, 1.2), M.mul(f, L * 0.02)); const he = projEll(V, M.mul(s, r), M.mul(up, r * 0.85), M.mul(f, L * 0.02));
      if (he.r1 >= 0.6) {
        const H = V.P(hc); const va = fade * M.clamp((vis + 0.35) * 2, 0, 1);
        ctx.save(); ctx.globalAlpha = va; ctx.translate(H[0], H[1]); ctx.rotate(he.ang);
        const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, he.r1); hg.addColorStop(0, 'rgba(14,11,8,0.95)'); hg.addColorStop(0.7, 'rgba(30,26,22,0.85)'); hg.addColorStop(1, 'rgba(70,66,60,0.05)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, 0, he.r1, Math.max(0.5, he.r2), 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(250,250,252,0.5)'; ctx.lineWidth = Math.max(0.35, V.s * 0.05);
        for (let i = 0; i < 10; i++) { const a = rng() * 6.283, w = 0.8 + rng() * 0.5; const x = Math.cos(a) * he.r1 * 0.85, y = Math.sin(a) * he.r2 * 0.85; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x * (1 + 0.35 * w), y * (1 + 0.35 * w)); ctx.stroke(); }
        ctx.restore();
        // a glint of the jumper inside: the dim front of its carapace and the two big front eyes catching the light
        if (info.glint && vis > 0.05) {
          const gA = va * M.clamp(vis * 3, 0, 1) * (info.glint === true ? 1 : info.glint);
          const fc = M.add(hc, M.mul(f, -L * 0.05)); const F = V.P(fc); const cr = projEll(V, M.mul(s, r * 0.72), M.mul(up, r * 0.5), null);
          ctx.save(); ctx.globalAlpha = gA * 0.75; ctx.translate(F[0], F[1]); ctx.rotate(cr.ang); ctx.fillStyle = info.ceph || '#3a2a20'; ctx.beginPath(); ctx.ellipse(0, cr.r2 * 0.25, cr.r1, cr.r2, 0, 0, 6.283); ctx.fill(); ctx.restore();
          const er = Math.max(0.6, L * 0.036 * V.s);
          for (const sd2 of [-1, 1]) { const ep = V.P(M.add(M.add(fc, M.mul(s, sd2 * r * 0.36)), M.mul(up, -r * 0.02)));
            ctx.globalAlpha = gA; ctx.fillStyle = '#050403'; ctx.beginPath(); ctx.arc(ep[0], ep[1], er, 0, 6.283); ctx.fill();
            ctx.fillStyle = info.eye || 'rgba(120,90,60,0.6)'; ctx.globalAlpha = gA * 0.5; ctx.beginPath(); ctx.arc(ep[0], ep[1], er * 0.65, 0, 6.283); ctx.fill();
            ctx.globalAlpha = gA * (0.75 + 0.2 * Math.sin((info.time || 0) * 1.3 + sd2)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ep[0] - er * 0.3, ep[1] - er * 0.35, Math.max(0.45, er * 0.3), 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  };

  // ============================== PREY ==============================
  D.prey = function (ctx, V, e, fr, o) {
    const d = JT.PREY_BY_ID[e.type]; if (!d) return;
    if (d.shape === 'spider') {
      const fl0 = o.flail || 0; const pseudo = { species: e.species || 'zebra', state: 'idle', _walk: e._walk, _moving: fl0 > 0.15 || M.len(e._vel || [0, 0, 0]) > 1, seed: e.seed, sat: 0.6 };
      const pal = e.species ? null : { ceph: '#3a2a20', abd: '#4a3628', mark: '#d8c8a8', leg: '#4a3a2c', chel: '#3a2a20', hair: '#a08a6a', belly: '#6a5a4a' };
      D.spider(ctx, V, pseudo, fr, { len: (o.len || d.len) * (o.scale || 1), palette: pal, alpha: o.alpha, curled: fl0 > 0.15 ? false : (o.held || o.curled), time: o.time, noShadow: o.held }); return;
    }
    const L = (o.len || d.len) * (o.scale || 1); const { f, s, n } = fr; const p = fr.p;
    const W = (u, v, w) => [p[0] + f[0] * u + s[0] * v + n[0] * w, p[1] + f[1] * u + s[1] * v + n[1] * w, p[2] + f[2] * u + s[2] * v + n[2] * w];
    const t = (e._anim || 0) + (e.seed || 0) % 10; const T = o.time || 0;
    const flying = e.sup && e.sup.k === 'air' && !e.owner; const moving = M.len(e._vel || [0, 0, 0]) > 1; const held = !!(o.held || o.curled); const fl = held ? (o.flail || 0) : 0; const buzz = fl > 0.25 && !flying;
    const a0 = o.alpha != null ? o.alpha : 1; ctx.globalAlpha = a0;
    const col = hex6(d.col); const px = L * V.s; const lod = lodFor(px, o); const S = d.shape;
    if (!flying && !held && !o.noShadow) castShadow(ctx, V, p, f, s, n, L * 0.9, L * 0.15, a0, S === 'worm' ? 0.35 : S === 'springtail' || S === 'gnat' || S === 'lacewing' ? 0.6 : 1);
    if (lod === 0 && px < 4) { // tiny on screen: one shaded body is enough
      blob(ctx, V, W(0, 0, L * 0.16), M.mul(f, L * 0.45), M.mul(s, L * (S === 'worm' ? 0.1 : 0.2)), M.mul(n, L * 0.14), S === 'fly' || S === 'gnat' ? sh(col, -0.15) : col, { lod: 0 });
      if (flying) { const P = V.P(W(0, 0, L * 0.3)); ctx.fillStyle = 'rgba(230,240,255,0.35)'; ctx.beginPath(); ctx.arc(P[0], P[1], Math.max(1, px * 0.6), 0, 6.283); ctx.fill(); }
      ctx.globalAlpha = 1; return;
    }
    const parts = []; const add = (pos, fn, bias) => parts.push({ d: V.depth(pos) + (bias || 0), f: fn });
    const B = (c, a, b, cc, colr, opt) => add(c, () => blob(ctx, V, c, a, b, cc, colr, Object.assign({ lod, time: T }, opt || {})));
    const legW = (k) => L * k;
    const legs6 = (spread, w, colr, hipW, gait) => {
      for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
        const ph = (e._walk || 0) * Math.PI + i * 2.1 + (sd > 0 ? 1.5 : 0); const u = (0.18 - i * 0.16) * L;
        const fu = u + (0.12 - i * 0.14) * L + Math.sin(ph) * 0.07 * L * (moving ? 1 : 0); const lift = Math.max(0, Math.cos(ph)) * 0.05 * L * (moving ? 1 : 0);
        const hip = W(u, sd * L * (hipW || 0.07), L * 0.1); const foot = held ? (fl > 0.02 ? W(u * 0.5 + Math.sin(T * 26 + i * 2.1 + sd) * 0.12 * L * fl, sd * L * spread * (0.42 + 0.4 * fl * (0.5 + 0.5 * Math.sin(T * 19 + i * 1.7 + sd * 2))), L * 0.25 - Math.cos(T * 23 + i) * 0.1 * L * fl) : W(u * 0.5, sd * L * spread * 0.4, L * 0.25)) : flying ? W(u - 0.1 * L, sd * L * spread * 0.5, L * 0.0) : W(fu, sd * L * spread, lift);
        const knee = M.add(M.lerp3(hip, foot, 0.45), M.mul(n, L * (gait || 0.14)));
        add(knee, () => limb(ctx, V, [hip, knee, foot], [legW(w), legW(w * 0.7)], colr, lod, null), M.dot(M.sub(knee, p), V.toCam) > 0 ? -0.01 : 0.01);
      }
    };
    const antennae = (base, len, colr, w, curl) => { for (const sd of [-1, 1]) { const sw = Math.sin(T * 2.2 + sd + (e.seed || 0)) * 0.06; const a = W(base * L, sd * L * 0.04, L * 0.2), m = W(base * L + L * len * 0.5, sd * L * (0.15 + sw), L * (0.3 + curl)), b = W(base * L + L * len, sd * L * (0.32 + sw * 2), L * (0.22 + curl)); add(m, () => curve(ctx, V, a, m, b, L * w, ink(colr))); } };

    if (S === 'fly' || S === 'gnat') {
      const g = S === 'gnat'; const met = !!d.metallic; const bc = met ? '#1f4a8a' : col;
      if (!g || !flying) legs6(g ? 0.55 : 0.36, 0.028, sh(bc, -0.45), 0.06, g ? 0.22 : 0.14);
      B(W(-0.2 * L, 0, L * 0.17), M.mul(f, L * (g ? 0.3 : 0.28)), M.mul(s, L * (g ? 0.1 : 0.17)), M.mul(n, L * (g ? 0.1 : 0.14)), sh(bc, -0.08), { gloss: met ? 1 : 0.5, sheen: met ? 1 : 0, hatch: true });
      const abdP = Part(W(-0.2 * L, 0, L * 0.17), M.mul(f, L * 0.28), M.mul(s, L * 0.17), M.mul(n, L * 0.14));
      if (!g && lod > 0) add(abdP.c, () => decals(ctx, V, abdP, [band(-0.1, 0.12, 'dark'), band(-0.45, 0.12, 'dark'), band(0.25, 0.1, 'dark')], { dark: sh(bc, -0.45) }, a0), -0.005);
      B(W(0.1 * L, 0, L * 0.2), M.mul(f, L * 0.19), M.mul(s, L * (g ? 0.1 : 0.16)), M.mul(n, L * (g ? 0.11 : 0.15)), g ? sh(col, -0.1) : sh(bc, 0.05), { gloss: 0.4, fuzz: g ? 0 : 0.6, fuzzCol: sh(bc, -0.5) });
      const hc = W(0.33 * L, 0, L * 0.21); B(hc, M.mul(f, L * 0.09), M.mul(s, L * (g ? 0.07 : 0.13)), M.mul(n, L * (g ? 0.07 : 0.12)), sh(bc, -0.25), {});
      if (!g) for (const sd of [-1, 1]) { const ec = W(0.35 * L, sd * L * 0.085, L * 0.23); B(ec, M.mul(f, L * 0.07), M.mul(s, L * 0.06), M.mul(n, L * 0.085), hex6(d.eye || '#a01a10'), { gloss: 1 }); }
      if (g) antennae(0.36, 0.35, col, 0.02, 0.05);
      // wings: flat membranes hinged at the thorax; beating blur in flight
      const flap = flying || buzz ? Math.sin(T * 70 + (e.seed || 0)) : 0;
      for (const sd of [-1, 1]) {
        const root0 = W(0.12 * L, sd * L * 0.05, L * 0.3);
        let dir = M.norm(M.add(M.add(M.mul(f, -0.9), M.mul(s, sd * (held ? 0.15 : 0.32))), M.mul(n, 0.06)));
        let side = M.norm(M.cross(n, dir)); if (sd < 0) side = M.mul(side, -1);
        const ang = flying ? 0.9 * flap : buzz ? 0.2 + 0.5 * fl * flap : 0.12; const sideR = M.add(M.mul(side, Math.cos(ang)), M.mul(n, Math.sin(ang) * sd * 0 + Math.sin(ang)));
        const wl = L * (g ? 0.62 : 0.5), ww = L * (g ? 0.16 : 0.2);
        const wc = M.add(root0, M.mul(M.add(M.mul(dir, Math.cos(ang * 0.5)), M.mul(n, Math.abs(Math.sin(ang)) * 0.6)), wl * 0.5));
        const fill = flying ? 'rgba(225,235,245,0.22)' : g ? 'rgba(150,150,160,0.42)' : 'rgba(225,235,245,0.45)';
        add(wc, () => wing(ctx, V, wc, M.mul(dir, wl * 0.5), M.mul(sideR, ww * 0.5), fill, 'rgba(60,60,70,0.55)', !flying, lod), -0.03);
        if (flying && lod > 0) add(wc, () => { const P = V.P(root0); const q = V.P(M.add(root0, M.mul(dir, wl))); ctx.fillStyle = 'rgba(230,240,255,0.14)'; ctx.beginPath(); ctx.moveTo(P[0], P[1]); ctx.arc(P[0], P[1], Math.hypot(q[0] - P[0], q[1] - P[1]), Math.atan2(q[1] - P[1], q[0] - P[0]) - 0.9, Math.atan2(q[1] - P[1], q[0] - P[0]) + 0.9); ctx.closePath(); ctx.fill(); }, -0.04);
      }
    } else if (S === 'moth' || S === 'lacewing') {
      const moth = S === 'moth'; const bc = moth ? col : '#7ac06a';
      legs6(0.32, 0.022, sh(bc, -0.3), 0.06, 0.08);
      B(W(-0.15 * L, 0, L * 0.16), M.mul(f, L * 0.3), M.mul(s, L * (moth ? 0.1 : 0.06)), M.mul(n, L * (moth ? 0.1 : 0.06)), sh(bc, moth ? 0.08 : 0), { fuzz: moth ? 1.2 : 0, fuzzCol: sh(bc, 0.3) });
      B(W(0.18 * L, 0, L * 0.19), M.mul(f, L * 0.13), M.mul(s, L * (moth ? 0.12 : 0.07)), M.mul(n, L * (moth ? 0.12 : 0.07)), sh(bc, -0.05), { fuzz: moth ? 1.5 : 0, fuzzCol: sh(bc, 0.35) });
      const hc = W(0.34 * L, 0, L * 0.19); B(hc, M.mul(f, L * 0.06), M.mul(s, L * 0.08), M.mul(n, L * 0.07), moth ? sh(bc, -0.15) : '#e8c040', { gloss: moth ? 0 : 1 });
      antennae(0.36, moth ? 0.38 : 0.7, moth ? sh(col, -0.25) : '#9ac080', moth ? 0.014 : 0.01, 0.08);
      // tented wings: two planes meeting along the back like a roof
      const flapA = flying || buzz ? 0.25 + (flying ? 1.1 : 0.6 * fl) * Math.abs(Math.cos(T * (moth ? 14 : 18) * (buzz ? 2 : 1) + (e.seed || 0))) : (moth ? 0.55 : 0.35);
      for (const pair of (moth ? [0] : [0, 1])) for (const sd of [-1, 1]) {
        const root0 = W((0.18 - pair * 0.06) * L, 0, L * 0.25);
        const back = M.norm(M.add(M.mul(f, -1), M.mul(s, sd * (flying ? 0.25 + pair * 0.08 : 0.06))));
        const out = M.norm(M.add(M.mul(M.norm(M.cross(n, back)), -sd * Math.cos(flapA)), M.mul(n, -Math.sin(flapA) * 0.0 + Math.sin(flapA))));
        const outv = flying ? M.add(M.mul(s, sd * Math.cos(flapA)), M.mul(n, Math.sin(flapA))) : M.norm(M.add(M.mul(s, sd * (moth ? 0.62 : 0.5)), M.mul(n, -0.42)));
        const wl = L * (moth ? 0.62 : 0.85), ww = L * (moth ? 0.42 : 0.24);
        const wc = M.add(M.add(root0, M.mul(back, wl * 0.45)), M.mul(outv, ww * 0.45));
        const nrm = M.norm(M.cross(back, outv)); const lit = M.clamp(0.55 + 0.45 * Math.abs(M.dot(nrm, LG)), 0.4, 1);
        void out;
        if (moth) add(wc, () => {
          const A = V.P(root0), Bp = V.P(M.add(root0, M.add(M.mul(back, wl * 0.35), M.mul(outv, ww)))), Cp = V.P(M.add(root0, M.add(M.mul(back, wl), M.mul(outv, ww * 0.8)))), Dp = V.P(M.add(root0, M.mul(back, wl * 0.9)));
          ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(Bp[0], Bp[1], M.lerp(Bp[0], Cp[0], 0.5), M.lerp(Bp[1], Cp[1], 0.5)); ctx.lineTo(Cp[0], Cp[1]); ctx.quadraticCurveTo(M.lerp(Cp[0], Dp[0], 0.6), M.lerp(Cp[1], Dp[1], 0.6), Dp[0], Dp[1]); ctx.closePath();
          ctx.fillStyle = sh(col, (lit - 0.75) * 0.8); ctx.fill(); if (lod > 0) { ctx.strokeStyle = ink(col); ctx.lineWidth = Math.max(0.4, px * 0.012); ctx.stroke(); }
          if (lod > 0) { const ey = V.P(M.add(root0, M.add(M.mul(back, wl * 0.5), M.mul(outv, ww * 0.55)))); ctx.fillStyle = sh(col, -0.45); ctx.beginPath(); ctx.arc(ey[0], ey[1], Math.max(0.6, px * 0.045), 0, 6.283); ctx.fill(); ctx.fillStyle = sh(col, 0.4); ctx.beginPath(); ctx.arc(ey[0], ey[1], Math.max(0.3, px * 0.018), 0, 6.283); ctx.fill();
            const b1 = V.P(M.add(root0, M.add(M.mul(back, wl * 0.75), M.mul(outv, ww * 0.1)))), b2 = V.P(M.add(root0, M.add(M.mul(back, wl * 0.68), M.mul(outv, ww * 0.85)))); ctx.strokeStyle = sh(col, -0.3); ctx.lineWidth = Math.max(0.5, px * 0.02); ctx.beginPath(); ctx.moveTo(b1[0], b1[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke(); }
        }, flying ? -0.03 * sd : -1 - 0.03 * sd);
        else add(wc, () => wing(ctx, V, wc, M.mul(back, wl * 0.5), M.mul(outv, ww * 0.5), 'rgba(200,250,205,0.28)', 'rgba(90,170,90,0.7)', true, lod), flying ? -0.03 : -1);
      }
    } else if (S === 'cricket' || S === 'locust') {
      const big = S === 'locust'; const bc = col;
      // legs: thin front pairs + powerful hind legs (thick femur "drumstick")
      for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) { const ph = (e._walk || 0) * Math.PI + i * 2 + (sd > 0 ? 1.5 : 0); const hip = W((0.24 - i * 0.12) * L, sd * L * 0.08, L * 0.1); const foot = W((0.4 - i * 0.14) * L + Math.sin(ph) * 0.05 * L * (moving ? 1 : 0), sd * L * 0.3, 0); const knee = M.add(M.lerp3(hip, foot, 0.5), M.mul(n, L * 0.1)); add(knee, () => limb(ctx, V, [hip, knee, foot], [L * 0.035, L * 0.025], sh(bc, -0.25), lod, null), 0.01); }
      for (const sd of [-1, 1]) {
        const hop = e.state === 'hop' ? 0.5 : 0; const hip = W(-0.05 * L, sd * L * 0.12, L * 0.13); const knee = W(-0.45 * L - hop * 0.2 * L, sd * L * 0.2, L * (0.32 - hop * 0.15)); const foot = W(-0.22 * L - hop * 0.5 * L, sd * L * 0.26, 0);
        const fm = M.lerp3(hip, knee, 0.45); const fd = M.mul(M.sub(knee, hip), 0.55); const fs = M.norm(M.cross(fd, n));
        add(fm, () => { blob(ctx, V, fm, fd, M.mul(fs, L * 0.075), M.mul(M.norm(M.cross(fd, fs)), L * 0.06), sh(bc, 0.05), { lod, gloss: 0.3, hatch: false }); if (lod > 0) { const A = V.P(M.lerp3(hip, knee, 0.2)), Bq = V.P(M.lerp3(hip, knee, 0.8)); ctx.strokeStyle = sh(bc, -0.3); ctx.lineWidth = Math.max(0.4, px * 0.008); ctx.beginPath(); for (let k = 0; k < 5; k++) { const tt = k / 4; const x = M.lerp(A[0], Bq[0], tt), y = M.lerp(A[1], Bq[1], tt); ctx.moveTo(x - 1, y - 1.5); ctx.lineTo(x + 1, y + 1.5); } ctx.stroke(); } }, M.dot(M.sub(fm, p), V.toCam) > 0 ? -0.02 : 0.02);
        add(knee, () => { const Sx = limb(ctx, V, [knee, foot], [L * 0.028], sh(bc, -0.3), lod, null); if (lod === 2) { ctx.strokeStyle = sh(bc, -0.5); ctx.lineWidth = 0.6; ctx.beginPath(); for (let k = 1; k < 5; k++) { const x = M.lerp(Sx[0][0], Sx[1][0], k / 5), y = M.lerp(Sx[0][1], Sx[1][1], k / 5); ctx.moveTo(x, y); ctx.lineTo(x + 1.5, y - 1.5); } ctx.stroke(); } }, M.dot(M.sub(knee, p), V.toCam) > 0 ? -0.02 : 0.02);
      }
      const abdP = Part(W(-0.18 * L, 0, L * 0.15), M.mul(f, L * 0.3), M.mul(s, L * 0.13), M.mul(n, L * 0.12));
      add(abdP.c, () => { blob(ctx, V, abdP.c, abdP.ax, abdP.ay, abdP.az, sh(bc, -0.05), { lod, gloss: 0.35, hatch: true }); if (lod > 0) decals(ctx, V, abdP, [band(0.3, 0.06, 'dark'), band(0, 0.06, 'dark'), band(-0.3, 0.06, 'dark'), band(-0.6, 0.06, 'dark')], { dark: sh(bc, -0.4) }, a0); });
      // folded wings along the back, slightly tented
      for (const sd of [-1, 1]) { const wc = W(-0.12 * L, sd * L * 0.05, L * 0.25); const side = M.norm(M.add(M.mul(s, sd), M.mul(n, 0.5))); add(wc, () => wing(ctx, V, wc, M.mul(f, L * (big ? 0.42 : 0.3)), M.mul(side, L * 0.08), big ? sh(bc, 0.15) : 'rgba(70,50,30,0.55)', ink(bc), true, lod), -0.03); }
      const pc = W(0.18 * L, 0, L * 0.18); B(pc, M.mul(f, L * 0.13), M.mul(s, L * 0.13), M.mul(n, L * 0.12), sh(bc, -0.12), { gloss: 0.5 });
      const hc = W(0.36 * L, 0, L * 0.17); B(hc, M.mul(f, L * 0.1), M.mul(s, L * 0.1), M.mul(n, L * 0.12), sh(bc, -0.2), { gloss: 0.4 });
      for (const sd of [-1, 1]) { const ec = W(0.4 * L, sd * L * 0.07, L * 0.22); B(ec, M.mul(f, L * 0.03), M.mul(s, L * 0.03), M.mul(n, L * 0.035), '#1a120a', { gloss: 1, ink: false }); }
      antennae(0.42, big ? 0.4 : 0.85, bc, 0.012, 0.15);
      if (!big) for (const sd of [-1, 1]) { const a = W(-0.46 * L, sd * L * 0.04, L * 0.14), b = W(-0.65 * L, sd * L * 0.1, L * 0.18); add(a, () => limb(ctx, V, [a, b], [L * 0.015], sh(bc, -0.3), 0, null), 0.01); }
    } else if (S === 'worm') {
      const nseg = d.segs || 10; const fatK = d.fat || 1; const wig = moving ? 1 : 0.35; const silk = d.id === 'silkworm';
      const segs = [];
      for (let i = 0; i < nseg; i++) { const k = i / (nseg - 1); const u = (0.5 - k) * L; const v = Math.sin(i * 0.75 - (e._walk || 0) * 2 - T * 0.6) * L * 0.05 * wig + (fl > 0.05 ? Math.sin(i * 1.1 - T * 14) * L * 0.14 * fl * k : 0); const hump = Math.max(0, Math.sin(k * 6.28 * 1.5 - T * 3)) * L * 0.02 * wig + (fl > 0.05 && (silk || d.id === 'hornworm') ? Math.max(0, k - 0.45) * L * 0.5 * fl * (0.6 + 0.4 * Math.sin(T * 5)) : 0); const r = L * 0.078 * fatK * (i === 0 ? 0.85 : i === nseg - 1 ? 0.7 : 1); segs.push({ c: W(u, v, r * 0.85 + hump), r }); }
      if (lod === 0) { add(segs[0].c, () => { const S2 = segs.map(q => V.P(q.c)); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, segs[1].r * 1.8 * V.s); ctx.lineCap = 'round'; ctx.beginPath(); S2.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); }); }
      else segs.forEach((q, i) => {
        const c2 = i === 0 ? (d.id === 'mealworm' ? '#6a3a14' : sh(col, -0.35)) : sh(col, i % 2 ? -0.06 : 0.04);
        B(q.c, M.mul(f, q.r * 1.15), M.mul(s, q.r), M.mul(n, q.r * 0.9), c2, { gloss: d.id === 'mealworm' ? 0.55 : 0.3, ink: i === 0 });
        if (silk && i === 3) add(q.c, () => { const P = V.P(M.add(q.c, M.mul(n, q.r * 0.9))); ctx.fillStyle = '#8a7a6a'; ctx.beginPath(); ctx.arc(P[0], P[1], Math.max(0.6, q.r * V.s * 0.3), 0, 6.283); ctx.fill(); }, -0.01);
      });
      if (d.id === 'hornworm' && lod > 0) { const q = segs[nseg - 1]; const a = M.add(q.c, M.mul(n, q.r * 0.7)), b = M.add(M.add(q.c, M.mul(f, -q.r * 1.1)), M.mul(n, q.r * 2.2)); add(a, () => limb(ctx, V, [a, b], [q.r * 0.35, q.r * 0.12], '#c86a2a', lod, null), -0.01); }
    } else if (S === 'aphid') { // soft pear-shaped body, little head, two tail tubes (cornicles)
      legs6(0.3, 0.03, sh(col, -0.25), 0.06, 0.12);
      B(W(-0.1 * L, 0, L * 0.2), M.mul(f, L * 0.34), M.mul(s, L * 0.24), M.mul(n, L * 0.2), col, { gloss: 0.7 });
      B(W(0.2 * L, 0, L * 0.18), M.mul(f, L * 0.14), M.mul(s, L * 0.15), M.mul(n, L * 0.13), sh(col, -0.06), { gloss: 0.5 });
      B(W(0.34 * L, 0, L * 0.16), M.mul(f, L * 0.08), M.mul(s, L * 0.1), M.mul(n, L * 0.09), sh(col, -0.15), {});
      for (const sd of [-1, 1]) { const a = W(-0.3 * L, sd * L * 0.1, L * 0.3), b = W(-0.45 * L, sd * L * 0.14, L * 0.42); add(a, () => limb(ctx, V, [a, b], [L * 0.035], sh(col, -0.3), lod, null), -0.01); }
      antennae(0.38, 0.5, sh(col, -0.2), 0.015, 0.05);
    } else if (S === 'roach' || S === 'beetle' || S === 'isopod') {
      legs6(S === 'isopod' ? 0.28 : 0.4, S === 'roach' ? 0.035 : 0.03, sh(col, -0.4), 0.08, 0.12);
      if (S === 'isopod') {
        const N = 7; for (let i = 0; i < N; i++) { const k = i / (N - 1); const c2 = W((0.32 - k * 0.62) * L, 0, L * 0.1); const wv = L * (0.24 - Math.abs(k - 0.4) * 0.16); B(c2, M.mul(f, L * 0.08), M.mul(s, wv), M.mul(n, L * 0.1 * (1 - Math.abs(k - 0.45) * 0.6)), sh(col, ((i * 37) % 7) / 40 - 0.05), { gloss: 0.3 }); }
        for (const sd of [-1, 1]) { const a = W(-0.34 * L, sd * L * 0.05, L * 0.06), b = W(-0.48 * L, sd * L * 0.1, L * 0.05); add(a, () => limb(ctx, V, [a, b], [L * 0.03], sh(col, -0.2), lod, null), 0.01); }
        antennae(0.36, 0.4, col, 0.025, 0.05);
      } else {
        const beetle = S === 'beetle'; const sw = S === 'roach' ? 0.34 : 0.27;
        const el = Part(W(-0.1 * L, 0, L * 0.14), M.mul(f, L * (beetle ? 0.36 : 0.4)), M.mul(s, L * sw), M.mul(n, L * (beetle ? 0.17 : 0.12)));
        add(el.c, () => { blob(ctx, V, el.c, el.ax, el.ay, el.az, col, { lod, gloss: beetle ? 1 : 0.6, hatch: true });
          if (lod > 0) decals(ctx, V, el, beetle ? [stripe(0, 0.03, 'dark', -0.95, 0.95)].concat(d.spots ? [dot(-0.2, 0.4, 0.13, 'pale'), dot(-0.2, -0.4, 0.13, 'pale'), dot(-0.6, 0.2, 0.1, 'pale'), dot(-0.6, -0.2, 0.1, 'pale')] : [stripe(0.45, 0.02, 'dark', -0.8, 0.8, 0.5), stripe(-0.45, 0.02, 'dark', -0.8, 0.8, 0.5)]) : [band(0.5, 0.04, 'dark'), band(0.2, 0.04, 'dark'), band(-0.1, 0.04, 'dark'), band(-0.4, 0.04, 'dark'), band(-0.7, 0.04, 'dark'), stripe(0.9, 0.06, 'pale', -0.6, 0.6, 0.5), stripe(-0.9, 0.06, 'pale', -0.6, 0.6, 0.5)], { dark: sh(col, -0.5), pale: beetle ? '#d8c8a0' : sh(col, 0.35) }, a0); });
        const pc = W(0.33 * L, 0, L * 0.13); B(pc, M.mul(f, L * 0.1), M.mul(s, L * sw * 0.8), M.mul(n, L * 0.09), sh(col, -0.15), { gloss: beetle ? 1 : 0.5 });
        const hc = W(0.45 * L, 0, L * 0.1); B(hc, M.mul(f, L * 0.06), M.mul(s, L * 0.09), M.mul(n, L * 0.07), sh(col, -0.35), {});
        antennae(0.47, beetle ? 0.32 : 0.55, col, 0.02, 0.03);
      }
    } else if (S === 'springtail') {
      const bc = W(0, 0, L * 0.18); B(bc, M.mul(f, L * 0.42), M.mul(s, L * 0.2), M.mul(n, L * 0.19), col, { gloss: 0.6 });
      const hc = W(0.42 * L, 0, L * 0.18); B(hc, M.mul(f, L * 0.14), M.mul(s, L * 0.15), M.mul(n, L * 0.14), sh(col, 0.08), { gloss: 0.5 });
      antennae(0.48, 0.45, '#c8c8d0', 0.035, 0.05);
      const a = W(-0.38 * L, 0, L * 0.06), b = W(-0.15 * L, 0, L * 0.01); add(a, () => limb(ctx, V, [a, b], [L * 0.05], '#d8d8e0', 0, null), 0.01);
      legs6(0.3, 0.05, sh(col, -0.2), 0.08, 0.08);
    }
    sortDraw(parts);
    ctx.globalAlpha = 1;
  };
  D.critter = { blob, limb, projEll, wing, curve, sh, mix, hex6, castShadow, lodFor, sortDraw, decals, Part, surf, facing };
})(typeof window !== 'undefined' ? window : globalThis);
