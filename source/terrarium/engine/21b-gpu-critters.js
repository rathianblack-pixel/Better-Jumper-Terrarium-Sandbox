/* Jumper Terrarium — GPU critter painter (v33).
   Critters, prey, drops and leaf bits used to be painted every frame by the 2D canvas on the CPU and then copied into the
   GPU sprite sheet. GCtx is a drop-in stand-in for the small part of the CanvasRenderingContext2D API the art code uses
   (paths, ellipses, arcs, curves, gradients, rect / ellipse clips, alpha). It records every fill and stroke as one
   analytically anti-aliased shape (ellipse, ring, line segment or triangle) and the GPU paints them all, in order, with a
   single instanced draw straight into the sprite sheet: no CPU rasterising and no per-frame texture upload.
   Anything it can't reproduce exactly (text, images, patterns, blend modes, odd clips) makes that one sprite fall back to
   the classic 2D path for that frame, so nothing ever goes missing. WebGL2 only; Settings can switch it off. */
(function (root) {
  'use strict';
  const JT = root.JT;
  const TAU = Math.PI * 2;
  const cl = (x) => (x > 0 ? (x < 1 ? x : 1) : 0);

  // ---------------- colours (parsed once, cached) ----------------
  const CC = new Map(); let parseCv = null;
  function hsl2rgb(h, s, l) { h = (((h % 360) + 360) % 360) / 360; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; }
  function parse0(s0, deep) {
    const s = s0.trim().toLowerCase();
    if (s[0] === '#') { const h = s.slice(1); if (!/^[0-9a-f]+$/.test(h)) return null;
      if (h.length === 3 || h.length === 4) { const c = []; for (const x of h) c.push(parseInt(x + x, 16) / 255); return [c[0], c[1], c[2], h.length === 4 ? c[3] : 1]; }
      if (h.length === 6 || h.length === 8) { const c = []; for (let i = 0; i < h.length; i += 2) c.push(parseInt(h.slice(i, i + 2), 16) / 255); return [c[0], c[1], c[2], h.length === 8 ? c[3] : 1]; }
      return null; }
    const m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
    if (m) { const pa = m[2].split(/[\s,/]+/).filter(Boolean); if (pa.length < 3) return null;
      const al = pa.length > 3 ? (pa[3].endsWith('%') ? parseFloat(pa[3]) / 100 : parseFloat(pa[3])) : 1; if (!isFinite(al)) return null;
      if (m[1][0] === 'r') { const v = (x) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x) / 255); const r = v(pa[0]), g = v(pa[1]), b = v(pa[2]); if (!isFinite(r + g + b)) return null; return [cl(r), cl(g), cl(b), cl(al)]; }
      const h = parseFloat(pa[0]), sa = parseFloat(pa[1]) / 100, l = parseFloat(pa[2]) / 100; if (!isFinite(h + sa + l)) return null; const c = hsl2rgb(h, cl(sa), cl(l)); return [c[0], c[1], c[2], cl(al)]; }
    if (s === 'transparent') return [0, 0, 0, 0];
    if (deep) return null;
    try { // named colours etc.: the browser normalises them once
      if (!parseCv) parseCv = root.document.createElement('canvas').getContext('2d');
      parseCv.fillStyle = '#010203'; parseCv.fillStyle = s0; const r = parseCv.fillStyle; if (r === '#010203' && s !== '#010203') return null; return parse0(r, true);
    } catch (e) { return null; }
  }
  function parseColor(s) { let v = CC.get(s); if (v === undefined) { v = parse0(String(s), false); if (CC.size > 6000) CC.clear(); CC.set(s, v); } return v; }

  class Grad {
    constructor(t, g) { this.t = t; this.g = g; this.st = []; this._k = null; }
    addColorStop(o, c) { o = +o; if (!(o >= 0 && o <= 1)) throw new RangeError('offset'); const v = parseColor(c); if (!v) throw new SyntaxError('colour'); let i = this.st.length; while (i > 0 && this.st[i - 1][0] > o) i--; this.st.splice(i, 0, [o, v, String(c)]); this._k = null; }
    key() { if (this._k) return this._k; let k = ''; for (const s of this.st) k += s[0] + '~' + s[2] + '|'; return (this._k = k); }
  }

  // ---------------- polygon triangulation (ear clipping; outer-edge flags for anti-aliasing) ----------------
  const cross3 = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  /** pts: flat [x,y,...] (closed polygon). Calls out(i, j, k, flags) with bit e set when edge e (ij, jk, ki) is a polygon edge. */
  function triangulate(pts, out) {
    const n = pts.length >> 1; if (n < 3) return;
    let area = 0; for (let i = 0, j = n - 1; i < n; j = i++) area += pts[j * 2] * pts[i * 2 + 1] - pts[i * 2] * pts[j * 2 + 1]; if (Math.abs(area) < 1e-6) return;
    const sg = area > 0 ? 1 : -1; const adj = (a, b) => { const d = (b - a + n) % n; return d === 1 || d === n - 1; };
    // convex? fan
    let convex = true; for (let i = 0; i < n && convex; i++) { const a = (i + n - 1) % n, b = (i + 1) % n; if (sg * cross3(pts[a * 2], pts[a * 2 + 1], pts[i * 2], pts[i * 2 + 1], pts[b * 2], pts[b * 2 + 1]) < -1e-9) convex = false; }
    if (convex) { for (let i = 1; i < n - 1; i++) out(0, i, i + 1, (i === 1 ? 1 : 0) | 2 | (i + 1 === n - 1 ? 4 : 0)); return; }
    const V = []; for (let i = 0; i < n; i++) V.push(i);
    let guard = n * n + 8, i = 0;
    while (V.length > 3 && guard-- > 0) {
      const m = V.length, ia = V[(i + m - 1) % m], ib = V[i % m], ic = V[(i + 1) % m];
      const ax = pts[ia * 2], ay = pts[ia * 2 + 1], bx = pts[ib * 2], by = pts[ib * 2 + 1], cx = pts[ic * 2], cy = pts[ic * 2 + 1];
      let ear = sg * cross3(ax, ay, bx, by, cx, cy) > 1e-9;
      if (ear) for (let q = 0; q < m; q++) { const v = V[q]; if (v === ia || v === ib || v === ic) continue; const px = pts[v * 2], py = pts[v * 2 + 1];
        if (sg * cross3(ax, ay, bx, by, px, py) >= 0 && sg * cross3(bx, by, cx, cy, px, py) >= 0 && sg * cross3(cx, cy, ax, ay, px, py) >= 0) { ear = false; break; } }
      if (ear) { out(ia, ib, ic, (adj(ia, ib) ? 1 : 0) | (adj(ib, ic) ? 2 : 0) | (adj(ic, ia) ? 4 : 0)); V.splice(i % m, 1); i = Math.max(0, (i % m) - 1); }
      else i = (i + 1) % m;
    }
    if (V.length >= 3) for (let q = 1; q < V.length - 1; q++) out(V[0], V[q], V[q + 1], (adj(V[0], V[q]) ? 1 : 0) | (adj(V[q], V[q + 1]) ? 2 : 0) | (adj(V[q + 1], V[0]) ? 4 : 0)); // self-intersecting leftovers: fan
  }

  // ---------------- shaders ----------------
  const VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 iA; layout(location=1) in vec4 iB; layout(location=2) in vec4 iC; layout(location=3) in vec4 iCol; layout(location=4) in vec4 iD; layout(location=5) in float aV;
