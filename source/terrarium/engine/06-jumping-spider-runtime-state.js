/* Jumper Terrarium — jumping spider runtime state + behavior AI.
   Explicit priority model (higher wins; lower-priority decisions can never overwrite a higher route):
     molting 95 > premolt 90 > molt retreat 80-85 > pounce/fall 75 > held meal (subdue/carry/feed) 70
     > threat/flee 60 > thirst 50 > hunting 40-42 > hungry search 35 > sleep 30 > social 20
     > curiosity 15 > post-feed rest 10 > exploration/grooming/rest 0-5.
   Hunting: notice -> assess -> stalk (replans) -> creep -> crouch -> pounce -> catch/miss
            -> subdue -> carry (to a reachable safe spot) -> feed -> rest. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, G = JT.G, Nav = JT.Nav, Loco = JT.Loco;
  const AI = JT.SpiderAI = {};
  const DAY = 480;
  const PRI = AI.PRI = { idle: 0, explore: 2, lookout: 3, groom: 3, rest: 3, patrol: 34, watch: 4, fingerWatch: 6, curious: 14, antMarch: 2, semaphore: 18, nectarSeek: 12, sip: 12, display: 20, social: 20, avoid: 22,
    investigate: 15, inspect: 15, postFeed: 10, search: 35, sleepSeek: 30, sleep: 30,
    cleanEyes: 3, look: 3, scuttle: 3, stretch: 5, homeSeek: 3, baskSeek: 12, bask: 12, dangle: 45, scan: 34, lunge: 36,
    notice: 40, assess: 40, stalk: 40, creep: 41, crouch: 42, track: 40, peek: 40,
    drinkSeek: 50, drink: 50, flee: 60, pounce: 75, fall: 75, subdue: 70, secure: 70, carry: 70, feed: 70,
    moltSeek: 80, moltSilk: 85, premolt: 90, molting: 95, postMolt: 85, emerge: 86 };
  const HUNT = new Set(['notice', 'assess', 'stalk', 'creep', 'crouch', 'track', 'peek']);
  const MOLT = new Set(['moltSeek', 'moltSilk', 'premolt', 'molting', 'postMolt']);
  AI.HUNT = HUNT; AI.MOLT = MOLT;

  JT.PREY_BY_ID.jumperMeal = { id: 'jumperMeal', name: 'jumper', shape: 'spider', len: 6, nut: 0.8, struggle: 6, huntable: false };

  const sp_ = (sp) => JT.SPECIES_BY_ID[sp.species] || JT.SPECIES[0];
  AI.len = (sp) => sp_(sp).len * JT.STAGE_SCALE[M.clamp(sp.stage, 0, 5)];
  AI.jump = (sp) => (14 + AI.len(sp) * 3.0) * (0.75 + sp.traits.jump * 0.4) * (sp.soft > 0 ? 0.7 : 1) * elder(sp) * (JT.sigHas(sp_(sp), 'leap') && sp.stage >= 3 ? (sp_(sp).sig === 'titan' ? 1.4 : 1.25) : 1); // Hyllus (and its Titanica hybrid): power leaps
  // ---------------- species gaits ----------------
  // speed: travel-speed factor while going · go/stop: duration ranges (s) of walking bursts and pauses · snap: how fast it stops/starts
  const GAIT = AI.GAIT = {
    bouncy:   { speed: 1.05, go: [1.2, 2.5], stop: [0.08, 0.2] },
    patient:  { speed: 0.9,  go: [1.0, 2.2], stop: [0.2, 0.6] },
    heavy:    { speed: 0.82, go: [1.5, 3.0], stop: [0.2, 0.5] },
    skittish: { speed: 1.15, go: [0.5, 1.4], stop: [0.1, 0.35] },
    brisk:    { speed: 1.05, go: [1.5, 3.0], stop: [0.05, 0.15] },
    stopgo:   { speed: 1.3,  go: [0.3, 0.8], stop: [0.15, 0.45], snap: 18 },
    glide:    { speed: 0.95, go: [2.0, 4.0], stop: [0.3, 0.9] },
    hop:      { speed: 1.05, go: [0.6, 1.4], stop: [0.1, 0.3] },
    shuffle:  { speed: 0.95, go: [0.4, 0.9], stop: [0.1, 0.3] },
    twitchy:  { speed: 1.0,  go: [0.3, 0.9], stop: [0.1, 0.4], snap: 20 },
    ant:      { speed: 1.15, go: [2.0, 4.0], stop: [0.05, 0.12] },
    choppy:   { speed: 1.0,  go: [0.25, 0.6], stop: [0.25, 0.9], snap: 14 }, // Portia: slow, choppy, irregular pauses
  };
  const gaitOf = (sp) => GAIT[(sp_(sp).look || {}).gait] || GAIT.brisk;
  /** Mean travel-speed factor of a gait (bursts and pauses averaged): used for stuck/timeout estimates. */
  AI.gaitAvg = (sp) => { const G = gaitOf(sp); const g = (G.go[0] + G.go[1]) / 2, st = (G.stop[0] + G.stop[1]) / 2; return G.speed * g / (g + st); };
  function gaitTick(sp, dt) {
    const G = gaitOf(sp);
    sp._gT = (sp._gT == null ? JT.R() * G.go[1] : sp._gT) - dt;
    if (sp._gT <= 0) { sp._gGo = !sp._gGo; const r = sp._gGo ? G.go : G.stop; sp._gT = r[0] + JT.R() * (r[1] - r[0]); }
    sp._gPause = M.lerp(sp._gPause || 0, sp._gGo ? 0 : 1, Math.min(1, dt * (G.snap || 10)));
    sp._gaitK = G.speed * (1 - 0.97 * sp._gPause);
    // ant mimics weave from side to side while they travel (eased in and out, never while holding prey)
    const zig = (sp_(sp).look || {}).gait === 'ant' && sp._moving && !sp.hold ? 1 : 0;
    sp._zigK = M.lerp(sp._zigK || 0, zig, Math.min(1, dt * 3));
  }
  /** Ignicard: quicker at night and in the warmth of a heat lamp (cached for a second). */
  function emberK(hab, sp) { const c = sp._ek; if (c && hab.time - c.t < 1) return c.k; const k = 1 + (1 - hab.daylight()) * 0.15 + (hab.warmthAt ? hab.warmthAt(sp.pos) : 0) * 0.35; sp._ek = { t: hab.time, k }; return k; }
  AI.speed = (sp) => (9 + AI.len(sp) * 0.9) * (0.7 + sp.pers.activity * 0.5) * elder(sp) * (sp.soft > 0 ? 0.6 : 1) ;
  function elder(sp) { return sp.stage === 5 && sp.adultDays > 20 ? Math.max(0.8, 1 - (sp.adultDays - 20) * 0.006) : 1; }
  // jumpers walk, cling and jump — they never just drop off a ledge (no free-fall 'drop' edges).
  // Holding a meal shortens the leap a little, and makes leaping preferable to trudging over the open floor.
  AI.caps = (sp, carry, hunt) => ({ jump: AI.jump(sp) * (carry ? 0.85 : 1), climb: true, drop: false, carry: !!carry, hunt: !!hunt });
  AI.hungerLabel = (s) => s > 0.85 ? 'Full & Round' : s > 0.6 ? 'Content' : s > 0.35 ? 'Peckish' : 'Hungry';
  AI.moltNeed = (sp) => 3 + sp.stage;
  AI.STARVING = 0.15;
  /** Live food this jumper will actually go after. Cleanup crew is ignored unless the jumper is starving. */
  AI.huntableFor = (sp, d) => !!d && (d.huntable || (d.id === 'springtail' && sp.sat < AI.STARVING)) && !(sp.species === 'bagheera' && sp.sat > 0.38); // Bagheera: mostly vegetarian
  AI.nutOf = (d) => d ? (d.nut || (d.id === 'springtail' ? 0.05 : 0)) : 0;
  /** Is there anything left in the habitat this jumper could eat? */
  AI.preyAvailable = (hab, sp) => hab.data.prey.some(p => !p.owner && !p.buried && !p.dead && AI.huntableFor(sp, JT.PREY_BY_ID[p.type]));
  AI.hungerLevel = (sp) => sp.sat < 0.2 ? 2 : sp.sat < 0.4 ? 1 : 0;
  /** Camouflage: the colour-matched piece a jumper of this species is sitting on (or the matching leaf litter it
      is standing in), or null. Pieces list the species they suit in def.blend. */
  AI.blendAt = function (hab, species, sup, pos) {
    if (!sup || !pos) return null;
    if (hab._blendN !== hab.data.decor.length || !(Math.abs((hab.time || 0) - (hab._blendChk || 0)) < 2)) { hab._blendN = hab.data.decor.length; hab._blendChk = hab.time || 0; hab._hasBlend = hab.data.decor.some(i => { const g = hab.geoms[i.id]; return g && g.def && g.def.blend; }); }
    if (!hab._hasBlend) return null;
    if (sup.d) { const g = hab.geoms[sup.d]; if (g && g.def && g.def.blend && g.def.blend.includes(species)) return g.def; }
    if (sup.k === 'floor') for (const inst of hab.data.decor) { const g = hab.geoms[inst.id]; if (!g || !g.def || g.def.cat !== 'ground' || !g.def.blend || !g.def.blend.includes(species)) continue;
      if (Math.hypot(pos[0] - g.center[0], pos[2] - g.center[2]) < g.coverR * 0.9) return g.def; }
    return null;
  };
  /** Cached per jumper (re-checked twice a second). */
  AI.blendPiece = function (hab, sp) {
    if (!sp || sp._air || (sp.sup && sp.sup.k === 'air')) return null;
    if (sp._blendAt != null && Math.abs(hab.time - sp._blendAt) < 0.5) return sp._blendDef || null;
    sp._blendAt = hab.time; sp._blendDef = AI.blendAt(hab, sp.species, sp.sup, sp.pos); return sp._blendDef;
  };
  /** Biggest prey (length relative to its own) a jumper will take on: about its own size when fed, ~1.4x when
      hungry, up to ~1.9x when starving; bold ones push it further. Never more than 2x (slings far less). */
  AI.sizeLimit = function (sp) {
    const sat = sp.sat; let k;
    if (sat >= 0.62) k = 1.0; else if (sat >= 0.35) k = 1.0 + (0.62 - sat) / 0.27 * 0.4; else if (sat >= 0.18) k = 1.4 + (0.35 - sat) / 0.17 * 0.45; else k = 1.9;
    k += ((sp.traits && sp.traits.bold) || 0.5) * 0.3 - 0.15;
    if (sp_(sp).sig === 'titan' && sp.stage >= 3) k += 0.3; // Titanica: tackles enormous prey
    return M.clamp(k, 0.8, sp.stage <= 1 ? 1.5 : sp.stage === 2 ? 1.75 : sp_(sp).sig === 'titan' ? 2.3 : 2);
  };
  AI.ratioOf = (sp, e) => (e.species ? AI.len(e) : (e.len || (JT.PREY_BY_ID[e.type] || { len: 3 }).len || 3)) / Math.max(0.5, AI.len(sp));
  /** Soft after a molt, or getting ready to molt: no big fights. */
  AI.fragile = (sp) => sp.soft > 0 || MOLT.has(sp.state) || AI.moltReady(sp);
  const KICKERS = new Set(['cricket', 'pinhead', 'leafhopper', 'locust', 'redrunner', 'katydid', 'silverfish']);
  const TINY = AI.TINY = new Set(['aphid', 'fruitfly', 'gnat']);
  const famOf = (p) => JT.STRUGGLE[JT.preyFamily(p && JT.PREY_BY_ID[p.type])] || JT.STRUGGLE.feeble;
  AI.famOf = famOf;
  const pose = (sp) => sp._pz || (sp._pz = { r: 0, p: 0, l: 0, vr: 0, vp: 0, vl: 0, flipT: 0, flipS: 1 });
  /** Prey detection multiplier: a matching jumper that keeps still (or sneaks) is about a quarter harder to see. */
  AI.camoK = function (hab, sp) {
    const still = (sp._speedNow || 0) < 0.5; const sneaking = sp.state === 'crouch' || sp.state === 'creep' || sp.state === 'stalk';
    return (still || sneaking) && AI.blendPiece(hab, sp) ? 0.74 : 1;
  };

  function usedNames() { const s = new Set(); if (JT.game) { for (const h of JT.game.habs) for (const x of h.data.spiders) s.add(x.name); for (const x of (JT.game.state && JT.game.state.cup) || []) s.add(x.name); } return s; }
  AI.create = function (hab, speciesId, o) {
    const S = JT.SPECIES_BY_ID[speciesId] || JT.SPECIES[0]; const R = JT.R;
    const jit = (v, a) => M.clamp(v + (R() - 0.5) * 2 * a, 0.02, 1);
    const used = usedNames(); const free = JT.NAMES.filter(n => !used.has(n));
    const pos = o.pos || hab.randomFloorPoint();
    const sp = {
      id: JT.newId('s'), species: S.id, name: o.name || (free.length ? R.pick(free) : R.pick(JT.NAMES) + ' ' + (2 + Math.floor(R() * 8))),
      seed: (R() * 1e9) | 0, stage: o.stage != null ? o.stage : 1, meals: o.meals || Math.floor(R() * 2), molts: 0,
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
    sp.target = null; sp._plan = null; sp._tVis = null; sp._paceNow = null;
    if (HUNT.has(sp.state)) { sp._route = null; setState(sp, 'idle'); }
  };
  function targetEnt(hab, sp) { if (!sp.target) return null; return sp.target.kind === 'spider' ? hab.spider(sp.target.id) : hab.preyById(sp.target.id); }
  AI.targetEnt = targetEnt;
  function targetDef(hab, sp, t) {
    if (sp.target.kind === 'spider') { const L = AI.len(t); return { name: t.name + ' the ' + sp_(t).name.toLowerCase(), len: L, nut: 0.25 + L * 0.05, struggle: 6, reflex: 0.5, danger: 0.3, sense: 40 }; }
    return JT.PREY_BY_ID[t.type];
  }
  function preyName(d) { const n = d.name.toLowerCase(); return n.replace(/ies$/, 'y').replace(/oes$/, 'o').replace(/s$/, '').replace('fruit fly', 'fruit fly').replace('dubia nymph', 'dubia nymph'); }
  AI.preyName = preyName;
  function decorName(hab, id) { const inst = id && hab.decorById(id); return inst ? JT.DECOR_BY_ID[inst.type].name.toLowerCase() : null; }

  function faceToward(sp, target, dt, rate) {
    const d = M.sub(target, sp.pos); d[1] = 0; if (M.len(d) < 1e-3) return;
    const want = M.norm(d); const f = sp.fwd || [1, 0, 0];
    const k = Math.min(1, dt * (rate || 4));
    sp.fwd = M.norm([M.lerp(f[0], want[0], k), sp.sup.k === 'path' ? f[1] * (1 - k) : 0, M.lerp(f[2], want[2], k)]);
  }
  function horiz(v) { return M.norm([v[0], 0, v[2]]); }
  /** Direction to a point within the surface the jumper stands on (works on floors, walls, branches, undersides). */
  function inPlaneDir(hab, sp, target) {
    const n = sp.sup && sp.sup.k !== 'air' ? Nav.supFrame(hab, sp.sup).n : [0, 1, 0];
    const d = M.sub(target, sp.pos); const t = M.sub(d, M.mul(n, M.dot(d, n)));
    return { n, dir: M.len(t) > 1e-3 ? M.norm(t) : null };
  }
  /** Signed angle (rad) from the body's facing to the target, measured in the surface plane (+ = toward body's side axis). */
  function aimResidual(hab, sp, target) {
    const { n, dir } = inPlaneDir(hab, sp, target); if (!dir) return 0;
    let f = sp.fwd || [1, 0, 0]; f = M.sub(f, M.mul(n, M.dot(f, n))); if (M.len(f) < 1e-3) return 0; f = M.norm(f);
    const s = M.norm(M.cross(n, f)); return Math.atan2(M.dot(dir, s), M.dot(dir, f));
  }
  /** Turn the body to face a target exactly: quick, even turn within the surface plane, snapping once aligned. */
  function aimAt(hab, sp, target, dt, speed) {
    const { n, dir } = inPlaneDir(hab, sp, target); if (!dir) return;
    let f = sp.fwd || [1, 0, 0]; f = M.sub(f, M.mul(n, M.dot(f, n))); f = M.len(f) < 1e-3 ? dir : M.norm(f);
    const s = M.norm(M.cross(n, f)); const a = Math.atan2(M.dot(dir, s), M.dot(dir, f));
    const step = (speed || 7) * dt;
    if (Math.abs(a) <= step || Math.abs(a) < 0.015) { sp.fwd = dir; return; }
    const r = Math.sign(a) * step; sp.fwd = M.norm(M.add(M.mul(f, Math.cos(r)), M.mul(s, Math.sin(r))));
  }
  AI.aimResidual = aimResidual;

  // ---------------- needs ----------------
  function needs(hab, sp, dt) {
    const sleeping = sp.state === 'sleep' || sp.state === 'premolt' || sp.state === 'molting';
    sp.sat = Math.max(0, sp.sat - dt * 0.00188 * (sleeping ? 0.35 : 1)); // ~17.5% hungrier than the original 0.0016
    sp.hyd = Math.max(0, sp.hyd - dt * 0.0011 * (1.3 - hab.data.humidity * 0.6));
    sp.ageDays += dt / DAY;
    if (sp.stage === 5) { sp.adultDays = (sp.adultDays || 0) + dt / DAY; if (sp.adultDays > 12 && !sp.veteran) { sp.veteran = true; hab.event('journal', { id: 'veteran', sp }); } }
    if (sp.soft > 0) sp.soft = Math.max(0, sp.soft - dt);
    for (const k in sp.mem.ignore) if (sp.mem.ignore[k] < hab.time) delete sp.mem.ignore[k];
  }
  AI.moltReady = (sp) => sp.stage < 5 && sp.meals >= AI.moltNeed(sp) && sp.sat >= 0.45 && !MOLT.has(sp.state);

  // ---------------- sight: nothing is seen, or pounced on, through solid decor ----------------
  const lenOfE = (e) => e.species ? AI.len(e) : ((JT.PREY_BY_ID[e.type] || { len: 3 }).len || 3);
  /** Where an animal visibly is: path supports are centre lines, the body sits on the surface (radius along the normal). */
  AI.surfPt = function (hab, e, lift) {
    const fr = e.sup && e.sup.k !== 'air' && Nav.validSup(hab, e.sup) ? Nav.supFrame(hab, e.sup) : { n: [0, 1, 0], r: 0 };
    return M.add(e.pos, M.mul(fr.n, (fr.r || 0) + (lift || 0)));
  };
  /** Does a straight segment pass through any solid decor volume? skipA/skipB: ignore that much at each end (contact). */
  function segBlocked(hab, a, b, skipA, skipB, step) {
    const L = M.dist(a, b); if (!(L > 0.05)) return false;
    const n = Math.max(2, Math.ceil(L / (step || 1.4))); const S = JT.Solid; if (!S) return false;
    const lo0 = Math.min(a[0], b[0]), lo1 = Math.min(a[1], b[1]), lo2 = Math.min(a[2], b[2]), hi0 = Math.max(a[0], b[0]), hi1 = Math.max(a[1], b[1]), hi2 = Math.max(a[2], b[2]);
    for (const inst of hab.decor) {
      const g = hab.geoms[inst.id]; if (!g || !g.prims) continue; const so = S.of(g); const bb = so.bb; if (!so.list.length) continue;
      if (bb[3] < lo0 || bb[0] > hi0 || bb[4] < lo1 || bb[1] > hi1 || bb[5] < lo2 || bb[2] > hi2) continue;
      for (let k = 1; k < n; k++) {
        const t = k / n, d0 = t * L; if (d0 < (skipA || 0) || L - d0 < (skipB || 0)) continue;
        const p = M.lerp3(a, b, t);
        if (p[0] < bb[0] || p[1] < bb[1] || p[2] < bb[2] || p[0] > bb[3] || p[1] > bb[4] || p[2] > bb[5]) continue;
        for (const pr of so.list) if (S.depth(p, pr) > 0.3) return true;
      }
    }
    return false;
  }
  AI.segBlocked = segBlocked;
  /** Eye point of a jumper (or a hypothetical one standing at pos/sup). */
  function eyeOf(hab, sp, pos, sup) { return AI.surfPt(hab, pos ? { pos, sup } : sp, AI.len(sp) * 0.35); }
  /** Line of sight from an eye point to an animal. The surface a jumper clings to hides whatever is on its far side. */
  function sightFrom(hab, sp, eye, sup, e) {
    const tp = AI.surfPt(hab, e, Math.min(lenOfE(e) * 0.3, 1.5));
    if (sup && sup.k === 'path' && Nav.validSup(hab, sup)) { const fr = Nav.supFrame(hab, sup); if ((fr.r || 0) > 0.9) { const dir = M.norm(M.sub(tp, eye)); if (M.dot(fr.n, dir) < -0.3) return false; } }
    if (JT.Terrain && JT.Terrain.blocks(hab, eye, tp) && JT.R() < 0.65) return false; // v15: a crest of ground between them often hides small things
    return !segBlocked(hab, eye, tp, 0.5, Math.min(1.2, lenOfE(e) * 0.4 + 0.4));
  }
  /** Can this jumper see e right now? (cached briefly per pair) */
  function canSee(hab, sp, e) {
    const c = sp._vis || (sp._vis = {}); const k = e.id; const now = hab.time; const h = c[k];
    if (h && now - h.t < 0.25 && M.dist(h.p, e.pos) < 0.8 && M.dist(h.q, sp.pos) < 0.8) return h.v;
    const v = sightFrom(hab, sp, eyeOf(hab, sp), sp.sup, e);
    c[k] = { t: now, v, p: e.pos.slice(), q: sp.pos.slice() };
    if (Object.keys(c).length > 40) sp._vis = {};
    return v;
  }
  AI.canSee = canSee; AI.noteSeen = (h, s, e) => noteSeen(h, s, e);
  /** Remember where an animal was last seen (memory used when it slips out of view). */
  function noteSeen(hab, sp, e) { const ls = sp._ls || (sp._ls = {}); ls[e.id] = { pos: e.pos.slice(), sup: e.sup ? JT.deepClone(e.sup) : { k: 'floor' }, fwd: (e.fwd || [1, 0, 0]).slice(), t: hab.time }; }

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
      const motion = v > 1 || e.state === 'twitch' ? 1 : 0.28;
      const cover = Nav.coverAt(hab, e.pos);
      const covF = 1 - cover * (motion > 0.5 ? 0.45 : 0.85);
      const distF = Math.max(0, 1 - d / (R0 * (veryHungry ? 1.7 : 1)));
      let p = ang * motion * covF * (0.35 + distF) * 1.4;
      if (veryHungry && motion > 0.5) p = Math.max(p, 0.5); // vibration/motion sense when starving
      if (e.sup && e.sup.k === 'air') p *= 0.8;
      if (JT.R() < p) { if (!canSee(hab, sp, e)) return; if (!seen[e.id]) sp._noticedAt = now; seen[e.id] = now; noteSeen(hab, sp, e); }
    };
    for (const p of hab.data.prey) { if (p.owner || p.buried || p.dead) continue; const d = JT.PREY_BY_ID[p.type]; if (!AI.huntableFor(sp, d)) continue; consider(p); }
    if (sp.sat < 0.32 && sp.pers.cannibal > 0.5) for (const o of hab.data.spiders) if ((o !== sp && !MOLT.has(o.state) || (o !== sp && o.soft > 0)) && !(JT.sigHas(sp_(o), 'ant') && !JT.sigHas(sp_(sp), 'ant') && sp.sat > 0.12)) consider(o, true); // the ant disguise works
  }
  function scoreTarget(hab, sp, e, isSpider) {
    const def = isSpider ? null : JT.PREY_BY_ID[e.type];
    const L = AI.len(sp); const pl = isSpider ? AI.len(e) : def.len; const ratio = pl / L;
    const hungry = sp.sat < 0.35; const starving = sp.sat < 0.18;
    const wk = !isSpider && JT.PreyAI.weakK ? JT.PreyAI.weakK(e) : 0; // a groggy escapee is an easy second chance
    const maxR = AI.sizeLimit(sp) + wk * 0.25;
    if (ratio > maxR) return -1;
    if (ratio > 1 && AI.fragile(sp)) return -1; // never a big fight while soft or about to molt
    const crumbs = !isSpider && !def.huntable; // springtails: only worth it when starving
    if (ratio < 0.08 && L > 6 && !crumbs) return -1;
    let danger = (isSpider ? 0.4 : def.danger) * ratio * (1 - wk * 0.6); if (isSpider && e.soft > 0) danger *= 0.3;
    if (danger > sp.traits.bold * 0.8 + (hungry ? 0.3 : 0) + (starving ? 0.25 : 0)) return -1;
    if (isSpider) { const el = AI.len(e); if (!(L > el * 1.35 || (e.soft > 0 && L > el * 0.95))) return -1; }
    const d = M.dist(sp.pos, e.pos);
    const nut = isSpider ? 0.6 : AI.nutOf(def);
    let s = nut * 10 - d * 0.04 - danger * 5 + (ratio > 0.25 && ratio < 1 ? 2 : 0) + (crumbs ? 2.5 : 0);
    const v = e._vel ? M.len(e._vel) : 0; if (v > 1) s += 1;
    if (sp.mem.ignore[e.id] && !starving && !wk) s -= 8;
    if (sp._wary && sp._wary[e.id] > hab.time && !wk) s -= 6; // the one that just threw it off
    if (wk > 0) s += 3 + wk * 4;
    if (e.sup && e.sup.k === 'air') s -= 1.5;
    if (!isSpider) {
      // v12 smart AI: learn per prey type from its own catches and misses
      const pt = sp.mem.ptype && sp.mem.ptype[e.type]; if (pt) s += ((pt.c + 1) / (pt.c + pt.m + 2) - 0.5) * 3;
      // v12 smart AI: don't fight a tankmate for the same prey unless hungry
      if (!starving && !wk) { const sps = hab.data.spiders; for (let i = 0; i < sps.length; i++) { const o = sps[i]; if (o !== sp && o.target && o.target.id === e.id) { s -= M.dist(o.pos, e.pos) < M.dist(sp.pos, e.pos) ? 4 : 1.5; break; } } }
    }
    if (isSpider) s -= 2;
    return s;
  }
  function chooseTarget(hab, sp) {
    const seen = sp._seen || {}; let best = null, bs = 0.5; const now = hab.time;
    const J = AI.jump(sp);
    const opportunist = sp.sat >= 0.62 && sp.sat < 0.86;
    if (sp.sat >= 0.86) return null;
    for (const id in seen) {
      let e = hab.preyById(id), isS = false; if (!e) { e = hab.spider(id); isS = !!e; } if (!e || e === sp) continue;
      if (!isS && (e.owner || e.buried)) continue;
      if (now - seen[id] > 1.5 && !canSee(hab, sp, e)) continue; // out of view for a while: not worth starting on
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
    const canHunt = sp.soft < 40 && !(sp._hesitate > hab.time); // just shaken off: a few seconds of hesitation
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
    if (dl < 0.2 && sp.sat > (sp_(sp).sig === 'ember' ? 0.92 : 0.3) && cur < 30 && sp.state !== 'sleep') { startSleep(hab, sp); return; } // Ignicard hunts by night
    if (cur >= 30) return;
    if (cur < 12 && AI.wantsWarmth(hab, sp) && startBask(hab, sp)) return;
    if (cur < 20 && social(hab, sp)) return;
    if (cur < 15 && curiosity(hab, sp)) return;
    if (sp.state === 'idle') pickIdle(hab, sp);
  };

  // ---------------- awareness: every jumper keeps an eye on whatever moves around it ----------------
  const AWARE_SKIP = new Set(['sleep', 'moltSilk', 'premolt', 'molting', 'postMolt', 'emerge', 'pounce', 'fall', 'flee']);
  function aware(hab, sp, dt) {
    if (sp._glance && hab.time > sp._glance.until) sp._glance = null;
    if (sp._dodge) { sp._dodge.t -= dt; if (sp._dodge.t <= 0 || sp._air) sp._dodge = null; else if (sp.sup.k === 'floor' || sp.sup.k === 'top') regionStep(hab, sp, sp._dodge.dir, AI.speed(sp) * 0.9 * dt); }
    sp._awT = (sp._awT || 0) - dt; if (sp._awT > 0 || sp._glNext > hab.time) return; sp._awT = 0.25 + JT.R() * 0.1;
    if (AWARE_SKIP.has(sp.state) || sp._air || sp._hang || (sp.nest && NEST_STATES.has(sp.state))) return;
    const L = AI.len(sp); const R0 = Math.max(16, L * 5.5); const f = horiz(sp.fwd || [1, 0, 0]);
    const tid = sp.target && sp.target.id; const gl = sp._glCD || (sp._glCD = {});
    let best = null, bs = 0.3;
    const consider = (e, kind) => {
      if (e.id === tid || e.id === sp.hold) return;
      const dv = M.sub(e.pos, sp.pos); const d = M.len(dv); if (d > R0 || d < 0.2) return;
      const vel = e._vel || (e._moving && e.fwd ? M.mul(e.fwd, 3) : null); const v = vel ? M.len(vel) : 0; const moving = v > 1;
      const to = M.mul(dv, 1 / d); if (M.dot(f, horiz(to)) < -0.55 && d > L * 1.6) return; // blind spot right behind (unless touching close)
      if (!moving && d > L * 1.8) return;
      const el = lenOfE(e); const ratio = el / L; const appr = moving ? -M.dot(M.mul(vel, 1 / v), to) : 0; // > 0: coming at the jumper
      let s = (moving ? 1 : 0.45) * (1 - d / R0) * (0.6 + Math.min(1.5, ratio)) * (appr > 0.4 ? 1.6 : 1);
      if (gl[e.id] > hab.time) s *= 0.2;
      if (s <= bs) return;
      if (d > L * 1.4 && !canSee(hab, sp, e)) return; // very close: felt through the legs even when hidden
      bs = s; best = { e, d, ratio, appr, kind, el };
    };
    for (const p of hab.data.prey) if (!p.owner && !p.buried && !p.dead) consider(p, 'prey');
    for (const o of hab.data.spiders) if (o !== sp && !NEST_STATES.has(o.state)) consider(o, 'spider');
    if (best) react(hab, sp, best);
  }
  function react(hab, sp, b) {
    const L = AI.len(sp), e = b.e; const def = b.kind === 'prey' ? JT.PREY_BY_ID[e.type] : null;
    const name = b.kind === 'spider' ? e.name : preyName(def);
    const threat = b.ratio * (1 + (def ? def.danger || 0 : 0.4) * 2) * (b.appr > 0.3 ? 1.3 : 1) * (1.15 - sp.traits.bold * 0.5);
    const close = b.d < L * 2.2 + b.el * 0.6; const hunting = HUNT.has(sp.state); const pri = PRI[sp.state] || 0;
    sp._glCD[e.id] = hab.time + 7 + JT.R() * 6; sp._glNext = hab.time + (close ? 0.8 : 1.6) + JT.R() * 1.6;
    for (const k in sp._glCD) if (sp._glCD[k] < hab.time) delete sp._glCD[k];
    // a quick head turn toward it — always
    sp._glance = { id: e.id, pos: e.pos.slice(), until: hab.time + (hunting ? 0.35 : 0.7 + JT.R() * 0.6) };
    hab.event('glance', { sp });
    if (sp.hold) {
      if (sp.state !== 'feed') return;
      sp._chewPause = hab.time + 0.9;
      const n = (sp._intrT > hab.time ? (sp._intr || 0) : 0) + (close ? 1 : 0); sp._intr = n; sp._intrT = hab.time + 10;
      if (close && (sp._awayN || 0) < 2 && !(sp._awayCD > hab.time) && (threat > 0.6 || n >= 3 || (b.appr > 0.6 && b.ratio > 0.4))) { sp._intr = 0; sp._awayN = (sp._awayN || 0) + 1; sp._awayCD = hab.time + 15; startCarry(hab, sp, { pos: e.pos.slice(), name }); return; }
      if (close) { sp._shield = { pos: e.pos.slice(), until: hab.time + 1.6 }; sp.thought = 'Shielding its meal from the ' + name + '.'; }
      return;
    }
    if (hunting) {
      if (close && threat > 1.1 && b.appr > 0.2) { AI.dropTarget(hab, sp); backOff(hab, sp, e, 'Backing away from the ' + name + '.'); return; }
      if (close && threat > 0.55 && sp.state !== 'crouch') { const away = horiz(M.sub(sp.pos, e.pos)); const f = horiz(sp.fwd || [1, 0, 0]); const sd = M.dot([-f[2], 0, f[0]], away) > 0 ? 1 : -1; sp._dodge = { dir: M.norm([-f[2] * sd + away[0] * 0.5, 0, f[0] * sd + away[2] * 0.5]), t: 0.35 }; }
      return;
    }
    if (pri >= 30) return; // drinking, sleeping, fleeing…: the glance is enough
    if (close && threat > 0.55) { backOff(hab, sp, e, 'Backing away from the ' + name + '.'); return; }
    if (pri < 15 && b.kind === 'prey' && JT.R() < 0.6) { sp._watchPos = e.pos.slice(); setState(sp, 'watch', 'Something moved — watching the ' + name + '.'); }
  }
  /** Get clear of something too big: a short retreat along the graph (or a quick sideways scuttle). */
  function backOff(hab, sp, e, thought) {
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); let best = null, bs = -1e9;
    for (let k = 0; k < 40; k++) { const n = hab.nav.nodes[Math.floor(JT.R() * hab.nav.nodes.length)]; if (!n || n.kind === 'face' || !isFinite(dj.dist[n.id])) continue; const s = Math.min(40, M.dist(n.pos, e.pos)) - dj.dist[n.id] * 0.4; if (s > bs) { bs = s; best = n; } }
    const r = best && Nav.buildRoute(hab, dj, best.sup, best.pos);
    if (r && M.dist(best.pos, e.pos) > M.dist(sp.pos, e.pos) + 4) { sp._route = r; sp._routeStart = hab.time; sp._watchPos = e.pos.slice(); setState(sp, 'avoid', thought); return; }
    if (!startScuttle(hab, sp)) { sp._watchPos = e.pos.slice(); setState(sp, 'watch', thought); }
  }
  AI.aware = aware;

  // ---------------- main update ----------------
  AI.update = function (hab, sp, dt) {
    needs(hab, sp, dt);
    sp.st += dt;
    sp._thinkT = (sp._thinkT || 0) - dt;
    if (sp._thinkT <= 0) { sp._thinkT = 0.3 + JT.R() * 0.25; AI.decide(hab, sp); }
    const h = H[sp.state] || H.idle;
    const before = sp.pos.slice();
    aware(hab, sp, dt);
    if (hab.finger) AI.fingerReact(hab, sp);
    (H[sp.state] || h)(hab, sp, dt);
    const moved = M.dist(before, sp.pos); sp._walk = (sp._walk || 0) + moved / Math.max(0.5, AI.len(sp) * 0.32);
    sp._moving = moved > 0.02;
    sp._speedNow = M.dist(before, sp.pos) / Math.max(dt, 1e-3);
    // a route jump/drop abandoned mid-air (state changed, route cleared or replaced) must never leave the spider hanging
    if (sp._air && sp._air.mode && sp.state !== 'pounce' && sp.state !== 'fall' && (!sp._route || sp._route.steps[sp._route.i] !== sp._air.step)) { sp._air = null; sp.sup = { k: 'air' }; }
    if (sp.sup && sp.sup.k === 'air' && !sp._air && sp.state !== 'pounce' && sp.state !== 'fall') startFall(hab, sp);
    if (!M.finite3(sp.pos)) { const b = Nav.supportBelow(hab, [hab.dims.w / 2, 0, hab.dims.d / 2]); sp.pos = b.pos; sp.sup = b.sup; sp._route = null; setState(sp, 'idle'); }
    if (sp.hold) { const p = hab.preyById(sp.hold); if (p) { p.pos = AI.mouth(hab, sp); p.sup = JT.deepClone(sp.sup); p.fwd = sp.fwd; } }
    // micro animation drivers
    gaitTick(sp, dt);
    sp._breath = (sp._breath || 0) + dt * (sp.state === 'sleep' ? 1.2 : 2.4);
    const sneak = sp.state === 'stalk' || sp.state === 'creep';
    if (!sneak && sp.state !== 'crouch') { sp._low = 0; sp._watched = 0; }
    // sneaking body height follows the stalking pace: lowest while inching or frozen, higher on the brisk approach
    const brace = sp.state === 'subdue' && !sp._hang ? 0.35 + 0.4 * Math.min(1, sp._strug0 || 0) : 0;
    sp._crouch = M.lerp(sp._crouch || 0, sp.state === 'crouch' ? 1 : sneak ? 0.3 + 0.55 * (sp._low || 0) : brace, Math.min(1, dt * 4));
    const raise = (HUNT.has(sp.state) && sp.state !== 'assess') || sp.state === 'display' || sp.state === 'inspect' || sp.state === 'watch' || sp.state === 'curious' || sp.state === 'fingerWatch' || sp.state === 'semaphore' ? 1 : 0;
    sp._legRaise = M.lerp(sp._legRaise || 0, raise, Math.min(1, dt * 5));
    if (sp.state === 'lunge' && sp.st < 0.3) sp._crouch = M.lerp(sp._crouch, 1, Math.min(1, dt * 10));
    if (sp._prepT > 0) sp._crouch = M.lerp(sp._crouch, 0.55, Math.min(1, dt * 8));
    if (sp.state === 'scan' || sp.state === 'lunge') sp._legRaise = M.lerp(sp._legRaise, sp.state === 'lunge' ? 1 : 0.45, Math.min(1, dt * 5));
    // pounce: front legs reach straight out at the prey; on contact they wrap around it (securing + feeding, not carrying)
    sp._reach = M.lerp(sp._reach || 0, sp.state === 'pounce' ? 1 : 0, Math.min(1, dt * (sp.state === 'pounce' ? 16 : 8)));
    const hugT = sp.hold && (sp.state === 'subdue' || sp.state === 'secure' || sp.state === 'feed' || (sp.state === 'fall' && sp._afterFall === 'subdue')) ? 1 : 0;
    sp._hug = M.lerp(sp._hug || 0, hugT, Math.min(1, dt * (hugT ? 12 : 6)));
    // close approach: the first two leg pairs point forward at the prey while creeping and crouching
    sp._fore = M.lerp(sp._fore || 0, sp.state === 'creep' || sp.state === 'crouch' ? 1 : 0, Math.min(1, dt * 3));
    // body condition: the abdomen slims down when hungry and plumps up after a meal (eased, never pops)
    const fatT = M.clamp(0.68 + Math.min(1.05, sp.sat) * 0.55, 0.68, 1.26);
    sp._fatNow = sp._fatNow == null ? fatT : M.lerp(sp._fatNow, fatT, Math.min(1, dt * 0.5));
    sp._flat = M.lerp(sp._flat || 0, sp.state === 'bask' ? 1 : 0, Math.min(1, dt * 1.6));
    sp._stretchK = M.lerp(sp._stretchK || 0, sp.state === 'stretch' ? 1 : 0, Math.min(1, dt * 3));
    sp._wipe = M.lerp(sp._wipe || 0, sp.state === 'cleanEyes' ? 1 : 0, Math.min(1, dt * 4));
    if (sp._hang && sp.state === 'subdue') sp._dangleVis = sp._hang.k;
    else { if (sp._hang) { sp._hang = null; sp._dangleOff = null; sp._dangleVis = 0; } sp._dangleVis = M.lerp(sp._dangleVis || 0, sp.state === 'dangle' ? (sp._dangleK || 0) : 0, Math.min(1, dt * (sp.state === 'dangle' ? 6 : 2.5))); }
    if (sp.state !== 'dangle' && !sp._hang && sp._dangleVis < 0.01) sp._dangleOff = null;
    if (sp.state !== 'subdue') sp._strug = 0;
    if (sp._pz && sp.state !== 'subdue' && sp.state !== 'secure') { const P = sp._pz; P.flipT = 0; poseStep(P, dt); if (Math.abs(P.r) + Math.abs(P.p) + P.l + Math.abs(P.vr) + Math.abs(P.vp) + Math.abs(P.vl) < 0.01) sp._pz = null; }
    // palp flicks: little twitches, more often while alert
    sp._flickT = (sp._flickT == null ? JT.R() * 4 : sp._flickT) - dt;
    if (sp._flickT <= 0) { sp._flickT = (HUNT.has(sp.state) || sp.state === 'scan' ? 0.8 : 2.5) + JT.R() * 5; if (!NEST_STATES.has(sp.state) && sp.state !== 'feed') sp._flick = 1; }
    sp._flick = Math.max(0, (sp._flick || 0) - dt * 2.6);
    // locked on: while hunting, the big front eyes point straight at the prey — the head takes up whatever the body
    // has not turned yet (no idle glances, no lag)
    const lockE0 = (HUNT.has(sp.state) || sp.state === 'lunge') && !sp._air ? targetEnt(hab, sp) : null;
    const lockE = lockE0 && sp.state !== 'peek' ? (sp.state === 'lunge' ? lockE0 : known(hab, sp, lockE0)) : null; // eyes go where it is believed to be
    const glance = sp._glance && hab.time < sp._glance.until && sp._glance.pos && !sp._air ? sp._glance : null;
    if (glance) { // a quick head turn toward something that moved, then back
      const a = aimResidual(hab, sp, glance.pos); sp._gaze = M.clamp(a, -0.75, 0.75) / 0.3; sp._gazeT = 0.4;
      sp._gazeNow = M.lerp(sp._gazeNow || 0, sp._gaze, Math.min(1, dt * 18));
      if ((PRI[sp.state] || 0) < 15 && sp.sup.k !== 'path' && Math.abs(a) > 0.9) faceToward(sp, glance.pos, dt, 3);
    } else if (lockE && lockE.pos && M.finite3(lockE.pos)) {
      const a = aimResidual(hab, sp, lockE.pos);
      sp._gaze = M.clamp(a, -0.75, 0.75) / 0.3; sp._gazeT = 0.6; sp._locked = true;
      sp._gazeNow = M.lerp(sp._gazeNow || 0, sp._gaze, Math.min(1, dt * 16));
    } else {
      if (sp._locked) { sp._locked = false; sp._gaze = 0; }
      if (sp.state !== 'scan' && sp.state !== 'look') sp._gazeT = (sp._gazeT || 0) - dt; if (sp._gazeT <= 0) { sp._gazeT = 0.6 + JT.R() * 2.5; sp._gaze = (JT.R() - 0.5) * 0.7 * (1 - (sp._legRaise || 0)); }
      sp._gazeNow = M.lerp(sp._gazeNow || 0, sp._gaze || 0, Math.min(1, dt * 8));
    }
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
    const gk = !urgent && !sp._air && sp._gaitK != null && (!HUNT.has(sp.state) || gaitOf(sp) === GAIT.choppy) ? sp._gaitK : 1; // species gait: bursts and pauses (never mid-air; hunts stay smooth except Portia's choppy stalk)
    const ek = sp_(sp).sig === 'ember' ? emberK(hab, sp) : 1;
    return Loco.follow(hab, sp, dt, AI.speed(sp) * (mult || 1) * gk * ek, {
      onLaunch: (st) => { if (st.mode === 'jump') { sp._anchor = sp.pos.slice(); hab.event('jump', { sp }); if (JT.sigHas(sp_(sp), 'leap') && st.pos && M.dist(st.pos, sp.pos) > AI.len(sp) * 1.2 + 12) { sp.thought = 'A huge power leap across the tank!'; hab.event('bigLeap', { sp, to: st.pos.slice() }); hab.event('journal', { id: 'giantLeap', sp }); if (sp_(sp).sig === 'titan' && sp._detourT > hab.time - 60) hab.event('journal', { id: 'titanLeap', sp }); } } },
      onLand: (st) => { if (sp._anchor) { hab.addSilk(sp._anchor, sp.pos, 'drag'); sp._anchor = null; hab.event('journal', { id: 'safety', sp, soft: true }); } },
      onStep: (d, dir) => { if (JT.R() < 0.12) hab.nudge(d, dir[0] * AI.len(sp) * 0.08, dir[2] * AI.len(sp) * 0.08); },
    });
  }
  function routeTo(hab, sp, gsup, gpos, carry) { const r = Nav.route(hab, sp.sup, sp.pos, gsup, gpos, AI.caps(sp, carry)); sp._route = r; sp._routeStart = hab.time; return r; }
  function stuck(hab, sp) { const r = sp._route; if (!r) return false; const expect = (r.cost || 10) / Math.max(1, AI.speed(sp) * Math.min(1, AI.gaitAvg(sp)) * 0.4) + 6; return hab.time - (sp._routeStart || 0) > expect * 2.2; }

  // ---------------- state handlers ----------------
  const H = AI.H = {};
  H.idle = function (hab, sp, dt) { if (sp.st > 0.8 + sp.traits.patience) pickIdle(hab, sp); };
  function pickIdle(hab, sp) {
    const S = sp_(sp); let r = JT.R();
    const act = sp.pers.activity, pat = sp.traits.patience;
    if (JT.Biome && JT.Biome.seekMicro && JT.Biome.seekMicro(hab, sp)) return;
    const restless = AI.hungerLevel(sp) >= 2;
    if (restless) r = 0.3 + r * 0.7; // very hungry: little grooming or resting, more wandering
    if (sp.hyd < 0.72 && hab.data.drops.length && JT.R() < 0.4 && !(sp._drinkFail > hab.time) && startDrink(hab, sp, 140)) return;
    if (S.sig === 'nectar' && sp.sat < 0.8 && !(sp._nectarCD > hab.time) && JT.R() < 0.7 && startNectar(hab, sp)) return;
    if (JT.sigHas(S, 'ant') && r > 0.9 && startAntMarch(hab, sp)) return;
    if (JT.sigHas(S, 'semaphore') && r < (S.sig === 'saltator' ? 0.08 : 0.05)) { setState(sp, 'semaphore', 'Flashing its white palps up and down, signalling to no one in particular.'); return; }
    if (S.prefs.display > 0.7 && r < (S.sig === 'prism' || S.sig === 'saltator' ? 0.12 : 0.08)) {
      setState(sp, 'display', S.sig === 'prism' ? 'Flashing its rainbow fan in a Prism Display!' : S.sig === 'saltator' ? 'Launching into a long dance routine, palps flashing.' : 'Performing a little leg-waving dance.'); sp.stats.displays++; hab.event('journal', { id: 'display', sp });
      if (S.sig === 'prism') { let n = 0; for (const q of hab.data.prey) { if (q.owner || q.buried || q.dead || (q.sup && q.sup.k === 'air') || !JT.PREY_BY_ID[q.type].huntable) continue; if (M.dist(q.pos, sp.pos) < 30 + AI.len(sp) * 2) { q._dazzle = hab.time + 3; q.alert = 0; n++; } } if (n) hab.event('journal', { id: 'prismDisplay', sp }); }
      if (S.sig === 'saltator') sp._finaleT = hab.time;
      return; }
    if (r < 0.18 + (1 - act) * 0.1 + (AI.has(sp, 'tidy') ? 0.1 : 0)) {
      if (JT.R() < 0.5) setState(sp, 'cleanEyes', AI.has(sp, 'tidy') ? 'Polishing its big front eyes. Again.' : 'Wiping its big front eyes with its front legs.');
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
      const shyHid = AI.has(sp, 'shy') && Nav.coverAt(hab, sp.pos) > 0.35, lazy = AI.has(sp, 'lazy');
      setState(sp, 'rest', shyHid ? 'Tucked under cover, peeking out.' : atHome ? (lazy ? 'Lounging at its favourite spot.' : 'Resting at its favourite spot.') : lazy ? 'Having a lazy little sit.' : pat > 0.6 ? 'Sitting perfectly still, watching.' : 'Pausing for a moment.'); sp.stats.rests++; return;
    }
    // explore / lookout: choose a reachable destination weighted by species/individual preferences
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp));
    const nodes = hab.nav.nodes; let best = null, bs = -1e9; const H0 = hab.dims.h;
    // personality: shy jumpers favour cover, bold ones exposed high perches, climbers height, ground-lovers the floor
    const shyK = AI.has(sp, 'shy') ? 2.4 : 0, boldK = AI.has(sp, 'bold') ? 1.4 : 0, climbK = (AI.climbPref(sp) - 0.5) * 4;
    for (let k = 0; k < 40; k++) {
      const n = nodes[Math.floor(JT.R() * nodes.length)]; if (!n || n.kind === 'face' || !isFinite(dj.dist[n.id])) continue;
      if (M.dist(n.pos, sp.pos) < 8) continue;
      const g = n.decor && hab.geoms[n.decor]; const plant = g && g.def.cat === 'plants'; const cov = Nav.coverAt(hab, n.pos);
      const s = S.prefs.height * (n.y / H0) * 5 + S.prefs.foliage * (plant ? 2.5 : 0) + (n.perch ? 1 : 0) + JT.R() * 2.5 - dj.dist[n.id] * 0.015 * (1.2 - act) + cov * (1 - sp.traits.bold) + (AI.blendAt(hab, sp.species, n.sup, n.pos) ? 1.6 : 0)
        + cov * shyK + boldK * (n.perch ? 1 : 0.2) * (0.3 + n.y / H0) - boldK * cov * 0.6 + climbK * (n.y / H0) + (JT.sigHas(S, 'semaphore') && g && (g.def.arche === 'backwall' || g.wallH || n.vert) ? 3 : 0) // house jumper: walls
        + (JT.Terrain && n.sup && n.sup.k === 'floor' ? JT.Terrain.crest(hab, n.pos[0], n.pos[2]) * 1.6 : 0); // v15: little rises in the ground make floor lookouts
      if (s > bs) { bs = s; best = n; }
    }
    if (best) {
      const r2 = Nav.buildRoute(hab, dj, best.sup, best.pos); if (r2) { sp._route = r2; sp._routeStart = hab.time; sp.stats.explores++;
        const high = best.y > 18; const dn = decorName(hab, best.decor);
        const rise = !high && !dn && JT.Terrain && best.sup && best.sup.k === 'floor' && JT.Terrain.crest(hab, best.pos[0], best.pos[2]) > 0.4; sp._crestP = rise ? best.pos.slice() : null;
        setState(sp, 'explore', high ? (dn ? 'Heading up the ' + dn + ' for a better view.' : 'Looking for a higher lookout.') : rise ? 'Climbing a little rise for a better view.' : (dn ? 'Exploring around the ' + dn + '.' : 'Patrolling the substrate.'));
        sp._lookout = high; return; }
    }
    setState(sp, 'rest', 'Sitting still, taking everything in.');
  }
  H.explore = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.8);
    if (r === 'done' || r === 'none') { sp._route = null; const bl = AI.blendAt(hab, sp.species, sp.sup, sp.pos);
      const rise = sp._crestP && M.dist(sp._crestP, sp.pos) < 4; sp._crestP = null;
      const ln = bl ? 'Keeping still on the ' + bl.name.toLowerCase() + ' — its colours blend right in.' : rise ? 'Watching from the top of a little rise.' : sp._lookout && AI.has(sp, 'bold') ? 'Showing off from the top, out in the open.' : AI.has(sp, 'shy') && Nav.coverAt(hab, sp.pos) > 0.35 ? 'Hidden under the leaves, watching.' : sp._lookout ? 'Watching from a high lookout.' : 'Scanning the habitat.';
      setState(sp, 'lookout', ln); }
    else if (stuck(hab, sp)) { sp._route = null; setState(sp, 'idle'); }
  };
  H.patrol = H.explore;
  const restK = (sp) => AI.has(sp, 'lazy') ? 1.6 : AI.has(sp, 'busy') ? 0.6 : 1; // laid-back jumpers linger, busy ones move on
  H.lookout = function (hab, sp, dt) { if (sp.st > (3 + sp.traits.patience * 7) * (AI.hungerLevel(sp) >= 2 ? 0.4 : 1) * restK(sp)) setState(sp, 'idle'); };
  H.groom = function (hab, sp, dt) { if (sp.st > 2 + JT.R() * 0.02 + sp.pers.routine * 2) setState(sp, 'idle'); };
  H.rest = function (hab, sp, dt) { const home = sp.home && M.dist(sp.home.pos, sp.pos) < 6; if (sp.st > (2 + sp.traits.patience * 6) * (home ? 2.2 : 1) * restK(sp)) setState(sp, 'idle'); };
  H.watch = function (hab, sp, dt) { if (sp._watchPos) faceToward(sp, sp._watchPos, dt, 3); if (sp.st > 2.5) setState(sp, 'idle'); };
  H.display = function (hab, sp, dt) { if (sp._watchPos) faceToward(sp, sp._watchPos, dt, 3); if (sp.st > 3.5) { setState(sp, 'idle'); sp._watchPos = null; } };
  H.postFeed = function (hab, sp, dt) { if (sp.st > 6 + sp.traits.patience * 8) setState(sp, 'groom', 'Cleaning up after its meal.'); };

  // ---- hunting ----
  function startNotice(hab, sp, t) {
    sp._route = null; sp.target = t; sp._plan = null; sp._replans = 0; sp._peeks = 0; sp._tVis = null; sp._tSeen = hab.time; sp._paceNow = null;
    const e = targetEnt(hab, sp); const d = targetDef(hab, sp, e);
    if (t.kind === 'spider') e.threat = sp.id;
    sp.stats.hunts++;
    setState(sp, 'notice', sp.sat < 0.35 ? 'Hungry — actively hunting the ' + preyName(d) + '.' : 'Noticed the ' + preyName(d) + '.');
    sp._noticeDur = (0.35 + sp.traits.patience * 1.1) * (0.45 + Math.min(1, sp.sat));
  }
  H.notice = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    trackTarget(hab, sp, e, dt); aimAt(hab, sp, known(hab, sp, e).pos, dt, 8);
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
  /** Reach of a leap from a height difference: leaping down carries much farther (gravity helps), up much shorter. */
  function reachFor(J, dh) { if (AI.reachFor) return AI.reachFor(J, dh); return dh >= 0 ? J + Math.min(J * 1.3, dh * 0.85) : J - Math.min(J * 0.6, -dh * 0.8); } // packs may replace it (a mantis's reach doesn't grow downhill)
  function effJump(sp, tpos) { return reachFor(AI.jump(sp), sp.pos[1] - tpos[1]); }
  AI.effJump = effJump;

  /** Tactical planning: score reachable staging/launch candidates (graph + ring points around predicted prey). */
  function planHunt(hab, sp) {
    const e0 = targetEnt(hab, sp); if (!e0) return null; const e = known(hab, sp, e0); const def = targetDef(hab, sp, e0);
    const J = AI.jump(sp), T = sp.traits, S = sp_(sp);
    const pred = predict(hab, sp, e, 0.3 + T.tactics * 1.0);
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp, false, true));
    const heading = e.fwd ? horiz(e.fwd) : [1, 0, 0];
    const misses = sp.mem.misses || 0; const shift = misses >= 2 ? 1.6 : 1;
    const hungerW = sp.sat < 0.35 ? 1.6 : 1;
    const bigT = sp.target.kind === 'prey' && AI.ratioOf(sp, e0) > 1.05; const kick = bigT && KICKERS.has(e0.type);
    const cands = [];
    for (const n of hab.nav.nodes) {
      if (n.kind === 'face' || !isFinite(dj.dist[n.id])) continue;
      const d = M.dist(n.pos, pred.pos); const ej = reachFor(J, n.pos[1] - pred.pos[1]);
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
      // no needless detours: a winding route to a launch point that is not much better is worse than a direct one
      const straight = Math.max(8, M.dist(sp.pos, c.pos)); c.wind = c.cost / straight;
      if (JT.sigHas(S, 'detour')) s += Math.min(S.sig === 'titan' ? 3.4 : 2.4, Math.max(0, c.wind - (S.sig === 'titan' ? 1.15 : 1.25)) * (S.sig === 'titan' ? 3 : 1.8)) * Math.max(T.tactics, S.sig === 'titan' ? 0.7 : 0) * (behind > 0 || elev > 4 ? 1 : 0.4); // Portia: the long way round, out of sight, is the point
      else s -= Math.max(0, c.wind - 1.6) * 1.3;
      if (sp.mem.blockPos && hab.time - sp.mem.blockPos.t < 10 && M.dist(c.pos, sp.mem.blockPos.pos) < 5) s -= 4;
      if (bigT) { if (behind > 0.3) s += 1.5; if (elev > 4) s += 2; if (kick && behind > 0.55) s -= 4.5; } // big prey: rear or above, but never right behind powerful hind legs
      if (AI.blendAt(hab, sp.species, c.sup, c.pos)) s += 0.6 + T.stealth * 0.8; // a colour-matched launch point hides the approach
      s += (JT.R() - 0.5) * 0.6 * (1 - T.tactics);
      c.score = s; c.behind = behind; c.elev = elev; c.cover = cover;
    }
    // the launch point must actually see the prey and have a clear flight line to it
    cands.sort((a, b) => b.score - a.score);
    const L = AI.len(sp), el = lenOfE(e0); const ghost = { id: e.id, type: e.type, species: e.species, stage: e.stage, pos: pred.pos, sup: pred.sup };
    for (let i = 0; i < Math.min(10, cands.length); i++) {
      const c = cands[i]; const eye = eyeOf(hab, sp, c.pos, c.sup);
      const ok = sightFrom(hab, sp, eye, c.sup, ghost) && !segBlocked(hab, AI.surfPt(hab, { pos: c.pos, sup: c.sup }, L * 0.3), AI.surfPt(hab, ghost, Math.min(el * 0.3, 1.2)), L * 0.5, el * 0.5 + 0.8);
      if (!ok) c.score -= 8;
      if (c.score > bs) { bs = c.score; best = c; }
    }
    const route = Nav.buildRoute(hab, dj, best.sup, best.pos); if (!route) return null;
    const nDecor = Nav.routeDecorCount(route);
    let strat = 'direct';
    if (best.elev > 6) strat = 'high'; else if (best.behind > 0.3 && S.prefs.rear > 0.4) strat = 'rear'; else if (best.cover > 0.4) strat = 'cover';
    if (e._vel && M.len(e._vel) > 2 && T.tactics > 0.55) strat = strat === 'direct' ? 'intercept' : strat;
    if (nDecor >= 2) strat = strat === 'direct' ? 'stepping' : strat;
    if (JT.sigHas(S, 'detour') && best.wind > (S.sig === 'titan' ? 1.3 : 1.45) && route.steps && route.steps.length > 2) strat = 'detour';
    return { route, strat, pred: pred.pos, nDecor, target: best, name: preyName(def) };
  }
  function stratThought(p, sp) {
    switch (p.strat) {
      case 'high': return p.nDecor >= 2 ? 'Using ' + p.nDecor + ' habitat surfaces as stepping stones to get above the ' + p.name + '.' : 'Looking for a higher ambush above the ' + p.name + '.';
      case 'rear': return 'Circling behind the ' + p.name + '.';
      case 'detour': return 'Plotting a detour — it will lose sight of the ' + p.name + ' on the way, and remember where it was.';
      case 'cover': return 'Using nearby decor as cover to sneak up on the ' + p.name + '.';
      case 'intercept': return 'Reading where the ' + p.name + ' is heading.';
      case 'stepping': return 'Using ' + p.nDecor + ' habitat surfaces as stepping stones toward the ' + p.name + '.';
      default: return sp.sat < 0.35 ? 'Hungry — closing in on the ' + p.name + '.' : 'Stalking the ' + p.name + '.';
    }
  }
  /** What the hunter believes about its target: the live animal while in view, its last-seen memory otherwise. */
  function known(hab, sp, e) {
    if (sp._tVis !== false) return e;
    const m = sp._ls && sp._ls[e.id]; if (!m) return e;
    return { id: e.id, type: e.type, species: e.species, stage: e.stage, name: e.name, traits: e.traits, pos: m.pos, sup: m.sup, fwd: m.fwd, _vel: [0, 0, 0], state: 'idle' };
  }
  const memT = (sp) => 5 + sp.traits.tactics * 8 + sp.traits.patience * 4;
  /** Keep sight of the target (throttled). True while it is in view; memory takes over when it is hidden. */
  function trackTarget(hab, sp, e, dt) {
    sp._tvT = (sp._tvT || 0) - dt;
    if (sp._tvT <= 0 || sp._tVis == null) {
      sp._tvT = 0.2;
      if (canSee(hab, sp, e)) { sp._tVis = true; sp._tSeen = hab.time; noteSeen(hab, sp, e); }
      else { if (sp._tSeen == null) sp._tSeen = hab.time; sp._tVis = false; }
    }
    return sp._tVis;
  }
  const lostFor = (hab, sp) => sp._tVis === false ? hab.time - (sp._tSeen || hab.time) : 0;
  /** A pounce needs the prey in view, within reach and a clear flight line — never through decor. */
  function strikeOK(hab, sp, e, k) {
    if (sp._tVis === false) return false;
    const d = M.dist(sp.pos, e.pos); if (d > effJump(sp, e.pos) * (k || 0.85)) return false;
    const c = sp._stk; if (c && c.id === e.id && hab.time - c.t < 0.2 && M.dist(c.p, e.pos) < 0.6 && M.dist(c.q, sp.pos) < 0.6) return c.v;
    const L = AI.len(sp), el = lenOfE(e);
    const a = AI.surfPt(hab, sp, L * 0.3), b = AI.surfPt(hab, e, Math.min(el * 0.3, 1.2));
    const v = !segBlocked(hab, a, b, L * 0.5, el * 0.5 + 0.8, 0.9);
    sp._stk = { id: e.id, t: hab.time, v, p: e.pos.slice(), q: sp.pos.slice() };
    if (!v) sp.mem.blockPos = { pos: sp.pos.slice(), t: hab.time };
    return v;
  }
  AI.strikeOK = strikeOK;
  /** Re-weigh every prey in view: a clearly closer / easier one steals the hunt (with hysteresis — no flip-flopping). */
  function reconsider(hab, sp, dt) {
    if (sp_(sp).sig === 'titan' && sp._route && sp._plan && sp._plan.strat === 'detour') return false;
    sp._rcT = (sp._rcT || 0) - dt; if (sp._rcT > 0 || sp._air) return false; sp._rcT = 0.5;
    const cur = targetEnt(hab, sp); if (!cur || !sp.target || sp.target.kind !== 'prey') return false;
    const seen = sp._seen || {}; const J = AI.jump(sp);
    const ease = (e) => {
      const sc = scoreTarget(hab, sp, e, false); if (sc < 0) return -1e9;
      const d = M.dist(sp.pos, e.pos); let s = sc - (d / J) * 2.4;
      if (d < effJump(sp, e.pos) * 0.85) s += 3;
      if (e.sup && e.sup.k === 'air') s -= 2;
      const v = preyView(hab, sp, e); if (v.back) s += 0.8; else if (v.facing) s -= 0.6;
      return s;
    };
    const progress = M.clamp(1 - M.dist(sp.pos, cur.pos) / (J * 3), 0, 1); // the closer it already is, the more committed
    const curS = ease(known(hab, sp, cur)) + 2 + progress * 2 - (sp._tVis === false ? 3 : 0);
    let best = null, bs = curS;
    for (const id in seen) {
      if (id === cur.id || hab.time - seen[id] > 1.6 || sp.mem.ignore[id]) continue;
      const e = hab.preyById(id); if (!e || e.owner || e.buried || e.dead || !AI.huntableFor(sp, JT.PREY_BY_ID[e.type])) continue;
      const s = ease(e); if (s <= bs) continue;
      if (!canSee(hab, sp, e)) continue;
      bs = s; best = e;
    }
    if (!best) return false;
    sp.target = { kind: 'prey', id: best.id, since: hab.time }; sp._plan = null; sp._route = null; sp._replans = 0; sp._peeks = 0;
    sp._tVis = null; sp._tSeen = hab.time; sp._watched = 0; noteSeen(hab, sp, best);
    const near = M.dist(sp.pos, best.pos) < M.dist(sp.pos, cur.pos);
    setState(sp, 'assess', (near ? 'Switching to a closer ' : 'Switching to an easier ') + preyName(JT.PREY_BY_ID[best.type]) + '.');
    sp.stats.switches = (sp.stats.switches || 0) + 1; hab.event('switch', { sp });
    return true;
  }
  AI._reconsider = reconsider; AI._scoreTarget = scoreTarget;
  H.assess = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    const vis = trackTarget(hab, sp, e, dt); const K = known(hab, sp, e);
    aimAt(hab, sp, K.pos, dt, 7);
    if (reconsider(hab, sp, dt)) return;
    if (vis && e.sup && e.sup.k === 'air') { setState(sp, 'track', 'Tracking the ' + preyName(targetDef(hab, sp, e)) + ' in the air — waiting for it to land.'); return; }
    if (!vis && lostFor(hab, sp) > memT(sp)) { startPeek(hab, sp, e); return; }
    if (vis && sp.sup.k !== 'air' && e.sup.k !== 'air' && strikeOK(hab, sp, e, 0.85)) { startCrouch(hab, sp); return; }
    const plan = planHunt(hab, sp);
    if (!plan) {
      sp.mem.ignore[e.id] = hab.time + 15; setState(sp, 'watch', 'Watching the ' + preyName(targetDef(hab, sp, e)) + ' — no way to reach it from here.'); sp._watchPos = K.pos.slice(); sp.target = null; return;
    }
    sp._plan = plan; sp._route = plan.route; sp._routeStart = hab.time;
    setState(sp, 'stalk', stratThought(plan, sp)); sp.mem.lastStrategy = plan.strat;
  };
  H.track = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    const vis = trackTarget(hab, sp, e, dt);
    aimAt(hab, sp, known(hab, sp, e).pos, dt, 7);
    if (reconsider(hab, sp, dt)) return;
    if (e.sup.k !== 'air') { setState(sp, 'assess'); return; }
    if (!vis && lostFor(hab, sp) > 2.5) { sp.mem.ignore[e.id] = hab.time + 6; AI.dropTarget(hab, sp); return; }
    if (vis && strikeOK(hab, sp, e, 0.6) && JT.R() < dt * (0.4 + sp.traits.tactics) * 3) { startCrouch(hab, sp, 0.25); return; }
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
  /** Smoothly eased pace (never pops between speeds; freezing is quick, speeding up is gradual). */
  function paceTo(sp, want, dt, rate) {
    const cur = sp._paceNow == null ? want : sp._paceNow;
    sp._paceNow = M.lerp(cur, want, Math.min(1, dt * (rate || (want < cur ? 5 : 2.2))));
    return sp._paceNow < 0.03 ? 0 : sp._paceNow;
  }
  /** Stalking pace: brisk while far, easing to a slow inch near the pounce; quicker while the prey's back is turned
      (quickest while it is also busy walking); a freeze while it looks this way. */
  function stalkPace(hab, sp, e, dt) {
    if (e.sup && e.sup.k === 'air') { sp._watched = 0; sp._low = 0.2; return paceTo(sp, 0.9, dt); }
    const d = M.dist(sp.pos, e.pos); const ej = effJump(sp, e.pos); const r = d / ej;
    const sense = (targetDef(hab, sp, e) || {}).sense || 20;
    let pace = M.lerp(0.3, 1.0, M.smooth(M.clamp((r - 0.9) / 2.4, 0, 1)));
    // not gaining on it (it is drifting away)? press on a little quicker
    const cl = sp._close || (sp._close = { d, t: hab.time, slow: 0 });
    if (hab.time - cl.t > 0.8) { cl.slow = d > cl.d - ej * 0.07 ? Math.min(1, cl.slow + 0.5) : Math.max(0, cl.slow - 0.5); cl.d = d; cl.t = hab.time; }
    pace *= 1 + cl.slow * 0.9;
    if (sp._tVis !== false && d < sense * 3.5) {
      const v = preyView(hab, sp, e);
      if (v.facing) {
        sp._watched = (sp._watched || 0) + dt; aimAt(hab, sp, e.pos, dt, 6); sp._low = 1;
        // freeze while watched, then inch forward in short pulses (the stare-down never lasts long)
        const hold = 1.0 + sp.traits.patience * 1.2;
        if (sp._watched < hold || (sp._watched - hold) % 1.4 < 0.5) return paceTo(sp, 0, dt, 12);
        return paceTo(sp, 0.32, dt, 6);
      }
      else sp._watched = Math.max(0, (sp._watched || 0) - dt * 2);
      if (v.back) pace *= v.busy ? 1.75 : 1.35; else if (v.busy) pace *= 1.15;
    } else sp._watched = 0;
    const urgency = M.clamp((0.65 - sp.sat) / 0.5, 0, 1);
    pace *= (0.85 + 0.3 * urgency) * (1 - sp.traits.patience * 0.15);
    if (sp.target && sp.target.kind === 'prey' && AI.ratioOf(sp, e) > 1.05) pace *= 0.72; // a big one: slow, careful approach
    pace = M.clamp(pace, 0.12, 1.25);
    sp._low = M.clamp(1.15 - pace, 0, 1);
    return paceTo(sp, pace, dt);
  }
  H.stalk = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    const vis = trackTarget(hab, sp, e, dt); const K = known(hab, sp, e);
    // in range with a clear line: pounce now, whichever way the prey is facing
    if (!sp._air && sp.sup.k !== 'air') {
      if (vis && e.sup.k === 'air') { sp._route = null; setState(sp, 'track', 'Tracking the ' + (sp._plan ? sp._plan.name : preyName(targetDef(hab, sp, e))) + ' in the air.'); return; }
      if (vis && e.sup.k !== 'air' && strikeOK(hab, sp, e, 0.86)) { sp._route = null; startCrouch(hab, sp); return; }
      if (!vis && lostFor(hab, sp) > memT(sp)) { startPeek(hab, sp, e); return; }
      if (reconsider(hab, sp, dt)) return;
    }
    const mult = stalkPace(hab, sp, K, dt);
    sp._evalT = (sp._evalT || 0) + dt;
    if (sp._evalT > 0.4) {
      sp._evalT = 0;
      if (sp._plan && M.dist(K.pos, sp._plan.pred) > AI.jump(sp) * 0.75 && !sp._air) { replan(hab, sp, e); return; }
    }
    if (mult <= 0) { if (!sp._air) aimAt(hab, sp, K.pos, dt, 6); return; }
    const r = move(hab, sp, dt, mult);
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
    const vis = trackTarget(hab, sp, e, dt); const K = known(hab, sp, e);
    aimAt(hab, sp, K.pos, dt, 8);
    if (vis && strikeOK(hab, sp, e, 0.86)) { startCrouch(hab, sp); return; }
    if (!vis && lostFor(hab, sp) > 1.2) { startPeek(hab, sp, e); return; }
    if (reconsider(hab, sp, dt)) return;
    const d = M.dist(sp.pos, K.pos); const ej = effJump(sp, K.pos);
    const myR = Nav.regionKey(sp.sup), tR = K.sup && Nav.regionKey(K.sup);
    if (vis && myR && myR === tR) {
      const pace = stalkPace(hab, sp, K, dt); if (pace <= 0) { sp.st = 0; return; }
      const r = hab.nav.regions[myR]; const step = AI.speed(sp) * 0.8 * pace * dt; const dir = horiz(M.sub(K.pos, sp.pos));
      const np = [sp.pos[0] + dir[0] * step, sp.pos[1], sp.pos[2] + dir[2] * step];
      const ok = myR === 'F' ? Nav.inside(hab, np[0], np[2], 2) : JT.G.pointInPoly(np[0], np[2], r.poly);
      if (ok && !r.obstacles.some(o => JT.G.pointInPoly(np[0], np[2], o))) { sp.pos = np; sp.fwd = dir; return; }
    }
    if (sp.st > 1.5 || d > ej * 1.6) replan(hab, sp, e);
  };
  // ---- lost from view: go to where it was last seen, peek round / over, then give up ----
  function startPeek(hab, sp, e) {
    const m = sp._ls && sp._ls[e.id]; const nm = preyName(targetDef(hab, sp, e));
    sp._peeks = (sp._peeks || 0) + 1;
    if (!m || sp._peeks > 2) { loseTarget(hab, sp, e, 'Lost the ' + nm + '. Watching for movement.'); return; }
    const J = AI.jump(sp); const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp, false, true));
    const ghost = { id: e.id, type: e.type, species: e.species, stage: e.stage, pos: m.pos, sup: m.sup };
    const cands = [];
    for (const n of hab.nav.nodes) {
      if (n.kind === 'face' || !isFinite(dj.dist[n.id])) continue;
      const d = M.dist(n.pos, m.pos); if (d > Math.max(30, J * 1.6) || d < 3 || M.dist(n.pos, sp.pos) < 4) continue;
      cands.push({ n, s: -dj.dist[n.id] * 0.04 - Math.abs(d - J * 0.7) * 0.08 + (n.pos[1] > m.pos[1] + 4 ? 1 : 0) + JT.R() * 0.3 });
    }
    cands.sort((a, b) => b.s - a.s);
    let pick = null;
    for (const c of cands.slice(0, 14)) if (sightFrom(hab, sp, eyeOf(hab, sp, c.n.pos, c.n.sup), c.n.sup, ghost)) { pick = c.n; break; }
    if (!pick && cands[0]) pick = cands[0].n;
    const r = pick && Nav.buildRoute(hab, dj, pick.sup, pick.pos);
    if (!r) { loseTarget(hab, sp, e, 'Lost the ' + nm + '. Watching for movement.'); return; }
    sp._route = r; sp._routeStart = hab.time; sp._peekPos = m.pos.slice(); sp._peekLook = 0;
    setState(sp, 'peek', sp._peeks > 1 ? 'Still looking for the ' + nm + '.' : 'Lost sight of the ' + nm + ' — checking where it went.');
  }
  function loseTarget(hab, sp, e, why) { if (e) sp.mem.ignore[e.id] = hab.time + 12; sp._peeks = 0; AI.dropTarget(hab, sp); setState(sp, 'lookout', why || 'Lost it. Watching for movement.'); }
  H.peek = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    const vis = trackTarget(hab, sp, e, dt);
    if (vis && !sp._air) { sp._route = null; sp._peeks = 0; setState(sp, 'assess', 'Found the ' + preyName(targetDef(hab, sp, e)) + ' again.'); return; }
    if (!sp._air && reconsider(hab, sp, dt)) return;
    if (sp._route) {
      const r = move(hab, sp, dt, 0.8);
      if (r === 'done' || r === 'none' || (stuck(hab, sp) && !sp._air)) { sp._route = null; sp.st = 0; }
      return;
    }
    // at the vantage point: face the last sighting and peer around it in small head turns
    if (sp._peekPos) aimAt(hab, sp, sp._peekPos, dt, 5);
    sp._gazeT = 0.5; sp._peekLook -= dt;
    if (sp._peekLook <= 0) { sp._peekLook = 0.45 + JT.R() * 0.4; sp._gaze = [-0.7, -0.35, 0.35, 0.7][Math.floor(JT.R() * 4)]; }
    if (sp.st > 2 + sp.traits.patience * 2.5) startPeek(hab, sp, e);
  };
  function startCrouch(hab, sp, quick) {
    const e = targetEnt(hab, sp);
    const watched = e && sp.target.kind === 'prey' && e.sup && e.sup.k !== 'air' && preyView(hab, sp, e).facing;
    setState(sp, 'crouch', watched ? 'Face to face — springing before it bolts.' : 'Crouching for the jump.');
    sp._crouchDur = quick || (watched ? 0.18 + JT.R() * 0.12 : Math.max(0.35, (0.5 + sp.traits.patience * 1.2) * (sp.sat < 0.35 ? 0.6 : 1)));
    sp._bigT = !!(e && sp.target.kind === 'prey' && AI.ratioOf(sp, e) > 1.05);
    if (sp._bigT && !watched && !quick) { sp._crouchDur *= 1.4; sp.thought = 'Big prey — waiting for it to keep still.'; }
  }
  H.crouch = function (hab, sp, dt) {
    const e = targetEnt(hab, sp); if (!e) return AI.dropTarget(hab, sp);
    const vis = trackTarget(hab, sp, e, dt);
    aimAt(hab, sp, e.pos, dt, 10);
    if (!vis) { if (lostFor(hab, sp) > 0.5) replan(hab, sp, e); return; }
    const d = M.dist(sp.pos, e.pos);
    if (d > effJump(sp, e.pos) * 1.02) { if (e.sup.k === 'air') { setState(sp, 'track'); return; } replan(hab, sp, e); return; }
    if (sp.st >= sp._crouchDur) {
      // a big one is only jumped once it keeps still (it gives up waiting after a few seconds)
      if (sp._bigT && e._vel && M.len(e._vel) > 1.5 && sp.st < sp._crouchDur + 3) return;
      if (strikeOK(hab, sp, e, 1.02)) launchPounce(hab, sp, e); else replan(hab, sp, e);
    }
  };
  function landingFor(hab, sp, e) {
    if (e.sup.k === 'air') return { pos: e.pos.slice(), sup: null };
    const tac = sp.traits.tactics; const fl = AI.pounceDur(M.dist(sp.pos, e.pos));
    const pr = predict(hab, sp, e, fl * tac);
    return { pos: pr.pos, sup: pr.sup };
  }
  /** A real jumper's strike is explosive: about a tenth of a second whatever the distance. */
  AI.pounceDur = (d) => M.clamp((0.16 + d / 220) * 0.42, 0.075, 0.16);
  function launchPounce(hab, sp, e) {
    const def = targetDef(hab, sp, e); const land = landingFor(hab, sp, e);
    let to = land.sup ? AI.surfPt(hab, { pos: land.pos, sup: land.sup }, 0) : land.pos; if (e.sup.k === 'air') { const v = e._vel || [0, 0, 0]; to = M.add(e.pos, M.mul(v, AI.pounceDur(M.dist(sp.pos, e.pos)) * sp.traits.tactics)); }
    // launch from the surface the jumper is visibly on (never from inside a trunk) and only along a clear line
    const from = AI.surfPt(hab, sp, 0); const L = AI.len(sp);
    if (segBlocked(hab, AI.surfPt(hab, sp, L * 0.3), to, L * 0.5, lenOfE(e) * 0.5 + 0.8, 0.8) || segBlocked(hab, from, to, L * 0.5, lenOfE(e) * 0.5 + 0.8, 0.8)) { sp.mem.blockPos = { pos: sp.pos.slice(), t: hab.time }; replan(hab, sp, e); return; }
    const d = M.dist(from, to);
    sp._air = { from, to, t: 0, dur: AI.pounceDur(d), apex: 0, straight: true, ease: true, land: land.sup, launchY: sp.pos[1], tY: e.pos[1] };
    sp._air.launchSup = sp.sup && sp.sup.k; sp.pos = from.slice(); sp._anchor = from.slice(); sp.sup = { k: 'air' }; sp._route = null;
    // the strike scatters everything else nearby
    if (sp.target.kind === 'prey') JT.PreyAI.alarm(hab, e.pos, 26, 0.95, e, sp);
    // prey reflex: alertness + hunter stealth; committed pounces on tiny jumpers stay fair
    let reflex = (def.reflex || 0.3) * (0.35 + 0.65 * M.clamp(e.alert || 0, 0, 1)) * (1 - sp.traits.stealth * 0.4);
    if (sp.target.kind === 'prey' && e.sup.k !== 'air') { const v = preyView(hab, sp, e); reflex *= v.back ? 0.45 : v.look > 0.35 ? 1.35 : 1; }
    if (sp.target.kind === 'prey' && e.type === 'tinyjumper') reflex = Math.min(reflex, 0.4);
    if (sp.target.kind === 'prey' && JT.PreyAI.weakK) reflex *= 1 - 0.7 * JT.PreyAI.weakK(e);
    if (sp.target.kind === 'spider') reflex = Math.min(0.6, reflex + 0.15);
    if (JT.R() < reflex) {
      if (sp.target.kind === 'prey') JT.PreyAI.escape(hab, e, sp, true); else AI.escapeFrom(hab, e, sp);
      if (e.type === 'tinyjumper') hab.event('journal', { id: 'tinyEscape', sp });
    }
    sp._reach = Math.max(sp._reach || 0, 0.5);
    setState(sp, 'pounce', 'Pounce!');
    hab.event('pounce', { sp });
  }
  H.pounce = function (hab, sp, dt) {
    const A = sp._air; if (!A) { setState(sp, 'idle'); return; }
    A.t += dt / A.dur; const t = Math.min(1, A.t); const te = A.ease ? 1 - (1 - t) * (1 - t) * (1 - 0.35 * t) : t; // explosive start, braking into the bite
    const p = M.lerp3(A.from, A.to, te); // a pounce is a straight, flat strike — no arc
    const dir = M.sub(p, sp.pos); if (M.len(dir) > 1e-4) { sp._vel = M.mul(dir, 1 / dt); const hz = horiz(dir); if (M.len(hz) > 0) sp.fwd = hz; }
    sp.pos = p;
    const e = targetEnt(hab, sp);
    if (e && t > 0.35) {
      const def = targetDef(hab, sp, e);
      const catchR = AI.len(sp) * 0.55 + def.len * 0.45 + 2.2;
      if (M.dist(sp.pos, AI.surfPt(hab, e, 0)) < catchR) { doCatch(hab, sp, e, A); return; }
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
    JT.PreyAI.alarm(hab, sp.pos, 24, 0.85, null, sp);
    if (e && e.type && sp.target && sp.target.kind === 'prey') { const pt = sp.mem.ptype || (sp.mem.ptype = {}); const r = pt[e.type] || (pt[e.type] = { c: 0, m: 0 }); r.m++; }
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
    if (!isSpider && e && e.type) { const pt = sp.mem.ptype || (sp.mem.ptype = {}); const r = pt[e.type] || (pt[e.type] = { c: 0, m: 0 }); r.c++; }
    const def = JT.PREY_BY_ID[prey.type];
    if (prey.type === 'tinyjumper') hab.event('journal', { id: 'tinyCatch', sp });
    sp._catchRatio = AI.ratioOf(sp, prey); sp._catchWeak = JT.PreyAI.weakK ? JT.PreyAI.weakK(prey) : 0; prey.weak = null; prey._flip = 0;
    if (sp._catchRatio > 1.02) hab.event('journal', { id: 'bigPrey', sp });
    if (sp._catchWeak > 0) hab.event('journal', { id: 'finishWeak', sp });
    if (A.launchY - A.tY > 8) hab.event('journal', { id: 'ambushHigh', sp });
    if (strat === 'rear' || strat === 'cover' || strat === 'detour') hab.event('journal', { id: 'ambushCover', sp });
    if (strat === 'detour') { sp._detourT = hab.time; hab.event('journal', { id: 'portiaDetour', sp }); }
    if (nDecor >= 2) hab.event('journal', { id: 'stepping', sp });
    if (strat === 'intercept') hab.event('journal', { id: 'intercept', sp });
    hab.event('catch', { sp, prey });
    if (JT.Biome) { const bid = JT.Biome.id(hab); if (bid === 'nightmoss') hab.event('journal', { id: 'glowHunt', sp }); else if (bid === 'paludarium' && JT.Biome.nearWater(hab, prey.pos, 28)) hab.event('journal', { id: 'edgeHunt', sp }); }
    JT.PreyAI.alarm(hab, prey.pos, 30, 1.3, prey, sp);
    if (sp._anchor) { hab.addSilk(sp._anchor, sp.pos, 'drag'); sp._anchor = null; }
    sp._air = null;
    // land with the prey: on the planned support if valid, otherwise fall to real support below
    if (A.land && Nav.validSup(hab, A.land) && A.t > 0.6) { sp.pos = Nav.supPos(hab, A.land, sp.pos); sp.sup = JT.deepClone(A.land); beginSubdue(hab, sp); }
    else { startFall(hab, sp); sp._afterFall = 'subdue'; }
    sp.thought = 'Got it! Holding on tight…';
  }
  /** Lost footing (missed pounce, support vanished): never a limp free fall — the jumper pays out a dragline and
      makes a controlled leap to the nearest surface it can reach below or beside it. */
  function startFall(hab, sp) {
    const from = sp.pos.slice(); let best = null, bd = 1e9;
    const b = Nav.supportBelow(hab, [from[0], from[1] + 0.3, from[2]]);
    const drop = Math.max(0, from[1] - b.pos[1]); const reach = 8 + drop * 0.9;
    for (const n of (hab.nav && hab.nav.nodes) || []) {
      if (!n.sup || n.pos[1] > from[1] + 2) continue; const hd = Math.hypot(n.pos[0] - from[0], n.pos[2] - from[2]); if (hd > reach) continue;
      const d = Math.hypot(hd, (from[1] - n.pos[1]) * 0.55) - (n.kind === 'floor' ? 0 : 3); // ledges/plants a touch preferred over the floor
      if (d < bd && Nav.validSup(hab, n.sup)) { bd = d; best = n; }
    }
    let to = b.pos, land = b.sup;
    if (best && bd < Math.max(6, drop * 0.8 + 4)) { to = best.pos.slice(); land = JT.deepClone(best.sup); }
    const d = M.dist(from, to);
    sp._air = { from, to, t: 0, dur: Math.max(0.3, 0.24 + d / 150), apex: 1.5 + Math.min(6, d * 0.1), land, fall: true };
    if (!sp._anchor) sp._anchor = from.slice(); // dragline: it is always tied on
    sp.sup = { k: 'air' }; sp._route = null;
    if (sp.state !== 'fall') { sp._afterFall = sp._afterFall || (sp.hold ? 'subdue' : 'idle'); setState(sp, 'fall'); }
  }
  AI.startFall = startFall;
  H.fall = function (hab, sp, dt) {
    const A = sp._air; if (!A) { setState(sp, sp.hold ? 'subdue' : 'idle'); return; }
    A.t += dt / A.dur; const t = Math.min(1, A.t);
    // an even, aimed arc (like any jump) — not an accelerating plummet
    const p = M.lerp3(A.from, A.to, t); p[1] += Math.sin(t * Math.PI) * (A.apex || 0);
    const dir = M.sub(p, sp.pos); const hz = [dir[0], 0, dir[2]]; if (M.len(hz) > 1e-4) sp.fwd = M.norm(hz);
    sp.pos = p;
    if (A.t >= 1) {
      sp._air = null; sp.pos = A.to.slice(); if (sp._anchor) { hab.addSilk(sp._anchor, sp.pos, 'drag'); sp._anchor = null; } sp.sup = Nav.validSup(hab, A.land) ? JT.deepClone(A.land) : Nav.supportBelow(hab, sp.pos).sup;
      const nxt = sp._afterFall || 'idle'; sp._afterFall = null;
      if (sp.hold) beginSubdue(hab, sp); else setState(sp, nxt === 'subdue' ? 'idle' : nxt);
    }
  };
  function beginSubdue(hab, sp) {
    const p = hab.preyById(sp.hold); if (!p) { setState(sp, 'idle'); return; }
    const def = JT.PREY_BY_ID[p.type]; const L = p.len || def.len; const ratio = L / AI.len(sp);
    const resume = sp._subdueResume; sp._subdueResume = null;
    const F = famOf(p); const wk = resume ? 0 : (sp._catchWeak || 0);
    sp._subdueDur = resume || (def.struggle || 2) * M.clamp(ratio * 1.4, 0.5, 2.2) * (1.2 - sp.traits.bold * 0.4) * F.dur * (1 - 0.6 * wk);
    // grip: a big catch may thrash free (rare just over its own size, about 1 in 3 at twice its size); hungry, bold jumpers hold on better
    if (!resume) { sp._escAt = -1; sp._catchWeak = 0;
      if (ratio > 1.02 && p.type !== 'jumperMeal') { const hk = M.clamp((0.5 - sp.sat) / 0.35, 0, 1); const grip = M.clamp(1 - hk * 0.3 - (sp.traits.bold - 0.5) * 0.4, 0.55, 1.2);
        const pEsc = M.clamp(Math.pow(ratio - 1, 1.35) * 0.36 * grip * F.esc * (1 - wk), 0, 0.45); if (JT.R() < pEsc) sp._escAt = sp._subdueDur * (0.22 + JT.R() * 0.4); } }
    // how hard the catch fights back depends on its size relative to the jumper: same size = a real fight
    sp._awayN = 0; sp._strug0 = M.clamp((ratio - 0.12) / 0.88, 0.04, 1.35); sp._strug = sp._strug0; sp._yankT = 0; sp._yank = null; sp._burst = 1;
    setState(sp, 'subdue', resume ? 'Still wrestling with the ' + preyName(def) + '.' : sp._strug0 > 0.7 ? 'Got it! Wrestling with the ' + preyName(def) + '…' : 'Got it! Holding on tight…');
    sp._slipAt = !resume && !sp._hang && JT.R() < slipChance(hab, sp) ? sp._subdueDur * (0.1 + JT.R() * 0.3) : -1;
  }
  AI._beginSubdue = beginSubdue;
  /** Footing quality: 0 = solid ground … 1 = a twig tip or flower head. */
  function footing(hab, sp) {
    if (!sp.sup || sp.sup.k === 'floor' || sp.sup.k === 'air' || !Nav.validSup(hab, sp.sup)) return 0;
    if (sp.sup.k === 'top') return 0.12;
    const fr = Nav.supFrame(hab, sp.sup); const L = AI.len(sp); const g = hab.geoms[sp.sup.d]; const pa = g && g.paths[sp.sup.p];
    const thin = M.clamp(1 - (fr.r || 0) / (L * 0.45), 0, 1), steep = 1 - Math.abs(fr.n[1]);
    const soft = pa && (pa.flower || (g.def.cat === 'plants' && pa.kind !== 'face')) ? 0.25 : 0;
    return M.clamp(0.2 + thin * 0.45 + steep * 0.25 + soft + (fr.flex || 0) * 0.3, 0, 1);
  }
  function slipChance(hab, sp) { const f = footing(hab, sp); const I = sp._strug0 || 0; const p = sp.hold && hab.preyById(sp.hold); return f <= 0.01 || I < 0.35 ? 0 : M.clamp((I - 0.35) * f * 0.42 * (p ? famOf(p).slip : 1), 0, 0.3); }
  AI.footing = footing;
  /** The fight knocks it off unsteady footing: it drops on its dragline and hangs there, still gripping the prey. */
  function startSlip(hab, sp) {
    sp._slipAt = -1; const L = AI.len(sp); const p = hab.preyById(sp.hold); const nm = p ? preyName(JT.PREY_BY_ID[p.type]) : 'prey';
    const fr = Nav.supFrame(hab, sp.sup); let out = horiz(fr.n); if (!(M.len(out) > 0.2) || !M.finite3(out)) out = horiz(M.mul(sp.fwd || [1, 0, 0], -1));
    const off = (fr.r || 0) + L * 0.35; const anchor = [sp.pos[0] + out[0] * off, AI.surfPt(hab, sp, 0)[1], sp.pos[2] + out[2] * off];
    const below = Nav.supportBelow(hab, [anchor[0], anchor[1] - 0.5, anchor[2]], sp.sup.d); const clear = anchor[1] - below.pos[1];
    hab.event('slip', { sp });
    if (clear < L * 2.6 || !Nav.inside(hab, anchor[0], anchor[2], 2)) { // too low to hang: tumble down and finish the fight there
      sp._subdueResume = Math.max(0.8, sp._subdueDur - sp.st); sp._afterFall = 'subdue'; sp.thought = 'Knocked off its perch — still holding on!';
      startFall(hab, sp); return;
    }
    const depth = M.clamp(L * (1.4 + JT.R() * 0.8), 3, clear - L * 1.2);
    sp._hang = { k: 0, phase: 'drop', anchor };
    sp._dangleOff = { dx: anchor[0] - sp.pos[0], dz: anchor[2] - sp.pos[2], depth, anchor, slip: true };
    sp.thought = 'Lost its footing — hanging on its dragline with the ' + nm + '!';
  }
  H.subdue = function (hab, sp, dt) {
    const p = hab.preyById(sp.hold); if (!p) { sp.hold = null; sp._hang = null; setState(sp, 'idle'); return; }
    const u = M.clamp(sp.st / sp._subdueDur, 0, 1);
    // fierce bursts early, fading to weak twitches as the venom works
    sp._burstT = (sp._burstT || 0) - dt; if (sp._burstT <= 0) { sp._burstT = 0.16 + JT.R() * 0.42; sp._burst = 0.4 + JT.R() * 0.85; }
    const I = (sp._strug0 || 0.3) * Math.pow(1 - u, 1.25) * (sp._burst || 1);
    sp._strug = M.lerp(sp._strug || 0, I, Math.min(1, dt * 10)); p._struggle = sp._strug;
    p._walk = (p._walk || 0) + dt * (5 + 24 * sp._strug); p._anim = (p._anim || 0) + dt * (1 + 3 * sp._strug);
    if (sp._slipAt > 0 && sp.st >= sp._slipAt && !sp._hang) { startSlip(hab, sp); if (sp.state !== 'subdue') return; }
    const Hg = sp._hang;
    if (Hg) {
      if (Hg.phase === 'drop') { Hg.k = Math.min(1, Hg.k + dt / 0.4); if (Hg.k >= 1) Hg.phase = 'hold'; }
      if (Hg.phase === 'hold' && sp.st >= sp._subdueDur) { Hg.phase = 'climb'; p._struggle = 0; sp._strug = 0; sp.thought = 'Climbing back up its dragline with the ' + preyName(JT.PREY_BY_ID[p.type]) + '.'; }
      if (Hg.phase === 'climb') {
        p._struggle = 0; sp._strug = 0; Hg.k = Math.max(0, Hg.k - dt / 2.6);
        if (Hg.k <= 0) { const o = sp._dangleOff; if (o) hab.addSilk(o.anchor, [o.anchor[0], o.anchor[1] - o.depth, o.anchor[2]], 'drag'); sp._hang = null; sp._dangleOff = null; sp._dangleVis = 0; startSecure(hab, sp, 'climb'); }
      }
      thrash(hab, sp, p, dt, true);
      return;
    }
    if (sp._escAt > 0 && sp.st >= sp._escAt) { shakeOff(hab, sp, p, u); return; }
    thrash(hab, sp, p, dt, false);
    // a big catch yanks the jumper around: it shuffles and pivots to keep its grip (each kind of prey its own way)
    if (sp._strug > 0.3 && (sp._strug0 || 0) > 0.45) {
      const F = famOf(p); sp._yankT -= dt;
      if (sp._yankT <= 0) { sp._yankT = 0.22 + JT.R() * 0.5; const f = horiz(sp.fwd || [1, 0, 0]); let sd = JT.R() < 0.5 ? 1 : -1; let back = JT.R() < 0.4 ? -1 : 0; let t = 0.14 + JT.R() * 0.1, turn = (JT.R() - 0.5) * 2.4 * sp._strug;
        if (F.back || F.push) { back = -1; sd *= 0.35; t += F.back ? 0.16 : 0.1; }           // sprinting / shoving: dragged backwards
        else if (F.whip) { sd = (sp._ySide = -(sp._ySide || 1)); back = 0; }               // S-whips: side to side
        else if (F.kick) { back = -1; sd *= 0.6; t *= 0.7; }                                // hind-leg kicks: short sharp shoves
        if (F.spin || F.thrash) turn *= 2;
        sp._yank = { dir: M.norm([-f[2] * sd + f[0] * back, 0, f[0] * sd + f[2] * back]), t, turn, k: F.drag || 1 }; }
      const Y = sp._yank;
      if (Y && Y.t > 0) {
        Y.t -= dt; regionStep(hab, sp, Y.dir, AI.len(sp) * 1.1 * sp._strug * dt * (Y.k || 1));
        if (sp.sup.k !== 'path') { const f = sp.fwd || [1, 0, 0]; const a = Y.turn * dt * 4; const c = Math.cos(a), sn = Math.sin(a); sp.fwd = M.norm([f[0] * c - f[2] * sn, 0, f[0] * sn + f[2] * c]); }
      }
    }
    if (sp.st >= sp._subdueDur) { p._struggle = 0; sp._strug = 0; if ((sp._catchRatio || 0) >= 1.5) hab.event('journal', { id: 'giantMeal', sp }); startSecure(hab, sp); }
  };
  /** Visual wrestling pose of the pair (roll / pitch / lift, sprung), kicked by the prey's own way of fighting. */
  function thrash(hab, sp, p, dt, hanging) {
    const P = pose(sp); const F = famOf(p); const k = sp._strug || 0; const big = M.clamp(sp._catchRatio || 0.5, 0.3, 2);
    P.tT = (P.tT || 0) - dt;
    if (P.tT <= 0 && k > 0.12) { P.tT = 0.18 + JT.R() * 0.45; const a = k * Math.min(1.4, big);
      if (F.lift && !hanging && JT.R() < 0.55 * F.lift) P.vl += (1.6 + JT.R() * 2) * a;          // flies lift the pair off in little hops
      if (F.kick) P.vp += (JT.R() < 0.5 ? 2.4 : -1.6) * a * F.kick;                                // kicks buck the pair
      if (F.rear) P.vp += (2.6 + JT.R()) * a;                                                       // a caterpillar rears up (bull ride)
      if (F.push && p.type === 'darkling') P.vp -= 1.4 * a;                                         // darkling raises its rear
      if (F.roll || F.whip) P.vr += (JT.R() - 0.5) * 7 * a * (F.roll || 0.6);                     // rolling / whipping
      if (F.bounce && !hanging) P.vl += 1.1 * a * F.bounce;
      if (F.thrash || F.spin) P.vr += (JT.R() - 0.5) * 3 * a;
      const fl = F.flip || (F.roll ? 0.15 : 0); if (fl && k > 0.35 && big > 0.7 && P.flipT <= 0 && JT.R() < fl * a * 0.6) { P.flipT = 0.45 + JT.R() * 0.4; P.flipS = JT.R() < 0.5 ? 1 : -1; } // the pair flips over
    }
    poseStep(P, dt);
  }
  function poseStep(P, dt) {
    const h = Math.min(dt, 0.05); const tr = P.flipT > 0 ? Math.PI * 0.94 * P.flipS : 0; P.flipT = Math.max(0, P.flipT - dt);
    P.vr += ((tr - P.r) * 38 - P.vr * 8) * h; P.r = M.clamp(P.r + P.vr * h, -3.3, 3.3);
    P.vp += (-P.p * 55 - P.vp * 8) * h; P.p = M.clamp(P.p + P.vp * h, -0.8, 0.9);
    P.vl += (-P.l * 45 - P.vl * 6) * h; P.l += P.vl * h; if (P.l < 0) { P.l = 0; P.vl = Math.abs(P.vl) * 0.25; } P.l = Math.min(P.l, 1.4);
  }
  AI.poseStep = poseStep;
  /** The catch thrashes free: venom so far leaves it groggy; the jumper is thrown back on its dragline and hesitates. */
  function shakeOff(hab, sp, p, u) {
    const def = JT.PREY_BY_ID[p.type] || {}; const nm = preyName(def); const L = AI.len(sp);
    sp.hold = null; sp._escAt = -1; sp._strug = 0; sp._yank = null; p._struggle = 0; p.owner = null; p.state = 'idle'; p.st = 0; p.full = 1;
    // put the escapee down on real support beside the jumper
    if (def.climb && sp.sup && sp.sup.k !== 'air' && Nav.validSup(hab, sp.sup)) { p.sup = JT.deepClone(sp.sup); p.pos = Nav.supPos(hab, p.sup, p.pos); }
    else { const b = Nav.supportBelow(hab, [p.pos[0], p.pos[1] + 0.3, p.pos[2]]); if (b.pos[1] < p.pos[1] - 2) { p._route = { steps: [{ pos: b.pos, mode: 'drop', arrive: b.sup }], i: 0 }; p.sup = { k: 'air' }; p.state = 'walk'; } else { p.pos = b.pos; p.sup = b.sup; } }
    JT.PreyAI.weaken(hab, p, M.clamp(u * 1.15, 0.1, 1));
    if (p.state === 'idle') JT.PreyAI.escape(hab, p, sp, true);
    sp._wary = sp._wary || {}; sp._wary[p.id] = hab.time + 20 + (1 - sp.traits.bold) * 20;
    sp._hesitate = hab.time + 3 + (1 - sp.traits.bold) * 4; sp.stats.shaken = (sp.stats.shaken || 0) + 1;
    hab.event('shaken', { sp, prey: p }); hab.event('journal', { id: 'shakenOff', sp });
    sp._watchPos = p.pos.slice(); const P = pose(sp); P.vp += 3; P.flipT = 0;
    // knocked back: off a perch it drops on its dragline to the nearest surface; on flat ground it is thrown back a body length or two
    const reg = sp.sup && (sp.sup.k === 'floor' || sp.sup.k === 'top') ? hab.nav && hab.nav.regions[Nav.regionKey(sp.sup)] : null;
    sp._afterFall = 'watch';
    if (reg) {
      const back = horiz(M.mul(sp.fwd || [1, 0, 0], -1)); const D = L * (1.3 + JT.R() * 0.8); const x = sp.pos[0] + back[0] * D, z = sp.pos[2] + back[2] * D;
      const ok = (sp.sup.k === 'floor' ? Nav.inside(hab, x, z, 2) : G.pointInPoly(x, z, reg.poly)) && !reg.obstacles.some(o => G.pointInPoly(x, z, o));
      if (ok) { const from = sp.pos.slice(), to = [x, sp.pos[1], z]; sp._air = { from, to, t: 0, dur: 0.32, apex: L * 0.6, land: JT.deepClone(sp.sup), fall: true }; sp._anchor = from; sp.sup = { k: 'air' }; sp._route = null; setState(sp, 'fall'); }
      else startFall(hab, sp);
    } else startFall(hab, sp);
    sp.thought = 'Shaken off by the ' + nm + '! Backing off to regroup.';
  }
  AI._shakeOff = shakeOff;
  /** Just after the bite takes hold: the jumper keeps still with its catch, last twitches fading, peering round in quick
      head snaps. Then it picks a feeding spot, turns to face it and sets off carefully (tiny prey is eaten on the spot). */
  function startSecure(hab, sp, after) {
    const p = hab.preyById(sp.hold); if (!p) { setState(sp, 'idle'); return; }
    const nm = p.type === 'jumperMeal' ? 'jumper' : preyName(JT.PREY_BY_ID[p.type] || { name: 'prey' }); const tiny = TINY.has(p.type);
    const hk = M.clamp((0.5 - sp.sat) / 0.35, 0, 1);
    let dur = (1.5 + sp.traits.patience * 2.5) * (1 - 0.22 * sp.traits.bold - 0.2 * hk); if (tiny) dur *= 0.45; if (after === 'climb') dur += 0.7;
    sp._secDur = M.clamp(dur, tiny ? 0.6 : 1.5, after === 'climb' ? 4.7 : 4);
    sp._secPeerT = 0.25; sp._secLiftT = 0.5 + JT.R() * sp._secDur * 0.5; sp._secSpot = null; sp._secFaceT = 0; sp._secTurn = 0; sp._tw = 0.2;
    setState(sp, 'secure', after === 'climb' ? 'Back on top — pausing with the ' + nm + ' before moving on.' : tiny ? 'Holding the little ' + nm + ' a moment.' : 'Holding the ' + nm + ' still, making sure it is done.');
  }
  AI.startSecure = startSecure;
  H.secure = function (hab, sp, dt) {
    const p = hab.preyById(sp.hold); if (!p) { sp.hold = null; setState(sp, 'idle'); return; }
    const u = M.clamp(sp.st / sp._secDur, 0, 1); const tiny = TINY.has(p.type); const L = AI.len(sp);
    // last twitches, fading out
    sp._twT = (sp._twT || 0) - dt; if (sp._twT <= 0) { sp._twT = 0.25 + JT.R() * 0.6; if (JT.R() < 0.5 * (1 - u)) sp._tw = 0.14 + JT.R() * 0.16 * (1 - u); }
    sp._tw = Math.max(0, (sp._tw || 0) - dt * 0.5); p._struggle = sp._tw; p._anim = (p._anim || 0) + dt * (1 + 4 * sp._tw);
    // peering around in quick head snaps
    sp._secPeerT -= dt; if (sp._secPeerT <= 0) { sp._secPeerT = 0.45 + JT.R() * 0.7; const a = JT.R() * 6.28, r = 10 + JT.R() * 20; sp._glance = { pos: [sp.pos[0] + Math.cos(a) * r, sp.pos[1] + (JT.R() - 0.3) * 6, sp.pos[2] + Math.sin(a) * r], until: hab.time + 0.3 + JT.R() * 0.25 }; }
    // now and then it lifts the meal and shifts round a little
    if (sp.st >= sp._secLiftT) { sp._secLiftT = 1e9; pose(sp).vp += 2.2; sp._secTurn = (JT.R() - 0.5) * 1.6; }
    if (sp._secTurn && sp.sup.k !== 'path') { const f = sp.fwd || [1, 0, 0]; const a = sp._secTurn * dt * 2; const c = Math.cos(a), sn = Math.sin(a); sp.fwd = M.norm([f[0] * c - f[2] * sn, 0, f[0] * sn + f[2] * c]); sp._secTurn *= Math.max(0, 1 - dt * 2.5); if (Math.abs(sp._secTurn) < 0.05) sp._secTurn = 0; }
    poseStep(pose(sp), dt);
    // another jumper close by: cut the pause short and take the meal away from it
    sp._secIntT = (sp._secIntT || 0) - dt; if (sp._secIntT <= 0) { sp._secIntT = 0.3; const R = Math.max(9, L * 3.5); for (const o of hab.data.spiders) { if (o === sp || NEST_STATES.has(o.state) || o.state === 'sleep' || o.state === 'rest' || o.state === 'feed' || o.state === 'secure') continue; if (M.dist(o.pos, sp.pos) < R) { startCarry(hab, sp, { pos: o.pos.slice(), name: o.name }); return; } } }
    // shaky footing (a twig tip, a flower head): get off it rather than wait
    if (!tiny && sp.st > 0.5 && footing(hab, sp) > 0.6) { startCarry(hab, sp); return; }
    if (sp.st < sp._secDur) return;
    if (tiny) { startFeed(hab, sp); return; } // a mouthful: eaten right here
    if (!sp._secSpot) { sp._secSpot = AI.chooseSpot(hab, sp, 'feed', true) || 'none'; sp._secFaceT = 0; }
    const spot = sp._secSpot;
    if (spot === 'none' || M.dist(spot.node.pos, sp.pos) < 4) { startFeed(hab, sp); return; }
    const st0 = spot.route && spot.route.steps && spot.route.steps[0]; const first = st0 && M.dist(st0.pos, sp.pos) > 1 ? st0.pos : spot.node.pos;
    sp._secFaceT += dt; if (sp.sup.k !== 'path') faceToward(sp, first, dt, 5);
    if (sp._secFaceT > 0.55) startCarry(hab, sp, null, spot);
  };
  /** Score real reachable surfaces for feeding / molting / sleeping. Never returns a boundary. */
  /* Where a silk retreat (sleep or molt) may go: only flat, even ground with room for the hammock.
     Allowed: the tank floor, flat tops of free-standing decor (rock, cork, log, hide, ruin...) and the back wall
     itself (its rim and built-in ledges, if roomy enough). Never: plants, flowers, stems, branches, vines, sides,
     wall-mounted decorations, the flower pot or the water dish. */
  const NEST_BAN_ARCHE = new Set(['wallmount', 'dish', 'scatter']);
  const NEST_BAN_TYPE = new Set(['flowerpot', 'waterdish']);
  function edgeDist(x, z, poly) { let d = 1e9; for (let i = 0, n = poly.length; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; const ex = b[0] - a[0], ez = b[1] - a[1]; const l2 = ex * ex + ez * ez || 1e-9; const t = M.clamp(((x - a[0]) * ex + (z - a[1]) * ez) / l2, 0, 1); d = Math.min(d, Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t)); } return d; }
  AI.nestRoom = (L) => L * 0.6 + 0.4;
  AI.nestSiteOK = function (hab, sup, pos, L) {
    if (!sup || !pos) return false; const r = AI.nestRoom(L); let region;
    if (sup.k === 'floor') { if (!Nav.inside(hab, pos[0], pos[2], r)) return false; region = hab.nav && hab.nav.regions.F; }
    else if (sup.k === 'top') {
      const g = hab.geoms[sup.d]; if (!g || !g.def) return false; const def = g.def;
      if (def.cat === 'plants' || def.cat === 'ground' || NEST_BAN_ARCHE.has(def.arche) || NEST_BAN_TYPE.has(def.id)) return false;
      if (!(def.cat === 'decor' || def.arche === 'backwall')) return false;
      const t = g.tops[sup.i]; if (!t || !G.pointInPoly(pos[0], pos[2], t.poly) || edgeDist(pos[0], pos[2], t.poly) < r) return false;
      region = hab.nav && hab.nav.regions['T|' + sup.d + '|' + sup.i];
    } else return false;
    if (region) for (const o of region.obstacles) if (G.pointInPoly(pos[0], pos[2], o) || edgeDist(pos[0], pos[2], o) < r * 0.8) return false;
    return true;
  };
  /** Nearest reachable allowed spot (used when the jumper is somewhere it can't build). */
  AI.nearestNestSite = function (hab, sp) {
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); const L = AI.len(sp); let best = null, bc = 1e9;
    for (const n of hab.nav.nodes) { const c = dj.dist[n.id]; if (!isFinite(c) || c >= bc) continue; if (!AI.nestSiteOK(hab, n.sup, n.pos, L)) continue; bc = c; best = n; }
    if (!best) return null; const route = Nav.buildRoute(hab, dj, best.sup, best.pos); return route ? { node: best, route, high: best.y > 12, plant: false } : null;
  };
  AI.chooseSpot = function (hab, sp, mode, carry, avoid) {
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp, carry));
    const H0 = hab.dims.h; const S = sp_(sp);
    let best = null, bs = -1e9; const nesting = mode === 'sleep' || mode === 'molt'; const Ls = AI.len(sp);
    const others = hab.data.spiders.filter(o => o !== sp);
    const preyLive = hab.data.prey.filter(p => !p.owner && !p.buried);
    for (const n of hab.nav.nodes) {
      if (n.kind === 'face') continue; const c = dj.dist[n.id]; if (!isFinite(c)) continue;
      if (nesting && !AI.nestSiteOK(hab, n.sup, n.pos, Ls)) continue;
      const g = n.decor && hab.geoms[n.decor]; const plant = g && g.def.cat === 'plants';
      const cover = Nav.coverAt(hab, n.pos); const hgt = n.y / H0;
      let quiet = 60; for (const o of others) quiet = Math.min(quiet, M.dist(o.pos, n.pos)); 
      let traffic = 50; for (const p of preyLive) traffic = Math.min(traffic, M.dist(p.pos, n.pos));
      let s;
      if (mode === 'feed') s = hgt * 6 * (0.6 + S.prefs.height) + (plant ? 3 : 0) + (g && !plant ? 1 : 0) + cover * 3 + quiet * 0.04 + traffic * 0.03 - c * 0.025;
      else if (mode === 'molt') s = hgt * 12 + (g ? 1.5 : 0) + cover * 4 + (n.perch ? 0.5 : 0) + quiet * 0.06 + traffic * 0.02 - c * 0.012;
      else s = hgt * 3 * (0.5 + S.prefs.height) + cover * 5 + quiet * 0.05 - c * 0.02 + (sp.home && M.dist(sp.home.pos, n.pos) < 8 ? 3 : 0) + (!nesting && AI.blendAt(hab, sp.species, n.sup, n.pos) ? 1.5 : 0);
      for (const o of others) if (o.retreat && o.retreat.pos && M.dist(o.retreat.pos, n.pos) < 10) s -= 4;
      if (avoid) { const ad = M.dist(avoid, n.pos); if (ad < 12) continue; s -= Math.max(0, 34 - ad) * 0.25; }
      if (s > bs) { bs = s; best = n; }
    }
    if (!best) return null;
    const route = Nav.buildRoute(hab, dj, best.sup, best.pos);
    if (!route) return null;
    return { node: best, route, high: best.y > 12, plant: !!(best.decor && hab.geoms[best.decor] && hab.geoms[best.decor].def.cat === 'plants') };
  };
  function startCarry(hab, sp, from, chosen) {
    const spot = chosen || AI.chooseSpot(hab, sp, 'feed', true, from ? from.pos : null);
    if (!spot || M.dist(spot.node.pos, sp.pos) < 4) { startFeed(hab, sp); return; }
    sp._route = spot.route; sp._routeStart = hab.time; sp._feedSpot = spot.node.pos.slice();
    const p = hab.preyById(sp.hold); const nm = p ? preyName(JT.PREY_BY_ID[p.type]) : 'meal';
    setState(sp, 'carry', from ? 'Carrying the ' + nm + ' away from the ' + from.name + '.' : spot.high ? 'Carrying the ' + nm + ' up to a safe feeding perch.' : 'Carrying the ' + nm + ' to a quiet, sheltered spot.');
    sp._carrySafe = spot.high || spot.plant;
  }
  H.carry = function (hab, sp, dt) {
    if (!sp.hold || !hab.preyById(sp.hold)) { sp.hold = null; setState(sp, 'idle'); return; }
    const r = move(hab, sp, dt, (sp._catchRatio || 0) > 1 ? 0.55 : 0.68); // slow and careful with its meal
    if (r === 'none' && sp.sup.k !== 'air') { startFeed(hab, sp); return; } // route invalidated: eat right here
    if (r === 'done') { if (sp._carrySafe) hab.event('journal', { id: 'safeMeal', sp }); startFeed(hab, sp); return; }
    if (stuck(hab, sp) && !sp._air) { sp._route = null; startFeed(hab, sp); }
  };
  function startFeed(hab, sp) {
    sp._route = null; const p = hab.preyById(sp.hold); if (!p) { setState(sp, 'idle'); return; }
    const def = JT.PREY_BY_ID[p.type];
    sp._feedDur = 6 + (p.type === 'jumperMeal' ? 0.8 : def.nut) * 28; sp._feedNut = p.type === 'jumperMeal' ? 0.25 + (p.len || 5) * 0.05 : AI.nutOf(def);
    const big = Math.max(0, (sp._catchRatio || 0) - 1); if (big > 0) { sp._feedDur *= 1 + big * 0.6; sp._feedNut *= 1 + big * 0.3; } // a big meal: longer feeding, more filling
    setState(sp, 'feed', 'Feeding on the ' + (p.type === 'jumperMeal' ? 'unlucky jumper' : preyName(def)) + '.');
  }
  H.feed = function (hab, sp, dt) {
    const p = hab.preyById(sp.hold); if (!p) { sp.hold = null; setState(sp, 'idle'); return; }
    // something came close: chewing pauses, the body turns to put itself between the intruder and the meal
    if (sp._shield && hab.time < sp._shield.until) { const away = M.sub(sp.pos, sp._shield.pos); away[1] = 0; if (M.len(away) > 0.1 && sp.sup.k !== 'path') faceToward(sp, M.add(sp.pos, away), dt, 4); }
    if (sp._chewPause > hab.time) { sp.st -= dt; return; }
    const k = dt / sp._feedDur; sp.sat = Math.min(1.05, sp.sat + sp._feedNut * k * 1.15); p.full = Math.max(0.25, 1 - sp.st / sp._feedDur * 0.7);
    if (sp.st >= sp._feedDur) finishMeal(hab, sp, p);
  };
  function finishMeal(hab, sp, p) {
    const def = JT.PREY_BY_ID[p.type];
    hab.data.prey = hab.data.prey.filter(x => x !== p); sp.hold = null;
    hab.addRemains(p.type, sp.pos, sp.sup, p.type === 'jumperMeal' ? 'spider' : 'husk', p.type === 'jumperMeal' ? { species: p.species, len: p.len } : {});
    sp.catches++; sp.meals++;
    hab.event('meal', { sp });
    hab.event('journal', { id: 'firstHunt', sp });
    sp._afterMeal = hab.time; sp._patrolCD = 0;
    setState(sp, 'postFeed', 'Full and resting after its meal.');
  }

  // ---- thirst ----
  function startDrink(hab, sp, maxCost) {
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp));
    const srcs = hab.data.drops.map(d => ({ pos: d.pos, sup: d.sup, id: d.id, decor: d.decor, pool: !!d.pool })).concat(maxCost ? [] : hab.nav.water.map((w, i) => ({ pos: w.pos, sup: w.sup, decor: w.decor, perm: i })));
    let best = null, bc = maxCost || 260;
    for (const s of srcs) { const gc = Nav.goalCost(hab, dj, s.sup, s.pos); if (gc && gc.cost < bc) { bc = gc.cost; best = s; } }
    if (!best) { sp._drinkFail = hab.time + (maxCost ? 12 : 30); return false; }
    const r = Nav.buildRoute(hab, dj, best.sup, best.pos); if (!r) { sp._drinkFail = hab.time + 30; return false; }
    sp._route = r; sp._routeStart = hab.time; sp._drink = best; AI.dropTarget(hab, sp);
    const dn = decorName(hab, best.decor);
    setState(sp, 'drinkSeek', (maxCost ? 'Off to sip ' : 'Thirsty — heading for ') + (best.id ? (best.pool ? 'a little puddle of mist water' : 'a droplet') : 'water') + (dn ? ' on the ' + dn : '') + '.');
    return true;
  }
  H.drinkSeek = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.9);
    if (sp._drink && sp._drink.id && !hab.data.drops.find(d => d.id === sp._drink.id)) { sp._route = null; setState(sp, 'idle', 'The droplet evaporated.'); return; }
    if (r === 'done' || r === 'none') { sp._route = null; setState(sp, 'drink', sp._drink && sp._drink.pool ? 'Drinking from a little puddle.' : 'Sipping a droplet.'); }
    else if (stuck(hab, sp)) { sp._route = null; setState(sp, 'idle'); }
  };
  H.drink = function (hab, sp, dt) {
    if (sp.st > 3) {
      sp.hyd = Math.min(1, sp.hyd + 0.55);
      if (sp._drink && sp._drink.id) { const pd = hab.data.drops.find(d => d.id === sp._drink.id); if (pd && pd.pool) { pd.life -= 70; if (pd.life <= 0) hab.data.drops = hab.data.drops.filter(d => d !== pd); } else hab.data.drops = hab.data.drops.filter(d => d.id !== sp._drink.id); } // v15: a mist pool lasts a few drinks
      sp._drink = null; hab.event('journal', { id: 'drink', sp });
      if (JT.Biome && hab.data.bev && ['rain','storm'].includes(hab.data.bev.id)) hab.event('journal', { id: 'rainDrink', sp });
      setState(sp, 'groom', 'Refreshed. Wiping its palps.');
    }
  };
  /** Duck under the nearest good cover (used by shy jumpers when startled). */
  function toCover(hab, sp, line) {
    if (Nav.coverAt(hab, sp.pos) >= 0.35 || sp.sup.k === 'air' || !hab.nav || !hab.nav.nodes.length) return false;
    const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); let best = null, bs = -1e9;
    for (let k = 0; k < 24; k++) { const n = hab.nav.nodes[Math.floor(JT.R() * hab.nav.nodes.length)]; if (!n || n.kind === 'face' || !isFinite(dj.dist[n.id]) || dj.dist[n.id] > 70) continue; const sc = Nav.coverAt(hab, n.pos) * 3 - dj.dist[n.id] * 0.03; if (sc > bs) { bs = sc; best = n; } }
    if (best && bs > 1) { const r = Nav.buildRoute(hab, dj, best.sup, best.pos); if (r) { sp._route = r; sp._routeStart = hab.time; sp._lookout = false; setState(sp, 'explore', line); return true; } }
    return false;
  }
  AI.onMist = function (hab, sp) {
    if ((PRI[sp.state] || 0) >= 15) return;
    if (AI.has(sp, 'shy') && toCover(hab, sp, 'Startled by the mist — scurrying under cover.')) return;
    if (AI.has(sp, 'bold')) { if (JT.R() < 0.3) setState(sp, 'groom', 'Mist? Barely noticed. Wiping off a droplet.'); return; }
    if (JT.R() < 0.5) { setState(sp, 'groom', 'A droplet landed nearby — pausing to groom.'); }
  };

  // ---- species signature moves ----
  /** Bagheera kiplingi: walk to a flower (or any leafy plant) and sip nectar / nibble food bodies instead of hunting. */
  function startNectar(hab, sp) {
    sp._nectarCD = hab.time + 25; const plants = hab.data.decor.filter(d => { const D = JT.DECOR_BY_ID[d.type]; return D && (D.cat === 'plants' || (D.arche === 'backwall')); });
    if (!plants.length) return false; let best = null, bs = -1e9;
    for (const d of plants) { const D = JT.DECOR_BY_ID[d.type]; const fl = D.arche === 'flower' || (D.p && D.p.petal) || D.flowers; const n = Nav.nearestNodeOfDecor(hab.nav, d.id, sp.pos); if (!n) continue; const sc = (fl ? 30 : 0) - M.dist(n.pos, sp.pos) * 0.3 + JT.R() * 4; if (sc > bs) { bs = sc; best = { n, d, fl }; } }
    if (!best) return false; const r = routeTo(hab, sp, best.n.sup, best.n.pos); if (!r) return false;
    sp._nectar = { decor: best.d.id, fl: !!best.fl }; setState(sp, 'nectarSeek', best.fl ? 'Off to the ' + JT.DECOR_BY_ID[best.d.type].name.toLowerCase() + ' for a sip of nectar.' : 'Looking for plant food bodies on the ' + JT.DECOR_BY_ID[best.d.type].name.toLowerCase() + '.'); return true;
  }
  H.nectarSeek = function (hab, sp, dt) { const r = move(hab, sp, dt, 0.8); if (r === 'done') { sp._route = null; setState(sp, 'sip', sp._nectar && sp._nectar.fl ? 'Sipping nectar, mouthparts pressed to a flower.' : 'Nibbling a tiny plant food body.'); } else if (r === 'none' || stuck(hab, sp)) { sp._route = null; setState(sp, 'idle'); } };
  H.sip = function (hab, sp, dt) {
    const fl = sp._nectar && sp._nectar.fl; sp.sat = Math.min(1.02, sp.sat + dt * (fl ? 0.03 : 0.018)); sp.hyd = Math.min(1, (sp.hyd != null ? sp.hyd : 1) + dt * 0.02);
    if (sp.st > 7) { sp.sips = (sp.sips | 0) + 1; if (sp.sips % 2 === 0) sp.meals++; if (fl) hab.event('journal', { id: 'nectarSip', sp }); sp._nectar = null; setState(sp, 'lookout', fl ? 'Sweet. Back to watching the world.' : 'A small green snack. Back to watching.'); }
  };
  /** Myrmarachne: an ant-like march along a zig-zag trail, front legs waving as fake antennae. */
  function startAntMarch(hab, sp) {
    if (sp.sup.k === 'air' || !hab.nav || !hab.nav.nodes.length) return false; const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); let best = null, bs = -1e9;
    for (let k = 0; k < 30; k++) { const n = hab.nav.nodes[Math.floor(JT.R() * hab.nav.nodes.length)]; if (!n || n.kind === 'face' || !isFinite(dj.dist[n.id])) continue; const d = dj.dist[n.id]; if (d < 25 || d > 90) continue; const sc = -Math.abs(d - 55) * 0.1 + JT.R() * 3; if (sc > bs) { bs = sc; best = n; } }
    if (!best) return false; const r = Nav.buildRoute(hab, dj, best.sup, best.pos); if (!r) return false;
    sp._route = r; sp._routeStart = hab.time; setState(sp, 'antMarch', 'Marching like an ant, front legs waving as fake antennae.'); return true;
  }
  H.antMarch = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 1.05);
    if (sp.st > 3 && !sp._antJ) { sp._antJ = 1; hab.event('journal', { id: 'antMarch', sp }); }
    if (r === 'done' || r === 'none' || stuck(hab, sp)) { sp._route = null; sp._antJ = 0; setState(sp, 'lookout', 'Stopped, antennae-legs still twitching.'); }
  };
  /** Hasarius: palps flashed up and down in turn; facing whoever it signals to. */
  H.semaphore = function (hab, sp, dt) { if (sp._watchPos) faceToward(sp, sp._watchPos, dt, 3); if (sp.st > 3.2) { sp._watchPos = null; setState(sp, 'lookout', 'Palps down. Message sent.'); } };

  // ---- curiosity about you: a fingertip on the glass ----
  // hab.finger = { id, pos, t, held, fast } is set by the UI (transient, never saved). Each gesture gets one
  // personality-driven reaction; a held, slowly moving finger keeps curious jumpers following it.
  AI.fingerReact = function (hab, sp) {
    const f = hab.finger; if (!f || !f.pos) return;
    const age = hab.time - f.t; if (age > (f.held ? 0.8 : 2)) return;
    if (sp._air || NEST_STATES.has(sp.state) || sp.hold) return;
    const d = M.dist(sp.pos, f.pos); if (d > 48) return;
    const pri = PRI[sp.state] || 0;
    if (pri < 40) sp._glance = { pos: f.pos.slice(), until: hab.time + 0.9 }; // everyone at least looks
    if (sp.state === 'curious' || sp.state === 'fingerWatch') { if (!f.fast) { sp._watchPos = f.pos.slice(); sp._fingerT = hab.time; } }
    if (pri >= 15 && sp.state !== 'curious' && sp.state !== 'fingerWatch') return;
    const startle = (f.fast && d < 30) || (d < 7 && (sp.tame || 0) < 0.25);
    if (sp._fingerSeen === f.id && !(startle && sp.state === 'curious')) return;
    sp._fingerSeen = f.id; if (sp._fingerCD > hab.time && !startle) return; sp._fingerCD = hab.time + 2.5;
    const tame = sp.tame || 0, has = (id) => AI.has(sp, id);
    const shyK = has('shy') ? 1 : 0, cur = sp.pers.curiosity + (has('curious') ? 0.35 : 0) + (has('bold') ? 0.2 : 0) + tame * 0.6;
    sp._watchPos = f.pos.slice(); sp._fingerT = hab.time; sp._route = null;
    if (startle || (shyK && tame < 0.55 && JT.R() < 0.75)) {
      sp.tame = Math.max(0, tame - (startle ? 0.06 : 0.01));
      if ((shyK || startle && !has('bold')) && toCover(hab, sp, startle ? 'Your quick finger startled it — darting for cover!' : 'A big shape at the glass — hiding under the leaves.')) { hab.event('finger', { sp, kind: 'shy' }); hab.event('journal', { id: 'fingerShy', sp }); return; }
      if (has('bold')) { setState(sp, 'display', 'Rears up and raises its legs at your finger!'); return; }
      setState(sp, 'fingerWatch', startle ? 'Flinched — keeping a nervous eye on you.' : 'Watching your finger warily.'); return;
    }
    if (has('aloof') && tame < 0.6 && JT.R() < 0.7) return; // a glance is all you get
    if (cur > 0.75 || (cur > 0.45 && JT.R() < cur)) {
      sp.tame = Math.min(1, tame + 0.035 * (sp_(sp).sig === 'saltator' ? 2 : 1) * (JT.Biome ? JT.Biome.tameK(hab, sp) : 1)); // Saltator: warms to you twice as fast
      if (JT.sigHas(sp_(sp), 'semaphore') && JT.R() < (sp_(sp).sig === 'saltator' ? 0.85 : 0.6)) { setState(sp, 'semaphore', sp_(sp).sig === 'saltator' ? 'Waving back at your finger, white-gloved palps flashing!' : 'Waving its bright white palps at your finger like semaphore flags!'); if (sp_(sp).sig === 'saltator' && sp._finaleT > hab.time - 240) hab.event('journal', { id: 'grandFinale', sp }); hab.event('finger', { sp, kind: 'curious' }); hab.event('journal', { id: 'semaphore', sp }); hab.event('journal', { id: 'fingerCurious', sp }); return; }
      setState(sp, 'curious', tame > 0.6 ? 'Recognises your finger — tilting its head to greet you.' : 'Turns all its eyes on your finger, head tilting.');
      hab.event('finger', { sp, kind: 'curious' }); hab.event('journal', { id: 'fingerCurious', sp }); return;
    }
    sp.tame = Math.min(1, tame + 0.015 * (JT.Biome ? JT.Biome.tameK(hab, sp) : 1));
    setState(sp, 'fingerWatch', 'Watching your finger through the glass.');
  };
  function fingerLive(hab, sp) { const f = hab.finger; return f && f.pos && hab.time - f.t < (f.held ? 0.8 : 2) ? f : null; }
  H.fingerWatch = function (hab, sp, dt) {
    if (sp._watchPos) faceToward(sp, sp._watchPos, dt, 3);
    if (sp.st > 4 || (sp.st > 1.5 && !fingerLive(hab, sp))) { setState(sp, 'lookout', 'Lost interest in the glass.'); sp._watchPos = null; }
  };
  H.curious = function (hab, sp, dt) {
    const f = fingerLive(hab, sp);
    if (sp._route) {
      const r = move(hab, sp, dt, 0.7);
      if (r !== 'moving' || stuck(hab, sp) || (sp._watchPos && M.dist(sp.pos, sp._watchPos) < 6)) sp._route = null;
    } else if (sp._watchPos) faceToward(sp, sp._watchPos, dt, 4);
    // a finger held still nearby: creep closer (re-planned at most every 1.5 s)
    if (f && f.held && !f.fast && !sp._route && M.dist(sp.pos, f.pos) > 8 && hab.time > (sp._fingerRT || 0) && hab.nav && hab.nav.nodes.length) {
      sp._fingerRT = hab.time + 1.5;
      const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); let best = null, bs = 1e9;
      for (const n of hab.nav.nodes) { if (n.kind === 'face' || !isFinite(dj.dist[n.id]) || dj.dist[n.id] > 60) continue; const sc = M.dist(n.pos, f.pos) + dj.dist[n.id] * 0.15; if (sc < bs) { bs = sc; best = n; } }
      if (best && M.dist(best.pos, f.pos) < M.dist(sp.pos, f.pos) - 3) { const r = Nav.buildRoute(hab, dj, best.sup, best.pos); if (r) { sp._route = r; sp._routeStart = hab.time; sp.thought = 'Creeping closer to your finger…'; } }
    }
    if (!sp._route) {
      const idle = hab.time - (sp._fingerT || 0);
      if (idle > 2.5 || sp.st > 14) { sp.tame = Math.min(1, (sp.tame || 0) + 0.02 * (JT.Biome ? JT.Biome.tameK(hab, sp) : 1)); setState(sp, 'lookout', (sp.tame || 0) > 0.6 ? 'Settles back, unbothered — it knows you.' : 'Goes back to its own business.'); sp._watchPos = null; }
    }
  };

  // ---- molting (absolute priority once ready) ----
  function startMoltSeek(hab, sp) {
    AI.dropTarget(hab, sp); sp._seen = {}; sp._route = null; sp._plan = null;
    const okHere = AI.nestSiteOK(hab, sp.sup, sp.pos, AI.len(sp));
    const spot = AI.chooseSpot(hab, sp, 'molt') || (okHere ? null : AI.nearestNestSite(hab, sp));
    if (!spot || (okHere && M.dist(spot.node.pos, sp.pos) < 3)) { sp.retreat = { d: sp.sup.d || null, pos: sp.pos.slice() }; setState(sp, 'moltSilk', 'Pre-molt — weaving a molting hammock right here.'); return; }
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
      const spot = sp._moltReplans > 1 ? AI.nearestNestSite(hab, sp) : AI.chooseSpot(hab, sp, 'molt'); if (spot) { sp._route = spot.route; sp._routeStart = hab.time; sp.retreat = { d: spot.node.decor || null, pos: spot.node.pos.slice() }; } else { setState(sp, 'moltSilk'); }
    }
  };
  // ---- thick silk sac (sleep / molt): built around the jumper, carved open front or back on the way out ----
  const NEST_STATES = new Set(['sleep', 'moltSilk', 'premolt', 'molting', 'postMolt', 'emerge']);
  AI.NEST_STATES = NEST_STATES;
  /** Building a retreat: the jumper turns slowly on the spot (whole turns, so it finishes facing its doorway)
      while its hind legs draw silk from the spinnerets. A molting hammock is thicker and takes longer than a
      night's retreat; moving back into an old one is a short touch-up. */
  const SPIN = AI.SPIN = { sleep: { dur: 6, turns: 1 }, molt: { dur: 10, turns: 2 }, patch: { dur: 3, turns: 1 } };
  function startBuild(n, kind) { const c = SPIN[kind] || SPIN.sleep; n.build = { dur: c.dur, turns: c.turns, t: 0, from: n.prog || 0 }; n.spinA = 0; }
  function makeNest(hab, sp, kind) {
    const d = hab.data; d.nests = d.nests || [];
    let n = d.nests.find(x => !x.owner && M.dist(x.pos, sp.pos) < AI.len(sp) * 0.5 && x.age < 1500);
    if (n) { n.owner = sp.id; n.hole = null; n.prog = Math.min(n.prog, 0.5); n.age = 0; n.kind = kind; startBuild(n, 'patch'); }
    else {
      n = { id: JT.newId('n'), owner: sp.id, pos: sp.pos.slice(), sup: JT.deepClone(sp.sup), fwd: (sp.fwd || [1, 0, 0]).slice(), len: AI.len(sp), prog: 0, hole: null, age: 0, kind, seed: (JT.R() * 1e6) | 0 };
      d.nests.push(n); while (d.nests.length > 8) d.nests.shift(); startBuild(n, kind);
    }
    sp.nest = n.id; return n;
  }
  /** While the retreat is going up, keep the jumper turning on the spot around its surface normal. */
  function spinTurn(hab, sp) {
    const n = AI.nestOf(hab, sp); if (!n || !n.build || n.owner !== sp.id) return;
    const up = (Nav.validSup(hab, sp.sup) ? Nav.supFrame(hab, sp.sup).n : [0, 1, 0]) || [0, 1, 0];
    const a = M.clamp(n.build.t / n.build.dur, 0, 1) * n.build.turns * Math.PI * 2; n.spinA = a;
    let f0 = M.sub(n.fwd, M.mul(up, M.dot(n.fwd, up))); if (M.len(f0) < 1e-3) return; f0 = M.norm(f0); const s0 = M.norm(M.cross(up, f0));
    const f = M.norm(M.add(M.mul(f0, Math.cos(a)), M.mul(s0, Math.sin(a)))); if (M.finite3(f)) sp.fwd = f;
  }
  AI.spinTurn = spinTurn;
  AI.nestOf = (hab, sp) => sp.nest && (hab.data.nests || []).find(n => n.id === sp.nest);
  function startEmerge(hab, sp, next, thought) {
    const n = AI.nestOf(hab, sp); if (!n || n.prog < 0.3) { if (n) { n.owner = null; } sp.nest = null; setState(sp, next, thought); return; }
    sp._emergeNext = next; sp._emergeThought = thought; setState(sp, 'emerge');
    n.build = null; n.hole = { side: 1, open: 0, exit: 0 }; // always out through its one doorway, at the front
  }
  H.emerge = function (hab, sp, dt) {
    const n = AI.nestOf(hab, sp); if (!n || !n.hole) { sp.nest = null; setState(sp, sp._emergeNext || 'idle'); return; }
    const hd = M.mul(n.fwd, n.hole.side);
    faceToward(sp, M.add(sp.pos, hd), dt, 3);                         // turn toward the chosen end
    if (sp.st > 0.6) n.hole.open = Math.min(1, n.hole.open + dt / 1.4); // chew/pull a doorway open
    if (n.hole.open >= 1 && sp.st > 2.2) { // crawl out head first through the doorway
      const L = AI.len(sp); const out = M.add(n.pos, M.mul(hd, L * 0.95));
      const ok = sp.sup.k === 'floor' ? Nav.inside(hab, out[0], out[2], 2) : sp.sup.k === 'top' ? JT.G.pointInPoly(out[0], out[2], hab.geoms[sp.sup.d].tops[sp.sup.i].poly) : false;
      n.hole.exit = Math.min(1, (n.hole.exit || 0) + dt / 1.2);
      if (ok) { const k = M.smooth(n.hole.exit); sp.pos = [M.lerp(n.pos[0], out[0], k), sp.pos[1], M.lerp(n.pos[2], out[2], k)]; }
      if (n.hole.exit >= 1) { n.owner = null; sp.nest = null; setState(sp, sp._emergeNext || 'idle', sp._emergeThought); }
    }
  };
  AI.updateNests = function (hab, dt) {
    const ns = hab.data.nests; if (!ns || !ns.length) return;
    for (const n of ns) {
      const sp = n.owner && hab.spider(n.owner);
      if (sp && NEST_STATES.has(sp.state) && sp.nest === n.id) {
        if (n.build && sp.state !== 'emerge') { const b = n.build; b.t += dt; const k = Math.min(1, b.t / b.dur); n.prog = b.from + (1 - b.from) * k; if (k >= 1) { n.prog = 1; n.build = null; } }
        else if (sp.state !== 'emerge') n.prog = Math.min(1, n.prog + dt / 4); // older saves: retreats begun before building was animated
        n.age = 0;
      }
      else { if (n.owner) { n.owner = null; n.build = null; if (!n.hole && n.prog > 0.3) n.hole = { side: 1, open: 1, exit: 1 }; if (sp && sp.nest === n.id) sp.nest = null; } n.age += dt; }
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
    spinTurn(hab, sp); const nn = AI.nestOf(hab, sp);
    if ((nn && !nn.build && nn.prog >= 1) || sp.st > 16) { weave(hab, sp, 3, 'retreat'); hab.event('journal', { id: 'retreat', sp }); setState(sp, 'premolt', 'Sealed inside its molting hammock. Very still.'); }
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
    const okHere = AI.nestSiteOK(hab, sp.sup, sp.pos, AI.len(sp)); sp._sleepTries = 0;
    const spot = AI.chooseSpot(hab, sp, 'sleep') || (okHere ? null : AI.nearestNestSite(hab, sp));
    if (spot && (M.dist(spot.node.pos, sp.pos) > 3 || !okHere)) { sp._route = spot.route; sp._routeStart = hab.time; setState(sp, 'sleepSeek', 'Night is falling — heading to a sheltered retreat.'); }
    else { weave(hab, sp, 2, 'retreat'); makeNest(hab, sp, 'sleep'); setState(sp, 'sleep', 'Turning slowly on the spot, spinning a silk retreat for the night.'); }
  }
  H.sleepSeek = function (hab, sp, dt) {
    const r = move(hab, sp, dt, 0.7);
    if (r !== 'done' && (r === 'none' || stuck(hab, sp)) && !AI.nestSiteOK(hab, sp.sup, sp.pos, AI.len(sp)) && (sp._sleepTries = (sp._sleepTries || 0) + 1) <= 3) {
      const spot = AI.nearestNestSite(hab, sp); if (spot && spot.route) { sp._route = spot.route; sp._routeStart = hab.time; sp.st = 0; return; } }
    if (r === 'done' || r === 'none' || stuck(hab, sp)) { sp._route = null; weave(hab, sp, 2, 'retreat'); makeNest(hab, sp, 'sleep'); hab.event('journal', { id: 'retreat', sp }); if (!sp.home || JT.R() < 0.25) AI.setHome(hab, sp); setState(sp, 'sleep', 'Turning slowly on the spot, spinning a silk retreat for the night.'); }
  };
  H.sleep = function (hab, sp, dt) {
    spinTurn(hab, sp);
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
  /** Move off to somewhere farther from a point (used to give the ant mimic a wide berth). */
  function toCoverFrom(hab, sp, from, line) {
    if (!hab.nav || !hab.nav.nodes.length) return false; const dj = Nav.dijkstra(hab, sp.sup, sp.pos, AI.caps(sp)); let best = null, bs = -1e9;
    for (let k = 0; k < 30; k++) { const n = hab.nav.nodes[Math.floor(JT.R() * hab.nav.nodes.length)]; if (!n || n.kind === 'face' || !isFinite(dj.dist[n.id])) continue; const sc = M.dist(n.pos, from) - dj.dist[n.id] * 0.4; if (sc > bs) { bs = sc; best = n; } }
    if (!best || M.dist(best.pos, from) < M.dist(sp.pos, from) + 6) return false; const r = Nav.buildRoute(hab, dj, best.sup, best.pos); if (!r) return false;
    sp._route = r; sp._routeStart = hab.time; setState(sp, 'avoid', line); return true;
  }
  function social(hab, sp) {
    if (sp._socialCD > hab.time) return false;
    let o = null, od = 34;
    for (const x of hab.data.spiders) { if (x === sp || MOLT.has(x.state) || x.state === 'sleep') continue; const d = M.dist(x.pos, sp.pos); if (d < od) { od = d; o = x; } }
    if (!o) return false;
    const f = horiz(sp.fwd), to = horiz(M.sub(o.pos, sp.pos)); if (M.dot(f, to) < -0.3 && !o._moving) return false;
    sp._socialCD = hab.time + 20 + JT.R() * 20; sp._watchPos = o.pos.slice();
    const ratio = AI.len(o) / AI.len(sp);
    if (JT.sigHas(sp_(o), 'ant') && !JT.sigHas(sp_(sp), 'ant') && od < 28 && sp.sup.k !== 'air') { // takes the ant mimic for a real ant
      if (toCoverFrom(hab, sp, o.pos, 'Looks like an ant — backing well away from ' + o.name + '.')) { hab.event('journal', { id: 'antFooled', sp: o }); return true; }
    }
    if (JT.sigHas(sp_(sp), 'semaphore') && od < 30) { setState(sp, 'semaphore', 'Waving its white palps at ' + o.name + ' like semaphore flags.'); hab.event('journal', { id: 'semaphore', sp }); return true; }
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
      notice: 'Has spotted prey', assess: 'Sizing up prey', peek: 'Looking for vanished prey', stalk: 'Stalking prey', creep: 'Creeping closer', crouch: 'About to pounce', track: 'Tracking a flyer', pounce: 'Pouncing',
      subdue: 'Holding its catch', secure: 'Holding its catch still', carry: 'Carrying its catch', feed: 'Feeding', postFeed: 'Resting after a meal', fall: 'Leaping to safety',
      drinkSeek: 'Going for a drink', drink: 'Drinking a droplet', sleepSeek: 'Heading to bed', sleep: 'Asleep in its retreat',
      moltSeek: 'Looking for a molting spot', moltSilk: 'Spinning a molting hammock', premolt: 'Waiting to molt', molting: 'Molting', postMolt: 'Hardening after a molt', emerge: 'Leaving its retreat',
      flee: 'Fleeing', avoid: 'Keeping its distance', display: 'Displaying', watch: 'Watching warily', curious: 'Curious about you', fingerWatch: 'Watching you', antMarch: 'Marching like an ant', semaphore: 'Signalling with its palps', nectarSeek: 'Going for nectar', sip: 'Sipping nectar', investigate: 'Investigating', inspect: 'Inspecting something new',
      groom: 'Grooming', cleanEyes: 'Cleaning its eyes', look: 'Looking around', scuttle: 'Scuttling sideways', stretch: 'Stretching', dangle: 'Dangling on a silk line',
      baskSeek: 'Heading for the warm spot', bask: 'Basking under the lamp', homeSeek: 'Heading home', lunge: 'Lunged at a movement',
      explore: 'Exploring', lookout: 'Keeping a lookout', search: 'Searching for prey', rest: home ? 'Resting at home' : 'Resting', idle: 'Settling',
    };
    if (st === 'patrol' || st === 'scan') return lvl >= 2 ? 'Very hungry · wandering restlessly' : st === 'scan' ? 'Hungry · scanning for movement' : 'Hungry · patrolling for prey';
    const base = L[st] || 'Settling';
    if (lvl >= 2 && !HUNT.has(st) && !['feed', 'subdue', 'secure', 'carry', 'pounce', 'lunge'].includes(st) && !MOLT.has(st)) return 'Very hungry · ' + base.toLowerCase();
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
    if (AI.NO_SILK) return false; // packs whose critter makes no silk (mantis)
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
    if (sp.st > (sp._baskDur || 30)) { sp._baskCD = hab.time + (120 + JT.R() * 160) * (AI.has(sp, 'lazy') ? 0.5 : 1); sp._afterMeal = null; setState(sp, 'groom', 'Warmed through. Tidying its legs.'); }
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
      sp.sat = Math.max(0.2, sp.sat - dt * 0.00094); sp.hyd = Math.max(0.25, sp.hyd - dt * 0.0005); sp.ageDays += dt / DAY;
      if (sp.stage === 5) sp.adultDays = (sp.adultDays || 0) + dt / DAY;
      if (sp.soft > 0) sp.soft = Math.max(0, sp.soft - dt);
      if (sp.sat < 0.5 && !sp.hold && JT.R() < dt * 0.01) {
        const lim = AI.len(sp) * (sp.soft > 0 ? 1 : AI.sizeLimit(sp)); const p = hab.data.prey.find(q => !q.owner && JT.PREY_BY_ID[q.type].huntable && JT.PREY_BY_ID[q.type].len < lim);
        if (p) { const def = JT.PREY_BY_ID[p.type]; if (hab.game && hab.game.tallyPrey) hab.game.tallyPrey(sp, p); hab.removeEntity(p); sp.sat = Math.min(1, sp.sat + def.nut); sp.meals++; sp.catches++; hab.addRemains(p.type, sp.pos, sp.sup, 'husk'); hab.event('meal', { sp, offscreen: true }); }
      }
    }
    if (hab.data.humidity > 0.6) for (const d of hab.data.drops) d.life -= dt;
    for (const p of hab.data.prey) if (p.weak) { p.weak.t -= dt; if (p.weak.t <= 0) { p.weak = null; p._flip = 0; if (p.state === 'twitch') p.state = 'idle'; } } // groggy escapees recover off-screen too
  };

  /** Observation-mode interest of what a spider is doing right now. */
  AI.interest = function (sp) {
    const m = { curious: 58, fingerWatch: 30, semaphore: 62, sip: 40, antMarch: 28, nectarSeek: 20, pounce: 100, fall: 90, subdue: 90, secure: 70, molting: 95, moltSilk: 60, premolt: 45, crouch: 75, creep: 60, stalk: 55, track: 50, peek: 50, display: 65, flee: 70, carry: 60, feed: 42, drinkSeek: 30, drink: 38, notice: 45, assess: 45, moltSeek: 55, investigate: 35, inspect: 40, search: 30, postMolt: 40, avoid: 35, lunge: 55, dangle: 58, bask: 30, scan: 26, patrol: 28, scuttle: 20, cleanEyes: 22, stretch: 24 };
    return m[sp.state] || 8;
  };
  /* ---------------- visible personality ----------------
     Built from the jumper's own (already saved) traits, so every jumper, old saves included, has one. No random numbers
     are drawn here; the climbing preference comes from a hash of the jumper's id. Each trait also changes behaviour
     (where it rests, how it reacts to mist, how it explores, how it treats you), see pickIdle / onMist / curiosity. */
  const hashU = (id, salt) => (JT.hashStr(String(id) + salt) % 10007) / 10007;
  AI.climbPref = (sp) => sp.pers.climb != null ? sp.pers.climb : M.clamp(sp_(sp).prefs.height + (hashU(sp.id, 'climb') - 0.5) * 0.8, 0, 1);
  AI.TRAITS = {
    bold:     { label: 'Bold',      title: 'The Daredevil',    habit: 'Rests out in the open on high perches and barely flinches at mist.' },
    shy:      { label: 'Shy',       title: 'The Wallflower',   habit: 'Rests under cover, and tucks itself away when the tank is misted.' },
    curious:  { label: 'Curious',   title: 'The Snoop',        habit: 'Checks out anything new, and comes over to look at you.' },
    aloof:    { label: 'Aloof',     title: 'The Loner',        habit: 'Ignores newcomers and keeps its distance from you.' },
    busy:     { label: 'Busy',      title: 'The Busybody',     habit: 'Short rests, long patrols: always on the move.' },
    lazy:     { label: 'Laid-back', title: 'The Sunbather',    habit: 'Long naps, and loves a warm lamp or a quiet ledge.' },
    patient:  { label: 'Patient',   title: 'The Sentinel',     habit: 'Sits still for ages, watching, before it moves.' },
    restless: { label: 'Restless',  title: 'The Fidget',       habit: 'Can\'t sit still for long; hops from spot to spot.' },
    climber:  { label: 'Climber',   title: 'The High-flyer',   habit: 'Heads for the highest leaves and branches.' },
    ground:   { label: 'Ground-lover', title: 'The Ground-hugger', habit: 'Prefers the substrate, stones and low hides.' },
    tidy:     { label: 'Fastidious', title: 'The Neat Freak',  habit: 'Grooms its legs and wipes its eyes very often.' },
  };
  /** Trait strengths (positive = clearly shows it). */
  AI.traitScores = function (sp) {
    const S = sp_(sp), T = sp.traits, P = sp.pers; const c = AI.climbPref(sp);
    return {
      bold: (T.bold - S.traits.bold - 0.04) * 5 + Math.max(0, T.bold - 0.9) * 3, shy: (S.traits.bold - T.bold - 0.04) * 5 + Math.max(0, 0.4 - T.bold) * 3,
      curious: (P.curiosity - 0.62) * 2.6, aloof: (0.3 - P.curiosity) * 2.6,
      busy: (P.activity - S.prefs.activity - 0.06) * 6, lazy: (S.prefs.activity - P.activity - 0.06) * 6,
      patient: (T.patience - S.traits.patience - 0.05) * 6, restless: (S.traits.patience - T.patience - 0.05) * 6,
      climber: (c - 0.68) * 3, ground: (0.32 - c) * 3,
      tidy: (P.routine - 0.72) * 3,
    };
  };
  /** The jumper's visible personality: a title and its 2-3 clearest traits (the third shows once you have watched it a while). */
  AI.personality = function (sp) {
    if (!sp || !sp.traits || !sp.pers) return null;
    const sc = AI.traitScores(sp); const opp = { bold: 'shy', shy: 'bold', curious: 'aloof', aloof: 'curious', busy: 'lazy', lazy: 'busy', patient: 'restless', restless: 'patient', climber: 'ground', ground: 'climber' };
    let ids = Object.keys(sc).sort((a, b) => sc[b] - sc[a]); const out = [];
    for (const id of ids) { if (out.length >= 3) break; if (out.some(o => opp[o] === id)) continue; if (sc[id] > 0 || out.length < 2) out.push(id); }
    const shown = (sp.obsT || 0) >= 90 ? out.length : Math.min(2, out.length);
    return { ids: out, shown, title: AI.TRAITS[out[0]].title, traits: out.slice(0, shown).map(id => Object.assign({ id }, AI.TRAITS[id])), hidden: out.length - shown };
  };
  /** Does this jumper clearly show trait `id`? (cached for a few seconds: traits only drift with growth) */
  AI.has = function (sp, id) { if (!sp._pc || sp._pc.t !== (sp.stage | 0)) { const p = AI.personality(sp); sp._pc = { t: sp.stage | 0, ids: p ? p.ids : [] }; } return sp._pc.ids.includes(id); };
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
    sp._route = null; sp._air = null; sp._plan = null; sp._hang = null; sp._dangleOff = null; sp._glance = null; sp._dodge = null; sp._tVis = null;
    if (['pounce', 'fall'].includes(sp.state)) { const b = Nav.supportBelow(hab, sp.pos); sp.pos = b.pos; sp.sup = b.sup; sp.state = sp.hold ? 'subdue' : 'idle'; sp.st = 0; }
    if (HUNT.has(sp.state) || ['explore', 'patrol', 'scan', 'lunge', 'scuttle', 'dangle', 'look', 'baskSeek', 'homeSeek', 'search', 'drinkSeek', 'sleepSeek', 'flee', 'avoid', 'investigate', 'curious', 'fingerWatch', 'antMarch', 'semaphore', 'nectarSeek', 'sip'].includes(sp.state)) { sp.state = 'idle'; sp.target = null; }
    if (sp.state === 'carry' || sp.state === 'secure') { sp.state = 'subdue'; sp.st = 99; sp._subdueDur = 0; }
    if (sp.state === 'feed') { const p = hab.preyById(sp.hold); if (p) { const def = JT.PREY_BY_ID[p.type]; sp._feedDur = 6 + (def.nut || 0.5) * 28; sp._feedNut = def.nut || 0.5; } else sp.state = 'idle'; }
    if (sp.state === 'subdue') sp._subdueDur = sp._subdueDur || 1;
    if (sp.state === 'moltSeek') sp.state = 'idle';
    if (sp.state === 'crouch') sp.state = 'idle';
    if (sp.home && !Nav.validSup(hab, sp.home.sup)) sp.home = null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
