import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture({savedMotion=true}={}){
 let time=0,nextTimer=0,removed=false,nativeTransitions=0;
 const timers=new Map(),frames=[],ready=deferred(),finished=deferred();
 const classes=()=>({add(){},remove(){},contains(){return false;}});
 const app={inert:false,classList:classes()},ledger={};
 const page={style:{setProperty(){}},dataset:{},setAttribute(){},innerHTML:'',remove(){removed=true;},querySelector:s=>s==='.launch-emblem'?ledger:null,getAnimations:()=>[],animate:()=>({ready:ready.promise,finished:finished.promise,cancel(){}})};
 const document={visibilityState:'visible',body:{style:{},classList:classes(),setAttribute(){},appendChild(){}},getElementById:()=>app,createElement:()=>page,addEventListener(){},removeEventListener(){},querySelector:s=>s==='.view-home .balance-hero'?{}:null,querySelectorAll:s=>s==='.launch-page'&&!removed?[page]:[]};
 const context=vm.createContext({document,window:{innerWidth:393,innerHeight:777,matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){}},localStorage:{getItem:k=>k==='dagongren.paybook.v1'?JSON.stringify({defaults:{motion:savedMotion}}):null},getComputedStyle:()=>({animationName:'launch-emblem-in'}),performance:{mark(){}},setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{at:time+delay,fn});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},AndroidFiles:{motionStyle(){},introStyle(){},systemDark:()=>false,shouldPlayIntro:()=>true,introReady(){context.dagongrenLaunchReady?.();},introTransition(){nativeTransitions++;}}});
 const code=fs.readFileSync(new URL('../dist/launch.js',import.meta.url),'utf8').replace(/^export /gm,'');vm.runInContext(code+'\nglobalThis.prepare=prepareBrandIntro;',context);
 function frame(){for(const fn of frames.splice(0))fn(time);}
 function advance(ms){time+=ms;for(const [id,t] of [...timers])if(t.at<=time){timers.delete(id);t.fn();}}
 return {intro:context.prepare(),page,app,ready,finished,frame,advance,removed:()=>removed,nativeTransitions:()=>nativeTransitions};
}
test('应用动效关闭仍播放完整冷启动，不显示装机测试版标记',async()=>{const f=fixture({savedMotion:false});f.frame();f.frame();assert.equal(f.page.dataset.phase,'playing');assert.doesNotMatch(f.page.innerHTML,/装机测试版|launch-edition/);f.frame();f.frame();f.advance(650);await f.intro.beforeApp;f.intro.play(false);f.frame();f.frame();f.advance(2150);assert.equal(f.page.dataset.phase,'fading');assert.equal(f.removed(),false);f.ready.resolve();await Promise.resolve();f.finished.resolve();await Promise.resolve();await Promise.resolve();assert.equal(f.removed(),true);});
test('启动转场等待动画真正就绪和完成，繁忙渲染器下不会被固定倒计时截断',async()=>{
 const f=fixture();f.frame();f.frame();f.frame();f.frame();f.advance(650);await f.intro.beforeApp;f.intro.play(true);f.frame();f.frame();f.advance(2150);
 assert.equal(f.page.dataset.phase,'fading');assert.equal(f.app.inert,true);
 f.advance(1200);assert.equal(f.removed(),false);assert.equal(f.nativeTransitions(),0);
 f.ready.resolve();await Promise.resolve();await Promise.resolve();assert.equal(f.nativeTransitions(),1);
 f.advance(500);assert.equal(f.removed(),false);
 f.finished.resolve();await Promise.resolve();await Promise.resolve();assert.equal(f.removed(),true);assert.equal(f.app.inert,false);
});
test('正常完成的启动转场立即释放首页，不等待故障兜底计时',async()=>{
 const f=fixture();f.frame();f.frame();f.frame();f.frame();f.advance(650);await f.intro.beforeApp;f.intro.play(true);f.frame();f.frame();f.advance(2150);
 f.ready.resolve();await Promise.resolve();f.finished.resolve();await Promise.resolve();await Promise.resolve();assert.equal(f.removed(),true);assert.equal(f.app.inert,false);
});
