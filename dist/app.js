import {themeCatalog,resolveTheme,effectiveTheme,themePicker} from './themes.js';
import {settlementChart,dailyWageChart,annualWageChart,profileChart} from './charts.js';
import {createCalendarUpdater} from './holiday-updates.js';
import {renderStable,chartNumberMarkup,enhanceModalChoices,closeChoicePicker,playBrandIntro,installCalendarSwipe,installPageSwipe} from './interaction.js';
import {calendarRights} from './calendar-rights.js';
import {calendarDay,calendarCoverage} from './calendar.js';
import { daysInMonth, validMonth, validDate, holiday, makeupWorkday, datesBetween, calculate, formatMoney, statutoryDates, isStatutory, isAdjustedDay, overtimeAmount, wagePayments, chinaDate, shiftDay, leaveDeducts, calculateBook, migrateBook, ensureAccrualMonths, payPeriodForDate, rebuildAccrualFromJoin, salaryRateForDate } from './payroll.js';
import { copyRecords, canonicalJSON, makeCleanupPlan, applyCleanupPlan, mergeDemoRecords } from './data-tools.js';

import {snapshotBook} from './sync-tools.js';
import {rememberDeletions} from './sync-merge.js';
import { installNativeSync } from './native-sync.js';
import {cloudButtonMarkup,updateCloudFeedback,bindPullRefresh} from './refresh.js';
const isAndroid=typeof globalThis.AndroidFiles?.request==='function';
let nativeSync=null;
let pullRefresh=null,demoSyncTask=null,demoFeedback={state:'idle',source:'auto',message:'',revision:0};
function syncFeedback(){return nativeSync?.feedback?.()||demoFeedback;}
function syncFeedbackChanged(feedback){updateCloudFeedback(document,feedback,nativeSync?.status?.()||feedback.message);const button=document.querySelector?.('.sync-actions [data-action="sync-now"]');if(button){button.disabled=feedback.state==='syncing';button.textContent=feedback.state==='syncing'?'正在同步…':'立即同步';}}
function demoReport(state,message,source='manual'){demoFeedback={state,message,source,revision:demoFeedback.revision+1};syncFeedbackChanged(demoFeedback);return {...demoFeedback};}
let calendarUpdater=null;

const paths = {
  minus: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8 12h8"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h1M15 7h1M8 11h1M15 11h1"/>',
  bag: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 11v5"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z"/>',
  history: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h3M2 7h3M2 12h3M2 17h3"/>',
  cloud: '<path d="M6 18a4 4 0 0 1-1-7.9A7 7 0 0 1 18.7 9a4.5 4.5 0 0 1-.2 9H6Z"/><path d="m9 12 3-3 3 3M12 9v7"/>',
  settings: '<path d="m9 3-.6 2.2-2 .9-2-.6-2 3.5 1.5 1.6v2.5L2.4 15l2 3.5 2-.6 2 1L9 21h4l.6-2.2 2-.9 2 .6 2-3.5-1.5-1.6v-2.5L19.6 9l-2-3.5-2 .6-2-1L13 3Z"/><circle cx="11" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  shield: '<path d="m12 3 8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M7 17h3M14 14h3"/>',
  leave: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M8 13h5M8 17h8"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="m8 7 4 5 4-5M8 12h8M8 16h8M12 12v7"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M21 12h-5a2 2 0 0 0 0 5h5M17 14.5h.01M6 5V3h12"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4M12 17h.01"/>',
  leaf: '<path d="M20 4C6 2 1 12 8 17c5 4 12-1 12-13ZM5 21 16 9"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 18h2"/>',
  refresh: '<path d="M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5M4 14a8 8 0 0 0 14 5l3-3m0 5v-5h-5"/>',
  wifi: '<path d="M2 8a17 17 0 0 1 20 0M5 12a12 12 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M8 14h8M8 17h5"/>'
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => formatMoney(cents);
const shortDate = date => `${+date.slice(5, 7)}月${+date.slice(8)}日`;
const fullMonth = month => `${month.slice(0, 4)}年${+month.slice(5)}月`;
const monthNum = month => +month.slice(5);
const pad = n => String(n).padStart(2, '0');
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let today = chinaDate();
let entryDate='';
let lastRenderedPending=null;
const STORAGE = 'dagongren.paybook.v1';
const defaultSettings = {salaryCents:600000,basis:'calendar',customDays:26,payday:15,company:'',joinDate:'',periodMode:'calendar',periodStartDay:1,holidayLeaveDeduct:false,adjustedLeaveDeduct:false,motion:true};
function sampleRecord(salaryCents, leaves = [], payment = null) { return {salaryCents,basis:'calendar',customDays:26,leaves,payment}; }
function seed() {
  if(isAndroid)return {version:2,defaults:{...defaultSettings,salaryCents:0,joinDate:today},months:{},excludedMonths:[],sync:{demo:false,auto:false,offline:false,last:null,pending:0,logs:[],cloudMonths:null}};
  return {version:1,defaults:{...defaultSettings,joinDate:'2026-07-01'},months:{
    '2026-10':sampleRecord(600000,[{id:'example-1',date:'2026-10-16',days:1,note:'家中有事'},{id:'example-2',date:'2026-10-21',days:0.5,note:'办理个人事务'}]),
    '2026-09':sampleRecord(600000,[],{amountCents:600000,date:'2026-10-15',note:'工资到账'}),
    '2026-08':sampleRecord(600000,[{id:'example-3',date:'2026-08-18',days:1,note:'个人事务'}],{amountCents:580645,date:'2026-09-15',note:''}),
    '2026-07':sampleRecord(580000,[],{amountCents:580000,date:'2026-08-15',note:''})
  },sync:{demo:false,auto:true,offline:false,last:null,pending:0,logs:[],cloudMonths:null}};
}
let storageBlocked = false;
let bootMessage = '';
function loadData() {
  try {const raw=localStorage.getItem(STORAGE);if(!raw&&isAndroid)bootMessage='首次使用，请在“我的”设置月薪、工作主体和入职日期。';const saved=migrateBook(raw?JSON.parse(raw):seed(),defaultSettings,today);return {...saved,sync:{...seed().sync,...saved.sync,logs:Array.isArray(saved.sync?.logs)?saved.sync.logs:[]}};}
  catch {storageBlocked=true;bootMessage='本机存储暂不可用，当前修改只在本次页面内保留。';return migrateBook(seed(),defaultSettings,today);}
}

let db = loadData();
const THEME_STORAGE='dagongren.theme.v1';
const systemTheme=window.matchMedia?.('(prefers-color-scheme: dark)');
let systemDark=globalThis.AndroidFiles?.systemDark?.()??systemTheme?.matches??false;
let activeTheme='system';
try{activeTheme=resolveTheme(localStorage.getItem(THEME_STORAGE)).id;}catch{}
let persistedBook=snapshotBook(db);
let bookCache = null;
let view = 'home';
let pageNavigator=null;
let selectedMonth = today.slice(0,7);
let homePeriodMonth=payPeriodForDate(today,db.defaults).start.slice(0,7);
let profileChartMode='employment';
const pageHistory=[];
let modalOrigin=null;
let recordYear = today.slice(0,4);
let recordFilter = 'all';
let detailTab = 'salary';
let entryFilter = 'all';
let entryMonthScope='';
let editingTransaction = {kind:'',id:''};
let pickerYear = +today.slice(0,4);
let modalMonth = selectedMonth;
let previousFocus;
let toastTimer;
let syncTimer;
let syncBusy = false;
let syncRunTimer;
let syncGeneration=0;
let cleanupDraft={scope:'month',target:'local',month:selectedMonth,year:selectedMonth.slice(0,4)};
let cleanupNotice='';
let pendingCleanupPlan=null;
let editingLeaveId = null;
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const navItems = [['home','home','首页'],['calendar','calendar','日历'],['records','history','明细'],['settings','person','我的']];
const titles = {home:'首页',calendar:'记薪日历',records:'工资明细',sync:'坚果云同步',cleanup:'清理内存',settings:'我的'};
const navActive = key => view === key || ((view === 'sync' || view === 'cleanup') && key === (pageHistory[0]?.view||'settings'));

function pageContext(){return {view,selectedMonth,homePeriodMonth,recordYear,detailTab,entryFilter,entryMonthScope,scrollY:window.scrollY||0};}
function restorePage(context){if(!context)return;({view,selectedMonth,homePeriodMonth,recordYear,detailTab,entryFilter,entryMonthScope}=context);render();window.scrollTo({top:context.scrollY||0,behavior:'instant'});}
function navigateView(next){
 if(next===view)return;
 if(['home','calendar','records','settings'].includes(next))pageHistory.length=0;
 else pageHistory.push(pageContext());
 view=next;
}
function backPage(){const prior=pageHistory.pop();if(prior){restorePage(prior);return true;}if(view!=='home'){navigateView('home');render();window.scrollTo({top:0});return true;}return false;}
function backOne(){if(modalRoot.firstElementChild){if(!stepBackModal())closeModal();return true;}return backPage();}
function dismissMenus(){const origin=modalOrigin;closeModal();if(pageHistory.length){const main=pageHistory[0];pageHistory.length=0;restorePage(main);}else if(origin)restorePage(origin);}

function record(month=selectedMonth) { return {...(db.months[month]||{...db.defaults,leaves:[],overtime:[],advances:[],payments:[],payment:null})}; }


function calculated(month=selectedMonth) {
  if(bookSummary().byMonth[month])return bookSummary().byMonth[month];
  const c=calculate(month,record(month),today,db.defaults);return {...c,daily:[],accruedDays:0,baseCents:0,leaveDays:0,deductLeaveDays:0,deductionCents:0,overtimeCents:0,subsidyCents:0,wageDeductionCents:0,deductionCarryCents:0,expectedCents:0,receivedCents:0,advanceCents:0,paymentCents:0,remainingCents:0,excessCents:0,status:'future'};
}


function persist() {
  if (storageBlocked) return;
  try { rememberDeletions(db,persistedBook,Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));localStorage.setItem(STORAGE, JSON.stringify(db));persistedBook=snapshotBook(db); }
  catch { storageBlocked = true; toast('存储空间不足，当前修改暂未保存到本机。'); }
}
function changed(message) {
  if (db.sync.demo||db.sync.connected) db.sync.pending++;
  persist();render();toast(storageBlocked ? '本次修改仅暂存在页面中，请及时导出。' : message);
  if ((db.sync.demo||db.sync.connected) && db.sync.auto && !db.sync.offline) scheduleDemoSync();
}
function toast(message) {
  clearTimeout(toastTimer);
  const target = document.getElementById('toast');
  target.textContent = message;target.classList.add('show');
  toastTimer = setTimeout(() => target.classList.remove('show'), 3400);
}
function paymentBadge(rec,month=selectedMonth) {
  const c=calculated(month),names={paid:'已结清',current:'已发至今',future:'未开始',partial:'部分已发',unpaid:'待发工资'};
  return `<span class="status-pill ${c.status==='current'?'paid':c.status}">${names[c.status]}</span>`;
}


function syncStatus() {
  if(nativeSync)return nativeSync.status();
  if (!db.sync.demo) return '本机保存';
  if (db.sync.offline) return '演示：离线';
  return syncBusy ? '演示：同步中' : db.sync.last ? '演示：流程完成' : '演示：已就绪';
}
let calendarNavigator=null,deferredRender=false;
function render(force=false) {
  if(!force&&(app.classList.contains('swipe-busy')||pageNavigator?.isPending?.()||calendarNavigator?.isPending?.())){if(app.dataset.swipeTrigger==='tap')pageNavigator?.cancel(false);else{deferredRender=true;return;}}
  deferredRender=false;bookCache=null;
  const appearance=effectiveTheme(activeTheme,systemDark);
  document.body.setAttribute?.('data-theme',appearance);
  document.body.setAttribute?.('data-theme-preference',activeTheme);
  document.querySelector?.('meta[name="theme-color"]')?.setAttribute('content',appearance==='dark'?'#101827':'#f3f5f9');
  globalThis.AndroidFiles?.themeStyle?.(activeTheme);
  if(!storageBlocked)globalThis.AndroidFiles?.motionStyle?.(db.defaults.motion!==false);
  document.body.classList?.toggle('motion-off',db.defaults.motion===false);
  app.classList.toggle('motion-off',db.defaults.motion===false);
  const markup=appMarkup();
  renderStable(app,markup,view,db.defaults.motion!==false);
  updateCloudFeedback(app,syncFeedback(),syncStatus());
  if(view==='calendar')calendarUpdater?.refresh(Number(selectedMonth.slice(0,4)));
  pageNavigator?.invalidate?.();calendarNavigator?.invalidate?.();
}
function appMarkup(){
  const home=view==='home',mine=view==='settings';
  return `<aside class="sidebar"><div class="brand"><div class="brand-icon">${icon('bag')}</div><div><div class="brand-name">打工人</div><div class="brand-sub">工资有数，生活有底。</div></div></div><nav class="side-nav" aria-label="主导航">${navItems.map(([key,i,label])=>`<button class="nav-item ${navActive(key)?'active':''}" data-action="nav" data-view="${key}" ${navActive(key)?'aria-current="page"':''}>${icon(i)}<span>${label}</span></button>`).join('')}</nav><div class="side-bottom"><div class="side-status"><span class="status-dot ${db.sync.demo&&!db.sync.offline?'good':''}"></span>${storageBlocked?'临时保存模式':'本机账本'}${icon('lock')}</div><p>${isAndroid?'本机账本 · 可配置坚果云同步':'交互预览 · 坚果云同步为演示'}</p></div></aside>
  <main class="workspace"><div class="content"><header class="topbar"><div class="page-heading">${home?`<div class="brand-icon">${icon('bag')}</div>`:''}<div><p class="hello">${home?'你的每一份努力，都有记录。':view==='calendar'?'每日计薪与工作记录':view==='records'?'计薪、收款与变动，逐笔可查。':mine?'工资档案与账本管理':view==='cleanup'?'按范围管理你的账本':'账本与数据同步'}</p><h1 class="page-title">${home?'打工人':titles[view]}</h1></div></div><div class="top-actions"><button class="cloud-button sync-cloud-button" data-action="nav" data-view="sync" aria-busy="${syncFeedback().state==='syncing'}" aria-label="云同步：${esc(syncFeedback().message||syncStatus())}，点击查看坚果云同步">${cloudButtonMarkup(syncFeedback(),syncStatus())}</button></div></header>${storageBlocked?'<div class="notice">当前仅临时保存，请通过“我的”导出账本备份。</div>':''}<div id="view-content" class="view-${view}">${home?homeView():view==='calendar'?calendarPage():view==='records'?recordsView():view==='sync'?syncView():view==='cleanup'?cleanupView():settingsView()}</div>${mine?appInfoFooter():`<footer class="page-foot">${icon('lock')}${isAndroid?'账本保存在本机':'交互预览 · 示例账本'} · ${storageBlocked?'修改仅在当前页面保留':isAndroid?'可在“我的”配置坚果云':'修改保存在当前浏览器'}</footer>`}</div></main>
  <button class="record-launcher" data-action="record-entry" aria-label="记一笔：请假、加班、补贴、扣款、预支或发工资"><span class="record-plus">${icon('plus')}</span><span>记一笔</span></button><nav class="bottom-nav" aria-label="底部导航">${navItems.map(([key,i,label])=>`<button class="${navActive(key)?'active':''}" data-action="nav" data-view="${key}" ${navActive(key)?'aria-current="page"':''}>${icon(i)}<span>${label}</span></button>`).join('')}</nav>`;
}
function previewPage(next){
 const oldView=view,oldScope=entryMonthScope,oldPending=lastRenderedPending;
 try{view=next;if(next==='records')entryMonthScope='';return chartNumberMarkup(appMarkup());}finally{view=oldView;entryMonthScope=oldScope;lastRenderedPending=oldPending;}
}
function shiftMonth(month,delta){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);}
function previewCalendar(delta){
 const old=selectedMonth,next=shiftMonth(old,delta);if(!validMonth(next))return null;
 try{selectedMonth=next;return {month:next,markup:calendarView()};}finally{selectedMonth=old;}
}
function settledRender(){if(deferredRender){deferredRender=false;render();}pageNavigator?.invalidate?.();calendarNavigator?.invalidate?.();}
function commitCalendar(delta){const next=shiftMonth(selectedMonth,delta);if(validMonth(next)){selectedMonth=next;render(true);}}


function monthToolbar(withToday=false,returnMonth=false) {
  return `<div class="month-toolbar"><div class="month-control"><button class="icon-button" data-action="shift-month" data-delta="-1" aria-label="上个月">${icon('left')}</button><button class="month-display" data-action="month-picker" aria-label="选择月份，当前${fullMonth(selectedMonth)}">${fullMonth(selectedMonth)}${icon('down')}</button><button class="icon-button" data-action="shift-month" data-delta="1" aria-label="下个月">${icon('chevron')}</button></div><button class="month-settings" data-action="${returnMonth?'home-current':withToday?'calendar-today':'salary-settings'}">${icon(withToday||returnMonth?'calendar':'edit')}<span>${returnMonth?'返回当月':withToday?'回到今天':'月薪设置'}</span></button></div>`;
}

function companyStrip() {
  const company=record().company;
  return `<button class="company-strip" data-action="company-settings">${icon('building')}<span>${esc(company||'添加工作主体')}</span>${icon('chevron')}</button>`;
}

