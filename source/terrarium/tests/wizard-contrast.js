const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
const BASE=process.env.GAME_URL||'http://localhost:8000',OUT=process.env.TEST_OUTPUT||path.join(__dirname,'living-results/wizard-contrast');fs.mkdirSync(OUT,{recursive:true});
function lum(rgb){return rgb.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)}
function contrast(a,b){const x=lum(a.match(/[\d.]+/g).slice(0,3).map(Number)),y=lum(b.match(/[\d.]+/g).slice(0,3).map(Number));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const report={result:'PASS',cases:[],errors:[]};try{
 for(const [name,viewport]of [['desktop',{width:1280,height:720}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]){
 const ctx=await b.newContext({viewport});await ctx.addInitScript(()=>localStorage.setItem('jumperTerrarium.settings',JSON.stringify({quality:'low',art:'storybook',tips:false,haptics:false,muted:true})));const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(BASE+'/jumper.html');await p.waitForFunction(()=>window.JT?.app);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});if(JT.FirstHome.active(JT.app.game))JT.FirstHome.finishSetup();JT.app.game.state.biomeSetup=false;JT.UI.closeModal();JT.UI.biomeWizard(false)});
 for(let step=0;step<3;step++){
  const next=p.locator('#bmNext');await next.scrollIntoViewIfNeeded();
  for(const state of ['normal','hover','focus']){
   if(state==='hover')await next.hover();if(state==='focus')await next.focus();
   const vals=await p.locator('.bm-actions button').evaluateAll(bs=>bs.map(b=>{const s=getComputedStyle(b),rect=b.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(b);const text=range.getBoundingClientRect();return {label:b.textContent.trim(),color:s.color,background:s.backgroundColor,opacity:s.opacity,visible:rect.width>0&&rect.height>0,textFits:text.width<=rect.width-12}}));
   for(const button of vals){button.contrast=contrast(button.color,button.background);assert(button.visible&&button.textFits,JSON.stringify(button));assert(button.contrast>=4.5,`${name} step ${step+1} ${state}: ${JSON.stringify(button)}`);assert.equal(button.opacity,'1');}
   assert.equal(vals[1].label,step===2?'Create Tank & Enter':'Continue');report.cases.push({viewport:name,step:step+1,state,buttons:vals});
  }
  await p.screenshot({path:path.join(OUT,`${name}-step-${step+1}.png`)});if(step<2)await next.click();
 }
 await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await p.evaluate(()=>JT.app.game.habs.length),1);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);console.log('PASS:',report.cases.length,'wizard contrast cases; normal/hover/focus, all three steps, desktop/phone/landscape');
 }catch(e){report.result='FAIL';report.failure=e.message;process.exitCode=1;console.error(e.message)}finally{fs.writeFileSync(path.join(OUT,'wizard-contrast-report.json'),JSON.stringify(report,null,2));await b.close()}})();
