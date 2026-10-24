import test from 'node:test';
import assert from 'node:assert/strict';
import {getCalendarDataset} from '../dist/calendar-data.js';
import {calendarDay,calendarCoverage,hasOfficialSchedule,holidayName,isMakeupDate,statutoryYearDates} from '../dist/calendar.js';

test('2020—2040逐日农历覆盖完整，闰月不丢失，每年24节气',()=>{
 let count=0,leapMonths=0;
 for(let year=2020;year<=2040;year++){
  const source=getCalendarDataset()[year],length=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  assert.equal(source.days.split('|').length,length);assert.equal(Object.keys(source.terms).length,24);
  for(let n=0;n<length;n++){
   const key=new Date(Date.UTC(year,0,n+1)).toISOString().slice(0,10),day=calendarDay(key);
   assert.ok(day.lunarMonth&&day.lunarDay>=1&&day.lunarDay<=30,key);assert.ok(day.lunarFull);
   if(day.lunarMonth.startsWith('闰')&&day.lunarDay===1)leapMonths++;count++;
  }
 }
 assert.equal(count,7671);assert.ok(leapMonths>=7);
});
test('跨年元旦及2020春节延长假期按通知展示',()=>{
 assert.equal(holidayName('2022-12-31'),'元旦');assert.equal(holidayName('2023-12-30'),'元旦');
 assert.equal(holidayName('2020-02-02'),'春节');assert.equal(holidayName('2020-02-03'),'');
 assert.equal(isMakeupDate('2020-02-01'),false);assert.equal(isMakeupDate('2020-01-19'),true);
});
test('历史及2026补班明确标识，未来不推测调休',()=>{
 for(const date of ['2024-02-04','2025-10-11','2026-10-10'])assert.equal(calendarDay(date).work,true,date);
 assert.equal(calendarDay('2026-10-04').work,false);assert.equal(calendarDay('2026-10-04').statutory,false);
 assert.equal(hasOfficialSchedule(2027),false);assert.equal(calendarDay('2027-02-06').official,false);
 assert.equal(holidayName('2027-02-06'),'');assert.match(calendarCoverage(2027),/调休未收录/);
 for(let month=1;month<=12;month++)assert.equal(isMakeupDate('2027-'+String(month).padStart(2,'0')+'-01'),false);
});
test('未来春节、中秋与节气有真实农历对应，不沿用2026日期',()=>{
 assert.equal(calendarDay('2027-02-06').festival,'春节');assert.equal(calendarDay('2027-02-05').festival,'除夕');
 assert.equal(calendarDay('2026-09-25').festival,'中秋节');assert.equal(calendarDay('2026-10-23').term,'霜降');
 assert.equal(calendarDay('2040-02-12').festival,'春节');
});
test('法定日期与连休不同，2025增加除夕和五一第二天',()=>{
 assert.equal(statutoryYearDates(2024).includes('2024-02-09'),false);
 assert.equal(statutoryYearDates(2025).includes('2025-01-28'),true);
 assert.equal(statutoryYearDates(2024).includes('2024-05-02'),false);
 assert.equal(statutoryYearDates(2025).includes('2025-05-02'),true);
 assert.equal(statutoryYearDates(2020).includes('2020-10-04'),true);
 assert.equal(statutoryYearDates(2024).length,11);assert.equal(statutoryYearDates(2025).length,13);
});
test('超出收录范围安全返回，未来节日不伪称官方连休',()=>{
 assert.equal(calendarDay('2041-01-01').lunar,'');assert.equal(calendarDay('2019-12-31').official,false);
 const future=calendarDay('2027-02-06');assert.equal(future.festival,'春节');assert.equal(future.holiday,'');
});
