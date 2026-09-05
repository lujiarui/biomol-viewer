import {rm,access} from 'node:fs/promises';
import process from 'node:process';
import {log} from 'node:console';
import {fileURLToPath, URL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const names=['test-results','playwright-report','node_modules/.vite','node_modules/.cache','tsconfig.tsbuildinfo','.DS_Store'];
if(process.argv.includes('--dependencies')){
 await Promise.all(['dist/index.html','dist/server.mjs'].map(name=>access(path.join(root,name))));
 names.push('node_modules');
}
for(const name of names)await rm(path.join(root,name),{recursive:true,force:true});
log(process.argv.includes('--dependencies')?'Compact checkout ready. Run npm start; use npm ci before development.':'Removed generated caches and reports. Sources, built app, structures and exports preserved.');
