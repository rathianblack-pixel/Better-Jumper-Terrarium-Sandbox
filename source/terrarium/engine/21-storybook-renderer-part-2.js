!function() {
    "use strict";
    const JT = ("undefined" != typeof window ? window : globalThis).JT, M = JT.M, G = JT.G, GM = JT.GLMesh, PROJ = "\nuniform vec3 uC; uniform vec4 uRot; uniform vec4 uScr; uniform vec2 uRes;\nvec3 proj(vec3 p){ vec3 d=p-uC; float xr=d.x*uRot.x-d.z*uRot.y; float zr=d.x*uRot.y+d.z*uRot.x; return vec3(uScr.y+xr*uScr.x, uScr.z-(d.y*uRot.z+zr*uRot.w)*uScr.x, zr*uRot.z-d.y*uRot.w); }\nvec2 projd(vec3 v){ float xr=v.x*uRot.x-v.z*uRot.y; float zr=v.x*uRot.y+v.z*uRot.x; return vec2(xr, -(v.y*uRot.z+zr*uRot.w)); }\nvec4 clip(vec3 q){ return vec4(q.x/uRes.x*2.0-1.0, 1.0-q.y/uRes.y*2.0, clamp(q.z*0.0011, -0.999, 0.999), 1.0); }", LAMPS = "\nuniform vec4 uLamp[4]; uniform float uNL; uniform vec3 uGrade; uniform float uNight;\nvec3 lampLight(vec3 wp){ vec3 s=vec3(0.0); for(int i=0;i<4;i++){ if(float(i)<uNL){ vec3 d=wp-uLamp[i].xyz; float a=clamp(1.0-length(d)/uLamp[i].w,0.0,1.0); s+=vec3(a*a); } } return s*vec3(1.0,0.72,0.42); }\nvec3 grade(vec3 c, vec3 wp){ return c*uGrade + c*lampLight(wp)*(0.25+1.05*uNight); }", MESH_VS = `\nattribute vec3 aP; attribute vec3 aN; attribute vec3 aO; attribute vec3 aC; attribute vec3 aC2; attribute float aW; attribute float aF;\nuniform vec3 uSway; uniform vec3 uWind; uniform float uOut; uniform float uPass; uniform float uBoil; ${PROJ}\nvarying vec3 vN; varying vec3 vC; varying vec3 vC2; varying vec3 vWP; varying float vF;\nvoid main(){ vec3 p=aP+uSway*aW+uWind*(fract(aF)*4.0); vec3 q=proj(p);\n  if(uPass>0.5 && uPass<1.5){ float wob=0.78+0.24*(sin(p.x*0.9+p.y*1.3)+sin(p.z*1.1-p.y*0.7)); if(uBoil>0.5) wob=wob*1.15+0.32*sin(dot(p,vec3(1.7,1.3,2.1))+uBoil*2.39); q.xy+=projd(aO)*uOut*wob; q.z+=1.8; }\n  vN=aN; vC=aC; vC2=aC2; vWP=p; vF=aF; gl_Position=clip(q); }`, MESH_FS = `\nprecision highp float;\nvarying vec3 vN; varying vec3 vC; varying vec3 vC2; varying vec3 vWP; varying float vF;\nuniform vec3 uL; uniform vec3 uKeyC; uniform vec3 uAmbC; uniform float uKD; uniform vec3 uToCam; uniform sampler2D uNoise; uniform float uPass; uniform vec3 uInk; uniform float uAlpha; uniform vec4 uGhost; uniform vec3 uSoil; uniform vec2 uGnd; uniform float uHD; ${LAMPS}\nfloat b2(vec2 q){ return mod(2.0*q.x+3.0*q.y,4.0); }\nfloat bay4(vec2 fc){ vec2 p=mod(floor(fc),4.0); return (4.0*b2(mod(p,2.0))+b2(floor(p/2.0))+0.5)/16.0; }\n// v28 materials: world-space procedural surfaces (cork fissures, layered stone, wood grain, blocks, moss cushions, bark,\n// sandstone, leaf litter, root tangles). Side faces blend two projections so tubes and rounded rocks have no seams.\nfloat hs1(vec2 p){ p=fract(p*vec2(127.13,311.71)); p+=dot(p,p+34.53); return fract(p.x*p.y); }\nfloat tn(vec2 p){ return texture2D(uNoise,p).r; }\nuniform sampler2D uCell; uniform float uMatQ;\nvec3 cel(vec2 p){ vec3 t=texture2D(uCell, p*0.0625).rgb; return vec3(t.r*1.275, t.g, t.b); }\n// x: shade multiplier, y: mix toward the mark (crevice) colour, z: tint mix (lichen / moss / pale), w: tint id\nvec4 matAt(float mt, vec2 q, float up, float y){\n  float sh=1.0, dk=0.0, tt=0.0, ti=0.0;\n  if(mt<1.5){ // cork: deep vertical fissures between raised plates\n    float w=tn(vec2(q.x*0.021,q.y*0.006))*7.0+tn(q*0.05+0.3)*1.6; float r=abs(sin(q.x*0.42+w));\n    float brk=smoothstep(0.35,0.62,tn(vec2(q.x*0.09,q.y*0.035)+0.61));\n    dk=(1.0-smoothstep(0.0,0.32,r))*(0.55+0.45*brk); sh=0.92+0.2*smoothstep(0.55,1.0,r)+0.1*tn(q*0.16);\n    tt=smoothstep(0.66,0.8,tn(q*0.028+0.17))*0.35*up; ti=0.0; }\n  else if(mt<2.5){ // stone: soft strata, plates split by thin cracks, lichen on the tops\n    vec3 c=cel(q*0.075+vec2(0.0,y*0.02)); float st=sin(y*0.75+tn(q*0.02)*5.0);\n    sh=0.9+0.12*st+0.12*(c.z-0.5)+0.1*tn(q*0.2)-0.08*smoothstep(0.35,0.9,c.x);\n    dk=(1.0-smoothstep(0.015,0.06,c.y))*0.75+smoothstep(0.7,0.76,tn(q*0.31))*0.35;\n    tt=smoothstep(0.58,0.72,tn(q*0.045+0.5))*(0.25+0.65*up); ti=0.0; }\n  else if(mt<3.5){ // wood grain: long wavy lines, the odd knot, pale silvered ridges\n    float w=tn(vec2(q.x*0.012,q.y*0.05))*9.0; float g=sin(q.y*2.1+w); vec3 c=cel(vec2(q.x*0.06,q.y*0.22));\n    float knot=1.0-smoothstep(0.08,0.2,c.x); knot*=step(0.82,c.z);\n    dk=smoothstep(0.75,0.98,g)*0.55+knot*0.7+(1.0-smoothstep(0.0,0.05,abs(sin(q.y*0.37+w*0.4))))*0.4;\n    sh=0.94+0.12*smoothstep(-0.6,0.6,sin(q.y*0.9+w*0.7)); }\n  else if(mt<4.5){ // blocks: rows of cut stone with mortar, moss in the joints\n    float row=floor(y/4.6); float bx=q.x/7.5+0.5*mod(row,2.0)+hs1(vec2(row,3.0))*0.3; float cx=floor(bx);\n    float ex=min(fract(bx),1.0-fract(bx))*7.5, ey=min(fract(y/4.6),1.0-fract(y/4.6))*4.6; float e=min(ex,ey);\n    float mo=1.0-smoothstep(0.25,0.55,e); float id=hs1(vec2(cx,row));\n    sh=0.86+0.22*id+0.08*tn(q*0.18)-0.1*(1.0-smoothstep(0.4,1.6,e)); dk=mo*0.8+smoothstep(0.72,0.8,tn(q*0.35))*0.3;\n    tt=mo*smoothstep(0.45,0.65,tn(q*0.06))*0.9+smoothstep(0.62,0.75,tn(q*0.04+0.2))*0.4*up; ti=1.0; }\n  else if(mt<5.5){ // moss cushions: rounded clumps, dark gaps, fine fronds\n    vec3 c=cel(q*0.32); float b=1.0-smoothstep(0.1,0.75,c.x);\n    sh=0.68+0.48*b+0.14*(c.z-0.5)+0.12*(tn(q*0.9)-0.5); dk=(1.0-smoothstep(0.02,0.1,c.y))*0.45;\n    tt=step(0.86,c.z)*0.35; ti=2.0; }\n  else if(mt<6.5){ // bark: narrower interlaced ridges\n    float w=tn(vec2(q.x*0.03,q.y*0.008))*6.0; float r=abs(sin(q.x*0.75+w)); float r2=abs(sin(q.x*0.75+w+1.6+tn(q*0.02)*2.0));\n    dk=(1.0-smoothstep(0.0,0.28,min(r,r2+0.25)))*0.8; sh=0.9+0.18*smoothstep(0.4,1.0,r)+0.08*tn(q*0.2);\n    tt=smoothstep(0.7,0.82,tn(q*0.035+0.4))*0.5; ti=0.0; }\n  else if(mt<7.5){ // sandstone: wavy layers, eroded pits\n    float l=sin(y*0.55+tn(q*0.012)*7.0)*0.5+0.5; float l2=sin(y*2.4+tn(q*0.03)*4.0); vec3 c=cel(q*0.22);\n    sh=0.8+0.3*smoothstep(0.2,0.8,l)+0.07*l2+0.06*tn(q*0.3); dk=(1.0-smoothstep(0.05,0.18,c.x))*step(0.7,c.z)*0.6+smoothstep(0.85,0.98,l2*0.5+0.5)*0.3; }\n  else if(mt<8.5){ // leaf litter: overlapping leaves of different browns, each with a midrib\n    vec2 r=vec2(q.x*0.16+q.y*0.07, q.y*0.32-q.x*0.05); vec3 c=cel(r); vec3 c2=cel(r*1.7+3.1);\n    sh=0.8+0.35*c.z-0.18*(1.0-smoothstep(0.02,0.12,c.y)); dk=(1.0-smoothstep(0.0,0.08,c.y))*0.6+(1.0-smoothstep(0.0,0.05,c2.y))*0.25;\n    tt=step(0.8,c.z)*0.5; ti=3.0; }\n  else if(mt<9.5){ // soil lumps (take the substrate's colour)\n    sh=0.8+0.3*tn(q*0.4); }\n  else if(mt<10.5){ // root tangle: long sinuous roots running down and across, dark hollows between\n    float w1=tn(vec2(q.x*0.02,y*0.008))*9.0, w2=tn(vec2(q.x*0.013+0.5,y*0.011))*8.0;\n    float a=abs(sin(q.x*0.32+w1)), b=abs(sin(q.x*0.21+y*0.06+w2)), c2=abs(sin(q.x*0.5-y*0.09+w1*0.6));\n    float m=max(max(smoothstep(0.62,0.96,a), smoothstep(0.7,0.98,b)*0.9), smoothstep(0.8,0.99,c2)*0.75);\n    sh=0.55+0.6*m+0.05*tn(q*0.3); dk=(1.0-smoothstep(0.0,0.35,m))*0.6; }\n  else if(mt<11.5){ // fieldstone: rounded stones set in dark mortar, mossy joints\n    vec3 c=cel(vec2(q.x*0.085,y*0.11)); float e=c.y; float mo=1.0-smoothstep(0.06,0.16,e);\n    sh=0.82+0.3*c.z+0.14*(1.0-smoothstep(0.0,0.7,c.x))+0.08*tn(q*0.25); dk=mo*0.85;\n    tt=mo*smoothstep(0.5,0.68,tn(q*0.05))*0.8+smoothstep(0.66,0.78,tn(q*0.07+0.3))*0.3*(0.3+up); ti=1.0; }\n  return vec4(sh,dk,tt,ti); }\nvec3 tintC(float ti){ return ti<0.5 ? vec3(0.66,0.71,0.52) : ti<1.5 ? vec3(0.36,0.5,0.24) : ti<2.5 ? vec3(0.78,0.66,0.3) : vec3(0.72,0.62,0.36); }\nvoid main(){\n  if(vWP.y<-0.05) discard;\n  if(uPass>0.5){ float ia=uAlpha; gl_FragColor=vec4(uInk*mix(1.0,0.75,uNight)*ia, ia); return; }\n  float f=floor(vF+0.001); float pat=mod(f,8.0); float two=mod(floor(f/8.0),2.0); float glow=mod(floor(f/16.0),2.0); float mt=floor(f/32.0+0.01);\n  vec3 n=normalize(vN); float back=0.0; if(two>0.5 && dot(n,uToCam)<0.0){ n=-n; back=1.0; }\n  float ndl=dot(n,uL); float dl=smoothstep(-0.25,0.55,ndl); if(uHD>0.5){ dl=clamp(floor(dl*4.0+bay4(gl_FragCoord.xy))/4.0,0.0,1.0); } float lit=0.62+(0.38*dl+0.07*smoothstep(0.7,0.95,ndl))*uKD+0.19*(1.0-uKD);\n  vec3 col=vC;\n  vec2 uv = abs(n.y)>0.6 ? vWP.xz : (abs(n.x)>abs(n.z) ? vWP.zy : vWP.xy);\n  vec4 nz=texture2D(uNoise, uv*0.045);\n  if(mt>0.5 && uMatQ<0.5){ col=mix(col, vC2, smoothstep(0.6,0.72,texture2D(uNoise, uv*0.17).r)*0.5); } // simple surface detail (battery saver)\n  else if(mt>0.5){ // v28 material\n    vec2 qa=vWP.zy, qb=vWP.xy; float wa=abs(n.x)/(abs(n.x)+abs(n.z)+1e-4); float up=smoothstep(0.25,0.8,n.y);\n    float bw=smoothstep(0.3,0.7,wa); vec4 A;\n    if(abs(n.y)>0.85) A=matAt(mt, vWP.xz, 1.0, vWP.y); else if(bw<0.01) A=matAt(mt, qb, up, vWP.y); else if(bw>0.99) A=matAt(mt, qa+vec2(41.0,0.0), up, vWP.y);\n    else A=mix(matAt(mt, qb, up, vWP.y), matAt(mt, qa+vec2(41.0,0.0), up, vWP.y), bw);\n    if(mt>8.5 && mt<9.5) col=uSoil*vC*1.25;\n    col=col*A.x; col=mix(col, vC2*0.8, clamp(A.y,0.0,1.0)); col=mix(col, tintC(A.w)*(0.75+0.35*dot(col,vec3(0.33))), clamp(A.z,0.0,1.0)*0.75); }\n  else if(pat>0.5){ float m=0.0;\n    if(pat<1.5) m=smoothstep(0.6,0.72,texture2D(uNoise, uv*0.17).r)*0.65;\n    else if(pat<2.5) m=smoothstep(0.72,0.95, sin(vWP.y*1.7+nz.g*5.0)*0.5+0.5)*0.55;\n    else if(pat<3.5) m=smoothstep(0.78,0.97, sin((uv.x*0.9+uv.y*0.12)*2.2+nz.b*6.0)*0.5+0.5)*0.5;\n    else if(pat<4.5) m=smoothstep(0.5,0.72,texture2D(uNoise, uv*0.25).g)*0.5;\n    else m=smoothstep(0.58,0.7,texture2D(uNoise, uv*0.32).b)*0.55;\n    col=mix(col, vC2, m); }\n  col*=lit*mix(uAmbC, uKeyC, dl*uKD); if(back>0.5){ col=mix(col, vec3(0.38,0.76,0.24), 0.28); col*=1.16; }\n  float fr=1.0-abs(dot(n,uToCam)); col*=1.0-0.22*fr*fr*fr;\n  float rim=pow(fr, 2.6); vec3 rimCol=mix(vec3(1.0,0.84,0.54), vec3(0.55,0.72,1.0), uNight); col+=rimCol*rim*0.16*uKD;\n  col*=0.9+0.2*nz.r;\n  col=mix(col, vec3(0.95,0.91,0.82), 0.07*(1.0-uHD));\n  if(uGnd.x>0.5){ float hb=vWP.y-uGnd.y; col*=mix(0.6,1.0,smoothstep(0.0,4.5,hb)); col=mix(col, uSoil, (1.0-smoothstep(0.3,2.6,hb))*0.55*step(uGnd.y,0.01)); }\n  vec3 o=grade(col, vWP);\n  if(glow>0.5) o=mix(o, mix(vC,vC2,0.6)*(0.8+0.25*fr), uNight*0.8);\n  o=mix(o, uGhost.rgb, uGhost.a);\n  float A=uAlpha;\n  gl_FragColor=vec4(o*A, A); }`, MESH_SIMPLE = MESH_FS.slice(0, MESH_FS.indexOf("  else if(mt>0.5){ // v28 material")).replace("mt>0.5 && uMatQ<0.5", "mt>0.5") + MESH_FS.slice(MESH_FS.indexOf("  else if(pat>0.5){")), TEX_VS = `attribute vec3 aP; attribute vec2 aUV; uniform float uZ; ${PROJ}\nvarying vec2 vUV; varying vec3 vWP; void main(){ vec3 q=proj(aP); q.z+=uZ; vUV=aUV; vWP=aP; gl_Position=clip(q); }`, TEX_FS = `precision highp float; varying vec2 vUV; varying vec3 vWP; uniform sampler2D uTex; uniform vec4 uCol; uniform float uLit; ${LAMPS}\nvoid main(){ vec4 t=texture2D(uTex,vUV)*uCol; vec3 c=t.rgb; if(uLit>0.5) c=grade(c, vWP); gl_FragColor=vec4(c*t.a, t.a); }`, SMASK_VS = "attribute vec3 aP; attribute float aA; uniform vec3 uL; uniform vec2 uDim; uniform float uFade; varying float vF; varying float vH; varying float vA;\nvoid main(){ float h=max(aP.y,0.0); vec2 g=aP.xz-uL.xz*(h/uL.y); vF=1.0-0.5*clamp(h/uFade,0.0,1.0); vH=clamp(h/uFade,0.0,1.0); vA=aA; gl_Position=vec4(g.x/uDim.x*2.0-1.0, g.y/uDim.y*2.0-1.0, 0.0, 1.0); }", SMASK_FS = "precision mediump float; varying float vF; varying float vH; varying float vA; uniform float uK;\nvoid main(){ gl_FragColor = uK<0.5 ? vec4(vF,0.0,vH,1.0) : vec4(0.0,vA,0.0,1.0); }", SBLUR_VS = "attribute vec2 aXY; attribute vec2 aUV; varying vec2 vUV; void main(){ vUV=aXY*0.5+0.5; gl_Position=vec4(aXY,0.0,1.0); }", SBLUR_FS = "precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform vec2 uD;\nvoid main(){ vec4 s=texture2D(uTex,vUV)*0.2270; s+=(texture2D(uTex,vUV+uD*1.3846)+texture2D(uTex,vUV-uD*1.3846))*0.3162; s+=(texture2D(uTex,vUV+uD*3.2308)+texture2D(uTex,vUV-uD*3.2308))*0.0703; gl_FragColor=s; }", SMIX_FS = "precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform sampler2D uTex2;\nvoid main(){ vec4 f=texture2D(uTex,vUV), c=texture2D(uTex2,vUV); float k=clamp(c.b*1.6,0.0,1.0); gl_FragColor=vec4(mix(f.r,c.r,k), max(f.g, c.g*0.9), c.b, 1.0); }", SHD_FS = "precision highp float; varying vec2 vUV; varying vec3 vWP; uniform sampler2D uTex; uniform sampler2D uNoise; uniform vec4 uCol; uniform vec2 uAmt; uniform float uMode;\nfloat m2(vec2 p){ return mod(2.0*p.x+3.0*p.y,4.0); }\nfloat bayer(vec2 p){ p=floor(mod(p,4.0)); return (4.0*m2(mod(p,2.0))+m2(floor(p/2.0))+0.5)/16.0; }\nvoid main(){ vec4 s=texture2D(uTex,vUV); float c=s.r, o=s.g;\n  if(uMode<0.5){ float n=texture2D(uNoise, vWP.xz*0.045).r, n2=texture2D(uNoise, vWP.xz*0.21).g; float e=c+(n-0.5)*0.32*smoothstep(0.02,0.3,c)+(n2-0.5)*0.08;\n    c=smoothstep(0.02,0.90,e); c+=0.22*smoothstep(0.08,0.3,e)*(1.0-smoothstep(0.3,0.62,e)); o=smoothstep(0.04,0.9,o+(n2-0.5)*0.12); }\n  else{ float d=bayer(gl_FragCoord.xy); c=floor(c*2.0+d*0.999)*0.5; o=floor(o*2.0+d*0.999)*0.5; }\n  float a=1.0-(1.0-c*uAmt.x)*(1.0-o*uAmt.y); a*=uCol.a; gl_FragColor=vec4(uCol.rgb*a, a); }", MOUND_VS = `attribute vec3 aP; attribute vec2 aUV; attribute float aA; attribute float aS; ${PROJ}\nvarying vec2 vUV; varying vec3 vWP; varying float vA; varying float vS; void main(){ vec3 q=proj(aP); vUV=aUV; vWP=aP; vA=aA; vS=aS; gl_Position=clip(q); }`, MOUND_FS = `precision highp float; varying vec2 vUV; varying vec3 vWP; varying float vA; varying float vS; uniform sampler2D uTex; uniform sampler2D uNoise; ${LAMPS}\nvoid main(){ vec3 c=texture2D(uTex,vUV).rgb*vS; float n=texture2D(uNoise, vWP.xz*0.11).r; float a=vA*smoothstep(0.0,0.55,vA+(n-0.5)*0.5); a=clamp(a,0.0,1.0); c=grade(c, vWP); gl_FragColor=vec4(c*a,a); }`, WET_VS = `attribute vec3 aP; attribute vec2 aUV; attribute float aW; ${PROJ}\nvarying vec2 vUV; varying vec3 vWP; varying float vW; void main(){ vec3 q=proj(aP); vUV=aUV; vWP=aP; vW=aW; gl_Position=clip(q); }`, WET_FS = `precision highp float; varying vec2 vUV; varying vec3 vWP; varying float vW; uniform sampler2D uTex; uniform sampler2D uNoise; uniform float uAm; ${LAMPS}\nvoid main(){ float n=texture2D(uNoise, vWP.xz*0.07).g; float a=smoothstep(0.15,0.75,vW+(n-0.5)*0.35)*uAm; if(a<0.004) discard; vec3 c=texture2D(uTex,vUV).rgb*vec3(0.5,0.53,0.58);\n  c=grade(c, vWP); gl_FragColor=vec4(c*a,a); }`, MARK_VS = `attribute vec3 aP; attribute vec2 aUV; attribute vec4 aC; attribute float aK; ${PROJ}\nvarying vec2 vUV; varying vec3 vWP; varying vec4 vC; varying float vK; void main(){ vec3 q=proj(aP); q.z-=2.0; vUV=aUV; vWP=aP; vC=aC; vK=aK; gl_Position=clip(q); }`, MARK_FS = `precision highp float; varying vec2 vUV; varying vec3 vWP; varying vec4 vC; varying float vK; uniform sampler2D uNoise; ${LAMPS}\nvoid main(){ vec2 d=vUV*2.0-1.0; float n=texture2D(uNoise, vWP.xz*0.23).r; float r=length(d)*(0.86+0.28*n); float a;\n  if(vK<0.5) a=1.0-smoothstep(0.3,1.0,r); else if(vK<1.5) a=smoothstep(0.42,0.72,r)*(1.0-smoothstep(0.78,1.0,r)); else a=1.0-smoothstep(0.7,1.0,r);\n  if(a<0.004) discard; vec3 c=vC.rgb;\n  if(vK>1.5){ float hl=1.0-smoothstep(0.0,0.45,length(d-vec2(-0.32,-0.3))); c=mix(c*0.82, c, smoothstep(0.35,0.95,r)); c=mix(c, vec3(0.9,0.95,0.97), hl*0.55); }\n  c=grade(c, vWP); float A=a*vC.a; gl_FragColor=vec4(c*A,A); }`, LINE_VS = `attribute vec3 aA; attribute vec3 aB; attribute vec2 aS; attribute float aW; attribute float aAl; attribute vec3 aCol; attribute vec2 aSw;\nuniform vec3 uSway; uniform vec3 uWind; uniform float uLW; uniform float uMinW; ${PROJ}\nvarying vec4 vC; varying vec3 vWP;\nvoid main(){ vec3 pa=aA+uSway*mod(aSw.x,2.0)+uWind*(floor(aSw.x/2.0)/255.0), pb=aB+uSway*mod(aSw.y,2.0)+uWind*(floor(aSw.y/2.0)/255.0); vec3 qa=proj(pa), qb=proj(pb); vec2 dir=qb.xy-qa.xy; float l=length(dir); dir = l>1e-4 ? dir/l : vec2(1.0,0.0);\n  vec2 nr=vec2(-dir.y,dir.x); float w=max(aW*uLW, uMinW); vec3 q=mix(qa,qb,aS.y); q.xy+=nr*aS.x*w*0.5+dir*(aS.y*2.0-1.0)*w*0.35; q.z-=0.25; vC=vec4(aCol,aAl); vWP=mix(pa,pb,aS.y); gl_Position=clip(q); }`, LINE_FS = `precision highp float; varying vec4 vC; varying vec3 vWP; uniform float uAlpha; uniform float uLitL; ${LAMPS}\nvoid main(){ vec3 c=vC.rgb; if(uLitL>0.5) c=grade(c,vWP); else c*=mix(1.0,0.75,uNight); float a=vC.a*uAlpha; gl_FragColor=vec4(c*a,a); }`;
    function mkCanvas(w, h) {
        const c = document.createElement("canvas");
        return c.width = Math.max(1, 0 | w), c.height = Math.max(1, 0 | h), c;
    }
    const PAPER = [ .945, .905, .815 ], NEUTRAL = {
        kd: 1,
        key: [ 1, 1, 1 ],
        amb: [ 1, 1, 1 ]
    };
    const towardPaper = (h, t) => {
        JT.HD2D && JT.HD2D.on && (t *= .3);
        const c = (h => GM.rgb(h))(h);
        const SK = JT.SKY || {}, gr = SK.grade || [1,1,1];
        const lum = Math.max(0, Math.min(1, (gr[0] + gr[1] + gr[2]) / 3));
        const pR = 0.82 + (0.95 - 0.82) * lum, pG = 0.86 + (0.91 - 0.86) * lum, pB = 0.94 + (0.82 - 0.94) * lum;
        return (c => "#" + c.map(x => Math.max(0, Math.min(255, Math.round(255 * x))).toString(16).padStart(2, "0")).join(""))([ c[0] + (pR - c[0]) * t, c[1] + (pG - c[1]) * t, c[2] + (pB - c[2]) * t ]);
    }, BLIT_VS = "#version 300 es\nin vec2 aXY; void main(){ gl_Position=vec4(aXY,0.5,1.0); }", BLIT_FS = "#version 300 es\nprecision highp float; uniform sampler2D uCol; uniform highp sampler2D uDep; out vec4 oC;\nvoid main(){ ivec2 p=ivec2(gl_FragCoord.xy); oC=texelFetch(uCol,p,0); gl_FragDepth=texelFetch(uDep,p,0).r; }", UPS_FS = "#version 300 es\nprecision highp float; uniform sampler2D uCol; uniform vec4 uS; out vec4 oC;\nvoid main(){ vec2 q=clamp(gl_FragCoord.xy*uS.xy, vec2(0.5), uS.zw-0.5); oC=texture(uCol, q/vec2(textureSize(uCol,0))); }";
    JT.GLPaint = class {
        constructor(canvas, R) {
            const opts = {
                alpha: !1,
                antialias: !1,
                premultipliedAlpha: !0,
                depth: !0,
                stencil: !1,
                powerPreference: "low-power"
            }, gl = canvas.getContext("webgl2", opts) || canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
            if (!gl) throw new Error("no webgl");
            this.gl = gl, this.cv = canvas, this.R = R, this.gl2 = "undefined" != typeof WebGL2RenderingContext && gl instanceof WebGL2RenderingContext, 
            this.uintOK = this.gl2 || !!gl.getExtension("OES_element_index_uint");
            try {
                gl.getExtension("KHR_parallel_shader_compile");
            } catch (e) {}
            this._defer = [], this.P = {
                mesh: this.prog(MESH_VS, MESH_FS),
                meshS: this.prog(MESH_VS, MESH_SIMPLE),
                tex: this.prog(TEX_VS, TEX_FS),
                scr: this.prog("attribute vec2 aXY; attribute vec2 aUV; varying vec2 vUV; void main(){ vUV=aUV; gl_Position=vec4(aXY,0.999,1.0); }", "precision highp float; varying vec2 vUV; uniform sampler2D uTex; uniform vec4 uCol; uniform float uMode; uniform vec2 uRes; uniform vec2 uJit;\nvoid main(){ if(uMode<0.5){ vec4 t=texture2D(uTex,vUV); gl_FragColor=vec4(t.rgb*uCol.rgb,1.0); return; }\n  vec2 px=vUV*uRes; float g=texture2D(uTex, (px+uJit)/256.0).r; float g2=texture2D(uTex, px/731.0+vec2(0.37,0.11)).g;\n  vec2 d=vUV-0.5; float vig=1.0-smoothstep(0.35,0.85,length(d*vec2(1.0,1.15)))*uCol.a;\n  float m=(0.9+0.1*g)*(0.95+0.05*g2)*vig; gl_FragColor=vec4(vec3(m)*uCol.rgb,1.0); }"),
                spr: this.prog("attribute vec2 aXY; attribute float aZ; attribute vec2 aUV; attribute vec4 aT; uniform vec2 uRes; varying vec2 vUV; varying vec4 vT;\nvoid main(){ vUV=aUV; vT=aT; gl_Position=vec4(aXY.x/uRes.x*2.0-1.0, 1.0-aXY.y/uRes.y*2.0, clamp(aZ*0.0011,-0.999,0.999), 1.0); }", "precision highp float; varying vec2 vUV; varying vec4 vT; uniform sampler2D uTex; uniform vec2 uTexel; uniform vec3 uInk; uniform float uInkAmt; uniform float uAlpha; uniform float uPm; uniform float uHD; uniform sampler2D uDepT; uniform vec2 uOut; uniform float uOcc; uniform float uPx; uniform float uCut;\nfloat b2(vec2 q){ return mod(2.0*q.x+3.0*q.y,4.0); }\nfloat bay4(vec2 p){ p=mod(floor(p),4.0); return (4.0*b2(mod(p,2.0))+b2(floor(p/2.0))+0.5)/16.0; }\nvec4 S(vec2 uv){ vec4 c=texture2D(uTex,uv); if(uPm>0.5) c.rgb*=c.a; return c; }\nfloat lm(vec3 c){ return dot(c, vec3(0.3,0.59,0.11)); }\nvoid main(){ if(uOcc>0.5){ float sd=texture2D(uDepT, gl_FragCoord.xy/uOut).r; bool hid = gl_FragCoord.z > sd + 0.0004; if(uOcc<1.5 ? hid : !hid) discard; }\n  float sc=vT.a; vec3 rgb; float a;\n  if(uHD>0.5){\n    // HD-2D: the critter is resampled onto the scene's own pixel grid (one block per scene pixel), its soft painted light\n    // banded into dithered steps with a little extra colour, and given a 1-pixel dark outline\n    vec2 cell=floor(gl_FragCoord.xy/uPx); vec2 off=((cell+0.5)*uPx-gl_FragCoord.xy)*sc; vec2 uv=vUV+vec2(off.x,-off.y)*uTexel;\n    vec4 c=S(uv); if(c.a>0.4){ c.rgb/=max(c.a,0.001); c.a=1.0; } else c=vec4(0.0);\n    if(c.a>0.5){ float l=lm(c.rgb); float q=clamp(floor(l*6.0+bay4(cell))/6.0, 0.05, 1.0); vec3 sat=clamp(mix(vec3(l),c.rgb,1.22),0.0,1.0); c.rgb=clamp(sat*(q+0.08)/(l+0.08),0.0,1.0); }\n    vec2 d=uTexel*uPx*sc;\n    float an=max(max(S(uv+vec2(d.x,0.0)).a, S(uv-vec2(d.x,0.0)).a), max(S(uv+vec2(0.0,d.y)).a, S(uv-vec2(0.0,d.y)).a));\n    float ink=step(0.4,an)*(1.0-c.a)*uInkAmt; rgb=c.rgb*vT.rgb+uInk*ink; a=c.a+ink*(1.0-c.a);\n  } else {\n    vec4 c=S(vUV); vec2 d=uTexel*1.3;\n    float an=max(max(texture2D(uTex,vUV+vec2(d.x,0.0)).a, texture2D(uTex,vUV-vec2(d.x,0.0)).a), max(texture2D(uTex,vUV+vec2(0.0,d.y)).a, texture2D(uTex,vUV-vec2(0.0,d.y)).a));\n    float ink=smoothstep(0.3,0.75,an)*(1.0-smoothstep(0.05,0.6,c.a))*uInkAmt;\n    rgb=c.rgb*vT.rgb + uInk*ink*(1.0-c.a); a=c.a+ink*(1.0-c.a);\n  }\n  gl_FragColor=vec4(rgb,a)*uAlpha; }"),
                line: this.prog(LINE_VS, LINE_FS),
                mound: this.prog(MOUND_VS, MOUND_FS),
                wet: this.prog(WET_VS, WET_FS),
                mark: this.prog(MARK_VS, MARK_FS)
            };
            const extra = {
                smask: [ SMASK_VS, SMASK_FS ],
                sblur: [ SBLUR_VS, SBLUR_FS ],
                smix: [ SBLUR_VS, SMIX_FS ],
                shd: [ TEX_VS, SHD_FS ]
            };
            this.gl2 && (extra.blit = [ BLIT_VS, BLIT_FS ], extra.ups = [ BLIT_VS, UPS_FS ]);
            for (const k in extra) try {
                this.P[k] = this.prog(extra[k][0], extra[k][1]);
            } catch (e) {}
            {
                const pend = this._defer;
                this._defer = null;
                for (const P of pend) try {
                    this.finishProg(P);
                } catch (e) {
                    let n = null;
                    for (const k in this.P) this.P[k] === P && (n = k);
                    if (!n || !(n in extra)) throw e;
                    this.P[n] = "ups" !== n && null;
                }
            }
            this.tex = {
                noise: this.texFrom(this.noiseCanvas(), !0),
                paper: this.texFrom(this.paperCanvas(), !0),
                radial: this.texFrom(this.radialCanvas(), !1),
                cell: this.texFrom(this.cellCanvas(), !0)
            }, this.bufs = {}, this.atlas = mkCanvas(1024, 256), this.actx = this.atlas.getContext("2d"), 
            this.atex = gl.createTexture(), this.V2 = new JT.View(0, 0, 1, 0, 0, [ 0, 0, 0 ]), 
            this.dyn = {}; this.lost = false;
            this._onLost = (e) => { e.preventDefault(); this.lost = true; this._edgeA = this._edgePB = null; };
            this._onRestored = () => {
                if (R.gp !== this) return;
                canvas.removeEventListener('webglcontextlost', this._onLost);
                canvas.removeEventListener('webglcontextrestored', this._onRestored);
                try {
                    // Programs, buffers and textures from a lost context cannot be reused.
                    if (JT.HD2D) { JT.HD2D._P = null; JT.HD2D._was = null; }
                    for (const hab of R.game.habs) for (const g of Object.values(hab.geoms)) delete g._mesh;
                    R.gp = new JT.GLPaint(canvas, R); R._glErr = 0; R.resetCaches(); R.resize();
                } catch (error) {
                    this.lost = true; console.error('Graphics recovery failed', error);
                    if (JT.UI) JT.UI.toast('Graphics could not recover. Save your progress and reload.');
                }
            };
            canvas.addEventListener('webglcontextlost', this._onLost);
            canvas.addEventListener('webglcontextrestored', this._onRestored);
            const q = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, q), gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -1, -1, 0, 1, 1, -1, 1, 1, 1, 1, 1, 0, -1, -1, 0, 1, 1, 1, 1, 0, -1, 1, 0, 0 ]), gl.STATIC_DRAW), 
            this.quad = q;
        }
        cacheFree(dead) {
            const gl = this.gl, C = this._cache;
            if (C) {
                for (const k of [ "ms", "rs" ]) C[k] && gl.deleteFramebuffer(C[k]);
                for (const k of [ "crb", "drb" ]) C[k] && gl.deleteRenderbuffer(C[k]);
                for (const k of [ "ct", "dt" ]) C[k] && gl.deleteTexture(C[k]);
            }
            this._cache = dead ? {
                dead: !0
            } : null;
        }
        cacheAlloc(W, H) {
            const gl = this.gl;
            this.cacheFree();
            const C = {
                W: W,
                H: H,
                key: null
            };
            try {
                this.P.blit || (this.P.blit = this.prog(BLIT_VS, BLIT_FS));
                const ns = Math.max(0, Math.min(4, 0 | gl.getParameter(gl.MAX_SAMPLES))), aa = this._tgtFB ? 0 : gl.getContextAttributes && gl.getContextAttributes().antialias ? ns : 0;
                C.crb = gl.createRenderbuffer(), gl.bindRenderbuffer(gl.RENDERBUFFER, C.crb), gl.renderbufferStorageMultisample(gl.RENDERBUFFER, aa, gl.RGBA8, W, H), 
                C.drb = gl.createRenderbuffer(), gl.bindRenderbuffer(gl.RENDERBUFFER, C.drb), gl.renderbufferStorageMultisample(gl.RENDERBUFFER, aa, gl.DEPTH_COMPONENT24, W, H), 
                C.ms = gl.createFramebuffer(), gl.bindFramebuffer(gl.FRAMEBUFFER, C.ms), gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, C.crb), 
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, C.drb);
                const ok1 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE, tx = (ifmt, fmt, type) => {
                    const t = gl.createTexture();
                    return gl.bindTexture(gl.TEXTURE_2D, t), gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST), 
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST), gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE), 
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE), gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, W, H, 0, fmt, type, null), 
                    t;
                };
                C.ct = tx(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE), gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR), 
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR), C.dt = tx(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT), 
                C.rs = gl.createFramebuffer(), gl.bindFramebuffer(gl.FRAMEBUFFER, C.rs), gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, C.ct, 0), 
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, C.dt, 0);
                const ok2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
                return gl.bindFramebuffer(gl.FRAMEBUFFER, this._tgtFB || null), gl.bindRenderbuffer(gl.RENDERBUFFER, null), 
                this._cache = C, ok1 && ok2 ? C : (this.cacheFree(!0), null);
            } catch (e) {
                JT.DEV && console.warn("cache", e);
                try {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                } catch (e2) {}
                return this._cache = C, this.cacheFree(!0), null;
            }
        }
        splitScale(HDT, PT) {
            const s = this.R.softS || 1;
            return !this.gl2 || this._splitBroken || s > .97 || HDT || PT.ptNoSplit || this._cache && this._cache.dead ? 0 : Math.max(.5, s);
        }
        cacheMode(V, hab, hg, gt, PT, live, night, W, H) {
            this.gl;
            const R = this.R;
            if (!this.gl2 || PT.ptNoCache || R.ghost || this._cache && this._cache.dead) return "direct";
            const vk = V.yaw + "," + V.pitch + "," + V.s + "," + V.cx + "," + V.cy + "," + V.c[0] + "," + V.c[1] + "," + V.c[2] + "," + W + "x" + H, now = performance.now();
            if (this._cache && !this._cache.dead && now - (this._cache.used || now) > 15e3 && this.cacheFree(), 
            vk !== this._cvk) return this._cvk = vk, this._still = 0, "direct";
            this._still = (this._still || 0) + 1;
            const F = this.F, SK = F.sky || NEUTRAL, L = JT.LIGHT, TR = JT.Terrain, tm = hg.ter && !PT.ptNoTer ? this.terrainMesh(hab, hg) : null, gm = TR ? this.groundMarks(hab, night) : null, wet = TR ? (TR.WET[hab.data.substrate] || 0) * M.clamp((hab.data.humidity - .35) / .6, 0, 1) : 0, WFw = this._wxF, rw = WFw && WFw.hab === hab && WFw.wet || 0, gmT = gm && gm.n ? gm.sig + ":" + gm.n + ":" + Math.floor(gm.t / 1.5) : "-";
            gmT !== this._gmRaw && (void 0 === this._gmRaw || now - (this._gmTokT || 0) > 800 || "-" === gmT != ("-" === this._gmRaw)) && (this._gmRaw = gmT, 
            this._gmTok = gmT, this._gmTokT = now);
            const gmTok = this._gmTok || "-", key = vk + "|" + hg.key + "|" + hab.data.bg + "|" + gt.key + "|" + F.lamps.length + "|" + (tm ? tm.lk + ":" + tm.n : "-") + "|" + Math.round(20 * wet) + "," + Math.round(20 * rw) + "|" + gmTok + "|" + (hg.csKey || "") + "|" + (PT.ptNoInk ? 1 : 0) + "|" + live.map(o => o.inst.id).join(","), soft = [ F.grade[0], F.grade[1], F.grade[2], night, SK.kd, SK.key[0], SK.key[1], SK.key[2], SK.amb[0], SK.amb[1], SK.amb[2], L[0], L[1], L[2] ];
            for (let i = 0; i < F.lampU.length; i++) soft.push(F.lampU[i]);
            let C = this._cache;
            if (C && C.key === key && C.W === W && C.H === H && C.soft && C.soft.length === soft.length) {
                let d = 0;
                for (let i = 0; i < soft.length; i++) d = Math.max(d, Math.abs(soft[i] - C.soft[i]));
                if (d <= 3 / 256 && !(d > .5 / 256 && now - C.t > 1e3)) return C.used = now, "blit";
            }
            return this._still < 2 ? "direct" : C && C.W === W && C.H === H || (C = this.cacheAlloc(W, H), 
            C) ? (C.soft = soft, C.t = now, C.key = key, C.used = now, C.builds = (C.builds || 0) + 1, 
            "build") : "direct";
        }
        prog(vs, fs) {
            const gl = this.gl, sh = (t, s) => {
                const o = gl.createShader(t);
                return gl.shaderSource(o, s), gl.compileShader(o), o;
            }, p = gl.createProgram(), v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
            gl.attachShader(p, v), gl.attachShader(p, f), gl.linkProgram(p);
            const P = {
                p: p,
                a: {},
                u: {},
                _sh: [ v, f ]
            };
            return this._defer ? (this._defer.push(P), P) : this.finishProg(P);
        }
        finishProg(P) {
            const gl = this.gl, p = P.p, sh = P._sh;
            if (delete P._sh, !gl.getProgramParameter(p, gl.LINK_STATUS)) {
                for (const o of sh || []) if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(o));
                throw new Error("link: " + gl.getProgramInfoLog(p));
            }
            const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
            for (let i = 0; i < na; i++) {
                const a = gl.getActiveAttrib(p, i);
                P.a[a.name] = gl.getAttribLocation(p, a.name);
            }
            const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < nu; i++) {
                const u = gl.getActiveUniform(p, i), nm = u.name.replace(/\[0\]$/, "");
                P.u[nm] = gl.getUniformLocation(p, u.name);
            }
            return P;
        }
        use(P) {
            if (this.cur === P) return P;
            const gl = this.gl;
            if (this.cur) for (const k in this.cur.a) gl.disableVertexAttribArray(this.cur.a[k]);
            return gl.useProgram(P.p), this.cur = P, P;
        }
        attribs(P, layout, stride) {
            const gl = this.gl;
            let off = 0;
            for (const [nm, n] of layout) {
                const loc = P.a[nm];
                null != loc && loc >= 0 && (gl.enableVertexAttribArray(loc), gl.vertexAttribPointer(loc, n, gl.FLOAT, !1, 4 * stride, 4 * off)), 
                off += n;
            }
        }
        texFrom(cv, repeat) {
            const gl = this.gl, t = gl.createTexture();
            return gl.bindTexture(gl.TEXTURE_2D, t), gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1), 
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv), this.texParams(repeat), 
            t;
        }
        texParams(repeat, mip) {
            const gl = this.gl, w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w), gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w), 
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR), gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
        buf(data, kind) {
            const gl = this.gl, b = gl.createBuffer(), t = "idx" === kind ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
            return gl.bindBuffer(t, b), gl.bufferData(t, data, gl.STATIC_DRAW), b;
        }
        view(P, V) {
            const gl = this.gl;
            gl.uniform3f(P.u.uC, V.c[0], V.c[1], V.c[2]), gl.uniform4f(P.u.uRot, V.cy_, V.sy_, V.cp, V.sp), 
            gl.uniform4f(P.u.uScr, V.s, V.cx, V.cy, 0);
            const r = this._res;
            gl.uniform2f(P.u.uRes, r ? r[0] : this.cv.width, r ? r[1] : this.cv.height);
        }
        meshProg() {
            const st = this.R.set || {};
            if (null == this._swGL) {
                let r = "";
                try {
                    const gl = this.gl, x = gl.getExtension("WEBGL_debug_renderer_info");
                    r = String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
                } catch (e) {}
                this._swGL = /swiftshader|llvmpipe|software|basic render/i.test(r);
            }
            return "simple" === st.detail || "saver" === st.fps || !st.detail && this._swGL ? this.P.meshS : this.P.mesh;
        }
        light(P) {
            const gl = this.gl, F = this.F;
            P.u.uGrade && gl.uniform3f(P.u.uGrade, F.grade[0], F.grade[1], F.grade[2]), P.u.uNight && gl.uniform1f(P.u.uNight, F.night), 
            P.u.uNL && gl.uniform1f(P.u.uNL, F.lamps.length / 4), P.u.uLamp && gl.uniform4fv(P.u.uLamp, F.lampU);
            const S = F.sky || NEUTRAL;
            P.u.uKD && gl.uniform1f(P.u.uKD, S.kd), P.u.uKeyC && gl.uniform3f(P.u.uKeyC, S.key[0], S.key[1], S.key[2]), 
            P.u.uAmbC && gl.uniform3f(P.u.uAmbC, S.amb[0], S.amb[1], S.amb[2]), P.u.uMatQ && gl.uniform1f(P.u.uMatQ, P === this.P.meshS ? 0 : 1), 
            P.u.uCell && this.tex.cell && (gl.activeTexture(gl.TEXTURE3), gl.bindTexture(gl.TEXTURE_2D, this.tex.cell), 
            gl.uniform1i(P.u.uCell, 3), gl.activeTexture(gl.TEXTURE0));
        }
        cellCanvas() {
            const N = 512, C = 16, c = mkCanvas(N, N), g = c.getContext("2d"), id = g.createImageData(N, N), rng = JT.makeRng(4242), P = [];
            for (let i = 0; i < 256; i++) P.push([ .1 + .8 * rng(), .1 + .8 * rng(), rng() ]);
            const at = (i, j) => P[(j % C + C) % C * C + (i % C + C) % C];
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                const u = x / N * C, v = y / N * C, xi = Math.floor(u), yi = Math.floor(v);
                let d1 = 9, d2 = 9, cid = 0;
                for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
                    const q = at(xi + i, yi + j), dx = xi + i + q[0] - u, dy = yi + j + q[1] - v, dd = dx * dx + dy * dy;
                    dd < d1 ? (d2 = d1, d1 = dd, cid = q[2]) : dd < d2 && (d2 = dd);
                }
                const k = 4 * (y * N + x);
                d1 = Math.sqrt(d1), id.data[k] = Math.min(255, 200 * d1), id.data[k + 1] = Math.min(255, 255 * (Math.sqrt(d2) - d1)), 
                id.data[k + 2] = 255 * cid, id.data[k + 3] = 255;
            }
            return g.putImageData(id, 0, 0), c;
        }
        noiseCanvas() {
            const N = 256, c = mkCanvas(N, N), g = c.getContext("2d"), id = g.createImageData(N, N), rng = JT.makeRng(99), grid = s => {
                const a = [];
                for (let i = 0; i < s * s; i++) a.push(rng());
                return (x, y) => {
                    const X = x * s, Y = y * s, x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0, at = (i, j) => a[(j % s + s) % s * s + (i % s + s) % s], sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
                    return M.lerp(M.lerp(at(x0, y0), at(x0 + 1, y0), sx), M.lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx), sy);
                };
            }, o = [ grid(4), grid(8), grid(16), grid(32), grid(64) ];
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                const u = x / N, v = y / N, i = 4 * (y * N + x);
                id.data[i] = 255 * (.5 * o[1](u, v) + .3 * o[2](u, v) + .2 * o[3](u, v)), id.data[i + 1] = 255 * (.55 * o[0](u, v) + .3 * o[1](u, v) + .15 * o[3](u, v)), 
                id.data[i + 2] = 255 * (.4 * o[2](u, v) + .35 * o[3](u, v) + .25 * o[4](u, v)), 
                id.data[i + 3] = 255;
            }
            return g.putImageData(id, 0, 0), c;
        }
        paperCanvas() {
            const N = 256, c = mkCanvas(N, N), g = c.getContext("2d"), id = g.createImageData(N, N), rng = JT.makeRng(5);
            for (let i = 0; i < N * N; i++) {
                const v = 200 + 55 * rng();
                id.data[4 * i] = v, id.data[4 * i + 1] = 230 + 25 * rng(), id.data[4 * i + 2] = v, 
                id.data[4 * i + 3] = 255;
            }
            g.putImageData(id, 0, 0), g.globalAlpha = .25, g.strokeStyle = "#b8b8b8", g.lineWidth = .6;
            for (let k = 0; k < 70; k++) {
                const x = rng() * N, y = rng() * N, a = 6.28 * rng(), l = 4 + 14 * rng();
                g.beginPath(), g.moveTo(x, y), g.quadraticCurveTo(x + Math.cos(a + .5) * l * .5, y + Math.sin(a + .5) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l), 
                g.stroke();
            }
            return g.globalAlpha = .5, g.filter = "blur(0.6px)", g.drawImage(c, 0, 0), c;
        }
        radialCanvas() {
            const c = mkCanvas(128, 128), g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
            return gr.addColorStop(0, "rgba(255,255,255,1)"), gr.addColorStop(.5, "rgba(255,255,255,0.55)"), 
            gr.addColorStop(1, "rgba(255,255,255,0)"), g.fillStyle = gr, g.fillRect(0, 0, 128, 128), 
            c;
        }
        wash(g, x, y, r, col, a, rng, sq) {
            sq = sq || 1, g.save(), g.translate(x, y), g.scale(1, sq), g.beginPath();
            const pts = [];
            for (let i = 0; i < 11; i++) {
                const t = i / 11 * 6.283, k = 1 + .28 * (rng() - .5);
                pts.push([ Math.cos(t) * r * k, Math.sin(t) * r * k ]);
            }
            for (let i = 0; i < 11; i++) {
                const p = pts[i], q = pts[(i + 1) % 11], m = [ (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 ];
                i ? g.quadraticCurveTo(p[0], p[1], m[0], m[1]) : g.moveTo(m[0], m[1]);
            }
            const p = pts[0], q = pts[1];
            g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2), g.closePath(), 
            g.globalAlpha = a, g.fillStyle = col, g.fill(), g.globalAlpha = .35 * a, g.strokeStyle = col, 
            g.lineWidth = Math.max(1, .035 * r), g.stroke(), g.restore(), g.globalAlpha = 1;
        }
        bgTexture(id) {
            if (this.bgT = this.bgT || {}, this.bgT[id]) return this.bgT[id];
            if (JT.HD2D && JT.HD2D.on && this.gl2) return this.bgT[id] = this.texFrom(JT.HD2D.bgCanvas(id), !1);
            const B = JT.BACKGROUNDS[id] || JT.BACKGROUNDS.mossy, W = 768, H = 512, c = mkCanvas(W, H), g = c.getContext("2d"), rng = JT.makeRng(JT.hashStr("bg" + id)), gr = g.createLinearGradient(0, 0, 0, H);
            gr.addColorStop(0, towardPaper(B.sky[0], .8)), gr.addColorStop(.6, towardPaper(B.sky[1], .78)), 
            gr.addColorStop(1, towardPaper(B.sky[2], .74)), g.fillStyle = gr, g.fillRect(0, 0, W, H);
            for (let i = 0; i < 26; i++) this.wash(g, rng() * W, rng() * H * .9, 30 + 90 * rng(), towardPaper(rng.pick(B.blobs), .5 + .2 * rng()), .12 + .12 * rng(), rng, .75 + .4 * rng());
            for (let i = 0; i < 10; i++) this.wash(g, rng() * W, rng() * H * .6, 6 + 14 * rng(), towardPaper(B.light, .3), .18, rng);
            return this.bgT[id] = this.texFrom(c, !1);
        }
        groundTexture(hab) {
            const S = JT.SUBSTRATES[hab.data.substrate] || JT.SUBSTRATES.coco, key = hab.data.substrate + "|" + hab.data.type + "|" + hab.dims.w + "x" + hab.dims.d;
            if (this.gT && this.gT.key === key) return this.gT;
            const W = 1024, H = Math.max(256, Math.round(1024 * hab.dims.d / hab.dims.w)), c = mkCanvas(W, H), g = c.getContext("2d"), rng = JT.makeRng(JT.hashStr(key));
            g.fillStyle = towardPaper(S.top, .22), g.fillRect(0, 0, W, H);
            for (let i = 0; i < 60; i++) this.wash(g, rng() * W, rng() * H, 30 + 110 * rng(), rng() < .5 ? towardPaper(S.mid, .1) : towardPaper(S.top, .4), .12 + .1 * rng(), rng, .8 + .4 * rng());
            const n = Math.round(W * H / 380);
            for (let i = 0; i < n; i++) {
                const x = rng() * W, y = rng() * H, r = .8 + 2.6 * rng();
                g.globalAlpha = .35 + .5 * rng(), g.fillStyle = rng() < .5 ? S.speck[0] : S.speck[1], 
                g.beginPath(), g.ellipse(x, y, r, r * (.6 + .5 * rng()), 3 * rng(), 0, 6.283), g.fill();
            }
            g.globalAlpha = 1;
            const eg = g.createRadialGradient(512, H / 2, .3 * Math.min(W, H), 512, H / 2, .55 * Math.hypot(W, H));
            eg.addColorStop(0, "rgba(40,25,10,0)"), eg.addColorStop(1, "rgba(40,25,10,0.22)"), 
            g.fillStyle = eg, g.fillRect(0, 0, W, H);
            const side = mkCanvas(512, 128), s = side.getContext("2d");
            s.fillStyle = towardPaper(S.mid, .1), s.fillRect(0, 0, 512, 60), s.fillStyle = towardPaper("#4a2e18", .12), 
            s.fillRect(0, 60, 512, 68);
            for (let i = 0; i < 70; i++) this.wash(s, 512 * rng(), 66 + 60 * rng(), 4 + 9 * rng(), rng() < .5 ? "#2e1d10" : towardPaper(S.mid, .3), .55, rng, .6);
            for (let i = 0; i < 40; i++) this.wash(s, 512 * rng(), 58 * rng(), 3 + 7 * rng(), rng() < .5 ? S.speck[1] : S.speck[0], .5, rng, .6);
            s.fillStyle = "rgba(40,25,12,0.6)", s.fillRect(0, 0, 512, 2), this.gT && (this.gl.deleteTexture(this.gT.t), 
            this.gl.deleteTexture(this.gT.s));
            const oc = mkCanvas(1, 1).getContext("2d");
            oc.drawImage(c, 0, 0, 1, 1);
            const px = oc.getImageData(0, 0, 1, 1).data;
            return this.gT = {
                key: key,
                t: this.texFrom(c, !1),
                s: this.texFrom(side, !0),
                avg: [ px[0] / 255, px[1] / 255, px[2] / 255 ]
            }, this.gT;
        }
        habGeom(hab) {
            const R = this.R, TR = JT.Terrain, ter = TR ? TR.get(hab) : null, tq = "low" === R.quality ? 2 : 1, key = hab.data.id + "|" + hab._geomVersion + "|" + hab.dims.w + "|" + hab.dims.d + "|" + hab.data.type + "|" + (ter ? ter.key : "") + "|" + tq;
            if (this.hg && this.hg.key === key) return this.hg;
            const gl = this.gl;
            if (this.hg) {
                for (const b of this.hg.del) gl.deleteBuffer(b);
                this.hg.cs && this.hg.cs.b && gl.deleteBuffer(this.hg.cs.b), this.hg.tm && (gl.deleteBuffer(this.hg.tm.vb), 
                gl.deleteBuffer(this.hg.tm.ib));
            }
            const hAt = (x, z) => ter && ter.max > 0 ? TR.at(hab, x, z) : 0, del = [], poly = R.floorPoly(hab), n = poly.length, c = G.centroid(poly), dm = hab.dims, fl = [], V5 = q => [ q[0], 0, q[1], q[0] / dm.w, q[1] / dm.d ];
            for (let i = 0; i < n; i++) fl.push(...V5(c), ...V5(poly[i]), ...V5(poly[(i + 1) % n]));
            const floor = this.buf(new Float32Array(fl));
            del.push(floor);
            const sides = [], sv = [];
            let u = 0;
            for (let i = 0; i < n; i++) {
                const a = poly[i], b = poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), u1 = u + L / 70, y1 = -15, ns = Math.max(1, Math.min(40, Math.ceil(L / 4))), sb = sv.length;
                for (let s2 = 0; s2 < ns; s2++) {
                    const t0 = s2 / ns, t1 = (s2 + 1) / ns, ax = a[0] + (b[0] - a[0]) * t0, az = a[1] + (b[1] - a[1]) * t0, bx = a[0] + (b[0] - a[0]) * t1, bz = a[1] + (b[1] - a[1]) * t1, ua = u + (u1 - u) * t0, ub = u + (u1 - u) * t1, ya = hAt(ax, az), yb = hAt(bx, bz);
                    sv.push(ax, ya, az, ua, 0, bx, yb, bz, ub, 0, bx, y1, bz, ub, 1, ax, ya, az, ua, 0, bx, y1, bz, ub, 1, ax, y1, az, ua, 1);
                }
                let nx = b[1] - a[1], nz = -(b[0] - a[0]);
                const l = Math.hypot(nx, nz) || 1;
                nx /= l, nz /= l, nx * ((a[0] + b[0]) / 2 - c[0]) + nz * ((a[1] + b[1]) / 2 - c[1]) < 0 && (nx = -nx, 
                nz = -nz), sides.push([ nx, nz, sb / 5, (sv.length - sb) / 5 ]), u = u1;
            }
            const side = this.buf(new Float32Array(sv));
            del.push(side);
            const meshes = [], tkey = ter ? ter.key : "";
            for (const inst of hab.decor) {
                const g = hab.geoms[inst.id];
                if (!g) continue;
                const m = GM.build(g);
                if (m.n) {
                    if (TR && TR.rides(g.def) && !inst.parent && (m._tk || "") !== tkey && (m._v0 || ter && ter.max > 0)) {
                        m._v0 || (m._v0 = m.verts.slice(), m._l0 = m.lines ? m.lines.slice() : null);
                        const S = GM.STRIDE, v = m.verts = m._v0.slice();
                        for (let o = 0; o < v.length; o += S) v[o + 1] += hAt(v[o], v[o + 2]);
                        if (m._l0) {
                            const l = m.lines = m._l0.slice();
                            for (let o = 0; o < l.length; o += 15) l[o + 1] += hAt(l[o], l[o + 2]), l[o + 4] += hAt(l[o + 3], l[o + 5]);
                        }
                        m._tk = tkey, m.vb && m.gl === this && this.free(m), m.vb = null;
                    }
                    m.vb && m.gl === this || (m.gl = this, m.vb = this.buf(m.verts), m.ib = this.buf(m.idx, "idx"), 
                    m.lb = m.nl ? this.buf(m.lines) : null, m.lib = m.nl ? this.buf(m.lidx, "idx") : null), 
                    meshes.push({
                        inst: inst,
                        g: g,
                        m: m
                    });
                }
            }
            const sh = [], L = JT.LIGHT, Lh = [ L[0], L[2] ], ll = Math.hypot(Lh[0], Lh[1]) || 1, decal = (cx, y, cz, ax, az, a) => this.liftQuad(hab, sh, cx, y, cz, ax, az, a);
            for (const {g: g} of meshes) {
                if ("ground" === g.def.cat || !g.foot) continue;
                const fc = G.centroid(g.foot), solid = g.solids.length > 0, r = solid ? 1.15 * Math.sqrt(Math.abs(G.polyArea(g.foot)) / Math.PI) : Math.min(18, .6 * g.coverR);
                decal(fc[0], g.baseY + .06, fc[1], [ 1.05 * r, 0 ], [ 0, 1.05 * r ], .5 * (solid ? 1 : .75));
            }
            const shb = sh.length ? this.buf(new Float32Array(sh)) : null;
            shb && del.push(shb);
            const mv = [], Lx = Lh[0] / ll, Lz = Lh[1] / ll, ring = (poly, inset, w, hgt) => {
                if (!poly || poly.length < 3) return;
                const c = G.centroid(poly);
                G.polyArea(poly) < 0 && (poly = poly.slice().reverse());
                const nP = poly.length, rows = [ [ -inset, hgt, 1, .8 ], [ .3 * w, .75 * hgt, 1, .9 ], [ .65 * w, .3 * hgt, .75, .88 ], [ w, .02, 0, .9 ] ], pts = rows.map(([d, y, a, b0]) => poly.map((q, i) => {
                    const pv = poly[(i - 1 + nP) % nP], nx = poly[(i + 1) % nP];
                    let ex = nx[0] - pv[0], ez = nx[1] - pv[1];
                    const l = Math.hypot(ex, ez) || 1;
                    let ox = ez / l, oz = -ex / l;
                    ox * (q[0] - c[0]) + oz * (q[1] - c[1]) < 0 && (ox = -ox, oz = -oz);
                    const x = q[0] + ox * d, z = q[1] + oz * d, sh2 = b0 + .12 * (ox * Lx + oz * Lz);
                    return [ x, y, z, x / dm.w, z / dm.d, a, sh2 ];
                }));
                for (let r = 0; r + 1 < rows.length; r++) for (let i = 0; i < nP; i++) {
                    const j = (i + 1) % nP, A = pts[r][i], B = pts[r][j], C = pts[r + 1][j], D2 = pts[r + 1][i];
                    mv.push(...A, ...B, ...C, ...A, ...C, ...D2);
                }
            }, smooth = poly => {
                if (poly.length > 24) return poly;
                const out = [];
                for (let i = 0; i < poly.length; i++) {
                    const a = poly[i], b = poly[(i + 1) % poly.length];
                    out.push([ .75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1] ], [ .25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1] ]);
                }
                return out;
            };
            for (const {inst: inst, g: g} of meshes) if (!(inst.parent || g.baseY > .5 || "ground" === g.def.cat || "wallmount" === g.def.arche || "scatter" === g.def.arche || "heatlamp" === inst.type)) {
                for (const so of g.solids) ring(smooth(so), 1, "backwall" === g.def.arche ? 3.2 : 2.6, 1.15);
                for (const so of g.soft || []) ring(smooth(so), .6, 2.3, 1);
                if (!g.solids.length && (!g.soft || !g.soft.length) && g.contacts && g.contacts.length) {
                    const cs = g.contacts;
                    let poly;
                    if (cs.length >= 3 && (poly = G.hull(cs.map(q => q.slice()))), !poly || Math.abs(G.polyArea(poly)) < 4) {
                        const c = G.centroid(cs.length >= 3 ? cs : [ cs[0], cs[0], cs[0] ]);
                        poly = G.circlePoly(c[0], c[1], 1.4, 1.4, 10);
                    } else poly = G.expandPoly(poly, .8);
                    ring(smooth(poly), .8, 2.4, 1.05);
                }
            }
            const mb = mv.length ? this.buf(new Float32Array(mv)) : null;
            return mb && del.push(mb), this.hg = {
                key: key,
                floor: floor,
                nf: fl.length / 5,
                side: side,
                sides: sides,
                shb: shb,
                nsh: sh.length / 6,
                meshes: meshes,
                del: del,
                mb: mb,
                nm: mv.length / 7,
                ter: ter && ter.max > 0 ? ter : null,
                tq: tq,
                poly: poly
            }, this.hg;
        }
        liftQuad(hab, out, cx, y, cz, ax, az, a) {
            const TR = JT.Terrain, ter = TR && TR.get(hab), uv = [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ];
            if (!ter || !(ter.max > 0) || y > 6) {
                const p = (s, t) => [ cx + ax[0] * s + az[0] * t, y, cz + ax[1] * s + az[1] * t ], q = [ p(-1, -1), p(1, -1), p(1, 1), p(-1, 1) ];
                for (const k of [ 0, 1, 2, 0, 2, 3 ]) out.push(q[k][0], q[k][1], q[k][2], uv[k][0], uv[k][1], a);
                return;
            }
            const L = Math.max(Math.hypot(ax[0], ax[1]), Math.hypot(az[0], az[1])), n = Math.max(2, Math.min(8, Math.ceil(L / 3))), P = (i, j) => {
                const s = i / n * 2 - 1, t = j / n * 2 - 1, x = cx + ax[0] * s + az[0] * t, z = cz + ax[1] * s + az[1] * t;
                return [ x, y + TR.lift(hab, x, z, y), z, i / n, j / n ];
            };
            for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
                const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1);
                for (const q of [ A, B, C, A, C, D ]) out.push(q[0], q[1], q[2], q[3], q[4], a);
            }
        }
        terrainMesh(hab, hg) {
            const ter = hg.ter;
            if (!ter) return null;
            const gl = this.gl, L = JT.LIGHT, q = v => Math.round(40 * v), lk = q(L[0]) + "," + q(L[1]) + "," + q(L[2]);
            let tm = hg.tm;
            if (tm && tm.lk === lk) return tm;
            const st = hg.tq, W1 = ter.nx + 1, dm = hab.dims, circ = "circle" === dm.shape, R0 = dm.w / 2, Rz = dm.d / 2, ix = [];
            for (let i = 0; i <= ter.nx; i += st) ix.push(i);
            ix[ix.length - 1] !== ter.nx && ix.push(ter.nx);
            const jz = [];
            for (let j = 0; j <= ter.nz; j += st) jz.push(j);
            jz[jz.length - 1] !== ter.nz && jz.push(ter.nz);
            const cw = ix.length, ch = jz.length, v = new Float32Array(cw * ch * 8), ll = Math.hypot(L[0], L[1], L[2]) || 1, lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll, H = ter.H, hv = (i, j) => H[Math.max(0, Math.min(ter.nz, j)) * W1 + Math.max(0, Math.min(ter.nx, i))], out = new Uint8Array(cw * ch);
            for (let b = 0; b < ch; b++) for (let a = 0; a < cw; a++) {
                const i = ix[a], j = jz[b], k = j * W1 + i;
                let x = i * ter.sx, z = j * ter.sz;
                const o = 8 * (b * cw + a);
                if (circ) {
                    const dx = x - R0, dz = (z - Rz) * R0 / Rz, r = Math.hypot(dx, dz);
                    if (r > R0 - .2) {
                        out[b * cw + a] = 1;
                        const f = (R0 - .2) / (r || 1);
                        x = R0 + dx * f, z = Rz + dz * f * Rz / R0;
                    }
                }
                const gx = (hv(i + 1, j) - hv(i - 1, j)) / (2 * ter.sx), gz = (hv(i, j + 1) - hv(i, j - 1)) / (2 * ter.sz);
                let sh = 1 + .9 * ((-gx * lx + ly - gz * lz) / Math.hypot(gx, 1, gz) - ly);
                sh *= 1 - .14 * ter.hol[k], sh *= 1 + .05 * ter.cre[k], sh = Math.max(.68, Math.min(1.22, sh));
                const h = out[b * cw + a] ? 0 : H[k];
                v[o] = x, v[o + 1] = h, v[o + 2] = z, v[o + 3] = x / dm.w, v[o + 4] = z / dm.d, 
                v[o + 5] = 1, v[o + 6] = sh, v[o + 7] = ter.hol[k];
            }
            if (!tm) {
                const idx = [];
                for (let b = 0; b + 1 < ch; b++) for (let a = 0; a + 1 < cw; a++) {
                    const k0 = b * cw + a, k1 = k0 + 1, k2 = k0 + cw, k3 = k2 + 1;
                    if (out[k0] && out[k1] && out[k2] && out[k3]) continue;
                    let hs = 0;
                    for (const kk of [ k0, k1, k2, k3 ]) hs += v[8 * kk + 1];
                    hs <= 1e-4 || idx.push(k0, k1, k3, k0, k3, k2);
                }
                tm = hg.tm = {
                    vb: gl.createBuffer(),
                    ib: this.buf(cw * ch > 65e3 ? new Uint32Array(idx) : new Uint16Array(idx), "idx"),
                    n: idx.length,
                    u32: cw * ch > 65e3
                };
            }
            return gl.bindBuffer(gl.ARRAY_BUFFER, tm.vb), gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW), 
            tm.lk = lk, tm;
        }
        groundMarks(hab, night) {
            const TR = JT.Terrain;
            if (!TR) return null;
            const now = hab.time, low = "low" === this.R.quality, P0 = hab._prints || [], MK0 = hab._marks || [];
            let np = 0;
            for (const d of hab.data.drops) d.pool && np++;
            const sig = hab.data.substrate + "|" + P0.length + "|" + (P0.length ? P0[P0.length - 1].x : 0) + "|" + MK0.length + "|" + np + "|" + low + "|" + (hab._ter ? hab._ter.key : "");
            if (this._gm && this._gm.hab === hab && Math.abs(now - this._gm.t) < .2 && this._gm.sig === sig) return this._gm;
            const S = JT.SUBSTRATES[hab.data.substrate] || JT.SUBSTRATES.coco, dk = GM.rgb(S.dark), tp = GM.rgb(S.top), md = GM.rgb(S.mid), pr = dk.map(c => .45 * c), v = [], quad = (x, z, r, ang, el, col, a, kind) => {
                const c = Math.cos(ang), s = Math.sin(ang), ax = [ c * r, s * r ], az = [ -s * r * el, c * r * el ], P = (u, w) => {
                    const px = x + ax[0] * u + az[0] * w, pz = z + ax[1] * u + az[1] * w;
                    return [ px, TR.at(hab, px, pz) + .07, pz, (u + 1) / 2, (w + 1) / 2 ];
                }, A = P(-1, -1), B = P(1, -1), C = P(1, 1), D = P(-1, 1);
                for (const q of [ A, B, C, A, C, D ]) v.push(q[0], q[1], q[2], q[3], q[4], col[0], col[1], col[2], a, kind);
            }, pk = TR.PRINT[hab.data.substrate] || 0;
            if (pk > 0) {
                const P = hab._prints || [], step = low ? 2 : 1;
                for (let i = P.length - 1; i >= 0; i -= step) {
                    const p = P[i], age = now - p.t;
                    if (age < 0 || age > TR.PRINT_LIFE) continue;
                    const f = 1 - age / TR.PRINT_LIFE, a = Math.min(.85, .75 * pk * f * (.6 + .4 * f)), r = Math.max(.45, .14 * p.s), off = .17 * p.s, nx = -Math.sin(p.a), nz = Math.cos(p.a), fx = Math.cos(p.a), fz = Math.sin(p.a);
                    for (const sd of [ -1, 1 ]) quad(p.x + nx * off * sd + fx * off * .5 * p.side * sd, p.z + nz * off * sd + fz * off * .5 * p.side * sd, r, p.a, .7, pr, a, 0);
                }
            }
            for (const m of hab._marks || []) {
                const age = now - m.t;
                if (age < 0 || age > TR.MARK_LIFE) continue;
                const f = Math.min(1, (TR.MARK_LIFE - age) / 40);
                quad(m.x, m.z, 1.5 * m.r, 0, 1, dk, .36 * f, 1), quad(m.x + .5 * m.r, m.z + .35 * m.r, .95 * m.r, .6, .8, tp, .45 * f, 0), 
                quad(m.x - .15 * m.r, m.z - .1 * m.r, .55 * m.r, 0, 1, dk, .4 * f, 0);
            }
            const water = [ .36 + .05 * (1 - night), .42, .46 ];
            for (const d of hab.data.drops) {
                if (!d.pool || !M.finite3(d.pos)) continue;
                const f = M.clamp(d.life / 60, 0, 1), r = d.r || 2;
                quad(d.pos[0], d.pos[2], 1.7 * r, .3, .85, md.map(c => .55 * c), .3 * f, 0), quad(d.pos[0], d.pos[2], r, .3, .85, water, .62 * f, 2);
            }
            const gm = this._gm || (this._gm = {
                b: this.gl.createBuffer()
            });
            return gm.hab = hab, gm.t = now, gm.sig = sig, gm.n = v.length / 10, gm.n && (this.gl.bindBuffer(this.gl.ARRAY_BUFFER, gm.b), 
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(v), this.gl.DYNAMIC_DRAW)), 
            gm;
        }
        smFree() {
            const gl = this.gl, S = this._sm;
            if (S) {
                for (const k of [ "fA", "fT", "fF", "fT2", "fC" ]) S[k] && gl.deleteFramebuffer(S[k]);
                for (const k of [ "tA", "tT", "tF", "tT2", "tC" ]) S[k] && gl.deleteTexture(S[k]);
                this._sm = null;
            }
        }
        smAlloc(W, H) {
            const gl = this.gl, S = {
                W: W,
                H: H
            }, W2 = Math.max(32, W >> 1), H2 = Math.max(32, H >> 1), mk = (w, h) => {
                const t = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, t), gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), 
                this.texParams(!1);
                const f = gl.createFramebuffer();
                return gl.bindFramebuffer(gl.FRAMEBUFFER, f), gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0), 
                [ t, f ];
            };
            return [S.tA, S.fA] = mk(W, H), [S.tT, S.fT] = mk(W, H), [S.tF, S.fF] = mk(W, H), 
            [S.tT2, S.fT2] = mk(W2, H2), [S.tC, S.fC] = mk(W2, H2), S.W2 = W2, S.H2 = H2, S.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE, 
            S;
        }
        smContacts(hg) {
            const v = [], tri = (a, b, c) => v.push(...a, ...b, ...c), rim = (poly, w, a0) => {
                if (!poly || poly.length < 3) return;
                const c = G.centroid(poly), n = poly.length, pts = poly.map((q, i) => {
                    const pv = poly[(i - 1 + n) % n], nx = poly[(i + 1) % n];
                    let ex = nx[0] - pv[0], ez = nx[1] - pv[1];
                    const l = Math.hypot(ex, ez) || 1;
                    let ox = ez / l, oz = -ex / l;
                    return ox * (q[0] - c[0]) + oz * (q[1] - c[1]) < 0 && (ox = -ox, oz = -oz), [ [ q[0] - .3 * ox, 0, q[1] - .3 * oz, a0 ], [ q[0] + ox * w, 0, q[1] + oz * w, 0 ] ];
                }), C = [ c[0], 0, c[1], a0 ];
                for (let i = 0; i < n; i++) {
                    const j = (i + 1) % n, A = pts[i], B = pts[j];
                    tri(C, A[0], B[0]), tri(A[0], B[0], B[1]), tri(A[0], B[1], A[1]);
                }
            }, dab = (x, z, r, a0) => {
                const C = [ x, 0, z, a0 ];
                for (let k = 0; k < 10; k++) {
                    const t0 = k / 10 * 6.2832, t1 = (k + 1) / 10 * 6.2832;
                    tri(C, [ x + Math.cos(t0) * r, 0, z + Math.sin(t0) * r, 0 ], [ x + Math.cos(t1) * r, 0, z + Math.sin(t1) * r, 0 ]);
                }
            };
            for (const {inst: inst, g: g} of hg.meshes) {
                if (inst.parent || g.baseY > .5 || "ground" === g.def.cat || "wallmount" === g.def.arche || "scatter" === g.def.arche || "heatlamp" === inst.type) continue;
                const back = "backwall" === g.def.arche;
                for (const so of g.solids) rim(so, back ? 2.4 : 1.9, 1);
                for (const so of g.soft || []) rim(so, 1.3, .85);
                if (!g.solids.length && (!g.soft || !g.soft.length) && g.contacts) for (const q of g.contacts) dab(q[0], q[1], 1.25, .8);
            }
            return v;
        }
        shadowMap(hab, hg) {
            if (this._smBroken || this.R.set && this.R.set.ptNoSm) return null;
            const gl = this.gl, L = JT.LIGHT, q = v => Math.round(40 * v), key = q(L[0]) + "," + q(L[1]) + "," + q(L[2]);
            if (hg.sm && hg.smKey === key) return hg.sm;
            const prevFB = gl.getParameter(gl.FRAMEBUFFER_BINDING), vp = gl.getParameter(gl.VIEWPORT);
            try {
                const P = this.P;
                P.smask || (P.smask = this.prog(SMASK_VS, SMASK_FS), P.sblur = this.prog(SBLUR_VS, SBLUR_FS), 
                P.smix = this.prog(SBLUR_VS, SMIX_FS), P.shd = this.prog(TEX_VS, SHD_FS)), void 0 === this._mx && (this._mx = this.gl2 ? gl.MAX : (gl.getExtension("EXT_blend_minmax") || {}).MAX_EXT || 0);
                const dm = hab.dims, N = "low" === this.R.quality ? 256 : 512, asp = dm.d / dm.w, W = asp <= 1 ? N : Math.max(64, Math.round(N / asp)), H = asp <= 1 ? Math.max(64, Math.round(N * asp)) : N;
                let S = this._sm;
                if (S && S.W === W && S.H === H || (this.smFree(), S = this._sm = this.smAlloc(W, H)), 
                !S.ok) throw new Error("shadow fbo");
                if (!hg.ao) {
                    const v = this.smContacts(hg);
                    hg.ao = v.length ? this.buf(new Float32Array(v)) : null, hg.nao = v.length / 4, 
                    hg.ao && hg.del.push(hg.ao);
                }
                gl.disable(gl.DEPTH_TEST), gl.depthMask(!1), gl.disable(gl.CULL_FACE), gl.enable(gl.BLEND), 
                gl.bindFramebuffer(gl.FRAMEBUFFER, S.fA), gl.viewport(0, 0, W, H), gl.clearColor(0, 0, 0, 0), 
                gl.clear(gl.COLOR_BUFFER_BIT), this._mx ? (gl.blendEquation(this._mx), gl.blendFunc(gl.ONE, gl.ONE)) : gl.blendFunc(gl.ONE, gl.ONE);
                let Q = this.use(P.smask);
                const hz = Math.hypot(L[0], L[2]), ly = Math.max(L[1], hz / 2.6, .05);
                gl.uniform3f(Q.u.uL, L[0], ly, L[2]), gl.uniform2f(Q.u.uDim, dm.w, dm.d), gl.uniform1f(Q.u.uFade, Math.max(18, .7 * (dm.h || 40))), 
                gl.uniform1f(Q.u.uK, 0);
                for (const {inst: inst, g: g, m: m} of hg.meshes) {
                    if ("ground" === g.def.cat || "heatlamp" === inst.type || !m.vb) continue;
                    const u32 = m.idx instanceof Uint32Array;
                    u32 && !this.uintOK || (gl.bindBuffer(gl.ARRAY_BUFFER, m.vb), this.attribs(Q, [ [ "aP", 3 ] ], GM.STRIDE), 
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib), gl.drawElements(gl.TRIANGLES, m.idx.length, u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0));
                }
                hg.ao && (gl.uniform3f(Q.u.uL, 0, 1, 0), gl.uniform1f(Q.u.uK, 1), gl.bindBuffer(gl.ARRAY_BUFFER, hg.ao), 
                this.attribs(Q, [ [ "aP", 3 ], [ "aA", 1 ] ], 4), gl.drawArrays(gl.TRIANGLES, 0, hg.nao)), 
                this._mx && gl.blendEquation(gl.FUNC_ADD), gl.disable(gl.BLEND), Q = this.use(P.sblur), 
                gl.bindBuffer(gl.ARRAY_BUFFER, this.quad), this.attribs(Q, [ [ "aXY", 2 ], [ "aUV", 2 ] ], 4), 
                gl.activeTexture(gl.TEXTURE0), gl.uniform1i(Q.u.uTex, 0);
                const fine = .32, wide = 1.15, pass = (src, fb, w, h, dx, dy) => {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, fb), gl.viewport(0, 0, w, h), gl.bindTexture(gl.TEXTURE_2D, src), 
                    gl.uniform2f(Q.u.uD, dx / dm.w, dy / dm.d), gl.drawArrays(gl.TRIANGLES, 0, 6);
                };
                pass(S.tA, S.fT, W, H, fine, 0), pass(S.tT, S.fF, W, H, 0, fine), pass(S.tA, S.fT2, S.W2, S.H2, wide, 0), 
                pass(S.tT2, S.fC, S.W2, S.H2, 0, wide), Q = this.use(P.smix), this.attribs(Q, [ [ "aXY", 2 ], [ "aUV", 2 ] ], 4), 
                gl.uniform1i(Q.u.uTex, 0), gl.uniform1i(Q.u.uTex2, 1), gl.activeTexture(gl.TEXTURE1), 
                gl.bindTexture(gl.TEXTURE_2D, S.tC), gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, S.tF), 
                gl.bindFramebuffer(gl.FRAMEBUFFER, S.fA), gl.viewport(0, 0, W, H), gl.drawArrays(gl.TRIANGLES, 0, 6), 
                hg.sm = {
                    t: S.tA,
                    S: S
                }, hg.smKey = key, hg.csKey = "sm" + key, S.builds = (S.builds || 0) + 1;
            } catch (e) {
                JT.DEV && console.warn("shadow map", e), this._smBroken = !0, hg.sm = null;
            }
            return gl.bindFramebuffer(gl.FRAMEBUFFER, prevFB), gl.viewport(vp[0], vp[1], vp[2], vp[3]), 
            gl.enable(gl.BLEND), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA), gl.disable(gl.DEPTH_TEST), 
            gl.depthMask(!1), hg.sm;
        }
        drawShadowMap(V, hab, hg, tm, sm, night) {
            const gl = this.gl, SK = JT.SKY, P = this.use(this.P.shd);
            this.view(P, V), gl.uniform1f(P.u.uZ, 0), gl.activeTexture(gl.TEXTURE1), gl.bindTexture(gl.TEXTURE_2D, this.tex.noise), 
            gl.uniform1i(P.u.uNoise, 1), gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, sm.t), 
            gl.uniform1i(P.u.uTex, 0);
            const mode = 1 === this._hd ? 1 : 0;
            gl.uniform1f(P.u.uMode, mode), gl.uniform4f(P.u.uCol, .16 - .06 * night, .1 - .02 * night, .05 + .08 * night, 1), 
            gl.uniform2f(P.u.uAmt, (1 === mode ? .5 : .46) * (1 - .3 * night) * M.clamp(1.1 * SK.kd, 0, 1), .36 - .08 * night), 
            tm && tm.n ? (gl.enable(gl.DEPTH_TEST), gl.depthFunc(gl.LEQUAL), gl.depthMask(!0), 
            gl.bindBuffer(gl.ARRAY_BUFFER, tm.vb), this.attribs(P, [ [ "aP", 3 ], [ "aUV", 2 ] ], 8), 
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tm.ib), tm.u32 && !this.uintOK || gl.drawElements(gl.TRIANGLES, tm.n, tm.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0), 
            gl.depthFunc(gl.LESS)) : gl.disable(gl.DEPTH_TEST), gl.bindBuffer(gl.ARRAY_BUFFER, hg.floor), 
            this.attribs(P, [ [ "aP", 3 ], [ "aUV", 2 ] ], 5), gl.drawArrays(gl.TRIANGLES, 0, hg.nf), 
            gl.depthFunc(gl.LEQUAL), gl.depthMask(!1), gl.disable(gl.DEPTH_TEST);
        }
        castShadows(hg, hab) {
            const L = JT.LIGHT, q = v => Math.round(40 * v), key = q(L[0]) + "," + q(L[1]) + "," + q(L[2]);
            if (hg.cs && hg.csKey === key) return hg.cs;
            const gl = this.gl;
            hg.cs && hg.cs.b && gl.deleteBuffer(hg.cs.b);
            const Lh = [ L[0], L[2] ], ll = Math.hypot(Lh[0], Lh[1]) || 1, dir = [ -Lh[0] / ll, -Lh[1] / ll ], sh = [], decal = (cx, y, cz, ax, az, a) => hab ? this.liftQuad(hab, sh, cx, y, cz, ax, az, a) : null;
            for (const {g: g} of hg.meshes) {
                if ("ground" === g.def.cat || !g.foot) continue;
                const fc = G.centroid(g.foot), solid = g.solids.length > 0, r = solid ? 1.15 * Math.sqrt(Math.abs(G.polyArea(g.foot)) / Math.PI) : Math.min(18, .6 * g.coverR), len = Math.min(70, Math.max(4, g.height) * ll / Math.max(.3, L[1])) * (solid ? .8 : .65), cc = [ fc[0] + dir[0] * len * .45, fc[1] + dir[1] * len * .45 ], a = .36 * M.clamp(1.25 - len / 110, .65, 1);
                decal(cc[0], g.baseY + .05, cc[1], [ dir[0] * (r + .5 * len), dir[1] * (r + .5 * len) ], [ -dir[1] * r * .9, dir[0] * r * .9 ], a);
            }
            return hg.csKey = key, hg.cs = {
                b: sh.length ? this.buf(new Float32Array(sh)) : null,
                n: sh.length / 6
            }, hg.cs;
        }
        frame(V, hab, night, lamps, scene) {
            const gl = this.gl;
            if (this.lost) return;
            if (this.reinit) {
                this.reinit = !1, this._gc = null, this._cache = null, this.P.blit = null, this.P.ups = null, 
                this.hg = null, this.bgT = null, this.gT = null;
                for (const id in hab.geoms) hab.geoms[id]._mesh && (hab.geoms[id]._mesh.vb = null);
            }
            const W = this.cv.width, H = this.cv.height, k = this.R.k;
            this.cur = null;
            const HDT = JT.HD2D ? JT.HD2D.begin(this, W, H) : null, VW = HDT ? HDT.w : W, VH = HDT ? HDT.h : H, PXF = HDT ? HDT.f : 1;
            this._tgtFB = HDT ? HDT.fb : null, this._vpW = VW, this._vpH = VH, this._hdF = HDT ? HDT.f : 0;
            const CLR = HDT ? JT.HD2D.clear : PAPER;
            this._hd = HDT ? 1 : 0;
            const SK = JT.SKY, grade = SK.grade.slice(), lampU = this._lampU || (this._lampU = new Float32Array(16));
            lampU.fill(0);
            const LL = [];
            this.F = {
                night: night,
                grade: grade,
                lamps: LL,
                lampU: lampU,
                sky: SK
            }, gl.viewport(0, 0, VW, VH), gl.clearColor(CLR[0], CLR[1], CLR[2], 1), gl.clearDepth(1), 
            gl.depthMask(!0), gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT), gl.disable(gl.CULL_FACE), 
            gl.enable(gl.BLEND), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA), gl.disable(gl.DEPTH_TEST), 
            gl.depthMask(!1);
            const hg = this.habGeom(hab), gt = this.groundTexture(hab), Lg = JT.LIGHT, SM = this.shadowMap(hab, hg);
            let outPx = M.clamp(V.s / k * .13, .9, 2.1) * k, lw = M.clamp(V.s / k * .2, .7, 2) * k;
            HDT && (outPx = Math.max(.8 * outPx, 1.05 / PXF), lw = Math.max(lw, 1 / PXF));
            const mx = 90 * k, visible = g => {
                const b = g._sb || (g._sb = this.boundsOf(g)), q = V.P(b.c), r = b.r * V.s + mx;
                return q[0] > -r && q[0] < W + r && q[1] > -r && q[1] < H + r;
            }, drawList = hg.meshes.filter(o => visible(o.g));
            for (const o of drawList) o._dz = V.depth(o.g._sb.c);
            drawList.sort((a, b) => a._dz - b._dz);
            const PT = this.R.set.perf ? this.R.set : {}, decorPass = list => {
                gl.enable(gl.DEPTH_TEST), gl.depthFunc(gl.LEQUAL), gl.depthMask(!0), gl.disable(gl.BLEND);
                let P = this.use(this.meshProg());
                this.view(P, V), this.light(P), gl.uniform3f(P.u.uL, Lg[0], Lg[1], Lg[2]), gl.uniform3f(P.u.uToCam, V.toCam[0], V.toCam[1], V.toCam[2]), 
                gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, this.tex.noise), gl.uniform1i(P.u.uNoise, 0), 
                gl.uniform3f(P.u.uInk, .17, .13, .1), gl.uniform1f(P.u.uBoil, 0), gl.uniform1f(P.u.uOut, outPx), 
                gl.uniform1f(P.u.uAlpha, 1), gl.uniform4f(P.u.uGhost, 0, 0, 0, 0), gl.uniform3f(P.u.uSoil, gt.avg[0], gt.avg[1], gt.avg[2]), 
                gl.uniform1f(P.u.uHD, this._hd);
                for (const pass of PT.ptNoInk ? [ 1 ] : [ 0, 1 ]) {
                    gl.uniform1f(P.u.uPass, pass ? 0 : 1);
                    for (const o of list) {
                        const sw = o.inst._sw, wind=o._wind||[0,0,0];gl.uniform3f(P.u.uWind,wind[0],wind[1],wind[2]);
                        gl.uniform3f(P.u.uSway, sw ? sw.x : 0, 0, sw ? sw.z : 0), gl.uniform2f(P.u.uGnd, "ground" === o.g.def.cat || "wallmount" === o.g.def.arche ? 0 : 1, o.g.baseY), 
                        this.drawMesh(P, o.m);
                    }
                }
                P = this.use(this.P.line), this.view(P, V), this.light(P), gl.uniform1f(P.u.uLW, lw), 
                gl.uniform1f(P.u.uMinW, HDT ? .9 / PXF : .6 * k), gl.uniform1f(P.u.uAlpha, 1), gl.uniform1f(P.u.uLitL, 0), 
                gl.enable(gl.BLEND), gl.depthMask(!1);
                for (const o of list) {
                    if (!o.m.lb || PT.ptNoInk) continue;
                    const sw = o.inst._sw, wind=o._wind||[0,0,0];gl.uniform3f(P.u.uWind,wind[0],wind[1],wind[2]);
                    gl.uniform3f(P.u.uSway, sw ? sw.x : 0, 0, sw ? sw.z : 0), this.drawLines(P, o.m.lb, o.m.lib, o.m.nl);
                }
            }, statics = (list, part) => {
                let P = this.use(this.P.scr);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.quad), this.attribs(P, [ [ "aXY", 2 ], [ "aUV", 2 ] ], 4), 
                gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, this.bgTexture(hab.data.bg)), 
                gl.uniform1i(P.u.uTex, 0), gl.uniform1f(P.u.uMode, 0), gl.uniform4f(P.u.uCol, .98 * grade[0], .98 * grade[1], grade[2], 1), 
                gl.drawArrays(gl.TRIANGLES, 0, 6), P = this.use(this.P.tex), this.view(P, V), this.light(P), 
                gl.uniform1i(P.u.uTex, 0), gl.uniform1f(P.u.uZ, 0), gl.bindTexture(gl.TEXTURE_2D, gt.s), 
                gl.bindBuffer(gl.ARRAY_BUFFER, hg.side), this.attribs(P, [ [ "aP", 3 ], [ "aUV", 2 ] ], 5), 
                gl.uniform1f(P.u.uLit, 1), hg.sides.forEach((s, i) => {
                    if (s[0] * V.toCam[0] + s[1] * V.toCam[2] <= 0) return;
                    const dd = s[0] * Lg[0] + s[1] * Lg[2], lit = M.clamp(.72 + .4 * dd * SK.kd, .45, 1.1), tw = M.clamp(.5 + dd, 0, 1) * SK.kd;
                    gl.uniform4f(P.u.uCol, lit * (SK.amb[0] + (SK.key[0] - SK.amb[0]) * tw), lit * (SK.amb[1] + (SK.key[1] - SK.amb[1]) * tw), lit * (SK.amb[2] + (SK.key[2] - SK.amb[2]) * tw), 1), 
                    gl.drawArrays(gl.TRIANGLES, null != s[2] ? s[2] : 6 * i, s[3] || 6);
                }), gl.bindTexture(gl.TEXTURE_2D, gt.t), gl.bindBuffer(gl.ARRAY_BUFFER, hg.floor), 
                this.attribs(P, [ [ "aP", 3 ], [ "aUV", 2 ] ], 5), gl.uniform4f(P.u.uCol, 1, 1, 1, 1), 
                gl.drawArrays(gl.TRIANGLES, 0, hg.nf);
                {
                    const TR = JT.Terrain, tm = hg.ter && !(this.R.set.perf ? this.R.set : {}).ptNoTer ? this.terrainMesh(hab, hg) : null, L8 = [ [ "aP", 3 ], [ "aUV", 2 ], [ "aA", 1 ], [ "aS", 1 ], [ "aW", 1 ] ];
                    if (tm && tm.n) {
                        gl.enable(gl.DEPTH_TEST), gl.depthFunc(gl.LEQUAL), gl.depthMask(!0), P = this.use(this.P.mound), 
                        this.view(P, V), this.light(P), gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, gt.t), 
                        gl.uniform1i(P.u.uTex, 0), gl.activeTexture(gl.TEXTURE1), gl.bindTexture(gl.TEXTURE_2D, this.tex.noise), 
                        gl.uniform1i(P.u.uNoise, 1), gl.activeTexture(gl.TEXTURE0), gl.bindBuffer(gl.ARRAY_BUFFER, tm.vb), 
                        this.attribs(P, L8, 8), gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tm.ib), tm.u32 && !this.uintOK || gl.drawElements(gl.TRIANGLES, tm.n, tm.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0), 
                        gl.depthMask(!1);
                        const wet = (TR.WET[hab.data.substrate] || 0) * M.clamp((hab.data.humidity - .35) / .6, 0, 1), WFw = this._wxF, rw = WFw && WFw.hab === hab && WFw.wet || 0, am = Math.max(wet * wet * (3 - 2 * wet) * .6, rw * rw * (3 - 2 * rw) * .5);
                        am > .01 && (P = this.use(this.P.wet), this.view(P, V), this.light(P), gl.uniform1i(P.u.uTex, 0), 
                        gl.activeTexture(gl.TEXTURE1), gl.bindTexture(gl.TEXTURE_2D, this.tex.noise), gl.uniform1i(P.u.uNoise, 1), 
                        gl.activeTexture(gl.TEXTURE0), gl.uniform1f(P.u.uAm, am), gl.bindBuffer(gl.ARRAY_BUFFER, tm.vb), 
                        this.attribs(P, L8, 8), gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tm.ib), tm.u32 && !this.uintOK || gl.drawElements(gl.TRIANGLES, tm.n, tm.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0));
                    }
                    SM && this.drawShadowMap(V, hab, hg, tm, SM, night);
                    const gm = TR ? this.groundMarks(hab, night) : null;
                    gm && gm.n && (tm && tm.n && gl.enable(gl.DEPTH_TEST), P = this.use(this.P.mark), 
                    this.view(P, V), this.light(P), gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, this.tex.noise), 
                    gl.uniform1i(P.u.uNoise, 0), gl.bindBuffer(gl.ARRAY_BUFFER, gm.b), this.attribs(P, [ [ "aP", 3 ], [ "aUV", 2 ], [ "aC", 4 ], [ "aK", 1 ] ], 10), 
                    gl.drawArrays(gl.TRIANGLES, 0, gm.n)), tm && tm.n && (gl.depthMask(!0), gl.clear(gl.DEPTH_BUFFER_BIT)), 
                    gl.disable(gl.DEPTH_TEST), gl.depthMask(!1), P = this.use(this.P.tex), this.view(P, V), 
                    this.light(P), gl.uniform1i(P.u.uTex, 0), gl.uniform1f(P.u.uZ, 0);
                }
                if (hg.shb && !SM && (P = this.use(this.P.tex), gl.bindTexture(gl.TEXTURE_2D, this.tex.radial), 
                gl.bindBuffer(gl.ARRAY_BUFFER, hg.shb), this.attribs(P, [ [ "aP", 3 ], [ "aUV", 2 ], [ "aA", 1 ] ], 6), 
                gl.uniform1f(P.u.uLit, 0), gl.uniform4f(P.u.uCol, .16, .1, .05, .42 - .12 * night), 
                gl.drawArrays(gl.TRIANGLES, 0, hg.nsh)), !SM) {
                    const cs = this.castShadows(hg, hab);
                    cs.b && SK.kd > .02 && (P = this.use(this.P.tex), gl.bindTexture(gl.TEXTURE_2D, this.tex.radial), 
                    gl.bindBuffer(gl.ARRAY_BUFFER, cs.b), this.attribs(P, [ [ "aP", 3 ], [ "aUV", 2 ], [ "aA", 1 ] ], 6), 
                    gl.uniform1f(P.u.uLit, 0), gl.uniform4f(P.u.uCol, .16 - .06 * night, .1 - .02 * night, .05 + .08 * night, (.42 - .12 * night) * SK.kd), 
                    gl.drawArrays(gl.TRIANGLES, 0, cs.n));
                }
                LL.length && this.lampPools(V, hab, LL, night), "ground" !== part && decorPass(list);
            }, live = [];
            JT.Foliage && JT.Foliage.prepare(this.R,hab,drawList);
            for (const o of drawList) (o.inst._sw||o._wind) && live.push(o);
            const mode = this.cacheMode(V, hab, hg, gt, PT, live, night, VW, VH);
            this._direct = "direct" === mode;
            const SS = this._direct ? this.splitScale(HDT, PT) : 0;
            if (this.splitS = 1, "direct" === mode && SS) {
                let C = this._cache;
                if (C && C.W === VW && C.H === VH || (C = this.cacheAlloc(VW, VH)), !C || C.dead) statics(drawList); else {
                    const sw = Math.max(16, Math.round(VW * SS)), sh = Math.max(16, Math.round(VH * SS));
                    if (C.key = null, C.used = performance.now(), this.splitS = SS, gl.bindFramebuffer(gl.FRAMEBUFFER, C.ms), 
                    gl.viewport(0, 0, sw, sh), gl.enable(gl.SCISSOR_TEST), gl.scissor(0, 0, sw, sh), 
                    gl.clearColor(CLR[0], CLR[1], CLR[2], 1), gl.clearDepth(1), gl.depthMask(!0), gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT), 
                    gl.disable(gl.SCISSOR_TEST), gl.disable(gl.CULL_FACE), gl.enable(gl.BLEND), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA), 
                    gl.disable(gl.DEPTH_TEST), gl.depthMask(!1), statics(drawList, "ground"), gl.bindFramebuffer(gl.READ_FRAMEBUFFER, C.ms), 
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, C.rs), gl.blitFramebuffer(0, 0, sw, sh, 0, 0, sw, sh, gl.COLOR_BUFFER_BIT, gl.NEAREST), 
                    gl.bindFramebuffer(gl.FRAMEBUFFER, this._tgtFB || null), gl.viewport(0, 0, VW, VH), 
                    void 0 === this.P.ups || null === this.P.ups) try {
                        this.P.ups = this.prog(BLIT_VS, UPS_FS);
                    } catch (e) {
                        JT.DEV && console.warn("ups", e), this.P.ups = !1;
                    }
                    const U = this.P.ups;
                    let bad = !U || !U.p;
                    C.checked || (C.checked = !0, gl.getError() !== gl.NO_ERROR && (bad = !0)), bad ? (this._splitBroken = !0, 
                    this.splitS = 1, gl.clearColor(CLR[0], CLR[1], CLR[2], 1), gl.depthMask(!0), gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT), 
                    gl.disable(gl.DEPTH_TEST), gl.depthMask(!1), gl.enable(gl.BLEND), statics(drawList)) : (this.use(U), 
                    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad), this.attribs(U, [ [ "aXY", 2 ] ], 4), 
                    gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, C.ct), gl.uniform1i(U.u.uCol, 0), 
                    gl.uniform4f(U.u.uS, sw / VW, sh / VH, sw, sh), gl.disable(gl.BLEND), gl.disable(gl.DEPTH_TEST), 
                    gl.depthMask(!1), gl.drawArrays(gl.TRIANGLES, 0, 6), decorPass(drawList), gl.enable(gl.DEPTH_TEST), 
                    gl.depthFunc(gl.LEQUAL), gl.enable(gl.BLEND), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA), 
                    gl.depthMask(!1));
                }
            } else if ("direct" === mode) statics(drawList); else {
                const C = this._cache;
                if ("build" === mode && (gl.bindFramebuffer(gl.FRAMEBUFFER, C.ms), gl.viewport(0, 0, VW, VH), 
                gl.clearColor(CLR[0], CLR[1], CLR[2], 1), gl.clearDepth(1), gl.depthMask(!0), gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT), 
                gl.disable(gl.CULL_FACE), gl.enable(gl.BLEND), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA), 
                gl.disable(gl.DEPTH_TEST), gl.depthMask(!1), statics(live.length ? drawList.filter(o => !o.inst._sw && !o._wind) : drawList), 
                gl.bindFramebuffer(gl.READ_FRAMEBUFFER, C.ms), gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, C.rs), 
                gl.blitFramebuffer(0, 0, VW, VH, 0, 0, VW, VH, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST), 
                gl.bindFramebuffer(gl.FRAMEBUFFER, this._tgtFB || null), gl.viewport(0, 0, VW, VH), 
                C.checked || (C.checked = !0, gl.getError() !== gl.NO_ERROR && (this.cacheFree(!0), 
                statics(drawList), C.dead = !0))), !C.dead) {
                    const P = this.use(this.P.blit);
                    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad), this.attribs(P, [ [ "aXY", 2 ] ], 4), 
                    gl.activeTexture(gl.TEXTURE1), gl.bindTexture(gl.TEXTURE_2D, C.dt), gl.uniform1i(P.u.uDep, 1), 
                    gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, C.ct), gl.uniform1i(P.u.uCol, 0), 
                    gl.disable(gl.BLEND), gl.enable(gl.DEPTH_TEST), gl.depthFunc(gl.ALWAYS), gl.depthMask(!0), 
                    gl.drawArrays(gl.TRIANGLES, 0, 6), gl.depthFunc(gl.LEQUAL), live.length && decorPass(live), 
                    gl.enable(gl.DEPTH_TEST), gl.depthFunc(gl.LEQUAL), gl.enable(gl.BLEND), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA), 
                    gl.depthMask(!1);
                }
            }
            let P;
            if (hg.mb && (P = this.use(this.P.mound), this.view(P, V), this.light(P), gl.activeTexture(gl.TEXTURE0), 
            gl.bindTexture(gl.TEXTURE_2D, gt.t), gl.uniform1i(P.u.uTex, 0), gl.activeTexture(gl.TEXTURE1), 
            gl.bindTexture(gl.TEXTURE_2D, this.tex.noise), gl.uniform1i(P.u.uNoise, 1), gl.activeTexture(gl.TEXTURE0), 
            gl.bindBuffer(gl.ARRAY_BUFFER, hg.mb), this.attribs(P, [ [ "aP", 3 ], [ "aUV", 2 ], [ "aA", 1 ], [ "aS", 1 ] ], 7), 
            gl.drawArrays(gl.TRIANGLES, 0, hg.nm)), this.R.ghost && this.R.ghost.geom && this.drawGhost(V, this.R.ghost), 
            scene && !PT.ptNoSpr && (HDT || this.sprites(V, hab, scene, night), this.silk(V, hab, scene, night)), 
            HDT && HDT.fb2 && (gl.bindFramebuffer(gl.READ_FRAMEBUFFER, HDT.fb), gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, HDT.fb2), 
            gl.blitFramebuffer(0, 0, VW, VH, 0, 0, VW, VH, gl.DEPTH_BUFFER_BIT, gl.NEAREST), 
            gl.bindFramebuffer(gl.FRAMEBUFFER, HDT.fb)), HDT) {
                gl.colorMask(!1, !1, !1, !1), gl.enable(gl.DEPTH_TEST), gl.depthFunc(gl.LESS), gl.depthMask(!0), 
                gl.disable(gl.BLEND);
                let Q = this.use(this.P.tex);
                this.view(Q, V), this.light(Q), gl.uniform1f(Q.u.uZ, 0), gl.uniform1f(Q.u.uLit, 0), 
                gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, gt.t), gl.uniform1i(Q.u.uTex, 0), 
                gl.bindBuffer(gl.ARRAY_BUFFER, hg.side), this.attribs(Q, [ [ "aP", 3 ], [ "aUV", 2 ] ], 5), 
                hg.sides.forEach((s, i) => gl.drawArrays(gl.TRIANGLES, null != s[2] ? s[2] : 6 * i, s[3] || 6)), 
                gl.bindBuffer(gl.ARRAY_BUFFER, hg.floor), this.attribs(Q, [ [ "aP", 3 ], [ "aUV", 2 ] ], 5), 
                gl.drawArrays(gl.TRIANGLES, 0, hg.nf);
                const tm = hg.ter && !PT.ptNoTer ? this.terrainMesh(hab, hg) : null;
                tm && tm.n && (!tm.u32 || this.uintOK) && (Q = this.use(this.P.mound), this.view(Q, V), 
                this.light(Q), gl.bindBuffer(gl.ARRAY_BUFFER, tm.vb), this.attribs(Q, [ [ "aP", 3 ], [ "aUV", 2 ], [ "aA", 1 ], [ "aS", 1 ], [ "aW", 1 ] ], 8), 
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tm.ib), gl.drawElements(gl.TRIANGLES, tm.n, tm.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0)), 
                gl.colorMask(!0, !0, !0, !0), gl.depthFunc(gl.LEQUAL);
            }
            if (HDT) {
                if (this._tgtFB = null, this._hd = 0, this._hdF = 0, JT.HD2D.post(this, V, hab, night, W, H), 
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA), scene && !PT.ptNoSpr && HDT.dt2) {
                    this._hdPost = HDT, this._hdF = 1;
                    try {
                        this.sprites(V, hab, scene, night);
                    } finally {
                        this._hdPost = null, this._hdF = 0;
                    }
                }
            } else gl.disable(gl.DEPTH_TEST), gl.enable(gl.BLEND), gl.blendFunc(gl.DST_COLOR, gl.ZERO), 
            P = this.use(this.P.scr), gl.bindBuffer(gl.ARRAY_BUFFER, this.quad), this.attribs(P, [ [ "aXY", 2 ], [ "aUV", 2 ] ], 4), 
            gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, this.tex.paper), gl.uniform1i(P.u.uTex, 0), 
            gl.uniform1f(P.u.uMode, 1), gl.uniform2f(P.u.uRes, W, H), gl.uniform2f(P.u.uJit, 0, 0), 
            gl.uniform4f(P.u.uCol, 1, .985, .95, .32 + .2 * night), gl.drawArrays(gl.TRIANGLES, 0, 6), 
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            const paintEdge = px => {
                const c = "rgb(" + px[0] + "," + px[1] + "," + px[2] + ")";
                c !== this._edgeC && (this._edgeC = c, document.documentElement.style.backgroundColor = c, 
                document.body.style.backgroundColor = c);
            }, EA = this._edgeA;
            if (EA && this.gl2) {
                let st = 0;
                try {
                    st = gl.clientWaitSync(EA.f, 0, 0);
                } catch (e) {
                    st = -1;
                }
                if (st === gl.ALREADY_SIGNALED || st === gl.CONDITION_SATISFIED || -1 === st || ++EA.n > 90) {
                    try {
                        if (-1 !== st) {
                            const px = new Uint8Array(4);
                            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, EA.b), gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, px), 
                            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null), paintEdge(px);
                        }
                    } catch (e) {}
                    try {
                        gl.deleteSync(EA.f);
                    } catch (e) {}
                    this._edgeA = null;
                }
            }
            if (!this._edgeA && (!this._edgeT || performance.now() - this._edgeT > 1e4 && !this._moving || this._edgeH !== hab.id)) if (this._edgeT = performance.now(), 
            this._edgeH = hab.id, !this.gl2 || this.R.set.perf && this.R.set.ptSyncEdge) try {
                const px = new Uint8Array(4);
                gl.readPixels(W >> 1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px), paintEdge(px);
            } catch (e) {} else try {
                this._edgePB && this._edgePBgl === gl && !this.reinit || (this._edgePB = gl.createBuffer(), 
                this._edgePBgl = gl, gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._edgePB), gl.bufferData(gl.PIXEL_PACK_BUFFER, 4, gl.STREAM_READ)), 
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._edgePB), gl.readPixels(W >> 1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0), 
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
                const f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
                f && (this._edgeA = {
                    f: f,
                    b: this._edgePB,
                    n: 0
                });
            } catch (e) {
                try {
                    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
                } catch (e2) {}
            }
        }
        boundsOf(g) {
            const pts = [];
            for (const e of g.extent.length ? g.extent : g.foot || []) pts.push([ e[0], g.baseY, e[1] ]);
            let c = [ 0, 0, 0 ];
            if (!pts.length) return {
                c: g.center,
                r: 20
            };
            for (const p of pts) c = M.add(c, p);
            c = M.mul(c, 1 / pts.length), c[1] = g.baseY + g.height / 2;
            let r = g.height / 2 + 4;
            for (const p of pts) r = Math.max(r, Math.hypot(p[0] - c[0], p[2] - c[2]) + g.height / 2);
            return {
                c: c,
                r: r
            };
        }
        thumb(g, V, size) {
            const gl = this.gl;
            if (this.lost) return null;
            const S = 2 * size, m = GM.build(g);
            if (!m.n) return null;
            this._tfb = this._tfb || {};
            let T = this._tfb[S];
            if (!T) {
                const tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tex), gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), 
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                const rb = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, rb), gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, S, S);
                const fb = gl.createFramebuffer();
                gl.bindFramebuffer(gl.FRAMEBUFFER, fb), gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0), 
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb), 
                T = this._tfb[S] = {
                    fb: fb,
                    tex: tex,
                    rb: rb
                };
            }
            const keepF = this.F;
            this.F = {
                night: 0,
                grade: [ 1, 1, 1 ],
                lamps: [],
                lampU: new Float32Array(16),
                sky: NEUTRAL
            }, this._res = [ S, S ], this.resetAttribs();
            const W2 = new JT.View(V.yaw, V.pitch, 2 * V.s, 2 * V.cx, 2 * V.cy, V.c);
            try {
                gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb), gl.viewport(0, 0, S, S), gl.clearColor(0, 0, 0, 0), 
                gl.clearDepth(1), gl.depthMask(!0), gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT), 
                m.vb && m.gl === this || (m.gl = this, m.vb = this.buf(m.verts), m.ib = this.buf(m.idx, "idx"), 
                m.lb = m.nl ? this.buf(m.lines) : null, m.lib = m.nl ? this.buf(m.lidx, "idx") : null), 
                gl.enable(gl.DEPTH_TEST), gl.depthFunc(gl.LEQUAL), gl.disable(gl.BLEND), gl.disable(gl.CULL_FACE);
                const Lg = JT.LIGHT;
                let P = this.use(this.meshProg());
                this.view(P, W2), this.light(P), gl.uniform3f(P.u.uL, Lg[0], Lg[1], Lg[2]), gl.uniform3f(P.u.uToCam, W2.toCam[0], W2.toCam[1], W2.toCam[2]), 
                gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, this.tex.noise), gl.uniform1i(P.u.uNoise, 0), 
                gl.uniform3f(P.u.uInk, .17, .13, .1), gl.uniform1f(P.u.uOut, M.clamp(S / 110, 1.4, 3)), 
                gl.uniform1f(P.u.uAlpha, 1), gl.uniform4f(P.u.uGhost, 0, 0, 0, 0), gl.uniform3f(P.u.uWind, 0, 0, 0), gl.uniform3f(P.u.uSway, 0, 0, 0), 
                gl.uniform2f(P.u.uGnd, 0, 0), gl.uniform3f(P.u.uSoil, .5, .4, .3);
                for (const pass of [ 1, 0 ]) gl.uniform1f(P.u.uPass, pass), this.drawMesh(P, m);
                m.lb && (P = this.use(this.P.line), this.view(P, W2), this.light(P), gl.uniform1f(P.u.uLW, M.clamp(S / 90, 1, 2.4)), 
                gl.uniform1f(P.u.uMinW, 1), gl.uniform1f(P.u.uAlpha, 1), gl.uniform1f(P.u.uLitL, 0), 
                gl.uniform3f(P.u.uWind, 0, 0, 0), gl.uniform3f(P.u.uSway, 0, 0, 0), gl.enable(gl.BLEND), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA), 
                gl.depthMask(!1), this.drawLines(P, m.lb, m.lib, m.nl));
                const px = new Uint8Array(S * S * 4);
                gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, px);
                const big = mkCanvas(S, S), bc = big.getContext("2d"), id = bc.createImageData(S, S);
                for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
                    const i = 4 * ((S - 1 - y) * S + x), o = 4 * (y * S + x), a = px[i + 3], k = a ? 255 / a : 0;
                    id.data[o] = Math.min(255, px[i] * k), id.data[o + 1] = Math.min(255, px[i + 1] * k), 
                    id.data[o + 2] = Math.min(255, px[i + 2] * k), id.data[o + 3] = a;
                }
                bc.putImageData(id, 0, 0);
                const c = mkCanvas(size, size), cx = c.getContext("2d");
                return cx.imageSmoothingQuality = "high", cx.drawImage(big, 0, 0, size, size), c;
            } finally {
                this.free(m), g._mesh = null, gl.bindFramebuffer(gl.FRAMEBUFFER, null), gl.viewport(0, 0, this.cv.width, this.cv.height), 
                gl.depthMask(!0), gl.enable(gl.BLEND), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA), 
                this.F = keepF, this._res = null, this.resetAttribs();
            }
        }
        resetAttribs() {
            const gl = this.gl, n = this._maxA || (this._maxA = Math.min(16, gl.getParameter(gl.MAX_VERTEX_ATTRIBS)));
            for (let i = 0; i < n; i++) gl.disableVertexAttribArray(i);
            this.cur = null;
        }
        free(m) {
            const gl = this.gl;
            for (const k of [ "vb", "ib", "lb", "lib" ]) m[k] && gl.deleteBuffer(m[k]), m[k] = null;
        }
        drawMesh(P, m) {
            const gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, m.vb), this.attribs(P, [ [ "aP", 3 ], [ "aN", 3 ], [ "aO", 3 ], [ "aC", 3 ], [ "aC2", 3 ], [ "aW", 1 ], [ "aF", 1 ] ], GM.STRIDE), 
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
            const u32 = m.idx instanceof Uint32Array;
            u32 && !this.uintOK || gl.drawElements(gl.TRIANGLES, m.idx.length, u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
        }
        drawLines(P, lb, lib, nl) {
            const gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, lb), this.attribs(P, [ [ "aA", 3 ], [ "aB", 3 ], [ "aS", 2 ], [ "aW", 1 ], [ "aAl", 1 ], [ "aCol", 3 ], [ "aSw", 2 ] ], 15), 
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lib);
            const u32 = 4 * nl > 65e3;
            u32 && !this.uintOK || gl.drawElements(gl.TRIANGLES, 6 * nl, u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
        }
        dynBuf(name, data) {
            const gl = this.gl;
            let b = this.dyn[name];
            return b || (b = this.dyn[name] = gl.createBuffer()), gl.bindBuffer(gl.ARRAY_BUFFER, b), 
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW), b;
        }
        lampPools(V, hab, LL, night) {
            const gl = this.gl, v = [];
            for (const L of LL) {
                const y = this.R.lampSurface(hab, L) + .08, R = 1.1 * L.r, a = .22 + .25 * night;
                this.liftQuad(hab, v, L.pool[0], y, L.pool[2], [ R, 0 ], [ 0, R ], a);
            }
            const P = this.use(this.P.tex);
            this.view(P, V), gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf("pool", new Float32Array(v))), 
            this.attribs(P, [ [ "aP", 3 ], [ "aUV", 2 ], [ "aA", 1 ] ], 6), gl.bindTexture(gl.TEXTURE_2D, this.tex.radial), 
            gl.uniform1f(P.u.uLit, 0), gl.blendFunc(gl.ONE, gl.ONE), gl.uniform4f(P.u.uCol, 1, .72, .4, .22 + .28 * night), 
            gl.drawArrays(gl.TRIANGLES, 0, v.length / 6), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
        drawGhost(V, gh) {
            const gl = this.gl, g = gh.geom, m = GM.build(g);
            if (!m.n) return;
            m.vb && m.gl === this || (m.gl = this, m.vb = this.buf(m.verts), m.ib = this.buf(m.idx, "idx"));
            const P = this.use(this.meshProg());
            this.view(P, V), this.light(P), gl.enable(gl.BLEND), gl.depthMask(!1), gl.uniform3f(P.u.uWind, 0, 0, 0), gl.uniform3f(P.u.uSway, 0, 0, 0), 
            gl.uniform2f(P.u.uGnd, 0, 0), gl.uniform1f(P.u.uAlpha, gh.ok ? .8 : .5), gl.uniform4f(P.u.uGhost, gh.ok ? .45 : .9, gh.ok ? .85 : .3, gh.ok ? .45 : .25, .3), 
            gl.uniform1f(P.u.uPass, 0), this.drawMesh(P, m), gl.uniform1f(P.u.uAlpha, 1), gl.uniform4f(P.u.uGhost, 0, 0, 0, 0);
        }
        gradeAt(p) {
            const F = this.F;
            let r = F.grade[0], g = F.grade[1], b = F.grade[2];
            for (let i = 0; i < F.lamps.length; i++) {
                const u = F.lampU, d = Math.hypot(p[0] - u[4 * i], p[1] - u[4 * i + 1], p[2] - u[4 * i + 2]), a = M.clamp(1 - d / u[4 * i + 3], 0, 1), s = a * a * (.25 + .9 * F.night);
                r += s, g += .72 * s, b += .42 * s;
            }
            return [ Math.min(1.3, r), Math.min(1.3, g), Math.min(1.3, b) ];
        }
        gpuCrit() {
            if (this._gc && this._gc.gl === this.gl) return this._gc;
            this._gc = null;
            try {
                this._gc = new JT.GPUCrit(this.gl);
            } catch (e) {
                console.warn("GPU critters off:", e && e.message), this._gcOff = !0;
            }
            return this._gc;
        }
        sprites(V, hab, scene, night) {
            const gl = this.gl, R = this.R, k = R.k, W = this.cv.width, H = this.cv.height, list = [], tS = performance.now(), TR = JT.Terrain, ter = TR ? TR.get(hab) : null;
            for (const it of scene.items) {
                if (it.inst || it.noGL || it.ln || it.silk || it.ghost || !it.p || !M.finite3(it.p)) continue;
                const lp = ter ? TR.liftWith(ter, it.p) : it.p, q = V.P(lp), q0 = lp === it.p ? q : V.P(it.p);
                let r = it.r * V.s + 6 * k;
                if (q[0] < -r || q[0] > W + r || q[1] < -r || q[1] > H + r) continue;
                let sc = 1;
                const capS = Math.min(1, 1.25 / k);
                r > 100 && capS < 1 && (sc = Math.max(capS, 100 / r)), this._hdF && (sc = Math.min(sc, Math.max(this._hdF, .5))), 
                r * sc > 254 && (sc = 254 / r), r *= sc;
                const rp = Math.ceil(r);
                list.push({
                    it: it,
                    q: q,
                    q0: q0,
                    rp: rp,
                    sc: sc,
                    dep: V.depth(lp),
                    z: V.depth(lp) - (null != it.bias ? it.bias : it.ground ? .2 : .35 * it.r)
                });
            }
            if (!list.length) return;
            {
                const A = s => (2 * s.rp + 2) * (2 * s.rp + 2);
                let keep = 0, rest = 0;
                for (const s of list) s.it.xr ? keep += A(s) : rest += A(s);
                const B = 6e5, room = Math.max(.3 * B, B - keep);
                if (rest > room) {
                    const f = Math.sqrt(room / rest);
                    for (const s of list) s.it.xr || (s.sc *= f, s.rp = Math.max(3, Math.ceil(s.rp * f)));
                }
            }
            const SC = this._sc || (this._sc = new Map), sf = this._sf = (this._sf || 0) + 1;
            for (const s of list) {
                const k = s.it.key;
                if (!k) continue;
                let rq = 8 * Math.ceil(s.rp / 8);
                const pv = SC.get(k);
                pv && rq <= pv.rp && rq >= pv.rp - 16 && (rq = pv.rp), s.rp = rq;
            }
            const order = list.slice().sort((a, b) => b.rp - a.rp || ((a.it.key || "") < (b.it.key || "") ? -1 : (a.it.key || "") > (b.it.key || "") ? 1 : 0));
            let AW = 512, x = 0, y = 0, rowH = 0;
            const pack = aw => {
                x = 0, y = 0, rowH = 0;
                for (const s of order) {
                    const w = 2 * s.rp + 2;
                    x + w > aw && (x = 0, y += rowH, rowH = 0), s.ax = x + 1, s.ay = y + 1, x += w, 
                    rowH = Math.max(rowH, w);
                }
                return y + rowH;
            };
            for (;AW < 2048 && (2 * order[0].rp + 2 > AW || pack(AW) > AW); ) AW *= 2;
            const cur = this._aw || AW;
            AW >= cur || ++this._awN > 90 ? (this._aw = AW, this._awN = 0) : AW = cur, pack(AW);
            const need = Math.min(2048, 128 * Math.ceil((y + rowH) / 128)), cpu = !(R.set.perf && R.set.ptGpuAtlas), old = cpu && R.set.perf && R.set.ptOldAtlas, direct = cpu && !old;
            let ATW, ATH;
            if (this._atlasCPU !== cpu && (this._atlasCPU = cpu, this.atlas = mkCanvas(direct ? 1 : this.atlas.width, direct ? 1 : this.atlas.height), 
            this.actx = this.atlas.getContext("2d", cpu ? {
                willReadFrequently: !0
            } : void 0), this._atexSz = null), direct !== !!this._atlasDirect && (this._atlasDirect = direct, 
            this._atexSz = null, direct && (this.atlas.width = 1, this.atlas.height = 1)), direct) {
                ATW = AW;
                const ch = this._atH || 0;
                ATH = ch < need || ch > 2 * need + 256 ? need : ch, this._atH = ATH;
            } else (this.atlas.width !== AW || this.atlas.height < need || this.atlas.height > 2 * need + 256) && (this._atlasGrow = (this._atlasGrow || 0) + 1, 
            this.atlas.width = AW, this.atlas.height = need, this.actx = this.atlas.getContext("2d")), 
            ATW = this.atlas.width, ATH = this.atlas.height;
            const g0 = this.actx;
            g0.setTransform(1, 0, 0, 1, 0, 0), g0.globalAlpha = 1, g0.globalCompositeOperation = "source-over";
            const V2 = this.V2, sig = AW + "x" + ATH + (direct ? "d" : cpu ? "c" : "g"), reuse = !(R.set.perf && R.set.ptNoReuse);
            if (gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, this.atex), direct) {
                const sz = ATW + "x" + ATH;
                sz !== this._atexSz && (gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ATW, ATH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), 
                this._atexSz = sz), gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !0);
            }
            const pool = this._scr || (this._scr = new Map);
            let upT = 0;
            const GC = direct && this.gl2 && !1 !== R.set.gpuCrit && !this._gcOff ? this.gpuCrit() : null, later = [];
            GC && (GC.beginFrame(), GC.aw = ATW, GC.ah = ATH);
            const paintCPU = s => {
                let g = g0, ox = 0, oy = 0, sc0 = null;
                const S = 2 * s.rp + 2;
                if (direct) {
                    if (sc0 = pool.get(S), !sc0) {
                        const c = mkCanvas(S, S);
                        sc0 = {
                            c: c,
                            g: c.getContext("2d", {
                                willReadFrequently: !0
                            })
                        }, pool.set(S, sc0);
                    }
                    sc0.f = sf, g = sc0.g, ox = 1 - s.ax, oy = 1 - s.ay, g.setTransform(1, 0, 0, 1, 0, 0), 
                    g.globalAlpha = 1, g.globalCompositeOperation = "source-over", g.clearRect(0, 0, S, S);
                } else g.clearRect(s.ax - 1, s.ay - 1, S, S);
                const cx = s.ax + s.rp + ox, cy = s.ay + s.rp + oy;
                if (1 === s.sc) V2.set(V.yaw, V.pitch, V.s, V.cx + (cx - s.q0[0]), V.cy + (cy - s.q0[1]), V.c); else {
                    V2.set(V.yaw, V.pitch, V.s * s.sc, 0, 0, V.c);
                    const q2 = V2.P(s.it.p);
                    V2.set(V.yaw, V.pitch, V.s * s.sc, cx - q2[0], cy - q2[1], V.c);
                }
                g.save(), g.beginPath(), g.rect(s.ax + ox, s.ay + oy, 2 * s.rp, 2 * s.rp), g.clip();
                try {
                    scene.run(s.it, g, V2);
                } catch (e) {
                    JT.DEV && console.warn(e);
                }
                if (g.restore(), g.globalAlpha = 1, g.globalCompositeOperation = "source-over", 
                direct) {
                    const t1 = performance.now();
                    gl.texSubImage2D(gl.TEXTURE_2D, 0, s.ax - 1, s.ay - 1, gl.RGBA, gl.UNSIGNED_BYTE, sc0.c), 
                    upT += performance.now() - t1;
                }
            };
            for (const s of order) {
                if (direct ? s.ay - 1 + 2 * s.rp + 2 > ATH : s.ay + 2 * s.rp > ATH) {
                    s.skip = !0;
                    continue;
                }
                const k = s.it.key, pv = k ? SC.get(k) : null;
                if (s.ps = V.s * s.sc, reuse && pv && !s.it.xr && !s.it.hot && pv.sig === sig && pv.ax === s.ax && pv.ay === s.ay && pv.rp === s.rp && (s.it.still ? sf - pv.f < 24 : sf - pv.f < 2 && sf + pv.h & 1)) s.ps = pv.ps, 
                s.keep = !0; else {
                    if (k && SC.set(k, {
                        ax: s.ax,
                        ay: s.ay,
                        rp: s.rp,
                        ps: s.ps,
                        f: sf,
                        sig: sig,
                        h: 1 & k.charCodeAt(k.length - 1)
                    }), GC) {
                        const S = 2 * s.rp + 2, g = GC.begin(s.ax - 1, s.ay - 1, S, S), cx = s.ax + s.rp, cy = s.ay + s.rp;
                        if (1 === s.sc) V2.set(V.yaw, V.pitch, V.s, V.cx + (cx - s.q0[0]), V.cy + (cy - s.q0[1]), V.c); else {
                            V2.set(V.yaw, V.pitch, V.s * s.sc, 0, 0, V.c);
                            const q2 = V2.P(s.it.p);
                            V2.set(V.yaw, V.pitch, V.s * s.sc, cx - q2[0], cy - q2[1], V.c);
                        }
                        g.save(), g.beginPath(), g.rect(s.ax, s.ay, 2 * s.rp, 2 * s.rp), g.clip();
                        let ok = !0;
                        try {
                            scene.run(s.it, g, V2);
                        } catch (e) {
                            ok = !1, JT.DEV && console.warn(e);
                        }
                        GC.end(ok) || later.push(s);
                        continue;
                    }
                    paintCPU(s);
                }
            }
            if (GC) {
                const t1 = performance.now();
                GC.flush(this.atex, ATW, ATH, {
                    fb: this._tgtFB || null,
                    w: this._hdPost ? W : this._vpW || W,
                    h: this._hdPost ? H : this._vpH || H,
                    prog: this.cur ? this.cur.p : null
                }), upT += performance.now() - t1, GC.broken && (this._gcOff = !0);
                for (const s of later) paintCPU(s);
                this._gcStat = GC.stats;
            }
            if (!(sf % 120)) {
                for (const [k, v] of SC) sf - v.f > 120 && SC.delete(k);
                for (const [k, v] of pool) sf - v.f > 240 && pool.delete(k);
            }
            const tU = performance.now();
            R._sprT = tU - tS - upT, gl.activeTexture(gl.TEXTURE0), gl.bindTexture(gl.TEXTURE_2D, this.atex), 
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !0);
            const g = g0;
            if (!direct) {
                const sz = this.atlas.width + "x" + this.atlas.height;
                if (cpu) {
                    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1), sz !== this._atexSz && (gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.atlas.width, this.atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), 
                    this._atexSz = sz);
                    const AHc = this.atlas.height;
                    for (const s of order) {
                        if (s.skip || s.keep) continue;
                        const x0 = Math.max(0, s.ax - 1), y0 = Math.max(0, s.ay - 1), w = Math.min(AW - x0, 2 * s.rp + 2), h = Math.min(AHc - y0, 2 * s.rp + 2);
                        w <= 0 || h <= 0 || gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, g.getImageData(x0, y0, w, h).data);
                    }
                } else sz === this._atexSz ? gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas) : (gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas), 
                this._atexSz = sz);
            }
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1), this.texParams(!1), this._hdF && (gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST), 
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)), R._upT = performance.now() - tU + upT, 
            list.sort((a, b) => b.dep - a.dep);
            const AH = ATH, v = [], xr = [], quad = (s, out) => {
                const t = this.gradeAt(s.it.p), big = s.rp * V.s / s.ps, x0 = s.q[0] - big, x1 = s.q[0] + big, y0 = s.q[1] - big, y1 = s.q[1] + big, u0 = s.ax / AW, u1 = (s.ax + 2 * s.rp) / AW, v0 = s.ay / AH, v1 = (s.ay + 2 * s.rp) / AH, c = [ [ x0, y0, u0, v0 ], [ x1, y0, u1, v0 ], [ x1, y1, u1, v1 ], [ x0, y0, u0, v0 ], [ x1, y1, u1, v1 ], [ x0, y1, u0, v1 ] ];
                for (const p of c) out.push(p[0], p[1], s.z, p[2], p[3], t[0], t[1], t[2], s.sc || 1);
            };
            for (const s of list) s.skip || (quad(s, v), s.it.xr && quad(s, xr));
            const P = this.use(this.P.spr);
            gl.uniform2f(P.u.uRes, W, H), gl.uniform1i(P.u.uTex, 0), gl.uniform2f(P.u.uTexel, 1 / AW, 1 / AH), 
            gl.uniform3f(P.u.uInk, .15 * (1 - .3 * night), .11 * (1 - .3 * night), .08 * (1 - .3 * night)), 
            gl.uniform1f(P.u.uInkAmt, .9), gl.uniform1f(P.u.uAlpha, 1), gl.uniform1f(P.u.uPm, cpu && !direct ? 1 : 0);
            const HPp = this._hdPost;
            gl.uniform1f(P.u.uHD, HPp ? 1 : 0), gl.uniform1f(P.u.uPx, HPp ? Math.max(1, 1 / HPp.f) : 1), 
            gl.uniform1f(P.u.uCut, 0), gl.enable(gl.DEPTH_TEST), gl.depthFunc(gl.LEQUAL), gl.depthMask(!1), 
            gl.enable(gl.BLEND), gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            const HP = this._hdPost;
            HP && (gl.disable(gl.DEPTH_TEST), gl.activeTexture(gl.TEXTURE1), gl.bindTexture(gl.TEXTURE_2D, HP.dt2), 
            gl.uniform1i(P.u.uDepT, 1), gl.activeTexture(gl.TEXTURE0), gl.uniform2f(P.u.uOut, W, H)), 
            gl.uniform1f(P.u.uOcc, HP ? 1 : 0), gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf("spr", new Float32Array(v))), 
            this.attribs(P, [ [ "aXY", 2 ], [ "aZ", 1 ], [ "aUV", 2 ], [ "aT", 4 ] ], 9), gl.drawArrays(gl.TRIANGLES, 0, v.length / 9), 
            gl.depthMask(!1), xr.length && (gl.depthFunc(gl.GREATER), gl.uniform1f(P.u.uAlpha, .65), 
            HP && gl.uniform1f(P.u.uOcc, 2), gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf("sprx", new Float32Array(xr))), 
            this.attribs(P, [ [ "aXY", 2 ], [ "aZ", 1 ], [ "aUV", 2 ], [ "aT", 4 ] ], 9), gl.drawArrays(gl.TRIANGLES, 0, xr.length / 9), 
            gl.depthFunc(gl.LEQUAL), gl.uniform1f(P.u.uAlpha, 1));
        }
        silk(V, hab, scene, night) {
            const v = [], push = (a, b, w, al, col) => {
                for (const [sd, en] of [ [ -1, 0 ], [ 1, 0 ], [ 1, 1 ], [ -1, 0 ], [ 1, 1 ], [ -1, 1 ] ]) v.push(a[0], a[1], a[2], b[0], b[1], b[2], sd, en, w, al, col[0], col[1], col[2], 0, 0);
            }, white = [ .97, .97, 1 ], TR = JT.Terrain, ter = TR ? TR.get(hab) : null, LW = p => ter ? TR.liftWith(ter, p) : p;
            for (const it of scene.items) if (it.ln) push(LW(it.ln.a), LW(it.ln.b), it.ln.w, it.ln.al, white); else if (it.silk) {
                const s = {
                    a: LW(it.silk.a),
                    b: LW(it.silk.b),
                    age: it.silk.age,
                    kind: it.silk.kind
                }, m = M.lerp3(s.a, s.b, .5);
                m[1] -= .05 * M.dist(s.a, s.b);
                const fade = Math.max(0, 1 - s.age / ("retreat" === s.kind ? 1800 : 600)), al = ("retreat" === s.kind ? .5 : .32) * fade + .08 * night;
                if (al < .02) continue;
                push(s.a, m, .12, al, white), push(m, s.b, .12, al, white);
            }
            if (!v.length) return;
            const gl = this.gl, P = this.use(this.P.line);
            this.view(P, V), this.light(P), gl.uniform1f(P.u.uLW, V.s), gl.uniform1f(P.u.uMinW, this._hdF ? .9 / this._hdF : .6 * this.R.k), 
            gl.uniform1f(P.u.uAlpha, 1), gl.uniform1f(P.u.uLitL, 1), gl.uniform3f(P.u.uWind, 0, 0, 0), gl.uniform3f(P.u.uSway, 0, 0, 0), 
            gl.enable(gl.DEPTH_TEST), gl.depthMask(!1), gl.enable(gl.BLEND), gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf("silk", new Float32Array(v))), 
            this.attribs(P, [ [ "aA", 3 ], [ "aB", 3 ], [ "aS", 2 ], [ "aW", 1 ], [ "aAl", 1 ], [ "aCol", 3 ], [ "aSw", 2 ] ], 15), 
            gl.drawArrays(gl.TRIANGLES, 0, v.length / 15);
        }
    };
}();
