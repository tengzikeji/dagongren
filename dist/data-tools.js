export function copyRecords(value) { return JSON.parse(JSON.stringify(value || {})); }
export function canonicalJSON(value) {
  const sort = item => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key,sort(item[key])])) : item;
  return JSON.stringify(sort(value));
}
const cleanupEntryFields=['leaves','overtime','subsidies','deductions'];
function cleanupSelection(record,company){
  if(typeof company!=='string')return record;
  const owner=record.company||'',owns=owner===company,selected={};
  // A month's receipts can settle wages belonging to a different employer.
  // Keep those receipts outside this selection even when clearing its base wage.
  selected.wages=owns&&record.accrualDisabled!==true?Object.fromEntries(Object.entries(record).filter(([key])=>![...cleanupEntryFields,'advances','payments','payment'].includes(key))):null;
  for(const key of cleanupEntryFields)selected[key]=owns?(record[key]||[]):[];
  for(const key of ['advances','payments'])selected[key]=(record[key]||[]).filter(item=>(item.company??owner)===company);
  selected.payment=record.payment&&(record.payment.company??owner)===company?record.payment:null;
  return selected;
}
function hasCleanupSelection(record,company){
  if(typeof company!=='string')return true;
  const selected=cleanupSelection(record,company);
  return !!selected.wages||!!selected.payment||[...cleanupEntryFields,'advances','payments'].some(key=>selected[key].length);
}
function cleanCompanyRecord(record,company){
  const next=copyRecords(record),owner=record.company||'';
  for(const key of ['advances','payments'])if(Array.isArray(next[key]))next[key]=next[key].filter(item=>(item.company??owner)!==company);
  if(next.payment&&(next.payment.company??owner)===company)next.payment=null;
  if(owner===company){
    if(!next.payment&&!(next.advances||[]).length&&!(next.payments||[]).length)return undefined;
    for(const key of cleanupEntryFields)next[key]=[];
    next.accrualDisabled=true;
  }
  return next;
}
export function makeCleanupPlan(local,cloud,options) {
  const {scope,target,month,year,company} = options;
  if(!['month','year','all'].includes(scope)||!['local','cloud','both'].includes(target))throw new Error('请选择有效的清理范围与位置。');
  if(scope==='month'&&!/^(20[2-8]\d)-(0[1-9]|1[0-2])$/.test(month||''))throw new Error('请选择有效月份。');
  if(scope==='year'&&(!/^\d{4}$/.test(year||'')||+year<2020||+year>2089))throw new Error('请选择2020至2089年之间的年份。');
  if(company!==undefined&&company!==null&&typeof company!=='string')throw new Error('请选择有效的工作主体。');
  const matching=data=>Object.keys(data||{}).filter(key=>(scope==='all'||(scope==='year'?key.startsWith(year+'-'):key===month))&&hasCleanupSelection(data[key],company)).sort();
  const localKeys=target==='cloud'?[]:matching(local),cloudKeys=target==='local'?[]:matching(cloud);
  const subset=(data,keys)=>Object.fromEntries(keys.map(key=>[key,cleanupSelection(data[key],company)]));
  const total=field=> (data,keys)=>keys.reduce((n,key)=>n+(Array.isArray(data[key]?.[field])?data[key][field].length:0),0);
  const count=(data,keys)=>{const selected=subset(data,keys);return {months:keys.length,leaves:total('leaves')(selected,keys),paid:keys.filter(key=>selected[key]?.payment).length+total('payments')(selected,keys),advances:total('advances')(selected,keys),overtime:total('overtime')(selected,keys),subsidies:total('subsidies')(selected,keys),deductions:total('deductions')(selected,keys)};};
  const accrualKeys=(data,keys)=>keys.filter(key=>typeof company!=='string'||(data[key].company||'')===company);
  const planOptions={scope,target,month,year};if(company!==undefined)planOptions.company=company;
  return {options:planOptions,localKeys,cloudKeys,localAccrualKeys:accrualKeys(local||{},localKeys),cloudAccrualKeys:accrualKeys(cloud||{},cloudKeys),local:count(local||{},localKeys),cloud:count(cloud||{},cloudKeys),signature:canonicalJSON({local:subset(local||{},localKeys),cloud:subset(cloud||{},cloudKeys)})};
}
export function applyCleanupPlan(local,cloud,plan) {
  const current=makeCleanupPlan(local,cloud,plan.options);
  if(current.signature!==plan.signature)throw new Error('待清理数据已经变化，请重新核对范围。');
  const nextLocal=copyRecords(local),nextCloud=copyRecords(cloud);
  for(const [next,keys] of [[nextLocal,current.localKeys],[nextCloud,current.cloudKeys]])for(const key of keys){
    const value=typeof current.options.company==='string'?cleanCompanyRecord(next[key],current.options.company):undefined;
    if(value===undefined)delete next[key];else next[key]=value;
  }
  return {local:nextLocal,cloud:nextCloud};
}
export function mergeDemoRecords(local,cloud) { return copyRecords({...cloud,...local}); }
