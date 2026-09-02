export function renderAccountingView(): string {
  return `<div id="view-accounting" class="tab-view" style="display: none;"></div>`;
}

export const ACCOUNTING_CLIENT_JS = `
let accountingActiveTab = 'vouchers-all';
let cachedAccounts = [];
let cachedVouchers = [];
let cachedLedgerEntries = [];
let voucherSearchQuery = '';

async function loadAccounting() {
  const container = document.getElementById('view-accounting');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading vouchers & ledger...</div>';

  try {
    const urlTab = typeof getUrlParam === 'function' ? getUrlParam('tab') : null;
    if (urlTab) accountingActiveTab = urlTab;
    voucherSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';

    const [tbRes, ledgerRes, vouchersRes, accountsRes, settingsRes] = await Promise.all([
      apiFetch('/api/accounting/trial-balance'),
      apiFetch('/api/accounting/ledger'),
      apiFetch('/api/accounting/vouchers'),
      apiFetch('/api/accounting/accounts'),
      apiFetch('/api/settings/vouchers').catch(() => null),
    ]);

    const tbJson = await tbRes.json();
    const ledgerJson = await ledgerRes.json();
    const vouchersJson = await vouchersRes.json();
    const accountsJson = await accountsRes.json();
    if (settingsRes) {
      try {
        const settingsJson = await settingsRes.json();
        window.cachedVoucherSettings = settingsJson.settings || {};
      } catch (e) {}
    }

    state.trialBalance = tbJson;
    cachedAccounts = accountsJson.data || [];
    cachedVouchers = vouchersJson.data || [];
    cachedLedgerEntries = ledgerJson.data || [];
    const accounts = tbJson.accounts || [];
    const entries = ledgerJson.data || [];

    renderAccountingContent(container, tbJson, accounts, entries, cachedVouchers, cachedAccounts);

    const urlSlip = typeof getUrlParam === 'function' ? getUrlParam('slip') : null;
    if (urlSlip) {
      openVoucherSlipModal(urlSlip);
    }
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading accounting: \${err.message}</div>\`;
  }
}

function switchAccountingTab(tab) {
  accountingActiveTab = tab;
  if (typeof setUrlParam === 'function') {
    setUrlParam('tab', tab);
  }
  const container = document.getElementById('view-accounting');
  if (container && state.trialBalance) {
    renderAccountingContent(container, state.trialBalance, state.trialBalance.accounts || [], cachedLedgerEntries, cachedVouchers, cachedAccounts);
  } else {
    loadAccounting();
  }
}

function handleVoucherSearch(query) {
  voucherSearchQuery = query.toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', voucherSearchQuery || null);
  }
  const container = document.getElementById('view-accounting');
  if (container && state.trialBalance) {
    renderAccountingContent(container, state.trialBalance, state.trialBalance.accounts || [], cachedLedgerEntries, cachedVouchers, cachedAccounts);
  }
}

function exportVouchersCsv() {
  const headers = ['Voucher #', 'Date', 'Type', 'Payee / Recipient', 'Payment Method', 'Currency', 'Amount', 'Status', 'Notes'];
  const rows = (cachedVouchers || []).map((v) => [
    v.voucherNumber,
    new Date(v.voucherDate || v.createdAt).toISOString().slice(0, 10),
    v.voucherType,
    v.recipient || v.recipientName || '',
    v.paymentMethod || 'STANDARD',
    v.currency || 'PHP',
    (v.amountCents / 100).toFixed(2),
    v.status || 'POSTED',
    v.notes || '',
  ]);
  exportToCsv('vouchers_export_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function exportLedgerCsv() {
  const headers = ['Entry Date', 'Voucher Type', 'Account Code', 'Account Name', 'Debit (PHP)', 'Credit (PHP)', 'Description'];
  const rows = (cachedLedgerEntries || []).map((e) => [
    new Date(e.createdAt).toISOString().slice(0, 10),
    e.voucherType,
    e.account?.code || '',
    e.account?.name || '',
    (e.debitCents / 100).toFixed(2),
    (e.creditCents / 100).toFixed(2),
    e.description || '',
  ]);
  exportToCsv('general_ledger_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function exportTrialBalanceCsv() {
  const accounts = state.trialBalance?.accounts || cachedAccounts || [];
  const headers = ['Account Code', 'Account Name', 'Type', 'Total Debits (PHP)', 'Total Credits (PHP)', 'Net Balance (PHP)'];
  const rows = accounts.map((a) => [
    a.code,
    a.name,
    a.type,
    ((a.totalDebitCents || 0) / 100).toFixed(2),
    ((a.totalCreditCents || 0) / 100).toFixed(2),
    ((a.netBalanceCents || 0) / 100).toFixed(2),
  ]);
  exportToCsv('trial_balance_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function renderAccountingContent(container, tbJson, accounts, entries, vouchers, rawAccounts) {
  const isBalanced = tbJson.isBalanced;

  // Filter vouchers according to selected sub-tab and search query
  let filteredVouchers = vouchers;
  if (accountingActiveTab === 'vouchers-pv') {
    filteredVouchers = vouchers.filter((v) => v.voucherType === 'PAYMENT');
  } else if (accountingActiveTab === 'vouchers-rv') {
    filteredVouchers = vouchers.filter((v) => v.voucherType === 'RECEIPT');
  } else if (accountingActiveTab === 'vouchers-jv') {
    filteredVouchers = vouchers.filter((v) => v.voucherType === 'JOURNAL');
  }

  if (voucherSearchQuery) {
    filteredVouchers = filteredVouchers.filter((v) => {
      const num = (v.voucherNumber || '').toLowerCase();
      const rec = (v.recipient || v.recipientName || '').toLowerCase();
      const notes = (v.notes || '').toLowerCase();
      const method = (v.paymentMethod || '').toLowerCase();
      return num.includes(voucherSearchQuery) || rec.includes(voucherSearchQuery) || notes.includes(voucherSearchQuery) || method.includes(voucherSearchQuery);
    });
  }

  const voucherTypeBadges = {
    PAYMENT: 'badge-danger',
    RECEIPT: 'badge-success',
    JOURNAL: 'badge-primary',
  };

  const voucherRows = filteredVouchers.map((v) => {
    const isPayment = v.voucherType === 'PAYMENT';
    const isReceipt = v.voucherType === 'RECEIPT';
    const amountColor = isPayment ? '#dc2626' : isReceipt ? '#059669' : '#1d4ed8';
    const amountPrefix = isPayment ? '- ' : isReceipt ? '+ ' : '';

    return \`
      <tr>
        <td><strong style="font-family: 'JetBrains Mono', monospace;">\${v.voucherNumber}</strong></td>
        <td>\${new Date(v.voucherDate || v.createdAt).toLocaleDateString()}</td>
        <td><span class="badge \${voucherTypeBadges[v.voucherType] || 'badge-neutral'}"><span class="badge-dot"></span>\${v.voucherType}</span></td>
        <td><strong>\${v.recipient || '-'}</strong></td>
        <td><span style="font-size: 0.8rem; color: #64748b;">\${(v.paymentMethod || 'STANDARD').replace('_', ' ')}</span></td>
        <td style="font-weight: 700; color: \${amountColor}; font-family: 'JetBrains Mono', monospace;">
          \${amountPrefix}\${formatCurrency(v.amountCents, v.currency || 'PHP')}
        </td>
        <td><span class="badge badge-success"><span class="badge-dot"></span>\${v.status || 'POSTED'}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openVoucherSlipModal('\${v.id}')">View Official Slip</button>
        </td>
      </tr>
    \`;
  }).join('');

  let accRows = '';
  accounts.forEach((acc) => {
    accRows += \`
      <tr>
        <td><strong style="font-family: 'JetBrains Mono', monospace;">\${acc.code}</strong></td>
        <td>\${acc.name}</td>
        <td><span class="badge badge-primary">\${acc.type}</span></td>
        <td style="font-family: 'JetBrains Mono', monospace;">\${formatCurrency(acc.totalDebitCents)}</td>
        <td style="font-family: 'JetBrains Mono', monospace;">\${formatCurrency(acc.totalCreditCents)}</td>
        <td style="font-weight: 700; font-family: 'JetBrains Mono', monospace;">\${formatCurrency(acc.netBalanceCents)}</td>
      </tr>
    \`;
  });

  let ledgerRows = '';
  entries.slice(0, 50).forEach((e) => {
    ledgerRows += \`
      <tr>
        <td>\${new Date(e.createdAt).toLocaleDateString()}</td>
        <td><span class="badge badge-neutral"><span class="badge-dot"></span>\${e.voucherType}</span></td>
        <td><strong style="font-family: 'JetBrains Mono', monospace;">\${e.account?.code}</strong> \${e.account?.name || ''}</td>
        <td style="color: #059669; font-weight: 600; font-family: 'JetBrains Mono', monospace;">\${e.debitCents > 0 ? formatCurrency(e.debitCents) : '—'}</td>
        <td style="color: #dc2626; font-weight: 600; font-family: 'JetBrains Mono', monospace;">\${e.creditCents > 0 ? formatCurrency(e.creditCents) : '—'}</td>
        <td style="font-size: 0.8rem; color: #64748b;">\${e.description || '—'}</td>
      </tr>
    \`;
  });

  const tabs = [
    { id: 'vouchers-all', label: 'All Vouchers', count: vouchers.length },
    { id: 'vouchers-pv', label: 'Payment Vouchers (PV)', count: vouchers.filter((x) => x.voucherType === 'PAYMENT').length },
    { id: 'vouchers-rv', label: 'Receipt Vouchers (RV)', count: vouchers.filter((x) => x.voucherType === 'RECEIPT').length },
    { id: 'vouchers-jv', label: 'Journal Vouchers (JV)', count: vouchers.filter((x) => x.voucherType === 'JOURNAL').length },
    { id: 'trial-balance', label: 'Chart of Accounts & TB', count: accounts.length },
    { id: 'general-ledger', label: 'General Ledger Audit', count: entries.length },
  ];

  const subNavHtml = tabs.map((t) => {
    const active = accountingActiveTab === t.id;
    return \`
      <button type="button" onclick="switchAccountingTab('\${t.id}')" style="padding: 0.5rem 1rem; border-radius: 999px; font-size: 0.82rem; font-weight: 600; border: 1px solid \${active ? 'var(--primary)' : 'var(--border-color)'}; background: \${active ? 'var(--primary)' : '#ffffff'}; color: \${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        \${t.label} <span style="opacity: 0.75;">(\${t.count})</span>
      </button>
    \`;
  }).join('');

  let exportButtonHtml = '';
  if (accountingActiveTab.startsWith('vouchers')) {
    exportButtonHtml = \`<button class="btn btn-secondary btn-sm" onclick="exportVouchersCsv()">📥 Export Vouchers CSV</button>\`;
  } else if (accountingActiveTab === 'trial-balance') {
    exportButtonHtml = \`<button class="btn btn-secondary btn-sm" onclick="exportTrialBalanceCsv()">📥 Export TB CSV</button>\`;
  } else if (accountingActiveTab === 'general-ledger') {
    exportButtonHtml = \`<button class="btn btn-secondary btn-sm" onclick="exportLedgerCsv()">📥 Export Ledger CSV</button>\`;
  }

  let mainSectionHtml = '';

  if (accountingActiveTab.startsWith('vouchers')) {
    mainSectionHtml = \`
      <div style="padding: 0.75rem 1.35rem 0.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div style="flex: 1; max-width: 380px;">
          <input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search voucher #, payee, or notes..." value="\${voucherSearchQuery}" oninput="handleVoucherSearch(this.value)" />
        </div>
        <div>
          \${exportButtonHtml}
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Voucher #</th>
              <th>Date</th>
              <th>Type</th>
              <th>Payee / Payer / Memo</th>
              <th>Payment Method</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            \${voucherRows || '<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 2rem;">No vouchers found in this category.</td></tr>'}
          </tbody>
        </table>
      </div>
    \`;
  } else if (accountingActiveTab === 'trial-balance') {
    mainSectionHtml = \`
      <div style="padding: 0.75rem 1.35rem 0.5rem; display: flex; justify-content: flex-end;">
        \${exportButtonHtml}
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
            \${accRows || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No accounts configured.</td></tr>'}
          </tbody>
        </table>
      </div>
    \`;
  } else if (accountingActiveTab === 'general-ledger') {
    mainSectionHtml = \`
      <div style="padding: 0.75rem 1.35rem 0.5rem; display: flex; justify-content: flex-end;">
        \${exportButtonHtml}
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Account Code & Title</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Memo / Description</th>
            </tr>
          </thead>
          <tbody>
            \${ledgerRows || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No ledger entries yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    \`;
  }

  container.innerHTML = \`
    <!-- Vouchers Header Panel -->
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">
          Vouchers
          <div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.3rem;">
            Official double-entry voucher registry, payment disbursements, incoming receipts, and general ledger journal entries.
          </div>
        </div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span class="badge \${isBalanced ? 'badge-success' : 'badge-danger'}" style="align-self: center;">
            <span class="badge-dot"></span>
            \${isBalanced ? 'Double-Entry Balanced' : 'Ledger Imbalance ($' + (Math.abs(tbJson.discrepancyCents || 0) / 100).toFixed(2) + ')'}
          </span>
          <button class="btn btn-secondary btn-sm" onclick="openNewContraModal()">Post Contra (Transfer)</button>
          <button class="btn btn-secondary btn-sm" onclick="openNewPaymentVoucherModal()">New Payment Voucher</button>
          <button class="btn btn-secondary btn-sm" onclick="openNewReceiptVoucherModal()">New Receipt Voucher</button>
          <button class="btn btn-primary btn-sm" onclick="openNewJVModal()">Post Journal Voucher</button>
        </div>
      </div>

      <!-- Sub-Navigation Filters -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 0.5rem 1.35rem 1.25rem; border-bottom: 1px solid var(--border-color);">
        \${subNavHtml}
      </div>

      <!-- Main Section Content -->
      <div style="padding-top: 0.5rem;">
        \${mainSectionHtml}
      </div>
    </div>
  \`;
}

/* ========================================================================== */
/* VOUCHER MODALS & ACTIONS                                                   */
/* ========================================================================== */

function openNewPaymentVoucherModal() {
  const accountOptions = cachedAccounts.map((a) => \`<option value="\${a.code}">\${a.code} - \${a.name} (\${a.type})</option>\`).join('');
  const todayStr = new Date().toISOString().slice(0, 10);

  const vSettings = window.cachedVoucherSettings || {};
  const sign = vSettings['vouchers.signatories'] || {};
  const prepVal = sign.preparedBy || 'Administrator';
  const certVal = sign.certifiedBy || 'Joy/Admin';
  const appVal = sign.approvedBy || 'Kenneth Brown/CEO';
  const recVal = sign.receivedBy || 'Signature over printed name/Date';

  const methods = (vSettings['vouchers.payment_methods'] && Array.isArray(vSettings['vouchers.payment_methods']))
    ? vSettings['vouchers.payment_methods']
    : [
        { id: 'BANK_TRANSFER', name: 'Bank Wire / ACH', isActive: true },
        { id: 'CHECK', name: 'Company Check', isActive: true },
        { id: 'CASH', name: 'Petty Cash', isActive: true },
        { id: 'CREDIT_CARD', name: 'Corporate Credit Card', isActive: true },
        { id: 'ONLINE', name: 'Online / E-Wallet', isActive: true },
      ];
  const methodOptions = methods
    .filter((m) => m.isActive !== false)
    .map((m) => \`<option value="\${m.id}">\${m.name}</option>\`)
    .join('');

  const tags = (vSettings['vouchers.tags'] && Array.isArray(vSettings['vouchers.tags'])) ? vSettings['vouchers.tags'] : [];
  const tagOptions = ['<option value="">-- No Tag / General --</option>']
    .concat(tags.map((t) => \`<option value="\${t}">\${t}</option>\`))
    .join('');

  const defAccounts = vSettings['vouchers.default_accounts'] || {};
  const defaultCash = defAccounts.cashAccountCode || '1010';
  const defaultExp = defAccounts.salariesExpenseCode || '5020';

  const body = \`
    <form id="form-new-pv" onsubmit="submitNewPaymentVoucher(event)">
      <!-- Top Info Grid -->
      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.85rem; margin-bottom: 0.85rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-weight: 700;">Pay to (Recipient / Payee Name) *</label>
          <input type="text" id="pv-recipient-name" class="form-input" placeholder="e.g. Jaymar Anasco or Acme Supplies" required />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Classification</label>
          <select id="pv-recipient-type" class="form-input">
            <option value="VENDOR">Vendor / Supplier</option>
            <option value="EMPLOYEE">Employee / Staff</option>
            <option value="OTHER">Other / Contractor</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Currency</label>
          <select id="pv-currency" class="form-input" onchange="updatePaymentVoucherCurrency()">
            <option value="PHP" selected>PHP (₱)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.85rem; margin-bottom: 1.15rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Voucher Date *</label>
          <input type="date" id="pv-date" class="form-input" value="\${todayStr}" required />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Expense Tag / Category</label>
          <select id="pv-tag" class="form-input">
            \${tagOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Voucher Number <span style="font-size: 0.75rem; color: #64748b;">(Auto)</span></label>
          <input type="text" id="pv-voucher-number" class="form-input" placeholder="e.g. 26-000440 (Auto)" />
        </div>
      </div>

      <!-- Line Items Section (Matching APEXS Voucher Format) -->
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #ffffff; margin-bottom: 1.15rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <div>
            <span style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">Itemized Breakdown</span>
            <span style="font-size: 0.78rem; color: #64748b; margin-left: 0.5rem;">(Lines shown on official APEXS voucher slip)</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="addPaymentVoucherItemRow()">+ Add Row</button>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;" id="pv-items-table">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; background: #f8fafc; text-align: left;">
              <th style="padding: 6px 8px; width: 22%;">Invoice / Ref No</th>
              <th style="padding: 6px 8px; width: 48%;">Account / Description *</th>
              <th style="padding: 6px 8px; width: 22%; text-align: right;">Amount (<span class="pv-cur-symbol">₱</span>) *</th>
              <th style="padding: 6px 8px; width: 8%; text-align: center;"></th>
            </tr>
          </thead>
          <tbody id="pv-items-tbody">
            <!-- Dynamic rows rendered here -->
          </tbody>
          <tfoot>
            <tr style="border-top: 2px solid #0f172a; font-weight: 700;">
              <td colspan="2" style="padding: 8px; text-align: right;">Total Voucher Amount:</td>
              <td style="padding: 8px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; color: #dc2626;" id="pv-total-display">
                ₱ 0.00
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Accounting Ledger Allocations -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 1rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="color: #dc2626; font-weight: 600;">Debit Account (Expense / AP) *</label>
          <select id="pv-exp-acc" class="form-input" required>
            \${accountOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="color: #059669; font-weight: 600;">Credit Account (Cash / Bank) *</label>
          <select id="pv-pay-acc" class="form-input" required>
            \${accountOptions}
          </select>
        </div>
      </div>

      <!-- Settlement Method & Memo -->
      <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 0.85rem; margin-bottom: 1rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Payment Method</label>
          <select id="pv-payment-method" class="form-input">
            \${methodOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Payment Memo / Remark</label>
          <input type="text" id="pv-notes" class="form-input" placeholder="e.g. (KENNETH S BROWN CORP. CREDIT CARD PAYMENT)" />
        </div>
      </div>

      <!-- Signatories Section -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.9rem;">
        <div style="font-weight: 700; font-size: 0.82rem; color: #475569; margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em;">
          Signatories & Approvals (Official APEXS Sign-off)
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.75rem;">Prepared by:</label>
            <input type="text" id="pv-sig-prepared" class="form-input" value="\${prepVal}" style="font-size: 0.82rem;" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.75rem;">Certified Correct by:</label>
            <input type="text" id="pv-sig-certified" class="form-input" value="\${certVal}" style="font-size: 0.82rem;" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.75rem;">Approved by:</label>
            <input type="text" id="pv-sig-approved" class="form-input" value="\${appVal}" style="font-size: 0.82rem;" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.75rem;">Received Payment:</label>
            <input type="text" id="pv-sig-received" class="form-input" value="\${recVal}" style="font-size: 0.82rem;" />
          </div>
        </div>
      </div>
    </form>
  \`;

  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-pv').requestSubmit()">Post Payment Voucher</button>
  \`;

  openModal('Create Payment Voucher (PV)', body, footer, 'xl');

  // Add initial item row & set intelligent defaults
  setTimeout(() => {
    addPaymentVoucherItemRow('', '', '');
    const expSelect = document.getElementById('pv-exp-acc');
    const paySelect = document.getElementById('pv-pay-acc');
    if (expSelect) expSelect.value = defaultExp;
    if (paySelect) paySelect.value = defaultCash;
  }, 50);
}

function addPaymentVoucherItemRow(inv = '', desc = '', amt = '') {
  const tbody = document.getElementById('pv-items-tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'pv-item-row';
  tr.innerHTML = \`
    <td style="padding: 4px;">
      <input type="text" class="form-input pv-item-inv" value="\${inv}" placeholder="e.g. Lazada / PO #" style="font-size: 0.82rem; padding: 0.35rem 0.5rem;" />
    </td>
    <td style="padding: 4px;">
      <input type="text" class="form-input pv-item-desc" value="\${desc}" placeholder="Description / Purpose of disbursement" required style="font-size: 0.82rem; padding: 0.35rem 0.5rem;" />
    </td>
    <td style="padding: 4px;">
      <input type="number" step="0.01" min="0" class="form-input pv-item-amt" value="\${amt}" placeholder="0.00" oninput="calcPaymentVoucherTotal()" required style="font-size: 0.82rem; padding: 0.35rem 0.5rem; text-align: right;" />
    </td>
    <td style="padding: 4px; text-align: center;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="removePaymentVoucherItemRow(this)" style="padding: 0.25rem 0.5rem; color: #dc2626;" title="Remove row">✕</button>
    </td>
  \`;
  tbody.appendChild(tr);
  calcPaymentVoucherTotal();
}

function removePaymentVoucherItemRow(btn) {
  const tbody = document.getElementById('pv-items-tbody');
  const row = btn.closest('tr');
  if (tbody && tbody.children.length > 1) {
    row.remove();
    calcPaymentVoucherTotal();
  } else {
    showToast('At least one line item is required', 'warning');
  }
}

function updatePaymentVoucherCurrency() {
  const cur = document.getElementById('pv-currency')?.value || 'PHP';
  const sym = cur === 'USD' ? '$' : '₱';
  document.querySelectorAll('.pv-cur-symbol').forEach((el) => {
    el.innerText = sym;
  });
  calcPaymentVoucherTotal();
}

function calcPaymentVoucherTotal() {
  const cur = document.getElementById('pv-currency')?.value || 'PHP';
  const sym = cur === 'USD' ? '$' : '₱';
  let totalCents = 0;

  document.querySelectorAll('.pv-item-amt').forEach((input) => {
    const val = parseFloat(input.value) || 0;
    totalCents += Math.round(val * 100);
  });

  const totalDisplay = document.getElementById('pv-total-display');
  if (totalDisplay) {
    totalDisplay.innerText = sym + ' ' + (totalCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

async function submitNewPaymentVoucher(e) {
  e.preventDefault();
  const recipientName = document.getElementById('pv-recipient-name').value.trim();
  const recipientType = document.getElementById('pv-recipient-type').value;
  const currency = document.getElementById('pv-currency').value;
  const voucherDate = document.getElementById('pv-date').value;
  const voucherNumber = document.getElementById('pv-voucher-number').value.trim();
  const paymentMethod = document.getElementById('pv-payment-method').value;
  const expenseAccountCode = document.getElementById('pv-exp-acc').value;
  const paymentAccountCode = document.getElementById('pv-pay-acc').value;
  const notes = document.getElementById('pv-notes').value.trim();

  const signatories = {
    preparedBy: document.getElementById('pv-sig-prepared').value.trim(),
    certifiedBy: document.getElementById('pv-sig-certified').value.trim(),
    approvedBy: document.getElementById('pv-sig-approved').value.trim(),
    receivedBy: document.getElementById('pv-sig-received').value.trim(),
  };

  const rows = document.querySelectorAll('#pv-items-tbody tr.pv-item-row');
  const items = [];
  let totalCents = 0;

  rows.forEach((row) => {
    const invoiceNo = row.querySelector('.pv-item-inv')?.value.trim() || '';
    const description = row.querySelector('.pv-item-desc')?.value.trim() || '';
    const amtVal = parseFloat(row.querySelector('.pv-item-amt')?.value) || 0;
    const amountCents = Math.round(amtVal * 100);

    if (description || amountCents > 0) {
      items.push({ invoiceNo, description, currency, amountCents });
      totalCents += amountCents;
    }
  });

  if (items.length === 0 || totalCents <= 0) {
    showToast('Please add at least one line item with a valid amount', 'warning');
    return;
  }

  try {
    const res = await apiFetch('/api/accounting/vouchers/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voucherNumber: voucherNumber || undefined,
        voucherDate: voucherDate ? new Date(voucherDate).toISOString() : undefined,
        recipientName,
        recipientType,
        currency,
        amountCents: totalCents,
        items,
        signatories,
        paymentMethod,
        expenseAccountCode,
        paymentAccountCode,
        notes: notes || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to post payment voucher');

    closeModal();
    showToast(\`Payment Voucher \${json.voucherNumber} posted successfully\`, 'success');
    loadAccounting();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openNewReceiptVoucherModal() {
  const accountOptions = cachedAccounts.map((a) => \`<option value="\${a.code}">\${a.code} - \${a.name} (\${a.type})</option>\`).join('');

  const body = \`
    <form id="form-new-rv" onsubmit="submitNewReceiptVoucher(event)">
      <div class="form-group">
        <label class="form-label">Payer / Customer Name *</label>
        <input type="text" id="rv-payer-name" class="form-input" placeholder="e.g. Apex Global Industries or Client Deposit" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label class="form-label">Receipt Amount ($) *</label>
          <input type="number" step="0.01" min="0.01" id="rv-amount" class="form-input" placeholder="0.00" required />
        </div>
        <div class="form-group">
          <label class="form-label">Payment Method *</label>
          <select id="rv-payment-method" class="form-input">
            <option value="BANK_TRANSFER">Bank Wire / ACH</option>
            <option value="CHECK">Client Check</option>
            <option value="CASH">Cash Deposit</option>
            <option value="ONLINE">Credit Card / Online</option>
          </select>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.9rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="color: #059669; font-weight: 600;">Debit Account (Cash / Bank In) *</label>
          <select id="rv-dep-acc" class="form-input" required>
            \${accountOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="color: #1d4ed8; font-weight: 600;">Credit Account (Revenue / AR) *</label>
          <select id="rv-crd-acc" class="form-input" required>
            \${accountOptions}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Memo / Reference</label>
        <input type="text" id="rv-notes" class="form-input" placeholder="e.g. Advance retainer for Q3 engineering" />
      </div>
    </form>
  \`;

  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-rv').requestSubmit()">Post Receipt Voucher</button>
  \`;

  openModal('Create Receipt Voucher (RV)', body, footer);

  setTimeout(() => {
    const depSelect = document.getElementById('rv-dep-acc');
    const crdSelect = document.getElementById('rv-crd-acc');
    if (depSelect) depSelect.value = '1010'; // Cash / Bank
    if (crdSelect) crdSelect.value = '4010'; // Sales Revenue
  }, 50);
}

async function submitNewReceiptVoucher(e) {
  e.preventDefault();
  const payerName = document.getElementById('rv-payer-name').value;
  const paymentMethod = document.getElementById('rv-payment-method').value;
  const amountDollars = parseFloat(document.getElementById('rv-amount').value) || 0;
  const amountCents = Math.round(amountDollars * 100);
  const depositAccountCode = document.getElementById('rv-dep-acc').value;
  const creditAccountCode = document.getElementById('rv-crd-acc').value;
  const notes = document.getElementById('rv-notes').value;

  if (amountCents <= 0) {
    showToast('Amount must be greater than zero', 'warning');
    return;
  }

  try {
    const res = await apiFetch('/api/accounting/vouchers/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payerName,
        paymentMethod,
        amountCents,
        depositAccountCode,
        creditAccountCode,
        notes,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to post receipt voucher');

    closeModal();
    showToast(\`Receipt Voucher \${json.voucherNumber} posted successfully\`, 'success');
    loadAccounting();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openNewContraModal() {
  const accountOptions = cachedAccounts.map((a) => \`<option value="\${a.code}">\${a.code} - \${a.name} (\${a.type})</option>\`).join('');

  const body = \`
    <form id="form-new-cv" onsubmit="submitNewContraVoucher(event)">
      <div class="form-group">
        <label class="form-label">Transfer Description / Reason *</label>
        <input type="text" id="cv-desc" class="form-input" placeholder="e.g. Cash withdrawal for petty cash replenish" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label class="form-label">From Account (Credit / Out) *</label>
          <select id="cv-from-acc" class="form-input" required>
            \${accountOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">To Account (Debit / In) *</label>
          <select id="cv-to-acc" class="form-input" required>
            \${accountOptions}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Transfer Amount ($) *</label>
        <input type="number" step="0.01" min="0.01" id="cv-amount" class="form-input" placeholder="0.00" required />
      </div>
    </form>
  \`;

  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-cv').requestSubmit()">Post Contra Transfer</button>
  \`;

  openModal('Post Contra Voucher (Inter-Account Transfer)', body, footer);
}

async function submitNewContraVoucher(e) {
  e.preventDefault();
  const description = document.getElementById('cv-desc').value;
  const fromAccountCode = document.getElementById('cv-from-acc').value;
  const toAccountCode = document.getElementById('cv-to-acc').value;
  const amountDollars = parseFloat(document.getElementById('cv-amount').value) || 0;
  const amountCents = Math.round(amountDollars * 100);

  if (fromAccountCode === toAccountCode) {
    showToast('Source and Destination accounts must be different', 'warning');
    return;
  }
  if (amountCents <= 0) {
    showToast('Amount must be greater than zero', 'warning');
    return;
  }

  try {
    const res = await apiFetch('/api/accounting/vouchers/contra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        fromAccountCode,
        toAccountCode,
        amountCents,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to post contra voucher');

    closeModal();
    showToast(\`Contra Voucher \${json.voucherNumber} posted successfully\`, 'success');
    loadAccounting();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openNewJVModal() {
  const accountOptions = cachedAccounts.map((a) => \`<option value="\${a.code}">\${a.code} - \${a.name} (\${a.type})</option>\`).join('');

  const body = \`
    <form id="form-new-jv" onsubmit="submitNewJV(event)">
      <div class="form-group">
        <label class="form-label">Description / Memo *</label>
        <input type="text" id="jv-desc" class="form-input" placeholder="e.g. Month-end depreciation adjustment" required />
      </div>

      <div style="background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.9rem;">
        <div style="font-weight: 600; margin-bottom: 0.4rem; font-size: 0.8rem; color: #059669;">Line 1 (Debit Entry)</div>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem;">
          <select id="jv-acc1" class="form-input" required>\${accountOptions}</select>
          <input type="number" step="0.01" min="0.01" id="jv-deb1" class="form-input" placeholder="Debit ($)" value="500.00" oninput="updateJVBalanceSummary()" required />
        </div>
      </div>

      <div style="background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.9rem;">
        <div style="font-weight: 600; margin-bottom: 0.4rem; font-size: 0.8rem; color: #dc2626;">Line 2 (Credit Entry)</div>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem;">
          <select id="jv-acc2" class="form-input" required>\${accountOptions}</select>
          <input type="number" step="0.01" min="0.01" id="jv-crd2" class="form-input" placeholder="Credit ($)" value="500.00" oninput="updateJVBalanceSummary()" required />
        </div>
      </div>

      <!-- Live Double-Entry Running Balance Indicator -->
      <div id="jv-balance-indicator" style="padding: 0.75rem; border-radius: 6px; background: #ecfdf5; border: 1px solid #a7f3d0; font-size: 0.85rem; color: #065f46; display: flex; justify-content: space-between; align-items: center;">
        <span><strong>Balance Status:</strong> Perfectly Balanced</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">$500.00 / $500.00</span>
      </div>
    </form>
  \`;

  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-jv').requestSubmit()">Post Journal Voucher</button>
  \`;

  openModal('Create Balanced Journal Voucher (JV)', body, footer);

  setTimeout(() => {
    const acc1 = document.getElementById('jv-acc1');
    const acc2 = document.getElementById('jv-acc2');
    if (acc1) acc1.value = '5020';
    if (acc2) acc2.value = '1010';
  }, 50);
}

function updateJVBalanceSummary() {
  const deb = parseFloat(document.getElementById('jv-deb1')?.value) || 0;
  const crd = parseFloat(document.getElementById('jv-crd2')?.value) || 0;
  const indicator = document.getElementById('jv-balance-indicator');
  if (!indicator) return;

  const isBal = Math.abs(deb - crd) < 0.001 && deb > 0;
  if (isBal) {
    indicator.style.background = '#ecfdf5';
    indicator.style.borderColor = '#a7f3d0';
    indicator.style.color = '#065f46';
    indicator.innerHTML = \`<span><strong>Balance Status:</strong> Perfectly Balanced</span><span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">$\${deb.toFixed(2)} / $\${crd.toFixed(2)}</span>\`;
  } else {
    indicator.style.background = '#fef2f2';
    indicator.style.borderColor = '#fecaca';
    indicator.style.color = '#991b1b';
    indicator.innerHTML = \`<span><strong>Double-Entry Imbalance:</strong> Delta $\${Math.abs(deb - crd).toFixed(2)}</span><span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">$\${deb.toFixed(2)} vs $\${crd.toFixed(2)}</span>\`;
  }
}

async function submitNewJV(e) {
  e.preventDefault();
  const desc = document.getElementById('jv-desc').value;
  const acc1 = document.getElementById('jv-acc1').value;
  const deb1 = Math.round((parseFloat(document.getElementById('jv-deb1').value) || 0) * 100);
  const acc2 = document.getElementById('jv-acc2').value;
  const crd2 = Math.round((parseFloat(document.getElementById('jv-crd2').value) || 0) * 100);

  if (deb1 !== crd2) {
    showToast('Debit and Credit entries must be equal for double-entry validity', 'danger');
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
    showToast('Journal Voucher ' + json.jvNumber + ' posted successfully', 'success');
    loadAccounting();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

/* ========================================================================== */
/* OFFICIAL VOUCHER SLIP PREVIEW & SIGN-OFF                                   */
/* ========================================================================== */

function openVoucherSlipModal(voucherId) {
  const v = cachedVouchers.find((x) => x.id === voucherId);
  if (!v) {
    showToast('Voucher not found', 'warning');
    return;
  }

  if (typeof setUrlParam === 'function') {
    setUrlParam('slip', voucherId);
  }

  const cur = v.currency || 'PHP';
  const curSymbol = cur === 'USD' ? '$' : '₱';
  const curLabel = cur === 'USD' ? 'USD' : 'Php';
  const rawDate = v.voucherDate || v.createdAt;
  const formattedDate = new Date(rawDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const defaultSign = (window.cachedVoucherSettings && window.cachedVoucherSettings['vouchers.signatories']) || {};
  const sig = v.signatories || {
    preparedBy: defaultSign.preparedBy || 'Administrator',
    certifiedBy: defaultSign.certifiedBy || 'Joy/Admin',
    approvedBy: defaultSign.approvedBy || 'Kenneth Brown/CEO',
    receivedBy: defaultSign.receivedBy || 'Signature over printed name/Date',
  };

  let items = v.items || [];
  if (!items || items.length === 0) {
    items = [
      {
        invoiceNo: v.referenceId || '',
        description: v.notes || (v.recipient + ' disbursement'),
        currency: cur,
        amountCents: v.amountCents,
      },
    ];
  }

  const itemRowsHtml = items
    .map(
      (it) => \`
      <tr style="height: 26px;">
        <td style="border: 1px solid #000000; padding: 4px 8px; font-size: 0.88rem; font-family: 'Inter', sans-serif;">\${it.invoiceNo || ''}</td>
        <td style="border: 1px solid #000000; padding: 4px 8px; font-size: 0.88rem; font-family: 'Inter', sans-serif;">\${it.description || ''}</td>
        <td style="border: 1px solid #000000; padding: 4px 8px; text-align: center; font-size: 0.88rem; font-weight: 600;">\${curSymbol}</td>
        <td style="border: 1px solid #000000; padding: 4px 8px; text-align: right; font-size: 0.88rem; font-family: 'JetBrains Mono', monospace;">
          \${(it.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>
    \`
    )
    .join('');

  // End delimiter row
  const delimiterRowHtml = \`
    <tr style="height: 24px;">
      <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
      <td style="border: 1px solid #000000; padding: 3px 8px; text-align: center; font-size: 0.82rem; font-style: italic; color: #1e293b;">-- End Nothing else --</td>
      <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
      <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
    </tr>
  \`;

  // Payment remarks row (e.g. Kenneth S Brown Corp Credit Card Payment)
  const remarks = v.notes ? \`(\${v.notes.toUpperCase()})\` : v.paymentMethod === 'CREDIT_CARD' ? '(CORPORATE CREDIT CARD PAYMENT)' : '';
  const remarksRowHtml = remarks
    ? \`
    <tr style="height: 24px;">
      <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
      <td style="border: 1px solid #000000; padding: 3px 8px; text-align: center; font-size: 0.8rem; font-weight: 700; color: #000000;">\${remarks}</td>
      <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
      <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
    </tr>
  \`
    : '';

  // Standard blank rows to maintain official paper pad height
  const renderedCount = items.length + 1 + (remarks ? 1 : 0);
  const fillerCount = Math.max(0, 6 - renderedCount);
  let fillerRowsHtml = '';
  for (let i = 0; i < fillerCount; i++) {
    fillerRowsHtml += \`
      <tr style="height: 24px;">
        <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
        <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
        <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
        <td style="border: 1px solid #000000; padding: 3px 8px;"></td>
      </tr>
    \`;
  }

  const totalFormatted = (v.amountCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const body = \`
    <div class="official-voucher-sheet" style="background: #ffffff; color: #000000; padding: 2rem; font-family: 'Inter', Arial, sans-serif; border: 1px solid #e2e8f0; border-radius: 4px; max-width: 840px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      
      <!-- APEXS Header with Pyramid Brand -->
      <div style="display: flex; justify-content: center; align-items: center; gap: 1.25rem; margin-bottom: 0.6rem;">
        <!-- Clean Vector SVG APEXS 3D Pyramid Logo -->
        <svg width="78" height="58" viewBox="0 0 100 75" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
          <polygon points="50,4 6,66 94,66" fill="url(#pyrGrad1)" stroke="#14532d" stroke-width="1.5" />
          <line x1="50" y1="4" x2="50" y2="66" stroke="#166534" stroke-width="1.2" />
          <line x1="42" y1="16" x2="58" y2="16" stroke="#15803d" stroke-width="1" />
          <line x1="34" y1="28" x2="66" y2="28" stroke="#15803d" stroke-width="1" />
          <line x1="26" y1="40" x2="74" y2="40" stroke="#15803d" stroke-width="1" />
          <line x1="17" y1="52" x2="83" y2="52" stroke="#15803d" stroke-width="1" />
          <line x1="46" y1="16" x2="43" y2="28" stroke="#166534" stroke-width="0.75" />
          <line x1="54" y1="16" x2="57" y2="28" stroke="#166534" stroke-width="0.75" />
          <line x1="38" y1="28" x2="35" y2="40" stroke="#166534" stroke-width="0.75" />
          <line x1="62" y1="28" x2="65" y2="40" stroke="#166534" stroke-width="0.75" />
          <line x1="30" y1="40" x2="26" y2="52" stroke="#166534" stroke-width="0.75" />
          <line x1="70" y1="40" x2="74" y2="52" stroke="#166534" stroke-width="0.75" />
          <line x1="21" y1="52" x2="16" y2="66" stroke="#166534" stroke-width="0.75" />
          <line x1="79" y1="52" x2="84" y2="66" stroke="#166534" stroke-width="0.75" />
          <rect x="24" y="44" width="52" height="15" rx="2" fill="#0f172a" fill-opacity="0.85" />
          <text x="50" y="55" font-family="'Arial Black', Impact, sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">APEXS</text>
          <defs>
            <linearGradient id="pyrGrad1" x1="50" y1="4" x2="50" y2="66" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#86efac" />
              <stop offset="50%" stop-color="#22c55e" />
              <stop offset="100%" stop-color="#15803d" />
            </linearGradient>
          </defs>
        </svg>

        <div>
          <div style="font-size: 1.45rem; font-weight: 900; color: #b91c1c; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px; line-height: 1.1;">APEXS, INC.</div>
          <div style="font-size: 0.85rem; font-weight: 700; font-style: italic; color: #000000; line-height: 1.2;">Applied Expert Systems & Software, Inc.</div>
          <div style="font-size: 0.82rem; font-style: italic; color: #2563eb; font-weight: 500; font-family: 'Georgia', serif;">We put technology to work for you</div>
        </div>
      </div>

      <!-- Address & Contact -->
      <div style="text-align: center; font-size: 0.78rem; font-weight: 600; color: #1e293b; margin-bottom: 1.25rem;">
        <div>Suite 714 EGI City by the Sea, Maribago, Lapu-Lapu City 6015</div>
        <div>Telefax# 495-2106</div>
      </div>

      <!-- Top Right Voucher Number & Metadata Rows -->
      <div style="display: flex; justify-content: flex-end; align-items: baseline; margin-bottom: 0.5rem;">
        <div style="font-weight: 700; font-size: 0.95rem; margin-right: 0.5rem;">No.</div>
        <div style="border-bottom: 1.5px solid #000000; min-width: 190px; text-align: center; font-weight: 800; font-size: 1.05rem; font-family: 'JetBrains Mono', Arial, monospace;">
          \${v.voucherNumber}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem;">
        <div style="display: flex; align-items: baseline; flex: 1; max-width: 65%;">
          <span style="font-weight: 700; font-size: 0.9rem; margin-right: 0.5rem; white-space: nowrap;">Pay to:</span>
          <span style="border-bottom: 1.5px solid #000000; flex: 1; font-weight: 700; font-size: 0.95rem; text-transform: uppercase; padding-left: 0.25rem;">
            \${v.recipient || v.recipientName || '-'}
          </span>
        </div>
        <div style="border-bottom: 1.5px solid #000000; min-width: 190px; text-align: center; font-weight: 700; font-size: 0.9rem;">
          \${formattedDate}
        </div>
      </div>

      <!-- Official Voucher Line Items Grid -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000000; margin-bottom: 2rem;">
        <thead>
          <tr style="background: #ffffff; border-bottom: 1.5px solid #000000; height: 30px;">
            <th style="border: 1px solid #000000; width: 20%; padding: 4px 8px; font-weight: 700; font-size: 0.88rem; text-align: center;">Invoice No</th>
            <th style="border: 1px solid #000000; width: 54%; padding: 4px 8px; font-weight: 700; font-size: 0.88rem; text-align: center;">Account/Description</th>
            <th style="border: 1px solid #000000; width: 6%; padding: 4px 8px; font-weight: 700; font-size: 0.88rem; text-align: center;">₱</th>
            <th style="border: 1px solid #000000; width: 20%; padding: 4px 8px; font-weight: 700; font-size: 0.88rem; text-align: center;">Amount</th>
          </tr>
        </thead>
        <tbody>
          \${itemRowsHtml}
          \${delimiterRowHtml}
          \${remarksRowHtml}
          \${fillerRowsHtml}
          <!-- Total Summary Row -->
          <tr style="height: 30px; font-weight: 700; border-top: 1.5px solid #000000;">
            <td colspan="2" style="border: 1px solid #000000; border-right: none; padding: 4px 8px;"></td>
            <td style="border: 1px solid #000000; border-left: 1px solid #000000; padding: 4px 8px; text-align: center; font-size: 0.92rem;">\${curLabel}</td>
            <td style="border: 1px solid #000000; padding: 4px 8px; text-align: right; font-size: 0.95rem; font-family: 'JetBrains Mono', monospace;">\${totalFormatted}</td>
          </tr>
        </tbody>
      </table>

      <!-- 4-Column Official Signatories & Audit Section -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 1.5rem; text-align: left; font-size: 0.78rem;">
        <!-- Column 1: Prepared by -->
        <div>
          <div style="font-size: 0.75rem; color: #1e293b; margin-bottom: 0.25rem;">Prepared by:</div>
          <div style="height: 38px; border-bottom: 1.5px solid #000000; margin-bottom: 0.35rem;"></div>
          <div style="font-weight: 700; text-align: center; font-size: 0.8rem; color: #000000;">\${sig.preparedBy || 'Administrator'}</div>
        </div>

        <!-- Column 2: Certified Correct by -->
        <div>
          <div style="font-size: 0.75rem; color: #1e293b; margin-bottom: 0.25rem;">Certified Correct by:</div>
          <div style="height: 38px; border-bottom: 1.5px solid #000000; margin-bottom: 0.35rem;"></div>
          <div style="font-weight: 700; text-align: center; font-size: 0.8rem; color: #000000;">\${sig.certifiedBy || 'Joy/Admin'}</div>
        </div>

        <!-- Column 3: Approved by -->
        <div>
          <div style="font-size: 0.75rem; color: #1e293b; margin-bottom: 0.25rem;">Approved by:</div>
          <div style="height: 38px; border-bottom: 1.5px solid #000000; margin-bottom: 0.35rem;"></div>
          <div style="font-weight: 700; text-align: center; font-size: 0.8rem; color: #000000;">\${sig.approvedBy || 'Kenneth Brown/CEO'}</div>
        </div>

        <!-- Column 4: Received Payment -->
        <div>
          <div style="font-size: 0.75rem; color: #1e293b; margin-bottom: 0.25rem;">Received Payment:</div>
          <div style="height: 38px; border-bottom: 1.5px solid #000000; margin-bottom: 0.35rem;"></div>
          <div style="font-size: 0.7rem; text-align: center; color: #334155;">\${sig.receivedBy || 'Signature over printed name/Date'}</div>
        </div>
      </div>

      <!-- Bottom Heavy Border Bar -->
      <div style="border-top: 3.5px solid #000000; margin-top: 1.5rem; width: 100%;"></div>
    </div>
  \`;

  const footer = \`
    <button class="btn btn-secondary" onclick="window.print()">🖨️ Print Official Voucher</button>
    <button class="btn btn-primary" onclick="closeModal()">Close</button>
  \`;

  openModal(\`Official Voucher Slip — \${v.voucherNumber}\`, body, footer, 'xl');
}
`;
