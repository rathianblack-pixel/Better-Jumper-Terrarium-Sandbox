// Hunting & aftermath checks: hunger size limit, fragile jumpers, camouflage, struggles and escapes, weakened prey,
// falling husks, moult delay, cleaner delay, fast pounce. node tests/hunting.js [index.html]
const { load } = require('./harness');
const JT = load(process.argv[2]); const M = JT.M, AI = JT.SpiderAI, PA = JT.PreyAI, Nav = JT.Nav;
const ok = [], bad = []; const INFO = {}; const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
function mk(seed, theme) { JT.reseed(seed); const h = new JT.Habitat({ type: 'standard' }); if (theme) JT.Presets.generate(h, theme, seed); h._t = 0; h.events = []; h.event = (ty, i) => h.events.push([h._t, ty, i]); return h; }
const step = (h, secs, mon) => { for (let s = 0; s < secs; s += 1 / 30) { h._t += 1 / 30; h.update(1 / 30, true); if (mon && mon(h) === true) return true; } return false; };

// 1) hunger raises the size limit; slings are capped
{ const h = mk(1); const sp = h.addSpider('regal', { stage: 3 }); sp.traits.bold = 0.5;
  const at = (s) => { sp.sat = s; return AI.sizeLimit(sp); };
  t('fed ~1x', Math.abs(at(0.8) - 1) < 0.01, at(0.8)); t('hungry ~1.4x', at(0.3) > 1.35 && at(0.3) < 1.6, at(0.3)); t('starving ~1.9x', at(0.05) > 1.85, at(0.05));
  sp.stage = 1; t('sling cap 1.5', at(0.05) <= 1.5, at(0.05)); sp.stage = 2; t('stage 2 cap 1.75', at(0.05) <= 1.75, at(0.05)); }

// 2) fragile jumpers (soft / molting) never pounce on prey bigger than themselves
{ let bigPounces = 0, trials = 0;
  for (let s = 0; s < 10; s++) { const h = mk(20 + s); const sp = h.addSpider('regal', { stage: 2, sat: 0.03 }); sp.pos = [30, 0, 30]; sp.sup = { k: 'floor' }; sp.soft = 1e6;
    const [c] = h.addPrey('cricket', 1); c.pos = [40, 0, 30]; c.sup = { k: 'floor' }; trials++;
    step(h, 25, () => { for (const e of h.events.splice(0)) if (e[1] === 'pounce' && sp.target && AI.ratioOf(sp, c) > 1) bigPounces++; }); }
  t('soft jumper never attacks big prey', bigPounces === 0, { bigPounces, trials }); }

// 3) big prey escapes sometimes; small prey never shakes a jumper off
{ const run = (prey, stage, n) => { let catches = 0, shaken = 0; for (let s = 0; s < n; s++) { const h = mk(200 + s); const sp = h.addSpider('regal', { stage, sat: 0.02 }); sp.traits.bold = 1; sp.pos = [30, 0, 30]; sp.sup = { k: 'floor' };
      const [c] = h.addPrey(prey, 1); c.pos = [38, 0, 31]; c.sup = { k: 'floor' };
      step(h, 40, () => { for (const e of h.events.splice(0)) { if (e[1] === 'catch') catches++; if (e[1] === 'shaken') shaken++; } return sp.state === 'secure' || sp.state === 'feed'; }); } return { catches, shaken }; };
  const small = run('fruitfly', 4, 12), big = run('cricket', 2, 24);
  INFO.small = small; INFO.big = big;
  t('small prey: no escapes', small.shaken === 0 && small.catches > 3, small);
  t('big prey: some escapes, some kept', big.shaken > 0 && big.catches > big.shaken, big); }

// 4) camouflage: a matching piece is detected; detection multiplier only when still on it
{ const h = mk(3); const id = 'birchlog'; const r = h.addDecor(id, 60, 40, 0, 1); const ok1 = !!r;
  const g = ok1 ? h.geoms[(r.id || r)] || h.geoms[h.data.decor[h.data.decor.length - 1].id] : null; const sp = h.addSpider('zebra', { stage: 3 });
  const inst = h.data.decor[h.data.decor.length - 1]; const g2 = h.geoms[inst.id]; const top = g2 && g2.tops[0];
  if (top) { sp.sup = { k: 'top', d: inst.id, i: 0 }; sp.pos = [g2.center[0], top.y, g2.center[2]]; sp._speedNow = 0; sp._blendAt = null; }
  t('birch log placed', ok1 && !!top, { ok1, tops: g2 && g2.tops.length });
  t('zebra blends on birch', !!AI.blendAt(h, 'zebra', sp.sup, sp.pos), sp.sup); t('peacock does not', !AI.blendAt(h, 'peacock', sp.sup, sp.pos));
  t('camoK 0.74 when still', AI.camoK(h, sp) < 0.8, AI.camoK(h, sp)); sp._speedNow = 3; sp.state = 'explore'; t('camoK 1 when moving', AI.camoK(h, sp) === 1);
  const h2 = mk(4); const s2 = h2.addSpider('zebra', {}); t('no blend pieces: null', AI.blendAt(h2, 'zebra', s2.sup, s2.pos) === null); }

