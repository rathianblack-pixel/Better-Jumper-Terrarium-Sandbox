/* v32 procedural motion layer (shared by both games, visual only — the simulation is untouched).
   Sits between the AI and the drawers:
   - planted feet: every foot keeps a world position while the body moves over it, lifts when it strays too far from
     its rest spot, and swings in an arc to a spot a little ahead (lead by the body's velocity). Neighbouring legs never
     lift together (spider: alternating tetrapod; mantis: diagonal pairs). Turning in place = a ripple of small steps.
   - two-bone leg IK: constant segment lengths, the drawer's knee placement is kept only as the bend direction.
   - staged turning: the body heading lags the AI heading — jumpers snap round in quick pivots (saccades), mantises turn
     slowly; the head keeps pointing where the AI wants (head leads, body follows).
   - body + abdomen springs: dip when a foot lands, squash on landing from a jump, abdomen lags in turns and twitches
     while stalking, an occasional front-leg tap when idle.
   A rig only exists for live critters drawn with a clock (not thumbnails, ghosts, shed skins or field-guide cards). */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M; if (!JT || !M) return;
  const add = M.add, sub = M.sub, mul = M.mul, dot = M.dot, len = M.len;
  const ease = (k) => k * k * (3 - 2 * k);
  const G = JT.Gait = { on: true };
  const flat = (v, n) => sub(v, mul(n, dot(v, n)));
  const KIND = {
    spider: { stride: 0.2, sw: [0.07, 0.16], lift: 1, legs: 8, turn: 'snap' },
    mantis: { stride: 0.16, sw: [0.16, 0.36], lift: 0.8, legs: 4, turn: 'smooth' },
  };
  G.KIND = KIND;
  function resetLegs(R) { R.legs = {}; R.swing = 0; }
  /** Per-frame rig for a critter. kind: 'spider' | 'mantis'. Returns null when this draw must not use (or advance) it. */
  G.rig = function (sp, o, fr, L, kind) {
    if (!G.on || !sp || sp.id == null || o.thumb || o.ghost || o.time == null || !fr || !M.finite3(fr.p)) return null;
    if (root.JT_NO_GAIT) return null;
    const t = o.time; let R = sp._rig;
    if (!R || R.kind !== kind) R = sp._rig = { kind, K: KIND[kind], L, t, legs: {}, swing: 0, p: fr.p.slice(), v: [0, 0, 0], vf: null, turning: false, still: 0,
      bob: 0, bv: 0, ay: 0, ayv: 0, ap: 0, apv: 0, air: !!o.airborne, yawR: 0, twT: 2 + Math.random() * 3, tap: null, tapT: 3 + Math.random() * 6, settleCD: 0, fid: 0 };
    let dt = t - R.t;
    if (dt < -1e-6 || dt > 0.5 || Math.abs(L - R.L) > R.L * 0.25) { resetLegs(R); R.vf = null; R.v = [0, 0, 0]; R.p = fr.p.slice(); R.t = t; R.L = L; dt = 0; }
    if (dt <= 1e-6) { // a second draw in the same frame (reflection, after-image...): only the main body may reuse the rig
      R.dt = 0; return M.dist(fr.p, R.p) < L * 0.02 ? R : null;
    }
    dt = Math.min(dt, 0.1); R.dt = dt; R.t = t; R.L = L; R.fid++;
    const dp = sub(fr.p, R.p);
    if (len(dp) > L * 2) { resetLegs(R); R.vf = null; R.v = [0, 0, 0]; }
    else R.v = M.lerp3(R.v, mul(dp, 1 / dt), Math.min(1, dt * 12));
    R.p = fr.p.slice();
    const spd = len(R.v); R.still = spd < L * 0.2 ? R.still + dt : 0; R.spd = spd;
    // landing from a jump / fall: a squash that the legs absorb
    const air = !!o.airborne; if (R.air && !air) { R.bv -= L * (kind === 'spider' ? 1.6 : 0.9); R.apv -= 2.2; R.land = 1; } R.air = air;
    // springs: body height (bob) and abdomen yaw/pitch lag
    const sk = kind === 'spider' ? 260 : 120, sc = kind === 'spider' ? 22 : 15;
    // v32.1: springs are sub-stepped (<= 1/120 s). One big Euler step per frame went unstable when frames were slow
    // (or a sprite was only repainted every other frame) and the body bounced up and down on the spot.
    const ayT = M.clamp(-R.yawR * (kind === 'spider' ? 0.05 : 0.09), -0.4, 0.4);
    const nS = Math.min(16, Math.ceil(dt / (1 / 120))), h = dt / nS;
    for (let i = 0; i < nS; i++) {
      R.bv += (-sk * R.bob - sc * R.bv) * h; R.bob = M.clamp(R.bob + R.bv * h, -L * 0.06, L * 0.03);
      R.ayv += (90 * (ayT - R.ay) - 11 * R.ayv) * h; R.ay = M.clamp(R.ay + R.ayv * h, -0.5, 0.5);
      R.apv += (-140 * R.ap - 12 * R.apv) * h; R.ap = M.clamp(R.ap + R.apv * h, -0.35, 0.35);
    }
    if (Math.abs(R.bob) < L * 1e-4 && Math.abs(R.bv) < L * 1e-3) { R.bob = 0; R.bv = 0; }
    R.land = Math.max(0, (R.land || 0) - dt * 3);
    R.settleCD = Math.max(0, R.settleCD - dt);
    // stalking jumpers flick the abdomen now and then (little vertical twitches)
    const hunt = /^(stalk|creep|crouch|display|assess|lunge|watch|fingerWatch)$/.test(sp.state || '');
    if (kind === 'spider' && hunt) { R.twT -= dt; if (R.twT <= 0) { R.twT = 0.6 + Math.random() * 2.2; R.apv += (Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 2); } }
    // idle: now and then one front leg lifts and taps the surface (tasting / testing the footing)
    if (R.tap) { R.tap.k += dt / R.tap.T; if (R.tap.k >= 1) R.tap = null; }
    else if (R.still > 1.2 && !air && /^(idle|look|watch|rest|bask|scan|alert|wait)$/.test(sp.state || 'idle')) {
      R.tapT -= dt; if (R.tapT <= 0) { R.tapT = 4 + Math.random() * 9; R.tap = { lk: (Math.random() < 0.5 ? 0 : 1) + (kind === 'spider' && Math.random() < 0.3 ? 2 : 0), k: 0, T: kind === 'spider' ? 0.55 : 0.9, n: kind === 'spider' ? 2 + (Math.random() * 2 | 0) : 1 }; }
    }
    return R;
  };
  /** Idle tap of one leg: 0..1 lift and how free it is from the ground. */
  G.tapOf = function (R, lk) {
    if (!R || !R.tap || R.tap.lk !== lk) return 0; const k = R.tap.k; const env = Math.sin(Math.PI * M.clamp(k, 0, 1));
    return env * (0.55 + 0.45 * Math.abs(Math.sin(k * Math.PI * R.tap.n)));
  };
  /** Visual heading. enable=false hands the AI heading straight through. Returns { f, s, a } (a: visual minus AI yaw, toward s). */
  G.heading = function (R, fr, enable) {
    const f = fr.f, s = fr.s, n = fr.n;
    if (!R) return null;
    if (!enable) { R.vf = f.slice(); R.turning = false; R.yawR = M.lerp(R.yawR, 0, Math.min(1, (R.dt || 0) * 8)); return null; }
    let vf = R.vf ? flat(R.vf, n) : null; if (!vf || len(vf) < 0.3) vf = f.slice(); vf = M.norm(vf);
    let a = Math.atan2(dot(vf, s), dot(vf, f));
    if (R.dt > 0) {
      const dt = R.dt;
      if (R.K.turn === 'snap') { // jumping spider: holds its heading, then pivots in a quick burst
        const thr = R.spd > R.L * 0.6 ? 0.18 : 0.4;
        if (!R.turning && (Math.abs(a) > thr || (Math.abs(a) > 0.035 && R.still > 0.5))) R.turning = true;
        if (R.turning) { const st = Math.min(Math.abs(a), dt * 14); a -= Math.sign(a) * st; if (Math.abs(a) < 0.012) { a = 0; R.turning = false; } }
      } else { // mantis: deliberate, eased, never faster than ~2 rad/s
        const st = Math.min(Math.abs(a), Math.max(dt * 0.35, Math.min(Math.abs(a) * dt * 3.5, dt * 3))); a -= Math.sign(a) * st;
      }
      a = M.clamp(a, R.K.turn === 'snap' ? -0.75 : -0.5, R.K.turn === 'snap' ? 0.75 : 0.5);
      // world yaw rate of the visual body (for the abdomen lag): change of a plus how the AI heading itself turned
      let aiR = 0; if (R._f) { const pf = M.norm(flat(R._f, n)); aiR = Math.atan2(dot(M.cross(pf, f), n), dot(pf, f)) / dt; }
      R.yawR = M.lerp(R.yawR, M.clamp(aiR + (a - (R._a || 0)) / dt, -12, 12), Math.min(1, dt * 6));
    }
    R._f = f.slice(); R._a = a;
    const ca = Math.cos(a), sa = Math.sin(a);
    const f2 = M.norm(add(mul(f, ca), mul(s, sa))), s2 = M.norm(sub(mul(s, ca), mul(f, sa)));
    R.vf = f2; return { f: f2, s: s2, a };
  };
  /** Planted foot for leg lk. target: where the drawer wants the foot this frame (rest pose + pose offsets, no gait wobble).
      free 0..1: how much the pose owns the foot (raised, reaching, grooming...). Returns the world foot position. */
  G.foot = function (R, lk, target, free, n, mul0) {
    const K = R.K, L = R.L; let g = R.legs[lk];
    if (!g) g = R.legs[lk] = { p: target.slice(), k: -1, out: target.slice(), lift: 0 };
    if (!(R.dt > 0)) return g.out || target;
    if (g.fid === R.fid) return g.out; g.fid = R.fid;
    free = M.clamp(free || 0, 0, 1); const dt = R.dt; g.tg = target; g.fr = free;
    if (free > 0.985) { if (g.k >= 0) R.swing--; g.p = target.slice(); g.k = -1; g.lift = 0; g.out = target.slice(); return g.out; }
    const stride = L * K.stride * (mul0 || 1);
    if (M.dist(g.p, target) > L * 0.9) { g.p = target.slice(); if (g.k >= 0) { g.k = -1; R.swing--; } }
    let lead = flat(mul(R.v, K.sw[1] * 0.9), n); const ll = len(lead); if (ll > stride * 0.75) lead = mul(lead, stride * 0.75 / ll);
    // how fast this foot's rest spot moves (body speed + turning): quicker steps when the body turns on the spot
    const tv = g.ltg ? M.dist(target, g.ltg) / dt : 0; g.ltg = target; g.tv = M.lerp(g.tv || 0, tv, Math.min(1, dt * 10));
    const swingT = M.clamp(0.42 * stride / Math.max(R.spd, g.tv, 1e-3), K.sw[0] * 0.8, K.sw[1]);
    let pos;
    if (g.k >= 0) {
      g.k += dt / g.T; g.to = M.lerp3(g.to, add(target, lead), Math.min(1, dt * 14));
      if (g.k >= 1) { g.p = g.to.slice(); g.k = -1; R.swing--; g.lift = 0; R.bv -= L * (K.legs === 8 ? 0.05 : 0.08); pos = g.p; }
      else { const e = ease(g.k); const h = g.h * Math.pow(Math.sin(Math.PI * Math.min(1, g.k * 1.08)), 0.75); g.lift = h; pos = add(M.lerp3(g.from, g.to, e), mul(n, h)); }
    } else {
      const err = M.dist(g.p, target);
      const nb = [lk ^ 1, lk - 2, lk + 2]; let busy = false; for (const q of nb) { const h = R.legs[q]; if (h && h.k >= 0 && h.k < 0.85) { busy = true; break; } }
      const room = R.swing < K.legs / 2 && !busy;
      const settle = R.still > 0.3 && err > stride * 0.28 && R.settleCD <= 0;
      const keep = K.legs === 8 ? 4 : 2; // never fewer feet than this on the ground
      if (!room && err > stride * 2.1) { if (R.swing <= K.legs - keep) { /* forced step below */ } else g.p = M.lerp3(g.p, target, Math.min(1, dt * 5)); } // no free slot: drag rather than float
      if ((room && (err > stride || settle)) || (err > stride * 2.3 && R.swing < K.legs - keep)) {
        g.from = g.p.slice(); g.to = add(target, lead); g.k = 0; g.T = settle && err <= stride ? K.sw[1] * 1.1 : swingT; R.swing++;
        g.h = M.clamp(err * 0.55, L * 0.03, L * 0.11) * K.lift; if (settle) R.settleCD = K.sw[1] * 0.45;
      }
      pos = g.p;
    }
    g.out = free > 0.005 ? M.lerp3(pos, target, free) : pos.slice(); return g.out;
  };
  /** Is leg lk in the air (0..1 of its step height)? Used by the shadow and contact dots. */
  G.liftOf = (R, lk) => { const g = R && R.legs[lk]; return g && g.k >= 0 ? M.clamp(g.lift / (R.L * 0.06), 0, 1) : 0; };
  /** Two-bone IK: knee for hip -> foot with segment lengths l1, l2, bending toward the hint knee. */
  G.knee = function (hip, foot, l1, l2, hint) {
    const d = sub(foot, hip); const D = len(d); if (D < 1e-6) return hint; const u = mul(d, 1 / D);
    const Dm = Math.min(D, (l1 + l2) * 0.999); const a = (l1 * l1 - l2 * l2 + Dm * Dm) / (2 * Dm); const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    let b = sub(hint, hip); b = sub(b, mul(u, dot(b, u))); const bl = len(b); if (bl < 1e-6) return hint;
    return add(add(hip, mul(u, a)), mul(b, h / bl));
  };
})(typeof window !== 'undefined' ? window : globalThis);
