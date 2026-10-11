// Terrarium intro renderer — core (utils, palettes, layers, primitives, post)
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const ei = t => clamp(t) ** 3;
function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
const P2 = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
const LOOP = 10; // loop seconds
const W2 = t => TAU * t / LOOP; // loop phase

const PAL = {
  hd2d: { bg0: '#040c08', bg1: '#0c2419', bg2: '#1b4a32', light: '#ffd98a', hot: '#fff3cf', leafD: '#1d4a2a', leafM: '#3d873d', leafL: '#9ad35e', stem: '#2c5a2a', soil: '#3a291c', soilD: '#1f150d', soilL: '#5b4330', moss: '#3f8030', mossL: '#86c24c', rock: '#6d6a60', rockD: '#3f3d37', wood: '#553824', woodL: '#8a6142', sp: '#111113', spL: '#2c2b31', spW: '#f2eee2', spO: '#ec7a2c', cheli: '#2fc2a6', man: '#5db441', manD: '#2b6a24', manL: '#c0ea7e', flA: '#f6c6de', flB: '#ff9c3e', water: '#86d6ea', glass: '#d8f5e8', ink: '#0a0806', dark: '#030806', plinth: '#2a1a10', plinthL: '#6b4628' },
  cuphead: { bg0: '#9e9a62', bg1: '#cdc38c', bg2: '#e9dcab', light: '#fff1cc', hot: '#fffbea', leafD: '#3a6a28', leafM: '#5e9a38', leafL: '#a9cc5c', stem: '#3d6828', soil: '#6b4a2c', soilD: '#3e2a18', soilL: '#8a6a44', moss: '#5f9634', mossL: '#9cc65a', rock: '#a39a86', rockD: '#6e6656', wood: '#7a5232', woodL: '#a8774c', sp: '#1f160e', spL: '#463424', spW: '#fff3d6', spO: '#e2582a', cheli: '#3a9a84', man: '#7cbc4a', manD: '#3f7a2a', manL: '#cfe98e', flA: '#f2a8c2', flB: '#f08a2a', water: '#8fd2e2', glass: '#fbf6e2', ink: '#1b120a', dark: '#1d160d', plinth: '#6b4426', plinthL: '#a8743f', red: '#d23a2a', cream: '#f6e6c2' },
  storybook: { bg0: '#e3d7bc', bg1: '#ede4cf', bg2: '#f6f0e1', light: '#fff2cc', hot: '#fffaf0', leafD: '#5a7a4a', leafM: '#84a268', leafL: '#bfcd90', stem: '#66804a', soil: '#8f6e4e', soilD: '#6a4f36', soilL: '#b39572', moss: '#8aa85e', mossL: '#c3d18c', rock: '#a9a293', rockD: '#7f796a', wood: '#8a6a4a', woodL: '#b38f6a', sp: '#3a2f2a', spL: '#5d4c42', spW: '#fcf7ec', spO: '#dc8a48', cheli: '#6aaa98', man: '#9cbc6a', manD: '#66884a', manL: '#dae4a8', flA: '#e9b2c4', flB: '#e9a25c', water: '#a6d4dd', glass: '#ffffff', ink: '#4a3524', dark: '#cfc1a2', plinth: '#9a7550', plinthL: '#c9a77c' }
};

const R = {};
R.mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

R.init = function (W, H, style, orient) {
  R.W = W; R.H = H; R.style = style; R.orient = orient; R.P = PAL[style];
  R.px = Math.min(W, H) / 1080;
  R.portrait = orient === 'portrait';
  R.main = R.mk(W, H); R.m = R.main.getContext('2d');
  R.tmp = R.mk(W, H); R.tm = R.tmp.getContext('2d');
  R.mask = R.mk(W, H); R.mm = R.mask.getContext('2d');
  R.out = document.getElementById('out'); R.out.width = W; R.out.height = H; R.o = R.out.getContext('2d');
  R.pool = {}; R.layers = [];
  R.spf = style === 'hd2d' ? 4 * R.px : 1; // sprite pixel factor
  R.small = R.mk(W / 4, H / 4); R.sm = R.small.getContext('2d');
  R.small8 = R.mk(W / 8, H / 8); R.s8 = R.small8.getContext('2d');
  R.cam = { x: 0, y: 0, z: 1, r: 0 }; R.U = 1;
  // noise tiles
  R.noise = [];
  const nr = rng(99);
  for (let n = 0; n < 6; n++) {
    const c = R.mk(W / 2, H / 2), x = c.getContext('2d'), id = x.createImageData(c.width, c.height);
    for (let i = 0; i < id.data.length; i += 4) { const v = (nr() * 255) | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0); R.noise.push(c);
  }
  if (style === 'storybook') R.paper = makePaper(W, H);
};

