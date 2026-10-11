// Critters: jumping spider (side + face close-up) and mantis
// ---- Jumping spider, side view, facing +x. o: {crouch, flight, phase, palp, dark}
function drawSpider(ctx, x, y, s, o = {}) {
  const P = R.P, st = R.style, k = ctx.__k;
  const cr = o.crouch || 0, fl = o.flight || 0, ph = o.phase || 0;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1);
  const by = -0.32 * s + cr * 0.1 * s; // body height above feet
  const bases = [[0.30, 0.04], [0.20, 0.07], [0.08, 0.08], [-0.04, 0.07]];
  const stand = [[0.62, 0], [0.34, 0], [-0.12, 0], [-0.46, 0]];
  const fly = [[0.78, -0.12], [0.58, 0.16], [-0.55, 0.22], [-0.82, 0.08]];
  const legC = st === 'cuphead' ? P.sp : P.spL;
  const legs = (side) => {
    for (let i = 0; i < 4; i++) {
      const b = [bases[i][0] * s + side * 0.03 * s, by + bases[i][1] * s];
      const sx = lerp(stand[i][0], fly[i][0], fl) * s + side * 0.05 * s + Math.sin(ph + i * 1.7) * 0.02 * s;
      const sy = lerp(stand[i][1] * s, by + fly[i][1] * s, fl);
      const kx = (b[0] + sx) / 2 + (i < 2 ? 0.05 : -0.05) * s, ky = Math.min(b[1], sy) - lerp(0.22, 0.06, fl) * s - cr * 0.05 * s;
      const col = side < 0 ? mix(legC, P.ink, 0.45) : legC;
      const w = (i === 0 ? 0.075 : 0.055) * s;
      stroke(ctx, [b, [kx, ky], [sx, sy]], col, w, { smooth: false, seed: i + side });
      if (st !== 'cuphead') stroke(ctx, [b, [kx, ky], [sx, sy]], rgba(P.spW, side < 0 ? 0.1 : 0.22), w * 0.3, { line: false, smooth: false, noJit: true });
      ctx.fillStyle = rgba(P.spW, side < 0 ? 0.45 : 0.85); ctx.beginPath(); ctx.arc(kx, ky, w * 0.42, 0, TAU); ctx.fill();
      const m2 = [lerp(kx, sx, 0.55), lerp(ky, sy, 0.55)]; ctx.beginPath(); ctx.arc(m2[0], m2[1], w * 0.32, 0, TAU); ctx.fill();
    }
  };
  legs(-1);
  // abdomen
  const ab = ellipsePts(-0.33 * s, by - 0.03 * s, 0.34 * s, 0.25 * s, 22, -0.12);
  shape(ctx, ab, P.sp, { seed: 2 });
  // abdomen markings: orange band + white spots
  shape(ctx, ellipsePts(-0.36 * s, by - 0.09 * s, 0.22 * s, 0.07 * s, 14, -0.15), rgba(P.spO, st === 'storybook' ? 0.75 : 0.9), { seed: 5, lw: 2.4 });
  shape(ctx, ellipsePts(-0.3 * s, by + 0.03 * s, 0.06 * s, 0.04 * s, 10), P.spW, { seed: 6, lw: 2 });
  shape(ctx, ellipsePts(-0.46 * s, by + 0.02 * s, 0.045 * s, 0.03 * s, 10), P.spW, { seed: 7, lw: 2 });
  // cephalothorax
  const ce = [[-0.06, -0.14], [0.14, -0.2], [0.36, -0.17], [0.46, -0.06], [0.46, 0.08], [0.34, 0.14], [0.06, 0.14], [-0.08, 0.04]].map(p => [p[0] * s, by + p[1] * s]);
  shape(ctx, ce, P.sp, { seed: 3 });
  if (st !== 'cuphead') shape(ctx, [[0.02, -0.15], [0.2, -0.19], [0.36, -0.15], [0.3, -0.12], [0.1, -0.12]].map(p => [p[0] * s, by + p[1] * s]), rgba(P.spW, 0.18), { line: false });
  // chelicerae (iridescent)
  shape(ctx, ellipsePts(0.43 * s, by + 0.12 * s, 0.05 * s, 0.07 * s, 12, 0.3), P.cheli, { seed: 8, lw: 2.2 });
  // pedipalps (white fuzzy) waving
  const pw = Math.sin((o.palp || 0)) * 0.03 * s;
  shape(ctx, ellipsePts(0.52 * s, by + 0.08 * s + pw, 0.05 * s, 0.035 * s, 10, -0.4), P.spW, { seed: 9, lw: 2 });
  // big front eye + side eye
  shape(ctx, ellipsePts(0.44 * s, by - 0.04 * s, 0.075 * s, 0.085 * s, 16), '#050506', { seed: 10, lw: 2.4 });
  ctx.fillStyle = st === 'cuphead' ? '#fff' : 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(0.455 * s, by - 0.07 * s, 0.024 * s, 0, TAU); ctx.fill();
  shape(ctx, ellipsePts(0.3 * s, by - 0.13 * s, 0.03 * s, 0.03 * s, 10), '#050506', { seed: 11, lw: 1.6 });
  legs(1);
  ctx.restore();
}

