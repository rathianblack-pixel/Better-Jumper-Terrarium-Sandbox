/* Viewport-aware panel sizing. No changes to simulation state or save format. */
(function(root){
'use strict';const J=root.JT,U=J.UI,D=root.document,$=id=>D.getElementById(id);
const guided=()=>J.FirstHome&&U.game&&J.FirstHome.active(U.game);
function measure(){const v=root.visualViewport,h=Math.round(v?.height||innerHeight),w=Math.round(v?.width||innerWidth),top=Math.round(v?.offsetTop||0);const s=D.documentElement.style;s.setProperty('--ui-h',h+'px');s.setProperty('--ui-w',w+'px');s.setProperty('--ui-top',top+'px');D.body.classList.toggle('fj-short',h<600);D.body.classList.toggle('fj-wide',w>=1000&&h>=600);D.body.classList.toggle('fj-narrow',w<1000&&h>=600);if(U.game)U.syncDrawerSpace();}
function labelExpand(){const b=$('fjExpand');if(!b)return;const on=$('drawer').classList.contains('fj-expanded');b.textContent=on?'Compact':'Expand';b.setAttribute('aria-label',on?'Compact panel':'Expand panel');b.setAttribute('aria-expanded',String(on));}
function decorate(){const d=$('drawer');if(guided()||d.classList.contains('hidden'))return;D.body.classList.add('fj-fluid');$('drawerTitle').textContent=U.tab==='food'?'Care for this home':'Build your home';if(!$('fjExpand')){const b=D.createElement('button');b.id='fjExpand';b.className='txt';b.type='button';b.onclick=()=>{d.classList.toggle('fj-expanded');labelExpand();U.syncDrawerSpace();};$('drawerClose').before(b);}labelExpand();measure();}
const init=U.init;U.init=function(){const out=init.apply(this,arguments);D.body.classList.add('fj-fluid');measure();root.addEventListener('resize',measure);root.visualViewport?.addEventListener('resize',measure);root.visualViewport?.addEventListener('scroll',measure);return out;};
const open=U.openDrawer;U.openDrawer=function(){const d=$('drawer');d.querySelector('.fj-actions-footer')?.remove();d.classList.remove('fj-meal');const out=open.apply(this,arguments);decorate();return out;};
const close=U.closeDrawer;U.closeDrawer=function(){const out=close.apply(this,arguments);$('drawer').classList.remove('fj-expanded');return out;};
const care=U.fieldCare;U.fieldCare=function(){const d=$('drawer');d.querySelector('.fj-actions-footer')?.remove();d.classList.remove('fj-meal');const out=care.apply(this,arguments);const actions=d.querySelector('.fj-care-actions');if(actions){const footer=D.createElement('div');footer.className='fj-actions-footer';footer.append(actions);d.append(footer);}decorate();return out;};
const meal=U.fieldMeal;U.fieldMeal=function(){const d=$('drawer');d.querySelector('.fj-actions-footer')?.remove();d.classList.add('fj-meal');const out=meal.apply(this,arguments);const submit=d.querySelector('#drawerBody>.fj-button.primary');if(submit){const footer=D.createElement('div');footer.className='fj-actions-footer';footer.append(submit);d.append(footer);}decorate();return out;};
const modal=U.openModal;U.openModal=function(title,body,opts){const out=modal.apply(this,arguments);$('modal').dataset.fluidKind=opts?.sheet||(/Settings/.test(title)?'settings':'standard');measure();return out;};
const css=D.createElement('style');css.textContent=`
/* One fluid sizing system; the legacy decoration remains, not its fixed widths. */
body.fj-fluid{--panel-gap:24px;--panel-top:80px;--panel-bottom:calc(108px + var(--sab,0px));--edge-left:max(var(--panel-gap),env(safe-area-inset-left,0px));--edge-right:max(var(--panel-gap),env(safe-area-inset-right,0px));--modal-gap:24px;--modal-top:max(var(--modal-gap),var(--sat,0px));--modal-bottom:max(var(--modal-gap),var(--sab,0px));--modal-h:calc(var(--ui-h,100dvh) - var(--modal-top) - var(--modal-bottom));--panel-width:clamp(480px,40vw,840px)}
body.fj-fluid #app #drawer.fj-build,body.fj-fluid #app #drawer.fj-care{position:fixed!important;left:var(--edge-left)!important;right:auto!important;top:calc(var(--ui-top,0px) + var(--panel-top))!important;bottom:auto!important;width:var(--panel-width)!important;height:min(960px,calc(var(--ui-h,100dvh) - var(--panel-top) - var(--panel-bottom)))!important;max-height:min(960px,calc(var(--ui-h,100dvh) - var(--panel-top) - var(--panel-bottom)))!important;min-height:0!important;max-width:calc(var(--ui-w,100vw) - var(--edge-left) - var(--edge-right))!important;padding:20px!important;transform:none!important;display:flex;flex-direction:column;gap:0;overflow:hidden!important}
body.fj-fluid #app #drawer.hidden{display:none!important}
body.fj-fluid #app #drawer .drawer-head{display:grid!important;grid-template-columns:1fr auto auto auto!important;gap:8px!important;align-items:center;flex:none!important;margin:0!important;padding:0 0 12px!important;min-width:0}
body.fj-fluid #app #drawer #drawerTitle{display:block!important;grid-row:1;grid-column:1;order:0;min-width:0;margin:0!important;width:auto!important;flex:none!important;font:600 20px/1.3 system-ui!important;color:#35422e!important;overflow-wrap:anywhere}
body.fj-fluid #app #drawer #drawerUndo{grid-row:1;grid-column:2;display:flex!important;margin:0!important}
body.fj-fluid #app #drawer.fj-care #drawerUndo{display:none!important}
body.fj-fluid #app #drawer #fjExpand{grid-row:1;grid-column:3;min-height:44px;min-width:60px;font-size:14px}
body.fj-fluid #app #drawer #drawerClose{grid-row:1;grid-column:4;min-width:44px;min-height:44px;margin:0!important}
body.fj-fluid #app #drawer #drawerTabs{grid-row:2;grid-column:1/-1;order:0;display:flex!important;flex-wrap:wrap!important;gap:6px!important;overflow:visible!important;min-width:0;width:100%;flex:none!important;padding:0!important}
body.fj-fluid #app #drawer #drawerTabs button{flex:1 1 auto!important;white-space:normal!important;min-height:44px!important;padding:8px 12px!important;min-width:0!important}
body.fj-fluid #app #drawer .chips{display:none!important}
body.fj-fluid #app #drawer .bm-controls{flex:0 0 auto!important;display:flex!important;flex-wrap:wrap!important;gap:8px!important;margin:12px 0!important;min-width:0}
body.fj-fluid #app #drawer .bm-controls input{flex:1 1 180px!important;min-width:120px!important;width:auto!important;max-width:100%!important;min-height:44px!important;box-sizing:border-box}
body.fj-fluid #app #drawer .bm-controls button{flex:0 0 auto;min-height:44px!important;padding:8px 12px!important;white-space:normal!important}
body.fj-fluid #app #drawer #drawerBody{flex:1 1 0%!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;padding:16px 2px!important;scrollbar-gutter:stable;box-sizing:border-box;scroll-padding:16px}
body.fj-fluid #app #drawer.fj-build #drawerBody{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(132px,1fr))!important;gap:16px!important;align-content:start!important}
body.fj-fluid #app #drawer.fj-care #drawerBody{display:block!important}
body.fj-fluid #app .fj-food-grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr))!important;gap:16px}
body.fj-fluid #app #drawer .card{height:auto!important;min-width:0;overflow-wrap:anywhere;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;padding:12px!important}
body.fj-fluid #app #drawer .card canvas{flex:0 0 auto;width:96px!important;height:96px!important;max-width:100%;margin:0 auto 12px!important;object-fit:contain}
body.fj-fluid #app #drawer .card .nm{font-size:16px!important;line-height:1.4!important;margin:0 0 6px!important;min-height:0!important}
body.fj-fluid #app #drawer .card .pr{display:block!important;font-size:14px!important;line-height:1.4!important;margin:0!important;min-height:0!important}
body.fj-fluid #app #drawer .sect{display:block!important;grid-column:1/-1!important;padding:8px 0!important;min-height:30px!important;line-height:1.4!important;margin:0!important}
body.fj-fluid #app #drawer [hidden]{display:none!important}
body.fj-fluid #app .fj-actions-footer{flex:0 0 auto;padding:12px 0 0;border-top:1px solid #d4d8c8;background:var(--fj-cream);min-width:0}
body.fj-fluid #app .fj-actions-footer>.fj-button{width:100%}
body.fj-fluid #app #drawer .fj-intro h3{font-size:28px;margin:8px 0 16px}
body.fj-fluid #app #drawer .fj-stats{font-size:16px;grid-template-columns:minmax(90px,1fr) minmax(0,1fr)}
body.fj-fluid #app #drawer .fj-stats dd{overflow-wrap:anywhere}
body.fj-fluid #app #drawer.fj-expanded{left:var(--edge-left)!important;width:min(1120px,calc(var(--ui-w,100vw) - var(--edge-left) - var(--edge-right)))!important}
body.fj-fluid:not(.fj-short) #app #drawer.fj-care:not(.fj-expanded){height:min(720px,calc(var(--ui-h,100dvh) - var(--panel-top) - var(--panel-bottom)))!important}
/* Dialogs: generous at desktop sizes, bounded to the visual viewport. */
body.fj-fluid #app #modalWrap{position:fixed!important;inset:auto!important;left:0!important;top:var(--ui-top,0px)!important;width:var(--ui-w,100vw)!important;height:var(--ui-h,100dvh)!important;box-sizing:border-box;padding:var(--modal-top) max(var(--modal-gap),env(safe-area-inset-right,0px)) var(--modal-bottom) max(var(--modal-gap),env(safe-area-inset-left,0px))!important;align-items:center!important;justify-content:center!important;overflow:hidden!important}
body.fj-fluid #app #modal{width:min(960px,calc(var(--ui-w,100vw) - 48px))!important;max-width:100%!important;min-height:min(560px,var(--modal-h))!important;max-height:var(--modal-h)!important;box-sizing:border-box;padding:24px 28px 8px!important;display:flex;flex-direction:column;overflow:hidden!important;min-width:0}
body.fj-fluid #app #modal[data-fluid-kind=jumpers],body.fj-fluid #app #modal[data-fluid-kind=journal],body.fj-fluid #app #modal[data-fluid-kind=menu],body.fj-fluid #app #modal[data-fluid-kind=settings]{width:min(1280px,86vw)!important;min-height:min(640px,var(--modal-h))!important}
body.fj-fluid #app #modal>#modalBody{flex:1 1 auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;padding:20px 4px!important;margin:12px 0!important;min-width:0;overflow-wrap:anywhere}
body.fj-fluid #app #modal>.modal-head,body.fj-fluid #app #modal>.modal-top-controls,body.fj-fluid #app #modal>.modal-bottom-controls{flex:0 0 auto!important;min-width:0}
body.fj-fluid #app #modal .modal-head{padding-bottom:12px!important;align-items:center}
body.fj-fluid #app #modal .modal-head h2{min-width:0;overflow-wrap:anywhere}
body.fj-fluid #app #modal .modal-head button{min-height:44px;min-width:44px}
body.fj-fluid #app #modal .grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))!important;gap:20px!important}
body.fj-fluid #app #modal .sheet-tabs{display:flex!important;flex-wrap:wrap!important;min-width:0;gap:8px!important}
body.fj-fluid #app #modal .sheet-tabs button{flex:1 1 0!important;min-width:0!important;min-height:44px!important;padding:8px 12px!important;white-space:normal}
body.fj-fluid #app #modal .jrow{min-width:0;overflow-wrap:anywhere}
body.fj-fluid #app #modal .menu{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:32px!important}
body.fj-fluid #app #modal .msect,body.fj-fluid #app #modal .form-row{min-width:0}
body.fj-fluid #app #modal button,body.fj-fluid #app #modal select{max-width:100%;box-sizing:border-box;overflow-wrap:anywhere}
body.fj-fluid #app #modeBar{max-width:calc(var(--ui-w,100vw) - 24px)!important;box-sizing:border-box}
body.fj-fluid #app #obsHud{max-width:calc(var(--ui-w,100vw) - 24px)!important}
/* Narrow/tablet windows: taller sheets, with an explicit full-height option. */
body.fj-fluid.fj-narrow{--panel-gap:12px;--panel-bottom:calc(100px + var(--sab,0px));--panel-top:max(70px,calc(var(--ui-h,100dvh)*.14));--panel-width:min(880px,calc(var(--ui-w,100vw) - var(--edge-left) - var(--edge-right)))}
body.fj-fluid.fj-narrow #app #drawer.fj-build,body.fj-fluid.fj-narrow #app #drawer.fj-care{left:max(var(--edge-left),calc((var(--ui-w,100vw) - var(--panel-width))/2))!important;transform:none!important;padding:16px!important}
body.fj-fluid.fj-narrow #app #drawer.fj-expanded{top:calc(var(--ui-top,0px) + 12px + var(--sat))!important;height:calc(var(--ui-h,100dvh) - 112px - var(--sat) - var(--sab))!important;max-height:calc(var(--ui-h,100dvh) - 112px - var(--sat) - var(--sab))!important;width:var(--panel-width)!important}
@media(max-width:599px){
body.fj-fluid{--modal-gap:12px}
body.fj-fluid #app #modal{width:100%!important;min-height:min(640px,var(--modal-h))!important;max-height:var(--modal-h)!important;padding:16px 16px 4px!important}
body.fj-fluid #app #modal[data-fluid-kind]{width:100%!important;max-height:var(--modal-h)!important}
body.fj-fluid #app #modal .grid{grid-template-columns:1fr!important}
body.fj-fluid #app #modal .menu{grid-template-columns:1fr!important;gap:24px!important}
body.fj-fluid #app #drawer #drawerUndo{display:none!important}
body.fj-fluid #app #drawer #drawerTitle{font-size:18px!important}
body.fj-fluid #app #drawer #drawerTabs{gap:4px!important}
body.fj-fluid #app #drawer.fj-build #drawerTabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}
body.fj-fluid #app #drawer #drawerTabs button{font-size:14px!important;padding:8px 3px!important}
body.fj-fluid #app #drawer .bm-controls input{flex-basis:100%!important}
body.fj-fluid #app #drawer.fj-build #drawerBody,body.fj-fluid #app .fj-food-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}
body.fj-fluid #app #drawer .card{padding:10px!important}
body.fj-fluid #app #drawer .card .nm{font-size:14px!important}
body.fj-fluid #app #drawer .card canvas{width:80px!important;height:80px!important;margin-bottom:8px!important}
body.fj-fluid #app #drawer .fj-intro h3{font-size:24px!important}
body.fj-fluid #app #drawer .fj-stats{font-size:14px!important}
}
/* Short windows, phone landscape and a reduced visual viewport from a keyboard. */
body.fj-fluid.fj-short{--panel-gap:12px;--panel-top:56px;--panel-bottom:calc(78px + var(--sab,0px));--panel-width:calc(var(--ui-w,100vw) - var(--edge-left) - var(--edge-right))}
body.fj-fluid.fj-short #app #drawer.fj-build,body.fj-fluid.fj-short #app #drawer.fj-care{padding:12px!important;width:var(--panel-width)!important;left:var(--edge-left)!important;transform:none!important}
body.fj-fluid.fj-short #app #drawer .drawer-head{display:flex!important;flex-wrap:nowrap!important;gap:8px!important;padding:0 0 8px!important}
body.fj-fluid.fj-short #app #drawer #drawerTitle,body.fj-fluid.fj-short #app #drawer #drawerUndo,body.fj-fluid.fj-short #app #drawer #fjExpand{display:none!important}
body.fj-fluid.fj-short #app #drawer #drawerTabs{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;flex:1 1 0!important;scrollbar-width:thin;grid-column:auto;min-width:0;gap:4px!important}
body.fj-fluid.fj-short #app #drawer #drawerTabs button{flex:0 0 auto!important;white-space:nowrap!important;padding:8px 12px!important}
body.fj-fluid.fj-short #app #drawer #drawerClose{flex:0 0 44px!important}
body.fj-fluid.fj-short #app #drawer .bm-controls{flex-wrap:nowrap!important;margin:8px 0!important;gap:8px!important}
body.fj-fluid.fj-short #app #drawer .bm-controls input{flex:1 1 100px!important;min-width:80px!important}
body.fj-fluid.fj-short #app #drawer .bm-controls button{padding:8px!important}
body.fj-fluid.fj-short #app #drawer #drawerBody{padding:8px 2px!important}
body.fj-fluid.fj-short #app #drawer.fj-build #drawerBody,body.fj-fluid.fj-short #app .fj-food-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))!important;gap:12px!important}
body.fj-fluid.fj-short #app #drawer .card canvas{width:56px!important;height:56px!important;margin-bottom:6px!important}
body.fj-fluid.fj-short #app #drawer .card .nm{font-size:14px!important}
body.fj-fluid.fj-short #app #drawer .fj-intro{display:none!important}
body.fj-fluid.fj-short #app .fj-actions-footer{padding-top:8px}
body.fj-fluid.fj-short #app #drawer.fj-expanded{top:calc(var(--ui-top,0px) + 12px)!important;height:calc(var(--ui-h,100dvh) - 90px)!important;max-height:calc(var(--ui-h,100dvh) - 90px)!important}
body.fj-fluid.fj-short{--modal-gap:8px}
body.fj-fluid.fj-short #app #modal[data-fluid-kind],body.fj-fluid.fj-short #app #modal{width:100%!important;min-height:var(--modal-h)!important;max-height:var(--modal-h)!important;padding:12px 16px 4px!important}
body.fj-fluid.fj-short #app #modal .modal-head{padding:0 0 8px!important}
body.fj-fluid.fj-short #app #modal>.modal-top-controls{padding:4px 0!important}
body.fj-fluid.fj-short #app #modal>#modalBody{padding:8px 2px!important;margin:8px 0!important}
body.fj-fluid.fj-short #app #modal .grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))!important}
body.fj-fluid.fj-short #app #toasts{display:none!important}
@media(max-width:599px) and (orientation:portrait){body.fj-fluid.fj-short #app #drawer .bm-controls{flex-wrap:wrap!important}body.fj-fluid.fj-short #app #drawer .bm-controls input{flex-basis:100%!important}body.fj-fluid.fj-short #app #drawer .bm-controls button{flex:1 1 0!important;min-width:0!important;padding:8px 4px!important}}
body.fj-fluid.fj-short #app #drawer.fj-meal #drawerBody{display:grid!important;grid-template-columns:max-content minmax(0,1fr);gap:6px 12px!important;align-content:start;align-items:center}
body.fj-fluid.fj-short #app #drawer.fj-meal #drawerBody>canvas{display:none!important}
body.fj-fluid.fj-short #app #drawer.fj-meal #drawerBody>button{grid-row:1;grid-column:1;min-height:44px}
body.fj-fluid.fj-short #app #drawer.fj-meal .fj-meal-title{grid-row:1;grid-column:2;font-size:22px!important;margin:0!important}
body.fj-fluid.fj-short #app #drawer.fj-meal .fj-quantity{grid-row:2;grid-column:1/-1;margin:0!important}
body.fj-fluid.fj-short #app #drawer.fj-meal .fj-note{grid-column:1/-1;margin:0!important}
@media(min-width:500px){
body.fj-fluid.fj-short #app #drawer.fj-meal #drawerBody{grid-template-columns:max-content minmax(0,1fr) 160px}
body.fj-fluid.fj-short #app #drawer.fj-meal .fj-quantity{grid-row:1/4;grid-column:3;display:flex;flex-direction:column;gap:4px;align-items:stretch}
body.fj-fluid.fj-short #app #drawer.fj-meal .fj-note{grid-column:1/3}
}
@media(max-height:360px){
body.fj-fluid.fj-short{--panel-top:8px}
body.fj-fluid.fj-short #app #drawer.fj-build #drawerBody,body.fj-fluid.fj-short #app .fj-food-grid{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))!important}
body.fj-fluid.fj-short #app #drawer .card{display:grid!important;grid-template-columns:44px minmax(0,1fr);column-gap:8px;align-items:center;padding:8px!important}
body.fj-fluid.fj-short #app #drawer .card canvas{grid-column:1;grid-row:1/3;width:44px!important;height:44px!important;margin:0!important}
body.fj-fluid.fj-short #app #drawer .card .nm{grid-column:2;grid-row:1;margin:0!important;line-height:1.3!important}
body.fj-fluid.fj-short #app #drawer .card .pr{grid-column:2;grid-row:2;line-height:1.3!important}
}
@media(min-width:1600px){body.fj-fluid #app #drawer .bm-controls input,body.fj-fluid #app #drawer #drawerTabs button{font-size:16px!important}}
`;D.head.append(css);
})(window);
