let uiRenderedView='',uiRollCleanups=[],uiActiveChoice=null;
const uiEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function uiKey(node,root){const parts=[];for(let n=node;n&&n!==root;n=n.parentElement)parts.unshift(n.tagName+':'+[...n.parentElement.children].indexOf(n));return parts.join('/');}
function uiPatch(oldNode,newNode){
 if(oldNode.nodeType!==newNode.nodeType||oldNode.nodeName!==newNode.nodeName){oldNode.replaceWith(newNode.cloneNode(true));return;}
 if(oldNode.nodeType===3){if(oldNode.nodeValue!==newNode.nodeValue)oldNode.nodeValue=newNode.nodeValue;return;}if(oldNode.nodeType!==1)return;
 for(const attr of [...oldNode.attributes])if(!newNode.hasAttribute(attr.name))oldNode.removeAttribute(attr.name);
 for(const attr of [...newNode.attributes])if(oldNode.getAttribute(attr.name)!==attr.value)oldNode.setAttribute(attr.name,attr.value);
 const existing=[...oldNode.childNodes],incoming=[...newNode.childNodes];
 for(let i=0;i<Math.max(existing.length,incoming.length);i++){if(!incoming[i])existing[i].remove();else if(!existing[i])oldNode.appendChild(incoming[i].cloneNode(true));else uiPatch(existing[i],incoming[i]);}
 if(oldNode.tagName==='SELECT')oldNode.value=newNode.value;
}
export function renderStable(root,markup,view,motion=true){
 const template=document.createElement?.('template');if(!template?.content){root.innerHTML=markup;return;}
 for(const finish of uiRollCleanups)finish();uiRollCleanups=[];const same=uiRenderedView===view,oldNumbers=new Map();
 if(same)for(const node of root.querySelectorAll('.number,.day-wage'))oldNumbers.set(uiKey(node,root),node.textContent);
 const scrollX=window.scrollX||0,scrollY=window.scrollY||0;template.innerHTML=markup;
 if(same){const existing=[...root.childNodes],incoming=[...template.content.childNodes];for(let i=0;i<Math.max(existing.length,incoming.length);i++){if(!incoming[i])existing[i].remove();else if(!existing[i])root.appendChild(incoming[i].cloneNode(true));else uiPatch(existing[i],incoming[i]);}}
 else root.replaceChildren(template.content);
 root.classList.toggle('stable-query',same);uiRenderedView=view;if(same)window.scrollTo({left:scrollX,top:scrollY,behavior:'instant'});
 if(!same||!motion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 for(const node of root.querySelectorAll('.number,.day-wage')){
  const old=oldNumbers.get(uiKey(node,root)),finalText=node.textContent;if(!old||old===finalText)continue;
  const before=old.match(/\d[\d,]*(?:\.\d+)?/)?.[0];if(!before)continue;
  const walker=document.createTreeWalker(node,4);let textNode,match;while((textNode=walker.nextNode())){match=textNode.nodeValue.match(/\d[\d,]*(?:\.\d+)?/);if(match)break;}if(!textNode||!match)continue;
  const original=textNode.nodeValue,target=match[0],previous=before.replace(/\D/g,''),nextDigits=target.replace(/\D/g,'');if(previous===nextDigits)continue;
  const fragment=document.createDocumentFragment(),wrapper=document.createElement('span');wrapper.className='number-roll';wrapper.setAttribute('aria-hidden','true');let digitIndex=0;
  for(const char of target){
   if(!/\d/.test(char)){wrapper.appendChild(document.createTextNode(char));continue;}
   const oldDigit=previous[digitIndex+previous.length-nextDigits.length]||'0';digitIndex++;
   if(oldDigit===char){wrapper.appendChild(document.createTextNode(char));continue;}
   const slot=document.createElement('span');slot.className='number-roll-slot';const strip=document.createElement('span');strip.className='number-roll-strip';
   const from=document.createElement('span'),to=document.createElement('span');from.textContent=oldDigit;to.textContent=char;strip.append(from,to);slot.appendChild(strip);wrapper.appendChild(slot);
  }
  fragment.append(document.createTextNode(original.slice(0,match.index)),wrapper,document.createTextNode(original.slice(match.index+target.length)));
  const anchor=document.createElement('span');anchor.className='number-roll-anchor';anchor.appendChild(fragment);textNode.replaceWith(anchor);
  const priorLabel=node.getAttribute('aria-label');node.setAttribute('aria-label',finalText);let done=false,timeout;
  const finish=()=>{if(done)return;done=true;clearTimeout(timeout);if(anchor.isConnected)anchor.replaceWith(document.createTextNode(original));if(priorLabel===null)node.removeAttribute('aria-label');else node.setAttribute('aria-label',priorLabel);};
  timeout=setTimeout(finish,460);uiRollCleanups.push(finish);
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
 const bridge=globalThis.AndroidFiles;
 if(!enabled||!document.body.appendChild||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||bridge?.shouldPlayIntro?.()===false){bridge?.introStyle?.(false);return;}bridge?.introStyle?.(true);
 const intro=document.createElement('div');intro.className='brand-intro';intro.setAttribute('role','status');intro.setAttribute('aria-label','打工人，正在打开账本');
 intro.innerHTML='<div class="intro-grid"></div><div class="intro-orbit"></div><div class="intro-wordmark"><svg viewBox="0 0 330 125" fill="none" aria-hidden="true"><defs><linearGradient id="intro-ink" x1="0" y1="0" x2="330" y2="125" gradientUnits="userSpaceOnUse"><stop stop-color="#ebf8ff"/><stop offset=".55" stop-color="#cceaff"/><stop offset="1" stop-color="#68c9ff"/></linearGradient></defs><g stroke="url(#intro-ink)" stroke-width="8" stroke-linecap="square" stroke-linejoin="bevel"><path pathLength="1" d="M8 37H43M26 13V100L17 106M8 73L43 55"/><path pathLength="1" d="M53 27H95M78 27V100L66 106"/><path pathLength="1" d="M132 27H192M162 27V101M125 101H201"/><path pathLength="1" d="M274 14C274 54 261 84 234 105M271 51C282 79 296 96 318 106"/></g></svg><p>工资有数，生活有底</p></div><div class="intro-progress"><span></span></div>';
 document.body.classList.add('intro-playing');document.body.appendChild(intro);const finish=()=>{intro.classList.add('leaving');setTimeout(()=>{intro.remove();document.body.classList.remove('intro-playing');bridge?.introStyle?.(false);},260);};setTimeout(finish,1050);return finish;
}
