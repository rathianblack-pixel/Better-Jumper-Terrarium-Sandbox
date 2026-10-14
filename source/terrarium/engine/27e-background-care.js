/* Lazy background care. No inactive requestAnimationFrame loops, path stepping, hunts or collision replays.
   Seconds are GAME seconds (480 = one day). Wall-clock absence is mapped 1:1 and capped to three days.
   Existing meals/molts complete; food/hydration have gentle away-only floors, never unseen deaths. */
(function(root){
 'use strict'; const J=root.JT,A=J.SpiderAI,M=J.M;
 const EPS=.001,MAX_TRANSITIONS=14;
 const unsettled=new Set(['notice','assess','stalk','creep','crouch','track','peek','pounce','fall','patrol','scan','lunge','explore','flee','avoid','search','investigate','curious','fingerWatch','drinkSeek','baskSeek','homeSeek','sleepSeek','nectarSeek','sip','dangle']);
 function remaining(s,dur){return Math.max(EPS,dur-(s.st||0)+EPS);}
 function cleanPlans(h,s){
  s._route=s._air=s._plan=s._glance=s._attention=s._hang=s._dangleOff=s._dodge=null;
  s._seen={};s._moving=false;s._vel=[0,0,0];s._ip=s._if=null;s._thinkT=0;
  if(s.sup.k==='air'||!J.Nav.validSup(h,s.sup)){const b=J.Nav.supportBelow(h,s.pos);s.pos=b.pos;s.sup=b.sup;}
  if(unsettled.has(s.state)){s.target=null;A.setState(s,'idle','Settled back into the tank while you were away.');}
 }
 function settleMoltSite(h,s){
  if(A.nestOf(h,s)||A.nestSiteOK(h,s.sup,s.pos,A.nestLength(s,'molt')))return true;
  const spot=A.nearestNestSite(h,s,'molt'); // At most once per molt, never once per elapsed second.
  if(!spot||!spot.node||!A.nestSiteOK(h,spot.node.sup,spot.node.pos,A.nestLength(s,'molt')))return false;
  s.pos=spot.node.pos.slice();s.sup=J.deepClone(spot.node.sup);return true;
 }
 function advanceSpider(h,s,dt,base,report){
  let left=dt,offset=0,turns=0; const oldStage=s.stage,oldMeals=s.catches||0;
  const satFloor=Math.min(Number.isFinite(s.sat)?s.sat:.5,.12),hydFloor=Math.min(Number.isFinite(s.hyd)?s.hyd:1,.25);
  s.ageDays=s.ageDays||0;s.hyd=Number.isFinite(s.hyd)?s.hyd:1;s.st=s.st||0;
  cleanPlans(h,s);
  // An existing held meal has priority. We do not manufacture catches or eat unowned live prey.
  if(s.hold&&h.preyById(s.hold)&&!['feed','subdue','secure','carry'].includes(s.state))A.startFeed(h,s);
  while(left>EPS&&turns++<MAX_TRANSITIONS){
   h.data.simTime=base+offset;
   if(!s.hold&&A.moltReady(s)&&!A.MOLT.has(s.state)&&s.state!=='emerge'){
    if(settleMoltSite(h,s)){s.retreat={d:s.sup.d||null,pos:s.pos.slice()};A.setState(s,'moltSilk','Preparing a roomy molting hammock.');}
   }
   let state=s.state,span=left,apply=null;
   if(['subdue','secure','carry'].includes(state)){
    if(!s.hold||!h.preyById(s.hold)){s.hold=null;A.setState(s,'idle');continue;}
    const dur=state==='subdue'?(s._subdueDur||4):state==='secure'?(s._secDur||3):8;
    span=Math.min(left,remaining(s,dur));apply=()=>{if(s.st>=dur)A.startFeed(h,s);};
   }else if(state==='feed'){
    const p=h.preyById(s.hold);
    if(!p){s.hold=null;delete s.feedProgress;A.setState(s,'idle');continue;}
    if(!(s._feedDur>0)){const fp=s.feedProgress,d=J.PREY_BY_ID[p.type]||{};s._feedDur=fp&&fp.dur>0?fp.dur:6+(d.nut||.5)*28;s._feedNut=fp&&Number.isFinite(fp.nut)?fp.nut:p.type==='jumperMeal'?.25+(p.len||5)*.05:A.nutOf(d);s.feedProgress={dur:s._feedDur,nut:s._feedNut};}
    span=Math.min(left,remaining(s,s._feedDur));apply=step=>{s._chewPause=0;s._shield=null;A.H.feed(h,s,step);};
   }else if(state==='moltSeek'){
    span=Math.min(left,remaining(s,8));apply=()=>{if(s.st>=8&&settleMoltSite(h,s)){s.retreat={d:s.sup.d||null,pos:s.pos.slice()};A.setState(s,'moltSilk');}};
   }else if(state==='moltSilk'){
    if(!settleMoltSite(h,s)){ // Preserve premolt rather than placing a sac inside solid geometry.
     s.thought='Pre-molt — needs a clear, roomy floor or solid perch for its hammock.';
    }else{
     A.H.moltSilk(h,s,0);if(s.state!==state)continue;
     const n=A.nestOf(h,s),dur=n&&n.build?Math.max(EPS,n.build.dur-n.build.t+EPS):remaining(s,16);
     span=Math.min(left,dur);apply=()=>{if(n&&n.build){const b=n.build;b.t+=span;n.prog=b.from+(1-b.from)*Math.min(1,b.t/b.dur);if(b.t>=b.dur){n.prog=1;n.build=null;}}A.H.moltSilk(h,s,0);};
    }
   }else if(state==='premolt'||state==='molting'){
    span=Math.min(left,remaining(s,state==='premolt'?28:11));apply=()=>A.H[state](h,s,0);
   }else if(state==='postMolt'){
    span=Math.min(left,Math.max(EPS,s.soft||0));apply=()=>A.H.postMolt(h,s,0);
   }else if(state==='emerge'){
    const nest=A.nestOf(h,s),hole=nest&&nest.hole;
    const dur=hole?Math.max(Math.max(0,.6-s.st)+(1-(hole.open||0))*1.4,Math.max(0,2.2-s.st))+(1-(hole.exit||0))*1.2+EPS:EPS;
    span=Math.min(left,Math.max(EPS,dur));apply=step=>A.H.emerge(h,s,step);
   }else if(state==='postFeed'){
    span=Math.min(left,remaining(s,6+s.traits.patience*8));apply=()=>A.H.postFeed(h,s,0);
   }
   // Event-boundary integration: no large dt is ever passed to locomotion or decision AI.
   A.advanceNeeds(h,s,span);s.sat=Math.max(satFloor,s.sat);s.hyd=Math.max(hydFloor,s.hyd);
   s.st+=span;offset+=span;left-=span;h.data.simTime=base+offset;
   if(apply)apply(span);
   if(s.hold){const p=h.preyById(s.hold);if(p){p.pos=A.mouth(h,s);p.sup=J.deepClone(s.sup);}}
   // A blocked molt search must not spin the event loop.
   if(s.state===state&&state==='moltSeek'&&s.st>=8){if(left>EPS){A.advanceNeeds(h,s,left);s.sat=Math.max(satFloor,s.sat);s.hyd=Math.max(hydFloor,s.hyd);offset+=left;left=0;}break;}
  }
  if(left>0){A.advanceNeeds(h,s,left);s.sat=Math.max(satFloor,s.sat);s.hyd=Math.max(hydFloor,s.hyd);}
  cleanPlans(h,s);s._bodySat=s.sat;
  if(s.stage>oldStage)report.molts.push(s);
  if((s.catches||0)>oldMeals)report.meals.push([s,s.catches-oldMeals]);
  if(s.sat<.35&&!(s.soft>0)&&!A.MOLT.has(s.state))report.hungry.push(s);
 }
 J.Background={maxElapsed:J.DAY*3,maxTransitions:MAX_TRANSITIONS,advance(h,dt){
  dt=M.clamp(Number.isFinite(dt)?dt:0,0,this.maxElapsed);
  const report={elapsed:dt,meals:[],molts:[],hungry:[]};if(!(dt>0))return report;
  const d=h.data,base=h.time,end=base+dt;
  // Age saved environment once, before any new remains/silk are created by completed activities.
  const dry=.0012*((1.2-(J.SUBSTRATES[d.substrate]||{}).moist)||.5);
  d.humidity=Math.max(.15,d.humidity-dt*dry);if(J.Biome)J.Biome.climate(h,dt);
  d.drops=d.drops.filter(w=>{w.life-=dt*(1.4-d.humidity);return w.life>0;});
  for(const line of d.silk)line.age+=dt;d.silk=d.silk.filter(x=>x.age<(x.kind==='retreat'?1800:600));
  h.updateRemains(dt);
  const crew=Math.min(6,d.prey.filter(p=>!p.owner&&!p.dead&&A.isCleanupCrew(p)).length);
  if(crew){for(const r of d.remains)r.clean-=dt*crew*.0003*(.5+d.humidity);d.remains=d.remains.filter(r=>r.clean>0);}
  for(const n of d.nests||[])if(!n.owner)n.age=(n.age||0)+dt;
  d.nests=(d.nests||[]).filter(n=>n.owner||(n.age||0)<1800);
  for(const p of d.prey)if(p.weak){p.weak.t-=dt;if(p.weak.t<=0){p.weak=null;p._flip=0;if(p.state==='twitch'){p.state='idle';p.st=0;}}}
  for(const s of d.spiders)advanceSpider(h,s,dt,base,report);
  d.simTime=end;d.age=(d.age||0)+dt/J.DAY;
  // Expire old weather rather than replaying missed rain/hatches and flooding the tank with particles/prey.
  const w=d.bev;if(w){w.left=Math.max(0,(w.left||0)-dt);w.until=end+w.left;if(w.left<=0){w.phase='gap';w.id='clear';w.left=30;w.until=end+30;w.next=w.until;}}
  h._vibrations=[];h._leaves=[];h.validateRefs();
  return report;
 }};
})(window);
