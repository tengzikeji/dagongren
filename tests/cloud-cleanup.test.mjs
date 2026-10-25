import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPairedCleanup} from '../dist/cloud-cleanup.js';
const month=(id,date)=>({salaryCents:600000,company:'公司',joinDate:'2025-01-01',subsidies:[{id,date,amountCents:10000}],leaves:[],payments:[],advances:[],overtime:[],deductions:[]});
const book=months=>({version:2,defaults:{company:'保留设置',salaryCents:600000},months,excludedMonths:[]});
test('一并按年份清理保留其他年份且不改变输入账本',()=>{
 const local=book({'2025-01':month('a','2025-01-20'),'2026-01':month('b','2026-01-20')}),remote=book({'2025-12':month('c','2025-12-20'),'2026-02':month('d','2026-02-20')});const original=JSON.stringify([local,remote]);
 const result=buildPairedCleanup(local,remote,{scope:'year',year:'2025'},'cleanup-year');assert.deepEqual(Object.keys(result.local.months),['2026-01']);assert.deepEqual(Object.keys(result.remote.months),['2026-02']);assert.deepEqual(result.local.excludedMonths,['2025-01','2025-12']);assert.deepEqual(result.remote.excludedMonths,['2025-01','2025-12']);assert.equal(JSON.stringify([local,remote]),original);
});
test('一并清理全部仅移除账本月份并共享本次删除标记',()=>{
 const local=book({'2025-01':month('a','2025-01-20')}),remote=book({'2026-02':month('b','2026-02-20')});remote.defaults.company='云端设置';const result=buildPairedCleanup(local,remote,{scope:'all'},'cleanup-all');assert.deepEqual(result.local.months,{});assert.deepEqual(result.remote.months,{});assert.equal(result.local.defaults.company,'保留设置');assert.equal(result.remote.defaults.company,'云端设置');assert.deepEqual(result.local.tombstones,result.remote.tombstones);assert.ok(Object.values(result.local.tombstones).every(v=>v==='cleanup-all'));
});
