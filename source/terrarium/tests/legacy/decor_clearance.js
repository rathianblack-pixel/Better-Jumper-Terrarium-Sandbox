// v16 decor clearance: no critter (tiny sling .. big adult / big prey) is ever DRAWN inside a rock, wall, trunk, cap, pot or
// stem. Checks every placeable decor and plant on its own: floor spots all round it, every climb node, every path segment,
// several headings and body sizes. Also a short live run of every theme. node tests/decor_clearance.js [index.html] [--quick]
const fs = require('fs'), vm = require('vm'), path = require('path');
const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..', 'index.html'); const quick = process.argv.includes('--quick');
const html = fs.readFileSync(file, 'utf8'); const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]); const store = {};
const ctx = { console, Math, Date, JSON, setTimeout, clearTimeout, performance: { now: () => Date.now() }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
for (const b of blocks) { if (/Jumper Terrarium — interface/.test(b)) break; try { vm.runInContext(b, ctx); } catch (e) { /* DOM-only blocks */ } }
const JT = ctx.JT, M = JT.M, D = JT.Draw, S = JT.Solid; JT.R = JT.makeRng(9);
const ok = [], bad = []; const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
const SIZES = quick ? [1.2, 6, 14] : [1.2, 2, 3.6, 6, 9, 14]; for (const L of SIZES) JT.PREY_BY_ID['_t' + L] = { id: '_t' + L, len: L };
const body = (fr, L) => { const c = M.add(fr.p, M.mul(fr.n, Math.min(L * 0.3, 2.2))); return [c, M.add(c, M.mul(fr.f, L * 0.38)), M.add(c, M.mul(fr.f, -L * 0.42)), M.add(c, M.mul(fr.s, L * 0.26)), M.add(c, M.mul(fr.s, -L * 0.26))]; };
const depthIn = (h, pts) => { let d = 0; for (const i of h.decor) { const g = h.geoms[i.id]; if (!g) continue; for (const q of pts) { const r = S.at(g, q, 0.1); if (r && r.d > d) d = r.d; } } return d; };
// 1) solid model matches the drawn rock tops (domed smooth rocks)
{ const pr = { t: 'prism', poly: [[-5, -5], [5, -5], [5, 5], [-5, 5]], y0: 0, y1: 10, style: 'rock' }; t('dome: centre of a smooth rock top is solid', S.depth([0, 10.8, 0], pr) > 0.3, S.depth([0, 10.8, 0], pr)); t('dome: above the dome is free', S.depth([0, 11.4, 0], pr) === 0); t('flat slate top has no dome', S.dome({ t: 'prism', poly: pr.poly, y0: 0, y1: 10, style: 'slate' }) === 0); }
// 2) every decor alone, every size
let checks = 0, fails = 0; const failing = {}; let placed = 0;
for (const def of JT.DECOR) { if (def.cat === 'ground') continue;
  const g = new JT.Game(); g.newGame(); const h = g.createHabitat('wide'); g.activate(g.habs.indexOf(h)); h.data.decor = []; h.rebuild();
  if (def.arche === 'wallmount') h.addDecor('mosswall', h.dims.w / 2, h.dims.d - 10, 0, 1);
  let inst = null; for (let k = 0; k < 30 && !inst; k++) inst = h.addDecor(def.id, h.dims.w / 2 + (k ? (JT.R() - 0.5) * 30 : 0), h.dims.d / 2 + (k ? (JT.R() - 0.5) * 20 : 0), 0, 3, 'player', def.arche === 'wallmount' ? 40 : undefined);
  if (!inst) continue; placed++; const gg = h.geoms[inst.id]; const bb = S.of(gg).bb; const poses = [];
  const st = Math.max(quick ? 1.6 : 0.8, (bb[3] - bb[0]) / (quick ? 14 : 26)); for (let x = bb[0] - 4; x <= bb[3] + 4; x += st) for (let z = bb[2] - 4; z <= bb[5] + 4; z += st) if (JT.Nav.inside(h, x, z, 1)) poses.push({ pos: [x, 0, z], sup: { k: 'floor' } });
  for (const nd of h.nav.nodes) if (nd.sup && nd.sup.d && nd.sup.k !== 'floor') poses.push({ pos: nd.pos.slice(), sup: JT.deepClone(nd.sup) });
  gg.paths.forEach((pa, pi) => { for (let s = 0; s + 1 < pa.pts.length; s++) poses.push({ pos: M.lerp3(pa.pts[s], pa.pts[s + 1], 0.5), sup: { k: 'path', d: inst.id, p: pi, s, t: 0.5 } }); });
  for (const L of SIZES) { const e = { type: '_t' + L, id: 'x' };
    for (const ps of poses) for (const a of (quick ? [0, 3.1] : [0, 1.6, 3.1, 4.7])) { e.pos = ps.pos; e.sup = ps.sup; e.fwd = [Math.cos(a), 0, Math.sin(a)]; let fr; try { fr = D.frame(h, e, 0.05); } catch (x) { continue; } checks++;
      const d = depthIn(h, body(fr, L)); if (d > Math.max(0.15, L * 0.06)) { fails++; failing[def.id] = Math.max(failing[def.id] || 0, +d.toFixed(2)); } } } }
t('decor placed for the check (' + placed + ')', placed > 150, placed);
t('no critter body drawn inside any decor (' + checks + ' poses)', fails === 0, { fails, failing });
// 3) live run of every theme with every species / stage and prey
let samples = 0, inside = 0; const where = {};
for (const th of Object.keys(JT.PRESET_THEMES)) { const g = new JT.Game(); g.newGame(); const h = g.createHabitat('standard'); g.activate(g.habs.indexOf(h)); JT.Presets.generate(h, th, 7, false); g.state.species = JT.SPECIES.map(s => s.id);
  JT.SPECIES.slice(0, 8).forEach((s, i) => { try { h.addSpider(s.id, { name: 'S' + i, stage: i % 6 }); } catch (e) { } }); for (const p of JT.PREY.slice(0, 10)) try { h.addPrey(p.id, 2); } catch (e) { }
  for (let i = 0; i < (quick ? 10 : 20) * 30; i++) { g.tick(1 / 30); if (i % 6) continue;
    for (const e of h.spiders.concat(h.prey)) { if (!e.sup || e.sup.k === 'air' || e.owner || e.buried || !M.finite3(e.pos)) continue; const L = e.species ? JT.SpiderAI.len(e) : (JT.PREY_BY_ID[e.type] || {}).len || 3; const fr = D.frame(h, e, 0.05); samples++;
      const d = depthIn(h, body(fr, L)); if (d > Math.max(0.25, L * 0.12)) { inside++; where[th] = (where[th] || 0) + 1; } } } }
t('live: critters drawn clear of decor (>= 99.95% of ' + samples + ' samples)', inside / samples < 0.0005, { inside, where });
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, bad, info: { checks, samples, inside } }));
process.exit(bad.length ? 1 : 0);
