!function(root) {
    "use strict";
    const JT = root.JT, M = JT.M;
    if (!JT || !M) return;
    const add = M.add, sub = M.sub, mul = M.mul, dot = M.dot, len = M.len, G = JT.Gait = {
        on: !0
    }, flat = (v, n) => sub(v, mul(n, dot(v, n))), KIND = {
        spider: {
            stride: .2,
            sw: [ .07, .16 ],
            lift: 1,
            legs: 8,
            turn: "snap"
        }
    };
    function resetLegs(R) {
        R.legs = {}, R.swing = 0;
    }
    G.KIND = KIND, G.rig = function(sp, o, fr, L, kind) {
        if (!G.on || !sp || null == sp.id || o.thumb || o.ghost || null == o.time || !fr || !M.finite3(fr.p)) return null;
        if (root.JT_NO_GAIT) return null;
        const t = o.time;
        let R = sp._rig;
        R && R.kind === kind || (R = sp._rig = {
            kind: kind,
            K: KIND[kind],
            L: L,
            t: t,
            legs: {},
            swing: 0,
            p: fr.p.slice(),
            v: [ 0, 0, 0 ],
            vf: null,
            turning: !1,
            still: 0,
            bob: 0,
            bv: 0,
            ay: 0,
            ayv: 0,
            ap: 0,
            apv: 0,
            air: !!o.airborne,
            yawR: 0,
            twT: 2 + 3 * Math.random(),
            tap: null,
            tapT: 3 + 6 * Math.random(),
            settleCD: 0,
            fid: 0
        });
        let dt = t - R.t;
        if ((dt < -1e-6 || dt > .5 || Math.abs(L - R.L) > .25 * R.L) && (resetLegs(R), R.vf = null, 
        R.v = [ 0, 0, 0 ], R.p = fr.p.slice(), R.t = t, R.L = L, dt = 0), dt <= 1e-6) return R.dt = 0, 
        M.dist(fr.p, R.p) < .02 * L ? R : null;
        dt = Math.min(dt, .1), R.dt = dt, R.t = t, R.L = L, R.fid++;
        const dp = sub(fr.p, R.p);
        len(dp) > 2 * L ? (resetLegs(R), R.vf = null, R.v = [ 0, 0, 0 ]) : R.v = M.lerp3(R.v, mul(dp, 1 / dt), Math.min(1, 12 * dt)), 
        R.p = fr.p.slice();
        const spd = len(R.v);
        R.still = spd < .2 * L ? R.still + dt : 0, R.spd = spd;
        const air = !!o.airborne;
        R.air && !air && (R.bv -= L * ("spider" === kind ? 1.6 : .9), R.apv -= 2.2), R.air = air;
        const sk = "spider" === kind ? 260 : 120, sc = "spider" === kind ? 22 : 15;
        R.bv += (-sk * R.bob - sc * R.bv) * dt, R.bob = M.clamp(R.bob + R.bv * dt, .06 * -L, .03 * L);
        const ayT = M.clamp(-R.yawR * ("spider" === kind ? .05 : .09), -.4, .4);
        R.ayv += (90 * (ayT - R.ay) - 11 * R.ayv) * dt, R.ay = M.clamp(R.ay + R.ayv * dt, -.5, .5), 
        R.apv += (-140 * R.ap - 12 * R.apv) * dt, R.ap = M.clamp(R.ap + R.apv * dt, -.35, .35), 
        R.settleCD = Math.max(0, R.settleCD - dt);
        const hunt = /^(stalk|creep|crouch|display|assess|lunge|watch|fingerWatch)$/.test(sp.state || "");
        return "spider" === kind && hunt && (R.twT -= dt, R.twT <= 0 && (R.twT = .6 + 2.2 * Math.random(), 
        R.apv += (Math.random() < .5 ? -1 : 1) * (2.5 + 2 * Math.random()))), R.tap ? (R.tap.k += dt / R.tap.T, 
        R.tap.k >= 1 && (R.tap = null)) : R.still > 1.2 && !air && /^(idle|look|watch|rest|bask|scan|alert|wait)$/.test(sp.state || "idle") && (R.tapT -= dt, 
        R.tapT <= 0 && (R.tapT = 4 + 9 * Math.random(), R.tap = {
            lk: (Math.random() < .5 ? 0 : 1) + ("spider" === kind && Math.random() < .3 ? 2 : 0),
            k: 0,
            T: "spider" === kind ? .55 : .9,
            n: "spider" === kind ? 2 + (2 * Math.random() | 0) : 1
        })), R;
    }, G.tapOf = function(R, lk) {
        if (!R || !R.tap || R.tap.lk !== lk) return 0;
        const k = R.tap.k;
        return Math.sin(Math.PI * M.clamp(k, 0, 1)) * (.55 + .45 * Math.abs(Math.sin(k * Math.PI * R.tap.n)));
    }, G.heading = function(R, fr, enable) {
        const f = fr.f, s = fr.s, n = fr.n;
        if (!R) return null;
        if (!enable) return R.vf = f.slice(), R.turning = !1, R.yawR = M.lerp(R.yawR, 0, Math.min(1, 8 * (R.dt || 0))), 
        null;
        let vf = R.vf ? flat(R.vf, n) : null;
        (!vf || len(vf) < .3) && (vf = f.slice()), vf = M.norm(vf);
        let a = Math.atan2(dot(vf, s), dot(vf, f));
        if (R.dt > 0) {
            const dt = R.dt;
            {
                const thr = R.spd > .6 * R.L ? .18 : .4;
                if (!R.turning && (Math.abs(a) > thr || Math.abs(a) > .035 && R.still > .5) && (R.turning = !0), 
                R.turning) {
                    const st = Math.min(Math.abs(a), 14 * dt);
                    a -= Math.sign(a) * st, Math.abs(a) < .012 && (a = 0, R.turning = !1);
                }
            }
            a = M.clamp(a, -.75, .75);
            let aiR = 0;
            if (R._f) {
                const pf = M.norm(flat(R._f, n));
                aiR = Math.atan2(dot(M.cross(pf, f), n), dot(pf, f)) / dt;
            }
            R.yawR = M.lerp(R.yawR, M.clamp(aiR + (a - (R._a || 0)) / dt, -12, 12), Math.min(1, 10 * dt));
        }
        R._f = f.slice(), R._a = a;
        const ca = Math.cos(a), sa = Math.sin(a), f2 = M.norm(add(mul(f, ca), mul(s, sa))), s2 = M.norm(sub(mul(s, ca), mul(f, sa)));
        return R.vf = f2, {
            f: f2,
            s: s2,
            a: a
        };
    }, G.foot = function(R, lk, target, free, n, mul0) {
        const K = R.K, L = R.L;
        let g = R.legs[lk];
        if (g || (g = R.legs[lk] = {
            p: target.slice(),
            k: -1,
            out: target.slice(),
            lift: 0
        }), !(R.dt > 0)) return g.out || target;
        if (g.fid === R.fid) return g.out;
        g.fid = R.fid, free = M.clamp(free || 0, 0, 1);
        const dt = R.dt;
        if (g.tg = target, g.fr = free, free > .985) return g.k >= 0 && R.swing--, g.p = target.slice(), 
        g.k = -1, g.lift = 0, g.out = target.slice(), g.out;
        const stride = L * K.stride * (mul0 || 1);
        M.dist(g.p, target) > .9 * L && (g.p = target.slice(), g.k >= 0 && (g.k = -1, R.swing--));
        let lead = flat(mul(R.v, .9 * K.sw[1]), n);
        const ll = len(lead);
        ll > .75 * stride && (lead = mul(lead, .75 * stride / ll));
        const tv = g.ltg ? M.dist(target, g.ltg) / dt : 0;
        g.ltg = target, g.tv = M.lerp(g.tv || 0, tv, Math.min(1, 10 * dt));
        const swingT = M.clamp(.42 * stride / Math.max(R.spd, g.tv, .001), .8 * K.sw[0], K.sw[1]);
        let pos;
        if (g.k >= 0) if (g.k += dt / g.T, g.to = M.lerp3(g.to, add(target, lead), Math.min(1, 14 * dt)), 
        g.k >= 1) g.p = g.to.slice(), g.k = -1, R.swing--, g.lift = 0, R.bv -= L * (8 === K.legs ? .05 : .08), 
        pos = g.p; else {
            const e = (k = g.k) * k * (3 - 2 * k), h = g.h * Math.pow(Math.sin(Math.PI * Math.min(1, 1.08 * g.k)), .75);
            g.lift = h, pos = add(M.lerp3(g.from, g.to, e), mul(n, h));
        } else {
            const err = M.dist(g.p, target), nb = [ 1 ^ lk, lk - 2, lk + 2 ];
            let busy = !1;
            for (const q of nb) {
                const h = R.legs[q];
                if (h && h.k >= 0 && h.k < .85) {
                    busy = !0;
                    break;
                }
            }
            const room = R.swing < K.legs / 2 && !busy, settle = R.still > .3 && err > .28 * stride && R.settleCD <= 0, keep = 8 === K.legs ? 4 : 2;
            !room && err > 2.1 * stride && (R.swing <= K.legs - keep || (g.p = M.lerp3(g.p, target, Math.min(1, 5 * dt)))), 
            (room && (err > stride || settle) || err > 2.3 * stride && R.swing < K.legs - keep) && (g.from = g.p.slice(), 
            g.to = add(target, lead), g.k = 0, g.T = settle && err <= stride ? 1.1 * K.sw[1] : swingT, 
            R.swing++, g.h = M.clamp(.55 * err, .03 * L, .11 * L) * K.lift, settle && (R.settleCD = .45 * K.sw[1])), 
            pos = g.p;
        }
        var k;
        return g.out = free > .005 ? M.lerp3(pos, target, free) : pos.slice(), g.out;
    }, G.liftOf = (R, lk) => {
        const g = R && R.legs[lk];
        return g && g.k >= 0 ? M.clamp(g.lift / (.06 * R.L), 0, 1) : 0;
    }, G.knee = function(hip, foot, l1, l2, hint) {
        const d = sub(foot, hip), D = len(d);
        if (D < 1e-6) return hint;
        const u = mul(d, 1 / D), Dm = Math.min(D, .999 * (l1 + l2)), a = (l1 * l1 - l2 * l2 + Dm * Dm) / (2 * Dm), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
        let b = sub(hint, hip);
        b = sub(b, mul(u, dot(b, u)));
        const bl = len(b);
        return bl < 1e-6 ? hint : add(add(hip, mul(u, a)), mul(b, h / bl));
    };
}("undefined" != typeof window ? window : globalThis);
