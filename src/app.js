const http = require('http');
const {startFakePlatform} = require('./fake-platform');
const {generateVariant} = require('./image');
const {composeCaption} = require('./caption');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '..', 'db.json');
function loadDB(){ try{return JSON.parse(fs.readFileSync(DB_FILE,'utf8'))}catch(e){return {posts:[], jobs:[]}} }
function saveDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }

function jsonBody(req){ return new Promise((resolve)=>{ let s=''; req.on('data',c=>s+=c); req.on('end', ()=>{ try{resolve(JSON.parse(s||'{}'))}catch(e){resolve({})} }); }); }

async function startApp({port=4000, fakeUrl='http://localhost:4001', webhookSecret='whsec_test'}={}){
  const fake = startFakePlatform({port:4001, webhookSecret});

  const server = http.createServer(async (req,res)=>{
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === 'POST' && url.pathname === '/get-token'){
      // forward to fake platform
      const p = new URL(fake.url + '/oauth/token');
      const r = require('http').request({hostname:p.hostname, port:p.port, path:p.pathname, method:'POST'}, (resp)=>{
        let s=''; resp.on('data',c=>s+=c); resp.on('end', ()=>{ res.writeHead(resp.statusCode,{'Content-Type':'application/json'}); res.end(s); });
      }); r.on('error', ()=>res.writeHead(500).end()); r.end();
      return;
    }

    if (req.method === 'POST' && url.pathname === '/make-campaign'){
      const body = await jsonBody(req);
      const {title, body:bd, url:postUrl, scheduledAt} = body;
      if (!title || !postUrl) { res.writeHead(400, {'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'missing fields'})); }
      const db = loadDB();
      const id = 'entry_' + crypto.randomBytes(6).toString('hex');
      const entry = {id, title, body: bd, url: postUrl, status:'queued', scheduledAt: scheduledAt || Date.now()};
      db.posts.push(entry); saveDB(db);
      res.writeHead(200, {'Content-Type':'application/json'}); return res.end(JSON.stringify(entry));
    }

    if (req.method === 'POST' && url.pathname === '/webhook'){
      const sig = (req.headers['x-signature']||'');
      const payload = await jsonBody(req);
      const expected = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');
      if (sig !== expected) { res.writeHead(400,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'forged'})); }
      const db = loadDB();
      const q = db.posts.find(p=>p.status==='queued');
      if (q) q.status = 'published'; saveDB(db);
      res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true}));
    }

    if (req.method === 'GET' && url.pathname === '/status'){
      res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify(loadDB()));
    }

    // Serve dashboard root
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')){
      try{
        const file = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
        res.writeHead(200, {'Content-Type':'text/html'}); return res.end(file);
      }catch(e){ res.writeHead(500); return res.end('dashboard not found'); }
    }

    // Serve static files under /static/
    if (req.method === 'GET' && url.pathname.startsWith('/static/')){
      const rel = url.pathname.replace('/static/','');
      const p = path.join(__dirname, '..', 'public', rel);
      if (fs.existsSync(p)){
        const ext = path.extname(p).toLowerCase();
        const types = {'.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
        res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
        return res.end(fs.readFileSync(p));
      }
    }

    // Publish endpoint: use existing SocialPublisher adapter
    if (req.method === 'POST' && url.pathname === '/publish'){
      const body = await jsonBody(req);
      const {platform, post, imageUrl, caption, idempotencyKey, simulate429} = body;
      try{
        const {SocialPublisher} = require('./publisher');
        // acquire token from fake platform
        const tokenReq = await new Promise((resolve)=>{ const p = new URL('http://localhost:4001/oauth/token'); const r = require('http').request({hostname:p.hostname, port:p.port, path:p.pathname, method:'POST'}, (resp)=>{ let s=''; resp.on('data',c=>s+=c); resp.on('end', ()=>resolve(JSON.parse(s||'{}'))); }); r.end(); });
        const publisher = new (require('./publisher').SocialPublisher)({platformName: platform, baseUrl: 'http://localhost:4001', token: tokenReq.access_token});
        const result = await publisher.publish({post, imageUrl, caption, idempotencyKey, simulate429});
        res.writeHead(200, {'Content-Type':'application/json'}); return res.end(JSON.stringify(result));
      }catch(e){ res.writeHead(500, {'Content-Type':'application/json'}); return res.end(JSON.stringify({error: e.message})); }
    }

    res.writeHead(404); res.end('not found');
  });

  server.listen(port);

  return {close: ()=>{server.close(); fake.close()}, url: `http://localhost:${port}`};
}

if (require.main === module){ startApp().then(s=>console.log('App listening at', s.url)); }

module.exports = {startApp};
