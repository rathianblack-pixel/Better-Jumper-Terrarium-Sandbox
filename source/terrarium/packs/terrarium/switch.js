/* One game; no background showcase game or periodic screenshot encoding. */
(function(root){'use strict';const JT=root.JT;if(!JT||!JT.UI)return;const sp=document.getElementById('splash');if(sp)sp.remove();
const original=JT.UI.moreSheet;JT.UI.moreSheet=function(){const result=original.apply(this,arguments),menu=document.querySelector('#modalBody .menu')||document.getElementById('modalBody');if(menu){const section=document.createElement('div');section.className='msect';const button=document.createElement('button');button.className='mrow';button.textContent='Title screen';button.onclick=()=>{if(JT.app)JT.app.game.save();location.href='index.html'};section.appendChild(button);menu.insertBefore(section,menu.firstChild)}return result};
const ready=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(root.TR_VEIL)root.TR_VEIL.out()}));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();root.JT_COMBINED=true;
})(window);
