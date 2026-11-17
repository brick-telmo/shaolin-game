import {mkdir, readFile, rm, writeFile, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {clientFiles} from '../client-assets.js';

const root = new URL('../', import.meta.url);
const output = new URL('../dist/azure/', import.meta.url);
const site = new URL('site/', output), api = new URL('api/', output);
await rm(output, {recursive: true, force: true});
await mkdir(site, {recursive: true});
await mkdir(api, {recursive: true});
for (const name of clientFiles) {
  if (name === 'index.html') {
    const html = await readFile(new URL(name, root), 'utf8');
    await writeFile(new URL(name, site), html.replace('<html lang="en">', '<html lang="en" data-auth-provider="azure">'));
  } else {
    await copyFile(new URL(name, root), new URL(name, site));
  }
}
await copyFile(new URL('staticwebapp.config.json', import.meta.url), new URL('staticwebapp.config.json', site));
await build({
  entryPoints: [fileURLToPath(new URL('function.js', import.meta.url))],
  outfile: fileURLToPath(new URL('index.js', api)),
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  external: ['@azure/functions', '@azure/cosmos', '@azure/msal-node']
});
const rootPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
await writeFile(new URL('package.json', api), JSON.stringify({
  name: 'five-forms-azure-api', version: '1.0.0', private: true, type: 'module', main: 'index.js',
  engines: {node: '>=22'}, dependencies: rootPackage.dependencies
}, null, 2));
await writeFile(new URL('host.json', api), JSON.stringify({version: '2.0'}));
console.log('Built Azure static site and managed Functions API.');
