import test from 'node:test';
import assert from 'node:assert/strict';
import {entryRangeDates,entryDateBounds,entryDateIssue,planLeaveEntry,planDatedEntry} from '../dist/entry-dates.js';
import {calculateBook,leaveDeducts} from '../dist/payroll.js';
import {rememberDeletions,mergeBooks} from '../dist/sync-merge.js';
import {snapshotBook} from '../dist/sync-tools.js';

const settings={salaryCents:600000,joinDate:'2024-01-01',company:'测试公司',periodMode:'custom',periodStartDay:21,payday:15,holidayLeaveDeduct:false,adjustedLeaveDeduct:false};
const record=(extra={})=>({...settings,leaves:[],overtime:[],subsidies:[],deductions:[],advances:[],payments:[],...extra});
const book=()=>({version:2,defaults:{...settings},months:{'2024-02':record(),'2024-03':record(),'2025-12':record(),'2026-01':record()},excludedMonths:[],sync:{auto:false}});
const leaveArgs={sourceMonth:'2025-12',start:'2025-12-31',end:'2026-01-02',days:1,mode:'defaults',note:'跨月请假'};
function ids(){let n=0;return ()=>`new-${++n}`;}

test('日期选择范围覆盖原有年份，跨月跨年与闰年日期按自然月展开',()=>{
 assert.deepEqual(entryRangeDates('2024-02-28','2024-03-01'),['2024-02-28','2024-02-29','2024-03-01']);
 assert.deepEqual(entryRangeDates('2025-12-31','2026-01-02'),['2025-12-31','2026-01-01','2026-01-02']);
 assert.deepEqual(entryRangeDates('2026-02-29','2026-03-01'),[]);assert.deepEqual(entryRangeDates('2026-03-02','2026-03-01'),[]);
 assert.deepEqual(entryDateBounds(book()),{min:'2024-01-01',max:'2089-12-31'});assert.match(entryDateIssue(book(),'2090-01-01'),/2020至2089/);
});
test('跨月请假逐日保存，扣款默认值和原计薪结果等同于手工逐月录入',()=>{
 const original=book(),before=JSON.stringify(original),plan=planLeaveEntry(original,{...leaveArgs,makeId:ids()});
 assert.equal(JSON.stringify(original),before);assert.equal(plan.months['2025-12'].leaves.length,1);assert.equal(plan.months['2026-01'].leaves.length,2);
 for(const item of plan.items)assert.equal(item.deduct,leaveDeducts({date:item.date},settings));
 const manual=structuredClone(original);for(const item of plan.items)manual.months[item.date.slice(0,7)].leaves.push(item);
 assert.deepEqual(calculateBook(plan.months,settings,'2026-01-02'),calculateBook(manual.months,settings,'2026-01-02'));
});
test('跨月范围任何一天重复或早于该月入职日期时整笔拒绝，原记录不受影响',()=>{
 const original=book();original.months['2026-01'].leaves=[{id:'existing',date:'2026-01-02',days:.5,deduct:false}];const before=JSON.stringify(original);
 assert.throws(()=>planLeaveEntry(original,{...leaveArgs,makeId:ids()}),/2026-01-02已有记录/);assert.equal(JSON.stringify(original),before);
 original.months['2026-01']={...record(),joinDate:'2026-01-02'};assert.throws(()=>planLeaveEntry(original,{...leaveArgs,makeId:ids()}),/入职日期/);
 assert.throws(()=>planLeaveEntry(book(),{...leaveArgs,days:.5,makeId:ids()}),/半天/);
});
test('请假修改到另一个月份保留单日编号，移除原日期并保留其他请假和真实收款',()=>{
 const original=book();original.months['2025-12'].leaves=[{id:'edit',date:'2025-12-30',days:1,deduct:true},{id:'keep',date:'2025-12-29',days:.5,deduct:false}];
 original.months['2025-12'].payments=[{id:'cash',date:'2026-01-01',amountCents:10000,periodStart:'2025-12-21',periodEnd:'2026-01-20',company:settings.company}];
 const plan=planLeaveEntry(original,{...leaveArgs,editingId:'edit',start:'2026-01-02',end:'2026-01-02',days:.5,mode:'no',makeId:ids()});
 assert.deepEqual(plan.months['2025-12'].leaves.map(x=>x.id),['keep']);assert.equal(plan.items[0].id,'edit');assert.equal(plan.items[0].deduct,false);assert.equal(plan.items[0].days,.5);
 assert.deepEqual(plan.months['2025-12'].payments,original.months['2025-12'].payments);assert.equal(original.months['2025-12'].leaves.length,2);
});
test('加班补贴扣款按日期归档或跨月移动，金额、编号、旧月数据和目标月工资标准保留',()=>{
 for(const key of ['overtime','subsidies','deductions']){
  const original=book(),item=key==='overtime'?{id:'edit',date:'2025-12-30',mode:'custom',amountCents:12345,note:'原备注'}:{id:'edit',date:'2025-12-30',category:'自定义项目',amountCents:12345,note:'原备注'};
  original.months['2025-12'][key]=[item];original.months['2026-01'].salaryCents=700000;
  const before=JSON.stringify(original),plan=planDatedEntry(original,{sourceMonth:'2025-12',key,item:{...item,date:'2026-01-02'},editingId:'edit'});
  assert.equal(JSON.stringify(original),before);assert.equal(plan.months['2025-12'][key].length,0);assert.deepEqual(plan.months['2026-01'][key],[{...item,date:'2026-01-02'}]);assert.equal(plan.months['2026-01'].salaryCents,700000);
  const manual=structuredClone(original);manual.months['2025-12'][key]=[];manual.months['2026-01'][key]=[{...item,date:'2026-01-02'}];assert.deepEqual(calculateBook(plan.months,settings,'2026-01-02'),calculateBook(manual.months,settings,'2026-01-02'));
 }
});
test('跨月编辑的删除标记仍按原月份隔离，已有同步合并不会复活旧记录或删除新位置',()=>{
 const original=book();original.months['2025-12'].subsidies=[{id:'move',date:'2025-12-31',category:'餐补',amountCents:10000}];const baseline=snapshotBook(original);
 const plan=planDatedEntry(original,{sourceMonth:'2025-12',key:'subsidies',editingId:'move',item:{...original.months['2025-12'].subsidies[0],date:'2026-01-01'}});
 const local={...original,months:plan.months};rememberDeletions(local,baseline,'move-version');
 const merged=mergeBooks(baseline,local,original);assert.equal(merged.conflicts.length,0);assert.equal(merged.book.months['2025-12'].subsidies.length,0);assert.equal(merged.book.months['2026-01'].subsidies[0].id,'move');
});
