/* Jumper Terrarium — smart follow camera (pure maths, no DOM, unit-testable).
   Frames the jumper's upper body from the side its back faces: from above at an angle on the floor,
   facing the wall when on a wall, orbiting round to the visible side on branches / under ledges.
   Everything is damped (critically damped springs, capped yaw speed, shortest-way rotation) so the
   view never snaps or flips. During jumps it leads toward the landing and widens slightly.
   User orbit / zoom pauses the automatic rotation for a few idle seconds. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  // framing: low, eye-level-ish views (about 22° down), front three-quarter; base zoom a little wider, then per jumper size
  const BASE_PITCH = 0.38, HUNT_PITCH = 0.4, UNDER_PITCH = 0.16, FACE_ANG = 0.95, BASE_ZOOM = 0.8;
  const TENSE = new Set(['notice', 'assess', 'track', 'stalk', 'creep', 'crouch', 'pounce', 'subdue', 'secure']);
  const PITCH_MIN = 0.12, PITCH_MAX = 0.98, PAUSE = 3.5, YAW_SPEED = 1.15, PLAN_DT = 0.25, WALL_ARC = 1.3; // tanks with a back wall: the camera keeps to the front half (±75°)

  function spring(x, v, target, omega, dt) {
    // critically damped spring step (stable for any dt)
    const f = 1 + 2 * dt * omega, oo = omega * omega, hoo = dt * oo, hhoo = dt * hoo;
    const detInv = 1 / (f + hhoo);
    const nx = (f * x + dt * v + hhoo * target) * detInv;
    const nv = (v + hoo * (target - x)) * detInv;
    return [nx, nv];
  }


  // ---------- line of sight ----------
  // Coarse occluders built once per decor layout: solid parts are opaque prisms, plants / branches are partial cover.
  const SOFT = { grass: 0.3, vine: 0.3, flower: 0.25, rosette: 0.35, branch: 0.3, lamp: 0.2 };
  function occluders(hab) {
    const key = hab._geomVersion + '|' + hab.decor.length;
    if (hab._camOcc && hab._camOcc.key === key) return hab._camOcc.list;
    const G = JT.G, list = [];
    const add = (poly, y0, y1, op, id) => {
      if (!poly || poly.length < 3 || !(y1 > y0)) return; let cx = 0, cz = 0; for (const q of poly) { cx += q[0]; cz += q[1]; } cx /= poly.length; cz /= poly.length;
      let r = 0; for (const q of poly) r = Math.max(r, Math.hypot(q[0] - cx, q[1] - cz)); list.push({ poly, y0, y1, op, id, cx, cz, r });
    };
    for (const inst of hab.decor) {
      const g = hab.geoms[inst.id]; if (!g || !g.def) continue; const def = g.def, a = def.arche;
      if (def.cat === 'ground' || a === 'wallmount') continue;
      const y0 = g.baseY, y1 = g.baseY + (g.height || 0);
      if (g.solids.length && !SOFT[a]) { for (const s of g.solids) add(s, y0, y1, 1, inst.id); continue; }
      if (a === 'backwall') continue;
      const ext = g.extent && g.extent.length >= 3 ? G.hull(g.extent) : g.foot;
      add(ext, y0 + (g.height || 0) * 0.08, y1, SOFT[a] != null ? SOFT[a] : (a === 'tree' ? 0.55 : 0.5), inst.id);
    }
    hab._camOcc = { key, list }; return list;
  }
  // fraction of light that gets from p to a camera in direction d (unit, d[1] > 0) — 1 = clear, 0 = hidden behind a solid
  function seeThrough(occ, p, d) {
    const G = JT.G; let v = 1; if (d[1] < 0.05) return v;
    for (const o of occ) {
      const t0 = Math.max(0, (o.y0 - p[1]) / d[1]), t1 = (o.y1 - p[1]) / d[1]; if (t1 <= t0) continue;
      const ax = p[0] + d[0] * t0, az = p[2] + d[2] * t0, bx = p[0] + d[0] * t1, bz = p[2] + d[2] * t1;
      // quick reject: segment-to-centre distance
      const ex = bx - ax, ez = bz - az, ll = ex * ex + ez * ez; let u = ll > 1e-9 ? ((o.cx - ax) * ex + (o.cz - az) * ez) / ll : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
      if (Math.hypot(ax + ex * u - o.cx, az + ez * u - o.cz) > o.r) continue;
      if (o.op >= 1 && t0 === 0 && G.pointInPoly(p[0], p[2], o.poly)) continue; // standing inside its own rock / tower outline: not an occluder
      if (G.segHitsPoly([ax, az], [bx, bz], o.poly)) { v *= 1 - o.op; if (v < 0.02) return 0; }
    }
    return v;
  }
  const toCam = (yaw, pitch) => { const cp = Math.cos(pitch); return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp]; };
  function visibility(occ, pts, yaw, pitch) { const d = toCam(yaw, pitch); let s = 0; for (const p of pts) s += seeThrough(occ, p, d); return s / pts.length; }
  // ---------- v17 line of sight: the decor's real shapes ----------
  // Every part that can hide a jumper, in world space with its own box: rock / cork / wall blocks (prisms), trunks, stems,
  // branches, logs, pots and grass blades (capsules), leaves (flat leaf outlines), flower heads and mushroom caps (balls).
  // Leaves are nearly opaque; thin stems and grass let some of the view through. The camera is orthographic, so a view
  // is a direction: a part hides a point if the ray from the point toward the camera passes through it.
  const Sight = JT.Sight = {};
  const SM = JT.M;
  function bbOf(pts, r) { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (const q of pts) { b[0] = Math.min(b[0], q[0] - r); b[1] = Math.min(b[1], q[1] - r); b[2] = Math.min(b[2], q[2] - r); b[3] = Math.max(b[3], q[0] + r); b[4] = Math.max(b[4], q[1] + r); b[5] = Math.max(b[5], q[2] + r); } return b; }
  function grow(B, b) { for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], b[i]); B[i + 3] = Math.max(B[i + 3], b[i + 3]); } }
  Sight.scene = function (hab) {
    const key = hab._geomVersion + '|' + hab.decor.length;
    if (hab._sight && hab._sight.key === key) return hab._sight;
    const list = [];
    for (const inst of hab.decor) {
      const g = hab.geoms[inst.id]; if (!g || !g.def) continue; const def = g.def; if (def.cat === 'ground' && !inst.parent) continue;
      const parts = []; const wall = def.arche === 'backwall';
      const cap = (a, b, r, op) => { if (r < 0.12) return; parts.push({ k: 'c', a, b, r, op, bb: bbOf([a, b], r) }); };
      for (const pr of g.prims) {
        if (pr.t === 'prism') { const pts = []; const dm = JT.Solid ? JT.Solid.dome(pr) : 0; for (const q of pr.poly.concat(pr.topPoly || [])) { pts.push([q[0], pr.y0, q[1]], [q[0], pr.y1 + dm, q[1]]); } parts.push({ k: 'p', pr, dm, op: 1, bb: bbOf(pts, 0) }); }
        else if (pr.t === 'tube') { const blade = pr.style === 'blade'; const n = pr.pts.length;
          for (let i = 0; i + 1 < n; i++) { const r = SM.lerp(pr.r0, pr.r1, (i + 0.5) / Math.max(1, n - 1)) * (blade ? 1.1 : 1); const op = blade ? 0.3 : pr.style === 'plank' ? 0.95 : r >= 0.8 ? 1 : SM.clamp(r * 0.9, 0.18, 0.75); cap(pr.pts[i], pr.pts[i + 1], r, op); } }
        else if (pr.t === 'log') { parts.push({ k: 'c', a: pr.a, b: pr.b, r: pr.r, op: 1, hollow: !!pr.hollow, bb: bbOf([pr.a, pr.b], pr.r) }); }
        else if (pr.t === 'leaf') { const L = SM.len(pr.a); if (L < 0.4) continue; let n = SM.cross(pr.a, pr.b); if (SM.len(n) < 1e-6) continue; n = SM.norm(n); const tip = SM.add(pr.o, pr.a);
          parts.push({ k: 'l', o: pr.o, a: pr.a, b: pr.b, n, aa: SM.dot(pr.a, pr.a), bb2: SM.dot(pr.b, pr.b) || 1, op: L < 1.5 ? 0.5 : 0.88, bb: bbOf([pr.o, tip, SM.add(pr.o, pr.b), SM.sub(pr.o, pr.b), SM.add(tip, pr.b), SM.sub(tip, pr.b)], L * 0.1) }); }
        else if (pr.t === 'bloom') { const r = pr.r * (pr.kind === 'bud' ? 0.8 : 1); parts.push({ k: 's', c: pr.o, r, ry: r * 0.6, op: 0.6, bb: bbOf([pr.o], r) }); }
        else if (pr.t === 'cap') { const ry = pr.cone ? pr.r * 0.95 : pr.r * 0.42; const c = [pr.o[0], pr.o[1] + ry * 0.35, pr.o[2]]; parts.push({ k: 's', c, r: pr.r, ry: ry * 0.75, op: 1, bb: bbOf([c], pr.r) }); }
        else if (pr.t === 'pot') cap(pr.o, [pr.o[0], pr.o[1] + pr.h, pr.o[2]], pr.r, 1);
        else if (pr.t === 'lamp') parts.push({ k: 's', c: pr.o, r: pr.r, ry: pr.r, op: 1, bb: bbOf([pr.o], pr.r) });
        else if (pr.t === 'shelf') parts.push({ k: 's', c: pr.o, r: pr.r * 0.9, ry: pr.r * 0.3, op: 0.95, bb: bbOf([pr.o], pr.r) });
      }
      if (!parts.length) continue;
      const B = parts[0].bb.slice(); for (const p of parts) grow(B, p.bb);
      list.push({ id: inst.id, parts, bb: B, wall, plant: def.cat === 'plants' });
    }
    hab._sight = { key, list }; return hab._sight;
  };
  // ray p + d t (t in [t0, t1]) against a box: entry/exit or null
  function slab(p, d, b, t0, t1) {
    for (let i = 0; i < 3; i++) { const lo = b[i], hi = b[i + 3];
      if (Math.abs(d[i]) < 1e-9) { if (p[i] < lo || p[i] > hi) return null; continue; }
      let ta = (lo - p[i]) / d[i], tb = (hi - p[i]) / d[i]; if (ta > tb) { const s = ta; ta = tb; tb = s; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return null; }
    return [t0, t1];
  }
  // closest distance between segment P0 + u*(P1-P0) and Q0 + v*(Q1-Q0)
  function segSeg(P0, P1, Q0, Q1) {
    const u = SM.sub(P1, P0), v = SM.sub(Q1, Q0), w = SM.sub(P0, Q0); const a = SM.dot(u, u), b = SM.dot(u, v), c = SM.dot(v, v), d = SM.dot(u, w), e = SM.dot(v, w);
    const D = a * c - b * b; let sN, sD = D, tN, tD = D;
    if (D < 1e-9) { sN = 0; sD = 1; tN = e; tD = c; } else { sN = b * e - c * d; tN = a * e - b * d; if (sN < 0) { sN = 0; tN = e; tD = c; } else if (sN > sD) { sN = sD; tN = e + b; tD = c; } }
    if (tN < 0) { tN = 0; if (-d < 0) sN = 0; else if (-d > a) sN = sD; else { sN = -d; sD = a; } } else if (tN > tD) { tN = tD; if (-d + b < 0) sN = 0; else if (-d + b > a) sN = sD; else { sN = -d + b; sD = a; } }
    const sc = Math.abs(sN) < 1e-9 ? 0 : sN / sD, tc = Math.abs(tN) < 1e-9 ? 0 : tN / tD;
    const dP = SM.sub(SM.add(w, SM.mul(u, sc)), SM.mul(v, tc)); return SM.len(dP);
  }
  function ptSeg(p, a, b) { const ab = SM.sub(b, a); const L2 = SM.dot(ab, ab) || 1; const t = SM.clamp(SM.dot(SM.sub(p, a), ab) / L2, 0, 1); return SM.dist(p, SM.add(a, SM.mul(ab, t))); }
  /** How much of the part does the ray pass through (0 = misses, else its opacity). */
  function hitPart(o, p, d, t0, t1) {
    if (o.k === 'c') { const ds = ptSeg(p, o.a, o.b); if (ds < o.r + 0.15) return o.hollow && ds < o.r * 0.72 ? 1 : 0; // standing on / in it: the part under its feet
      return segSeg(SM.add(p, SM.mul(d, t0)), SM.add(p, SM.mul(d, t1)), o.a, o.b) < o.r ? o.op : 0; }
    if (o.k === 'p') { const pr = o.pr; if (JT.Solid && JT.Solid.depth(p, pr) > 0) return 0;
      let ta = t0, tb = t1; if (d[1] > 1e-6) { ta = Math.max(ta, (pr.y0 - p[1]) / d[1]); tb = Math.min(tb, (pr.y1 + o.dm - p[1]) / d[1]); } else if (p[1] < pr.y0 || p[1] > pr.y1) return 0; if (ta >= tb) return 0;
      if (!pr.topPoly && !o.dm) return JT.G.segHitsPoly([p[0] + d[0] * ta, p[2] + d[2] * ta], [p[0] + d[0] * tb, p[2] + d[2] * tb], pr.poly) ? 1 : 0;
      const N = 10; for (let i = 0; i <= N; i++) { const t = ta + (tb - ta) * i / N; if (JT.Solid.depth([p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t], pr) > 0) return 1; } return 0; }
    if (o.k === 'l') { const den = SM.dot(d, o.n); if (Math.abs(den) < 1e-5) return 0; const t = SM.dot(SM.sub(o.o, p), o.n) / den; if (t < Math.max(t0, 0.25) || t > t1) return 0;
      const q = SM.sub(SM.add(p, SM.mul(d, t)), o.o); const u = SM.dot(q, o.a) / o.aa; if (u < 0 || u > 1) return 0; const v = SM.dot(q, o.b) / o.bb2; const w = Math.sqrt(Math.max(0, 1 - (2 * u - 1) * (2 * u - 1))); return Math.abs(v) <= w ? o.op : 0; }
    if (o.k === 's') { // ellipsoid (r, ry, r): scale y and solve
      const sy = o.r / o.ry; const P = [p[0] - o.c[0], (p[1] - o.c[1]) * sy, p[2] - o.c[2]], Dd = [d[0], d[1] * sy, d[2]]; const a = SM.dot(Dd, Dd), b = 2 * SM.dot(P, Dd), c = SM.dot(P, P) - o.r * o.r;
      if (c < 0) return 0; const disc = b * b - 4 * a * c; if (disc < 0) return 0; const t = (-b - Math.sqrt(disc)) / (2 * a); return t > t0 && t < t1 ? o.op : 0; }
    return 0;
  }
  /** Fraction of the view from point p toward a camera in direction d that is not blocked (1 clear .. 0 hidden), and
      (optional) which decor block it: out[id] += opacity. */
  Sight.ray = function (S, p, d, out, skip) {
    let v = 1;
    for (const D of S.list) { if (skip && skip === D.id && D.wall) continue; const r = slab(p, d, D.bb, 0.2, 400); if (!r) continue; let dv = 1;
      for (const o of D.parts) { const rr = slab(p, d, o.bb, r[0], r[1]); if (!rr) continue; const h = hitPart(o, p, d, rr[0], rr[1]); if (h > 0) { dv *= 1 - h; if (dv < 0.02) { dv = 0; break; } } }
      if (dv < 1) { v *= dv; if (out) out[D.id] = Math.max(out[D.id] || 0, 1 - dv); if (v < 0.02 && !out) return 0; } }
    return v;
  };
  // v17: many views of the same points (the camera planner tries dozens a few times a second): per point, keep only the
  // decor whose bounding ball can lie in some view direction at all, with that ball's cone, so most parts cost one dot product
  Sight.prep = function (hab, pts) { const S = Sight.scene(hab); const per = [];
    for (const p of pts) { const L = [];
      for (const D of S.list) { const b = D.bb; const cx = (b[0] + b[3]) / 2 - p[0], cy = (b[1] + b[4]) / 2 - p[1], cz = (b[2] + b[5]) / 2 - p[2]; const r = 0.5 * Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) + 0.2; const dd = Math.hypot(cx, cy, cz);
        if (cy + r < 0) continue; // wholly below the point: views look down on it from above (pitch > 0)
        if (dd <= r) L.push({ D, ux: 0, uy: 0, uz: 0, ca: -2 }); else L.push({ D, ux: cx / dd, uy: cy / dd, uz: cz / dd, ca: Math.sqrt(Math.max(0, 1 - (r / dd) * (r / dd))) }); }
      per.push({ p, L }); }
    per.S = S; return per; };
  // minV: the caller only cares whether the result beats minV - stop as soon as it cannot (returns that upper bound)
  Sight.viewP = function (per, w, d, out, minV) { let s = 0, ws = 0, wt = 0; for (let i = 0; i < per.length; i++) wt += w ? w[i] : 1; let left = wt;
    for (let i = 0; i < per.length; i++) { const k = w ? w[i] : 1; ws += k; left -= k; const p = per[i].p; let v = 1;
      if (minV != null && wt > 0 && (s + k + left) / wt <= minV) return (s + k + left) / wt;
      if (d[1] <= 0) { s += Sight.ray(per.S, p, d, out) * k; continue; } // looking up from below: the cull above does not hold
      for (const c of per[i].L) { if (c.ux * d[0] + c.uy * d[1] + c.uz * d[2] < c.ca) continue; const D = c.D; const r = slab(p, d, D.bb, 0.2, 400); if (!r) continue; let dv = 1;
        for (const o of D.parts) { const rr = slab(p, d, o.bb, r[0], r[1]); if (!rr) continue; const h = hitPart(o, p, d, rr[0], rr[1]); if (h > 0) { dv *= 1 - h; if (dv < 0.02) { dv = 0; break; } } }
        if (dv < 1) { v *= dv; if (out) out[D.id] = Math.max(out[D.id] || 0, 1 - dv); if (v < 0.02 && !out) { v = 0; break; } if (minV != null && !out && (s + v * k + left) / wt <= minV) return (s + v * k + left) / wt; } }
      s += v * k; }
    return ws ? s / ws : 1; };
  Sight.view = function (hab, pts, w, d, out) { const S = Sight.scene(hab); let s = 0, ws = 0; for (let i = 0; i < pts.length; i++) { const k = w ? w[i] : 1; s += Sight.ray(S, pts[i], d, out) * k; ws += k; } return ws ? s / ws : 1; };
  // v17: views are judged against the real shapes (Sight) - the old coarse boxes let a camera look straight through a dense fern
  const viewVis = (hab, pts, w, yaw, pitch, out) => JT.Sight.view(hab, pts, w, toCam(yaw, pitch), out);

  class FollowCam {
    constructor() { this.st = null; this.pause = 0; this.userYaw = 0; this.userPitch = 0; this.userZoom = 1; this.dir = null; this.id = null; }
    /** Start from whatever the camera currently shows, so entering follow never snaps. */
    reset(cur, spId) {
      this.st = { yaw: cur.yaw, pitch: M.clamp(cur.pitch, PITCH_MIN, PITCH_MAX), s: cur.s, c: cur.c.slice(), vy: 0, vp: 0, vs: 0, vc: [0, 0, 0] };
      this.dir = null; this.tYaw = this.tPitch = this.tS = null; this.tC = null; this.track = false; this.pause = 0; this.userYaw = 0; this.userPitch = 0; this.userZoom = 1; this.id = spId || null; this.lastYaw = cur.yaw; this.fYaw = this.fPitch = this.fVis = null; this.mode = 'norm'; this.huntSide = null; this.ease = 0; this.huntT = 0; this.planT = 0; this.better = 0; this.sizeK = null; this.cineK = null; this.cineOff = false; this.punchT = null; this.pullT = 0; this._sh = null; this._ps = null; this._side = 0; this._fit = null; this.hold = 0;
    }
    /** User dragged (radians). Pauses auto-rotation. */
    orbit(dyaw, dpitch) { if (!this.st) return; this.st.yaw = M.wrapAngle(this.st.yaw + dyaw); if (this.wallTank) this.st.yaw = M.clamp(this.st.yaw, -WALL_ARC, WALL_ARC); this.st.pitch = M.clamp(this.st.pitch + dpitch, PITCH_MIN, PITCH_MAX); this.st.vy = 0; this.st.vp = 0; this.pause = PAUSE; }
    zoom(f) { this.userZoom = M.clamp(this.userZoom * f, 0.45, 2.6); this.pause = PAUSE; this.cineOff = true; } // a pinch during a tense moment turns the automatic zoom off for that moment
    get paused() { return this.pause > 0; }

    /** Wall tanks: a view that would sit behind the wall is folded round to the front three-quarter view on the same side
        (straight behind -> about 30° off the front, so its face shows instead of its back). Sticky near the flip point. */
    foldYaw(y) {
      y = M.wrapAngle(y); const a = Math.abs(y); if (a <= WALL_ARC) { this._fold = null; return y; }
      let sg = Math.sign(y) || 1; if (a > 2.5 && this._fold) sg = this._fold; this._fold = sg;
      return sg * Math.min(WALL_ARC, Math.PI - a + 0.5);
    }
    /** Desired view direction (unit vector from the jumper toward the camera) and what counts as a good view.
        Low (about 22° down) from the front three-quarter side so the eyes and upper body show; always on the side of its
        back, never under its belly. Upside down under a leaf: low and side-on (face and profile). */
    desired(hab, sp) {
      const fr = JT.Nav.supFrame(hab, sp.sup); const n = (sp.sup && sp.sup.k === 'air') ? [0, 1, 0] : fr.n;
      const f = sp.fwd && M.finite3(sp.fwd) ? M.norm(sp.fwd) : [1, 0, 0];
      const wall = Math.abs(n[1]) < 0.5, under = n[1] < -0.3;
      const fh = Math.hypot(f[0], f[2]) > 0.2 ? M.norm([f[0], 0, f[2]]) : null;
      const curH = [-Math.sin(this.st.yaw), 0, -Math.cos(this.st.yaw)]; // horizontal direction the camera sits in now
      const sideOf = (h) => { const sv = [-h[2], 0, h[0]]; const dd = M.dot(sv, curH); if (Math.abs(dd) > 0.25 || !this._side) this._side = dd >= 0 ? 1 : -1; return this._side; };
      const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[2] * s, 0, v[0] * s + v[2] * c]; };
      const dorsal = (dd) => M.dot(dd, n);
      let d, bestDorsal = 1;
      if (under || wall) { // stems, walls, undersides: search round for the angle that shows most of its back, leaning toward its face
        const cy = this.st.yaw; let best = null; const pts = under ? [UNDER_PITCH, 0.24, 0.34] : [0.3, 0.45, 0.6];
        for (let i = 0; i < 16; i++) { const y = M.wrapAngle(cy + i * Math.PI / 8); if (this.wallTank && Math.abs(y) > WALL_ARC + 1e-6) continue;
          for (const p of pts) { const tc = toCam(y, p); const hl = Math.hypot(tc[0], tc[2]) || 1; const fc = fh ? (tc[0] * fh[0] + tc[2] * fh[2]) / hl : 0;
            const sc = 2 * dorsal(tc) + 0.5 * fc + 0.35 * Math.cos(y - cy) - (under ? 0.6 * p : 0.3 * Math.abs(p - 0.45)); if (!best || sc > best.sc) best = { sc, tc, dd: dorsal(tc) }; } }
        d = best ? best.tc : [0, 1, 0]; bestDorsal = best ? best.dd : 0;
      } else {
        const h0 = fh || curH; const h = fh ? rotY(fh, sideOf(fh) * FACE_ANG) : curH; void h0;
        let p = BASE_PITCH; d = [h[0] * Math.cos(p), Math.sin(p), h[2] * Math.cos(p)];
        while (dorsal(d) < 0.3 && p < 1.2) { p += 0.05; d = [h[0] * Math.cos(p), Math.sin(p), h[2] * Math.cos(p)]; } // sloping leaf: rise until its back shows
      }
      d = M.norm(d);
      /** Is a camera at (yaw, pitch) still a good view (face / side / upper body showing, not the belly)? */
      const accept = (yaw, pitch) => { const tc = toCam(yaw, pitch); const hc = [tc[0], 0, tc[2]]; const hl = Math.hypot(hc[0], hc[2]) || 1;
        if (under || wall) return dorsal(tc) >= bestDorsal - 0.3 && (under ? pitch <= 0.45 : dorsal(tc) >= 0.2);
        if (dorsal(tc) < 0.2) return false; void hl;
        return !fh || M.dot(hc, fh) / hl > -0.26; }; // anywhere from in front round to just behind its side
      return { d, wall, n, under, fh, accept, dorsal };
    }

    /** Hunt two-shot: the camera sits in front of the jumper, a little to one side, with the prey in the foreground.
        Returns null when there is no landed, nearby target to frame (flying / far prey keep the normal view). */
    huntShot(hab, sp, des, L) {
      const H = JT.SpiderAI.HUNT; const st = sp.state;
      const keep = this.mode === 'hunt' && (st === 'pounce' || (st === 'crouch'));
      if (!(H && H.has(st)) && !keep) return null;
      if (des.n[1] < -0.3) return null; // hanging under something: the normal "see its back" view is better
      const e = JT.SpiderAI.targetEnt(hab, sp); if (!e || !e.pos || !M.finite3(e.pos)) return keep ? { e: null, keep: true } : null;
      const away = e.sup && e.sup.k === 'air' && !(st === 'pounce');
      const dist = M.dist(e.pos, sp.pos); if (!keep && (away || dist > 70)) return null;
      const head = M.add(sp.pos, M.mul(des.n, L * 0.3)); const prey = [e.pos[0], e.pos[1] + 0.6, e.pos[2]];
      let u = [e.pos[0] - sp.pos[0], 0, e.pos[2] - sp.pos[2]];
      if (Math.hypot(u[0], u[2]) < 1) { const f = sp.fwd || [1, 0, 0]; u = [f[0], 0, f[2]]; }
      u = Math.hypot(u[0], u[2]) > 1e-6 ? M.norm(u) : [1, 0, 0];
      const mk = (side) => {
        if (des.wall) { // on a wall: side-on two-shot, still facing the wall
          const sv = M.norm([-des.n[2], 0, des.n[0]]); return M.norm(M.add(M.add(M.mul(des.n, 1), M.mul(sv, 0.75 * side)), [0, 0.3, 0]));
        }
        const a = 0.6 * side, ca = Math.cos(a), sa = Math.sin(a); const ru = [u[0] * ca - u[2] * sa, 0, u[0] * sa + u[2] * ca];
        const p = HUNT_PITCH, cp = Math.cos(p); return [ru[0] * cp, Math.sin(p), ru[2] * cp];
      };
      const tid = sp.target ? sp.target.kind + sp.target.id : null;
      if (this.huntSide == null || this.huntTid !== tid) {
        // pick the clearer side once per target (sticky); ties go to the side nearer the current view (less swing)
        const pts = [head, prey], cur = toCam(this.st.yaw, this.st.pitch);
        const sc = (side) => { const d = mk(side); const yaw = Math.atan2(-d[0], -d[2]), pitch = Math.asin(M.clamp(d[1], -1, 1)); return viewVis(hab, pts, null, yaw, pitch) * 2 + M.dot(d, cur) * 0.3; };
        this.huntSide = sc(1) >= sc(-1) ? 1 : -1; this.huntTid = tid;
      }
      return { e, head, prey, d: mk(this.huntSide), dist };
    }

    /** Pick the clearest good view near the preferred one (cheap ray casts against coarse decor shapes, a few times a
        second). Views onto the belly are never taken; views showing the face score higher. Blocked views first swing
        round at the same height, and only then rise a little. */
    /** v17: points on the jumper the camera must see: head and eyes count most, then abdomen and both flanks (legs). */
    bodyPts(hab, sp, des, L) {
      const f0 = sp.fwd && M.finite3(sp.fwd) ? M.norm(sp.fwd) : [1, 0, 0]; const n = des.n; let f = M.sub(f0, M.mul(n, M.dot(f0, n))); f = M.len(f) > 1e-3 ? M.norm(f) : (Math.abs(n[1]) < 0.9 ? M.norm(M.cross(n, [0, 1, 0])) : [1, 0, 0]);
      const s = M.norm(M.cross(n, f)); let p = sp.pos;
      if (JT.Draw && JT.Draw.frame && sp.sup && sp.sup.k !== 'air') { try { const fr = JT.Draw.frame(hab, sp, 0.05); if (M.finite3(fr.p)) p = fr.p; } catch (e) { /* drawing helpers missing (tests) */ } }
      const at = (a, b, c) => M.add(M.add(M.add(p, M.mul(n, a * L)), M.mul(f, b * L)), M.mul(s, c * L));
      return { pts: [at(0.32, 0.12, 0), at(0.3, 0.36, 0), at(0.2, -0.36, 0), at(0.12, 0, 0.36), at(0.12, 0, -0.36)], w: [2, 1.2, 1, 0.5, 0.5], c: at(0.25, 0, 0), f, p };
    }
    /** Pick the clearest good view near the preferred one (rays against the decor's real shapes, a few times a second).
        Views onto the belly are never taken; views showing the face score higher. Candidates are tried nearest-first
        (15 degree steps all the way round, three heights, higher still when everything near is blocked). */
    plan(hab, sp, des, L, base, hunt, fresh) {
      const bp = this.bodyPts(hab, sp, des, L); const pts = hunt && hunt.prey ? bp.pts.concat([hunt.prey]) : bp.pts, w = hunt && hunt.prey ? bp.w.concat([2]) : bp.w;
      const prevY = this.fYaw != null ? this.fYaw : base.yaw;
      const good = (y, p) => hunt ? (des.under || des.dorsal(toCam(y, p)) >= 0.15) : des.accept(y, p);
      const face = (y, p) => { if (!des.fh || des.wall) return 0; const tc = toCam(y, p); const hl = Math.hypot(tc[0], tc[2]) || 1; return (tc[0] * des.fh[0] + tc[2] * des.fh[2]) / hl; };
      const score = (y, p, vis) => vis * 3 - 0.5 * Math.abs(M.wrapAngle(y - base.yaw)) / Math.PI - 1.1 * Math.abs(p - base.pitch) - 0.25 * Math.abs(M.wrapAngle(y - prevY)) / Math.PI + (hunt ? 0 : 0.3 * Math.max(0, face(y, p)));
      if (!JT.Sight.scene(hab).list.length) { this.fYaw = base.yaw; this.fPitch = base.pitch; this.fVis = 1; this.better = 0; return; }
      const PR = JT.Sight.prep(hab, pts); const visAt = (y, p, minV) => JT.Sight.viewP(PR, w, toCam(y, p), null, minV);
      const cv0 = this.fYaw != null ? visAt(this.fYaw, this.fPitch) : 1;
      const pitches = des.wall ? [base.pitch, Math.min(0.72, base.pitch + 0.2)] : des.under ? [base.pitch, 0.3] : [base.pitch, Math.min(0.62, base.pitch + 0.16), Math.min(0.86, base.pitch + 0.36)];
      const K = hunt ? 6 : 12; let best = null; const cands = [];
      for (let k = 0; k <= K; k++) for (const sg of k ? [1, -1] : [1]) { if (hunt && sg < 0 && k === 0) continue; for (const p of pitches) cands.push([M.wrapAngle(base.yaw + sg * k * Math.PI / 12), p, k]); }
      let more = false;
      for (let ci = 0; ci < cands.length; ci++) { const [y, p, k] = cands[ci];
        if (ci === cands.length - 1 && !more && !des.under && (!best || best.vis < 0.5)) { more = true; for (let k2 = 0; k2 <= K; k2 += 2) for (const sg of k2 ? [1, -1] : [1]) cands.push([M.wrapAngle(base.yaw + sg * k2 * Math.PI / 12), 0.94, k2]); } // nothing near looked clear so far: also try from high above
        if (this.wallTank && Math.abs(y) > WALL_ARC + 1e-6) continue; if (!good(y, p)) continue;
        if (best && score(y, p, 1) <= best.sc) continue; // even a perfectly clear view here could not win
        const vis = visAt(y, p, best ? (best.sc - score(y, p, 0)) / 3 : null); const sc = score(y, p, vis);
        if (!best || sc > best.sc) best = { y, p, vis, sc };
        if (k === 0 && p === base.pitch && vis > 0.97) break; // preferred view is clear: done
      }
      if (!best) { this.fYaw = base.yaw; this.fPitch = base.pitch; this.fVis = 0.5; this.better = 0; return; }
      if (fresh || this.fYaw == null) { this.fYaw = best.y; this.fPitch = best.p; this.fVis = best.vis; this.better = 0; return; }
      const cv = cv0; let cs = score(this.fYaw, this.fPitch, cv); this.fVis = cv;
      if (!good(this.fYaw, this.fPitch)) cs -= 3; // the jumper turned: the old angle now shows its belly / rear
      if (best.sc > cs + 0.25) { this.better = (this.better || 0) + PLAN_DT; if (this.better >= (cv < 0.6 || cs < -1 ? 0.2 : 0.7)) { this.fYaw = best.y; this.fPitch = best.p; this.fVis = best.vis; this.better = 0; } }
      else this.better = 0;
    }

    /** Cinematic zoom factor for tense moments (pure function of the jumper's state, smoothed). */
    cinema(sp, hunt, dt) {
      const s = sp.state; if (this.cineOff && !TENSE.has(s)) this.cineOff = false;
      const sh = (sp.stats && sp.stats.shaken) || 0; if (this._sh != null && sh > this._sh) this.pullT = 2.2; this._sh = sh;
      if (s === 'subdue' && this._ps === 'pounce') this.punchT = 0; this._ps = s;
      let k = 1, rate = 0.45;
      if (hunt) { if (s === 'stalk' || s === 'creep') { k = 1 + 0.2 * Math.min(1, this.huntT / 5); rate = 0.5; } else if (s === 'crouch') { k = 1.3; rate = 1.3; } else if (s === 'pounce') { k = this.cineK || 1; rate = 0; } }
      else if (s === 'subdue') { k = 1.4 - 0.2 * Math.min(1, sp._strug || 0); rate = 0.9; }
      else if (s === 'secure') { k = 1.22; rate = 0.5; } else if (s === 'feed') { k = 1.12; rate = 0.35; }
      if (this.pullT > 0) { this.pullT -= dt; k = 0.84; rate = 1.4; }
      if (this.cineOff) { k = 1; rate = 0.6; }
      this.cineK = this.cineK == null ? 1 : this.cineK + (k - this.cineK) * Math.min(1, dt * rate);
      let out = this.cineK;
      if (this.punchT != null) { const t = this.punchT += dt; const e = M.smooth(M.clamp(t / 0.25, 0, 1)) * Math.exp(-Math.max(0, t - 0.25) * 0.8); out *= 1 + 0.1 * e; if (t > 5) this.punchT = null; }
      return out;
    }

    step(hab, sp, dt, s0) {
      if (!this.st) return null; dt = Math.min(dt, 0.1);
      const st = this.st; const L = JT.SpiderAI.len ? JT.SpiderAI.len(sp) : 6;
      this.wallTank = hab.decor.some(d => (JT.DECOR_BY_ID[d.type] || {}).arche === 'backwall');
      const des = this.desired(hab, sp);
      const hunt = this.huntShot(hab, sp, des, L);
      const mode = hunt ? 'hunt' : 'norm';
      if (mode !== this.mode) {
        if (mode === 'hunt') { this.dir = hunt.d || this.dir; this.tYaw = null; this.huntT = 0; } // noticed prey: swing round now (slowly)
        else { this.ease = 3; this.huntSide = null; this.hold = 0; } // after the hunt: ease back calmly
        this.mode = mode;
      }
      const freeze = hunt && (sp.state === 'crouch' || sp.state === 'pounce'); // hold perfectly still for the crouch and the leap
      if (hunt) this.huntT += dt; if (this.ease > 0) this.ease -= dt;
      const air = sp._air;
      // zoom: a little wider than before, closer on small jumpers and wider on big ones (eased as it grows)
      const sk = M.clamp(Math.pow(Math.max(0.5, L) / 8, -0.35), 0.75, 1.6); this.sizeK = this.sizeK == null ? sk : this.sizeK + (sk - this.sizeK) * Math.min(1, dt * 0.35);
      const z0 = s0 * BASE_ZOOM, zb = z0 * this.sizeK; const cine = this.cinema(sp, hunt, dt);
      let c = null, tS, zoomMul = des.wall ? 0.9 : 1;
      if (!freeze) {
        // low-pass the desired direction so small turns and wobbles do not move the camera
        const want = hunt ? hunt.d : des.d; const badNow = this.tYaw != null && !hunt && !des.accept(this.tYaw, this.tPitch);
        this.dir = this.dir ? M.norm(M.lerp3(this.dir, want, Math.min(1, dt * (badNow ? 4 : 0.9)))) : want;
        const d = this.dir; const hm = Math.hypot(d[0], d[2]);
        let tYaw = hm > 0.15 ? Math.atan2(-d[0], -d[2]) : (this.lastYaw != null ? this.lastYaw : st.yaw);
        this.lastYaw = tYaw;
        let tPitch = M.clamp(Math.asin(M.clamp(d[1], -1, 1)), PITCH_MIN, PITCH_MAX);
        if (des.wall) tPitch = M.clamp(tPitch, 0.3, 0.7); // never let the wall fill the frame
        if (hunt && (sp.state === 'stalk' || sp.state === 'creep')) tPitch = Math.max(0.26, tPitch - 0.06); // sink a little with the stalk
        let wallFace = false;
        if (this.wallTank) {
          if (!hunt && des.wall && des.n[2] < -0.7) {
            // on the back wall's face: stay in front, a little to the side it is facing / heading, at about its height
            const fx = sp.fwd ? sp.fwd[0] : 0; if (Math.abs(fx) > 0.35 || this.wSide == null) this.wSide = fx > 0 ? -1 : 1;
            tYaw = this.wSide * 0.36; tPitch = M.lerp(0.5, 0.3, M.clamp(sp.pos[1] / Math.max(1, hab.dims.h), 0, 1)); wallFace = true;
          } else tYaw = this.foldYaw(tYaw);
        }
        // the current view still shows the face / side and not the belly: keep it (no swinging with every turn)
        if (!hunt && !wallFace && this.tYaw != null && !des.under && des.accept(this.tYaw, this.tPitch) && Math.abs(this.tPitch - tPitch) < 0.12) { tYaw = this.tYaw; tPitch = this.tPitch; }
        // dead-bands: a new viewing direction is adopted only once the jumper has held it for a moment
        const off = this.tYaw == null || Math.abs(M.wrapAngle(tYaw - this.tYaw)) > 0.5 || Math.abs(tPitch - this.tPitch) > 0.1;
        this.hold = off ? (this.hold || 0) + dt : 0; let fresh = false;
        const bad = this.tYaw != null && !hunt && !des.accept(this.tYaw, this.tPitch);
        if (this.tYaw == null || this.hold > (air ? 0.25 : bad ? 0.15 : hunt ? 1.0 : 1.4)) { this.tYaw = tYaw; this.tPitch = tPitch; this.hold = 0; fresh = true; }
        // line of sight: step round decor that would hide the jumper (or its prey)
        this.planT = (this.planT || 0) - dt;
        if (fresh || this.planT <= 0) { this.planT = PLAN_DT; this.plan(hab, sp, des, L, { yaw: this.tYaw, pitch: this.tPitch }, hunt, fresh); }
        if (this.fVis != null && this.fVis < 0.45) zoomMul *= 1.1; // nothing clear: come in a little closer (the jumper shows through the decor in front)
        // target point: the upper body, leading toward the landing while airborne
        c = M.add(sp.pos, M.mul(des.n, L * 0.3));
        if (air && air.to && M.finite3(air.to)) { c = M.lerp3(c, air.to, 0.35); zoomMul *= 0.82; }
        tS = zb * zoomMul * cine; this._fit = null;
        if (hunt && hunt.prey) {
          // two-shot: weighted to the jumper, zoomed to fit both, slow push-in while it stalks
          c = M.lerp3(hunt.head, hunt.prey, 0.35);
          const sep = M.sub(hunt.prey, hunt.head), tc = toCam(this.fYaw, this.fPitch), R = [Math.cos(this.fYaw), 0, -Math.sin(this.fYaw)];
          const sx = Math.abs(M.dot(sep, R)), along = M.dot(sep, tc); const sy = M.len(M.sub(M.sub(sep, M.mul(tc, along)), M.mul(R, M.dot(sep, R))));
          this._fit = z0 * 1.25 * 23.5 / Math.max(1, 0.65 * Math.max(sx, sy * 1.3));
          tS = Math.max(zb * 0.5, Math.min(zb * cine * (this.fVis < 0.45 ? 1.2 : 1), this._fit));
        }
        this._lastS = tS;
      } else tS = Math.min(zb * cine, this._fit || 1e9); // crouch: the final slow push-in; the leap: held
      tS *= this.userZoom;
      if (c) { const dm = hab.dims; c = [M.clamp(c[0], 4, dm.w - 4), M.clamp(c[1], 0, dm.h), M.clamp(c[2], 4, dm.d - 4)]; }
      this.tS = tS;
      let tYaw = this.fYaw != null ? this.fYaw : this.tYaw, tPitch = this.fPitch != null ? this.fPitch : this.tPitch;
      if ((this.tvYaw || this.tvPitch) && !hunt && !des.wall && tYaw != null) { // v17 Ambient TV: slow sway round the planned view, only while it stays a good one
        let y2 = M.wrapAngle(tYaw + (this.tvYaw || 0)); if (this.wallTank) y2 = M.clamp(y2, -WALL_ARC, WALL_ARC); const p2 = M.clamp(tPitch + (this.tvPitch || 0), PITCH_MIN, PITCH_MAX);
        if (des.accept(y2, p2)) { tYaw = y2; tPitch = p2; } }
      // rotation: soft springs with limited acceleration and speed, so every move eases in and out
      const urgent = !hunt && !des.accept(st.yaw, st.pitch); const ys = (hunt ? 0.8 : this.ease > 0 ? 0.65 : YAW_SPEED) * (urgent ? 1.6 : 1), om = urgent ? 2.2 : hunt || this.ease > 0 ? 1.25 : 1.5; // seeing its belly: turn round promptly (still eased)
      if (this.pause > 0) { this.pause -= dt; st.vy *= 0.8; st.vp *= 0.8; }
      else {
        const diff = this.wallTank ? M.wrapAngle(tYaw) - M.wrapAngle(st.yaw) : M.wrapAngle(tYaw - st.yaw); // shortest way round (wall tanks: always round the front)
        let v = spring(0, st.vy, diff, om, dt)[1]; v = ys * Math.tanh(v / ys); const A = ys * 1.8; st.vy += M.clamp(v - st.vy, -A * dt, A * dt);
        st.yaw = M.wrapAngle(st.yaw + st.vy * dt);
        let vp = spring(st.pitch, st.vp, tPitch, urgent ? 2.2 : hunt ? 1.4 : 1.6, dt)[1]; vp = 0.7 * Math.tanh(vp / 0.7); st.vp += M.clamp(vp - st.vp, -1.2 * dt, 1.2 * dt);
        st.pitch = M.clamp(st.pitch + st.vp * dt, PITCH_MIN, PITCH_MAX);
      }
      // zoom in log space (equal feel zooming in or out); the bite punch-in is quicker
      { const punch = this.punchT != null && this.punchT < 0.6; const ls = Math.log(st.s), lt = Math.log(tS); const lv = st.vs / Math.max(1e-6, st.s);
        let v = spring(ls, lv, lt, punch ? 7 : freeze ? 2.2 : hunt ? 1.5 : 1.7, dt)[1]; const vmax = punch ? 1.5 : 0.6; v = vmax * Math.tanh(v / vmax); const A = punch ? 12 : 1.6;
        const nv = lv + M.clamp(v - lv, -A * dt, A * dt); st.s = Math.exp(ls + nv * dt); st.vs = nv * st.s; }
      // settle exactly once close enough
      if (Math.abs(M.wrapAngle(tYaw - st.yaw)) < 0.006 && Math.abs(st.vy) < 0.03) { st.yaw = tYaw; st.vy = 0; }
      if (Math.abs(tPitch - st.pitch) < 0.004 && Math.abs(st.vp) < 0.03 && this.pause <= 0) { st.pitch = tPitch; st.vp = 0; }
      if (Math.abs(tS - st.s) < tS * 0.003 && Math.abs(st.vs) < tS * 0.015) { st.s = tS; st.vs = 0; }
      // lazy framing on a soft leash: the camera stays put while the jumper potters about near the middle of the frame,
      // and glides along (no lurch) once it wanders toward the edge; a resting camera lets the renderer reuse its picture
      const thr = 10 * s0 / Math.max(1e-3, st.s);
      if (c) {
        if (!this.tC || air) this.tC = c.slice();
        else { const off = M.sub(c, this.tC), dl = M.len(off), inner = thr * 0.45;
          if (dl > inner) this.tC = M.add(this.tC, M.mul(off, (dl - inner) / dl * Math.min(1, dt * 3)));
          else if (dl > thr * 0.12 && !sp._moving) this.tC = M.add(this.tC, M.mul(off, Math.min(1, dt * 0.35))); // drifts back to centre once it settles
        }
      }
      if (freeze && air && air.to && M.finite3(air.to)) this.tC = M.lerp3(M.add(sp.pos, M.mul(des.n, L * 0.3)), air.to, 0.35); // the leap: lead toward the landing, no rotation
      const tc = this.tC || st.c; let r;
      for (let i = 0; i < 3; i++) { r = spring(st.c[i], st.vc[i], tc[i], air ? 3.6 : 2.4, dt); st.c[i] = r[0]; st.vc[i] = r[1]; }
      if (M.dist(st.c, tc) < 0.02 && Math.hypot(st.vc[0], st.vc[1], st.vc[2]) < 0.05) { st.c = tc.slice(); st.vc = [0, 0, 0]; }
      if (!M.finite3(st.c) || !isFinite(st.yaw) || !isFinite(st.pitch) || !isFinite(st.s)) { st.c = (c || sp.pos).slice(); st.yaw = tYaw || 0; st.pitch = tPitch || 0.6; st.s = tS || s0; st.vy = st.vp = st.vs = 0; st.vc = [0, 0, 0]; }
      return st;
    }
  }
  FollowCam.visibility = (hab, pts, yaw, pitch) => viewVis(hab, pts, null, yaw, pitch); FollowCam.visibilityOld = (hab, pts, yaw, pitch) => visibility(occluders(hab), pts, yaw, pitch); FollowCam.toCam = toCam;
  FollowCam.PITCH_MIN = PITCH_MIN; FollowCam.PITCH_MAX = PITCH_MAX; FollowCam.PAUSE = PAUSE;
  JT.FollowCam = FollowCam;
})(typeof window !== 'undefined' ? window : globalThis);
