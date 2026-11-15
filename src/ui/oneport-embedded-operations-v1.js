/* Existing operations page mounted inside the one-port application.
   Hide only untargeted top-level sections; do not remove or rewrite original nodes. */
(()=>{'use strict';
 const allowed=new Set(['fi-purchase-demand','fi-fleet-buyer',
 'fi-bid-readiness','fi-commercial-fit','fi-procurement',
 'fi-fleet-opportunities','fi-regulatory-intelligence']);
 const main=document.querySelector('main');
 if(!main)return;
 function render(){
  const target=decodeURIComponent(location.hash.slice(1));
  if(!allowed.has(target)){
   document.body.classList.remove('fi-ops-target');
   for(const el of main.children){delete el.dataset.fiOpsHidden;delete el.dataset.fiOpsVisible}
   return
  }
  const panel=document.getElementById(target);
  if(!panel||!main.contains(panel))return;
  document.body.classList.add('fi-ops-target');
  for(const el of main.children){
   if(el===panel||el.contains(panel)){
    el.dataset.fiOpsVisible='true';delete el.dataset.fiOpsHidden;
   }else{
    el.dataset.fiOpsHidden='true';delete el.dataset.fiOpsVisible
   }
  }
  panel.scrollIntoView({block:'start',behavior:'instant'});
 }
 window.addEventListener('hashchange',render);
 render()
})();
