// Shots, title, transitions, post, frame entry
const FPS = 30;
const SHOTS = [['A', 0, 2.4], ['B', 2.4, 5.2], ['C1', 5.2, 6.6], ['C2', 6.6, 8.4], ['D', 8.4, 11.2], ['E', 11.2, 15]];
const TRANS = {
  hd2d: [[2.4, 'flash', 0.2, 0.7], [5.2, 'dip', 0.18, 0.18], [6.6, 'flash', 0.05, 0.25], [8.4, 'flash', 0.12, 0.45], [11.2, 'cross', 0.5, 0.5]],
  cuphead: [[2.4, 'iris', 0.35, 0.45], [5.2, 'flash', 0.05, 0.15], [6.6, 'iris', 0.2, 0.25], [8.4, 'flash', 0.06, 0.2], [11.2, 'iris', 0.3, 0.45]],
  storybook: [[2.2, 'bloom', 0.3, 0.9], [5.2, 'cross', 0.3, 0.3], [6.6, 'cross', 0.15, 0.15], [8.4, 'bloom', 0.35, 0.55], [11.2, 'cross', 0.5, 0.5]]
};
function finalCam() { return R.portrait ? { x: 0, y: -100, z: 1 } : { x: 0, y: -60, z: 0.82 }; }
function domeFit() { R.portrait ? R.fit(1150, 1000, 'contain') : R.fit(1300, 1000, 'contain'); }

// ---------- dome scene (B, E, loop) ----------
function sceneDome(lt, o) {
  const st = R.style, cam = o.cam, spf = R.spf;
  domeFit(); R.cam = cam;
  const bg = R.layer({ cam: null }); drawBackdrop(bg, lt, { exposure: o.exposure });
  const pz = { x: cam.x * 0.4, y: cam.y * 0.4, z: 1 + (cam.z - 1) * 0.35, r: cam.r };
  const sc = R.layer({ cam: pz, pf: st === 'hd2d' ? 1 : 1, blur: st === 'hd2d' ? 6 : o.backBlur || 0 }); drawScenery(sc, lt);
  const tb = R.layer({ cam, pf: spf, blur: o.backBlur || 0 }); drawTable(tb);
  const glowL = R.layer({ cam, comp: st === 'storybook' ? 'soft-light' : 'screen', alpha: o.exposure });
  glow(glowL, -60, -40, 650, st === 'hd2d' ? 'rgba(255,190,100,.55)' : 'rgba(255,240,190,.6)', 1);
  const tr = R.layer({ cam, pf: spf, blur: o.midBlur || 0 }); drawTerrarium(tr, lt);
  if (o.fg) { const fg = R.layer({ cam, pf: spf, blur: o.fgBlur || 14 }); o.fg(fg); }
  const gl = R.layer({ cam }); drawGlassFront(gl, lt, o.glassA == null ? 1 : o.glassA);
  // fx
  const sm = R.sm; sm.setTransform(1, 0, 0, 1, 0, 0); sm.clearRect(0, 0, R.small.width, R.small.height);
  drawRays(sm, lt, o.rays == null ? 1 : o.rays, { sweep: o.sweep || 0 });
  drawMist(sm, lt, o.mist || 0);
  R.layers.push({ c: R.small, pf: 4, blur: 2, alpha: 1, comp: 'screen', smooth: true });
  const mt = R.layer({ cam }); drawMotes(mt, lt, o.motes == null ? 1 : o.motes);
  if (st === 'storybook') drawFireflies(mt, lt, o.flies == null ? 1 : o.flies);
  R.compose();
  if (o.exposure != null && o.exposure < 1) { R.m.setTransform(1, 0, 0, 1, 0, 0); R.m.fillStyle = st === 'storybook' ? `rgba(60,45,30,${(1 - o.exposure) * 0.8})` : `rgba(0,0,0,${1 - o.exposure})`; R.m.fillRect(0, 0, R.W, R.H); }
}

