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

    res.writeHead(404); res.end('not found');
  });

  server.listen(port);

  return {close: ()=>{server.close(); fake.close()}, url: `http://localhost:${port}`};
}

if (require.main === module){ startApp().then(s=>console.log('App listening at', s.url)); }

module.exports = {startApp};
