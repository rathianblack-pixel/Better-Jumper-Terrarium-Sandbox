/* Terrarium — HD-2D look (after Octopath Traveler): the 3D diorama is drawn at a low "pixel art" resolution with crisp
   nearest-neighbour pixels (decor, ground and critter sprites alike, with 1-pixel ink outlines and dithered, banded light),
   then finished at full screen resolution with the modern lens effects that define the style: tilt-shift / depth-of-field
   blur, warm bloom, light shafts, a cinematic colour grade and a heavy vignette.
   WebGL2 only (falls back to the storybook look on WebGL1). Settings → Graphics → Art style / Pixel size. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  const VS = `#version 300 es
in vec2 aXY; out vec2 vUV; void main(){ vUV=aXY*0.5+0.5; gl_Position=vec4(aXY,0.0,1.0); }`;
  // 2x2 box down-sample (half res)
  const DOWN_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec2 d=uTexel*0.5; o=(texture(uTex,vUV+vec2(-d.x,-d.y))+texture(uTex,vUV+vec2(d.x,-d.y))+texture(uTex,vUV+vec2(-d.x,d.y))+texture(uTex,vUV+vec2(d.x,d.y)))*0.25; }`;
  // separable 9-tap gaussian
  const BLUR_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){ vec4 s=texture(uTex,vUV)*0.2270;
  s+=(texture(uTex,vUV+uDir*1.3846)+texture(uTex,vUV-uDir*1.3846))*0.3162;
  s+=(texture(uTex,vUV+uDir*3.2308)+texture(uTex,vUV-uDir*3.2308))*0.0703; o=s; }`;
  // bright pass for bloom
  const BRIGHT_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform float uTh; out vec4 o;
void main(){ vec3 c=texture(uTex,vUV).rgb; float l=max(c.r,max(c.g,c.b)); float k=smoothstep(uTh,uTh+0.25,l); o=vec4(c*k,1.0); }`;
  const COMP_FS = `#version 300 es
precision highp float; in vec2 vUV;
uniform sampler2D uScene; uniform highp sampler2D uDepth; uniform sampler2D uBlur; uniform sampler2D uBloom;
uniform vec2 uLow; uniform vec2 uOut; uniform vec3 uFocus; uniform vec2 uDof; uniform float uTilt; uniform float uTime; uniform float uNight;
uniform vec2 uSun; uniform float uDay; uniform float uFx; uniform float uBlurK; out vec4 o;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(float x){ float i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(h21(vec2(i,7.1)),h21(vec2(i+1.0,7.1)),f); }
void main(){
  vec2 uv=gl_FragCoord.xy/uOut;
  ivec2 lp=ivec2(floor(uv*uLow)); lp=clamp(lp, ivec2(0), ivec2(uLow)-1);
  vec3 sharp=texelFetch(uScene, lp, 0).rgb; float d=texelFetch(uDepth, lp, 0).r;
  vec3 blur=texture(uBlur, uv).rgb;
  // depth of field: sharp band around the focus depth, plus the tilt-shift fall-off to the top and bottom of the screen
  float dc = d>0.99999 ? 1.0 : smoothstep(uDof.x, uDof.y, abs(d-uFocus.z));
  float ty = abs(uv.y-uFocus.y); float tc = smoothstep(0.12, 0.45, ty)*uTilt;
  float coc = clamp(max(dc, tc), 0.0, 1.0)*uBlurK;
  vec3 c = mix(sharp, blur, coc);
  // bloom
  vec3 bl = texture(uBloom, uv).rgb; c += bl*mix(vec3(1.0,0.86,0.66), vec3(0.62,0.78,1.0), uNight)*1.0*uFx;
  // light shafts falling from the sun side
  vec2 a = (uv-0.5)*vec2(uOut.x/uOut.y,1.0); vec2 sd = normalize(uSun); vec2 pr = vec2(-sd.y, sd.x);
  float across = dot(a, pr), along = dot(a, sd);
  float rays = vn(across*9.0+uTime*0.05)*vn(across*23.0-uTime*0.08+3.0); rays = smoothstep(0.25, 0.8, rays);
  float rf = smoothstep(-0.2, 0.75, along); c += vec3(1.0,0.84,0.58)*rays*rf*0.15*uDay*uFx;
  c += vec3(1.0,0.86,0.62)*smoothstep(0.1,1.0,along)*0.09*uDay*uFx; // warm haze on the lit side
  // (no screen-wide motes: the engine's own dust motes and biome fireflies already float inside the tank)
  // colour grade: saturate, cool shadows, warm highlights, gentle filmic contrast
  float lum = dot(c, vec3(0.299,0.587,0.114));
  c = mix(vec3(lum), c, 1.16-0.3*uNight);
  c += vec3(-0.01,0.015,0.06)*(1.0-smoothstep(0.0,0.45,lum));
  c *= mix(vec3(1.0), vec3(1.06,1.0,0.9), smoothstep(0.45,1.0,lum));
  c = c*(1.0+c*0.12)/(1.0+c*0.12*0.9); c = clamp((c-0.5)*1.12+0.52, 0.0, 1.4);
  c = mix(c, c*vec3(0.85,0.92,1.08)+vec3(0.025,0.035,0.06), uNight*0.6);
  // vignette (heavier at the top and bottom, like a stage)
  vec2 q = (uv-0.5)*vec2(1.05,1.3); float vg = smoothstep(0.98, 0.28, length(q)); c *= mix(0.58, 1.0, vg);
  c += (h21(gl_FragCoord.xy+fract(uTime))-0.5)/255.0;
  o = vec4(c, 1.0); }`;

  const HD = {
    clear: [0.12, 0.13, 0.15],
    get art() { const a = JT.app; const s = a && a.settings; return s && s.art === 'storybook' ? 'storybook' : 'hd2d'; },
    get on() { const a = JT.app; const s = a && a.settings || (a && a.R && a.R.set); return !s || s.art !== 'storybook'; },
    _P: null,
    progs(gp) { if (this._P && this._P.gp === gp) return this._P; this._P = { gp, down: gp.prog(VS, DOWN_FS), blur: gp.prog(VS, BLUR_FS), bright: gp.prog(VS, BRIGHT_FS), comp: gp.prog(VS, COMP_FS) }; return this._P; },
    tex(gl, w, h, ifmt, fmt, type, filt) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null); return t; },
    fbo(gl, ct, dt) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ct, 0); if (dt) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dt, 0); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; return ok ? f : null; },
    free(gl, T) { if (!T) return; for (const k of ['fb', 'fb2', 'fA', 'fB', 'fC', 'fD']) if (T[k]) gl.deleteFramebuffer(T[k]); for (const k of ['ct', 'dt', 'dt2', 'tA', 'tB', 'tC', 'tD']) if (T[k]) gl.deleteTexture(T[k]); },
    /** Optional art texture, measured in render pixels rather than CSS pixels. */
    pxSize(R) { const s = R.set || {}; return s.pixel === 'chunky' ? 1.5 : s.pixel === 'classic' ? 1.2 : 1; },
    blurK(R) { const b = (R.set || {}).blur; return b === 'off' ? 0 : b === 'strong' ? 1 : 0.2; },
    sync(gp, on) { // art style switched: rebuild the generated textures and the still-camera cache
      const key = on ? 'hd' : 'off'; if (this._was === key) return; this._was = key;
      // Retire style-dependent textures explicitly rather than orphaning GPU resources.
      if (gp.bgT) for (const t of Object.values(gp.bgT)) if (t) gp.gl.deleteTexture(t);
      if (gp.gT) { if (gp.gT.t) gp.gl.deleteTexture(gp.gT.t); if (gp.gT.s) gp.gl.deleteTexture(gp.gT.s); }
      gp.bgT = null; gp.gT = null; if (gp.cacheFree) gp.cacheFree(); if (gp.hg) gp.hg.key = null;
      const b = root.document && root.document.body; if (b) { b.classList.toggle('hd2d', key === 'hd'); b.classList.remove('art-sketch', 'art-ukiyo'); } },
    begin(gp, W, H) {
      const gl = gp.gl; const on = gp.gl2 && this.on && !gp._hdBroken; this.sync(gp, on); if (!on) { if (gp._hdT) { this.free(gl, gp._hdT); gp._hdT = null; } return null; }
      const f = M.clamp(1 / this.pxSize(gp.R), 0.08, 1); const w = Math.max(16, Math.round(W * f)), h = Math.max(16, Math.round(H * f));
      let T = gp._hdT;
      if (!T || T.w !== w || T.h !== h) { this.free(gl, T); try {
        T = { w, h, W, H }; T.ct = this.tex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST); T.dt = this.tex(gl, w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST); T.fb = this.fbo(gl, T.ct, T.dt);
        T.dt2 = this.tex(gl, w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST); T.fb2 = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb2); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, T.dt2, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo2');
        T.hw = Math.max(4, Math.ceil(w / 2)); T.hh = Math.max(4, Math.ceil(h / 2)); T.qw = Math.max(4, Math.ceil(w / 4)); T.qh = Math.max(4, Math.ceil(h / 4));
        T.tA = this.tex(gl, T.hw, T.hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); T.tB = this.tex(gl, T.hw, T.hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
        T.tC = this.tex(gl, T.qw, T.qh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); T.tD = this.tex(gl, T.qw, T.qh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
        T.fA = this.fbo(gl, T.tA); T.fB = this.fbo(gl, T.tB); T.fC = this.fbo(gl, T.tC); T.fD = this.fbo(gl, T.tD);
        if (!T.fb || !T.fA || !T.fB || !T.fC || !T.fD) throw new Error('fbo'); this.progs(gp);
      } catch (e) { console.warn('HD-2D unavailable:', e && e.message); this.free(gl, T); gp._hdT = null; gp._hdBroken = true; gl.bindFramebuffer(gl.FRAMEBUFFER, null); this.sync(gp, false); return null; }
        gp._hdT = T; }
      T.f = w / W; gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); return T;
    },
    pass(gp, P, fb, w, h, tex, set) { const gl = gp.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h); gp.use(P); gl.bindBuffer(gl.ARRAY_BUFFER, gp.quad); gp.attribs(P, [['aXY', 2], ['uv_', 2]], 4);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(P.u.uTex, 0); if (set) set(P); gl.drawArrays(gl.TRIANGLES, 0, 6); },
    post(gp, V, hab, night, W, H) {
      const gl = gp.gl, T = gp._hdT, P = this.progs(gp); if (!T) return;
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND);
      // depth-of-field source: half-res, blurred twice (wide, soft bokeh)
      this.pass(gp, P.down, T.fA, T.hw, T.hh, T.ct, (p) => gl.uniform2f(p.u.uTexel, 1 / T.w, 1 / T.h));
      const bk = this.blurK(gp.R); for (const st of (bk === 0 ? [] : bk < 0.5 ? [1.0] : [1.0, 2.2])) {
        this.pass(gp, P.blur, T.fB, T.hw, T.hh, T.tA, (p) => gl.uniform2f(p.u.uDir, st / T.hw, 0));
        this.pass(gp, P.blur, T.fA, T.hw, T.hh, T.tB, (p) => gl.uniform2f(p.u.uDir, 0, st / T.hh)); }
      // bloom: bright parts at quarter res, blurred wide
      this.pass(gp, P.bright, T.fC, T.qw, T.qh, T.tA, (p) => gl.uniform1f(p.u.uTh, night > 0.5 ? 0.38 : 0.55));
      for (const st of (JT.Device.tier === 'low' ? [1.8] : [1.0, 2.5])) {
        this.pass(gp, P.blur, T.fD, T.qw, T.qh, T.tC, (p) => gl.uniform2f(p.u.uDir, st / T.qw, 0));
        this.pass(gp, P.blur, T.fC, T.qw, T.qh, T.tD, (p) => gl.uniform2f(p.u.uDir, 0, st / T.qh)); }
      // composite to the screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); const C = P.comp; gp.use(C); gl.bindBuffer(gl.ARRAY_BUFFER, gp.quad); gp.attribs(C, [['aXY', 2], ['uv_', 2]], 4);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.ct); gl.uniform1i(C.u.uScene, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.dt); gl.uniform1i(C.u.uDepth, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.tA); gl.uniform1i(C.u.uBlur, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.tC); gl.uniform1i(C.u.uBloom, 3); gl.activeTexture(gl.TEXTURE0);
      // focus: the watched critter in Observe / Follow, otherwise the middle of the tank
      const R = gp.R, g = R.game; let fp = V.c; if (R.cam && R.cam.mode === 'follow' && g && hab) { const sp = hab.spider && hab.spider(g.selectedId); if (sp && sp.pos && M.finite3(sp.pos)) fp = sp.pos; }
      const q = V.P(fp); const fz = 0.5 + 0.5 * M.clamp(q[2] * 0.0011, -0.999, 0.999);
      const span = H / Math.max(1e-3, V.s); // world units visible top to bottom
      const close = R.cam && R.cam.mode === 'follow';
      gl.uniform2f(C.u.uLow, T.w, T.h); gl.uniform2f(C.u.uOut, W, H); gl.uniform3f(C.u.uFocus, q[0] / W, 1 - q[1] / H, fz);
      gl.uniform2f(C.u.uDof, 0.00055 * span * (close ? 0.06 : 0.16), 0.00055 * span * (close ? 0.32 : 0.62)); gl.uniform1f(C.u.uTilt, close ? 0.75 : 1.0); gl.uniform1f(C.u.uBlurK, bk);
      gl.uniform1f(C.u.uTime, (performance.now() / 1000) % 1000); gl.uniform1f(C.u.uNight, M.clamp(night, 0, 1));
      const L = JT.LIGHT || [0.4, 0.8, 0.3]; const sj = V.J(L); let sx = sj[0], sy = -sj[1]; const sl = Math.hypot(sx, sy) || 1; if (sl < 1e-3) { sx = -0.6; sy = 0.8; } gl.uniform2f(C.u.uSun, sx / sl, sy / sl);
      const SK = JT.SKY || {}; gl.uniform1f(C.u.uDay, M.clamp((1 - night) * (SK.kd != null ? 0.4 + 0.6 * SK.kd : 1), 0, 1)); gl.uniform1f(C.u.uFx, R.quality === 'low' ? 0.7 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.enable(gl.BLEND); gl.depthMask(true);
    },
    /** Backdrop behind the tank: a deep, dusky gradient with soft out-of-focus orbs of light (the lens blur finishes it). */
    bgCanvas(id) {
      const B = JT.BACKGROUNDS[id] || JT.BACKGROUNDS.mossy; const W = 768, H = 512; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const rng = JT.makeRng(JT.hashStr('hd' + id));
      const dk = (h, k) => { const v = JT.GLMesh.rgb(h); return 'rgb(' + v.map(x => Math.round(Math.min(255, x * 255 * k))).join(',') + ')'; };
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, dk(B.sky[0], 0.62)); gr.addColorStop(0.55, dk(B.sky[1], 0.8)); gr.addColorStop(1, dk(B.sky[2], 0.6)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) { const x = rng() * W, y = rng() * H * 0.8, r = 14 + rng() * 34; const col = rng() < 0.55 ? B.light : rng.pick(B.blobs); const a = 0.025 + rng() * 0.05;
        const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, dk(col, 1).replace('rgb', 'rgba').replace(')', ',' + a + ')')); rg.addColorStop(0.6, dk(col, 1).replace('rgb', 'rgba').replace(')', ',' + (a * 0.5) + ')')); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      const sh = g.createRadialGradient(W * 0.25, -H * 0.1, 0, W * 0.25, -H * 0.1, H * 1.1); sh.addColorStop(0, 'rgba(255,226,170,0.22)'); sh.addColorStop(1, 'rgba(255,226,170,0)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
      return c;
    },
  };
  JT.HD2D = HD;
})(typeof window !== 'undefined' ? window : globalThis);


