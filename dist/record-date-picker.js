import {validDate,validMonth,daysInMonth} from './payroll.js';
import {createDateWheelModel} from './date-wheel.js';
import {openChoicePanel,closeChoicePicker} from './interaction.js';

const entryDateCalendarIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h3"/></svg>';
const dateWheelRoots=new WeakMap();let dateWheelSerial=0;
function entryDateEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function entryDateLabel(value,kind='date'){
 if(kind==='day')return /^\d{1,2}$/.test(value)?'每月 '+Number(value)+' 日':'选择日期';
 if(kind==='year')return /^\d{4}$/.test(value)?value+'年':'选择年份';
 return (kind==='month'?validMonth(value):validDate(value))?value.replaceAll('-','/'):'选择'+(kind==='month'?'月份':'日期');
}
export function entryDateWeekday(date){return validDate(date)?'星期'+['日','一','二','三','四','五','六'][new Date(date+'T12:00:00Z').getUTCDay()]:'';}
export function entryDateFieldMarkup(id,label,name,value,bounds){
 const kind=bounds.kind||'date';
 return '<div class="field entry-date-field entry-date-'+kind+'"><label id="'+id+'-label" for="'+id+'-trigger">'+entryDateEscape(label)+'</label><input type="hidden" id="'+id+'" '+(name?'name="'+name+'" ':'')+'value="'+entryDateEscape(value)+'" data-record-date="'+entryDateEscape(label)+'" data-wheel-kind="'+kind+'" data-date-policy="'+entryDateEscape(bounds.policy||'entry')+'" data-date-min="'+bounds.min+'" data-date-max="'+bounds.max+'"><button type="button" id="'+id+'-trigger" class="entry-date-trigger" data-date-for="'+id+'" aria-haspopup="dialog" aria-labelledby="'+id+'-label '+id+'-value"><span class="entry-date-icon">'+entryDateCalendarIcon+'</span><span class="entry-date-copy"><strong id="'+id+'-value" data-date-value>'+entryDateLabel(value,kind)+'</strong><small data-date-weekday>'+entryDateWeekday(value)+'</small></span><span class="entry-date-arrow" aria-hidden="true">⌄</span></button><p class="entry-date-meta" data-date-meta></p></div>';
}
export function entryCalendarCells(month){const first=(new Date(month+'-01T12:00:00Z').getUTCDay()+6)%7,count=daysInMonth(month);return Array.from({length:42},(_,index)=>{const day=index-first+1;return day>0&&day<=count?month+'-'+String(day).padStart(2,'0'):'';});}
export function showDateWheel(root,trigger,options={}){
 if(!document.createElement||!root.querySelector)return false;
 const panel=document.createElement('div');if(!panel.addEventListener)return false;
 const model=createDateWheelModel(options),serial=++dateWheelSerial,columns=new Map(),labels={year:'年',month:'月',day:'日'},timers=new Map(),touches=new Set();let disposed=false,ready=false,sizeObserver=null;
 panel.className='choice-sheet record-date-sheet date-wheel-sheet';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','选择'+(options.label||'日期'));panel.dataset.wheelKind=model.kind;
 panel.innerHTML='<div class="choice-header date-sheet-header"><button type="button" class="choice-back" data-date-action="cancel" aria-label="返回上一级">‹</button><div><small>滚动选择</small><h3>'+entryDateEscape(options.label||'日期')+'</h3></div><button type="button" class="choice-close icon-button" data-date-action="close" aria-label="关闭全部菜单">×</button></div><div class="date-sheet-body date-wheel-body"><div class="date-selection"><span>已选'+(model.kind==='year'?'年份':model.kind==='month'?'月份':'日期')+'</span><strong data-date-preview></strong><p data-date-description></p></div><div class="date-wheel-stage"><div class="date-wheel-band" aria-hidden="true"></div><div class="date-wheel-columns"></div></div><p class="date-wheel-hint">上下滑动，在中间高亮处选定</p></div><div class="date-sheet-footer"><div class="date-sheet-tools"><button type="button" data-date-action="today">'+(model.kind==='year'?'回到今年':model.kind==='month'?'回到本月':'回到今天')+'</button><span>'+entryDateEscape(options.hint||'取消不会改变原来的选择')+'</span></div><div class="date-sheet-actions"><button type="button" class="btn date-cancel" data-date-action="cancel">取消</button><button type="button" class="btn btn-primary" data-date-action="confirm">'+entryDateEscape(options.confirmLabel||'确认选择')+'</button></div></div>';
 const holder=panel.querySelector('.date-wheel-columns');holder.style.setProperty('--wheel-columns',model.parts.length);
 const rowHeight=column=>column.node.firstElementChild?.getBoundingClientRect().height||44;
 function position(column,behavior='auto'){const index=column.values.findIndex(value=>value.selected);if(index<0)return;const top=index*rowHeight(column);column.expected=top;column.node.scrollTo({top,behavior});}
 function preview(){
  const state=model.state();panel.dataset.wheelValue=state.value;for(const part of model.parts)panel.dataset['selected'+part[0].toUpperCase()+part.slice(1)]=String(state[part]);
  panel.querySelector('[data-date-preview]').textContent=model.kind==='date'?state.year+'年 '+state.month+'月 '+state.day+'日':model.kind==='month'?state.year+'年 '+state.month+'月':model.kind==='year'?state.year+'年':'每月 '+state.day+'日';
  panel.querySelector('[data-date-description]').textContent=[model.kind==='date'?entryDateWeekday(state.value):'',options.describe?.(state.value)||''].filter(Boolean).join(' · ');
 }
 function render(active=''){
  preview();for(const part of model.parts){
   const column=columns.get(part),values=model.options(part),signature=values.map(value=>value.value+':'+value.disabled).join('|'),changed=column.signature!==signature;column.values=values;
   if(changed){column.signature=signature;column.node.innerHTML=values.map(value=>'<div id="wheel-'+serial+'-'+part+'-'+value.value+'" class="date-wheel-option" role="option" data-wheel-value="'+value.value+'" aria-selected="'+value.selected+'" aria-disabled="'+value.disabled+'">'+value.label+'</div>').join('');}
   for(let index=0;index<values.length;index++){const selected=String(values[index].selected);if(column.node.children[index].getAttribute('aria-selected')!==selected)column.node.children[index].setAttribute('aria-selected',selected);}
   const selected=values.find(value=>value.selected);column.node.setAttribute('aria-activedescendant','wheel-'+serial+'-'+part+'-'+selected.value);if(ready&&(part!==active||changed))position(column);
  }
 }
 function choose(part,value,userInitiated=false,active=''){const changed=model.select(part,value);if(changed)render(active);if(changed&&userInitiated)options.feedback?.({userInitiated:true});return changed;}
 function settle(part){
  if(disposed||touches.has(part))return;clearTimeout(timers.get(part));const column=columns.get(part),index=Math.max(0,Math.min(column.values.length-1,Math.round(column.node.scrollTop/rowHeight(column))));
  choose(part,column.values[index].value,column.manual,part);position(column);column.manual=false;
 }
 for(const part of model.parts){
  const wrapper=document.createElement('div');wrapper.className='date-wheel-column';wrapper.innerHTML='<div class="date-wheel-label" aria-hidden="true">'+labels[part]+'</div><div class="date-wheel-scroll" data-wheel-part="'+part+'" role="listbox" tabindex="0" aria-label="选择'+labels[part]+'"></div>';holder.appendChild(wrapper);
  const node=wrapper.lastElementChild,column={node,values:[],signature:'',expected:null,manual:false,frame:0};columns.set(part,column);
  node.addEventListener('touchstart',()=>{touches.add(part);column.manual=true;column.expected=null;clearTimeout(timers.get(part));},{passive:true});
  for(const name of ['touchend','touchcancel'])node.addEventListener(name,()=>{touches.delete(part);clearTimeout(timers.get(part));timers.set(part,setTimeout(()=>settle(part),140));},{passive:true});
  node.addEventListener('wheel',()=>{column.manual=true;column.expected=null;},{passive:true});
  node.addEventListener('scroll',()=>{
   if(!ready||disposed)return;const actual=node.scrollTop;if(column.expected!==null&&Math.abs(actual-column.expected)<.6){column.expected=null;return;}column.expected=null;
   if(!column.frame)column.frame=requestAnimationFrame(()=>{column.frame=0;if(disposed)return;const index=Math.max(0,Math.min(column.values.length-1,Math.round(node.scrollTop/rowHeight(column))));choose(part,column.values[index].value,column.manual,part);});
   clearTimeout(timers.get(part));timers.set(part,setTimeout(()=>settle(part),140));
  },{passive:true});
  node.addEventListener('scrollend',()=>settle(part));
  node.addEventListener('click',event=>{const row=event.target.closest('[data-wheel-value]');if(!row||row.getAttribute('aria-disabled')==='true')return;event.preventDefault();column.manual=false;choose(part,row.dataset.wheelValue,true,part);position(column,'smooth');});
  node.addEventListener('keydown',event=>{const index=column.values.findIndex(value=>value.selected),delta={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5}[event.key];let next=event.key==='Home'?0:event.key==='End'?column.values.length-1:delta===undefined?null:Math.max(0,Math.min(column.values.length-1,index+delta));if(next===null)return;event.preventDefault();event.stopPropagation();choose(part,column.values[next].value,true,part);position(column,'smooth');});
 }
 panel.addEventListener('click',event=>{
  const button=event.target.closest('[data-date-action]');if(!button||button.disabled)return;event.preventDefault();event.stopPropagation();const action=button.dataset.dateAction;
  if(action==='cancel'){closeChoicePicker();return;}if(action==='close'){closeChoicePicker();root.querySelector('.modal-close')?.click();return;}
  if(action==='today'){model.setValue(options.today);render();return;}
  if(action==='confirm'){for(const part of model.parts){touches.delete(part);settle(part);}const value=model.value();if(!model.allows(value))return;closeChoicePicker();options.onConfirm?.(value);}
 });
 panel.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const controls=[...panel.querySelectorAll('button:not(:disabled),[role=listbox]')].filter(node=>node.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}event.stopPropagation();});
 panel.onDateWheelClose=()=>{disposed=true;sizeObserver?.disconnect();for(const timer of timers.values())clearTimeout(timer);for(const column of columns.values())if(column.frame)cancelAnimationFrame(column.frame);options.onClose?.();};
 panel.querySelector('[data-date-action=today]').disabled=!model.allows(options.today||'');
 if(!openChoicePanel(root,trigger,panel))return false;render();ready=true;for(const column of columns.values())position(column);if(typeof ResizeObserver==='function'){sizeObserver=new ResizeObserver(()=>{if(!disposed&&!touches.size)for(const column of columns.values())position(column);});sizeObserver.observe(holder);}panel.querySelector('.choice-back').focus({preventScroll:true});return panel;
}
function refreshDateField(root,input,options){
 const trigger=root.querySelector('[data-date-for="'+input.id+'"]');if(!trigger)return;const kind=input.dataset.wheelKind||'date',value=trigger.querySelector('[data-date-value]'),weekday=trigger.querySelector('[data-date-weekday]'),meta=trigger.parentElement.querySelector('[data-date-meta]');
 if(value)value.textContent=entryDateLabel(input.value,kind);if(weekday)weekday.textContent=kind==='date'?entryDateWeekday(input.value):'';if(meta)meta.textContent=options.describe?.(input.value,input)||'';
}
export function enhanceRecordDates(root,options={}){
 if(!root?.querySelectorAll)return;const prior=dateWheelRoots.get(root);if(prior)prior.options=options;for(const input of root.querySelectorAll('input[data-record-date]'))refreshDateField(root,input,options);if(prior||!root.addEventListener)return;
 const record={options};dateWheelRoots.set(root,record);for(const name of ['input','change'])root.addEventListener(name,event=>{if(event.target.matches?.('input[data-record-date]'))refreshDateField(root,event.target,record.options);});
 root.addEventListener('click',event=>{
  const trigger=event.target.closest?.('[data-date-for]');if(!trigger||!root.contains(trigger))return;const input=root.querySelector('#'+trigger.dataset.dateFor);if(!input)return;event.preventDefault();event.stopPropagation();document.activeElement?.blur?.();
  const active=record.options,kind=input.dataset.wheelKind||'date';const config={kind,label:input.dataset.recordDate,value:input.value,min:input.dataset.dateMin,max:input.dataset.dateMax,today:kind==='year'?active.today?.slice(0,4):kind==='month'?active.today?.slice(0,7):kind==='day'?'':active.today,allowed:value=>!active.allowed||active.allowed(value,input),describe:value=>active.describe?.(value,input)||'',feedback:active.feedback,onConfirm:value=>{input.value=value;refreshDateField(root,input,active);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}};
  if(active.open)active.open(trigger,config);else showDateWheel(root,trigger,config);
 });
}
