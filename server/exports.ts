import { mkdir, writeFile, readdir, readFile, unlink, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';
const namePattern = /^scene-[0-9T-]+-[a-f0-9-]+\.(png|json)$/;
export async function saveExport(root: string, image: unknown, manifest: unknown) {
  if (typeof image !== 'string' || !image.startsWith('data:image/png;base64,')) throw new Error('A PNG image is required.');
  const png = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64');
  if (png.length < 33 || png.length > 20 * 1024 * 1024 || !png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || png.toString('ascii',12,16) !== 'IHDR') throw new Error('Invalid or oversized PNG.');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (!width || !height || width > 8192 || height > 8192) throw new Error('Image dimensions are too large.');
  const json = JSON.stringify(manifest, null, 2);
  if (!json || json.length > 2 * 1024 * 1024) throw new Error('Invalid scene metadata.');
  await mkdir(root, { recursive: true });
  const stem = `scene-${new Date().toISOString().replace(/[:.Z]/g,'-')}-${randomUUID()}`;
  const name = `${stem}.png`, metadata = `${stem}.json`;
  await writeFile(path.join(root,name), png, { flag: 'wx' });
  try { await writeFile(path.join(root,metadata), json, { flag: 'wx' }); }
  catch (error) { await unlink(path.join(root,name)); throw error; }
  return { name, url: `/api/exports/file?name=${name}`, metadataUrl: `/api/exports/file?name=${metadata}` };
}
export function createExportsHandler(root = path.resolve(process.env.BIOMOL_EXPORTS || process.env.PROTEIN_EXPORTS || 'scene-exports')) {
  const handler: Connect.NextHandleFunction = (req,res,next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/exports')) return next();
    void (async () => {
      res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
      if (req.method === 'POST' && url.pathname === '/api/exports') {
        if (req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) { res.statusCode=403; res.end(); return; }
        if ((req.headers['x-biomol-export'] !== '1' && req.headers['x-protein-export'] !== '1') || !req.headers['content-type']?.startsWith('application/json')) { res.statusCode=415; res.end(); return; }
        let size=0; const chunks: Buffer[]=[];
        for await (const chunk of req) { size += chunk.length; if (size > 32*1024*1024) { res.statusCode=413; res.end(); return; } chunks.push(Buffer.from(chunk)); }
        const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const result=await saveExport(root,body.image,body.manifest);
        res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(result));
      } else if (req.method === 'GET' && url.pathname === '/api/exports') {
        await mkdir(root,{recursive:true});
        const names=(await readdir(root,{withFileTypes:true})).filter(e=>e.isFile() && namePattern.test(e.name) && e.name.endsWith('.png')).map(e=>e.name).sort().reverse().slice(0,100);
        res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ files:names.map(name=>({ name, url:`/api/exports/file?name=${name}`, metadataUrl:`/api/exports/file?name=${name.replace('.png','.json')}` })) }));
      } else if (req.method === 'GET' && url.pathname === '/api/exports/file') {
        const name=url.searchParams.get('name') || '';
        if (!namePattern.test(name)) throw new Error('Invalid export name');
        const file=path.join(root,name); if (!(await lstat(file)).isFile()) throw new Error('Not a regular file');
        res.setHeader('Content-Type',name.endsWith('.png')?'image/png':'application/json'); res.end(await readFile(file));
      } else { res.statusCode=405; res.end(); }
    })().catch(()=>{ res.statusCode=400; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({error:'Export unavailable. Check image size and Mac output folder permissions.'})); });
  };
  return handler;
}
export function sceneExports(): Plugin {
  const handler=createExportsHandler();
  return { name:'scene-exports', configureServer(server){server.middlewares.use(handler);}, configurePreviewServer(server){server.middlewares.use(handler);} };
}
