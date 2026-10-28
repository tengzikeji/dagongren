const cloudPath='<path d="M9 26h14a7 7 0 0 0 1-13.9A9 9 0 0 0 6.3 12 7.1 7.1 0 0 0 9 26Z"/>';
const shapes={syncing:'<circle class="sync-ring-track" cx="12" cy="12" r="8"/><path class="sync-ring-arc" d="M12 4a8 8 0 0 1 8 8"/>',success:'<path class="sync-result-stroke" d="m5 12 4.5 4.5L19 7"/>',error:'<path class="sync-result-stroke" d="m6 6 12 12M18 6 6 18"/>',attention:'<path d="M12 5v9M12 18h.01"/>'};
export function syncBadgeMarkup(state){return shapes[state]?'<svg class="'+(state==='syncing'?'sync-spinner':'sync-result')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+shapes[state]+'</svg>':'';}
export function cloudButtonMarkup(feedback={state:'idle'}){
 const state=feedback.state||'idle',source=feedback.source||'auto';
 return '<span class="cloud-icon"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+cloudPath+'</svg><span class="cloud-sync-badge" data-state="'+state+'" data-source="'+source+'" data-revision="'+(feedback.revision||0)+'">'+syncBadgeMarkup(state)+'</span></span><span class="cloud-label">云同步</span>';
}
let lastCloudEvent='';
export function updateCloudFeedback(root,feedback,description=''){
 const state=feedback.state||'idle',source=feedback.source||'auto',revision=String(feedback.revision||0),event=revision+':'+state+':'+source;
 const buttons=[...(root?.querySelectorAll?.('.sync-cloud-button')||[])].filter(button=>!button.closest?.('.page-swipe-preload,.page-swipe-layer'));
 const animateResult=event!==lastCloudEvent&&Number(revision)>0&&['success','error'].includes(state)&&
  (source==='pull'||!document.body.classList?.contains('motion-off'))&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 for(const button of buttons){
  const badge=button.querySelector('.cloud-sync-badge');button.dataset.syncState=state;button.dataset.syncSource=source;button.setAttribute('aria-busy',String(state==='syncing'));
  button.setAttribute('aria-label','云同步：'+(feedback.message||description||'点击配置')+'；点击查看设置与同步');
  if(badge){
   if(badge.dataset.state!==state||badge.dataset.revision!==revision){badge.innerHTML=syncBadgeMarkup(state);badge.dataset.revision=revision;}
   badge.dataset.state=state;badge.dataset.source=source;
   // Result motion belongs to a sync event, never to a render or navigation.
   // WAAPI preserves the running effect when renderStable retains these SVG nodes.
   if(animateResult){
    badge.querySelector('.sync-result-stroke')?.animate?.([{strokeDasharray:'36',strokeDashoffset:'36'},{strokeDasharray:'36',strokeDashoffset:'0'}],{duration:380,easing:'ease-out'});
    badge.querySelector('.sync-result')?.animate?.([{transform:'scale(.72)',opacity:.45},{transform:'scale(1)',opacity:1}],{duration:320,easing:'ease-out'});
   }
  }
 }
 if(buttons.length)lastCloudEvent=event;
}
export function pullProgress(distance){return Math.max(0,Math.min(1,distance/84));}
export function pullOffset(distance){return Math.min(112,Math.max(0,distance)*.62);}
export function bindPullRefresh(root,api){
 if(!root?.addEventListener||!document.body?.appendChild)return null;
 const indicator=document.createElement('div');indicator.className='pull-refresh';indicator.dataset.state='hidden';indicator.dataset.source='pull';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');indicator.hidden=true;
 indicator.innerHTML='<span class="pull-refresh-symbol"></span><span class="pull-refresh-label"></span>';document.body.appendChild(indicator);
 const symbol=indicator.querySelector('.pull-refresh-symbol'),label=indicator.querySelector('.pull-refresh-label');
 let gesture=null,pulled=null,refreshing=false,rebounding=false,animation=null,frame=0,hideTimer=0,blockedUntil=0,generation=0;
 const cancelFrame=()=>{if(frame)cancelAnimationFrame(frame);frame=0;};
 function show(state,text){clearTimeout(hideTimer);indicator.hidden=false;indicator.dataset.state=state;symbol.innerHTML=syncBadgeMarkup(state==='pulling'||state==='armed'?'syncing':state);symbol.style.transform='';label.textContent=text;}
 function hide(){clearTimeout(hideTimer);indicator.dataset.state='hidden';hideTimer=setTimeout(()=>{indicator.hidden=true;},200);}
 function restore(){if(pulled){pulled.node.style.transform=pulled.transform;pulled.node.style.willChange=pulled.willChange;pulled=null;}root.classList.remove('pull-dragging');}
 function reset(){const active=Boolean(gesture?.active||rebounding);generation++;gesture=null;rebounding=false;refreshing=false;cancelFrame();animation?.cancel();animation=null;restore();hide();if(active)api.onEnd?.();}
 async function refresh(){
  if(refreshing)return;refreshing=true;const token=++generation;show('syncing','正在同步');indicator.style.setProperty('--pull-y','16px');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  let result;try{result=await api.refresh();}catch{result={state:'error',message:'同步失败，本机记录已保留'};}
  if(token!==generation)return;refreshing=false;
  const state=['success','error','attention'].includes(result?.state)?result.state:'attention';show(state,result?.message||(state==='success'?'同步成功':'尚未完成同步'));hideTimer=setTimeout(hide,state==='success'?1400:2400);
 }
 const top=()=>Math.max(window.scrollY||0,document.scrollingElement?.scrollTop||0)<=1;
 function begin(x,y,id,touch,event){
  if(gesture||refreshing||rebounding||root.inert||!top()||!api.enabled?.()||api.blocked?.())return;
  if(event.target.closest?.('input,textarea,select,[role=dialog],.bottom-nav,.side-nav,.record-launcher,.profile-name-viewport,.entry-filters'))return;
  gesture={x,y,id,touch,axis:'pending',distance:0,active:false};
 }
 function paint(g){
  const offset=pullOffset(g.distance);if(pulled)pulled.node.style.transform='translate3d(0,'+offset+'px,0)';
  if(g.distance<32){indicator.hidden=true;return;}
  const progress=pullProgress(g.distance),state=progress===1?'armed':'pulling';
  if(indicator.hidden||!['pulling','armed'].includes(indicator.dataset.state))show(state,'下拉同步');indicator.dataset.state=state;indicator.style.setProperty('--pull-y',(5+offset*.12)+'px');indicator.style.setProperty('--pull-progress',String(Math.min(1,(g.distance-32)/52)));
  symbol.style.transform='rotate('+(progress*240)+'deg)';label.textContent=progress===1?'松开同步':'下拉同步';
 }
 function move(x,y,event){
  const g=gesture;if(!g)return;const dx=x-g.x,dy=y-g.y;
  if(g.axis==='pending'){
   if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
   if(Math.abs(dx)>Math.abs(dy)*1.05||dy<=0||!top()){gesture=null;return;}
   if(dy<Math.abs(dx)*1.05)return;g.axis='y';g.active=true;api.onStart?.();
   const node=root.querySelector('.workspace .content');if(node)pulled={node,transform:node.style.transform,willChange:node.style.willChange};if(pulled)pulled.node.style.willChange='transform';root.classList.add('pull-dragging');
   if(!g.touch)try{root.setPointerCapture?.(g.id);}catch{}
  }
  if(event.cancelable)event.preventDefault();g.distance=Math.max(0,dy);
  if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(gesture===g)paint(g);});
 }
 function end(cancelled=false){
  const g=gesture;if(!g)return;cancelFrame();gesture=null;
  if(!g.touch)try{if(root.hasPointerCapture?.(g.id))root.releasePointerCapture(g.id);}catch{}
  if(!g.active)return;blockedUntil=Date.now()+350;rebounding=true;const token=++generation,trigger=!cancelled&&pullProgress(g.distance)===1;hide();
  const finish=()=>{if(token!==generation)return;rebounding=false;animation=null;restore();api.onEnd?.();if(trigger)refresh();};
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(pulled?.node.animate&&!reduced){animation=pulled.node.animate([{transform:'translate3d(0,'+pullOffset(g.distance)+'px,0)'},{transform:'translate3d(0,0,0)'}],{duration:300,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'});const current=animation;current.finished.then(()=>{current.cancel();finish();},finish);}
  else finish();
 }
 root.addEventListener('touchstart',e=>{if(e.touches.length!==1){end(true);return;}const p=e.touches[0];begin(p.clientX,p.clientY,p.identifier,true,e);},{passive:true});
 root.addEventListener('touchmove',e=>{if(!gesture?.touch)return;if(e.touches.length!==1){end(true);return;}const p=[...e.touches].find(p=>p.identifier===gesture.id);if(p)move(p.clientX,p.clientY,e);},{passive:false});
 root.addEventListener('touchend',e=>{if(gesture?.touch&&[...e.changedTouches].some(p=>p.identifier===gesture.id))end();},{passive:true});
 root.addEventListener('touchcancel',()=>end(true),{passive:true});
 root.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'&&e.isPrimary!==false&&e.button===0)begin(e.clientX,e.clientY,e.pointerId,false,e);},{passive:true});
 root.addEventListener('pointermove',e=>{if(gesture&&!gesture.touch&&e.pointerId===gesture.id)move(e.clientX,e.clientY,e);},{passive:false});
 root.addEventListener('pointerup',e=>{if(gesture&&!gesture.touch&&e.pointerId===gesture.id)end();},{passive:true});
 root.addEventListener('pointercancel',e=>{if(gesture&&!gesture.touch&&e.pointerId===gesture.id)end(true);},{passive:true});
 root.addEventListener('click',e=>{if(e.isTrusted&&Date.now()<blockedUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')reset();});
 return {isDragging:()=>Boolean(gesture?.active||rebounding),isRefreshing:()=>refreshing,cancel:reset};
}
