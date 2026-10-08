/* Jumper Terrarium — Habitat model: decor (placement, stacking, removal), entities, ownership,
   reconciliation after geometry changes, misting, cleaning, and shared route locomotion. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, G = JT.G, Nav = JT.Nav;

  let fallbackId = 1;
  JT.newId = function (prefix) {
    const g = JT.game && JT.game.state; const n = g ? (g.nextId = (g.nextId || 1) + 1) : ++fallbackId;
    return (prefix || 'e') + n.toString(36);
  };

  class Habitat {
    constructor(data, game) {
      this.game = game || null;
      this.data = Object.assign({ id: JT.newId('h'), name: 'Habitat', type: 'standard', substrate: 'coco', bg: 'mossy', humidity: 0.6, age: 0,
        decor: [], spiders: [], prey: [], remains: [], drops: [], silk: [] }, data || {});
      this.geoms = {}; this.nav = null; this._geomVersion = 0;
      this.rebuild(); this._fitWalls(); for (const wd of this.data.decor.filter(d => (JT.DECOR_BY_ID[d.type] || {}).arche === 'backwall')) this._resnapMounts(wd.id); // older mounts hanging past a wall edge slide back on
    }
    get dims() { return JT.HABITATS[this.data.type] || JT.HABITATS.standard; }
    get decor() { return this.data.decor; }
    get spiders() { return this.data.spiders; }
    /** Tanks are named after the jumpers living in them (v11): "Pip", "Pip & Bean", "Pip, Bean & Mochi"; none: "Empty tank". */
    get title() { const n = this.data.spiders.map(x => x.name); if (!n.length) return 'Empty tank'; return n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1]; }
    get prey() { return this.data.prey; }
    get time() { return this.game ? this.game.state.time : (this._t || 0); }
    daylight() { return this.game ? this.game.daylight() : 1; }
    find(id) { return this.data.spiders.find(s => s.id === id) || this.data.prey.find(p => p.id === id) || null; }
    spider(id) { return this.data.spiders.find(s => s.id === id) || null; }
    preyById(id) { return this.data.prey.find(p => p.id === id) || null; }
    decorById(id) { return this.data.decor.find(d => d.id === id) || null; }
    event(type, info) { if (this.game) this.game.onEvent(this, type, info || {}); }

    // ---------------- geometry ----------------
    sortedDecor() {
      const byId = {}; this.data.decor.forEach(d => byId[d.id] = d);
      const depth = (d, k) => (d.parent && byId[d.parent] && k < 8) ? 1 + depth(byId[d.parent], k + 1) : JT.DECOR_BY_ID[d.type] && JT.DECOR_BY_ID[d.type].mount ? 9 : 0; // wall mounts after their wall
      return this.data.decor.slice().sort((a, b) => depth(a, 0) - depth(b, 0));
    }
    rebuild() {
      this.geoms = {};
      const H = this.dims.h;
      for (const d of this.data.decor) if ((JT.DECOR_BY_ID[d.type] || {}).arche === 'backwall') { d.sub = this.data.substrate; d.arc = this.dims.shape === 'circle' ? { R: this.dims.w / 2, cz: this.dims.d / 2 - d.z } : null; }
      for (const inst of this.sortedDecor()) {
        if (inst.parent && !this.geoms[inst.parent]) inst.parent = null;
        let baseY = 0;
        if (inst.parent) { const pg = this.geoms[inst.parent]; const t = pg.tops[inst.parentTop || 0]; if (t) baseY = t.y; else inst.parent = null; }
        this.geoms[inst.id] = JT.Geo.build(inst, baseY, H, inst.wall ? this.wallLook(inst.wall) : null);
      }
      this.nav = Nav.build(this);
      this._geomVersion++;
      this.reconcile();
    }

    /** Placement legality incl. creative stacking. Returns {ok, reason, parent, parentTop, geom}. */
    /** Nearest back wall face for a wall-mounted piece: {id, x, z, rot, h, u}. */
    mountSnap(x, z, ignoreId) {
      let best = null;
      for (const d of this.data.decor) {
        if (d.id === ignoreId) continue; const g = this.geoms[d.id]; if (!g || !g.front) continue;
        const F = g.front;
        for (let i = 0; i < F.length - 1; i++) {
          const a = F[i], b = F[i + 1]; const ex = b[0] - a[0], ez = b[1] - a[1]; const L2 = ex * ex + ez * ez || 1;
          let t = ((x - a[0]) * ex + (z - a[1]) * ez) / L2; t = M.clamp(t, 0, 1);
          const px = a[0] + ex * t, pz = a[1] + ez * t; const dd = Math.hypot(x - px, z - pz);
          if (!best || dd < best.dd) best = { dd, id: d.id, g, i, t, px, pz, rot: d.rot || 0, h: g.wallH || g.height };
        }
      }
      return best;
    }
    _canMount(def, type, x, z, seed, ignoreId, my) {
      const s = this.mountSnap(x, z, ignoreId); if (!s) return { ok: false, reason: 'Mount it on a back wall' };
      // keep the piece's width on the wall face
      const F = s.g.front, a = F[0], b = F[F.length - 1]; const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1; const hw = (def.p.w || 14) / 2 + 2;
      let u = ((s.px - a[0]) * ex + (s.pz - a[1]) * ez) / L; u = M.clamp(u, hw, L - hw);
      const s2 = this.mountSnap(a[0] + ex / L * u + s.g.out[0] * 3, a[1] + ez / L * u + s.g.out[2] * 3, ignoreId) || s;
      x = s2.px + s.g.out[0] * 0.3; z = s2.pz + s.g.out[2] * 0.3;
      if (my == null || !isFinite(my)) my = s.h * (0.3 + 0.5 * (((seed || 1) % 997) / 997));
      my = M.clamp(my, def.p.kind === 'fungi' ? 22 : def.p.kind === 'vine' ? (def.p.len || 30) + 4 : 12, s.h - 8);
      if (this.data.decor.filter(d => d.wall === s.id && d.id !== ignoreId).length >= JT.WALL_CAP) return { ok: false, reason: 'This wall already holds ' + JT.WALL_CAP + ' pieces' };
      const inst = { id: '_probe', type, x, z, rot: s.rot, seed: seed || 1, my };
      const look = this.wallLook(s.id); let g = JT.Geo.build(inst, 0, this.dims.h, look);
      { // keep the whole piece on the wall face, not hanging past its side
        const fx0 = Math.min(a[0], b[0]) + 1, fx1 = Math.max(a[0], b[0]) - 1; let e0 = 1e9, e1 = -1e9; for (const q of g.extent) { e0 = Math.min(e0, q[0]); e1 = Math.max(e1, q[0]); }
        const dx = e0 < fx0 ? fx0 - e0 : e1 > fx1 ? fx1 - e1 : 0;
        if (dx) { if (e1 - e0 > fx1 - fx0) return { ok: false, reason: 'Too wide for this wall' }; const s3 = this.mountSnap(x + dx + s.g.out[0] * 3, z + s.g.out[2] * 3, ignoreId) || s2; x = s3.px + s.g.out[0] * 0.3; z = s3.pz + s.g.out[2] * 0.3; inst.x = x; inst.z = z; g = JT.Geo.build(inst, 0, this.dims.h, look); }
      }
      for (const q of g.extent) if (!Nav.inside(this, q[0], q[1], 1.5)) return { ok: false, reason: 'Outside the habitat' };
      if (my + 10 > this.dims.h) return { ok: false, reason: 'Too tall to fit here' };
      for (const d of this.data.decor) {
        if (d.id === ignoreId) continue; const od = JT.DECOR_BY_ID[d.type]; if (!od || !od.mount || d.wall !== s.id) continue;
        const og = this.geoms[d.id]; if (!og) continue;
        if (Math.hypot(og.center[0] - x, og.center[2] - z) < ((od.p.w || 14) + (def.p.w || 14)) / 2 && Math.abs((d.my || 0) - my) < 16) return { ok: false, reason: 'Too close to ' + od.name };
      }
      return { ok: true, parent: null, parentTop: 0, baseY: 0, geom: g, x, z, rot: s.rot, my, wall: s.id };
    }
    /** A back wall always fills the back of the tank: full width (the back chord of a round jar) and full height. */
    wallFit() {
      const W = this.dims.w, D = this.dims.d, H = this.dims.h, dep = 10;
      if (this.dims.shape === 'circle') { const R = W / 2, zb = D / 2 + R * 0.62; return { x: W / 2, z: zb - dep / 2, rot: 0, ww: Math.round(2 * Math.sqrt(R * R - (R * 0.62 - dep / 2) ** 2)), wh: H - 6 }; }
      return { x: W / 2, z: D - 0.4 - dep / 2, rot: 0, ww: W - 0.8, wh: H - 6 }; // flush with the back and both side panes
    }
    backWall() { return this.data.decor.find(d => (JT.DECOR_BY_ID[d.type] || {}).arche === 'backwall') || null; }
    /** The colours and material of a back wall, so the pieces hung on it can match: {style, cols}. */
    wallLook(wallId) {
      const w = (wallId && this.decorById(wallId)) || this.backWall(); const def = w && JT.DECOR_BY_ID[w.type]; if (!def || def.arche !== 'backwall') return null;
      return { style: def.p.style || w.type, cols: JT.wallCols(this.data.substrate) };
    }
    _canWall(def, type, seed, ignoreId) {
      const F = this.wallFit(); const old = this.backWall(); const skip = old ? old.id : null;
      const inst = { id: '_probe', type, x: F.x, z: F.z, rot: 0, seed: seed || 1, ww: F.ww, wh: F.wh, sub: this.data.substrate, arc: this.dims.shape === 'circle' ? { R: this.dims.w / 2, cz: this.dims.d / 2 - F.z } : null };
      const g = JT.Geo.build(inst, 0, this.dims.h);
      for (const d of this.data.decor) {
        if (d.id === ignoreId || d.id === skip || d.parent) continue; const og = this.geoms[d.id]; if (!og || og.def.mount || og.def.cat === 'ground') continue;
        const hit = og.solids.length ? og.solids.some(s2 => g.solids.some(s1 => G.polysOverlap(s1, s2))) : (og.contacts || []).some(c => g.solids.some(s1 => G.pointInPoly(c[0], c[1], s1)));
        if (hit) return { ok: false, reason: 'Clear the back first: ' + og.def.name + ' is in the way' };
      }
      return { ok: true, parent: null, parentTop: 0, baseY: 0, geom: g, x: F.x, z: F.z, rot: 0, ww: F.ww, wh: F.wh, wallFit: true, replaces: skip };
    }
    canPlace(type, x, z, rot, seed, ignoreId, my) {
      const def = JT.DECOR_BY_ID[type]; if (!def) return { ok: false, reason: 'Unknown item' };
      if (def.arche === 'backwall') return this._canWall(def, type, seed, ignoreId);
      if (this.data.decor.length >= 48 && !ignoreId) return { ok: false, reason: 'Habitat is full of decor' };
      if (def.mount) return this._canMount(def, type, x, z, seed, ignoreId, my);
      const inst = { id: '_probe', type, x, z, rot: rot || 0, seed: seed || 1 };
      let g0 = JT.Geo.build(inst, 0, this.dims.h);
      // find support: highest platform top containing the whole base footprint
      let parent = null, parentTop = 0, baseY = 0;
      const solidChild = g0.solids.length > 0;
      const probe = solidChild ? g0.foot : (g0.contacts.length ? g0.contacts : [[x, z]]);
      const childArea = G.polyArea(g0.foot);
      let bestY = -1;
      for (const d of this.data.decor) {
        if (d.id === ignoreId) continue;
        const pdef = JT.DECOR_BY_ID[d.type], pg = this.geoms[d.id]; if (!pg || !pdef.platform) continue;
        pg.tops.forEach((t, i) => {
          if (!G.pointInPoly(x, z, t.poly)) return;
          const ex = G.expandPoly(t.poly, solidChild ? 1.5 : 0.5);
          if (!probe.every(q => G.pointInPoly(q[0], q[1], ex))) return;
          if (solidChild && childArea > G.polyArea(t.poly) * 0.8) return;
          if (def.arche === 'tree' && def.p.kind === 'grand') return;
          if (t.y > bestY) { bestY = t.y; parent = d.id; parentTop = i; baseY = t.y; }
        });
      }
      if (parent && !(def.stack || def.cat === 'ground' || solidChild || def.arche === 'branch')) return { ok: false, reason: 'This piece cannot be stacked' };
      const g = parent ? JT.Geo.build(inst, baseY, this.dims.h) : g0;
      // containment: every visible/physical point must be inside the habitat
      for (const q of g.extent) if (!Nav.inside(this, q[0], q[1], 1.5)) return { ok: false, reason: 'Outside the habitat' };
      if (baseY + g.height > this.dims.h * 1.02) return { ok: false, reason: 'Too tall to fit here' };
      // overlap rules vs siblings on the same support
      for (const d of this.data.decor) {
        if (d.id === ignoreId) continue;
        const og = this.geoms[d.id]; if (!og) continue;
        const sameLevel = (d.parent || null) === (parent || null) && (!parent || (d.parentTop || 0) === parentTop);
        if (d.id === parent) continue;
        if (og.def.mount) continue; // hangs on a wall above the floor
        if (!sameLevel) continue; // objects resting on different supports do not collide
        if (def.cat === 'ground') { if (og.solids.length && og.solids.some(s => G.pointInPoly(x, z, s))) return { ok: false, reason: 'Ground cover needs open floor' }; continue; }
        if (og.def.cat === 'ground') continue;
        if (solidChild && og.solids.length) { for (const s of g.solids) for (const s2 of og.solids) if (G.polysOverlap(s, s2)) return { ok: false, reason: 'Overlaps ' + og.def.name }; }
        else if (solidChild) { for (const c of og.contacts) for (const s of g.solids) if (G.pointInPoly(c[0], c[1], s)) return { ok: false, reason: 'Would crush ' + og.def.name }; }
        else if (og.solids.length) { for (const c of (g.contacts.length ? g.contacts : [[x, z]])) for (const s of og.solids) if (G.pointInPoly(c[0], c[1], s)) return { ok: false, reason: 'Blocked by ' + og.def.name }; }
        else { if (Math.hypot(og.center[0] - x, og.center[2] - z) < 6) return { ok: false, reason: 'Too close to ' + og.def.name }; }
      }
      return { ok: true, parent, parentTop, baseY, geom: g };
    }
    addDecor(type, x, z, rot, seed, placedBy, my, opts) {
      const chk = this.canPlace(type, x, z, rot, seed, null, my);
      if (!chk.ok) return null;
      if (chk.wallFit && chk.replaces) { // swap the wall's style in place: mounts stay on it
        const w = this.decorById(chk.replaces);
        Object.assign(w, { type, seed: seed || w.seed, x: chk.x, z: chk.z, rot: 0, ww: chk.ww, wh: chk.wh, fit: 2, preset: !placedBy && w.preset, novel: !!placedBy }); delete w.bought;
        this.rebuild(); this._resnapMounts(w.id); return w;
      }
      const inst = { id: JT.newId('d'), type, x, z, rot: rot || 0, seed: seed || ((JT.R() * 1e9) | 0), parent: chk.parent || null, parentTop: chk.parentTop || 0, placedAt: this.time, novel: !!placedBy };
      if (chk.wall) { inst.x = chk.x; inst.z = chk.z; inst.rot = chk.rot; inst.my = chk.my; inst.wall = chk.wall; }
      if (chk.wallFit) { inst.x = chk.x; inst.z = chk.z; inst.rot = 0; inst.ww = chk.ww; inst.wh = chk.wh; inst.fit = 2; }
      if (opts && opts.bare && JT.DECOR_BY_ID[type].arche === 'tree') inst.bare = true; // tree without its leaves
      this.data.decor.push(inst);
      this.rebuild();
      return inst;
    }
    _resnapMounts(wallId) {
      let moved = false;
      for (const m of this.data.decor.filter(d => d.wall === wallId)) { const def = JT.DECOR_BY_ID[m.type]; const c = this._canMount(def, m.type, m.x, m.z, m.seed, m.id, m.my); if (c.ok) { m.x = c.x; m.z = c.z; m.rot = c.rot; m.my = c.my; m.wall = c.wall; moved = true; } }
      if (moved) this.rebuild();
    }
    /** Older saves: free-standing back-wall panels become one wall across the whole back; pieces in its way move forward. */
    _fitWalls() {
      const walls = this.data.decor.filter(d => (JT.DECOR_BY_ID[d.type] || {}).arche === 'backwall');
      if (!walls.length || (walls.length === 1 && walls[0].ww && walls[0].fit === 2)) return false;
      const keep = walls[0], F = this.wallFit();
      for (const w of walls.slice(1)) { this.data.decor.filter(d => d.wall === w.id).forEach(m => { m.wall = keep.id; }); }
      this.data.decor = this.data.decor.filter(d => !walls.includes(d) || d === keep);
      Object.assign(keep, { x: F.x, z: F.z, rot: 0, ww: F.ww, wh: F.wh, parent: null, fit: 2 });
      this.rebuild();
      const wg = this.geoms[keep.id];
      for (const d of this.data.decor.slice()) {
        if (d === keep || d.parent || d.wall) continue; const og = this.geoms[d.id]; if (!og || og.def.cat === 'ground') continue;
        if (!og.solids.some(s2 => wg.solids.some(s1 => G.polysOverlap(s1, s2))) && !(og.contacts || []).some(c => wg.solids.some(s1 => G.pointInPoly(c[0], c[1], s1)))) continue;
        for (let k = 1; k <= 12; k++) { const z = d.z - k * 4; if (this.canPlace(d.type, d.x, z, d.rot, d.seed, d.id, d.my).ok) { d.z = z; break; } }
      }
      this.rebuild(); this._resnapMounts(keep.id); return true;
    }
    /** Remove decor; stacked children are dropped to a legitimate new support (or removed). */
    removeDecor(id) {
      const inst = this.decorById(id); if (!inst) return [];
      const removed = [inst];
      this.data.decor = this.data.decor.filter(d => d !== inst);
      const mounts = this.data.decor.filter(d => d.wall === id); // pieces hung on a removed wall come down with it
      if (mounts.length) { this.data.decor = this.data.decor.filter(d => d.wall !== id); removed.push(...mounts); }
      const kids = this.data.decor.filter(d => d.parent === id);
      for (const k of kids) {
        k.parent = null; k.parentTop = 0;
        this.rebuild();
        // re-seat child on whatever is now beneath it
        this.data.decor = this.data.decor.filter(d => d !== k);
        this.rebuild();
        const chk = this.canPlace(k.type, k.x, k.z, k.rot, k.seed);
        if (chk.ok) { k.parent = chk.parent; k.parentTop = chk.parentTop; this.data.decor.push(k); }
        else { removed.push(k); this.data.decor.filter(d => d.parent === k.id).forEach(g => { g.parent = null; }); }
      }
      this.rebuild();
      return removed;
    }

    /** Keep every entity attached to legal physical support after geometry changes. */
    reconcile() {
      const fix = (e) => {
        if (!e.pos || !M.finite3(e.pos)) e.pos = [this.dims.w / 2, 0, this.dims.d / 2];
        if (e.sup && e.sup.k === 'air') return;
        if (!Nav.validSup(this, e.sup)) { const b = Nav.supportBelow(this, e.pos); e.pos = b.pos; e.sup = b.sup; }
        else e.pos = Nav.supPos(this, e.sup, e.pos);
        if (e.sup.k === 'floor' || e.sup.k === 'top') { const b = Nav.supportBelow(this, [e.pos[0], e.pos[1] + 0.5, e.pos[2]]); if (Nav.regionKey(b.sup) !== Nav.regionKey(e.sup) && b.pos[1] >= e.pos[1] - 0.5) { e.pos = b.pos; e.sup = b.sup; } }
        e._route = null; e._air = null;
      };
      this.data.spiders.forEach(s => { fix(s); if (s.retreat && !this.geoms[s.retreat.d] && s.retreat.d) s.retreat = null; });
      this.data.prey.forEach(p => { if (!p.owner) fix(p); });
      this.data.remains.forEach(fix);
      this.data.drops = this.data.drops.filter(d => Nav.validSup(this, d.sup));
      this.data.drops.forEach(d => { d.pos = Nav.supPos(this, d.sup, d.pos); });
      this.data.silk = this.data.silk.filter(s => !s.decor || this.geoms[s.decor]);
      for (const s of this.data.spiders) if (s.home && (!M.finite3(s.home.pos) || !Nav.validSup(this, s.home.sup))) s.home = null;
      if (this._leaves) this._leaves = this._leaves.filter(l => !l.decor || this.geoms[l.decor]);
    }

    // ---------------- lamps & warmth ----------------
    /** Basking lamps currently switched on: [{inst, head, pool, r}]. */
    lampsOn() {
      const out = [];
      for (const inst of this.data.decor) { if (inst.type !== 'heatlamp' || inst.on === false) continue; const g = this.geoms[inst.id]; if (g && g.lamp) out.push({ inst, head: g.lamp.head, pool: g.lamp.pool, r: g.lamp.r }); }
      return out;
    }
    /** 0..1 radiant warmth at a point (strongest directly under a lit lamp head). */
    warmthAt(pos) {
      let w = 0;
      for (const L of this.lampsOn()) {
        if (pos[1] > L.head[1] - 1) continue;
        const dh = Math.hypot(pos[0] - L.pool[0], pos[2] - L.pool[2]); const dv = L.head[1] - pos[1];
        const R = L.r * (0.6 + 0.4 * M.clamp(dv / 40, 0, 1.4));
        if (dh < R) w = Math.max(w, (1 - dh / R) * M.clamp(1.2 - dv / 150, 0.6, 1));
      }
      return w;
    }
    toggleLamp(id) { const inst = this.decorById(id); if (!inst || inst.type !== 'heatlamp') return null; inst.on = inst.on === false; const g = this.geoms[id]; if (g) { g.lampOn = inst.on; g._spr = null; } return inst.on; }

    // ---------------- entities ----------------
    randomFloorPoint(rng) {
      rng = rng || JT.R;
      for (let k = 0; k < 40; k++) {
        const x = rng.range(8, this.dims.w - 8), z = rng.range(8, this.dims.d - 8);
        if (!Nav.inside(this, x, z, 6)) continue;
        const b = Nav.supportBelow(this, [x, 0.2, z]); if (b.sup.k === 'floor') return b.pos;
      }
      return [this.dims.w / 2, 0, this.dims.d / 2];
    }
    liveSpiders() { return this.data.spiders.length; }
    capacity() { return this.dims.cap; }
    addSpider(speciesId, opts) {
      const sp = JT.SpiderAI.create(this, speciesId, opts || {});
      this.data.spiders.push(sp); if (this.game && this.game.diary) { const sn = JT.STAGES[sp.stage].toLowerCase(); { const tn = this.dims.name.toLowerCase(); this.game.diary(sp, 'Arrived in ' + (/^[aeiou]/.test(tn) ? 'an ' : 'a ') + tn + ' as ' + (/^[aeiou]/.test(sn) ? 'an ' : 'a ') + sn + '.'); } } return sp;
    }
    livePreyCount() { return this.data.prey.filter(p => !p.owner).length; }
    addPrey(typeId, n) {
      const def = JT.PREY_BY_ID[typeId]; const out = [];
      n = n || def.count;
      for (let i = 0; i < n; i++) { if (this.data.prey.length >= JT.PREY_CAP) break; const p = JT.PreyAI.create(this, typeId); this.data.prey.push(p); out.push(p); }
      return out;
    }
    /** Central ownership cleanup. Never leaves dangling cross references. */
    removeEntity(e, reason) {
      if (!e) return;
      if (this.data.spiders.includes(e)) {
        this.data.spiders = this.data.spiders.filter(s => s !== e);
        if (e.hold) { const h = this.preyById(e.hold); if (h) { h.owner = null; if (reason === 'player') { this.data.prey = this.data.prey.filter(p => p !== h); } else { const b = Nav.supportBelow(this, e.pos); h.pos = b.pos; h.sup = b.sup; h.state = 'idle'; h.dead = true; this.data.prey = this.data.prey.filter(p => p !== h); this.addRemains(h.type, h.pos, h.sup, 'husk'); } } }
        for (const s of this.data.spiders) { if (s.target && s.target.id === e.id) JT.SpiderAI.dropTarget(this, s); if (s.threat === e.id) s.threat = null; }
      } else if (this.data.prey.includes(e)) {
        this.data.prey = this.data.prey.filter(p => p !== e);
        if (e.owner) { const o = this.spider(e.owner); if (o && o.hold === e.id) { o.hold = null; JT.SpiderAI.reset(this, o, 'Its meal is gone.'); } }
        for (const s of this.data.spiders) if (s.target && s.target.id === e.id) JT.SpiderAI.dropTarget(this, s);
      } else if (this.data.remains.includes(e)) this.data.remains = this.data.remains.filter(r => r !== e);
      else if (this.data.drops.includes(e)) this.data.drops = this.data.drops.filter(r => r !== e);
      else if (this.data.silk.includes(e)) this.data.silk = this.data.silk.filter(r => r !== e);
    }
    addRemains(kind, pos, sup, cat, extra) {
      const r = Object.assign({ id: JT.newId('r'), kind, cat: cat || 'husk', pos: pos.slice(), sup: JT.deepClone(sup), age: 0, clean: 1, ang: JT.R() * 6.28 }, extra || {});
      if (r.sup.k === 'air') { const b = Nav.supportBelow(this, pos); r.pos = b.pos; r.sup = b.sup; }
      else if (this.remainsLoose(r)) { if (r.cat === 'exuvia') r.dropAt = 300; else this.dropRemains(r); } // husks drop off twigs, leaves and stems; a moult stays in its shelter a while
      this.data.remains.push(r);
      if (this.data.remains.length > 40) this.data.remains.shift();
      return r;
    }
    /** Remains on something that will not hold them: branches, stems, leaves, vines, plants, wall pieces (not flat tops of decor or floor). */
    remainsLoose(r) {
      const k = r.sup && r.sup.k; if (!k || k === 'floor') return false; if (k === 'air') return true;
      if (k !== 'top') return true;
      const g = this.geoms[r.sup.d]; const def = g && g.def; return !!(def && (def.cat === 'plants' || def.arche === 'wallmount'));
    }
    /** Let remains fall to the support underneath (animated in the renderer by r._fall). */
    dropRemains(r) {
      const ex = r.sup && r.sup.k === 'top' ? r.sup.d : null; const from = r.pos.slice();
      const b = Nav.supportBelow(this, [from[0], from[1] - 0.2, from[2]], ex); if (!b || !M.finite3(b.pos)) return;
      const h = Math.max(0, from[1] - b.pos[1]); r.pos = b.pos; r.sup = b.sup; r.dropAt = null;
      if (h > 0.4) r._fall = { from, t: 0, dur: Math.min(1.2, 0.12 + Math.sqrt(h) * 0.09), spin: (JT.R() - 0.5) * 9, a0: r.ang || 0 };
    }
    addSilk(a, b, kind, decor) {
      if (!M.finite3(a) || !M.finite3(b) || (JT.SpiderAI && JT.SpiderAI.NO_SILK)) return;
      this.data.silk.push({ id: JT.newId('k'), a: a.slice(), b: b.slice(), kind: kind || 'drag', age: 0, decor: decor || null });
      while (this.data.silk.length > 70) this.data.silk.shift();
    }
    validateRefs() {
      for (const s of this.data.spiders) {
        if (s.hold) { const p = this.preyById(s.hold); if (!p || p.owner !== s.id) { s.hold = null; if (['subdue', 'carry', 'feed'].includes(s.state)) JT.SpiderAI.reset(this, s); } }
        if (s.target) { const t = s.target.kind === 'spider' ? this.spider(s.target.id) : this.preyById(s.target.id); if (!t || t.owner || t.buried) JT.SpiderAI.dropTarget(this, s); }
        if (s.threat && !this.spider(s.threat)) s.threat = null;
        if (!M.finite3(s.pos)) { const b = Nav.supportBelow(this, [this.dims.w / 2, 0, this.dims.d / 2]); s.pos = b.pos; s.sup = b.sup; s._route = null; }
      }
      for (const p of this.data.prey) {
        if (p.owner) { const o = this.spider(p.owner); if (!o || o.hold !== p.id) { p.owner = null; const b = Nav.supportBelow(this, p.pos); p.pos = b.pos; p.sup = b.sup; p.state = 'idle'; } }
        if (!M.finite3(p.pos)) { p.pos = this.randomFloorPoint(); p.sup = { k: 'floor' }; p._route = null; }
      }
    }

    // ---------------- maintenance ----------------
    mist() {
      this.data.humidity = Math.min(1, this.data.humidity + 0.28);
      const nav = this.nav; const cands = nav.nodes.filter(n => (n.kind !== 'face' || (n.pos[1] > 4 && JT.R() < 0.35)) && !n.landing && (n.kind !== 'floor' || JT.R() < 0.25));
      const n = 8 + Math.floor(JT.R() * 7);
      for (let i = 0; i < n && cands.length; i++) {
        const node = cands[Math.floor(JT.R() * cands.length)];
        if (this.data.drops.some(d => M.dist(d.pos, node.pos) < 3)) continue;
        this.data.drops.push({ id: JT.newId('w'), pos: node.pos.slice(), sup: JT.deepClone(node.sup), decor: node.decor || null, life: 150 + JT.R() * 150, r: 0.8 + JT.R() * 0.7 });
      }
      while (this.data.drops.length > 30) this.data.drops.shift();
      for (const p of this.data.prey) if (!p.owner) JT.PreyAI.startle(this, p, 0.35);
      for (const s of this.data.spiders) JT.SpiderAI.onMist(this, s);
    }
    /** Tidy: husks, old silk (draglines, webs) and empty retreats. A retreat with a jumper inside — and its silk — stays. */
    clean() {
      const d = this.data; const husks = d.remains.filter(r => r.cat === 'husk').length;
      d.remains = d.remains.filter(r => r.cat !== 'husk');
      const AI = JT.SpiderAI; const inside = (n) => d.spiders.some(sp => sp.nest === n.id && AI.NEST_STATES.has(sp.state));
      const keep = (d.nests || []).filter(inside); const nests = (d.nests || []).length - keep.length;
      for (const sp of d.spiders) if (sp.nest && !keep.some(n => n.id === sp.nest)) sp.nest = null;
      d.nests = keep;
      const near = (k) => keep.some(n => { const r = Math.max(4, (n.len || 4) * 2.2); return M.dist(k.a, n.pos) < r || M.dist(k.b, n.pos) < r; });
      const s0 = d.silk.length; d.silk = d.silk.filter(near); const silk = s0 - d.silk.length;
      return { husks, silk, nests, total: husks + silk + nests };
    }
    /** Empty the tank completely: decor, plants, prey, jumpers, remains, drops, silk and retreats. */
    resetTank() {
      const d = this.data;
      d.decor = []; d.spiders = []; d.prey = []; d.remains = []; d.drops = []; d.silk = []; d.nests = [];
      this._leaves = []; this.rebuild();
    }

    // ---------------- simulation ----------------
    update(dt, full) {
      if (!this.game) this._t = (this._t || 0) + dt;
      const d = this.data;
      d.humidity = Math.max(0.15, d.humidity - dt * 0.0012 * (1.2 - (JT.SUBSTRATES[d.substrate] || {}).moist || 0.5));
      if (JT.Biome) JT.Biome.climate(this, dt);
      if (JT.Biome && full && !this.game) JT.Biome.tick(this, dt);
      if (!full) { JT.SpiderAI.liteUpdate(this, dt); return; }
      for (const s of d.spiders.slice()) if (d.spiders.includes(s)) JT.SpiderAI.update(this, s, dt);
      for (const p of d.prey.slice()) if (d.prey.includes(p)) JT.PreyAI.update(this, p, dt);
      for (const w of d.drops) w.life -= dt * (1.4 - d.humidity);
      d.drops = d.drops.filter(w => w.life > 0);
      JT.SpiderAI.updateNests(this, dt);
      for (const s of d.silk) s.age += dt;
      d.silk = d.silk.filter(s => s.age < (s.kind === 'retreat' ? 1800 : 600));
      this.updateRemains(dt);
      this.updateCleaners(dt);
      this.updateLeaves(dt);
      this.updateDew(dt);
      for (const inst of d.decor) { const sw = inst._sw; if (sw) { sw.vx += (-sw.x * 26 - sw.vx * 5.5) * dt; sw.vz += (-sw.z * 26 - sw.vz * 5.5) * dt; sw.x += sw.vx * dt; sw.z += sw.vz * dt; if (Math.abs(sw.x) + Math.abs(sw.z) + Math.abs(sw.vx) + Math.abs(sw.vz) < 1e-3) inst._sw = null; } }
      this._valT = (this._valT || 0) + dt; if (this._valT > 1) { this._valT = 0; this.validateRefs(); }
    }
    /** Remains slowly decay on their own (damp speeds it); springtails speed it up a lot (prey.js). */
    updateRemains(dt) {
      const d = this.data; let gone = false;
      for (const r of d.remains) {
        r.age += dt; if (r.clean == null || !isFinite(r.clean)) r.clean = 1;
        if (r._fall) { r._fall.t += dt; r.ang = r._fall.a0 + r._fall.spin * Math.min(1, r._fall.t / r._fall.dur); if (r._fall.t >= r._fall.dur) r._fall = null; }
        if (r.dropAt != null && r.age >= r.dropAt) { if (this.remainsLoose(r)) this.dropRemains(r); else r.dropAt = null; }
        const base = r.cat === 'exuvia' ? 1 / 1500 : r.cat === 'spider' ? 1 / 2400 : 1 / 900;
        r.clean -= dt * base * (0.5 + d.humidity);
        if (r.clean <= 0) gone = true;
      }
      if (gone) d.remains = d.remains.filter(r => r.clean > 0);
    }
    /** Small self-sustaining springtail colony: breeds when there is food or moisture, thins out when dry and bare. */
    updateCleaners(dt) {
      const d = this.data; this._brT = (this._brT || 0) + dt; if (this._brT < 15) return; this._brT = 0;
      const sts = d.prey.filter(p => p.type === 'springtail' && !p.owner); const n = sts.length; if (n < 2) return;
      const food = d.remains.length; const moist = d.humidity > 0.45;
      const target = food ? Math.min(12, 6 + food) : moist ? 6 : 3;
      if (n < target && (food || moist) && JT.R() < 0.35 && d.prey.length < JT.PREY_CAP - 2) {
        const par = sts[Math.floor(JT.R() * n)]; const p = JT.PreyAI.create(this, 'springtail');
        const b = Nav.supportBelow(this, [par.pos[0] + (JT.R() - 0.5) * 2, par.pos[1] + 0.5, par.pos[2] + (JT.R() - 0.5) * 2]);
        p.pos = b.pos; p.sup = b.sup; p.young = true; d.prey.push(p);
      } else if (!food && !moist && n > 3 && JT.R() < 0.2) {
        const v = sts.find(p => p.state === 'idle' || p.state === 'buried') || null; if (v) this.removeEntity(v, 'natural');
      }
    }
    /** Transient falling leaf bits / debris from plants: something moving that a hungry jumper may lunge at. */
    updateLeaves(dt) {
      const L = this._leaves || (this._leaves = []);
      this._leafT = (this._leafT == null ? 6 + JT.R() * 10 : this._leafT) - dt;
      if (this._leafT <= 0) {
        this._leafT = 8 + JT.R() * 14;
        const plants = this.data.decor.filter(i => { const g = this.geoms[i.id]; return g && g.def && g.def.cat === 'plants' && g.height > 10; });
        if (plants.length && L.length < 4) {
          const inst = plants[Math.floor(JT.R() * plants.length)]; const g = this.geoms[inst.id];
          const a = JT.R() * 6.28, rr = JT.R() * Math.max(2, g.coverR * 0.8);
          const x = g.center[0] + Math.cos(a) * rr, z = g.center[2] + Math.sin(a) * rr;
          if (Nav.inside(this, x, z, 3)) {
            const y = g.baseY + g.height * (0.55 + JT.R() * 0.4); const b = Nav.supportBelow(this, [x, y, z]);
            L.push({ id: JT.newId('l'), pos: [x, y, z], y0: b.pos[1], falling: true, t: 0, rest: 0, ang: JT.R() * 6.28, seed: JT.R() * 100, decor: b.sup.d || null, hue: JT.R() });
          }
        }
      }
      for (const l of L) {
        l.t += dt;
        if (l.falling) {
          l.pos[1] -= dt * (3.2 + Math.sin(l.t * 2.1 + l.seed) * 1.2);
          l.pos[0] += Math.sin(l.t * 1.7 + l.seed) * dt * 2.2; l.pos[2] += Math.cos(l.t * 1.3 + l.seed) * dt * 1.6; l.ang += dt * 1.5;
          const c = Nav.clampInside(this, l.pos[0], l.pos[2], 2); l.pos[0] = c[0]; l.pos[2] = c[1];
          if (l.pos[1] <= l.y0 + 0.15 || l.t > 40) { l.pos[1] = l.y0 + 0.1; l.falling = false; }
        } else l.rest += dt;
      }
      this._leaves = L.filter(l => l.rest < 14);
    }
    /** Morning dew: a few droplets condense on leaves and walls around dawn when humid enough. */
    updateDew(dt) {
      if (!this.game) return; const tod = this.game.tod ? this.game.tod() : null; if (tod == null) return;
      const day = Math.floor(this.game.state.time / (JT.DAY || 480));
      if (tod > 0.2 && tod < 0.3 && this.data.humidity > 0.5 && this.data.dewDay !== day) {
        this.data.dewDay = day;
        const cands = this.nav.nodes.filter(n => !n.landing && n.kind !== 'floor' && n.pos[1] > 3);
        for (let i = 0; i < 5 && cands.length; i++) {
          const node = cands[Math.floor(JT.R() * cands.length)];
          if (this.data.drops.some(w => M.dist(w.pos, node.pos) < 3)) continue;
          this.data.drops.push({ id: JT.newId('w'), pos: node.pos.slice(), sup: JT.deepClone(node.sup), decor: node.decor || null, life: 120 + JT.R() * 120, r: 0.6 + JT.R() * 0.5 });
        }
      }
    }
    /** Small damped-spring impulse on flexible vegetation. */
    nudge(decorId, ix, iz) {
      const inst = this.decorById(decorId); const g = this.geoms[decorId]; if (!inst || !g || !g.flexible) return;
      const sw = inst._sw || (inst._sw = { x: 0, z: 0, vx: 0, vz: 0 });
      sw.vx += ix; sw.vz += iz; sw.vx = M.clamp(sw.vx, -3, 3); sw.vz = M.clamp(sw.vz, -3, 3);
    }
    swayAt(decorId, y) {
      const inst = this.decorById(decorId); if (!inst || !inst._sw) return null; const g = this.geoms[decorId]; if (!g) return null;
      const f = M.clamp((y - g.baseY) / Math.max(4, g.height), 0, 1.2); const k = f * f;
      return [inst._sw.x * k, 0, inst._sw.z * k];
    }
  }
  JT.Habitat = Habitat;

  // ---------------- shared locomotion along routes ----------------
  const Loco = JT.Loco = {};
  /** Advance an entity along its route. Returns 'moving' | 'done' | 'none'. */
  Loco.follow = function (hab, e, dt, speed, opts) {
    const R = e._route; if (!R) return 'none';
    let budget = speed * dt; opts = opts || {};
    let guard = 0;
    while (R.i < R.steps.length && guard++ < 12) {
      const st = R.steps[R.i];
      if (st.mode === 'jump' || st.mode === 'drop') {
        if (e._air && e._air.step && e._air.step !== st) e._air = null; // route changed mid-air: continue from here to the new step
        if (!e._air) {
          const d = M.dist(e.pos, st.pos);
          // path positions are centrelines: fly between the visible surface points so hops never cut through a trunk
          const off = (sup) => { if (!sup || sup.k === 'air' || sup.k === 'floor' || !Nav.validSup(hab, sup)) return [0, 0, 0]; const fr = Nav.supFrame(hab, sup); return fr && fr.r ? M.mul(fr.n, fr.r) : [0, 0, 0]; };
          e._air = { from: M.add(e.pos, off(e.sup)), to: M.add(st.pos, off(st.arrive)), toC: st.pos.slice(), t: 0, dur: st.mode === 'drop' ? 0.35 + Math.sqrt(d) * 0.09 : 0.22 + d / 170, apex: st.mode === 'drop' ? 0 : 2 + d * 0.16, mode: st.mode, arrive: st.arrive, step: st };
          e.sup = { k: 'air' };
          if (opts.onLaunch) opts.onLaunch(st);
        }
        const A = e._air; A.t += dt / A.dur;
        const t = Math.min(1, A.t);
        const p = M.lerp3(A.from, A.to, A.mode === 'drop' ? t * t : t); p[1] += Math.sin(t * Math.PI) * A.apex;
        const dir = M.sub(p, e.pos); if (M.len(dir) > 1e-4) e._vel = M.mul(dir, 1 / Math.max(dt, 1e-3));
        if (A.mode === 'jump' && M.len([dir[0], 0, dir[2]]) > 1e-4) e.fwd = M.norm([dir[0], 0, dir[2]]);
        e.pos = p;
        if (A.t < 1) return 'moving';
        e.pos = (A.toC || A.to).slice(); e.sup = JT.deepClone(A.arrive); e._air = null; R.i++;
        if (opts.onLand) opts.onLand(st);
        return R.i >= R.steps.length ? 'done' : 'moving';
      }
      if (st.snap) { e.pos = st.pos.slice(); e.sup = JT.deepClone(st.arrive); R.i++; continue; } // v21: centre line <-> visible foot of a climb (drawn in the same place)
      const to = st.pos; const dv = M.sub(to, e.pos); const d = M.len(dv);
      if (st.during && st.during.k === 'path') {
        // parameterize along the actual visible segment (no nearest-point snapping: deliberate progress)
        const g = hab.geoms[st.during.d]; const pa = g && g.paths[st.during.p];
        if (!pa) { e._route = null; return 'none'; }
      }
      let sp = budget;
      if (d > 1e-6) {
        const climbF = Math.abs(dv[1]) / d > 0.6 ? 0.72 : 1;
        sp = budget * climbF;
      }
      if (d <= sp || d < 1e-4) {
        e.pos = to.slice(); e.sup = JT.deepClone(st.arrive); R.i++;
        budget -= d; if (budget <= 0.001) break;
        continue;
      }
      const dir = M.mul(dv, 1 / d);
      e.pos = M.add(e.pos, M.mul(dir, sp));
      e.fwd = dir;
      if (st.during) {
        if (st.during.k === 'path') {
          const pa = hab.geoms[st.during.d].paths[st.during.p]; const a = pa.pts[st.during.s], b = pa.pts[st.during.s + 1];
          const L = M.dist(a, b) || 1; const t = M.clamp(M.dist(a, e.pos) / L, 0, 1);
          e.sup = { k: 'path', d: st.during.d, p: st.during.p, s: st.during.s, t };
        } else if (st.during.k !== 'air') e.sup = JT.deepClone(st.during);
      }
      if (opts.onStep && e.sup.d) opts.onStep(e.sup.d, dir);
      break;
    }
    return R.i >= R.steps.length ? 'done' : 'moving';
  };
  Loco.remaining = function (e) {
    const R = e._route; if (!R) return 0; let d = 0, p = e.pos;
    for (let i = R.i; i < R.steps.length; i++) { d += M.dist(p, R.steps[i].pos); p = R.steps[i].pos; }
    return d;
  };
})(typeof window !== 'undefined' ? window : globalThis);
