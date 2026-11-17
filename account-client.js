const $ = id => document.getElementById(id);

export class AccountClient {
  constructor(onChange) {
    this.onChange = onChange;
    this.username = null;
    $('accountButton').onclick = () => this.show('login');
    $('closeAccount').onclick = () => $('accountDialog').close();
    $('signOut').onclick = () => this.signOut();
    $('refreshScores').onclick = () => this.scores();
  }

  async request(action, body = {}) {
    const response = await fetch('/api/account/' + action, {
      method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Account service is unavailable.');
    return data;
  }

  render() {
    $('accountStatus').textContent = this.username ? `Signed in as ${this.username}` : 'Not signed in';
    $('accountButton').hidden = !!this.username;
    $('signOut').hidden = !this.username;
    this.onChange();
  }

  async refresh() {
    try { this.username = (await this.request('me')).username; this.render(); }
    catch (error) { $('accountStatus').textContent = error.message; }
  }

  async signOut() {
    try {
      await this.request('logout');
      this.username = null;
      this.render();
    } catch (error) { $('accountStatus').textContent = error.message; }
  }

  async scores() {
    try {
      const {players} = await this.request('leaderboard');
      $('scoreList').replaceChildren(...players.map(player => {
        const row = document.createElement('li');
        row.textContent = `${player.username} — ${player.victories} ${player.victories === 1 ? 'victory' : 'victories'}`;
        return row;
      }));
      $('scoreMessage').textContent = players.length ? '' : 'No players yet.';
    } catch (error) { $('scoreMessage').textContent = error.message; }
  }

  show(view = 'login', reset = null) {
    const title = {login: 'Sign in', register: 'Create account', forgot: 'Recover password', reset: 'Choose a new password'}[view];
    const usernameField = view !== 'reset' ? '<label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+"></label>' : '';
    const emailField = view === 'register' ? '<label>Recovery email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><p>Your email is only used for password recovery. Enter it carefully.</p>' : '';
    const passwordField = ['login', 'register', 'reset'].includes(view) ? `<label>Password<input name="password" type="password" autocomplete="${view === 'login' ? 'current-password' : 'new-password'}" required minlength="12" maxlength="1024"></label>` : '';
    $('accountContent').innerHTML = `<span class="modal-eyebrow">FIVE FORMS ACCOUNT</span><h2>${title}</h2><form id="accountForm">${usernameField}${emailField}${passwordField}<p id="accountMessage" role="status"></p><button class="primary-button" type="submit">${title.toUpperCase()}</button></form><div class="account-links">${view !== 'login' ? '<button type="button" data-view="login">Sign in</button>' : '<button type="button" data-view="register">Create account</button><button type="button" data-view="forgot">Forgot password?</button>'}</div>`;
    $('accountContent').querySelectorAll('[data-view]').forEach(button => button.onclick = () => this.show(button.dataset.view));
    $('accountForm').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget, submit = form.querySelector('button[type="submit"]');
      const body = Object.fromEntries(new FormData(form));
      if (view === 'reset') Object.assign(body, reset);
      submit.disabled = true;
      try {
        const result = await this.request(view, body);
        if (view === 'login' || view === 'register') {
          this.username = result.username;
          this.render();
          $('accountDialog').close();
          this.scores();
        } else {
          $('accountMessage').textContent = result.message;
          if (view === 'reset') submit.disabled = true;
        }
      } catch (error) { $('accountMessage').textContent = error.message; }
      finally { if (view !== 'reset' || !$('accountMessage').textContent.startsWith('Password changed')) submit.disabled = false; }
    };
    if (!$('accountDialog').open) $('accountDialog').showModal();
  }

  openRecoveryLink() {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const secret = fragment.get('reset'), name = fragment.get('username');
    if (!secret || !name) return;
    history.replaceState(null, '', location.pathname + location.search);
    this.show('reset', {token: secret, username: name});
  }
}
