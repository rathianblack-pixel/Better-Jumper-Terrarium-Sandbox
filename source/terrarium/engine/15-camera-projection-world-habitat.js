/* Jumper Terrarium — camera/projection (world habitat space -> screen), resolution independent. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  class View {
    constructor(yaw, pitch, scale, cx, cy, center) {
      this.set(yaw, pitch, scale, cx, cy, center);
    }
    set(yaw, pitch, scale, cx, cy, center) {
      this.yaw = yaw; this.pitch = pitch; this.s = scale; this.cx = cx; this.cy = cy; this.c = center;
      this.cy_ = Math.cos(yaw); this.sy_ = Math.sin(yaw); this.cp = Math.cos(pitch); this.sp = Math.sin(pitch);
      this.toCam = [-this.sy_ * this.cp, this.sp, -this.cy_ * this.cp];
      return this;
    }
    P(p) {
      const dx = p[0] - this.c[0], dy = p[1] - this.c[1], dz = p[2] - this.c[2];
      const xr = dx * this.cy_ - dz * this.sy_, zr = dx * this.sy_ + dz * this.cy_;
      return [this.cx + xr * this.s, this.cy - (dy * this.cp + zr * this.sp) * this.s, zr * this.cp - dy * this.sp];
    }
    J(v) { const xr = v[0] * this.cy_ - v[2] * this.sy_, zr = v[0] * this.sy_ + v[2] * this.cy_; return [xr * this.s, -(v[1] * this.cp + zr * this.sp) * this.s]; }
    depth(p) { const dx = p[0] - this.c[0], dy = p[1] - this.c[1], dz = p[2] - this.c[2]; return (dx * this.sy_ + dz * this.cy_) * this.cp - dy * this.sp; }
    /** Screen point -> world (x,z) on the horizontal plane at height y. */
    unproject(sx, sy, y) {
      const xr = (sx - this.cx) / this.s; const Y = (this.cy - sy) / this.s; const dy = y - this.c[1];
      const zr = (Y - dy * this.cp) / Math.max(0.05, this.sp);
      const dx = xr * this.cy_ + zr * this.sy_, dz = -xr * this.sy_ + zr * this.cy_;
      return [this.c[0] + dx, this.c[2] + dz];
    }
  }
  JT.View = View;
  JT.LIGHT = M.norm([-0.45, 0.85, -0.35]);
  JT.LIGHT0 = JT.LIGHT.slice();
  /* Sky: an unseen sun and moon. Fixed to the tank: the sun rises on the right of the front view (+x), arcs high
     over the front of the tank and sets on the left (-x); after dusk the moon follows the same path, dimmer and cooler.
     JT.LIGHT is updated in place (everything shades from it); JT.SKY carries the time-of-day grade:
       grade  overall colour multiply        key   colour of lit sides     amb  colour of shade sides
       kd     how directional the light is (0 = soft blue hour, 1 = full sun) */
  const SUNRISE = 0.2, SUNSET = 0.82, MOONRISE = 0.86, MOONSET = 0.17;
  const MOON = [0.93, 0.97, 1.07], ONE = [1, 1, 1];
  // [tod, grade, key, amb, kd]  - subtle storybook washes, interpolated smoothly
  const KF = [
    [0.00, [0.32, 0.38, 0.58], MOON, [0.95, 0.97, 1.04], 0.7],
    [0.12, [0.32, 0.38, 0.58], MOON, [0.95, 0.97, 1.04], 0.55],
    [0.185, [0.40, 0.44, 0.62], ONE, [0.96, 0.98, 1.04], 0.04],
    [0.23, [0.64, 0.57, 0.62], [1.07, 0.95, 0.86], [0.93, 0.95, 1.06], 0.5],
    [0.28, [0.90, 0.82, 0.75], [1.07, 0.97, 0.86], [0.95, 0.96, 1.04], 0.85],
    [0.37, [1.00, 0.97, 0.92], [1.04, 1.00, 0.94], [0.97, 0.98, 1.02], 1],
    [0.50, ONE, ONE, ONE, 1],
    [0.63, [1.00, 0.97, 0.90], [1.05, 0.99, 0.91], [0.97, 0.97, 1.01], 1],
    [0.72, [0.97, 0.86, 0.73], [1.09, 0.95, 0.80], [0.93, 0.94, 1.04], 0.9],
    [0.785, [0.72, 0.58, 0.62], [1.08, 0.87, 0.82], [0.91, 0.92, 1.07], 0.45],
    [0.835, [0.42, 0.43, 0.61], ONE, [0.96, 0.97, 1.04], 0.04],
    [0.90, [0.33, 0.385, 0.58], MOON, [0.95, 0.97, 1.04], 0.55],
    [1.00, [0.32, 0.38, 0.58], MOON, [0.95, 0.97, 1.04], 0.7]];
  const sm = (t) => t * t * (3 - 2 * t);
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** Direction toward a body at arc phase s (0 rise on +x, 1 set on -x), peak elevation set by `peak`. */
  function arc(s, peak) {
    const a = Math.PI * M.clamp(s, 0, 1); const y = 0.1 + peak * Math.sin(a);
    return M.norm([Math.cos(a), y, -0.55 * Math.sin(a) - 0.12]);
  }
  const SKY = JT.SKY = { tod: 0.5, grade: [1, 1, 1], key: [1, 1, 1], amb: [1, 1, 1], kd: 1, sun: true };
  /** Sample the sky at time of day t (0..1). Writes JT.LIGHT in place unless noLight. */
  SKY.at = function (t, out) {
    out = out || {}; t = ((t % 1) + 1) % 1; let i = 0; while (i < KF.length - 2 && KF[i + 1][0] <= t) i++;
    const A = KF[i], B = KF[i + 1]; const k = sm(M.clamp((t - A[0]) / (B[0] - A[0]), 0, 1));
    out.tod = t; out.grade = mix3(A[1], B[1], k); out.key = mix3(A[2], B[2], k); out.amb = mix3(A[3], B[3], k); out.kd = A[4] + (B[4] - A[4]) * k;
    const sun = t >= SUNRISE - 0.01 && t <= SUNSET + 0.01; out.sun = sun;
    if (sun) out.dir = arc((t - SUNRISE) / (SUNSET - SUNRISE), 0.95);
    else { const mt = t >= MOONRISE ? t - MOONRISE : t + 1 - MOONRISE; out.dir = arc(mt / (1 - MOONRISE + MOONSET), 0.7); }
    return out;
  };
  /** Per-frame update from the game clock (Day / Night buttons pin the look to noon / moonlit midnight). */
  SKY.update = function (game) {
    const mode = game && game.state && game.state.timeMode;
    const t = mode === 'day' ? 0.5 : mode === 'night' ? 0.0 : (game && game.tod ? game.tod() : 0.5);
    SKY.at(t, SKY); const d = SKY.dir; JT.LIGHT[0] = d[0]; JT.LIGHT[1] = d[1]; JT.LIGHT[2] = d[2]; return SKY;
  };
  /** Run fn with the fixed studio light (shop thumbnails and portraits don't follow the clock). */
  JT.withBaseLight = function (fn) {
    const L = JT.LIGHT, keep = L.slice(); L[0] = JT.LIGHT0[0]; L[1] = JT.LIGHT0[1]; L[2] = JT.LIGHT0[2];
    try { return fn(); } finally { L[0] = keep[0]; L[1] = keep[1]; L[2] = keep[2]; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
