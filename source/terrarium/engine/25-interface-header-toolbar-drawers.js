/* Jumper Terrarium — interface: header, toolbar drawers, placement/removal, panels, modals,
   observation mode, cameras, input (mouse, touch, pinch, keyboard) and the mobile dock. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  const $ = (id) => document.getElementById(id);
  const shortThought = (t) => { t = String(t || '…').trim(); const m = t.match(/^(.+?[.!?…])(\s|$)/); t = (m ? m[1] : t).split(' — ')[0]; return t.length > 72 ? t.slice(0, 70).replace(/\s+\S*$/, '') + '…' : t; };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const cloneCanvas = (src) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c; };
  /* Shop thumbnails are painted by the GPU one at a time (each needs a read-back), which made the first open of a big
     list take most of a second. Cards now appear at once with an empty frame; the pictures fill in over the next few
     frames (a few ms per frame), cached ones instantly. Idle time after start-up pre-paints the common lists. */
  /* v17: the queue paints cards on screen first (then the rest of the strip, never cards hidden by a filter), and leaves
     cards that were taken off screen queued (their tab may come back). Painted pictures are also kept on the device
     (IndexedDB, per build), so later visits never wait for the GPU at all. */
  const TQ = [];
  const thumbClass = (src) => (src && src._baked ? 'th' : '');
  function lazyThumb(ready, make, size) {
    if (ready()) { const c = cloneCanvas(make()); c.className = thumbClass(make()); return c; }
    const c = document.createElement('canvas'); c.width = c.height = size || 112; c.className = 'pending'; c._make = make; TQ.push({ c, make }); return c;
  }
  const onScreen = (c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.right > -40 && r.left < innerWidth + 40 && r.bottom > -40 && r.top < innerHeight + 40; };
  function pumpThumbs(budget) {
    const t0 = performance.now(); let tries = 0;
    while (TQ.length && performance.now() - t0 < budget && tries++ < 400) {
      for (let i = TQ.length - 1; i >= 0; i--) if (!TQ[i].c.isConnected || !TQ[i].c.classList.contains('pending')) TQ.splice(i, 1);
      if (!TQ.length) break;
      let i = TQ.findIndex(q => onScreen(q.c)); if (i < 0) i = TQ.findIndex(q => q.c.offsetParent !== null); if (i < 0) return; // only hidden cards left: wait
      const q = TQ.splice(i, 1)[0]; try { const src = q.make(); q.c.getContext('2d').drawImage(src, 0, 0); q.c.className = thumbClass(src); } catch (e) { q.c.classList.remove('pending'); /* keep the empty frame */ } }
  }
  /** A card taken from the card cache whose picture never got painted goes back in the queue. */
  function requeue(card) { for (const c of card.querySelectorAll('canvas.pending')) if (c._make && !TQ.some(q => q.c === c)) TQ.push({ c, make: c._make }); }
  // Thumbnails kept on the device. Keyed by a hash of this build's code, so a new version repaints them once.
  const ThumbDB = JT.ThumbDB = {
    build: null, db: null, opening: null, queue: [], busy: false,
    hash() { if (this.build) return this.build; let h = 2166136261; try { for (const sc of document.scripts) { const t = sc.textContent || ''; for (let i = 0; i < t.length; i += 7) h = Math.imul(h ^ t.charCodeAt(i), 16777619); h = Math.imul(h ^ t.length, 16777619); } } catch (e) { /* no DOM */ } return (this.build = (h >>> 0).toString(36)); },
    open() { if (this.opening) return this.opening; this.opening = new Promise((res) => { try { if (typeof indexedDB === 'undefined') return res(null); const rq = indexedDB.open('jt-thumbs', 1); rq.onupgradeneeded = () => { try { rq.result.createObjectStore('t'); } catch (e) { /* exists */ } }; rq.onsuccess = () => { this.db = rq.result; res(this.db); }; rq.onerror = () => res(null); rq.onblocked = () => res(null); } catch (e) { res(null); } }); return this.opening; },
    save(key, canvas) { if (typeof indexedDB === 'undefined' || !canvas.toBlob) return; const k = this.hash() + '|' + key; this.queue.push([k, canvas]); this.flush(); },
    flush() { if (this.busy || !this.queue.length) return; this.busy = true; const batch = this.queue.splice(0, this.queue.length);
      const done = () => { this.busy = false; if (this.queue.length) setTimeout(() => this.flush(), 400); };
      Promise.all(batch.map(([k, c]) => new Promise(res => { try { c.toBlob(b => res(b ? [k, b] : null), 'image/png'); } catch (e) { res(null); } }))).then(list => this.open().then(db => {
        if (!db) return done(); try { const tx = db.transaction('t', 'readwrite'); const st = tx.objectStore('t'); for (const it of list) if (it) st.put(it[1], it[0]); tx.oncomplete = done; tx.onerror = done; tx.onabort = done; } catch (e) { done(); } }), done); },
    /** Fill the renderer's thumbnail cache from the device (missing ones only); old builds' pictures are deleted. */
    load(R) { if (typeof indexedDB === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return; const pre = this.hash() + '|';
      this.open().then(db => { if (!db) return; try { const st = db.transaction('t', 'readonly').objectStore('t'); const kq = st.getAllKeys(), vq = st.getAll();
        vq.onsuccess = () => { const keys = kq.result || [], vals = vq.result || []; const got = [], stale = [];
          keys.forEach((k, n) => { k = String(k); if (k.startsWith(pre)) got.push([k.slice(pre.length), vals[n]]); else stale.push(k); });
          if (stale.length) try { const tx = db.transaction('t', 'readwrite'); const s2 = tx.objectStore('t'); for (const k of stale) s2.delete(k); } catch (e) { /* ignore */ }
          const one = ([key, blob]) => R.thumbs[key] || !blob ? null : new Promise(res => { const u = URL.createObjectURL(blob); const im = new Image();
            im.onload = () => { if (!R.thumbs[key]) { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); c._baked = true; R.thumbs[key] = c; } URL.revokeObjectURL(u); res(); };
            im.onerror = () => { URL.revokeObjectURL(u); res(); }; im.src = u; });
          Promise.all(got.map(one)).then(() => { this.loaded = got.length; }); };
      } catch (e) { /* storage unavailable */ } }); }
  };
  const A = () => JT.Audio;
  /* Haptics: Android/Chrome vibrate; iPhone Safari has no vibrate API, but toggling a native switch inside a tap gives a
     light system tick (iOS 18+), so taps you make still get a feel. Game moments (catches, molts) can only buzz where
     vibrate() exists. Everything respects the Vibration setting. */
  const HAPTIC = { tick: 6, tap: 10, place: 14, remove: [8, 30, 8], pounce: 12, catch: [16, 40, 26], molt: [24, 70, 24, 70, 48], journal: [10, 55, 14], unlock: [18, 50, 18, 50, 40], error: [40], startle: [6, 24, 6], curious: 8 };
  const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  function iosTick() { try { const l = document.createElement('label'); l.ariaHidden = 'true'; l.style.display = 'none'; const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); l.appendChild(i); document.head.appendChild(l); l.click(); l.remove(); } catch (e) { /* not supported */ } }
  const TAGS = (d) => [d.fly && 'flying', d.hop && 'hopping', d.burrow && 'burrowing', d.climb && 'climber', d.foliage && 'lives on plants', d.cleaner && 'cleanup crew', d.slow && 'slow', d.night && 'nocturnal'].filter(Boolean).join(' · ');

  /** Copy text/attributes from b's subtree into a's when the structure matches (keeps nodes + their handlers). */
  function morphChildren(a, b) {
    const ac = a.childNodes, bc = b.childNodes; if (ac.length !== bc.length) return false;
    for (let i = 0; i < ac.length; i++) { const x = ac[i], y = bc[i]; if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) return false; }
    for (let i = 0; i < ac.length; i++) {
      const x = ac[i], y = bc[i];
      if (x.nodeType === 3) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
      if (x.nodeType !== 1) continue;
      for (const at of ['class', 'style', 'title']) { const v = y.getAttribute(at); if (x.getAttribute(at) !== v) { if (v == null) x.removeAttribute(at); else x.setAttribute(at, v); } }
      if (x.tagName === 'INPUT') continue;
      if (!morphChildren(x, y)) { x.innerHTML = y.innerHTML; }
    }
    return true;
  }
  /* ---------------- v11 photos: kept on this device only (IndexedDB), shown on each jumper's profile ---------------- */
  const Photos = JT.Photos = (() => {
    const PER = 8; let dbp = null; const mem = []; // memory fallback (private mode / no IndexedDB): photos last until the page closes
    const open = () => dbp || (dbp = new Promise((res) => {
      try { const rq = root.indexedDB.open('jt-photos', 1);
        rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains('p')) db.createObjectStore('p', { keyPath: 'id' }).createIndex('sp', 'sp'); };
        rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
      } catch (e) { res(null); } }));
    const tx = (db, mode, fn) => new Promise((res) => { try { const t = db.transaction('p', mode); const st = t.objectStore('p'); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : true); t.onerror = () => res(null); t.onabort = () => res(null); } catch (e) { res(null); } });
    const P = {
      persistent: null,
      async list(sp) { const db = await open(); if (!db) return mem.filter(r => r.sp === sp).sort((a, b) => b.t - a.t);
        const r = await new Promise((res) => { try { const q = db.transaction('p').objectStore('p').index('sp').getAll(sp); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch (e) { res([]); } });
        return r.sort((a, b) => b.t - a.t); },
      async add(rec) { rec.id = rec.id || 'ph' + Date.now().toString(36) + ((Math.random() * 1e6) | 0).toString(36); rec.t = rec.t || Date.now();
        const db = await open(); P.persistent = !!db;
        if (!db) { mem.push(rec); const mine = mem.filter(r => r.sp === rec.sp).sort((a, b) => b.t - a.t); mine.slice(PER).forEach(r => mem.splice(mem.indexOf(r), 1)); return { ok: true, temp: true, rec }; }
        const ok = await tx(db, 'readwrite', (st) => st.put(rec)); if (!ok) return { ok: false };
        const all = await P.list(rec.sp); for (const r of all.slice(PER)) await P.del(r.id); return { ok: true, rec }; },
      async del(id) { const db = await open(); if (!db) { const i = mem.findIndex(r => r.id === id); if (i >= 0) mem.splice(i, 1); return true; } return tx(db, 'readwrite', (st) => st.delete(id)); },
      async delAll(sp) { for (const r of await P.list(sp)) await P.del(r.id); },
      PER,
    };
    return P;
  })();
  /** Pixel filters (ctx.filter is missing on older Safari, so photos are graded by hand). */
  const PHOTO_FILTERS = [['natural', 'Natural', 'none'], ['warm', 'Warm', 'sepia(.22) saturate(1.18) brightness(1.03)'], ['cool', 'Cool', 'saturate(.92) hue-rotate(-8deg) brightness(1.02)'], ['mono', 'Mono', 'grayscale(1) contrast(1.08)'], ['story', 'Story', 'sepia(.35) saturate(1.3) contrast(.94) brightness(1.06)']];
  function gradePixels(ctx, W, H, f) {
    if (f === 'natural') return; const im = ctx.getImageData(0, 0, W, H); const d = im.data;
    for (let i = 0; i < d.length; i += 4) { let r = d[i], g = d[i + 1], b = d[i + 2];
      if (f === 'warm') { r = r * 1.07 + 6; g = g * 1.01 + 2; b = b * 0.88; }
      else if (f === 'cool') { r = r * 0.92; g = g * 0.99 + 2; b = b * 1.08 + 8; }
      else if (f === 'mono') { const y = r * 0.299 + g * 0.587 + b * 0.114; r = g = b = (y - 128) * 1.08 + 128; }
      else if (f === 'story') { const y = r * 0.299 + g * 0.587 + b * 0.114; r = (r * 0.7 + y * 0.3) * 1.04 + 14; g = (g * 0.72 + y * 0.28) * 1.0 + 8; b = (b * 0.7 + y * 0.3) * 0.86 + 4; r = (r - 128) * 0.94 + 132; g = (g - 128) * 0.94 + 130; b = (b - 128) * 0.94 + 124; }
      d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b; }
    ctx.putImageData(im, 0, 0);
  }
  const UI = JT.UI = {
    MOBILE_MQ: '(max-width:820px) and (orientation:portrait), (max-width:560px), (max-height:500px) and (orientation:landscape)',
    /** Shop groups (by decor archetype), in the order they appear in the strip. */
    GROUPS: {
      decor: [['Branches & perches', ['branch']], ['Rocks & ledges', ['rock', 'ruin', 'slab']], ['Logs & hides', ['log', 'hide']], ['Towers & trunks', ['tower']], ['Water & warmth', ['dish', 'lamp']]],
      plants: [['Leafy', ['broadleaf', 'fern', 'palm']], ['Flowers', ['flower']], ['Grasses', ['grass']], ['Rosettes', ['rosette']], ['Cacti', ['cactus']], ['Trees', ['tree']], ['Vines', ['vine']], ['Mushrooms', ['mushroom']]],
    },
    tab: null, mode: null, place: null, obs: null, panelId: null, renaming: false, ptrType: 'mouse', _t: 0, _panelT: 0, _mistT: 0,
    init(game, R, settings) {
      this.game = game; this.R = R; this.set = settings; this.cv = $('view'); this._bootAt = performance.now();
      this.bind(); this.refreshHeader();
      game.on((t, d) => this.onGame(t, d));
      const sp = game.hab.spider(game.selectedId); if (sp) this.showPanel(sp.id);
    },
    get hab() { return this.game.hab; },
    isMobile() { return root.matchMedia && root.matchMedia(UI.MOBILE_MQ).matches; },

    // ------------------------------------------------ binding
    bind() {
      document.querySelectorAll('#cams button').forEach(b => b.onclick = () => this.setCam(b.dataset.cam));
      document.querySelectorAll('#timeMode button').forEach(b => b.onclick = () => this.setTimeMode(b.dataset.tm));
      document.querySelectorAll('#toolbar button').forEach(b => b.onclick = () => this.tool(b.dataset.tool));
      document.querySelectorAll('#dock button').forEach(b => b.onclick = () => this.dock(b.dataset.dock));
      $('btnObserve').onclick = () => this.toggleObserve();
      $('btnSound').onclick = () => this.soundPopover();
      // ⋯ menu: time of day, sound, settings, help, habitats
      const tm = $('topMenu'), mb = $('btnMore'); const menu = (on) => { tm.classList.toggle('hidden', !on); mb.setAttribute('aria-expanded', on ? 'true' : 'false'); };
      mb.onclick = (e) => { e.stopPropagation(); menu(tm.classList.contains('hidden')); };
      tm.addEventListener('click', (e) => { if (e.target.closest('button') && !e.target.closest('#timeMode')) menu(false); });
      document.addEventListener('pointerdown', (e) => { if (!tm.classList.contains('hidden') && !tm.contains(e.target) && e.target !== mb) menu(false); }, true);
      $('btnSettings').onclick = () => this.settingsModal();
      $('btnHelp').onclick = () => this.helpModal();
      $('btnManage').onclick = () => this.manageModal();
      $('habPicker').onclick = () => this.habPickerModal();
      $('drawerClose').onclick = () => this.closeDrawer();
      $('modalClose').onclick = () => this.closeModal();
      $('modalWrap').addEventListener('pointerdown', (e) => { if (e.target === $('modalWrap')) this.closeModal(); });
      // phone camera buttons: 1 iso, 2 front, 3 back; tapping the current camera again re-centres the view
      // phone camera: one button shows the current view; tapping it opens the list of views (+ re-centre)
      { const cc = $('camCtl'), tg = $('camToggle'); const open = (on) => { cc.classList.toggle('open', on); tg.setAttribute('aria-expanded', on ? 'true' : 'false'); };
        tg.onclick = (e) => { e.stopPropagation(); A().sfx('click'); open(!cc.classList.contains('open')); };
        document.querySelectorAll('#camList button[data-cam]').forEach(b => b.onclick = () => { open(false); if (this.R.cam.mode === b.dataset.cam) { this.R.resetView(); A().sfx('click'); } else this.setCam(b.dataset.cam); });
        $('camRecentre').onclick = () => { open(false); this.R.resetView(); A().sfx('click'); };
        document.addEventListener('pointerdown', (e) => { if (cc.classList.contains('open') && !cc.contains(e.target)) open(false); }, true); }
      $('modalBack').onclick = () => { const f = this._modalBack; if (f) { A().sfx('click'); f(); } };
      // taps on other controls (outside the jumper card) close it too; taps on the tank are handled in tap()
      document.addEventListener('click', (e) => { if (!this.panelId || performance.now() - (this._panelAt || 0) < 350) return; const t = e.target; if (!t || !t.closest) return;
        if (t.closest('#spiderPanel') || t === this.cv || t.id === 'glview' || t.closest('#modal')) return; this.hidePanel(); });
      $('modeRotate').onclick = () => this.rotatePlace(); $('modeLeaves').onclick = () => this.toggleLeaves(); $('modeDone').onclick = () => this.modeDone(); $('modeCancel').onclick = () => this.endMode(); $('modeUndo').onclick = () => this.undo(); $('undoBtn').onclick = () => this.undo(); $('redoBtn').onclick = () => this.redo(); this.undoSync();
      $('obsExit').onclick = () => this.toggleObserve(false);
      $('obsPhoto').onclick = (e) => { e.stopPropagation(); A().sfx('click'); this.photoMode(true); };
      $('obsTv').onclick = (e) => { e.stopPropagation(); A().sfx('click'); this.tvMode(true); };
      $('phExit').onclick = () => { A().sfx('click'); this.photoMode(false); }; $('phShot').onclick = () => this.photoSnap();
      $('phVigBtn').onclick = () => { if (!this.photo) return; this.photo.vig = this._phVig = !this.photo.vig; A().sfx('click'); this.photoSync(); };
      $('phFrameBtn').onclick = () => { if (!this.photo) return; this.photo.frame = this._phFrame = !this.photo.frame; A().sfx('click'); this.photoSync(); };
      document.addEventListener('keydown', (e) => this.key(e));
      // audio may only start from a real activation gesture (iOS: touchend/click, not pointerdown)
      for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, () => A().start(), { capture: true, passive: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden && A()._silent) A()._silent.pause(); if (!document.hidden && A().ctx && A().ctx.state !== 'running') { const pr = A().ctx.resume(); if (pr && pr.catch) pr.catch(() => {}); } });
      { const poke = () => { this._activeUntil = performance.now() + 1800; }; for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchmove']) document.addEventListener(ev, (e) => { if (ev === 'pointermove' && e.pointerType === 'mouse' && !e.buttons) return;
          // v17: scrolling the shop strip doesn't wake the tank up to 60 fps (the GPU stays free for the strip); thumbnails wait while the finger moves
          const t = e.target; if (ev !== 'keydown' && t && t.closest && t.closest('#drawerBody, #drawerChips')) { if (ev !== 'pointerdown') this._scrollUntil = performance.now() + 160; return; }
          poke(); }, { passive: true, capture: true }); }
      document.addEventListener('pointerdown', (e) => { this.ptrType = e.pointerType || 'mouse'; A().start(); const pop = $('popover'); if (!pop.classList.contains('hidden') && !pop.contains(e.target) && e.target !== $('btnSound')) pop.classList.add('hidden'); }, true);
      this.bindCanvas();
      // rotation: phones often report the old size in the first resize event, so re-measure after layout settles too
      // (the renderer also re-checks the canvas size every frame and fixes any mismatch)
      // iOS home-screen app: the web view can stop short of the home-indicator strip, leaving a bare band at the bottom.
      // Stretch the stage to the full screen height when that happens.
      // Size the stage to the real screen on every device. In an iOS home-screen app with a see-through status bar the
      // layout viewport (100% / innerHeight) is short by the status-bar height, which left a bare band at the bottom;
      // there the stage takes the largest of innerHeight, the large-viewport height and the physical screen height.
      const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:100vh;height:100lvh;visibility:hidden;pointer-events:none'; document.body.appendChild(probe);
      const fitStage = () => { const app = $('app'); if (!app) return;
        const sa = !!(navigator.standalone || (root.matchMedia && root.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches));
        document.documentElement.classList.toggle('sa', sa);
        if (!sa) { app.style.height = ''; document.documentElement.style.removeProperty('--fullH'); return; }
        const port = root.innerHeight >= root.innerWidth; const sc = root.screen || { width: 0, height: 0 };
        const full = port ? Math.max(sc.width, sc.height) : Math.min(sc.width, sc.height);
        let h = Math.max(root.innerHeight, document.documentElement.clientHeight, probe.getBoundingClientRect().height || 0);
        if (full > h && full - h < 120) h = full;
        h = Math.round(h); document.documentElement.style.setProperty('--fullH', h + 'px'); app.style.height = h + 'px'; if (root.scrollY) root.scrollTo(0, 0);
        this._screenInfo = { sa, inner: root.innerWidth + 'x' + root.innerHeight, screen: sc.width + 'x' + sc.height, lvh: Math.round(probe.getBoundingClientRect().height), app: h }; };
      this._probe = probe;
      fitStage();
      const remeasure = () => { fitStage(); this.R.resize(); requestAnimationFrame(() => this.R.resize()); setTimeout(() => this.R.resize(), 250); setTimeout(() => this.R.resize(), 700); };
      root.addEventListener('resize', remeasure); root.addEventListener('orientationchange', remeasure);
      if (root.visualViewport) root.visualViewport.addEventListener('resize', remeasure);
    },
    bindCanvas() {
      const cv = this.cv; const P = new Map(); let pinch = null, drag = null;
      const loc = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', (e) => {
        this.ptrType = e.pointerType || 'mouse'; cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
        const p = loc(e); P.set(e.pointerId, p);
        if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; drag = null; }
        else if (P.size === 1) {
          drag = { s: p, l: p, moved: false, ghost: this.mode === 'place' && this.ptrType !== 'mouse', t: performance.now() };
          // press and hold on empty glass: your fingertip appears and the jumpers notice it
          if (!this.mode && !this.photo && !(e.pointerType === 'mouse' && e.button !== 0)) { const dg = drag; clearTimeout(this._holdT); this._holdT = setTimeout(() => {
            if (drag !== dg || dg.moved || P.size !== 1) return; const hit = this.R.pick(dg.l[0], dg.l[1], { touch: this.ptrType !== 'mouse', noPrey: true });
            if (hit && hit.kind === 'spider') return; dg.finger = true; dg.ft = performance.now(); this.fingerAt(dg.l[0], dg.l[1], true, false); this.buzz('tick'); A().sfx('touch');
          }, 420); }
        } else { clearTimeout(this._holdT); if (drag && drag.finger) this.fingerEnd(); }
      });
      cv.addEventListener('pointermove', (e) => {
        const p = loc(e);
        if (!P.has(e.pointerId)) { if (e.pointerType === 'mouse') this.hoverAt(p); return; }
        P.set(e.pointerId, p);
        if (pinch && P.size >= 2) {
          const [a, b] = [...P.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          if (pinch.d > 10) this.R.zoomBy(d / pinch.d, m[0], m[1]); this.R.panBy(m[0] - pinch.m[0], m[1] - pinch.m[1]); pinch.d = d; pinch.m = m; return;
        }
        if (drag && drag.finger) { // moving your finger: slow drifts are followed, fast swipes startle
          const now = performance.now(), dtm = Math.max(16, now - (drag.ft || now)); const sp = Math.hypot(p[0] - drag.l[0], p[1] - drag.l[1]) / dtm * 1000;
          drag.v = M.lerp(drag.v || 0, sp, 0.5); drag.ft = now; drag.l = p; this.fingerAt(p[0], p[1], true, drag.v > 700); return;
        }
        if (drag) {
          const tol = e.pointerType === 'mouse' ? 5 : 16; // fingers wobble; a short wobble is still a tap
          if (!drag.moved && Math.hypot(p[0] - drag.s[0], p[1] - drag.s[1]) > tol) drag.moved = true;
          if (drag.moved) { if (drag.ghost) this.updateGhost(p[0], p[1]); else this.R.panBy(p[0] - drag.l[0], p[1] - drag.l[1]); }
          drag.l = p;
          if (e.pointerType === 'mouse' && !drag.moved) this.hoverAt(p);
        }
      });
      const up = (e) => {
        const p = loc(e); const had = P.has(e.pointerId); P.delete(e.pointerId);
        clearTimeout(this._holdT);
        if (drag && drag.finger) { this.fingerEnd(); drag = null; return; }
        if (pinch) { if (P.size < 2) { pinch = null; drag = null; } return; }
        if (had && drag && !drag.moved && e.type === 'pointerup') this.tap(p[0], p[1]);
        drag = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !P.size) { this.R.hover = null; } });
      cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = loc(e); this.R.zoomBy(Math.exp(-e.deltaY * 0.0015), p[0], p[1]); }, { passive: false });
      cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.mode) this.cancelMode(); });
    },
    // ------------------------------------------------ one-time beginner tips
    TIPS: {
      welcome: ['Welcome to your terrarium', 'This is your first jumper. Tap it to see its card: what it is doing, hunger, water and personality.'],
      finger: ['Say hello', 'Press and hold on the glass to rest a fingertip there. Curious jumpers come to look; shy ones hide. Move slowly: a fast swipe startles them.'],
      observe: ['Observe mode', 'The camera follows your jumper up close. Tap another jumper to watch it instead. Press Observe or Esc to leave.'],
      build: ['Building', 'Pick a piece, then tap the tank to place it. It shows whether it fits. Branches and plants give your jumper places to climb and hide.'],
      care: ['Feeding', 'Food marked "good for" suits your jumper\'s size. Tiny slings need tiny food. Hungry jumpers hunt on their own.'],
      hungry: ['Your jumper is hungry', 'There is nothing left to hunt. Open Care and release some food that suits its size.'],
      molt: ['Molting', 'Your jumper is growing. It hides in silk and sheds its old skin. Leave it be; afterwards it stays pale and soft for a while.'],
      night: ['Night time', 'Jumpers hunt by sight, so at night they spin a silk retreat and sleep. They wake at dawn.'],
      journal: ['Field Journal', 'You just recorded a behaviour. Find all of them under Jumpers → Journal, with each jumper\'s life story.'],
      unlock: ['New species', 'Open Jumpers → Collection to add the new species to a tank.'],
    },
    resetTips() { this.set.tipsSeen = {}; this.set.tips = true; JT.Settings.save(this.set); this._tipQ = []; },
    /** Queue a tip that shows once ever (force: show even if seen, e.g. replay). */
    tipOnce(id, force, front) {
      const S = this.set; if (!S || !this.TIPS[id]) return; S.tipsSeen = S.tipsSeen || {};
      if (!force && (S.tips === false || S.tipsSeen[id])) return; const Q = this._tipQ || (this._tipQ = []);
      if (!Q.includes(id) && this._tipId !== id) { if (front) Q.unshift(id); else Q.push(id); }
    },
    pumpTips(dt) {
      const S = this.set; this._tipWait = (this._tipWait || 0) - dt; if (this._tipId || this._tipWait > 0 || !this._tipQ || !this._tipQ.length) return;
      const busyToast = $('toasts') && $('toasts').children.length && this.isMobile(); const nowMs = performance.now(); if (!busyToast) this._tipDefer = 0; else if (!this._tipDefer) this._tipDefer = nowMs;
      if ((busyToast && nowMs - this._tipDefer < 6000) || !$('modalWrap').classList.contains('hidden') || this.mode === 'place' || this.mode === 'remove' || (this.obs && this._tipQ[0] !== 'observe')) return;
      const id = this._tipQ.shift(); if (S.tips === false && id !== 'welcome') return; const T = this.TIPS[id]; const box = $('tip'); if (!box || !T) return;
      this._tipId = id; S.tipsSeen = S.tipsSeen || {}; S.tipsSeen[id] = 1; JT.Settings.save(S);
      box.innerHTML = '<div class="tt">' + esc(T[0]) + '</div><div class="tx">' + esc(T[1]) + '</div><div class="tb"><button class="skip">Skip all tips</button><button class="ok">Got it</button></div>';
      box.querySelector('.ok').onclick = () => { A().sfx('click'); this.hideTip(); };
      box.querySelector('.skip').onclick = () => { A().sfx('click'); S.tips = false; JT.Settings.save(S); this._tipQ = []; this.hideTip(); this.toast('Tips off. Replay them any time from Menu → Help & tips.', 'quiet', 3500); };
      box.classList.remove('hidden'); this._tipAt = performance.now(); clearTimeout(this._tipT); this._tipT = setTimeout(() => { if (this._tipId === id) this.hideTip(); }, 16000);
    },
    hideTip(requeue) { const box = $('tip'); if (box) box.classList.add('hidden'); if (requeue && this._tipId && performance.now() - (this._tipAt || 0) < 4000) (this._tipQ || (this._tipQ = [])).unshift(this._tipId); this._tipId = null; this._tipWait = 2.5; },
    /** Watch the game for tip moments (cheap, twice a second). */
    tipWatch() {
      const g = this.game, h = g.hab; if (!h || !this.set || this.set.tips === false) return;
      const seen = this.set.tipsSeen || {};
      if (!seen.welcome && h.spiders.length && performance.now() - (this._bootAt || 0) > 1500) this.tipOnce('welcome');
      if (!seen.finger && seen.welcome && h.spiders.length && performance.now() - (this._bootAt || 0) > 45000) this.tipOnce('finger');
      if (!seen.hungry && h.spiders.some(s => s.sat < 0.35) && !h.prey.some(p => !p.owner && JT.PREY_BY_ID[p.type].huntable)) this.tipOnce('hungry');
      if (!seen.molt && h.spiders.some(s => ['moltSeek', 'moltSilk', 'premolt', 'molting'].includes(s.state))) this.tipOnce('molt');
      if (!seen.night && g.daylight() < 0.3 && h.spiders.length) this.tipOnce('night');
    },
    /** Haptic feedback for a moment (see HAPTIC). gesture = called straight from your own tap (lets iPhones tick). */
    buzz(kind, gesture) {
      if (!this.set || this.set.haptics === false) return; const pat = HAPTIC[kind]; if (pat == null) return;
      if (canVibrate()) { try { navigator.vibrate(pat); } catch (e) { /* blocked until first tap */ } return; }
      if (IOS && gesture) iosTick();
    },
    hapticsInfo() { return canVibrate() ? 'Buzzes on taps, pounces, catches and molts.' : IOS ? 'iPhone: a light tick on your own taps only (Safari has no full vibration).' : 'This device has no vibration.'; },
    /** Your fingertip at the glass (sx, sy in canvas px). held = press-and-hold; fast = a quick swipe (startles). */
    fingerAt(sx, sy, held, fast) {
      const h = this.hab; if (!h) return; const pos = this.R.fingerPoint(sx, sy, h); if (!pos) return;
      const f = h.finger; const same = f && f.held && held && !(fast && !f.fast);
      this._fingerN = (this._fingerN || 0) + (same ? 0 : 1);
      if (!held) { A().sfx('glass'); this.buzz('tap', true); } else if (fast && !(f && f.fast)) { A().sfx('glass'); this.buzz('startle'); }
      h.finger = { id: this._fingerN, pos, t: h.time, held: !!held, fast: !!fast };
    },
    fingerEnd() {
      const h = this.hab; if (h && h.finger) { h.finger.held = false; h.finger.fast = false; h.finger.t = h.time; }
    },
    key(e) {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'z' || k === 'Z' || k === 'y' || k === 'Y')) { if (this.obs || !$('modalWrap').classList.contains('hidden')) return; e.preventDefault(); if (k === 'y' || k === 'Y' || e.shiftKey) this.redo(); else this.undo(); return; }
      if (this._ufEl) { if (k === 'Enter') { e.preventDefault(); this.unlockClose(true); } else if (k === 'Escape' || k === ' ') { e.preventDefault(); this.unlockClose(false); } return; } // v18 unlock reveal
      if (this.tv) { if (!/^(Shift|Control|Alt|Meta|CapsLock|Fn)$/.test(k)) { e.preventDefault(); this.tvMode(false); } return; } // Ambient TV: any key brings the controls back
      if (this.photo) { if (k === 'Escape' || k === 'p' || k === 'P') this.photoMode(false); else if (k === ' ' || k === 'Enter') { e.preventDefault(); this.photoSnap(); } return; }
      if ((k === 'p' || k === 'P') && this.obs) { this.photoMode(true); return; }
      if (k === 'Escape') { if (this.obs) this.toggleObserve(false); else if (!$('modalWrap').classList.contains('hidden')) this.closeModal(); else if (this.mode) this.endMode(); else if (this.tab) this.closeDrawer(); else if (this.panelId) this.hidePanel(); return; }
      if (k === 'o' || k === 'O') { this.toggleObserve(); return; }
      if (k === 't' || k === 'T') { this.tvMode(true); return; }
      if (this.obs) return;
      if (k === 'r' || k === 'R') { if (this.mode === 'place') this.rotatePlace(); return; }
      if ((k === 'l' || k === 'L') && this.mode === 'place') { this.toggleLeaves(); return; }
      if (k >= '1' && k <= '4') { const cm = this.camModes()[+k - 1]; if (cm) this.setCam(cm); } else if (k === 'f' || k === 'F') this.toggleObserve(true, this.game.selectedId);
      else if (k === '+' || k === '=') this.R.zoomBy(1.2); else if (k === '-' || k === '_') this.R.zoomBy(1 / 1.2); else if (k === '0') this.R.resetView();
      else if (k === 'm' || k === 'M') this.tool('mist');
      else if (k === 'b' || k === 'B') this.tool('build'); else if (k === 'c' || k === 'C') this.tool('care'); else if (k === 'j' || k === 'J') this.tool('jumpers');
      else if (k === 'Enter' && this.mode === 'place') this.modeDone();
    },

    // ------------------------------------------------ header
    refreshHeader() {
      const g = this.game, st = g.state;
      const tabs = $('habTabs'); tabs.innerHTML = '';
      { const many = g.habs.length > 4; const show = many ? [st.active] : g.habs.map((_, i) => i); // v11: up to 30 tanks, so a long shelf collapses into the tank list
        for (const i of show) { const h = g.habs[i]; const b = el('button', i === st.active ? 'on' : '', esc(h.title)); b.title = JT.HABITATS[h.data.type].name + ' · ' + h.spiders.length + ' jumper(s)'; b.onclick = () => this.switchHab(i); tabs.appendChild(b); }
        const all = el('button', 'tk-all', g.habs.length > 1 ? 'All tanks · ' + g.habs.length : 'Tanks'); all.title = 'All your tanks'; all.onclick = () => this.tanksModal(); tabs.appendChild(all); }
      $('habPicker').textContent = g.hab.title + ' \u25BE';
      this.syncCams();
      document.querySelectorAll('#timeMode button').forEach(b => b.classList.toggle('on', b.dataset.tm === st.timeMode));
      $('btnSound').textContent = this.set.muted ? 'Muted' : 'Sound';
      const grp = this.tab === 'food' ? 'care' : this.tab ? 'build' : this._sheet || null;
      document.querySelectorAll('#toolbar button').forEach(b => b.classList.toggle('on', b.dataset.tool === grp));
    },
    updateClock() { $('dayLbl').textContent = 'Day ' + this.game.day(); $('timeLbl').textContent = JT.fmtTime(this.game.tod()) + (this.game.state.timeMode !== 'auto' ? (this.game.state.timeMode === 'day' ? ' · day' : ' · night') : ''); },
    /** Views on offer: a back wall closes off the back, so wall tanks get the two sides instead. */
    hasWall(h) { h = h || this.hab; return !!h && h.decor.some(d => (JT.DECOR_BY_ID[d.type] || {}).arche === 'backwall'); },
    camModes() { return this.hasWall() ? ['iso', 'observer', 'left', 'right'] : ['iso', 'observer', 'reverse']; },
    /** Show only the views that make sense for this tank; slide to Front if the current one stopped making sense. */
    syncCams() {
      const ms = this.camModes(), cur = this.R.cam.mode; this._camKey = ms.join();
      { const lb = $('camLbl'); if (lb) lb.textContent = (JT.CAMS[cur] && JT.CAMS[cur].label || 'View').replace(/^Isometric$/, 'Iso'); }
      document.querySelectorAll('#cams button, #camCtl button[data-cam]').forEach(b => { b.classList.toggle('hidden', !ms.includes(b.dataset.cam)); b.classList.toggle('on', b.dataset.cam === cur); });
      if (!this.obs && cur !== 'follow' && !ms.includes(cur)) { this.R.setMode('observer'); document.querySelectorAll('#cams button, #camCtl button[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === 'observer')); }
    },
    setCam(m) {
      if (m !== 'follow' && !this.camModes().includes(m)) m = 'observer';
      if (m === 'follow' && this.R.cam.mode !== 'follow') this._prevCam = this.R.cam.mode;
      if (m === 'follow' && !this.hab.spider(this.game.selectedId)) { const s0 = this.hab.spiders[0]; if (s0) this.game.selectedId = s0.id; else { this.toast('No jumper here to follow yet.'); return; } }
      this.R.setMode(m); this.refreshHeader(); if (this.panelId) this.renderPanel(true);
    },
    /** Start following a jumper (tap on it, or the Follow control). */
    follow(id) { this.toggleObserve(true, id || this.game.selectedId); }, // Follow and Observe are one mode now
    /** Stop following and ease back to the previous overview camera. */
    unfollow() { if (this.obs) { this.toggleObserve(false); return; } if (this.R.cam.mode !== 'follow') return; const prev = this._prevCam && this._prevCam !== 'follow' ? this._prevCam : 'iso'; this.setCam(prev); },
    toggleFollow() { this.toggleObserve(null, this.game.selectedId); },
    setTimeMode(m) { this.game.state.timeMode = m; this.refreshHeader(); this.updateClock(); A().sfx('click'); },
    switchHab(i) {
      const g = this.game; if (i === g.state.active) return; this.cancelMode(); this.undoClear && this.undoClear(); const rep = g.activate(i);
      const h = g.hab; g.selectedId = h.spiders[0] ? h.spiders[0].id : null; this.R.cur = null; this.R.resetView();
      if (rep && rep.meals.length) setTimeout(() => this.toast('While you were away: ' + rep.meals.map(([x, n]) => '<b>' + esc(x.name) + '</b> caught ' + (n === 1 ? 'a meal' : n + ' meals')).join(', ') + '.', 'quiet', 4200), 350);
      if (g.selectedId && !this.isMobile()) this.showPanel(g.selectedId); else this.hidePanel();
      if (this.obs) this.obs.sub = null;
      if (this.tab) this.openDrawer(this.tab); this.refreshHeader(); A().sfx('click');
    },
    /** A small line of text that fades in and out (no boxes). */
    toast(text, cls, ms) {
      const t = el('div', 'toast ' + (cls || ''), text); $('toasts').appendChild(t);
      while ($('toasts').children.length > 3) { const T = $('toasts'); ([...T.children].find(c => !c.classList.contains('replay')) || T.firstChild).remove(); } // the slow-motion offer is never pushed out by a journal note
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 900); }, ms || 2800);
      return t;
    },
    /** Overlap manager: toasts take the first free slot (top or bottom strip, or just past a panel) that no visible HUD covers,
        centred in the widest clear span. Visible HUD rects are also handed to the renderer so floating text keeps clear. */
    layoutHud() {
      const T = $('toasts'); const vw = root.innerWidth, vh = root.innerHeight;
      const rect = (id) => { const e = $(id); if (!e || e.classList.contains('hidden')) return null; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).display !== 'none' ? r : null; };
      const solid = (id) => { const e = $(id); if (!e) return null; const r = rect(id); if (!r) return null; // content box only (ignore soft fade padding)
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const c of e.children) { const q = c.getBoundingClientRect(); if (q.width < 1 || q.height < 1) continue; x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
        return x1 > x0 ? { left: x0, top: y0, right: x1, bottom: y1 } : r; };
      const hud = ['obsHud', 'spiderPanel', 'modeBar', 'popover'].map(rect).concat([solid('camCtl')]).filter(Boolean);
      const top = solid('top'), bars = [solid('dock'), solid('toolbar'), rect('drawer')].filter(Boolean);
      const all = hud.concat(bars, top ? [top] : []);
      this.R.hudRects = all.map(r => [r.left, r.top, r.right, r.bottom]);
      document.body.classList.toggle('lowfx', this.R.quality === 'low' || !!(this.set.perf && this.set.ptNoBlur));
      for (const bar of [$('dock'), document.querySelector('#toolbar .gl-bar')]) { // slide the glass lens under the current item
        const L = bar && bar.querySelector('.lens'); if (!L) continue; const b = bar.querySelector('button.on');
        if (!b || !b.offsetWidth) { L.classList.remove('on'); continue; }
        const st = L.style; st.left = b.offsetLeft + 'px'; st.top = b.offsetTop + 'px'; st.width = b.offsetWidth + 'px'; st.height = b.offsetHeight + 'px'; L.classList.add('on'); }
      { const D = $('replayDock'); if (D) { // the slow-motion offer sits just above the Observe caption while observing
        if (this.obs) { for (const c of [...T.querySelectorAll('.toast.replay')]) D.appendChild(c); } else for (const c of [...D.children]) T.appendChild(c);
        if (D.children.length) { const o = rect('obsHud'); const oc = solid('obsHud'); const yb = oc ? oc.top : (o ? o.top + 20 : vh - 80); D.style.bottom = Math.round(Math.max(8, vh - yb + 8)) + 'px'; } } }
      if (!T.children.length) return;
      const pad = 8, th = T.offsetHeight + 2, tw = Math.min(440, vw - pad * 2);
      const yTop = (top ? top.bottom : 0) + pad, yBot = Math.min(vh, ...bars.map(r => r.top)) - pad - th;
      const cands = this.isMobile() && vh > vw ? [yBot, yTop] : [yTop, yBot];
      for (const o of hud) cands.push(o.bottom + pad, o.top - pad - th);
      const free = (y) => { // widest clear horizontal span for the band [y, y + th]
        let spans = [[pad, vw - pad]];
        for (const o of all) { if (o.bottom <= y || o.top >= y + th) continue; const nx = []; for (const [a, b] of spans) { if (o.right <= a || o.left >= b) { nx.push([a, b]); continue; } if (o.left > a) nx.push([a, o.left - pad]); if (o.right < b) nx.push([o.right + pad, b]); } spans = nx; }
        let best = null; for (const sp of spans) { const w = sp[1] - sp[0]; const mid = (sp[0] + sp[1]) / 2; const sc = Math.min(w, tw) * 2 - Math.abs(mid - vw / 2) * 0.2; if (!best || sc > best.sc) best = { a: sp[0], b: sp[1], w, sc }; } return best; };
      let pick = null;
      for (const y of cands) { if (y < pad || y + th > vh - pad) continue; const f = free(y); if (f && f.w >= Math.min(tw, 240)) { pick = { y, f }; break; } }
      if (!pick) { const f = free(yTop); pick = { y: Math.max(pad, yTop), f: f || { a: pad, b: vw - pad, w: vw - pad * 2 } }; }
      const w = Math.min(440, pick.f.w); const cx = M.clamp(vw / 2, pick.f.a + w / 2, pick.f.b - w / 2);
      const st = T.style; st.top = Math.round(pick.y) + 'px'; st.bottom = 'auto'; st.left = Math.round(cx - w / 2) + 'px'; st.width = Math.floor(w) + 'px'; st.maxWidth = 'none'; st.transform = 'none';
    },

    // ------------------------------------------------ simulation events
    onGame(t, d) {
      const R = this.R;
      if (t === 'pounce' && d.sp && d.sp._air && M.finite3(d.sp._air.from) && R && R.particles && R.particles.length < 380) { const o = d.sp._air.from; const L = JT.SpiderAI.len(d.sp); const fl = d.sp._air.launchSup === 'floor'; // bits of substrate kicked back
        const dir = M.norm(M.sub(d.sp._air.from, d.sp._air.to)); for (let i = 0; i < (fl ? 9 : 4); i++) R.particles.push({ pos: o.slice(), v: [dir[0] * 9 + (JT.R() - 0.5) * 10, 4 + JT.R() * 9, dir[2] * 9 + (JT.R() - 0.5) * 10], t: 0, life: 0.35 + JT.R() * 0.35, col: fl ? 'rgba(120,92,64,0.85)' : 'rgba(170,150,120,0.6)', r: Math.max(0.12, L * 0.03) + JT.R() * 0.15 }); }
      if (t === 'catch' && JT.Replay && d.sp && !JT.Replay.active) { const tc = this.game.state.time; setTimeout(() => { if (!JT.Replay.active && this.game.hab.spider(d.sp.id)) JT.Replay.onCatch(this, d.sp, tc); }, 450); }
      const mine = d && d.sp && (d.sp.id === this.game.selectedId || (this.obs && d.sp.id === this.obs.sub)); // the jumper you are looking at
      if (t === 'pounce' && mine) { A().sfx('pounce'); this.buzz('pounce'); }
      if (t === 'catch') { const pd = d.prey && JT.PREY_BY_ID[d.prey.type]; A().sfx(pd && (pd.fly || pd.flies || /fly|gnat|moth|lacewing/.test(d.prey.type)) ? 'strikeFly' : 'strike'); if (mine || this.obs) this.buzz('catch'); }
      else if (t === 'shaken') { if (mine) A().sfx('escape'); }
      else if (t === 'bigLeap') { A().sfx('rustle'); setTimeout(() => A().sfx('land'), 380); if (mine) this.buzz('pounce'); }
      else if (t === 'finger') { if (d.kind === 'shy') A().sfx('startle'); else if (d.kind === 'curious') { A().sfx('curious'); this.buzz('curious'); } }
      else if (t === 'jump') { if (JT.R() < 0.3) A().sfx('rustle'); }
      else if (t === 'journal') { this.toast('<span class="sc">Journal</span> ' + esc(d.entry.title) + '<span class="sub">' + esc(d.entry.text) + '</span>', 'journal', 5600); A().sfx('journal'); this.buzz('journal'); this.tipOnce('journal'); }
      else if (t === 'molt') { const sp = d.sp; if (sp) { if (sp.stage === JT.STAGES.length - 1) this.adultFx(sp); else this.toast(esc(sp.name) + ' molted — now a ' + JT.STAGES[sp.stage] + '.', '', 3500); } A().sfx('molt'); this.buzz('molt'); }
      else if (t === 'unlock') { (this._unlockQ = this._unlockQ || []).push({ S: d.S, why: d.why }); } // v18: the reveal shows once nothing else is on (see unlockPump)
      else if (t === 'toast') this.toast(d.text, d.cls, d.ms);
    },

    // ------------------------------------------------ toolbar & dock
    tool(t) {
      if (this.obs) return; A().sfx('click');
      if (t === 'build') { if (this.tab && this.tab !== 'food') this.closeDrawer(); else { this.closeModal(); this.openDrawer(this._buildTab || 'decor'); } }
      else if (t === 'care') { if (this.tab === 'food') this.closeDrawer(); else { this.closeModal(); this.openDrawer('food'); } }
      else if (t === 'decor' || t === 'plants' || t === 'substrate' || t === 'food' || t === 'walls') { if (this.tab === t) this.closeDrawer(); else this.openDrawer(t); }
      else if (t === 'jumpers') { if (this._sheet === 'jumpers') this.closeModal(); else { this.closeDrawer(); this.jumpersSheet(); } }
      else if (t === 'journal') { if (this._sheet === 'journal') this.closeModal(); else { this.closeDrawer(); this.jumpersSheet('journal'); } }
      else if (t === 'mist') this.doMist();
      else if (t === 'clean') this.doClean();
      else if (t === 'remove') { if (this.mode === 'remove') this.endMode(); else this.startRemove(); }
      this.refreshHeader();
    },
    dock(d) {
      A().sfx('click');
      document.querySelectorAll('#dock button').forEach(b => b.classList.remove('on'));
      if (d === 'build') { if (this.tab && this.tab !== 'food') this.closeDrawer(); else { this.closeModal(); this.openDrawer(this._buildTab || 'decor'); this.dockOn('build'); } }
      else if (d === 'food' || d === 'care') { if (this.tab === 'food') this.closeDrawer(); else { this.closeModal(); this.openDrawer('food'); this.dockOn('care'); } }
      else if (d === 'jumpers') { this.closeDrawer(); if (this._sheet === 'jumpers' || this._sheet === 'journal') this.closeModal(); else this.jumpersSheet(); }
      else if (d === 'follow') { this.closeDrawer(); this.toggleFollow(); }
      else if (d === 'observe') { this.closeDrawer(); this.toggleObserve(); }
      else if (d === 'more') { this.closeDrawer(); if (this._sheet === 'menu') this.closeModal(); else this.moreSheet(); }
    },
    dockOn(d) { const b = document.querySelector('#dock button[data-dock="' + d + '"]'); if (b) b.classList.add('on'); },
    doMist() {
      if (performance.now() - this._mistT < 1500) return; this._mistT = performance.now();
      this.hab.mist(); this.hab._mistAt = this.hab.time; this.R.mistFx(this.hab); A().sfx('mist');
      this.toast('Misted. Fresh droplets bead on leaves and stones.');
    },
    doClean() {
      const r = this.hab.clean(); A().sfx(r.total ? 'rustle' : 'click');
      const bits = []; if (r.husks) bits.push(r.husks + ' husk' + (r.husks > 1 ? 's' : '')); if (r.silk) bits.push(r.silk + ' silk line' + (r.silk > 1 ? 's' : '')); if (r.nests) bits.push(r.nests + ' empty retreat' + (r.nests > 1 ? 's' : ''));
      this.toast(bits.length ? 'Tidied away ' + bits.join(', ') + '.' : 'Everything is already tidy.');
    },

    // ------------------------------------------------ drawer
    openDrawer(tab) {
      this.tab = tab; if (tab !== 'food') this._buildTab = tab; this.undoSync(); if (this._tipId) { this.hideTip(true); this._tipWait = 0.4; } this.tipOnce(tab === 'food' ? 'care' : 'build', false, true); const d = $('drawer'); d.classList.remove('hidden'); d.classList.toggle('care', tab === 'food');
      if (!$('modalWrap').classList.contains('hidden')) this.closeModal(); // one sheet at a time
      const tabs = $('drawerTabs'); tabs.innerHTML = '';
      const list = tab === 'food' ? [['food', 'Care']] : [['decor', 'Decor'], ['plants', 'Plants'], ['walls', 'Walls'], ['substrate', 'Ground']];
      for (const [id, lab] of list) { const b = el('button', id === tab ? 'on' : '', lab); b.onclick = () => { A().sfx('click'); this.openDrawer(id); }; tabs.appendChild(b); }
      if (tab !== 'food') { const b = el('button', 'rm' + (this.mode === 'remove' ? ' on' : ''), 'Remove'); b.title = 'Tap decor in the tank to remove it'; b.onclick = () => { if (this.mode === 'remove') this.endMode(); else this.startRemove(); if (this.mode !== 'remove') this.openDrawer(this.tab); }; tabs.appendChild(b); }
      const h = this.hab;
      $('drawerTitle').textContent = tab === 'food' ? h.livePreyCount() + ' of ' + JT.PREY_CAP + ' live · humidity ' + Math.round(h.data.humidity * 100) + '%' : tab === 'substrate' ? 'Substrate, ground shape and ground cover' : tab === 'walls' ? 'Pick a wall, then dress it: wall decor is free' : 'Choose a piece, then place it';
      const body = $('drawerBody'); body.innerHTML = ''; body.scrollLeft = 0;
      const chips = $('drawerChips'); chips.innerHTML = ''; chips.classList.add('hidden');
      const sect = (label, id) => { const e = el('div', 'sect', esc(label)); if (id) e.dataset.g = id; body.appendChild(e); return e; };
      const chip = (label, on, fn, cls) => { const b = el('button', (on ? 'on ' : '') + (cls || ''), esc(label)); b.onclick = () => { A().sfx('click'); fn(); }; chips.appendChild(b); chips.classList.remove('hidden'); return b; };
      const jump = (gid) => { const e = body.querySelector('.sect[data-g="' + gid + '"]'); if (e) body.scrollTo($('drawer').classList.contains('bm-drawer') ? {top: Math.max(0,e.offsetTop-body.offsetTop-6),behavior:'smooth'} : { left: Math.max(0, e.offsetLeft - 6), behavior: 'smooth' }); };
      if (tab === 'decor' || tab === 'plants') {
        // sorted into groups; chips jump to a group, "Suits ..." keeps only pieces your jumpers blend in with
        const mine = new Set(h.spiders.map(x => x.species)); const suits = (x) => (x.blend || []).some(id => mine.has(id));
        let items = JT.DECOR.filter(x => x.cat === tab); const anySuit = items.some(suits); if (!anySuit) this._suits = false;
        if (this._suits) items = items.filter(suits);
        const groups = UI.GROUPS[tab].map(([lab, arches]) => [lab, items.filter(x => arches.includes(x.arche))]); const known = new Set(UI.GROUPS[tab].flatMap(g => g[1]));
        const rest = items.filter(x => !known.has(x.arche)); if (rest.length) groups.push(['Other', rest]);
        if (anySuit) chip(this._suits ? 'Showing what suits your jumpers' : 'Suits your jumpers', this._suits, () => { this._suits = !this._suits; this.openDrawer(tab); }, 'suit');
        groups.forEach(([lab, xs], gi) => { if (!xs.length) return; sect(lab, 'g' + gi); for (const x of xs) body.appendChild(this.decorCard(x)); if (!this._suits) chip(lab, false, () => jump('g' + gi)); });
      }
      else if (tab === 'walls') {
        for (const d of JT.DECOR.filter(x => x.arche === 'backwall')) body.appendChild(this.decorCard(d));
        const kit = JT.wallKit(h), w = h.backWall();
        if (!w) body.appendChild(el('div', 'sect', 'Add a wall for free wall decor'));
        else {
          body.appendChild(el('div', 'sect', 'Wall decor · free · ' + h.data.decor.filter(d => d.wall === w.id).length + '/' + JT.WALL_CAP));
          const c = el('div', 'card'); c.title = 'Dress wall — place a small, composed set from this wall\'s kit (replaces earlier wall decor)';
          c.appendChild(lazyThumb(() => this.R.hasThumb(w.type, 0, 112), () => this.R.decorThumb(w.type, 0, 112))); c.appendChild(el('div', 'nm', 'Dress wall')); c.appendChild(el('div', 'pr', 'auto'));
          c.onclick = () => { this.undoPush('Dress the wall'); const n = JT.Presets.dressWall(h, null, 4, 'player'); if (!n) this.undoDrop(); A().sfx('place'); this.buzz('place', true); this.toast(n ? 'Dressed the wall with ' + n + ' pieces.' : 'No room on the wall.', 'quiet'); this.game.save(); this.openDrawer('walls'); };
          body.appendChild(c);
          const look = h.wallLook(w.id); for (const id of kit) body.appendChild(this.decorCard(JT.DECOR_BY_ID[id], look));
        }
      }
      else if (tab === 'substrate') {
        sect('Substrate', 'gs'); for (const id in JT.SUBSTRATES) body.appendChild(this.substrateCard(id));
        if (JT.Terrain) { sect('Ground shape', 'gh'); for (const id of JT.Terrain.SHAPE_ORDER) body.appendChild(this.shapeCard(id)); body.appendChild(this.shapeCard('reroll')); }
        sect('Ground cover', 'gc');
        for (const d of JT.DECOR.filter(x => x.cat === 'ground')) body.appendChild(this.decorCard(d));
        chip('Substrate', false, () => jump('gs')); if (JT.Terrain) chip('Ground shape', false, () => jump('gh')); chip('Ground cover', false, () => jump('gc'));
      } else if (tab === 'food') {
        // care first (mist, clean), then live food from smallest to largest, with the sizes your jumpers can take marked
        sect('Care', 'gk'); body.appendChild(this.careCard('mist')); body.appendChild(this.careCard('clean'));
        const AI = JT.SpiderAI; const sps = h.spiders;
        const fits = (p) => sps.filter(sp => { const L = AI.len(sp); return p.len <= L * Math.min(1.25, AI.sizeLimit(sp)) && p.len >= L * 0.12; });
        const food = JT.PREY.filter(p => !p.cleaner).sort((a, b) => a.len - b.len); const crew = JT.PREY.filter(p => p.cleaner);
        const bands = [['Tiny', 0, 3], ['Small', 3, 6], ['Medium', 6, 10], ['Large', 10, 1e9]];
        bands.forEach(([lab, a, b2], bi) => { const xs = food.filter(p => p.len >= a && p.len < b2); if (!xs.length) return; sect(lab + ' prey', 'f' + bi); for (const p of xs) body.appendChild(this.preyCard(p, fits(p))); chip(lab, false, () => jump('f' + bi)); });
        if (crew.length) { sect('Cleanup crew', 'fc'); for (const p of crew) body.appendChild(this.preyCard(p, null)); chip('Cleanup crew', false, () => jump('fc')); }
      }
      this.refreshHeader(); this.syncDrawerSpace();
    },
    /** Mist / Clean as the first cards of the Care strip. */
    careCard(kind) {
      const h = this.hab; const c = el('div', 'card care-' + kind); const cv = document.createElement('canvas'); cv.width = cv.height = 112; const g = cv.getContext('2d');
      if (kind === 'mist') { const rng = JT.makeRng(5); for (let i = 0; i < 16; i++) { const x = 20 + rng() * 72, y = 22 + rng() * 66, r = 3 + rng() * 6; const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(150,200,225,.75)'); gr.addColorStop(1, 'rgba(70,120,150,.55)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); } }
      else { g.strokeStyle = 'rgba(90,64,40,.9)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(30, 82); g.lineTo(78, 30); g.stroke(); g.fillStyle = 'rgba(160,120,70,.9)'; g.beginPath(); g.moveTo(16, 86); g.lineTo(40, 66); g.lineTo(50, 78); g.lineTo(30, 98); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,240,200,.9)'; for (const [x, y] of [[80, 66], [88, 54], [70, 80]]) { g.beginPath(); g.arc(x, y, 2.6, 0, 6.283); g.fill(); } }
      c.appendChild(cv);
      if (kind === 'mist') { c.appendChild(el('div', 'nm', 'Mist')); c.appendChild(el('div', 'pr', 'humidity ' + Math.round(h.data.humidity * 100) + '%')); c.title = 'Mist the tank: fresh droplets to drink (M)'; c.onclick = () => { this.doMist(); this.openDrawer('food'); }; }
      else { const n = (h.data.remains || []).length; c.appendChild(el('div', 'nm', 'Clean')); c.appendChild(el('div', 'pr', n ? n + ' to tidy' : 'tidy')); c.title = 'Tidy away husks, old silk and empty retreats'; c.onclick = () => { this.doClean(); this.openDrawer('food'); }; }
      return c;
    },
    /** Toast lines sit just above the shop strip while it is open. */
    syncDrawerSpace() { const d = $('drawer'); const open = !d.classList.contains('hidden'); document.body.classList.toggle('drawer-open', open); document.documentElement.style.setProperty('--drawerH', open ? Math.round(d.getBoundingClientRect().height) + 'px' : '0px'); },
    closeDrawer() { this.tab = null; $('drawer').classList.add('hidden'); this.syncDrawerSpace(); document.querySelectorAll('#dock button').forEach(b => b.classList.remove('on')); this.refreshHeader(); },
    decorCard(d, look) {
      // v17: cards are kept and reused when a tab opens again (no rebuilding 70 cards and copying their pictures)
      const CC = this._cardCache || (this._cardCache = new Map()); const h0 = this.hab; const B0 = JT.Biomes;
      const ck = look ? null : d.id + '|' + (B0 && B0.id ? B0.id(h0) : '') + '|' + ((h0.spiders[0] && h0.spiders[0].species) || h0.data.buildSpecies || '');
      if (ck && CC.has(ck)) { const e = CC.get(ck); requeue(e); return e; }
      const e = this.decorCard0(d, look); if (ck) CC.set(ck, e); return e;
    },
    decorCard0(d, look) {
      const c = el('div', 'card'); c.title = d.name + (d.desc ? ' — ' + d.desc : '') + (d.platform ? ' — platform (others can stack on top)' : '') + (d.stack ? ' — can be stacked on platforms' : '');
      c.appendChild(lazyThumb(() => this.R.hasThumb(d.id, 0, 112, look), () => this.R.decorThumb(d.id, 0, 112, look)));
      const tgs = [d.platform && 'platform', d.stack && 'stackable', d.cover >= 0.5 && 'cover', d.water && 'water', d.flowers && 'flowers', d.lamp && 'warm light'].filter(Boolean); const tg = tgs.join(', '); if (tg) c.title += ' — ' + tg;
      const bl = JT.blendNames(d); if (bl.length) c.title += ' — Blends with: ' + bl.join(', ');
      c.appendChild(el('div', 'nm', esc(d.name))); c.appendChild(el('div', 'pr' + (bl.length ? ' blend' : ''), bl.length ? 'Blends with: ' + esc(bl.join(', ')) : tgs[0] || (d.cat === 'plants' ? 'plant' : d.cat === 'walls' ? 'wall' : 'decor')));
      c.onclick = () => this.startPlace(d.id);
      return c;
    },
    substrateCard(id) {
      const S = JT.SUBSTRATES[id]; const h = this.hab; const cur = h.data.substrate === id;
      const c = el('div', 'card' + (cur ? ' cur' : ''));
      const cv = document.createElement('canvas'); cv.width = cv.height = 112; const g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 112); gr.addColorStop(0, S.top); gr.addColorStop(0.62, S.top); gr.addColorStop(0.63, S.mid); gr.addColorStop(1, S.dark); g.fillStyle = gr; g.fillRect(0, 0, 112, 112);
      const rng = JT.makeRng(JT.hashStr(id)); for (let i = 0; i < 260; i++) { g.fillStyle = S.speck[i % 2]; const x = rng() * 112, y = rng() * 70; g.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 1.5); }
      c.appendChild(cv); c.appendChild(el('div', 'nm', esc(S.name))); c.appendChild(el('div', 'pr', cur ? 'current' : S.moist > 0.6 ? 'humid' : S.moist < 0.25 ? 'dry' : 'balanced'));
      c.title = S.name + ' — ' + (S.burrow > 0.6 ? 'burrowable, ' : '') + (S.moist > 0.6 ? 'humid' : S.moist < 0.25 ? 'dry' : 'balanced');
      c.onclick = () => {
        if (cur) return;
        this.undoPush('Ground: ' + S.name); h.data.substrate = id; if (h.backWall()) h.rebuild(); /* the wall is built from the substrate */ this.R._speck = null; A().sfx('place'); this.buzz('place', true); this.toast('Substrate changed to ' + esc(S.name) + '.'); this.openDrawer('substrate');
      };
      return c;
    },
    /** v15: Ground shape cards (Flat / Gentle / Rolling / Rugged) and "New shape" (same style, new random lumps; undoable). */
    shapeCard(id) {
      const T = JT.Terrain, h = this.hab, cf = T.conf(h), S = JT.SUBSTRATES[h.data.substrate] || JT.SUBSTRATES.coco; const re = id === 'reroll'; const cur = !re && cf.shape === id;
      const c = el('div', 'card shape-card' + (cur ? ' cur' : '')); const cv = document.createElement('canvas'); cv.width = cv.height = 112; const g = cv.getContext('2d');
      g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 112, 112); const prof = T.profile(h, re ? 'rugged' : id, re ? (cf.seed * 7 + 13) % 1000003 : cf.seed, 112);
      const base = 78; g.beginPath(); g.moveTo(0, 112); for (let x = 0; x < 112; x++) g.lineTo(x, base - prof[x] * 5.5); g.lineTo(112, 112); g.closePath();
      const gr = g.createLinearGradient(0, 40, 0, 112); gr.addColorStop(0, S.top); gr.addColorStop(0.55, S.mid); gr.addColorStop(1, S.dark); g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(43,34,25,.75)'; g.lineWidth = 1.6; g.beginPath(); for (let x = 0; x < 112; x++) { const y = base - prof[x] * 5.5; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
      if (re) { g.strokeStyle = 'rgba(43,34,25,.85)'; g.lineWidth = 3; g.beginPath(); g.arc(56, 32, 13, 0.5, 5.2); g.stroke(); g.beginPath(); g.moveTo(68, 18); g.lineTo(70, 31); g.lineTo(57, 28); g.stroke(); }
      c.appendChild(cv); c.appendChild(el('div', 'nm', re ? 'New shape' : esc(T.SHAPES[id].name)));
      c.appendChild(el('div', 'pr', re ? 'reroll the lumps' : cur ? 'current' + (cf.auto && id !== 'gentle' ? ' · biome' : '') : id === 'flat' ? 'level floor' : id === 'gentle' ? 'soft bumps' : id === 'rolling' ? 'hills and dips' : 'steep and lumpy'));
      c.title = re ? 'New shape — same ground style, new random hills and hollows (undo with the arrow)' : T.SHAPES[id].name + ' ground — ' + (cf.style.label || '') + '. Flattens under decor and near the glass.';
      c.onclick = () => {
        if (cur) return; const t = h.data.terrain || (h.data.terrain = {});
        if (re) { this.undoPush('New ground shape'); t.seed = Math.floor(JT.R() * 1000003); if (!T.SHAPES[t.shape]) t.shape = cf.shape; }
        else { this.undoPush('Ground shape: ' + T.SHAPES[id].name); t.shape = id; }
        h._ter = null; A().sfx('place'); this.buzz('place', true);
        this.toast(re ? (cf.shape === 'flat' ? 'New shape saved — pick Gentle, Rolling or Rugged to see it.' : 'New ground shape.') : 'Ground shape: ' + T.SHAPES[id].name + '.', 'quiet'); this.game.save(); this.openDrawer('substrate');
      };
      return c;
    },
    preyCard(p, fits) {
      const c = el('div', 'card' + (fits && fits.length ? ' fits' : ''));
      c.appendChild(cloneCanvas(this.R.preyPortrait(p.id, 112)));
      c.appendChild(el('div', 'nm', esc(p.name) + (p.count > 1 ? ' ×' + p.count : '')));
      c.appendChild(el('div', 'pr', '~' + p.len + ' mm' + (fits && fits.length ? ' · <span class="ok">' + (fits.length === 1 ? 'good for ' + esc(fits[0].name) : 'good size') + '</span>' : fits ? '' : ' · cleaner')));
      c.title = p.name + ' — ' + (TAGS(p) || 'ground prey') + (p.cleaner ? '. Cleanup crew: eats husks and shed skins, even up on decor.' : '. About ' + p.len + ' mm long.');
      c.onclick = () => {
        const h = this.hab; const n = p.count || 1;
        if (h.prey.length + n > JT.PREY_CAP) { this.toast('This habitat already has plenty of live food (' + JT.PREY_CAP + ' max).'); A().sfx('error'); this.buzz('error', true); return; }
        h.addPrey(p.id, n); A().sfx('feed'); this.buzz('tap', true); this.toast('Released ' + (n > 1 ? n + ' ' : 'a ') + esc(p.name) + '.');
        $('drawerTitle').textContent = h.livePreyCount() + ' of ' + JT.PREY_CAP + ' live · humidity ' + Math.round(h.data.humidity * 100) + '%';
      };
      return c;
    },

    // ------------------------------------------------ placement & removal
    startPlace(type) {
      this.cancelMode(); const d = JT.DECOR_BY_ID[type];
      this.mode = 'place'; this.place = { type, rot: 0, seed: (JT.R() * 1e9) | 0, x: null, z: null, ok: false, bare: false };
      const lv = $('modeLeaves'); lv.classList.toggle('hidden', d.arche !== 'tree'); lv.textContent = 'Leaves';
      this.cv.classList.add('placing'); $('modeBar').classList.remove('hidden'); $('modeRotate').classList.toggle('hidden', d.arche === 'backwall'); $('modeDone').classList.remove('hidden');
      if (this.tab) { $('drawer').classList.add('hidden'); this.syncDrawerSpace(); } // v11.2: minimise the build drawer on every screen while placing
      // start the ghost in the middle so touch users see it immediately
      const r = this.cv.getBoundingClientRect(); this.updateGhost(r.width / 2, r.height * 0.55);
      this.setModeText(); void d;
    },
    setModeText() {
      const p = this.place; if (!p) return; const d = JT.DECOR_BY_ID[p.type]; const touch = this.ptrType !== 'mouse';
      const st = p.ok ? '<span class="ok">fits here</span>' : '<span class="bad">' + esc(p.reason || 'Not here') + '</span>';
      $('modeText').innerHTML = '<b>' + esc(d.name) + '</b> · ' + st; void touch;
    },
    updateGhost(sx, sy) { const p = this.place; if (!p) return; this.applyGhost(this.R.placementPoint(sx, sy, this.hab, p.type)); },
    applyGhost(pt) {
      const p = this.place; if (!p) return; const h = this.hab;
      p.x = pt.x; p.z = pt.z; p.y = pt.y; p.my = pt.my;
      const chk = h.canPlace(p.type, p.x, p.z, p.rot, p.seed, null, p.my);
      if (chk.wall) { p.x = chk.x; p.z = chk.z; p.rot = chk.rot; p.my = chk.my; }
      if (chk.wallFit) { p.x = chk.x; p.z = chk.z; p.rot = 0; }
      p.ok = !!chk.ok; p.reason = chk.ok ? '' : chk.reason;
      let geom = p.bare ? null : chk.geom; if (!geom) { try { geom = JT.Geo.build({ id: '_ghost', type: p.type, x: p.x, z: p.z, rot: p.rot, seed: p.seed, bare: p.bare }, chk.baseY || pt.y || 0, h.dims.h); } catch (e) { geom = null; } }
      if (geom) geom.id = '_ghost';
      this.R.ghost = { geom, ok: p.ok, x: p.x, z: p.z }; this.setModeText();
    },
    /** Trees can be placed with or without their leaves. */
    toggleLeaves() { const p = this.place; if (!p || JT.DECOR_BY_ID[p.type].arche !== 'tree') return; p.bare = !p.bare; $('modeLeaves').textContent = p.bare ? 'No leaves' : 'Leaves'; A().sfx('click'); this.updateGhostAtCurrent(); },
    rotatePlace() { const p = this.place; if (!p) return; p.rot = (p.rot + 1) % 4; A().sfx('click'); this.updateGhostAtCurrent(); },
    confirmPlace() {
      const p = this.place; if (!p) return; const h = this.hab; const d = JT.DECOR_BY_ID[p.type];
      if (!p.ok) { this.toast(esc(p.reason || 'Cannot place here.')); A().sfx('error'); this.buzz('error', true); return; }
      this.undoPush('Place ' + d.name);
      const inst = h.addDecor(p.type, p.x, p.z, p.rot, p.seed, true, p.my, { bare: p.bare });
      if (!inst) { this.undoDrop(); this.toast('That spot is no longer free.'); return; }
      A().sfx('place'); this.buzz('place', true);
      this.toast('Placed ' + esc(d.name) + (inst.parent ? ' (stacked)' : '') + '.');
      p.seed = (JT.R() * 1e9) | 0;
      this.updateGhostAtCurrent();
      if (this.isMobile()) { this.cancelMode(); if (this.tab) { $('drawer').classList.remove('hidden'); this.syncDrawerSpace(); } }
    },
    updateGhostAtCurrent() { const p = this.place; if (!p || p.x == null) return; const d = JT.DECOR_BY_ID[p.type];
      // re-check the same spot (wall pieces keep their height on the wall; re-projecting from the floor made them slide down)
      if (d && d.mount) { this.applyGhost({ x: p.x, z: p.z, y: 0, my: p.my }); return; }
      const s = this.R.project([p.x, p.y || 0, p.z]); this.updateGhost(s[0], s[1]); },
    startRemove() {
      this.cancelMode(); this.mode = 'remove'; this.cv.classList.add('removing'); $('modeBar').classList.remove('hidden');
      $('modeRotate').classList.add('hidden'); $('modeLeaves').classList.add('hidden'); $('modeDone').classList.add('hidden');
      $('modeText').innerHTML = '<b>Remove</b> · <span class="hint">tap decor, food or leftovers</span>';
      if (this.tab) { $('drawer').classList.add('hidden'); this.syncDrawerSpace(); } // v11.2: always minimise the build drawer so the tank is clear to tap (any screen size / orientation)
      this.refreshHeader();
    },
    removeAt(sx, sy) {
      const h = this.hab; const hit = this.R.pick(sx, sy, { touch: this.ptrType !== 'mouse' });
      if (!hit) { this.toast('Nothing to remove there.'); return; }
      if (hit.kind === 'spider') { this.showPanel(hit.ent.id); this.toast('Use the jumper card to rehome a jumper.'); return; }
      if (hit.kind === 'prey') { const d = JT.PREY_BY_ID[hit.ent.type]; h.removeEntity(hit.ent, 'player'); A().sfx('remove'); this.buzz('remove', true); this.toast('Released the ' + esc(d.name) + ' outside.'); return; }
      if (hit.kind === 'remains') { h.removeEntity(hit.ent, 'player'); A().sfx('remove'); this.buzz('remove', true); this.toast(hit.ent.cat === 'exuvia' ? 'Collected a shed exoskeleton.' : 'Removed leftovers.'); return; }
      if (hit.kind === 'decor') {
        this.undoPush('Remove ' + JT.DECOR_BY_ID[hit.ent.type].name);
        const removed = h.removeDecor(hit.ent.id);
        A().sfx('remove'); this.buzz('remove', true); this.R.hover = null;
        const nm = JT.DECOR_BY_ID[hit.ent.type].name;
        this.toast('Removed ' + esc(nm) + (removed.length > 1 ? ' and ' + (removed.length - 1) + ' item(s) resting on it' : '') + '.');
      }
    },
    modeDone() { if (this.mode === 'place') this.confirmPlace(); else this.endMode(); },
    /** Leave place/remove mode from its own controls: bring a minimised shop drawer back (mobile). */
    endMode() { this.cancelMode(); if (this.tab && $('drawer').classList.contains('hidden')) { $('drawer').classList.remove('hidden'); this.syncDrawerSpace(); this.openDrawer(this.tab); } },
    // ------------------------------------------------ v11 undo / redo (building in the tank you are viewing)
    _undoSnap(h) { return JSON.stringify({ decor: h.data.decor, sub: h.data.substrate, bg: h.data.bg, ter: h.data.terrain || null }); },
    /** Call right before a build change. Keeps up to 20 steps for the tank being viewed. */
    undoPush(label, h) {
      h = h || this.hab; if (!h) return; const U = this._undo && this._undo.h === h ? this._undo : (this._undo = { h, u: [], r: [] });
      U.u.push({ s: this._undoSnap(h), label: label || 'Change' }); if (U.u.length > 20) U.u.shift(); U.r.length = 0; this.undoSync();
    },
    /** Drop the last pushed step when the change did not happen after all. */
    undoDrop() { const U = this._undo; if (U && U.h === this.hab) { U.u.pop(); this.undoSync(); } },
    undoClear() { this._undo = null; this.undoSync(); },
    undoSync() {
      const U = this._undo && this._undo.h === this.hab ? this._undo : null; const nu = U ? U.u.length : 0, nr = U ? U.r.length : 0;
      const set = (id, on, t) => { const b = $(id); if (!b) return; b.disabled = !on; b.title = t; };
      set('undoBtn', nu, nu ? 'Undo ' + U.u[nu - 1].label.toLowerCase() + ' (Ctrl+Z)' : 'Nothing to undo');
      set('redoBtn', nr, nr ? 'Redo ' + U.r[nr - 1].label.toLowerCase() + ' (Ctrl+Shift+Z)' : 'Nothing to redo');
      set('modeUndo', nu, nu ? 'Undo ' + U.u[nu - 1].label.toLowerCase() + ' (Ctrl+Z)' : 'Nothing to undo');
      const pr = $('drawerUndo'); if (pr) pr.classList.toggle('hidden', this.tab === 'food');
    },
    _undoApply(str) {
      const h = this.hab; const o = JSON.parse(str); const bgCh = o.bg !== h.data.bg;
      h.data.decor = o.decor; h.data.substrate = o.sub; h.data.bg = o.bg; if (o.ter) h.data.terrain = o.ter; // v15: ground shape + seed
      h.rebuild(); h.validateRefs(); this.R._speck = null; this.R.hover = null; if (bgCh) this.R.bgCache = {};
      for (const sp of h.spiders) if (sp.retreat && sp.retreat.d && !h.geoms[sp.retreat.d]) sp.retreat = null;
      if (this.mode === 'place') this.updateGhostAtCurrent();
      if (this.tab && this.tab !== 'food') this.openDrawer(this.tab); this.game.save();
    },
    undo() { this._undoStep('u', 'r', 'Undid'); },
    redo() { this._undoStep('r', 'u', 'Redid'); },
    _undoStep(from, to, verb) {
      const h = this.hab; const U = this._undo && this._undo.h === h ? this._undo : null;
      if (!U || !U[from].length) { this.toast(from === 'u' ? 'Nothing to undo.' : 'Nothing to redo.', 'quiet', 1500); A().sfx('error'); return false; }
      const st = U[from].pop(); U[to].push({ s: this._undoSnap(h), label: st.label });
      this._undoApply(st.s); A().sfx(from === 'u' ? 'remove' : 'place'); this.buzz('place', true);
      this.toast(verb + ': ' + esc(st.label.toLowerCase()) + '.', 'quiet', 1600); this.undoSync(); return true;
    },
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
      if (this.photo) return; // photo mode: drags orbit, taps do nothing
      if (this.obs) { const hit = this.R.pick(sx, sy, { touch: this.ptrType !== 'mouse', noPrey: true }); if (hit && hit.kind === 'spider' && hit.ent.id !== this.obs.sub) { this.obs.lock = hit.ent.id; this.pickSubject(true); A().sfx('click'); } return; }
      if (this.mode === 'place') { if (this.ptrType === 'mouse') { this.updateGhost(sx, sy); this.confirmPlace(); } else this.updateGhost(sx, sy); return; }
      if (this.mode === 'remove') { this.removeAt(sx, sy); return; }
      const hit = this.R.pick(sx, sy, { touch: this.ptrType !== 'mouse' });
      if (hit && hit.kind === 'spider') { this.game.selectedId = hit.ent.id; this.showPanel(hit.ent.id); A().sfx('click'); return; }
      if (this.panelId) this.hidePanel(); // a tap anywhere outside the jumper card closes it
      if (!hit || (hit.kind === 'decor' && hit.ent.type !== 'heatlamp')) this.fingerAt(sx, sy, false, false); // a tap on the glass
      if (hit && hit.kind === 'decor' && hit.ent.type === 'heatlamp') { const on = this.hab.toggleLamp(hit.ent.id); A().sfx('click'); this.toast(on ? 'Lamp on.' : 'Lamp off.', 'quiet', 1600); return; }
      if (hit && hit.kind === 'prey') { const d = JT.PREY_BY_ID[hit.ent.type]; const wk = JT.PreyAI.weakK ? JT.PreyAI.weakK(hit.ent) : 0; this.toast(esc(d.name) + (d.cleaner ? ', part of the cleanup crew' : '') + (hit.ent.state === 'twitch' ? ' — knocked on its back, still groggy from venom.' : wk > 0.05 ? ' — weakened by venom, moving sluggishly.' : '.'), 'quiet'); return; }
      if (hit && hit.kind === 'remains') { this.toast(hit.ent.cat === 'exuvia' ? 'A shed skin. The springtails will find it.' : 'Leftovers. The springtails will tidy them.', 'quiet'); return; }
    },

    // ------------------------------------------------ spider panel
    showPanel(id) { const P = $('spiderPanel'); if (id !== this.panelId || P.classList.contains('hidden')) P.classList.remove('expanded'); this.panelId = id; this.renaming = false; this._panelAt = performance.now(); P.classList.remove('hidden'); this.renderPanel(true); },
    hidePanel() { this.panelId = null; this.renaming = false; const P = $('spiderPanel'); P.classList.add('hidden'); P.classList.remove('expanded'); },
    renderPanel(force) {
      if (this.renaming && !force) return; const P = $('spiderPanel'); const h = this.hab; const sp = h.spider(this.panelId);
      if (!sp) { this.hidePanel(); return; }
      const S = JT.SPECIES_BY_ID[sp.species]; const AI = JT.SpiderAI;
      const need = AI.moltNeed(sp); const molting = ['premolt', 'molting', 'moltSilk', 'moltSeek'].includes(sp.state);
      const desc = AI.descriptors(sp); const pz = AI.personality ? AI.personality(sp) : null;
      const size = (S.len * JT.STAGE_SCALE[sp.stage]).toFixed(1);
      const hl = AI.hungerLabel(sp.sat);
      const moltTxt = sp.stage >= 5 ? 'Fully grown' : molting ? 'Molting now…' : 'Next molt: ' + Math.min(sp.meals, need) + '/' + need + ' meals';
      const follow = !!this.obs;
      const blendDef = AI.blendPiece ? AI.blendPiece(h, sp) : null;
      const line = (AI.stateLine ? AI.stateLine(h, sp) : hl) + (blendDef ? ' · Blending in' : '');
      const pct = (v) => Math.round(M.clamp(v, 0, 1) * 100);
      const meter = (lab, val, v, cls) => '<div class="meter ' + (cls || '') + '"><span class="ml">' + lab + '</span><span class="mv">' + val + '</span><i style="--v:' + pct(v) + '%"></i></div>';
      const html = '<button class="txt x" id="pClose" title="Close" aria-label="Close"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<h3 id="pHead">' + (this.renaming ? '<input id="pName" maxlength="18" value="' + esc(sp.name) + '">' : esc(sp.name)) + '</h3>' +
        '<div class="sci">' + esc(S.name) + ', <i>' + esc(S.sci) + '</i></div>' +
        '<div class="state">' + esc(line) + '</div>' +
        (pz ? '<div class="ctitle">' + esc(pz.title) + ' · ' + pz.traits.map(t => esc(t.label)).join(', ') + '</div>' : '') +
        '<div class="cthought">' + esc(sp.thought || line || '…') + '</div>' +
        '<div class="full">' +
        '<div class="rule"></div>' +
        meter('Hunger', hl, sp.sat, 'sat') + meter('Water', pct(sp.hyd != null ? sp.hyd : 1) + '%', sp.hyd != null ? sp.hyd : 1, 'hyd') + meter('Growth', moltTxt, sp.stage >= 5 ? 1 : Math.min(1, sp.meals / need), 'molt') +
        '<dl class="facts"><dt>Stage</dt><dd>' + JT.STAGES[sp.stage] + (sp.soft > 0 ? ', soft' : '') + '</dd><dt>Age</dt><dd>' + (sp.ageDays || 0).toFixed(1) + ' days</dd><dt>Molts</dt><dd>' + (sp.molts || 0) + '</dd><dt>Catches</dt><dd>' + (sp.catches || 0) + '</dd><dt>Size</dt><dd>' + size + ' mm</dd>' + (blendDef ? '<dt>Camouflage</dt><dd>Blending in with the ' + esc(blendDef.name) + '</dd>' : '') + '</dl>' +
        '<div class="thought">' + esc(sp.thought || '…') + '</div>' +
        (pz ? '<div class="persona"><div class="ptitle">' + esc(pz.title) + '</div><div class="pchips">' + pz.traits.map(t => '<span class="pchip">' + esc(t.label) + '</span>').join('') + (pz.hidden ? '<span class="pchip q" title="Keep watching to discover">?</span>' : '') + '</div>' +
          '<ul class="phab">' + pz.traits.map(t => '<li>' + esc(t.habit) + '</li>').join('') + '</ul>' + ((sp.tame || 0) >= 0.08 ? '<div class="ptame" title="Grows when you visit gently: tap or hold a finger on the glass">' + ((sp.tame >= 0.7) ? 'Knows you well' : sp.tame >= 0.35 ? 'Getting used to you' : 'Starting to notice you') + ' <span class="tbar"><i style="width:' + Math.round(Math.min(1, sp.tame) * 100) + '%"></i></span></div>' : '') + ((sp.diary || []).length ? '<div class="pstory"><b>Story</b>' + sp.diary.slice(-2).reverse().map(e => '<div><span>Day ' + e.d + '</span> ' + esc(e.t) + '</div>').join('') + '</div>' : '') + (pz.hidden ? '<div class="pers">Keep watching ' + esc(sp.name) + ' to discover one more trait.</div>' : '') + '</div>' : '') +
        (desc && desc.length > 2 ? '<div class="pers">Also: ' + desc.slice(2).map(esc).join(', ') + '</div>' : '') +
        '<div class="pbtns"><button class="txt" id="pRename">' + (this.renaming ? 'Save' : 'Rename') + '</button><button class="txt' + (follow ? ' on' : '') + '" id="pFollow">Observe</button><button class="txt" id="pProfile">Profile</button><button class="txt" id="pMove">Move</button><button class="txt" id="pRemove">Rehome</button></div>' +
        '</div>';
      // Refresh in place: rebuilding the panel every 0.3 s replaced buttons mid-tap on touch screens (taps got lost)
      const key = sp.id + '|' + this.renaming + '|' + follow + '|' + h.data.id;
      if (!force && this._pKey === key && P.firstChild) { const t = document.createElement('div'); t.innerHTML = html; if (morphChildren(P, t)) return; }
      this._pKey = key;
      P.innerHTML = html;
      $('pClose').onclick = (e) => { e.stopPropagation(); this.hidePanel(); };
      // tapping the card flips compact <-> expanded (buttons and the name field keep their own taps)
      P.onclick = (e) => { if (this.renaming || (e.target.closest && e.target.closest('button,input,a'))) return; P.classList.toggle('expanded'); A().sfx('click'); };
      $('pRename').onclick = () => {
        if (this.renaming) { const v = ($('pName').value || '').trim().slice(0, 18); if (v) sp.name = v; this.renaming = false; this.game.save(); this.renderPanel(true); this.refreshHeader(); }
        else { this.renaming = true; this.renderPanel(true); const i = $('pName'); i.focus(); i.select(); i.onkeydown = (e) => { if (e.key === 'Enter') $('pRename').click(); if (e.key === 'Escape') { this.renaming = false; this.renderPanel(true); } }; }
      };
      $('pFollow').onclick = () => { this.game.selectedId = sp.id; this.toggleObserve(true, sp.id); };
      $('pMove').onclick = () => { A().sfx('click'); this.moveModal(sp); };
      $('pProfile').onclick = () => { A().sfx('click'); this.profileModal(sp); };
      $('pRemove').onclick = () => {
        if (!root.confirm('Rehome ' + sp.name + ' outside the collection? This cannot be undone.')) return;
        h.removeEntity(sp, 'player'); JT.Photos.delAll(sp.id);
        this.toast(esc(sp.name) + ' was gently rehomed.'); this.hidePanel(); this.game.selectedId = h.spiders[0] ? h.spiders[0].id : null; this.refreshHeader(); this.game.save();
      };
    },

    // ------------------------------------------------ observation mode
    toggleObserve(on, lockId) {
      on = on == null ? !this.obs : on;
      if (on && this.obs) { if (lockId && this.hab.spider(lockId)) { this.obs.lock = lockId; this.pickSubject(true); } return; }
      if (on) {
        if (!this.hab.spiders.length) { this.toast('No jumpers here to observe yet.'); return; }
        this.cancelMode(); this.closeDrawer(); this.closeModal(); this.tipOnce('observe', false, true);
        if (!lockId && this.panelId && this.hab.spider(this.panelId)) lockId = this.panelId; // a jumper's card is open: watch that one
        this.obs = { sub: null, hold: 0, prevCam: this.R.cam.mode, t: 0, lock: lockId && this.hab.spider(lockId) ? lockId : null }; document.body.classList.add('observe'); $('obsHud').classList.remove('hidden');
        this.R.observing = true; this.R.setMode('follow'); this.pickSubject(true);
      } else if (this.obs) {
        if (this.tv) this.tvMode(false, true);
        if (this.photo) this.photoMode(false);
        const prev = this.obs.prevCam; this.obs = null; document.body.classList.remove('observe'); $('obsHud').classList.add('hidden'); this.R.observing = false; this.R.setMode(prev === 'follow' || !this.camModes().includes(prev) ? (this.camModes().includes(this._prevCam) ? this._prevCam : 'iso') : prev);
        document.querySelectorAll('#dock button').forEach(b => b.classList.remove('on'));
      }
      this.refreshHeader();
    },
    pickSubject(force) {
      const o = this.obs; const h = this.hab; if (!h.spiders.length) { this.toggleObserve(false); return; }
      if (o.lock) { if (h.spider(o.lock)) { if (o.sub !== o.lock) { o.sub = o.lock; o.hold = 0; this.game.selectedId = o.lock; } return; } o.lock = null; }
      const cur = h.spider(o.sub); const score = (s) => JT.SpiderAI.interest(s) + (s.target ? 10 : 0) + (s.id === o.sub ? 15 : 0);
      let best = h.spiders[0]; for (const s of h.spiders) if (score(s) > score(best)) best = s;
      if (force || !cur || (best.id !== o.sub && o.hold > 7 && score(best) > score(cur) + 20)) { o.sub = best.id; o.hold = 0; this.game.selectedId = best.id; }
    },
    updateObs(dt) {
      const o = this.obs; o.hold += dt; o.t += dt; if (this.tv) { try { this.tvTick(dt); } catch (e) { console.error('tv', e); this.tvMode(false); } if (!this.obs) return; } if (o.t > 1) { o.t = 0; this.pickSubject(false); }
      const sp = this.hab.spider(o.sub); if (!sp) return;
      const S = JT.SPECIES_BY_ID[sp.species];
      $('obsName').textContent = sp.name + ' · ' + S.name + ' · ' + JT.STAGES[sp.stage];
      $('obsThought').textContent = shortThought(sp.thought);
    },

    // ------------------------------------------------ modals
    /** One sheet at a time. A page opened from another sheet (Menu > Settings) gets a back arrow to it; re-opening the
        same page (a setting changed) keeps that arrow. `opts.sheet` names the top-level sheet for the dock highlight. */
    openModal(title, body, opts) { if (this._tipId) this.hideTip(true);
      opts = opts || {}; const wasOpen = !$('modalWrap').classList.contains('hidden'); const same = wasOpen && $('modalTitle').textContent === title;
      if (opts.back !== undefined) this._modalBack = opts.back; else if (this._nextBack) this._modalBack = this._nextBack; else if (!same) this._modalBack = null;
      this._nextBack = null;
      if (opts.sheet) this._sheet = opts.sheet; else if (!same && !this._modalBack) this._sheet = null; // pages opened from a sheet keep its highlight
      $('modalBack').classList.toggle('hidden', !this._modalBack);
      $('modalTitle').textContent = title; const b = $('modalBody'); const keep = same ? b.scrollTop : 0; b.innerHTML = ''; if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body); $('modalWrap').classList.remove('hidden'); b.scrollTop = opts.keepScroll ? keep : 0;
      if (this.tab && this.isMobile()) this.closeDrawer();
      this.refreshHeader();
    },
    /** Open a page from inside a sheet so it gets a back arrow to `from`. */
    sub(from, open) { this._nextBack = from; open(); },
    closeModal() { const was = !$('modalWrap').classList.contains('hidden'); $('modalWrap').classList.add('hidden'); this._modalBack = null; this._nextBack = null; this._sheet = null; document.querySelectorAll('#dock button').forEach(b => b.classList.remove('on')); if (was) this.refreshHeader(); },
    traitBars(T) { return '<div class="traits">' + [['Stealth', T.stealth], ['Patience', T.patience], ['Jump', T.jump], ['Boldness', T.bold], ['Tactics', T.tactics]].map(([n, v]) => '<span>' + n + '</span><div class="bar"><i style="width:' + Math.round(v * 100) + '%"></i></div>').join('') + '</div>'; },
    collectionModal() { this.jumpersSheet('collection'); },
    journalModal() { this.jumpersSheet('journal'); },
    /** Jumpers sheet: the jumpers in this tank, the collection (add / unlock), and the field journal. */
    jumpersSheet(tab) {
      const h = this.hab; tab = tab || (h.spiders.length ? 'tank' : 'collection'); this._jTab = tab;
      const w = el('div'); const seg = el('div', 'seg sheet-tabs');
      for (const [id, lab] of [['tank', 'In this tank'], ['collection', 'Collection'], ['journal', 'Journal']]) { const b = el('button', id === tab ? 'on' : '', lab); b.onclick = () => { A().sfx('click'); this.jumpersSheet(id); }; seg.appendChild(b); }
      w.appendChild(seg);
      w.appendChild(tab === 'tank' ? this.tankJumpersBody() : tab === 'collection' ? this.collectionBody() : this.journalBody());
      this.openModal(tab === 'journal' ? 'Field Journal' : 'Jumpers', w, { sheet: tab === 'journal' ? 'journal' : 'jumpers', back: null }); this.dockOn('jumpers');
    },
    tankJumpersBody() {
      const g = this.game, h = this.hab, AI = JT.SpiderAI; const w = el('div', 'jlist');
      if (!h.spiders.length) { w.appendChild(el('p', 'muted', 'No jumpers in this tank yet.')); const b = el('button', 'modal-btn gold', 'Add a jumper'); b.onclick = () => this.jumpersSheet('collection'); w.appendChild(b); }
      const pct = (v) => Math.round(M.clamp(v, 0, 1) * 100);
      for (const sp of h.spiders) {
        const S = JT.SPECIES_BY_ID[sp.species]; const r = el('div', 'jrow' + (sp.id === g.selectedId ? ' sel' : ''));
        r.appendChild(cloneCanvas(this.R.speciesPortrait(sp.species, 96)));
        const line = AI.stateLine ? AI.stateLine(h, sp) : AI.hungerLabel(sp.sat); const desc = AI.personality ? AI.personality(sp) : null;
        const tx = el('div', 'jtx', '<div class="jn">' + esc(sp.name) + '</div><div class="js">' + esc(S.name) + ' · ' + JT.STAGES[sp.stage] + '</div><div class="jl">' + esc(line) + '</div>' +
          (desc && desc.title ? '<div class="jp">' + esc(desc.title) + '</div>' : '') +
          '<div class="jm"><span>Hunger</span><i style="--v:' + pct(sp.sat) + '%"></i><span>Water</span><i class="hyd" style="--v:' + pct(sp.hyd != null ? sp.hyd : 1) + '%"></i></div>');
        r.appendChild(tx);
        const bs = el('div', 'jb'); const ob = el('button', 'modal-btn gold', 'Observe'); ob.onclick = (e) => { e.stopPropagation(); this.closeModal(); g.selectedId = sp.id; this.toggleObserve(true, sp.id); };
        const cb = el('button', 'modal-btn', 'Card'); cb.onclick = (e) => { e.stopPropagation(); this.closeModal(); g.selectedId = sp.id; this.showPanel(sp.id); };
        const pb = el('button', 'modal-btn', 'Profile'); pb.onclick = (e) => { e.stopPropagation(); A().sfx('click'); this.sub(() => this.jumpersSheet('tank'), () => this.profileModal(sp)); };
        bs.appendChild(ob); bs.appendChild(pb); bs.appendChild(cb); r.appendChild(bs); r.onclick = () => cb.onclick({ stopPropagation() {} });
        w.appendChild(r);
      }
      const others = []; g.habs.forEach((hb, i) => { if (hb !== h) hb.spiders.forEach(x => others.push([x, hb, i])); });
      if (others.length) { w.appendChild(el('h4', '', 'In your other tanks')); const row = el('div', 'sheet-list');
        for (const [x, hb, i] of others) { const b = el('button', '', esc(x.name) + '<small class="muted">' + esc(JT.SPECIES_BY_ID[x.species].name) + ' · ' + esc(hb.title) + '</small>'); b.onclick = () => { this.closeModal(); this.switchHab(i); g.selectedId = x.id; this.showPanel(x.id); }; row.appendChild(b); }
        w.appendChild(row); }
      if (h.spiders.length && h.spiders.length < h.dims.cap) { const b = el('button', 'modal-btn', 'Add another jumper…'); b.onclick = () => this.jumpersSheet('collection'); w.appendChild(b); }
      return w;
    },
    collectionBody() {
      const g = this.game, h = this.hab, st = g.state; const wrap = el('div');
      const mine = []; g.habs.forEach((hb, i) => hb.spiders.forEach(s => mine.push([s, hb, i]))); for (const s of st.cup || []) mine.push([s, null, -1]);
      wrap.appendChild(el('p', 'muted', 'Adding to <b>' + esc(h.title) + '</b> · ' + h.spiders.length + '/' + h.dims.cap + ' jumpers (' + JT.HABITATS[h.data.type].name + '), up to ' + JT.PER_SPECIES + ' of each species. Raise a jumper to Adult to unlock the next. Total catches: ' + st.catches + '.'));
      if (mine.length) {
        const row = el('div', 'form-row'); row.appendChild(el('label', '', 'Your jumpers'));
        for (const [s, hb, i] of mine) { const b = el('button', 'modal-btn', esc(s.name) + ' <span class="muted" style="color:#c8b48a">(' + (hb ? esc(hb.title) : 'holding cup') + ')</span>'); b.onclick = () => { if (!hb) { this.tanksModal(); return; } this.closeModal(); if (i !== st.active) this.switchHab(i); g.selectedId = s.id; this.showPanel(s.id); }; row.appendChild(b); }
        wrap.appendChild(row);
      }
      const grid = el('div', 'grid'); const best = st.best || {};
      for (const id of JT.UNLOCK_ORDER.concat(JT.CATCH_UNLOCKS, JT.SPECIAL_UNLOCKS || [])) {
        const S = JT.SPECIES_BY_ID[id]; const unlocked = g.isUnlocked(S.id); const chk = g.canAdd(h, S.id);
        const e = el('div', 'entry' + (unlocked ? '' : ' locked'));
        const mystery = S.hybrid && !unlocked; const pc = cloneCanvas(this.R.speciesPortrait(S.id, 150));
        if (mystery) { const x = pc.getContext('2d'); x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgba(38,28,20,0.82)'; x.fillRect(0, 0, pc.width, pc.height); pc.classList.add('mystery'); }
        e.appendChild(pc); if (S.hybrid) e.classList.add('hybrid');
        const owned = mine.filter(m => m[0].species === S.id).length; const par = S.hybrid ? S.unlock.parents.map(pid => JT.SPECIES_BY_ID[pid]) : null;
        if (mystery) e.insertAdjacentHTML('beforeend', '<span class="badge">Hybrid ?</span><h4>Mystery hybrid</h4><div class="sci">' + par.map(P => esc(P.name)).join(' \u00d7 ') + '</div><p>Something new may appear when both of these species grow up in your care.</p><p class="muted">' + par.map(P => esc(P.name) + ': ' + (best[P.id] >= 5 ? 'Adult \u2713' : best[P.id] != null ? JT.STAGES[best[P.id]] : 'not raised yet')).join(' \u00b7 ') + '</p>');
        else e.insertAdjacentHTML('beforeend', (owned ? '<span class="badge">Owned ×' + owned + '</span>' : !unlocked ? '<span class="badge">Locked</span>' : S.hybrid ? '<span class="badge">Hybrid</span>' : '') + '<h4>' + esc(S.name) + '</h4><div class="sci"><i>' + esc(S.sci) + '</i> · ~' + S.len + ' mm adult' + (par ? '<br>' + par.map(P => esc(P.name)).join(' \u00d7 ') : '') + '</div><p>' + esc(S.desc) + '</p>' + this.traitBars(S.traits));
        const b = el('button', 'modal-btn gold');
        if (!unlocked) {
          if (S.unlock && S.unlock.parents) b.textContent = 'Raise both parents to Adult (' + S.unlock.parents.filter(pid => best[pid] >= 5).length + '/2)';
          else if (S.unlock) { const u = S.unlock; b.textContent = u.journal ? 'Witness ' + u.journal + ' journal behaviours (' + Math.min(JT.JOURNAL.filter(j => st.journal[j.id]).length, u.journal) + '/' + u.journal + ')' : 'Befriend a jumper: visit it gently at the glass until it knows you'; }
          else if (S.unlockCatches) b.textContent = 'Unlocks after ' + S.unlockCatches + ' catches (' + Math.min(st.catches, S.unlockCatches) + '/' + S.unlockCatches + ')';
          else { const prev = JT.SPECIES_BY_ID[JT.unlockPrev(S.id)]; const bs = best[prev.id]; b.textContent = 'Raise a ' + prev.name + ' to Adult (' + (bs != null ? 'best: ' + JT.STAGES[bs] : 'not raised yet') + ')'; }
          b.disabled = true;
        }
        else if (!chk.ok) { b.textContent = chk.reason; b.disabled = true; }
        else b.textContent = 'Add as a Sling';
        b.onclick = () => {
          if (!g.canAdd(h, S.id).ok) return;
          const sp = h.addSpider(S.id, { stage: 1 });
          g.checkUnlocks(true); g.selectedId = sp.id; this.closeModal(); this.showPanel(sp.id); this.refreshHeader(); A().sfx('hatch'); this.buzz('place', true);
          this.toast('Welcome, ' + esc(sp.name) + ' the ' + esc(S.name) + '!'); g.save();
        };
        e.appendChild(b); grid.appendChild(e);
      }
      wrap.appendChild(grid); return wrap;
    },
    journalBody(sub) {
      sub = sub || this._jSub || 'seen'; this._jSub = sub;
      const g = this.game, st = g.state, jm = st.jmeta || {}; const w = el('div', 'jrnl');
      const n = JT.JOURNAL.filter(j => st.journal[j.id]).length, N = JT.JOURNAL.length;
      const seg = el('div', 'seg small jsub'); for (const [id, lab] of [['seen', 'Behaviours'], ['stories', 'Life stories']]) { const b = el('button', id === sub ? 'on' : '', lab); b.onclick = () => { A().sfx('click'); this._jSub = id; this.jumpersSheet('journal'); }; seg.appendChild(b); } w.appendChild(seg);
      if (sub === 'stories') { w.appendChild(this.storiesBody()); return w; }
      w.appendChild(el('div', 'jprog', '<div class="jpt"><b>' + n + '</b> of ' + N + ' behaviours witnessed</div><span class="tbar"><i style="width:' + Math.round(n / N * 100) + '%"></i></span><p class="muted">Only what you actually see happen in the tank you are watching is recorded.</p>'));
      const META = JT.JOURNAL_META || {};
      for (const [cid, cname] of JT.JOURNAL_CATS || [['all', 'Behaviours']]) {
        const list = JT.JOURNAL.filter(j => ((META[j.id] || [])[0] || 'life') === cid || cid === 'all'); if (!list.length) continue;
        const got = list.filter(j => st.journal[j.id]).length;
        let html = '<h4 class="jcat">' + esc(cname) + ' <span class="muted">' + got + '/' + list.length + '</span></h4>' + (cid === 'hybrid' ? '<p class="muted jnote">Hybrids appear on their own once both parent species have been raised to Adult in your care.</p>' : '') + '<div class="grid">';
        for (const j of list) { const c = st.journal[j.id], m = jm[j.id]; let hint = (META[j.id] || [])[1];
          if (j.hyb && !st.species.includes(j.hyb)) { const HS = JT.SPECIES_BY_ID[j.hyb]; hint = 'A mystery hybrid: raise ' + HS.unlock.parents.map(pid => (/^[AEIOU]/.test(JT.SPECIES_BY_ID[pid].name) ? 'an ' : 'a ') + JT.SPECIES_BY_ID[pid].name).join(' and ') + ' to Adult.'; }
          html += c ? '<div class="entry"><span class="badge">' + c + '×</span><h4>' + esc(j.title) + '</h4><p>' + esc(j.text) + '</p>' + (m ? '<p class="jfirst">First seen day ' + m.d + (m.n ? ' · ' + esc(m.n) + (JT.SPECIES_BY_ID[m.s] ? ' (' + esc(JT.SPECIES_BY_ID[m.s].name) + ')' : '') : '') + '</p>' : '') + '</div>'
            : '<div class="entry locked"><h4>Not yet witnessed</h4><p class="muted">' + esc(hint ? 'Hint: ' + hint : 'Keep watching your jumpers.') + '</p></div>'; }
        const d = el('div', 'jsec'); d.innerHTML = html + '</div>'; w.appendChild(d);
      }
      return w;
    },
    /** Every jumper's life story (this tank first), newest moments at the top. */
    storiesBody() {
      const g = this.game, AI = JT.SpiderAI; const w = el('div', 'stories'); const habs = [g.hab].concat(g.habs.filter(h => h !== g.hab)); let any = false;
      for (const h of habs) for (const sp of h.spiders) { any = true;
        const S = JT.SPECIES_BY_ID[sp.species] || { name: sp.species }; const pz = AI.personality ? AI.personality(sp) : null; const D = (sp.diary || []).slice().reverse();
        const card = el('div', 'story'); card.appendChild(cloneCanvas(this.R.speciesPortrait(sp.species, 96)));
        const open = this._storyOpen === sp.id; const shown = open ? D : D.slice(0, 4);
        const tx = el('div', 'stx', '<div class="jn">' + esc(sp.name) + '</div><div class="js">' + esc(S.name) + ' · ' + JT.STAGES[sp.stage] + (h !== g.hab ? ' · ' + esc(h.title) : '') + (pz && pz.title ? ' · <i>' + esc(pz.title) + '</i>' : '') + '</div>' +
          '<ul class="diary">' + (shown.length ? shown.map(e => '<li><span class="dd">Day ' + e.d + '</span>' + esc(e.t) + '</li>').join('') : '<li class="muted">No moments recorded yet. Its story starts now.</li>') + '</ul>');
        if (D.length > 4) { const b = el('button', 'linkbtn', open ? 'Show less' : 'Show all ' + D.length + ' moments'); b.onclick = () => { this._storyOpen = open ? null : sp.id; this.jumpersSheet('journal'); }; tx.appendChild(b); }
        { const b = el('button', 'linkbtn', 'Open profile'); b.onclick = () => { A().sfx('click'); this.sub(() => this.jumpersSheet('journal'), () => this.profileModal(sp)); }; tx.appendChild(b); }
        card.appendChild(tx); w.appendChild(card); }
      if (!any) w.appendChild(el('p', 'muted', 'No jumpers yet. Add one from the Collection and its story begins.'));
      return w;
    },
    /** v11: a jumper's own page: portrait, growth, personality, hunting record, journal moments, life story and photos. */
    profileModal(sp, back) {
      const g = this.game, AI = JT.SpiderAI; if (!sp) return; const S = JT.SPECIES_BY_ID[sp.species]; if (!S) return;
      const home = g.habs.find(h => h.spiders.includes(sp)) || null; const inCup = !home && (g.state.cup || []).includes(sp);
      const w = el('div', 'prof'); const pz = AI.personality ? AI.personality(sp) : null; const st = sp.stats || {};
      this._profId = sp.id; const myBack = back || this._nextBack || null; this._nextBack = null; this._profBack = myBack;
      // header: portrait (or the newest photo) + the essentials
      const hd = el('div', 'pf-head'); const pic = el('div', 'pf-pic'); pic.appendChild(cloneCanvas(this.R.speciesPortrait(sp.species, 192))); hd.appendChild(pic);
      const size = (S.len * JT.STAGE_SCALE[sp.stage]).toFixed(1);
      hd.appendChild(el('div', 'pf-id', '<div class="pf-sci">' + esc(S.name) + ', <i>' + esc(S.sci) + '</i></div>' +
        '<div class="pf-st">' + JT.STAGES[sp.stage] + ' \u00b7 ' + (sp.ageDays || 0).toFixed(1) + ' days old \u00b7 ' + size + ' mm</div>' +
        '<div class="pf-home">' + (home ? 'Lives in <b>' + esc(home.title) + '</b> (' + esc(home.dims.name) + ')' : inCup ? 'Waiting in the holding cup' : '') + '</div>' +
        (pz ? '<div class="pf-title">' + esc(pz.title) + '</div>' : '')));
      w.appendChild(hd);
      const sec = (t) => { const e = el('div', 'pf-sec'); e.appendChild(el('h4', '', t)); w.appendChild(e); return e; };
      // growth timeline
      const D = sp.diary || []; const at = Object.assign({}, sp.stageAt || {});
      if (at[sp.stage] == null) { for (const e of D) { const m = /^Molted into a (.+)\.$/.exec(e.t); if (m) { const k = JT.STAGES.findIndex(x => x.toLowerCase() === m[1]); if (k >= 0 && at[k] == null) at[k] = e.d; } else if (/^Final molt/.test(e.t) && at[5] == null) at[5] = e.d; } }
      const born = D.length ? D[0].d : null; const gs = sec('Growth');
      const tl = el('div', 'pf-tl'); const st0 = Object.keys(at).length ? Math.min(...Object.keys(at).map(Number)) - 1 : sp.stage;
      JT.STAGES.forEach((nm, k) => { const done = k <= sp.stage; const d = at[k] != null ? at[k] : (k === Math.max(0, Math.min(st0, sp.stage)) && born != null ? born : null);
        tl.appendChild(el('div', 'pf-step' + (done ? ' done' : '') + (k === sp.stage ? ' cur' : ''), '<i></i><span>' + esc(nm) + '</span><small>' + (done ? (d != null ? 'Day ' + d : '\u2014') : k === sp.stage + 1 && sp.stage < 5 ? Math.min(sp.meals, AI.moltNeed(sp)) + '/' + AI.moltNeed(sp) + ' meals' : '') + '</small>')); });
      gs.appendChild(tl); gs.appendChild(el('p', 'muted', (sp.molts || 0) + ' molt' + ((sp.molts || 0) === 1 ? '' : 's') + (sp.stage >= 5 ? ' \u00b7 fully grown' + (sp.adultDays ? ' for ' + sp.adultDays.toFixed(1) + ' days' : '') : '')));
      // personality
      if (pz) { const ps = sec('Personality');
        ps.appendChild(el('div', 'pchips', pz.traits.map(t => '<span class="pchip">' + esc(t.label) + '</span>').join('') + (pz.hidden ? '<span class="pchip q" title="Keep watching to discover">?</span>' : '')));
        ps.appendChild(el('ul', 'phab', pz.traits.map(t => '<li>' + esc(t.habit) + '</li>').join('')));
        const tm = sp.tame || 0; ps.appendChild(el('div', 'pf-trust', '<span>Trust</span><span class="tbar"><i style="width:' + Math.round(Math.min(1, tm) * 100) + '%"></i></span><b>' + (tm >= 0.7 ? 'Knows you well' : tm >= 0.35 ? 'Getting used to you' : tm >= 0.08 ? 'Starting to notice you' : 'A stranger still') + '</b>'));
      }
      // hunting record
      const hs = sec('Hunting'); const pn = sp.preyN || {}; const c = Math.max(sp.catches || 0, Object.values(pn).reduce((a, b) => a + b, 0)), ms = st.misses || 0; const fav = Object.keys(pn).sort((a, b) => pn[b] - pn[a])[0];
      const pname = (id) => { const d = JT.PREY_BY_ID[id]; return d ? d.name : id; };
      const big = sp.bigPrey && JT.PREY_BY_ID[sp.bigPrey.t];
      hs.appendChild(el('dl', 'facts pf-facts', '<dt>Catches</dt><dd>' + c + '</dd><dt>Success</dt><dd>' + (c + ms ? Math.round(c / (c + ms) * 100) + '% of ' + (c + ms) + ' pounces' : '\u2014') + '</dd><dt>Stalks</dt><dd>' + (st.hunts || 0) + '</dd>' +
        '<dt>Favourite prey</dt><dd>' + (fav ? esc(pname(fav)) + ' \u00d7' + pn[fav] : '\u2014') + '</dd><dt>Biggest catch</dt><dd>' + (big ? esc(big.name) + (sp.bigPrey.r > 1 ? ' (' + sp.bigPrey.r.toFixed(1) + '\u00d7 its size)' : '') : '\u2014') + '</dd>' +
        '<dt>Displays</dt><dd>' + (st.displays || 0) + '</dd>'));
      // journal moments
      const js = sp.jseen || {}; const seen = JT.JOURNAL.filter(j => js[j.id] != null).sort((a, b) => js[a.id] - js[b.id]); const jsct = sec('Journal moments \u00b7 ' + seen.length);
      jsct.appendChild(seen.length ? el('div', 'pf-moments', seen.map(j => '<span class="pf-m" title="' + esc(j.text) + '">' + esc(j.title) + '<small>Day ' + js[j.id] + '</small></span>').join('')) : el('p', 'muted', 'Watch it hunt, rest and explore and the moments you witness appear here.'));
      // photos (filled in from the device store)
      const ph = sec('Photos'); const gal = el('div', 'pf-gal'); ph.appendChild(gal); this.fillGallery(sp, gal, pic);
      // life story
      const ls = sec('Life story'); const R = D.slice().reverse(); const open = this._profAll === sp.id; const shown = open ? R : R.slice(0, 8);
      ls.appendChild(el('ul', 'diary', shown.length ? shown.map(e => '<li><span class="dd">Day ' + e.d + '</span>' + esc(e.t) + '</li>').join('') : '<li class="muted">No moments recorded yet. Its story starts now.</li>'));
      const again = () => this.profileModal(sp, myBack);
      if (R.length > 8) { const b = el('button', 'linkbtn', open ? 'Show less' : 'Show all ' + R.length + ' moments'); b.onclick = () => { this._profAll = open ? null : sp.id; again(); }; ls.appendChild(b); }
      // actions
      const bt = el('div', 'form-row pf-btns');
      const add = (lab, cls, fn) => { const b = el('button', 'modal-btn ' + (cls || ''), lab); b.onclick = () => { A().sfx('click'); fn(); }; bt.appendChild(b); return b; };
      if (home) add('Observe', 'gold', () => { this.closeModal(); const i = g.habs.indexOf(home); if (i !== g.state.active) this.switchHab(i); g.selectedId = sp.id; this.toggleObserve(true, sp.id); });
      if (home && this.photoMode) add('Take a photo', '', () => { this.closeModal(); const i = g.habs.indexOf(home); if (i !== g.state.active) this.switchHab(i); g.selectedId = sp.id; this.toggleObserve(true, sp.id); setTimeout(() => this.photoMode(true), 900); });
      add('Rename', '', () => { const n = root.prompt('New name for ' + sp.name + ':', sp.name); const v = (n || '').trim().slice(0, 18); if (!v) return; sp.name = v; g.save(); this.refreshHeader(); if (this.panelId === sp.id) this.renderPanel(true); again(); });
      if (home) add('Move', '', () => { this.sub(again, () => this.moveModal(sp)); });
      else if (inCup) add('Place in this tank', '', () => { const r = g.moveSpider(sp, 'cup', g.hab); if (!r.ok) { this.toast(esc(r.reason)); A().sfx('error'); return; } this.refreshHeader(); g.save(); this.toast(esc(sp.name) + ' moved into this tank.'); again(); });
      w.appendChild(bt);
      this.openModal(sp.name, w, { back: myBack });
    },
    /** Fill a profile's photo strip from the device store; the newest photo becomes the portrait. */
    fillGallery(sp, gal, pic) {
      (this._phUrls || []).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { void e; } }); this._phUrls = [];
      gal.classList.add('empty'); gal.appendChild(el('p', 'muted', 'Loading\u2026'));
      JT.Photos.list(sp.id).then((arr) => {
        if (!gal.isConnected) return; gal.innerHTML = '';
        if (!arr.length) { gal.appendChild(el('p', 'muted', 'No photos yet. While observing ' + esc(sp.name) + ', tap the camera to take one. Photos stay inside the game on this device.')); return; }
        gal.classList.remove('empty');
        arr.forEach((rec, k) => { const url = rec.blob ? URL.createObjectURL(rec.blob) : rec.url; if (rec.blob) this._phUrls.push(url);
          const d = el('div', 'pf-ph'); const im = new Image(); im.alt = sp.name + ', day ' + rec.day; im.src = url; d.appendChild(im); d.appendChild(el('small', '', 'Day ' + rec.day));
          const x = el('button', '', '\u00d7'); x.title = 'Delete photo'; x.setAttribute('aria-label', 'Delete photo');
          x.onclick = (e) => { e.stopPropagation(); if (!root.confirm('Delete this photo of ' + sp.name + '?')) return; JT.Photos.del(rec.id).then(() => { A().sfx('remove'); this.profileModal(sp, this._profBack); }); };
          d.appendChild(x); d.onclick = () => { A().sfx('click'); this.photoView(sp, rec, url); }; gal.appendChild(d);
          if (k === 0 && pic) { const pi = new Image(); pi.alt = sp.name; pi.src = url; pic.innerHTML = ''; pic.appendChild(pi); } });
        if (JT.Photos.persistent === false || arr.some(r => !r.blob && !r.url)) gal.appendChild(el('p', 'muted', 'This browser cannot keep photos, so they disappear when the game closes.'));
      });
    },
    photoView(sp, rec, url) {
      const w = el('div', 'phview'); const im = new Image(); im.src = url; im.alt = sp.name; w.appendChild(im);
      const F = PHOTO_FILTERS.find(f => f[0] === rec.f); w.appendChild(el('p', 'muted', 'Day ' + rec.day + (F && rec.f !== 'natural' ? ' \u00b7 ' + F[1] : '') + ' \u00b7 ' + JT.STAGES[rec.stage != null ? rec.stage : sp.stage] + (rec.w ? ' \u00b7 ' + rec.w + '\u00d7' + rec.h : '')));
      const r = el('div', 'form-row'); const del = el('button', 'modal-btn danger', 'Delete photo'); del.onclick = () => { if (!root.confirm('Delete this photo of ' + sp.name + '?')) return; JT.Photos.del(rec.id).then(() => { A().sfx('remove'); this.profileModal(sp, this._profBack); }); };
      r.appendChild(del); w.appendChild(r);
      const pb = this._profBack; this.openModal(sp.name + ' \u00b7 photo', w, { back: () => this.profileModal(sp, pb) });
    },
    /** v11 photo mode: time stops, the interface steps aside, filters preview live; photos go to the jumper's profile. */
    // ------------------------------------------------ v18 unlock reveal
    /** The species' own colour for the glow: its most vivid palette colour, lifted a little. */
    speciesTint(S) {
      let best = null, bs = -1; const P = S.pal || {};
      for (const k of ['chel', 'mark', 'abd', 'ceph', 'leg', 'hair']) { const h = P[k]; if (typeof h !== 'string' || h[0] !== '#') continue; let x = h.slice(1); if (x.length === 3) x = x.split('').map(q => q + q).join(''); const n = parseInt(x, 16); if (x.length !== 6 || !isFinite(n)) continue; const c = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
        const mx = Math.max(...c), mn = Math.min(...c); const sc = (mx - mn) * (k === 'chel' || k === 'mark' ? 1.1 : 1); if (sc > bs) { bs = sc; best = c; } }
      // keep the colour's hue, make it glow: rich, mid-bright (blacks, whites and greys get warm gold)
      let hue = 40, sat = 0.78; if (best && bs >= 0.14) { const [r, g, b] = best; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        hue = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); if (hue < 0) hue += 360; sat = 0.88; }
      const hsl = (a, l) => 'hsla(' + Math.round(hue) + ',' + Math.round(sat * 100) + '%,' + l + '%,' + a + ')'; return { solid: hsl(1, 64), a: hsl(0.6, 58), b: hsl(0.22, 52), hue: Math.round(hue) };
    },
    /** Show the next queued unlock, unless something that should not be interrupted is on (a replay, photo mode, TV, the start screen). */
    unlockPump() {
      const busy = (JT.Replay && JT.Replay.active) || this.photo || this.tv || (document.getElementById('splash') && !document.getElementById('splash').classList.contains('gone')) || this.game.state.biomeSetup;
      if (busy || performance.now() < (this._ufNext || 0)) return; const it = this._unlockQ.shift(); if (it) this.unlockFx(it.S, it.why);
    },
    unlockFx(S, why) {
      const old = $('adultFx'); if (old) old.remove();
      const tint = this.speciesTint(S); const hybrid = !!S.hybrid; const rm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const w = el('div', rm ? 'rm' : ''); w.id = 'unlockFx'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'New jumper unlocked: ' + S.name);
      w.style.setProperty('--uf', tint.solid); w.style.setProperty('--ufA', tint.a); w.style.setProperty('--ufB', tint.b);
      const st = el('div', 'uf-stage'); w.appendChild(st);
      st.appendChild(el('div', 'uf-kick', hybrid ? 'A hybrid has appeared' : 'New jumper unlocked'));
      const art = el('div', 'uf-art'); st.appendChild(art); art.appendChild(el('div', 'uf-rays')); art.appendChild(el('div', 'uf-glow'));
      const N = 360; let col = null; try { col = cloneCanvas(this.R.speciesPortrait(S.id, N)); } catch (e) { col = document.createElement('canvas'); col.width = col.height = N; }
      const sil = document.createElement('canvas'); sil.width = col.width; sil.height = col.height; { const g = sil.getContext('2d'); g.drawImage(col, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0b0805'; g.fillRect(0, 0, sil.width, sil.height); }
      sil.className = 'uf-sil'; col.className = 'uf-col'; art.appendChild(sil); art.appendChild(col);
      if (hybrid) art.appendChild(el('div', 'uf-q', '?'));
      { const sw = el('div', 'uf-sweep'); try { const u = 'url(' + col.toDataURL() + ')'; const mk = el('div', 'uf-shine'); mk.style.webkitMaskImage = u; mk.style.maskImage = u; mk.appendChild(sw); art.appendChild(mk); } catch (e) { /* no shine */ } }
      const dots = el('div', 'uf-dots'); for (let i = 0; i < 18; i++) { const d = el('i'); const a = (i / 18) * 6.283 + Math.random() * 0.3, r = 110 + Math.random() * 90; d.style.setProperty('--dx', Math.round(Math.cos(a) * r) + 'px'); d.style.setProperty('--dy', Math.round(Math.sin(a) * r) + 'px'); d.style.animationDelay = (Math.random() * 0.25).toFixed(2) + 's'; dots.appendChild(d); } art.appendChild(dots);
      st.appendChild(el('div', 'uf-name', esc(S.name))); if (S.sci) st.appendChild(el('div', 'uf-sci', esc(S.sci)));
      st.appendChild(el('div', 'uf-why', esc(why)));
      const btns = el('div', 'uf-btns'); const add = el('button', 'uf-add', 'Add to a tank'); const later = el('button', 'uf-later', 'Later'); btns.appendChild(add); btns.appendChild(later); st.appendChild(btns);
      st.appendChild(el('div', 'uf-hint', 'Tap anywhere to continue'));
      add.onclick = (e) => { e.stopPropagation(); this.unlockClose(true); }; later.onclick = (e) => { e.stopPropagation(); this.unlockClose(false); };
      w.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.uf-btns')) return; if (w.classList.contains('ready')) this.unlockClose(false); });
      document.body.appendChild(w); this._ufEl = w; this._ufS = S; A().sfx('journal');
      const hold = rm ? 300 : hybrid ? 2100 : 1300; // the silhouette holds a moment (longer for a hybrid's "?")
      requestAnimationFrame(() => requestAnimationFrame(() => { // timers start once the overlay is really on screen, so a slow frame can't eat the silhouette beat
        if (this._ufEl !== w) return; w.classList.add('in');
        if (w.classList.contains('rev')) return; // already revealed by an early press (it set its own ready timer)
        this._ufT1 = setTimeout(() => { if (this._ufEl !== w || w.classList.contains('rev')) return; w.classList.add('rev'); A().sfx('unlock'); this.buzz('unlock'); }, hold);
        this._ufT2 = setTimeout(() => { if (this._ufEl === w) w.classList.add('ready'); }, hold + 1800); // a stray tap during the reveal can't skip it
      }));
    },
    unlockClose(addNow) {
      const w = this._ufEl; if (!w) return; const S = this._ufS; clearTimeout(this._ufT1); clearTimeout(this._ufT2);
      if (!w.classList.contains('rev')) { w.classList.add('rev'); A().sfx('unlock'); this._ufT2 = setTimeout(() => { if (this._ufEl === w) w.classList.add('ready'); }, 900); if (!addNow) return; } // first press while still dark: show it
      this._ufEl = null; this._ufS = null; A().sfx('click'); w.classList.add('out'); setTimeout(() => w.remove(), 400); this._ufNext = performance.now() + 700;
      if (addNow && S) { if (this.obs) this.toggleObserve(false); this.jumpersSheet('collection');
        setTimeout(() => { const e = document.querySelector('#modalBody .entry[data-species="' + S.id + '"]') || document.querySelector('#modalBody [data-bm-species="' + S.id + '"]') || [...document.querySelectorAll('#modalBody .entry, #modalBody .bm-row, #modalBody [class*="row"], #modalBody .card')].filter(x => (x.textContent || '').includes(S.name)).sort((a, b) => a.textContent.length - b.textContent.length)[0]; if (e) { e.scrollIntoView({ block: 'center', behavior: 'smooth' }); e.classList.add('uf-flash'); setTimeout(() => e.classList.remove('uf-flash'), 2400); } }, 60); }
      else this.tipOnce('unlock');
    },
    /** A jumper reached adulthood: a short glowing banner with its portrait (no tap needed). */
    adultFx(sp) {
      if ((JT.Replay && JT.Replay.active) || this.photo) { this.toast(esc(sp.name) + ' molted — now an Adult.', '', 3500); return; }
      setTimeout(() => {
        if (this._ufEl || (this._unlockQ && this._unlockQ.length)) { this.toast(esc(sp.name) + ' is now an Adult.', '', 3500); return; } // an unlock is about to take the stage
        const S = JT.SPECIES_BY_ID[sp.species]; if (!S) return; const old = $('adultFx'); if (old) old.remove(); const t = this.speciesTint(S);
        const w = el('div'); w.id = 'adultFx'; w.style.setProperty('--uf', t.solid); w.style.setProperty('--ufA', t.a); w.setAttribute('role', 'status');
        try { w.appendChild(cloneCanvas(this.R.speciesPortrait(S.id, 116))); } catch (e) { /* no picture */ }
        const tx = el('div'); tx.appendChild(el('b', '', esc(sp.name) + ' is all grown up')); tx.appendChild(el('span', '', 'Now an Adult ' + esc(S.name))); w.appendChild(tx);
        document.body.appendChild(w); requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('in')));
        setTimeout(() => { w.classList.remove('in'); setTimeout(() => w.remove(), 600); }, 4200); }, 650);
    },
    // ------------------------------------------------ v17 Ambient TV
    /** Hands-free watching on top of Observe: the controls fade out and a director picks who to watch and how
        (close, wide, slow orbit, plain follow), holding a hunt or a molt to its end. Any tap or key brings everything back. */
    tvMode(on, fromObs) {
      on = on == null ? !this.tv : on;
      if (on) {
        if (this.tv) return; if (!this.hab.spiders.length) { this.toast('No jumpers here to watch yet.'); return; }
        if (this.photo) this.photoMode(false); this.cancelMode(); this.closeDrawer(); this.closeModal(); this.hidePanel && this.hidePanel();
        if (!this.obs) this.toggleObserve(true); if (!this.obs) return;
        this.tv = { t: 0, shotT: 0, dur: 0, sub: null, style: null, prevStyle: null, recent: [], prevLock: this.obs.lock, zoom: 1, ph: Math.random() * 6.28, cut: 0, ext: 0 };
        document.body.classList.add('tv'); const app = $('app');
        const c = document.createElement('div'); c.id = 'tvCatch'; c.setAttribute('aria-label', 'Tap to show the controls');
        const out = (e) => { e.preventDefault(); e.stopPropagation(); if (this.tv) this.tvMode(false); };
        c.addEventListener('pointerdown', out); c.addEventListener('wheel', out, { passive: false }); c.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
        c.addEventListener('touchstart', (e) => { e.preventDefault(); if (this.tv) this.tvMode(false); }, { passive: false });
        app.appendChild(c); this.tvShot(true);
      } else if (this.tv) {
        const T = this.tv; this.tv = null; document.body.classList.remove('tv'); $('tvVeil').classList.remove('on');
        const c = $('tvCatch'); if (c) setTimeout(() => c.remove(), 450); // keep swallowing the rest of the tap that ended it
        const fc = this.R.fcam; if (fc) { fc.tvYaw = 0; fc.tvPitch = 0; fc.userZoom = 1; }
        if (this.obs && !fromObs) this.obs.lock = T.prevLock && this.hab.spider(T.prevLock) ? T.prevLock : null;
        this.refreshHeader();
      }
    },
    /** Something worth holding the shot for (or cutting to). */
    tvHot(s) { const AI = JT.SpiderAI; return AI.HUNT.has(s.state) || /^(pounce|subdue|secure|feed|molting|premolt|moltSilk|display|semaphore|lunge|carry|fall|dangle|flee|sip|nectarSeek)$/.test(s.state); },
    /** Two jumpers close together: a meeting. */
    tvMeet(s) { const AI = JT.SpiderAI; return this.hab.spiders.some(o => o !== s && M.dist(o.pos, s.pos) < 3 * (AI.len(o) + AI.len(s))); },
    tvShot(first) {
      const T = this.tv, h = this.hab, AI = JT.SpiderAI, o = this.obs; if (!T || !o || !h.spiders.length) return;
      const many = h.spiders.length > 1;
      const score = (s) => AI.interest(s) + (s.target ? 10 : 0) + (this.tvHot(s) ? 25 : 0) + (this.tvMeet(s) ? 20 : 0) - (many && s.id === T.sub ? 30 : 0) - (many && T.recent.includes(s.id) ? 10 : 0) + Math.random() * 14;
      let best = h.spiders[0], bs = -1e9; for (const s of h.spiders) { const v = score(s); if (v > bs) { bs = v; best = s; } }
      const prev = h.spider(T.sub); const far = !prev || prev.id !== best.id && M.dist(prev.pos, best.pos) > 0.35 * Math.max(h.dims.w, h.dims.d);
      // the shot: hunts get the plain observe camera (it already frames jumper and prey); calm moments get close-ups and slow orbits
      const calm = /^(rest|sleep|bask|groom|feed|molting|premolt|postMolt|idle|watch|cleanEyes|stretch)$/.test(best.state);
      let pool = AI.HUNT.has(best.state) || /^(pounce|subdue|secure)$/.test(best.state) ? ['follow'] : calm ? ['close', 'orbit', 'close', 'wide'] : ['follow', 'wide', 'orbit', 'close'];
      if (pool.length > 1) pool = pool.filter(x => x !== T.style);
      const style = pool[(Math.random() * pool.length) | 0];
      const ST = { follow: { z: 1, a: 0.22, ap: 0.04, per: 46 }, close: { z: 1.6, a: 0.26, ap: 0.05, per: 52, push: 0.004 }, wide: { z: 0.62, a: 0.4, ap: 0.08, per: 58 }, orbit: { z: 1.15, a: 0.55, ap: 0.06, per: 64 } }[style];
      T.prevStyle = T.style; T.style = style; T.cfg = ST; T.shotT = 0; T.ext = 0; T.dur = 30 + Math.random() * 15; T.ph = Math.random() * 6.283; T.dirS = Math.random() < 0.5 ? -1 : 1;
      if (prev && prev.id !== best.id) { T.recent.unshift(prev.id); T.recent.length = Math.min(T.recent.length, 2); }
      const go = () => { if (!this.tv || !this.obs) return; T.sub = best.id; o.lock = best.id; o.sub = best.id; o.hold = 0; this.game.selectedId = best.id; };
      if (first || !far) { go(); return; } // same jumper or a neighbour: glide over
      // far away: dip to the veil, move the camera there while it is dark, then lift it
      const veil = $('tvVeil'); veil.classList.add('on'); T.cut = 1;
      setTimeout(() => { if (!this.tv) { veil.classList.remove('on'); return; } go(); try { for (let i = 0; i < 50; i++) this.R.updateView(h, 1 / 30); } catch (e) { /* camera settles on its own */ }
        requestAnimationFrame(() => requestAnimationFrame(() => { veil.classList.remove('on'); if (this.tv) T.cut = 0; })); }, 750);
    },
    tvTick(dt) {
      const T = this.tv, h = this.hab; if (!T) return; if (!h.spiders.length) { this.toggleObserve(false); return; }
      T.t += dt; T.shotT += dt; const cur = h.spider(T.sub);
      if (!cur) { if (!T.cut) this.tvShot(false); return; }
      if (!T.cut) {
        const hot = this.tvHot(cur);
        if (T.shotT >= T.dur + T.ext) { if (hot && T.ext < 25) T.ext += dt * 2; else this.tvShot(false); } // never cut away in the middle of a hunt or a molt
        else if (T.shotT > 12 && !hot && h.spiders.length > 1) { const AI = JT.SpiderAI; const busy = h.spiders.find(s => s !== cur && (AI.interest(s) >= 55 || s.state === 'molting')); if (busy) this.tvShot(false); } // something is happening elsewhere
      }
      // the shot's slow motion: a gentle sway round the planned view and an easy zoom (the planner still keeps the view clear)
      const fc = this.R.fcam; if (!fc || !fc.st || !T.cfg) return; const C = T.cfg;
      const w = 6.283 / C.per; fc.tvYaw = T.dirS * C.a * Math.sin(T.ph + T.t * w); fc.tvPitch = C.ap * Math.sin(T.ph * 1.7 + T.t * w * 0.7);
      const zt = C.z * (1 + (C.push || 0) * Math.min(40, T.shotT)); T.zoom += (zt - T.zoom) * Math.min(1, dt * 0.35); fc.userZoom = T.zoom; fc.pause = 0;
    },
    photoMode(on) {
      on = on == null ? !this.photo : on;
      if (on) {
        if (this.photo || (JT.Replay && JT.Replay.active)) return;
        if (!this.obs) { this.toggleObserve(true, this.game.selectedId); if (!this.obs) return; }
        const sp = this.hab.spider(this.obs.sub || this.obs.lock); if (!sp) { this.toast('Pick a jumper to photograph.'); return; }
        this.obs.lock = sp.id; this.obs.sub = sp.id; this.game.selectedId = sp.id;
        this.photo = { t0: performance.now(), sp: sp.id, f: this._phF || 'natural', vig: this._phVig != null ? this._phVig : true, frame: !!this._phFrame };
        if (this._tipId) this.hideTip(true); this.hidePanel(); this.closeModal(); document.body.classList.add('photo'); $('photoUi').classList.remove('hidden');
        this.photoSync();
      } else {
        if (!this.photo) return; this.photo = null; document.body.classList.remove('photo'); $('photoUi').classList.add('hidden');
        for (const id of ['glview', 'view']) { const c = $(id); if (c) c.style.filter = ''; }
      }
    },
    photoSync() {
      const P = this.photo; if (!P) return; const sp = this.hab.spider(P.sp); const S = sp && JT.SPECIES_BY_ID[sp.species];
      $('phName').textContent = sp ? sp.name + ' \u00b7 ' + S.name : '';
      const seg = $('phFilters'); seg.innerHTML = '';
      for (const [id, lab] of PHOTO_FILTERS) { const b = el('button', id === P.f ? 'on' : '', lab); b.onclick = () => { P.f = this._phF = id; A().sfx('click'); this.photoSync(); }; seg.appendChild(b); }
      const css = (PHOTO_FILTERS.find(f => f[0] === P.f) || PHOTO_FILTERS[0])[2]; for (const id of ['glview', 'view']) { const c = $(id); if (c) c.style.filter = css === 'none' ? '' : css; }
      $('phVig').classList.toggle('on', !!P.vig); $('phVigBtn').classList.toggle('on', !!P.vig);
      $('phFrame').classList.toggle('on', !!P.frame); $('phFrameBtn').classList.toggle('on', !!P.frame);
      $('phFrame').querySelector('.ph-cap').innerHTML = sp ? '<b>' + esc(sp.name) + '</b><span>' + esc(S.name) + ' \u00b7 Day ' + this.game.day() + '</span>' : '';
    },
    photoSnap() {
      const P = this.photo; if (!P || this._snapBusy) return; const sp = this.hab.spider(P.sp); if (!sp) return; const S = JT.SPECIES_BY_ID[sp.species];
      this._snapBusy = true; const g = this.game; const opts = { f: P.f, vig: P.vig, frame: P.frame };
      A().sfx('shutter'); this.buzz('place', true); const fl = $('phFlash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
      const fail = (why) => { this._snapBusy = false; this.toast(why || 'Could not take the photo.'); };
      const to = setTimeout(() => { if (this._snapBusy) { this.R._cap = null; fail(); } }, 2500);
      this.R._cap = (glc, cv) => {
        clearTimeout(to);
        const W0 = (glc || cv).width, H0 = (glc || cv).height; const sc = Math.min(1, 1280 / Math.max(W0, H0)); const W = Math.round(W0 * sc), H = Math.round(H0 * sc);
        const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        x.fillStyle = '#d9cdb3'; x.fillRect(0, 0, W, H);
        if (glc) x.drawImage(glc, 0, 0, W, H); if (cv) x.drawImage(cv, 0, 0, W, H);
        try { gradePixels(x, W, H, opts.f); } catch (e) { void e; } // a tainted canvas would refuse: keep the ungraded frame
        if (opts.vig) { const gr = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.hypot(W, H) * 0.56); gr.addColorStop(0, 'rgba(30,18,8,0)'); gr.addColorStop(1, 'rgba(30,18,8,0.55)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
        let out = c;
        if (opts.frame) { const pad = Math.round(Math.min(W, H) * 0.04), bot = Math.round(Math.min(W, H) * 0.16); const f = document.createElement('canvas'); f.width = W + pad * 2; f.height = H + pad + bot; const y = f.getContext('2d');
          y.fillStyle = '#f4ecdb'; y.fillRect(0, 0, f.width, f.height); y.drawImage(c, pad, pad); y.strokeStyle = 'rgba(60,40,20,.18)'; y.lineWidth = 1; y.strokeRect(pad - 0.5, pad - 0.5, W + 1, H + 1);
          const ff = (getComputedStyle(document.body).fontFamily || 'Georgia, serif'); y.fillStyle = '#2b2017'; y.textBaseline = 'alphabetic';
          y.font = Math.round(bot * 0.36) + 'px ' + ff; y.fillText(sp.name, pad, H + pad + bot * 0.5);
          y.fillStyle = 'rgba(43,32,23,.7)'; y.font = 'italic ' + Math.round(bot * 0.2) + 'px ' + ff; y.fillText(S.name + ' \u00b7 ' + JT.STAGES[sp.stage] + ' \u00b7 Day ' + g.day(), pad, H + pad + bot * 0.82);
          out = f; }
        const rec = { sp: sp.id, day: g.day(), stage: sp.stage, f: opts.f, w: out.width, h: out.height }; this._snapBusy = false; // the next shot can go while this one is stored
        const store = (blob) => JT.Photos.add(Object.assign(rec, blob ? { blob } : { url: out.toDataURL('image/jpeg', 0.84) })).then((r) => {
          if (!r || !r.ok) { fail('Not enough space on this device to keep the photo.'); return; }
          if (!sp.photos) { g.diary(sp, 'Had its first photo taken.'); } sp.photos = (sp.photos | 0) + 1; g.save();
          this.toast('Saved to ' + esc(sp.name) + '\u2019s profile' + (r.temp ? ' (until the game closes)' : '') + '.', 'quiet', 2200); }, () => fail());
        try { if (out.toBlob) out.toBlob((b) => store(b), 'image/jpeg', 0.86); else store(null); } catch (e) { fail(); }
      };
    },
    habPickerModal() { this.tanksModal(); },
    /** v11: every tank in one list: search, sort, favourites, status at a glance, the holding cup and a new-tank builder. */
    tanksModal() {
      const g = this.game, st = g.state; const w = el('div', 'tanks');
      w.appendChild(el('p', 'muted', g.habs.length + ' of ' + JT.MAX_HABS + ' tanks. Only the tank you are viewing is running; the others wait and catch up when you come back.'));
      const tools = el('div', 'tk-tools');
      const q = el('input'); q.type = 'search'; q.placeholder = 'Find a jumper or tank'; q.value = this._tkQ || ''; q.setAttribute('aria-label', 'Find a jumper or tank');
      const sg = el('div', 'seg small'); const sorts = [['recent', 'Recent'], ['name', 'A\u2013Z'], ['care', 'Needs care']];
      for (const [v, l] of sorts) { const b = el('button', (this._tkSort || 'recent') === v ? 'on' : '', l); b.onclick = () => { this._tkSort = v; A().sfx('click'); [...sg.children].forEach(c => c.classList.toggle('on', c === b)); draw(); }; sg.appendChild(b); }
      if (g.habs.length > 3) tools.appendChild(q); tools.appendChild(sg); w.appendChild(tools);
      const list = el('div', 'tklist'); w.appendChild(list);
      const chip = (cls, t) => '<span class="tchip ' + cls + '">' + t + '</span>';
      const names = (a) => a.slice(0, 2).map(x => esc(x.name)).join(', ') + (a.length > 2 ? ' +' + (a.length - 2) : '');
      const draw = () => {
        list.innerHTML = ''; const term = (this._tkQ || '').trim().toLowerCase(); const mode = this._tkSort || 'recent';
        let rows = g.habs.map((h, i) => ({ h, i, s: g.tankStatus(h) }));
        if (term) rows = rows.filter(({ h }) => (h.title + ' ' + JT.HABITATS[h.data.type].name + ' ' + h.spiders.map(x => JT.SPECIES_BY_ID[x.species].name).join(' ')).toLowerCase().includes(term));
        rows.sort((a, b) => (!!b.h.data.fav - !!a.h.data.fav) || (mode === 'name' ? (!a.h.spiders.length - !b.h.spiders.length) || a.h.title.localeCompare(b.h.title) : mode === 'care' ? b.s.score - a.s.score || a.i - b.i : (b.i === st.active) - (a.i === st.active) || (b.h.data.visitAt || 0) - (a.h.data.visitAt || 0)));
        if (!rows.length) list.appendChild(el('p', 'muted', 'No tank matches \u201c' + esc(term) + '\u201d.'));
        for (const { h, i, s: ts } of rows) {
          const H = JT.HABITATS[h.data.type]; const r = el('div', 'tkrow' + (i === st.active ? ' on' : ''));
          const pics = el('div', 'tkpics' + (h.spiders.length ? '' : ' none')); for (const x of h.spiders.slice(0, 3)) pics.appendChild(cloneCanvas(this.R.speciesPortrait(x.species, 64)));
          r.appendChild(pics);
          let chips = i === st.active ? chip('view', 'Viewing') : '';
          if (ts.molting.length) chips += chip('molt', 'Molting: ' + names(ts.molting));
          if (ts.hungry.length) chips += chip('warn', 'Hungry: ' + names(ts.hungry));
          if (ts.thirsty.length) chips += chip('warn', 'Thirsty: ' + names(ts.thirsty));
          if (h.spiders.length && !ts.food) chips += chip('warn', 'No food');
          if (h.spiders.length && !ts.score) chips += chip('ok', 'All good');
          r.appendChild(el('div', 'tktx', '<div class="tn">' + esc(h.title) + '</div><div class="ts">' + esc(H.name) + ' \u00b7 ' + h.spiders.length + '/' + H.cap + ' jumper' + (H.cap === 1 ? '' : 's') + '</div>' + (chips ? '<div class="tst">' + chips + '</div>' : '')));
          const bs = el('div', 'tkb');
          const fv = el('button', 'tkfav' + (h.data.fav ? ' on' : ''), h.data.fav ? '\u2605' : '\u2606'); fv.title = h.data.fav ? 'Unpin' : 'Pin to the top'; fv.setAttribute('aria-label', fv.title);
          fv.onclick = (e) => { e.stopPropagation(); h.data.fav = !h.data.fav; A().sfx('click'); g.save(); draw(); };
          const ed = el('button', 'modal-btn', 'Edit'); ed.onclick = (e) => { e.stopPropagation(); A().sfx('click'); this.sub(() => this.tanksModal(), () => this.tankEditModal(i)); };
          bs.appendChild(fv); bs.appendChild(ed); r.appendChild(bs);
          r.onclick = () => { this.closeModal(); if (i !== st.active) this.switchHab(i); };
          list.appendChild(r);
        }
      };
      q.oninput = () => { this._tkQ = q.value; draw(); };
      draw();
      // holding cup
      const cup = st.cup || [];
      if (cup.length) {
        w.appendChild(el('h4', '', 'Holding cup \u00b7 ' + cup.length));
        w.appendChild(el('p', 'muted', 'Jumpers waiting for a tank. Time stands still for them here.'));
        const cl = el('div', 'jlist');
        for (const x of cup) { const S = JT.SPECIES_BY_ID[x.species]; const r = el('div', 'jrow');
          r.appendChild(cloneCanvas(this.R.speciesPortrait(x.species, 96)));
          r.appendChild(el('div', 'jtx', '<div class="jn">' + esc(x.name) + '</div><div class="js">' + esc(S.name) + ' \u00b7 ' + JT.STAGES[x.stage] + '</div>'));
          const bs = el('div', 'jb'); const b = el('button', 'modal-btn gold', 'Place here'); b.title = 'Move into the tank you are viewing';
          b.onclick = (e) => { e.stopPropagation(); const res = g.moveSpider(x, 'cup', g.hab); if (!res.ok) { this.toast(esc(res.reason)); A().sfx('error'); return; } A().sfx('place'); this.buzz('place', true); g.selectedId = x.id; this.refreshHeader(); g.save(); this.closeModal(); this.toast(esc(x.name) + ' moved into this tank.'); };
          const pr = el('button', 'modal-btn', 'Profile'); pr.onclick = (e) => { e.stopPropagation(); this.profileModal && this.sub(() => this.tanksModal(), () => this.profileModal(x)); };
          bs.appendChild(b); if (this.profileModal) bs.appendChild(pr); r.appendChild(bs); cl.appendChild(r); }
        w.appendChild(cl);
      }
      // new tank
      w.appendChild(el('h4', '', 'New tank'));
      if (g.habs.length >= JT.MAX_HABS) w.appendChild(el('p', 'muted', 'You have the maximum of ' + JT.MAX_HABS + ' tanks. Delete one to build another.'));
      else {
        const r = el('div', 'form-row'); const ty = el('select'); ty.setAttribute('aria-label', 'Enclosure'); for (const t in JT.HABITATS) { const o = el('option', '', JT.HABITATS[t].name); o.value = t; ty.appendChild(o); }
        const ly = el('select'); ly.setAttribute('aria-label', 'Layout');
        const fill = () => { ly.innerHTML = ''; const o0 = el('option', '', 'Empty (substrate only)'); o0.value = ''; ly.appendChild(o0);
          JT.Presets.forType(ty.value).forEach(pp => { const o = el('option', '', esc(pp.name)); o.value = 't:' + pp.theme; ly.appendChild(o); });
          (st.customPresets || []).forEach((pp, k) => { const o = el('option', '', 'Custom: ' + esc(pp.name)); o.value = 'c:' + k; ly.appendChild(o); }); };
        ty.onchange = fill; fill();
        const b = el('button', 'modal-btn gold', 'Build tank'); b.onclick = () => {
          const h = g.createHabitat(ty.value); if (!h) { this.toast('You have the maximum of ' + JT.MAX_HABS + ' tanks.'); return; }
          const v = ly.value; if (v[0] === 't') JT.Presets.generate(h, v.slice(2), (JT.R() * 1e9) | 0); else if (v[0] === 'c') JT.Presets.applyCustom(h, st.customPresets[+v.slice(2)]);
          h.decor.forEach(d => { d.preset = true; }); this.closeModal(); this.switchHab(g.habs.length - 1); g.save(); A().sfx('place');
          this.toast('New ' + esc(JT.HABITATS[h.data.type].name.toLowerCase()) + ' ready. Add a jumper from <b>Jumpers</b> and the tank takes its name.', '', 4200); };
        r.appendChild(ty); r.appendChild(ly); r.appendChild(b); w.appendChild(r);
      }
      this.openModal('Your Tanks', w);
    },
    /** One tank's settings: enclosure, layout, duplicate, reset, delete. */
    tankEditModal(i) {
      const g = this.game, st = g.state; const h = g.habs[i]; if (!h) { this.tanksModal(); return; }
      const w = el('div'); const H = JT.HABITATS[h.data.type]; const isA = i === st.active; const again = () => { this._nextBack = () => this.tanksModal(); this.tankEditModal(g.habs.indexOf(h)); };
      w.appendChild(el('p', 'muted', H.name + ' \u00b7 ' + H.w + '\u00d7' + H.d + '\u00d7' + H.h + ' \u00b7 ' + h.spiders.length + '/' + H.cap + ' jumpers \u00b7 ' + h.decor.length + ' decor \u00b7 ' + h.livePreyCount() + ' prey' + (isA ? ' \u00b7 viewing' : '')));
      w.appendChild(el('p', 'muted', 'Tanks are named after the jumpers living in them; an empty tank is simply \u201cEmpty tank\u201d.'));
      if (!isA) { const r0 = el('div', 'form-row'); const b = el('button', 'modal-btn gold', 'View this tank'); b.onclick = () => { this.closeModal(); this.switchHab(g.habs.indexOf(h)); }; r0.appendChild(b); w.appendChild(r0); }
      const r2 = el('div', 'form-row'); r2.appendChild(el('label', '', 'Enclosure'));
      const sel = el('select'); for (const t in JT.HABITATS) { const o = el('option', '', JT.HABITATS[t].name + (t === h.data.type ? ' (current)' : '')); o.value = t; if (t === h.data.type) o.selected = true; sel.appendChild(o); }
      const cb = el('button', 'modal-btn', 'Change'); cb.onclick = () => {
        const t = sel.value; if (t === h.data.type) return;
        if (!root.confirm('Change to ' + JT.HABITATS[t].name + '? Decor that no longer fits is removed, and jumpers beyond its capacity wait in the holding cup.')) return;
        g.changeType(h, t); if (h === g.hab) { this.R.cur = null; this.undoClear && this.undoClear(); } this.refreshHeader(); g.save(); again(); this.toast('Enclosure changed to ' + JT.HABITATS[t].name + '.');
      };
      r2.appendChild(sel); r2.appendChild(cb); w.appendChild(r2);
      const r3 = el('div', 'form-row'); r3.appendChild(el('label', '', 'Preset layout'));
      const ps = el('select'); JT.Presets.forType(h.data.type).forEach(pp => { const o = el('option', '', esc(pp.name)); o.value = 't:' + pp.theme; ps.appendChild(o); });
      (st.customPresets || []).forEach((pp, k) => { const o = el('option', '', 'Custom: ' + esc(pp.name)); o.value = 'c:' + k; ps.appendChild(o); });
      const ap = el('button', 'modal-btn', 'Apply / Regenerate'); ap.onclick = () => {
        if (!root.confirm('Replace all decor in ' + h.title + ' with this layout? Current decor is removed.')) return;
        if (h === g.hab && this.undoPush) this.undoPush('Layout');
        const v = ps.value; if (v[0] === 't') JT.Presets.generate(h, v.slice(2), (JT.R() * 1e9) | 0); else JT.Presets.applyCustom(h, st.customPresets[+v.slice(2)]);
        h.decor.forEach(d => { d.preset = true; }); if (h === g.hab) this.R._speck = null; this.afterLayout && this.afterLayout(h);
        g.save(); this.toast('New layout ready.'); again();
      };
      const sv = el('button', 'modal-btn', 'Save current as preset'); sv.onclick = () => { const n = root.prompt('Preset name:', h.title + ' layout'); if (!n) return; JT.Presets.saveCustom(g, h, n.slice(0, 30)); g.save(); this.toast('Saved preset \u201c' + esc(n) + '\u201d.'); again(); };
      r3.appendChild(ps); r3.appendChild(ap); r3.appendChild(sv); w.appendChild(r3);
      const r4 = el('div', 'form-row'); r4.appendChild(el('label', '', 'Tank'));
      const du = el('button', 'modal-btn', 'Duplicate layout'); du.title = 'A new empty tank with the same enclosure, substrate, background and decor';
      du.onclick = () => { const n = g.duplicateHabitat(h); if (!n) { this.toast('You have the maximum of ' + JT.MAX_HABS + ' tanks.'); return; } g.save(); A().sfx('place'); this.toast('Copied the layout into a new empty tank.'); this.tanksModal(); };
      const rb = el('button', 'modal-btn danger', 'Reset tank\u2026'); rb.onclick = () => this.resetTank(h);
      const db = el('button', 'modal-btn danger', 'Delete tank\u2026'); db.disabled = g.habs.length <= 1; if (db.disabled) db.title = 'Your only tank cannot be deleted (reset it instead)';
      db.onclick = () => {
        if (!root.confirm('Delete ' + h.title + '? The decor, prey and silk are removed.' + (h.spiders.length ? ' ' + h.spiders.map(x => x.name).join(', ') + ' will wait in the holding cup.' : ''))) return;
        const act = h === g.hab; if (act) { if (this.obs) this.toggleObserve(false); this.hidePanel(); this.cancelMode(); this.undoClear && this.undoClear(); }
        const n = h.spiders.length; if (!g.deleteHabitat(h)) return; if (act) { const nh = g.hab; g.selectedId = nh.spiders[0] ? nh.spiders[0].id : null; this.R.cur = null; this.R.resetView(); }
        this.refreshHeader(); g.save(); A().sfx('rustle'); this.toast('Tank deleted.' + (n ? ' Its jumpers are waiting in the holding cup.' : '')); this.tanksModal(); };
      r4.appendChild(du); r4.appendChild(rb); r4.appendChild(db); w.appendChild(r4);
      this.openModal(h.title, w);
    },
    /** Move a jumper to another tank (or the holding cup). */
    moveModal(sp) {
      const g = this.game; const from = g.habs.find(h => h.spiders.includes(sp)); if (!from) return;
      const w = el('div'); w.appendChild(el('p', 'muted', 'Move ' + esc(sp.name) + ' to another tank, or let it wait in the holding cup.'));
      const list = el('div', 'sheet-list');
      const done = (dest) => { if (from === g.hab) { this.hidePanel(); g.selectedId = from.spiders[0] ? from.spiders[0].id : null; if (this.obs && this.obs.sub === sp.id) this.toggleObserve(false); } this.refreshHeader(); g.save(); this.closeModal(); A().sfx('place'); this.buzz('place', true); this.toast(esc(sp.name) + ' moved to ' + dest + '.'); };
      const go = (h) => { const r = g.moveSpider(sp, from, h); if (!r.ok) { this.toast(esc(r.reason)); A().sfx('error'); return false; } done(h === 'cup' ? 'the holding cup' : '<b>' + esc(h.title) + '</b>'); return true; };
      g.habs.forEach((h) => { if (h === from) return; const full = h.spiders.length >= h.dims.cap; const b = el('button', '', esc(h.title) + '<small class="muted">' + esc(JT.HABITATS[h.data.type].name) + ' \u00b7 ' + h.spiders.length + '/' + h.dims.cap + (full ? ' \u00b7 full' : '') + '</small>'); b.disabled = full; b.onclick = () => go(h); list.appendChild(b); });
      if (g.habs.length < JT.MAX_HABS) { const b = el('button', '', 'A new empty tank<small class="muted">' + esc(from.dims.name) + '</small>'); b.onclick = () => { const h = g.createHabitat(from.data.type); if (h && !go(h)) g.habs.pop(); }; list.appendChild(b); }
      const c = el('button', '', 'Holding cup<small class="muted">waits here, time stands still</small>'); c.onclick = () => go('cup'); list.appendChild(c);
      w.appendChild(list); this.openModal('Move ' + sp.name, w);
    },
    moreSheet() {
      const g = this.game; const w = el('div', 'menu'); const back = () => this.moreSheet();
      const sect = (t) => { const e = el('div', 'msect'); e.appendChild(el('h4', '', t)); w.appendChild(e); return e; };
      const row = (parent, lab, fn, on, hint) => { const b = el('button', 'mrow' + (on ? ' on' : ''), esc(lab) + (hint ? '<small>' + hint + '</small>' : '')); b.onclick = () => { A().sfx('click'); fn(); }; parent.appendChild(b); return b; };
      const segRow = (parent, lab, opts, cur, fn) => { const r = el('div', 'mseg'); r.appendChild(el('span', '', lab)); const sg = el('div', 'seg small'); for (const [v, l] of opts) { const b = el('button', v === cur ? 'on' : '', l); b.onclick = () => { A().sfx('click'); fn(v); }; sg.appendChild(b); } r.appendChild(sg); parent.appendChild(r); };
      // habitats: switch with one tap
      const hs = sect('Tanks');
      g.habs.map((h, i) => [h, i]).sort((a, b) => (b[1] === g.state.active) - (a[1] === g.state.active) || (b[0].data.visitAt || 0) - (a[0].data.visitAt || 0)).slice(0, 4)
        .forEach(([h, i]) => row(hs, h.title, () => { this.closeModal(); if (i !== g.state.active) this.switchHab(i); }, i === g.state.active, h.spiders.length + ' jumper' + (h.spiders.length === 1 ? '' : 's') + ' · ' + JT.HABITATS[h.data.type].name));
      row(hs, 'All tanks…', () => this.sub(back, () => this.tanksModal()), false, g.habs.length + ' of ' + JT.MAX_HABS + ((g.state.cup || []).length ? ' · ' + g.state.cup.length + ' in the holding cup' : ''));
      // view
      const vs = sect('View');
      segRow(vs, 'Camera', this.camModes().map(m => [m, JT.CAMS[m].label.replace(/^Isometric$/, 'Iso')]), this.R.cam.mode, (m) => { this.setCam(m); this.moreSheet(); });
      segRow(vs, 'Time', [['auto', 'Natural'], ['day', 'Day'], ['night', 'Night']], g.state.timeMode, (m) => { this.setTimeMode(m); this.moreSheet(); });
      row(vs, this.obs ? 'Stop observing' : 'Observe a jumper', () => { this.closeModal(); this.toggleObserve(!this.obs); });
      if (this.hab.spiders.length) row(vs, 'Ambient TV', () => { this.closeModal(); this.tvMode(true); }, false, 'Hands-free watching: the camera picks the moments. Tap to come back.');
      // app
      const as = sect('Game');
      row(as, this.set.muted ? 'Sound (muted)' : 'Sound', () => { this.closeModal(); this.soundPopover(); });
      row(as, 'Settings', () => this.sub(back, () => this.settingsModal()));
      row(as, 'Help & tips', () => this.sub(back, () => this.helpModal()));
      if (this.canFullscreen) row(as, 'Full screen', () => { this.closeModal(); this.toggleFullscreen(); });
      const ts = sect('This tank');
      row(ts, 'Tank settings…', () => this.sub(back, () => this.tankEditModal(g.state.active)), false, 'Enclosure, layout, duplicate, delete');
      row(ts, 'Reset tank…', () => this.resetTank(), false, 'Empties ' + esc(this.hab.title) + '; unlocks stay');
      this.openModal('Menu', w, { sheet: 'menu', back: null }); this.dockOn('more');
    },
    /** Empty the tank being viewed (only this one). Unlocks stay; the journal starts over. */
    resetTank(hh) {
      const g = this.game, h = hh || this.hab; if (!h) return; const act = h === this.hab;
      if (!root.confirm('Reset ' + h.title + '? All decor, plants, prey, jumpers, silk and retreats in this tank are removed and the journal starts over. Unlocked jumpers stay unlocked.')) return;
      if (act) { if (this.obs) this.toggleObserve(false); this.closeModal(); this.hidePanel(); if (this.R.cam.mode === 'follow') this.unfollow(); this.undoClear && this.undoClear(); } else this.closeModal();
      h.resetTank(); g.state.journal = {}; g.state.jmeta = {}; if (act) g.selectedId = null;
      this.R.cur = null; this.R._speck = null; this.refreshHeader(); g.save();
      this.toast('Tank reset. A clean slate.'); A().sfx('rustle');
    },
    manageModal() { this.tanksModal(); }, // v11: one place for every tank
    // ---------------- app: full screen, install, save transfer ----------------
    get standalone() { try { return root.matchMedia('(display-mode: standalone)').matches || root.matchMedia('(display-mode: fullscreen)').matches || root.navigator.standalone === true; } catch (e) { return false; } },
    get canFullscreen() { const d = document.documentElement; return !this.standalone && !!(d.requestFullscreen || d.webkitRequestFullscreen); },
    toggleFullscreen() {
      const d = document, de = d.documentElement; const on = d.fullscreenElement || d.webkitFullscreenElement;
      try {
        if (on) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
        else { const p = (de.requestFullscreen || de.webkitRequestFullscreen).call(de, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => this.toast('Full screen is not available here.')); }
      } catch (e) { this.toast('Full screen is not available here.'); }
    },
    appRows(w) {
      if (this.standalone) return;
      w.appendChild(el('h4', '', 'Play as an app'));
      const r = el('div', 'form-row');
      if (this.canFullscreen) { const f = el('button', 'modal-btn', (document.fullscreenElement || document.webkitFullscreenElement) ? 'Exit full screen' : 'Full screen'); f.onclick = () => { this.toggleFullscreen(); this.closeModal(); }; r.appendChild(f); }
      if (JT._installPrompt) { const i = el('button', 'modal-btn', 'Install app'); i.onclick = async () => { const ev = JT._installPrompt; JT._installPrompt = null; try { ev.prompt(); await ev.userChoice; } catch (e) { } this.closeModal(); }; r.appendChild(i); }
      if (r.childNodes.length) w.appendChild(r);
      const ios = /iphone|ipad|ipod/i.test(root.navigator.userAgent) || (root.navigator.platform === 'MacIntel' && root.navigator.maxTouchPoints > 1);
      const hint = location.protocol === 'file:' ? 'To install, open the game from its web address (see README), then use your browser\'s “Install app” / “Add to Home Screen”.'
        : ios ? 'On iPhone/iPad: tap Share, then “Add to Home Screen”. It opens full screen with no browser bars.'
        : 'Or use the browser menu → “Install app” / “Add to Home screen”. It opens full screen with no browser bars.';
      w.appendChild(el('p', 'muted', hint));
    },
    exportSave() {
      this.game.save(); const txt = this.game.serialize(); const name = 'jumper-terrarium-save-' + new Date().toISOString().slice(0, 10) + '.json';
      try {
        const file = typeof File !== 'undefined' ? new File([txt], name, { type: 'application/json' }) : null;
        if (file && root.navigator.canShare && root.navigator.canShare({ files: [file] })) { root.navigator.share({ files: [file], title: 'Jumper Terrarium save' }).catch(() => { }); return; }
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        this.toast('Save exported.');
      } catch (e) { this.toast('Could not export the save here.'); }
    },
    importSave() {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json,text/plain';
      inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const rd = new FileReader();
        rd.onload = () => { if (!root.confirm('Replace your current game with this save?')) return;
          if (this.game.importSave(String(rd.result))) { this.closeModal(); this.cancelMode(); this.R.resetCaches(); this.refreshHeader(); const sp = this.game.hab && this.game.hab.spider(this.game.selectedId); if (sp) this.showPanel(sp.id); this.toast('Save imported — welcome back!'); }
          else this.toast('That file is not a Jumper Terrarium save.'); };
        rd.readAsText(f); };
      inp.click();
    },
    settingsModal() {
      const s = this.set, h = this.hab; const w = el('div');
      w.appendChild(el('h4', '', 'Background for ' + esc(h.title)));
      const bgs = el('div', 'bgs');
      for (const id in JT.BACKGROUNDS) { const B = JT.BACKGROUNDS[id]; const b = el('button', h.data.bg === id ? 'on' : '', esc(B.name)); b.style.background = 'linear-gradient(' + B.sky[0] + ',' + B.sky[1] + ' 55%,' + B.sky[2] + ')'; b.onclick = () => { if (h === this.hab && h.data.bg !== id) this.undoPush('Background: ' + B.name); h.data.bg = id; this.R.bgCache = {}; this.settingsModal(); }; bgs.appendChild(b); }
      w.appendChild(bgs);
      w.appendChild(el('h4', '', 'Graphics'));
      const q = el('div', 'form-row'); q.appendChild(el('label', '', 'Render quality'));
      const seg = el('div', 'seg small'); for (const [v, l] of [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]) { const b = el('button', s.quality === v ? 'on' : '', l); b.onclick = () => { s.quality = v; this.R._autoLow = false; this.R._autoLvl = 0; JT.Settings.save(s); this.R.resize(); this.settingsModal(); }; seg.appendChild(b); }
      q.appendChild(seg); w.appendChild(q);
      { const fr = el('div', 'form-row'); fr.appendChild(el('label', '', 'Art style')); const sg = el('div', 'seg small');
        for (const [v, l] of [['hd2d', 'HD-2D'], ['cuphead', 'Cuphead'], ['storybook', 'Storybook']]) { const b = el('button', (s.art || 'hd2d') === v ? 'on' : '', l); b.onclick = () => { s.art = v; JT.Settings.save(s); this.R.resetCaches(); this.settingsModal(); }; sg.appendChild(b); }
        fr.appendChild(sg); fr.appendChild(el('span', 'muted', 'HD-2D: pixel-art diorama with lens blur, bloom and light shafts. Cuphead: 1930s cartoon on old film. Storybook: ink and watercolour.')); w.appendChild(fr); }
      if ((s.art || 'hd2d') === 'hd2d') { const fr = el('div', 'form-row'); fr.appendChild(el('label', '', 'Pixel size')); const sg = el('div', 'seg small');
        for (const [v, l] of [['fine', 'Fine'], ['classic', 'Classic'], ['chunky', 'Chunky']]) { const b = el('button', (s.pixel || 'classic') === v ? 'on' : '', l); b.onclick = () => { s.pixel = v; JT.Settings.save(s); this.settingsModal(); }; sg.appendChild(b); }
        fr.appendChild(sg); w.appendChild(fr); }
      if ((s.art || 'hd2d') === 'hd2d') { const fr = el('div', 'form-row'); fr.appendChild(el('label', '', 'Lens blur')); const sg = el('div', 'seg small');
        for (const [v, l] of [['off', 'Off'], ['light', 'Light'], ['strong', 'Strong']]) { const b = el('button', (s.blur || 'light') === v ? 'on' : '', l); b.onclick = () => { s.blur = v; JT.Settings.save(s); this.settingsModal(); }; sg.appendChild(b); }
        fr.appendChild(sg); fr.appendChild(el('span', 'muted', 'Depth-of-field and tilt-shift blur around the edges of the view')); w.appendChild(fr); }
      if (s.art === 'cuphead') { const fr = el('div', 'form-row'); fr.appendChild(el('label', '', 'Old film')); const sg = el('div', 'seg small');
        for (const [v, l] of [['off', 'Off'], ['light', 'Light'], ['full', 'Full']]) { const b = el('button', (s.film || 'light') === v ? 'on' : '', l); b.onclick = () => { s.film = v; JT.Settings.save(s); this.settingsModal(); }; sg.appendChild(b); }
        fr.appendChild(sg); fr.appendChild(el('span', 'muted', 'Film grain, flicker, scratches and dust')); w.appendChild(fr); }
      { const fr = el('div', 'form-row'); fr.appendChild(el('label', '', 'Frame rate')); const sg = el('div', 'seg small');
        for (const [v, l] of [['saver', 'Battery saver'], ['auto', 'Auto'], ['smooth', 'Smooth']]) { const b = el('button', (s.fps || 'auto') === v ? 'on' : '', l); b.onclick = () => { s.fps = v; JT.Settings.save(s); this.settingsModal(); }; sg.appendChild(b); }
        fr.appendChild(sg); fr.appendChild(el('span', 'muted', 'Auto: 60 fps while the device keeps up, 30 when it is busy')); w.appendChild(fr); }
      const tog = (key, label, hint) => { const r = el('div', 'form-row'); const id = 'set_' + key; r.innerHTML = '<label for="' + id + '">' + label + '</label>'; const c = el('input'); c.type = 'checkbox'; c.id = id; c.checked = !!s[key]; c.onchange = () => { s[key] = c.checked; JT.Settings.save(s); }; r.appendChild(c); if (hint) r.appendChild(el('span', 'muted', hint)); w.appendChild(r); return c; };
      w.appendChild(el('h4', '', 'Feel & help'));
      { const c = tog('haptics', 'Vibration', this.hapticsInfo()); c.checked = s.haptics !== false; c.addEventListener('change', () => { if (c.checked) this.buzz('tap', true); }); }
      { const c = tog('keepAwake', 'Keep screen awake', 'The screen won\'t dim or lock while the game is open.'); c.checked = s.keepAwake !== false; c.addEventListener('change', () => { if (JT.Wake) JT.Wake.sync(); }); }
      { const c = tog('tips', 'Show tips', 'Short hints the first time you do something. Replay them any time from Menu → Help & tips.'); c.checked = s.tips !== false; }
      { const pr = this._probe; const cs = getComputedStyle(document.documentElement); const sab = cs.getPropertyValue('--sab'); const tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);width:1px;visibility:hidden'; document.body.appendChild(tmp); const sb = Math.round(tmp.getBoundingClientRect().height); tmp.remove(); void sab;
        const sa = document.documentElement.classList.contains('sa'); const app = $('app').getBoundingClientRect();
        const info = 'Screen ' + (root.screen ? screen.width + '×' + screen.height : '?') + ' · window ' + root.innerWidth + '×' + root.innerHeight + ' · large ' + (pr ? Math.round(pr.getBoundingClientRect().height) : '?') + ' · game ' + Math.round(app.height) + ' · safe bottom ' + sb + ' · ' + (sa ? 'home-screen app' : 'browser');
        const r0 = el('div', 'form-row'); r0.appendChild(el('label', '', 'Screen info')); r0.appendChild(el('span', 'muted', info)); w.appendChild(r0); }
      w.appendChild(el('h4', '', 'Save data'));
      const r = el('div', 'form-row'); const b = el('button', 'modal-btn', 'Save now'); b.onclick = () => { this.game.save(); this.toast('Game saved.'); };
      const rs = el('button', 'modal-btn', 'Reset game…'); rs.onclick = () => { if (root.confirm('Start over? All habitats, jumpers and progress will be erased.')) { this.closeModal(); this.cancelMode(); this.game.reset(); this.R.cur = null; this.refreshHeader(); const sp = this.game.hab.spider(this.game.selectedId); if (sp) this.showPanel(sp.id); this.toast('A fresh start — welcome back!'); } };
      r.appendChild(b); r.appendChild(rs); w.appendChild(r);
      // move progress between the browser and the installed app (they keep separate storage)
      const r2 = el('div', 'form-row'); const ex = el('button', 'modal-btn', 'Export save'); ex.onclick = () => this.exportSave();
      const im = el('button', 'modal-btn', 'Import save…'); im.onclick = () => this.importSave();
      r2.appendChild(ex); r2.appendChild(im); w.appendChild(r2);
      w.appendChild(el('p', 'muted', 'Progress saves automatically on this device. Export a save to carry your jumpers into the installed app (or back). Settings are stored separately and never affect your save.'));
      this.appRows(w);
      this.openModal('Settings', w);
    },
    soundPopover() {
      const p = $('popover'); const s = this.set; A().start();
      if (!p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
      p.innerHTML = '<b>Sound</b>'; const sl = (key, label) => { const r = el('div', 'form-row'); r.appendChild(el('label', '', label)); const i = el('input'); i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = s[key]; i.oninput = () => { s[key] = +i.value; A().apply(); JT.Settings.save(s); }; r.appendChild(i); p.appendChild(r); };
      sl('music', 'Music'); sl('ambience', 'Ambience'); sl('effects', 'Effects');
      { const h = this.hab, r = el('div', 'form-row'); r.appendChild(el('label', '', 'Tank sounds')); const sg = el('div', 'seg small scape'); const auto = A().themeOf ? (h.data.sound = h.data.sound || 'auto', (() => { const sv = h.data.sound; h.data.sound = 'auto'; const t = A().themeOf(h); h.data.sound = sv; return t; })()) : 'woodland';
        for (const [v, l] of [['auto', 'Auto (' + auto + ')'], ['rainforest', 'Rainforest'], ['desert', 'Desert'], ['garden', 'Garden'], ['woodland', 'Woodland']]) { const b = el('button', (h.data.sound || 'auto') === v ? 'on' : '', l); b.onclick = () => { h.data.sound = v; if (A()._sc) A()._sc.k = 0; sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); A().sfx('click'); }; sg.appendChild(b); }
        r.appendChild(sg); p.appendChild(r); }
      { const r = el('div', 'form-row'); r.innerHTML = '<label for="pop_hap">Vibration</label>'; const c = el('input'); c.type = 'checkbox'; c.id = 'pop_hap'; c.checked = s.haptics !== false; c.onchange = () => { s.haptics = c.checked; JT.Settings.save(s); if (c.checked) this.buzz('tap', true); }; r.appendChild(c); p.appendChild(r); }
      const r = el('div', 'form-row'); const b = el('button', 'modal-btn', s.muted ? 'Unmute' : 'Mute all'); b.onclick = () => { s.muted = !s.muted; A().apply(); JT.Settings.save(s); this.refreshHeader(); p.classList.add('hidden'); }; r.appendChild(b); p.appendChild(r);
      p.classList.remove('hidden');
    },
    helpModal() {
      const e = (h, p) => '<div class="entry"><h4>' + h + '</h4><p>' + p + '</p></div>';
      this.openModal('How to Keep Jumpers', '<div class="grid">' +
        e('Your jumpers', 'Tap a jumper to see its card: one line on what it is doing, hunger, water, growth and personality. Press Observe on the card to watch that jumper up close.') +
        e('Feeding', 'Release live food from the Food strip; it is always free (up to ' + JT.PREY_CAP + ' live per tank). Pick food that suits your jumper\'s size: tiny slings need aphids, fruit flies or gnats. Hungry jumpers hunt on their own. When the food runs out they patrol their perches, climb high to scan and lunge at anything that moves. The Food control gently glows while someone is waiting.') +
        e('Growth', 'After enough meals a jumper climbs somewhere high and sheltered, spins a silk retreat and molts. It stays soft and pale for a while afterwards.') +
        e('Building', 'New displays start bare: just substrate. Decor, Plants and Substrate open the shop strip. Pick a piece and place it; it shows whether it fits. Stack plants and pieces on platforms. <kbd>R</kbd> rotates, <kbd>L</kbd> trees with or without leaves, <kbd>Esc</kbd> cancels. Every piece, plant, substrate and enclosure is free.') +
        e('Warmth', 'A Basking Lamp throws a warm pool of light. Jumpers bask there in the morning, when it is cool and after a meal. Tap the lamp to switch it on or off. At night it draws moths and flies.') +
        e('Care', 'Mist to leave droplets for drinking. Springtails and isopods seek out husks and shed skins and nibble them away; more springtails clean faster. Clean tidies husks at once.') +
        e('Camera', '<kbd>1</kbd> Isometric, <kbd>2</kbd> Front, <kbd>3</kbd> Back. Tanks with a back wall swap Back for <kbd>3</kbd> Left and <kbd>4</kbd> Right, and the camera never goes behind the wall. <kbd>O</kbd> or <kbd>F</kbd> Observe (tap another jumper while observing to watch it instead). On a phone, the numbered buttons switch camera; tap the current one again to re-centre. Scroll or pinch to zoom, drag to pan; while observing, drag to orbit. Auto-framing resumes after a few quiet seconds. <kbd>0</kbd> resets.') +
        e('Collection', 'You begin with the Peacock Spider, the smallest jumper. Raise a jumper to Adult and the next-largest species unlocks, all the way up to the Regal Orange Morph. Portia unlocks after 30 successful catches, the Vegetarian Jumper after you witness 10 journal behaviours, and the House Jumper once one of your jumpers knows you. Up to ' + JT.PER_SPECIES + ' of each species can share a tank. Every jumper arrives as a Sling.') + e('Journal', 'Witnessed behaviours fill the Field Journal. Your shelf holds up to ' + JT.MAX_HABS + ' displays; build new ones from Habitats.') +
        e('Your finger', 'Tap the glass, or press and hold to rest a fingertip there. Curious jumpers turn to look and creep closer; shy ones hide. Gentle visits build trust, shown on the card. A fast swipe startles them.') +
        e('Life stories', 'Each jumper keeps a dated story of its big moments: arriving, first catch, molts, things you saw it do. Jumpers → Journal → Life stories.') +
        e('Sounds & feel', 'Each tank has its own soundscape (rainforest, desert, garden or woodland) and reacts to what is in it: a water dish trickles, plants rustle, misting drips, a lamp hums. Change it under Sound. Vibration works on most Android phones; iPhones only give a light tick on your own taps.') + '</div>');
      { const b = el('button', 'modal-btn gold', 'Replay the beginner tips'); b.onclick = () => { this.resetTips(); this.closeModal(); this.tipOnce('welcome', true); }; const r = el('div', 'form-row tiprow'); r.appendChild(b); $('modalBody').prepend(r); }
    },

    /** The Food control gently breathes while a hungry jumper has nothing left to hunt (no badge, no icon). */
    updateWanting() {
      const h = this.hab; const AI = JT.SpiderAI;
      const want = h.spiders.some(s => s.sat < 0.4 && !s.hold && !(AI.preyAvailable && AI.preyAvailable(h, s)));
      if (want === this._want) return; this._want = want;
      document.querySelectorAll('#toolbar button[data-tool="care"], #dock button[data-dock="care"]').forEach(b => b.classList.toggle('wanting', want));
    },
    // ------------------------------------------------ per-frame
    update(dt) {
      this._t += dt; this._panelT += dt; this._hudT = (this._hudT || 0) + dt;
      if (this._hudT > 0.12) { this._hudT = 0; try { this.layoutHud(); if (this._camKey !== this.camModes().join()) this.syncCams(); } catch (e) { /* layout is cosmetic */ } }
      const g = this.game; const h = g.hab;
      if (this.obs) this.updateObs(dt);
      if (this.photo && this.R.fcam && performance.now() - this.photo.t0 > 1600) this.R.fcam.pause = Math.max(this.R.fcam.pause || 0, 1.5); // photo mode: after the close-up settles, the camera stays where you put it
      // the player "watches" the selected jumper -> personality is discovered over time
      if (g.viewing) for (const s of h.spiders) s.obsT = (s.obsT || 0) + dt * (s.id === g.selectedId && (this.panelId === s.id || this.obs || this.R.cam.mode === 'follow') ? 1 : 0.2);
      if (this._panelT > 0.3) { this._panelT = 0; this.updateClock(); if (this.panelId) this.renderPanel(false); this.updateWanting(); this.tipWatch(); }
      this.pumpTips(dt);
      if (this.mode === 'place' && this.place && this._t > 0.5) { this._t = 0; this.updateGhostAtCurrent(); }
      if (this._unlockQ && this._unlockQ.length && !this._ufEl) this.unlockPump();
      if (TQ.length) { if (performance.now() > (this._scrollUntil || 0)) pumpThumbs(this.isMobile() ? 6 : 9); }
      else this.warmThumbs(dt);
    },
    /** Idle pre-painting of shop thumbnails (one every ~0.3 s, only while nothing else is going on). */
    warmThumbs(dt) {
      this._warmT = (this._warmT || 0) + dt; if (!this._tdb && this._warmT > 0.8) { this._tdb = true; try { JT.ThumbDB.load(this.R); } catch (e) { /* no storage */ } }
      if (this._warmT < 4 || this._warmDone) return;
      if (this.obs || this.mode || this.R._moving || (this.R.fps && this.R.fps < 24)) return;
      if (this._warmT - (this._warmLast || 0) < 0.3) return; this._warmLast = this._warmT;
      if (!this._warmList) this._warmList = JT.DECOR.filter(d => d.cat === 'decor' || d.cat === 'plants' || d.cat === 'ground').map(d => d.id);
      while (this._warmList.length) { const id = this._warmList.shift(); if (this.R.hasThumb(id, 0, 112)) continue; try { this.R.decorThumb(id, 0, 112); } catch (e) { /* ignore */ } return; }
      this._warmDone = true;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
