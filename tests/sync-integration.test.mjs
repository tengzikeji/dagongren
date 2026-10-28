import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalJSON} from '../dist/data-tools.js';
import {snapshotBook} from '../dist/sync-tools.js';
import {migrateBook,ensureAccrualMonths} from '../dist/payroll.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const sha=b=>createHash('sha256').update(canonicalJSON(snapshotBook(b))).digest('hex');
const defaults={salaryCents:600000,company:'测试公司',joinDate:'2026-10-01',payday:15,periodMode:'calendar',periodStartDay:1,holidayLeaveDeduct:false,adjustedLeaveDeduct:false,motion:true};
const seed=()=>({version:2,defaults:{...defaults},months:{'2026-10':{...defaults,leaves:[],overtime:[],subsidies:[],deductions:[],advances:[],payments:[],payment:null}},excludedMonths:[]});
const entry=(id,amount=10000)=>({id,date:'2026-10-20',amountCents:amount,category:'补贴',note:''});
const names=['calendar-data.js','calendar.js','payroll.js','data-tools.js','sync-tools.js','sync-merge.js','cloud-cleanup.js','native-sync.js'];
test('下拉同步的成功与失败不关联底部提示框',async()=>{for(const failure of [false,true]){const s={book:seed(),version:1,...(failure?{readError:'连接失败'}:{})},a=device(s);try{const result=await a.sync.run('normal',false,{source:'pull'});assert.equal(result.state,failure?'error':'success');assert.deepEqual(a.messages,[]);}finally{a.sync.dispose();}}});
const code=names.map(n=>fs.readFileSync(new URL('../dist/'+n,import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'').replace(/^export /gm,'')).join('\n')+'\nglobalThis.createSync=installNativeSync;';
function device(server,initial=seed()){
 let current=copy(initial),modal='',editing=false,interacting=false,writes=0,reads=0;
 current.sync={auto:true,pending:0,nativeVersion:1,baseline:sha(server.book),baseBook:copy(server.book),logs:[],...copy(initial.sync||{})};
 const timers=new Map(),events={},messages=[],states=[],storage=new Map();let id=0,failStorageKey='';
 const context=vm.createContext({console,Date,Intl,URL,queueMicrotask,navigator:{onLine:true},document:{visibilityState:'visible',getElementById:()=>null,addEventListener:(n,f)=>events[n]=f},window:{addEventListener:(n,f)=>events[n]=f},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(k===failStorageKey)throw new Error('QuotaExceeded');storage.set(k,v)}},setTimeout:(fn,delay)=>{const key={id:++id,unref(){}};timers.set(key,{fn,delay});return key;},clearTimeout:k=>timers.delete(k)});
 context.AndroidFiles={status:()=>JSON.stringify({configured:server.configured!==false,path:'打工人/工资账本.json'}),fingerprint:v=>createHash('sha256').update(v).digest('hex'),request(requestId,action,payload){
  queueMicrotask(()=>{if(action==='read'){reads++;if(server.readError){context.dagongrenNativeResult(requestId,{ok:false,error:server.readError});return;}if(server.exists===false){context.dagongrenNativeResult(requestId,{ok:true,data:{exists:false}});return;}context.dagongrenNativeResult(requestId,{ok:true,data:{exists:true,etag:'"'+server.version+'"',envelope:{format:'dagongren.webdav.v2',book:copy(server.book)}}});}
   else if(action==='write'){writes++;const d=JSON.parse(payload);server.onWrite?.(d);if(d.etag!=='"'+server.version+'"'){context.dagongrenNativeResult(requestId,{ok:false,error:'网盘账本已被另一设备更新',code:412});return;}server.book=JSON.parse(d.content);server.version++;if(server.loseWriteReply){server.loseWriteReply=false;context.dagongrenNativeResult(requestId,{ok:false,error:'连接中断，结果未确认'});return;}context.dagongrenNativeResult(requestId,{ok:true,data:{saved:true}});}
  });
 }};
 vm.runInContext(code,context);
 const api={onState:s=>states.push(copy(s)),getBook:()=>current,replaceBook:n=>current=n,defaults,today:()=> '2026-10-25',storageBlocked:()=>false,editing:()=>editing,interacting:()=>interacting,persist(){},render(){},toast:m=>messages.push(m),showModal:(t,b)=>modal=t+b,closeModal:()=>modal='',esc:x=>String(x)};
 const sync=context.createSync(api);
 return {sync,states,get:()=>current,failStorage:key=>failStorageKey=key,storage,modal:()=>modal,messages,context,events,setEditing:v=>editing=v,setInteracting:v=>interacting=v,reads:()=>reads,writes:()=>writes,async flush(delay){for(const [k,t] of [...timers])if(t.delay===delay){timers.delete(k);t.fn();}await new Promise(r=>setImmediate(r));}};
}
test('双设备不同新增自动合并且不重复',async()=>{const s={book:seed(),version:1},a=device(s),b=device(s);a.get().months['2026-10'].subsidies.push(entry('a'));b.get().months['2026-10'].subsidies.push(entry('b',20000));await a.sync.run();await b.sync.run();await a.sync.run('normal',true);for(const d of [a,b])assert.deepEqual([...d.get().months['2026-10'].subsidies].map(x=>x.id).sort(),['a','b']);assert.equal(s.book.months['2026-10'].subsidies.length,2);assert.equal(a.modal(),'');assert.equal(b.modal(),'');a.sync.dispose();b.sync.dispose();});
test('未编辑设备通过前台轮询收到远端新增',async()=>{const s={book:seed(),version:1},a=device(s),b=device(s);await a.sync.run();b.get().months['2026-10'].subsidies.push(entry('remote'));await b.sync.run();const n=a.reads();await a.flush(30000);assert.ok(a.reads()>n);assert.equal(a.get().months['2026-10'].subsidies[0].id,'remote');a.sync.dispose();b.sync.dispose();});
test('版本竞争重读重合并，不覆盖另一端新增',async()=>{const s={book:seed(),version:1},a=device(s);a.get().months['2026-10'].subsidies.push(entry('a'));s.onWrite=()=>{s.onWrite=null;s.book.months['2026-10'].subsidies.push(entry('racer'));s.version++;};await a.sync.run();assert.equal(a.writes(),2);assert.deepEqual(s.book.months['2026-10'].subsidies.map(x=>x.id).sort(),['a','racer']);assert.equal(a.modal(),'');a.sync.dispose();});
test('上传期间新增保留并在后续补传',async()=>{const s={book:seed(),version:1},a=device(s);a.get().months['2026-10'].subsidies.push(entry('first'));s.onWrite=()=>{s.onWrite=null;a.get().months['2026-10'].subsidies.push(entry('during-upload'));};await a.sync.run();assert.equal(a.get().months['2026-10'].subsidies.length,2);assert.ok(a.get().sync.pending);await a.sync.run();assert.equal(s.book.months['2026-10'].subsidies.length,2);assert.equal(a.get().sync.pending,0);a.sync.dispose();});
test('同笔冲突确认后仍保留双方其他新增',async()=>{const initial=seed();initial.months['2026-10'].subsidies=[entry('same')];const s={book:copy(initial),version:1},a=device(s,initial),b=device(s,initial);a.get().months['2026-10'].subsidies[0].amountCents=20000;a.get().months['2026-10'].subsidies.push(entry('a'));b.get().months['2026-10'].subsidies[0].amountCents=30000;b.get().months['2026-10'].subsidies.push(entry('b'));await a.sync.run();await b.sync.run();assert.equal(b.writes(),0);assert.match(b.modal(),/同一条记录/);assert.match(b.modal(),/¥300\.00/);assert.match(b.modal(),/¥200\.00/);await b.sync.run('upload');assert.equal(s.book.months['2026-10'].subsidies.length,3);assert.equal(s.book.months['2026-10'].subsidies.find(x=>x.id==='same').amountCents,30000);a.sync.dispose();b.sync.dispose();});
test('编辑和断网期间暂停，联网后自动补齐',async()=>{const s={book:seed(),version:1},a=device(s);a.setEditing(true);await a.sync.run('normal',true);assert.equal(a.reads(),0);a.setEditing(false);a.context.navigator.onLine=false;a.get().months['2026-10'].subsidies.push(entry('offline'));await a.sync.run();assert.equal(a.writes(),0);a.context.navigator.onLine=true;a.events.online();await a.flush(100);assert.equal(s.book.months['2026-10'].subsidies[0].id,'offline');a.sync.dispose();});
test('本机清理不自动传播到网盘',async()=>{const initial=seed();initial.months['2026-10'].subsidies=[entry('keep')];const s={book:copy(initial),version:1},a=device(s,initial);a.get().months['2026-10'].subsidies=[];a.get().sync.pausedByCleanup=true;await a.sync.run();assert.equal(a.writes(),0);assert.equal(s.book.months['2026-10'].subsidies.length,1);assert.match(a.modal(),/确认/);a.sync.dispose();});

