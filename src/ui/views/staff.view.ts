export function renderStaffView(): string {
  return `<div id="view-staff" class="tab-view" style="display: none;"></div>`;
}

export const STAFF_CLIENT_JS = `
let staffSearchQuery = '';
let staffStatusFilter = 'ALL';

async function loadStaff() {
  const container = document.getElementById('view-staff');
  if (!container) return;
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading staff directory...</div>';

  try {
    const res = await apiFetch('/api/payroll/employees');
    const json = await res.json();
    state.employees = json.data || [];
    renderStaffContent(container);
  } catch (err) {
    container.innerHTML = '<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading staff directory: ' + err.message + '</div>';
  }
}

function handleStaffSearch(query) {
  staffSearchQuery = (query || '').toLowerCase().trim();
  const container = document.getElementById('view-staff');
  if (container) renderStaffContent(container);
}

function handleStaffStatusFilter(status) {
  staffStatusFilter = status;
  const container = document.getElementById('view-staff');
  if (container) renderStaffContent(container);
}

function renderStaffContent(container) {
  const allEmployees = state.employees || [];

  const filtered = allEmployees.filter((emp) => {
    // Status filter
    if (staffStatusFilter !== 'ALL' && emp.status !== staffStatusFilter) {
      return false;
    }
    // Search query
    if (!staffSearchQuery) return true;
    const code = (emp.employeeCode || '').toLowerCase();
    const name = ((emp.firstName || '') + ' ' + (emp.lastName || '')).toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    const pos = (emp.position || '').toLowerCase();
    return code.includes(staffSearchQuery) || name.includes(staffSearchQuery) || email.includes(staffSearchQuery) || dept.includes(staffSearchQuery) || pos.includes(staffSearchQuery);
  });

  let empRows = '';
  filtered.forEach((emp) => {
    const salary = emp.salaryStructures?.[0];
    const statusClass = emp.status === 'ACTIVE' ? 'badge-success' : emp.status === 'ON_LEAVE' ? 'badge-warning' : 'badge-danger';
    const hasUser = !!emp.user;

    empRows +=
      '<tr>' +
      '<td><strong style="font-family: monospace; color: var(--primary);">' + emp.employeeCode + '</strong></td>' +
      '<td>' +
      '<div style="font-weight: 600; color: #1e293b;">' + emp.firstName + ' ' + emp.lastName + '</div>' +
      '<div style="font-size: 0.76rem; color: #64748b;">' + emp.email + (emp.phone ? ' • ' + emp.phone : '') + '</div>' +
      (hasUser ? '<div style="margin-top: 0.2rem;"><span class="badge badge-primary" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">🔐 ' + emp.user.role + ' Account</span></div>' : '') +
      '</td>' +
      '<td>' +
      '<div style="font-weight: 500;">' + (emp.department || '—') + '</div>' +
      '<div style="font-size: 0.76rem; color: #64748b;">' + (emp.position || '—') + '</div>' +
      '</td>' +
      '<td style="font-size: 0.82rem; color: #475569;">' + (emp.hireDate ? emp.hireDate.slice(0, 10) : '—') + '</td>' +
      '<td>' + formatCurrency(salary?.baseSalaryCents) + '</td>' +
      '<td>' + formatCurrency(salary?.allowancesCents) + '</td>' +
      '<td>' + formatCurrency(salary?.deductionsCents) + '</td>' +
      '<td><strong style="color: #0f766e;">' + formatCurrency(salary?.netSalaryCents) + '</strong></td>' +
      '<td><span class="badge ' + statusClass + '"><span class="badge-dot"></span>' + (emp.status || 'ACTIVE') + '</span></td>' +
      '<td style="text-align: right; white-space: nowrap;">' +
      '<div style="display: inline-flex; gap: 0.35rem; justify-content: flex-end;">' +
      '<button type="button" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.5rem;" title="View Profile" onclick="openViewEmployeeModal(\\\'' + emp.id + '\\\')">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' +
      '</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.5rem;" title="Edit Employee Profile" onclick="openEditEmployeeModal(\\\'' + emp.id + '\\\')">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>' +
      '</button>' +
      '<button type="button" class="btn ' + (hasUser ? 'btn-secondary' : 'btn-outline-primary') + ' btn-sm" style="padding: 0.3rem 0.5rem;' + (hasUser ? '' : ' border: 1px dashed #3b82f6;') + '" title="' + (hasUser ? 'Edit Login Account & Reset Password (' + emp.user.role + ')' : '+ Provision Login Account') + '" onclick="openEmployeeAccountModal(\\\'' + emp.id + '\\\')">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' +
      '</button>' +
      '<button type="button" class="btn btn-danger btn-sm" style="padding: 0.3rem 0.5rem;" title="Delete / Deactivate" onclick="handleDeleteEmployee(\\\'' + emp.id + '\\\', \\\'' + emp.employeeCode + '\\\')">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
      '</button>' +
      '</div>' +
      '</td>' +
      '</tr>';
  });

  container.innerHTML =
    '<div class="panel-card">' +
    '<div class="panel-header">' +
    '<div>' +
    '<div class="panel-title">👥 Staff & Human Resources</div>' +
    '<div style="font-size: 0.78rem; font-weight: 400; color: #64748b; margin-top: 0.25rem;">' +
    'Manage corporate personnel, departmental assignments, base compensation packages, and system login credentials.' +
    '</div>' +
    '</div>' +
    '<div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="exportEmployeesCsv()">📥 Export Staff CSV</button>' +
    '<button type="button" class="btn btn-primary btn-sm" onclick="openNewEmployeeModal()">+ Add Employee</button>' +
    '</div>' +
    '</div>' +
    '<div style="padding: 0 1.25rem 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); margin-bottom: 0.5rem;">' +
    '<div style="display: flex; gap: 0.75rem; flex-wrap: wrap; flex: 1; max-width: 600px;">' +
    '<input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem; flex: 1; min-width: 220px;" placeholder="Search employee code, name, department, role..." value="' + (staffSearchQuery || '') + '" oninput="handleStaffSearch(this.value)" />' +
    '<select class="form-select" style="padding: 0.45rem 0.75rem; font-size: 0.82rem; width: auto;" onchange="handleStaffStatusFilter(this.value)">' +
    '<option value="ALL"' + (staffStatusFilter === 'ALL' ? ' selected' : '') + '>All Statuses</option>' +
    '<option value="ACTIVE"' + (staffStatusFilter === 'ACTIVE' ? ' selected' : '') + '>Active Only</option>' +
    '<option value="ON_LEAVE"' + (staffStatusFilter === 'ON_LEAVE' ? ' selected' : '') + '>On Leave</option>' +
    '<option value="TERMINATED"' + (staffStatusFilter === 'TERMINATED' ? ' selected' : '') + '>Terminated</option>' +
    '</select>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b;">' +
    'Showing <strong>' + filtered.length + '</strong> of <strong>' + allEmployees.length + '</strong> staff members' +
    '</div>' +
    '</div>' +
    '<div class="table-responsive">' +
    '<table class="data-table">' +
    '<thead>' +
    '<tr>' +
    '<th>Code</th>' +
    '<th>Employee Name & Contact</th>' +
    '<th>Department / Position</th>' +
    '<th>Hire Date</th>' +
    '<th>Base Salary</th>' +
    '<th>Allowances</th>' +
    '<th>Deductions</th>' +
    '<th>Net Compensation</th>' +
    '<th>Status</th>' +
    '<th style="text-align: right;">Actions</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' +
    (empRows || '<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 2rem;">No staff records found matching your filters.</td></tr>') +
    '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>';
}

function exportEmployeesCsv() {
  const headers = ['Employee Code', 'Full Name', 'Email', 'Phone', 'Department', 'Position', 'Status', 'Hire Date', 'Base Salary (PHP)', 'Allowances (PHP)', 'Deductions (PHP)', 'Net Salary (PHP)', 'Bank Name', 'Account Number'];
  const rows = (state.employees || []).map((emp) => {
    const salary = emp.salaryStructures?.[0];
    return [
      emp.employeeCode,
      emp.firstName + ' ' + emp.lastName,
      emp.email,
      emp.phone || '',
      emp.department,
      emp.position,
      emp.status || 'ACTIVE',
      emp.hireDate ? emp.hireDate.slice(0, 10) : '',
      salary ? (salary.baseSalaryCents / 100).toFixed(2) : '0.00',
      salary ? (salary.allowancesCents / 100).toFixed(2) : '0.00',
      salary ? (salary.deductionsCents / 100).toFixed(2) : '0.00',
      salary ? (salary.netSalaryCents / 100).toFixed(2) : '0.00',
      emp.bankName || '',
      emp.bankAccountNumber || '',
    ];
  });
  exportToCsv('employees_staff_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function updateModalNetSalaryPreview(prefix) {
  const baseEl = document.getElementById(prefix + '-base');
  const allowEl = document.getElementById(prefix + '-allow');
  const deductEl = document.getElementById(prefix + '-deduct');
  const previewEl = document.getElementById(prefix + '-net-preview');
  if (!baseEl || !previewEl) return;

  const base = parseFloat(baseEl.value || '0');
  const allow = parseFloat(allowEl ? allowEl.value || '0' : '0');
  const deduct = parseFloat(deductEl ? deductEl.value || '0' : '0');
  const net = Math.max(0, base + allow - deduct);
  previewEl.textContent = formatCurrency(Math.round(net * 100));
}

function openNewEmployeeModal() {
  const today = new Date().toISOString().slice(0, 10);
  const body =
    '<form id="form-new-emp" onsubmit="submitNewEmployee(event)">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Employee Code *</label>' +
    '<input type="text" id="nemp-code" class="form-input" placeholder="EMP-002" required style="font-weight: 700; font-family: monospace;" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Hire Date *</label>' +
    '<input type="date" id="nemp-hire-date" class="form-input" value="' + today + '" required />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">First Name *</label>' +
    '<input type="text" id="nemp-first" class="form-input" placeholder="Alex" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Last Name *</label>' +
    '<input type="text" id="nemp-last" class="form-input" placeholder="Smith" required />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Email Address *</label>' +
    '<input type="email" id="nemp-email" class="form-input" placeholder="name@company.com" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Phone Number</label>' +
    '<input type="tel" id="nemp-phone" class="form-input" placeholder="+63 912 345 6789" />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.15rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Department *</label>' +
    '<input type="text" id="nemp-dept" class="form-input" placeholder="Engineering / Logistics / Accounting" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Position / Job Title *</label>' +
    '<input type="text" id="nemp-pos" class="form-input" placeholder="Senior Operations Specialist" required />' +
    '</div>' +
    '</div>' +
    '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
    '<div style="font-size: 0.82rem; font-weight: 700; color: #334155; margin-bottom: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em;">💰 Compensation & Salary Package (PHP)</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.5rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Base Monthly Salary (₱) *</label>' +
    '<input type="number" id="nemp-base" class="form-input" step="0.01" value="25000" oninput="updateModalNetSalaryPreview(\\\'nemp\\\')" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Allowances (₱)</label>' +
    '<input type="number" id="nemp-allow" class="form-input" step="0.01" value="2500" oninput="updateModalNetSalaryPreview(\\\'nemp\\\')" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Deductions (₱)</label>' +
    '<input type="number" id="nemp-deduct" class="form-input" step="0.01" value="1500" oninput="updateModalNetSalaryPreview(\\\'nemp\\\')" />' +
    '</div>' +
    '</div>' +
    '<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.4rem; border-top: 1px solid #e2e8f0; font-size: 0.82rem;">' +
    '<span style="color: #64748b; font-weight: 500;">Calculated Net Compensation:</span>' +
    '<strong id="nemp-net-preview" style="color: #0f766e; font-size: 0.95rem; font-family: monospace;">₱26,000.00</strong>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Bank Name</label>' +
    '<input type="text" id="nemp-bank-name" class="form-input" placeholder="BDO / BPI / Metrobank" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Bank Account Number</label>' +
    '<input type="text" id="nemp-bank-acc" class="form-input" placeholder="0012-3456-7890" />' +
    '</div>' +
    '</div>' +
    '<div style="border-top: 1px solid #e2e8f0; padding-top: 0.85rem;">' +
    '<div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">' +
    '<input type="checkbox" id="nemp-create-account" onchange="toggleNewEmployeeAccountFields()" />' +
    '<label class="form-label" style="margin: 0; font-weight: 600;" for="nemp-create-account">Also create a system login account for this employee</label>' +
    '</div>' +
    '<div id="nemp-account-fields" style="display: none; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-sm); padding: 0.85rem; margin-top: 0.5rem;">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Initial Password *</label>' +
    '<input type="password" id="nemp-password" class="form-input" placeholder="At least 8 chars" minlength="8" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">System Role *</label>' +
    '<select id="nemp-role" class="form-select">' +
    '<option value="STAFF" selected>Staff (restricted ops view)</option>' +
    '<option value="MANAGER">Manager (full operations access)</option>' +
    '<option value="ADMIN">System Administrator (all modules)</option>' +
    '</select>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</form>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="document.getElementById(\\\'form-new-emp\\\').requestSubmit()">Save Employee</button>';

  openModal('Add New Employee', body, footer, 'lg');
}

function toggleNewEmployeeAccountFields() {
  const checkbox = document.getElementById('nemp-create-account');
  const fields = document.getElementById('nemp-account-fields');
  const passwordInput = document.getElementById('nemp-password');
  if (!fields || !checkbox) return;
  const show = checkbox.checked;
  fields.style.display = show ? 'block' : 'none';
  if (passwordInput) passwordInput.required = show;
}

async function submitNewEmployee(e) {
  e.preventDefault();
  const createAccount = document.getElementById('nemp-create-account')?.checked;
  const password = document.getElementById('nemp-password')?.value;

  if (createAccount && (!password || password.length < 8)) {
    showToast('Password must be at least 8 characters to create a user account', 'warning');
    return;
  }

  const basePesos = parseFloat(document.getElementById('nemp-base').value || '0');
  const allowPesos = parseFloat(document.getElementById('nemp-allow').value || '0');
  const deductPesos = parseFloat(document.getElementById('nemp-deduct').value || '0');

  const payload = {
    employeeCode: document.getElementById('nemp-code').value.trim(),
    email: document.getElementById('nemp-email').value.trim(),
    firstName: document.getElementById('nemp-first').value.trim(),
    lastName: document.getElementById('nemp-last').value.trim(),
    phone: document.getElementById('nemp-phone')?.value.trim() || undefined,
    department: document.getElementById('nemp-dept').value.trim(),
    position: document.getElementById('nemp-pos').value.trim(),
    hireDate: document.getElementById('nemp-hire-date')?.value || new Date().toISOString().slice(0, 10),
    bankName: document.getElementById('nemp-bank-name')?.value.trim() || undefined,
    bankAccountNumber: document.getElementById('nemp-bank-acc')?.value.trim() || undefined,
    baseSalaryCents: Math.round(basePesos * 100),
    allowancesCents: Math.round(allowPesos * 100),
    deductionsCents: Math.round(deductPesos * 100),
    createAccount: !!createAccount,
    password: createAccount ? password : undefined,
    role: createAccount ? document.getElementById('nemp-role').value : undefined,
  };

  try {
    const res = await apiFetch('/api/payroll/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create employee');

    closeModal();
    const extra = json.userCreated ? ' (login account created with role ' + json.userRole + ')' : '';
    showToast('Employee ' + json.data.employeeCode + ' created' + extra, 'success');
    loadStaff();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openViewEmployeeModal(empId) {
  const emp = (state.employees || []).find((x) => x.id === empId);
  if (!emp) {
    showToast('Employee record not found', 'warning');
    return;
  }

  const salary = emp.salaryStructures?.[0];
  const statusClass = emp.status === 'ACTIVE' ? 'badge-success' : emp.status === 'ON_LEAVE' ? 'badge-warning' : 'badge-danger';
  const hasUser = !!emp.user;

  const body =
    '<div style="display: flex; gap: 1.25rem; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1rem;">' +
    '<div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #3b82f6); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 700;">' +
    (emp.firstName?.[0] || 'E') + (emp.lastName?.[0] || '') +
    '</div>' +
    '<div style="flex: 1;">' +
    '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
    '<h3 style="margin: 0; font-size: 1.1rem; color: #1e293b;">' + emp.firstName + ' ' + emp.lastName + '</h3>' +
    '<span class="badge ' + statusClass + '">' + (emp.status || 'ACTIVE') + '</span>' +
    '</div>' +
    '<div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">' + (emp.position || '—') + ' • ' + (emp.department || '—') + '</div>' +
    '</div>' +
    '<div style="text-align: right;">' +
    '<div style="font-size: 0.75rem; color: #64748b;">Employee Code</div>' +
    '<strong style="font-family: monospace; font-size: 1rem; color: var(--primary);">' + emp.employeeCode + '</strong>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">' +
    '<div>' +
    '<div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Email Address</div>' +
    '<div style="font-weight: 500; color: #334155;">' + emp.email + '</div>' +
    '</div>' +
    '<div>' +
    '<div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Phone Number</div>' +
    '<div style="font-weight: 500; color: #334155;">' + (emp.phone || 'None recorded') + '</div>' +
    '</div>' +
    '<div>' +
    '<div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Hire Date</div>' +
    '<div style="font-weight: 500; color: #334155;">' + (emp.hireDate ? emp.hireDate.slice(0, 10) : '—') + '</div>' +
    '</div>' +
    '<div>' +
    '<div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">System Login Account</div>' +
    '<div style="font-weight: 500; color: #334155;">' +
    (hasUser ? '<span class="badge badge-primary">Role: ' + emp.user.role + (emp.user.isActive ? ' (Active)' : ' (Disabled)') + '</span>' : '<span style="color: #94a3b8;">No account linked</span>') +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
    '<div style="font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em;">💰 Compensation & Salary Breakdown</div>' +
    '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; text-align: center;">' +
    '<div style="background: #ffffff; padding: 0.6rem; border-radius: 4px; border: 1px solid #e2e8f0;"><div style="font-size: 0.72rem; color: #64748b;">Base Salary</div><strong style="color: #1e293b; font-size: 0.9rem;">' + formatCurrency(salary?.baseSalaryCents) + '</strong></div>' +
    '<div style="background: #ffffff; padding: 0.6rem; border-radius: 4px; border: 1px solid #e2e8f0;"><div style="font-size: 0.72rem; color: #64748b;">Allowances</div><strong style="color: #1e293b; font-size: 0.9rem;">' + formatCurrency(salary?.allowancesCents) + '</strong></div>' +
    '<div style="background: #ffffff; padding: 0.6rem; border-radius: 4px; border: 1px solid #e2e8f0;"><div style="font-size: 0.72rem; color: #64748b;">Deductions</div><strong style="color: #dc2626; font-size: 0.9rem;">' + formatCurrency(salary?.deductionsCents) + '</strong></div>' +
    '<div style="background: #ffffff; padding: 0.6rem; border-radius: 4px; border: 1px solid #ccfbf1;"><div style="font-size: 0.72rem; color: #0f766e;">Net Payout</div><strong style="color: #0f766e; font-size: 0.95rem;">' + formatCurrency(salary?.netSalaryCents) + '</strong></div>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div><div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Bank Name</div><div style="font-weight: 500; color: #334155;">' + (emp.bankName || '—') + '</div></div>' +
    '<div><div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Bank Account Number</div><div style="font-weight: 500; color: #334155; font-family: monospace;">' + (emp.bankAccountNumber || '—') + '</div></div>' +
    '</div>';

  const footer =
    '<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="closeModal(); openEmployeeAccountModal(\\\'' + emp.id + '\\\')">🔐 ' + (hasUser ? 'Manage Login Account (' + emp.user.role + ')' : '+ Provision Login Account') + '</button>' +
    '<div style="display: flex; gap: 0.5rem;">' +
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>' +
    '<button type="button" class="btn btn-primary" onclick="closeModal(); openEditEmployeeModal(\\\'' + emp.id + '\\\')">Edit Profile</button>' +
    '</div>' +
    '</div>';

  openModal('Employee Profile — ' + emp.employeeCode, body, footer, 'lg');
}

function openEditEmployeeModal(empId) {
  const emp = (state.employees || []).find((x) => x.id === empId);
  if (!emp) {
    showToast('Employee record not found', 'warning');
    return;
  }

  const salary = emp.salaryStructures?.[0];
  const basePesos = salary ? (salary.baseSalaryCents / 100).toFixed(2) : '0.00';
  const allowPesos = salary ? (salary.allowancesCents / 100).toFixed(2) : '0.00';
  const deductPesos = salary ? (salary.deductionsCents / 100).toFixed(2) : '0.00';
  const hireDateVal = emp.hireDate ? emp.hireDate.slice(0, 10) : '';

  const body =
    '<form id="form-edit-emp" onsubmit="submitEditEmployee(event, \\\'' + emp.id + '\\\')">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-code">Employee Code *</label>' +
    '<input type="text" id="editemp-code" class="form-input" value="' + emp.employeeCode + '" required style="font-weight: 700; font-family: monospace;" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Employment Status *</label>' +
    '<select id="editemp-status" class="form-select">' +
    '<option value="ACTIVE"' + (emp.status === 'ACTIVE' ? ' selected' : '') + '>Active</option>' +
    '<option value="ON_LEAVE"' + (emp.status === 'ON_LEAVE' ? ' selected' : '') + '>On Leave</option>' +
    '<option value="TERMINATED"' + (emp.status === 'TERMINATED' ? ' selected' : '') + '>Terminated (Revoke Access)</option>' +
    '</select>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-first">First Name *</label>' +
    '<input type="text" id="editemp-first" class="form-input" value="' + emp.firstName + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-last">Last Name *</label>' +
    '<input type="text" id="editemp-last" class="form-input" value="' + emp.lastName + '" required />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-email">Email Address *</label>' +
    '<input type="email" id="editemp-email" class="form-input" value="' + emp.email + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-phone">Phone Number</label>' +
    '<input type="tel" id="editemp-phone" class="form-input" value="' + (emp.phone || '') + '" />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-dept">Department *</label>' +
    '<input type="text" id="editemp-dept" class="form-input" value="' + (emp.department || '') + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-pos">Position *</label>' +
    '<input type="text" id="editemp-pos" class="form-input" value="' + (emp.position || '') + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-hire-date">Hire Date *</label>' +
    '<input type="date" id="editemp-hire-date" class="form-input" value="' + hireDateVal + '" required />' +
    '</div>' +
    '</div>' +
    '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
    '<div style="font-size: 0.82rem; font-weight: 700; color: #334155; margin-bottom: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em;">💰 Update Compensation Package (PHP)</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.5rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Base Monthly Salary (₱) *</label>' +
    '<input type="number" id="editemp-base" class="form-input" step="0.01" value="' + basePesos + '" oninput="updateModalNetSalaryPreview(\\\'editemp\\\')" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Allowances (₱)</label>' +
    '<input type="number" id="editemp-allow" class="form-input" step="0.01" value="' + allowPesos + '" oninput="updateModalNetSalaryPreview(\\\'editemp\\\')" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Deductions (₱)</label>' +
    '<input type="number" id="editemp-deduct" class="form-input" step="0.01" value="' + deductPesos + '" oninput="updateModalNetSalaryPreview(\\\'editemp\\\')" />' +
    '</div>' +
    '</div>' +
    '<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.4rem; border-top: 1px solid #e2e8f0; font-size: 0.82rem;">' +
    '<span style="color: #64748b; font-weight: 500;">Calculated Net Compensation:</span>' +
    '<strong id="editemp-net-preview" style="color: #0f766e; font-size: 0.95rem; font-family: monospace;">' + formatCurrency(salary?.netSalaryCents) + '</strong>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Bank Name</label>' +
    '<input type="text" id="editemp-bank-name" class="form-input" value="' + (emp.bankName || '') + '" placeholder="BDO / BPI / Metrobank" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Bank Account Number</label>' +
    '<input type="text" id="editemp-bank-acc" class="form-input" value="' + (emp.bankAccountNumber || '') + '" placeholder="0012-3456-7890" />' +
    '</div>' +
    '</div>' +
    '</form>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="document.getElementById(\\\'form-edit-emp\\\').requestSubmit()">Save Changes</button>';

  openModal('Edit Employee — ' + emp.employeeCode, body, footer, 'lg');
}

async function submitEditEmployee(e, empId) {
  e.preventDefault();

  const basePesos = parseFloat(document.getElementById('editemp-base').value || '0');
  const allowPesos = parseFloat(document.getElementById('editemp-allow').value || '0');
  const deductPesos = parseFloat(document.getElementById('editemp-deduct').value || '0');

  const payload = {
    employeeCode: document.getElementById('editemp-code').value.trim(),
    firstName: document.getElementById('editemp-first').value.trim(),
    lastName: document.getElementById('editemp-last').value.trim(),
    email: document.getElementById('editemp-email').value.trim(),
    phone: document.getElementById('editemp-phone')?.value.trim() || undefined,
    department: document.getElementById('editemp-dept').value.trim(),
    position: document.getElementById('editemp-pos').value.trim(),
    status: document.getElementById('editemp-status').value,
    hireDate: document.getElementById('editemp-hire-date')?.value || undefined,
    bankName: document.getElementById('editemp-bank-name')?.value.trim() || undefined,
    bankAccountNumber: document.getElementById('editemp-bank-acc')?.value.trim() || undefined,
    baseSalaryCents: Math.round(basePesos * 100),
    allowancesCents: Math.round(allowPesos * 100),
    deductionsCents: Math.round(deductPesos * 100),
  };

  try {
    const res = await apiFetch('/api/payroll/employees/' + empId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update employee');

    closeModal();
    showToast('Employee ' + json.data.employeeCode + ' updated successfully', 'success');
    loadStaff();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function handleDeleteEmployee(empId, empCode) {
  openConfirmModal({
    title: 'Delete / Deactivate Employee',
    message: 'Are you sure you want to delete employee <strong>' + (empCode || '') + '</strong>?',
    subtext: 'If historical payroll records exist, status will automatically be set to TERMINATED and system access revoked.',
    confirmText: 'Yes, Delete Employee',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: async () => {
      const res = await apiFetch('/api/payroll/employees/' + empId, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete employee');

      showToast(json.message || 'Employee deleted', json.softDeleted ? 'warning' : 'success');
      loadStaff();
    },
  });
}

function openEmployeeAccountModal(empId) {
  const emp = (state.employees || []).find((x) => x.id === empId);
  if (!emp) {
    showToast('Employee record not found', 'warning');
    return;
  }

  const hasUser = !!emp.user;
  let body = '';
  let footer = '';

  if (hasUser) {
    body =
      '<form id="form-edit-emp-acc" onsubmit="submitEditEmployeeAccount(event, \\\'' + emp.id + '\\\')">' +
      '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
      '<div style="display: flex; align-items: center; justify-content: space-between;">' +
      '<div>' +
      '<div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">' + emp.firstName + ' ' + emp.lastName + '</div>' +
      '<div style="font-size: 0.78rem; color: #64748b; font-family: monospace;">' + emp.employeeCode + ' • ' + (emp.department || '') + '</div>' +
      '</div>' +
      '<span class="badge ' + (emp.user.isActive ? 'badge-success' : 'badge-danger') + '">' +
      '<span class="badge-dot"></span>' + (emp.user.isActive ? 'Account Active' : 'Account Disabled') +
      '</span>' +
      '</div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
      '<div class="form-group" style="margin-bottom: 0;">' +
      '<label class="form-label" for="empacc-email">Login Email / Username *</label>' +
      '<input type="email" id="empacc-email" class="form-input" value="' + (emp.user.email || emp.email) + '" required />' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0;">' +
      '<label class="form-label" for="empacc-role">System Access Role *</label>' +
      '<select id="empacc-role" class="form-select">' +
      '<option value="STAFF"' + (emp.user.role === 'STAFF' ? ' selected' : '') + '>STAFF (Assigned modules only)</option>' +
      '<option value="MANAGER"' + (emp.user.role === 'MANAGER' ? ' selected' : '') + '>MANAGER (Approval & Ops access)</option>' +
      '<option value="ADMIN"' + (emp.user.role === 'ADMIN' ? ' selected' : '') + '>ADMIN (Full System Administrator)</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0.85rem;">' +
      '<label class="form-label" for="empacc-active">Account Status *</label>' +
      '<select id="empacc-active" class="form-select">' +
      '<option value="true"' + (emp.user.isActive ? ' selected' : '') + '>Active (Can log into ERP)</option>' +
      '<option value="false"' + (!emp.user.isActive ? ' selected' : '') + '>Disabled (Locked out immediately)</option>' +
      '</select>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0.25rem;">' +
      '<label class="form-label" for="empacc-password">Reset Password</label>' +
      '<div style="position: relative;">' +
      '<input type="password" id="empacc-password" class="form-input" placeholder="Leave empty to keep existing password" minlength="8" style="padding-right: 2.5rem;" />' +
      '<button type="button" class="btn btn-secondary btn-sm" style="position: absolute; right: 4px; top: 4px; bottom: 4px; padding: 0 0.5rem; display: flex; align-items: center;" onclick="togglePasswordVisibility(\\\'empacc-password\\\', this)">' +
      EYE_ICON_SVG +
      '</button>' +
      '</div>' +
      '<div style="font-size: 0.72rem; color: #64748b; margin-top: 0.35rem;">Enter a new password (min. 8 characters) to reset login access, or leave blank to keep current password.</div>' +
      '</div>' +
      '</form>';

    footer =
      '<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">' +
      '<button type="button" class="btn btn-danger btn-sm" onclick="handleUnlinkEmployeeAccount(\\\'' + emp.id + '\\\', \\\'' + emp.employeeCode + '\\\')">Unlink / Revoke Access</button>' +
      '<div style="display: flex; gap: 0.5rem;">' +
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="submit" form="form-edit-emp-acc" class="btn btn-primary">Save Account Changes</button>' +
      '</div>' +
      '</div>';
  } else {
    body =
      '<form id="form-create-emp-acc" onsubmit="submitCreateEmployeeAccount(event, \\\'' + emp.id + '\\\')">' +
      '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
      '<div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">' + emp.firstName + ' ' + emp.lastName + '</div>' +
      '<div style="font-size: 0.78rem; color: #64748b; font-family: monospace;">' + emp.employeeCode + ' • ' + (emp.department || '') + '</div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
      '<div class="form-group" style="margin-bottom: 0;">' +
      '<label class="form-label" for="newacc-email">Login Email *</label>' +
      '<input type="email" id="newacc-email" class="form-input" value="' + emp.email + '" required />' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0;">' +
      '<label class="form-label" for="newacc-role">System Access Role *</label>' +
      '<select id="newacc-role" class="form-select">' +
      '<option value="STAFF" selected>STAFF (Assigned modules only)</option>' +
      '<option value="MANAGER">MANAGER (Approval & Ops access)</option>' +
      '<option value="ADMIN">ADMIN (Full System Administrator)</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0.25rem;">' +
      '<label class="form-label" for="newacc-password">Initial Password * (min. 8 characters)</label>' +
      '<div style="position: relative;">' +
      '<input type="password" id="newacc-password" class="form-input" placeholder="Create strong temporary password" minlength="8" required style="padding-right: 2.5rem;" />' +
      '<button type="button" class="btn btn-secondary btn-sm" style="position: absolute; right: 4px; top: 4px; bottom: 4px; padding: 0 0.5rem; display: flex; align-items: center;" onclick="togglePasswordVisibility(\\\'newacc-password\\\', this)">' +
      EYE_ICON_SVG +
      '</button>' +
      '</div>' +
      '<div style="font-size: 0.72rem; color: #64748b; margin-top: 0.35rem;">This will create an active login account and link it to this employee record.</div>' +
      '</div>' +
      '</form>';

    footer =
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="submit" form="form-create-emp-acc" class="btn btn-primary">+ Provision Login Account</button>';
  }

  openModal((hasUser ? 'Manage Login Account — ' : 'Provision Login Account — ') + emp.employeeCode, body, footer, 'md');
}

async function submitCreateEmployeeAccount(e, empId) {
  e.preventDefault();
  const email = document.getElementById('newacc-email').value.trim();
  const role = document.getElementById('newacc-role').value;
  const password = document.getElementById('newacc-password').value;

  try {
    const res = await apiFetch('/api/payroll/employees/' + empId + '/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create account');

    closeModal();
    showToast(json.message || 'Login account created successfully', 'success');
    loadStaff();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function submitEditEmployeeAccount(e, empId) {
  e.preventDefault();
  const email = document.getElementById('empacc-email').value.trim();
  const role = document.getElementById('empacc-role').value;
  const isActive = document.getElementById('empacc-active').value === 'true';
  const password = document.getElementById('empacc-password')?.value || undefined;

  const payload = {
    email,
    role,
    isActive,
    ...(password && password.trim().length >= 8 ? { password: password.trim() } : {}),
  };

  try {
    const res = await apiFetch('/api/payroll/employees/' + empId + '/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update account');

    closeModal();
    showToast('Login account updated successfully', 'success');
    loadStaff();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function handleUnlinkEmployeeAccount(empId, empCode) {
  openConfirmModal({
    title: 'Unlink / Revoke Login Account',
    message: 'Are you sure you want to revoke and unlink the login account for employee <strong>' + (empCode || '') + '</strong>?',
    subtext: 'The user account will be deactivated and blocked from logging into the platform.',
    confirmText: 'Revoke Access',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: async () => {
      const res = await apiFetch('/api/payroll/employees/' + empId + '/account', {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to unlink account');

      closeModal();
      showToast(json.message || 'Login account revoked', 'warning');
      loadStaff();
    },
  });
}
`;