function wageOverview() {
  const b=bookSummary(),pendingPeriods=b.periods.filter(x=>x.remainingCents).length,updated=lastRenderedPending!==null&&lastRenderedPending!==b.remainingCents;lastRenderedPending=b.remainingCents;
  return `<section class="balance-hero ${updated?'data-updated':''}"><div class="balance-heading"><span class="balance-eyebrow"><i></i>工资总览</span><button data-action="company-settings">${esc(db.defaults.company||'设置工作主体')}${icon('chevron')}</button></div><button class="balance-primary" ${metricAttrs('pending')} aria-label="待发工资 ${money(b.remainingCents)}元，点击查看所有待发账期"><span class="balance-label">待发工资 <small>全部主体 / 账期</small></span><strong class="number"><small>¥</small>${money(b.remainingCents)}${icon('chevron')}</strong></button><div class="balance-caption"><span>${pendingPeriods}个待发账期 · 截至${shortDate(today)}</span><button data-action="record-kind" data-kind="payment">发工资${icon('arrow')}</button></div><div class="hero-data-strip"><button ${metricAttrs('earned')}><span>累计净计薪</span><strong class="number">${money(b.expectedCents)}</strong></button><button ${metricAttrs('received')}><span>累计实收 <small>含预支</small></span><strong class="number">${money(b.receivedCents)}</strong></button></div></section>${b.unappliedCents?`<button class="data-notice" ${metricAttrs('unapplied')}>${icon('info')}<span>¥${money(b.unappliedCents)}实收尚待抵扣</span>${icon('chevron')}</button>`:''}${b.deductionCarryCents?`<button class="data-notice warning" ${metricAttrs('carry')}>${icon('info')}<span>¥${money(b.deductionCarryCents)}扣款待该账期后续计薪抵扣</span>${icon('chevron')}</button>`:''}`;
}
function homeRange(){
 if(db.defaults.periodMode!=='custom')return {start:selectedMonth+'-01',end:selectedMonth+'-'+daysInMonth(selectedMonth)};
 const startDay=Math.min(Number(db.defaults.periodStartDay)||1,daysInMonth(homePeriodMonth));
 return payPeriodForDate(homePeriodMonth+'-'+pad(startDay),db.defaults);
}
function homeAccount(){
 const range=homeRange(),scope=db.defaults.periodMode==='custom'?'cycle':'month',ref=scope==='cycle'?range.start:selectedMonth;
 const total=metric=>metricData({metric,scope,ref}).total;
 return {...range,scope,ref,expectedCents:total('earned'),baseCents:total('base'),overtimeCents:total('overtime'),subsidyCents:total('subsidy'),deductionCents:total('leave'),wageDeductionCents:total('deduction'),receivedCents:total('applied'),remainingCents:total('pending'),accruedDays:total('days'),dailyCents:metricRateInfo({scope,ref}).dailyCents};
}
function homeToolbar(){
 if(db.defaults.periodMode!=='custom')return monthToolbar(false,true);
 const range=homeRange();
 return '<div class="month-toolbar cycle-toolbar"><div class="month-control"><button class="icon-button" data-action="shift-home-period" data-delta="-1" aria-label="上个工资周期">'+icon('left')+'</button><button class="month-display cycle-display" data-action="home-period-picker" aria-label="选择工资周期，当前'+periodName(range)+'"><span>'+periodName(range)+'</span>'+icon('down')+'</button><button class="icon-button" data-action="shift-home-period" data-delta="1" aria-label="下个工资周期">'+icon('chevron')+'</button></div><button class="month-settings" data-action="home-current">'+icon('calendar')+'<span>返回当月</span></button></div>';
}
function showHomePeriodPicker(){pickerYear=Number(homePeriodMonth.slice(0,4));renderHomePeriodPicker();}
function renderHomePeriodPicker(){
 showModal('选择工资周期','<div class="month-year"><button class="icon-button" data-action="home-picker-year" data-delta="-1" '+(pickerYear<=2020?'disabled':'')+' aria-label="上一年">'+icon('left')+'</button><span>'+pickerYear+'年起始的周期</span><button class="icon-button" data-action="home-picker-year" data-delta="1" '+(pickerYear>=2040?'disabled':'')+' aria-label="下一年">'+icon('chevron')+'</button></div><div class="month-options cycle-options">'+Array.from({length:12},(_,i)=>{const month=pickerYear+'-'+pad(i+1),day=Math.min(Number(db.defaults.periodStartDay)||1,daysInMonth(month)),range=payPeriodForDate(month+'-'+pad(day),db.defaults);return '<button class="month-option '+(month===homePeriodMonth?'selected':'')+'" data-action="choose-home-period" data-month="'+month+'"><strong>'+range.start.slice(5).replace('-','/')+'</strong><small>至 '+range.end.slice(5).replace('-','/')+(range.end.slice(0,4)!==range.start.slice(0,4)?'（次年）':'')+'</small></button>';}).join('')+'</div><p class="field-note">每项是一个完整工资周期，包含起止日；未到日期暂不计薪。短月起始日取月末。</p>');
}

function homeView() {
  const b=bookSummary(),c=homeAccount(),custom=db.defaults.periodMode==='custom',year=selectedMonth.slice(0,4),recent=ledgerEntryRows(selectedMonth,'all',3),p=currentPeriod(selectedMonth),monthMetrics=[['base','基本工资',c.baseCents,'money','neutral'],['overtime','加班收入',c.overtimeCents,'clock','positive'],['subsidy','补贴收入',c.subsidyCents,'plus','positive'],['leave','请假扣薪',c.deductionCents,'leave','negative'],['deduction','其他扣款',c.wageDeductionCents,'minus','negative'],['applied','收款已抵扣',c.receivedCents,'wallet','neutral']],received=metricData({metric:'received',scope:'year',ref:year}).total,pending=metricData({metric:'pending',scope:'year',ref:year}).total;
  return `${wageOverview()}${settlementChart(b,activeTheme)}<div class="home-section-title"><h2>月度账目</h2><span>点击金额查看明细${icon('chevron')}</span></div>${homeToolbar()}${custom||db.months[selectedMonth]?`<section class="month-account panel" data-start="${c.start}" data-end="${c.end}"><div class="month-account-head"><button ${metricAttrs('earned',c.scope,c.ref)}><span>${custom?'本周期':monthNum(selectedMonth)+'月'}净计薪${icon('chevron')}</span><strong class="number"><small>¥</small>${money(c.expectedCents)}</strong></button><button class="accrual-chip" ${metricAttrs('days',c.scope,c.ref)}><b class="number">${c.accruedDays}</b><span>已计薪天数</span></button></div><div class="account-components">${monthMetrics.map(([key,label,amount,mark,tone])=>`<button class="component ${tone}" ${metricAttrs(key,c.scope,c.ref)}><span>${icon(mark)}${label}${icon('chevron')}</span><strong class="number">${key==='subsidy'||key==='overtime'?'+ ':key==='leave'||key==='deduction'?'− ':''}${money(amount)}</strong></button>`).join('')}</div><div class="month-account-foot"><button ${metricAttrs('pending',c.scope,c.ref)}><span>${custom?'本周期':'本月'}待发</span><strong class="number">¥ ${money(c.remainingCents)}</strong>${icon('chevron')}</button><button ${metricAttrs('rate',c.scope,c.ref)}><span>每日参考</span><strong class="number">¥ ${money(c.dailyCents)}</strong>${icon('chevron')}</button></div></section>`:emptyMonthView()}<button class="today-insight" ${metricAttrs('earned','today')}><span class="insight-icon">${icon('clock')}</span><span><strong>今天新增计薪</strong><small>全部主体 · 点开查看当日构成</small></span><b class="number">${b.todayCents<0?'':'+'}${money(b.todayCents)}</b>${icon('chevron')}</button><section class="panel record-hub"><div class="section-header"><h2>快捷记账</h2><button class="link" data-action="record-entry">全部入口${icon('arrow')}</button></div><div class="quick-actions">${[['leave','leave','记请假'],['overtime','clock','记加班'],['subsidy','plus','记补贴'],['deduction','minus','记扣款'],['advance','wallet','记预支'],['payment','money','发工资']].map(([kind,mark,label])=>`<button class="quick-action ${kind}" data-action="record-kind" data-kind="${kind}"><span>${icon(mark)}</span><strong>${label}</strong></button>`).join('')}</div></section><button class="period-banner" data-action="record-detail" data-period="${esc(p.id)}"><span class="period-icon">${icon('calendar')}</span><span><strong>当前发薪账期</strong><small>${periodName(p)}</small></span>${icon('chevron')}</button><section class="panel recent-panel"><div class="section-header"><h2>本月最近记录</h2><button class="link" data-action="month-entries" data-month="${selectedMonth}">全部${icon('chevron')}</button></div>${recent||'<div class="empty-state">工资按天自动累计，<br>请假、加班和其他变动记在这里。</div>'}</section><section class="panel annual-board"><div class="section-header"><h2>年度概览</h2><span class="year-tag">${year}</span></div><div class="annual-metrics"><button ${metricAttrs('received','year',year)}><span>年度实收 <small>含预支</small></span><strong class="number">${money(received)}</strong>${icon('chevron')}</button><button ${metricAttrs('pending','year',year)}><span>年度待发</span><strong class="number">${money(pending)}</strong>${icon('chevron')}</button></div></section>`;
}
function calendarPage() {
  const c=calculated();return `<section class="calendar-summary"><button ${metricAttrs('earned','month',selectedMonth)}><span>本月净计薪</span><strong class="number">¥ ${money(c.expectedCents)}</strong>${icon('chevron')}</button><button ${metricAttrs('days','month',selectedMonth)}><span>已计薪</span><strong class="number">${c.accruedDays}<small>天</small></strong>${icon('chevron')}</button></section><section class="panel calendar-panel calendar-page" data-calendar-swipe data-calendar-month="${selectedMonth}" aria-label="记薪日历，可左右滑动切换月份"><div class="calendar-panel-header"><div class="section-header"><h2>记薪日历</h2><span class="muted small">每天的工资，一目了然</span></div>${monthToolbar(true)}</div>${calendarView()}<p class="calendar-gesture-hint">${icon('left')}仅日期区域左右滑动切月份${icon('chevron')}</p><div class="legend"><span><i class="l"></i>请假</span><span><i class="h"></i>放假调休</span><span><i class="s"></i>法定节假日</span><span><i class="r"></i>有记录</span></div><p class="calendar-hint">日期下方为当日净计薪（元）：正数绿色、负数红色，0和未计薪为灰色。点击日期查看构成或记一笔。</p></section>${dailyWageChart(selectedMonth,c.daily,c.expectedCents,activeTheme)}<button class="calendar-policy" data-action="nav" data-view="settings"><span>${icon('shield')}新请假默认值</span><small>法定${db.defaults.holidayLeaveDeduct?'扣款':'不扣'} · 调休${db.defaults.adjustedLeaveDeduct?'扣款':'不扣'}</small>${icon('chevron')}</button><section class="panel calendar-records"><div class="section-header"><h2>本月记录</h2><button class="link" data-action="month-entries" data-month="${selectedMonth}">全部${icon('chevron')}</button></div>${ledgerEntryRows(selectedMonth,'all',5)||'<div class="empty-state">这个月还没有逐笔记录。</div>'}</section>`;
}
function recordYears(){const b=bookSummary();return [...new Set([recordYear,today.slice(0,4),...Object.keys(db.months).map(m=>m.slice(0,4)),...journalEntries().map(x=>x.date.slice(0,4)),...b.periods.map(p=>p.start.slice(0,4))])].sort().reverse();}
function showRecordYearPicker(){
 const years=[recordYear,...recordYears().filter(year=>year!==recordYear)];
 showModal('选择明细年份','<p class="field-note">选择年份，查看对应的计薪、收款和待发账目。</p><div class="record-year-options" role="group" aria-label="明细年份">'+years.map(year=>'<button type="button" class="record-year-option" data-action="choose-record-year" data-year="'+year+'" aria-pressed="'+(year===recordYear)+'"><strong>'+year+'年</strong><span>'+(year===recordYear?'当前选择':'查看该年账目')+'</span></button>').join('')+'</div>');
}
function recordsView() {
  const b=bookSummary(),salary=detailTab==='salary',periods=b.periods.filter(p=>p.start.startsWith(recordYear+'-')),filtered=periods.filter(p=>recordFilter==='all'||(recordFilter==='paid'?p.remainingCents===0&&!p.deductionCarryCents:p.remainingCents>0)),received=metricData({metric:'received',scope:'year',ref:recordYear}).total,pending=metricData({metric:'pending',scope:'year',ref:recordYear}).total,earned=metricData({metric:'earned',scope:'year',ref:recordYear}).total,journalMonths=[...new Set(journalEntries().filter(x=>x.date.startsWith(recordYear+'-')&&(!entryMonthScope||x.date.startsWith(entryMonthScope+'-'))).map(x=>x.date.slice(0,7)))].sort().reverse(),entryCount=journalEntries().filter(x=>x.date.startsWith(recordYear+'-')&&(!entryMonthScope||x.date.startsWith(entryMonthScope+'-'))&&(entryFilter==='all'||x.kind===entryFilter)).length;
  return `<div class="ledger-heading"><div><span class="eyebrow">工资流水</span><h2>账目清晰，每笔有据</h2></div><button type="button" id="record-year" class="select-year record-year-trigger" data-action="record-year-picker" aria-haspopup="dialog" aria-label="选择明细年份，当前${recordYear}年"><span>${recordYear}年</span>${icon("down")}</button></div><section class="ledger-overview panel"><button class="ledger-main-metric" ${metricAttrs('received','year',recordYear)}><span>年度实收 <small>含预支 · 按收款日期</small></span><strong class="number"><small>¥</small>${money(received)}</strong>${icon('chevron')}</button><div class="ledger-secondary"><button ${metricAttrs('earned','year',recordYear)}><span>年度净计薪</span><strong class="number">${money(earned)}</strong>${icon('chevron')}</button><button ${metricAttrs('pending','year',recordYear)}><span>年度待发</span><strong class="number">${money(pending)}</strong>${icon('chevron')}</button></div></section>${annualWageChart(recordYear,b,activeTheme)}<div class="detail-tabs" role="group" aria-label="明细类型"><button class="${salary?'active':''}" data-action="detail-tab" data-tab="salary" aria-pressed="${salary}">${icon('calendar')}发薪账期</button><button class="${!salary?'active':''}" data-action="detail-tab" data-tab="entries" aria-pressed="${!salary}">${icon('history')}逐笔记录</button></div>${salary?`<div class="records-toolbar"><div class="filters" role="group" aria-label="发薪状态">${[['all','全部'],['unpaid','待发'],['paid','已发至今']].map(([key,label])=>`<button class="filter ${recordFilter===key?'active':''}" data-action="filter" data-filter="${key}" aria-pressed="${recordFilter===key}">${label}</button>`).join('')}</div><span class="muted small">按账期起始年</span></div><div class="salary-record-list">${filtered.map(p=>{const progress=p.expectedCents>0?Math.min(100,p.receivedCents/p.expectedCents*100):0;return `<button class="month-pay-card" data-action="record-detail" data-period="${esc(p.id)}"><span class="pay-card-heading"><span class="pay-card-title"><strong>${periodName(p)}</strong><small>${esc(p.company||'未命名主体')}</small></span><span class="status-pill ${p.remainingCents?'unpaid':p.deductionCarryCents?'offset':'paid'}">${p.remainingCents?'待发':p.deductionCarryCents?'待抵扣扣款':'已发至今'}</span>${icon('chevron')}</span><span class="pay-card-figures"><span><small>净计薪</small><strong class="number">${money(p.expectedCents)}</strong></span><span class="waiting"><small>待发工资</small><strong class="number">${money(p.remainingCents)}</strong></span></span><span class="pay-card-progress"><span style="width:${progress.toFixed(2)}%"></span></span><span class="pay-card-foot"><span>已抵扣 ¥${money(p.receivedCents)}</span><span>约定${shortDate(p.dueDate)}发薪</span></span></button>`;}).join('')||'<section class="panel"><div class="empty-state">这个筛选下暂无发薪账期。</div></section>'}</div>`:`<div class="entry-filters" role="group" aria-label="筛选记账类型">${[['all','全部'],['leave','请假'],['overtime','加班'],['subsidy','补贴'],['deduction','扣款'],['advance','预支'],['payment','发工资']].map(([key,label])=>`<button class="filter ${entryFilter===key?'active':''}" data-action="entry-filter" data-filter="${key}" aria-pressed="${entryFilter===key}">${label}</button>`).join('')}</div><div class="entries-scope"><p class="entries-caption">${entryMonthScope?fullMonth(entryMonthScope):recordYear+'年'} · 按记录日期 · ${entryCount}笔 · 点击修改</p>${entryMonthScope?'<button data-action="clear-entry-month">全年记录'+icon('arrow')+'</button>':''}</div>${journalMonths.map(m=>{const rows=ledgerEntryRows(m,entryFilter);return rows?`<section class="panel ledger-group"><div class="section-header"><h2>${fullMonth(m)}</h2></div>${rows}</section>`:'';}).join('')||'<section class="panel"><div class="empty-state">这个筛选下暂无逐笔记录。</div></section>'}`}<button class="btn btn-plain full export-detail" data-action="export">${icon('download')}导出全部工资与记录</button>`;
}
function showCompanySettings() {
  modalMonth=selectedMonth;const r=record();
  showModal('工作主体与入职时间',`<form id="company-form"><div class="field"><label for="company-name">公司 / 单位名称</label><input id="company-name" name="company" maxlength="50" placeholder="例如：某某某公司" value="${esc(r.company||'')}" autocomplete="organization"></div><div class="field"><label for="join-date">入职日期</label><input id="join-date" name="joinDate" type="date" min="2020-01-01" max="2040-12-31" value="${r.joinDate||db.defaults.joinDate}" required><p class="field-note">入职当天开始计薪，包含今天。入职前不累计；未来入职则到入职当天开始。</p></div><div class="notice gray">当前月份及同名主体的入职时间会更新，真实收款记录保留。未建账的在职月份会补建，保存后会从入职日期重新补齐基础计薪，已清理流水不恢复。</div><div class="error" id="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn btn-plain" data-action="modal-back">取消</button><button type="submit" class="btn btn-primary">保存工作资料</button></div></form>`);
}


