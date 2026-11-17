import {execFileSync} from 'node:child_process';

const [subscription, resourceGroup, siteName, accountName] = process.argv.slice(2);
if (!/^[\da-f-]{36}$/i.test(subscription || '') ||
    ![resourceGroup, siteName, accountName].every(value => /^[\w.-]+$/.test(value || ''))) {
  throw new Error('Usage: node infra/configure.mjs <subscription-id> <resource-group> <static-site> <cosmos-account>');
}
const args = ['account', 'get-access-token', '--subscription', subscription, '--resource',
  'https://management.azure.com/', '--query', 'accessToken', '-o', 'tsv'];
const token = process.platform === 'win32'
  ? execFileSync(process.env.ComSpec, ['/d', '/s', '/c', `az ${args.join(' ')}`], {encoding: 'utf8'}).trim()
  : execFileSync('az', args, {encoding: 'utf8'}).trim();
if (!token) throw new Error('Azure CLI did not return an access token.');

const base = `https://management.azure.com/subscriptions/${subscription}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers`;
const sitePath = `${base}/Microsoft.Web/staticSites/${encodeURIComponent(siteName)}`;
const accountPath = `${base}/Microsoft.DocumentDB/databaseAccounts/${encodeURIComponent(accountName)}`;
async function arm(path, version, method = 'GET', body) {
  const response = await fetch(`${path}?api-version=${version}`, {
    method,
    headers: {authorization: `Bearer ${token}`, ...(body ? {'content-type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {})
  });
  if (!response.ok) throw new Error(`Azure configuration request failed: ${method} ${new URL(path).pathname} (${response.status}).`);
  return response.json();
}

const [site, account, keys, settings] = await Promise.all([
  arm(sitePath, '2025-03-01'),
  arm(accountPath, '2024-11-15'),
  arm(`${accountPath}/listKeys`, '2024-11-15', 'POST'),
  arm(`${sitePath}/listAppSettings`, '2025-03-01', 'POST')
]);
if (!site.properties.defaultHostname || !account.properties.documentEndpoint || !keys.primaryMasterKey)
  throw new Error('Azure did not return the required application configuration.');
await arm(`${sitePath}/config/appsettings`, '2025-03-01', 'PUT', {
  properties: {
    ...settings.properties,
    COSMOS_ENDPOINT: account.properties.documentEndpoint,
    COSMOS_KEY: keys.primaryMasterKey,
    PUBLIC_ORIGIN: `https://${site.properties.defaultHostname}`
  }
});
console.log('Configured Static Web Apps settings without printing credentials.');
