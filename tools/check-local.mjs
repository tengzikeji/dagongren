import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
for(const file of fs.readdirSync('dist').filter(f=>f.endsWith('.js'))){const result=spawnSync(process.execPath,['--check','dist/'+file],{stdio:'inherit'});if(result.status)process.exit(result.status);}
const tests=fs.readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f);
const result=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit'});
process.exit(result.status||0);
