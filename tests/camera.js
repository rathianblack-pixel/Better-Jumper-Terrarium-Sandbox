// Observe camera checks: never looks at a jumper's belly, low default height, size-aware zoom, cinematic zoom,
// smoothness (jerk) metrics. node tests/camera.js [index.html] -> JSON
const fs = require('fs'), vm = require('vm'), path = require('path');
function load(file) {
  const html = fs.readFileSync(file || path.join(__dirname, '..', 'index.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const ctx = { console, Math, Date, JSON, setTimeout, clearTimeout, performance: { now: () => Date.now() }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const b of blocks) { const cam = /Jumper Terrarium — smart follow/.test(b); try { vm.runInContext(b, ctx); } catch (e) { /* DOM-only block */ } if (cam) break; }
  return ctx.JT;
}
const JT = load(process.argv[2]); const M = JT.M, AI = JT.SpiderAI, Nav = JT.Nav;
const out = { belly: 0, bellyUnder: 0, frames: 0, underFrames: 0, plantFrames: 0, pitchFloor: [], jerkYaw: 0, jerkPitch: 0, jerkC: 0, jerkS: 0, zoomBySize: {}, cine: {} };
const S0 = 800 / 70;
function run(seed, theme, species, stage, secs, opts) {
  JT.reseed(seed); const h = new JT.Habitat({ type: 'standard' }); JT.Presets.generate(h, theme, seed); h._t = 0; h.event = () => {};
  const sp = h.addSpider(species, { stage, sat: opts && opts.sat != null ? opts.sat : 0.5 }); ['fruitfly', 'cricket', 'housefly', 'mealworm'].forEach(p => h.addPrey(p, 2));
  if (opts && opts.node) { const n = h.nav.nodes.find(opts.node); if (n) { sp.pos = n.pos.slice(); sp.sup = JT.deepClone(n.sup); } }
  const fc = new JT.FollowCam(); fc.reset({ yaw: 0.45, pitch: 0.5, s: S0, c: sp.pos.slice() }, sp.id);
  const dt = 1 / 30; let prev = null, prev2 = null; const log = [];
  for (let t = 0; t < secs; t += dt) {
    h._t += dt; h.update(dt, true); const st = fc.step(h, sp, dt, S0); if (!st) continue;
    const cur = { yaw: st.yaw, pitch: st.pitch, s: Math.log(st.s), c: st.c.slice() };
    if (prev && prev2 && t > 3) { const a = (k) => cur[k] - 2 * prev[k] + prev2[k]; out.jerkYaw += Math.abs(M.wrapAngle(cur.yaw - prev.yaw) - M.wrapAngle(prev.yaw - prev2.yaw)); out.jerkPitch += Math.abs(a('pitch')); out.jerkS += Math.abs(a('s'));
      out.jerkC += Math.hypot(cur.c[0] - 2 * prev.c[0] + prev2.c[0], cur.c[1] - 2 * prev.c[1] + prev2.c[1], cur.c[2] - 2 * prev.c[2] + prev2.c[2]) / Math.max(1, AI.len(sp)); }
    prev2 = prev; prev = cur;
    if (t > 4 && sp.sup && sp.sup.k !== 'air' && !sp._air && Nav.validSup(h, sp.sup)) { const n = Nav.supFrame(h, sp.sup).n; const tc = JT.FollowCam.toCam(st.yaw, st.pitch); const dd = M.dot(tc, n);
      out.frames++; const under = n[1] < -0.3; const onPlant = sp.sup.d && h.geoms[sp.sup.d] && h.geoms[sp.sup.d].def.cat === 'plants'; if (onPlant) out.plantFrames++;
      if (under) { out.underFrames++; if (dd < -0.35) { out.bellyUnder++; const key = fc.mode + '|' + sp.sup.k + '|p' + st.pitch.toFixed(1); (out.whyU = out.whyU || {})[key] = (out.whyU[key] || 0) + 1; } } else if (dd < -0.25 && !fc.paused) out.bellyHard = (out.bellyHard || 0) + 1; if (!under && dd < -0.05 && !fc.paused) { out.belly++; const tdd = M.dot(JT.FollowCam.toCam(fc.fYaw != null ? fc.fYaw : fc.tYaw, fc.fPitch != null ? fc.fPitch : fc.tPitch), n); const key = fc.mode + '|' + sp.sup.k + '|' + (Math.abs(n[1]) < 0.5 ? 'wall' : 'flat') + '|' + (tdd < -0.05 ? 'tgtBad' : 'lag'); (out.why = out.why || {})[key] = (out.why[key] || 0) + 1; }
      if (sp.sup.k === 'floor' && !AI.HUNT.has(sp.state) && fc.mode === 'norm' && Math.abs(st.vp) < 0.01) out.pitchFloor.push(st.pitch); }
    log.push([sp.state, st.s]);
  }
  return { sp, fc, h, log };
}
const themes = [...new Set(JT.PRESETS.map(p => p[1]))];
let k = 0; for (const th of themes) for (const [spc, stg] of [['peacock', 1], ['regal', 3], ['zebra', 5], ['giant', 5]]) { run(500 + k++, th, spc, stg, 70); }
// jumpers started on plants / leaf undersides
for (let i = 0; i < 12; i++) { run(700 + i, themes[i % themes.length], 'zebra', 4, 45, { node: (n) => n.sup && n.sup.k === 'path' && n.pos[1] > 10 && JT.Nav.validSup }); }
// size-aware zoom while resting on the floor
for (const [spc, stg] of [['peacock', 1], ['zebra', 5], ['regal', 5], ['giant', 5], ['orange', 5]]) {
  JT.reseed(9); const h = new JT.Habitat({ type: 'standard' }); h.event = () => {}; const sp = h.addSpider(spc, { stage: stg }); sp.pos = [60, 0, 40]; sp.sup = { k: 'floor' }; sp.state = 'rest';
  const fc = new JT.FollowCam(); fc.reset({ yaw: 0.45, pitch: 0.5, s: S0, c: sp.pos.slice() }, sp.id); let st; for (let i = 0; i < 300; i++) st = fc.step(h, sp, 1 / 30, S0);
  out.zoomBySize[spc + stg + ' L' + AI.len(sp).toFixed(1)] = +(st.s / S0).toFixed(2); }
// cinematic zoom through a hunt (states forced on a fixed jumper)
{ JT.reseed(11); const h = new JT.Habitat({ type: 'standard' }); h.event = () => {}; const sp = h.addSpider('regal', { stage: 3 }); sp.pos = [60, 0, 40]; sp.sup = { k: 'floor' }; const [c] = h.addPrey('cricket', 1); c.pos = [72, 0, 42]; c.sup = { k: 'floor' };
  const fc = new JT.FollowCam(); fc.reset({ yaw: 0.45, pitch: 0.5, s: S0, c: sp.pos.slice() }, sp.id); const seq = [['rest', 4], ['stalk', 5], ['crouch', 1], ['pounce', 0.15], ['subdue', 4], ['secure', 3], ['feed', 6]];
  for (const [s, d] of seq) { sp.state = s; if (s === 'stalk' || s === 'crouch' || s === 'pounce') sp.target = { kind: 'prey', id: c.id }; else sp.target = null; if (s === 'subdue') { sp.hold = null; } let st, mx = 0;
    for (let t = 0; t < d; t += 1 / 30) { if (s === 'subdue') sp._strug = 0.5 + 0.5 * Math.sin(t * 3); st = fc.step(h, sp, 1 / 30, S0); mx = Math.max(mx, st.s / S0); } out.cine[s] = +(st.s / S0).toFixed(2); } }
const pf = out.pitchFloor.sort((a, b) => a - b); out.pitchFloorMedianDeg = pf.length ? +(pf[pf.length >> 1] * 57.3).toFixed(1) : null; delete out.pitchFloor;
for (const k2 of ['jerkYaw', 'jerkPitch', 'jerkC', 'jerkS']) out[k2] = +out[k2].toFixed(2);
console.log(JSON.stringify(out));