test('清理发生于上传过程中时在途响应不恢复本机或解除暂停',async()=>{const s={book:seed(),version:1},a=device(s);a.get().months['2026-10'].subsidies.push(entry('old'));s.onWrite=()=>{s.onWrite=null;a.get().months={};a.get().sync.pausedByCleanup=true;a.get().sync.auto=false;a.sync.beforeCleanup();};await a.sync.run();assert.deepEqual(a.get().months,{});assert.equal(a.get().sync.pausedByCleanup,true);assert.equal(a.get().sync.auto,false);a.sync.dispose();});

test('云端一并清理先核对数量，确认前两端均不修改',async()=>{
 const initial=seed();initial.months['2026-10'].subsidies=[entry('keep')];const s={book:copy(initial),version:1},a=device(s,initial);
 try{await a.sync.reviewCleanup({scope:'month',month:'2026-10'});assert.equal(a.writes(),0);assert.equal(a.get().months['2026-10'].subsidies.length,1);assert.equal(s.book.months['2026-10'].subsidies.length,1);assert.match(a.modal(),/本机记录/);assert.match(a.modal(),/云端记录/);}
 finally{a.sync.dispose();}
});
test('一并清理仅删除所选月份，保留双方范围外记录及各自设置',async()=>{
 const local=seed(),remote=seed();local.months['2026-09']={...copy(local.months['2026-10']),subsidies:[{...entry('local-outside'),date:'2026-09-20'}]};remote.months['2026-08']={...copy(remote.months['2026-10']),subsidies:[{...entry('remote-outside'),date:'2026-08-20'}]};remote.defaults.company='云端原设置';
 const s={book:remote,version:1},a=device(s,local);
 try{await a.sync.reviewCleanup({scope:'month',month:'2026-10'});s.book.months['2026-08'].subsidies[0].note='确认期间新增备注';s.version++;assert.equal(await a.sync.confirmCleanup(),true);assert.equal(a.get().months['2026-10'],undefined);assert.equal(s.book.months['2026-10'],undefined);assert.equal(s.book.months['2026-08'].subsidies[0].note,'确认期间新增备注');assert.equal(a.get().months['2026-09'].subsidies[0].id,'local-outside');assert.equal(s.book.months['2026-08'].subsidies[0].id,'remote-outside');assert.equal(s.book.defaults.company,'云端原设置');assert.equal(a.get().defaults.company,'测试公司');assert.equal(a.get().sync.auto,true);assert.equal(a.get().sync.pendingCleanup,undefined);}
 finally{a.sync.dispose();}
});
test('一并清理确认前所选云端数据发生变化时保留两端',async()=>{
 const s={book:seed(),version:1},a=device(s);try{await a.sync.reviewCleanup({scope:'month',month:'2026-10'});s.book.months['2026-10'].subsidies.push(entry('new'));s.version++;assert.equal(await a.sync.confirmCleanup(),false);assert.equal(a.writes(),0);assert.ok(a.get().months['2026-10']);assert.equal(s.book.months['2026-10'].subsidies[0].id,'new');}finally{a.sync.dispose();}
});
test('云端清理遇到条件版本竞争时不重试覆盖，本机仍保留',async()=>{
 const s={book:seed(),version:1},a=device(s);try{await a.sync.reviewCleanup({scope:'month',month:'2026-10'});s.onWrite=()=>{s.onWrite=null;s.book.months['2026-10'].subsidies.push(entry('racer'));s.version++;};assert.equal(await a.sync.confirmCleanup(),false);assert.equal(a.writes(),1);assert.ok(a.get().months['2026-10']);assert.equal(s.book.months['2026-10'].subsidies[0].id,'racer');assert.equal(a.get().sync.auto,true);assert.ok(a.get().sync.pendingCleanup);}finally{a.sync.dispose();}
});
test('云端写入成功但回包丢失时核验内容后再清本机',async()=>{
 const s={book:seed(),version:1,loseWriteReply:true},a=device(s);try{await a.sync.reviewCleanup({scope:'month',month:'2026-10'});assert.equal(await a.sync.confirmCleanup(),true);assert.equal(a.writes(),1);assert.equal(a.reads(),3);assert.equal(a.get().months['2026-10'],undefined);assert.equal(s.book.months['2026-10'],undefined);}finally{a.sync.dispose();}
});
test('云端已清理但本机保存失败时暂停同步，重新核对可完成本机清理',async()=>{
 const s={book:seed(),version:1},a=device(s);try{await a.sync.reviewCleanup({scope:'month',month:'2026-10'});s.onWrite=()=>{s.onWrite=null;a.failStorage('dagongren.paybook.v1');};assert.equal(await a.sync.confirmCleanup(),false);assert.ok(a.get().months['2026-10']);assert.equal(s.book.months['2026-10'],undefined);assert.ok(a.get().sync.pendingCleanup);assert.equal(a.get().sync.auto,true);a.failStorage('');await a.sync.reviewCleanup(a.get().sync.pendingCleanup.options);assert.equal(await a.sync.confirmCleanup(),true);assert.equal(a.get().months['2026-10'],undefined);assert.equal(a.get().sync.pendingCleanup,undefined);}finally{a.sync.dispose();}
});
test('云端读取失败时不清理本机，也不提交写入',async()=>{
 const s={book:seed(),version:1,readError:'连接暂不可用'},a=device(s);try{await a.sync.reviewCleanup({scope:'month',month:'2026-10'});assert.ok(a.get().months['2026-10']);assert.equal(a.writes(),0);assert.equal(await a.sync.confirmCleanup(),undefined);}finally{a.sync.dispose();}
});

