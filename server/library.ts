import { readdir, realpath, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, Connect } from 'vite';
const supported = /\.(pdb|cif|mmcif)$/i;
export async function listLibrary(root: string) {
  const files: { name: string; size: number; modified: number }[] = [];
  async function visit(dir: string, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
      const name = prefix + entry.name;
      if (entry.isDirectory()) await visit(path.join(dir, entry.name), name + '/');
      else if (entry.isFile() && supported.test(name)) {
        const info = await stat(path.join(dir, entry.name));
        files.push({ name, size: info.size, modified: info.mtimeMs });
      }
    }
  }
  await visit(root);
  return files.sort((a, b) => b.modified - a.modified);
}
export async function readLibraryFile(root: string, name: string) {
  if (!supported.test(name) || name.includes('\\') || name.split('/').some(p => p === '..' || p.startsWith('.')) || path.isAbsolute(name)) throw new Error('Invalid file');
  const base = await realpath(root);
  const resolved = await realpath(path.resolve(base, name));
  if (!resolved.startsWith(base + path.sep)) throw new Error('Outside library');
  // Only entries advertised by the library can be read; symlinks are excluded.
  if (!(await listLibrary(base)).some(f => f.name === name)) throw new Error('File not found');
  return readFile(resolved);
}
export function createLibraryHandler(root = path.resolve(process.env.BIOMOL_LIBRARY || process.env.PROTEIN_LIBRARY || 'shared-structures')) {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/library')) return next();
    void (async () => {
      res.setHeader('Cache-Control', 'no-store');
      if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
      if (url.pathname === '/api/library') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ files: await listLibrary(root) }));
      } else if (url.pathname === '/api/library/file') {
        const data = await readLibraryFile(root, url.searchParams.get('name') || '');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(data);
      } else { res.statusCode = 404; res.end(); }
    })().catch(() => { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Mac library unavailable or file not found. Check the shared folder on the Mac.' })); });
  };
  return handler;
}
export function macLibrary(): Plugin {
  const handler=createLibraryHandler();
  return { name: 'mac-structure-library', configureServer(server) { server.middlewares.use(handler); }, configurePreviewServer(server) { server.middlewares.use(handler); } };
}
