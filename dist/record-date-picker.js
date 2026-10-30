import {validDate,daysInMonth,shiftMonth} from './payroll.js';
import {openChoicePanel,closeChoicePicker} from './interaction.js';

const entryDateCalendarIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h3"/></svg>';
function entryDateEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function entryDateLabel(date){return validDate(date)?date.replaceAll('-','/'):'选择日期';}
export function entryDateWeekday(date){return validDate(date)?'星期'+['日','一','二','三','四','五','六'][new Date(date+'T12:00:00Z').getUTCDay()]:'';}
export function entryDateFieldMarkup(id,label,name,value,bounds){
 return '<div class="field entry-date-field"><label id="'+id+'-label" for="'+id+'-trigger">'+entryDateEscape(label)+'</label><input type="hidden" id="'+id+'" name="'+name+'" value="'+entryDateEscape(value)+'" data-record-date="'+entryDateEscape(label)+'" data-date-policy="'+entryDateEscape(bounds.policy||'entry')+'" data-date-min="'+bounds.min+'" data-date-max="'+bounds.max+'"><button type="button" id="'+id+'-trigger" class="entry-date-trigger" data-date-for="'+id+'" aria-haspopup="dialog" aria-labelledby="'+id+'-label '+id+'-value"><span class="entry-date-icon">'+entryDateCalendarIcon+'</span><span class="entry-date-copy"><strong id="'+id+'-value" data-date-value>'+entryDateLabel(value)+'</strong><small data-date-weekday>'+entryDateWeekday(value)+'</small></span><span class="entry-date-arrow" aria-hidden="true">⌄</span></button><p class="entry-date-meta" data-date-meta></p></div>';
}
export function entryCalendarCells(month){
 const first=(new Date(month+'-01T12:00:00Z').getUTCDay()+6)%7,count=daysInMonth(month);
 return Array.from({length:42},(_,index)=>{const day=index-first+1;return day>0&&day<=count?month+'-'+String(day).padStart(2,'0'):'';});
}
export function enhanceRecordDates(root,options={}){
 if(!root.querySelectorAll)return;
 for(const input of root.querySelectorAll('input[data-record-date]:not([data-date-enhanced])')){
  const trigger=root.querySelector('[data-date-for="'+input.id+'"]');if(!trigger)continue;input.dataset.dateEnhanced='true';
  const min=input.dataset.dateMin||options.min||'2020-01-01',max=input.dataset.dateMax||options.max||'2089-12-31';
  const allowed=date=>validDate(date)&&date>=min&&date<=max&&(!options.allowed||options.allowed(date,input));
  const describe=date=>options.describe?.(date,input)||'';
  const update=()=>{const value=trigger.querySelector('[data-date-value]'),weekday=trigger.querySelector('[data-date-weekday]'),meta=trigger.parentElement.querySelector('[data-date-meta]');if(value)value.textContent=entryDateLabel(input.value);if(weekday)weekday.textContent=entryDateWeekday(input.value);if(meta)meta.textContent=describe(input.value);};
  update();input.addEventListener('change',update);input.addEventListener('input',update);
  trigger.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();document.activeElement?.blur?.();
   let selected=allowed(input.value)?input.value:allowed(options.today)?options.today:min;
   if(!allowed(selected)){selected='';for(let month=min.slice(0,7);month<=max.slice(0,7)&&!selected;month=shiftMonth(month,1))selected=entryCalendarCells(month).find(allowed)||'';}
   if(!selected)return;
   let month=selected.slice(0,7),mode='days';const panel=document.createElement('div');panel.className='choice-sheet record-date-sheet';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','选择'+(input.dataset.recordDate||'日期'));
   panel.innerHTML='<div class="choice-header date-sheet-header"><button type="button" class="choice-back" data-date-action="cancel" aria-label="返回记账表单">‹</button><div><small>日期选择</small><h3>'+entryDateEscape(input.dataset.recordDate||'记录日期')+'</h3></div><button type="button" class="choice-close icon-button" data-date-action="close" aria-label="关闭全部菜单">×</button></div><div class="date-sheet-body"><div class="date-selection"><span>已选日期</span><strong data-date-preview></strong><p data-date-description></p></div><div class="date-calendar-toolbar"><button type="button" class="date-month-arrow" data-date-action="previous" aria-label="上一个月">‹</button><div class="date-calendar-heading"><button type="button" data-date-action="years" data-date-year></button><button type="button" data-date-action="months" data-date-month></button></div><button type="button" class="date-month-arrow" data-date-action="next" aria-label="下一个月">›</button></div><div class="date-calendar-content"></div></div><div class="date-sheet-footer"><div class="date-sheet-tools"><button type="button" data-date-action="today">回到今天</button><span>可切换年份、月份</span></div><div class="date-sheet-actions"><button type="button" class="btn date-cancel" data-date-action="cancel">取消</button><button type="button" class="btn btn-primary" data-date-action="confirm">确认日期</button></div></div>';
   function monthHasDates(value){return value>=min.slice(0,7)&&value<=max.slice(0,7)&&entryCalendarCells(value).some(allowed);}
   function draw(){
    const year=Number(month.slice(0,4)),number=Number(month.slice(5,7)),content=panel.querySelector('.date-calendar-content');
    panel.dataset.dateMode=mode;panel.querySelector('[data-date-preview]').textContent=Number(selected.slice(5,7))+'月'+Number(selected.slice(8))+'日';
    panel.querySelector('[data-date-description]').textContent=selected.slice(0,4)+'年 · '+entryDateWeekday(selected)+(describe(selected)?'\n'+describe(selected):'');
    panel.querySelector('[data-date-year]').textContent=year+'年';panel.querySelector('[data-date-month]').textContent=number+'月';
    panel.querySelector('[data-date-action=previous]').disabled=mode!=='days'||shiftMonth(month,-1)<min.slice(0,7);
    panel.querySelector('[data-date-action=next]').disabled=mode!=='days'||shiftMonth(month,1)>max.slice(0,7);
    panel.querySelector('[data-date-action=today]').disabled=!allowed(options.today);
    if(mode==='years'){
     content.innerHTML='<p class="date-grid-title">选择年份 · 2020—2089</p><div class="date-years">'+Array.from({length:70},(_,i)=>2020+i).map(value=>'<button type="button" data-date-year-value="'+value+'" class="'+(value===year?'selected':'')+'" '+(value<Number(min.slice(0,4))||value>Number(max.slice(0,4))?'disabled':'')+'>'+value+'年</button>').join('')+'</div>';
    }else if(mode==='months'){
     content.innerHTML='<p class="date-grid-title">选择月份</p><div class="date-months">'+Array.from({length:12},(_,i)=>{const value=year+'-'+String(i+1).padStart(2,'0');return '<button type="button" data-date-month-value="'+value+'" class="'+(i+1===number?'selected':'')+'" '+(!monthHasDates(value)?'disabled':'')+'>'+(i+1)+'月</button>';}).join('')+'</div>';
    }else{
     content.innerHTML='<div class="date-weekdays">'+['一','二','三','四','五','六','日'].map(day=>'<span>'+day+'</span>').join('')+'</div><div class="date-days">'+entryCalendarCells(month).map((date,index)=>date?'<button type="button" data-date-value="'+date+'" aria-label="'+date+' '+entryDateWeekday(date)+'" aria-pressed="'+(date===selected)+'" class="'+[date===selected?'selected':'',date===options.today?'is-today':'',index%7>4?'weekend':''].join(' ')+'" '+(!allowed(date)?'disabled':'')+'><span>'+Number(date.slice(8))+'</span>'+(date===options.today?'<i aria-hidden="true"></i>':'')+'</button>':'<span aria-hidden="true"></span>').join('')+'</div>';
    }
   }
   function resetScroll(){panel.querySelector('.date-sheet-body').scrollTop=0;if(mode==='years')panel.querySelector('[data-date-year-value="'+month.slice(0,4)+'"]')?.scrollIntoView({block:'nearest'});}
   panel.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;event.preventDefault();event.stopPropagation();
    if(button.dataset.dateValue){selected=button.dataset.dateValue;draw();return;}
    if(button.dataset.dateYearValue){month=button.dataset.dateYearValue+month.slice(4);mode='months';draw();resetScroll();return;}
    if(button.dataset.dateMonthValue){month=button.dataset.dateMonthValue;mode='days';draw();resetScroll();return;}
    const action=button.dataset.dateAction;
    if(action==='cancel'){closeChoicePicker();return;}
    if(action==='close'){closeChoicePicker();root.querySelector('.modal-close')?.click();return;}
    if(action==='confirm'){if(!allowed(selected))return;input.value=selected;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));update();closeChoicePicker();return;}
    if(action==='years')mode=mode==='years'?'days':'years';else if(action==='months')mode=mode==='months'?'days':'months';
    else if(action==='previous')month=shiftMonth(month,-1);else if(action==='next')month=shiftMonth(month,1);else if(action==='today'){selected=options.today;month=selected.slice(0,7);mode='days';}
    draw();resetScroll();
   });
   panel.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;const controls=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(node=>node.getClientRects().length);const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}event.stopPropagation();
   });
   if(openChoicePanel(root,trigger,panel)){draw();panel.querySelector('.choice-back').focus({preventScroll:true});}
  });
 }
}
