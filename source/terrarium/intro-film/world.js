// The terrarium dome world + backdrops + light FX
const DOME = { cx: 0, by: 300, rx: 500, ry: 700 };
function soilTop(x) { return 255 - 22 * Math.sin(x * 0.006 + 1) - 14 * Math.sin(x * 0.017 + 2) - 30 * Math.exp(-((x + 150) ** 2) / 30000); }
let WORLD = null;
function buildWorld() {
  const r = rng(42), W = {};
  W.specks = []; for (let i = 0; i < 260; i++) { const x = (r() * 2 - 1) * 480; const top = soilTop(x); const y = top + r() * (300 + 52 * Math.sqrt(Math.max(0, 1 - (x / 495) ** 2)) - top); W.specks.push([x, y, 1.5 + r() * 4, r()]); }
  W.pebbles = []; for (let i = 0; i < 16; i++) { const x = (r() * 2 - 1) * 430; W.pebbles.push([x, soilTop(x) + 12 + r() * 30, 10 + r() * 16, r()]); }
  W.moss = []; for (let i = 0; i < 26; i++) { const x = (r() * 2 - 1) * 460; W.moss.push([x, soilTop(x) + 4 + r() * 40, 26 + r() * 40, r()]); }
  W.grass = []; for (let i = 0; i < 9; i++) { const x = (r() * 2 - 1) * 440; W.grass.push([x, soilTop(x) + 10 + r() * 20, 60 + r() * 70, r()]); }
  W.motes = []; for (let i = 0; i < 70; i++) W.motes.push([(r() * 2 - 1) * 520, -380 + r() * 640, 1 + r() * 2.6, r() * TAU, 20 + r() * 50, 1 + Math.floor(r() * 2)]);
  W.bokeh = []; for (let i = 0; i < 34; i++) W.bokeh.push([r(), r(), 30 + r() * 120, r(), r() * TAU]);
  W.flies = []; for (let i = 0; i < 18; i++) W.flies.push([(r() * 2 - 1) * 700, -350 + r() * 600, r() * TAU, 30 + r() * 60]);
  return W;
}
const sw = (lt, k, ph, a) => Math.sin(W2(lt) * k + ph) * a; // periodic sway

