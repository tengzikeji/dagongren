import {canonicalJSON} from './data-tools.js';
const recordFields=new Set(['leaves','overtime','subsidies','deductions','advances','payments']);
const duplicate=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const equivalent=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
const recordKey=(field,item)=>field==='leaves'?'date:'+item.date:'id:'+item.id;
const markerKey=parts=>JSON.stringify(parts);
function recordEntities(book){
 const result=new Map();
 for(const [month,value] of Object.entries(book?.months||{})){
  result.set(markerKey(['months',month]),value);
  for(const field of recordFields)for(const item of value[field]||[])result.set(markerKey(['months',month,field,recordKey(field,item)]),item);
  if(value.payment)result.set(markerKey(['months',month,'payment']),value.payment);
 }
 return result;
}
export function rememberDeletions(book,previous,revision){
 const before=recordEntities(previous),after=recordEntities(book),markers={...(book.tombstones||{})};let changed=false;
 for(const key of before.keys())if(!after.has(key)&&!markers[key]){markers[key]=revision;changed=true;}
 for(const key of after.keys())if(!before.has(key)&&markers[key]){delete markers[key];changed=true;}
 if(Object.keys(markers).length)book.tombstones=markers;else delete book.tombstones;return changed;
}
function conflictLabel(parts){
 const names={defaults:'工资设置',salaryCents:'月薪',company:'工作主体',joinDate:'入职日期',leaveDate:'离职日期',accrualDisabled:'基础计薪状态',payday:'发薪日',periodMode:'发薪周期',periodStartDay:'账期起始日',leaves:'请假',overtime:'加班',subsidies:'补贴',deductions:'扣款',advances:'预支',payments:'实发工资',payment:'实发工资',months:'月份账本'};
 return parts.filter(x=>!String(x).startsWith('id:')).map(x=>String(x).startsWith('date:')?String(x).slice(5):names[x]||x).join(' · ');
}
export function mergeBooks(base,local,remote,resolution=''){
 if(!base)throw new Error('缺少共同同步版本，请先确认首次同步的账本。');
 const conflicts=[];
 function collision(parts,b,l,r){if(!resolution)conflicts.push({path:parts,label:conflictLabel(parts),base:duplicate(b),local:duplicate(l),remote:duplicate(r)});return duplicate(resolution==='remote'?r:l);}
 function combine(b,l,r,parts=[]){
  if(equivalent(l,r))return duplicate(l);if(equivalent(l,b))return duplicate(r);if(equivalent(r,b))return duplicate(l);
  const field=parts.at(-1);
  if(field==='excludedMonths'){
   const result=[];for(const month of new Set([...(b||[]),...(l||[]),...(r||[])]))if(combine((b||[]).includes(month),(l||[]).includes(month),(r||[]).includes(month),[...parts,month]))result.push(month);return result.sort();
  }
  if(recordFields.has(field)&&Array.isArray(l)&&Array.isArray(r)){
   const index=values=>{const map=new Map();for(const item of values||[]){const key=recordKey(field,item);if(map.has(key))throw new Error('同步记录存在重复编号或请假日期，请检查原账本。');map.set(key,item);}return map;};
   const bm=index(b),lm=index(l),rm=index(r),result=[];
   for(const key of [...new Set([...bm.keys(),...lm.keys(),...rm.keys()])].sort()){
    const bv=bm.get(key),lv=lm.get(key),rv=rm.get(key),item=equivalent(lv,rv)?duplicate(lv):equivalent(lv,bv)?duplicate(rv):equivalent(rv,bv)?duplicate(lv):collision([...parts,key],bv,lv,rv);
    if(item!==undefined)result.push(item);
   }return result;
  }
  if(field==='tombstones'){
   const result=Object.create(null);
   for(const key of new Set([...Object.keys(b||{}),...Object.keys(l||{}),...Object.keys(r||{})])){
    const bv=b?.[key],lv=l?.[key],rv=r?.[key],value=equivalent(lv,rv)?lv:equivalent(lv,bv)?rv:equivalent(rv,bv)?lv:[lv,rv].filter(Boolean).sort().at(-1);
    if(value!==undefined)result[key]=value;
   }return result;
  }
  if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)&&field!=='payment'){
   const result=Object.create(null);for(const key of [...new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])].sort()){const value=combine(b?.[key],l[key],r[key],[...parts,key]);if(value!==undefined)result[key]=value;}return result;
  }
  return collision(parts,b,l,r);
 }
 const book=combine(base,local,remote),entities=recordEntities(book);
 if(book.tombstones){for(const key of entities.keys())delete book.tombstones[key];if(!Object.keys(book.tombstones).length)delete book.tombstones;}
 return {book,conflicts};
}
