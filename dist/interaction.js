let uiHomeGlareDone=false;
const uiRollingNodes=new Map();
let uiRenderedView='',uiRenderedTheme='',uiRollCleanups=[],uiActiveChoice=null,uiResizeObserver=null,uiObservedWidth=0,uiCalendarSlideCleanup=null,uiPageSlideCleanup=null;
const uiEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function uiKey(node,root){
 const metric=node.closest?.('[data-metric]');
 if(metric){const group=node.closest?.('.balance-hero,.calendar-summary,.ledger-overview,.month-account,.annual-board,.settlement-chart,.today-insight');return ['metric',group?.classList?.[0]||metric.dataset.ref||'',metric.dataset.metric,metric.dataset.scope||'all'].join(':');}
 const date=node.closest?.('.calendar-day[data-date]')?.dataset.date;
 if(date)return 'day-wage:'+date;
 const parts=[];for(let n=node;n&&n!==root;n=n.parentElement)parts.unshift(n.tagName+':'+[...n.parentElement.children].indexOf(n));return parts.join('/');
}
function uiPatch(oldNode,newNode){
 if(oldNode.nodeType!==newNode.nodeType||oldNode.nodeName!==newNode.nodeName){oldNode.replaceWith(newNode.cloneNode(true));return;}
 const rolling=uiRollingNodes.get(oldNode);
 if(rolling){if(rolling.text===newNode.textContent&&oldNode.className===newNode.className)return;rolling.finish();}
 if(oldNode.isEqualNode?.(newNode))return;
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
  if(text.parentElement?.closest('small,time,.day-number,.lunar-label,[data-static-number]')&&!node.hasAttribute?.('data-chart-number'))continue;
  const match=text.nodeValue.match(/\d[\d,]*(?:\.\d+)?/);if(match)return {text,match};
 }return null;
}
export function numberRollPlan(previous,target){
 const oldDigits=String(previous).replace(/\D/g,''),digits=String(target).replace(/\D/g,'');
 if(!digits||oldDigits===digits)return [];
 return [...digits].map((digit,index)=>{
  const from=Number(oldDigits[index+oldDigits.length-digits.length]||0),to=Number(digit),steps=oldDigits?(to-from+10)%10:10+to;
  return {from,to,steps,digits:Array.from({length:steps+1},(_,i)=>(from+i)%10),delay:Math.min(index,10)*16,duration:440};
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
export function chartNumberMarkup(markup){
 return markup.replace(/<section\b[^>]*\bdata-chart\b[^>]*>[\s\S]*?<\/section>/g,section=>section.replace(/(<(strong|b|small|span|div)\b([^>]*)>)([^<]*)/g,(full,opening,tag,attrs,text)=>{
  if(!/\d/.test(text)||/data-chart-number/.test(attrs)||/\d{4}-\d{2}-\d{2}/.test(text))return full;
  const metric=tag==='strong'||tag==='b'||tag==='small'&&(/\d(?:\.\d+)?%/.test(text)||/\d[\d,]*\.\d{2}\s*\/\s*-?\d/.test(text))||tag==='span'&&/^(已记|已过|今天 · 第|下一次周年 · 还剩)/.test(text)||tag==='div'&&/\bchart-empty\b/.test(attrs)&&/^距(?:离)?入职还有 /.test(text);
  if(!metric)return full;
  return opening+text.replace(/\d[\d,]*(?:\.\d+)?/g,value=>'<span class="number chart-number" data-chart-number>'+value+'</span>');
 }));
}
export function renderStable(root,markup,view,motion=true,replayNumbers=false){
 markup=chartNumberMarkup(markup);
 uiCalendarSlideCleanup?.();if(uiRenderedView!==view)uiPageSlideCleanup?.();
 const template=document.createElement?.('template');if(!template?.content){root.innerHTML=markup;return;}
 const same=uiRenderedView===view,renderedTheme=document.body.getAttribute?.('data-theme')||'',themeChanged=renderedTheme!==uiRenderedTheme,oldNumbers=new Map();
 if(same)for(const node of root.querySelectorAll('.number')){const value=uiRollingNodes.get(node)?.number||uiNumericText(node)?.match[0];if(value)oldNumbers.set(uiKey(node,root),value);}
 const scrollX=window.scrollX||0,scrollY=window.scrollY||0,scrolls=[...root.querySelectorAll('.profile-name-viewport')].map(e=>({key:uiKey(e,root),left:e.scrollLeft}));
 template.innerHTML=markup;
 {const existing=[...root.childNodes],incoming=[...template.content.childNodes];for(let i=0;i<Math.max(existing.length,incoming.length);i++){if(!incoming[i])existing[i].remove();else if(!existing[i])root.appendChild(incoming[i].cloneNode(true));else uiPatch(existing[i],incoming[i]);}}
 for(const [node,state] of uiRollingNodes)if(!node.isConnected||!motion)state.finish();
 root.classList.add('stable-query');uiRenderedView=view;uiRenderedTheme=renderedTheme;
 fitCompanyNames(root);
 if(!uiResizeObserver&&typeof ResizeObserver==='function'){uiResizeObserver=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width&&width!==uiObservedWidth){uiObservedWidth=width;fitCompanyNames(root);}});uiResizeObserver.observe(root);}
 if(same){window.scrollTo({left:scrollX,top:scrollY,behavior:'instant'});for(const el of root.querySelectorAll('.profile-name-viewport')){const prior=scrolls.find(s=>s.key===uiKey(el,root));if(prior)el.scrollLeft=prior.left;}}
 if(!motion||root.classList.contains('page-transitioning')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 for(const node of root.querySelectorAll('.number')){
  const calendarAmount=Boolean(node.closest?.('.calendar-day')&&node.classList.contains('day-wage'));
  const chartAmount=node.hasAttribute?.('data-chart-number');
  if(calendarAmount||node.closest?.('[data-static-number]')||uiRollingNodes.has(node))continue;
  if(!same&&!chartAmount)continue;
  const old=replayNumbers||chartAmount&&themeChanged?'':oldNumbers.get(uiKey(node,root))??(chartAmount?'':null),numeric=uiNumericText(node);if(old===null||!numeric)continue;
  const {text,match}=numeric,original=text.nodeValue,target=match[0],plan=numberRollPlan(old,target);if(!plan.length)continue;
  const finalText=node.textContent,fragment=document.createDocumentFragment(),wrapper=document.createElement('span');wrapper.className='number-roll';wrapper.setAttribute('aria-hidden','true');const tracking=getComputedStyle(node).letterSpacing;wrapper.style.setProperty('--number-tracking',tracking==='normal'?'0px':tracking);let digitIndex=0;
  for(const char of target){
   if(!/\d/.test(char)){wrapper.appendChild(document.createTextNode(char));continue;}
   const wheel=plan[digitIndex++];if(!wheel.steps){wrapper.appendChild(document.createTextNode(char));continue;}
   const slot=document.createElement('span'),strip=document.createElement('span');
   slot.className='number-roll-slot';strip.className='number-roll-strip';strip.style.setProperty('--roll-steps',wheel.steps);strip.style.animationDelay=wheel.delay+'ms';strip.style.animationDuration=wheel.duration+'ms';
   for(const value of wheel.digits){const row=document.createElement('span');row.textContent=String(value);strip.appendChild(row);}
   slot.appendChild(strip);wrapper.appendChild(slot);
  }
  fragment.append(document.createTextNode(original.slice(0,match.index)),wrapper,document.createTextNode(original.slice(match.index+target.length)));
  const anchor=document.createElement('span');anchor.className='number-roll-anchor';anchor.appendChild(fragment);text.replaceWith(anchor);
  const priorLabel=node.getAttribute('aria-label');node.setAttribute('aria-label',finalText);let done=false,timeout;
  const finish=()=>{if(done)return;done=true;clearTimeout(timeout);uiRollingNodes.delete(node);uiRollCleanups=uiRollCleanups.filter(cleanup=>cleanup!==finish);if(anchor.isConnected)anchor.replaceWith(document.createTextNode(original));if(priorLabel===null)node.removeAttribute('aria-label');else node.setAttribute('aria-label',priorLabel);};
  uiRollingNodes.set(node,{text:finalText,number:target,finish});
  timeout=setTimeout(finish,Math.max(...plan.map(x=>x.delay+x.duration))+60);uiRollCleanups.push(finish);
 }
}
export function playHomeStartupGlare(root,motion=true){
 if(uiHomeGlareDone||!motion||document.body.classList.contains('motion-off')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.querySelector('.launch-page')||root.inert||document.visibilityState==='hidden')return false;
 const hero=root.querySelector('.view-home .balance-hero');if(!hero?.animate)return false;
 uiHomeGlareDone=true;
 const glare=document.createElement('span');glare.className='hero-startup-glare';glare.setAttribute('aria-hidden','true');hero.appendChild(glare);
 const duration=680,from='translate3d(0,0,0) skewX(-25deg)',to='translate3d('+Math.round(hero.clientWidth*1.6)+'px,0,0) skewX(-25deg)';
 const sweep=glare.animate([{offset:0,transform:from,opacity:0},{offset:.18,opacity:.65},{offset:.82,opacity:.65},{offset:1,transform:to,opacity:0}],{duration,easing:'cubic-bezier(.2,.55,.35,1)',fill:'both'});
 let finished=false,timer;const done=()=>{if(finished)return;finished=true;clearTimeout(timer);glare.remove();sweep.cancel();try{performance.mark('dagongren.home.glare.complete');}catch{}};
 timer=setTimeout(done,duration+100);sweep.finished.then(done,done);
 try{performance.mark('dagongren.home.glare',{detail:{runs:1,afterLaunch:!document.querySelector('.launch-page'),direction:'left-to-right',from,to,duration,at:Date.now(),rolling:hero.querySelectorAll('.number-roll-strip').length}});}catch{}
 return true;
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
   panel.className='choice-sheet';panel.innerHTML='<div class="choice-header"><button type="button" class="choice-back" aria-label="返回上一级">‹</button><div><small>'+(cash?'工资结算':'选择选项')+'</small><h3>'+(cash?'选择发放区间':uiEscape(select.labels?.[0]?.textContent||'请选择'))+'</h3></div><button type="button" class="choice-close icon-button" aria-label="关闭全部菜单">×</button></div>'+
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
   panel.querySelector('.choice-close').addEventListener('click',()=>{closeChoicePicker();root.querySelector('.modal-close')?.click();});
   panel.addEventListener('click',e=>{const choice=e.target.closest('[data-choice-value]'),filter=e.target.closest('[data-choice-filter]');
    if(choice){select.value=choice.dataset.choiceValue;select.dispatchEvent(new Event('change',{bubbles:true}));closeChoicePicker();}
    else if(filter){showAll=filter.dataset.choiceFilter==='all';draw();}e.stopPropagation();
   });
   panel.querySelector('input')?.addEventListener('input',e=>{query=e.target.value.trim();draw();});
   draw();panel.querySelector('.choice-back').focus({preventScroll:true});
  });
 }
}
export function playBrandIntro(enabled=true,onComplete=null){
 const bridge=globalThis.AndroidFiles,app=document.getElementById('app');
 const releaseNative=()=>{try{bridge?.introReady?.();}catch{}};
 if(!enabled||!document.body.appendChild||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||bridge?.shouldPlayIntro?.()===false){bridge?.introStyle?.(false);releaseNative();return;}
 bridge?.introStyle?.(true);
 const page=document.createElement('section');page.className='launch-page';page.dataset.phase='preparing';page.setAttribute('role','status');page.setAttribute('aria-label','打工人，正在打开账本');
 page.innerHTML='<div class="launch-grid" aria-hidden="true"></div><header class="launch-header"><span class="launch-app-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="14" rx="4"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 11v5"/></svg></span><div><strong>打工人</strong><span>工作有迹 · 收入有数</span></div><span class="launch-edition">工资账本</span></header><div class="launch-copy"><span class="launch-eyebrow"><i></i> 认真工作，从容生活</span><h2>每一份努力<br>都有清晰的记录<span>。</span></h2><p>把工作的付出，记成生活的底气。</p></div><div class="launch-art" aria-hidden="true"><div class="launch-orbit orbit-one"><i></i></div><div class="launch-orbit orbit-two"><i></i></div><div class="launch-ledger"><div class="launch-ledger-top"><span><i></i> 我的工资账本</span><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="4"/><path d="M8 8h8M8 12h8M8 16h4"/></svg></div><div class="launch-value"><span>¥</span><div class="launch-value-line"></div><span class="launch-value-dot"></span></div><div class="launch-ledger-divider"></div><div class="launch-ledger-bottom"><div><span>每一天的付出</span><b>都清清楚楚</b></div><div class="launch-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><span class="launch-card-sheen"></span></div><div class="launch-chip"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6"/></svg><span>属于你的每一笔</span></div></div><footer class="launch-status"><span class="launch-status-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="6" y="10" width="12" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span><span>本机账本已就绪<small>安心记录每一天</small></span><span class="launch-ready"><i></i><i></i><i></i></span></footer>';
 document.body.classList.add('intro-playing');document.body.appendChild(page);if(app)app.inert=true;
 const transitions=[];let started=false,finished=false,opening=false,timer,fallback;const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const done=()=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);for(const transition of transitions)transition.cancel();if(app)app.classList.add('stable-query');page.remove();document.body.classList.remove('intro-playing','intro-opening');document.body.style.overflow=priorOverflow;if(app)app.inert=false;bridge?.introStyle?.(false);if(globalThis.dagongrenLaunchReady===start)delete globalThis.dagongrenLaunchReady;document.removeEventListener('visibilitychange',hidden);if(started&&opening&&document.visibilityState!=='hidden')onComplete?.();};
 const open=()=>{if(opening||finished)return;opening=true;
  const targets=[...document.querySelectorAll('.bottom-nav [data-view="home"],.side-nav [data-view="home"]')],home=targets.find(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0;}),bounds=home?.getBoundingClientRect(),width=window.innerWidth,height=window.innerHeight;
  const target={x:bounds?bounds.left+bounds.width/2:width/8,y:bounds?bounds.top+bounds.height/2:height-28};
  page.style.transformOrigin=target.x+'px '+target.y+'px';page.dataset.phase='absorbing';
  document.body.classList.add('intro-opening');
  const duration=980;
  try{performance.mark('dagongren.launch.absorbing',{detail:{target,button:bounds?{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}:null,origin:getComputedStyle(page).transformOrigin,duration,surfaces:document.querySelectorAll('.launch-page').length}});}catch{}
  const animate=(node,frames,options)=>{if(node?.animate)transitions.push(node.animate(frames,{duration,fill:'both',...options}));};
  animate(page,[
   {offset:0,transform:'scale(1,1) skewX(0deg)',borderRadius:'0px',opacity:1},
   {offset:.3,transform:'scale(.88,.92) skewX(-3deg)',borderRadius:'24px',opacity:1},
   {offset:.64,transform:'scale(.48,.6) skewX(-10deg)',borderRadius:'42px',opacity:.99},
   {offset:.88,transform:'scale(.12,.24) skewX(-16deg)',borderRadius:'58px',opacity:.9},
   {offset:1,transform:'scale(.001,.001) skewX(-18deg)',borderRadius:'64px',opacity:0}
  ],{easing:'cubic-bezier(.34,.04,.7,.38)'});
  animate(app,[{offset:0,opacity:0},{offset:.15,opacity:.08},{offset:.4,opacity:.4},{offset:.7,opacity:.82},{offset:1,opacity:1}],{easing:'linear'});
  for(const [index,node] of [...document.querySelectorAll('.view-home>.balance-hero,.view-home>.settlement-chart,.view-home>.home-section-title,.view-home>.month-toolbar,.view-home>.month-account')].entries()){
   const delay=100+index*65;animate(node,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{delay,duration:duration-delay-30,easing:'cubic-bezier(.2,.7,.25,1)'});
  }
  animate(home,[{offset:0,boxShadow:'0 0 0 0 #3276f500'},{offset:.75,boxShadow:'0 0 0 8px #3276f526'},{offset:1,boxShadow:'0 0 0 0 #3276f500'}],{easing:'ease-out'});
  timer=setTimeout(done,duration+40);
 };
 const start=()=>{if(started||finished)return;started=true;clearTimeout(fallback);page.dataset.phase='playing';try{performance.mark('dagongren.launch.playing',{detail:{at:Date.now(),surfaces:document.querySelectorAll('.launch-page').length,oldBrand:Boolean(document.querySelector('.brand-intro')),inert:app?.inert===true,animated:getComputedStyle(page.querySelector('.launch-ledger')).animationName==='launch-card-in'}});}catch{}requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!finished)timer=setTimeout(open,1450);}));};
 const hidden=()=>{if(document.visibilityState==='hidden')done();};document.addEventListener('visibilitychange',hidden);
 globalThis.dagongrenLaunchReady=start;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{releaseNative();if(!bridge?.introReady)start();else fallback=setTimeout(start,600);}));
 return done;
}

