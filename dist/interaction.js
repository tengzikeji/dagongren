let uiRenderedView='',uiRollCleanups=[],uiActiveChoice=null,uiResizeObserver=null,uiObservedWidth=0;
const uiEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function uiKey(node,root){
 const date=node.closest?.('.calendar-day[data-date]')?.dataset.date;
 if(date)return 'day-wage:'+date;
 const parts=[];for(let n=node;n&&n!==root;n=n.parentElement)parts.unshift(n.tagName+':'+[...n.parentElement.children].indexOf(n));return parts.join('/');
}
function uiPatch(oldNode,newNode){
 if(oldNode.nodeType!==newNode.nodeType||oldNode.nodeName!==newNode.nodeName){oldNode.replaceWith(newNode.cloneNode(true));return;}
 if(oldNode.nodeType===3){if(oldNode.nodeValue!==newNode.nodeValue)oldNode.nodeValue=newNode.nodeValue;return;}if(oldNode.nodeType!==1)return;
 for(const attr of [...oldNode.attributes])if(!newNode.hasAttribute(attr.name))oldNode.removeAttribute(attr.name);
 for(const attr of [...newNode.attributes])if(oldNode.getAttribute(attr.name)!==attr.value)oldNode.setAttribute(attr.name,attr.value);
 const existing=[...oldNode.childNodes],incoming=[...newNode.childNodes];
 for(let i=0;i<Math.max(existing.length,incoming.length);i++){if(!incoming[i])existing[i].remove();else if(!existing[i])oldNode.appendChild(incoming[i].cloneNode(true));else uiPatch(existing[i],incoming[i]);}
 if(oldNode.tagName==='SELECT')oldNode.value=newNode.value;
}
function uiNumericText(node){
 const walker=document.createTreeWalker(node,4);let text;
 while((text=walker.nextNode())){
  if(text.parentElement?.closest('small,time,.day-number,.lunar-label,[data-static-number]'))continue;
  const match=text.nodeValue.match(/\d[\d,]*(?:\.\d+)?/);if(match)return {text,match};
 }return null;
}
export function numberRollPlan(previous,target){
 const oldDigits=String(previous).replace(/\D/g,''),digits=String(target).replace(/\D/g,'');
 if(!digits||oldDigits===digits)return [];
 return [...digits].map((digit,index)=>{
  const from=Number(oldDigits[index+oldDigits.length-digits.length]||0),to=Number(digit),steps=30+(to-from+10)%10;
  return {from,to,steps,digits:Array.from({length:steps+1},(_,i)=>(from+i)%10),delay:Math.min(index,10)*60,duration:1050};
 });
}
export function fitCompanyNames(root){
 if(typeof getComputedStyle!=='function')return;
 for(const viewport of root.querySelectorAll('.profile-name-viewport')){
  const name=viewport.querySelector('.profile-company'),width=viewport.clientWidth;if(!name||!width)continue;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)continue;
  const font=getComputedStyle(name);ctx.font='650 20px '+font.fontFamily;
  const natural=ctx.measureText(name.textContent).width,size=Math.max(13,Math.min(20,(width-2)/Math.max(1,natural)*20));
  name.style.fontSize=size.toFixed(2)+'px';
  viewport.dataset.overflow=String(name.scrollWidth>width+1);
 }
}
export function renderStable(root,markup,view,motion=true){
 const template=document.createElement?.('template');if(!template?.content){root.innerHTML=markup;return;}
 for(const finish of uiRollCleanups)finish();uiRollCleanups=[];const same=uiRenderedView===view,oldNumbers=new Map();
 if(same)for(const node of root.querySelectorAll('.number')){const numeric=uiNumericText(node);if(numeric)oldNumbers.set(uiKey(node,root),numeric.match[0]);}
 const scrollX=window.scrollX||0,scrollY=window.scrollY||0,scrolls=[...root.querySelectorAll('.profile-name-viewport')].map(e=>({key:uiKey(e,root),left:e.scrollLeft}));
 template.innerHTML=markup;
 if(same){const existing=[...root.childNodes],incoming=[...template.content.childNodes];for(let i=0;i<Math.max(existing.length,incoming.length);i++){if(!incoming[i])existing[i].remove();else if(!existing[i])root.appendChild(incoming[i].cloneNode(true));else uiPatch(existing[i],incoming[i]);}}
 else root.replaceChildren(template.content);
 root.classList.toggle('stable-query',same);uiRenderedView=view;
 fitCompanyNames(root);
 if(!uiResizeObserver&&typeof ResizeObserver==='function'){uiResizeObserver=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width&&width!==uiObservedWidth){uiObservedWidth=width;fitCompanyNames(root);}});uiResizeObserver.observe(root);}
 if(same){window.scrollTo({left:scrollX,top:scrollY,behavior:'instant'});for(const el of root.querySelectorAll('.profile-name-viewport')){const prior=scrolls.find(s=>s.key===uiKey(el,root));if(prior)el.scrollLeft=prior.left;}}
 if(!same||!motion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 for(const node of root.querySelectorAll('.number')){
  const old=oldNumbers.get(uiKey(node,root)),numeric=uiNumericText(node);if(!old||!numeric)continue;
  const {text,match}=numeric,original=text.nodeValue,target=match[0],plan=numberRollPlan(old,target);if(!plan.length)continue;
  const finalText=node.textContent,fragment=document.createDocumentFragment(),wrapper=document.createElement('span');wrapper.className='number-roll';wrapper.setAttribute('aria-hidden','true');const tracking=getComputedStyle(node).letterSpacing;wrapper.style.setProperty('--number-tracking',tracking==='normal'?'0px':tracking);let digitIndex=0;
  for(const char of target){
   if(!/\d/.test(char)){wrapper.appendChild(document.createTextNode(char));continue;}
   const wheel=plan[digitIndex++],slot=document.createElement('span'),strip=document.createElement('span');
   slot.className='number-roll-slot';strip.className='number-roll-strip';strip.style.setProperty('--roll-steps',wheel.steps);strip.style.animationDelay=wheel.delay+'ms';strip.style.animationDuration=wheel.duration+'ms';
   for(const value of wheel.digits){const row=document.createElement('span');row.textContent=String(value);strip.appendChild(row);}
   slot.appendChild(strip);wrapper.appendChild(slot);
  }
  fragment.append(document.createTextNode(original.slice(0,match.index)),wrapper,document.createTextNode(original.slice(match.index+target.length)));
  const anchor=document.createElement('span');anchor.className='number-roll-anchor';anchor.appendChild(fragment);text.replaceWith(anchor);
  const priorLabel=node.getAttribute('aria-label');node.setAttribute('aria-label',finalText);let done=false,timeout;
  const finish=()=>{if(done)return;done=true;clearTimeout(timeout);if(anchor.isConnected)anchor.replaceWith(document.createTextNode(original));if(priorLabel===null)node.removeAttribute('aria-label');else node.setAttribute('aria-label',priorLabel);};
  timeout=setTimeout(finish,Math.max(...plan.map(x=>x.delay+x.duration))+60);uiRollCleanups.push(finish);
 }
}
export function closeChoicePicker(){
 if(!uiActiveChoice)return false;const {panel,children,trigger,modal}=uiActiveChoice;uiActiveChoice=null;panel.remove();modal.classList.remove('choosing');
 for(const child of children){child.inert=false;child.removeAttribute('aria-hidden');}trigger?.focus({preventScroll:true});return true;
}
export function enhanceModalChoices(root){
 if(!root.querySelectorAll)return;
 for(const select of root.querySelectorAll('select:not([data-enhanced])')){
  select.dataset.enhanced='true';select.classList.add('native-select-bridge');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';
  const label=()=>select.options[select.selectedIndex]?.textContent||'请选择';
  const update=()=>{const option=select.options[select.selectedIndex],title=option?.dataset.title||label();trigger.innerHTML='<span><strong>'+uiEscape(title)+'</strong>'+(option?.dataset.start?'<small>'+uiEscape(option.dataset.start+' — '+option.dataset.end)+'</small>':'')+'</span><span class="select-trigger-arrow">⌄</span>';};
  update();select.after(trigger);select.addEventListener('change',update);
  trigger.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();closeChoicePicker();
   const modal=root.querySelector('.modal'),cash=select.id==='cash-period',options=[...select.options],panel=document.createElement('div');if(!modal)return;let showAll=!cash,query='';
   panel.className='choice-sheet';panel.innerHTML='<div class="choice-header"><button type="button" class="choice-back" aria-label="返回上一级">‹</button><div><small>'+(cash?'工资结算':'选择选项')+'</small><h3>'+(cash?'选择发放区间':uiEscape(select.labels?.[0]?.textContent||'请选择'))+'</h3></div></div>'+
    (cash?'<div class="choice-filters"><button type="button" data-choice-filter="pending" class="active">待发工资</button><button type="button" data-choice-filter="all">全部账期</button></div>':'')+
    (options.length>7?'<div class="choice-search"><input type="search" aria-label="筛选选项" placeholder="'+(cash?'搜索公司或日期':'搜索选项')+'"></div>':'')+'<div class="choice-list" role="listbox"></div>';
   const children=[...modal.children];for(const child of children){child.inert=true;child.setAttribute('aria-hidden','true');}
   modal.classList.add('choosing');modal.appendChild(panel);uiActiveChoice={panel,children,trigger,modal};
   function draw(){
    const list=panel.querySelector('.choice-list');let group='',html='';
    const filtered=options.filter(o=>!o.disabled&&(!cash||showAll||Number(o.dataset.cents)>0||o.value===select.value)&&(!query||o.textContent.includes(query)||o.dataset.start?.includes(query)||o.dataset.end?.includes(query)));
    for(const option of filtered){
     const data=option.dataset;if(cash&&group!==(data.company||'未命名主体')){group=data.company||'未命名主体';html+='<div class="choice-group-label">'+uiEscape(group)+'</div>';}
     html+='<button type="button" class="choice-card '+(option.value===select.value?'selected':'')+'" role="option" aria-selected="'+(option.value===select.value)+'" data-choice-value="'+uiEscape(option.value)+'"><span class="choice-card-copy"><strong>'+uiEscape(data.title||option.textContent)+'</strong>'+
      (data.start?'<small>'+uiEscape(data.start+' — '+data.end)+'</small>':'')+'</span>'+
      (cash?'<span class="choice-amount"><small>待发</small><b>¥'+uiEscape(data.amount||'0.00')+'</b></span>':'')+'<span class="choice-tick">'+(option.value===select.value?'✓':'')+'</span></button>';
    }
    list.innerHTML=html||'<div class="empty-state">没有匹配的选项</div>';
    panel.querySelectorAll('[data-choice-filter]').forEach(button=>button.classList.toggle('active',(button.dataset.choiceFilter==='all')===showAll));
   }
   panel.querySelector('.choice-back').addEventListener('click',closeChoicePicker);
   panel.addEventListener('click',e=>{const choice=e.target.closest('[data-choice-value]'),filter=e.target.closest('[data-choice-filter]');
    if(choice){select.value=choice.dataset.choiceValue;select.dispatchEvent(new Event('change',{bubbles:true}));closeChoicePicker();}
    else if(filter){showAll=filter.dataset.choiceFilter==='all';draw();}e.stopPropagation();
   });
   panel.querySelector('input')?.addEventListener('input',e=>{query=e.target.value.trim();draw();});
   draw();panel.querySelector('.choice-back').focus({preventScroll:true});
  });
 }
}
export function playBrandIntro(enabled=true){
 const bridge=globalThis.AndroidFiles,app=document.getElementById('app');
 const releaseNative=()=>{try{bridge?.introReady?.();}catch{}};
 if(!enabled||!document.body.appendChild||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||bridge?.shouldPlayIntro?.()===false){bridge?.introStyle?.(false);releaseNative();return;}
 bridge?.introStyle?.(true);
 const page=document.createElement('section');page.className='launch-page';page.dataset.phase='preparing';page.setAttribute('role','status');page.setAttribute('aria-label','打工人，正在打开账本');
 page.innerHTML='<div class="launch-grid" aria-hidden="true"></div><header class="launch-header"><span class="launch-app-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="14" rx="4"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 11v5"/></svg></span><div><strong>打工人</strong><span>工作有迹 · 收入有数</span></div><span class="launch-edition">工资账本</span></header><div class="launch-copy"><span class="launch-eyebrow"><i></i> 认真工作，从容生活</span><h2>每一份努力<br>都有清晰的记录<span>。</span></h2><p>把工作的付出，记成生活的底气。</p></div><div class="launch-art" aria-hidden="true"><div class="launch-orbit orbit-one"><i></i></div><div class="launch-orbit orbit-two"><i></i></div><div class="launch-ledger"><div class="launch-ledger-top"><span><i></i> 我的工资账本</span><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="4"/><path d="M8 8h8M8 12h8M8 16h4"/></svg></div><div class="launch-value"><span>¥</span><div class="launch-value-line"></div><span class="launch-value-dot"></span></div><div class="launch-ledger-divider"></div><div class="launch-ledger-bottom"><div><span>每一天的付出</span><b>都清清楚楚</b></div><div class="launch-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><span class="launch-card-sheen"></span></div><div class="launch-chip"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6"/></svg><span>属于你的每一笔</span></div></div><footer class="launch-status"><span class="launch-status-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="6" y="10" width="12" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span><span>本机账本已就绪<small>安心记录每一天</small></span><span class="launch-ready"><i></i><i></i><i></i></span></footer>';
 document.body.classList.add('intro-playing');document.body.appendChild(page);if(app)app.inert=true;
 let started=false,finished=false,opening=false,timer,fallback;const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const done=()=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);page.remove();document.body.classList.remove('intro-playing','intro-opening');document.body.style.overflow=priorOverflow;if(app)app.inert=false;bridge?.introStyle?.(false);if(globalThis.dagongrenLaunchReady===start)delete globalThis.dagongrenLaunchReady;document.removeEventListener('visibilitychange',hidden);};
 const open=()=>{if(opening||finished)return;opening=true;page.dataset.phase='opening';
  const card=page.querySelector('.launch-ledger'),target=app?.querySelector('.balance-hero'),from=card.getBoundingClientRect(),to=target?.getBoundingClientRect();
  document.body.classList.add('intro-opening');
  if(to&&to.width&&card.animate){card.animate([{transform:'translate(0,0) scale(1,1)',borderRadius:'24px'},{transform:'translate('+(to.left-from.left)+'px,'+(to.top-from.top)+'px) scale('+(to.width/from.width)+','+(to.height/from.height)+')',borderRadius:'24px'}],{duration:650,easing:'cubic-bezier(.22,.8,.24,1)',fill:'forwards'});}
  timer=setTimeout(done,680);
 };
 const start=()=>{if(started||finished)return;started=true;clearTimeout(fallback);page.dataset.phase='playing';timer=setTimeout(open,1450);};
 const hidden=()=>{if(document.visibilityState==='hidden')done();};document.addEventListener('visibilitychange',hidden);
 globalThis.dagongrenLaunchReady=start;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{releaseNative();if(!bridge?.introReady)start();else fallback=setTimeout(start,600);}));
 return done;
}

