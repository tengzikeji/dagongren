import {canonicalJSON} from './data-tools.js';
import {migrateBook,ensureAccrualMonths} from './payroll.js';
import {snapshotBook,chooseSyncAction,isEmptyBook,validateRemoteEnvelope} from './sync-tools.js';

export function installNativeSync(api) {
  const native=globalThis.AndroidFiles, pending=new Map(),requestPrefix=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  let config=JSON.parse(native.status()),busy=false,timer,lastAttempt=0,conflict=null,lastError='',sequence=0;
  const db=()=>api.getBook(),signature=book=>native.fingerprint(canonicalJSON(snapshotBook(book)));
  db().sync.demo=false;db().sync.cloudMonths=null;db().sync.connected=!!config.configured;
  if(db().sync.nativeVersion!==1){db().sync.auto=false;db().sync.nativeVersion=1;delete db().sync.baseline;}
  globalThis.dagongrenNativeResult=(id,result)=>{
    const item=pending.get(id);if(!item)return;clearTimeout(item.timer);pending.delete(id);
    result.ok?item.resolve(result.data):item.reject(new Error(result.error||'操作未完成，请稍后再试。'));
  };
  const request=(action,data={})=>new Promise((resolve,reject)=>{
    const id=requestPrefix+'-'+(++sequence);
    const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('连接超时，修改仍保存在本机，请稍后手动同步。'));},150000);
    pending.set(id,{resolve,reject,timer:timeout});
    try{native.request(id,action,JSON.stringify(data));}catch(e){clearTimeout(timeout);pending.delete(id);reject(new Error('暂时无法连接，请重新打开应用后再试。'));}
  });
  function message(text){lastError=text;api.toast(text);}
  function saveBeforeReplace(book){localStorage.setItem('dagongren.previous-book',JSON.stringify(snapshotBook(book)));}
  function finish(hash){conflict=null;db().sync.baseline=hash;db().sync.last=Date.now();db().sync.pending=signature(db())===hash?0:Math.max(1,db().sync.pending||0);lastError='';api.persist();}
  function conflictDialog(remoteHash){
    conflict={remoteHash};
    api.showModal(remoteHash?'两端账本都有不同记录':'网盘账本已不存在',`<div class="notice">本机与网盘的记录不同，尚未覆盖任何一端。请先导出本机账本，再决定采用哪一份。选定后将替换另一端，不会把两份金额相加。</div><div class="modal-actions"><button class="btn btn-plain" data-action="export">导出本机账本</button>${remoteHash?'<button class="btn btn-plain" data-action="native-use-remote">采用网盘账本</button>':''}<button class="btn btn-primary" data-action="native-keep-local">采用本机账本</button></div>`,true);
  }
  async function run(resolution='normal'){
    if(busy)return;if(!config.configured){showConfig();return;}if(api.storageBlocked()){message('本机存储不可用，已暂停同步，请先导出账本。');return;}
    busy=true;clearTimeout(timer);lastAttempt=Date.now();api.render();
    try{
      const before=snapshotBook(db()),localHash=signature(before),remote=await request('read');
      let remoteBook=null,remoteHash=null;
      if(remote.exists){remoteBook=migrateBook(validateRemoteEnvelope(remote.envelope),api.defaults,api.today());remoteHash=signature(remoteBook);}
      let action=chooseSyncAction(localHash,remoteHash,db().sync.baseline,remote.exists,isEmptyBook(before));
      if(resolution!=='normal'){
        if(!conflict||conflict.remoteHash!==remoteHash){conflictDialog(remoteHash);return;}
        action=resolution;api.closeModal();conflict=null;
      }
      if(action==='conflict'){lastError='两端记录不同，请选择要保留的账本。';conflictDialog(remoteHash);return;}
      if(action==='same'){finish(localHash);api.toast('本机与网盘账本一致。');return;}
      if(action==='download'){
        if(!remoteBook)throw new Error('网盘账本不存在，本机记录保留。');
        if(signature(db())!==localHash){message('同步期间本机有新修改，已保留本机记录，请再次同步。');return;}
        const next={...remoteBook,sync:{...db().sync,baseline:remoteHash,pending:0,last:Date.now()}};
        saveBeforeReplace(db());ensureAccrualMonths(next,api.today());
        localStorage.setItem('dagongren.paybook.v1',JSON.stringify(next));api.replaceBook(next);conflict=null;lastError='';api.toast('网盘账本已下载并保存在本机。');return;
      }
      if(remote.exists&&(!remote.etag||remote.etag.startsWith('W/')))throw new Error('网盘未提供可用于防冲突的版本标识，本次未覆盖网盘账本。');
      if(remoteBook)saveBeforeReplace(remoteBook);
      await request('write',{content:canonicalJSON(before),exists:remote.exists,etag:remote.etag||''});
      finish(localHash);api.toast('账本已上传到你的坚果云。');
      if(db().sync.pending&&db().sync.auto)schedule();
    }catch(e){lastError=/[\u4e00-\u9fff]/.test(e.message||'')?e.message:'同步失败，修改已保存在本机。请检查网络或手机存储。';api.toast(lastError);}
    finally{busy=false;api.render();}
  }
  function schedule(){clearTimeout(timer);if(config.configured&&db().sync.auto&&!conflict)timer=setTimeout(()=>run(),20000);}
  function showConfig(){
    if(busy){message('请等待当前同步完成后再修改连接。');return;}
    const e=api.esc;
    api.showModal('配置坚果云同步',`<form id="webdav-form"><div class="field"><label for="server-url">服务地址</label><input id="server-url" name="url" type="url" value="${e(config.url||'https://dav.jianguoyun.com/dav/')}" required autocomplete="off"></div><div class="field"><label for="cloud-account">坚果云账号</label><input id="cloud-account" name="username" type="email" value="${e(config.username||'')}" placeholder="填写坚果云账号邮箱" required autocomplete="off"></div><div class="field"><label for="cloud-password">应用授权密码</label><input id="cloud-password" name="password" type="password" placeholder="${config.configured?'已保存；留空保留原密码':'填写专用应用密码，非登录密码'}" autocomplete="new-password" ${config.configured?'':'required'}></div><div class="field"><label for="cloud-path">账本文件路径</label><input id="cloud-path" name="path" value="${e(config.path||'打工人/工资账本.json')}" required autocomplete="off"></div><p class="field-note">在坚果云的“第三方应用管理”生成应用密码。密码加密保存在本机，不会写入账本。保存时只测试连接，之后点击“立即同步”才会传输账本。</p><p class="field-note"><a href="https://help.jianguoyun.com/?p=2064" target="_blank" rel="noopener noreferrer">查看坚果云官方配置说明</a></p><div id="webdav-error" class="error" role="alert"></div><div class="modal-actions"><button type="button" class="btn btn-plain" data-action="close-modal">取消</button><button type="submit" id="webdav-save" class="btn btn-primary">测试连接并保存</button></div></form>`,true);
  }
  async function submit(form){
    if(busy)return;busy=true;
    const error=document.getElementById('webdav-error'),button=document.getElementById('webdav-save');
    if(button)button.disabled=true;if(error)error.textContent='';
    try{
      const result=await request('configure',{url:String(form.get('url')||'').trim(),username:String(form.get('username')||'').trim(),password:String(form.get('password')||''),path:String(form.get('path')||'').trim()});
      config=result;db().sync.connected=true;db().sync.auto=false;delete db().sync.baseline;conflict=null;lastError='';api.persist();api.closeModal();api.render();api.toast('连接测试通过，配置已保存。点击立即同步开始。');
    }catch(e){if(error)error.textContent=e.message;}
    finally{busy=false;if(button)button.disabled=false;api.render();}
  }
  function view(){
    const s=db().sync,e=api.esc,last=s.last?new Date(s.last).toLocaleString('zh-CN'):'尚未同步';
    return `<button class="btn btn-plain" data-action="nav" data-view="settings">返回我的</button><section class="sync-hero" style="margin-top:18px"><h2>坚果云同步</h2><p>用自己的坚果云保存和恢复完整工资账本。</p><div class="notice">${config.configured?'已配置账号：'+e(config.username):'尚未配置。请填写坚果云账号和专用应用密码。'}</div>${config.configured?'<p class="field-note">'+e(config.path)+'</p>':''}<div class="sync-actions"><button class="btn btn-primary" data-action="sync-now" ${busy?'disabled':''}>${busy?'正在同步…':'立即同步'}</button><button class="btn btn-plain" data-action="connection-settings">${config.configured?'修改配置':'连接配置'}</button></div><div class="sync-message">${e(lastError||('上次成功同步：'+last))}</div>${config.configured?`<div class="setting-row"><span class="setting-text"><strong>修改后自动同步</strong><p>应用打开时，在停止编辑20秒后同步。两端同时修改时先确认，不自动覆盖。</p></span><button class="switch ${s.auto?'on':''}" role="switch" aria-checked="${!!s.auto}" aria-label="修改后自动同步" data-action="toggle-auto"></button></div><button class="btn btn-plain" data-action="native-disconnect" ${busy?'disabled':''}>移除本机连接配置</button>`:''}<p class="field-note">首次遇到不同账本时可选择采用本机或网盘记录。离线修改继续保存在本机；失败后可手动重试。网盘中的账本文件包含工资数据，请使用自己的账号。</p></section>`;
  }
  function handleClick(action){
    if(action==='native-keep-local'){run('upload');return true;}
    if(action==='native-use-remote'){run('download');return true;}
    if(action==='toggle-auto'){db().sync.auto=!db().sync.auto;api.persist();api.render();if(db().sync.auto)schedule();else clearTimeout(timer);return true;}
    if(action==='native-disconnect'){
      if(busy)return true;
      request('disconnect').then(()=>{config={configured:false};db().sync.connected=false;db().sync.auto=false;delete db().sync.baseline;clearTimeout(timer);conflict=null;api.persist();api.render();api.toast('已移除本机配置，网盘文件保留。');}).catch(e=>message(e.message));return true;
    }
    return false;
  }
  function status(){return busy?'正在同步':config.configured?(lastError?'同步需处理':db().sync.pending?'有待同步修改':'已配置坚果云'):'本机保存';}
  return {view,showConfig,run,schedule,submit,handleClick,status,configured:()=>!!config.configured,beforeCleanup(){clearTimeout(timer);},foreground(){if(config.configured&&db().sync.auto&&Date.now()-lastAttempt>60000)run();}};
}
