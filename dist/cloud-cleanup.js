import {makeCleanupPlan,applyCleanupPlan} from './data-tools.js';
import {snapshotBook} from './sync-tools.js';
import {rememberDeletions} from './sync-merge.js';
export function buildPairedCleanup(local,remote,options,revision){
 if(typeof revision!=='string'||!revision||revision.length>150)throw new Error('清理标识无效，未修改任何记录。');
 const plan=makeCleanupPlan(local.months,remote?.months||{},{...options,target:'both'});
 const cleaned=applyCleanupPlan(local.months,remote?.months||{},plan),keys=[...new Set([...plan.localAccrualKeys,...plan.cloudAccrualKeys])];
 const nextLocal=snapshotBook(local),nextRemote=remote?snapshotBook(remote):null;
 const belongs=(book,month)=>typeof options.company!=='string'||!book.months[month]||(book.months[month].company||'')===options.company;
 nextLocal.months=cleaned.local;nextLocal.excludedMonths=[...new Set([...nextLocal.excludedMonths,...keys.filter(month=>belongs(nextLocal,month))])].sort();rememberDeletions(nextLocal,local,revision);
 if(nextRemote){nextRemote.months=cleaned.cloud;nextRemote.excludedMonths=[...new Set([...nextRemote.excludedMonths,...keys.filter(month=>belongs(nextRemote,month))])].sort();rememberDeletions(nextRemote,remote,revision);}
 const marks=Object.fromEntries([...Object.entries(nextLocal.tombstones||{}),...Object.entries(nextRemote?.tombstones||{})].filter(([,value])=>value===revision));
 for(const book of [nextLocal,nextRemote])if(book&&Object.keys(marks).length){
  const relevant=Object.fromEntries(Object.entries(marks).filter(([key])=>{const parts=JSON.parse(key),month=parts[1],r=book.months[month];if(belongs(book,month))return true;if(!['advances','payments','payment'].includes(parts[2]))return false;const item=parts[2]==='payment'?r.payment:(r[parts[2]]||[]).find(item=>'id:'+item.id===parts[3]);return !item||(item.company??r.company??'')===options.company;}));
  if(Object.keys(relevant).length)book.tombstones={...(book.tombstones||{}),...relevant};
 }
 return {plan,local:nextLocal,remote:nextRemote};
}