// ---------- A: the drop ----------
function shotA(t) {
  const st = R.style, P = R.P;
  R.fit(1000, 1000, 'contain');
  const cam = { x: 0, y: lerp(-170, 70, eio(clamp(t / 2.1))), z: lerp(1, 1.18, eio(clamp(t / 2.4))) };
  R.cam = cam;
  const bg = R.layer({ cam: null });
  const g = bg.createLinearGradient(0, 0, 0, R.H);
  if (st === 'hd2d') { g.addColorStop(0, '#020604'); g.addColorStop(1, '#06140d'); }
  else if (st === 'cuphead') { g.addColorStop(0, '#2a2214'); g.addColorStop(1, '#3a2e1a'); }
  else { g.addColorStop(0, '#d8cbb0'); g.addColorStop(1, '#cbbd9e'); }
  bg.fillStyle = g; bg.fillRect(0, 0, R.W, R.H);
  const lightUp = sstep(0.2, 1.9, t);
  // soft background bokeh
  const bk = R.layer({ cam: { x: cam.x * 0.3, y: cam.y * 0.3, z: 1 }, blur: 10 });
  for (let i = 0; i < 9; i++) { glow(bk, -700 + i * 180, -300 + (i * 137 % 600), 90, st === 'storybook' ? 'rgba(150,170,120,.5)' : 'rgba(120,200,150,.5)', 0.25 * lightUp); }
  // hanging leaf (blurred, top)
  const hl = R.layer({ pf: R.spf, blur: 5 });
  drawLeaf(hl, 120, -1050, 1.75, 640, 230, -0.1, P.leafD, mix(P.leafM, P.dark, 0.3), { seed: 3, vein: false });
  // main leaf
  const lf = R.layer({ pf: R.spf });
  const bounce = t > 1.9 ? Math.sin((t - 1.9) * 22) * Math.exp(-(t - 1.9) * 5) * 0.03 : 0;
  const L = drawLeaf(lf, 760, 520, Math.PI + 0.42 + bounce, 900, 330, -0.12, mix(P.leafD, P.dark, 0.4), mix(P.leafM, P.leafL, lightUp * 0.5), { seed: 8 });
  if (st === 'hd2d') { lf.globalAlpha = 0.5 * lightUp; lf.strokeStyle = '#d8ff9a'; lf.lineWidth = 6 * lf.__k; tracePath(lf, L.pts.slice(0, 13), false, true); lf.stroke(); lf.globalAlpha = 1; }
  // drop
  const dr = R.layer({});
  const tipY = -455, hitY = 222, hitX = 10;
  const dropR = 26;
  if (t < 1.9) {
    let y, sx = 1, sy = 1, rr = dropR;
    if (t < 0.75) { const u = t / 0.75; rr = dropR * (0.4 + 0.6 * eo(u)); y = tipY + rr * 0.8 * (1 + u * 0.4); sy = 1 + u * 0.35; sx = 1 - u * 0.1; }
    else { const u = (t - 0.75) / 1.15; y = tipY + dropR * 1.1 + (hitY - tipY - dropR * 1.1) * u * u; sy = 1.18; sx = 0.88; }
    const spark = Math.exp(-(((y + 80) / 90) ** 2));
    drawDrop(dr, hitX, y, rr, sx, sy, 0.4 + lightUp * 0.6 + spark);
    if (spark > 0.05 && st !== 'storybook') glow(dr, hitX - 6, y - 8, 120, 'rgba(255,240,200,.8)', spark * 0.6);
  } else {
    const u = t - 1.9;
    // ripples
    for (let i = 0; i < 3; i++) { const v = u - i * 0.12; if (v <= 0) continue; const rr = 40 + v * 420; dr.globalAlpha = Math.max(0, 0.7 - v * 1.2); dr.strokeStyle = st === 'cuphead' ? P.cream : st === 'storybook' ? rgba(P.ink, 0.7) : '#e8fff4'; dr.lineWidth = (st === 'cuphead' ? 6 : 3) * dr.__k; dr.beginPath(); dr.ellipse(hitX, hitY + 6, rr, rr * 0.18, -0.25, 0, TAU); dr.stroke(); }
    dr.globalAlpha = 1;
    // crown droplets
    const r = rng(12);
    for (let i = 0; i < 14; i++) { const a = -Math.PI * (0.1 + 0.8 * r()), sp = 300 + r() * 500; const x = hitX + Math.cos(a) * sp * u, y = hitY + Math.sin(a) * sp * u + 900 * u * u; drawDrop(dr, x, y, 5 + r() * 9, 1, 1, 1); }
    // impact flash
    if (st === 'cuphead') { const s = 60 + u * 900; const pts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, rr = i % 2 ? s : s * 0.45; pts.push([hitX + Math.cos(a) * rr, hitY + Math.sin(a) * rr * 0.8]); } shape(dr, pts, '#fffbea', { smooth: false, lw: 6, alpha: clamp(1 - u * 1.2) }); }
    else glow(dr, hitX, hitY, 80 + u * 1600, st === 'storybook' ? 'rgba(255,255,245,.95)' : 'rgba(255,236,190,.95)', clamp(u * 4) * 0.9);
  }
  R.compose();
  // light beam
  const sm = R.sm; sm.setTransform(1, 0, 0, 1, 0, 0); sm.clearRect(0, 0, R.small.width, R.small.height);
  drawRays(sm, t, 0.35 * lightUp, { ox: R.small.width * 0.05, oy: -R.small.height * 0.3, ang: 0.95 });
  R.m.save(); R.m.globalCompositeOperation = 'screen'; R.m.drawImage(R.small, 0, 0, R.W, R.H); R.m.restore();
  R.impact = { x: R.W / 2 + (hitX - cam.x) * R.U * cam.z, y: R.H / 2 + (hitY - cam.y) * R.U * cam.z };
}
function drawDrop(ctx, x, y, r, sx, sy, lit) {
  const st = R.style;
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  if (st === 'storybook') { g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, 'rgba(150,200,215,.75)'); g.addColorStop(1, 'rgba(90,140,165,.85)'); }
  else if (st === 'cuphead') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9fd8e8'); }
  else { g.addColorStop(0, `rgba(230,255,245,${0.5 * lit})`); g.addColorStop(0.6, `rgba(70,140,120,${0.45})`); g.addColorStop(1, `rgba(220,255,240,${0.9 * Math.min(1, lit)})`); }
  ctx.beginPath(); ctx.moveTo(0, -r * 1.5); ctx.bezierCurveTo(r * 0.5, -r * 0.9, r, -r * 0.4, r, 0); ctx.arc(0, 0, r, 0, Math.PI); ctx.bezierCurveTo(-r, -r * 0.4, -r * 0.5, -r * 0.9, 0, -r * 1.5); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  if (st === 'cuphead') { ctx.strokeStyle = R.P.ink; ctx.lineWidth = 4 * ctx.__k / sx; ctx.stroke(); }
  if (st === 'storybook') { ctx.strokeStyle = rgba(R.P.ink, 0.6); ctx.lineWidth = 1.6 * ctx.__k; ctx.stroke(); }
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = Math.min(1, lit); ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.22, r * 0.14, -0.6, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.6 * Math.min(1, lit); ctx.beginPath(); ctx.ellipse(r * 0.2, r * 0.6, r * 0.4, r * 0.12, 0, 0, TAU); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}

