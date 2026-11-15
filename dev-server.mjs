import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import worker from './dist/server/index.js';
import {localDatabase} from './local-db.mjs';
const db=localDatabase(process.env.LOCAL_DATABASE||':memory:');
const port=Number(process.env.PORT||4173);
createServer(async(req,res)=>{
  try {
    let user=req.headers.cookie?.match(/(?:^|; )local_player=([a-zA-Z0-9-]+)/)?.[1];
    if(!user){user=randomUUID();res.setHeader('Set-Cookie',`local_player=${user}; HttpOnly; SameSite=Strict; Path=/`);}
    // This identity adapter exists ONLY in the loopback development server.
    const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id',user);
    const chunks=[];for await(const part of req)chunks.push(part);
    const response=await worker.fetch(new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers,
      ...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),{DB:db});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){console.error(e);res.writeHead(500);res.end('Development server error');}
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} (use separate browser profiles for two players)`));
