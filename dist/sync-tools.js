export function snapshotBook(book){
 const snapshot={version:2,defaults:JSON.parse(JSON.stringify(book.defaults)),months:JSON.parse(JSON.stringify(book.months)),excludedMonths:[...(book.excludedMonths||[])].sort()};
 if(book.tombstones&&Object.keys(book.tombstones).length)snapshot.tombstones=JSON.parse(JSON.stringify(book.tombstones));return snapshot;
}
export function chooseSyncAction(localHash,remoteHash,baseline,remoteExists,localEmpty=false){
 if(!remoteExists)return baseline?'conflict':'upload';if(localHash===remoteHash)return 'same';if(!baseline)return localEmpty?'download':'conflict';if(localHash===baseline)return 'download';if(remoteHash===baseline)return 'upload';return 'conflict';
}
export function isEmptyBook(book){return !book.defaults.company&&!Number(book.defaults.salaryCents)&&Object.values(book.months).every(r=>!r.company&&!Number(r.salaryCents)&&!r.payment&&['leaves','overtime','subsidies','deductions','advances','payments'].every(k=>!(r[k]||[]).length));}
export function validateRemoteEnvelope(value){
 if(!['dagongren.webdav.v1','dagongren.webdav.v2'].includes(value?.format)||value.book?.version!==2||!value.book.defaults||!value.book.months||Array.isArray(value.book.months))throw new Error('网盘文件不是受支持的打工人账本，未修改任何记录。');
 const marks=value.book.tombstones;
 if(marks!==undefined&&(!marks||typeof marks!=='object'||Array.isArray(marks)||Object.keys(marks).length>50000||Object.entries(marks).some(([k,v])=>k.length>600||typeof v!=='string'||v.length>150)))throw new Error('网盘同步标记无效，未修改任何记录。');return value.book;
}
