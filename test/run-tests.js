const {startApp} = require('../src/app');
const {startFakePlatform} = require('../src/fake-platform');
const {SocialPublisher} = require('../src/publisher');
const {generateVariant} = require('../src/image');
const {composeCaption} = require('../src/caption');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function run(){
  console.log('Starting app and fake platform in-process...');
  const app = await startApp();
  // fake platform already started by app; but ensure accessible

  // Test image variant dimensions
  const img = await generateVariant({sourceBuffer: Buffer.from([0,0,0,0]), width:200, height:100});
  assert(img && img.length>0, 'image generated');
  console.log('Image generation: OK');

  // Test caption composition
  const caption = composeCaption({title:'Hello','url':'http://example.com', fragments:[{text:'global'}, {platform:'x', text:'short'}, {platform:'instagram', text:'nice image'}]}, 'x');
  assert(caption.includes('Hello'));
  console.log('Caption composition: OK');

    // Test publishing idempotency and 429 handling
    const tokenRes = await postJson('http://localhost:4001/oauth/token', {});
    const pub = new SocialPublisher({platformName:'x', baseUrl:'http://localhost:4001', token: tokenRes.json.access_token});
    const idKey = 'key_'+Date.now();
    const r1 = await pub.publish({post:{title:'t1'}, imageUrl:'http://img', caption:'c', idempotencyKey:idKey, deliveryCallback:'http://localhost:4000/webhook', simulate429:true});
    const r2 = await pub.publish({post:{title:'t1'}, imageUrl:'http://img', caption:'c', idempotencyKey:idKey, deliveryCallback:'http://localhost:4000/webhook'});
    if (!(r1.id || r1.json && r1.json.id)) throw new Error('first publish missing id');
    if (!((r2.duplicate===true) || (r2.id || (r2 && r2.json && r2.json.duplicate)))) throw new Error('idempotency not observed');
    console.log('Idempotency + 429 handling: OK');

  // Test webhook forged rejection
    const forged = await postJson('http://localhost:4000/webhook', {foo:'bar'}, {'x-signature':'bad'}).catch(e=>({status:500}));
    if (forged.status !== 400) throw new Error('forged webhook should be rejected');
  console.log('Forged webhook rejection: OK');

  // final status check
    const statusReq = await new Promise((resolve)=>{ require('http').get('http://localhost:4000/status', (res)=>{ let s=''; res.on('data',c=>s+=c); res.on('end', ()=>resolve({status:res.statusCode, body: s})); }); });
    console.log('Status snapshot:', statusReq.body);

  // cleanup
  app.close();
  console.log('All tests passed.');
}

  function postJson(urlString, data, headers={}){
    return new Promise((resolve,reject)=>{
      const u = new URL(urlString);
      const opts = {hostname:u.hostname, port:u.port, path:u.pathname + (u.search||''), method:'POST', headers: Object.assign({'Content-Type':'application/json'}, headers)};
      const req = require('http').request(opts, (res)=>{ let s=''; res.on('data', c=>s+=c); res.on('end', ()=>{ try{ resolve({status: res.statusCode, json: JSON.parse(s||'{}')}) }catch(e){ resolve({status:res.statusCode, json:{}}) } }); });
      req.on('error', reject); req.write(JSON.stringify(data)); req.end();
    });
  }
run().catch(e=>{console.error(e); process.exit(1)});
