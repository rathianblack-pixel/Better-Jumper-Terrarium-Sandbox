/* Fixed modal chrome: headers/footers live outside the scrolling content, never on top of cards. */
(function(root){
 'use strict';const J=root.JT,U=J.UI,D=root.document;
 U.arrangeModalChrome=function(){
  const modal=D.getElementById('modal'),body=D.getElementById('modalBody');if(!modal||!body)return;
  let top=modal.querySelector(':scope > .modal-top-controls'),bottom=modal.querySelector(':scope > .modal-bottom-controls');
  const actions=body.querySelector('.living-actions'),tabs=body.querySelector('.sheet-tabs'),footer=body.querySelector('.bm-actions');
  if(actions||tabs){if(!top){top=D.createElement('div');top.className='modal-top-controls';modal.insertBefore(top,body);}if(actions)top.prepend(actions);if(tabs)top.append(tabs);}
  if(footer){if(!bottom){bottom=D.createElement('div');bottom.className='modal-bottom-controls';modal.append(bottom);}bottom.append(footer);}
 };
 const open=U.openModal;
 U.openModal=function(){
  D.querySelectorAll('#modal > .modal-top-controls,#modal > .modal-bottom-controls').forEach(e=>e.remove());
  const out=open.apply(this,arguments);this.arrangeModalChrome();return out;
 };
 const jumpers=U.jumpersSheet;
 U.jumpersSheet=function(){const out=jumpers.apply(this,arguments);this.arrangeModalChrome();return out;};
 const style=D.createElement('style');style.textContent=`
#app #modal{overflow:hidden;min-height:0;box-sizing:border-box}
#app #modal > .modal-head{flex:0 0 auto;min-width:0}
#app #modal > #modalBody{flex:1 1 auto;min-height:0;min-width:0;overflow:auto;isolation:isolate;background:#f6f3e9!important;overscroll-behavior:contain;scrollbar-gutter:stable;margin-top:10px;margin-bottom:10px;padding:16px 2px 24px!important;box-sizing:border-box}
#app #modal > .modal-top-controls,#app #modal > .modal-bottom-controls{flex:0 0 auto;min-width:0;position:relative;isolation:isolate;background:#f6f3e9!important;box-sizing:border-box}
#app #modal > .modal-top-controls{border-bottom:1px solid #d8d7c9;padding:4px 0 10px}
#app #modal .modal-top-controls .living-actions{position:static!important;margin:0!important;padding:8px 0!important;border:0!important;z-index:auto;background:#f6f3e9!important;min-width:0}
#app #modal .modal-top-controls .sheet-tabs{position:static!important;margin:4px 0 0!important;width:auto;max-width:100%;min-width:0;gap:6px}
#app #modal .modal-top-controls .sheet-tabs button{min-height:40px;padding:8px 12px}
#app #modal .modal-bottom-controls .bm-actions{position:static!important;margin:0!important;padding:12px 2px!important;gap:12px;min-width:0;z-index:auto;background:#f6f3e9!important}
#app #modal .grid{gap:20px;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));align-items:start}
#app #modal .grid > .entry{padding:16px!important;margin:0!important;min-width:0;box-sizing:border-box;background:#f6f3e9!important;border:1px solid #d8d7c9!important;border-radius:8px!important;outline:none!important;overflow-wrap:anywhere}
#app #modal .grid > .entry.bm-native,#app #modal .grid > .entry.v14-native-card{border-color:#7d9160!important}
#app #modal .grid > .entry h4{margin:8px 0!important;line-height:1.4}
#app #modal .grid > .entry p{margin:10px 0!important;line-height:1.5}
#app #modal .grid > .entry canvas{margin:8px auto 12px!important}
#app #modal .grid > .entry .modal-btn{margin-left:0!important;margin-top:6px;margin-bottom:6px}
#app #modal .grid > .entry .traits{margin:12px 0}
#app #modal .grid > .entry .bm-badge{margin-bottom:8px}
#app #modal .bm-grid{gap:12px;margin:12px 0 16px}
#app #modal .bm-pick{box-sizing:border-box;min-width:0;overflow-wrap:anywhere}
#app #modal .bm-pick b{margin-bottom:8px;line-height:1.4}
#app #modal .bm-pick small{line-height:1.5}
#app #modal .form-row{column-gap:12px;row-gap:12px}
#app #modal .form-row > *{min-width:0;max-width:100%;box-sizing:border-box}
#app #modal .sheet-list button,#app #modal .jrow,#app #modal .tkrow{line-height:1.5}
@media(max-width:560px){#app #modal .grid{grid-template-columns:1fr;gap:16px}#app #modal .grid > .entry{padding:14px!important}#app #modal .modal-top-controls{padding-bottom:8px}#app #modal > #modalBody{padding-top:14px!important}}
@media(max-height:500px) and (orientation:landscape){#app #modal .modal-top-controls .living-actions{padding:4px 0!important}#app #modal .modal-top-controls .living-count{width:auto;margin-left:auto}#app #modal .modal-top-controls .sheet-tabs{margin-top:0!important}#app #modal > #modalBody{padding-top:12px!important}}
`;D.head.append(style);
})(window);
