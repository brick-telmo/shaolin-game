import {readFile,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {build} from 'esbuild';
export const clientFiles=['index.html','style.css','app.js','core.js','render.js','arena-data.js','arenas.js','arena-motion.js','story.js','story-data.js','showcase-shortcut.js','boss-demo.html','boss-demo.css','boss-demo.js','icon.svg','online-client.js','online-state.js'];
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'};
const assets=Object.fromEntries(await Promise.all(clientFiles.map(async name=>['/'+name,{body:await readFile(name,'utf8'),type:types[name.split('.').pop()]}])));
await mkdir('.build',{recursive:true});await writeFile('.build/assets.js','export default '+JSON.stringify(assets)+';');
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});
await build({entryPoints:['worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
await mkdir('dist/.openai',{recursive:true});
try{await cp('.openai/hosting.json','dist/.openai/hosting.json');}catch(e){if(e.code!=='ENOENT')throw e;}
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built game assets, authoritative match service, and database migrations.');
