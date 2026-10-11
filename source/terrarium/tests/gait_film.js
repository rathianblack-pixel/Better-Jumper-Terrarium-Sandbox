// node tests/gait_film.js <dist-dir> <out-dir> [species] : renders a short close-up film of one critter (old gait left, v32 right)
// walking, turning in place, walking an arc, stopping. Frames -> out-dir/f_####.png (join with ffmpeg).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const [dir, outDir, spId] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file://' + path.resolve(dir) + '/index.html'); await page.waitForTimeout(2500);
  await page.evaluate((spId) => {
    const M = JT.M, D = JT.Draw; const S = spId ? JT.SPECIES_BY_ID[spId] : JT.SPECIES[0]; const stage = 5; const L = S.len * JT.STAGE_SCALE[stage];
    const W = 360, H = 260; const c = document.createElement('canvas'); c.width = W * 2; c.height = H; const ctx = c.getContext('2d');
    const mk = (id) => ({ id, species: S.id, state: 'idle', _walk: 0, _moving: false, _crouch: 0, seed: 3, sat: 0.6, stage, pos: [0, 0, 0], fwd: [1, 0, 0] });
    const A = mk('old'), B = mk('new'); let yaw = 0; const dt = 1 / 30; let t = 0; const frames = [];
    const spd = (9 + L * 0.9) * 0.55; // a calm walking pace
    // script: [duration, speed factor, turn rate rad/s, state]
    const plan = [[0.8, 0, 0, 'idle'], [1.8, 1, 0, 'explore'], [1.6, 0, 2.6, 'idle'], [2.2, 0.8, 1.1, 'explore'], [0.5, 0, 0, 'idle'], [0.8, 0, -3.2, 'scan'], [1.4, 0.35, 0, 'stalk'], [2.2, 0, 0, 'idle']];
    window._film = { S: S.id, L, n: 0 }; const pos = [0, 0, 0];
    for (const [dur, sf, tr, st] of plan) for (let k = 0; k < dur / dt; k++) {
      t += dt; yaw += tr * dt; const f = [Math.cos(yaw), 0, Math.sin(yaw)]; const v = spd * sf; pos[0] += f[0] * v * dt; pos[2] += f[2] * v * dt;
      for (const sp of [A, B]) { sp.state = st; sp._moving = v > 0.01; sp._walk += v * dt / Math.max(0.5, L * 0.32); sp.fwd = f; sp.pos = pos.slice(); sp._crouch = st === 'stalk' ? 0.5 : 0; sp._legRaise = st === 'stalk' || st === 'scan' ? 0.8 : 0; }
      frames.push({ t, pos: pos.slice(), f, st });
    }
    window._frames = frames; window._draw = (i) => {
      const fr0 = frames[i]; ctx.fillStyle = '#d9cdb2'; ctx.fillRect(0, 0, W * 2, H);
      [[A, 0, true], [B, W, false]].forEach(([sp, x0, old]) => {
        const V = new JT.View(0.9, 0.62, H / (L * 2.4), x0 + W / 2, H * 0.6, fr0.pos);
        ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, W, H); ctx.clip();
        // ground marks (fixed in the world) make any foot sliding visible
        ctx.fillStyle = 'rgba(90,70,40,0.35)'; const g = L * 0.25; const cx = Math.round(fr0.pos[0] / g) * g, cz = Math.round(fr0.pos[2] / g) * g;
        for (let a = -10; a <= 10; a++) for (let b = -10; b <= 10; b++) { const q = V.P([cx + a * g, 0, cz + b * g]); ctx.fillRect(q[0] - 1, q[1] - 1, 2, 2); }
        window.JT_NO_GAIT = old;
        try { JT.withBaseLight(() => D.spider(ctx, V, sp, { p: fr0.pos, f: fr0.f, s: M.norm(M.cross([0, 1, 0], fr0.f)).map(x => -x), n: [0, 1, 0] }, { len: L, time: fr0.t, alpha: 1 })); } catch (e) { ctx.fillStyle = 'red'; ctx.fillText(e.message, x0 + 5, 30); }
        window.JT_NO_GAIT = false; ctx.restore();
        ctx.fillStyle = '#333'; ctx.font = '13px sans-serif'; ctx.fillText((old ? 'before' : 'v32 planted feet') + ' · ' + fr0.st, x0 + 8, 18);
      });
      const R = B._rig; const st = window._stat || (window._stat = { maxSwing: 0, conflict: 0, maxErr: 0, steps: 0, slip: 0, prev: {} });
      if (R) { let sw = 0; for (const k in R.legs) { const g = R.legs[k]; if (g.k >= 0) { sw++; for (const q of [k ^ 1, k - 2, +k + 2]) { const h = R.legs[q]; if (h && h.k >= 0 && h.k < 0.85 && g.k < 0.85) st.conflict++; } }
          if (g.fr < 0.01) st.maxErr = Math.max(st.maxErr, M.dist(g.out, g.tg) / L); const pv = st.prev[k]; if (pv && pv.k < 0 && g.k >= 0) st.steps++; if (pv && pv.k < 0 && g.k < 0 && g.fr < 0.01) st.slip = Math.max(st.slip, M.dist(pv.p, g.p)); st.prev[k] = { k: g.k, p: g.p.slice() }; }
        st.maxSwing = Math.max(st.maxSwing, sw); }
      return c.toDataURL('image/png');
    };
  }, spId || null);
  const n = await page.evaluate(() => window._frames.length);
  for (let i = 0; i < n; i++) { const u = await page.evaluate((i) => window._draw(i), i); fs.writeFileSync(path.join(outDir, 'f_' + String(i).padStart(4, '0') + '.png'), Buffer.from(u.split(',')[1], 'base64')); }
  const stat = await page.evaluate(() => { const s = window._stat || {}; delete s.prev; return s; }); console.log(JSON.stringify({ frames: n, stat, errors: errors.slice(0, 5) })); await browser.close();
})();
