// Thick ground cover holds critters up: no floor critter ends up inside moss / pebbles. node tests/groundcover.js
const { load } = require('./harness'); const JT = load(); let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
JT.reseed(7); const hab = new JT.Habitat({ type: 'standard', substrate: 'coco' }); hab._t = 0; hab.event = () => { };
for (const id of ['pebbles', 'sphagnum', 'cushionmoss', 'pinecones', 'twigs', 'clover']) hab.addDecor(id, 20 + JT.R() * (hab.dims.w - 40), 20 + JT.R() * (hab.dims.d - 40), 0, null, false);
const B = hab._bumps; ok(B.length > 20, 'bumps built: ' + B.length);
const peb = B.find(b => b.x2 === undefined && b.h > 1); ok(peb && Math.abs(hab.groundY(peb.x, peb.z) - peb.h) < 1.2, 'ground is raised at a bump'); ok(hab.groundY(-500, -500) === 0, 'bare floor stays 0');
hab.addSpider('bold', { stage: 3 }); for (const t of ['fruitfly', 'springtail', 'dubia', 'isopod', 'cricket']) hab.addPrey(t, 4);
let samples = 0, inside = 0, lifted = 0, worst = 0;
for (let i = 0; i < 30 * 90; i++) { hab._t += 1 / 30; hab.update(1 / 30, true);
  for (const e of hab.data.spiders.concat(hab.data.prey)) { if (!e.sup || e.sup.k !== 'floor' || e.owner || e._air) continue; samples++; const gy = hab.groundY(e.pos[0], e.pos[2]); if (gy > 0.3) lifted++; if (e.pos[1] < gy - 0.05) { inside++; worst = Math.max(worst, gy - e.pos[1]); } } }
ok(lifted > 0, 'some critters crossed thick cover'); ok(inside === 0, inside + ' samples inside the ground (worst ' + worst.toFixed(2) + ')');
console.log(JSON.stringify({ fail, samples, lifted, inside })); process.exit(fail ? 1 : 0);
