/* Jumper Terrarium v14 — biome visual and microclimate extension. */
(function(root){
 'use strict';
 const JT=root.JT, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const wx=h=>{const w=h.data.bev||h.data.wx;return w&&w.id||'clear';};
 const oldSky=JT.SKY.update;
 JT.SKY.update=function(game){
  const sky=oldSky.call(this,game),h=game&&game.hab,bm=JT.Biome&&h?JT.Biome.of(h):null;
  const tint=bm&&bm.tint||[1,1,1],dark=bm&&bm.dusk||0;
  if(game){const st=game._biomeGrade||(game._biomeGrade=[1,1,1,0]);for(let i=0;i<3;i++)st[i]+=(tint[i]-st[i])*0.04;st[3]+=(dark-st[3])*0.04;const moon=JT.SKY.at(0,{});for(let i=0;i<3;i++){sky.grade[i]=(sky.grade[i]*(1-st[3])+moon.grade[i]*st[3])*st[i];sky.amb[i]=sky.amb[i]*(1-st[3])+moon.amb[i]*st[3];sky.key[i]=sky.key[i]*(1-st[3])+moon.key[i]*st[3];}
   // v19: overcast light during rain / storms, following the same fade as the rain itself
   const WF=JT.app&&JT.app.R&&JT.app.R._wxF;if(WF&&WF.hab===h){const ez=x=>x*x*(3-2*x),r=ez(Math.min(1,(WF.f.rain||0)+(WF.f.storm||0))),sm=ez(WF.f.storm||0),d=0.13*r+0.15*sm;game._wxDim=d;
    if(d>0.001){const gm=(sky.grade[0]+sky.grade[1]+sky.grade[2])/3,cool=[0.96,1,1.05];for(let i=0;i<3;i++){sky.grade[i]=(sky.grade[i]*(1-d*0.6)+gm*d*0.6)*(1-d*0.55)*(1+(cool[i]-1)*d*2.2);sky.key[i]*=1-d*1.3;sky.amb[i]*=1-d*0.25;}}}else game._wxDim=0;
   const vo=Math.round(game._wxDim*1.6*100)/100;if(vo!==game._wxVo){game._wxVo=vo;const ve=root.document&&root.document.getElementById('wxVeil');if(ve)ve.style.opacity=vo;}}
  return sky;
 };
 const RP=JT.Renderer.prototype;
 RP.drawBiome=function(ctx,V,hab,dt,night,bm){
  if(!bm||bm.id==='classic'){if(this._wxF)this._wxF.hab=null;return;}
  if(!this._bmPool){this._bmPool=new Float32Array(140*7);let s=384701;for(let i=0;i<this._bmPool.length;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;this._bmPool[i]=s/4294967296;}}
  const photo=JT.UI&&JT.UI.photo,frozen=photo||root.document&&root.document.hidden;
  if(this._bmHab!==hab){this._bmHab=hab;this._bmTime=hab.time;}
  const fdt=frozen?0:Math.min(0.1,Math.max(0,dt));this._bmTime+=fdt;
  const t=this._bmTime,w=wx(hab),dm=hab.dims,pool=this._bmPool;
  // v19: weather fades in and out (visual only: the simulation still switches at once). Snaps on tank switch / first frame.
  const WF=this._wxF||(this._wxF={hab:null,f:{},rainY:0,dustX:0});const KEYS=['rain','storm','heat','wind','mist','fireflies','glow'];
  if(WF.hab!==hab){WF.hab=hab;for(const k of KEYS)WF.f[k]=k===w?1:0;WF.wet=w==='storm'?1:w==='rain'?0.8:0;}
  else if(fdt>0){const rm=JT.UI&&JT.UI.reducedMotion?JT.UI.reducedMotion():(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
   for(const k of KEYS){const on=k===w,cur=WF.f[k]||0;const secs=rm?1.5:on?(k==='storm'?6:8):10;WF.f[k]=on?Math.min(1,cur+fdt/secs):Math.max(0,cur-fdt/secs);}}
  const F=WF.f,ease=x=>x*x*(3-2*x);
  {const tw=Math.min(1,(F.rain||0)*0.8+(F.storm||0));WF.wet=WF.wet||0;if(tw>WF.wet)WF.wet=Math.min(tw,WF.wet+fdt/7);else WF.wet=Math.max(0,WF.wet-fdt/90);} // v19: ground soaks in ~7 s, dries over ~90 s
  const quality=this.set.quality==='auto'?(this._autoLow?'low':'medium'):this.set.quality;
  const q=quality==='low'?0.4:quality==='high'?1.5:1;
  const point=(x,y,z)=>V.P([x,y,z]);
  const circle=(p,r,col,a)=>{if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))return;ctx.globalAlpha=a;ctx.fillStyle=col;ctx.beginPath();ctx.arc(p[0],p[1],Math.max(0.7,r),0,Math.PI*2);ctx.fill();};
  const rA=ease(Math.min(1,(F.rain||0)+(F.storm||0))),sMix=(F.storm||0)/Math.max(1e-6,(F.rain||0)+(F.storm||0));
  WF.rainY+=fdt*(50+30*sMix);if(WF.rainY>1e6)WF.rainY-=1e6;
  const mistBase=bm.id==='cloudforest'?0.025:bm.id==='rainforest'?0.012:0,mistA=mistBase+(0.025-mistBase)*ease(F.mist||0),mist=mistA>0.0005;
  ctx.save();
  if(rA>0.003){ctx.strokeStyle=sMix>0.5?'#cee5f8':'#bddcec';ctx.lineWidth=Math.max(0.6,this.k*0.65);ctx.globalAlpha=(0.28+0.14*sMix)*(0.35+0.65*rA);ctx.beginPath();const count=Math.min(140,Math.round((46+34*sMix)*q*rA));for(let i=0;i<count;i++){const a=i*7,x=pool[a]*dm.w,z=pool[a+1]*dm.d,y=((pool[a+2]*dm.h-WF.rainY)%dm.h+dm.h)%dm.h;const p=point(x,y,z),e=point(x-0.9,Math.max(0,y-4-pool[a+3]*6),z);ctx.moveTo(p[0],p[1]);ctx.lineTo(e[0],e[1]);}ctx.stroke();}
  if(mist){ctx.fillStyle=bm.id==='cloudforest'?'#d7e3e8':'#bed6c8';const count=Math.round(12*q);for(let i=0;i<count;i++){const a=i*7,x=(pool[a]*dm.w+t*(0.5+pool[a+1]))%dm.w,z=pool[a+2]*dm.d;const p=point(x,1+pool[a+3]*4,z);ctx.globalAlpha=mistA*(0.6+Math.sin(t*0.15+i)*0.3);ctx.beginPath();ctx.ellipse(p[0],p[1],(12+pool[a+4]*22)*V.s,Math.max(2,(2+pool[a+5]*3)*V.s),-0.07,0,Math.PI*2);ctx.fill();}}
  const dustHome=bm.id==='desert'||bm.id==='heath',wA=ease(F.wind||0),dA=dustHome?1:wA;WF.dustX+=fdt*(1.5+4.5*wA);if(WF.dustX>1e6)WF.dustX-=1e6;
  if(dA>0.003){const count=Math.round(22*q*(dustHome?1:dA));for(let i=0;i<count;i++){const a=i*7,p=point(((pool[a]*dm.w+WF.dustX)%dm.w+dm.w)%dm.w,2+pool[a+1]*dm.h*0.7,pool[a+2]*dm.d);circle(p,(0.35+pool[a+3]*0.45)*V.s,'#d7c098',(0.2+pool[a+4]*0.18)*(dustHome?1:0.4+0.6*dA));}if((F.heat||0)>0.003){ctx.strokeStyle='#f5d7a1';ctx.lineWidth=Math.max(0.5,this.k*0.5);ctx.globalAlpha=0.13*ease(F.heat);for(let k=0;k<Math.round(8*q);k++){ctx.beginPath();for(let j=0;j<18;j++){const x=dm.w*j/17,z=dm.d*(k+1)/9,p=point(x,1.5+Math.sin(j*0.8+t*2+k)*0.7,z);if(!j)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);}ctx.stroke();}}}
  if(bm.id==='paludarium'){const ponds=JT.Biome.ponds?JT.Biome.ponds(hab):[];ctx.strokeStyle='#b4dfe4';ctx.lineWidth=Math.max(0.5,this.k*0.7);for(const inst of ponds){const g=hab.geoms[inst.id];if(!g)continue;const center=g.center||[inst.x,0,inst.z],p=point(center[0],g.baseY+1,center[2]);for(let k=0;k<3;k++){const phase=(t*0.18+k/3)%1;ctx.globalAlpha=(1-phase)*0.28;ctx.beginPath();ctx.ellipse(p[0],p[1],Math.max(1,(3+phase*7)*V.s),Math.max(0.5,(1.3+phase*3)*V.s*0.6),0,0,Math.PI*2);ctx.stroke();}}}
  const ffA=ease(Math.min(1,(F.fireflies||0)+(F.glow||0))),ffBase=bm.id==='nightmoss'?10:0;
  if(ffBase||ffA>0.003){const count=Math.round((ffBase+(38-ffBase)*ffA)*q);for(let i=0;i<count;i++){const a=i*7,x=(pool[a]*dm.w+Math.sin(t*0.23+i)*8+dm.w)%dm.w,y=4+pool[a+1]*dm.h*0.5+Math.sin(t*0.7+i)*2,z=(pool[a+2]*dm.d+Math.cos(t*0.2+i)*6+dm.d)%dm.d,p=point(x,y,z),a0=(0.3+Math.pow((Math.sin(t*2+pool[a+4]*15)+1)*0.5,3)*0.7)*(0.4+night*0.6)*(i<ffBase?1:ffA);circle(p,2.8*this.k,'#b9ef85',a0*0.06);circle(p,1.35*this.k,'#b9ef85',a0*0.25);circle(p,0.6*this.k,'#e9ffd0',a0);}}
  if(bm.id==='antkingdom'){const ants=hab._antPatrol||(hab._antPatrol={count:quality==='low'?4:9});for(let i=0;i<ants.count;i++){const a=i*7,x=(pool[a]*dm.w+t*2.5)%dm.w,z=dm.d*(0.25+0.25*Math.sin(x/dm.w*6.2))+i*0.8,p=point(x,0.8+(JT.Terrain?JT.Terrain.lift(hab,x,z,0):0),z);circle(p,0.55*this.k,'#35251b',0.75);circle([p[0]-1.1*this.k,p[1]],0.48*this.k,'#35251b',0.75);}}
  if(bm.id==='urban'){const daylight=hab.daylight(),phase=hab.game&&hab.game.tod?hab.game.tod():t/600%1;if(daylight>0.25){const x=dm.w*(0.15+0.7*phase),p=point(x,0.4,dm.d*0.52);ctx.globalAlpha=daylight*0.085;ctx.fillStyle='#ffdc9f';ctx.beginPath();ctx.ellipse(p[0],p[1],dm.w*0.22*V.s,dm.d*0.16*V.s,0,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
 };
 if(JT.Biome){
  const B=JT.Biome;
  B.seekMicroLegacy=function(h,sp){
   const id=B.id(h);if(id==='classic'||!h.nav||!sp.sup||sp.sup.k==='air'||sp.target||sp.hyd<0.45||sp.sat<0.2||(sp._microAt||0)>h.time||JT.R()>0.16)return false;
   sp._microAt=h.time+18;const wet=sp.hyd<0.75,weather=wx(h),temp=B.temp(h),wantShade=weather==='storm'||temp>32&&B.homeOf(sp.species)!=='desert';
   const wantsWarm=weather==='heat'&&!wantShade||id==='heath'&&sp.species==='peacock'||id==='urban';
   const dj=JT.Nav.dijkstra(h,sp.sup,sp.pos,JT.SpiderAI.caps(sp));let best=null,score=0.12;
   for(let k=0;k<Math.min(40,h.nav.nodes.length);k++){const n=h.nav.nodes[Math.floor(JT.R()*h.nav.nodes.length)];if(!n||n.kind==='face'||!Number.isFinite(dj.dist[n.id])||dj.dist[n.id]>100)continue;const d=n.sup&&n.sup.id?h.geoms[n.sup.id]:null,cover=JT.Nav.coverAt(h,n.pos);let value=wantShade?cover*2:0.3*cover;if(wet&&B.nearWater&&B.nearWater(h,n.pos,28))value+=1.4;if(wantsWarm&&n.kind==='top'&&d&&d.def&&(d.def.arche==='rock'||d.def.arche==='slab'))value+=1.5;if(id==='urban'){const phase=h.game&&h.game.tod?h.game.tod():0.5;value+=Math.max(0,1-Math.abs(n.pos[0]-h.dims.w*(0.15+0.7*phase))/(h.dims.w*0.3));}value-=dj.dist[n.id]*0.012;if(value>score){score=value;best=n;}}
   if(!best||JT.M.dist(sp.pos,best.pos)<5)return false;const r=JT.Nav.buildRoute(h,dj,best.sup,best.pos);if(!r)return false;
   sp._route=r;sp._routeStart=h.time;sp._lookout=false;sp.state='explore';sp.st=0;sp.thought=wet?'Seeking a damp corner.':wantShade?'Moving into the shelter of the leaves.':wantsWarm?'Heading for a warm, sunny perch.':'Exploring a comfortable part of the habitat.';return true;
  };
  const oldTick=B.tick;
  B.tick=function(h,dt){oldTick.call(B,h,dt);if(B.id(h)==='classic'||!(dt>0))return;h._bmExtra=(h._bmExtra||0)+dt;if(h._bmExtra<2)return;h._bmExtra=0;const w=wx(h);if(w==='wind'){for(const inst of h.decor){const d=JT.DECOR_BY_ID[inst.type];if(d&&(d.arche==='grass'||d.arche==='flower')){const sw=inst._sw||(inst._sw={x:0,z:0,vx:0,vz:0});sw.vx+=0.8;sw.vz+=0.25;}}if(B.id(h)==='prairie')for(const p of h.prey){if(p.state==='idle'&&JT.R()<0.4){p.st=0;p.dur=0;p._goal=null;}}}for(const sp of h.spiders)if(sp.sup&&sp.sup.k==='face'&&B.id(h)==='oldbark'&&B.homeOf(sp.species)==='oldbark'&&JT.R()<0.035&&!sp.target)sp.thought='Blending into the old bark, waiting for movement.';};
 }
})(typeof window!=='undefined'?window:globalThis);