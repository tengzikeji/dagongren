import test from 'node:test';
import assert from 'node:assert/strict';
import {numberRollPlan} from '../dist/interaction.js';
test('数码轮从高位依次启动，短路径滚动并精确落位',()=>{
 const plan=numberRollPlan('1,234.56','9,876.54');
 assert.equal(plan.length,6);
 plan.forEach((wheel,i)=>{assert.equal(wheel.delay,i*16);assert.ok(wheel.steps>=0&&wheel.steps<=19);assert.equal(wheel.digits[0],wheel.from);assert.equal(wheel.digits.at(-1),Number('987654'[i]));assert.equal(wheel.digits.length,wheel.steps+1);assert.ok(wheel.digits.every(x=>Number.isInteger(x)&&x>=0&&x<=9));});
 assert.ok(plan.every((x,i)=>i===0||x.delay>plan[i-1].delay));
});
test('金额跨位、负数及零保留小数的目标数字',()=>{
 for(const [old,next] of [['999.99','1,000.00'],['-120.50','13.09'],['1,000.00','0.00'],['0.00','123,456.78']]){
  const plan=numberRollPlan(old,next);
  assert.equal(plan.map(x=>x.digits.at(-1)).join(''),next.replace(/\D/g,''));
  assert.ok(plan.every(x=>x.delay+x.duration<=600));
 }
 assert.deepEqual(numberRollPlan('1,234.00','1234.00'),[]);
 assert.deepEqual(numberRollPlan('0.00','—'),[]);
});
test('大量金额连续切换时，每次落点只对应当次目标',()=>{
 let old='0.00';
 for(let i=1;i<=200;i++){const next=((i*7919)%1000000/100).toFixed(2),plan=numberRollPlan(old,next);assert.equal(plan.map(w=>w.digits.at(-1)).join(''),next.replace(/\D/g,''));old=next;}
});

import {swipeAxis,swipeDecision,swipeOffset,swipeVelocity,pageSwipeTarget,calendarSwipeDelta} from '../dist/interaction.js';
test('横纵方向只初判一次，锁定后忽略另一轴的位移',()=>{
 assert.equal(swipeAxis(3,4),'pending');assert.equal(swipeAxis(20,2),'x');assert.equal(swipeAxis(2,20),'y');
 assert.equal(swipeAxis(20,400,'x'),'x');assert.equal(swipeAxis(400,20,'y'),'y');
 assert.equal(swipeAxis(11,11),'pending');assert.equal(swipeAxis(25,24),'x');
});
test('屏宽三分之一是慢拖切换边界，与绝对48像素无关',()=>{
 for(const width of [320,360,393,400,768,1080]){assert.equal(swipeDecision(-width/3,width,0).complete,true);assert.equal(swipeDecision(width/3-.01,width,0).complete,false);assert.equal(swipeDecision(width/3,width,0).delta,-1);}
 assert.equal(swipeDecision(-100,400,0).complete,false);
});
test('快速轻扫速度阈值为800像素每秒，反向松手不能借速度切页',()=>{
 assert.equal(swipeDecision(-40,400,-800).complete,true);assert.equal(swipeDecision(40,400,800).complete,true);
 assert.equal(swipeDecision(-40,400,-799.9).complete,false);assert.equal(swipeDecision(-40,400,1000).complete,false);
 assert.equal(swipeDecision(-150,400,1000).complete,true);
});
test('纵向手势和无效输入始终不翻页',()=>{
 for(const input of [[-300,400,1000,'y'],[0,400,800,'x'],[NaN,400,0,'x'],[-150,0,800,'x'],[-20,400,Infinity,'x']])assert.equal(swipeDecision(...input).complete,false);
});
test('释放速度取最后80毫秒，停住后释放不沿用先前的轻扫速度',()=>{
 assert.equal(swipeVelocity([{x:300,t:0},{x:260,t:40}],40),-1000);
 assert.equal(swipeVelocity([{x:300,t:0},{x:260,t:40},{x:260,t:200}],200),0);
 assert.equal(swipeVelocity([{x:300,t:0},{x:100,t:60},{x:120,t:100},{x:150,t:140}],140),625);
 assert.equal(swipeVelocity([],0),0);
});
test('中间页面与月份1:1跟手，单次只允许一页；边界阻尼0.4倍',()=>{
 for(const dx of [-250,-100,-13,13,100,250])assert.equal(swipeOffset(dx,393),dx);
 assert.equal(swipeOffset(-900,393),-393);assert.equal(swipeOffset(900,393),393);
 assert.equal(swipeOffset(100,393,true),40);assert.equal(swipeOffset(-100,393,true),-40);
});
test('主页面严格相邻且首末边界不循环',()=>{
 assert.equal(pageSwipeTarget('home',1),'calendar');assert.equal(pageSwipeTarget('calendar',1),'records');assert.equal(pageSwipeTarget('records',1),'settings');
 assert.equal(pageSwipeTarget('settings',-1),'records');assert.equal(pageSwipeTarget('records',-1),'calendar');assert.equal(pageSwipeTarget('calendar',-1),'home');
 for(const [v,d] of [['home',-1],['settings',1],['calendar',2],['sync',1],['cleanup',-1]])assert.equal(pageSwipeTarget(v,d),null);
});
test('合并移动事件仍按按下与松开距离判断，慢短滑与纵滑回到原月',()=>{
 assert.equal(calendarSwipeDelta(-150,2,2000,400),1);assert.equal(calendarSwipeDelta(150,2,2000,400),-1);
 assert.equal(calendarSwipeDelta(-40,2,40,400),1);assert.equal(calendarSwipeDelta(-100,2,2000,400),0);
 assert.equal(calendarSwipeDelta(-200,300,200,400),0);assert.equal(calendarSwipeDelta(100,0,31000,400),0);
});
