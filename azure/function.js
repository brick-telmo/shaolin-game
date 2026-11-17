import {app} from '@azure/functions';
import {CosmosClient} from '@azure/cosmos';
import {CosmosStore} from './cosmos-store.js';
import {AzureMatchmakingService} from './online-service.js';

let service;

function getService() {
  if (!service) {
    const {COSMOS_ENDPOINT, COSMOS_KEY} = process.env;
    if (!COSMOS_ENDPOINT || !COSMOS_KEY) throw new Error('Cosmos DB configuration is missing.');
    const client = new CosmosClient({endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY});
    service = new AzureMatchmakingService(new CosmosStore(client.database('game').container('online')));
  }
  return service;
}

app.http('online', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'online/{action}',
  handler: async request => {
    const encoded = request.headers.get('x-ms-client-principal');
    let principal;
    try {
      principal = encoded && JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    } catch {
      return {status: 401, jsonBody: {error: 'Sign in to play online.'}};
    }
    if (!principal?.userId || !principal.userRoles?.includes('authenticated'))
      return {status: 401, jsonBody: {error: 'Sign in to play online.'}};
    const origin = process.env.PUBLIC_ORIGIN;
    if (!origin) throw new Error('PUBLIC_ORIGIN is missing.');
    const headers = new Headers(request.headers);
    headers.set('oai-authenticated-user-id', principal.userId);
    const response = await getService().handle(new Request(`${origin}/api/online/${request.params.action}`, {
      method: 'POST', headers, body: await request.text()
    }));
    return {status: response.status, headers: Object.fromEntries(response.headers), body: await response.text()};
  }
});
