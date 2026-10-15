const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
const OUT=process.env.TEST_OUTPUT||path.join(__dirname,'shoreline-results');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:900,height:650}}),report={errors:[],geometry:[],renders:[]};p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
try{
 await p.goto((process.env.GAME_URL||'http://localhost:8000')+'/jumper.html?preview=1');await p.waitForFunction(()=>window.JT?.app,null,{timeout:120000});await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.body.classList.remove('title-preview');const a=JT.app;a.R.attract=false;a.game.state.timeMode='day';a.game.hab.data.localTimeMode='day';a.settings.blur='off';a.settings.quality='low';JT.UI.closeModal();a.R.cam.mode='observer';a.R.cam.zoom=1;a.R.cam.op=0;a.R.cam.oy=0;a.R.cam.pan=[0,0];a.R.cur=null;a.R.resize();});
 report.invariants=await p.evaluate(()=>{
  const results=[],eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),fail=m=>{throw Error(m)},SH=JT.Shoreline;
  for(const type of Object.keys(JT.HABITATS))for(let n=0;n<8;n++){
   const h=new JT.Habitat({id:'legacy-'+type+'-'+n,type,terrain:{shape:'flat',seed:12}}),before=JSON.stringify(h.data),a=SH.profile(h),p0=JT.app.R.floorPoly(h),nav=h.nav;
   if(!a.rows.every(q=>q.outer>q.inner+.1&&q.apron>0))fail('inward cut '+type);
   if(!SH.top(h).every(Number.isFinite))fail('nonfinite top');
   const after=JSON.stringify(h.data);if(before!==after)fail('render mutated data');
   const re=new JT.Habitat(JSON.parse(before));if(!eq(SH.profile(re),a))fail('reload unstable');
   h.data.bg='snowfield';if(!eq(SH.profile(h),a))fail('background changes outline');
   if(!eq(p0,JT.app.R.floorPoly(h))||nav!==h.nav)fail('gameplay boundary changed');
   const other=new JT.Habitat({id:'different-'+type+'-'+n,type,terrain:{shape:'flat',seed:12}});if(eq(SH.profile(other).rows,a.rows))fail('duplicate shape');
   // Every original corner lies on or inside the exact inner ring.
   if(h.dims.shape!=='circle')for(const x of [0,h.dims.w])for(const z of [0,h.dims.d]){const r=Math.hypot(x-a.hw,z-a.hd);if(!a.rows.some(q=>Math.abs(q.inner-r)<1e-4&&Math.abs(a.hw+q.dx*q.inner-x)<1e-4&&Math.abs(a.hd+q.dz*q.inner-z)<1e-4))fail('corner gap');}
   results.push({type,id:h.data.id,seed:SH.seed(h),samples:a.rows.length});
  }
  return results;
 });console.log('shape invariants',report.invariants.length);
 const ids=await p.evaluate(()=>Object.keys(JT.BACKGROUNDS));
 for(const id of ids){const r=await p.evaluate(id=>{
  const a=JT.app,R=a.R,h=a.game.hab,tiers=[];h.data.bg=id;
  for(const quality of ['low','medium','high']){a.settings.quality=quality;R.resize();const w=R.gp.buildGroundAnchor(h),parts=[w,...w.parts||[],...w.world.groups.flatMap(g=>[g.mesh,...g.mesh.parts||[]])];const finite=parts.every(m=>m.verts.every(Number.isFinite)),indices=parts.every(m=>m.idx instanceof Uint16Array&&m.n<=63000&&m.idx.every(i=>i<m.n));tiers.push({quality,finite,indices,seed:w.shoreline.seed});for(const buf of w.del)R.gp.gl.deleteBuffer(buf);}
  a.settings.quality='low';a.settings.art='storybook';R.resize();R.cur=null;R.render(0);R.render(0);
  return {id,tiers,glError:R.gp.gl.getError(),frameErrors:R._glErr||0};
 },id);assert(r.tiers.every(t=>t.finite&&t.indices));assert.equal(r.glError,0);assert.equal(r.frameErrors,0);report.geometry.push(r);console.log(id,'PASS');}
 const shots=[['mossy','storybook',900,650,0,.4],['dunes','storybook',900,650,0,.4],['snowfield','storybook',900,650,0,.4],['mossy','hd2d',390,844,0,.4],['crystalcave','hd2d',390,844,0,.4],['mossy','storybook',900,650,Math.PI,1.2],['mossy','storybook',900,650,Math.PI,.15]];
 for(const [id,art,width,height,yaw,pitch] of shots){await p.setViewportSize({width,height});const r=await p.evaluate(({id,art,yaw,pitch})=>{const a=JT.app,R=a.R;a.game.hab.data.bg=id;a.settings.art=art;a.settings.quality='medium';R.cam.oy=yaw;R.cam.op=pitch-.4;R.cam.zoom=1;R.cur=null;R.resize();R.render(0);R.render(0);return {glError:R.gp.gl.getError(),frameErrors:R._glErr||0};},{id,art,yaw,pitch});assert.equal(r.glError,0);assert.equal(r.frameErrors,0);const name=`${id}-${art}-${width}-${pitch}`;await p.screenshot({path:OUT+'/'+name+'.png'});report.renders.push({name,...r});}
 assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(e){report.result='FAIL';report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(OUT+'/shoreline-report.json',JSON.stringify(report,null,2));await b.close();console.log(report.result);}})();
