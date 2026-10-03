/* Jumper Terrarium — interface: header, toolbar drawers, placement/removal, panels, modals,
   observation mode, cameras, input (mouse, touch, pinch, keyboard) and the mobile dock. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const cloneCanvas = (src) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c; };
  const A = () => JT.Audio;
  const TAGS = (d) => [d.fly && 'flying', d.hop && 'hopping', d.burrow && 'burrowing', d.climb && 'climber', d.cleaner && 'cleanup crew', d.slow && 'slow', d.night && 'nocturnal'].filter(Boolean).join(' · ');
  const STARTER_PRICE = 25;
  const speciesPrice = (S) => S.starter ? STARTER_PRICE : S.price;

  const UI = JT.UI = {
    tab: null, mode: null, place: null, obs: null, panelId: null, renaming: false, ptrType: 'mouse', _t: 0, _panelT: 0, _mistT: 0,
    init(game, R, settings) {
      this.game = game; this.R = R; this.set = settings; this.cv = $('view');
      this.bind(); this.refreshHeader();
      game.on((t, d) => this.onGame(t, d));
      const sp = game.hab.spider(game.selectedId); if (sp) this.showPanel(sp.id);
    },
    get hab() { return this.game.hab; },
    isMobile() { return root.matchMedia && root.matchMedia('(max-width:820px) and (orientation:portrait), (max-width:560px)').matches; },

    // ------------------------------------------------ binding
    bind() {
      document.querySelectorAll('#cams button').forEach(b => b.onclick = () => this.setCam(b.dataset.cam));
      document.querySelectorAll('#timeMode button').forEach(b => b.onclick = () => this.setTimeMode(b.dataset.tm));
      document.querySelectorAll('#toolbar button').forEach(b => b.onclick = () => this.tool(b.dataset.tool));
      document.querySelectorAll('#dock button').forEach(b => b.onclick = () => this.dock(b.dataset.dock));
      $('btnObserve').onclick = () => this.toggleObserve();
      $('btnSound').onclick = () => this.soundPopover();
      $('btnSettings').onclick = () => this.settingsModal();
      $('btnHelp').onclick = () => this.helpModal();
      $('btnManage').onclick = () => this.manageModal();
      $('habPicker').onclick = () => this.habPickerModal();
      $('drawerClose').onclick = () => this.closeDrawer();
      $('modalClose').onclick = () => this.closeModal();
      $('modalWrap').addEventListener('pointerdown', (e) => { if (e.target === $('modalWrap')) this.closeModal(); });
      $('zoomIn').onclick = () => this.R.zoomBy(1.25); $('zoomOut').onclick = () => this.R.zoomBy(0.8); $('zoomReset').onclick = () => this.R.resetView();
      $('modeRotate').onclick = () => this.rotatePlace(); $('modeDone').onclick = () => this.modeDone(); $('modeCancel').onclick = () => this.cancelMode();
      $('obsExit').onclick = () => this.toggleObserve(false);
      document.addEventListener('keydown', (e) => this.key(e));
      document.addEventListener('pointerdown', (e) => { this.ptrType = e.pointerType || 'mouse'; A().start(); const pop = $('popover'); if (!pop.classList.contains('hidden') && !pop.contains(e.target) && e.target !== $('btnSound')) pop.classList.add('hidden'); }, true);
      this.bindCanvas();
      root.addEventListener('resize', () => { this.R.resize(); });
    },
    bindCanvas() {
      const cv = this.cv; const P = new Map(); let pinch = null, drag = null;
      const loc = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', (e) => {
        this.ptrType = e.pointerType || 'mouse'; cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
        const p = loc(e); P.set(e.pointerId, p);
        if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; drag = null; }
        else if (P.size === 1) drag = { s: p, l: p, moved: false, ghost: this.mode === 'place' && this.ptrType !== 'mouse' };
      });
      cv.addEventListener('pointermove', (e) => {
        const p = loc(e);
        if (!P.has(e.pointerId)) { if (e.pointerType === 'mouse') this.hoverAt(p); return; }
        P.set(e.pointerId, p);
        if (pinch && P.size >= 2) {
          const [a, b] = [...P.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          if (pinch.d > 10) this.R.zoomBy(d / pinch.d, m[0], m[1]); this.R.panBy(m[0] - pinch.m[0], m[1] - pinch.m[1]); pinch.d = d; pinch.m = m; return;
        }
        if (drag) {
          const tol = e.pointerType === 'mouse' ? 5 : 10;
          if (!drag.moved && Math.hypot(p[0] - drag.s[0], p[1] - drag.s[1]) > tol) drag.moved = true;
          if (drag.moved) { if (drag.ghost) this.updateGhost(p[0], p[1]); else this.R.panBy(p[0] - drag.l[0], p[1] - drag.l[1]); }
          drag.l = p;
          if (e.pointerType === 'mouse' && !drag.moved) this.hoverAt(p);
        }
      });
      const up = (e) => {
        const p = loc(e); const had = P.has(e.pointerId); P.delete(e.pointerId);
        if (pinch) { if (P.size < 2) { pinch = null; drag = null; } return; }
        if (had && drag && !drag.moved && e.type === 'pointerup') this.tap(p[0], p[1]);
        drag = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !P.size) { this.R.hover = null; } });
      cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = loc(e); this.R.zoomBy(Math.exp(-e.deltaY * 0.0015), p[0], p[1]); }, { passive: false });
      cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.mode) this.cancelMode(); });
    },
    key(e) {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
      const k = e.key;
      if (k === 'Escape') { if (this.obs) this.toggleObserve(false); else if (!$('modalWrap').classList.contains('hidden')) this.closeModal(); else if (this.mode) this.cancelMode(); else if (this.tab) this.closeDrawer(); else if (this.panelId) this.hidePanel(); return; }
      if (k === 'o' || k === 'O') { this.toggleObserve(); return; }
      if (this.obs) return;
      if (k === 'r' || k === 'R') { if (this.mode === 'place') this.rotatePlace(); return; }
      if (k === '1') this.setCam('iso'); else if (k === '2') this.setCam('observer'); else if (k === '3') this.setCam('follow'); else if (k === '4') this.setCam('reverse');
      else if (k === '+' || k === '=') this.R.zoomBy(1.2); else if (k === '-' || k === '_') this.R.zoomBy(1 / 1.2); else if (k === '0') this.R.resetView();
      else if (k === 'm' || k === 'M') this.tool('mist');
      else if (k === 'Enter' && this.mode === 'place') this.modeDone();
    },

    // ------------------------------------------------ header
    refreshHeader() {
      const g = this.game, st = g.state;
      $('coins').textContent = Math.floor(st.coins);
      const tabs = $('habTabs'); tabs.innerHTML = '';
      g.habs.forEach((h, i) => { const b = el('button', i === st.active ? 'on' : '', esc(h.data.name)); b.title = JT.HABITATS[h.data.type].name + ' · ' + h.spiders.length + ' jumper(s)'; b.onclick = () => this.switchHab(i); tabs.appendChild(b); });
      $('habPicker').textContent = '🪴 ' + g.hab.data.name;
      document.querySelectorAll('#cams button').forEach(b => b.classList.toggle('on', b.dataset.cam === this.R.cam.mode));
      document.querySelectorAll('#timeMode button').forEach(b => b.classList.toggle('on', b.dataset.tm === st.timeMode));
      $('btnSound').textContent = this.set.muted ? '🔇' : '🔊';
      document.querySelectorAll('#toolbar button').forEach(b => b.classList.toggle('on', b.dataset.tool === this.tab || (b.dataset.tool === 'remove' && this.mode === 'remove')));
    },
    updateClock() { $('dayLbl').textContent = 'Day ' + this.game.day(); $('timeLbl').textContent = JT.fmtTime(this.game.tod()) + (this.game.state.timeMode !== 'auto' ? (this.game.state.timeMode === 'day' ? ' ☀' : ' 🌙') : ''); },
    setCam(m) { this.R.setMode(m); this.refreshHeader(); if (m === 'follow' && !this.hab.spider(this.game.selectedId)) this.toast('Select a jumper to follow.'); },
    setTimeMode(m) { this.game.state.timeMode = m; this.refreshHeader(); this.updateClock(); A().sfx('click'); },
    switchHab(i) {
      const g = this.game; if (i === g.state.active) return; this.cancelMode(); g.state.active = M.clamp(i, 0, g.habs.length - 1);
      const h = g.hab; g.selectedId = h.spiders[0] ? h.spiders[0].id : null; this.R.cur = null; this.R.resetView();
      if (g.selectedId && !this.isMobile()) this.showPanel(g.selectedId); else this.hidePanel();
      if (this.obs) this.obs.sub = null;
      if (this.tab) this.openDrawer(this.tab); this.refreshHeader(); A().sfx('click');
    },
    toast(text, cls, ms) {
      const t = el('div', 'toast ' + (cls || ''), text); $('toasts').appendChild(t);
      while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 600); }, ms || 2600);
    },
    bumpCoins() { const c = document.querySelector('.coins'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); $('coins').textContent = Math.floor(this.game.state.coins); },

    // ------------------------------------------------ simulation events
    onGame(t, d) {
      const R = this.R;
      if (t === 'coins') { this.bumpCoins(); if (d.amount > 0 && d.sp && d.sp.pos) { R.addText(d.sp.pos, '+' + d.amount + ' coins', '#f4d47a'); A().sfx('coin'); } if (this.tab) this.refreshCardsAfford(); }
      else if (t === 'catch') { if (d.sp) { R.addText(M.add(d.sp.pos, [0, 4, 0]), 'GOT IT!', '#fffbe8', true); R.burst(d.sp.pos, '#fff2c0', 12); } A().sfx('catch'); }
      else if (t === 'pounce') A().sfx('pounce');
      else if (t === 'jump') { if (JT.R() < 0.3) A().sfx('rustle'); }
      else if (t === 'journal') { this.toast('<b>' + d.entry.icon + ' Journal: ' + esc(d.entry.title) + '</b>' + esc(d.entry.text), 'journal', 5200); A().sfx('journal'); }
      else if (t === 'molt') { const sp = d.sp; if (sp) this.toast('🌱 ' + esc(sp.name) + ' molted — now a ' + JT.STAGES[sp.stage] + '.', '', 3500); A().sfx('molt'); }
      else if (t === 'toast') this.toast(d.text, d.cls, d.ms);
    },

    // ------------------------------------------------ toolbar & dock
    tool(t) {
      if (this.obs) return; A().sfx('click');
      if (t === 'decor' || t === 'plants' || t === 'substrate' || t === 'food') { if (this.tab === t) this.closeDrawer(); else this.openDrawer(t); }
      else if (t === 'jumpers') this.collectionModal();
      else if (t === 'journal') this.journalModal();
      else if (t === 'mist') this.doMist();
      else if (t === 'clean') this.doClean();
      else if (t === 'remove') { if (this.mode === 'remove') this.cancelMode(); else this.startRemove(); }
      this.refreshHeader();
    },
    dock(d) {
      A().sfx('click');
      document.querySelectorAll('#dock button').forEach(b => b.classList.remove('on'));
      if (d === 'build') { if (this.tab && this.tab !== 'food') this.closeDrawer(); else { this.openDrawer('decor'); this.dockOn('build'); } }
      else if (d === 'food') { if (this.tab === 'food') this.closeDrawer(); else { this.openDrawer('food'); this.dockOn('food'); } }
      else if (d === 'jumpers') { this.closeDrawer(); this.collectionModal(); }
      else if (d === 'observe') { this.closeDrawer(); this.toggleObserve(); }
      else if (d === 'more') { this.closeDrawer(); this.moreSheet(); }
    },
    dockOn(d) { const b = document.querySelector('#dock button[data-dock="' + d + '"]'); if (b) b.classList.add('on'); },
    doMist() {
      if (performance.now() - this._mistT < 1500) return; this._mistT = performance.now();
      this.hab.mist(); this.R.mistFx(this.hab); A().sfx('mist');
      this.toast('💧 Misted — fresh droplets bead on leaves and stones.');
    },
    doClean() {
      const n = this.hab.clean(); A().sfx(n ? 'rustle' : 'click');
      this.toast(n ? '🧹 Tidied away ' + n + ' leftover husk' + (n > 1 ? 's' : '') + '.' : '✨ Everything is already spotless — nothing to clean right now.');
    },

    // ------------------------------------------------ drawer
    openDrawer(tab) {
      this.tab = tab; const d = $('drawer'); d.classList.remove('hidden');
      const tabs = $('drawerTabs'); tabs.innerHTML = '';
      const list = tab === 'food' ? [['food', '🪰 Live Food']] : [['decor', '🪨 Decor'], ['plants', '🌿 Plants'], ['substrate', '🟫 Substrate']];
      for (const [id, lab] of list) { const b = el('button', id === tab ? 'on' : '', lab); b.onclick = () => this.openDrawer(id); tabs.appendChild(b); }
      if (tab !== 'food') { const b = el('button', this.mode === 'remove' ? 'on' : '', '✖ Remove'); b.onclick = () => { if (this.mode === 'remove') this.cancelMode(); else this.startRemove(); this.openDrawer(this.tab); }; tabs.appendChild(b); }
      const h = this.hab;
      $('drawerTitle').textContent = tab === 'food' ? 'Live food for ' + h.data.name + ' (' + h.livePreyCount() + '/' + JT.PREY_CAP + ')' : tab === 'substrate' ? 'Substrate & ground cover' : (tab === 'plants' ? 'Plants' : 'Decor') + ' — click a piece, then place it';
      const body = $('drawerBody'); body.innerHTML = ''; body.scrollLeft = 0;
      if (tab === 'decor' || tab === 'plants') for (const d of JT.DECOR.filter(x => x.cat === tab)) body.appendChild(this.decorCard(d));
      else if (tab === 'substrate') {
        for (const id in JT.SUBSTRATES) body.appendChild(this.substrateCard(id));
        body.appendChild(el('div', 'sect', 'Ground cover'));
        for (const d of JT.DECOR.filter(x => x.cat === 'ground')) body.appendChild(this.decorCard(d));
      } else if (tab === 'food') for (const p of JT.PREY) body.appendChild(this.preyCard(p));
      this.refreshHeader();
    },
    closeDrawer() { this.tab = null; $('drawer').classList.add('hidden'); document.querySelectorAll('#dock button').forEach(b => b.classList.remove('on')); this.refreshHeader(); },
    refreshCardsAfford() { document.querySelectorAll('#drawerBody .card[data-price]').forEach(c => c.classList.toggle('disabled', +c.dataset.price > this.game.state.coins)); },
    decorCard(d) {
      const c = el('div', 'card'); c.dataset.price = d.price; c.title = d.name + (d.platform ? ' — platform (others can stack on top)' : '') + (d.stack ? ' — can be stacked on platforms' : '');
      c.appendChild(cloneCanvas(this.R.decorThumb(d.id, 0, 112)));
      c.appendChild(el('div', 'nm', esc(d.name))); c.appendChild(el('div', 'pr', d.price + ' coins'));
      const tg = [d.platform && 'platform', d.stack && 'stackable', d.cover >= 0.5 && 'cover', d.water && 'water', d.flowers && 'flowers'].filter(Boolean).join(' · '); c.appendChild(el('div', 'tg', tg || '&nbsp;'));
      if (d.price > this.game.state.coins) c.classList.add('disabled');
      c.onclick = () => { if (d.price > this.game.state.coins) { this.toast('Not enough coins for ' + esc(d.name) + '.'); A().sfx('error'); return; } this.startPlace(d.id); };
      return c;
    },
    substrateCard(id) {
      const S = JT.SUBSTRATES[id]; const h = this.hab; const cur = h.data.substrate === id;
      const c = el('div', 'card' + (cur ? ' cur' : '')); c.dataset.price = cur ? 0 : S.price;
      const cv = document.createElement('canvas'); cv.width = cv.height = 112; const g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 112); gr.addColorStop(0, S.top); gr.addColorStop(0.62, S.top); gr.addColorStop(0.63, S.mid); gr.addColorStop(1, S.dark); g.fillStyle = gr; g.fillRect(0, 0, 112, 112);
      const rng = JT.makeRng(JT.hashStr(id)); for (let i = 0; i < 260; i++) { g.fillStyle = S.speck[i % 2]; const x = rng() * 112, y = rng() * 70; g.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 1.5); }
      c.appendChild(cv); c.appendChild(el('div', 'nm', esc(S.name))); c.appendChild(el('div', 'pr', cur ? 'Current' : S.price ? S.price + ' coins' : 'Free'));
      c.appendChild(el('div', 'tg', (S.burrow > 0.6 ? 'burrowable · ' : '') + (S.moist > 0.6 ? 'humid' : S.moist < 0.25 ? 'dry' : 'balanced')));
      c.onclick = () => {
        if (cur) return; if (!this.game.spend(S.price)) { this.toast('Not enough coins.'); A().sfx('error'); return; }
        h.data.substrate = id; this.R._speck = null; A().sfx('place'); this.toast('Substrate changed to ' + esc(S.name) + '.'); this.openDrawer('substrate');
      };
      return c;
    },
    preyCard(p) {
      const c = el('div', 'card'); c.dataset.price = p.price;
      c.appendChild(cloneCanvas(this.R.preyPortrait(p.id, 112)));
      c.appendChild(el('div', 'nm', esc(p.name) + (p.count > 1 ? ' ×' + p.count : '')));
      c.appendChild(el('div', 'pr', p.price + ' coins')); c.appendChild(el('div', 'tg', TAGS(p) || (p.huntable ? 'ground prey' : '&nbsp;')));
      if (p.price > this.game.state.coins) c.classList.add('disabled');
      c.title = p.cleaner ? 'Cleanup crew: eats leftover husks, even on decor.' : 'Prey value ' + p.val + ' coins when caught.';
      c.onclick = () => {
        const h = this.hab; const n = p.count || 1;
        if (h.prey.length + n > JT.PREY_CAP) { this.toast('This habitat already has plenty of live food (' + JT.PREY_CAP + ' max).'); A().sfx('error'); return; }
        if (!this.game.spend(p.price)) { this.toast('Not enough coins.'); A().sfx('error'); return; }
        h.addPrey(p.id, n); A().sfx('rustle'); this.toast('Released ' + (n > 1 ? n + ' ' : 'a ') + esc(p.name) + '.');
        $('drawerTitle').textContent = 'Live food for ' + h.data.name + ' (' + h.livePreyCount() + '/' + JT.PREY_CAP + ')';
      };
      return c;
    },

    // ------------------------------------------------ placement & removal
    startPlace(type) {
      this.cancelMode(); const d = JT.DECOR_BY_ID[type];
      this.mode = 'place'; this.place = { type, rot: 0, seed: (JT.R() * 1e9) | 0, x: null, z: null, ok: false };
      this.cv.classList.add('placing'); $('modeBar').classList.remove('hidden'); $('modeRotate').classList.remove('hidden'); $('modeDone').classList.remove('hidden');
      if (this.isMobile()) $('drawer').classList.add('hidden');
      // start the ghost in the middle so touch users see it immediately
      const r = this.cv.getBoundingClientRect(); this.updateGhost(r.width / 2, r.height * 0.55);
      this.setModeText(); void d;
    },
    setModeText() {
      const p = this.place; if (!p) return; const d = JT.DECOR_BY_ID[p.type]; const touch = this.ptrType !== 'mouse';
      const st = p.ok ? '<span class="ok">✔ fits here</span>' : '<span class="bad">✗ ' + esc(p.reason || 'Not here') + '</span>';
      $('modeText').innerHTML = '<b>' + esc(d.name) + '</b> (' + d.price + ') · ' + st + ' · <span class="muted" style="color:#c8b48a">' + (touch ? 'drag to move' : 'click to place · R rotate · Esc cancel') + '</span>';
    },
    updateGhost(sx, sy) {
      const p = this.place; if (!p) return; const h = this.hab; const pt = this.R.placementPoint(sx, sy, h, p.type);
      p.x = pt.x; p.z = pt.z; p.y = pt.y;
      const chk = h.canPlace(p.type, p.x, p.z, p.rot, p.seed);
      const price = JT.DECOR_BY_ID[p.type].price; p.ok = chk.ok && this.game.state.coins >= price; p.reason = chk.ok ? (p.ok ? '' : 'Not enough coins') : chk.reason;
      let geom = chk.geom; if (!geom) { try { geom = JT.Geo.build({ id: '_ghost', type: p.type, x: p.x, z: p.z, rot: p.rot, seed: p.seed }, chk.baseY || pt.y || 0, h.dims.h); } catch (e) { geom = null; } }
      if (geom) geom.id = '_ghost';
      this.R.ghost = { geom, ok: p.ok, x: p.x, z: p.z }; this.setModeText();
    },
    rotatePlace() { const p = this.place; if (!p) return; p.rot = (p.rot + 1) % 4; A().sfx('click'); this.updateGhostAtCurrent(); },
    confirmPlace() {
      const p = this.place; if (!p) return; const h = this.hab; const d = JT.DECOR_BY_ID[p.type];
      if (!p.ok) { this.toast(esc(p.reason || 'Cannot place here.')); A().sfx('error'); return; }
      if (!this.game.spend(d.price)) { this.toast('Not enough coins.'); return; }
      const inst = h.addDecor(p.type, p.x, p.z, p.rot, p.seed, true);
      if (!inst) { this.game.refund(d.price); this.toast('That spot is no longer free.'); return; }
      inst.bought = d.price; A().sfx('place');
      this.toast('Placed ' + esc(d.name) + (inst.parent ? ' (stacked)' : '') + '.');
      p.seed = (JT.R() * 1e9) | 0;
      if (this.game.state.coins < d.price) this.cancelMode(); else { this.updateGhostAtCurrent(); }
      if (this.isMobile()) { this.cancelMode(); if (this.tab) $('drawer').classList.remove('hidden'); }
    },
    updateGhostAtCurrent() { const p = this.place; if (p && p.x != null) { const s = this.R.project([p.x, p.y || 0, p.z]); this.updateGhost(s[0], s[1]); } },
    startRemove() {
      this.cancelMode(); this.mode = 'remove'; this.cv.classList.add('removing'); $('modeBar').classList.remove('hidden');
      $('modeRotate').classList.add('hidden'); $('modeDone').classList.add('hidden');
      $('modeText').innerHTML = '<b>Remove mode</b> · tap decor for a 50% refund, or tap live food / leftovers to remove them · Esc to finish';
      this.refreshHeader();
    },
    removeAt(sx, sy) {
      const h = this.hab; const hit = this.R.pick(sx, sy, {});
      if (!hit) { this.toast('Nothing to remove there.'); return; }
      if (hit.kind === 'spider') { this.showPanel(hit.ent.id); this.toast('Use the jumper card to rehome a jumper.'); return; }
      if (hit.kind === 'prey') { const d = JT.PREY_BY_ID[hit.ent.type]; h.removeEntity(hit.ent, 'player'); A().sfx('remove'); this.toast('Released the ' + esc(d.name) + ' outside.'); return; }
      if (hit.kind === 'remains') { h.removeEntity(hit.ent, 'player'); A().sfx('remove'); this.toast(hit.ent.cat === 'exuvia' ? 'Collected a shed exoskeleton.' : 'Removed leftovers.'); return; }
      if (hit.kind === 'decor') {
        const removed = h.removeDecor(hit.ent.id); let refund = 0;
        for (const r of removed) { const d = JT.DECOR_BY_ID[r.type]; if (!r.preset) refund += Math.floor(d.price * 0.5); }
        this.game.refund(refund); this.bumpCoins(); A().sfx('remove'); this.R.hover = null;
        const nm = JT.DECOR_BY_ID[hit.ent.type].name;
        this.toast('Removed ' + esc(nm) + (removed.length > 1 ? ' and ' + (removed.length - 1) + ' item(s) resting on it' : '') + (refund ? ' · +' + refund + ' coins' : ' · preset pieces return no coins'));
      }
    },
    modeDone() { if (this.mode === 'place') this.confirmPlace(); else this.cancelMode(); },
    cancelMode() {
      this.mode = null; this.place = null; this.R.ghost = null; this.R.hover = null;
      this.cv.classList.remove('placing', 'removing'); $('modeBar').classList.add('hidden'); this.refreshHeader();
    },
    hoverAt(p) {
      if (this.mode === 'place') this.updateGhost(p[0], p[1]);
      else if (this.mode === 'remove') { const hit = this.R.pick(p[0], p[1], {}); this.R.hover = hit; }
      else { const hit = this.R.pick(p[0], p[1], { noPrey: true }); this.cv.style.cursor = hit && hit.kind === 'spider' ? 'pointer' : ''; }
    },
    tap(sx, sy) {
      if (this.obs) return;
      if (this.mode === 'place') { if (this.ptrType === 'mouse') { this.updateGhost(sx, sy); this.confirmPlace(); } else this.updateGhost(sx, sy); return; }
      if (this.mode === 'remove') { this.removeAt(sx, sy); return; }
      const hit = this.R.pick(sx, sy, {});
      if (hit && hit.kind === 'spider') { this.game.selectedId = hit.ent.id; this.showPanel(hit.ent.id); A().sfx('click'); return; }
      if (hit && hit.kind === 'prey') { const d = JT.PREY_BY_ID[hit.ent.type]; this.toast(esc(d.name) + (d.cleaner ? ' — part of the cleanup crew.' : '')); return; }
      if (hit && hit.kind === 'remains') { this.toast(hit.ent.cat === 'exuvia' ? 'A shed exoskeleton (exuvia).' : 'Leftover husk — springtails and isopods will tidy it.'); return; }
      if (hit && hit.kind === 'decor' && this.ptrType === 'mouse') return;
      if (this.isMobile() && this.panelId) $('spiderPanel').classList.remove('expanded');
    },

    // ------------------------------------------------ spider panel
    showPanel(id) { this.panelId = id; this.renaming = false; $('spiderPanel').classList.remove('hidden'); this.renderPanel(true); },
    hidePanel() { this.panelId = null; $('spiderPanel').classList.add('hidden'); },
    renderPanel(force) {
      if (this.renaming && !force) return; const P = $('spiderPanel'); const h = this.hab; const sp = h.spider(this.panelId);
      if (!sp) { this.hidePanel(); return; }
      const S = JT.SPECIES_BY_ID[sp.species]; const AI = JT.SpiderAI;
      const need = AI.moltNeed(sp); const molting = ['premolt', 'molting', 'moltSilk', 'moltSeek'].includes(sp.state);
      const desc = AI.descriptors(sp);
      const size = (S.len * JT.STAGE_SCALE[sp.stage]).toFixed(1);
      const hl = AI.hungerLabel(sp.sat);
      const moltTxt = sp.stage >= 5 ? 'Fully grown' : molting ? 'Molting now…' : 'Next molt: ' + Math.min(sp.meals, need) + '/' + need + ' meals';
      const follow = this.R.cam.mode === 'follow';
      const html = '<button class="x" id="pClose" title="Close">✖</button>' +
        '<h3 id="pHead">' + (this.renaming ? '<input id="pName" maxlength="18" value="' + esc(sp.name) + '">' : esc(sp.name)) + '</h3>' +
        '<div class="sci">' + esc(S.name) + ' — <i>' + esc(S.sci) + '</i></div>' +
        '<div class="mini"><b>' + JT.STAGES[sp.stage] + '</b> · ' + hl + ' · <i>' + esc(sp.thought || '') + '</i> <button class="modal-btn" id="pMore">More</button></div>' +
        '<div class="full">' +
        '<div class="row"><span>Stage</span><b>' + JT.STAGES[sp.stage] + (sp.soft > 0 ? ' (soft after molt)' : '') + '</b></div>' +
        '<div class="row"><span>Hunger</span><b>' + hl + '</b></div><div class="bar"><i style="width:' + Math.round(sp.sat * 100) + '%"></i></div>' +
        '<div class="row"><span>Hydration</span><b>' + Math.round((sp.hyd != null ? sp.hyd : 1) * 100) + '%</b></div><div class="bar hyd"><i style="width:' + Math.round((sp.hyd != null ? sp.hyd : 1) * 100) + '%"></i></div>' +
        '<div class="row"><span>Growth</span><b>' + moltTxt + '</b></div><div class="bar molt"><i style="width:' + (sp.stage >= 5 ? 100 : Math.round(Math.min(1, sp.meals / need) * 100)) + '%"></i></div>' +
        '<div class="row"><span>Age</span><b>' + (sp.ageDays || 0).toFixed(1) + ' days</b></div>' +
        '<div class="row"><span>Molts · Catches</span><b>' + (sp.molts || 0) + ' · ' + (sp.catches || 0) + '</b></div>' +
        '<div class="row"><span>Size</span><b>' + size + ' mm</b></div>' +
        '<div class="thought">“' + esc(sp.thought || '…') + '”</div>' +
        '<div class="pers"><b>Personality:</b> ' + (desc ? desc.map(esc).join(', ') : '<i>Still learning about ' + esc(sp.name) + '… keep watching.</i>') + '</div>' +
        '<div class="pbtns"><button class="btn" id="pRename">' + (this.renaming ? 'Save' : '✏️ Rename') + '</button><button class="btn' + (follow ? ' gold' : '') + '" id="pFollow">' + (follow ? 'Following' : '👁 Follow') + '</button><button class="btn" id="pRemove">Rehome</button></div>' +
        '</div>';
      P.innerHTML = html;
      $('pClose').onclick = (e) => { e.stopPropagation(); this.hidePanel(); };
      $('pMore').onclick = (e) => { e.stopPropagation(); P.classList.add('expanded'); };
      $('pHead').onclick = () => { if (this.isMobile() && !this.renaming) P.classList.toggle('expanded'); };
      $('pRename').onclick = () => {
        if (this.renaming) { const v = ($('pName').value || '').trim().slice(0, 18); if (v) sp.name = v; this.renaming = false; this.game.save(); this.renderPanel(true); }
        else { this.renaming = true; this.renderPanel(true); const i = $('pName'); i.focus(); i.select(); i.onkeydown = (e) => { if (e.key === 'Enter') $('pRename').click(); if (e.key === 'Escape') { this.renaming = false; this.renderPanel(true); } }; }
      };
      $('pFollow').onclick = () => { this.game.selectedId = sp.id; this.setCam(follow ? 'iso' : 'follow'); this.renderPanel(true); };
      $('pRemove').onclick = () => {
        if (!root.confirm('Rehome ' + sp.name + ' outside the collection? This cannot be undone.')) return;
        h.removeEntity(sp, 'player'); const ref = Math.floor(speciesPrice(S) * 0.5); this.game.refund(ref); this.bumpCoins();
        this.toast(esc(sp.name) + ' was gently rehomed' + (ref ? ' · +' + ref + ' coins' : '') + '.'); this.hidePanel(); this.game.selectedId = h.spiders[0] ? h.spiders[0].id : null; this.refreshHeader(); this.game.save();
      };
    },

    // ------------------------------------------------ observation mode
    toggleObserve(on) {
      on = on == null ? !this.obs : on;
      if (on) {
        if (!this.hab.spiders.length) { this.toast('No jumpers here to observe yet.'); return; }
        this.cancelMode(); this.closeDrawer(); this.closeModal();
        this.obs = { sub: null, hold: 0, prevCam: this.R.cam.mode, t: 0 }; document.body.classList.add('observe'); $('obsHud').classList.remove('hidden');
        this.R.observing = true; this.R.setMode('follow'); this.pickSubject(true);
      } else if (this.obs) {
        const prev = this.obs.prevCam; this.obs = null; document.body.classList.remove('observe'); $('obsHud').classList.add('hidden'); this.R.observing = false; this.R.setMode(prev === 'follow' ? 'iso' : prev);
        document.querySelectorAll('#dock button').forEach(b => b.classList.remove('on'));
      }
      this.refreshHeader();
    },
    pickSubject(force) {
      const o = this.obs; const h = this.hab; if (!h.spiders.length) { this.toggleObserve(false); return; }
      const cur = h.spider(o.sub); const score = (s) => JT.SpiderAI.interest(s) + (s.target ? 10 : 0) + (s.id === o.sub ? 15 : 0);
      let best = h.spiders[0]; for (const s of h.spiders) if (score(s) > score(best)) best = s;
      if (force || !cur || (best.id !== o.sub && o.hold > 7 && score(best) > score(cur) + 20)) { o.sub = best.id; o.hold = 0; this.game.selectedId = best.id; }
    },
    updateObs(dt) {
      const o = this.obs; o.hold += dt; o.t += dt; if (o.t > 1) { o.t = 0; this.pickSubject(false); }
      const sp = this.hab.spider(o.sub); if (!sp) return;
      const S = JT.SPECIES_BY_ID[sp.species];
      $('obsName').textContent = sp.name + ' · ' + S.name + ' · ' + JT.STAGES[sp.stage];
      $('obsThought').textContent = '“' + (sp.thought || '…') + '”';
    },

    // ------------------------------------------------ modals
    openModal(title, body) { $('modalTitle').textContent = title; const b = $('modalBody'); b.innerHTML = ''; if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body); $('modalWrap').classList.remove('hidden'); b.scrollTop = 0; },
    closeModal() { $('modalWrap').classList.add('hidden'); document.querySelectorAll('#dock button').forEach(b => b.classList.remove('on')); },
    traitBars(T) { return '<div class="traits">' + [['Stealth', T.stealth], ['Patience', T.patience], ['Jump', T.jump], ['Boldness', T.bold], ['Tactics', T.tactics]].map(([n, v]) => '<span>' + n + '</span><div class="bar"><i style="width:' + Math.round(v * 100) + '%"></i></div>').join('') + '</div>'; },
    collectionModal() {
      const g = this.game, h = this.hab, st = g.state; const wrap = el('div');
      const mine = []; g.habs.forEach((hb, i) => hb.spiders.forEach(s => mine.push([s, hb, i])));
      wrap.appendChild(el('p', 'muted', 'Adding to <b>' + esc(h.data.name) + '</b> · ' + h.spiders.length + '/' + h.dims.cap + ' jumpers (' + JT.HABITATS[h.data.type].name + '). Total catches: ' + st.catches + '.'));
      if (mine.length) {
        const row = el('div', 'form-row'); row.appendChild(el('label', '', 'Your jumpers'));
        for (const [s, hb, i] of mine) { const b = el('button', 'modal-btn', esc(s.name) + ' <span class="muted" style="color:#c8b48a">(' + esc(hb.data.name) + ')</span>'); b.onclick = () => { this.closeModal(); if (i !== st.active) this.switchHab(i); g.selectedId = s.id; this.showPanel(s.id); }; row.appendChild(b); }
        wrap.appendChild(row);
      }
      const grid = el('div', 'grid');
      for (const S of JT.SPECIES) {
        const unlocked = st.species.includes(S.id); const lockedByCatches = S.unlockCatches && !unlocked;
        const price = speciesPrice(S); const full = h.spiders.length >= h.dims.cap;
        const e = el('div', 'entry' + (lockedByCatches ? ' locked' : ''));
        e.appendChild(cloneCanvas(this.R.speciesPortrait(S.id, 150)));
        const owned = mine.filter(m => m[0].species === S.id).length;
        e.insertAdjacentHTML('beforeend', (S.starter ? '<span class="badge">Starter</span>' : owned ? '<span class="badge">Owned ×' + owned + '</span>' : '') + '<h4>' + esc(S.name) + '</h4><div class="sci">' + esc(S.sci) + ' · ~' + S.len + ' mm adult</div><p>' + esc(S.desc) + '</p>' + this.traitBars(S.traits));
        const b = el('button', 'modal-btn gold');
        if (lockedByCatches) { b.textContent = '🔒 Unlocks after ' + S.unlockCatches + ' catches (' + Math.min(st.catches, S.unlockCatches) + '/' + S.unlockCatches + ')'; b.disabled = true; }
        else if (full) { b.textContent = 'Habitat full (' + h.dims.cap + ')'; b.disabled = true; }
        else { b.textContent = (unlocked || S.starter ? 'Add' : 'Adopt') + ' — ' + (price ? price + ' coins' : 'free'); b.disabled = st.coins < price; }
        b.onclick = () => {
          if (!g.spend(price)) { this.toast('Not enough coins.'); return; }
          if (!st.species.includes(S.id)) st.species.push(S.id);
          const sp = h.addSpider(S.id, { stage: S.minStage != null ? S.minStage : (S.starter ? 1 : 2) });
          g.selectedId = sp.id; this.closeModal(); this.showPanel(sp.id); this.refreshHeader(); A().sfx('place');
          this.toast('Welcome, ' + esc(sp.name) + ' the ' + esc(S.name) + '!'); g.save();
        };
        e.appendChild(b); grid.appendChild(e);
      }
      wrap.appendChild(grid); this.openModal('Jumper Collection', wrap);
    },
    journalModal() {
      const st = this.game.state; const n = JT.JOURNAL.filter(j => st.journal[j.id]).length;
      let html = '<p class="muted">Only behaviours you actually witness are recorded. ' + n + ' of ' + JT.JOURNAL.length + ' observed.</p><div class="grid">';
      for (const j of JT.JOURNAL) { const c = st.journal[j.id]; html += c ? '<div class="entry"><span class="badge">×' + c + '</span><h4>' + j.icon + ' ' + esc(j.title) + '</h4><p>' + esc(j.text) + '</p></div>' : '<div class="entry locked"><h4>❓ Not yet witnessed</h4><p class="muted">Keep watching your jumpers…</p></div>'; }
      this.openModal('Field Journal', html + '</div>');
    },
    habPickerModal() {
      const g = this.game; const w = el('div'); const list = el('div', 'sheet-list');
      g.habs.forEach((h, i) => { const b = el('button', i === g.state.active ? 'on' : '', '<span>' + (h.data.type === 'jar' ? '🫙' : '🪴') + '</span>' + esc(h.data.name) + '<small class="muted">' + h.spiders.length + ' jumper(s)</small>'); b.onclick = () => { this.closeModal(); this.switchHab(i); }; list.appendChild(b); });
      const m = el('button', '', '<span>🗂</span>Manage Habitats'); m.onclick = () => this.manageModal(); list.appendChild(m);
      w.appendChild(list); this.openModal('Your Habitats', w);
    },
    moreSheet() {
      const w = el('div'); const list = el('div', 'sheet-list'); this.dockOn('more');
      const add = (ic, lab, fn, on) => { const b = el('button', on ? 'on' : '', '<span>' + ic + '</span>' + lab); b.onclick = fn; list.appendChild(b); };
      add('📖', 'Journal', () => this.journalModal());
      add('💧', 'Mist', () => { this.closeModal(); this.doMist(); });
      add('🧹', 'Clean', () => { this.closeModal(); this.doClean(); });
      add('✖', 'Remove', () => { this.closeModal(); this.startRemove(); });
      add('🗂', 'Habitats', () => this.manageModal());
      add('⚙', 'Settings', () => this.settingsModal());
      for (const [m, ic] of [['iso', '🧊'], ['observer', '👀'], ['follow', '🎯'], ['reverse', '🔄']]) add(ic, JT.CAMS[m].label + ' cam', () => { this.closeModal(); this.setCam(m); }, this.R.cam.mode === m);
      for (const [m, ic, lab] of [['auto', '🌗', 'Auto time'], ['day', '☀', 'Always day'], ['night', '🌙', 'Always night']]) add(ic, lab, () => { this.setTimeMode(m); this.moreSheet(); }, this.game.state.timeMode === m);
      add(this.set.muted ? '🔇' : '🔊', 'Sound', () => { this.closeModal(); this.soundPopover(); });
      add('❓', 'Help', () => this.helpModal());
      w.appendChild(list); this.openModal('More', w);
    },
    manageModal() {
      const g = this.game, st = g.state; const w = el('div');
      w.appendChild(el('p', 'muted', 'Your shelf holds up to 8 displays. Open displays have no glass — jumpers live on decor, plants and substrate.'));
      g.habs.forEach((h, i) => {
        const c = el('div', 'hab-card' + (i === st.active ? ' active' : ''));
        const H = JT.HABITATS[h.data.type];
        c.innerHTML = '<h4>' + esc(h.data.name) + (i === st.active ? ' <span class="muted">(viewing)</span>' : '') + '</h4><div class="muted">' + H.name + ' · ' + H.w + '×' + H.d + '×' + H.h + ' · ' + h.spiders.length + '/' + H.cap + ' jumpers · ' + h.decor.length + ' decor · ' + h.livePreyCount() + ' prey</div>';
        const r1 = el('div', 'form-row'); r1.appendChild(el('label', '', 'Name'));
        const nm = el('input'); nm.type = 'text'; nm.value = h.data.name; nm.maxLength = 24; nm.onchange = () => { h.data.name = nm.value.trim().slice(0, 24) || h.data.name; this.refreshHeader(); }; r1.appendChild(nm);
        if (i !== st.active) { const b = el('button', 'modal-btn gold', 'View'); b.onclick = () => { this.closeModal(); this.switchHab(i); }; r1.appendChild(b); }
        c.appendChild(r1);
        const r2 = el('div', 'form-row'); r2.appendChild(el('label', '', 'Enclosure'));
        const sel = el('select'); for (const t in JT.HABITATS) { const o = el('option', '', JT.HABITATS[t].name + (t === h.data.type ? ' (current)' : ' — ' + JT.HABITATS[t].price)); o.value = t; if (t === h.data.type) o.selected = true; sel.appendChild(o); }
        const cb = el('button', 'modal-btn', 'Change'); cb.onclick = () => {
          const t = sel.value; if (t === h.data.type) return; if (st.coins < JT.HABITATS[t].price) { this.toast('Not enough coins.'); return; }
          if (!root.confirm('Change to ' + JT.HABITATS[t].name + '? Decor that no longer fits is refunded at 50%.')) return;
          g.changeType(h, t); this.R.cur = null; this.refreshHeader(); this.bumpCoins(); this.manageModal(); this.toast('Enclosure changed to ' + JT.HABITATS[t].name + '.');
        };
        r2.appendChild(sel); r2.appendChild(cb); c.appendChild(r2);
        const r3 = el('div', 'form-row'); r3.appendChild(el('label', '', 'Preset layout'));
        const ps = el('select'); const opts = JT.Presets.forType(h.data.type);
        opts.forEach((p, k) => { const o = el('option', '', esc(p.name)); o.value = 't:' + p.theme; ps.appendChild(o); });
        (st.customPresets || []).forEach((p, k) => { const o = el('option', '', '★ ' + esc(p.name)); o.value = 'c:' + k; ps.appendChild(o); });
        const ap = el('button', 'modal-btn', 'Apply / Regenerate'); ap.onclick = () => {
          if (!root.confirm('Replace all decor in ' + h.data.name + ' with this layout? Current decor is removed (no refund for preset pieces).')) return;
          let refund = 0; for (const d of h.decor) if (!d.preset) refund += Math.floor(JT.DECOR_BY_ID[d.type].price * 0.5);
          const v = ps.value; if (v[0] === 't') JT.Presets.generate(h, v.slice(2), (JT.R() * 1e9) | 0); else JT.Presets.applyCustom(h, st.customPresets[+v.slice(2)]);
          h.decor.forEach(d => { d.preset = true; }); g.refund(refund); this.bumpCoins(); this.R._speck = null;
          this.toast('New layout ready' + (refund ? ' · +' + refund + ' coins for your old pieces' : '') + '.'); this.manageModal();
        };
        const sv = el('button', 'modal-btn', 'Save current as preset'); sv.onclick = () => { const n = root.prompt('Preset name:', h.data.name + ' layout'); if (!n) return; JT.Presets.saveCustom(g, h, n.slice(0, 30)); this.toast('Saved preset “' + esc(n) + '”.'); this.manageModal(); };
        r3.appendChild(ps); r3.appendChild(ap); r3.appendChild(sv); c.appendChild(r3);
        w.appendChild(c);
      });
      for (let i = g.habs.length; i < 8; i++) {
        const c = el('div', 'hab-card');
        if (i < st.slots) {
          c.innerHTML = '<h4>Empty slot ' + (i + 1) + '</h4>';
          const r = el('div', 'form-row'); const sel = el('select'); for (const t in JT.HABITATS) { const o = el('option', '', JT.HABITATS[t].name + ' — ' + Math.round(JT.HABITATS[t].price * 0.5) + ' coins'); o.value = t; sel.appendChild(o); }
          const b = el('button', 'modal-btn gold', 'Build habitat'); b.onclick = () => { const h = g.createHabitat(sel.value); if (!h) { this.toast('Not enough coins.'); return; } h.decor.forEach(d => { d.preset = true; }); this.refreshHeader(); this.manageModal(); this.toast('Built ' + esc(h.data.name) + '.'); };
          r.appendChild(sel); r.appendChild(b); c.appendChild(r);
        } else {
          const price = JT.SLOT_PRICES[i]; c.innerHTML = '<h4>🔒 Shelf slot ' + (i + 1) + '</h4>';
          if (i === st.slots) { const b = el('button', 'modal-btn gold', 'Buy slot — ' + price + ' coins'); b.disabled = st.coins < price; b.onclick = () => { if (g.buySlot()) { this.bumpCoins(); this.manageModal(); } else this.toast('Not enough coins.'); }; c.appendChild(b); }
          else c.appendChild(el('div', 'muted', 'Unlock earlier slots first.'));
        }
        w.appendChild(c);
      }
      this.openModal('Manage Habitats', w);
    },
    settingsModal() {
      const s = this.set, h = this.hab; const w = el('div');
      w.appendChild(el('h4', '', 'Background for ' + esc(h.data.name)));
      const bgs = el('div', 'bgs');
      for (const id in JT.BACKGROUNDS) { const B = JT.BACKGROUNDS[id]; const b = el('button', h.data.bg === id ? 'on' : '', esc(B.name)); b.style.background = 'linear-gradient(' + B.sky[0] + ',' + B.sky[1] + ' 55%,' + B.sky[2] + ')'; b.onclick = () => { h.data.bg = id; this.R.bgCache = {}; this.settingsModal(); }; bgs.appendChild(b); }
      w.appendChild(bgs);
      w.appendChild(el('h4', '', 'Graphics'));
      const q = el('div', 'form-row'); q.appendChild(el('label', '', 'Render quality'));
      const seg = el('div', 'seg small'); for (const [v, l] of [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]) { const b = el('button', s.quality === v ? 'on' : '', l); b.onclick = () => { s.quality = v; this.R._autoLow = false; JT.Settings.save(s); this.R.resize(); this.settingsModal(); }; seg.appendChild(b); }
      q.appendChild(seg); w.appendChild(q);
      const tog = (key, label, hint) => { const r = el('div', 'form-row'); const id = 'set_' + key; r.innerHTML = '<label for="' + id + '">' + label + '</label>'; const c = el('input'); c.type = 'checkbox'; c.id = id; c.checked = !!s[key]; c.onchange = () => { s[key] = c.checked; JT.Settings.save(s); }; r.appendChild(c); if (hint) r.appendChild(el('span', 'muted', hint)); w.appendChild(r); };
      tog('hd2d', 'HD-2D look', 'post-processing pass (off on Low quality)'); tog('tilt', 'Tilt-shift', 'miniature depth of field'); tog('bloom', 'Bloom', 'soft glow on highlights'); tog('grain', 'Film grain'); tog('debug', 'Debug overlay', 'navigation graph, routes, states');
      w.appendChild(el('h4', '', 'Save data'));
      const r = el('div', 'form-row'); const b = el('button', 'modal-btn', 'Save now'); b.onclick = () => { this.game.save(); this.toast('Game saved.'); };
      const rs = el('button', 'modal-btn', 'Reset game…'); rs.onclick = () => { if (root.confirm('Start over? All habitats, jumpers and progress will be erased.')) { this.closeModal(); this.cancelMode(); this.game.reset(); this.R.cur = null; this.refreshHeader(); const sp = this.game.hab.spider(this.game.selectedId); if (sp) this.showPanel(sp.id); this.toast('A fresh start — welcome back!'); } };
      r.appendChild(b); r.appendChild(rs); w.appendChild(r);
      w.appendChild(el('p', 'muted', 'Progress saves automatically to this browser. Settings are stored separately and never affect your save.'));
      this.openModal('Settings', w);
    },
    soundPopover() {
      const p = $('popover'); const s = this.set; A().start();
      if (!p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
      p.innerHTML = '<b>Sound</b>'; const sl = (key, label) => { const r = el('div', 'form-row'); r.appendChild(el('label', '', label)); const i = el('input'); i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = s[key]; i.oninput = () => { s[key] = +i.value; A().apply(); JT.Settings.save(s); }; r.appendChild(i); p.appendChild(r); };
      sl('music', 'Music'); sl('ambience', 'Ambience'); sl('effects', 'Effects');
      const r = el('div', 'form-row'); const b = el('button', 'modal-btn', s.muted ? 'Unmute' : 'Mute all'); b.onclick = () => { s.muted = !s.muted; A().apply(); JT.Settings.save(s); this.refreshHeader(); p.classList.add('hidden'); }; r.appendChild(b); p.appendChild(r);
      p.classList.remove('hidden');
    },
    helpModal() {
      this.openModal('How to Keep Jumpers', '<div class="grid">' +
        '<div class="entry"><h4>🕷 Your jumpers</h4><p>Click or tap a jumper to see its card: hunger, hydration, growth, thoughts and personality. Rename, follow or rehome it there.</p></div>' +
        '<div class="entry"><h4>🪰 Feeding</h4><p>Buy Live Food. Hungry jumpers hunt on their own — stalking, ambushing from perches and pouncing. Every catch earns coins.</p></div>' +
        '<div class="entry"><h4>🌱 Growth</h4><p>After enough meals a jumper climbs to a high sheltered spot, spins a silk retreat and molts. It stays soft and pale for a while afterwards.</p></div>' +
        '<div class="entry"><h4>🪴 Building</h4><p>Decor, Plants and Substrate open shop drawers. Pick a piece and place it — green means it fits. Stack plants and pieces on platforms. <kbd>R</kbd> rotates, <kbd>Esc</kbd> cancels. Remove refunds 50%.</p></div>' +
        '<div class="entry"><h4>💧 Care</h4><p>Mist to leave droplets for drinking. Springtails and isopods clean leftovers; the Clean button tidies husks too.</p></div>' +
        '<div class="entry"><h4>📹 Observe</h4><p>Observation Mode (<kbd>O</kbd>) hides the interface and follows the most interesting jumper. <kbd>Esc</kbd> exits.</p></div>' +
        '<div class="entry"><h4>🎥 Camera</h4><p><kbd>1</kbd> Isometric · <kbd>2</kbd> Observer · <kbd>3</kbd> Follow · <kbd>4</kbd> Reverse. Scroll or pinch to zoom, drag to pan, <kbd>0</kbd> resets.</p></div>' +
        '<div class="entry"><h4>📖 Journal & unlocks</h4><p>Witnessed behaviours fill the Field Journal. Reach 30 catches to unlock Portia. Earn coins for more shelf slots and enclosures.</p></div></div>');
    },

    // ------------------------------------------------ per-frame
    update(dt) {
      this._t += dt; this._panelT += dt;
      const g = this.game; const h = g.hab;
      if (this.obs) this.updateObs(dt);
      // the player "watches" the selected jumper -> personality is discovered over time
      if (g.viewing) for (const s of h.spiders) s.obsT = (s.obsT || 0) + dt * (s.id === g.selectedId && (this.panelId === s.id || this.obs || this.R.cam.mode === 'follow') ? 1 : 0.2);
      if (this._panelT > 0.3) { this._panelT = 0; this.updateClock(); if (this.panelId) this.renderPanel(false); $('coins').textContent = Math.floor(g.state.coins); }
      if (this.mode === 'place' && this.place && this._t > 0.5) { this._t = 0; this.updateGhostAtCurrent(); }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
