const EYE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const EYE_OFF_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

/** Password input with a show/hide eye toggle button (see togglePasswordVisibility in app.client.ts). */
export function renderPasswordField(id: string, labelText: string, opts: { placeholder?: string; autocomplete?: string } = {}): string {
  return `
    <div class="form-group">
      <label class="form-label" for="${id}">${labelText}</label>
      <div class="password-input-wrapper">
        <input type="password" id="${id}" class="form-input" placeholder="${opts.placeholder || 'Enter your password'}" required autocomplete="${opts.autocomplete || 'new-password'}" />
        <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('${id}', this)" tabindex="-1" aria-label="Show password">
          ${EYE_ICON}
        </button>
      </div>
    </div>
  `;
}

export function renderLoginView(turnstileSiteKey?: string): string {
  return `
  <div id="login-view" class="login-container" style="display: none;">
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo-box">
          <img src="/assets/logo.png" alt="APEXS Logo" />
        </div>
        <div class="brand-badge">
          <span>Enterprise Platform</span>
        </div>
        <h2 class="login-title">Apexs ERP</h2>
        <p class="login-subtitle">Sign in to your organization account</p>
      </div>

      <form id="login-form" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label class="form-label" for="login-email">Email Address</label>
          <input type="email" id="login-email" class="form-input" placeholder="name@company.com" required autocomplete="email" />
        </div>

        ${renderPasswordField('login-password', 'Password', { placeholder: 'Enter your password', autocomplete: 'current-password' })}

        ${
          turnstileSiteKey
            ? `<div class="form-group">
                 <div class="cf-turnstile" data-sitekey="${turnstileSiteKey}" data-theme="light" data-error-callback="onTurnstileError"></div>
               </div>`
            : ''
        }

        <button type="submit" id="login-btn" class="btn btn-primary btn-block">
          Sign In
        </button>
      </form>
    </div>
  </div>
  ${turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
  `;
}

export const LOGIN_CLIENT_JS = `
function onTurnstileError(code) {
  console.warn('[Cloudflare Turnstile] Challenge notice (handled):', code);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('login-btn');
  const cfTurnstileToken = typeof turnstile !== 'undefined' ? turnstile.getResponse() : undefined;

  submitBtn.disabled = true;
  submitBtn.innerText = 'Signing In...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, cfTurnstileToken }),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      showToast(json.error || 'Authentication failed', 'danger');
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In';
      if (typeof turnstile !== 'undefined') turnstile.reset();
      return;
    }

    localStorage.setItem('apexs_token', json.token);
    localStorage.setItem('apexs_user', JSON.stringify(json.user));
    state.user = json.user;

    showToast('Signed in successfully', 'success');
    showApp();
  } catch (err) {
    showToast('Network error: ' + err.message, 'danger');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Sign In';
  }
}

function handleLogout() {
  openConfirmModal({
    title: 'Sign Out',
    message: 'Are you sure you want to end your current session and sign out of Apexs ERP?',
    confirmText: 'Sign Out',
    cancelText: 'Stay Signed In',
    type: 'warning',
    onConfirm: async () => {
      const token = localStorage.getItem('apexs_token');
      localStorage.removeItem('apexs_token');
      localStorage.removeItem('apexs_user');
      state.user = null;
      resetAllViewLoads();
      showLogin();
      showToast('Signed out successfully', 'info');

      if (token) {
        try {
          await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
        } catch (_) {
          // Local session is already cleared client-side
        }
      }
    },
  });
}

function checkAuth() {
  const savedUser = localStorage.getItem('apexs_user');
  const savedToken = localStorage.getItem('apexs_token');
  if (savedUser && savedToken) {
    try {
      state.user = JSON.parse(savedUser);
      showApp();
      return;
    } catch (_) {}
  }
  showLogin();
}

function showLogin() {
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');
  const submitBtn = document.getElementById('login-btn');

  if (loginView) loginView.style.display = 'flex';
  if (appView) appView.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Sign In';
  }
}

function showApp() {
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');

  if (loginView) loginView.style.display = 'none';
  if (appView) appView.style.display = 'flex';

  if (state.user) {
    const nameEl = document.getElementById('admin-display-name');
    const roleEl = document.getElementById('admin-display-role');
    if (nameEl) nameEl.innerText = state.user.name;
    if (roleEl) roleEl.innerText = state.user.role;
  }

  const allowedTabs = applyRolePermissions();
  const urlTab = typeof getTabFromUrl === 'function' ? getTabFromUrl() : 'dashboard';
  const initialTab = allowedTabs.includes(urlTab) ? urlTab : (allowedTabs.includes(state.activeTab) ? state.activeTab : allowedTabs[0]);
  switchTab(initialTab || 'dashboard', true);
}

// Hides sidebar nav items the current user's role isn't permitted to view,
// per the role -> module map computed server-side (src/lib/permissions.ts)
// and injected as window.__ROLE_PERMISSIONS__. Returns the allowed tab list.
//
// 'admin' (Roles & Permissions) is intentionally NOT part of that editable
// matrix — it's hardcoded to ADMIN only here so the permission-matrix UI
// itself can never be used to grant access to the permission-matrix UI.
function applyRolePermissions() {
  const permissions = window.__ROLE_PERMISSIONS__ || {};
  const role = state.user && state.user.role;
  const allowedTabs = ((role && permissions[role]) || []).slice();
  if (role === 'ADMIN') {
    allowedTabs.push('admin');
    allowedTabs.push('settings');
  }

  document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
    const tab = item.dataset.tab;
    item.style.display = allowedTabs.includes(tab) ? '' : 'none';
  });

  return allowedTabs;
}
`;
