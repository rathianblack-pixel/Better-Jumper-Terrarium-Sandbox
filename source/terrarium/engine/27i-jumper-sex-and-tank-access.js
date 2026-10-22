/* Individual sex identity, explicit legacy choices, and a single tank-setup entry point.
   Identity is ordinary save data; appearance is derived, never applied to shared species definitions. */
(function(root){
 'use strict';const J=root.JT,U=J.UI,D=root.document;
 const valid=sex=>sex==='male'||sex==='female';
 const growth=sp=>[0,.06,.18,.4,.7,1][Math.max(0,Math.min(5,sp.stage==null?5:sp.stage|0))];
 const cache=new Map();
 const X=J.Sex={valid,growth,label:sp=>valid(sp.sex)?sp.sex==='male'?'Male':'Female':'Sex not chosen'};
 X.look=function(S,sp){
  if(!valid(sp.sex))return S.look||{}; // Legacy residents keep their old appearance until chosen.
  const key=S.id+'|'+sp.sex+'|'+(sp.stage==null?5:sp.stage);if(cache.has(key))return cache.get(key);
  const ant=!!S.antShape,k=growth(sp),male=sp.sex==='male',look=Object.assign({},S.look||{});
  // Ant mimics retain their narrow original body; magnolia and Portia keep their characteristic build.
  const scale=(name,f)=>{look[name]=(ant&&['aL','aW','aH','cL','cW','cH'].includes(name)?1:look[name]||1)*f;};
  if(male){
   scale('front',1+(ant?.2:S.id==='magnolia'?.25:.38)*k);
   look.frontW=(look.frontW||1.3)*(1+(ant?.2:.36)*k);
   scale('cL',1+.09*k);scale('cW',1+(ant?.07:.19)*k);scale('cH',1+.1*k);
   scale('aL',1+(ant?.12:.2)*k);scale('aW',1-(ant?.13:.3)*k);scale('aH',1-.18*k);
   scale('chel',1+(ant?.65:S.id==='zebra'?.55:.4)*k);look.palpSize=1+.65*k;look.fang=.4+.65*k;
  }else{
   scale('aW',1+.04*k);scale('aH',1+.03*k);
   if(S.id==='imperial')look.tufts=null;
   if(look.palp==='flag')look.palp='plain';
  }
  cache.set(key,look);return look;
 };
 X.species=function(S,sp){
  if(!valid(sp.sex))return S;
  const maleAdult=sp.sex==='male'&&growth(sp)>=1;
  // Suppress adult male-only fan/colour ornamentation on females and immature males.
  if((S.pattern==='peacock'||S.fan)&&!maleAdult)return Object.assign({},S,{fan:null,pattern:'graywall',pal:Object.assign({},S.pal,{abd:'#806b52',mark:'#b6a081',ceph:'#66543f'})});
  if(S.id==='regal'&&maleAdult)return Object.assign({},S,{pal:Object.assign({},S.pal,{ceph:'#202022',abd:'#202022',leg:'#272729',mark:'#e9e5dc',hair:'#a09b92'})});
  if(S.id==='paradise'&&!maleAdult)return Object.assign({},S,{pal:Object.assign({},S.pal,{chel:'#76634b'})});
  return S;
 };
 const el=(tag,cls,text)=>{const e=D.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
 const button=(text,id,fn)=>{const b=el('button','modal-btn',text);b.type='button';if(id)b.id=id;b.onclick=fn;return b;};
 const clone=c=>{const out=el('canvas');out.width=c.width;out.height=c.height;out.getContext('2d').drawImage(c,0,0);return out;};
 U.chooseJumperSex=function(sid,opts){
  opts=opts||{};let sex=null,stage=opts.individual?.stage??1;const w=el('div','sex-picker'),S=J.SPECIES_BY_ID[sid];
  w.append(el('p','muted',opts.individual?`Choose once for ${opts.individual.name}. Their progress, personality and home stay unchanged.`:`${S.name} · Choose female or male before adding this sling.`));
  const group=el('div','sex-options');group.setAttribute('role','group');group.setAttribute('aria-label','Jumper sex');
  const preview=el('div','sex-preview');preview.setAttribute('aria-live','polite');
  const stageButton=button('Preview adult','sexPreviewStage',()=>{stage=stage===5?(opts.individual?.stage??1):5;stageButton.textContent=stage===5?'Preview current stage':'Preview adult';draw();});
  const status=el('p','muted','Select female or male to preview.');
  const submit=button(opts.individual?'Save choice':'Add to tank','sexConfirm',()=>{if(!valid(sex))return;opts.onConfirm(sex);});submit.disabled=true;
  const draw=()=>{preview.replaceChildren();if(sex){const cv=clone(this.R.speciesPortrait(sid,240,sex,stage));cv.setAttribute('role','img');cv.setAttribute('aria-label',`${sex} ${S.name}, ${J.STAGES[stage]}`);preview.append(cv);status.textContent=(sex==='male'?'Male':'Female')+' · '+J.STAGES[stage]+(stage<5?' · Differences develop with each molt.':' · Adult proportions');}for(const b of group.children)b.setAttribute('aria-pressed',String(b.dataset.sex===sex));};
  for(const value of ['female','male']){const b=button(value==='female'?'Female':'Male','sex-'+value,()=>{sex=value;submit.disabled=false;draw();});b.dataset.sex=value;b.setAttribute('aria-pressed','false');group.append(b);}
  w.append(group,preview,status,stageButton,el('p','muted','Visual identity only: no breeding, stat bonuses or new care requirements.'));
  const actions=el('div','sex-actions');actions.append(button(opts.individual?'Choose later':'Cancel','sexCancel',()=>{this.closeModal();opts.onCancel?.();}),submit);w.append(actions);
  this.openModal(opts.individual?'Choose jumper sex':'Meet your jumper',w,{back:opts.onCancel||null});group.firstChild.focus();
 };
 U.pendingSexChoices=function(){return this.game.habs.flatMap(h=>h.spiders).concat(this.game.state.cup||[]).filter(sp=>!valid(sp.sex));};
 U.chooseExistingSex=function(individual){
  const sp=individual||this.pendingSexChoices()[0];if(!sp)return false;
  this.chooseJumperSex(sp.species,{individual:sp,onConfirm:sex=>{
   // Guard against a stale dialog, and never overwrite an earlier confirmed choice.
   if(!this.pendingSexChoices().includes(sp)){this.closeModal();return;}
   if(J.Replay){if(J.Replay.active)J.Replay.stop();J.Replay.buf=[];}sp.sex=sex;delete sp._rig;this.game.save();this.R.resetCaches();
   this.closeModal();this.refreshHeader();if(this.pendingSexChoices().length)this.chooseExistingSex();else this.toast('Choices saved. Your jumpers and progress are kept.');
  },onCancel:()=>this.jumpersSheet('tank')});return true;
 };
 const profile=U.profileModal;U.profileModal=function(sp){const result=profile.apply(this,arguments);if(sp&&!valid(sp.sex)){const w=D.querySelector('#modalBody .prof');if(w)w.prepend(button('Choose female or male (one-time)','profileSexChoice',()=>this.chooseExistingSex(sp)));}return result;};
 const jumpers=U.jumpersSheet;U.jumpersSheet=function(){const out=jumpers.apply(this,arguments);if(J.FirstHome?.active(this.game))return out;
  const w=D.getElementById('modalBody');if(w&&!D.getElementById('quickTankSetup')){const row=el('div','sex-actions');row.append(button('Tank Setup','quickTankSetup',()=>this.beginTankSetup()),button('Switch tank','quickSwitchTank',()=>this.tanksModal()));const pending=this.pendingSexChoices();if(pending.length)row.append(button(`Choose sex · ${pending.length} remaining`,'legacySexChoices',()=>this.chooseExistingSex()));w.prepend(row);}return out;};
 const build=U.fieldBuild;U.fieldBuild=function(){const out=build.apply(this,arguments);if(!J.FirstHome?.active(this.game)){const tabs=D.getElementById('drawerTabs');if(!D.getElementById('buildTankSetup'))tabs.append(button('Tank Setup','buildTankSetup',()=>this.beginTankSetup()));}return out;};
 // Tap the tank name directly; switching and resident lists remain available in their own screens.
 const init=U.init;U.init=function(){const out=init.apply(this,arguments),b=D.getElementById('jumperControl');b.onclick=()=>this.beginTankSetup();b.setAttribute('aria-label','Tank Setup for '+this.hab.title);b.setAttribute('aria-haspopup','dialog');
  setTimeout(()=>{if(!J.FirstHome?.active(this.game)&&this.pendingSexChoices().length&&!this.tankSetup)this.chooseExistingSex();},200);return out;};
 const refresh=U.refreshHeader;U.refreshHeader=function(){const out=refresh.apply(this,arguments);const b=D.getElementById('jumperControl');if(b&&this.game)b.setAttribute('aria-label','Tank Setup for '+this.hab.title);return out;};
 const imported=J.Game.prototype.importSave;J.Game.prototype.importSave=function(){const ok=imported.apply(this,arguments);if(ok&&U.game===this)setTimeout(()=>{if(!J.FirstHome?.active(this)&&U.pendingSexChoices().length)U.chooseExistingSex();},100);return ok;};
 // Resuming an old first-home setup must request sex before spawning, including Skip setup.
 const FH=J.FirstHome,arrival=FH.addSheet,finish=FH.finishSetup;
 FH.addSheet=function(){const s=this.data(U.game);if(!valid(s.sex))return U.chooseJumperSex(s.sid,{onConfirm:sex=>{s.sex=sex;this.save();arrival.call(this);},onCancel:()=>this.render()});return arrival.apply(this,arguments);};
 FH.finishSetup=function(){const s=this.data(U.game);if(!valid(s.sex))return U.chooseJumperSex(s.sid,{onConfirm:sex=>{s.sex=sex;this.save();finish.call(this);},onCancel:()=>this.render()});return finish.apply(this,arguments);};
 const complete=FH.complete;FH.complete=function(){const result=complete.apply(this,arguments);if(U.pendingSexChoices().length)setTimeout(()=>U.chooseExistingSex(),100);return result;};
 const style=el('style');style.textContent=`
#app .sex-options,#app .sex-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
#app .sex-options button{flex:1;border:1px solid #b8bca9;border-radius:8px;min-height:44px;padding:10px 16px}
#app .sex-options button[aria-pressed=true]{background:#405d3c!important;color:#fff!important;border-color:#405d3c}
#app .sex-preview{display:flex;align-items:center;justify-content:center;min-height:120px;background:#e9e9df;border-radius:12px}
#app .sex-preview:empty{display:none}#app .sex-preview canvas{width:200px;max-width:100%;height:auto}
#app .sex-picker{max-width:550px;margin:auto}#app .sex-picker p{line-height:1.5}
#app #sexConfirm:not(:disabled){background:#405d3c;color:#fff;border-radius:8px;padding:8px 16px}
#app .setup-backgrounds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#app .setup-background{display:flex;flex-direction:column;gap:6px;align-items:stretch;text-align:center;min-width:0;padding:6px;border:1px solid #bfc3b3;border-radius:8px;font:13px/1.3 system-ui;color:#2c302a}
#app .setup-background[aria-pressed=true]{outline:2px solid #405d3c;outline-offset:1px}
#app .setup-swatch{height:38px;border-radius:4px;display:block;flex:none}
#app .setup-background:focus-visible,#app .sex-options button:focus-visible{outline:3px solid #3d6a95;outline-offset:2px}
#app #buildTankSetup{font-weight:600;flex:none;white-space:nowrap}
#app .setup-body h3{font:600 15px/1.4 system-ui;margin:12px 0 6px}
`;D.head.append(style);
})(typeof window!=='undefined'?window:globalThis);
