import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalJSON} from '../dist/data-tools.js';
import {snapshotBook} from '../dist/sync-tools.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const sha=b=>createHash('sha256').update(canonicalJSON(snapshotBook(b))).digest('hex');
const defaults={salaryCents:600000,company:'测试公司',joinDate:'2026-10-01',payday:15,periodMode:'calendar',periodStartDay:1,holidayLeaveDeduct:false,adjustedLeaveDeduct:false,motion:true};
const seed=()=>({version:2,defaults:{...defaults},months:{'2026-10':{...defaults,leaves:[],overtime:[],subsidies:[],deductions:[],advances:[],payments:[],payment:null}},excludedMonths:[]});
const entry=(id,amount=10000)=>({id,date:'2026-10-20',amountCents:amount,category:'补贴',note:''});
const names=['calendar-data.js','calendar.js','payroll.js','data-tools.js','sync-tools.js','sync-merge.js','native-sync.js'];
const code=names.map(n=>fs.readFileSync(new URL('../dist/'+n,import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'').replace(/^export /gm,'')).join('\n')+'\nglobalThis.createSync=installNativeSync;';
function device(server,initial=seed()){
 let current=copy(initial),modal='',editing=false,writes=0,reads=0;
 current.sync={auto:true,pending:0,nativeVersion:1,baseline:sha(server.book),baseBook:copy(server.book),logs:[]};
 const timers=new Map(),events={},messages=[],storage=new Map();let id=0;
 const context=vm.createContext({console,Date,Intl,URL,queueMicrotask,navigator:{onLine:true},document:{visibilityState:'visible',getElementById:()=>null,addEventListener:(n,f)=>events[n]=f},window:{addEventListener:(n,f)=>events[n]=f},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:(fn,delay)=>{const key={id:++id,unref(){}};timers.set(key,{fn,delay});return key;},clearTimeout:k=>timers.delete(k)});
 context.AndroidFiles={status:()=>JSON.stringify({configured:true}),fingerprint:v=>createHash('sha256').update(v).digest('hex'),request(requestId,action,payload){
  queueMicrotask(()=>{if(action==='read'){reads++;context.dagongrenNativeResult(requestId,{ok:true,data:{exists:true,etag:'"'+server.version+'"',envelope:{format:'dagongren.webdav.v2',book:copy(server.book)}}});}
   else if(action==='write'){writes++;const d=JSON.parse(payload);server.onWrite?.(d);if(d.etag!=='"'+server.version+'"'){context.dagongrenNativeResult(requestId,{ok:false,error:'网盘账本已被另一设备更新',code:412});return;}server.book=JSON.parse(d.content);server.version++;context.dagongrenNativeResult(requestId,{ok:true,data:{saved:true}});}
  });
 }};
 vm.runInContext(code,context);
 const api={getBook:()=>current,replaceBook:n=>current=n,defaults,today:()=> '2026-10-25',storageBlocked:()=>false,editing:()=>editing,persist(){},render(){},toast:m=>messages.push(m),showModal:(t,b)=>modal=t+b,closeModal:()=>modal='',esc:x=>String(x)};
 const sync=context.createSync(api);
 return {sync,get:()=>current,modal:()=>modal,messages,context,events,setEditing:v=>editing=v,reads:()=>reads,writes:()=>writes,async flush(delay){for(const [k,t] of [...timers])if(t.delay===delay){timers.delete(k);t.fn();}await new Promise(r=>setImmediate(r));}};
}
test('双设备不同新增自动合并且不重复',async()=>{const s={book:seed(),version:1},a=device(s),b=device(s);a.get().months['2026-10'].subsidies.push(entry('a'));b.get().months['2026-10'].subsidies.push(entry('b',20000));await a.sync.run();await b.sync.run();await a.sync.run('normal',true);for(const d of [a,b])assert.deepEqual([...d.get().months['2026-10'].subsidies].map(x=>x.id).sort(),['a','b']);assert.equal(s.book.months['2026-10'].subsidies.length,2);assert.equal(a.modal(),'');assert.equal(b.modal(),'');a.sync.dispose();b.sync.dispose();});
test('未编辑设备通过前台轮询收到远端新增',async()=>{const s={book:seed(),version:1},a=device(s),b=device(s);await a.sync.run();b.get().months['2026-10'].subsidies.push(entry('remote'));await b.sync.run();const n=a.reads();await a.flush(30000);assert.ok(a.reads()>n);assert.equal(a.get().months['2026-10'].subsidies[0].id,'remote');a.sync.dispose();b.sync.dispose();});
test('版本竞争重读重合并，不覆盖另一端新增',async()=>{const s={book:seed(),version:1},a=device(s);a.get().months['2026-10'].subsidies.push(entry('a'));s.onWrite=()=>{s.onWrite=null;s.book.months['2026-10'].subsidies.push(entry('racer'));s.version++;};await a.sync.run();assert.equal(a.writes(),2);assert.deepEqual(s.book.months['2026-10'].subsidies.map(x=>x.id).sort(),['a','racer']);assert.equal(a.modal(),'');a.sync.dispose();});
test('上传期间新增保留并在后续补传',async()=>{const s={book:seed(),version:1},a=device(s);a.get().months['2026-10'].subsidies.push(entry('first'));s.onWrite=()=>{s.onWrite=null;a.get().months['2026-10'].subsidies.push(entry('during-upload'));};await a.sync.run();assert.equal(a.get().months['2026-10'].subsidies.length,2);assert.ok(a.get().sync.pending);await a.sync.run();assert.equal(s.book.months['2026-10'].subsidies.length,2);assert.equal(a.get().sync.pending,0);a.sync.dispose();});
test('同笔冲突确认后仍保留双方其他新增',async()=>{const initial=seed();initial.months['2026-10'].subsidies=[entry('same')];const s={book:copy(initial),version:1},a=device(s,initial),b=device(s,initial);a.get().months['2026-10'].subsidies[0].amountCents=20000;a.get().months['2026-10'].subsidies.push(entry('a'));b.get().months['2026-10'].subsidies[0].amountCents=30000;b.get().months['2026-10'].subsidies.push(entry('b'));await a.sync.run();await b.sync.run();assert.equal(b.writes(),0);assert.match(b.modal(),/同一条记录/);assert.match(b.modal(),/¥300\.00/);assert.match(b.modal(),/¥200\.00/);await b.sync.run('upload');assert.equal(s.book.months['2026-10'].subsidies.length,3);assert.equal(s.book.months['2026-10'].subsidies.find(x=>x.id==='same').amountCents,30000);a.sync.dispose();b.sync.dispose();});
test('编辑和断网期间暂停，联网后自动补齐',async()=>{const s={book:seed(),version:1},a=device(s);a.setEditing(true);await a.sync.run('normal',true);assert.equal(a.reads(),0);a.setEditing(false);a.context.navigator.onLine=false;a.get().months['2026-10'].subsidies.push(entry('offline'));await a.sync.run();assert.equal(a.writes(),0);a.context.navigator.onLine=true;a.events.online();await a.flush(100);assert.equal(s.book.months['2026-10'].subsidies[0].id,'offline');a.sync.dispose();});
test('本机清理不自动传播到网盘',async()=>{const initial=seed();initial.months['2026-10'].subsidies=[entry('keep')];const s={book:copy(initial),version:1},a=device(s,initial);a.get().months['2026-10'].subsidies=[];a.get().sync.pausedByCleanup=true;await a.sync.run();assert.equal(a.writes(),0);assert.equal(s.book.months['2026-10'].subsidies.length,1);assert.match(a.modal(),/确认/);a.sync.dispose();});

test('清理发生于上传过程中时在途响应不恢复本机或解除暂停',async()=>{const s={book:seed(),version:1},a=device(s);a.get().months['2026-10'].subsidies.push(entry('old'));s.onWrite=()=>{s.onWrite=null;a.get().months={};a.get().sync.pausedByCleanup=true;a.get().sync.auto=false;a.sync.beforeCleanup();};await a.sync.run();assert.deepEqual(a.get().months,{});assert.equal(a.get().sync.pausedByCleanup,true);assert.equal(a.get().sync.auto,false);a.sync.dispose();});
