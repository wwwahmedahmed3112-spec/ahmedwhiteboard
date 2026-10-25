// Owner only. The private key must remain outside this public repository.
import {readFile,writeFile} from 'node:fs/promises';
import {createPrivateKey,sign,randomUUID,webcrypto} from 'node:crypto';
import {monthlyPayload} from '../web/subscription.mjs';
import {verifyLicense} from '../web/core.mjs';
import {CONFIG} from '../web/config.mjs';
const [keyPath,customer,output,previousPath]=process.argv.slice(2);
if(!keyPath||!customer||!output){console.error('Usage: node scripts/issue-monthly-license.mjs PRIVATE.pem "Customer" output.sablicense [previous.sablicense]');process.exit(1);}
const key=createPrivateKey(await readFile(keyPath));const jwk=key.export({format:'jwk'});
if(jwk.x!==CONFIG.publicKey.x||jwk.y!==CONFIG.publicKey.y)throw Error('مفتاح التوقيع لا يطابق السبورة');
const previous=previousPath?await verifyLicense(await readFile(previousPath,'utf8'),CONFIG.publicKey,webcrypto):null;
const payload=Buffer.from(JSON.stringify(monthlyPayload({id:randomUUID(),customer,previous})));
const signature=sign('sha256',payload,{key,dsaEncoding:'ieee-p1363'});
await writeFile(output,JSON.stringify({payload:payload.toString('base64'),signature:signature.toString('base64')},null,2),{mode:0o600});
console.log('Monthly license created:',output);
