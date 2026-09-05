import {build} from 'esbuild';
await build({entryPoints:['server/start.ts'],outfile:'dist/server.mjs',bundle:true,platform:'node',format:'esm',target:'node22',packages:'bundle'});
