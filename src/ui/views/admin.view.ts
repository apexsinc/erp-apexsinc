export function renderAdminView(): string {
  return `<div id="view-admin" class="tab-view" style="display: none;"></div>`;
}

const MODULE_LABELS = {
  dashboard: 'Dashboard',
  directory: 'Business Directory',
  inventory: 'Inventory & Stock',
  purchasing: 'Purchasing (P2P)',
  inbound: 'Inbound Deliveries',
  sales: 'Sales & Invoicing',
  outbound: 'Outbound Deliveries',
  accounting: 'Vouchers',
  payroll: 'Payroll & Compensation',
  staff: 'Staff & Human Resources',
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
    state.adminCrudMatrix = permsJson.crudMatrix || {};

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
          <span class="badge \${u.role === 'ADMIN' ? 'badge-primary' : u.role === 'MANAGER' ? 'badge-warning' : 'badge-secondary'}">
            \${u.role}
          </span>
        </td>
        <td><span class="badge \${u.isActive ? 'badge-success' : 'badge-danger'}"><span class="badge-dot"></span>\${u.isActive ? 'Active' : 'Deactivated'}</span></td>
        <td>
          <div style="display: inline-flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" onclick="openAdminEditUserModal('\${u.id}')" title="Edit Role & Reset Password">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Edit / Password
            </button>
            \${u.isActive
              ? \`<button class="btn btn-danger btn-sm" onclick="toggleUserActive('\${u.id}', false)" \${u.id === state.user.id ? 'disabled title=\"You cannot deactivate yourself\"' : ''}>Deactivate</button>\`
              : \`<button class="btn btn-secondary btn-sm" onclick="toggleUserActive('\${u.id}', true)">Reactivate</button>\`
            }
          </div>
        </td>
      </tr>
    \`;
  });

  const crud = state.adminCrudMatrix || {};
  const mgrCrudMap = crud.MANAGER || {};
  const staffCrudMap = crud.STAFF || {};

  let matrixRows = '';
  state.adminModules.forEach((mod) => {
    const mgr = mgrCrudMap[mod] || { create: false, read: false, update: false, delete: false };
    const staff = staffCrudMap[mod] || { create: false, read: false, update: false, delete: false };

    matrixRows += \`
      <tr>
        <td>
          <div style="font-weight: 700; color: #1e293b;">\${MODULE_LABELS[mod] || mod}</div>
          <div style="font-size: 0.72rem; color: #64748b; font-family: monospace;">/\${mod}</div>
        </td>
        <td style="text-align: center; background: #f8fafc;">
          <span class="badge badge-success" style="font-size: 0.7rem; letter-spacing: 0.04em;" title="Administrators always possess full CRUD access">
            C • R • U • D (Full)
          </span>
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; gap: 0.75rem; align-items: center; justify-content: center;">
            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; cursor: pointer;" title="Create">
              <input type="checkbox" id="perm-MANAGER-\${mod}-create" \${mgr.create ? 'checked' : ''} /> <strong>C</strong>
            </label>
            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; cursor: pointer;" title="Read / View">
              <input type="checkbox" id="perm-MANAGER-\${mod}-read" \${mgr.read ? 'checked' : ''} /> <strong>R</strong>
            </label>
            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; cursor: pointer;" title="Update / Edit">
              <input type="checkbox" id="perm-MANAGER-\${mod}-update" \${mgr.update ? 'checked' : ''} /> <strong>U</strong>
            </label>
            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; cursor: pointer;" title="Delete / Void">
              <input type="checkbox" id="perm-MANAGER-\${mod}-delete" \${mgr.delete ? 'checked' : ''} /> <strong>D</strong>
            </label>
          </div>
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; gap: 0.75rem; align-items: center; justify-content: center;">
            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; cursor: pointer;" title="Create">
              <input type="checkbox" id="perm-STAFF-\${mod}-create" \${staff.create ? 'checked' : ''} /> <strong>C</strong>
            </label>
            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; cursor: pointer;" title="Read / View">
              <input type="checkbox" id="perm-STAFF-\${mod}-read" \${staff.read ? 'checked' : ''} /> <strong>R</strong>
            </label>
            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; cursor: pointer;" title="Update / Edit">
              <input type="checkbox" id="perm-STAFF-\${mod}-update" \${staff.update ? 'checked' : ''} /> <strong>U</strong>
            </label>
            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; cursor: pointer;" title="Delete / Void">
              <input type="checkbox" id="perm-STAFF-\${mod}-delete" \${staff.delete ? 'checked' : ''} /> <strong>D</strong>
            </label>
          </div>
        </td>
      </tr>
    \`;
  });

  container.innerHTML = \`
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">User Accounts</div>
      </div>
      <p style="padding: 0 0 1rem; font-size: 0.85rem; color: #64748b;">
        New logins are created from Payroll &amp; Staff when adding an employee. This page manages roles, credentials, and access for existing accounts.
      </p>
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
        <div>
          <div class="panel-title">Role Permissions — Granular CRUD Matrix</div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.2rem;">
            Control exact permissions for each role: <strong>C</strong> (Create), <strong>R</strong> (Read/View), <strong>U</strong> (Update/Edit), <strong>D</strong> (Delete/Void).
          </div>
        </div>
        <div class="panel-actions">
          <button class="btn btn-primary btn-sm" onclick="savePermissionMatrix()">Save Permissions</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="min-width: 180px;">Module</th>
              <th style="text-align: center; min-width: 140px;">ADMIN</th>
              <th style="text-align: center; min-width: 220px;">
                MANAGER<br />
                <span style="font-weight: normal; font-size: 0.72rem; color: #64748b;">(C • R • U • D)</span>
              </th>
              <th style="text-align: center; min-width: 220px;">
                STAFF<br />
                <span style="font-weight: normal; font-size: 0.72rem; color: #64748b;">(C • R • U • D)</span>
              </th>
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

async function savePermissionMatrix() {
  const roles = ['MANAGER', 'STAFF'];

  try {
    for (const role of roles) {
      const permissions = {};
      state.adminModules.forEach((mod) => {
        const createCb = document.getElementById('perm-' + role + '-' + mod + '-create');
        const readCb = document.getElementById('perm-' + role + '-' + mod + '-read');
        const updateCb = document.getElementById('perm-' + role + '-' + mod + '-update');
        const deleteCb = document.getElementById('perm-' + role + '-' + mod + '-delete');

        permissions[mod] = {
          create: createCb ? createCb.checked : false,
          read: readCb ? readCb.checked : false,
          update: updateCb ? updateCb.checked : false,
          delete: deleteCb ? deleteCb.checked : false,
        };
      });

      const res = await apiFetch('/api/admin/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save permissions for ' + role);
    }

    showToast('Role CRUD permissions saved successfully', 'success');

    // Refresh the client permission matrix and sidebar visibility immediately
    const refreshed = await (await apiFetch('/api/admin/role-permissions')).json();
    if (refreshed.success) {
      window.__ROLE_PERMISSIONS__ = {
        ADMIN: refreshed.matrix.ADMIN,
        MANAGER: refreshed.matrix.MANAGER,
        STAFF: refreshed.matrix.STAFF,
      };
      window.__ROLE_PERMISSIONS_CRUD__ = refreshed.crudMatrix || {};
      state.adminCrudMatrix = refreshed.crudMatrix || {};
      applyRolePermissions();
    }
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

function toggleUserActive(userId, makeActive) {
  if (!makeActive) {
    openConfirmModal({
      title: 'Deactivate User Account',
      message: 'Are you sure you want to deactivate this user account?',
      subtext: 'The user will be immediately signed out and blocked from accessing the system.',
      confirmText: 'Deactivate User',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        const res = await apiFetch('/api/admin/users/' + userId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update user');

        showToast('User account deactivated', 'warning');
        loadAdmin();
      },
    });
    return;
  }

  (async () => {
    try {
      const res = await apiFetch('/api/admin/users/' + userId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update user');

      showToast('User account reactivated', 'success');
      loadAdmin();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  })();
}

function openAdminEditUserModal(userId) {
  const u = (state.adminUsers || []).find((x) => x.id === userId);
  if (!u) {
    showToast('User not found', 'warning');
    return;
  }

  const isSelf = u.id === state.user?.id;

  const body =
    '<form id="form-admin-edit-user" onsubmit="submitAdminEditUser(event, \\\'' + u.id + '\\\')">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="admin-user-name">Full Name *</label>' +
    '<input type="text" id="admin-user-name" class="form-input" value="' + u.name + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="admin-user-email">Email / Username</label>' +
    '<input type="email" id="admin-user-email" class="form-input" value="' + u.email + '" disabled style="background: #f1f5f9; cursor: not-allowed;" />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="admin-user-role">System Role *</label>' +
    '<select id="admin-user-role" class="form-select"' + (isSelf ? ' disabled title="You cannot change your own role"' : '') + '>' +
    '<option value="ADMIN"' + (u.role === 'ADMIN' ? ' selected' : '') + '>ADMIN (Full System Administrator)</option>' +
    '<option value="MANAGER"' + (u.role === 'MANAGER' ? ' selected' : '') + '>MANAGER (Approval & Operations)</option>' +
    '<option value="STAFF"' + (u.role === 'STAFF' ? ' selected' : '') + '>STAFF (Assigned modules only)</option>' +
    '</select>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="admin-user-active">Account Status *</label>' +
    '<select id="admin-user-active" class="form-select"' + (isSelf ? ' disabled title="You cannot deactivate your own account"' : '') + '>' +
    '<option value="true"' + (u.isActive ? ' selected' : '') + '>Active (Can log in)</option>' +
    '<option value="false"' + (!u.isActive ? ' selected' : '') + '>Deactivated (Locked out)</option>' +
    '</select>' +
    '</div>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0.25rem;">' +
    '<label class="form-label" for="admin-user-pwd">Reset Password</label>' +
    '<div style="position: relative;">' +
    '<input type="password" id="admin-user-pwd" class="form-input" placeholder="Leave empty to keep existing password" minlength="8" style="padding-right: 2.5rem;" />' +
    '<button type="button" class="btn btn-secondary btn-sm" style="position: absolute; right: 4px; top: 4px; bottom: 4px; padding: 0 0.5rem; display: flex; align-items: center;" onclick="togglePasswordVisibility(\\\'admin-user-pwd\\\', this)">' +
    EYE_ICON_SVG +
    '</button>' +
    '</div>' +
    '<div style="font-size: 0.72rem; color: #64748b; margin-top: 0.35rem;">Enter a new password (min. 8 characters) to reset credentials for this account.</div>' +
    '</div>' +
    '</form>';

  const footer =
    '<div style="display: flex; gap: 0.5rem; justify-content: flex-end; width: 100%;">' +
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="submit" form="form-admin-edit-user" class="btn btn-primary">Save User Changes</button>' +
    '</div>';

  openModal('Edit User Account — ' + u.name, body, footer, 'md');
}

async function submitAdminEditUser(e, userId) {
  e.preventDefault();
  const name = document.getElementById('admin-user-name').value.trim();
  const roleEl = document.getElementById('admin-user-role');
  const activeEl = document.getElementById('admin-user-active');
  const pwd = document.getElementById('admin-user-pwd')?.value || undefined;

  const payload = {
    name,
    ...(roleEl && !roleEl.disabled ? { role: roleEl.value } : {}),
    ...(activeEl && !activeEl.disabled ? { isActive: activeEl.value === 'true' } : {}),
    ...(pwd && pwd.trim().length >= 8 ? { password: pwd.trim() } : {}),
  };

  try {
    const res = await apiFetch('/api/admin/users/' + userId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update user');

    closeModal();
    showToast('User account updated successfully', 'success');
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
