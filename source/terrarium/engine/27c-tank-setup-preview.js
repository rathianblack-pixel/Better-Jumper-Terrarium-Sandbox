/* Tank Setup: one disposable, non-simulating scene; live state is committed only by Apply. */
(function(root){
 'use strict';const J=root.JT,U=J.UI,B=J.Biome,N=J.Nav,A=J.SpiderAI,D=root.document;
 const KEYS=['decor','substrate','bg','terrain','biome','humidity','bev','wx','bt','wxs','bmatch'];
 const plain=o=>JSON.parse(JSON.stringify(o,(k,v)=>k.startsWith('_')?undefined:v));
 const copy=o=>o==null?o:J.deepClone(o);
 let serial=0;
 function el(tag,cls,text){const e=D.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
 function button(label,id,fn){const b=el('button','setup-button',label);b.type='button';b.id=id;b.onclick=fn;return b;}
 function environment(h){const out={};for(const k of KEYS)if(h.data[k]!==undefined)out[k]=plain(h.data[k]);return out;}
 function shape(h){return JSON.stringify({type:h.data.type,biome:B.id(h),sub:h.data.substrate,bg:h.data.bg,terrain:h.data.terrain||null,decor:h.decor.map(d=>{const o={};for(const k of ['id','type','x','z','rot','seed','parent','parentTop','wall','ww','wh','my','bare','on','fit','sub'])if(d[k]!==undefined)o[k]=d[k];return o;})});}
 function protectedJumpers(h){return h.spiders.filter(s=>s.soft>0||/^(moltSeek|moltSilk|premolt|molting|postMolt|emerge)$/.test(s.state)||((h.data.nests||[]).some(n=>n.owner===s.id&&n.kind==='molt')));}
 function dispose(h){if(!h)return;for(const g of Object.values(h.geoms||{})){const m=g._mesh;if(m&&m.gl&&m.vb&&m.gl.free)m.gl.free(m);}h.geoms={};h.nav=null;}
 function canUndo(h){const u=h.data.setupUndo;return !!(u&&u.v===1&&u.tankId===h.data.id&&u.environment&&Array.isArray(u.environment.decor)&&u.expected===shape(h));}
 function putEnvironment(h,data){for(const k of KEYS){if(Object.prototype.hasOwnProperty.call(data,k))h.data[k]=copy(data[k]);else delete h.data[k];}}
 function rebuildSafely(h){
  const old=h.geoms;h.rebuild();for(const g of Object.values(old)){const m=g._mesh;if(m&&m.gl&&m.vb&&m.gl.free)m.gl.free(m);}
  h.data.nests=(h.data.nests||[]).filter(n=>N.validSup(h,n.sup));
  for(const s of h.spiders){
   if(s.sup.k==='air'){const p=N.supportBelow(h,s.pos);s.pos=p.pos;s.sup=p.sup;s._air=null;}
   if(s.nest&&!(h.data.nests||[]).some(n=>n.id===s.nest)){s.nest=null;if(s.state==='sleep')A.setState(s,'idle','Settling into the new setup.');}
   if(A.HUNT.has(s.state)){A.dropTarget(h,s);}
   if(/^(pounce|fall|explore|patrol|scan|lunge|scuttle|homeSeek|baskSeek|search|drinkSeek|sleepSeek|flee|avoid|investigate|curious|nectarSeek)$/.test(s.state)){s._route=null;A.setState(s,'idle','Checking the changed surroundings.');}
   s._plan=null;s._ls={};s._vis={};s._ip=s.pos.slice();s._if=(s.fwd||[1,0,0]).slice();s.comfort=B.fit(s.species,B.id(h));
   if(s.mem){s.mem.places=(s.mem.places||[]).filter(p=>N.validSup(h,p.sup)&&(!p.drop||h.data.drops.some(d=>d.id===p.drop)));s.mem.sight={};}
  }
  for(const p of h.prey){if(p.sup.k==='air'&&!J.PREY_BY_ID[p.type].fly&&!p.owner){const q=N.supportBelow(h,p.pos);p.pos=q.pos;p.sup=q.sup;p.state='idle';}p._route=null;p._air=null;p._ip=p.pos.slice();}
  for(const p of h.prey.filter(p=>p.owner)){const owner=h.spider(p.owner);if(owner){p.pos=A.mouth(h,owner);p.sup=copy(owner.sup);}}
  h.validateRefs();h._biZones=null;h._vibrations=[];
 }
 function clearReplay(){if(J.Replay){if(J.Replay.active)J.Replay.stop();J.Replay.buf=[];J.Replay.habId=null;if(J.Replay.offer&&J.Replay.offer.el)J.Replay.offer.el.remove();J.Replay.offer=null;}}
 U.tankSetupProtected=protectedJumpers;
 U.closeTankNameMenu=function(){const m=D.getElementById('tankNameMenu');if(m)m.remove();const b=D.getElementById('jumperControl');if(b)b.setAttribute('aria-expanded','false');};
 U.tankNameMenu=function(){
  if(this.tankSetup)return;const existing=D.getElementById('tankNameMenu');if(existing){this.closeTankNameMenu();return;}
  const menu=el('div','tank-name-menu');menu.id='tankNameMenu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Tank shortcuts');
  for(const [label,fn]of [['Jumpers',()=>this.jumpersSheet()],['Switch Tank',()=>this.tanksModal()],['Tank Setup',()=>this.beginTankSetup()]]){const b=button(label,'',()=>{this.closeTankNameMenu();fn();});b.setAttribute('role','menuitem');menu.append(b);}
  D.getElementById('app').append(menu);D.getElementById('jumperControl').setAttribute('aria-expanded','true');menu.firstChild.focus();
 };
 U.beginTankSetup=function(options){
  options=options||{};if(this.game.state.biomeSetup){this.toast('Finish creating your first tank before editing its setup.');return;}
  if(this.tankSetup)this.finishTankSetup(false);
  this.closeTankNameMenu();if(J.Replay&&J.Replay.active)J.Replay.stop();if(this.photo)this.photoMode(false);if(this.tv)this.tvMode(false);if(this.obs)this.toggleObserve(false);
  this.cancelMode();this.closeDrawer();this.closeModal();this.hidePanel();this.hideTip();
  const h=this.hab,cam=copy(this.R.cam),source=plain(h.data),reference=h.spider(this.game.selectedId)||h.spiders[0];
  this.tankSetup={tankId:h.data.id,source,sourceShape:shape(h),mode:options.mode||'biome',bid:options.bid||B.id(h),preset:options.preset||('t:'+(J.Presets.forType(h.data.type)[0]||{}).theme),sid:reference&&reference.species,seed:(Math.random()*0xffffffff)>>>0||1,preview:null,previewGame:null,cam,focus:D.activeElement,ack:false,error:null};
  D.body.classList.add('tank-setup');this.R.cam.mode='observer';this.R.resetView();this.R.resetCaches();this.drawTankSetup();this.regenerateTankSetup();D.getElementById('setupMode').focus();
 };
 U.regenerateTankSetup=function(){
  const s=this.tankSetup;if(!s)return false;let h=null;const previousGame=J.game,previousRng=J.R;
  try{
   const fake=new J.Game();fake.state=plain(this.game.state);fake.state.active=0;fake.selectedId=this.game.selectedId;fake.save=()=>{};fake.onEvent=()=>{};
   J.game=fake;J.R=J.makeRng(s.seed);const data=copy(s.source);data.spiders=[];data.prey=[];data.drops=[];data.remains=[];data.silk=[];data.nests=[];delete data.setupUndo;
   h=new J.Habitat(data,fake);h.event=()=>{};fake.habs=[h];
   if(s.mode==='biome'){if(s.bid!==B.id(this.hab)){B.setBiome(h,s.bid);B.applyGround(h,s.bid);}}
   else if(s.mode==='layout'){
    if(s.bid==='classic'){B.setBiome(h,'classic');const p=J.Presets.forType(h.data.type)[0];if(!p)throw new Error('No starter layout fits this enclosure.');J.Presets.generate(h,p.theme,s.seed,true);}
    else B.layout(h,s.bid,s.seed);
   }else{
    if(s.preset.startsWith('c:')){const p=this.game.state.customPresets[+s.preset.slice(2)];if(!p)throw new Error('This saved preset is unavailable.');J.Presets.applyCustom(h,p);}
    else{const theme=s.preset.slice(2);if(!J.PRESET_THEMES[theme])throw new Error('Choose an available preset.');J.Presets.generate(h,theme,s.seed,true);}
   }
   if(s.mode!=='biome')h.decor.forEach(d=>{d.preset=true;d.novel=false;});
   // Preview clones can be safely grounded without changing any real individual or saved reference.
   for(const key of ['spiders','prey','drops','remains','silk','nests'])h.data[key]=copy(s.source[key]||[]);
   h.rebuild();for(const sp of h.spiders){if(sp.sup.k==='air'){const q=N.supportBelow(h,sp.pos);sp.pos=q.pos;sp.sup=q.sup;}sp._ip=sp.pos.slice();}
   h._geomVersion=1000000+(++serial);dispose(s.preview);s.preview=h;s.previewGame=fake;s.previewCounter=fake.state.nextId;s.error=null;this.R.resetCaches();this.updateTankSetupStatus();return true;
  }catch(e){dispose(h);s.error=e.message;s.previewGame=null;this.updateTankSetupStatus();return false;}
  finally{J.game=previousGame;J.R=previousRng;}
 };
 U.drawTankSetup=function(){
  const s=this.tankSetup;if(!s)return;const previous=D.getElementById('tankSetupTray');if(previous)previous.remove();
  const tray=el('section','tank-setup-tray');tray.id='tankSetupTray';tray.setAttribute('role','dialog');tray.setAttribute('aria-modal','true');tray.setAttribute('aria-labelledby','setupTitle');
  const head=el('div','setup-head');head.append(el('h2','', 'Tank Setup'));head.firstChild.id='setupTitle';head.append(el('span','setup-paused','Preview · paused'));tray.append(head);
  const body=el('div','setup-body');body.append(el('p','setup-tank-name',this.hab.title));
  const field=(label,id,options,value,fn)=>{const row=el('div','setup-field');const lab=el('label','',label);lab.htmlFor=id;const select=el('select');select.id=id;for(const [v,t]of options){const o=el('option','',t);o.value=v;select.append(o);}select.value=value;select.onchange=()=>fn(select.value);row.append(lab,select);body.append(row);return select;};
  field('Change','setupMode',[['biome','Biome only · keep furnishings'],['layout','Biome + recommended layout'],['preset','Preset layout · keep climate']],s.mode,v=>{s.mode=v;s.ack=false;this.drawTankSetup();this.regenerateTankSetup();});
  if(s.mode!=='preset'){
   const rank=s.sid?B.rank(s.sid):J.BIOME_ORDER;
   field('Biome','setupBiome',rank.map(id=>[id,J.BIOMES[id].name+(s.sid&&B.fit(s.sid,id)>=.95?' · Recommended':'')]),s.bid,v=>{s.bid=v;s.ack=false;this.regenerateTankSetup();});
   if(s.sid)body.append(el('p','setup-note','Recommendations for '+J.SPECIES_BY_ID[s.sid].name+'. No new jumper is spawned.'));
  }else{
   const presets=J.Presets.forType(this.hab.data.type).map(p=>['t:'+p.theme,p.name]).concat((this.game.state.customPresets||[]).map((p,i)=>['c:'+i,'Saved: '+p.name+' (fixed)']));
   field('Preset','setupPreset',presets,s.preset,v=>{s.preset=v;s.ack=false;this.drawTankSetup();this.regenerateTankSetup();});
   body.append(el('p','setup-note','Presets replace furnishings and their ground/backdrop. Your current biome and climate stay.'));
  }
  if(s.mode!=='biome'&&s.source.decor.length){const label=el('label','setup-confirm');const c=el('input');c.type='checkbox';c.id='setupReplace';c.checked=s.ack;c.onchange=()=>{s.ack=c.checked;this.updateTankSetupStatus();};label.append(c,el('span','',`Replace ${s.source.decor.length} current furnishings. Jumpers, prey and progress stay; positions may be adjusted safely.`));body.append(label);}
  const status=el('p','setup-status');status.id='setupStatus';status.setAttribute('aria-live','polite');body.append(status);tray.append(body);
  const footer=el('div','setup-actions');footer.append(button('Reroll','setupReroll',()=>{s.seed=(s.seed+0x9e3779b9)>>>0||1;this.regenerateTankSetup();}),button('Undo last setup','setupUndo',()=>this.undoTankSetup()),button('Cancel','setupCancel',()=>this.finishTankSetup(false)),button('Apply setup','setupApply',()=>this.applyTankSetup()));footer.lastChild.classList.add('primary');tray.append(footer);
  D.getElementById('app').append(tray);this.updateTankSetupStatus();
 };
 U.updateTankSetupStatus=function(){
  const s=this.tankSetup;if(!s)return;const protectedNames=protectedJumpers(this.hab).map(x=>x.name),changed=s.preview&&shape(s.preview)!==s.sourceShape;
  const stale=this.hab.data.id!==s.tankId||shape(this.hab)!==s.sourceShape,needsAck=s.mode!=='biome'&&s.source.decor.length&&!s.ack;
  const msg=s.error?'Could not preview: '+s.error:stale?'The tank changed. Cancel and reopen Tank Setup.':protectedNames.length?'Apply/Undo locked: '+protectedNames.join(', ')+' is molting or recovering. Cancel to resume; try again after recovery.':!changed?'Choose a change to preview. Nothing has been applied.':needsAck?'Preview only. Confirm replacement above to enable Apply.':`${s.preview.decor.length} furnishings · ${B.of(s.preview).name}. Apply saves this preview; Cancel changes nothing.`;
  D.getElementById('setupStatus').textContent=msg;
  D.getElementById('setupApply').disabled=!!(s.error||stale||protectedNames.length||!changed||needsAck||!s.previewGame);
  const fixed=s.mode==='biome'||s.mode==='preset'&&s.preset.startsWith('c:');D.getElementById('setupReroll').disabled=fixed;D.getElementById('setupReroll').title=fixed?'Biome-only changes and saved custom presets have no random arrangement.':'Try another generated arrangement';
  D.getElementById('setupUndo').disabled=protectedNames.length>0||!canUndo(this.hab);D.getElementById('setupUndo').title=canUndo(this.hab)?'Restore the last applied setup without rewinding animal progress.':'No unchanged applied setup to undo. Later furnishing edits invalidate this shortcut.';
 };
 U.finishTankSetup=function(applied){
  const s=this.tankSetup;if(!s)return;this.tankSetup=null;dispose(s.preview);const tray=D.getElementById('tankSetupTray');if(tray)tray.remove();D.body.classList.remove('tank-setup');this.R.cam=copy(s.cam);this.R.resetCaches();this.R.fx=[];this.R.particles=[];this.refreshHeader();
  if(s.focus&&s.focus.isConnected&&!applied)s.focus.focus();return true;
 };
 U.applyTankSetup=function(){
  const s=this.tankSetup;if(!s)return false;this.updateTankSetupStatus();if(D.getElementById('setupApply').disabled)return false;
  const h=this.hab,previous=environment(h),previousUndo=h.data.setupUndo,rollback=copy(h.data);
  try{
   const furnishings=h.decor;putEnvironment(h,environment(s.preview));if(s.mode==='biome')h.data.decor=furnishings;rebuildSafely(h);h.data.setupUndo={v:1,tankId:h.data.id,environment:previous,keepDecor:s.mode==='biome',expected:shape(h)};
   this.game.state.nextId=Math.max(this.game.state.nextId,s.previewCounter||0);clearReplay();this.undoClear&&this.undoClear();this.finishTankSetup(true);this.game.checkUnlocks();this.game.save();this.toast('Setup applied. Your jumpers and progress are kept.');return true;
  }catch(e){h.data=rollback;h.rebuild();if(previousUndo)h.data.setupUndo=previousUndo;else delete h.data.setupUndo;this.R.resetCaches();if(this.tankSetup){s.error=e.message;this.updateTankSetupStatus();}else this.toast('Could not apply setup: '+e.message);return false;}
 };
 U.undoTankSetup=function(){
  const h=this.hab;if(protectedJumpers(h).length){this.toast('Wait until molt recovery completes before restoring a setup.');return false;}
  if(!canUndo(h)){this.toast('This setup cannot be undone after later furnishing edits.');return false;}
  const previous=environment(h),undo=h.data.setupUndo,rollback=copy(h.data);
  try{const furnishings=h.decor;putEnvironment(h,undo.environment);if(undo.keepDecor)h.data.decor=furnishings;rebuildSafely(h);delete h.data.setupUndo;clearReplay();this.undoClear&&this.undoClear();this.finishTankSetup(true);this.R.resetCaches();this.refreshHeader();this.game.save();this.toast('Previous setup restored. Animal progress was not rewound.');return true;}
  catch(e){h.data=rollback;h.rebuild();h.data.setupUndo=undo;this.R.resetCaches();this.toast('Could not restore this setup: '+e.message);return false;}
 };
 // Fit the whole enclosure into the space left by the tray, not behind it.
 const view=J.Renderer.prototype.updateView;
 J.Renderer.prototype.updateView=function(h,dt){
  const v=view.call(this,h,dt),s=U.tankSetup,tray=D.getElementById('tankSetupTray');if(!s||!tray||h!==s.preview)return v;
  const r=tray.getBoundingClientRect(),W=this.cssW,H=this.cssH,side=r.left>=W*.45;
  const box=side?{x:16,y:16,w:r.left-32,h:H-32}:{x:12,y:12,w:W-24,h:r.top-24};
  let top=.55*h.dims.h;for(const g of Object.values(h.geoms))top=Math.max(top,g.height+g.baseY);top=Math.min(top,1.1*h.dims.h);
  const unit=new J.View(v.yaw,v.pitch,1,0,0,v.c);let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const x of [0,h.dims.w])for(const z of [0,h.dims.d])for(const y of [-12,top]){const q=unit.P([x,y,z]);x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}
  const scale=Math.min(box.w*.92/(x1-x0),Math.max(40,box.h)*.9/(y1-y0)),k=this.k;
  return v.set(v.yaw,v.pitch,scale*k,(box.x+box.w/2-(x0+x1)*scale/2)*k,(box.y+box.h/2-(y0+y1)*scale/2)*k,v.c);
 };
 const render=J.Renderer.prototype.render;
 J.Renderer.prototype.render=function(dt){const s=U.tankSetup,real=this.game;if(!s||!s.previewGame)return render.call(this,dt);this.game=s.previewGame;try{return render.call(this,dt);}finally{this.game=real;}};
 const tick=J.Game.prototype.tick;J.Game.prototype.tick=function(dt){if(U.tankSetup&&U.game===this)return;return tick.call(this,dt);};
 const update=U.update;U.update=function(dt){if(this.tankSetup){this.layoutHud();return;}return update.call(this,dt);};
 const remember=U.rememberTankView;U.rememberTankView=function(){if(this.tankSetup)return;return remember.apply(this,arguments);};
 const key=U.key;U.key=function(e){if(this.tankSetup)return;if(D.getElementById('tankNameMenu')&&e.key==='Escape'){this.closeTankNameMenu();D.getElementById('jumperControl').focus();return;}return key.call(this,e);};
 const open=U.openModal;U.openModal=function(){if(this.tankSetup)this.finishTankSetup(false);this.closeTankNameMenu();return open.apply(this,arguments);};
 const switchHab=U.switchHab;U.switchHab=function(){if(this.tankSetup)this.finishTankSetup(false);return switchHab.apply(this,arguments);};
 const jumpers=U.jumpersSheet;U.jumpersSheet=function(){const out=jumpers.apply(this,arguments),row=D.querySelector('#modal .living-actions');if(row){const b=button('Tank Setup','tankSetupShortcut',()=>this.beginTankSetup());b.className='modal-btn';row.insertBefore(b,D.getElementById('switchTank').nextSibling);}return out;};
 const init=U.init;U.init=function(){const out=init.apply(this,arguments),b=D.getElementById('jumperControl');b.onclick=()=>this.tankNameMenu();b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');return out;};
 const more=U.moreSheet;U.moreSheet=function(){const out=more.apply(this,arguments),section=[...D.querySelectorAll('#modalBody .msect')].find(e=>e.querySelector('h4')?.textContent==='This tank');if(section){const b=button('Tank Setup · Preview layouts','menuTankSetup',()=>this.beginTankSetup());b.className='mrow';section.insertBefore(b,section.children[1]||null);}return out;};
 const edit=U.tankEditModal;U.tankEditModal=function(i){const out=edit.apply(this,arguments),h=this.game.habs[i];if(!h)return out;
  const start=options=>{if(h!==this.hab)this.switchHab(this.game.habs.indexOf(h));this.beginTankSetup(options);};
  for(const b of D.querySelectorAll('#modalBody button')){
   if(b.textContent==='Apply / Regenerate'){const select=b.parentElement.querySelector('select');b.textContent='Preview / Reroll';b.onclick=()=>start({mode:'preset',preset:select.value});}
   else if(b.textContent==='Change biome'){const select=b.parentElement.querySelector('select[aria-label="Biome"]');b.textContent='Preview biome';b.onclick=()=>start({mode:'biome',bid:select.value});}
   else if(b.textContent==='Recommended biome layout'){b.textContent='Preview biome layout';b.onclick=()=>start({mode:'layout',bid:B.id(h)});}
  }return out;
 };
 const biomeSheet=U.biomeSheet;U.biomeSheet=function(){const out=biomeSheet.apply(this,arguments),b=[...D.querySelectorAll('#modalBody button')].find(b=>b.textContent==='Change biome…');if(b)b.onclick=()=>this.beginTankSetup();return out;};
 D.addEventListener('keydown',e=>{const s=U.tankSetup;if(!s)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();U.finishTankSetup(false);return;}if(e.key==='Tab'){const items=[...D.querySelectorAll('#tankSetupTray button:not(:disabled),#tankSetupTray select,#tankSetupTray input')],first=items[0],last=items[items.length-1];if(e.shiftKey&&(D.activeElement===first||!D.getElementById('tankSetupTray').contains(D.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(D.activeElement===last||!D.getElementById('tankSetupTray').contains(D.activeElement))){e.preventDefault();first.focus();}}},true);
 for(const name of ['pointerdown','pointerup','click','wheel','touchstart'])D.addEventListener(name,e=>{if(U.tankSetup&&!e.target.closest('#tankSetupTray')){if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();}}, {capture:true,passive:false});
 D.addEventListener('pointerdown',e=>{if(D.getElementById('tankNameMenu')&&!e.target.closest('#tankNameMenu,#jumperControl'))U.closeTankNameMenu();},true);
 const style=el('style');style.textContent=`
body.tank-setup #app #dock,body.tank-setup #app #top,body.tank-setup #app #camCtl,body.tank-setup #app #spiderPanel,body.tank-setup #app #toasts,body.tank-setup #app #tip,body.tank-setup #app #modeBar{visibility:hidden!important;pointer-events:none!important}
#app .tank-name-menu{position:absolute;top:calc(60px + var(--sat));left:24px;z-index:32;background:#f6f3e9;color:#2c302a;border:1px solid #c9c6b8;border-radius:8px;padding:8px;display:flex;flex-direction:column;min-width:180px;box-shadow:0 2px 8px #0002}
#app .tank-name-menu button{text-align:left;min-height:44px;padding:8px 12px;color:#2c302a;line-height:1.4}
#app .tank-setup-tray{position:absolute;right:20px;bottom:20px;width:min(490px,calc(100% - 40px));max-height:52dvh;z-index:40;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;border:1px solid #c9c6b8;border-radius:10px;background:#f6f3e9;color:#2c302a;box-shadow:0 3px 12px #0002;padding:12px 16px;font-size:14px;line-height:1.45}
#app .setup-head{display:flex;gap:12px;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #d8d7c9;flex:none}
#app .setup-head h2{font-size:19px;margin:0;line-height:1.3}#app .setup-paused{color:#53613b;font-size:12px;white-space:nowrap}
#app .setup-body{min-height:0;overflow:auto;padding:12px 2px;margin:8px 0;overscroll-behavior:contain;scrollbar-gutter:stable}
#app .setup-tank-name{font-weight:600;margin:0 0 12px}#app .setup-field{display:grid;grid-template-columns:74px minmax(0,1fr);gap:12px;align-items:center;margin-bottom:12px}#app .setup-field select{width:100%;min-width:0;box-sizing:border-box}
#app .setup-note,#app .setup-status{margin:10px 0;line-height:1.5;font-size:13px;color:#555b4e;overflow-wrap:anywhere}
#app .setup-confirm{display:flex;align-items:flex-start;gap:10px;margin:12px 0;line-height:1.5;font-size:13px}#app .setup-confirm input{flex:none;width:18px;height:18px;margin:3px 0 0;accent-color:#53613b}
#app .setup-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;border-top:1px solid #d8d7c9;padding-top:10px;flex:none;background:#f6f3e9}
#app .setup-button{padding:9px 12px;min-height:44px;border:1px solid #c9c6b8;border-radius:6px;background:#e7eadc!important;color:#53613b!important;line-height:1.4;font-size:13px;box-sizing:border-box}
#app .setup-button.primary{background:#53613b!important;color:#fff!important;border-color:#53613b}
#app .setup-button:disabled{opacity:.48}#app .setup-button:focus-visible,#app .setup-field select:focus-visible{outline:2px solid #2c302a;outline-offset:2px}
@media(max-width:560px){#app .tank-name-menu{left:16px}#app .tank-setup-tray{left:12px;right:12px;bottom:calc(12px + var(--sab));width:auto;max-height:52dvh;padding:12px}#app .setup-field{grid-template-columns:1fr;gap:6px}#app .setup-actions{gap:6px}#app .setup-button{padding:8px 10px}}
@media(max-height:500px) and (orientation:landscape){#app .tank-setup-tray{right:12px;bottom:12px;max-height:calc(100dvh - 24px);width:min(420px,50%)}#app .setup-head{padding-bottom:6px}#app .setup-body{margin:6px 0;padding:6px 2px}#app .setup-field{margin-bottom:8px}}
`;D.head.append(style);
})(window);
