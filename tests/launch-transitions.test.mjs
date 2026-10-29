import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
function fixture({savedMotion=true}={}){
 let time=0,nextTimer=0,removed=false,nativeTransitions=0;
 const timers=new Map(),frames=[],fades=[],listeners={},marks=[];
 const classes=()=>({add(){},remove(){},contains(){return false;}}),style=()=>({setProperty(key,value){this[key]=value;}});
 const app={inert:false,classList:classes()},ledger={};
 function animate(target){return (keyframes,options)=>{const ready=deferred(),finished=deferred(),fade={target,keyframes,options,ready,finished};fades.push(fade);return {ready:ready.promise,finished:finished.promise,cancel(){}};};}
 const scene={style:style(),animate:animate('content')};
 const page={style:style(),dataset:{},setAttribute(){},innerHTML:'',remove(){removed=true;},querySelector:s=>s==='.launch-emblem'?ledger:s==='.launch-scene'?scene:null,getAnimations:()=>[],animate:animate('background')};
 const document={visibilityState:'visible',body:{style:{},classList:classes(),setAttribute(){},appendChild(){}},getElementById:()=>app,createElement:()=>page,addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name],querySelector:s=>s==='.view-home .balance-hero'?{}:null,querySelectorAll:s=>s==='.launch-page'&&!removed?[page]:[]};
 const context=vm.createContext({document,window:{innerWidth:393,innerHeight:777,matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){}},localStorage:{getItem:k=>k==='dagongren.paybook.v1'?JSON.stringify({defaults:{motion:savedMotion}}):null},getComputedStyle:()=>({animationName:'launch-emblem-in'}),performance:{mark(name,options){marks.push({name,time,detail:options?.detail});}},setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{at:time+delay,fn});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},AndroidFiles:{motionStyle(){},introStyle(){},systemDark:()=>false,shouldPlayIntro:()=>true,introReady(){context.dagongrenLaunchReady?.();},introTransition(){nativeTransitions++;}}});
 const code=fs.readFileSync(new URL('../dist/launch.js',import.meta.url),'utf8').replace(/^export /gm,'');vm.runInContext(code+'\nglobalThis.prepare=prepareBrandIntro;',context);
 function frame(){for(const fn of frames.splice(0))fn(time);}
 function advance(ms){time+=ms;for(const [id,t]of [...timers])if(t.at<=time){timers.delete(id);t.fn();}}
 return {intro:context.prepare(),page,scene,app,fades,marks,frame,advance,removed:()=>removed,nativeTransitions:()=>nativeTransitions,hide(){document.visibilityState='hidden';listeners.visibilitychange?.();}};
}
async function opening(f){f.frame();f.frame();f.frame();f.frame();f.advance(2100);await f.intro.beforeApp;f.intro.play(false);f.frame();f.frame();f.advance(700);}
async function finishContent(f){f.fades[0].ready.resolve();await tick();f.fades[0].finished.resolve();await tick();}

test('应用动效关闭仍播放冷启动，内容先淡出再释放底色',async()=>{
 const f=fixture({savedMotion:false});await opening(f);
 assert.doesNotMatch(f.page.innerHTML,/装机测试版|launch-edition/);assert.equal(f.page.dataset.phase,'content-fading');assert.equal(f.fades.length,1);assert.equal(f.fades[0].target,'content');assert.equal(f.fades[0].options.duration,420);assert.equal(f.nativeTransitions(),0);assert.equal(f.removed(),false);
 await finishContent(f);assert.equal(f.page.dataset.phase,'fading');assert.equal(f.scene.style.opacity,'0');assert.equal(f.fades.length,2);assert.equal(f.fades[1].target,'background');assert.equal(f.fades[1].options.duration,650);
 f.fades[1].ready.resolve();await tick();assert.equal(f.nativeTransitions(),1);f.fades[1].finished.resolve();await tick();assert.equal(f.removed(),true);assert.equal(f.app.inert,false);
});
test('繁忙渲染器中两段退场都等待真正就绪和完成',async()=>{
 const f=fixture();await opening(f);f.advance(1200);assert.equal(f.fades.length,1);assert.equal(f.removed(),false);
 f.fades[0].ready.resolve();await tick();f.advance(500);assert.equal(f.fades.length,1);assert.equal(f.nativeTransitions(),0);assert.equal(f.removed(),false);
 f.fades[0].finished.resolve();await tick();f.advance(1200);assert.equal(f.fades.length,2);assert.equal(f.nativeTransitions(),0);assert.equal(f.removed(),false);
 f.fades[1].ready.resolve();await tick();assert.equal(f.nativeTransitions(),1);f.advance(400);assert.equal(f.removed(),false);f.fades[1].finished.resolve();await tick();assert.equal(f.removed(),true);
});
test('底色淡出正常完成后立即释放首页，不等待故障兜底',async()=>{
 const f=fixture();await opening(f);await finishContent(f);f.fades[1].ready.resolve();await tick();f.fades[1].finished.resolve();await tick();assert.equal(f.removed(),true);assert.equal(f.app.inert,false);
});
test('首页加载等到公文包和名称成形阶段之后再开始',async()=>{
 const f=fixture();f.frame();f.frame();f.frame();f.frame();let released=false;f.intro.beforeApp.then(()=>released=true);f.advance(2099);await tick();assert.equal(released,false);f.advance(1);await tick();assert.equal(released,true);f.intro.finish();
});
test('内容退场中进入后台，迟到的完成通知不再启动底色动画',async()=>{
 const f=fixture();await opening(f);f.hide();assert.equal(f.removed(),true);f.fades[0].ready.resolve();f.fades[0].finished.resolve();await tick();assert.equal(f.fades.length,1);assert.equal(f.nativeTransitions(),0);assert.equal(f.app.inert,false);
});
