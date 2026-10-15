/* Terrarium — HD-2D look (after Octopath Traveler): the 3D diorama is drawn at a low "pixel art" resolution with crisp
   nearest-neighbour pixels (decor, ground and critter sprites alike, with 1-pixel ink outlines and dithered, banded light),
   then finished at full screen resolution with the modern lens effects that define the style: tilt-shift / depth-of-field
   blur, warm bloom, light shafts, a cinematic colour grade and a heavy vignette.
   WebGL2 only (falls back to the storybook look on WebGL1). Settings → Graphics → Art style / Pixel size.

   v2 improvements:
     • Dual Kawase bloom replaces Gaussian bloom (wider, softer, fewer samples, CHEAPER).
     • Stepped / banded DoF reinforces diorama depth planes (3 bands, partial blend).
     • Screen-space depth-edge ink rim: warm by day, cool by night.
     • Coloured night bloom: cool-blue cast instead of white.
     • Chromatic aberration at the vignette edge (medium/high quality only).
     • Sub-pixel grid dither on the pixel boundary.
     • "Fine" pixel-size mode (0.8× render scale for high-DPI). */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M;
  const VS = `#version 300 es
in vec2 aXY; out vec2 vUV; void main(){ vUV=aXY*0.5+0.5; gl_Position=vec4(aXY,0.0,1.0); }`;
  // 2x2 box down-sample (half res)
  const DOWN_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec2 d=uTexel*0.5; o=(texture(uTex,vUV+vec2(-d.x,-d.y))+texture(uTex,vUV+vec2(d.x,-d.y))+texture(uTex,vUV+vec2(-d.x,d.y))+texture(uTex,vUV+vec2(d.x,d.y)))*0.25; }`;
  // separable 9-tap gaussian  (kept for DoF blur; bloom now uses Kawase)
  const BLUR_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){ vec4 s=texture(uTex,vUV)*0.2270;
  s+=(texture(uTex,vUV+uDir*1.3846)+texture(uTex,vUV-uDir*1.3846))*0.3162;
  s+=(texture(uTex,vUV+uDir*3.2308)+texture(uTex,vUV-uDir*3.2308))*0.0703; o=s; }`;
  // bright pass for bloom  — coloured at night (cool-blue cast)
  const BRIGHT_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform float uTh; uniform float uNight; out vec4 o;
void main(){
  vec3 c=texture(uTex,vUV).rgb;
  float l=max(c.r,max(c.g,c.b)); float k=smoothstep(uTh,uTh+0.25,l);
  // tint bloom toward cool blue at night
  vec3 tint=mix(vec3(1.0,0.94,0.82), vec3(0.72,0.88,1.18), uNight*0.8);
  o=vec4(c*k*tint,1.0); }`;
  // Dual Kawase down-sample pass (offset = iter+0.5 pixels)
  const KAWASE_DOWN_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uOff; out vec4 o;
void main(){
  float h=uOff+0.5;
  o=(texture(uTex,vUV+vec2(-h,-h)*uTexel)+texture(uTex,vUV+vec2( h,-h)*uTexel)+
     texture(uTex,vUV+vec2(-h, h)*uTexel)+texture(uTex,vUV+vec2( h, h)*uTexel))*0.25; }`;
  // Dual Kawase up-sample pass (tent filter, 8-tap)
  const KAWASE_UP_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uOff; out vec4 o;
