import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,calculateBook,ensureAccrualMonths,migrateBook} from '../dist/payroll.js';
import {makeCleanupPlan,applyCleanupPlan} from '../dist/data-tools.js';
import {buildPairedCleanup} from '../dist/cloud-cleanup.js';
import {mergeBooks} from '../dist/sync-merge.js';
import {employmentChart} from '../dist/charts.js';

const settings={salaryCents:290000,company:'甲公司',joinDate:'2024-02-01',periodMode:'calendar',periodStartDay:1,payday:15};
const record=(extra={})=>({...settings,leaves:[],overtime:[],subsidies:[],deductions:[],advances:[],payments:[],payment:null,...extra});
const book=months=>({version:2,defaults:{...settings},months,excludedMonths:[]});
const cash=(id,company,amountCents=10000)=>({id,company,amountCents,date:'2024-02-20',periodStart:'2024-01-01',periodEnd:'2024-01-31'});

test('离职当天计薪，补填过去日期只回算其后基础工资，原始流水不改写',()=>{
 const r=record({leaveDate:'2024-02-10',leaves:[{id:'leave',date:'2024-02-14',days:1,deduct:true}],overtime:[{id:'ot',date:'2024-02-11',mode:'custom',amountCents:1000}],subsidies:[{id:'s',date:'2024-02-12',category:'补贴',amountCents:2000}],deductions:[{id:'d',date:'2024-02-13',category:'扣款',amountCents:500}],payments:[cash('p','甲公司',80000)]}),before=JSON.stringify(r),c=calculate('2024-02',r,'2024-02-29');
 assert.equal(c.accruedDays,10);assert.equal(c.baseCents,100000);assert.equal(c.expectedCents,102500);assert.equal(c.deductionCents,0);assert.equal(c.paymentCents,80000);assert.equal(c.plannedLeaveDays,1);assert.equal(JSON.stringify(r),before);
 assert.deepEqual(c.daily.filter(d=>d.date>'2024-02-10').map(d=>[d.date,d.grossCents,d.amountCents]),[['2024-02-11',0,1000],['2024-02-12',0,2000],['2024-02-13',0,-500]]);
 assert.equal(calculate('2024-02',r,'2024-02-09').baseCents,90000);
});
test('离职后补发工资继续计入真实收款，多收部分不因回算被删除',()=>{
 const r=record({leaveDate:'2024-02-10',payments:[{...cash('p','甲公司',150000),date:'2024-03-05',periodStart:'2024-02-01',periodEnd:'2024-02-29'}]}),b=calculateBook({'2024-02':r},settings,'2024-04-01');
 assert.equal(b.expectedCents,100000);assert.equal(b.receivedCents,150000);assert.equal(b.unappliedCents,50000);assert.equal(b.remainingCents,0);assert.equal(b.periods[0].accruedDays,10);
 assert.equal(calculateBook({'2024-02':r},settings,'2024-02-29').receivedCents,0);
});
test('未来离职只累计到当天，清空离职日期后按原规则恢复基础计薪',()=>{
 const r=record({leaveDate:'2024-02-25'});assert.equal(calculate('2024-02',r,'2024-02-20').baseCents,200000);assert.equal(calculate('2024-02',r,'2024-02-29').baseCents,250000);assert.equal(calculate('2024-02',{...r,leaveDate:''},'2024-02-29').baseCents,290000);
 assert.throws(()=>calculate('2024-02',{...r,leaveDate:'2024-01-31'},'2024-02-29'),/离职/);assert.throws(()=>calculate('2024-02',{...r,leaveDate:'2024-02-30'},'2024-02-29'),/离职/);
});
test('跨月自定义账期在离职日截止，分位舍入和计薪天数保持一致',()=>{
 const s={...settings,salaryCents:300000,joinDate:'2024-11-21',periodMode:'custom',periodStartDay:21},r=record({...s,leaveDate:'2024-12-10'}),b=calculateBook({'2024-11':structuredClone(r),'2024-12':structuredClone(r)},s,'2025-02-01');
 assert.equal(b.expectedCents,200000);assert.equal(b.periods.length,1);assert.equal(b.periods[0].accruedDays,20);assert.equal(b.byMonth['2024-12'].accruedDays,10);
});
test('离职后不自动新建月份，已有其他主体月份和手工数据保留',()=>{
 const b=book({'2024-04':record({company:'乙公司',joinDate:'2024-04-01'})});b.defaults.leaveDate='2024-02-10';assert.equal(ensureAccrualMonths(b,'2024-06-01'),true);assert.deepEqual(Object.keys(b.months).sort(),['2024-02','2024-04']);assert.equal(b.months['2024-04'].company,'乙公司');assert.equal(ensureAccrualMonths(b,'2024-07-01'),false);
 b.defaults.leaveDate='';assert.equal(ensureAccrualMonths(b,'2024-07-01'),true);assert(b.months['2024-07']);
});
test('升级旧账本仅为同主体同段任职继承离职日期，其他历史不受影响',()=>{
 const b=book({'2024-02':record(),'2024-03':record({company:'乙公司',joinDate:'2024-03-01'})});b.defaults.leaveDate='2024-02-10';const before=JSON.stringify(b),next=migrateBook(b,settings,'2024-04-01');
 assert.equal(next.months['2024-02'].leaveDate,'2024-02-10');assert.equal(next.months['2024-03'].leaveDate,undefined);assert.equal(JSON.stringify(b),before);assert.equal(calculate('2024-03',next.months['2024-03'],'2024-04-01').accruedDays,31);
});
test('按主体清理保留同月代记的其他主体收款，并停止已清理主体的基础计薪',()=>{
 const b=book({'2024-01':record({company:'乙公司',joinDate:'2024-01-01'}),'2024-02':record({payments:[cash('foreign','乙公司')],subsidies:[{id:'s',date:'2024-02-02',category:'餐补',amountCents:100}]})});
 const p=makeCleanupPlan(b.months,{}, {scope:'all',target:'local',company:'甲公司'}),result=applyCleanupPlan(b.months,{},p);
 assert.deepEqual(p.localKeys,['2024-02']);assert.equal(p.local.paid,0);assert.equal(p.local.subsidies,1);assert.deepEqual(result.local['2024-01'],b.months['2024-01']);assert.equal(result.local['2024-02'].payments[0].id,'foreign');assert.equal(result.local['2024-02'].accrualDisabled,true);
 const summary=calculateBook(result.local,settings,'2024-02-29');assert.equal(summary.byMonth['2024-02'].baseCents,0);assert.equal(summary.receivedCents,10000);assert.equal(summary.periods.find(p=>p.company==='乙公司').receivedCents,10000);assert.equal(makeCleanupPlan(result.local,{},p.options).local.months,0);
});
test('清理异主体收款不清除宿主月份工资，也不设置该月停止计薪标记',()=>{
 const months={'2024-02':record({payments:[cash('foreign','乙公司'),cash('own','甲公司')],advances:[cash('advance','乙公司')],payment:{amountCents:5000,date:'2024-02-20',company:'乙公司'}})},p=makeCleanupPlan(months,{}, {scope:'all',target:'local',company:'乙公司'}),next=applyCleanupPlan(months,{},p).local;
 assert.equal(p.local.paid,2);assert.equal(p.local.advances,1);assert.deepEqual(p.localAccrualKeys,[]);assert.equal(next['2024-02'].accrualDisabled,undefined);assert.equal(calculate('2024-02',next['2024-02'],'2024-02-29').baseCents,290000);assert.deepEqual(next['2024-02'].payments.map(p=>p.id),['own']);
});
test('工作主体与月年范围取交集，全部主体保留原有清理语义',()=>{
 const months={'2024-01':record({'company':'甲公司'}),'2024-02':record({company:'乙公司'}),'2025-01':record()};
 assert.deepEqual(makeCleanupPlan(months,{}, {scope:'year',year:'2024',target:'local',company:'甲公司'}).localKeys,['2024-01']);assert.deepEqual(makeCleanupPlan(months,{}, {scope:'month',month:'2024-02',target:'local',company:'甲公司'}).localKeys,[]);assert.equal(makeCleanupPlan(months,{}, {scope:'all',target:'local',company:null}).local.months,3);assert.throws(()=>makeCleanupPlan(months,{}, {scope:'all',target:'local',company:{}}),/主体/);
});
test('确认期间其他主体收款更新仍保留，所选主体变化则拒绝旧清理计划',()=>{
 const months={'2024-02':record({payments:[cash('foreign','乙公司')]})},p=makeCleanupPlan(months,{}, {scope:'all',target:'local',company:'甲公司'}),fresh=structuredClone(months);fresh['2024-02'].payments.push(cash('new','乙公司'));
 assert.equal(applyCleanupPlan(fresh,{},p).local['2024-02'].payments.length,2);fresh['2024-02'].salaryCents++;assert.throws(()=>applyCleanupPlan(fresh,{},p),/变化/);
});
test('本机云端配对清理保留异主体收款，同步合并不恢复已清理工资和流水',()=>{
 const original=book({'2024-02':record({payments:[cash('own','甲公司'),cash('foreign','乙公司')]})}),result=buildPairedCleanup(original,structuredClone(original),{scope:'all',target:'both',company:'甲公司'},'company-cleanup');
 for(const b of [result.local,result.remote]){assert.equal(b.months['2024-02'].accrualDisabled,true);assert.deepEqual(b.months['2024-02'].payments.map(r=>r.id),['foreign']);assert.deepEqual(b.excludedMonths,['2024-02']);assert.deepEqual(b.defaults,original.defaults);}
 const merged=mergeBooks(original,result.local,original).book;assert.equal(merged.months['2024-02'].accrualDisabled,true);assert.deepEqual(merged.months['2024-02'].payments.map(r=>r.id),['foreign']);
});
test('两端同一月份属于不同主体时，不给保留的主体设置清理或删除标记',()=>{
 const local=book({'2024-02':record()}),remote=book({'2024-02':record({company:'乙公司'})}),result=buildPairedCleanup(local,remote,{scope:'all',target:'both',company:'甲公司'},'subject-isolation');
 assert.deepEqual(result.local.months,{});assert.deepEqual(result.local.excludedMonths,['2024-02']);assert.deepEqual(result.remote.months,remote.months);assert.deepEqual(result.remote.excludedMonths,[]);assert.equal(result.remote.tombstones,undefined);
});
test('离职后的任职时长固定在离职日，未来离职仍显示截至今天',()=>{
 const ended=employmentChart('2024-02-01','2024-04-01','classic','2024-02-10');assert.match(ended,/data-as-of="2024-02-10"/);assert.match(ended,/截至离职日/);assert.match(ended,/本段任职已结束/);assert.doesNotMatch(ended,/距下次周年/);
 assert.match(employmentChart('2024-02-01','2024-02-05','classic','2024-02-10'),/data-as-of="2024-02-05"/);
});