function showHolidaySettings() { navigateView('settings');closeModal();render(); }
function calendarView() {
  const [year,month]=selectedMonth.split('-').map(Number),first=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7,dayCount=daysInMonth(selectedMonth),count=Math.ceil((first+dayCount)/7)*7,rec=record(),daily=calculated().daily,entries=journalEntries(selectedMonth);let cells='';
  for(let i=0;i<count;i++){
    const n=i-first+1;if(n<1||n>dayCount){cells+='<span class="calendar-day empty" aria-hidden="true"></span>';continue;}
    const date=selectedMonth+'-'+pad(n),info=calendarDay(date),leave=rec.leaves.find(x=>x.date===date),isToday=date===today,day=daily.find(x=>x.date===date),hasRecord=entries.some(x=>x.date===date),badge=leave?'假':info.work?'班':info.statutory?'法':info.holiday?'休':'',caption=info.festival||info.term||info.lunar;
    const classes=[info.holiday?'holiday':'',info.statutory?'statutory':'',leave?'leave':'',isToday?'today':'',i%7>4?'weekend':'',info.work?'makeup':'',hasRecord?'has-entry':''].join(' ');
    cells+='<button class="calendar-day '+classes+'" data-action="day-ledger" data-date="'+date+'" '+(isToday?'aria-current="date"':'')+' aria-label="'+date+'，'+esc(info.lunarFull)+'，'+esc(info.festival||info.term||'')+'，'+(badge||'普通日期')+'，当日净计薪'+money(day?.amountCents||0)+'元"><span class="day-number">'+n+(badge?'<i class="day-badge">'+badge+'</i>':'')+'</span><small class="lunar-label">'+esc(caption)+'</small><b class="day-wage '+(day?.amountCents>0?'wage-income':day?.amountCents<0?'wage-loss':'wage-neutral')+'" data-static-number>'+(day?money(day.amountCents):'—')+'</b>'+(hasRecord?'<i class="record-dot"></i>':'')+'</button>';
  }
  return '<div class="calendar-week">'+['一','二','三','四','五','六','日'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="calendar-grid-viewport"><div class="calendar-days" data-weeks="'+(count/7)+'">'+cells+'</div></div><button class="calendar-source-note" data-action="calendar-sources">'+icon('info')+'<span><strong>日历使用说明</strong><small>'+calendarCoverage(year)+'</small></span>'+icon('chevron')+'</button>';
}
function showCalendarSources(){
  showModal('日历使用说明',`<div class="calendar-help"><h3>日期格内的金额</h3><p>显示当日净计薪（元），不是当天实际收到的工资。正数为绿色，负数为红色，0为灰色；“—”表示该日未计薪，可能是未来、入职前或所在月份未建账 / 已清理。</p><p>净计薪＝基本工资 − 请假扣薪 ＋ 加班 ＋ 补贴 − 其他扣款。预支和发工资只影响实际收款与抵扣，不会重复计入当日收入。</p><h3>切月与查看记录</h3><p>日历按自然月、周一至周日排列，区域随月份显示4、5或6行。可左右滑动日期区域，也可点月份或左右箭头切换；“回到今天”返回当前月份并定位今天。点击日期查看当日构成、修改记录或记一笔。</p><h3>计薪范围与工资周期</h3><p>从入职当天累计至今天，未来日期不提前计薪。自然月模式用固定工资除以当月总天数；自定义跨月模式用固定工资除以该日期所在完整工资周期的总天数，包含起止日。日历仍按自然月显示，本月汇总和下方图表合计本月已生效日期；首页月度账目按你选择的工资周期汇总。</p><h3>角标与请假规则</h3><p>“假”为已登记请假，“班”为补班，“法”为法定节假日，“休”为已收录的放假调休。角标优先显示请假；小圆点表示有逐笔记录。休息日与法定节假日不等同，日期标记不会自动改变工资；请假是否扣款以该笔保存的选择为准，修改默认开关不会改动旧记录。</p></div><div class="notice">放假、调休和补班联网资料来自开源项目 holiday-cn，按国务院公告自动抓取，并非政府官方接口。联网时应用自动检查并缓存可用年度安排。未取得有效新资料时继续使用内置或缓存资料，不推测未来补班。</div><p class="field-note">${esc(calendarUpdater?.summary(Number(selectedMonth.slice(0,4)))||'当前使用离线资料。')}</p><a class="source-link" href="https://github.com/NateScarlet/holiday-cn" target="_blank" rel="noopener noreferrer">联网资料与公告原文出处</a>`+'<div class="data-coverage"><span class="coverage-tag">2020—2040</span><h3>农历 · 节日 · 二十四节气</h3><p>农历与节气按香港天文台日期对照表收录，日历可离线查看。全年节日与具体放假调休分别标注。</p><div class="coverage-item"><strong>2020—2026</strong><span>官方放假、调休与补班已收录，包含2020年春节延长假期。</span></div><div class="coverage-item"><strong>2027—2040</strong><span>可查看农历、节日及节气。年度放假调休支持联网获取；未取得有效资料的年份不预设补班日期。</span></div><p class="field-note">法定节日按对应年份适用规定标注；日期信息不自动改变已保存的单笔请假扣款选择。</p><a class="source-link" href="https://www.hko.gov.hk/sc/gts/time/conversion1_text.htm" target="_blank" rel="noopener noreferrer">香港天文台 · 日期对照表</a><a class="source-link" href="https://www.gov.cn/" target="_blank" rel="noopener noreferrer">中国政府网 · 放假通知</a><p class="field-note">农历资料知识产权归香港特别行政区政府所有，来自香港天文台及DATA.GOV.HK。本应用并非天文台出品或推荐。</p><button class="btn btn-outline source-rights" data-action="calendar-rights">资料版权与使用条件</button></div>');
}

function appInfoFooter(){
  const version=isAndroid?'安卓版 1.3.4 正式版':'1.3.4 网页预览';
  const storage=storageBlocked?'存储暂不可用，请及时导出账本。':isAndroid?'账本保存在本机，可自行配置坚果云同步。':'浏览器预览 · 数据保存在浏览器，坚果云同步为演示。';
  return `<footer class="app-info-footer" aria-label="应用信息"><div class="app-info-heading"><strong>打工人</strong><span>${version}</span></div><p class="app-info-storage">${icon('lock')}<span>${storage}</span></p><div class="app-info-divider" aria-hidden="true"></div><p class="app-info-owner">腾子科技·版权所有</p><p class="app-info-phone">联系电话：18937027607</p></footer>`;
}

function settingsView() {
  const r=record(),c=calculated(),months=Object.keys(db.months).length;
  return `<section class="profile-card"><div class="profile-main"><span class="profile-avatar">工</span><span class="profile-identity"><span class="profile-label">工作档案</span><small>当前工作主体</small></span><button class="profile-edit" data-action="company-settings" aria-label="编辑工作主体与入职日期">${icon('edit')}编辑</button></div><div class="profile-name-viewport" tabindex="0" role="region" aria-label="完整工作主体名称，可横向滑动"><strong class="profile-company">${esc(r.company||'设置公司或单位名称')}</strong></div><p class="profile-name-hint">左右滑动查看完整名称</p><small class="profile-join">${icon('calendar')}<span>入职日期</span><time datetime="${r.joinDate}">${r.joinDate.replace(/-/g,' / ')}</time></small><div class="profile-meta"><button data-action="nav" data-view="records" data-tab="entries">${icon('history')}已记录 <strong>${months}</strong> 个月${icon('chevron')}</button><span>${icon('lock')}${storageBlocked?'临时保存':'本机保存'}</span></div></section>${profileChart(db.months,r.joinDate,today,profileChartMode,activeTheme)}<div class="my-layout"><div><div class="my-section-heading"><h2>工资档案</h2><button data-action="month-picker">${fullMonth(selectedMonth)}${icon('down')}</button></div><section class="panel menu-panel"><button class="setting-row" data-action="company-settings"><span class="setting-icon">${icon('building')}</span><span class="setting-text"><strong>工作主体</strong><p>${esc(r.company||'填写公司或单位名称')} · ${r.joinDate}入职</p></span>${icon('chevron')}</button><button class="setting-row" data-action="salary-settings"><span class="setting-icon">${icon('wallet')}</span><span class="setting-text"><strong>固定月薪</strong></span><span class="setting-value number">¥ ${money(r.salaryCents)}</span>${icon('chevron')}</button><button class="setting-row" data-action="salary-settings"><span class="setting-icon">${icon('calendar')}</span><span class="setting-text"><strong>请假计薪口径</strong><p>${db.defaults.periodMode==='custom'?'按完整跨月周期总天数逐日累计':'按当月自然日天数逐日累计'}</p></span><span class="setting-value">${c.divisor}天</span>${icon('chevron')}</button><button class="setting-row" data-action="salary-settings"><span class="setting-icon">${icon('money')}</span><span class="setting-text"><strong>发薪日与结算区间</strong><p>${db.defaults.periodMode==='custom'?'每月'+db.defaults.periodStartDay+'日起跨月结算':'发放上个自然月工资'}</p></span><span class="setting-value">每月${db.defaults.payday}日</span>${icon('chevron')}</button></section><div class="my-section-heading"><h2>请假扣薪规则</h2><span>只作新记录默认值</span></div><section class="panel menu-panel"><div class="setting-row policy-row"><span class="setting-icon">${icon('leaf')}</span><span class="setting-text"><strong>法定节假日请假是否扣款</strong><p>${db.defaults.holidayLeaveDeduct?'新请假默认扣款':'新请假默认不扣'}；单笔可修改，旧记录不变</p></span><button class="switch ${db.defaults.holidayLeaveDeduct?'on':''}" role="switch" aria-checked="${db.defaults.holidayLeaveDeduct===true}" aria-label="法定节假日请假是否扣款" data-action="toggle-holiday-leave"></button></div><div class="setting-row policy-row"><span class="setting-icon">${icon('calendar')}</span><span class="setting-text"><strong>调休日请假是否扣款</strong><p>${db.defaults.adjustedLeaveDeduct?'新请假默认扣款':'新请假默认不扣'}；单笔可修改，旧记录不变</p></span><button class="switch ${db.defaults.adjustedLeaveDeduct?'on':''}" role="switch" aria-checked="${db.defaults.adjustedLeaveDeduct===true}" aria-label="调休日请假是否扣款" data-action="toggle-adjusted-leave"></button></div></section></div><div><div class="my-section-heading"><h2>账本与数据</h2></div><section class="panel menu-panel"><button class="setting-row" data-action="nav" data-view="sync"><span class="setting-icon">${icon('cloud')}</span><span class="setting-text"><strong>坚果云同步</strong><p>${isAndroid?'自行配置账号与应用密码':'网盘同步流程演示'}</p></span><span class="setting-value ${db.sync.demo?'connected-text':''}">${db.sync.connected?'已配置':db.sync.demo?'演示中':'未连接'}</span>${icon('chevron')}</button><button class="setting-row" data-action="export"><span class="setting-icon">${icon('download')}</span><span class="setting-text"><strong>导出工资账本</strong><p>月度汇总与全部逐笔记录</p></span>${icon('chevron')}</button><button class="setting-row" data-action="open-cleanup"><span class="setting-icon">${icon('trash')}</span><span class="setting-text"><strong>清理内存</strong><p>${isAndroid?'按年、按月或全部清理本机记录':'按年、按月或全部清理本地 / 云端演示数据'}</p></span>${icon('chevron')}</button></section><div class="my-section-heading"><h2>显示偏好</h2></div><section class="panel menu-panel"><button class="setting-row" data-action="theme-settings"><span class="setting-icon">${icon('leaf')}</span><span class="setting-text"><strong>主题设置</strong><p>${resolveTheme(activeTheme).name}</p></span>${icon('chevron')}</button><div class="setting-row policy-row"><span class="setting-icon">${icon('refresh')}</span><span class="setting-text"><strong>界面动效</strong><p>卡片入场、数据更新与柔和流光</p></span><button class="switch ${db.defaults.motion!==false?'on':''}" role="switch" aria-checked="${db.defaults.motion!==false}" aria-label="界面动效" data-action="toggle-motion"></button></div></section><div class="my-section-heading"><h2>帮助与说明</h2></div><section class="panel menu-panel"><button class="setting-row" data-action="rules"><span class="setting-icon">${icon('help')}</span><span class="setting-text"><strong>工资怎么算</strong><p>查看逐日计薪、补贴扣款与工资结算</p></span>${icon('chevron')}</button></section></div></div>`;
}

function syncView() {
  if(nativeSync)return nativeSync.view();
  const s=db.sync;
  const time=s.last?new Date(s.last).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'}):'';
  return `<button class="btn btn-ghost" data-action="page-back">${icon('left')}返回上一级</button><div class="month-toolbar"><span class="month-display" style="padding-left:0">换部手机，账本也跟着你。</span></div><div class="sync-layout"><section class="sync-hero">
    <div class="sync-art"><span class="sync-orbit"></span>${icon('cloud')}<span class="sync-tiny left">${icon('phone')}</span><span class="sync-tiny right">${icon('file')}</span></div>
    <div class="demo-label"><span class="status-dot"></span>${s.demo?'同步流程演示中 · 未连接真实网盘':'演示模式 · 尚未连接坚果云'}</div><h2>工资账本，随身带走。</h2><p>用你自己的坚果云保存工资记录。<br>本次预览可体验自动同步、离线暂存与恢复。</p>
    <div class="sync-actions"><button class="btn btn-primary" data-action="${s.demo?'sync-now':'connect-demo'}" ${syncBusy?'disabled':''}>${icon(s.demo?'refresh':'cloud')}${syncBusy?'正在演示同步…':s.demo?'演示立即同步':'体验同步流程'}</button><button class="btn btn-plain" data-action="connection-settings">接入设置</button></div>
    ${s.demo?`${syncDataSummary()}<div class="sync-progress ${syncBusy?'running':''}"><span></span></div><div class="sync-message">${s.offline?'演示离线：修改仍保存在本机，恢复后补传。':syncBusy?'演示中：正在处理待同步修改…':s.pending?`有${s.pending}次修改等待演示同步`:time?`${time} 演示流程完成，未上传任何数据。`:'可以记一笔请假，看看自动同步流程。'}</div><div class="sync-switches"><div class="setting-row"><span class="setting-text"><strong>修改后自动同步</strong><p>仅演示流程，不发送网络请求。</p></span><button class="switch ${s.auto?'on':''}" role="switch" aria-checked="${s.auto}" aria-label="修改后自动同步，演示开关" data-action="toggle-auto"></button></div><div class="setting-row"><span class="setting-text"><strong>模拟离线</strong><p>${s.offline?'关闭后体验恢复同步':'开启后体验断网记账'}</p></span><button class="switch ${s.offline?'on':''}" role="switch" aria-checked="${s.offline}" aria-label="模拟离线" data-action="toggle-offline"></button></div></div>`:'<div class="sync-message" style="margin-top:19px">无需输入真实账号或密码，即可体验。</div>'}
  </section><div><section class="panel"><div class="section-header"><h2>正式接入时，这样使用</h2>${icon('shield')}</div><div class="sync-steps"><div class="sync-step"><span class="step-number">01</span><div><h3>生成专用应用密码</h3><p>坚果云 → 账户信息 → 安全选项 → 第三方应用管理，为“打工人”生成应用密码。</p></div></div><div class="sync-step"><span class="step-number">02</span><div><h3>在手机内连接你的网盘</h3><p>填写坚果云账号及应用授权密码，工资账本使用独立文件夹存放。</p></div></div><div class="sync-step"><span class="step-number">03</span><div><h3>记一笔，及时同步一笔</h3><p>正式版需实现：修改后上传、打开时检查更新、离线补传与多设备冲突处理。</p></div></div></div></section><section class="panel sync-log"><div class="section-header" style="margin-bottom:8px"><h2>演示动态</h2><span class="muted small">本机流程</span></div>${s.logs.length?s.logs.slice(0,5).map(log=>`<div class="log-row">${icon(log.icon||'check')}<span>${esc(log.text)}</span><time>${esc(log.time)}</time></div>`).join(''):'<div class="empty-state" style="padding:22px 0">还没有演示动态，先体验一次连接。</div>'}</section></div></div>`;
}

function modalPresentation(title){
  if(/删除|清理/.test(title))return {kind:'danger',mark:'trash',label:'账本管理',description:'核对影响范围，再确认本次操作。'};
  if(/坚果云|连接|同步|两端|网盘/.test(title))return {kind:'sync',mark:'cloud',label:'连接与同步',description:'使用自己的账号，管理账本同步。'};
  if(/月薪|发薪周期|主体|工作/.test(title))return {kind:'profile',mark:'building',label:'工作档案',description:'准确设置，让每一天的工资都有依据。'};
  if(/请假/.test(title))return {kind:'leave',mark:'leave',label:'工作记录',description:'记录日期与时长，确认本次扣款方式。'};
  if(/加班/.test(title))return {kind:'income',mark:'clock',label:'收入记录',description:'按实际发生日期，记录每一笔收入。'};
  if(/补贴|发工资|预支/.test(title))return {kind:'income',mark:'wallet',label:'工资与收款',description:'填写金额与归属日期，账本会自动重算。'};
  if(/扣款/.test(title))return {kind:'deduction',mark:'minus',label:'工资调整',description:'写清项目与金额，后续查账更清楚。'};
  if(/记一笔|记录什么/.test(title))return {kind:'record',mark:'plus',label:'快捷记账',description:'选择记录类型，保存本次工资变动。'};
  return {kind:'detail',mark:'file',label:'工资账本',description:'清晰查看金额构成与原始记录。'};
}
const modalHistory=[];
let activeModalContext=null;
function captureModalContext(){return {modalMonth,editingTransaction:{...editingTransaction},editingLeaveId,pendingCleanupPlan,page:pageContext()};}
function stepBackModal(){
 if(closeChoicePicker())return true;const previous=modalHistory.pop();if(!previous)return false;nativeSync?.cancelCleanupReview();
 modalRoot.replaceChildren(previous.shell);if(previous.context){({modalMonth,editingTransaction,editingLeaveId,pendingCleanupPlan}=previous.context);}
 activeModalContext=previous.context;if(previous.context?.page)restorePage(previous.context.page);syncModalViewport();previous.focus?.focus({preventScroll:true});return true;
}
function showModal(title,body,wide=false,update=false){
  if(pageNavigator?.isBusy())pageNavigator.cancel();if(calendarNavigator?.isBusy())calendarNavigator.cancel();
  const prior=modalRoot.firstElementChild;if(!prior)modalOrigin=pageContext();
  if(prior&&document.createDocumentFragment&&prior.querySelector('#modal-title')?.textContent!==title){modalHistory.push({shell:prior,context:activeModalContext,focus:document.activeElement});prior.remove();}

  if(!update)previousFocus=document.activeElement;app.inert=true;document.body.style.overflow='hidden';
  const meta=modalPresentation(title),form=body.match(/<form\b[^>]*\bid="([^"]+)"/),start=body.lastIndexOf('<div class="modal-actions">');
  let content=body,footer='';
  if(start>=0){
    const tail=body.slice(start).trim(),formEnd=tail.endsWith('</div></form>'),plainEnd=tail.endsWith('</div>');
    if(formEnd||plainEnd){
      footer=formEnd?tail.slice(0,-7):tail;
      content=body.slice(0,start)+(formEnd?'</form>':'');
      footer=footer.replace('class="modal-actions"','class="modal-actions modal-footer"');
      if(form)footer=footer.replace(/<button(?=[^>]*type="submit")/g,'<button form="'+form[1]+'"');
    }
  }
  if(update&&prior?.querySelector('#modal-title')?.textContent===title){
   prior.querySelector('.modal-body').innerHTML=content;const oldFooter=prior.querySelector('.modal-footer');if(oldFooter)oldFooter.remove();if(footer)prior.querySelector('.modal').insertAdjacentHTML('beforeend',footer);activeModalContext=captureModalContext();enhanceModalChoices(modalRoot);syncModalViewport();return;
  }
  modalRoot.innerHTML='<div class="modal-overlay"><section class="modal modal-v2 '+(wide?'wide ':'')+'tone-'+meta.kind+'" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"><div class="modal-header"><div class="modal-heading"><span class="modal-icon">'+icon(meta.mark)+'</span><div><span class="modal-kicker">'+meta.label+'</span><h2 id="modal-title">'+esc(title)+'</h2></div></div><button class="icon-button modal-close" data-action="close-modal" aria-label="关闭弹窗">'+icon('close')+'</button></div><p class="modal-description" id="modal-description">'+meta.description+'</p><div class="modal-body">'+content+'</div>'+footer+'</section></div>';
  activeModalContext=captureModalContext();enhanceModalChoices(modalRoot);
  modalRoot.querySelector('.modal-heading')?.insertAdjacentHTML('afterbegin','<button type="button" class="modal-back" data-action="modal-back" aria-label="返回上一级">‹</button>');
  syncModalViewport();queueMicrotask(()=>modalRoot.querySelector('[data-action="modal-back"]')?.focus({preventScroll:true}));
}
function afterModalOpen(){
 const modal=modalRoot.querySelector('.modal');if(!modal||typeof requestAnimationFrame!=='function')return Promise.resolve();
 return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>Promise.allSettled((modal.getAnimations?.()||[]).map(a=>a.finished)).then(resolve))));
}
function closeModal(){
  nativeSync?.cancelCleanupReview();
  closeChoicePicker();modalHistory.length=0;activeModalContext=null;modalOrigin=null;
  modalRoot.innerHTML='';pendingCleanupPlan=null;app.inert=false;document.body.style.overflow='';
  previousFocus?.isConnected&&previousFocus.focus({preventScroll:true});
}
let nativeKeyboardVisible=false;
function syncModalViewport(){
  const layout=window.innerHeight||800,visible=Math.min(layout,window.visualViewport?.height||layout);
  document.documentElement?.style?.setProperty?.('--visible-height',visible+'px');
  document.documentElement?.style?.setProperty?.('--viewport-top',(window.visualViewport?.offsetTop||0)+'px');
  document.body.classList?.toggle('keyboard-open',nativeKeyboardVisible||visible<layout-100);
}
function centerActiveField(){
  const active=document.activeElement,scroller=modalRoot.querySelector('.modal-body');
  if(!active?.getBoundingClientRect||!scroller?.getBoundingClientRect||!active.matches?.('input,select,textarea'))return;
  const a=active.getBoundingClientRect(),s=scroller.getBoundingClientRect();
  scroller.scrollTo({top:scroller.scrollTop+(a.top-s.top)-(s.height-a.height)/2,behavior:'smooth'});
}
globalThis.dagongrenKeyboard=visible=>{nativeKeyboardVisible=!!visible;syncModalViewport();setTimeout(centerActiveField,180);};
window.addEventListener('resize',()=>{syncModalViewport();setTimeout(centerActiveField,180);});
window.visualViewport?.addEventListener('resize',()=>{syncModalViewport();setTimeout(centerActiveField,180);});
document.addEventListener('focusin',event=>{if(event.target.closest?.('.modal-body'))setTimeout(centerActiveField,220);});

