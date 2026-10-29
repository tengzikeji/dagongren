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
 page.innerHTML="<div class=\"launch-scene\"><div class=\"launch-atmosphere\" aria-hidden=\"true\"><i></i><i></i></div><header class=\"launch-header\"><span class=\"launch-wordmark\"><svg viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\"><path d=\"m12 2 9 5v10l-9 5-9-5V7Z\"/><path d=\"M8 8h8m-4 0v8m-4 0h8\"/></svg><span>打工人<small>工资账本</small></span></span><span class=\"launch-signature\">致每一天的认真</span></header><div class=\"launch-art\" aria-hidden=\"true\"><div class=\"launch-orbit orbit-one\"><i></i></div><div class=\"launch-orbit orbit-two\"></div><div class=\"launch-guides\"><i></i><i></i></div><div class=\"launch-emblem\"><svg class=\"launch-book\" viewBox=\"0 0 240 250\" fill=\"none\"><defs><linearGradient id=\"launch-paper\" x1=\"42\" y1=\"30\" x2=\"199\" y2=\"210\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"var(--launch-paper-top)\"/><stop offset=\"1\" stop-color=\"var(--launch-paper-bottom)\"/></linearGradient></defs><path class=\"launch-folio folio-back\" d=\"m43 55 87-22 73 34v145l-75-32-85 21Z\"/><path class=\"launch-folio folio-left\" d=\"M37 45c30-12 55-8 83 8v155c-28-16-53-20-83-8Z\"/><path class=\"launch-folio folio-right\" d=\"M120 53c29-16 54-20 83-8v155c-29-12-54-8-83 8Z\"/><path class=\"launch-book-spine\" d=\"M120 54v153\"/><path class=\"launch-monogram-letter\" pathLength=\"1\" d=\"m59 83 36 6m-36 18 36 6m-36 18 24 4m60-47 37-7m-37 30 37-7m-37 30 24-5\"/><path class=\"launch-book-seal\" d=\"m149 156 11 10 22-29\"/><path class=\"launch-book-edge\" d=\"M45 211c28-6 49-2 75 10 27-12 50-16 76-10\"/></svg><span class=\"launch-loading-sheen\"></span></div><span class=\"launch-coordinate coordinate-left\">每一日</span><span class=\"launch-coordinate coordinate-right\">每一笔</span><div class=\"launch-tokens\"><span><i></i>时间</span><span><i></i>付出</span><span><i></i>积累</span></div></div><div class=\"launch-copy\"><span class=\"launch-eyebrow\"><i></i>工作有迹 · 收入有数</span><h2>每一份付出<span>都值得认真记录</span></h2><p>日积月累，成为从容生活的底气。</p></div><footer class=\"launch-status\"><div class=\"launch-status-line\"><span>正在打开你的账本</span><span class=\"launch-ready\" aria-hidden=\"true\"><i></i><i></i><i></i></span></div><div class=\"launch-progress\" aria-hidden=\"true\"><i></i></div><small>认真工作 · 从容生活</small></footer></div>";
 document.body.classList.add('intro-playing');document.body.appendChild(page);if(app)app.inert=true;try{performance.mark('dagongren.launch.created');}catch{}
 const transitions=[];let started=false,finished=false,opening=false,nativePainted=false,appReady=false,holdComplete=false,loadReleased=false,timer,fallback,loadTimer;
 const releaseApp=()=>{if(loadReleased)return;loadReleased=true;clearTimeout(loadTimer);loadResolve();};const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const done=()=>{if(finished)return;finished=true;try{performance.mark('dagongren.launch.complete');}catch{}clearTimeout(timer);clearTimeout(fallback);releaseApp();for(const transition of transitions)transition.cancel();if(app)app.classList.add('stable-query');page.remove();window.removeEventListener('resize',fit);document.body.classList.remove('intro-playing','intro-opening');document.body.style.overflow=priorOverflow;if(app)app.inert=false;bridge?.introStyle?.(false);if(globalThis.dagongrenLaunchReady===surfaceReady)delete globalThis.dagongrenLaunchReady;paintedResolve();document.removeEventListener('visibilitychange',hidden);if(started&&opening&&document.visibilityState!=='hidden')onComplete?.();};
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
  try{performance.mark('dagongren.launch.playing',{detail:{at:Date.now(),surfaces:document.querySelectorAll('.launch-page').length,oldBrand:Boolean(document.querySelector('.brand-intro')),inert:app?.inert===true,animated:getComputedStyle(page.querySelector('.launch-emblem')).animationName==='launch-emblem-in',nativeFade,firstFrame:'launch-page',liveScene:Boolean(page.querySelector('.launch-emblem')),bitmapSurface:Boolean(page.querySelector('.launch-prelude,.launch-picture,.launch-card-sheen')),animationVersion:'1.3.5-beta.5',appReadyAtStart:appReady,prelude:false,animationNames:[...new Set(page.getAnimations({subtree:true}).map(a=>a.animationName).filter(Boolean))]}});}catch{}
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
