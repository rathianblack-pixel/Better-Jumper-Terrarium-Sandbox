// Species signature moves + new species + special unlocks. node tests/species.js [index.html]
const { load } = require('./harness');
const JT = load(process.argv[2]); const M = JT.M, AI = JT.SpiderAI;
const ok = [], bad = [], INFO = {}; const t = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
function mk(seed, theme) { JT.reseed(seed); const h = new JT.Habitat({ type: 'standard' }); JT.Presets.generate(h, theme || 'jungle', seed); h._t = 0; h.events = []; h.event = (ty, i) => h.events.push([h._t, ty, i]); return h; }
const step = (h, secs, mon) => { for (let s = 0; s < secs; s += 1 / 30) { h._t += 1 / 30; h.update(1 / 30, true); if (mon && mon(h) === true) return true; } return false; };
const jcount = (h, id) => h.events.filter(e => e[1] === 'journal' && e[2].id === id).length;
const states = (h, sp, secs) => { const c = {}; step(h, secs, () => { c[sp.state] = (c[sp.state] || 0) + 1; }); return c; };
t('new species present', !!JT.SPECIES_BY_ID.bagheera && !!JT.SPECIES_BY_ID.hasarius && JT.SPECIAL_UNLOCKS.join() === 'bagheera,hasarius,auralis,hyalina,ignicard,titanica,saltator', JT.SPECIAL_UNLOCKS);
t('chain unchanged (20)', JT.UNLOCK_ORDER.length === 20 && !JT.UNLOCK_ORDER.includes('bagheera'), JT.UNLOCK_ORDER.length);
t('looks set', JT.SPECIES_BY_ID.bagheera.look.gait === 'hop' && JT.SPECIES_BY_ID.hasarius.look.palp === 'flag');
// Portia detours
{ let det = 0, hunts = 0; for (let k = 0; k < 10; k++) { const h = mk(300 + k, k % 2 ? 'jungle' : 'cork'); const sp = h.addSpider('portia', { stage: 4, sat: 0.2 }); h.addPrey('cricket', 3); h.addPrey('fruitfly', 6);
    step(h, 90); det += jcount(h, 'portiaDetour'); hunts += h.events.filter(e => e[1] === 'catch').length; }
  INFO.portia = { det, hunts }; t('Portia plans detours', det >= 2 && hunts >= 5, INFO.portia); }
// Ant mimic marches; others back off
{ let march = 0, fooled = 0, marchT = 0; for (let k = 0; k < 6; k++) { const h = mk(400 + k); const a = h.addSpider('ant', { stage: 4, sat: 0.95 }); const o = h.addSpider('regal', { stage: 4, sat: 0.95 });
    const c = states(h, a, 240); marchT += c.antMarch || 0; march += jcount(h, 'antMarch'); fooled += jcount(h, 'antFooled'); }
  INFO.ant = { march, fooled, marchT }; t('ant mimic marches', march >= 3, INFO.ant); t('others fooled by the ant disguise', fooled >= 1, INFO.ant); }
// Giant power leaps
{ let leaps = 0; for (let k = 0; k < 6; k++) { const h = mk(500 + k, k % 2 ? 'canopy' : 'jungle'); h.addSpider('giant', { stage: 5, sat: 0.95 }); step(h, 240); leaps += jcount(h, 'giantLeap'); }
  INFO.giant = leaps; t('giant power leaps', leaps >= 2, leaps); t('giant jump reach boosted', AI.jump({ species: 'giant', stage: 5, traits: { jump: 0.8 }, soft: 0 }) > AI.jump({ species: 'regal', stage: 5, traits: { jump: 0.8 }, soft: 0 }) * 1.2); }
// Bagheera sips nectar, hunts only when hungry
{ let sips = 0, fullHunts = 0, sat0 = 0; for (let k = 0; k < 5; k++) { const h = mk(600 + k, 'flower'); const b = h.addSpider('bagheera', { stage: 3, sat: 0.55 }); h.addPrey('fruitfly', 6);
    step(h, 200, () => { for (const e of h.events.splice(0)) { if (e[1] === 'journal' && e[2].id === 'nectarSip') sips++; if (e[1] === 'pounce' && e[2].sp === b && b.sat > 0.4) fullHunts++; } }); sat0 += b.sat; }
  INFO.bagheera = { sips, fullHunts, sat: +(sat0 / 5).toFixed(2) }; t('Bagheera sips nectar', sips >= 4, INFO.bagheera); t('Bagheera skips prey when fed', fullHunts === 0, INFO.bagheera); }
// House jumper semaphore: to a finger and to other jumpers; loves walls
{ let sem = 0; for (let k = 0; k < 8; k++) { const h = mk(700 + k, 'mosswall'); const sp = h.addSpider('hasarius', { stage: 4, sat: 0.95 }); step(h, 3); sp._pc = { t: 4, ids: ['curious', 'bold'] };
    h.finger = { id: 1, pos: [M.clamp(sp.pos[0] + 12, 2, h.dims.w - 2), sp.pos[1], sp.pos[2]], t: h._t, held: false, fast: false }; step(h, 3); sem += jcount(h, 'semaphore') ? 1 : 0; }
  INFO.semFinger = sem; t('house jumper signals at your finger', sem >= 3, sem);
  let wallT = 0, tot = 0; for (let k = 0; k < 4; k++) { const h = mk(800 + k, 'stonewall'); const sp = h.addSpider('hasarius', { stage: 4, sat: 0.95 }); const r = h.addSpider('regal', { stage: 4, sat: 0.95 });
    step(h, 200, () => { tot++; const g = sp.sup && sp.sup.d && h.geoms[sp.sup.d]; if (g && (g.def.arche === 'backwall' || JT.DECOR_BY_ID[h.decorById(sp.sup.d).type].mount)) wallT++; }); }
  INFO.wall = +(wallT / tot).toFixed(2); t('house jumper spends time on walls', wallT / tot > 0.15, INFO.wall); }
// special unlocks
{ const g = new JT.Game(); g.newGame(); const st = g.state; t('bagheera locked', !g.isUnlocked('bagheera'));
  JT.JOURNAL.slice(0, 10).forEach(j => st.journal[j.id] = 1); g.checkUnlocks(true); t('bagheera unlocks at 10 behaviours', g.isUnlocked('bagheera'), st.species);
  t('hasarius locked', !g.isUnlocked('hasarius')); g.hab.spiders[0].tame = 0.75; g.checkUnlocks(true); t('hasarius unlocks when a jumper knows you', g.isUnlocked('hasarius'));
  const sp = g.hab.addSpider('hasarius', { stage: 1 }); t('diary starts on arrival', sp.diary && /Arrived/.test(sp.diary[0].t), sp.diary); }
console.log(JSON.stringify({ pass: ok.length, fail: bad.length, bad, info: INFO }));