function makePaper(W, H) {
  const c = R.mk(W, H), x = c.getContext('2d'), r = rng(5);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  // blotchy tone
  for (let i = 0; i < 90; i++) {
    const px = r() * W, py = r() * H, rad = (60 + r() * 260) * R.px;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const a = 0.03 + r() * 0.05; g.addColorStop(0, `rgba(170,140,95,${a})`); g.addColorStop(1, 'rgba(170,140,95,0)');
    x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  // fibres
  x.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const px = r() * W, py = r() * H, a = r() * TAU, l = (4 + r() * 18) * R.px;
    x.strokeStyle = `rgba(120,95,60,${0.04 + r() * 0.07})`; x.lineWidth = (0.6 + r()) * R.px;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * .5 + r() * 3, py + Math.sin(a) * l * .5 + r() * 3, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  return c;
}

R.fit = function (rw, rh, mode) { R.U = mode === 'cover' ? Math.max(R.W / rw, R.H / rh) : Math.min(R.W / rw, R.H / rh); };
R.begin = function () { R.layers = []; R.li = 0; };
R.setCam = function (ctx, pf, cam) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!cam) { ctx.setTransform(1 / pf, 0, 0, 1 / pf, 0, 0); ctx.__k = 1 / R.px; ctx.__s = 1; return; }
  const s = R.U * cam.z;
  ctx.translate(R.W / 2 / pf, R.H / 2 / pf); if (cam.r) ctx.rotate(cam.r); ctx.scale(s / pf, s / pf); ctx.translate(-cam.x, -cam.y);
  ctx.__k = R.px / s; ctx.__s = s;
};
// get a layer: o = {pf, blur, alpha, comp, cam (or null for screen), smooth}
R.layer = function (o = {}) {
  const pf = o.pf || 1, key = R.li++;
  let c = R.pool[key];
  const w = Math.ceil(R.W / pf), h = Math.ceil(R.H / pf);
  if (!c) c = R.pool[key] = R.mk(w, h);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  R.setCam(x, pf, o.cam === undefined ? R.cam : o.cam);
  R.layers.push({ c, pf, blur: o.blur || 0, alpha: o.alpha == null ? 1 : o.alpha, comp: o.comp || 'source-over', smooth: o.smooth, filter: o.filter });
  return x;
};
R.compose = function (dst) {
  const m = dst || R.m;
  for (const L of R.layers) {
    if (L.alpha <= 0) continue;
    m.save(); m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalAlpha = L.alpha; m.globalCompositeOperation = L.comp;
    m.imageSmoothingEnabled = !(L.pf > 1 && R.style === 'hd2d' && !L.smooth);
    const f = [];
    if (L.blur > 0.3) f.push(`blur(${(L.blur * R.px).toFixed(2)}px)`);
    if (L.filter) f.push(L.filter);
    m.filter = f.length ? f.join(' ') : 'none';
    m.drawImage(L.c, 0, 0, L.c.width, L.c.height, 0, 0, L.c.width * L.pf, L.c.height * L.pf);
    m.restore();
  }
};

// ---------- primitives ----------
function tracePath(ctx, pts, closed, smooth) {
  const n = pts.length; ctx.beginPath();
  if (n < 3 || smooth === false) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); if (closed) ctx.closePath(); return; }
  if (closed) {
    ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) { const p = pts[i], q = pts[i + 1]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}
function jit(pts, seed, amt) { return pts.map((p, i) => [p[0] + vnoise(i * 0.61 + seed) * amt, p[1] + vnoise(i * 0.61 + seed + 57.3) * amt]); }

