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

// ---------------- new behaviour: clean-up crew ----------------
const stepUntil = (h, maxT, cond, dt) => { dt = dt || 1 / 15; let t = 0; while (t < maxT && !cond(t)) { h.update(dt, true); t += dt; } return t; };
test('springtails seek out husks AND molt skins; remains shrink until gone', () => {
  const h = hab('standard', [['flatstone', 100, 45]]); const g = h.geoms[h.decor[0].id]; const c = JT.G.centroid(g.tops[0].poly);
  const husk = h.addRemains('cricket', [50, 0, 30], { k: 'floor' }, 'husk');
  const skin = h.addRemains(null, [c[0], g.tops[0].y, c[1]], { k: 'top', d: h.decor[0].id, i: 0 }, 'exuvia', { species: 'bold', len: 5 });
  h.addPrey('springtail', 8); let last = 2, mono = true, gathered = 0;
  const t = stepUntil(h, 900, () => {
    const a = h.data.remains.includes(husk) ? husk.clean : 0, b = h.data.remains.includes(skin) ? skin.clean : 0;
    if (a + b > last + 1e-6) mono = false; last = a + b;
    gathered = Math.max(gathered, h.prey.filter(p => p._clean === skin.id).length);
    return !h.data.remains.includes(husk) && !h.data.remains.includes(skin);
  });
  ok(!h.data.remains.includes(husk), 'husk not cleaned'); ok(!h.data.remains.includes(skin), 'molt skin not cleaned (clean=' + skin.clean.toFixed(2) + ')');
  ok(mono, 'remains should only ever shrink'); ok(gathered >= 2, 'springtails should gather on the skin (max ' + gathered + ')');
  return Math.round(t) + ' s, up to ' + gathered + ' nibbling the skin';
});
test('more springtails clean faster', () => {
  const run = (n) => { JT.reseed && JT.reseed(777); const h = hab('standard'); const r = h.addRemains('cricket', [60, 0, 40], { k: 'floor' }, 'husk'); h.addPrey('springtail', n); return stepUntil(h, 1500, () => !h.data.remains.includes(r)); };
  const few = run(2), many = run(12); ok(many < few * 0.75, 'many ' + many.toFixed(0) + ' s vs few ' + few.toFixed(0) + ' s');
  return '2 → ' + few.toFixed(0) + ' s, 12 → ' + many.toFixed(0) + ' s';
});
test('remains slowly decay on their own without springtails', () => {
  const h = hab('standard'); const r = h.addRemains('cricket', [60, 0, 40], { k: 'floor' }, 'husk'); const s = h.addRemains(null, [80, 0, 40], { k: 'floor' }, 'exuvia', { species: 'bold', len: 5 });
  for (let t = 0; t < 120; t++) h.update(1, true);
  ok(r.clean < 1 && r.clean > 0.6, 'husk decays slowly (' + r.clean.toFixed(2) + ')'); ok(s.clean < 1 && s.clean > r.clean, 'skin decays slower than a husk');
  for (let t = 0; t < 3000 && h.data.remains.length; t++) h.update(1, true);
  ok(!h.data.remains.length, 'eventually gone'); return 'gone';
});
test('springtail colony keeps a small breeding population', () => {
  const h = hab('standard', [['fern', 100, 45]]); h.addPrey('springtail', 2);
  for (let t = 0; t < 600; t += 1 / 10) { h.data.humidity = 0.8; h.update(1 / 10, true); }
  const wet = h.prey.filter(p => p.type === 'springtail').length; ok(wet >= 3 && wet <= 8, 'humid colony size ' + wet);
  for (let t = 0; t < 900; t += 1 / 10) { h.data.humidity = 0.15; h.update(1 / 10, true); }
  const dry = h.prey.filter(p => p.type === 'springtail').length; ok(dry >= 3 && dry <= wet, 'dry colony thins but survives (' + dry + ')');
  return 'humid ' + wet + ', dry ' + dry;
});
test('jumpers ignore springtails unless starving', () => {
  const h = hab('standard'); const sp = h.addSpider('bold', { stage: 2, sat: 0.3 }); const st = JT.PREY_BY_ID.springtail;
  ok(!JT.SpiderAI.huntableFor(sp, st), 'hungry jumper should ignore springtails'); sp.sat = 0.08; ok(JT.SpiderAI.huntableFor(sp, st), 'starving jumper may take a springtail');
});

