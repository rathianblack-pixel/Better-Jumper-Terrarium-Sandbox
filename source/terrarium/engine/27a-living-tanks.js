/* Living tanks: bounded sensory cues, remembered places, natural prey routines and tank controls.
   Simulation work is invoked only by the active habitat update. No timers run for inactive tanks. */
(function(root){
 'use strict';
 const J=root.JT,AI=J.SpiderAI,PA=J.PreyAI,M=J.M,N=J.Nav,U=J.UI,D=root.document;
 const grounded=s=>s&&s.k!=='air';
 const pct=v=>Math.round(M.clamp(v==null?1:v,0,1)*100);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function turn(sp,pos,k){const dir=M.norm([pos[0]-sp.pos[0],0,pos[2]-sp.pos[2]]);if(M.len(dir)<.01)return;const f=sp.fwd||[1,0,0],a=Math.atan2(f[2],f[0]),delta=M.wrapAngle(Math.atan2(dir[2],dir[0])-a),next=a+delta*k;sp.fwd=[Math.cos(next),0,Math.sin(next)];}
 // Peripheral motion attracts attention, but does not instantly identify a prey animal.
 AI.inspectCue=function(h,s,e,dot,motion){
   if(AI.isCleanupCrew(e))return dot>.55 && s.sat<AI.STARVING; // Deliberate emergency hunting remains possible.
   if(dot>.55){const cue=s._attention;if(cue&&cue.id===e.id&&h.time-cue.t<.35)return false;return true;}
   if(motion<.5)return false;
   if(s.target&&s.target.id!==e.id)return false;
   if((s._attentionLock||0)>h.time&&(!s._attention||s._attention.id!==e.id))return false;
   if((AI.PRI[s.state]||0)>=40)return false;
   if(!s._attention||s._attention.id!==e.id||h.time-s._attention.t>3)s._attention={id:e.id,t:h.time,pos:e.pos.slice()};
   s._attention.pos=e.pos.slice();s._glance={id:e.id,pos:e.pos.slice(),until:h.time+.8};s._attentionLock=h.time+1.8;s._glNext=Math.max(s._glNext||0,h.time+1.8);
   s.thought='Turning to inspect a movement.';turn(s,e.pos,.65);return false;
 };
 // Patience affects time spent waiting for a fast target to settle; urgency allows riskier windows.
 AI.strikeWindow=function(h,s,e){
   const speed=M.len(e._vel||[0,0,0]),flight=AI.pounceDur(M.dist(s.pos,e.pos));
   const drift=speed*flight,reach=AI.len(s)*(s.sat<.2?1.1:.55)+1;
   return drift<=reach && ((e.alert||0)<.9 || s.sat<.25 || AI.preyView(h,s,e).back);
 };
 function places(h,s){
   const m=s.mem||(s.mem={ignore:{},success:{}});const list=m.places||(m.places=[]);
   m.places=list.filter(p=>h.time-p.t<480*3&&N.validSup(h,p.sup)&&(!p.decor||h.decorById(p.decor))&&(!p.drop||h.data.drops.some(d=>d.id===p.drop)));
   return m.places;
 }
 function remember(h,s,kind,pos,sup,extra){
   if(!pos||!grounded(sup)||!N.validSup(h,sup))return;
   const a=places(h,s),existing=a.find(p=>p.kind===kind&&M.dist(p.pos,pos)<5);
   if(existing){existing.t=h.time;return;}
   a.push(Object.assign({kind,pos:pos.slice(),sup:J.deepClone(sup),t:h.time},extra||{}));
   if(a.length>10)a.sort((a,b)=>b.t-a.t).splice(10);
 }
 AI.placeBonus=function(h,s,pos,kind){return places(h,s).some(p=>p.kind===kind&&M.dist(p.pos,pos)<7)?6:0;};
 AI.waterKnown=function(h,s,src){
   if(AI.placeBonus(h,s,src.pos,'water'))return true;
   if(M.dist(s.pos,src.pos)>70+s.traits.tactics*35||!AI.canSee(h,s,src))return false;
   remember(h,s,'water',src.pos,src.sup,{drop:src.id,decor:src.decor});return true;
 };
 // Vibration travels on shared substrate/decor or a physically nearby silk connection, not through air.
 J.Senses={
   linked(h,a,b,pa,pb){
     if(!grounded(a)||!grounded(b))return false;
     if(a.k==='floor'&&b.k==='floor')return true;
     if(a.d&&a.d===b.d)return true;
     return h.data.silk.some(line=>line.a&&line.b&&((M.dist(line.a,pa)<5&&M.dist(line.b,pb)<5)||(M.dist(line.b,pa)<5&&M.dist(line.a,pb)<5)));
   },
   emit(h,p,strength,kind){
     if(!grounded(p.sup)||AI.isCleanupCrew(p))return; // Springtails/isopods cannot flood the shared cue queue.
     const q=h._vibrations||(h._vibrations=[]);while(q.length&&h.time-q[0].t>2)q.shift();
     q.push({seq:h._vibSeq=(h._vibSeq||0)+1,t:h.time,pos:p.pos.slice(),sup:J.deepClone(p.sup),strength,kind,source:p.id,cleanup:AI.isCleanupCrew(p)});if(q.length>12)q.shift();
   },
   sense(h,s){
     if((AI.PRI[s.state]||0)>=40||s._air||!grounded(s.sup)||s.target||(s._vibNext||0)>h.time||(s._attentionLock||0)>h.time||(s._glNext||0)>h.time)return;
     let best=null,score=0;const since=s._vibSeen||0;
     for(const q of h._vibrations||[]){
       if(q.seq<=since||h.time-q.t>2||q.cleanup)continue;
       const dist=M.dist(s.pos,q.pos),range=22+q.strength*32;
       if(dist>range||!this.linked(h,s.sup,q.sup,s.pos,q.pos))continue;
       const val=q.strength*(1-dist/range);if(val>score){best=q;score=val;}
     }
     s._vibSeen=h._vibSeq||0;
     if(!best||score<.12)return;
     // Coarse direction only; never inserts a target or a visual sighting.
     const pos=best.pos.map(v=>Math.round(v/8)*8);turn(s,pos,.35);
     s._vibNext=h.time+2.5+(s.seed%5)*.15;s._attentionLock=h.time+1.8;s._glNext=Math.max(s._glNext||0,h.time+1.8);
     s._glance={pos,until:h.time+1};s.thought='Felt a vibration — checking that direction.';
     s.stats.vibrations=(s.stats.vibrations||0)+1;
   }
 };
 const updateSpider=AI.update;
 AI.update=function(h,s,dt){
   s._senseT=(s._senseT||0)-dt;
   if(s._senseT<=0){s._senseT=.4+(s.seed%7)*.025;J.Senses.sense(h,s);}
   s._placeT=(s._placeT||0)-dt;
   if(s._placeT<=0){
     s._placeT=2+(s.seed%5)*.1;places(h,s);
     if(grounded(s.sup)&&s.pos[1]>8&&['lookout','rest','watch','patrol'].includes(s.state))remember(h,s,'perch',s.pos,s.sup,{decor:s.sup.d});
     if(s.retreat&&s.retreat.pos){const r=s.retreat.pos,sup=N.supportBelow(h,[r[0],r[1]+1,r[2]]).sup;remember(h,s,'retreat',r,sup,{decor:sup.d});}
     for(const w of h.data.drops)if(M.dist(s.pos,w.pos)<35&&AI.canSee(h,s,w))remember(h,s,'water',w.pos,w.sup,{drop:w.id,decor:w.decor});
   }
   return updateSpider.call(this,h,s,dt);
 };
 // Calm prey groom, sample foliage, or rest; routines abort immediately after a credible alarm.
 const idle=PA.H.idle;
 PA.H.idle=function(h,p,d,dt){
   if(grounded(p.sup)&&(p.alert||0)<.25&&!(p._spook&&p._spook.until>h.time)&&p.st>1&&!(p.ambientNext>h.time)){
     p.ambientNext=h.time+9+J.R()*16;
     if(J.R()<.6){
       const foliage=p.sup.d&&h.geoms[p.sup.d]&&h.geoms[p.sup.d].def.cat==='plants';
       p.state=d.fly?'groom':foliage&&(d.shape==='cricket'||d.shape==='locust')?'nibble':'rest';
       p.st=0;p.dur=1.5+J.R()*3;p._route=null;p.activity=p.state==='groom'?'Grooming wings and legs':p.state==='nibble'?'Sampling foliage':'Resting quietly';return;
     }
   }
   return idle(h,p,d,dt);
 };
 for(const state of ['groom','nibble','rest'])PA.H[state]=function(h,p,d,dt){
   if((p.alert||0)>.5){const hunter=h.spiders.find(s=>M.dist(s.pos,p.pos)<(d.sense||20));if(hunter){PA.escape(h,p,hunter,false);return;}p.state='idle';p.st=0;return;}
   if(state==='groom')p._groom=Math.sin(p.st*9);
   if(state==='nibble')p._nibble=Math.sin(p.st*7);
   if(p.st>p.dur){p.state='idle';p.st=0;p.dur=1+J.R()*2;p._groom=0;p._nibble=0;p.activity=null;}
 };
 const updatePrey=PA.update;
 PA.update=function(h,p,dt){
   const before=p.pos&&p.pos.slice(),air=p.sup&&p.sup.k==='air',state=p.state;
   updatePrey.call(this,h,p,dt);
   if(p.owner||p.buried||p.dead||!p.pos)return;
   if(air&&grounded(p.sup))J.Senses.emit(h,p,.8,'landing');
   else if(before&&grounded(p.sup)&&M.dist(before,p.pos)>dt*2&&!(p._vibAt>h.time)){
     p._vibAt=h.time+1.2;J.Senses.emit(h,p,state==='hop'?.9:.25,'footsteps');
   }
   // Bound stale escape routes instead of endlessly running into a wall.
   if(p.state==='flee'||p.state==='hop'){
     if(before&&M.dist(before,p.pos)<.01&&!p._air)p._escapeStuck=(p._escapeStuck||0)+dt;else p._escapeStuck=0;
     if(p._escapeStuck>2.5){p._route=null;p.state='idle';p.st=0;p.dur=.5;p._escapeStuck=0;p.alert=Math.max(p.alert||0,.5);}
   }
 };
 const escape=PA.escape;
 PA.escape=function(h,p,hunter,pounce,chained){
   p._groom=p._nibble=0;p.activity=null;
   const out=escape.call(this,h,p,hunter,pounce,chained);
   // A second close strike produces an immediate spring, not another long freeze.
   if(p.state==='freeze'&&p.lastEscape!=null&&h.time-p.lastEscape<8)p.dur=Math.min(p.dur,.12);
   p.lastEscape=h.time;return out;
 };
 AI.care=function(h,s){
   const molt=/^(premolt|moltSeek|moltSilk|molting)$/.test(s.state),soft=s.soft>0,concerns=[];
   if((s.hyd==null?1:s.hyd)<.4)concerns.push('Needs water — mist or offer reachable droplets.');
   if(s.sat<.35&&!molt&&!soft)concerns.push(h.livePreyCount()?'Hungry — suitable prey is available.':'Needs food — add suitable, small prey.');
   const routine=molt?'Premolt / molting — fasting is normal; leave undisturbed.':soft?'Recovering from molt — hungry; wait for the skin to harden before feeding.':concerns.length?'Care needed':'No urgent care concerns.';
   return {routine,concerns,fullness:pct(s.sat),hydration:pct(s.hyd),stage:J.STAGES[s.stage],molt:s.stage>=5?'Adult':molt?'In progress':Math.min(s.meals,AI.moltNeed(s))+'/'+AI.moltNeed(s)+' meals'};
 };
 AI.careHtml=function(h,s){const c=AI.care(h,s);return '<section class="living-care" aria-label="Care status"><div class="lc-meters"><span>Fullness <b>'+c.fullness+'%</b></span><span>Hydration <b>'+c.hydration+'%</b></span></div><div>'+esc(c.stage)+' · Molt: '+esc(c.molt)+'</div><p class="lc-routine">'+esc(c.routine)+'</p>'+c.concerns.map(t=>'<p class="lc-warn">'+esc(t)+'</p>').join('')+'</section>';};
 const line=AI.stateLine;AI.stateLine=function(h,s){if(s.soft>0)return 'Recovering from molt — hungry';return line(h,s);};
 // Persist the overview camera and jumper selection per tank. Switching cancels placement and exits observation.
 U.rememberTankView=function(){
   if(!this.game||!this.R||!this.hab)return;
   const c=this.R.cam;this.hab.data.view={mode:this.obs?this.obs.prevCam||'observer':c.mode,zoom:c.zoom,pan:c.pan.slice(),oy:c.oy||0,op:c.op||0};
   this.hab.data.selectedId=this.game.selectedId;
 };
 U.restoreTankView=function(){
   const v=this.hab.data.view;if(v&&Array.isArray(v.pan)&&Number.isFinite(v.zoom)){
     this.R.setMode(v.mode==='follow'?'observer':v.mode);Object.assign(this.R.cam,{zoom:M.clamp(v.zoom,.4,5),pan:v.pan.slice(),oy:v.oy||0,op:v.op||0});this.R.clampOrbit(this.hab);this.R.clampPan();
   }
   const id=this.hab.data.selectedId;if(this.hab.spider(id))this.game.selectedId=id;
 };
 const switchHab=U.switchHab;
 U.switchHab=function(i){
   if(i===this.game.state.active||!this.game.habs[i])return;
   if(J.Replay&&J.Replay.active)J.Replay.stop();
   this.rememberTankView();if(this.obs)this.toggleObserve(false);
   const out=switchHab.call(this,i);this.restoreTankView();this.game.selectedId=this.hab.spider(this.hab.data.selectedId)?this.hab.data.selectedId:(this.hab.spiders[0]||{}).id||null;
   this.R.fx=[];this.R.particles=[];this.R.hover=null;this.game.save();return out;
 };
 const init=U.init;U.init=function(){const out=init.apply(this,arguments);this.restoreTankView();return out;};
 const save=J.Game.prototype.save;J.Game.prototype.save=function(){if(!this._activating&&U.game===this&&U.hab===this.hab)U.rememberTankView();return save.apply(this,arguments);};
 const sheet=U.jumpersSheet;
 U.jumpersSheet=function(tab){
   const out=sheet.apply(this,arguments),body=D.querySelector('#modalBody>div');if(!body)return out;
   const row=D.createElement('div');row.className='living-actions';
   const button=(label,fn)=>{const b=D.createElement('button');b.className='modal-btn';b.textContent=label;b.onclick=fn;row.append(b);return b;};
   const create=button('＋ Create New Tank',()=>this.biomeWizard(false));create.id='createNewTank';create.classList.add('gold');create.disabled=this.game.habs.length>=30;create.title=create.disabled?'Tank limit reached. Delete a tank to create another.':'Choose tank type, unlocked jumper, and biome';
   button('Switch Tank',()=>this.tanksModal()).id='switchTank';
   const prev=this.game.habs.findIndex(h=>h.data.id===this.game.state.previousTankId);
   const back=button('Previous Tank',()=>{this.closeModal();this.switchHab(prev);});back.disabled=prev<0||prev===this.game.state.active;
   const count=D.createElement('span');count.className='living-count';count.textContent='Tanks: '+this.game.habs.length+'/30';row.append(count);body.prepend(row);
   if(create.disabled){const note=D.createElement('p');note.className='muted';note.textContent=create.title;row.after(note);}
   return out;
 };
 const css=D.createElement('style');css.textContent=`.living-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;position:sticky;top:0;z-index:3;background:#f6f3e9;padding:4px 0 12px;border-bottom:1px solid #c9c6b8;margin-bottom:10px}.living-actions button{min-height:44px;font-size:13px}.living-actions button:disabled{opacity:.48;cursor:not-allowed}.living-count{font-size:12px;color:#605f52;margin-left:auto}.living-care{font-size:12px;line-height:1.4;border-top:1px solid #c9c6b8;margin-top:8px;padding-top:8px}.lc-meters{display:flex;gap:16px;flex-wrap:wrap}.living-care p{margin:5px 0}.lc-routine{color:#53613d}.lc-warn{color:#815227}@media(max-width:560px){.living-actions{gap:5px}.living-actions button{padding:8px;font-size:12px}.living-count{width:100%;margin-left:0}}`;
 D.head.append(css);
})(window);
