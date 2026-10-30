import fs from 'node:fs/promises';
import {getCalendarDataset} from '../dist/calendar-data.js';

// Reproduce the bundled extension from the same Observatory tables used by the app.
const dataset=structuredClone(getCalendarDataset()),pending=[];
for(let year=2041;year<=2089;year++)if(!dataset[year])pending.push(year);
const simplify=text=>text.replace(/[閏驚蟄穀滿種處]/g,char=>({'閏':'闰','驚':'惊','蟄':'蛰','穀':'谷','滿':'满','種':'种','處':'处'}[char]));
async function load(year){
 const url=`https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T${year}c.txt`;
 let response;
 for(let attempt=0;attempt<3;attempt++){
  try{response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('HTTP '+response.status);break;}catch(error){if(attempt===2)throw error;}
 }
 const text=simplify(await response.text()),days=[],terms={},rows=[...text.matchAll(/^(\d{4})年(\d+)月(\d+)日[\t ]+(\S+)[\t ]+星期\S+(?:[\t ]+(\S+))?[^\r\n]*$/gm)];
 for(const match of rows){
  const date=match[1]+'-'+match[2].padStart(2,'0')+'-'+match[3].padStart(2,'0');
  const expected=new Date(Date.UTC(year,0,days.length+1)).toISOString().slice(0,10);
  if(date!==expected)throw new Error('Missing or unordered calendar date: '+expected);
  days.push(match[4]);if(match[5])terms[date.slice(5)]=match[5];
 }
 const count=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
 if(days.length!==count||Object.keys(terms).length!==24)throw new Error('Incomplete calendar table '+year+': '+days.length+' days / '+Object.keys(terms).length+' terms');
 // Gregorian January begins in lunar November or December, before lunar new year.
 const firstLunarMonth=days.find(value=>value.includes('月'));
 const firstMonth=days[0].includes('月')?days[0]:firstLunarMonth==='十二月'?'十一月':firstLunarMonth==='正月'?'十二月':null;
 if(!firstMonth)throw new Error('Unrecognised first lunar month '+year);
 dataset[year]={firstMonth,days:days.join('|'),terms};
 process.stdout.write('Verified '+year+' ('+count+' days)\n');
}
await Promise.all(Array.from({length:4},async()=>{while(pending.length)await load(pending.shift());}));
const ordered=Object.fromEntries(Object.entries(dataset).sort(([a],[b])=>Number(a)-Number(b)));
await fs.writeFile(new URL('../dist/calendar-data.js',import.meta.url),'// 农历与节气：香港天文台公历与农历日期对照表，2020—2089。\nconst calendarDataset='+JSON.stringify(ordered)+';\nexport function getCalendarDataset(){return calendarDataset;}\n');
