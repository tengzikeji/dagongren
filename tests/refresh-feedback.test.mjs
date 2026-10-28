import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../dist/refresh.js',import.meta.url),'utf8').replace(/^export /gm,'');
function fixture({motion=false,reduced=false}={}){
 const frames=[],timers=new Map(),listeners={},classes=new Set(motion?[]:['motion-off']);let id=0,refreshes=0,ends=0,resolveBounce;
 const style=()=>({transform:'',willChange:'',setProperty(k,v){this[k]=v;}}),symbol={style:style(),innerHTML:''},label={textContent:''};
 const indicator={style:style(),dataset:{},setAttribute(){},querySelector:s=>s.includes('symbol')?symbol:label};
 const content={style:style(),animate(){return {finished:new Promise(resolve=>resolveBounce=resolve),cancel(){}};}};
 const root={inert:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},addEventListener:(n,f)=>listeners[n]=f,querySelector:()=>content};
 const document={body:{classList:{contains:x=>classes.has(x)},appendChild(){}},createElement:()=>indicator,scrollingElement:{scrollTop:0},addEventListener(){}};
 const context=vm.createContext({document,window:{scrollY:0,matchMedia:()=>({matches:reduced})},setTimeout:(f,d)=>{timers.set(++id,{f,d});return id;},clearTimeout:i=>timers.delete(i),requestAnimationFrame:f=>{frames.push(f);return frames.length;},cancelAnimationFrame(){},Date});
 vm.runInContext(code+'\nglobalThis.bind=bindPullRefresh;globalThis.update=updateCloudFeedback;',context);
 const control=context.bind(root,{enabled:()=>true,blocked:()=>false,onEnd(){ends++;},async refresh(){refreshes++;return {state:'success',message:'同步成功'};}});
 function event(name,y,x=100){const p={identifier:1,clientX:x,clientY:y};listeners[name]({touches:name==='touchend'?[]:[p],changedTouches:[p],target:{closest:()=>false},cancelable:true,preventDefault(){}});}
 return {root,content,indicator,context,control,event,frames,document,get refreshes(){return refreshes;},get ends(){return ends;},frame(){for(const f of frames.splice(0))f();},async bounce(){resolveBounce?.();await Promise.resolve();await Promise.resolve();},async flush(){for(let i=0;i<8;i++){this.frame();await Promise.resolve();}}};
}
test('下拉先移动页面，越过展示距离后出现提示，松手完成回弹才开始同步',async()=>{
 const f=fixture();f.event('touchstart',100);f.event('touchmove',120);f.frame();assert.ok(f.content.style.transform.startsWith('translate3d(0,5.6'));assert.equal(f.indicator.hidden,true);
 f.event('touchmove',260);f.frame();assert.ok(f.content.style.transform.startsWith('translate3d(0,84'));assert.equal(f.indicator.dataset.state,'armed');
 f.event('touchend',260);assert.equal(f.control.isDragging(),true);assert.equal(f.refreshes,0);await f.bounce();assert.equal(f.content.style.transform,'');assert.equal(f.ends,1);await f.flush();assert.equal(f.refreshes,1);assert.equal(f.indicator.dataset.state,'success');
});
test('短拉和取消手势回弹但不触发同步',async()=>{
 for(const cancel of [false,true]){const f=fixture();f.event('touchstart',100);f.event('touchmove',cancel?220:140);f.frame();f.event(cancel?'touchcancel':'touchend',cancel?220:140);await f.bounce();await f.flush();assert.equal(f.refreshes,0);assert.equal(f.content.style.transform,'');assert.equal(f.control.isDragging(),false);}
});
test('横向滑动及未到页面顶部时不移动页面和触发下拉',async()=>{
 const f=fixture();f.event('touchstart',100);f.event('touchmove',102,200);f.frame();assert.equal(f.content.style.transform,'');f.event('touchend',102,200);f.document.scrollingElement.scrollTop=10;f.event('touchstart',100);f.event('touchmove',270);f.frame();assert.equal(f.content.style.transform,'');assert.equal(f.refreshes,0);
});
test('系统减少动态效果仍可下拉刷新并立即复位',async()=>{const f=fixture({reduced:true});f.event('touchstart',100);f.event('touchmove',270);f.frame();f.event('touchend',270);await f.flush();assert.equal(f.content.style.transform,'');assert.equal(f.refreshes,1);});
test('页面顶部预先声明下拉归属，离开顶部后恢复正常滚动',()=>{const f=fixture();assert.equal(f.root.classList.contains('pull-refresh-ready'),true);f.document.scrollingElement.scrollTop=40;f.control.updateReady();assert.equal(f.root.classList.contains('pull-refresh-ready'),false);f.document.scrollingElement.scrollTop=0;f.control.updateReady();assert.equal(f.root.classList.contains('pull-refresh-ready'),true);});
test('旧版触发距离不再刷新，拖动提示延后出现',async()=>{const f=fixture();f.event('touchstart',100);f.event('touchmove',180);f.frame();assert.equal(f.indicator.hidden,true);f.event('touchmove',200);f.frame();assert.equal(f.indicator.dataset.state,'pulling');f.event('touchend',200);await f.bounce();await f.flush();assert.equal(f.refreshes,0);});
function badgeFixture(options){const f=fixture(options);let calls=0;const target={animate(){calls++;}},badge={dataset:{state:'success',revision:'7'},querySelector:()=>target};const button={dataset:{},closest:()=>false,setAttribute(){},querySelector:()=>badge},root={querySelectorAll:()=>[button]};return {...f,badge,root,update:feedback=>f.context.update(root,feedback),calls:()=>calls};}
test('云同步结果只响应一次同步事件，重复绘制、导航及修改不重播',()=>{const f=badgeFixture({motion:true}),state={state:'success',source:'auto',revision:7};f.update(state);assert.equal(f.calls(),2);f.update(state);f.update(state);assert.equal(f.calls(),2);f.update({...state,state:'idle'});assert.equal(f.calls(),2);f.update({...state,state:'error',revision:8});assert.equal(f.calls(),4);});
test('自动与手动同步反馈均独立于应用动效开关，并尊重系统减少动态效果',()=>{for(const [options,source,count] of [[{motion:false},'auto',2],[{motion:false},'pull',2],[{motion:true,reduced:true},'pull',0]]){const f=badgeFixture(options);f.update({state:'success',source,revision:7});assert.equal(f.calls(),count);}});
