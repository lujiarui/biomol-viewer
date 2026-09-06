import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,symlink,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import process from 'node:process';
import {setTimeout} from 'node:timers/promises';
import {Buffer} from 'node:buffer';
import {log} from 'node:console';
const root=fileURLToPath(new URL('../',import.meta.url)),temp=await mkdtemp(path.join(tmpdir(),'biomol-runtime-'));
const escaped=path.join(root,'dist/examples/runtime-boundary.cif');
const child=spawn(process.execPath,[path.join(root,'dist/server.mjs')],{cwd:temp,env:{...process.env,PORT:'0',HOST:'127.0.0.1',BIOMOL_LIBRARY:temp,BIOMOL_EXPORTS:path.join(temp,'exports'),BIOMOL_SESSIONS:path.join(temp,'sessions')},stdio:['ignore','pipe','pipe']});
try{
 const origin=await Promise.race([new Promise((resolve,reject)=>{let output='';child.stdout.on('data',data=>{output+=data;const match=/http:\/\/localhost:(\d+)/.exec(output);if(match)resolve(`http://127.0.0.1:${match[1]}`);});child.on('error',reject);child.on('exit',code=>reject(Error(`Server exited: ${code}`)));}),setTimeout(10000,undefined,{ref:false}).then(()=>{throw Error('Server did not start');})]);
 const get=pathname=>globalThis.fetch(origin+pathname);
 const page=await get('/');assert.equal(page.status,200);assert.match(await page.text(),/<title>Biomol<\/title>/);
 const head=await globalThis.fetch(origin+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 for(const name of ['/server.mjs','/package.json','/src/main.tsx','/assets/%2e%2e/%2e%2e/package.json'])assert.equal((await get(name)).status,404);
 await writeFile(path.join(temp,'model.cif'),'data_private_structure');await symlink(path.join(temp,'model.cif'),escaped);assert.equal((await get('/examples/runtime-boundary.cif')).status,404);
 const listing=await(await get('/api/library')).json();assert(listing.files.some(file=>file.name==='model.cif'));assert.equal(await(await get('/api/library/file?name=model.cif')).text(),'data_private_structure');
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const save=await globalThis.fetch(origin+'/api/exports',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Biomol-Export':'1'},body:JSON.stringify({image,manifest:{test:true}})});assert.equal(save.status,200);const saved=await save.json();const downloaded=Buffer.from(await(await get(saved.url)).arrayBuffer());assert(downloaded.equals(await readFile(path.join(temp,'exports',saved.name))));assert.deepEqual(await(await get(saved.metadataUrl)).json(),{test:true});
 const sessionBody={version:1,structures:[{name:'model.cif',sourceText:'data_model'}]};const session=await globalThis.fetch(origin+'/api/sessions',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Biomol-Session':'1'},body:JSON.stringify(sessionBody)});assert.equal(session.status,200);const shared=await session.json();assert.deepEqual(await(await get(`/api/sessions/${shared.id}`)).json(),sessionBody);
 const video=Buffer.alloc(256,1),videoSave=await globalThis.fetch(origin+'/api/videos',{method:'POST',headers:{Origin:origin,'Content-Type':'video/webm','X-Biomol-Video':'1'},body:video});assert.equal(videoSave.status,200);const videoFile=await videoSave.json();assert((await get(videoFile.url)).ok);
 assert.equal((await globalThis.fetch(origin+'/api/exports',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json','X-Biomol-Export':'1'},body:'{}'})).status,403);
 log('Standalone runtime passed: branding, assets, path boundaries, library, PNG/JSON/video export, session save/restore, cross-origin rejection.');
}finally{child.kill();await unlink(escaped).catch(()=>{});await rm(temp,{recursive:true,force:true});}
