/* Mantis Terrarium pack — eating prey alive (stage 4).
   The catch is held in the raptorial arms just below the jaws (never on top of the head), still alive: it thrashes,
   the struggle fading as it is eaten. The mantis eats from the abdomen end (head last): each bite tugs the meal,
   crumbs fall, and parts come off one by one and drop to the ground, where they lie a while and fade:
     fly: legs, wings, head last · moth: legs, wings (in a puff of scales), antennae, head
     cricket: antennae, small legs, the big hind legs, head · mealworm/caterpillar: shortens segment by segment
     beetle/roach: legs, wing cases, head · another mantis: legs, wings, raptorial arms, head
   Afterwards it grooms: forelegs drawn through the jaws, face wiped. */
(function (root) {
  'use strict';
  const JT = root.JT, AI = JT.SpiderAI, H = AI.H, M = JT.M, D = JT.Draw, CR = D.critter;
  const { blob, limb, sh, mix, hex6, lodFor } = CR;
  const add = M.add, mul = M.mul, sub = M.sub, nrm = M.norm, lerp3 = M.lerp3;
  const R = () => JT.R();

  // ---------------- meal models (all sizes in prey lengths, u along the body from the bitten end to the head) ----------------
  const SEG = {
    fly: [['abd', 0, 0.5, 0.2, 0.17], ['tho', 0.46, 0.8, 0.19, 0.18], ['head', 0.8, 1, 0.19, 0.17]],
    moth: [['abd', 0, 0.52, 0.17, 0.16], ['tho', 0.48, 0.84, 0.2, 0.19], ['head', 0.84, 1, 0.14, 0.13]],
    kicker: [['abd', 0, 0.5, 0.16, 0.15], ['tho', 0.46, 0.8, 0.15, 0.16], ['head', 0.8, 1, 0.15, 0.16]],
    roach: [['abd', 0, 0.56, 0.3, 0.13], ['tho', 0.52, 0.84, 0.28, 0.13], ['head', 0.84, 1, 0.16, 0.12]],
    feeble: [['abd', 0, 0.56, 0.25, 0.2], ['tho', 0.52, 0.82, 0.22, 0.18], ['head', 0.82, 1, 0.17, 0.15]],
    jumper: [['abd', 0, 0.48, 0.1, 0.09], ['tho', 0.46, 0.6, 0.07, 0.07], ['pro', 0.6, 0.9, 0.045, 0.045], ['head', 0.9, 1, 0.08, 0.06]],
  };
  SEG.locust = SEG.kicker; SEG.beetle = SEG.roach;
  const famOf = (p) => p.type === 'jumperMeal' ? 'jumper' : JT.preyFamily(JT.PREY_BY_ID[p.type]);
  const isWorm = (fam) => fam === 'worm' || fam === 'cat';
  function partsOf(fam, p) {
    const P = []; const legs = (n, at) => { for (let i = 0; i < n; i++) P.push({ id: 'L' + i, k: 'leg', i, sd: i % 2 ? 1 : -1, at: at[i] }); };
    const pair = (k, a0, a1, extra) => { P.push(Object.assign({ id: k + '0', k, sd: -1, at: a0 }, extra)); P.push(Object.assign({ id: k + '1', k, sd: 1, at: a1 }, extra)); };
    if (fam === 'fly') { legs(6, [0.06, 0.1, 0.14, 0.18, 0.22, 0.26]); pair('wing', 0.4, 0.5); }
    else if (fam === 'moth') { legs(6, [0.05, 0.09, 0.13, 0.17, 0.21, 0.25]); pair('wing', 0.35, 0.45); pair('ant', 0.55, 0.6); }
    else if (fam === 'kicker' || fam === 'locust') { pair('ant', 0.05, 0.08); legs(4, [0.12, 0.17, 0.22, 0.27]); pair('hind', 0.38, 0.48); if (fam === 'locust') pair('wing', 0.55, 0.6); }
    else if (fam === 'roach' || fam === 'beetle') { legs(6, [0.06, 0.1, 0.14, 0.18, 0.22, 0.26]); pair('ely', 0.45, 0.55); if (fam === 'roach') pair('ant', 0.6, 0.64); }
    else if (fam === 'jumper') { legs(4, [0.06, 0.12, 0.18, 0.24]); if ((p.stage | 0) >= 4) pair('wing', 0.35, 0.42); pair('arm', 0.5, 0.58); pair('ant', 0.62, 0.66); }
    else if (!isWorm(fam)) legs(6, [0.1, 0.14, 0.18, 0.22, 0.26, 0.3]);
    return P;
  }
  function colsOf(p, fam) {
    const def = JT.PREY_BY_ID[p.type] || {};
    if (fam === 'jumper') { const S = JT.SPECIES_BY_ID[p.species] || JT.SPECIES[0]; const pl = S.pal || {}; return { body: hex6(pl.body || '#8a9a5a'), leg: hex6(pl.leg || pl.body || '#8a9a5a'), wing: hex6(pl.wing || pl.body || '#a0b070'), eye: hex6(pl.eye || '#c8c890') }; }
    const c = hex6(def.col || '#6a5a40');
    return { body: c, leg: sh(c, -0.12), wing: fam === 'moth' ? mix(c, '#e8dcc0', 0.35) : fam === 'locust' ? mix(c, '#d8c890', 0.4) : 'rgba(225,232,240,0.5)', eye: def.eye ? hex6(def.eye) : sh(c, -0.4) };
  }
  const famLeg = (fam) => fam === 'kicker' || fam === 'locust' ? [0, 1] : [0, 1, 2]; // pair index along the thorax

  /** Draw one detachable part. P(u, v, w) maps local body coordinates (prey lengths) to the world. */
  function drawPart(ctx, V, fam, q, P, Lp, C, fl, t, lod, segs) {
    const tho = segs.find(s => s[0] === 'tho') || segs[1]; const tm = (tho[1] + tho[2]) / 2, tw = tho[3], th = tho[4];
    const sd = q.sd; const wv = (k) => Math.sin(t * (17 + k * 3) + k * 1.7) * fl;
    if (q.k === 'leg') {
      const pr = famLeg(fam), k = Math.floor(q.i / 2) % pr.length, n = pr.length; const ua = tm + (n > 2 ? (0.07 - k * 0.07) : (0.05 - k * 0.08));
      const hip = P(ua, sd * tw * 0.55, -th * 0.35);
      const knee = P(ua + (0.06 - k * 0.07) + wv(q.i) * 0.05, sd * (tw * 0.55 + 0.22), -th * 0.3 + 0.06 + wv(q.i + 2) * 0.1);
      const foot = P(ua + (0.12 - k * 0.15) + wv(q.i + 1) * 0.08, sd * (tw * 0.55 + 0.34), -0.18 + wv(q.i + 3) * 0.12);
      limb(ctx, V, [hip, knee, foot], [Lp * 0.022, Lp * 0.014], C.leg, lod, null);
    } else if (q.k === 'hind') { // the big jumping legs: thick femur back along the body, tibia folded under, kicking
      const ua = tho[1] + 0.03; const kick = Math.max(0, wv(5)) * 0.25;
      const hip = P(ua, sd * tw * 0.6, -th * 0.2); const knee = P(ua - 0.32 + kick * 0.3, sd * (tw * 0.6 + 0.12), th * 0.35);
      const foot = P(ua - 0.12 - kick, sd * (tw * 0.6 + 0.2), -0.12 - kick * 0.4);
      limb(ctx, V, [hip, knee], [Lp * 0.06, Lp * 0.03], sh(C.leg, 0.05), lod, null); limb(ctx, V, [knee, foot], [Lp * 0.022, Lp * 0.014], C.leg, lod, null);
    } else if (q.k === 'wing') { // fly/locust: clear wings over the back; moth: broad scaled wings; flutter while it struggles
      const big = fam === 'moth' ? 1.25 : 1; const spread = (fam === 'fly' ? 0.12 : 0.05) + Math.abs(wv(7)) * 0.35;
      const base = P(tm, sd * tw * 0.3, th * 0.7); const tip = P(tm - 0.62 * big, sd * (tw * 0.6 + spread), th * 0.9 + Math.abs(wv(8)) * 0.15);
      const c = lerp3(base, tip, 0.5); const ax = mul(sub(tip, base), 0.5); const across = sub(P(tm - 0.3, sd * (tw * 0.6 + spread + 0.2 * big), th * 0.8), P(tm - 0.3, sd * tw * 0.3, th * 0.8));
      const ay = mul(nrm(sub(across, mul(nrm(ax), M.dot(across, nrm(ax))))), Lp * (fam === 'moth' ? 0.24 : 0.14));
      CR.wing(ctx, V, c, ax, ay, C.wing, fam === 'fly' ? 'rgba(60,60,70,0.55)' : sh(C.body, -0.35), lod === 2, lod);
    } else if (q.k === 'ely') { // beetle/roach wing case
      const c = P(0.33, sd * tw * 0.42, th * 0.75); blob(ctx, V, c, sub(P(0.6, sd * tw * 0.42, th * 0.75), c), sub(P(0.33, sd * tw * 0.95, th * 0.6), c), sub(P(0.33, sd * tw * 0.42, th * 1.15), c), sh(C.body, 0.06), { lod, gloss: 0.7 });
    } else if (q.k === 'ant') {
      const hd = segs[segs.length - 1]; const a = P(hd[2] - 0.02, sd * 0.03, hd[4] * 0.5); const len = fam === 'kicker' || fam === 'locust' ? 0.7 : fam === 'moth' ? 0.4 : 0.35;
      const b = P(hd[2] + len * 0.45, sd * len * 0.3, 0.1 + wv(9) * 0.1), c = P(hd[2] + len * 0.8, sd * len * 0.6, len * 0.35 + wv(10) * 0.2);
      CR.curve(ctx, V, a, b, c, Lp * (fam === 'moth' ? 0.016 : 0.009), sh(C.leg, -0.15));
    } else if (q.k === 'arm') { // a mantis' raptorial foreleg, folded
      const a = P(0.86, sd * 0.04, -0.02), k = P(0.76, sd * 0.09, -0.13 + wv(11) * 0.05), b = P(0.88, sd * 0.07, -0.09);
      limb(ctx, V, [a, k], [Lp * 0.03, Lp * 0.022], C.leg, lod, null); limb(ctx, V, [k, b], [Lp * 0.018, Lp * 0.012], C.leg, lod, null);
    }
  }
  /** Where a part sits (for dropping it and for drawing it on its own on the ground). */
  function partAnchor(fam, q, segs) {
    const tho = segs.find(s => s[0] === 'tho') || segs[1]; const tm = (tho[1] + tho[2]) / 2; const hd = segs[segs.length - 1];
    if (q.k === 'leg') return [tm, q.sd * 0.3, -0.1]; if (q.k === 'hind') return [tho[1] - 0.15, q.sd * 0.25, 0];
    if (q.k === 'wing') return [tm - 0.3, q.sd * 0.25, 0.2]; if (q.k === 'ely') return [0.33, q.sd * 0.3, 0.1];
    if (q.k === 'ant') return [hd[2] + 0.3, q.sd * 0.2, 0]; return [0.8, q.sd * 0.07, -0.1];
  }

  /** The held meal, drawn alive. mp = between the arms below the jaws, fg = head forward, sg = side, n = up. */
  function drawMeal(R0, ctx, V, sp, p, mp, fg, sg, n, L) {
    const def = JT.PREY_BY_ID[p.type] || { len: 3 }; const fam = famOf(p); const T = R0.time; const C = colsOf(p, fam);
    const Lp = Math.min(p.len || def.len || 3, L * 1.1); const u = M.clamp(p._mEat || 0, 0, 1);
    const st = sp.state === 'subdue' ? Math.max(p._struggle || 0, 0.7) : sp.state === 'secure' ? Math.max(p._struggle || 0, 0.35) : sp.state === 'carry' ? 0.3 * (1 - u) : (sp.state === 'feed' ? 0.6 * (1 - M.smooth(M.clamp(u / 0.7, 0, 1))) : 0);
    const fl = st * (0.6 + 0.4 * Math.abs(Math.sin(T * 1.7 + (p.seed || 0)))); // the struggle comes in fits
    const feeding = sp.state === 'feed' && !(sp._chewPause > (JT.app && JT.app.game ? JT.app.game.hab.time : 0));
    const bite = feeding ? Math.max(0, Math.sin(T * 2.3 + (sp.seed || 1))) : 0; // same rhythm as the mantis' head tug
    const mouth = add(add(mp, mul(n, L * 0.035)), mul(fg, -L * 0.045));
    // body axis: out from the jaws, forward and down; thrashing twists it
    const w1 = Math.sin(T * 13 + 0.5) * 0.35 * fl, w2 = Math.sin(T * 9.3 + 2) * 0.3 * fl;
    const dn = 0.8 - 0.9 * M.clamp(Lp / L - 0.25, 0, 0.5); let ax = nrm(add(mul(fg, 0.6), mul(n, -dn))); // big prey is held more forward, clear of the ground ax = nrm(add(ax, add(mul(sg, w1), mul(n, w2 * 0.6))));
    let sdv = nrm(sub(sg, mul(ax, M.dot(sg, ax)))); const roll = Math.sin(T * 7 + 1) * 0.5 * fl; let up = nrm(M.cross(sdv, ax)); if (M.dot(up, n) < 0) up = mul(up, -1);
    const sv = add(mul(sdv, Math.cos(roll)), mul(up, Math.sin(roll))); up = nrm(M.cross(sv, ax)); if (M.dot(up, n) < 0) up = mul(up, -1); sdv = sv;
    const B = add(add(mouth, mul(ax, Lp * 0.06 - Lp * 0.04 * bite)), mul(fg, L * 0.012)); // just below the jaws, clear of the face // each bite pulls the meal into the jaws
    const lod = lodFor(Lp * V.s * 0.6, {}); const cs = [];
    const P = (uu, v, w) => add(B, add(mul(ax, uu * Lp), add(mul(sdv, v * Lp), mul(up, w * Lp))));
    if (isWorm(fam)) { // segment by segment: one goes, then a pause, then the next
      const N = 9, x = M.clamp(u / 0.92, 0, 1) * (N - 1); const eat = (Math.floor(x) + M.smooth(M.clamp((x % 1) * 3 - 2, 0, 1))) / N;
      const hs = 1 - M.smooth(M.clamp((u - 0.92) / 0.08, 0, 1)); const sl = 1 / N;
      for (let i = 0; i < N; i++) {
        const u0 = i * sl, u1 = u0 + sl; if (u1 <= eat + 1e-3) continue; const head = i === N - 1; const a0 = Math.max(u0, eat) - eat; let a1 = u1 - eat; if (head) a1 = a0 + (a1 - a0) * hs; if (head && hs < 0.05) continue; const c = (a0 + Math.max(a0 + 0.01, a1)) / 2; const wr = Math.sin(T * 6 + i * 1.3) * 0.06 * fl * (i / N);
        const cc = P(c, wr, 0); const r = (head ? 0.075 : 0.085) * (head ? hs : 1);
        cs.push({ d: V.depth(cc), f: () => blob(ctx, V, cc, mul(ax, Math.max(0.01, a1 - a0) * Lp * 0.62), mul(sdv, r * Lp), mul(up, r * Lp * 0.9), head ? sh(C.body, -0.25) : i % 2 ? C.body : sh(C.body, 0.06), { lod, gloss: 0.45 }) });
      }
    } else {
      const segs = SEG[fam] || SEG.feeble; const hd = segs[segs.length - 1];
      const e = M.clamp((u - 0.08) / 0.82, 0, 1) * hd[1]; // eaten so far, from the bitten end up to the head
      const hs = 1 - M.smooth(M.clamp((u - 0.9) / 0.1, 0, 1)); // the head goes last
      const Ps = (uu, v, w) => P(uu - e, v, w);
      for (const s of segs) {
        let u0 = Math.max(s[1], e), u1 = s[2]; if (u1 - u0 < 0.015) continue; const head = s[0] === 'head'; if (head && hs < 0.04) continue;
        const k = head ? hs : 1; const c0 = Ps((u0 + u1) / 2, 0, 0); const cc = head ? lerp3(B, c0, hs) : c0;
        const col = head ? sh(C.body, -0.12) : s[0] === 'abd' ? sh(C.body, 0.05) : C.body;
        cs.push({ d: V.depth(cc), f: () => { blob(ctx, V, cc, mul(ax, (u1 - u0) * Lp * 0.55 * k), mul(sdv, s[3] * Lp * 0.5 * k), mul(up, s[4] * Lp * 0.5 * k), col, { lod, gloss: 0.4 });
          if (head && lod > 0 && k > 0.3) for (const sd of [-1, 1]) { const ec = add(cc, add(mul(sdv, sd * s[3] * Lp * 0.42 * k), add(mul(ax, (u1 - u0) * Lp * 0.15 * k), mul(up, s[4] * Lp * 0.15)))); blob(ctx, V, ec, mul(ax, Lp * 0.05 * k), mul(sdv, Lp * 0.05 * k), mul(up, Lp * 0.05 * k), C.eye, { lod, gloss: 0.8 }); } } });
      }
      const gone = p._mGone || {}; const seen = p._mSeen || (p._mSeen = {}); const pp = p._mPP || (p._mPP = {});
      for (const q of partsOf(fam, p)) {
        const an = partAnchor(fam, q, segs); const wp = Ps(an[0], an[1], an[2]); pp[q.id] = wp;
        if (gone[q.id]) { if (!seen[q.id]) { seen[q.id] = 1; if (fam === 'moth' && q.k === 'wing' && R0.particles.length < 380) for (let i = 0; i < 14; i++) R0.particles.push({ pos: wp.slice(), v: [(R() - 0.5) * 7, R() * 3, (R() - 0.5) * 7], t: 0, life: 1.2 + R(), col: 'rgba(225,205,165,0.8)', r: 0.12 + R() * 0.14 }); } continue; }
        cs.push({ d: V.depth(wp) + (q.k === 'wing' ? -0.01 : 0), f: () => drawPart(ctx, V, fam, q, Ps, Lp, C, fl, T, lod, segs) });
      }
    }
    cs.sort((a, b) => b.d - a.d); const a0 = ctx.globalAlpha; for (const c of cs) { c.f(); ctx.globalAlpha = a0; }
    // crumbs drop from the jaws with the bites; a moth keeps shedding scales while it flutters
    if (feeding && bite > 0.85 && R() < 0.12 && R0.particles.length < 380) R0.particles.push({ pos: mouth.slice(), v: [(R() - 0.5) * 4, -1 - R() * 2, (R() - 0.5) * 4], t: 0, life: 0.9 + R() * 0.6, col: sh(C.body, -0.1), r: Math.max(0.1, Lp * 0.025) * (0.6 + R() * 0.6) });
    if (fam === 'moth' && fl > 0.2 && !(p._mGone || {}).wing0 && R() < fl * 0.2 && R0.particles.length < 380) R0.particles.push({ pos: P(0.3, 0, 0.2), v: [(R() - 0.5) * 6, 1 + R() * 3, (R() - 0.5) * 6], t: 0, life: 1 + R(), col: 'rgba(225,205,165,0.75)', r: 0.12 + R() * 0.12 });
  }
  if (JT.Renderer) JT.Renderer.prototype.drawHeld = function (ctx, V, sp, p, mp, fg, sg, n, L) { drawMeal(this, ctx, V, sp, p, mp, fg, sg, n, L); };

  // ---------------- dropped parts lying on the ground ----------------
  const remains1 = D.remains;
  D.remains = function (ctx, V, r, fr, o) {
    if (r.cat !== 'mpart') return remains1.apply(this, arguments);
    const fade = M.clamp(r.clean * 3, 0, 1); if (fade <= 0.01) return; const fam = r.fam; const segs = SEG[fam] || SEG.feeble; const q = r.part;
    const an = partAnchor(fam, q, segs); const Lp = r.plen; const lod = lodFor(Lp * V.s * 0.6, {});
    const P = (u, v, w) => add(fr.p, add(mul(fr.f, (u - an[0]) * Lp), add(mul(fr.s, (v - an[1]) * Lp), mul(fr.n, Lp * 0.03 + Math.max(0, w - an[2]) * Lp * 0.12))));
    ctx.globalAlpha = fade * 0.95; drawPart(ctx, V, fam, q, P, Lp, r.cols, 0, 0, lod, segs); ctx.globalAlpha = 1;
  };

  // ---------------- behaviour: eating progress, parts dropping, struggle, grooming after ----------------
  function dropPart(hab, sp, p, fam, q, Lp) {
    const d = hab.data; const from = (p._mPP && p._mPP[q.id] && M.finite3(p._mPP[q.id])) ? p._mPP[q.id].slice() : (sp._mHold && M.finite3(sp._mHold) ? sp._mHold.slice() : sp.pos.slice());
    if (Lp < 3.5) return; // too small to see
    const mine = d.remains.filter(r => r.cat === 'mpart'); if (mine.length >= 14 || d.remains.length >= 39) { const old = mine[0]; if (old) d.remains = d.remains.filter(r => r !== old); }
    const r = { id: JT.newId('r'), kind: p.type, cat: 'mpart', fam, part: { id: q.id, k: q.k, i: q.i, sd: q.sd }, plen: Lp, cols: colsOf(p, fam), pos: [from[0] + (R() - 0.5) * 1.5, from[1], from[2] + (R() - 0.5) * 1.5], sup: { k: 'air' }, age: 0, clean: 1, ang: R() * 6.28 };
    d.remains.push(r); hab.dropRemains(r);
  }
  const update1 = AI.update;
  AI.update = function (hab, sp, dt) {
    const s0 = sp.state; const held0 = sp.hold;
    update1.call(this, hab, sp, dt);
    const p = sp.hold && hab.preyById(sp.hold);
    if (p) {
      const fam = famOf(p); const def = JT.PREY_BY_ID[p.type] || { len: 3 }; const Lp = Math.min(p.len || def.len || 3, AI.len(sp) * 1.1);
      if (p._mEat == null) { p._mEat = 0; p._mGone = {}; mealStart(hab, sp, p); }
      if (sp.state === 'feed' && !(sp._chewPause > hab.time) && sp._feedDur > 0) p._mEat = Math.min(1, p._mEat + dt / sp._feedDur);
      for (const q of partsOf(fam, p)) if (!p._mGone[q.id] && p._mEat >= q.at) { p._mGone[q.id] = 1; dropPart(hab, sp, p, fam, q, Lp); if (!p._mJL && Object.keys(p._mGone).length >= 2) { p._mJL = 1; hab.event('journal', { id: 'leftovers', sp }); } }
      if (sp.state === 'feed' && !p._mJA && p._mEat > 0.08 && p._mEat < 0.4) { p._mJA = 1; hab.event('journal', { id: 'eatenAlive', sp }); }
      if (sp.state === 'feed') { p._struggle = 0.6 * (1 - M.smooth(M.clamp(p._mEat / 0.7, 0, 1))); if (p._mEat >= 1) sp.st = Math.max(sp.st, sp._feedDur); }
      if (sp.state === 'feed' && p._mEat > 0.05 && p._mEat < 0.7) sp.thought = p._mEat < 0.35 ? 'Eating the ' + nm(p) + ' alive — it is still kicking.' : 'Chewing steadily; the ' + nm(p) + "'s struggles are fading.";
    }
    // the meal is finished: nothing much is left (the dropped parts are the remains); then a thorough clean-up
    if (held0 && !sp.hold && s0 === 'feed' && sp.state === 'postFeed') {
      const rs = hab.data.remains; const last = rs[rs.length - 1]; if (last && (last.cat === 'husk' || last.cat === 'spider') && M.dist(last.pos, sp.pos) < AI.len(sp) * 2) rs.pop();
      sp._mGroomLong = true; hab.event('journal', { id: 'mantisGroom', sp }); AI.setState(sp, 'groom', 'Finished — now cleaning up: each foreleg drawn through the jaws, then a wipe of the face.');
    }
  };
  function mealStart(hab, sp, p) {
    const g = sp.sup && sp.sup.d != null ? hab.geoms[sp.sup.d] : null; const def = g && g.def;
    if ((sp.species === 'orchid' || sp.species === 'spiny' || sp.species === 'devilsflower') && def && (def.flowers || def.arche === 'flower' || /orchid|flower/.test(def.id))) hab.event('journal', { id: 'flowerLure', sp });
    const bid = JT.Biomes.id(hab); if (['ghost', 'carolina', 'deadleaf', 'bark', 'stick'].includes(sp.species) && (bid === 'dryleaf' || bid === 'oldbark')) hab.event('journal', { id: 'camoHunt', sp });
  }
  const nm = (p) => p.type === 'jumperMeal' ? 'mantis' : AI.preyName ? AI.preyName(JT.PREY_BY_ID[p.type] || { name: 'prey' }) : ((JT.PREY_BY_ID[p.type] || {}).name || 'prey').toLowerCase();
  const groom0 = H.groom;
  H.groom = function (hab, sp, dt) { if (sp._mGroomLong) { if (sp.st > 9 + sp.pers.routine * 3) { sp._mGroomLong = false; AI.setState(sp, 'idle'); } return; } groom0(hab, sp, dt); };
  // dropped parts fade over about a minute (the engine's own decay is far slower)
  const nests1 = AI.updateNests;
  AI.updateNests = function (hab, dt) { nests1(hab, dt); const rs = hab.data.remains; let gone = false; for (const r of rs) if (r.cat === 'mpart') { r.clean -= dt / 60; if (r.clean <= 0) gone = true; } if (gone) hab.data.remains = rs.filter(r => r.cat !== 'mpart' || r.clean > 0); };
  JT.MantisMeal = { partsOf, famOf, drawMeal, SEG };
})(typeof window !== 'undefined' ? window : globalThis);
