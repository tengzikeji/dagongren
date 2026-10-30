const dateFeedbackStorageKey='dagongren.date-feedback.v1';
export function createWheelFeedback({storage=globalThis.localStorage,bridge=globalThis.AndroidFiles,navigator=globalThis.navigator,AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,now=()=>globalThis.performance?.now?.()??Date.now()}={}){
 let preferences={sound:true,haptic:true},lastHaptic=-Infinity,audio=null;
 try{const saved=JSON.parse(storage?.getItem(dateFeedbackStorageKey)||'null');if(saved)for(const key of ['sound','haptic'])if(typeof saved[key]==='boolean')preferences[key]=saved[key];}catch{}
 return {
  read:()=>({...preferences}),
  set(key,enabled){if(!['sound','haptic'].includes(key)||typeof enabled!=='boolean')throw new Error('日期反馈设置无效。');const next={...preferences,[key]:enabled};if(!storage?.setItem)throw new Error('个人偏好暂时无法保存。');storage.setItem(dateFeedbackStorageKey,JSON.stringify(next));preferences=next;return {...preferences};},
  tick({userInitiated=false}={}){
   const {sound,haptic}=preferences;if(!userInitiated||!sound&&!haptic)return false;
   // The wheel calls this only when its centered value changes. Do not discard
   // sound ticks on fast scrolling; haptics retain their independent frame guard.
   const time=now(),playSound=sound,playHaptic=haptic&&(time<lastHaptic||time-lastHaptic>=8);
   if(!playSound&&!playHaptic)return false;if(playHaptic)lastHaptic=time;
   if(typeof bridge?.dateWheelFeedback==='function'){try{bridge.dateWheelFeedback(playSound,playHaptic);return true;}catch{return false;}}
   try{
    if(playSound&&AudioContext){audio??=new AudioContext();if(audio.state==='suspended')audio.resume()?.catch?.(()=>{});const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime;oscillator.type='triangle';oscillator.frequency.setValueAtTime(1650,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.09,start+.001);gain.gain.exponentialRampToValueAtTime(.0001,start+.018);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.020);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
    if(playHaptic)navigator?.vibrate?.(6);
   }catch{}
   return true;
  }
 };
}
