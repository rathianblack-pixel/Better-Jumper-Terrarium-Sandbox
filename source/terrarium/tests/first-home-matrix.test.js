const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
const BASE=process.env.GAME_URL||'http://localhost:8000',OUT=process.env.TEST_OUTPUT||path.join(__dirname,'../../../validation/first-home');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const report={checks:[],errors:[]};try{
const p=await b.newPage({viewport:{width:1000,height:740}});p.on('pageerror',e=>report.errors.push(e.message));await p.goto(BASE+'/jumper.html');await p.waitForFunction(()=>JT?.app);
report.matrix=await p.evaluate(()=>{
Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});const g=JT.app.game,U=JT.UI,F=JT.FirstHome,rows=[];
for(const type of Object.keys(JT.HABITATS))for(const bid of JT.BIOME_ORDER){
 F.teardown();g.startFirstHome();const s=g.state.firstHome;s.type=type;s.bid=bid;s.seed=JT.hashStr('first-home-test:'+type+':'+bid)>>>0;F.createHome();F.furnish();const sp=F.ensureSpider();F.feed();
 const h=g.hab,ids=[h.data.id,...h.decor.map(x=>x.id),...h.spiders.map(x=>x.id),...h.prey.map(x=>x.id)];
 const row={type,bid,decor:h.decor.length,water:h.decor.some(d=>(JT.DECOR_BY_ID[d.type]||{}).water),spiders:h.spiders.length,prey:h.prey.length,unique:new Set(ids).size===ids.length,finite:[...h.spiders,...h.prey].every(x=>x.pos.every(Number.isFinite)),preySize:h.prey.every(p=>JT.PREY_BY_ID[p.type].len<=JT.SpiderAI.len(sp)*Math.min(1.25,JT.SpiderAI.sizeLimit(sp)))};
 if(!row.decor||row.spiders!==1||row.prey!==2||!row.unique||!row.finite||!row.preySize)throw Error(JSON.stringify(row));rows.push(row);
}
// An interrupted layout must restore the original furnishings and restore global RNG/game ownership.
 F.teardown();g.startFirstHome();F.createHome();const h=g.hab;h.addDecor('twigperch',h.dims.w*.5,h.dims.d*.5,0,42);const before=JSON.stringify(h.decor),rng=JT.R,game=JT.game,add=h.addDecor;let calls=0;h.addDecor=function(){if(++calls===2)throw Error('Injected layout interruption');return add.apply(this,arguments)};
 let caught=false;try{F.furnish()}catch(e){caught=e.message==='Injected layout interruption'}finally{h.addDecor=add}
 if(!caught||JSON.stringify(h.decor)!==before||JT.R!==rng||JT.game!==game)throw Error('Layout rollback or global ownership restoration failed');
 F.finishSetup();return{rows,rollback:true};
});assert.equal(report.matrix.rows.length,99);assert(report.matrix.rollback);report.checks.push('99 tank/biome combinations: furnishings, single resident, two sized prey, finite coordinates and unique live IDs','Injected layout failure rolls back furnishings and restores RNG/game globals');
// Verify full keyboard interaction with the real highlighted Build control and featured decor card.
await p.evaluate(()=>JT.app.game.reset());await p.waitForSelector('#fhNext');for(let i=0;i<3;i++){await p.focus('#fhNext');await p.keyboard.press('Enter');}await p.keyboard.press('Tab');await p.keyboard.press('Enter');await p.waitForSelector('#fhDecor');await p.focus('#fhDecor');await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>JT.app.game.state.firstHome.phase),'placing');await p.focus('#fhPlace');await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>JT.app.game.state.firstHome.phase),'layout');report.checks.push('Keyboard-only real Build → featured furnishing → confirmed placement');
// Browser Back is a safe tutorial step, not an accidental mutation.
await p.evaluate(()=>JT.FirstHome.back());assert.equal(await p.evaluate(()=>JT.app.game.state.firstHome.phase),'skip');await p.evaluate(()=>JT.FirstHome.back());assert.equal(await p.evaluate(()=>JT.app.game.state.firstHome.phase),'layout');report.checks.push('Tutorial browser-Back handler opens and dismisses skip confirmation safely');
assert.deepEqual(report.errors,[]);report.result='PASS';}catch(e){report.result='FAIL';report.failure=e.stack;console.error(e);}finally{fs.writeFileSync(OUT+'/matrix-report.json',JSON.stringify(report,null,2));console.log(report.result,report.checks);await b.close();if(report.result!=='PASS')process.exit(1)}})();
