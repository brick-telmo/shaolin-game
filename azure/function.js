import {app} from '@azure/functions';
import {CosmosClient} from '@azure/cosmos';
import {CosmosStore} from './cosmos-store.js';
import {AzureMatchmakingService} from './online-service.js';
import {Accounts, smtpSender} from './accounts.js';
import {graphSender} from './graph-mail.js';

let service, accounts;

function getService() {
  if (!service) {
    const {COSMOS_ENDPOINT, COSMOS_KEY} = process.env;
    if (!COSMOS_ENDPOINT || !COSMOS_KEY) throw new Error('Cosmos DB configuration is missing.');
    const client = new CosmosClient({endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY});
    const container = client.database('game').container('online');
    service = new AzureMatchmakingService(new CosmosStore(container));
    accounts = new Accounts(container, {origin: process.env.PUBLIC_ORIGIN, sendMail: graphSender(process.env) || smtpSender(process.env)});
  }
  return service;
}

app.http('online', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'online/{action}',
  handler: async request => {
    getService();
    const account = await accounts.authenticate(request);
    if (!account)
      return {status: 401, jsonBody: {error: 'Sign in to play online.'}};
    const origin = process.env.PUBLIC_ORIGIN;
    if (!origin) throw new Error('PUBLIC_ORIGIN is missing.');
    const headers = new Headers(request.headers);
    headers.set('oai-authenticated-user-id', account.id);
    const response = await getService().handle(new Request(`${origin}/api/online/${request.params.action}`, {
      method: 'POST', headers, body: await request.text()
    }));
    return {status: response.status, headers: Object.fromEntries(response.headers), body: await response.text()};
  }
});

app.http('account', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'account/{action}',
  handler: async request => {
    getService();
    const origin = process.env.PUBLIC_ORIGIN;
    if (!origin) throw new Error('PUBLIC_ORIGIN is missing.');
    const response = await accounts.handle(new Request(`${origin}/api/account/${request.params.action}`, {
      method: 'POST', headers: new Headers(request.headers), body: await request.text()
    }), request.params.action);
    return {status: response.status, headers: Object.fromEntries(response.headers), body: await response.text()};
  }
});
