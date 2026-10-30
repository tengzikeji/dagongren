// The approved log reader can retrieve this public test APK when direct
// workstation downloads are unavailable. Never include signing material.
import fs from 'node:fs';
import crypto from 'node:crypto';
const file=process.argv[2];
if(!file?.endsWith('/app-release.apk'))throw new Error('Expected the verified release APK.');
const bytes=fs.readFileSync(file),data=bytes.toString('base64'),chunkSize=12000,parts=Math.ceil(data.length/chunkSize);
if(bytes.length>8*1024*1024)throw new Error('Review transfer exceeds the bounded APK size.');
console.log('DAGONGREN_APK_REVIEW '+JSON.stringify({name:'dagongren-1.3.5-beta.15.apk',bytes:bytes.length,parts,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
for(let index=0;index<parts;index++)console.log('DAGONGREN_APK_PART '+JSON.stringify({index,data:data.slice(index*chunkSize,(index+1)*chunkSize)}));
