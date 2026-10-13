// node tests/strike_probe.js [build.html] -> how mantises strike: body travel per strike, drops, cancelled strikes, catches
// Every species, 3 tanks each (its home biome layout), 8 sim-minutes with prey.
const path = require('path'); const { load } = require('./legacy/harness');
const JT = load(process.argv[2] || path.join(__dirname, '..', 'dist/mantis-terrarium/index.html')); const M = JT.M, AI = JT.SpiderAI;
const SP = JT.SPECIES.map(s => s.id); const out = { strikes: 0, catches: 0, travel: [], drop: [], launchD: [], offPerch: 0, leapsOverBody: 0, cancelled: 0, perSpecies: {} };
const g = new JT.Game(); g.newGame();
for (const s of SP) for (let rep = 0; rep < 2; rep++) {
  const hb = g.createHabitat('standard'); JT.Biome.layout(hb, JT.Biomes.homeOf(s), 11 + rep); hb.spiders.length = 0; const sp = hb.addSpider(s, { stage: 5 }); sp.sat = 0.15;
  for (let k = 0; k < 8; k++) hb.addPrey(k % 2 ? 'housefly' : 'cricket'); g.hab = hb; g.state.active = g.habs.indexOf(hb);
  let prev = null, from = null, sup0 = null; const ps = out.perSpecies[s] || (out.perSpecies[s] = { strikes: 0, catches: 0, maxTravelL: 0 }); const L = AI.len(sp); let n0 = sp.meals || 0;
  for (let i = 0; i < 60 * 300; i++) {
    g.tick(1 / 60); if (sp.sat > 0.5) sp.sat = 0.15;
    if (sp.state === 'pounce' && prev !== 'pounce') { from = sp._air ? sp._air.from.slice() : sp.pos.slice(); sup0 = sp._mSup; out.strikes++; ps.strikes++; if (sp._air) out.launchD.push(+(M.dist(sp._air.from, sp._air.to) / L).toFixed(2)); }
    if (prev === 'pounce' && sp.state !== 'pounce' && from) { const tr = M.dist(from, sp.pos) / L; out.travel.push(+tr.toFixed(2)); out.drop.push(+((from[1] - sp.pos[1]) / L).toFixed(2)); ps.maxTravelL = Math.max(ps.maxTravelL, +tr.toFixed(2)); if (tr > 1) out.leapsOverBody++;
      if (sup0 && sp.sup && sup0.k === 'path' && (sp.sup.k !== 'path' || sp.sup.d !== sup0.d)) out.offPerch++; from = null; }
    prev = sp.state;
  }
  const c = (sp.meals || 0) - n0; out.catches += c; ps.catches += c; out.cancelled += sp._mNoLeap || 0;
  g.habs.splice(g.habs.indexOf(hb), 1);
}
const q = (a, f) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * f))]; };
console.log(JSON.stringify({ strikes: out.strikes, catches: out.catches, cancelled: out.cancelled, leapsOverBody: out.leapsOverBody, offPerch: out.offPerch,
  travelL: { med: q(out.travel, 0.5), p90: q(out.travel, 0.9), max: q(out.travel, 1) }, dropL: { p90: q(out.drop, 0.9), max: q(out.drop, 1) }, launchL: { med: q(out.launchD, 0.5), p90: q(out.launchD, 0.9), max: q(out.launchD, 1) }, perSpecies: out.perSpecies }));
