/* Jumper Terrarium — smart follow camera (pure maths, no DOM, unit-testable).
   Frames the jumper's upper body from the side its back faces: from above at an angle on the floor,
   facing the wall when on a wall, orbiting round to the visible side on branches / under ledges.
   Everything is damped (critically damped springs, capped yaw speed, shortest-way rotation) so the
   view never snaps or flips. During jumps it leads toward the landing and widens slightly.
   User orbit / zoom pauses the automatic rotation for a few idle seconds. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  const PITCH_MIN = 0.2, PITCH_MAX = 0.98, PAUSE = 3.5, YAW_SPEED = 1.15;

  function spring(x, v, target, omega, dt) {
    // critically damped spring step (stable for any dt)
    const f = 1 + 2 * dt * omega, oo = omega * omega, hoo = dt * oo, hhoo = dt * hoo;
    const detInv = 1 / (f + hhoo);
    const nx = (f * x + dt * v + hhoo * target) * detInv;
    const nv = (v + hoo * (target - x)) * detInv;
    return [nx, nv];
  }

  class FollowCam {
    constructor() { this.st = null; this.pause = 0; this.userYaw = 0; this.userPitch = 0; this.userZoom = 1; this.dir = null; this.id = null; }
    /** Start from whatever the camera currently shows, so entering follow never snaps. */
    reset(cur, spId) {
      this.st = { yaw: cur.yaw, pitch: M.clamp(cur.pitch, PITCH_MIN, PITCH_MAX), s: cur.s, c: cur.c.slice(), vy: 0, vp: 0, vs: 0, vc: [0, 0, 0] };
      this.dir = null; this.tYaw = this.tPitch = this.tS = null; this.pause = 0; this.userYaw = 0; this.userPitch = 0; this.userZoom = 1; this.id = spId || null; this.lastYaw = cur.yaw;
    }
    /** User dragged (radians). Pauses auto-rotation. */
    orbit(dyaw, dpitch) { if (!this.st) return; this.st.yaw = M.wrapAngle(this.st.yaw + dyaw); this.st.pitch = M.clamp(this.st.pitch + dpitch, PITCH_MIN, PITCH_MAX); this.st.vy = 0; this.st.vp = 0; this.pause = PAUSE; }
    zoom(f) { this.userZoom = M.clamp(this.userZoom * f, 0.45, 2.6); this.tS = null; this.pause = PAUSE; }
    get paused() { return this.pause > 0; }

    /** Desired view direction (unit vector from the jumper toward the camera) and framing. */
    desired(hab, sp) {
      const fr = JT.Nav.supFrame(hab, sp.sup); const n = (sp.sup && sp.sup.k === 'air') ? [0, 1, 0] : fr.n;
      const f = sp.fwd && M.finite3(sp.fwd) ? M.norm(sp.fwd) : [1, 0, 0];
      // behind and above the back: normal + a little behind the head + a little world-up
      // (only the horizontal part of "behind": on a wall the head points up, and we never want to look from below)
      const back = [-f[0], 0, -f[2]]; const bl = Math.hypot(back[0], back[2]) > 0.2 ? M.norm(back) : [0, 0, 0];
      let d = M.add(M.add(M.mul(n, 0.75), M.mul(bl, 0.95)), [0, 0.18, 0]);
      if (n[1] < -0.3) { // under a ledge / branch: come round to the side its back is visible from
        const side = M.norm([-f[2], 0, f[0]]); d = M.add(M.mul(side, Math.sign(M.dot(side, [-Math.sin(this.st.yaw), 0, -Math.cos(this.st.yaw)])) || 1), [0, 0.45, 0]);
      }
      d = M.norm(d);
      const wall = Math.abs(n[1]) < 0.5;
      return { d, wall, n };
    }

    step(hab, sp, dt, s0) {
      if (!this.st) return null; dt = Math.min(dt, 0.1);
      const st = this.st; const L = JT.SpiderAI.len ? JT.SpiderAI.len(sp) : 6;
      const des = this.desired(hab, sp);
      // low-pass the desired direction so small turns and wobbles do not move the camera
      this.dir = this.dir ? M.norm(M.lerp3(this.dir, des.d, Math.min(1, dt * 0.9))) : des.d;
      const d = this.dir; const hm = Math.hypot(d[0], d[2]);
      let tYaw = hm > 0.15 ? Math.atan2(-d[0], -d[2]) : (this.lastYaw != null ? this.lastYaw : st.yaw);
      this.lastYaw = tYaw;
      let tPitch = M.clamp(Math.asin(M.clamp(d[1], -1, 1)), PITCH_MIN, PITCH_MAX);
      if (des.wall) tPitch = M.clamp(tPitch, 0.3, 0.7); // never let the wall fill the frame
      // target point: the upper body, leading toward the landing while airborne
      let c = M.add(sp.pos, M.mul(des.n, L * 0.3)); let zoomMul = des.wall ? 0.9 : 1;
      const air = sp._air;
      if (air && air.to && M.finite3(air.to)) { c = M.lerp3(c, air.to, 0.35); zoomMul *= 0.82; }
      const dm = hab.dims; c = [M.clamp(c[0], 4, dm.w - 4), M.clamp(c[1], 0, dm.h), M.clamp(c[2], 4, dm.d - 4)];
      let tS = s0 * zoomMul * this.userZoom;
      // dead-bands: small turns and wobbles do not move the camera at all, so it can come fully to rest
      // (a resting camera lets the renderer reuse its cached layers — important on phones)
      // a new viewing direction is adopted only once the jumper has held it for a moment
      const off = this.tYaw == null || Math.abs(M.wrapAngle(tYaw - this.tYaw)) > 0.5 || Math.abs(tPitch - this.tPitch) > 0.12;
      this.hold = off ? (this.hold || 0) + dt : 0;
      if (this.tYaw == null || this.hold > (air ? 0.25 : 1.1)) { this.tYaw = tYaw; this.tPitch = tPitch; this.hold = 0; }
      tYaw = this.tYaw; tPitch = this.tPitch;
      if (this.tS == null || Math.abs(tS / this.tS - 1) > 0.04) this.tS = tS; tS = this.tS;
      // rotation (paused while the user is in control)
      if (this.pause > 0) { this.pause -= dt; st.vy *= 0.8; st.vp *= 0.8; }
      else {
        const diff = M.wrapAngle(tYaw - st.yaw); // shortest way round
        let r = spring(0, st.vy, diff, 1.3, dt); let step = M.clamp(r[0], -YAW_SPEED * dt, YAW_SPEED * dt);
        st.yaw = M.wrapAngle(st.yaw + step); st.vy = M.clamp(r[1], -YAW_SPEED, YAW_SPEED);
        r = spring(st.pitch, st.vp, tPitch, 1.5, dt); st.pitch = M.clamp(r[0], PITCH_MIN, PITCH_MAX); st.vp = r[1];
      }
      let r = spring(st.s, st.vs, tS, 2.2, dt); st.s = r[0]; st.vs = r[1];
      // settle exactly once close enough
      if (Math.abs(M.wrapAngle(tYaw - st.yaw)) < 0.004 && Math.abs(st.vy) < 0.02) { st.yaw = tYaw; st.vy = 0; }
      if (Math.abs(tPitch - st.pitch) < 0.003 && Math.abs(st.vp) < 0.02 && this.pause <= 0) { st.pitch = tPitch; st.vp = 0; }
      if (Math.abs(tS - st.s) < tS * 0.002 && Math.abs(st.vs) < tS * 0.01) { st.s = tS; st.vs = 0; }
      for (let i = 0; i < 3; i++) { r = spring(st.c[i], st.vc[i], c[i], 3.2, dt); st.c[i] = r[0]; st.vc[i] = r[1]; }
      if (!M.finite3(st.c) || !isFinite(st.yaw) || !isFinite(st.pitch) || !isFinite(st.s)) { st.c = c; st.yaw = tYaw; st.pitch = tPitch; st.s = tS; st.vy = st.vp = st.vs = 0; st.vc = [0, 0, 0]; }
      return st;
    }
  }
  FollowCam.PITCH_MIN = PITCH_MIN; FollowCam.PITCH_MAX = PITCH_MAX; FollowCam.PAUSE = PAUSE;
  JT.FollowCam = FollowCam;
})(typeof window !== 'undefined' ? window : globalThis);