test('另一台未修改的设备拉取清理结果时不会恢复已清月份',async()=>{
 const initial=seed();initial.months['2026-10'].subsidies=[entry('remove')];const s={book:copy(initial),version:1},a=device(s,initial),b=device(s,initial);
 try{await a.sync.reviewCleanup({scope:'month',month:'2026-10'});assert.equal(await a.sync.confirmCleanup(),true);await b.sync.run('normal',true);assert.equal(b.get().months['2026-10'],undefined);assert.ok(b.get().excludedMonths.includes('2026-10'));assert.equal(b.writes(),0);assert.equal(s.book.months['2026-10'],undefined);}finally{a.sync.dispose();b.sync.dispose();}
});
test('重启后未确认的清理若两端均为空，可核对后解除待处理状态',async()=>{
 const initial=seed();initial.months={};initial.excludedMonths=['2026-10'];initial.sync={nativeVersion:1,auto:true,pendingCleanup:{id:'interrupted',options:{scope:'month',month:'2026-10'}}};const s={book:{...seed(),months:{},excludedMonths:['2026-10']},version:1},a=device(s,initial);
 try{assert.equal(a.get().sync.auto,true);await a.sync.reviewCleanup(a.get().sync.pendingCleanup.options);assert.equal(a.get().sync.pendingCleanup,undefined);assert.equal(a.get().sync.auto,true);assert.equal(a.writes(),0);}finally{a.sync.dispose();}
});

