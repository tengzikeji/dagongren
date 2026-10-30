import {validDate,validMonth,daysInMonth} from './payroll.js';

export function recordDefaultRange(year){
 if(!validMonth(year+'-01'))throw new Error('请选择2020至2089年之间的年份。');
 return {start:year+'-01-01',end:year+'-12-31'};
}
export function recordMonthRange(month){
 if(!validMonth(month))throw new Error('请选择有效月份。');
 return {start:month+'-01',end:month+'-'+daysInMonth(month)};
}
export function recordRangeIssue(range,year){
 if(!range||!validDate(range.start)||!validDate(range.end))return '请选择有效的开始与结束日期。';
 if(range.start>range.end)return '开始日期不能晚于结束日期。';
 if(!range.start.startsWith(year+'-')||!range.end.startsWith(year+'-'))return '请选择'+year+'年内的日期；其他年份可在明细右上角切换。';
 return '';
}
export function recordRangeContains(date,range){return validDate(date)&&date>=range.start&&date<=range.end;}
export function recordRangeIsDefault(range,year){const defaults=recordDefaultRange(year);return range.start===defaults.start&&range.end===defaults.end;}
export function recordRangeLabel(range,year){
 if(recordRangeIsDefault(range,year))return '全年 · 默认';
 if(range.start.slice(0,7)===range.end.slice(0,7)&&range.start.endsWith('-01')&&Number(range.end.slice(8))===daysInMonth(range.end.slice(0,7)))return Number(range.start.slice(5,7))+'月';
 return range.start.slice(5).replace('-','/')+'—'+range.end.slice(5).replace('-','/');
}
export function shiftRecordRangeYear(range,year){
 recordDefaultRange(year);
 const move=date=>{const month=year+date.slice(4,7);return month+'-'+String(Math.min(Number(date.slice(8)),daysInMonth(month))).padStart(2,'0');};
 if(!range||!validDate(range.start)||!validDate(range.end))return null;
 return {start:move(range.start),end:move(range.end)};
}
export function shiftRecordYearState(year,ranges={},entryMonthScope=''){
 recordDefaultRange(year);const next={};
 for(const kind of ['salary','entries']){const range=shiftRecordRangeYear(ranges[kind],year);next[kind]=range&&!recordRangeIsDefault(range,year)?range:null;}
 return {recordYear:year,recordDateRanges:next,entryMonthScope:validMonth(entryMonthScope)?year+entryMonthScope.slice(4):''};
}
