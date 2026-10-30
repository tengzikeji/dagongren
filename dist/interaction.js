import {bindPageSwipe,bindCalendarSwipe} from './gestures.js';
export {calendarSwipeDelta,pageSwipeTarget,swipeAxis,swipeVelocity,swipeDecision,swipeOffset} from './gestures.js';
const uiRollingNodes=new Map();
let uiRenderedView='',uiRenderedTheme='',uiRollCleanups=[],uiActiveChoice=null,uiResizeObserver=null,uiObservedWidth=0;
const uiEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function uiKey(node,root){
 const metric=node.closest?.('[data-metric]');
 if(metric){const group=node.closest?.('.balance-hero,.calendar-summary,.ledger-overview,.month-account,.annual-board,.settlement-chart,.today-insight');return ['metric',group?.classList?.[0]||metric.dataset.ref||'',metric.dataset.metric,metric.dataset.scope||'all'].join(':');}
 const date=node.closest?.('.calendar-day[data-date]')?.dataset.date;
 if(date)return 'day-wage:'+date;
 const parts=[];for(let n=node;n&&n!==root;n=n.parentElement)parts.unshift(n.tagName+':'+[...n.parentElement.children].indexOf(n));return parts.join('/');
}
function uiPatch(oldNode,newNode){
 if(oldNode.id==='view-content'&&newNode.id==='view-content'&&oldNode.className!==newNode.className){oldNode.replaceWith(newNode.cloneNode(true));return;}
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
 uiRollNumbers(root,oldNumbers,same,motion,themeChanged,replayNumbers);
}
function uiRollNumbers(root,oldNumbers,same,motion,themeChanged=false,replayNumbers=false){
 if(!motion||root.classList.contains('motion-off')||document.body.classList.contains('motion-off')||root.classList.contains('page-transitioning')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
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
  uiRollingNodes.set(node,{text:finalText,number:target,original,priorLabel,finish});
  timeout=setTimeout(finish,Math.max(...plan.map(x=>x.delay+x.duration))+60);uiRollCleanups.push(finish);
 }
}
// Prepare an inert page without ending any live number animation during a tap.
function snapshotFinalNumbers(source){
 const clone=source.cloneNode(true);if(!uiRollingNodes.size)return clone;
 const live=[...source.querySelectorAll('.number')],copies=[...clone.querySelectorAll('.number')];
 for(let i=0;i<live.length;i++){
  const state=uiRollingNodes.get(live[i]),target=copies[i];if(!state||!target)continue;
  target.querySelector('.number-roll-anchor')?.replaceWith(document.createTextNode(state.original));
  if(state.priorLabel===null)target.removeAttribute('aria-label');else target.setAttribute('aria-label',state.priorLabel);
 }
 return clone;
}
export function closeChoicePicker(){
 if(!uiActiveChoice)return false;const {panel,children,trigger,modal}=uiActiveChoice;uiActiveChoice=null;panel.remove();modal.classList.remove('choosing','record-date-choosing');
 for(const child of children){child.inert=false;child.removeAttribute('aria-hidden');}trigger?.focus({preventScroll:true});return true;
}
export function openChoicePanel(root,trigger,panel){
 closeChoicePicker();const modal=root.querySelector('.modal');if(!modal)return false;
 const children=[...modal.children];for(const child of children){child.inert=true;child.setAttribute('aria-hidden','true');}
 modal.classList.add('choosing');if(panel.classList.contains('record-date-sheet'))modal.classList.add('record-date-choosing');
 modal.appendChild(panel);uiActiveChoice={panel,children,trigger,modal};return true;
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
export function playBrandIntro(enabled=true,onComplete=null){return globalThis.dagongrenIntro?.play(enabled,onComplete);}

export function installPageSwipe(root,api){return bindPageSwipe(root,{...api,snapshot:snapshotFinalNumbers,fitPreview:fitCompanyNames,before(){api.before?.();},settled(completed,to){if(completed)uiRollNumbers(root,new Map(),false,true);api.settled?.(completed,to);}});}
export function installCalendarSwipe(root,api){return bindCalendarSwipe(root,api);}
