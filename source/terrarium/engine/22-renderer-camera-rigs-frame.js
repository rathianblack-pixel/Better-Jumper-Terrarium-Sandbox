!function(root) {
    "use strict";
    const JT = root.JT, M = JT.M, G = JT.G, D = JT.Draw;
    JT.shade;
    const CAMS = {
        iso: {
            yaw: .52,
            pitch: .66,
            label: "Isometric"
        },
        observer: {
            yaw: 0,
            pitch: .4,
            label: "Front"
        },
        follow: {
            yaw: .45,
            pitch: .5,
            label: "Follow"
        },
        reverse: {
            yaw: Math.PI + .26,
            pitch: .5,
            label: "Back"
        },
        left: {
            yaw: 1.22,
            pitch: .44,
            label: "Left"
        },
        right: {
            yaw: -1.22,
            pitch: .44,
            label: "Right"
        }
    };
    function mkCanvas(w, h) {
        const c = document.createElement("canvas");
        return c.width = Math.max(1, 0 | w), c.height = Math.max(1, 0 | h), c;
    }
    JT.CAMS = CAMS, JT.Device = JT.Device || function() {
        const n = root.navigator || {}, ua = n.userAgent || "", ios = /iP(hone|ad|od)/.test(ua) || /Macintosh/.test(ua) && (n.maxTouchPoints || 0) > 1, android = /Android/i.test(ua), mem = +n.deviceMemory || 0, cores = +n.hardwareConcurrency || 0, saver = !(!n.connection || !n.connection.saveData);
        let tier = "mid";
        return android ? tier = /SM-A12|SM-A02|SM-A03/i.test(ua) || mem && mem <= 4 || cores && cores <= 4 ? "low" : "mid" : !ios && mem >= 8 && cores >= 8 ? tier = "high" : (mem && mem <= 2 || cores && cores <= 2) && (tier = "low"), 
        {
            ios: ios,
            android: android,
            mem: mem,
            cores: cores,
            saver: saver,
            tier: tier,
            coarse: !(!root.matchMedia || !root.matchMedia("(pointer:coarse)").matches),
            noGlass: android && "high" !== tier
        };
    }(), JT.Renderer = class {
        constructor(canvas, game, settings) {
            this.cv = canvas, this.ctx = canvas.getContext("2d"), this.game = game, this.set = settings;
            {
                const c = this.ctx, R = this;
                if (c) for (const m of [ "fill", "stroke", "fillRect", "strokeRect", "fillText", "strokeText", "drawImage", "putImageData" ]) {
                    const o = c[m];
                    "function" == typeof o && (c[m] = function() {
                        return R._ovInk = !0, o.apply(this, arguments);
                    });
                }
            }
            this.cam = {
                mode: "observer",
                zoom: 1,
                pan: [ 0, 0 ],
                oy: 0,
                op: 0
            }, this.cur = null, this.fx = [], this.particles = [], this.ghost = null, this.hover = null, 
            this.bgCache = {}, this.thumbs = {}, this.portraits = {}, this.fps = 60, this.softS = 1, 
            this._sMiss = 0, this._sGood = 0, this._sHold = 0, this._sUpWait = 30, this._sUpT = -1e9, 
            this._sDownT = -1e9, this._autoLow = !1, this._autoLvl = 0, this.targetFps = 60, 
            this.time = 0;
            {
                const t = JT.Device.tier;
                // Auto starts light; promote only after sustained measured headroom.
                this._thermalLevel = t === "low" ? 4 : t === "high" ? 2 : 3;
                "low" === t ? (this._autoLvl = 1, this._closeK = 1.4, this.softS = 1) : "mid" === t && (this._autoLvl = 0, 
                this._closeK = 1.6, this.softS = 1);
            }
            this.V = new JT.View(.5, .6, 1, 0, 0, [ 0, 0, 0 ]), this.glc = root.document && root.document.getElementById("glview"), 
            this.gp = null, this.initGL(), this.resize();
        }
        get qualityScale() {
            const q = this.set.quality || "auto";
            // CSS-pixel multipliers, independent of device DPR and screen area.
            // Explicit presets never degrade under load; Auto has the same floor as Low.
            return q === "high" ? 2 : q === "medium" ? 1.5 : q === "low" ? 1 :
                [2, 1.75, 1.5, 1.25, 1][Math.min(4, this._thermalLevel || 0)];
        }
        get quality() {
            return this.set.quality === "auto" ? this.qualityScale >= 1.75 ? "high" : this.qualityScale >= 1.25 ? "medium" : "low" : this.set.quality;
        }
        resize() {
            const r = this.cv.getBoundingClientRect();
            this.cssW = Math.max(50, r.width || root.innerWidth || 800), this.cssH = Math.max(50, r.height || root.innerHeight || 600);
            const k = this.qualityScale, w = Math.round(this.cssW * k), h = Math.round(this.cssH * k);
            this.cv.width === w && this.cv.height === h || (this.cv.width = w, this.cv.height = h, 
            this.bgCache = {}, this._skPrev = null), !this.gp || this.glc.width === w && this.glc.height === h || (this.glc.width = w, 
            this.glc.height = h), this.k = k, this._cw = this.cv.clientWidth, this._ch = this.cv.clientHeight;
            const dock = root.document && root.document.getElementById("dock"), side = root.matchMedia && root.matchMedia("(max-height:500px) and (orientation:landscape)").matches;
            this.insetL = false && side && dock && !this.attract ? Math.max(0, Math.min(.4 * this.cssW, dock.getBoundingClientRect().right)) : 0;
        }
        resetCaches() {
            this._baseL = null, this._st = null, this._skPrev = null, this.bgCache = {}, this.motes = null, 
            this._speck = null, this.cur = null, this.fcam && (this.fcam.st = null);
        }
        initGL() {
            if (!this.gp && !this._glFail && this.glc && JT.GLPaint) try {
                this.gp = new JT.GLPaint(this.glc, this);
            } catch (e) {
                console.warn("WebGL unavailable:", e && e.message), this._glFail = !0, this.gp = null;
            }
            this.glc && (this.glc.style.display = this.gp ? "block" : "none");
            const doc = root.document;
            if (doc && doc.body && (doc.body.classList.add("story"), this._glFail && !doc.getElementById("noGL"))) {
                const d = doc.createElement("div");
                d.id = "noGL", d.textContent = "Jumper Terrarium needs WebGL to draw the terrarium. Try another browser, or turn on hardware acceleration.", 
                doc.body.appendChild(d);
            }
        }
        get storybook() {
            return !!this.gp;
        }
        setMode(m) {
            "follow" !== m && (m = "observer"), this.cam.mode = m, this.cam.zoom = 1, this.cam.pan = [ 0, 0 ];
        }
        zoomBy(f, sx, sy) {
            if ("follow" === this.cam.mode && this.fcam && this.fcam.st) return void this.fcam.zoom(f);
            const z0 = this.cam.zoom, z = M.clamp(z0 * f, .6, 5);
            if (z !== z0) {
                if (null != sx) {
                    const cx = (this.insetL || 0) + (this.cssW - (this.insetL || 0)) / 2 + this.cam.pan[0], cy = this.cssH / 2 + this.cam.pan[1], k = z / z0;
                    this.cam.pan[0] += (sx - cx) * (1 - k), this.cam.pan[1] += (sy - cy) * (1 - k);
                }
                this.cam.zoom = z, this.clampPan();
            }
        }
        panBy(dx, dy) {
            "follow" === this.cam.mode && this.fcam && this.fcam.st ? this.fcam.orbit(.0065 * dx, .004 * dy) : (this.cam.pan[0] += dx, 
            this.cam.pan[1] += dy, this.clampPan());
        }
        clampPan() {
            const lim = .35 + .45 * this.cam.zoom;
            this.cam.pan[0] = M.clamp(this.cam.pan[0], -this.cssW * lim, this.cssW * lim), this.cam.pan[1] = M.clamp(this.cam.pan[1], -this.cssH * lim, this.cssH * lim);
        }
        resetView() {
            this.cam.zoom = 1, this.cam.pan = [ 0, 0 ], this.cam.oy = 0, this.cam.op = 0;
        }
        orbitBy(dx, dy) {
            if ("follow" === this.cam.mode) return void this.panBy(dx, dy);
            const c = this.cam;
            c.oy = M.wrapAngle((c.oy || 0) + .0065 * dx), c.op = (c.op || 0) + .004 * dy, this.clampOrbit(this.game && this.game.hab);
        }
        clampOrbit(hab) {
            const c = this.cam, P0 = CAMS.observer.pitch;
            c.op = M.clamp(c.op || 0, .06 - P0, 1.4 - P0), hab && hab.decor && hab.decor.some(d => "backwall" === (JT.DECOR_BY_ID[d.type] || {}).arche) && (c.oy = M.clamp(c.oy || 0, -1.3, 1.3));
        }
        get straightFront() {
            const c = this.cam;
            return "observer" === c.mode && Math.abs(c.oy || 0) < .01 && Math.abs(c.op || 0) < .01;
        }
        targetView(hab) {
            const dm = hab.dims, C = CAMS[this.cam.mode] || CAMS.observer, ob = "follow" !== this.cam.mode;
            ob && this.clampOrbit(hab);
            let top = .55 * dm.h;
            for (const id in hab.geoms) top = Math.max(top, hab.geoms[id].height + hab.geoms[id].baseY);
            top = Math.min(top, 1.1 * dm.h);
            const pts = [];
            for (const x of [ 0, dm.w ]) for (const z of [ 0, dm.d ]) for (const y of [ -12, top ]) pts.push([ x, y, z ]);
            const c = [ dm.w / 2, .38 * top, dm.d / 2 ], W = this.cssW, H = this.cssH, portrait = H > 1.1 * W, yaw = C.yaw + (ob && this.cam.oy || 0), pitch = C.pitch + (ob && this.cam.op || 0), tmp = new JT.View(yaw, pitch, 1, 0, 0, c);
            let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
            for (const p of pts) {
                const q = tmp.P(p);
                x0 = Math.min(x0, q[0]), x1 = Math.max(x1, q[0]), y0 = Math.min(y0, q[1]), y1 = Math.max(y1, q[1]);
            }
            const availH = H * (portrait ? .62 : .78), availW = (W - (this.insetL || 0)) * (portrait ? .94 : .88);
            let s = Math.min(availW / (x1 - x0), availH / (y1 - y0)), center = c, offY = -(y0 + y1) / 2 * s;
            if ("follow" === this.cam.mode) {
                const sp = hab.spider(this.game.selectedId) || hab.spiders[0];
                if (sp) {
                    let f = sp.pos.slice();
                    const t = sp.target && JT.SpiderAI.targetEnt(hab, sp);
                    t && t.pos && M.finite3(t.pos) && (f = M.lerp3(f, t.pos, .3)), center = f, s = Math.min(W, H) / 70, 
                    offY = 0;
                }
            }
            return {
                yaw: yaw,
                pitch: pitch,
                s: s * this.cam.zoom,
                c: center,
                offY: offY * this.cam.zoom
            };
        }
        updateView(hab, dt) {
            const T = this.targetView(hab);
            this.cur && this.cur.hab === hab.id || (this.cur = Object.assign({
                hab: hab.id
            }, T, {
                c: T.c.slice()
            }));
            const k = Math.min(1, 5 * dt), kr = "follow" === this.cam.mode ? k : Math.min(1, 14 * dt), kc = Math.min(1, dt * ("follow" === this.cam.mode ? 3 : 6)), cu = this.cur;
            let dy = M.wrapAngle(T.yaw - cu.yaw);
            if (cu.yaw += dy * kr, cu.pitch += (T.pitch - cu.pitch) * kr, cu.s += (T.s - cu.s) * k, 
            cu.offY += (T.offY - cu.offY) * k, cu.c = M.lerp3(cu.c, T.c, kc), "follow" === this.cam.mode) {
                const sp = hab.spider(this.game.selectedId) || hab.spiders[0], fc = this.fcam || (this.fcam = new JT.FollowCam);
                if (sp) {
                    fc.st && fc.id === sp.id && fc.hab === hab.id || (fc.reset(cu, sp.id), fc.hab = hab.id);
                    const st = fc.step(hab, sp, dt, Math.min(this.cssW, this.cssH) / (this.cssH > 1.1 * this.cssW ? 54 : 70));
                    cu.yaw = st.yaw, cu.pitch = st.pitch, cu.s = st.s, cu.c = st.c.slice(), cu.offY += (0 - cu.offY) * k, 
                    this.cam.pan[0] *= 1 - k, this.cam.pan[1] *= 1 - k;
                }
            } else {
                this.fcam && (this.fcam.st = null);
                // End asymptotic sub-pixel drift. Exact view keys can then reuse the
                // static colour/depth cache instead of redrawing an idle diorama.
                // Thresholds are far below one physical pixel, even at max zoom.
                if(Math.abs(M.wrapAngle(T.yaw-cu.yaw))<1e-7)cu.yaw=T.yaw;
                if(Math.abs(T.pitch-cu.pitch)<1e-7)cu.pitch=T.pitch;
                if(Math.abs(T.s-cu.s)<1e-7)cu.s=T.s;
                if(Math.abs(T.offY-cu.offY)<1e-5)cu.offY=T.offY;
                for(let i=0;i<3;i++)if(Math.abs(T.c[i]-cu.c[i])<1e-6)cu.c[i]=T.c[i];
            }
            const kk = this.k, il = this.insetL || 0;
            return this.V.set(cu.yaw, cu.pitch, cu.s * kk, (il + (this.cssW - il) / 2 + this.cam.pan[0]) * kk, (this.cssH / 2 + this.cam.pan[1] + cu.offY + (this.attract ? -this.cssH * (this.cssH > 1.1 * this.cssW ? .12 : this.cssH < 520 ? .24 : .1) : this.cssH > 1.1 * this.cssW ? .045 * this.cssH : .02 * this.cssH)) * kk, cu.c), 
            this.V;
        }
        unproject(sx, sy, y) {
            return this.V.unproject(sx * this.k, sy * this.k, y);
        }
        project(p) {
            const q = this.V.P(p);
            return [ q[0] / this.k, q[1] / this.k ];
        }
        floorPoly(hab) {
            const dm = hab.dims;
            return "circle" === dm.shape ? G.circlePoly(dm.w / 2, dm.d / 2, dm.w / 2, dm.d / 2, 44) : [ [ 0, 0 ], [ dm.w, 0 ], [ dm.w, dm.d ], [ 0, dm.d ] ];
        }
        // A second hidden resolution controller would undermine the quality floor.
        softOK() { return false; }
        softAtFloor() { return true; }
        softMin() { return 1; }
        softCtl(dt) { this.softS = 1; }
        render(dt) {
            {
                const c = this.cv, cw = c.clientWidth, ch = c.clientHeight;
                (cw !== this._cw || ch !== this._ch || cw > 0 && (Math.abs(c.width - cw * this.k) > 2 || Math.abs(c.height - ch * this.k) > 2)) && this.resize();
            }
            this.time = this.game.hab ? this.game.hab.time : this.time + dt;
            const hab = this.game.hab;
            if (!hab) return;
            if (dt > 0) {
                this.fps = .95 * this.fps + 1 / Math.max(.001, dt) * .05, this.softCtl(dt), this.softAtFloor();
                const close = "follow" === this.cam.mode;
                close !== !!this.closeCam && (this.closeCam = close, this.resize());
            }
            this._dt = dt;
            const V = this.updateView(hab, dt);
            {
                const vk = V.yaw.toFixed(4) + "," + V.pitch.toFixed(4) + "," + V.s.toFixed(3) + "," + V.c.map(v => v.toFixed(2)).join(",");
                this._moving = vk !== this._vk, this._vk = vk;
            }
            if (this.gp && !this.gp.lost && this.renderStory(V, hab, dt), this._cap) {
                const f = this._cap;
                this._cap = null;
                try {
                    f(this.glc && this.gp && !this.gp.lost ? this.glc : null, this.cv);
                } catch (e) {
                    console.error("photo", e);
                }
            }
        }
        renderStory(V, hab, dt) {
            JT.SKY.update(this.game);
            const night = Math.max(1 - this.game.daylight(), JT.Biome ? .9 * (JT.Biome.of(hab).dusk || 0) : 0), lamps = hab.lampsOn ? hab.lampsOn() : [], pt = this.pt || (this.pt = {
                col: 0,
                spr: 0,
                up: 0,
                gl: 0,
                ov: 0
            }), em = (k, v) => {
                pt[k] = .9 * pt[k] + .1 * v;
            };
            let t0 = performance.now();
            const scene = this.collectScene(V, hab, night);
            em("col", performance.now() - t0), t0 = performance.now(), this._sprT = 0, this._upT = 0;
            try {
                this.gp.frame(V, hab, night, lamps, scene);
            } catch (e) {
                (this._glErr = (this._glErr || 0) + 1) < 5 && console.error("storybook frame", e);
            }
            em("spr", this._sprT), em("up", this._upT), em("gl", performance.now() - t0 - this._sprT - this._upT), 
            t0 = performance.now();
            const ctx = this.ctx;
            if (ctx.setTransform(1, 0, 0, 1, 0, 0), ctx.globalAlpha = 1, ctx.globalCompositeOperation = "source-over", 
            (!1 !== this._ovDirty || this._ovInk || this.set.perf && this.set.ptOvClear) && ctx.clearRect(0, 0, this.cv.width, this.cv.height), 
            this._ovInk = !1, this._ovDirty = !0, this.ghost && this.ghost.geom && this.drawGhostFoot(ctx, V, this.ghost), 
            this.hover && "decor" === this.hover.kind) {
                const g = hab.geoms[this.hover.ent.id];
                g && this.outlineDecor(ctx, V, g, "rgba(200,70,50,0.9)");
            }
            if (!this.set.perf || !this.set.ptNoFx) {
                this.drawEffects(ctx, V, hab, dt);
                try {
                    this.drawBiome && JT.Biome && this.drawBiome(ctx, V, hab, dt, night, JT.Biome.of(hab));
                } catch (e) {
                    this._biomeError || (this._biomeError = !0, console.error("biome effects", e));
                }
                if (lamps.length && this.drawLampGlow(ctx, V, hab, lamps, night), night > .3) for (const sp of hab.spiders) {
                    const S = JT.SPECIES_BY_ID[sp.species];
                    if (!S || !S.glow) continue;
                    const L = JT.SpiderAI.len(sp), P = V.P([ sp.pos[0], sp.pos[1] + .25 * L, sp.pos[2] ]), r = Math.max(5 * this.k, L * V.s * .75);
                    if (!isFinite(P[0]) || r > 900) continue;
                    const a = .5 * (night - .3) * (.85 + .15 * Math.sin(2.3 * this.time + (sp.seed || 0))), gr = ctx.createRadialGradient(P[0], P[1], 0, P[0], P[1], r);
                    gr.addColorStop(0, "rgba(255,150,60," + a.toFixed(3) + ")"), gr.addColorStop(1, "rgba(255,90,20,0)"), 
                    ctx.save(), ctx.globalCompositeOperation = "lighter", ctx.fillStyle = gr, ctx.fillRect(P[0] - r, P[1] - r, 2 * r, 2 * r), 
                    ctx.restore();
                }
                this.set.debug && this.drawDebug(ctx, V, hab), this._ovDirty = !!this._ovInk, em("ov", performance.now() - t0);
            }
        }
        drawGhostFoot(ctx, V, gh) {
            const g = gh.geom;
            if (!g.foot) return;
            const col = gh.ok ? "rgba(70,150,80," : "rgba(200,60,50,";
            ctx.save(), ctx.beginPath(), g.foot.forEach((q, i) => {
                const s = V.P([ q[0], g.baseY + .2, q[1] ]);
                i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
            }), ctx.closePath(), ctx.fillStyle = col + "0.18)", ctx.fill(), ctx.strokeStyle = col + "0.9)", 
            ctx.lineWidth = 2 * this.k, ctx.setLineDash([ 6 * this.k, 4 * this.k ]), ctx.stroke(), 
            ctx.restore();
        }
        collectScene(V, hab, night) {
            let ctx = null;
            const items = [], dropItem = (e, fr, L, kind, alpha, held, airE) => {
                const c = fr.p;
                if (!M.finite3(c)) return;
                const now = hab.time || 0;
                let b = e._shB;
                if (!b || Math.abs(now - b.t) > .25 || Math.abs(b.x - c[0]) + Math.abs(b.z - c[2]) > 1.5 || Math.abs(b.y - c[1]) > 2) {
                    const sb = JT.Nav.supportBelow(hab, [ c[0], c[1] - .5, c[2] ]);
                    b = e._shB = {
                        t: now,
                        x: c[0],
                        y: c[1],
                        z: c[2],
                        gy: sb.pos[1]
                    };
                }
                const gy = b.gy;
                if (c[1] - gy < (airE ? 0 : .3 * L)) return;
                const q = D.critter.dropAt(hab, c, gy), fr2 = {
                    f: fr.f,
                    s: fr.s
                };
                items.push({
                    d: V.depth(q) + .03,
                    f: () => D.critter.dropShadow(ctx, V, hab, c, gy, fr2.f, fr2.s, L, kind, alpha, held),
                    p: q,
                    r: 1.7 * L + 2 + (held || 0),
                    ground: !0
                });
            }, follow = "follow" === this.cam.mode, fsp = follow ? hab.spider(this.game.selectedId) || hab.spiders[0] : null, tgtId = fsp && fsp.target && "prey" === fsp.target.kind ? fsp.target.id : null, t = this.time, geoms = hab.geoms, sel = this.game.selectedId, decDepth = {}, W = this.cv.width, H = this.cv.height, mg = 90 * this.k, vis = pos => {
                const q = V.P(pos);
                return q[0] > -mg && q[0] < W + mg && q[1] > -mg && q[1] < H + mg;
            }, onScreen = pos => {
                const q = V.P(pos);
                return q[0] > -mg && q[0] < W + mg && q[1] > -mg && q[1] < H + mg;
            };
            for (const inst of hab.decor) {
                const g = geoms[inst.id];
                if (!g) continue;
                if (inst._sw && (inst._sw.x, inst._sw.z), "ground" === g.def.cat && !inst.parent) {
                    decDepth[inst.id] = 1e9;
                    continue;
                }
                const c = g.foot ? G.centroid(g.foot) : [ inst.x, inst.z ], dep = V.depth([ c[0], g.baseY + Math.min(10, .25 * g.height), c[1] ]);
                decDepth[inst.id] = dep;
            }
            const animalDepth = e => {
                let d = V.depth(e.pos);
                return e.sup && e.sup.d && null != decDepth[e.sup.d] && decDepth[e.sup.d] < 1e8 && (d = Math.min(d, decDepth[e.sup.d] - .05)), 
                d;
            };
            for (const r of hab.data.remains) {
                if (!M.finite3(r.pos)) continue;
                let fr = D.frame(hab, r, .1);
                if (r._fall && M.finite3(r._fall.from)) {
                    const u = M.clamp(r._fall.t / r._fall.dur, 0, 1), e2 = u * u, a = r.ang || 0;
                    fr = {
                        p: M.lerp3(M.add(r._fall.from, [ 0, .1, 0 ]), fr.p, e2),
                        f: M.norm([ Math.cos(a), .4 * Math.sin(9 * u), Math.sin(a) ]),
                        s: M.norm([ -Math.sin(a), 0, Math.cos(a) ]),
                        n: [ 0, 1, 0 ]
                    }, fr.n = M.norm(M.cross(fr.f, fr.s)), fr.n[1] < 0 && (fr.n = M.mul(fr.n, -1));
                }
                items.push({
                    key: null != r.id ? "r" + r.id : null,
                    d: animalDepth(r) + .02,
                    f: () => D.remains(ctx, V, r, fr, {}),
                    p: r.pos,
                    r: 1.3 * ((JT.PREY_BY_ID[r.type] || {
                        len: 3
                    }).len || 3) + 2
                });
            }
            for (const w of hab.data.drops) {
                if (!M.finite3(w.pos)) continue;
                const fr = JT.Nav.supFrame(hab, w.sup), pos = M.add(w.pos, M.mul(fr.n, (fr.r || 0) + .3));
                items.push({
                    key: w.id ? "d" + w.id : void 0,
                    still: !0,
                    d: animalDepth(w) + .01,
                    f: () => D.drop(ctx, V, w, pos),
                    p: pos,
                    r: 2 * (w.r || .6) + 1,
                    noGL: !!w.pool
                });
            }
            for (const p of hab.prey) {
                if (p.owner || p.buried || !M.finite3(p.pos) || !onScreen(p.pos)) continue;
                const def = JT.PREY_BY_ID[p.type];
                if (!def) continue;
                const pd = animalDepth(p), drawP = () => {
                    let fr = D.frame(hab, p, .05);
                    const wk = JT.PreyAI.weakK ? JT.PreyAI.weakK(p) : 0, L0 = def.len || 3;
                    if (p._flip && "twitch" === p.state) {
                        const w = .25 * Math.sin(9 * t + (p.seed || 0)), c = Math.cos(Math.PI + w), si = Math.sin(Math.PI + w), s2 = M.add(M.mul(fr.s, c), M.mul(fr.n, si)), n2 = M.sub(M.mul(fr.n, c), M.mul(fr.s, si));
                        return fr = {
                            p: M.add(fr.p, M.mul(fr.n, .3 * L0)),
                            f: fr.f,
                            s: s2,
                            n: n2
                        }, void D.prey(ctx, V, p, fr, {
                            time: t,
                            held: !0,
                            flail: .45 + .35 * Math.abs(Math.sin(5 * t + (p.seed || 0))),
                            noShadow: !1
                        });
                    }
                    if (wk > .04 && p.sup && "air" !== p.sup.k) {
                        const w = .22 * Math.sin(3.1 * t + (p.seed || 0)) * wk, c = Math.cos(w), si = Math.sin(w);
                        fr = {
                            p: fr.p,
                            f: fr.f,
                            s: M.add(M.mul(fr.s, c), M.mul(fr.n, si)),
                            n: M.sub(M.mul(fr.n, c), M.mul(fr.s, si))
                        };
                    }
                    D.prey(ctx, V, p, fr, {
                        time: t,
                        perch: !!(p.sup && "path" === p.sup.k && (JT.Nav.supFrame(hab, p.sup).r || 0) < .7 * L0)
                    });
                };
                items.push({
                    key: "p" + p.id,
                    d: pd,
                    f: drawP,
                    p: p.pos,
                    r: 1.5 * (def.len || 3) + 1.5,
                    xr: !(!tgtId || p.id !== tgtId),
                    bias: p.sup && "floor" !== p.sup.k && "air" !== p.sup.k ? .85 * (def.len || 3) : .3 * (def.len || 3)
                }), !p.sup || "air" !== p.sup.k && "path" !== p.sup.k || dropItem(p, D.frame(hab, p, .05), def.len || 3, "prey", "air" === p.sup.k ? .75 : 1, 0);
            }
            for (const sp of hab.spiders) {
                if (!M.finite3(sp.pos) || !onScreen(sp.pos)) continue;
                const lcT = sp.id === sel && [ "idle", "lookout", "rest", "watch", "groom", "postFeed" ].includes(sp.state) && Math.sin(.33 * this.time + sp.seed % 7) > .55 ? 1 : 0;
                sp._lc = M.lerp(sp._lc || 0, lcT, Math.min(1, 2.5 * (this._dt || .016)));
                const L = JT.SpiderAI.len(sp);
                let fr = D.frame(hab, sp, .05);
                const still = !sp._moving && !sp._air && [ "idle", "lookout", "rest", "watch", "look", "groom" ].includes(sp.state);
                sp._tilt = M.lerp(sp._tilt || 0, still && L * V.s > 46 * this.k && sp._lc > .3 ? 1 : 0, Math.min(1, 2 * (this._dt || .016)));
                let hang = 0, hangA = null;
                if (sp._dangleOff && sp._dangleVis > .01) {
                    const dOff = sp._dangleOff, kv = sp._dangleVis, edge = M.clamp(3 * kv, 0, 1), down = M.smooth(M.clamp((kv - .3) / .7, 0, 1));
                    hangA = [ sp.pos[0] + dOff.dx, sp.pos[1] + .2, sp.pos[2] + dOff.dz ];
                    const pos = [ M.lerp(fr.p[0], hangA[0], edge), M.lerp(fr.p[1], hangA[1], edge) - dOff.depth * down + .15 * Math.sin(1.7 * this.time) * down, M.lerp(fr.p[2], hangA[2], edge) ], out = M.norm([ dOff.dx || .01, 0, dOff.dz || 0 ]), fD = M.norm(M.lerp3(fr.f, [ 0, -1, 0 ], .85 * down)), nD = M.norm(M.lerp3(fr.n, out, down));
                    let sD = M.norm(M.cross(nD, fD));
                    if (dOff.slip) {
                        const sw = .1 * dOff.depth * down * (.5 + (sp._strug || 0));
                        pos[0] += Math.sin(2.3 * this.time) * sw, pos[2] += Math.cos(1.7 * this.time) * sw * .7;
                        const a = 1.4 * this.time + 1.5 * Math.sin(.8 * this.time), ca = Math.cos(a), sa = Math.sin(a), rot = v => [ v[0] * ca - v[2] * sa, v[1], v[0] * sa + v[2] * ca ], nR = M.norm(rot(nD));
                        sD = M.norm(M.cross(nR, fD));
                    }
                    fr = {
                        p: pos,
                        f: fD,
                        s: sD,
                        n: M.norm(M.cross(fD, sD))
                    }, hang = down;
                }
                if ((sp._strug || 0) > .02 && "subdue" === sp.state) {
                    const k = sp._strug, T = this.time, j = .035 * L * k, yaw = .22 * (.6 * Math.sin(17 * T) + .4 * Math.sin(31 * T + 2)) * k, c = Math.cos(yaw), si = Math.sin(yaw), f2 = M.norm(M.add(M.mul(fr.f, c), M.mul(fr.s, si))), s2 = M.norm(M.cross(fr.n, f2));
                    fr = {
                        p: M.add(fr.p, M.add(M.mul(fr.s, Math.sin(37 * T) * j), M.mul(fr.f, Math.sin(23 * T + 1) * j * .7))),
                        f: f2,
                        s: s2,
                        n: fr.n
                    };
                }
                if (sp._pz && !sp._air && ("subdue" === sp.state || "secure" === sp.state || "shaken" === sp.state || Math.abs(sp._pz.r) + Math.abs(sp._pz.p) + sp._pz.l > .02)) {
                    const P = sp._pz, up = fr.n, cr = Math.cos(P.r), sr = Math.sin(P.r), cp = Math.cos(P.p), spp = Math.sin(P.p), s1 = M.add(M.mul(fr.s, cr), M.mul(fr.n, sr)), n1 = M.sub(M.mul(fr.n, cr), M.mul(fr.s, sr)), f2 = M.add(M.mul(fr.f, cp), M.mul(n1, spp)), n2 = M.sub(M.mul(n1, cp), M.mul(fr.f, spp)), lift = P.l * L * .35 + .5 * (1 - cr) * L * .45 + Math.max(0, spp) * L * .12;
                    fr = {
                        p: M.add(fr.p, M.mul(up, lift)),
                        f: M.norm(f2),
                        s: M.norm(s1),
                        n: M.norm(n2)
                    };
                }
                if (sp.hold && ("subdue" === sp.state || "secure" === sp.state) && (sp._catchRatio || 0) > 1.1) {
                    const hp0 = hab.preyById(sp.hold), fam = hp0 ? JT.preyFamily(JT.PREY_BY_ID[hp0.type] || {}) : "";
                    hp0 && "beetle" !== fam && "jumper" !== fam && (fr = {
                        p: M.add(fr.p, M.mul(fr.n, .16 * L * Math.min(1.6, sp._catchRatio))),
                        f: fr.f,
                        s: fr.s,
                        n: fr.n
                    });
                }
                if ("pounce" === sp.state && sp._air && sp._air.straight) {
                    const A = sp._air, dir = M.sub(A.to, A.from), dl = M.len(dir);
                    if (dl > .001) {
                        const u = M.mul(dir, 1 / dl), hz = Math.hypot(u[0], u[2]), pitch = M.clamp(Math.atan2(u[1], hz), -1, 1), fh = M.norm([ fr.f[0], 0, fr.f[2] ]), f2 = M.norm([ fh[0] * Math.cos(pitch), Math.sin(pitch), fh[2] * Math.cos(pitch) ]), s2 = M.norm(M.cross([ 0, 1, 0 ], f2));
                        fr = {
                            p: fr.p,
                            f: f2,
                            s: s2,
                            n: M.norm(M.cross(f2, s2))
                        };
                    }
                }
                const ventral = M.dot(fr.n, V.toCam) < -.08;
                let d = animalDepth(sp);
                ventral && sp.sup && sp.sup.d && null != decDepth[sp.sup.d] && (d = decDepth[sp.sup.d] + .05);
                const air = !!sp._air || sp.sup && "air" === sp.sup.k, sfP = !air && sp.sup && "path" === sp.sup.k ? JT.Nav.supFrame(hab, sp.sup) : null, perch = !!sfP && (sfP.r || 0) < .7 * L, hpS = sp.hold ? hab.preyById(sp.hold) : null, heldLen = hpS ? Math.min(hpS.len || (JT.PREY_BY_ID[hpS.type] || {}).len || 3, 1.6 * L) : 0, draw = (alpha, xr) => {
                    const hp = sp.hold ? hab.preyById(sp.hold) : null;
                    let hug = null;
                    if (hp && (sp._hug || 0) > .01) {
                        const hd = JT.PREY_BY_ID[hp.type] || {
                            len: 3
                        }, base = Math.min(hp.len || hd.len, 1.1 * L), full = null != hp.full ? hp.full : 1;
                        hug = {
                            k: sp._hug,
                            pl: base * (.6 + .4 * full),
                            big: base >= .6 * L ? 1 : 0
                        };
                    }
                    D.spider(ctx, V, sp, fr, {
                        len: L,
                        airborne: air,
                        time: t,
                        alpha: alpha,
                        tucked: !!sp.nest && JT.SpiderAI.NEST_STATES.has(sp.state) && !(hab.data.nests || []).some(n => n.id === sp.nest && (n.build || n.hole && n.hole.exit > .05)),
                        spin: (hab.data.nests || []).some(n => n.id === sp.nest && n.build && n.owner === sp.id && JT.SpiderAI.NEST_STATES.has(sp.state)),
                        lookCam: sp._lc > .02 ? sp._lc : 0,
                        tilt: sp._tilt,
                        hang: hang,
                        hug: hug,
                        grip: air ? null : D.gripFor(hab, sp, L),
                        noShadow: xr || hang > .2,
                        perch: perch,
                        heldLen: heldLen,
                        heldCross: !1,
                        meal: hp ? (mp, fg, sg, n) => this.drawHeld(ctx, V, sp, hp, mp, fg, sg, n, L) : null
                    });
                };
                if (hangA) {
                    const fp = fr.p, fff = fr.f;
                    items.push({
                        ln: {
                            a: hangA,
                            b: M.sub(fp, M.mul(fff, .32 * L)),
                            w: .08,
                            al: .45 - .15 * night
                        },
                        d: d + .01,
                        f: () => {
                            const a = V.P(hangA), b = V.P(M.sub(fp, M.mul(fff, .32 * L)));
                            ctx.strokeStyle = "rgba(240,240,250," + (.45 - .15 * night).toFixed(2) + ")", ctx.lineWidth = Math.max(.5, .08 * V.s), 
                            ctx.beginPath(), ctx.moveTo(a[0], a[1]), ctx.lineTo(b[0], b[1]), ctx.stroke();
                        }
                    }), d = V.depth(fr.p);
                }
                if (air && sp._anchor && M.finite3(sp._anchor) && !JT.SpiderAI.NO_SILK) {
                    const an = sp._anchor, sp2 = fr.p, pz = "pounce" === sp.state && sp._air ? 1 - M.clamp(sp._air.t, 0, 1) : 0, al = .32 - .1 * night + .15 * pz, segs = [];
                    if (pz > .02) {
                        const dv = M.sub(sp2, an), dl = M.len(dv) || 1;
                        let side = M.cross(dv, [ 0, 1, 0 ]);
                        M.len(side) < .001 && (side = [ 1, 0, 0 ]), side = M.norm(side);
                        const w = Math.sin(55 * this.time) * dl * .09 * pz, mid = M.add(M.lerp3(an, sp2, .5), M.add(M.mul(side, w), [ 0, .04 * -dl * pz, 0 ]));
                        segs.push([ an, mid ], [ mid, sp2 ]);
                    } else segs.push([ an, sp2 ]);
                    for (const [a0, b0] of segs) items.push({
                        ln: {
                            a: a0,
                            b: b0,
                            w: .07,
                            al: al
                        },
                        d: V.depth(M.lerp3(a0, b0, .5)) - .05,
                        f: () => {
                            const a = V.P(a0), b = V.P(b0);
                            ctx.strokeStyle = "rgba(240,240,250," + al.toFixed(2) + ")", ctx.lineWidth = Math.max(.5, .07 * V.s), 
                            ctx.beginPath(), ctx.moveTo(a[0], a[1]), ctx.lineTo(b[0], b[1]), ctx.stroke();
                        }
                    });
                }
                if ("pounce" === sp.state && sp._air && sp._air.straight && M.finite3(sp._air.from)) {
                    const A = sp._air, back = M.sub(A.from, fr.p), bl = M.len(back);
                    if (bl > .6 * L) {
                        for (const [k, al] of [ [ .35, .28 ], [ .7, .14 ] ]) {
                            const g0 = M.add(fr.p, M.mul(back, Math.min(k, 2.2 * L * k / bl))), gf = {
                                p: g0,
                                f: fr.f,
                                s: fr.s,
                                n: fr.n
                            };
                            items.push({
                                d: V.depth(g0) + .02,
                                f: () => D.spider(ctx, V, sp, gf, {
                                    len: L,
                                    airborne: !0,
                                    time: t,
                                    alpha: al,
                                    noShadow: !0
                                }),
                                p: g0,
                                r: 1.5 * L
                            });
                        }
                        const fp0 = fr.p, smP = M.add(fp0, M.mul(back, Math.min(.5, 1.5 * L / bl)));
                        items.push({
                            d: V.depth(fp0) + .03,
                            f: () => {
                                const a = V.P(fp0), b = V.P(M.add(fp0, M.mul(back, Math.min(1, 3 * L / bl)))), gr = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
                                gr.addColorStop(0, "rgba(255,255,255,0.22)"), gr.addColorStop(1, "rgba(255,255,255,0)"), 
                                ctx.strokeStyle = gr, ctx.lineCap = "round", ctx.lineWidth = Math.max(1, L * V.s * .5), 
                                ctx.beginPath(), ctx.moveTo(a[0], a[1]), ctx.lineTo(b[0], b[1]), ctx.stroke();
                            },
                            p: smP,
                            r: 2.2 * L
                        });
                    }
                }
                const nst = sp.nest && JT.SpiderAI.NEST_STATES.has(sp.state) ? (hab.data.nests || []).find(n => n.id === sp.nest) : null;
                let hideK = 0;
                nst && (hideK = M.smooth(M.clamp((nst.prog - .3) / .6, 0, 1)), "emerge" === sp.state && nst.hole && (hideK *= 1 - M.smooth(M.clamp(1.4 * (nst.hole.exit || 0), 0, 1))));
                const bodyA = 1 - hideK;
                bodyA > .01 && items.push({
                    key: "s" + sp.id,
                    hot: sp.id === sel,
                    d: d,
                    f: () => draw(bodyA),
                    p: fr.p,
                    r: 1.7 * L + 1,
                    xr: follow && sp === fsp,
                    bias: !air && sp.sup && "floor" !== sp.sup.k && "air" !== sp.sup.k ? .85 * L : .25 * L
                }), (air || perch || hang > .2) && bodyA > .3 && dropItem(sp, fr, L, "spider", bodyA, heldLen, air);
            }
            for (const lf of hab._leaves || []) M.finite3(lf.pos) && onScreen(lf.pos) && items.push({
                d: V.depth(lf.pos) - .02,
                f: () => D.leafBit(ctx, V, lf),
                p: lf.pos,
                r: 3
            });
            for (const n of hab.data.nests || []) {
                if (!M.finite3(n.pos) || !vis(n.pos)) continue;
                const up = (JT.Nav.validSup(hab, n.sup) ? JT.Nav.supFrame(hab, n.sup).n : [ 0, 1, 0 ]) || [ 0, 1, 0 ], L = n.len || 6, own = n.owner && hab.spider(n.owner), inside = own && own.nest === n.id && JT.SpiderAI.NEST_STATES.has(own.state), SP = own && (JT.SPECIES_BY_ID[own.species] || {}), info = {
                    time: t,
                    glint: inside ? 1 - M.clamp(3 * (n.hole && n.hole.exit || 0), 0, 1) : 0,
                    ceph: SP && SP.pal ? SP.pal.ceph : null,
                    eye: SP && SP.look && SP.look.eyeCol ? SP.look.eyeCol : null
                }, back = M.sub(n.pos, M.mul(V.toCam, .9 * L)), front = M.add(n.pos, M.mul(V.toCam, .9 * L));
                items.push({
                    d: V.depth(n.pos) + .7 * L,
                    f: () => D.nest(ctx, V, n, up, night, "back", info),
                    p: back,
                    r: 1.3 * L + 3,
                    bias: 0
                }), items.push({
                    d: V.depth(n.pos) - .7 * L,
                    f: () => D.nest(ctx, V, n, up, night, "front", info),
                    p: front,
                    r: 1.3 * L + 3,
                    bias: 0
                });
            }
            for (const k of hab.data.silk) items.push({
                silk: k,
                d: V.depth(M.lerp3(k.a, k.b, .5)) - .1,
                f: () => D.silk(ctx, V, k, night)
            });
            return {
                items: items,
                run: (it, c2, v2) => {
                    const k0 = ctx, v0 = V;
                    ctx = c2, V = v2;
                    try {
                        it.f();
                    } finally {
                        ctx = k0, V = v0;
                    }
                }
            };
        }
        pin(ctx, V, sp, L) {
            const q = V.P([ sp.pos[0], sp.pos[1] + .6 * L, sp.pos[2] ]), k = this.k, y = q[1] - 14 * k + 2 * Math.sin(3 * this.time) * k;
            ctx.save(), ctx.fillStyle = "rgba(232,196,110,0.95)", ctx.strokeStyle = "rgba(30,18,8,0.8)", 
            ctx.lineWidth = 1.5 * k, ctx.beginPath(), ctx.moveTo(q[0], y + 8 * k), ctx.lineTo(q[0] - 6 * k, y), 
            ctx.lineTo(q[0] + 6 * k, y), ctx.closePath(), ctx.fill(), ctx.stroke(), ctx.font = "600 " + Math.round(12 * k) + "px Georgia, serif", 
            ctx.textAlign = "center", ctx.lineWidth = 3 * k, ctx.strokeText(sp.name, q[0], y - 4 * k), 
            ctx.fillText(sp.name, q[0], y - 4 * k), ctx.restore();
        }
        drawHeld(ctx, V, sp, p, mp, fg, sg, n, L) {
            const def = JT.PREY_BY_ID[p.type] || {
                len: 3
            }, st = "subdue" === sp.state ? Math.max(p._struggle || 0, .15) : "secure" === sp.state && p._struggle || 0, T = this.time, fam = JT.preyFamily(def), rr = sp._catchRatio || 0, wrestle = ("subdue" === sp.state || "secure" === sp.state) && rr > 1.1;
            "moth" === fam && st > .2 && JT.R() < .25 * st && this.particles.length < 400 && this.particles.push({
                pos: mp.slice(),
                v: [ 6 * (JT.R() - .5), 1 + 3 * JT.R(), 6 * (JT.R() - .5) ],
                t: 0,
                life: 1 + JT.R(),
                col: "rgba(225,205,165,0.75)",
                r: .12 + .12 * JT.R()
            });
            const jit = st ? (Math.sin(41 * T) + .6 * Math.sin(67 * T + 1.3)) * L * (.008 + .03 * st) : 0, tw = st ? .32 * Math.sin(29 * T + .7) * st : 0, full = null != p.full ? p.full : 1, pl = Math.min(p.len || def.len, 1.1 * L) * (.6 + .4 * full), c = Math.cos(tw), si = Math.sin(tw), f2 = M.add(M.mul(fg, -c), M.mul(sg, -si)), s2 = M.add(M.mul(sg, -c), M.mul(fg, si));
            let base = M.add(mp, M.mul(fg, .25 * pl));
            wrestle && (base = "beetle" === fam || "jumper" === fam ? M.add(M.add(mp, M.mul(sg, .32 * pl)), M.mul(fg, .1 * -pl)) : M.add(M.add(mp, M.mul(n, .22 * -L * Math.min(1.6, rr))), M.mul(fg, .18 * -pl)));
            const pf = {
                p: M.add(base, M.add(M.mul(sg, jit), M.mul(n, .5 * jit))),
                f: f2,
                s: s2,
                n: n
            };
            D.prey(ctx, V, p, pf, {
                held: !0,
                curled: st < .15,
                flail: st,
                len: pl,
                time: T,
                alpha: .55 + .45 * full
            });
        }
        outlineDecor(ctx, V, g, col) {
            const hull = this.decorScreenHull(g, V);
            hull && (ctx.strokeStyle = col, ctx.lineWidth = 2 * this.k, ctx.setLineDash([ 5 * this.k, 4 * this.k ]), 
            ctx.beginPath(), hull.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])), 
            ctx.closePath(), ctx.stroke(), ctx.setLineDash([]));
        }
        decorScreenHull(g, V) {
            const pts = [], ex = g.extent.length ? g.extent : g.foot || [];
            g.baseY, Math.max(2, g.height);
            for (const e of ex) pts.push(V.P([ e[0], g.baseY, e[1] ]).slice(0, 2));
            for (const pth of g.paths) for (const q of pth.pts) pts.push(V.P(q).slice(0, 2));
            for (const pr of g.prims) if (pr.o) pts.push(V.P(pr.o).slice(0, 2)); else if (pr.poly) for (const q of pr.poly) pts.push(V.P([ q[0], pr.y0, q[1] ]).slice(0, 2)), 
            pts.push(V.P([ q[0], pr.y1, q[1] ]).slice(0, 2));
            if (!pts.length) return null;
            if (pts.length < 3) {
                const c = pts[0], r = 10 * this.k;
                return [ [ c[0] - r, c[1] - r ], [ c[0] + r, c[1] - r ], [ c[0] + r, c[1] + r ], [ c[0] - r, c[1] + r ] ];
            }
            return G.hull(pts);
        }
        lampSurface(hab, L) {
            const k = L.inst.id + "|" + hab._geomVersion;
            return L.inst._ls = L.inst._ls && L.inst._ls.k === k ? L.inst._ls : {
                k: k,
                y: JT.Nav.supportBelow(hab, [ L.pool[0], L.head[1] - 3, L.pool[2] ]).pos[1]
            }, L.inst._ls.y;
        }
        drawLampGlow(ctx, V, hab, lamps, night) {
            ctx.save(), ctx.setTransform(1, 0, 0, 1, 0, 0), ctx.globalCompositeOperation = "lighter";
            for (const L of lamps) {
                const b = V.P(L.head), y = this.lampSurface(hab, L), c = V.P([ L.pool[0], y + .05, L.pool[2] ]), flick = 1 + .015 * Math.sin(.7 * this.time), rb = 9 * V.s * flick;
                let g = ctx.createRadialGradient(b[0], b[1], 0, b[0], b[1], rb);
                if (g.addColorStop(0, "rgba(255,226,170," + (.35 + .4 * night).toFixed(3) + ")"), 
                g.addColorStop(.3, "rgba(255,170,90," + (.12 + .18 * night).toFixed(3) + ")"), g.addColorStop(1, "rgba(255,140,60,0)"), 
                ctx.fillStyle = g, ctx.beginPath(), ctx.arc(b[0], b[1], rb, 0, 6.283), ctx.fill(), 
                night > .05) {
                    ctx.save(), ctx.globalAlpha = .5 * night;
                    const R = L.r * V.s, cg = ctx.createLinearGradient(b[0], b[1], c[0], c[1]);
                    cg.addColorStop(0, "rgba(255,200,130,0.14)"), cg.addColorStop(1, "rgba(255,170,90,0.03)"), 
                    ctx.fillStyle = cg, ctx.beginPath(), ctx.moveTo(b[0] - 3 * V.s, b[1]), ctx.lineTo(b[0] + 3 * V.s, b[1]), 
                    ctx.lineTo(c[0] + .8 * R, c[1]), ctx.lineTo(c[0] - .8 * R, c[1]), ctx.closePath(), 
                    ctx.fill(), ctx.restore(), ctx.save(), ctx.translate(c[0], c[1]), ctx.scale(1, Math.max(.15, V.sp));
                    const gp = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
                    gp.addColorStop(0, "rgba(255,170,90," + (.32 * night).toFixed(3) + ")"), gp.addColorStop(.5, "rgba(255,140,60," + (.13 * night).toFixed(3) + ")"), 
                    gp.addColorStop(1, "rgba(255,120,40,0)"), ctx.fillStyle = gp, ctx.beginPath(), ctx.arc(0, 0, R, 0, 6.283), 
                    ctx.fill(), ctx.restore();
                }
            }
            ctx.restore();
        }
        addText(pos, text, col, big) {
            this.fx.push({
                pos: pos.slice(),
                text: text,
                col: col || "#ffe9a8",
                t: 0,
                life: big ? 1.8 : 1.5,
                big: big
            });
        }
        burst(pos, col, n) {
            for (let i = 0; i < (n || 10); i++) this.particles.push({
                pos: pos.slice(),
                v: [ 30 * (JT.R() - .5), 10 + 25 * JT.R(), 30 * (JT.R() - .5) ],
                t: 0,
                life: .6 + .5 * JT.R(),
                col: col || "#fff2c0",
                r: .4 + .5 * JT.R()
            });
        }
        mistFx(hab) {
            for (let i = 0; i < 36; i++) {
                const q = hab.randomFloorPoint();
                this.particles.push({
                    pos: [ q[0], hab.dims.h * (.5 + .5 * JT.R()), q[2] ],
                    v: [ 3 * (JT.R() - .5), -12 - 10 * JT.R(), 3 * (JT.R() - .5) ],
                    t: .8 * -JT.R(),
                    life: 2.2 + 1.5 * JT.R(),
                    col: "rgba(225,240,255,0.45)",
                    r: .2 + .25 * JT.R(),
                    mist: !0
                });
            }
        }
        drawMotes(ctx, V, hab, dt) {
            const day = this.game.daylight();
            if (day < .15 || "low" === this.quality) return;
            const dm = hab.dims;
            if (!this.motes || this.motes.hab !== hab.data.id) {
                const rng = JT.makeRng(7);
                this.motes = {
                    hab: hab.data.id,
                    p: []
                };
                for (let i = 0; i < 34; i++) this.motes.p.push([ rng() * dm.w, 6 + rng() * dm.h * .9, rng() * dm.d, 6.28 * rng(), .25 + .5 * rng() ]);
            }
            const t = this.time;
            ctx.fillStyle = "#fff3c8";
            const hdM = !(!JT.HD2D || !JT.HD2D._was || "off" === JT.HD2D._was);
            for (let mi = 0; mi < this.motes.p.length; mi++) {
                if (hdM && mi % 3) continue;
                const m = this.motes.p[mi], x = m[0] + 6 * Math.sin(.13 * t + m[3]), y = m[1] + 4 * Math.sin(.09 * t + 2 * m[3]), z = m[2] + 5 * Math.cos(.11 * t + m[3]), q = V.P([ x, y, z ]), tw = .5 + .5 * Math.sin(1.3 * t + 3 * m[3]);
                ctx.globalAlpha = day * (.18 + .4 * tw) * m[4] * (hdM ? .6 : 1);
                const r = Math.max(.6 * this.k, .45 * m[4] * V.s);
                ctx.fillRect(q[0] - r, q[1] - r, 2 * r, 2 * r);
            }
            ctx.globalAlpha = 1;
        }
        drawEffects(ctx, V, hab, dt) {
            this.drawMotes(ctx, V, hab, dt);
            for (const p of this.particles) {
                p.t += dt, p.v[1] -= (p.mist ? 10 : 60) * dt, p.pos = M.add(p.pos, M.mul(p.v, dt));
                const q = V.P(p.pos);
                if (p.t < 0) continue;
                const a = Math.min(1, 3 * p.t) * (1 - p.t / p.life);
                a <= 0 || (ctx.globalAlpha = a, ctx.fillStyle = p.col, ctx.beginPath(), ctx.arc(q[0], q[1], Math.max(.8, p.r * V.s), 0, 6.283), 
                ctx.fill());
            }
            this.particles = this.particles.filter(p => p.t < p.life && p.pos[1] > -2), this.particles.length > 400 && this.particles.splice(0, this.particles.length - 400), 
            ctx.globalAlpha = 1, ctx.textAlign = "center";
            for (const f of this.fx) {
                f.t += dt;
                const a = M.clamp(1 - f.t / f.life, 0, 1), q = V.P([ f.pos[0], f.pos[1] + 6 + 10 * f.t, f.pos[2] ]), sz = (f.big ? 16 : 12.5) * this.k * (1 + 1.2 * Math.max(0, .25 - f.t));
                ctx.font = "600 " + sz.toFixed(0) + 'px Georgia, "Times New Roman", serif', ctx.globalAlpha = a;
                const k = this.k, hw = ctx.measureText(f.text).width / 2 + 4 * k;
                let x = q[0], y = q[1];
                for (const r of this.hudRects || []) {
                    const x0 = r[0] * k, y0 = r[1] * k, x1 = r[2] * k, y1 = r[3] * k;
                    if (x + hw < x0 || x - hw > x1 || y < y0 - 2 * k || y - sz > y1 + 2 * k) continue;
                    const up = y0 - 4 * k, dn = y1 + sz + 4 * k;
                    y = up > sz && (y - up < dn - y || dn > this.cv.height) ? up : dn;
                }
                ctx.lineWidth = 3 * k, ctx.lineJoin = "round", ctx.strokeStyle = "rgba(30,18,8,0.8)", 
                ctx.strokeText(f.text, x, y), ctx.fillStyle = f.col, ctx.fillText(f.text, x, y);
            }
            this.fx = this.fx.filter(f => f.t < f.life), ctx.globalAlpha = 1;
        }
        pick(sx, sy, opts) {
            opts = opts || {};
            const hab = this.game.hab, V = this.V, X = sx * this.k, Y = sy * this.k;
            let best = null, bd = 1e9;
            const TRp = JT.Terrain, terP = TRp ? TRp.get(hab) : null, test = (e, kind, rad) => {
                if (!e.pos || !M.finite3(e.pos)) return;
                const q = V.P(terP ? TRp.liftWith(terP, e.pos) : e.pos), d = Math.hypot(q[0] - X, q[1] - Y), r = Math.max((opts.touch ? 34 : 16) * this.k, rad * V.s * (opts.touch ? 1.3 : 1));
                d < r && d / r < bd && (bd = d / r, best = {
                    kind: kind,
                    ent: e
                });
            };
            for (const sp of hab.spiders) test(sp, "spider", 1.1 * JT.SpiderAI.len(sp));
            if (best) return best;
            if (!opts.noPrey) for (const p of hab.prey) p.owner || p.buried || test(p, "prey", 1.2 * (JT.PREY_BY_ID[p.type] || {
                len: 3
            }).len);
            if (best) return best;
            bd = 1e9;
            for (const r of hab.data.remains) test(r, "remains", 4);
            if (best) return best;
            bd = 1e9;
            let bdep = 1e9;
            const tol = (opts.touch ? 12 : 6) * this.k, edgeDist = (x, y, P) => {
                let m = 1e9;
                for (let i = 0; i < P.length; i++) {
                    const a = P[i], b = P[(i + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1)));
                    m = Math.min(m, Math.hypot(a[0] + ex * t - x, a[1] + ey * t - y));
                }
                return m;
            };
            for (const inst of hab.decor) {
                const g = hab.geoms[inst.id];
                if (!g) continue;
                const hull = this.decorScreenHull(g, V);
                if (hull && (G.pointInPoly(X, Y, hull) || edgeDist(X, Y, hull) < tol)) {
                    const c = g.foot ? G.centroid(g.foot) : [ inst.x, inst.z ], dep = V.depth([ c[0], g.baseY, c[1] ]) - .5 * g.baseY - (inst.parent ? 5 : 0), area = Math.abs(G.polyArea(hull)), score = .2 * dep + .3 * Math.sqrt(area);
                    score < bdep && (bdep = score, best = {
                        kind: "decor",
                        ent: inst
                    });
                }
            }
            return best;
        }
        fingerPoint(sx, sy, hab) {
            const D = hab.dims;
            let best = null;
            for (const id in hab.geoms) {
                const g = hab.geoms[id];
                for (const t of g.tops || []) {
                    if (best && t.y <= best[1]) continue;
                    const xz = this.unproject(sx, sy, t.y);
                    G.pointInPoly(xz[0], xz[1], t.poly) && (best = [ xz[0], t.y, xz[1] ]);
                }
            }
            if (!best) {
                const xz = this.unproject(sx, sy, 0);
                best = [ xz[0], 0, xz[1] ];
            }
            return M.finite3(best) ? [ M.clamp(best[0], 1, D.w - 1), best[1] + 2, M.clamp(best[2], 1, D.d - 1) ] : null;
        }
        placementPoint(sx, sy, hab, type) {
            const tops = [], def = JT.DECOR_BY_ID[type];
            if (def && def.mount) {
                const A = this.unproject(sx, sy, 0), B = this.unproject(sx, sy, 100);
                let best = null;
                for (const id in hab.geoms) {
                    const g = hab.geoms[id];
                    if (!g.front) continue;
                    const F = g.front, a = F[0], b = F[F.length - 1], nx = g.out[0], nz = g.out[2], f0 = (A[0] - a[0]) * nx + (A[1] - a[1]) * nz, f1 = (B[0] - a[0]) * nx + (B[1] - a[1]) * nz;
                    if (Math.abs(f1 - f0) < 1e-6) continue;
                    const y = -f0 / (f1 - f0) * 100;
                    if (!(y > -20 && y < g.wallH + 30)) continue;
                    const x = A[0] + (B[0] - A[0]) * y / 100, z = A[1] + (B[1] - A[1]) * y / 100, ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1, u = ((x - a[0]) * ex + (z - a[1]) * ez) / L, off = Math.max(0, -u, u - L);
                    (!best || off < best.off) && (best = {
                        x: x,
                        z: z,
                        y: 0,
                        my: y,
                        off: off,
                        on: id
                    });
                }
                if (best) return best;
            }
            if (def) for (const id in hab.geoms) hab.geoms[id].tops.forEach((t, i) => tops.push({
                id: id,
                i: i,
                t: t
            }));
            tops.sort((a, b) => b.t.y - a.t.y);
            for (const T of tops) {
                const xz = this.unproject(sx, sy, T.t.y);
                if (G.pointInPoly(xz[0], xz[1], T.t.poly)) return {
                    x: xz[0],
                    z: xz[1],
                    y: T.t.y,
                    on: T.id
                };
            }
            const xz = this.unproject(sx, sy, 0);
            return {
                x: xz[0],
                z: xz[1],
                y: 0,
                on: null
            };
        }
        drawDebug(ctx, V, hab) {
            const nav = hab.nav;
            if (nav) {
                ctx.save(), ctx.lineWidth = 1, ctx.strokeStyle = "rgba(80,200,255,0.25)";
                for (const n of nav.nodes) for (const e of nav.adj[n.id] || []) {
                    if (e.to < n.id && "jump" !== e.type && "drop" !== e.type) continue;
                    const b = nav.nodes[e.to];
                    if (!b) continue;
                    const A = V.P(n.pos), B = V.P(b.pos);
                    ctx.strokeStyle = "jump" === e.type ? "rgba(255,200,60,0.3)" : "drop" === e.type ? "rgba(255,90,90,0.3)" : "rgba(80,200,255,0.22)", 
                    ctx.beginPath(), ctx.moveTo(A[0], A[1]), ctx.lineTo(B[0], B[1]), ctx.stroke();
                }
                for (const n of nav.nodes) {
                    const q = V.P(n.pos);
                    ctx.fillStyle = "path" === n.kind ? "#6f6" : "top" === n.kind ? "#ff6" : "face" === n.kind ? "#f9f" : "#6cf", 
                    ctx.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3);
                }
                ctx.font = 11 * this.k + "px monospace", ctx.textAlign = "left";
                for (const sp of hab.spiders) {
                    const q = V.P(sp.pos);
                    if (sp._route) {
                        ctx.strokeStyle = "#ff0", ctx.lineWidth = 2, ctx.beginPath(), ctx.moveTo(q[0], q[1]);
                        for (let i = sp._route.i; i < sp._route.steps.length; i++) {
                            const s = V.P(sp._route.steps[i].pos);
                            ctx.lineTo(s[0], s[1]);
                        }
                        ctx.stroke();
                    }
                    const t = sp.target && JT.SpiderAI.targetEnt(hab, sp);
                    if (t) {
                        const b = V.P(t.pos);
                        ctx.strokeStyle = "#f44", ctx.beginPath(), ctx.moveTo(q[0], q[1]), ctx.lineTo(b[0], b[1]), 
                        ctx.stroke();
                    }
                    const spot = sp._feedSpot || sp._moltSpot;
                    if (spot) {
                        const b = V.P(spot);
                        ctx.fillStyle = "#f0f", ctx.fillRect(b[0] - 4, b[1] - 4, 8, 8);
                    }
                    ctx.fillStyle = "#fff", ctx.fillText(sp.name + " " + sp.state + " " + (sp.sup && sp.sup.k) + " sat " + sp.sat.toFixed(2), q[0] + 8, q[1] - 8);
                }
                ctx.fillStyle = "rgba(0,0,0,0.6)", ctx.fillRect(4, 4, 260 * this.k, 52 * this.k), 
                ctx.fillStyle = "#9f9", ctx.fillText("fps " + this.fps.toFixed(0) + "  ms " + (this.frameMs || 0).toFixed(1) + "  q " + this.quality + "  nodes " + nav.nodes.length, 10, 20 * this.k), 
                ctx.fillText("prey " + hab.prey.length + "  silk " + hab.data.silk.length + "  remains " + hab.data.remains.length + "  drops " + hab.data.drops.length, 10, 38 * this.k), 
                ctx.restore();
            }
        }
        thumbKey(type, rot, size, look) {
            return type + "|" + (rot || 0) + "|" + (size || 112) + (look ? "|" + look.style + look.cols.side : "");
        }
        hasThumb(type, rot, size, look) {
            return !!this.thumbs[this.thumbKey(type, rot, size, look)];
        }
        decorThumb(type, rot, size, look) {
            size = size || 112;
            const key = this.thumbKey(type, rot, size, look);
            if (this.thumbs[key]) return this.thumbs[key];
            const c = mkCanvas(size, size), ctx = c.getContext("2d");
            try {
                const g = JT.Geo.build({
                    id: "thumb_" + type,
                    type: type,
                    x: 0,
                    z: 0,
                    rot: rot || 0,
                    seed: 1
                }, 0, 160, look), V = new JT.View(.52, .62, 1, 0, 0, [ 0, 0, 0 ]), pts = [], hull = this.decorScreenHull(g, V) || [ [ -1, -1 ], [ 1, 1 ] ];
                for (const q of hull) pts.push(q);
                let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
                for (const q of pts) x0 = Math.min(x0, q[0]), x1 = Math.max(x1, q[0]), y0 = Math.min(y0, q[1]), 
                y1 = Math.max(y1, q[1]);
                const s = Math.min(.84 * size / Math.max(1, x1 - x0), .84 * size / Math.max(1, y1 - y0));
                V.set(.52, .62, s, size / 2 - (x0 + x1) / 2 * s, size / 2 - (y0 + y1) / 2 * s, [ 0, 0, 0 ]);
                const gc = G.centroid(g.foot || [ [ 0, 0 ] ]), q = V.P([ gc[0], g.baseY, gc[1] ]), rr = Math.max(8, Math.sqrt(Math.abs(G.polyArea(g.foot || [ [ 0, 0 ], [ 1, 0 ], [ 0, 1 ] ]))) * V.s * .75), sg = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr);
                sg.addColorStop(0, "rgba(60,40,20,0.28)"), sg.addColorStop(1, "rgba(60,40,20,0)"), 
                ctx.fillStyle = sg, ctx.beginPath(), ctx.ellipse(q[0], q[1], rr, .5 * rr, 0, 0, 6.283), 
                ctx.fill();
                const art = this.gp && JT.withBaseLight(() => this.gp.thumb(g, V, size));
                art && (ctx.save(), ctx.shadowColor = "rgba(0,0,0,0.42)", ctx.shadowBlur = 7 * size / 112, 
                ctx.shadowOffsetY = 4 * size / 112, ctx.drawImage(art, 0, 0), ctx.restore(), c._baked = !0, 
                JT.ThumbDB && JT.ThumbDB.save(key, c));
            } catch (e) {
                JT.DEV && console.warn(e);
            }
            return this.thumbs[key] = c, c;
        }
        speciesPortrait(id, size) {
            const key = id + "|" + (size = size || 120);
            if (this.portraits[key]) return this.portraits[key];
            const c = mkCanvas(size, size), ctx = c.getContext("2d"), V = new JT.View(.9, .85, size / 16, size / 2, .58 * size, [ 0, 0, 0 ]), sp = {
                species: id,
                state: "idle",
                _walk: 0,
                _moving: !1,
                _crouch: 0,
                _legRaise: .3,
                seed: 1,
                sat: .6
            };
            try {
                JT.withBaseLight(() => D.spider(ctx, V, sp, {
                    p: [ 0, 0, 0 ],
                    f: M.norm([ -.5, 0, .8 ]),
                    s: M.norm([ .8, 0, .5 ]),
                    n: [ 0, 1, 0 ]
                }, {
                    len: 10,
                    time: 0,
                    thumb: !0
                }));
            } catch (e) {
                JT.DEV && console.warn(e);
            }
            return this.portraits[key] = c, c;
        }
        preyPortrait(id, size) {
            const key = "prey|" + id + "|" + (size = size || 96);
            if (this.portraits[key]) return this.portraits[key];
            const d = JT.PREY_BY_ID[id], c = mkCanvas(size, size), ctx = c.getContext("2d"), V = new JT.View(.9, .8, size / (1.9 * Math.max(3, d.len)), size / 2, .6 * size, [ 0, 0, 0 ]);
            try {
                JT.withBaseLight(() => D.prey(ctx, V, {
                    type: id,
                    sup: {
                        k: "floor"
                    },
                    seed: 1,
                    _anim: 0,
                    species: "zebra"
                }, {
                    p: [ 0, 0, 0 ],
                    f: M.norm([ -.5, 0, .8 ]),
                    s: M.norm([ .8, 0, .5 ]),
                    n: [ 0, 1, 0 ]
                }, {
                    time: 0
                }));
            } catch (e) {
                JT.DEV && console.warn(e);
            }
            return this.portraits[key] = c, c;
        }
    };
}("undefined" != typeof window ? window : globalThis);