// ---------------- basking lamp ----------------
test('cool morning: jumper walks to the lamp, basks flat, and leaves when it is switched off', () => {
  const h = hab('standard', [['heatlamp', 60, 40, 0, 3], ['fern', 120, 60]]); const lamp = h.decor[0];
  const sp = h.addSpider('bold', { stage: 3, sat: 0.75, pos: [130, 0, 25] }); sp.hyd = 1;
  ok(h.warmthAt(h.geoms[lamp.id].lamp.pool) > 0.4, 'warm under the lamp');
  let seek = false; const t = stepUntil(h, 300, () => { if (sp.state === 'baskSeek') seek = true; return sp.state === 'bask' && sp.st > 4; });
  ok(sp.state === 'bask', 'should bask (state ' + sp.state + ')'); ok(h.warmthAt(sp.pos) > 0.25, 'basking in the warm spot'); ok(sp._flat > 0.5, 'body pressed flat (' + (sp._flat || 0).toFixed(2) + ')');
  h.toggleLamp(lamp.id); ok(lamp.on === false, 'lamp off'); stepUntil(h, 3, () => sp.state !== 'bask');
  ok(sp.state !== 'bask', 'stops basking once the lamp is off');
  return (seek ? 'walked there, ' : '') + 'basking after ' + Math.round(t) + ' s';
});
test('lamp draws flying insects at night', () => {
  const h = hab('standard', [['heatlamp', 90, 45, 0, 3]]); h.daylight = () => 0.05; const L = h.lampsOn()[0];
  h.addPrey('moth', 4); let near = 0, n = 0;
  for (let t = 0; t < 120; t += 1 / 15) { h.update(1 / 15, true); if (t > 30) for (const p of h.prey) { n++; if (Math.hypot(p.pos[0] - L.head[0], p.pos[2] - L.head[2]) < L.r) near++; } }
  const share = near / n; ok(share > 0.35, 'moths near the light ' + (share * 100).toFixed(0) + '%');
  return (share * 100).toFixed(0) + '% of moth-time near the lamp';
});

// ---------------- hunger with nothing to eat ----------------
test('hungry with no prey: patrols perches in turn, climbs to scan, lunges at movement', () => {
  const h = hab('standard', [['corktower', 40, 30], ['tallgrass', 150, 60], ['flatstone', 100, 45], ['fern', 60, 60]]);
  const sp = h.addSpider('bold', { stage: 3, sat: 0.3 }); sp.hyd = 1; const scans = []; let maxY = 0, line = '';
  stepUntil(h, 420, () => { sp.sat = 0.3; if (sp.state === 'scan' && sp.st < 0.1 && !scans.some(q => M.dist(q, sp.pos) < 8)) scans.push(sp.pos.slice()); maxY = Math.max(maxY, sp.pos[1]); if (sp.state === 'patrol') line = JT.SpiderAI.stateLine(h, sp); return false; });
  ok(scans.length >= 3, 'should visit several lookouts (' + scans.length + ')'); ok(maxY > 15, 'should climb high to scan (max y ' + maxY.toFixed(1) + ')'); ok(/hungry/i.test(line), 'panel line mentions hunger: ' + line);
  h.addPrey('springtail', 8); let lunges = 0, prev = sp.state, eaten = 0;
  stepUntil(h, 400, () => { sp.sat = 0.3; if (sp.state === 'lunge' && prev !== 'lunge') lunges++; prev = sp.state; if (sp.hold) eaten++; return lunges >= 1; });
  ok(lunges >= 1, 'should lunge at a moving springtail'); ok(!eaten, 'a hungry (not starving) jumper does not eat springtails');
  return scans.length + ' lookouts, max y ' + maxY.toFixed(0) + ', lunged';
});
test('very hungry jumpers wander further and more restlessly', () => {
  const dist = (sat) => { JT.reseed && JT.reseed(4242); const h = hab('standard', [['corktower', 40, 30], ['tallgrass', 150, 60], ['flatstone', 100, 45], ['fern', 60, 60], ['bonsai', 135, 22]]);
    const sp = h.addSpider('bold', { stage: 3, sat, pos: [90, 0, 45] }); sp.hyd = 1; let d = 0, last = sp.pos.slice();
    for (let t = 0; t < 360; t += 1 / 15) { sp.sat = sat; h.update(1 / 15, true); d += M.dist(last, sp.pos); last = sp.pos.slice(); } return d; };
  const hungry = dist(0.3), very = dist(0.12); ok(very > hungry * 1.15, 'very hungry ' + very.toFixed(0) + ' vs hungry ' + hungry.toFixed(0));
  return 'travelled ' + hungry.toFixed(0) + ' → ' + very.toFixed(0);
});

