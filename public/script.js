async function postJson(url, data){
  const res = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
  const txt = await res.text();
  try{ return {status: res.status, json: JSON.parse(txt)} }catch(e){ return {status: res.status, text: txt} }
}

function el(id){return document.getElementById(id)}

el('create').addEventListener('click', async ()=>{
  const title = el('title').value;
  const content = el('content').value;
  const platforms = Array.from(el('platforms').selectedOptions).map(o=>o.value);
  const body = {title, body: content, url: 'http://example.com/ai'};
  const r = await postJson('/make-campaign', body);
  el('campaignResult').textContent = JSON.stringify(r.json || r.text || r, null, 2);
  // generate captions and placeholder images by calling endpoints on the backend if available
  // Compose captions client-side for demo using same fragment scheme
  const fragments = [{text:'Learn practical steps to reduce emissions.'}, {platform:'instagram', text:'Stunning visuals — swipe to learn.'}, {platform:'linkedin', text:'Industry insights and long-form takeaways.'}];
  el('instagramCard').querySelector('.caption').textContent = (r.json && r.json.title) ? `${r.json.title}\n${fragments[0].text} ${fragments[1].text}\n${r.json.url}` : '';
  el('linkedinCard').querySelector('.caption').textContent = (r.json && r.json.title) ? `${r.json.title}\n${fragments[0].text} ${fragments[2].text}\n${r.json.url}` : '';
  // load image blobs
  el('img-inst').src = '/static/image_instagram.png';
  el('img-link').src = '/static/image_linkedin.png';
});

el('publish-inst').addEventListener('click', async ()=>{
  el('status-inst').textContent = 'Publishing...';
  const idKey = 'ui_' + Date.now();
  const res = await postJson('/publish', {platform:'instagram', post:{title: el('title').value}, imageUrl:'/static/image_instagram.png', caption: el('instagramCard').querySelector('.caption').textContent, idempotencyKey: idKey});
  el('status-inst').textContent = JSON.stringify(res.json || res, null, 2);
});

el('publish-link').addEventListener('click', async ()=>{
  el('status-link').textContent = 'Publishing...';
  const idKey = 'ui_' + Date.now();
  const res = await postJson('/publish', {platform:'linkedin', post:{title: el('title').value}, imageUrl:'/static/image_linkedin.png', caption: el('linkedinCard').querySelector('.caption').textContent, idempotencyKey: idKey});
  el('status-link').textContent = JSON.stringify(res.json || res, null, 2);
});

el('testIdem').addEventListener('click', async ()=>{
  const idKey = 'ui_idem_' + Date.now();
  const res1 = await postJson('/publish', {platform:'instagram', post:{title: el('title').value}, imageUrl:'/static/image_instagram.png', caption: el('instagramCard').querySelector('.caption').textContent, idempotencyKey: idKey});
  const res2 = await postJson('/publish', {platform:'instagram', post:{title: el('title').value}, imageUrl:'/static/image_instagram.png', caption: el('instagramCard').querySelector('.caption').textContent, idempotencyKey: idKey});
  el('reliabilityResult').textContent = `First: ${JSON.stringify(res1.json||res1)}\nSecond: ${JSON.stringify(res2.json||res2)}`;
});

el('test429').addEventListener('click', async ()=>{
  const idKey = 'ui_429_' + Date.now();
  el('reliabilityResult').textContent = 'Triggering 429 test...';
  const res = await postJson('/publish', {platform:'x', post:{title: el('title').value}, imageUrl:'/static/image_linkedin.png', caption: el('linkedinCard').querySelector('.caption').textContent, idempotencyKey: idKey, simulate429: true});
  el('reliabilityResult').textContent = JSON.stringify(res.json||res, null, 2);
});

el('testHook').addEventListener('click', async ()=>{
  // valid
  const payload = {status:'published', platform:'instagram', postId:'demo_post'};
  const valid = await postJson('/webhook', payload, {'x-signature': 'valid-demo'});
  // forged
  const forged = await postJson('/webhook', {foo:'bar'}, {'x-signature':'bad'});
  el('reliabilityResult').textContent = `Valid: ${valid.status} ${JSON.stringify(valid.json||valid)}\nForged: ${forged.status} ${JSON.stringify(forged.json||forged)}`;
});

el('refreshStatus').addEventListener('click', async ()=>{
  const res = await fetch('/status');
  const txt = await res.text();
  el('status').textContent = txt;
});

// load placeholder images if available
async function preload(){
  // create small data URIs if static pngs not present
  try{
    const resp = await fetch('/static/image_instagram.png');
    if (!resp.ok) {
      el('img-inst').src = 'data:image/png;base64,iVBORw0KGgo=';
      el('img-link').src = 'data:image/png;base64,iVBORw0KGgo=';
    } else {
      el('img-inst').src = '/static/image_instagram.png';
      el('img-link').src = '/static/image_linkedin.png';
    }
  }catch(e){ el('img-inst').src = ''; el('img-link').src = ''; }
}
preload();
