/* Jumper Terrarium — jumping spider runtime state + behavior AI.
   Explicit priority model (higher wins; lower-priority decisions can never overwrite a higher route):
     molting 95 > premolt 90 > molt retreat 80-85 > pounce/fall 75 > held meal (subdue/carry/feed) 70
     > threat/flee 60 > thirst 50 > hunting 40-42 > hungry search 35 > sleep 30 > social 20
     > curiosity 15 > post-feed rest 10 > exploration/grooming/rest 0-5.
   Hunting: notice -> assess -> stalk (replans) -> creep -> crouch -> pounce -> catch/miss
            -> subdue -> carry (to a reachable safe spot) -> feed -> rest. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, Nav = JT.Nav, Loco = JT.Loco;
  const AI = JT.SpiderAI = {};
  const DAY = 480;
  const PRI = AI.PRI = { idle: 0, explore: 2, lookout: 3, groom: 3, rest: 3, patrol: 34, watch: 4, display: 20, social: 20, avoid: 22,
    investigate: 15, inspect: 15, postFeed: 10, search: 35, sleepSeek: 30, sleep: 30,
    cleanEyes: 3, look: 3, scuttle: 3, stretch: 5, homeSeek: 3, baskSeek: 12, bask: 12, dangle: 45, scan: 34, lunge: 36,
    notice: 40, assess: 40, stalk: 40, creep: 41, crouch: 42, track: 40,
    drinkSeek: 50, drink: 50, flee: 60, pounce: 75, fall: 75, subdue: 70, carry: 70, feed: 70,
    moltSeek: 80, moltSilk: 85, premolt: 90, molting: 95, postMolt: 85, emerge: 86 };
  const HUNT = new Set(['notice', 'assess', 'stalk', 'creep', 'crouch', 'track']);
  const MOLT = new Set(['moltSeek', 'moltSilk', 'premolt', 'molting', 'postMolt']);
  AI.HUNT = HUNT; AI.MOLT = MOLT;

  JT.PREY_BY_ID.jumperMeal = { id: 'jumperMeal', name: 'jumper', shape: 'spider', len: 6, nut: 0.8, val: 25, struggle: 6, huntable: false };

  const sp_ = (sp) => JT.SPECIES_BY_ID[sp.species] || JT.SPECIES[0];
  AI.len = (sp) => sp_(sp).len * JT.STAGE_SCALE[M.clamp(sp.stage, 0, 5)];
  AI.jump = (sp) => (14 + AI.len(sp) * 3.0) * (0.75 + sp.traits.jump * 0.4) * (sp.soft > 0 ? 0.7 : 1) * elder(sp);
  AI.speed = (sp) => (9 + AI.len(sp) * 0.9) * (0.7 + sp.pers.activity * 0.5) * elder(sp) * (sp.soft > 0 ? 0.6 : 1);
  function elder(sp) { return sp.stage === 5 && sp.adultDays > 20 ? Math.max(0.8, 1 - (sp.adultDays - 20) * 0.006) : 1; }
  AI.caps = (sp, carry) => ({ jump: AI.jump(sp) * (carry ? 0.6 : 1), climb: true, drop: true, carry: !!carry });
  AI.hungerLabel = (s) => s > 0.85 ? 'Full & Round' : s > 0.6 ? 'Content' : s > 0.35 ? 'Peckish' : 'Hungry';
  AI.moltNeed = (sp) => 3 + sp.stage;
  AI.STARVING = 0.15;
  /** Live food this jumper will actually go after. Cleanup crew is ignored unless the jumper is starving. */
  AI.huntableFor = (sp, d) => !!d && (d.huntable || (d.id === 'springtail' && sp.sat < AI.STARVING));
  AI.nutOf = (d) => d ? (d.nut || (d.id === 'springtail' ? 0.05 : 0)) : 0;
  /** Is there anything left in the habitat this jumper could eat? */
  AI.preyAvailable = (hab, sp) => hab.data.prey.some(p => !p.owner && !p.buried && !p.dead && AI.huntableFor(sp, JT.PREY_BY_ID[p.type]));
  AI.hungerLevel = (sp) => sp.sat < 0.2 ? 2 : sp.sat < 0.4 ? 1 : 0;

  function usedNames() { const s = new Set(); if (JT.game) for (const h of JT.game.habs) for (const x of h.data.spiders) s.add(x.name); return s; }
  AI.create = function (hab, speciesId, o) {
    const S = JT.SPECIES_BY_ID[speciesId] || JT.SPECIES[0]; const R = JT.R;
    const jit = (v, a) => M.clamp(v + (R() - 0.5) * 2 * a, 0.02, 1);
    const used = usedNames(); const free = JT.NAMES.filter(n => !used.has(n));
    const pos = o.pos || hab.randomFloorPoint();
    const sp = {
      id: JT.newId('s'), species: S.id, name: o.name || (free.length ? R.pick(free) : R.pick(JT.NAMES) + ' ' + (2 + Math.floor(R() * 8))),
      seed: (R() * 1e9) | 0, stage: o.stage != null ? o.stage : (S.minStage != null ? S.minStage : 1), meals: o.meals || Math.floor(R() * 2), molts: 0,
      ageDays: 0, adultDays: 0, sat: o.sat != null ? o.sat : 0.7, hyd: 0.85, catches: 0, soft: 0,
      traits: { stealth: jit(S.traits.stealth, .12), patience: jit(S.traits.patience, .15), jump: jit(S.traits.jump, .1), bold: jit(S.traits.bold, .15), tactics: jit(S.traits.tactics, .12) },
      pers: { curiosity: jit(0.5, .4), activity: jit(S.prefs.activity, .15), territorial: jit(0.4, .35), cannibal: jit(0.25 * S.traits.bold + 0.1, .2), twitch: jit(0.4, .3), routine: jit(0.5, .4), humid: jit(0.5, .4) },
      obsT: 0, stats: { hunts: 0, waits: 0, explores: 0, displays: 0, misses: 0, rests: 0 },
      pos: pos.slice(), sup: o.sup || { k: 'floor' }, fwd: [1, 0, 0], state: 'idle', st: 0, thought: 'Settling in and looking around.',
      hold: null, target: null, threat: null, retreat: null,
      mem: { misses: 0, failPos: null, lastStrategy: null, ignore: {}, success: {} },
    };
    if (sp.stage === 5) sp.adultDays = 0;
    return sp;
  };

  function setState(sp, s, thought) { sp.state = s; sp.st = 0; if (thought) sp.thought = thought; }
  AI.setState = setState;
  AI.reset = function (hab, sp, thought) { sp._route = null; sp._plan = null; if (sp.state !== 'pounce' && sp.state !== 'fall') { setState(sp, 'idle', thought || sp.thought); } };
  AI.dropTarget = function (hab, sp) {
    if (sp.target && sp.target.kind === 'spider') { const v = hab.spider(sp.target.id); if (v && v.threat === sp.id) v.threat = null; }
    sp.target = null; sp._plan = null;
    if (HUNT.has(sp.state)) { sp._route = null; setState(sp, 'idle'); }
  };
  function targetEnt(hab, sp) { if (!sp.target) return null; return sp.target.kind === 'spider' ? hab.spider(sp.target.id) : hab.preyById(sp.target.id); }
  AI.targetEnt = targetEnt;
  function targetDef(hab, sp, t) {
    if (sp.target.kind === 'spider') { const L = AI.len(t); return { name: t.name + ' the ' + sp_(t).name.toLowerCase(), len: L, nut: 0.25 + L * 0.05, val: 30, struggle: 6, reflex: 0.5, danger: 0.3, sense: 40 }; }
    return JT.PREY_BY_ID[t.type];
  }
  function preyName(d) { const n = d.name.toLowerCase(); return n.replace(/ies$/, 'y').replace(/s$/, '').replace('fruit fly', 'fruit fly').replace('dubia nymph', 'dubia nymph'); }
  AI.preyName = preyName;
  function decorName(hab, id) { const inst = id && hab.decorById(id); return inst ? JT.DECOR_BY_ID[inst.type].name.toLowerCase() : null; }

  function faceToward(sp, target, dt, rate) {
    const d = M.sub(target, sp.pos); d[1] = 0; if (M.len(d) < 1e-3) return;
    const want = M.norm(d); const f = sp.fwd || [1, 0, 0];
    const k = Math.min(1, dt * (rate || 4));
    sp.fwd = M.norm([M.lerp(f[0], want[0], k), sp.sup.k === 'path' ? f[1] * (1 - k) : 0, M.lerp(f[2], want[2], k)]);
  }
  function horiz(v) { return M.norm([v[0], 0, v[2]]); }

  // ---------------- needs ----------------
  function needs(hab, sp, dt) {
    const sleeping = sp.state === 'sleep' || sp.state === 'premolt' || sp.state === 'molting';
    sp.sat = Math.max(0, sp.sat - dt * 0.0016 * (sleeping ? 0.35 : 1));
    sp.hyd = Math.max(0, sp.hyd - dt * 0.0011 * (1.3 - hab.data.humidity * 0.6));
    sp.ageDays += dt / DAY;
    if (sp.stage === 5) { sp.adultDays = (sp.adultDays || 0) + dt / DAY; if (sp.adultDays > 12 && !sp.veteran) { sp.veteran = true; hab.event('journal', { id: 'veteran', sp }); } }
    if (sp.soft > 0) sp.soft = Math.max(0, sp.soft - dt);
    for (const k in sp.mem.ignore) if (sp.mem.ignore[k] < hab.time) delete sp.mem.ignore[k];
  }
  AI.moltReady = (sp) => sp.stage < 5 && sp.meals >= AI.moltNeed(sp) && sp.sat >= 0.45 && !MOLT.has(sp.state);

  // ---------------- perception ----------------
  function perceive(hab, sp) {
    const seen = sp._seen || (sp._seen = {}); const now = hab.time;
    for (const k in seen) if (now - seen[k] > 10) delete seen[k];
    const R0 = 70 + sp.traits.tactics * 35; const f = horiz(sp.fwd || [1, 0, 0]);
    const veryHungry = sp.sat < 0.28;
    const consider = (e, isSpider) => {
      const d = M.dist(sp.pos, e.pos); if (d > R0 * (veryHungry ? 1.7 : 1)) return;
      const to = horiz(M.sub(e.pos, sp.pos)); const c = M.dot(f, to);
      const ang = c > 0.5 ? 1 : c > -0.2 ? 0.55 : 0.22;
      const v = e._vel ? Math.hypot(e._vel[0], e._vel[1], e._vel[2]) : 0;
      const motion = v > 1 ? 1 : 0.28;
      const cover = Nav.coverAt(hab, e.pos);
      const covF = 1 - cover * (motion > 0.5 ? 0.45 : 0.85);
      const distF = Math.max(0, 1 - d / (R0 * (veryHungry ? 1.7 : 1)));
      let p = ang * motion * covF * (0.35 + distF) * 1.4;
      if (veryHungry && motion > 0.5) p = Math.max(p, 0.5); // vibration/motion sense when starving
      if (e.sup && e.sup.k === 'air') p *= 0.8;
      if (JT.R() < p) { if (!seen[e.id]) sp._noticedAt = now; seen[e.id] = now; }
    };
    for (const p of hab.data.prey) { if (p.owner || p.buried || p.dead) continue; const d = JT.PREY_BY_ID[p.type]; if (!AI.huntableFor(sp, d)) continue; consider(p); }
    if (sp.sat < 0.32 && sp.pers.cannibal > 0.5) for (const o of hab.data.spiders) if (o !== sp && !MOLT.has(o.state) || (o !== sp && o.soft > 0)) consider(o, true);
  }
  function scoreTarget(hab, sp, e, isSpider) {
    const def = isSpider ? null : JT.PREY_BY_ID[e.type];
    const L = AI.len(sp); const pl = isSpider ? AI.len(e) : def.len; const ratio = pl / L;
    const hungry = sp.sat < 0.35; const starving = sp.sat < 0.18;
    const maxR = 0.9 + sp.traits.bold * 0.8 + (hungry ? 0.3 : 0) + (starving ? 0.2 : 0);
    if (ratio > maxR) return -1;
    const crumbs = !isSpider && !def.huntable; // springtails: only worth it when starving
    if (ratio < 0.08 && L > 6 && !crumbs) return -1;
    let danger = (isSpider ? 0.4 : def.danger) * ratio; if (isSpider && e.soft > 0) danger *= 0.3;
    if (danger > sp.traits.bold * 0.8 + (hungry ? 0.3 : 0)) return -1;
    if (isSpider) { const el = AI.len(e); if (!(L > el * 1.35 || (e.soft > 0 && L > el * 0.95))) return -1; }
    const d = M.dist(sp.pos, e.pos);
    const nut = isSpider ? 0.6 : AI.nutOf(def);
    let s = nut * 10 - d * 0.04 - danger * 5 + (ratio > 0.25 && ratio < 1 ? 2 : 0) + (crumbs ? 2.5 : 0);
    const v = e._vel ? M.len(e._vel) : 0; if (v > 1) s += 1;
    if (sp.mem.ignore[e.id] && !starving) s -= 8;
    if (e.sup && e.sup.k === 'air') s -= 1.5;
    if (isSpider) s -= 2;
    return s;
  }
  function chooseTarget(hab, sp) {
    const seen = sp._seen || {}; let best = null, bs = 0.5;
    const J = AI.jump(sp);
    const opportunist = sp.sat >= 0.62 && sp.sat < 0.86;
    if (sp.sat >= 0.86) return null;
    for (const id in seen) {
      let e = hab.preyById(id), isS = false; if (!e) { e = hab.spider(id); isS = !!e; } if (!e || e === sp) continue;
      if (!isS && (e.owner || e.buried)) continue;
      if (opportunist && (isS || M.dist(sp.pos, e.pos) > J * 0.9 || JT.R() > 0.3 + sp.traits.bold * 0.3)) continue;
      const sc = scoreTarget(hab, sp, e, isS); if (sc > bs) { bs = sc; best = { kind: isS ? 'spider' : 'prey', id: e.id, since: hab.time }; }
    }
    return best;
  }

  // ---------------- threat ----------------
  function detectThreat(hab, sp) {
    if (sp.threat) { const h = hab.spider(sp.threat); if (h && h.target && h.target.id === sp.id && M.dist(h.pos, sp.pos) < 50) { const p = 0.25 + (h._moving ? 0.35 : 0) + (1 - h.traits.stealth) * 0.2; if (JT.R() < p) return h; } }
    for (const o of hab.data.spiders) {
      if (o === sp || MOLT.has(o.state)) continue;
      const d = M.dist(o.pos, sp.pos); if (d > 18) continue;
      if (AI.len(o) > AI.len(sp) * 1.6 && (o._moving || HUNT.has(o.state)) && sp.traits.bold < 0.85) return o;
    }
    return null;
  }

  // ---------------- decision core ----------------
  AI.decide = function (hab, sp) {
    const cur = PRI[sp.state] || 0;
    if (cur >= 70) return;                                  // molt / held meal / airborne manage themselves
    if (sp._air) return;                                    // mid-jump along a route: finish the leap first
    if (sp.state === 'sleep' && sp.nest) return;           // sealed in for the night: wakes only via its own handler (and carves out)
    if (AI.moltReady(sp)) { startMoltSeek(hab, sp); return; }
    const th = detectThreat(hab, sp);
    if (th && cur < 60) { startFlee(hab, sp, th); return; }
    if (cur >= 60) return;
    if (sp.hyd < 0.3 && cur < 50 && !(sp._drinkFail > hab.time)) { if (startDrink(hab, sp)) return; }
    if (cur >= 50) return;
    const canHunt = sp.soft < 40;
    if (canHunt) perceive(hab, sp);
    if (canHunt && cur < 40) {
      const t = chooseTarget(hab, sp);
      if (t) { startNotice(hab, sp, t); return; }
      if (sp.sat < 0.4) {
        const avail = AI.preyAvailable(hab, sp);
        if (avail && cur < 35 && !(sp._searchCD > hab.time)) { startSearch(hab, sp); return; }
        if (!avail && cur < 34 && !(sp._patrolCD > hab.time) && !(sp.state === 'sleep' && sp.st < 20)) { if (startPatrol(hab, sp)) return; }
      }
    }
    if (cur >= 35) return;
    const dl = hab.daylight();
    if (dl < 0.2 && sp.sat > 0.3 && cur < 30 && sp.state !== 'sleep') { startSleep(hab, sp); return; }
    if (cur >= 30) return;
    if (cur < 12 && AI.wantsWarmth(hab, sp) && startBask(hab, sp)) return;
    if (cur < 20 && social(hab, sp)) return;
    if (cur < 15 && curiosity(hab, sp)) return;
    if (sp.state === 'idle') pickIdle(hab, sp);
  };

  // ---------------- main update ----------------
  AI.update = function (hab, sp, dt) {
    needs(hab, sp, dt);
    sp.st += dt;
    sp._thinkT = (sp._thinkT || 0) - dt;
    if (sp._thinkT <= 0) { sp._thinkT = 0.3 + JT.R() * 0.25; AI.decide(hab, sp); }
    const h = H[sp.state] || H.idle;
    const before = sp.pos.slice();
    h(hab, sp, dt);
    const moved = M.dist(before, sp.pos); sp._walk = (sp._walk || 0) + moved / Math.max(0.5, AI.len(sp) * 0.32);
    sp._moving = moved > 0.02;
    sp._speedNow = M.dist(before, sp.pos) / Math.max(dt, 1e-3);
    // a route jump/drop abandoned mid-air (state changed, route cleared or replaced) must never leave the spider hanging
    if (sp._air && sp._air.mode && sp.state !== 'pounce' && sp.state !== 'fall' && (!sp._route || sp._route.steps[sp._route.i] !== sp._air.step)) { sp._air = null; sp.sup = { k: 'air' }; }
    if (sp.sup && sp.sup.k === 'air' && !sp._air && sp.state !== 'pounce' && sp.state !== 'fall') startFall(hab, sp);
    if (!M.finite3(sp.pos)) { const b = Nav.supportBelow(hab, [hab.dims.w / 2, 0, hab.dims.d / 2]); sp.pos = b.pos; sp.sup = b.sup; sp._route = null; setState(sp, 'idle'); }
    if (sp.hold) { const p = hab.preyById(sp.hold); if (p) { p.pos = AI.mouth(hab, sp); p.sup = JT.deepClone(sp.sup); p.fwd = sp.fwd; } }
    // micro animation drivers
    sp._breath = (sp._breath || 0) + dt * (sp.state === 'sleep' ? 1.2 : 2.4);
    const sneak = sp.state === 'stalk' || sp.state === 'creep';
    if (!sneak && sp.state !== 'crouch') { sp._low = 0; sp._watched = 0; }
    sp._crouch = M.lerp(sp._crouch || 0, sp.state === 'crouch' ? 1 : sneak ? (sp._low ? 0.85 : 0.35) : 0, Math.min(1, dt * 4));
    const raise = (HUNT.has(sp.state) && sp.state !== 'assess') || sp.state === 'display' || sp.state === 'inspect' || sp.state === 'watch' ? 1 : 0;
    sp._legRaise = M.lerp(sp._legRaise || 0, raise, Math.min(1, dt * 5));
    if (sp.state === 'lunge' && sp.st < 0.3) sp._crouch = M.lerp(sp._crouch, 1, Math.min(1, dt * 10));
    if (sp._prepT > 0) sp._crouch = M.lerp(sp._crouch, 0.55, Math.min(1, dt * 8));
    if (sp.state === 'scan' || sp.state === 'lunge') sp._legRaise = M.lerp(sp._legRaise, sp.state === 'lunge' ? 1 : 0.45, Math.min(1, dt * 5));
    // body condition: the abdomen slims down when hungry and plumps up after a meal (eased, never pops)
    const fatT = M.clamp(0.68 + Math.min(1.05, sp.sat) * 0.55, 0.68, 1.26);
    sp._fatNow = sp._fatNow == null ? fatT : M.lerp(sp._fatNow, fatT, Math.min(1, dt * 0.5));
    sp._flat = M.lerp(sp._flat || 0, sp.state === 'bask' ? 1 : 0, Math.min(1, dt * 1.6));
    sp._stretchK = M.lerp(sp._stretchK || 0, sp.state === 'stretch' ? 1 : 0, Math.min(1, dt * 3));
    sp._wipe = M.lerp(sp._wipe || 0, sp.state === 'cleanEyes' ? 1 : 0, Math.min(1, dt * 4));
    sp._dangleVis = M.lerp(sp._dangleVis || 0, sp.state === 'dangle' ? (sp._dangleK || 0) : 0, Math.min(1, dt * (sp.state === 'dangle' ? 6 : 2.5)));
    if (sp.state !== 'dangle' && sp._dangleVis < 0.01) sp._dangleOff = null;
    // palp flicks: little twitches, more often while alert
    sp._flickT = (sp._flickT == null ? JT.R() * 4 : sp._flickT) - dt;
    if (sp._flickT <= 0) { sp._flickT = (HUNT.has(sp.state) || sp.state === 'scan' ? 0.8 : 2.5) + JT.R() * 5; if (!NEST_STATES.has(sp.state) && sp.state !== 'feed') sp._flick = 1; }
    sp._flick = Math.max(0, (sp._flick || 0) - dt * 2.6);
    if (sp.state !== 'scan' && sp.state !== 'look') sp._gazeT = (sp._gazeT || 0) - dt; if (sp._gazeT <= 0) { sp._gazeT = 0.6 + JT.R() * 2.5; sp._gaze = (JT.R() - 0.5) * 0.7 * (1 - (sp._legRaise || 0)); }
    sp._gazeNow = M.lerp(sp._gazeNow || 0, sp._gaze || 0, Math.min(1, dt * 8));
  };
  AI.mouth = function (hab, sp) {
    const fr = Nav.supFrame(hab, sp.sup); const L = AI.len(sp);
    return M.add(M.add(sp.pos, M.mul(sp.fwd || [1, 0, 0], L * 0.55)), M.mul(fr.n, L * 0.08));
  };

  function move(hab, sp, dt, mult, urgent) {
    // a short pause to dab a silk safety line onto the surface before each jump along a route
    const R = sp._route;
    if (!urgent && R && !sp._air && R.steps[R.i] && R.steps[R.i].mode === 'jump') {
      const st = R.steps[R.i];
      if (sp._prepStep !== st) { sp._prepStep = st; sp._prepT = 0.28 + JT.R() * 0.22; sp._routeStart = (sp._routeStart || hab.time) + sp._prepT; }
      if (sp._prepT > 0) { sp._prepT -= dt; faceToward(sp, st.pos, dt, 6); return 'moving'; }
    } else sp._prepT = 0;
    return Loco.follow(hab, sp, dt, AI.speed(sp) * (mult || 1), {
      onLaunch: (st) => { if (st.mode === 'jump') { sp._anchor = sp.pos.slice(); hab.event('jump', { sp }); } },
      onLand: (st) => { if (sp._anchor) { hab.addSilk(sp._anchor, sp.pos, 'drag'); sp._anchor = null; hab.event('journal', { id: 'safety', sp, soft: true }); } },
      onStep: (d, dir) => { if (JT.R() < 0.12) hab.nudge(d, dir[0] * AI.len(sp) * 0.08, dir[2] * AI.len(sp) * 0.08); },
    });
  }
  function routeTo(hab, sp, gsup, gpos, carry) { const r = Nav.route(hab, sp.sup, sp.pos, gsup, gpos, AI.caps(sp, carry)); sp._route = r; sp._routeStart = hab.time; return r; }
  function stuck(hab, sp) { const r = sp._route; if (!r) return false; const expect = (r.cost || 10) / Math.max(1, AI.speed(sp) * 0.4) + 6; return hab.time - (sp._routeStart || 0) > expect * 2.2; }

  // ---------------- state handlers ----------------
  const H = AI.H = {};
  H.idle = function (hab, sp, dt) { if (sp.st > 0.8 + sp.traits.patience) pickIdle(hab, sp); };
  function pickIdle(hab, sp) {
    const S = sp_(sp); let r = JT.R();
    const act = sp.pers.activity, pat = sp.traits.patience;
    const restless = AI.hungerLevel(sp) >= 2;
    if (restless) r = 0.3 + r * 0.7; // very hungry: little grooming or resting, more wandering
    if (sp.hyd < 0.72 && hab.data.drops.length && JT.R() < 0.4 && !(sp._drinkFail > hab.time) && startDrink(hab, sp, 140)) return;
    if (S.prefs.display > 0.7 && r < 0.08) { setState(sp, 'display', 'Performing a little leg-waving dance.'); sp.stats.displays++; hab.event('journal', { id: 'display', sp }); return; }
    if (r < 0.18 + (1 - act) * 0.1) {
      if (JT.R() < 0.5) setState(sp, 'cleanEyes', 'Wiping its big front eyes with its front legs.');
      else setState(sp, 'groom', JT.R() < 0.5 ? 'Cleaning its palps.' : 'Grooming its legs, one at a time.');
      return;
    }
    if (r < 0.36) {
      const k = JT.R();
      if (k < 0.18 && startDangle(hab, sp)) return;
      if (k < 0.5 && startScuttle(hab, sp)) return;
      startLook(hab, sp); return;
    }
    if (r < 0.42 + pat * 0.15 && !restless) {
      if (sp.home && !Nav.validSup(hab, sp.home.sup)) sp.home = null;
      if (sp.home && M.dist(sp.home.pos, sp.pos) > 14 && JT.R() < 0.35 + sp.pers.routine * 0.4) {
        const r3 = routeTo(hab, sp, sp.home.sup, sp.home.pos); if (r3) { setState(sp, 'homeSeek', 'Heading back to its favourite spot.'); return; }
      }
      if (!sp.home && Nav.coverAt(hab, sp.pos) > 0.35 && sp.sup.k !== 'air') AI.setHome(hab, sp);
      const atHome = sp.home && M.dist(sp.home.pos, sp.pos) < 6;
      setState(sp, 'rest', atHome ? 'Resting at its favourite spot.' : pat > 0.6 ? 'Sitting perfectly still, watching.' : 'Pausing for a moment.'); sp.stats.rests++; return;
    }
    // explore / lookout: choose a reachable destination weighted by species/individual preferences
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp));
    const nodes = hab.nav.nodes; let best = null, bs = -1e9; const H0 = hab.dims.h;
    for (let k = 0; k < 40; k++) {
      const n = nodes[Math.floor(JT.R() * nodes.length)]; if (!n || n.kind === 'face' || !isFinite(dj.dist[n.id])) continue;
      if (M.dist(n.pos, sp.pos) < 8) continue;
      const g = n.decor && hab.geoms[n.decor]; const plant = g && g.def.cat === 'plants';
      const s = S.prefs.height * (n.y / H0) * 5 + S.prefs.foliage * (plant ? 2.5 : 0) + (n.perch ? 1 : 0) + JT.R() * 2.5 - dj.dist[n.id] * 0.015 * (1.2 - act) + Nav.coverAt(hab, n.pos) * (1 - sp.traits.bold);
      if (s > bs) { bs = s; best = n; }
    }
    if (best) {
      const r2 = Nav.buildRoute(hab, dj, best.sup, best.pos); if (r2) { sp._route = r2; sp._routeStart = hab.time; sp.stats.explores++;
        const high = best.y > 18; const dn = decorName(hab, best.decor);
        setState(sp, 'explore', high ? (dn ? 'Heading up the ' + dn + ' for a better view.' : 'Looking for a higher lookout.') : (dn ? 'Exploring around the ' + dn + '.' : 'Patrolling the substrate.'));
        sp._lookout = high; return; }
    }
    setState(sp, 'rest', 'Sitting still, taking everything in.');
  }
  H.explore = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.8);
    if (r === 'done' || r === 'none') { sp._route = null; setState(sp, 'lookout', sp._lookout ? 'Watching from a high lookout.' : 'Scanning the habitat.'); }
    else if (stuck(hab, sp)) { sp._route = null; setState(sp, 'idle'); }
  };
  H.patrol = H.explore;
  H.lookout = function (hab, sp, dt) { if (sp.st > (3 + sp.traits.patience * 7) * (AI.hungerLevel(sp) >= 2 ? 0.4 : 1)) setState(sp, 'idle'); };
  H.groom = function (hab, sp, dt) { if (sp.st > 2 + JT.R() * 0.02 + sp.pers.routine * 2) setState(sp, 'idle'); };
  H.rest = function (hab, sp, dt) { const home = sp.home && M.dist(sp.home.pos, sp.pos) < 6; if (sp.st > (2 + sp.traits.patience * 6) * (home ? 2.2 : 1)) setState(sp, 'idle'); };
  H.watch = function (hab, sp, dt) { if (sp._watchPos) faceToward(sp, sp._watchPos, dt, 3); if (sp.st > 2.5) setState(sp, 'idle'); };
  H.display = function (hab, sp, dt) { if (sp._watchPos) faceToward(sp, sp._watchPos, dt, 3); if (sp.st > 3.5) { setState(sp, 'idle'); sp._watchPos = null; } };
  H.postFeed = function (hab, sp, dt) { if (sp.st > 6 + sp.traits.patience * 8) setState(sp, 'groom', 'Cleaning up after its meal.'); };

  // ---- hunting ----
  function startNotice(hab, sp, t) {
    sp._route = null; sp.target = t; sp._plan = null; sp._replans = 0;
    const e = targetEnt(hab, sp); const d = targetDef(hab, sp, e);
    if (t.kind === 'spider') e.threat = sp.id;
    sp.stats.hunts++;
    setState(sp, 'notice', sp.sat < 0.35 ? 'Hungry — actively hunting the ' + preyName(d) + '.' : 'Noticed the ' + preyName(d) + '.');
    sp._noticeDur = (0.35 + sp.traits.patience * 1.1) * (0.45 + Math.min(1, sp.sat));
  }
  H.notice = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    faceToward(sp, e.pos, dt, 5);
    if (sp.st > sp._noticeDur) setState(sp, 'assess');
  };
  function predict(hab, sp, e, horizon) {
    const v = e._vel || [0, 0, 0]; let off = M.mul(v, horizon); const L = M.len(off); if (L > 25) off = M.mul(off, 25 / L);
    if (!e.sup || e.sup.k === 'path' || e.sup.k === 'air') return { pos: e.sup && e.sup.k === 'air' ? M.add(e.pos, off) : e.pos.slice(), sup: e.sup ? JT.deepClone(e.sup) : { k: 'floor' } };
    const p = M.add(e.pos, off); const key = Nav.regionKey(e.sup); const r = hab.nav.regions[key];
    let [x, z] = key === 'F' ? Nav.clampInside(hab, p[0], p[2], 3) : JT.G.clampIntoPoly(p[0], p[2], r.poly, 0.9);
    if (r && r.obstacles.some(o => JT.G.pointInPoly(x, z, o))) { x = e.pos[0]; z = e.pos[2]; }
    return { pos: [x, e.pos[1], z], sup: JT.deepClone(e.sup) };
  }
  function effJump(sp, tpos) { const J = AI.jump(sp); const dh = sp.pos[1] - tpos[1]; return dh >= 0 ? J + M.clamp(dh * 0.35, 0, 14) : J - Math.min(J * 0.6, -dh * 0.8); }

  /** Tactical planning: score reachable staging/launch candidates (graph + ring points around predicted prey). */
  function planHunt(hab, sp) {
    const e = targetEnt(hab, sp); if (!e) return null; const def = targetDef(hab, sp, e);
    const J = AI.jump(sp), T = sp.traits, S = sp_(sp);
    const pred = predict(hab, sp, e, 0.3 + T.tactics * 1.0);
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp));
    const heading = e.fwd ? horiz(e.fwd) : [1, 0, 0];
    const misses = sp.mem.misses || 0; const shift = misses >= 2 ? 1.6 : 1;
    const hungerW = sp.sat < 0.35 ? 1.6 : 1;
    const cands = [];
    for (const n of hab.nav.nodes) {
      if (n.kind === 'face' || !isFinite(dj.dist[n.id])) continue;
      const d = M.dist(n.pos, pred.pos); const ej = J + M.clamp((n.pos[1] - pred.pos[1]) * 0.35, 0, 14);
      if (d < J * 0.25 || d > ej * 0.92) continue;
      cands.push({ sup: n.sup, pos: n.pos, cost: dj.dist[n.id], node: n });
    }
    // ring points on the prey's own open region (direct / rear approaches on the ground)
    const rk = pred.sup && Nav.regionKey(pred.sup);
    if (rk && hab.nav.regions[rk]) {
      const r = hab.nav.regions[rk];
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2; const rr = J * 0.62;
        let x = pred.pos[0] + Math.cos(a) * rr, z = pred.pos[2] + Math.sin(a) * rr;
        if (rk === 'F' ? !Nav.inside(hab, x, z, 3) : !JT.G.pointInPoly(x, z, r.poly)) continue;
        if (r.obstacles.some(o => JT.G.pointInPoly(x, z, o))) continue;
        const pos = [x, r.y, z]; const gc = Nav.goalCost(hab, dj, pred.sup, pos); if (!gc) continue;
        cands.push({ sup: JT.deepClone(pred.sup), pos, cost: gc.cost, ring: true });
      }
    }
    if (!cands.length) return null;
    let best = null, bs = -1e9;
    for (const c of cands) {
      const toC = horiz(M.sub(c.pos, pred.pos)); const behind = -M.dot(heading, toC);
      const cover = Nav.coverAt(hab, c.pos);
      const elev = c.pos[1] - pred.pos[1];
      let s = -c.cost * 0.05 * (1.1 - T.patience * 0.5) * hungerW;
      s += behind > 0.3 ? S.prefs.rear * 5 * shift * (0.6 + T.stealth * 0.6) : 0;
      s -= behind < -0.6 ? T.stealth * 2.2 : 0;
      s += cover * 2.5 * T.stealth;
      if (elev > 6) s += (S.prefs.height * 2.5 + T.tactics * 1.5) * (misses >= 2 ? 1.4 : 1);
      if (elev < -12) s -= 2;
      const dd = M.dist(c.pos, pred.pos) / J; s -= Math.abs(dd - 0.6) * 2;
      if (sp.mem.failPos && M.dist(c.pos, sp.mem.failPos) < 14) s -= 3;
      if (e._vel && M.len(e._vel) > 2 && M.dist(c.pos, pred.pos) < M.dist(c.pos, e.pos)) s += T.tactics * 2;
      if (sp.pos[1] > 10 && c.pos[1] < 2 && elev < 2) s -= 2.5 * (sp.pos[1] / 30); // don't descend needlessly
      s += (JT.R() - 0.5) * 0.6 * (1 - T.tactics);
      c.score = s; c.behind = behind; c.elev = elev; c.cover = cover;
      if (s > bs) { bs = s; best = c; }
    }
    const route = Nav.buildRoute(hab, dj, best.sup, best.pos); if (!route) return null;
    const nDecor = Nav.routeDecorCount(route);
    let strat = 'direct';
    if (best.elev > 6) strat = 'high'; else if (best.behind > 0.3 && S.prefs.rear > 0.4) strat = 'rear'; else if (best.cover > 0.4) strat = 'cover';
    if (e._vel && M.len(e._vel) > 2 && T.tactics > 0.55) strat = strat === 'direct' ? 'intercept' : strat;
    if (nDecor >= 2) strat = strat === 'direct' ? 'stepping' : strat;
    return { route, strat, pred: pred.pos, nDecor, target: best, name: preyName(def) };
  }
  function stratThought(p, sp) {
    switch (p.strat) {
      case 'high': return p.nDecor >= 2 ? 'Using ' + p.nDecor + ' habitat surfaces as stepping stones to get above the ' + p.name + '.' : 'Looking for a higher ambush above the ' + p.name + '.';
      case 'rear': return 'Circling behind the ' + p.name + '.';
      case 'cover': return 'Using nearby decor as cover to sneak up on the ' + p.name + '.';
      case 'intercept': return 'Reading where the ' + p.name + ' is heading.';
      case 'stepping': return 'Using ' + p.nDecor + ' habitat surfaces as stepping stones toward the ' + p.name + '.';
      default: return sp.sat < 0.35 ? 'Hungry — closing in on the ' + p.name + '.' : 'Stalking the ' + p.name + '.';
    }
  }
  H.assess = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    faceToward(sp, e.pos, dt, 4);
    if (e.sup && e.sup.k === 'air') { setState(sp, 'track', 'Tracking the ' + preyName(targetDef(hab, sp, e)) + ' in the air — waiting for it to land.'); return; }
    const d = M.dist(sp.pos, e.pos);
    if (d <= effJump(sp, e.pos) * 0.85 && sp.sup.k !== 'air') { startCrouch(hab, sp); return; }
    const plan = planHunt(hab, sp);
    if (!plan) {
      sp.mem.ignore[e.id] = hab.time + 15; setState(sp, 'watch', 'Watching the ' + preyName(targetDef(hab, sp, e)) + ' — no way to reach it from here.'); sp._watchPos = e.pos.slice(); sp.target = null; return;
    }
    sp._plan = plan; sp._route = plan.route; sp._routeStart = hab.time;
    setState(sp, 'stalk', stratThought(plan, sp)); sp.mem.lastStrategy = plan.strat;
  };
  H.track = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    faceToward(sp, e.pos, dt, 4);
    const d = M.dist(sp.pos, e.pos);
    if (e.sup.k !== 'air') { setState(sp, 'assess'); return; }
    if (d < AI.jump(sp) * 0.6 && JT.R() < dt * (0.4 + sp.traits.tactics)) { startCrouch(hab, sp, 0.25); return; }
    if (sp.st > 10 + sp.traits.patience * 10) { sp.mem.ignore[e.id] = hab.time + 8; AI.dropTarget(hab, sp); }
  };
  /** How the prey is oriented relative to the hunter: look>0.35 = facing it, look<-0.3 = back turned. */
  function preyView(hab, sp, e) {
    const to = M.sub(sp.pos, e.pos); to[1] = 0; const l = M.len(to) || 1; const f = e.fwd || [1, 0, 0]; const fl = Math.hypot(f[0], f[2]) || 1;
    const look = (f[0] * to[0] + f[2] * to[2]) / (fl * l);
    const busy = M.len(e._vel || [0, 0, 0]) > 1 || e.state === 'walk' || e.state === 'clean';
    return { look, busy, facing: look > 0.35 && l < ((targetDef(hab, sp, e) || {}).sense || 20) * 2.2, back: look < -0.3 };
  }
  AI.preyView = preyView;
  /** Stalking pace: freeze while watched, slow creep, a bit quicker while the prey is busy, slowest in the final approach. */
  function stalkPace(hab, sp, e, dt) {
    if (e.sup && e.sup.k === 'air') { sp._watched = 0; sp._low = 0; return 1; }
    const v = preyView(hab, sp, e); const d = M.dist(sp.pos, e.pos); const ej = effJump(sp, e.pos);
    sp._low = v.back ? 1 : 0;
    if (v.facing && !sp._air) { sp._watched = (sp._watched || 0) + dt; if (sp._watched < 12) { faceToward(sp, e.pos, dt, 2); return 0; } }
    else sp._watched = 0;
    let pace = v.busy ? 0.55 : 0.36;
    if (d < ej * 1.7) pace = 0.2 + 0.1 * M.clamp((d - ej) / (ej * 0.7), 0, 1); // inching in before the pounce
    return pace;
  }
  H.stalk = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    const urgency = M.clamp((0.65 - sp.sat) / 0.5, 0, 1);
    // far away the route is walked normally; once within sight range the approach becomes a creep governed by the prey's gaze
    const far = M.dist(sp.pos, e.pos) > Math.max(36, ((targetDef(hab, sp, e) || {}).sense || 20) * 2.2);
    const mult = far ? (0.45 + 0.5 * urgency) * (1 - sp.traits.patience * 0.2) : stalkPace(hab, sp, e, dt);
    if (mult <= 0) return;
    const r = move(hab, sp, dt, mult);
    sp._evalT = (sp._evalT || 0) + dt;
    if (sp._evalT > 0.4) {
      sp._evalT = 0;
      const d = M.dist(sp.pos, e.pos);
      if (!sp._air && sp.sup.k !== 'air' && d <= effJump(sp, e.pos) * 0.8 && e.sup.k !== 'air') { sp._route = null; startCrouch(hab, sp); return; }
      if (e.sup.k === 'air' && !sp._air) { sp._route = null; setState(sp, 'track', 'Tracking the ' + sp._plan.name + ' in the air.'); return; }
      if (sp._plan && M.dist(e.pos, sp._plan.pred) > AI.jump(sp) * 0.75 && !sp._air) { replan(hab, sp, e); return; }
    }
    if (r === 'done' || r === 'none') { sp._route = null; setState(sp, 'creep', 'Edging closer to the ' + (sp._plan ? sp._plan.name : 'prey') + '.'); return; }
    if (stuck(hab, sp) && !sp._air) replan(hab, sp, e);
  };
  function replan(hab, sp, e) {
    sp._replans = (sp._replans || 0) + 1; sp._route = null;
    if (sp._replans > 5) { sp.mem.ignore[e.id] = hab.time + 20; sp.thought = 'Gave up on the ' + preyName(targetDef(hab, sp, e)) + ' for now.'; AI.dropTarget(hab, sp); return; }
    setState(sp, 'assess');
  }
  H.creep = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    faceToward(sp, e.pos, dt, 5);
    const d = M.dist(sp.pos, e.pos); const ej = effJump(sp, e.pos);
    if (d <= ej * 0.78) { startCrouch(hab, sp); return; }
    const myR = Nav.regionKey(sp.sup), tR = e.sup && Nav.regionKey(e.sup);
    if (myR && myR === tR) {
      const pace = stalkPace(hab, sp, e, dt); if (pace <= 0) { sp.st = 0; return; }
      const r = hab.nav.regions[myR]; const step = AI.speed(sp) * 0.8 * pace * dt; const dir = horiz(M.sub(e.pos, sp.pos));
      const np = [sp.pos[0] + dir[0] * step, sp.pos[1], sp.pos[2] + dir[2] * step];
      const ok = myR === 'F' ? Nav.inside(hab, np[0], np[2], 2) : JT.G.pointInPoly(np[0], np[2], r.poly);
      if (ok && !r.obstacles.some(o => JT.G.pointInPoly(np[0], np[2], o))) { sp.pos = np; sp.fwd = dir; return; }
    }
    if (sp.st > 1.5 || d > ej * 1.6) replan(hab, sp, e);
  };
  function startCrouch(hab, sp, quick) {
    const e = targetEnt(hab, sp); const name = e ? preyName(targetDef(hab, sp, e)) : 'prey';
    setState(sp, 'crouch', 'Crouching for the jump.');
    sp._crouchDur = quick || Math.max(0.35, (0.5 + sp.traits.patience * 1.2) * (sp.sat < 0.35 ? 0.6 : 1));
  }
  H.crouch = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    faceToward(sp, e.pos, dt, 7);
    const d = M.dist(sp.pos, e.pos);
    if (d > effJump(sp, e.pos) * 1.02) { if (e.sup.k === 'air') { setState(sp, 'track'); return; } replan(hab, sp, e); return; }
    if (sp.st >= sp._crouchDur) launchPounce(hab, sp, e);
  };
  function landingFor(hab, sp, e) {
    if (e.sup.k === 'air') return { pos: e.pos.slice(), sup: null };
    const tac = sp.traits.tactics; const fl = 0.16 + M.dist(sp.pos, e.pos) / 220;
    const pr = predict(hab, sp, e, fl * tac);
    return { pos: pr.pos, sup: pr.sup };
  }
  function launchPounce(hab, sp, e) {
    const def = targetDef(hab, sp, e); const land = landingFor(hab, sp, e);
    let to = land.pos; if (e.sup.k === 'air') { const v = e._vel || [0, 0, 0]; to = M.add(e.pos, M.mul(v, 0.18 * sp.traits.tactics)); }
    const d = M.dist(sp.pos, to);
    sp._air = { from: sp.pos.slice(), to, t: 0, dur: 0.16 + d / 220, apex: 1.5 + d * 0.14, land: land.sup, launchY: sp.pos[1], tY: e.pos[1] };
    sp._anchor = sp.pos.slice(); sp.sup = { k: 'air' }; sp._route = null;
    // prey reflex: alertness + hunter stealth; committed pounces on tiny jumpers stay fair
    let reflex = (def.reflex || 0.3) * (0.35 + 0.65 * M.clamp(e.alert || 0, 0, 1)) * (1 - sp.traits.stealth * 0.4);
    if (sp.target.kind === 'prey' && e.sup.k !== 'air') { const v = preyView(hab, sp, e); reflex *= v.back ? 0.45 : v.look > 0.35 ? 1.35 : 1; }
    if (sp.target.kind === 'prey' && e.type === 'tinyjumper') reflex = Math.min(reflex, 0.4);
    if (sp.target.kind === 'spider') reflex = Math.min(0.6, reflex + 0.15);
    if (JT.R() < reflex) {
      if (sp.target.kind === 'prey') JT.PreyAI.escape(hab, e, sp, true); else AI.escapeFrom(hab, e, sp);
      if (e.type === 'tinyjumper') hab.event('journal', { id: 'tinyEscape', sp });
    }
    setState(sp, 'pounce', 'Pounce!');
    hab.event('pounce', { sp });
  }
  H.pounce = function (hab, sp, dt) {
    const A = sp._air; if (!A) { setState(sp, 'idle'); return; }
    A.t += dt / A.dur; const t = Math.min(1, A.t);
    const p = M.lerp3(A.from, A.to, t); p[1] += Math.sin(t * Math.PI) * A.apex;
    const dir = M.sub(p, sp.pos); if (M.len(dir) > 1e-4) { sp._vel = M.mul(dir, 1 / dt); const hz = horiz(dir); if (M.len(hz) > 0) sp.fwd = hz; }
    sp.pos = p;
    const e = targetEnt(hab, sp);
    if (e && t > 0.35) {
      const def = targetDef(hab, sp, e);
      const catchR = AI.len(sp) * 0.55 + def.len * 0.45 + 2.2;
      if (M.dist(sp.pos, e.pos) < catchR) { doCatch(hab, sp, e, A); return; }
    }
    if (A.t >= 1) {
      sp._air = null;
      if (sp._anchor) { hab.addSilk(sp._anchor, p, 'drag'); sp._anchor = null; }
      if (A.land && Nav.validSup(hab, A.land)) { sp.pos = Nav.supPos(hab, A.land, A.to); sp.sup = JT.deepClone(A.land); }
      else { startFall(hab, sp); }
      miss(hab, sp, e);
    }
  };
  function miss(hab, sp, e) {
    sp.mem.misses = (sp.mem.misses || 0) + 1; sp.mem.failPos = sp.pos.slice(); sp.stats.misses++;
    hab.event('miss', { sp });
    if (e) {
      if (sp.target && sp.target.kind === 'prey') JT.PreyAI.escape(hab, e, sp, false);
      sp._tMiss = (sp._tMiss || 0) + 1;
      if (sp._tMiss >= 3) { sp.mem.ignore[e.id] = hab.time + 25; sp._tMiss = 0; sp.thought = 'Missed again — giving the ' + preyName(targetDef(hab, sp, e)) + ' a rest.'; AI.dropTarget(hab, sp); if (sp.state === 'pounce') setState(sp, 'rest'); return; }
      sp.thought = 'Missed! Regrouping.';
      if (sp.state === 'pounce') setState(sp, 'assess');
    } else if (sp.state === 'pounce') setState(sp, 'idle', 'Missed.');
  }
  function doCatch(hab, sp, e, A) {
    const isSpider = sp.target.kind === 'spider';
    const strat = sp._plan ? sp._plan.strat : 'direct'; const nDecor = sp._plan ? sp._plan.nDecor : 0;
    let prey = e;
    if (isSpider) {
      const victim = e; const L = AI.len(victim);
      hab.removeEntity(victim, 'eaten');
      prey = { id: JT.newId('p'), type: 'jumperMeal', species: victim.species, stage: victim.stage, vname: victim.name, len: L, pos: victim.pos.slice(), sup: { k: 'air' }, state: 'held', owner: null, full: 1, fwd: victim.fwd };
      hab.data.prey.push(prey);
      hab.event('journal', { id: 'cannibal', sp });
    }
    prey.owner = sp.id; prey.state = 'held'; prey._route = null; prey._air = null; prey.full = 1; prey.buried = false;
    sp.hold = prey.id; sp.target = null; sp.mem.misses = 0; sp._tMiss = 0;
    sp.mem.success[strat] = (sp.mem.success[strat] || 0) + 1;
    const def = JT.PREY_BY_ID[prey.type];
    if (prey.type === 'tinyjumper') hab.event('journal', { id: 'tinyCatch', sp });
    if (A.launchY - A.tY > 8) hab.event('journal', { id: 'ambushHigh', sp });
    if (strat === 'rear' || strat === 'cover') hab.event('journal', { id: 'ambushCover', sp });
    if (nDecor >= 2) hab.event('journal', { id: 'stepping', sp });
    if (strat === 'intercept') hab.event('journal', { id: 'intercept', sp });
    hab.event('catch', { sp, prey });
    if (sp._anchor) { hab.addSilk(sp._anchor, sp.pos, 'drag'); sp._anchor = null; }
    sp._air = null;
    // land with the prey: on the planned support if valid, otherwise fall to real support below
    if (A.land && Nav.validSup(hab, A.land) && A.t > 0.6) { sp.pos = Nav.supPos(hab, A.land, sp.pos); sp.sup = JT.deepClone(A.land); beginSubdue(hab, sp); }
    else { startFall(hab, sp); sp._afterFall = 'subdue'; }
    sp.thought = 'Got it! Holding on tight…';
  }
  function startFall(hab, sp) {
    const b = Nav.supportBelow(hab, [sp.pos[0], sp.pos[1] + 0.3, sp.pos[2]]);
    sp._air = { from: sp.pos.slice(), to: b.pos, t: 0, dur: 0.25 + Math.sqrt(Math.max(0, sp.pos[1] - b.pos[1])) * 0.08, apex: 0, land: b.sup, fall: true };
    sp.sup = { k: 'air' }; sp._route = null;
    if (sp.state !== 'fall') { sp._afterFall = sp._afterFall || (sp.hold ? 'subdue' : 'idle'); setState(sp, 'fall'); }
  }
  AI.startFall = startFall;
  H.fall = function (hab, sp, dt) {
    const A = sp._air; if (!A) { setState(sp, sp.hold ? 'subdue' : 'idle'); return; }
    A.t += dt / A.dur; const t = Math.min(1, A.t);
    sp.pos = M.lerp3(A.from, A.to, t * t);
    if (A.t >= 1) {
      sp._air = null; sp.pos = A.to.slice(); sp.sup = Nav.validSup(hab, A.land) ? JT.deepClone(A.land) : Nav.supportBelow(hab, sp.pos).sup;
      const nxt = sp._afterFall || 'idle'; sp._afterFall = null;
      if (sp.hold) beginSubdue(hab, sp); else setState(sp, nxt === 'subdue' ? 'idle' : nxt);
    }
  };
  function beginSubdue(hab, sp) {
    const p = hab.preyById(sp.hold); if (!p) { setState(sp, 'idle'); return; }
    const def = JT.PREY_BY_ID[p.type]; const L = p.len || def.len; const ratio = L / AI.len(sp);
    sp._subdueDur = (def.struggle || 2) * M.clamp(ratio * 1.4, 0.5, 2) * (1.2 - sp.traits.bold * 0.4);
    setState(sp, 'subdue', 'Got it! Holding on tight…');
  }
  H.subdue = function (hab, sp, dt) {
    const p = hab.preyById(sp.hold); if (!p) { sp.hold = null; setState(sp, 'idle'); return; }
    p._struggle = Math.max(0, 1 - sp.st / sp._subdueDur);
    if (sp.st >= sp._subdueDur) { p._struggle = 0; startCarry(hab, sp); }
  };

  /** Score real reachable surfaces for feeding / molting / sleeping. Never returns a boundary. */
  AI.chooseSpot = function (hab, sp, mode, carry) {
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp, carry));
    const H0 = hab.dims.h; const S = sp_(sp);
    let best = null, bs = -1e9;
    const others = hab.data.spiders.filter(o => o !== sp);
    const preyLive = hab.data.prey.filter(p => !p.owner && !p.buried);
    for (const n of hab.nav.nodes) {
      if (n.kind === 'face') continue; const c = dj.dist[n.id]; if (!isFinite(c)) continue;
      const g = n.decor && hab.geoms[n.decor]; const plant = g && g.def.cat === 'plants';
      const cover = Nav.coverAt(hab, n.pos); const hgt = n.y / H0;
      let quiet = 60; for (const o of others) quiet = Math.min(quiet, M.dist(o.pos, n.pos)); 
      let traffic = 50; for (const p of preyLive) traffic = Math.min(traffic, M.dist(p.pos, n.pos));
      let s;
      if (mode === 'feed') s = hgt * 6 * (0.6 + S.prefs.height) + (plant ? 3 : 0) + (g && !plant ? 1 : 0) + cover * 3 + quiet * 0.04 + traffic * 0.03 - c * 0.025;
      else if (mode === 'molt') s = hgt * 12 + (plant ? 3.5 : 0) + (g && !plant ? 1.5 : 0) + cover * 4 + (n.perch ? 0.5 : 0) + quiet * 0.06 + traffic * 0.02 - c * 0.012;
      else s = hgt * 3 * (0.5 + S.prefs.height) + (plant ? 1.5 : 0) + cover * 5 + quiet * 0.05 - c * 0.02 + (sp.home && M.dist(sp.home.pos, n.pos) < 8 ? 3 : 0);
      for (const o of others) if (o.retreat && o.retreat.pos && M.dist(o.retreat.pos, n.pos) < 10) s -= 4;
      if (s > bs) { bs = s; best = n; }
    }
    if (!best) return null;
    const route = Nav.buildRoute(hab, dj, best.sup, best.pos);
    if (!route) return null;
    return { node: best, route, high: best.y > 12, plant: !!(best.decor && hab.geoms[best.decor] && hab.geoms[best.decor].def.cat === 'plants') };
  };
  function startCarry(hab, sp) {
    const spot = AI.chooseSpot(hab, sp, 'feed', true);
    if (!spot || M.dist(spot.node.pos, sp.pos) < 4) { startFeed(hab, sp); return; }
    sp._route = spot.route; sp._routeStart = hab.time; sp._feedSpot = spot.node.pos.slice();
    const p = hab.preyById(sp.hold); const nm = p ? preyName(JT.PREY_BY_ID[p.type]) : 'meal';
    setState(sp, 'carry', spot.high ? 'Carrying the ' + nm + ' up to a safe feeding perch.' : 'Carrying the ' + nm + ' to a quiet, sheltered spot.');
    sp._carrySafe = spot.high || spot.plant;
  }
  H.carry = function (hab, sp, dt) {
    if (!sp.hold || !hab.preyById(sp.hold)) { sp.hold = null; setState(sp, 'idle'); return; }
    const r = move(hab, sp, dt, 0.75);
    if (r === 'none' && sp.sup.k !== 'air') { startFeed(hab, sp); return; } // route invalidated: eat right here
    if (r === 'done') { if (sp._carrySafe) hab.event('journal', { id: 'safeMeal', sp }); startFeed(hab, sp); return; }
    if (stuck(hab, sp) && !sp._air) { sp._route = null; startFeed(hab, sp); }
  };
  function startFeed(hab, sp) {
    sp._route = null; const p = hab.preyById(sp.hold); if (!p) { setState(sp, 'idle'); return; }
    const def = JT.PREY_BY_ID[p.type];
    sp._feedDur = 6 + (p.type === 'jumperMeal' ? 0.8 : def.nut) * 28; sp._feedNut = p.type === 'jumperMeal' ? 0.25 + (p.len || 5) * 0.05 : AI.nutOf(def);
    setState(sp, 'feed', 'Feeding on the ' + (p.type === 'jumperMeal' ? 'unlucky jumper' : preyName(def)) + '.');
  }
  H.feed = function (hab, sp, dt) {
    const p = hab.preyById(sp.hold); if (!p) { sp.hold = null; setState(sp, 'idle'); return; }
    const k = dt / sp._feedDur; sp.sat = Math.min(1.05, sp.sat + sp._feedNut * k * 1.15); p.full = Math.max(0.25, 1 - sp.st / sp._feedDur * 0.7);
    if (sp.st >= sp._feedDur) finishMeal(hab, sp, p);
  };
  function finishMeal(hab, sp, p) {
    const def = JT.PREY_BY_ID[p.type];
    hab.data.prey = hab.data.prey.filter(x => x !== p); sp.hold = null;
    hab.addRemains(p.type, sp.pos, sp.sup, p.type === 'jumperMeal' ? 'spider' : 'husk', p.type === 'jumperMeal' ? { species: p.species, len: p.len } : {});
    sp.catches++; sp.meals++;
    hab.event('meal', { sp, value: def.val || 10 });
    hab.event('journal', { id: 'firstHunt', sp });
    sp._afterMeal = hab.time; sp._patrolCD = 0;
    setState(sp, 'postFeed', 'Full and resting after its meal.');
  }

  // ---- thirst ----
  function startDrink(hab, sp, maxCost) {
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp));
    const srcs = hab.data.drops.map(d => ({ pos: d.pos, sup: d.sup, id: d.id, decor: d.decor })).concat(maxCost ? [] : hab.nav.water.map((w, i) => ({ pos: w.pos, sup: w.sup, decor: w.decor, perm: i })));
    let best = null, bc = maxCost || 260;
    for (const s of srcs) { const gc = Nav.goalCost(hab, dj, s.sup, s.pos); if (gc && gc.cost < bc) { bc = gc.cost; best = s; } }
    if (!best) { sp._drinkFail = hab.time + (maxCost ? 12 : 30); return false; }
    const r = Nav.buildRoute(hab, dj, best.sup, best.pos); if (!r) { sp._drinkFail = hab.time + 30; return false; }
    sp._route = r; sp._routeStart = hab.time; sp._drink = best; AI.dropTarget(hab, sp);
    const dn = decorName(hab, best.decor);
    setState(sp, 'drinkSeek', (maxCost ? 'Off to sip ' : 'Thirsty — heading for ') + (best.id ? 'a droplet' : 'water') + (dn ? ' on the ' + dn : '') + '.');
    return true;
  }
  H.drinkSeek = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.9);
    if (sp._drink && sp._drink.id && !hab.data.drops.find(d => d.id === sp._drink.id)) { sp._route = null; setState(sp, 'idle', 'The droplet evaporated.'); return; }
    if (r === 'done' || r === 'none') { sp._route = null; setState(sp, 'drink', 'Sipping a droplet.'); }
    else if (stuck(hab, sp)) { sp._route = null; setState(sp, 'idle'); }
  };
  H.drink = function (hab, sp, dt) {
    if (sp.st > 3) {
      sp.hyd = Math.min(1, sp.hyd + 0.55);
      if (sp._drink && sp._drink.id) hab.data.drops = hab.data.drops.filter(d => d.id !== sp._drink.id);
      sp._drink = null; hab.event('journal', { id: 'drink', sp });
      setState(sp, 'groom', 'Refreshed. Wiping its palps.');
    }
  };
  AI.onMist = function (hab, sp) { if ((PRI[sp.state] || 0) < 15 && JT.R() < 0.5) { setState(sp, 'groom', 'A droplet landed nearby — pausing to groom.'); } };

  // ---- molting (absolute priority once ready) ----
  function startMoltSeek(hab, sp) {
    AI.dropTarget(hab, sp); sp._seen = {}; sp._route = null; sp._plan = null;
    const spot = AI.chooseSpot(hab, sp, 'molt');
    if (!spot || M.dist(spot.node.pos, sp.pos) < 3) { sp.retreat = { d: sp.sup.d || null, pos: sp.pos.slice() }; setState(sp, 'moltSilk', 'Pre-molt — weaving a molting hammock right here.'); return; }
    sp._route = spot.route; sp._routeStart = hab.time; sp.retreat = { d: spot.node.decor || null, pos: spot.node.pos.slice() };
    setState(sp, 'moltSeek', spot.high ? 'Pre-molt — climbing to the safest high retreat.' : 'Pre-molt — no high shelter here, heading for a quiet sheltered refuge.');
    sp._moltReplans = 0;
  }
  H.moltSeek = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.85);
    if (r === 'done') { setState(sp, 'moltSilk', 'Weaving a silk molting hammock.'); return; }
    if (r === 'none' || (stuck(hab, sp) && !sp._air)) {
      sp._moltReplans++;
      if (sp._moltReplans > 3) { setState(sp, 'moltSilk', 'Pre-molt — settling where it is.'); sp._route = null; return; }
      const spot = AI.chooseSpot(hab, sp, 'molt'); if (spot) { sp._route = spot.route; sp._routeStart = hab.time; sp.retreat = { d: spot.node.decor || null, pos: spot.node.pos.slice() }; } else { setState(sp, 'moltSilk'); }
    }
  };
  // ---- thick silk sac (sleep / molt): built around the jumper, carved open front or back on the way out ----
  const NEST_STATES = new Set(['sleep', 'moltSilk', 'premolt', 'molting', 'postMolt', 'emerge']);
  AI.NEST_STATES = NEST_STATES;
  function makeNest(hab, sp, kind) {
    const d = hab.data; d.nests = d.nests || [];
    let n = d.nests.find(x => !x.owner && M.dist(x.pos, sp.pos) < AI.len(sp) * 0.5 && x.age < 1500);
    if (n) { n.owner = sp.id; n.hole = null; n.prog = Math.min(n.prog, 0.5); n.age = 0; n.kind = kind; }
    else {
      n = { id: JT.newId('n'), owner: sp.id, pos: sp.pos.slice(), sup: JT.deepClone(sp.sup), fwd: (sp.fwd || [1, 0, 0]).slice(), len: AI.len(sp), prog: 0, hole: null, age: 0, kind, seed: (JT.R() * 1e6) | 0 };
      d.nests.push(n); while (d.nests.length > 8) d.nests.shift();
    }
    sp.nest = n.id; return n;
  }
  AI.nestOf = (hab, sp) => sp.nest && (hab.data.nests || []).find(n => n.id === sp.nest);
  function startEmerge(hab, sp, next, thought) {
    const n = AI.nestOf(hab, sp); if (!n || n.prog < 0.3) { if (n) { n.owner = null; } sp.nest = null; setState(sp, next, thought); return; }
    sp._emergeNext = next; sp._emergeThought = thought; setState(sp, 'emerge');
    n.hole = { side: JT.R() < 0.6 ? 1 : -1, open: 0 };
  }
  H.emerge = function (hab, sp, dt) {
    const n = AI.nestOf(hab, sp); if (!n || !n.hole) { sp.nest = null; setState(sp, sp._emergeNext || 'idle'); return; }
    const hd = M.mul(n.fwd, n.hole.side);
    faceToward(sp, M.add(sp.pos, hd), dt, 3);                         // turn toward the chosen end
    if (sp.st > 0.6) n.hole.open = Math.min(1, n.hole.open + dt / 1.4); // chew/pull a doorway open
    if (n.hole.open >= 1 && sp.st > 2.2) {
      const L = AI.len(sp); const out = M.add(n.pos, M.mul(hd, L * 0.95));
      if (sp.sup.k === 'floor' ? Nav.inside(hab, out[0], out[2], 2) : sp.sup.k === 'top' ? JT.G.pointInPoly(out[0], out[2], hab.geoms[sp.sup.d].tops[sp.sup.i].poly) : false) sp.pos = [out[0], sp.pos[1], out[2]];
      n.owner = null; sp.nest = null; setState(sp, sp._emergeNext || 'idle', sp._emergeThought);
    }
  };
  AI.updateNests = function (hab, dt) {
    const ns = hab.data.nests; if (!ns || !ns.length) return;
    for (const n of ns) {
      const sp = n.owner && hab.spider(n.owner);
      if (sp && NEST_STATES.has(sp.state) && sp.nest === n.id) { const rate = sp.state === 'moltSilk' ? 1 / 5 : 1 / 4; if (sp.state !== 'emerge') n.prog = Math.min(1, n.prog + dt * rate); n.age = 0; }
      else { if (n.owner) { n.owner = null; if (!n.hole && n.prog > 0.3) n.hole = { side: 1, open: 1 }; if (sp && sp.nest === n.id) sp.nest = null; } n.age += dt; }
    }
    hab.data.nests = ns.filter(n => n.age < 1800);
  };
  function weave(hab, sp, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = JT.R() * 6.28, up = JT.R() * 0.8; const L = 3 + AI.len(sp) * 0.5 + JT.R() * 4;
      const b = [sp.pos[0] + Math.cos(a) * L, Math.max(0.3, sp.pos[1] + (up - 0.2) * L), sp.pos[2] + Math.sin(a) * L * 0.8];
      hab.addSilk(sp.pos, b, kind, sp.sup.d || null);
    }
  }
  H.moltSilk = function (hab, sp, dt) {
    if (!AI.nestOf(hab, sp)) makeNest(hab, sp, 'molt');
    if (sp.st > 5) { weave(hab, sp, 3, 'retreat'); hab.event('journal', { id: 'retreat', sp }); setState(sp, 'premolt', 'Sealed inside its molting hammock. Very still.'); }
  };
  H.premolt = function (hab, sp, dt) { if (sp.st > 28) setState(sp, 'molting', 'Molting! Slowly pulling free of its old skin.'); };
  H.molting = function (hab, sp, dt) {
    if (sp.st > 11) {
      const L = AI.len(sp);
      hab.addRemains('exuvia', sp.pos, sp.sup, 'exuvia', { species: sp.species, len: L });
      sp.stage = Math.min(5, sp.stage + 1); sp.meals = 0; sp.molts++; sp.soft = 120;
      if (sp.stage === 5) { sp.adultDays = 0; hab.event('journal', { id: 'adult', sp }); }
      hab.event('journal', { id: 'molt', sp }); hab.event('journal', { id: 'softMolt', sp });
      hab.event('molt', { sp });
      setState(sp, 'postMolt', 'Freshly molted — pale and soft, resting while the new skin hardens.');
    }
  };
  H.postMolt = function (hab, sp, dt) { if (sp.st > 25) { sp.retreat = null; startEmerge(hab, sp, 'stretch', 'Stretching its new legs carefully.'); } };

  // ---- sleep ----
  function startSleep(hab, sp) {
    const spot = AI.chooseSpot(hab, sp, 'sleep');
    if (spot && M.dist(spot.node.pos, sp.pos) > 3) { sp._route = spot.route; sp._routeStart = hab.time; setState(sp, 'sleepSeek', 'Night is falling — heading to a sheltered retreat.'); }
    else { weave(hab, sp, 2, 'retreat'); makeNest(hab, sp, 'sleep'); setState(sp, 'sleep', 'Tucked into a silk retreat for the night.'); }
  }
  H.sleepSeek = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.7);
    if (r === 'done' || r === 'none' || stuck(hab, sp)) { sp._route = null; weave(hab, sp, 2, 'retreat'); makeNest(hab, sp, 'sleep'); hab.event('journal', { id: 'retreat', sp }); if (!sp.home || JT.R() < 0.25) AI.setHome(hab, sp); setState(sp, 'sleep', 'Tucked into a silk retreat for the night.'); }
  };
  H.sleep = function (hab, sp, dt) {
    if (hab.daylight() > 0.35) startEmerge(hab, sp, 'stretch', 'Waking up and stretching.');
    else if (sp.sat < 0.25 && sp.st > 20) startEmerge(hab, sp, 'idle', 'Too hungry to sleep.');
  };

  // ---- threat / flee ----
  function startFlee(hab, sp, th) {
    AI.dropTarget(hab, sp);
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); let best = null, bs = -1e9;
    for (const n of hab.nav.nodes) { if (n.kind === 'face' || !isFinite(dj.dist[n.id])) continue; const s = M.dist(n.pos, th.pos) - dj.dist[n.id] * 0.3 + Nav.coverAt(hab, n.pos) * 10; if (s > bs) { bs = s; best = n; } }
    if (best) { sp._route = Nav.buildRoute(hab, dj, best.sup, best.pos); sp._routeStart = hab.time; }
    sp._watchPos = th.pos.slice();
    setState(sp, 'flee', AI.len(th) > AI.len(sp) * 1.3 ? 'A much bigger jumper is too close — retreating!' : 'Spotted ' + th.name + ' stalking it — fleeing!');
  }
  AI.escapeFrom = function (hab, sp, hunter) { if ((PRI[sp.state] || 0) < 60) { startFlee(hab, sp, hunter); } };
  H.flee = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 1.5, true);
    if (r === 'done' || r === 'none' || stuck(hab, sp)) { sp._route = null; setState(sp, 'watch', 'Keeping a wary eye out.'); }
  };
  H.avoid = function (hab, sp, dt) { const r = move(hab, sp, dt, 1.0); if (r !== 'moving' || stuck(hab, sp)) { sp._route = null; setState(sp, 'watch', 'Keeping its distance.'); } };

  // ---- social ----
  function social(hab, sp) {
    if (sp._socialCD > hab.time) return false;
    let o = null, od = 34;
    for (const x of hab.data.spiders) { if (x === sp || MOLT.has(x.state) || x.state === 'sleep') continue; const d = M.dist(x.pos, sp.pos); if (d < od) { od = d; o = x; } }
    if (!o) return false;
    const f = horiz(sp.fwd), to = horiz(M.sub(o.pos, sp.pos)); if (M.dot(f, to) < -0.3 && !o._moving) return false;
    sp._socialCD = hab.time + 20 + JT.R() * 20; sp._watchPos = o.pos.slice();
    const ratio = AI.len(o) / AI.len(sp);
    if (ratio > 1.5 && sp.traits.bold < 0.8) {
      const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); let best = null, bs = -1e9;
      for (let k = 0; k < 30; k++) { const n = hab.nav.nodes[Math.floor(JT.R() * hab.nav.nodes.length)]; if (!n || n.kind === 'face' || !isFinite(dj.dist[n.id])) continue; const s = M.dist(n.pos, o.pos) - dj.dist[n.id] * 0.4; if (s > bs) { bs = s; best = n; } }
      if (best) { sp._route = Nav.buildRoute(hab, dj, best.sup, best.pos); sp._routeStart = hab.time; setState(sp, 'avoid', 'Giving ' + o.name + ' a wide berth.'); return true; }
    }
    if (ratio > 0.65 && ratio < 1.5 && (sp.pers.territorial > 0.5 || sp_(sp).prefs.display > 0.7) && od < 26) {
      setState(sp, 'display', 'Raising its front legs at ' + o.name + ' — a territorial display.'); sp.stats.displays++;
      if ((PRI[o.state] || 0) < 20) { o._watchPos = sp.pos.slice(); o._socialCD = hab.time + 20; if (o.pers.territorial > 0.4) setState(o, 'display', 'Answering ' + sp.name + "'s display with raised legs."); else setState(o, 'watch', 'Watching ' + sp.name + ' warily.'); }
      hab.event('journal', { id: 'territorial', sp }); return true;
    }
    setState(sp, 'watch', 'Watching ' + o.name + ' carefully.'); return true;
  }
  function curiosity(hab, sp) {
    if (sp._curCD > hab.time) return false; sp._curCD = hab.time + 6;
    const ins = sp._inspected || (sp._inspected = {});
    const nov = hab.data.decor.filter(d => d.novel && hab.time - (d.placedAt || 0) < 150 && !ins[d.id] && JT.DECOR_BY_ID[d.type].cat !== 'ground');
    if (!nov.length || JT.R() > sp.pers.curiosity * 0.6) return false;
    const d = nov[0]; ins[d.id] = 1;
    const n = Nav.nearestNodeOfDecor(hab.nav, d.id, sp.pos); if (!n) return false;
    const r = routeTo(hab, sp, n.sup, n.pos); if (!r) return false;
    sp._inspectDecor = d.id;
    setState(sp, 'investigate', 'Something new! Going to investigate the ' + JT.DECOR_BY_ID[d.type].name.toLowerCase() + '.');
    return true;
  }
  H.investigate = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.8);
    if (r === 'done' || r === 'none' || stuck(hab, sp)) { sp._route = null; setState(sp, 'inspect', 'Probing the new ' + (decorName(hab, sp._inspectDecor) || 'object') + ' with its front legs.'); }
  };
  H.inspect = function (hab, sp, dt) { if (sp.st > 3.5) { hab.event('journal', { id: 'investigate', sp }); setState(sp, 'lookout', 'Satisfied with its inspection.'); } };

  // ---- hungry search ----
  function startSearch(hab, sp) {
    const live = hab.data.prey.filter(p => !p.owner && !p.buried && JT.PREY_BY_ID[p.type].huntable);
    if (!live.length) return;
    // only a rough sense of where prey activity is (not perfect knowledge)
    const p = live[Math.floor(JT.R() * live.length)];
    const fuzzy = [p.pos[0] + (JT.R() - 0.5) * 30, p.pos[1], p.pos[2] + (JT.R() - 0.5) * 20];
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); let best = null, bs = -1e9;
    for (const n of hab.nav.nodes) { if (n.kind === 'face' || !isFinite(dj.dist[n.id])) continue; const d = M.dist(n.pos, fuzzy); if (d < 10) continue; const s = -d * 0.6 + n.y * 0.08 * (0.5 + sp_(sp).prefs.height) - dj.dist[n.id] * 0.05; if (s > bs) { bs = s; best = n; } }
    sp._searchCD = hab.time + 8;
    if (!best) return;
    sp._route = Nav.buildRoute(hab, dj, best.sup, best.pos); sp._routeStart = hab.time; if (!sp._route) return;
    setState(sp, 'search', 'Hungry — searching the habitat for prey.');
  }
  H.search = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.6 + (0.4 - Math.min(0.4, sp.sat)));
    if (r === 'done' || r === 'none' || stuck(hab, sp)) { sp._route = null; setState(sp, 'lookout', 'Scanning hungrily for movement.'); }
  };

  // ---------------- small natural behaviours ----------------
  AI.setHome = function (hab, sp) { if (!sp.sup || sp.sup.k === 'air') return; sp.home = { pos: sp.pos.slice(), sup: JT.deepClone(sp.sup) }; };
  /** One short line describing what the jumper is doing (used by the info panel). */
  AI.stateLine = function (hab, sp) {
    const lvl = AI.hungerLevel(sp); const st = sp.state;
    const home = sp.home && M.dist(sp.home.pos, sp.pos) < 6;
    const L = {
      notice: 'Has spotted prey', assess: 'Sizing up prey', stalk: 'Stalking prey', creep: 'Creeping closer', crouch: 'About to pounce', track: 'Tracking a flyer', pounce: 'Pouncing',
      subdue: 'Holding its catch', carry: 'Carrying its catch', feed: 'Feeding', postFeed: 'Resting after a meal', fall: 'Dropping down',
      drinkSeek: 'Going for a drink', drink: 'Drinking a droplet', sleepSeek: 'Heading to bed', sleep: 'Asleep in its retreat',
      moltSeek: 'Looking for a molting spot', moltSilk: 'Spinning a molting hammock', premolt: 'Waiting to molt', molting: 'Molting', postMolt: 'Hardening after a molt', emerge: 'Leaving its retreat',
      flee: 'Fleeing', avoid: 'Keeping its distance', display: 'Displaying', watch: 'Watching warily', investigate: 'Investigating', inspect: 'Inspecting something new',
      groom: 'Grooming', cleanEyes: 'Cleaning its eyes', look: 'Looking around', scuttle: 'Scuttling sideways', stretch: 'Stretching', dangle: 'Dangling on a silk line',
      baskSeek: 'Heading for the warm spot', bask: 'Basking under the lamp', homeSeek: 'Heading home', lunge: 'Lunged at a movement',
      explore: 'Exploring', lookout: 'Keeping a lookout', search: 'Searching for prey', rest: home ? 'Resting at home' : 'Resting', idle: 'Settling',
    };
    if (st === 'patrol' || st === 'scan') return lvl >= 2 ? 'Very hungry · wandering restlessly' : st === 'scan' ? 'Hungry · scanning for movement' : 'Hungry · patrolling for prey';
    const base = L[st] || 'Settling';
    if (lvl >= 2 && !HUNT.has(st) && !['feed', 'subdue', 'carry', 'pounce', 'lunge'].includes(st) && !MOLT.has(st)) return 'Very hungry · ' + base.toLowerCase();
    if (lvl === 1 && !AI.preyAvailable(hab, sp) && !MOLT.has(st) && st !== 'feed') return 'Hungry · ' + base.toLowerCase();
    return base;
  };
  function regionStep(hab, sp, dir, step) {
    const key = Nav.regionKey(sp.sup); if (!key) return false; const r = hab.nav.regions[key]; if (!r) return false;
    const np = [sp.pos[0] + dir[0] * step, sp.pos[1], sp.pos[2] + dir[2] * step];
    const ok = key === 'F' ? Nav.inside(hab, np[0], np[2], 3) : JT.G.pointInPoly(np[0], np[2], JT.G.scalePoly(r.poly, 0.92));
    if (!ok || r.obstacles.some(o => JT.G.pointInPoly(np[0], np[2], o))) return false;
    sp.pos = np; return true;
  }
  H.cleanEyes = function (hab, sp, dt) { if (sp.st > 2.4 + sp.pers.routine * 1.5) { if (JT.R() < 0.5) sp._flick = 1; setState(sp, 'idle'); } };
  H.stretch = function (hab, sp, dt) { if (sp.st > 2.8) setState(sp, JT.R() < 0.5 ? 'cleanEyes' : 'idle', 'Tidying up after a good stretch.'); };
  function startLook(hab, sp) { sp._lookN = 3 + Math.floor(JT.R() * 3); sp._lookStepT = 0; setState(sp, 'look', 'Looking around, a few degrees at a time.'); }
  /** Look around in steps: quick turns separated by still pauses; the head leads each turn. */
  H.look = function (hab, sp, dt) {
    sp._gazeT = 0.5; sp._lookStepT -= dt;
    if (sp._lookStepT <= 0) {
      if (sp._lookN-- <= 0) { sp._gaze = 0; setState(sp, 'idle'); return; }
      const f = sp.fwd || [1, 0, 0]; const a = Math.atan2(f[2], f[0]) + (JT.R() < 0.5 ? -1 : 1) * (0.4 + JT.R() * 0.5);
      sp._lookTo = [Math.cos(a), 0, Math.sin(a)]; sp._gaze = (a - Math.atan2(f[2], f[0])) > 0 ? 0.6 : -0.6; sp._lookStepT = 0.55 + JT.R() * 0.5;
    }
    if (sp._lookTo && sp.sup.k !== 'path') { faceToward(sp, M.add(sp.pos, sp._lookTo), dt, 9); }
    if (sp._lookStepT < 0.3) sp._gaze = M.lerp(sp._gaze || 0, 0, Math.min(1, dt * 6));
  };
  function startScuttle(hab, sp) {
    if (!Nav.regionKey(sp.sup)) return false;
    const f = horiz(sp.fwd || [1, 0, 0]); const sd = JT.R() < 0.5 ? 1 : -1; const dir = [-f[2] * sd, 0, f[0] * sd];
    const probe = { pos: sp.pos.slice(), sup: sp.sup }; if (!regionStep(hab, probe, dir, AI.len(sp) * 1.5)) return false;
    sp._scutDir = dir; sp._scutDur = 0.45 + JT.R() * 0.4; setState(sp, 'scuttle', 'A quick sideways scuttle.'); return true;
  }
  H.scuttle = function (hab, sp, dt) {
    if (sp.st < sp._scutDur) { if (!regionStep(hab, sp, sp._scutDir, AI.speed(sp) * 0.95 * dt)) sp.st = sp._scutDur; return; }
    if (sp.st > sp._scutDur + 0.5) setState(sp, JT.R() < 0.5 ? 'idle' : 'lookout');
  };
  AI.startDangle = startDangle;
  function startDangle(hab, sp) {
    const L = AI.len(sp); let point = sp.pos.slice(), exclude = null;
    if (sp.sup.k === 'path') {
      const fr = Nav.supFrame(hab, sp.sup); if (!fr.tan || Math.abs(fr.tan[1]) > 0.55 || fr.n[1] < 0.55) return false;
    } else if (sp.sup.k === 'top') {
      const t = hab.geoms[sp.sup.d] && hab.geoms[sp.sup.d].tops[sp.sup.i]; if (!t) return false; exclude = sp.sup.d;
      let best = null, bd = 1e9; const poly = t.poly;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[j], b = poly[i]; const ex = b[0] - a[0], ez = b[1] - a[1]; const l2 = ex * ex + ez * ez || 1;
        const u = M.clamp(((sp.pos[0] - a[0]) * ex + (sp.pos[2] - a[1]) * ez) / l2, 0, 1); const q = [a[0] + ex * u, a[1] + ez * u]; const d = Math.hypot(q[0] - sp.pos[0], q[1] - sp.pos[2]);
        if (d < bd) { bd = d; best = q; }
      }
      if (!best || bd > L * 1.8) return false;
      const c = JT.G.centroid(poly); const o = M.norm([best[0] - c[0], 0, best[1] - c[1]]);
      point = [best[0] + o[0] * Math.max(1.2, L * 0.3), sp.pos[1], best[1] + o[2] * Math.max(1.2, L * 0.3)];
    } else return false;
    if (sp.pos[1] < 10 || !Nav.inside(hab, point[0], point[2], 3)) return false;
    const below = Nav.supportBelow(hab, [point[0], sp.pos[1] - 0.8, point[2]], exclude);
    const clear = sp.pos[1] - below.pos[1]; if (clear < 9) return false;
    sp._dangleOff = { dx: point[0] - sp.pos[0], dz: point[2] - sp.pos[2], depth: M.clamp(clear * 0.45, 4, Math.min(16, L * 3.2)), anchor: point };
    sp._dangleHold = 1.6 + JT.R() * 2.2; sp._dangleK = 0;
    setState(sp, 'dangle', 'Dropping on a silk line for a look around, then climbing back up.'); hab.event('journal', { id: 'dangle', sp, soft: true }); return true;
  }
  H.dangle = function (hab, sp, dt) {
    const down = 1.3, hold = sp._dangleHold || 2, up = 2.2; const t = sp.st;
    sp._dangleK = t < down ? M.smooth(t / down) : t < down + hold ? 1 : Math.max(0, 1 - M.smooth((t - down - hold) / up));
    if (t > down + hold + up) { sp._dangleK = 0; setState(sp, 'lookout', 'Back up after a little dangle.'); }
  };
  H.homeSeek = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.7);
    if (r === 'done' || r === 'none' || stuck(hab, sp)) { sp._route = null; setState(sp, 'rest', 'Resting at its favourite spot.'); }
  };

  // ---------------- warmth: basking under the lamp ----------------
  AI.wantsWarmth = function (hab, sp) {
    if (sp._baskCD > hab.time || sp.sat < 0.12 || sp.soft > 60 || sp.hold) return false;
    if (!hab.lampsOn || !hab.lampsOn().length) return false;
    const tod = hab.game ? hab.game.tod() : 0.3; const morning = tod > 0.2 && tod < 0.45;
    const cool = hab.daylight() < 0.6;
    const fed = sp._afterMeal != null && hab.time - sp._afterMeal < 300;
    return morning || cool || fed;
  };
  function startBask(hab, sp) {
    sp._baskCD = hab.time + 30;
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); let best = null, bs = -1e9;
    for (const n of hab.nav.nodes) {
      if (n.kind === 'face' || !isFinite(dj.dist[n.id])) continue;
      const w = hab.warmthAt(n.pos); if (w < 0.4) continue;
      let s = w * 3 - dj.dist[n.id] * 0.01 + (n.kind === 'top' ? 0.3 : 0);
      for (const o of hab.data.spiders) if (o !== sp && M.dist(o.pos, n.pos) < 6) s -= 1.5;
      if (s > bs) { bs = s; best = n; }
    }
    if (!best) return false;
    const fed = sp._afterMeal != null && hab.time - sp._afterMeal < 300;
    if (M.dist(best.pos, sp.pos) < 3) { beginBask(hab, sp); return true; }
    const r = Nav.buildRoute(hab, dj, best.sup, best.pos); if (!r) return false;
    sp._route = r; sp._routeStart = hab.time;
    setState(sp, 'baskSeek', fed ? 'Full — heading for the warm spot to digest.' : 'A little cool — heading for the warm light.');
    return true;
  }
  AI.startBask = startBask;
  function beginBask(hab, sp) { sp._baskDur = 22 + JT.R() * 26; setState(sp, 'bask', 'Basking in the warm light, body pressed flat.'); hab.event('journal', { id: 'bask', sp, soft: true }); }
  H.baskSeek = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.75);
    if (r === 'done' || r === 'none') { sp._route = null; if (hab.warmthAt(sp.pos) > 0.25) beginBask(hab, sp); else setState(sp, 'idle'); }
    else if (stuck(hab, sp)) { sp._route = null; setState(sp, 'idle'); }
  };
  H.bask = function (hab, sp, dt) {
    if (hab.warmthAt(sp.pos) < 0.2) { sp._afterMeal = null; setState(sp, 'idle', 'The warmth faded.'); return; }
    if (sp.st > (sp._baskDur || 30)) { sp._baskCD = hab.time + 120 + JT.R() * 160; sp._afterMeal = null; setState(sp, 'groom', 'Warmed through. Tidying its legs.'); }
  };

  // ---------------- hunger with no prey: patrol perches, scan from high, lunge at movement ----------------
  function startPatrol(hab, sp) {
    const lvl = AI.hungerLevel(sp); const far = lvl >= 2;
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); const H0 = hab.dims.h;
    const vis = sp._pvisit || (sp._pvisit = []);
    let best = null, bs = -1e9;
    for (const n of hab.nav.nodes) {
      if (n.kind === 'face' || !isFinite(dj.dist[n.id])) continue;
      if (M.dist(n.pos, sp.pos) < 10) continue;
      const c = dj.dist[n.id];
      let s = n.y / H0 * 7 + (n.perch ? 1.5 : 0) + (n.kind === 'floor' ? -2 : 0) + JT.R() * 2;
      s -= far ? Math.abs(c - 110) * 0.018 : Math.abs(c - 45) * 0.03;
      for (const v of vis) if (M.dist(v, n.pos) < 18) s -= 5; // perches in turn: skip the last few visited
      if (s > bs) { bs = s; best = n; }
    }
    sp._patrolCD = hab.time + 4;
    if (!best) { startScan(hab, sp); return true; }
    const r = Nav.buildRoute(hab, dj, best.sup, best.pos); if (!r) return false;
    sp._route = r; sp._routeStart = hab.time; vis.push(best.pos.slice()); while (vis.length > 4) vis.shift();
    setState(sp, 'patrol', far ? 'Very hungry — wandering restlessly in search of food.' : (best.y > 18 ? 'Hungry — climbing high to scan for prey.' : 'Hungry — patrolling its perches for prey.'));
    return true;
  }
  AI.startPatrol = startPatrol;
  function startScan(hab, sp) {
    const far = AI.hungerLevel(sp) >= 2;
    sp._scanDur = far ? 2 + JT.R() * 1.8 : 4 + JT.R() * 3.5; sp._peerT = 0;
    setState(sp, 'scan', far ? 'Very hungry — peering around, restless.' : 'Peering around for any movement.');
  }
  /** Anything moving within reach: prey of any kind (incl. springtails), falling leaves, other jumpers. */
  function moverNear(hab, sp) {
    const R0 = Math.max(14, AI.jump(sp) * 0.85); let best = null, bd = R0; const f = horiz(sp.fwd || [1, 0, 0]);
    const test = (pos, speed, id, kind) => {
      if (speed < 1.2) return; const d = M.dist(pos, sp.pos); if (d > bd || d < 1.5) return;
      const to = horiz(M.sub(pos, sp.pos)); if (M.dot(f, to) < -0.35) return;
      best = { pos: pos.slice(), id, kind }; bd = d;
    };
    for (const p of hab.data.prey) if (!p.owner && !p.buried) test(p.pos, p._vel ? M.len(p._vel) : 0, p.id, p.type);
    for (const lf of hab._leaves || []) if (lf.falling) test(lf.pos, 3, lf.id, 'leaf');
    for (const o of hab.data.spiders) if (o !== sp && o._moving) test(o.pos, 3, o.id, 'spider');
    return best;
  }
  function maybeLunge(hab, sp, dt) {
    sp._mvT = (sp._mvT || 0) - dt; if (sp._mvT > 0 || sp._air || sp._lungeCD > hab.time) return false; sp._mvT = 0.3;
    const m = moverNear(hab, sp); if (!m || JT.R() > 0.55) return false;
    sp._route = null; sp._lunge = m; sp._lungeGone = 0;
    const what = m.kind === 'leaf' ? 'a falling leaf' : m.kind === 'springtail' ? 'a springtail' : m.kind === 'spider' ? 'a moving jumper' : 'a flicker of movement';
    setState(sp, 'lunge', 'Lunged at ' + what + '.'); hab.event('journal', { id: 'restless', sp, soft: true }); return true;
  }
  H.patrol = function (hab, sp, dt) {
    if (maybeLunge(hab, sp, dt)) return;
    const r = move(hab, sp, dt, AI.hungerLevel(sp) >= 2 ? 1.05 : 0.8);
    if (r === 'done' || r === 'none') { sp._route = null; startScan(hab, sp); }
    else if (stuck(hab, sp) && !sp._air) { sp._route = null; startScan(hab, sp); }
  };
  H.scan = function (hab, sp, dt) {
    sp._gazeT = 0.5;
    if (maybeLunge(hab, sp, dt)) return;
    sp._peerT -= dt;
    if (sp._peerT <= 0) { // peering head turns: snap to a new bearing, hold still, repeat
      const opts = [-0.75, -0.4, 0, 0.4, 0.75]; let g = opts[Math.floor(JT.R() * opts.length)]; if (Math.abs(g - (sp._gaze || 0)) < 0.2) g = -g || 0.6;
      sp._gaze = g; sp._peerT = 0.6 + JT.R() * 0.7;
      if (JT.R() < 0.35 && sp.sup.k !== 'path') { const f = sp.fwd || [1, 0, 0]; const a = Math.atan2(f[2], f[0]) + g * 1.4; sp._lookTo = [Math.cos(a), 0, Math.sin(a)]; }
    }
    if (sp._lookTo && sp.sup.k !== 'path') faceToward(sp, M.add(sp.pos, sp._lookTo), dt, 7);
    if (sp.st > sp._scanDur) { sp._lookTo = null; sp._gaze = 0; sp._patrolCD = hab.time + (AI.hungerLevel(sp) >= 2 ? 0.3 : 1.5); setState(sp, 'idle'); }
  };
  H.lunge = function (hab, sp, dt) {
    const m = sp._lunge; if (!m) { setState(sp, 'idle'); return; }
    const e = hab.preyById(m.id) || hab.spider(m.id) || (hab._leaves || []).find(l => l.id === m.id); if (e && e.pos) m.pos = e.pos.slice();
    faceToward(sp, m.pos, dt, 10);
    if (sp.st > 0.28 && sp.st < 0.46) { // the dart: a short burst forward, never airborne
      const L = AI.len(sp); const d = M.dist2(sp.pos, m.pos); sp._lungeGone = sp._lungeGone || 0;
      const step = Math.min(L * 9 * dt, Math.max(0, Math.min(L * 1.4, d - L * 0.6) - sp._lungeGone));
      if (step > 0 && regionStep(hab, sp, horiz(M.sub(m.pos, sp.pos)), step)) sp._lungeGone += step;
    }
    if (sp.st > 1.2) { sp._lungeCD = hab.time + 3 + JT.R() * 4; sp._lunge = null; if (AI.hungerLevel(sp) >= 1) startScan(hab, sp); else setState(sp, 'idle'); }
  };

  // ---------------- off-screen lightweight simulation ----------------
  AI.liteUpdate = function (hab, dt) {
    for (const sp of hab.data.spiders) {
      sp.sat = Math.max(0.2, sp.sat - dt * 0.0008); sp.hyd = Math.max(0.25, sp.hyd - dt * 0.0005); sp.ageDays += dt / DAY;
      if (sp.stage === 5) sp.adultDays = (sp.adultDays || 0) + dt / DAY;
      if (sp.soft > 0) sp.soft = Math.max(0, sp.soft - dt);
      if (sp.sat < 0.5 && !sp.hold && JT.R() < dt * 0.01) {
        const p = hab.data.prey.find(q => !q.owner && JT.PREY_BY_ID[q.type].huntable && JT.PREY_BY_ID[q.type].len < AI.len(sp) * 1.4);
        if (p) { const def = JT.PREY_BY_ID[p.type]; hab.removeEntity(p); sp.sat = Math.min(1, sp.sat + def.nut); sp.meals++; sp.catches++; hab.addRemains(p.type, sp.pos, sp.sup, 'husk'); hab.event('meal', { sp, value: def.val, offscreen: true }); }
      }
    }
    if (hab.data.humidity > 0.6) for (const d of hab.data.drops) d.life -= dt;
  };

  /** Observation-mode interest of what a spider is doing right now. */
  AI.interest = function (sp) {
    const m = { pounce: 100, fall: 90, subdue: 90, molting: 95, moltSilk: 60, premolt: 45, crouch: 75, creep: 60, stalk: 55, track: 50, display: 65, flee: 70, carry: 60, feed: 42, drinkSeek: 30, drink: 38, notice: 45, assess: 45, moltSeek: 55, investigate: 35, inspect: 40, search: 30, postMolt: 40, avoid: 35, lunge: 55, dangle: 58, bask: 30, scan: 26, patrol: 28, scuttle: 20, cleanEyes: 22, stretch: 24 };
    return m[sp.state] || 8;
  };
  /** Discoverable personality descriptors (revealed as the player watches). */
  AI.descriptors = function (sp) {
    const o = sp.obsT || 0; if (o < 25) return null;
    const out = []; const P = sp.pers, T = sp.traits;
    const cands = [
      [P.curiosity, 'curious', 'reserved'], [T.patience, 'patient', 'restless'], [P.activity, 'busy', 'unhurried'], [T.bold, 'bold', 'cautious'],
      [T.tactics, 'observant', 'impulsive'], [P.territorial, 'territorial', 'easygoing'], [P.routine, 'steady', 'adaptable'], [P.cannibal, 'opportunistic hunter', 'picky eater'],
    ].map(([v, hi, lo]) => ({ s: Math.abs(v - 0.5), w: v > 0.5 ? hi : lo })).sort((a, b) => b.s - a.s);
    const n = o < 60 ? 1 : o < 150 ? 2 : o < 300 ? 3 : 4;
    for (let i = 0; i < n; i++) out.push(cands[i].w);
    return out;
  };
  AI.restore = function (hab, sp) {
    // transient plans don't persist; resume safely from saved biological state
    sp._route = null; sp._air = null; sp._plan = null;
    if (['pounce', 'fall'].includes(sp.state)) { const b = Nav.supportBelow(hab, sp.pos); sp.pos = b.pos; sp.sup = b.sup; sp.state = sp.hold ? 'subdue' : 'idle'; sp.st = 0; }
    if (HUNT.has(sp.state) || ['explore', 'patrol', 'scan', 'lunge', 'scuttle', 'dangle', 'look', 'baskSeek', 'homeSeek', 'search', 'drinkSeek', 'sleepSeek', 'flee', 'avoid', 'investigate'].includes(sp.state)) { sp.state = 'idle'; sp.target = null; }
    if (sp.state === 'carry') { sp.state = 'subdue'; sp.st = 99; sp._subdueDur = 0; }
    if (sp.state === 'feed') { const p = hab.preyById(sp.hold); if (p) { const def = JT.PREY_BY_ID[p.type]; sp._feedDur = 6 + (def.nut || 0.5) * 28; sp._feedNut = def.nut || 0.5; } else sp.state = 'idle'; }
    if (sp.state === 'subdue') sp._subdueDur = sp._subdueDur || 1;
    if (sp.state === 'moltSeek') sp.state = 'idle';
    if (sp.state === 'crouch') sp.state = 'idle';
    if (sp.home && !Nav.validSup(hab, sp.home.sup)) sp.home = null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