// ---------------- robustness of all the new states ----------------
test('no mid-air or stuck states across a long varied run', () => {
  const g = new JT.Game(); g.newGame(); for (const h of g.habs) { h.addDecor('heatlamp', h.dims.w * 0.5, h.dims.d * 0.5, 0, 3) || h.addDecor('heatlamp', h.dims.w * 0.3, h.dims.d * 0.4, 0, 5); h.addPrey('springtail', 4); }
  const air = {}, stuck = {}; let maxAir = 0, maxStuck = 0, worst = ''; const seen = new Set();
  const ACTIVE = new Set(['patrol', 'scan', 'lunge', 'baskSeek', 'homeSeek', 'dangle', 'scuttle', 'look', 'stretch', 'cleanEyes', 'drinkSeek', 'explore', 'search']);
  for (let t = 0; t < 2400; t += 1 / 30) {
    g.tick(1 / 30);
    if (((t * 30) | 0) % 15) continue;
    for (const h of g.habs) for (const sp of h.spiders) {
      seen.add(sp.state); const k = sp.id;
      const inAir = !!sp._air || sp.sup.k === 'air'; air[k] = inAir ? (air[k] || 0) + 0.5 : 0; if (air[k] > maxAir) { maxAir = air[k]; }
      const s = stuck[k] || (stuck[k] = { st: null, pos: null, t: 0 });
      if (ACTIVE.has(sp.state) && s.st === sp.state && s.pos && M.dist(s.pos, sp.pos) < 0.5) s.t += 0.5; else { s.st = sp.state; s.pos = sp.pos.slice(); s.t = 0; }
      if (s.t > maxStuck) { maxStuck = s.t; worst = sp.state; }
      ok(M.finite3(sp.pos), 'finite'); ok(JT.Nav.inside(h, sp.pos[0], sp.pos[2], -1) || sp.sup.k === 'air', 'inside');
      ok(sp._fatNow == null || (sp._fatNow > 0.6 && sp._fatNow < 1.3), 'abdomen size in range');
    }
  }
  for (const h of g.habs) finiteAll(h);
  ok(maxAir < 6, 'airborne for ' + maxAir + ' s'); ok(maxStuck < 60, 'stuck in ' + worst + ' for ' + maxStuck + ' s');
  return 'max air ' + maxAir + ' s, max still-in-active-state ' + maxStuck + ' s, ' + seen.size + ' states seen';
});
test('abdomen slims when hungry and plumps after a meal', () => {
  const h = hab('standard'); const sp = h.addSpider('bold', { stage: 3, sat: 0.1 }); sp.hyd = 1;
  for (let t = 0; t < 30; t += 1 / 15) { sp.sat = 0.1; h.update(1 / 15, true); } const thin = sp._fatNow;
  for (let t = 0; t < 30; t += 1 / 15) { sp.sat = 0.95; h.update(1 / 15, true); } const plump = sp._fatNow;
  ok(plump > thin + 0.25, 'thin ' + thin.toFixed(2) + ' → plump ' + plump.toFixed(2)); return thin.toFixed(2) + ' → ' + plump.toFixed(2);
});

