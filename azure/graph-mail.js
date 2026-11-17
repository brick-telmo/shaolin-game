import {ConfidentialClientApplication} from '@azure/msal-node';

export function graphSender(env, {fetcher = fetch, createClient = config => new ConfidentialClientApplication(config)} = {}) {
  const {GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_MAIL_FROM} = env;
  const settings = [GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_MAIL_FROM];
  if (settings.every(value => !value)) return null;
  if (settings.some(value => !value)) throw new Error('Microsoft Graph mail configuration is incomplete.');
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!guid.test(GRAPH_TENANT_ID) || !guid.test(GRAPH_CLIENT_ID) ||
      !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/.test(GRAPH_MAIL_FROM))
    throw new Error('Microsoft Graph mail configuration is invalid.');
  const client = createClient({
    auth: {clientId: GRAPH_CLIENT_ID, authority: `https://login.microsoftonline.com/${GRAPH_TENANT_ID}`, clientSecret: GRAPH_CLIENT_SECRET}
  });
  return async (to, link) => {
    const result = await client.acquireTokenByClientCredential({scopes: ['https://graph.microsoft.com/.default']});
    if (!result?.accessToken) throw new Error('Microsoft Graph did not return an access token.');
    const response = await fetcher(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(GRAPH_MAIL_FROM)}/sendMail`, {
      method: 'POST',
      headers: {authorization: `Bearer ${result.accessToken}`, 'content-type': 'application/json'},
      body: JSON.stringify({
        message: {
          subject: 'Reset your Five Forms password',
          body: {contentType: 'Text', content: `Use this link within 30 minutes to reset your password:\n\n${link}\n\nIf you did not request this, ignore this message.`},
          toRecipients: [{emailAddress: {address: to}}]
        },
        saveToSentItems: false
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Microsoft Graph mail request failed (${response.status}).`);
  };
}