// ---------- B: dawn inside the dome ----------
function shotB(t, gt) {
  const u = clamp(t / 2.8), e = eo(u);
  const cam = { x: lerp(-200, -120, e), y: lerp(40, -10, e), z: lerp(3.6, 2.35, e), r: lerp(0.04, 0, e) };
  const P = R.P;
  sceneDome(gt - 15, {
    cam, exposure: lerp(0.25, 1, sstep(0, 0.75, u)), rays: sstep(0.05, 0.6, u) * 1.4, mist: lerp(1, 0.25, e), sweep: lerp(-0.25, 0, e), backBlur: 3, glassA: 0,
    fg: (c) => { const ph = gt; drawLeaf(c, -560 + e * -140, 420, -1.2, 420, 200, 0.2, P.leafD, P.leafM, { seed: 91 }); drawLeaf(c, 230 + e * 160, 470, -2.1, 460, 210, -0.2, P.leafD, P.leafM, { seed: 92 }); }, fgBlur: 16
  });
}
// ---------- C1: eyes ----------
function shotC1(t) {
  const st = R.style;
  R.portrait ? R.fit(1050, 1500, 'cover') : R.fit(1500, 880, 'cover');
  const cam = { x: 0, y: R.portrait ? 90 : 50, z: lerp(1.0, 1.1, eio(clamp(t / 1.6))) };
  R.cam = cam;
  const bg = R.layer({ cam: null }); bg.fillStyle = st === 'storybook' ? '#3e322a' : '#050506'; bg.fillRect(0, 0, R.W, R.H);
  const focus = 1 - eo(clamp(t / 0.55));
  const f = R.layer({ pf: st === 'hd2d' ? R.spf : 1, blur: focus * 22 });
  const lit = sstep(0.25, 0.75, t);
  const look = sstep(0.55, 1.05, t);
  const ret = [lerp(-0.9, 0, look) + Math.sin(t * 9) * 0.2 * (1 - look), lerp(-0.5, 0.05, look), lerp(0.9, 0.35, look) * (st === 'cuphead' ? 0.8 : 1)];
  drawFace(f, { t, lit, retina: ret, brow: sstep(0.9, 1.1, t) });
  R.compose();
  // glint sweep across eyes
  if (st !== 'storybook') { const sm = R.sm; sm.setTransform(1, 0, 0, 1, 0, 0); sm.clearRect(0, 0, R.small.width, R.small.height); drawRays(sm, t, lit * 0.55, { ox: -0.2 * R.small.width, oy: -0.5 * R.small.height, ang: 0.85 }); R.m.save(); R.m.globalCompositeOperation = 'screen'; R.m.drawImage(R.small, 0, 0, R.W, R.H); R.m.restore(); }
}
// ---------- C2: the leap ----------
function shotC2(t) {
  const st = R.style, P = R.P;
  R.portrait ? R.fit(1000, 1700, 'contain') : R.fit(1700, 950, 'contain');
  const A = R.portrait ? [-260, 420] : [-560, 140], B = R.portrait ? [250, -360] : [560, 60];
  const tl = 0.45, tland = 1.45;
  let sp = { x: A[0], y: A[1], crouch: 0, flight: 0, rot: 0 };
  if (t < tl) { sp.crouch = sstep(0.05, tl, t); }
  else if (t < tland) {
    const v = (t - tl) / (tland - tl); const p = v + 0.75 * Math.sin(TAU * v) / TAU; // slow middle
    sp.x = lerp(A[0], B[0], p); sp.y = lerp(A[1], B[1], p) - Math.sin(p * Math.PI) * (R.portrait ? 260 : 300);
    sp.flight = sstep(0, 0.15, v) * (1 - sstep(0.8, 1, v)); sp.rot = lerp(-0.35, 0.35, p) * (R.portrait ? 0.6 : 1) + (R.portrait ? -0.5 : 0) * Math.sin(p * Math.PI);
  } else { const v = t - tland; sp.x = B[0]; sp.y = B[1]; sp.crouch = Math.exp(-v * 6) * 0.9; }
  const cam = { x: lerp(0, sp.x * 0.35, 1), y: lerp(0, sp.y * 0.3, 1) + (R.portrait ? 0 : -20), z: 1.05, r: Math.sin(t * 0.8) * 0.02 };
  R.cam = cam;
  const bg = R.layer({ cam: null });
  if (st === 'hd2d') { const g = bg.createLinearGradient(0, 0, R.W, R.H); g.addColorStop(0, '#2a4a24'); g.addColorStop(0.5, '#0f2a1c'); g.addColorStop(1, '#06120c'); bg.fillStyle = g; bg.fillRect(0, 0, R.W, R.H); glow(bg, R.W * 0.2, R.H * 0.1, R.W * 0.8, 'rgba(255,200,110,.7)', 0.5); }
  else drawBackdrop(bg, t);
  const far = R.layer({ cam: { x: cam.x * 0.3, y: cam.y * 0.3, z: 1 }, blur: st === 'cuphead' ? 0 : 12 });
  if (st === 'cuphead') drawScenery(far, t);
  for (let i = 0; i < 10; i++) { const x = -1100 + i * 260; drawLeaf(far, x, 700, -1.57 + Math.sin(i * 2.3) * 0.5, 520 + (i % 3) * 140, 200, 0.2, mix(P.leafD, P.dark, 0.3), P.leafM, { seed: i + 50, vein: false, alpha: st === 'cuphead' ? 1 : 0.8 }); }
  if (st === 'hd2d') for (let i = 0; i < 14; i++) glow(far, -900 + i * 140, -400 + (i * 211 % 800), 50 + (i % 4) * 25, i % 3 ? 'rgba(255,220,140,.8)' : 'rgba(170,255,190,.7)', 0.35);
  const mid = R.layer({ pf: R.spf });
  const land = t > tland ? Math.sin((t - tland) * 18) * Math.exp(-(t - tland) * 5) * 0.08 : 0;
  // start leaf + end leaf
  drawLeaf(mid, A[0] - 280, A[1] + 200, -0.4, 420, 200, -0.08, P.leafD, P.leafL, { seed: 71 });
  stroke(mid, [[A[0] - 300, A[1] + 220], [A[0] - 420, A[1] + 700]], P.stem, 12, { seed: 7 });
  drawLeaf(mid, B[0] + 300, B[1] + 160 + land * 200, Math.PI + 0.35 + land, 420, 200, 0.08, P.leafD, P.leafL, { seed: 72 });
  stroke(mid, [[B[0] + 320, B[1] + 180], [B[0] + 460, B[1] + 900]], P.stem, 12, { seed: 8 });
  // dragline silk
  if (t > tl) { const g = mid.createLinearGradient(A[0], A[1], sp.x, sp.y); const sh = (t * 1.5) % 1; g.addColorStop(0, 'rgba(255,255,255,.15)'); g.addColorStop(clamp(sh - 0.1), 'rgba(255,255,255,.2)'); g.addColorStop(sh, 'rgba(255,255,240,.95)'); g.addColorStop(clamp(sh + 0.1), 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,.4)'); mid.strokeStyle = st === 'cuphead' ? P.cream : g; mid.lineWidth = (st === 'cuphead' ? 3 : 1.6) * mid.__k * 2; mid.beginPath(); mid.moveTo(A[0] - 40, A[1] - 6); mid.quadraticCurveTo((A[0] + sp.x) / 2, Math.max(A[1], sp.y) + 40, sp.x - 40, sp.y - 30); mid.stroke(); }
  // motion ghosts
  const S = R.portrait ? 200 : 230;
  if (sp.flight > 0.3 && st !== 'cuphead') { const tr = R.layer({ pf: R.spf, alpha: 0.25, blur: 3 }); drawSpider(tr, sp.x - 40, sp.y + 10, S, { flight: sp.flight, rot: sp.rot }); }
  if (sp.flight > 0.3 && st === 'cuphead') { mid.strokeStyle = P.ink; mid.lineWidth = 5 * mid.__k; for (let i = 0; i < 3; i++) { mid.beginPath(); mid.moveTo(sp.x - 180 - i * 30, sp.y - 120 + i * 50); mid.lineTo(sp.x - 300 - i * 30, sp.y - 100 + i * 50); mid.stroke(); } }
  const spl = R.layer({ pf: R.spf });
  drawSpider(spl, sp.x, sp.y, S, { crouch: sp.crouch, flight: sp.flight, rot: sp.rot, palp: t * 12, phase: t * 3 });
  const fg = R.layer({ blur: st === 'cuphead' ? 0 : 18, pf: R.spf });
  const fx = lerp(700, -900, t / 1.8);
  drawLeaf(fg, fx, R.portrait ? 1000 : 640, -1.9, 520, 260, 0.2, mix(P.leafD, '#000', 0.3), P.leafD, { seed: 99, vein: false });
  R.compose();
  const sm = R.sm; sm.setTransform(1, 0, 0, 1, 0, 0); sm.clearRect(0, 0, R.small.width, R.small.height);
  drawRays(sm, t, 0.6, { ang: 0.9, sweep: t * 0.05 }); R.m.save(); R.m.globalCompositeOperation = 'screen'; R.m.drawImage(R.small, 0, 0, R.W, R.H); R.m.restore();
}
// ---------- D: the mantis rises against the sun ----------
function shotD(t) {
  const st = R.style, P = R.P;
  R.portrait ? R.fit(1000, 1500, 'contain') : R.fit(1000, 1000, 'contain');
  const cam = { x: R.portrait ? -20 : 120, y: lerp(260, 20, eio(clamp(t / 2.4))), z: lerp(1.18, 1.0, eo(clamp(t / 2.8))) };
  R.cam = cam;
  const sun = [-140, -330];
  const sunS = [R.W / 2 + (sun[0] - cam.x * 0.4) * R.U, R.H / 2 + (sun[1] - cam.y * 0.4) * R.U];
  const bg = R.layer({ cam: null });
  if (st === 'hd2d') { const g = bg.createRadialGradient(sunS[0], sunS[1], 0, sunS[0], sunS[1], R.W); g.addColorStop(0, '#fff2c0'); g.addColorStop(0.12, '#ffc870'); g.addColorStop(0.4, '#5a6a2a'); g.addColorStop(1, '#0c1e14'); bg.fillStyle = g; bg.fillRect(0, 0, R.W, R.H); }
  else if (st === 'cuphead') {
    bg.fillStyle = '#e8d7a0'; bg.fillRect(0, 0, R.W, R.H);
    bg.save(); bg.translate(sunS[0], sunS[1]); bg.rotate(t * 0.15); bg.fillStyle = 'rgba(240,170,70,.35)'; for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; bg.beginPath(); bg.moveTo(0, 0); bg.arc(0, 0, R.W * 1.5, a, a + TAU / 40); bg.closePath(); bg.fill(); } bg.restore();
  } else { bg.fillStyle = '#f3e7cc'; bg.fillRect(0, 0, R.W, R.H); glow(bg, sunS[0], sunS[1], R.W * 0.6, 'rgba(255,214,140,.9)', 0.8); }
  const sk = R.layer({ cam: { x: cam.x * 0.4, y: cam.y * 0.4, z: 1 } });
  const sunR = 150 + Math.sin(t * 2) * 4;
  if (st === 'hd2d') { glow(sk, sun[0], sun[1], 420, 'rgba(255,250,220,1)', 0.9); sk.fillStyle = '#fffbe8'; sk.beginPath(); sk.arc(sun[0], sun[1], sunR * 0.75, 0, TAU); sk.fill(); }
  else if (st === 'cuphead') { const pts = ellipsePts(sun[0], sun[1], sunR, sunR, 28); shape(sk, pts, '#ffd860', { lw: 7 }); for (const sx of [-1, 1]) { shape(sk, ellipsePts(sun[0] + sx * 42, sun[1] - 22, 24, 34, 16), '#fffbea', { lw: 5 }); sk.fillStyle = P.ink; sk.beginPath(); sk.moveTo(sun[0] + sx * 38 - 4, sun[1] - 14); sk.arc(sun[0] + sx * 38 - 4, sun[1] - 14, 14, -0.3, TAU - 1.1); sk.closePath(); sk.fill(); sk.globalAlpha = 0.5; sk.fillStyle = '#e8705a'; sk.beginPath(); sk.arc(sun[0] + sx * 80, sun[1] + 30, 20, 0, TAU); sk.fill(); sk.globalAlpha = 1; }
    shape(sk, [[sun[0] - 62, sun[1] + 22], [sun[0], sun[1] + 40], [sun[0] + 62, sun[1] + 22], [sun[0] + 40, sun[1] + 75], [sun[0], sun[1] + 88], [sun[0] - 40, sun[1] + 75]], '#7a2a18', { lw: 6 }); }
  else { shape(sk, ellipsePts(sun[0], sun[1], sunR, sunR, 24, 0, 0.05, 2), 'rgba(255,214,120,.85)', { lw: 1.5, inkA: 0.35 }); }
  // distant silhouette foliage
  const far = R.layer({ cam: { x: cam.x * 0.6, y: cam.y * 0.6, z: 1 }, pf: R.spf, blur: st === 'cuphead' ? 0 : 6 });
  for (let i = 0; i < 12; i++) { const x = -1100 + i * 200; drawLeaf(far, x, 900, -1.57 + Math.sin(i * 1.7) * 0.45, 600 + (i % 4) * 120, 220, 0.25, st === 'hd2d' ? '#14301c' : P.leafD, st === 'hd2d' ? '#24502c' : P.leafM, { seed: i + 30, vein: false }); }
  // stem + flowers + mantis
  const ml = R.layer({ pf: R.spf });
  const stem = [[150, 1300], [120, 700], [80, 300], [70, 60], [90, -120]];
  stroke(ml, stem, st === 'hd2d' ? '#1c3a1a' : P.stem, 26, { seed: 3, hi: st === 'hd2d' ? '#ffd890' : P.leafL });
  drawLeaf(ml, 110, 520, -0.5, 320, 140, -0.2, st === 'hd2d' ? '#16341a' : P.leafD, st === 'hd2d' ? '#2a5a26' : P.leafM, { seed: 17 });
  const rise = eio(sstep(0.2, 1.4, t)), arms = eio(sstep(0.9, 1.8, t)), wing = eo(sstep(1.5, 2.3, t)), head = sstep(2.0, 2.5, t) * 0.5;
  const mo = { rise, arms, wing, head, t, sway: Math.sin(t * 2) };
  const MX = 75, MY = 230, MS = 470;
  if (st === 'hd2d') { drawMantis(ml, MX - 6, MY - 7, MS, Object.assign({ flat: '#ffe6a0' }, mo)); drawMantis(ml, MX, MY, MS, Object.assign({ flat: null }, mo)); }
  else if (st === 'storybook') { drawMantis(ml, MX - 5, MY - 5, MS, Object.assign({ flat: 'rgba(255,240,200,.8)' }, mo)); drawMantis(ml, MX, MY, MS, mo); }
  else drawMantis(ml, MX, MY, MS, mo);
  if (st === 'hd2d') { // backlit darkening
    ml.globalCompositeOperation = 'source-atop'; const g = ml.createRadialGradient(sun[0], sun[1], 100, sun[0], sun[1], 900); g.addColorStop(0, 'rgba(255,220,140,.15)'); g.addColorStop(1, 'rgba(0,20,10,.45)'); ml.fillStyle = g; ml.fillRect(-1500, -1500, 3000, 3000); ml.globalCompositeOperation = 'source-over';
  }
  // blowing petals in foreground
  const pe = R.layer({ blur: st === 'cuphead' ? 0 : 3 });
  const r = rng(77);
  for (let i = 0; i < 22; i++) {
    const t0 = 0.8 + r() * 1.6, sp = 700 + r() * 600, y0 = -600 + r() * 1200, ph = r() * TAU;
    const v = t - t0; if (v < 0) continue;
    const x = -900 + v * sp, y = y0 + Math.sin(v * 3 + ph) * 60 + v * 80;
    const c = i % 3 === 0 ? P.leafL : i % 3 === 1 ? P.flA : P.flB;
    drawLeaf(pe, x, y, ph + v * 4, 34 + r() * 30, 22, 0.2, c, null, { vein: false, lw: 3, n: 6, seed: i });
  }
  R.compose();
  // flare
  if (st !== 'cuphead') {
    const m = R.m; m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'screen';
    const cx = R.W / 2, cy = R.H / 2, intensity = sstep(0.4, 2.0, t);
    for (let i = 1; i <= 4; i++) { const f = i * 0.45, x = sunS[0] + (cx - sunS[0]) * f * 2, y = sunS[1] + (cy - sunS[1]) * f * 2, rr = (40 + i * 30) * R.px; m.globalAlpha = 0.18 * intensity; m.fillStyle = i % 2 ? '#ffd27a' : '#9fe0c0'; m.beginPath(); m.arc(x, y, rr, 0, TAU); m.fill(); }
    m.globalAlpha = 0.25 * intensity; const hg = m.createLinearGradient(0, sunS[1], R.W, sunS[1]); hg.addColorStop(0, 'rgba(255,220,150,0)'); hg.addColorStop(sunS[0] / R.W, 'rgba(255,230,170,.9)'); hg.addColorStop(1, 'rgba(255,220,150,0)'); m.fillStyle = hg; m.fillRect(0, sunS[1] - 3 * R.px, R.W, 6 * R.px);
    m.restore();
  }
}
// ---------- E: crane up & reveal ----------
function shotE(t, gt) {
  const fc = finalCam(); const u = eio(clamp(t / 2.9));
  const cam = { x: lerp(-90, fc.x, u), y: lerp(150, fc.y, u), z: lerp(2.7, fc.z, u), r: lerp(-0.03, 0, u) };
  sceneDome(gt - 15, { cam, glassA: sstep(2.0, 1.2, cam.z), exposure: 1, rays: 1 + 0.4 * (1 - u), sweep: 0, mist: 0.15 * (1 - u) });
  const ta = sstep(1.4, 2.2, t) * (1 - sstep(3.0, 3.7, t));
  if (ta > 0) drawTitle(R.m, ta, sstep(1.8, 3.0, t));
}
function sceneLoop(lt) { sceneDome(lt, { cam: finalCam(), glassA: 1, exposure: 1, rays: 1, mist: 0 }); }

