import {getCalendarDataset} from './calendar-data.js';

const arrangements={
  2020:{ranges:[['2020-01-01','2020-01-01','元旦'],['2020-01-24','2020-02-02','春节'],['2020-04-04','2020-04-06','清明'],['2020-05-01','2020-05-05','劳动节'],['2020-06-25','2020-06-27','端午'],['2020-10-01','2020-10-08','国庆·中秋']],work:['01-19','04-26','05-09','06-28','09-27','10-10']},
  2021:{ranges:[['2021-01-01','2021-01-03','元旦'],['2021-02-11','2021-02-17','春节'],['2021-04-03','2021-04-05','清明'],['2021-05-01','2021-05-05','劳动节'],['2021-06-12','2021-06-14','端午'],['2021-09-19','2021-09-21','中秋'],['2021-10-01','2021-10-07','国庆']],work:['02-07','02-20','04-25','05-08','09-18','09-26','10-09']},
  2022:{ranges:[['2022-01-01','2022-01-03','元旦'],['2022-01-31','2022-02-06','春节'],['2022-04-03','2022-04-05','清明'],['2022-04-30','2022-05-04','劳动节'],['2022-06-03','2022-06-05','端午'],['2022-09-10','2022-09-12','中秋'],['2022-10-01','2022-10-07','国庆']],work:['01-29','01-30','04-02','04-24','05-07','10-08','10-09']},
  2023:{ranges:[['2022-12-31','2023-01-02','元旦'],['2023-01-21','2023-01-27','春节'],['2023-04-05','2023-04-05','清明'],['2023-04-29','2023-05-03','劳动节'],['2023-06-22','2023-06-24','端午'],['2023-09-29','2023-10-06','中秋·国庆']],work:['01-28','01-29','04-23','05-06','06-25','10-07','10-08']},
  2024:{ranges:[['2023-12-30','2024-01-01','元旦'],['2024-02-10','2024-02-17','春节'],['2024-04-04','2024-04-06','清明'],['2024-05-01','2024-05-05','劳动节'],['2024-06-08','2024-06-10','端午'],['2024-09-15','2024-09-17','中秋'],['2024-10-01','2024-10-07','国庆']],work:['02-04','02-18','04-07','04-28','05-11','09-14','09-29','10-12']},
  2025:{ranges:[['2025-01-01','2025-01-01','元旦'],['2025-01-28','2025-02-04','春节'],['2025-04-04','2025-04-06','清明'],['2025-05-01','2025-05-05','劳动节'],['2025-05-31','2025-06-02','端午'],['2025-10-01','2025-10-08','国庆·中秋']],work:['01-26','02-08','04-27','09-28','10-11']},
  2026:{ranges:[['2026-01-01','2026-01-03','元旦'],['2026-02-15','2026-02-23','春节'],['2026-04-04','2026-04-06','清明'],['2026-05-01','2026-05-05','劳动节'],['2026-06-19','2026-06-21','端午'],['2026-09-25','2026-09-27','中秋'],['2026-10-01','2026-10-07','国庆']],work:['01-04','02-14','02-28','05-09','09-20','10-10']}
};
const ranges=Object.values(arrangements).flatMap(y=>y.ranges);
const workdays=new Set(Object.entries(arrangements).flatMap(([year,y])=>y.work.map(day=>year+'-'+day)));
const cache=new Map(),legalCache=new Map();
const lunarNames=['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const fixedFestivals={'01-01':'元旦','03-08':'妇女节','03-12':'植树节','05-01':'劳动节','05-04':'青年节','06-01':'儿童节','07-01':'建党节','08-01':'建军节','09-10':'教师节','10-01':'国庆节'};
const lunarFestivals={'正月-1':'春节','正月-15':'元宵节','二月-2':'龙抬头','五月-5':'端午节','七月-7':'七夕','七月-15':'中元节','八月-15':'中秋节','九月-9':'重阳节','十二月-8':'腊八节','十二月-23':'北方小年','十二月-24':'南方小年'};
function dateKey(year,index){return new Date(Date.UTC(year,0,index+1)).toISOString().slice(0,10);}
function yearRows(year){
 if(cache.has(year))return cache.get(year);
 const source=getCalendarDataset()[year];if(!source)return new Map();
 const rows=new Map();let month=source.firstMonth;
 source.days.split('|').forEach((text,index)=>{
  if(text.includes('月'))month=text;
  const day=text.includes('月')?1:lunarNames.indexOf(text)+1;
  const date=dateKey(year,index),term=source.terms[date.slice(5)]||'';
  rows.set(date,{date,lunarMonth:month,lunarDay:day,lunar:text,lunarFull:month+(text.includes('月')?'初一':text),term,festival:lunarFestivals[month+'-'+day]||fixedFestivals[date.slice(5)]||''});
 });
 for(const row of rows.values()){
  const next=rows.get(dateKey(year,Math.round((Date.parse(row.date+'T00:00:00Z')-Date.UTC(year,0,1))/86400000)+1));
  if(next?.lunarMonth==='正月'&&next.lunarDay===1)row.festival='除夕';
  if(row.term==='清明')row.festival='清明节';
 }
 cache.set(year,rows);return rows;
}
export function hasOfficialSchedule(year){return !!arrangements[Number(year)];}
export function holidayName(date){return ranges.find(([start,end])=>date>=start&&date<=end)?.[2]||'';}
export function isMakeupDate(date){return workdays.has(date);}
export function statutoryYearDates(year){
 year=Number(year);if(legalCache.has(year))return legalCache.get(year);
 const dates=new Set([year+'-01-01',year+'-05-01',year+'-10-01',year+'-10-02',year+'-10-03']);
 if(year>=2025)dates.add(year+'-05-02');
 for(const row of yearRows(year).values()){
  if((row.lunarMonth==='正月'&&row.lunarDay<=3)||(row.lunarMonth==='五月'&&row.lunarDay===5)||(row.lunarMonth==='八月'&&row.lunarDay===15)||row.term==='清明'||(year>=2025&&row.festival==='除夕'))dates.add(row.date);
 }
 // 2020年中秋与国庆重合，10月4日法定日按人社部复函收录。
 if(year===2020)dates.add('2020-10-04');
 const result=[...dates].sort();legalCache.set(year,result);return result;
}
export function calendarDay(date){
 const base=yearRows(Number(date.slice(0,4))).get(date);
 if(!base)return {date,lunar:'',lunarFull:'',festival:'',term:'',holiday:'',work:false,statutory:false,official:false};
 const year=Number(date.slice(0,4));
 return {...base,holiday:holidayName(date),work:isMakeupDate(date),statutory:statutoryYearDates(year).includes(date),official:hasOfficialSchedule(year)};
}
export function calendarCoverage(year){
 return hasOfficialSchedule(year)?year+'年放假调休已按官方通知收录':year+'年调休未收录，节日日期可查，补班以官方通知为准';
}