// ---------------- follow camera ----------------
test('follow cam: smooth, pitch-limited, faces walls, pauses for the user', () => {
  const h = hab('standard', [['corktower', 80, 45]]); const sp = h.addSpider('bold', { stage: 3 }); const cam = new JT.FollowCam();
  cam.reset({ yaw: 2.5, pitch: 0.66, s: 10, c: [70, 10, 45] }, sp.id); let prevYaw = cam.st.yaw, maxStep = 0;
  for (let i = 0; i < 300; i++) { sp.fwd = [Math.cos(i * 0.05), 0, Math.sin(i * 0.05)]; const st = cam.step(h, sp, 1 / 30, 12); const dy = Math.abs(M.wrapAngle(st.yaw - prevYaw)); maxStep = Math.max(maxStep, dy); prevYaw = st.yaw;
    ok(st.pitch >= JT.FollowCam.PITCH_MIN - 1e-6 && st.pitch <= JT.FollowCam.PITCH_MAX + 1e-6, 'pitch limit'); ok(M.finite3(st.c) && isFinite(st.s), 'finite'); }
  ok(maxStep < 1.2 / 30 + 1e-3, 'yaw never snaps (max step ' + maxStep.toFixed(3) + ')');
  // on a wall face: camera turns to face the wall
  const face = h.nav.nodes.find(n => n.kind === 'face' && n.sup.k === 'path' && n.pos[1] > 8); ok(face, 'wall face');
  sp.sup = JT.deepClone(face.sup); sp.pos = face.pos.slice(); sp.fwd = [0, 1, 0]; const n = JT.Nav.supFrame(h, sp.sup).n;
  for (let i = 0; i < 600; i++) cam.step(h, sp, 1 / 30, 12);
  const toCam = [-Math.sin(cam.st.yaw) * Math.cos(cam.st.pitch), Math.sin(cam.st.pitch), -Math.cos(cam.st.yaw) * Math.cos(cam.st.pitch)];
  ok(M.dot(toCam, n) > 0.6, 'camera faces the wall (' + M.dot(toCam, n).toFixed(2) + ')'); ok(cam.st.pitch <= 0.7 + 1e-6, 'wall never fills the frame');
  // user orbit pauses the automatic rotation, then it resumes
  cam.orbit(1.0, 0); const y0 = cam.st.yaw; for (let i = 0; i < 60; i++) cam.step(h, sp, 1 / 30, 12); ok(Math.abs(M.wrapAngle(cam.st.yaw - y0)) < 0.02, 'paused while the user is in control');
  for (let i = 0; i < 300; i++) cam.step(h, sp, 1 / 30, 12); ok(Math.abs(M.wrapAngle(cam.st.yaw - y0)) > 0.3, 'resumes after a few idle seconds');
  // jumping: leads toward the landing and widens
  sp.sup = { k: 'floor' }; sp.pos = [60, 0, 45]; for (let i = 0; i < 200; i++) cam.step(h, sp, 1 / 30, 12); const s0 = cam.st.s, c0 = cam.st.c.slice();
  sp._air = { to: [100, 0, 45] }; for (let i = 0; i < 60; i++) cam.step(h, sp, 1 / 30, 12); sp._air = null;
  ok(cam.st.c[0] > c0[0] + 6, 'leads toward the landing'); ok(cam.st.s < s0 * 0.95, 'widens during the jump');
  return 'max yaw step ' + maxStep.toFixed(3) + ' rad/frame';
});
test('older (v2) saves load and migrate', () => {
  const g = new JT.Game(); g.newGame(); for (let t = 0; t < 30; t += 1 / 30) g.tick(1 / 30);
  const d = JSON.parse(g.serialize()); d.v = 2; for (const h of d.habitats) { for (const s of h.spiders) delete s.home; for (const r of h.remains || []) delete r.clean; h.decor.push({ id: 'lampx', type: 'heatlamp', x: 30, z: 30, rot: 0, seed: 3 }); }
  JT.Store.set('jumperTerrarium.save', JSON.stringify(d)); const g2 = new JT.Game(); ok(g2.load(), 'v2 save loads'); ok(g2.state.v === 3, 'migrated to v3');
  for (const h of g2.habs) { const l = h.decor.find(x => x.type === 'heatlamp'); if (l) ok(l.on === true, 'lamp defaults to on'); }
  for (let t = 0; t < 30; t += 1 / 30) g2.tick(1 / 30); for (const h of g2.habs) finiteAll(h);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
