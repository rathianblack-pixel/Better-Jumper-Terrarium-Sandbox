// v15 uneven ground: shapes per substrate, flat pads under decor, glass edges, slopes, seeds, biome ground,
// mist pools, footprints, burrow marks, gentle behaviour hooks, and the house jumper still climbing walls. node tests/terrain.js
const { load } = require('./harness');
const JT = load(process.argv[2]); const T = JT.Terrain; const ok = []; const bad = [];
const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
JT.R = JT.makeRng(1515);
const g = new JT.Game(); g.newGame();
const slope = (ter) => { let w = 0; for (let j = 0; j < ter.nz; j++) for (let i = 0; i < ter.nx; i++) { const k = j * (ter.nx + 1) + i; w = Math.max(w, Math.abs(ter.H[k + 1] - ter.H[k]) / ter.sx, Math.abs(ter.H[k + ter.nx + 1] - ter.H[k]) / ter.sz); } return w; };
const finite = (ter) => ter.H.every(Number.isFinite) && ter.hol.every(Number.isFinite) && ter.cre.every(Number.isFinite);
// 1. every substrate x shape x tank builds, stays within 0..4, slopes capped, no NaN
let worst = 0, mx = 0, allFinite = true, n = 0, flatOk = true;
for (const type of Object.keys(JT.HABITATS)) { const h = g.createHabitat(type); JT.Presets.generate(h, 'cork', 5, false);
  for (const sub of Object.keys(JT.SUBSTRATES)) for (const sh of T.SHAPE_ORDER) { h.data.substrate = sub; h.data.terrain = { seed: 777, shape: sh }; const ter = T.get(h); n++;
    worst = Math.max(worst, slope(ter)); mx = Math.max(mx, ter.max); allFinite = allFinite && finite(ter); if (sh === 'flat' && ter.max !== 0) flatOk = false; }
  g.deleteHabitat(h); }