test('云端清理成功后进程中断，重启保持本机与暂停状态且可核对完成',async()=>{
 const s={book:seed(),version:1},a=device(s);let restarted;
 try{
  await a.sync.reviewCleanup({scope:'month',month:'2026-10'});s.onWrite=()=>{s.onWrite=null;a.failStorage('dagongren.paybook.v1');};assert.equal(await a.sync.confirmCleanup(),false);
  const persisted=JSON.parse(a.storage.get('dagongren.paybook.v1'));assert.ok(persisted.sync.pendingCleanup);assert.ok(persisted.months['2026-10']);a.sync.dispose();
  const migrated=migrateBook(persisted,defaults,'2026-10-25');ensureAccrualMonths(migrated,'2026-10-25');restarted=device(s,migrated);await restarted.flush(500);assert.equal(restarted.reads(),0);assert.equal(restarted.writes(),0);assert.equal(restarted.get().sync.auto,true);assert.ok(restarted.get().months['2026-10']);
  await restarted.sync.reviewCleanup(restarted.get().sync.pendingCleanup.options);assert.equal(await restarted.sync.confirmCleanup(),true);assert.equal(restarted.get().months['2026-10'],undefined);assert.equal(restarted.get().sync.pendingCleanup,undefined);assert.ok(restarted.get().excludedMonths.includes('2026-10'));
 }finally{a.sync.dispose();restarted?.sync.dispose();}
});

