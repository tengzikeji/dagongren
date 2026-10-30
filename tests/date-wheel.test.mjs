import test from 'node:test';
import assert from 'node:assert/strict';
import {createDateWheelModel} from '../dist/date-wheel.js';
import {shiftRecordRangeYear,shiftRecordYearState} from '../dist/record-filters.js';
import {createWheelFeedback} from '../dist/wheel-feedback.js';

test('日期滚轮联动闰年二月、大小月和年末，始终保持真实日期',()=>{
 const wheel=createDateWheelModel({value:'2024-02-29'});
 wheel.select('year','2025');assert.equal(wheel.value(),'2025-02-28');assert.equal(wheel.options('day').length,28);
 wheel.select('month','3');wheel.select('day','31');assert.equal(wheel.value(),'2025-03-31');
 wheel.select('month','4');assert.equal(wheel.value(),'2025-04-30');assert.equal(wheel.options('day').length,30);
 wheel.select('year','2088');wheel.select('month','2');wheel.select('day','29');assert.equal(wheel.value(),'2088-02-29');
 wheel.select('year','2089');wheel.select('month','12');wheel.select('day','31');assert.equal(wheel.value(),'2089-12-31');assert.equal(wheel.allows('2090-01-01'),false);
 assert.equal(wheel.select('unknown',12),false);assert.equal(wheel.value(),'2089-12-31');
});
test('日期滚轮统一约束入职界限、逐月不可选日和未来收款',()=>{
 const wheel=createDateWheelModel({value:'2023-01-01',min:'2024-02-15',max:'2026-10-30',allowed:date=>!date.startsWith('2025-01')});
 assert.equal(wheel.value(),'2024-02-15');assert(wheel.options('year').find(row=>row.value==='2023').disabled);
 wheel.select('year','2025');wheel.select('month','1');assert.equal(wheel.value().slice(0,7),'2025-02');
 wheel.select('year','2026');wheel.select('month','12');wheel.select('day','31');assert.equal(wheel.value(),'2026-10-30');
 assert(wheel.options('day').find(row=>row.value==='31').disabled);assert(wheel.options('month').find(row=>row.value==='11').disabled);
 assert.equal(wheel.allows('2024-02-14'),false);assert.equal(wheel.allows('2026-10-31'),false);
});
test('月份、年份和每月日数只提供对应滚轮，不引入无关日期或改变上下界',()=>{
 const month=createDateWheelModel({kind:'month',value:'2089-12'});assert.deepEqual(month.parts,['year','month']);assert.equal(month.value(),'2089-12');
 const year=createDateWheelModel({kind:'year',value:'2026'});assert.deepEqual(year.parts,['year']);assert.equal(year.options('year').length,70);year.select('year','2089');assert.equal(year.value(),'2089');
 const day=createDateWheelModel({kind:'day',value:'31'});assert.deepEqual(day.parts,['day']);assert.equal(day.options('day').length,31);assert.equal(day.value(),'31');
 assert.throws(()=>createDateWheelModel({kind:'date',allowed:()=>false}),/暂无可选/);
});
test('明细三处年份共用，分别保留月日范围，闰日按新年校正，输入状态不被改写',()=>{
 const ranges={salary:{start:'2024-02-01',end:'2024-02-29'},entries:{start:'2024-05-01',end:'2024-05-31'}},before=JSON.stringify(ranges);
 const result=shiftRecordYearState('2025',ranges,'2024-02');assert.equal(result.recordYear,'2025');assert.equal(result.entryMonthScope,'2025-02');
 assert.deepEqual(result.recordDateRanges,{salary:{start:'2025-02-01',end:'2025-02-28'},entries:{start:'2025-05-01',end:'2025-05-31'}});assert.equal(JSON.stringify(ranges),before);
 assert.deepEqual(shiftRecordYearState('2089',{salary:null,entries:{start:'2026-01-01',end:'2026-12-31'}}).recordDateRanges,{salary:null,entries:null});
 assert.deepEqual(shiftRecordRangeYear({start:'2088-02-29',end:'2088-03-01'},'2089'),{start:'2089-02-28',end:'2089-03-01'});
 assert.throws(()=>shiftRecordYearState('2090',ranges));
});
function feedbackFixture(){let time=100,raw=null;const calls=[],storage={getItem:()=>raw,setItem:(key,value)=>{raw=value;}};const feedback=createWheelFeedback({storage,bridge:{dateWheelFeedback:(...args)=>calls.push(args)},now:()=>time});return {feedback,calls,storage,step:()=>{time+=60;},raw:()=>raw};}
test('滚动音效和触感默认开启，分别持久化，程序同步无反馈，不写入账本',()=>{
 const f=feedbackFixture();assert.deepEqual(f.feedback.read(),{sound:true,haptic:true});assert.equal(f.raw(),null);
 assert.equal(f.feedback.tick(),false);assert.deepEqual(f.calls,[]);
 f.feedback.tick({userInitiated:true});assert.deepEqual(f.calls,[[true,true]]);
 f.feedback.set('sound',false);f.step();f.feedback.tick({userInitiated:true});assert.deepEqual(f.calls.at(-1),[false,true]);
 f.feedback.set('haptic',false);f.step();assert.equal(f.feedback.tick({userInitiated:true}),false);assert.equal(f.calls.length,2);
 const reload=createWheelFeedback({storage:f.storage});assert.deepEqual(reload.read(),{sound:false,haptic:false});
 assert.deepEqual(Object.keys(JSON.parse(f.raw())).sort(),['haptic','sound']);
});
test('快速滚动反馈限频，保存失败保留旧偏好，损坏配置安全恢复',()=>{
 const f=feedbackFixture();f.feedback.tick({userInitiated:true});assert.equal(f.feedback.tick({userInitiated:true}),false);assert.equal(f.calls.length,1);f.step();f.feedback.tick({userInitiated:true});assert.equal(f.calls.length,2);
 f.storage.setItem=()=>{throw Error('quota')};assert.throws(()=>f.feedback.set('sound',false));assert.deepEqual(f.feedback.read(),{sound:true,haptic:true});
 assert.deepEqual(createWheelFeedback({storage:{getItem:()=>'{'}}).read(),{sound:true,haptic:true});assert.throws(()=>f.feedback.set('unknown',true));
});
test('日期滚轮初始化按可用性短路，不遍历完整七十年日期',()=>{
 let checks=0;const wheel=createDateWheelModel({value:'2026-10-30',min:'2024-01-01',allowed:()=>{checks++;return true;}});
 for(const part of wheel.parts)wheel.options(part);
 assert.equal(wheel.value(),'2026-10-30');assert.equal(wheel.options('year').length,70);
 assert(checks<300,'Opening a normal date wheel should not enumerate every day: '+checks);
 const sparse=createDateWheelModel({value:'2025-01-01',min:'2024-01-01',max:'2026-12-31',allowed:date=>date==='2024-02-29'||date==='2026-06-20'});
 assert.equal(sparse.value(),'2024-02-29');assert(sparse.options('year').find(row=>row.value==='2025').disabled);
 sparse.select('year','2026');assert.equal(sparse.value(),'2026-06-20');assert(sparse.options('month').find(row=>row.value==='5').disabled);
});
test('快速滚动时触感逐帧跟随，音效独立限频，程序定位不产生排队反馈',()=>{
 let time=100;const calls=[],feedback=createWheelFeedback({storage:{getItem:()=>null},bridge:{dateWheelFeedback:(sound,haptic)=>calls.push({time,sound,haptic})},now:()=>time});
 for(let frame=0;frame<9;frame++){time=100+frame*8;assert(feedback.tick({userInitiated:true}));}
 assert.deepEqual(calls.map(call=>call.haptic),Array(9).fill(true));
 assert.deepEqual(calls.map(call=>call.sound),[true,false,false,false,true,false,false,false,true]);
 time=165;assert.equal(feedback.tick({userInitiated:true}),false);
 time=500;assert.equal(feedback.tick(),false);assert.equal(calls.length,9);
});
