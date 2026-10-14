const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
const BASE=process.env.GAME_URL||'http://localhost:8000',OUT=process.env.TEST_OUTPUT||path.join(__dirname,'fix-results');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/local/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const report={checks:[],errors:[],render:[]};
try{
const p=await b.newPage({viewport:{width:1100,height:760}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'||(m.type()==='warning'&&/INVALID_|feedback loop|framebuffer|unavailable/i.test(m.text())))report.errors.push(m.text())});
await p.goto(BASE+'/jumper.html?preview=1');await p.waitForFunction(()=>window.JT?.app);await p.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
const results=await p.evaluate(()=>{
 const J=JT,A=J.SpiderAI,g=J.app.game,checks=[];
 function ok(v,label){if(!v)throw Error(label);checks.push(label);}
 function fixture(stage=5){const h=new J.Habitat({type:'standard',simTime:g.state.time,backgroundAt:g.state.time,localTimeMode:'day'},g);h.rebuild();const s=h.addSpider('regal',{stage,sat:.8,meals:0});s.pos=[h.dims.w/2,0,h.dims.d/2];s.sup={k:'floor'};s.hyd=.9;s.state='idle';s.st=0;s.meals=0;return {h,s};}
 // Attention: springtails and isopods cannot emit vibration or cause incidental head turns.
 let {h,s}=fixture();g.habs=[h];g.state.active=0;const crew=h.addPrey('springtail',18).concat(h.addPrey('isopod',8));
 for(const c of crew){c.pos=[s.pos[0]+2,0,s.pos[2]];c.sup={k:'floor'};c._vel=[3,0,0];J.Senses.emit(h,c,.9,'hop');}
 ok((h._vibrations||[]).length===0,'Cleanup crew does not emit sensory queue noise');
 s.fwd=[0,0,1];const f=s.fwd.slice();A.update(h,s,.01);ok(!s._glance,'Cleanup crew produces no incidental awareness glance');
 ok(A.inspectCue(h,s,crew[0],-1,1)===false,'Cleanup crew cannot cause peripheral inspection');
 s.sat=.01;ok(A.inspectCue(h,s,crew[0],1,1)===true,'Starving jumper can deliberately see springtails ahead');
 s.sat=.8;s.state='idle';s._attentionLock=0;s._glNext=0;s._vibNext=0;
 const fly=h.addPrey('fruitfly',1)[0];fly.pos=[s.pos[0]+10,0,s.pos[2]];fly.sup={k:'floor'};J.Senses.emit(h,fly,.9,'landing');J.Senses.sense(h,s);ok((s.stats.vibrations||0)===1&&!s.target,'Meaningful vibration still turns without omniscient target');
 const facing=s.fwd.slice();fly.pos=[s.pos[0]-10,0,s.pos[2]];J.Senses.emit(h,fly,.9,'landing');J.Senses.sense(h,s);ok(JSON.stringify(s.fwd)===JSON.stringify(facing),'Vibration cooldown prevents rapid direction switching');
 s._vibNext=0;s._glNext=0;s._attentionLock=0;s._attention=null;
 const e={id:'focusA',type:'fruitfly',pos:[s.pos[0]+8,0,s.pos[2]]};const e2={id:'focusB',type:'gnat',pos:[s.pos[0]-8,0,s.pos[2]]};A.inspectCue(h,s,e,-.2,1);const face=s.fwd.slice();A.inspectCue(h,s,e2,-.2,1);ok(s._attention.id==='focusA'&&JSON.stringify(face)===JSON.stringify(s.fwd),'Peripheral focus holds one cue instead of thrashing');
 // Inactive tanks stay untouched during full AI ticks, then analytically catch up once.
 let a=fixture(),inactive=fixture();g.habs=[a.h,inactive.h];g.state.active=0;const t=inactive.h.time,oldSat=inactive.s.sat;let calls=0;inactive.h.update=()=>{calls++};
 const activeUpdate=a.h.update;a.h.update=()=>{};g.tick(240);ok(calls===0&&inactive.h.time===t&&inactive.s.sat===oldSat,'No continuous inactive-tank AI or clock updates');a.h.update=activeUpdate;
 const rep=g.activate(1);ok(inactive.h.time>=t+240&&inactive.s.sat<oldSat&&inactive.s.hyd<.9,'Revisit advances hunger hydration age and local clock');
 const after=JSON.stringify(inactive.h.data);ok(g.catchUp(inactive.h)===null&&JSON.stringify(inactive.h.data)===after,'Repeated catch-up at same timestamp is a no-op');
 // Held meal: partial feeding, completion, leftovers/counters, no duplicate nutrition.
 let meal=fixture();g.habs=[a.h,meal.h];g.state.active=0;const prey=meal.h.addPrey('fruitfly',1)[0];prey.owner=meal.s.id;meal.s.hold=prey.id;A.startFeed(meal.h,meal.s);const dur=meal.s._feedDur;meal.s.sat=.3;
 g.state.time+=dur/2;g.catchUp(meal.h);ok(meal.s.state==='feed'&&meal.s.hold===prey.id&&meal.s.sat>.3,'Partial absence advances an existing meal without finishing early');
 const beforeC=meal.s.catches;g.state.time+=dur;const fed=g.catchUp(meal.h);ok(!meal.s.hold&&meal.s.catches===beforeC+1&&meal.s.meals===1&&fed.meals.length===1&&!meal.h.preyById(prey.id),'Longer absence finishes one held meal with correct counters');
 const count=meal.s.catches;g.catchUp(meal.h);ok(meal.s.catches===count,'Finished meal is not duplicated on repeat catch-up');
 // Molt boundaries, hardening and saved-state continuation.
 let molt=fixture(2);g.habs=[a.h,molt.h];g.state.active=0;molt.s.state='premolt';molt.s.st=10;molt.s.meals=5;
 g.state.time+=10;g.catchUp(molt.h);ok(molt.s.state==='premolt'&&molt.s.stage===2,'Short absence does not prematurely finish premolt');
 g.state.time+=30;const molted=g.catchUp(molt.h);ok(molt.s.stage===3&&molt.s.state==='postMolt'&&molt.s.soft>0&&molted.molts.length===1,'Premolt completes once and preserves the hardening interval');
 g.state.time+=150;g.catchUp(molt.h);ok(molt.s.stage===3&&molt.s.soft===0&&molt.s.state!=='postMolt'&&molt.s.meals===0,'Sufficient absence finishes hardening without duplicate molt');
 let silk=fixture(2);g.habs=[a.h,silk.h];g.state.active=0;silk.s.state='moltSilk';silk.s.st=0;g.state.time+=200;g.catchUp(silk.h);ok(silk.s.stage===3&&silk.s.soft===0,'Retreat weaving premolt molt and hardening progress through bounded event transitions');
 let seeking=fixture(2);g.habs=[a.h,seeking.h];g.state.active=0;seeking.s.state='moltSeek';seeking.s.st=0;g.state.time+=200;g.catchUp(seeking.h);ok(seeking.s.stage===3,'Existing molt-site search settles on a safe site and finishes');
 // A partially opened doorway has its own remaining work, independent of the general state timer.
 let emerge=fixture(3);g.habs=[a.h,emerge.h];g.state.active=0;emerge.s.state='emerge';emerge.s.st=3.9;emerge.s.nest='partialNest';emerge.h.data.nests=[{id:'partialNest',owner:emerge.s.id,pos:emerge.s.pos.slice(),sup:{k:'floor'},fwd:[1,0,0],len:A.len(emerge.s),prog:1,age:0,hole:{side:1,open:1,exit:0}}];g.state.time+=30;g.catchUp(emerge.h);ok(emerge.s.state!=='emerge'&&!emerge.s.nest,'Partly completed emergence finishes during a long absence');
 let seekingSave=fixture(2);seekingSave.s.state='moltSeek';A.restore(seekingSave.h,seekingSave.s);ok(seekingSave.s.state==='moltSeek'&&seekingSave.s._moltReplans===0,'Save restore preserves molt-site-search intent with a safe replan');
 // Long gaps are bounded and gentle: no unseen hunts or deaths and no artificial inflation of low needs.
 let vacation=fixture();g.habs=[a.h,vacation.h];g.state.active=0;vacation.h.addPrey('aphid',4);const food=vacation.h.prey.length;vacation.h.data.drops=[{id:'old',pos:vacation.s.pos.slice(),sup:{k:'floor'},life:10}];const clock=vacation.h.time;
 g.state.time+=J.DAY*300;g.catchUp(vacation.h);ok(vacation.h.time===clock+J.DAY*3&&vacation.s.sat>=.12&&vacation.s.hyd>=.25&&vacation.h.spiders.length===1&&vacation.h.prey.length===food&&vacation.h.data.drops.length===0,'Long gap is capped to 3 days; needs have gentle floors; no unseen hunts/deaths; old droplets expire');
 vacation.s.sat=.01;vacation.s.hyd=.1;g.state.time+=10;g.catchUp(vacation.h);ok(vacation.s.sat===.01&&vacation.s.hyd===.1,'Away floors do not magically refill already-low needs');
 // Full shelf still updates only one habitat per tick.
 g.habs=[a.h];while(g.habs.length<30)g.habs.push(fixture().h);g.state.active=0;let activeCalls=0,backgroundCalls=0;for(const tank of g.habs)tank.update=()=>tank===g.hab?activeCalls++:backgroundCalls++;for(let i=0;i<20;i++)g.tick(.1);ok(activeCalls===20&&backgroundCalls===0,'Thirty tanks still run only one full simulation');
 // Save-load roundtrip restores fractional feeding duration/nutrition and wall-clock gap, with no double catch-up.
 let saved=fixture();g.habs=[saved.h];g.state.active=0;const foodP=saved.h.addPrey('fruitfly',1)[0];foodP.owner=saved.s.id;saved.s.hold=foodP.id;A.startFeed(saved.h,saved.s);saved.s._feedDur=40;saved.s._feedNut=.6;saved.s.feedProgress={dur:40,nut:.6};saved.s.st=12;saved.s.sat=.4;
 const raw=JSON.parse(g.serialize());raw.savedAt=Date.now()-5000;J.Store.set('jumperTerrarium.v14.save',JSON.stringify(raw));const restored=new J.Game();ok(restored.load(),'New save loads successfully');const rs=restored.hab.spiders[0];ok(rs.state==='feed'&&rs._feedDur===40&&rs._feedNut===.6&&rs.st>=17&&rs.st<18,'Saved feeding progress survives offline load without resetting duration');const rtime=restored.hab.time;restored.catchUp(restored.hab);ok(restored.hab.time===rtime,'Offline load is reconciled once');
 const legacy=JSON.parse(g.serialize());delete legacy.savedAt;delete legacy.habitats[0].backgroundAt;legacy.time+=10000;const sat=legacy.habitats[0].spiders[0].sat;J.Store.set('jumperTerrarium.v14.save',JSON.stringify(legacy));const old=new J.Game();ok(old.load()&&old.hab.spiders[0].sat===sat,'Legacy save migrates without retroactive absence punishment');
 // Backward wall clock is harmless.
 const future=JSON.parse(g.serialize());future.savedAt=Date.now()+100000;J.Store.set('jumperTerrarium.v14.save',JSON.stringify(future));const futureG=new J.Game();ok(futureG.load()&&futureG.state.time===future.time,'Backward wall-clock changes never create negative elapsed time');
 // Prepare a real visible scene: one large jumper and multiple kinds of critters, on clear substrate.
 J.game=g;let visible=fixture();g.habs=[visible.h];g.state.active=0;g.state.time=visible.h.time;g.selectedId=visible.s.id;visible.s.pos=[visible.h.dims.w*.5,0,visible.h.dims.d*.28];visible.s.stage=5;visible.s.state='idle';visible.s.meals=0;visible.s.sat=.8;visible.s.fwd=[1,0,0];visible.s._glance=null;
 ['springtail','isopod','aphid','fruitfly','gnat','cricket'].forEach((type,i)=>{const q=visible.h.addPrey(type,1)[0];q.pos=[visible.h.dims.w*(.18+i*.12),0,visible.h.dims.d*.55];q.sup={k:'floor'};q.owner=null;q.buried=false;q.dead=false;q.state='idle';});
 g.tick=()=>{};J.app.R.cam.mode='observer';J.app.R.cam.zoom=1.4;J.app.R.cam.pan=[0,0];J.app.R.cam.oy=0;J.app.R.cam.op=0;J.app.settings.blur='off';J.app.settings.foliageSway='off';J.app.settings.gpuCrit=true;J.app.R.resetView();return checks;
});report.checks.push(...results);
if(process.env.BEHAVIOR_ONLY==='1'){report.result='PASS';console.log('PASS:',report.checks.length,'final-engine behavior checks');return;}
// Grounded real-animal painters must complete without the silently swallowed HD-only exception.
const animalPaints=await p.evaluate(()=>{let a=JT.app,R=a.R,h=a.game.hab,V=R.updateView(h,0),out=[];const cv=document.createElement('canvas');cv.width=R.glc.width;cv.height=R.glc.height;const c=cv.getContext('2d',{willReadFrequently:true});for(const art of ['hd2d','storybook']){a.settings.art=art;JT.HD2D._was=art==='hd2d'?'hd':'off';const scene=R.collectScene(V,h,0);for(const it of scene.items){if(!it.p||it.inst||it.ln||it.silk||it.ghost)continue;c.clearRect(0,0,cv.width,cv.height);scene.run(it,c,V);const data=c.getImageData(0,0,cv.width,cv.height).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>100)opaque++;out.push({art,key:it.key,opaque});}}return out;});for(const paint of animalPaints)assert(paint.opaque>0,'Real animal painter produced no opaque body: '+JSON.stringify(paint));report.animalPaints=animalPaints;report.checks.push('Grounded jumper and six critter painters complete in both styles and paint opaque body pixels');
for(const art of ['hd2d','storybook','hd2d','storybook'])for(const quality of ['low','medium','high','auto']){
 const r=await p.evaluate(({art,quality})=>{const a=JT.app,R=a.R,gp=R.gp,gl=gp.gl;a.settings.art=art;a.settings.quality=quality;R.resize();R.resetCaches();while(gl.getError()!==gl.NO_ERROR){}R.render(0);R.render(0);R.render(0);return {art,quality,error:gl.getError(),frameErrors:R._glErr||0,hdBroken:!!gp._hdBroken,gpuOff:!!gp._gcOff,items:R.collectScene(R.V,a.game.hab,0).items.filter(x=>x.p&&!x.inst&&!x.silk&&!x.ln).length};},{art,quality});assert.equal(r.error,0,JSON.stringify(r));assert.equal(r.frameErrors,0);assert(!r.hdBroken);assert(r.items>=7);report.render.push(r);
}
// GPU and CPU sprite-atlas paths, both art styles and all pixel-texture settings.
for(const gpuCrit of [false,true])for(const pixel of ['fine','classic','chunky'])for(const art of ['hd2d','storybook']){
 const r=await p.evaluate(({gpuCrit,pixel,art})=>{let a=JT.app;a.settings.gpuCrit=gpuCrit;a.settings.pixel=pixel;a.settings.art=art;a.R.resize();for(let i=0;i<3;i++)a.R.render(0);return {gpuCrit,pixel,art,error:a.R.gp.gl.getError(),frameErrors:a.R._glErr||0};},{gpuCrit,pixel,art});assert.equal(r.error,0,JSON.stringify(r));assert.equal(r.frameErrors,0);report.render.push(r);
}
// Pixel evidence from an opaque synthetic critter verifies that sprites contribute to each actual output.
const pixels=await p.evaluate(()=>{const a=JT.app,R=a.R,gp=R.gp,h=a.game.hab,V=R.updateView(h,0),pos=[h.dims.w*.5,40,h.dims.d*.3];const scene={items:[{p:pos,r:12,key:'test-magenta',hot:true}],run:(it,c,v)=>{const q=v.P(it.p);c.fillStyle='#ff00ff';c.fillRect(q[0]-10,q[1]-10,20,20);}};let out=[];for(const art of ['storybook','hd2d']){a.settings.art=art;const gl=gp.gl;gp.frame(V,h,0,[],scene);const q=V.P(pos),px=new Uint8Array(4);gl.readPixels(Math.round(q[0]),R.glc.height-1-Math.round(q[1]),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);out.push({art,px:[...px],error:gl.getError()});}return out;});for(const x of pixels){assert(x.px[0]>100&&x.px[2]>80&&x.px[1]<80,JSON.stringify(x));assert.equal(x.error,0)}report.pixels=pixels;report.checks.push('Sprite contributes visible pixels in both real output pipelines');
for(const [name,viewport] of [['desktop',{width:1100,height:760}],['phone',{width:390,height:844}]]){await p.setViewportSize(viewport);for(const art of ['hd2d','storybook']){await p.evaluate(art=>{JT.app.settings.art=art;JT.app.settings.pixel='fine';JT.app.settings.quality='medium';JT.app.settings.blur='light';JT.app.settings.gpuCrit=true;JT.app.R.resize();JT.app.R.render(0);JT.app.R.render(0);},art);await p.screenshot({path:path.join(OUT,name+'-'+art+'.png')});}}
assert.deepEqual(report.errors,[]);report.result='PASS';console.log('PASS:',report.checks.length,'behavior checks;',report.render.length,'renderer combinations; sprite pixel checks in both styles.');
}catch(e){report.result='FAIL';report.failure=e.stack;console.error(e);process.exitCode=1}finally{fs.writeFileSync(path.join(OUT,'rendering-background-report.json'),JSON.stringify(report,null,2));await b.close();}
})();
