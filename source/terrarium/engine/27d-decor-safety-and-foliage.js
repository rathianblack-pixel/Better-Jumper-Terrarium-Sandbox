/* Geometry-matched retreat clearance and bounded cosmetic GPU foliage motion. */
(function(root){
 'use strict';const J=root.JT,M=J.M,G=J.G,N=J.Nav,A=J.SpiderAI,U=J.UI;
 J.Foliage={prepare(R,h,list){
  const setting=R.set.foliageSway||'auto',quality=R.set.quality==='auto'?R.quality:R.set.quality;
  const mq=R._foliageMotionQuery||(R._foliageMotionQuery=root.matchMedia?root.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false});
  let cap=mq.matches||setting==='off'?0:setting==='on'?(quality==='low'?2:6):(quality==='low'||R.set.fps==='saver'?0:quality==='medium'?4:6);
  const now=performance.now(),V=R.V;
  if(setting==='auto'&&cap){
   if(R.frameMs>26){R._windSlowAt=R._windSlowAt||now;if(now-R._windSlowAt>2500)R._windRestUntil=now+15000;}else R._windSlowAt=0;
   if(V){const prev=R._windCamera||(R._windCamera=[V.yaw,V.pitch,V.s,...V.c]);const moving=Math.abs(prev[0]-V.yaw)>.035||Math.abs(prev[1]-V.pitch)>.025||Math.abs(prev[2]-V.s)>V.s*.025||Math.hypot(prev[3]-V.c[0],prev[4]-V.c[1],prev[5]-V.c[2])>1.2;if(moving)R._windCameraRest=now+450;prev[0]=V.yaw;prev[1]=V.pitch;prev[2]=V.s;for(let i=0;i<3;i++)prev[i+3]=V.c[i];}
   if(now<(R._windRestUntil||0)||now<(R._windCameraRest||0))cap=0;
  }
  for(const o of list)o._wind=null;
  if(!cap){R._foliageMoving=0;return;}
  const choices=list.filter(o=>o.m.wind).sort((a,b)=>M.dist(a.g.center||[a.inst.x,0,a.inst.z],R.V.c)-M.dist(b.g.center||[b.inst.x,0,b.inst.z],R.V.c)||String(a.inst.id).localeCompare(String(b.inst.id))).slice(0,cap);
  const t=h.time,breeze=.7*Math.sin(t*.62)+.24*Math.sin(t*1.08+.8);
  for(const o of choices){
   // One shared breeze with a small spatial delay, not unrelated leaf wiggles.
   const phase=(o.inst.x||0)*.018+(o.inst.z||0)*.013;let amp=.58;if(h.spiders.some(s=>s.sup&&s.sup.d===o.inst.id))amp*=.25;
   const wind=o._windBuf||(o._windBuf=[0,0,0]);wind[0]=amp*(breeze+.13*Math.sin(t*.9+phase));wind[2]=amp*(.45*Math.sin(t*.62+.65)+.10*Math.sin(t*.85+phase));o._wind=wind;
  }
  R._foliageMoving=choices.length;
 }};
 // Test the space occupied by the whole sac/body, including overhead hard geometry.
 const nestOK=A.nestSiteOK;
 A.nestSiteOK=function(h,sup,pos,L){
  if(!nestOK.apply(this,arguments))return false;const r=A.nestRoom(L),ceiling=pos[1]+L*.8+.6;
  for(const g of Object.values(h.geoms))for(const pr of g.prims){
   if(pr.t==='prism'&&pr.y1>pos[1]+.3&&pr.y0<ceiling){const poly=G.hull(pr.poly.concat(pr.topPoly||[]));if(G.pointInPoly(pos[0],pos[2],poly))return false;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],v=[b[0]-a[0],b[1]-a[1]],q=M.clamp(((pos[0]-a[0])*v[0]+(pos[2]-a[1])*v[1])/(v[0]*v[0]+v[1]*v[1]||1),0,1);if(Math.hypot(pos[0]-a[0]-v[0]*q,pos[2]-a[1]-v[1]*q)<r)return false;}}
   if(pr.t==='tube'&&!['blade','stem','vine'].includes(pr.style))for(let i=0;i<pr.pts.length-1;i++){const a=pr.pts[i],b=pr.pts[i+1],rad=Math.max(pr.r0,pr.r1);if(Math.max(a[1],b[1])+rad<pos[1]+.3||Math.min(a[1],b[1])-rad>ceiling)continue;const d=M.sub(b,a),v=M.sub([pos[0],pos[1]+L*.35,pos[2]],a),q=M.clamp(M.dot(v,d)/(M.dot(d,d)||1),0,1),p=M.lerp3(a,b,q);if(Math.hypot(p[0]-pos[0],p[2]-pos[2])<r+rad)return false;}
  }
  return true;
 };
 // Failed routes must never end by building inside a forbidden surface.
 const molt=A.H.moltSilk;
 A.H.moltSilk=function(h,s,dt){if(!A.nestOf(h,s)&&!A.nestSiteOK(h,s.sup,s.pos,A.nestLength(s,'molt'))){const spot=A.nearestNestSite(h,s,'molt');if(spot&&spot.route){s._route=spot.route;s._routeStart=h.time;s.retreat={d:spot.node.decor||null,pos:spot.node.pos.slice()};s._moltReplans=0;A.setState(s,'moltSeek','Finding enough clear space for the larger post-molt body.');}else{s._route=null;s.thought='Pre-molt — needs a clear, roomy floor or solid perch for its hammock.';}return;}return molt(h,s,dt);};
 // Keep old saved/occupied silk sacs on the same corrected exterior support, without resetting molt progress.
 const nests=A.updateNests;A.updateNests=function(h,dt){for(const n of h.data.nests||[]){const s=n.owner&&h.spider(n.owner);if(s&&s.nest===n.id&&A.NEST_STATES.has(s.state)&&N.validSup(h,s.sup)){n.sup=J.deepClone(s.sup);n.pos=N.supPos(h,s.sup,s.pos);n.len=Math.max(n.len||0,A.len(s));}}return nests(h,dt);};
})(window);
