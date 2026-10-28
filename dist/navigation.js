const mainPages=['home','calendar','records','settings'];
export function topIconVisible(scroll,viewport){return Number.isFinite(scroll)&&viewport>0&&scroll>=viewport*2;}
export function topScrollDuration(distance,viewport){return Math.min(320,180+Math.max(0,distance)/Math.max(1,viewport)*45);}
export function navIconMarkup(original){return '<span class="nav-symbol"><span class="nav-original">'+original+'</span><svg class="nav-top-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 5h12M12 19V9m-4 4 4-4 4 4"/></svg></span>';}
export function bindBottomNavigation(root,api){
 if(!root?.addEventListener||!window.addEventListener)return null;
 let scrollFrame=0,updateFrame=0,generation=0,busy=false;
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
 function cancel(){generation++;if(scrollFrame)cancelAnimationFrame(scrollFrame);scrollFrame=0;const wasBusy=busy;busy=false;root.classList.remove('nav-scrolling');if(wasBusy)api.settled?.();}
 function finish(token){if(token!==generation)return;busy=false;scrollFrame=0;root.classList.remove('nav-scrolling');update();api.settled?.();}
 function scrollTop(){
  const from=Math.max(window.scrollY||0,document.scrollingElement?.scrollTop||0);if(from<=1){update();return;}
  const duration=topScrollDuration(from,window.innerHeight),token=++generation;busy=true;root.classList.add('nav-scrolling');
  mark('dagongren.nav.top',{view:api.current(),from,duration});
  if(reduced()){window.scrollTo({top:0,behavior:'instant'});finish(token);return;}
  let start;const step=at=>{if(token!==generation)return;if(start===undefined)start=at;const progress=Math.min(1,(at-start)/duration),position=from*(1-progress)**3;window.scrollTo({top:position,behavior:'instant'});if(progress<1)scrollFrame=requestAnimationFrame(step);else finish(token);};scrollFrame=requestAnimationFrame(step);
 }
 root.addEventListener('touchstart',()=>{if(busy)cancel();},{capture:true,passive:true});
 root.addEventListener('pointerdown',()=>{if(busy)cancel();},{capture:true,passive:true});
 root.addEventListener('wheel',()=>{if(busy)cancel();},{passive:true});
 window.addEventListener('scroll',scheduleUpdate,{passive:true});window.addEventListener('resize',scheduleUpdate,{passive:true});update();
 return {update,cancel,isBusy:()=>busy,select(next){if(!mainPages.includes(next))return false;if(api.blocked?.())return true;if(next===api.current()&&Math.max(window.scrollY||0,document.scrollingElement?.scrollTop||0)<=1){update();return true;}cancel();api.before?.();if(next===api.current())scrollTop();else api.navigate(next);update();return true;}};
}
