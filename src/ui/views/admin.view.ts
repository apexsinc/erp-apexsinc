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
let adminActiveRoleTab = 'MANAGER';

async function loadAdmin() {
  const container = document.getElementById('view-admin');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading users, roles & permissions...</div>';

  try {
    const [usersRes, rolesRes, permsRes] = await Promise.all([
      apiFetch('/api/admin/users'),
      apiFetch('/api/admin/roles'),
      apiFetch('/api/admin/role-permissions'),
    ]);
    const usersJson = await usersRes.json();
    const rolesJson = await rolesRes.json();
    const permsJson = await permsRes.json();

    if (!usersRes.ok || !usersJson.success) throw new Error(usersJson.error || 'Failed to load users');
    if (!rolesRes.ok || !rolesJson.success) throw new Error(rolesJson.error || 'Failed to load roles');
    if (!permsRes.ok || !permsJson.success) throw new Error(permsJson.error || 'Failed to load permissions');

    state.adminUsers = usersJson.data || [];
    state.roles = rolesJson.roles || [];
    window.__ROLES__ = state.roles;
    state.adminModules = permsJson.modules || [];
    state.adminMatrix = permsJson.matrix || {};
    state.adminCrudMatrix = permsJson.crudMatrix || {};

    if (!adminActiveRoleTab || !state.roles.some((r) => r.code === adminActiveRoleTab)) {
      adminActiveRoleTab = state.roles.find((r) => r.code !== 'ADMIN')?.code || 'MANAGER';
    }

    renderAdminPanel(container);
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading administration: \${err.message}</div>\`;
  }
}

function getRoleBadgeClass(roleCode) {
  if (roleCode === 'ADMIN') return 'badge-primary';
  if (roleCode === 'MANAGER') return 'badge-warning';
  if (roleCode === 'STAFF') return 'badge-secondary';
  return 'badge-success';
}

function renderAdminPanel(container) {
  // 1. User Accounts Rows
  let userRows = '';
  state.adminUsers.forEach((u) => {
    const roleItem = (state.roles || []).find((r) => r.code === u.role);
    const roleName = roleItem?.name || u.role;

    userRows += \`
      <tr>
        <td><strong>\${u.name}</strong></td>
        <td>\${u.email}</td>
        <td>
          <span class="badge \${getRoleBadgeClass(u.role)}" title="\${roleName}">
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

  // 2. Roles & Groups Table Rows
  let roleRows = '';
  (state.roles || []).forEach((r) => {
    const isSys = Boolean(r.isSystem || ['ADMIN', 'MANAGER', 'STAFF'].includes(r.code));
    roleRows += \`
      <tr>
        <td>
          <div style="font-weight: 700; color: #1e293b;">\${r.name}</div>
          <div style="font-size: 0.72rem; font-family: monospace; color: #64748b;">\${r.code}</div>
        </td>
        <td>
          <span class="badge \${isSys ? 'badge-primary' : 'badge-neutral'}">
            \${isSys ? 'System Default' : 'Custom Group'}
          </span>
        </td>
        <td style="font-size: 0.83rem; color: #475569; max-width: 320px;">
          \${r.description || '<span style=\"color: #94a3b8;\">—</span>'}
        </td>
        <td>
          <span class="badge \${r.userCount > 0 ? 'badge-success' : 'badge-neutral'}">
            \${r.userCount || 0} user\${r.userCount === 1 ? '' : 's'}
          </span>
        </td>
        <td>
          <div style="display: inline-flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" onclick="openEditRoleModal('\${r.id}')" title="Edit Name & Description">
              Edit Details
            </button>
            \${!isSys
              ? \`<button class="btn btn-danger btn-sm" onclick="deleteCustomRole('\${r.id}', '\${r.name.replace(/'/g, "\\\\'")}', \${r.userCount || 0})" title="Delete Custom Role">Delete</button>\`
              : '<span style=\"font-size: 0.72rem; color: #94a3b8; align-self: center; padding: 0 0.4rem;\">Protected</span>'
            }
          </div>
        </td>
      </tr>
    \`;
  });

  // 3. Role Tabs for CRUD Matrix
  const rolePillsHtml = (state.roles || []).map((r) => {
    const active = adminActiveRoleTab === r.code;
    return \`
      <button type="button" onclick="switchAdminRoleTab('\${r.code}')" style="padding: 0.45rem 1rem; border-radius: 999px; font-size: 0.82rem; font-weight: 600; border: 1px solid \${active ? 'var(--primary)' : 'var(--border-color)'}; background: \${active ? 'var(--primary)' : '#ffffff'}; color: \${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        \${r.name} (\${r.code})
      </button>
    \`;
  }).join('');

  // 4. Matrix Rows for Active Role
  const activeRoleObj = (state.roles || []).find((r) => r.code === adminActiveRoleTab) || { code: adminActiveRoleTab, name: adminActiveRoleTab, isSystem: false };
  const isAdminTab = activeRoleObj.code === 'ADMIN';
  const roleCrudMap = (state.adminCrudMatrix || {})[adminActiveRoleTab] || {};

  let matrixRows = '';
  state.adminModules.forEach((mod) => {
    const p = roleCrudMap[mod] || { create: false, read: false, update: false, delete: false };

    if (isAdminTab) {
      matrixRows += \`
        <tr>
          <td>
            <div style="font-weight: 700; color: #1e293b;">\${MODULE_LABELS[mod] || mod}</div>
            <div style="font-size: 0.72rem; color: #64748b; font-family: monospace;">/\${mod}</div>
          </td>
          <td style="text-align: center; background: #f8fafc;" colspan="4">
            <span class="badge badge-success" style="font-size: 0.75rem; letter-spacing: 0.04em;">
              C • R • U • D (Full Access Permanently Enabled)
            </span>
          </td>
        </tr>
      \`;
    } else {
      matrixRows += \`
        <tr>
          <td>
            <div style="font-weight: 700; color: #1e293b;">\${MODULE_LABELS[mod] || mod}</div>
            <div style="font-size: 0.72rem; color: #64748b; font-family: monospace;">/\${mod}</div>
          </td>
          <td style="text-align: center;">
            <input type="checkbox" id="perm-\${adminActiveRoleTab}-\${mod}-create" \${p.create ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
          </td>
          <td style="text-align: center;">
            <input type="checkbox" id="perm-\${adminActiveRoleTab}-\${mod}-read" \${p.read ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
          </td>
          <td style="text-align: center;">
            <input type="checkbox" id="perm-\${adminActiveRoleTab}-\${mod}-update" \${p.update ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
          </td>
          <td style="text-align: center;">
            <input type="checkbox" id="perm-\${adminActiveRoleTab}-\${mod}-delete" \${p.delete ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
          </td>
        </tr>
      \`;
    }
  });

  container.innerHTML = \`
    <!-- 1. USER ACCOUNTS CARD -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <div class="panel-title">User Accounts & Logins</div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.2rem;">
            Manage credentials, active status, and assign roles & permission groups to users.
          </div>
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

    <!-- 2. ROLES & PERMISSION GROUPS CARD -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <div class="panel-title">Roles & Permission Groups</div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.2rem;">
            Define custom roles (e.g., Accountant, Warehouse Lead, Sales Rep) and customize what employees in each group can do.
          </div>
        </div>
        <div class="panel-actions">
          <button class="btn btn-primary btn-sm" onclick="openNewRoleModal()">+ Add Role / Group</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Role Name & Code</th>
              <th>Type</th>
              <th>Description</th>
              <th>Assigned Users</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            \${roleRows || '<tr><td colspan="5" style="text-align: center;">No roles defined.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. GRANULAR CRUD MATRIX CARD -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <div class="panel-title">Role Permissions — Granular CRUD Matrix</div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.2rem;">
            Select a role to configure exact permissions: <strong>C</strong> (Create), <strong>R</strong> (Read/View), <strong>U</strong> (Update/Edit), <strong>D</strong> (Delete/Void).
          </div>
        </div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; align-items: center;">
          \${!isAdminTab ? \`
            <button type="button" class="btn btn-secondary btn-sm" onclick="bulkSetPermissions(true)">Select All</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="bulkSetReadOnly()">Read-Only All</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="bulkSetPermissions(false)">Clear All</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="saveActiveRolePermissions()">Save Permissions</button>
          \` : '<span class="badge badge-success">Full System Access</span>'}
        </div>
      </div>
      
      <!-- Role Tab Pills -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 0 1.35rem 1rem;">
        \${rolePillsHtml}
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="min-width: 220px;">Module</th>
              \${isAdminTab ? '<th style="text-align: center;" colspan="4">Access Authority</th>' : \`
                <th style="text-align: center; width: 100px;">Create (C)</th>
                <th style="text-align: center; width: 100px;">Read (R)</th>
                <th style="text-align: center; width: 100px;">Update (U)</th>
                <th style="text-align: center; width: 100px;">Delete (D)</th>
              \`}
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

function switchAdminRoleTab(roleCode) {
  adminActiveRoleTab = roleCode;
  const container = document.getElementById('view-admin');
  if (container) renderAdminPanel(container);
}

function bulkSetPermissions(checked) {
  state.adminModules.forEach((mod) => {
    ['create', 'read', 'update', 'delete'].forEach((act) => {
      const el = document.getElementById('perm-' + adminActiveRoleTab + '-' + mod + '-' + act);
      if (el) el.checked = checked;
    });
  });
}

function bulkSetReadOnly() {
  state.adminModules.forEach((mod) => {
    const rEl = document.getElementById('perm-' + adminActiveRoleTab + '-' + mod + '-read');
    if (rEl) rEl.checked = true;
    ['create', 'update', 'delete'].forEach((act) => {
      const el = document.getElementById('perm-' + adminActiveRoleTab + '-' + mod + '-' + act);
      if (el) el.checked = false;
    });
  });
}

async function saveActiveRolePermissions() {
  const role = adminActiveRoleTab;
  if (!role || role === 'ADMIN') return;

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

  try {
    const res = await apiFetch('/api/admin/role-permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, permissions }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save permissions');

    showToast('Permissions for ' + role + ' saved successfully', 'success');

    // Update live client matrices
    if (json.crudMatrix) {
      window.__ROLE_PERMISSIONS_CRUD__ = json.crudMatrix;
      state.adminCrudMatrix = json.crudMatrix;
    }
    if (json.matrix) {
      window.__ROLE_PERMISSIONS__ = json.matrix;
      state.adminMatrix = json.matrix;
    }
    applyRolePermissions();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Open New Role Modal
function openNewRoleModal() {
  let moduleCheckboxes = '';
  state.adminModules.forEach((mod) => {
    moduleCheckboxes += \`
      <tr>
        <td style="font-weight: 600; font-size: 0.82rem;">\${MODULE_LABELS[mod] || mod}</td>
        <td style="text-align: center;"><input type="checkbox" id="newrole-mod-\${mod}-c" /></td>
        <td style="text-align: center;"><input type="checkbox" id="newrole-mod-\${mod}-r" checked /></td>
        <td style="text-align: center;"><input type="checkbox" id="newrole-mod-\${mod}-u" /></td>
        <td style="text-align: center;"><input type="checkbox" id="newrole-mod-\${mod}-d" /></td>
      </tr>
    \`;
  });

  const body = \`
    <form id="form-new-role" onsubmit="submitNewRole(event)">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="newrole-code">Role Code (Slug) *</label>
          <input type="text" id="newrole-code" class="form-input" placeholder="e.g. ACCOUNTANT, WAREHOUSE_LEAD" style="text-transform: uppercase; font-family: monospace;" required />
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.25rem;">Uppercase alphanumeric identifier (e.g. AUDITOR, SALES_LEAD)</div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="newrole-name">Display Name *</label>
          <input type="text" id="newrole-name" class="form-input" placeholder="e.g. Finance & Accounting Specialist" required />
        </div>
      </div>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label class="form-label" for="newrole-desc">Description</label>
        <textarea id="newrole-desc" class="form-input" rows="2" placeholder="Brief summary of duties and responsibilities for this group"></textarea>
      </div>
      
      <div style="font-weight: 700; font-size: 0.88rem; color: #1e293b; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Initial Module CRUD Permissions</span>
        <div style="display: flex; gap: 0.35rem;">
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="bulkSetNewRoleModal(true)">All</button>
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="bulkSetNewRoleModal(false)">None</button>
        </div>
      </div>
      <div class="table-responsive" style="max-height: 240px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
        <table class="data-table" style="font-size: 0.8rem;">
          <thead>
            <tr>
              <th>Module</th>
              <th style="text-align: center; width: 60px;">C</th>
              <th style="text-align: center; width: 60px;">R</th>
              <th style="text-align: center; width: 60px;">U</th>
              <th style="text-align: center; width: 60px;">D</th>
            </tr>
          </thead>
          <tbody>
            \${moduleCheckboxes}
          </tbody>
        </table>
      </div>
    </form>
  \`;

  const footer = \`
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end; width: 100%;">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" form="form-new-role" class="btn btn-primary">Create Role & Permissions</button>
    </div>
  \`;

  openModal('Add New Role / Permission Group', body, footer, 'lg');
}

function bulkSetNewRoleModal(checked) {
  state.adminModules.forEach((mod) => {
    ['c', 'r', 'u', 'd'].forEach((act) => {
      const el = document.getElementById('newrole-mod-' + mod + '-' + act);
      if (el) el.checked = checked;
    });
  });
}

async function submitNewRole(e) {
  e.preventDefault();
  const code = document.getElementById('newrole-code').value.trim().toUpperCase();
  const name = document.getElementById('newrole-name').value.trim();
  const description = document.getElementById('newrole-desc')?.value.trim() || undefined;

  const permissions = {};
  state.adminModules.forEach((mod) => {
    permissions[mod] = {
      create: Boolean(document.getElementById('newrole-mod-' + mod + '-c')?.checked),
      read: Boolean(document.getElementById('newrole-mod-' + mod + '-r')?.checked),
      update: Boolean(document.getElementById('newrole-mod-' + mod + '-u')?.checked),
      delete: Boolean(document.getElementById('newrole-mod-' + mod + '-d')?.checked),
    };
  });

  try {
    const res = await apiFetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, description, permissions }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create role');

    closeModal();
    showToast('Role "' + name + '" created successfully', 'success');
    adminActiveRoleTab = code;
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Edit Role Details Modal
function openEditRoleModal(roleId) {
  const r = (state.roles || []).find((x) => x.id === roleId);
  if (!r) {
    showToast('Role not found', 'warning');
    return;
  }

  const body = \`
    <form id="form-edit-role" onsubmit="submitEditRole(event, '\${r.id}')">
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem; margin-bottom: 0.85rem;">
        <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Role Identifier</div>
        <div style="font-family: monospace; font-weight: 700; color: #1e293b; font-size: 0.95rem;">\${r.code}</div>
      </div>
      <div class="form-group" style="margin-bottom: 0.85rem;">
        <label class="form-label" for="editrole-name">Display Name *</label>
        <input type="text" id="editrole-name" class="form-input" value="\${r.name}" required />
      </div>
      <div class="form-group" style="margin-bottom: 0.25rem;">
        <label class="form-label" for="editrole-desc">Description</label>
        <textarea id="editrole-desc" class="form-input" rows="3">\${r.description || ''}</textarea>
      </div>
    </form>
  \`;

  const footer = \`
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end; width: 100%;">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" form="form-edit-role" class="btn btn-primary">Save Role Details</button>
    </div>
  \`;

  openModal('Edit Role Details — ' + r.name, body, footer, 'md');
}

async function submitEditRole(e, roleId) {
  e.preventDefault();
  const name = document.getElementById('editrole-name').value.trim();
  const description = document.getElementById('editrole-desc')?.value.trim();

  try {
    const res = await apiFetch('/api/admin/roles/' + roleId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update role');

    closeModal();
    showToast('Role updated successfully', 'success');
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Delete Custom Role
function deleteCustomRole(roleId, roleName, userCount) {
  if (userCount > 0) {
    showToast('Cannot delete role "' + roleName + '" because ' + userCount + ' user(s) are assigned to it. Please reassign them first.', 'warning');
    return;
  }

  openConfirmModal({
    title: 'Delete Role Group',
    message: 'Are you sure you want to permanently delete the role "' + roleName + '"?',
    subtext: 'This will remove the role and all associated permission rules from the system.',
    confirmText: 'Delete Role',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: async () => {
      const res = await apiFetch('/api/admin/roles/' + roleId, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete role');

      showToast('Role deleted successfully', 'success');
      adminActiveRoleTab = 'MANAGER';
      loadAdmin();
    },
  });
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

  const roleOptionsHtml = (state.roles || []).map((r) => {
    const isSel = r.code === u.role;
    return '<option value="' + r.code + '"' + (isSel ? ' selected' : '') + '>' + r.name + ' (' + r.code + ')</option>';
  }).join('');

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
    '<label class="form-label" for="admin-user-role">Assigned Role / Group *</label>' +
    '<select id="admin-user-role" class="form-select"' + (isSelf ? ' disabled title="You cannot change your own role"' : '') + '>' +
    roleOptionsHtml +
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
