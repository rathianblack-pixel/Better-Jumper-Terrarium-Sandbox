/* Jumper Terrarium — procedural decor drawing. Uses the SAME geometry primitives that produce
   navigation surfaces, so visible shapes and walkable paths agree. Used for the habitat,
   placement ghosts and inventory thumbnails alike. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, sh = JT.shade;
  const D = JT.Draw = JT.Draw || {};
  const STY = {
    rock: { side: '#857f73', top: '#a29b8d', mark: '#6c675d', hi: '#b8b2a4' },
    slate: { side: '#4c5256', top: '#626a6e', mark: '#353a3d', hi: '#7a8286' },
    sand: { side: '#b08a60', top: '#c9a274', mark: '#94704a', hi: '#dcb88a' },
    river: { side: '#767c82', top: '#959ba0', mark: '#5e6368', hi: '#b6bcc0' },
    cork: { side: '#744c30', top: '#8c6040', mark: '#4e321e', hi: '#a37650' },
    wood: { side: '#76563a', top: '#936e48', mark: '#5a3f27', hi: '#a8845a' },
    moss: { side: '#47652a', top: '#5b8032', mark: '#35501c', hi: '#79a044' },
    coconut: { side: '#5a3c24', top: '#6e4b2e', mark: '#3e2816', hi: '#8a6440' },
    dish: { side: '#d6d1c6', top: '#e6e2d8', mark: '#b8b2a6', hi: '#f4f0e8' },
    ruin: { side: '#88887e', top: '#9c9c90', mark: '#66665e', hi: '#b0b0a4' },
    terracotta: { side: '#a8573a', top: '#c06a48', mark: '#7e3e28', hi: '#d88a62' },
    mosswall: { side: '#3d5a24', top: '#4f7a2c', mark: '#2a3e18', hi: '#6e9a3a', soft: true },
    barkwall: { side: '#5a3a24', top: '#6e4a2e', mark: '#2e1c10', hi: '#8a6444', soft: true },
    stonewall: { side: '#5e5a52', top: '#7a766c', mark: '#3a3732', hi: '#9a968a', soft: true },
    leafwall: { side: '#4a3220', top: '#6a4a2a', mark: '#2e1e12', hi: '#8a6436', soft: true },
    trunkwall: { side: '#5e4632', top: '#8a6a4a', mark: '#33241a', hi: '#7e624a', soft: true },
    rootwall: { side: '#33251a', top: '#4a3626', mark: '#1e140c', hi: '#6a4e36', soft: true },
    sandwall: { side: '#b88452', top: '#cc9a64', mark: '#8e6038', hi: '#dcb07a', soft: true },
    driftwall: { side: '#9a9184', top: '#b0a898', mark: '#6a6258', hi: '#c8c0b2', soft: true },
    fungus: { side: '#b8742e', top: '#e2c08a', mark: '#8a4e1e', hi: '#f0d8a8' },
    coir: { side: '#6a4a2c', top: '#3a2a1a', mark: '#4a321c', hi: '#8a6a44' },
    drift: { side: '#a49a8a', top: '#bcb4a4', mark: '#746c60', hi: '#d0c8ba' },
  };
  D.STY = STY;
  const L = JT.LIGHT;
  function hashId(s) { return JT.hashStr(String(s)); }
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }

  /** Draw a whole decor object. o: {alpha, sway:[x,z], night, time, ghost} */
  D.decor = function (ctx, V, g, o) {
    o = o || {};
    const sw = o.sway; const H = Math.max(4, g.height);
    const P = sw ? (p) => { const k = Math.min(1.2, Math.max(0, (p[1] - g.baseY) / H)); const kk = k * k; return V.P([p[0] + sw[0] * kk, p[1], p[2] + sw[2] * kk]); } : (p) => V.P(p);
    const key = V.yaw.toFixed(2) + V.pitch.toFixed(2);
    if (g._ok !== key) {
      g._order = g.prims.map((pr, i) => [i, primDepth(V, pr)]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
      g._ok = key;
    }
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    for (const i of g._order) {
      const pr = g.prims[i];
      if (pr.nv && pr.nv[1] < 0.5 && pr.nv[0] * V.toCam[0] + pr.nv[2] * V.toCam[2] < -0.02) continue; // wall-mounted item on the hidden face
      try { (PR[pr.t] || noop)(ctx, V, pr, g, P, o); } catch (e) { if (JT.DEV) console.warn(e); }
    }
    ctx.globalAlpha = 1;
  };
  function noop() { }
  function primDepth(V, pr) {
    if (pr.ws) { const c = JT.G.centroid(pr.poly); const d = V.depth([c[0], pr.y1, c[1]]); return pr.ws[0] * V.toCam[0] + pr.ws[2] * V.toCam[2] >= -0.02 ? -1e6 + d : 1e6 + d; } // ledge on a wall face
    if (pr.t === 'prism') { const c = JT.G.centroid(pr.poly); return V.depth([c[0], pr.y0, c[1]]) + 0.01; }
    if (pr.nv && pr.t === 'tube') return -1e6 + V.depth(pr.pts[Math.floor(pr.pts.length / 2)]);
    if (pr.nv && pr.t === 'leaf') return -1e6 + V.depth(pr.o);
    if (pr.t === 'tube') { const a = pr.pts[0], b = pr.pts[pr.pts.length - 1]; const m = pr.pts[Math.floor(pr.pts.length / 2)]; return (V.depth(a) + V.depth(b) + V.depth(m)) / 3 - (pr.style === 'bark' && pr.r0 > 2 ? 0 : 0); }
    if (pr.t === 'log') return V.depth(M.lerp3(pr.a, pr.b, 0.5));
    if (pr.t === 'leaf') return V.depth(M.add(pr.o, M.mul(pr.a, 0.5)));
    if (pr.t === 'moss') return 1e6;
    if (pr.nv) return -1e6 + V.depth(pr.o); // mounted on a wall face: always over the wall itself
    if (pr.o) return V.depth(pr.o) - (pr.t === 'bloom' || pr.t === 'cap' ? 0.5 : 0);
    return 0;
  }
  /** Soft contact shadow under an object. */
  D.decorShadow = function (ctx, V, g, night) {
    if (g.def.cat === 'ground') return;
    const fp = g.foot; if (!fp) return;
    const c = JT.G.centroid(fp); const solid = g.solids.length > 0;
    const r = solid ? Math.sqrt(JT.G.polyArea(fp) / Math.PI) * 1.1 : Math.min(18, g.coverR * 0.55);
    const day = 1 - night * 0.6;
    // 1) tight contact occlusion where the object meets the ground
    softEll(ctx, V, [c[0], g.baseY + 0.05, c[1]], [r * 1.02, 0, 0], [0, 0, r * 1.02], 0.42 * (solid ? 1 : 0.75) - night * 0.12, 0.35);
    // 2) long soft cast shadow thrown away from the light, scaled by object height
    const Lh = [L[0], L[2]]; const ll = Math.hypot(Lh[0], Lh[1]) || 1; const dir = [-Lh[0] / ll, -Lh[1] / ll];
    const len = Math.min(70, Math.max(4, g.height) * ll / Math.max(0.3, L[1])) * (solid ? 0.9 : 0.75);
    const cc = [c[0] + dir[0] * len * 0.45, g.baseY + 0.04, c[1] + dir[1] * len * 0.45];
    softEll(ctx, V, cc, [dir[0] * (r + len * 0.5), 0, dir[1] * (r + len * 0.5)], [-dir[1] * r * (solid ? 0.95 : 0.8), 0, dir[0] * r * (solid ? 0.95 : 0.8)], 0.26 * day, 0.05);
  };
  function softEll(ctx, V, c, ax, az, a, inner) {
    if (a <= 0.005) return; const C = V.P(c), A = V.J(ax), B = V.J(az);
    if (Math.abs(A[0] * B[1] - A[1] * B[0]) < 0.5) return;
    ctx.save(); ctx.transform(A[0], A[1], B[0], B[1], C[0], C[1]);
    const gr = ctx.createRadialGradient(0, 0, inner, 0, 0, 1); gr.addColorStop(0, 'rgba(14,8,3,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(14,8,3,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.283); ctx.fill(); ctx.restore();
  }

  const PR = {};
  // ---------- prisms (rocks, cork, hides, dish, ruins) ----------
  PR.prism = function (ctx, V, pr, g, P, o) {
    const st = STY[pr.style] || STY.rock; const base = pr.poly, top = pr.topPoly || pr.poly; const n = base.length;
    const c = JT.G.centroid(base);
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; const a = base[i], b = base[j];
      let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const mx = (a[0] + b[0]) / 2 - c[0], mz = (a[1] + b[1]) / 2 - c[1]; if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      const vis = nx * V.toCam[0] + nz * V.toCam[2];
      if (vis <= 0.001) continue;
      faces.push({ i, j, nx, nz, d: V.depth([(a[0] + b[0]) / 2, pr.y0, (a[1] + b[1]) / 2]) });
    }
    faces.sort((x, y) => y.d - x.d);
    const tex = pr._tex || (pr._tex = makeTex(pr, g));
    for (const f of faces) {
      const a = base[f.i], b = base[f.j], ta = top[f.i], tb = top[f.j];
      const q = [P([a[0], pr.y0, a[1]]), P([b[0], pr.y0, b[1]]), P([tb[0], pr.y1, tb[1]]), P([ta[0], pr.y1, ta[1]])];
      const lit = 0.62 + 0.55 * Math.max(0, f.nx * L[0] + f.nz * L[2]);
      const gr = ctx.createLinearGradient(0, q[3][1], 0, q[0][1]);
      gr.addColorStop(0, sh(st.side, (lit - 1) * 0.8 + 0.06)); gr.addColorStop(1, sh(st.side, (lit - 1) * 0.8 - 0.22));
      ctx.fillStyle = gr; poly(ctx, q); ctx.fill();
      if (!st.soft) { ctx.strokeStyle = sh(st.side, -0.35); ctx.lineWidth = Math.max(0.6, V.s * 0.15); ctx.stroke(); }
      // face texture (cached in face-local coordinates)
      const marks = tex[f.i]; if (!marks) continue;
      const at = (u, v) => { const x0 = M.lerp(a[0], b[0], u), z0 = M.lerp(a[1], b[1], u), x1 = M.lerp(ta[0], tb[0], u), z1 = M.lerp(ta[1], tb[1], u); return P([M.lerp(x0, x1, v), M.lerp(pr.y0, pr.y1, v), M.lerp(z0, z1, v)]); };
      ctx.save(); poly(ctx, q); ctx.clip();
      for (const m of marks) {
        if (m.k === 'line') { const p1 = at(m.u0, m.v0), p2 = at(m.u1, m.v1); ctx.strokeStyle = m.c; ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * m.a; ctx.lineWidth = Math.max(0.5, m.w * V.s); ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); }
        else { const p1 = at(m.u0, m.v0); ctx.fillStyle = m.c; ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * m.a; ctx.beginPath(); ctx.ellipse(p1[0], p1[1], Math.max(0.5, m.w * V.s), Math.max(0.4, m.h * V.s), 0, 0, 6.283); ctx.fill(); }
      }
      ctx.restore(); ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
    }
    // hide doorway on the face nearest its local front
    if (pr.door) {
      let bi = -1, bd = -2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; const a = base[i], b = base[j]; let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; const mx = (a[0] + b[0]) / 2 - c[0], mz = (a[1] + b[1]) / 2 - c[1]; if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; } const dd = nx * pr.doorDir[0] + nz * pr.doorDir[2]; if (dd > bd) { bd = dd; bi = i; } }
      const j = (bi + 1) % n; const a = base[bi], b = base[j];
      let nx = b[1] - a[1], nz = -(b[0] - a[0]); const vis = (nx * V.toCam[0] + nz * V.toCam[2]) * ((nx * ((a[0] + b[0]) / 2 - c[0]) + nz * ((a[1] + b[1]) / 2 - c[1])) < 0 ? -1 : 1);
      if (vis > 0) {
        const m0 = P([(a[0] + b[0]) / 2, pr.y0, (a[1] + b[1]) / 2]); const hgt = (pr.y1 - pr.y0) * 0.55; const w = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.28;
        const ax = V.J([(b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]) * w, 0, (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]) * w]); const up = V.J([0, hgt, 0]);
        ctx.save(); ctx.transform(ax[0], ax[1], up[0], up[1], m0[0], m0[1]);
        ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-1, 0.55); ctx.bezierCurveTo(-1, 1.15, 1, 1.15, 1, 0.55); ctx.lineTo(1, 0); ctx.closePath();
        ctx.fillStyle = '#140c06'; ctx.fill(); ctx.restore();
      }
    }
    // top
    const tq = top.map(t => P([t[0], pr.y1, t[1]]));
    if (pr.style === 'dish') {
      ctx.fillStyle = st.top; poly(ctx, tq); ctx.fill();
      const inner = JT.G.scalePoly(top, 0.82).map(t => P([t[0], pr.y1 - 0.2, t[1]]));
      const gr = ctx.createLinearGradient(inner[0][0], inner[0][1], inner[Math.floor(inner.length / 2)][0], inner[Math.floor(inner.length / 2)][1]);
      gr.addColorStop(0, '#6aa6c8'); gr.addColorStop(1, '#2f6688'); ctx.fillStyle = gr; poly(ctx, inner); ctx.fill();
      ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * 0.5; ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = Math.max(0.6, V.s * 0.2); ctx.beginPath(); const cc = JT.G.centroid(inner); ctx.ellipse(cc[0] - V.s * 2, cc[1] - V.s * 0.6, V.s * 2.5, V.s * 0.6, -0.2, 3.5, 5.6); ctx.stroke(); ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
      return;
    }
    const gr = ctx.createLinearGradient(tq[0][0], tq[0][1] - V.s * 10, tq[0][0], tq[0][1] + V.s * 10);
    gr.addColorStop(0, sh(st.top, 0.1)); gr.addColorStop(1, sh(st.top, -0.08));
    ctx.fillStyle = gr; poly(ctx, tq); ctx.fill();
    ctx.strokeStyle = sh(st.hi, 0.05); ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * 0.55; ctx.lineWidth = Math.max(0.6, V.s * 0.25); ctx.stroke(); ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
    const tt = pr._ttex || (pr._ttex = topTex(pr, g));
    for (const m of tt) {
      const p1 = P([m.x, pr.y1, m.z]);
      ctx.fillStyle = m.c; ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * m.a; ctx.beginPath(); ctx.ellipse(p1[0], p1[1], Math.max(0.5, m.r * V.s), Math.max(0.4, m.r * V.s * V.sp), 0, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
  };
  function makeTex(pr, g) {
    const rng = JT.makeRng(hashId(g.id + pr.y0 + pr.style)); const st = STY[pr.style] || STY.rock; const n = pr.poly.length; const H = pr.y1 - pr.y0;
    const out = [];
    for (let i = 0; i < n; i++) {
      const m = []; const a = pr.poly[i], b = pr.poly[(i + 1) % n]; const W = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const S = pr.style;
      if (S === 'slate' || S === 'sand' || S === 'ruin') {
        const rows = Math.max(2, Math.round(H / (S === 'slate' ? 3 : 4.5)));
        for (let r = 1; r < rows; r++) { const v = r / rows + (rng() - .5) * 0.04; m.push({ k: 'line', u0: 0, v0: v, u1: 1, v1: v + (rng() - .5) * 0.03, c: st.mark, a: 0.6, w: 0.22 }); }
        if (S === 'ruin') for (let r = 0; r < rows; r++) { const off = r % 2 ? 0.5 : 0; for (let u = off; u < W; u += 7) m.push({ k: 'line', u0: u / W, v0: r / rows, u1: u / W, v1: (r + 1) / rows, c: st.mark, a: 0.5, w: 0.2 }); }
        if (S === 'sand') for (let k = 0; k < W * H / 30; k++) m.push({ k: 'dot', u0: rng(), v0: rng(), w: 0.3, h: 0.25, c: rng() < .5 ? st.hi : st.mark, a: 0.5 });
      } else if (S === 'cork' || S === 'coconut') {
        for (let k = 0; k < W * H / 14; k++) { const u = rng(), v = rng(); m.push({ k: 'dot', u0: u, v0: v, w: 0.8 + rng() * 1.6, h: 0.6 + rng() * 1.8, c: rng() < 0.6 ? st.mark : st.hi, a: 0.55 }); }
        for (let k = 0; k < W / 3; k++) { const u = rng(); m.push({ k: 'line', u0: u, v0: 0, u1: u + (rng() - .5) * 0.08, v1: 0.4 + rng() * 0.6, c: st.mark, a: 0.5, w: 0.25 }); }
      } else if (S === 'wood' || S === 'terracotta') {
        for (let k = 0; k < W / 2; k++) { const u = rng(); m.push({ k: 'line', u0: u, v0: 0, u1: u + (rng() - .5) * 0.05, v1: 1, c: st.mark, a: 0.4, w: 0.18 }); }
      } else if (S === 'mosswall') {
        // dark cork showing through dense cushion moss
        for (let k = 0; k < W * H / 7; k++) m.push({ k: "dot", u0: rng(), v0: rng(), w: 0.7 + rng() * 1.5, h: 0.6 + rng() * 1.3, c: ['#5f8f2e', '#4a7a26', '#79a83a', '#2e4a1a', '#8ab848'][k % 5], a: 0.7 });
        for (let k = 0; k < W / 6; k++) { const u = rng(), v = rng(); m.push({ k: 'dot', u0: u, v0: v, w: 1.5 + rng() * 2, h: 2 + rng() * 4, c: '#3a2616', a: 0.55 }); }
      } else if (S === 'barkwall') {
        for (let k = 0; k < W * H / 12; k++) m.push({ k: 'dot', u0: rng(), v0: rng(), w: 0.8 + rng() * 1.8, h: 0.8 + rng() * 2.4, c: rng() < 0.55 ? st.mark : st.hi, a: 0.5 });
        for (let k = 0; k < W / 2.2; k++) { const u = rng(), v = rng() * 0.8; m.push({ k: 'line', u0: u, v0: v, u1: u + (rng() - .5) * 0.06, v1: v + 0.06 + rng() * 0.3, c: '#1e120a', a: 0.65, w: 0.35 + rng() * 0.5 }); }
      } else if (S === 'stonewall') {
        const rows = Math.max(3, Math.round(H / 7)); // irregular fieldstones in mortar
        for (let r = 0; r < rows; r++) { let u = rng() * 0.05; while (u < 1) { const sw = (5 + rng() * 6) / W; const cu = u + sw / 2, cv = (r + 0.5 + (rng() - 0.5) * 0.25) / rows; const sh2 = (2.6 + rng() * 1.6); m.push({ k: 'dot', u0: cu, v0: cv, w: sw * W * 0.5 + 0.4, h: sh2 + 0.4, c: st.mark, a: 0.7 }); m.push({ k: 'dot', u0: cu, v0: cv, w: sw * W * 0.46, h: sh2, c: ['#7a766c', '#6e6a60', '#86827a', '#625e56', '#8a8270'][(rng() * 5) | 0], a: 0.95 }); m.push({ k: 'dot', u0: cu - sw * 0.12, v0: cv + 0.25 / rows, w: sw * W * 0.22, h: sh2 * 0.35, c: st.hi, a: 0.35 }); u += sw + 0.4 / W; } }
      } else if (S === 'leafwall') {
        for (let k = 0; k < W * H / 9; k++) m.push({ k: 'dot', u0: rng(), v0: rng(), w: 0.8 + rng() * 1.6, h: 0.5 + rng() * 1, c: ['#6a4426', '#8a5a2e', '#4a3020', '#a06a34'][k % 4], a: 0.6 });
      } else if (S === 'trunkwall') {
        for (let k = 0; k < W / 1.6; k++) { const u = rng(); let v = 0, uu = u; while (v < 1) { const dv = 0.05 + rng() * 0.12, du = (rng() - 0.5) * 0.02; m.push({ k: 'line', u0: uu, v0: v, u1: uu + du, v1: v + dv, c: k % 3 ? st.mark : '#24180e', a: 0.6, w: 0.3 + rng() * 0.45 }); uu += du; v += dv + rng() * 0.03; } }
        for (let k = 0; k < W / 10; k++) m.push({ k: 'dot', u0: rng(), v0: rng(), w: 1 + rng() * 2.5, h: 0.6 + rng(), c: st.hi, a: 0.35 });
        if (W > 20) { const u = 0.3 + rng() * 0.4, v = 0.25 + rng() * 0.5; m.push({ k: 'dot', u0: u, v0: v, w: 4.5, h: 6, c: '#3a2a1c', a: 0.9 }); m.push({ k: 'dot', u0: u, v0: v, w: 3, h: 4.4, c: '#140c06', a: 0.95 }); }
      } else if (S === 'rootwall') {
        for (let k = 0; k < W * H / 8; k++) m.push({ k: 'dot', u0: rng(), v0: rng(), w: 0.5 + rng() * 1.2, h: 0.5 + rng(), c: ['#2a1e14', '#4a3624', '#3a2a1c', '#5a4430'][k % 4], a: 0.6 });
        for (let k = 0; k < W / 3; k++) { const u = rng(), v = rng(); m.push({ k: 'line', u0: u, v0: v, u1: u + (rng() - .5) * 0.15, v1: v + (rng() - .5) * 0.1, c: '#7a5a3a', a: 0.5, w: 0.2 }); } // fine rootlets
      } else if (S === 'sandwall') {
        let v = 0; const bands = ['#c48e58', '#b07a48', '#d4a068', '#a86e40', '#caa070', '#bc8450'];
        while (v < 1) { const dv = (1.2 + rng() * 3.4) / H; m.push({ k: 'line', u0: 0, v0: v + dv / 2, u1: 1, v1: v + dv / 2 + (rng() - 0.5) * 0.01, c: bands[(rng() * bands.length) | 0], a: 0.75, w: dv * H * 0.95 }); if (rng() < 0.5) m.push({ k: 'line', u0: 0, v0: v, u1: 1, v1: v + (rng() - .5) * 0.008, c: st.mark, a: 0.45, w: 0.2 }); v += dv; }
        for (let k = 0; k < W * H / 30; k++) m.push({ k: 'dot', u0: rng(), v0: rng(), w: 0.4 + rng() * 0.9, h: 0.3 + rng() * 0.7, c: rng() < 0.6 ? '#7a5030' : st.hi, a: 0.55 });
      } else if (S === 'driftwall' || S === 'drift') {
        for (let k = 0; k < W / 0.9; k++) { const u = rng(); m.push({ k: 'line', u0: u, v0: rng() * 0.2, u1: u + (rng() - .5) * 0.04, v1: 0.6 + rng() * 0.4, c: rng() < 0.6 ? st.mark : st.hi, a: 0.45, w: 0.15 + rng() * 0.25 }); }
        for (let u = 0.08 + rng() * 0.1; u < 1; u += 0.12 + rng() * 0.14) m.push({ k: 'line', u0: u, v0: 0, u1: u + (rng() - .5) * 0.02, v1: 1, c: '#4a443c', a: 0.7, w: 0.5 });
      } else if (S === 'fungus') {
        for (let k = 0; k < 3; k++) { const v = 0.25 + k * 0.25; m.push({ k: 'line', u0: 0, v0: v, u1: 1, v1: v, c: k % 2 ? '#e8b060' : '#8a4e1e', a: 0.6, w: 0.4 }); }
      } else if (S === 'coir') {
        for (let k = 0; k < W * H / 3; k++) { const u = rng(), v = rng(); m.push({ k: 'line', u0: u, v0: v, u1: u + (rng() - .5) * 0.25, v1: v + (rng() - .5) * 0.25, c: rng() < 0.5 ? st.mark : st.hi, a: 0.6, w: 0.2 }); }
      } else if (S === 'moss') {
        for (let k = 0; k < W * H / 10; k++) m.push({ k: 'dot', u0: rng(), v0: rng(), w: 0.8 + rng(), h: 0.8 + rng(), c: rng() < .5 ? st.hi : st.mark, a: 0.6 });
      } else {
        for (let k = 0; k < W * H / 26; k++) m.push({ k: 'dot', u0: rng(), v0: rng(), w: 0.4 + rng() * 0.9, h: 0.3 + rng() * 0.6, c: rng() < .5 ? st.hi : st.mark, a: 0.45 });
        if (S === 'rock') for (let k = 0; k < 2; k++) { const u = rng(); m.push({ k: 'line', u0: u, v0: rng() * 0.3, u1: u + (rng() - .5) * 0.2, v1: 0.5 + rng() * 0.5, c: st.mark, a: 0.6, w: 0.2 }); }
      }
      out.push(m);
    }
    return out;
  }
  function topTex(pr, g) {
    const rng = JT.makeRng(hashId(g.id + 'top' + pr.y1)); const st = STY[pr.style] || STY.rock; const tp = pr.topPoly || pr.poly; const c = JT.G.centroid(tp);
    const out = []; const area = JT.G.polyArea(tp); const n = Math.min(60, area / 18);
    for (let k = 0; k < n; k++) { const v = tp[Math.floor(rng() * tp.length)]; const t = Math.sqrt(rng()) * 0.9; const x = M.lerp(c[0], v[0], t), z = M.lerp(c[1], v[1], t); out.push({ x, z, r: 0.4 + rng() * (pr.style === 'cork' ? 1.6 : 0.9), c: rng() < 0.5 ? st.mark : st.hi, a: 0.4 }); }
    if (pr.style === 'cork' || pr.style === 'wood') for (let r = 1; r <= 3; r++) { const q = JT.G.scalePoly(tp, r / 4, c); for (let i = 0; i < q.length; i += 1) out.push({ x: q[i][0], z: q[i][1], r: 0.35, c: st.mark, a: 0.5 }); }
    if (pr.style === 'moss' || pr.style === 'mosswall' || g.def.id === 'mossstone') for (let k = 0; k < 20; k++) { const v = tp[Math.floor(rng() * tp.length)]; const t = rng(); out.push({ x: M.lerp(c[0], v[0], t), z: M.lerp(c[1], v[1], t), r: 1 + rng() * 1.4, c: rng() < .5 ? '#6a9a3a' : '#4a7a2a', a: 0.8 }); }
    return out;
  }
  // ---------- logs / tubes / pots ----------
  PR.log = function (ctx, V, pr, g, P, o) {
    const st = STY[pr.style] || STY.wood; const r = pr.r;
    const ax = M.norm(M.sub(pr.b, pr.a)); const w = M.norm(M.cross([0, 1, 0], ax)); const u = [0, 1, 0];
    const Ju = V.J(M.mul(u, r)), Jw = V.J(M.mul(w, r));
    const A = P(pr.a), B = P(pr.b); let nA = [-(B[1] - A[1]), B[0] - A[0]]; const nl = Math.hypot(nA[0], nA[1]) || 1; nA = [nA[0] / nl, nA[1] / nl];
    // support of ellipse along nA
    const th = Math.atan2(Jw[0] * nA[0] + Jw[1] * nA[1], Ju[0] * nA[0] + Ju[1] * nA[1]);
    const e = [Ju[0] * Math.cos(th) + Jw[0] * Math.sin(th), Ju[1] * Math.cos(th) + Jw[1] * Math.sin(th)];
    const lo = pr.half ? 0 : 1;
    ctx.beginPath(); ctx.moveTo(A[0] + e[0], A[1] + e[1]); ctx.lineTo(B[0] + e[0], B[1] + e[1]); ctx.lineTo(B[0] - e[0], B[1] - e[1]); ctx.lineTo(A[0] - e[0], A[1] - e[1]); ctx.closePath();
    const gr = ctx.createLinearGradient(A[0] - e[0], A[1] - e[1], A[0] + e[0], A[1] + e[1]);
    gr.addColorStop(0, sh(st.side, 0.18)); gr.addColorStop(0.45, st.side); gr.addColorStop(1, sh(st.side, -0.45));
    ctx.fillStyle = gr; ctx.fill();
    // bark ridges along the length
    const rng = JT.makeRng(hashId(g.id + 'log'));
    ctx.strokeStyle = st.mark; ctx.lineWidth = Math.max(0.6, V.s * 0.25); ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * 0.55;
    for (let k = 0; k < 9; k++) { const f = rng() * 1.8 - 0.9; const t0 = rng() * 0.6, t1 = t0 + 0.2 + rng() * 0.4; ctx.beginPath(); ctx.moveTo(M.lerp(A[0], B[0], t0) + e[0] * f, M.lerp(A[1], B[1], t0) + e[1] * f); ctx.lineTo(M.lerp(A[0], B[0], t1) + e[0] * f, M.lerp(A[1], B[1], t1) + e[1] * f); ctx.stroke(); }
    ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
    // visible end cap (nearer end)
    const near = V.depth(pr.a) < V.depth(pr.b) ? A : B; const sgn = near === A ? -1 : 1;
    if (M.dot(M.mul(ax, sgn), V.toCam) > -0.05) {
      ctx.save(); ctx.transform(Jw[0], Jw[1], Ju[0], Ju[1], near[0], near[1]);
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.283); ctx.fillStyle = sh(st.top, 0.05); ctx.fill();
      ctx.lineWidth = 0.06; ctx.strokeStyle = st.mark; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(0, 0, k / 4, 0, 6.283); ctx.stroke(); }
      if (pr.hollow) { ctx.beginPath(); ctx.arc(0, 0, 0.7, 0, 6.283); ctx.fillStyle = '#160d06'; ctx.fill(); }
      ctx.restore();
    }
  };
  PR.pot = function (ctx, V, pr, g, P, o) {
    const c = pr.o, r = pr.r, h = pr.h; const top = P([c[0], c[1] + h, c[2]]), bot = P([c[0], c[1], c[2]]);
    const rx = r * V.s, ry = r * V.s * V.sp;
    ctx.fillStyle = sh(pr.col, -0.15); ctx.beginPath(); ctx.moveTo(top[0] - rx, top[1]); ctx.lineTo(bot[0] - rx * 0.8, bot[1]); ctx.ellipse(bot[0], bot[1], rx * 0.8, ry * 0.8, 0, Math.PI, 0, true); ctx.lineTo(top[0] + rx, top[1]); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pr.col; ctx.beginPath(); ctx.ellipse(top[0], top[1], rx, ry, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#3a2618'; ctx.beginPath(); ctx.ellipse(top[0], top[1], rx * 0.82, ry * 0.82, 0, 0, 6.283); ctx.fill();
  };
  PR.tube = function (ctx, V, pr, g, P, o) {
    const pts = pr.pts.map(P); const n = pts.length; if (n < 2) return;
    const s = V.s; const col = pr.col;
    if (pr.style === 'blade') {
      // tapered blade as filled strip
      const left = [], right = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const w = M.lerp(pr.r0, pr.r1, i / (n - 1)) * s;
        left.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); right.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
      }
      ctx.beginPath(); ctx.moveTo(left[0][0], left[0][1]); for (const q of left) ctx.lineTo(q[0], q[1]); for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = pr.stripe || sh(col, 0.25); ctx.lineWidth = Math.max(0.5, pr.r0 * s * (pr.stripe ? 0.6 : 0.3)); ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * 0.7;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
      return;
    }
    if (pr.style === 'plank') {
      for (let i = 0; i < n - 1; i++) {
        const a = pr.pts[i], b = pr.pts[i + 1]; const t = M.norm(M.sub(b, a)); const side = M.norm(M.cross(t, [0, 1, 0])); const w = (pr.w || 8) / 2;
        const q = [P(M.add(a, M.mul(side, w))), P(M.add(b, M.mul(side, w))), P(M.sub(b, M.mul(side, w))), P(M.sub(a, M.mul(side, w)))];
        poly(ctx, q); ctx.fillStyle = sh(col, i % 2 ? 0.05 : -0.08); ctx.fill(); ctx.strokeStyle = sh(col, -0.4); ctx.lineWidth = Math.max(0.5, s * 0.2); ctx.stroke();
      }
      ctx.strokeStyle = '#c8b48a'; ctx.lineWidth = Math.max(0.5, s * 0.25);
      for (const sd of [-1, 1]) { ctx.beginPath(); pr.pts.forEach((a, i) => { const t = M.norm(M.sub(pr.pts[Math.min(n - 1, i + 1)], pr.pts[Math.max(0, i - 1)])); const side = M.norm(M.cross(t, [0, 1, 0])); const q = P(M.add(M.add(a, M.mul(side, sd * (pr.w || 8) / 2)), [0, 2.5, 0])); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); }
      return;
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const base = pr.style === 'drift' ? '#9a8c78' : col;
    const uniform = Math.abs(pr.r0 - pr.r1) < 0.15;
    const strokePass = (color, wmul, off) => {
      ctx.strokeStyle = color;
      if (uniform) { ctx.lineWidth = Math.max(0.6, pr.r0 * 2 * s * wmul); ctx.beginPath(); ctx.moveTo(pts[0][0] + off[0], pts[0][1] + off[1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0] + off[0], pts[i][1] + off[1]); ctx.stroke(); return; }
      for (let i = 0; i < n - 1; i++) { ctx.lineWidth = Math.max(0.6, M.lerp(pr.r0, pr.r1, (i + 0.5) / (n - 1)) * 2 * s * wmul); ctx.beginPath(); ctx.moveTo(pts[i][0] + off[0], pts[i][1] + off[1]); ctx.lineTo(pts[i + 1][0] + off[0], pts[i + 1][1] + off[1]); ctx.stroke(); }
    };
    strokePass(sh(base, -0.35), 1.0, [0, 0]);
    strokePass(base, 0.78, [-pr.r0 * s * 0.08, -pr.r0 * s * 0.1]);
    if (pr.r0 * s > 1.5) strokePass(sh(base, pr.style === 'drift' ? 0.3 : 0.22), 0.32, [-pr.r0 * s * 0.28, -pr.r0 * s * 0.32]);
    if ((pr.style === 'bark' || pr.style === 'palm') && pr.r0 * s > 3) {
      const rng = JT.makeRng(hashId(g.id + pts.length + pr.r0)); ctx.strokeStyle = sh(base, -0.5); ctx.lineWidth = Math.max(0.5, s * 0.22); ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * 0.6;
      for (let i = 0; i < n - 1; i++) { const k = pr.style === 'palm' ? 3 : 2; for (let q = 0; q < k; q++) { const t = rng(); const x = M.lerp(pts[i][0], pts[i + 1][0], t), y = M.lerp(pts[i][1], pts[i + 1][1], t); const r = M.lerp(pr.r0, pr.r1, i / (n - 1)) * s; const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1]; const l = Math.hypot(dx, dy) || 1; const px = -dy / l, py = dx / l; const f = (rng() - 0.5) * 1.2; ctx.beginPath(); if (pr.style === 'palm') { ctx.moveTo(x - px * r, y - py * r); ctx.lineTo(x + px * r, y + py * r); } else { ctx.moveTo(x + px * r * f, y + py * r * f); ctx.lineTo(x + px * r * f + dx / l * r * 0.8, y + py * r * f + dy / l * r * 0.8); } ctx.stroke(); } }
      ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
    }
  };
  // ---------- leaves ----------
  const SHAPES = {
    oval(c) { c.moveTo(0, 0); c.bezierCurveTo(0.22, 1.15, 0.72, 1.05, 1, 0); c.bezierCurveTo(0.72, -1.05, 0.22, -1.15, 0, 0); },
    lance(c) { c.moveTo(0, 0); c.bezierCurveTo(0.3, 0.9, 0.7, 0.55, 1, 0); c.bezierCurveTo(0.7, -0.55, 0.3, -0.9, 0, 0); },
    fat(c) { c.moveTo(0, 0); c.bezierCurveTo(0.1, 1.2, 0.8, 1.1, 1, 0); c.bezierCurveTo(0.8, -1.1, 0.1, -1.2, 0, 0); },
    heart(c) { c.moveTo(0.12, 0); c.bezierCurveTo(-0.15, 1.15, 0.55, 1.2, 1, 0); c.bezierCurveTo(0.55, -1.2, -0.15, -1.15, 0.12, 0); },
    round(c) { c.moveTo(0, 0); c.bezierCurveTo(0.2, 1.3, 1.1, 1.2, 1, 0); c.bezierCurveTo(1.1, -1.2, 0.2, -1.3, 0, 0); },
    ivy(c) { c.moveTo(0.05, 0); c.lineTo(0.3, 0.9); c.lineTo(0.55, 0.5); c.lineTo(1, 0); c.lineTo(0.55, -0.5); c.lineTo(0.3, -0.9); c.closePath(); },
    oak(c) { c.moveTo(0, 0); for (let i = 0; i <= 8; i++) { const t = i / 8; c.lineTo(t, Math.sin(t * Math.PI) * (0.7 + 0.35 * Math.cos(i * 2.2))); } for (let i = 8; i >= 0; i--) { const t = i / 8; c.lineTo(t, -Math.sin(t * Math.PI) * (0.7 + 0.35 * Math.cos(i * 2.2 + 1))); } c.closePath(); },
    chip(c) { c.moveTo(0, -0.6); c.lineTo(0.9, -0.9); c.lineTo(1, 0.5); c.lineTo(0.15, 0.9); c.closePath(); },
  };
  PR.leaf = function (ctx, V, pr, g, P, o) {
    const O = P(pr.o); const A = V.J(pr.a), B = V.J(pr.b);
    const det = A[0] * B[1] - A[1] * B[0]; const nrm = M.cross(pr.a, pr.b); const nl = M.len(nrm) || 1;
    const facing = (nrm[0] * V.toCam[0] + nrm[1] * V.toCam[1] + nrm[2] * V.toCam[2]) / nl; // >0 top visible (n mostly up)
    const up = nrm[1] >= 0 ? 1 : -1; const topVis = facing * up > 0;
    const lit = 0.78 + 0.32 * Math.abs((nrm[0] * L[0] + nrm[1] * L[1] + nrm[2] * L[2]) / nl);
    let col = topVis ? sh(pr.col, (lit - 1)) : sh(pr.col, 0.12);
    const size = Math.hypot(A[0], A[1]);
    if (size < 1.6) { ctx.fillStyle = col; ctx.fillRect(O[0] + A[0] * 0.5 - 0.7, O[1] + A[1] * 0.5 - 0.7, 1.4, 1.4); return; }
    if (Math.abs(det) < 0.6) { ctx.strokeStyle = sh(col, -0.2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(O[0], O[1]); ctx.lineTo(O[0] + A[0], O[1] + A[1]); ctx.stroke(); return; }
    ctx.save(); ctx.transform(A[0], A[1], B[0], B[1], O[0], O[1]);
    ctx.beginPath(); (SHAPES[pr.shape] || SHAPES.oval)(ctx);
    if (pr.col2 && size > 6) { const gr = ctx.createLinearGradient(0, 0, 1, 0); gr.addColorStop(0, col); gr.addColorStop(1, topVis ? pr.col2 : sh(pr.col2, 0.15)); ctx.fillStyle = gr; } else ctx.fillStyle = col;
    ctx.fill();
    if (size > 7) {
      ctx.save(); ctx.clip();
      if (pr.stripe) { ctx.fillStyle = sh(pr.col, -0.3); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(0.12 + k * 0.15, 0, 0.035, 0.75, 0, 0, 6.283); ctx.fill(); } }
      if (pr.variegate) { ctx.fillStyle = pr.variegate; ctx.globalAlpha *= 0.45; ctx.beginPath(); ctx.ellipse(0.5, 0.25, 0.25, 0.2, 0.5, 0, 6.283); ctx.fill(); }
      if (pr.fat) { const gr2 = ctx.createLinearGradient(0, -1, 0, 1); gr2.addColorStop(0, 'rgba(255,255,255,0.25)'); gr2.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = gr2; ctx.fillRect(0, -1.2, 1.1, 2.4); }
      ctx.restore();
    }
    ctx.restore();
    if (size > 5) {
      ctx.strokeStyle = pr.vein || sh(col, 0.22); ctx.lineWidth = Math.max(0.5, size * 0.03); ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * 0.6;
      ctx.beginPath(); ctx.moveTo(O[0], O[1]); ctx.lineTo(O[0] + A[0] * 0.92, O[1] + A[1] * 0.92); ctx.stroke();
      if (size > 14 || pr.vein) { for (let k = 1; k <= 4; k++) { const t = k / 5; const bx = O[0] + A[0] * t, by = O[1] + A[1] * t; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + A[0] * 0.12 + B[0] * 0.6 * sd, by + A[1] * 0.12 + B[1] * 0.6 * sd); ctx.stroke(); } } }
      if (pr.split && size > 10) { ctx.strokeStyle = 'rgba(10,20,8,0.55)'; ctx.lineWidth = Math.max(0.8, size * 0.035); for (let k = 1; k <= 4; k++) { const t = 0.2 + k * 0.15; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(O[0] + A[0] * t + B[0] * 0.95 * sd, O[1] + A[1] * t + B[1] * 0.95 * sd); ctx.lineTo(O[0] + A[0] * (t + 0.04) + B[0] * 0.45 * sd, O[1] + A[1] * (t + 0.04) + B[1] * 0.45 * sd); ctx.stroke(); } } }
      ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
    }
  };
  PR.bloom = function (ctx, V, pr, g, P, o) {
    const p = P(pr.o); const r = pr.r * V.s; const sq = 0.55 + V.sp * 0.4;
    const k = pr.kind;
    if (k === 'bud') { ctx.fillStyle = pr.col; ctx.beginPath(); ctx.ellipse(p[0], p[1], r * 0.7, r, 0, 0, 6.283); ctx.fill(); return; }
    if (k === 'cluster') { const rng = JT.makeRng(hashId(g.id + pr.o[0])); for (let i = 0; i < 7; i++) { const a = rng() * 6.28, d = rng() * r * 0.8; ctx.fillStyle = sh(pr.col, (rng() - .5) * .25); ctx.beginPath(); ctx.arc(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d * sq, r * 0.42, 0, 6.283); ctx.fill(); ctx.fillStyle = pr.col2; ctx.beginPath(); ctx.arc(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d * sq, r * 0.1, 0, 6.283); ctx.fill(); } return; }
    if (k === 'daisy' || k === 'dried') {
      ctx.fillStyle = pr.col; const n = k === 'dried' ? 6 : 12;
      for (let i = 0; i < n; i++) { const a = i / n * 6.283; ctx.beginPath(); ctx.ellipse(p[0] + Math.cos(a) * r * 0.55, p[1] + Math.sin(a) * r * 0.55 * sq, r * 0.42, r * 0.14, a, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = pr.col2; ctx.beginPath(); ctx.ellipse(p[0], p[1], r * 0.3, r * 0.3 * sq, 0, 0, 6.283); ctx.fill(); return;
    }
    if (k === 'poppy') {
      for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + 0.4; ctx.fillStyle = sh(pr.col, i % 2 ? -0.1 : 0.05); ctx.beginPath(); ctx.ellipse(p[0] + Math.cos(a) * r * 0.35, p[1] + Math.sin(a) * r * 0.35 * sq - r * 0.1, r * 0.55, r * 0.5 * sq, a, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = pr.col2; ctx.beginPath(); ctx.arc(p[0], p[1] - r * 0.1, r * 0.2, 0, 6.283); ctx.fill(); return;
    }
    if (k === 'orchid') {
      for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 - 1.57; ctx.fillStyle = pr.col; ctx.beginPath(); ctx.ellipse(p[0] + Math.cos(a) * r * 0.45, p[1] + Math.sin(a) * r * 0.45, r * 0.42, r * 0.26, a, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = pr.col2; ctx.beginPath(); ctx.ellipse(p[0], p[1] + r * 0.25, r * 0.28, r * 0.22, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#f8e070'; ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.1, 0, 6.283); ctx.fill();
    }
  };
  PR.cap = function (ctx, V, pr, g, P, o) {
    const p = P(pr.o); const rx = pr.r * V.s, ry = pr.r * V.s * 0.62;
    if (pr.glow && o.night > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rx * 3.2); gr.addColorStop(0, 'rgba(150,255,200,' + (0.45 * o.night) + ')'); gr.addColorStop(1, 'rgba(150,255,200,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p[0], p[1], rx * 3.2, 0, 6.283); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = sh(pr.col, -0.3); ctx.beginPath(); ctx.ellipse(p[0], p[1], rx, rx * V.sp * 0.6, 0, 0, 6.283); ctx.fill();
    const gr = ctx.createRadialGradient(p[0] - rx * 0.3, p[1] - ry * 0.8, rx * 0.1, p[0], p[1] - ry * 0.3, rx * 1.1);
    gr.addColorStop(0, pr.glow ? '#f4fff0' : sh(pr.col, 0.3)); gr.addColorStop(1, pr.glow ? (o.night > 0.3 ? '#9affc8' : '#c8d8b0') : sh(pr.col, -0.2));
    ctx.fillStyle = gr; ctx.beginPath();
    if (pr.cone) { ctx.moveTo(p[0] - rx, p[1]); ctx.quadraticCurveTo(p[0] - rx * 0.55, p[1] - ry * 1.5, p[0], p[1] - ry * 1.55); ctx.quadraticCurveTo(p[0] + rx * 0.55, p[1] - ry * 1.5, p[0] + rx, p[1]); ctx.ellipse(p[0], p[1], rx, rx * V.sp * 0.6, 0, 0, Math.PI); }
    else ctx.ellipse(p[0], p[1], rx, ry, 0, Math.PI, 0);
    ctx.closePath(); ctx.fill();
    if (pr.spots && rx > 2) { // toadstool warts
      ctx.fillStyle = 'rgba(255,248,232,0.92)'; const sd = (pr.o[0] * 7 + pr.o[2] * 13) | 0;
      for (let k = 0; k < 6; k++) { const a = ((sd + k * 47) % 100) / 100, b = ((sd * 3 + k * 61) % 100) / 100; const x = p[0] + (a - 0.5) * rx * 1.3, y = p[1] - ry * (0.25 + b * 0.9) * (pr.cone ? 1.2 : 1); ctx.beginPath(); ctx.ellipse(x, y, rx * 0.11, rx * 0.08, 0, 0, 6.283); ctx.fill(); }
    }
    if (rx > 3) { ctx.strokeStyle = sh(pr.col, -0.5); ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * 0.6; ctx.lineWidth = Math.max(0.5, V.s * 0.12); ctx.stroke(); ctx.globalAlpha = o.alpha != null ? o.alpha : 1; }
  };
  // cushion moss clump: overlapping rounded lobes, lit from the light side
  PR.lampfoot = function (ctx, V, pr, g, P, o) {
    const c = P(pr.o), t = P([pr.o[0], pr.o[1] + 1, pr.o[2]]); const rx = pr.r * V.s, ry = Math.max(0.5, rx * V.sp);
    ctx.fillStyle = '#3a3026'; ctx.beginPath(); ctx.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); ctx.lineTo(t[0] - rx, t[1]); ctx.ellipse(t[0], t[1], rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a4a36'; ctx.beginPath(); ctx.ellipse(t[0], t[1], rx, ry, 0, 0, 6.283); ctx.fill();
  };
  /** Dome shade + bulb. The glow itself is drawn by the renderer's light pass so it survives night grading. */
  PR.lamp = function (ctx, V, pr, g, P, o) {
    const c = pr.o, r = pr.r, on = g.lampOn !== false; const s = V.s;
    const rim = P([c[0], c[1] - r * 0.3, c[2]]), top = P([c[0], c[1] + r * 0.7, c[2]]);
    const rx = r * s, ry = Math.max(rx * 0.12, rx * Math.abs(V.sp));
    // dome
    const gr = ctx.createLinearGradient(rim[0] - rx, top[1], rim[0] + rx, rim[1]);
    gr.addColorStop(0, '#6a5638'); gr.addColorStop(0.45, '#4a3a26'); gr.addColorStop(1, '#2a2016');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(rim[0] - rx, rim[1]);
    ctx.bezierCurveTo(rim[0] - rx, top[1] - ry * 0.2, rim[0] - rx * 0.35, top[1] - ry * 0.3, top[0], top[1]);
    ctx.bezierCurveTo(rim[0] + rx * 0.35, top[1] - ry * 0.3, rim[0] + rx, top[1] - ry * 0.2, rim[0] + rx, rim[1]);
    ctx.ellipse(rim[0], rim[1], rx, ry, 0, 0, Math.PI, false); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(230,200,140,0.35)'; ctx.lineWidth = Math.max(0.6, s * 0.18); ctx.beginPath(); ctx.ellipse(rim[0], rim[1], rx, ry, 0, 0, 6.283); ctx.stroke();
    // inside of the shade, seen from below or at a shallow angle
    if (V.sp < 0.35) { ctx.fillStyle = on ? '#f6dca0' : '#3a3024'; ctx.beginPath(); ctx.ellipse(rim[0], rim[1], rx * 0.9, ry * 0.9, 0, 0, 6.283); ctx.fill(); }
    const b = P([c[0], c[1] - r * 0.42, c[2]]); ctx.fillStyle = on ? '#fff4d6' : '#b8b0a2'; ctx.beginPath(); ctx.ellipse(b[0], b[1], rx * 0.36, Math.max(rx * 0.22, ry * 0.4), 0, 0, 6.283); ctx.fill();
  };
  PR.tuft = function (ctx, V, pr, g, P, o) {
    const p = P(pr.o); const R = pr.r * V.s; if (R < 0.6) return;
    const lob = pr._lob || (pr._lob = (() => { const r = JT.makeRng(pr.seed || 1); const a = []; for (let k = 0; k < 7; k++) { const t = r() * 6.28, d = r() * 0.6; a.push([Math.cos(t) * d, Math.sin(t) * d * 0.8, 0.35 + r() * 0.35, (r() - 0.5) * 0.2]); } return a; })());
    const lp = V.J([L[0], L[1], L[2]]); const ll = Math.hypot(lp[0], lp[1]) || 1; const lx = lp[0] / ll, ly = lp[1] / ll;
    ctx.fillStyle = sh(pr.col, -0.35); ctx.beginPath(); ctx.ellipse(p[0], p[1] + R * 0.12, R, R * 0.82, 0, 0, 6.283); ctx.fill();
    for (const b of lob) { const x = p[0] + b[0] * R, y = p[1] + b[1] * R, r = b[2] * R; ctx.fillStyle = sh(pr.col, b[3]); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); if (r > 1.5) { ctx.fillStyle = sh(pr.col, 0.12 + b[3]); ctx.beginPath(); ctx.arc(x + lx * r * 0.3, y + ly * r * 0.3, r * 0.55, 0, 6.283); ctx.fill(); } }
  };
  // bracket (shelf) fungus jutting out of a wall: a flat half-disc in the plane (outward, sideways)
  PR.shelf = function (ctx, V, pr, g, P, o) {
    const n = pr.nv, t = M.norm(M.cross([0, 1, 0], n)); const A = V.J(M.mul(n, pr.r)), Bt = V.J(M.mul(t, pr.r * 1.15)); const p = P(pr.o); const dn = V.J([0, -pr.r * 0.28, 0]);
    const half = (ox, oy, k) => { ctx.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI; const x = A[0] * Math.sin(a) * k + Bt[0] * Math.cos(a) * k, y = A[1] * Math.sin(a) * k + Bt[1] * Math.cos(a) * k; i ? ctx.lineTo(p[0] + ox + x, p[1] + oy + y) : ctx.moveTo(p[0] + ox + x, p[1] + oy + y); } ctx.closePath(); };
    ctx.fillStyle = sh(pr.col, -0.4); half(dn[0], dn[1], 1); ctx.fill();
    ctx.fillStyle = pr.col; half(0, 0, 1); ctx.fill();
    ctx.fillStyle = sh(pr.col, 0.25); half(0, 0, 0.62); ctx.fill();
    ctx.fillStyle = sh(pr.col, 0.45); half(0, 0, 0.3); ctx.fill();
    if (pr.r * V.s > 3) { ctx.strokeStyle = sh(pr.col, -0.55); ctx.lineWidth = Math.max(0.5, V.s * 0.12); half(0, 0, 1); ctx.stroke(); }
  };
  PR.moss = function (ctx, V, pr, g, P, o) {
    const base = pr.kind === 'lichen' ? '#b8c4a0' : pr.kind === 'clover' ? '#4a8a3a' : pr.col; const sq = Math.max(0.25, V.sp);
    for (const b of pr.blobs) { const p = P([b[0], g.baseY + 0.3, b[1]]); const r = b[2] * V.s; ctx.fillStyle = sh(base, -0.25 + b[3]); ctx.beginPath(); ctx.ellipse(p[0], p[1], r, r * sq, 0, 0, 6.283); ctx.fill(); }
    for (const b of pr.blobs) {
      const p = P([b[0], g.baseY + 0.6, b[1]]); const r = b[2] * V.s * 0.7;
      if (pr.kind === 'clover') { ctx.fillStyle = sh(base, 0.1 + b[3]); for (let k = 0; k < 3; k++) { const a = k * 2.09 + b[3] * 5; ctx.beginPath(); ctx.arc(p[0] + Math.cos(a) * r * 0.45, p[1] + Math.sin(a) * r * 0.45 * sq, r * 0.42, 0, 6.283); ctx.fill(); } }
      else { ctx.fillStyle = sh(base, 0.12 + b[3]); ctx.beginPath(); ctx.ellipse(p[0] - r * 0.15, p[1] - r * 0.2 * sq, r * 0.7, r * 0.6 * sq, 0, 0, 6.283); ctx.fill(); }
    }
  };
  PR.pebble = function (ctx, V, pr, g, P, o) {
    const p = P(pr.o); const r = pr.r * V.s; const sq = Math.max(0.35, V.sp);
    if (pr.kind === 'cones') {
      ctx.fillStyle = sh(pr.col, -0.2); ctx.beginPath(); ctx.ellipse(p[0], p[1] - r * 0.3, r * 1.3, r * 0.75, pr.ang, 0, 6.283); ctx.fill();
      ctx.fillStyle = sh(pr.col, 0.15); for (let k = 0; k < 9; k++) { const t = k / 9 * 2 - 1; ctx.beginPath(); ctx.ellipse(p[0] + Math.cos(pr.ang) * t * r, p[1] - r * 0.4 + Math.sin(pr.ang) * t * r, r * 0.28, r * 0.2, pr.ang, 0, 6.283); ctx.fill(); }
      return;
    }
    const ry = pr.kind === 'pods' ? r * 0.5 : r * sq;
    ctx.fillStyle = sh(pr.col, -0.3); ctx.beginPath(); ctx.ellipse(p[0], p[1], r, ry, pr.ang, 0, 6.283); ctx.fill();
    ctx.fillStyle = sh(pr.col, 0.12); ctx.beginPath(); ctx.ellipse(p[0] - r * 0.2, p[1] - ry * 0.3, r * 0.65, ry * 0.6, pr.ang, 0, 6.283); ctx.fill();
  };
  D.prims = PR;
})(typeof window !== 'undefined' ? window : globalThis);
