/* Mantis Terrarium pack v1.2 — drawing for egg cases (oothecae), hatching nymphs on their threads and
   drifting autumn leaves. Added as extra sprite items to the renderer's scene list. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M; if (!JT.Renderer) return;
  const LIFE = () => JT.SpiderAI.LIFE || { HARD_DAYS: 0.5 };
  const hex = (c) => { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const mixA = (a, b, k) => { const A = hex(a), B = hex(b); return A.map((v, i) => Math.round(v + (B[i] - v) * k)); };
  const toHex = (A) => '#' + A.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, k) => toHex(mixA(a, b, k));
  // per-shape: [length, thickness] in units of the mother's body length, ridge count
  const SHAPE = { long: [0.62, 0.2, 9], round: [0.36, 0.3, 6], elong: [0.48, 0.22, 7], thin: [0.5, 0.12, 8], flat: [0.42, 0.16, 6], tiny: [0.22, 0.12, 4], ribbon: [0.7, 0.1, 12] };

  function drawOoth(ctx, V, o, night) {
    const sh = SHAPE[o.k] || SHAPE.elong; const Lb = Math.max(4, o.size || 8);
    const len = Lb * sh[0] * 1.25, th = Lb * sh[1] * 1.25;
    const up = o.up || [0, 1, 0]; const dir = o.dir || [1, 0, 0];
    const c = M.add(o.pos, M.mul(up, -th * 0.35));
    const a = V.P(M.add(c, M.mul(dir, -len / 2))), b = V.P(M.add(c, M.mul(dir, len / 2))), P = V.P(c);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const sl = Math.max(2, Math.hypot(b[0] - a[0], b[1] - a[1]));
    const sth = Math.max(1.5, th * V.s);
    const hard = M.clamp((o.age || 0) / LIFE().HARD_DAYS, 0, 1);
    let col = mix('#f7f1df', o.k === 'ribbon' ? '#7a5a3a' : '#9b7b52', hard * 0.92); if (o.state === 'empty') col = mix('#c9b48e', '#e2d6b8', 0.4);
    ctx.save(); ctx.translate(P[0], P[1]); ctx.rotate(ang);
    const hw = sl / 2, hh = sth / 2 * (o.k === 'flat' ? 0.7 : 1);
    const hy = o.k === 'round' ? Math.max(hh, hw * 0.75) : hh;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, hy * 0.5, hw * 1.02, hy * 0.9, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath();
    if (o.k === 'ribbon') { ctx.moveTo(-hw, 0); for (let i = 0; i <= 10; i++) { const x = -hw + i * sl / 10; ctx.lineTo(x, -hh + Math.sin(i * 1.3) * hh * 0.3); } for (let i = 10; i >= 0; i--) { const x = -hw + i * sl / 10; ctx.lineTo(x, hh * 0.8 + Math.sin(i * 1.3) * hh * 0.3); } ctx.closePath(); }
    else ctx.ellipse(0, 0, hw, hy, 0, 0, 6.283);
    ctx.fill();
    // foam ridges across the case
    ctx.strokeStyle = mix('#ffffff', '#4a3420', 0.25 + hard * 0.5); ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(0.5, sth * 0.08);
    const n = sh[2];
    for (let i = 1; i < n; i++) { const x = -hw + i * sl / n; const e = Math.sqrt(Math.max(0, 1 - (x / hw) * (x / hw))); ctx.beginPath(); ctx.moveTo(x - hy * 0.12, -hy * e * 0.92); ctx.quadraticCurveTo(x + hy * 0.25, 0, x - hy * 0.12, hy * e * 0.92); ctx.stroke(); }
    // the emergence strip along the top; little exit holes once hatched
    ctx.globalAlpha = 0.8; ctx.strokeStyle = mix(col, '#ffffff', 0.3); ctx.lineWidth = Math.max(0.6, sth * 0.12);
    ctx.beginPath(); ctx.moveTo(-hw * 0.8, -hy * 0.55); ctx.quadraticCurveTo(0, -hy * 0.85, hw * 0.8, -hy * 0.55); ctx.stroke();
    if (o.state === 'empty' || o.state === 'hatching') { ctx.fillStyle = 'rgba(60,40,25,0.7)'; for (let i = 0; i < 6; i++) { const x = -hw * 0.7 + i * hw * 0.28; ctx.beginPath(); ctx.arc(x, -hy * 0.62, Math.max(0.4, sth * 0.07), 0, 6.283); ctx.fill(); } }
    ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,' + (0.35 * (1 - hard) + 0.1).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(-hw * 0.2, -hy * 0.35, hw * 0.45, hy * 0.18, 0, 0, 6.283); ctx.fill();
    if (night > 0.4) { ctx.fillStyle = 'rgba(10,15,40,' + ((night - 0.4) * 0.5).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(0, 0, hw, hy, 0, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
  JT.Draw.mantisOoth = drawOoth;

  function nymphAt(hv, n, t) {
    const o = hv.o; const sh = SHAPE[o.k] || SHAPE.elong; const Lb = Math.max(4, o.size || 8);
    const up = o.up || [0, 1, 0]; const base = M.add(o.pos, M.mul(up, -Lb * sh[1] * 0.6));
    const tt = t - n.dl; if (tt < 0) return null;
    const sw = Math.sin(tt * 3 + n.ph) * 0.6;
    if (tt < n.hang) { const k = Math.min(1, tt / 0.6); return { pos: [base[0] + sw, base[1] - n.th * k, base[2] + Math.cos(tt * 2.2 + n.ph) * 0.4], top: base, a: 1, dir: [0, -1, 0.01] }; }
    const t2 = tt - n.hang; const hang = [base[0] + sw, base[1] - n.th, base[2]];
    if (t2 < 0.45) { const k = t2 / 0.45; return { pos: [hang[0], M.lerp(hang[1], hv.floor[1] + 0.2, k * k), hang[2]], a: 1, dir: [0, -1, 0.01] }; }
    const t3 = t2 - 0.45; const k = M.clamp(t3 / n.run, 0, 1); const ek = 1 - (1 - k) * (1 - k);
    const from = [hang[0], hv.floor[1] + 0.2, hang[2]]; const to = [n.to[0], hv.floor[1] + 0.2, n.to[2]];
    const a = t3 > n.run ? M.clamp(1 - (t3 - n.run) / 1.5, 0, 1) : 1; if (a <= 0) return null;
    const dv = M.sub(to, from); return { pos: M.lerp3(from, to, ek), a, dir: M.len(dv) > 1e-3 ? M.norm(dv) : [1, 0, 0], walk: t3 };
  }
  function drawNymph(ctx, V, q, col) {
    const P = V.P(q.pos); const s = Math.max(1.1, 1.9 * V.s);
    if (q.top) { const T = V.P(q.top); ctx.strokeStyle = 'rgba(245,245,250,0.6)'; ctx.lineWidth = Math.max(0.4, V.s * 0.06); ctx.beginPath(); ctx.moveTo(T[0], T[1]); ctx.lineTo(P[0], P[1] - s * 0.6); ctx.stroke(); }
    const D2 = V.P(M.add(q.pos, q.dir)); let ang = Math.atan2(D2[1] - P[1], D2[0] - P[0]); if (!isFinite(ang)) ang = 0;
    ctx.save(); ctx.globalAlpha = q.a; ctx.translate(P[0], P[1]); ctx.rotate(ang);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, s * 0.22); ctx.lineCap = 'round';
    const wv = q.walk != null ? Math.sin(q.walk * 22) * 0.35 : 0;
    ctx.beginPath(); ctx.moveTo(-s * 0.9, 0); ctx.lineTo(s * 0.9, 0); ctx.stroke();
    ctx.lineWidth = Math.max(0.35, s * 0.1);
    for (const [x, l] of [[0.25, 1], [-0.1, 1.1], [-0.4, 1.2]]) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo((x + 0.25 * sd * wv) * s - s * 0.2, sd * s * 0.7 * l); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(s * 0.7, 0); ctx.lineTo(s * 1.25, -s * 0.35); ctx.stroke();
    ctx.restore();
  }
  const AUT = ['#c8632a', '#b8452a', '#d89a32', '#8a5a2e', '#a8742c', '#c9a040'];
  function drawLeaf(ctx, V, l) {
    const P = V.P(l.pos); const r = Math.max(1.4, l.size * V.s);
    const a = l.falling ? 0.95 : 0.95 * M.clamp(1 - (l.rest - 26) / 6, 0, 1); if (a <= 0) return;
    const col = AUT[Math.floor(l.hue * AUT.length) % AUT.length];
    ctx.save(); ctx.globalAlpha = a; ctx.translate(P[0], P[1]); ctx.rotate(l.ang);
    const fy = l.falling ? 0.15 + 0.85 * Math.abs(Math.cos(l.flip)) : Math.max(0.3, V.sp || 0.5); ctx.scale(1, fy);
    ctx.fillStyle = l.falling && Math.cos(l.flip) < 0 ? mix(col, '#e8d0a0', 0.25) : col;
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.bezierCurveTo(-r * 0.4, -r * 0.75, r * 0.5, -r * 0.6, r, 0); ctx.bezierCurveTo(r * 0.5, r * 0.6, -r * 0.4, r * 0.75, -r, 0); ctx.fill();
    ctx.strokeStyle = mix(col, '#2a1a0a', 0.45); ctx.lineWidth = Math.max(0.4, r * 0.08);
    ctx.beginPath(); ctx.moveTo(-r * 1.3, 0); ctx.lineTo(r * 0.9, 0); for (const x of [-0.4, 0, 0.4]) { ctx.moveTo(x * r, 0); ctx.lineTo((x + 0.3) * r, -r * 0.35); ctx.moveTo(x * r, 0); ctx.lineTo((x + 0.3) * r, r * 0.35); } ctx.stroke();
    ctx.restore();
  }
  JT.Draw.mantisLeaf = drawLeaf;

  const RP = JT.Renderer.prototype, cs0 = RP.collectScene;
  RP.collectScene = function (V, hab, night) {
    const sc = cs0.apply(this, arguments); const items = sc.items;
    for (const o of hab.data.ooth || []) { if (!M.finite3(o.pos)) continue; items.push({ d: V.depth(o.pos) - 0.03, mf: (c, v) => drawOoth(c, v, o, night), p: o.pos, r: (o.size || 8) * 0.75 + 1 }); }
    for (const hv of hab._mHatch || []) {
      const S = JT.SPECIES_BY_ID[hv.o.species]; const col = (S && S.pal && (S.pal.body || S.pal.abd)) || '#8a9a5a';
      for (const n of hv.nym) { const q = nymphAt(hv, n, hv.t); if (!q) continue; items.push({ d: V.depth(q.pos) - 0.04, mf: (c, v) => drawNymph(c, v, q, col), p: q.pos, r: 3 + (q.top ? n.th : 0) }); }
    }
    for (const l of hab._mLeaves || []) { if (!M.finite3(l.pos)) continue; items.push({ d: V.depth(l.pos) - 0.02, mf: (c, v) => drawLeaf(c, v, l), p: l.pos, r: l.size * 1.4 + 1 }); }
    const run0 = sc.run; sc.run = (it, c2, v2) => (it.mf ? it.mf(c2, v2) : run0(it, c2, v2));
    return sc;
  };
})(typeof window !== 'undefined' ? window : globalThis);