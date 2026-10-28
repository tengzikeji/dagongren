const mainPages=['home','calendar','records','settings'];
export function topIconVisible(scroll,viewport){return Number.isFinite(scroll)&&viewport>0&&scroll>=viewport*3;}
export function topScrollDuration(distance,viewport){return Math.min(320,180+Math.max(0,distance)/Math.max(1,viewport)*45);}
export function navIconMarkup(original){return '<span class="nav-symbol"><span class="nav-original">'+original+'</span><svg class="nav-top-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 5h12M12 19V9m-4 4 4-4 4 4"/></svg></span>';}
export function bindBottomNavigation(root,api){
 if(!root?.addEventListener||!window.addEventListener)return null;
 let animation=null,scrollFrame=0,updateFrame=0,generation=0,busy=false;
 const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const mark=(name,detail)=>{try{performance.mark(name,{detail});}catch{}};
 function update(){
  const height=window.visualViewport?.height||window.innerHeight,top=Math.max(window.scrollY||0,document.scrollingElement?.scrollTop||0);
  for(const button of root.querySelectorAll('.bottom-nav [data-view]')){
   const show=button.dataset.view===api.current()&&topIconVisible(top,height);if(button.dataset.top!==String(show))button.dataset.top=String(show);
   const label=button.querySelector('span:not(.nav-symbol):not(.nav-original)')?.textContent||button.dataset.view;
   button.setAttribute('aria-label',show?label+'，回到顶部':label);button.setAttribute('title',show?'回到顶部':label);
  }
 }
 function scheduleUpdate(){if(!updateFrame)updateFrame=requestAnimationFrame(()=>{updateFrame=0;update();});}
 function cancel(){generation++;if(scrollFrame)cancelAnimationFrame(scrollFrame);scrollFrame=0;animation?.cancel();animation=null;const wasBusy=busy;busy=false;root.classList.remove('nav-lifting','nav-scrolling');if(wasBusy)api.settled?.();}
 function finish(token){if(token!==generation)return;busy=false;animation=null;scrollFrame=0;root.classList.remove('nav-lifting','nav-scrolling');update();api.settled?.();}
 function lift(){
  const token=++generation,node=root.querySelector('.workspace .content');busy=true;root.classList.add('nav-lifting');
  mark('dagongren.nav.lift',{view:api.current(),direction:'up',duration:220});
  if(reduced()||!node?.animate){finish(token);return;}
  animation=node.animate([{transform:'translate3d(0,18px,0)',opacity:.88},{transform:'translate3d(0,0,0)',opacity:1}],{duration:220,easing:'cubic-bezier(.16,.7,.25,1)'});
  animation.finished.then(()=>finish(token),()=>finish(token));
 }
 function scrollTop(){
  const from=Math.max(window.scrollY||0,document.scrollingElement?.scrollTop||0);if(from<=1){lift();return;}
  const duration=topScrollDuration(from,window.innerHeight),token=++generation;busy=true;root.classList.add('nav-scrolling');
  mark('dagongren.nav.top',{view:api.current(),from,duration});
  if(reduced()){window.scrollTo({top:0,behavior:'instant'});finish(token);return;}
  let start;const step=at=>{if(token!==generation)return;if(start===undefined)start=at;const progress=Math.min(1,(at-start)/duration),position=from*(1-progress)**3;window.scrollTo({top:position,behavior:'instant'});if(progress<1)scrollFrame=requestAnimationFrame(step);else finish(token);};scrollFrame=requestAnimationFrame(step);
 }
 root.addEventListener('touchstart',()=>{if(busy)cancel();},{capture:true,passive:true});
 root.addEventListener('pointerdown',()=>{if(busy)cancel();},{capture:true,passive:true});
 root.addEventListener('wheel',()=>{if(busy)cancel();},{passive:true});
 window.addEventListener('scroll',scheduleUpdate,{passive:true});window.addEventListener('resize',scheduleUpdate,{passive:true});update();
 return {update,cancel,isBusy:()=>busy,select(next){if(!mainPages.includes(next))return false;if(api.blocked?.())return true;cancel();api.before?.();if(next===api.current())scrollTop();else{api.navigate(next);lift();}return true;}};
}
