/* Jumper Terrarium — renderer: camera rigs, frame loop (the GL painter draws the scene; a 2D overlay carries effects),
   picking, placement, thumbnails and portraits. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, G = JT.G, D = JT.Draw, sh = JT.shade;
  const CAMS = {
    iso: { yaw: 0.52, pitch: 0.66, label: 'Isometric' },
    observer: { yaw: 0, pitch: 0.4, label: 'Front' }, // the one overview camera: straight on to the front glass; drag orbits it (cam.oy / cam.op)
    follow: { yaw: 0.45, pitch: 0.5, label: 'Follow' },
    reverse: { yaw: Math.PI + 0.26, pitch: 0.5, label: 'Back' }, // the back of the tank, turned a little
    left: { yaw: 1.22, pitch: 0.44, label: 'Left' },   // 70° round from the front: the back wall still reads as a backdrop
    right: { yaw: -1.22, pitch: 0.44, label: 'Right' },
  };
  JT.CAMS = CAMS;
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }

  class Renderer {
    constructor(canvas, game, settings) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.game = game; this.set = settings;
      this.cam = { mode: 'observer', zoom: 1, pan: [0, 0], oy: 0, op: 0 };
      this.cur = null; // smoothed {yaw,pitch,scale,c}
      this.fx = []; this.particles = []; this.ghost = null; this.hover = null;
      this.bgCache = {}; this.thumbs = {}; this.portraits = {};
      this.fps = 60; this._autoLow = false; this._autoLvl = 0; this.targetFps = 60; this.time = 0;
      this.V = new JT.View(0.5, 0.6, 1, 0, 0, [0, 0, 0]);
      this.glc = root.document && root.document.getElementById('glview'); this.gp = null; this.initGL();
      this.resize();
    }
    get qualityScale() {
      const q = this.set.quality === 'auto' ? (this._autoLow ? 'low' : 'medium') : this.set.quality;
      const dpr = root.devicePixelRatio || 1;
      if (this.set.perf && this.set.ptLowRes) return 1;
      if (this.set.quality === 'auto' && this.closeCam) return Math.min(this._closeK || 1.6, [2, 1.75, 1.5, 1.25][this._autoLvl || 0], dpr); // Observe / Follow: 1.6x, steps down only, see render()
      if (this.set.quality === 'auto') return Math.min([2, 1.75, 1.5, 1.25][this._autoLvl || 0], dpr); // steps down only if the device struggles
      const m = q === 'low' ? 1.25 : q === 'high' ? 2.5 : 2; return Math.min(this.closeCam ? Math.min(m, 2) : m, dpr); // close-ups never above 2x
    }
    get quality() { return this.set.quality === 'auto' ? (this._autoLow ? 'low' : 'medium') : this.set.quality; }
    resize() {
      const r = this.cv.getBoundingClientRect(); const k = this.qualityScale;
      this.cssW = Math.max(50, r.width || root.innerWidth || 800); this.cssH = Math.max(50, r.height || root.innerHeight || 600);
      const w = Math.round(this.cssW * k), h = Math.round(this.cssH * k);
      if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; this.bgCache = {}; this._skPrev = null; }
      if (this.gp && (this.glc.width !== w || this.glc.height !== h)) { this.glc.width = w; this.glc.height = h; }
      this.k = k; this._cw = this.cv.clientWidth; this._ch = this.cv.clientHeight;
      // phone held sideways: the dock is a column on the left, so frame the tank in the space to its right
      const dock = root.document && root.document.getElementById('dock');
      const side = root.matchMedia && root.matchMedia('(max-height:500px) and (orientation:landscape)').matches;
      this.insetL = side && dock && !this.attract ? Math.max(0, Math.min(this.cssW * 0.4, dock.getBoundingClientRect().right)) : 0;
    }
    /** Forget every cached picture (after loading a different save). */
    resetCaches() { this._baseL = null; this._st = null; this._skPrev = null; this.bgCache = {}; this.motes = null; this._speck = null; this.cur = null; if (this.fcam) this.fcam.st = null; }
    /** The WebGL ink & watercolour painter (the only renderer). Without WebGL a short notice is shown instead. */
    initGL() {
      if (!this.gp && !this._glFail && this.glc && JT.GLPaint) { try { this.gp = new JT.GLPaint(this.glc, this); } catch (e) { console.warn('WebGL unavailable:', e && e.message); this._glFail = true; this.gp = null; } }
      if (this.glc) this.glc.style.display = this.gp ? 'block' : 'none';
      const doc = root.document; if (doc && doc.body) { doc.body.classList.add('story'); if (this._glFail && !doc.getElementById('noGL')) { const d = doc.createElement('div'); d.id = 'noGL'; d.textContent = 'Jumper Terrarium needs WebGL to draw the terrarium. Try another browser, or turn on hardware acceleration.'; doc.body.appendChild(d); } }
    }
    get storybook() { return !!this.gp; }
    setMode(m) { if (m !== 'follow') m = 'observer'; this.cam.mode = m; this.cam.zoom = 1; this.cam.pan = [0, 0]; }
    zoomBy(f, sx, sy) {
      if (this.cam.mode === 'follow' && this.fcam && this.fcam.st) { this.fcam.zoom(f); return; }
      const z0 = this.cam.zoom; const z = M.clamp(z0 * f, 0.6, 5); if (z === z0) return;
      if (sx != null) { const cx = (this.insetL || 0) + (this.cssW - (this.insetL || 0)) / 2 + this.cam.pan[0], cy = this.cssH / 2 + this.cam.pan[1]; const k = z / z0; this.cam.pan[0] += (sx - cx) * (1 - k); this.cam.pan[1] += (sy - cy) * (1 - k); }
      this.cam.zoom = z; this.clampPan();
    }
    panBy(dx, dy) {
      if (this.cam.mode === 'follow' && this.fcam && this.fcam.st) { this.fcam.orbit(dx * 0.0065, dy * 0.004); return; }
      this.cam.pan[0] += dx; this.cam.pan[1] += dy; this.clampPan(); }
    clampPan() { const lim = (0.35 + this.cam.zoom * 0.45); this.cam.pan[0] = M.clamp(this.cam.pan[0], -this.cssW * lim, this.cssW * lim); this.cam.pan[1] = M.clamp(this.cam.pan[1], -this.cssH * lim, this.cssH * lim); }
    resetView() { this.cam.zoom = 1; this.cam.pan = [0, 0]; this.cam.oy = 0; this.cam.op = 0; }
    /** Drag on the tank: swing the camera round it (sideways) and up / down over it. A back wall stops it at ±75°. */
    orbitBy(dx, dy) {
      if (this.cam.mode === 'follow') { this.panBy(dx, dy); return; }
      const c = this.cam; c.oy = M.wrapAngle((c.oy || 0) + dx * 0.0065); c.op = (c.op || 0) + dy * 0.004; this.clampOrbit(this.game && this.game.hab); }
    clampOrbit(hab) {
      const c = this.cam, P0 = CAMS.observer.pitch; c.op = M.clamp(c.op || 0, 0.06 - P0, 1.4 - P0);
      if (hab && hab.decor && hab.decor.some(d => (JT.DECOR_BY_ID[d.type] || {}).arche === 'backwall')) c.oy = M.clamp(c.oy || 0, -1.3, 1.3); }
    /** Looking straight at the front (no orbit, no zoom, no pan). */
    get straightFront() { const c = this.cam; return c.mode === 'observer' && Math.abs(c.oy || 0) < 0.01 && Math.abs(c.op || 0) < 0.01; }

    // ---------------- camera ----------------
    targetView(hab) {
      const dm = hab.dims; const C = CAMS[this.cam.mode] || CAMS.observer; const ob = this.cam.mode !== 'follow'; if (ob) this.clampOrbit(hab);
      let top = dm.h * 0.55; for (const id in hab.geoms) top = Math.max(top, hab.geoms[id].height + hab.geoms[id].baseY);
      top = Math.min(top, dm.h * 1.1);
      const pts = []; for (const x of [0, dm.w]) for (const z of [0, dm.d]) for (const y of [-12, top]) pts.push([x, y, z]);
      const c = [dm.w / 2, top * 0.38, dm.d / 2];
      const W = this.cssW, H = this.cssH; const portrait = H > W * 1.1;
      // tall screens: swing the camera round so the tank's long side runs up the screen ("tall setup")
      const yaw = C.yaw + (ob ? this.cam.oy || 0 : 0), pitch = C.pitch + (ob ? this.cam.op || 0 : 0);
      const tmp = new JT.View(yaw, pitch, 1, 0, 0, c);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of pts) { const q = tmp.P(p); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      const availH = H * (portrait ? 0.62 : 0.78), availW = (W - (this.insetL || 0)) * (portrait ? 0.94 : 0.88);
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
      const k = Math.min(1, dt * 5), kr = this.cam.mode === 'follow' ? k : Math.min(1, dt * 14), kc = Math.min(1, dt * (this.cam.mode === 'follow' ? 3 : 6));
      const cu = this.cur; let dy = M.wrapAngle(T.yaw - cu.yaw);
      cu.yaw += dy * kr; cu.pitch += (T.pitch - cu.pitch) * kr; cu.s += (T.s - cu.s) * k; cu.offY += (T.offY - cu.offY) * k;
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
      const il = this.insetL || 0; this.V.set(cu.yaw, cu.pitch, cu.s * kk, (il + (this.cssW - il) / 2 + this.cam.pan[0]) * kk, (this.cssH / 2 + this.cam.pan[1] + cu.offY + (this.attract ? -this.cssH * (this.cssH > this.cssW * 1.1 ? 0.12 : this.cssH < 520 ? 0.24 : 0.1) : this.cssH > this.cssW * 1.1 ? this.cssH * 0.045 : this.cssH * 0.02)) * kk, cu.c);
      return this.V;
    }
    /** CSS pixel -> world (x,z) at height y. */
    unproject(sx, sy, y) { return this.V.unproject(sx * this.k, sy * this.k, y); }
    project(p) { const q = this.V.P(p); return [q[0] / this.k, q[1] / this.k]; }


    floorPoly(hab) {
      const dm = hab.dims;
      if (dm.shape === 'circle') return G.circlePoly(dm.w / 2, dm.d / 2, dm.w / 2, dm.d / 2, 44);
      return [[0, 0], [dm.w, 0], [dm.w, dm.d], [0, dm.d]];
    }

    // ---------------- main render ----------------
    render(dt) {
      // the canvas must always match its on-screen box (after a rotation it can lag a frame or two behind)
      { const c = this.cv, cw = c.clientWidth, ch = c.clientHeight; if (cw !== this._cw || ch !== this._ch || (cw > 0 && (Math.abs(c.width - cw * this.k) > 2 || Math.abs(c.height - ch * this.k) > 2))) this.resize(); }
      this.time += dt; const game = this.game; const hab = game.hab; if (!hab) return;
      if (dt > 0) { this.fps = this.fps * 0.95 + (1 / Math.max(1e-3, dt)) * 0.05;
        // GPU-bound phones: settle once on a lighter resolution if the frame rate stays low
        // GPU-bound phones: step the resolution down (2x -> 1.6x -> 1.25x) if frames keep missing the current target rate
        const close = this.cam.mode === 'follow'; if (close !== !!this.closeCam) { this.closeCam = close; this._cSlow = 0; this._cFast = 0; this.fps = 60; this.resize(); }
        if (this.set.quality === 'auto' && close) { // close-up: 1.6x -> 1.4x -> 1.25x if frames keep missing; never steps back up
          // (every resolution change rebuilds the canvas = a visible hitch, so it moves rarely and only one way)
          const ck = this._closeK || 1.6; this._cHold = Math.max(0, (this._cHold || 0) - dt);
          this._cSlow = this.fps < this.targetFps * 0.8 ? (this._cSlow || 0) + dt : Math.max(0, (this._cSlow || 0) - dt * 0.5);
          if (this._cSlow > 2 && ck > 1.25 && !this._cHold) { this._closeK = Math.max(1.25, +(ck - 0.18).toFixed(2)); this._cSlow = 0; this._cHold = 3; this.fps = this.targetFps; this.resize(); }
        } else
        if (this.set.quality === 'auto') { this._slowT = this.fps < this.targetFps * 0.75 && this.time > 5 ? (this._slowT || 0) + dt : 0;
          if (this._slowT > 3 && (this._autoLvl || 0) < 3) { this._autoLvl = (this._autoLvl || 0) + 1; this._autoLow = this._autoLvl >= 3; this._slowT = -4; this._fastT = 0; this.fps = this.targetFps; this.resize(); }
          // v12: step back up (max twice per session) when a slowdown was only temporary
          this._fastT = this.fps >= this.targetFps * 0.97 && this._slowT >= 0 ? (this._fastT || 0) + dt : 0;
          if (this._fastT > 25 && (this._autoLvl || 0) > 0 && (this._ups || 0) < 2) { this._ups = (this._ups || 0) + 1; this._autoLvl--; this._autoLow = this._autoLvl >= 3; this._fastT = 0; this._slowT = -4; this.resize(); } } }
      this._dt = dt;
      const V = this.updateView(hab, dt);
      { const vk = V.yaw.toFixed(4) + ',' + V.pitch.toFixed(4) + ',' + V.s.toFixed(3) + ',' + V.c.map(v => v.toFixed(2)).join(','); this._moving = vk !== this._vk; this._vk = vk; }
      if (this.gp && !this.gp.lost) this.renderStory(V, hab, dt);
      if (this._cap) { const f = this._cap; this._cap = null; try { f(this.glc && this.gp && !this.gp.lost ? this.glc : null, this.cv); } catch (e) { console.error('photo', e); } } // v11 photo: read the frame in the same task it was drawn
    }
    /** Storybook frame: the GPU paints the scene; the 2D canvas on top only carries effects, labels and edit outlines. */
    renderStory(V, hab, dt) {
      JT.SKY.update(this.game); const night = Math.max(1 - this.game.daylight(), JT.Biome ? 0.9 * (JT.Biome.of(hab).dusk || 0) : 0); const lamps = hab.lampsOn ? hab.lampsOn() : [];
      const pt = this.pt || (this.pt = { col: 0, spr: 0, up: 0, gl: 0, ov: 0 }), em = (k, v) => { pt[k] = pt[k] * 0.9 + v * 0.1; }; let t0 = performance.now();
      const scene = this.collectScene(V, hab, night); em('col', performance.now() - t0); t0 = performance.now(); this._sprT = 0; this._upT = 0;
      try { this.gp.frame(V, hab, night, lamps, scene); } catch (e) { if ((this._glErr = (this._glErr || 0) + 1) < 5) console.error('storybook frame', e); }
      em('spr', this._sprT); em('up', this._upT); em('gl', performance.now() - t0 - this._sprT - this._upT); t0 = performance.now();
      const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, this.cv.width, this.cv.height);
      if (this.ghost && this.ghost.geom) this.drawGhostFoot(ctx, V, this.ghost);
      if (this.hover && this.hover.kind === 'decor') { const g = hab.geoms[this.hover.ent.id]; if (g) this.outlineDecor(ctx, V, g, 'rgba(200,70,50,0.9)'); }
      if (this.set.perf && this.set.ptNoFx) return;
      this.drawEffects(ctx, V, hab, dt);
      try { if (this.drawBiome && JT.Biome) this.drawBiome(ctx, V, hab, dt, night, JT.Biome.of(hab)); } catch (e) { if (!this._biomeError) { this._biomeError = true; console.error('biome effects', e); } }
      if (lamps.length) this.drawLampGlow(ctx, V, hab, lamps, night);
      if (night > 0.3) for (const sp of hab.spiders) { const S = JT.SPECIES_BY_ID[sp.species]; if (!S || !S.glow) continue; // Ignicard: ember speckles glow at night
        const L = JT.SpiderAI.len(sp); const P = V.P([sp.pos[0], sp.pos[1] + L * 0.25, sp.pos[2]]); const r = Math.max(5 * this.k, L * V.s * 0.75); if (!isFinite(P[0]) || r > 900) continue;
        const a = (night - 0.3) * 0.5 * (0.85 + 0.15 * Math.sin(this.time * 2.3 + (sp.seed || 0)));
        const gr = ctx.createRadialGradient(P[0], P[1], 0, P[0], P[1], r); gr.addColorStop(0, 'rgba(255,150,60,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(P[0] - r, P[1] - r, r * 2, r * 2); ctx.restore(); }
      if (this.set.debug) this.drawDebug(ctx, V, hab);
      em('ov', performance.now() - t0);
    }
    drawGhostFoot(ctx, V, gh) {
      const g = gh.geom; if (!g.foot) return; const col = gh.ok ? 'rgba(70,150,80,' : 'rgba(200,60,50,'; ctx.save(); ctx.beginPath();
      g.foot.forEach((q, i) => { const s = V.P([q[0], g.baseY + 0.2, q[1]]); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath();
      ctx.fillStyle = col + '0.18)'; ctx.fill(); ctx.strokeStyle = col + '0.9)'; ctx.lineWidth = 2 * this.k; ctx.setLineDash([6 * this.k, 4 * this.k]); ctx.stroke(); ctx.restore();
    }
    /** Everything that moves (critters, remains, drops, leaves, nests, silk) as sprite/line items for the GL painter. */
    collectScene(V, hab, night) {
      let ctx = null;
      const items = [];
      // v27.2: shadow on the ground below a perched / airborne critter (support lookup cached per critter, refreshed ~4x a second)
      const dropItem = (e, fr, L, kind, alpha, held) => { const c = fr.p; if (!M.finite3(c)) return; const now = hab.time || 0; let b = e._shB;
        if (!b || Math.abs(now - b.t) > 0.25 || Math.abs(b.x - c[0]) + Math.abs(b.z - c[2]) > 1.5 || Math.abs(b.y - c[1]) > 2) { const sb = JT.Nav.supportBelow(hab, [c[0], c[1] - 0.5, c[2]]); b = e._shB = { t: now, x: c[0], y: c[1], z: c[2], gy: sb.pos[1] }; }
        const gy = b.gy; if (c[1] - gy < L * 0.3) return; const q = D.critter.dropAt(hab, c, gy); const fr2 = { f: fr.f, s: fr.s };
        items.push({ d: V.depth(q) + 0.03, f: () => D.critter.dropShadow(ctx, V, hab, c, gy, fr2.f, fr2.s, L, kind, alpha, held), p: q, r: L * 1.7 + 2 + (held || 0), ground: true }); };
      const follow = this.cam.mode === 'follow'; const fsp = follow ? (hab.spider(this.game.selectedId) || hab.spiders[0]) : null;
      const tgtId = fsp && fsp.target && fsp.target.kind === 'prey' ? fsp.target.id : null; /* the prey it is stalking */ const t = this.time; const geoms = hab.geoms; const sel = this.game.selectedId;
      const decDepth = {};
      // ground-layer decor first (moss, leaf litter, pebbles) + shadows
      const W = this.cv.width, H = this.cv.height, mg = 90 * this.k;
      const vis = (pos) => { const q = V.P(pos); return q[0] > -mg && q[0] < W + mg && q[1] > -mg && q[1] < H + mg; };
      const onScreen = (pos) => { const q = V.P(pos); return q[0] > -mg && q[0] < W + mg && q[1] > -mg && q[1] < H + mg; };
      for (const inst of hab.decor) {
        const g = geoms[inst.id]; if (!g) continue;
        const sway = inst._sw ? [inst._sw.x, 0, inst._sw.z] : null;
        if (g.def.cat === 'ground' && !inst.parent) { decDepth[inst.id] = 1e9; continue; } // drawn in the cached base layer
        const c = g.foot ? G.centroid(g.foot) : [inst.x, inst.z];
        const dep = V.depth([c[0], g.baseY + Math.min(10, g.height * 0.25), c[1]]);
        decDepth[inst.id] = dep;
      }
      const animalDepth = (e) => { let d = V.depth(e.pos); if (e.sup && e.sup.d && decDepth[e.sup.d] != null && decDepth[e.sup.d] < 1e8) d = Math.min(d, decDepth[e.sup.d] - 0.05); return d; };
      for (const r of hab.data.remains) { if (!M.finite3(r.pos)) continue; let fr = D.frame(hab, r, 0.1);
        if (r._fall && M.finite3(r._fall.from)) { const u = M.clamp(r._fall.t / r._fall.dur, 0, 1); const e2 = u * u; const a = r.ang || 0; fr = { p: M.lerp3(M.add(r._fall.from, [0, 0.1, 0]), fr.p, e2), f: M.norm([Math.cos(a), 0.4 * Math.sin(u * 9), Math.sin(a)]), s: M.norm([-Math.sin(a), 0, Math.cos(a)]), n: [0, 1, 0] }; fr.n = M.norm(M.cross(fr.f, fr.s)); if (fr.n[1] < 0) fr.n = M.mul(fr.n, -1); } items.push({ key: r.id != null ? 'r' + r.id : null, d: animalDepth(r) + 0.02, f: () => D.remains(ctx, V, r, fr, {}), p: r.pos, r: ((JT.PREY_BY_ID[r.type] || { len: 3 }).len || 3) * 1.3 + 2 }); }
      for (const w of hab.data.drops) { if (!M.finite3(w.pos)) continue; const fr = JT.Nav.supFrame(hab, w.sup); const pos = M.add(w.pos, M.mul(fr.n, (fr.r || 0) + 0.3)); items.push({ d: animalDepth(w) + 0.01, f: () => D.drop(ctx, V, w, pos), p: pos, r: (w.r || 0.6) * 2 + 1, noGL: !!w.pool }); } // v15: mist pools are painted on the ground by the GL painter
      for (const p of hab.prey) {
        if (p.owner || p.buried || !M.finite3(p.pos) || !onScreen(p.pos)) continue; const def = JT.PREY_BY_ID[p.type]; if (!def) continue;
        const pd = animalDepth(p); const drawP = () => { let fr = D.frame(hab, p, 0.05); const wk = JT.PreyAI.weakK ? JT.PreyAI.weakK(p) : 0; const L0 = def.len || 3;
          if (p._flip && p.state === 'twitch') { // knocked onto its back, legs pedalling
            const w = Math.sin(t * 9 + (p.seed || 0)) * 0.25; const c = Math.cos(Math.PI + w), si = Math.sin(Math.PI + w);
            const s2 = M.add(M.mul(fr.s, c), M.mul(fr.n, si)), n2 = M.sub(M.mul(fr.n, c), M.mul(fr.s, si));
            fr = { p: M.add(fr.p, M.mul(fr.n, L0 * 0.3)), f: fr.f, s: s2, n: n2 };
            D.prey(ctx, V, p, fr, { time: t, held: true, flail: 0.45 + 0.35 * Math.abs(Math.sin(t * 5 + (p.seed || 0))), noShadow: false }); return; }
          if (wk > 0.04 && p.sup && p.sup.k !== 'air') { const w = Math.sin(t * 3.1 + (p.seed || 0)) * 0.22 * wk; const c = Math.cos(w), si = Math.sin(w); fr = { p: fr.p, f: fr.f, s: M.add(M.mul(fr.s, c), M.mul(fr.n, si)), n: M.sub(M.mul(fr.n, c), M.mul(fr.s, si)) }; }
          D.prey(ctx, V, p, fr, { time: t, perch: !!(p.sup && p.sup.k === 'path' && (JT.Nav.supFrame(hab, p.sup).r || 0) < L0 * 0.7) }); };
        items.push({ key: 'p' + p.id, d: pd, f: drawP, p: p.pos, r: (def.len || 3) * 1.5 + 1.5, xr: !!(tgtId && p.id === tgtId), bias: p.sup && p.sup.k !== 'floor' && p.sup.k !== 'air' ? (def.len || 3) * 0.85 : (def.len || 3) * 0.3 });
        if (p.sup && (p.sup.k === 'air' || p.sup.k === 'path')) dropItem(p, D.frame(hab, p, 0.05), def.len || 3, 'prey', p.sup.k === 'air' ? 0.75 : 1, 0);
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
          let sD = M.norm(M.cross(nD, fD));
          if (dOff.slip) { // swinging pendulum + slow spin on the dragline
            const sw = dOff.depth * 0.1 * down * (0.5 + (sp._strug || 0)); pos[0] += Math.sin(this.time * 2.3) * sw; pos[2] += Math.cos(this.time * 1.7) * sw * 0.7;
            const a = this.time * 1.4 + Math.sin(this.time * 0.8) * 1.5; const ca = Math.cos(a), sa = Math.sin(a);
            const rot = (v) => [v[0] * ca - v[2] * sa, v[1], v[0] * sa + v[2] * ca]; const nR = M.norm(rot(nD)); sD = M.norm(M.cross(nR, fD));
          }
          fr = { p: pos, f: fD, s: sD, n: M.norm(M.cross(fD, sD)) }; hang = down;
        }
        if ((sp._strug || 0) > 0.02 && sp.state === 'subdue') { // braced against a thrashing meal: shaken and twisted
          const k = sp._strug, T = this.time; const j = L * 0.035 * k;
          const yaw = (Math.sin(T * 17) * 0.6 + Math.sin(T * 31 + 2) * 0.4) * 0.22 * k; const c = Math.cos(yaw), si = Math.sin(yaw);
          const f2 = M.norm(M.add(M.mul(fr.f, c), M.mul(fr.s, si))); const s2 = M.norm(M.cross(fr.n, f2));
          fr = { p: M.add(fr.p, M.add(M.mul(fr.s, Math.sin(T * 37) * j), M.mul(fr.f, Math.sin(T * 23 + 1) * j * 0.7))), f: f2, s: s2, n: fr.n };
        }
        if (sp._pz && !sp._air && (sp.state === 'subdue' || sp.state === 'secure' || sp.state === 'shaken' || Math.abs(sp._pz.r) + Math.abs(sp._pz.p) + sp._pz.l > 0.02)) { // wrestling pose: roll about the body axis, pitch, lift
          const P = sp._pz; const up = fr.n; const cr = Math.cos(P.r), sr = Math.sin(P.r), cp = Math.cos(P.p), spp = Math.sin(P.p);
          const s1 = M.add(M.mul(fr.s, cr), M.mul(fr.n, sr)), n1 = M.sub(M.mul(fr.n, cr), M.mul(fr.s, sr));
          const f2 = M.add(M.mul(fr.f, cp), M.mul(n1, spp)), n2 = M.sub(M.mul(n1, cp), M.mul(fr.f, spp));
          const lift = P.l * L * 0.35 + (1 - cr) * 0.5 * L * 0.45 + Math.max(0, spp) * L * 0.12;
          fr = { p: M.add(fr.p, M.mul(up, lift)), f: M.norm(f2), s: M.norm(s1), n: M.norm(n2) };
        }
        if (sp.hold && (sp.state === 'subdue' || sp.state === 'secure') && (sp._catchRatio || 0) > 1.1) { const hp0 = hab.preyById(sp.hold); const fam = hp0 ? JT.preyFamily(JT.PREY_BY_ID[hp0.type] || {}) : '';
          if (hp0 && fam !== 'beetle' && fam !== 'jumper') fr = { p: M.add(fr.p, M.mul(fr.n, L * 0.16 * Math.min(1.6, sp._catchRatio))), f: fr.f, s: fr.s, n: fr.n }; } // astride a big catch
        if (sp.state === 'pounce' && sp._air && sp._air.straight) { // body points along the straight strike line
          const A = sp._air; const dir = M.sub(A.to, A.from); const dl = M.len(dir);
          if (dl > 1e-3) { const u = M.mul(dir, 1 / dl); const hz = Math.hypot(u[0], u[2]); const pitch = M.clamp(Math.atan2(u[1], hz), -1.0, 1.0);
            const fh = M.norm([fr.f[0], 0, fr.f[2]]); const f2 = M.norm([fh[0] * Math.cos(pitch), Math.sin(pitch), fh[2] * Math.cos(pitch)]); const s2 = M.norm(M.cross([0, 1, 0], f2)); fr = { p: fr.p, f: f2, s: s2, n: M.norm(M.cross(f2, s2)) }; }
        }
        const ventral = M.dot(fr.n, V.toCam) < -0.08;
        let d = animalDepth(sp); if (ventral && sp.sup && sp.sup.d && decDepth[sp.sup.d] != null) d = decDepth[sp.sup.d] + 0.05;
        const air = !!sp._air || (sp.sup && sp.sup.k === 'air');
        // v27.2: perched on a stem / leaf edge -> no oval on the plant, the shadow drops to the ground below instead
        const sfP = !air && sp.sup && sp.sup.k === 'path' ? JT.Nav.supFrame(hab, sp.sup) : null; const perch = !!sfP && (sfP.r || 0) < L * 0.7;
        const hpS = sp.hold ? hab.preyById(sp.hold) : null; const heldLen = hpS ? Math.min(hpS.len || (JT.PREY_BY_ID[hpS.type] || {}).len || 3, L * 1.6) : 0;
        const draw = (alpha, xr) => {
          const hp = sp.hold ? hab.preyById(sp.hold) : null;
          let hug = null;
          if (hp && (sp._hug || 0) > 0.01) { const hd = JT.PREY_BY_ID[hp.type] || { len: 3 }; const base = Math.min(hp.len || hd.len, L * 1.1); const full = hp.full != null ? hp.full : 1; hug = { k: sp._hug, pl: base * (0.6 + 0.4 * full), big: base >= L * 0.6 ? 1 : 0 }; }
          D.spider(ctx, V, sp, fr, { len: L, airborne: air, time: t, alpha, tucked: !!sp.nest && JT.SpiderAI.NEST_STATES.has(sp.state) && !(hab.data.nests || []).some(n => n.id === sp.nest && (n.build || (n.hole && n.hole.exit > 0.05))), spin: (hab.data.nests || []).some(n => n.id === sp.nest && n.build && n.owner === sp.id && JT.SpiderAI.NEST_STATES.has(sp.state)), lookCam: sp._lc > 0.02 ? sp._lc : 0, tilt: sp._tilt, hang, hug, grip: air ? null : D.gripFor(hab, sp, L), noShadow: xr || hang > 0.2, perch, heldLen, heldCross: !!(hpS && JT.MANTIS_LONG && JT.MANTIS_LONG.has && JT.MANTIS_LONG.has(hpS.type)), meal: hp ? (mp, fg, sg, n) => this.drawHeld(ctx, V, sp, hp, mp, fg, sg, n, L) : null });
        };
        if (hangA) { const fp = fr.p, fff = fr.f; items.push({ ln: { a: hangA, b: M.sub(fp, M.mul(fff, L * 0.32)), w: 0.08, al: 0.45 - night * 0.15 }, d: d + 0.01, f: () => { const a = V.P(hangA), b = V.P(M.sub(fp, M.mul(fff, L * 0.32))); ctx.strokeStyle = 'rgba(240,240,250,' + (0.45 - night * 0.15).toFixed(2) + ')'; ctx.lineWidth = Math.max(0.5, V.s * 0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }); d = V.depth(fr.p); }
        // live safety dragline paid out behind a jump (it whips out behind a pounce, settling straight)
        if (air && sp._anchor && M.finite3(sp._anchor) && !JT.SpiderAI.NO_SILK) { const an = sp._anchor, sp2 = fr.p; const pz = sp.state === 'pounce' && sp._air ? 1 - M.clamp(sp._air.t, 0, 1) : 0; const al = 0.32 - night * 0.1 + pz * 0.15;
          const segs = []; if (pz > 0.02) { const dv = M.sub(sp2, an); const dl = M.len(dv) || 1; let side = M.cross(dv, [0, 1, 0]); if (M.len(side) < 1e-3) side = [1, 0, 0]; side = M.norm(side); const w = Math.sin(this.time * 55) * dl * 0.09 * pz;
            const mid = M.add(M.lerp3(an, sp2, 0.5), M.add(M.mul(side, w), [0, -dl * 0.04 * pz, 0])); segs.push([an, mid], [mid, sp2]); } else segs.push([an, sp2]);
          for (const [a0, b0] of segs) items.push({ ln: { a: a0, b: b0, w: 0.07, al }, d: V.depth(M.lerp3(a0, b0, 0.5)) - 0.05, f: () => { const a = V.P(a0), b = V.P(b0); ctx.strokeStyle = 'rgba(240,240,250,' + al.toFixed(2) + ')'; ctx.lineWidth = Math.max(0.5, V.s * 0.07); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }); }
        // motion smear: a fading after-image along the strike line
        if (sp.state === 'pounce' && sp._air && sp._air.straight && M.finite3(sp._air.from)) { const A = sp._air; const back = M.sub(A.from, fr.p); const bl = M.len(back);
          if (bl > L * 0.6) { for (const [k, al] of [[0.35, 0.28], [0.7, 0.14]]) { const g0 = M.add(fr.p, M.mul(back, Math.min(k, L * 2.2 * k / bl))); const gf = { p: g0, f: fr.f, s: fr.s, n: fr.n };
            items.push({ d: V.depth(g0) + 0.02, f: () => D.spider(ctx, V, sp, gf, { len: L, airborne: true, time: t, alpha: al, noShadow: true }), p: g0, r: L * 1.5 }); }
            const fp0 = fr.p; const smP = M.add(fp0, M.mul(back, Math.min(0.5, L * 1.5 / bl))); items.push({ d: V.depth(fp0) + 0.03, f: () => { const a = V.P(fp0), b = V.P(M.add(fp0, M.mul(back, Math.min(1, L * 3 / bl)))); const gr = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = gr; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, L * V.s * 0.5); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }, p: smP, r: L * 2.2 }); } }
        // inside its retreat the jumper fades from view as the silk thickens (only a glint at the doorway remains)
        const nst = sp.nest && JT.SpiderAI.NEST_STATES.has(sp.state) ? (hab.data.nests || []).find(n => n.id === sp.nest) : null;
        let hideK = 0; if (nst) { hideK = M.smooth(M.clamp((nst.prog - 0.3) / 0.6, 0, 1)); if (sp.state === 'emerge' && nst.hole) hideK *= 1 - M.smooth(M.clamp((nst.hole.exit || 0) * 1.4, 0, 1)); }
        const bodyA = 1 - hideK;
        if (bodyA > 0.01) items.push({ key: 's' + sp.id, hot: sp.id === sel, d, f: () => draw(bodyA), p: fr.p, r: L * 1.7 + 1, xr: follow && sp === fsp, bias: !air && sp.sup && sp.sup.k !== 'floor' && sp.sup.k !== 'air' ? L * 0.85 : L * 0.25 });
        if ((air || perch || hang > 0.2) && bodyA > 0.3) dropItem(sp, fr, L, JT.MANTIS_ARM ? 'mantis' : 'spider', bodyA, heldLen);
      }
      for (const lf of (hab._leaves || [])) { if (!M.finite3(lf.pos) || !onScreen(lf.pos)) continue; items.push({ d: V.depth(lf.pos) - 0.02, f: () => D.leafBit(ctx, V, lf), p: lf.pos, r: 3 }); }
      for (const n of (hab.data.nests || [])) { if (!M.finite3(n.pos) || !vis(n.pos)) continue; const up = (JT.Nav.validSup(hab, n.sup) ? JT.Nav.supFrame(hab, n.sup).n : [0, 1, 0]) || [0, 1, 0];
        const L = n.len || 6, own = n.owner && hab.spider(n.owner); const inside = own && own.nest === n.id && JT.SpiderAI.NEST_STATES.has(own.state);
        const SP = own && (JT.SPECIES_BY_ID[own.species] || {}); const info = { time: t, glint: inside ? 1 - M.clamp(((n.hole && n.hole.exit) || 0) * 3, 0, 1) : 0, ceph: SP && SP.pal ? SP.pal.ceph : null, eye: SP && SP.look && SP.look.eyeCol ? SP.look.eyeCol : null };
        const back = M.sub(n.pos, M.mul(V.toCam, L * 0.9)), front = M.add(n.pos, M.mul(V.toCam, L * 0.9)); // pure depth offsets: same place on screen, behind / in front of the jumper
        items.push({ d: V.depth(n.pos) + L * 0.7, f: () => D.nest(ctx, V, n, up, night, 'back', info), p: back, r: L * 1.3 + 3, bias: 0 });
        items.push({ d: V.depth(n.pos) - L * 0.7, f: () => D.nest(ctx, V, n, up, night, 'front', info), p: front, r: L * 1.3 + 3, bias: 0 }); }
      for (const k of hab.data.silk) items.push({ silk: k, d: V.depth(M.lerp3(k.a, k.b, 0.5)) - 0.1, f: () => D.silk(ctx, V, k, night) });
      return { items, run: (it, c2, v2) => { const k0 = ctx, v0 = V; ctx = c2; V = v2; try { it.f(); } finally { ctx = k0; V = v0; } } };
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
      const st = sp.state === 'subdue' ? Math.max(p._struggle || 0, 0.15) : sp.state === 'secure' ? (p._struggle || 0) : 0; const T = this.time;
      const fam = JT.preyFamily(def); const rr = sp._catchRatio || 0; const wrestle = (sp.state === 'subdue' || sp.state === 'secure') && rr > 1.1;
      if (fam === 'moth' && st > 0.2 && JT.R() < st * 0.25 && this.particles.length < 400) this.particles.push({ pos: mp.slice(), v: [(JT.R() - 0.5) * 6, 1 + JT.R() * 3, (JT.R() - 0.5) * 6], t: 0, life: 1 + JT.R(), col: 'rgba(225,205,165,0.75)', r: 0.12 + JT.R() * 0.12 }); // wing scales shed in the struggle
      const jit = st ? (Math.sin(T * 41) + Math.sin(T * 67 + 1.3) * 0.6) * L * (0.008 + 0.03 * st) : 0;
      const tw = st ? Math.sin(T * 29 + 0.7) * 0.32 * st : 0; // twist in the fangs
      const full = p.full != null ? p.full : 1;
      const pl = Math.min(p.len || def.len, L * 1.1) * (0.6 + 0.4 * full);
      // prey body lies along the spider's facing, its rear end pushed outward from the fangs
      const c = Math.cos(tw), si = Math.sin(tw); const f2 = M.add(M.mul(fg, -c), M.mul(sg, -si)), s2 = M.add(M.mul(sg, -c), M.mul(fg, si));
      let base = M.add(mp, M.mul(fg, pl * 0.25));
      if (wrestle) { if (fam === 'beetle' || fam === 'jumper') base = M.add(M.add(mp, M.mul(sg, pl * 0.32)), M.mul(fg, -pl * 0.1)); // clamped alongside a hard / fighting body
        else base = M.add(M.add(mp, M.mul(n, -L * 0.22 * Math.min(1.6, rr))), M.mul(fg, -pl * 0.18)); } // the jumper rides on top of its huge catch
      const pf = { p: M.add(base, M.add(M.mul(sg, jit), M.mul(n, jit * 0.5))), f: f2, s: s2, n };
      D.prey(ctx, V, p, pf, { held: true, curled: st < 0.15, flail: st, len: pl, time: T, alpha: 0.55 + 0.45 * full });
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

    // ---------------- basking lamp light ----------------
    lampSurface(hab, L) {
      const k = L.inst.id + '|' + hab._geomVersion; L.inst._ls = L.inst._ls && L.inst._ls.k === k ? L.inst._ls : { k, y: JT.Nav.supportBelow(hab, [L.pool[0], L.head[1] - 3, L.pool[2]]).pos[1] };
      return L.inst._ls.y;
    }
    /** Additive bulb glow and lit highlights on the overlay canvas. */
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
      const t = this.time; ctx.fillStyle = '#fff3c8'; const hdM = !!(JT.HD2D && JT.HD2D._was && JT.HD2D._was !== 'off'); if (hdM && JT.HD2D.toon && !JT.HD2D.cup) return;
      for (let mi = 0; mi < this.motes.p.length; mi++) { if (hdM && mi % 3) continue; const m = this.motes.p[mi];
        const x = m[0] + Math.sin(t * 0.13 + m[3]) * 6, y = m[1] + Math.sin(t * 0.09 + m[3] * 2) * 4, z = m[2] + Math.cos(t * 0.11 + m[3]) * 5;
        const q = V.P([x, y, z]); const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + m[3] * 3);
        ctx.globalAlpha = day * (0.18 + 0.4 * tw) * m[4] * (hdM ? 0.6 : 1); const r = Math.max(0.6 * this.k, m[4] * 0.45 * V.s);
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
        const sz = (f.big ? 16 : 12.5) * this.k * (1 + Math.max(0, 0.25 - f.t) * 1.2);
        ctx.font = '600 ' + sz.toFixed(0) + 'px Georgia, "Times New Roman", serif'; ctx.globalAlpha = a;
        const k = this.k, hw = ctx.measureText(f.text).width / 2 + 4 * k; let x = q[0], y = q[1];
        for (const r of this.hudRects || []) { // keep floating text off panels, pills and bars
          const x0 = r[0] * k, y0 = r[1] * k, x1 = r[2] * k, y1 = r[3] * k; if (x + hw < x0 || x - hw > x1 || y < y0 - 2 * k || y - sz > y1 + 2 * k) continue;
          const up = y0 - 4 * k, dn = y1 + sz + 4 * k; y = up > sz && (y - up < dn - y || dn > this.cv.height) ? up : dn; }
        ctx.lineWidth = 3 * k; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(30,18,8,0.8)'; ctx.strokeText(f.text, x, y); ctx.fillStyle = f.col; ctx.fillText(f.text, x, y);
      }
      this.fx = this.fx.filter(f => f.t < f.life); ctx.globalAlpha = 1;
    }


    // ---------------- picking ----------------
    /** sx, sy in CSS pixels. Animals take priority, then remains/drops/silk, then decor. */
    pick(sx, sy, opts) {
      opts = opts || {}; const hab = this.game.hab; const V = this.V; const X = sx * this.k, Y = sy * this.k;
      let best = null, bd = 1e9;
      const TRp = JT.Terrain, terP = TRp ? TRp.get(hab) : null; const test = (e, kind, rad) => { if (!e.pos || !M.finite3(e.pos)) return; const q = V.P(terP ? TRp.liftWith(terP, e.pos) : e.pos); const d = Math.hypot(q[0] - X, q[1] - Y); const r = Math.max((opts.touch ? 34 : 16) * this.k, rad * V.s * (opts.touch ? 1.3 : 1)); if (d < r && d / r < bd) { bd = d / r; best = { kind, ent: e }; } };
      for (const sp of hab.spiders) test(sp, 'spider', JT.SpiderAI.len(sp) * 1.1);
      if (best) return best;
      if (!opts.noPrey) for (const p of hab.prey) if (!p.owner && !p.buried) test(p, 'prey', (JT.PREY_BY_ID[p.type] || { len: 3 }).len * 1.2);
      if (best) return best;
      bd = 1e9; for (const r of hab.data.remains) test(r, 'remains', 4);
      if (best) return best;
      bd = 1e9; let bdep = 1e9; const tol = (opts.touch ? 12 : 6) * this.k;
      const edgeDist = (x, y, P) => { let m = 1e9; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const ex = b[0] - a[0], ey = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1))); m = Math.min(m, Math.hypot(a[0] + ex * t - x, a[1] + ey * t - y)); } return m; };
      for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (!g) continue; const hull = this.decorScreenHull(g, V); if (hull && (G.pointInPoly(X, Y, hull) || edgeDist(X, Y, hull) < tol)) { const c = g.foot ? G.centroid(g.foot) : [inst.x, inst.z]; const dep = V.depth([c[0], g.baseY, c[1]]) - g.baseY * 0.5 - (inst.parent ? 5 : 0); const area = Math.abs(G.polyArea(hull)); const score = dep * 0.2 + Math.sqrt(area) * 0.3; if (score < bdep) { bdep = score; best = { kind: 'decor', ent: inst }; } } }
      return best;
    }
    /** Where a fingertip on the glass "is" in the tank: the highest surface under it (else the floor), clamped inside. */
    fingerPoint(sx, sy, hab) {
      const D = hab.dims; let best = null;
      for (const id in hab.geoms) { const g = hab.geoms[id]; for (const t of g.tops || []) { if (best && t.y <= best[1]) continue; const xz = this.unproject(sx, sy, t.y); if (G.pointInPoly(xz[0], xz[1], t.poly)) best = [xz[0], t.y, xz[1]]; } }
      if (!best) { const xz = this.unproject(sx, sy, 0); best = [xz[0], 0, xz[1]]; }
      if (!M.finite3(best)) return null;
      return [M.clamp(best[0], 1, D.w - 1), best[1] + 2, M.clamp(best[2], 1, D.d - 1)];
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
    thumbKey(type, rot, size, look) { return type + '|' + (rot || 0) + '|' + (size || 112) + (look ? '|' + look.style + look.cols.side : ''); }
    hasThumb(type, rot, size, look) { return !!this.thumbs[this.thumbKey(type, rot, size, look)]; }
    decorThumb(type, rot, size, look) {
      size = size || 112; const key = this.thumbKey(type, rot, size, look); if (this.thumbs[key]) return this.thumbs[key];
      const c = mkCanvas(size, size); const ctx = c.getContext('2d');
      try {
        const g = JT.Geo.build({ id: 'thumb_' + type, type, x: 0, z: 0, rot: rot || 0, seed: 1 }, 0, 160, look);
        const V = new JT.View(0.52, 0.62, 1, 0, 0, [0, 0, 0]);
        const pts = []; const hull = this.decorScreenHull(g, V) || [[-1, -1], [1, 1]]; for (const q of hull) pts.push(q);
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
        const s = Math.min(size * 0.84 / Math.max(1, x1 - x0), size * 0.84 / Math.max(1, y1 - y0));
        V.set(0.52, 0.62, s, size / 2 - (x0 + x1) / 2 * s, size / 2 - (y0 + y1) / 2 * s, [0, 0, 0]);
        const gc = G.centroid(g.foot || [[0, 0]]); const q = V.P([gc[0], g.baseY, gc[1]]); const rr = Math.max(8, Math.sqrt(Math.abs(G.polyArea(g.foot || [[0, 0], [1, 0], [0, 1]]))) * V.s * 0.75);
        const sg = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr); sg.addColorStop(0, 'rgba(60,40,20,0.28)'); sg.addColorStop(1, 'rgba(60,40,20,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(q[0], q[1], rr, rr * 0.5, 0, 0, 6.283); ctx.fill();
        const art = this.gp && JT.withBaseLight(() => this.gp.thumb(g, V, size));
        // v17: the card's drop shadow is painted in once (a CSS drop-shadow on every card made the shop strip slow to scroll)
        if (art) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.42)'; ctx.shadowBlur = 7 * size / 112; ctx.shadowOffsetY = 4 * size / 112; ctx.drawImage(art, 0, 0); ctx.restore(); c._baked = true; if (JT.ThumbDB) JT.ThumbDB.save(key, c); }
      } catch (e) { if (JT.DEV) console.warn(e); }
      this.thumbs[key] = c; return c;
    }
    speciesPortrait(id, size) {
      size = size || 120; const key = id + '|' + size; if (this.portraits[key]) return this.portraits[key];
      const c = mkCanvas(size, size); const ctx = c.getContext('2d'); const V = new JT.View(0.9, 0.85, size / 16, size / 2, size * 0.58, [0, 0, 0]);
      const sp = { species: id, state: 'idle', _walk: 0, _moving: false, _crouch: 0, _legRaise: 0.3, seed: 1, sat: 0.6 };
      try { JT.withBaseLight(() => D.spider(ctx, V, sp, { p: [0, 0, 0], f: M.norm([-0.5, 0, 0.8]), s: M.norm([0.8, 0, 0.5]), n: [0, 1, 0] }, { len: 10, time: 0, thumb: true })); } catch (e) { if (JT.DEV) console.warn(e); }
      this.portraits[key] = c; return c;
    }
    preyPortrait(id, size) {
      size = size || 96; const key = 'prey|' + id + '|' + size; if (this.portraits[key]) return this.portraits[key];
      const d = JT.PREY_BY_ID[id]; const c = mkCanvas(size, size); const ctx = c.getContext('2d');
      const V = new JT.View(0.9, 0.8, size / (Math.max(3, d.len) * 1.9), size / 2, size * 0.6, [0, 0, 0]);
      try { JT.withBaseLight(() => D.prey(ctx, V, { type: id, sup: { k: 'floor' }, seed: 1, _anim: 0, species: 'zebra' }, { p: [0, 0, 0], f: M.norm([-0.5, 0, 0.8]), s: M.norm([0.8, 0, 0.5]), n: [0, 1, 0] }, { time: 0 })); } catch (e) { if (JT.DEV) console.warn(e); }
      this.portraits[key] = c; return c;
    }
  }

  function blobShadow(ctx, V, pos, r, a) { const q = V.P(pos); const rx = Math.max(1, r * V.s); ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.beginPath(); ctx.ellipse(q[0], q[1], rx, rx * Math.max(0.25, V.sp), 0, 0, 6.283); ctx.fill(); }
  JT.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
