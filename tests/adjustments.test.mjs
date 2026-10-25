import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,calculateBook,migrateBook} from '../dist/payroll.js';
import {makeCleanupPlan,applyCleanupPlan,mergeDemoRecords} from '../dist/data-tools.js';
const settings={salaryCents:310000,company:'公司甲',joinDate:'2026-10-01',periodMode:'calendar',periodStartDay:1,payday:15};
const record=(extra={})=>({...settings,leaves:[],overtime:[],advances:[],payments:[],...extra});
const item=(id,date,amountCents,category='自定义项目')=>({id,date,amountCents,category});
const cash=(id,amountCents,extra={})=>({id,date:'2026-10-22',amountCents,periodStart:'2026-10-01',periodEnd:'2026-10-31',company:'公司甲',...extra});
function conserved(b){
  const applied=b.receipts.reduce((n,r)=>n+r.amountCents-r.unappliedCents,0);
  assert.equal(b.expectedCents+b.deductionCarryCents,applied+b.remainingCents);
  assert.equal(b.receivedCents,applied+b.unappliedCents);
  assert.equal(b.periods.reduce((n,p)=>n+p.remainingCents,0),b.remainingCents);
  assert.equal(b.periods.reduce((n,p)=>n+p.expectedCents,0),b.expectedCents);
  assert.equal(Object.values(b.byMonth).reduce((n,m)=>n+m.remainingCents,0),b.remainingCents);
  for(const c of b.chunks)assert.ok(c.remainingCents>=0&&c.settlementCents>=c.remainingCents);
  for(const r of b.receipts)assert.ok(r.allocations.every(a=>a.amountCents>0));
}
test('预置或自定义补贴扣款与请假、加班一起计薪，不冒充真实收款',()=>{
  const r=record({leaves:[{date:'2026-10-02',days:.5,deduct:true}],overtime:[{id:'o',date:'2026-10-03',mode:'custom',amountCents:8800}],subsidies:[item('s','2026-10-04',20000,'交通补贴')],deductions:[item('d','2026-10-05',5000,'住宿费')]});
  const c=calculate('2026-10',r,'2026-10-22');assert.equal(c.expectedCents,238800);assert.equal(c.subsidyCents,20000);assert.equal(c.wageDeductionCents,5000);assert.equal(c.receivedCents,0);assert.equal(c.daily.reduce((n,x)=>n+x.amountCents,0),c.expectedCents);
  const b=calculateBook({'2026-10':r},settings,'2026-10-22');assert.equal(b.remainingCents,238800);conserved(b);
});
test('未来补贴和扣款到当天生效，入职前记录不计薪',()=>{
  const r=record({joinDate:'2026-10-10',subsidies:[item('pre','2026-10-02',50000),item('s','2026-10-23',20000)],deductions:[item('d','2026-10-23',8000)]});
  const a=calculate('2026-10',r,'2026-10-22'),b=calculate('2026-10',r,'2026-10-23');assert.equal(a.subsidyCents,0);assert.equal(a.expectedCents,130000);assert.equal(b.expectedCents,152000);assert.equal(b.daily.at(-1).amountCents,22000);
});
test('扣款超过一天工资时抵扣同账期其他已计薪，不产生负数收款分摊',()=>{
  const r=record({deductions:[item('d','2026-10-22',150000)],advances:[cash('a',20000)]}),b=calculateBook({'2026-10':r},settings,'2026-10-22');
  assert.equal(b.expectedCents,70000);assert.equal(b.remainingCents,50000);assert.equal(b.deductionCarryCents,0);assert.ok(b.chunks.find(x=>x.date==='2026-10-22').amountCents<0);conserved(b);
});
test('大额扣款差额明确保留并随原账期后续日薪抵扣',()=>{
  const r=record({deductions:[item('d','2026-10-01',50000)],payments:[cash('p',12000,{date:'2026-10-01'})]}),m={'2026-10':r};
  const a=calculateBook(m,settings,'2026-10-01');assert.equal(a.expectedCents,-40000);assert.equal(a.remainingCents,0);assert.equal(a.deductionCarryCents,40000);assert.equal(a.unappliedCents,12000);conserved(a);
  const b=calculateBook(m,settings,'2026-10-06');assert.equal(b.deductionCarryCents,0);assert.equal(b.remainingCents,0);assert.equal(b.unappliedCents,2000);conserved(b);
  const c=calculateBook(m,settings,'2026-10-07');assert.equal(c.remainingCents,8000);assert.equal(c.unappliedCents,0);conserved(c);
});
test('扣款不跨主体、跨账期抵扣；负数和待抵扣保持可见',()=>{
  const m={'2026-09':record({joinDate:'2026-09-01',company:'公司乙'}),'2026-10':record({deductions:[item('d','2026-10-01',500000)]})},b=calculateBook(m,settings,'2026-10-22');
  assert.equal(b.byMonth['2026-09'].remainingCents,310000);assert.equal(b.byMonth['2026-10'].remainingCents,0);assert.equal(b.deductionCarryCents,280000);assert.equal(b.remainingCents,310000);conserved(b);
});
test('跨自然月账期正确合并补贴扣款，并限制在该账期',()=>{
  const s={...settings,joinDate:'2026-09-21',periodMode:'custom',periodStartDay:21},m={'2026-09':record({...s}),'2026-10':record({...s,subsidies:[item('s','2026-10-02',30000)],deductions:[item('d','2026-10-20',200000),item('d2','2026-10-22',50000)]})},b=calculateBook(m,s,'2026-10-22');
  const a=b.periods.find(p=>p.start==='2026-09-21'),c=b.periods.find(p=>p.start==='2026-10-21');assert.equal(a.subsidyCents,30000);assert.equal(a.wageDeductionCents,200000);assert.equal(c.wageDeductionCents,50000);assert.equal(c.deductionCarryCents,30000);assert.equal(c.remainingCents,0);assert.equal(a.remainingCents,a.expectedCents);conserved(b);
});
test('修改删除补贴扣款后重新分配抵扣，已收现金金额不变',()=>{
  const r=record({subsidies:[item('s','2026-10-05',10000)],deductions:[item('d','2026-10-05',20000)],payments:[cash('p',220000)]}),m={'2026-10':r};
  const a=calculateBook(m,settings,'2026-10-22');assert.equal(a.unappliedCents,10000);r.deductions=[];const b=calculateBook(m,settings,'2026-10-22');assert.equal(b.remainingCents,10000);assert.equal(b.receivedCents,220000);r.subsidies=[];const c=calculateBook(m,settings,'2026-10-22');assert.equal(c.remainingCents,0);assert.equal(c.receivedCents,220000);conserved(a);conserved(b);conserved(c);
});
test('旧账本升级兼容新增字段，保留原始数据及自定义名称',()=>{
  const raw={version:2,defaults:settings,months:{'2026-10':record({subsidies:[item('s','2026-10-01',12345,'项目奖励')],deductions:[item('d','2026-10-02',678,'工作服费用')]})},sync:{cloudMonths:{}}},copy=JSON.stringify(raw),m=migrateBook(raw,settings,'2026-10-22');assert.equal(m.months['2026-10'].subsidies[0].category,'项目奖励');assert.equal(JSON.stringify(raw),copy);assert.equal(calculateBook(m.months,m.defaults,'2026-10-22').expectedCents,231667);
});
test('拒绝空项目、跨月日期、重复编号和非整数分金额',()=>{
  for(const invalid of [item('s','2026-10-02',1,''),item('s','2026-11-02',1),item('s','2026-10-02',1.5),item('s','2026-10-02',0),item('s','2026-10-02',-1),item('s','2026-10-02',1,' 名称 ')])assert.throws(()=>calculate('2026-10',record({subsidies:[invalid]}),'2026-10-22'));
  assert.throws(()=>calculate('2026-10',record({subsidies:[item('same','2026-10-02',1)],deductions:[item('same','2026-10-03',1)]}),'2026-10-22'));
});
test('演示同步、清理数量与范围覆盖补贴扣款，防止旧计划误删更新',()=>{
  const local={'2026-10':record({subsidies:[item('s','2026-10-01',30000)],deductions:[item('d','2026-10-01',20000)]})},cloud=mergeDemoRecords(local,{}),options={scope:'month',month:'2026-10',year:'2026',target:'both'},p=makeCleanupPlan(local,cloud,options);assert.equal(p.local.subsidies,1);assert.equal(p.cloud.deductions,1);assert.notEqual(cloud['2026-10'].subsidies,local['2026-10'].subsidies);assert.deepEqual(applyCleanupPlan(local,cloud,p),{local:{},cloud:{}});local['2026-10'].subsidies[0].amountCents++;assert.throws(()=>applyCleanupPlan(local,cloud,p));
});
test('多公司、多账期、多笔调整与收款始终金额守恒',()=>{
  let state=13;const rnd=n=>{state=(state*1664525+1013904223)>>>0;return state%n;};
  for(let i=0;i<120;i++){const m={};for(const month of ['2026-08','2026-09','2026-10']){const r=record({company:rnd(2)?'公司甲':'公司乙',joinDate:'2026-08-01',salaryCents:rnd(900000),subsidies:[],deductions:[]});for(let j=0;j<8;j++){r.subsidies.push(item('s'+j,month+'-'+String(rnd(22)+1).padStart(2,'0'),rnd(80000)+1));r.deductions.push(item('d'+j,month+'-'+String(rnd(22)+1).padStart(2,'0'),rnd(200000)+1));}r.payments=[cash('p',rnd(700000),{date:month+'-22',periodStart:month+'-01',periodEnd:month+'-28',company:r.company})];m[month]=r;}const before=JSON.stringify(m),b=calculateBook(m,{...settings,periodMode:rnd(2)?'custom':'calendar',periodStartDay:rnd(31)+1},'2026-10-22');conserved(b);assert.equal(JSON.stringify(m),before);}
});
