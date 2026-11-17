import {createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import nodemailer from 'nodemailer';

const scrypt = promisify(scryptCallback);
const PARTITION = 'game';
const SESSION_SECONDS = 7 * 86400;
const RESET_MS = 30 * 60 * 1000;
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const accountId = username => `account:${username.toLowerCase()}`;
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: {'content-type': 'application/json', 'cache-control': 'no-store', ...headers}
});
const cookie = (value, age) => `fiveforms_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;

class AccountError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function username(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(value))
    throw new AccountError(400, 'Username must be 3–24 letters, numbers or underscores.');
  return value;
}

function password(value) {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 1024)
    throw new AccountError(400, 'Password must be at least 12 characters and at most 1024 bytes.');
  return value;
}

function email(value) {
  if (typeof value !== 'string' || value.length > 254 ||
      !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/.test(value))
    throw new AccountError(400, 'Enter a valid email address for password recovery.');
  return value;
}

async function passwordHash(value) {
  const salt = randomBytes(16);
  const derived = await scrypt(value, salt, 32, {N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024});
  return `scrypt$131072$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

async function verifyPassword(value, stored) {
  const [algorithm, n, r, p, salt, digest] = stored.split('$');
  if (algorithm !== 'scrypt' || n !== '131072' || r !== '8' || p !== '1' || !salt || !digest)
    throw new Error('Unsupported password hash.');
  const expected = Buffer.from(digest, 'base64url');
  if (expected.length !== 32) throw new Error('Invalid password hash.');
  const actual = await scrypt(value, Buffer.from(salt, 'base64url'), 32,
    {N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024});
  return timingSafeEqual(expected, actual);
}

export class Accounts {
  constructor(container, {origin, sendMail, now = () => Date.now()} = {}) {
    this.container = container;
    this.origin = origin;
    this.sendMail = sendMail;
    this.now = now;
  }

  async read(id) {
    try { return (await this.container.item(id, PARTITION).read()).resource; }
    catch (error) { if (error.code === 404) return null; throw error; }
  }

  async replace(doc) {
    return this.container.item(doc.id, PARTITION).replace(doc, {
      accessCondition: {type: 'IfMatch', condition: doc._etag}
    });
  }

  async limit(scope, key, limit, windowMs) {
    const now = this.now(), id = `limit:${hash(`${scope}:${key}`)}`;
    for (let i = 0; i < 12; i++) {
      let doc = await this.read(id);
      if (!doc) {
        try {
          await this.container.items.create({id, partition: PARTITION, count: 1, until: now + windowMs,
            ttl: Math.ceil(windowMs / 1000) + 60});
          return;
        } catch (error) { if (error.code === 409) continue; throw error; }
      }
      if (doc.until <= now) Object.assign(doc, {count: 0, until: now + windowMs});
      if (doc.count >= limit) throw new AccountError(429, 'Too many attempts. Please try again later.');
      doc.count++;
      try { await this.replace(doc); return; }
      catch (error) { if (error.code === 412) continue; throw error; }
    }
    throw new Error('Unable to update account rate limit.');
  }

  async createSession(account) {
    const secret = token();
    await this.container.items.create({id: `session:${hash(secret)}`, partition: PARTITION,
      account: account.id, version: account.version, expires: this.now() + SESSION_SECONDS * 1000, ttl: SESSION_SECONDS});
    return cookie(secret, SESSION_SECONDS);
  }

  async authenticate(request) {
    const raw = request.headers.get('cookie') || '';
    const secret = raw.split(';').map(part => part.trim()).find(part => part.startsWith('fiveforms_session='))?.slice(18);
    if (!secret || !/^[a-zA-Z0-9_-]{43}$/.test(secret)) return null;
    const session = await this.read(`session:${hash(secret)}`);
    if (!session || session.expires <= this.now()) return null;
    const account = await this.read(session.account);
    if (!account || account.version !== session.version) return null;
    return account;
  }

  async leaderboard() {
    const {resources} = await this.container.items.query({
      query: 'SELECT TOP 100 c.username, c.victories FROM c WHERE c.partition = @partition AND c.kind = @kind ORDER BY c.victories DESC',
      parameters: [{name: '@partition', value: PARTITION}, {name: '@kind', value: 'account'}]
    }, {partitionKey: PARTITION}).fetchAll();
    return resources;
  }