export function calendarSwipeDelta(dx,dy,duration=0){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||duration>30000||Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.35)return 0;
 return dx<0?1:-1;
}
export function installCalendarSwipe(root,onShift){
 if(!root.addEventListener)return;
 let gesture=null,blockedUntil=0;
 const reset=()=>{if(gesture){gesture.panel.classList.remove('is-swiping');gesture.panel.style.removeProperty('--calendar-drag');}gesture=null;};
 root.addEventListener('pointerdown',event=>{
  if(event.isPrimary===false||event.button>0){reset();return;}
  const panel=event.target.closest?.('[data-calendar-swipe]');if(!panel)return;
  gesture={panel,id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp,drag:false};
 },{passive:true});
 root.addEventListener('pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture.lastX=event.clientX;gesture.lastY=event.clientY;
  if(!gesture.drag&&Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)*1.1){reset();return;}
  if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.35)gesture.drag=true;
  if(gesture.drag){
   if(event.cancelable)event.preventDefault();
   gesture.panel.classList.add('is-swiping');gesture.panel.style.setProperty('--calendar-drag',Math.max(-72,Math.min(72,dx*.36))+'px');
  }
 },{passive:false});
 root.addEventListener('pointerup',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const current=gesture,dx=event.clientX-current.x,dy=event.clientY-current.y;
  const delta=current.drag?calendarSwipeDelta(dx,dy,event.timeStamp-current.time):0;
  if(current.drag){blockedUntil=Date.now()+250;if(event.cancelable)event.preventDefault();}
  reset();if(delta)onShift(delta);
 },{passive:false});
 root.addEventListener('pointercancel',reset,{passive:true});
 root.addEventListener('click',event=>{if(Date.now()<blockedUntil&&event.target.closest?.('[data-calendar-swipe]')){event.preventDefault();event.stopImmediatePropagation();}},true);
 return reset;
}

