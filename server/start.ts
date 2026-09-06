import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';
import path from 'node:path';
import {createLibraryHandler} from './library';
import {createExportsHandler} from './exports';
import {createSessionsHandler} from './sessions';
const assets=fileURLToPath(new URL('./',import.meta.url));
const project=path.resolve(assets,'..');
const library=createLibraryHandler(path.resolve(project,process.env.BIOMOL_LIBRARY || process.env.PROTEIN_LIBRARY || 'shared-structures'));
const exportsHandler=createExportsHandler(path.resolve(project,process.env.BIOMOL_EXPORTS || process.env.PROTEIN_EXPORTS || 'scene-exports'));
const sessionsHandler=createSessionsHandler(path.resolve(project,process.env.BIOMOL_SESSIONS || 'shared-sessions'));
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.cif':'text/plain; charset=utf-8'};
await stat(path.join(assets,'index.html'));
const server=createServer((req,res)=>{
 library(req,res,()=>exportsHandler(req,res,()=>sessionsHandler(req,res,()=>{void (async()=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const name=decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  if(name.split('/').some(segment=>segment.startsWith('.')) || name.includes('\\'))throw Error('Invalid path');
  const relative=name==='/'?'index.html':name.slice(1),type=mime[path.extname(relative)];
  if(!type || !(relative==='index.html'||relative.startsWith('assets/')||relative.startsWith('examples/')||relative==='favicon.ico'))throw Error('Not found');
  const resolved=await realpath(path.resolve(assets,relative));
  if(!resolved.startsWith(assets) || !(await stat(resolved)).isFile())throw Error('Not found');
  const data=await readFile(resolved);res.setHeader('Content-Type',type);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control',relative.startsWith('assets/')?'public, max-age=31536000, immutable':'no-cache');res.setHeader('Content-Length',data.length);res.end(req.method==='HEAD'?undefined:data);
 })().catch(()=>{res.statusCode=404;res.end('Not found');});})));
});
const port=Number(process.env.PORT || 5173),host=process.env.HOST || '0.0.0.0';
if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid PORT');
server.listen(port,host,()=>{
 const address=server.address(),actual=typeof address==='object'&&address?address.port:port;
 console.log(`Biomol Viewer: http://localhost:${actual}/`);
 if(host==='0.0.0.0')for(const addresses of Object.values(networkInterfaces()))for(const entry of addresses || [])if(entry.family==='IPv4'&&!entry.internal)console.log(`Network: http://${entry.address}:${actual}/`);
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