void main(){
  float h=uOff+0.5;
  vec4 s =texture(uTex,vUV+vec2(-2.0*h,    0.0)*uTexel);
      s+=texture(uTex,vUV+vec2(-h,      -h )*uTexel)*2.0;
      s+=texture(uTex,vUV+vec2(  0.0,-2.0*h)*uTexel);
      s+=texture(uTex,vUV+vec2( h,      -h )*uTexel)*2.0;
      s+=texture(uTex,vUV+vec2( 2.0*h,   0.0)*uTexel);
      s+=texture(uTex,vUV+vec2( h,       h )*uTexel)*2.0;
      s+=texture(uTex,vUV+vec2(  0.0, 2.0*h)*uTexel);
      s+=texture(uTex,vUV+vec2(-h,       h )*uTexel)*2.0;
  o=s/12.0; }`;
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
  // --- depth of field: stepped bands for diorama planes ---
  float dc = d>0.99999 ? 1.0 : smoothstep(uDof.x, uDof.y, abs(d-uFocus.z));
  float ty = abs(uv.y-uFocus.y); float tc = smoothstep(0.12, 0.45, ty)*uTilt;
  float coc_raw = clamp(max(dc, tc), 0.0, 1.0)*uBlurK;
  // stepped DoF (3 bands) — reinforces the diorama depth-plane feel
  float coc_stepped = floor(coc_raw*3.0+0.5)/3.0;
  float coc = mix(coc_raw, coc_stepped, 0.62);
  vec3 c = mix(sharp, blur, coc);
  // --- sub-pixel grid dither on the pixel edge (keeps pixels crisp but softens aliasing) ---
  float edgeDither = (h21(gl_FragCoord.xy) - 0.5) * 0.010 * (1.0 - coc);
  c += edgeDither;
  // --- bloom (now from Dual Kawase; bloom colours already tinted in BRIGHT pass) ---
  // Energy-aware bloom: bright terrain must retain texture, not become a white wall.
  vec3 bl = texture(uBloom, uv).rgb;
  vec3 highlightRoom = vec3(1.0)-clamp(c,vec3(0.0),vec3(1.0));
  c += bl*highlightRoom*0.32*uFx;
  // --- screen-space depth-edge ink rim (warm day / cool night) ---
  ivec2 lpr=clamp(lp+ivec2(1,0), ivec2(0), ivec2(uLow)-1);
  ivec2 lpu=clamp(lp+ivec2(0,1), ivec2(0), ivec2(uLow)-1);
  float dR=texelFetch(uDepth, lpr, 0).r;
  float dU=texelFetch(uDepth, lpu, 0).r;
  float edge=clamp((abs(d-dR)+abs(d-dU))*110.0,0.0,1.0)*(1.0-coc)*(d<0.99999?1.0:0.0);
  vec3 inkCol=mix(vec3(1.0,0.60,0.22), vec3(0.30,0.52,1.0), uNight);
  c = mix(c, c*0.45+inkCol*0.13, edge*uFx);
  // --- light shafts falling from the sun side (slightly sharper noise) ---
  vec2 a = (uv-0.5)*vec2(uOut.x/uOut.y,1.0); vec2 sd = normalize(uSun); vec2 pr = vec2(-sd.y, sd.x);
  float across = dot(a, pr), along = dot(a, sd);
  float rays = vn(across*9.0+uTime*0.05)*vn(across*23.0-uTime*0.08+3.0);
  rays = smoothstep(0.18, 0.82, rays); // sharper contrast than before
  float lightRoom=1.0-smoothstep(0.5,0.95,max(c.r,max(c.g,c.b)));
  float rf = smoothstep(-0.2, 0.75, along); c += vec3(1.0,0.84,0.58)*rays*rf*0.18*uDay*uFx*lightRoom;
  c += vec3(1.0,0.86,0.62)*smoothstep(0.1,1.0,along)*0.09*uDay*uFx*lightRoom; // warm haze on the lit side
  // (no screen-wide motes: the engine's own dust motes and biome fireflies already float inside the tank)
  // --- colour grade: saturate, cool shadows, warm highlights, gentle filmic contrast ---
  float lum = dot(c, vec3(0.299,0.587,0.114));
  c = mix(vec3(lum), c, 1.16-0.3*uNight);
  c += vec3(-0.01,0.015,0.06)*(1.0-smoothstep(0.0,0.45,lum));
  c *= mix(vec3(1.0), vec3(1.06,1.0,0.9), smoothstep(0.45,1.0,lum));
  c = c*(1.0+c*0.12)/(1.0+c*0.12*0.9); c = clamp((c-0.5)*1.12+0.52, 0.0, 1.4);
  c = mix(c, c*vec3(0.85,0.92,1.08)+vec3(0.025,0.035,0.06), uNight*0.6);
  // --- chromatic aberration at the vignette edge (medium/high quality only) ---
  if (uFx > 0.9) {
    float ca = length(uv - 0.5) * 0.007;
    float rOff = texture(uBlur, uv + vec2( ca, 0.0)).r * coc + sharp.r * (1.0 - coc);
    float bOff = texture(uBlur, uv - vec2( ca, 0.0)).b * coc + sharp.b * (1.0 - coc);
    float edgeCA = smoothstep(0.30, 0.68, length(uv - 0.5));
    c = mix(c, vec3(rOff, c.g, bOff), edgeCA * 0.65);
  }
  // --- diorama glass frame bevel reflection & lip gleam ---
  vec2 edgeDist = min(uv, 1.0 - uv);
  float glassBorder = smoothstep(0.015, 0.002, edgeDist.x) + smoothstep(0.018, 0.002, edgeDist.y);
  float glassGleam = smoothstep(0.004, 0.001, abs(uv.y - 0.985)) * smoothstep(0.1, 0.9, uv.x);
  c += vec3(0.85, 0.95, 1.0) * (glassGleam * 0.22 + glassBorder * 0.06) * uFx;
  // --- micro-condensation gradient near bottom substrate ---
  float bottomMist = (1.0 - smoothstep(0.0, 0.11, uv.y)) * smoothstep(-0.2, 0.6, sin(uv.x * 38.0) * 0.2 + 0.8);
  c = mix(c, c * 0.88 + vec3(0.65, 0.78, 0.88) * 0.22, bottomMist * 0.35 * uFx);
  // --- vignette (heavier at the top and bottom, like a stage) ---
  vec2 q = (uv-0.5)*vec2(1.05,1.3); float vg = smoothstep(0.98, 0.28, length(q)); c *= mix(0.58, 1.0, vg);
  c += (h21(gl_FragCoord.xy+fract(uTime))-0.5)/255.0;
  o = vec4(c, 1.0); }`;

  const HD = {
    clear: [0.12, 0.13, 0.15],
    get art() { const a = JT.app; const s = a && a.settings; return s && s.art === 'storybook' ? 'storybook' : 'hd2d'; },
    get on() { const a = JT.app; const s = a && a.settings || (a && a.R && a.R.set); return !s || s.art !== 'storybook'; },
    _P: null,
    progs(gp) {
      if (this._P && this._P.gp === gp) return this._P;
      this._P = {
        gp,
        down:      gp.prog(VS, DOWN_FS),
        blur:      gp.prog(VS, BLUR_FS),
        bright:    gp.prog(VS, BRIGHT_FS),
        comp:      gp.prog(VS, COMP_FS),
        kawDown:   gp.prog(VS, KAWASE_DOWN_FS),
        kawUp:     gp.prog(VS, KAWASE_UP_FS),
      };
      return this._P;
    },
    tex(gl, w, h, ifmt, fmt, type, filt) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null); return t; },
    fbo(gl, ct, dt) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ct, 0); if (dt) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dt, 0); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; return ok ? f : null; },
    free(gl, T) { if (!T) return; for (const k of ['fb', 'fb2', 'fA', 'fB', 'fC', 'fD', 'fE', 'fF']) if (T[k]) gl.deleteFramebuffer(T[k]); for (const k of ['ct', 'dt', 'dt2', 'tA', 'tB', 'tC', 'tD', 'tE', 'tF']) if (T[k]) gl.deleteTexture(T[k]); },
    /** Render scale factor. "fine" = 0.8× (sub-pixel on hi-DPI), default = 1, "classic" = 1.2, "chunky" = 1.5. */
    pxSize(R) { const s = R.set || {}; return s.pixel === 'chunky' ? 1.5 : s.pixel === 'classic' ? 1.2 : s.pixel === 'fine' ? 0.8 : 1; },
    blurK(R) { const b = (R.set || {}).blur; return b === 'off' ? 0 : b === 'strong' ? 1 : 0.2; },
    sync(gp, on) { // art style switched: rebuild the generated textures and the still-camera cache
      const key = on ? 'hd' : 'off'; if (this._was === key) return; this._was = key;
      // Retire style-dependent textures explicitly rather than orphaning GPU resources.
      if (gp.bgT) { const retired = new Set(); for (const entry of Object.values(gp.bgT)) {
        for (const t of entry ? [entry.far, entry.mid, entry.t] : []) if (t && !retired.has(t)) { retired.add(t); gp.gl.deleteTexture(t); }
      } }
      if (gp.gT) { if (gp.gT.t) gp.gl.deleteTexture(gp.gT.t); if (gp.gT.s) gp.gl.deleteTexture(gp.gT.s); }
      gp.bgT = null; gp.gT = null; if (gp.cacheFree) gp.cacheFree(); if (gp.hg) gp.hg.key = null;
      const b = root.document && root.document.body; if (b) { b.classList.toggle('hd2d', key === 'hd'); b.classList.remove('art-sketch', 'art-ukiyo'); } },
    begin(gp, W, H) {
      const gl = gp.gl; const on = gp.gl2 && this.on && !gp._hdBroken; this.sync(gp, on); if (!on) { if (gp._hdT) { this.free(gl, gp._hdT); gp._hdT = null; } return null; }
      const f = M.clamp(1 / this.pxSize(gp.R), 0.08, 1); const w = Math.max(16, Math.round(W * f)), h = Math.max(16, Math.round(H * f));
      let T = gp._hdT;
      if (!T || T.w !== w || T.h !== h) { this.free(gl, T); try {
        T = { w, h, W, H };
        T.ct = this.tex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
        T.dt = this.tex(gl, w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
        T.fb = this.fbo(gl, T.ct, T.dt);
        T.dt2 = this.tex(gl, w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
        T.fb2 = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb2); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, T.dt2, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo2');
        // DoF blur buffers (half-res)
        T.hw = Math.max(4, Math.ceil(w / 2)); T.hh = Math.max(4, Math.ceil(h / 2));
        T.tA = this.tex(gl, T.hw, T.hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
        T.tB = this.tex(gl, T.hw, T.hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
        T.fA = this.fbo(gl, T.tA); T.fB = this.fbo(gl, T.tB);
        // Dual Kawase bloom buffers: two down levels + two up levels, all at quarter-res
        T.qw = Math.max(4, Math.ceil(w / 4)); T.qh = Math.max(4, Math.ceil(h / 4));
        T.tC = this.tex(gl, T.qw, T.qh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); // bright/kawase level 0
        T.tD = this.tex(gl, T.qw, T.qh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); // kawase ping-pong
        T.ew = Math.max(4, Math.ceil(w / 8)); T.eh = Math.max(4, Math.ceil(h / 8));
        T.tE = this.tex(gl, T.ew, T.eh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); // kawase level 1 down
        T.tF = this.tex(gl, T.ew, T.eh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); // kawase level 1 ping-pong
        T.fC = this.fbo(gl, T.tC); T.fD = this.fbo(gl, T.tD);
        T.fE = this.fbo(gl, T.tE); T.fF = this.fbo(gl, T.tF);
        if (!T.fb || !T.fA || !T.fB || !T.fC || !T.fD || !T.fE || !T.fF) throw new Error('fbo');
        this.progs(gp);
      } catch (e) { console.warn('HD-2D unavailable:', e && e.message); this.free(gl, T); gp._hdT = null; gp._hdBroken = true; gl.bindFramebuffer(gl.FRAMEBUFFER, null); this.sync(gp, false); return null; }
        gp._hdT = T; }
      T.f = w / W; gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); return T;
    },
    pass(gp, P, fb, w, h, tex, set) { const gl = gp.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h); gp.use(P); gl.bindBuffer(gl.ARRAY_BUFFER, gp.quad); gp.attribs(P, [['aXY', 2], ['uv_', 2]], 4);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(P.u.uTex, 0); if (set) set(P); gl.drawArrays(gl.TRIANGLES, 0, 6); },
    post(gp, V, hab, night, W, H) {
      const gl = gp.gl, T = gp._hdT, P = this.progs(gp); if (!T) return;
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND);

      // --- DoF: half-res down-sample + 1 or 2 Gaussian passes ---
      this.pass(gp, P.down, T.fA, T.hw, T.hh, T.ct, (p) => gl.uniform2f(p.u.uTexel, 1 / T.w, 1 / T.h));
      const bk = this.blurK(gp.R);
      for (const st of (bk === 0 ? [] : bk < 0.5 ? [1.0] : [1.0, 2.2])) {
        this.pass(gp, P.blur, T.fB, T.hw, T.hh, T.tA, (p) => gl.uniform2f(p.u.uDir, st / T.hw, 0));
        this.pass(gp, P.blur, T.fA, T.hw, T.hh, T.tB, (p) => gl.uniform2f(p.u.uDir, 0, st / T.hh)); }

      // --- Dual Kawase bloom  (down × 2 then up × 2, total 4 passes, 4 taps each = 16 samples vs the old 28) ---
      // Bright pass at quarter-res → tC; night threshold + night colour tint applied here
      const brightTh = night > 0.5 ? 0.38 : 0.55;
      const isLow = gp.R.quality === 'low' || JT.Device.tier === 'low';
      this.pass(gp, P.bright, T.fC, T.qw, T.qh, T.tA, (p) => { gl.uniform1f(p.u.uTh, brightTh); gl.uniform1f(p.u.uNight, M.clamp(night, 0, 1)); });
      // Down iteration: tC → tE (eighth-res), skip on low tier
      if (!isLow) {
        this.pass(gp, P.kawDown, T.fE, T.ew, T.eh, T.tC, (p) => { gl.uniform2f(p.u.uTexel, 1/T.qw, 1/T.qh); gl.uniform1f(p.u.uOff, 0); });
        // Up iteration: tE → tD (back to quarter-res)
        this.pass(gp, P.kawUp,   T.fD, T.qw, T.qh, T.tE, (p) => { gl.uniform2f(p.u.uTexel, 1/T.ew, 1/T.eh); gl.uniform1f(p.u.uOff, 0); });
        // Final up: tD → tC (stays quarter-res, wider spread)
        this.pass(gp, P.kawUp,   T.fC, T.qw, T.qh, T.tD, (p) => { gl.uniform2f(p.u.uTexel, 1/T.qw, 1/T.qh); gl.uniform1f(p.u.uOff, 1); });
      } else {
        // Low tier: single Kawase down-sample for a simple but still soft bloom
        this.pass(gp, P.kawDown, T.fD, T.qw, T.qh, T.tC, (p) => { gl.uniform2f(p.u.uTexel, 1/T.qw, 1/T.qh); gl.uniform1f(p.u.uOff, 1); });
        this.pass(gp, P.kawUp,   T.fC, T.qw, T.qh, T.tD, (p) => { gl.uniform2f(p.u.uTexel, 1/T.qw, 1/T.qh); gl.uniform1f(p.u.uOff, 0); });
      }

      // --- Composite to the screen ---
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
    /** Backdrop behind the tank: seamless 360-degree panoramic canvases for the HD-2D storybook world.
     *  layer='far'  → deep sky atmosphere, distant mountain ridges & horizon haze (moves at 0.35× parallax)
     *  layer='mid'  → painterly trees, rock formations, waterfalls/streams & dappled light (moves at 1.0× parallax)
     *  Both canvases are horizontally tileable (1536×512) for continuous 360° camera orbit. */
    bgCanvas(id, layer) {
      const B = JT.BACKGROUNDS[id] || JT.BACKGROUNDS.mossy;
      const W = 1536, H = 512;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      const seed = JT.hashStr('hd360_' + id + '_' + (layer || 'far'));
      const rng = JT.makeRng(seed);
      const rgbArr = (h) => JT.GLMesh && JT.GLMesh.rgb ? JT.GLMesh.rgb(h) : [0.5,0.5,0.5];
      const rgba = (h, k, a) => {
        const v = rgbArr(h);
        return 'rgba(' + Math.round(Math.min(255, v[0] * 255 * k)) + ',' +
                         Math.round(Math.min(255, v[1] * 255 * k)) + ',' +
                         Math.round(Math.min(255, v[2] * 255 * k)) + ',' + a + ')';
      };
      const radGlow = (x, y, r, col, k, a) => {
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0,   rgba(col, k, a));
        rg.addColorStop(0.5, rgba(col, k, a * 0.4));
        rg.addColorStop(1,   rgba(col, k, 0));
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      };

      if (!layer || layer === 'far') {
        // ── FAR LAYER: Panoramic atmospheric sky & distant mountain/canopy horizon ──
        const gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0,    rgba(B.sky[0], 0.65, 1));
        gr.addColorStop(0.48, rgba(B.sky[1], 0.78, 1));
        gr.addColorStop(1,    rgba(B.sky[2], 0.68, 1));
        g.fillStyle = gr; g.fillRect(0, 0, W, H);

        // Distant rolling mountain / hill ridges (smooth sine wave layers, horizontally seamless)
        for (let r = 0; r < 3; r++) {
          const ridgeY = H * (0.42 + r * 0.10);
          const ridgeCol = rgba(B.fog || B.sky[1], 0.55 + r * 0.15, 0.40 + r * 0.15);
          g.fillStyle = ridgeCol;
          g.beginPath();
          g.moveTo(0, H);
          for (let x = 0; x <= W; x += 16) {
            const t = (x / W) * Math.PI * 2;
            const hWave = Math.sin(t * (2 + r) + r * 1.3) * (24 - r * 6) +
                          Math.sin(t * (4 + r * 2) + r * 0.7) * (12 - r * 3);
            g.lineTo(x, ridgeY + hWave);
          }
          g.lineTo(W, H);
          g.closePath();
          g.fill();
        }

        // Soft horizon mist band
        const fogCol = B.fog || B.sky[1];
        const mist = g.createLinearGradient(0, H * 0.40, 0, H * 0.82);
        mist.addColorStop(0,   rgba(fogCol, 0.7, 0));
        mist.addColorStop(0.5, rgba(fogCol, 0.85, 0.35));
        mist.addColorStop(1,   rgba(fogCol, 0.6, 0.05));
        g.fillStyle = mist; g.fillRect(0, H * 0.40, W, H * 0.42);

        // Diffuse panoramic celestial glow / light source (wrapped seamlessly)
        g.globalCompositeOperation = 'lighter';
        const sunX = W * 0.32;
        radGlow(sunX, H * 0.28, H * 0.75, B.light, 0.95, 0.12 * (B.shafts || 0.5));
        radGlow(W * 0.78, H * 0.38, H * 0.45, B.light, 0.80, 0.06 * (B.shafts || 0.5));
        g.globalCompositeOperation = 'source-over';

      } else {
        // ── MID LAYER: Painted 360° storybook environment masses on transparent base ──
        g.clearRect(0, 0, W, H);

        // Function to draw seamless organic painterly blobs (wrapped horizontally)
        const drawBlob = (cx, cy, r, col, a, sq) => {
          const v = rgbArr(col);
          const colStr = 'rgba(' + Math.round(v[0]*225) + ',' + Math.round(v[1]*225) + ',' + Math.round(v[2]*225) + ',' + a.toFixed(3) + ')';
          // Draw at cx and also wrapped at cx - W and cx + W for perfect horizontal tiling
          for (const ox of [0, -W, W]) {
            const x = cx + ox;
            if (x + r < -50 || x - r > W + 50) continue;
            g.save();
            g.translate(x, cy);
            g.scale(1, sq);
            g.beginPath();
            const segs = 10;
            const pts = [];
            const rSeed = Math.abs(Math.sin(cx * 0.01 + cy * 0.02)) * 999;
            for (let k = 0; k < segs; k++) {
              const ang = (k / segs) * Math.PI * 2;
              const kr = 1 + 0.30 * Math.sin(ang * 3 + rSeed);
              pts.push([Math.cos(ang) * r * kr, Math.sin(ang) * r * kr]);
            }
            g.moveTo((pts[0][0] + pts[segs-1][0]) / 2, (pts[0][1] + pts[segs-1][1]) / 2);
            for (let k = 0; k < segs; k++) {
              const p = pts[k], q = pts[(k + 1) % segs];
              g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
            }
            g.closePath();
            g.fillStyle = colStr;
            g.fill();
            g.restore();
          }
        };

        // Midground environment silhouettes: 42 organic painted masses forming 360° world
        const blobPalette = B.blobs || ['#2a4020','#3e6030','#548040'];
        for (let i = 0; i < 48; i++) {
          const cx = rng() * W;
          const cy = H * (0.28 + 0.52 * rng());
          const r = 45 + 135 * rng();
          const col = blobPalette[Math.floor(rng() * blobPalette.length)];
          const a = 0.16 + 0.22 * rng();
          const sq = 0.65 + 0.45 * rng();
          drawBlob(cx, cy, r, col, a, sq);
        }

        // Waterfall / Stream vertical cascade for water biomes (rendered on right sector)
        if (B.mood === 'river' || B.mood === 'waterfall' || B.mood === 'pond') {
          const wfX = W * 0.22;
          const wfGrad = g.createLinearGradient(wfX, H * 0.25, wfX, H * 0.85);
          wfGrad.addColorStop(0,   rgba('#e6ffff', 0.9, 0.45));
          wfGrad.addColorStop(0.6, rgba('#a0e6e6', 0.85, 0.55));
          wfGrad.addColorStop(1,   rgba('#40a0a0', 0.7, 0.15));
          g.fillStyle = wfGrad;
          g.beginPath();
          g.moveTo(wfX - 12, H * 0.25);
          g.lineTo(wfX + 16, H * 0.25);
          g.lineTo(wfX + 28, H * 0.85);
          g.lineTo(wfX - 22, H * 0.85);
          g.closePath();
          g.fill();
          // Waterfall splash foam & mist
          radGlow(wfX + 4, H * 0.82, 55, '#ffffff', 1.0, 0.25);
          radGlow(wfX + 4, H * 0.82, 95, B.light, 0.8, 0.15);
        }

        // Bamboo / Tree vertical trunks for woodland/bamboo biomes
        if (B.mood === 'bamboo' || B.mood === 'jungle' || B.mood === 'primeval') {
          g.fillStyle = rgba(B.near ? B.near[0] : '#142010', 0.7, 0.35);
          for (let k = 0; k < 22; k++) {
            const bx = (k * 73 + 15) % W;
            const bw = 4 + (k % 4) * 3;
            g.fillRect(bx, H * 0.22, bw, H * 0.78);
          }
        }

        // Dark foreground framing masses hugging bottom quarter (grounding horizon)
        if (B.near) {
          for (let i = 0; i < 24; i++) {
            const cx = rng() * W;
            const cy = H * (0.64 + 0.32 * rng());
            const r = 35 + 85 * rng();
            const col = B.near[i % B.near.length];
            drawBlob(cx, cy, r, col, 0.30 + 0.22 * rng(), 0.55);
          }
        }

        // Dappled light orbs, fireflies & sun specks (additive glows)
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 14; i++) {
          const lx = rng() * W;
          const ly = H * (0.18 + 0.60 * rng());
          const lr = 12 + 32 * rng();
          radGlow(lx, ly, lr, B.light, 0.95, 0.04 + 0.06 * rng());
        }
        g.globalCompositeOperation = 'source-over';
      }
      return c;
    },
  };
  JT.HD2D = HD;
})(typeof window !== 'undefined' ? window : globalThis);


