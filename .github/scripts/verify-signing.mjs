import fs from 'node:fs';
import crypto from 'node:crypto';
const marker='.github/signing-identity.json';
if(fs.existsSync(marker)){
 const expected=JSON.parse(fs.readFileSync(marker,'utf8'));
 const actual=crypto.createHash('sha256').update(fs.readFileSync('signing-key/certificate.der')).digest('hex');
 if(expected.applicationId!=='com.tengzikeji.dagongren.upgrade'||actual!==expected.certificateSha256)throw new Error('Signing identity mismatch; build stopped to preserve upgrade compatibility.');
 console.log('Fixed signing certificate verified.');
}
