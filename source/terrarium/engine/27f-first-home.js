/* First Home v1. Save-backed, action-driven onboarding. Existing games and additional tanks keep their original workflow. */
(function (root) {
  'use strict';
  const J = root.JT, U = J.UI, B = J.Biome, D = root.document;
  const KEY = 'jumperTerrarium.v14.save', VERSION = 1;
  const el = (tag, cls, text) => { const n = D.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (text, id, fn, cls) => { const b = el('button', cls || 'fh-button', text); b.type = 'button'; if (id) b.id = id; b.onclick = fn; return b; };
  const visible = n => !!(n && !n.hidden && n.getBoundingClientRect().width && n.getBoundingClientRect().height && getComputedStyle(n).visibility !== 'hidden');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const FH = J.FirstHome = {
    data(g) { return g && g.state && g.state.firstHome; },
    active(g) { const s = this.data(g); return !!(s && s.v === VERSION && s.phase !== 'done'); },
    paused(g) { const s = this.data(g); return this.active(g) && s.phase !== 'watch'; },
    save() { U.game.save(); },
    name() { return String(this.data(U.game).name || 'Pip').trim().slice(0, 24) || 'Pip'; },
    phase(next) {
      const s = this.data(U.game); if (!s || s.phase === next) return;
      s.phase = next; this.save(); this.render();
    },
    backup(g) { const raw = J.Store.get(KEY); if (raw) J.Store.set(KEY + '.before-new', raw); },
  };

  // An actual empty habitat is kept for renderer/save invariants, never a hidden populated starter.
  J.Game.prototype.startFirstHome = function () {
    J.game = this;
    const sid = J.UNLOCK_ORDER[0], bid = B.rank(sid)[0];
    this.state = { v: 4, time: J.DAY * .3, catches: 0, species: [sid], best: {}, journal: {}, jmeta: {}, active: 0,
      timeMode: 'auto', customPresets: [], nextId: 1, habitats: [], cup: [], simRevision: 1, buildVersion: 14, biomeSetup: true,
      firstHome: { v: VERSION, phase: 'choose', step: 0, type: 'nano', sid, bid, name: 'Pip', seed: (Math.random() * 0xffffffff) >>> 0 || 1 } };
    const h = new J.Habitat({ type: 'nano', name: 'Your first home' }, this);
    B.setBiome(h, bid); B.applyGround(h, bid); h.data.buildSpecies = sid;
    h.data.backgroundAt = this.state.time; this.habs = [h]; this.state.firstHome.tankId = h.data.id;
    this.selectedId = null; this._lite = this._saveT = 0; this.save();
  };
  const reset0 = J.Game.prototype.reset;
  J.Game.prototype.reset = function () {
    if (U.game !== this) return reset0.apply(this, arguments);
    FH.backup(this); FH.teardown(); U.cancelMode(); U.closeDrawer();
    if (U.obs) U.toggleObserve(false);
    this.startFirstHome(); U.R.cur = null; U.R.resetView(); U.R.resetCaches(); FH.render();
  };
  const tick0 = J.Game.prototype.tick;
  J.Game.prototype.tick = function (dt) { if (FH.paused(this)) return; return tick0.call(this, dt); };
  const catch0 = J.Game.prototype.catchUp;
  J.Game.prototype.catchUp = function (h) { if (FH.active(this)) { if (h) h.data.backgroundAt = this.state.time; return null; } return catch0.call(this, h); };
  const tips0 = U.tipOnce;
  U.tipOnce = function () { if (FH.active(this.game)) return; return tips0.apply(this, arguments); };
  const tipsPump0 = U.pumpTips;
  if (tipsPump0) U.pumpTips = function () { if (FH.active(this.game)) return; return tipsPump0.apply(this, arguments); };
  const wizard0 = U.biomeWizard;
  U.biomeWizard = function (first) {
    if (first && FH.active(this.game)) { FH.render(); return; }
    return wizard0.apply(this, arguments);
  };
  const init0 = U.init;
  U.init = function () { const out = init0.apply(this, arguments); setTimeout(() => { if (FH.active(this.game)) FH.render(); }, 0); return out; };

  FH.previewTank = function (type) {
    const h = U.hab; if (h.data.type === type) return;
    h.data.type = type; h.rebuild(); U.R.cur = null; U.R.resetView(); U.R.resetCaches();
  };
  FH.tankGlyph = function (type) {
    const t = J.HABITATS[type], cv = el('canvas', 'fh-tank-glyph'); cv.width = 200; cv.height = 128;
    cv.setAttribute('aria-hidden', 'true'); const c = cv.getContext('2d');
    const sc = Math.min(130 / t.w, 85 / t.h), w = t.w * sc, h = t.h * sc, x = (200 - w - 20) / 2, y = (128 - h) / 2 + 7;
    c.lineWidth = 2; c.strokeStyle = '#66734c'; c.fillStyle = '#dce5ce';
    c.beginPath(); c.moveTo(x,y); c.lineTo(x+20,y-12); c.lineTo(x+w+20,y-12); c.lineTo(x+w,y); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(123,151,102,.08)'; c.fillRect(x,y,w,h); c.strokeRect(x,y,w,h);
    c.beginPath(); c.moveTo(x+w,y); c.lineTo(x+w+20,y-12); c.lineTo(x+w+20,y+h-12); c.lineTo(x+w,y+h); c.stroke();
    c.fillStyle = '#b6a17c'; c.fillRect(x+2,y+h-8,w-4,6); return cv;
  };
  FH.portrait = function (sid, size) {
    const source = U.R.speciesPortrait(sid, size || 160), cv = el('canvas', 'fh-portrait');
    cv.width = source.width; cv.height = source.height; cv.getContext('2d').drawImage(source, 0, 0);
    cv.setAttribute('aria-hidden', 'true'); return cv;
  };
  FH.picker = function () {
    this.removeOverlay(); D.body.classList.add('fh-wizard');
    const s = this.data(U.game), w = el('div', 'fh-picker'), stages = ['Your tank', 'Your jumper', 'Their habitat'];
    s.step = Math.max(0, Math.min(2, s.step | 0)); w.dataset.fhStep = String(s.step);
    w.append(el('p', 'fh-eyebrow', `YOUR FIRST HOME · ${s.step + 1} OF 3`));
    const progress = el('div', 'fh-progress'); progress.setAttribute('aria-label', stages.map((x,i) => `${i+1}. ${x}${i===s.step?' (current)':''}`).join(', '));
    stages.forEach((x,i) => progress.append(el('span', i <= s.step ? 'is-current' : '', x))); w.append(progress);
    const titles = ['A small world, made by you.', 'Meet your first little resident.', `Let’s get ${this.name()}’s home ready.`];
    w.append(el('h3', 'fh-title', titles[s.step]));
    const grid = el('div', 'fh-choices'); w.append(grid);
    const pick = (id, title, note, selected, fn, art) => {
      const p = button('', '', fn, 'fh-choice' + (selected ? ' is-selected' : '')); p.dataset.fhChoice = id; p.setAttribute('aria-pressed', String(selected));
      if (art) p.append(art); const text = el('span', 'fh-choice-copy'); text.append(el('strong','',title), el('span','fh-note',note)); p.append(text); grid.append(p); return p;
    };
    if (s.step === 0) {
      w.insertBefore(el('p','fh-copy','Start small and get to know one jumper. You can create more tanks later.'), grid);
      const ids = s.allTanks ? ['nano', ...Object.keys(J.HABITATS).filter(id => id !== 'nano')] : ['nano'];
      for (const id of ids) {
        const t = J.HABITATS[id];
        const p = pick(id, t.name, id === 'nano' ? 'A cosy, focused home for one jumper.' : `${t.cap} jumper capacity · ${t.w} × ${t.d} × ${t.h} game units`, s.type === id, () => { s.type = id; this.previewTank(id); this.save(); this.picker(); }, this.tankGlyph(id));
        if (id === 'nano') p.querySelector('.fh-choice-copy').prepend(el('span','fh-badge','Recommended first tank'));
      }
      w.append(button(s.allTanks ? 'Show just the recommended tank' : `See all ${Object.keys(J.HABITATS).length} tanks`, 'fhAllTanks', () => { s.allTanks = !s.allTanks; this.save(); this.picker(); }, 'fh-link'));
      if (!s.allTanks && s.type !== 'nano') { const t = J.HABITATS[s.type]; w.append(el('p','fh-note',`Selected: ${t.name}. Open all tanks to change it.`)); }
    } else if (s.step === 1) {
      for (const sid of U.game.state.species) {
        const sp = J.SPECIES_BY_ID[sid]; if (!sp) continue;
        pick(sid, sp.name, sp.desc, s.sid === sid, () => { s.sid = sid; s.bid = B.rank(sid)[0]; this.save(); this.picker(); }, this.portrait(sid));
      }
      const label = el('label','fh-label','What would you like to call them?'); label.htmlFor = 'fhName';
      const name = el('input','fh-name'); name.id = 'fhName'; name.type = 'text'; name.maxLength = 24; name.value = s.name; name.placeholder = 'Pip'; name.autocomplete = 'off';
      name.oninput = () => { s.name = name.value; this.save(); };
      w.append(label, name, el('p','fh-note','Optional · you can rename them later. Raise a jumper to Adult to unlock the next species.'));
    } else {
      const ranked = B.rank(s.sid), ids = s.allBiomes ? ranked : ranked.filter(id => B.fit(s.sid,id) >= .6);
      if (!ids.includes(s.bid)) ids.unshift(s.bid);
      w.insertBefore(el('p','fh-copy','A matching climate makes settling in easier. Furnishings come next—nothing living is added yet.'), grid);
      for (const bid of ids) {
        const b = J.BIOMES[bid], fit = B.fit(s.sid,bid);
        pick(bid, b.name, `${fit >= .95 ? 'Recommended' : fit >= .6 ? 'Suitable' : 'Experimental · out of place'} · ${b.short}`, s.bid === bid, () => { s.bid = bid; B.setBiome(U.hab,bid); B.applyGround(U.hab,bid); U.R.resetCaches(); this.save(); this.picker(); });
      }
      w.append(button(s.allBiomes ? 'Show suitable habitats' : 'More options · experimental climates', 'fhAllBiomes', () => { s.allBiomes = !s.allBiomes; this.save(); this.picker(); }, 'fh-link'));
      if (B.fit(s.sid,s.bid) < .6) w.append(el('p','fh-warning','This is not a home climate for your jumper. You can experiment, or choose a recommended habitat.'));
    }
    const footer = el('div','bm-actions fh-picker-actions');
    footer.append(button(s.step ? 'Back' : 'Title screen','fhBack', () => {
      if (s.step) { s.step--; this.save(); this.picker(); } else { this.save(); root.location.href = 'index.html'; }
    }));
    footer.append(button(s.step === 2 ? 'Prepare their home' : 'Continue','fhNext', () => {
      s.name = this.name();
      if (s.step < 2) { s.step++; this.save(); this.picker(); }
      else this.createHome();
    },'fh-button fh-primary')); w.append(footer);
    U.openModal('Your first terrarium', w, {back:null, sheet:'first-home'});
    // The existing modal layout manager moves bm-actions into non-scrolling chrome.
    D.getElementById('modalBody').scrollTop = 0;
    const focus = D.getElementById('fhNext'); if (focus) focus.focus({preventScroll:true});
  };
  FH.createHome = function () {
    const g = U.game, s = this.data(g); if (s.phase !== 'choose') return;
    if (!J.HABITATS[s.type] || !g.isUnlocked(s.sid) || !J.BIOMES[s.bid]) return;
    const h = g.hab; h.data.type = s.type; h.data.buildSpecies = s.sid;
    B.setBiome(h, s.bid); B.applyGround(h,s.bid); h.rebuild(); s.tankId = h.data.id;
    s.name = this.name(); s.phase = 'build'; g.state.biomeSetup = false; g.state.lastBiome = s.bid;
    D.body.classList.remove('fh-wizard'); U.closeModal(); U.R.cur = null; U.R.resetView(); U.R.resetCaches();
    U._bmQuery = ''; U._bmFilter = 'suitable'; this.save(); this.render();
  };
  FH.furnish = function () {
    const g = U.game, s = this.data(g), h = g.hab;
    // Generate off to the side: Apply cannot erase the piece the player just placed.
    const previous = J.game, rng = J.R, decorBefore = JSON.parse(JSON.stringify(h.data.decor)), furnishedBefore = s.furnished;
    let fake, generated;
    try {
      fake = new J.Game(); fake.state = JSON.parse(JSON.stringify(g.state)); fake.habs = []; fake.save = () => {};
      J.game = fake; J.R = J.makeRng(s.seed);
      generated = new J.Habitat({type:h.data.type},fake); fake.habs = [generated];
      B.setBiome(generated,s.bid);
      if (s.bid === 'classic') { const p = J.Presets.forType(s.type)[0]; if (p) J.Presets.generate(generated,p.theme,s.seed,true); }
      else B.layout(generated,s.bid,s.seed);
      // Compact generated pieces are revalidated by the actual tank, including overlap with player decor.
      for (const d of generated.decor) {
        if (d.parent || d.wall) continue;
        const added = h.addDecor(d.type,d.x,d.z,d.rot,d.seed,false,d.my,{bare:d.bare}); if (added) added.preset = true;
      }
      if (!h.decor.length) throw new Error('No furnishings could be placed. Try placing a small piece first.');
      if (!h.decor.some(d => (J.DECOR_BY_ID[d.type]||{}).water)) {
        for (let z = 10; z < h.dims.d-8; z += 10) {
          let placed = false;
          for (let x = 10; x < h.dims.w-8; x += 10) if (h.addDecor('waterdish',x,z,0,s.seed)) { placed = true; break; }
          if (placed) break;
        }
      }
      s.furnished = true; g.state.nextId = Math.max(g.state.nextId,fake.state.nextId);
      h.rebuild(); U.R.resetCaches(); if (U.undoClear) U.undoClear();
    } catch (error) {
      h.data.decor = decorBefore; s.furnished = furnishedBefore; h.rebuild(); U.R.resetCaches(); throw error;
    } finally {
      // Restore globals even if layout generation fails; release the disposable scene's GPU geometry.
      J.game = previous; J.R = rng;
      if (fake) g.state.nextId = Math.max(g.state.nextId, fake.state.nextId);
      if (generated) for (const geo of Object.values(generated.geoms||{})) if (geo._mesh && geo._mesh.gl && geo._mesh.gl.free) geo._mesh.gl.free(geo._mesh);
    }
  };
  FH.ensureSpider = function () {
    const g = U.game, s = this.data(g), h = g.hab;
    let sp = h.spider(s.spiderId) || h.spiders.find(x => x.species === s.sid);
    if (!sp) {
      const check = g.canAdd(h,s.sid); if (!check.ok) throw new Error(check.reason);
      sp = h.addSpider(s.sid,{name:this.name(),stage:1,meals:0,sat:.48});
      if (!sp) throw new Error('Your jumper could not be added. Please try again.');
    }
    s.spiderId = sp.id; g.selectedId = sp.id; h.data.selectedId = sp.id;
    g.checkUnlocks(true); U.refreshHeader(); return sp;
  };
  FH.prey = function () {
    const h = U.hab, s = this.data(U.game), sp = h.spider(s.spiderId) || h.spiders[0]; if (!sp) return null;
    const A = J.SpiderAI, len = A.len(sp), limit = Math.min(1.25,A.sizeLimit(sp));
    const options = J.PREY.filter(p => p.huntable !== false && !p.cleaner && !(p.danger > 0) && p.nut > 0 && p.len <= len * limit && p.len >= len * .12);
    const native = B.of(h).prey || [];
    options.sort((a,b) => Number(native.includes(b.id))-Number(native.includes(a.id)) || a.len-b.len);
    return options[0] || null;
  };
  FH.feed = function () {
    const s = this.data(U.game), h = U.hab; if (s.fed) return;
    const p = this.prey(); if (!p) throw new Error('No suitably sized food is available yet.');
    const before = h.prey.length; if (before + 2 > J.PREY_CAP) throw new Error('There is already enough live food in this tank.');
    h.addPrey(p.id,2);
    if (h.prey.length !== before + 2) throw new Error('Food could not be released. Please try again.');
    s.fed = true; s.preyType = p.id; this.save();
  };
  FH.safe = function (fn) { try { fn(); } catch (e) { U.toast(esc(e.message || 'That action could not be completed. Please try again.'),'',5000); } };
  FH.finishSetup = function () {
    // All three changes are explicit in the confirmation, and idempotent on retry/reload.
    this.safe(() => {
      const s = this.data(U.game); if (!s || s.phase === 'done') return;
      if (s.phase === 'choose') { this.createHome(); }
      if (!s.furnished) this.furnish(); this.ensureSpider(); if (!s.fed) this.feed();
      this.complete(false);
    });
  };
  FH.complete = function (observing) {
    const g = U.game, s = this.data(g); if (!s || s.phase === 'done') return;
    s.phase = 'done'; s.completed = true; g.state.biomeSetup = false;
    const seen = U.set.tipsSeen || (U.set.tipsSeen = {}); for (const k of ['welcome','build','care','observe']) seen[k] = 1;
    J.Settings.save(U.set); U._tipQ = []; U.hideTip();
    const fading=this.overlay;this.teardown();U.cancelMode();U.closeDrawer();U.closeModal();U.hidePanel();
    if(fading){fading.removeAttribute('id');fading.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));fading.inert=true;fading.setAttribute('aria-hidden','true');D.body.append(fading);fading.classList.add('fh-leaving');setTimeout(()=>fading.remove(),450);}
    g.hab.data.backgroundAt = g.state.time; this.save(); U.refreshHeader();
    U.toast('Your little world is ready. Build, care, or simply watch.','quiet',6500);
    if (!observing) U.R.resetCaches();
  };
  FH.teardown = function () {
    this.removeOverlay(); D.body.classList.remove('fh-wizard','fh-guided'); this.confirming = false;
    D.querySelectorAll('.fh-muted-control').forEach(n=>n.classList.remove('fh-muted-control'));
    const piece=this.featured||D.getElementById('fhDecor');this.featured=null;if(piece){piece.removeAttribute('id');piece.removeAttribute('role');piece.removeAttribute('tabindex');piece.onkeydown=null;piece.classList.remove('fh-featured-piece');}
    clearTimeout(this.watchTimer); this.watchTimer = null;
  };
  FH.removeOverlay = function () {
    if (this.overlay) this.overlay.remove(); this.overlay = this.card = this.target = null;
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = null;
  };
  FH.render = function () {
    if (!U.game || !this.active(U.game)) { this.teardown(); return; }
    const s = this.data(U.game);
    U._tipQ = []; U.hideTip();
    if (s.phase === 'choose') { this.picker(); return; }
    D.body.classList.remove('fh-wizard'); D.body.classList.add('fh-guided');
    if (s.phase === 'place') { s.phase = 'build'; this.save(); } // A transient placement ghost is never serialized.
    if (s.phase === 'watch') {
      U.toggleObserve(true,s.spiderId); this.watch(); return;
    }
    this.showGuide();
  };
  FH.control = function (kind) {
    const selectors = kind === 'observe' ? ['#dock [data-dock="observe"]','#btnObserve'] : [`#dock [data-dock="${kind}"]`,`#toolbar [data-tool="${kind}"]`];
    return selectors.map(s=>D.querySelector(s)).find(visible);
  };
  FH.recommendedPiece = function () {
    const h = U.hab;
    return J.DECOR.filter(d => d.cat === 'decor' && !d.mount && d.arche !== 'backwall' && !d.lamp && !d.water && U.biomeDecorFit(d) > 0)
      .sort((a,b) => Number(!!b.small)-Number(!!a.small) || U.biomeDecorFit(b)-U.biomeDecorFit(a))
      .find(d => h.canPlace(d.id,h.dims.w*.5,h.dims.d*.55,0,1).ok);
  };
  FH.showGuide = function () {
    const s = this.data(U.game); if (!s || !this.active(U.game)) return;
    const n = this.name(); let target, title, copy, step, action;
    const skip = () => this.confirmSkip();
    switch (s.phase) {
      case 'build': step='1 OF 6 · PREPARE'; title=`A home for ${n}.`; copy='Tap Build. We’ll add one small furnishing together—then you can finish with a recommended layout.'; target=this.control('build'); break;
      case 'piece': step='1 OF 6 · PREPARE'; title='One small piece, one big beginning.'; copy='Choose this suitable furnishing. Next, you’ll place it in the tank.'; target=D.getElementById('fhDecor'); break;
      case 'placing': step='1 OF 6 · PREPARE'; title='Make it yours.'; copy=U.isMobile()?'Tap a clear spot inside the tank, then tap Place piece. Green means it fits.':'Click a clear spot inside the tank, or use arrow keys then Place piece. Green means it fits.'; target=D.getElementById('view'); action=button('Place piece','fhPlace',()=>{ if(U.place && U.place.ok) U.confirmPlace(); else U.toast('Choose a clear spot inside the tank first.'); },'fh-button fh-primary'); break;
      case 'layout': step='2 OF 6 · MAKE IT COSY'; title='A lovely first touch.'; copy='Your piece stays. Add a matching arrangement around it, with shelter, climbing places and water where space allows.'; target=D.getElementById('view'); action=button('Finish with recommended layout','fhLayout',()=>this.safe(()=>{this.furnish();this.phase('jumpers');}),'fh-button fh-primary'); break;
      case 'jumpers': step='3 OF 6 · WELCOME'; title=`Ready to meet ${n}?`; copy='Tap Jumpers to bring your chosen resident home. No jumper has been added yet.'; target=this.control('jumpers'); break;
      case 'add': step='3 OF 6 · WELCOME'; title=`Welcome, ${n}.`; copy='Tap the highlighted button. Your chosen jumper will arrive in the home you prepared.'; target=D.getElementById('fhAddJumper'); break;
      case 'care': step='4 OF 6 · FIRST FEEDING'; title=`${n} is settling in.`; copy='Tap Care to choose a small first meal. Food should suit your jumper’s current size—not its adult size.'; target=this.control('care'); break;
      case 'food': step='4 OF 6 · FIRST FEEDING'; title='A little food is plenty.'; copy='Release two suitably sized prey. Your jumper will decide when to hunt; you don’t have to make it catch anything.'; target=D.getElementById('fhReleasePrey'); break;
      case 'observe': step='5 OF 6 · OBSERVE'; title='Take a closer look.'; copy=`Tap Observe to follow ${n}. Exploring, resting and hunting all happen naturally.`; target=this.control('observe'); break;
      case 'skip': return this.skipCard();
      default: s.phase='build'; this.save(); return this.showGuide();
    }
    this.guide({step,title,copy,target,action,skip,scene:['placing','layout'].includes(s.phase)});
  };
  FH.guide = function ({step,title,copy,target,action,skip,scene,watch}) {
    this.removeOverlay();
    if(target&&!scene&&!watch)target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    const overlay=el('div','fh-overlay'+(watch?' fh-watching':'')); overlay.id='fhOverlay';
    const masks=[]; for(let i=0;i<4;i++){const m=el('div','fh-shade');overlay.append(m);masks.push(m);}
    const glow=el('div','fh-glow'); glow.setAttribute('aria-hidden','true'); overlay.append(glow);
    const card=el('section','fh-guide');card.id='fhGuide';card.setAttribute('role','dialog');card.setAttribute('aria-modal','false');card.setAttribute('aria-labelledby','fhGuideTitle');card.setAttribute('aria-describedby','fhGuideCopy');
    card.append(el('p','fh-eyebrow',step));const h=el('h3','',title);h.id='fhGuideTitle';const p=el('p','fh-copy',copy);p.id='fhGuideCopy';card.append(h,p);
    const actions=el('div','fh-guide-actions');if(action)actions.append(action);
    if(skip)actions.append(button('Skip tutorial','fhSkip',skip,'fh-link'));card.append(actions);overlay.append(card);D.body.append(overlay);
    this.overlay=overlay;this.card=card;this.target=target;this.scene=scene;this.watchMode=watch;
    // Clear the card without covering the interaction target, including when drawers scroll or the phone rotates.
    const layout=()=>{
      if(this.overlay!==overlay)return;
      let t=this.target;
      if(!scene&&!watch){const phase=this.data(U.game)?.phase;if(['build','jumpers','care','observe'].includes(phase))t=this.target=this.control(phase==='jumpers'?'jumpers':phase==='observe'?'observe':phase==='care'?'care':'build');}
      const W=innerWidth,H=innerHeight,pad=8;let r=visible(t)?t.getBoundingClientRect():{left:W/2,top:H/2,right:W/2,bottom:H/2};
      if(scene){
        const dm=U.hab.dims,pts=[[0,0,0],[dm.w,0,0],[dm.w,0,dm.d],[0,0,dm.d],[0,dm.h,0],[dm.w,dm.h,dm.d]].map(p=>U.R.project(p));
        if(pts.every(p=>p.every(Number.isFinite)))r={left:Math.min(...pts.map(p=>p[0]))-16,right:Math.max(...pts.map(p=>p[0]))+16,top:Math.min(...pts.map(p=>p[1]))-10,bottom:Math.max(...pts.map(p=>p[1]))+16};
      }
      const x=Math.max(0,Math.min(W,r.left-pad)),y=Math.max(0,Math.min(H,r.top-pad)),right=Math.max(x,Math.min(W,r.right+pad)),bottom=Math.max(y,Math.min(H,r.bottom+pad));
      const rect=(n,x,y,w,h)=>Object.assign(n.style,{left:x+'px',top:y+'px',width:Math.max(0,w)+'px',height:Math.max(0,h)+'px'});
      rect(masks[0],0,0,W,y);rect(masks[1],0,y,x,bottom-y);rect(masks[2],right,y,W-right,bottom-y);rect(masks[3],0,bottom,W,H-bottom);rect(glow,x,y,right-x,bottom-y);
      const side=scene&&W>700&&x>=215;const cw=side?Math.min(340,x-28):Math.min(370,W-32);card.style.width=cw+'px';const ch=card.offsetHeight;
      const minY=12+(parseFloat(getComputedStyle(D.documentElement).getPropertyValue('--sat'))||0),maxY=Math.max(minY,H-ch-12);
      let cy;const horizontal=!scene&&!watch&&y-ch-18<minY&&bottom+ch+18>H-12&&(right+cw+18<=W||x-cw-18>=0);
      if(horizontal)cy=Math.max(minY,Math.min(maxY,y));
      else if(scene){cy=minY+12;if(!side&&y<cy+ch+14&&H-bottom>ch+28)cy=bottom+16;}
      else if(W<600&&y>H*.55&&80+ch<y-18)cy=80;
      else if(y-ch-18>=minY)cy=y-ch-18;
      else if(bottom+ch+18<=H-12)cy=bottom+18;
      else cy=minY;
      cy=Math.max(minY,Math.min(maxY,cy));let cx=horizontal?(right+cw+18<=W?right+18:x-cw-18):side?12:Math.max(16,Math.min(W-cw-16,scene?(W-cw)/2:(x+right-cw)/2));
      Object.assign(card.style,{left:cx+'px',top:cy+'px'});
      if(watch){for(const m of masks)m.style.display='none';glow.style.display='none';}
      const place=D.getElementById('fhPlace');if(place)place.disabled=!(U.place&&U.place.ok);
      this.frame=requestAnimationFrame(layout);
    };layout();
    card.tabIndex=-1;card.focus({preventScroll:true});
  };
  FH.openPiece = function () {
    const d=this.recommendedPiece();
    if(!d){this.phase('layout');return;}
    const card=U.decorCard(d);this.featured=card;card.id='fhDecor';card.classList.add('fh-featured-piece');card.setAttribute('role','button');card.tabIndex=0;
    card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}};
    const body=D.getElementById('drawerBody');body.replaceChildren(card);
    D.querySelectorAll('#drawerTabs,#drawerChips,#drawer .bm-controls').forEach(e=>e.classList.add('fh-muted-control'));
    U.syncDrawerSpace();this.data(U.game).phase='piece';this.save();this.showGuide();
  };
  FH.addSheet = function () {
    const s=this.data(U.game),w=el('div','fh-arrival');w.append(this.portrait(s.sid),el('h3','',this.name()),el('p','fh-copy',J.SPECIES_BY_ID[s.sid].name+' · A tiny sling, with growing still to do.'));
    w.append(button(`Add ${this.name()} to this tank`,'fhAddJumper',()=>this.safe(()=>{this.ensureSpider();U.closeModal();this.phase('care');J.Audio.sfx('hatch');}),'fh-button fh-primary'));
    U.openModal('Your chosen jumper',w,{back:null,sheet:'first-arrival'});s.phase='add';this.save();this.showGuide();
  };
  FH.foodCard = function () {
    const p=this.prey();if(!p){U.toast('No suitable starter food was found.');return;}
    const body=D.getElementById('drawerBody');body.replaceChildren();const card=el('div','fh-food');
    const source=U.R.preyPortrait(p.id,112),cv=el('canvas');cv.width=source.width;cv.height=source.height;cv.getContext('2d').drawImage(source,0,0);cv.setAttribute('aria-hidden','true');
    card.append(cv,el('strong','',p.name),el('p','fh-note',`${p.len} mm · Good size for ${this.name()}`),button('Release 2 small prey','fhReleasePrey',()=>this.safe(()=>{this.feed();J.Audio.sfx('feed');U.closeDrawer();this.phase('observe');}),'fh-button fh-primary'));body.append(card);
    const h=U.hab;D.getElementById('drawerTitle').textContent=`First feeding · ${B.of(h).name}`;
    this.data(U.game).phase='food';this.save();this.showGuide();
  };
  FH.confirmSkip = function () {
    const s=this.data(U.game);this.returnPhase=s.phase;s.phase='skip';this.save();this.skipCard();
  };
  FH.skipCard = function () {
    this.guide({step:'YOUR HOME, YOUR PACE',title:'Finish setup and explore?',copy:'This will complete a matching layout, add your chosen jumper if needed, and release two small prey if you haven’t fed them yet. Nothing already added is duplicated.',target:null,action:button('Finish setup & explore','fhFinishSetup',()=>this.finishSetup(),'fh-button fh-primary')});
    this.card.querySelector('.fh-guide-actions').append(button('Keep guiding me','fhKeepGuiding',()=>{const s=this.data(U.game);s.phase=this.returnPhase||(!U.hab.decor.length?'build':!U.hab.spiders.length?'jumpers':!s.fed?'care':'observe');this.save();this.render();},'fh-link'));
  };
  FH.watch = function () {
    clearTimeout(this.watchTimer);
    this.guide({step:'6 OF 6 · A LITTLE WORLD, QUIETLY ALIVE',title:`Hello, ${this.name()}.`,copy:'There’s no rush. Your jumper may explore, rest, or hunt when ready. Later, check hydration in their profile; mist only when it’s needed for this habitat.',target:null,watch:true,action:button('Enjoy my terrarium','fhEnjoy',()=>this.complete(true),'fh-button fh-primary')});
    // A short, resumable introduction; completion never waits for a stochastic hunt.
    this.watchTimer=setTimeout(()=>{if(this.data(U.game)?.phase==='watch')this.complete(true);},11000);
  };

  // Adapt the real controls, not proxy buttons. Only the special first-home state takes this path.
  const drawer0=U.openDrawer;
  U.openDrawer=function(tab){const s=FH.data(this.game);const result=drawer0.apply(this,arguments);if(!FH.active(this.game)||!s)return result;
    if(['build','piece'].includes(s.phase)&&tab==='decor')FH.openPiece();
    else if(['care','food'].includes(s.phase)&&tab==='food')FH.foodCard();return result;};
  const place0=U.startPlace;
  U.startPlace=function(){const s=FH.data(this.game);const result=place0.apply(this,arguments);if(FH.active(this.game)&&s.phase==='piece'&&this.mode==='place'){s.phase='placing';
      if(!this.place.ok){const h=this.hab;outer:for(let z=12;z<h.dims.d-10;z+=8)for(let x=12;x<h.dims.w-10;x+=8)if(h.canPlace(this.place.type,x,z,0,this.place.seed).ok){this.applyGhost({x,z,y:0});break outer;}}
      FH.save();FH.showGuide();}return result;};
  const confirm0=U.confirmPlace;
  U.confirmPlace=function(){const s=FH.data(this.game),before=this.hab.decor.length,result=confirm0.apply(this,arguments);
    if(FH.active(this.game)&&s.phase==='placing'&&this.hab.decor.length>before){this.cancelMode();this.closeDrawer();D.querySelectorAll('.fh-muted-control').forEach(e=>e.classList.remove('fh-muted-control'));FH.phase('layout');}return result;};
  const cancel0=U.endMode;
  U.endMode=function(){const s=FH.data(this.game),result=cancel0.apply(this,arguments);if(FH.active(this.game)&&s.phase==='placing'){s.phase='build';FH.save();setTimeout(()=>FH.render(),0);}return result;};
  const jump0=U.jumpersSheet;
  U.jumpersSheet=function(){const s=FH.data(this.game);if(FH.active(this.game)&&['jumpers','add'].includes(s.phase)){FH.addSheet();return;}return jump0.apply(this,arguments);};
  const obs0=U.toggleObserve;
  U.toggleObserve=function(on,id){const result=obs0.apply(this,arguments),s=FH.data(this.game);if(FH.active(this.game)&&s.phase==='observe'&&this.obs){s.phase='watch';FH.save();FH.watch();}return result;};
  const close0=U.closeModal;
  U.closeModal=function(){const s=FH.data(this.game);if(FH.active(this.game)&&s.phase==='choose'){FH.picker();return;}
    const result=close0.apply(this,arguments);if(FH.active(this.game)&&s.phase==='add'){s.phase='jumpers';FH.save();setTimeout(()=>FH.render(),0);}return result;};
  const closeDrawer0=U.closeDrawer;
  U.closeDrawer=function(){D.querySelectorAll('.fh-muted-control').forEach(n=>n.classList.remove('fh-muted-control'));const s=FH.data(this.game),result=closeDrawer0.apply(this,arguments);if(FH.active(this.game)&&['piece','food'].includes(s.phase)){s.phase=s.phase==='piece'?'build':'care';FH.save();setTimeout(()=>FH.render(),0);}return result;};

  // Restore transient panels after reload using the saved phase, without replaying mutations.
  const render0=FH.render;
  FH.render=function(){const s=this.data(U.game);if(s&&this.active(U.game)){
    if(s.phase==='piece'){s.phase='build';this.save();}
    if(s.phase==='placing'){s.phase='build';this.save();}
    if(s.phase==='add'){s.phase='jumpers';this.save();}
    if(s.phase==='food'){s.phase='care';this.save();}
  }return render0.call(this);};

  // Block stray actions/shortcuts outside the current spotlight; the scene still uses its own pointer handlers.
  const allowed=n=>{
    if(!FH.overlay)return true;
    if(FH.card&&FH.card.contains(n))return true;
    if(FH.watchMode)return true;
    if(FH.target&&(FH.target===n||FH.target.contains(n)))return true;
    return FH.scene&&FH.data(U.game)?.phase==='placing'&&!!n.closest?.('#modeBar');
  };
  for(const ev of ['pointerdown','click','touchstart','wheel'])D.addEventListener(ev,e=>{if(FH.overlay&&!allowed(e.target)){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
  root.addEventListener('keydown',e=>{
    if(!FH.active(U.game))return;
    const s=FH.data(U.game);
    if(s.phase==='choose'){
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(s.step){s.step--;FH.save();FH.picker();}return;}
      if(e.key==='Tab'){
        const nodes=[...D.querySelectorAll('#modal button,#modal input')].filter(visible),i=nodes.indexOf(D.activeElement);
        if(nodes.length){e.preventDefault();e.stopImmediatePropagation();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length].focus();}return;
      }
      if(e.key.length===1&&!['INPUT','TEXTAREA'].includes(e.target.tagName)&&e.key!==' '){e.stopImmediatePropagation();}return;
    }
    if(!FH.overlay)return;
    if(e.key==='Tab'){
      const nodes=[...D.querySelectorAll('button,[tabindex="0"]')].filter(n=>visible(n)&&!n.disabled&&allowed(n)),i=nodes.indexOf(D.activeElement);
      if(nodes.length){e.preventDefault();e.stopImmediatePropagation();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length].focus();}return;
    }
    if(s.phase==='placing'&&/^Arrow(Up|Down|Left|Right)$/.test(e.key)){
      e.preventDefault();e.stopImmediatePropagation();const p=U.place,h=U.hab;if(p){const delta=e.shiftKey?8:3,x=Math.max(3,Math.min(h.dims.w-3,(p.x||h.dims.w/2)+(e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0))),z=Math.max(3,Math.min(h.dims.d-3,(p.z||h.dims.d/2)+(e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0)));U.applyGhost({x,z,y:0});}return;
    }
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();
      if(s.phase==='placing'){U.endMode();U.closeDrawer();FH.phase('build');}
      else if(s.phase==='piece'){U.closeDrawer();FH.phase('build');}
      else if(s.phase==='food'){U.closeDrawer();FH.phase('care');}
      else if(s.phase==='add'){U.closeModal();FH.phase('jumpers');}
      else if(s.phase==='skip')D.getElementById('fhKeepGuiding').click();
      else if(s.phase==='watch')FH.complete(true);
      else FH.confirmSkip();return;
    }
    // Let native Enter/Space activate focused real controls, but never also trigger the game's hotkeys.
    if(e.key==='Enter'||e.key===' '){if(!allowed(e.target)){e.preventDefault();}else if(e.target.getAttribute('role')==='button'&&e.target.tagName!=='BUTTON'){e.preventDefault();e.target.click();}e.stopPropagation();return;}
    if(e.key.length===1){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  D.addEventListener('focusin',e=>{if(FH.overlay&&!allowed(e.target)&&FH.card)FH.card.focus({preventScroll:true});});
  D.addEventListener('visibilitychange',()=>{
    const s=FH.data(U.game);if(s&&s.phase==='watch'){
      clearTimeout(FH.watchTimer);if(!D.hidden)FH.watch();
    }
  });

  FH.back=function(){const s=this.data(U.game);if(!s||!this.active(U.game))return false;
    if(s.phase==='choose'){if(!s.step)return false;s.step--;this.save();this.picker();return true;}
    if(s.phase==='placing'){U.endMode();U.closeDrawer();this.phase('build');}
    else if(s.phase==='piece'){U.closeDrawer();this.phase('build');}
    else if(s.phase==='food'){U.closeDrawer();this.phase('care');}
    else if(s.phase==='add'){U.closeModal();this.phase('jumpers');}
    else if(s.phase==='skip'){D.getElementById('fhKeepGuiding').click();}
    else if(s.phase==='watch')this.complete(true);
    else this.confirmSkip();return true;
  };
  const import0=J.Game.prototype.importSave;
  J.Game.prototype.importSave=function(){const result=import0.apply(this,arguments);if(result&&U.game===this)setTimeout(()=>FH.render(),0);return result;};
  const css=el('style');css.textContent=`
.fh-wizard #modalClose,.fh-wizard #modalBack{display:none!important}
.fh-wizard #modalWrap{background:rgba(10,17,10,.64)!important}
#app .fh-picker{font-family:system-ui,-apple-system,sans-serif;color:#30372b;max-width:680px;margin:0 auto}
#app .fh-picker p{line-height:1.55}#app .fh-title{font:400 clamp(25px,3vw,34px)/1.2 Georgia,serif;margin:22px 0 12px;color:#30372b}
.fh-eyebrow{font:600 11px/1.4 system-ui,sans-serif!important;letter-spacing:.12em;color:#65734e!important;margin:0 0 12px!important;text-transform:uppercase}
.fh-progress{display:flex;gap:6px}.fh-progress span{flex:1;border-top:3px solid #d8dccd;padding-top:8px;font:12px/1.4 system-ui;color:#75786c}.fh-progress .is-current{border-color:#63774a;color:#3d5030}
.fh-copy{font:15px/1.55 system-ui,sans-serif!important;color:#505a46!important;margin:12px 0 16px!important}
.fh-note{display:block;font:14px/1.5 system-ui,sans-serif!important;color:#606a55!important;margin:6px 0}
.fh-choices{display:grid;gap:12px}.fh-choice{appearance:none;width:100%;display:flex;align-items:center;gap:16px;border:1px solid #cdd2c0!important;background:#f9f8f1!important;padding:16px!important;border-radius:12px!important;text-align:left;letter-spacing:0!important;color:#30372b!important;font:15px/1.5 system-ui!important;min-height:72px;box-sizing:border-box}
.fh-choice.is-selected{border:2px solid #687f4d!important;background:#ecf0e1!important;padding:15px!important}.fh-choice:hover{border-color:#687f4d!important}.fh-choice strong{display:block;font-weight:600;font-size:17px}.fh-choice-copy{min-width:0;flex:1}.fh-badge{display:inline-block;color:#455c32;background:#dce5ca;border-radius:5px;padding:3px 6px;font:600 11px/1.4 system-ui;margin-bottom:8px;letter-spacing:.02em}
.fh-tank-glyph{width:120px;height:77px;flex:0 0 120px}.fh-portrait{width:142px;height:142px;object-fit:contain;flex:0 0 142px;max-width:100%;margin:0!important;animation:fh-breathe 5s ease-in-out infinite}
.fh-label{display:block;font:600 14px/1.5 system-ui;margin:24px 0 8px}.fh-name{box-sizing:border-box;width:100%;min-height:48px;background:#fffef8!important;color:#30372b!important;border:1px solid #a7b194!important;border-radius:8px!important;padding:10px 12px!important;font:16px/1.4 system-ui!important}
.fh-warning{padding:12px;border:1px solid #c6b190;border-radius:8px;font:14px/1.5 system-ui;color:#72522e}
.fh-button{appearance:none;min-height:44px;max-width:100%;border:1px solid #a5ae95!important;border-radius:8px!important;padding:10px 14px!important;background:#f5f5eb!important;color:#35442d!important;font:600 14px/1.4 system-ui!important;letter-spacing:0!important;cursor:pointer;box-sizing:border-box;text-shadow:none!important}
#app #modal .fh-button.fh-primary,.fh-button.fh-primary{background:#536a3c!important;border-color:#536a3c!important;color:#fff!important}.fh-button:disabled{opacity:.5;cursor:not-allowed}.fh-button:not(:disabled):hover{filter:brightness(.95)}
.fh-link{appearance:none;border:0!important;background:transparent!important;color:#4b6038!important;font:500 14px/1.45 system-ui!important;letter-spacing:0!important;text-decoration:underline;text-underline-offset:3px;min-height:44px;padding:10px 4px!important;cursor:pointer;text-shadow:none!important}
.fh-button:focus-visible,.fh-link:focus-visible,.fh-choice:focus-visible,.fh-name:focus-visible,#fhDecor:focus-visible{outline:3px solid #829a5f!important;outline-offset:3px}
#app .fh-picker-actions{gap:16px!important}.fh-overlay{position:fixed;inset:0;z-index:2147482000;pointer-events:none;font-family:system-ui,sans-serif}.fh-shade{position:absolute;background:rgba(6,13,7,.62);pointer-events:auto;touch-action:none}
.fh-glow{position:absolute;box-sizing:border-box;border:2px solid #dceca6;border-radius:12px;box-shadow:0 0 0 3px rgba(209,231,143,.16),0 0 28px rgba(206,231,143,.65);pointer-events:none;animation:fh-glow 2.8s ease-in-out infinite}
.fh-guide{position:absolute;pointer-events:auto;box-sizing:border-box;padding:20px;background:#f6f3e9;color:#30372b;border:1px solid #d4dac6;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.24);max-height:calc(100dvh - 32px);overflow:auto;text-align:left;outline:none}
.fh-guide h3{font:400 25px/1.2 Georgia,serif;color:#30372b;margin:0}.fh-guide .fh-copy{margin:12px 0!important}.fh-guide-actions{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px}.fh-guide-actions>.fh-primary{flex:1 0 100%}.fh-guide .fh-eyebrow{font-size:10px!important;margin-bottom:10px!important}
.fh-featured-piece{width:180px!important;min-height:150px!important;margin:8px!important;cursor:pointer}.fh-muted-control{display:none!important}
.fh-arrival{text-align:center;padding:8px 0 20px}.fh-arrival .fh-portrait{display:block;margin:0 auto!important}.fh-arrival h3{font:400 30px/1.2 Georgia;margin:12px 0}.fh-arrival .fh-button{margin-top:12px}
.fh-food{display:flex;flex-direction:column;align-items:center;min-width:200px;max-width:100%;padding:8px 16px 16px;box-sizing:border-box;white-space:normal;color:#30372b!important}.fh-food canvas{width:80px;height:80px}.fh-food strong{font:600 16px/1.4 system-ui;color:#30372b}.fh-food .fh-note{color:#606a55!important}.fh-food .fh-primary{background:#d8e5b6!important;border-color:#d8e5b6!important;color:#29371f!important}
.fh-guided #tip{display:none!important}.fh-overlay.fh-leaving{opacity:0;transition:opacity .4s ease}.fh-overlay.fh-leaving *{pointer-events:none!important}.fh-watching .fh-guide{animation:fh-arrive .4s ease-out}.fh-watching{pointer-events:none}.fh-watching .fh-guide{pointer-events:auto}
@keyframes fh-glow{50%{box-shadow:0 0 0 5px rgba(209,231,143,.12),0 0 34px rgba(206,231,143,.8)}}@keyframes fh-breathe{50%{transform:translateY(-3px)}}@keyframes fh-arrive{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(max-width:560px){#app .fh-title{font-size:27px;margin-top:20px}.fh-choice{gap:10px;padding:12px!important}.fh-choice.is-selected{padding:11px!important}.fh-tank-glyph{width:88px;height:64px;flex-basis:88px}.fh-portrait{width:104px;height:104px;flex-basis:104px}.fh-choice strong{font-size:16px}.fh-guide{padding:18px}.fh-guide h3{font-size:24px}.fh-picker .fh-choice:has(.fh-portrait){align-items:flex-start}.fh-picker .fh-choice:has(.fh-portrait) .fh-note{font-size:13px!important}.fh-progress span{font-size:11px}}
@media(max-height:500px) and (orientation:landscape){
.fh-wizard #modal .modal-head{padding-top:0!important;padding-bottom:8px!important}.fh-wizard #modalTitle{font-size:20px!important}.fh-wizard #modal .fh-title{font-size:23px!important;margin:6px 0!important}.fh-wizard .fh-progress{display:none}.fh-wizard .fh-copy{font-size:13px!important;margin:6px 0 10px!important}.fh-wizard .fh-eyebrow{margin-bottom:6px!important}.fh-wizard .fh-tank-glyph{width:88px;height:64px;flex-basis:88px}.fh-wizard .fh-choice{padding:10px!important}.fh-wizard .fh-choice.is-selected{padding:9px!important}.fh-wizard .fh-note{font-size:13px!important}.fh-wizard .fh-picker[data-fh-step="0"]{display:grid;grid-template-columns:1fr 1fr;gap:0 20px;align-items:start}.fh-wizard .fh-picker[data-fh-step="0"]>.fh-eyebrow{grid-column:1/-1}.fh-wizard .fh-picker[data-fh-step="0"]>.fh-title,.fh-wizard .fh-picker[data-fh-step="0"]>.fh-copy,.fh-wizard .fh-picker[data-fh-step="0"]>.fh-link{grid-column:1}.fh-wizard .fh-picker[data-fh-step="0"]>.fh-choices{grid-column:2;grid-row:2 / span 4}.fh-wizard .fh-picker[data-fh-step="0"]>.fh-link{justify-self:start}
.fh-guide{padding:12px 16px}.fh-guide h3{font-size:21px}.fh-guide .fh-copy{font-size:13px!important;margin:6px 0!important}.fh-guide .fh-eyebrow{margin-bottom:6px!important}.fh-guide-actions{gap:4px 12px}.fh-guide-actions>.fh-primary{flex:initial}.fh-guide .fh-button,.fh-guide .fh-link{padding-top:8px!important;padding-bottom:8px!important}.fh-portrait{width:94px;height:94px;flex-basis:94px}}
@media(prefers-reduced-motion:reduce){.fh-portrait,.fh-glow,.fh-watching .fh-guide{animation:none!important}.fh-overlay.fh-leaving{transition:none!important}}
`;D.head.append(css);
})(window);
