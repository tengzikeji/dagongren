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
 page.innerHTML="<div class=\"launch-scene\"><div class=\"launch-atmosphere\" aria-hidden=\"true\"><i></i><i></i></div><header class=\"launch-header\" aria-hidden=\"true\"><span>工作有迹</span><i></i><span>收入有数</span></header><div class=\"launch-art\" aria-hidden=\"true\"><div class=\"launch-orbit orbit-one\"><i></i></div><div class=\"launch-orbit orbit-two\"></div><div class=\"launch-orbit orbit-three\"></div><div class=\"launch-points\"><i></i><i></i><i></i><i></i></div><div class=\"launch-emblem\"><svg class=\"launch-brand-logo\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\" rx=\"26\" fill=\"#3276f5\"/><g fill=\"none\" stroke=\"#fff\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"5\"><rect class=\"launch-logo-body\" pathLength=\"1\" x=\"22\" y=\"33\" width=\"56\" height=\"43\" rx=\"9\"/><path class=\"launch-logo-details\" pathLength=\"1\" d=\"M38 33v-7a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v7M22 49q28 17 56 0M50 50v11\"/></g></svg><span class=\"launch-logo-finish\"><i class=\"launch-loading-sheen\"></i></span></div><div class=\"launch-ground\"></div></div><div class=\"launch-copy\"><h1 class=\"launch-brand-name\" aria-label=\"打工人\"><span>打</span><span>工</span><span>人</span></h1><div class=\"launch-category\"><i></i><span>工资账本</span><i></i></div><p>认真付出的每一天，都有清晰的记录。</p></div><footer class=\"launch-status\"><div class=\"launch-status-line\"><span>正在打开工资账本</span><span class=\"launch-ready\" aria-hidden=\"true\"><i></i><i></i><i></i></span></div><div class=\"launch-progress\" aria-hidden=\"true\"><i></i></div><small>认真工作 · 从容生活</small></footer></div>";
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
  try{performance.mark('dagongren.launch.playing',{detail:{at:Date.now(),surfaces:document.querySelectorAll('.launch-page').length,oldBrand:Boolean(document.querySelector('.brand-intro')),inert:app?.inert===true,animated:getComputedStyle(page.querySelector('.launch-emblem')).animationName==='launch-emblem-in',nativeFade,firstFrame:'launch-page',liveScene:Boolean(page.querySelector('.launch-emblem')),bitmapSurface:Boolean(page.querySelector('.launch-prelude,.launch-picture,.launch-card-sheen')),animationVersion:'1.3.5-beta.6',appReadyAtStart:appReady,prelude:false,animationNames:[...new Set(page.getAnimations({subtree:true}).map(a=>a.animationName).filter(Boolean))]}});}catch{}
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