test('一并清理后原来开启的自动同步继续上传新修改，不恢复已清月份',async()=>{
 const initial=seed();initial.months['2026-09']={...copy(initial.months['2026-10']),joinDate:'2026-09-01'};initial.defaults.joinDate='2026-09-01';
 const s={book:copy(initial),version:1},a=device(s,initial);
 try{await a.sync.reviewCleanup({scope:'month',month:'2026-10'});assert.equal(await a.sync.confirmCleanup(),true);assert.equal(a.get().sync.auto,true);assert.equal(a.get().sync.pausedByCleanup,false);a.get().months['2026-09'].subsidies.push({...entry('after-cleanup'),date:'2026-09-20'});a.sync.schedule();await a.flush(2500);assert.equal(s.book.months['2026-09'].subsidies[0].id,'after-cleanup');assert.equal(s.book.months['2026-10'],undefined);assert.equal(a.modal(),'');}finally{a.sync.dispose();}
});
test('一并清理保留原来关闭的自动同步开关，取消和云端失败也不改开关',async()=>{
 for(const auto of [true,false]){
  const initial=seed();initial.sync={auto};const s={book:seed(),version:1},a=device(s,initial);
  try{
   await a.sync.reviewCleanup({scope:'month',month:'2026-10'});a.sync.cancelCleanupReview();assert.equal(a.get().sync.auto,auto);assert.ok(a.get().months['2026-10']);
   await a.sync.reviewCleanup({scope:'month',month:'2026-10'});assert.equal(await a.sync.confirmCleanup(),true);assert.equal(a.get().sync.auto,auto);assert.equal(a.get().sync.pausedByCleanup,false);
  }finally{a.sync.dispose();}
 }
});


