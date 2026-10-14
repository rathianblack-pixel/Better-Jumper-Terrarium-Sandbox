const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
const BASE=process.env.GAME_URL||'http://localhost:8000',OUT=process.env.TEST_OUTPUT||path.join(__dirname,'living-results');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={checks:[],errors:[]};
 try{
 for(const [name,viewport]of [['desktop',{width:1280,height:720}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]){
 const ctx=await browser.newContext({viewport}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))report.errors.push(name+': '+m.text())});
 await p.goto(BASE+'/jumper.html');await p.waitForFunction(()=>window.JT?.app);await p.waitForTimeout(150);
 await p.evaluate(()=>{JT.app.settings.tips=false;JT.UI._tipQ=[];JT.UI.hideTip();JT.app.settings.quality='low';JT.app.R.resize()});
 await p.getByRole('button',{name:'Continue',exact:true}).click();await p.getByRole('button',{name:'Continue',exact:true}).click();await p.getByRole('button',{name:'Create Tank & Enter',exact:true}).click();
 assert(await p.locator('#spiderPanel').isHidden(),'creation does not force a detail panel');
 await p.evaluate(()=>JT.UI.jumpersSheet());
 assert.equal(await p.locator('#createNewTank').count(),1);assert(await p.locator('#createNewTank').isVisible());
 await p.screenshot({path:path.join(OUT,'jumpers-'+name+'.png')});
 for(const tab of ['collection','journal']){await p.evaluate(t=>JT.UI.jumpersSheet(t),tab);assert(await p.locator('#createNewTank').isVisible());}
 await p.click('#createNewTank');await p.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await p.evaluate(()=>JT.app.game.habs.length),1);
 await p.evaluate(()=>JT.UI.jumpersSheet());await p.click('#createNewTank');await p.getByRole('button',{name:'Continue',exact:true}).click();
 const unlocked=await p.evaluate(()=>JT.app.game.state.species.length);assert.equal(await p.locator('.bm-pick').count(),unlocked);
 await p.getByRole('button',{name:'Continue',exact:true}).click();assert((await p.locator('.bm-pick.on').innerText()).includes('Recommended'));
 await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByRole('button',{name:'Continue',exact:true}).click();
 await p.getByRole('button',{name:'Create Tank & Enter',exact:true}).click();assert.equal(await p.evaluate(()=>JT.app.game.habs.length),2);
 assert.equal(await p.evaluate(()=>JT.app.game.state.active),1);assert.equal(await p.evaluate(()=>JT.app.game.hab.spiders.length),1);
 assert(await p.locator('#spiderPanel').isHidden());
 // Stop automatic ticks so long simulated spans and fixtures are deterministic.
 await p.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
 const freeze=await p.evaluate(()=>{
 const g=JT.app.game,h=g.habs[0],active=g.hab;const snapshot=JSON.stringify(h.data),time=h.time,daylight=h.daylight(),age=h.spiders[0].ageDays,sat=h.spiders[0].sat;
 let activeCalls=0,inactiveCalls=0;const au=active.update.bind(active),hu=h.update.bind(h);active.update=(...args)=>{activeCalls++;return au(...args)};h.update=(...args)=>{inactiveCalls++;return hu(...args)};
 for(let i=0;i<120;i++)g.tick(.5);
 const same=JSON.stringify(h.data)===snapshot;
 const before=JSON.stringify({sp:h.spiders,prey:h.prey,drops:h.data.drops,weather:h.data.bev,time:h.time});JT.UI.switchHab(0);
 return {same,timeSame:h.time===time,ageAdvanced:h.spiders[0].ageDays>age,needsAdvanced:h.spiders[0].sat<sat,catchup:before!==JSON.stringify({sp:h.spiders,prey:h.prey,drops:h.data.drops,weather:h.data.bev,time:h.time}),activeCalls,inactiveCalls};});
 assert.deepEqual(freeze,{same:true,timeSame:false,ageAdvanced:true,needsAdvanced:true,catchup:true,activeCalls:120,inactiveCalls:0});
 const camera=await p.evaluate(()=>{
 const u=JT.UI,g=u.game;u.R.cam.zoom=1.7;u.R.cam.pan=[12,18];u.R.cam.oy=.25;const id=g.hab.spiders[0].id;g.selectedId=id;
 u.switchHab(1);u.R.cam.zoom=1.2;u.switchHab(0);return {zoom:u.R.cam.zoom,pan:u.R.cam.pan,oy:u.R.cam.oy,selected:g.selectedId===id,previous:g.state.previousTankId===g.habs[1].data.id};});
 assert.deepEqual(camera,{zoom:1.7,pan:[12,18],oy:.25,selected:true,previous:true});
 await p.evaluate(()=>JT.UI.jumpersSheet());await p.getByRole('button',{name:'Previous Tank',exact:true}).click();assert.equal(await p.evaluate(()=>JT.app.game.state.active),1);
 await p.evaluate(()=>{const g=JT.app.game;g.habs[0].data.fav=true;g.habs[0].spiders[0].name='Named Jumper';JT.UI.tanksModal()});
 await p.getByRole('button',{name:'Favorites',exact:true}).click();assert.equal(await p.locator('.tkrow').count(),1);await p.getByRole('button',{name:'Recent',exact:true}).click();
 await p.locator('input[type=search]').fill('Named Jumper');assert.equal(await p.locator('.tkrow').count(),1);assert((await p.locator('.tkrow').innerText()).includes('Background'));
 await p.evaluate(()=>{JT.UI.closeModal();JT.UI.showPanel(JT.UI.hab.spiders[0].id)});assert(await p.locator('.living-care').isVisible());await p.screenshot({path:path.join(OUT,'care-'+name+'.png')});
 const status=await p.evaluate(()=>{
 const g=JT.app.game,h=g.hab,s=h.spiders[0];s.sat=.1;s.hyd=.8;s.soft=120;s.state='postMolt';const st=g.tankStatus(h);return {hungry:st.hungry.length,molting:st.molting.length,score:st.score,care:JT.SpiderAI.care(h,s).routine};});assert.equal(status.hungry,0);assert.equal(status.molting,1);assert.equal(status.score,0);assert(status.care.includes('wait for the skin'));
 // The runtime guard remains authoritative even if the modal was opened before the shelf filled.
 await p.evaluate(()=>{JT.UI.hidePanel();JT.UI.biomeWizard(false)});await p.getByRole('button',{name:'Continue',exact:true}).click();await p.getByRole('button',{name:'Continue',exact:true}).click();
 await p.evaluate(()=>{const g=JT.app.game;while(g.habs.length<30)g.createHabitat('standard')});await p.getByRole('button',{name:'Create Tank & Enter',exact:true}).click();assert.equal(await p.evaluate(()=>JT.app.game.habs.length),30);
 await p.evaluate(()=>{JT.UI.closeModal();JT.UI.jumpersSheet()});assert(await p.locator('#createNewTank').isDisabled());assert.equal(await p.evaluate(()=>JT.app.game.createHabitat('standard')),null);
 const perf=await p.evaluate(()=>{const g=JT.app.game;let inactive=0,active=0;g.habs.forEach(h=>{h.update=()=>h===g.hab?active++:inactive++});for(let i=0;i<20;i++)g.tick(.1);return {active,inactive}});assert.deepEqual(perf,{active:20,inactive:0});
 await p.evaluate(()=>{const g=JT.app.game;g.deleteHabitat(g.habs[g.habs.length-1]);JT.UI.jumpersSheet()});assert(await p.locator('#createNewTank').isEnabled());
 await p.evaluate(()=>{const g=JT.app.game;g.habs[0].data.localTimeMode='night';g.hab.data.localTimeMode='day';g.state.timeMode='day';JT.UI.tankEditModal(g.state.active)});
 p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Delete tank…',exact:true}).click();
 assert.equal(await p.evaluate(()=>JT.app.game.state.timeMode),await p.evaluate(()=>JT.app.game.hab.data.localTimeMode));assert(await p.locator('#spiderPanel').isHidden());
 report.checks.push(name+': creation, cancel/back, recommended biome, 30 limit, inactive data remains lazy, biological catch-up on revisit, saved camera/selection, previous tank, favorites/search, care UI, only one tank updates');await ctx.close();
 }
 // Pure behavior fixtures inside the real engine, separate from live-game simulation.
 const p=await browser.newPage();await p.goto(BASE+'/jumper.html?preview=1');await p.waitForFunction(()=>window.JT?.app);await p.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
 const behavior=await p.evaluate(()=>{
 const J=JT,A=J.SpiderAI,P=J.PreyAI,g=J.app.game;
 const h=new J.Habitat({type:'standard'},g),s=h.addSpider(g.state.species[0],{stage:2,sat:.8,pos:[30,0,30]});s.hyd=.8;s.state='molting';s.st=12;
 A.H.molting(h,s,.1);const post={sat:s.sat,state:s.state,soft:s.soft};s.st=100;A.H.postMolt(h,s,.1);const protectedState=s.state;s.soft=0;A.H.postMolt(h,s,.1);const resumed=s.state!=='postMolt';
 const e=P.create(h,'fruitfly');e.pos=[40,0,30];e.sup={k:'floor'};e._vel=[2,0,0];h.data.prey.push(e);s.state='idle';s.fwd=[-1,0,0];
 const peripheral=A.inspectCue(h,s,e,-1,1);const noInstantKnown=!(s._seen&&s._seen[e.id]);h.data.simTime+=.5;const inspect=A.inspectCue(h,s,e,1,1);
 s.mem.ignore[e.id]=h.time+40;s.sat=.01;const ignoredScore=A._scoreTarget(h,s,e,false);
 s.mem.ignore={};s.fwd=[-1,0,0];s.target=null;s._seen={};s._attentionLock=0;s._glNext=0;s._vibNext=0;J.Senses.emit(h,e,.9,'landing');J.Senses.sense(h,s);
 const vibration={turn:s.fwd[0]>-1,target:s.target,visualCount:Object.keys(s._seen).length,events:s.stats.vibrations||0};
 const disconnected=J.Senses.linked(h,{k:'top',d:'a'},{k:'top',d:'b'},[0,0,0],[10,0,0]);const airborne=J.Senses.linked(h,{k:'air'},{k:'floor'},[0,0,0],[10,0,0]);
 s.mem.places=[];h.data.drops=[{id:'dropTest',pos:[35,0,30],sup:{k:'floor'},life:50}];const waterKnown=A.waterKnown(h,s,h.data.drops[0]);const memoryBonus=A.placeBonus(h,s,[35,0,30],'water');h.data.drops=[];const invalidated=A.placeBonus(h,s,[35,0,30],'water')===0;
 const r=J.R;J.R=Object.assign(()=>.1,r);e.state='idle';e.st=2;e.alert=0;e.ambientNext=0;P.H.idle(h,e,J.PREY_BY_ID[e.type],.1);const ambient=e.state;P.H.groom(h,e,J.PREY_BY_ID[e.type],.1);const animated=Number.isFinite(e._groom);e.alert=1;P.H.groom(h,e,J.PREY_BY_ID[e.type],.1);const interrupted=e.state!=='groom';J.R=r;
 // Visual memories and recent failed launch positions persist through save serialization.
 A.noteSeen(h,s,e);s.mem.failures=[{pos:[30,0,30],t:h.time,id:e.id}];g.habs=[h];g.state.active=0;g.save=J.Game.prototype.save;g.save();const restored=new J.Game();const loaded=restored.load(),rs=restored.hab.spiders[0];
 return {post,protectedState,resumed,peripheral,noInstantKnown,inspect,ignoredScore,vibration,disconnected,airborne,waterKnown,memoryBonus,invalidated,ambient,animated,interrupted,loaded,sightRestored:!!rs._ls[e.id],failuresRestored:rs.mem.failures.length,clockRestored:restored.hab.time>=h.time&&restored.hab.time<h.time+2};});
 assert(behavior.post.sat>=.18&&behavior.post.sat<=.3);assert.equal(behavior.post.state,'postMolt');assert.equal(behavior.protectedState,'postMolt');assert(behavior.resumed);assert.equal(behavior.peripheral,false);assert(behavior.noInstantKnown&&behavior.inspect);assert.equal(behavior.ignoredScore,-1);
 assert.deepEqual(behavior.vibration,{turn:true,target:null,visualCount:0,events:1});assert.equal(behavior.disconnected,false);assert.equal(behavior.airborne,false);assert(behavior.waterKnown&&behavior.memoryBonus>0&&behavior.invalidated);assert.equal(behavior.ambient,'groom');assert(behavior.animated&&behavior.interrupted&&behavior.loaded&&behavior.sightRestored&&behavior.clockRestored);assert.equal(behavior.failuresRestored,1);
 report.behavior=behavior;report.checks.push('Behavior fixtures: post-molt hunger/hardening, peripheral inspection, starving retry suppression, vibration direction without omniscient targeting, airborne/disconnected rejection, known water invalidation, calm grooming/alarm interrupt, persistent visual/place/failure memories');
 // Legacy v4 migration preserves identity and snapshots; wall-time catch-up starts with the new stamp.
 const migration=await p.evaluate(()=>{
 const J=JT,g=J.app.game,legacy=JSON.parse(g.serialize());legacy.simRevision=undefined;legacy.time=1000;legacy.active=0;legacy.timeMode='auto';delete legacy.habitats[0].simTime;delete legacy.habitats[0].localTimeMode;legacy.habitats[0].leftAt=250;
 const name=legacy.habitats[0].spiders[0].name,oldSat=legacy.habitats[0].spiders[0].sat;
 const d=J.Game.migrate(legacy);return {clock:d.habitats[0].simTime,nameSame:d.habitats[0].spiders[0].name===name,satSame:d.habitats[0].spiders[0].sat===oldSat,revision:d.simRevision};});
 assert.deepEqual(migration,{clock:250,nameSame:true,satSame:true,revision:1});report.checks.push('Legacy save migration retains identity and biological values, initializes frozen clock from last pause stamp');
 assert.deepEqual(report.errors,[]);report.result='PASS';console.log('PASS living tanks:',report.checks.length,'groups');
 }catch(e){report.result='FAIL';report.failure=e.stack;console.error(e);process.exitCode=1}finally{fs.writeFileSync(path.join(OUT,'living-tanks-report.json'),JSON.stringify(report,null,2));await browser.close()}
})();