// Coalesce pointer events into one transform update per display frame.
const uiDragFrames=new Map();
function uiDrag(style,key,value){
 if(typeof requestAnimationFrame!=='function'){style.setProperty(key,value);return;}
 const pending=uiDragFrames.get(style);if(pending){pending.value=value;return;}
 const frame={value,id:0};uiDragFrames.set(style,frame);
 frame.id=requestAnimationFrame(()=>{uiDragFrames.delete(style);style.setProperty(key,frame.value);});
}
function uiClearDrag(style,key){
 const frame=uiDragFrames.get(style);if(frame){cancelAnimationFrame(frame.id);uiDragFrames.delete(style);}style.removeProperty(key);
}
function uiSwipeOffset(dx){return Math.max(-((globalThis.document?.documentElement?.clientWidth||400)*.92),Math.min((globalThis.document?.documentElement?.clientWidth||400)*.92,dx*.92));}
export function calendarSwipeDelta(dx,dy,duration=0){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||duration>30000||Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.35)return 0;
 return dx<0?1:-1;
}
export function installCalendarSwipe(root,onShift){
 if(!root.addEventListener)return;
 let gesture=null,blockedUntil=0;
 const reset=()=>{if(gesture){gesture.panel.classList.remove('is-swiping');uiClearDrag(gesture.panel.style,'--calendar-drag');}gesture=null;};
 const shift=(current,delta,offset)=>{
  const oldGrid=current.panel.querySelector?.('.calendar-days'),outgoing=oldGrid?.cloneNode(true),oldMonth=current.panel.dataset?.calendarMonth,oldHeight=oldGrid?.getBoundingClientRect().height;
  onShift(delta);
  const panel=root.querySelector?.('[data-calendar-swipe]'),viewport=panel?.querySelector('.calendar-grid-viewport'),incoming=viewport?.querySelector('.calendar-days');
  if(!outgoing||!incoming?.animate||!viewport||panel.dataset.calendarMonth===oldMonth||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('motion-off'))return;
  const width=viewport.getBoundingClientRect().width;if(!width)return;
  const nextHeight=incoming.getBoundingClientRect().height;
  const resizing=oldHeight&&oldHeight!==nextHeight?viewport.animate([{height:oldHeight+'px'},{height:nextHeight+'px'}],{duration:300,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'}):null;
  outgoing.classList.add('calendar-leaving');outgoing.setAttribute('aria-hidden','true');outgoing.inert=true;viewport.appendChild(outgoing);viewport.classList.add('calendar-month-switching');
  const options={duration:300,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'};
  const leaving=outgoing.animate([{transform:'translate3d('+offset+'px,0,0)'},{transform:'translate3d('+(-delta*width)+'px,0,0)'}],options);
  const entering=incoming.animate([{transform:'translate3d('+(delta*width+offset)+'px,0,0)'},{transform:'translate3d(0,0,0)'}],options);
  let done=false;const finish=()=>{if(done)return;done=true;outgoing.remove();viewport.classList.remove('calendar-month-switching');leaving.cancel();entering.cancel();resizing?.cancel();if(uiCalendarSlideCleanup===finish)uiCalendarSlideCleanup=null;};uiCalendarSlideCleanup=finish;
  try{performance.mark('dagongren.calendar.slide',{detail:{from:oldMonth,to:panel.dataset.calendarMonth,direction:delta,duration:300}});}catch{}
  Promise.all([leaving.finished,entering.finished]).catch(()=>{}).then(finish);
 };

 root.addEventListener('pointerdown',event=>{
  if(event.isPrimary===false||event.button>0){reset();return;}
  const panel=event.target.closest?.('[data-calendar-swipe]');if(!panel)return;uiCalendarSlideCleanup?.();
  gesture={panel,id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp,drag:false};
 },{passive:true});
 root.addEventListener('pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture.lastX=event.clientX;gesture.lastY=event.clientY;
  if(!gesture.drag&&Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)*1.1){reset();return;}
  if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.35)gesture.drag=true;
  if(gesture.drag){
   if(event.cancelable)event.preventDefault();
   if(!root.hasPointerCapture?.(event.pointerId))root.setPointerCapture?.(event.pointerId);
    gesture.panel.classList.add('is-swiping');uiDrag(gesture.panel.style,'--calendar-drag',uiSwipeOffset(dx)+'px');
  }
 },{passive:false});
 root.addEventListener('pointerup',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const current=gesture,dx=event.clientX-current.x,dy=event.clientY-current.y;
  const delta=calendarSwipeDelta(dx,dy,event.timeStamp-current.time);
  if(current.drag||delta){blockedUntil=Date.now()+250;if(event.cancelable)event.preventDefault();}
  reset();if(delta)shift(current,delta,uiSwipeOffset(dx));
 },{passive:false});
 root.addEventListener('pointercancel',reset,{passive:true});
 root.addEventListener('click',event=>{if(event.isTrusted&&Date.now()<blockedUntil&&event.target.closest?.('[data-calendar-swipe]')){event.preventDefault();event.stopImmediatePropagation();}},true);
 return reset;
}