// ---------- backdrop (screen + world parallax) ----------
function drawBackdrop(ctxS, lt, o = {}) {
  const P = R.P, st = R.style, W = R.W, H = R.H, ex = o.exposure == null ? 1 : o.exposure;
  if (st === 'hd2d') {
    const g = ctxS.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#08201a'); g.addColorStop(0.55, '#0d2c1f'); g.addColorStop(1, '#040b07');
    ctxS.fillStyle = g; ctxS.fillRect(0, 0, W, H);
    glow(ctxS, W * 0.28, H * 0.05, Math.max(W, H) * 0.7, 'rgba(255,200,110,.55)', 0.35 * ex);
    for (const b of WORLD.bokeh) {
      const x = (b[0] * 1.2 - 0.1) * W + sw(lt, 1, b[4], 30) * R.px, y = b[1] * H + sw(lt, 1, b[4] + 1, 20) * R.px, rr = b[2] * R.px;
      ctxS.globalAlpha = (0.05 + b[3] * 0.1) * ex * (0.75 + 0.25 * Math.sin(W2(lt) * 2 + b[4]));
      ctxS.fillStyle = b[3] > 0.6 ? '#ffd890' : '#7fd6a0'; ctxS.beginPath(); ctxS.arc(x, y, rr, 0, TAU); ctxS.fill();
      ctxS.globalAlpha *= 0.6; ctxS.strokeStyle = '#fff2c8'; ctxS.lineWidth = 2 * R.px; ctxS.stroke();
    }
    ctxS.globalAlpha = 1;
  } else if (st === 'cuphead') {
    const g = ctxS.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#b9b37a'); g.addColorStop(0.6, '#d9cf98'); g.addColorStop(1, '#c9bb84');
    ctxS.fillStyle = g; ctxS.fillRect(0, 0, W, H);
    // sunburst
    const cx = W / 2, cy = H * 0.36, n = 24, rot = W2(lt) / n;
    ctxS.save(); ctxS.translate(cx, cy); ctxS.rotate(rot); ctxS.fillStyle = 'rgba(255,236,170,.32)';
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ctxS.beginPath(); ctxS.moveTo(0, 0); ctxS.arc(0, 0, Math.max(W, H) * 1.2, a, a + TAU / n / 2); ctxS.closePath(); ctxS.fill(); }
    ctxS.restore();
  } else {
    ctxS.fillStyle = P.bg1; ctxS.fillRect(0, 0, W, H);
    glow(ctxS, W * 0.3, H * 0.15, Math.max(W, H) * 0.6, 'rgba(255,236,190,.9)', 0.6);
  }
}
// world-space background scenery (hills, clouds) on a parallax layer
function drawScenery(ctx, lt) {
  const P = R.P, st = R.style;
  if (st === 'cuphead') {
    for (let i = 0; i < 5; i++) {
      const x = -900 + i * 450 + sw(lt, 1, i, 40), y = -470 + (i % 2) * 120 + sw(lt, 2, i * 2, 10), s = 1 + (i % 3) * 0.25;
      const pts = []; const bumps = [[-90, 10, 60], [-30, -30, 75], [50, -20, 65], [100, 15, 50], [0, 25, 60]];
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.beginPath(); for (const b of bumps) { ctx.moveTo(b[0] + b[2], b[1]); ctx.arc(b[0], b[1], b[2], 0, TAU); }
      ctx.fillStyle = P.cream; ctx.lineWidth = 9 * ctx.__k / s; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.fill();
      ctx.fillStyle = 'rgba(220,200,150,.6)'; ctx.beginPath(); ctx.ellipse(10, 45, 120, 22, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    const hill = (y0, amp, f, c, ph) => { const pts = [[-1600, 1400]]; for (let x = -1600; x <= 1600; x += 80) pts.push([x, y0 - amp * Math.sin(x * f + ph) - amp * 0.4 * Math.sin(x * f * 2.3 + ph)]); pts.push([1600, 1400]); shape(ctx, pts, c, { lw: 4 }); };
    hill(120, 60, 0.004, '#9fb05e', 1); hill(250, 50, 0.006, '#7c9c48', 3);
  } else if (st === 'storybook') {
    const wash = (y0, amp, f, c, ph, a) => { const pts = [[-1600, 1400]]; for (let x = -1600; x <= 1600; x += 70) pts.push([x, y0 - amp * Math.sin(x * f + ph) - 18 * vnoise(x * 0.02 + ph)]); pts.push([1600, 1400]); shape(ctx, pts, rgba(c, a), { lw: 1.4, inkA: 0.35, seed: ph }); };
    for (let i = 0; i < 4; i++) { const x = -800 + i * 520 + sw(lt, 1, i, 30), y = -430 + (i % 2) * 90; shape(ctx, ellipsePts(x, y, 150, 45, 16, 0, 0.18, i), 'rgba(255,255,255,.75)', { lw: 1.2, inkA: 0.3, seed: i }); }
    wash(80, 70, 0.0035, '#b9c99a', 1, 0.7); wash(220, 50, 0.005, '#9db27e', 2, 0.75);
  } else {
    // hd2d: dark foliage silhouettes in the distance
    for (let i = 0; i < 14; i++) { const x = -1300 + i * 200, h = 300 + (i * 97 % 5) * 70; drawLeaf(ctx, x, 420, -1.57 + Math.sin(i * 3) * 0.4 + sw(lt, 1, i, 0.03), h, 120, 0.2, '#0c2a1c', '#1a4a30', { vein: false, line: false }); }
  }
}
function drawTable(ctx) {
  const P = R.P, st = R.style;
  const c = st === 'hd2d' ? '#0a140e' : st === 'cuphead' ? '#8a6238' : '#c9b48e';
  shape(ctx, [[-2000, 360], [2000, 360], [2000, 2400], [-2000, 2400]], c, { smooth: false, lw: 5 });
  if (st === 'cuphead') { ctx.strokeStyle = 'rgba(27,18,10,.35)'; ctx.lineWidth = 3 * ctx.__k; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-2000, 420 + i * 70); ctx.lineTo(2000, 420 + i * 70); ctx.stroke(); } }
}