uniform vec2 uSize;
flat out vec4 vA; flat out vec4 vB; flat out vec4 vC; flat out vec4 vCol; flat out vec4 vD;
void main() {
  int k = int(aV + 0.5); vec2 c = vec2(k == 1 || k == 2 || k == 4 ? 1.0 : -1.0, k == 2 || k == 4 || k == 5 ? 1.0 : -1.0);
  float pad = iD.x + max(iD.y, 1.0) + 1.0; vec2 pos;
  if (iA.x < 1.5) { vec2 ax = iB.zw; vec2 pp = vec2(-ax.y, ax.x); pos = iB.xy + ax * (iD.z + pad) * c.x + pp * (iD.w + pad) * c.y; }
  else if (iA.x < 2.5) { vec2 a = iB.xy, b = iB.zw; vec2 d = b - a; float l = length(d); vec2 u = l > 1e-5 ? d / l : vec2(1.0, 0.0); vec2 n = vec2(-u.y, u.x); pos = (a + b) * 0.5 + u * (l * 0.5 + pad) * c.x + n * pad * c.y; }
  else { vec2 lo = min(min(iB.xy, iB.zw), iC.xy) - 1.5, hi = max(max(iB.xy, iB.zw), iC.xy) + 1.5; pos = mix(lo, hi, c * 0.5 + 0.5); }
  gl_Position = vec4(pos / uSize * 2.0 - 1.0, 0.0, 1.0);
  vA = iA; vB = iB; vC = iC; vCol = iCol; vD = iD;
}`;
  const FS = `#version 300 es