// ---------- title ----------
function drawTitle(m, a, sweep) {
  const st = R.style, W = R.W, H = R.H;
  m.save(); m.setTransform(1, 0, 0, 1, 0, 0);
  const y = R.portrait ? H * 0.19 : H * 0.22;
  let fs = R.portrait ? W * 0.13 : H * 0.13;
  const text = st === 'storybook' ? 'Terrarium' : 'TERRARIUM';
  const fam = st === 'cuphead' ? `italic 700 ${fs}px Georgia` : st === 'storybook' ? `italic 400 ${fs * 1.12}px Georgia` : `400 ${fs}px "Times New Roman"`;
  m.font = fam; m.letterSpacing = st === 'hd2d' ? `${fs * 0.14}px` : st === 'cuphead' ? `${fs * 0.04}px` : '0px';
  let w = m.measureText(text).width; const maxW = W * 0.86; if (w > maxW) { fs *= maxW / w; m.font = fam.replace(/[\d.]+px/, (st === 'storybook' ? fs * 1.12 : fs) + 'px'); m.letterSpacing = st === 'hd2d' ? `${fs * 0.14}px` : st === 'cuphead' ? `${fs * 0.04}px` : '0px'; w = m.measureText(text).width; }
  m.textAlign = 'left'; m.textBaseline = 'middle';
  const x0 = W / 2 - w / 2 + (st === 'hd2d' ? fs * 0.07 : 0);
  m.globalAlpha = a;
  if (st === 'hd2d') {
    m.shadowColor = 'rgba(255,200,110,.8)'; m.shadowBlur = 40 * R.px;
    const g = m.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); g.addColorStop(0, '#fff6d2'); g.addColorStop(1, '#d8a85a'); m.fillStyle = g; m.fillText(text, x0, y);
    m.shadowBlur = 0;
    // sweep
    const sx = lerp(x0 - w * 0.3, x0 + w * 1.3, sweep);
    m.globalCompositeOperation = 'source-atop';
    const sg = m.createLinearGradient(sx - fs, 0, sx + fs, 0); sg.addColorStop(0, 'rgba(255,255,240,0)'); sg.addColorStop(0.5, 'rgba(255,255,250,.95)'); sg.addColorStop(1, 'rgba(255,255,240,0)');
    m.globalCompositeOperation = 'source-over';
    m.save(); m.beginPath(); m.rect(sx - fs, y - fs, fs * 2, fs * 2); m.clip(); m.fillStyle = sg; m.fillText(text, x0, y); m.restore();
    m.font = `400 ${fs * 0.2}px "Times New Roman"`; m.letterSpacing = `${fs * 0.05}px`; m.textAlign = 'center'; m.fillStyle = 'rgba(255,240,205,.85)'; m.fillText('A CALM LITTLE WORLD UNDER GLASS', W / 2, y + fs * 0.78);
  } else if (st === 'cuphead') {
    const bounce = 1 + Math.sin(clamp(a) * Math.PI) * 0.04;
    m.translate(W / 2, y); m.scale(bounce, bounce); m.translate(-W / 2, -y);
    m.lineJoin = 'round'; m.fillStyle = R.P.ink; m.fillText(text, x0 + fs * 0.06, y + fs * 0.07);
    m.strokeStyle = R.P.ink; m.lineWidth = fs * 0.09; m.strokeText(text, x0, y); m.fillStyle = '#fff1cc'; m.fillText(text, x0, y);
    const tg = 'A CALM LITTLE WORLD UNDER GLASS'; m.font = `${fs * 0.17}px "Arial Black"`; m.letterSpacing = `${fs * 0.02}px`; const tw = m.measureText(tg).width;
    const bx = W / 2 - tw / 2 - fs * 0.25, by = y + fs * 0.62, bh = fs * 0.32;
    m.fillStyle = R.P.ink; m.fillRect(bx + 6 * R.px, by + 6 * R.px, tw + fs * 0.5, bh); m.fillStyle = '#d23a2a'; m.fillRect(bx, by, tw + fs * 0.5, bh); m.lineWidth = 4 * R.px; m.strokeRect(bx, by, tw + fs * 0.5, bh);
    m.fillStyle = '#fff1cc'; m.textAlign = 'center'; m.fillText(tg, W / 2, by + bh / 2 + 2 * R.px);
  } else {
    // ink write-on
    const rv = clamp(sweep * 1.3 + a * 0.2);
    m.save(); m.beginPath(); m.rect(0, 0, x0 + w * rv + fs * 0.3, H); m.clip();
    m.shadowColor = 'rgba(255,248,230,.95)'; m.shadowBlur = 24 * R.px; m.fillStyle = '#3a2a1a'; m.fillText(text, x0, y); m.shadowBlur = 0; m.restore();
    m.font = `italic ${fs * 0.22}px Georgia`; m.textAlign = 'center'; m.globalAlpha = a * sstep(0.5, 1, rv); m.fillStyle = '#5a4430'; m.fillText('a calm little world under glass', W / 2, y + fs * 0.78);
  }
  m.restore();
}

