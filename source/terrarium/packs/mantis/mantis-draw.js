/* Mantis Terrarium pack — the mantis body, drawn in the same field-guide ink-and-wash style as the jumpers
   (same blob / limb / wing primitives, same lighting, same depth-sorted parts). Replaces Draw.spider.

   Body plan along the body frame (p = contact point, f forward, s side, n up from the surface), L = body length:
   abdomen (rear ~45%, curled up over the back in nymphs, covered by the folded wings in adults) · thorax, where the
   four walking legs attach · long raised prothorax ("neck") · small triangular head with big compound eyes, a dark
   pseudopupil that always faces the viewer, chewing mandibles and long antennae · raptorial forelegs (long coxa,
   spiny femur, folding tibia) posed between: folded "praying", reaching (strike), holding a meal, grooming, threat. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, D = JT.Draw, CR = D.critter;
  const { blob, limb, sh, mix, hex6, castShadow, lodFor, sortDraw, projEll } = CR;
  const LG = JT.LIGHT;
  const add = M.add, mul = M.mul, sub = M.sub, nrm = M.norm, lerp3 = M.lerp3;
  const sum = (...a) => { let r = [0, 0, 0]; for (const v of a) r = add(r, v); return r; };
  const rot = (a, b, ang) => add(mul(a, Math.cos(ang)), mul(b, Math.sin(ang))); // rotate unit a toward unit b
  const ink = (c) => sh(c, -0.62);

  /** Flat leaf / petal / wing outline: pointed at both ends (or rounded: k=1), filled, inked, with an optional midrib. */
  function leafShape(ctx, V, c, ax, ay, fill, edge, o) {
    o = o || {}; const N = o.lod === 0 ? 8 : o.ragged ? 26 : 18, round = o.round || 0, P = []; const rg = o.ragged ? (i) => 1 - o.ragged * (0.5 + 0.5 * Math.sin(i * 2.7 + 1.3)) * (i % 3 === 0 ? 1 : 0.35) : null;
    for (let i = 0; i <= N; i++) { const th = i / N * Math.PI; const u = -Math.cos(th); const w = Math.pow(Math.sin(th), round ? 0.55 : 0.9) * (o.taper ? (1 - 0.45 * (u + 1) / 2) : 1) * (rg ? rg(i) : 1); P.push(add(c, add(mul(ax, u), mul(ay, w)))); }
    for (let i = N - 1; i > 0; i--) { const th = i / N * Math.PI; const u = -Math.cos(th); const w = Math.pow(Math.sin(th), round ? 0.55 : 0.9) * (o.taper ? (1 - 0.45 * (u + 1) / 2) : 1) * (rg ? rg(i + 7) : 1); P.push(add(c, add(mul(ax, u), mul(ay, -w * (o.asym || 1))))); }
    const S = P.map(q => V.P(q)); ctx.beginPath(); S.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    const R = projEll(V, ax, ay, null).r1; if (o.lod > 0 && R > 2) { ctx.lineWidth = Math.max(0.45, Math.min(1.3, R * 0.05)); ctx.strokeStyle = edge; ctx.stroke(); }
    if (o.rib && o.lod > 0 && R > 5) { const a = V.P(sub(c, ax)), b = V.P(add(c, mul(ax, 0.85))); ctx.strokeStyle = o.vein || edge; ctx.globalAlpha *= 0.6; ctx.lineWidth = Math.max(0.4, R * 0.025); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      if (R > 9) for (let k = -2; k <= 2; k++) { if (!k) continue; const m = V.P(add(c, mul(ax, k * 0.3))), e = V.P(add(add(c, mul(ax, k * 0.3 + 0.25)), mul(ay, 0.7 * Math.sign(k + 0.01)))); const e2 = V.P(add(add(c, mul(ax, k * 0.3 + 0.25)), mul(ay, -0.7))); ctx.moveTo(m[0], m[1]); ctx.lineTo(e[0], e[1]); ctx.moveTo(m[0], m[1]); ctx.lineTo(e2[0], e2[1]); }
      ctx.stroke(); ctx.globalAlpha /= 0.6; }
    return S;
  }
  function dot2(ctx, P, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(P[0], P[1], Math.max(0.4, r), 0, 6.283); ctx.fill(); }
  function spiral(ctx, P, r, cols) { for (let k = 0; k < cols.length; k++) dot2(ctx, [P[0] + r * 0.08 * k, P[1] - r * 0.05 * k], r * (1 - k / cols.length), cols[k]); }

  const STRIKE = new Set(['pounce', 'lunge']);
  const ALERT = new Set(['notice', 'assess', 'track', 'peek', 'watch', 'curious', 'fingerWatch', 'lookout', 'scan']);
  const HUNTPOSE = new Set(['stalk', 'creep', 'crouch']);

  /** v1.2 individual colouring: a molt colour morph (toward green or brown), cold-dark before warming up, elderly fade.
      Only applies when the individual carries those fields (fresh/lineup mantises draw with the plain species palette). */
  const MORPH = { green: '#6f9e44', brown: '#8a6a44' };
  function toneOf(S, sp) {
    const mo = sp.morph, cold = M.clamp(sp._mCold || 0, 0, 1), age = M.clamp(sp._mAge || 0, 0, 1);
    if (!(mo && mo.a > 0.02) && cold < 0.02 && age < 0.02) return null;
    const key = (mo ? mo.k + (Math.round(mo.a * 20)) : '') + '|' + Math.round(cold * 20) + '|' + Math.round(age * 20);
    if (sp._mToneK === key && sp._mTone && sp._mToneS === S.id) return sp._mTone;
    const out = {}; for (const k in S.pal) { let c = S.pal[k]; if (!c || typeof c !== 'string' || c[0] !== '#') { out[k] = c; continue; } c = hex6(c);
      if (mo && mo.a > 0.02 && MORPH[mo.k] && /^(body|body2|wing|wingEdge|leg|belly|ceph|abd|chel|hair)$/.test(k)) c = mix(c, k === 'body2' || k === 'wingEdge' ? sh(MORPH[mo.k], -0.25) : MORPH[mo.k], M.clamp(mo.a, 0, 1) * 0.6);
      if (cold > 0.02 && k !== 'eye') c = sh(c, -0.16 * cold);
      if (age > 0.02 && k !== 'eye') c = mix(c, '#a49c8a', 0.22 * age);
      out[k] = c; }
    sp._mToneK = key; sp._mTone = out; sp._mToneS = S.id; return out;
  }
  D.mantisTone = toneOf;
  D.mantis = function (ctx, V, sp, fr, o) {
    const S = JT.SPECIES_BY_ID[sp.species] || JT.SPECIES[0]; const LK = S.mlook || {}; const L = o.len; const t = o.time || 0;
    const male = sp.sex === 'm' && !o.ghost; const thin = LK.thin || 1; const legL = LK.legL || 1; const FLG = S.mflags || {};
    const dead = o.ghost ? 0 : M.clamp(sp._mDead || 0, 0, 1), flatK = o.ghost ? 0 : Math.max(dead, M.clamp(sp._mFlatK || 0, 0, 1));
    const buzz = o.ghost ? 0 : M.clamp(sp._mBuzz || 0, 0, 1), box = o.ghost ? 0 : M.clamp(sp._mBox || 0, 0, 1), sip = o.ghost ? 0 : M.clamp(sp._mSip || 0, 0, 1);
    const eyeW = o.ghost ? 0 : M.clamp(sp._mEyeW || 0, 0, 1), lay = o.ghost ? 0 : M.clamp(sp._mLay || 0, 0, 1);
    let { f, s, n } = fr; let p0 = fr.p; const st = sp.state || 'idle';
    const stage = sp.stage != null ? sp.stage : 5; const adult = stage >= 4; const seed = sp.seed || 1;
    // hanging head-down to molt: the hind feet stay on the twig, the body swings down beneath them
    const hk = M.smooth(M.clamp(o.hangK != null ? o.hangK : (o.ghost ? 0 : sp._mHangK || 0), 0, 1)); let piv = null;
    if (hk > 0.001) {
      let nh = [f[0], 0, f[2]]; if (Math.hypot(nh[0], nh[2]) < 0.2) nh = [n[0], 0, n[2]]; if (Math.hypot(nh[0], nh[2]) < 0.1) nh = [1, 0, 0]; nh = nrm(nh);
      piv = add(p0, mul(f, -o.len * 0.24));
      if (o.hangPiv) { piv = o.hangPiv; nh = o.hangNh || nh; f = nh; n = [0, 1, 0]; } // a shed skin left hanging where it was molted
      else if (!o.ghost && hk > 0.9 && !sp._mPiv) { sp._mPiv = piv.slice(); sp._mNh = nh.slice(); }
      else if (!o.ghost && sp._mPiv && (st === 'molting' || st === 'postMolt')) { piv = sp._mPiv; nh = sp._mNh || nh; }
      let f2 = nrm(lerp3(f, [0, -1, 0], hk)); let n2 = nrm(lerp3(n, nh, hk));
      if (!o.ghost && sp._mHangSway) { const sw0 = nrm(M.cross([0, 1, 0], nh)); f2 = nrm(add(f2, add(mul(sw0, Math.sin(t * 1.25 + seed) * 0.2 * sp._mHangSway * hk), mul(nh, Math.sin(t * 0.8 + seed * 0.3) * 0.08 * sp._mHangSway * hk)))); } n2 = nrm(sub(n2, mul(f2, M.dot(n2, f2))));
      f = f2; n = n2; s = nrm(M.cross(n2, f2));
      p0 = add(piv, mul(f, o.len * (0.24 + 0.06 * hk)));
      // molting: the new body slides out of the back of the old skin, head first, and hangs below it
      if (!o.ghost && (sp._mSlide || 0) > 0.001) p0 = add(p0, mul(f, o.len * 0.3 * sp._mSlide));
    }
    if (!o.ghost && sp._mMount) p0 = add(p0, mul(n, sp._mMount)); // a male riding on the female's back
    const s0 = s, n0 = n; if (dead > 0.001) { const rr = 1.05 * dead * (seed % 2 ? 1 : -1); const s2 = rot(s, n, rr), n2 = rot(n, mul(s, -1), rr); s = s2; n = n2; } // playing dead: lies flat, tipped onto its side
    if (!o.ghost && hk > 0.3 && st === 'molting') { const fr0 = fr; D.mantis(ctx, V, sp, fr0, Object.assign({}, o, { ghost: true, hangK: sp._mHangK, hangPiv: sp._mPiv, hangNh: sp._mNh, meal: null, noShadow: true, alpha: (o.alpha != null ? o.alpha : 1) * 0.8 })); }
    const molt = !o.ghost && (st === 'molting' || st === 'postMolt') ? 0.55 : 0;
    const paleK = o.ghost ? 0.72 : Math.max(molt, sp.soft > 0 ? Math.min(0.65, sp.soft / 120 * 0.7) : 0);
    const C = (c) => paleK > 0 ? mix(c, '#f1ead8', paleK) : hex6(c);
    const pal0 = o.palette || (!o.ghost && toneOf(S, sp)) || S.pal; const pal = {}; for (const k in pal0) if (pal0[k]) pal[k] = C(pal0[k]);
    const bodyC = pal.body || '#8a9a5a', body2 = pal.body2 || sh(bodyC, -0.2), legC = pal.leg || bodyC;
    const px = L * V.s * 0.62; const lod = lodFor(px, o);
    const alpha = (o.alpha != null ? o.alpha : 1) * (o.ghost ? 0.85 : 1); ctx.globalAlpha = alpha;
    const air = !!o.airborne && st !== 'pounce'; // a strike keeps its feet planted (only a lunge), it is not a leap
    const fly = air && adult && !!sp._mFly && !o.ghost; const flap = fly ? Math.sin(t * 46 + seed) : 0;
    const moving = sp._moving && !o.airborne ? 1 : 0, crouch = sp._crouch || 0;
    const sleep = st === 'sleep' || st === 'rest' && (sp._sleepy || 0) > 0.5 ? 1 : 0;
    const threat = st === 'display' || st === 'threat' ? 1 : 0;
    const strike = (STRIKE.has(st) ? 1 : 0) * (st === 'pounce' && sp._air ? M.smooth(M.clamp(sp._air.t / 0.3, 0, 1)) * 0.6 + 0.4 : 0.9); // forelegs shoot out, then sweep in
    const reach = Math.max(strike, o.airborne ? (sp._reach || 0) : 0);
    const hug = o.hug && o.hug.k > 0.01 ? o.hug : null; const holdK = hug ? hug.k : (o.meal ? 1 : 0);
    const groom = st === 'groom' || st === 'clean' || (sp._wipe || 0) > 0.2 ? 1 : 0;
    const hunt = HUNTPOSE.has(st) ? 1 : 0, alert = ALERT.has(st) ? 1 : 0;
    // rocking: a slow side-to-side sway while stalking / walking / watching (feet stay put, the body sways over them)
    let swayK = o.thumb || o.airborne || o.curled || sleep || hk > 0.2 ? 0 : hunt ? 1 : moving ? 0.55 : alert ? 0.4 : 0.18;
    if (swayK > 0 && (LK.leafRock || (FLG.rockWalk && moving))) swayK = Math.max(swayK, LK.leafRock ? 0.5 : 0.9);
    if (dead > 0.3) swayK = 0;
    const sw = swayK * (Math.sin(t * 2.2 + seed * 0.7) * 0.75 + Math.sin(t * 3.7 + seed) * 0.25) + (o.thumb || o.ghost ? 0 : (sp._mPeer || 0) * 1.7 * Math.sin(t * 6.5 + seed) + (sp._mRock || 0) * 2);
    const h0 = L * (0.115 - 0.035 * crouch - 0.02 * sleep + 0.01 * threat) * (LK.flat ? 0.72 : 1) * (1 - 0.6 * flatK);
    const Wf = (u, v, w) => [p0[0] + f[0] * u + s[0] * v + n[0] * w, p0[1] + f[1] * u + s[1] * v + n[1] * w, p0[2] + f[2] * u + s[2] * v + n[2] * w]; // fixed (feet)
    const lat = L * 0.035 * sw; const p = add(p0, mul(s, lat));
    const W = (u, v, w) => [p[0] + f[0] * u + s[0] * v + n[0] * w, p[1] + f[1] * u + s[1] * v + n[1] * w, p[2] + f[2] * u + s[2] * v + n[2] * w]; // swaying body
    if (!air && !o.noShadow && hk < 0.3) castShadow(ctx, V, p0, f, s0, n0, L * 0.85, h0 + L * 0.06, alpha * 0.85);
    const under = M.dot(n, V.toCam) < -0.05 && !o.thumb;
    const parts = []; const push = (pt, fn, bias) => parts.push({ d: V.depth(pt) + (bias || 0), f: fn });
    const fat = M.clamp(0.88 + (sp.sat != null ? sp.sat : 0.7) * 0.25, 0.88, 1.15);

    // ---------- thorax + abdomen ----------
    const T = W(0.02 * L, 0, h0);                                    // thorax (walking legs attach here)
    const abW = L * 0.062 * (LK.abdW || 1) * fat * (adult ? 1 : 0.85) * thin * (male ? 0.84 : 1);
    const curl = adult ? 0 : 0.42 * (LK.curl || 1) * (o.curled ? 1.5 : 1);
    const segs = 6, aLen = L * 0.47 * (LK.aLen || 1); let ap = add(T, mul(f, -L * 0.035)); let ang = adult ? -0.06 : 0.05;
    const abSeg = [];
    for (let i = 0; i < segs; i++) {
      ang += curl * (0.18 + 0.2 * i) + (adult ? -0.012 : 0) - lay * 0.09 * i;
      const dir = nrm(rot(mul(f, -1), n, ang)); const up = nrm(sub(n, mul(dir, M.dot(n, dir))));
      const sl = aLen / segs; const c = add(ap, mul(dir, sl * 0.5)); const taper = [0.82, 0.98, 1.05, 1, 0.84, 0.55][i];
      abSeg.push({ c, dir, up, w: abW * taper, sl }); ap = add(ap, mul(dir, sl * 0.95));
    }
    const abTip = ap;
    abSeg.forEach((g, i) => push(g.c, () => {
      blob(ctx, V, g.c, mul(g.dir, g.sl * 0.78), mul(s, g.w), mul(g.up, g.w * 0.82), under ? mix(bodyC, pal.belly || bodyC, 0.6) : (i % 2 ? sh(bodyC, -0.04) : bodyC), { lod, gloss: 0.25, hatch: lod === 2 });
      if (lod > 0 && g.w * V.s > 2.5 && !adult) { const a = V.P(add(add(g.c, mul(g.dir, -g.sl * 0.45)), mul(g.up, g.w * 0.8))); const b = V.P(add(add(g.c, mul(g.dir, -g.sl * 0.45)), mul(s, g.w * 0.95))); ctx.strokeStyle = sh(bodyC, -0.35); ctx.globalAlpha = alpha * 0.5; ctx.lineWidth = Math.max(0.4, g.w * V.s * 0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.globalAlpha = alpha; }
      if (LK.spines && lod > 0 && i > 0 && i < 5) for (const sd of [-1, 1]) { const a = add(add(g.c, mul(s, sd * g.w * 0.8)), mul(g.up, g.w * 0.5)); const b = add(a, add(mul(s, sd * g.w * 0.5), mul(g.up, g.w * 0.9))); limb(ctx, V, [a, b], [L * 0.012], sh(pal.accent || bodyC, 0.1), lod, null); }
      if (LK.lichen && lod > 0 && g.w * V.s > 1.6) { const q = seed % 7; for (const [a2, b2, c2] of [[0.3, 0.5, 0], [-0.4, 0.2, 1], [0.1, -0.5, 2]]) dot2(ctx, V.P(sum(g.c, mul(s, g.w * a2 * ((i + q) % 2 ? 1 : -1)), mul(g.up, g.w * 0.85), mul(g.dir, g.sl * b2 * 0.4))), g.w * V.s * (0.18 + 0.06 * ((i + c2) % 3)), c2 === 1 ? sh(bodyC, -0.32) : c2 === 2 ? '#b6bea2' : sh(bodyC, 0.22)); }
      if (LK.leafy && lod > 0 && i > 0 && i < 5 && i % 2) for (const sd of [-1, 1]) leafShape(ctx, V, add(add(g.c, mul(s, sd * g.w * 1.25)), mul(g.dir, g.sl * 0.1)), mul(g.dir, g.sl * 0.55), mul(s, sd * g.w * 0.75), sh(bodyC, -0.06 + 0.05 * i), ink(bodyC), { lod, rib: true });
    }, 0));
    push(T, () => blob(ctx, V, T, mul(f, L * 0.07), mul(s, L * 0.05 * (thin < 1 ? 0.5 + 0.5 * thin : 1)), mul(n, L * 0.045), under ? mix(bodyC, pal.belly || bodyC, 0.5) : bodyC, { lod, gloss: 0.3 }), 0);

    // ---------- wings: folded over the abdomen (adults), buds (sub-adult), or fanned up in the threat display ----------
    const wl = male && LK.stub ? 0.85 : male && (LK.wingLen || 1) < 0.95 ? Math.min(1, (LK.wingLen || 1) + 0.18) : (LK.wingLen || 1); const wW = LK.wideWing || 1;
    if (adult && buzz > 0.01 && !fly) { // wing buzz: the (stubby) wings lift a little and flicker fast, flashing the bright hind wings
      const w0 = add(T, mul(n, L * 0.045));
      for (const sd of [-1, 1]) { const fl = 0.55 + 0.45 * Math.abs(Math.sin(t * 52 + sd * 1.3 + seed)); const up = nrm(sum(mul(n, 0.45 + 0.6 * fl * buzz), mul(s, sd * 0.6 * fl), mul(f, -0.55)));
        const bw = L * 0.17 * Math.max(0.75, wl); const base = add(w0, mul(f, -L * 0.03)); const hc = add(base, mul(up, bw));
        push(add(hc, mul(V.toCam, -L * 0.04)), () => { ctx.globalAlpha = alpha * (0.7 + 0.3 * fl);
          leafShape(ctx, V, hc, mul(up, bw), mul(nrm(sum(mul(s, sd), mul(n, 0.3), mul(f, -0.3))), L * 0.1 * wW), pal.hind || '#e8642a', ink(pal.hind || '#e8642a'), { lod, round: 1, rib: true });
          const fc = add(base, mul(nrm(sum(up, mul(n, -0.2))), bw * 0.8)); leafShape(ctx, V, fc, mul(up, bw * 0.8), mul(s, sd * L * 0.04 * wW), pal.wing, pal.wingEdge || ink(pal.wing), { lod, rib: true });
          ctx.globalAlpha = alpha; }, -L * 0.02); }
    } else if (adult) {
      const w0 = add(T, mul(n, L * 0.045));
      const tipA = wl >= 0.95 ? lerp3(abSeg[5].c, abTip, 0.6) : abSeg[Math.min(5, Math.round(wl * 5.6))].c; const wc = lerp3(w0, add(tipA, mul(n, abW * 0.7)), 0.5);
      const wax = mul(sub(add(tipA, mul(n, abW * 0.7)), w0), 0.55);
      if (threat > 0.01 || fly) {
        for (const sd of [-1, 1]) { // hind wing + forewing fanned up and out, eyespots showing (or beating in flight)
          const base = add(w0, mul(f, -L * 0.03)); const up = fly ? nrm(sum(mul(n, 0.15 + 0.85 * flap), mul(s, sd * 1), mul(f, -0.15))) : nrm(sum(mul(n, 0.9), mul(s, sd * 0.55), mul(f, -0.25)));
          const hc = add(base, mul(up, L * 0.2)); push(add(hc, mul(V.toCam, -L * 0.05)), () => {
            if (fly) ctx.globalAlpha = alpha * 0.62; // beating wings: a translucent blur
            leafShape(ctx, V, hc, mul(up, L * 0.2), mul(nrm(sum(mul(f, -0.8), mul(s, sd * 0.3))), L * 0.15), pal.hind || '#c8b090', ink(pal.hind || '#c8b090'), { lod, round: 1, rib: true });
            const fu = fly ? nrm(sum(mul(n, 0.1 + 0.8 * Math.sin(t * 46 + seed + 0.5)), mul(s, sd), mul(f, 0.05))) : nrm(sum(mul(n, 0.75), mul(s, sd * 0.7), mul(f, -0.1)));
            const fc = add(base, mul(fu, L * 0.17));
            leafShape(ctx, V, fc, mul(fu, L * 0.17), mul(nrm(sum(mul(f, -0.6), mul(n, -0.2))), L * 0.06), pal.wing, pal.wingEdge || ink(pal.wing), { lod, rib: true });
            if (LK.spiral && lod > 0) spiral(ctx, V.P(fc), L * V.s * 0.05, ['#1a1a12', '#e9d24a', '#3f9a3a', '#e9d24a', '#141410']);
            if (LK.wingSpot && lod > 0) dot2(ctx, V.P(fc), L * V.s * 0.012, '#2a2016');
            ctx.globalAlpha = alpha;
          }, -L * 0.02);
        }
      } else {
        const wd = under ? Math.max(...abSeg.map(g => V.depth(g.c))) + L * 0.02 : Math.min(...abSeg.map(g => V.depth(g.c))) - L * 0.02;
        parts.push({ d: wd, f: () => {
          for (const sd of [1, -1]) { const c = add(wc, mul(s, sd * abW * 0.18)); leafShape(ctx, V, c, wax, mul(s, sd * abW * 1.05 * wW), sd > 0 ? pal.wing : sh(pal.wing, -0.06), pal.wingEdge || ink(pal.wing), LK.ragged || LK.veins ? { lod, rib: lod > 0, asym: 0.35, ragged: LK.ragged ? 0.22 : 0, vein: LK.veins ? sh(pal.wing, -0.45) : null } : { lod, rib: lod === 2, asym: 0.35 }); }
          if (LK.stigma && lod > 0) for (const sd of [-1, 1]) dot2(ctx, V.P(add(add(wc, mul(wax, 0.15)), mul(s, sd * abW * 0.75 * wW))), L * V.s * 0.008, LK.stigma);
          if (LK.lichen && lod > 0) for (let k = 0; k < 5; k++) { const sd = k % 2 ? 1 : -1; dot2(ctx, V.P(add(add(wc, mul(wax, -0.6 + k * 0.3)), mul(s, sd * abW * (0.3 + 0.12 * (k % 3))))), L * V.s * (0.009 + 0.004 * (k % 2)), k % 3 === 0 ? '#c0c8aa' : sh(pal.wing, -0.3)); }
          if (LK.stripe && lod > 0) for (const sd of [-1, 1]) { const a = V.P(add(add(w0, mul(s, sd * abW * 0.95)), mul(n, -abW * 0.1))), b = V.P(add(add(wc, mul(wax, 0.9)), mul(s, sd * abW * 0.6))); ctx.strokeStyle = pal.accent || '#5c9a3a'; ctx.lineWidth = Math.max(0.5, abW * V.s * 0.25); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
          if (LK.wingSpot && lod > 0) for (const sd of [-1, 1]) dot2(ctx, V.P(add(add(wc, mul(wax, -0.2)), mul(s, sd * abW * 0.5))), L * V.s * 0.009, '#2a2016');
          if (LK.spiral && lod > 0) for (const sd of [-1, 1]) spiral(ctx, V.P(add(add(wc, mul(wax, -0.25)), mul(s, sd * abW * 0.55))), L * V.s * 0.022, ['#1a1a12', '#e9d24a', '#3f9a3a']);
        } });
      }
    } else if (stage === 3 && !under) { // swollen wing buds: the final molt is near
      for (const sd of [-1, 1]) { const c = add(add(T, mul(n, L * 0.04)), add(mul(f, -L * 0.05), mul(s, sd * L * 0.03))); push(c, () => leafShape(ctx, V, c, mul(f, -L * 0.045), mul(s, sd * L * 0.022), sh(bodyC, 0.06), ink(bodyC), { lod, round: 1 }), -0.01); }
    }

    // ---------- prothorax (the long raised "neck") ----------
    let proA = M.clamp(0.42 + 0.1 * alert + 0.05 * hunt - 0.22 * moving + 0.45 * threat - 0.3 * sleep - 0.25 * reach + 0.15 * holdK - 0.12 * crouch, 0.05, 1.1);
    if (sip > 0.001) proA = M.lerp(proA, 0.06, sip); if (flatK > 0.001) proA = M.lerp(proA, 0.02, flatK); if (box > 0.001) proA = M.lerp(proA, 0.62, box);
    const dirP = nrm(rot(f, n, proA)); const upP = nrm(rot(n, mul(f, -1), proA));
    const Lp = L * 0.3 * (LK.pro || 1); const P0 = W(0.08 * L, 0, h0 + L * 0.01); const N = add(P0, mul(dirP, Lp));
    const pc = lerp3(P0, N, 0.5);
    const thP = thin < 1 ? 0.45 + 0.55 * thin : 1;
    push(pc, () => {
      if (LK.shield === 'leaf') leafShape(ctx, V, add(lerp3(P0, N, 0.5), mul(upP, L * 0.014)), mul(dirP, Lp * 0.62), mul(s, L * 0.05 * (LK.shieldW || 1)), sh(bodyC, 0.05), ink(bodyC), { lod, rib: true, round: 1, ragged: LK.ragged ? 0.12 : 0, vein: sh(bodyC, -0.35) });
      if (LK.leafy) leafShape(ctx, V, add(pc, mul(upP, L * 0.012)), mul(dirP, Lp * 0.55), mul(s, L * 0.06), sh(bodyC, 0.04), ink(bodyC), { lod, rib: true });
      blob(ctx, V, lerp3(P0, N, 0.3), mul(dirP, Lp * 0.33), mul(s, L * 0.028 * thP), mul(upP, L * 0.026 * thP), bodyC, { lod, gloss: 0.35 });
      blob(ctx, V, lerp3(P0, N, 0.78), mul(dirP, Lp * 0.25), mul(s, L * 0.034 * thP), mul(upP, L * 0.028 * thP), bodyC, { lod, gloss: 0.35 });
      if (LK.shield === 'diamond') { leafShape(ctx, V, add(lerp3(P0, N, 0.3), mul(upP, L * 0.01)), mul(dirP, Lp * 0.2), mul(s, L * 0.04 * (LK.shieldW || 1)), sh(bodyC, 0.06), ink(bodyC), { lod, rib: true }); }
      if (LK.shield === 'flare') { const fc = add(lerp3(P0, N, 0.72), mul(upP, L * 0.012)); leafShape(ctx, V, fc, mul(dirP, Lp * 0.3), mul(s, L * 0.062 * (LK.shieldW || 1)), sh(bodyC, 0.08), ink(bodyC), { lod, round: 1, rib: true, taper: true });
        if (lod > 0) leafShape(ctx, V, add(fc, mul(upP, L * 0.004)), mul(dirP, Lp * 0.16), mul(s, L * 0.026 * (LK.shieldW || 1)), '#eef0e2', sh('#eef0e2', -0.3), { lod, round: 1 }); }
      if (lod === 2 && LK.pro > 1.05) { const a = V.P(add(lerp3(P0, N, 0.1), mul(upP, L * 0.026))), b = V.P(add(lerp3(P0, N, 0.9), mul(upP, L * 0.03))); ctx.strokeStyle = sh(bodyC, -0.3); ctx.globalAlpha = alpha * 0.4; ctx.lineWidth = Math.max(0.4, L * V.s * 0.006); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.globalAlpha = alpha; }
    }, 0);

    // ---------- head: turns to look (gaze, prey, camera); triangular, big eyes, pseudopupils, mandibles, antennae ----------
    let gz = (sp._mGz != null ? sp._mGz : (sp._gazeNow || 0)) * 0.5; // head snaps (held fixes, quick jumps)
    if (o.lookCam) { const cf = sub(V.toCam, mul(n, M.dot(V.toCam, n))); if (M.len(cf) > 0.2) { const c2 = nrm(cf); const a = Math.atan2(M.dot(c2, s), M.dot(c2, f)); if (Math.abs(a) < 2.2) gz = M.lerp(gz, M.clamp(a, -1.2, 1.2), o.lookCam); } }
    if (o.lookAt && M.finite3(o.lookAt)) { const d = sub(o.lookAt, N); const a = Math.atan2(M.dot(d, s), M.dot(d, f)); gz = M.clamp(a, -1.3, 1.3); }
    const hf0 = nrm(rot(f, s, gz)); const hs = nrm(M.cross(n, hf0));
    let hDown = sleep ? 0.9 : holdK > 0.3 ? 0.75 : 0.35 + 0.1 * hunt; // face tips down (feeding: head bowed onto the meal)
    if (sip > 0.001) hDown = M.lerp(hDown, 1.2, sip); if (dead > 0.001) hDown = M.lerp(hDown, 0.9, dead);
    const hf = nrm(rot(hf0, mul(n, -1), hDown)); const hu = nrm(M.cross(hf, hs));
    const hw = L * 0.07 * (LK.head || 1);
    const chew = holdK > 0.3 ? Math.sin(t * 11 + seed) : 0; const bite = holdK > 0.3 ? Math.max(0, Math.sin(t * 2.3 + seed)) : 0; // munch + a tug with each bite
    const Hc = sum(N, mul(dirP, L * 0.025), mul(upP, L * 0.012), mul(hf, L * 0.012 * bite), mul(hu, -L * 0.008 * bite));
    const mouth = add(Hc, add(mul(hf, L * 0.03), mul(hu, -L * 0.035)));
    push(Hc, () => {
      if (LK.leafy && lod > 0) leafShape(ctx, V, sum(Hc, mul(hu, L * 0.07), mul(hf, -L * 0.015)), mul(hu, L * 0.055), mul(hs, L * 0.02), sh(bodyC, -0.08), ink(bodyC), { lod, taper: true });
      if (LK.crown && lod > 0) { const cr = LK.crown; leafShape(ctx, V, sum(Hc, mul(hu, L * 0.05 * cr + L * 0.02), mul(hf, -L * 0.02)), mul(hu, L * 0.05 * cr), mul(hs, L * 0.014), sh(bodyC, -0.04), ink(bodyC), { lod, taper: true, rib: cr > 1.3 }); }
      // compound eyes at the upper corners, with the dark pseudopupil pointing at the viewer
      const eye = (sd) => {
        const ec = sum(Hc, mul(hs, sd * hw * 0.92), mul(hu, L * 0.014), mul(hf, -L * 0.002)); const er = L * 0.032 * (LK.head || 1);
        const e = blob(ctx, V, ec, mul(hs, er * 0.9), mul(hu, er * 1.15), mul(hf, er * 0.95), pal.eye || '#c8c890', { lod, gloss: 0.9 });
        if (lod > 0 && e && e.r1 > 1.2) { const fc = M.dot(nrm(sub(V.toCam, mul(n, 0))), nrm(sum(mul(hs, sd), mul(hf, 0.6)))); if (fc > -0.3) { const pp = V.P(add(ec, mul(V.toCam, er * 0.9))); dot2(ctx, pp, Math.max(0.5, e.r1 * (sleep ? 0.2 : 0.32)), 'rgba(18,14,8,0.85)'); } }
      };
      const nearE = M.dot(hs, V.toCam) > 0 ? 1 : -1;
      eye(-nearE);
      blob(ctx, V, add(Hc, mul(hu, -L * 0.012)), mul(hs, hw * 0.62), mul(hu, hw * 0.55), mul(hf, hw * 0.4), bodyC, { lod, gloss: 0.4 }); // face, narrowing down to the jaws
      blob(ctx, V, add(Hc, mul(hu, -L * 0.028)), mul(hs, hw * 0.3), mul(hu, hw * 0.35), mul(hf, hw * 0.35), sh(bodyC, -0.06), { lod, gloss: 0.3 });
      // mandibles: open/close while chewing
      for (const sd of [-1, 1]) { const mo = add(mouth, mul(hs, sd * L * (0.008 + 0.006 * Math.max(0, chew)))); blob(ctx, V, mo, mul(hs, L * 0.007), mul(hu, L * 0.011), mul(hf, L * 0.008), sh(body2, -0.15), { lod, gloss: 0.6, ink: lod === 2 }); }
      eye(nearE);
      if (lod === 2) for (const k of [-1, 0, 1]) dot2(ctx, V.P(sum(Hc, mul(hu, L * 0.022), mul(hs, k * L * 0.007), mul(hf, L * 0.004))), L * V.s * 0.004, sh(bodyC, -0.45)); // ocelli
    }, -0.005);
    // antennae: thin, long, swaying; drooped back when asleep; one drawn through the arms while grooming
    for (const sd of [-1, 1]) {
      const a = sum(Hc, mul(hu, L * 0.03), mul(hs, sd * L * 0.012), mul(hf, L * 0.008));
      const al = L * 0.36 * (LK.antL || 1) * (adult ? 1 : 0.8) * (male ? 1.2 : 1);
      const wv = Math.sin(t * (1.6 + 0.3 * sd) + seed + sd) * 0.18;
      let dir = nrm(sum(mul(hf0, 0.75), mul(n, sleep ? -0.4 : 0.55), mul(hs, sd * (0.32 + wv))));
      if (sleep || dead > 0.5) dir = nrm(sum(mul(hf0, -0.2), mul(n, -0.3), mul(hs, sd * 0.6)));
      else if (flatK > 0.3) dir = nrm(sum(mul(hf0, 1), mul(n, 0.08), mul(hs, sd * 0.12)));
      const b = add(a, mul(dir, al * 0.5)), c = add(add(a, mul(dir, al)), mul(n, -al * 0.12));
      push(b, () => CR.curve(ctx, V, a, b, c, L * 0.006, sh(body2, -0.2)), 0);
    }

    // ---------- raptorial forelegs ----------
    const arm = LK.arm || 1; const Lc = L * 0.15 * arm, Lf = L * 0.18 * arm, Lt = L * 0.11 * arm;
    const holdC = sum(mouth, mul(hf0, L * 0.05), mul(n, -L * 0.035)); // where a meal sits: between the arms, under the jaws
    const pr = hug ? M.clamp(hug.pl * 0.22, L * 0.03, L * 0.09) : L * 0.05;
    const armPose = (sd) => {
      const Sh = sum(lerp3(P0, N, 0.82), mul(upP, -L * 0.022), mul(s, sd * L * 0.022));
      const poses = [];
      // folded "praying": coxa hangs down-forward, femur back up under the head, tibia folded shut along it
      { const c = sum(Sh, mul(nrm(sum(mul(f, 0.45), mul(n, -0.9))), Lc), mul(s, sd * L * 0.008)); const k = sum(c, mul(nrm(sum(mul(f, 0.62), mul(n, 0.78))), Lf), mul(s, sd * L * 0.004));
        const tb = sum(k, mul(nrm(sub(c, k)), Lt * 0.92), mul(f, L * 0.012)); const ta = add(tb, mul(nrm(sum(mul(f, 0.35), mul(n, -1))), L * 0.05)); poses.push([1, c, k, tb, ta]); }
      const w = [1];
      // reaching / striking: everything thrown forward, tibia open
      // two phases: shoot out straight at the prey (tibia wide open), then sweep in, the tibia snapping shut on it
      if (reach > 0.01) { const w = M.smooth(M.clamp(sp._sweep || 0, 0, 1));
        const c = sum(Sh, mul(nrm(sum(mul(hf0, 0.92), mul(n, -0.22))), Lc), mul(s, sd * L * 0.018));
        let k = add(c, mul(nrm(sum(mul(hf0, 1), mul(n, 0.12 - 0.55 * w))), Lf)); k = lerp3(k, sum(holdC, mul(hf0, L * 0.09), mul(s, sd * L * 0.03)), w * 0.45);
        const tdir = nrm(lerp3(nrm(sum(mul(hf0, 1), mul(n, -0.12))), nrm(sum(mul(hf0, -0.55), mul(n, -0.85))), w));
        const tb = add(k, mul(tdir, Lt)); const ta = add(tb, mul(nrm(lerp3(nrm(sum(mul(hf0, 0.9), mul(n, -0.4))), nrm(sum(mul(hf0, -0.8), mul(n, 0.3))), w)), L * 0.05)); poses.push([reach, c, k, tb, ta]); }
      // holding a meal: femurs either side of it, tibias clamped over it, a slow re-grip
      if (holdK > 0.01) { const sq = 1 - 0.1 * (0.5 + 0.5 * Math.sin(t * 3.1 + sd * 1.7));
        const c = sum(Sh, mul(nrm(sum(mul(f, 0.4), mul(n, -0.85))), Lc), mul(s, sd * L * 0.03)); const k = sum(holdC, mul(hf0, pr * 0.9 + L * 0.02), mul(s, sd * (pr * sq + L * 0.022)), mul(n, -pr * 0.3));
        const tb = sum(holdC, mul(hf0, -pr * 0.35), mul(s, sd * pr * 0.55 * sq), mul(n, pr * 0.45)); const ta = add(tb, mul(nrm(sum(mul(hf0, -0.4), mul(s, -sd * 0.4), mul(n, 0.3))), L * 0.04)); poses.push([holdK, c, k, tb, ta]); }
      // grooming: one arm at a time drawn up through the jaws
      if (groom > 0.01 && holdK < 0.3) { const on = (Math.sin(t * 1.3) > 0 ? 1 : -1) === sd ? 1 : 0; if (on) { const c = sum(Sh, mul(nrm(sum(mul(f, 0.6), mul(n, -0.5))), Lc * 0.9), mul(s, sd * L * 0.02)); const k = sum(mouth, mul(hf0, L * 0.06), mul(s, sd * L * 0.03), mul(n, L * 0.02 * Math.sin(t * 8)));
        const tb = sum(mouth, mul(hf0, L * 0.005), mul(s, -sd * L * 0.005)); poses.push([groom, c, k, tb, add(tb, mul(n, -L * 0.03))]); } }
      // threat: arms raised and spread wide, the inner face (and any eyespot) shown
      if (threat > 0.01) { const c = add(Sh, mul(nrm(sum(mul(f, 0.4), mul(n, 0.35), mul(s, sd * 0.85))), Lc)); const k = add(c, mul(nrm(sum(mul(f, 0.3), mul(n, 0.9), mul(s, sd * 0.3))), Lf));
        const tb = add(k, mul(nrm(sum(mul(f, 0.7), mul(n, 0.1), mul(s, sd * 0.2))), Lt)); poses.push([threat, c, k, tb, add(tb, mul(f, L * 0.04))]); }
      // v1.2: forelegs stretched out ahead along the twig (stick mantis lying flat, bark mantis frozen, playing dead)
      if (flatK > 0.01) { const c = sum(Sh, mul(nrm(sum(mul(f, 1), mul(n, -0.12))), Lc), mul(s, sd * L * 0.008)); const k = sum(c, mul(nrm(sum(mul(f, 1), mul(n, -0.05))), Lf), mul(s, sd * L * 0.006));
        const tb = sum(k, mul(nrm(sub(c, k)), Lt * 0.9), mul(n, -L * 0.006)); poses.push([flatK * (dead > 0.5 ? 0.6 : 1), c, k, tb, add(tb, mul(f, -L * 0.03))]); }
      // boxing: folded forelegs held up in front of the face, pumped up and down (left and right out of step)
      if (box > 0.01) { const pump = L * 0.05 * Math.sin(t * 10.5 + (sd > 0 ? 0 : 2.2) + seed); const c = sum(Sh, mul(nrm(sum(mul(f, 0.6), mul(n, 0.15))), Lc), mul(s, sd * L * 0.03));
        const k = sum(c, mul(nrm(sum(mul(f, 0.25), mul(n, 1))), Lf), mul(n, pump), mul(s, sd * L * 0.01)); const tb = sum(k, mul(nrm(sub(c, k)), Lt * 0.85), mul(f, L * 0.015)); poses.push([box, c, k, tb, add(tb, mul(nrm(sum(mul(f, 0.4), mul(n, -1))), L * 0.04))]); }
      // eye wipe: one foreleg at a time drawn over the big compound eye on its side
      if (eyeW > 0.01 && holdK < 0.3) { const on = (Math.sin(t * 1.1 + seed) > 0 ? 1 : -1) === sd ? 1 : 0; if (on) { const ec = sum(Hc, mul(hs, sd * hw * 0.9), mul(hu, L * 0.012)); const sweep = Math.sin(t * 5.5);
        const c = sum(Sh, mul(nrm(sum(mul(f, 0.55), mul(n, -0.35))), Lc * 0.9), mul(s, sd * L * 0.025)); const k = sum(ec, mul(hf0, L * 0.07), mul(n, -L * 0.03), mul(s, sd * L * 0.03));
        const tb = sum(ec, mul(hu, L * 0.012 * sweep), mul(hf0, L * 0.012), mul(hs, sd * L * 0.008)); poses.push([eyeW, c, k, tb, add(tb, mul(hu, L * 0.03))]); } }
      // blend
      let tot = 0; const out = [Sh, [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (const q of poses) { const wq = q === poses[0] ? Math.max(0.0001, 1 - Math.min(1, poses.slice(1).reduce((a, b) => a + b[0], 0))) : q[0]; tot += wq; for (let j = 1; j < 5; j++) out[j] = add(out[j], mul(q[j], wq)); }
      for (let j = 1; j < 5; j++) out[j] = mul(out[j], 1 / tot); return out;
    };
    for (const sd of [-1, 1]) {
      const [Sh, c, k, tb, ta] = armPose(sd);
      const near = sd * M.dot(s, V.toCam) > 0;
      push(lerp3(Sh, k, 0.5), () => {
        limb(ctx, V, [Sh, c], [L * 0.03 * arm], sh(legC, 0.03), lod, null); // coxa
        if (LK.coxaSpot && lod > 0) { const cp = V.P(lerp3(Sh, c, 0.6)); const r = L * V.s * 0.014; dot2(ctx, cp, r * 1.25, '#f4f1e6'); dot2(ctx, cp, r, '#141210'); }
        const Sx = limb(ctx, V, [c, k], [L * 0.034 * arm], legC, lod, null); // femur (thick, spined on its inner edge)
        if (lod > 0 && Sx && L * V.s > 40) { const nn = 5; ctx.strokeStyle = sh(legC, -0.45); ctx.lineWidth = Math.max(0.4, L * V.s * 0.003); ctx.beginPath(); for (let i = 1; i < nn; i++) { const q = lerp3(c, k, i / nn); const a = V.P(add(q, mul(n, -L * 0.014))), b = V.P(add(q, mul(sub(mul(n, -1), mul(f, 0.4)), L * 0.026))); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); }
        if (LK.bands && lod > 0) for (let b = 0; b < 4; b++) { const a0 = lerp3(c, k, 0.12 + b * 0.22), a1 = lerp3(c, k, 0.22 + b * 0.22); limb(ctx, V, [a0, a1], [L * 0.036 * arm], b % 2 ? '#1c1814' : '#efe9da', lod, null); }
        limb(ctx, V, [k, tb, ta], [L * 0.022 * arm, L * 0.01], sh(legC, -0.03), lod, null); // tibia (hook at the end) + tarsus
        if (LK.bands && lod > 0) { const a0 = lerp3(k, tb, 0.3), a1 = lerp3(k, tb, 0.6); limb(ctx, V, [a0, a1], [L * 0.024 * arm], '#efe9da', lod, null); }
        if (LK.armLobe && lod > 0) { const AL = LK.armLobe; const wv = nrm(sum(mul(s, sd), mul(n, -0.25))); const fc = lerp3(c, k, 0.55); const inner = threat > 0.3;
          leafShape(ctx, V, fc, mul(sub(k, c), 0.5), mul(wv, L * (inner ? 0.085 : 0.055)), inner ? AL.inner[0] : AL.out, AL.edge || ink(AL.out), { lod, round: 1, rib: !inner });
          if (inner) AL.inner.slice(1).forEach((col, q) => leafShape(ctx, V, add(fc, mul(wv, L * 0.008 * (q + 1))), mul(sub(k, c), 0.44 - q * 0.1), mul(wv, L * (0.07 - q * 0.017)), col, sh(col, -0.3), { lod, round: 1 }));
          leafShape(ctx, V, lerp3(Sh, c, 0.5), mul(sub(c, Sh), 0.45), mul(wv, L * 0.03), inner ? AL.inner[1] : AL.out, AL.edge || ink(AL.out), { lod, round: 1 }); }
        if (LK.lobes && lod > 0) leafShape(ctx, V, lerp3(c, k, 0.5), mul(sub(k, c), 0.32), mul(nrm(sum(mul(s, sd), mul(n, -0.4))), L * 0.026), pal.body2 || '#e6b4c8', ink(pal.body2 || '#e6b4c8'), { lod, round: 1 });
      }, near ? -L * 0.012 : L * 0.012);
    }

    // ---------- walking legs: mid + hind pairs, long and thin, diagonal-pair gait, knees high ----------
    const gaitPh = (sp._walk || 0) * Math.PI;
    for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) {
      const mid = i === 0; const lk = i * 2 + (sd > 0 ? 1 : 0);
      const ph = gaitPh + ((i === 0) === (sd > 0) ? 0 : Math.PI); // mid-left + hind-right swing together
      const hip = W(mid ? 0.05 * L : -0.005 * L, sd * L * 0.03, h0 - L * 0.01);
      let fu = (mid ? 0.2 : -0.24) * L * legL, fv = sd * L * (mid ? 0.27 : 0.29) * (1 + 0.15 * crouch) * legL * (LK.flat ? 1.18 : 1), fw = 0;
      if (flatK > 0.01) { fu = M.lerp(fu, (mid ? 0.3 : -0.44) * L * legL, flatK); fv = M.lerp(fv, sd * L * 0.07, flatK); }
      if (dead > 0.01) { fu *= 1 - 0.45 * dead; fv *= 1 - 0.4 * dead; }
      fu += Math.sin(ph) * L * 0.075 * moving; fw += Math.max(0, Math.cos(ph)) * L * 0.05 * moving;
      if (threat) { fv *= 1.15; } if (sleep) fv *= 0.92;
      if (air) { fu = (mid ? 0.12 : -0.3) * L; fv *= 0.75; fw = h0 * 0.5; }
      if (o.curled) { fu *= 0.6; fv *= 0.6; fw = h0 * 0.6; }
      let foot = air || o.curled ? W(fu, fv, fw) : Wf(fu, fv, fw);
      if (piv) foot = lerp3(foot, sum(piv, mul(s, sd * L * (mid ? 0.1 : 0.05)), mul(f, mid ? L * 0.05 : 0)), hk); // hanging: all four feet grip the twig
      const knee = sum(lerp3(hip, foot, 0.42), mul(n, L * (mid ? 0.12 : 0.14) * (1 - 0.3 * crouch) * (legL > 1 ? 1 + (legL - 1) * 0.6 : 1) * (LK.flat ? 0.7 : 1) * (1 - 0.7 * flatK)), mul(s, sd * L * 0.02));
      const ank = add(lerp3(knee, foot, 0.88), mul(n, L * 0.012));
      push(knee, () => {
        limb(ctx, V, [hip, knee], [L * 0.016 * (thin < 1 ? 0.75 + 0.25 * thin : 1)], legC, lod, null);
        limb(ctx, V, [knee, ank, foot], [L * 0.012 * (thin < 1 ? 0.75 + 0.25 * thin : 1), L * 0.008], sh(legC, -0.05), lod, null);
        if (LK.legLobes && lod > 0) leafShape(ctx, V, lerp3(hip, knee, 0.6), mul(sub(knee, hip), 0.3), mul(nrm(sum(mul(n, 0.7), mul(f, mid ? 0.4 : -0.4))), L * 0.026), sh(bodyC, -0.04), ink(bodyC), { lod, round: 1 });
        if (LK.lobes === 'petal' && lod > 0) leafShape(ctx, V, lerp3(hip, knee, 0.55), mul(sub(knee, hip), 0.42), mul(nrm(sum(mul(n, 0.6), mul(f, mid ? 0.5 : -0.5))), L * 0.05), pal.body2 || '#e6b4c8', ink(pal.body2 || '#e6b4c8'), { lod, round: 1 });
      }, L * 0.01 * (sd * M.dot(s, V.toCam) > 0 ? -1 : 1));
      void lk;
    }

    // ---------- held meal: in the arms, under the jaws, never on top of the head ----------
    if (o.meal) { const back = V.depth(holdC) + 0.001; parts.push({ d: back, f: () => { o.meal(holdC, hf0, nrm(M.cross(n, hf0)), n); ctx.globalAlpha = alpha; } }); }
    sortDraw(parts);
    ctx.globalAlpha = 1;
    sp._mHold = holdC; sp._mMouth = mouth; // exposed for the feeding pack (where to anchor prey + crumbs)
  };
  D.spider = D.mantis;
  // shed skins: the right size and stage, left hanging head-down on the twig where the mantis molted
  const remains0 = D.remains;
  D.remains = function (ctx, V, r, fr, o) {
    if (r.cat !== 'exuvia') return remains0.apply(this, arguments);
    const k = M.clamp(r.clean, 0, 1); if (k <= 0.01) return; const fade = Math.min(1, k * 2.2);
    const hang = r.hang && !r._fall && r.sup && r.sup.k === 'path';
    D.mantis(ctx, V, { species: r.species, stage: r.stage != null ? r.stage : 4, state: 'idle', seed: 3, sat: 0.5 }, fr, { len: (r.len || 5) * (0.55 + 0.45 * k), ghost: true, alpha: (hang ? 0.75 : 0.55) * fade, noShadow: true, hangK: hang ? 1 : 0, hangPiv: hang ? r.hang.piv : null, hangNh: hang ? r.hang.nh : null });
  };
})(typeof window !== 'undefined' ? window : globalThis);