function showMonthPicker() {
  pickerYear=+selectedMonth.slice(0,4);renderMonthPicker();
}
function renderMonthPicker() {
  showModal('选择月份',`<div class="month-year"><button class="icon-button" data-action="picker-year" data-delta="-1" aria-label="上一年" ${pickerYear<=2020?'disabled':''}>${icon('left')}</button><span>${pickerYear}年</span><button class="icon-button" data-action="picker-year" data-delta="1" aria-label="下一年" ${pickerYear>=2040?'disabled':''}>${icon('chevron')}</button></div><div class="month-options">${Array.from({length:12},(_,i)=>{const m=`${pickerYear}-${pad(i+1)}`;return `<button class="month-option ${m===selectedMonth?'selected':''}" data-action="choose-month" data-month="${m}" aria-label="${fullMonth(m)}">${i+1}月</button>`;}).join('')}</div><p class="field-note" style="margin-top:20px">每个月单独记账，历史工资不会被新设置覆盖。</p>`);
}
function showSalarySettings() {
  modalMonth=selectedMonth;const r=record(),s=db.defaults;
  showModal('月薪与发薪周期',`<form id="salary-form"><div class="field"><label for="salary">${fullMonth(selectedMonth)}固定月薪</label><div class="money-input"><span>¥</span><input id="salary" name="salary" type="number" min="0" max="10000000" step="0.01" inputmode="decimal" value="${(r.salaryCents/100).toFixed(2)}" required></div><p class="field-note">自然月：固定工资÷当月天数；自定义跨月：固定工资÷完整周期总天数（含起止日）。工资金额按记录所属月份保存，新月份沿用。</p></div><div class="field"><label for="payday">每月发薪日</label><select id="payday" name="payday">${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${s.payday===i+1?'selected':''}>每月${i+1}日</option>`).join('')}</select></div><div class="field"><label for="period-mode">发放工资的时间段</label><select id="period-mode" name="periodMode"><option value="calendar" ${s.periodMode!=='custom'?'selected':''}>上个自然月的工资</option><option value="custom" ${s.periodMode==='custom'?'selected':''}>自定义跨月周期</option></select></div><div class="field" id="period-custom-field" ${s.periodMode!=='custom'?'hidden':''}><label for="period-start">每个周期从每月几号开始</label><select id="period-start" name="periodStartDay">${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${s.periodStartDay===i+1?'selected':''}>每月${i+1}日</option>`).join('')}</select><p class="field-note" id="period-end-label"></p><p class="field-note">结束日自动为下月起始日前一天，保证不漏算、不重复。短月缺少的日期取月末。</p></div><div class="notice gray" id="period-preview"></div><p class="field-note">发薪日用于安排和筛选；工资真正发到手后，通过“发工资”登记。周期调整会按新口径重算计薪并重新分组，已保存的实发区间和金额保留。</p><div class="error" id="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn btn-plain" data-action="modal-back">取消</button><button type="submit" class="btn btn-primary">保存设置</button></div></form>`);updatePeriodPreview();
}


function leaveForm(date='',item=null,month=selectedMonth) {
  modalMonth=month;editingLeaveId=item?.id||null;const r=record(month),chosen=item?.date||date||referenceDate(month),first=month+'-01',last=month+'-'+daysInMonth(month),mode=item?(leaveDeducts(item,db.defaults)?'yes':'no'):'defaults';
  showModal(item?'修改请假':'记请假',`<form id="leave-form">${transactionContext(month)}<div class="fields-row"><div class="field"><label for="leave-start">开始日期</label><input id="leave-start" name="start" type="date" min="${first}" max="${last}" value="${chosen}" required></div><div class="field"><label for="leave-end">结束日期</label><input id="leave-end" name="end" type="date" min="${first}" max="${last}" value="${chosen}" required></div></div><div class="field"><label>请假时长</label><div class="choice-group"><button type="button" class="choice ${item?.days===.5?'selected':''}" data-action="leave-duration" data-value="0.5" aria-pressed="${item?.days===.5}">半天</button><button type="button" class="choice ${item?.days!==.5?'selected':''}" data-action="leave-duration" data-value="1" aria-pressed="${item?.days!==.5}">全天</button></div><input id="leave-duration" name="days" type="hidden" value="${item?.days||1}"></div><div class="field"><label for="leave-deduct">这次请假是否扣款</label><select id="leave-deduct" name="deductMode"><option value="defaults" ${mode==='defaults'?'selected':''}>按各日期默认规则预填</option><option value="yes" ${mode==='yes'?'selected':''}>扣款（本次所选日期全部扣款）</option><option value="no" ${mode==='no'?'selected':''}>不扣款（本次所选日期全部免扣）</option></select><p class="field-note">普通日默认扣款；法定日默认${db.defaults.holidayLeaveDeduct?'扣款':'不扣'}，调休日默认${db.defaults.adjustedLeaveDeduct?'扣款':'不扣'}。保存后每笔独立，“我的”里的默认开关不再改变这笔记录。</p></div><div class="field"><label for="leave-note">备注（选填）</label><input id="leave-note" name="note" maxlength="60" value="${esc(item?.note||'')}" placeholder="例如：个人事务"></div><div class="estimate" id="leave-estimate"></div><p class="field-note">从${r.joinDate}起计薪；未来请假先保存，到该日期才影响累计工资。</p><div class="error" id="form-error" role="alert"></div><div class="modal-actions">${item?`<button type="button" class="btn btn-danger" data-action="confirm-delete-leave" data-id="${esc(item.id)}">删除记录</button>`:'<button type="button" class="btn btn-plain" data-action="modal-back">取消</button>'}<button type="submit" class="btn btn-primary">保存请假</button></div></form>`);updateLeaveEstimate();
}


function getLeaveDraft() {
  const form=document.getElementById('leave-form');if(!form)return {error:'表单不存在'};
  const fd=new FormData(form),start=fd.get('start'),end=fd.get('end'),mode=fd.get('deductMode')||'defaults',days=Number(fd.get('days'));
  if(!validDate(start)||!validDate(end)||start>end)return {error:'请选择有效的开始和结束日期。'};
  if(!start.startsWith(modalMonth+'-')||!end.startsWith(modalMonth+'-'))return {error:'跨自然月请假请分月登记。'};
  if(start<record(modalMonth).joinDate)return {error:'请假日期不能早于该主体的入职日期。'};
  if(![.5,1].includes(days)||!['defaults','yes','no'].includes(mode))return {error:'请选择有效时长和扣款方式。'};
  const dates=datesBetween(start,end);if(dates.length>1&&days===.5)return {error:'半天请假请选择同一天。'};
  const remaining=record(modalMonth).leaves.filter(x=>x.id!==editingLeaveId),duplicate=dates.find(date=>remaining.some(x=>x.date===date));if(duplicate)return {error:shortDate(duplicate)+'已有记录，请编辑原记录。'};
  const note=String(fd.get('note')||'').trim();if(note.length>60)return {error:'备注请控制在60字以内。'};
  const items=dates.map(date=>({id:editingLeaveId&&dates.length===1?editingLeaveId:uid(),date,days,note,deduct:mode==='yes'?true:mode==='no'?false:leaveDeducts({date},db.defaults)}));return {items,remaining,skipped:0,error:''};
}


function updateLeaveEstimate() {
  const el=document.getElementById('leave-estimate');if(!el)return;const draft=getLeaveDraft();if(draft.error){el.innerHTML=`<span>${esc(draft.error)}</span>`;return;}
  const r=record(modalMonth),next=calculateBook({...db.months,[modalMonth]:{...r,leaves:[...draft.remaining,...draft.items]}},db.defaults,today).byMonth[modalMonth],charged=draft.items.filter(x=>x.deduct).reduce((n,x)=>n+x.days,0);
  el.innerHTML=`<span>本次${charged?'计扣'+charged+'天':'不扣款'}<small>截至今天本月已扣 ¥${money(next.deductionCents)}；未来日期尚未计入</small></span><strong class="number">${charged?'约 ¥'+money(draft.items.filter(x=>x.deduct).reduce((sum,x)=>sum+salaryRateForDate(x.date,r.salaryCents,db.defaults).dailyCents*x.days,0)):'不扣款'}</strong>`;
}


function showDay(date) { const item=record().leaves.find(x=>x.date===date);leaveForm(date,item||null); }
function showPayment(month=selectedMonth,id='',periodId='') {showCash('payment',month,id,periodId);}


