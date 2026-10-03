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
})(typeof window !== 'undefined' ? window : globalThis);