t('all ' + n + ' substrate/shape/tank combos build', n === Object.keys(JT.HABITATS).length * 16 * 4);
t('max height <= 4 units', mx <= 4.0001 && mx > 2, mx); t('slopes capped near 30 degrees', worst <= 0.5501, worst); t('no NaN', allFinite); t('Flat is exactly flat', flatOk);
// 2. pads, glass, back rise, per-substrate character
const h = g.createHabitat('standard'); JT.Presets.generate(h, 'cork', 6, false); h.data.substrate = 'coco'; h.data.terrain = { seed: 4242, shape: 'rugged' };
let ter = T.get(h); let padBad = 0, padN = 0;
for (const inst of h.data.decor) { const gg = h.geoms[inst.id]; const def = JT.DECOR_BY_ID[inst.type]; if (!gg || !gg.foot || inst.parent || T.noPad(def) || inst.type === 'heatlamp') continue; const c = JT.G.centroid(gg.foot); padN++; if (T.at(h, c[0], c[1]) > 0.01) padBad++; }
t('ground is flat under standing decor', padN > 0 && padBad === 0, { padN, padBad });
let edge = 0; for (let x = 0; x <= h.dims.w; x += 2) edge = Math.max(edge, T.at(h, x, 0.5)); for (let z = 0; z <= h.dims.d * 0.6; z += 2) edge = Math.max(edge, T.at(h, 0.5, z), T.at(h, h.dims.w - 0.5, z));
t('front and side glass edges stay low', edge < 0.25, edge);
const avg = (z0, z1) => { let s = 0, c = 0; for (let x = 12; x < h.dims.w - 12; x += 3) for (let z = z0; z < z1; z += 2) { s += T.at(h, x, z); c++; } return s / c; };
h.data.decor = []; h.rebuild(); ter = T.get(h); t('higher at the back than the front', avg(h.dims.d * 0.72, h.dims.d - 4) > avg(4, h.dims.d * 0.3) + 0.4, [avg(h.dims.d * 0.72, h.dims.d - 4), avg(4, h.dims.d * 0.3)]);
const maxOf = (sub, sh) => { h.data.substrate = sub; h.data.terrain = { seed: 99, shape: sh || 'rugged' }; return T.get(h).max; };
t('mud stays low (glossy flats)', maxOf('mud', 'rugged') <= 1.5 + 1.8 + 0.01, maxOf('mud'));
t('sphagnum taller than peat', maxOf('sphagnum') > maxOf('peat'), [maxOf('sphagnum'), maxOf('peat')]);
t('gentle lower than rugged', maxOf('desert', 'gentle') < maxOf('desert', 'rugged'), [maxOf('desert', 'gentle'), maxOf('desert', 'rugged')]);
// 3. seeds: differ per tank, persist through save/load, existing tanks Gentle, duplicate keeps the shape
const a1 = g.createHabitat('standard'), a2 = g.createHabitat('standard'); t('new tanks get different seeds', T.conf(a1).seed !== T.conf(a2).seed, [T.conf(a1).seed, T.conf(a2).seed]);
t('existing/new classic tanks default Gentle', T.conf(a1).shape === 'gentle' && T.conf(a1).auto);
a1.data.terrain.shape = 'rolling'; a1.data.terrain.seed = 31337; const dup = g.duplicateHabitat(a1); t('duplicate keeps ground shape + seed', dup && dup.data.terrain.shape === 'rolling' && dup.data.terrain.seed === 31337);
const saved = JSON.parse(g.serialize()); const sh = saved.habitats.find(x => x.id === a1.data.id); t('ground shape saved', sh && sh.terrain && sh.terrain.shape === 'rolling' && sh.terrain.seed === 31337, sh && sh.terrain);
t('only seed + shape saved (no mesh)', sh && Object.keys(sh.terrain).sort().join() === 'seed,shape', sh && Object.keys(sh.terrain));
const legacy = new JT.Habitat({ type: 'standard', substrate: 'moss' }); t('legacy tank without terrain loads as Gentle', T.conf(legacy).shape === 'gentle' && T.get(legacy).max > 0);
// 4. biome ground
const B = JT.Biome; const bd = new JT.Habitat({ type: 'standard' }); B.setBiome(bd, 'desert'); t('desert defaults to Rolling', T.conf(bd).shape === 'rolling', T.conf(bd).shape);
bd.data.terrain.shape = 'flat'; t('player choice overrides biome default', T.conf(bd).shape === 'flat');
const nm = new JT.Habitat({ type: 'standard' }); B.setBiome(nm, 'nightmoss'); t('nightmoss deep hummocks', T.conf(nm).style.kind === 'hummock' && T.conf(nm).style.max >= 3.5);
const pl = g.createHabitat('standard'); B.setBiome(pl, 'paludarium'); if (B.populate) try { B.populate(pl); } catch (e) { /* optional */ }
const isPond = (i) => i.type === 'pond' || i.type === 'lilypond'; let pond = pl.data.decor.find(isPond); if (!pond) { for (let k = 0; k < 20 && !pond; k++) { pl.addDecor('pond', 50 + k * 5, 45, 0, 1); pond = pl.data.decor.find(isPond); } }
if (pond) { const gp = pl.geoms[pond.id]; const c = JT.G.centroid(gp.foot); const r = Math.sqrt(Math.abs(JT.G.polyArea(gp.foot)) / Math.PI); pl.data.terrain = { seed: 5, shape: 'gentle' }; const at = (d) => { let s = 0; for (let a = 0; a < 6.28; a += 0.4) s += T.at(pl, c[0] + Math.cos(a) * (r + d), c[1] + Math.sin(a) * (r + d)); return s / 16; };
  t('paludarium: flat at the pond edge, a rim beyond', at(0.5) < 0.05 && at(6) > at(0.5) + 0.2, [at(0.5), at(6)]); } else t('paludarium pond found', false);
// 5. mist pools on wet substrates, drinkable, none on sand
const w = g.createHabitat('standard'); w.data.substrate = 'sphagnum'; w.data.terrain = { seed: 12, shape: 'rolling' }; w.data.drops = []; w.mist();
const pools = w.data.drops.filter(d => d.pool); t('mist pools collect in hollows on wet ground', pools.length >= 2, pools.length);
t('pools sit in hollows on the floor', pools.every(p => T.hollow(w, p.pos[0], p.pos[2]) > 0.3 && p.sup.k === 'floor' && JT.Nav.validSup(w, p.sup)), pools.map(p => T.hollow(w, p.pos[0], p.pos[2])));
const s2 = g.createHabitat('standard'); s2.data.substrate = 'desert'; s2.data.terrain = { seed: 12, shape: 'rolling' }; s2.data.drops = []; s2.mist(); t('no pools on sand', !s2.data.drops.some(d => d.pool));
{ const sp = w.addSpider('zebra', { name: 'Dr', stage: 4 }); sp.hyd = 0.3; let drank = false; const p0 = pools[0] && pools[0].life;
  for (let i = 0; i < 30 * 240 && !drank; i++) { w.update(1 / 30, true); if (sp.state === 'drink') drank = true; }
  t('a thirsty jumper drinks (pools or droplets)', drank, [sp.state, sp.hyd]); }
