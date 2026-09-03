export function renderPayrollView(): string {
  return `<div id="view-payroll" class="tab-view" style="display: none;"></div>`;
}

export const PAYROLL_CLIENT_JS = `
async function loadPayroll() {
  const container = document.getElementById('view-payroll');
  if (!container) return;
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading payroll runs...</div>';

  try {
    const runsRes = await apiFetch('/api/payroll/runs');
    const runsJson = await runsRes.json();
    state.payrollRuns = runsJson.data || [];

    let runRows = '';
    state.payrollRuns.forEach((run) => {
      const isFinal = run.status === 'FINALIZED';
      runRows +=
        '<tr>' +
        '<td><strong>' + run.runNumber + '</strong></td>' +
        '<td>' + (run.periodStartDate || '') + ' to ' + (run.periodEndDate || '') + '</td>' +
        '<td><span class="badge ' + (isFinal ? 'badge-success' : 'badge-warning') + '"><span class="badge-dot"></span>' + run.status + '</span></td>' +
        '<td><strong>' + formatCurrency(run.totalNetCents) + '</strong></td>' +
        '<td>' + (run.paymentVoucher?.voucherNumber ? '<strong style="font-family: monospace;">' + run.paymentVoucher.voucherNumber + '</strong>' : '<span style="color: #94a3b8;">Pending Finalization</span>') + '</td>' +
        '<td>' + (!isFinal ? '<button type="button" class="btn btn-success btn-sm" onclick="finalizePayrollRun(\\\'' + run.id + '\\\', \\\'' + run.runNumber + '\\\')">Finalize & Disburse</button>' : '<span class="badge badge-success">Disbursed</span>') + '</td>' +
        '</tr>';
    });

    container.innerHTML =
      '<div class="panel-card">' +
      '<div class="panel-header">' +
      '<div>' +
      '<div class="panel-title">💵 Payroll Runs & Disbursements</div>' +
      '<div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.3rem;">' +
      'Calculate monthly/bi-monthly compensation runs, finalize payouts, and audit auto-generated payment vouchers.' +
      '</div>' +
      '</div>' +
      '<div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="exportPayrollRunsCsv()">📥 Export Runs CSV</button>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="openNewPayrollRunModal()">+ Calculate Payroll</button>' +
      '</div>' +
      '</div>' +
      '<div class="table-responsive">' +
      '<table class="data-table">' +
      '<thead>' +
      '<tr>' +
      '<th>Run ID</th>' +
      '<th>Pay Period</th>' +
      '<th>Status</th>' +
      '<th>Total Net Payout</th>' +
      '<th>Payment Voucher</th>' +
      '<th>Actions</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' +
      (runRows || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No payroll runs calculated yet.</td></tr>') +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>';
  } catch (err) {
    container.innerHTML = '<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading payroll: ' + err.message + '</div>';
  }
}

function exportPayrollRunsCsv() {
  const headers = ['Run ID', 'Period Start', 'Period End', 'Status', 'Total Net Payout (PHP)', 'Payment Voucher'];
  const rows = (state.payrollRuns || []).map((run) => [
    run.runNumber,
    run.periodStartDate,
    run.periodEndDate,
    run.status,
    (run.totalNetCents / 100).toFixed(2),
    run.paymentVoucher?.voucherNumber || 'Pending',
  ]);
  exportToCsv('payroll_runs_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function openNewPayrollRunModal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const start = year + '-' + month + '-01';
  const end = new Date(year, now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const body =
    '<form id="form-new-pr" onsubmit="submitNewPayrollRun(event)">' +
    '<p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem;">' +
    'Calculating a payroll run computes gross pay, allowances, deductions, and net payouts for all active staff.' +
    '</p>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group">' +
    '<label class="form-label">Period Start Date *</label>' +
    '<input type="date" id="npr-start" class="form-input" value="' + start + '" required />' +
    '</div>' +
    '<div class="form-group">' +
    '<label class="form-label">Period End Date *</label>' +
    '<input type="date" id="npr-end" class="form-input" value="' + end + '" required />' +
    '</div>' +
    '</div>' +
    '</form>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="document.getElementById(\\\'form-new-pr\\\').requestSubmit()">Calculate Payroll</button>';

  openModal('Run Payroll Calculation', body, footer);
}

async function submitNewPayrollRun(e) {
  e.preventDefault();
  const payload = {
    periodStartDate: document.getElementById('npr-start').value,
    periodEndDate: document.getElementById('npr-end').value,
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

function finalizePayrollRun(runId, runNumber) {
  openConfirmModal({
    title: 'Finalize & Disburse Payroll',
    message: 'Finalize and disburse payroll run <strong>' + (runNumber || '') + '</strong>?',
    subtext: 'This will finalize all computed payslips, record staff disbursements, and automatically generate a corresponding Payment Voucher.',
    confirmText: 'Finalize & Disburse',
    cancelText: 'Cancel',
    type: 'success',
    onConfirm: async () => {
      const res = await apiFetch('/api/payroll/runs/' + runId + '/finalize', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to finalize payroll');

      showToast('Payroll Run ' + runNumber + ' finalized and Payment Voucher created', 'success');
      loadPayroll();
    },
  });
}
`;
