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
 page.innerHTML="<div class=\"launch-scene\"><div class=\"launch-atmosphere\" aria-hidden=\"true\"><i></i><i></i></div><header class=\"launch-header\"><span class=\"launch-wordmark\">打工人<span>工资账本</span></span><span class=\"launch-signature\" aria-hidden=\"true\"><i></i>认真生活的记录者</span></header><div class=\"launch-art\" aria-hidden=\"true\"><div class=\"launch-orbit orbit-one\"><i></i></div><div class=\"launch-orbit orbit-two\"></div><div class=\"launch-ticks\"><i style=\"--tick:0\"></i><i style=\"--tick:1\"></i><i style=\"--tick:2\"></i><i style=\"--tick:3\"></i><i style=\"--tick:4\"></i><i style=\"--tick:5\"></i><i style=\"--tick:6\"></i><i style=\"--tick:7\"></i><i style=\"--tick:8\"></i><i style=\"--tick:9\"></i><i style=\"--tick:10\"></i><i style=\"--tick:11\"></i><i style=\"--tick:12\"></i><i style=\"--tick:13\"></i><i style=\"--tick:14\"></i><i style=\"--tick:15\"></i><i style=\"--tick:16\"></i><i style=\"--tick:17\"></i><i style=\"--tick:18\"></i><i style=\"--tick:19\"></i><i style=\"--tick:20\"></i><i style=\"--tick:21\"></i><i style=\"--tick:22\"></i><i style=\"--tick:23\"></i><i style=\"--tick:24\"></i><i style=\"--tick:25\"></i><i style=\"--tick:26\"></i><i style=\"--tick:27\"></i><i style=\"--tick:28\"></i><i style=\"--tick:29\"></i><i style=\"--tick:30\"></i><i style=\"--tick:31\"></i><i style=\"--tick:32\"></i><i style=\"--tick:33\"></i><i style=\"--tick:34\"></i><i style=\"--tick:35\"></i><i style=\"--tick:36\"></i><i style=\"--tick:37\"></i><i style=\"--tick:38\"></i><i style=\"--tick:39\"></i><i style=\"--tick:40\"></i><i style=\"--tick:41\"></i><i style=\"--tick:42\"></i><i style=\"--tick:43\"></i><i style=\"--tick:44\"></i><i style=\"--tick:45\"></i><i style=\"--tick:46\"></i><i style=\"--tick:47\"></i></div><div class=\"launch-emblem\"><svg class=\"launch-monogram\" viewBox=\"0 0 120 120\" fill=\"none\"><path class=\"launch-monogram-frame\" d=\"M60 12 99 34v45L60 102 21 79V34Z\"/><path class=\"launch-monogram-letter\" d=\"M39 42h42M60 42v37M38 79h44\"/><path class=\"launch-monogram-detail\" d=\"m43 89 17 10 17-10\"/></svg><span class=\"launch-loading-sheen\"></span></div><span class=\"launch-axis axis-left\">付出</span><span class=\"launch-axis axis-right\">积累</span><span class=\"launch-art-caption\">让时间，见证每一份努力</span></div><div class=\"launch-copy\"><span class=\"launch-eyebrow\"><i></i>工作有迹 · 收入有数<i></i></span><h2>认真付出<span>从容有数</span></h2><p>把每一天，记成生活的底气。</p></div><footer class=\"launch-status\"><div class=\"launch-status-line\"><span>正在打开你的账本</span><span class=\"launch-ready\" aria-hidden=\"true\"><i></i><i></i><i></i></span></div><div class=\"launch-progress\" aria-hidden=\"true\"><i></i></div><small>日积月累，皆有回响</small></footer></div>";
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
   const ready=()=>{if(finished)return;clearTimeout(timer);try{bridge?.introTransition?.(duration);}catch{}try{performance.mark('dagongren.launch.fade.ready');}catch{}timer=setTimeout(done,Math.max(2500,duration*4));const syncBars=()=>{if(finished)return;const progress=fade.effect?.getComputedTiming?.().progress;if(Number.isFinite(progress))try{bridge?.introTransitionAt?.(duration,Math.round(progress*duration));}catch{}requestAnimationFrame(syncBars);};if(document.body.getAttribute?.('data-theme')==='dark'&&bridge?.introTransitionAt)requestAnimationFrame(syncBars);};
   if(fade.ready)fade.ready.then(ready,done);else ready();
   fade.finished.then(done,done);
  }else{try{bridge?.introTransition?.(0);}catch{}page.style.opacity='0';requestAnimationFrame(done);}
 };
 const start=()=>{
  if(started||finished||!nativePainted)return;
  started=true;clearTimeout(fallback);page.dataset.phase='playing';
  try{performance.mark('dagongren.launch.playing',{detail:{at:Date.now(),surfaces:document.querySelectorAll('.launch-page').length,oldBrand:Boolean(document.querySelector('.brand-intro')),inert:app?.inert===true,animated:getComputedStyle(page.querySelector('.launch-emblem')).animationName==='launch-emblem-in',nativeFade,firstFrame:'launch-page',liveScene:Boolean(page.querySelector('.launch-emblem')),bitmapSurface:Boolean(page.querySelector('.launch-prelude,.launch-picture,.launch-card-sheen')),animationVersion:'1.3.5-beta.4',appReadyAtStart:appReady,prelude:false,animationNames:[...new Set(page.getAnimations({subtree:true}).map(a=>a.animationName).filter(Boolean))]}});}catch{}
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
