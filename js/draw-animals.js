/* Jumper Terrarium — procedural animals drawn in true 3D support frames.
   Orientation derives from support normal + movement tangent + camera direction:
   a spider on a camera-facing surface shows its back; on a back-facing surface its belly. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, sh = JT.shade;
  const D = JT.Draw = JT.Draw || {};
  function mix(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = Math.round(M.lerp(pa >> 16, pb >> 16, t)), g = Math.round(M.lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bb = Math.round(M.lerp(pa & 255, pb & 255, t)); return '#' + ((1 << 24) | (r << 16) | (g << 8) | bb).toString(16).slice(1); }
  D.mix = mix;

  /** Build a render frame (origin, forward, side, normal) from a support. */
  D.frame = function (hab, e, extraLift) {
    const fr = JT.Nav.supFrame(hab, e.sup);
    let n = fr.n; let f = e.fwd || [1, 0, 0];
    f = M.sub(f, M.mul(n, M.dot(f, n))); if (M.len(f) < 1e-3) f = fr.tan || M.norm(M.cross(n, [0, 0, 1])); f = M.norm(f);
    const s = M.norm(M.cross(n, f));
    let p = M.add(e.pos, M.mul(n, (fr.r || 0) + (extraLift || 0)));
    if (e.sup && e.sup.d && hab) { const sw = hab.swayAt(e.sup.d, e.pos[1]); if (sw) p = M.add(p, sw); }
    return { p, f, s, n };
  };

  function ctxEll(ctx, V, c, ax, ay, fill) {
    const C = V.P(c), A = V.J(ax), B = V.J(ay);
    if (Math.abs(A[0] * B[1] - A[1] * B[0]) < 0.05) return;
    ctx.save(); ctx.transform(A[0], A[1], B[0], B[1], C[0], C[1]); ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.283); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }
  function seg(ctx, V, a, b, w, col) { const A = V.P(a), B = V.P(b); ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, w); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }

  // -------------------- Jumping spider --------------------
  /** sp: spider-like {species, state, _walk, _moving, _crouch, _legRaise, _breath, soft, sat, seed}; o: {len, alpha, curled, ghost, palette, airborne, time} */
  D.spider = function (ctx, V, sp, fr, o) {
    const S = JT.SPECIES_BY_ID[sp.species] || JT.SPECIES[0]; let pal = o.palette || S.pal; const L = o.len;
    const { f, s, n } = fr; const p = fr.p;
    const paleK = o.ghost ? 0.75 : (sp.soft > 0 ? Math.min(0.6, sp.soft / 120 * 0.65) : 0);
    const C = (c) => paleK > 0 ? mix(c, '#efe6d6', paleK) : c;
    const crouch = sp._crouch || 0, raise = sp._legRaise || 0, moving = sp._moving ? 1 : 0;
    const t = o.time || 0; const breath = Math.sin(sp._breath || 0) * 0.015;
    const h0 = L * (0.13 - 0.07 * crouch);
    const W = (u, v, w) => [p[0] + f[0] * u + s[0] * v + n[0] * w, p[1] + f[1] * u + s[1] * v + n[1] * w, p[2] + f[2] * u + s[2] * v + n[2] * w];
    const ventral = M.dot(n, V.toCam) < -0.08 && !o.thumb;
    const alpha = (o.alpha != null ? o.alpha : 1) * (S.translucent ? 0.9 : 1);
    ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // contact shadow on the support plane
    if (!o.airborne && !o.noShadow) ctxEll(ctx, V, W(-0.05 * L, 0, 0.02), M.mul(f, L * 0.55), M.mul(s, L * 0.42), 'rgba(0,0,0,' + (0.22 * alpha) + ')');
    const ant = !!S.antShape;
    const legsDraw = () => {
      const AU = [0.22, 0.17, 0.12, 0.07], FU = ant ? [0.55, 0.3, -0.12, -0.45] : [0.6, 0.3, -0.16, -0.5], FV = [0.4, 0.55, 0.56, 0.46];
      const legW = L * 0.055 * V.s;
      for (const sd of [-1, 1]) for (let i = 3; i >= 0; i--) {
        const ph = (sp._walk || 0) * Math.PI + (i % 2) * Math.PI + (sd > 0 ? Math.PI : 0);
        let fu = FU[i] * L + Math.sin(ph) * L * 0.12 * moving, fv = FV[i] * L * sd * (1 + crouch * 0.12), fw = Math.max(0, Math.cos(ph)) * L * 0.08 * moving;
        if (i === 0 && raise > 0) { fu += L * 0.12 * raise; fw += L * 0.3 * raise; fv *= 1 - 0.35 * raise; }
        if (sp.state === 'display' && i <= (S.prefs.display > 0.7 ? 2 : 0)) { fw += L * (0.25 + Math.sin(t * 7 + i + (sd > 0 ? 1 : 0)) * 0.12); }
        if (sp.state === 'groom' && i === 0) { fw += L * 0.15 * (0.5 + 0.5 * Math.sin(t * 9 + sd)); fv *= 0.5; }
        if (o.airborne) { if (i < 2) { fu += L * 0.22; fw += L * 0.06; fv *= 0.7; } else { fu -= L * 0.3; fv *= 0.6; } }
        if (o.curled) { fu *= 0.35; fv *= 0.45; fw = h0 + L * 0.12; }
        const hip = W(AU[i] * L, sd * L * 0.12, h0);
        const foot = W(fu, fv, fw);
        const mid = M.lerp3(hip, foot, 0.42);
        const knee = M.add(M.add(mid, M.mul(n, L * (0.2 + crouch * 0.1) * (o.curled ? 0.4 : 1))), M.mul(s, sd * L * 0.06));
        const col = C(i === 0 ? sh(pal.leg, -0.05) : pal.leg);
        const w0 = legW * (i === 0 ? 1.45 : 1);
        seg(ctx, V, hip, knee, w0, col); seg(ctx, V, knee, foot, w0 * 0.8, col);
        if (S.pattern === 'bold' || S.pattern === 'regal' || S.pattern === 'orange' || S.pattern === 'zebra') { const K = V.P(knee); ctx.fillStyle = C(pal.mark); ctx.globalAlpha = alpha * 0.8; ctx.beginPath(); ctx.arc(K[0], K[1], w0 * 0.42, 0, 6.283); ctx.fill(); ctx.globalAlpha = alpha; }
        if (S.pattern === 'portia' || S.pattern === 'regal' || S.pattern === 'orange') { const K = V.P(M.lerp3(hip, knee, 0.6)); ctx.fillStyle = C(pal.hair); ctx.globalAlpha = alpha * 0.6; ctx.beginPath(); ctx.arc(K[0], K[1], w0 * 0.75, 0, 6.283); ctx.fill(); ctx.globalAlpha = alpha; }
      }
    };
    const fat = M.clamp(0.85 + (sp.sat != null ? sp.sat : 0.7) * 0.32, 0.85, 1.2) * (1 + breath);
    const abdU = ant ? -0.32 : -0.26;
    const bodyDraw = () => {
      // abdomen
      const ac = W(abdU * L, 0, h0 + L * 0.05);
      const ax = M.mul(f, L * (ant ? 0.24 : 0.29) * (0.95 + fat * 0.05)), ay = M.mul(s, L * (ant ? 0.13 : 0.22) * fat);
      const Cc = V.P(ac), A = V.J(ax), B = V.J(ay);
      ctx.save(); ctx.transform(A[0], A[1], B[0], B[1], Cc[0], Cc[1]);
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.283);
      if (ventral) { ctx.fillStyle = C(pal.belly); ctx.fill(); ctx.fillStyle = C(sh(pal.belly, -0.3)); ctx.beginPath(); ctx.arc(-0.9, 0, 0.12, 0, 6.283); ctx.fill(); }
      else {
        const gr = ctx.createRadialGradient(0.2, -0.35, 0.1, 0, 0, 1.05); gr.addColorStop(0, C(sh(pal.abd, 0.22))); gr.addColorStop(1, C(sh(pal.abd, -0.25))); ctx.fillStyle = gr; ctx.fill();
        ctx.save(); ctx.clip(); pattern(ctx, S, pal, C, sp, t); ctx.restore();
      }
      ctx.restore();
      if (ant) ctxEll(ctx, V, W(-0.06 * L, 0, h0 + L * 0.04), M.mul(f, L * 0.07), M.mul(s, L * 0.05), C(pal.ceph));
      // peacock fan display
      if (S.pattern === 'peacock' && sp.state === 'display' && !ventral) {
        const fc = W(abdU * L, 0, h0 + L * 0.28); const fx = M.mul(s, L * 0.42), fy = M.add(M.mul(n, L * 0.3), M.mul(f, -L * 0.08));
        const P0 = V.P(fc), FX = V.J(fx), FY = V.J(fy); ctx.save(); ctx.transform(FX[0], FX[1], FY[0], FY[1], P0[0], P0[1]);
        ctx.beginPath(); ctx.ellipse(0, 0, 1, 0.75, 0, 0, 6.283); ctx.fillStyle = '#2a5ad0'; ctx.fill();
        ctx.fillStyle = '#e8501e'; ctx.beginPath(); ctx.ellipse(0, -0.3, 0.8, 0.35, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#3ad0c0'; ctx.beginPath(); ctx.ellipse(0, 0.25, 0.55, 0.25, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#f0c030'; ctx.beginPath(); ctx.ellipse(0, -0.05, 0.35, 0.12, 0, 0, 6.283); ctx.fill();
        ctx.restore();
      }
      // cephalothorax
      const gz = sp._gazeNow || 0; const fg = M.norm(M.add(M.mul(f, Math.cos(gz * 0.25)), M.mul(s, Math.sin(gz * 0.25))));
      const sg = M.norm(M.cross(n, fg));
      const cc = W(0.15 * L, 0, h0 + L * 0.07);
      const cx = M.mul(fg, L * (ant ? 0.2 : 0.22)), cy = M.mul(sg, L * (ant ? 0.12 : 0.18));
      const P1 = V.P(cc), CX = V.J(cx), CY = V.J(cy);
      ctx.save(); ctx.transform(CX[0], CX[1], CY[0], CY[1], P1[0], P1[1]);
      ctx.beginPath(); ctx.moveTo(-1, -0.7); ctx.bezierCurveTo(-1.1, 0, -1.1, 0, -1, 0.7); ctx.bezierCurveTo(-0.4, 1.1, 0.9, 1.05, 1.05, 0.55); ctx.lineTo(1.05, -0.55); ctx.bezierCurveTo(0.9, -1.05, -0.4, -1.1, -1, -0.7); ctx.closePath();
      if (ventral) { ctx.fillStyle = C(sh(pal.belly, 0.1)); ctx.fill(); }
      else {
        const gr = ctx.createRadialGradient(0.1, -0.4, 0.1, 0, 0, 1.2); gr.addColorStop(0, C(sh(pal.ceph, 0.25))); gr.addColorStop(1, C(sh(pal.ceph, -0.2))); ctx.fillStyle = gr; ctx.fill();
        ctx.save(); ctx.clip();
        if (S.pattern === 'magnolia') { ctx.fillStyle = '#e05a3a'; ctx.beginPath(); ctx.arc(0.65, 0, 0.35, 0, 6.283); ctx.fill(); }
        if (S.pattern === 'zebra' || S.pattern === 'graywall' || S.pattern === 'paradise' || S.pattern === 'pantropical') { ctx.fillStyle = C(pal.mark); ctx.globalAlpha = alpha * 0.8; ctx.fillRect(-1.1, 0.75, 2.2, 0.35); ctx.fillRect(-1.1, -1.1, 2.2, 0.35); ctx.globalAlpha = alpha; }
        if (S.pattern === 'emerald' || S.pattern === 'imperial') { const g2 = ctx.createLinearGradient(-1, -1, 1, 1); g2.addColorStop(0, 'rgba(120,255,200,0.0)'); g2.addColorStop(0.5, 'rgba(120,255,200,0.35)'); g2.addColorStop(1, 'rgba(120,255,200,0)'); ctx.fillStyle = g2; ctx.fillRect(-1.2, -1.2, 2.4, 2.4); }
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0.55, -1.2, 0.6, 2.4); // eye region
        ctx.restore();
      }
      ctx.restore();
      if (!ventral) {
        // posterior lateral eyes + large anterior median eyes
        const er = L * 0.055 * V.s;
        for (const sd of [-1, 1]) { const q = V.P(W(0.06 * L, sd * L * 0.13, h0 + L * 0.12)); ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.arc(q[0], q[1], er * 0.55, 0, 6.283); ctx.fill(); }
        for (const sd of [-1, 1]) {
          const q = V.P(M.add(W(0.35 * L, sd * L * 0.075, h0 + L * 0.1), M.mul(sg, sd * 0)));
          ctx.fillStyle = '#060606'; ctx.beginPath(); ctx.arc(q[0], q[1], er * (S.len < 6 ? 1.15 : 1), 0, 6.283); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(q[0] - er * 0.35, q[1] - er * 0.35, er * 0.3, 0, 6.283); ctx.fill();
        }
      }
      // chelicerae + palps
      for (const sd of [-1, 1]) {
        const cq = W(0.4 * L, sd * L * 0.045, h0 + L * 0.02);
        ctxEll(ctx, V, cq, M.mul(fg, L * 0.055), M.mul(sg, L * 0.04), C(pal.chel));
        const pw = (sp.state === 'groom' ? Math.sin(t * 12 + sd) * 0.03 : 0) * L;
        seg(ctx, V, W(0.38 * L, sd * L * 0.08, h0), W(0.48 * L + pw, sd * L * 0.09, h0 + L * 0.03), L * 0.045 * V.s, C(pal.hair));
      }
    };
    if (ventral) { bodyDraw(); legsDraw(); } else { legsDraw(); bodyDraw(); }
    ctx.globalAlpha = 1;
  };
  function pattern(ctx, S, pal, C, sp, t) {
    const m = C(pal.mark); const P = S.pattern; ctx.fillStyle = m;
    const rng = JT.makeRng(sp.seed || 7);
    const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); };
    switch (P) {
      case 'bold': ctx.beginPath(); ctx.moveTo(0.35, 0); ctx.lineTo(-0.05, 0.22); ctx.lineTo(-0.05, -0.22); ctx.closePath(); ctx.fill(); dot(-0.4, 0.3, 0.1); dot(-0.4, -0.3, 0.1); dot(-0.7, 0.15, 0.07); dot(-0.7, -0.15, 0.07); ctx.fillRect(0.75, -1, 0.15, 2); break;
      case 'regal': case 'orange': ctx.globalAlpha *= 0.85; dot(0.2, 0, 0.18); dot(-0.25, 0.32, 0.12); dot(-0.25, -0.32, 0.12); for (let k = 0; k < 3; k++) { ctx.fillRect(-0.55 - k * 0.15, -0.35 + k * 0.08, 0.07, 0.7 - k * 0.16); } ctx.fillRect(0.75, -1, 0.15, 2); break;
      case 'canopy': ctx.fillRect(-1, 0.6, 2, 0.18); ctx.fillRect(-1, -0.78, 2, 0.18); dot(0.1, 0, 0.12); break;
      case 'zebra': for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(0.55 - k * 0.42, 0, 0.08, 0.95, 0, 0, 6.283); ctx.fill(); } break;
      case 'graywall': ctx.fillStyle = 'rgba(30,28,26,0.7)'; ctx.fillRect(-1, -0.18, 2, 0.36); ctx.fillStyle = m; ctx.fillRect(-1, 0.65, 2, 0.2); ctx.fillRect(-1, -0.85, 2, 0.2); break;
      case 'pantropical': ctx.fillRect(-1, -0.12, 2, 0.24); dot(-0.4, 0.4, 0.1); dot(-0.4, -0.4, 0.1); break;
      case 'arc': ctx.beginPath(); ctx.arc(0.5, 0, 0.75, 1.9, 4.4); ctx.lineWidth = 0.18; ctx.strokeStyle = m; ctx.stroke(); break;
      case 'emerald': { const g = ctx.createLinearGradient(-1, -1, 1, 1); g.addColorStop(0, 'rgba(60,255,180,0.0)'); g.addColorStop(0.5, 'rgba(120,255,200,0.45)'); g.addColorStop(1, 'rgba(60,255,180,0)'); ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.fillStyle = m; ctx.fillRect(-1, 0.8, 2, 0.2); ctx.fillRect(-1, -1, 2, 0.2); break; }
      case 'peacock': ctx.fillStyle = '#e8501e'; ctx.beginPath(); ctx.ellipse(0.1, 0, 0.6, 0.55, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#3ad0c0'; ctx.beginPath(); ctx.ellipse(-0.3, 0, 0.35, 0.4, 0, 0, 6.283); ctx.fill(); break;
      case 'twinflag': dot(-0.55, 0.3, 0.17); dot(-0.55, -0.3, 0.17); ctx.fillRect(0.6, -1, 0.2, 2); break;
      case 'putnam': for (let k = 0; k < 5; k++) dot(0.4 - k * 0.25, (k % 2 ? 1 : -1) * 0.3, 0.09); break;
      case 'red': ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-0.1 - k * 0.3, -0.4); ctx.lineTo(-0.3 - k * 0.3, 0); ctx.lineTo(-0.1 - k * 0.3, 0.4); ctx.lineWidth = 0.08; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke(); } ctx.fillStyle = m; dot(0.5, 0, 0.12); break;
      case 'johnson': ctx.fillStyle = '#141414'; ctx.fillRect(-1, -0.16, 2, 0.32); break;
      case 'imperial': ctx.fillStyle = m; ctx.fillRect(-0.2, -1, 0.15, 2); ctx.fillRect(-0.6, -1, 0.15, 2); break;
      case 'magnolia': ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(0.1, -0.2, 0.6, 0.35, 0, 0, 6.283); ctx.fill(); break;
      case 'ant': ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(0.2, -0.3, 0.4, 0.25, 0, 0, 6.283); ctx.fill(); break;
      case 'paradise': ctx.fillRect(-1, 0.55, 2, 0.15); ctx.fillRect(-1, -0.7, 2, 0.15); ctx.fillRect(-1, -0.07, 2, 0.14); break;
      case 'giant': for (let k = 0; k < 4; k++) { ctx.globalAlpha *= 0.9; ctx.fillRect(0.5 - k * 0.38, -1, 0.1, 2); } break;
      case 'portia': ctx.fillStyle = 'rgba(30,20,10,0.4)'; for (let k = 0; k < 7; k++) dot(rng() * 1.6 - 0.8, rng() * 1.4 - 0.7, 0.12 + rng() * 0.1); ctx.fillStyle = m; for (let k = 0; k < 4; k++) dot(rng() * 1.4 - 0.7, rng() * 1.2 - 0.6, 0.06); break;
    }
  }

  // -------------------- Prey --------------------
  D.prey = function (ctx, V, e, fr, o) {
    const d = JT.PREY_BY_ID[e.type]; if (!d) return;
    const L = (o.len || d.len) * (o.scale || 1); const { f, s, n } = fr; const p = fr.p;
    const W = (u, v, w) => [p[0] + f[0] * u + s[0] * v + n[0] * w, p[1] + f[1] * u + s[1] * v + n[1] * w, p[2] + f[2] * u + s[2] * v + n[2] * w];
    const E = (u, v, w, ru, rv, col) => ctxEll(ctx, V, W(u, v, w), M.mul(f, ru), M.mul(s, rv), col);
    const t = (e._anim || 0) + (e.seed || 0) % 10; const fly = e.sup && e.sup.k === 'air' && !e.owner; const moving = M.len(e._vel || [0, 0, 0]) > 1;
    const a0 = o.alpha != null ? o.alpha : 1; ctx.globalAlpha = a0; ctx.lineCap = 'round';
    const lw = (k) => Math.max(0.5, L * k * V.s);
    const col = d.col;
    if (!fly && !o.held && !o.noShadow) E(0, 0, 0.02, L * 0.45, L * 0.25, 'rgba(0,0,0,0.2)');
    const legs6 = (len, w) => { for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const ph = (e._walk || 0) * Math.PI + i * 2.1 + (sd > 0 ? 1.5 : 0); const u = (0.15 - i * 0.18) * L; const fu = u + (0.1 - i * 0.12) * L + Math.sin(ph) * 0.06 * L * (moving ? 1 : 0); seg(ctx, V, W(u, sd * L * 0.08, L * 0.1), W(fu, sd * L * len, 0), lw(w), sh(col, -0.35)); } };
    const S = d.shape;
    if (S === 'fly' || S === 'gnat') {
      if (!fly) legs6(S === 'gnat' ? 0.5 : 0.32, 0.03);
      const flap = fly ? Math.abs(Math.sin(t * 60)) : 0.2;
      for (const sd of [-1, 1]) {
        const wc = W(-0.05 * L, sd * L * 0.16, L * (0.24 + flap * 0.1)); const dir = M.norm(M.add(M.mul(f, -0.8), M.mul(s, sd * (0.5 + flap * 0.5))));
        ctxEll(ctx, V, wc, M.mul(dir, L * (S === 'gnat' ? 0.5 : 0.38)), M.mul(M.norm(M.cross(n, dir)), L * 0.14), 'rgba(220,230,240,' + (fly ? 0.3 : 0.45) + ')');
      }
      E(-0.2 * L, 0, L * 0.16, L * (S === 'gnat' ? 0.3 : 0.27), L * 0.19, d.metallic ? '#2a5ab0' : sh(col, -0.1));
      if (d.metallic) E(-0.24 * L, -L * 0.04, L * 0.2, L * 0.12, L * 0.07, 'rgba(160,220,255,0.55)');
      E(0.1 * L, 0, L * 0.2, L * 0.2, L * 0.18, col);
      E(0.32 * L, 0, L * 0.2, L * 0.11, L * 0.15, sh(col, -0.2));
      for (const sd of [-1, 1]) E(0.34 * L, sd * L * 0.09, L * 0.23, L * 0.07, L * 0.07, d.eye || '#a01a10');
      if (S === 'gnat') { seg(ctx, V, W(0.38 * L, 0.04 * L, 0.2 * L), W(0.7 * L, 0.18 * L, 0.3 * L), lw(0.02), col); seg(ctx, V, W(0.38 * L, -0.04 * L, 0.2 * L), W(0.7 * L, -0.18 * L, 0.3 * L), lw(0.02), col); }
    } else if (S === 'moth' || S === 'lacewing') {
      const open = fly ? 0.35 + 0.65 * Math.abs(Math.cos(t * (S === 'moth' ? 14 : 18))) : (S === 'moth' ? 0.9 : 0.4);
      for (const sd of [-1, 1]) {
        const root0 = W(0.1 * L, 0, L * 0.18); const tip = W(-0.15 * L, sd * L * 0.8 * open, L * (0.18 + (1 - open) * 0.45)); const back = W(-0.6 * L, sd * L * 0.42 * open, L * (0.16 + (1 - open) * 0.3));
        const A = V.P(root0), B = V.P(tip), Cc = V.P(back);
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(B[0], B[1] - L * V.s * 0.1, B[0], B[1]); ctx.lineTo(Cc[0], Cc[1]); ctx.closePath();
        ctx.fillStyle = S === 'moth' ? sh(col, sd * 0.04) : 'rgba(200,255,200,0.35)'; ctx.fill();
        if (S === 'moth') { ctx.fillStyle = sh(col, -0.3); const q = V.P(W(-0.2 * L, sd * L * 0.4 * open, L * 0.2)); ctx.beginPath(); ctx.arc(q[0], q[1], L * V.s * 0.07, 0, 6.283); ctx.fill(); }
        else { ctx.strokeStyle = 'rgba(120,200,120,0.6)'; ctx.lineWidth = 0.6; ctx.stroke(); }
      }
      E(-0.12 * L, 0, L * 0.18, L * 0.35, L * 0.1, S === 'moth' ? sh(col, 0.1) : '#7ac06a');
      E(0.25 * L, 0, L * 0.2, L * 0.1, L * 0.09, S === 'moth' ? sh(col, -0.1) : '#e8c040');
      for (const sd of [-1, 1]) seg(ctx, V, W(0.3 * L, sd * L * 0.04, L * 0.22), W(0.62 * L, sd * L * 0.22, L * 0.3), lw(0.025), sh(col, -0.2));
    } else if (S === 'cricket' || S === 'locust') {
      const big = S === 'locust';
      for (const sd of [-1, 1]) { const hip = W(-0.05 * L, sd * L * 0.12, L * 0.12); const knee = W(-0.42 * L, sd * L * 0.24, L * 0.3); const foot = W(-0.2 * L, sd * L * 0.3, 0); seg(ctx, V, hip, knee, lw(0.09), sh(col, -0.1)); seg(ctx, V, knee, foot, lw(0.04), sh(col, -0.3)); for (let i = 0; i < 2; i++) seg(ctx, V, W((0.25 - i * 0.12) * L, sd * L * 0.1, L * 0.1), W((0.38 - i * 0.12) * L, sd * L * 0.3, 0), lw(0.03), sh(col, -0.3)); }
      E(-0.05 * L, 0, L * 0.14, L * 0.42, L * 0.15, col);
      if (big) E(-0.15 * L, 0, L * 0.22, L * 0.4, L * 0.11, sh(col, 0.15));
      else E(-0.12 * L, 0, L * 0.2, L * 0.3, L * 0.11, sh(col, -0.15));
      E(0.36 * L, 0, L * 0.16, L * 0.13, L * 0.12, sh(col, -0.2));
      for (const sd of [-1, 1]) { const a = V.P(W(0.45 * L, sd * L * 0.04, L * 0.18)), b = V.P(W(1.1 * L, sd * L * 0.35, L * 0.45)), c = V.P(W(0.8 * L, sd * L * 0.15, L * 0.35)); ctx.strokeStyle = sh(col, -0.3); ctx.lineWidth = Math.max(0.5, lw(0.015)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); ctx.stroke(); }
      if (!big) for (const sd of [-1, 1]) seg(ctx, V, W(-0.45 * L, sd * L * 0.04, L * 0.12), W(-0.62 * L, sd * L * 0.1, L * 0.14), lw(0.02), sh(col, -0.3));
    } else if (S === 'worm') {
      const nseg = d.segs || 10; const fatK = d.fat || 1; const wig = moving ? 1 : 0.3;
      for (let i = nseg - 1; i >= 0; i--) { const u = (0.5 - i / (nseg - 1)) * L; const v = Math.sin(i * 0.8 - (e._walk || 0) * 2) * L * 0.05 * wig; const r = L * 0.075 * fatK * (i === 0 ? 0.85 : 1); E(u, v, r * 0.8, r * 0.9, r, i === 0 ? sh(col, -0.45) : sh(col, (i % 2 ? -0.08 : 0.05))); }
      if (d.id === 'silkworm') E(-0.15 * L, 0, L * 0.12, L * 0.04, L * 0.04, '#8a7a6a');
    } else if (S === 'roach' || S === 'beetle' || S === 'isopod') {
      legs6(S === 'isopod' ? 0.28 : 0.38, 0.03);
      const sw = S === 'roach' ? 0.34 : S === 'isopod' ? 0.3 : 0.27;
      const c = W(-0.02 * L, 0, L * 0.14); const ax = M.mul(f, L * 0.48), ay = M.mul(s, L * sw);
      const Cc = V.P(c), A = V.J(ax), B = V.J(ay);
      ctx.save(); ctx.transform(A[0], A[1], B[0], B[1], Cc[0], Cc[1]); ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.283);
      const gr = ctx.createRadialGradient(0.2, -0.4, 0.1, 0, 0, 1.1); gr.addColorStop(0, sh(col, S === 'beetle' ? 0.35 : 0.2)); gr.addColorStop(1, sh(col, -0.2)); ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = sh(col, -0.35); ctx.lineWidth = 0.05;
      if (S === 'beetle') { ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(0.5, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0.5, -1); ctx.lineTo(0.5, 1); ctx.stroke(); if (d.spots) { ctx.fillStyle = '#d8c8a0'; for (const q of [[-0.3, 0.4], [-0.3, -0.4], [-0.7, 0.2], [-0.7, -0.2]]) { ctx.beginPath(); ctx.arc(q[0], q[1], 0.12, 0, 6.283); ctx.fill(); } } }
      else { const k = S === 'isopod' ? 8 : 6; for (let i = 1; i < k; i++) { const x = 1 - i * 2 / k; ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x, 1); ctx.stroke(); } }
      ctx.restore();
      E(0.46 * L, 0, L * 0.12, L * 0.09, L * 0.12, sh(col, -0.35));
      for (const sd of [-1, 1]) seg(ctx, V, W(0.5 * L, sd * L * 0.06, L * 0.12), W(0.85 * L, sd * L * 0.3, L * 0.1), lw(0.02), sh(col, -0.3));
    } else if (S === 'springtail') {
      E(0, 0, L * 0.2, L * 0.5, L * 0.22, col); seg(ctx, V, W(0.45 * L, 0, L * 0.2), W(0.9 * L, L * 0.2, L * 0.3), 0.6, '#c8c8d0'); seg(ctx, V, W(0.45 * L, 0, L * 0.2), W(0.9 * L, -L * 0.2, L * 0.3), 0.6, '#c8c8d0');
    } else if (S === 'spider') {
      const pseudo = { species: e.species || 'zebra', state: e.state === 'held' ? 'idle' : 'idle', _walk: e._walk, _moving: moving, seed: e.seed, sat: 0.6 };
      const pal = e.species ? null : { ceph: '#3a2a20', abd: '#4a3628', mark: '#d8c8a8', leg: '#4a3a2c', chel: '#3a2a20', hair: '#a08a6a', belly: '#6a5a4a' };
      D.spider(ctx, V, pseudo, fr, { len: L, palette: pal, alpha: a0, curled: o.held || o.curled, time: o.time, noShadow: o.held });
    }
    ctx.globalAlpha = 1;
  };

  // -------------------- Remains / droplets / silk --------------------
  D.remains = function (ctx, V, r, fr, o) {
    const k = Math.max(0.2, r.clean);
    if (r.cat === 'exuvia') { D.spider(ctx, V, { species: r.species, state: 'idle', seed: 3, sat: 0.5 }, fr, { len: r.len || 5, ghost: true, alpha: 0.55, noShadow: true }); return; }
    if (r.cat === 'spider') { D.spider(ctx, V, { species: r.species, state: 'idle', seed: 3, sat: 0.2 }, fr, { len: (r.len || 5) * 0.9, curled: true, alpha: 0.7 * k, palette: { ceph: '#3a3028', abd: '#2e2620', mark: '#5a4a3a', leg: '#3a3028', chel: '#3a3028', hair: '#4a4038', belly: '#4a4038' }, noShadow: true }); return; }
    const d = JT.PREY_BY_ID[r.kind] || { len: 4, col: '#7a6a5a' }; const L = d.len * 0.5 * (0.5 + 0.5 * k);
    const p = V.P(fr.p); const rr = Math.max(1.2, L * V.s * 0.5);
    ctx.globalAlpha = 0.85 * (0.4 + 0.6 * k);
    ctx.fillStyle = sh(d.col || '#7a6a5a', -0.45); ctx.beginPath(); ctx.ellipse(p[0], p[1], rr, rr * 0.55, r.ang || 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = sh(d.col || '#7a6a5a', -0.15); ctx.beginPath(); ctx.ellipse(p[0] - rr * 0.2, p[1] - rr * 0.15, rr * 0.5, rr * 0.3, r.ang || 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = sh(d.col || '#7a6a5a', -0.5); ctx.lineWidth = Math.max(0.5, rr * 0.12);
    for (let i = 0; i < 3; i++) { const a = (r.ang || 0) + i * 2.1; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + Math.cos(a) * rr * 1.5, p[1] + Math.sin(a) * rr * 0.8); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };
  D.drop = function (ctx, V, w, pos) {
    const p = V.P(pos); const r = Math.max(1.2, w.r * V.s);
    const gr = ctx.createRadialGradient(p[0] - r * 0.3, p[1] - r * 0.4, r * 0.1, p[0], p[1], r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(190,225,245,0.75)'); gr.addColorStop(1, 'rgba(120,170,210,0.55)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p[0], p[1] - r * 0.6, r, 0, 6.283); ctx.fill();
  };
  D.silk = function (ctx, V, k, night) {
    const A = V.P(k.a), B = V.P(k.b); const m = M.lerp3(k.a, k.b, 0.5); m[1] -= M.dist(k.a, k.b) * 0.05; const C = V.P(m);
    const fade = Math.max(0, 1 - k.age / (k.kind === 'retreat' ? 1800 : 600));
    ctx.strokeStyle = 'rgba(245,245,255,' + ((k.kind === 'retreat' ? 0.5 : 0.32) * fade + night * 0.08) + ')'; ctx.lineWidth = Math.max(0.5, V.s * 0.12);
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(C[0], C[1], B[0], B[1]); ctx.stroke();
  };
})(typeof window !== 'undefined' ? window : globalThis);
