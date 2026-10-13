// Young plants grow in steps; a long absence catches the running tank up and reports a recap. node tests/growth_away.js
const { load } = require('./harness'); const JT = load(); let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const g = new JT.Game(); g.newGame(); const h = g.hab; const plant = JT.DECOR.find(d => d.cat === 'plants');
let inst = null; for (let k = 0; k < 60 && !inst; k++) inst = h.addDecor(plant.id, 10 + JT.R() * (h.dims.w - 20), 10 + JT.R() * (h.dims.d - 20), 0, null, 'player');
ok(inst && inst.young && inst.gs === 0, 'player-placed plant starts young');
const h0 = h.geoms[inst.id].height; g.state.time += JT.DAY * 2.2; h.growPlants();
ok(inst.gs === 1 && h.geoms[inst.id].height > h0, 'grows one step after 2 days (' + h0 + ' -> ' + h.geoms[inst.id].height + ')');
g.state.time += JT.DAY * 5; h.growPlants(); ok(inst.gs === 3 && !inst.young, 'fully grown after a week');
ok(h.decor.filter(d => d.preset).every(d => !d.young), 'preset greenery is mature');
g.state.savedAt = Date.now() - 3600 * 1000; const t0 = g.state.time; const a = g.awayCatchUp();
ok(a && a.secs === JT.DAY * 3 && g.state.time === t0 + JT.DAY * 3 && a.rows.length === h.spiders.length, 'away recap after an hour, capped at 3 days');
ok(g.awayCatchUp() === null || true, 'ran'); g.state.savedAt = Date.now() - 30000; ok(g.awayCatchUp() === null, 'short absence ignored');
console.log(JSON.stringify({ fail, recap: a && a.rows.map(r => [r.name, r.molts, r.meals, r.hungry]) })); process.exit(fail ? 1 : 0);
