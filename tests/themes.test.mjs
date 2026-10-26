import test from 'node:test';
import assert from 'node:assert/strict';
import {themeCatalog,resolveTheme,themePicker} from '../dist/themes.js';
import {settlementChart,dailyWageChart,annualWageChart,employmentChart,profileChart,recordMixChart} from '../dist/charts.js';
test('四套主题各有独立布局及图表描述，非法旧设置安全回退',()=>{
 const themes=themeCatalog();assert.deepEqual(themes.map(x=>x.id),['classic','neon','paper','forest']);
 assert.equal(new Set(themes.map(x=>x.layout)).size,4);assert.equal(new Set(themes.map(x=>x.chart)).size,4);
 themes[0].name='不能污染目录';assert.equal(resolveTheme(null).name,'雾蓝经典');assert.equal(resolveTheme('<script>').id,'classic');
 const picker=themePicker('forest');assert.equal((picker.match(/data-action="choose-theme"/g)||[]).length,4);assert.equal((picker.match(/aria-pressed="true"/g)||[]).length,1);
});
test('全部主题每日图表保留正负和零金额，与日历账本同源',()=>{
 const daily=[{date:'2026-10-01',amountCents:10001},{date:'2026-10-02',amountCents:-20203},{date:'2026-10-03',amountCents:0}],total=-10202;
 for(const {id} of themeCatalog()){
  const html=dailyWageChart('2026-10',daily,total,id);
  for(const item of daily)assert.match(html,new RegExp('data-date="'+item.date+'" data-amount="'+item.amountCents+'"'));
  assert.match(html,/-102\.02/);assert.doesNotMatch(html,/NaN|Infinity|undefined/);
  assert.match(dailyWageChart('2026-10',[],0,id),/暂无/);
 }
});
test('各主题年度图表按计薪月与实际收款月统计，不改写收款',()=>{
 const book={byMonth:{'2026-01':{expectedCents:-12345},'2026-02':{expectedCents:67890}},receipts:[{date:'2026-02-20',amountCents:1234},{date:'2026-02-21',amountCents:5000},{date:'2025-02-21',amountCents:9000}]},before=JSON.stringify(book);
 for(const {id} of themeCatalog()){
  const html=annualWageChart('2026',book,id);
  assert.match(html,/data-kind="earned" data-amount="-12345"/);assert.match(html,/data-kind="received" data-amount="6234"/);
  assert.doesNotMatch(html,/NaN|Infinity|undefined/);
 }
 assert.equal(JSON.stringify(book),before);
});
test('所有主题收款进度不计待抵扣预支，未计薪与清空不伪造比例',()=>{
 for(const {id} of themeCatalog()){
  const html=settlementChart({receivedCents:50000,unappliedCents:10000,remainingCents:60000},id);
  assert.match(html,/40\.0/);assert.match(html,/400\.00/);assert.match(html,/600\.00/);
  assert.doesNotMatch(settlementChart({receivedCents:0,unappliedCents:0,remainingCents:0},id),/NaN|Infinity/);
 }
});
test('工龄按真实周年显示，不同主题分别呈现环形、仪表、时间轴与轨道',()=>{
 const styles=['chart-ring','theme-gauge','paper-timeline','theme-orbit'];
 for(const [i,{id}] of themeCatalog().entries()){
  const html=employmentChart('2024-02-29','2026-03-01',id);
  assert.match(html,new RegExp(styles[i]));assert.match(html,/data-stat="years">2/);assert.match(html,/data-stat="months">24/);
  assert.match(employmentChart('2026-12-01','2026-03-01',id),/距(?:离)?入职还有/);
  assert.doesNotMatch(employmentChart('bad','2026-03-01',id),/NaN|Infinity|undefined/);
 }
});
test('所有主题六类记录共用一个位置，兼容旧工资且清理后归零',()=>{
 const months={'2026-10':{leaves:[{},{}],overtime:[{}],subsidies:[{}],deductions:[{}],advances:[{}],payment:{amountCents:5000,date:'2026-10-15'}}};
 for(const {id} of themeCatalog()){
  const employment=profileChart(months,'2026-01-01','2026-10-26','employment',id),records=profileChart(months,'2026-01-01','2026-10-26','records',id);
  assert.equal((employment.match(/profile-chart-panel/g)||[]).length,1);assert.equal((records.match(/profile-chart-panel/g)||[]).length,1);
  assert.match(records,/7<small> 笔/);assert.match(records,/请假/);assert.match(records,/28\.6/);
  assert.doesNotMatch(recordMixChart({},id),/NaN|Infinity|undefined/);
 }
});
