const {SocialPublisher} = require('../src/publisher');
const {generateVariant} = require('../src/image');
const {composeCaption} = require('../src/caption');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function postJson(urlString, data, headers={}){
  return new Promise((resolve,reject)=>{
    const u = new URL(urlString);
    const opts = {hostname:u.hostname, port:u.port, path:u.pathname + (u.search||''), method:'POST', headers: Object.assign({'Content-Type':'application/json'}, headers)};
    const req = http.request(opts, (res)=>{ let s=''; res.on('data', c=>s+=c); res.on('end', ()=>{ try{ resolve({status: res.statusCode, headers: res.headers, json: JSON.parse(s||'{}')}) }catch(e){ resolve({status:res.statusCode, headers: res.headers, json:{}}) } }); });
    req.on('error', reject); req.write(JSON.stringify(data)); req.end();
  });
}

async function run(){
  console.log('Demo: starting end-to-end flow');

  // 0. get token from fake platform
  const tokenRes = await postJson('http://localhost:4001/oauth/token', {});
  const token = tokenRes.json.access_token;
  console.log('Token acquired:', !!token);

  // 1. create campaign
  const campaignBody = {
    title: 'AI for a Greener Future',
    body: 'AI can help organizations reduce waste, optimize energy consumption, and make more sustainable decisions.',
    url: 'http://example.com/ai'
  };
  const camp = await postJson('http://localhost:4000/make-campaign', campaignBody);
  console.log('Campaign created:', camp.json);

  // 2. generate captions + image variants
  const fragments = [{text:'Learn practical steps to reduce emissions.'}, {platform:'instagram', text:'Stunning visuals — swipe to learn.'}, {platform:'linkedin', text:'Industry insights and long-form takeaways.'}];
  const captionInstagram = composeCaption({title: campaignBody.title, url: campaignBody.url, fragments}, 'instagram');
  const captionLinkedIn = composeCaption({title: campaignBody.title, url: campaignBody.url, fragments}, 'linkedin');
  console.log('Caption Instagram:', captionInstagram);
  console.log('Caption LinkedIn:', captionLinkedIn);

  const demoDir = path.join(__dirname);
  fs.mkdirSync(demoDir, {recursive:true});
  const imgInst = await generateVariant({sourceBuffer: Buffer.from('src'), width:1080, height:1080, overlayText:'AI Green'});
  const imgLink = await generateVariant({sourceBuffer: Buffer.from('src'), width:1200, height:628, overlayText:'AI Green'});
  fs.writeFileSync(path.join(demoDir,'image_instagram.bin'), imgInst);
  fs.writeFileSync(path.join(demoDir,'image_linkedin.bin'), imgLink);
  console.log('Image variants written to', demoDir);

  // 3. publish via publisher adapter
  const pub = new SocialPublisher({platformName:'instagram', baseUrl:'http://localhost:4001', token});
  const idKey = 'demo_' + crypto.randomBytes(6).toString('hex');
  const publishRes = await pub.publish({post:campaignBody, imageUrl:'demo/image_instagram.bin', caption:captionInstagram, idempotencyKey:idKey, deliveryCallback:'http://localhost:4000/webhook'});
  console.log('Publish response:', publishRes);

  // 4. idempotency: publish again with same idempotency key
  const publishRes2 = await pub.publish({post:campaignBody, imageUrl:'demo/image_instagram.bin', caption:captionInstagram, idempotencyKey:idKey, deliveryCallback:'http://localhost:4000/webhook'});
  console.log('Publish duplicate response:', publishRes2);

  // 5. demonstrate 429 handling: call publisher with simulate429 true
  const pub2 = new SocialPublisher({platformName:'x', baseUrl:'http://localhost:4001', token});
  const idKey2 = 'demo429_' + crypto.randomBytes(6).toString('hex');
  console.log('Triggering 429 handling (publisher will retry):');
  const r429 = await pub2.publish({post:campaignBody, imageUrl:'demo/image_linkedin.bin', caption:captionLinkedIn, idempotencyKey:idKey2, deliveryCallback:'http://localhost:4000/webhook', simulate429:true});
  console.log('Result after 429+retry:', r429);

  // Also show raw 429 response for illustration
  const raw429 = await postJson('http://localhost:4001/publish?simulate429=1', {platform:'x', post:campaignBody, imageUrl:'demo/image_linkedin.bin', caption:captionLinkedIn, delivery_callback:'http://localhost:4000/webhook'}, {'Authorization': `Bearer ${token}`});
  console.log('Raw 429 attempt status:', raw429.status, 'headers:', raw429.headers['retry-after']);

  // 6. webhook security: send valid and forged
  const validPayload = {status:'published', platform:'instagram', postId: (publishRes.id || (publishRes.json && publishRes.json.id)) };
  const sig = require('crypto').createHmac('sha256', 'whsec_test').update(JSON.stringify(validPayload)).digest('hex');
  const valid = await postJson('http://localhost:4000/webhook', validPayload, {'x-signature': sig});
  console.log('Valid webhook response:', valid.status, valid.json);

  const forged = await postJson('http://localhost:4000/webhook', {foo:'bar'}, {'x-signature':'bad'}).catch(e=>({status:500}));
  console.log('Forged webhook response status (expected 400):', forged.status);

  // 7. status persistence
  const status = await new Promise((resolve)=>{ require('http').get('http://localhost:4000/status', (res)=>{ let s=''; res.on('data',c=>s+=c); res.on('end', ()=>resolve({status:res.statusCode, body: s})); }); });
  console.log('Status endpoint returned:', status.body);

  // Save sample result
  const sample = {campaign: camp.json, publish: publishRes, duplicate: publishRes2, after429: r429};
  fs.writeFileSync(path.join(__dirname,'sample-result.json'), JSON.stringify(sample, null, 2));
  console.log('Sample result saved to demo/sample-result.json');
}

run().catch(e=>{ console.error('Demo error:', e); process.exit(1); });
