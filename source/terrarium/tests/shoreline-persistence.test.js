const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
const OUT=process.env.TEST_OUTPUT||path.join(__dirname,'shoreline-results');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/local/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{const p=await b.newPage({viewport:{width:700,height:520}});await p.goto((process.env.GAME_URL||'http://localhost:8000')+'/jumper.html?preview=1');await p.waitForFunction(()=>window.JT?.app);const r=await p.evaluate(()=>{
 Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});const g=JT.app.game,SH=JT.Shoreline,checks=[],eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),ok=(t,m)=>{if(!t)throw Error(m);checks.push(m);};
 const data=JSON.parse(g.serialize());for(const h of data.habitats)delete h.shorelineSeed;
 const layout=h=>h.decor.map(d=>({id:d.id,type:d.type,x:d.x,z:d.z,rot:d.rot,parent:d.parent,seed:d.seed}));
 const original=data.habitats.map(layout),game=new JT.Game();ok(game.importSave(JSON.stringify(data)),'Legacy save imports successfully');
 ok(eq(game.habs.map(layout),original),'Existing decor coordinates, IDs, rotations and seeds preserved');
 ok(game.habs.every(h=>h.data.shorelineSeed===(JT.hashStr('shoreline-v1:'+h.data.id)>>>0)),'Older tanks receive deterministic ID-derived shoreline seeds');
 const serialized=game.serialize(),seeds=game.habs.map(h=>h.data.shorelineSeed),again=new JT.Game();ok(again.importSave(serialized),'Updated save reimports successfully');ok(eq(again.habs.map(h=>h.data.shorelineSeed),seeds),'Shoreline seeds survive actual game serialization/import');
 const h=again.hab,shape=()=>SH.profile(h).rows.map(q=>[q.inner,q.outer,q.lip,q.apron]),before=shape();h.data.terrain.seed++;h.data.terrain.shape='rugged';ok(eq(shape(),before),'Terrain seed/shape changes preserve horizontal shoreline identity');
 h.data.bg='snowfield';ok(eq(shape(),before),'Background changes preserve shoreline identity');JT.game=g;return{result:'PASS',checks};
});assert.equal(r.result,'PASS');fs.writeFileSync(OUT+'/shoreline-persistence-report.json',JSON.stringify(r,null,2));console.log('PASS',r.checks.length,'persistence checks');}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
