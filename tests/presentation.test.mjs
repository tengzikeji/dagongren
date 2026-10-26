import test from 'node:test';
import assert from 'node:assert/strict';
import {numberRollPlan} from '../dist/interaction.js';
test('数码轮从最高位依次启动，每位至少滚动三圈并精确落位',()=>{
 const plan=numberRollPlan('1,234.56','9,876.54');
 assert.equal(plan.length,6);
 plan.forEach((wheel,i)=>{assert.equal(wheel.delay,i*35);assert.ok(wheel.steps>=30);assert.equal(wheel.digits[0],wheel.from);assert.equal(wheel.digits.at(-1),Number('987654'[i]));assert.equal(wheel.digits.length,wheel.steps+1);assert.ok(wheel.digits.every(x=>Number.isInteger(x)&&x>=0&&x<=9));});
 assert.ok(plan.every((x,i)=>i===0||x.delay>plan[i-1].delay));
});
test('金额跨位、负数及零保留小数的目标数字',()=>{
 for(const [old,next] of [['999.99','1,000.00'],['-120.50','13.09'],['1,000.00','0.00'],['0.00','123,456.78']]){
  const plan=numberRollPlan(old,next);
  assert.equal(plan.map(x=>x.digits.at(-1)).join(''),next.replace(/\D/g,''));
  assert.ok(plan.every(x=>x.delay+x.duration<=1650));
 }
 assert.deepEqual(numberRollPlan('1,234.00','1234.00'),[]);
 assert.deepEqual(numberRollPlan('0.00','—'),[]);
});
test('大量金额连续切换时，每次落点只对应当次目标',()=>{
 let old='0.00';
 for(let i=1;i<=200;i++){const next=((i*7919)%1000000/100).toFixed(2),plan=numberRollPlan(old,next);assert.equal(plan.map(w=>w.digits.at(-1)).join(''),next.replace(/\D/g,''));old=next;}
});

import {calendarSwipeDelta} from '../dist/interaction.js';
test('日历左右滑动一次只切一个月，纵向滚动与轻触不切月份',()=>{
 assert.equal(calendarSwipeDelta(-100,5,300),1);
 assert.equal(calendarSwipeDelta(100,-10,400),-1);
 for(const args of [[10,1,100],[47,0,100],[50,100,200],[-80,70,200],[100,0,31000],[NaN,0,100],[100,Infinity,100]])assert.equal(calendarSwipeDelta(...args),0);
 assert.equal(calendarSwipeDelta(-300,0,1500),1);
 assert.equal(calendarSwipeDelta(-100,0,5000),1);
});

import {pageSwipeTarget} from '../dist/interaction.js';
test('主页面左右切换按首页、日历、明细、我的排序且不绕回',()=>{
 assert.equal(pageSwipeTarget('home',1),'calendar');
 assert.equal(pageSwipeTarget('calendar',1),'records');
 assert.equal(pageSwipeTarget('records',1),'settings');
 assert.equal(pageSwipeTarget('settings',-1),'records');
 assert.equal(pageSwipeTarget('records',-1),'calendar');
 assert.equal(pageSwipeTarget('calendar',-1),'home');
 assert.equal(pageSwipeTarget('home',-1),null);
 assert.equal(pageSwipeTarget('settings',1),null);
 assert.equal(pageSwipeTarget('cleanup',1),null);
 assert.equal(pageSwipeTarget('sync',-1),null);
 assert.equal(pageSwipeTarget('home',0),null);
});

