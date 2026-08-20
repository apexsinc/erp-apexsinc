export function renderAdminView(): string {
  return `<div id="view-admin" class="tab-view" style="display: none;"></div>`;
}

const MODULE_LABELS = {
  dashboard: 'Dashboard',
  inventory: 'Inventory & Stock',
  purchasing: 'Purchasing (P2P)',
  sales: 'Sales & Invoicing',
  accounting: 'Accounting & Ledger',
  payroll: 'Payroll & Staff',
};

export const ADMIN_CLIENT_JS = `
const MODULE_LABELS = ${JSON.stringify(MODULE_LABELS)};

async function loadAdmin() {
  const container = document.getElementById('view-admin');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading users & permissions...</div>';

  try {
    const [usersRes, permsRes] = await Promise.all([
      apiFetch('/api/admin/users'),
      apiFetch('/api/admin/role-permissions'),
    ]);
    const usersJson = await usersRes.json();
    const permsJson = await permsRes.json();

    if (!usersRes.ok || !usersJson.success) throw new Error(usersJson.error || 'Failed to load users');
    if (!permsRes.ok || !permsJson.success) throw new Error(permsJson.error || 'Failed to load permissions');

    state.adminUsers = usersJson.data || [];
    state.adminModules = permsJson.modules || [];
    state.adminMatrix = permsJson.matrix || {};

    renderAdminPanel(container);
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading administration: \${err.message}</div>\`;
  }
}

function renderAdminPanel(container) {
  let userRows = '';
  state.adminUsers.forEach((u) => {
    userRows += \`
      <tr>
        <td><strong>\${u.name}</strong></td>
        <td>\${u.email}</td>
        <td>
          <select class="form-input" style="padding: 0.35rem 0.5rem; font-size: 0.8rem;" id="role-select-\${u.id}" \${u.id === state.user.id ? 'disabled title="You cannot change your own role"' : ''}>
            <option value="ADMIN" \${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
            <option value="MANAGER" \${u.role === 'MANAGER' ? 'selected' : ''}>MANAGER</option>
            <option value="STAFF" \${u.role === 'STAFF' ? 'selected' : ''}>STAFF</option>
          </select>
        </td>
        <td><span class="badge \${u.isActive ? 'badge-success' : 'badge-danger'}"><span class="badge-dot"></span>\${u.isActive ? 'Active' : 'Deactivated'}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="applyUserRoleChange('\${u.id}')" \${u.id === state.user.id ? 'disabled' : ''}>Save Role</button>
          \${u.isActive
            ? \`<button class="btn btn-danger btn-sm" onclick="toggleUserActive('\${u.id}', false)" \${u.id === state.user.id ? 'disabled' : ''}>Deactivate</button>\`
            : \`<button class="btn btn-secondary btn-sm" onclick="toggleUserActive('\${u.id}', true)">Reactivate</button>\`
          }
        </td>
      </tr>
    \`;
  });

  let matrixRows = '';
  state.adminModules.forEach((mod) => {
    const managerChecked = (state.adminMatrix.MANAGER || []).includes(mod);
    const staffChecked = (state.adminMatrix.STAFF || []).includes(mod);
    matrixRows += \`
      <tr>
        <td><strong>\${MODULE_LABELS[mod] || mod}</strong></td>
        <td style="text-align: center;"><input type="checkbox" checked disabled title="Administrators always have full access" /></td>
        <td style="text-align: center;"><input type="checkbox" id="perm-MANAGER-\${mod}" \${managerChecked ? 'checked' : ''} /></td>
        <td style="text-align: center;"><input type="checkbox" id="perm-STAFF-\${mod}" \${staffChecked ? 'checked' : ''} /></td>
      </tr>
    \`;
  });

  container.innerHTML = \`
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">User Accounts</div>
        <div class="panel-actions">
          <button class="btn btn-primary btn-sm" onclick="openNewUserModal()">+ New User</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            \${userRows || '<tr><td colspan="5" style="text-align: center;">No users found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Role Permissions — Sidebar & API Module Access</div>
        <div class="panel-actions">
          <button class="btn btn-primary btn-sm" onclick="savePermissionMatrix()">Save Permissions</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Module</th>
              <th style="text-align: center;">ADMIN</th>
              <th style="text-align: center;">MANAGER</th>
              <th style="text-align: center;">STAFF</th>
            </tr>
          </thead>
          <tbody>
            \${matrixRows}
          </tbody>
        </table>
      </div>
    </div>
  \`;
}

function openNewUserModal() {
  const body = \`
    <form id="form-new-user" onsubmit="submitNewUser(event)">
      <div class="form-group">
        <label class="form-label">Full Name *</label>
        <input type="text" id="new-user-name" class="form-input" required />
      </div>
      <div class="form-group">
        <label class="form-label">Email Address *</label>
        <input type="email" id="new-user-email" class="form-input" required />
      </div>
      <div class="form-group">
        <label class="form-label">Temporary Password *</label>
        <div class="password-input-wrapper">
          <input type="password" id="new-user-password" class="form-input" minlength="8" required autocomplete="new-password" />
          <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('new-user-password', this)" tabindex="-1" aria-label="Show password">
            \${EYE_ICON_SVG}
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Confirm Password *</label>
        <div class="password-input-wrapper">
          <input type="password" id="new-user-password-confirm" class="form-input" minlength="8" required autocomplete="new-password" />
          <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('new-user-password-confirm', this)" tabindex="-1" aria-label="Show password">
            \${EYE_ICON_SVG}
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Role *</label>
        <select id="new-user-role" class="form-input" required>
          <option value="STAFF">STAFF</option>
          <option value="MANAGER">MANAGER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-user').requestSubmit()">Create User</button>
  \`;
  openModal('Create User Account', body, footer);
}

async function submitNewUser(e) {
  e.preventDefault();
  const password = document.getElementById('new-user-password').value;
  const passwordConfirm = document.getElementById('new-user-password-confirm').value;

  if (password !== passwordConfirm) {
    showToast('Passwords do not match', 'danger');
    return;
  }

  const payload = {
    name: document.getElementById('new-user-name').value,
    email: document.getElementById('new-user-email').value,
    password,
    role: document.getElementById('new-user-role').value,
  };

  try {
    const res = await apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create user');

    closeModal();
    showToast('User ' + json.data.email + ' created', 'success');
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function applyUserRoleChange(userId) {
  const select = document.getElementById('role-select-' + userId);
  const role = select.value;

  try {
    const res = await apiFetch('/api/admin/users/' + userId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update role');

    showToast('Role updated to ' + role, 'success');
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function toggleUserActive(userId, makeActive) {
  try {
    const res = await apiFetch('/api/admin/users/' + userId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: makeActive }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update user');

    showToast(makeActive ? 'User reactivated' : 'User deactivated', 'success');
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function savePermissionMatrix() {
  const roles = ['MANAGER', 'STAFF'];

  try {
    for (const role of roles) {
      const permissions = {};
      state.adminModules.forEach((mod) => {
        const checkbox = document.getElementById('perm-' + role + '-' + mod);
        permissions[mod] = checkbox ? checkbox.checked : false;
      });

      const res = await apiFetch('/api/admin/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save permissions for ' + role);
    }

    showToast('Permissions saved', 'success');
    // Refresh the sidebar's own permission map so it reflects the new matrix immediately.
    const refreshed = await (await apiFetch('/api/admin/role-permissions')).json();
    if (refreshed.success) {
      window.__ROLE_PERMISSIONS__ = { ADMIN: refreshed.matrix.ADMIN, MANAGER: refreshed.matrix.MANAGER, STAFF: refreshed.matrix.STAFF };
      applyRolePermissions();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
