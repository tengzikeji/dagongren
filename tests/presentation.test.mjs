import test from 'node:test';
import assert from 'node:assert/strict';
import {numberRollPlan} from '../dist/interaction.js';
test('数码轮从最高位依次启动，每位至少滚动三圈并精确落位',()=>{
 const plan=numberRollPlan('1,234.56','9,876.54');
 assert.equal(plan.length,6);
 plan.forEach((wheel,i)=>{assert.equal(wheel.delay,i*60);assert.ok(wheel.steps>=30);assert.equal(wheel.digits[0],wheel.from);assert.equal(wheel.digits.at(-1),Number('987654'[i]));assert.equal(wheel.digits.length,wheel.steps+1);assert.ok(wheel.digits.every(x=>Number.isInteger(x)&&x>=0&&x<=9));});
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
 for(const args of [[10,1,100],[47,0,100],[50,100,200],[-80,70,200],[100,0,2600],[NaN,0,100],[100,Infinity,100]])assert.equal(calendarSwipeDelta(...args),0);
 assert.equal(calendarSwipeDelta(-300,0,1500),1);
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
