import test from 'node:test';
import assert from 'node:assert/strict';
import {graphSender} from './graph-mail.js';

const settings = {
  GRAPH_TENANT_ID: '11111111-1111-1111-1111-111111111111',
  GRAPH_CLIENT_ID: '22222222-2222-2222-2222-222222222222',
  GRAPH_CLIENT_SECRET: 'test-secret',
  GRAPH_MAIL_FROM: 'game@example.test'
};

test('Graph sender acquires an app token and sends a reset link from the configured mailbox', async () => {
  let config, scope, request;
  const send = graphSender(settings, {
    createClient: value => {
      config = value;
      return {acquireTokenByClientCredential: async value => { scope = value; return {accessToken: 'test-token'}; }};
    },
    fetcher: async (url, options) => { request = {url, ...options}; return {ok: true, status: 202}; }
  });
  await send('player@example.test', 'https://game.test/#reset=secret');
  assert.equal(config.auth.authority, 'https://login.microsoftonline.com/' + settings.GRAPH_TENANT_ID);
  assert.deepEqual(scope.scopes, ['https://graph.microsoft.com/.default']);
  assert.equal(request.url, 'https://graph.microsoft.com/v1.0/users/game%40example.test/sendMail');
  assert.equal(request.headers.authorization, 'Bearer test-token');
  const body = JSON.parse(request.body);
  assert.equal(body.message.toRecipients[0].emailAddress.address, 'player@example.test');
  assert.match(body.message.body.content, /https:\/\/game\.test\/#reset=secret/);
  assert.equal(body.saveToSentItems, false);
});

test('Graph sender rejects incomplete configuration and surfaces delivery errors', async () => {
  assert.equal(graphSender({}), null);
  assert.throws(() => graphSender({GRAPH_TENANT_ID: settings.GRAPH_TENANT_ID}), /incomplete/);
  const send = graphSender(settings, {
    createClient: () => ({acquireTokenByClientCredential: async () => ({accessToken: 'test-token'})}),
    fetcher: async () => ({ok: false, status: 403})
  });
  await assert.rejects(send('player@example.test', 'https://game.test/'), /failed \(403\)/);
});
