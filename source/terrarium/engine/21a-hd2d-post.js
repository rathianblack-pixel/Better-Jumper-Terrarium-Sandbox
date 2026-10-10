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

  // Cuphead look (1930s cel cartoon on old film): watercolour backdrop softened, warm "Technicolor" grade with cream
  // highlights and warm brown-black ink, then the projector: grain at 24 fps, gate weave and scratches held on twos,
  // dust specks, exposure flicker and a heavy burnt-edge vignette.
  const CUP_FS = `#version 300 es
precision highp float; in vec2 vUV;
uniform sampler2D uScene; uniform highp sampler2D uDepth; uniform sampler2D uBlur; uniform sampler2D uBloom;
uniform vec2 uLow; uniform vec2 uOut; uniform float uNight; uniform float uFilm; uniform float uFrame; uniform float uK; uniform float uBlurK; out vec4 o;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
void main(){
  vec2 fc=gl_FragCoord.xy; float fr=uFrame; float hold=floor(fr/2.0);
  vec2 weave=(vec2(h21(vec2(hold,1.7)),h21(vec2(hold,9.3)))-0.5)*vec2(0.9,1.6)*uK*uFilm;
  vec2 uv=clamp((fc+weave)/uOut, vec2(0.0), vec2(1.0));
  ivec2 lp=clamp(ivec2(floor(uv*uLow)), ivec2(0), ivec2(uLow)-1);
  vec3 c=texelFetch(uScene, lp, 0).rgb; float d=texelFetch(uDepth, lp, 0).r;
  if(d>0.99999) c=mix(c, texture(uBlur, uv).rgb, 0.22*uBlurK);            // the painted backdrop sits soft behind the cel layer
  c += texture(uBloom, uv).rgb*vec3(1.0,0.88,0.66)*0.12;
  // cel ink: a bold outline wherever the depth jumps (silhouettes against the backdrop, the slab edge, one thing in front of another)
  { float w=1.6*uK; float e=0.0; vec2 lo=vec2(0.0), hi=uLow-1.0; vec2 sc=uLow/uOut;
    for(int i=0;i<4;i++){ vec2 dv = i==0?vec2(w,0.0): i==1?vec2(-w,0.0): i==2?vec2(0.0,w):vec2(0.0,-w);
      float dn=texelFetch(uDepth, ivec2(clamp(floor((fc+weave+dv)*sc), lo, hi)), 0).r; e=max(e, abs(dn-d)); }
    float ink=smoothstep(0.006,0.02,e); c=mix(c, vec3(0.07,0.05,0.04), ink*0.92); }                  // gentle halation round bright things
  // grade: a touch richer, warmed toward sepia, contrast up, then mapped between warm ink-black and cream paper
  float l=dot(c, vec3(0.299,0.587,0.114));
  c=mix(vec3(l), c, 1.32);
  c=mix(c, vec3(l)*vec3(1.08,0.97,0.76), 0.1);
  c=clamp((c-0.5)*1.14+0.5, 0.0, 1.0);
  c=mix(vec3(0.085,0.06,0.045), vec3(0.985,0.94,0.82), c);
  c=mix(c, c*vec3(0.74,0.84,1.04)+vec3(0.0,0.012,0.035), uNight*0.6);
  if(uFilm>0.0){
    float g=h21(floor(fc/(1.4*uK))+vec2(fr*17.13, fr*3.71))-0.5; c+=g*0.085*uFilm*(0.6+0.4*(1.0-l));   // grain, fresh every frame
    c*=1.0+(h21(vec2(fr,3.3))-0.5)*0.07*uFilm;                                                       // exposure flicker
    for(int i=0;i<2;i++){ float fi=float(i); float s=h21(vec2(hold,fi*5.1+0.3));                      // vertical scratches
      if(s<0.42){ float x=h21(vec2(hold,fi*7.7+1.0))*uOut.x + sin(fc.y*0.004+s*40.0)*6.0*uK; float w=(0.5+s*1.6)*uK;
        float ln=1.0-smoothstep(0.0,w,abs(fc.x-x)); float seg=step(0.25, h21(vec2(floor(fc.y/(55.0*uK)), hold+fi*3.0)));
        c=mix(c, s<0.16 ? vec3(0.99,0.96,0.88) : vec3(0.12,0.09,0.06), ln*seg*0.55*uFilm); } }
    vec2 cs=vec2(70.0*uK); vec2 cell=floor(fc/cs); float r=h21(cell+vec2(fr*3.7,fr*1.3));            // dust and hairs
    if(r>0.988){ vec2 cp=(cell+0.2+0.6*vec2(h21(cell+fr),h21(cell-fr+4.0)))*cs; float sz=uK*(1.0+3.0*h21(cell*1.3+fr));
      float dd=length((fc-cp)*vec2(1.0, r>0.996 ? 0.18 : 1.0))/sz; c=mix(c, vec3(0.09,0.065,0.05), (1.0-smoothstep(0.6,1.2,dd))*0.75*uFilm); }
  }
  vec2 q=(uv-0.5)*vec2(1.0,1.12); float vg=smoothstep(0.9,0.32,length(q));
  c*=mix(0.66,1.0,vg); c=mix(c, c*vec3(1.0,0.88,0.7), (1.0-vg)*0.45);
  o=vec4(c,1.0); }`;

  const HD = {
    clear: [0.12, 0.13, 0.15], clearCup: [0.93, 0.87, 0.74],
    get cup() { const a = JT.app; const s = a && a.settings || (a && a.R && a.R.set); return !!s && s.art === 'cuphead'; },
    get on() { const a = JT.app; const s = a && a.settings || (a && a.R && a.R.set); return !s || s.art !== 'storybook'; },
    _P: null,
    progs(gp) { if (this._P && this._P.gp === gp) return this._P; this._P = { gp, down: gp.prog(VS, DOWN_FS), blur: gp.prog(VS, BLUR_FS), bright: gp.prog(VS, BRIGHT_FS), comp: gp.prog(VS, COMP_FS), cup: gp.prog(VS, CUP_FS) }; return this._P; },
    tex(gl, w, h, ifmt, fmt, type, filt) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null); return t; },
    fbo(gl, ct, dt) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ct, 0); if (dt) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dt, 0); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; return ok ? f : null; },
    free(gl, T) { if (!T) return; for (const k of ['fb', 'fb2', 'fA', 'fB', 'fC', 'fD']) if (T[k]) gl.deleteFramebuffer(T[k]); for (const k of ['ct', 'dt', 'dt2', 'tA', 'tB', 'tC', 'tD']) if (T[k]) gl.deleteTexture(T[k]); },
    /** Pixel size in CSS px: ~2 px on a laptop, a little finer on phones. */
    pxSize(R) { const s = R.set || {}; if (this.cup) return Math.max(1 / (R.k || 1), 0.5); const base = M.clamp((R.cssW || 800) / 800, 1.25, 1.75); return s.pixel === 'fine' ? 1 : s.pixel === 'chunky' ? base * 1.5 : base; },
    blurK(R) { if (this.cup) return 1; const b = (R.set || {}).blur; return b === 'off' ? 0 : b === 'strong' ? 1 : 0.2; },
    filmK(R) { const f = (R.set || {}).film; return f === 'off' ? 0 : f === 'full' ? 1 : 0.55; },
    sync(gp, on) { // art style switched: rebuild the generated textures and the still-camera cache
      const key = on ? (this.cup ? 'cup' : 'hd') : 'off'; if (this._was === key) return; this._was = key; gp.bgT = null; gp.gT = null; if (gp.cacheFree) gp.cacheFree(); if (gp.hg) gp.hg = null;
      const b = root.document && root.document.body; if (b) { b.classList.toggle('hd2d', key === 'hd'); b.classList.toggle('cuphead', key === 'cup'); } },
    begin(gp, W, H) {
      const gl = gp.gl; const on = gp.gl2 && this.on && !gp._hdBroken; this.sync(gp, on); if (!on) return null;
      const f = M.clamp(1 / (this.pxSize(gp.R) * (gp.R.k || 1)), 0.08, 1); const w = Math.max(16, Math.round(W * f)), h = Math.max(16, Math.round(H * f));
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
      const cup = this.cup; const bk = this.blurK(gp.R); for (const st of (bk === 0 ? [] : cup || bk < 0.5 ? [1.0] : [1.0, 2.2])) {
        this.pass(gp, P.blur, T.fB, T.hw, T.hh, T.tA, (p) => gl.uniform2f(p.u.uDir, st / T.hw, 0));
        this.pass(gp, P.blur, T.fA, T.hw, T.hh, T.tB, (p) => gl.uniform2f(p.u.uDir, 0, st / T.hh)); }
      // bloom: bright parts at quarter res, blurred wide
      this.pass(gp, P.bright, T.fC, T.qw, T.qh, T.tA, (p) => gl.uniform1f(p.u.uTh, night > 0.5 ? 0.38 : 0.55));
      for (const st of [1.0, 2.0, 3.0]) {
        this.pass(gp, P.blur, T.fD, T.qw, T.qh, T.tC, (p) => gl.uniform2f(p.u.uDir, st / T.qw, 0));
        this.pass(gp, P.blur, T.fC, T.qw, T.qh, T.tD, (p) => gl.uniform2f(p.u.uDir, 0, st / T.qh)); }
      if (cup) return this.postCup(gp, P, T, night, W, H);
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
    postCup(gp, P, T, night, W, H) {
      const gl = gp.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); const C = P.cup; gp.use(C); gl.bindBuffer(gl.ARRAY_BUFFER, gp.quad); gp.attribs(C, [['aXY', 2], ['uv_', 2]], 4);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.ct); gl.uniform1i(C.u.uScene, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.dt); gl.uniform1i(C.u.uDepth, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.tA); gl.uniform1i(C.u.uBlur, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.tC); gl.uniform1i(C.u.uBloom, 3); gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(C.u.uLow, T.w, T.h); gl.uniform2f(C.u.uOut, W, H); gl.uniform1f(C.u.uNight, M.clamp(night, 0, 1)); gl.uniform1f(C.u.uBlurK, 1);
      gl.uniform1f(C.u.uFilm, this.filmK(gp.R)); gl.uniform1f(C.u.uFrame, Math.floor(performance.now() / (1000 / 24)) % 4096); gl.uniform1f(C.u.uK, gp.R.k || 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6); gl.enable(gl.BLEND); gl.depthMask(true);
    },
    /** Cuphead backdrop: a hand-painted watercolour landscape on cream paper — soft washes with darker pooled edges,
        layered rolling hills, puffy cartoon clouds and paper grain. */
    cupCanvas(id) {
      const B = JT.BACKGROUNDS[id] || JT.BACKGROUNDS.mossy; const W = 768, H = 512; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const rng = JT.makeRng(JT.hashStr('cup' + id));
      const rgb = (h) => JT.GLMesh.rgb(h); const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t); const PAP = [0.95, 0.9, 0.78];
      const css = (v, a) => 'rgba(' + v.map(x => Math.round(Math.min(1, Math.max(0, x)) * 255)).join(',') + ',' + (a == null ? 1 : a) + ')';
      const wc = (h, t) => { const v = rgb(h); const l = v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11; return mixc(mixc(v, [l, l, l], -0.25), PAP, t); };
      g.fillStyle = css(PAP); g.fillRect(0, 0, W, H);
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, css(wc(B.sky[0], 0.55), 0.8)); gr.addColorStop(0.6, css(wc(B.sky[1], 0.62), 0.75)); gr.addColorStop(1, css(wc(B.sky[2], 0.45), 0.8)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const blob = (cx, cy, rx, ry, col, a, n) => { g.beginPath(); const k = n || 14, ph = rng() * 6.28; for (let i = 0; i <= k; i++) { const t = i / k * 6.283; const rr = 1 + 0.12 * Math.sin(t * 3 + ph) + 0.08 * (rng() - 0.5); const x = cx + Math.cos(t) * rx * rr, y = cy + Math.sin(t) * ry * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath();
        g.fillStyle = css(col, a); g.fill(); g.lineWidth = 2.2; g.strokeStyle = css(col.map(x => x * 0.72), a * 1.3); g.stroke(); };
      for (let i = 0; i < 26; i++) blob(rng() * W, rng() * H * 0.7, 50 + rng() * 120, 25 + rng() * 60, wc(rng() < 0.5 ? B.sky[0] : B.light, 0.3), 0.08 + rng() * 0.08);   // sky washes
      for (let i = 0; i < 4; i++) { const cx = 60 + rng() * (W - 120), cy = 50 + rng() * 140, s = 0.7 + rng() * 0.7;                                                     // cartoon clouds
        g.beginPath(); for (const [dx, dy, r] of [[-38, 6, 22], [-14, -8, 28], [16, -4, 25], [40, 8, 18], [0, 12, 24]]) { g.moveTo(cx + dx * s + r * s, cy + dy * s); g.arc(cx + dx * s, cy + dy * s, r * s, 0, 6.283); }
        g.fillStyle = 'rgba(253,248,234,0.85)'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = 'rgba(70,52,38,0.45)'; g.stroke(); g.fillStyle = 'rgba(253,248,234,1)'; g.fill(); }
      const hills = (base, amp, col, a) => { g.beginPath(); g.moveTo(0, H); let ph = rng() * 6.28, f = 0.006 + rng() * 0.006; for (let x = 0; x <= W; x += 8) g.lineTo(x, base - amp * (0.6 * Math.sin(x * f + ph) + 0.4 * Math.sin(x * f * 2.3 + ph * 1.7)) - amp * 0.5);
        g.lineTo(W, H); g.closePath(); g.fillStyle = css(col, a); g.fill(); g.lineWidth = 2.6; g.strokeStyle = css(col.map(x => x * 0.62), Math.min(1, a + 0.15)); g.stroke(); };
      const bl = B.blobs && B.blobs.length ? B.blobs : [B.sky[2]];
      hills(H * 0.62, 40, wc(bl[0], 0.45), 0.55); hills(H * 0.74, 34, wc(bl[1 % bl.length], 0.3), 0.7); hills(H * 0.86, 28, wc(bl[2 % bl.length], 0.18), 0.85);
      for (let i = 0; i < 18; i++) blob(rng() * W, H * 0.55 + rng() * H * 0.45, 30 + rng() * 70, 12 + rng() * 26, wc(rng.pick(bl), 0.25), 0.07 + rng() * 0.07, 10);   // blooms in the wash
      const im = g.getImageData(0, 0, W, H), D = im.data; for (let i = 0; i < D.length; i += 4) { const n = (rng() - 0.5) * 14; D[i] += n; D[i + 1] += n; D[i + 2] += n * 0.8; } g.putImageData(im, 0, 0);   // paper tooth
      return c;
    },
    /** Backdrop behind the tank: a deep, dusky gradient with soft out-of-focus orbs of light (the lens blur finishes it). */
    bgCanvas(id) {
      if (this.cup) return this.cupCanvas(id);
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
