/* Jumper Terrarium — storybook renderer, part 2: WebGL painter. Draws the whole terrarium as ink-and-watercolour:
   cream paper, soft washes, wobbly ink outlines. Decor and plants are real 3D meshes (built once), so turning the
   camera is cheap; critters are drawn with the 2D art code into a sprite sheet each frame and placed in the 3D scene
   (depth tested, so leaves in front of them hide them), then given an ink edge. */
(function (root) {
  'use strict';
  const JT = root.JT, M = JT.M, G = JT.G, GM = JT.GLMesh;
  const PROJ = `
uniform vec3 uC; uniform vec4 uRot; uniform vec4 uScr; uniform vec2 uRes;
vec3 proj(vec3 p){ vec3 d=p-uC; float xr=d.x*uRot.x-d.z*uRot.y; float zr=d.x*uRot.y+d.z*uRot.x; return vec3(uScr.y+xr*uScr.x, uScr.z-(d.y*uRot.z+zr*uRot.w)*uScr.x, zr*uRot.z-d.y*uRot.w); }
vec2 projd(vec3 v){ float xr=v.x*uRot.x-v.z*uRot.y; float zr=v.x*uRot.y+v.z*uRot.x; return vec2(xr, -(v.y*uRot.z+zr*uRot.w)); }
vec4 clip(vec3 q){ return vec4(q.x/uRes.x*2.0-1.0, 1.0-q.y/uRes.y*2.0, clamp(q.z*0.0011, -0.999, 0.999), 1.0); }`;
  const LAMPS = `
uniform vec4 uLamp[4]; uniform float uNL; uniform vec3 uGrade; uniform float uNight;
vec3 lampLight(vec3 wp){ vec3 s=vec3(0.0); for(int i=0;i<4;i++){ if(float(i)<uNL){ vec3 d=wp-uLamp[i].xyz; float a=clamp(1.0-length(d)/uLamp[i].w,0.0,1.0); s+=vec3(a*a); } } return s*vec3(1.0,0.72,0.42); }
vec3 grade(vec3 c, vec3 wp){ return c*uGrade + c*lampLight(wp)*(0.25+1.05*uNight); }`;
  const MESH_VS = `
attribute vec3 aP; attribute vec3 aN; attribute vec3 aO; attribute vec3 aC; attribute vec3 aC2; attribute float aW; attribute float aF;
uniform vec3 uSway; uniform float uOut; uniform float uPass; ${PROJ}
varying vec3 vN; varying vec3 vC; varying vec3 vC2; varying vec3 vWP; varying float vF;
void main(){ vec3 p=aP+uSway*aW; vec3 q=proj(p);
  if(uPass>0.5 && uPass<1.5){ float wob=0.78+0.24*(sin(p.x*0.9+p.y*1.3)+sin(p.z*1.1-p.y*0.7)); q.xy+=projd(aO)*uOut*wob; q.z+=1.8; }
  vN=aN; vC=aC; vC2=aC2; vWP=p; vF=aF; gl_Position=clip(q); }`;
  const MESH_FS = `
precision highp float;
varying vec3 vN; varying vec3 vC; varying vec3 vC2; varying vec3 vWP; varying float vF;
uniform vec3 uL; uniform vec3 uKeyC; uniform vec3 uAmbC; uniform float uKD; uniform vec3 uToCam; uniform sampler2D uNoise; uniform float uPass; uniform vec3 uInk; uniform float uAlpha; uniform vec4 uGhost; uniform vec3 uSoil; uniform vec2 uGnd; ${LAMPS}
void main(){
  if(vWP.y<-0.05) discard;
  if(uPass>0.5){ float ia=uAlpha; gl_FragColor=vec4(uInk*mix(1.0,0.75,uNight)*ia, ia); return; }
  float f=vF; float pat=mod(f,8.0); float two=mod(floor(f/8.0),2.0); float glow=floor(f/16.0);
  vec3 n=normalize(vN); float back=0.0; if(two>0.5 && dot(n,uToCam)<0.0){ n=-n; back=1.0; }
  float ndl=dot(n,uL); float dl=smoothstep(-0.25,0.55,ndl); float lit=0.62+(0.38*dl+0.07*smoothstep(0.7,0.95,ndl))*uKD+0.19*(1.0-uKD);
  vec3 col=vC;
  vec2 uv = abs(n.y)>0.6 ? vWP.xz : (abs(n.x)>abs(n.z) ? vWP.zy : vWP.xy);
  vec4 nz=texture2D(uNoise, uv*0.045);
  if(pat>0.5){ float m=0.0;
    if(pat<1.5) m=smoothstep(0.6,0.72,texture2D(uNoise, uv*0.17).r)*0.65;
    else if(pat<2.5) m=smoothstep(0.72,0.95, sin(vWP.y*1.7+nz.g*5.0)*0.5+0.5)*0.55;
    else if(pat<3.5) m=smoothstep(0.78,0.97, sin((uv.x*0.9+uv.y*0.12)*2.2+nz.b*6.0)*0.5+0.5)*0.5;
    else if(pat<4.5) m=smoothstep(0.5,0.72,texture2D(uNoise, uv*0.25).g)*0.5;
    else m=smoothstep(0.58,0.7,texture2D(uNoise, uv*0.32).b)*0.55;
    col=mix(col, vC2, m); }
  col*=lit*mix(uAmbC, uKeyC, dl*uKD); if(back>0.5) col=mix(col, vec3(0.93,0.95,0.82), 0.12);
  float fr=1.0-abs(dot(n,uToCam)); col*=1.0-0.22*fr*fr*fr;
  col*=0.9+0.2*nz.r;
  col=mix(col, vec3(0.95,0.91,0.82), 0.07);
  if(uGnd.x>0.5){ float hb=vWP.y-uGnd.y; col*=mix(0.6,1.0,smoothstep(0.0,4.5,hb)); col=mix(col, uSoil, (1.0-smoothstep(0.3,2.6,hb))*0.55*step(uGnd.y,0.01)); }
  vec3 o=grade(col, vWP);
  if(glow>0.5) o=mix(o, mix(vC,vC2,0.6)*(0.8+0.25*fr), uNight*0.8);
  o=mix(o, uGhost.rgb, uGhost.a);
  float A=uAlpha;
  gl_FragColor=vec4(o*A, A); }`;
  const TEX_VS = `attribute vec3 aP; attribute vec2 aUV; uniform float uZ; ${PROJ}
varying vec2 vUV; varying vec3 vWP; void main(){ vec3 q=proj(aP); q.z+=uZ; vUV=aUV; vWP=aP; gl_Position=clip(q); }`;
  const TEX_FS = `precision highp float; varying vec2 vUV; varying vec3 vWP; uniform sampler2D uTex; uniform vec4 uCol; uniform float uLit; ${LAMPS}
void main(){ vec4 t=texture2D(uTex,vUV)*uCol; vec3 c=t.rgb; if(uLit>0.5) c=grade(c, vWP); gl_FragColor=vec4(c*t.a, t.a); }`;
  const MOUND_VS = `attribute vec3 aP; attribute vec2 aUV; attribute float aA; attribute float aS; ${PROJ}
varying vec2 vUV; varying vec3 vWP; varying float vA; varying float vS; void main(){ vec3 q=proj(aP); vUV=aUV; vWP=aP; vA=aA; vS=aS; gl_Position=clip(q); }`;
  const MOUND_FS = `precision highp float; varying vec2 vUV; varying vec3 vWP; varying float vA; varying float vS; uniform sampler2D uTex; uniform sampler2D uNoise; ${LAMPS}
void main(){ vec3 c=texture2D(uTex,vUV).rgb*vS; float n=texture2D(uNoise, vWP.xz*0.11).r; float a=vA*smoothstep(0.0,0.55,vA+(n-0.5)*0.5); a=clamp(a,0.0,1.0); c=grade(c, vWP); gl_FragColor=vec4(c*a,a); }`;
  // v15 terrain: wet hollows (darker, slightly glossy where water collects) and ground marks (footprints, burrow mounds, mist pools)
  const WET_VS = `attribute vec3 aP; attribute vec2 aUV; attribute float aW; ${PROJ}
varying vec2 vUV; varying vec3 vWP; varying float vW; void main(){ vec3 q=proj(aP); vUV=aUV; vWP=aP; vW=aW; gl_Position=clip(q); }`;
  const WET_FS = `precision highp float; varying vec2 vUV; varying vec3 vWP; varying float vW; uniform sampler2D uTex; uniform sampler2D uNoise; uniform float uAm; ${LAMPS}
void main(){ float n=texture2D(uNoise, vWP.xz*0.07).g; float a=smoothstep(0.15,0.75,vW+(n-0.5)*0.35)*uAm; if(a<0.004) discard; vec3 c=texture2D(uTex,vUV).rgb*vec3(0.5,0.53,0.58);
  c=grade(c, vWP); gl_FragColor=vec4(c*a,a); }`;
  const MARK_VS = `attribute vec3 aP; attribute vec2 aUV; attribute vec4 aC; attribute float aK; ${PROJ}
varying vec2 vUV; varying vec3 vWP; varying vec4 vC; varying float vK; void main(){ vec3 q=proj(aP); q.z-=2.0; vUV=aUV; vWP=aP; vC=aC; vK=aK; gl_Position=clip(q); }`;
  const MARK_FS = `precision highp float; varying vec2 vUV; varying vec3 vWP; varying vec4 vC; varying float vK; uniform sampler2D uNoise; ${LAMPS}
void main(){ vec2 d=vUV*2.0-1.0; float n=texture2D(uNoise, vWP.xz*0.23).r; float r=length(d)*(0.86+0.28*n); float a;
  if(vK<0.5) a=1.0-smoothstep(0.3,1.0,r); else if(vK<1.5) a=smoothstep(0.42,0.72,r)*(1.0-smoothstep(0.78,1.0,r)); else a=1.0-smoothstep(0.7,1.0,r);
  if(a<0.004) discard; vec3 c=vC.rgb;
  if(vK>1.5){ float hl=1.0-smoothstep(0.0,0.45,length(d-vec2(-0.32,-0.3))); c=mix(c*0.82, c, smoothstep(0.35,0.95,r)); c=mix(c, vec3(0.9,0.95,0.97), hl*0.55); }
  c=grade(c, vWP); float A=a*vC.a; gl_FragColor=vec4(c*A,A); }`;
  const SCR_VS = `attribute vec2 aXY; attribute vec2 aUV; varying vec2 vUV; void main(){ vUV=aUV; gl_Position=vec4(aXY,0.999,1.0); }`;
  const SCR_FS = `precision highp float; varying vec2 vUV; uniform sampler2D uTex; uniform vec4 uCol; uniform float uMode; uniform vec2 uRes; uniform vec2 uJit;
void main(){ if(uMode<0.5){ vec4 t=texture2D(uTex,vUV); gl_FragColor=vec4(t.rgb*uCol.rgb,1.0); return; }
  vec2 px=vUV*uRes; float g=texture2D(uTex, (px+uJit)/256.0).r; float g2=texture2D(uTex, px/731.0+vec2(0.37,0.11)).g;
  vec2 d=vUV-0.5; float vig=1.0-smoothstep(0.35,0.85,length(d*vec2(1.0,1.15)))*uCol.a;
  float m=(0.9+0.1*g)*(0.95+0.05*g2)*vig; gl_FragColor=vec4(vec3(m)*uCol.rgb,1.0); }`;
  const SPR_VS = `attribute vec2 aXY; attribute float aZ; attribute vec2 aUV; attribute vec4 aT; uniform vec2 uRes; varying vec2 vUV; varying vec4 vT;
void main(){ vUV=aUV; vT=aT; gl_Position=vec4(aXY.x/uRes.x*2.0-1.0, 1.0-aXY.y/uRes.y*2.0, clamp(aZ*0.0011,-0.999,0.999), 1.0); }`;
  const SPR_FS = `precision highp float; varying vec2 vUV; varying vec4 vT; uniform sampler2D uTex; uniform vec2 uTexel; uniform vec3 uInk; uniform float uInkAmt; uniform float uAlpha; uniform float uPm;
void main(){ vec4 c=texture2D(uTex,vUV); if(uPm>0.5) c.rgb*=c.a; vec2 d=uTexel*1.3;
  float an=max(max(texture2D(uTex,vUV+vec2(d.x,0.0)).a, texture2D(uTex,vUV-vec2(d.x,0.0)).a), max(texture2D(uTex,vUV+vec2(0.0,d.y)).a, texture2D(uTex,vUV-vec2(0.0,d.y)).a));
  float ink=smoothstep(0.3,0.75,an)*(1.0-smoothstep(0.05,0.6,c.a))*uInkAmt;
  vec3 rgb=c.rgb*vT.rgb + uInk*ink*(1.0-c.a); float a=c.a+ink*(1.0-c.a);
  gl_FragColor=vec4(rgb,a)*vT.a*uAlpha; }`;
  const LINE_VS = `attribute vec3 aA; attribute vec3 aB; attribute vec2 aS; attribute float aW; attribute float aAl; attribute vec3 aCol; attribute vec2 aSw;
uniform vec3 uSway; uniform float uLW; uniform float uMinW; ${PROJ}
varying vec4 vC; varying vec3 vWP;
void main(){ vec3 pa=aA+uSway*aSw.x, pb=aB+uSway*aSw.y; vec3 qa=proj(pa), qb=proj(pb); vec2 dir=qb.xy-qa.xy; float l=length(dir); dir = l>1e-4 ? dir/l : vec2(1.0,0.0);
  vec2 nr=vec2(-dir.y,dir.x); float w=max(aW*uLW, uMinW); vec3 q=mix(qa,qb,aS.y); q.xy+=nr*aS.x*w*0.5+dir*(aS.y*2.0-1.0)*w*0.35; q.z-=0.25; vC=vec4(aCol,aAl); vWP=mix(pa,pb,aS.y); gl_Position=clip(q); }`;
  const LINE_FS = `precision highp float; varying vec4 vC; varying vec3 vWP; uniform float uAlpha; uniform float uLitL; ${LAMPS}
void main(){ vec3 c=vC.rgb; if(uLitL>0.5) c=grade(c,vWP); else c*=mix(1.0,0.75,uNight); float a=vC.a*uAlpha; gl_FragColor=vec4(c*a,a); }`;

  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  const PAPER = [0.945, 0.905, 0.815];
  const PT0 = (G0) => (G0.R.set.perf ? G0.R.set : {});
  const NEUTRAL = { kd: 1, key: [1, 1, 1], amb: [1, 1, 1] };
  const hexRGB = (h) => GM.rgb(h);
  const toHex = (c) => '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0')).join('');
  const towardPaper = (h, t) => { const c = hexRGB(h); return toHex([c[0] + (PAPER[0] - c[0]) * t, c[1] + (PAPER[1] - c[1]) * t, c[2] + (PAPER[2] - c[2]) * t]); };

  // v1.3 still-camera cache: copy colour + depth of the cached static layer onto the screen (WebGL2)
  const BLIT_VS = `#version 300 es
in vec2 aXY; void main(){ gl_Position=vec4(aXY,0.5,1.0); }`;
  const BLIT_FS = `#version 300 es
precision highp float; uniform sampler2D uCol; uniform highp sampler2D uDep; out vec4 oC;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); oC=texelFetch(uCol,p,0); gl_FragDepth=texelFetch(uDep,p,0).r; }`;

  class GLPaint {
    constructor(canvas, R) {
      const opts = { alpha: false, antialias: true, premultipliedAlpha: true, depth: true, stencil: false, powerPreference: 'high-performance' };
      const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) throw new Error('no webgl');
      this.gl = gl; this.cv = canvas; this.R = R; this.gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      this.uintOK = this.gl2 || !!gl.getExtension('OES_element_index_uint');
      this.P = {
        mesh: this.prog(MESH_VS, MESH_FS), tex: this.prog(TEX_VS, TEX_FS), scr: this.prog(SCR_VS, SCR_FS), spr: this.prog(SPR_VS, SPR_FS), line: this.prog(LINE_VS, LINE_FS), mound: this.prog(MOUND_VS, MOUND_FS), wet: this.prog(WET_VS, WET_FS), mark: this.prog(MARK_VS, MARK_FS),
      };
      this.tex = { noise: this.texFrom(this.noiseCanvas(), true), paper: this.texFrom(this.paperCanvas(), true), radial: this.texFrom(this.radialCanvas(), false) };
      this.bufs = {}; this.atlas = mkCanvas(1024, 256); this.actx = this.atlas.getContext('2d'); this.atex = gl.createTexture();
      this.V2 = new JT.View(0, 0, 1, 0, 0, [0, 0, 0]); this.dyn = {}; this.lost = false;
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
      canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.reinit = true; });
      const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, 1, 1, 1, 0, -1, -1, 0, 1, 1, 1, 1, 0, -1, 1, 0, 0]), gl.STATIC_DRAW); this.quad = q;
    }
    // ---------- v1.3 still-camera cache ----------
    cacheFree(dead) { const gl = this.gl, C = this._cache; if (C) { for (const k of ['ms', 'rs']) if (C[k]) gl.deleteFramebuffer(C[k]); for (const k of ['crb', 'drb']) if (C[k]) gl.deleteRenderbuffer(C[k]); for (const k of ['ct', 'dt']) if (C[k]) gl.deleteTexture(C[k]); }
      this._cache = dead ? { dead: true } : null; }
    cacheAlloc(W, H) {
      const gl = this.gl; this.cacheFree(); const C = { W, H, key: null };
      try {
        if (!this.P.blit) this.P.blit = this.prog(BLIT_VS, BLIT_FS);
        const ns = Math.max(0, Math.min(4, gl.getParameter(gl.MAX_SAMPLES) | 0)); const aa = gl.getContextAttributes && gl.getContextAttributes().antialias ? ns : 0;
        C.crb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, C.crb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, aa, gl.RGBA8, W, H);
        C.drb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, C.drb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, aa, gl.DEPTH_COMPONENT24, W, H);
        C.ms = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, C.ms); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, C.crb); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, C.drb);
        const ok1 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        const tx = (ifmt, fmt, type) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, W, H, 0, fmt, type, null); return t; };
        C.ct = tx(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE); C.dt = tx(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
        C.rs = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, C.rs); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, C.ct, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, C.dt, 0);
        const ok2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        this._cache = C; if (!ok1 || !ok2) { this.cacheFree(true); return null; }
        return C;
      } catch (e) { if (JT.DEV) console.warn('cache', e); try { gl.bindFramebuffer(gl.FRAMEBUFFER, null); } catch (e2) { /* ignore */ } this._cache = C; this.cacheFree(true); return null; }
    }
    /** 'direct' (draw everything), 'build' (repaint the cached static layer, then use it) or 'blit' (reuse it as is). */
    cacheMode(V, hab, hg, gt, PT, live, night, W, H) {
      const gl = this.gl; const R = this.R;
      if (!this.gl2 || PT.ptNoCache || R.ghost || (this._cache && this._cache.dead)) return 'direct';
      const vk = V.yaw + ',' + V.pitch + ',' + V.s + ',' + V.cx + ',' + V.cy + ',' + V.c[0] + ',' + V.c[1] + ',' + V.c[2] + ',' + W + 'x' + H;
      const now = performance.now(); if (this._cache && !this._cache.dead && now - (this._cache.used || now) > 15000) this.cacheFree(); // camera kept moving (follow): give the memory back
      if (vk !== this._cvk) { this._cvk = vk; this._still = 0; return 'direct'; }
      this._still = (this._still || 0) + 1;
      // the inputs of every static pass. Light and colour grade drift slowly with the time of day: the cached layer is kept until
      // they have moved ~1% (or anything at all for over a second), so dusk still glides but the layer isn't repainted every frame.
      const F = this.F, SK = F.sky || NEUTRAL, L = JT.LIGHT;
      const TR = JT.Terrain; const tm = hg.ter && !PT.ptNoTer ? this.terrainMesh(hab, hg) : null; const gm = TR ? this.groundMarks(hab, night) : null;
      const wet = TR ? (TR.WET[hab.data.substrate] || 0) * M.clamp((hab.data.humidity - 0.35) / 0.6, 0, 1) : 0; const WFw = this._wxF, rw = WFw && WFw.hab === hab ? WFw.wet || 0 : 0;
      const key = vk + '|' + hg.key + '|' + hab.data.bg + '|' + gt.key + '|' + F.lamps.length + '|' + (tm ? tm.lk + ':' + tm.n : '-') + '|' + Math.round(wet * 100) + ',' + Math.round(rw * 100)
        + '|' + (gm && gm.n ? gm.t + ':' + gm.sig + ':' + gm.n : '-') + '|' + (hg.csKey || '') + '|' + (PT.ptNoInk ? 1 : 0) + '|' + live.map(o => o.inst.id).join(',');
      const soft = [F.grade[0], F.grade[1], F.grade[2], night, SK.kd, SK.key[0], SK.key[1], SK.key[2], SK.amb[0], SK.amb[1], SK.amb[2], L[0], L[1], L[2]]; for (let i = 0; i < F.lampU.length; i++) soft.push(F.lampU[i]);
      let C = this._cache;
      if (C && C.key === key && C.W === W && C.H === H && C.soft && C.soft.length === soft.length) { let d = 0; for (let i = 0; i < soft.length; i++) d = Math.max(d, Math.abs(soft[i] - C.soft[i]));
        if (d <= 3 / 256 && !(d > 0.5 / 256 && now - C.t > 1000)) { C.used = now; return 'blit'; } }
      if (this._still < 2) return 'direct'; // the camera has to rest a moment first
      if (!C || C.W !== W || C.H !== H) { C = this.cacheAlloc(W, H); if (!C) return 'direct'; }
      C.soft = soft; C.t = now;
      C.key = key; C.used = now; C.builds = (C.builds || 0) + 1; return 'build';
    }
    // ---------- GL plumbing ----------
    prog(vs, fs) {
      const gl = this.gl; const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
      const P = { p, a: {}, u: {} }; const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); P.a[a.name] = gl.getAttribLocation(p, a.name); }
      const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nu; i++) { const u = gl.getActiveUniform(p, i); const nm = u.name.replace(/\[0\]$/, ''); P.u[nm] = gl.getUniformLocation(p, u.name); }
      return P;
    }
    use(P) { if (this.cur === P) return P; const gl = this.gl; if (this.cur) for (const k in this.cur.a) gl.disableVertexAttribArray(this.cur.a[k]); gl.useProgram(P.p); this.cur = P; return P; }
    attribs(P, layout, stride) { const gl = this.gl; let off = 0; for (const [nm, n] of layout) { const loc = P.a[nm]; if (loc != null && loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride * 4, off * 4); } off += n; } }
    texFrom(cv, repeat) { const gl = this.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); this.texParams(repeat); return t; }
    texParams(repeat, mip) { const gl = this.gl; const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); }
    buf(data, kind) { const gl = this.gl; const b = gl.createBuffer(); const t = kind === 'idx' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER; gl.bindBuffer(t, b); gl.bufferData(t, data, gl.STATIC_DRAW); return b; }
    view(P, V) { const gl = this.gl; gl.uniform3f(P.u.uC, V.c[0], V.c[1], V.c[2]); gl.uniform4f(P.u.uRot, V.cy_, V.sy_, V.cp, V.sp); gl.uniform4f(P.u.uScr, V.s, V.cx, V.cy, 0); const r = this._res; gl.uniform2f(P.u.uRes, r ? r[0] : this.cv.width, r ? r[1] : this.cv.height); }
    light(P) { const gl = this.gl; const F = this.F; if (P.u.uGrade) gl.uniform3f(P.u.uGrade, F.grade[0], F.grade[1], F.grade[2]); if (P.u.uNight) gl.uniform1f(P.u.uNight, F.night); if (P.u.uNL) gl.uniform1f(P.u.uNL, F.lamps.length / 4); if (P.u.uLamp) gl.uniform4fv(P.u.uLamp, F.lampU); const S = F.sky || NEUTRAL; if (P.u.uKD) gl.uniform1f(P.u.uKD, S.kd); if (P.u.uKeyC) gl.uniform3f(P.u.uKeyC, S.key[0], S.key[1], S.key[2]); if (P.u.uAmbC) gl.uniform3f(P.u.uAmbC, S.amb[0], S.amb[1], S.amb[2]); }

    // ---------- generated textures ----------
    noiseCanvas() { // tileable value noise, a different octave mix in each channel
      const N = 256, c = mkCanvas(N, N), g = c.getContext('2d'), id = g.createImageData(N, N); const rng = JT.makeRng(99);
      const grid = (s) => { const a = []; for (let i = 0; i < s * s; i++) a.push(rng()); return (x, y) => { const X = x * s, Y = y * s; const x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0; const at = (i, j) => a[((j % s + s) % s) * s + ((i % s + s) % s)]; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return M.lerp(M.lerp(at(x0, y0), at(x0 + 1, y0), sx), M.lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx), sy); }; };
      const o = [grid(4), grid(8), grid(16), grid(32), grid(64)];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N, v = y / N, i = (y * N + x) * 4;
        id.data[i] = (o[1](u, v) * 0.5 + o[2](u, v) * 0.3 + o[3](u, v) * 0.2) * 255; id.data[i + 1] = (o[0](u, v) * 0.55 + o[1](u, v) * 0.3 + o[3](u, v) * 0.15) * 255; id.data[i + 2] = (o[2](u, v) * 0.4 + o[3](u, v) * 0.35 + o[4](u, v) * 0.25) * 255; id.data[i + 3] = 255; }
      g.putImageData(id, 0, 0); return c;
    }
    paperCanvas() { // paper grain + a few fibres
      const N = 256, c = mkCanvas(N, N), g = c.getContext('2d'), id = g.createImageData(N, N); const rng = JT.makeRng(5);
      for (let i = 0; i < N * N; i++) { const v = 200 + rng() * 55; id.data[i * 4] = v; id.data[i * 4 + 1] = 230 + rng() * 25; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
      g.putImageData(id, 0, 0); g.globalAlpha = 0.25; g.strokeStyle = '#b8b8b8'; g.lineWidth = 0.6;
      for (let k = 0; k < 70; k++) { const x = rng() * N, y = rng() * N, a = rng() * 6.28, l = 4 + rng() * 14; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      g.globalAlpha = 0.5; g.filter = 'blur(0.6px)'; g.drawImage(c, 0, 0); return c;
    }
    radialCanvas() { const c = mkCanvas(128, 128), g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c; }
    /** Watercolour wash helper on a 2D canvas: soft blob with a darker pigment edge. */
    wash(g, x, y, r, col, a, rng, sq) {
      sq = sq || 1; g.save(); g.translate(x, y); g.scale(1, sq); g.beginPath(); const n = 11; const pts = [];
      for (let i = 0; i < n; i++) { const t = i / n * 6.283; const k = 1 + (rng() - 0.5) * 0.28; pts.push([Math.cos(t) * r * k, Math.sin(t) * r * k]); }
      for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (!i) g.moveTo(m[0], m[1]); else g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
      const p = pts[0], q = pts[1]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); g.closePath();
      g.globalAlpha = a; g.fillStyle = col; g.fill(); g.globalAlpha = a * 0.35; g.strokeStyle = col; g.lineWidth = Math.max(1, r * 0.035); g.stroke(); g.restore(); g.globalAlpha = 1;
    }
    bgTexture(id) {
      this.bgT = this.bgT || {}; if (this.bgT[id]) return this.bgT[id];
      const B = JT.BACKGROUNDS[id] || JT.BACKGROUNDS.mossy; const W = 768, H = 512; const c = mkCanvas(W, H), g = c.getContext('2d'); const rng = JT.makeRng(JT.hashStr('bg' + id));
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, towardPaper(B.sky[0], 0.8)); gr.addColorStop(0.6, towardPaper(B.sky[1], 0.78)); gr.addColorStop(1, towardPaper(B.sky[2], 0.74)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) this.wash(g, rng() * W, rng() * H * 0.9, 30 + rng() * 90, towardPaper(rng.pick(B.blobs), 0.5 + rng() * 0.2), 0.12 + rng() * 0.12, rng, 0.75 + rng() * 0.4);
      for (let i = 0; i < 10; i++) this.wash(g, rng() * W, rng() * H * 0.6, 6 + rng() * 14, towardPaper(B.light, 0.3), 0.18, rng);
      return (this.bgT[id] = this.texFrom(c, false));
    }
    groundTexture(hab) {
      const S = JT.SUBSTRATES[hab.data.substrate] || JT.SUBSTRATES.coco; const key = hab.data.substrate + '|' + hab.data.type + '|' + hab.dims.w + 'x' + hab.dims.d;
      if (this.gT && this.gT.key === key) return this.gT;
      const W = 1024, H = Math.max(256, Math.round(1024 * hab.dims.d / hab.dims.w)); const c = mkCanvas(W, H), g = c.getContext('2d'); const rng = JT.makeRng(JT.hashStr(key));
      g.fillStyle = towardPaper(S.top, 0.22); g.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) this.wash(g, rng() * W, rng() * H, 30 + rng() * 110, rng() < 0.5 ? towardPaper(S.mid, 0.1) : towardPaper(S.top, 0.4), 0.12 + rng() * 0.1, rng, 0.8 + rng() * 0.4);
      const n = Math.round(W * H / 380); for (let i = 0; i < n; i++) { const x = rng() * W, y = rng() * H, r = 0.8 + rng() * 2.6; g.globalAlpha = 0.35 + rng() * 0.5; g.fillStyle = rng() < 0.5 ? S.speck[0] : S.speck[1]; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rng() * 0.5), rng() * 3, 0, 6.283); g.fill(); }
      g.globalAlpha = 1; const eg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55); eg.addColorStop(0, 'rgba(40,25,10,0)'); eg.addColorStop(1, 'rgba(40,25,10,0.22)'); g.fillStyle = eg; g.fillRect(0, 0, W, H);
      const side = mkCanvas(512, 128), s = side.getContext('2d'); s.fillStyle = towardPaper(S.mid, 0.1); s.fillRect(0, 0, 512, 60); s.fillStyle = towardPaper('#4a2e18', 0.12); s.fillRect(0, 60, 512, 68);
      for (let i = 0; i < 70; i++) this.wash(s, rng() * 512, 66 + rng() * 60, 4 + rng() * 9, rng() < 0.5 ? '#2e1d10' : towardPaper(S.mid, 0.3), 0.55, rng, 0.6);
      for (let i = 0; i < 40; i++) this.wash(s, rng() * 512, rng() * 58, 3 + rng() * 7, rng() < 0.5 ? S.speck[1] : S.speck[0], 0.5, rng, 0.6);
      s.fillStyle = 'rgba(40,25,12,0.6)'; s.fillRect(0, 0, 512, 2);
      if (this.gT) { this.gl.deleteTexture(this.gT.t); this.gl.deleteTexture(this.gT.s); }
      const one = mkCanvas(1, 1), oc = one.getContext('2d'); oc.drawImage(c, 0, 0, 1, 1); const px = oc.getImageData(0, 0, 1, 1).data;
      this.gT = { key, t: this.texFrom(c, false), s: this.texFrom(side, true), avg: [px[0] / 255, px[1] / 255, px[2] / 255] }; return this.gT;
    }

    // ---------- static geometry ----------
    habGeom(hab) {
      const R = this.R; const TR = JT.Terrain; const ter = TR ? TR.get(hab) : null; const tq = R.quality === 'low' ? 2 : 1;
      const key = hab.data.id + '|' + hab._geomVersion + '|' + hab.dims.w + '|' + hab.dims.d + '|' + hab.data.type + '|' + (ter ? ter.key : '') + '|' + tq;
      if (this.hg && this.hg.key === key) return this.hg;
      const gl = this.gl; if (this.hg) { for (const b of this.hg.del) gl.deleteBuffer(b); if (this.hg.cs && this.hg.cs.b) gl.deleteBuffer(this.hg.cs.b); if (this.hg.tm) { gl.deleteBuffer(this.hg.tm.vb); gl.deleteBuffer(this.hg.tm.ib); } }
      const hAt = (x, z) => (ter && ter.max > 0 ? TR.at(hab, x, z) : 0);
      const del = []; const poly = R.floorPoly(hab); const n = poly.length; const c = G.centroid(poly); const dm = hab.dims;
      // floor fan
      const fl = []; const V5 = (q) => [q[0], 0, q[1], q[0] / dm.w, q[1] / dm.d]; for (let i = 0; i < n; i++) fl.push(...V5(c), ...V5(poly[i]), ...V5(poly[(i + 1) % n]));
      const floor = this.buf(new Float32Array(fl)); del.push(floor);
      // slab sides (one quad per edge), u along the perimeter
      const sides = []; const sv = []; let u = 0;
      for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const u1 = u + L / 70; const y1 = -15;
        const ns = Math.max(1, Math.min(40, Math.ceil(L / 4))); const sb = sv.length; // subdivided so the top edge follows the ground (v15)
        for (let s2 = 0; s2 < ns; s2++) { const t0 = s2 / ns, t1 = (s2 + 1) / ns; const ax = a[0] + (b[0] - a[0]) * t0, az = a[1] + (b[1] - a[1]) * t0, bx = a[0] + (b[0] - a[0]) * t1, bz = a[1] + (b[1] - a[1]) * t1; const ua = u + (u1 - u) * t0, ub = u + (u1 - u) * t1; const ya = hAt(ax, az), yb = hAt(bx, bz);
          sv.push(ax, ya, az, ua, 0, bx, yb, bz, ub, 0, bx, y1, bz, ub, 1, ax, ya, az, ua, 0, bx, y1, bz, ub, 1, ax, y1, az, ua, 1); }
        let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if (nx * ((a[0] + b[0]) / 2 - c[0]) + nz * ((a[1] + b[1]) / 2 - c[1]) < 0) { nx = -nx; nz = -nz; } sides.push([nx, nz, sb / 5, (sv.length - sb) / 5]); u = u1; }
      const side = this.buf(new Float32Array(sv)); del.push(side);
      // decor meshes
      const meshes = [];
      const tkey = ter ? ter.key : '';
      for (const inst of hab.decor) { const g = hab.geoms[inst.id]; if (!g) continue; const m = GM.build(g); if (!m.n) continue;
        if (TR && TR.rides(g.def) && !inst.parent && (m._tk || '') !== tkey && (m._v0 || (ter && ter.max > 0))) { // v15: ground cover follows the uneven ground
          if (!m._v0) { m._v0 = m.verts.slice(); m._l0 = m.lines ? m.lines.slice() : null; }
          const S = GM.STRIDE, v = m.verts = m._v0.slice(); for (let o = 0; o < v.length; o += S) v[o + 1] += hAt(v[o], v[o + 2]);
          if (m._l0) { const l = m.lines = m._l0.slice(); for (let o = 0; o < l.length; o += 15) { l[o + 1] += hAt(l[o], l[o + 2]); l[o + 4] += hAt(l[o + 3], l[o + 5]); } }
          m._tk = tkey; if (m.vb && m.gl === this) this.free(m); m.vb = null; }
        if (!m.vb || m.gl !== this) { m.gl = this; m.vb = this.buf(m.verts); m.ib = this.buf(m.idx, 'idx'); m.lb = m.nl ? this.buf(m.lines) : null; m.lib = m.nl ? this.buf(m.lidx, 'idx') : null; }
        meshes.push({ inst, g, m }); }
      // soft shadows under decor
      const sh = []; const L = JT.LIGHT; const Lh = [L[0], L[2]]; const ll = Math.hypot(Lh[0], Lh[1]) || 1; const dir = [-Lh[0] / ll, -Lh[1] / ll];
      const decal = (cx, y, cz, ax, az, a) => this.liftQuad(hab, sh, cx, y, cz, ax, az, a);
      for (const { g } of meshes) { if (g.def.cat === 'ground' || !g.foot) continue; const fc = G.centroid(g.foot); const solid = g.solids.length > 0; const r = solid ? Math.sqrt(Math.abs(G.polyArea(g.foot)) / Math.PI) * 1.15 : Math.min(18, g.coverR * 0.6);
        decal(fc[0], g.baseY + 0.06, fc[1], [r * 1.05, 0], [0, r * 1.05], 0.5 * (solid ? 1 : 0.75)); }
      const shb = sh.length ? this.buf(new Float32Array(sh)) : null; if (shb) del.push(shb);
      // soil heaped round everything that stands in the substrate, so nothing looks set down on top of it
      const mv = []; const Lx = Lh[0] / ll, Lz = Lh[1] / ll;
      const ring = (poly, inset, w, hgt) => { if (!poly || poly.length < 3) return; const c = G.centroid(poly); if (G.polyArea(poly) < 0) poly = poly.slice().reverse();
        const nP = poly.length; const rows = [[-inset, hgt, 1, 0.8], [w * 0.3, hgt * 0.75, 1, 0.9], [w * 0.65, hgt * 0.3, 0.75, 0.88], [w, 0.02, 0, 0.9]];
        const pts = rows.map(([d, y, a, b0]) => poly.map((q, i) => { const pv = poly[(i - 1 + nP) % nP], nx = poly[(i + 1) % nP]; let ex = nx[0] - pv[0], ez = nx[1] - pv[1]; const l = Math.hypot(ex, ez) || 1; let ox = ez / l, oz = -ex / l; if (ox * (q[0] - c[0]) + oz * (q[1] - c[1]) < 0) { ox = -ox; oz = -oz; }
          const x = q[0] + ox * d, z = q[1] + oz * d; const sh2 = b0 + 0.12 * (ox * Lx + oz * Lz); return [x, y, z, x / dm.w, z / dm.d, a, sh2]; }));
        for (let r = 0; r + 1 < rows.length; r++) for (let i = 0; i < nP; i++) { const j = (i + 1) % nP; const A = pts[r][i], B = pts[r][j], C = pts[r + 1][j], D2 = pts[r + 1][i]; mv.push(...A, ...B, ...C, ...A, ...C, ...D2); } };
      const smooth = (poly) => { if (poly.length > 24) return poly; const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } return out; };
      for (const { inst, g } of meshes) { if (inst.parent || g.baseY > 0.5 || g.def.cat === 'ground' || g.def.arche === 'wallmount' || g.def.arche === 'scatter' || inst.type === 'heatlamp') continue;
        for (const so of g.solids) ring(smooth(so), 1.0, g.def.arche === 'backwall' ? 3.2 : 2.6, 1.15);
        for (const so of (g.soft || [])) ring(smooth(so), 0.6, 2.3, 1.0);
        if (!g.solids.length && !(g.soft && g.soft.length) && g.contacts && g.contacts.length) { const cs = g.contacts; let poly; if (cs.length >= 3) poly = G.hull(cs.map(q => q.slice())); if (!poly || Math.abs(G.polyArea(poly)) < 4) { const c = G.centroid(cs.length >= 3 ? cs : [cs[0], cs[0], cs[0]]); poly = G.circlePoly(c[0], c[1], 1.4, 1.4, 10); } else poly = G.expandPoly(poly, 0.8); ring(smooth(poly), 0.8, 2.4, 1.05); } }
      const mb = mv.length ? this.buf(new Float32Array(mv)) : null; if (mb) del.push(mb);
      this.hg = { key, floor, nf: fl.length / 5, side, sides, shb, nsh: sh.length / 6, meshes, del, mb, nm: mv.length / 7, ter: ter && ter.max > 0 ? ter : null, tq, poly }; return this.hg;
    }
    /** v15: a flat decal quad (shadow, lamp pool) cut into a small grid and laid onto the uneven ground. */
    liftQuad(hab, out, cx, y, cz, ax, az, a) {
      const TR = JT.Terrain; const ter = TR && TR.get(hab); const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      if (!ter || !(ter.max > 0) || y > 6) { const p = (s, t) => [cx + ax[0] * s + az[0] * t, y, cz + ax[1] * s + az[1] * t]; const q = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)]; for (const k of [0, 1, 2, 0, 2, 3]) out.push(q[k][0], q[k][1], q[k][2], uv[k][0], uv[k][1], a); return; }
      const L = Math.max(Math.hypot(ax[0], ax[1]), Math.hypot(az[0], az[1])); const n = Math.max(2, Math.min(8, Math.ceil(L / 3)));
      const P = (i, j) => { const s = i / n * 2 - 1, t = j / n * 2 - 1; const x = cx + ax[0] * s + az[0] * t, z = cz + ax[1] * s + az[1] * t; return [x, y + TR.lift(hab, x, z, y), z, i / n, j / n]; };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1); for (const q of [A, B, C, A, C, D]) out.push(q[0], q[1], q[2], q[3], q[4], a); }
    }
    /** v15: the uneven ground as one indexed grid (x, h, z, u, v, alpha, shade, wet); shading follows the sun/moon. */
    terrainMesh(hab, hg) {
      const ter = hg.ter; if (!ter) return null; const gl = this.gl; const L = JT.LIGHT; const q = (v) => Math.round(v * 40); const lk = q(L[0]) + ',' + q(L[1]) + ',' + q(L[2]);
      let tm = hg.tm; if (tm && tm.lk === lk) return tm;
      const st = hg.tq, W1 = ter.nx + 1, dm = hab.dims; const circ = dm.shape === 'circle'; const R0 = dm.w / 2, Rz = dm.d / 2;
      const ix = []; for (let i = 0; i <= ter.nx; i += st) ix.push(i); if (ix[ix.length - 1] !== ter.nx) ix.push(ter.nx);
      const jz = []; for (let j = 0; j <= ter.nz; j += st) jz.push(j); if (jz[jz.length - 1] !== ter.nz) jz.push(ter.nz);
      const cw = ix.length, ch = jz.length; const S = 8; const v = new Float32Array(cw * ch * S); const ll = Math.hypot(L[0], L[1], L[2]) || 1; const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
      const H = ter.H; const hv = (i, j) => H[Math.max(0, Math.min(ter.nz, j)) * W1 + Math.max(0, Math.min(ter.nx, i))];
      const out = new Uint8Array(cw * ch);
      for (let b = 0; b < ch; b++) for (let a = 0; a < cw; a++) { const i = ix[a], j = jz[b], k = j * W1 + i; let x = i * ter.sx, z = j * ter.sz; const o = (b * cw + a) * S;
        if (circ) { const dx = x - R0, dz = (z - Rz) * R0 / Rz, r = Math.hypot(dx, dz); if (r > R0 - 0.2) { out[b * cw + a] = 1; const f = (R0 - 0.2) / (r || 1); x = R0 + dx * f; z = Rz + dz * f * Rz / R0; } }
        const gx = (hv(i + 1, j) - hv(i - 1, j)) / (2 * ter.sx), gz = (hv(i, j + 1) - hv(i, j - 1)) / (2 * ter.sz); const nl = Math.hypot(gx, 1, gz); const ndl = (-gx * lx + ly - gz * lz) / nl;
        let sh = 1 + 0.9 * (ndl - ly); sh *= 1 - 0.14 * ter.hol[k]; sh *= 1 + 0.05 * ter.cre[k]; sh = Math.max(0.68, Math.min(1.22, sh));
        const h = out[b * cw + a] ? 0 : H[k];
        v[o] = x; v[o + 1] = h; v[o + 2] = z; v[o + 3] = x / dm.w; v[o + 4] = z / dm.d; v[o + 5] = 1; v[o + 6] = sh; v[o + 7] = ter.hol[k]; }
      if (!tm) { const idx = []; for (let b = 0; b + 1 < ch; b++) for (let a = 0; a + 1 < cw; a++) { const k0 = b * cw + a, k1 = k0 + 1, k2 = k0 + cw, k3 = k2 + 1; if (out[k0] && out[k1] && out[k2] && out[k3]) continue;
          let hs = 0; for (const kk of [k0, k1, k2, k3]) hs += v[kk * S + 1]; if (hs <= 0.0001) continue; // flat cells: the floor below already shows
          idx.push(k0, k1, k3, k0, k3, k2); }
        tm = hg.tm = { vb: gl.createBuffer(), ib: this.buf(cw * ch > 65000 ? new Uint32Array(idx) : new Uint16Array(idx), 'idx'), n: idx.length, u32: cw * ch > 65000 }; }
      gl.bindBuffer(gl.ARRAY_BUFFER, tm.vb); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW); tm.lk = lk; return tm;
    }
    /** v15: footprints, burrow mounds and mist pools, laid on the ground (rebuilt a few times a second). */
    groundMarks(hab, night) {
      const TR = JT.Terrain; if (!TR) return null; const now = hab.time; const low = this.R.quality === 'low';
      const P0 = hab._prints || [], MK0 = hab._marks || []; let np = 0; for (const d of hab.data.drops) if (d.pool) np++;
      const sig = hab.data.substrate + '|' + P0.length + '|' + (P0.length ? P0[P0.length - 1].x : 0) + '|' + MK0.length + '|' + np + '|' + low + '|' + (hab._ter ? hab._ter.key : '');
      if (this._gm && this._gm.hab === hab && Math.abs(now - this._gm.t) < 0.2 && this._gm.sig === sig) return this._gm;
      const S = JT.SUBSTRATES[hab.data.substrate] || JT.SUBSTRATES.coco; const dk = GM.rgb(S.dark), tp = GM.rgb(S.top), md = GM.rgb(S.mid); const pr = dk.map(c => c * 0.45); const v = [];
      const quad = (x, z, r, ang, el, col, a, kind) => { const c = Math.cos(ang), s = Math.sin(ang); const ax = [c * r, s * r], az = [-s * r * el, c * r * el];
        const P = (u, w) => { const px = x + ax[0] * u + az[0] * w, pz = z + ax[1] * u + az[1] * w; return [px, TR.at(hab, px, pz) + 0.07, pz, (u + 1) / 2, (w + 1) / 2]; };
        const A = P(-1, -1), B = P(1, -1), C = P(1, 1), D = P(-1, 1); for (const q of [A, B, C, A, C, D]) v.push(q[0], q[1], q[2], q[3], q[4], col[0], col[1], col[2], a, kind); };
      const pk = TR.PRINT[hab.data.substrate] || 0;
      if (pk > 0) { const P = hab._prints || []; const step = low ? 2 : 1; for (let i = P.length - 1; i >= 0; i -= step) { const p = P[i]; const age = now - p.t; if (age < 0 || age > TR.PRINT_LIFE) continue; const f = 1 - age / TR.PRINT_LIFE;
          const a = Math.min(0.85, 0.75 * pk * f * (0.6 + 0.4 * f)); const r = Math.max(0.45, p.s * 0.14); const off = p.s * 0.17; const nx = -Math.sin(p.a), nz = Math.cos(p.a); const fx = Math.cos(p.a), fz = Math.sin(p.a);
          for (const sd of [-1, 1]) quad(p.x + nx * off * sd + fx * off * 0.5 * p.side * sd, p.z + nz * off * sd + fz * off * 0.5 * p.side * sd, r, p.a, 0.7, pr, a, 0); } }
      for (const m of hab._marks || []) { const age = now - m.t; if (age < 0 || age > TR.MARK_LIFE) continue; const f = Math.min(1, (TR.MARK_LIFE - age) / 40);
        quad(m.x, m.z, m.r * 1.5, 0, 1, dk, 0.36 * f, 1); quad(m.x + m.r * 0.5, m.z + m.r * 0.35, m.r * 0.95, 0.6, 0.8, tp, 0.45 * f, 0); quad(m.x - m.r * 0.15, m.z - m.r * 0.1, m.r * 0.55, 0, 1, dk, 0.4 * f, 0); }
      const water = [0.36 + 0.05 * (1 - night), 0.42, 0.46];
      for (const d of hab.data.drops) { if (!d.pool || !M.finite3(d.pos)) continue; const f = M.clamp(d.life / 60, 0, 1); const r = d.r || 2;
        quad(d.pos[0], d.pos[2], r * 1.7, 0.3, 0.85, md.map(c => c * 0.55), 0.3 * f, 0); quad(d.pos[0], d.pos[2], r, 0.3, 0.85, water, 0.62 * f, 2); }
      const gm = this._gm || (this._gm = { b: this.gl.createBuffer() }); gm.hab = hab; gm.t = now; gm.sig = sig; gm.n = v.length / 10;
      if (gm.n) { this.gl.bindBuffer(this.gl.ARRAY_BUFFER, gm.b); this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(v), this.gl.DYNAMIC_DRAW); }
      return gm;
    }
    /** Long soft shadows thrown away from the sun/moon. Rebuilt only when the light has moved ~1.5 degrees. */
    castShadows(hg, hab) {
      const L = JT.LIGHT; const q = (v) => Math.round(v * 40); const key = q(L[0]) + ',' + q(L[1]) + ',' + q(L[2]);
      if (hg.cs && hg.csKey === key) return hg.cs; const gl = this.gl; if (hg.cs && hg.cs.b) gl.deleteBuffer(hg.cs.b);
      const Lh = [L[0], L[2]]; const ll = Math.hypot(Lh[0], Lh[1]) || 1; const dir = [-Lh[0] / ll, -Lh[1] / ll]; const sh = [];
      const decal = (cx, y, cz, ax, az, a) => (hab ? this.liftQuad(hab, sh, cx, y, cz, ax, az, a) : null);
      for (const { g } of hg.meshes) { if (g.def.cat === 'ground' || !g.foot) continue; const fc = G.centroid(g.foot); const solid = g.solids.length > 0; const r = solid ? Math.sqrt(Math.abs(G.polyArea(g.foot)) / Math.PI) * 1.15 : Math.min(18, g.coverR * 0.6);
        const len = Math.min(70, Math.max(4, g.height) * ll / Math.max(0.3, L[1])) * (solid ? 0.8 : 0.65); const cc = [fc[0] + dir[0] * len * 0.45, fc[1] + dir[1] * len * 0.45];
        // longer shadows spread and soften, so the same darkness isn't smeared over a bigger patch
        const a = 0.36 * M.clamp(1.25 - len / 110, 0.65, 1);
        decal(cc[0], g.baseY + 0.05, cc[1], [dir[0] * (r + len * 0.5), dir[1] * (r + len * 0.5)], [-dir[1] * r * 0.9, dir[0] * r * 0.9], a); }
      hg.csKey = key; hg.cs = { b: sh.length ? this.buf(new Float32Array(sh)) : null, n: sh.length / 6 }; return hg.cs;
    }

    // ---------- per-frame ----------
    frame(V, hab, night, lamps, scene) {
      const gl = this.gl; if (this.lost) return; if (this.reinit) { this.reinit = false; this._cache = null; this.P.blit = null; this.hg = null; this.bgT = null; this.gT = null; for (const id in hab.geoms) if (hab.geoms[id]._mesh) hab.geoms[id]._mesh.vb = null; }
      const W = this.cv.width, H = this.cv.height; const k = this.R.k; this.cur = null;
      const SK = JT.SKY; const grade = SK.grade.slice();
      const lampU = new Float32Array(16); const LL = []; lamps.slice(0, 4).forEach((L, i) => { const y = this.R.lampSurface(hab, L); lampU.set([L.pool[0], (y + L.head[1]) / 2, L.pool[2], L.r * 1.25 + (L.head[1] - y) * 0.4], i * 4); LL.push(L); });
      this.F = { night, grade, lamps: LL, lampU, sky: SK };
      gl.viewport(0, 0, W, H); gl.clearColor(PAPER[0], PAPER[1], PAPER[2], 1); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      const hg = this.habGeom(hab); const gt = this.groundTexture(hab); const Lg = JT.LIGHT;
      const outPx = M.clamp(V.s / k * 0.13, 0.9, 2.1) * k; const lw = M.clamp(V.s / k * 0.2, 0.7, 2.0) * k;
      const mx = 90 * k;
      const visible = (g) => { const b = g._sb || (g._sb = this.boundsOf(g)); const q = V.P(b.c); const r = b.r * V.s + mx; return q[0] > -r && q[0] < W + r && q[1] > -r && q[1] < H + r; };
      const drawList = hg.meshes.filter(o => visible(o.g)); for (const o of drawList) o._dz = V.depth(o.g._sb.c); drawList.sort((a, b) => a._dz - b._dz); // near first: early depth rejection
      const PT = this.R.set.perf ? this.R.set : {}; // performance-readout test switches (Settings)
      // decor: ink outline pass + wash pass, per object so plants can sway
      const decorPass = (list) => {
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
        let P = this.use(this.P.mesh); this.view(P, V); this.light(P); gl.uniform3f(P.u.uL, Lg[0], Lg[1], Lg[2]); gl.uniform3f(P.u.uToCam, V.toCam[0], V.toCam[1], V.toCam[2]);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.noise); gl.uniform1i(P.u.uNoise, 0); gl.uniform3f(P.u.uInk, 0.17, 0.13, 0.1); gl.uniform1f(P.u.uOut, outPx); gl.uniform1f(P.u.uAlpha, 1); gl.uniform4f(P.u.uGhost, 0, 0, 0, 0); gl.uniform3f(P.u.uSoil, gt.avg[0], gt.avg[1], gt.avg[2]);
        for (const pass of PT.ptNoInk ? [1] : [0, 1]) {
          gl.uniform1f(P.u.uPass, pass ? 0 : 1);
          for (const o of list) { const sw = o.inst._sw; gl.uniform3f(P.u.uSway, sw ? sw.x : 0, 0, sw ? sw.z : 0); gl.uniform2f(P.u.uGnd, o.g.def.cat === 'ground' || o.g.def.arche === 'wallmount' ? 0 : 1, o.g.baseY); this.drawMesh(P, o.m); }
        }
        // ink strokes on decor
        P = this.use(this.P.line); this.view(P, V); this.light(P); gl.uniform1f(P.u.uLW, lw); gl.uniform1f(P.u.uMinW, 0.6 * k); gl.uniform1f(P.u.uAlpha, 1); gl.uniform1f(P.u.uLitL, 0);
        gl.enable(gl.BLEND); gl.depthMask(false);
        for (const o of list) { if (!o.m.lb || PT.ptNoInk) continue; const sw = o.inst._sw; gl.uniform3f(P.u.uSway, sw ? sw.x : 0, 0, sw ? sw.z : 0); this.drawLines(P, o.m.lb, o.m.lib, o.m.nl); }
      };
      // everything that only changes when the camera, light, decor or ground changes
      const statics = (list) => {
        // background
        let P = this.use(this.P.scr); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); this.attribs(P, [['aXY', 2], ['aUV', 2]], 4);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.bgTexture(hab.data.bg)); gl.uniform1i(P.u.uTex, 0); gl.uniform1f(P.u.uMode, 0); gl.uniform4f(P.u.uCol, grade[0] * 0.98, grade[1] * 0.98, grade[2], 1); gl.drawArrays(gl.TRIANGLES, 0, 6);
        // slab sides (facing ones), then the floor
        P = this.use(this.P.tex); this.view(P, V); this.light(P); gl.uniform1i(P.u.uTex, 0); gl.uniform1f(P.u.uZ, 0);
        gl.bindTexture(gl.TEXTURE_2D, gt.s); gl.bindBuffer(gl.ARRAY_BUFFER, hg.side); this.attribs(P, [['aP', 3], ['aUV', 2]], 5); gl.uniform1f(P.u.uLit, 1);
        hg.sides.forEach((s, i) => { const f = s[0] * V.toCam[0] + s[1] * V.toCam[2]; if (f <= 0) return; const dd = s[0] * Lg[0] + s[1] * Lg[2]; const lit = M.clamp(0.72 + 0.4 * dd * SK.kd, 0.45, 1.1); const tw = M.clamp(0.5 + dd, 0, 1) * SK.kd; gl.uniform4f(P.u.uCol, lit * (SK.amb[0] + (SK.key[0] - SK.amb[0]) * tw), lit * (SK.amb[1] + (SK.key[1] - SK.amb[1]) * tw), lit * (SK.amb[2] + (SK.key[2] - SK.amb[2]) * tw), 1); gl.drawArrays(gl.TRIANGLES, s[2] != null ? s[2] : i * 6, s[3] || 6); });
        gl.bindTexture(gl.TEXTURE_2D, gt.t); gl.bindBuffer(gl.ARRAY_BUFFER, hg.floor); this.attribs(P, [['aP', 3], ['aUV', 2]], 5); gl.uniform4f(P.u.uCol, 1, 1, 1, 1); gl.drawArrays(gl.TRIANGLES, 0, hg.nf);
        // v15: the uneven ground over the flat floor. Depth-tested against itself (hills hide the ground behind them), then the depth is cleared,
        // so decor and critters draw exactly as before. Wet hollows darken with humidity; footprints, burrow mounds and mist pools sit on top.
        { const TR = JT.Terrain; const tm = hg.ter && !PT0(this).ptNoTer ? this.terrainMesh(hab, hg) : null; const L8 = [['aP', 3], ['aUV', 2], ['aA', 1], ['aS', 1], ['aW', 1]];
          if (tm && tm.n) { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
            P = this.use(this.P.mound); this.view(P, V); this.light(P); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, gt.t); gl.uniform1i(P.u.uTex, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.noise); gl.uniform1i(P.u.uNoise, 1); gl.activeTexture(gl.TEXTURE0);
            gl.bindBuffer(gl.ARRAY_BUFFER, tm.vb); this.attribs(P, L8, 8); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tm.ib); if (!tm.u32 || this.uintOK) gl.drawElements(gl.TRIANGLES, tm.n, tm.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
            gl.depthMask(false);
            const wet = (TR.WET[hab.data.substrate] || 0) * M.clamp((hab.data.humidity - 0.35) / 0.6, 0, 1); const WFw = this._wxF, rw = WFw && WFw.hab === hab ? WFw.wet || 0 : 0; const am = Math.max(wet * wet * (3 - 2 * wet) * 0.6, rw * rw * (3 - 2 * rw) * 0.5); // v19: rain soaks the ground
            if (am > 0.01) { P = this.use(this.P.wet); this.view(P, V); this.light(P); gl.uniform1i(P.u.uTex, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.noise); gl.uniform1i(P.u.uNoise, 1); gl.activeTexture(gl.TEXTURE0); gl.uniform1f(P.u.uAm, am);
              gl.bindBuffer(gl.ARRAY_BUFFER, tm.vb); this.attribs(P, L8, 8); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tm.ib); if (!tm.u32 || this.uintOK) gl.drawElements(gl.TRIANGLES, tm.n, tm.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0); } }
          const gm = TR ? this.groundMarks(hab, night) : null;
          if (gm && gm.n) { if (tm && tm.n) gl.enable(gl.DEPTH_TEST); P = this.use(this.P.mark); this.view(P, V); this.light(P); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.noise); gl.uniform1i(P.u.uNoise, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, gm.b); this.attribs(P, [['aP', 3], ['aUV', 2], ['aC', 4], ['aK', 1]], 10); gl.drawArrays(gl.TRIANGLES, 0, gm.n); }
          if (tm && tm.n) { gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); }
          gl.disable(gl.DEPTH_TEST); gl.depthMask(false); P = this.use(this.P.tex); this.view(P, V); this.light(P); gl.uniform1i(P.u.uTex, 0); gl.uniform1f(P.u.uZ, 0); }
        // shadows on the ground
        if (hg.shb) { P = this.use(this.P.tex); gl.bindTexture(gl.TEXTURE_2D, this.tex.radial); gl.bindBuffer(gl.ARRAY_BUFFER, hg.shb); this.attribs(P, [['aP', 3], ['aUV', 2], ['aA', 1]], 6); gl.uniform1f(P.u.uLit, 0);
          gl.uniform4f(P.u.uCol, 0.16, 0.1, 0.05, 0.42 - night * 0.12); gl.drawArrays(gl.TRIANGLES, 0, hg.nsh); }
        { const cs = this.castShadows(hg, hab); if (cs.b && SK.kd > 0.02) { P = this.use(this.P.tex); gl.bindTexture(gl.TEXTURE_2D, this.tex.radial); gl.bindBuffer(gl.ARRAY_BUFFER, cs.b); this.attribs(P, [['aP', 3], ['aUV', 2], ['aA', 1]], 6); gl.uniform1f(P.u.uLit, 0);
          gl.uniform4f(P.u.uCol, 0.16 - night * 0.06, 0.1 - night * 0.02, 0.05 + night * 0.08, (0.42 - night * 0.12) * SK.kd); gl.drawArrays(gl.TRIANGLES, 0, cs.n); } }
        // warm pools under lamps (added light)
        if (LL.length) this.lampPools(V, hab, LL, night);
        decorPass(list);
      };
      // v1.3 still-camera cache: while the camera rests, the static layer (backdrop, slab, ground, shadows, decor + its ink) is
      // painted once into an offscreen buffer (colour + depth) and each frame starts from a copy of it. Only swaying plants,
      // soil mounds, critters, silk and the paper grain are drawn live. WebGL2 only; anything unusual falls back to drawing it all.
      const live = []; for (const o of drawList) if (o.inst._sw) live.push(o);
      const mode = this.cacheMode(V, hab, hg, gt, PT, live, night, W, H);
      if (mode === 'direct') statics(drawList);
      else {
        const C = this._cache;
        if (mode === 'build') { gl.bindFramebuffer(gl.FRAMEBUFFER, C.ms); gl.viewport(0, 0, W, H); gl.clearColor(PAPER[0], PAPER[1], PAPER[2], 1); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
          statics(live.length ? drawList.filter(o => !o.inst._sw) : drawList);
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, C.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, C.rs); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
          if (!C.checked) { C.checked = true; if (gl.getError() !== gl.NO_ERROR) { this.cacheFree(true); statics(drawList); C.dead = true; } } }
        if (!C.dead) { const P = this.use(this.P.blit); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); this.attribs(P, [['aXY', 2]], 4);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, C.dt); gl.uniform1i(P.u.uDep, 1); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, C.ct); gl.uniform1i(P.u.uCol, 0);
          gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.depthFunc(gl.LEQUAL);
          if (live.length) decorPass(live);
          gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
      }
      let P;
      // soil mounds (depth tested against the decor, not written, soft edges)
      if (hg.mb) { P = this.use(this.P.mound); this.view(P, V); this.light(P); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, gt.t); gl.uniform1i(P.u.uTex, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.noise); gl.uniform1i(P.u.uNoise, 1); gl.activeTexture(gl.TEXTURE0);
        gl.bindBuffer(gl.ARRAY_BUFFER, hg.mb); this.attribs(P, [['aP', 3], ['aUV', 2], ['aA', 1], ['aS', 1]], 7); gl.drawArrays(gl.TRIANGLES, 0, hg.nm); }
      // placement ghost
      if (this.R.ghost && this.R.ghost.geom) this.drawGhost(V, this.R.ghost);
      // critters & small things as sprites, then silk
      if (scene && !PT.ptNoSpr) { this.sprites(V, hab, scene, night); this.silk(V, hab, scene, night); }
      // paper grain + vignette over everything
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.DST_COLOR, gl.ZERO);
      P = this.use(this.P.scr); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); this.attribs(P, [['aXY', 2], ['aUV', 2]], 4); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.paper); gl.uniform1i(P.u.uTex, 0);
      gl.uniform1f(P.u.uMode, 1); gl.uniform2f(P.u.uRes, W, H); gl.uniform2f(P.u.uJit, 0, 0); gl.uniform4f(P.u.uCol, 1, 0.985, 0.95, 0.32 + night * 0.2); gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      // every ~10 s (and on habitat change, never mid-camera-move — a pixel read stalls the GPU): read one pixel at the bottom edge and paint the page background with it, so any strip of
      // screen the web view leaves uncovered (iOS home-screen apps) blends into the scene instead of showing a band
      if (!this._edgeT || (performance.now() - this._edgeT > 10000 && !this._moving) || this._edgeH !== hab.id) { this._edgeT = performance.now(); this._edgeH = hab.id; try { const px = new Uint8Array(4); gl.readPixels(W >> 1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const c = 'rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')'; if (c !== this._edgeC) { this._edgeC = c; document.documentElement.style.backgroundColor = c; document.body.style.backgroundColor = c; } } catch (e) { /* ignore */ } }
    }
    boundsOf(g) { const pts = []; for (const e of (g.extent.length ? g.extent : g.foot || [])) pts.push([e[0], g.baseY, e[1]]); let c = [0, 0, 0]; if (!pts.length) return { c: g.center, r: 20 }; for (const p of pts) c = M.add(c, p); c = M.mul(c, 1 / pts.length); c[1] = g.baseY + g.height / 2; let r = g.height / 2 + 4; for (const p of pts) r = Math.max(r, Math.hypot(p[0] - c[0], p[2] - c[2]) + g.height / 2); return { c, r }; }
    /** Shop thumbnail of one decor geometry, painted like the habitat (ink + wash) into a 2D canvas. V: view in thumbnail pixels. */
    thumb(g, V, size) {
      const gl = this.gl; if (this.lost) return null; const S = size * 2; const m = GM.build(g); if (!m.n) return null;
      this._tfb = this._tfb || {}; let T = this._tfb[S];
      if (!T) { const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, S, S);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
        T = this._tfb[S] = { fb, tex, rb }; }
      const keepF = this.F; this.F = { night: 0, grade: [1, 1, 1], lamps: [], lampU: new Float32Array(16), sky: NEUTRAL }; this._res = [S, S]; this.resetAttribs();
      const W2 = new JT.View(V.yaw, V.pitch, V.s * 2, V.cx * 2, V.cy * 2, V.c);
      try {
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.viewport(0, 0, S, S); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (!m.vb || m.gl !== this) { m.gl = this; m.vb = this.buf(m.verts); m.ib = this.buf(m.idx, 'idx'); m.lb = m.nl ? this.buf(m.lines) : null; m.lib = m.nl ? this.buf(m.lidx, 'idx') : null; }
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
        const Lg = JT.LIGHT; let P = this.use(this.P.mesh); this.view(P, W2); this.light(P);
        gl.uniform3f(P.u.uL, Lg[0], Lg[1], Lg[2]); gl.uniform3f(P.u.uToCam, W2.toCam[0], W2.toCam[1], W2.toCam[2]); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.noise); gl.uniform1i(P.u.uNoise, 0);
        gl.uniform3f(P.u.uInk, 0.17, 0.13, 0.1); gl.uniform1f(P.u.uOut, M.clamp(S / 110, 1.4, 3)); gl.uniform1f(P.u.uAlpha, 1); gl.uniform4f(P.u.uGhost, 0, 0, 0, 0); gl.uniform3f(P.u.uSway, 0, 0, 0); gl.uniform2f(P.u.uGnd, 0, 0); gl.uniform3f(P.u.uSoil, 0.5, 0.4, 0.3);
        for (const pass of [1, 0]) { gl.uniform1f(P.u.uPass, pass); this.drawMesh(P, m); }
        if (m.lb) { P = this.use(this.P.line); this.view(P, W2); this.light(P); gl.uniform1f(P.u.uLW, M.clamp(S / 90, 1, 2.4)); gl.uniform1f(P.u.uMinW, 1); gl.uniform1f(P.u.uAlpha, 1); gl.uniform1f(P.u.uLitL, 0); gl.uniform3f(P.u.uSway, 0, 0, 0);
          gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); this.drawLines(P, m.lb, m.lib, m.nl); }
        const px = new Uint8Array(S * S * 4); gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const big = mkCanvas(S, S), bc = big.getContext('2d'); const id = bc.createImageData(S, S);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = ((S - 1 - y) * S + x) * 4, o = (y * S + x) * 4; const a = px[i + 3]; const k = a ? 255 / a : 0; id.data[o] = Math.min(255, px[i] * k); id.data[o + 1] = Math.min(255, px[i + 1] * k); id.data[o + 2] = Math.min(255, px[i + 2] * k); id.data[o + 3] = a; }
        bc.putImageData(id, 0, 0);
        const c = mkCanvas(size, size), cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(big, 0, 0, size, size); return c;
      } finally {
        this.free(m); g._mesh = null; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.cv.width, this.cv.height); gl.depthMask(true); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.F = keepF; this._res = null; this.resetAttribs();
      }
    }
    resetAttribs() { const gl = this.gl; const n = this._maxA || (this._maxA = Math.min(16, gl.getParameter(gl.MAX_VERTEX_ATTRIBS))); for (let i = 0; i < n; i++) gl.disableVertexAttribArray(i); this.cur = null; }
    free(m) { const gl = this.gl; for (const k of ['vb', 'ib', 'lb', 'lib']) { if (m[k]) gl.deleteBuffer(m[k]); m[k] = null; } }
    drawMesh(P, m) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); this.attribs(P, [['aP', 3], ['aN', 3], ['aO', 3], ['aC', 3], ['aC2', 3], ['aW', 1], ['aF', 1]], GM.STRIDE); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); const u32 = m.idx instanceof Uint32Array; if (u32 && !this.uintOK) return; gl.drawElements(gl.TRIANGLES, m.idx.length, u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0); }
    drawLines(P, lb, lib, nl) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, lb); this.attribs(P, [['aA', 3], ['aB', 3], ['aS', 2], ['aW', 1], ['aAl', 1], ['aCol', 3], ['aSw', 2]], 15); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lib); const u32 = nl * 4 > 65000; if (u32 && !this.uintOK) return; gl.drawElements(gl.TRIANGLES, nl * 6, u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0); }
    dynBuf(name, data) { const gl = this.gl; let b = this.dyn[name]; if (!b) b = this.dyn[name] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); return b; }
    lampPools(V, hab, LL, night) {
      const gl = this.gl; const v = [];
      for (const L of LL) { const y = this.R.lampSurface(hab, L) + 0.08; const R = L.r * 1.1; const a = 0.22 + night * 0.25; this.liftQuad(hab, v, L.pool[0], y, L.pool[2], [R, 0], [0, R], a); }
      const P = this.use(this.P.tex); this.view(P, V); gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf('pool', new Float32Array(v))); this.attribs(P, [['aP', 3], ['aUV', 2], ['aA', 1]], 6);
      gl.bindTexture(gl.TEXTURE_2D, this.tex.radial); gl.uniform1f(P.u.uLit, 0); gl.blendFunc(gl.ONE, gl.ONE); gl.uniform4f(P.u.uCol, 1.0, 0.72, 0.4, 0.22 + night * 0.28); gl.drawArrays(gl.TRIANGLES, 0, v.length / 6); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    drawGhost(V, gh) {
      const gl = this.gl; const g = gh.geom; const m = GM.build(g); if (!m.n) return;
      if (!m.vb || m.gl !== this) { m.gl = this; m.vb = this.buf(m.verts); m.ib = this.buf(m.idx, 'idx'); }
      const P = this.use(this.P.mesh); this.view(P, V); this.light(P); gl.enable(gl.BLEND); gl.depthMask(false); gl.uniform3f(P.u.uSway, 0, 0, 0); gl.uniform2f(P.u.uGnd, 0, 0);
      gl.uniform1f(P.u.uAlpha, gh.ok ? 0.8 : 0.5); gl.uniform4f(P.u.uGhost, gh.ok ? 0.45 : 0.9, gh.ok ? 0.85 : 0.3, gh.ok ? 0.45 : 0.25, 0.3); gl.uniform1f(P.u.uPass, 0); this.drawMesh(P, m);
      gl.uniform1f(P.u.uAlpha, 1); gl.uniform4f(P.u.uGhost, 0, 0, 0, 0);
    }
    gradeAt(p) { const F = this.F; let r = F.grade[0], g = F.grade[1], b = F.grade[2]; for (let i = 0; i < F.lamps.length; i++) { const u = F.lampU; const d = Math.hypot(p[0] - u[i * 4], p[1] - u[i * 4 + 1], p[2] - u[i * 4 + 2]); const a = M.clamp(1 - d / u[i * 4 + 3], 0, 1); const s = a * a * (0.25 + 0.9 * F.night); r += s; g += s * 0.72; b += s * 0.42; } return [Math.min(1.3, r), Math.min(1.3, g), Math.min(1.3, b)]; }

    /** Critters, remains, drops, nests and leaf bits: drawn by the 2D art code into one sprite sheet, then placed in 3D. */
    sprites(V, hab, scene, night) {
      const gl = this.gl, R = this.R, k = R.k; const W = this.cv.width, H = this.cv.height; const list = []; const tS = performance.now();
      const TR = JT.Terrain, ter = TR ? TR.get(hab) : null; // v15: things on the floor stand on the uneven ground (the simulation itself stays flat)
      for (const it of scene.items) {
        if (it.inst || it.noGL || it.ln || it.silk || it.ghost || !it.p || !M.finite3(it.p)) continue;
        const lp = ter ? TR.liftWith(ter, it.p) : it.p; const q = V.P(lp), q0 = lp === it.p ? q : V.P(it.p); let r = it.r * V.s + 6 * k; if (q[0] < -r || q[0] > W + r || q[1] < -r || q[1] > H + r) continue;
        // close-up critters: paint at ~1.5x CSS pixels (not full device pixels) and let the GPU scale them up; keeps the per-frame sheet small
        let sc = 1; const capS = Math.min(1, 1.25 / k); if (r > 100 && capS < 1) sc = Math.max(capS, 100 / r); if (r * sc > 254) sc = 254 / r; r *= sc;
        const rp = Math.ceil(r); list.push({ it, q, q0, rp, sc, dep: V.depth(lp), z: V.depth(lp) - (it.bias != null ? it.bias : it.ground ? 0.2 : it.r * 0.35) });
      }
      if (!list.length) return;
      // pixel budget: every critter is repainted and copied to the GPU each frame, so cap the total painted area (~0.4 Mpx).
      // Many close-up crickets otherwise grew the sheet to 2048x1024 (8 MB a frame). Over budget, all sprites paint a bit
      // smaller and the GPU scales them back up (slightly softer, same size on screen).
      // The watched jumper and its prey (xr) keep full detail; everything else shares what is left.
      { const A = (s) => (s.rp * 2 + 2) * (s.rp * 2 + 2); let keep = 0, rest = 0; for (const s of list) { if (s.it.xr) keep += A(s); else rest += A(s); } const B = 600000;
        const room = Math.max(B * 0.3, B - keep); if (rest > room) { const f = Math.sqrt(room / rest); for (const s of list) if (!s.it.xr) { s.sc *= f; s.rp = Math.max(3, Math.ceil(s.rp * f)); } } }
      // shelf-pack into the sheet (biggest first)
      // Reuse: critters other than the watched / selected one repaint every other frame (staggered), the rest of the time
      // their last drawing is moved to where they are now. Sizes snap to 8 px steps with hysteresis so the packing (and
      // with it every slot) stays put from frame to frame.
      const SC = this._sc || (this._sc = new Map()); const sf = this._sf = (this._sf || 0) + 1;
      for (const s of list) { const k = s.it.key; if (!k) continue; let rq = Math.ceil(s.rp / 8) * 8; const pv = SC.get(k); if (pv && rq <= pv.rp && rq >= pv.rp - 16) rq = pv.rp; s.rp = rq; }
      // shelf-pack into the narrowest sheet that fits (the whole sheet is re-uploaded every frame, so smaller is cheaper)
      const order = list.slice().sort((a, b) => (b.rp - a.rp) || ((a.it.key || '') < (b.it.key || '') ? -1 : (a.it.key || '') > (b.it.key || '') ? 1 : 0)); let AW = 512, x = 0, y = 0, rowH = 0;
      const pack = (aw) => { x = 0; y = 0; rowH = 0; for (const s of order) { const w = s.rp * 2 + 2; if (x + w > aw) { x = 0; y += rowH; rowH = 0; } s.ax = x + 1; s.ay = y + 1; x += w; rowH = Math.max(rowH, w); } return y + rowH; };
      while (AW < 2048 && (order[0].rp * 2 + 2 > AW || pack(AW) > AW)) AW *= 2;
      // hysteresis: grow at once, shrink only after the smaller sheet has been enough for ~3 s (no reallocation churn)
      const cur = this._aw || AW; if (AW >= cur) { this._aw = AW; this._awN = 0; } else if (++this._awN > 90) { this._aw = AW; this._awN = 0; } else AW = cur; pack(AW);
      const need = Math.min(2048, Math.ceil((y + rowH) / 128) * 128);
      // The sheet lives in CPU memory (willReadFrequently): on iPhone a GPU-backed 2D canvas must be read back before WebGL
      // can use it, which cost 16-28 ms a frame. CPU-side, only the rows in use are copied up (a plain memory copy).
      const cpu = !(R.set.perf && R.set.ptGpuAtlas);
      // v1.3: CPU sheet without the read-back. Each repainted critter is painted into a small CPU-side scratch canvas of its own
      // size and copied straight into its slot of the GPU sheet (texSubImage2D from the canvas, premultiplied: no getImageData,
      // no per-pixel un-premultiply, no ImageData garbage). The old getImageData path stays behind the 'ptOldAtlas' test switch.
      const old = cpu && R.set.perf && R.set.ptOldAtlas, direct = cpu && !old;
      if (this._atlasCPU !== cpu) { this._atlasCPU = cpu; this.atlas = mkCanvas(direct ? 1 : this.atlas.width, direct ? 1 : this.atlas.height); this.actx = this.atlas.getContext('2d', cpu ? { willReadFrequently: true } : undefined); this._atexSz = null; }
      if (direct !== !!this._atlasDirect) { this._atlasDirect = direct; this._atexSz = null; if (direct) { this.atlas.width = 1; this.atlas.height = 1; } }
      let ATW, ATH; if (direct) { ATW = AW; const ch = this._atH || 0; ATH = ch < need || ch > need * 2 + 256 ? need : ch; this._atH = ATH; }
      else { if (this.atlas.width !== AW || this.atlas.height < need || this.atlas.height > need * 2 + 256) { this._atlasGrow = (this._atlasGrow || 0) + 1; this.atlas.width = AW; this.atlas.height = need; this.actx = this.atlas.getContext('2d'); } ATW = this.atlas.width; ATH = this.atlas.height; }
      const g0 = this.actx; g0.setTransform(1, 0, 0, 1, 0, 0); g0.globalAlpha = 1; g0.globalCompositeOperation = 'source-over';
      const V2 = this.V2; const sig = AW + 'x' + ATH + (direct ? 'd' : cpu ? 'c' : 'g'); const reuse = !(R.set.perf && R.set.ptNoReuse);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atex);
      if (direct) { const sz = ATW + 'x' + ATH; if (sz !== this._atexSz) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ATW, ATH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); this._atexSz = sz; } gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); }
      const pool = this._scr || (this._scr = new Map()); let upT = 0;
      for (const s of order) {
        if (direct ? s.ay - 1 + s.rp * 2 + 2 > ATH : s.ay + s.rp * 2 > ATH) { s.skip = true; continue; }
        const k = s.it.key, pv = k ? SC.get(k) : null; s.ps = V.s * s.sc;
        if (reuse && pv && !s.it.xr && !s.it.hot && pv.sig === sig && pv.ax === s.ax && pv.ay === s.ay && pv.rp === s.rp && sf - pv.f < 2 && ((sf + pv.h) & 1)) { s.ps = pv.ps; s.keep = true; continue; }
        if (k) SC.set(k, { ax: s.ax, ay: s.ay, rp: s.rp, ps: s.ps, f: sf, sig, h: k.charCodeAt(k.length - 1) & 1 }); // id parity: half the critters refresh on odd frames, half on even
        let g = g0, ox = 0, oy = 0, sc0 = null; const S = s.rp * 2 + 2;
        if (direct) { sc0 = pool.get(S); if (!sc0) { const c = mkCanvas(S, S); sc0 = { c, g: c.getContext('2d', { willReadFrequently: true }) }; pool.set(S, sc0); } sc0.f = sf; g = sc0.g; ox = 1 - s.ax; oy = 1 - s.ay;
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, S, S); }
        else g.clearRect(s.ax - 1, s.ay - 1, S, S);
        const cx = s.ax + s.rp + ox, cy = s.ay + s.rp + oy;
        if (s.sc === 1) V2.set(V.yaw, V.pitch, V.s, V.cx + (cx - s.q0[0]), V.cy + (cy - s.q0[1]), V.c);
        else { V2.set(V.yaw, V.pitch, V.s * s.sc, 0, 0, V.c); const q2 = V2.P(s.it.p); V2.set(V.yaw, V.pitch, V.s * s.sc, cx - q2[0], cy - q2[1], V.c); }
        g.save(); g.beginPath(); g.rect(s.ax + ox, s.ay + oy, s.rp * 2, s.rp * 2); g.clip();
        try { scene.run(s.it, g, V2); } catch (e) { if (JT.DEV) console.warn(e); }
        g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        if (direct) { const t1 = performance.now(); gl.texSubImage2D(gl.TEXTURE_2D, 0, s.ax - 1, s.ay - 1, gl.RGBA, gl.UNSIGNED_BYTE, sc0.c); upT += performance.now() - t1; }
      }
      if (!(sf % 120)) { for (const [k, v] of SC) if (sf - v.f > 120) SC.delete(k); for (const [k, v] of pool) if (sf - v.f > 240) pool.delete(k); }
      const tU = performance.now(); R._sprT = tU - tS - upT;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      const g = g0;
      // same size as last frame: update the texture in place (no GPU reallocation)
      if (!direct) { const sz = this.atlas.width + 'x' + this.atlas.height;
        if (cpu) { gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); // raw pixels as read; the shader premultiplies (saves a CPU pass)
          if (sz !== this._atexSz) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.atlas.width, this.atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); this._atexSz = sz; }
          // copy each sprite's own square only (no empty packing space)
          const AHc = this.atlas.height; for (const s of order) { if (s.skip || s.keep) continue; const x0 = Math.max(0, s.ax - 1), y0 = Math.max(0, s.ay - 1), w = Math.min(AW - x0, s.rp * 2 + 2), h = Math.min(AHc - y0, s.rp * 2 + 2); if (w <= 0 || h <= 0) continue;
            gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, g.getImageData(x0, y0, w, h).data); } }
        else if (sz === this._atexSz) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas); else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas); this._atexSz = sz; } }
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); this.texParams(false); R._upT = performance.now() - tU + upT;
      // quads, far to near
      list.sort((a, b) => b.dep - a.dep); const AH = ATH; const v = []; const xr = [];
      const quad = (s, out) => { const t = this.gradeAt(s.it.p); const big = s.rp * V.s / s.ps; const x0 = s.q[0] - big, x1 = s.q[0] + big, y0 = s.q[1] - big, y1 = s.q[1] + big; const u0 = s.ax / AW, u1 = (s.ax + s.rp * 2) / AW, v0 = s.ay / AH, v1 = (s.ay + s.rp * 2) / AH;
        const c = [[x0, y0, u0, v0], [x1, y0, u1, v0], [x1, y1, u1, v1], [x0, y0, u0, v0], [x1, y1, u1, v1], [x0, y1, u0, v1]]; for (const p of c) out.push(p[0], p[1], s.z, p[2], p[3], t[0], t[1], t[2], 1); };
      for (const s of list) { if (s.skip) continue; quad(s, v); if (s.it.xr) quad(s, xr); }
      const P = this.use(this.P.spr); gl.uniform2f(P.u.uRes, W, H); gl.uniform1i(P.u.uTex, 0); gl.uniform2f(P.u.uTexel, 1 / AW, 1 / AH); gl.uniform3f(P.u.uInk, 0.15 * (1 - night * 0.3), 0.11 * (1 - night * 0.3), 0.08 * (1 - night * 0.3)); gl.uniform1f(P.u.uInkAmt, 0.9); gl.uniform1f(P.u.uAlpha, 1); gl.uniform1f(P.u.uPm, cpu && !direct ? 1 : 0);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf('spr', new Float32Array(v))); this.attribs(P, [['aXY', 2], ['aZ', 1], ['aUV', 2], ['aT', 4]], 9); gl.drawArrays(gl.TRIANGLES, 0, v.length / 9);
      if (xr.length) { // observe: the watched jumper (and the prey it is hunting) show through anything in front of them at 65%
        gl.depthFunc(gl.GREATER); gl.uniform1f(P.u.uAlpha, 0.65); gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf('sprx', new Float32Array(xr))); this.attribs(P, [['aXY', 2], ['aZ', 1], ['aUV', 2], ['aT', 4]], 9); gl.drawArrays(gl.TRIANGLES, 0, xr.length / 9); gl.depthFunc(gl.LEQUAL); gl.uniform1f(P.u.uAlpha, 1); }
    }
    silk(V, hab, scene, night) {
      const v = []; const push = (a, b, w, al, col) => { for (const [sd, en] of [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]]) v.push(a[0], a[1], a[2], b[0], b[1], b[2], sd, en, w, al, col[0], col[1], col[2], 0, 0); };
      const white = [0.97, 0.97, 1]; const TR = JT.Terrain, ter = TR ? TR.get(hab) : null; const LW = (p) => (ter ? TR.liftWith(ter, p) : p);
      for (const it of scene.items) {
        if (it.ln) push(LW(it.ln.a), LW(it.ln.b), it.ln.w, it.ln.al, white);
        else if (it.silk) { const s = { a: LW(it.silk.a), b: LW(it.silk.b), age: it.silk.age, kind: it.silk.kind }; const m = M.lerp3(s.a, s.b, 0.5); m[1] -= M.dist(s.a, s.b) * 0.05; const fade = Math.max(0, 1 - s.age / (s.kind === 'retreat' ? 1800 : 600)); const al = (s.kind === 'retreat' ? 0.5 : 0.32) * fade + night * 0.08; if (al < 0.02) continue; push(s.a, m, 0.12, al, white); push(m, s.b, 0.12, al, white); }
      }
      if (!v.length) return; const gl = this.gl; const P = this.use(this.P.line); this.view(P, V); this.light(P);
      gl.uniform1f(P.u.uLW, V.s); gl.uniform1f(P.u.uMinW, 0.6 * this.R.k); gl.uniform1f(P.u.uAlpha, 1); gl.uniform1f(P.u.uLitL, 1); gl.uniform3f(P.u.uSway, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf('silk', new Float32Array(v))); this.attribs(P, [['aA', 3], ['aB', 3], ['aS', 2], ['aW', 1], ['aAl', 1], ['aCol', 3], ['aSw', 2]], 15); gl.drawArrays(gl.TRIANGLES, 0, v.length / 15);
    }
  }
  JT.GLPaint = GLPaint;
})(typeof window !== 'undefined' ? window : globalThis);