// ---- Spider face close-up, centred at 0,0, eyes ~ ±190. o: {lit, retina:[x,y,a], t}
let FACE = null;
function faceHairs() {
  const r = rng(321), hs = [];
  const n = R.style === 'cuphead' ? 0 : R.style === 'storybook' ? 1400 : 3600;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, rr = Math.sqrt(r());
    const x = Math.cos(a) * rr * 820, y = Math.sin(a) * rr * 760 + 30;
    let near = null, dmin = 1e9;
    for (const e of [[-190, 0, 175], [190, 0, 175], [-430, -50, 75], [430, -50, 75]]) { const d = Math.hypot(x - e[0], y - e[1]) - e[2]; if (d < dmin) { dmin = d; near = e; } }
    if (dmin < 6) continue;
    const ang = Math.atan2(y - near[1], x - near[0]) + (r() - 0.5) * 0.6;
    let col = r() < 0.5 ? '#0d0c0e' : '#24201e';
    if (y > 150 && y < 300 && Math.abs(x) < 520) col = r() < 0.8 ? '#efe9dc' : '#c9c0ad'; // white moustache band
    if (y < -150 && y > -330 && Math.abs(x) < 560 && r() < 0.7) col = r() < 0.5 ? '#e0742a' : '#b85420'; // orange brows
    if (R.style === 'storybook') col = mix(col, '#6a5444', 0.35);
    const ln = (12 + r() * 26) * (dmin < 40 ? 0.7 : 1); hs.push({ x, y, ang, len: ln, w: 1.6 + r() * 2.4, col, ph: r() * TAU, a: 0.55 + r() * 0.45 });
  }
  return hs;
}
function drawFace(ctx, o) {
  const P = R.P, st = R.style, t = o.t || 0, lit = o.lit || 0;
  if (!FACE) FACE = { hairs: faceHairs() };
  // head mass
  const head = ellipsePts(0, 60, 900, 820, 40, 0, st === 'cuphead' ? 0 : 0.04, 2);
  const hg = ctx.createRadialGradient(-200, -200, 50, 0, 60, 950);
  hg.addColorStop(0, st === 'storybook' ? '#6a5848' : st === 'cuphead' ? '#3a2a1c' : '#2a2626'); hg.addColorStop(1, st === 'storybook' ? '#3e322a' : '#08080a');
  shape(ctx, head, hg, { seed: 1, lw: 6 });
  if (st === 'cuphead') {
    // tufty cartoon brows + moustache shapes
    for (const sx of [-1, 1]) {
      const br = []; for (let i = 0; i <= 8; i++) { const u = i / 8; br.push([sx * (60 + u * 420), -250 - Math.sin(u * Math.PI) * 60 + (i % 2 ? 0 : 30) - (o.brow || 0) * 40]); }
      br.push([sx * 480, -190], [sx * 60, -200]);
      shape(ctx, br, P.spO, { lw: 5 });
      const mu = []; for (let i = 0; i <= 8; i++) { const u = i / 8; mu.push([sx * (20 + u * 480), 190 + Math.sin(u * Math.PI) * 50 + (i % 2 ? 30 : 0)]); }
      mu.push([sx * 470, 260], [sx * 20, 250]);
      shape(ctx, mu, P.spW, { lw: 5 });
    }
  }
  // hairs
  ctx.lineCap = 'round';
  for (const h of FACE.hairs) {
    const sw = Math.sin(t * 2.3 + h.ph) * 0.05;
    ctx.globalAlpha = h.a * (R.style === 'storybook' ? 0.7 : 1); ctx.strokeStyle = h.col; ctx.lineWidth = h.w;
    const ex2 = h.x + Math.cos(h.ang + sw) * h.len, ey2 = h.y + Math.sin(h.ang + sw) * h.len; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.quadraticCurveTo((h.x + ex2) / 2 + Math.sin(h.ph) * 4, (h.y + ey2) / 2 + Math.cos(h.ph) * 4, ex2, ey2); ctx.stroke();
  }
  if (st === 'storybook') { ctx.globalAlpha = 0.5; ctx.strokeStyle = P.ink; ctx.lineWidth = 2; for (let i = 0; i < FACE.hairs.length; i += 3) { const h = FACE.hairs[i]; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(h.ang) * h.len * 0.8, h.y + Math.sin(h.ang) * h.len * 0.8); ctx.stroke(); } ctx.globalAlpha = 1; }
  // chelicerae
  for (const sx of [-1, 1]) {
    const cp = ellipsePts(sx * 95, 430, 95, 150, 20, sx * 0.12);
    const cg = ctx.createLinearGradient(sx * 40, 300, sx * 150, 560);
    cg.addColorStop(0, mix(P.cheli, '#000', 0.5)); cg.addColorStop(0.5, P.cheli); cg.addColorStop(1, mix(P.cheli, '#103040', 0.6));
    shape(ctx, cp, cg, { seed: sx + 4, lw: 5 });
    if (st !== 'cuphead') glow(ctx, sx * 80, 380, 60, 'rgba(160,255,230,.7)', 0.35 + lit * 0.4);
    else shape(ctx, ellipsePts(sx * 70, 370, 22, 45, 10), 'rgba(255,255,255,.8)', { line: false });
  }
  // pedipalps
  for (const sx of [-1, 1]) {
    const wv = Math.sin(t * 5 + sx) * 18;
    const pp = ellipsePts(sx * 330, 380 + wv, 85, 120, 18, sx * -0.2, st === 'cuphead' ? 0 : 0.12, sx * 3);
    shape(ctx, pp, P.spW, { seed: sx + 7, lw: 5 });
    if (st === 'hd2d') shape(ctx, ellipsePts(sx * 345, 420 + wv, 60, 70, 14), 'rgba(160,150,135,.5)', { line: false });
  }
  // eyes
  const eyes = [[-190, 0, 172], [190, 0, 172], [-430, -55, 72], [430, -55, 72]];
  const ret = o.retina || [0, 0, 0];
  for (const [ex, ey, er] of eyes) {
    const big = er > 100;
    // lens body
    const eg = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.35, er * 0.1, ex, ey, er);
    if (st === 'storybook') { eg.addColorStop(0, '#4a4046'); eg.addColorStop(1, '#1c1618'); }
    else if (st === 'cuphead') { eg.addColorStop(0, '#2a2420'); eg.addColorStop(1, '#0a0806'); }
    else { eg.addColorStop(0, '#16161c'); eg.addColorStop(0.8, '#050507'); eg.addColorStop(1, '#2a1a0c'); }
    shape(ctx, ellipsePts(ex, ey, er, er, 32), eg, { seed: ex, lw: big ? 7 : 5, noJit: true });
    // retina glow (moving)
    if (big && ret[2] > 0) {
      const rx = ex + ret[0] * er * 0.35, ry = ey + ret[1] * er * 0.35;
      glow(ctx, rx, ry, er * 0.55, st === 'storybook' ? 'rgba(200,140,80,.9)' : 'rgba(190,110,40,.95)', ret[2]);
      if (st === 'cuphead') { ctx.globalAlpha = ret[2]; shape(ctx, ellipsePts(rx, ry, er * 0.3, er * 0.3, 16), '#7a4a1c', { lw: 4, noJit: true }); ctx.globalAlpha = 1; }
    }
    // ring
    if (st === 'hd2d') { ctx.strokeStyle = 'rgba(120,70,30,.6)'; ctx.lineWidth = er * 0.06; ctx.beginPath(); ctx.arc(ex, ey, er * 0.94, 0, TAU); ctx.stroke(); }
    // reflection of the world (green arc at bottom)
    ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, er * 0.96, 0, TAU); ctx.clip();
    ctx.globalAlpha = 0.2 + lit * 0.35; ctx.strokeStyle = st === 'cuphead' ? '#8aa85a' : st === 'storybook' ? '#a8c08a' : '#3f9a5c';
    ctx.lineWidth = er * 0.09; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(ex, ey, er * 0.8, Math.PI * 0.22, Math.PI * 0.78); ctx.stroke();
    ctx.globalAlpha *= 0.6; ctx.lineWidth = er * 0.04; ctx.strokeStyle = '#ffe0a0'; ctx.beginPath(); ctx.arc(ex, ey, er * 0.8, Math.PI * 0.32, Math.PI * 0.42); ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
    // specular: window highlight sweeps in with light
    const L = clamp(lit);
    if (L > 0) {
      ctx.save();
      if (st === 'cuphead') {
        // pie-cut highlight
        ctx.fillStyle = '#fffbea'; ctx.globalAlpha = L;
        const hr = er * 0.36, hx = ex - er * 0.32, hy = ey - er * 0.34;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.arc(hx, hy, hr, -0.5 + Math.PI * 0.15, -0.5 + Math.PI * 1.85); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = R.P.ink; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.arc(ex + er * 0.35, ey + er * 0.38, er * 0.1, 0, TAU); ctx.fill();
      } else {
        const sx = ex - er * 0.35 + (1 - L) * er * 0.6;
        ctx.translate(sx, ey - er * 0.4); ctx.rotate(-0.5);
        ctx.globalAlpha = L * (st === 'storybook' ? 0.95 : 0.9);
        ctx.fillStyle = st === 'storybook' ? R.P.bg2 : '#fffdf0';
        const ww = er * 0.42, hh = er * 0.26;
        ctx.beginPath(); ctx.roundRect(-ww / 2, -hh / 2, ww, hh, hh * 0.45); ctx.fill();
        ctx.setTransform(ctx.getTransform());
        ctx.globalAlpha = L * 0.8; ctx.beginPath(); ctx.arc(er * 0.52, er * 0.35, er * 0.07, 0, TAU); ctx.fill();
      }
      ctx.restore();
      if (st === 'hd2d') glow(ctx, ex - er * 0.3, ey - er * 0.38, er * 0.6, 'rgba(255,240,200,.6)', L * 0.35);
    }
  }
}

