/* Jumper Terrarium — boot + main loop (fixed-step simulation, variable-rate rendering). */
(function (root) {
  'use strict';
  const JT = root.JT;
  /* ---------------- slow-motion catch replay ----------------
     The watched habitat's critters are recorded every simulation step (last ~7 s: positions, facing, states and the
     small pose objects the renderer reads). After a pounce lands, a toast offers a quarter-speed replay of the
     crouch, strike and bite, followed close up. The simulation is paused meanwhile and every recorded field is put
     back exactly as it was afterwards, so nothing in the tank changes. */
  const Replay = (() => {
    const N = 240, SPEED = 0.25, PRE = 20, POST = 36; // frames at 30 Hz
    const SKIP = new Set(['mem', '_route', 'stats', 'traits', 'name', 'id', 'species', 'type', 'seed', '_ip', '_if', 'home', 'log', 'journal', 'path', '_sc']);
    const OBJ = new Set(['sup', '_air', '_pz', '_glance', '_dangleOff', '_hang', 'target', 'weak', '_yank']);
    const numArr = (v) => Array.isArray(v) && v.length <= 16 && v.every(x => typeof x === 'number');
    const rec = (k, v) => { if (SKIP.has(k)) return undefined; const t = typeof v; if (v == null || t === 'number' || t === 'string' || t === 'boolean') return { v }; if (numArr(v)) return { v: v.slice() }; if (OBJ.has(k) && t === 'object') return { v: JT.deepClone(v) }; return undefined; };
    const recordable = (k, v) => rec(k, v) !== undefined;
    function snap(e) { const o = {}; for (const k of Object.keys(e)) { const r = rec(k, e[k]); if (r) o[k] = r.v; } return o; }
    function put(e, o) { for (const k of Object.keys(e)) if (!(k in o) && recordable(k, e[k])) delete e[k];
      for (const k of Object.keys(o)) { const v = o[k]; e[k] = v == null || typeof v !== 'object' ? v : Array.isArray(v) ? v.slice() : JT.deepClone(v); } }
    const R = { buf: [], habId: null, active: null, offer: null };
    R.record = function (game) {
      if (R.active) return; const h = game.hab; if (!h) return; if (h !== R.habId) { R.buf = []; R.habId = h; }
      const ents = []; for (const s of h.data.spiders) ents.push([s, snap(s), 's']); for (const p of h.data.prey) ents.push([p, snap(p), 'p']);
      R.buf.push({ t: game.state.time, ents }); if (R.buf.length > N) R.buf.shift();
    };
    /** Range for the latest pounce of jumper `id` that ended in a bite: [start, catch, end] frame indices. */
    /** Frames for one pounce of jumper `id` that ended in a bite: the one closest to clock time `tc` (the catch the
        toast was offered for), else the latest. Returns [start, crouchStart, pounceStart, catch, end]. Always at least
        LEAD frames (1 s) of build-up before the leap. */
    const LEAD = 30;
    function range(id, tc) {
      const B = R.buf; const st = (i) => { const r = B[i].ents.find(x => x[0].id === id && x[2] === 's'); return r ? r[1].state : null; };
      let c = -1, best = 1e9; for (let i = B.length - 1; i > 0; i--) if (st(i) !== 'pounce' && st(i - 1) === 'pounce') { const d = tc == null ? 0 : Math.abs(B[i].t - tc); if (d < best) { best = d; c = i; } if (tc == null) break; }
      if (c < 0 || (tc != null && best > 3)) return null; let p = c - 1; while (p > 0 && st(p - 1) === 'pounce') p--; let a = p; while (a > 0 && st(a - 1) === 'crouch' && p - a < 34) a--;
      return [Math.max(0, Math.min(a - PRE, p - LEAD)), a, p, c, Math.min(B.length - 1, c + POST)];
    }
    R.available = (id, tc) => !!range(id, tc);
    R.onCatch = function (UI, sp, tc) {
      if (R.active || !sp) return; const id = sp.id; if (tc == null) tc = UI.game.state.time;
      if (R.offer && R.offer.el) R.offer.el.remove(); // a newer catch replaces the older offer
      const t = UI.toast('<b>Nice catch!</b> <span class="rp">Watch it in slow motion \u25B6</span>', 'replay', 3200); R.offer = { id, tc, el: t };
      if (t) t.onclick = (ev) => { ev.stopPropagation(); t.remove(); R.start(UI, id, tc); };
    };
    R.start = function (UI, id, tc) {
      if (R.active) return; const g = UI.game, h = g.hab; if (!h || h !== R.habId) return; const rg = range(id, tc);
      if (!rg) { UI.toast('That catch is too long ago to replay.', 'quiet'); return; }
      if (R.offer && R.offer.el) R.offer.el.remove();
      const live = new Map(); for (const s of h.data.spiders) live.set(s, snap(s)); for (const p of h.data.prey) live.set(p, snap(p));
      const frames = R.buf.slice(rg[0], rg[4] + 1); const added = [];
      for (const f of frames) for (const [e, , k] of f.ents) { if (live.has(e)) continue; live.set(e, snap(e)); const list = k === 's' ? h.data.spiders : h.data.prey; if (!list.includes(e)) { list.push(e); added.push([list, e]); } }
      const cam = UI.obs ? { obs: true, lock: UI.obs.lock } : { obs: false }; const sel = g.selectedId;
      R.active = { id, frames, i: 0, hold: 0, settle: 0.45, live, added, time: g.state.time, game: g, hab: h, cam, sel, slowA: rg[1] - rg[0], pounceI: rg[2] - rg[0], catchI: rg[3] - rg[0] };
      if (!UI.obs) UI.toggleObserve(true, id); else { UI.obs.lock = id; UI.pickSubject(true); }
      let hud = document.getElementById('replayHud'); if (!hud) { hud = document.createElement('div'); hud.id = 'replayHud'; document.getElementById('app').appendChild(hud); }
      hud.innerHTML = '<div class="rpBadge">\u25B6 Slow motion \u00BC\u00D7 <span>tap anywhere to return</span></div>'; hud.classList.remove('hidden');
      hud.onclick = (ev) => { ev.stopPropagation(); ev.preventDefault(); R.stop(); };
      apply(0);
    };
    function apply(x) {
      const A = R.active; const F = A.frames; const i = Math.min(F.length - 1, Math.floor(x)), j = Math.min(F.length - 1, i + 1), a = x - i;
      A.game.state.time = F[i].t + (F[j].t - F[i].t) * a; const nxt = new Map(F[j].ents.map(r => [r[0], r[1]]));
      const inF = new Set(); for (const [e, o] of F[i].ents) { inF.add(e); put(e, o); const q = nxt.get(e);
        if (q && q.pos && e.pos && Math.hypot(q.pos[0] - e.pos[0], q.pos[1] - e.pos[1], q.pos[2] - e.pos[2]) < 30) { e.pos = e.pos.map((v, k) => v + (q.pos[k] - v) * a);
          if (q.fwd && e.fwd) { const f = e.fwd.map((v, k) => v + (q.fwd[k] - v) * a); const l = Math.hypot(f[0], f[1], f[2]); if (l > 1e-3) e.fwd = f.map(v => v / l); } } }
      // critters that were not in the tank yet at this moment stay out of sight
      for (const s of A.hab.data.prey) if (!inF.has(s)) { s._rpHide = s._rpHide || { buried: s.buried }; s.buried = true; }
    }
    R.step = function (dt) {
      const A = R.active; if (!A) return; if (A.hab !== (JT.app && JT.app.game.hab)) { R.stop(); return; }
      if (A.settle > 0) { A.settle -= dt; apply(0); return; } // let the camera glide onto the jumper before playing
      if (A.i < A.frames.length - 1) { const slow = A.i >= A.slowA - 4 && A.i <= A.catchI + 10; A.i = Math.min(A.frames.length - 1, A.i + dt * 30 * SPEED * (slow ? 1 : 2)); apply(A.i); }
      else { A.hold += dt; if (A.hold > 0.8) R.stop(); }
    };
    R.speed = () => SPEED;
    R.stop = function () {
      const A = R.active; if (!A) return; R.active = null; const h = A.hab;
      for (const s of h.data.prey) if (s._rpHide) { s.buried = s._rpHide.buried; delete s._rpHide; }
      for (const [list, e] of A.added) { const k = list.indexOf(e); if (k >= 0) list.splice(k, 1); }
      for (const [e, o] of A.live) { put(e, o); if (e.pos) { e._ip = e.pos.slice(); e._if = e.fwd ? e.fwd.slice() : null; } }
      A.game.state.time = A.time; const UI = JT.UI; const hud = document.getElementById('replayHud'); if (hud) hud.classList.add('hidden');
      if (UI && UI.obs) { if (!A.cam.obs) UI.toggleObserve(false); else { UI.obs.lock = A.cam.lock && h.spider(A.cam.lock) ? A.cam.lock : null; } }
      if (UI && UI.game && UI.game.hab.spider(A.sel)) UI.game.selectedId = A.sel;
    };
    return R;
  })();
  JT.Replay = Replay;
  function boot() {
    const settings = JT.Settings.load();
    const game = new JT.Game();
    let restored = false; try { restored = game.load(); } catch (e) { console.error(e); }
    if (!restored) game.newGame();
    game._biomeOnboard = !restored;
    if (game._biomeOnboard) game.state.biomeSetup = true;
    if (!game.hab.spider(game.selectedId)) game.selectedId = game.hab.spiders[0] ? game.hab.spiders[0].id : null;
    const R = new JT.Renderer(document.getElementById('view'), game, settings);
    JT.Audio.init(settings);
    JT.UI.init(game, R, settings);
    JT.app = { game, R, settings, UI: JT.UI };
    const welcome = (fresh) => setTimeout(() => { if (fresh) { game._biomeOnboard = true; if (game._biomeOnboard) game.state.biomeSetup = true; } JT.UI.toast('Welcome to the biome revamp. Choose your first jumper, then build its home or start with a recommended layout.', '', 6000); if (game.state.biomeSetup) JT.UI.biomeWizard(true); }, 600);
    const AT = { on: false, g: null }; // the start screen's live showcase (a separate, never-saved game)
    document.addEventListener('visibilitychange', () => { game.viewing = !document.hidden; if (document.hidden) game.save(); });
    { const save0 = game.save.bind(game); game.save = (...a) => { if (Replay.active) Replay.stop(); return save0(...a); }; } // never save a replay frame
    root.addEventListener('pagehide', () => game.save());
    root.addEventListener('beforeunload', () => game.save());
    const STEP = 1 / 30; let acc = 0, last = performance.now(), skip = false, cost = 8, lastDt = 0, rAcc = 0, lock30 = 0, lockEnd = -1e9, lowT = 0, perfT = 0; void lastDt; void skip;
    /* Smooth motion: the simulation steps at 30 Hz, the screen may draw at 60. Each step remembers where every critter
       was; a frame drawn between steps shows them part-way (position + facing), then the true state is put back.
       Big jumps (teleports, habitat switches) are not blended. Purely visual: the simulation never sees it. */
    const M = JT.M; const crit = () => { const h = (AT.on && AT.g ? AT.g : game).hab; return h ? h.data.spiders.concat(h.data.prey) : []; };
    function snapPrev() { for (const e of crit()) { if (!e.pos) continue; e._ip = e.pos.slice(); e._if = e.fwd ? e.fwd.slice() : null; } }
    function blendIn(a) {
      const saved = []; if (a >= 0.999) return () => {};
      for (const e of crit()) { const p0 = e._ip, p1 = e.pos; if (!p0 || !p1 || !M.finite3(p0) || !M.finite3(p1) || M.dist(p0, p1) > 8) continue;
        saved.push([e, p1, e.fwd]); e.pos = [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a];
        if (e._if && e.fwd) { const f = [e._if[0] + (e.fwd[0] - e._if[0]) * a, e._if[1] + (e.fwd[1] - e._if[1]) * a, e._if[2] + (e.fwd[2] - e._if[2]) * a]; if (M.len(f) > 1e-3) e.fwd = M.norm(f); } }
      return () => { for (const [e, p, f] of saved) { e.pos = p; e.fwd = f; } };
    }
    function frame(now) {
      let dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
      if (AT.on) { try { AT.frame(dt); } catch (e) { console.error('attract', e); AT.stop(); } requestAnimationFrame(frame); return; }
      acc += dt; let n = 0;
      if (Replay.active) { acc = 0; try { Replay.step(dt); } catch (e) { console.error('replay', e); Replay.stop(); } } // paused while a slow-motion replay plays
      else if (JT.UI.photo) acc = 0; // v11 photo mode: time stands still
      else try { while (acc >= STEP && n < 4) { snapPrev(); game.tick(STEP); Replay.record(game); acc -= STEP; n++; } if (n >= 4) acc = 0; } catch (e) { console.error('sim', e); acc = 0; }
      try { JT.UI.update(dt); JT.Audio.update(dt, game); } catch (e) { console.error('ui', e); }
      // adaptive pacing: if a frame costs too much, render at half rate (simulation keeps full rate)
      // Frame pacing. The simulation runs at 30 Hz, so redrawing faster only matters while something else moves:
      // touching / dragging, the camera gliding, Observe/Follow, placing decor. Otherwise draw once per simulation step
      // (about 30 fps), which roughly halves GPU work and heat. 'smooth' always draws (capped at 60 fps, also on
      // 120 Hz screens); 'saver' always uses 30.
      rAcc += dt; const fm = settings.fps || 'auto'; const U = JT.UI;
      let lively = fm === 'smooth' || !!Replay.active || !!U.photo || (fm === 'auto' && (performance.now() < (U._activeUntil || 0) || R._moving || !!U.obs || !!U.mode));
      // A phone that can't hold 60 (hot, Low Power Mode) gets a steady 30 instead of an uneven 35-50, which feels far worse.
      // Only once resolution is already at its floor; retried after 20 s (40 s after a repeat failure).
      if (settings.quality === 'auto' && fm !== 'smooth') { const now = performance.now();
        if (lock30 && (now > lock30 || R._unlock30)) { lock30 = 0; R.fps = 60; lowT = 0; } R._unlock30 = false;
        const floor = R.closeCam ? (R._closeK || 1.6) <= 1.25 : (R._autoLvl || 0) >= 3;
        if (!lock30 && lively && floor && R.fps < 47) { lowT += dt; if (lowT > 2.5) { lock30 = now + (now - lockEnd < 30000 ? 40000 : 20000); lowT = 0; } } else lowT = Math.max(0, lowT - dt);
        if (lock30) { lively = false; lockEnd = now; } }
      R.locked30 = !!lock30; R.targetFps = lively ? 60 : 30;
      const due = lively ? rAcc >= 1 / 62 : (n > 0 || rAcc >= 1 / 24);
      if (due) { skip = !skip;
        { const t0 = performance.now(); const undo = blendIn(Replay.active ? 1 : M.clamp(acc / STEP, 0, 1)); /* a replay draws its recorded frames as they are */ try { R.render(Replay.active ? rAcc * Replay.speed() : rAcc); } catch (e) { console.error('render', e); } finally { undo(); } rAcc = 0; const ms = performance.now() - t0; cost = cost * 0.9 + ms * 0.1; R.frameMs = cost; } }
      lastDt = dt;
      if (settings.perf) { const t = performance.now(); if (!perfT || t - perfT > 500) { perfT = t; let d = document.getElementById('perfro');
          if (!d) { d = document.createElement('div'); d.id = 'perfro'; d.style.cssText = 'position:fixed;left:calc(6px + env(safe-area-inset-left));top:calc(6px + env(safe-area-inset-top));z-index:9999;pointer-events:none;font:11px/1.35 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.55);padding:3px 6px;border-radius:6px;white-space:pre'; document.body.appendChild(d); }
          d.textContent = Math.round(R.fps) + ' fps  ' + cost.toFixed(1) + ' ms cpu\n' + R.cv.width + '\u00d7' + R.cv.height + ' @' + R.k.toFixed(2) + 'x' + (R.closeCam ? ' close' : '') + '\n' + (R.locked30 ? 'steady 30 (phone busy)' : R.targetFps === 60 ? 'target 60' : 'idle 30') + '  ' + (settings.fps || 'auto') + '  q:' + settings.quality + (['ptLowRes', 'ptNoSpr', 'ptNoInk', 'ptNoFx', 'ptNoBlur', 'ptGpuAtlas', 'ptNoReuse'].filter(k => settings[k]).map(k => ' -' + k.slice(2)).join('')) + (R.pt ? '\nscene ' + R.pt.col.toFixed(1) + '  spr ' + R.pt.spr.toFixed(1) + '  up ' + R.pt.up.toFixed(1) + '\ngl ' + R.pt.gl.toFixed(1) + '  2d ' + R.pt.ov.toFixed(1) + '  atlas ' + (R.gp ? R.gp.atlas.width + '\u00d7' + R.gp.atlas.height : '-') : ''); } }
      else if (perfT) { perfT = 0; const d = document.getElementById('perfro'); if (d) d.remove(); }
      requestAnimationFrame(frame);
    }
    /* ---------------- start screen (v9) ----------------
       Still art shows first; meanwhile a throwaway showcase game (random preset, random jumpers incl. locked species,
       never saved, never the player's tank) is built and pre-simulated, then the screen fades into live Observe-style
       close-ups. A "director" cuts every 3 s behind a soft veil (a stalk/pounce in progress earns a little more time) and
       moves to a fresh set-up every 4 shots. The next set-up is built at an earlier cut (hidden behind the veil) and
       pre-simulated in small slices, so switching never hitches on screen. Battery saver / reduced motion / no WebGL:
       the still art stays. Automated runs skip the screen unless ?splash=1 (?attract=0 keeps it still). */
    {
      const SP = document.getElementById('splash'); const force = /[?&]splash=1/.test(location.search);
      if (SP && navigator.webdriver && !force) { SP.remove(); if (!restored) welcome(false); }
      else if (!SP) { if (!restored) welcome(false); }
      else {
        const $s = (id) => document.getElementById(id);
        const go = $s('splashGo'), choices = $s('spChoices'), cont = $s('spCont'), nw = $s('spNew'), note = $s('spNote'), foot = $s('spFoot'), veil = $s('spVeil');
        const rm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const still = settings.fps === 'saver' || !R.gp || rm || /[?&]attract=0/.test(location.search);
        const rnd = Math.random, pick = (a) => a[(rnd() * a.length) | 0];
        const SHOT = 3, PER = 4;
        const sg = new JT.Game(); sg.save = () => {}; sg.checkUnlocks = () => {};
        sg.state = { v: 0, time: JT.DAY * (0.3 + rnd() * 0.32), catches: 0, species: JT.SPECIES.map(x => x.id), best: {}, journal: {}, jmeta: {}, active: 0, timeMode: 'day', customPresets: [], nextId: 5e6 + ((rnd() * 4e6) | 0), habitats: [] };
        sg.selectedId = null; AT.g = sg;
        const feedUp = (h) => { if (h.livePreyCount() < 8) { h.addPrey('fruitfly', 4); h.addPrey('gnat', 3); h.addPrey('aphid', 4); } if (rnd() < 0.25 && !h.data.prey.some(p => p.type === 'cricket')) h.addPrey('cricket', 1); };
        const build = () => {
          const P = pick(JT.PRESETS); const h = new JT.Habitat({ name: P[0], type: pick(P[2]) }, sg); JT.Presets.generate(h, P[1], (rnd() * 1e9) | 0, true);
          let ids = JT.SPECIES.filter(x => !x.hybrid || ((game.state && game.state.species) || []).includes(x.id)).map(x => x.id).sort(() => rnd() - 0.5); let n = Math.min(h.dims.cap, rnd() < 0.3 ? 1 : rnd() < 0.75 ? 2 : 3);
          if (ids[0] === 'portia') n = 1; ids = ids.filter((id, i) => i === 0 || id !== 'portia').slice(0, n); // Portia hunts other jumpers: it gets a tank to itself
          for (const id of ids) { const x = h.addSpider(id, { stage: 3 + ((rnd() * 3) | 0), sat: 0.45 + rnd() * 0.45 }); x.pos = h.randomFloorPoint(); x.sup = { k: 'floor' }; }
          feedUp(h); h._warm = 90 + ((rnd() * 240) | 0); return h; // 3-11 s of life before it is shown
        };
        const dispose = (h) => { for (const id in h.geoms) { const m = h.geoms[id]._mesh; if (m && m.gl && m.vb) try { m.gl.free(m); } catch (e) { void e; } } };
        const subject = (h, avoid) => { let best = null, bw = -1;
          for (const x of h.spiders) { const w = (1 + Math.max(0, JT.SpiderAI.interest(x) || 0) / 12 + (x.target ? 2 : 0)) * (x.id === avoid && h.spiders.length > 1 ? 0.25 : 1) * (0.6 + rnd()); if (w > bw) { bw = w; best = x; } }
          return best; };
        const frameShot = () => { // pick a jumper and a fresh angle, then let the follow camera settle while the veil is down
          const h = sg.hab; const x = subject(h, sg.selectedId); sg.selectedId = x ? x.id : null;
          for (let i = 0; i < 45; i++) R.updateView(h, 1 / 30);
          const fc = R.fcam; if (fc && fc.st) { fc.orbit((rnd() - 0.5) * 1.6, (rnd() - 0.4) * 0.28); fc.userZoom = 1.5 + rnd() * 0.8; for (let i = 0; i < 15; i++) R.updateView(h, 1 / 30); if (fc.tS > 0) { fc.st.s = fc.tS; fc.st.vs = 0; R.updateView(h, 1 / 30); } }
          AT.drift = (rnd() < 0.5 ? -1 : 1) * (0.03 + rnd() * 0.06); AT.push = (rnd() - 0.35) * 0.08; AT.t = 0; AT.ext = 0;
        };
        const cut = () => {
          AT.n++; const nx = sg.habs[1];
          if (AT.n % PER === 0 && nx && !(nx._warm > 0)) { const old = sg.habs.shift(); dispose(old); sg.state.active = 0; R.cur = null; AT.built = false; }
          else if (!AT.built && sg.habs.length < 2) { sg.habs.push(build()); AT.built = true; }
          feedUp(sg.hab); frameShot();
          requestAnimationFrame(() => requestAnimationFrame(() => { veil.classList.remove('on'); AT.veil = false; }));
        };
        AT.frame = (dt) => {
          const h0 = sg.hab; if (!h0) return;
          if (h0._warm > 0) { const t0 = performance.now(); while (h0._warm > 0 && performance.now() - t0 < 12) { h0.update(STEP, true); h0._warm--; } if (h0._warm <= 0) frameShot(); return; }
          for (const h of sg.habs) if (h !== h0 && h._warm > 0) { const t0 = performance.now(); while (h._warm > 0 && performance.now() - t0 < 3) { h.update(STEP, true); h._warm--; } }
          acc += dt; let n = 0; while (acc >= STEP && n < 4) { snapPrev(); sg.tick(STEP); acc -= STEP; n++; } if (n >= 4) acc = 0;
          // director: slow drift + gentle push while the shot runs; cut on time
          const fc = R.fcam; if (fc && fc.st && !AT.veil) { fc.orbit(AT.drift * dt, 0); fc.userZoom = M.clamp(fc.userZoom * (1 + AT.push * dt), 1.2, 2.6); }
          AT.t += dt; const end = SHOT + AT.ext;
          if (!AT.veil && AT.t >= end - 0.38) { const x = sg.hab.spider(sg.selectedId); if (!AT.ext && x && /^(stalk|crouch|pounce)$/.test(x.state)) AT.ext = 2.2; else { AT.veil = true; veil.classList.add('on'); } }
          if (AT.veil && AT.t >= end) { AT.t = -10; cut(); }
          const undo = blendIn(M.clamp(acc / STEP, 0, 1)); try { R.render(dt); } finally { undo(); }
          if (!AT.live && ++AT.frames > 3) { AT.live = true; SP.classList.add('live'); }
          try { JT.Audio.update(dt, sg); } catch (e) { void e; }
        };
        AT.start = () => {
          AT.prevMode = R.cam.mode; AT.n = 0; AT.frames = 0; AT.t = 0; AT.ext = 0; AT.veil = false; AT.built = false;
          JT.game = sg; R.game = sg; R.attract = true; R.observing = true; R.setMode('follow'); document.body.classList.add('attract'); R.resize();
          try { sg.habs = [build()]; sg.state.active = 0; } catch (e) { console.error('attract build', e); AT.stop(); return; }
          AT.on = true; acc = 0;
        };
        AT.stop = () => {
          if (!AT.g || AT.stopped) return; AT.stopped = true; AT.on = false; JT.game = game; R.game = game; R.attract = false; R.observing = false; document.body.classList.remove('attract');
          for (const h of sg.habs) dispose(h); sg.habs = []; R.setMode(AT.prevMode && AT.prevMode !== 'follow' ? AT.prevMode : 'iso'); R.resetCaches(); R.resize(); acc = 0; last = performance.now();
        };
        let sound = false; const soundOn = () => { try { JT.Audio.start(); } catch (e) { void e; } if (sound) return; sound = true; foot.textContent = 'sound on'; setTimeout(() => foot.classList.add('off'), 1800); };
        const enter = (fresh) => {
          if (SP.classList.contains('gone')) return; soundOn(); try { JT.UI.buzz && JT.UI.buzz('tap'); } catch (e) { void e; }
          if (fresh && restored) { try { game.reset(); } catch (e) { console.error(e); } }
          AT.stop(); if (fresh) { R.cur = null; try { JT.UI.refreshHeader(); } catch (e) { void e; } }
          SP.classList.add('gone'); setTimeout(() => SP.remove(), 1000);
          if (fresh || !restored) welcome(fresh && restored);
        };
        SP.addEventListener('click', soundOn);
        go.onclick = (e) => { e.stopPropagation(); soundOn(); if (!restored) { enter(false); return; } go.classList.add('sp-off'); choices.classList.remove('sp-off'); };
        cont.onclick = (e) => { e.stopPropagation(); enter(false); };
        nw.onclick = (e) => { e.stopPropagation(); soundOn();
          if (!nw._arm) { nw._arm = true; nw.classList.add('arm'); nw.textContent = 'Tap again to start over'; note.textContent = 'Your current terrarium and progress will be replaced.'; clearTimeout(nw._t);
            nw._t = setTimeout(() => { nw._arm = false; nw.classList.remove('arm'); nw.textContent = 'New game'; note.textContent = ''; }, 5000); return; }
          enter(true); };
        if (restored) { const h = game.hab, x = h && (h.spider(game.selectedId) || h.spiders[0]); $s('spContSub').textContent = (x ? x.name + ' \u00b7 ' : '') + 'Day ' + game.day(); }
        const keyH = (e) => { if (!document.getElementById('splash') || SP.classList.contains('gone')) { root.removeEventListener('keydown', keyH, true); return; }
          e.stopImmediatePropagation(); if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); soundOn();
          const a = document.activeElement; (a && a.tagName === 'BUTTON' && SP.contains(a) && !a.closest('.sp-off') ? a : go.classList.contains('sp-off') ? cont : go).click(); };
        root.addEventListener('keydown', keyH, true);
        requestAnimationFrame(() => { go.disabled = false; if (!still) setTimeout(() => AT.start(), 60); });
      }
    }
    /* ---------------- Android back button / back swipe (v10) ----------------
       One extra history step is added after the first touch. Back then closes whatever is on top (replay, tip, window,
       popover, Observe, placing mode, drawer, jumper card); with nothing open the first back only warns, and a second
       back within ~2 s leaves the app. The step is re-added on the next touch (browsers ignore steps added without one). */
    {
      const U = JT.UI; const MSG = 'Go back again to exit'; const WIN = 2200;
      let armed = false, warnAt = -1e9, warnT = 0;
      const arm = () => { if (armed || !history.pushState) return; try { history.pushState({ jt: 1 }, ''); armed = true; } catch (e) { void e; } };
      const vis = (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); };
      const closeTop = () => {
        const sp = document.getElementById('splash'); if (sp && !sp.classList.contains('gone')) return false;
        if (Replay.active) { Replay.stop(); return true; }
        if (U.photo) { U.photoMode(false); return true; }
        if (vis('tip')) { U.hideTip(false); return true; }
        if (vis('modalWrap')) { if (U._modalBack) U._modalBack(); else U.closeModal(); return true; }
        if (vis('popover')) { document.getElementById('popover').classList.add('hidden'); return true; }
        if (U.obs) { U.toggleObserve(false); return true; }
        if (U.mode) { U.endMode(); return true; }
        if (U.tab) { U.closeDrawer(); return true; }
        if (U.panelId) { U.hidePanel(); return true; }
        return false;
      };
      const warn = () => {
        warnAt = performance.now(); try { U.buzz && U.buzz('tap', true); } catch (e) { void e; }
        const sp = document.getElementById('splash'), note = document.getElementById('spNote');
        if (sp && note && !sp.classList.contains('gone')) { const prev = note.textContent === MSG ? '' : note.textContent; note.textContent = MSG; clearTimeout(warnT); warnT = setTimeout(() => { if (note.textContent === MSG) note.textContent = prev; }, WIN); }
        else U.toast(MSG, 'quiet back', WIN);
      };
      root.addEventListener('popstate', () => {
        armed = false;
        if (performance.now() - warnAt < WIN) return; // (only reached if a step was re-added during the window)
        try { if (closeTop()) { arm(); try { JT.Audio.sfx('click'); } catch (e) { void e; } return; } } catch (e) { console.error('back', e); }
        try { game.save(); } catch (e) { void e; }
        warn(); // not re-armed: the next back inside the window leaves the app
      });
      let armT = 0; const touch = () => { if (armed) return; const left = WIN - (performance.now() - warnAt); if (left <= 0) arm(); else { clearTimeout(armT); armT = setTimeout(arm, left + 30); } }; // a touch inside the exit window re-arms once it closes
      for (const ev of ['pointerdown', 'keydown']) root.addEventListener(ev, touch, true);
      JT.Back = { closeTop, arm, get armed() { return armed; } }; // for tests
    }
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
