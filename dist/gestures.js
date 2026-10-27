// One input stream, one locked axis and one continuous two-frame track.
const VIEWS=['home','calendar','records','settings'];
export function pageSwipeTarget(view,delta){const i=VIEWS.indexOf(view);return i<0||![-1,1].includes(delta)?null:VIEWS[i+delta]||null;}
export function swipeAxis(dx,dy,locked='pending'){
 if(locked!=='pending')return locked;
 const x=Math.abs(dx),y=Math.abs(dy);if(Math.max(x,y)<10)return 'pending';
 if(x>y*1.15)return 'x';if(y>x*1.15)return 'y';
 return Math.max(x,y)>=24?(x>=y?'x':'y'):'pending';
}
export function swipeVelocity(samples,at){
 const recent=samples.filter(s=>s.t>=at-80&&s.t<=at),last=recent.at(-1);if(!last||recent.length<2)return 0;
 const first=recent.find(s=>last.t-s.t>=16)||recent[0],elapsed=last.t-first.t;
 return elapsed>0?(last.x-first.x)*1000/elapsed:0;
}
export function swipeDecision(dx,width,velocity=0,axis='x'){
 if(axis!=='x'||!Number.isFinite(dx)||!Number.isFinite(width)||width<=0||!Number.isFinite(velocity))return {complete:false,delta:0};
 const delta=dx<0?1:dx>0?-1:0,complete=Boolean(delta)&&(Math.abs(dx)>=width/3||(Math.abs(velocity)>=800&&Math.sign(velocity)===Math.sign(dx)));
 return {complete,delta};
}
export function swipeOffset(dx,width,boundary=false){return boundary?Math.sign(dx)*Math.min(width*.35,Math.abs(dx)*.4):Math.max(-width,Math.min(width,dx));}
export function calendarSwipeDelta(dx,dy,duration=0,width=400){if(duration>30000||swipeAxis(dx,dy)!=='x')return 0;const d=swipeDecision(dx,width,duration>0?dx*1000/duration:0);return d.complete?d.delta:0;}
const owners=new WeakMap();
const reduced=()=>document.body.classList.contains('motion-off')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const mark=(name,detail)=>{try{performance.mark(name,{detail});}catch{}};
function copy(node){const clone=node.cloneNode(true);clone.removeAttribute?.('id');for(const n of clone.querySelectorAll?.('[id]')||[])n.removeAttribute('id');return clone;}
function contentFrom(markup,selector){if(!markup||!document.createElement)return null;const t=document.createElement('template');t.innerHTML=markup;return t.content?.querySelector(selector)||null;}
function blend(a,b,t){const parse=s=>{const n=s.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];return [n[0],n[1],n[2],n[3]??1];},x=parse(a),y=parse(b),alpha=x[3]*(1-t)+y[3]*t;const rgb=x.slice(0,3).map((v,i)=>Math.round(alpha?(v*x[3]*(1-t)+y[i]*y[3]*t)/alpha:0));return 'rgba('+rgb.join(',')+','+alpha.toFixed(4)+')';}
function navigationProgress(root,from,to){
 const nav=root.querySelector('.bottom-nav');if(!nav)return {set(){},clear(){}};
 const buttons=[...nav.querySelectorAll('[data-view]')],active=buttons.find(b=>b.dataset.view===from),other=buttons.find(b=>b!==active);if(!active||!other)return {set(){},clear(){}};
 const a=getComputedStyle(active),b=getComputedStyle(other),colors={active:a.color,idle:b.color,activeBg:a.backgroundColor,idleBg:b.backgroundColor};
 const saved=buttons.flatMap(n=>[n,...n.querySelectorAll('svg')]).map(n=>[n,n.getAttribute('style')]);nav.classList.add('nav-following');
 return {set(p){for(const button of buttons){const w=button.dataset.view===from?1-p:button.dataset.view===to?p:0;button.style.color=blend(colors.idle,colors.active,w);button.style.backgroundColor=blend(colors.idleBg,colors.activeBg,w);for(const svg of button.querySelectorAll('svg'))svg.style.color=button.style.color;}nav.dataset.swipeProgress=p.toFixed(4);},clear(){for(const [n,s] of saved){if(s===null)n.removeAttribute('style');else n.setAttribute('style',s);}nav.classList.remove('nav-following');delete nav.dataset.swipeProgress;}};
}
function frame(className,width){const n=document.createElement('div');n.className=className;n.style.width=width+'px';return n;}
function boundaryFrame(width,delta,message){const n=frame('swipe-page swipe-boundary-page',width);n.style.left=delta*width+'px';const label=document.createElement('span');label.className='swipe-boundary-label';label.style[delta<0?'right':'left']='12px';label.textContent=message;n.appendChild(label);return n;}
function pageScene(root,api,cache,delta,target=null){
 const content=root.querySelector('.workspace .content'),workspace=root.querySelector('.workspace');if(!content?.getBoundingClientRect)return null;
 const from=api.current(),to=target||pageSwipeTarget(from,delta),width=document.documentElement.clientWidth,rect=content.getBoundingClientRect(),stickyRect=content.querySelector('.calendar-panel-header')?.getBoundingClientRect();
 const template=to?cache.get(to):null;if(to&&!template)return null;
 api.before?.();const layer=document.createElement('div'),track=document.createElement('div');layer.className='page-swipe-layer';track.className='page-swipe-track';layer.setAttribute('aria-hidden','true');layer.inert=true;
 const nav=root.querySelector('.bottom-nav')?.getBoundingClientRect();if(nav?.height)layer.style.bottom=Math.max(0,innerHeight-nav.top)+'px';
 const old=frame('swipe-page page-swipe-outgoing',width),next=to?frame('swipe-page page-swipe-incoming',width):boundaryFrame(width,delta,delta<0?'已到首页':'已到最后一页');old.style.left='0px';next.style.left=delta*width+'px';
 const outgoing=copy(content),incoming=to?copy(template):null,padding=parseFloat(getComputedStyle(workspace).paddingTop)||0;
 for(const [node,top] of [[outgoing,rect.top],...(incoming?[[incoming,padding]]:[])])Object.assign(node.style,{position:'absolute',left:rect.left+'px',top:top+'px',width:rect.width+'px',height:'auto',margin:'0',visibility:'visible'});
 old.appendChild(outgoing);if(incoming)next.appendChild(incoming);track.append(old,next);layer.appendChild(track);document.body.appendChild(layer);if(incoming)api.fitPreview?.(incoming);
 for(const selector of ['.profile-name-viewport','.entry-filters']){const sources=[...content.querySelectorAll(selector)],copies=[...outgoing.querySelectorAll(selector)];sources.forEach((n,i)=>{if(copies[i])copies[i].scrollLeft=n.scrollLeft;});}
 const sticky=outgoing.querySelector('.calendar-panel-header');if(sticky&&stickyRect){sticky.style.position='relative';sticky.style.top='auto';sticky.style.transform='translateY('+(stickyRect.top-sticky.getBoundingClientRect().top)+'px)';}
 const visibility=content.style.visibility;content.style.visibility='hidden';const navProgress=navigationProgress(root,from,to);
 return {track,width,boundary:!to,delta,from,to,offset:0,
  update(dx){this.offset=swipeOffset(dx,width,!to);track.style.transform='translate3d('+this.offset+'px,0,0)';navProgress.set(to?Math.abs(this.offset)/width:0);},
  progress(x){navProgress.set(to?Math.abs(x)/width:0);},
  dispose(){layer.remove();content.style.visibility=visibility;navProgress.clear();},
  commit(){if(to)api.navigate(to);},
  notify(completed,velocity,duration){mark(completed?'dagongren.page.slide':'dagongren.page.rebound',{from,to:completed?(to||from):from,direction:delta,duration,velocity,sharedTrack:true,trigger:this.trigger||'swipe',boundary:!to});}
 };
}
function calendarScene(root,api,cache,delta){
 const viewport=root.querySelector('.view-calendar .calendar-grid-viewport'),grid=viewport?.querySelector(':scope>.calendar-days'),panel=viewport?.closest('[data-calendar-swipe]');if(!grid?.getBoundingClientRect)return null;
 const item=cache.get(delta),width=viewport.getBoundingClientRect().width,oldHeight=grid.getBoundingClientRect().height,track=document.createElement('div');track.className='calendar-swipe-track';track.setAttribute('aria-hidden','true');track.inert=true;
 const old=frame('swipe-month calendar-leaving',width),next=item?frame('swipe-month calendar-entering',width):boundaryFrame(width,delta,'已到日历边界');old.style.left='0px';next.style.left=delta*width+'px';old.appendChild(copy(grid));if(item)next.appendChild(copy(item.grid));
 track.append(old,next);viewport.appendChild(track);const nextHeight=item?next.firstElementChild.getBoundingClientRect().height:oldHeight,visibility=grid.style.visibility,height=viewport.style.height;
 for(const n of [old,next])n.style.minHeight=Math.max(oldHeight,nextHeight)+'px';viewport.style.height=oldHeight+'px';grid.style.visibility='hidden';viewport.classList.add('calendar-month-switching');
 const resize=x=>{const p=item?Math.min(1,Math.abs(x)/width):0;viewport.style.height=(oldHeight+(nextHeight-oldHeight)*p)+'px';viewport.dataset.swipeProgress=p.toFixed(4);};
 return {track,width,boundary:!item,delta,from:panel.dataset.calendarMonth,to:item?.month||panel.dataset.calendarMonth,offset:0,
  update(dx){this.offset=swipeOffset(dx,width,!item);track.style.transform='translate3d('+this.offset+'px,0,0)';resize(this.offset);},progress:resize,
  dispose(){track.remove();grid.style.visibility=visibility;viewport.style.height=height;viewport.classList.remove('calendar-month-switching');delete viewport.dataset.swipeProgress;},
  commit(){if(item)api.commit(delta);},
  notify(completed,velocity,duration){mark(completed?'dagongren.calendar.slide':'dagongren.calendar.rebound',{from:this.from,to:completed?this.to:this.from,direction:delta,duration,velocity,sharedTrack:true,datesOnly:true,boundary:!item});}
 };
}
function bindInput(root,config){
 if(!root.addEventListener)return;
 let gesture=null,scene=null,animation=null,dragFrame=0,tick=0,generation=0,blockedUntil=0,busy=false;
 const cancelFrames=()=>{if(dragFrame)cancelAnimationFrame(dragFrame);if(tick)cancelAnimationFrame(tick);dragFrame=tick=0;};
 const releaseCapture=g=>{try{if(g&&!g.touch&&root.hasPointerCapture?.(g.id))root.releasePointerCapture(g.id);}catch{}};
 const clear=(flush=true)=>{generation++;cancelFrames();animation?.cancel();animation=null;scene?.dispose();scene=null;releaseCapture(gesture);gesture=null;busy=false;root.classList.remove('swipe-busy','swipe-dragging','page-transitioning');delete root.dataset.swipeTrigger;if(owners.get(root)===controller)owners.delete(root);if(flush)config.settled?.(false);};
 const width=()=>config.width?.()||globalThis.document?.documentElement?.clientWidth||400;
 const point=(g,x,t)=>{if(!Number.isFinite(t))t=g.samples.at(-1)?.t||0;g.samples.push({x,t});g.samples=g.samples.filter(s=>s.t>=t-160);};
 const selectScene=(g,dx)=>{const delta=dx===0?(scene?.delta||g.delta||1):dx<0?1:-1;if(scene?.delta===delta)return;scene?.dispose();scene=config.scene(delta);if(scene){scene.trigger='swipe';root.classList.add('swipe-busy','swipe-dragging');root.dataset.swipeTrigger='swipe';if(config.page)root.classList.add('page-transitioning');}g.delta=delta;};
 const update=(g,dx)=>{selectScene(g,dx);if(!scene)return;scene.update(dx);};
 const move=(x,y,t,event)=>{const g=gesture;if(!g)return;const dx=x-g.x,dy=y-g.y;point(g,x,t);g.dx=dx;g.axis=swipeAxis(dx,dy,g.axis);if(g.axis!=='x')return;
  if(event.cancelable)event.preventDefault();if(!g.touch)try{root.setPointerCapture?.(g.id);}catch{}
  g.pending=dx;if(!dragFrame){if(typeof requestAnimationFrame!=='function'){update(g,dx);return;}dragFrame=requestAnimationFrame(()=>{dragFrame=0;if(gesture===g)update(g,g.pending);});}
 };
 const settle=(complete,velocity=0)=>{
  const g=gesture;if(!g)return;cancelFrames();if(g.axis==='x'&&(g.dx!==0||!scene))update(g,g.dx);releaseCapture(g);gesture=null;root.classList.remove('swipe-dragging');
  const s=scene,canCommit=Boolean(complete&&!s?.boundary),duration=canCommit?280:200;if(!s){if(canCommit)config.commit?.(g.delta);clear();return;}
  blockedUntil=Date.now()+250;busy=true;const from=s.offset,to=canCommit?-s.delta*s.width:0,token=++generation;
  const finish=()=>{if(token!==generation)return;cancelFrames();animation?.cancel();animation=null;scene=null;s.dispose();busy=false;root.classList.remove('swipe-busy','swipe-dragging');if(owners.get(root)===controller)owners.delete(root);
   if(canCommit&&!s.committed)s.commit();root.classList.remove('page-transitioning');delete root.dataset.swipeTrigger;s.notify(canCommit,velocity,duration);if(s.boundary&&Math.abs(g.dx)>12)config.boundary?.(s.delta);config.settled?.(canCommit,s.to);};
  if(reduced()||!s.track.animate){s.update(canCommit?-s.delta*s.width:0);finish();return;}
  animation=s.track.animate([{transform:'translate3d('+from+'px,0,0)'},{transform:'translate3d('+to+'px,0,0)'}],{duration,easing:'ease-out',fill:'both'});
  const progress=()=>{if(token!==generation||!animation)return;const p=animation.effect.getComputedTiming().progress??0;s.progress(from+(to-from)*p);tick=requestAnimationFrame(progress);};tick=requestAnimationFrame(progress);
  animation.finished.then(finish,()=>{if(token===generation)clear();});
 };
 const end=(x,y,t,event,cancelled=false)=>{const g=gesture;if(!g)return;g.dx=x-g.x;point(g,x,t);g.axis=swipeAxis(g.dx,y-g.y,g.axis);if(g.axis==='x'){if(event.cancelable)event.preventDefault();const velocity=swipeVelocity(g.samples,t),decision=swipeDecision(g.dx,scene?.width||width(),velocity,g.axis);g.delta=decision.delta;settle(!cancelled&&decision.complete,velocity);}else clear();};
 const begin=(x,y,t,id,touch,event)=>{if(busy||gesture||owners.get(root)||config.blocked?.()||!config.accept(event.target,x))return;config.warm?.();gesture={x,y,id,touch,axis:'pending',dx:0,delta:0,samples:[{x,t}]};owners.set(root,controller);};
 root.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.isPrimary===false||e.button>0)return;begin(e.clientX,e.clientY,e.timeStamp,e.pointerId,false,e);},{passive:true});
 root.addEventListener('pointermove',e=>{if(gesture&&!gesture.touch&&e.pointerId===gesture.id)move(e.clientX,e.clientY,e.timeStamp,e);},{passive:false});
 root.addEventListener('pointerup',e=>{if(gesture&&!gesture.touch&&e.pointerId===gesture.id)end(e.clientX,e.clientY,e.timeStamp,e);},{passive:false});
 root.addEventListener('pointercancel',e=>{if(gesture&&!gesture.touch&&e.pointerId===gesture.id)end(gesture.x+gesture.dx,gesture.y,e.timeStamp,e,true);},{passive:true});
 root.addEventListener('touchstart',e=>{if(e.touches.length!==1){if(gesture)settle(false);return;}const p=e.touches[0];begin(p.clientX,p.clientY,e.timeStamp,p.identifier,true,e);},{passive:true});
 root.addEventListener('touchmove',e=>{if(!gesture?.touch)return;if(e.touches.length!==1){settle(false);return;}const p=[...e.touches].find(p=>p.identifier===gesture.id);if(p)move(p.clientX,p.clientY,e.timeStamp,e);},{passive:false});
 root.addEventListener('touchend',e=>{if(!gesture?.touch)return;const p=[...e.changedTouches].find(p=>p.identifier===gesture.id);if(p)end(p.clientX,p.clientY,e.timeStamp,e);},{passive:false});
 root.addEventListener('touchcancel',e=>{if(gesture?.touch)end(gesture.x+gesture.dx,gesture.y,e.timeStamp,e,true);},{passive:true});
 root.addEventListener('click',e=>{if(e.isTrusted&&Date.now()<blockedUntil&&config.ownsClick(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
 const controller={cancel:clear,isBusy:()=>busy||Boolean(scene),start(delta,trigger='tap'){
  owners.get(root)?.cancel(false);clear(false);config.warm?.();scene=config.scene(delta);if(!scene)return false;scene.trigger=trigger;root.dataset.swipeTrigger=trigger;root.classList.add('swipe-busy');if(config.page)root.classList.add('page-transitioning');owners.set(root,controller);gesture={x:0,y:0,id:-1,touch:false,axis:'x',dx:0,delta,samples:[{x:0,t:0}]};scene.update(0);if(trigger==='tap'){scene.commit();scene.committed=true;const live=root.querySelector('.workspace .content');if(live)live.style.visibility='hidden';scene.update(0);}settle(true,0);return true;
 }};return controller;
}
export function bindPageSwipe(root,api){
 let cache=new Map(),idle=0,tapTarget=null;
 const warm=()=>{const from=api.current();for(const to of [...[-1,1].map(d=>pageSwipeTarget(from,d)),tapTarget].filter(Boolean))if(!cache.has(to)){const node=contentFrom(api.preview?.(to),'.workspace .content');if(node)cache.set(to,node);}};
 const controller=bindInput(root,{page:true,blocked:()=>api.blocked?.()||!VIEWS.includes(api.current()),width:()=>document.documentElement.clientWidth,
  accept:(target,x)=>x>=0&&x<=document.documentElement.clientWidth&&!target.closest?.('[data-calendar-swipe],.profile-name-viewport,.entry-filters,.month-control,.month-toolbar,.record-year-trigger,input,textarea,select,.select-trigger,[role=dialog],.bottom-nav,.side-nav,.record-launcher'),ownsClick:()=>true,warm,
  scene:delta=>{const target=tapTarget;tapTarget=null;return pageScene(root,api,cache,delta,target);},
  boundary:d=>api.boundary?.(d<0?'已到首页':'已到最后一页'),settled:(completed,to)=>{cache.clear();api.settled?.(completed,to);},commit:delta=>{const to=pageSwipeTarget(api.current(),delta);if(to)api.navigate(to);}
 });
 if(!controller)return;
 controller.invalidate=()=>{cache.clear();if(idle){if(typeof cancelIdleCallback==='function')cancelIdleCallback(idle);else clearTimeout(idle);}const prepare=()=>{idle=0;if(!root.inert&&!controller.isBusy())warm();};idle=typeof requestIdleCallback==='function'?requestIdleCallback(prepare,{timeout:500}):setTimeout(prepare,0);};
 controller.prepare=warm;
 controller.navigate=to=>{const from=api.current(),a=VIEWS.indexOf(from),b=VIEWS.indexOf(to);if(a<0||b<0||a===b||api.blocked?.())return false;tapTarget=to;warm();const ok=controller.start(Math.sign(b-a),'tap');if(!ok){tapTarget=null;api.navigate(to);api.settled?.(true,to);}return true;};return controller;
}
export function bindCalendarSwipe(root,api){
 if(typeof api==='function')api={commit:api};let cache=new Map(),idle=0;
 const warm=()=>{for(const delta of [-1,1])if(!cache.has(delta)){const p=api.preview?.(delta);if(p){const grid=contentFrom(p.markup,'.calendar-days');if(grid)cache.set(delta,{month:p.month,grid});}}};
 const controller=bindInput(root,{width:()=>root.querySelector('.view-calendar .calendar-grid-viewport')?.clientWidth||400,blocked:()=>api.blocked?.(),accept:target=>Boolean(target.closest?.('.view-calendar .calendar-grid-viewport')),ownsClick:target=>Boolean(target.closest?.('.calendar-grid-viewport')),warm,
  scene:delta=>calendarScene(root,api,cache,delta),commit:delta=>api.commit(delta),settled:completed=>{cache.clear();api.settled?.(completed);},boundary:()=>api.boundary?.('已到日历边界')});
 if(!controller)return;controller.prepare=warm;controller.invalidate=()=>{cache.clear();if(idle)clearTimeout(idle);idle=setTimeout(()=>{idle=0;if(!root.inert&&!controller.isBusy())warm();},0);};return controller;
}
