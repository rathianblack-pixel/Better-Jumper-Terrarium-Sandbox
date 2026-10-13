/* Sized droplets (shared by both games). Mist and dew drops are sized to the critters in the tank (a tiny sling or
   nymph gets tiny beads, an adult a little larger, all smaller than before), and each drop may get a couple of even
   smaller beads scattered beside it, randomly sized. Ground pools are left alone. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, HP = JT.Habitat && JT.Habitat.prototype; if (!HP) return;
  const lenOf = (h) => { const ss = h.data.spiders || []; if (!ss.length) return 6; let s = 0; for (const sp of ss) s += JT.SpiderAI.len(sp); return s / ss.length; };
  
  JT.dropSize = (h) => M.clamp(0.16 * Math.sqrt(lenOf(h)), 0.22, 0.75);
  function size(h, from) {
    const ds = h.data.drops; if (!ds || !ds.length) return; from = 0; const base = JT.dropSize(h); const add = [];
    for (let i = from; i < ds.length; i++) {
      const w = ds[i]; if (w.pool || w._sz) continue; w._sz = 1; w.r = base * (0.85 + JT.R() * 0.3);
      const n = JT.R() < 0.4 ? 1 + (JT.R() < 0.25 ? 1 : 0) : 0; // a few extra beads beside it, smaller still
      for (let k = 0; k < n; k++) {
        const a = JT.R() * Math.PI * 2, d = base * (1.6 + JT.R() * 2.2);
        let pos; const sp = w.sup, g = sp && sp.k === 'path' && h.geoms[sp.d], pa = g && g.paths[sp.p];
        if (pa && pa.pts[sp.s + 1]) { const tan = M.norm(M.sub(pa.pts[sp.s + 1], pa.pts[sp.s])); pos = M.add(w.pos, M.mul(tan, (JT.R() < 0.5 ? -1 : 1) * d)); } // along the stem
        else if (sp && sp.k === 'path') continue;
        else pos = [w.pos[0] + Math.cos(a) * d, w.pos[1], w.pos[2] + Math.sin(a) * d]; // on a flat top / the floor
        if (!M.finite3(pos)) continue;
        add.push({ id: JT.newId('w'), pos, sup: JT.deepClone(w.sup), decor: w.decor || null, life: w.life * (0.5 + JT.R() * 0.4), r: base * (0.3 + JT.R() * 0.35), _sz: 1, tiny: true });
      }
    }
    for (const w of add) ds.push(w);
  }
  for (const k of ['mist', 'updateDew']) {
    const f0 = HP[k]; if (!f0) continue;
    HP[k] = function () { const n0 = (this.data.drops || []).length; const r = f0.apply(this, arguments); size(this, Math.min(n0, (this.data.drops || []).length)); if (this.data.drops.length > 44) this.data.drops.splice(0, this.data.drops.length - 44); return r; };
  }
  // drawing: allow genuinely small beads on screen (the old minimum was 1.2 px)
  const D = JT.Draw; if (D && D.drop) { const d0 = D.drop; D.drop = function (ctx, V, w, pos) {
    if (!w._sz) return d0.apply(this, arguments);
    const p = V.P(pos); const r = Math.max(0.7, w.r * V.s);
    if (r > 1.2) {
      ctx.fillStyle = 'rgba(10,20,30,0.24)';
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], r * 0.85, r * 0.35, 0, 0, 6.283);
      ctx.fill();
    }
    const cy = p[1] - r * 0.55;
    const gr = ctx.createRadialGradient(p[0] - r * 0.32, cy - r * 0.32, r * 0.08, p[0], cy, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.92)');
    gr.addColorStop(0.3, 'rgba(215,242,255,0.72)');
    gr.addColorStop(0.7, 'rgba(140,195,230,0.4)');
    gr.addColorStop(0.95, 'rgba(80,140,190,0.65)');
    gr.addColorStop(1, 'rgba(40,80,120,0.8)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p[0], cy, r, 0, 6.283); ctx.fill();
    if (r > 1.4) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(p[0] - r * 0.28, cy - r * 0.32, Math.max(0.4, r * 0.22), 0, 6.283);
      ctx.fill();
    }
    if (r > 2.2) {
      ctx.fillStyle = 'rgba(220,250,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(p[0] + r * 0.15, cy + r * 0.5, r * 0.45, r * 0.18, 0, 0, 6.283);
      ctx.fill();
    }
  }; }
})(typeof window !== 'undefined' ? window : globalThis);


