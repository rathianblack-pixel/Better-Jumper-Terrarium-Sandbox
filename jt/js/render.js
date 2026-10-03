/* Jumper Terrarium — renderer: camera rigs, backgrounds, substrate, depth-sorted scene, effects,
   post-processing, picking, placement ghost, thumbnails and portraits. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, G = JT.G, D = JT.Draw, sh = JT.shade;
  const CAMS = {
    iso: { yaw: 0.52, pitch: 0.66, label: 'Isometric' },
    observer: { yaw: 0.0, pitch: 0.36, label: 'Observer' },
    follow: { yaw: 0.45, pitch: 0.5, label: 'Follow' },
    reverse: { yaw: Math.PI + 0.35, pitch: 0.6, label: 'Reverse' },
  };
  JT.CAMS = CAMS;
  let filterOK = null;
  function supportsFilter() {
    if (filterOK !== null) return filterOK;
    try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; filterOK = c.filter === 'blur(2px)'; } catch (e) { filterOK = false; }
    return filterOK;
  }
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }

  class Renderer {
    constructor(canvas, game, settings) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.game = game; this.set = settings;
      this.cam = { mode: 'iso', zoom: 1, pan: [0, 0] };
      this.cur = null; // smoothed {yaw,pitch,scale,c}
      this.fx = []; this.particles = []; this.ghost = null; this.hover = null;
      this.bgCache = {}; this.thumbs = {}; this.portraits = {};
      this.fps = 60; this._autoLow = false; this.time = 0;
      this.V = new JT.View(0.5, 0.6, 1, 0, 0, [0, 0, 0]);
      this.resize();
    }
    get qualityScale() {
      const q = this.set.quality === 'auto' ? (this._autoLow ? 'low' : 'medium') : this.set.quality;
      const dpr = root.devicePixelRatio || 1;
      return q === 'low' ? Math.min(1, dpr) * 0.75 : q === 'high' ? Math.min(2, dpr) : Math.min(1.25, dpr);
    }
    get quality() { return this.set.quality === 'auto' ? (this._autoLow ? 'low' : 'medium') : this.set.quality; }
    resize() {
      const r = this.cv.getBoundingClientRect(); const k = this.qualityScale;
      this.cssW = Math.max(50, r.width || root.innerWidth || 800); this.cssH = Math.max(50, r.height || root.innerHeight || 600);
      const w = Math.round(this.cssW * k), h = Math.round(this.cssH * k);
      if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; this.bgCache = {}; }
      this.k = k;
    }
    setMode(m) { if (!CAMS[m]) return; this.cam.mode = m; this.cam.zoom = 1; this.cam.pan = [0, 0]; }
    zoomBy(f, sx, sy) {
      if (this.cam.mode === 'follow' && this.fcam && this.fcam.st) { this.fcam.zoom(f); return; }
      const z0 = this.cam.zoom; const z = M.clamp(z0 * f, 0.6, 5); if (z === z0) return;
      if (sx != null) { const cx = this.cssW / 2 + this.cam.pan[0], cy = this.cssH / 2 + this.cam.pan[1]; const k = z / z0; this.cam.pan[0] += (sx - cx) * (1 - k); this.cam.pan[1] += (sy - cy) * (1 - k); }
      this.cam.zoom = z; this.clampPan();
    }
    panBy(dx, dy) {
      if (this.cam.mode === 'follow' && this.fcam && this.fcam.st) { this.fcam.orbit(dx * 0.0065, dy * 0.004); return; }
      this.cam.pan[0] += dx; this.cam.pan[1] += dy; this.clampPan(); }
    clampPan() { const lim = (0.35 + this.cam.zoom * 0.45); this.cam.pan[0] = M.clamp(this.cam.pan[0], -this.cssW * lim, this.cssW * lim); this.cam.pan[1] = M.clamp(this.cam.pan[1], -this.cssH * lim, this.cssH * lim); }
    resetView() { this.cam.zoom = 1; this.cam.pan = [0, 0]; }

    // ---------------- camera ----------------
    targetView(hab) {
      const dm = hab.dims; const C = CAMS[this.cam.mode] || CAMS.iso;
      let top = dm.h * 0.55; for (const id in hab.geoms) top = Math.max(top, hab.geoms[id].height + hab.geoms[id].baseY);
      top = Math.min(top, dm.h * 1.1);
      const pts = []; for (const x of [0, dm.w]) for (const z of [0, dm.d]) for (const y of [-12, top]) pts.push([x, y, z]);
      const c = [dm.w / 2, top * 0.38, dm.d / 2];
      const W = this.cssW, H = this.cssH; const portrait = H > W * 1.1;
      // tall screens: swing the camera round so the tank's long side runs up the screen ("tall setup")
      const tall = portrait && dm.w > dm.d * 1.3 && this.cam.mode !== 'follow';
      const yaw = C.yaw + (tall ? (this.cam.mode === 'observer' ? 1.2 : 0.73) : 0), pitch = C.pitch + (tall ? 0.12 : 0);
      const tmp = new JT.View(yaw, pitch, 1, 0, 0, c);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of pts) { const q = tmp.P(p); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      const availH = H * (portrait ? 0.62 : 0.78), availW = W * (portrait ? 0.94 : 0.88);
      let s = Math.min(availW / (x1 - x0), availH / (y1 - y0));
      let center = c, offY = -(y0 + y1) / 2 * s;
      if (this.cam.mode === 'follow') {
        const sp = hab.spider(this.game.selectedId) || hab.spiders[0];
        if (sp) {
          let f = sp.pos.slice(); const t = sp.target && JT.SpiderAI.targetEnt(hab, sp);
          if (t && t.pos && M.finite3(t.pos)) f = M.lerp3(f, t.pos, 0.3);
          center = f; s = Math.min(W, H) / 70; offY = 0;
        }
      }
      return { yaw, pitch, s: s * this.cam.zoom, c: center, offY: offY * this.cam.zoom };
    }
    updateView(hab, dt) {
      const T = this.targetView(hab);
      if (!this.cur || this.cur.hab !== hab.id) this.cur = Object.assign({ hab: hab.id }, T, { c: T.c.slice() });
      const k = Math.min(1, dt * 5), kc = Math.min(1, dt * (this.cam.mode === 'follow' ? 3 : 6));
      const cu = this.cur; let dy = M.wrapAngle(T.yaw - cu.yaw);
      cu.yaw += dy * k; cu.pitch += (T.pitch - cu.pitch) * k; cu.s += (T.s - cu.s) * k; cu.offY += (T.offY - cu.offY) * k;
      cu.c = M.lerp3(cu.c, T.c, kc);
      if (this.cam.mode === 'follow') {
        const sp = hab.spider(this.game.selectedId) || hab.spiders[0];
        const fc = this.fcam || (this.fcam = new JT.FollowCam());
        if (sp) {
          if (!fc.st || fc.id !== sp.id || fc.hab !== hab.id) { fc.reset(cu, sp.id); fc.hab = hab.id; }
          const st = fc.step(hab, sp, dt, Math.min(this.cssW, this.cssH) / (this.cssH > this.cssW * 1.1 ? 54 : 70));
          cu.yaw = st.yaw; cu.pitch = st.pitch; cu.s = st.s; cu.c = st.c.slice(); cu.offY += (0 - cu.offY) * k;
          this.cam.pan[0] *= 1 - k; this.cam.pan[1] *= 1 - k;
        }
      } else if (this.fcam) this.fcam.st = null;
      const kk = this.k;
      this.V.set(cu.yaw, cu.pitch, cu.s * kk, (this.cssW / 2 + this.cam.pan[0]) * kk, (this.cssH / 2 + this.cam.pan[1] + cu.offY + (this.cssH > this.cssW * 1.1 ? this.cssH * 0.045 : this.cssH * 0.02)) * kk, cu.c);
      return this.V;
    }
    /** CSS pixel -> world (x,z) at height y. */
    unproject(sx, sy, y) { return this.V.unproject(sx * this.k, sy * this.k, y); }
    project(p) { const q = this.V.P(p); return [q[0] / this.k, q[1] / this.k]; }

    // ---------------- background ----------------
    background(bgId) {
      const key = bgId + this.cv.width + 'x' + this.cv.height; if (this.bgCache[key]) return this.bgCache[key];
      const B = JT.BACKGROUNDS[bgId] || JT.BACKGROUNDS.mossy; const W = this.cv.width, H = this.cv.height;
      const c = mkCanvas(W, H), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, B.sky[0]); gr.addColorStop(0.55, B.sky[1]); gr.addColorStop(1, B.sky[2]);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // soft foliage/bokeh blobs drawn small and upscaled = natural blur without filters
      const sw = Math.max(40, W >> 3), shh = Math.max(30, H >> 3); const s = mkCanvas(sw, shh), sg = s.getContext('2d');
      const rng = JT.makeRng(JT.hashStr(bgId));
      for (let i = 0; i < 70; i++) {
        const x = rng() * sw, y = rng() * shh * 0.95, r = (0.04 + rng() * 0.16) * sw; sg.globalAlpha = 0.18 + rng() * 0.35;
        sg.fillStyle = rng.pick(B.blobs); sg.beginPath(); sg.ellipse(x, y, r, r * (0.6 + rng() * 0.6), rng() * 3, 0, 6.283); sg.fill();
      }
      sg.globalAlpha = 1;
      for (let i = 0; i < 22; i++) { const x = rng() * sw, y = rng() * shh * 0.7, r = 0.5 + rng() * 1.6; sg.globalAlpha = 0.25 + rng() * 0.4; sg.fillStyle = B.light; sg.beginPath(); sg.arc(x, y, r, 0, 6.283); sg.fill(); }
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      const s2 = mkCanvas(sw * 2, shh * 2); s2.getContext('2d').drawImage(s, 0, 0, sw * 2, shh * 2);
      g.drawImage(s2, 0, 0, W, H);
      // light shafts
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = W * (0.15 + i * 0.22 + rng() * 0.08), w = W * (0.04 + rng() * 0.06);
        const lg = g.createLinearGradient(0, 0, 0, H * 0.9); lg.addColorStop(0, hexA(B.light, 0.16 * B.shafts)); lg.addColorStop(1, hexA(B.light, 0));
        g.fillStyle = lg; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 2.6 - W * 0.12, H * 0.9); g.lineTo(x - W * 0.12, H * 0.9); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      // naturalist shelf: dark wood plane at the bottom
      const sy = H * 0.86; const wg = g.createLinearGradient(0, sy, 0, H); wg.addColorStop(0, '#3a2414'); wg.addColorStop(0.1, '#2a180c'); wg.addColorStop(1, '#140b05');
      g.fillStyle = wg; g.fillRect(0, sy, W, H - sy);
      g.strokeStyle = 'rgba(200,160,90,0.25)'; g.lineWidth = Math.max(1, H * 0.003); g.beginPath(); g.moveTo(0, sy); g.lineTo(W, sy); g.stroke();
      const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      this.bgCache = {}; this.bgCache[key] = c; return c;
    }

    // ---------------- substrate ----------------
    floorPoly(hab) {
      const dm = hab.dims;
      if (dm.shape === 'circle') return G.circlePoly(dm.w / 2, dm.d / 2, dm.w / 2, dm.d / 2, 44);
      return [[0, 0], [dm.w, 0], [dm.w, dm.d], [0, dm.d]];
    }
    drawSlab(ctx, V, hab, night) {
      const S = JT.SUBSTRATES[hab.data.substrate] || JT.SUBSTRATES.coco; const poly = this.floorPoly(hab);
      const layers = [[0, -7, S.mid, S.dark], [-7, -9, '#5a3a22', '#3e2715'], [-9, -15, '#4a2e18', '#24140a']];
      const n = poly.length; const c = G.centroid(poly);
      // contact shadow of the whole display on the shelf
      const p0 = V.P([c[0], -15, c[1] + 4]); const rx = hab.dims.w * 0.62 * V.s, ry = hab.dims.d * 0.62 * V.s * V.sp;
      ctx.save(); ctx.translate(p0[0], p0[1]); ctx.scale(1, Math.max(0.15, ry / rx)); const sg = ctx.createRadialGradient(0, 0, rx * 0.5, 0, 0, rx); sg.addColorStop(0, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.283); ctx.fill(); ctx.restore();
      for (const [ya, yb, ca, cb] of layers) {
        const faces = [];
        for (let i = 0; i < n; i++) {
          const a = poly[i], b = poly[(i + 1) % n]; const nx = b[1] - a[1], nz = -(b[0] - a[0]);
          const out = M.norm([nx, 0, nz]); const facing = M.dot(out, V.toCam);
          if (facing <= 0) continue;
          faces.push({ a, b, f: facing, d: V.depth([(a[0] + b[0]) / 2, ya, (a[1] + b[1]) / 2]) });
        }
        faces.sort((x, y) => y.d - x.d);
        for (const F of faces) {
          const A = V.P([F.a[0], ya, F.a[1]]), B = V.P([F.b[0], ya, F.b[1]]), C2 = V.P([F.b[0], yb, F.b[1]]), D2 = V.P([F.a[0], yb, F.a[1]]);
          const lit = M.clamp(0.55 + 0.45 * (F.f - 0.3), 0.3, 1.1);
          const gg = ctx.createLinearGradient(0, A[1], 0, D2[1]); gg.addColorStop(0, sh(ca, (lit - 0.8) * 0.5)); gg.addColorStop(1, sh(cb, (lit - 0.8) * 0.5));
          ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(C2[0], C2[1]); ctx.lineTo(D2[0], D2[1]); ctx.closePath(); ctx.fill();
          if (ya === 0) { ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = Math.max(0.5, V.s * 0.3); for (let k = 1; k < 4; k++) { const t = k / 4; const y = ya + (yb - ya) * t; const P1 = V.P([F.a[0], y, F.a[1]]), P2 = V.P([F.b[0], y, F.b[1]]); ctx.beginPath(); ctx.moveTo(P1[0], P1[1] + Math.sin(k * 3) * 1.5); ctx.lineTo(P2[0], P2[1]); ctx.stroke(); } }
        }
      }
      // brass/gold trim on the plinth
      ctx.strokeStyle = 'rgba(201,162,92,0.55)'; ctx.lineWidth = Math.max(1, V.s * 0.35);
      ctx.beginPath(); for (let i = 0; i <= n; i++) { const q = V.P([poly[i % n][0], -9, poly[i % n][1]]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); } ctx.stroke();
      // top surface
      ctx.beginPath(); for (let i = 0; i < n; i++) { const q = V.P([poly[i][0], 0, poly[i][1]]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); } ctx.closePath();
      const t0 = V.P([c[0], 0, 0]), t1 = V.P([c[0], 0, hab.dims.d]);
      const tg = ctx.createLinearGradient(t0[0], t0[1], t1[0], t1[1]); tg.addColorStop(0, sh(S.top, -0.12)); tg.addColorStop(1, sh(S.top, 0.06));
      ctx.fillStyle = tg; ctx.fill();
      ctx.save(); ctx.clip();
      const key = hab.data.substrate + hab.data.type;
      if (!this._speck || this._speck.key !== key) { const rng = JT.makeRng(JT.hashStr(key)); const pts = []; const N = Math.round(hab.dims.w * hab.dims.d / 22); for (let i = 0; i < N; i++) pts.push([rng() * hab.dims.w, rng() * hab.dims.d, rng() < 0.5 ? 0 : 1, 0.25 + rng() * 0.6, rng()]); this._speck = { key, pts }; }
      const lo = this.quality === 'low';
      for (let i = 0; i < this._speck.pts.length; i += lo ? 3 : 1) { const s = this._speck.pts[i]; const q = V.P([s[0], 0, s[1]]); const r = s[3] * V.s; ctx.fillStyle = S.speck[s[2]]; ctx.globalAlpha = 0.55 + s[4] * 0.4; ctx.fillRect(q[0] - r, q[1] - r * V.sp, r * 2, r * 2 * V.sp); }
      ctx.globalAlpha = 1;
      // humidity darkening
      const hum = hab.data.humidity || 0.5; if (hum > 0.6) { ctx.fillStyle = 'rgba(20,12,4,' + ((hum - 0.6) * 0.35) + ')'; ctx.fillRect(0, 0, this.cv.width, this.cv.height); }
      ctx.restore();
    }

    // ---------------- main render ----------------
    render(dt) {
      this.time += dt; const game = this.game; const hab = game.hab; if (!hab) return;
      if (dt > 0) { this.fps = this.fps * 0.95 + (1 / Math.max(1e-3, dt)) * 0.05; if (this.set.quality === 'auto') { if (this.fps < 26 && this.time > 4 && !this._autoLow && (this.frameMs || 0) > 14) { this._autoLow = true; this._lowT = 0; this.resize(); }
          // drop back to full sharpness once rendering is clearly cheap again (e.g. the camera came to rest)
          else if (this._autoLow) { this._lowT = (this.frameMs || 99) < 6 ? (this._lowT || 0) + dt : 0; if (this._lowT > 8) { this._autoLow = false; this.resize(); } } } }
      const V = this.updateView(hab, dt);
      const post = this.quality !== 'low' && this.set.hd2d;
      const ctx = this.ctx; // post-processing works in place: no full-screen scene copy
      this._dt = dt; this.beginLayers(V);
      const lamps = hab.lampsOn ? hab.lampsOn() : [];
      // Still camera: the whole static picture (background, substrate, decor, remains, silk + grading) is kept as ONE
      // finished image. Each frame blits it once and repaints only small rectangles around the things that move.
      const skey = this.staticKey(V, hab, post, lamps);
      const still = skey !== null && skey === this._skPrev; this._skPrev = skey; this._composed = false;
      if (still) {
        const night = this._nq; const rects = this.dirtyRects(V, hab);
        if (rects && (!this._st || this._st.key !== skey)) this.buildStatic(V, hab, night, post, lamps, skey);
        if (rects) { this.compose(ctx, V, hab, night, post, lamps, rects, dt); this._composed = true; return; }
      }
      const night = 1 - game.daylight();
      this.drawFrame(ctx, V, hab, night, post, lamps, null);
      this.drawEffects(ctx, V, hab, dt);
      if (post) { this.postProcess(ctx, this.cv, night); if (this._st) this._st.key = null; } // blur buffers now hold this frame
      else this.nightGrade(ctx, night);
      if (lamps.length) this.drawLampGlow(ctx, V, hab, lamps, night);
      if (this.set.debug) this.drawDebug(ctx, V, hab);
    }
    /** Background + substrate + lamp pools + depth-sorted scene. mode: null = everything, 'static', or a clip rect. */
    drawFrame(ctx, V, hab, night, post, lamps, mode) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter && (ctx.filter = 'none');
      ctx.drawImage(this.background(hab.data.bg), 0, 0);
      this.drawBase(ctx, V, hab, night);
      if (lamps.length) this.drawLampPools(ctx, V, hab, lamps, night, mode !== 'static');
      this.drawScene(ctx, V, hab, night, mode);
    }
    /** Identity of everything in the static picture; null when something static is animating (or the user is editing). */
    staticKey(V, hab, post, lamps) {
      if (this.ghost || this.hover || this.set.debug || this.fx.length) return null;
      for (const inst of hab.decor) if (inst._sw) return null;
      const night = 1 - this.game.daylight(); this._nq = Math.round(night * 40) / 40;
      const f = (x) => Math.round(x * 100);
      let k = [V.yaw.toFixed(5), V.pitch.toFixed(5), V.s.toFixed(4), f(V.cx), f(V.cy), f(V.c[0]), f(V.c[1]), f(V.c[2]), this.cv.width, this.cv.height, this._nq,
        hab.data.id, hab._geomVersion, hab.data.bg, hab.data.substrate, Math.round((hab.data.humidity || 0) * 20), this.quality, post, !!this.set.tilt, !!this.set.bloom, !!this.set.grain].join('|');
      for (const L of lamps) k += '|L' + L.inst.id;
      for (const r of hab.data.remains) k += '|r' + r.id + ':' + Math.round((r.clean != null ? r.clean : 1) * 20) + ':' + (r.pos ? f(r.pos[0]) + ',' + f(r.pos[2]) : '');
      for (const d of hab.data.drops) k += '|d' + d.id;
      for (const n of (hab.data.nests || [])) k += '|n' + n.id + ':' + (n.hole ? Math.round(n.hole.open * 10) : '') + ':' + Math.round((n.age || 0) / 30);
      k += '|s' + hab.data.silk.length + (hab.data.silk.length ? ':' + hab.data.silk[hab.data.silk.length - 1].id : '');
      return k;
    }
    buildStatic(V, hab, night, post, lamps, key) {
      const W = this.cv.width, H = this.cv.height;
      const st = this._st && this._st.cv.width === W && this._st.cv.height === H ? this._st : { cv: mkCanvas(W, H) };
      const g = st.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      this.drawFrame(g, V, hab, night, post, lamps, 'static');
      if (post) this.postProcess(g, st.cv, night, false, true); else this.nightGrade(g, night);
      st.key = key; this._st = st;
    }
    /** Rectangles (canvas px) around everything that moves; overlapping ones merged. null = too much motion, draw normally. */
    dirtyRects(V, hab) {
      const W = this.cv.width, H = this.cv.height, k = this.k; const R = [];
      const add = (p, r) => { if (!p || !M.finite3(p)) return; const q = V.P(p); R.push([q[0] - r, q[1] - r, q[0] + r, q[1] + r]); };
      const seg = (a, b, pad) => { if (!M.finite3(a) || !M.finite3(b)) return; const p = V.P(a), q = V.P(b); R.push([Math.min(p[0], q[0]) - pad, Math.min(p[1], q[1]) - pad, Math.max(p[0], q[0]) + pad, Math.max(p[1], q[1]) + pad]); };
      for (const sp of hab.spiders) {
        if (!M.finite3(sp.pos)) continue; const L = JT.SpiderAI.len(sp); const r = L * 1.7 * V.s + 10 * k; add(sp.pos, r);
        if (sp._dangleOff) { const d = sp._dangleOff; add([sp.pos[0] + d.dx, sp.pos[1] - (d.depth || 0), sp.pos[2] + d.dz], r); seg(sp.pos, [sp.pos[0] + d.dx, sp.pos[1] - (d.depth || 0), sp.pos[2] + d.dz], r); }
        if (sp._anchor && (sp._air || (sp.sup && sp.sup.k === 'air'))) seg(sp._anchor, sp.pos, 4 * k);
        if (sp._air || (sp.sup && sp.sup.k === 'air')) add(JT.Nav.supportBelow(hab, sp.pos).pos, L * 0.6 * V.s + 6 * k);
      }
      for (const p of hab.prey) {
        if (p.owner || p.buried || !M.finite3(p.pos)) continue; const def = JT.PREY_BY_ID[p.type]; if (!def) continue; const r = (def.len || 3) * 1.3 * V.s + 8 * k; add(p.pos, r);
        if (p.sup && p.sup.k === 'air') add(JT.Nav.supportBelow(hab, p.pos).pos, def.len * 0.5 * V.s + 6 * k);
      }
      for (const lf of (hab._leaves || [])) add(lf.pos, 4 * V.s + 6 * k);
      // clamp to screen, drop invisible, merge overlaps
      let rs = []; for (const r of R) { const x0 = Math.max(0, Math.floor(r[0])), y0 = Math.max(0, Math.floor(r[1])), x1 = Math.min(W, Math.ceil(r[2])), y1 = Math.min(H, Math.ceil(r[3])); if (x1 > x0 && y1 > y0) rs.push([x0, y0, x1, y1]); }
      let merged = true; while (merged) { merged = false; for (let i = 0; i < rs.length && !merged; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a[0] <= b[2] + 2 && b[0] <= a[2] + 2 && a[1] <= b[3] + 2 && b[1] <= a[3] + 2) { rs[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; rs.splice(j, 1); merged = true; break; } } }
      let area = 0; for (const r of rs) area += (r[2] - r[0]) * (r[3] - r[1]);
      if (rs.length > 16 || area > W * H * 0.5) return null;
      return rs;
    }
    compose(ctx, V, hab, night, post, lamps, rects, dt) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this._st.cv, 0, 0);
      for (const r of rects) {
        ctx.save(); ctx.beginPath(); ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); ctx.clip();
        this.drawFrame(ctx, V, hab, night, post, lamps, r);
        if (post) this.postProcess(ctx, this.cv, night, true, true); else this.nightGrade(ctx, night);
        ctx.restore();
      }
      this.drawEffects(ctx, V, hab, dt);
      if (lamps.length) this.drawLampGlow(ctx, V, hab, lamps, night);
    }
    drawScene(ctx, V, hab, night, mode) {
      const items = []; const stat = mode === 'static', rect = mode && mode !== 'static' ? mode : null;
      const follow = this.cam.mode === 'follow' && !stat; const fsp = follow ? (hab.spider(this.game.selectedId) || hab.spiders[0]) : null; let xray = null; const t = this.time; const geoms = hab.geoms; const sel = this.game.selectedId;
      const decDepth = {};
      // ground-layer decor first (moss, leaf litter, pebbles) + shadows
      const W = this.cv.width, H = this.cv.height, mg = 90 * this.k;
      const vis = (pos) => { const q = V.P(pos); return q[0] > -mg && q[0] < W + mg && q[1] > -mg && q[1] < H + mg; };
      const onScreen = (pos) => { if (stat) return false; const q = V.P(pos); if (rect) return q[0] >= rect[0] && q[0] < rect[2] && q[1] >= rect[1] && q[1] < rect[3]; return q[0] > -mg && q[0] < W + mg && q[1] > -mg && q[1] < H + mg; };
      for (const inst of hab.decor) {
        const g = geoms[inst.id]; if (!g) continue;
        const sway = inst._sw ? [inst._sw.x, 0, inst._sw.z] : null;
        if (g.def.cat === 'ground' && !inst.parent) { decDepth[inst.id] = 1e9; continue; } // drawn in the cached base layer
        const c = g.foot ? G.centroid(g.foot) : [inst.x, inst.z];
        const dep = V.depth([c[0], g.baseY + Math.min(10, g.height * 0.25), c[1]]);
        decDepth[inst.id] = dep;
        items.push({ d: dep, f: () => this.drawDecorCached(ctx, V, g, sway, night, t), inst });
      }
      // wall-mounted pieces sit just in front of (or, seen from behind, just behind) their wall
      for (const it of items) { const inst = it.inst; if (!inst || !inst.wall || decDepth[inst.wall] == null) continue; const wg = geoms[inst.wall]; const facing = wg && wg.out ? wg.out[0] * V.toCam[0] + wg.out[2] * V.toCam[2] >= 0 : true; it.d = decDepth[inst.wall] + (facing ? -0.3 : 0.3); decDepth[inst.id] = it.d; }
      const animalDepth = (e) => { let d = V.depth(e.pos); if (e.sup && e.sup.d && decDepth[e.sup.d] != null && decDepth[e.sup.d] < 1e8) d = Math.min(d, decDepth[e.sup.d] - 0.05); return d; };
      for (const r of hab.data.remains) { if (!M.finite3(r.pos)) continue; const fr = D.frame(hab, r, 0.1); items.push({ d: animalDepth(r) + 0.02, f: () => D.remains(ctx, V, r, fr, {}) }); }
      for (const w of hab.data.drops) { if (!M.finite3(w.pos)) continue; const fr = JT.Nav.supFrame(hab, w.sup); const pos = M.add(w.pos, M.mul(fr.n, (fr.r || 0) + 0.3)); items.push({ d: animalDepth(w) + 0.01, f: () => D.drop(ctx, V, w, pos) }); }
      for (const p of hab.prey) {
        if (p.owner || p.buried || !M.finite3(p.pos) || !onScreen(p.pos)) continue; const def = JT.PREY_BY_ID[p.type]; if (!def) continue;
        items.push({ d: animalDepth(p), f: () => { const fr = D.frame(hab, p, 0.05); D.prey(ctx, V, p, fr, { time: t }); } });
        if (p.sup && p.sup.k === 'air') { const b = JT.Nav.supportBelow(hab, p.pos); items.push({ d: V.depth(b.pos) + 0.03, f: () => blobShadow(ctx, V, b.pos, def.len * 0.4, 0.13 * M.clamp(1 - (p.pos[1] - b.pos[1]) / 80, 0.2, 1)) }); }
      }
      for (const sp of hab.spiders) {
        if (!M.finite3(sp.pos) || !onScreen(sp.pos)) continue;
        const calm = sp.id === sel && ['idle', 'lookout', 'rest', 'watch', 'groom', 'postFeed'].includes(sp.state);
        const lcT = calm && Math.sin(this.time * 0.33 + (sp.seed % 7)) > 0.55 ? 1 : 0; sp._lc = M.lerp(sp._lc || 0, lcT, Math.min(1, (this._dt || 0.016) * 2.5));
        const L = JT.SpiderAI.len(sp); let fr = D.frame(hab, sp, 0.05);
        // curious head tilt when the camera is close and the jumper is sitting still
        const still = !sp._moving && !sp._air && ['idle', 'lookout', 'rest', 'watch', 'look', 'groom'].includes(sp.state);
        sp._tilt = M.lerp(sp._tilt || 0, still && L * V.s > 46 * this.k && sp._lc > 0.3 ? 1 : 0, Math.min(1, (this._dt || 0.016) * 2));
        // brief dangle on a silk line: purely visual offset from the ledge edge, then back up
        let hang = 0, hangA = null;
        if (sp._dangleOff && sp._dangleVis > 0.01) {
          const dOff = sp._dangleOff, kv = sp._dangleVis; const edge = M.clamp(kv * 3, 0, 1), down = M.smooth(M.clamp((kv - 0.3) / 0.7, 0, 1));
          hangA = [sp.pos[0] + dOff.dx, sp.pos[1] + 0.2, sp.pos[2] + dOff.dz];
          const pos = [M.lerp(fr.p[0], hangA[0], edge), M.lerp(fr.p[1], hangA[1], edge) - dOff.depth * down + Math.sin(this.time * 1.7) * 0.15 * down, M.lerp(fr.p[2], hangA[2], edge)];
          const out = M.norm([dOff.dx || 0.01, 0, dOff.dz || 0]); const fD = M.norm(M.lerp3(fr.f, [0, -1, 0], down * 0.85)); const nD = M.norm(M.lerp3(fr.n, out, down));
          const sD = M.norm(M.cross(nD, fD)); fr = { p: pos, f: fD, s: sD, n: M.norm(M.cross(fD, sD)) }; hang = down;
        }
        const ventral = M.dot(fr.n, V.toCam) < -0.08;
        let d = animalDepth(sp); if (ventral && sp.sup && sp.sup.d && decDepth[sp.sup.d] != null) d = decDepth[sp.sup.d] + 0.05;
        const air = !!sp._air || (sp.sup && sp.sup.k === 'air');
        const draw = (alpha, xr) => {
          const hp = sp.hold ? hab.preyById(sp.hold) : null;
          D.spider(ctx, V, sp, fr, { len: L, airborne: air, time: t, alpha, tucked: !!sp.nest && JT.SpiderAI.NEST_STATES.has(sp.state) && (sp.state !== 'emerge' || !(hab.data.nests || []).some(n => n.id === sp.nest && n.hole && n.hole.open > 0.7)), lookCam: sp._lc > 0.02 ? sp._lc : 0, tilt: sp._tilt, hang, noShadow: xr || hang > 0.2, meal: hp ? (mp, fg, sg, n) => this.drawHeld(ctx, V, sp, hp, mp, fg, sg, n, L) : null });
        };
        if (hangA) { const fp = fr.p, fff = fr.f; items.push({ d: d + 0.01, f: () => { const a = V.P(hangA), b = V.P(M.sub(fp, M.mul(fff, L * 0.32))); ctx.strokeStyle = 'rgba(240,240,250,' + (0.45 - night * 0.15).toFixed(2) + ')'; ctx.lineWidth = Math.max(0.5, V.s * 0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }); d = V.depth(fr.p); }
        // live safety dragline paid out behind a jump
        if (air && sp._anchor && M.finite3(sp._anchor)) { const an = sp._anchor, sp2 = fr.p; items.push({ d: V.depth(M.lerp3(an, sp2, 0.5)) - 0.05, f: () => { const a = V.P(an), b = V.P(sp2); ctx.strokeStyle = 'rgba(240,240,250,' + (0.32 - night * 0.1).toFixed(2) + ')'; ctx.lineWidth = Math.max(0.5, V.s * 0.07); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }); }
        items.push({ d, f: () => draw(1) });
        // follow / observe: remember the followed jumper so it can be shown through anything in front of it
        if (follow && sp === fsp) { const q = V.P(fr.p); const r = L * 1.7 * V.s + 10 * this.k; xray = { d, drawTo: (g) => { const keep = ctx; ctx = g; try { draw(1, true); } finally { ctx = keep; } }, box: [Math.floor(q[0] - r), Math.floor(q[1] - r), Math.ceil(q[0] + r), Math.ceil(q[1] + r)] }; }
        else if (ventral && sp.id === sel) items.push({ d: d - 0.2 - 50, f: () => { ctx.globalAlpha = 0.3; D.spider(ctx, V, sp, fr, { len: L, time: t, alpha: 0.3, noShadow: true }); ctx.globalAlpha = 1; } });
        if (air) { const b = JT.Nav.supportBelow(hab, sp.pos); items.push({ d: V.depth(b.pos) + 0.03, f: () => blobShadow(ctx, V, b.pos, L * 0.45, 0.2 * M.clamp(1 - (sp.pos[1] - b.pos[1]) / 60, 0.2, 1)) }); }
      }
      for (const lf of (hab._leaves || [])) { if (!M.finite3(lf.pos) || !onScreen(lf.pos)) continue; items.push({ d: V.depth(lf.pos) - 0.02, f: () => D.leafBit(ctx, V, lf) }); }
      for (const n of (hab.data.nests || [])) { if (!M.finite3(n.pos) || !vis(n.pos)) continue; const up = (JT.Nav.validSup(hab, n.sup) ? JT.Nav.supFrame(hab, n.sup).n : [0, 1, 0]) || [0, 1, 0]; items.push({ d: V.depth(n.pos) - n.len * 0.7, f: () => D.nest(ctx, V, n, up, night) }); }
      for (const k of hab.data.silk) items.push({ d: V.depth(M.lerp3(k.a, k.b, 0.5)) - 0.1, f: () => D.silk(ctx, V, k, night) });
      if (this.ghost && this.ghost.geom) {
        const gh = this.ghost; const g = gh.geom; const c = G.centroid(g.foot || [[gh.x, gh.z]]);
        items.push({ d: V.depth([c[0], g.baseY + 4, c[1]]), f: () => this.drawGhost(ctx, V, gh, night) });
      }
      items.sort((a, b) => b.d - a.d);
      for (const it of items) { try { it.f(); } catch (e) { if (JT.DEV) console.warn(e); } ctx.globalAlpha = 1; }
      if (xray) { const main = ctx; try { ctx = this.xrayPrep(xray, items); if (ctx) { const m = ctx; for (const it of items) if (it.d < xray.d - 1e-6) { try { it.f(); } catch (e) { if (JT.DEV) console.warn(e); } m.globalAlpha = 1; } ctx = main; this.xrayFinish(main, m, xray); } } finally { ctx = main; } }
      // hover/selection highlight for decor in remove mode
      if (this.hover && this.hover.kind === 'decor') { const g = geoms[this.hover.ent.id]; if (g) this.outlineDecor(ctx, V, g, 'rgba(230,90,70,0.9)'); }
    }
    /** X-ray for the followed jumper: a mask of everything in front of it (inside its box only). */
    xrayPrep(xr, items) {
      const W = this.cv.width, H = this.cv.height; const b = xr.box;
      const x0 = Math.max(0, b[0]), y0 = Math.max(0, b[1]), x1 = Math.min(W, b[2]), y1 = Math.min(H, b[3]); if (x1 <= x0 || y1 <= y0) return null;
      if (!items.some(it => it.d < xr.d - 1e-6)) return null;
      if (!this._xr || this._xr.width !== W || this._xr.height !== H) this._xr = mkCanvas(W, H);
      const m = this._xr.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 1; m.globalCompositeOperation = 'source-over'; m.clearRect(x0, y0, x1 - x0, y1 - y0);
      m.save(); m.beginPath(); m.rect(x0, y0, x1 - x0, y1 - y0); m.clip(); xr.r = [x0, y0, x1, y1]; return m;
    }
    /** Keep only the hidden parts of the jumper and lay them over the scene, softly see-through. */
    xrayFinish(main, m, xr) {
      m.restore(); const W = this.cv.width, H = this.cv.height; const [x0, y0, x1, y1] = xr.r; const w = x1 - x0, h = y1 - y0;
      if (!this._xs || this._xs.width !== W || this._xs.height !== H) this._xs = mkCanvas(W, H);
      const g = this._xs.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(x0, y0, w, h);
      g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip(); xr.drawTo(g); g.globalAlpha = 1;
      g.globalCompositeOperation = 'destination-in'; g.drawImage(this._xr, x0, y0, w, h, x0, y0, w, h); g.restore(); // keep only the hidden parts
      main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = 0.6; main.drawImage(this._xs, x0, y0, w, h, x0, y0, w, h); main.restore();
    }
    // ---------------- cached layers (static geometry is drawn once per camera pose) ----------------
    drawBaseDirect(ctx, V, hab, night) {
      this.drawSlab(ctx, V, hab, night);
      for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (g) D.decorShadow(ctx, V, g, night); }
      for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (g && g.def.cat === 'ground' && !inst.parent) D.decor(ctx, V, g, { night, time: 0 }); }
    }
    drawBase(ctx, V, hab, night) {
      const key = hab.data.id + '|' + hab._geomVersion + '|' + hab.data.substrate + '|' + hab.data.type + '|' + Math.round(night * 10) + '|' + Math.round((hab.data.humidity || 0) * 20) + '|' + this.quality;
      if (!this._baseL || this._baseL.hab !== hab.data.id + '|' + hab._geomVersion) {
        const dm = hab.dims; const pts = [];
        for (const x of [-0.2 * dm.w, 0, dm.w, 1.2 * dm.w]) for (const z of [-0.2 * dm.d, 0, dm.d, 1.2 * dm.d]) for (const y of [-16, 2]) pts.push([x, y, z]);
        for (const id in hab.geoms) { const g = hab.geoms[id]; if (g.def.cat === 'ground') pts.push([g.center[0], g.baseY + 8, g.center[2]]); }
        this._baseL = { hab: hab.data.id + '|' + hab._geomVersion, pts, cov: covOf(pts), L: null };
      }
      const B = this._baseL;
      this.layer(ctx, V, B, key, (g2, V2) => this.drawBaseDirect(g2, V2, hab, night), () => this.drawBaseDirect(ctx, V, hab, night), 0);
    }
    decorPoints(g) {
      if (g._pts) return g._pts; const pts = []; const P = (p) => pts.push(p);
      for (const e of g.extent) { P([e[0], g.baseY, e[1]]); P([e[0], g.baseY + g.height, e[1]]); }
      for (const pr of g.prims) {
        if (pr.o) { P(pr.o); if (pr.a) { const t = M.add(pr.o, pr.a); P(t); if (pr.b) { P(M.add(t, pr.b)); P(M.sub(t, pr.b)); P(M.add(pr.o, pr.b)); P(M.sub(pr.o, pr.b)); } } if (pr.r) { for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) P(M.add(pr.o, M.mul(d, pr.r * 1.5))); } }
        if (pr.pts) for (const q of pr.pts) P(q);
        if (pr.poly) for (const q of pr.poly) { P([q[0], pr.y0, q[1]]); P([q[0], pr.y1, q[1]]); }
        if (pr.t === 'log') { P(pr.a); P(pr.b); }
      }
      if (!pts.length) P(g.center || [0, 0, 0]);
      g._pts = pts.filter(q => q && isFinite(q[0]) && isFinite(q[1]) && isFinite(q[2])); return g._pts;
    }
    boundsOf(pts, V, m) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of pts) { const q = V.P(p); if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
      return [Math.floor(x0 - m), Math.floor(y0 - m), Math.ceil(x1 + m), Math.ceil(y1 + m)];
    }
    decorBounds(g, V) { return this.boundsOf(this.decorPoints(g), V, 10 * this.k + 6 * V.s); }
    /** Start-of-frame bookkeeping for the cached layers: a small time budget for re-rendering stale ones. */
    beginLayers(V) {
      const moving = !this._lastV || Math.abs(M.wrapAngle(V.yaw - this._lastV[0])) > 1e-5 || Math.abs(V.pitch - this._lastV[1]) > 1e-5 || Math.abs(V.s / this._lastV[2] - 1) > 1e-5;
      this._lastV = [V.yaw, V.pitch, V.s]; this._moving = moving; this._stillT = moving ? 0 : (this._stillT || 0) + 1;
      // ms of re-rendering allowed this frame (refreshes are spread over frames; nothing is ever wrong for long)
      this._budget = moving ? 3 : 7; this._Pc = projM(V); this._sprPx = 0;
    }
    /**
     * Draw one static layer through its cache. The cached image was rendered from some earlier camera pose; it is
     * re-projected onto the current pose with the best-fitting 2D affine warp (exact for translation/zoom, and for
     * rotation exact on the layer's main plane), so the camera can glide while almost nothing is redrawn.
     * Layers whose warp error grows past a pixel or so are re-rendered within a per-frame time budget (worst first
     * would need a sort; draw order is close enough), and once the camera rests every layer is made pixel-exact again.
     * The cache is clipped to the viewport plus a margin, so close-up follow views stay small in memory.
     */
    layer(ctx, V, L, key, render, direct, minPx) {
      const W = this.cv.width, H = this.cv.height; const S = L.L; const cov = L.cov;
      const qC = V.P(cov.m); let A = null, err = 1e9, fb = null;
      if (S) {
        const w = warpFit(this._Pc, S.Ps, cov.S); A = w.A; err = w.err;
        // blur from upscaling an old, smaller image counts as error too
        const sc = Math.sqrt(Math.abs(A[0] * A[3] - A[1] * A[2])); const R = Math.max(S.fb[2] - S.fb[0], S.fb[3] - S.fb[1]) * 0.5;
        if (sc > 1) err += (sc - 1) * R * 0.5; else err += (1 - sc) * R * 0.08;
        if (S.key !== key) err += 20;
        fb = mapRect(S.fb, A, S.q, qC, err);
      } else fb = this.boundsOf(L.pts, V, 10 * this.k + 6 * V.s);
      // cull: completely outside the screen
      if (fb[2] < 0 || fb[0] > W || fb[1] > H || fb[3] < 0) { if (S && (fb[2] < -W || fb[0] > 2 * W || fb[1] > 2 * H || fb[3] < -H)) L.L = null; return; }
      let ok = !!S;
      if (ok && S.clip) { // the cached part must still cover the visible part
        const vx0 = Math.max(0, fb[0]), vy0 = Math.max(0, fb[1]), vx1 = Math.min(W, fb[2]), vy1 = Math.min(H, fb[3]);
        const inv = inv2(A);
        for (const [x, y] of [[vx0, vy0], [vx1, vy0], [vx0, vy1], [vx1, vy1]]) {
          const dx = x - qC[0], dy = y - qC[1]; const u = inv[0] * dx + inv[1] * dy + S.q[0], v = inv[2] * dx + inv[3] * dy + S.q[1];
          if ((S.cl[0] && u < S.x - 1) || (S.cl[1] && v < S.y - 1) || (S.cl[2] && u > S.x + S.w + 1) || (S.cl[3] && v > S.y + S.h + 1)) { ok = false; break; }
        }
      }
      // refresh policy: missing/uncovered -> now; while the camera glides only clearly-off layers that fit the budget;
      // at rest, everything is brought back to exact a few per frame
      const cost = S ? S.cost : 0; let want;
      if (!ok) want = true;
      else if (this._moving) want = (err > 6 && cost <= this._budget) || (err > 24 && this._budget > 0);
      else want = err > 0.25 && this._budget > 0;
      if (want) {
        const t0 = performance.now(); const R = this.renderLayer(V, L, key, render);
        if (R) { R.cost = (performance.now() - t0) + R.w * R.h / (W * H) * 4; this._budget -= R.cost; ctx.drawImage(R.cv, R.x, R.y); return; }
      }
      if (ok && err < Math.max(minPx || 0, 40)) {
        const e = qC[0] + A[0] * (S.x - S.q[0]) + A[1] * (S.y - S.q[1]), f = qC[1] + A[2] * (S.x - S.q[0]) + A[3] * (S.y - S.q[1]);
        if (Math.abs(A[0] - 1) < 1e-6 && Math.abs(A[3] - 1) < 1e-6 && Math.abs(A[1]) < 1e-6 && Math.abs(A[2]) < 1e-6) ctx.drawImage(S.cv, Math.round(e), Math.round(f));
        else {
          // only the part of the cached image that lands on screen (big savings for close-up views)
          const iv = inv2(A); let u0 = 1e9, v0 = 1e9, u1 = -1e9, v1 = -1e9;
          for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) { const u = iv[0] * (x - e) + iv[1] * (y - f), v = iv[2] * (x - e) + iv[3] * (y - f); if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
          u0 = Math.max(0, Math.floor(u0) - 2); v0 = Math.max(0, Math.floor(v0) - 2); u1 = Math.min(S.w, Math.ceil(u1) + 2); v1 = Math.min(S.h, Math.ceil(v1) + 2);
          if (u1 > u0 && v1 > v0) { ctx.setTransform(A[0], A[2], A[1], A[3], e, f); ctx.drawImage(S.cv, u0, v0, u1 - u0, v1 - v0, u0, v0, u1 - u0, v1 - v0); ctx.setTransform(1, 0, 0, 1, 0, 0); }
        }
        return;
      }
      direct();
    }
    renderLayer(V, L, key, render) {
      const W = this.cv.width, H = this.cv.height; const mg = Math.round(Math.max(W, H) * 0.2);
      const b = this.boundsOf(L.pts, V, 10 * this.k + 6 * V.s);
      const x0 = Math.max(b[0], -mg), y0 = Math.max(b[1], -mg), x1 = Math.min(b[2], W + mg), y1 = Math.min(b[3], H + mg);
      const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return null;
      if (w * h > W * H * 2.6 || w > 8000 || h > 8000) return null;
      const old = L.L; const cw = Math.ceil(w / 32) * 32, ch = Math.ceil(h / 32) * 32;
      const cv = old && old.cv.width === cw && old.cv.height === ch ? old.cv : mkCanvas(cw, ch);
      const g2 = cv.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, cw, ch);
      g2.save(); g2.beginPath(); g2.rect(0, 0, w, h); g2.clip();
      render(g2, new JT.View(V.yaw, V.pitch, V.s, V.cx - x0, V.cy - y0, V.c));
      g2.restore();
      const q = V.P(L.cov.m);
      L.L = { key, cv, x: x0, y: y0, w, h, q: [q[0], q[1]], Ps: this._Pc.slice(), fb: b, clip: x0 > b[0] || y0 > b[1] || x1 < b[2] || y1 < b[3], cl: [x0 > b[0], y0 > b[1], x1 < b[2], y1 < b[3]] };
      return L.L;
    }
    drawDecorCached(ctx, V, g, sway, night, t) {
      if (sway || g.id === '_ghost') {
        // swaying pieces are drawn live, but only when on screen
        const q = V.P(g.center || [0, 0, 0]); const r = (Math.max(g.height || 0, g.coverR || 0) + 8) * V.s;
        if (q[0] + r < 0 || q[0] - r > this.cv.width || q[1] + r < 0 || q[1] - r > this.cv.height) return;
        D.decor(ctx, V, g, { sway, night, time: t }); return;
      }
      if (g._glow == null) g._glow = g.prims.some(p => p.glow);
      const key = (g._glow ? 'n' + Math.round(night * 10) : '') + (g.lamp ? '|L' + (g.lampOn !== false) : '') + '|' + this.quality;
      if (!g._lay) { const pts = this.decorPoints(g); g._lay = { pts, cov: covOf(pts), L: null }; }
      if (g._spr === null) { g._lay.L = null; g._spr = undefined; } // explicit invalidation (lamp toggled)
      this.layer(ctx, V, g._lay, key, (g2, V2) => D.decor(g2, V2, g, { night, time: t }), () => D.decor(ctx, V, g, { night, time: t }));
    }
    pin(ctx, V, sp, L) {
      const q = V.P([sp.pos[0], sp.pos[1] + L * 0.6, sp.pos[2]]); const k = this.k; const y = q[1] - 14 * k + Math.sin(this.time * 3) * 2 * k;
      ctx.save(); ctx.fillStyle = 'rgba(232,196,110,0.95)'; ctx.strokeStyle = 'rgba(30,18,8,0.8)'; ctx.lineWidth = 1.5 * k;
      ctx.beginPath(); ctx.moveTo(q[0], y + 8 * k); ctx.lineTo(q[0] - 6 * k, y); ctx.lineTo(q[0] + 6 * k, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.font = '600 ' + Math.round(12 * k) + 'px Georgia, serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3 * k; ctx.strokeText(sp.name, q[0], y - 4 * k); ctx.fillText(sp.name, q[0], y - 4 * k); ctx.restore();
    }
    drawHeld(ctx, V, sp, p, mp, fg, sg, n, L) {
      // the meal hangs in the fangs, slightly lower than the head; it shrinks as it is drained
      const def = JT.PREY_BY_ID[p.type] || { len: 3 };
      const jit = sp.state === 'subdue' ? Math.sin(this.time * 40) * L * 0.012 : 0;
      const full = p.full != null ? p.full : 1;
      const pl = Math.min(p.len || def.len, L * 1.1) * (0.6 + 0.4 * full);
      // prey body lies along the spider's facing, its rear end pushed outward from the fangs
      const pf = { p: M.add(M.add(mp, M.mul(fg, pl * 0.25)), M.mul(sg, jit)), f: M.mul(fg, -1), s: M.mul(sg, -1), n };
      D.prey(ctx, V, p, pf, { held: true, curled: true, len: pl, time: this.time, alpha: 0.55 + 0.45 * full });
    }
    drawGhost(ctx, V, gh, night) {
      const g = gh.geom; ctx.save();
      const col = gh.ok ? 'rgba(110,220,120,' : 'rgba(235,80,70,';
      if (g.foot) { ctx.beginPath(); g.foot.forEach((q, i) => { const s = V.P([q[0], g.baseY + 0.2, q[1]]); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath(); ctx.fillStyle = col + '0.25)'; ctx.fill(); ctx.strokeStyle = col + '0.9)'; ctx.lineWidth = 2 * this.k; ctx.setLineDash([6 * this.k, 4 * this.k]); ctx.stroke(); ctx.setLineDash([]); }
      D.decor(ctx, V, g, { alpha: gh.ok ? 0.78 : 0.45, night, time: this.time });
      ctx.restore(); ctx.globalAlpha = 1;
    }
    outlineDecor(ctx, V, g, col) { const hull = this.decorScreenHull(g, V); if (!hull) return; ctx.strokeStyle = col; ctx.lineWidth = 2 * this.k; ctx.setLineDash([5 * this.k, 4 * this.k]); ctx.beginPath(); hull.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); }
    decorScreenHull(g, V) {
      const pts = []; const ex = g.extent.length ? g.extent : (g.foot || []);
      const top = g.baseY + Math.max(2, g.height);
      for (const e of ex) { pts.push(V.P([e[0], g.baseY, e[1]]).slice(0, 2)); }
      for (const pth of g.paths) for (const q of pth.pts) pts.push(V.P(q).slice(0, 2));
      for (const pr of g.prims) if (pr.o) pts.push(V.P(pr.o).slice(0, 2)); else if (pr.poly) for (const q of pr.poly) { pts.push(V.P([q[0], pr.y0, q[1]]).slice(0, 2)); pts.push(V.P([q[0], pr.y1, q[1]]).slice(0, 2)); }
      if (!pts.length) return null; if (pts.length < 3) { const c = pts[0]; const r = 10 * this.k; return [[c[0] - r, c[1] - r], [c[0] + r, c[1] - r], [c[0] + r, c[1] + r], [c[0] - r, c[1] + r]]; }
      void top; return G.hull(pts);
    }

    // ---------------- effects ----------------
    // ---------------- basking lamp light ----------------
    lampSurface(hab, L) {
      const k = L.inst.id + '|' + hab._geomVersion; L.inst._ls = L.inst._ls && L.inst._ls.k === k ? L.inst._ls : { k, y: JT.Nav.supportBelow(hab, [L.pool[0], L.head[1] - 3, L.pool[2]]).pos[1] };
      return L.inst._ls.y;
    }
    /** Warm pool on the surfaces under the lamp + longer, darker shadows cast away from it (drawn before night grading). */
    drawLampPools(ctx, V, hab, lamps, night, withSpiders) {
      ctx.save();
      for (const L of lamps) {
        const y = this.lampSurface(hab, L); const c = V.P([L.pool[0], y + 0.05, L.pool[2]]); const R = L.r * 1.05 * V.s;
        // shadows: objects and jumpers near the light throw a soft shadow pointing away from it
        ctx.globalCompositeOperation = 'source-over';
        const sh = (pos, rad, hgt, a) => {
          const dx = pos[0] - L.pool[0], dz = pos[2] - L.pool[2]; const dl = Math.hypot(dx, dz); if (dl > L.r * 2.2 || dl < 0.5) return;
          const ux = dx / dl, uz = dz / dl; const len = Math.min(rad * 2.4, hgt * 0.5 + rad);
          const q = V.P([pos[0] + ux * len * 0.55, pos[1] + 0.05, pos[2] + uz * len * 0.55]); const ax = V.J([ux * len * 0.7, 0, uz * len * 0.7]), ay = V.J([-uz * rad * 0.8, 0, ux * rad * 0.8]);
          const rx = Math.hypot(ax[0], ax[1]), ry = Math.max(0.5, Math.hypot(ay[0], ay[1])); if (rx < 0.5) return;
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(20,10,4,' + (a * (1 - dl / (L.r * 2.2))).toFixed(3) + ')'); g.addColorStop(1, 'rgba(20,10,4,0)');
          ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(Math.atan2(ax[1], ax[0])); ctx.scale(rx, ry); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.283); ctx.fill(); ctx.restore();
        };
        for (const inst of hab.decor) { if (inst.id === L.inst.id) continue; const g = hab.geoms[inst.id]; if (!g || g.def.arche === 'backwall' || g.def.arche === 'wallmount') continue; sh(g.center, Math.max(3, Math.min(14, g.coverR * 0.7)), g.height, 0.3); }
        if (withSpiders !== false) for (const sp of hab.spiders) if (M.finite3(sp.pos) && Math.abs(sp.pos[1] - y) < 3) { const l = JT.SpiderAI.len(sp); sh(sp.pos, l * 0.5, l * 0.6, 0.35); }
        // the warm pool itself
        ctx.globalCompositeOperation = 'screen';
        ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(1, Math.max(0.15, V.sp));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); const a = 0.3 + night * 0.1;
        g.addColorStop(0, 'rgba(255,196,120,' + a.toFixed(3) + ')'); g.addColorStop(0.45, 'rgba(255,170,90,' + (a * 0.55).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,150,70,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill(); ctx.restore();
      }
      ctx.restore();
    }
    /** Additive bulb glow and lit highlights; drawn after grading so it stays visible at night. */
    drawLampGlow(ctx, V, hab, lamps, night) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
      for (const L of lamps) {
        const b = V.P(L.head); const y = this.lampSurface(hab, L); const c = V.P([L.pool[0], y + 0.05, L.pool[2]]);
        const flick = 1 + Math.sin(this.time * 0.7) * 0.015;
        const rb = 9 * V.s * flick; let g = ctx.createRadialGradient(b[0], b[1], 0, b[0], b[1], rb);
        g.addColorStop(0, 'rgba(255,226,170,' + (0.35 + night * 0.4).toFixed(3) + ')'); g.addColorStop(0.3, 'rgba(255,170,90,' + (0.12 + night * 0.18).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b[0], b[1], rb, 0, 6.283); ctx.fill();
        if (night > 0.05) {
          // soft cone of light falling to the pool
          ctx.save(); ctx.globalAlpha = 0.5 * night; const R = L.r * V.s;
          const cg = ctx.createLinearGradient(b[0], b[1], c[0], c[1]); cg.addColorStop(0, 'rgba(255,200,130,0.14)'); cg.addColorStop(1, 'rgba(255,170,90,0.03)');
          ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(b[0] - 3 * V.s, b[1]); ctx.lineTo(b[0] + 3 * V.s, b[1]); ctx.lineTo(c[0] + R * 0.8, c[1]); ctx.lineTo(c[0] - R * 0.8, c[1]); ctx.closePath(); ctx.fill(); ctx.restore();
          ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(1, Math.max(0.15, V.sp)); const gp = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
          gp.addColorStop(0, 'rgba(255,170,90,' + (0.32 * night).toFixed(3) + ')'); gp.addColorStop(0.5, 'rgba(255,140,60,' + (0.13 * night).toFixed(3) + ')'); gp.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = gp; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill(); ctx.restore();
        }
      }
      ctx.restore();
    }
    addText(pos, text, col, big) { this.fx.push({ pos: pos.slice(), text, col: col || '#ffe9a8', t: 0, life: big ? 1.8 : 1.5, big }); }
    burst(pos, col, n) { for (let i = 0; i < (n || 10); i++) this.particles.push({ pos: pos.slice(), v: [(JT.R() - 0.5) * 30, 10 + JT.R() * 25, (JT.R() - 0.5) * 30], t: 0, life: 0.6 + JT.R() * 0.5, col: col || '#fff2c0', r: 0.4 + JT.R() * 0.5 }); }
    /** A light, slow-settling haze of fine droplets (no burst). */
    mistFx(hab) { for (let i = 0; i < 36; i++) { const q = hab.randomFloorPoint(); this.particles.push({ pos: [q[0], hab.dims.h * (0.5 + JT.R() * 0.5), q[2]], v: [(JT.R() - 0.5) * 3, -12 - JT.R() * 10, (JT.R() - 0.5) * 3], t: -JT.R() * 0.8, life: 2.2 + JT.R() * 1.5, col: 'rgba(225,240,255,0.45)', r: 0.2 + JT.R() * 0.25, mist: true }); } }
    drawMotes(ctx, V, hab, dt) {
      // dust motes drifting through the light — a tiny bit of air between you and the scene
      const day = this.game.daylight(); if (day < 0.15 || this.quality === 'low') return;
      const dm = hab.dims; if (!this.motes || this.motes.hab !== hab.data.id) { const rng = JT.makeRng(7); this.motes = { hab: hab.data.id, p: [] }; for (let i = 0; i < 34; i++) this.motes.p.push([rng() * dm.w, 6 + rng() * dm.h * 0.9, rng() * dm.d, rng() * 6.28, 0.25 + rng() * 0.5]); }
      const t = this.time; ctx.fillStyle = '#fff3c8';
      for (const m of this.motes.p) {
        const x = m[0] + Math.sin(t * 0.13 + m[3]) * 6, y = m[1] + Math.sin(t * 0.09 + m[3] * 2) * 4, z = m[2] + Math.cos(t * 0.11 + m[3]) * 5;
        const q = V.P([x, y, z]); const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + m[3] * 3);
        ctx.globalAlpha = day * (0.18 + 0.4 * tw) * m[4]; const r = Math.max(0.6 * this.k, m[4] * 0.45 * V.s);
        ctx.fillRect(q[0] - r, q[1] - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
    drawEffects(ctx, V, hab, dt) {
      this.drawMotes(ctx, V, hab, dt);
      for (const p of this.particles) { p.t += dt; p.v[1] -= (p.mist ? 10 : 60) * dt; p.pos = M.add(p.pos, M.mul(p.v, dt)); const q = V.P(p.pos); if (p.t < 0) continue; const a = Math.min(1, p.t * 3) * (1 - p.t / p.life); if (a <= 0) continue; ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(0.8, p.r * V.s), 0, 6.283); ctx.fill(); }
      this.particles = this.particles.filter(p => p.t < p.life && p.pos[1] > -2); if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
      ctx.globalAlpha = 1; ctx.textAlign = 'center';
      for (const f of this.fx) {
        f.t += dt; const a = M.clamp(1 - f.t / f.life, 0, 1); const q = V.P([f.pos[0], f.pos[1] + 6 + f.t * 10, f.pos[2]]);
        const sz = (f.big ? 22 : 15) * this.k * (1 + Math.max(0, 0.25 - f.t) * 1.5);
        ctx.font = '700 ' + sz.toFixed(0) + 'px Georgia, "Times New Roman", serif'; ctx.globalAlpha = a;
        ctx.lineWidth = 3.5 * this.k; ctx.strokeStyle = 'rgba(30,18,8,0.85)'; ctx.strokeText(f.text, q[0], q[1]); ctx.fillStyle = f.col; ctx.fillText(f.text, q[0], q[1]);
      }
      this.fx = this.fx.filter(f => f.t < f.life); ctx.globalAlpha = 1;
    }

    // ---------------- post ----------------
    nightGrade(ctx, night) {
      if (night <= 0.01) return; ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(' + Math.round(255 - night * 165) + ',' + Math.round(255 - night * 145) + ',' + Math.round(255 - night * 90) + ',1)'; ctx.fillRect(0, 0, this.cv.width, this.cv.height); ctx.restore();
    }
    postProcess(out, sc, night, reuse, fixedGrain) {
      // in place, few full-screen passes: blurred tilt bands (only where the mask is non-zero), bloom, night grade,
      // then ONE pre-baked overlay holding warm tint + vignette + film grain (jittered each frame so the grain lives)
      const W = this.cv.width, H = this.cv.height; const st = this.set;
      out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
      if (st.tilt || st.bloom) {
        const w4 = Math.max(8, W >> 2), h4 = Math.max(8, H >> 2), w8 = Math.max(4, W >> 3), h8 = Math.max(4, H >> 3);
        if (!this.b4 || this.b4.width !== w4 || this.b4.height !== h4) { this.b4 = mkCanvas(w4, h4); this.b8 = mkCanvas(w8, h8); this.bm = mkCanvas(w8, h8); this._tg = null; }
        const g4 = this.b4.getContext('2d'), g8 = this.b8.getContext('2d');
        if (!reuse) { g4.globalCompositeOperation = 'copy'; g4.drawImage(sc, 0, 0, w4, h4); g8.globalCompositeOperation = 'copy'; g8.drawImage(this.b4, 0, 0, w8, h8); }
        out.imageSmoothingEnabled = true;
        if (st.tilt) {
          const m = this.bm.getContext('2d'); if (!reuse) { m.globalCompositeOperation = 'copy'; m.drawImage(this.b8, 0, 0); }
          if (!this._tg) { const g = m.createLinearGradient(0, 0, 0, h8); g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.24, 'rgba(0,0,0,0)'); g.addColorStop(0.78, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); this._tg = g; }
          if (!reuse) { m.globalCompositeOperation = 'destination-in'; m.fillStyle = this._tg; m.fillRect(0, 0, w8, h8); m.globalCompositeOperation = 'source-over'; }
          const ya = Math.ceil(h8 * 0.25), yb = Math.floor(h8 * 0.77), sy = H / h8;
          out.drawImage(this.bm, 0, 0, w8, ya, 0, 0, W, ya * sy);
          out.drawImage(this.bm, 0, yb, w8, h8 - yb, 0, yb * sy, W, (h8 - yb) * sy);
        }
        if (st.bloom) { out.globalCompositeOperation = 'screen'; out.globalAlpha = 0.13 + night * 0.08; out.drawImage(this.b8, 0, 0, W, H); out.globalAlpha = 1; out.globalCompositeOperation = 'source-over'; }
      }
      this.nightGrade(out, night);
      const J = 24; const okey = W + 'x' + H + '|' + Math.round(night * 20) + '|' + !!st.grain;
      if (this._ovk !== okey) {
        const ow = W + J, oh = H + J; const o = this._ov && this._ov.width === ow && this._ov.height === oh ? this._ov : mkCanvas(ow, oh); const g = o.getContext('2d');
        g.globalCompositeOperation = 'copy'; g.fillStyle = 'rgba(255,196,128,' + (0.045 * (1 - night)).toFixed(3) + ')'; g.fillRect(0, 0, ow, oh); g.globalCompositeOperation = 'source-over';
        const cx = ow / 2, cy = J / 2 + H * 0.48; const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, J / 2 + H * 0.5, Math.hypot(W, H) * 0.58);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,0,' + (0.42 + night * 0.15).toFixed(2) + ')'); g.fillStyle = vg; g.fillRect(0, 0, ow, oh);
        if (st.grain) {
          if (!this.noise) { this.noise = mkCanvas(128, 128); const ng = this.noise.getContext('2d'); const id = ng.createImageData(128, 128); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = Math.random() * 255; } ng.putImageData(id, 0, 0); }
          g.globalAlpha = 0.07; g.fillStyle = g.createPattern(this.noise, 'repeat'); g.fillRect(0, 0, ow, oh); g.globalAlpha = 1;
        }
        this._ov = o; this._ovk = okey;
      }
      const jx = st.grain && !fixedGrain ? (Math.random() * J) | 0 : J / 2, jy = st.grain && !fixedGrain ? (Math.random() * J) | 0 : J / 2;
      out.drawImage(this._ov, jx, jy, W, H, 0, 0, W, H);
    }

    // ---------------- picking ----------------
    /** sx, sy in CSS pixels. Animals take priority, then remains/drops/silk, then decor. */
    pick(sx, sy, opts) {
      opts = opts || {}; const hab = this.game.hab; const V = this.V; const X = sx * this.k, Y = sy * this.k;
      let best = null, bd = 1e9;
      const test = (e, kind, rad) => { if (!e.pos || !M.finite3(e.pos)) return; const q = V.P(e.pos); const d = Math.hypot(q[0] - X, q[1] - Y); const r = Math.max(16 * this.k, rad * V.s); if (d < r && d / r < bd) { bd = d / r; best = { kind, ent: e }; } };
      for (const sp of hab.spiders) test(sp, 'spider', JT.SpiderAI.len(sp) * 1.1);
      if (best) return best;
      if (!opts.noPrey) for (const p of hab.prey) if (!p.owner && !p.buried) test(p, 'prey', (JT.PREY_BY_ID[p.type] || { len: 3 }).len * 1.2);
      if (best) return best;
      bd = 1e9; for (const r of hab.data.remains) test(r, 'remains', 4);
      if (best) return best;
      bd = 1e9; let bdep = 1e9;
      for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (!g) continue; const hull = this.decorScreenHull(g, V); if (hull && G.pointInPoly(X, Y, hull)) { const c = g.foot ? G.centroid(g.foot) : [inst.x, inst.z]; const dep = V.depth([c[0], g.baseY, c[1]]) - g.baseY * 0.5 - (inst.parent ? 5 : 0); const area = Math.abs(G.polyArea(hull)); const score = dep * 0.2 + Math.sqrt(area) * 0.3; if (score < bdep) { bdep = score; best = { kind: 'decor', ent: inst }; } } }
      return best;
    }
    /** Placement location: highest platform top under the cursor, else the floor. */
    placementPoint(sx, sy, hab, type) {
      const tops = [];
      const def = JT.DECOR_BY_ID[type];
      if (def && def.mount) { // point at a back wall: intersect the view ray with the wall face plane
        const A = this.unproject(sx, sy, 0), B = this.unproject(sx, sy, 100); let best = null;
        for (const id in hab.geoms) { const g = hab.geoms[id]; if (!g.front) continue; const F = g.front, a = F[0], b = F[F.length - 1]; const nx = g.out[0], nz = g.out[2];
          const f0 = (A[0] - a[0]) * nx + (A[1] - a[1]) * nz, f1 = (B[0] - a[0]) * nx + (B[1] - a[1]) * nz; if (Math.abs(f1 - f0) < 1e-6) continue;
          const y = -f0 / (f1 - f0) * 100; if (!(y > -20 && y < g.wallH + 30)) continue; const x = A[0] + (B[0] - A[0]) * y / 100, z = A[1] + (B[1] - A[1]) * y / 100;
          const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1, u = ((x - a[0]) * ex + (z - a[1]) * ez) / L; const off = Math.max(0, -u, u - L);
          if (!best || off < best.off) best = { x, z, y: 0, my: y, off, on: id }; }
        if (best) return best;
      }
      if (def) for (const id in hab.geoms) { const g = hab.geoms[id]; g.tops.forEach((t, i) => tops.push({ id, i, t })); }
      tops.sort((a, b) => b.t.y - a.t.y);
      for (const T of tops) { const xz = this.unproject(sx, sy, T.t.y); if (G.pointInPoly(xz[0], xz[1], T.t.poly)) return { x: xz[0], z: xz[1], y: T.t.y, on: T.id }; }
      const xz = this.unproject(sx, sy, 0); return { x: xz[0], z: xz[1], y: 0, on: null };
    }

    // ---------------- debug ----------------
    drawDebug(ctx, V, hab) {
      const nav = hab.nav; if (!nav) return; ctx.save(); ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(80,200,255,0.25)';
      for (const n of nav.nodes) for (const e of nav.adj[n.id] || []) { if (e.to < n.id && e.type !== 'jump' && e.type !== 'drop') continue; const b = nav.nodes[e.to]; if (!b) continue; const A = V.P(n.pos), B = V.P(b.pos); ctx.strokeStyle = e.type === 'jump' ? 'rgba(255,200,60,0.3)' : e.type === 'drop' ? 'rgba(255,90,90,0.3)' : 'rgba(80,200,255,0.22)'; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }
      for (const n of nav.nodes) { const q = V.P(n.pos); ctx.fillStyle = n.kind === 'path' ? '#6f6' : n.kind === 'top' ? '#ff6' : n.kind === 'face' ? '#f9f' : '#6cf'; ctx.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3); }
      ctx.font = (11 * this.k) + 'px monospace'; ctx.textAlign = 'left';
      for (const sp of hab.spiders) {
        const q = V.P(sp.pos);
        if (sp._route) { ctx.strokeStyle = '#ff0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q[0], q[1]); for (let i = sp._route.i; i < sp._route.steps.length; i++) { const s = V.P(sp._route.steps[i].pos); ctx.lineTo(s[0], s[1]); } ctx.stroke(); }
        const t = sp.target && JT.SpiderAI.targetEnt(hab, sp); if (t) { const b = V.P(t.pos); ctx.strokeStyle = '#f44'; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        const spot = sp._feedSpot || sp._moltSpot; if (spot) { const b = V.P(spot); ctx.fillStyle = '#f0f'; ctx.fillRect(b[0] - 4, b[1] - 4, 8, 8); }
        ctx.fillStyle = '#fff'; ctx.fillText(sp.name + ' ' + sp.state + ' ' + (sp.sup && sp.sup.k) + ' sat ' + sp.sat.toFixed(2), q[0] + 8, q[1] - 8);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(4, 4, 260 * this.k, 52 * this.k); ctx.fillStyle = '#9f9';
      ctx.fillText('fps ' + this.fps.toFixed(0) + '  ms ' + (this.frameMs || 0).toFixed(1) + '  q ' + this.quality + '  nodes ' + nav.nodes.length, 10, 20 * this.k);
      ctx.fillText('prey ' + hab.prey.length + '  silk ' + hab.data.silk.length + '  remains ' + hab.data.remains.length + '  drops ' + hab.data.drops.length, 10, 38 * this.k);
      ctx.restore();
    }

    // ---------------- thumbnails & portraits (same drawing code as the habitat) ----------------
    decorThumb(type, rot, size) {
      size = size || 112; const key = type + '|' + (rot || 0) + '|' + size; if (this.thumbs[key]) return this.thumbs[key];
      const c = mkCanvas(size, size); const ctx = c.getContext('2d');
      try {
        const g = JT.Geo.build({ id: 'thumb_' + type, type, x: 0, z: 0, rot: rot || 0, seed: 1 }, 0, 160);
        const V = new JT.View(0.52, 0.62, 1, 0, 0, [0, 0, 0]);
        const pts = []; const hull = this.decorScreenHull(g, V) || [[-1, -1], [1, 1]]; for (const q of hull) pts.push(q);
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
        const s = Math.min(size * 0.84 / Math.max(1, x1 - x0), size * 0.84 / Math.max(1, y1 - y0));
        V.set(0.52, 0.62, s, size / 2 - (x0 + x1) / 2 * s, size / 2 - (y0 + y1) / 2 * s, [0, 0, 0]);
        D.decorShadow(ctx, V, g, 0); D.decor(ctx, V, g, { night: 0, time: 0 });
      } catch (e) { if (JT.DEV) console.warn(e); }
      this.thumbs[key] = c; return c;
    }
    speciesPortrait(id, size) {
      size = size || 120; const key = id + '|' + size; if (this.portraits[key]) return this.portraits[key];
      const c = mkCanvas(size, size); const ctx = c.getContext('2d'); const V = new JT.View(0.9, 0.85, size / 16, size / 2, size * 0.58, [0, 0, 0]);
      const sp = { species: id, state: 'idle', _walk: 0, _moving: false, _crouch: 0, _legRaise: 0.3, seed: 1, sat: 0.6 };
      try { D.spider(ctx, V, sp, { p: [0, 0, 0], f: M.norm([-0.5, 0, 0.8]), s: M.norm([0.8, 0, 0.5]), n: [0, 1, 0] }, { len: 10, time: 0, thumb: true }); } catch (e) { if (JT.DEV) console.warn(e); }
      this.portraits[key] = c; return c;
    }
    preyPortrait(id, size) {
      size = size || 96; const key = 'prey|' + id + '|' + size; if (this.portraits[key]) return this.portraits[key];
      const d = JT.PREY_BY_ID[id]; const c = mkCanvas(size, size); const ctx = c.getContext('2d');
      const V = new JT.View(0.9, 0.8, size / (Math.max(3, d.len) * 1.9), size / 2, size * 0.6, [0, 0, 0]);
      try { D.prey(ctx, V, { type: id, sup: { k: 'floor' }, seed: 1, _anim: 0, species: 'zebra' }, { p: [0, 0, 0], f: M.norm([-0.5, 0, 0.8]), s: M.norm([0.8, 0, 0.5]), n: [0, 1, 0] }, { time: 0 }); } catch (e) { if (JT.DEV) console.warn(e); }
      this.portraits[key] = c; return c;
    }
  }

  // ---- affine re-projection maths for cached layers ----
  /** Linear part of the projection (2x3, row-major) for a view. */
  function projM(V) { const s = V.s; return [s * V.cy_, 0, -s * V.sy_, -s * V.sp * V.sy_, -s * V.cp, -s * V.sp * V.cy_]; }
  /** Mean and covariance of a point cloud (the shape of a layer). */
  function covOf(pts) {
    const m = [0, 0, 0]; for (const p of pts) { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; } const n = Math.max(1, pts.length); m[0] /= n; m[1] /= n; m[2] /= n;
    const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const p of pts) { const d = [p[0] - m[0], p[1] - m[1], p[2] - m[2]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i * 3 + j] += d[i] * d[j]; }
    for (let i = 0; i < 9; i++) S[i] /= n; for (let i = 0; i < 3; i++) S[i * 4] += 0.01;
    return { m, S };
  }
  function mulPS(P, S) { const o = [0, 0, 0, 0, 0, 0]; for (let r = 0; r < 2; r++) for (let j = 0; j < 3; j++) { let v = 0; for (let k = 0; k < 3; k++) v += P[r * 3 + k] * S[k * 3 + j]; o[r * 3 + j] = v; } return o; }
  function mulPT(X, P) { const o = [0, 0, 0, 0]; for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { let v = 0; for (let k = 0; k < 3; k++) v += X[r * 3 + k] * P[c * 3 + k]; o[r * 2 + c] = v; } return o; }
  function inv2(A) { const d = A[0] * A[3] - A[1] * A[2]; const id = Math.abs(d) > 1e-12 ? 1 / d : 0; return [A[3] * id, -A[1] * id, -A[2] * id, A[0] * id]; }
  /** Best 2x2 warp A with Pc ≈ A·Ps over the layer's points (least squares), and the ~2-sigma pixel error left over. */
  function warpFit(Pc, Ps, S) {
    const PsS = mulPS(Ps, S), B = mulPT(PsS, Ps), C = mulPT(mulPS(Pc, S), Ps); const Bi = inv2(B);
    const A = [C[0] * Bi[0] + C[1] * Bi[2], C[0] * Bi[1] + C[1] * Bi[3], C[2] * Bi[0] + C[3] * Bi[2], C[2] * Bi[1] + C[3] * Bi[3]];
    const Rm = [0, 0, 0, 0, 0, 0]; for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) Rm[r * 3 + k] = Pc[r * 3 + k] - (A[r * 2] * Ps[k] + A[r * 2 + 1] * Ps[3 + k]);
    const RS = mulPS(Rm, S); const T = mulPT(RS, Rm); const err = 2 * Math.sqrt(Math.max(0, T[0] + T[3]));
    return { A, err };
  }
  /** Screen rect cached under an old pose -> bounding rect under the current pose (padded by the warp error). */
  function mapRect(r, A, qS, qC, pad) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]]]) { const dx = x - qS[0], dy = y - qS[1]; const u = qC[0] + A[0] * dx + A[1] * dy, v = qC[1] + A[2] * dx + A[3] * dy; if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; }
    pad = Math.min(pad, 60); return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }
  function hexA(hex, a) { const v = parseInt(hex.slice(1), 16); return 'rgba(' + (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')'; }
  function blobShadow(ctx, V, pos, r, a) { const q = V.P(pos); const rx = Math.max(1, r * V.s); ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.beginPath(); ctx.ellipse(q[0], q[1], rx, rx * Math.max(0.25, V.sp), 0, 0, 6.283); ctx.fill(); }
  function selRing(ctx, V, fr, L, t) {
    const c = fr.p; const r = L * 0.95; ctx.save(); ctx.strokeStyle = 'rgba(232,196,110,' + (0.55 + 0.25 * Math.sin(t * 3)) + ')'; ctx.lineWidth = Math.max(1, V.s * 0.25); ctx.beginPath();
    for (let i = 0; i <= 28; i++) { const a = i / 28 * 6.283; const p = M.add(c, M.add(M.mul(fr.f, Math.cos(a) * r), M.mul(fr.s, Math.sin(a) * r))); const q = V.P(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.stroke(); ctx.restore();
  }
  JT.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
