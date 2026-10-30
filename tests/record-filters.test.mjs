import test from 'node:test';
import assert from 'node:assert/strict';
import {validDate,validMonth,calculateBook} from '../dist/payroll.js';
import {recordDefaultRange,recordMonthRange,recordRangeIssue,recordRangeContains,recordRangeIsDefault,recordRangeLabel} from '../dist/record-filters.js';
import {planLeaveEntry,planDatedEntry} from '../dist/entry-dates.js';
import {makeCleanupPlan} from '../dist/data-tools.js';

test('2089边界一致：有效年月、闰年、未来记账、清理范围；2090不进入账本',()=>{
 for(const date of ['2041-01-01','2044-02-29','2088-02-29','2089-12-31'])assert(validDate(date),date);
 for(const date of ['2089-02-29','2090-01-01','2019-12-31'])assert(!validDate(date),date);
 assert(validMonth('2089-12'));assert(!validMonth('2090-01'));
 const book={version:2,defaults:{salaryCents:600000,company:'测试',joinDate:'2089-01-01',payday:15,periodMode:'calendar'},months:{}};
 const plan=planDatedEntry(book,{sourceMonth:'2089-01',key:'subsidies',item:{id:'future',date:'2089-12-31',amountCents:10000,category:'补贴',note:''}});
 assert.equal(plan.months['2089-12'].subsidies[0].date,'2089-12-31');
 assert.equal(calculateBook(plan.months,book.defaults,'2089-12-31').periods.at(-1).subsidyCents,10000);
 assert.deepEqual(makeCleanupPlan(plan.months,{}, {scope:'month',target:'local',month:'2089-12'}).localKeys,['2089-12']);
 assert.throws(()=>makeCleanupPlan(plan.months,{}, {scope:'year',target:'local',year:'2090'}));
 const leave=planLeaveEntry(book,{sourceMonth:'2089-01',start:'2089-12-30',end:'2089-12-31',days:1,mode:'no',makeId:()=>crypto.randomUUID()});
 assert.equal(leave.months['2089-12'].leaves.length,2);assert.deepEqual(book.months,{});
});
test('明细日期默认值为所选年全年，月份完整覆盖闰日',()=>{
 assert.deepEqual(recordDefaultRange('2089'),{start:'2089-01-01',end:'2089-12-31'});
 assert.deepEqual(recordMonthRange('2088-02'),{start:'2088-02-01',end:'2088-02-29'});
 assert(recordRangeIsDefault(recordDefaultRange('2026'),'2026'));
 assert.equal(recordRangeLabel(recordDefaultRange('2026'),'2026'),'全年 · 默认');
 assert.equal(recordRangeLabel(recordMonthRange('2026-10'),'2026'),'10月');
 assert.throws(()=>recordDefaultRange('2090'));
});
test('明细日期筛选含首尾、可跨月，拒绝倒置和跨年隐性混入',()=>{
 const range={start:'2026-09-30',end:'2026-10-02'};
 assert.equal(recordRangeIssue(range,'2026'),'');
 for(const date of ['2026-09-30','2026-10-01','2026-10-02'])assert(recordRangeContains(date,range));
 for(const date of ['2026-09-29','2026-10-03','invalid'])assert(!recordRangeContains(date,range));
 assert.match(recordRangeIssue({start:range.end,end:range.start},'2026'),/不能晚于/);
 assert.match(recordRangeIssue({start:'2025-12-31',end:'2026-01-01'},'2026'),/2026年内/);
 assert.equal(recordRangeLabel(range,'2026'),'09/30—10/02');
});
