// v21 critter paths: ground cover is walked OVER (bulgy) or ON (flat), floor routes never cut through trunks / stems / logs /
// rocks, climbs start from the visible foot of the trunk, and drawn bodies don't visibly jump. node tests/critter_paths.js [index.html] [--quick]
const fs = require('fs'), vm = require('vm'), path = require('path');
const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..', 'index.html'); const quick = process.argv.includes('--quick');
const html = fs.readFileSync(file, 'utf8'); const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]); const store = {};
const ctx = { console, Math, Date, JSON, setTimeout, clearTimeout, performance: { now: () => Date.now() }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
for (const b of blocks) { if (/Jumper Terrarium — interface/.test(b)) break; try { vm.runInContext(b, ctx); } catch (e) { /* DOM-only blocks */ } }
const JT = ctx.JT, M = JT.M, D = JT.Draw, S = JT.Solid, G = JT.G, T = JT.Terrain, Nav = JT.Nav; JT.R = JT.makeRng(21);
const ok = [], bad = []; const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
const mk = (th) => { const g = new JT.Game(); g.newGame(); const h = g.createHabitat('standard'); g.activate(g.habs.indexOf(h)); if (th) JT.Presets.generate(h, th, 7, false); return { g, h }; };
const lone = (type) => { const { g, h } = mk(null); h.data.decor = []; h.rebuild(); const inst = h.addDecor(type, h.dims.w / 2, h.dims.d / 2, 0, 3, 'player'); return { g, h, inst }; };
// 1) ground cover relief: every ground cover checked (bulgy = raised, flat = not)
const BULGY = new Set(['moss', 'lichen', 'clover', 'pebbles', 'pods', 'cones', 'twigs']); const FLAT = new Set(['leaves', 'oak', 'magnolia', 'chips']); const cov = {};
for (const def of JT.DECOR) { if (def.arche !== 'scatter') continue; const { h, inst } = lone(def.id); if (!inst) { cov[def.id] = 'not placed'; continue; }
  const c = T.cover(h); const k = def.p.kind; cov[def.id] = +c.max.toFixed(2);
  if (BULGY.has(k)) t('cover: ' + def.id + ' (' + k + ') is walked over', c.max > 0.6 && c.max < 5, c.max); else if (FLAT.has(k)) t('cover: ' + def.id + ' (' + k + ') is walked on flat', !(c.max > 0), c.max); else t('cover: ' + def.id + ' kind known', false, k);
  if (c.max > 0) { const ter = T.get(h); const centre = [inst.x, 0, inst.z]; let hi = 0; for (let a = 0; a < 40; a++) { const q = [inst.x + Math.cos(a) * (a % 7) * 2, 0, inst.z + Math.sin(a) * (a % 7) * 1.4]; hi = Math.max(hi, T.liftWith(ter, q)[1]); } t('cover: ' + def.id + ' lifts a body on the floor', hi > 0.4, hi);
    const high = T.liftWith(ter, [inst.x, 8, inst.z]); t('cover: ' + def.id + ' does not lift a body high above the floor', high[1] === 8, high); }
  // the step between neighbouring samples stays gentle (no visible pop up / down)
  if (c.max > 0) { let st = 0; for (let x = inst.x - 30; x < inst.x + 30; x += 0.25) { const a = T.coverAt(h, x, inst.z), b = T.coverAt(h, x + 0.25, inst.z); st = Math.max(st, Math.abs(a - b)); } t('cover: ' + def.id + ' relief is smooth (step ' + st.toFixed(2) + ' per 0.25)', st < 0.35, st); } }
{ const { h } = lone('mosspatch'); const v0 = h._geomVersion; T.cover(h); T.get(h); const t0 = Date.now(); for (let i = 0; i < 200; i++) T.get(h); t('cover: cached between frames', Date.now() - t0 < 200 && h._cov._gv === v0, Date.now() - t0); }
// 2) floor graph: no floor edge runs through a footprint, approach points are on open floor
let edges = 0, through = 0, apprs = 0, apprBad = 0; const where = {};
const crossLen = (h, A, B) => { let w = 0, id = null; for (const i of h.decor) { const g = h.geoms[i.id]; if (!g || i.parent) continue; for (const s of g.solids.concat(g.soft || [])) { const L = Math.hypot(B[0] - A[0], B[2] - A[2]); const n = Math.max(2, Math.ceil(L / 0.5)); let k = 0; for (let j = 1; j < n; j++) { const u = j / n; if (G.pointInPoly(A[0] + (B[0] - A[0]) * u, A[2] + (B[2] - A[2]) * u, s)) k++; } const l = L * k / n; if (l > w) { w = l; id = i.type; } } } return [w, id]; };
const THEMES = Object.keys(JT.PRESET_THEMES);
for (const th of THEMES) { const { h } = mk(th); const nav = h.nav; const NP = (n) => n.appr || n.pos;
  for (const n of nav.nodes) if (n.appr) { apprs++; if (nav.regions.F.obstacles.some(o => G.pointInPoly(n.appr[0], n.appr[2], o))) apprBad++; }
  for (let a = 0; a < nav.nodes.length; a++) for (const e of nav.adj[a]) { if (e.type !== 'region' || e.region !== 'F' || e.to < a) continue; edges++; const A = nav.nodes[a], B = nav.nodes[e.to]; const [w, id] = crossLen(h, NP(A), NP(B)); if (w > Nav.SOFT_IN + 0.6) { through++; where[th + ':' + id] = (where[th + ':' + id] || 0) + 1; } } }
t('graph: approach points on open floor (' + apprs + ')', apprs > 20 && apprBad === 0, { apprs, apprBad });
t('graph: no floor edge cuts through a footprint (' + edges + ' edges)', through === 0, { through, where });
// 3) routes: floor legs of real routes stay out of footprints (random start / goal pairs, every theme)
let legs = 0, cut = 0, routes = 0; const cw = {};
for (const th of THEMES) { const { h } = mk(th); const nav = h.nav; const fl = nav.regions.F.nodes;
  for (let k = 0; k < (quick ? 30 : 80); k++) { const p0 = h.randomFloorPoint(), p1 = h.randomFloorPoint(); const r = Nav.route(h, { k: 'floor' }, p0, { k: 'floor' }, p1, { jump: 0, climb: true, drop: true }); if (!r) continue; routes++;
    let prev = p0; for (const st of r.steps) { const fla = st.mode === 'walk' && !st.snap && (!st.during || st.during.k === 'floor') && st.arrive && (st.arrive.k === 'floor' || st.arrive.k === 'path') && Math.abs(st.pos[1] - prev[1]) < 0.5 && prev[1] < 0.5;
      if (fla) { legs++; const [w, id] = crossLen(h, prev, st.pos); if (w > Nav.SOFT_IN + 0.6) { cut++; cw[th + ':' + id] = (cw[th + ':' + id] || 0) + 1; } } prev = st.pos; } } }
t('routes: floor legs go round trunks and rocks (' + legs + ' legs, ' + routes + ' routes)', routes > 500 && cut <= legs * 0.002, { cut, cw });
// 4) live: drawn bodies don't jump, simulated floor bodies stay out of decor
let samples = 0, inside = 0, jumps = 0; const jw = {}; const LIVE = quick ? ['flower', 'cork', 'paradise', 'forest', 'meadow', 'bog'] : THEMES; const SECS = quick ? 15 : 25;
for (const th of LIVE) { const { g, h } = mk(th); g.state.species = JT.SPECIES.map(s => s.id);
  JT.SPECIES.slice(0, 8).forEach((s, i) => { try { h.addSpider(s.id, { name: 'S' + i, stage: i % 6 }); } catch (e) { } }); for (const p of JT.PREY.slice(0, 10)) try { h.addPrey(p.id, 2); } catch (e) { }
  const last = new Map();
  for (let i = 0; i < SECS * 30; i++) { g.tick(1 / 30); if (i % 2) continue;
    for (const e of h.spiders.concat(h.prey)) { if (!e.sup || e.owner || e.buried || !M.finite3(e.pos) || e.sup.k !== 'floor') { last.delete(e); continue; }
      const L = e.species ? JT.SpiderAI.len(e) : (JT.PREY_BY_ID[e.type] || {}).len || 3; const mv = !!e._route; if (mv) samples++; /* walking bodies (a resting one may sit snug in a hollow log) */
      const c = [e.pos[0], e.pos[1] + Math.min(L * 0.3, 2.2), e.pos[2]]; let d = 0; for (const i2 of h.decor) { const gg = h.geoms[i2.id]; if (!gg || gg.def.cat === 'ground' || /wall/.test(gg.def.arche)) continue; const r = S.at(gg, c, 0.1); if (r && r.d > d) d = r.d; }
      if (mv && d > Math.max(0.25, L * 0.12)) inside++;
      const fr = D.frame(h, e, 0.05); const lp = last.get(e); last.set(e, { p: fr.p.slice(), s: e.pos.slice() });
      if (lp && M.dist(fr.p, lp.p) - M.dist(e.pos, lp.s) > Math.max(1.2, L * 0.5)) { jumps++; jw[th] = (jw[th] || 0) + 1; } } } }
const jpm = jumps / (LIVE.length * SECS / 60);
t('live: drawn bodies rarely jump (' + jpm.toFixed(2) + '/min, v20 ~17/min)', jpm < 2, { jumps, jw });
t('live: walking floor bodies clear of trunks / rocks (' + (100 * inside / samples).toFixed(2) + '% of ' + samples + ', v20 ~1%)', inside / samples < 0.004, { inside, samples });
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, bad, info: { cov, edges, apprs, legs, routes, samples, inside, jumps } }));
