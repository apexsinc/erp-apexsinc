export function renderLoginView(): string {
  return `
  <div id="login-view" class="login-container" style="display: none;">
    <div class="login-card">
      <div class="login-header">
        <div class="login-icon-box">A</div>
        <div class="brand-badge">
          <span>Enterprise Platform</span>
        </div>
        <h2 class="login-title">Apexs ERP</h2>
        <p class="login-subtitle">Sign in to your organization account</p>
      </div>

      <form id="login-form" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label class="form-label" for="login-email">Email Address</label>
          <input type="email" id="login-email" class="form-input" value="admin@apexsinc.com" placeholder="name@company.com" required autocomplete="email" />
        </div>

        <div class="form-group">
          <label class="form-label" for="login-password">Password</label>
          <input type="password" id="login-password" class="form-input" value="kbs812sls729@admin" placeholder="••••••••••••" required autocomplete="current-password" />
        </div>

        <button type="submit" id="login-btn" class="btn btn-primary btn-block">
          Sign In
        </button>
      </form>
    </div>
  </div>
  `;
}

export const LOGIN_CLIENT_JS = `
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('login-btn');

  submitBtn.disabled = true;
  submitBtn.innerText = 'Signing In...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      showToast(json.error || 'Authentication failed', 'danger');
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In';
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

async function handleLogout() {
  const token = localStorage.getItem('apexs_token');
  localStorage.removeItem('apexs_token');
  localStorage.removeItem('apexs_user');
  state.user = null;
  showLogin();
  showToast('Signed out', 'info');

  if (token) {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    } catch (_) {
      // Local session is already cleared client-side; best-effort server revoke.
    }
  }
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
  const initialTab = allowedTabs.includes(state.activeTab) ? state.activeTab : allowedTabs[0];
  switchTab(initialTab || 'dashboard');
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
  const allowedTabs = (permissions[role] || []).slice();
  if (role === 'ADMIN') allowedTabs.push('admin');

  document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
    const tab = item.dataset.tab;
    item.style.display = allowedTabs.includes(tab) ? '' : 'none';
  });

  return allowedTabs;
}
`;
