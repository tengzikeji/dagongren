export function copyRecords(value) { return JSON.parse(JSON.stringify(value || {})); }
export function canonicalJSON(value) {
  const sort = item => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key,sort(item[key])])) : item;
  return JSON.stringify(sort(value));
}
export function makeCleanupPlan(local,cloud,options) {
  const {scope,target,month,year} = options;
  if(!['month','year','all'].includes(scope)||!['local','cloud','both'].includes(target))throw new Error('请选择有效的清理范围与位置。');
  if(scope==='month'&&!/^(20[2-8]\d)-(0[1-9]|1[0-2])$/.test(month||''))throw new Error('请选择有效月份。');
  if(scope==='year'&&(!/^\d{4}$/.test(year||'')||+year<2020||+year>2089))throw new Error('请选择2020至2089年之间的年份。');
  const matching=data=>Object.keys(data||{}).filter(key=>scope==='all'||(scope==='year'?key.startsWith(year+'-'):key===month)).sort();
  const localKeys=target==='cloud'?[]:matching(local),cloudKeys=target==='local'?[]:matching(cloud);
  const subset=(data,keys)=>Object.fromEntries(keys.map(key=>[key,data[key]]));
  const total=field=> (data,keys)=>keys.reduce((n,key)=>n+(Array.isArray(data[key]?.[field])?data[key][field].length:0),0);
  const count=(data,keys)=>({months:keys.length,leaves:total('leaves')(data,keys),paid:keys.filter(key=>data[key]?.payment).length+total('payments')(data,keys),advances:total('advances')(data,keys),overtime:total('overtime')(data,keys),subsidies:total('subsidies')(data,keys),deductions:total('deductions')(data,keys)});
  return {options:{scope,target,month,year},localKeys,cloudKeys,local:count(local||{},localKeys),cloud:count(cloud||{},cloudKeys),signature:canonicalJSON({local:subset(local||{},localKeys),cloud:subset(cloud||{},cloudKeys)})};
}
export function applyCleanupPlan(local,cloud,plan) {
  const current=makeCleanupPlan(local,cloud,plan.options);
  if(current.signature!==plan.signature)throw new Error('待清理数据已经变化，请重新核对范围。');
  const nextLocal=copyRecords(local),nextCloud=copyRecords(cloud);
  for(const key of plan.localKeys)delete nextLocal[key];
  for(const key of plan.cloudKeys)delete nextCloud[key];
  return {local:nextLocal,cloud:nextCloud};
}
export function mergeDemoRecords(local,cloud) { return copyRecords({...cloud,...local}); }
