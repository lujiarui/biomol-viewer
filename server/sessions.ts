import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';

const idPattern=/^[a-f0-9-]{36}$/;
function localOrigins(port:string){const values:string[]=[];for(const list of Object.values(networkInterfaces()))for(const item of list||[])if(item.family==='IPv4'&&!item.internal)values.push(`http://${item.address}:${port}`);return values;}
export function createSessionsHandler(root=path.resolve(process.env.BIOMOL_SESSIONS||'shared-sessions')):Connect.NextHandleFunction {
 return (req,res,next)=>{const url=new URL(req.url||'/','http://localhost');if(!url.pathname.startsWith('/api/sessions'))return next();void(async()=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');await mkdir(root,{recursive:true});
  if(req.method==='POST'&&url.pathname==='/api/sessions'){
   if(req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`){res.statusCode=403;res.end();return;}
   if(req.headers['x-biomol-session']!=='1'||!req.headers['content-type']?.startsWith('application/json')){res.statusCode=415;res.end();return;}
   let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>64*1024*1024){res.statusCode=413;res.end();return;}chunks.push(Buffer.from(chunk));}
   const text=Buffer.concat(chunks).toString('utf8'),data=JSON.parse(text);if(data?.version!==1||!Array.isArray(data.structures)||!data.structures.length)throw Error('Invalid session');
   const id=randomUUID();await writeFile(path.join(root,`${id}.json`),text,{flag:'wx'});const port=(req.headers.host||'localhost:5173').split(':').at(-1)||'5173';
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id,path:`/?session=${id}`,networkOrigins:localOrigins(port)}));
  }else if(req.method==='GET'){
   const id=url.pathname.split('/').at(-1)||'';if(!idPattern.test(id))throw Error('Invalid session id');const body=await readFile(path.join(root,`${id}.json`));res.setHeader('Content-Type','application/json');res.end(body);
  }else{res.statusCode=405;res.end();}
 })().catch(()=>{res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Shared session is unavailable.'}));});};
}
export function sharedSessions():Plugin{const handler=createSessionsHandler();return{name:'shared-sessions',configureServer(server){server.middlewares.use(handler);},configurePreviewServer(server){server.middlewares.use(handler);}};}