  async handle(request, action) {
    try {
      if (request.method !== 'POST') throw new AccountError(405, 'Use POST.');
      const requestOrigin = request.headers.get('origin');
      if ((requestOrigin && requestOrigin !== this.origin) || request.headers.get('sec-fetch-site') === 'cross-site')
        throw new AccountError(403, 'Use the game on this site.');
      if (!request.headers.get('content-type')?.startsWith('application/json'))
        throw new AccountError(415, 'JSON required.');
      const raw = await request.text();
      if (Buffer.byteLength(raw, 'utf8') > 4096) throw new AccountError(413, 'Input is too large.');
      let data;
      try { data = JSON.parse(raw); } catch { throw new AccountError(400, 'Invalid input.'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AccountError(400, 'Invalid input.');
      if (action === 'me') {
        const account = await this.authenticate(request);
        return response({username: account?.username ?? null});
      }
      if (action === 'leaderboard') return response({players: await this.leaderboard()});
      if (action === 'logout') {
        const rawCookie = request.headers.get('cookie') || '';
        const secret = rawCookie.split(';').map(part => part.trim()).find(part => part.startsWith('fiveforms_session='))?.slice(18);
        if (secret && /^[a-zA-Z0-9_-]{43}$/.test(secret)) {
          try { await this.container.item(`session:${hash(secret)}`, PARTITION).delete(); }
          catch (error) { if (error.code !== 404) throw error; }
        }
        return response({ok: true}, 200, {'set-cookie': cookie('', 0)});
      }
      if (!['register', 'login', 'forgot', 'reset'].includes(action)) throw new AccountError(404, 'Unknown account action.');
      await this.limit('global', 'auth', 120, 60000);
      const name = username(data.username);
      const id = accountId(name);
      await this.limit(action, id, action === 'login' ? 10 : 5, 15 * 60 * 1000);
      if (action === 'register') {
        const pass = password(data.password), address = email(data.email);
        const doc = {id, partition: PARTITION, kind: 'account', username: name, email: address,
          passwordHash: await passwordHash(pass), version: 1, victories: 0};
        try { await this.container.items.create(doc); }
        catch (error) {
          if (error.code === 409) throw new AccountError(409, 'That username is already taken.');
          throw error;
        }
        return response({username: name}, 201, {'set-cookie': await this.createSession(doc)});
      }
      const account = await this.read(id);
      if (action === 'login') {
        const pass = password(data.password);
        // Verify even for unknown accounts to avoid an obvious timing difference.
        const dummy = 'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        const valid = await verifyPassword(pass, account?.passwordHash || dummy);
        if (!account || !valid) throw new AccountError(401, 'Invalid username or password.');
        return response({username: account.username}, 200, {'set-cookie': await this.createSession(account)});
      }
      if (action === 'forgot') {
        if (!this.sendMail) throw new AccountError(503, 'Password recovery is not configured. Contact the game administrator.');
        if (account) {
          const secret = token();
          account.reset = {hash: hash(secret), expires: this.now() + RESET_MS};
          await this.replace(account);
          const link = `${this.origin}/?mode=online#reset=${encodeURIComponent(secret)}&username=${encodeURIComponent(account.username)}`;
          try { await this.sendMail(account.email, link); }
          catch (error) { console.error('Password recovery email delivery failed:', error.message); }
        }
        return response({message: 'If the account exists, we will attempt to send a recovery email. Check spam or contact the game administrator if it does not arrive.'});
      }
      const pass = password(data.password);
      if (!account || typeof data.token !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(data.token) ||
          !account.reset || account.reset.expires <= this.now() || account.reset.hash !== hash(data.token))
        throw new AccountError(400, 'Recovery link is invalid or expired.');
      account.passwordHash = await passwordHash(pass);
      account.version++; delete account.reset;
      try { await this.replace(account); }
      catch (error) {
        if (error.code === 412) throw new AccountError(400, 'Recovery link is invalid or expired.');
        throw error;
      }
      return response({message: 'Password changed. Sign in with your new password.'});
    } catch (error) {
      if (!error.status) console.error('Account service error:', error.message);
      return response({error: error.status ? error.message : 'Account service is temporarily unavailable.'}, error.status || 503);
    }
  }
}

export function smtpSender(env) {
  const {SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM} = env;
  if (![SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM].every(Boolean)) return null;
  const port = Number(SMTP_PORT);
  if (![465, 587].includes(port)) throw new Error('SMTP_PORT must be 465 or 587.');
  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465, requireTLS: true,
    auth: {user: SMTP_USER, pass: SMTP_PASSWORD}, disableFileAccess: true, disableUrlAccess: true
  });
  return (to, link) => transport.sendMail({
    from: SMTP_FROM, to, subject: 'Reset your Five Forms password',
    text: `Use this link within 30 minutes to reset your password:\n\n${link}\n\nIf you did not request this, ignore this message.`
  });
}