export function pageSwipeTarget(view,delta){
 const views=['home','calendar','records','settings'],index=views.indexOf(view);
 return index<0||![-1,1].includes(delta)?null:views[index+delta]||null;
}
export function installPageSwipe(root,api){
 if(!root.addEventListener)return;
 let gesture=null,busy=false,blockedUntil=0;
 const reset=()=>{root.classList.remove('is-paging');root.style.removeProperty('--page-drag');gesture=null;};
 const change=async(from,to,delta,offset)=>{
  busy=true;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('motion-off'),old=root.querySelector('#view-content');
  let animation;
  try{
   if(!reduced&&old?.animate){animation=old.animate([{transform:'translate3d('+offset+'px,0,0)',opacity:1},{transform:'translate3d('+(-delta*36)+'px,0,0)',opacity:0}],{duration:110,easing:'ease-out',fill:'forwards'});await animation.finished;}
   if(api.current()!==from||api.blocked?.())return;
   api.navigate(to);
   const incoming=root.querySelector('#view-content');
   if(!reduced&&incoming?.animate)await incoming.animate([{transform:'translate3d('+(delta*30)+'px,0,0)',opacity:.15},{transform:'translate3d(0,0,0)',opacity:1}],{duration:260,easing:'cubic-bezier(.2,.75,.2,1)'}).finished;
  }catch{}finally{animation?.cancel();busy=false;}
 };
 root.addEventListener('pointerdown',event=>{
  if(gesture)reset();
  if(busy||event.isPrimary===false||event.button>0||api.blocked?.()||!['home','calendar','records','settings'].includes(api.current()))return;
  if(event.target.closest?.('[data-calendar-swipe],.profile-name-viewport,.entry-filters,.month-control,input,textarea,select,.select-trigger,[role=dialog]'))return;
  const width=document.documentElement.clientWidth;if(event.clientX<18||event.clientX>width-18)return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,time:event.timeStamp,drag:false,view:api.current()};
 },{passive:true});
 root.addEventListener('pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(!gesture.drag&&Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)*1.1){reset();return;}
  if(Math.abs(dx)>16&&Math.abs(dx)>Math.abs(dy)*1.35)gesture.drag=true;
  gesture.dx=dx;
  if(gesture.drag){if(event.cancelable)event.preventDefault();root.classList.add('is-paging');root.style.setProperty('--page-drag',Math.max(-44,Math.min(44,dx*.18))+'px');}
 },{passive:false});
 root.addEventListener('pointerup',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const from=gesture.view,dx=event.clientX-gesture.x,dy=event.clientY-gesture.y,drag=gesture.drag;
  const delta=drag?calendarSwipeDelta(dx,dy,event.timeStamp-gesture.time):0,target=pageSwipeTarget(from,delta),offset=Math.max(-44,Math.min(44,dx*.18));
  if(drag){blockedUntil=Date.now()+250;if(event.cancelable)event.preventDefault();}
  reset();if(target)change(from,target,delta,offset);
 },{passive:false});
 root.addEventListener('pointercancel',reset,{passive:true});
 root.addEventListener('click',event=>{if(event.isTrusted&&Date.now()<blockedUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
 return reset;
}