function showRecordDetail(ref='') {
  const p=currentPeriod(ref);if(!p){showMetric('pending');return;}
  const components=[['base','基本工资',p.baseCents||0],['leave','请假扣薪',p.deductionCents||0],['overtime','加班收入',p.overtimeCents||0],['subsidy','补贴收入',p.subsidyCents||0],['deduction','其他扣款',p.wageDeductionCents||0],['appliedAdvance','预支已抵扣',p.advanceCents],['appliedPayment','工资已抵扣',p.paymentCents]];
  showModal('工资账期结算',`<div class="detail-summary"><span class="status-pill ${p.remainingCents?'unpaid':p.deductionCarryCents?'offset':'paid'}">${p.deductionCarryCents?'有待抵扣扣款':p.end>today?'持续累计中':'账期已结束'}</span><button class="detail-amount-link" ${metricAttrs('pending','period',p.id)}><strong class="number">¥ ${money(p.remainingCents)}</strong>${icon('chevron')}</button><small>该账期待发工资</small></div><div class="period-info"><strong>${esc(p.company||'未命名主体')}</strong><span>${periodName(p)}</span><small>约定${p.dueDate.replaceAll('-','/')}发薪</small></div><div class="period-component-list">${components.map(([key,label,amount])=>`<button ${metricAttrs(key,'period',p.id)}><span>${label}</span><strong class="number">${['leave','deduction'].includes(key)?'− ':''}¥ ${money(amount)}</strong>${icon('chevron')}</button>`).join('')}<button class="sum" ${metricAttrs('earned','period',p.id)}><span>截至${shortDate(today)}净计薪</span><strong class="number">¥ ${money(p.expectedCents)}</strong>${icon('chevron')}</button></div>${p.deductionCarryCents?`<button class="data-notice warning" ${metricAttrs('carry','period',p.id)}>待抵扣扣款 ¥${money(p.deductionCarryCents)}${icon('chevron')}</button>`:''}${p.unappliedCents?`<button class="data-notice" ${metricAttrs('unapplied','period',p.id)}>尚未抵扣收款 ¥${money(p.unappliedCents)}${icon('chevron')}</button>`:''}<div class="notice gray">补贴、扣款按记录日期计入账期。未来日期不提前计薪；真实收款按原结算区间抵扣。</div><div class="modal-actions"><button class="btn btn-plain" ${metricAttrs('earned','period',p.id)}>逐日构成</button><button class="btn btn-primary" data-action="pay-period" data-period="${esc(p.id)}">发工资</button></div>`,true);
}
function showRules() {
  showModal('工资如何计算',`<div class="modal-rule"><div class="formula">每日平均工资＝固定工资 ÷ 所选完整周期总天数（含起止日）<br>净计薪＝基本工资 − 请假扣薪 ＋ 加班 ＋ 补贴 − 其他扣款<br>待发＝该主体、该账期可结算工资 − 对应区间已抵扣收款</div><h3>入职起逐日累计</h3><p>包含入职当天和今天。普通休息日、未登记请假的法定节假日正常累计；未来日期不提前计薪。自然月模式按当月总天数；自定义跨月模式按完整周期总天数。同一工资标准在同一周期内累计后四舍五入到分，完整无请假周期恰好一份固定工资。工资金额按记录所属月份保存；周期内调薪时分别按各段工资标准计算。</p><h3>每笔请假单独决定扣款</h3><p>普通日默认扣款，法定日和调休日使用“我的”中的默认值。每笔都能修改；保存后的选择不会随后改默认值变化。</p><h3>补贴与扣款</h3><p>使用预置项目或自定义名称，按记录日期归属工资账期，到当天生效。补贴增加应计工资，扣款减少应计工资，不等同于实际收付款。扣款超过该账期已计薪部分时，差额作为“待抵扣扣款”保留，仅抵扣同一主体、同一账期后续累计的工资，不跨主体或跨账期自动扣款。</p><h3>发薪与预支</h3><p>真实收到的钱才记预支或发工资。收款按保存时的工资区间从早到晚抵扣；预支不会重复计算。超出已累计工资的收款作为尚待抵扣收款保留。修改工资或扣款会重新分配抵扣，不改写真实收款金额。</p><h3>工资账期</h3><p>自然月模式发放上个自然月工资。自定义模式从每月选定日开始，到下个月起始日前一天结束；缺少的日期取月末，周期连续且不重叠。约定发薪日是期末之后首个对应日期。变更周期会按新口径重算计薪并重新归属扣款，原始收款区间及实际收款金额保留。</p><h3>看懂金额与数据</h3><p>点开净计薪看逐日构成，点开待发看对应账期，点开实收看真实收款。已抵扣按对应计薪日期统计，实收按收款日期统计，两者可能不同。已收录2020—2026年官方放假调休、2020—2040年农历与节气；${isAndroid?'坚果云可在“我的”自行配置。':'坚果云为流程演示。'}</p></div><div class="modal-actions"><button class="btn btn-primary full" data-action="modal-back">明白了</button></div>`,true);
}
function showConnection() {
  if(nativeSync){nativeSync.showConfig();return;}
  showModal('坚果云接入设置',`<div class="notice">本次仅预览连接流程，不收集真实账号或密码，也不会访问你的网盘。</div><div class="field"><label for="server-url">网盘连接地址</label><input id="server-url" value="https://dav.jianguoyun.com/dav/" readonly><p class="field-note">坚果云提供的文件同步地址。</p></div><div class="field"><label for="cloud-account">坚果云账号</label><input id="cloud-account" placeholder="正式版填写你的账号邮箱" disabled></div><div class="field"><label for="cloud-password">应用授权密码</label><input id="cloud-password" placeholder="正式版在手机内填写专用应用密码" disabled><p class="field-note">在坚果云“第三方应用管理”生成，不能用登录密码替代。</p></div><div class="field"><label>账本文件夹</label><div class="day-summary">打工人 / 工资账本</div></div><p class="field-note"><a href="https://help.jianguoyun.com/?p=2064" target="_blank" rel="noopener noreferrer">查看坚果云官方授权说明</a></p><div class="modal-actions"><button class="btn btn-primary" data-action="start-demo">${icon('cloud')}进入同步演示</button></div>`);
}
function addLog(text, name='check') {
  db.sync.logs.unshift({text,icon:name,time:new Date().toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'})});
  db.sync.logs=db.sync.logs.slice(0,20);
}
function ensureDemoCloud() {
  if(!db.sync.cloudDefaults)db.sync.cloudDefaults=copyRecords(db.defaults);
  if(db.sync.cloudMonths === null || db.sync.cloudMonths === undefined) db.sync.cloudMonths=copyRecords(db.months);
}
function hasDemoCloud() { return db.sync.demo && db.sync.cloudMonths !== null && db.sync.cloudMonths !== undefined; }
function syncDataSummary() {
  return `<div class="sync-record-stats"><span>本地 ${Object.keys(db.months).length}个月</span><span>云端演示 ${Object.keys(db.sync.cloudMonths||{}).length}个月</span></div>${db.sync.pausedByCleanup&&!db.sync.auto?'<div class="notice">因单端清理已暂停自动同步。手动同步会再次合并另一端保留的月份。</div>':''}`;
}
function startDemo() {
  db.sync.demo=true;ensureDemoCloud();addLog('已准备独立的云端演示账本，未连接真实网盘','cloud');persist();closeModal();navigateView('sync');render();toast('云端演示已准备，不会访问真实网盘。');
}
function cancelDemoSync() { clearTimeout(syncTimer);clearTimeout(syncRunTimer);syncGeneration++;syncBusy=false; }
function scheduleDemoSync() {
  if(nativeSync){nativeSync.schedule();return;}
  clearTimeout(syncTimer);
  if((db.sync.demo||db.sync.connected)&&db.sync.auto&&!db.sync.offline)syncTimer=setTimeout(()=>runDemoSync('auto'),700);
}
function runDemoSync(source='manual') {
  if(nativeSync)return nativeSync.run('normal',false,{source});
  if(!db.sync.demo){showConnection();return demoReport('attention','请先配置坚果云',source);}
  if(db.sync.offline){toast('演示离线中，请关闭“模拟离线”再试。');return demoReport('error','当前离线，本机记录已保留',source);}
  if(syncBusy)return demoSyncTask;
  ensureDemoCloud();syncBusy=true;const generation=++syncGeneration;demoReport('syncing','正在同步',source);render();
  demoSyncTask=new Promise(resolve=>{syncRunTimer=setTimeout(()=>{
    if(generation!==syncGeneration){resolve(demoReport('attention','同步已暂停',source));return;}
    syncBusy=false;
    if(db.sync.offline){addLog('演示同步暂停，修改留在本机','wifi');persist();render();resolve(demoReport('error','当前离线，本机记录已保留',source));return;}
    const merged=mergeDemoRecords(db.months,db.sync.cloudMonths);
    db.months=copyRecords(merged);db.sync.cloudMonths=copyRecords(merged);db.sync.cloudDefaults=copyRecords(db.defaults);
    db.sync.pending=0;db.sync.last=Date.now();addLog('本地与云端演示账本已合并，未上传数据');persist();render();resolve(demoReport('success','演示同步完成，未上传真实云端',source));
  },1000);});return demoSyncTask;
}
function cleanupLabel(options) { return options.scope==='all'?'全部账本':options.scope==='year'?options.year+'年':fullMonth(options.month); }
function cleanupTargetLabel(target) { return target==='local'?'本地':target==='cloud'?'云端（演示）':'本地与云端（演示）'; }
function cleanupCountText(count) {
  return `${count.months}个月 · 请假${count.leaves}笔 · 预支${count.advances}笔 · 加班${count.overtime}笔 · 补贴${count.subsidies||0}笔 · 扣款${count.deductions||0}笔 · 发工资${count.paid}笔`;
}
function openCleanup() {
  cleanupDraft={scope:'month',target:'local',month:selectedMonth,year:selectedMonth.slice(0,4)};cleanupNotice='';pendingCleanupPlan=null;navigateView('cleanup');closeModal();render();window.scrollTo({top:0});
}
function cleanupScopeCards(scope){
 const choices=[['month','calendar','按月份','指定一个月'],['year','history','按年份','指定一整年'],['all','trash','全部记录','所有账本月份']];
 return '<div class="cleanup-scope-label" id="cleanup-scope-label">选择清理范围</div><select id="cleanup-scope" class="native-select-bridge" tabindex="-1" aria-hidden="true">'+choices.map(([key,,label])=>'<option value="'+key+'" '+(key===scope?'selected':'')+'>'+label+'</option>').join('')+'</select><div class="cleanup-scope-cards" role="group" aria-labelledby="cleanup-scope-label">'+choices.map(([key,mark,title,note])=>'<button type="button" class="cleanup-scope-card" data-action="cleanup-scope" data-scope="'+key+'" aria-pressed="'+(scope===key)+'">'+icon(mark)+'<strong>'+title+'</strong><small>'+note+'</small><span class="scope-check" aria-hidden="true">✓</span></button>').join('')+'</div>';
}
function cleanupView() {
  if(isAndroid)return nativeCleanupView();
  const cloud=db.sync.cloudMonths||{};
  const totals=makeCleanupPlan(db.months,cloud,{scope:'all',target:'both'});
  const years=[...new Set([selectedMonth.slice(0,4),cleanupDraft.year,...Object.keys(db.months).map(m=>m.slice(0,4)),...Object.keys(cloud).map(m=>m.slice(0,4))])].sort().reverse();
  let plan,error='';try{plan=makeCleanupPlan(db.months,cloud,cleanupDraft);}catch(e){error=e.message;}
  const needsCloud=cleanupDraft.target!=='local',ready=hasDemoCloud(),blocked=storageBlocked||(needsCloud&&(!ready||db.sync.offline));
  const count=plan?plan.local.months+plan.cloud.months:0;
  return `<button class="btn btn-ghost" data-action="page-back">${icon('left')}返回上一级</button><div class="cleanup-intro"><h2>清理内存</h2><p>清理工资账本记录，主体、计薪设置与扣款开关保留。</p></div>
    ${cleanupNotice?`<div class="notice cleanup-success" role="status">${esc(cleanupNotice)}</div>`:''}
    <div class="notice gray">本地清理会删除当前浏览器的账本。云端清理仅作用于独立演示账本，不访问真实坚果云。</div>
    <div class="cleanup-grid"><section class="panel"><div class="section-header"><h2>按范围清理</h2><span class="muted small">先选范围，再核对数量</span></div>
      ${cleanupScopeCards(cleanupDraft.scope)}
      ${cleanupDraft.scope==='month'?`<div class="field"><label for="cleanup-month">选择月份</label><input id="cleanup-month" type="month" min="2020-01" max="2040-12" value="${esc(cleanupDraft.month)}"></div>`:cleanupDraft.scope==='year'?`<div class="field"><label for="cleanup-year">选择年份</label><select id="cleanup-year">${years.map(y=>`<option value="${y}" ${y===cleanupDraft.year?'selected':''}>${y}年</option>`).join('')}</select></div>`:''}
      <div class="field"><label>清理位置</label><div class="choice-group cleanup-targets" role="group" aria-label="清理位置">${[['local','本地'],['cloud','云端（演示）'],['both','一并清理']].map(([key,label])=>`<button class="choice ${cleanupDraft.target===key?'selected':''}" data-action="cleanup-target" data-target="${key}" aria-pressed="${cleanupDraft.target===key}">${label}</button>`).join('')}</div></div>
      ${!ready?`<div class="cleanup-cloud-hint"><span>云端演示尚未准备。</span><button data-action="prepare-cleanup-demo">准备云端演示${icon('arrow')}</button></div>`:db.sync.offline?'<div class="notice">云端演示处于离线状态，请在同步设置中模拟联网后再清理云端数据。</div>':''}
      <div class="cleanup-counts">${cleanupDraft.target!=='cloud'?`<div><span>将清理本地</span><strong>${plan?cleanupCountText(plan.local):'—'}</strong></div>`:''}${cleanupDraft.target!=='local'?`<div><span>将清理云端（演示）</span><strong>${ready&&plan?cleanupCountText(plan.cloud):'尚未准备演示'}</strong></div>`:''}</div>
      ${error?`<div class="error" role="alert">${esc(error)}</div>`:''}${storageBlocked?'<div class="error">当前浏览器存储不可用，无法保存清理结果。请下载文件后用浏览器打开。</div>':''}
      <button class="btn btn-danger full" data-action="review-cleanup" ${blocked||!count?'disabled':''}>${icon('trash')}核对并清理所选数据</button>${!count&&!error?'<p class="field-note">当前范围没有可清理记录。</p>':''}
      <p class="field-note">只清理一端时，如已开启同步演示，会暂停自动同步。手动同步可能将另一端保留的月份重新合并回来。</p>
    </section><div><section class="panel"><div class="section-header"><h2>一键清理</h2><span class="muted small">清理前会再次确认</span></div>
      <button class="setting-row cleanup-quick" data-action="quick-cleanup" data-target="local" ${storageBlocked||!totals.local.months?'disabled':''}><span class="setting-icon">${icon('phone')}</span><span class="setting-text"><strong>一键清理全部本地数据</strong><p>${cleanupCountText(totals.local)}</p></span>${icon('chevron')}</button>
      <button class="setting-row cleanup-quick" data-action="quick-cleanup" data-target="cloud" ${storageBlocked||!ready||db.sync.offline||!totals.cloud.months?'disabled':''}><span class="setting-icon">${icon('cloud')}</span><span class="setting-text"><strong>一键清理全部云端数据（演示）</strong><p>${ready?cleanupCountText(totals.cloud):'先准备云端演示'}</p></span>${icon('chevron')}</button>
      <button class="setting-row cleanup-quick" data-action="quick-cleanup" data-target="both" ${storageBlocked||!ready||db.sync.offline||!totals.local.months&&!totals.cloud.months?'disabled':''}><span class="setting-icon">${icon('trash')}</span><span class="setting-text"><strong>本地与云端一并清理（演示）</strong><p>清理两端的全部年份和月份</p></span>${icon('chevron')}</button>
    </section><section class="panel cleanup-backup"><div class="section-header"><h2>清理前，留一份备份</h2></div><p>可先导出本地工资账本，核对后再清理。</p><button class="btn btn-plain full" data-action="export">${icon('download')}导出本地账本</button></section></div></div>`;
}

function nativeCleanupView(){
 const options={...cleanupDraft,target:'local'},plan=makeCleanupPlan(db.months,{},options),years=[...new Set([cleanupDraft.year,...Object.keys(db.months).map(m=>m.slice(0,4))])].sort().reverse();
 const includeCloud=cleanupDraft.target==='both',connected=!!nativeSync?.configured(),busy=!!nativeSync?.isBusy();
 const cloudOption='<label class="cleanup-cloud-option '+(includeCloud?'selected':'')+'"><input id="cleanup-include-cloud" type="checkbox" '+(includeCloud?'checked':'')+' '+(!connected||busy?'disabled':'')+'><span><strong>同时清理云端对应记录</strong><small>'+(connected?'按相同范围清理打工人云端账本，下一步核对两端数量。':'配置坚果云后可选；默认只清理本机。')+'</small></span></label>';
 const range=options.scope==='month'?fullMonth(options.month):options.scope==='year'?options.year+'年':'全部账本记录';
 const period=options.scope==='month'?'<div class="field"><label for="cleanup-month">选择月份</label><input id="cleanup-month" type="month" min="2020-01" max="2040-12" value="'+esc(options.month)+'"></div>':options.scope==='year'?'<div class="field"><label for="cleanup-year">选择年份</label><select id="cleanup-year">'+years.map(y=>'<option value="'+y+'" '+(y===options.year?'selected':'')+'>'+y+'年</option>').join('')+'</select></div>':'';
 return '<button class="btn btn-plain" data-action="page-back">'+icon('left')+'返回上一级</button><section class="panel cleanup-panel" style="margin-top:18px"><div class="cleanup-page-title"><span>'+icon('trash')+'</span><div><h2>'+(includeCloud?'清理本机及云端':'清理本机记录')+'</h2><p>按需整理，先核对再清理</p></div></div><p class="cleanup-explain">'+(includeCloud?'两端仅清理所选范围，默认工资设置和范围外记录保留。':'默认只清理本机，网盘账本保留。')+''+(includeCloud?'自动同步开关保持原选择。':'清理后关闭自动同步，避免云端记录立即恢复。')+'</p>'+cleanupScopeCards(options.scope)+period+cloudOption+'<div class="cleanup-selection-note">'+icon('info')+'<div><strong>'+esc(range)+'</strong><p>将清理 '+cleanupCountText(plan.local)+'</p></div></div><div class="modal-actions"><button class="btn btn-plain" data-action="export">'+icon('download')+'导出账本</button><button class="btn btn-danger" data-action="review-cleanup" '+(storageBlocked||busy||(!includeCloud&&!plan.local.months)?'disabled':'')+'>核对清理范围'+icon('chevron')+'</button></div>'+(cleanupNotice?'<p class="field-note">'+esc(cleanupNotice)+'</p>':'')+'</section>';
}

function prepareCleanupDemo() {
  db.sync.demo=true;ensureDemoCloud();addLog('云端演示已准备，可体验清理，不访问真实网盘','cloud');persist();render();toast('已复制一份独立的演示账本，未上传数据。');
}
function reviewCleanup(options=cleanupDraft) {
  if(nativeSync&&options.target==='both'){nativeSync.reviewCleanup(options);return;}
  if(nativeSync&&nativeSync.isBusy()){toast('请等待当前网盘操作完成。');return;}
  if(nativeSync&&options.target!=='local'){toast('请选择本机或本机与云端一并清理。');return;}
  if(storageBlocked){toast('存储不可用，当前不能保存清理结果。');return;}
  if(options.target!=='local'&&!hasDemoCloud()){toast('请先准备云端演示。');return;}
  if(options.target!=='local'&&db.sync.offline){toast('云端演示处于离线状态，请先模拟联网。');return;}
  let plan;try{plan=makeCleanupPlan(db.months,db.sync.cloudMonths||{},options);}catch(e){toast(e.message);return;}
  if(!plan.local.months&&!plan.cloud.months){toast('所选范围没有可清理记录。');return;}
  pendingCleanupPlan=plan;
  const keys=[...new Set([...plan.localKeys,...plan.cloudKeys])].sort();
  const months=keys.slice(0,12).map(fullMonth).join('、')+(keys.length>12?`等，共${keys.length}个月份`:'');
  showModal('确认清理这些数据？',`<div class="notice">将删除所选月份的工资、请假、预支、加班、补贴、扣款和发放记录。请核对清理范围。</div><div class="detail-line"><span>清理范围</span><strong>${esc(cleanupLabel(options))}</strong></div><div class="detail-line"><span>清理位置</span><strong>${cleanupTargetLabel(options.target)}</strong></div>${options.target!=='cloud'?`<div class="detail-line"><span>本地记录</span><strong>${cleanupCountText(plan.local)}</strong></div>`:''}${options.target!=='local'?`<div class="detail-line"><span>云端演示记录</span><strong>${cleanupCountText(plan.cloud)}</strong></div>`:''}<div class="cleanup-month-list">${esc(months)}</div><p class="field-note">主体、计薪设置和扣款开关保留。${options.target!=='both'&&db.sync.demo?'清理后暂停自动同步，避免另一端立即恢复或重新上传记录。':''}${options.target!=='local'?'云端操作仅为演示，不会删除真实网盘文件。':''}</p><div class="error" id="cleanup-error" role="alert"></div><div class="modal-actions"><button class="btn btn-plain" data-action="modal-back">取消</button><button class="btn btn-danger" data-action="confirm-cleanup">确认清理</button></div>`);
}
function storedBookMatches() {
  const raw=localStorage.getItem(STORAGE);if(!raw)return true;
  const stored=JSON.parse(raw);
  const normalized=value=>({version:value.version,defaults:{...defaultSettings,...value.defaults},months:value.months,excludedMonths:value.excludedMonths||[],sync:{...seed().sync,...value.sync,cloudMonths:value.sync?.cloudMonths??null}});
  return canonicalJSON(normalized(stored))===canonicalJSON(normalized(db));
}
function confirmCleanup() {
  const plan=pendingCleanupPlan;if(!plan)return;
  const error=document.getElementById('cleanup-error');
  try {
    if(plan.options.target!=='local'&&(!hasDemoCloud()||db.sync.offline))throw new Error('云端演示尚未准备或处于离线，未清理任何数据。');
    if(!storedBookMatches())throw new Error('账本已在其他页面更新，请刷新后重新选择清理范围。');
    const cleaned=applyCleanupPlan(db.months,db.sync.cloudMonths||{},plan);
    const next=JSON.parse(JSON.stringify(db));next.months=cleaned.local;if(plan.options.target!=='cloud')next.excludedMonths=[...new Set([...(next.excludedMonths||[]),...plan.localKeys])];
    if(plan.options.target!=='local')next.sync.cloudMonths=cleaned.cloud;
    if(plan.options.target!=='both'&&(next.sync.demo||next.sync.connected)){next.sync.auto=false;next.sync.pausedByCleanup=true;next.sync.cleanupTarget='local';next.sync.pending=0;}
    const parts=[];if(plan.options.target!=='cloud')parts.push(`本地${plan.local.months}个月`);if(plan.options.target!=='local')parts.push(`云端演示${plan.cloud.months}个月`);
    const message=`已清理${cleanupLabel(plan.options)}：${parts.join('，')}。`;
    next.sync.logs.unshift({text:message,icon:'trash',time:new Date().toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'})});next.sync.logs=next.sync.logs.slice(0,20);
    rememberDeletions(next,persistedBook,Date.now().toString(36));localStorage.setItem(STORAGE,JSON.stringify(next));persistedBook=snapshotBook(next);
    if(nativeSync)nativeSync.beforeCleanup();
    cancelDemoSync();db=next;pendingCleanupPlan=null;cleanupNotice=message;view='cleanup';closeModal();render();toast(message);
    if(plan.options.target==='both'&&db.sync.auto&&db.sync.pending&&!db.sync.offline)scheduleDemoSync();
  } catch(e) { if(error)error.textContent=/[\u4e00-\u9fff]/.test(e.message||'')?e.message:'无法保存清理结果，未清理任何数据。'; }
}
function emptyMonthView() {return `<section class="panel empty-month"><span class="empty-month-icon">${icon('history')}</span><h2>这个月还没有账本记录</h2><p>已清理的月份不会自动重建。点击下方按钮可重新开始该月计薪与记账。</p><button class="btn btn-primary" data-action="create-month">开始记录本月工资</button></section>`;}


function exportBook() {
  const headers=['记录类型','记录所属月份','主体','入职日期','记录日期','工资区间开始','工资区间结束','约定发薪日','月薪（元）','已计薪天数','累计工资（元）','待发工资（元）','实际收款（元）','请假天数','本笔是否扣款','加班数量','加班单价（元）','备注','记录编号','项目名称','补贴金额（元）','扣款金额（元）','本笔生效状态','待抵扣扣款（元）'],rows=[headers],amt=n=>(n/100).toFixed(2),b=bookSummary();
  for(const [m,r] of Object.entries(db.months).sort(([a],[c])=>a.localeCompare(c))){const c=calculated(m),row=Array(headers.length).fill('');row[0]='自然月累计';row[1]=m;row[2]=r.company||'';row[3]=r.joinDate;row[8]=amt(c.salaryCents);row[9]=c.accruedDays;row[10]=amt(c.expectedCents);row[11]=amt(c.remainingCents);row[20]=amt(c.subsidyCents);row[21]=amt(c.wageDeductionCents);row[23]=amt(c.deductionCarryCents);rows.push(row);for(const item of allLedgerEntries(m)){const d=Array(headers.length).fill('');d[0]={leave:'请假',overtime:'加班',subsidy:'补贴',deduction:'扣款',advance:'预支',payment:'发工资'}[item.kind];d[1]=m;d[2]=item.company??r.company??'';d[3]=r.joinDate;d[4]=item.date;d[5]=item.periodStart||'';d[6]=item.periodEnd||'';d[12]=['payment','advance'].includes(item.kind)?amt(item.amountCents):'';d[13]=item.kind==='leave'?item.days:'';d[14]=item.kind==='leave'?(leaveDeducts(item,r)?'扣款':'不扣款'):'';d[15]=item.kind==='overtime'?item.quantity||'自定义':'';d[16]=item.kind==='overtime'?item.rateCents?amt(item.rateCents):'':'';d[17]=(item.kind==='overtime'?'加班费'+amt(overtimeAmount(item))+'元；':'')+(item.note||'');d[18]=item.id;d[19]=item.category||'';d[20]=item.kind==='subsidy'?amt(item.amountCents):'';d[21]=item.kind==='deduction'?amt(item.amountCents):'';d[22]=item.date>today?'未到日期':!['payment','advance'].includes(item.kind)&&item.date<r.joinDate?'入职前不计薪':'已生效';rows.push(d);}}
  for(const p of b.periods){const row=Array(headers.length).fill('');row[0]='发薪账期';row[2]=p.company;row[5]=p.start;row[6]=p.end;row[7]=p.dueDate;row[9]=p.accruedDays;row[10]=amt(p.expectedCents);row[11]=amt(p.remainingCents);row[17]='已抵扣'+amt(p.receivedCents)+'元（含预支）';row[20]=amt(p.subsidyCents);row[21]=amt(p.wageDeductionCents);row[23]=amt(p.deductionCarryCents);rows.push(row);}
  const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"',csv='\ufeff'+rows.map(row=>row.map(x=>quote(typeof x==='string'&&/^[=+\-@]/.test(x)?"'"+x:x)).join(',')).join('\r\n'),filename='打工人-工资与补贴扣款账本.csv';if(isAndroid){AndroidFiles.saveFile(filename,'text/csv',csv);return;}const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),link=document.createElement('a');link.href=url;link.download='打工人-工资与补贴扣款账本.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出工资账期、补贴、扣款及全部逐笔记录。');
}
function allLedgerEntries(month) {
  const r=record(month);return [...r.leaves.map(x=>({...x,kind:'leave'})),...(r.overtime||[]).map(x=>({...x,kind:'overtime'})),...(r.subsidies||[]).map(x=>({...x,kind:'subsidy'})),...(r.deductions||[]).map(x=>({...x,kind:'deduction'})),...(r.advances||[]).map(x=>({...x,kind:'advance'})),...wagePayments(r).map(x=>({...x,kind:'payment'}))].sort((a,b)=>b.date.localeCompare(a.date));
}
function journalEntries(month='') {
 return Object.keys(db.months).flatMap(ownerMonth=>allLedgerEntries(ownerMonth).map(item=>({...item,ownerMonth}))).filter(item=>!month||item.date.startsWith(month+'-')).sort((a,b)=>b.date.localeCompare(a.date));
}
function ledgerEntryRows(month,filter='all',limit=Infinity,date='') {
  const types={leave:['请假','leave'],overtime:['加班','clock'],subsidy:['补贴','plus'],deduction:['扣款','minus'],advance:['预支','wallet'],payment:['发工资','money']};
  return journalEntries(month).filter(x=>(filter==='all'||x.kind===filter)&&(!date||x.date===date)).slice(0,limit).map(item=>{const [name,mark]=types[item.kind],owner=item.ownerMonth;let amount='',meta='';if(item.kind==='leave'){const daily=calculated(owner).daily.find(x=>x.date===item.date);amount=leaveDeducts(item,record(owner))?(daily?'− ¥'+money(daily.leaveDeductionCents):'预计 − ¥'+money(salaryRateForDate(item.date,record(owner).salaryCents,db.defaults).dailyCents*item.days)):'不扣款';meta=item.days+'天 · '+(item.date>today?'未到日期':'已到日期');}else if(item.kind==='overtime'){amount='＋ ¥'+money(overtimeAmount(item));meta=item.mode==='custom'?'自定义金额':item.quantity+(item.mode==='hour'?'小时':'天')+' × ¥'+money(item.rateCents);}else if(['subsidy','deduction'].includes(item.kind)){amount=(item.kind==='subsidy'?'＋':'−')+' ¥'+money(item.amountCents);meta=item.category;}else{amount='实收 ¥'+money(item.amountCents);meta=(item.periodStart||owner+'-01')+' 至 '+(item.periodEnd||owner+'-'+daysInMonth(owner));}return `<button class="ledger-entry ${item.kind}" data-action="edit-entry" data-kind="${item.kind}" data-month="${owner}" data-id="${esc(item.id)}"><span class="ledger-icon">${icon(mark)}</span><span class="ledger-info"><strong>${name}<small>${shortDate(item.date)}</small></strong><span>${esc(meta)}${item.date>today?' · 未生效':''}</span>${item.note?`<p>${esc(item.note)}</p>`:''}</span><span class="ledger-amount number">${amount}</span></button>`;}).join('');
}
function showRecordEntry(month=selectedMonth) {
  modalMonth=month;showModal('记一笔',`<div class="record-entry-heading"><p>每次变动，一处记录。工资与明细自动更新。</p><div class="field"><label for="entry-month">工资记录所属自然月</label><input id="entry-month" type="month" min="2020-01" max="2040-12" value="${month}"></div></div><div class="record-entry-menu">${[['leave','leave','记请假','本次可选扣款或不扣'],['overtime','clock','记加班','按小时、按天或自定义'],['subsidy','plus','记补贴','常用项目 / 自定义'],['deduction','minus','记扣款','常用项目 / 自定义'],['advance','wallet','记预支','实收一次，抵扣一次'],['payment','money','发工资','按账期核对实际收款']].map(([kind,mark,name,sub])=>`<button data-action="record-kind" data-kind="${kind}" data-month="${month}"><span class="entry-kind-icon ${kind}">${icon(mark)}</span><span><strong>${name}</strong><small>${sub}</small></span>${icon('chevron')}</button>`).join('')}</div>`);
}
function openRecordKind(kind,month=selectedMonth,id='',date='') {
  if(!validMonth(month)||!['leave','overtime','advance','payment','subsidy','deduction'].includes(kind))return;
  entryDate=validDate(date)?date:'';selectedMonth=month;render();if(kind==='leave'){const item=record(month).leaves.find(x=>x.id===id);leaveForm(item?.date||entryDate||'',item||null,month);}else if(kind==='overtime')showOvertime(month,id);else if(['subsidy','deduction'].includes(kind))showAdjustment(kind,month,id);else showCash(kind,month,id);
}
function transactionContext(month) {
  return `<div class="transaction-context"><span>${icon('calendar')}${fullMonth(month)}工资</span><button type="button" data-action="record-entry" data-month="${month}">切换记录${icon('down')}</button></div>`;
}

function transactionActions(item,kind) {
  return `<div class="error" id="form-error" role="alert"></div><div class="modal-actions">${item?`<button type="button" class="btn btn-danger" data-action="confirm-delete-entry" data-kind="${kind}" data-month="${modalMonth}" data-id="${esc(item.id)}">删除记录</button>`:'<button type="button" class="btn btn-plain" data-action="modal-back">取消</button>'}<button class="btn btn-primary" type="submit">${item?'保存修改':'保存记录'}</button></div>`;
}

function showCash(kind,month=selectedMonth,id='',periodId='') {
  modalMonth=month;const r=record(month),advance=kind==='advance',item=(advance?r.advances||[]:wagePayments(r)).find(x=>x.id===id),ranges=cashRanges(month),chosen=ranges.find(x=>x.id===periodId)||ranges.find(x=>x.all&&x.company===(db.defaults.company||''))||ranges[0];editingTransaction={kind,id,periodId:chosen.id};
  const amount=item?.amountCents??(advance?null:chosen.remainingCents);
  showModal(item?'修改'+(advance?'预支':'发工资记录'):advance?'记预支':'发工资',`<form id="${advance?'advance':'payment'}-form">${item?`<div class="notice gray">原结算区间：${item.periodStart||month+'-01'} 至 ${item.periodEnd||month+'-'+daysInMonth(month)}。修改实收金额后重新抵扣。</div>`:`<div class="field"><label for="cash-period">本次发放哪个区间的工资</label><select id="cash-period" name="periodId">${ranges.map(p=>`<option data-company="${esc(p.company||'未命名主体')}" data-start="${p.start}" data-end="${p.end}" data-title="${esc(cashPeriodTitle(p))}" data-cents="${p.remainingCents}" data-amount="${money(p.remainingCents)}" value="${esc(p.id)}" ${p.id===chosen.id?'selected':''}>${esc(p.company||'未命名主体')} · ${p.all?'全部累计待发':periodName(p)} · 待发¥${money(p.remainingCents)}</option>`).join('')}</select></div><div class="notice gray cash-period-preview" id="cash-period-summary"><span>本区间待发</span><strong class="number">¥ ${money(chosen.remainingCents)}</strong><small>截至今天，未来日期的工资尚未计入</small></div>`}<div class="field"><label for="cash-amount">${advance?'本次实际预支':'本次实际发到手'}金额</label><div class="money-input"><span>¥</span><input id="cash-amount" name="amount" type="number" min="0.01" max="10000000" step="0.01" inputmode="decimal" value="${amount===null||amount===0?'':(amount/100).toFixed(2)}" placeholder="0.00" required></div></div><div class="field"><label for="cash-date">实际收款日期</label><input id="cash-date" name="date" type="date" min="2020-01-01" max="${today}" value="${item?.date||today}" required></div><div class="field"><label for="cash-note">备注（选填）</label><input id="cash-note" name="note" maxlength="80" value="${esc(item?.note||'')}" placeholder="例如：银行卡实发、现金预支"></div><p class="field-note">仅按真实收到的钱登记。按原结算区间内的计薪日期先后抵扣；超出已累计部分的收款在对应区间继续抵扣，预支不必重复登记。</p>${transactionActions(item,kind)}</form>`);
}


function showOvertime(month=selectedMonth,id='') {
  modalMonth=month;editingTransaction={kind:'overtime',id};const item=(record(month).overtime||[]).find(x=>x.id===id),mode=item?.mode||'hour';
  showModal(item?'修改加班记录':'记录加班',`<form id="overtime-form">${transactionContext(month)}<div class="field"><label for="overtime-mode">计算方式</label><select id="overtime-mode" name="mode"><option value="hour" ${mode==='hour'?'selected':''}>按小时 · 时长 × 每小时单价</option><option value="day" ${mode==='day'?'selected':''}>按天 · 天数 × 每天单价</option><option value="custom" ${mode==='custom'?'selected':''}>自定义 · 直接填写本次加班费</option></select></div><div class="fields-row" id="overtime-rate-fields" ${mode==='custom'?'hidden':''}><div class="field"><label id="quantity-label" for="overtime-quantity">加班${mode==='day'?'天数':'小时数'}</label><input id="overtime-quantity" name="quantity" type="number" min="0.01" max="${mode==='day'?31:744}" step="0.01" inputmode="decimal" placeholder="例如：2.5" value="${item?.quantity??''}"></div><div class="field"><label id="rate-label" for="overtime-rate">每${mode==='day'?'天':'小时'}多少钱（元）</label><input id="overtime-rate" name="rate" type="number" min="0.01" max="10000000" step="0.01" inputmode="decimal" placeholder="例如：30" value="${item?.rateCents?(item.rateCents/100).toFixed(2):''}"></div></div><div class="field" id="overtime-custom-field" ${mode!=='custom'?'hidden':''}><label for="overtime-amount">自定义加班费（元）</label><input id="overtime-amount" name="amount" type="number" min="0.01" max="10000000" step="0.01" inputmode="decimal" placeholder="填写本次约定的金额" value="${mode==='custom'?(item.amountCents/100).toFixed(2):''}"></div><div class="field"><label for="overtime-date">加班记录日期</label><input id="overtime-date" name="date" type="date" min="${month}-01" max="${month}-${daysInMonth(month)}" value="${item?.date||defaultEntryDate(month)}" required></div><div class="field"><label for="overtime-note">备注（选填）</label><input id="overtime-note" name="note" maxlength="80" placeholder="比如：晚班赶工、周末补班" value="${esc(item?.note||'')}"></div><div class="estimate" id="overtime-estimate"><span>本次加班收入</span><strong>填写后自动计算</strong></div><p class="field-note">按你填写的约定单价计算，不自动套用倍数；计入本月应发，实际收到时再发工资。</p>${transactionActions(item,'overtime')}</form>`);
  updateOvertimeEstimate();
}

function readMoney(value, label='金额') {
  const raw=String(value??'').trim();
  if(!/^\d+(\.\d{1,2})?$/.test(raw)||Number(raw)<=0||Number(raw)>10000000)throw new Error(label+'请输入大于0、最多两位小数的金额（不超过1000万元）。');
  return Math.round(Number(raw)*100);
}

function getOvertimeDraft(fd) {
  const mode=fd.get('mode'),date=fd.get('date');if(!validDate(date)||!date.startsWith(modalMonth+'-'))throw new Error('加班日期请选择记录所属自然月内的日期。');if(date<record(modalMonth).joinDate)throw new Error('加班日期不能早于该主体的入职日期。');
  const base={id:editingTransaction.id||uid(),mode,date,note:String(fd.get('note')||'').trim()};if(mode==='custom')return {...base,amountCents:readMoney(fd.get('amount'),'加班费')};if(!/^\d+(\.\d{1,2})?$/.test(String(fd.get('quantity'))))throw new Error('加班数量最多两位小数。');const item={...base,quantity:Number(fd.get('quantity')),rateCents:readMoney(fd.get('rate'),'加班单价')};if(!overtimeAmount(item))throw new Error('加班金额不足0.01元。');return item;
}


function updateOvertimeEstimate() {
  const form=document.getElementById('overtime-form');if(!form)return;
  const mode=new FormData(form).get('mode')||'hour',custom=mode==='custom';
  document.getElementById('overtime-rate-fields').hidden=custom;document.getElementById('overtime-custom-field').hidden=!custom;
  document.getElementById('overtime-quantity').disabled=custom;document.getElementById('overtime-rate').disabled=custom;document.getElementById('overtime-amount').disabled=!custom;
  const fd=new FormData(form);
  document.getElementById('quantity-label').textContent='加班'+(mode==='day'?'天数':'小时数');document.getElementById('rate-label').textContent='每'+(mode==='day'?'天':'小时')+'多少钱（元）';
  document.getElementById('overtime-quantity').max=mode==='day'?31:744;
  try {const amount=overtimeAmount(getOvertimeDraft(fd));document.getElementById('overtime-estimate').innerHTML=`<span>本次加班收入<small>将计入本月应发工资</small></span><strong class="number">＋ ¥ ${money(amount)}</strong>`;}catch{document.getElementById('overtime-estimate').innerHTML='<span>本次加班收入</span><strong>填写后自动计算</strong>';}
}

function confirmDeleteEntry(kind,month,id) {
  const item=allLedgerEntries(month).find(x=>x.kind===kind&&x.id===id);if(!item)return;const name={advance:'预支',payment:'发工资',overtime:'加班',subsidy:'补贴',deduction:'扣款'}[kind];
  showModal('删除这笔'+name+'？',`<p class="modal-rule">删除后重新计算相应日期的计薪、收款抵扣和全部待发余额。</p><div class="modal-actions"><button class="btn btn-plain" data-action="modal-back">取消</button><button class="btn btn-danger" data-action="delete-entry" data-kind="${kind}" data-month="${month}" data-id="${esc(id)}">确认删除</button></div>`);
}
function deleteEntry(kind,month,id) {
  const r=record(month),key={advance:'advances',payment:'payments',overtime:'overtime',subsidy:'subsidies',deduction:'deductions'}[kind];if(!key)return;const next={...r};if(kind==='payment'&&id==='legacy-payment')next.payment=null;else next[key]=(r[key]||[]).filter(x=>x.id!==id);db.months[month]=next;closeModal();changed('记录已删除，全部待发工资已更新。');
}
function saveLedgerForm(formId,fd,error) {
  try{
    const kind={'advance-form':'advance','payment-form':'payment','overtime-form':'overtime','subsidy-form':'subsidy','deduction-form':'deduction'}[formId];if(!kind)return;
    let month=modalMonth,r=record(month),key={advance:'advances',payment:'payments',overtime:'overtime',subsidy:'subsidies',deduction:'deductions'}[kind],previous=(kind==='payment'?wagePayments(r):r[key]||[]).find(x=>x.id===editingTransaction.id),item;
    if(kind==='overtime')item=getOvertimeDraft(fd);
    else if(['subsidy','deduction'].includes(kind))item=getAdjustmentDraft(kind,fd);
    else {const date=fd.get('date');if(!validDate(date)||date>today)throw new Error('请填写不晚于今天的实际收款日期。');const range=previous?{start:previous.periodStart||month+'-01',end:previous.periodEnd||month+'-'+daysInMonth(month),company:previous.company??r.company??''}:cashRanges(month).find(p=>p.id===(fd.get('periodId')||editingTransaction.periodId));if(!range)throw new Error('请选择有效的工资结算区间。');if(!previous){month=validMonth(range.start.slice(0,7))?range.start.slice(0,7):db.defaults.joinDate.slice(0,7);r=record(month);}item={id:previous?.id||uid(),date,amountCents:readMoney(fd.get('amount')),note:String(fd.get('note')||'').trim(),periodStart:range.start,periodEnd:range.end,company:range.company};}
    if(item.note.length>80)throw new Error('备注请控制在80字以内。');const next={...r};if(kind==='payment'&&item.id==='legacy-payment')next.payment=item;else next[key]=previous?(r[key]||[]).map(x=>x.id===item.id?item:x):[...(r[key]||[]),item];calculate(month,next,today);db.months[month]=next;recordYear=month.slice(0,4);closeModal();changed('已保存，计薪、明细与待发余额已更新。');
  }catch(e){error.textContent=e.message;}
}
function bookSummary() { return bookCache||(bookCache=calculateBook(db.months,db.defaults,today)); }

function periodName(p) { return p.start.replaceAll('-','/')+' — '+p.end.replaceAll('-','/'); }

function referenceDate(month=selectedMonth) { return today.startsWith(month)?today:month+'-'+daysInMonth(month); }

function currentPeriod(ref='') {
  const b=bookSummary();if(ref.includes('|')){const existing=b.periods.find(p=>p.id===ref);if(existing)return existing;const [start,encoded]=ref.split('|');if(!validDate(start))return;let company;try{company=decodeURIComponent(encoded);}catch{return;}const range=payPeriodForDate(start,db.defaults);return {...range,id:ref,company,expectedCents:0,remainingCents:0,receivedCents:0,paymentCents:0,advanceCents:0,unappliedCents:0,deductionCarryCents:0,accruedDays:0,status:'future'};}
  const date=validMonth(ref)?referenceDate(ref):today,range=payPeriodForDate(date,db.defaults),company=record(date.slice(0,7)).company||'';
  return b.periods.find(p=>p.start===range.start&&p.company===company)||{...range,id:range.start+'|'+encodeURIComponent(company),company,expectedCents:0,remainingCents:0,receivedCents:0,paymentCents:0,advanceCents:0,unappliedCents:0,accruedDays:0,status:'future'};
}

function updatePeriodPreview() {
  const form=document.getElementById('salary-form');if(!form)return;const fd=new FormData(form),mode=fd.get('periodMode')||db.defaults.periodMode,day=Number(fd.get('periodStartDay')||db.defaults.periodStartDay||1),payday=Number(fd.get('payday')||db.defaults.payday);
  document.getElementById('period-custom-field').hidden=mode!=='custom';document.getElementById('period-end-label').textContent=day===1?'每月1日至当月最后一天':`每月${day}日至次月${day-1}日`;
  try{const current=payPeriodForDate(today,{periodMode:mode,periodStartDay:day,payday}),last=payPeriodForDate(shiftDay(current.start,-1),{periodMode:mode,periodStartDay:day,payday});document.getElementById('period-preview').innerHTML=`最近完整周期：${periodName(last)}<br>约定发薪日：${last.dueDate.replaceAll('-','/')}<br>正在累计：${periodName(current)}<br><small>${mode==='custom'?'本完整周期共'+salaryRateForDate(last.start,Math.round(Number(fd.get('salary')||0)*100),{periodMode:mode,periodStartDay:day,payday}).divisor+'天，日薪＝固定工资÷周期总天数（含起止日）。':'日薪＝固定工资÷该自然月总天数。'}按期末之后的首个发薪日安排发放。</small>`;}catch(e){document.getElementById('period-preview').textContent=e.message;}
}

function cashPeriodTitle(p){
 if(p.all)return '全部累计待发';
 const prefix=p.end.slice(0,4)+'年'+Number(p.end.slice(5,7))+'月';
 return prefix+(p.start.slice(0,7)===p.end.slice(0,7)?'工资':'结算工资');
}
function cashRanges(month=selectedMonth) {
  const b=bookSummary(),companies=[...new Set([db.defaults.company||'',...b.chunks.map(x=>x.company),...b.periods.map(p=>p.company)])];
  const all=companies.map(company=>{const chunks=b.chunks.filter(x=>x.company===company),start=chunks[0]?.date||db.defaults.joinDate||today,ref=payPeriodForDate(start>today?start:today,db.defaults);return {id:'all:'+encodeURIComponent(company),company,start,end:ref.end,remainingCents:chunks.reduce((n,x)=>n+x.remainingCents,0),expectedCents:chunks.reduce((n,x)=>n+x.amountCents,0),all:true};});
  const current=currentPeriod(month),periods=b.periods.some(p=>p.id===current.id)?b.periods:[current,...b.periods];return [...all,...periods];
}

function updateCashPeriod() {
  const form=document.getElementById(editingTransaction.kind==='advance'?'advance-form':'payment-form');if(!form||editingTransaction.id)return;const id=new FormData(form).get('periodId'),p=cashRanges().find(x=>x.id===id);if(!p)return;editingTransaction.periodId=id;const input=document.getElementById('cash-amount');if(input.dataset?.userEdited!=='true')input.value=editingTransaction.kind==='payment'&&p.remainingCents?(p.remainingCents/100).toFixed(2):'';document.getElementById('cash-period-summary').innerHTML=`<span>本区间待发</span><strong class="number">¥ ${money(p.remainingCents)}</strong><small>截至今天，未来日期的工资尚未计入</small>`;
}

function saveSettingsForm(formId,fd,error) {
  try{
    if(formId==='company-form'){
      const company=String(fd.get('company')||'').trim(),joinDate=fd.get('joinDate');if(company.length>50)throw new Error('公司名称请控制在50字以内。');if(!validDate(joinDate))throw new Error('请选择有效的入职日期。');const previousCompany=record(modalMonth).company||'';
      for(const [m,r] of Object.entries(db.months))if(m===modalMonth||r.company===company||(!previousCompany&&!r.company))db.months[m]={...r,company,joinDate};
      if(!db.months[modalMonth])db.months[modalMonth]={...record(modalMonth),company,joinDate};db.defaults={...db.defaults,company,joinDate};rebuildAccrualFromJoin(db,today);closeModal();changed('工作主体和入职日期已保存，工资从入职日重新累计。');
    }else{
      const raw=String(fd.get('salary')),salary=Number(raw),payday=Number(fd.get('payday')),periodMode=fd.get('periodMode'),periodStartDay=periodMode==='custom'?Number(fd.get('periodStartDay')):1;
      if(!/^\d+(\.\d{1,2})?$/.test(raw)||salary<0||salary>10000000)throw new Error('月薪请输入0至1000万元以内、最多两位小数的金额。');if(!['calendar','custom'].includes(periodMode))throw new Error('请选择发薪周期。');payPeriodForDate(today,{payday,periodMode,periodStartDay});
      const settings={salaryCents:Math.round(salary*100),payday,periodMode,periodStartDay,basis:'calendar'};db.defaults={...db.defaults,...settings};db.months[modalMonth]={...record(modalMonth),salaryCents:settings.salaryCents,basis:'calendar'};homePeriodMonth=payPeriodForDate(referenceDate(selectedMonth),db.defaults).start.slice(0,7);closeModal();changed('月薪、发薪日和结算周期已联动更新。');
    }
  }catch(e){error.textContent=e.message;}
}

function refreshAccrualDay() {
  const next=chinaDate();if(next!==today){today=next;ensureAccrualMonths(db,today);if(db.sync.demo||db.sync.connected)db.sync.pending++;persist();render();if((db.sync.demo||db.sync.connected)&&db.sync.auto&&!db.sync.offline)scheduleDemoSync();}
setTimeout(refreshAccrualDay,60000);
}


function adjustmentPresets(kind) {
  return kind==='subsidy'?['餐补','交通补贴','住房补贴','夜班补贴','高温补贴','全勤奖']:['餐费','住宿费','社保个人部分','个税','借款扣回','其他约定扣款'];
}

function defaultEntryDate(month) {
  const join=record(month).joinDate||month+'-01',date=entryDate?.startsWith(month+'-')?entryDate:today.startsWith(month+'-')?today:month+'-01';return join.startsWith(month+'-')&&date<join?join:date;
}

function showAdjustment(kind,month=selectedMonth,id='') {
  modalMonth=month;editingTransaction={kind,id};const key=kind==='subsidy'?'subsidies':'deductions',name=kind==='subsidy'?'补贴':'扣款',item=(record(month)[key]||[]).find(x=>x.id===id),presets=adjustmentPresets(kind),custom=[...new Set(journalEntries().filter(x=>x.kind===kind).map(x=>x.category))].filter(x=>x&&!presets.includes(x)),options=[...presets,...custom];
  showModal(item?'修改'+name+'记录':'记'+name,`<form id="${kind}-form">${transactionContext(month)}<div class="adjustment-banner ${kind}"><span>${icon(kind==='subsidy'?'plus':'minus')}</span><div><strong>${kind==='subsidy'?'增加应计工资':'减少应计工资'}</strong><p>按记录日期归属工资账期，实际收款另记“发工资”</p></div></div><div class="field"><label for="adjustment-category">${name}项目</label><select id="adjustment-category" name="category">${options.map(category=>`<option value="${esc(category)}" ${item?.category===category?'selected':''}>${esc(category)}${!presets.includes(category)?' · 自定义':''}</option>`).join('')}<option value="__custom__">＋ 自定义项目</option></select></div><div class="field" id="adjustment-custom-field" hidden><label for="adjustment-custom">自定义项目名称</label><input id="adjustment-custom" name="customCategory" maxlength="30" placeholder="填写项目名称，最多30字"></div><div class="field"><label for="adjustment-amount">本次${name}金额（元）</label><div class="money-input"><span>¥</span><input id="adjustment-amount" name="amount" type="number" min="0.01" max="10000000" step="0.01" inputmode="decimal" placeholder="0.00" value="${item?(item.amountCents/100).toFixed(2):''}" required></div></div><div class="field"><label for="adjustment-date">记录日期</label><input id="adjustment-date" name="date" type="date" min="${month}-01" max="${month}-${daysInMonth(month)}" value="${item?.date||defaultEntryDate(month)}" required></div><div class="field"><label for="adjustment-note">备注（选填）</label><input id="adjustment-note" name="note" maxlength="80" value="${esc(item?.note||'')}" placeholder="例如：项目说明、结算依据"></div><p class="field-note">未来记录到当天生效。${kind==='deduction'?'扣款只在同一主体、同一工资账期内抵扣。超出已计薪部分保留为待抵扣扣款，后续继续抵扣，不会变成负数实收。':'本笔补贴直接增加对应日期的应计工资，不代表已经收到钱。'}</p>${transactionActions(item,kind)}</form>`);
}

function getAdjustmentDraft(kind,fd) {
  const date=fd.get('date'),r=record(modalMonth),category=String(fd.get('category')==='__custom__'?fd.get('customCategory'):fd.get('category')||'').trim();
  if(!validDate(date)||!date.startsWith(modalMonth+'-'))throw new Error('请选择当前自然月内的有效日期。');
  if(date<(r.joinDate||modalMonth+'-01'))throw new Error('记录日期不能早于入职日期。');
  if(!category||category==='__custom__'||category.length>30)throw new Error('请填写1至30字的项目名称。');
  const key=kind==='subsidy'?'subsidies':'deductions',previous=(r[key]||[]).find(x=>x.id===editingTransaction.id);
  return {id:previous?.id||uid(),date,category,amountCents:readMoney(fd.get('amount')),note:String(fd.get('note')||'').trim()};
}

function updateAdjustmentCategory() {
  const form=document.getElementById(editingTransaction.kind+'-form');if(!form)return;const fd=new FormData(form);document.getElementById('adjustment-custom-field').hidden=fd.get('category')!=='__custom__';
}

function metricAttrs(metric,scope='all',ref='') {
  return `data-action="metric" data-metric="${metric}" data-scope="${scope}" data-ref="${esc(ref)}"`;
}

function scopeContains(date,company,query) {
  if(query.scope==='cycle'){const p=payPeriodForDate(query.ref,db.defaults);return date>=p.start&&date<=p.end;}
  if(query.scope==='month')return date.startsWith(query.ref+'-');
  if(query.scope==='year')return date.startsWith(query.ref+'-');
  if(query.scope==='today')return date===today;
  if(query.scope==='date')return date===query.ref;
  if(query.scope==='period'){const p=currentPeriod(query.ref);return !!p&&company===p.company&&date>=p.start&&date<=p.end;}
  return true;
}

function metricRateInfo(query){
 const cycle=query.scope==='cycle',range=cycle?payPeriodForDate(query.ref,db.defaults):null,month=cycle?range.start.slice(0,7):query.ref||selectedMonth;
 if(!cycle){const c=calculated(month);return {...c,referenceDate:referenceDate(month),rates:c.rates.map(rate=>({...rate,salaryCents:record(month).salaryCents}))};}
 const date=today<range.start?range.start:today>range.end?range.end:today,rate=salaryRateForDate(date,record(date.slice(0,7)).salaryCents,db.defaults);
 const months=[...new Set([range.start.slice(0,7),range.end.slice(0,7)])],rates=months.map(m=>{const first=m+'-01',last=m+'-'+daysInMonth(m),from=first>range.start?first:range.start,to=last<range.end?last:range.end,salaryCents=record(m).salaryCents;return {...salaryRateForDate(from,salaryCents,db.defaults),from,to,salaryCents};});
 return {daily:bookSummary().chunks.filter(x=>x.date>=range.start&&x.date<=range.end),dailyCents:rate.dailyCents,rates,referenceDate:date};
}

function metricData(query={metric:'pending',scope:'all',ref:''}) {
  const b=bookSummary(),match=(date,company)=>scopeContains(date,company,query),chunks=b.chunks.filter(x=>match(x.date,x.company)),titles={pending:'待发工资',earned:'净计薪',base:'基本工资',leave:'请假扣薪',overtime:'加班收入',subsidy:'补贴收入',deduction:'其他扣款',received:'实际收款',applied:'收款已抵扣',appliedAdvance:'预支已抵扣',appliedPayment:'工资已抵扣',unapplied:'尚未抵扣的收款',carry:'待抵扣扣款',days:'已计薪天数',rate:'每日参考工资'},metric=query.metric;let rows=[],total=0,unit='money';
  const dailyKeys={earned:'amountCents',base:'grossCents',leave:'leaveDeductionCents'};
  if(metric==='pending'){
    const groups=new Map();for(const chunk of chunks){if(!chunk.remainingCents)continue;const p=currentPeriod(chunk.periodId);if(!groups.has(p.id))groups.set(p.id,{periodId:p.id,date:p.start,label:periodName(p),meta:(p.company||'未命名主体')+' · 按所选计薪日期',amountCents:0,action:'record-detail'});groups.get(p.id).amountCents+=chunk.remainingCents;}rows=[...groups.values()].sort((a,c)=>c.date.localeCompare(a.date));
  }else if(metric in dailyKeys||metric==='days'){
    const key=dailyKeys[metric];unit=metric==='days'?'days':'money';rows=chunks.filter(x=>metric!=='leave'||record(x.month).leaves.some(l=>l.date===x.date)).map(x=>{const leave=record(x.month).leaves.find(l=>l.date===x.date);return {date:x.date,label:x.date,meta:(x.company||'未命名主体')+(metric==='leave'?' · '+leave.days+'天 · '+(leaveDeducts(leave,record(x.month))?'扣款':'不扣款'):metric==='base'?' · 月薪÷完整周期总天数':' · 点击查看当天构成'),amountCents:metric==='days'?1:x[key],action:metric==='leave'?'edit-entry':'day-ledger',kind:metric==='leave'?'leave':'',id:leave?.id,ownerMonth:x.month};}).reverse();
  }else if(['overtime','subsidy','deduction'].includes(metric)){
    rows=journalEntries().filter(x=>x.kind===metric&&x.date<=today&&x.date>=(record(x.ownerMonth).joinDate||x.ownerMonth+'-01')&&match(x.date,record(x.ownerMonth).company||'')).map(x=>({date:x.date,label:metric==='overtime'?'加班':x.category,meta:x.date+' · '+(x.note||record(x.ownerMonth).company||'未填写备注'),amountCents:metric==='overtime'?overtimeAmount(x):x.amountCents,kind:x.kind,id:x.id,ownerMonth:x.ownerMonth,action:'edit-entry'}));
  }else if(['received','unapplied','applied','appliedAdvance','appliedPayment'].includes(metric)){
    rows=b.receipts.flatMap(x=>{const applied=metric.startsWith('applied'),unappliedMatch=metric==='unapplied'&&query.scope==='period'?payPeriodForDate(x.periodStart,db.defaults).start+'|'+encodeURIComponent(x.company)===query.ref:match(x.date,x.company),amount=applied?x.allocations.filter(a=>match(a.date,x.company)).reduce((n,a)=>n+a.amountCents,0):unappliedMatch?metric==='unapplied'?x.unappliedCents:x.amountCents:0;if(!amount||metric==='appliedAdvance'&&x.kind!=='advance'||metric==='appliedPayment'&&x.kind!=='payment')return [];return [{date:x.date,label:x.kind==='advance'?'预支':'发工资',meta:x.date+' · '+(applied?'本范围抵扣；实收¥'+money(x.amountCents):x.note||x.company||'未填写备注'),amountCents:amount,kind:x.kind,id:x.id,ownerMonth:x.month,action:'edit-entry'}];}).reverse();
  }else if(metric==='carry'){
    rows=chunks.filter(x=>x.deductionCarryCents).map(x=>({date:x.date,label:'待抵扣扣款',meta:x.date+' · 只在原工资账期继续抵扣',amountCents:x.deductionCarryCents,periodId:x.periodId,action:'record-detail'}));
  }else if(metric==='rate'){
    const c=metricRateInfo(query);total=c.dailyCents;rows=c.daily.slice().reverse().map(x=>({date:x.date,label:x.date,meta:'账期 '+x.periodStart+' 至 '+x.periodEnd+' · '+x.divisor+'天（累计舍入差额）',amountCents:x.grossCents,action:'day-ledger'}));
  }
  if(metric!=='rate')total=rows.reduce((n,x)=>n+x.amountCents,0);
  const scopeLabel=query.scope==='cycle'?periodName(payPeriodForDate(query.ref,db.defaults)):query.scope==='month'?fullMonth(query.ref):query.scope==='year'?query.ref+'年':query.scope==='today'?'今天 · '+today:query.scope==='date'?query.ref:query.scope==='period'?periodName(currentPeriod(query.ref)):'全部主体 · 全部账期',basis=metric==='unapplied'&&query.scope==='period'?'按原结算区间归属':['received','unapplied'].includes(metric)?'按实际收款日期':metric.startsWith('applied')?'按抵扣对应的计薪日期':'按计薪日期';
  return {query,title:titles[metric]||'账目明细',total,unit,rows,scopeLabel,basis};
}

function showMetric(metric='pending',scope='all',ref='') {
  const d=metricData({metric,scope,ref}),switches=['earned','pending','received'];
  showModal(d.title,`<div class="metric-scope">${esc(d.scopeLabel)}<span>${d.basis} · 截至${today}</span></div><div class="metric-total number" data-total="${d.total}">${d.unit==='days'?'':'<small>¥</small>'}${d.unit==='days'?d.total:money(d.total)}${d.unit==='days'?'<small>天</small>':''}</div>${metric==='rate'?`<div class="notice gray">${metricRateInfo({scope,ref}).rates.map(rate=>rate.from+' 至 '+rate.to+'：固定工资 ¥'+money(rate.salaryCents)+' ÷ '+rate.divisor+'天 ＝ 日薪 ¥'+money(rate.dailyCents)).join('<br>')}<br>上方金额为${metricRateInfo({scope,ref}).referenceDate}所在账期的参考日薪。按完整工资周期累计舍入到分；同一工资标准、完整无请假周期恰好一份固定工资。</div>`:`<div class="metric-switches">${switches.map(key=>`<button class="${key===metric?'active':''}" ${metricAttrs(key,scope,ref)}>${{earned:'净计薪',pending:'待发',received:'实收'}[key]}</button>`).join('')}</div>`}${metric==='earned'?'<p class="metric-note">基本工资 − 请假扣薪 ＋ 加班 ＋ 补贴 − 其他扣款。负数日期会在原主体、原账期内抵扣。</p>':metric==='carry'?'<p class="metric-note">扣款超过该账期已计薪的部分仍保留。该账期后续计薪时继续抵扣，不跨主体或跨账期自动扣款。</p>':metric==='pending'?'<p class="metric-note">按所选计薪日期汇总，点击账期查看完整结算情况。</p>':metric.startsWith('applied')?'<p class="metric-note">下方显示本范围实际抵扣金额；点开可以核对原始收款。</p>':''}<div class="metric-rows">${d.rows.map(row=>`<button class="metric-row" data-action="${row.action}" ${row.periodId?`data-period="${esc(row.periodId)}"`:''} data-date="${row.date}" data-month="${row.ownerMonth||row.date.slice(0,7)}" data-kind="${row.kind||''}" data-id="${esc(row.id||'')}"><span><strong>${esc(row.label)}</strong><small>${esc(row.meta||'')}</small></span><b class="number ${row.amountCents<0?'negative':''}">${d.unit==='days'?row.amountCents+'天':'¥ '+money(row.amountCents)}</b>${icon('chevron')}</button>`).join('')||'<div class="empty-state">这个范围内暂无对应账目。<br>记录保存后，金额会自动更新。</div>'}</div><button class="btn btn-plain full" data-action="record-entry" data-month="${scope==='month'?ref:selectedMonth}">${icon('plus')}记一笔</button>`,true);
}

function showDayLedger(date) {
  if(!validDate(date))return;selectedMonth=date.slice(0,7);const r=record(),c=calculated(),day=c.daily.find(x=>x.date===date),entries=journalEntries(selectedMonth).filter(x=>x.date===date),fields=[['base','基本工资',day?.grossCents||0],['leave','请假扣薪',day?.leaveDeductionCents||0],['overtime','加班收入',day?.overtimeCents||0],['subsidy','补贴收入',day?.subsidyCents||0],['deduction','其他扣款',day?.wageDeductionCents||0]];render();
  showModal(shortDate(date)+' · 当日账目',`<div class="day-ledger-head"><span>${date} · ${esc(calendarDay(date).lunarFull)}${calendarDay(date).festival?' · '+esc(calendarDay(date).festival):calendarDay(date).term?' · '+esc(calendarDay(date).term):''}${date===today?' · 今天':date>today?' · 未来日期':''}</span><strong class="number">¥ ${money(day?.amountCents||0)}</strong><small>${day?'当日净计薪':date<r.joinDate?'入职前，不计薪':date>today?'当天尚未到达，暂不计薪':'本月未建账，不计薪'}</small></div><div class="day-components">${fields.map(([key,label,amount])=>`<button ${metricAttrs(key,'date',date)}><span>${label}</span><b class="number">${['leave','deduction'].includes(key)?'− ':''}¥ ${money(amount)}</b>${icon('chevron')}</button>`).join('')}</div><div class="section-header day-record-title"><h2>当日记录</h2><span class="muted small">${entries.length}笔</span></div>${ledgerEntryRows(selectedMonth,'all',Infinity,date)||'<div class="empty-state">当天暂无逐笔记录</div>'}<div class="day-record-actions">${[['leave','记请假'],['overtime','记加班'],['subsidy','记补贴'],['deduction','记扣款']].map(([kind,label])=>`<button data-action="record-kind" data-kind="${kind}" data-month="${selectedMonth}" data-date="${date}">${label}</button>`).join('')}</div>`,true);
}

function activateNav(next,tab=''){
 navigateView(next);if(view==='cleanup')cleanupDraft.target='local';if(view==='records')entryMonthScope='';if(view==='records'&&tab){detailTab=tab;recordYear=selectedMonth.slice(0,4);}closeModal();render(true);window.scrollTo({top:0});
}
document.addEventListener('click',e=>{
  if(e.target.classList.contains('modal-overlay')){if(!stepBackModal())closeModal();return;}
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(action!=='nav'){if(pageNavigator?.isBusy())pageNavigator.cancel(false);if(calendarNavigator?.isBusy())calendarNavigator.cancel(false);}
  if(nativeSync?.handleClick(action))return;
  if(action==='nav'){if(button.closest('.bottom-nav,.side-nav')&&!button.dataset.tab&&pageNavigator?.navigate(button.dataset.view))return;activateNav(button.dataset.view,button.dataset.tab);}
  else if(action==='month-entries'){selectedMonth=button.dataset.month;recordYear=selectedMonth.slice(0,4);detailTab='entries';entryFilter='all';entryMonthScope=selectedMonth;navigateView('records');closeModal();render();window.scrollTo({top:0});}
  else if(action==='metric')showMetric(button.dataset.metric,button.dataset.scope||'all',button.dataset.ref||'');
  else if(action==='day-ledger')showDayLedger(button.dataset.date);
  else if(action==='calendar-rights')showModal('资料版权与使用条件','<div class="calendar-rights">'+calendarRights()+'</div>');
  else if(action==='calendar-sources')showCalendarSources();
  else if(action==='home-current'){today=chinaDate();selectedMonth=today.slice(0,7);homePeriodMonth=payPeriodForDate(today,db.defaults).start.slice(0,7);render();}
  else if(action==='calendar-today'){today=chinaDate();selectedMonth=today.slice(0,7);pickerYear=+today.slice(0,4);ensureAccrualMonths(db,today);persist();closeModal();view='calendar';render();queueMicrotask(()=>document.querySelector?.('[data-date="'+today+'"]')?.scrollIntoView?.({block:'center',behavior:'smooth'}));toast('已回到今天：'+today);}
  else if(action==='theme-settings')showModal('主题设置',themePicker(activeTheme));
  else if(action==='choose-theme'){
    const theme=themeCatalog().find(item=>item.id===button.dataset.theme);if(!theme)return;
    try{localStorage.setItem(THEME_STORAGE,theme.id);}catch{toast('主题暂时无法保存，请稍后重试');return;}
    activeTheme=theme.id;closeModal();render();toast('已切换为'+theme.name);
  }
  else if(action==='toggle-motion'){db.defaults.motion=db.defaults.motion===false;changed(db.defaults.motion?'界面动效已开启':'界面动效已关闭');}
  else if(action==='record-entry')showRecordEntry(button.dataset.month||selectedMonth);
  else if(action==='record-kind')openRecordKind(button.dataset.kind,button.dataset.month||selectedMonth,'',button.dataset.date||'');
  else if(action==='edit-entry')openRecordKind(button.dataset.kind,button.dataset.month,button.dataset.id);
  else if(action==='clear-entry-month'){entryMonthScope='';render();}
  else if(action==='entry-filter'){entryFilter=button.dataset.filter;render();}
  else if(action==='confirm-delete-entry')confirmDeleteEntry(button.dataset.kind,button.dataset.month,button.dataset.id);
  else if(action==='delete-entry')deleteEntry(button.dataset.kind,button.dataset.month,button.dataset.id);
  else if(action==='open-cleanup')openCleanup();
  else if(action==='cleanup-scope'){if(['month','year','all'].includes(button.dataset.scope)){cleanupDraft.scope=button.dataset.scope;render();}}
  else if(action==='cleanup-target'){cleanupDraft.target=button.dataset.target;render();}
  else if(action==='prepare-cleanup-demo')prepareCleanupDemo();
  else if(action==='review-cleanup')reviewCleanup();
  else if(action==='quick-cleanup'){cleanupDraft={...cleanupDraft,scope:'all',target:button.dataset.target};render();reviewCleanup(cleanupDraft);}
  else if(action==='confirm-cleanup')confirmCleanup();
  else if(action==='create-month'){db.months[selectedMonth]={...record(selectedMonth)};db.excludedMonths=(db.excludedMonths||[]).filter(m=>m!==selectedMonth);changed('本月账本已重新开始计薪。');}
  else if(action==='toggle-adjusted-leave'){db.defaults.adjustedLeaveDeduct=!db.defaults.adjustedLeaveDeduct;changed(db.defaults.adjustedLeaveDeduct?'新调休日请假默认扣款，旧记录保留。':'新调休日请假默认不扣，旧记录保留。');}
  else if(action==='company-settings')showCompanySettings();
  else if(action==='holiday-settings')showHolidaySettings();
  else if(action==='toggle-holiday-leave'){db.defaults.holidayLeaveDeduct=!db.defaults.holidayLeaveDeduct;changed(db.defaults.holidayLeaveDeduct?'新法定节假日请假默认扣款，旧记录保留。':'新法定节假日请假默认不扣，旧记录保留。');}
  else if(action==='calendar-month'){selectedMonth=button.dataset.month;navigateView('calendar');closeModal();render();window.scrollTo({top:0});}
  else if(action==='leave-details'){recordYear=selectedMonth.slice(0,4);detailTab='entries';entryFilter='leave';entryMonthScope=selectedMonth;navigateView('records');closeModal();render();window.scrollTo({top:0});}
  else if(action==='detail-tab'){detailTab=button.dataset.tab;render();}
  else if(action==='close-modal')dismissMenus();
  else if(action==='modal-back'){if(!stepBackModal())closeModal();}
  else if(action==='page-back')backPage();
  else if(action==='profile-chart'){profileChartMode=profileChartMode==='employment'?'records':'employment';render();}
  else if(action==='home-period-picker')showHomePeriodPicker();
  else if(action==='home-picker-year'){pickerYear+=Number(button.dataset.delta);renderHomePeriodPicker();}
  else if(action==='choose-home-period'){if(validMonth(button.dataset.month)){homePeriodMonth=button.dataset.month;closeModal();render();}}
  else if(action==='shift-home-period'){const range=homeRange(),next=payPeriodForDate(shiftDay(Number(button.dataset.delta)<0?range.start:range.end,Number(button.dataset.delta)<0?-1:1),db.defaults);if(validMonth(next.start.slice(0,7))){homePeriodMonth=next.start.slice(0,7);render();}}
  else if(action==='shift-month'){
    const [y,m]=selectedMonth.split('-').map(Number),d=new Date(Date.UTC(y,m-1+Number(button.dataset.delta),1));
    const next=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`;if(validMonth(next)){selectedMonth=next;render();}else toast('预览支持2020至2040年。');
  }
  else if(action==='record-year-picker'){showRecordYearPicker();}
  else if(action==='choose-record-year'){const year=button.dataset.year;if(!recordYears().includes(year))return;recordYear=year;entryMonthScope='';closeModal();render();}
  else if(action==='month-picker')showMonthPicker();
  else if(action==='picker-year'){pickerYear+=Number(button.dataset.delta);renderMonthPicker();}
  else if(action==='choose-month'){selectedMonth=button.dataset.month;closeModal();render();}
  else if(action==='salary-settings')showSalarySettings();
  else if(action==='rules')showRules();
  else if(action==='add-leave')leaveForm();
  else if(action==='day')showDay(button.dataset.date);
  else if(action==='all-leaves')showModal(`${monthNum(selectedMonth)}月请假明细`,`<div class="leave-list">${leaveList(record().leaves.slice().sort((a,b)=>b.date.localeCompare(a.date)),selectedMonth)}</div>`);
  else if(action==='edit-leave'){
    const m=button.dataset.month||selectedMonth,item=record(m).leaves.find(x=>x.id===button.dataset.id);if(item)leaveForm(item.date,item,m);
  }
  else if(action==='leave-duration'){
    document.getElementById('leave-duration').value=button.dataset.value;
    document.querySelectorAll('[data-action="leave-duration"]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',b===button?'true':'false');});updateLeaveEstimate();
  }
  else if(action==='confirm-delete-leave'){
    const id=button.dataset.id,m=modalMonth,item=record(m).leaves.find(x=>x.id===id);
    if(item)showModal('删除这笔请假？',`<p class="modal-rule">删除${shortDate(item.date)}的${item.days}天请假后，系统会重新计算本月工资。你也可以之后重新登记。</p><div class="modal-actions"><button class="btn btn-plain" data-action="modal-back">暂不删除</button><button class="btn btn-danger" data-action="delete-leave" data-month="${m}" data-id="${esc(id)}">确认删除</button></div>`);
  }
  else if(action==='delete-leave'){
    const m=button.dataset.month,r=record(m);db.months[m]={...r,leaves:r.leaves.filter(x=>x.id!==button.dataset.id)};closeModal();changed('请假记录已删除，工资已重新计算。');
  }
  else if(action==='mark-paid')showPayment();
  else if(action==='payment-detail')showRecordDetail();
  else if(action==='record-detail')showRecordDetail(button.dataset.period||button.dataset.month);
  else if(action==='payment-for-month')showPayment(button.dataset.month);
  else if(action==='pay-period')showPayment(selectedMonth,'',button.dataset.period);
  else if(action==='open-month'){selectedMonth=button.dataset.month;navigateView('calendar');closeModal();render();window.scrollTo({top:0});}
  else if(action==='filter'){recordFilter=button.dataset.filter;render();}
  else if(action==='export')exportBook();
  else if(action==='connect-demo'||action==='connection-settings')showConnection();
  else if(action==='start-demo')startDemo();
  else if(action==='sync-now')runDemoSync();
  else if(action==='toggle-auto'){db.sync.auto=!db.sync.auto;if(db.sync.auto)db.sync.pausedByCleanup=false;else clearTimeout(syncTimer);persist();render();if(db.sync.auto&&db.sync.pending&&!db.sync.offline)scheduleDemoSync();}
  else if(action==='toggle-offline'){
    db.sync.offline=!db.sync.offline;addLog(db.sync.offline?'已模拟离线，记账保存在本机':'已模拟联网，准备处理待同步修改','wifi');persist();render();if(!db.sync.offline&&db.sync.pending&&db.sync.auto)scheduleDemoSync();
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='adjustment-category')updateAdjustmentCategory();
  if(e.target.id==='entry-month'){if(validMonth(e.target.value))showRecordEntry(e.target.value);else toast('请选择2020至2040年的有效月份。');}
  if(e.target.closest('#overtime-form'))updateOvertimeEstimate();
  if(e.target.id==='cleanup-include-cloud'){if(nativeSync?.isBusy()){toast('请等待当前网盘操作完成。');return;}cleanupDraft.target=e.target.checked&&nativeSync?.configured()?'both':'local';render();}
  if(e.target.id==='cleanup-scope'){cleanupDraft.scope=e.target.value;render();}
  if(e.target.id==='cleanup-month'){cleanupDraft.month=e.target.value;render();}
  if(e.target.id==='cleanup-year'){cleanupDraft.year=e.target.value;render();}
  if(e.target.id==='record-year'){recordYear=e.target.value;entryMonthScope='';render();}
  if(e.target.closest('#salary-form'))updatePeriodPreview();
  if(e.target.id==='cash-period')updateCashPeriod();
  if(e.target.id==='leave-start'){
    const end=document.getElementById('leave-end');if(end&&end.value<e.target.value)end.value=e.target.value;
  }
  if(e.target.closest('#leave-form'))updateLeaveEstimate();
});
document.addEventListener('input',e=>{if(e.target.id==='cash-amount'&&e.target.dataset)e.target.dataset.userEdited='true';if(e.target.closest('#leave-form'))updateLeaveEstimate();if(e.target.closest('#overtime-form'))updateOvertimeEstimate();});
document.addEventListener('submit',e=>{
 const form=e.target;if(nativeSync&&form.id==='webdav-form'){e.preventDefault();nativeSync.submit(new FormData(form));return;}if(!['company-form','salary-form','leave-form','overtime-form','payment-form','advance-form','subsidy-form','deduction-form'].includes(form.id))return;e.preventDefault();
 const fd=new FormData(form),error=document.getElementById('form-error');
 if(['company-form','salary-form'].includes(form.id)){saveSettingsForm(form.id,fd,error);return;}
 if(form.id==='leave-form'){const draft=getLeaveDraft();if(draft.error){error.textContent=draft.error;return;}db.months[modalMonth]={...record(modalMonth),leaves:[...draft.remaining,...draft.items]};closeModal();changed('请假与本笔扣款选择已保存。');return;}
 saveLedgerForm(form.id,fd,error);
});
document.addEventListener('keydown',e=>{
  if(!modalRoot.firstElementChild)return;
  if(e.key==='Escape'){if(!stepBackModal())closeModal();return;}
  if(e.key==='Tab'){
    const controls=[...modalRoot.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type=hidden]),select,textarea,a[href]')].filter(el=>el.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
});
window.addEventListener('storage',e=>{if(e.key===STORAGE){toast('另一页面更新了账本，刷新可查看最新记录。');}});
if(isAndroid){nativeSync=installNativeSync({onState:syncFeedbackChanged,getBook:()=>db,replaceBook:value=>{db=value;persistedBook=snapshotBook(db);bookCache=null;},today:()=>today,defaults:defaultSettings,persist,render,toast,showModal,updateModal:(title,body,wide)=>showModal(title,body,wide,true),afterModalOpen,closeModal,esc,storageBlocked:()=>storageBlocked,cleanupComplete:message=>{cleanupDraft.target='local';pendingCleanupPlan=null;cleanupNotice=message;view='cleanup';render();toast(message);},editing:()=>Boolean(modalRoot.querySelector('form')),interacting:()=>Boolean(pageNavigator?.isBusy?.()||pageNavigator?.isPending?.()||calendarNavigator?.isBusy?.()||calendarNavigator?.isPending?.()||pullRefresh?.isDragging?.())});}
globalThis.dagongrenBack=backOne;
calendarUpdater=createCalendarUpdater({fetchYear:nativeSync?year=>nativeSync.fetchCalendar(year):null,onChange:()=>{bookCache=null;if(view==='calendar'&&!modalRoot.firstElementChild)render();}});
ensureAccrualMonths(db,today);persist();
calendarUpdater.refresh(Number(today.slice(0,4)));
try{performance.mark('dagongren.app.render');}catch{}
render();
playBrandIntro(db.defaults.motion!==false,()=>{pageNavigator?.invalidate?.();calendarNavigator?.invalidate?.();});
const systemThemeChanged=dark=>{systemDark=Boolean(dark);if(activeTheme==='system')render();};
systemTheme?.addEventListener?.('change',event=>{if(!isAndroid)systemThemeChanged(event.matches);});
globalThis.dagongrenSystemTheme=systemThemeChanged;
pageNavigator=installPageSwipe(app,{current:()=>view,blocked:()=>Boolean(modalRoot.firstElementChild),preview:previewPage,navigate:next=>activateNav(next),settled:settledRender});
calendarNavigator=installCalendarSwipe(app,{blocked:()=>view!=='calendar'||Boolean(modalRoot.firstElementChild),preview:previewCalendar,commit:commitCalendar,settled:settledRender});
pageNavigator?.invalidate?.();calendarNavigator?.invalidate?.();
pullRefresh=bindPullRefresh(app,{
 enabled:()=>['home','calendar','records','settings'].includes(view),
 blocked:()=>Boolean(modalRoot.firstElementChild)||app.classList.contains('swipe-busy'),
 onStart:()=>{pageNavigator?.cancel(false);calendarNavigator?.cancel(false);},
 onEnd:()=>{pageNavigator?.invalidate?.();calendarNavigator?.invalidate?.();},
 async refresh(){refreshAccrualDay();bookCache=null;render();calendarUpdater?.refresh(Number(selectedMonth.slice(0,4)),{force:true});return await runDemoSync('pull');}
});
setTimeout(refreshAccrualDay,60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(nativeSync)nativeSync.foreground();calendarUpdater?.refresh(Number(selectedMonth.slice(0,4)));const next=chinaDate();if(next!==today){today=next;ensureAccrualMonths(db,today);if(db.sync.demo||db.sync.connected)db.sync.pending++;persist();render();if((db.sync.demo||db.sync.connected)&&db.sync.auto&&!db.sync.offline)scheduleDemoSync();}}});
window.addEventListener('online',()=>calendarUpdater?.refresh(Number(selectedMonth.slice(0,4)),{force:true}));
if(bootMessage)toast(bootMessage);

function leaveList(leaves,month) {
  if(!leaves.length)return '<div class="empty-state">还没有请假记录。</div>';
  return leaves.map(item=>`<button class="leave-item" data-action="edit-leave" data-id="${esc(item.id)}" data-month="${month}"><span class="leave-day-icon">${+item.date.slice(8)}<small>${monthNum(month)}月</small></span><span class="leave-info"><strong>请假${item.days}天 · ${leaveDeducts(item,db.defaults)?'扣款':'不扣款'}</strong><p>${item.date>today?'未来记录 · ':''}${esc(item.note||'未填写备注')}</p></span><span class="leave-right number">${leaveDeducts(item,db.defaults)?'约 − ¥'+money(salaryRateForDate(item.date,record(month).salaryCents,db.defaults).dailyCents*item.days):'不扣款'}<small>${shortDate(item.date)}</small></span></button>`).join('');
}



function yearRecords() { return Object.entries(db.months).filter(([month])=>month.startsWith(recordYear)).sort(([a],[b])=>b.localeCompare(a)); }

