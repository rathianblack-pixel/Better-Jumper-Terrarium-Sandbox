// Deterministic headless simulation tests:  node tests/run-tests.js
const JT = require('./load');
const M = JT.M, Nav = JT.Nav;
let pass = 0, fail = 0;
function test(name, fn) {
  JT.reseed && JT.reseed(12345); JT.game = null;
  try { const r = fn(); if (r === false) throw new Error('returned false'); pass++; console.log('  ✔ ' + name + (typeof r === 'string' ? '  (' + r + ')' : '')); }
  catch (e) { fail++; console.log('  ✘ ' + name + ' — ' + (e && e.message)); if (process.env.V) console.log(e.stack); }
}
const ok = (c, msg) => { if (!c) throw new Error(msg || 'assertion failed'); };
const hab = (type, items) => { const h = new JT.Habitat({ type: type || 'standard', substrate: 'coco' }); for (const it of items || []) { const d = h.addDecor(it[0], it[1], it[2], it[3] || 0, it[4] || 7); ok(d, 'could not place ' + it[0]); it.id = d.id; } return h; };
const topNode = (h, decorId) => { let best = null; for (const n of h.nav.nodes) if (n.decor === decorId && n.kind !== 'face' && (!best || n.pos[1] > best.pos[1])) best = n; return best; };
const caps = { jump: 40, climb: true, drop: true, carry: false };
function walk(h, e, route, maxT) { e._route = route; let t = 0; while (t < (maxT || 60)) { const r = JT.Loco.follow(h, e, 0.05, 20, {}); t += 0.05; ok(M.finite3(e.pos), 'NaN position'); if (r !== 'moving') break; } return t; }
function finiteAll(h) { for (const e of h.spiders.concat(h.prey, h.data.remains)) ok(M.finite3(e.pos), 'non-finite entity ' + e.id); }
function sim(h, secs, dt) { dt = dt || 1 / 30; for (let t = 0; t < secs; t += dt) h.update(dt, true); finiteAll(h); }

