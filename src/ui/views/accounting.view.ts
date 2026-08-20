export function renderAccountingView(): string {
  return `<div id="view-accounting" class="tab-view" style="display: none;"></div>`;
}

export const ACCOUNTING_CLIENT_JS = `
async function loadAccounting() {
  const container = document.getElementById('view-accounting');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading ledger & accounts...</div>';

  try {
    const [tbRes, ledgerRes] = await Promise.all([
      apiFetch('/api/accounting/trial-balance'),
      apiFetch('/api/accounting/ledger'),
    ]);
    const tbJson = await tbRes.json();
    const ledgerJson = await ledgerRes.json();

    state.trialBalance = tbJson;
    const accounts = tbJson.accounts || [];
    const entries = ledgerJson.data || [];

    let accRows = '';
    accounts.forEach((acc) => {
      accRows += \`
        <tr>
          <td><strong>\${acc.code}</strong></td>
          <td>\${acc.name}</td>
          <td><span class="badge badge-primary">\${acc.type}</span></td>
          <td>\${formatCurrency(acc.totalDebitCents)}</td>
          <td>\${formatCurrency(acc.totalCreditCents)}</td>
          <td><strong>\${formatCurrency(acc.netBalanceCents)}</strong></td>
        </tr>
      \`;
    });

    let ledgerRows = '';
    entries.slice(0, 20).forEach((e) => {
      ledgerRows += \`
        <tr>
          <td>\${new Date(e.createdAt).toLocaleDateString()}</td>
          <td><span class="badge badge-neutral">\${e.voucherType}</span></td>
          <td>\${e.account?.code} - \${e.account?.name}</td>
          <td style="color: #059669; font-weight: 600;">\${e.debitCents > 0 ? formatCurrency(e.debitCents) : '-'}</td>
          <td style="color: #dc2626; font-weight: 600;">\${e.creditCents > 0 ? formatCurrency(e.creditCents) : '-'}</td>
          <td style="font-size: 0.8rem; color: #64748b;">\${e.description || '-'}</td>
        </tr>
      \`;
    });

    container.innerHTML = \`
      <!-- Trial Balance Card -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Trial Balance & Chart of Accounts</div>
          <div class="panel-actions">
            <span class="badge \${tbJson.isBalanced ? 'badge-success' : 'badge-danger'}">
              <span class="badge-dot"></span>
              \${tbJson.isBalanced ? 'Double-Entry Balanced' : 'Ledger Imbalance'}
            </span>
            <button class="btn btn-primary btn-sm" onclick="openNewJVModal()">Post Journal Voucher</button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Type</th>
                <th>Total Debits</th>
                <th>Total Credits</th>
                <th>Net Balance</th>
              </tr>
            </thead>
            <tbody>
              \${accRows || '<tr><td colspan="6" style="text-align: center;">No accounts configured.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- General Ledger Audit -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">General Ledger Journal Entries</div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher</th>
                <th>Account</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              \${ledgerRows || '<tr><td colspan="6" style="text-align: center;">No ledger entries yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    \`;
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading accounting: \${err.message}</div>\`;
  }
}

function openNewJVModal() {
  const body = \`
    <form id="form-new-jv" onsubmit="submitNewJV(event)">
      <div class="form-group">
        <label class="form-label">Description / Memo *</label>
        <input type="text" id="jv-desc" class="form-input" placeholder="e.g. Month-end depreciation entry" required />
      </div>
      <div style="background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.9rem;">
        <div style="font-weight: 600; margin-bottom: 0.4rem; font-size: 0.8rem; color: #475569;">Line 1 (Debit Entry)</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <input type="text" id="jv-acc1" class="form-input" placeholder="Account Code (e.g. 5020)" value="5020" required />
          <input type="number" id="jv-deb1" class="form-input" placeholder="Debit Cents" value="50000" required />
        </div>
      </div>
      <div style="background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0;">
        <div style="font-weight: 600; margin-bottom: 0.4rem; font-size: 0.8rem; color: #475569;">Line 2 (Credit Entry)</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <input type="text" id="jv-acc2" class="form-input" placeholder="Account Code (e.g. 1010)" value="1010" required />
          <input type="number" id="jv-crd2" class="form-input" placeholder="Credit Cents" value="50000" required />
        </div>
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-jv').requestSubmit()">Post Journal Voucher</button>
  \`;
  openModal('Create Balanced Journal Voucher', body, footer);
}

async function submitNewJV(e) {
  e.preventDefault();
  const desc = document.getElementById('jv-desc').value;
  const acc1 = document.getElementById('jv-acc1').value;
  const deb1 = parseInt(document.getElementById('jv-deb1').value, 10);
  const acc2 = document.getElementById('jv-acc2').value;
  const crd2 = parseInt(document.getElementById('jv-crd2').value, 10);

  if (deb1 !== crd2) {
    showToast('Debit and Credit entries must be equal', 'danger');
    return;
  }

  const payload = {
    description: desc,
    entries: [
      { accountCode: acc1, debitCents: deb1, creditCents: 0, description: desc },
      { accountCode: acc2, debitCents: 0, creditCents: crd2, description: desc },
    ],
  };

  try {
    const res = await apiFetch('/api/accounting/vouchers/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to post JV');

    closeModal();
    showToast('Journal Voucher ' + json.jvNumber + ' posted', 'success');
    loadAccounting();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
