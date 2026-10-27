export function prepareBrandIntro(){
 let enabled=true,onComplete=null,paintedResolve;const painted=new Promise(resolve=>paintedResolve=resolve);
 const bridge=globalThis.AndroidFiles,app=document.getElementById('app');
 const releaseNative=()=>{try{bridge?.introReady?.();}catch{}};
 if(!document.body.appendChild||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||bridge?.shouldPlayIntro?.()===false){bridge?.introStyle?.(false);return {painted:Promise.resolve(),play(){releaseNative();}};}
 try{const saved=localStorage.getItem('dagongren.theme.v1'),preference=['light','dark','system'].includes(saved)?saved:'system',dark=preference==='dark'||preference==='system'&&(bridge?.systemDark?.()??window.matchMedia?.('(prefers-color-scheme: dark)').matches);document.body.setAttribute('data-theme',dark?'dark':'light');}catch{}
 bridge?.introStyle?.(true);
 const page=document.createElement('section');page.className='launch-page';page.dataset.phase='preparing';page.setAttribute('role','status');page.setAttribute('aria-label','打工人，正在打开账本');
 page.innerHTML='<div class="launch-grid" aria-hidden="true"></div><header class="launch-header"><span class="launch-app-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="14" rx="4"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 11v5"/></svg></span><div><strong>打工人</strong><span>工作有迹 · 收入有数</span></div><span class="launch-edition">装机测试版</span></header><div class="launch-copy"><span class="launch-eyebrow"><i></i> 认真工作，从容生活</span><h2>每一份努力<br>都有清晰的记录<span>。</span></h2><p>把工作的付出，记成生活的底气。</p></div><div class="launch-art" aria-hidden="true"><div class="launch-orbit orbit-one"><i></i></div><div class="launch-orbit orbit-two"><i></i></div><div class="launch-ledger"><div class="launch-ledger-top"><span><i></i> 我的工资账本</span><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="4"/><path d="M8 8h8M8 12h8M8 16h4"/></svg></div><div class="launch-value"><span>¥</span><div class="launch-value-line"></div><span class="launch-value-dot"></span></div><div class="launch-ledger-divider"></div><div class="launch-ledger-bottom"><div><span>每一天的付出</span><b>都清清楚楚</b></div><div class="launch-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><span class="launch-card-sheen"></span></div><div class="launch-chip"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6"/></svg><span>属于你的每一笔</span></div></div><footer class="launch-status"><span class="launch-status-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="6" y="10" width="12" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span><span>本机账本已就绪<small>安心记录每一天</small></span><span class="launch-ready"><i></i><i></i><i></i></span></footer>';
 document.body.classList.add('intro-playing');document.body.appendChild(page);if(app)app.inert=true;try{performance.mark('dagongren.launch.created');}catch{}
 const transitions=[];let started=false,finished=false,opening=false,nativePainted=false,appReady=false,timer,fallback;const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const done=()=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);for(const transition of transitions)transition.cancel();if(app)app.classList.add('stable-query');page.remove();document.body.classList.remove('intro-playing','intro-opening');document.body.style.overflow=priorOverflow;if(app)app.inert=false;bridge?.introStyle?.(false);if(globalThis.dagongrenLaunchReady===surfaceReady)delete globalThis.dagongrenLaunchReady;paintedResolve();document.removeEventListener('visibilitychange',hidden);if(started&&opening&&document.visibilityState!=='hidden')onComplete?.();};
 const open=()=>{if(opening||finished)return;opening=true;
  const targets=[...document.querySelectorAll('.bottom-nav [data-view="home"],.side-nav [data-view="home"]')],home=targets.find(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0;}),bounds=home?.getBoundingClientRect(),width=window.innerWidth,height=window.innerHeight;
  const target={x:bounds?bounds.left+bounds.width/2:width/8,y:bounds?bounds.top+bounds.height/2:height-28};
  page.style.transformOrigin=target.x+'px '+target.y+'px';page.dataset.phase='absorbing';
  document.body.classList.add('intro-opening');
  const duration=760;
  try{performance.mark('dagongren.launch.absorbing',{detail:{target,button:bounds?{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}:null,origin:getComputedStyle(page).transformOrigin,duration,hold:1700,surfaces:document.querySelectorAll('.launch-page').length}});}catch{}
  const animate=(node,frames,options)=>{if(node?.animate)transitions.push(node.animate(frames,{duration,fill:'both',...options}));};
  animate(page,[
   {offset:0,transform:'translateZ(0) scale(1,1) skewX(0deg)',opacity:1},
   {offset:.36,transform:'translateZ(0) scale(.8,.86) skewX(-5deg)',opacity:1},
   {offset:.72,transform:'translateZ(0) scale(.32,.45) skewX(-12deg)',opacity:.96},
   {offset:1,transform:'translateZ(0) scale(.001,.001) skewX(-18deg)',opacity:0}
  ],{easing:'cubic-bezier(.34,.04,.7,.38)'});
  animate(app,[{offset:0,opacity:0},{offset:.15,opacity:.08},{offset:.4,opacity:.4},{offset:.7,opacity:.82},{offset:1,opacity:1}],{easing:'linear'});
  for(const [index,node] of [...document.querySelectorAll('.view-home>.balance-hero,.view-home>.settlement-chart,.view-home>.home-section-title,.view-home>.month-toolbar,.view-home>.month-account')].entries()){
   const delay=100+index*65;animate(node,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{delay,duration:duration-delay-30,easing:'cubic-bezier(.2,.7,.25,1)'});
  }
  timer=setTimeout(done,duration+40);
 };
 const start=()=>{if(started||finished||!nativePainted||!appReady)return;if(!enabled){done();return;}started=true;clearTimeout(fallback);page.dataset.phase='playing';try{performance.mark('dagongren.launch.playing',{detail:{at:Date.now(),surfaces:document.querySelectorAll('.launch-page').length,oldBrand:Boolean(document.querySelector('.brand-intro')),inert:app?.inert===true,animated:getComputedStyle(page.querySelector('.launch-ledger')).animationName==='launch-soft-in'}});}catch{}requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!finished)timer=setTimeout(open,1700);}));};
 const hidden=()=>{if(document.visibilityState==='hidden')done();};document.addEventListener('visibilitychange',hidden);
 const surfaceReady=()=>{if(nativePainted)return;nativePainted=true;clearTimeout(fallback);try{performance.mark('dagongren.launch.painted');}catch{}paintedResolve();start();};
 globalThis.dagongrenLaunchReady=surfaceReady;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{releaseNative();if(!bridge?.introReady)surfaceReady();else fallback=setTimeout(surfaceReady,2000);}));
 return {painted,play(motion=true,complete=null){enabled=motion;onComplete=complete;appReady=true;requestAnimationFrame(()=>requestAnimationFrame(start));},finish:done};
}