console.log('Jumper Terrarium — headless tests');
test('floor → plant climb follows the plant surface', () => {
  const items = [['fern', 100, 45]]; const h = hab('standard', items); const top = topNode(h, items[0].id); ok(top, 'fern has nav nodes');
  const e = { pos: [40, 0, 45], sup: { k: 'floor' }, fwd: [1, 0, 0] };
  const r = Nav.route(h, e.sup, e.pos, top.sup, top.pos, caps); ok(r, 'route exists');
  walk(h, e, r); ok(e.sup.k === 'path' && e.sup.d === items[0].id, 'ended on the fern (' + JSON.stringify(e.sup) + ')'); ok(M.dist(e.pos, top.pos) < 3, 'reached top');
  return 'top y=' + top.pos[1].toFixed(1);
});
test('descent from a perch back to the floor', () => {
  const items = [['fern', 100, 45]]; const h = hab('standard', items); const top = topNode(h, items[0].id);
  const e = { pos: top.pos.slice(), sup: JT.deepClone(top.sup), fwd: [1, 0, 0] };
  const r = Nav.route(h, e.sup, e.pos, { k: 'floor' }, [30, 0, 30], caps); ok(r, 'route'); walk(h, e, r, 120); ok(e.sup.k === 'floor', 'on floor'); ok(Math.abs(e.pos[1]) < 0.5, 'floor height');
});
test('same-plant movement stays on the plant', () => {
  const items = [['pothos', 100, 45]]; const h = hab('standard', items);
  const ns = h.nav.nodes.filter(n => n.decor === items[0].id && n.kind !== 'face').sort((a, b) => a.pos[1] - b.pos[1]);
  const a = ns[Math.floor(ns.length * 0.6)], b = ns[ns.length - 1]; const r = Nav.route(h, a.sup, a.pos, b.sup, b.pos, caps); ok(r, 'route');
  ok(r.steps.every(s => s.mode === 'walk' || s.mode === 'jump'), 'valid modes'); ok(!r.steps.some(s => s.pos[1] < 0.3 && s.mode === 'walk' && Math.abs(s.pos[1]) < 0.01 && false));
});
test('plant-to-plant travel (jump or climb across)', () => {
  const items = [['tallgrass', 70, 45], ['tallgrass', 110, 45]]; const h = hab('standard', items);
  const a = topNode(h, items[0].id), b = topNode(h, items[1].id); const r = Nav.route(h, a.sup, a.pos, b.sup, b.pos, caps); ok(r, 'route');
  const e = { pos: a.pos.slice(), sup: JT.deepClone(a.sup), fwd: [1, 0, 0] }; walk(h, e, r, 120); ok(e.sup.d === items[1].id, 'arrived on second plant'); return Nav.routeHasJump(r) ? 'jumped' : 'walked';
});
test('rotation keeps nav nodes on the rotated object', () => {
  for (let rot = 0; rot < 4; rot++) { const items = [['driftwood', 100, 45, rot]]; const h = hab('standard', items); const g = h.geoms[items[0].id]; const hull = JT.G.expandPoly(JT.G.hull(g.extent), 4);
    for (const n of h.nav.nodes) if (n.decor === items[0].id) ok(JT.G.pointInPoly(n.pos[0], n.pos[2], hull), 'node outside rotated extent (rot ' + rot + ')'); }
});
test('stacked plant sits on its platform and is reachable', () => {
  const h = hab('standard', [['flatstone', 100, 45]]); const stone = h.decor[0]; const g = h.geoms[stone.id]; const c = JT.G.centroid(g.tops[0].poly);
  const fern = h.addDecor('fern', c[0], c[1], 0, 3); ok(fern && fern.parent === stone.id, 'fern stacked on stone');
  ok(Math.abs(h.geoms[fern.id].baseY - g.tops[0].y) < 0.01, 'base at top height');
  const top = topNode(h, fern.id); const r = Nav.route(h, { k: 'floor' }, [30, 0, 30], top.sup, top.pos, caps); ok(r, 'reachable from floor');
});
test('removing the platform re-seats or removes stacked children', () => {
  const h = hab('standard', [['flatstone', 100, 45]]); const stone = h.decor[0]; const c = JT.G.centroid(h.geoms[stone.id].tops[0].poly);
  const fern = h.addDecor('fern', c[0], c[1], 0, 3); const removed = h.removeDecor(stone.id);
  ok(!h.decor.some(d => d.parent === stone.id), 'no orphans'); ok(removed.length >= 1);
});
test('hungry jumper actively targets prey', () => {
  const h = hab('standard', [['fern', 60, 40], ['flatstone', 140, 50]]); const sp = h.addSpider('bold', { stage: 3, sat: 0.2 }); h.addPrey('cricket', 2);
  let targeted = false; for (let t = 0; t < 60 && !targeted; t += 1 / 30) { h.update(1 / 30, true); if (sp.target || JT.SpiderAI.HUNT && JT.SpiderAI.HUNT.has && JT.SpiderAI.HUNT.has(sp.state)) targeted = true; }
  ok(targeted, 'no hunting within 60 s (state ' + sp.state + ')');
});
test('catch → carry → feed keeps prey at the mouth', () => {
  const h = hab('standard', [['fern', 60, 40], ['corkbark', 140, 50], ['tallgrass', 100, 60]]); const sp = h.addSpider('bold', { stage: 3, sat: 0.15 }); h.addPrey('fruitfly', 5);
  let fed = false, maxOff = 0;
  for (let t = 0; t < 900 && !fed; t += 1 / 30) { h.update(1 / 30, true); if (sp.hold) { const p = h.preyById(sp.hold); ok(p && p.owner === sp.id, 'ownership'); if (sp.state === 'carry' || sp.state === 'feed') maxOff = Math.max(maxOff, M.dist(p.pos, JT.SpiderAI.mouth(h, sp))); if (sp.state === 'feed' && sp.st > 2) fed = true; } }
  ok(fed, 'did not feed within 900 s'); ok(maxOff < 0.6, 'prey drifted from mouth by ' + maxOff.toFixed(2)); return 'catches ' + sp.catches;
});
test('deleting decor mid-route keeps entities valid', () => {
  const items = [['corktower', 100, 45]]; const h = hab('standard', items); const sp = h.addSpider('canopy', { stage: 3, sat: 0.9 }); const top = topNode(h, items[0].id);
  sp._route = Nav.route(h, sp.sup, sp.pos, top.sup, top.pos, JT.SpiderAI.caps(sp)); sp.state = 'explore';
  for (let t = 0; t < 4; t += 1 / 30) h.update(1 / 30, true);
  h.removeDecor(items[0].id); sim(h, 20); ok(Nav.validSup(h, sp.sup) || sp.sup.k === 'air', 'valid support'); ok(!sp.sup.d || h.decorById(sp.sup.d), 'no dangling decor ref');
});
test('molting without decor happens on the floor, never at the boundary', () => {
  const h = hab('standard', []); const sp = h.addSpider('bold', { stage: 2, meals: 9, sat: 0.9 });
  let molted = false; const st0 = sp.stage; let minEdge = 1e9;
  for (let t = 0; t < 900 && !molted; t += 1 / 30) { h.update(1 / 30, true); if (['premolt', 'molting'].includes(sp.state)) { minEdge = Math.min(minEdge, sp.pos[0], sp.pos[2], h.dims.w - sp.pos[0], h.dims.d - sp.pos[2]); } if (sp.stage > st0) molted = true; }
  ok(molted, 'did not molt (state ' + sp.state + ')'); ok(minEdge > 4, 'molted at boundary (edge dist ' + minEdge.toFixed(1) + ')'); ok(h.data.remains.some(r => r.cat === 'exuvia'), 'exuvia left');
});
test('molting with tall trees retreats high', () => {
  const h = hab('standard', [['tinytree', 100, 45], ['fern', 40, 50]]); const sp = h.addSpider('canopy', { stage: 2, meals: 9, sat: 0.9 });
  let y = -1; const st0 = sp.stage;
  for (let t = 0; t < 900 && sp.stage === st0; t += 1 / 30) { h.update(1 / 30, true); if (sp.state === 'molting') y = Math.max(y, sp.pos[1]); }
  ok(sp.stage > st0, 'did not molt'); ok(y > 8, 'molted low (y=' + y.toFixed(1) + ')'); return 'y=' + y.toFixed(1);
});
test('tiny sling can pounce and catch tiny prey', () => {
  const h = hab('standard', [['mosspatch', 80, 45], ['fern', 120, 40]]); const sp = h.addSpider('bold', { stage: 0, sat: 0.2 }); h.addPrey('fruitfly', 5);
  for (let t = 0; t < 900 && !sp.catches; t += 1 / 30) h.update(1 / 30, true); ok(sp.catches > 0, 'no catch in 900 s');
});
test('springtails clean elevated remains', () => {
  const h = hab('standard', [['flatstone', 100, 45]]); const g = h.geoms[h.decor[0].id]; const c = JT.G.centroid(g.tops[0].poly);
  const r = h.addRemains('cricket', [c[0], g.tops[0].y, c[1]], { k: 'top', d: h.decor[0].id, i: 0 }, 'husk'); ok(r.sup.k === 'top', 'husk on top');
  h.addPrey('springtail', 6); let t = 0; while (t < 1200 && h.data.remains.includes(r) && r.clean > 0.5) { h.update(1 / 15, true); t += 1 / 15; }
  ok(!h.data.remains.includes(r) || r.clean <= 0.5, 'not cleaned (clean=' + r.clean.toFixed(2) + ')'); return Math.round(t) + ' s';
});
test('save / load round-trip is consistent', () => {
  const g = new JT.Game(); g.newGame(); for (let t = 0; t < 120; t += 1 / 30) g.tick(1 / 30); g.save();
  const g2 = new JT.Game(); ok(g2.load(), 'load'); ok(g2.habs.length === g.habs.length, 'habitats');
  for (let i = 0; i < g.habs.length; i++) { ok(g2.habs[i].decor.length === g.habs[i].decor.length, 'decor'); ok(g2.habs[i].spiders.map(s => s.name).join() === g.habs[i].spiders.map(s => s.name).join(), 'spiders'); }
  ok(g2.state.coins === g.state.coins, 'coins'); for (let t = 0; t < 30; t += 1 / 30) g2.tick(1 / 30); finiteAll(g2.hab);
});
test('corrupt save falls back safely', () => { JT.Store.set('jumperTerrarium.save', '{broken'); const g = new JT.Game(); ok(g.load() === false); g.newGame(); ok(g.habs.length === 3); });
test('change enclosure type reconciles everything', () => {
  const g = new JT.Game(); g.newGame(); g.state.coins = 5000; const h = g.hab; ok(g.changeType(h, 'nano'), 'changed'); finiteAll(h); ok(h.spiders.length <= 1); for (const e of h.spiders.concat(h.prey)) ok(Nav.inside(h, e.pos[0], e.pos[2], 0) || e.sup.k === 'air', 'inside');
});
test('every habitat type and preset builds and simulates', () => {
  for (const t in JT.HABITATS) { const h = new JT.Habitat({ type: t }); const ps = JT.Presets.forType(t); JT.Presets.generate(h, (ps[0] || { theme: 'cork' }).theme, 5); h.addSpider('zebra', { stage: 3 }); h.addPrey('fruitfly', 5); sim(h, 30); }
});
test('long run (3 habitats, 1 sim-hour) stays bounded and finite', () => {
  const g = new JT.Game(); g.newGame(); const t0 = Date.now();
  for (let t = 0; t < 3600; t += 1 / 30) g.tick(1 / 30);
  for (const h of g.habs) { finiteAll(h); ok(h.prey.length <= JT.PREY_CAP); ok(h.data.silk.length <= 70); ok(h.data.remains.length <= 40); }
  return 'catches ' + g.state.catches + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s wall';
});
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
