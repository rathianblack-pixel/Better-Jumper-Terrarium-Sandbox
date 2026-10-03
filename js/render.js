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
      if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; this.bgCache = {}; this.scene = null; }
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
      if (dt > 0) { this.fps = this.fps * 0.95 + (1 / Math.max(1e-3, dt)) * 0.05; if (this.set.quality === 'auto') { if (this.fps < 26 && this.time > 4 && !this._autoLow) { this._autoLow = true; this.resize(); } } }
      const V = this.updateView(hab, dt);
      const W = this.cv.width, H = this.cv.height;
      const post = this.quality !== 'low' && this.set.hd2d;
      if (post && (!this.scene || this.scene.width !== W || this.scene.height !== H)) this.scene = mkCanvas(W, H);
      const ctx = post ? this.scene.getContext('2d') : this.ctx;
      const night = 1 - game.daylight();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter && (ctx.filter = 'none');
      ctx.drawImage(this.background(hab.data.bg), 0, 0);
      const vk = V.yaw.toFixed(4) + '|' + V.pitch.toFixed(4) + '|' + V.s.toFixed(4);
      this._viewStable = vk === this._lastVK; this._lastVK = vk; this._vk = vk; this._sprBudget = 6; this._dt = dt;
      this.drawBase(ctx, V, hab, night);
      const lamps = hab.lampsOn ? hab.lampsOn() : [];
      if (lamps.length) this.drawLampPools(ctx, V, hab, lamps, night);
      this.drawScene(ctx, V, hab, night);
      this.drawEffects(ctx, V, hab, dt);
      if (post) this.postProcess(this.ctx, this.scene, night);
      else this.nightGrade(this.ctx, night);
      if (lamps.length) this.drawLampGlow(this.ctx, V, hab, lamps, night);
      if (this.set.debug) this.drawDebug(this.ctx, V, hab);
    }
    drawScene(ctx, V, hab, night) {
      const items = []; const t = this.time; const geoms = hab.geoms; const sel = this.game.selectedId;
      const decDepth = {};
      // ground-layer decor first (moss, leaf litter, pebbles) + shadows
      const W = this.cv.width, H = this.cv.height, mg = 90 * this.k;
      const onScreen = (pos) => { const q = V.P(pos); return q[0] > -mg && q[0] < W + mg && q[1] > -mg && q[1] < H + mg; };
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
        const draw = (alpha) => {
          const hp = sp.hold ? hab.preyById(sp.hold) : null;
          D.spider(ctx, V, sp, fr, { len: L, airborne: air, time: t, alpha, tucked: !!sp.nest && JT.SpiderAI.NEST_STATES.has(sp.state) && (sp.state !== 'emerge' || !(hab.data.nests || []).some(n => n.id === sp.nest && n.hole && n.hole.open > 0.7)), lookCam: sp._lc > 0.02 ? sp._lc : 0, tilt: sp._tilt, hang, noShadow: hang > 0.2, meal: hp ? (mp, fg, sg, n) => this.drawHeld(ctx, V, sp, hp, mp, fg, sg, n, L) : null });
        };
        if (hangA) { const fp = fr.p, fff = fr.f; items.push({ d: d + 0.01, f: () => { const a = V.P(hangA), b = V.P(M.sub(fp, M.mul(fff, L * 0.32))); ctx.strokeStyle = 'rgba(240,240,250,' + (0.45 - night * 0.15).toFixed(2) + ')'; ctx.lineWidth = Math.max(0.5, V.s * 0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }); d = V.depth(fr.p); }
        // live safety dragline paid out behind a jump
        if (air && sp._anchor && M.finite3(sp._anchor)) { const an = sp._anchor, sp2 = fr.p; items.push({ d: V.depth(M.lerp3(an, sp2, 0.5)) - 0.05, f: () => { const a = V.P(an), b = V.P(sp2); ctx.strokeStyle = 'rgba(240,240,250,' + (0.32 - night * 0.1).toFixed(2) + ')'; ctx.lineWidth = Math.max(0.5, V.s * 0.07); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }); }
        items.push({ d, f: () => draw(1) });
        if (ventral && sp.id === sel) items.push({ d: d - 0.2 - 50, f: () => { ctx.globalAlpha = 0.3; D.spider(ctx, V, sp, fr, { len: L, time: t, alpha: 0.3, noShadow: true }); ctx.globalAlpha = 1; } });
        if (air) { const b = JT.Nav.supportBelow(hab, sp.pos); items.push({ d: V.depth(b.pos) + 0.03, f: () => blobShadow(ctx, V, b.pos, L * 0.45, 0.2 * M.clamp(1 - (sp.pos[1] - b.pos[1]) / 60, 0.2, 1)) }); }
      }
      for (const lf of (hab._leaves || [])) { if (!M.finite3(lf.pos)) continue; items.push({ d: V.depth(lf.pos) - 0.02, f: () => D.leafBit(ctx, V, lf) }); }
      for (const n of (hab.data.nests || [])) { if (!M.finite3(n.pos) || !onScreen(n.pos)) continue; const up = (JT.Nav.validSup(hab, n.sup) ? JT.Nav.supFrame(hab, n.sup).n : [0, 1, 0]) || [0, 1, 0]; items.push({ d: V.depth(n.pos) - n.len * 0.7, f: () => D.nest(ctx, V, n, up, night) }); }
      for (const k of hab.data.silk) items.push({ d: V.depth(M.lerp3(k.a, k.b, 0.5)) - 0.1, f: () => D.silk(ctx, V, k, night) });
      if (this.ghost && this.ghost.geom) {
        const gh = this.ghost; const g = gh.geom; const c = G.centroid(g.foot || [[gh.x, gh.z]]);
        items.push({ d: V.depth([c[0], g.baseY + 4, c[1]]), f: () => this.drawGhost(ctx, V, gh, night) });
      }
      items.sort((a, b) => b.d - a.d);
      for (const it of items) { try { it.f(); } catch (e) { if (JT.DEV) console.warn(e); } ctx.globalAlpha = 1; }
      // hover/selection highlight for decor in remove mode
      if (this.hover && this.hover.kind === 'decor') { const g = geoms[this.hover.ent.id]; if (g) this.outlineDecor(ctx, V, g, 'rgba(230,90,70,0.9)'); }
    }
    // ---------------- cached layers (static geometry is drawn once per camera pose) ----------------
    drawBaseDirect(ctx, V, hab, night) {
      this.drawSlab(ctx, V, hab, night);
      for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (g) D.decorShadow(ctx, V, g, night); }
      for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (g && g.def.cat === 'ground' && !inst.parent) D.decor(ctx, V, g, { night, time: 0 }); }
    }
    drawBase(ctx, V, hab, night) {
      const key = hab.data.id + '|' + hab._geomVersion + '|' + hab.data.substrate + '|' + hab.data.type + '|' + this._vk + '|' + Math.round(night * 10) + '|' + Math.round((hab.data.humidity || 0) * 20);
      const o = V.P([0, 0, 0]); const B = this._base;
      if (B && B.key === key) { ctx.drawImage(B.cv, B.x + o[0] - B.o[0], B.y + o[1] - B.o[1]); return; }
      if (!this._viewStable) { this.drawBaseDirect(ctx, V, hab, night); return; }
      const dm = hab.dims; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const x of [-0.2 * dm.w, 1.2 * dm.w]) for (const z of [-0.2 * dm.d, 1.2 * dm.d]) for (const y of [-16, 2]) { const q = V.P([x, y, z]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      for (const id in hab.geoms) { const g = hab.geoms[id]; if (g.def.cat !== 'ground') continue; const q = V.P([g.center[0], g.baseY + 8, g.center[2]]); y0 = Math.min(y0, q[1] - 20 * this.k); }
      x0 = Math.floor(x0 - 8); y0 = Math.floor(y0 - 8); const w = Math.ceil(x1 - x0 + 16), h = Math.ceil(y1 - y0 + 16);
      if (w * h > this.cv.width * this.cv.height * 2.5 || w > 8000 || h > 8000) { this.drawBaseDirect(ctx, V, hab, night); return; }
      const cv = (B && B.cv.width === w && B.cv.height === h) ? B.cv : mkCanvas(w, h); const g2 = cv.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, w, h);
      const V2 = new JT.View(V.yaw, V.pitch, V.s, V.cx - x0, V.cy - y0, V.c);
      this.drawBaseDirect(g2, V2, hab, night);
      this._base = { key, cv, x: x0, y: y0, o };
      ctx.drawImage(cv, x0, y0);
    }
    decorBounds(g, V) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const P = (p) => { const q = V.P(p); if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; };
      for (const e of g.extent) { P([e[0], g.baseY, e[1]]); P([e[0], g.baseY + g.height, e[1]]); }
      for (const pr of g.prims) {
        if (pr.o) { P(pr.o); if (pr.a) { const t = M.add(pr.o, pr.a); P(t); if (pr.b) { P(M.add(t, pr.b)); P(M.sub(t, pr.b)); P(M.add(pr.o, pr.b)); P(M.sub(pr.o, pr.b)); } } if (pr.r) { P(M.add(pr.o, [pr.r * 1.5, pr.r * 1.5, 0])); P(M.sub(pr.o, [pr.r * 1.5, pr.r * 1.5, 0])); } }
        if (pr.pts) for (const q of pr.pts) P(q);
        if (pr.poly) for (const q of pr.poly) { P([q[0], pr.y0, q[1]]); P([q[0], pr.y1, q[1]]); }
        if (pr.t === 'log') { P(pr.a); P(pr.b); }
      }
      const m = 10 * this.k + 6 * V.s; return [Math.floor(x0 - m), Math.floor(y0 - m), Math.ceil(x1 + m), Math.ceil(y1 + m)];
    }
    drawDecorCached(ctx, V, g, sway, night, t) {
      if (sway || g.id === '_ghost') { D.decor(ctx, V, g, { sway, night, time: t }); return; }
      if (g._glow == null) g._glow = g.prims.some(p => p.glow);
      const key = this._vk + (g._glow ? '|' + Math.round(night * 10) : '') + (g.lamp ? '|L' + (g.lampOn !== false) : '');
      const o = V.P(g.center || [0, 0, 0]); const S = g._spr;
      if (S && S.key === key) { if (S.cv) ctx.drawImage(S.cv, S.x + o[0] - S.o[0], S.y + o[1] - S.o[1]); else D.decor(ctx, V, g, { night, time: t }); return; }
      if (!this._viewStable || this._sprBudget <= 0) { D.decor(ctx, V, g, { night, time: t }); return; }
      this._sprBudget--;
      const b = this.decorBounds(g, V); const w = b[2] - b[0], h = b[3] - b[1];
      if (w <= 0 || h <= 0 || w * h > this.cv.width * this.cv.height * 0.9 || w > 6000 || h > 6000) { g._spr = { key, cv: null }; D.decor(ctx, V, g, { night, time: t }); return; }
      const cv = (S && S.cv && S.cv.width === w && S.cv.height === h) ? S.cv : mkCanvas(w, h); const g2 = cv.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, w, h);
      D.decor(g2, new JT.View(V.yaw, V.pitch, V.s, V.cx - b[0], V.cy - b[1], V.c), g, { night, time: t });
      g._spr = { key, cv, x: b[0], y: b[1], o };
      ctx.drawImage(cv, b[0], b[1]);
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
    drawLampPools(ctx, V, hab, lamps, night) {
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
        for (const sp of hab.spiders) if (M.finite3(sp.pos) && Math.abs(sp.pos[1] - y) < 3) { const l = JT.SpiderAI.len(sp); sh(sp.pos, l * 0.5, l * 0.6, 0.35); }
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
    postProcess(out, sc, night) {
      const W = this.cv.width, H = this.cv.height; const st = this.set;
      out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
      out.drawImage(sc, 0, 0);
      if (st.tilt || st.bloom) {
        const w4 = Math.max(8, W >> 2), h4 = Math.max(8, H >> 2), w8 = Math.max(4, W >> 3), h8 = Math.max(4, H >> 3);
        if (!this.b4 || this.b4.width !== w4 || this.b4.height !== h4) { this.b4 = mkCanvas(w4, h4); this.b8 = mkCanvas(w8, h8); this.bm = mkCanvas(w8, h8); this._tg = null; }
        const g4 = this.b4.getContext('2d'), g8 = this.b8.getContext('2d');
        g4.globalCompositeOperation = 'copy'; g4.drawImage(sc, 0, 0, w4, h4); g8.globalCompositeOperation = 'copy'; g8.drawImage(this.b4, 0, 0, w8, h8);
        out.imageSmoothingEnabled = true;
        if (st.tilt) {
          const m = this.bm.getContext('2d'); m.globalCompositeOperation = 'copy'; m.drawImage(this.b8, 0, 0);
          if (!this._tg) { const g = m.createLinearGradient(0, 0, 0, h8); g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.24, 'rgba(0,0,0,0)'); g.addColorStop(0.78, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); this._tg = g; }
          m.globalCompositeOperation = 'destination-in'; m.fillStyle = this._tg; m.fillRect(0, 0, w8, h8); m.globalCompositeOperation = 'source-over';
          out.drawImage(this.bm, 0, 0, W, H);
        }
        if (st.bloom) { out.globalCompositeOperation = 'screen'; out.globalAlpha = 0.13 + night * 0.08; out.drawImage(this.b8, 0, 0, W, H); out.globalAlpha = 1; out.globalCompositeOperation = 'source-over'; }
      }
      this.nightGrade(out, night);
      out.globalCompositeOperation = 'soft-light'; out.fillStyle = 'rgba(255,200,130,' + (0.12 * (1 - night)).toFixed(3) + ')'; out.fillRect(0, 0, W, H); out.globalCompositeOperation = 'source-over';
      const vkey = W + 'x' + H + Math.round(night * 10);
      if (this._vgk !== vkey) { const vg = out.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.58); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,0,' + (0.42 + night * 0.15).toFixed(2) + ')'); this._vg = vg; this._vgk = vkey; }
      out.fillStyle = this._vg; out.fillRect(0, 0, W, H);
      if (st.grain) {
        if (!this.noise) { this.noise = mkCanvas(128, 128); const g = this.noise.getContext('2d'); const id = g.createImageData(128, 128); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); this.noisePat = out.createPattern(this.noise, 'repeat'); }
        out.save(); out.globalAlpha = 0.04; out.globalCompositeOperation = 'overlay'; out.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0); out.fillStyle = this.noisePat; out.fillRect(-128, -128, W + 256, H + 256); out.restore();
      }
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
  function hexA(hex, a) { const v = parseInt(hex.slice(1), 16); return 'rgba(' + (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')'; }
  function blobShadow(ctx, V, pos, r, a) { const q = V.P(pos); const rx = Math.max(1, r * V.s); ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.beginPath(); ctx.ellipse(q[0], q[1], rx, rx * Math.max(0.25, V.sp), 0, 0, 6.283); ctx.fill(); }
  function selRing(ctx, V, fr, L, t) {
    const c = fr.p; const r = L * 0.95; ctx.save(); ctx.strokeStyle = 'rgba(232,196,110,' + (0.55 + 0.25 * Math.sin(t * 3)) + ')'; ctx.lineWidth = Math.max(1, V.s * 0.25); ctx.beginPath();
    for (let i = 0; i <= 28; i++) { const a = i / 28 * 6.283; const p = M.add(c, M.add(M.mul(fr.f, Math.cos(a) * r), M.mul(fr.s, Math.sin(a) * r))); const q = V.P(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.stroke(); ctx.restore();
  }
  JT.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
