const http = require('http');
const {URL} = require('url');
const crypto = require('crypto');

function postJson(urlString, data, headers={}){
  return new Promise((resolve,reject)=>{
    const url = new URL(urlString);
    const opts = {hostname: url.hostname, port: url.port, path: url.pathname + (url.search||''), method:'POST', headers:Object.assign({'Content-Type':'application/json'}, headers)};
    const req = http.request(opts, (res)=>{
      let s=''; res.on('data', c=>s+=c); res.on('end', ()=>{
        const out = {status: res.statusCode, headers: res.headers, body: s};
        try{ out.json = JSON.parse(s||'{}')}catch(e){out.json={}};
        resolve(out);
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(data)); req.end();
  });
}

class SocialPublisher {
  constructor({platformName, baseUrl, token} = {}){
    this.platformName = platformName;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async publish({post, imageUrl, caption, idempotencyKey, deliveryCallback, simulate429=false}){
    let url = this.baseUrl + '/publish';
    if (simulate429) url += '?simulate429=1';
    const body = {platform: this.platformName, post, imageUrl, caption, delivery_callback: deliveryCallback};
    const res = await postJson(url, body, {'Authorization': `Bearer ${this.token}`, 'Idempotency-Key': idempotencyKey});
    if (res.status === 429){
      const ra = res.headers['retry-after'] || '1';
      const wait = parseInt(Array.isArray(ra)?ra[0]:ra,10) * 1000;
      await new Promise(r=>setTimeout(r, wait));
      return this.publish({post,imageUrl,caption,idempotencyKey,deliveryCallback,simulate429:false});
    }
    return res.json;
  }
}

module.exports = {SocialPublisher};
