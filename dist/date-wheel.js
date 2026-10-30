import {validDate,validMonth,daysInMonth} from './payroll.js';

function wheelPad(value){return String(value).padStart(2,'0');}
function wheelNearest(values,target){return values.reduce((best,value)=>Math.abs(value-target)<Math.abs(best-target)?value:best,values[0]);}
export function createDateWheelModel({kind='date',value='',min,max,allowed=()=>true,today=''}={}){
 if(!['date','month','year','day'].includes(kind))throw new Error('日期选择类型无效。');
 min=String(min??(kind==='day'?1:kind==='year'?'2020':kind==='month'?'2020-01':'2020-01-01'));
 max=String(max??(kind==='day'?31:kind==='year'?'2089':kind==='month'?'2089-12':'2089-12-31'));
 const parts=kind==='date'?['year','month','day']:kind==='month'?['year','month']:kind==='year'?['year']:['day'];
 const cache=new Map(),monthCache=new Map();let state={year:2020,month:1,day:1},yearCache=null;
 function accepts(candidate){
  const valid=kind==='date'?validDate(candidate):kind==='month'?validMonth(candidate):kind==='year'?/^\d{4}$/.test(candidate)&&validMonth(candidate+'-01'):/^\d{1,2}$/.test(candidate)&&Number(candidate)>=1&&Number(candidate)<=31;
  return valid&&(kind==='day'?Number(candidate)>=Number(min)&&Number(candidate)<=Number(max):candidate>=min&&candidate<=max)&&allowed(candidate);
 }
 function dates(year,month){
  const key=year+'-'+wheelPad(month);if(cache.has(key))return cache.get(key);
  const values=Array.from({length:daysInMonth(key)},(_,i)=>i+1).filter(day=>accepts(key+'-'+wheelPad(day)));
  cache.set(key,values);return values;
 }
 function months(year){if(!monthCache.has(year))monthCache.set(year,Array.from({length:12},(_,i)=>i+1).filter(month=>kind==='date'?dates(year,month).length:accepts(year+'-'+wheelPad(month))));return monthCache.get(year);}
 function years(){return yearCache??=Array.from({length:70},(_,i)=>2020+i).filter(year=>kind==='year'?accepts(String(year)):String(year)>=min.slice(0,4)&&String(year)<=max.slice(0,4)&&months(year).length);}
 function normalize(candidate){
  if(kind==='day'){
   const values=Array.from({length:31},(_,i)=>i+1).filter(day=>accepts(String(day)));if(!values.length)throw new Error('当前范围内暂无可选日期。');
   return {...candidate,day:wheelNearest(values,Number(candidate.day)||values[0])};
  }
  const available=years();if(!available.length)throw new Error('当前范围内暂无可选日期。');
  const year=wheelNearest(available,Number(candidate.year)||available[0]);if(kind==='year')return {...candidate,year};
  const month=wheelNearest(months(year),Number(candidate.month)||1);if(kind==='month')return {...candidate,year,month};
  return {year,month,day:wheelNearest(dates(year,month),Number(candidate.day)||1)};
 }
 function parse(candidate){
  const fields=String(candidate||'').split('-').map(Number);
  return kind==='day'?{...state,day:fields[0]}:{year:fields[0],month:fields[1]||state.month,day:fields[2]||state.day};
 }
 function current(){return kind==='day'?String(state.day):kind==='year'?String(state.year):state.year+'-'+wheelPad(state.month)+(kind==='date'?'-'+wheelPad(state.day):'');}
 state=normalize(parse(value||today||min));
 return {
  kind,parts,min,max,value:current,allows:accepts,state:()=>({...state,kind,value:current()}),
  setValue(candidate){const before=current();state=normalize(parse(candidate));return before!==current();},
  select(part,value){if(!parts.includes(part)||!Number.isInteger(Number(value)))return false;const before=current();state=normalize({...state,[part]:Number(value)});return before!==current();},
  options(part){
   let values,enabled;
   if(part==='year'){values=Array.from({length:70},(_,i)=>2020+i);enabled=new Set(years());}
   else if(part==='month'){values=Array.from({length:12},(_,i)=>i+1);enabled=new Set(months(state.year));}
   else if(part==='day'){values=Array.from({length:kind==='day'?31:daysInMonth(state.year+'-'+wheelPad(state.month))},(_,i)=>i+1);enabled=new Set(kind==='day'?values.filter(day=>accepts(String(day))):dates(state.year,state.month));}
   else return [];
   return values.map(number=>({value:String(number),label:part==='year'?String(number):wheelPad(number),disabled:!enabled.has(number),selected:number===state[part]}));
  }
 };
}
