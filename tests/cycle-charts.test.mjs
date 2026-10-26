import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateBook,payPeriodForDate,salaryRateForDate,daysInMonth,shiftMonth,shiftDay} from '../dist/payroll.js';
import {settlementChart,dailyWageChart,annualWageChart,recordMixChart} from '../dist/charts.js';
const salary=600001;
const settings={company:'周期测试',salaryCents:salary,joinDate:'2023-01-01',periodMode:'custom',periodStartDay:21,payday:15};
const record=joinDate=>({...settings,joinDate,leaves:[],overtime:[],payments:[],advances:[],subsidies:[],deductions:[]});
test('所有起始日覆盖平年闰年、大小月和跨年，完整周期恰好一份工资',()=>{
 for(const year of [2023,2024,2026])for(let month=1;month<=12;month++)for(let startDay=1;startDay<=31;startDay++){
  const key=year+'-'+String(month).padStart(2,'0'),start=key+'-'+String(Math.min(startDay,daysInMonth(key))).padStart(2,'0'),config={...settings,periodStartDay:startDay},range=payPeriodForDate(start,config),months={};
  for(let m=start.slice(0,7);m<=range.end.slice(0,7);m=shiftMonth(m,1))months[m]=record(start);
  const b=calculateBook(months,config,range.end),n=Math.round((Date.parse(range.end)-Date.parse(start))/86400000)+1;
  assert.equal(b.expectedCents,salary,start+' 至 '+range.end);assert.equal(b.chunks.length,n);
  assert.ok(b.chunks.every(x=>x.divisor===n&&x.dailyCents===salary/n));
  assert.equal(Object.values(b.byMonth).reduce((sum,x)=>sum+x.expectedCents,0),salary);
  assert.equal(b.periods.reduce((sum,x)=>sum+x.expectedCents,0),salary);
  assert.equal(b.chunks.reduce((sum,x)=>sum+x.grossCents,0),salary);
 }
});
test('跨二月请假按完整周期扣薪，跨月半天扣款共同舍入',()=>{
 const config={...settings,joinDate:'2024-02-21'},months={'2024-02':record('2024-02-21'),'2024-03':record('2024-02-21')};
 months['2024-02'].leaves=[{date:'2024-02-29',days:.5,deduct:true}];months['2024-03'].leaves=[{date:'2024-03-01',days:.5,deduct:true}];
 const b=calculateBook(months,config,'2024-03-20');assert.equal(b.expectedCents,Math.round(salary*28/29));assert.equal(b.chunks.reduce((sum,x)=>sum+x.leaveDeductionCents,0),salary-b.expectedCents);
 assert.equal(b.todayCents,b.chunks.at(-1).amountCents);
});
test('入职不足完整周期按实际天数计薪，未来日期不提前计入',()=>{
 const r=record('2026-09-26'),b=calculateBook({'2026-09':r,'2026-10':r},settings,'2026-10-10');
 assert.equal(b.expectedCents,Math.round(salary*15/30));assert.equal(b.chunks.length,15);assert.equal(b.chunks[0].date,'2026-09-26');assert.equal(b.chunks.at(-1).date,'2026-10-10');
 assert.equal(salaryRateForDate('2026-10-21',salary,settings).divisor,31);
});
test('月份调薪按各段工资标准折算，原始收款不改写',()=>{
 const months={'2026-09':record('2026-09-21'),'2026-10':{...record('2026-09-21'),salaryCents:900001}};
 months['2026-09'].payments=[{id:'p',date:'2026-10-21',amountCents:500000,periodStart:'2026-09-21',periodEnd:'2026-10-20'}];
 const raw=JSON.stringify(months),b=calculateBook(months,settings,'2026-10-21');
 assert.equal(b.periods.find(p=>p.start==='2026-09-21').expectedCents,Math.round(salary*10/30)+Math.round(900001*20/30));assert.equal(JSON.stringify(months),raw);assert.equal(b.receivedCents,500000);
});
test('图表空数据不出现无效比例，负计薪单独显示，图表金额与账本一致',()=>{
 const r=record('2026-10-01');r.deductions=[{id:'d',date:'2026-10-02',amountCents:100000,category:'扣款'}];r.advances=[{id:'a',date:'2026-10-03',amountCents:1000,periodStart:'2026-10-01',periodEnd:'2026-10-31'}];
 const b=calculateBook({'2026-10':r},settings,'2026-10-22'),daily=dailyWageChart('2026-10',b.byMonth['2026-10'].daily,b.byMonth['2026-10'].expectedCents);
 assert.match(daily,/chart-bar-negative/);assert.equal([...daily.matchAll(/data-amount="(-?\d+)"/g)].reduce((sum,x)=>sum+Number(x[1]),0),b.expectedCents);
 const annual=annualWageChart('2026',b);for(const [kind,total] of [['earned',b.expectedCents],['received',b.receivedCents]])assert.equal([...annual.matchAll(new RegExp('data-kind="'+kind+'" data-amount="(-?\\d+)"','g'))].reduce((sum,x)=>sum+Number(x[1]),0),total);
 for(const html of [settlementChart({receivedCents:0,unappliedCents:0,remainingCents:0}),dailyWageChart('2026-02',[],0),annualWageChart('2025',b)])assert.doesNotMatch(html,/NaN|Infinity|undefined/);
 assert.match(settlementChart({...b,receivedCents:10000000,unappliedCents:10000000-b.receivedCents}),/收款进度/);
});

test('我的页逐笔分布统计六类记录，兼容旧版发工资且清理后更新',()=>{
 const r=record('2026-09-21');r.leaves=[{id:'l'}];r.overtime=[{id:'o'}];r.subsidies=[{id:'s'}];r.deductions=[{id:'d'}];r.advances=[{id:'a'}];r.payment={amountCents:1,date:'2026-10-01'};
 const html=recordMixChart({'2026-10':r});assert.equal([...html.matchAll(/data-count="(\d+)"/g)].reduce((n,x)=>n+Number(x[1]),0),6);assert.equal([...html.matchAll(/class="mix-segment"/g)].length,6);assert.match(html,/发工资/);assert.doesNotMatch(recordMixChart({}),/NaN|Infinity|undefined/);assert.match(recordMixChart({}),/暂无逐笔记录/);
});
