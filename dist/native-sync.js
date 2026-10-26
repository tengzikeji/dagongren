import {canonicalJSON} from './data-tools.js';
import {buildPairedCleanup} from './cloud-cleanup.js';
import {migrateBook,ensureAccrualMonths,calculateBook} from './payroll.js';
import {snapshotBook,chooseSyncAction,isEmptyBook,validateRemoteEnvelope} from './sync-tools.js';
import {mergeBooks,rememberDeletions} from './sync-merge.js';
export function installNativeSync(api){
 const native=globalThis.AndroidFiles,pending=new Map(),requestPrefix=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 let config=JSON.parse(native.status()),busy=false,timer,pollTimer,lastAttempt=0,conflict=null,lastError='',sequence=0,failures=0,disposed=false,cleanupGeneration=0,cleanupReview=null,cleanupEpoch=0,cleanupCommitting=false,cleanupRetryOptions=null;
 const db=()=>api.getBook(),signature=book=>native.fingerprint(canonicalJSON(snapshotBook(book)));
 const visible=()=>globalThis.document?.visibilityState!=='hidden',online=()=>globalThis.navigator?.onLine!==false;
 if(db().sync.pendingCleanup)db().sync.pausedByCleanup=true;
 db().sync.demo=false;db().sync.cloudMonths=null;db().sync.connected=!!config.configured;
 if(db().sync.nativeVersion!==1){db().sync.auto=false;db().sync.nativeVersion=1;delete db().sync.baseline;delete db().sync.baseBook;}
 globalThis.dagongrenNativeResult=(id,result)=>{
  const item=pending.get(id);if(!item)return;clearTimeout(item.timer);pending.delete(id);
  if(result.ok)item.resolve(result.data);else{const error=new Error(result.error||'操作未完成，请稍后再试。');error.code=result.code;item.reject(error);}
 };
 const request=(action,data={})=>new Promise((resolve,reject)=>{
  const id=requestPrefix+'-'+(++sequence),timeout=setTimeout(()=>{pending.delete(id);reject(new Error('连接超时，修改仍保存在本机，请稍后重试。'));},150000);
  timeout.unref?.();pending.set(id,{resolve,reject,timer:timeout});
  try{native.request(id,action,JSON.stringify(data));}catch(e){clearTimeout(timeout);pending.delete(id);reject(new Error('暂时无法连接，请重新打开应用后再试。'));}
 });
 function message(text){lastError=text;api.toast(text);}
 function saveBeforeReplace(book){localStorage.setItem('dagongren.previous-book',JSON.stringify(snapshotBook(book)));}
 function canAuto(){return !disposed&&config.configured&&db().sync.auto&&!db().sync.pausedByCleanup&&visible()&&online()&&!conflict&&!cleanupReview&&!db().sync.pendingCleanup;}
 function armPoll(){
  clearTimeout(pollTimer);
  if(!disposed&&config.configured&&db().sync.auto&&visible()){
   const delay=failures?Math.min(300000,30000*2**Math.min(failures,4)):30000;
   pollTimer=setTimeout(()=>{if(canAuto())run('normal',true);else armPoll();},delay);pollTimer.unref?.();
  }
 }
 function schedule(delay=2500){clearTimeout(timer);if(canAuto()){timer=setTimeout(()=>run('normal',true),delay);timer.unref?.();}}
 function conflictDialog(remoteHash,localHash,items=[],merge=false){
  conflict={remoteHash,localHash,merge};
  const e=api.esc;
  const describe=(value,path)=>{
   if(value===undefined)return '已删除';if(value===null)return '无记录';
   const money=n=>'¥'+(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
   if(typeof value==='object'){
    if(Number.isSafeInteger(value.amountCents))return (value.date?value.date+' · ':'')+money(value.amountCents);
    if(typeof value.days==='number')return (value.date||'')+' · 请假'+value.days+'天 · '+(value.deduct?'扣款':'不扣款');
    if(Number.isSafeInteger(value.salaryCents))return '月薪 '+money(value.salaryCents);
    return '有不同设置';
   }
   if(path?.at(-1)==='salaryCents'&&typeof value==='number')return money(value);
   if(typeof value==='boolean')return value?'开启':'关闭';return String(value);
  };
  const details=items.length?'<div class="sync-conflicts">'+items.slice(0,5).map(x=>'<div><strong>'+e(x.label)+'</strong><div class="sync-conflict-comparison"><span><small>本机</small>'+e(describe(x.local,x.path))+'</span><span><small>网盘</small>'+e(describe(x.remote,x.path))+'</span></div></div>').join('')+'</div>':'';
  api.showModal(remoteHash?(merge?'同一条记录有不同修改':'请确认要保留的账本'):'网盘账本已不存在',
   '<div class="notice">'+(merge?'不同的新记录已准备合并。以下相同记录存在不同修改，请决定冲突部分采用哪一端，其余记录会保留。':(db().sync.pausedByCleanup?(db().sync.cleanupTarget==='both'?'两端已清理同一范围，其余记录仍有差异。请核对后决定要保留的账本。':'本机清理没有删除网盘记录。采用网盘可恢复云端记录；采用本机会将清理结果写入网盘，请核对后选择。'):'尚未覆盖任何一端。首次同步或缺少共同版本时，请先确认账本。'))+'</div>'+details+
   '<div class="modal-actions"><button class="btn btn-plain" data-action="export">导出本机账本</button>'+
   (remoteHash?'<button class="btn btn-plain" data-action="native-use-remote">'+(merge?'冲突采用网盘':'采用网盘账本')+'</button>':'')+
   '<button class="btn btn-primary" data-action="native-keep-local">'+(merge?'冲突采用本机':'采用本机账本')+'</button></div>',true);
 }
 function adopt(book,base){
  const didChange=signature(db())!==signature(book);
  const next={...snapshotBook(book),sync:{...db().sync,baseBook:snapshotBook(base),baseline:signature(base),last:Date.now(),pausedByCleanup:false}};
  next.sync.pending=signature(next)===signature(base)?0:Math.max(1,db().sync.pending||0);
  localStorage.setItem('dagongren.paybook.v1',JSON.stringify(next));api.replaceBook(next);api.persist();lastError='';failures=0;conflict=null;if(didChange)api.render();
 }
 async function run(resolution='normal',silent=false){
  if(disposed||busy||cleanupReview)return;
  if(db().sync.pendingCleanup){if(!silent)reviewCleanup(db().sync.pendingCleanup.options);return;}
  if(!config.configured){if(!silent)showConfig();return;}
  if(api.storageBlocked()){if(!silent)message('本机存储不可用，已暂停同步，请先导出账本。');return;}
  if(!online()){lastError='网络已断开，修改保存在本机，联网后会自动补齐。';armPoll();if(!silent)api.toast(lastError);return;}
  if(api.editing?.()){if(!silent)api.toast('请先保存或取消当前编辑，自动同步会在编辑完成后继续。');schedule();return;}
  const generation=cleanupGeneration,cancelled=()=>cleanupGeneration!==generation||(silent&&!db().sync.auto);busy=true;clearTimeout(timer);clearTimeout(pollTimer);lastAttempt=Date.now();if(!silent)api.render();
  try{
   for(let attempt=0;attempt<3;attempt++){
    const initialHash=signature(db()),remote=await request('read');if(cancelled())return;
    let local=snapshotBook(db()),remoteBook=null,remoteHash=null,base=db().sync.baseBook;
    const localHash=signature(local);if(api.editing?.())return;
    if(base&&signature(base)!==db().sync.baseline)base=null;
    if(remote.exists){remoteBook=migrateBook(validateRemoteEnvelope(remote.envelope),api.defaults,api.today());remoteHash=signature(remoteBook);}
    if(localHash!==initialHash&&!base)throw new Error('同步期间本机有新修改，已保留本机记录，请再次同步。');
    const choosing=resolution!=='normal';
    if(choosing&&(!conflict||conflict.remoteHash!==remoteHash||conflict.localHash!==localHash)){conflictDialog(remoteHash,localHash);return;}
    let action=chooseSyncAction(localHash,remoteHash,db().sync.baseline,remote.exists,isEmptyBook(local)),candidate=local;
    if(db().sync.pausedByCleanup&&!choosing&&remoteHash!==localHash)action='conflict';
    const canMerge=base&&remoteBook&&!db().sync.pausedByCleanup;
    if(canMerge&&localHash!==remoteHash){
     const result=mergeBooks(base,local,remoteBook,choosing?(resolution==='download'?'remote':'local'):'');
     if(result.conflicts.length){lastError='同一笔记录有不同修改，其余新增记录可自动合并。';conflictDialog(remoteHash,localHash,result.conflicts,true);return;}
     candidate=result.book;action=signature(candidate)===remoteHash?'download':'merge';
    }else if(choosing)action=resolution;
    if(action==='conflict'){lastError='请先确认这次同步要保留的账本。';conflictDialog(remoteHash,localHash);return;}
    if(choosing)api.closeModal();
    if(action==='same'){adopt(local,local);if(!silent)api.toast('本机与网盘账本一致。');return;}
    if(action==='download')candidate=canMerge?candidate:remoteBook;
    if(!candidate)throw new Error('网盘账本不存在，本机记录保留。');
    candidate=migrateBook(snapshotBook(candidate),api.defaults,api.today());ensureAccrualMonths(candidate,api.today());
    rememberDeletions(candidate,local,requestPrefix+'-'+(++sequence));calculateBook(candidate.months,candidate.defaults,api.today());candidate=snapshotBook(candidate);
    if(action==='download'&&signature(candidate)===remoteHash){saveBeforeReplace(db());adopt(candidate,remoteBook);if(!silent)api.toast('网盘的新记录已合并到本机。');return;}
    if(remote.exists&&(!remote.etag||remote.etag.startsWith('W/')))throw new Error('网盘未提供可用于防冲突的版本标识，本次未覆盖网盘账本。');
    saveBeforeReplace(db());
    try{await request('write',{content:canonicalJSON(candidate),exists:remote.exists,etag:remote.etag||''});}
    catch(error){if(error.code===412&&attempt<2)continue;throw error;}
    if(cancelled())return;
    if(api.editing?.()){db().sync.pending=Math.max(1,db().sync.pending||0);api.persist();return;}
    const current=snapshotBook(db());
    if(signature(current)!==localHash){
     const rebased=mergeBooks(local,current,candidate);adopt(rebased.book,rebased.conflicts.length?local:candidate);
     if(rebased.conflicts.length){lastError='同步期间同一笔记录又有修改，请确认冲突部分。';conflictDialog(signature(candidate),signature(db()),rebased.conflicts,true);}
    }else adopt(candidate,candidate);
    if(!silent&&!conflict)api.toast(action==='merge'?'两端不同的新记录已自动合并。':'账本已同步到坚果云。');return;
   }
  }catch(error){
   if(cancelled())return;
   failures++;lastError=/[\u4e00-\u9fff]/.test(error.message||'')?error.message:'同步未完成，修改保存在本机，稍后会自动重试。';
   if(error.code===429)failures=Math.max(failures,4);if(!silent)api.toast(lastError);
  }finally{busy=false;if(!silent||lastError)api.render();if(canAuto()&&db().sync.pending&&!failures)schedule();armPoll();}
 }
 function cleanupRange(options){return options.scope==='month'?options.month.slice(0,4)+'年'+Number(options.month.slice(5))+'月':options.scope==='year'?options.year+'年':'全部账本记录';}
 function cleanupCount(count){return count.months+'个月 · '+['leaves','paid','advances','overtime','subsidies','deductions'].reduce((n,key)=>n+(count[key]||0),0)+'条逐笔记录';}
 function remoteCleanupBook(remote){return remote.exists?migrateBook(validateRemoteEnvelope(remote.envelope),api.defaults,api.today()):null;}
 function requireRemoteVersion(remote){if(remote.exists&&(!remote.etag||remote.etag.startsWith('W/')))throw new Error('网盘未提供有效版本标识，未清理任何记录。');}
 function cancelCleanupReview(){if(cleanupCommitting)return false;cleanupEpoch++;cleanupReview=null;armPoll();return true;}
 async function reviewCleanup(options){
  if(disposed||busy){api.toast('请等待当前网盘操作完成。');return;}
  if(!config.configured){api.toast('请先配置坚果云，再选择一并清理。');return;}
  if(!online()){api.toast('当前离线，未清理任何记录。联网后再核对云端范围。');return;}
  if(api.storageBlocked()){api.toast('本机存储不可用，未清理任何记录。');return;}
  const epoch=++cleanupEpoch;cleanupReview=null;cleanupRetryOptions={...options,target:'both'};busy=true;clearTimeout(timer);clearTimeout(pollTimer);
  const title='确认清理本机及云端？';
  api.showModal(title,'<p id="cloud-cleanup-loading" class="field-note" role="status">正在读取云端账本，准备核对范围…</p><div class="modal-actions"><button class="btn btn-plain" data-action="close-modal">取消</button></div>',true);
  try{
   const remote=await request('read');if(epoch!==cleanupEpoch||disposed)return;requireRemoteVersion(remote);
   const local=snapshotBook(db()),remoteBook=remoteCleanupBook(remote),prepared=buildPairedCleanup(local,remoteBook,cleanupRetryOptions,requestPrefix+'-review-'+(++sequence));
   if(!prepared.plan.local.months&&!prepared.plan.cloud.months){
    if(db().sync.pendingCleanup){const settled={...db(),sync:{...db().sync,pausedByCleanup:false,cleanupTarget:'both',pending:0}};delete settled.sync.pendingCleanup;localStorage.setItem('dagongren.paybook.v1',JSON.stringify(settled));api.replaceBook(settled);api.closeModal();if(api.cleanupComplete)api.cleanupComplete('两端所选范围均无记录，已完成核对。自动同步开关保持原选择。');else api.toast('两端所选范围均无记录，已完成核对。');}
    else{api.closeModal();api.toast('所选范围没有可清理记录。');}return;
   }
   cleanupReview={options:{...cleanupRetryOptions},plan:prepared.plan};const e=api.esc;
   api.showModal(title,'<div class="notice">将清理两端账本中相同范围的记录。默认工资设置、连接配置及范围外的记录保留。</div><div class="detail-line"><span>清理范围</span><strong>'+e(cleanupRange(cleanupReview.options))+'</strong></div><div class="detail-line"><span>本机记录</span><strong>'+e(cleanupCount(prepared.plan.local))+'</strong></div><div class="detail-line"><span>云端记录</span><strong>'+e(cleanupCount(prepared.plan.cloud))+'</strong></div><div class="detail-line"><span>云端账号</span><strong>'+e(config.username||'当前已配置账号')+'</strong></div><p class="field-note">仅处理当前配置的打工人账本；'+e(config.path||'当前账本路径')+'。确认前会再次检查版本。清理完成后，自动同步开关保持原选择。</p><div class="error" id="cloud-cleanup-error" role="alert"></div><div class="modal-actions"><button class="btn btn-plain" data-action="close-modal">取消</button><button id="cloud-cleanup-confirm" class="btn btn-danger" data-action="native-cleanup-confirm">确认清理本机及云端</button></div>',true);
  }catch(error){if(epoch===cleanupEpoch){cleanupReview=null;api.closeModal();api.toast(error.message||'无法读取云端账本，未清理任何记录。');}}
  finally{busy=false;api.render();armPoll();}
 }
 async function confirmCleanup(){
  const context=cleanupReview;if(disposed||busy||!context)return;
  cleanupCommitting=true;busy=true;clearTimeout(timer);clearTimeout(pollTimer);
  const errorNode=document.getElementById('cloud-cleanup-error'),button=document.getElementById('cloud-cleanup-confirm');if(errorNode)errorNode.textContent='';if(button){button.disabled=true;button.textContent='正在核对并清理…';}
  let cloudProcessed=false;
  try{
   if(!online())throw new Error('当前离线，本机记录未清理。');if(api.storageBlocked())throw new Error('本机存储不可用，未开始清理。');
   const remote=await request('read');requireRemoteVersion(remote);const remoteBook=remoteCleanupBook(remote),local=snapshotBook(db()),revision=requestPrefix+'-cleanup-'+(++sequence),prepared=buildPairedCleanup(local,remoteBook,context.options,revision);
   if(prepared.plan.signature!==context.plan.signature)throw new Error('所选范围的本机或云端记录已变化，请重新核对。');
   const pause={...db(),sync:{...db().sync,pausedByCleanup:true,cleanupTarget:'both',pending:0,pendingCleanup:{id:revision,options:context.options,startedAt:Date.now()}}};
   localStorage.setItem('dagongren.paybook.v1',JSON.stringify(pause));api.replaceBook(pause);
   if(remote.exists){
    const expected=signature(prepared.remote);
    try{await request('write',{content:canonicalJSON(prepared.remote),exists:true,etag:remote.etag});}
    catch(error){
     if(Number.isInteger(error.code)&&error.code>=400&&error.code<500)throw error;
     const verified=await request('read');if(!verified.exists||signature(remoteCleanupBook(verified))!==expected)throw new Error('云端结果暂未确认，本机记录保留，请重新核对后再试。');
    }
   }
   cloudProcessed=true;
   const fresh=buildPairedCleanup(snapshotBook(db()),remoteBook,context.options,revision);if(fresh.plan.signature!==context.plan.signature)throw new Error('清理期间本机记录发生变化，已保留本机记录，请重新核对。');
   const next={...fresh.local,sync:{...db().sync,pausedByCleanup:false,cleanupTarget:'both',pending:0}};delete next.sync.pendingCleanup;
   const message='已清理'+cleanupRange(context.options)+'：本机'+context.plan.local.months+'个月，云端'+context.plan.cloud.months+'个月。自动同步开关保持原选择。';
   next.sync.logs=[{text:message,icon:'trash',time:new Date().toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'})},...(next.sync.logs||[])].slice(0,20);
   localStorage.setItem('dagongren.paybook.v1',JSON.stringify(next));api.replaceBook(next);cleanupReview=null;lastError='';failures=0;conflict=null;
   api.closeModal();if(api.cleanupComplete)api.cleanupComplete(message);else{api.render();api.toast(message);}return true;
  }catch(error){
   const reason=/[\u4e00-\u9fff]/.test(error.message||'')?error.message:'无法保存清理状态，请检查本机可用空间后重试。';lastError=cloudProcessed?'云端已处理，本机清理结果未确认：'+reason:reason+' 本机记录保留。';
   cleanupReview=null;if(errorNode)errorNode.textContent=lastError;api.toast(lastError);if(button){button.disabled=false;button.textContent='重新核对范围';button.dataset.action='native-cleanup-retry';}return false;
  }finally{cleanupCommitting=false;busy=false;api.render();if(canAuto())schedule();armPoll();}
 }
  function showConfig(){
    if(busy){message('请等待当前同步完成后再修改连接。');return;}
    const e=api.esc;
    api.showModal('配置坚果云同步',`<form id="webdav-form"><div class="field"><label for="server-url">服务地址</label><input id="server-url" name="url" type="url" value="${e(config.url||'https://dav.jianguoyun.com/dav/')}" required autocomplete="off"></div><div class="field"><label for="cloud-account">坚果云账号</label><input id="cloud-account" name="username" type="email" value="${e(config.username||'')}" placeholder="填写坚果云账号邮箱" required autocomplete="off"></div><div class="field"><label for="cloud-password">应用授权密码</label><input id="cloud-password" name="password" type="password" placeholder="${config.configured?'已保存；留空保留原密码':'填写专用应用密码，非登录密码'}" autocomplete="new-password" ${config.configured?'':'required'}></div><div class="field"><label for="cloud-path">账本文件路径</label><input id="cloud-path" name="path" value="${e(config.path||'打工人/工资账本.json')}" required autocomplete="off"></div><p class="field-note">在坚果云的“第三方应用管理”生成应用密码。密码加密保存在本机，不会写入账本。保存后开启自动同步。首次遇到不同账本时会先让你确认，不会直接覆盖。</p><p class="field-note"><a href="https://help.jianguoyun.com/?p=2064" target="_blank" rel="noopener noreferrer">查看坚果云官方配置说明</a></p><div id="webdav-error" class="error" role="alert"></div><div class="modal-actions"><button type="button" class="btn btn-plain" data-action="close-modal">取消</button><button type="submit" id="webdav-save" class="btn btn-primary">保存并开启自动同步</button></div></form>`,true);
  }
  async function submit(form){
    if(busy)return;busy=true;
    const error=document.getElementById('webdav-error'),button=document.getElementById('webdav-save');
    if(button)button.disabled=true;if(error)error.textContent='';
    try{
      const result=await request('configure',{url:String(form.get('url')||'').trim(),username:String(form.get('username')||'').trim(),password:String(form.get('password')||''),path:String(form.get('path')||'').trim()});
      const paused=!!db().sync.pausedByCleanup;config=result;db().sync.connected=true;db().sync.auto=!paused;delete db().sync.baseline;delete db().sync.baseBook;conflict=null;lastError='';api.persist();api.closeModal();api.render();api.toast(paused?'连接已保存，请先核对网盘账本再恢复自动同步。':'连接测试通过，已开启自动同步。');if(!paused)schedule(500);
    }catch(e){if(error)error.textContent=e.message;}
    finally{busy=false;if(button)button.disabled=false;api.render();}
  }
  function view(){
    const s=db().sync,e=api.esc,last=s.last?new Date(s.last).toLocaleString('zh-CN'):'尚未同步';
    return `<button class="btn btn-plain" data-action="nav" data-view="settings">返回我的</button><section class="sync-hero" style="margin-top:18px"><h2>坚果云同步</h2><p>用自己的坚果云保存和恢复完整工资账本。</p><div class="notice">${config.configured?'已配置账号：'+e(config.username):'尚未配置。请填写坚果云账号和专用应用密码。'}</div>${config.configured?'<p class="field-note">'+e(config.path)+'</p>':''}<div class="sync-actions"><button class="btn btn-primary" data-action="sync-now" ${busy?'disabled':''}>${busy?'正在同步…':'立即同步'}</button><button class="btn btn-plain" data-action="connection-settings">${config.configured?'修改配置':'连接配置'}</button></div><div class="sync-message">${e(lastError||('上次成功同步：'+last))}</div>${config.configured&&s.pausedByCleanup?'<div class="notice gray">'+(s.pendingCleanup?'上次一并清理的结果待核对，本机记录保留，自动同步暂缓，开关保持原选择。<button class="link" data-action="native-cleanup-resume">核对清理状态</button>':s.cleanupTarget==='both'?'本机与云端已清理相同范围，自动同步已暂停。恢复前请核对其余记录。':'本机记录已清理，网盘账本保留。重新同步时请先核对；选择采用本机账本，会将清理结果写入网盘。')+'</div>':''}${config.configured?`<div class="setting-row"><span class="setting-text"><strong>修改后自动同步</strong><p>前台停止编辑约2.5秒后同步，每30秒检查远端。不同记录自动合并，同笔冲突先确认。</p></span><button class="switch ${s.auto?'on':''}" role="switch" aria-checked="${!!s.auto}" aria-label="修改后自动同步" data-action="toggle-auto"></button></div><button class="btn btn-plain" data-action="native-disconnect" ${busy?'disabled':''}>移除本机连接配置</button>`:''}<p class="field-note">首次遇到不同账本时可选择采用本机或网盘记录。离线修改保存在本机，恢复联网后自动补齐；应用关闭后不保证即时同步。网盘中的账本文件包含工资数据，请使用自己的账号。</p></section>`;
  }

 function handleClick(action){
  if(action==='native-cleanup-confirm'){confirmCleanup();return true;}
  if(action==='native-cleanup-retry'||action==='native-cleanup-resume'){reviewCleanup(db().sync.pendingCleanup?.options||cleanupRetryOptions);return true;}
  if(action==='native-keep-local'){run('upload');return true;}if(action==='native-use-remote'){run('download');return true;}
  if(action==='toggle-auto'){
   if(db().sync.pendingCleanup){reviewCleanup(db().sync.pendingCleanup.options);return true;}
   db().sync.auto=!db().sync.auto;api.persist();api.render();
   if(!db().sync.auto){clearTimeout(timer);clearTimeout(pollTimer);}
   else if(db().sync.pausedByCleanup)run('normal',true);
   else schedule(0);
   armPoll();return true;
  }
  if(action==='native-disconnect'){
   if(busy)return true;
   request('disconnect').then(()=>{config={configured:false};db().sync.connected=false;db().sync.auto=false;delete db().sync.baseline;delete db().sync.baseBook;clearTimeout(timer);clearTimeout(pollTimer);conflict=null;api.persist();api.render();api.toast('已移除本机配置，网盘文件保留。');}).catch(e=>message(e.message));return true;
  }return false;
 }
 function status(){return busy?'正在同步':config.configured?(lastError?'同步需处理':db().sync.pending?'有待同步修改':db().sync.pausedByCleanup?(db().sync.auto?'待确认网盘账本':'清理后已暂停自动同步'):db().sync.auto?'自动同步已开启':'已配置坚果云'):'本机保存';}
 function foreground(){if(canAuto()&&Date.now()-lastAttempt>5000)schedule(100);else armPoll();}
 globalThis.window?.addEventListener?.('online',foreground);
 globalThis.document?.addEventListener?.('visibilitychange',()=>{if(visible())foreground();else{clearTimeout(timer);clearTimeout(pollTimer);}});
 queueMicrotask(()=>{if(canAuto())schedule(500);});
 return {view,showConfig,run,schedule,submit,handleClick,status,reviewCleanup,confirmCleanup,cancelCleanupReview,isBusy:()=>busy||cleanupCommitting,configured:()=>!!config.configured,beforeCleanup(){cleanupGeneration++;clearTimeout(timer);clearTimeout(pollTimer);},foreground,fetchCalendar:year=>request('calendar-read',{year}),dispose(){disposed=true;clearTimeout(timer);clearTimeout(pollTimer);}};
}
