export function renderStaffView(): string {
  return `<div id="view-staff" class="tab-view" style="display: none;"></div>`;
}

export const STAFF_CLIENT_JS = `
async function loadStaff() {
  const container = document.getElementById('view-staff');
  if (!container) return;
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading staff directory...</div>';

  try {
    const res = await apiFetch('/api/payroll/employees');
    const json = await res.json();
    state.employees = json.data || [];

    let empRows = '';
    state.employees.forEach((emp) => {
      const salary = emp.salaryStructures?.[0];
      empRows +=
        '<tr>' +
        '<td><strong>' + emp.employeeCode + '</strong></td>' +
        '<td>' + emp.firstName + ' ' + emp.lastName + '</td>' +
        '<td>' + (emp.department || '') + ' / ' + (emp.position || '') + '</td>' +
        '<td>' + formatCurrency(salary?.baseSalaryCents) + '</td>' +
        '<td>' + formatCurrency(salary?.allowancesCents) + '</td>' +
        '<td>' + formatCurrency(salary?.deductionsCents) + '</td>' +
        '<td><strong>' + formatCurrency(salary?.netSalaryCents) + '</strong></td>' +
        '</tr>';
    });

    container.innerHTML =
      '<div class="panel-card">' +
      '<div class="panel-header">' +
      '<div>' +
      '<div class="panel-title">👥 Staff & Human Resources</div>' +
      '<div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.3rem;">' +
      'Manage corporate employees, job positions, base compensation structures, and platform accounts.' +
      '</div>' +
      '</div>' +
      '<div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="exportEmployeesCsv()">📥 Export Staff CSV</button>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="openNewEmployeeModal()">+ Add Employee</button>' +
      '</div>' +
      '</div>' +
      '<div class="table-responsive">' +
      '<table class="data-table">' +
      '<thead>' +
      '<tr>' +
      '<th>Code</th>' +
      '<th>Employee Name</th>' +
      '<th>Department / Title</th>' +
      '<th>Base Salary</th>' +
      '<th>Allowances</th>' +
      '<th>Deductions</th>' +
      '<th>Net Compensation</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' +
      (empRows || '<tr><td colspan="7" style="text-align: center; color: #64748b;">No employees registered yet.</td></tr>') +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>';
  } catch (err) {
    container.innerHTML = '<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading staff directory: ' + err.message + '</div>';
  }
}

function exportEmployeesCsv() {
  const headers = ['Employee Code', 'Full Name', 'Department', 'Position', 'Base Salary (PHP)', 'Allowances (PHP)', 'Deductions (PHP)', 'Net Salary (PHP)'];
  const rows = (state.employees || []).map((emp) => {
    const salary = emp.salaryStructures?.[0];
    return [
      emp.employeeCode,
      emp.firstName + ' ' + emp.lastName,
      emp.department,
      emp.position,
      salary ? (salary.baseSalaryCents / 100).toFixed(2) : '0.00',
      salary ? (salary.allowancesCents / 100).toFixed(2) : '0.00',
      salary ? (salary.deductionsCents / 100).toFixed(2) : '0.00',
      salary ? (salary.netSalaryCents / 100).toFixed(2) : '0.00',
    ];
  });
  exportToCsv('employees_staff_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function openNewEmployeeModal() {
  const body =
    '<form id="form-new-emp" onsubmit="submitNewEmployee(event)">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group">' +
    '<label class="form-label">Employee Code *</label>' +
    '<input type="text" id="nemp-code" class="form-input" placeholder="EMP-002" required />' +
    '</div>' +
    '<div class="form-group">' +
    '<label class="form-label">Email *</label>' +
    '<input type="email" id="nemp-email" class="form-input" placeholder="name@company.com" required />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group">' +
    '<label class="form-label">First Name *</label>' +
    '<input type="text" id="nemp-first" class="form-input" placeholder="Alex" required />' +
    '</div>' +
    '<div class="form-group">' +
    '<label class="form-label">Last Name *</label>' +
    '<input type="text" id="nemp-last" class="form-input" placeholder="Smith" required />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group">' +
    '<label class="form-label">Department *</label>' +
    '<input type="text" id="nemp-dept" class="form-input" placeholder="Engineering" required />' +
    '</div>' +
    '<div class="form-group">' +
    '<label class="form-label">Position *</label>' +
    '<input type="text" id="nemp-pos" class="form-input" placeholder="Software Engineer" required />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">' +
    '<div class="form-group">' +
    '<label class="form-label">Base Salary (Cents) *</label>' +
    '<input type="number" id="nemp-base" class="form-input" value="950000" required />' +
    '</div>' +
    '<div class="form-group">' +
    '<label class="form-label">Allowances (Cents)</label>' +
    '<input type="number" id="nemp-allow" class="form-input" value="50000" />' +
    '</div>' +
    '<div class="form-group">' +
    '<label class="form-label">Deductions (Cents)</label>' +
    '<input type="number" id="nemp-deduct" class="form-input" value="200000" />' +
    '</div>' +
    '</div>' +
    '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.25rem 0;" />' +
    '<div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">' +
    '<input type="checkbox" id="nemp-create-account" onchange="toggleNewEmployeeAccountFields()" />' +
    '<label class="form-label" style="margin: 0;" for="nemp-create-account">Also create a system login account for this employee</label>' +
    '</div>' +
    '<div id="nemp-account-fields" style="display: none;">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group">' +
    '<label class="form-label">Initial Password *</label>' +
    '<input type="password" id="nemp-password" class="form-input" placeholder="At least 8 chars" minlength="8" />' +
    '</div>' +
    '<div class="form-group">' +
    '<label class="form-label">System Role *</label>' +
    '<select id="nemp-role" class="form-select">' +
    '<option value="STAFF" selected>Staff (restricted ops view)</option>' +
    '<option value="MANAGER">Manager (full operations access)</option>' +
    '<option value="ADMIN">System Administrator (all modules)</option>' +
    '</select>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</form>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="document.getElementById(\\\'form-new-emp\\\').requestSubmit()">Save Employee</button>';

  openModal('Add New Employee', body, footer);
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

  const payload = {
    employeeCode: document.getElementById('nemp-code').value.trim(),
    email: document.getElementById('nemp-email').value.trim(),
    firstName: document.getElementById('nemp-first').value.trim(),
    lastName: document.getElementById('nemp-last').value.trim(),
    department: document.getElementById('nemp-dept').value.trim(),
    position: document.getElementById('nemp-pos').value.trim(),
    baseSalaryCents: parseInt(document.getElementById('nemp-base').value, 10),
    allowancesCents: parseInt(document.getElementById('nemp-allow').value, 10) || 0,
    deductionsCents: parseInt(document.getElementById('nemp-deduct').value, 10) || 0,
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
`;