test('自动同步先报告执行中，只有远端确认完成才报告成功',async()=>{
 const s={book:seed(),version:1},a=device(s);
 try{const task=a.sync.run('normal',true);assert.equal(a.states.at(-1).state,'syncing');assert.equal(a.states.at(-1).source,'auto');const result=await task;assert.equal(result.state,'success');assert.deepEqual(a.states.map(x=>x.state),['syncing','success']);assert.equal(a.reads(),1);assert.equal(a.writes(),0);}
 finally{a.sync.dispose();}
});
test('手动下拉加入在途自动同步，不重复请求并保持手动反馈来源',async()=>{
 const s={book:seed(),version:1},a=device(s);
 try{const auto=a.sync.run('normal',true),pull=a.sync.run('normal',false,{source:'pull'});assert.equal(auto,pull);assert.equal(a.sync.feedback().source,'pull');assert.equal((await pull).state,'success');assert.equal(a.sync.feedback().source,'pull');assert.equal(a.reads(),1);}
 finally{a.sync.dispose();}
});
test('失败不会出现成功标识，后续重试成功能清除失败状态',async()=>{
 const s={book:seed(),version:1,readError:'网络中断，未完成同步'},a=device(s);
 try{const before=copy(a.get());assert.equal((await a.sync.run('normal',false,{source:'pull'})).state,'error');assert.equal(a.states.some(x=>x.state==='success'),false);assert.deepEqual(a.get().months,before.months);delete s.readError;assert.equal((await a.sync.run()).state,'success');}
 finally{a.sync.dispose();}
});
test('关闭自动同步和界面动效后手动下拉仍完成双向同步且不改开关',async()=>{
 const initial=seed();initial.defaults.motion=false;initial.sync={auto:false};const s={book:copy(initial),version:1},a=device(s,initial);
 try{s.book.months['2026-10'].subsidies.push(entry('pull-while-disabled'));s.version++;const result=await a.sync.run('normal',false,{source:'pull'});assert.equal(result.state,'success');assert.equal(result.source,'pull');assert.equal(a.get().sync.auto,false);assert.equal(a.get().defaults.motion,false);assert.equal(a.get().months['2026-10'].subsidies[0].id,'pull-while-disabled');}
 finally{a.sync.dispose();}
});
test('未配置、离线和正在编辑时均不伪报云端同步成功',async()=>{
 for(const condition of ['unconfigured','offline','editing']){const s={book:seed(),version:1,configured:condition!=='unconfigured'},a=device(s);
  try{if(condition==='offline')a.context.navigator.onLine=false;if(condition==='editing')a.setEditing(true);const result=await a.sync.run('normal',false,{source:'pull'});assert.ok(['error','attention'].includes(result.state));assert.equal(a.reads(),0);assert.equal(a.states.some(x=>x.state==='success'),false);}
  finally{a.sync.dispose();}
 }
});
test('同笔冲突等待确认时返回待处理状态，保留双方记录',async()=>{
 const initial=seed();initial.months['2026-10'].subsidies=[entry('same')];const s={book:copy(initial),version:1},a=device(s,initial);
 try{a.get().months['2026-10'].subsidies[0].amountCents=20000;s.book.months['2026-10'].subsidies[0].amountCents=30000;s.version++;const result=await a.sync.run('normal',false,{source:'pull'});assert.equal(result.state,'attention');assert.equal(a.states.some(x=>x.state==='success'),false);assert.equal(a.writes(),0);assert.equal(a.get().months['2026-10'].subsidies[0].amountCents,20000);assert.equal(s.book.months['2026-10'].subsidies[0].amountCents,30000);}
 finally{a.sync.dispose();}
});

 test('手指正在操作时自动同步延后，手势结束后再读取云端',async()=>{
 const s={book:seed(),version:1},a=device(s);
 try{await new Promise(r=>setImmediate(r));a.setInteracting(true);await a.sync.run('normal',true);assert.equal(a.reads(),0);assert.equal(a.states.some(x=>x.state==='syncing'),false);a.setInteracting(false);await a.flush(150);assert.equal(a.reads(),1);assert.equal(a.sync.feedback().state,'success');}
 finally{a.sync.dispose();}
});

 test('同步成功后新增待上传记录会清除绿色成功态，补传确认后再恢复',async()=>{
 const s={book:seed(),version:1},a=device(s);
 try{await a.sync.run();assert.equal(a.sync.feedback().state,'success');a.get().months['2026-10'].subsidies.push(entry('after-success'));a.get().sync.pending=1;assert.equal(a.sync.feedback().state,'idle');assert.match(a.sync.feedback().message,/待同步/);await a.sync.run('normal',false,{source:'pull'});assert.equal(a.sync.feedback().state,'success');assert.equal(s.book.months['2026-10'].subsidies[0].id,'after-success');}
 finally{a.sync.dispose();}
});