// ---------- dome terrarium ----------
function drawPlinth(ctx) {
  const P = R.P, st = R.style;
  const sh = ellipsePts(0, 395, 640, 50, 30); ctx.globalAlpha = st === 'storybook' ? 0.25 : 0.45; ctx.fillStyle = '#000'; tracePath(ctx, sh, true); ctx.fill(); ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(-560, 0, 560, 0); g.addColorStop(0, mix(P.plinth, '#000', 0.3)); g.addColorStop(0.35, P.plinthL); g.addColorStop(1, mix(P.plinth, '#000', 0.4));
  const side = [[-545, 300], [-545, 360]]; for (let i = 0; i <= 20; i++) { const a = Math.PI - (i / 20) * Math.PI; side.push([Math.cos(a) * 545, 360 + Math.sin(a) * 52]); } side.push([545, 300]);
  for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI; side.push([Math.cos(a) * 545, 300 + Math.sin(a) * 52]); }
  shape(ctx, side, g, { smooth: false, lw: 5, seed: 30 });
  shape(ctx, ellipsePts(0, 300, 545, 52, 36), mix(P.plinthL, '#fff', st === 'hd2d' ? 0.05 : 0.15), { lw: 4, seed: 31 });
  if (st === 'hd2d') { ctx.strokeStyle = 'rgba(255,210,140,.55)'; ctx.lineWidth = 3 * ctx.__k; ctx.beginPath(); ctx.ellipse(0, 300, 545, 52, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
}
function glassPath(ctx, sx = 1) { ctx.beginPath(); ctx.ellipse(0, DOME.by, DOME.rx * sx, DOME.ry, 0, Math.PI, TAU); }
function drawGlassBack(ctx) {
  const st = R.style;
  glassPath(ctx); ctx.closePath();
  ctx.fillStyle = st === 'hd2d' ? 'rgba(150,230,190,.06)' : st === 'cuphead' ? 'rgba(255,250,230,.22)' : 'rgba(255,255,255,.28)';
  ctx.fill();
}
function drawGlassFront(ctx, lt, a = 1) {
  const st = R.style, k = ctx.__k;
  if (a <= 0) return;
  ctx.globalAlpha = a;
  // rim
  glassPath(ctx);
  if (st === 'cuphead') { ctx.strokeStyle = R.P.ink; ctx.lineWidth = 6 * k; ctx.stroke(); }
  else if (st === 'storybook') { ctx.strokeStyle = rgba(R.P.ink, 0.55); ctx.lineWidth = 2.2 * k; ctx.stroke(); glassPath(ctx, 0.985); ctx.strokeStyle = 'rgba(160,190,200,.35)'; ctx.lineWidth = 8 * k; ctx.stroke(); }
  else { ctx.strokeStyle = 'rgba(200,255,230,.35)'; ctx.lineWidth = 3 * k; ctx.stroke(); glassPath(ctx, 0.99); ctx.strokeStyle = 'rgba(200,255,230,.08)'; ctx.lineWidth = 14 * k; ctx.stroke(); }
  // big curved reflection left + small right
  const refl = (a0, a1, rs, w, al) => { ctx.beginPath(); ctx.ellipse(0, DOME.by, DOME.rx * rs, DOME.ry * rs, 0, a0, a1); ctx.lineCap = 'round'; ctx.strokeStyle = st === 'cuphead' ? `rgba(255,255,255,${al + 0.25})` : `rgba(255,255,250,${al})`; ctx.lineWidth = w * k; ctx.stroke(); };
  const sh = 0.5 + 0.5 * Math.sin(W2(lt));
  refl(Math.PI * 1.12, Math.PI * 1.36, 0.9, 26, 0.16 + 0.05 * sh); refl(Math.PI * 1.4, Math.PI * 1.45, 0.9, 16, 0.12); refl(Math.PI * 1.7, Math.PI * 1.86, 0.93, 10, 0.12);
  if (st === 'cuphead') { ctx.strokeStyle = R.P.ink; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.ellipse(0, DOME.by, DOME.rx * 0.9, DOME.ry * 0.9, 0, Math.PI * 1.12, Math.PI * 1.36); ctx.stroke(); }
  // knob
  const kg = ctx.createLinearGradient(-30, 0, 30, 0); kg.addColorStop(0, R.P.plinth); kg.addColorStop(0.4, R.P.plinthL); kg.addColorStop(1, R.P.plinth);
  shape(ctx, ellipsePts(0, -412, 34, 20, 16), kg, { lw: 4, seed: 40 });
  shape(ctx, ellipsePts(0, -432, 18, 18, 14), kg, { lw: 4, seed: 41 });
  ctx.globalAlpha = 1;
}
function drawSoil(ctx) {
  const P = R.P, st = R.style;
  const pts = [];
  for (let x = -495; x <= 495; x += 30) pts.push([x, soilTop(x)]);
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; pts.push([Math.cos(a) * 495, 300 + Math.sin(a) * 50]); }
  const g = ctx.createLinearGradient(0, 200, 0, 350); g.addColorStop(0, P.soilL); g.addColorStop(0.35, P.soil); g.addColorStop(1, P.soilD);
  shape(ctx, pts, g, { lw: 4, seed: 50, smooth: false });
  for (const s of WORLD.specks) { ctx.fillStyle = s[3] > 0.5 ? rgba(P.soilD, 0.7) : rgba(P.soilL, 0.6); ctx.fillRect(s[0], s[1], s[2], s[2] * 0.7); }
}
function drawMoss(ctx, lt, front) {
  const P = R.P;
  for (const m of WORLD.moss) {
    if ((m[1] > 285) !== front) continue;
    const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; pts.push([m[0] + Math.cos(a) * m[2], m[1] + Math.sin(a) * m[2] * 0.55 * (1 + 0.25 * Math.sin(i * 2.7 + m[3] * 9))]); }
    shape(ctx, pts, m[3] > 0.5 ? P.moss : mix(P.moss, P.mossL, 0.5), { lw: 3, seed: m[0] });
    if (R.style !== 'cuphead') { ctx.fillStyle = rgba(P.mossL, 0.6); for (let i = 0; i < 5; i++) ctx.fillRect(m[0] + (i - 2) * m[2] * 0.35, m[1] - m[2] * 0.3 - (i % 2) * 6, 3, 3); }
  }
}
function drawPebbles(ctx) { for (const p of WORLD.pebbles) shape(ctx, ellipsePts(p[0], p[1], p[2], p[2] * 0.65, 12, p[3], 0.1, p[3] * 9), mix(R.P.rock, R.P.rockD, p[3]), { lw: 3, seed: p[0] }); }
function drawFern(ctx, x, y, h, lt, ph) {
  const P = R.P;
  for (let f = 0; f < 6; f++) {
    const base = -1.57 + (f - 2.5) * 0.32 + sw(lt, 1, ph + f, 0.04);
    const len = h * (0.75 + 0.25 * Math.sin(f * 2.1 + 1)), bend = (f - 2.5) * 0.12;
    const spine = []; for (let i = 0; i <= 12; i++) { const u = i / 12; const a = base + bend * u * 2.2; spine.push([x + Math.cos(base) * len * u + Math.cos(a) * 0, y + Math.sin(base) * len * u + (u * u) * len * 0.25 * Math.abs(bend) * 2]); }
    for (let i = 0; i < spine.length; i++) { spine[i][0] += (i / 12) ** 2 * bend * len * 0.9; }
    const col = f % 2 ? P.leafM : mix(P.leafM, P.leafL, 0.35);
    for (let i = 2; i < 12; i++) {
      const p = spine[i], q = spine[i + 1]; const a = Math.atan2(q[1] - p[1], q[0] - p[0]); const ll = (1 - i / 13) * len * 0.22 + 6;
      drawLeaf(ctx, p[0], p[1], a - 1.1, ll, ll * 0.42, 0.1, col, null, { vein: false, lw: 2.4, n: 6, seed: i + f * 13 });
      drawLeaf(ctx, p[0], p[1], a + 1.1, ll, ll * 0.42, -0.1, col, null, { vein: false, lw: 2.4, n: 6, seed: i + f * 17 });
    }
    stroke(ctx, spine, P.stem, 4 * ctx.__k + 2, { seed: f });
  }
}
function drawBroad(ctx, x, y, lt, stems) {
  const P = R.P;
  for (const [ang, len, lsz, ph, c] of stems) {
    const a = ang + sw(lt, 1, ph, 0.035);
    const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len];
    const mid = [x + Math.cos(a) * len * 0.5 + Math.sin(ph) * 30, y + Math.sin(a) * len * 0.5];
    stroke(ctx, [[x, y], mid, tip], P.stem, 7, { seed: ph, hi: P.leafL });
    const la = a + (Math.cos(a) > 0 ? 0.9 : -0.9) + sw(lt, 2, ph, 0.05);
    for (const [uu, sd] of [[0.42, 1], [0.7, -1]]) { const q = [lerp(x, mid[0], uu * 2 > 1 ? 1 : uu * 2), lerp(y, mid[1], Math.min(1, uu * 2))]; const qq = uu > 0.5 ? [lerp(mid[0], tip[0], (uu - 0.5) * 2), lerp(mid[1], tip[1], (uu - 0.5) * 2)] : q; drawLeaf(ctx, qq[0], qq[1], a + sd * 1.0 + sw(lt, 2, ph + uu * 5, 0.06), lsz * 0.62, lsz * 0.47, 0.15 * sd, P.leafD, P.leafM, { heart: 1, seed: ph * 10 + uu * 7, k: 0.7 }); }
    drawLeaf(ctx, tip[0], tip[1], la, lsz, lsz * 0.75, 0.15, c ? P.leafM : P.leafD, c ? P.leafL : P.leafM, { heart: 1, seed: ph * 10, k: 0.7 });
  }
}
function drawOrchid(ctx, x, y, lt) {
  const P = R.P;
  const a = -1.45 + sw(lt, 1, 2, 0.03);
  const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([x + Math.cos(a) * 470 * u + Math.sin(u * 3) * 25 + u * u * 70, y + Math.sin(a) * 470 * u]); }
  stroke(ctx, pts, P.stem, 5, { seed: 3 });
  drawLeaf(ctx, x - 5, y, -2.7, 130, 60, 0.3, P.leafD, P.leafM, { seed: 81 }); drawLeaf(ctx, x + 5, y, -0.4, 140, 62, -0.3, P.leafD, P.leafM, { seed: 82 });
  for (let i = 4; i <= 8; i++) {
    const p = pts[i], s = 20 - (i - 4) * 1.5, rot = sw(lt, 2, i, 0.12) + i;
    for (let j = 0; j < 5; j++) { const pa = rot + (j / 5) * TAU; drawLeaf(ctx, p[0] + 22, p[1], pa, s * 1.5, s * 1.1, 0, i % 2 ? P.flA : mix(P.flA, '#ffffff', 0.4), null, { vein: false, lw: 2.2, n: 6, seed: i * 5 + j }); }
    ctx.fillStyle = P.flB; ctx.beginPath(); ctx.arc(p[0] + 22, p[1], s * 0.38, 0, TAU); ctx.fill();
  }
}
function drawBranch(ctx) {
  const P = R.P;
  const sp = [[130, 290], [180, 180], [240, 60], [300, -40], [345, -110]];
  stroke(ctx, sp, P.wood, 34, { seed: 21, hi: P.woodL });
  stroke(ctx, [[240, 60], [200, -10], [175, -60]], P.wood, 16, { seed: 22, hi: P.woodL });
  if (R.style !== 'cuphead') { ctx.strokeStyle = rgba(P.woodL, 0.5); ctx.lineWidth = 2 * ctx.__k; for (let i = 0; i < 3; i++) { tracePath(ctx, sp.map(p => [p[0] + (i - 1) * 7, p[1]]), false, true); ctx.stroke(); } }
}
function drawGrass(ctx, lt) { const P = R.P; for (const g of WORLD.grass) for (let i = 0; i < 5; i++) { const a = -1.57 + (i - 2) * 0.22 + sw(lt, 2, g[3] * 9 + i, 0.05); const l = g[2] * (0.7 + 0.3 * Math.sin(i * 3 + g[3])); stroke(ctx, [[g[0] + i * 3, g[1]], [g[0] + Math.cos(a) * l * 0.5, g[1] + Math.sin(a) * l * 0.5], [g[0] + Math.cos(a - 0.15) * l, g[1] + Math.sin(a) * l]], i % 2 ? P.leafM : P.leafL, 4, { seed: i + g[0] }); } }
function drawDish(ctx, lt) {
  const P = R.P; shape(ctx, ellipsePts(-20, 300, 78, 22, 20), R.style === 'hd2d' ? '#cfcfc4' : '#f2ead6', { lw: 4, seed: 61 });
  const g = ctx.createLinearGradient(-80, 290, 60, 310); g.addColorStop(0, P.water); g.addColorStop(0.5 + 0.3 * Math.sin(W2(lt)), '#ffffff'); g.addColorStop(1, P.water);
  shape(ctx, ellipsePts(-20, 298, 62, 15, 18), g, { lw: 2.5, seed: 62 });
}
// whole terrarium. o: {glassA}
function drawTerrarium(ctx, lt, o = {}) {
  drawPlinth(ctx);
  drawGlassBack(ctx);
  for (let i = 0; i < 7; i++) { const bx = 60 + i * 38; drawLeaf(ctx, bx, 250, -1.57 + (i - 3) * 0.12 + sw(lt, 1, i, 0.03), 260 + (i % 3) * 70, 46, (i - 3) * 0.05, R.P.leafD, mix(R.P.leafM, R.P.leafL, 0.3), { seed: 200 + i, k: 0.6 }); }
  drawFern(ctx, 400, 255, 260, lt, 4);
  drawFern(ctx, -330, 245, 380, lt, 1);
  drawOrchid(ctx, 300, 250, lt);
  drawBroad(ctx, -120, 240, lt, [[-1.95, 280, 120, 1, 0], [-1.35, 330, 135, 2, 1], [-2.3, 200, 105, 3, 1], [-1.7, 400, 120, 4, 0], [-0.95, 220, 110, 5, 1]]);
  drawSoil(ctx);
  drawBranch(ctx);
  drawMoss(ctx, lt, false);
  drawPebbles(ctx);
  drawGrass(ctx, lt);
  drawDish(ctx, lt);
  // critters
  const lf = leafPts(-120 + Math.cos(-1.35) * 330, 240 + Math.sin(-1.35) * 330, -1.35 + 0.9, 135, 101, 0.15, 12, 0.7, 1);
  const spPos = lf.spine[5];
  drawSpider(ctx, spPos[0] - 6, spPos[1] - 18, 38, { palp: W2(lt) * 6, phase: W2(lt) * 2, rot: -0.15 });
  drawMantis(ctx, 330, -95, 120, { rise: 0.55 + sw(lt, 1, 0, 0.08), arms: 0.08, head: sw(lt, 1, 1, 0.35), sway: Math.sin(W2(lt) * 3) * 0.6, t: lt * 0 + W2(lt) });
  drawMoss(ctx, lt, true);
}
// ---------- FX ----------
function drawRays(ctx, lt, inten, o = {}) {
  // ctx: screen-space quarter-res canvas
  const W = R.small.width, H = R.small.height;
  const ox = o.ox == null ? -0.15 * W : o.ox, oy = o.oy == null ? -0.35 * H : o.oy, ang = o.ang == null ? 1.05 : o.ang;
  const col = R.style === 'cuphead' ? '255,250,225' : R.style === 'storybook' ? '255,245,215' : '255,214,140';
  const rays = [[0.0, 0.07, 1], [0.12, 0.04, 0.7], [0.2, 0.09, 0.9], [0.33, 0.05, 0.6], [0.42, 0.08, 0.8], [-0.12, 0.05, 0.6]];
  const L = Math.hypot(W, H) * 1.5;
  ctx.globalCompositeOperation = 'lighter';
  rays.forEach(([da, w, a], i) => {
    const aa = ang + da * 0.9 + sw(lt, 1, i * 1.3, 0.02) + (o.sweep || 0);
    const f = a * inten * (0.7 + 0.3 * Math.sin(W2(lt) * (1 + (i % 3)) + i));
    const nx = -Math.sin(aa), ny = Math.cos(aa);
    const ww = w * W;
    const p0 = [ox, oy], p1 = [ox + Math.cos(aa) * L, oy + Math.sin(aa) * L];
    const g = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
    g.addColorStop(0, `rgba(${col},${0.0})`); g.addColorStop(0.18, `rgba(${col},${0.32 * f})`); g.addColorStop(0.55, `rgba(${col},${0.12 * f})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p0[0] + nx * ww * 0.15, p0[1] + ny * ww * 0.15); ctx.lineTo(p1[0] + nx * ww, p1[1] + ny * ww); ctx.lineTo(p1[0] - nx * ww, p1[1] - ny * ww); ctx.lineTo(p0[0] - nx * ww * 0.15, p0[1] - ny * ww * 0.15); ctx.fill();
  });
  ctx.globalCompositeOperation = 'source-over';
}
function drawMotes(ctx, lt, a) {
  const st = R.style;
  ctx.globalCompositeOperation = st === 'storybook' ? 'source-over' : 'lighter';
  for (const m of WORLD.motes) {
    const ph = W2(lt) * m[5] + m[3];
    const x = m[0] + Math.cos(ph) * m[4], y = m[1] + Math.sin(ph * 1) * m[4] * 0.6 - Math.sin(ph) * 10;
    const tw = 0.5 + 0.5 * Math.sin(ph * 3 + m[3] * 5);
    const rr = m[2] * ctx.__k * 2.2;
    ctx.globalAlpha = a * (0.35 + 0.65 * tw);
    ctx.fillStyle = st === 'storybook' ? '#fff8e0' : st === 'cuphead' ? '#fffbea' : '#ffe9b0';
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    if (st === 'hd2d') { ctx.globalAlpha *= 0.25; ctx.beginPath(); ctx.arc(x, y, rr * 3, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawFireflies(ctx, lt, a) {
  for (const f of WORLD.flies) {
    const ph = W2(lt) + f[2];
    const x = f[0] + Math.cos(ph) * f[3] + Math.sin(ph * 2) * 20, y = f[1] + Math.sin(ph) * f[3] * 0.5;
    const tw = Math.max(0, Math.sin(ph * 3 + f[2] * 4));
    glow(ctx, x, y, 26 * ctx.__k * 3, 'rgba(255,220,120,.9)', a * tw * 0.8);
    ctx.globalAlpha = a * tw; ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(x, y, 3.2 * ctx.__k * 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
}
function drawMist(ctx, lt, a) {
  if (a <= 0) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const c = R.style === 'hd2d' ? '170,210,190' : R.style === 'cuphead' ? '240,232,200' : '250,246,236';
  for (let i = 0; i < 7; i++) {
    const y = H * (0.2 + i * 0.12), x = W * 0.5 + Math.sin(lt * 0.4 + i * 2) * W * 0.25;
    const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.6);
    g.addColorStop(0, `rgba(${c},${0.35 * a})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.28); ctx.translate(-x, -y); ctx.fillRect(x - W * 0.6, y - W * 0.6, W * 1.2, W * 1.2); ctx.restore();
  }
}