precision highp float; precision highp int;
flat in vec4 vA; flat in vec4 vB; flat in vec4 vC; flat in vec4 vCol; flat in vec4 vD;
uniform highp sampler2D uTab; uniform sampler2D uRamp;
out vec4 o;
vec4 tab(int i) { return texelFetch(uTab, ivec2(i % 1024, i / 1024), 0); }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-10), 0.0, 1.0); return length(pa - ba * h); }
float ellD(vec2 q, vec2 r) { float k0 = length(q / r); float k1 = length(q / (r * r)); return k1 > 1e-7 ? k0 * (k0 - 1.0) / k1 : -min(r.x, r.y); }
float cr(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
void main() {
  vec2 p = gl_FragCoord.xy; int t = int(vA.x + 0.5); int fl = int(vA.y + 0.5); float hw = vD.x, sf = max(vD.y, 1.0); float cov = 1.0;
  if (t <= 1) {
    vec2 ax = vB.zw; vec2 d = p - vB.xy; vec2 q = vec2(dot(d, ax), dot(d, vec2(-ax.y, ax.x))); float e = ellD(q, vD.zw);
    cov = t == 0 ? clamp(0.5 - e / sf, 0.0, 1.0) : clamp(hw + 0.5 - abs(e), 0.0, 1.0);
  } else if (t == 2) {
    vec2 a = vB.xy, b = vB.zw; float di = sdSeg(p, a, b);
    if ((fl & 1) != 0 && sdSeg(p, vC.xy, a) < di) discard;
    if ((fl & 2) != 0 && sdSeg(p, b, vC.zw) <= di) discard;
    cov = clamp((hw - di) / sf + 0.5, 0.0, 1.0);
    vec2 ba = b - a; float l = length(ba);
    if ((fl & 12) != 0) { if (l < 1e-5) discard; vec2 u = ba / l; float s = dot(p - a, u);
      if ((fl & 4) != 0) cov *= clamp(s + 0.5, 0.0, 1.0);
      if ((fl & 8) != 0) cov *= clamp(l - s + 0.5, 0.0, 1.0); }
  } else {
    vec2 P0 = vB.xy, P1 = vB.zw, P2 = vC.xy; float ori = cr(P1 - P0, P2 - P0) >= 0.0 ? 1.0 : -1.0;
    for (int i = 0; i < 3; i++) {
      vec2 A = i == 0 ? P0 : i == 1 ? P1 : P2; vec2 B = i == 0 ? P1 : i == 1 ? P2 : P0;
      if ((fl & (1 << i)) != 0) { vec2 e = B - A; float l = length(e); if (l < 1e-6) continue; cov = min(cov, clamp(ori * cr(e, p - A) / l + 0.5, 0.0, 1.0)); }
      else { float s = ori; if (A.x > B.x || (A.x == B.x && A.y > B.y)) { vec2 T = A; A = B; B = T; s = -s; } float e = cr(B - A, p - A); if (!(s * e > 0.0 || (e == 0.0 && s > 0.0))) discard; }
    }
  }
  if (vA.w >= 0.0) { int ci = int(vA.w + 0.5); vec4 r = tab(ci); if (p.x < r.x || p.y < r.y || p.x > r.z || p.y > r.w) discard;
    vec4 e1 = tab(ci + 1); if (e1.z > 0.5) { vec4 m = tab(ci + 2); vec2 d = p - e1.xy; vec2 q = vec2(dot(d, m.xy), dot(d, vec2(-m.y, m.x))); cov *= clamp(0.5 - ellD(q, m.zw), 0.0, 1.0); } }
  if (cov <= 0.0) discard;
  vec4 base = vec4(1.0);
  if (vA.z >= 0.0) { int gi = int(vA.z + 0.5); vec4 g0 = tab(gi), g1 = tab(gi + 1); float tt = 0.0;
    if (g0.x < 0.5) { vec2 d = g1.xy - g0.yz; tt = dot(p - g0.yz, d) / max(dot(d, d), 1e-10); }
    else { vec2 c0 = g0.yz; float r0 = g0.w; vec2 cd = g1.xy - c0; float dr = g1.z - r0; vec2 pd = p - c0;
      float A = dot(cd, cd) - dr * dr, B = dot(pd, cd) + r0 * dr, C = dot(pd, pd) - r0 * r0;
      if (abs(A) < 1e-5) { if (abs(B) < 1e-8) discard; tt = C / (2.0 * B); if (r0 + tt * dr < 0.0) discard; }
      else { float D = B * B - A * C; if (D < 0.0) discard; float sq = sqrt(D); float t1 = (B + sq) / A, t2 = (B - sq) / A; float tm = max(t1, t2), tn = min(t1, t2);
        if (r0 + tm * dr >= 0.0) tt = tm; else if (r0 + tn * dr >= 0.0) tt = tn; else discard; } }
    base = texture(uRamp, vec2((clamp(tt, 0.0, 1.0) * 255.0 + 0.5) / 256.0, (g1.w + 0.5) / 256.0)); }
  o = base * vCol * cov;
}`;

  const NF = 20; // floats per shape
  const TABW = 1024, RAMPW = 256, RAMPH = 256;

  // ---------------- the painter: shape list + GPU resources ----------------
  class GPUCrit {
    constructor(gl) {
      this.gl = gl; this.ok = false; this.inst = new Float32Array(NF * 4096); this.n = 0; this.tab = new Float32Array(4 * TABW * 16); this.nt = 0;
      this.runs = []; this.mode = 0; this.clears = []; this.frame = 0; this.ramps = new Map(); this.rampFree = []; for (let i = RAMPH - 1; i >= 0; i--) this.rampFree.push(i); this.rampDirty = [];
      this.ctx = new GCtx(this); this.stats = { shapes: 0, cpu: 0, gpu: 0 };
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('gpuCrit shader: ' + gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('gpuCrit link: ' + gl.getProgramInfoLog(p));
      this.prog = p; this.uSize = gl.getUniformLocation(p, 'uSize'); this.uTab = gl.getUniformLocation(p, 'uTab'); this.uRamp = gl.getUniformLocation(p, 'uRamp');
      this.ib = gl.createBuffer(); this.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 2, 3, 4, 5]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 4, 0); gl.vertexAttribDivisor(5, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ib); for (let i = 0; i < 5; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribDivisor(i, 1); }
      gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
            this.ttex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.ttex); this.tabH = 16; gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TABW, this.tabH, 0, gl.RGBA, gl.FLOAT, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      this.rtex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.rtex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, RAMPW, RAMPH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.fb = gl.createFramebuffer(); this.fbOK = new WeakMap(); this.rampRow = new Uint8Array(RAMPW * 4);
      this.ok = true;
    }
    // --- shape stream ---
    push(t, fl, gi, ci, a0, a1, a2, a3, b0, b1, b2, b3, c, hw, sf, r1, r2) {
      if ((this.n + 1) * NF > this.inst.length) { const o = new Float32Array(this.inst.length * 2); o.set(this.inst); this.inst = o; }
      const f = this.inst, i = this.n++ * NF;
      f[i] = t; f[i + 1] = fl; f[i + 2] = gi; f[i + 3] = ci; f[i + 4] = a0; f[i + 5] = a1; f[i + 6] = a2; f[i + 7] = a3; f[i + 8] = b0; f[i + 9] = b1; f[i + 10] = b2; f[i + 11] = b3;
      f[i + 12] = c[0]; f[i + 13] = c[1]; f[i + 14] = c[2]; f[i + 15] = c[3]; f[i + 16] = hw; f[i + 17] = sf; f[i + 18] = r1; f[i + 19] = r2;
    }
    setMode(m) { if (m === this.mode) return; this.mode = m; this.runs.push([this.n, m]); }
    /** Reserve k texels in the parameter table; returns the first index. */
    tabAlloc(k) { if ((this.nt + k) * 4 > this.tab.length) { const o = new Float32Array(this.tab.length * 2); o.set(this.tab); this.tab = o; } const i = this.nt; this.nt += k; return i; }
    ramp(g) {
      const key = g.key(); let r = this.ramps.get(key);
      if (r) { r.f = this.frame; return r.row; }
      let row; if (this.rampFree.length) row = this.rampFree.pop();
      else { let old = null; for (const [k, v] of this.ramps) if (v.f < this.frame && (!old || v.f < old[1].f)) old = [k, v]; if (!old) return -1; this.ramps.delete(old[0]); row = old[1].row; }
      this.ramps.set(key, { row, f: this.frame });
      const st = g.st, px = new Uint8Array(RAMPW * 4);
      for (let x = 0; x < RAMPW; x++) { const t = x / (RAMPW - 1); let c;
        if (t <= st[0][0]) c = st[0][1]; else if (t >= st[st.length - 1][0]) c = st[st.length - 1][1];
        else { let j = 1; while (j < st.length - 1 && st[j][0] < t) j++; const A = st[j - 1], B = st[j]; const u = B[0] > A[0] ? (t - A[0]) / (B[0] - A[0]) : 1;
          const pa = A[1], pb = B[1]; const aa = pa[3] + (pb[3] - pa[3]) * u; // premultiplied interpolation, as the canvas does
          c = [0, 0, 0, aa]; for (let q = 0; q < 3; q++) c[q] = (pa[q] * pa[3] + (pb[q] * pb[3] - pa[q] * pa[3]) * u); px[x * 4] = Math.round(cl(c[0]) * 255); px[x * 4 + 1] = Math.round(cl(c[1]) * 255); px[x * 4 + 2] = Math.round(cl(c[2]) * 255); px[x * 4 + 3] = Math.round(cl(aa) * 255); continue; }
        px[x * 4] = Math.round(c[0] * c[3] * 255); px[x * 4 + 1] = Math.round(c[1] * c[3] * 255); px[x * 4 + 2] = Math.round(c[2] * c[3] * 255); px[x * 4 + 3] = Math.round(c[3] * 255); }
      this.rampDirty.push([row, px]); return row;
    }
    // --- per sprite ---
    beginFrame() { this.frame++; this.n = 0; this.nt = 0; this.runs.length = 0; this.mode = 0; this.runs.push([0, 0]); this.clears.length = 0; this.stats.shapes = 0; this.stats.cpu = 0; this.stats.gpu = 0; }
    begin(x, y, w, h) { this._s = [this.n, this.runs.length, this.mode, this.nt]; this.clears.push(x, y, w, h); this.ctx._begin(x, y, x + w, y + h); return this.ctx; }
    end(ok) {
      const c = this.ctx; if (this.mode !== 0) this.setMode(0);
      if (ok && !c.bad) { this.stats.gpu++; return true; }
      const s = this._s; this.n = s[0]; this.runs.length = s[1]; this.mode = s[2]; this.nt = s[3]; this.stats.cpu++; return false;
    }
    /** Paint everything recorded this frame into texture tex (w x h). back = { fb, w, h, prog }: what to rebind afterwards.
        No gl.getParameter here: on Chrome a state query can stall the CPU until the GPU catches up (a hitch). The renderer
        binds its own textures, clear colour, blend and depth state before each use, so only these need putting back. */
    flush(tex, w, h, back) {
      const gl = this.gl; if (!this.clears.length && !this.n) return; this.stats.shapes = this.n;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ck = w + 'x' + h; if (this.fbOK.get(tex) !== ck) { if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this.broken = true; this.fbOK.set(tex, ck); }
      gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.enable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0);
      const C = this.clears; for (let i = 0; i < C.length; i += 4) { gl.scissor(C[i], C[i + 1], C[i + 2], C[i + 3]); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.disable(gl.SCISSOR_TEST);
      if (this.n) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.ttex);
        const rows = Math.max(1, Math.ceil(this.nt / TABW));
        if (rows > this.tabH) { this.tabH = Math.max(rows, this.tabH * 2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TABW, this.tabH, 0, gl.RGBA, gl.FLOAT, null); }
        if (this.nt) { if (rows * TABW * 4 > this.tab.length) this.tabAlloc(rows * TABW - this.nt); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TABW, rows, gl.RGBA, gl.FLOAT, this.tab, 0); }
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.rtex);
        for (const [row, px] of this.rampDirty) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, row, RAMPW, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); this.rampDirty.length = 0;
        gl.useProgram(this.prog); gl.uniform2f(this.uSize, w, h); gl.uniform1i(this.uTab, 2); gl.uniform1i(this.uRamp, 3);
        gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
        const bytes = this.n * NF * 4; if (bytes > (this.ibCap || 0)) { this.ibCap = Math.max(bytes, (this.ibCap || 0) * 2, 65536); gl.bufferData(gl.ARRAY_BUFFER, this.ibCap, gl.DYNAMIC_DRAW); }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.inst, 0, this.n * NF);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const R = this.runs; for (let r = 0; r < R.length; r++) { const a = R[r][0], b = r + 1 < R.length ? R[r + 1][0] : this.n; if (b <= a) continue;
          gl.blendEquation(R[r][1] === 1 ? gl.MAX : gl.FUNC_ADD);
          for (let i = 0; i < 5; i++) gl.vertexAttribPointer(i, 4, gl.FLOAT, false, NF * 4, (a * NF + i * 4) * 4);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, b - a); }
        gl.blendEquation(gl.FUNC_ADD); gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); // the sheet's own uploads (classic fallback) are premultiplied
        gl.useProgram(back.prog || null);
      } else this.rampDirty.length = 0;
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, back.fb || null); gl.viewport(0, 0, back.w, back.h); gl.activeTexture(gl.TEXTURE0);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  // ---------------- the 2D-context stand-in ----------------
  const NOOP_TM = { width: 0 };
  class GCtx {
    constructor(P) { this.P = P; this.canvas = { width: 1, height: 1 }; this._init(); }
    _init() { this.T = [1, 0, 0, 1, 0, 0]; this._ga = 1; this._fs = '#000000'; this._ss = '#000000'; this._lw = 1; this._lc = 'butt'; this._lj = 'miter'; this._gco = 'source-over'; this._clip = null; this.stack = []; this.path = []; this.sub = null; this.bad = false;
      this.miterLimit = 10; this.imageSmoothingEnabled = true; this.imageSmoothingQuality = 'low'; this._shBlur = 0; this._shCol = 'rgba(0, 0, 0, 0)'; this._shX = 0; this._shY = 0; this._filter = 'none'; this._dash = 0; this.lineDashOffset = 0; this.font = '10px sans-serif'; this.textAlign = 'start'; this.textBaseline = 'alphabetic'; this.direction = 'inherit'; }
    _begin(x0, y0, x1, y1) { this._init(); this._clip = { x0, y0, x1, y1, e: null, idx: -1, f: -1 }; this.canvas.width = this.P.aw || 1; this.canvas.height = this.P.ah || 1; }
    // ---- state ----
    get globalAlpha() { return this._ga; } set globalAlpha(v) { v = +v; if (v >= 0 && v <= 1) this._ga = v; }
    get fillStyle() { return this._fs; } set fillStyle(v) { if (typeof v === 'string' || v instanceof Grad) this._fs = v; else if (v != null) { if (typeof v === 'object') { this._fs = v; } else this._fs = String(v); } }
    get strokeStyle() { return this._ss; } set strokeStyle(v) { if (typeof v === 'string' || v instanceof Grad) this._ss = v; else if (v != null) { if (typeof v === 'object') { this._ss = v; } else this._ss = String(v); } }
    get lineWidth() { return this._lw; } set lineWidth(v) { v = +v; if (v > 0 && isFinite(v)) this._lw = v; }
    get lineCap() { return this._lc; } set lineCap(v) { if (v === 'butt' || v === 'round' || v === 'square') this._lc = v; }
    get lineJoin() { return this._lj; } set lineJoin(v) { if (v === 'miter' || v === 'round' || v === 'bevel') this._lj = v; }
    get globalCompositeOperation() { return this._gco; } set globalCompositeOperation(v) { this._gco = String(v); }
    get filter() { return this._filter; } set filter(v) { this._filter = String(v); }
    get shadowBlur() { return this._shBlur; } set shadowBlur(v) { v = +v; if (v >= 0) this._shBlur = v; }
    get shadowColor() { return this._shCol; } set shadowColor(v) { this._shCol = String(v); }
    get shadowOffsetX() { return this._shX; } set shadowOffsetX(v) { if (isFinite(+v)) this._shX = +v; }
    get shadowOffsetY() { return this._shY; } set shadowOffsetY(v) { if (isFinite(+v)) this._shY = +v; }
    save() { this.stack.push([this.T.slice(), this._ga, this._fs, this._ss, this._lw, this._lc, this._lj, this._gco, this._clip, this._shBlur, this._shCol, this._shX, this._shY, this._filter, this._dash, this.imageSmoothingEnabled]); }
    restore() { const s = this.stack.pop(); if (!s) return; [this.T, this._ga, this._fs, this._ss, this._lw, this._lc, this._lj, this._gco, this._clip, this._shBlur, this._shCol, this._shX, this._shY, this._filter, this._dash, this.imageSmoothingEnabled] = s; }
    // ---- transform ----
    setTransform(a, b, c, d, e, f) { if (a && typeof a === 'object') { const m = a; a = m.a; b = m.b; c = m.c; d = m.d; e = m.e; f = m.f; } if (![a, b, c, d, e, f].every(isFinite)) return; this.T = [+a, +b, +c, +d, +e, +f]; }
    resetTransform() { this.T = [1, 0, 0, 1, 0, 0]; }
    getTransform() { const T = this.T; return { a: T[0], b: T[1], c: T[2], d: T[3], e: T[4], f: T[5], is2D: true, isIdentity: T[0] === 1 && T[1] === 0 && T[2] === 0 && T[3] === 1 && T[4] === 0 && T[5] === 0 }; }
    transform(a, b, c, d, e, f) { const T = this.T; this.T = [T[0] * a + T[2] * b, T[1] * a + T[3] * b, T[0] * c + T[2] * d, T[1] * c + T[3] * d, T[0] * e + T[2] * f + T[4], T[1] * e + T[3] * f + T[5]]; }
    translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
    scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.transform(c, s, -s, c, 0, 0); }
    // ---- path ----
    beginPath() { this.path = []; this.sub = null; }
    _new(x, y) { const s = { p: [x, y], closed: false, e: null, rect: false }; this.path.push(s); this.sub = s; return s; }
    _pt(x, y) { const T = this.T; return [T[0] * x + T[2] * y + T[4], T[1] * x + T[3] * y + T[5]]; }
    _mat(s) { if (s.e) { const e = s.e; s.e = null; s.p = []; this._flatEll(s.p, e.cx, e.cy, e.v1x, e.v1y, e.v2x, e.v2y, e.a0, e.sw, e.end); } }
    moveTo(x, y) { if (!isFinite(x) || !isFinite(y)) return; const q = this._pt(+x, +y); this._new(q[0], q[1]); }
    lineTo(x, y) { if (!isFinite(x) || !isFinite(y)) return; const q = this._pt(+x, +y); const s = this.sub; if (!s) { this._new(q[0], q[1]); return; } this._mat(s); s.rect = false; s.p.push(q[0], q[1]); }
    closePath() { const s = this.sub; if (!s) return; this._mat(s); s.closed = true; this._new(s.p[0], s.p[1]); }
    quadraticCurveTo(cx, cy, x, y) { if (![cx, cy, x, y].every(isFinite)) return; let s = this.sub; const c = this._pt(+cx, +cy), e = this._pt(+x, +y); if (!s) s = this._new(c[0], c[1]); this._mat(s); s.rect = false;
      const p = s.p, x0 = p[p.length - 2], y0 = p[p.length - 1]; const L = Math.hypot(c[0] - x0, c[1] - y0) + Math.hypot(e[0] - c[0], e[1] - c[1]); const n = Math.max(2, Math.min(40, Math.ceil(Math.sqrt(L) * 1.6)));
      for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; p.push(u * u * x0 + 2 * u * t * c[0] + t * t * e[0], u * u * y0 + 2 * u * t * c[1] + t * t * e[1]); } }
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { if (![c1x, c1y, c2x, c2y, x, y].every(isFinite)) return; let s = this.sub; const a = this._pt(+c1x, +c1y), b = this._pt(+c2x, +c2y), e = this._pt(+x, +y); if (!s) s = this._new(a[0], a[1]); this._mat(s); s.rect = false;
      const p = s.p, x0 = p[p.length - 2], y0 = p[p.length - 1]; const L = Math.hypot(a[0] - x0, a[1] - y0) + Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(e[0] - b[0], e[1] - b[1]); const n = Math.max(2, Math.min(48, Math.ceil(Math.sqrt(L) * 1.8)));
      for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; p.push(u * u * u * x0 + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * e[0], u * u * u * y0 + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * e[1]); } }
    arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
    arcTo() { this.bad = true; }
    rect(x, y, w, h) { if (![x, y, w, h].every(isFinite)) return; const a = this._pt(+x, +y), b = this._pt(+x + +w, +y), c = this._pt(+x + +w, +y + +h), d = this._pt(+x, +y + +h);
      const s = this._new(a[0], a[1]); s.p.push(b[0], b[1], c[0], c[1], d[0], d[1]); s.closed = true; s.rect = this.T[1] === 0 && this.T[2] === 0; this._new(a[0], a[1]); }
    roundRect() { this.bad = true; }
    ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
      if (![x, y, rx, ry, rot, a0, a1].every(isFinite)) return; if (rx < 0 || ry < 0) throw new RangeError('radius');
      let sw; if (!ccw) { sw = a1 - a0; if (sw >= TAU) sw = TAU; else { sw = sw % TAU; if (sw < 0) sw += TAU; } } else { sw = a0 - a1; if (sw >= TAU) sw = TAU; else { sw = sw % TAU; if (sw < 0) sw += TAU; } sw = -sw; }
      const T = this.T, cr = Math.cos(rot), sr = Math.sin(rot);
      const ux = rx * cr, uy = rx * sr, vx = -ry * sr, vy = ry * cr; // ellipse basis in user space
      const cx = T[0] * x + T[2] * y + T[4], cy = T[1] * x + T[3] * y + T[5];
      const v1x = T[0] * ux + T[2] * uy, v1y = T[1] * ux + T[3] * uy, v2x = T[0] * vx + T[2] * vy, v2y = T[1] * vx + T[3] * vy;
      const sx = cx + v1x * Math.cos(a0) + v2x * Math.sin(a0), sy = cy + v1y * Math.cos(a0) + v2y * Math.sin(a0);
      let s = this.sub; const full = Math.abs(sw) >= 6.28;
      const fresh = !s || (s.p.length === 2 && !s.e && Math.abs(s.p[0] - sx) < 0.05 && Math.abs(s.p[1] - sy) < 0.05);
      if (full && fresh) { if (s) { s.p = []; } else s = this._new(sx, sy); s.p = []; s.rect = false; s.e = { cx, cy, v1x, v1y, v2x, v2y, a0, sw, end: true }; return; }
      if (!s) s = this._new(sx, sy); else { this._mat(s); s.p.push(sx, sy); } s.rect = false;
      this._flatEll(s.p, cx, cy, v1x, v1y, v2x, v2y, a0, sw, false);
    }
    _flatEll(p, cx, cy, v1x, v1y, v2x, v2y, a0, sw, first) {
      const R = Math.max(Math.hypot(v1x, v1y), Math.hypot(v2x, v2y)); const n = Math.max(4, Math.min(160, Math.ceil(Math.abs(sw) / Math.acos(Math.max(-1, 1 - 0.2 / Math.max(R, 0.3))))));
      for (let i = first ? 0 : 1; i <= n; i++) { const a = a0 + sw * i / n, c = Math.cos(a), s = Math.sin(a); p.push(cx + v1x * c + v2x * s, cy + v1y * c + v2y * s); }
    }
    // ---- unsupported -> classic path for this sprite ----
    drawImage() { this.bad = true; } fillText() { this.bad = true; } strokeText() { this.bad = true; } measureText() { this.bad = true; return NOOP_TM; }
    createPattern() { this.bad = true; return null; } createConicGradient() { this.bad = true; return new Grad(0, [0, 0, 1, 0]); } getImageData() { this.bad = true; return null; } putImageData() { this.bad = true; } createImageData() { this.bad = true; return null; }
    clearRect() { this.bad = true; } isPointInPath() { this.bad = true; return false; } isPointInStroke() { this.bad = true; return false; }
    setLineDash(a) { this._dash = a && a.length ? 1 : 0; } getLineDash() { return []; }
    createLinearGradient(x0, y0, x1, y1) { return new Grad(0, [+x0, +y0, +x1, +y1]); }
    createRadialGradient(x0, y0, r0, x1, y1, r1) { if (r0 < 0 || r1 < 0) throw new RangeError('radius'); return new Grad(1, [+x0, +y0, +r0, +x1, +y1, +r1]); }
    // ---- painting ----
    _ok() { if (this._gco !== 'source-over' || (this._filter !== 'none' && this._filter !== '') || this._dash) { this.bad = true; return false; }
      if ((this._shBlur > 0 || this._shX || this._shY) && (parseColor(this._shCol) || [0, 0, 0, 0])[3] > 0) { this.bad = true; return false; } return true; }
    _clipIdx() { const c = this._clip; if (!c) return -1; if (c.f === this.P.frame && c.idx >= 0) return c.idx; const P = this.P, i = P.tabAlloc(3), t = P.tab, o = i * 4;
      t[o] = c.x0; t[o + 1] = c.y0; t[o + 2] = c.x1; t[o + 3] = c.y1; if (c.e) { const e = c.e; t[o + 4] = e.cx; t[o + 5] = e.cy; t[o + 6] = 1; t[o + 7] = 0; t[o + 8] = e.ux; t[o + 9] = e.uy; t[o + 10] = e.r1; t[o + 11] = e.r2; } else { t[o + 6] = 0; }
      c.idx = i; c.f = P.frame; return i; }
    /** style -> [premultiplied colour, gradient table index] or null (nothing to paint). */
    _style(st, am) {
      const ga = this._ga * am; if (ga <= 0) return null;
      if (typeof st === 'string') { const c = parseColor(st); if (!c) { this.bad = true; return null; } const a = c[3] * ga; if (a <= 0) return null; return [[c[0] * a, c[1] * a, c[2] * a, a], -1]; }
      if (!(st instanceof Grad)) { this.bad = true; return null; }
      if (!st.st.length) return null; const T = this.T, g = st.g; const P = this.P;
      const row = P.ramp(st); if (row < 0) { this.bad = true; return null; }
      const i = P.tabAlloc(2), t = P.tab, o = i * 4;
      if (st.t === 0) { t[o] = 0; t[o + 1] = T[0] * g[0] + T[2] * g[1] + T[4]; t[o + 2] = T[1] * g[0] + T[3] * g[1] + T[5]; t[o + 3] = 0; t[o + 4] = T[0] * g[2] + T[2] * g[3] + T[4]; t[o + 5] = T[1] * g[2] + T[3] * g[3] + T[5]; t[o + 6] = 0; t[o + 7] = row; }
      else { const det = T[0] * T[3] - T[1] * T[2]; const sc = Math.sqrt(Math.abs(det)); if (Math.abs(Math.abs(T[0]) - Math.abs(T[3])) > 1e-4 * (sc + 1) || Math.abs(Math.abs(T[1]) - Math.abs(T[2])) > 1e-4 * (sc + 1)) { this.bad = true; return null; }
        t[o] = 1; t[o + 1] = T[0] * g[0] + T[2] * g[1] + T[4]; t[o + 2] = T[1] * g[0] + T[3] * g[1] + T[5]; t[o + 3] = g[2] * sc; t[o + 4] = T[0] * g[3] + T[2] * g[4] + T[4]; t[o + 5] = T[1] * g[3] + T[3] * g[4] + T[5]; t[o + 6] = g[5] * sc; t[o + 7] = row; }
      return [[ga, ga, ga, ga], i];
    }
    _ellPrim(e, type, col, gi, ci, hw, sf, mul) { // e: {cx, cy, v1x, v1y, v2x, v2y} -> principal axes (2x2 SVD)
      const a = e.v1x, b = e.v2x, c = e.v1y, d = e.v2y; const E = (a + d) / 2, F = (a - d) / 2, G = (c + b) / 2, H = (c - b) / 2;
      const Q = Math.hypot(E, H), R = Math.hypot(F, G); let r1 = Q + R, r2 = Math.abs(Q - R); const th = (Math.atan2(G, F) + Math.atan2(H, E)) / 2;
      let ux = Math.cos(th), uy = Math.sin(th); let m = mul;
      if (type === 0) { if (r1 < 0.5) { m *= r1 / 0.5; r1 = 0.5; } if (r2 < 0.5) { m *= Math.max(r2, 0.02) / 0.5; r2 = 0.5; } }
      else { r1 = Math.max(r1, 0.01); r2 = Math.max(r2, 0.01); }
      const C = m === 1 ? col : [col[0] * m, col[1] * m, col[2] * m, col[3] * m];
      this.P.push(type, 0, gi, ci, e.cx, e.cy, ux, uy, 0, 0, 0, 0, C, hw, sf, r1, r2);
      return { cx: e.cx, cy: e.cy, ux, uy, r1, r2 };
    }
    fill(a) {
      if (a !== undefined && typeof a !== 'string') { this.bad = true; return; } if (a === 'evenodd') { this.bad = true; return; }
      if (this.bad || !this._ok()) return; const sty = this._style(this._fs, 1); if (!sty) return; const ci = this._clipIdx();
      for (const s of this.path) this._fillSub(s, sty[0], sty[1], ci, 1);
    }
    _fillSub(s, col, gi, ci, sf) {
      if (s.e) { this._ellPrim(s.e, 0, col, gi, ci, 0, sf, 1); return; }
      let p = s.p; if (p.length < 6) return; p = dedupe(p, true); if (p.length < 6) return; const P = this.P;
      triangulate(p, (i, j, k, fl) => P.push(3, fl, gi, ci, p[i * 2], p[i * 2 + 1], p[j * 2], p[j * 2 + 1], p[k * 2], p[k * 2 + 1], 0, 0, col, 0, sf, 0, 0));
    }
    fillRect(x, y, w, h) { const sp = this.path, ss = this.sub; this.path = []; this.sub = null; this.rect(x, y, w, h); this.fill(); this.path = sp; this.sub = ss; }
    strokeRect(x, y, w, h) { const sp = this.path, ss = this.sub; this.path = []; this.sub = null; this.rect(x, y, w, h); this.stroke(); this.path = sp; this.sub = ss; }
    stroke(a) {
      if (a !== undefined) { this.bad = true; return; } if (this.bad || !this._ok()) return;
      const T = this.T; let hw = this._lw * 0.5 * Math.sqrt(Math.abs(T[0] * T[3] - T[1] * T[2])); let mul = 1; if (hw < 0.5) { mul = Math.max(hw, 0.01) * 2; hw = 0.5; }
      const sty = this._style(this._ss, mul); if (!sty) return; const ci = this._clipIdx();
      for (const s of this.path) this._strokeSub(s, sty[0], sty[1], ci, hw, 1, this._lc);
    }
    _strokeSub(s, col, gi, ci, hw, sf, cap) {
      if (s.e) { if (Math.abs(s.e.sw) >= 6.28) { this._ellPrim(s.e, 1, col, gi, ci, hw, 1, 1); return; } this._mat(s); }
      const P = this.P; let p = s.p; const closed = s.closed; if (p.length < 4) return;
      const raw = p; p = dedupe(p, closed); let n = p.length >> 1;
      if (n < 2) { if (cap === 'round' && raw.length >= 4 && !closed) P.push(2, 0, gi, ci, raw[0], raw[1], raw[0], raw[1], 0, 0, 0, 0, col, hw, sf, 0, 0); return; }
      if (closed && n < 3) { /* degenerate loop: a there-and-back line */ }
      const nseg = closed ? n : n - 1; let sx = p[0], sy = p[1], ex = p[(n - 1) * 2], ey = p[(n - 1) * 2 + 1];
      if (!closed && cap === 'square') { let dx = p[2] - p[0], dy = p[3] - p[1], l = Math.hypot(dx, dy) || 1; sx -= dx / l * hw; sy -= dy / l * hw; dx = p[(n - 1) * 2] - p[(n - 2) * 2]; dy = p[(n - 1) * 2 + 1] - p[(n - 2) * 2 + 1]; l = Math.hypot(dx, dy) || 1; ex += dx / l * hw; ey += dy / l * hw; }
      const butt = !closed && cap !== 'round';
      for (let i = 0; i < nseg; i++) {
        const ia = i, ib = (i + 1) % n; let ax = p[ia * 2], ay = p[ia * 2 + 1], bx = p[ib * 2], by = p[ib * 2 + 1];
        if (!closed) { if (i === 0) { ax = sx; ay = sy; } if (i === nseg - 1) { bx = ex; by = ey; } }
        let fl = 0, px = 0, py = 0, nx = 0, ny = 0;
        if (closed || i > 0) { const ip = (ia + n - 1) % n; px = p[ip * 2]; py = p[ip * 2 + 1]; if (!closed && i === 1) { px = sx; py = sy; } fl |= 1; }
        if (closed || i < nseg - 1) { const inx = (ib + 1) % n; nx = p[inx * 2]; ny = p[inx * 2 + 1]; if (!closed && i === nseg - 2) { nx = ex; ny = ey; } fl |= 2; }
        if (butt && i === 0) fl |= 4; if (butt && i === nseg - 1) fl |= 8;
        P.push(2, fl, gi, ci, ax, ay, bx, by, px, py, nx, ny, col, hw, sf, 0, 0);
      }
    }
    clip(a) {
      if (a !== undefined && typeof a !== 'string') { this.bad = true; return; }
      const subs = this.path.filter(s => s.e || s.p.length >= 6); const c0 = this._clip;
      if (subs.length !== 1) { if (!subs.length) { this._clip = { x0: 0, y0: 0, x1: 0, y1: 0, e: null, idx: -1, f: -1 }; return; } this.bad = true; return; }
      const s = subs[0];
      if (s.rect) { const p = s.p; let x0 = Math.min(p[0], p[4]), x1 = Math.max(p[0], p[4]), y0 = Math.min(p[1], p[5]), y1 = Math.max(p[1], p[5]);
        if (Math.abs(x0 - Math.round(x0)) > 1e-3 || Math.abs(y0 - Math.round(y0)) > 1e-3 || Math.abs(x1 - Math.round(x1)) > 1e-3 || Math.abs(y1 - Math.round(y1)) > 1e-3) { if (!c0 || x0 > c0.x0 || y0 > c0.y0 || x1 < c0.x1 || y1 < c0.y1) { this.bad = true; return; } }
        this._clip = { x0: Math.max(x0, c0 ? c0.x0 : -1e9), y0: Math.max(y0, c0 ? c0.y0 : -1e9), x1: Math.min(x1, c0 ? c0.x1 : 1e9), y1: Math.min(y1, c0 ? c0.y1 : 1e9), e: c0 ? c0.e : null, idx: -1, f: -1 }; return; }
      if (s.e && Math.abs(s.e.sw) >= 6.28 && !(c0 && c0.e)) { const e = s.e; const a1 = e.v1x, b = e.v2x, c = e.v1y, d = e.v2y; const E = (a1 + d) / 2, F = (a1 - d) / 2, G = (c + b) / 2, H = (c - b) / 2;
        const Q = Math.hypot(E, H), R = Math.hypot(F, G); const th = (Math.atan2(G, F) + Math.atan2(H, E)) / 2; const r1 = Math.max(0.05, Q + R), r2 = Math.max(0.05, Math.abs(Q - R));
        this._clip = { x0: c0 ? c0.x0 : -1e9, y0: c0 ? c0.y0 : -1e9, x1: c0 ? c0.x1 : 1e9, y1: c0 ? c0.y1 : 1e9, e: { cx: e.cx, cy: e.cy, ux: Math.cos(th), uy: Math.sin(th), r1, r2 }, idx: -1, f: -1 }; return; }
      this.bad = true;
    }
    /** v33 hook for the critter shadows (19-volumetric): the union of ellipses + strokes at one opacity, soft edge sf px. */
    gpuShadow(ells, strokes, grow, col, al, sf) {
      if (this.bad || !this._ok()) return; const c = parseColor(col); if (!c) { this.bad = true; return; } const a = al * c[3]; if (a <= 0.003) return;
      const C = [c[0] * a, c[1] * a, c[2] * a, a]; const ci = this._clipIdx(); const T = this.T, P = this.P; P.setMode(1);
      for (const e of ells) { const r1 = Math.max(0.3, e[2] * grow), r2 = Math.max(0.3, e[3] * grow + (grow - 1) * e[2] * 0.25); const ca = Math.cos(e[4]), sa = Math.sin(e[4]);
        const ux = r1 * ca, uy = r1 * sa, vx = -r2 * sa, vy = r2 * ca;
        this._ellPrim({ cx: T[0] * e[0] + T[2] * e[1] + T[4], cy: T[1] * e[0] + T[3] * e[1] + T[5], v1x: T[0] * ux + T[2] * uy, v1y: T[1] * ux + T[3] * uy, v2x: T[0] * vx + T[2] * vy, v2y: T[1] * vx + T[3] * vy }, 0, C, -1, ci, 0, sf, 1); }
      const sc = Math.sqrt(Math.abs(T[0] * T[3] - T[1] * T[2]));
      for (const [pts, w] of strokes) { if (!pts || pts.length < 1) continue; const lw = Math.max(0.5, w * (1 + (grow - 1) * 2)) * sc; const p = []; for (const q of pts) { p.push(T[0] * q[0] + T[2] * q[1] + T[4], T[1] * q[0] + T[3] * q[1] + T[5]); }
        if (p.length === 2) p.push(p[0], p[1]); this._strokeSub({ p, closed: false, e: null }, C, -1, ci, lw / 2, sf, 'round'); }
      P.setMode(0);
    }
  }
  function dedupe(p, closed) { const o = [p[0], p[1]]; for (let i = 2; i < p.length; i += 2) { const x = p[i], y = p[i + 1]; if (Math.abs(x - o[o.length - 2]) > 1e-3 || Math.abs(y - o[o.length - 1]) > 1e-3) o.push(x, y); }
    if (closed && o.length >= 4 && Math.abs(o[0] - o[o.length - 2]) < 1e-3 && Math.abs(o[1] - o[o.length - 1]) < 1e-3) o.length -= 2; return o; }

  JT.GPUCrit = GPUCrit; JT.GCtx = GCtx; JT.GPUCritGrad = Grad;
})(typeof window !== 'undefined' ? window : globalThis);


