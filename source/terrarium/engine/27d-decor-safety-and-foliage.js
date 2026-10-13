/* Geometry-matched retreat clearance and bounded cosmetic GPU foliage motion. */
(function(root){
 'use strict';const J=root.JT,M=J.M,G=J.G,N=J.Nav,A=J.SpiderAI,U=J.UI;
 J.Foliage={prepare(R,h,list){
  const setting=R.set.foliageSway||'auto',quality=R.set.quality==='auto'?R.quality:R.set.quality;let cap=setting==='off'?0:setting==='on'?(quality==='low'?2:6):(quality==='low'||R.set.fps==='saver'?0:quality==='medium'?4:6);
  const now=performance.now();if(setting==='auto'&&cap){if(R.frameMs>26){R._windSlowAt=R._windSlowAt||now;if(now-R._windSlowAt>2500)R._windRestUntil=now+15000;}else R._windSlowAt=0;if(now<(R._windRestUntil||0))cap=0;}
  const choices=list.filter(o=>o.m.wind).sort((a,b)=>M.dist(a.g.center||[a.inst.x,0,a.inst.z],R.V.c)-M.dist(b.g.center||[b.inst.x,0,b.inst.z],R.V.c)||String(a.inst.id).localeCompare(String(b.inst.id))).slice(0,cap),selected=new Set(choices);
  for(const o of list){o._wind=null;if(!selected.has(o))continue;const phase=(o.inst._windPhase==null?(o.inst._windPhase=(J.hashStr(o.inst.id+'leaf')%6283)/1000):o.inst._windPhase),t=h.time;let amp=.8;
   if(h.spiders.some(s=>s.sup&&s.sup.d===o.inst.id))amp*=.25;
   o._wind=[amp*(.7*Math.sin(t*.72+phase)+.3*Math.sin(t*1.13+phase*.7)),0,amp*.6*Math.sin(t*.64+phase*1.3)];
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