// ---- Mantis, facing left. Origin = hip on stem. o: {rise, arms, wing, head, sway, flat (colour override), t}
function drawMantis(ctx, x, y, s, o = {}) {
  const P = R.P, st = R.style;
  const flat = o.flat;
  const C = (c) => flat || c;
  const so = flat ? { line: false, noJit: true } : {};
  ctx.save(); ctx.translate(x, y); if (o.flip) ctx.scale(-1, 1); if (o.rot) ctx.rotate(o.rot);
  const rise = o.rise || 0, arms = o.arms || 0, wing = o.wing || 0, t = o.t || 0;
  const th = lerp(-2.45, -1.72, rise) + (o.sway || 0) * 0.05; // prothorax angle
  const L1 = 0.44 * s; const N = P2(th, L1);
  const abA = lerp(1.15, 1.02, rise), abL = 0.66 * s;
  const leg = (pts, w, c, sd) => stroke(ctx, pts, C(c), w, Object.assign({ smooth: false, seed: sd }, so));
  // far mid/hind legs
  leg([[0.01 * s, 0.02 * s], [-0.2 * s, -0.04 * s], [-0.06 * s, 0.16 * s]], 0.022 * s, mix(P.manD, '#000', 0.2), 1);
  leg([[0.04 * s, 0.05 * s], [0.26 * s, 0.06 * s], [0.06 * s, 0.34 * s]], 0.022 * s, mix(P.manD, '#000', 0.2), 2);
  // wings (behind abdomen when fanned)
  const wingShape = (ang, len, wid, c, a) => {
    const lf = leafPts(0.02 * s, 0, ang, len, wid, 0.08, 14, 0.6);
    shape(ctx, lf.pts, C(c), Object.assign({ alpha: a, seed: ang }, so));
    if (!flat && wing > 0.05) { ctx.globalAlpha = 0.35 * wing; ctx.strokeStyle = st === 'cuphead' ? P.ink : 'rgba(255,255,230,.9)'; ctx.lineWidth = 1.5 * ctx.__k; for (let i = 1; i < 6; i++) { const q = lf.spine[Math.min(lf.spine.length - 1, i * 2 + 2)]; ctx.beginPath(); ctx.moveTo(0.02 * s, 0); ctx.lineTo(q[0] + Math.sin(i) * wid * 0.3, q[1] - wid * 0.2); ctx.stroke(); } ctx.globalAlpha = 1; }
  };
  if (wing > 0.02) {
    wingShape(abA - 0.25 - wing * 1.15, abL * 0.92, 0.2 * s * (0.6 + wing), st === 'hd2d' ? '#c8f0a0' : P.manL, 0.55 + 0.2 * (1 - wing));
    wingShape(abA - 0.15 - wing * 0.75, abL * 0.9, 0.17 * s * (0.6 + wing), P.man, 0.75);
  }
  // abdomen
  const abP = []; const abR = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10; const c = P2(abA + Math.sin(u * 2) * 0.05, u * abL); const w = 0.105 * s * Math.sin(Math.min(1, 0.2 + u) * Math.PI * 0.85) * (1 - u * 0.4) + 0.02 * s; const nx = -Math.sin(abA), ny = Math.cos(abA); abP.push([c[0] + nx * w, c[1] + ny * w]); abR.push([c[0] - nx * w, c[1] - ny * w]); }
  const abG = flat ? flat : (() => { const g = ctx.createLinearGradient(0, 0, Math.cos(abA) * abL, Math.sin(abA) * abL); g.addColorStop(0, P.man); g.addColorStop(1, P.manD); return g; })();
  shape(ctx, abP.concat(abR.reverse()), abG, Object.assign({ seed: 3 }, so));
  if (wing <= 0.02) { const lf = leafPts(0.02 * s, -0.01 * s, abA - 0.12, abL * 0.85, 0.15 * s, 0.05, 12, 0.6); shape(ctx, lf.pts, C(mix(P.man, P.manL, 0.35)), Object.assign({ seed: 4 }, so)); }
  if (!flat && st !== 'hd2d') { ctx.globalAlpha = 0.5; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6 * ctx.__k; for (let i = 3; i < 10; i += 1.5) { const c = P2(abA, i / 10 * abL); ctx.beginPath(); ctx.moveTo(c[0] - 0.07 * s * Math.cos(abA + 1.57), c[1] - 0.07 * s * Math.sin(abA + 1.57)); ctx.lineTo(c[0] + 0.07 * s * Math.cos(abA + 1.57), c[1] + 0.07 * s * Math.sin(abA + 1.57)); ctx.stroke(); } ctx.globalAlpha = 1; }
  // near mid/hind legs
  leg([[0.0, 0.0], [-0.24 * s, 0.02 * s], [-0.04 * s, 0.22 * s]], 0.026 * s, P.manD, 5);
  leg([[0.03 * s, 0.04 * s], [0.3 * s, 0.14 * s], [0.03 * s, 0.4 * s]], 0.026 * s, P.manD, 6);
  // prothorax
  const pr = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8, c = P2(th, u * L1), w = (0.035 - 0.012 * Math.sin(u * Math.PI) + (u > 0.75 ? 0.012 : 0)) * s, nx = -Math.sin(th), ny = Math.cos(th); pr.push([c[0] + nx * w, c[1] + ny * w]); }
  for (let i = 8; i >= 0; i--) { const u = i / 8, c = P2(th, u * L1), w = (0.035 - 0.012 * Math.sin(u * Math.PI) + (u > 0.75 ? 0.012 : 0)) * s, nx = -Math.sin(th), ny = Math.cos(th); pr.push([c[0] - nx * w, c[1] - ny * w]); }
  shape(ctx, pr, C(P.man), Object.assign({ seed: 7 }, so));
  // forelegs (raptorial)
  const F = P2(th, L1 * 0.84);
  const fore = (side) => {
    const off = side < 0 ? 0.14 : 0;
    const cA = lerp(1.95, -2.75, arms) + off, fA = lerp(-2.45, -1.5, arms) + off * 0.5, tA = lerp(0.95, -2.3, arms) + off;
    const K1 = [F[0] + Math.cos(cA) * 0.16 * s, F[1] + Math.sin(cA) * 0.16 * s];
    const K2 = [K1[0] + Math.cos(fA) * 0.2 * s, K1[1] + Math.sin(fA) * 0.2 * s];
    const T = [K2[0] + Math.cos(tA) * 0.14 * s, K2[1] + Math.sin(tA) * 0.14 * s];
    const c = side < 0 ? mix(P.man, P.manD, 0.6) : P.man;
    leg([F, K1], 0.04 * s, c, 8 + side);
    leg([K1, K2], 0.045 * s, c, 9 + side);
    leg([K2, T], 0.025 * s, c, 10 + side);
    if (!flat) { // spines
      ctx.strokeStyle = st === 'cuphead' ? P.ink : mix(P.manD, '#000', 0.3); ctx.lineWidth = 2 * ctx.__k;
      for (let i = 1; i < 5; i++) { const u = i / 5, px = lerp(K1[0], K2[0], u), py = lerp(K1[1], K2[1], u), na = fA + Math.PI / 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(na) * 0.03 * s, py + Math.sin(na) * 0.03 * s); ctx.stroke(); }
    }
  };
  fore(-1);
  // head
  const hd = (o.head || 0) + th + 1.72;
  ctx.save(); ctx.translate(N[0], N[1]); ctx.rotate(hd * 0.6);
  const hp = [[-0.1 * s, -0.04 * s], [0.0, -0.075 * s], [0.08 * s, -0.04 * s], [0.03 * s, 0.05 * s], [-0.03 * s, 0.09 * s]];
  // antennae
  if (!flat || true) { const aw = Math.sin(t * 1.7) * 0.04; stroke(ctx, [[-0.03 * s, -0.07 * s], [-0.18 * s, -0.3 * s], [-0.42 * s + aw * s, -0.42 * s]], C(P.manD), 0.008 * s, Object.assign({ seed: 12 }, so)); stroke(ctx, [[0.0, -0.07 * s], [-0.05 * s, -0.33 * s], [-0.2 * s, -0.5 * s - aw * s]], C(P.manD), 0.008 * s, Object.assign({ seed: 13 }, so)); }
  shape(ctx, hp, C(P.man), Object.assign({ seed: 14, smooth: true }, so));
  if (!flat) {
    shape(ctx, ellipsePts(-0.085 * s, -0.04 * s, 0.035 * s, 0.04 * s, 12), P.manL, { seed: 15, lw: 2.4 });
    shape(ctx, ellipsePts(0.07 * s, -0.04 * s, 0.03 * s, 0.035 * s, 12), mix(P.manL, P.man, 0.4), { seed: 16, lw: 2.4 });
    ctx.fillStyle = '#10180c'; ctx.beginPath(); ctx.arc(-0.09 * s, -0.035 * s, 0.009 * s, 0, TAU); ctx.fill();
  }
  ctx.restore();
  fore(1);
  ctx.restore();
  return { neck: [x + N[0], y + N[1]] };
}
