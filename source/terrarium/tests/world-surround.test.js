const OUT=process.env.TEST_OUTPUT||require('path').join(__dirname,'world-results');
const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs');
(async()=>{fs.mkdirSync(OUT,{recursive:true});const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/local/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:700,height:520}}),report={errors:[],scenes:[],controls:[],fade:[],limitations:['Headless Chromium with software WebGL; not a physical mobile GPU benchmark.']};p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
try{await p.goto((process.env.GAME_URL||'http://localhost:8000')+'/jumper.html?preview=1');await p.waitForFunction(()=>window.JT?.app,null,{timeout:120000});await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.body.classList.remove('title-preview');const a=JT.app;a.R.attract=false;a.game.state.timeMode='day';a.game.hab.data.localTimeMode='day';a.settings.blur='off';JT.UI.closeModal();});
const ids=await p.evaluate(()=>Object.keys(JT.BACKGROUNDS));assert.equal(ids.length,26);
for(const id of ids){
 // Exercise the existing Settings background picker, not a replacement selector.
 await p.evaluate(()=>JT.UI.settingsModal());
 const name=await p.evaluate(id=>JT.BACKGROUNDS[id].name,id);
 await p.locator('.bg-label').filter({hasText:name}).click();assert.equal(await p.evaluate(()=>JT.app.game.hab.data.bg),id);await p.evaluate(()=>JT.UI.closeModal());
 const r=await p.evaluate(id=>{
  const a=JT.app,R=a.R,gp=R.gp,h=a.game.hab,tests=[];
  const frame=(label,mode,yaw,pitch,zoom,art,quality)=>{a.settings.art=art;a.settings.quality=quality;R.resize();R.cam.mode=mode;R.cam.oy=yaw;R.cam.op=pitch-.4;R.cam.zoom=zoom;R.cam.pan=[0,0];R.cur=null;R.render(.016);let w=gp.hg.groundAnchor;const bad=[];for(const part of [w,...w.parts||[]])for(const [i,v]of part.verts.entries())if(!Number.isFinite(v)){bad.push(i);break;}for(const g of w.world.groups)for(const v of g.mesh.verts)if(!Number.isFinite(v)){bad.push('group');break;}tests.push({label,art,quality,zoom,pitch:R.V.pitch,mode,glError:gp.gl.getError(),frameErrors:R._glErr||0,finite:bad.length===0,stats:w.worldStats});};
  frame('low-horizon', 'observer',0,.06,.6,'storybook','low');frame('high-overhead','observer',Math.PI,1.4,.6,'hd2d','medium');frame('maximum-zoom','observer',Math.PI/2,.4,5,'storybook','medium');frame('reverse-minimum-zoom','observer',Math.PI,.4,.6,'hd2d','low');frame('follow-inhabitant','follow',0,.4,1,'hd2d','medium');
  for(const mode of ['iso','reverse','left','right'])frame('preset-'+mode,mode,0,.4,1,'storybook','medium');
  return {id,tests};
 },id);
 for(const t of r.tests){assert.equal(t.glError,0,JSON.stringify({id,t}));assert.equal(t.frameErrors,0);assert(t.finite,JSON.stringify({id,t}));}report.scenes.push(r);console.log(id,'matrix passed');
}
// Existing gesture methods retain full zoom, orbit and pan functionality.
report.controls=await p.evaluate(()=>{const R=JT.app.R,out=[];R.cam.mode='observer';R.resetView();R.zoomBy(.0001);out.push({check:'minimum zoom',value:R.cam.zoom});R.zoomBy(999);out.push({check:'maximum zoom',value:R.cam.zoom});R.resetView();R.orbitBy(200,50);out.push({check:'orbit gesture',yaw:R.cam.oy,pitch:R.cam.op});R.panBy(30,20);out.push({check:'pan gesture',pan:R.cam.pan.slice()});R.resetView();return out;});assert.equal(report.controls[0].value,.6);assert.equal(report.controls[1].value,5);assert.notEqual(report.controls[2].yaw,0);assert(report.controls[3].pan[0]!==0);
// Test the temporary fade and restoration on the real mossy scene across a 180-degree orbit.
await p.evaluate(()=>{let a=JT.app,R=a.R;a.game.hab.data.bg='mossy';a.settings.art='storybook';R.cam.mode='observer';R.cam.zoom=1;R.cam.op=0;R.cam.oy=0;R.cam.pan=[0,0];R.cur=null;R.resetCaches();R.render(0);});
report.fade.push(await p.evaluate(()=>({stage:'initial',values:JT.app.R.gp.hg.groundAnchor.world.groups.map(g=>g.opacity)})));
await p.evaluate(()=>{const R=JT.app.R;R.cam.oy=Math.PI;R.cur=null;R.render(.016);});
report.fade.push(await p.evaluate(()=>({stage:'first-frame',values:JT.app.R.gp.hg.groundAnchor.world.groups.map(g=>g.opacity)})));
for(let i=0;i<24;i++){await p.waitForTimeout(30);await p.evaluate(()=>JT.app.R.render(.016));}
report.fade.push(await p.evaluate(()=>({stage:'settled',values:JT.app.R.gp.hg.groundAnchor.world.groups.map(g=>g.opacity),targets:JT.app.R.gp.hg.groundAnchor.world.groups.map(g=>g.target),fading:JT.app.R.gp.hg.groundAnchor.world.fading,cache:JT.app.R.gp._cache?.key!=null})));
assert(report.fade[1].values.some((v,i)=>v!==report.fade[0].values[i]),'rotation changes selective opacity');assert(report.fade[1].values.some(v=>v>.06&&v<1),'fade has intermediate values');assert(!report.fade[2].fading,'fade settles');
await p.evaluate(()=>{let R=JT.app.R;R.cam.oy=0;R.cur=null;});for(let i=0;i<24;i++){await p.waitForTimeout(30);await p.evaluate(()=>JT.app.R.render(.016));}report.fade.push(await p.evaluate(()=>({stage:'restored',values:JT.app.R.gp.hg.groundAnchor.world.groups.map(g=>g.opacity)})));
assert(report.fade[3].values.some((v,i)=>v>report.fade[2].values[i]),'faded scenery returns');
// Mobile-sized renderer run for every scene, with both art modes.
await p.setViewportSize({width:390,height:844});report.mobile=[];
for(const id of ids){for(const art of ['storybook','hd2d']){const r=await p.evaluate(({id,art})=>{const a=JT.app;a.game.hab.data.bg=id;a.settings.art=art;a.settings.quality='medium';a.R.cam.mode='observer';a.R.cam.zoom=1;a.R.cam.oy=0;a.R.cam.op=0;a.R.cur=null;a.R.resize();a.R.render(0);return{id,art,error:a.R.gp.gl.getError(),frameErrors:a.R._glErr||0};},{id,art});assert.equal(r.error,0);assert.equal(r.frameErrors,0);report.mobile.push(r);}}
await p.screenshot({path:OUT+'/mobile-snowfield.png'});assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(e){report.result='FAIL';report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(OUT+'/matrix-report.json',JSON.stringify(report,null,2));await b.close();console.log(report.result);}})();