// ---------- post ----------
function post(gt, frame, out) {
  const st = R.style, W = R.W, H = R.H, o = out, m = R.main;
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; o.filter = 'none';
  if (st === 'hd2d') {
    o.drawImage(m, 0, 0);
    // tilt-shift
    const s = R.sm; s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, W / 4, H / 4); s.filter = 'blur(2px)'; s.drawImage(m, 0, 0, W / 4, H / 4); s.filter = 'none';
    s.globalCompositeOperation = 'destination-in'; const g = s.createLinearGradient(0, 0, 0, H / 4); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(0.24, 'rgba(0,0,0,0)'); g.addColorStop(0.72, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.95)'); s.fillStyle = g; s.fillRect(0, 0, W / 4, H / 4); s.globalCompositeOperation = 'source-over';
    o.drawImage(R.small, 0, 0, W, H);
    // bloom
    const b = R.s8; b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W / 8, H / 8); b.filter = 'brightness(0.85) contrast(2.4) blur(3px)'; b.drawImage(m, 0, 0, W / 8, H / 8); b.filter = 'none';
    o.globalCompositeOperation = 'screen'; o.globalAlpha = 0.55; o.drawImage(R.small8, 0, 0, W, H); o.globalAlpha = 1;
    // grade: warm top / teal bottom
    o.globalCompositeOperation = 'soft-light'; const gg = o.createLinearGradient(0, 0, 0, H); gg.addColorStop(0, 'rgba(255,190,110,.5)'); gg.addColorStop(1, 'rgba(20,90,90,.5)'); o.fillStyle = gg; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'source-over';
    vignette(o, 0.6, '0,0,0');
  } else if (st === 'cuphead') {
    const r = rng(frame * 13 + 1);
    const jx = (r() - 0.5) * 3 * R.px, jy = (r() - 0.5) * 3 * R.px;
    o.fillStyle = '#1b120a'; o.fillRect(0, 0, W, H);
    o.filter = 'sepia(0.45) saturate(1.15) contrast(1.08)'; o.drawImage(m, jx, jy); o.filter = 'none';
    o.globalCompositeOperation = 'source-over';
    // flicker
    const fl = (r() - 0.5) * 0.08; o.fillStyle = fl > 0 ? `rgba(255,245,220,${fl})` : `rgba(20,12,4,${-fl})`; o.fillRect(0, 0, W, H);
    // scratches & dust
    o.strokeStyle = 'rgba(40,28,14,.55)';
    for (let i = 0; i < 2; i++) if (r() < 0.55) { const x = r() * W; o.lineWidth = (1 + r() * 1.5) * R.px; o.beginPath(); o.moveTo(x, 0); o.lineTo(x + (r() - 0.5) * 20, H); o.stroke(); }
    if (r() < 0.12) { o.strokeStyle = 'rgba(30,20,8,.45)'; o.lineWidth = 2 * R.px; const x = r() * W, y = r() * H; o.beginPath(); o.moveTo(x, y); o.bezierCurveTo(x + 20 * R.px, y + 10 * R.px, x + 5 * R.px, y + 30 * R.px, x + 25 * R.px, y + 40 * R.px); o.stroke(); }
    vignette(o, 0.75, '27,18,10');
  } else {
    o.drawImage(m, 0, 0);
    o.globalCompositeOperation = 'multiply'; o.drawImage(R.paper, 0, 0); o.globalCompositeOperation = 'source-over';
    vignette(o, 0.35, '90,60,30');
  }
}
function vignette(o, a, c) { const W = R.W, H = R.H, g = o.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6); g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(1, `rgba(${c},${a})`); o.fillStyle = g; o.fillRect(0, 0, W, H); }

