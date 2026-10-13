// v11 smart tanks: names, 30-tank cap, paused tanks + catch-up, moves, holding cup, duplicate, delete. node tests/tanks.js
const { load } = require('./harness');
const JT = load(process.argv[2]); const ok = []; const bad = [];
const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
const g = new JT.Game(); g.newGame(); const st = g.state; const a = g.hab;
t('named after its jumper', a.title === 'Pip', a.title);
const b = g.createHabitat('standard'); t('new tank is "Empty tank"', b.title === 'Empty tank', b.title);
st.species.push('zebra', 'bold');
const z = b.addSpider('zebra', { name: 'Zed', stage: 3 }); t('one jumper names the tank', b.title === 'Zed', b.title);
const y = b.addSpider('bold', { name: 'Yo', stage: 3 }); t('two jumpers: "Zed & Yo"', b.title === 'Zed & Yo', b.title);
const x = b.addSpider('bold', { name: 'Xi', stage: 3 }); t('three jumpers: "Zed, Yo & Xi"', b.title === 'Zed, Yo & Xi', b.title);
b.removeEntity(x, 'player');
// paused: an inactive tank does not change while the active one runs
const z0 = JSON.stringify([z.sat, z.hyd, z.ageDays, z.pos]); b.data.leftAt = st.time;
for (let i = 0; i < 30 * 60; i++) g.tick(1 / 30);
t('inactive tank paused', JSON.stringify([z.sat, z.hyd, z.ageDays, z.pos]) === z0, [z0, z.sat, z.ageDays]);
// catch-up on activate
const sat0 = z.sat, age0 = z.ageDays; const rep = g.activate(1);
t('activate switches', st.active === 1 && g.hab === b);
t('catch-up: hunger + age advanced', z.sat < sat0 && z.ageDays > age0 && rep && rep.secs > 50, [sat0, z.sat, age0, z.ageDays, rep && rep.secs]);
t('left tank stamped', a.data.leftAt === st.time);
// status projection
const s1 = g.tankStatus(a); t('status object', Array.isArray(s1.hungry) && typeof s1.score === 'number');
// move between tanks
let r = g.moveSpider(y, b, a); t('move ok', r.ok && a.spiders.includes(y) && !b.spiders.includes(y), r);
t('names follow the move', a.title === 'Pip & Yo' && b.title === 'Zed', [a.title, b.title]);
r = g.moveSpider(z, b, 'cup'); t('to holding cup', r.ok && st.cup.includes(z) && b.title === 'Empty tank', r);
r = g.moveSpider(z, 'cup', b); t('from holding cup', r.ok && !st.cup.length && b.spiders[0] === z && JT.M.finite3(z.pos), r);
const n = g.createHabitat('nano'); n.addSpider('peacock', { name: 'Nn', stage: 1 });
r = g.moveSpider(z, b, n); t('full tank refuses', !r.ok && /full/.test(r.reason), r);
z.state = 'molting'; r = g.moveSpider(z, b, 'cup'); t('molting refuses', !r.ok, r); z.state = 'idle';
// duplicate
for (const id of ['moss', 'rock']) void id; JT.Presets.generate(b, 'cork', 5, false); const nd = b.decor.length;
const d = g.duplicateHabitat(b); t('duplicate copies decor, no jumpers', d && d.decor.length > 0 && d.decor.length >= nd - 2 && d.spiders.length === 0 && d.data.substrate === b.data.substrate && d.data.type === b.data.type, [nd, d && d.decor.length]);
t('duplicate decor ids are new', d && d.decor.every(q => !b.decor.some(o => o.id === q.id)));
// delete
const before = g.habs.length; g.activate(g.habs.indexOf(b)); const ok1 = g.deleteHabitat(b);
t('delete tank', ok1 && g.habs.length === before - 1 && !g.habs.includes(b), [before, g.habs.length]);
t('its jumper waits in the cup', st.cup.includes(z), st.cup.map(q => q.name));
t('active index valid after delete', st.active >= 0 && st.active < g.habs.length && !!g.hab);
while (g.habs.length > 1) g.deleteHabitat(g.habs[g.habs.length - 1]);
t('last tank cannot be deleted', g.deleteHabitat(g.habs[0]) === false && g.habs.length === 1);
// cap 30
while (g.createHabitat('standard')); t('30 tank cap', g.habs.length === 30 && JT.MAX_HABS === 30, g.habs.length);
t('duplicate refuses at cap', g.duplicateHabitat(g.habs[0]) === null);
// change type overflow -> cup
const c = g.habs[1]; c.addSpider('zebra', { name: 'C1', stage: 2 }); c.addSpider('bold', { name: 'C2', stage: 2 }); const cupN = st.cup.length;
g.changeType(c, 'nano'); t('overflow waits in cup', c.spiders.length === 1 && st.cup.length === cupN + 1, [c.spiders.length, st.cup.length]);
// save/load roundtrip keeps cup + leftAt
g.save(); const g2 = new JT.Game(); t('load ok', g2.load() === true && g2.habs.length === 30 && g2.state.cup.length === st.cup.length, g2.state && g2.state.cup && g2.state.cup.length);
t('inactive tanks have a pause stamp after load', g2.habs.every((h, k) => k === g2.state.active || h.data.leftAt != null));
t('names used by cup jumpers are not reused', (() => { const used = new Set(st.cup.map(q => q.name)); for (let i = 0; i < 8; i++) { const s = g.habs[2].addSpider('peacock', { stage: 1 }); if (used.has(s.name)) return false; g.habs[2].removeEntity(s, 'player'); } return true; })());
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, bad }));
