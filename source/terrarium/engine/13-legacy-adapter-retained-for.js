/* Legacy adapter retained for old standalone builds; the integrated v14 engine owns these hooks. */
(function(root){
 if (root.JT.Biome && root.JT.Biome.ensure) return;
 'use strict';const J=root.JT,B=J.Biome,WX=J.WEATHER,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sid=s=>typeof s==='string'?s:s&&s.species;
 J.SUBSTRATES.dune=Object.assign({},J.SUBSTRATES.desert,{name:'Raked Dune Sand',moist:0.06});J.SUBSTRATES.mud=Object.assign({},J.SUBSTRATES.peat,{name:'Wet Mud',moist:0.95});
 J.BACKGROUNDS.dunes=Object.assign({},J.BACKGROUNDS.twilight,{name:'Desert Dunes',sky:['#dfa760','#e5c18b','#dcc8a1'],blobs:['#af8051','#c4945f','#ddb886','#947556'],light:'#ffe3a5'});
 J.BACKGROUNDS.mangrove=Object.assign({},J.BACKGROUNDS.misty,{name:'Mangrove Roots',sky:['#456e64','#699b87','#a4b8a0'],blobs:['#345549','#587465','#74948a','#a3b7a0']});
 J.BACKGROUNDS.moonwood=Object.assign({},J.BACKGROUNDS.twilight,{name:'Moonlit Moss Forest',sky:['#171b33','#273148','#475365'],blobs:['#253b35','#354958','#536579','#31483d'],light:'#b8d5ed',shafts:0.15});
 const targets={rainforest:0.85,desert:0.22,paludarium:0.92,nightmoss:0.80};
 const grades={rainforest:[0.96,1.02,0.95],desert:[1.07,1,0.88],paludarium:[0.94,1,1.03],nightmoss:[0.8,0.86,1.06],antkingdom:[1.01,1.02,0.94],heath:[1.04,1.02,0.95],oldbark:[0.99,1,0.95],urban:[1.03,1.02,1],prairie:[1.01,1.04,0.96],cloudforest:[0.94,1.01,1.05]};
 for(const id of J.BIOME_ORDER){const b=J.BIOMES[id];b.tint=grades[id]||[1,1,1];b.dusk=id==='nightmoss'?0.62:0;}
 const primary={rainforest:['jungle','canopy'],desert:['dune','dunes'],paludarium:['mud','mangrove'],nightmoss:['black','moonwood']};
 for(const id of J.BIOME_ORDER){const b=J.BIOMES[id];b.blurb=b.desc;b.native=J.DECOR.filter(d=>d.biomes&&d.biomes.includes(id)).map(d=>d.id);b.homes=J.SPECIES.filter(s=>B.homeOf(s.id)===id).map(s=>s.id);b.theme=b.themes[0];b.themeTall=b.themes.find(t=>/wall|vertical/.test(t))||'rootwall';b.targetHumidity=targets[id]||(b.hum[0]+b.hum[1])/2;b.gap=[150,310];if(primary[id]){b.sub=primary[id][0];b.bg=primary[id][1];}}
 Object.assign(WX.rain,{dur:[50,75],mist:18,dt:-2});Object.assign(WX.heat,{dur:[60,90],dt:4,day:true});
 WX.hatch={name:'Evening hatch',line:'Tiny flies rise from the water',dh:0,dt:0,dur:[45,70]};WX.fireflies=Object.assign({},WX.glow,{name:'Firefly swarm',line:'Moths drift toward the glow',dur:[60,90],night:false,prey:'moth'});
 J.BIOMES.paludarium.wx.hatch=4;J.BIOMES.nightmoss.wx.fireflies=4;delete J.BIOMES.nightmoss.wx.glow;
 J.BIOME_EVENTS=WX;for(const id of J.BIOME_ORDER)J.BIOMES[id].events=Object.keys(J.BIOMES[id].wx);
 const entries=[['rainDrink','Rainwater Sip','A jumper drank rainwater.','Watch a jumper drink during rain.'],['heatBask','Sun-warmed Perch','A jumper basked on a warm rock.','Watch a native desert jumper rest on a rock during heat.'],['edgeHunt','Shoreline Hunter','A jumper caught prey by a pond.','Watch a hunt near a paludarium pond.'],['glowHunt','Glow Hunter','A jumper hunted in the Night Moss Forest.','Watch a successful hunt in Night Moss Forest.'],['fireflyWatch','Watching the Lights','A jumper watched a firefly swarm.','Watch a jumper on lookout during fireflies.'],['settledIn','Settled In','A jumper spent a day in its home climate.','Keep a native jumper at home for one in-game day.'],['biomeTour','Biome Explorer','All four original biomes are on the tank shelf.','Keep Rainforest, Desert, Paludarium and Night Moss tanks.']];
 const allowed=new Set(entries.map(x=>x[0]));J.JOURNAL=J.JOURNAL.filter(e=>!J.JOURNAL_META[e.id]||J.JOURNAL_META[e.id][0]!=='biome'||allowed.has(e.id));for(const[id,title,text,hint]of entries){if(!J.JOURNAL.some(e=>e.id===id))J.JOURNAL.push({id,title,text,icon:'🌿'});J.JOURNAL_META[id]=['biome',hint];}
 const oldJournal=B._journal;B._journal=function(h,id,sp){if(allowed.has(id))return oldJournal.call(B,h,id,sp);};
 B.comfortFor=function(b,s){b=B.id(b);s=sid(s);return b==='classic'?0.7:B.homeOf(s)===b?1:s==='bold'||B.secondOf(s)===b?0.75:0.45;};
 const oldLabel=B.label;B.label=function(h,s){const r=oldLabel.call(B,h,s),f=B.comfortFor(h,s);r.f=f;r.k=f>=0.95?'home':f>=0.6?'ok':'out';r.text=r.k==='home'?'At home here':r.k==='ok'?'Comfortable':'Out of place';return r;};
 B.speedK=function(h,s){if(B.id(h)==='classic')return 1;const c=B.comfortFor(h,s),native=c>=0.95;return(native?1.06:c<0.6?0.94:1)*(native&&B.id(h)==='desert'&&h.data.bev&&h.data.bev.id==='heat'?1.1:1);};
 B.tameK=function(h,s){if(B.id(h)==='classic')return 1;const c=B.comfortFor(h,s);return c>=0.95?1.25:c<0.6?0.85:1;};
 const oldSpeed=J.SpiderAI.speed;J.SpiderAI.speed=function(sp){return oldSpeed(sp)*(Number.isFinite(sp.biomeSpeed)?sp.biomeSpeed:1);};
 const oldState=B._state;B._state=function(h){const existing=!!(h.data.bev||h.data.wx),w=oldState.call(B,h);if(w&&!existing){const duration=70+B._r(h.data)*80;Object.assign(w,{id:'clear',phase:'gap',left:duration,duration,until:h.time+duration,next:h.time+duration,t0:h.time,lastMist:h.time});}return w;};
 const oldBegin=B._begin,oldStart=B.start;
 B._begin=function(h,id){const w=oldBegin.call(B,h,id);w.next=0;w.lastMist=h.time;if(id==='hatch')h.addPrey(B._r(h.data)<0.5?'mosquito':'gnat',2+(B._r(h.data)<0.5?1:0));h.event('biome',{ev:id});return w;};
 B.start=function(h,id){if(!h||B.id(h)==='classic'||!WX[id]||!B._allowed(h,id))return null;return oldStart.call(B,h,id);};
 B.climate=function(h,dt){if(!(dt>0)||B.id(h)==='classic')return;const target=B.of(h).targetHumidity;h.data.humidity=clamp(h.data.humidity+(target-h.data.humidity)*Math.min(1,dt*0.004),0.15,1);};
 B.tick=function(h,dt){if(!h||!(dt>0))return;const id=B.id(h),d=h.data;if(id==='classic'){for(const sp of h.spiders)sp.biomeSpeed=1;return;}const w=B._state(h);w.left-=dt;w.until=h.time+Math.max(0,w.left);if(w.left<=0){if(w.phase==='event'){const ev=w.id;B._gap(h);d.bev.next=d.bev.until;h.event('biome',{ev,end:true});}else if(B._allowed(h,w.nx)){B._begin(h,w.nx);}else{w.left=5;w.until=h.time+5;w.next=w.until;}}
  const active=d.bev;if(active.phase==='event'&&WX[active.id].mist){active.mistLeft-=dt;if(active.mistLeft<=0){B._wet(h);active.lastMist=h.time;active.mistLeft=WX[active.id].mist;}}
  h._biomeCheck=(h._biomeCheck||0)+dt;if(h._biomeCheck<2)return;const elapsed=h._biomeCheck;h._biomeCheck=0;const match=B.match(h);d.bmatch=match.score;
  for(const sp of h.spiders){sp.comfort=B.comfortFor(h,sp);sp.biomeSpeed=B.speedK(h,sp);sp.biomeTrust=B.tameK(h,sp);if(sp.comfort>=0.95){sp.homeT=(sp.homeT||0)+elapsed;if(sp.homeT>=J.DAY&&!sp.biomeSettled){sp.biomeSettled=true;h.event('journal',{id:'settledIn',sp});}}else if(sp.comfort<0.6&&sp.state==='idle'&&J.R()<0.06)sp.thought='Seems a little unsettled in this climate.';
   const geom=sp.sup&&sp.sup.id&&h.geoms[sp.sup.id];if(active.id==='heat'&&sp.state==='rest'&&sp.sup&&sp.sup.k==='top'&&geom&&['rock','slab'].includes(geom.def.arche))B._journal(h,'heatBask',sp);if(['fireflies','glow'].includes(active.id)&&['lookout','watch'].includes(sp.state))B._journal(h,'fireflyWatch',sp);
  }
 };
 const check=J.Game.prototype.checkUnlocks;J.Game.prototype.checkUnlocks=function(){const result=check.apply(this,arguments);if(!this.state.biomeTourDone&&['rainforest','desert','paludarium','nightmoss'].every(id=>this.habs.some(h=>B.id(h)===id))){this.state.biomeTourDone=true;this.hab.event('journal',{id:'biomeTour'});}return result;};
 const set=B.setBiome;B.setBiome=function(h,id){const b=set.call(B,h,id);if(b.id!=='classic')h.data.humidity=b.targetHumidity;for(const sp of h.spiders)sp.biomeSpeed=B.speedK(h,sp);return b;};
})(typeof window!=='undefined'?window:globalThis);