import {installCalendarSwipe,installPageSwipe} from '../dist/interaction.js';
function swipeFixture(owner=''){
 const handlers={},classes=new Set(),variables=new Map(),style={setProperty:(k,v)=>variables.set(k,v),removeProperty:k=>variables.delete(k)},classList={add:x=>classes.add(x),remove:x=>classes.delete(x)};
 const panel={style,classList},root={style,classList,addEventListener:(name,fn)=>handlers[name]=fn,querySelector:()=>null};
 const target={closest:selector=>owner==='calendar'&&selector.includes('[data-calendar-swipe]')?panel:owner==='name'&&selector.includes('.profile-name-viewport')?panel:null};
 const event=(time,x,y)=>({pointerId:1,isPrimary:true,isTrusted:true,button:0,timeStamp:time,clientX:x,clientY:y,target,cancelable:true,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}});
 return {root,panel,handlers,event,classes};
}
test('卡顿延迟处理触摸事件时，日历仍按真实事件时间切月份并阻止误点',()=>{
 const f=swipeFixture('calendar'),changes=[],oldNow=Date.now;let wall=1000;
 try{
  Date.now=()=>wall;installCalendarSwipe(f.root,delta=>changes.push(delta));
  f.handlers.pointerdown(f.event(1200,300,100));wall=100000;
  f.handlers.pointermove(f.event(1260,200,102));wall=200000;
  f.handlers.pointerup(f.event(1320,100,104));
  assert.deepEqual(changes,[1]);
  const ghost=f.event(1321,100,104);f.handlers.click(ghost);assert.equal(ghost.prevented,true);assert.equal(ghost.stopped,true);
  const routed=f.event(1322,100,104);routed.isTrusted=false;f.handlers.click(routed);assert.notEqual(routed.prevented,true);
  f.handlers.pointerdown(f.event(2000,200,100));f.handlers.pointermove(f.event(2030,204,180));f.handlers.pointerup(f.event(2100,204,200));
  assert.deepEqual(changes,[1]);assert.equal(f.classes.has('is-swiping'),false);
 }finally{Date.now=oldNow;}
});
test('延迟触屏事件切主页面，日历、长名称和表单保持操作归属',()=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document,previousNow=Date.now;let wall=1000,view='home',editing=false;
 try{
  globalThis.window={matchMedia:()=>({matches:true})};globalThis.document={documentElement:{clientWidth:400},body:{classList:{contains:()=>false}}};Date.now=()=>wall;
  const api={current:()=>view,blocked:()=>editing,navigate:next=>view=next};
  for(const [owner,from,expected] of [['','home','calendar'],['calendar','calendar','calendar'],['name','settings','settings']]){
   view=from;const f=swipeFixture(owner);installPageSwipe(f.root,api);f.handlers.pointerdown(f.event(1000,300,100));wall+=100000;f.handlers.pointermove(f.event(1060,200,100));f.handlers.pointerup(f.event(1120,100,100));assert.equal(view,expected);
  }
  editing=true;view='records';const f=swipeFixture();installPageSwipe(f.root,api);f.handlers.pointerdown(f.event(1000,300,100));f.handlers.pointermove(f.event(1060,200,100));f.handlers.pointerup(f.event(1120,100,100));assert.equal(view,'records');
 }finally{Date.now=previousNow;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('浏览器合并移动帧时，按下与抬起坐标仍能识别有效横滑',()=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 try{
  globalThis.window={matchMedia:()=>({matches:true})};globalThis.document={documentElement:{clientWidth:400},body:{classList:{contains:()=>false}}};
  const calendar=swipeFixture('calendar'),changes=[];installCalendarSwipe(calendar.root,delta=>changes.push(delta));
  calendar.handlers.pointerdown(calendar.event(1000,300,100));calendar.handlers.pointerup(calendar.event(1120,100,102));assert.deepEqual(changes,[1]);
  let view='home';const page=swipeFixture();installPageSwipe(page.root,{current:()=>view,navigate:next=>view=next});
  page.handlers.pointerdown(page.event(2000,300,100));page.handlers.pointerup(page.event(2120,100,102));assert.equal(view,'calendar');
  view='home';page.handlers.pointerdown(page.event(3000,200,100));page.handlers.pointerup(page.event(3120,205,103));assert.equal(view,'home');
  page.handlers.pointerdown(page.event(4000,200,100));page.handlers.pointerup(page.event(4120,204,200));assert.equal(view,'home');
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('安卓图表横滑在指针被取消后仍按完整触摸序列切页，竖滑和弹窗不误切',()=>{
 const beforeWindow=globalThis.window,beforeDocument=globalThis.document;let view='settings',blocked=false;
 try{
  globalThis.window={matchMedia:()=>({matches:true})};globalThis.document={documentElement:{clientWidth:400},body:{classList:{contains:()=>false}}};
  const handlers={},root={style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){}},addEventListener:(k,fn)=>handlers[k]=fn,querySelector:()=>null},panel={},target={closest:s=>s.includes('.profile-chart-panel')?panel:null};
  installPageSwipe(root,{current:()=>view,blocked:()=>blocked,navigate:next=>view=next});
  const touch=(x,y,time,end=false)=>({timeStamp:time,target,cancelable:true,preventDefault(){this.prevented=true},touches:end?[]:[{identifier:9,clientX:x,clientY:y}],changedTouches:[{identifier:9,clientX:x,clientY:y}]});
  handlers.touchstart(touch(80,200,1000));const move=touch(160,200,1100);handlers.touchmove(move);assert.equal(move.prevented,true);handlers.pointercancel({pointerType:'touch'});handlers.touchend(touch(310,202,1300,true));assert.equal(view,'records');
  view='settings';handlers.touchstart(touch(80,200,2000));handlers.touchmove(touch(82,280,2100));handlers.touchend(touch(82,330,2200,true));assert.equal(view,'settings');
  blocked=true;handlers.touchstart(touch(80,200,3000));handlers.touchmove(touch(300,200,3100));handlers.touchend(touch(300,200,3200,true));assert.equal(view,'settings');
 }finally{if(beforeWindow===undefined)delete globalThis.window;else globalThis.window=beforeWindow;if(beforeDocument===undefined)delete globalThis.document;else globalThis.document=beforeDocument;}
});
