/* All-around miniature environments. Cosmetic meshes only; no simulation/save changes.
 * Seeded geometry is uploaded once through the existing GLMesh pipeline. Tall clusters
 * are separate draw units so only a cluster crossing the habitat sightline can fade.
 */
(function(root){
'use strict';
const J=root.JT,G=J.GLMesh,M=J.M,P=J.GLPaint.prototype,TAU=Math.PI*2,UP=[0,1,0],ZERO=[0,0,0],rgb=G.rgb;
const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
// Per-scene composition, not a palette swap: relief, water, planting and landmarks.
const plans={
 mossy:{floor:'#67734b',stone:'#7c8270',leaf:'#789641',kind:'fern',water:'stream',feature:'woodland',relief:9,seed:17},
 pondside:{floor:'#657e60',stone:'#879386',leaf:'#74a574',kind:'reed',water:'pond',feature:'willow',relief:5,seed:23},
 waterfall:{floor:'#5a776b',stone:'#728d89',leaf:'#6d9f70',kind:'fern',water:'basin',feature:'falls',relief:18,seed:31},
 mangrove:{floor:'#7c8062',stone:'#8b9280',leaf:'#729979',kind:'reed',water:'tide',feature:'mangrove',relief:4,seed:47},
 underwater:{floor:'#456876',stone:'#608290',leaf:'#54a2a0',kind:'kelp',water:'pool',feature:'grotto',relief:17,seed:59},
 canopy:{floor:'#4e6840',stone:'#7c8260',leaf:'#82ac59',kind:'broad',feature:'canopy',relief:11,seed:67},
 hollow:{floor:'#766044',stone:'#938468',leaf:'#ac995d',kind:'mushroom',feature:'hollow',relief:7,seed:79},
 log:{floor:'#796544',stone:'#929079',leaf:'#8e9a53',kind:'mushroom',feature:'logs',relief:8,seed:83},
 autumnwood:{floor:'#a5824b',stone:'#a49a7c',leaf:'#da9c45',kind:'leaf',feature:'autumn',relief:10,seed:97},
 deepjungle:{floor:'#3c593d',stone:'#657960',leaf:'#5c9d59',kind:'broad',feature:'jungle',relief:15,seed:101},
 bamboo:{floor:'#85916a',stone:'#8c9782',leaf:'#91b668',kind:'grass',feature:'bamboo',relief:5,seed:113},
 meadow:{floor:'#9bb26c',stone:'#a3a38b',leaf:'#85a14e',kind:'flower',feature:'meadow',relief:17,seed:127},
 dusk:{floor:'#a0855e',stone:'#a48c7c',leaf:'#d6a76a',kind:'grass',feature:'sunset',relief:12,seed:137},
 misty:{floor:'#859895',stone:'#a3b2af',leaf:'#8ea5a0',kind:'heather',feature:'highland',relief:30,seed:149},
 cloudpeak:{floor:'#a4b5c1',stone:'#bfced6',leaf:'#a6b9bb',kind:'grass',feature:'summit',relief:46,seed:157},
 stone:{floor:'#b4b8a0',stone:'#747f78',leaf:'#839777',kind:'grass',feature:'zen',relief:3,seed:163},
 sakura:{floor:'#b4a7a6',stone:'#a49caa',leaf:'#e7b8cf',kind:'petal',feature:'cherry',relief:12,seed:179},
 ancientruin:{floor:'#7b8567',stone:'#9a9f87',leaf:'#96a069',kind:'fern',feature:'temple',relief:16,seed:191},
 dunes:{floor:'#c9ad73',stone:'#b59c77',leaf:'#96a16b',kind:'succulent',water:'oasis',feature:'dunes',relief:29,seed:199},
 redrock:{floor:'#b57854',stone:'#bc7857',leaf:'#b6a179',kind:'succulent',feature:'canyon',relief:26,seed:211},
 volcanicash:{floor:'#645954',stone:'#78746b',leaf:'#ad9372',kind:'mineral',water:'spring',feature:'basalt',relief:19,seed:227},
 twilight:{floor:'#796c7c',stone:'#95899e',leaf:'#b18eac',kind:'mushroom',feature:'twilight',relief:9,seed:239},
 moonwood:{floor:'#637789',stone:'#8a9aa9',leaf:'#94a6b6',kind:'fern',feature:'moon',relief:13,seed:251},
 firefly:{floor:'#5c755b',stone:'#7d9072',leaf:'#9ab779',kind:'mushroom',feature:'firefly',relief:8,seed:263},
 crystalcave:{floor:'#496779',stone:'#698493',leaf:'#8ac8d6',kind:'crystal',water:'crystal',feature:'crystals',relief:24,seed:277},
 snowfield:{floor:'#bfcfd6',stone:'#a2b4c1',leaf:'#a3bcb8',kind:'grass',feature:'snow',relief:20,seed:283}
};
Object.assign(J.BACKGROUNDS.mossy,{sky:['#526c5c','#96a486','#b5b990'],ground:'#67734b',fog:'#96a486',light:'#eee4b6',shafts:.22});
function upload(p,mb){
 // Most clusters already fit core WebGL's 16-bit range: upload directly,
 // without a per-triangle Map walk or temporary JS copies of every vertex.
 if(mb.n<=63000){const verts=new Float32Array(mb.v),idx=new Uint16Array(mb.i);
  const vb=p.buf(verts),ib=p.buf(idx,'idx');return {verts,idx,n:mb.n,vb,ib,nl:0,del:[vb,ib],parts:[]};}
 // Keep every draw within WebGL 1's core 16-bit index range. The old renderer
 // supports optional uint indices, but external worlds must not require them.
 const parts=[];let mapping=new Map(),v=[],indices=[];
 const flush=()=>{if(!indices.length)return;const verts=new Float32Array(v),idx=new Uint16Array(indices);
  const m={verts,idx,n:v.length/G.STRIDE,vb:p.buf(verts),ib:p.buf(idx,'idx'),nl:0,del:[]};m.del=[m.vb,m.ib];parts.push(m);mapping=new Map();v=[];indices=[];};
 for(let i=0;i<mb.i.length;i+=3){
  const tri=[mb.i[i],mb.i[i+1],mb.i[i+2]];let missing=0;for(const k of tri)if(!mapping.has(k))missing++;
  if(mapping.size+missing>63000)flush();
  for(const source of tri){let target=mapping.get(source);if(target===undefined){target=mapping.size;mapping.set(source,target);for(let k=0;k<G.STRIDE;k++)v.push(mb.v[source*G.STRIDE+k]);}indices.push(target);}
 }
 flush();const first=parts.shift();first.parts=parts;for(const part of parts)first.del.push(...part.del);return first;
}
function build(p,h){
 const id=h.data.bg||'mossy',cfg=plans[id]||plans.mossy,B=J.BACKGROUNDS[id]||J.BACKGROUNDS.mossy;
 const quality=p.R.quality||'medium',low=quality==='low',high=quality==='high';
 const W=h.dims.w,D=h.dims.d,S=Math.max(W,D,150),cx=W/2,cz=D/2,Y=-18.35;
 const rnd=J.makeRng(J.hashStr('surround-v2-'+cfg.seed+'-'+W+'-'+D)),pick=a=>a[Math.floor(rnd()*a.length)];
 const hd=!!(J.HD2D&&J.HD2D.on),paper=rgb('#e9e4d1');
 const floor=blend(rgb(cfg.floor),paper,hd?.035:.12),stone=blend(rgb(cfg.stone),paper,hd?.04:.13),leafC=blend(rgb(cfg.leaf),paper,hd?.035:.10),fog=blend(floor,rgb(B.sky[1]),.48),bark=blend(stone,rgb('#5e4938'),.65);
 let mb=new G.MB({height:200,baseY:Y});const base=mb,groups=[];
 const quiet=(x,z,pad=12)=>x>-pad&&x<W+pad&&z>-pad&&z<D+pad;
 const dist=(x,z)=>Math.hypot((x-cx)/S,(z-cz)/S);
 const elevation=(x,z)=>{
  const d=dist(x,z),fade=M.clamp((d-.64)*1.4,0,1);
  let v=(Math.sin(x/S*.86+cfg.seed)*.4+Math.cos(z/S*1.18)*.28+Math.sin((x+z)/S*1.9)*.16)*cfg.relief;
  if(cfg.feature==='dunes')v=cfg.relief*(.4+.5*Math.sin(x/S*1.7+Math.sin(z/S)));
  return Math.max(-42,Y+v*fade);
 };
 const riverX=z=>{const q=Math.max(0,(z-D-18)/S);return W+S*(.24+.08*Math.sin((z-cz)/S*1.45))-2*S*q*q/(.2+q);};
 const riverW=z=>S*(.115+.018*Math.cos(z/S*2));
 const pondCenter=cfg.water==='oasis'?[cx-S*1.3,cz+S*.55]:cfg.water==='basin'?[cx+S*.65,cz+S*.55]:[cx-S*1.25,cz-S*.1];
 const wet=(x,z)=>{
  if(!cfg.water)return false;
  if(cfg.water==='stream')return Math.abs(x-riverX(z))<riverW(z)+5;
  if(cfg.water==='tide')return x>W+S*.45+.18*S*Math.sin(z/S*2.4);
  return Math.hypot((x-pondCenter[0])/(S*.78),(z-pondCenter[1])/(S*.59))<1;
 };
 const ground=(x,z)=>wet(x,z)?Y-2:elevation(x,z);
 function vertex(pos,c,mat=G.TWO,n=UP){return mb.vert(pos,n,ZERO,c,c,mat);}
 function quad(a,b,c,d,col,mat){mb.quad(vertex(a,col,mat),vertex(b,col,mat),vertex(c,col,mat),vertex(d,col,mat));}
 function ell(x,y,z,sx,sy,sz,c,mat=G.PAT.speck){G.ell(mb,[x,y,z],[sx,0,0],[0,sy,0],[0,0,sz],c,blend(c,floor,.4),mat,null,high?8:low?5:6,high?4:3,true,.12);}
 function rock(x,z,s,high=1,c=stone){const y=ground(x,z);ell(x,y-1,z,s,s*.62*high,s*(.65+rnd()*.4),c);if(['woodland','logs','canopy','jungle','moon','firefly','temple'].includes(cfg.feature))ell(x-1,y+s*.48*high,z,s*.64,s*.12,s*.57,blend(leafC,floor,.35),G.PAT.moss);}
 function tube(points,a,b,col=bark){G.tube(mb,points,a,b,col,blend(col,floor,.35),G.PAT.grain,high?7:5,true,.08);}
 function leaf(a,b,w,c=leafC){const axis=M.sub(b,a),side=M.norm(M.cross(axis,UP)),mid=M.lerp3(a,b,.48);mid[1]+=Math.min(w*.24,M.len(axis)*.06);const coords=[a,M.add(mid,M.mul(side,w)),b,M.sub(mid,M.mul(side,w))],v=coords.map((p,i)=>vertex(p,blend(c,i===2?paper:floor,i===2?.12:.035)));mb.quad(...v);}
 function plant(x,z,size,kind=cfg.kind){
  const y=ground(x,z),phase=rnd()*TAU;
  if(kind==='crystal'||kind==='mineral'){
   for(let k=0;k<3;k++){const a=phase+k*2.1,s=size*(.3+rnd()*.4),px=x+Math.cos(a)*size*.3,pz=z+Math.sin(a)*size*.3;G.tube(mb,[[px,y,pz],[px+Math.cos(a)*s*.2,y+s,pz]],s*.2,.02,kind==='crystal'?blend(leafC,rgb('#c1eef1'),rnd()*.5):stone,stone,0,5,true,0);}return;
  }
  if(kind==='mushroom'){
   for(let k=0;k<3;k++){const xx=x+(rnd()-.5)*size,zz=z+(rnd()-.5)*size,hh=size*(.3+rnd()*.5),yy=ground(xx,zz);tube([[xx,yy,zz],[xx,yy+hh,zz]],.7,.5,blend(stone,rgb('#dec9a5'),.5));ell(xx,yy+hh,zz,hh*.65,hh*.28,hh*.65,blend(leafC,rgb('#c6a37d'),rnd()*.7));}return;
  }
  if(['leaf','petal'].includes(kind)){
   for(let k=0;k<7;k++){const a=rnd()*TAU,l=1+rnd()*size*.3;leaf([x+(rnd()-.5)*size,y+.2,z+(rnd()-.5)*size],[x+Math.cos(a)*l,y+.4,z+Math.sin(a)*l],l*.45,blend(leafC,stone,rnd()*.4));}return;
  }
  const count=kind==='fern'?5:kind==='broad'?4:kind==='succulent'?6:5;
  for(let k=0;k<count;k++){
   const a=phase+k*TAU/count,dx=Math.cos(a),dz=Math.sin(a),L=size*(.65+rnd()*.4);
   if(kind==='fern'){
    const at=t=>[x+dx*L*t*.72,y+L*(1.35*t-.78*t*t),z+dz*L*t*.72];
    tube([at(0),at(.5),at(1)],.17,.07,leafC);
    for(let j=1;j<7;j+=high?1:2){const t=j/7,v=at(t),l=L*.22*Math.sin(t*Math.PI);for(const sign of [-1,1])leaf(v,[v[0]-dz*l*sign+dx*l*.35,v[1]+l*.12,v[2]+dx*l*sign+dz*l*.35],l*.24,blend(leafC,floor,rnd()*.3));}
   }else if(kind==='broad'||kind==='succulent'||kind==='kelp'){
    leaf([x,y,z],[x+dx*L*.8,y+L*(kind==='kelp'?1.5:.6),z+dz*L*.8],L*(kind==='broad'?.28:.15),blend(leafC,floor,rnd()*.2));
   }else{
    const tip=[x+dx*L*.23,y+L,z+dz*L*.23];leaf([x,y,z],tip,L*.045,leafC);
    if(kind==='reed')tube([[tip[0],tip[1]-.15*L,tip[2]],tip],L*.045,L*.04,bark);
    if(kind==='flower'||kind==='heather'){
     const petal=rgb(pick(kind==='heather'?['#b297c1','#bdafc5']:['#e9d599','#d1afd3','#f1dfc0','#d6b174']));
     for(let j=0;j<4;j++){const b=j*TAU/4;ell(tip[0]+Math.cos(b)*1.1,tip[1],tip[2]+Math.sin(b)*1.1,1.3,.65,1.1,petal,0);}ell(tip[0],tip[1]+.4,tip[2],.7,.4,.7,rgb('#e5bc61'),0);
    }
   }
  }
 }
 function log(x,z,len,ang,rad){const y=ground(x,z),dx=Math.cos(ang),dz=Math.sin(ang),a=[x,y+rad*.6,z],b=[x+dx*len,y+rad*.6,z+dz*len];tube([a,M.lerp3(a,b,.5),b],rad,rad*.82);for(let k=0;k<5;k++){const t=rnd();ell(x+dx*len*t,y+rad*1.4,z+dz*len*t,rad*.8,rad*.18,rad*.65,blend(leafC,floor,.35),G.PAT.moss);}}
 // Continuous relief covers the whole reachable view; outer colour approaches the sky wash.
 // Streams have explicitly modelled banks and ribbon water, not overlapping blue planes.
 const N=high?58:low?32:42,extent=S*9,riverN=high?172:low?80:112,bankN=high?24:low?12:18;
 if(cfg.water==='stream'){
  for(let j=0;j<riverN;j++){
   const ta=2*j/riverN-1,tb=2*(j+1)/riverN-1,za=cz+extent*ta*ta*ta,zb=cz+extent*tb*tb*tb;
   for(const sign of [-1,1])for(let i=0;i<bankN;i++){
    const xa=riverX(za)+sign*riverW(za),xb=riverX(zb)+sign*riverW(zb),end=cx+sign*extent;
    const ax=xa+(end-xa)*i/bankN,bx=xb+(end-xb)*i/bankN,ax2=xa+(end-xa)*(i+1)/bankN,bx2=xb+(end-xb)*(i+1)/bankN;
    const c=blend(floor,fog,M.clamp((dist((ax+ax2)/2,za)-2)/6,0,1));
    quad([ax,i===0?Y-.7:elevation(ax,za),za],[bx,i===0?Y-.7:elevation(bx,zb),zb],[bx2,elevation(bx2,zb),zb],[ax2,elevation(ax2,za),za],c);
   }
   const col=blend(rgb('#577c77'),fog,.16);
   quad([riverX(za)-riverW(za),Y-1,za],[riverX(zb)-riverW(zb),Y-1,zb],[riverX(zb)+riverW(zb),Y-1,zb],[riverX(za)+riverW(za),Y-1,za],col);
  }
 }else{
  if(cfg.water&&cfg.water!=='tide'){
   // Radial bank topology has an exact shared shoreline: no grid stair-steps,
   // overlapping ground patches or rectangular bites in the water surface.
   const ox=pondCenter[0],oz=pondCenter[1],rx=S*.78,rz=S*.59,segments=high?88:low?48:64,rings=high?28:low?16:22;
   const pt=(a,k)=>{const t=k/rings,extra=extent*t*t;const x=ox+Math.cos(a)*(rx+extra),z=oz+Math.sin(a)*(rz+extra);const edge=M.clamp(extra/(S*.16),0,1);return[x,(Y-.7)*(1-edge)+elevation(x,z)*edge,z];};
   for(let k=0;k<rings;k++)for(let j=0;j<segments;j++){
    const a=j*TAU/segments,b=(j+1)*TAU/segments,c=pt((a+b)/2,k);
    quad(pt(a,k),pt(b,k),pt(b,k+1),pt(a,k+1),blend(floor,fog,M.clamp((dist(c[0],c[2])-2)/6,0,1)));
   }
   const wc=rgb(cfg.water==='spring'?'#85b6b3':cfg.water==='crystal'?'#497e99':cfg.water==='oasis'?'#5e9b9d':'#6a9991');
   G.disc(mb,[ox,Y-.9,oz],[rx,0,0],[0,0,rz],UP,wc,G.TWO,segments,0);
   for(let k=0;k<29;k++){const a=rnd()*TAU;rock(ox+Math.cos(a)*(rx+3),oz+Math.sin(a)*(rz+3),3+rnd()*9,.7,blend(stone,floor,.3));}
  }else if(cfg.water==='tide'){
   const shore=z=>W+S*.45+.18*S*Math.sin(z/S*2.4),wc=rgb('#658f87'),shoreN=high?120:low?60:90,shoreRings=high?28:low?14:20;
   for(let j=0;j<shoreN;j++){
    const za=cz-extent+2*extent*j/shoreN,zb=cz-extent+2*extent*(j+1)/shoreN;
    for(let i=0;i<shoreRings;i++){
     const xa=cx-extent+(shore(za)-cx+extent)*i/shoreRings,xb=cx-extent+(shore(zb)-cx+extent)*i/shoreRings,xc=cx-extent+(shore(zb)-cx+extent)*(i+1)/shoreRings,xd=cx-extent+(shore(za)-cx+extent)*(i+1)/shoreRings;
     quad([xa,elevation(xa,za),za],[xb,elevation(xb,zb),zb],[xc,i===shoreRings-1?Y-.7:elevation(xc,zb),zb],[xd,i===shoreRings-1?Y-.7:elevation(xd,za),za],floor);
    }
    quad([shore(za),Y-.9,za],[shore(zb),Y-.9,zb],[cx+extent,Y-.9,zb],[cx+extent,Y-.9,za],wc);
   }
  }else{
   const coord=t=>extent*t*t*t;
   for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    const x=cx+coord(2*i/N-1),z=cz+coord(2*j/N-1),xx=cx+coord(2*(i+1)/N-1),zz=cz+coord(2*(j+1)/N-1);
    const col=blend(floor,fog,M.clamp((dist(x,z)-1.7)/6,0,1));
    const vs=[[x,z],[xx,z],[xx,zz],[x,zz]].map(([a,b])=>[a,elevation(a,b),b]);quad(...vs,col);
   }
  }
 }
 // Ripple strokes follow the winding stream or pond; no particles or animated textures.
 if(cfg.water)for(let k=0;k<95;k++){
  let z,x;
  if(cfg.water==='stream'){z=cz+(rnd()-.5)*S*6;x=riverX(z)+(rnd()-.5)*riverW(z)*1.65;}
  else{x=pondCenter[0]+(rnd()-.5)*S*1.3;z=pondCenter[1]+(rnd()-.5)*S*.9;if(!wet(x,z))continue;}
  const l=2+rnd()*6;quad([x-l,Y-.77,z],[x+l,Y-.77,z],[x+l,Y-.77,z+.23],[x-l,Y-.77,z+.23],blend(rgb('#adc5b7'),floor,.4));
 }
 // Ground-cover is a patch mosaic with gaps, not a regular perimeter necklace.
 const clusters=cfg.feature==='zen'?8:cfg.feature==='summit'?12:26;
 for(let k=0;k<clusters;k++){
  const a=rnd()*TAU,rad=S*(.12+rnd()*.9),x=cx+Math.cos(a)*(W/2+rad),z=cz+Math.sin(a)*(D/2+rad);
  for(let j=0;j<4+rnd()*5;j++){
   const xx=x+(rnd()-.5)*S*.42,zz=z+(rnd()-.5)*S*.42;if(quiet(xx,zz,16)||wet(xx,zz))continue;
   const near=dist(xx,zz)<1.05;plant(xx,zz,(near?5:8)+rnd()*(near?6:13));
  }
  if(!wet(x,z)&&!quiet(x,z,18))rock(x,z,5+rnd()*12,.65+rnd()*.5);
 }
 // Fine texture and contact mottling connect the pedestal without covering its silhouette.
 for(let k=0;k<(high?175:low?60:100);k++){
  const x=cx+(rnd()-.5)*S*4.8,z=cz+(rnd()-.5)*S*4.8;if(quiet(x,z,1)||wet(x,z))continue;
  const y=ground(x,z),s=.7+rnd()*2.7;
  const col=blend(floor,leafC,.2+rnd()*.3);
  if(high)ell(x,y+.15,z,s,.25,s*.7,col,G.TWO);
  else quad([x-s,y+.25,z],[x,y+.25,z-s*.7],[x+s,y+.25,z],[x,y+.25,z+s*.7],col,G.TWO);
 }
 for(let k=0;k<18;k++){
  const a=rnd()*TAU,x=cx+Math.cos(a)*(W*.58+5),z=cz+Math.sin(a)*(D*.58+5);if(quiet(x,z,0))continue;
  rock(x,z,2+rnd()*4,.55);
 }
 // Stream banks carry small, irregular moss stones and fern colonies on both sides.
 if(cfg.water==='stream'){log(cx-S*.45,D+S*.7,S*.45,.12,8);}
 if(cfg.water==='stream')for(let k=0;k<46;k++){
  const z=cz+(rnd()-.5)*S*5.5,sign=k%2?1:-1,x=riverX(z)+sign*(riverW(z)+5+rnd()*13);
  if(!quiet(x,z,12)){rock(x,z,4+rnd()*10,.7);if(k%3===0)plant(x+sign*9,z+5,12+rnd()*8,'fern');}
 }
 // Water habitats have their own bank ecology rather than sharing a generic rock ring.
 if(['pond','oasis'].includes(cfg.water))for(let k=0;k<(cfg.water==='pond'?17:6);k++){
  const a=rnd()*TAU,t=.3+rnd()*.55,x=pondCenter[0]+Math.cos(a)*S*.7*t,z=pondCenter[1]+Math.sin(a)*S*.53*t,sz=4+rnd()*5;
  G.disc(mb,[x,Y-.66,z],[sz,0,0],[0,0,sz*.8],UP,blend(leafC,rgb('#93b889'),.35),G.TWO,9,0);
  if(k%4===0)ell(x,Y+.5,z,2.2,1.7,2.1,rgb('#e5c8d7'),0);
 }
 // Signature ground composition.
 if(['woodland','logs','hollow','twilight','moon','firefly','jungle'].includes(cfg.feature)){
  const count=cfg.feature==='logs'?5:2;
  for(let k=0;k<count;k++){const a=1+k*2.7+cfg.seed*.1,x=cx+Math.cos(a)*S*1.2,z=cz+Math.sin(a)*S*1.2;log(x,z,S*(.3+rnd()*.3),a+.8,7+rnd()*5);}
 }
 if(cfg.feature==='zen'){
  // Curved raked gravel, sparse stones and off-centre stepping path.
  for(let k=0;k<25;k++){const rad=S*(.85+k*.045);for(let j=0;j<64;j++){
   const a=j*TAU/64,b=(j+1)*TAU/64,pts=[[cx+Math.cos(a)*rad,cz+Math.sin(a)*rad],[cx+Math.cos(b)*rad,cz+Math.sin(b)*rad],[cx+Math.cos(b)*(rad+.55),cz+Math.sin(b)*(rad+.55)],[cx+Math.cos(a)*(rad+.55),cz+Math.sin(a)*(rad+.55)]];
   quad(...pts.map(([x,z])=>[x,elevation(x,z)+.22,z]),blend(floor,stone,.38));
  }}
  for(let k=0;k<7;k++)rock(cx-S*.95-k*12,cz+S*.5+Math.sin(k*.6)*18,10,.24);
 }
 if(cfg.feature==='temple'){
  for(let k=0;k<9;k++){const x=cx+S*.9+k*8,z=cz+S*.45-k*11;ell(x,ground(x,z)+1,z,12,2.4,8,stone);}
 }
 if(cfg.feature==='autumn'||cfg.feature==='cherry')for(let k=0;k<110;k++){const a=rnd()*TAU,rr=S*(.7+rnd()*1.7);plant(cx+Math.cos(a)*rr,cz+Math.sin(a)*rr,9,cfg.feature==='cherry'?'petal':'leaf');}
 // Distant 3D groups surround all quadrants, irregularly spaced with generous openings.
 // Every group shares bounded draw and fade state. No whole-scene opacity changes.
 function group(x,z,radius,height,fn){
  const keep=mb;mb=new G.MB({height:height,baseY:ground(x,z)});fn();
  const haze=M.clamp((dist(x,z)-.65)*.24,0,.48);
  for(let i=0;i<mb.v.length;i+=G.STRIDE)for(const off of [9,12])for(let c=0;c<3;c++)mb.v[i+off+c]=mb.v[i+off+c]*(1-haze)+fog[c]*haze;
  const bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
  for(let i=0;i<mb.v.length;i+=G.STRIDE)for(let axis=0;axis<3;axis++){bounds[0][axis]=Math.min(bounds[0][axis],mb.v[i+axis]);bounds[1][axis]=Math.max(bounds[1][axis],mb.v[i+axis]);}
  const mesh=upload(p,mb);
  groups.push({mesh,bounds,x,z,radius,height,y:ground(x,z),opacity:1,visible:true});mb=keep;
 }
 function tree(x,z,height,radius,type){
  const y=ground(x,z),lean=(rnd()-.5)*height*.17;
  if(type==='snow'){
   tube([[x,y,z],[x,y+height,z]],radius*.7,.7,bark);
   for(let tier=0;tier<5;tier++){
    const yy=y+height*(.3+tier*.14),rr=height*(.3-tier*.043);
    G.tube(mb,[[x,yy,z],[x,yy+height*.28,z]],rr,.1,blend(leafC,rgb('#587e77'),.4),floor,0,9,true,0);
    G.tube(mb,[[x,yy+height*.06,z],[x,yy+height*.29,z]],rr*.86,.1,rgb('#e4eeee'),stone,0,9,true,0);
   }return;
  }

  tube([[x,y,z],[x+lean*.6,y+height*.55,z],[x+lean,y+height,z]],radius,radius*.48);
  for(let k=0;k<4;k++){const a=k*1.6+rnd();tube([[x,y+radius,z],[x+Math.cos(a)*radius*2,y+1,z+Math.sin(a)*radius*2]],radius*.55,.2);}
  if(type==='mangrove')for(let k=0;k<5;k++){const a=k*TAU/5;tube([[x,y+height*.35,z],[x+Math.cos(a)*radius*2,y+height*.12,z+Math.sin(a)*radius*2],[x+Math.cos(a)*radius*4,y,z+Math.sin(a)*radius*4]],radius*.32,.6);}
  if(type==='jungle'||type==='canopy')for(let k=0;k<3;k++){
   const a=k*2.2,xx=x+Math.cos(a)*height*.2,zz=z+Math.sin(a)*height*.2;
   tube([[xx,y+height*.8,zz],[xx+7,y+height*.42,zz-3],[xx+2,y+5,zz]],1.1,.5,blend(leafC,bark,.35));
  }
  const crown=type==='cherry'?rgb('#e5bacd'):type==='autumn'?rgb(pick(['#cda14f','#c48742','#deb359'])):type==='snow'?rgb('#8fa8a5'):leafC;
  for(let k=0;k<5;k++){const a=k*2.4,xx=x+lean+Math.cos(a)*height*.16,zz=z+Math.sin(a)*height*.16,yy=y+height*(.7+rnd()*.28);tube([[x+lean*.6,y+height*.62,z],[xx,yy,zz]],radius*.4,.6);ell(xx,yy,zz,height*.25,height*.16,height*.24,crown,G.PAT.moss);if(type==='snow')ell(xx,yy+height*.07,zz,height*.24,height*.075,height*.23,rgb('#e3eded'),0);}
 }
 const treeTypes=['woodland','willow','mangrove','canopy','autumn','jungle','sunset','cherry','twilight','moon','firefly','snow'];
 let count=treeTypes.includes(cfg.feature)?(cfg.feature==='jungle'?11:8):cfg.feature==='bamboo'?9:6;
 if(cfg.feature==='meadow'||cfg.feature==='dunes'||cfg.feature==='zen')count=3;
 for(let k=0;k<count;k++){
  const a=TAU*(k+.15+rnd()*.6)/count+cfg.seed*.07,rad=S*(1.35+rnd()*1.1),x=cx+Math.cos(a)*rad,z=cz+Math.sin(a)*rad;
  let height=S*(.42+rnd()*.35),radius=7+rnd()*8;
  if(cfg.feature==='canopy'||cfg.feature==='jungle')height*=1.25;
  if(treeTypes.includes(cfg.feature))group(x,z,height*.42,height*1.2,()=>tree(x,z,height,radius,cfg.feature));
  else if(cfg.feature==='bamboo')group(x,z,S*.24,S*.94,()=>{
   for(let j=0;j<4;j++){const xx=x+(rnd()-.5)*S*.22,zz=z+(rnd()-.5)*S*.22,hh=S*(.5+rnd()*.4),yy=ground(xx,zz);tube([[xx,yy,zz],[xx+4,yy+hh,zz]],2.3,1.5,blend(leafC,stone,.25));for(let n=1;n<7;n++){ell(xx+n*.5,yy+n*hh/7,zz,2.7,.8,2.7,blend(leafC,floor,.4));leaf([xx+n*.5,yy+n*hh/7,zz],[xx+17,yy+n*hh/7+6,zz+10],3);}}
  });
  else if(['hollow','logs'].includes(cfg.feature))group(x,z,S*.26,S*.35,()=>{log(x,z,S*.5,a,17);for(let j=0;j<5;j++)plant(x+(rnd()-.5)*50,z+(rnd()-.5)*50,16,'mushroom');});
  else if(['summit','highland','canyon','basalt','grotto','crystals','falls','temple'].includes(cfg.feature)){
   const high=cfg.feature==='canyon'?2:cfg.feature==='summit'?2.4:1.4;
   group(x,z,S*.35,S*.7,()=>{
    if(cfg.feature==='temple'){
     for(let j=0;j<3;j++)tube([[x+j*18,ground(x,z),z],[x+j*18,ground(x,z)+S*.4-(j===1?15:0),z]],7,6,stone);
     tube([[x-10,ground(x,z)+S*.4,z],[x+45,ground(x,z)+S*.4,z]],8,8,stone);plant(x,z,27,'fern');
    }else{for(let j=0;j<3;j++)rock(x+(rnd()-.5)*S*.25,z+(rnd()-.5)*S*.2,S*(.12+rnd()*.13),high,blend(stone,fog,.12));if(cfg.feature==='crystals')for(let j=0;j<7;j++)plant(x+(rnd()-.5)*60,z+(rnd()-.5)*60,35,'crystal');}
   });
  }else if(cfg.feature==='zen')group(x,z,S*.2,S*.3,()=>{rock(x,z,S*.14,1.4);plant(x+18,z,16,'grass');});
 }
 if(cfg.feature==='hollow'){
  const x=cx-S*.6,z=cz+S*.65,y=ground(x,z),rad=S*.2,hh=S*.43;
  group(x,z,rad*1.35,hh*1.2,()=>{
   // One curved, thick bark shell with a visible inner surface and broken rim;
   // not an array of vertical posts. A low front doorway opens into the hollow.
   const seg=56,rows=6,at=(a,t,inside)=>{
    const rr=rad*(inside?.77:1)*(1+.07*Math.sin(a*3)+.04*Math.cos(a*7));
    const height=hh*(.91+.07*Math.sin(a*4)+.04*Math.sin(a*9));
    return[x+Math.cos(a)*rr*(1-t*.1),y+t*height,z+Math.sin(a)*rr*(1-t*.1)];
   };
   const emit=(a,t,inside)=>{const n=[Math.cos(a)*(inside?-1:1),.05,Math.sin(a)*(inside?-1:1)];return vertex(at(a,t,inside),inside?blend(bark,floor,.5):blend(bark,stone,.08+.05*Math.sin(a*11)),G.PAT.grain,n);};
   for(let j=0;j<seg;j++){
    const a=j*TAU/seg,b=(j+1)*TAU/seg,door=Math.sin((a+b)/2)<-.72;
    for(let k=0;k<rows;k++){
     if(door&&k<4)continue;
     const t=k/rows,u=(k+1)/rows;
     mb.quad(emit(a,t,false),emit(b,t,false),emit(b,u,false),emit(a,u,false));
     mb.quad(emit(b,t,true),emit(a,t,true),emit(a,u,true),emit(b,u,true));
     if(door&&k===4)quad(at(a,t,false),at(b,t,false),at(b,t,true),at(a,t,true),bark);
    }
    quad(at(a,1,false),at(b,1,false),at(b,1,true),at(a,1,true),blend(bark,stone,.35));
   }
   for(let k=0;k<5;k++){const a=k*TAU/5;tube([[x+Math.cos(a)*rad*.8,y+8,z+Math.sin(a)*rad*.8],[x+Math.cos(a)*rad*1.4,y,z+Math.sin(a)*rad*1.4]],6,.4);}
   for(let k=0;k<8;k++)plant(x+(rnd()-.5)*rad*2,z+(rnd()-.5)*rad*2,12,'mushroom');
  });
 }
 // A lower, asymmetric rear grove gives the normal view visible crowns and
 // middle-distance depth, while the outer groves support side/rear exploration.
 if(treeTypes.includes(cfg.feature)){
  const spots=[[-.18,.62,.34],[.2,.92,.44],[1.16,.53,.38]];
  for(const [xx,zz,hh] of spots){const x=W*xx+(rnd()-.5)*12,z=D+S*zz,height=S*hh;
   if(!wet(x,z))group(x,z,height*.44,height*1.2,()=>tree(x,z,height,4+rnd()*2,cfg.feature));
  }
 }
 if(cfg.feature==='bamboo')for(const [xx,zz,hh] of [[-.12,.48,.35],[.28,.75,.42],[1.12,.57,.38]]){
  const x=W*xx,z=D+S*zz,height=S*hh;
  group(x,z,S*.13,height*1.1,()=>{
   for(let j=0;j<4;j++){const px=x+(rnd()-.5)*S*.18,pz=z+(rnd()-.5)*S*.12,y=ground(px,pz),h=height*(.7+rnd()*.3);
    tube([[px,y,pz],[px+3,y+h,pz]],1.9,1.2,blend(leafC,stone,.2));
    for(let k=1;k<6;k++){const yy=y+k*h/6;ell(px+k*.4,yy,pz,2.2,.65,2.2,blend(leafC,floor,.35));for(const sign of [-1,1])leaf([px,yy,pz],[px+sign*(10+rnd()*8),yy+5,pz+4],2.6);}
   }
  });
 }
 if(cfg.feature==='temple'){
  const x=W*.76,z=D+S*.48,y=ground(x,z);
  group(x,z,42,S*.36,()=>{
   for(let k=0;k<2;k++)tube([[x+k*34,y,z],[x+k*34,y+S*(k?.25:.29),z]],7,6,stone);
   tube([[x-9,y+S*.29,z],[x+17,y+S*.28,z]],7.5,7,stone);
   tube([[x+25,y+S*.24,z],[x+43,y+S*.25,z]],6,7,stone);
   for(let k=0;k<6;k++)rock(x-15+k*12,z-13,7,.45);
   plant(x-9,z+2,20,'fern');plant(x+30,z+5,16,'fern');
  });
 }
 // Waterfall: modelled cascade and plunge pool offset to the side, not behind the habitat.
 if(cfg.feature==='falls'){
  const x=pondCenter[0]-S*.2,z=pondCenter[1]-S*.2,y=ground(x,z);
  group(x,z,S*.36,S*.85,()=>{
   rock(x-27,z+5,22,2.8);rock(x+28,z+4,23,3);rock(x,z+23,33,4.5);
   for(let k=0;k<7;k++){const xx=x-13+k*4,top=y+S*.42;quad([xx,top,z-8],[xx+3,top-3,z-8],[xx+5,Y-.7,z-18],[xx+1,Y-.7,z-18],blend(rgb('#b9d4d0'),rgb('#6bafba'),k%3*.18));}
  });
 }
 // Quiet glints are small static emissive meshes, not excessive particle systems.
 if(cfg.feature==='firefly')for(let k=0;k<35;k++){
  const a=rnd()*TAU,rr=S*(1.1+rnd()*1.4),x=cx+Math.cos(a)*rr,z=cz+Math.sin(a)*rr;
  ell(x,ground(x,z)+4+rnd()*24,z,.8,.8,.8,rgb('#c1d989'),G.GLOW||16);
 }
 const shoreline=J.Shoreline?J.Shoreline.append(h,base,cfg):null;
 for(let i=0;i<base.v.length;i+=G.STRIDE){const d=dist(base.v[i],base.v[i+2]),haze=M.clamp((d-.55)*.15,0,.36);for(const off of [9,12]){const l=.30*base.v[i+off]+.59*base.v[i+off+1]+.11*base.v[i+off+2];for(let c=0;c<3;c++)base.v[i+off+c]=(base.v[i+off+c]*(1-haze*.35)+l*haze*.35)*(1-haze)+fog[c]*haze;}}
 const mesh=upload(p,base);mesh.shoreline=shoreline;mesh.world={id,groups,W,D,S,cx,cz,version:'3.0',quality,water:cfg.water||null,feature:cfg.feature};
 // Cached habitat owns ALL buffers; the renderer's existing cache disposal deletes these.
 for(const g of groups)mesh.del.push(...g.mesh.del);
 mesh.worldStats={vertices:base.n+groups.reduce((s,g)=>s+g.mesh.n+(g.mesh.parts||[]).reduce((a,m)=>a+m.n,0),0),triangles:base.i.length/3+groups.reduce((s,g)=>s+g.mesh.idx.length/3+(g.mesh.parts||[]).reduce((a,m)=>a+m.idx.length/3,0),0),groups:groups.length};
 return mesh;
}
// Atmosphere is a seamless, low-frequency distant wash. Real meshes supply middle depth.
// No painted trunk band or repeated opaque silhouette wall at any orbit angle.
P.bgTexture=function(id){
 id=id||'mossy';this.bgT=this.bgT||{};if(this.bgT[id])return this.bgT[id];
 const B=J.BACKGROUNDS[id]||J.BACKGROUNDS.mossy,cfg=plans[id]||plans.mossy;
 const far=document.createElement('canvas');far.width=1024;far.height=512;const c=far.getContext('2d');
 const grad=c.createLinearGradient(0,0,0,512);grad.addColorStop(0,B.sky[0]);grad.addColorStop(.48,B.sky[1]);grad.addColorStop(1,cfg.floor);c.fillStyle=grad;c.fillRect(0,0,1024,512);
 for(let layer=0;layer<3;layer++){
  c.fillStyle='rgba('+rgb(cfg.floor).map(v=>Math.round(v*255)).join(',')+','+(.11+layer*.06)+')';c.beginPath();c.moveTo(0,512);
  for(let x=0;x<=1024;x+=8){const a=x/1024*TAU;const mountain=['summit','highland','canyon'].includes(cfg.feature);c.lineTo(x,310+layer*48+Math.sin(a*3+cfg.seed)* (mountain?47:13)+Math.sin(a*7+layer)* (mountain?19:7));}c.lineTo(1024,512);c.fill();
 }
 const mid=document.createElement('canvas');mid.width=2;mid.height=2;
 const tex=canvas=>{const t=this.texFrom(canvas,false),gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);return t;};
 return this.bgT[id]={far:tex(far),mid:tex(mid),B,world:true};
};
P.buildGroundAnchor=function(h){return build(this,h);};
// Fade state is advanced BEFORE deciding whether static geometry can be cached.
// Returning to the existing cache as soon as it settles avoids a permanent redraw cost.
const cacheMode=P.cacheMode;
P.cacheMode=function(V,hab,hg,...args){
 const w=hg.groundAnchor&&hg.groundAnchor.world;
 if(w){
  const pose=[V.yaw,V.pitch,V.s,V.cx,V.cy,...V.c,this.R.cv.width,this.R.cv.height].join(',');
  if(w.pose===pose&&!w.fading)return cacheMode.call(this,V,hab,hg,...args);
  w.pose=pose;
  const points=[],top=Math.min(hab.dims.h*1.1,Math.max(hab.dims.h*.6,...Object.values(hab.geoms||{}).map(g=>g.baseY+g.height)));
  for(const x of [0,w.W])for(const z of [0,w.D])for(const y of [-12,top])points.push(V.P([x,y,z]));
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  const centerDepth=V.depth([w.cx,0,w.cz]),now=performance.now(),dt=Math.min(.25,(now-(w.lastTime||now-16))/1000);let moving=false;
  for(const g of w.groups){
   // Exact geometry AABB, projected conservatively at all 8 corners. No distance
   // cutoff: zooming out or panning immediately brings clusters back.
   let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
   for(const x of [g.bounds[0][0],g.bounds[1][0]])for(const y of [g.bounds[0][1],g.bounds[1][1]])for(const z of [g.bounds[0][2],g.bounds[1][2]]){
    const q=V.P([x,y,z]);left=Math.min(left,q[0]);right=Math.max(right,q[0]);top=Math.min(top,q[1]);bottom=Math.max(bottom,q[1]);
   }
   g.visible=right>=-12&&left<=this.R.cv.width+12&&bottom>=-12&&top<=this.R.cv.height+12;
   const q=V.P([g.x,g.y+g.height*.5,g.z]),sx=g.radius*V.s,sy=(g.height*.5*Math.cos(V.pitch)+g.radius*Math.sin(V.pitch))*V.s;
   const overlap=q[0]+sx>minX-10&&q[0]-sx<maxX+10&&q[1]+sy>minY-10&&q[1]-sy<maxY+10;
   // Test the cluster's ground position against the habitat's ground centre.
   // Height/radius-expanded depth incorrectly classified the rear waterfall cliff
   // as foreground and erased its landmark even though it was behind the tank.
   const front=V.depth([g.x,0,g.z])<centerDepth-g.radius*.15;
   const target=overlap&&front?.06:1;
   if(!w.lastTime)g.opacity=target;
   else g.opacity+=(target-g.opacity)*(1-Math.exp(-dt*11));
   if(Math.abs(target-g.opacity)<.002)g.opacity=target;else moving=true;
   g.target=target;
  }
  w.lastTime=now;w.fading=moving;
  if(moving){if(this._cache)this._cache.key=null;return 'direct';}
 }
 return cacheMode.call(this,V,hab,hg,...args);
};
const draw=P.drawMesh;
P.drawMesh=function(program,mesh){
 const drawParts=m=>{draw.call(this,program,m);for(const part of m.parts||[])draw.call(this,program,part);};
 if(!mesh.world)return drawParts(mesh);
 drawParts(mesh);
 // Called by the statics pass with depth writes and premultiplied blending on.
 // Avoid synchronous driver state queries twice per scene draw.
 const gl=this.gl,mask=true;
 gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 for(const g of mesh.world.groups){if(g.visible===false)continue;gl.uniform1f(program.u.uAlpha,g.opacity);gl.depthMask(g.opacity>.98&&mask);drawParts(g.mesh);}
 gl.uniform1f(program.u.uAlpha,1);gl.depthMask(mask);
};
// Leave a deliberate environment margin at the normal observer framing. Follow mode
// retains the original inhabitant-focused rig and all orbit/zoom/pan gestures are kept.
const targetView=J.Renderer.prototype.targetView;
J.Renderer.prototype.targetView=function(h){const v=targetView.call(this,h);if(this.cam.mode!=='follow'){v.s*=.77;v.offY*=.77;}return v;};
J.MiniatureWorlds={version:'3.0',plans,build,cosmeticOnly:true};
})(typeof window!=='undefined'?window:globalThis);
