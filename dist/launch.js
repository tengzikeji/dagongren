export function prepareBrandIntro(){
 let onComplete=null,paintedResolve,loadResolve;const painted=new Promise(resolve=>paintedResolve=resolve),beforeApp=new Promise(resolve=>loadResolve=resolve);
 const bridge=globalThis.AndroidFiles,app=document.getElementById('app');
 const releaseNative=()=>{try{bridge?.introReady?.();}catch{}};
 if(!document.body.appendChild||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||bridge?.shouldPlayIntro?.()===false){bridge?.introStyle?.(false);return {painted:Promise.resolve(),beforeApp:Promise.resolve(),play(){releaseNative();}};}
 try{const saved=localStorage.getItem('dagongren.theme.v1'),preference=['light','dark','system'].includes(saved)?saved:'system',dark=preference==='dark'||preference==='system'&&(bridge?.systemDark?.()??window.matchMedia?.('(prefers-color-scheme: dark)').matches);document.body.setAttribute('data-theme',dark?'dark':'light');}catch{}
 bridge?.introStyle?.(true);
 const page=document.createElement('section');page.className='launch-page';page.dataset.phase='preparing';page.setAttribute('role','status');page.setAttribute('aria-label','打工人，正在打开账本');
 // The first visible scene is live DOM in the same WebView as the ledger.
 const nativeFade=false;
 const fit=()=>page.style.setProperty('--launch-scale',Math.min(window.innerWidth/393,window.innerHeight/777));fit();window.addEventListener('resize',fit);
 page.innerHTML='<div class="launch-scene"><div class="launch-grid" aria-hidden="true"></div><header class="launch-header"><span class="launch-app-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="14" rx="4"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 11v5"/></svg></span><div><strong>打工人</strong><span>工作有迹 · 收入有数</span></div></header><div class="launch-copy"><span class="launch-eyebrow"><i></i> 认真工作，从容生活</span><h2>每一份努力<br>都有清晰的记录<span>。</span></h2><p>把工作的付出，记成生活的底气。</p></div><div class="launch-art" aria-hidden="true"><div class="launch-orbit orbit-one"><i></i></div><div class="launch-orbit orbit-two"><i></i></div><div class="launch-ledger"><div class="launch-ledger-top"><span><i></i> 我的工资账本</span><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="4"/><path d="M8 8h8M8 12h8M8 16h4"/></svg></div><div class="launch-value"><span>¥</span><div class="launch-value-line"></div><span class="launch-value-dot"></span></div><div class="launch-ledger-divider"></div><div class="launch-ledger-bottom"><div><span>每一天的付出</span><b>都清清楚楚</b></div><div class="launch-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><span class="launch-loading-sheen" aria-hidden="true"></span></div><div class="launch-chip"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6"/></svg><span>属于你的每一笔</span></div></div><footer class="launch-status"><span class="launch-status-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="6" y="10" width="12" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span><span>本机账本已就绪<small>安心记录每一天</small></span><span class="launch-ready"><i></i><i></i><i></i></span></footer></div>';
 document.body.classList.add('intro-playing');document.body.appendChild(page);if(app)app.inert=true;try{performance.mark('dagongren.launch.created');}catch{}
 const transitions=[];let started=false,finished=false,opening=false,nativePainted=false,appReady=false,holdComplete=false,loadReleased=false,timer,fallback,loadTimer;
 const releaseApp=()=>{if(loadReleased)return;loadReleased=true;clearTimeout(loadTimer);loadResolve();};const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const done=()=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);releaseApp();for(const transition of transitions)transition.cancel();if(app)app.classList.add('stable-query');page.remove();window.removeEventListener('resize',fit);document.body.classList.remove('intro-playing','intro-opening');document.body.style.overflow=priorOverflow;if(app)app.inert=false;bridge?.introStyle?.(false);if(globalThis.dagongrenLaunchReady===surfaceReady)delete globalThis.dagongrenLaunchReady;paintedResolve();document.removeEventListener('visibilitychange',hidden);if(started&&opening&&document.visibilityState!=='hidden')onComplete?.();};
 const open=()=>{if(opening||finished)return;opening=true;
  // Paint the completed home at full opacity behind the opaque launch surface.
  // Fading only the top surface keeps every pixel covered throughout the handoff.
  page.dataset.phase='fading';document.body.classList.add('intro-opening');
  const duration=640;
  try{performance.mark('dagongren.launch.fading',{detail:{duration,hold:1700,surfaces:document.querySelectorAll('.launch-page').length,fullScreen:true,homeReady:Boolean(document.querySelector('.view-home .balance-hero')),animated:true}});}catch{}
  if(page.animate){
   const fade=page.animate([{opacity:1},{opacity:0}],{duration,easing:'ease-in-out',fill:'both'});transitions.push(fade);
   // A busy renderer may not start this animation immediately. A wall-clock
   // duration+100 timeout can remove the surface while it is still opaque.
   timer=setTimeout(done,10000);
   const ready=()=>{if(finished)return;clearTimeout(timer);try{bridge?.introTransition?.(duration);}catch{}try{performance.mark('dagongren.launch.fade.ready');}catch{}timer=setTimeout(done,Math.max(2500,duration*4));};
   if(fade.ready)fade.ready.then(ready,done);else ready();
   fade.finished.then(done,done);
  }else{try{bridge?.introTransition?.(0);}catch{}page.style.opacity='0';requestAnimationFrame(done);}
 };
 const start=()=>{
  if(started||finished||!nativePainted)return;
  started=true;clearTimeout(fallback);page.dataset.phase='playing';
  try{performance.mark('dagongren.launch.playing',{detail:{at:Date.now(),surfaces:document.querySelectorAll('.launch-page').length,oldBrand:Boolean(document.querySelector('.brand-intro')),inert:app?.inert===true,animated:getComputedStyle(page.querySelector('.launch-ledger')).animationName==='launch-soft-in',nativeFade,firstFrame:'launch-page',liveScene:Boolean(page.querySelector('.launch-ledger')),bitmapSurface:Boolean(page.querySelector('.launch-prelude,.launch-picture,.launch-card-sheen')),animationVersion:'1.3.5-beta.2',appReadyAtStart:appReady,prelude:false,animationNames:[...new Set(page.getAnimations({subtree:true}).map(a=>a.animationName).filter(Boolean))]}});}catch{}
  // Begin the visual movement before loading and calculating the ledger.
  loadTimer=setTimeout(releaseApp,650);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!finished)timer=setTimeout(()=>{holdComplete=true;if(appReady)open();},1700);}));
 };
 const hidden=()=>{if(document.visibilityState==='hidden')done();};document.addEventListener('visibilitychange',hidden);
 const surfaceReady=()=>{if(nativePainted)return;nativePainted=true;clearTimeout(fallback);try{performance.mark('dagongren.launch.painted');}catch{}start();paintedResolve();};
 globalThis.dagongrenLaunchReady=surfaceReady;
 // Submit live markup to the compositor before asking Android to remove its splash.
 requestAnimationFrame(()=>requestAnimationFrame(()=>{releaseNative();if(!bridge?.introReady)surfaceReady();else fallback=setTimeout(surfaceReady,2000);}));
 return {painted,beforeApp,play(_motion=true,complete=null){onComplete=complete;appReady=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{start();if(holdComplete)open();}));},finish:done};
}