// filled shape, style aware. o: {line, lw, alpha, open, smooth, seed, edge, noJit, inkA}
function shape(ctx, pts, fill, o = {}) {
  const st = R.style, k = ctx.__k || 1;
  const closed = !o.open;
  let fp = pts;
  if (st === 'storybook' && !o.noJit) fp = jit(pts, (o.seed || 0) + 3.1, k * 2.4);
  tracePath(ctx, fp, closed, o.smooth);
  const a = o.alpha == null ? 1 : o.alpha;
  if (fill) { ctx.globalAlpha = a * (st === 'storybook' ? 0.9 : 1); ctx.fillStyle = fill; ctx.fill(); }
  if (st === 'cuphead' && o.line !== false) {
    ctx.globalAlpha = a; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = R.P.ink; ctx.lineWidth = (o.lw || 3.6) * k; ctx.stroke();
  } else if (st === 'storybook' && o.line !== false) {
    if (fill) { ctx.save(); ctx.clip(); ctx.globalAlpha = a * 0.3; ctx.strokeStyle = o.edge || '#5a3a20'; ctx.lineWidth = 8 * k; ctx.stroke(); ctx.restore(); }
    tracePath(ctx, jit(pts, (o.seed || 0) + 9.7, k * 2.2), closed, o.smooth);
    ctx.globalAlpha = a * (o.inkA || 0.6); ctx.strokeStyle = R.P.ink; ctx.lineWidth = (o.lw || 1.7) * k; ctx.lineJoin = 'round'; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// stroked polyline (stems, legs). o: {line, cap}
function stroke(ctx, pts, color, w, o = {}) {
  const st = R.style, k = ctx.__k || 1;
  ctx.lineCap = o.cap || 'round'; ctx.lineJoin = 'round';
  const smooth = o.smooth !== false;
  if (st === 'cuphead' && o.line !== false) { tracePath(ctx, pts, false, smooth); ctx.strokeStyle = R.P.ink; ctx.lineWidth = w + 6.5 * k; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.stroke(); }
  const fp = st === 'storybook' && !o.noJit ? jit(pts, o.seed || 1, k * 1.5) : pts;
  tracePath(ctx, fp, false, smooth); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * (st === 'storybook' ? 0.9 : 1); ctx.stroke();
  if (st === 'storybook' && o.line !== false) { tracePath(ctx, jit(pts, (o.seed || 1) + 4, k * 1.8), false, smooth); ctx.strokeStyle = R.P.ink; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.min(w * 0.35, 1.6 * k); ctx.stroke(); }
  if (o.hi && st !== 'cuphead') { tracePath(ctx, pts.map(p => [p[0] - w * 0.18, p[1] - w * 0.18]), false, smooth); ctx.strokeStyle = o.hi; ctx.globalAlpha = 0.5; ctx.lineWidth = w * 0.3; ctx.stroke(); }
  if (o.hi && st === 'cuphead') { tracePath(ctx, pts.map(p => [p[0] - w * 0.15, p[1] - w * 0.15]), false, smooth); ctx.strokeStyle = o.hi; ctx.globalAlpha = 0.7; ctx.lineWidth = w * 0.22; ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function ellipsePts(cx, cy, rx, ry, n = 18, rot = 0, wob = 0, seed = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, w = 1 + wob * vnoise(i * 1.3 + seed); const x = Math.cos(a) * rx * w, y = Math.sin(a) * ry * w; pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
  return pts;
}
// leaf polygon along a bent spine. returns {pts, spine}
function leafPts(x, y, ang, len, wid, bend = 0, n = 12, shapeK = 0.8, heart = 0) {
  const L = [], Rr = [], spine = [];
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const lx = u * len, ly = bend * Math.sin(u * Math.PI * 0.9) * len * 0.5 + bend * u * u * len * 0.25;
    let w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, u * (1 + heart * 0.25))), shapeK) * (1 - 0.25 * u);
    if (heart && u < 0.25) w = wid * (0.55 + u * 1.5);
    const tx = ca, ty = sa; // approx normal
    const sx = x + lx * ca - ly * sa, sy = y + lx * sa + ly * ca;
    spine.push([sx, sy]);
    L.push([sx - ty * w * 0.5, sy + tx * w * 0.5]); Rr.push([sx + ty * w * 0.5, sy - tx * w * 0.5]);
  }
  if (heart) { L[0] = [x - sa * wid * 0.15 - ca * len * 0.06, y + ca * wid * 0.15 - sa * len * 0.06]; Rr[0] = [x + sa * wid * 0.15 - ca * len * 0.06, y - ca * wid * 0.15 - sa * len * 0.06]; }
  return { pts: L.concat(Rr.reverse()), spine };
}
function drawLeaf(ctx, x, y, ang, len, wid, bend, cA, cB, o = {}) {
  const lf = leafPts(x, y, ang, len, wid, bend, o.n || 12, o.k || 0.8, o.heart || 0);
  const tip = lf.spine[lf.spine.length - 1];
  let fill = cA;
  if (cB) { const g = ctx.createLinearGradient(x, y, tip[0], tip[1]); g.addColorStop(0, cA); g.addColorStop(1, cB); fill = g; }
  shape(ctx, lf.pts, fill, { seed: o.seed || x * 0.01, lw: o.lw, alpha: o.alpha, line: o.line });
  if (o.vein !== false && len * ctx.__s > 30) {
    ctx.globalAlpha = R.style === 'cuphead' ? 0.6 : 0.35; ctx.strokeStyle = o.veinC || (R.style === 'cuphead' ? R.P.ink : 'rgba(255,255,220,.8)');
    ctx.lineWidth = (R.style === 'cuphead' ? 2.2 : 1.4) * ctx.__k; tracePath(ctx, lf.spine.slice(0, -2), false, true); ctx.stroke(); ctx.globalAlpha = 1;
  }
  return lf;
}
function glow(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function mix(h1, h2, t) { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const r = Math.round(lerp(a >> 16, b >> 16, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t)); return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1); }