// 5) weakened prey: slower, may be knocked on its back, recovers after ~120 s
{ const h = mk(5); const [d] = h.addPrey('dubia', 1); d.pos = [50, 0, 50]; d.sup = { k: 'floor' }; const oR = JT.R; JT.R = () => 0.1; PA.weaken(h, d, 1); JT.R = oR;
  t('heavy dose: twitch on back', d.state === 'twitch' && d._flip === 1, d.state); t('weakK high', PA.weakK(d) > 0.9, PA.weakK(d));
  for (let s = 0; s < 125 * 30; s++) PA.update(h, d, 1 / 30);
  t('recovered after 120 s', !d.weak && !d._flip && d.state !== 'twitch', { w: d.weak, st: d.state }); }

// 6) husks fall from branches / plants; floor & decor tops keep them; moults stay ~5 min
{ let tested = 0, fellOK = 0, keptTop = 0, tops = 0;
  for (let s = 0; s < 8; s++) { const h = mk(300 + s, ['woodland', 'jungle', 'desert', 'mossy'][s % 4]); const n = h.nav.nodes.find(n => n.sup && n.sup.k === 'path' && n.pos[1] > 6);
    if (n) { tested++; const r = h.addRemains('cricket', n.pos, n.sup, 'husk'); const b = Nav.supportBelow(h, [n.pos[0], n.pos[1] - 0.2, n.pos[2]]); if ((r.sup.k === 'floor' || r.sup.k === 'top') && r.pos[1] < n.pos[1] - 1 && Math.abs(r.pos[1] - b.pos[1]) < 0.5) fellOK++; }
    const tn = h.nav.nodes.find(n => n.sup && n.sup.k === 'top' && h.geoms[n.sup.d] && h.geoms[n.sup.d].def.cat === 'decor');
    if (tn) { tops++; const r = h.addRemains('cricket', tn.pos, tn.sup, 'husk'); if (r.sup.k === 'top' && r.sup.d === tn.sup.d && !r._fall) keptTop++; } }
  t('husks fall to support below', tested > 0 && fellOK === tested, { tested, fellOK }); t('decor tops keep husks', tops > 0 && keptTop === tops, { tops, keptTop });
  const h = mk(310, 'woodland'); const n = h.nav.nodes.find(n => n.sup && n.sup.k === 'path' && n.pos[1] > 6);
  if (n) { const ex = h.addRemains('exuvia', n.pos, n.sup, 'exuvia', { species: 'regal', len: 8 }); t('moult stays on its perch', ex.sup.k === 'path' && ex.dropAt === 300, ex.sup);
    for (let s = 0; s < 290 * 2; s++) h.updateRemains(0.5); t('still there at 290 s', ex.sup.k === 'path'); for (let s = 0; s < 30; s++) h.updateRemains(0.5); t('drops after 300 s', ex.sup.k !== 'path', ex.sup); } }

// 7) cleaners wait: not before 60-90 s, not beside a feeding / soft jumper
{ const h = mk(7); const r = h.addRemains('cricket', [40, 0, 40], { k: 'floor' }, 'husk'); r.age = 10; t('fresh remains not ready', !PA.remainsReady(h, r));
  r.age = 95; t('old remains ready', PA.remainsReady(h, r)); const sp = h.addSpider('regal', { stage: 3 }); sp.pos = [45, 0, 40]; sp.sup = { k: 'floor' }; sp.state = 'feed';
  t('not while a jumper feeds nearby', !PA.remainsReady(h, r)); sp.state = 'idle'; sp.soft = 50; t('not beside a soft jumper', !PA.remainsReady(h, r)); sp.soft = 0; sp.pos = [90, 0, 40]; t('far jumper ok', PA.remainsReady(h, r));
  const h2 = mk(8); const r2 = h2.addRemains('cricket', [40, 0, 40], { k: 'floor' }, 'husk'); h2.addPrey('springtail', 4); h2.data.prey.forEach(p => { p.pos = [42, 0, 41]; p.sup = { k: 'floor' }; });
  let firstClean = null; step(h2, 120, () => { if (firstClean == null && h2.data.prey.some(p => p._clean === r2.id)) firstClean = r2.age; });
  t('springtails come only after the delay', firstClean != null && firstClean >= 60, firstClean); }

// 8) pounce is explosive: ~0.08-0.16 s whatever the distance
t('pounce duration', AI.pounceDur(5) >= 0.075 && AI.pounceDur(40) <= 0.16 && AI.pounceDur(20) < 0.12, [AI.pounceDur(5), AI.pounceDur(20), AI.pounceDur(40)]);

console.log(JSON.stringify({ pass: ok.length, fail: bad.length, bad, info: INFO }));
if (bad.length) process.exitCode = 1;
