!function() {
    "use strict";
    const JT = ("undefined" != typeof window ? window : globalThis).JT, M = JT.M, D = JT.Draw, LG = JT.LIGHT, shc = new Map, hex6 = c => 4 === c.length ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
    function sh(c, a) {
        const k = c + a;
        let v = shc.get(k);
        return void 0 === v && (v = JT.shade(hex6(c), a), shc.size > 4e3 && shc.clear(), 
        shc.set(k, v)), v;
    }
    const mixc = new Map;
    function mix(a, b, t) {
        if ((t = Math.round(20 * t) / 20) <= 0) return hex6(a);
        const k = a + b + t;
        let v = mixc.get(k);
        return void 0 === v && (v = D.mix(hex6(a), hex6(b), t), mixc.size > 4e3 && mixc.clear(), 
        mixc.set(k, v)), v;
    }
    const ink = c => mix(sh(c, -.62), "#1a1008", .35);
    function projEll(V, ax, ay, az) {
        const a = V.J(ax), b = V.J(ay), c = az ? V.J(az) : [ 0, 0 ], sxx = a[0] * a[0] + b[0] * b[0] + c[0] * c[0], syy = a[1] * a[1] + b[1] * b[1] + c[1] * c[1], sxy = a[0] * a[1] + b[0] * b[1] + c[0] * c[1], m = (sxx + syy) / 2, d = Math.sqrt((sxx - syy) * (sxx - syy) / 4 + sxy * sxy);
        return {
            r1: Math.sqrt(m + d),
            r2: Math.sqrt(Math.max(1e-6, m - d)),
            ang: .5 * Math.atan2(2 * sxy, sxx - syy)
        };
    }
    function surfToward(c, ax, ay, az, dir) {
        const k0 = M.dot(ax, dir), k1 = M.dot(ay, dir), k2 = M.dot(az, dir), l = Math.hypot(k0, k1, k2) || 1;
        return [ c[0] + (ax[0] * k0 + ay[0] * k1 + az[0] * k2) / l, c[1] + (ax[1] * k0 + ay[1] * k1 + az[1] * k2) / l, c[2] + (ax[2] * k0 + ay[2] * k1 + az[2] * k2) / l ];
    }
    let HV = [ 0, 1, 0 ], HVkey = "";
    function blob(ctx, V, c, ax, ay, az, col, o) {
        const P = V.P(c), e = projEll(V, ax, ay, az), R = e.r1;
        if (R < .35) return;
        const lod = o.lod;
        if (ctx.beginPath(), ctx.ellipse(P[0], P[1], R, Math.max(.3, e.r2), e.ang, 0, 6.283), 
        0 === lod || R < 2) return ctx.fillStyle = col, void ctx.fill();
        const hp = V.P(surfToward(c, ax, ay, az, LG));
        if (1 === lod || R < 5) ctx.fillStyle = sh(col, -.22), ctx.fill(), ctx.fillStyle = sh(col, .18), 
        ctx.beginPath(), ctx.ellipse(M.lerp(P[0], hp[0], .45), M.lerp(P[1], hp[1], .45), .62 * R, Math.max(.3, .62 * e.r2), e.ang, 0, 6.283), 
        ctx.fill(); else {
            const gx = M.lerp(P[0], hp[0], .7), gy = M.lerp(P[1], hp[1], .7), g = ctx.createRadialGradient(gx, gy, .04 * R, M.lerp(P[0], hp[0], .15), M.lerp(P[1], hp[1], .15), 1.22 * R);
            g.addColorStop(0, sh(col, .34)), g.addColorStop(.42, col), g.addColorStop(.85, sh(col, -.42)), 
            g.addColorStop(1, sh(col, -.25)), ctx.fillStyle = g, ctx.fill();
        }
        if (o.hatch && R > 15 && function(ctx, P, e, hp, col) {
            ctx.save(), ctx.beginPath(), ctx.ellipse(P[0], P[1], e.r1, e.r2, e.ang, 0, 6.283), 
            ctx.clip();
            const dx = P[0] - hp[0], dy = P[1] - hp[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, R = e.r1;
            ctx.strokeStyle = ink(col), ctx.globalAlpha *= .32, ctx.lineWidth = Math.max(.5, .025 * R), 
            ctx.beginPath();
            for (let k = -6; k <= 6; k++) {
                const off = k * R * .13, bx = P[0] + ux * R * .35 - uy * off, by = P[1] + uy * R * .35 + ux * off;
                ctx.moveTo(bx - ux * R * .2 - uy * R * .2, by - uy * R * .2 + ux * R * .2), ctx.lineTo(bx + ux * R * .9 + uy * R * .25, by + uy * R * .9 - ux * R * .25);
            }
            ctx.stroke(), ctx.restore();
        }(ctx, P, e, hp, col), o.sheen && function(ctx, P, e, V, kind, t) {
            const h = ((57 * V.yaw + (3 === kind ? 290 : 2 === kind ? 200 : 140) + 25 * Math.sin(.7 * t)) % 360 + 360) % 360;
            ctx.save(), ctx.beginPath(), ctx.ellipse(P[0], P[1], e.r1, e.r2, e.ang, 0, 6.283), 
            ctx.clip();
            const g = ctx.createLinearGradient(P[0] - e.r1, P[1] - e.r1, P[0] + e.r1, P[1] + e.r1);
            g.addColorStop(0, "hsla(" + h + ",90%,60%,0)"), g.addColorStop(.45, "hsla(" + h + ",90%,62%,0.42)"), 
            g.addColorStop(.6, "hsla(" + (h + 60) % 360 + ",90%,65%,0.3)"), g.addColorStop(1, "hsla(" + h + ",90%,60%,0)"), 
            ctx.fillStyle = g, ctx.fillRect(P[0] - e.r1, P[1] - e.r1, 2 * e.r1, 2 * e.r1), ctx.restore();
        }(ctx, P, e, V, o.sheen, o.time || 0), !1 !== o.ink && R > 2.5 && (ctx.beginPath(), 
        ctx.ellipse(P[0], P[1], R, Math.max(.3, e.r2), e.ang, 0, 6.283), ctx.lineWidth = Math.max(.45, Math.min(1.5, .065 * R)), 
        ctx.strokeStyle = ink(col), ctx.stroke()), o.fuzz && R > 7 && function(ctx, P, e, col, amt, R) {
            const ca = Math.cos(e.ang), sa = Math.sin(e.ang), n = Math.min(30, 10 + (0 | R));
            ctx.strokeStyle = col, ctx.lineWidth = Math.max(.5, .03 * R), ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const th = i / n * 6.283 + i % 3 * .07, x = Math.cos(th) * e.r1, y = Math.sin(th) * e.r2, px = P[0] + x * ca - y * sa, py = P[1] + x * sa + y * ca, len = R * amt * (.1 + 7 * i % 5 * .025), nx = x / e.r1 * ca - y / e.r2 * sa, ny = x / e.r1 * sa + y / e.r2 * ca, l = Math.hypot(nx, ny) || 1;
                ctx.moveTo(px - nx / l * len * .5, py - ny / l * len * .5), ctx.lineTo(px + nx / l * len, py + ny / l * len);
            }
            ctx.stroke();
        }(ctx, P, e, o.fuzzCol || sh(col, .25), o.fuzz, R), o.gloss && R > 2.5) {
            const gp = V.P(surfToward(c, ax, ay, az, function(V) {
                const k = V.yaw.toFixed(3) + V.pitch.toFixed(3) + LG[0].toFixed(3) + LG[2].toFixed(3);
                return k !== HVkey && (HVkey = k, HV = M.norm(M.add(LG, V.toCam))), HV;
            }(V)));
            ctx.fillStyle = "rgba(255,255,255," + (.55 * o.gloss).toFixed(2) + ")", ctx.beginPath(), 
            ctx.ellipse(gp[0], gp[1], Math.max(.6, .16 * R), Math.max(.4, .09 * R), e.ang, 0, 6.283), 
            ctx.fill(), R > 8 && (ctx.fillStyle = "rgba(255,255,255," + (.18 * o.gloss).toFixed(2) + ")", 
            ctx.beginPath(), ctx.ellipse(gp[0], gp[1], .34 * R, .2 * R, e.ang, 0, 6.283), ctx.fill());
        }
        return e;
    }
    function limb(ctx, V, pts, widths, col, lod, joints) {
        const S = pts.map(p => V.P(p)), wpx = widths.map(w => w * V.s);
        if (ctx.lineCap = "round", ctx.lineJoin = "round", 0 === lod || wpx[0] < 1.1) {
            ctx.strokeStyle = col, ctx.lineWidth = Math.max(.5, .9 * wpx[0]), ctx.beginPath(), 
            ctx.moveTo(S[0][0], S[0][1]);
            for (let i = 1; i < S.length; i++) ctx.lineTo(S[i][0], S[i][1]);
            return ctx.stroke(), S;
        }
        const ik = ink(col);
        for (let i = 0; i < S.length - 1; i++) ctx.strokeStyle = ik, ctx.lineWidth = wpx[i] + 1.1, 
        ctx.beginPath(), ctx.moveTo(S[i][0], S[i][1]), ctx.lineTo(S[i + 1][0], S[i + 1][1]), 
        ctx.stroke();
        for (let i = 0; i < S.length - 1; i++) ctx.strokeStyle = 0 === i ? sh(col, .08) : col, 
        ctx.lineWidth = wpx[i], ctx.beginPath(), ctx.moveTo(S[i][0], S[i][1]), ctx.lineTo(S[i + 1][0], S[i + 1][1]), 
        ctx.stroke();
        if (2 === lod && wpx[0] > 2.2 && (ctx.strokeStyle = "rgba(255,255,255,0.18)", ctx.lineWidth = Math.max(.5, .28 * wpx[0]), 
        ctx.beginPath(), ctx.moveTo(S[0][0], S[0][1] - .2 * wpx[0]), ctx.lineTo(S[1][0], S[1][1] - .2 * wpx[0]), 
        ctx.stroke()), joints) for (let i = 1; i < S.length - 1; i++) joints[i] && (ctx.fillStyle = joints[i], 
        ctx.beginPath(), ctx.arc(S[i][0], S[i][1], Math.max(.5, .36 * wpx[i - 1]), 0, 6.283), 
        ctx.fill());
        return S;
    }
    function curve(ctx, V, a, m, b, w, col) {
        const A = V.P(a), B = V.P(m), C = V.P(b);
        ctx.strokeStyle = col, ctx.lineWidth = Math.max(.4, w * V.s), ctx.lineCap = "round", 
        ctx.beginPath(), ctx.moveTo(A[0], A[1]), ctx.quadraticCurveTo(B[0], B[1], C[0], C[1]), 
        ctx.stroke();
    }
    function wing(ctx, V, c, ax, ay, fill, edge, veins, lod) {
        const P = V.P(c), e = projEll(V, ax, ay, null);
        if (!(e.r1 < .5) && (ctx.beginPath(), ctx.ellipse(P[0], P[1], e.r1, Math.max(.35, e.r2), e.ang, 0, 6.283), 
        ctx.fillStyle = fill, ctx.fill(), lod > 0 && e.r1 > 3 && (ctx.lineWidth = Math.max(.4, .03 * e.r1), 
        ctx.strokeStyle = edge, ctx.stroke(), veins && e.r1 > 6))) {
            const r0 = V.P(M.sub(c, ax));
            ctx.beginPath();
            for (let k = -2; k <= 2; k++) {
                const q = V.P(M.add(M.add(c, M.mul(ax, .75)), M.mul(ay, .38 * k)));
                ctx.moveTo(r0[0], r0[1]), ctx.lineTo(q[0], q[1]);
            }
            ctx.globalAlpha *= .7, ctx.stroke(), ctx.globalAlpha /= .7;
        }
    }
    function Part(c, ax, ay, az) {
        return {
            c: c,
            ax: ax,
            ay: ay,
            az: az,
            la: M.len(ax),
            lb: M.len(ay),
            lc: M.len(az)
        };
    }
    function surf(pt, u, v) {
        const w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
        return [ pt.c[0] + pt.ax[0] * u + pt.ay[0] * v + pt.az[0] * w, pt.c[1] + pt.ax[1] * u + pt.ay[1] * v + pt.az[1] * w, pt.c[2] + pt.ax[2] * u + pt.ay[2] * v + pt.az[2] * w ];
    }
    function facing(pt, u, v, V) {
        const w = Math.sqrt(Math.max(0, 1 - u * u - v * v)), a = u / (pt.la * pt.la), b = v / (pt.lb * pt.lb), c = w / (pt.lc * pt.lc), n = [ pt.ax[0] * a / 1 + pt.ay[0] * b + pt.az[0] * c, pt.ax[1] * a + pt.ay[1] * b + pt.az[1] * c, pt.ax[2] * a + pt.ay[2] * b + pt.az[2] * c ];
        return M.dot(n, V.toCam) / (M.len(n) || 1);
    }
    function decals(ctx, V, pt, list, cols, alpha) {
        for (const d of list) {
            const col = cols[d.c || "mark"] || d.c;
            if (ctx.fillStyle = col, ctx.strokeStyle = col, "dot" === d.t) {
                const f = facing(pt, d.u, d.v, V);
                if (f < .02) continue;
                ctx.globalAlpha = alpha * Math.min(1, 4 * f) * (d.a || 1);
                const w = Math.max(.2, Math.sqrt(Math.max(0, 1 - d.u * d.u - d.v * d.v))), t1 = M.add(pt.ax, M.mul(pt.az, -d.u / w)), t2 = M.add(pt.ay, M.mul(pt.az, -d.v / w)), k = d.r, e = projEll(V, M.mul(M.norm(t1), k * pt.lb), M.mul(M.norm(t2), k * pt.lb), null), P = V.P(surf(pt, d.u, d.v));
                ctx.beginPath(), ctx.ellipse(P[0], P[1], e.r1, Math.max(.2, e.r2), e.ang, 0, 6.283), 
                ctx.fill();
            } else if ("line" === d.t) {
                ctx.lineWidth = Math.max(.5, d.w * pt.lb * V.s), ctx.lineCap = "round";
                let open = !1, fmin = 1;
                ctx.beginPath();
                for (const q of d.p) {
                    const f = facing(pt, q[0], q[1], V);
                    if (f < .02) {
                        open = !1;
                        continue;
                    }
                    fmin = Math.min(fmin, f);
                    const P = V.P(surf(pt, q[0], q[1]));
                    open ? ctx.lineTo(P[0], P[1]) : ctx.moveTo(P[0], P[1]), open = !0;
                }
                ctx.globalAlpha = alpha * Math.min(1, 4 * fmin) * (d.a || 1), ctx.stroke();
            } else if ("poly" === d.t) {
                let fmin = 1;
                const S = [];
                for (const q of d.p) {
                    const f = facing(pt, q[0], q[1], V);
                    fmin = Math.min(fmin, f), S.push(V.P(surf(pt, q[0], q[1])));
                }
                if (fmin < .02) continue;
                ctx.globalAlpha = alpha * Math.min(1, 4 * fmin) * (d.a || 1), ctx.beginPath(), S.forEach((P, i) => i ? ctx.lineTo(P[0], P[1]) : ctx.moveTo(P[0], P[1])), 
                ctx.closePath(), ctx.fill();
            }
        }
        ctx.globalAlpha = alpha;
    }
    const band = (u, w, c, span, a) => {
        const m = Math.sqrt(Math.max(0, 1 - u * u)) * (span || .92), p = [];
        for (let k = 0; k <= 6; k++) p.push([ u, 2 * m * k / 6 - m ]);
        return {
            t: "line",
            p: p,
            w: w,
            c: c,
            a: a
        };
    }, stripe = (v, w, c, u0, u1, a) => {
        const p = [];
        for (let k = 0; k <= 6; k++) {
            const u = (null != u0 ? u0 : -.8) + ((null != u1 ? u1 : .8) - (null != u0 ? u0 : -.8)) * k / 6;
            u * u + v * v < .97 && p.push([ u, v ]);
        }
        return {
            t: "line",
            p: p,
            w: w,
            c: c,
            a: a
        };
    }, dot = (u, v, r, c, a) => ({
        t: "dot",
        u: u,
        v: v,
        r: r,
        c: c,
        a: a
    }), PAT = {
        bold: () => [ {
            t: "poly",
            p: [ [ .38, 0 ], [ -.08, .24 ], [ -.08, -.24 ] ]
        }, dot(-.42, .3, .11), dot(-.42, -.3, .11), dot(-.72, .16, .08), dot(-.72, -.16, .08), band(.8, .14) ],
        regal: () => [ dot(.2, 0, .18), dot(-.25, .32, .12), dot(-.25, -.32, .12), band(-.55, .07, "mark", .4), band(-.7, .07, "mark", .32), band(-.83, .07, "mark", .25), band(.8, .14) ],
        canopy: () => [ stripe(.68, .16), stripe(-.68, .16), dot(.1, 0, .12) ],
        zebra: () => [ band(.55, .15), band(.13, .15), band(-.29, .15), band(-.71, .15) ],
        graywall: () => [ stripe(0, .34, "dark"), stripe(.75, .18), stripe(-.75, .18) ],
        pantropical: () => [ stripe(0, .22), dot(-.4, .4, .1), dot(-.4, -.4, .1) ],
        arc: () => {
            const p = [];
            for (let a = 1.9; a <= 4.4; a += .25) p.push([ .5 + .75 * Math.cos(a), .75 * Math.sin(a) ]);
            return [ {
                t: "line",
                p: p,
                w: .18
            } ];
        },
        emerald: () => [ stripe(.82, .18), stripe(-.82, .18) ],
        peacock: () => [ dot(.1, 0, .55, "#e8501e"), dot(-.3, 0, .36, "#3ad0c0"), dot(.35, 0, .12, "#f0c030") ],
        twinflag: () => [ dot(-.55, .3, .17), dot(-.55, -.3, .17), band(.7, .2) ],
        putnam: () => [ 0, 1, 2, 3, 4 ].map(k => dot(.4 - .25 * k, .3 * (k % 2 ? 1 : -1), .09)),
        red: () => [ 0, 1, 2 ].map(k => ({
            t: "line",
            p: [ [ -.1 - .3 * k, -.4 ], [ -.3 - .3 * k, 0 ], [ -.1 - .3 * k, .4 ] ],
            w: .08,
            c: "dark",
            a: .5
        })).concat([ dot(.5, 0, .12) ]),
        johnson: () => [ stripe(0, .32, "#141414") ],
        imperial: () => [ stripe(0, .42, "#1a120c", -.85, .75, .9), band(.42, .1, "mark", .42), band(.12, .1, "mark", .42), band(-.18, .1, "mark", .4), band(-.48, .09, "mark", .36), stripe(.82, .1, "mark", -.5, .6, .6), stripe(-.82, .1, "mark", -.5, .6, .6) ],
        magnolia: () => [ dot(.1, -.2, .45, "#ffffff", .2) ],
        ant: () => [],
        paradise: () => [ stripe(.62, .15), stripe(-.62, .15), stripe(0, .14) ],
        giant: () => [ .55, .17, -.21, -.59 ].map(u => band(u, .1, "mark", .92, .8)),
        portia: rng => {
            const o = [];
            for (let k = 0; k < 8; k++) o.push(dot(1.4 * rng() - .7, 1.2 * rng() - .6, .12 + .1 * rng(), "dark", .45));
            for (let k = 0; k < 5; k++) o.push(dot(1.2 * rng() - .6, 1 * rng() - .5, .07));
            return o;
        }
    };
    PAT.orange = PAT.regal, PAT.auralis = () => [ stripe(.82, .16), stripe(-.82, .16), dot(.2, 0, .26, "#f0a040"), dot(-.25, .25, .12, "#3ad0c0"), dot(-.25, -.25, .12, "#e8501e") ], 
    PAT.hyalina = () => [ dot(.1, -.2, .45, "#ffffff", .25), stripe(0, .08, "mark", -.6, .6, .35) ], 
    PAT.ignicard = () => PAT.red().concat([ [ .45, .35 ], [ .1, -.45 ], [ -.25, .5 ], [ -.55, -.2 ], [ .25, .05 ], [ -.7, .35 ], [ -.05, .25 ], [ .6, -.25 ] ].map(([u, v]) => dot(u, v, .07, "#ffc060", .95))), 
    PAT.titanica = rng => PAT.portia(rng).concat([ .45, .05, -.35 ].map(u => band(u, .08, "mark", .85, .55))), 
    PAT.saltator = () => [ band(.6, .16), band(.18, .16), band(-.26, .16), band(-.68, .14), dot(.86, 0, .12, "#d03a2a") ];
    const patCache = {}, CEPH_PAT = {
        zebra: 1,
        graywall: 1,
        paradise: 1,
        pantropical: 1,
        saltator: 1
    };
    function lodFor(px, o) {
        return o.thumb ? 2 : px < 9 ? 0 : px < 32 ? 1 : 2;
    }
    function shArt() {
        const H = JT.HD2D;
        return "hd" === (H && H._was) ? 1 : 0;
    }
    const SHB = {
        c: null,
        g: null
    };
    function shapePath(g, ells, strokes, k, grow) {
        g.beginPath();
        for (const e of ells) {
            const r1 = Math.max(.3, e[2] * grow), r2 = Math.max(.3, e[3] * grow + (grow - 1) * e[2] * .25);
            g.moveTo(e[0] + r1 * Math.cos(e[4]), e[1] + r1 * Math.sin(e[4])), g.ellipse(e[0], e[1], r1, r2, e[4], 0, 6.283);
        }
        if (g.fill(), strokes.length) {
            g.lineCap = "round", g.lineJoin = "round";
            for (const [pts, w] of strokes) {
                g.lineWidth = Math.max(.5, w * (1 + 2 * (grow - 1))), g.beginPath(), g.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
                g.stroke();
            }
        }
    }
    function paintShadow(ctx, ells, strokes, a, soft, blurPx) {
        if (a < .004 || !ells.length && !strokes.length) return;
        const art = shArt(), ga = ctx.globalAlpha, col = 2 === art ? "rgb(26,14,24)" : "rgb(12,8,4)";
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const e of ells) {
            const r = 1.35 * Math.max(e[2], e[3]) + 1;
            x0 = Math.min(x0, e[0] - r), x1 = Math.max(x1, e[0] + r), y0 = Math.min(y0, e[1] - r), 
            y1 = Math.max(y1, e[1] + r);
        }
        for (const [pts, w] of strokes) for (const q of pts) {
            const r = 1.5 * w + 1;
            x0 = Math.min(x0, q[0] - r), x1 = Math.max(x1, q[0] + r), y0 = Math.min(y0, q[1] - r), 
            y1 = Math.max(y1, q[1] + r);
        }
        const W0 = x1 - x0, H0 = y1 - y0;
        if (!(W0 > 0 && H0 > 0) || W0 > 4e3 || H0 > 4e3) return;
        const size = Math.max(W0, H0), blur = 2 === art ? 0 : 1 === art ? 2 : Math.max(1, null != blurPx ? blurPx : size * (.03 + .06 * soft)), k = 2 === art ? 1 : 1 === art ? .5 : M.clamp(1 / blur, .12, .8), pad = 0 === art ? Math.ceil(1.5 * blur) + 2 : 2, bx = x0 - pad, by = y0 - pad, bw = W0 + 2 * pad, bh = H0 + 2 * pad, sw = Math.ceil(bw * k) + 2, shh = Math.ceil(bh * k) + 2, B = (w = sw, 
        h = shh, "undefined" == typeof document ? null : (SHB.c || (SHB.c = document.createElement("canvas"), 
        SHB.c.width = 64, SHB.c.height = 64, SHB.g = SHB.c.getContext("2d")), (SHB.c.width < w || SHB.c.height < h) && (SHB.c.width = Math.max(SHB.c.width, 32 * Math.ceil(w / 32)), 
        SHB.c.height = Math.max(SHB.c.height, 32 * Math.ceil(h / 32)), SHB.g = SHB.c.getContext("2d")), 
        SHB));
        var w, h;
        const one = (grow, al) => {
            if (al < .003) return;
            if (ctx.gpuShadow) return void ctx.gpuShadow(ells, strokes, grow, col, al, 0 === art ? 1.5 / k : 1);
            if (!B) return ctx.globalAlpha = 1, ctx.fillStyle = col.replace("rgb", "rgba").replace(")", "," + al.toFixed(3) + ")"), 
            ctx.strokeStyle = ctx.fillStyle, void shapePath(ctx, ells, strokes, 0, grow);
            const g = B.g;
            g.setTransform(1, 0, 0, 1, 0, 0), g.globalAlpha = 1, g.globalCompositeOperation = "source-over", 
            g.clearRect(0, 0, sw + 1, shh + 1), g.setTransform(k, 0, 0, k, -bx * k + 1, -by * k + 1), 
            g.fillStyle = col, g.strokeStyle = col, shapePath(g, ells, strokes, 0, grow), ctx.save(), 
            ctx.globalAlpha = al, ctx.imageSmoothingEnabled = 1 !== art, ctx.drawImage(B.c, 0, 0, sw, shh, bx - 1 / k, by - 1 / k, sw / k, shh / k), 
            ctx.restore();
        };
        2 === art ? one(1, Math.min(.42, 1.1 * a)) : 1 === art ? (one(1.15 + .25 * soft, .42 * a), 
        one(.9, .5 * a)) : one(1 + .25 * soft, a), ctx.globalAlpha = ga;
    }
    const SHAPES = {
        spider: {
            e: [ [ -.3, .27, .2 ], [ .13, .2, .16 ] ],
            legs: [ [ .7, .82, .3 ], [ 1.25, .66, .28 ], [ 1.95, .64, .26 ], [ 2.55, .78, .3 ] ],
            at: .1
        },
        prey: {
            e: [ [ 0, .5, .38 ] ],
            legs: [],
            at: 0
        }
    };
    function castShadow(ctx, V, p, f, s, n, L, h, alpha, wk, opt) {
        wk = wk || 1;
        const sk = SHAPES[(opt = opt || {}).kind || "prey"] || SHAPES.prey, art = shArt(), px = Math.max(.5, V.s), ln = Math.max(.35, M.dot(LG, n)), Lt = M.sub(LG, M.mul(n, ln)), cap = .75 * L, off = hh => {
            let o = M.mul(Lt, -hh / ln);
            const ol = M.len(o), cp = cap * hh / Math.max(h, .001);
            return ol > cp && (o = M.mul(o, cp / ol)), o;
        }, sh = (u, v, hh) => {
            const o = off(hh);
            return V.P([ p[0] + f[0] * u + s[0] * v + o[0], p[1] + f[1] * u + s[1] * v + o[1], p[2] + f[2] * u + s[2] * v + o[2] ]);
        }, shW = q => {
            const d = M.sub(q, p), hh = Math.max(0, M.dot(d, n)), b = M.sub(q, M.mul(n, M.dot(d, n)));
            return V.P(M.add(b, off(hh)));
        }, kd = JT.SKY.kd, lit = .2 + .16 * kd, Lpx = L * px, hK = M.clamp(1 - .9 * (h / L - .12), .55, 1), legs = opt.legs && opt.legs.length ? opt.legs : null, feet = [];
        if (!legs && opt.kind && "prey" !== opt.kind) {
            const ph = opt.ph || 0;
            for (let i = 0; i < sk.legs.length; i++) {
                const [an, re] = sk.legs[i];
                for (const sd of [ -1, 1 ]) {
                    const g = ((i + (sd > 0 ? 1 : 0)) % 2 ? 1 : -1) * Math.sin(ph) * .06, u = sk.at * L + Math.cos(an) * re * L + g * L, v = sd * Math.sin(an) * re * L;
                    feet.push([ u, v, an, re, sd ]);
                }
            }
        }
        if (!opt.perch) {
            const ells = [], strokes = [];
            for (const [u, hl, hw] of sk.e) {
                const c = sh(u * L, 0, h), e = projEll(V, M.mul(f, hl * L * (opt.kind || wk > .5 ? 1 : 1.1)), M.mul(s, hw * L * wk), null);
                ells.push([ c[0], c[1], e.r1, e.r2, e.ang ]);
            }
            if (opt.held) {
                const hl = opt.held, c = sh(.5 * L, 0, .8 * h), e = projEll(V, M.mul(f, .5 * hl), M.mul(s, .2 * hl), null);
                ells.push([ c[0], c[1], e.r1, e.r2, e.ang ]);
            }
            const lw = Math.max(.6, L * px * .04);
            if (legs) for (const lg of legs) strokes.push([ lg.slice(0, 4).map(shW), lw ]); else for (const [u, v, an, re, sd] of feet) {
                const kn = sk.legs.find(q => q[0] === an), ku = sk.at * L + Math.cos(an) * re * L * .45, kv = sd * Math.sin(an) * re * L * .48;
                strokes.push([ [ sh(sk.at * L, sd * L * .05, h), sh(ku, kv, h + kn[2] * L), sh(u, v, 0) ], lw ]);
            }
            if (sk.arms && !opt.noArms) for (const [a0, a1] of sk.arms) for (const sd of [ -1, 1 ]) strokes.push([ [ sh(a0 * L, sd * L * .04, h + .12 * L), sh(a1 * L, sd * L * .05, h + .04 * L) ], 1.3 * lw ]);
            const soft = .5 * M.clamp(h / L, 0, 1), a = alpha * lit * hK * (2 === art ? 1.05 : 1);
            paintShadow(ctx, [], strokes, .85 * a, soft, Lpx * (.012 + .03 * soft)), paintShadow(ctx, ells, [], a, soft, Lpx * (.025 + .05 * soft));
            const P2 = V.P(M.add(p, M.mul(f, sk.e.length > 1 ? .08 * -L : 0))), e2 = projEll(V, M.mul(f, L * (opt.kind ? .28 : .38)), M.mul(s, .18 * L * wk), null);
            paintShadow(ctx, [ [ P2[0], P2[1], e2.r1, e2.r2, e2.ang ] ], [], alpha * (.07 + .07 * kd) * hK, .6, .05 * Lpx);
        }
        if (opt.perch || 0 === art) {
            const r = Math.max(.45, L * px * .03), aD = alpha * (opt.perch ? 1 === art ? .14 : .2 : .1);
            if (legs) {
                const ells = [];
                for (const lg of legs) {
                    if ((lg[4] || 0) > .25) continue;
                    const q = V.P(lg[3]);
                    ells.push([ q[0], q[1], r, .7 * r, 0 ]);
                }
                paintShadow(ctx, ells, [], aD, 0, .8 * r);
            } else if (feet.length) {
                const ells = [];
                for (const [u, v] of feet) {
                    const q = V.P([ p[0] + f[0] * u + s[0] * v, p[1] + f[1] * u + s[1] * v, p[2] + f[2] * u + s[2] * v ]);
                    ells.push([ q[0], q[1], r, .7 * r, 0 ]);
                }
                paintShadow(ctx, ells, [], aD, 0, .8 * r);
            }
        }
    }
    function dropAt(hab, c, gy) {
        const dh = Math.max(0, c[1] - gy), hz = Math.hypot(LG[0], LG[2]), ly = Math.max(LG[1], hz / 2.6, .05);
        let gx = c[0] - LG[0] * dh / ly, gz = c[2] - LG[2] * dh / ly, out = 0;
        if (JT.Nav && JT.Nav.clampInside) {
            const q = JT.Nav.clampInside(hab, gx, gz, 1);
            out = Math.hypot(q[0] - gx, q[1] - gz), gx = q[0], gz = q[1];
        }
        return [ gx, gy, gz, out ];
    }
    function sortDraw(parts) {
        parts.sort((a, b) => b.d - a.d);
        for (const q of parts) q.f();
    }
    function hairs(ctx, A, B, w, n, len, col, lw, tilt, seed) {
        const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
        ctx.strokeStyle = col, ctx.lineWidth = lw, ctx.beginPath();
        for (let k = 0; k < n; k++) {
            const t = (k + .5) / n, sd = k % 2 ? 1 : -1, bx = A[0] + dx * t + nx * sd * w * .42, by = A[1] + dy * t + ny * sd * w * .42, ll = len * (.72 + (7 * k + seed) % 5 * .11);
            ctx.moveTo(bx, by), ctx.lineTo(bx + (nx * sd + ux * tilt) * ll, by + (ny * sd + uy * tilt) * ll);
        }
        ctx.stroke();
    }
    function puff(ctx, P, r, col, n, lw) {
        ctx.strokeStyle = col, ctx.lineWidth = lw, ctx.beginPath();
        for (let k = 0; k < n; k++) {
            const a = k / n * 6.283 + k % 3 * .2, r0 = .55 * r, r1 = r * (1.25 + k % 4 * .12);
            ctx.moveTo(P[0] + Math.cos(a) * r0, P[1] + Math.sin(a) * r0), ctx.lineTo(P[0] + Math.cos(a) * r1, P[1] + Math.sin(a) * r1);
        }
        ctx.stroke();
    }
    function tuftSet(ctx, V, pt, list, col, lw, curl) {
        ctx.strokeStyle = col, ctx.lineWidth = lw, ctx.lineCap = "round", ctx.beginPath();
        for (const [u, v, d, len] of list) {
            const a = surf(pt, u, v), b = M.add(a, M.mul(d, len)), A = V.P(a), B = V.P(b);
            if (curl) {
                const m = V.P(M.add(M.lerp3(a, b, .5), M.mul(curl, .35 * len)));
                ctx.moveTo(A[0], A[1]), ctx.quadraticCurveTo(m[0], m[1], B[0], B[1]);
            } else ctx.moveTo(A[0], A[1]), ctx.lineTo(B[0], B[1]);
        }
        ctx.stroke();
    }
    D.spider = function(ctx, V, sp, fr, o) {
        const S = JT.SPECIES_BY_ID[sp.species] || JT.SPECIES[0], pal0 = o.palette || S.pal, L = o.len;
        let {f: f, s: s, n: n} = fr, p = fr.p;
        const t = o.time || 0, LK = S.look || {}, gait = LK.gait, gp = sp._gPause || 0, RG = JT.Gait ? JT.Gait.rig(sp, o, fr, L, "spider") : null, HD = RG ? JT.Gait.heading(RG, fr, !(o.airborne || o.curled || o.tucked || o.hug || o.meal || sp.hold || "pounce" === sp.state || o.hang)) : null;
        HD && (f = HD.f, s = HD.s);
        const hdA = HD ? HD.a : 0;
        if (!(o.thumb || o.airborne || o.curled || o.tucked || o.hug || o.meal)) {
            let lat = 0, ang = 0;
            const zk = sp._zigK || 0;
            if (zk > .01) {
                const ph = .55 * (sp._walk || 0) + (sp.seed || 1) % 7;
                lat += .18 * L * Math.sin(ph) * zk, ang += Math.atan(.31 * Math.cos(ph)) * zk;
            }
            if ("twitchy" === gait && (lat += L * (.015 * Math.sin(1.7 * t + (sp.seed || 0)) + .012 * gp * Math.sin(13 * t)), 
            ang += .05 * gp * Math.sin(9.3 * t)), lat || ang) {
                const ca = Math.cos(ang), sa = Math.sin(ang), f2 = M.add(M.mul(f, ca), M.mul(s, sa)), s2 = M.sub(M.mul(s, ca), M.mul(f, sa));
                f = f2, s = s2, p = M.add(p, M.mul(fr.s, lat));
            }
        }
        const paleK = o.ghost ? .72 : sp.soft > 0 ? Math.min(.6, sp.soft / 120 * .65) : 0, C = c => paleK > 0 ? mix(c, "#efe6d6", paleK) : hex6(c), pal = {};
        for (const k in pal0) pal[k] = C(pal0[k]);
        const px = L * V.s, lod = lodFor(px, o), alpha = (null != o.alpha ? o.alpha : 1) * (S.translucent ? .9 : 1) * (o.ghost ? .85 : 1);
        ctx.globalAlpha = alpha;
        const crouch = sp._crouch || 0, raise = sp._legRaise || 0, moving = sp._moving ? 1 : 0, breath = .015 * Math.sin(sp._breath || 0), ant = !!S.antShape, flat = sp._flat || 0, strK = sp._stretchK || 0, wipe = sp._wipe || 0, flick = sp._flick || 0, hang = o.hang || 0, wph = (sp._walk || 0) * Math.PI, bob = moving && !o.airborne ? Math.abs(Math.sin(wph)) * ("bouncy" === gait ? .03 : "hop" === gait ? .022 : "heavy" === gait ? .01 : "stopgo" === gait ? .012 : 0) : 0, gripK = !o.grip || o.airborne || o.curled || o.tucked || o.thumb ? 0 : o.grip.k, h0 = (1 - .3 * gripK) * L * (.14 - .07 * crouch) * (1 - .42 * flat) * (1 - .45 * (LK.flat || 0)) + .035 * L * strK + L * bob + (RG ? RG.bob : 0), W = (u, v, w) => [ p[0] + f[0] * u + s[0] * v + n[0] * w, p[1] + f[1] * u + s[1] * v + n[1] * w, p[2] + f[2] * u + s[2] * v + n[2] * w ], shLegs = [], doShadow = !o.airborne && !o.noShadow, under = M.dot(n, V.toCam) < -.05 && !o.thumb, fat = (null != sp._fatNow ? M.clamp(sp._fatNow, .66, 1.28) : M.clamp(.85 + .34 * (null != sp.sat ? sp.sat : .7), .85, 1.2)) * (1 + breath);
        let gz = .3 * (sp._gazeNow || 0) - .9 * hdA;
        if (o.lookCam) {
            const cf = M.sub(V.toCam, M.mul(n, M.dot(V.toCam, n)));
            if (M.len(cf) > .2) {
                const c2 = M.norm(cf), a = Math.atan2(M.dot(c2, s), M.dot(c2, f));
                Math.abs(a) < 1.6 && (gz = M.lerp(gz, M.clamp(a, -.55, .55), o.lookCam));
            }
        }
        gz = M.clamp(gz, -.62, .62);
        const fg = M.norm(M.add(M.mul(f, Math.cos(gz)), M.mul(s, Math.sin(gz))));
        let sg = M.norm(M.cross(n, fg)), nh = n;
        if (o.tilt > .01) {
            const sgn = M.dot(sg, V.toCam) >= 0 ? 1 : -1, ra = .3 * o.tilt * sgn, cr = Math.cos(ra), sr = Math.sin(ra), sg2 = M.norm(M.add(M.mul(sg, cr), M.mul(n, sr)));
            nh = M.norm(M.sub(M.mul(n, cr), M.mul(sg, sr))), sg = sg2;
        }
        const stalk = [ "stalk", "creep", "crouch" ].includes(sp.state) ? .22 : "display" === sp.state ? .35 : .05, parts = [], bodyCol = (c, belly) => under ? mix(c, belly, .75) : c, cL = ant ? 1 : LK.cL || 1, cW = ant ? 1 : LK.cW || 1, cH = ant ? 1 : LK.cH || 1, dF = .375 * (cL - 1) * L, cc = W((.13 + .125 * (cL - 1)) * L, 0, h0 + L * (ant ? .06 : .1 * cH)), cph = Part(cc, M.mul(fg, L * (ant ? .2 : .25 * cL)), M.mul(sg, L * (ant ? .115 : .2 * cW)), M.mul(nh, L * (ant ? .1 : .15 * cH)));
        if (parts.push({
            d: V.depth(cc),
            f: () => {
                if (blob(ctx, V, cph.c, cph.ax, cph.ay, cph.az, bodyCol(pal.ceph, pal.belly), {
                    lod: lod,
                    gloss: "ant" === S.pattern || "johnson" === S.pattern ? .8 : .45,
                    fuzz: 2 !== lod || ant ? 0 : null != LK.fuzz ? LK.fuzz : .9,
                    fuzzCol: pal.hair,
                    hatch: 2 === lod,
                    sheen: "emerald" === S.pattern ? 1 : 0,
                    time: t
                }), lod > 0 && !under) {
                    const dk = sh(pal.ceph, -.45);
                    decals(ctx, V, cph, [ {
                        t: "poly",
                        p: [ [ .98, -.2 ], [ .55, -.62 ], [ .5, 0 ], [ .55, .62 ], [ .98, .2 ] ],
                        c: dk,
                        a: .55
                    } ].concat(CEPH_PAT[S.pattern] ? [ stripe(.82, .32, "mark", -.6, .7, .85), stripe(-.82, .32, "mark", -.6, .7, .85) ] : []).concat("magnolia" === S.pattern ? [ dot(.6, 0, .32, "#e05a3a") ] : []), {
                        mark: pal.mark,
                        dark: dk
                    }, alpha);
                }
                const ae = .088 * (S.len < 6 ? 1.15 : 1) * (LK.eye || 1) / Math.sqrt(cL * cW), eyes = [ [ .93, .3, ae, 1 ], [ .93, -.3, ae, 1 ], [ .8, .7, .032, 0 ], [ .8, -.7, .032, 0 ], [ -.3, .82, .028, 0 ], [ -.3, -.82, .028, 0 ] ];
                for (const [u, v, r, big] of eyes) {
                    const fc = facing(cph, u, v, V);
                    if (fc < -.15) continue;
                    const ep = surf(cph, u, v), P = V.P(ep), rr = r * L * V.s;
                    if (rr < .45) continue;
                    if (ctx.globalAlpha = alpha * M.clamp(4 * (fc + .15), 0, 1), rr < 1.4) {
                        ctx.fillStyle = "#050403", ctx.beginPath(), ctx.arc(P[0], P[1], rr, 0, 6.283), ctx.fill();
                        continue;
                    }
                    const g = ctx.createRadialGradient(P[0], P[1], .1 * rr, P[0], P[1], rr);
                    g.addColorStop(0, big ? LK.eyeCol || "#2a1c12" : "#120c08"), g.addColorStop(.55, "#0a0705"), 
                    g.addColorStop(1, "#000"), ctx.fillStyle = g, ctx.beginPath(), ctx.arc(P[0], P[1], rr, 0, 6.283), 
                    ctx.fill(), big && rr > 2.5 && (ctx.strokeStyle = LK.eyeCol ? "rgba(190,130,60,0.55)" : "rgba(120,90,60,0.35)", 
                    ctx.lineWidth = Math.max(.5, .12 * rr), ctx.beginPath(), ctx.arc(P[0], P[1], .62 * rr, 0, 6.283), 
                    ctx.stroke());
                    const gp = V.J(M.mul(M.norm(M.add(LG, V.toCam)), r * L * .55)), shine = big ? .92 : .7;
                    big && rr > 2 && JT.HD2D && JT.HD2D.on, ctx.fillStyle = "rgba(255,255,255," + shine + ")", 
                    ctx.beginPath(), ctx.arc(P[0] + gp[0], P[1] + gp[1], Math.max(.5, rr * (big ? .32 : .35)), 0, 6.283), 
                    ctx.fill(), big && rr > 2 && (ctx.fillStyle = "rgba(255,255,255,0.45)", ctx.beginPath(), 
                    ctx.arc(P[0] - .7 * gp[0], P[1] - .7 * gp[1] + .15 * rr, Math.max(.4, .13 * rr), 0, 6.283), 
                    ctx.fill());
                }
                ctx.globalAlpha = alpha, LK.tufts && lod > 0 && !under && function(ctx, V, cph, LK, L, px, fg, sg, nh, pal) {
                    const kind = LK.tufts, lw = k => Math.max(.5, L * V.s * k);
                    if ("brow" === kind && px > 22) {
                        const l = [];
                        for (const sd of [ -1, 1 ]) for (let k = 0; k < 4; k++) {
                            const d = M.norm(M.add(M.add(M.mul(nh, 1), M.mul(fg, .25 + .1 * k)), M.mul(sg, sd * (.3 + .08 * k))));
                            l.push([ .74 - .05 * k, sd * (.32 + .09 * k), d, L * (.06 + .012 * (k % 2 ? 1 : 2)) ]);
                        }
                        tuftSet(ctx, V, cph, l, LK.tuftCol || "#15100b", lw(.007), fg);
                    } else if ("horn" === kind && px > 12) {
                        const l = [];
                        for (const sd of [ -1, 1 ]) for (let k = 0; k < 3; k++) {
                            const d = M.norm(M.add(M.add(nh, M.mul(sg, sd * (.45 + .1 * k))), M.mul(fg, .2 - .12 * k)));
                            l.push([ .6 - .04 * k, sd * (.68 + .03 * k), d, L * (.13 - .02 * k) ]);
                        }
                        tuftSet(ctx, V, cph, l, LK.tuftCol || "#120c08", lw(.016), null);
                    } else if ("lash" === kind && px > 20) {
                        const l = [];
                        for (const sd of [ -1, 1 ]) for (let k = 0; k < 5; k++) {
                            const d = M.norm(M.add(M.add(M.mul(fg, .85), M.mul(nh, .75)), M.mul(sg, .15 * sd * k)));
                            l.push([ .8 - .035 * k, sd * (.22 + .1 * k), d, L * (.12 + k % 3 * .015) ]);
                        }
                        tuftSet(ctx, V, cph, l, LK.tuftCol || "#e8dcc4", lw(.006), M.mul(nh, -1));
                    } else if ("ragged" === kind && px > 14) {
                        const l = [], l2 = [];
                        for (const sd of [ -1, 1 ]) {
                            for (const [u, v] of [ [ .55, .62 ], [ .1, .75 ], [ -.35, .65 ] ]) {
                                const d = M.norm(M.add(M.mul(sg, .8 * sd), M.mul(nh, .7)));
                                l.push([ u, sd * v, d, .06 * L ]);
                            }
                            l2.push([ .25, .4 * sd, M.norm(M.add(nh, M.mul(sg, .4 * sd))), .05 * L ]);
                        }
                        tuftSet(ctx, V, cph, l, LK.tuftCol || "#2a1e14", lw(.016), null), tuftSet(ctx, V, cph, l2, sh(pal.hair, .25), lw(.012), null);
                    }
                }(ctx, V, cph, LK, L, px, fg, sg, nh, pal);
            }
        }), ant) {
            const nc = W(-.08 * L, 0, h0 + .05 * L);
            parts.push({
                d: V.depth(nc),
                f: () => blob(ctx, V, nc, M.mul(f, .07 * L), M.mul(s, .055 * L), M.mul(n, .055 * L), pal.ceph, {
                    lod: lod,
                    gloss: .7
                })
            });
        }
        const spin = o.spin ? 1 : 0, spw = spin ? Math.sin(4.2 * t) : 0, ta = stalk + .1 * crouch - (sp._prepT > 0 ? .28 : 0) - .06 * flat - .42 * spin + (RG ? RG.ap : 0);
        let af = M.add(M.mul(f, Math.cos(ta)), M.mul(n, Math.sin(ta)));
        const an = M.sub(M.mul(n, Math.cos(ta)), M.mul(f, Math.sin(ta)));
        spin && (af = M.norm(M.add(af, M.mul(s, .16 * spw)))), RG && Math.abs(RG.ay) > .001 && (af = M.norm(M.add(af, M.mul(s, .8 * -RG.ay))));
        const aL = ant ? 1 : LK.aL || 1, aW = ant ? 1 : LK.aW || 1, aH = ant ? 1 : LK.aH || 1, ac = M.add(W(ant ? -.33 * L : -(.27 + .24 * (aL - 1) + .125 * (cL - 1)) * L, 0, h0 + .09 * L * (.6 + .4 * aH)), M.add(M.mul(an, .02 * L), M.mul(s, RG ? .8 * -RG.ay * L * .26 : 0))), abd = Part(ac, M.mul(af, L * (ant ? .23 : .3 * aL) * (.95 + .05 * fat)), M.mul(s, L * (ant ? .13 : .22 * aW) * fat), M.mul(an, L * (ant ? .13 : .19 * aH) * fat));
        if (parts.push({
            d: V.depth(ac),
            f: () => {
                if (blob(ctx, V, abd.c, abd.ax, abd.ay, abd.az, bodyCol(pal.abd, pal.belly), {
                    lod: lod,
                    gloss: ant ? .9 : .6,
                    fuzz: 2 !== lod || ant ? 0 : null != LK.fuzz ? 1.1 * LK.fuzz : 1,
                    fuzzCol: pal.hair,
                    hatch: 2 === lod,
                    sheen: null != S.sheen ? S.sheen : "emerald" === S.pattern ? 1 : "peacock" === S.pattern ? 2 : 0,
                    time: t
                }), lod > 0 && !under && decals(ctx, V, abd, function(S, seed) {
                    const k = S.pattern + ("portia" === S.pattern || "titanica" === S.pattern ? seed : "");
                    return patCache[k] || (patCache[k] = (PAT[S.pattern] || (() => []))(JT.makeRng(seed || 7)));
                }(S, sp.seed), {
                    mark: pal.mark,
                    dark: sh(pal.abd, -.5)
                }, alpha), "ragged" === LK.tufts && lod > 0 && px > 14 && !under) {
                    const l = [], l2 = [];
                    for (const sd of [ -1, 1 ]) {
                        for (const [u, v] of [ [ .45, .75 ], [ -.1, .85 ], [ -.6, .65 ] ]) l.push([ u, sd * v, M.norm(M.add(M.mul(s, sd), M.mul(an, .5))), .07 * L ]);
                        l2.push([ -.2, .35 * sd, M.norm(M.add(an, M.mul(af, -.3))), .06 * L ]);
                    }
                    l.push([ -.92, 0, M.norm(M.add(M.mul(af, -1), M.mul(an, .6))), .07 * L ]), tuftSet(ctx, V, abd, l, LK.tuftCol || "#2a1e14", Math.max(.5, L * V.s * .018), null), 
                    tuftSet(ctx, V, abd, l2, sh(pal.mark, .1), Math.max(.5, L * V.s * .016), null);
                }
                lod > 0 && under && decals(ctx, V, {
                    c: abd.c,
                    ax: abd.ax,
                    ay: abd.ay,
                    az: M.mul(abd.az, -1),
                    la: abd.la,
                    lb: abd.lb,
                    lc: abd.lc
                }, [ dot(-.85, 0, .14, "dark"), stripe(0, .12, "dark", -.6, .5, .4) ], {
                    dark: sh(pal.belly, -.4)
                }, alpha);
            }
        }), ("peacock" === S.pattern || S.fan) && "display" === sp.state && !under) {
            const fc = M.add(ac, M.mul(an, .22 * L));
            parts.push({
                d: V.depth(fc) - .05,
                f: () => {
                    wing(ctx, V, fc, M.mul(s, .42 * L), M.add(M.mul(an, .28 * L), M.mul(af, .06 * -L)), S.fan ? S.fan[0] : "#2a5ad0", S.fan ? S.fan[1] : "#10204a", !1, lod), 
                    S.fan && decals(ctx, V, {
                        c: fc,
                        ax: M.mul(an, .28 * L),
                        ay: M.mul(s, .42 * L),
                        az: M.mul(af, .05 * -L),
                        la: .28 * L,
                        lb: .42 * L,
                        lc: .05 * L
                    }, [ dot(.55, 0, .16, "#e83a3a"), dot(.3, .42, .14, "#f09a20"), dot(.3, -.42, .14, "#f0e040"), dot(-.1, .55, .13, "#3ad06a"), dot(-.1, -.55, .13, "#3ab0f0"), dot(-.45, 0, .15, "#9a5ae0") ], {}, alpha), 
                    Part(fc, M.mul(s, .42 * L), M.add(M.mul(an, .28 * L), M.mul(af, .06 * -L)), M.mul(af, .02 * L)), 
                    decals(ctx, V, {
                        c: fc,
                        ax: M.mul(an, .28 * L),
                        ay: M.mul(s, .42 * L),
                        az: M.mul(af, .05 * -L),
                        la: .28 * L,
                        lb: .42 * L,
                        lc: .05 * L
                    }, [ dot(.3, 0, .32, "#e8501e"), dot(-.25, 0, .22, "#3ad0c0"), dot(.05, 0, .1, "#f0c030") ], {}, alpha);
                }
            });
        }
        for (const sd of [ -1, 1 ]) {
            const ck = LK.chel || 1, chc = M.add(W(.33 * L + dF, sd * L * .055 * Math.sqrt(ck), h0 + .02 * L), M.mul(fg, .04 * L * ck));
            parts.push({
                d: V.depth(chc) - .01,
                f: () => blob(ctx, V, chc, M.mul(fg, .05 * L * ck), M.mul(sg, .045 * L * Math.sqrt(ck)), M.mul(n, .07 * L * ck), pal.chel, {
                    lod: lod,
                    gloss: 1,
                    sheen: LK.irid || 0,
                    time: t
                })
            });
            let pw = ("groom" === sp.state || wipe > .2 ? .04 * Math.sin(12 * t + sd) : .01 * Math.sin(3 * t + 2 * sd)) * L, fl = flick * Math.sin(9.4 * flick + .8 * sd) * L * .06;
            if ("flag" === LK.palp && (pw += gp * Math.sin(8 * t + 1.3 * sd) * L * .05), "semaphore" === sp.state && (fl += .1 * L * Math.sin(7 * t + (sd > 0 ? 0 : Math.PI)), 
            pw += .03 * L), "choppy" === gait) {
                const jk = Math.sin(4.2 * t + 2.1 * sd + (sp.seed || 0));
                fl += .05 * L * Math.sign(jk) * Math.min(1, 4 * Math.abs(jk));
            }
            const a = W(.3 * L + dF, sd * L * .09, h0 + .02 * L), b = M.add(W(.45 * L + dF + pw, sd * L * .1, h0 + .06 * L + Math.abs(fl)), M.mul(fg, .02 * L)), c = M.add(W(.5 * L + dF + pw - .5 * Math.abs(fl), sd * L * .09, h0 + 0 * L + fl), M.mul(fg, .02 * L)), pk = LK.palp || "plain", pc = LK.palpCol || pal.hair;
            parts.push({
                d: V.depth(b) - .02,
                f: () => {
                    if (limb(ctx, V, [ a, b, c ], [ .04 * L, .036 * L ], pal.leg, lod, null), "flag" === pk) return limb(ctx, V, [ M.lerp3(b, c, .15), c ], [ .055 * L ], pc, lod, null), 
                    void blob(ctx, V, c, M.mul(fg, .045 * L), M.mul(sg, .04 * L), M.mul(n, .045 * L), pc, {
                        lod: lod,
                        ink: !1,
                        gloss: .3
                    });
                    if (0 === lod) return;
                    const r = "pompom" === pk ? .065 : "fluffy" === pk ? .045 : .035;
                    blob(ctx, V, c, M.mul(fg, L * r), M.mul(sg, L * r * .88), M.mul(n, L * r * .88), pc, {
                        lod: lod,
                        ink: "pompom" === pk
                    });
                    const rr = r * L * V.s;
                    ("pompom" === pk || "fluffy" === pk) && rr > 2 && puff(ctx, V.P(c), rr, "pompom" === pk ? sh(pc, .15) : pc, "pompom" === pk ? 14 : 9, Math.max(.5, .12 * rr));
                }
            });
        }
        const dorsal = M.dot(n, V.toCam) > .45, AU = [ .22, .17, .11, .05 ], FU = ant ? [ .55, .3, -.12, -.45 ] : [ .62, .3, -.16, -.5 ], FV = [ .42, .56, .57, .47 ], ring = "bold" === S.pattern || "regal" === S.pattern || "orange" === S.pattern || "zebra" === S.pattern ? pal.mark : null, reach = o.airborne && sp._reach || 0, fore = sp._fore || 0, hg = o.hug && o.hug.k > .01 ? o.hug : null;
        let mc = null, hr = 0, mp0 = null;
        hg && (mp0 = M.add(W(.4 * L, 0, .35 * h0), M.mul(fg, .06 * L)), mc = M.add(mp0, M.mul(fg, .25 * hg.pl)), 
        hr = Math.max(.07 * L, .3 * hg.pl));
        const legHair = (A, B, w, i, lk, seg) => {
            if (0 === lod || !A || !B) return;
            const fr = LK.fringe || 0;
            if (fr > 0 && px > 14 && (1 === seg || i < 2)) {
                const k0 = 1 === seg ? .2 : .35, k1 = 1 === seg ? .75 : .85;
                ctx.strokeStyle = LK.tuftCol || "#2a1e14", ctx.lineWidth = w * (i < 2 ? 2.3 : 1.7) * fr, 
                ctx.lineCap = "round", ctx.beginPath(), ctx.moveTo(M.lerp(A[0], B[0], k0), M.lerp(A[1], B[1], k0)), 
                ctx.lineTo(M.lerp(A[0], B[0], k1), M.lerp(A[1], B[1], k1)), ctx.stroke(), 2 === lod && px > 44 && hairs(ctx, A, B, 2 * w, 9, 1.1 * w, LK.tuftCol || "#2a1e14", Math.max(.5, .18 * w), .7, lk);
            }
            lod < 2 || ((LK.legHair || 0) > 0 && px > 60 && hairs(ctx, A, B, w, Math.round(3 + 7 * LK.legHair * (0 === i ? 1.3 : 1)), .55 * w, pal.hair, Math.max(.5, .12 * w), .6, lk), 
            (LK.bristle || 0) > 0 && px > 44 && (ctx.globalAlpha = .85 * alpha, hairs(ctx, A, B, w, Math.round((2 + 4 * LK.bristle) * (0 === i ? 1.3 : 1)), 1.3 * w + 1.5, LK.bristleCol || "#f2eee4", .55, .9, lk + 3), 
            ctx.globalAlpha = alpha));
        }, sq = "subdue" === sp.state ? 1 : .35, seedP = (sp.seed || 1) % 97 * .37;
        let gc = null, ga = null, gb = null, gR = 0;
        gripK > .001 && (ga = M.sub(o.grip.ax, M.mul(n, M.dot(o.grip.ax, n))), M.len(ga) > .2 && (ga = M.norm(ga), 
        gb = M.norm(M.cross(n, ga)), gR = o.grip.R + .025 * L, gc = M.sub(p, M.mul(n, o.grip.R))));
        for (const sd of [ -1, 1 ]) for (let i = 0; i < 4; i++) {
            const lk = 2 * i + (sd > 0 ? 1 : 0), lg = (LK.legLen || 1) * (0 === i ? LK.front || 1 : 1 === i ? 1 + .35 * ((LK.front || 1) - 1) : 1), ph = "choppy" === gait ? (sp._walk || 0) * Math.PI * (1 + .17 * lk) + 1.37 * lk : (sp._walk || 0) * Math.PI + i % 2 * Math.PI + (sd > 0 ? Math.PI : 0), sw = "glide" === gait ? .7 : 1, mvS = RG ? 0 : moving;
            let fu = FU[i] * L * lg + Math.sin(ph) * L * .12 * mvS * lg * sw, fv = FV[i] * L * sd * (1 + .12 * crouch + (RG ? Math.max(0, -RG.bob) / L * 3 : 0)) * (1 + .6 * (lg - 1)), fw = Math.max(0, Math.cos(ph)) * L * .08 * mvS * sw;
            const tapK = RG ? JT.Gait.tapOf(RG, lk) : 0;
            if (tapK > .001 && (fu += .05 * L * tapK, fw += .11 * L * tapK), ((sp._prepT > 0 || "lunge" === sp.state && sp.st < .3) && !o.airborne ? 1 : 0) && i >= 2 && (fu += .07 * L, 
            fv *= .92), "choppy" === gait && i < 3 && (fw += .06 * L * gp * Math.max(0, Math.sin(t * (1.3 + .37 * lk) + 2.3 * lk))), 
            LK.antennae && 0 === i && !o.curled && !o.tucked) {
                const ak = 1 - reach;
                fu += .1 * L * ak, fv *= 1 - .5 * ak, fw += L * (.4 + ("antMarch" === sp.state ? .16 : .07) * Math.sin(t * ("antMarch" === sp.state ? 11 : 6.5) + 1.9 * sd)) * ak;
            }
            if (0 === i && raise > 0 && (fu += .2 * L * raise, fw += .18 * L * raise * (1 - .8 * fore), 
            fv *= 1 - .1 * raise), i < 2 && fore > .01) {
                const k = 2 * i + (sd > 0 ? 1 : 0);
                fu += L * (.2 - .07 * i) * fore + .045 * L * fore * Math.sin(t * (1.3 + .41 * k) + seedP + 2.1 * k), 
                fv *= 1 - (.22 - .08 * i) * fore, fw += .04 * L * fore * Math.max(0, Math.sin(t * (.85 + .33 * k) + 1.7 * seedP + 1.3 * k));
            }
            if ("display" === sp.state && i <= (S.prefs.display > .7 ? 2 : 0) && (fw += L * (.26 + .12 * Math.sin(7 * t + i + (sd > 0 ? 1 : 0)))), 
            "groom" === sp.state && 0 === i && (fw += .15 * L * (.5 + .5 * Math.sin(9 * t + sd)), 
            fv *= .75), wipe > .01 && 0 === i) {
                const w = wipe * (.65 + .35 * Math.sin(10 * t + (sd > 0 ? 0 : 1.7)));
                fu = M.lerp(fu, .4 * L, w), fv = M.lerp(fv, sd * L * .16, w), fw = M.lerp(fw, h0 + .16 * L, w);
            }
            if (strK > .01 && (i < 2 ? (fu += .16 * L * strK, fw += .05 * L * strK * (0 === i ? 1 : 0)) : fu -= .12 * L * strK, 
            fv *= 1 + .12 * strK), flat > .01 && (fv *= 1 + .2 * flat, fu *= 1 + .06 * flat), 
            hang > .01 && (fv *= 1 - .25 * hang, fw += .05 * L * hang), o.airborne && (i < 2 ? (fu += .22 * L, 
            fw += .06 * L, fv *= .8) : (fu -= .3 * L, fv *= .7)), i < 2 && reach > .01 && (fu = M.lerp(fu, L * (.98 - .16 * i) * Math.sqrt(lg), reach), 
            fv = M.lerp(fv, sd * L * (.2 + .15 * i), reach), fw = M.lerp(fw, h0 + L * (.03 - .05 * i), reach)), 
            spin && i >= 2) {
                const ph2 = 4.2 * t + (sd > 0 ? Math.PI : 0), cpull = .5 + .5 * Math.sin(ph2);
                3 === i ? (fu = M.lerp(fu, .55 * -L, cpull), fv = M.lerp(fv, sd * L * .1, .85 * cpull), 
                fw += .08 * L * Math.max(0, Math.cos(ph2))) : (fv *= 1.1, fu -= .04 * L);
            }
            o.curled ? (fu *= .35, fv *= .55, fw = h0 + .14 * L) : o.tucked && (fu *= .6, fv *= .56, 
            fw = .03 * L);
            const hip = W(AU[i] * L, sd * L * .15, h0 + .04 * L);
            let foot = W(fu, fv, fw);
            const hk = hg ? hg.k * (0 === i ? 1 : 1 === i ? hg.big : 0) : 0;
            if (hk > .001) {
                const k = 2 * i + (sd > 0 ? 1 : 0), pulse = 1 - .12 * sq * (.5 + .5 * Math.sin(t * (5.2 + .9 * k) + 1.9 * k + seedP)), hf = 0 === i ? M.add(M.add(M.add(mc, M.mul(fg, .75 * hr)), M.mul(sg, sd * hr * .5 * pulse)), M.mul(n, .2 * hr)) : M.add(M.add(M.add(mc, M.mul(fg, .18 * -hg.pl)), M.mul(sg, sd * hr * .9 * pulse)), M.mul(n, .15 * hr));
                foot = M.lerp3(foot, hf, hk);
            }
            const gk = gc && hk < .01 ? gripK : 0;
            let gAnk = null;
            if (gk > .001) {
                const d = M.sub(foot, p), ua = M.dot(d, ga), vb = M.dot(d, gb), up = .6 * Math.max(0, M.dot(d, n)), th = Math.sign(vb || sd) * M.clamp(Math.abs(vb) / (gR + .18 * L), .5, 2.4), rad = (an, r) => M.add(M.mul(n, Math.cos(an) * r), M.mul(gb, Math.sin(an) * r));
                gAnk = M.add(M.add(gc, M.mul(ga, .78 * ua)), rad(.55 * th, gR + .08 * L)), foot = M.lerp3(foot, M.add(M.add(gc, M.mul(ga, .82 * ua)), rad(th, gR + up)), gk);
            }
            let footP = null;
            if (RG) {
                let fr0 = o.airborne || o.curled || o.tucked || hang > .01 || hk > .01 ? 1 : 0;
                0 === i && (fr0 = Math.max(fr0, raise, wipe, "groom" === sp.state ? 1 : 0, LK.antennae ? 1 : 0)), 
                i < 2 && (fr0 = Math.max(fr0, .9 * fore, reach)), "display" === sp.state && i <= (S.prefs.display > .7 ? 2 : 0) && (fr0 = 1), 
                spin && i >= 2 && (fr0 = 1), "choppy" === gait && i < 3 && (fr0 = Math.max(fr0, .85 * gp)), 
                fr0 = Math.max(fr0, strK, Math.min(1, 4 * tapK)), footP = JT.Gait.foot(RG, lk, foot, fr0, n);
            }
            const mid = M.lerp3(hip, foot, .4), far = sd * M.dot(s, V.toCam) < -.15 && !o.thumb;
            let knee = M.add(M.add(mid, M.mul(n, L * (.15 + .06 * crouch) * Math.sqrt(lg) * sw * (1 - .35 * (LK.flat || 0)) * (1 - .45 * flat) * (o.curled ? .4 : o.tucked ? .7 : 1) * (far ? .45 : 1) * (i < 2 ? 1 - .65 * reach : 1) * (1 + .35 * hk) * (1 - .3 * gk))), M.mul(s, sd * L * (.06 + .06 * hk)));
            const kv = M.dot(M.sub(knee, p), s) * sd, minV = L * (o.curled ? .24 : o.tucked ? .27 : far ? .4 : .33) * (1 + .5 * (lg - 1)) * (1 - gk) + gk * (gR + .16 * L);
            if (kv < minV && (knee = M.add(knee, M.mul(s, sd * (minV - kv)))), footP && M.dist(footP, foot) > .002 * L) {
                const l1 = M.dist(hip, knee), l2 = M.dist(knee, foot);
                knee = JT.Gait.knee(hip, footP, l1, l2, knee), foot = footP;
            }
            let ankle = M.add(M.lerp3(knee, foot, .62), M.mul(n, .05 * L));
            if (gAnk && (ankle = M.lerp3(ankle, gAnk, gk)), hk > .001) {
                const latTo = (q, v) => M.add(q, M.mul(sg, sd * v - M.dot(M.sub(q, mc), sg))), kH = latTo(M.add(M.lerp3(hip, foot, .5), M.mul(n, L * (.1 + .03 * i) + .4 * hr)), 1 * hr + .1 * L);
                knee = M.lerp3(knee, kH, hk);
                const aH = latTo(M.add(M.add(foot, M.mul(fg, 0 === i ? .45 * -hr : 0)), M.mul(n, .55 * hr + .03 * L)), .95 * hr + .03 * L);
                ankle = M.lerp3(ankle, aH, hk);
            }
            doShadow && shLegs.push([ hip, knee, ankle, foot, RG ? JT.Gait.liftOf(RG, lk) : o.airborne || o.curled || o.tucked ? 1 : 0 ]);
            const wk = (0 === i ? LK.frontW || 1.3 : 1) * (LK.legW || 1), col = 0 === i ? sh(pal.leg, -.04) : pal.leg;
            let kd = V.depth(knee) + (M.dot(M.sub(knee, cc), V.toCam) > 0 ? -.02 : .02), pd = dorsal ? Math.max(V.depth(cc), V.depth(ac)) + .015 : kd;
            if (hk > .5 && far && !dorsal) {
                const md = Math.max(V.depth(cc), V.depth(mp0)) + .03;
                kd = md + .01, pd = md + .012;
            }
            parts.push({
                d: pd,
                f: () => {
                    const Sx = limb(ctx, V, [ hip, knee ], [ .066 * L * wk ], col, lod, null);
                    legHair(Sx[0], Sx[1], .066 * L * wk * V.s, i, lk, 0);
                }
            }), parts.push({
                d: kd,
                f: () => {
                    const Sx = limb(ctx, V, [ knee, ankle, foot ], [ .05 * L * wk, .03 * L * (LK.legW || 1) ], col, lod, null);
                    legHair(Sx[0], Sx[1], .05 * L * wk * V.s, i, lk, 1);
                    const kr = .066 * L * wk * V.s * .5;
                    lod > 0 && kr > .8 && (ctx.fillStyle = ring || sh(col, .06), ctx.beginPath(), ctx.arc(Sx[0][0], Sx[0][1], kr, 0, 6.283), 
                    ctx.fill());
                }
            });
        }
        if (o.meal) {
            const mp = M.add(W(.4 * L, 0, .35 * h0), M.mul(fg, .06 * L)), back = Math.max(V.depth(cc), V.depth(mp)) + .03;
            parts.push({
                d: back,
                f: () => {
                    o.meal(mp, fg, sg, n), ctx.globalAlpha = alpha;
                }
            });
        }
        doShadow && castShadow(ctx, V, p, f, s, n, L, h0 + .12 * L, alpha, 1, {
            kind: "spider",
            perch: o.perch,
            held: o.heldLen,
            ph: moving && !RG ? wph : 0,
            legs: shLegs
        }), sortDraw(parts), ctx.globalAlpha = 1;
    }, D.nest = function(ctx, V, n, up, night, layer, info) {
        const L = n.len, pr = M.clamp(n.prog, 0, 1);
        if (pr <= .02) return;
        info = info || {};
        let f = M.sub(n.fwd, M.mul(up, M.dot(n.fwd, up)));
        f = M.len(f) > .001 ? M.norm(f) : M.norm(M.cross(up, [ 0, 0, 1 ]));
        const s = M.norm(M.cross(up, f)), k = .84 + .16 * pr, A0 = .68 * L * k, B0 = .5 * L * k, C0 = .42 * L * k, ax = M.mul(f, A0), ay = M.mul(s, B0), az = M.mul(up, C0), c = M.add(n.pos, M.mul(up, .12 * L)), P = V.P(c), e = projEll(V, ax, ay, az);
        if (e.r1 < 1) return;
        const fade = n.owner ? 1 : Math.max(.25, 1 - n.age / 1800), cover = M.smooth(M.clamp((pr - .1) / .8, 0, 1)), tc = night ? [ 205, 215, 235 ] : [ 246, 247, 250 ], rgba = (cc, a) => "rgba(" + cc[0] + "," + cc[1] + "," + cc[2] + "," + M.clamp(a, 0, 1).toFixed(3) + ")", shade = (cc, m) => cc.map(v => Math.round(v * m)), pt = (u, th) => {
            const r = Math.sqrt(Math.max(0, 1 - u * u)), sn = Math.max(Math.sin(th), -.3);
            return M.add(M.add(M.add(c, M.mul(ax, u)), M.mul(ay, Math.cos(th) * r)), M.mul(az, sn * r));
        }, nrm = (u, th) => {
            const r = Math.sqrt(Math.max(0, 1 - u * u));
            return M.norm(M.add(M.add(M.mul(f, u / A0), M.mul(s, Math.cos(th) * r / B0)), M.mul(up, Math.max(Math.sin(th), -.3) * r / C0)));
        }, rng = JT.makeRng(n.seed || 1), lump = [];
        for (let i = 0; i < 4; i++) lump.push([ 1 + 2 * i + Math.floor(2 * rng()), 6.283 * rng(), (.012 + .02 * rng()) * (i < 2 ? 1.3 : 1) ]);
        const blobPath = sc => {
            ctx.beginPath();
            for (let j = 0; j <= 40; j++) {
                const a = j / 40 * 6.283;
                let r = 1;
                for (const [fq, ph, am] of lump) r += Math.sin(a * fq + ph) * am * (.5 + .5 * cover);
                const x = Math.cos(a) * e.r1 * r * sc, y = Math.sin(a) * e.r2 * r * sc;
                j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.closePath();
        }, nT = Math.round(8 + 56 * pr), strands = [];
        for (let i = 0; i < 64; i++) {
            const u0 = 1.7 * rng() - .85, du = .7 * (rng() - .5), th0 = 6.283 * rng(), wr = (.55 + .7 * rng()) * (rng() < .5 ? 1 : -1), w = rng(), g = rng();
            i < nT && strands.push({
                u0: u0,
                du: du,
                th0: th0,
                wr: wr,
                w: w,
                g: g
            });
        }
        const drawStrands = front => {
            ctx.lineCap = "round";
            for (const st of strands) {
                const al = (front ? .22 + .4 * st.w : .1 + .16 * st.w) * fade * (.6 + .4 * cover), col = st.g < .35 ? shade(tc, .7) : st.g < .6 ? shade(tc, .86) : [ 255, 255, 255 ];
                ctx.strokeStyle = rgba(col, al), ctx.lineWidth = Math.max(.3, V.s * (.035 + .04 * st.w));
                let prev = null, on = !1;
                ctx.beginPath();
                for (let j = 0; j <= 16; j++) {
                    const t = j / 16, u = M.clamp(st.u0 + st.du * t, -.97, .97), th = st.th0 + 6.283 * st.wr * t, vis = M.dot(nrm(u, th), V.toCam) >= 0, q = V.P(pt(u, th));
                    vis === front ? (!on && prev ? ctx.moveTo(prev[0], prev[1]) : on || ctx.moveTo(q[0], q[1]), 
                    ctx.lineTo(q[0], q[1]), on = !0) : on = !1, prev = q;
                }
                ctx.stroke();
            }
        };
        if (ctx.save(), "back" === layer) {
            const sh = projEll(V, M.mul(f, 1.08 * A0), M.mul(s, 1.08 * B0), M.mul(up, .01 * L)), Q = V.P(n.pos);
            ctx.save(), ctx.translate(Q[0], Q[1]), ctx.rotate(sh.ang), ctx.fillStyle = "rgba(30,24,18," + (.16 * pr * fade).toFixed(3) + ")", 
            ctx.beginPath(), ctx.ellipse(0, 0, sh.r1, sh.r2, 0, 0, 6.283), ctx.fill(), ctx.restore(), 
            ctx.strokeStyle = rgba(tc, .3 * pr * fade), ctx.lineWidth = Math.max(.35, .05 * V.s);
            for (let i = 0; i < 6; i++) {
                const a = 1.047 * (i + .6 * rng()), dir = M.add(M.mul(f, Math.cos(a)), M.mul(s, Math.sin(a))), q0 = V.P(pt(.8 * Math.cos(a), Math.sin(a) > 0 ? -.2 : 3.34)), q1 = V.P(M.add(n.pos, M.mul(dir, L * (.85 + .25 * rng()))));
                ctx.beginPath(), ctx.moveTo(q0[0], q0[1]), ctx.lineTo(q1[0], q1[1]), ctx.stroke();
            }
            ctx.save(), ctx.translate(P[0], P[1]), ctx.rotate(e.ang);
            const g = ctx.createRadialGradient(0, .2 * e.r2, .2 * e.r2, 0, 0, e.r1);
            return g.addColorStop(0, rgba(shade(tc, .72), (.08 + .4 * cover) * fade)), g.addColorStop(1, rgba(shade(tc, .86), (.12 + .45 * cover) * fade)), 
            ctx.fillStyle = g, blobPath(1), ctx.fill(), ctx.restore(), drawStrands(!1), void ctx.restore();
        }
        ctx.save(), ctx.translate(P[0], P[1]), ctx.rotate(e.ang);
        const lp = V.J(M.mul(M.norm(M.add(up, M.mul(V.toCam, .6))), 1)), ll = Math.hypot(lp[0], lp[1]) || 1, ca = Math.cos(-e.ang), sa = Math.sin(-e.ang), lx = (lp[0] * ca - lp[1] * sa) / ll, ly = (lp[0] * sa + lp[1] * ca) / ll, Af = (.06 + .9 * cover) * fade, g = ctx.createRadialGradient(lx * e.r1 * .3, ly * e.r2 * .45, .08 * e.r2, 0, 0, 1.02 * e.r1);
        g.addColorStop(0, rgba([ 255, 255, 255 ], Af)), g.addColorStop(.45, rgba(tc, Af)), 
        g.addColorStop(.85, rgba(shade(tc, .86), Af)), g.addColorStop(1, rgba(shade(tc, .74), .95 * Af)), 
        ctx.fillStyle = rgba(tc, .22 * Af), blobPath(1.07), ctx.fill(), ctx.fillStyle = g, 
        blobPath(1), ctx.fill(), ctx.save(), blobPath(1), ctx.clip();
        const sg = ctx.createLinearGradient(lx * e.r1, ly * e.r2, -lx * e.r1, -ly * e.r2);
        sg.addColorStop(.45, "rgba(90,84,78,0)"), sg.addColorStop(1, "rgba(90,84,78," + (.28 * cover * fade).toFixed(3) + ")"), 
        ctx.fillStyle = sg, ctx.fillRect(-e.r1, -e.r2, 2 * e.r1, 2 * e.r2), ctx.restore();
        const g2 = ctx.createRadialGradient(lx * e.r1 * .35, ly * e.r2 * .5, 0, lx * e.r1 * .2, ly * e.r2 * .3, .6 * e.r1);
        if (g2.addColorStop(0, rgba([ 255, 255, 255 ], .5 * cover * fade)), g2.addColorStop(1, rgba([ 255, 255, 255 ], 0)), 
        ctx.fillStyle = g2, blobPath(.9), ctx.fill(), ctx.strokeStyle = rgba(shade(tc, .8), (.1 + .2 * cover) * fade), 
        ctx.lineWidth = Math.max(.5, .06 * V.s), blobPath(.99), ctx.stroke(), ctx.restore(), 
        drawStrands(!0), cover > .3) {
            ctx.strokeStyle = rgba([ 255, 255, 255 ], .35 * cover * fade), ctx.lineWidth = Math.max(.3, .03 * V.s);
            for (let i = 0; i < 26; i++) {
                const u = 1.6 * rng() - .8, th = 3.4 * rng() - .2, a = pt(u, th), b = M.add(a, M.mul(nrm(u, th), L * (.04 + .06 * rng())));
                if (M.dot(nrm(u, th), V.toCam) < 0) continue;
                const qa = V.P(a), qb = V.P(b);
                ctx.beginPath(), ctx.moveTo(qa[0], qa[1]), ctx.lineTo(qb[0], qb[1]), ctx.stroke();
            }
        }
        if (n.build && n.owner) {
            const a = n.spinA || 0, fd = M.norm(M.add(M.mul(f, Math.cos(a)), M.mul(s, Math.sin(a)))), sd = M.norm(M.cross(up, fd)), spn = M.add(M.add(n.pos, M.mul(fd, .5 * -L)), M.mul(up, .06 * L)), S0 = V.P(spn);
            for (let j = 0; j < 4; j++) {
                const aj = a - .55 * j, dj = M.norm(M.add(M.mul(f, Math.cos(aj)), M.mul(s, Math.sin(aj)))), anc = M.add(M.add(n.pos, M.mul(dj, .78 * -L)), M.mul(sd, (j % 2 ? 1 : -1) * L * .12)), Q = V.P(anc);
                ctx.strokeStyle = rgba([ 255, 255, 255 ], (.6 - .13 * j) * fade), ctx.lineWidth = Math.max(.35, .05 * V.s), 
                ctx.beginPath(), ctx.moveTo(S0[0], S0[1]), ctx.quadraticCurveTo((S0[0] + Q[0]) / 2, (S0[1] + Q[1]) / 2 - V.s * L * .08, Q[0], Q[1]), 
                ctx.stroke();
            }
        }
        const vis = M.dot(f, V.toCam);
        if (cover > .35 && vis > -.35) {
            const r = L * (.16 + .12 * (n.hole ? M.clamp(n.hole.open, 0, 1) : 0)) * M.clamp(2.5 * (cover - .35), .3, 1), hc = M.add(pt(.86, 1.2), M.mul(f, .02 * L)), he = projEll(V, M.mul(s, r), M.mul(up, .85 * r), M.mul(f, .02 * L));
            if (he.r1 >= .6) {
                const H = V.P(hc), va = fade * M.clamp(2 * (vis + .35), 0, 1);
                ctx.save(), ctx.globalAlpha = va, ctx.translate(H[0], H[1]), ctx.rotate(he.ang);
                const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, he.r1);
                hg.addColorStop(0, "rgba(14,11,8,0.95)"), hg.addColorStop(.7, "rgba(30,26,22,0.85)"), 
                hg.addColorStop(1, "rgba(70,66,60,0.05)"), ctx.fillStyle = hg, ctx.beginPath(), 
                ctx.ellipse(0, 0, he.r1, Math.max(.5, he.r2), 0, 0, 6.283), ctx.fill(), ctx.strokeStyle = "rgba(250,250,252,0.5)", 
                ctx.lineWidth = Math.max(.35, .05 * V.s);
                for (let i = 0; i < 10; i++) {
                    const a = 6.283 * rng(), w = .8 + .5 * rng(), x = Math.cos(a) * he.r1 * .85, y = Math.sin(a) * he.r2 * .85;
                    ctx.beginPath(), ctx.moveTo(x, y), ctx.lineTo(x * (1 + .35 * w), y * (1 + .35 * w)), 
                    ctx.stroke();
                }
                if (ctx.restore(), info.glint && vis > .05) {
                    const gA = va * M.clamp(3 * vis, 0, 1) * (!0 === info.glint ? 1 : info.glint), fc = M.add(hc, M.mul(f, .05 * -L)), F = V.P(fc), cr = projEll(V, M.mul(s, .72 * r), M.mul(up, .5 * r), null);
                    ctx.save(), ctx.globalAlpha = .75 * gA, ctx.translate(F[0], F[1]), ctx.rotate(cr.ang), 
                    ctx.fillStyle = info.ceph || "#3a2a20", ctx.beginPath(), ctx.ellipse(0, .25 * cr.r2, cr.r1, cr.r2, 0, 0, 6.283), 
                    ctx.fill(), ctx.restore();
                    const er = Math.max(.6, .036 * L * V.s);
                    for (const sd2 of [ -1, 1 ]) {
                        const ep = V.P(M.add(M.add(fc, M.mul(s, sd2 * r * .36)), M.mul(up, .02 * -r)));
                        ctx.globalAlpha = gA, ctx.fillStyle = "#050403", ctx.beginPath(), ctx.arc(ep[0], ep[1], er, 0, 6.283), 
                        ctx.fill(), ctx.fillStyle = info.eye || "rgba(120,90,60,0.6)", ctx.globalAlpha = .5 * gA, 
                        ctx.beginPath(), ctx.arc(ep[0], ep[1], .65 * er, 0, 6.283), ctx.fill(), ctx.globalAlpha = gA * (.75 + .2 * Math.sin(1.3 * (info.time || 0) + sd2)), 
                        ctx.fillStyle = "#fff", ctx.beginPath(), ctx.arc(ep[0] - .3 * er, ep[1] - .35 * er, Math.max(.45, .3 * er), 0, 6.283), 
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                }
            }
        }
        ctx.restore();
    }, D.prey = function(ctx, V, e, fr, o) {
        const d = JT.PREY_BY_ID[e.type];
        if (!d) return;
        if ("spider" === d.shape) {
            const fl0 = o.flail || 0, pseudo = {
                species: e.species || "zebra",
                state: "idle",
                _walk: e._walk,
                _moving: fl0 > .15 || M.len(e._vel || [ 0, 0, 0 ]) > 1,
                seed: e.seed,
                sat: .6
            }, pal = e.species ? null : {
                ceph: "#3a2a20",
                abd: "#4a3628",
                mark: "#d8c8a8",
                leg: "#4a3a2c",
                chel: "#3a2a20",
                hair: "#a08a6a",
                belly: "#6a5a4a"
            };
            return void ("jumperMeal" !== e.type && D.jumper || D.spider)(ctx, V, pseudo, fr, {
                len: (o.len || d.len) * (o.scale || 1),
                palette: pal,
                alpha: o.alpha,
                curled: !(fl0 > .15) && (o.held || o.curled),
                time: o.time,
                noShadow: o.held
            });
        }
        const L = (o.len || d.len) * (o.scale || 1), {f: f, s: s, n: n} = fr, p = fr.p, W = (u, v, w) => [ p[0] + f[0] * u + s[0] * v + n[0] * w, p[1] + f[1] * u + s[1] * v + n[1] * w, p[2] + f[2] * u + s[2] * v + n[2] * w ];
        e._anim, e.seed;
        const T = o.time || 0, flying = e.sup && "air" === e.sup.k && !e.owner, moving = M.len(e._vel || [ 0, 0, 0 ]) > 1, held = !(!o.held && !o.curled), fl = held && o.flail || 0, buzz = fl > .25 && !flying, a0 = null != o.alpha ? o.alpha : 1;
        ctx.globalAlpha = a0;
        const col = hex6(d.col), px = L * V.s, lod = lodFor(px, o), S = d.shape;
        if (flying || held || o.noShadow || castShadow(ctx, V, p, f, s, n, .9 * L, .15 * L, a0, "worm" === S ? .35 : "springtail" === S || "gnat" === S || "lacewing" === S ? .6 : 1, {
            kind: "prey",
            perch: o.perch
        }), 0 === lod && px < 4) {
            if (blob(ctx, V, W(0, 0, .16 * L), M.mul(f, .45 * L), M.mul(s, L * ("worm" === S ? .1 : .2)), M.mul(n, .14 * L), "fly" === S || "gnat" === S ? sh(col, -.15) : col, {
                lod: 0
            }), flying) {
                const P = V.P(W(0, 0, .3 * L));
                ctx.fillStyle = "rgba(230,240,255,0.35)", ctx.beginPath(), ctx.arc(P[0], P[1], Math.max(1, .6 * px), 0, 6.283), 
                ctx.fill();
            }
            return void (ctx.globalAlpha = 1);
        }
        const parts = [], add = (pos, fn, bias) => parts.push({
            d: V.depth(pos) + (bias || 0),
            f: fn
        }), B = (c, a, b, cc, colr, opt) => add(c, () => blob(ctx, V, c, a, b, cc, colr, Object.assign({
            lod: lod,
            time: T
        }, opt || {}))), legW = k => L * k, legs6 = (spread, w, colr, hipW, gait) => {
            for (const sd of [ -1, 1 ]) for (let i = 0; i < 3; i++) {
                const ph = (e._walk || 0) * Math.PI + 2.1 * i + (sd > 0 ? 1.5 : 0), u = (.18 - .16 * i) * L, fu = u + (.12 - .14 * i) * L + .07 * Math.sin(ph) * L * (moving ? 1 : 0), lift = .05 * Math.max(0, Math.cos(ph)) * L * (moving ? 1 : 0), hip = W(u, sd * L * (hipW || .07), .1 * L), foot = held ? fl > .02 ? W(.5 * u + .12 * Math.sin(26 * T + 2.1 * i + sd) * L * fl, sd * L * spread * (.42 + .4 * fl * (.5 + .5 * Math.sin(19 * T + 1.7 * i + 2 * sd))), .25 * L - .1 * Math.cos(23 * T + i) * L * fl) : W(.5 * u, sd * L * spread * .4, .25 * L) : flying ? W(u - .1 * L, sd * L * spread * .5, 0 * L) : W(fu, sd * L * spread, lift), knee = M.add(M.lerp3(hip, foot, .45), M.mul(n, L * (gait || .14)));
                add(knee, () => limb(ctx, V, [ hip, knee, foot ], [ legW(w), legW(.7 * w) ], colr, lod, null), M.dot(M.sub(knee, p), V.toCam) > 0 ? -.01 : .01);
            }
        }, antennae = (base, len, colr, w, curl) => {
            for (const sd of [ -1, 1 ]) {
                const sw = .06 * Math.sin(2.2 * T + sd + (e.seed || 0)), a = W(base * L, sd * L * .04, .2 * L), m = W(base * L + L * len * .5, sd * L * (.15 + sw), L * (.3 + curl)), b = W(base * L + L * len, sd * L * (.32 + 2 * sw), L * (.22 + curl));
                add(m, () => curve(ctx, V, a, m, b, L * w, ink(colr)));
            }
        };
        if ("fly" === S || "gnat" === S) {
            const g = "gnat" === S, met = !!d.metallic, bc = met ? "#1f4a8a" : col;
            g && flying || legs6(g ? .55 : .36, .028, sh(bc, -.45), .06, g ? .22 : .14), B(W(-.2 * L, 0, .17 * L), M.mul(f, L * (g ? .3 : .28)), M.mul(s, L * (g ? .1 : .17)), M.mul(n, L * (g ? .1 : .14)), sh(bc, -.08), {
                gloss: met ? 1 : .5,
                sheen: met ? 1 : 0,
                hatch: !0
            });
            const abdP = Part(W(-.2 * L, 0, .17 * L), M.mul(f, .28 * L), M.mul(s, .17 * L), M.mul(n, .14 * L));
            !g && lod > 0 && add(abdP.c, () => decals(ctx, V, abdP, [ band(-.1, .12, "dark"), band(-.45, .12, "dark"), band(.25, .1, "dark") ], {
                dark: sh(bc, -.45)
            }, a0), -.005), B(W(.1 * L, 0, .2 * L), M.mul(f, .19 * L), M.mul(s, L * (g ? .1 : .16)), M.mul(n, L * (g ? .11 : .15)), g ? sh(col, -.1) : sh(bc, .05), {
                gloss: .4,
                fuzz: g ? 0 : .6,
                fuzzCol: sh(bc, -.5)
            });
            const hc = W(.33 * L, 0, .21 * L);
            if (B(hc, M.mul(f, .09 * L), M.mul(s, L * (g ? .07 : .13)), M.mul(n, L * (g ? .07 : .12)), sh(bc, -.25), {}), 
            !g) for (const sd of [ -1, 1 ]) {
                const ec = W(.35 * L, sd * L * .085, .23 * L);
                B(ec, M.mul(f, .07 * L), M.mul(s, .06 * L), M.mul(n, .085 * L), hex6(d.eye || "#a01a10"), {
                    gloss: 1
                });
            }
            g && antennae(.36, .35, col, .02, .05);
            const flap = flying || buzz ? Math.sin(70 * T + (e.seed || 0)) : 0;
            for (const sd of [ -1, 1 ]) {
                const root0 = W(.12 * L, sd * L * .05, .3 * L);
                let dir = M.norm(M.add(M.add(M.mul(f, -.9), M.mul(s, sd * (held ? .15 : .32))), M.mul(n, .06))), side = M.norm(M.cross(n, dir));
                sd < 0 && (side = M.mul(side, -1));
                const ang = flying ? .9 * flap : buzz ? .2 + .5 * fl * flap : .12, sideR = M.add(M.mul(side, Math.cos(ang)), M.mul(n, Math.sin(ang) * sd * 0 + Math.sin(ang))), wl = L * (g ? .62 : .5), ww = L * (g ? .16 : .2), wc = M.add(root0, M.mul(M.add(M.mul(dir, Math.cos(.5 * ang)), M.mul(n, .6 * Math.abs(Math.sin(ang)))), .5 * wl)), fill = flying ? "rgba(225,235,245,0.22)" : g ? "rgba(150,150,160,0.42)" : "rgba(225,235,245,0.45)";
                add(wc, () => wing(ctx, V, wc, M.mul(dir, .5 * wl), M.mul(sideR, .5 * ww), fill, "rgba(60,60,70,0.55)", !flying, lod), -.03), 
                flying && lod > 0 && add(wc, () => {
                    const P = V.P(root0), q = V.P(M.add(root0, M.mul(dir, wl)));
                    ctx.fillStyle = "rgba(230,240,255,0.14)", ctx.beginPath(), ctx.moveTo(P[0], P[1]), 
                    ctx.arc(P[0], P[1], Math.hypot(q[0] - P[0], q[1] - P[1]), Math.atan2(q[1] - P[1], q[0] - P[0]) - .9, Math.atan2(q[1] - P[1], q[0] - P[0]) + .9), 
                    ctx.closePath(), ctx.fill();
                }, -.04);
            }
        } else if ("moth" === S || "lacewing" === S) {
            const moth = "moth" === S, bc = moth ? col : "#7ac06a";
            legs6(.32, .022, sh(bc, -.3), .06, .08), B(W(-.15 * L, 0, .16 * L), M.mul(f, .3 * L), M.mul(s, L * (moth ? .1 : .06)), M.mul(n, L * (moth ? .1 : .06)), sh(bc, moth ? .08 : 0), {
                fuzz: moth ? 1.2 : 0,
                fuzzCol: sh(bc, .3)
            }), B(W(.18 * L, 0, .19 * L), M.mul(f, .13 * L), M.mul(s, L * (moth ? .12 : .07)), M.mul(n, L * (moth ? .12 : .07)), sh(bc, -.05), {
                fuzz: moth ? 1.5 : 0,
                fuzzCol: sh(bc, .35)
            });
            const hc = W(.34 * L, 0, .19 * L);
            B(hc, M.mul(f, .06 * L), M.mul(s, .08 * L), M.mul(n, .07 * L), moth ? sh(bc, -.15) : "#e8c040", {
                gloss: moth ? 0 : 1
            }), antennae(.36, moth ? .38 : .7, moth ? sh(col, -.25) : "#9ac080", moth ? .014 : .01, .08);
            const flapA = flying || buzz ? .25 + (flying ? 1.1 : .6 * fl) * Math.abs(Math.cos(T * (moth ? 14 : 18) * (buzz ? 2 : 1) + (e.seed || 0))) : moth ? .55 : .35;
            for (const pair of moth ? [ 0 ] : [ 0, 1 ]) for (const sd of [ -1, 1 ]) {
                const root0 = W((.18 - .06 * pair) * L, 0, .25 * L), back = M.norm(M.add(M.mul(f, -1), M.mul(s, sd * (flying ? .25 + .08 * pair : .06)))), outv = (M.norm(M.add(M.mul(M.norm(M.cross(n, back)), -sd * Math.cos(flapA)), M.mul(n, 0 * -Math.sin(flapA) + Math.sin(flapA)))), 
                flying ? M.add(M.mul(s, sd * Math.cos(flapA)), M.mul(n, Math.sin(flapA))) : M.norm(M.add(M.mul(s, sd * (moth ? .62 : .5)), M.mul(n, -.42)))), wl = L * (moth ? .62 : .85), ww = L * (moth ? .42 : .24), wc = M.add(M.add(root0, M.mul(back, .45 * wl)), M.mul(outv, .45 * ww)), nrm = M.norm(M.cross(back, outv)), lit = M.clamp(.55 + .45 * Math.abs(M.dot(nrm, LG)), .4, 1);
                moth ? add(wc, () => {
                    const A = V.P(root0), Bp = V.P(M.add(root0, M.add(M.mul(back, .35 * wl), M.mul(outv, ww)))), Cp = V.P(M.add(root0, M.add(M.mul(back, wl), M.mul(outv, .8 * ww)))), Dp = V.P(M.add(root0, M.mul(back, .9 * wl)));
                    if (ctx.beginPath(), ctx.moveTo(A[0], A[1]), ctx.quadraticCurveTo(Bp[0], Bp[1], M.lerp(Bp[0], Cp[0], .5), M.lerp(Bp[1], Cp[1], .5)), 
                    ctx.lineTo(Cp[0], Cp[1]), ctx.quadraticCurveTo(M.lerp(Cp[0], Dp[0], .6), M.lerp(Cp[1], Dp[1], .6), Dp[0], Dp[1]), 
                    ctx.closePath(), ctx.fillStyle = sh(col, .8 * (lit - .75)), ctx.fill(), lod > 0 && (ctx.strokeStyle = ink(col), 
                    ctx.lineWidth = Math.max(.4, .012 * px), ctx.stroke()), lod > 0) {
                        const ey = V.P(M.add(root0, M.add(M.mul(back, .5 * wl), M.mul(outv, .55 * ww))));
                        ctx.fillStyle = sh(col, -.45), ctx.beginPath(), ctx.arc(ey[0], ey[1], Math.max(.6, .045 * px), 0, 6.283), 
                        ctx.fill(), ctx.fillStyle = sh(col, .4), ctx.beginPath(), ctx.arc(ey[0], ey[1], Math.max(.3, .018 * px), 0, 6.283), 
                        ctx.fill();
                        const b1 = V.P(M.add(root0, M.add(M.mul(back, .75 * wl), M.mul(outv, .1 * ww)))), b2 = V.P(M.add(root0, M.add(M.mul(back, .68 * wl), M.mul(outv, .85 * ww))));
                        ctx.strokeStyle = sh(col, -.3), ctx.lineWidth = Math.max(.5, .02 * px), ctx.beginPath(), 
                        ctx.moveTo(b1[0], b1[1]), ctx.lineTo(b2[0], b2[1]), ctx.stroke();
                    }
                }, flying ? -.03 * sd : -1 - .03 * sd) : add(wc, () => wing(ctx, V, wc, M.mul(back, .5 * wl), M.mul(outv, .5 * ww), "rgba(200,250,205,0.28)", "rgba(90,170,90,0.7)", !0, lod), flying ? -.03 : -1);
            }
        } else if ("cricket" === S || "locust" === S) {
            const big = "locust" === S, bc = col;
            for (const sd of [ -1, 1 ]) for (let i = 0; i < 2; i++) {
                const ph = (e._walk || 0) * Math.PI + 2 * i + (sd > 0 ? 1.5 : 0), hip = W((.24 - .12 * i) * L, sd * L * .08, .1 * L), foot = W((.4 - .14 * i) * L + .05 * Math.sin(ph) * L * (moving ? 1 : 0), sd * L * .3, 0), knee = M.add(M.lerp3(hip, foot, .5), M.mul(n, .1 * L));
                add(knee, () => limb(ctx, V, [ hip, knee, foot ], [ .035 * L, .025 * L ], sh(bc, -.25), lod, null), .01);
            }
            for (const sd of [ -1, 1 ]) {
                const hop = "hop" === e.state ? .5 : 0, hip = W(-.05 * L, sd * L * .12, .13 * L), knee = W(-.45 * L - .2 * hop * L, sd * L * .2, L * (.32 - .15 * hop)), foot = W(-.22 * L - .5 * hop * L, sd * L * .26, 0), fm = M.lerp3(hip, knee, .45), fd = M.mul(M.sub(knee, hip), .55), fs = M.norm(M.cross(fd, n));
                add(fm, () => {
                    if (blob(ctx, V, fm, fd, M.mul(fs, .075 * L), M.mul(M.norm(M.cross(fd, fs)), .06 * L), sh(bc, .05), {
                        lod: lod,
                        gloss: .3,
                        hatch: !1
                    }), lod > 0) {
                        const A = V.P(M.lerp3(hip, knee, .2)), Bq = V.P(M.lerp3(hip, knee, .8));
                        ctx.strokeStyle = sh(bc, -.3), ctx.lineWidth = Math.max(.4, .008 * px), ctx.beginPath();
                        for (let k = 0; k < 5; k++) {
                            const tt = k / 4, x = M.lerp(A[0], Bq[0], tt), y = M.lerp(A[1], Bq[1], tt);
                            ctx.moveTo(x - 1, y - 1.5), ctx.lineTo(x + 1, y + 1.5);
                        }
                        ctx.stroke();
                    }
                }, M.dot(M.sub(fm, p), V.toCam) > 0 ? -.02 : .02), add(knee, () => {
                    const Sx = limb(ctx, V, [ knee, foot ], [ .028 * L ], sh(bc, -.3), lod, null);
                    if (2 === lod) {
                        ctx.strokeStyle = sh(bc, -.5), ctx.lineWidth = .6, ctx.beginPath();
                        for (let k = 1; k < 5; k++) {
                            const x = M.lerp(Sx[0][0], Sx[1][0], k / 5), y = M.lerp(Sx[0][1], Sx[1][1], k / 5);
                            ctx.moveTo(x, y), ctx.lineTo(x + 1.5, y - 1.5);
                        }
                        ctx.stroke();
                    }
                }, M.dot(M.sub(knee, p), V.toCam) > 0 ? -.02 : .02);
            }
            const abdP = Part(W(-.18 * L, 0, .15 * L), M.mul(f, .3 * L), M.mul(s, .13 * L), M.mul(n, .12 * L));
            add(abdP.c, () => {
                blob(ctx, V, abdP.c, abdP.ax, abdP.ay, abdP.az, sh(bc, -.05), {
                    lod: lod,
                    gloss: .35,
                    hatch: !0
                }), lod > 0 && decals(ctx, V, abdP, [ band(.3, .06, "dark"), band(0, .06, "dark"), band(-.3, .06, "dark"), band(-.6, .06, "dark") ], {
                    dark: sh(bc, -.4)
                }, a0);
            });
            for (const sd of [ -1, 1 ]) {
                const wc = W(-.12 * L, sd * L * .05, .25 * L), side = M.norm(M.add(M.mul(s, sd), M.mul(n, .5)));
                add(wc, () => wing(ctx, V, wc, M.mul(f, L * (big ? .42 : .3)), M.mul(side, .08 * L), big ? sh(bc, .15) : "rgba(70,50,30,0.55)", ink(bc), !0, lod), -.03);
            }
            const pc = W(.18 * L, 0, .18 * L);
            B(pc, M.mul(f, .13 * L), M.mul(s, .13 * L), M.mul(n, .12 * L), sh(bc, -.12), {
                gloss: .5
            });
            const hc = W(.36 * L, 0, .17 * L);
            B(hc, M.mul(f, .1 * L), M.mul(s, .1 * L), M.mul(n, .12 * L), sh(bc, -.2), {
                gloss: .4
            });
            for (const sd of [ -1, 1 ]) {
                const ec = W(.4 * L, sd * L * .07, .22 * L);
                B(ec, M.mul(f, .03 * L), M.mul(s, .03 * L), M.mul(n, .035 * L), "#1a120a", {
                    gloss: 1,
                    ink: !1
                });
            }
            if (antennae(.42, big ? .4 : .85, bc, .012, .15), !big) for (const sd of [ -1, 1 ]) {
                const a = W(-.46 * L, sd * L * .04, .14 * L), b = W(-.65 * L, sd * L * .1, .18 * L);
                add(a, () => limb(ctx, V, [ a, b ], [ .015 * L ], sh(bc, -.3), 0, null), .01);
            }
        } else if ("worm" === S) {
            const nseg = d.segs || 10, fatK = d.fat || 1, wig = moving ? 1 : .35, silk = "silkworm" === d.id, segs = [];
            for (let i = 0; i < nseg; i++) {
                const k = i / (nseg - 1), u = (.5 - k) * L, v = Math.sin(.75 * i - 2 * (e._walk || 0) - .6 * T) * L * .05 * wig + (fl > .05 ? Math.sin(1.1 * i - 14 * T) * L * .14 * fl * k : 0), hump = Math.max(0, Math.sin(6.28 * k * 1.5 - 3 * T)) * L * .02 * wig + (fl > .05 && (silk || "hornworm" === d.id) ? Math.max(0, k - .45) * L * .5 * fl * (.6 + .4 * Math.sin(5 * T)) : 0), r = .078 * L * fatK * (0 === i ? .85 : i === nseg - 1 ? .7 : 1);
                segs.push({
                    c: W(u, v, .85 * r + hump),
                    r: r
                });
            }
            if (0 === lod ? add(segs[0].c, () => {
                const S2 = segs.map(q => V.P(q.c));
                ctx.strokeStyle = col, ctx.lineWidth = Math.max(1, 1.8 * segs[1].r * V.s), ctx.lineCap = "round", 
                ctx.beginPath(), S2.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])), 
                ctx.stroke();
            }) : segs.forEach((q, i) => {
                const c2 = 0 === i ? "mealworm" === d.id ? "#6a3a14" : sh(col, -.35) : sh(col, i % 2 ? -.06 : .04);
                B(q.c, M.mul(f, 1.15 * q.r), M.mul(s, q.r), M.mul(n, .9 * q.r), c2, {
                    gloss: "mealworm" === d.id ? .55 : .3,
                    ink: 0 === i
                }), silk && 3 === i && add(q.c, () => {
                    const P = V.P(M.add(q.c, M.mul(n, .9 * q.r)));
                    ctx.fillStyle = "#8a7a6a", ctx.beginPath(), ctx.arc(P[0], P[1], Math.max(.6, q.r * V.s * .3), 0, 6.283), 
                    ctx.fill();
                }, -.01);
            }), "hornworm" === d.id && lod > 0) {
                const q = segs[nseg - 1], a = M.add(q.c, M.mul(n, .7 * q.r)), b = M.add(M.add(q.c, M.mul(f, 1.1 * -q.r)), M.mul(n, 2.2 * q.r));
                add(a, () => limb(ctx, V, [ a, b ], [ .35 * q.r, .12 * q.r ], "#c86a2a", lod, null), -.01);
            }
        } else if ("aphid" === S) {
            legs6(.3, .03, sh(col, -.25), .06, .12), B(W(-.1 * L, 0, .2 * L), M.mul(f, .34 * L), M.mul(s, .24 * L), M.mul(n, .2 * L), col, {
                gloss: .7
            }), B(W(.2 * L, 0, .18 * L), M.mul(f, .14 * L), M.mul(s, .15 * L), M.mul(n, .13 * L), sh(col, -.06), {
                gloss: .5
            }), B(W(.34 * L, 0, .16 * L), M.mul(f, .08 * L), M.mul(s, .1 * L), M.mul(n, .09 * L), sh(col, -.15), {});
            for (const sd of [ -1, 1 ]) {
                const a = W(-.3 * L, sd * L * .1, .3 * L), b = W(-.45 * L, sd * L * .14, .42 * L);
                add(a, () => limb(ctx, V, [ a, b ], [ .035 * L ], sh(col, -.3), lod, null), -.01);
            }
            antennae(.38, .5, sh(col, -.2), .015, .05);
        } else if ("roach" === S || "beetle" === S || "isopod" === S) if (legs6("isopod" === S ? .28 : .4, "roach" === S ? .035 : .03, sh(col, -.4), .08, .12), 
        "isopod" === S) {
            const N = 7;
            for (let i = 0; i < N; i++) {
                const k = i / (N - 1), c2 = W((.32 - .62 * k) * L, 0, .1 * L), wv = L * (.24 - .16 * Math.abs(k - .4));
                B(c2, M.mul(f, .08 * L), M.mul(s, wv), M.mul(n, .1 * L * (1 - .6 * Math.abs(k - .45))), sh(col, 37 * i % 7 / 40 - .05), {
                    gloss: .3
                });
            }
            for (const sd of [ -1, 1 ]) {
                const a = W(-.34 * L, sd * L * .05, .06 * L), b = W(-.48 * L, sd * L * .1, .05 * L);
                add(a, () => limb(ctx, V, [ a, b ], [ .03 * L ], sh(col, -.2), lod, null), .01);
            }
            antennae(.36, .4, col, .025, .05);
        } else {
            const beetle = "beetle" === S, sw = "roach" === S ? .34 : .27, el = Part(W(-.1 * L, 0, .14 * L), M.mul(f, L * (beetle ? .36 : .4)), M.mul(s, L * sw), M.mul(n, L * (beetle ? .17 : .12)));
            add(el.c, () => {
                blob(ctx, V, el.c, el.ax, el.ay, el.az, col, {
                    lod: lod,
                    gloss: beetle ? 1 : .6,
                    hatch: !0
                }), lod > 0 && decals(ctx, V, el, beetle ? [ stripe(0, .03, "dark", -.95, .95) ].concat(d.spots ? [ dot(-.2, .4, .13, "pale"), dot(-.2, -.4, .13, "pale"), dot(-.6, .2, .1, "pale"), dot(-.6, -.2, .1, "pale") ] : [ stripe(.45, .02, "dark", -.8, .8, .5), stripe(-.45, .02, "dark", -.8, .8, .5) ]) : [ band(.5, .04, "dark"), band(.2, .04, "dark"), band(-.1, .04, "dark"), band(-.4, .04, "dark"), band(-.7, .04, "dark"), stripe(.9, .06, "pale", -.6, .6, .5), stripe(-.9, .06, "pale", -.6, .6, .5) ], {
                    dark: sh(col, -.5),
                    pale: beetle ? "#d8c8a0" : sh(col, .35)
                }, a0);
            });
            const pc = W(.33 * L, 0, .13 * L);
            B(pc, M.mul(f, .1 * L), M.mul(s, L * sw * .8), M.mul(n, .09 * L), sh(col, -.15), {
                gloss: beetle ? 1 : .5
            });
            const hc = W(.45 * L, 0, .1 * L);
            B(hc, M.mul(f, .06 * L), M.mul(s, .09 * L), M.mul(n, .07 * L), sh(col, -.35), {}), 
            antennae(.47, beetle ? .32 : .55, col, .02, .03);
        } else if ("springtail" === S) {
            const bc = W(0, 0, .18 * L);
            B(bc, M.mul(f, .42 * L), M.mul(s, .2 * L), M.mul(n, .19 * L), col, {
                gloss: .6
            });
            const hc = W(.42 * L, 0, .18 * L);
            B(hc, M.mul(f, .14 * L), M.mul(s, .15 * L), M.mul(n, .14 * L), sh(col, .08), {
                gloss: .5
            }), antennae(.48, .45, "#c8c8d0", .035, .05);
            const a = W(-.38 * L, 0, .06 * L), b = W(-.15 * L, 0, .01 * L);
            add(a, () => limb(ctx, V, [ a, b ], [ .05 * L ], "#d8d8e0", 0, null), .01), legs6(.3, .05, sh(col, -.2), .08, .08);
        }
        sortDraw(parts), ctx.globalAlpha = 1;
    }, D.critter = {
        blob: blob,
        limb: limb,
        projEll: projEll,
        wing: wing,
        curve: curve,
        sh: sh,
        mix: mix,
        hex6: hex6,
        castShadow: castShadow,
        dropShadow: function(ctx, V, hab, c, gy, f, s, L, kind, alpha, held) {
            const dh = Math.max(0, c[1] - gy), hz = Math.hypot(LG[0], LG[2]), ly = Math.max(LG[1], hz / 2.6, .05), sk = SHAPES[kind] || SHAPES.prey, flat = v => [ v[0] - LG[0] * v[1] / ly, 0, v[2] - LG[2] * v[1] / ly ], q0 = dropAt(hab, c, gy), gx = q0[0], gz = q0[2], capL = v => {
                const l = Math.hypot(v[0], v[2]);
                return l > 1.6 ? [ 1.6 * v[0] / l, 0, 1.6 * v[2] / l ] : v;
            }, fF = capL(flat(f)), sF = capL(flat(s)), fadeOut = M.clamp(1 - q0[3] / (.6 * L), 0, 1);
            if (fadeOut <= .02) return;
            const soft = M.clamp(dh / 30, 0, 1), grow = 1 + .5 * soft, ells = [];
            for (const [u, hl, hw] of sk.e) {
                const q = V.P([ gx + fF[0] * u * L, gy + .05, gz + fF[2] * u * L ]), e = projEll(V, M.mul(fF, hl * L * grow), M.mul(sF, hw * L * grow * ("prey" === kind ? .8 : 1)), null);
                ells.push([ q[0], q[1], e.r1, e.r2, e.ang ]);
            }
            if (held) {
                const q = V.P([ gx + fF[0] * L * .5, gy + .05, gz + fF[2] * L * .5 ]), e = projEll(V, M.mul(fF, .5 * held * grow), M.mul(sF, .2 * held * grow), null);
                ells.push([ q[0], q[1], e.r1, e.r2, e.ang ]);
            }
            paintShadow(ctx, ells, [], alpha * (.1 + .2 * JT.SKY.kd) * M.clamp(1 - dh / 60, .2, 1) * fadeOut, soft);
        },
        dropAt: dropAt,
        paintShadow: paintShadow,
        shArt: shArt,
        lodFor: lodFor,
        sortDraw: sortDraw,
        decals: decals,
        Part: Part,
        surf: surf,
        facing: facing
    };
}();
