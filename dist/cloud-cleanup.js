import {makeCleanupPlan,applyCleanupPlan} from './data-tools.js';
import {snapshotBook} from './sync-tools.js';
import {rememberDeletions} from './sync-merge.js';
export function buildPairedCleanup(local,remote,options,revision){
 if(typeof revision!=='string'||!revision||revision.length>150)throw new Error('清理标识无效，未修改任何记录。');
 const plan=makeCleanupPlan(local.months,remote?.months||{},{...options,target:'both'});
 const cleaned=applyCleanupPlan(local.months,remote?.months||{},plan),keys=[...new Set([...plan.localKeys,...plan.cloudKeys])];
 const nextLocal=snapshotBook(local),nextRemote=remote?snapshotBook(remote):null;
 nextLocal.months=cleaned.local;nextLocal.excludedMonths=[...new Set([...nextLocal.excludedMonths,...keys])].sort();rememberDeletions(nextLocal,local,revision);
 if(nextRemote){nextRemote.months=cleaned.cloud;nextRemote.excludedMonths=[...new Set([...nextRemote.excludedMonths,...keys])].sort();rememberDeletions(nextRemote,remote,revision);}
 const marks=Object.fromEntries([...Object.entries(nextLocal.tombstones||{}),...Object.entries(nextRemote?.tombstones||{})].filter(([,value])=>value===revision));
 for(const book of [nextLocal,nextRemote])if(book&&Object.keys(marks).length)book.tombstones={...(book.tombstones||{}),...marks};
 return {plan,local:nextLocal,remote:nextRemote};
}