// ---------- frame entry ----------
function renderShot(id, gt) {
  const sh = SHOTS.find(s => s[0] === id), t = gt - sh[1];
  const m = R.m; m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 1; m.globalCompositeOperation = 'source-over'; m.filter = 'none'; m.clearRect(0, 0, R.W, R.H);
  R.begin();
  if (id === 'A') shotA(t); else if (id === 'B') shotB(t, gt); else if (id === 'C1') shotC1(t); else if (id === 'C2') shotC2(t); else if (id === 'D') shotD(t); else shotE(t, gt);
}
function shotAt(gt) { for (const s of SHOTS) if (gt < s[2]) return s[0]; return 'E'; }
function overlay(kind, v, side, cx, cy) {
  const o = R.o, W = R.W, H = R.H; o.setTransform(1, 0, 0, 1, 0, 0);
  if (kind === 'flash') { o.fillStyle = R.style === 'hd2d' ? `rgba(255,244,214,${v})` : `rgba(255,255,250,${v})`; o.globalCompositeOperation = 'source-over'; o.fillRect(0, 0, W, H); }
  if (kind === 'dip') { o.fillStyle = `rgba(0,0,0,${v})`; o.fillRect(0, 0, W, H); }
  if (kind === 'iris') { const rr = (1 - v) * Math.hypot(W, H) * 0.6; o.fillStyle = '#120c06'; o.beginPath(); o.rect(0, 0, W, H); o.arc(cx || W / 2, cy || H / 2, Math.max(0, rr), 0, TAU, true); o.fill('evenodd'); }
}
function bloomMask(prog, cx, cy) {
  const mm = R.mm, W = R.W, H = R.H; mm.setTransform(1, 0, 0, 1, 0, 0); mm.clearRect(0, 0, W, H);
  const Rm = Math.hypot(W, H) * 1.05 * eo(prog);
  const pts = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU, r = Rm * (1 + 0.16 * vnoise(i * 0.7 + 3) + 0.06 * vnoise(i * 2.3 + prog * 4)); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  mm.filter = `blur(${10 * R.px}px)`; tracePath(mm, pts, true, true); mm.fillStyle = '#fff'; mm.fill(); mm.filter = 'none';
  return pts;
}
window.renderIntroFrame = function (frame) {
  const gt = frame / FPS;
  const st = R.style, tr = TRANS[st];
  const tA = st === 'cuphead' ? Math.floor(frame / 2) * 2 / FPS : gt; // animate on twos
  let cur = shotAt(tA);
  // mask transitions (two shots)
  let done = false;
  for (const [tb, kind, d1, d2] of tr) {
    if ((kind === 'cross' || kind === 'bloom') && tA >= tb - d1 && tA < tb + d2) {
      const prev = shotAt(tb - 0.001), next = shotAt(tb + 0.001);
      const prog = (tA - (tb - d1)) / (d1 + d2);
      renderShot(next, tA); R.tm.setTransform(1, 0, 0, 1, 0, 0); R.tm.clearRect(0, 0, R.W, R.H); R.tm.drawImage(R.main, 0, 0);
      renderShot(prev, tA);
      if (kind === 'cross') { R.m.setTransform(1, 0, 0, 1, 0, 0); R.m.globalAlpha = eio(prog); R.m.drawImage(R.tmp, 0, 0); R.m.globalAlpha = 1; }
      else {
        const c = prev === 'A' && R.impact ? R.impact : { x: R.W * 0.5, y: R.H * 0.45 };
        const pts = bloomMask(prog, c.x, c.y);
        R.tm.globalCompositeOperation = 'destination-in'; R.tm.drawImage(R.mask, 0, 0); R.tm.globalCompositeOperation = 'source-over';
        R.m.setTransform(1, 0, 0, 1, 0, 0); R.m.drawImage(R.tmp, 0, 0);
        R.m.filter = `blur(${6 * R.px}px)`; tracePath(R.m, pts, true, true); R.m.strokeStyle = 'rgba(110,80,40,.35)'; R.m.lineWidth = 14 * R.px; R.m.stroke(); R.m.filter = 'none';
      }
      done = true; break;
    }
  }
  if (!done) renderShot(cur, tA);
  post(gt, frame, R.o);
  for (const [tb, kind, d1, d2] of tr) {
    if (kind === 'cross' || kind === 'bloom') continue;
    if (tA >= tb - d1 && tA < tb + d2) {
      const v = tA < tb ? sstep(tb - d1, tb, tA) : 1 - sstep(tb, tb + d2, tA);
      overlay(kind, kind === 'flash' ? v * 0.95 : v);
    }
  }
  // iris-in at very start for cuphead, fade from black at start for others
  if (st === 'cuphead' && gt < 0.6) overlay('iris', 1 - eo(gt / 0.6) * 1);
  else if (gt < 0.4) { R.o.setTransform(1, 0, 0, 1, 0, 0); R.o.fillStyle = `rgba(0,0,0,${1 - gt / 0.4})`; R.o.fillRect(0, 0, R.W, R.H); }
};
window.renderLoopFrame = function (frame) {
  const st = R.style; const fA = st === 'cuphead' ? Math.floor(frame / 2) * 2 : frame;
  const lt = fA / FPS;
  const m = R.m; m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, R.W, R.H); R.begin();
  sceneLoop(lt);
  post(lt, frame, R.o);
};
window.setupIntro = function (W, H, style, orient) { R.init(W, H, style, orient); WORLD = buildWorld(); FACE = null; };
