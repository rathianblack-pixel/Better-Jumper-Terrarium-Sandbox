/* Natural tank shoulders v1. Cosmetic only: never used by Nav, placement or floorPoly.
 * The saved shoreline seed is independent of terrain rerolls and background changes.
 * All rings enclose the original floor, including its corners and occupied objects.
 */
(function(root){
'use strict';
const J=root.JT,G=J.GLMesh,M=J.M,TAU=Math.PI*2;
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function seed(h){return Number.isFinite(h.data.shorelineSeed)?h.data.shorelineSeed:J.hashStr('shoreline-v1:'+h.data.id)>>>0;}
function profile(h){
 const W=h.dims.w,D=h.dims.d,hw=W/2,hd=D/2,small=Math.min(W,D),s=seed(h),rnd=J.makeRng(s),phase=[rnd()*TAU,rnd()*TAU,rnd()*TAU];
 // Include exact rectangle-corner rays; otherwise a sampled inner ring can cut
 // across a corner and leave a triangular sliver of the old slab exposed.
 const angles=Array.from({length:96},(_,i)=>i*TAU/96);
 if(h.dims.shape!=='circle')for(const x of [-hw,hw])for(const z of [-hd,hd])angles.push((Math.atan2(z,x)+TAU)%TAU);
 angles.sort((a,b)=>a-b);
 const rows=angles.filter((a,i)=>!i||a-angles[i-1]>1e-7).map(a=>{
  const dx=Math.cos(a),dz=Math.sin(a),wave=.55*Math.sin(2*a+phase[0])+.3*Math.sin(3*a+phase[1])+.15*Math.sin(5*a+phase[2]);
  const inner=h.dims.shape==='circle'?1/Math.hypot(dx/hw,dz/hd):Math.min(hw/Math.max(1e-9,Math.abs(dx)),hd/Math.max(1e-9,Math.abs(dz)));
  const margin=small*(.235+.13*wave),corner=margin*1.8;
  let outer;
  if(h.dims.shape==='circle')outer=inner+margin;
  else {
   // Ray intersection with an expanded rounded rectangle (signed distance).
   const sdf=r=>{const x=Math.abs(dx*r)-(hw+margin-corner),z=Math.abs(dz*r)-(hd+margin-corner);return Math.hypot(Math.max(x,0),Math.max(z,0))+Math.min(Math.max(x,z),0)-corner;};
   let lo=inner,hi=Math.hypot(hw+margin,hd+margin)+corner;
   for(let k=0;k<24;k++){const mid=(lo+hi)/2;if(sdf(mid)>0)hi=mid;else lo=mid;}outer=(lo+hi)/2;
  }
  const x=hw+dx*inner,z=hd+dz*inner,y=J.Terrain?J.Terrain.at(h,M.clamp(x,0,W),M.clamp(z,0,D)):0;
  return {a,dx,dz,inner,outer,y,lip:-.9-.65*(wave+1),wave,apron:small*(.23+.055*Math.sin(3*a+phase[1]))};
 });
 return {W,D,hw,hd,rows,seed:s};
}
function top(h){
 const p=profile(h),v=[],{W,D,hw,hd,rows}=p;
 const point=(q,t)=>{const inset=h.dims.shape==='circle'?Math.max(.3,q.inner*.003):.18,r=q.inner-inset+(q.outer-q.inner+inset)*t;return [hw+q.dx*r,q.y*(1-t)+q.lip*t,hd+q.dz*r];};
 // Split at UV mirror folds before triangulating, keeping the original floor
 // texture perfectly continuous without stretched borders or triangular bands.
 const clip=(poly,axis,bound,positive)=>{
  const out=[];for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-bound)*positive,db=(b[axis]-bound)*positive;
   if(da>=-1e-8)out.push(a);
   if((da>1e-8&&db< -1e-8)||(da< -1e-8&&db>1e-8)){const t=da/(da-db);out.push(a.map((n,j)=>n+(b[j]-n)*t));}
  }return out;
 };
 const emit=tri=>{
  let pieces=[tri];for(const [axis,bound] of [[0,0],[0,W],[2,0],[2,D]])pieces=pieces.flatMap(poly=>[clip(poly,axis,bound,1),clip(poly,axis,bound,-1)].filter(q=>q.length>=3));
  const mirror=x=>{const t=((x%2)+2)%2;return t<=1?t:2-t;};
  for(const poly of pieces)for(let i=1;i<poly.length-1;i++)for(const q of [poly[0],poly[i],poly[i+1]])v.push(...q,mirror(q[0]/W),mirror(q[2]/D));
 };
 for(let i=0;i<rows.length;i++){const a=rows[i],b=rows[(i+1)%rows.length];for(let k=0;k<3;k++){const A=point(a,k/3),B=point(b,k/3),C=point(b,(k+1)/3),D0=point(a,(k+1)/3);emit([A,B,C]);emit([A,C,D0]);}}
 return v;
}
function append(h,mb,cfg){
 const p=profile(h),{hw,hd,rows}=p,S=J.SUBSTRATES[h.data.substrate]||J.SUBSTRATES.coco;
 const floor=G.rgb(cfg.floor),soil=mix(G.rgb(S.mid),G.rgb('#f4f0e5'),.14),topC=mix(G.rgb(S.top),G.rgb('#f4f0e5'),J.HD2D&&J.HD2D.on?.07:.20),dark=mix(soil,G.rgb('#32281e'),.25);
 const snow=cfg.feature==='snow'||cfg.feature==='summit',dry=['dunes','canyon','basalt'].includes(cfg.feature),bare=['crystals','grotto','zen'].includes(cfg.feature);
 const ring=[];
 for(let k=0;k<6;k++){
  const row=[];
  for(const q of rows){
   const cover=.5+.5*Math.sin(q.a*3+p.seed%31),bankY=-3.5-4*cover;
   const heights=[q.lip,-2.8,bankY,bankY-3.8,-16.6,-18.30];
   const offsets=[0,.025,.15,.32,.68,1];
   const r=q.outer+q.apron*offsets[k],x=hw+q.dx*r,z=hd+q.dz*r;
   // Ground rises unevenly into the soil bank; no constant-height coloured ring.
   const colors=[topC,soil,mix(dark,floor,.65+.2*cover),mix(floor,soil,.04),floor,floor];
   const weather=.5+.5*Math.sin(q.a*4+p.seed%19);const c=mix(colors[k],k<2?soil:floor,k<3?.06+.12*weather:.025*Math.sin(q.a*11));
   const n=M.norm([q.dx*.45,k<2?.8:1,q.dz*.45]);
   row.push(mb.vert([x,heights[k],z],n,[0,0,0],c,c,G.TWO|G.PAT.speck));
  }ring.push(row);
 }
 for(let k=0;k<ring.length-1;k++)for(let i=0;i<rows.length;i++){const j=(i+1)%rows.length;mb.quad(ring[k][i],ring[k][j],ring[k+1][j],ring[k+1][i]);}
 // Sparse accents, not a perimeter fence. None enter the playable floor.
 const rnd=J.makeRng(p.seed^0x6273ac91),count=10;
 for(let i=0;i<count;i++){
  const q=rows[Math.floor(rnd()*rows.length)],t=.24+rnd()*.4,r=q.outer+q.apron*t,x=hw+q.dx*r,z=hd+q.dz*r;
  const cover=.5+.5*Math.sin(q.a*3+p.seed%31),y=(-5.5-5*cover)-2.8-(t-.32)*15;
  const size=1.2+rnd()*2.4,col=G.rgb(snow?'#d9e4e8':dry?cfg.floor:cfg.stone);
  if(i%3===0||snow||dry||bare){G.ell(mb,[x,y,z],[size*1.6,0,0],[0,size*(snow?.35:.5),0],[0,0,size],col,mix(col,floor,.25),G.PAT.speck,null,6,3,true,0);}
  else {
   const c=mix(G.rgb(cfg.leaf),floor,.35),n=[0,1,0];
   for(let k=0;k<3;k++){
    const a=rnd()*TAU,dx=Math.cos(a),dz=Math.sin(a),L=2+rnd()*3;
    const pts=[[x-dz*.7,y+.12,z+dx*.7],[x+dx*L,y+.25,z+dz*L],[x+dz*.7,y+.12,z-dx*.7]].map(v=>mb.vert(v,n,[0,0,0],c,c,G.TWO));mb.tri(...pts);
   }
  }
 }
 return {seed:p.seed,samples:rows.length,cosmeticOnly:true};
}
J.Shoreline={version:1,seed,profile,top,append};
})(typeof window!=='undefined'?window:globalThis);
