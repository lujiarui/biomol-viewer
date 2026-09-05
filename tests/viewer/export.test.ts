import { test, expect } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { saveExport } from '../../server/exports';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
test('export writes uniquely named PNG and metadata without accepting client paths',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'protein-export-'));
 try{const a=await saveExport(root,image,{camera:'test'}),b=await saveExport(root,image,{camera:'test'});
 expect(a.name).not.toBe(b.name);expect(a.name).toMatch(/^scene-[0-9T-]+-[a-f0-9-]+\.png$/);
 expect((await readFile(path.join(root,a.name))).subarray(1,4).toString()).toBe('PNG');
 expect(JSON.parse(await readFile(path.join(root,a.name.replace('.png','.json')),'utf8'))).toEqual({camera:'test'});
 await expect(saveExport(root,'data:text/html;base64,PGgxPg==',{})).rejects.toThrow();
 await expect(saveExport(root,'data:image/png;base64,abcd',{})).rejects.toThrow();
 expect(await readdir(root)).toHaveLength(4);
 }finally{await rm(root,{recursive:true,force:true});}
});
