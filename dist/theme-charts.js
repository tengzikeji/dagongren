import {formatMoney,daysInMonth,wagePayments} from './payroll.js';
const tcMoney=value=>formatMoney(value);
const tcEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tcPercent=value=>Math.max(0,Math.min(100,Number(value)||0));
function tcShell(kind,theme,title,subtitle,body,caption){return '<section class="panel data-chart '+kind+' theme-chart" data-chart-style="'+theme+'"><div class="section-header"><h2>'+title+'</h2><span class="muted small">'+subtitle+'</span></div>'+body+'<p class="chart-caption">'+caption+'</p></section>';}
function tcGauge(progress,label){const p=tcPercent(progress);return '<div class="theme-gauge"><svg viewBox="0 0 240 142" role="img" aria-label="'+tcEscape(label)+' '+p.toFixed(1)+'%"><path class="theme-track" d="M25 118a95 95 0 0 1 190 0" pathLength="100"/><path class="theme-stroke theme-draw" d="M25 118a95 95 0 0 1 190 0" pathLength="100" stroke-dasharray="'+p+' 100"/><path class="gauge-ticks" d="M25 118h10M43 62l9 6M120 23v10M197 62l-9 6M215 118h-10"/></svg><div><strong>'+p.toFixed(1)+'<small>%</small></strong><span>'+label+'</span></div></div>';}
function tcOrbit(progress,label){const p=tcPercent(progress);return '<div class="theme-orbit"><svg viewBox="0 0 160 160" role="img" aria-label="'+tcEscape(label)+' '+p.toFixed(1)+'%"><circle class="orbit-decoration" cx="80" cy="80" r="72"/><circle class="theme-track" cx="80" cy="80" r="58"/><circle class="theme-stroke theme-draw" cx="80" cy="80" r="58" pathLength="100" stroke-dasharray="'+p+' 100" transform="rotate(-90 80 80)"/></svg><div><strong>'+p.toFixed(1)+'<small>%</small></strong><span>'+label+'</span></div></div>';}
export function themedSettlement(book,theme){
 if(theme==='classic')return '';
 const applied=Math.max(0,book.receivedCents-book.unappliedCents),pending=Math.max(0,book.remainingCents),total=applied+pending,progress=total?applied/total*100:0;
 const visual=theme==='neon'?tcGauge(progress,'已抵扣'):theme==='forest'?tcOrbit(progress,'已抵扣'):'<div class="paper-receipt"><span>收款抵扣进度</span><strong>'+progress.toFixed(1)+'<small>%</small></strong><div class="theme-meter"><i style="width:'+progress+'%"></i></div><span>已抵扣 / 已计薪合计</span></div>';
 const values='<div class="chart-key-values"><button data-action="metric" data-metric="applied" data-scope="all"><span>已抵扣收款</span><strong>¥ '+tcMoney(applied)+'</strong></button><button data-action="metric" data-metric="pending" data-scope="all"><span>待发工资</span><strong>¥ '+tcMoney(pending)+'</strong></button></div>';
 return tcShell('settlement-chart',theme,'收款进度','全部主体 · 全部账期','<div class="theme-settlement">'+visual+values+'</div>',total?'按已抵扣收款与待发合计计算，未抵扣预支不计入。':'暂无可结算工资，记账后自动展示进度。');
}
export function themedDaily(month,daily,total,theme){
 if(theme==='classic')return '';
 const days=daysInMonth(month),max=Math.max(1,...daily.map(x=>Math.abs(x.amountCents))),hasNegative=daily.some(x=>x.amountCents<0),baseline=hasNegative?96:146,scale=(hasNegative?60:110)/max,step=540/days;
 let body='<div class="chart-topline"><strong>¥ '+tcMoney(total)+'</strong><span>本月累计</span></div>';
 if(!daily.length)body+='<div class="chart-empty">本月暂无已生效计薪</div>';
 else if(theme==='paper'){
  body+='<div class="wage-heatmap" role="img" aria-label="'+month+'每日净计薪色块图">'+Array.from({length:days},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0'),item=daily.find(x=>x.date===date),amount=item?.amountCents;return '<div class="wage-heat-cell '+(!item?'unaccrued':amount<0?'loss':amount===0?'zero':'income')+'" style="--heat:'+(item?(.12+Math.abs(amount)/max*.65).toFixed(3):0)+'" data-date="'+date+'" data-amount="'+(amount??'')+'"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+(item?tcMoney(amount):'—')+'</strong></div>';}).join('')+'</div>';
 }else{
  const points=daily.map(x=>[30+(Number(x.date.slice(8))-.5)*step,baseline-x.amountCents*scale]),line=points.map(([x,y])=>x.toFixed(2)+','+y.toFixed(2)).join(' ');
  const marks=daily.map((x,i)=>{const [px,py]=points[i],tone=x.amountCents<0?'theme-loss':'theme-stroke';return '<g data-date="'+x.date+'" data-amount="'+x.amountCents+'"><title>'+x.date+' 净计薪 '+tcMoney(x.amountCents)+'元</title>'+(theme==='neon'?'<line class="theme-stem '+tone+'" x1="'+px+'" x2="'+px+'" y1="'+baseline+'" y2="'+py+'"/>':'')+'<circle class="theme-dot '+tone+'" cx="'+px+'" cy="'+py+'" r="3"/></g>';}).join('');
  body+='<svg class="wage-plot" viewBox="0 0 600 192" role="img" aria-label="'+month+'每日净计薪'+(theme==='forest'?'面积趋势':'点线图')+'"><line class="chart-guide" x1="24" x2="576" y1="'+baseline+'" y2="'+baseline+'"/>'+(theme==='forest'?'<polygon class="theme-area" points="'+points[0][0]+','+baseline+' '+line+' '+points.at(-1)[0]+','+baseline+'"/><polyline class="theme-line theme-stroke theme-draw" points="'+line+'" pathLength="100"/>':'')+marks+'<text class="chart-axis" x="25" y="184">1日</text><text class="chart-axis" x="545" y="184">'+days+'日</text></svg>';
 }
 body+='<div class="chart-legend"><span><i class="chart-blue"></i>正净计薪</span><span><i class="chart-orange"></i>负净计薪</span></div>';
 return tcShell('daily-chart',theme,'每日净计薪',month.replace('-','年')+'月',body,'基本工资 − 请假扣薪 ＋ 加班 ＋ 补贴 − 其他扣款；未到日期不计入。');
}
export function themedAnnual(year,book,theme){
 if(theme==='classic')return '';
 const points=Array.from({length:12},(_,i)=>{const month=year+'-'+String(i+1).padStart(2,'0');return {month,earned:book.byMonth[month]?.expectedCents||0,received:book.receipts.filter(x=>x.date.startsWith(month+'-')).reduce((n,x)=>n+x.amountCents,0)};}),max=Math.max(1,...points.flatMap(x=>[Math.abs(x.earned),x.received])),negative=points.some(x=>x.earned<0),baseline=negative?90:146,scale=(negative?58:110)/max;
 let body='';
 if(!points.some(x=>x.earned||x.received))body='<div class="chart-empty">所选年份暂无计薪或收款</div>';
 else if(theme==='paper')body='<div class="annual-rails">'+points.map((x,i)=>'<div data-month="'+x.month+'"><span>'+(i+1)+'月</span><div class="annual-rail-pair">'+['earned','received'].map(kind=>'<i class="annual-rail '+(x[kind]<0?'negative':kind)+'" data-kind="'+kind+'" data-amount="'+x[kind]+'" style="width:'+(Math.abs(x[kind])/max*100)+'%"></i>').join('')+'</div><small>'+tcMoney(x.earned)+' / '+tcMoney(x.received)+'</small></div>').join('')+'</div>';
 else body='<svg class="wage-plot" viewBox="0 0 600 192" role="img" aria-label="'+year+'年月度净计薪与实收趋势"><line class="chart-guide" x1="24" x2="576" y1="'+baseline+'" y2="'+baseline+'"/>'+['earned','received'].map(kind=>{const coords=points.map((x,i)=>(28+i*49)+','+(baseline-x[kind]*scale).toFixed(2)).join(' ');return (theme==='forest'&&kind==='earned'?'<polygon class="theme-area" points="28,'+baseline+' '+coords+' 567,'+baseline+'"/>':'')+'<polyline class="theme-line theme-draw '+(kind==='earned'?'theme-stroke':'theme-received')+'" points="'+coords+'" pathLength="100"/>'+points.map((x,i)=>'<circle class="theme-dot '+(kind==='earned'?'theme-stroke':'theme-received')+'" cx="'+(28+i*49)+'" cy="'+(baseline-x[kind]*scale)+'" r="3" data-month="'+x.month+'" data-kind="'+kind+'" data-amount="'+x[kind]+'"><title>'+x.month+' '+(kind==='earned'?'净计薪':'实收')+' '+tcMoney(x[kind])+'元</title></circle>').join('');}).join('')+'<text class="chart-axis" x="24" y="184">1月</text><text class="chart-axis" x="545" y="184">12月</text></svg>';
 return tcShell('annual-chart',theme,'月度计薪与实收',year+'年 · 全年',body+'<div class="chart-legend"><span><i class="chart-blue"></i>净计薪</span><span><i class="chart-green"></i>实收（含预支）</span></div>','计薪按自然月汇总；实收按收款月份统计，两者可能不同。');
}
export function themedEmployment(stats,joinDate,asOf,theme){
 if(theme==='classic')return '';
 const metrics='<div class="employment-metrics">'+[['days','入职天数',stats.days,'天'],['months','完整月数',stats.months,'个月'],['years','完整年数',stats.years,'年']].map(([key,label,value,unit])=>'<div><span>'+label+'</span><strong data-stat="'+key+'">'+value+'<small>'+unit+'</small></strong></div>').join('')+'</div>';
 let progress='';
 if(!stats.valid||stats.future)progress='<div class="chart-empty">'+(stats.future?'距离入职还有 '+stats.untilJoin+' 天':'请先设置有效的入职日期')+'</div>';
 else if(theme==='paper')progress='<div class="employment-progress paper-timeline"><div><i></i><span>入职起点</span><strong>'+tcEscape(joinDate)+'</strong></div><div><i></i><span>今天 · 第'+(stats.years+1)+'个入职年</span><strong>'+asOf+'</strong><div class="theme-meter"><b style="width:'+stats.progress+'%"></b></div><small>周年进度 '+stats.progress.toFixed(1)+'%</small></div><div><i></i><span>下一次周年 · 还剩 '+stats.remaining+' 天</span><strong>'+stats.nextAnniversary+'</strong></div></div>';
 else progress='<div class="employment-progress">'+(theme==='neon'?tcGauge(stats.progress,'入职周年进度'):tcOrbit(stats.progress,'入职周年进度'))+'<div class="employment-year"><strong>第'+(stats.years+1)+'个入职年</strong><span>已过 '+stats.elapsed+' / '+stats.yearDays+' 天</span><p>距下次周年还有 <b>'+stats.remaining+'</b> 天</p><small>下次周年 '+stats.nextAnniversary+'</small></div></div>';
 return tcShell('employment-chart',theme,'入职时长','当前工作主体 · 截至今天',metrics+progress,'入职当天算1天；满月、满年按入职日期计算，不足该日取月末。').replace('<section ','<section data-as-of="'+tcEscape(asOf)+'" ');
}
export function themedMix(months,theme){
 if(theme==='classic')return '';
 const groups=[['leave','请假','leaves','#6386db'],['overtime','加班','overtime','#6fbaaa'],['subsidy','补贴','subsidies','#8c91d7'],['deduction','扣款','deductions','#d7a067'],['advance','预支','advances','#7babc7'],['payment','发工资','payments','#79a179']].map(([kind,label,key,color])=>({kind,label,color,count:Object.values(months).reduce((n,r)=>n+(key==='payments'?wagePayments(r).length:(r[key]||[]).length),0)})),total=groups.reduce((n,x)=>n+x.count,0);
 let visual='';
 if(total&&theme!=='paper'){
  let offset=0;visual='<div class="mix-orbit"><svg viewBox="0 0 160 160" role="img" aria-label="六类记录数量占比">'+groups.filter(x=>x.count).map(x=>{const n=x.count/total*100,r=theme==='neon'?42+groups.indexOf(x)*5:59;const circle='<circle class="mix-arc" cx="80" cy="80" r="'+r+'" pathLength="100" stroke="'+x.color+'" stroke-dasharray="'+n+' '+(100-n)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 80 80)" data-kind="'+x.kind+'" data-count="'+x.count+'"><title>'+x.label+' '+x.count+'笔</title></circle>';if(theme!=='neon')offset+=n;return circle;}).join('')+'</svg><strong>'+total+'<small>笔记录</small></strong></div>';
 }else if(!total)visual='<div class="chart-empty">从今天开始，记录第一笔后自动展示</div>';
 const legend='<div class="record-mix-legend">'+groups.map(x=>'<div class="record-type-row"><div><span><i style="background:'+x.color+'"></i>'+x.label+'</span><strong>'+x.count+'笔 <small>'+(total?(x.count/total*100).toFixed(1):'0.0')+'%</small></strong></div><div class="record-type-track"><i class="record-type-fill" style="width:'+(total?x.count/total*100:0)+'%;background:'+x.color+'"></i></div></div>').join('')+'</div>';
 return tcShell('record-mix-chart',theme,'记录类型分布','全账本记录','<div class="chart-topline"><strong>'+total+'<small> 笔</small></strong><span>已记 '+Object.keys(months).length+' 个月</span></div>'+visual+legend,'请假按逐日记录条数统计；六类记录按实际笔数计算占比。');
}
