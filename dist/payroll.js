import {holidayName,isMakeupDate,statutoryYearDates} from './calendar.js';
export function daysInMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

export function validMonth(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 2020 && Number(month.slice(0, 4)) <= 2040;
}

export function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validMonth(date.slice(0, 7))) return false;
  return +date.slice(8) >= 1 && +date.slice(8) <= daysInMonth(date.slice(0, 7));
}

export function statutoryDates(month){return statutoryYearDates(Number(month.slice(0,4))).filter(date=>date.startsWith(month+'-'));}
export function isStatutory(date){return statutoryYearDates(Number(date.slice(0,4))).includes(date);}
export function isAdjustedDay(date){return !!holiday(date)&&!isStatutory(date);}
export function holiday(date){return holidayName(date);}
export function makeupWorkday(date){return isMakeupDate(date);}

export function datesBetween(start, end) {
  if (!validDate(start) || !validDate(end) || start > end || start.slice(0, 7) !== end.slice(0, 7)) return [];
  const result = [];
  for (let d = +start.slice(8); d <= +end.slice(8); d++) result.push(`${start.slice(0, 7)}-${String(d).padStart(2, '0')}`);
  return result;
}

export function chinaDate(now=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function shiftMonth(month,delta) { const [y,m]=month.split('-').map(Number),date=new Date(Date.UTC(y,m-1+delta,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`; }
export function shiftDay(date,delta) { const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+delta);return value.toISOString().slice(0,10); }
function dateInMonth(month,day) { return `${month}-${String(Math.min(Number(day),daysInMonth(month))).padStart(2,'0')}`; }
function isoDate(date) { return typeof date==='string'&&/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)&&+date.slice(8)>=1&&+date.slice(8)<=daysInMonth(date.slice(0,7)); }
function cents(value,label='金额') { if(!Number.isSafeInteger(value)||value<0||value>1000000000)throw new Error(label+'无效');return value; }
function list(record,key) { if(record[key]===undefined)return [];if(!Array.isArray(record[key]))throw new Error('记录格式无效');return record[key]; }
export function leaveDeducts(item,settings={}) { return typeof item.deduct==='boolean'?item.deduct:isStatutory(item.date)?settings.holidayLeaveDeduct===true:isAdjustedDay(item.date)?settings.adjustedLeaveDeduct===true:true; }
export function overtimeAmount(item) {
  if(item.mode==='custom')return cents(item.amountCents,'加班金额');
  const q=Math.round(Number(item.quantity)*100);
  if(!['hour','day'].includes(item.mode)||!Number.isFinite(item.quantity)||item.quantity<=0||Math.abs(item.quantity*100-q)>1e-6||item.quantity>(item.mode==='hour'?744:31))throw new Error('加班数量或计费方式无效');
  return cents(Math.round(cents(item.rateCents,'加班单价')*q/100),'加班金额');
}
export function wagePayments(record) { return [...(record.payment?[{...record.payment,id:'legacy-payment'}]:[]),...list(record,'payments')]; }
function validCash(item) {
  cents(item.amountCents,'实收金额');
  if(!item.id||!validDate(item.date))throw new Error('收款日期或编号无效');
  if((item.periodStart||item.periodEnd)&&(!isoDate(item.periodStart)||!isoDate(item.periodEnd)||item.periodStart>item.periodEnd))throw new Error('收款对应的工资区间无效');
}
export function payPeriodForDate(date,settings={}) {
  const mode=settings.periodMode==='custom'?'custom':'calendar',startDay=mode==='custom'?Number(settings.periodStartDay??1):1,payday=Number(settings.payday??15);
  if(!isoDate(date)||!Number.isInteger(startDay)||startDay<1||startDay>31||!Number.isInteger(payday)||payday<1||payday>31)throw new Error('发薪周期设置无效');
  let anchor=date.slice(0,7);if(date<dateInMonth(anchor,startDay))anchor=shiftMonth(anchor,-1);
  const start=dateInMonth(anchor,startDay),end=shiftDay(dateInMonth(shiftMonth(anchor,1),startDay),-1);
  let dueDate=dateInMonth(end.slice(0,7),payday);if(dueDate<=end)dueDate=dateInMonth(shiftMonth(end.slice(0,7),1),payday);
  return {start,end,dueDate,anchor};
}
export function calculate(month,record,asOf=chinaDate()) {
  if(!validMonth(month)||!validDate(asOf))throw new Error('计薪日期无效');
  const salaryCents=cents(Number(record.salaryCents),'月薪'),divisor=daysInMonth(month),joinDate=record.joinDate||month+'-01';
  if(!validDate(joinDate))throw new Error('入职日期无效');
  const leaves=list(record,'leaves'),seen=new Set(),overtime=list(record,'overtime'),otIds=new Set();
  for(const item of leaves){if(!validDate(item.date)||!item.date.startsWith(month+'-')||![.5,1].includes(item.days)||seen.has(item.date)||(item.deduct!==undefined&&typeof item.deduct!=='boolean'))throw new Error('请假记录无效或重复');seen.add(item.date);}
  for(const item of overtime){if(!item.id||otIds.has(item.id)||!validDate(item.date)||!item.date.startsWith(month+'-'))throw new Error('加班日期或编号无效');otIds.add(item.id);overtimeAmount(item);}
  const subsidies=list(record,'subsidies'),deductions=list(record,'deductions'),adjustmentIds=new Set();
  for(const item of [...subsidies,...deductions]){
    if(!item.id||adjustmentIds.has(item.id)||!validDate(item.date)||!item.date.startsWith(month+'-')||typeof item.category!=='string'||!item.category.trim()||item.category.trim().length>30||item.category!==item.category.trim())throw new Error('补贴或扣款的日期、项目或编号无效');
    if(cents(item.amountCents,'补贴或扣款金额')===0)throw new Error('补贴或扣款金额须大于零');
    adjustmentIds.add(item.id);
  }
  const cash=[...list(record,'advances'),...wagePayments(record)],cashIds=new Set();for(const item of cash){validCash(item);if(cashIds.has(item.id))throw new Error('收款编号重复');cashIds.add(item.id);}
  let accruedDays=0,leaveDays=0,holidayLeaveDays=0,adjustedLeaveDays=0,deductLeaveDays=0,previousNet=0,previousGross=0,baseCents=0,overtimeCents=0,subsidyCents=0,wageDeductionCents=0;const daily=[];
  for(let day=1;day<=divisor;day++){
    const date=month+'-'+String(day).padStart(2,'0');if(date<joinDate||date>asOf)continue;
    accruedDays++;const leave=leaves.find(x=>x.date===date);
    if(leave){leaveDays+=leave.days;if(isStatutory(date))holidayLeaveDays+=leave.days;if(isAdjustedDay(date))adjustedLeaveDays+=leave.days;if(leaveDeducts(leave,record))deductLeaveDays+=leave.days;}
    const gross=Math.round(salaryCents*accruedDays/divisor),net=Math.round(salaryCents*(accruedDays-deductLeaveDays)/divisor),ot=overtime.filter(x=>x.date===date).reduce((n,item)=>n+overtimeAmount(item),0),subsidy=subsidies.filter(x=>x.date===date).reduce((n,x)=>n+x.amountCents,0),deduction=deductions.filter(x=>x.date===date).reduce((n,x)=>n+x.amountCents,0);
    daily.push({date,amountCents:net-previousNet+ot+subsidy-deduction,grossCents:gross-previousGross,leaveDeductionCents:gross-previousGross-(net-previousNet),overtimeCents:ot,subsidyCents:subsidy,wageDeductionCents:deduction});previousNet=net;previousGross=gross;baseCents=gross;overtimeCents+=ot;subsidyCents+=subsidy;wageDeductionCents+=deduction;
  }
  const expectedCents=previousNet+overtimeCents+subsidyCents-wageDeductionCents,advanceCents=list(record,'advances').filter(x=>x.date<=asOf).reduce((n,x)=>n+x.amountCents,0),paymentCents=wagePayments(record).filter(x=>x.date<=asOf).reduce((n,x)=>n+x.amountCents,0),receivedCents=advanceCents+paymentCents,remainingCents=Math.max(0,expectedCents-receivedCents);
  return {salaryCents,divisor,dailyCents:salaryCents/divisor,joinDate,accruedDays,leaveDays,holidayLeaveDays,adjustedLeaveDays,deductLeaveDays,baseCents,deductionCents:baseCents-previousNet,overtimeCents,subsidyCents,wageDeductionCents,expectedCents,advanceCents,paymentCents,receivedCents,remainingCents,deductionCarryCents:Math.max(0,-expectedCents),excessCents:Math.max(0,receivedCents-Math.max(0,expectedCents)),plannedLeaveDays:leaves.reduce((n,x)=>n+x.days,0),daily,status:remainingCents?(receivedCents?'partial':'unpaid'):expectedCents<0?'offset':asOf>=month+'-'+divisor?'paid':accruedDays?'current':'future'};
}
export function calculateBook(months,settings,asOf=chinaDate()) {
  const byMonth={},chunks=[],receipts=[],periods=new Map();
  const periodFor=(date,company)=>{const range=payPeriodForDate(date,settings),id=range.start+'|'+encodeURIComponent(company);if(!periods.has(id))periods.set(id,{...range,id,company,expectedCents:0,remainingCents:0,receivedCents:0,advanceCents:0,paymentCents:0,unappliedCents:0,deductionCarryCents:0,baseCents:0,deductionCents:0,overtimeCents:0,subsidyCents:0,wageDeductionCents:0,accruedDays:0});return periods.get(id);};
  for(const [month,r] of Object.entries(months).sort(([a],[b])=>a.localeCompare(b))){
    const value=calculate(month,r,asOf),company=r.company||'';byMonth[month]={...value,receivedCents:0,advanceCents:0,paymentCents:0,remainingCents:0,excessCents:0,deductionCarryCents:0,settlementCents:0};
    for(const item of value.daily){const p=periodFor(item.date,company),chunk={...item,month,company,periodId:p.id,settlementCents:Math.max(0,item.amountCents),remainingCents:Math.max(0,item.amountCents),deductionCarryCents:0,adjustmentOffsets:[]};chunks.push(chunk);p.expectedCents+=item.amountCents;p.accruedDays++;for(const key of ['baseCents','deductionCents','overtimeCents','subsidyCents','wageDeductionCents'])p[key]+=item[{baseCents:'grossCents',deductionCents:'leaveDeductionCents'}[key]||key];}
    for(const [kind,items] of [['advance',list(r,'advances')],['payment',wagePayments(r)]])for(const item of items){
      if(item.date>asOf)continue;
      receipts.push({...item,kind,month,company:item.company??company,periodStart:item.periodStart||month+'-01',periodEnd:item.periodEnd||month+'-'+daysInMonth(month),allocations:[],unappliedCents:item.amountCents});
    }
  }
  // A negative wage day reduces earned wages in its own company and pay period.
  // Keep any deficit visible; never create negative receipt allocations or erase cash.
  for(const debit of chunks.filter(x=>x.amountCents<0)){
    let left=-debit.amountCents;
    const candidates=chunks.filter(x=>x.periodId===debit.periodId&&x.settlementCents>0).sort((a,b)=>{const ap=a.date<=debit.date,bp=b.date<=debit.date;return ap!==bp?(ap?-1:1):ap?b.date.localeCompare(a.date):a.date.localeCompare(b.date);});
    for(const credit of candidates){if(!left)break;const amount=Math.min(left,credit.settlementCents);credit.settlementCents-=amount;credit.remainingCents-=amount;left-=amount;debit.adjustmentOffsets.push({date:credit.date,month:credit.month,amountCents:amount});}
    debit.deductionCarryCents=left;periods.get(debit.periodId).deductionCarryCents+=left;byMonth[debit.month].deductionCarryCents+=left;
  }
  receipts.sort((a,b)=>a.date.localeCompare(b.date)||(a.month+a.id).localeCompare(b.month+b.id));
  for(const item of receipts){for(const chunk of chunks){if(!item.unappliedCents)break;if(chunk.company!==item.company||chunk.date<item.periodStart||chunk.date>item.periodEnd||chunk.remainingCents<=0)continue;const amount=Math.min(item.unappliedCents,chunk.remainingCents);chunk.remainingCents-=amount;item.unappliedCents-=amount;item.allocations.push({date:chunk.date,month:chunk.month,amountCents:amount});byMonth[chunk.month].receivedCents+=amount;byMonth[chunk.month][item.kind==='advance'?'advanceCents':'paymentCents']+=amount;}}
  for(const chunk of chunks){const p=periods.get(chunk.periodId);p.remainingCents+=chunk.remainingCents;byMonth[chunk.month].remainingCents+=chunk.remainingCents;byMonth[chunk.month].settlementCents+=chunk.settlementCents;}
  for(const receipt of receipts){for(const item of receipt.allocations){const p=periodFor(item.date,receipt.company);p.receivedCents+=item.amountCents;p[receipt.kind==='advance'?'advanceCents':'paymentCents']+=item.amountCents;}if(receipt.unappliedCents){const p=periodFor(receipt.periodStart,receipt.company);p.unappliedCents+=receipt.unappliedCents;byMonth[receipt.month].excessCents+=receipt.unappliedCents;}}
  for(const [m,c] of Object.entries(byMonth))c.status=c.remainingCents?(c.receivedCents?'partial':'unpaid'):c.deductionCarryCents?'offset':asOf>=m+'-'+daysInMonth(m)?'paid':c.accruedDays?'current':'future';
  const rows=[...periods.values()].map(p=>({...p,status:p.remainingCents?(p.receivedCents?'partial':'unpaid'):p.deductionCarryCents?'offset':p.end<=asOf?'paid':p.accruedDays?'current':'future'})).sort((a,b)=>b.start.localeCompare(a.start)||a.company.localeCompare(b.company));
  return {asOf,byMonth,chunks,periods:rows,receipts,expectedCents:chunks.reduce((n,x)=>n+x.amountCents,0),remainingCents:chunks.reduce((n,x)=>n+x.remainingCents,0),receivedCents:receipts.reduce((n,x)=>n+x.amountCents,0),advanceCents:receipts.filter(x=>x.kind==='advance').reduce((n,x)=>n+x.amountCents,0),paymentCents:receipts.filter(x=>x.kind==='payment').reduce((n,x)=>n+x.amountCents,0),unappliedCents:receipts.reduce((n,x)=>n+x.unappliedCents,0),deductionCarryCents:chunks.reduce((n,x)=>n+x.deductionCarryCents,0),subsidyCents:chunks.reduce((n,x)=>n+x.subsidyCents,0),wageDeductionCents:chunks.reduce((n,x)=>n+x.wageDeductionCents,0),todayCents:chunks.filter(x=>x.date===asOf).reduce((n,x)=>n+x.amountCents,0)};
}
export function migrateBook(saved,defaults,asOf=chinaDate()) {
  if(![1,2].includes(saved.version)||!saved.defaults||!saved.months)throw new Error('账本格式无效');
  const book=JSON.parse(JSON.stringify(saved)),earliest=Object.keys(book.months).sort()[0],oldSettings={...defaults,...book.defaults};
  book.version=2;book.defaults={...oldSettings,joinDate:oldSettings.joinDate||earliest&&earliest+'-01'||asOf,periodMode:oldSettings.periodMode||'calendar',periodStartDay:oldSettings.periodStartDay||1};book.excludedMonths=Array.isArray(book.excludedMonths)?book.excludedMonths:[];
  if(!validDate(book.defaults.joinDate))throw new Error('入职日期无效');cents(Number(book.defaults.salaryCents),'默认月薪');
  if(saved.version===1){
    const excluded=new Set(book.excludedMonths);
    if(!earliest)for(let month=book.defaults.joinDate.slice(0,7);month<=asOf.slice(0,7);month=shiftMonth(month,1))excluded.add(month);
    for(const log of saved.sync?.logs||[]){
      const text=String(log.text||'');if(!text.includes('已清理')||!text.includes('本地'))continue;
      const month=text.match(/已清理(\d{4})年(\d{1,2})月/),year=text.match(/已清理(\d{4})年：/);
      if(month){const key=month[1]+'-'+String(month[2]).padStart(2,'0');if(!book.months[key])excluded.add(key);}
      else if(year||text.includes('已清理全部账本'))for(let m=(year?year[1]:'2020')+'-01';m<=asOf.slice(0,7)&&(!year||m.startsWith(year[1]+'-'));m=shiftMonth(m,1))if(!book.months[m])excluded.add(m);
    }
    book.excludedMonths=[...excluded];
  }
  const upgrade=records=>{for(const [month,r] of Object.entries(records||{})){if(!validMonth(month))throw new Error('月份无效');r.company=r.company??book.defaults.company??'';r.joinDate=r.joinDate||(r.company===book.defaults.company?book.defaults.joinDate:month+'-01');r.leaves=(r.leaves||[]).map(item=>({...item,deduct:leaveDeducts(item,oldSettings)}));delete r.delays;for(const item of [...(r.advances||[]),...(r.payments||[]),...(r.payment?[r.payment]:[])])delete item.delayAllocations;calculate(month,r,asOf);}};
  upgrade(book.months);upgrade(book.sync?.cloudMonths);payPeriodForDate(asOf,book.defaults);return book;
}
export function ensureAccrualMonths(book,asOf=chinaDate()) {
  const join=book.defaults.joinDate;if(!validDate(join)||join>asOf)return false;
  let changed=false;for(let month=join.slice(0,7);month<=asOf.slice(0,7);month=shiftMonth(month,1)){if(!book.months[month]&&!(book.excludedMonths||[]).includes(month)){book.months[month]={...book.defaults,leaves:[],overtime:[],advances:[],payments:[],payment:null};changed=true;}}
  return changed;
}
export function formatMoney(value,grouping=true) { return (value/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:grouping}); }