export function pageSwipeTarget(view,delta){
 const views=['home','calendar','records','settings'],index=views.indexOf(view);
 return index<0||![-1,1].includes(delta)?null:views[index+delta]||null;
}
export function installPageSwipe(root,api){
 if(!root.addEventListener)return;
 let gesture=null,busy=false,blockedUntil=0;
 const reset=()=>{root.classList.remove('is-paging');uiClearDrag(root.style,'--page-drag');gesture=null;};
 const change=(from,to,delta,offset)=>{
  if(api.current()!==from||api.blocked?.())return;uiPageSlideCleanup?.();uiCalendarSlideCleanup?.();for(const finish of uiRollCleanups)finish();uiRollCleanups=[];
  const content=root.querySelector('.workspace .content'),rect=content?.getBoundingClientRect(),outgoing=content?.cloneNode(true),stickyRect=content?.querySelector('.calendar-panel-header')?.getBoundingClientRect();
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('motion-off');
  busy=true;root.classList.add('page-transitioning');api.navigate(to);root.classList.add('stable-query');
  const incoming=root.querySelector('.workspace .content');
  if(reduced||!outgoing||!rect?.width||!incoming?.animate){busy=false;root.classList.remove('page-transitioning');return;}
  const layer=document.createElement('div');layer.className='page-swipe-layer';layer.setAttribute('aria-hidden','true');layer.inert=true;
  outgoing.classList.add('page-swipe-outgoing');outgoing.removeAttribute('id');for(const element of outgoing.querySelectorAll('[id]'))element.removeAttribute('id');
  Object.assign(outgoing.style,{position:'absolute',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0'});layer.appendChild(outgoing);document.body.appendChild(layer);
  const sticky=outgoing.querySelector('.calendar-panel-header');if(sticky&&stickyRect){sticky.style.position='relative';sticky.style.top='auto';sticky.style.transform='translateY('+(stickyRect.top-sticky.getBoundingClientRect().top)+'px)';}
  const width=rect.width,options={duration:300,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'};
  const leaving=outgoing.animate([{transform:'translate3d('+offset+'px,0,0)'},{transform:'translate3d('+(-delta*width)+'px,0,0)'}],options);
  const entering=incoming.animate([{transform:'translate3d('+(delta*width+offset)+'px,0,0)'},{transform:'translate3d(0,0,0)'}],options);
  let done=false;const finish=()=>{if(done)return;done=true;layer.remove();leaving.cancel();entering.cancel();busy=false;root.classList.remove('page-transitioning');if(uiPageSlideCleanup===finish)uiPageSlideCleanup=null;};uiPageSlideCleanup=finish;
  try{performance.mark('dagongren.page.slide',{detail:{from,to,direction:delta,duration:300}});}catch{}
  Promise.all([leaving.finished,entering.finished]).catch(()=>{}).then(finish);
 };
 root.addEventListener('pointerdown',event=>{
  if(event.pointerType==='touch'&&event.target.closest?.('.profile-chart-panel'))return;
  if(gesture)reset();
  if(busy||event.isPrimary===false||event.button>0||api.blocked?.()||!['home','calendar','records','settings'].includes(api.current()))return;
  if(event.target.closest?.('[data-calendar-swipe],.profile-name-viewport,.entry-filters,.month-control,.record-year-trigger,input,textarea,select,.select-trigger,[role=dialog]'))return;
  const width=document.documentElement.clientWidth;if(event.clientX<18||event.clientX>width-18)return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,time:event.timeStamp,drag:false,view:api.current()};
 },{passive:true});
 root.addEventListener('pointermove',event=>{
  if(!gesture||gesture.touch||event.pointerId!==gesture.id)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(!gesture.drag&&Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)*1.1){reset();return;}
  if(Math.abs(dx)>16&&Math.abs(dx)>Math.abs(dy)*1.35)gesture.drag=true;
  gesture.dx=dx;
  if(gesture.drag){if(event.cancelable)event.preventDefault();if(!root.hasPointerCapture?.(event.pointerId))root.setPointerCapture?.(event.pointerId);root.classList.add('is-paging');uiDrag(root.style,'--page-drag',uiSwipeOffset(dx)+'px');}
 },{passive:false});
 root.addEventListener('pointerup',event=>{
  if(!gesture||gesture.touch||event.pointerId!==gesture.id)return;
  const from=gesture.view,dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  const delta=calendarSwipeDelta(dx,dy,event.timeStamp-gesture.time),drag=gesture.drag||Boolean(delta),target=pageSwipeTarget(from,delta),offset=uiSwipeOffset(dx);
  if(drag){blockedUntil=Date.now()+250;if(event.cancelable)event.preventDefault();}
  reset();if(target)change(from,target,delta,offset);
 },{passive:false});
 root.addEventListener('pointercancel',()=>{if(!gesture?.touch)reset();},{passive:true});
 root.addEventListener('touchstart',event=>{
  if(!event.target.closest?.('.profile-chart-panel'))return;
  if(gesture)reset();
  if(busy||event.touches.length!==1||api.blocked?.()||api.current()!=='settings')return;
  const touch=event.touches[0],width=document.documentElement.clientWidth;if(touch.clientX<18||touch.clientX>width-18)return;
  gesture={id:touch.identifier,touch:true,x:touch.clientX,y:touch.clientY,dx:0,time:event.timeStamp,drag:false,view:api.current()};
 },{passive:true});
 root.addEventListener('touchmove',event=>{
  if(!gesture?.touch)return;const touch=[...event.touches].find(item=>item.identifier===gesture.id);if(!touch||event.touches.length!==1){reset();return;}
  const dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;
  if(!gesture.drag&&Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)*1.1){reset();return;}
  if(Math.abs(dx)>16&&Math.abs(dx)>Math.abs(dy)*1.35)gesture.drag=true;
  gesture.dx=dx;if(gesture.drag){if(event.cancelable)event.preventDefault();root.classList.add('is-paging');uiDrag(root.style,'--page-drag',uiSwipeOffset(dx)+'px');}
 },{passive:false});
 root.addEventListener('touchend',event=>{
  if(!gesture?.touch)return;const touch=[...event.changedTouches].find(item=>item.identifier===gesture.id);if(!touch)return;
  const from=gesture.view,dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y,delta=calendarSwipeDelta(dx,dy,event.timeStamp-gesture.time),target=pageSwipeTarget(from,delta),offset=uiSwipeOffset(dx);
  if(gesture.drag||delta){blockedUntil=Date.now()+250;if(event.cancelable)event.preventDefault();}
  reset();if(target)change(from,target,delta,offset);
 },{passive:false});
 root.addEventListener('touchcancel',()=>{if(gesture?.touch)reset();},{passive:true});
 root.addEventListener('click',event=>{if(event.isTrusted&&Date.now()<blockedUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
 return reset;
}
