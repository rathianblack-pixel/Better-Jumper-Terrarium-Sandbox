/* Jumper Terrarium — game state: shelf of habitats, economy, unlocks, journal, time, persistence. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  const DAY = JT.DAY = 480;
  const SAVE_KEY = 'jumperTerrarium.save', SET_KEY = 'jumperTerrarium.settings', VERSION = 2;

  // localStorage can throw in privacy modes: every access is wrapped.
  const Store = JT.Store = {
    get(k) { try { return root.localStorage ? root.localStorage.getItem(k) : (Store._mem[k] || null); } catch (e) { return Store._mem[k] || null; } },
    set(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, v); else Store._mem[k] = v; return true; } catch (e) { Store._mem[k] = v; return false; } },
    del(k) { try { if (root.localStorage) root.localStorage.removeItem(k); } catch (e) { } delete Store._mem[k]; },
    _mem: {},
  };
  const replacer = (k, v) => (k && k[0] === '_') ? undefined : v;

  class Game {
    constructor() { this.listeners = []; this.habs = []; this.state = null; this.viewing = true; this._lite = 0; }
    on(fn) { this.listeners.push(fn); }
    emit(type, data) { for (const f of this.listeners) { try { f(type, data); } catch (e) { console.error(e); } } }
    get hab() { return this.habs[this.state.active] || this.habs[0]; }

    newGame() {
      JT.game = this;
      this.state = { v: VERSION, coins: 400, time: DAY * 0.3, catches: 0, species: JT.SPECIES.filter(s => s.starter).map(s => s.id), journal: {}, active: 0, slots: 3, timeMode: 'auto', customPresets: [], nextId: 1, habitats: [] };
      const a = new JT.Habitat({ name: 'Starter Terrarium', type: 'standard', substrate: 'coco', bg: 'mossy' }, this);
      JT.Presets.starter(a);
      const bolt = a.addSpider('bold', { name: 'Bolt', stage: 2, meals: 1, sat: 0.55 }); bolt.pos = a.randomFloorPoint(); bolt.sup = { k: 'floor' };
      a.addPrey('fruitfly', 5); a.addPrey('housefly', 1); a.addPrey('cricket', 1);
      const b = new JT.Habitat({ name: 'Canopy Habitat', type: 'arboreal' }, this); JT.Presets.generate(b, 'canopy', 7);
      const c = new JT.Habitat({ name: 'Wide Habitat', type: 'wide' }, this); JT.Presets.generate(c, 'meadow', 9);
      b.decor.forEach(d => { d.preset = true; }); c.decor.forEach(d => { d.preset = true; });
      this.habs = [a, b, c];
      this.selectedId = bolt.id;
      this.save();
    }
    load() {
      JT.game = this;
      const raw = Store.get(SAVE_KEY); if (!raw) return false;
      let data; try { data = JSON.parse(raw); } catch (e) { console.warn('Save unreadable; starting fresh but keeping a backup.'); Store.set(SAVE_KEY + '.corrupt', raw); return false; }
      try {
        data = Game.migrate(data);
        this.state = data;
        this.habs = (data.habitats || []).map(h => { const hab = new JT.Habitat(h, this); return hab; });
        delete this.state.habitats;
        if (!this.habs.length) return false;
        for (const h of this.habs) { h.rebuild(); for (const s of h.spiders) JT.SpiderAI.restore(h, s); h.validateRefs(); }
        this.state.active = M.clamp(this.state.active | 0, 0, this.habs.length - 1);
        return true;
      } catch (e) { console.error('Save restore failed', e); Store.set(SAVE_KEY + '.failed', raw); return false; }
    }
    static migrate(d) {
      d.v = d.v || 1;
      if (d.v < 2) { d.customPresets = d.customPresets || []; d.timeMode = d.timeMode || 'auto'; d.v = 2; }
      d.coins = isFinite(d.coins) ? d.coins : 400; d.journal = d.journal || {}; d.species = d.species || ['bold', 'regal', 'canopy'];
      d.slots = M.clamp(d.slots || 3, 1, 8); d.nextId = d.nextId || 1000;
      for (const h of d.habitats || []) { if (!JT.HABITATS[h.type]) h.type = 'standard'; if (!JT.SUBSTRATES[h.substrate]) h.substrate = 'coco'; if (!JT.BACKGROUNDS[h.bg]) h.bg = 'mossy'; h.decor = (h.decor || []).filter(x => JT.DECOR_BY_ID[x.type]); h.spiders = (h.spiders || []).filter(s => JT.SPECIES_BY_ID[s.species]); h.prey = (h.prey || []).filter(p => JT.PREY_BY_ID[p.type]); h.remains = h.remains || []; h.drops = h.drops || []; h.silk = h.silk || []; }
      return d;
    }
    serialize() { return JSON.stringify(Object.assign({}, this.state, { habitats: this.habs.map(h => h.data) }), replacer); }
    save() { if (!this.state) return; try { Store.set(SAVE_KEY, this.serialize()); } catch (e) { console.warn('Save failed', e); } }
    reset() { Store.del(SAVE_KEY); this.newGame(); }

    // ---------------- time ----------------
    tod() { return (this.state.time % DAY) / DAY; }
    day() { return Math.floor(this.state.time / DAY) + 1; }
    daylight() {
      if (this.state.timeMode === 'day') return 1; if (this.state.timeMode === 'night') return 0;
      const t = this.tod(); // sunrise ~0.22, sunset ~0.80
      return M.clamp(Math.sin((t - 0.2) / 0.62 * Math.PI) * 1.6, 0, 1);
    }
    tick(dt) {
      this.state.time += dt;
      const active = this.hab;
      active.update(dt, true);
      this._lite += dt;
      if (this._lite >= 1) { for (const h of this.habs) if (h !== active) h.update(this._lite, false); this._lite = 0; }
      for (const h of this.habs) h.data.age = (h.data.age || 0) + dt / DAY;
      this._saveT = (this._saveT || 0) + dt; if (this._saveT > 20) { this._saveT = 0; this.save(); }
      if (!this.state.species.includes('portia') && this.state.catches >= 30) { this.state.species.push('portia'); this.emit('toast', { text: '🕷 Portia unlocked — 30 successful catches!' }); }
    }

    // ---------------- events from simulation ----------------
    onEvent(hab, type, info) {
      const watched = hab === this.hab && this.viewing;
      if (type === 'meal') { this.state.coins += info.value || 0; this.state.catches++; if (watched) this.emit('coins', { amount: info.value, sp: info.sp }); }
      if (type === 'journal') { if (!watched) return; const id = info.id; const first = !this.state.journal[id]; this.state.journal[id] = (this.state.journal[id] || 0) + 1; if (first) { const e = JT.JOURNAL.find(j => j.id === id); if (e) this.emit('journal', { entry: e, sp: info.sp }); } return; }
      if (watched) this.emit(type, info);
    }
    spend(n) { if (this.state.coins < n) return false; this.state.coins -= n; this.emit('coins', { amount: -n }); return true; }
    refund(n) { this.state.coins += n; }

    // ---------------- habitat shelf ----------------
    buySlot() { const n = this.state.slots; if (n >= 8) return false; const price = JT.SLOT_PRICES[n]; if (!this.spend(price)) return false; this.state.slots++; return true; }
    createHabitat(type, name) {
      if (this.habs.length >= this.state.slots) return null; const price = Math.round(JT.HABITATS[type].price * 0.5);
      if (!this.spend(price)) return null;
      const h = new JT.Habitat({ name: name || JT.HABITATS[type].name, type }, this);
      JT.Presets.generate(h, (JT.Presets.forType(type)[0] || { theme: 'cork' }).theme);
      this.habs.push(h); return h;
    }
    /** Replace enclosure format; decor/animals are reconciled to the new geometry rather than corrupting the save. */
    changeType(hab, type) {
      const price = JT.HABITATS[type].price; if (!this.spend(price)) return false;
      const old = hab.dims; const items = hab.sortedDecor().map(d => Object.assign({}, d, { fx: d.x / old.w, fz: d.z / old.d }));
      hab.data.type = type; hab.data.decor = []; hab.rebuild();
      let refund = 0;
      for (const it of items) { const x = it.fx * hab.dims.w, z = it.fz * hab.dims.d; if (hab.canPlace(it.type, x, z, it.rot, it.seed).ok) hab.addDecor(it.type, x, z, it.rot, it.seed); else refund += Math.round(JT.DECOR_BY_ID[it.type].price * 0.5); }
      hab.decor.forEach(d => { d.novel = false; });
      const scaleE = (e) => { e.pos = [e.pos[0] / old.w * hab.dims.w, e.pos[1], e.pos[2] / old.d * hab.dims.d]; };
      hab.spiders.forEach(scaleE); hab.prey.forEach(scaleE); hab.data.remains.forEach(scaleE); hab.data.drops = []; hab.data.silk = [];
      while (hab.spiders.length > hab.dims.cap) { const s = hab.spiders[hab.spiders.length - 1]; hab.removeEntity(s, 'player'); refund += 20; }
      hab.rebuild(); for (const s of hab.spiders) JT.SpiderAI.restore(hab, s);
      for (const e of hab.spiders.concat(hab.prey, hab.data.remains)) { const b = JT.Nav.supportBelow(hab, [e.pos[0], 0.2, e.pos[2]]); if (!e.owner) { e.pos = b.pos; e.sup = b.sup; } }
      this.refund(refund); return true;
    }
  }
  JT.Game = Game;

  // Cosmetic settings: isolated from critical game state; malformed values never break the save.
  JT.Settings = {
    defaults: { quality: 'auto', hd2d: true, tilt: true, bloom: true, grain: true, music: 0.35, ambience: 0.5, effects: 0.6, muted: false, debug: false },
    load() { let s = {}; try { s = JSON.parse(Store.get(SET_KEY) || '{}') || {}; } catch (e) { s = {}; } const out = Object.assign({}, this.defaults); for (const k in this.defaults) if (typeof s[k] === typeof this.defaults[k]) out[k] = s[k]; return out; },
    save(s) { try { Store.set(SET_KEY, JSON.stringify(s)); } catch (e) { } },
  };
})(typeof window !== 'undefined' ? window : globalThis);
