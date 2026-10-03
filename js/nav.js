/* Jumper Terrarium — physical navigation.
   The habitat navigation graph is derived from decor geometry (same paths the renderer draws).
   Support descriptors (what an animal stands on):
     {k:'floor'}                          substrate
     {k:'top', d:decorId, i:topIndex}      walkable top of a solid
     {k:'path', d, p, s, t}                segment s of path p of decor d, parameter t in [0,1]
     {k:'air'}                             airborne (jump / flight / fall)
   Regions ('F' floor, 'T|d|i' tops) are open walkable areas with obstacles; paths are 1D surfaces.
   Graph edges: path (along a visible path), link (paths that physically meet), region (open walk),
   jump (supported leap between distinct objects), drop (dragline descent). */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, G = JT.G;
  const Nav = JT.Nav = {};
  const JMAX = 60;          // longest jump edge kept in the shared graph (filtered per animal)
  const CONTACT_H = 1.25;

  Nav.regionKey = function (sup) { return sup.k === 'floor' ? 'F' : sup.k === 'top' ? 'T|' + sup.d + '|' + sup.i : null; };
  Nav.supFromRegion = function (key) { if (key === 'F') return { k: 'floor' }; const q = key.split('|'); return { k: 'top', d: q[1], i: +q[2] }; };
  Nav.inside = function (hab, x, z, margin) {
    margin = margin || 0;
    if (hab.dims.shape === 'circle') { const r = hab.dims.w / 2 - margin; return Math.hypot(x - hab.dims.w / 2, z - hab.dims.d / 2) <= r; }
    return x >= margin && x <= hab.dims.w - margin && z >= margin && z <= hab.dims.d - margin;
  };
  Nav.clampInside = function (hab, x, z, margin) {
    margin = margin || 2;
    if (hab.dims.shape === 'circle') { const cx = hab.dims.w / 2, cz = hab.dims.d / 2, r = hab.dims.w / 2 - margin; const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz); if (l > r) return [cx + dx / l * r, cz + dz / l * r]; return [x, z]; }
    return [M.clamp(x, margin, hab.dims.w - margin), M.clamp(z, margin, hab.dims.d - margin)];
  };

  function Heap() { this.a = []; }
  Heap.prototype.push = function (n, p) { const a = this.a; a.push([p, n]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } };
  Heap.prototype.pop = function () { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; };

  /** Build the navigation graph for a habitat from its decor geometry. */
  Nav.build = function (hab) {
    const nav = { nodes: [], adj: [], regions: {}, pathIndex: {}, perches: [], flowers: [], water: [], version: (hab._navVersion = (hab._navVersion || 0) + 1) };
    const geoms = hab.geoms;
    const region = (key, y, poly) => nav.regions[key] || (nav.regions[key] = { key, y, poly: poly || null, nodes: [], obstacles: [] });
    region('F', 0, null);
    const supRegion = (inst) => inst.parent ? 'T|' + inst.parent + '|' + (inst.parentTop || 0) : 'F';
    // obstacles: solids resting on each region
    for (const inst of hab.decor) {
      const g = geoms[inst.id]; if (!g) continue;
      g.tops.forEach((t, i) => region('T|' + inst.id + '|' + i, t.y, t.poly));
    }
    for (const inst of hab.decor) {
      const g = geoms[inst.id]; if (!g || !g.solids.length) continue;
      const r = nav.regions[supRegion(inst)]; if (r) for (const s of g.solids) r.obstacles.push(s);
    }
    const addNode = (n) => { n.id = nav.nodes.length; nav.nodes.push(n); nav.adj.push([]); if (n.region) nav.regions[n.region].nodes.push(n.id); return n.id; };
    const addEdge = (a, b, e) => { nav.adj[a].push(Object.assign({ to: b }, e)); };
    const both = (a, b, e) => { addEdge(a, b, e); addEdge(b, a, Object.assign({}, e, e.s != null ? { rev: true } : {})); };

    // ---- path nodes ----
    for (const inst of hab.decor) {
      const g = geoms[inst.id]; if (!g) continue;
      const baseRegion = supRegion(inst);
      g.paths.forEach((pa, p) => {
        const ids = [];
        pa.pts.forEach((pt, i) => {
          let reg = null;
          if (pt[1] - g.baseY < CONTACT_H) reg = baseRegion;
          if (pa.kind === 'face') { if (i === pa.pts.length - 1) reg = 'T|' + inst.id + '|' + pa.endTop; if (i === 0) reg = pa.startTop != null ? 'T|' + inst.id + '|' + pa.startTop : baseRegion; }
          if (reg && !nav.regions[reg]) reg = null;
          const last = i === pa.pts.length - 1;
          const sup = (reg && pa.kind === 'face') ? Nav.supFromRegion(reg) : { k: 'path', d: inst.id, p, s: Math.min(i, pa.pts.length - 2), t: last ? 1 : 0 };
          const id = addNode({ pos: pt, region: reg, sup, decor: inst.id, kind: pa.kind, path: { p, i }, perch: last && pa.perch && pa.kind !== 'face', flower: last && pa.flower, y: pt[1] });
          nav.pathIndex[inst.id + '|' + p + '|' + i] = id;
          ids.push(id);
        });
        for (let i = 0; i < ids.length - 1; i++) {
          const a = pa.pts[i], b = pa.pts[i + 1]; const L = M.dist(a, b) || 0.01;
          const climb = Math.abs(b[1] - a[1]) / L;
          both(ids[i], ids[i + 1], { type: 'path', cost: L * (1 + 0.5 * climb), len: L, d: inst.id, p, s: i });
        }
        if (nav.nodes[ids[ids.length - 1]].perch) nav.perches.push(ids[ids.length - 1]);
        if (nav.nodes[ids[ids.length - 1]].flower) nav.flowers.push(ids[ids.length - 1]);
      });
      // junctions: where separate paths of the same object visibly meet
      const pids = g.paths.map((pa, p) => pa.pts.map((_, i) => nav.pathIndex[inst.id + '|' + p + '|' + i]));
      for (let p = 0; p < g.paths.length; p++) for (let q = p + 1; q < g.paths.length; q++) {
        const A = g.paths[p], Bp = g.paths[q]; const tol = Math.max(A.r, Bp.r) + 1.2;
        for (let i = 0; i < A.pts.length; i++) for (let j = 0; j < Bp.pts.length; j++) {
          if (A.pts[i][1] - g.baseY < CONTACT_H && Bp.pts[j][1] - g.baseY < CONTACT_H) continue; // both on ground: joined by region
          const d = M.dist(A.pts[i], Bp.pts[j]);
          if (d < tol) both(pids[p][i], pids[q][j], { type: 'link', cost: d + 0.4, len: d });
        }
      }
      // tops: centroid + inner vertices
      g.tops.forEach((t, i) => {
        const key = 'T|' + inst.id + '|' + i; const c = G.centroid(t.poly);
        const inner = G.scalePoly(t.poly, 0.72, c);
        const pts = [c]; const step = Math.max(1, Math.floor(inner.length / 6)); for (let k = 0; k < inner.length; k += step) pts.push(inner[k]);
        for (const q of pts) {
          if (nav.regions[key].obstacles.some(o => G.pointInPoly(q[0], q[1], o))) continue;
          const id = addNode({ pos: [q[0], t.y, q[1]], region: key, sup: { k: 'top', d: inst.id, i }, decor: inst.id, kind: 'top', perch: q !== c, y: t.y });
          if (q !== c) nav.perches.push(id);
        }
      });
    }
    // ---- region obstacle corner nodes ----
    for (const key in nav.regions) {
      const r = nav.regions[key];
      for (const o of r.obstacles) {
        const ex = G.expandPoly(o, 3.2); const step = Math.max(1, Math.floor(ex.length / 8));
        for (let k = 0; k < ex.length; k += step) {
          const q = ex[k];
          if (key === 'F' ? !Nav.inside(hab, q[0], q[1], 2.5) : !G.pointInPoly(q[0], q[1], r.poly)) continue;
          if (r.obstacles.some(o2 => G.pointInPoly(q[0], q[1], o2))) continue;
          const sup = key === 'F' ? { k: 'floor' } : { k: 'top', d: key.split('|')[1], i: +key.split('|')[2] };
          addNode({ pos: [q[0], r.y, q[1]], region: key, sup, decor: sup.d || null, kind: key === 'F' ? 'floor' : 'top', y: r.y });
        }
      }
    }
    // a sparse floor lattice so open floors have sensible waypoints (used for refuges/wander)
    const fr = nav.regions.F;
    const W = hab.dims.w, D = hab.dims.d, stepX = Math.max(26, W / 8), stepZ = Math.max(22, D / 4);
    for (let x = stepX / 2; x < W; x += stepX) for (let z = stepZ / 2; z < D; z += stepZ) {
      if (!Nav.inside(hab, x, z, 4)) continue; if (fr.obstacles.some(o => G.pointInPoly(x, z, G.expandPoly(o, 2)))) continue;
      addNode({ pos: [x, 0, z], region: 'F', sup: { k: 'floor' }, decor: null, kind: 'floor', y: 0, lattice: true });
    }
    // ---- region edges (visibility within open areas) ----
    for (const key in nav.regions) {
      const r = nav.regions[key], ns = r.nodes;
      for (let a = 0; a < ns.length; a++) for (let b = a + 1; b < ns.length; b++) {
        const A = nav.nodes[ns[a]].pos, Bn = nav.nodes[ns[b]].pos; const d = M.dist2(A, Bn);
        if (d > 150) continue;
        if (!Nav.regionClear(nav, r, A, Bn)) continue;
        both(ns[a], ns[b], { type: 'region', cost: d, len: d, region: key });
      }
    }
    // ---- jump edges between distinct objects ----
    const cand = nav.nodes.filter(n => n.kind !== 'face' && !n.lattice && (n.kind !== 'floor' || true) && (n.kind === 'top' || n.kind === 'floor' || n.path && (n.path.i % 2 === 0 || n.perch)));
    for (const a of cand) {
      const near = [];
      for (const b of cand) {
        if (a === b) continue;
        if (a.decor && a.decor === b.decor) continue;           // same object: walk, don't jump
        if (a.kind === 'floor' && b.kind === 'floor') continue;
        if (a.region && a.region === b.region) continue;
        const d = M.dist(a.pos, b.pos); if (d < 5 || d > JMAX) continue;
        const rise = b.pos[1] - a.pos[1]; if (rise > 24) continue;
        if (a.kind === 'floor' && rise < 3) continue;
        if (jumpBlocked(hab, a.pos, b.pos)) continue;
        near.push([d, b]);
      }
      near.sort((x, y) => x[0] - y[0]);
      for (const [d, b] of near.slice(0, 5)) addEdge(a.id, b.id, { type: 'jump', cost: d * 1.15 + 5, len: d, rise: b.pos[1] - a.pos[1] });
    }
    // ---- drop edges (dragline descents) from perches / top rims ----
    const landings = {};
    for (const a of nav.nodes.slice()) {
      if (!(a.perch || (a.kind === 'top' && a.perch))) continue;
      const below = Nav.supportBelow(hab, [a.pos[0], a.pos[1] - 2, a.pos[2]], a.decor);
      const h = a.pos[1] - below.pos[1]; if (h < 6 || h > 90) continue;
      const key = Math.round(below.pos[0]) + ',' + Math.round(below.pos[2]) + ',' + (Nav.regionKey(below.sup) || 'x');
      let lid = landings[key];
      if (lid == null) {
        const rk = Nav.regionKey(below.sup); if (!rk || !nav.regions[rk]) continue;
        lid = addNode({ pos: below.pos, region: rk, sup: below.sup, decor: below.sup.d || null, kind: rk === 'F' ? 'floor' : 'top', y: below.pos[1], landing: true });
        landings[key] = lid;
        const r = nav.regions[rk];
        for (const nid of r.nodes) if (nid !== lid) { const B = nav.nodes[nid].pos; const d = M.dist2(below.pos, B); if (d < 150 && Nav.regionClear(nav, r, below.pos, B)) both(lid, nid, { type: 'region', cost: d, len: d, region: rk }); }
      }
      addEdge(a.id, lid, { type: 'drop', cost: 6 + h * 0.25, len: h, rise: -h });
    }
    // ---- water & flower anchors (always carry their parent decor id) ----
    for (const inst of hab.decor) {
      const g = geoms[inst.id]; if (!g) continue;
      for (const w of g.water) {
        if (w.top != null) nav.water.push({ pos: w.pos, sup: { k: 'top', d: inst.id, i: w.top }, decor: inst.id, permanent: true });
        else { const n = Nav.nearestNodeOfDecor(nav, inst.id, w.pos); if (n) nav.water.push({ pos: n.pos, sup: n.sup, decor: inst.id, permanent: true }); }
      }
    }
    return nav;
  };

  function jumpBlocked(hab, a, b) {
    for (let k = 1; k < 5; k++) {
      const t = k / 5; const x = M.lerp(a[0], b[0], t), z = M.lerp(a[2], b[2], t);
      const y = M.lerp(a[1], b[1], t) + Math.sin(t * Math.PI) * M.dist(a, b) * 0.18;
      for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (!g || !g.solids.length) continue; if (y < g.baseY + g.height - 0.5 && y > g.baseY - 0.5) for (const s of g.solids) if (G.pointInPoly(x, z, s)) return true; }
    }
    return false;
  }

  Nav.regionClear = function (nav, r, A, B) {
    for (const o of r.obstacles) if (G.segHitsPoly([A[0], A[2]], [B[0], B[2]], o)) return false;
    if (r.poly) { for (let k = 1; k < 4; k++) { const t = k / 4; if (!G.pointInPoly(M.lerp(A[0], B[0], t), M.lerp(A[2], B[2], t), r.poly)) return false; } }
    return true;
  };

  Nav.nearestNodeOfDecor = function (nav, decorId, pos) {
    let best = null, bd = 1e9;
    for (const n of nav.nodes) if (n.decor === decorId && n.kind !== 'face') { const d = M.dist(n.pos, pos); if (d < bd) { bd = d; best = n; } }
    return best;
  };

  /** Highest legitimate support under a point (tops, then floor). Never a boundary wall. */
  Nav.supportBelow = function (hab, pos, excludeDecor) {
    let best = null;
    for (const inst of hab.decor) {
      const g = hab.geoms[inst.id]; if (!g || inst.id === excludeDecor) continue;
      g.tops.forEach((t, i) => { if (t.y <= pos[1] + 0.6 && G.pointInPoly(pos[0], pos[2], t.poly) && (!best || t.y > best.pos[1])) best = { pos: [pos[0], t.y, pos[2]], sup: { k: 'top', d: inst.id, i } }; });
    }
    if (best) return best;
    let [x, z] = Nav.clampInside(hab, pos[0], pos[2], 3);
    // push out of floor-level solids whose top is above this point
    for (const inst of hab.decor) {
      const g = hab.geoms[inst.id]; if (!g || inst.parent) continue;
      for (const s of g.solids) if (G.pointInPoly(x, z, s)) {
        const c = G.centroid(s); let dx = x - c[0], dz = z - c[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        for (let k = 0; k < 60 && G.pointInPoly(x, z, s); k++) { x += dx * 1.5; z += dz * 1.5; }
        [x, z] = Nav.clampInside(hab, x, z, 3);
      }
    }
    return { pos: [x, 0, z], sup: { k: 'floor' } };
  };

  Nav.validSup = function (hab, sup) {
    if (!sup) return false;
    if (sup.k === 'floor' || sup.k === 'air') return true;
    const g = hab.geoms[sup.d]; if (!g) return false;
    if (sup.k === 'top') return !!g.tops[sup.i];
    if (sup.k === 'path') { const pa = g.paths[sup.p]; return !!pa && sup.s >= 0 && sup.s < pa.pts.length - 1; }
    return false;
  };
  /** World position of a support (x,z used for regions). */
  Nav.supPos = function (hab, sup, pos) {
    if (sup.k === 'floor') return [pos[0], 0, pos[2]];
    if (sup.k === 'top') return [pos[0], hab.geoms[sup.d].tops[sup.i].y, pos[2]];
    if (sup.k === 'path') { const pa = hab.geoms[sup.d].paths[sup.p]; return M.lerp3(pa.pts[sup.s], pa.pts[sup.s + 1], M.clamp(sup.t, 0, 1)); }
    return pos;
  };
  /** Surface normal + path info for orientation and render offset. */
  Nav.supFrame = function (hab, sup) {
    if (!sup || sup.k !== 'path') return { n: [0, 1, 0], r: 0, flex: 0 };
    const g = hab.geoms[sup.d]; if (!g) return { n: [0, 1, 0], r: 0, flex: 0 };
    const pa = g.paths[sup.p]; if (!pa) return { n: [0, 1, 0], r: 0, flex: 0 };
    const a = pa.pts[sup.s], b = pa.pts[sup.s + 1];
    const tan = M.norm(M.sub(b, a));
    let n = pa.nrm && pa.nrm[sup.s];
    if (!n) {
      const ty = Math.abs(tan[1]);
      let side = pa.side;
      if (!side) { const c = g.center; const dx = a[0] - c[0], dz = a[2] - c[2]; const l = Math.hypot(dx, dz); side = l > 1.5 ? [dx / l, 0, dz / l] : [0, 0, -1]; }
      n = M.norm(M.add(M.mul([0, 1, 0], 1 - ty), M.mul(side, ty + 0.05)));
    }
    // orthogonalize against tangent
    n = M.norm(M.sub(n, M.mul(tan, M.dot(n, tan))));
    return { n, tan, r: pa.r, flex: pa.flex };
  };

  /** Graph attachment points for an arbitrary supported position. */
  Nav.attach = function (hab, sup, pos) {
    const nav = hab.nav, out = [];
    if (sup.k === 'path') {
      const a = nav.pathIndex[sup.d + '|' + sup.p + '|' + sup.s], b = nav.pathIndex[sup.d + '|' + sup.p + '|' + (sup.s + 1)];
      if (a != null) out.push([a, M.dist(pos, nav.nodes[a].pos), { type: 'path', d: sup.d, p: sup.p, s: sup.s }]);
      if (b != null) out.push([b, M.dist(pos, nav.nodes[b].pos), { type: 'path', d: sup.d, p: sup.p, s: sup.s }]);
      return out;
    }
    const key = Nav.regionKey(sup); const r = key && nav.regions[key]; if (!r) return out;
    for (const nid of r.nodes) { const q = nav.nodes[nid].pos; const d = M.dist2(pos, q); if (d < 160 && Nav.regionClear(nav, r, pos, q)) out.push([nid, d, { type: 'region', region: key }]); }
    if (!out.length) { // fall back to nearest few nodes ignoring obstacles (tiny drift cases)
      const ns = r.nodes.map(n => [n, M.dist2(pos, nav.nodes[n].pos)]).sort((a, b) => a[1] - b[1]).slice(0, 2);
      for (const [n, d] of ns) out.push([n, d * 1.5 + 2, { type: 'region', region: key }]);
    }
    return out;
  };

  /** Dijkstra from a supported position. caps: {jump: maxJumpLen (0 = none), climb: bool, carry: bool} */
  Nav.dijkstra = function (hab, sup, pos, caps) {
    const nav = hab.nav, N = nav.nodes.length;
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-2), pe = new Array(N);
    const h = new Heap();
    for (const [nid, c, e] of Nav.attach(hab, sup, pos)) { if (c < dist[nid]) { dist[nid] = c; prev[nid] = -1; pe[nid] = e; h.push(nid, c); } }
    const maxJ = caps.jump || 0;
    while (h.a.length) {
      const [d, u] = h.pop(); if (d > dist[u]) continue;
      for (const e of nav.adj[u]) {
        if (e.type === 'jump' && (e.len > maxJ || (caps.carry && e.len > maxJ * 0.6))) continue;
        if (e.type === 'drop' && !caps.drop) continue;
        if ((e.type === 'path' || e.type === 'link') && !caps.climb) continue;
        const nd = d + e.cost;
        if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = u; pe[e.to] = e; h.push(e.to, nd); }
      }
    }
    return { dist, prev, pe, sup, pos };
  };

  /** Cost to a goal support/pos from a dijkstra result (+ best attach node). */
  Nav.goalCost = function (hab, dj, gsup, gpos) {
    // trivial same-support cases
    if (gsup.k === 'path' && dj.sup.k === 'path' && gsup.d === dj.sup.d && gsup.p === dj.sup.p && gsup.s === dj.sup.s) return { cost: M.dist(dj.pos, gpos), direct: true };
    const rk = Nav.regionKey(gsup);
    if (rk && rk === Nav.regionKey(dj.sup)) { const r = hab.nav.regions[rk]; if (r && Nav.regionClear(hab.nav, r, dj.pos, gpos)) return { cost: M.dist2(dj.pos, gpos), direct: true }; }
    let best = null;
    for (const [nid, c, e] of Nav.attach(hab, gsup, gpos)) { const t = dj.dist[nid] + c; if (isFinite(t) && (!best || t < best.cost)) best = { cost: t, node: nid, e }; }
    return best;
  };

  function stepSupFor(hab, e, fromPos, toNode) {
    if (!e) return null;
    if (e.type === 'path') return { k: 'path', d: e.d, p: e.p, s: e.s, t: 0 };
    if (e.type === 'region') return e.region === 'F' ? { k: 'floor' } : { k: 'top', d: e.region.split('|')[1], i: +e.region.split('|')[2] };
    if (e.type === 'jump' || e.type === 'drop') return { k: 'air' };
    return null; // link: keep arrival sup
  }

  /** Build an executable route (list of steps) to a goal from a dijkstra result. */
  Nav.buildRoute = function (hab, dj, gsup, gpos) {
    const nav = hab.nav; const gc = Nav.goalCost(hab, dj, gsup, gpos); if (!gc) return null;
    const steps = [];
    if (gc.direct) {
      steps.push({ pos: gpos.slice(), mode: 'walk', during: gsup.k === 'path' ? Object.assign({}, gsup) : JT.deepClone(gsup), arrive: JT.deepClone(gsup) });
      return { steps, i: 0, cost: gc.cost, goalSup: gsup, goalPos: gpos };
    }
    const chain = []; let u = gc.node;
    while (u >= 0) { chain.push(u); u = dj.prev[u]; if (chain.length > 5000) return null; }
    chain.reverse();
    for (let k = 0; k < chain.length; k++) {
      const n = nav.nodes[chain[k]], e = dj.pe[chain[k]];
      const mode = e && (e.type === 'jump' || e.type === 'drop') ? e.type : 'walk';
      steps.push({ pos: n.pos.slice(), mode, during: stepSupFor(hab, e), arrive: JT.deepClone(n.sup), edge: e ? e.type : 'start', decor: n.decor });
    }
    steps.push({ pos: gpos.slice(), mode: 'walk', during: stepSupFor(hab, gc.e) || JT.deepClone(gsup), arrive: JT.deepClone(gsup), edge: 'goal' });
    return { steps, i: 0, cost: gc.cost, goalSup: gsup, goalPos: gpos };
  };

  Nav.route = function (hab, sup, pos, gsup, gpos, caps) {
    const dj = Nav.dijkstra(hab, sup, pos, caps);
    return Nav.buildRoute(hab, dj, gsup, gpos);
  };

  /** Shelter value at a point from nearby decor. */
  Nav.coverAt = function (hab, pos) {
    let c = 0;
    for (const inst of hab.decor) {
      const g = hab.geoms[inst.id]; if (!g || !g.cover) continue;
      const d = Math.hypot(pos[0] - g.center[0], pos[2] - g.center[2]); if (d > g.coverR) continue;
      if (pos[1] > g.baseY + g.height + 2) continue;
      c += g.cover * (1 - d / g.coverR) * (g.def.cat === 'ground' ? (pos[1] < g.baseY + 2 ? 1 : 0) : 1);
    }
    return Math.min(1, c);
  };
  /** Count distinct decor objects in a route (stepping stones). */
  Nav.routeDecorCount = function (route) { const s = new Set(); for (const st of route.steps) if (st.decor) s.add(st.decor); return s.size; };
  Nav.routeHasJump = function (route) { return route.steps.some(s => s.mode === 'jump'); };
})(typeof window !== 'undefined' ? window : globalThis);
