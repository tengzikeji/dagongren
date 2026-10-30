import {validDate,validMonth,daysInMonth,datesBetween,shiftMonth,leaveDeducts} from './payroll.js';

// Form-level routing only. Payroll and settlement continue to consume the same monthly records.
export function entryRecordForMonth(book,month){
 return book.months[month]||{...book.defaults,leaves:[],overtime:[],advances:[],payments:[],payment:null};
}
export function entryDateIssue(book,date){
 if(!validDate(date))return '请选择2020至2089年内的有效日期。';
 const record=entryRecordForMonth(book,date.slice(0,7)),join=record.joinDate||book.defaults.joinDate;
 return validDate(join)&&date<join?'记录日期不能早于该主体的入职日期。':'';
}
export function entryDateBounds(book){
 const joins=[book.defaults.joinDate,...Object.values(book.months).map(record=>record.joinDate)].filter(validDate).sort();
 return {min:joins[0]||'2020-01-01',max:'2089-12-31'};
}
export function entryRangeDates(start,end){
 if(!validDate(start)||!validDate(end)||start>end)return [];
 const dates=[];for(let month=start.slice(0,7);month<=end.slice(0,7);month=shiftMonth(month,1)){
  const first=start>month+'-01'?start:month+'-01',last=end<month+'-'+daysInMonth(month)?end:month+'-'+daysInMonth(month);
  dates.push(...datesBetween(first,last));
 }
 return dates;
}
export function planLeaveEntry(book,{sourceMonth,editingId=null,start,end,days,mode='defaults',note='',makeId}){
 if(!validDate(start)||!validDate(end)||start>end)throw new Error('请选择有效的开始和结束日期。');
 if(![.5,1].includes(days)||!['defaults','yes','no'].includes(mode))throw new Error('请选择有效时长和扣款方式。');
 const dates=entryRangeDates(start,end);if(dates.length>1&&days===.5)throw new Error('半天请假请选择同一天。');
 if(note.length>60)throw new Error('备注请控制在60字以内。');
 for(const date of dates){
  const issue=entryDateIssue(book,date);if(issue)throw new Error(issue.replace('记录日期','请假日期'));
  const month=date.slice(0,7),record=entryRecordForMonth(book,month);
  if((record.leaves||[]).some(item=>item.date===date&&!(month===sourceMonth&&item.id===editingId)))throw new Error(date+'已有记录，请编辑原记录。');
 }
 const months={...book.months},changedMonths=new Set(),items=[];
 if(editingId){const record=entryRecordForMonth(book,sourceMonth);months[sourceMonth]={...record,leaves:(record.leaves||[]).filter(item=>item.id!==editingId)};changedMonths.add(sourceMonth);}
 for(const date of dates){
  const month=date.slice(0,7),record=months[month]||entryRecordForMonth(book,month);
  const item={id:editingId&&dates.length===1?editingId:makeId(),date,days,note,deduct:mode==='yes'?true:mode==='no'?false:leaveDeducts({date},book.defaults)};
  months[month]={...record,leaves:[...(record.leaves||[]),item]};changedMonths.add(month);items.push(item);
 }
 return {months,items,changedMonths:[...changedMonths],firstMonth:start.slice(0,7)};
}
export function planDatedEntry(book,{sourceMonth,key,item,editingId=''}){
 if(!validMonth(sourceMonth)||!['overtime','subsidies','deductions'].includes(key))throw new Error('记录类型或原月份无效。');
 const issue=entryDateIssue(book,item.date);if(issue)throw new Error(issue);
 const month=item.date.slice(0,7),months={...book.months},source=entryRecordForMonth(book,sourceMonth);
 const previous=(source[key]||[]).find(value=>value.id===editingId);
 if(previous&&sourceMonth!==month)months[sourceMonth]={...source,[key]:(source[key]||[]).filter(value=>value.id!==editingId)};
 const target=months[month]||entryRecordForMonth(book,month),values=target[key]||[];
 if(sourceMonth!==month&&values.some(value=>value.id===item.id))throw new Error('目标月份存在相同编号的记录，请重新打开后再保存。');
 months[month]={...target,[key]:previous&&sourceMonth===month?values.map(value=>value.id===editingId?item:value):[...values,item]};
 return {months,month,changedMonths:previous&&sourceMonth!==month?[sourceMonth,month]:[month]};
}
