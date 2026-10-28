import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {topIconVisible,topScrollDuration} from '../dist/navigation.js';
test('置顶图标以两屏滚动距离为边界，包含临界点',()=>{for(const h of [480,660,900]){assert.equal(topIconVisible(h*2-1,h),false);assert.equal(topIconVisible(h*2,h),true);assert.equal(topIconVisible(h*2+1,h),true);}assert.equal(topIconVisible(100,0),false);assert.ok(topScrollDuration(20000,600)<=320);});
function fixture(reduced=false){
 const frames=new Map(),positions=[],events={},classes=new Set(),animations=[],marks=[],navigations=[];let id=0,current='home';
 const buttons=['home','calendar','records','settings'].map(view=>({dataset:{view},querySelector:()=>({textContent:view}),setAttribute(){}}));
 const content={animate(keyframes,options){let resolve;const a={keyframes,options,finished:new Promise(r=>resolve=r),cancel(){},resolve:()=>resolve()};animations.push(a);return a;}};
 const root={addEventListener:(n,f)=>events[n]=f,classList:{add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x))},querySelector:()=>content,querySelectorAll:()=>buttons};
 const document={scrollingElement:{scrollTop:0}},window={innerHeight:600,scrollY:0,addEventListener(){},matchMedia:()=>({matches:reduced}),scrollTo({top}){positions.push(top);window.scrollY=top;document.scrollingElement.scrollTop=top;}};
 const context=vm.createContext({window,document,performance:{mark:(name,data)=>marks.push({name,...data.detail})},requestAnimationFrame:f=>{frames.set(++id,f);return id;},cancelAnimationFrame:id=>frames.delete(id)});
 vm.runInContext(fs.readFileSync(new URL('../dist/navigation.js',import.meta.url),'utf8').replace(/^export /gm,'')+'\nglobalThis.bind=bindBottomNavigation;',context);
 const nav=context.bind(root,{current:()=>current,navigate:view=>{navigations.push(view);current=view;}});
 return {nav,window,document,positions,events,buttons,animations,marks,navigations,frame(at){for(const [id,f] of [...frames]){frames.delete(id);f(at);}}};
}
test('当前页面一键快速置顶且滚动单调向上，不切换账本页面',()=>{const f=fixture();f.window.scrollY=2400;f.document.scrollingElement.scrollTop=2400;f.nav.update();assert.equal(f.buttons[0].dataset.top,'true');assert.equal(f.buttons[1].dataset.top,'false');f.nav.select('home');for(const at of [0,80,160,240,320])f.frame(at);assert.equal(f.window.scrollY,0);assert.equal(f.nav.isBusy(),false);assert.ok(f.positions.every((p,i)=>!i||p<=f.positions[i-1]));assert.equal(f.buttons[0].dataset.top,'false');});
test('点击其它主页面交给完整页面推进，导航自身不再下拉内容',()=>{const f=fixture();f.nav.select('calendar');assert.deepEqual(f.navigations,['calendar']);assert.equal(f.animations.length,0);assert.equal(f.marks.length,0);assert.equal(f.nav.isBusy(),false);});
test('已经在顶部时重复点击当前导航不移动、不重绘、不触发内容动画',()=>{const f=fixture();for(let i=0;i<3;i++)f.nav.select('home');assert.deepEqual(f.positions,[]);assert.deepEqual(f.navigations,[]);assert.equal(f.animations.length,0);assert.equal(f.marks.length,0);});
test('新的手动触摸可中断置顶，系统减少动态效果时立即回顶',()=>{const f=fixture();f.window.scrollY=2400;f.nav.select('home');f.frame(0);f.frame(80);f.events.touchstart();const at=f.window.scrollY;f.frame(320);assert.equal(f.window.scrollY,at);assert.equal(f.nav.isBusy(),false);const reduced=fixture(true);reduced.window.scrollY=2400;reduced.nav.select('home');assert.equal(reduced.window.scrollY,0);assert.equal(reduced.nav.isBusy(),false);});
