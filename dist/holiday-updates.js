import {applyOfficialSchedule} from './calendar.js';
export function validateHolidayPayload(value,year){
 if(!value||value.year!==year||!Number.isInteger(year)||year<2020||year>2089||!Array.isArray(value.papers)||!value.papers.length||value.papers.length>20||!Array.isArray(value.days)||!value.days.length||value.days.length>120)throw new Error('日历资料不完整。');
 for(const paper of value.papers){let parsed;try{parsed=new URL(paper);}catch{throw new Error('日历资料来源无效。');}if(typeof paper!=='string'||paper.length>2048||parsed.protocol!=='https:'||!(parsed.hostname==='gov.cn'||parsed.hostname.endsWith('.gov.cn')))throw new Error('日历资料缺少政府通知来源。');}
 const seen=new Set(),days=[];
 for(const row of value.days){
  if(!row||typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||new Date(row.date+'T12:00:00Z').toISOString().slice(0,10)!==row.date||!(row.date.startsWith(year+'-')||row.date.startsWith((year-1)+'-12-'))||seen.has(row.date)||typeof row.name!=='string'||!row.name.trim()||row.name.length>30||typeof row.isOffDay!=='boolean')throw new Error('日历日期资料无效或重复。');
  seen.add(row.date);days.push({date:row.date,name:row.name.trim(),isOffDay:row.isOffDay});
 }return {year,papers:[...value.papers],days};
}
export function createCalendarUpdater({fetchYear,onChange=()=>{},storage=globalThis.localStorage,now=()=>Date.now()}){
 const key='dagongren.calendar.cache.v1',inflight=new Map(),attempts=new Map();let cached={},lastError='';
 try{const saved=JSON.parse(storage?.getItem(key)||'{}');for(const [year,entry] of Object.entries(saved)){try{const payload=validateHolidayPayload(entry.payload,Number(year));cached[year]={payload,updatedAt:Number(entry.updatedAt)||0};applyOfficialSchedule(payload);}catch{}}}catch{}
 function save(){try{storage?.setItem(key,JSON.stringify(cached));}catch{}}
 async function one(year,force){
  if(!Number.isInteger(year)||year<2020||year>2089||!fetchYear)return;if(inflight.has(year))return inflight.get(year);
  if(!force&&attempts.has(year)&&now()-attempts.get(year)<1800000)return;attempts.set(year,now());
  const operation=(async()=>{try{
   const result=await fetchYear(year);if(!result?.available)return;
   const payload=validateHolidayPayload(result.payload,year),changed=JSON.stringify(cached[year]?.payload)!==JSON.stringify(payload);
   cached[year]={payload,updatedAt:now()};applyOfficialSchedule(payload);save();lastError='';if(changed)onChange(year);
  }catch{lastError='联网更新未完成，继续使用离线或缓存资料。';}finally{inflight.delete(year);}})();inflight.set(year,operation);return operation;
 }
 return {refresh(year,{force=false}={}){return Promise.all([one(Number(year),force),one(Number(year)+1,force)]);},summary(year){const entry=cached[Number(year)];return entry?'联网资料最近获取：'+new Date(entry.updatedAt).toLocaleString('zh-CN'):lastError||'联网后自动检查年度放假、调休及补班安排。';},cachedYears(){return Object.keys(cached).map(Number);}};
}
