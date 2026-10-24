import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {snapshotBook,chooseSyncAction,isEmptyBook,validateRemoteEnvelope} from '../dist/sync-tools.js';
import {canonicalJSON} from '../dist/data-tools.js';
import {installNativeSync} from '../dist/native-sync.js';
const defaults={salaryCents:0,company:'',joinDate:'2026-10-24',payday:15,periodMode:'calendar',periodStartDay:1,holidayLeaveDeduct:false,adjustedLeaveDeduct:false,motion:true};
const empty=()=>({version:2,defaults:{...defaults},months:{},excludedMonths:[],sync:{auto:false,pending:0,logs:[]}});
const wages=(salary=600000)=>({...empty(),defaults:{...defaults,salaryCents:salary,company:'测试公司'},months:{'2026-10':{...defaults,salaryCents:salary,company:'测试公司',leaves:[],overtime:[],advances:[],payments:[],payment:null}}});
const hash=book=>createHash('sha256').update(canonicalJSON(snapshotBook(book))).digest('hex');
test('首次空账本可下载，有本机记录时先确认',()=>{
 assert.equal(chooseSyncAction(hash(empty()),hash(wages()),null,true,true),'download');
 assert.equal(chooseSyncAction(hash(wages()),hash(wages(700000)),null,true,false),'conflict');
});
test('双端各自修改时不自动覆盖或相加',()=>{
 const base=hash(wages()),local=hash(wages(700000)),remote=hash(wages(800000));
 assert.equal(chooseSyncAction(local,remote,base,true),'conflict');
 assert.equal(chooseSyncAction(base,remote,base,true),'download');
 assert.equal(chooseSyncAction(local,base,base,true),'upload');
});
test('网盘文件被删除后不会自动复活',()=>{
 assert.equal(chooseSyncAction('local',null,'previous',false),'conflict');
 assert.equal(chooseSyncAction('local',null,null,false),'upload');
});
test('同步载荷不包含连接密码或账号',()=>{
 const book=wages();book.sync={password:'test-only-value',username:'example@example.invalid',baseline:'x',logs:['log']};
 assert.deepEqual(Object.keys(snapshotBook(book)).sort(),['defaults','excludedMonths','months','version']);
 assert.equal(JSON.stringify(snapshotBook(book)).includes('test-only-value'),false);
});
test('同步载荷保留删除标记',()=>{
 const book=empty();book.excludedMonths=['2026-09'];assert.deepEqual(snapshotBook(book).excludedMonths,['2026-09']);
});
test('工资主体或任意记录均不视为空账本',()=>{
 assert.equal(isEmptyBook(empty()),true);assert.equal(isEmptyBook(wages()),false);
 const book=empty();book.months['2026-10']={salaryCents:0,leaves:[{date:'2026-10-24'}]};assert.equal(isEmptyBook(book),false);
});
test('错误格式不能覆盖本机',()=>{
 for(const value of [{},{format:'other',book:wages()},{format:'dagongren.webdav.v1',book:{...wages(),version:3}}])assert.throws(()=>validateRemoteEnvelope(value));
 assert.equal(validateRemoteEnvelope({format:'dagongren.webdav.v1',book:wages()}).version,2);
});
function fixture(initial,readResponse,writeResponse={}){
 let current=initial,modal='',messages=[],calls=[],writes=0,onRead=null;
 const stored=new Map(),elements={};
 globalThis.localStorage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
 globalThis.document={getElementById:id=>elements[id]??={textContent:'',disabled:false}};
 globalThis.AndroidFiles={
  status:()=>JSON.stringify({configured:true,url:'https://dav.jianguoyun.com/dav/',username:'example@example.invalid',path:'打工人/工资账本.json'}),
  fingerprint:text=>createHash('sha256').update(text).digest('hex'),
  request(id,action,payload){calls.push({action,payload:JSON.parse(payload)});queueMicrotask(()=>{
   if(action==='read'){if(onRead)onRead();globalThis.dagongrenNativeResult(id,{ok:true,data:readResponse});}
   else if(action==='write'){writes++;globalThis.dagongrenNativeResult(id,writeResponse.error?{ok:false,error:writeResponse.error}:{ok:true,data:{saved:true}});}
   else globalThis.dagongrenNativeResult(id,{ok:true,data:{}});
  });}
 };
 const api={getBook:()=>current,replaceBook:next=>{current=next},defaults,today:()=> '2026-10-24',storageBlocked:()=>false,persist:()=>{},render:()=>{},toast:message=>messages.push(message),showModal:(title,body)=>{modal=title+body},closeModal:()=>{modal=''},esc:x=>String(x)};
 const sync=installNativeSync(api);
 return {sync,get:()=>current,messages,calls,stored,writes:()=>writes,modal:()=>modal,onRead:fn=>{onRead=fn}};
}
test('上传失败不清除待同步状态',async()=>{
 const f=fixture(wages(),{exists:false},{error:'离线'});f.get().sync.pending=2;await f.sync.run();
 assert.equal(f.get().sync.pending,2);assert.equal(f.get().sync.baseline,undefined);assert.equal(f.writes(),1);
});
test('下载前保存本机替换前副本',async()=>{
 const f=fixture(empty(),{exists:true,etag:'"one"',envelope:{format:'dagongren.webdav.v1',book:wages()}});await f.sync.run();
 assert.equal(f.get().defaults.salaryCents,600000);assert.ok(f.stored.has('dagongren.previous-book'));assert.equal(f.writes(),0);
});
test('下载期间本机有新修改时不覆盖',async()=>{
 const f=fixture(empty(),{exists:true,etag:'"one"',envelope:{format:'dagongren.webdav.v1',book:wages()}});
 f.onRead(()=>{f.get().defaults.salaryCents=700000});await f.sync.run();
 assert.equal(f.get().defaults.salaryCents,700000);assert.equal(f.writes(),0);assert.ok(f.messages.some(m=>m.includes('新修改')));
});
test('缺少版本标识时拒绝覆盖远端',async()=>{
 const local=wages(700000),remote=wages();
 const f=fixture(local,{exists:true,etag:'',envelope:{format:'dagongren.webdav.v1',book:remote}});
 f.get().sync.baseline=hash(remote);await f.sync.run();assert.equal(f.writes(),0);assert.ok(f.messages.some(m=>m.includes('版本标识')));
});
test('冲突界面出现时没有写入请求',async()=>{
 const f=fixture(wages(),{exists:true,etag:'"one"',envelope:{format:'dagongren.webdav.v1',book:wages(700000)}});
 await f.sync.run();assert.equal(f.writes(),0);assert.match(f.modal(),/采用网盘账本/);assert.match(f.modal(),/采用本机账本/);
});
