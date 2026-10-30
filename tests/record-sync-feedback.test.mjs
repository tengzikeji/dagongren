import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSyncFeedback} from '../dist/refresh.js';

test('手动保存后立即显示同步标识，保持真实反馈和持久数据不变',()=>{
 const visual=createRecordSyncFeedback(),actual=Object.freeze({state:'idle',source:'auto',message:'有待同步修改',revision:4});
 assert.equal(visual.value(actual,true),actual);
 visual.recordSaved(actual,true);
 assert.deepEqual(visual.value(actual,true),{state:'syncing',source:'auto',message:'正在同步',revision:4});
 visual.recordSaved(actual,true);
 assert.equal(visual.value(actual,true).state,'syncing');
 assert.equal(actual.state,'idle');
});
test('动画衔接真实同步，并仅由真实同步事件结束',()=>{
 for(const state of ['success','error','attention','idle']){
  const visual=createRecordSyncFeedback(),old={state:'error',source:'auto',revision:2};
  visual.recordSaved(old,true);
  assert.equal(visual.value(old,true).state,'syncing');
  const result={state,source:'auto',revision:3};
  assert.equal(visual.value(result,true),result);
 }
 const visual=createRecordSyncFeedback(),queued={state:'idle',revision:4};
 visual.recordSaved(queued,true);
 const running={state:'syncing',source:'auto',revision:5};
 assert.equal(visual.value(running,true),running);
 const result={state:'success',source:'auto',revision:6};
 assert.equal(visual.value(result,true),result);
});
test('关闭自动同步、离线或暂停时撤销等待标识，不会自行恢复动画',()=>{
 const visual=createRecordSyncFeedback(),actual={state:'idle',revision:0};
 visual.recordSaved(actual,false);assert.equal(visual.value(actual,true),actual);
 visual.recordSaved(actual,true);assert.equal(visual.value(actual,true).state,'syncing');
 assert.equal(visual.value(actual,false),actual);
 assert.equal(visual.value(actual,true),actual);
});
test('实际同步期间保存记录保持真实状态，真实失败不会被等待标识遮盖',()=>{
 const visual=createRecordSyncFeedback(),running={state:'syncing',source:'pull',revision:7};
 visual.recordSaved(running,true);assert.equal(visual.value(running,true),running);
 const error={state:'error',source:'pull',revision:8};
 assert.equal(visual.value(error,true),error);
});
