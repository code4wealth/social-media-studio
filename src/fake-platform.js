const http = require('http');
const crypto = require('crypto');
const {URL} = require('url');

function jsonBody(req){
  return new Promise((resolve)=>{
    let s = '';
    req.on('data', c=>s+=c);
    req.on('end', ()=>{
      try{resolve(JSON.parse(s||'{}'))}catch(e){resolve({})}
    });
  })
}

function startFakePlatform({port = 4001, webhookSecret = 'whsec_test'} = {}){
  const tokens = new Map();
  const idempotency = new Map();
  let publishCount = 0;

  const server = http.createServer(async (req,res)=>{
    const u = new URL(req.url, `http://localhost:${port}`);
    if (req.method === 'POST' && u.pathname === '/oauth/token'){
      const token = crypto.randomBytes(16).toString('hex');
      tokens.set(token, true);
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({access_token: token, token_type: 'bearer', expires_in: 3600}));
    }

    if (req.method === 'POST' && u.pathname === '/publish'){
      const headers = Object.fromEntries(Object.entries(req.headers));
      const key = headers['idempotency-key'];
      const retryAfterSim = u.searchParams.get('simulate429') === '1';
      const auth = headers['authorization'] || '';

      const body = await jsonBody(req);

      if (!auth.startsWith('Bearer ')) { res.writeHead(401,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'unauthorized'})); }
      const token = auth.slice('Bearer '.length);
      if (!tokens.has(token)) { res.writeHead(401,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'invalid_token'})); }

      publishCount++;
      if (retryAfterSim && publishCount === 1){ res.writeHead(429, {'Content-Type':'application/json','Retry-After':'1'}); return res.end(JSON.stringify({error:'rate_limited'})); }

      if (key && idempotency.has(key)){
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ok:true,id:idempotency.get(key), duplicate:true}));
      }

      const id = 'post_' + crypto.randomBytes(6).toString('hex');
      if (key) idempotency.set(key,id);

      const deliveryUrl = body && body.delivery_callback;
      if (deliveryUrl){
        const payload = {status:'published', platform: body.platform, postId: id};
        const sig = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');
        setTimeout(()=>{
          try{
            const p = new URL(deliveryUrl);
            const post = http.request({hostname:p.hostname, port:p.port, path:p.pathname, method:'POST', headers:{'Content-Type':'application/json','x-signature':sig}}, ()=>{});
            post.on('error', ()=>{});
            post.write(JSON.stringify(payload));
            post.end();
          }catch(e){}
        }, 300);
      }

      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ok:true,id}));
    }

    res.writeHead(404); res.end('not found');
  });

  server.listen(port);
  return {close: ()=>server.close(), url: `http://localhost:${port}`, webhookSecret};
}

if (require.main === module){
  const srv = startFakePlatform();
  console.log('Fake platform running at', srv.url);
}

module.exports = {startFakePlatform};
