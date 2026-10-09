/* Mantis Terrarium pack v1.2 — atmosphere: breeze spring, autumn leaf drift (Dry Leaf Forest) and pollinators
   (Orchid Garden). Simulation side only; drawing is in atmos-draw.js. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, Nav = JT.Nav, AI = JT.SpiderAI, PA = JT.PreyAI;
  const R = () => JT.R();
  const bid = (h) => (JT.Biomes && JT.Biomes.id ? JT.Biomes.id(h) : 'classic');
  const windK = (h) => { const w = h.data && (h.data.bev || h.data.wx); return w && w.id === 'wind' ? 1 : 0; };
  const SWAY_ARCHE = new Set(['bamboo', 'moss', 'leafcluster']);
  const A = JT.MAtmos = { LEAF_CAP: 6 };

  // ---- breeze: one shared spring kicked at the same moments as the swaying stems (biome tick every 2 s) ----
  function windTick(h, dt) {
    const W = h._mWind || (h._mWind = { x: 0, vx: 0 });
    const be = h._bmExtra; const kicked = windK(h) && be != null && h._mBmPrev != null && be < h._mBmPrev; h._mBmPrev = be;
    if (kicked) {
      W.vx += 0.8;
      for (const inst of h.data.decor) { const d = JT.DECOR_BY_ID[inst.type]; if (d && SWAY_ARCHE.has(d.arche)) { const sw = inst._sw || (inst._sw = { x: 0, z: 0, vx: 0, vz: 0 }); sw.vx += d.arche === 'moss' ? 1.1 : 0.8; sw.vz += 0.25; } }
    }
    W.vx += (-W.x * 26 - W.vx * 5.5) * dt; W.x += W.vx * dt; if (Math.abs(W.x) + Math.abs(W.vx) < 1e-4) { W.x = 0; W.vx = 0; }
  }
  A.windTick = windTick;

  // ---- autumn leaf drift ----
  function spawnLeaf(h) {
    const dm = h.dims; const x = 6 + R() * Math.max(4, dm.w - 12), z = 6 + R() * Math.max(4, dm.d - 12); if (!Nav.inside(h, x, z, 4)) return null;
    const y = dm.h - 3 - R() * 4; const b = Nav.supportBelow(h, [x, y - 1, z]);
    const lf = { id: JT.newId('al'), pos: [x, y, z], y0: b.pos[1], sup: b.sup, t: 0, rest: 0, falling: true, seed: R() * 100, ang: R() * 6.28, spin: (R() < 0.5 ? -1 : 1) * (1.5 + R() * 2.5), hue: R(), size: 2.2 + R() * 1.4, flip: R() * 6.28 };
    (h._mLeaves || (h._mLeaves = [])).push(lf); return lf;
  }
  A.spawnLeaf = spawnLeaf;
  function leafTick(h, dt) {
    const on = bid(h) === 'dryleaf'; const L = h._mLeaves || (h._mLeaves = []);
    if (on) {
      h._mLeafT = (h._mLeafT == null ? 2 + R() * 5 : h._mLeafT) - dt;
      if (h._mLeafT <= 0) { h._mLeafT = windK(h) ? 2.5 + R() * 3 : 6 + R() * 8; if (L.filter(l => l.falling || l.rest < 20).length < A.LEAF_CAP) spawnLeaf(h); }
    }
    const wind = windK(h), W = h._mWind;
    for (const l of L) {
      l.t += dt;
      if (l.falling) {
        const flut = Math.sin(l.t * 2.4 + l.seed);
        l.pos[1] -= dt * (2.6 + flut * 1.2);
        l.pos[0] += (Math.sin(l.t * 1.3 + l.seed) * 3.2 + (wind ? 5 + (W ? W.x * 30 : 0) : 0)) * dt; l.pos[2] += Math.cos(l.t * 0.9 + l.seed) * 2.2 * dt;
        l.ang += l.spin * dt * (0.6 + 0.4 * Math.abs(flut)); l.flip += dt * (2.2 + Math.abs(l.spin) * 0.5);
        const c = Nav.clampInside(h, l.pos[0], l.pos[2], 2); l.pos[0] = c[0]; l.pos[2] = c[1];
        if ((l._yT = (l._yT || 0) - dt) <= 0) { l._yT = 0.4; const b = Nav.supportBelow(h, [l.pos[0], l.pos[1] - 0.2, l.pos[2]]); l.y0 = b.pos[1]; l.sup = b.sup; }
        if (l.pos[1] <= l.y0 + 0.15 || l.t > 60) { l.pos[1] = l.y0 + 0.12; l.falling = false; landed(h, l); }
        else if ((l._gT = (l._gT || R() * 0.3) - dt) <= 0) { l._gT = 0.35; glance(h, l); }
      } else l.rest += dt;
    }
    h._mLeaves = L.filter(l => l.rest < 32);
  }
  A.leafTick = leafTick;
  function glance(h, l) {
    for (const sp of h.data.spiders) {
      if (sp._air || sp.hold || (AI.PRI[sp.state] || 0) >= 45 || sp.state === 'sleep' || sp.state === 'mDead') continue;
      const d = M.dist(sp.pos, l.pos); if (d > 34 || (sp._mLeafG > h.time)) continue;
      sp._mLeafG = h.time + 2.5 + R() * 2; sp._glance = { id: l.id, pos: l.pos.slice(), until: h.time + 0.7 }; sp._mLeafSnaps = (sp._mLeafSnaps || 0) + 1;
      if ((AI.PRI[sp.state] || 0) < 15 && !(sp._mLeafTh > h.time)) { sp._mLeafTh = h.time + 40; sp.thought = 'Head snaps round to a drifting leaf.'; }
    }
  }
  function landed(h, l) {
    for (const p of h.data.prey) { if (p.owner || p.buried || p.dead || !p.sup || p.sup.k === 'air') continue; if (M.dist(p.pos, l.pos) < 7 && R() < 0.6) PA.startle(h, p, 0.4); }
  }

  // ---- pollinators: flying insects in the Orchid Garden visit the flowers, hover, then land and stay a while ----
  const fly0 = PA.H.fly;
  PA.H.fly = function (hab, p, d, dt) {
    if (bid(hab) !== 'orchidgarden' || !hab.nav || !hab.nav.flowers || !hab.nav.flowers.length || !d.fly) return fly0(hab, p, d, dt);
    const g = p._goal;
    if (!g || (!g.hov && !g.pol && (p._goalT || 0) > 1 && R() < dt * 0.6)) { const ng = flowerGoal(hab, p, d); if (ng) { p._goal = ng; p._goalT = 0; } }
    const G = p._goal;
    if (G && G.hov != null) {
      const dd = M.dist(p.pos, G.pos);
      if (dd < 2.6) { // hovering in front of the bloom
        G.hov -= dt; p._goalT = 0; const t = p._anim || 0; const ph = (p.seed % 100) / 10;
        const want = M.add(M.mul(M.sub(G.pos, p.pos), 2.5), [Math.sin(t * 9 + ph) * 1.6, Math.sin(t * 7 + ph) * 0.9, Math.cos(t * 8 + ph) * 1.6]);
        p._v = M.lerp3(p._v || [0, 0, 0], want, Math.min(1, dt * 4)); p.pos = M.add(p.pos, M.mul(p._v, dt)); p._hover = 1;
        const fw = M.sub(G.land.pos, p.pos); if (Math.hypot(fw[0], fw[2]) > 0.2) p.fwd = M.norm([fw[0], 0, fw[2]]);
        if (G.hov <= 0) { p._goal = { pos: G.land.pos, sup: G.land.sup, pol: 1 }; p._goalT = 0; }
        return;
      }
    }
    p._hover = 0;
    const was = p._goal; fly0(hab, p, d, dt);
    if (was && was.pol && p.state !== 'fly') { p.dur = 5 + R() * 14; p._pollen = hab.time; hab._mVisits = (hab._mVisits || 0) + 1; }
  };
  function flowerGoal(hab, p, d) {
    const nav = hab.nav; if (R() > 0.35 + (d.flowers || 0.3) * 0.6) return null;
    let pick = null; const lures = hab.data.spiders.filter(s => ['orchid', 'devilsflower', 'spiny'].includes(s.species) && s.sup && s.sup.d != null);
    if (lures.length && R() < 0.4) { const s = lures[Math.floor(R() * lures.length)]; let bd = 1e9; for (const id of nav.flowers) { const n = nav.nodes[id]; if (!n) continue; const k = M.dist(n.pos, s.pos); if (k < bd) { bd = k; pick = n; } } if (bd > 25) pick = null; }
    if (!pick) pick = nav.nodes[nav.flowers[Math.floor(R() * nav.flowers.length)]];
    if (!pick || !Nav.validSup(hab, pick.sup)) return null;
    const off = [(R() - 0.5) * 4, 2.5 + R() * 2.5, (R() - 0.5) * 4];
    return { pos: M.add(pick.pos, off), sup: null, hov: 0.8 + R() * 1.8, land: { pos: pick.pos.slice(), sup: JT.deepClone(pick.sup) } };
  }
  A.flowerGoal = flowerGoal;

  if (JT.Habitat) {
    const HP = JT.Habitat.prototype, up0 = HP.update;
    HP.update = function (dt, full) { up0.apply(this, arguments); if (!(dt > 0)) return; windTick(this, dt); if (full !== false) leafTick(this, dt); };
  }
})(typeof window !== 'undefined' ? window : globalThis);