// 6. footprints + burrow marks (runtime only)
const d = g.createHabitat('standard'); d.data.substrate = 'desert'; d.data.terrain = { seed: 3, shape: 'gentle' }; const ds = d.addSpider('zebra', { name: 'Fp', stage: 4 });
for (let i = 0; i < 30 * 90; i++) d.update(1 / 30, true);
t('footprints recorded on sand', (d._prints || []).length > 3, (d._prints || []).length);
t('footprints not saved', !JSON.stringify(d.data).includes('_prints'));
const before = (d._prints || []).length; ds.sup = { k: 'decor', d: 'x' }; g.state.time += T.PRINT_LIFE + 5; T.track(d); t('footprints fade (~45 s)', (d._prints || []).length < before, [(d._prints || []).length, before]);
const m = g.createHabitat('standard'); m.data.substrate = 'moss'; m.addSpider('zebra', { name: 'Ms', stage: 4 }); for (let i = 0; i < 30 * 60; i++) m.update(1 / 30, true); t('no footprints on moss', !(m._prints || []).length);
const bu = g.createHabitat('standard'); bu.data.substrate = 'coco'; bu.addPrey ? null : null; const pid = 'mealworm'; let pr = null;
bu.addPrey(pid, 1); pr = bu.data.prey.find(q => q.type === pid); if (!pr) { bu.data.prey.push({ id: JT.newId('p'), type: pid, pos: [60, 0, 40], sup: { k: 'floor' }, state: 'idle', st: 0 }); pr = bu.data.prey[bu.data.prey.length - 1]; }
pr.buried = false; T.track(bu); pr.buried = true; T.track(bu); pr.buried = false; T.track(bu); t('burrow marks when prey dig in/out (soft ground)', (bu._marks || []).length === 2, (bu._marks || []).length);
t('no burrow marks on gravel', !T.BURROW('gravel') && !T.BURROW('lime') && T.BURROW('desert'));
// 7. behaviour hooks are soft
const v = g.createHabitat('standard'); v.data.substrate = 'redsand'; v.data.terrain = { seed: 8, shape: 'rugged' }; const tv = T.get(v);
let blk = 0, tot = 0; for (let k = 0; k < 400; k++) { const a = [10 + JT.R() * (v.dims.w - 20), 0.6, 10 + JT.R() * (v.dims.d - 20)], b = [10 + JT.R() * (v.dims.w - 20), 0.6, 10 + JT.R() * (v.dims.d - 20)]; tot++; if (T.blocks(v, a, b)) blk++; }
t('crests hide some floor-level lines of sight, not most', blk > 0 && blk / tot < 0.6, blk / tot);
t('nothing hidden when either end is up high', !T.blocks(v, [20, 10, 20], [150, 0, 70]));
t('flat ground never blocks', (() => { v.data.terrain.shape = 'flat'; const r = !T.blocks(v, [10, 0, 10], [190, 0, 80]); v.data.terrain.shape = 'rugged'; return r; })());
t('hollow/crest in 0..1', [...tv.hol, ...tv.cre].every(x => x >= 0 && x <= 1));
// 8. house jumper still climbs a back wall on rugged ground (simulation floor unchanged)
const hw = g.createHabitat('standard'); hw.data.substrate = 'sphagnum'; hw.data.terrain = { seed: 2, shape: 'rugged' }; const wl = hw.addDecor('mosswall', hw.dims.w / 2, hw.dims.d - 6, 0, 1);
const hj = hw.addSpider('hasarius', { name: 'Wally', stage: 4 }); let onWall = 0, high = 0;
for (let i = 0; i < 30 * 600; i++) { hw.update(1 / 30, true); if (hj.sup && hj.sup.k !== 'floor' && hj.sup.d && wl && hj.sup.d === (wl.id || wl)) onWall++; high = Math.max(high, hj.pos[1]); }
t('house jumper climbs the wall on rugged ground', onWall > 30 * 20 && high > 25, { onWall, high, wl: !!wl });
t('sim positions finite', JT.M.finite3(hj.pos));
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, bad }));
process.exitCode = bad.length ? 1 : 0;
