export function renderPayrollView(): string {
  return `<div id="view-payroll" class="tab-view" style="display: none;"></div>`;
}

export const PAYROLL_CLIENT_JS = `
async function loadPayroll() {
  const container = document.getElementById('view-payroll');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading payroll data...</div>';

  try {
    const [empRes, runsRes] = await Promise.all([
      apiFetch('/api/payroll/employees'),
      apiFetch('/api/payroll/runs'),
    ]);
    const empJson = await empRes.json();
    const runsJson = await runsRes.json();

    state.employees = empJson.data || [];
    state.payrollRuns = runsJson.data || [];

    let empRows = '';
    state.employees.forEach((emp) => {
      const salary = emp.salaryStructures?.[0];
      empRows += \`
        <tr>
          <td><strong>\${emp.employeeCode}</strong></td>
          <td>\${emp.firstName} \${emp.lastName}</td>
          <td>\${emp.department} / \${emp.position}</td>
          <td>\${formatCurrency(salary?.baseSalaryCents)}</td>
          <td>\${formatCurrency(salary?.allowancesCents)}</td>
          <td>\${formatCurrency(salary?.deductionsCents)}</td>
          <td><strong>\${formatCurrency(salary?.netSalaryCents)}</strong></td>
        </tr>
      \`;
    });

    let runRows = '';
    state.payrollRuns.forEach((run) => {
      const isFinal = run.status === 'FINALIZED';
      runRows += \`
        <tr>
          <td><strong>\${run.runNumber}</strong></td>
          <td>\${run.periodStartDate} to \${run.periodEndDate}</td>
          <td>
            <span class="badge \${isFinal ? 'badge-success' : 'badge-warning'}">
              <span class="badge-dot"></span>
              \${run.status}
            </span>
          </td>
          <td><strong>\${formatCurrency(run.totalNetCents)}</strong></td>
          <td>\${run.paymentVoucher?.voucherNumber || 'Pending'}</td>
          <td>
            \${!isFinal
              ? \`<button class="btn btn-success btn-sm" onclick="finalizePayrollRun('\${run.id}', '\${run.runNumber}')">Finalize & Disburse</button>\`
              : '<span class="badge badge-success">Disbursed</span>'
            }
          </td>
        </tr>
      \`;
    });

    container.innerHTML = \`
      <!-- Payroll Runs -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Payroll Runs & Disbursements</div>
          <div class="panel-actions">
            <button class="btn btn-secondary btn-sm" onclick="openNewEmployeeModal()">Add Employee</button>
            <button class="btn btn-primary btn-sm" onclick="openNewPayrollRunModal()">Calculate Payroll</button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Period</th>
                <th>Status</th>
                <th>Total Net Payout</th>
                <th>Payment Voucher</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              \${runRows || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No payroll runs yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Employees Directory -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Active Employees & Compensation</div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee Name</th>
                <th>Department / Title</th>
                <th>Base Salary</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net Compensation</th>
              </tr>
            </thead>
            <tbody>
              \${empRows || '<tr><td colspan="7" style="text-align: center; color: #64748b;">No employees configured.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    \`;
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading payroll: \${err.message}</div>\`;
  }
}

function openNewEmployeeModal() {
  const body = \`
    <form id="form-new-emp" onsubmit="submitNewEmployee(event)">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Employee Code *</label>
          <input type="text" id="nemp-code" class="form-input" placeholder="EMP-002" required />
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" id="nemp-email" class="form-input" placeholder="name@company.com" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">First Name *</label>
          <input type="text" id="nemp-first" class="form-input" placeholder="Alex" required />
        </div>
        <div class="form-group">
          <label class="form-label">Last Name *</label>
          <input type="text" id="nemp-last" class="form-input" placeholder="Smith" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Department *</label>
          <input type="text" id="nemp-dept" class="form-input" placeholder="Engineering" required />
        </div>
        <div class="form-group">
          <label class="form-label">Position *</label>
          <input type="text" id="nemp-pos" class="form-input" placeholder="Software Engineer" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label class="form-label">Base Salary (Cents) *</label>
          <input type="number" id="nemp-base" class="form-input" value="950000" required />
        </div>
        <div class="form-group">
          <label class="form-label">Allowances (Cents)</label>
          <input type="number" id="nemp-allow" class="form-input" value="50000" />
        </div>
        <div class="form-group">
          <label class="form-label">Deductions (Cents)</label>
          <input type="number" id="nemp-deduct" class="form-input" value="200000" />
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.25rem 0;" />

      <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
        <input type="checkbox" id="nemp-create-account" onchange="toggleNewEmployeeAccountFields()" />
        <label class="form-label" style="margin: 0;" for="nemp-create-account">Also create a system login account for this employee</label>
      </div>

      <div id="nemp-account-fields" style="display: none;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Password *</label>
            <div class="password-input-wrapper">
              <input type="password" id="nemp-password" class="form-input" minlength="8" autocomplete="new-password" />
              <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('nemp-password', this)" tabindex="-1" aria-label="Show password">
                \${EYE_ICON_SVG}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password *</label>
            <div class="password-input-wrapper">
              <input type="password" id="nemp-password-confirm" class="form-input" minlength="8" autocomplete="new-password" />
              <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('nemp-password-confirm', this)" tabindex="-1" aria-label="Show password">
                \${EYE_ICON_SVG}
              </button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Account Role *</label>
          <select id="nemp-role" class="form-input">
            <option value="STAFF">STAFF</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-emp').requestSubmit()">Save Employee</button>
  \`;
  openModal('Add New Employee', body, footer);
}

function toggleNewEmployeeAccountFields() {
  const enabled = document.getElementById('nemp-create-account').checked;
  document.getElementById('nemp-account-fields').style.display = enabled ? 'block' : 'none';
  document.getElementById('nemp-password').required = enabled;
  document.getElementById('nemp-password-confirm').required = enabled;
}

async function submitNewEmployee(e) {
  e.preventDefault();
  const createUserAccount = document.getElementById('nemp-create-account').checked;

  const payload = {
    employeeCode: document.getElementById('nemp-code').value,
    firstName: document.getElementById('nemp-first').value,
    lastName: document.getElementById('nemp-last').value,
    email: document.getElementById('nemp-email').value,
    department: document.getElementById('nemp-dept').value,
    position: document.getElementById('nemp-pos').value,
    salary: {
      baseSalaryCents: parseInt(document.getElementById('nemp-base').value, 10),
      allowancesCents: parseInt(document.getElementById('nemp-allow').value, 10) || 0,
      deductionsCents: parseInt(document.getElementById('nemp-deduct').value, 10) || 0,
    },
    createUserAccount,
  };

  if (createUserAccount) {
    const password = document.getElementById('nemp-password').value;
    const passwordConfirm = document.getElementById('nemp-password-confirm').value;
    if (password !== passwordConfirm) {
      showToast('Passwords do not match', 'danger');
      return;
    }
    payload.password = password;
    payload.userRole = document.getElementById('nemp-role').value;
  }

  try {
    const res = await apiFetch('/api/payroll/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create employee');

    closeModal();
    showToast('Employee ' + json.data.firstName + (json.data.user ? ' added with a login account' : ' added'), 'success');
    loadPayroll();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openNewPayrollRunModal() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const body = \`
    <form id="form-new-pr" onsubmit="submitNewPayrollRun(event)">
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
        Calculating a payroll run computes gross pay, deductions, and net payouts for active staff.
      </p>
      <div class="form-group">
        <label class="form-label">Period Start Date *</label>
        <input type="date" id="pr-start" class="form-input" value="\${start}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Period End Date *</label>
        <input type="date" id="pr-end" class="form-input" value="\${end}" required />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-pr').requestSubmit()">Calculate Payroll</button>
  \`;
  openModal('Run Payroll Calculation', body, footer);
}

async function submitNewPayrollRun(e) {
  e.preventDefault();
  const payload = {
    periodStartDate: document.getElementById('pr-start').value,
    periodEndDate: document.getElementById('pr-end').value,
  };

  try {
    const res = await apiFetch('/api/payroll/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to calculate payroll');

    closeModal();
    showToast('Payroll Run ' + json.data.runNumber + ' calculated', 'success');
    loadPayroll();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function finalizePayrollRun(runId, runNumber) {
  if (!confirm('Finalize ' + runNumber + '? This will generate payslips and create a Payment Voucher.')) return;

  try {
    const res = await apiFetch('/api/payroll/runs/' + runId + '/finalize', { method: 'POST' });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to finalize payroll');

    showToast('Payroll Run ' + runNumber + ' finalized', 'success');
    loadPayroll();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
