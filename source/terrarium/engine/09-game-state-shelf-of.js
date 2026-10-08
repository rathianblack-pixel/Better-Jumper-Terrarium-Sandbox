/* Jumper Terrarium — game state: shelf of habitats, unlock chain, journal, time, persistence. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  const DAY = JT.DAY = 480;
  const PK = root.JT_PACK || {}; const SAVE_KEY = PK.saveKey || 'jumperTerrarium.v14.save', SET_KEY = PK.setKey || 'jumperTerrarium.settings', VERSION = 4;

  // localStorage can throw in privacy modes: every access is wrapped.
  const Store = JT.Store = {
    get(k) { try { return root.localStorage ? root.localStorage.getItem(k) : (Store._mem[k] || null); } catch (e) { return Store._mem[k] || null; } },
    set(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, v); else Store._mem[k] = v; return true; } catch (e) { Store._mem[k] = v; return false; } },
    del(k) { try { if (root.localStorage) root.localStorage.removeItem(k); } catch (e) { } delete Store._mem[k]; },
    _mem: {},
  };
  // Unlock chain: every species except catch-unlocks, smallest adult first (ties keep list order).
  JT.CATCH_UNLOCKS = JT.SPECIES.filter(S => S.unlockCatches).map(S => S.id);
  JT.SPECIAL_UNLOCKS = JT.SPECIES.filter(S => S.unlock).map(S => S.id);
  JT.UNLOCK_ORDER = JT.SPECIES.map((S, i) => [S, i]).filter(x => !x[0].unlockCatches && !x[0].unlock).sort((a, b) => a[0].len - b[0].len || a[1] - b[1]).map(x => x[0].id);
  JT.unlockPrev = (id) => { const i = JT.UNLOCK_ORDER.indexOf(id); return i > 0 ? JT.UNLOCK_ORDER[i - 1] : null; };
  JT.PER_SPECIES = 2; // most jumpers of one species per tank
  const replacer = (k, v) => (k && k[0] === '_') ? undefined : v;

  class Game {
    constructor() { this.listeners = []; this.habs = []; this.state = null; this.viewing = true; this._lite = 0; }
    on(fn) { this.listeners.push(fn); }
    emit(type, data) { for (const f of this.listeners) { try { f(type, data); } catch (e) { console.error(e); } } }
    get hab() { return this.habs[this.state.active] || this.habs[0]; }

    newGame() {
      JT.game = this;
      const first = JT.UNLOCK_ORDER[0];
      this.state = { v: VERSION, time: DAY * 0.3, catches: 0, species: [first], best: {}, journal: {}, jmeta: {}, active: 0, timeMode: 'auto', customPresets: [], nextId: 1, habitats: [], cup: [] };
      const tall = Game.isPortrait();
      const a = tall ? new JT.Habitat({ name: 'Moss Tower', type: 'tower', substrate: 'moss', bg: 'mossy' }, this) : new JT.Habitat({ name: 'Starter Terrarium', type: 'standard', substrate: 'coco', bg: 'mossy' }, this);
      if (tall) JT.Presets.tower(a); else JT.Presets.starter(a);
      const pip = a.addSpider(first, { name: 'Pip', stage: 1, meals: 1, sat: 0.55 }); pip.pos = a.randomFloorPoint(); pip.sup = { k: 'floor' };
      a.addPrey('aphid', 8); a.addPrey('fruitfly', 5); a.addPrey('gnat', 6);
      this.habs = [a];
      this.selectedId = pip.id;
      this.checkUnlocks(true);
      this.save();
    }
    load() {
      JT.game = this;
      const raw = Store.get(SAVE_KEY); if (!raw) return false;
      let data; try { data = JSON.parse(raw); } catch (e) { console.warn('Save unreadable; starting fresh but keeping a backup.'); Store.set(SAVE_KEY + '.corrupt', raw); return false; }
      // saves from before the coin-free rework start over (kept aside under .pre4, never loaded again)
      if (!data || typeof data !== 'object' || !(data.v >= VERSION)) { Store.set(SAVE_KEY + '.pre4', raw); Store.del(SAVE_KEY); this._wiped = true; return false; }
      try {
        data = Game.migrate(data);
        this.state = data;
        this.habs = (data.habitats || []).map(h => { const hab = new JT.Habitat(h, this); return hab; });
        delete this.state.habitats;
        if (!this.habs.length) return false;
        for (const h of this.habs) { h.rebuild(); for (const s of h.spiders) JT.SpiderAI.restore(h, s); h.validateRefs(); }
        this.state.active = M.clamp(this.state.active | 0, 0, this.habs.length - 1);
        this.habs.forEach((h, k) => { if (k !== this.state.active && h.data.leftAt == null) h.data.leftAt = this.state.time; }); // v11: paused tanks catch up from here
        this.checkUnlocks(true);
        return true;
      } catch (e) { console.error('Save restore failed', e); Store.set(SAVE_KEY + '.failed', raw); return false; }
    }
    static isPortrait() { return !!(root.matchMedia && root.matchMedia('(orientation: portrait) and (max-width: 820px)').matches); }
    static migrate(d) {
      // v4 (coin-free): no balance, no shelf slots, species unlock in a chain; strip any leftover economy fields
      delete d.coins; delete d.jpaid; delete d.paidDay; delete d.slots; delete d.towerGift;
      d.journal = d.journal || {}; d.jmeta = d.jmeta || {}; d.best = d.best || {};
      d.species = (Array.isArray(d.species) ? d.species : []).filter(id => JT.SPECIES_BY_ID[id]); if (!d.species.length) d.species = [JT.UNLOCK_ORDER[0]];
      d.customPresets = d.customPresets || []; d.cup = Array.isArray(d.cup) ? d.cup.filter(x => x && JT.SPECIES_BY_ID[x.species]) : []; d.timeMode = d.timeMode || 'auto'; d.nextId = d.nextId || 1000; d.catches = d.catches | 0;
      for (const h of d.habitats || []) { if (!JT.HABITATS[h.type]) h.type = 'standard'; if (!JT.SUBSTRATES[h.substrate]) h.substrate = 'coco'; if (!JT.BACKGROUNDS[h.bg]) h.bg = 'mossy'; h.decor = (h.decor || []).filter(x => JT.DECOR_BY_ID[x.type]); h.spiders = (h.spiders || []).filter(s => JT.SPECIES_BY_ID[s.species]); h.prey = (h.prey || []).filter(p => JT.PREY_BY_ID[p.type]); h.remains = (h.remains || []).filter(r => r && r.pos); for (const r of h.remains) if (!isFinite(r.clean)) r.clean = 1; h.drops = h.drops || []; h.silk = h.silk || []; for (const x of h.decor) if (x.type === 'heatlamp' && x.on == null) x.on = true; }
      return d;
    }
    serialize() { return JSON.stringify(Object.assign({}, this.state, { habitats: this.habs.map(h => h.data) }), replacer); }
    save() { if (!this.state) return; try { Store.set(SAVE_KEY, this.serialize()); } catch (e) { console.warn('Save failed', e); } }
    reset() { Store.del(SAVE_KEY); this.newGame(); }
    /** Replace the save with an exported one (moving progress between the browser and the installed app). */
    importSave(text) {
      let d; try { d = JSON.parse(text); } catch (e) { return false; }
      if (!d || typeof d !== 'object' || !Array.isArray(d.habitats) || !d.habitats.length || !(d.v >= VERSION)) return false;
      const keep = Store.get(SAVE_KEY); Store.set(SAVE_KEY, JSON.stringify(d));
      try { if (this.load()) { const h = this.hab; if (h && !h.spider(this.selectedId)) this.selectedId = h.spiders[0] ? h.spiders[0].id : null; this.save(); return true; } } catch (e) { console.warn(e); }
      if (keep) Store.set(SAVE_KEY, keep); try { this.load(); } catch (e) { } return false;
    }

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
      if (JT.Biome) JT.Biome.tick(active, dt);
      // v11: tanks you are not viewing are paused (no cost); they catch up when you come back (see catchUp)
      this._lite += dt;
      if (this._lite >= 1) { this._lite = 0; this.checkUnlocks(); }
      active.data.age = (active.data.age || 0) + dt / DAY;
      this._saveT = (this._saveT || 0) + dt; if (this._saveT > 20) { this._saveT = 0; this.save(); }
    }

    // ---------------- events from simulation ----------------
    /** v11: what each jumper has caught, for its profile page (favourite + biggest). */
    tallyPrey(sp, prey) {
      if (!sp || !prey) return; const n = sp.preyN || (sp.preyN = {}); n[prey.type] = (n[prey.type] | 0) + 1;
      const r = JT.SpiderAI.ratioOf ? JT.SpiderAI.ratioOf(sp, prey) : 0; if (isFinite(r) && (!sp.bigPrey || r > sp.bigPrey.r)) sp.bigPrey = { t: prey.type, r: Math.round(r * 100) / 100, d: this.day() };
    }
    /** A dated line in a jumper's life story (kept small: the first entry plus the latest 39). */
    diary(sp, text) {
      if (!sp) return; const D = sp.diary || (sp.diary = []); const day = this.day();
      if (D.length && D[D.length - 1].t === text) return; D.push({ d: day, t: text }); if (D.length > 40) D.splice(1, 1);
    }
    onEvent(hab, type, info) {
      const watched = hab === this.hab && this.viewing; const sp = info && info.sp;
      if (type === 'meal') { this.state.catches++; if (sp && [10, 25, 50, 100, 200].includes(sp.catches)) this.diary(sp, sp.catches + ' meals caught so far.'); }
      else if (type === 'catch' && sp) { const pd = info.prey && JT.PREY_BY_ID[info.prey.type]; if (pd) this.tallyPrey(sp, info.prey);
        const Sx = JT.SPECIES_BY_ID[sp.species]; if (Sx && Sx.hybrid && pd) { if (Sx.sig === 'glass' && (info.prey.alert || 0) < 0.6) hab.event('journal', { id: 'glassGhost', sp }); if (Sx.sig === 'ember' && hab.daylight() < 0.3) hab.event('journal', { id: 'emberNight', sp }); } const nm = pd ? (JT.SpiderAI.preyName ? JT.SpiderAI.preyName(pd) : pd.name.toLowerCase()).replace(/springtail colony/, 'springtail') : 'prey';
        if (!sp.catches) this.diary(sp, 'First catch: ' + (/^[aeiou]/.test(nm) ? 'an ' : 'a ') + nm + '.'); else if (pd && JT.SpiderAI.ratioOf && JT.SpiderAI.ratioOf(sp, info.prey) > 1.15 && !(sp._dBig > this.state.time - 600)) { sp._dBig = this.state.time; this.diary(sp, 'Took down ' + (/^[aeiou]/.test(nm) ? 'an ' : 'a ') + nm + ' bigger than itself.'); } }
      else if (type === 'molt' && sp) (sp.stageAt || (sp.stageAt = {}))[sp.stage] = this.day(), this.diary(sp, sp.stage >= 5 ? 'Final molt: now a fully grown adult.' : 'Molted into a ' + JT.STAGES[sp.stage].toLowerCase() + '.');
      else if (type === 'finger' && sp && info.kind === 'curious') { const lv = sp.tame >= 0.7 ? 2 : sp.tame >= 0.35 ? 1 : 0; if (lv > (sp.tameMark | 0)) { sp.tameMark = lv; this.diary(sp, lv === 2 ? 'Knows you now: greets your finger without a flinch.' : 'Getting used to you: came over to see your finger.'); } }
      if (type === 'journal') { if (!watched) return; const id = info.id; const first = !this.state.journal[id]; this.state.journal[id] = (this.state.journal[id] || 0) + 1;
        const e = JT.JOURNAL.find(j => j.id === id);
        if (sp && e) { const js = sp.jseen || (sp.jseen = {}); if (!js[id]) { js[id] = this.day(); if (!['molt', 'adult', 'firstHunt'].includes(id)) this.diary(sp, 'You saw: ' + e.title + '.'); } }
        if (first) { const jm = this.state.jmeta || (this.state.jmeta = {}); jm[id] = { d: this.day(), n: sp ? sp.name : '', s: sp ? sp.species : '' }; if (e) this.emit('journal', { entry: e, sp }); this.checkUnlocks(); } return; }
      if (watched) this.emit(type, info);
      if (type === 'molt' || type === 'meal' || type === 'finger') this.checkUnlocks();
    }

    // ---------------- collection: unlock chain ----------------
    isUnlocked(id) { return this.state.species.includes(id); }
    /** Record the highest stage each species has reached (kept even after rehoming), then unlock whatever is newly earned.
        Chain species open when the one before them reaches Adult; catch-unlock species (Portia) open at their catch count. */
    checkUnlocks(quiet) {
      const st = this.state; const best = st.best || (st.best = {});
      for (const h of this.habs) for (const s of h.spiders) if (!(best[s.species] >= s.stage)) best[s.species] = s.stage;
      for (const id of JT.UNLOCK_ORDER.concat(JT.CATCH_UNLOCKS, JT.SPECIAL_UNLOCKS || [])) {
        if (st.species.includes(id)) continue; const S = JT.SPECIES_BY_ID[id];
        let why = null;
        if (S.unlock) { const u = S.unlock; const nJ = JT.JOURNAL.filter(j => st.journal[j.id]).length;
          if (u.journal && nJ >= u.journal) why = 'You witnessed ' + u.journal + ' different behaviours.';
          if (u.tame && this.habs.some(h => h.spiders.some(x => (x.tame || 0) >= u.tame))) why = 'One of your jumpers got to know you.';
          if (u.parents && u.parents.every(pid => best[pid] >= 5)) why = 'Your ' + u.parents.map(pid => JT.SPECIES_BY_ID[pid].name).join(' and ') + ' both reached adulthood: a hybrid has appeared!'; }
        else if (S.unlockCatches) { if (st.catches >= S.unlockCatches) why = 'Reached ' + S.unlockCatches + ' successful catches.'; }
        else { const prev = JT.unlockPrev(id); if (prev && best[prev] >= 5) why = 'Your ' + JT.SPECIES_BY_ID[prev].name + ' reached adulthood.'; }
        if (why) { st.species.push(id); if (!quiet) this.emit('unlock', { S, why }); }
      }
    }
    /** Can one more of this species join this habitat? (unlocked, room in the tank, at most JT.PER_SPECIES per tank) */
    canAdd(h, id) {
      if (!this.isUnlocked(id)) return { ok: false, reason: 'locked' };
      if (h.spiders.length >= h.dims.cap) return { ok: false, reason: 'Habitat full (' + h.dims.cap + ')' };
      if (h.spiders.filter(s => s.species === id).length >= JT.PER_SPECIES) return { ok: false, reason: JT.PER_SPECIES + ' per tank already' };
      return { ok: true };
    }

    // ---------------- habitat shelf ----------------
    createHabitat(type, name) {
      if (this.habs.length >= JT.MAX_HABS) return null;
      const h = new JT.Habitat({ name: name || JT.HABITATS[type].name, type }, this); // blank canvas: substrate only
      h.data.leftAt = this.state.time; h.data.visitAt = this.state.time;
      this.habs.push(h); return h;
    }
    /** v11: switch the running tank. The one left behind is paused; the one opened first catches up on the time it missed. */
    activate(i) {
      i = M.clamp(i | 0, 0, this.habs.length - 1); const old = this.hab; const nh = this.habs[i]; if (!nh) return null;
      if (old && old !== nh) old.data.leftAt = this.state.time;
      const rep = nh !== old ? this.catchUp(nh) : null; // before it becomes the watched tank, so catch-up meals stay quiet
      this.state.active = i; nh.data.visitAt = this.state.time; nh.data.leftAt = null; return rep;
    }
    /** Simplified time passing for a paused tank (hunger, thirst, age, the odd meal), up to 3 days; no full simulation. */
    catchUp(h) {
      const t = this.state.time, from = h.data.leftAt; h.data.leftAt = null; if (from == null || !(t > from)) return null;
      let left = Math.min(t - from, DAY * 3); const m0 = new Map(h.spiders.map(x => [x.id, x.meals | 0]));
      while (left > 1e-6) { const d = Math.min(5, left); h.update(d, false); left -= d; }
      h.data.age = (h.data.age || 0) + Math.min(t - from, DAY * 3) / DAY;
      const meals = h.spiders.map(x => [x, (x.meals | 0) - (m0.get(x.id) || 0)]).filter(e => e[1] > 0);
      h.validateRefs(); return { secs: t - from, meals };
    }
    /** v11: projected needs of a paused tank (what catch-up would show), for the tank list. */
    tankStatus(h) {
      const idle = h === this.hab ? 0 : Math.max(0, this.state.time - (h.data.leftAt != null ? h.data.leftAt : this.state.time));
      const out = { hungry: [], thirsty: [], molting: [], food: h.livePreyCount(), score: 0 };
      for (const x of h.spiders) { const sat = Math.max(Math.min(x.sat, 0.2), x.sat - idle * 0.00094), hyd = Math.max(Math.min(x.hyd != null ? x.hyd : 1, 0.25), (x.hyd != null ? x.hyd : 1) - idle * 0.0005);
        if (sat < 0.35) out.hungry.push(x); if (hyd < 0.4) out.thirsty.push(x); if (/^(premolt|moltSeek|moltSilk|molting)$/.test(x.state) || x.soft > 0) out.molting.push(x); }
      out.score = out.hungry.length * 3 + out.thirsty.length * 2 + (h.spiders.length && !out.food ? 2 : 0) + out.molting.length; return out;
    }
    /** Copy a tank's layout (substrate, background, decor) into a new empty tank. */
    duplicateHabitat(h) {
      if (this.habs.length >= JT.MAX_HABS) return null;
      const n = this.createHabitat(h.data.type); if (!n) return null;
      const items = h.sortedDecor().map(d => ({ type: d.type, fx: d.x / h.dims.w, fz: d.z / h.dims.d, rot: d.rot, seed: d.seed, my: d.my, bare: d.bare || undefined }));
      JT.Presets.applyCustom(n, { items, sub: h.data.substrate, bg: h.data.bg }); n.decor.forEach(d => { d.preset = true; });
      if (h.data.terrain) n.data.terrain = JSON.parse(JSON.stringify(h.data.terrain)); return n; // v15: same ground shape
    }
    /** Delete a tank: its jumpers wait in the holding cup. The last tank cannot be deleted. */
    deleteHabitat(h) {
      const i = this.habs.indexOf(h); if (i < 0 || this.habs.length <= 1) return false;
      for (const x of h.spiders.slice()) this.moveSpider(x, h, 'cup', true);
      const wasActive = i === this.state.active; this.habs.splice(i, 1);
      if (wasActive) { this.state.active = Math.min(i, this.habs.length - 1); const nh = this.hab; this.catchUp(nh); nh.data.visitAt = this.state.time; nh.data.leftAt = null; }
      else if (i < this.state.active) this.state.active--;
      return true;
    }
    /** Move a jumper between tanks or to/from the holding cup ('cup'). Returns { ok, reason }. */
    moveSpider(sp, from, to, force) {
      if (!sp) return { ok: false, reason: 'No jumper' };
      if (!force && /^(premolt|moltSilk|molting)$/.test(sp.state)) return { ok: false, reason: sp.name + ' is molting. Let it finish first.' };
      if (to && to !== 'cup') {
        if (to === from) return { ok: false, reason: 'Already here' };
        if (to.spiders.length >= to.dims.cap) return { ok: false, reason: 'That tank is full (' + to.dims.cap + ')' };
        if (to.spiders.filter(x => x.species === sp.species).length >= JT.PER_SPECIES) return { ok: false, reason: JT.PER_SPECIES + ' of this species there already' };
      }
      if (from && from !== 'cup') from.removeEntity(sp, 'player'); else this.state.cup = (this.state.cup || []).filter(x => x !== sp);
      sp.hold = null; sp.target = null; sp.threat = null; sp.home = null; sp.retreat = null; sp.state = 'idle'; sp.st = 0; sp.thought = 'Settling in and looking around.';
      for (const k of Object.keys(sp)) if (k[0] === '_') delete sp[k];
      if (to === 'cup' || !to) { sp.pos = [0, 0, 0]; sp.sup = { k: 'floor' }; (this.state.cup || (this.state.cup = [])).push(sp); this.diary(sp, 'Waiting in the holding cup.'); }
      else { sp.pos = to.randomFloorPoint(); sp.sup = { k: 'floor' }; to.data.spiders.push(sp); JT.SpiderAI.restore(to, sp); to.validateRefs(); const tn = to.dims.name.toLowerCase(); this.diary(sp, 'Moved into ' + (/^[aeiou]/.test(tn) ? 'an ' : 'a ') + tn + '.'); }
      return { ok: true };
    }
    /** Replace enclosure format; decor/animals are reconciled to the new geometry rather than corrupting the save. */
    changeType(hab, type) {
      const old = hab.dims; const items = hab.sortedDecor().map(d => Object.assign({}, d, { fx: d.x / old.w, fz: d.z / old.d }));
      hab.data.type = type; hab.data.decor = []; hab.rebuild();
      for (const it of items) { const x = it.fx * hab.dims.w, z = it.fz * hab.dims.d; if (hab.canPlace(it.type, x, z, it.rot, it.seed, null, it.my).ok) hab.addDecor(it.type, x, z, it.rot, it.seed, false, it.my); }
      hab.decor.forEach(d => { d.novel = false; });
      const scaleE = (e) => { e.pos = [e.pos[0] / old.w * hab.dims.w, e.pos[1], e.pos[2] / old.d * hab.dims.d]; };
      hab.spiders.forEach(scaleE); hab.prey.forEach(scaleE); hab.data.remains.forEach(scaleE); hab.data.drops = []; hab.data.silk = [];
      while (hab.spiders.length > hab.dims.cap) { const s = hab.spiders[hab.spiders.length - 1]; this.moveSpider(s, hab, 'cup', true); } // v11: extra jumpers wait in the holding cup
      hab.rebuild(); for (const s of hab.spiders) JT.SpiderAI.restore(hab, s);
      for (const e of hab.spiders.concat(hab.prey, hab.data.remains)) { const b = JT.Nav.supportBelow(hab, [e.pos[0], 0.2, e.pos[2]]); if (!e.owner) { e.pos = b.pos; e.sup = b.sup; } }
      return true;
    }
  }
  JT.Game = Game;

  // Cosmetic settings: isolated from critical game state; malformed values never break the save.
  JT.Settings = {
    defaults: { quality: 'auto', fps: 'auto', music: 0.35, ambience: 0.5, effects: 0.6, muted: false, haptics: true, tips: true, tipsSeen: {} },
    load() { let s = {}; try { s = JSON.parse(Store.get(SET_KEY) || '{}') || {}; } catch (e) { s = {}; } const out = Object.assign({}, this.defaults); for (const k in this.defaults) if (typeof s[k] === typeof this.defaults[k] && s[k] !== null) out[k] = s[k]; out.tipsSeen = Object.assign({}, out.tipsSeen); return out; },
    save(s) { try { Store.set(SET_KEY, JSON.stringify(s)); } catch (e) { } },
  };
})(typeof window !== 'undefined' ? window : globalThis);
