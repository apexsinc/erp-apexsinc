export function renderAccountingView(): string {
  return `<div id="view-accounting" class="tab-view" style="display: none;"></div>`;
}

export const ACCOUNTING_CLIENT_JS = `
let accountingActiveTab = 'vouchers-rv';
let cachedAccounts = [];
let cachedVouchers = [];
let cachedLedgerEntries = [];
let cachedVendors = [];
let cachedEmployees = [];
let cachedCustomers = [];
let cachedProfitLoss = null;
let cachedBalanceSheet = null;
let cachedCashFlow = null;
let voucherSearchQuery = '';
let voucherYearFilter = '2026';

function getVoucherYear(v) {
  if (!v) return '2026';
  const rawDate = v.voucherDate || v.createdAt;
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return d.getFullYear().toString();
    }
  }
  if (v.voucherNumber) {
    const match = v.voucherNumber.match(/^(\d{2})-/);
    if (match) {
      return '20' + match[1];
    }
    const match4 = v.voucherNumber.match(/(20\d{2})/);
    if (match4) {
      return match4[1];
    }
  }
  return '2026';
}

async function loadAccounting() {
  const container = document.getElementById('view-accounting');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading vouchers, ledger & financial reports...</div>');

  try {
    const urlTab = typeof getUrlParam === 'function' ? getUrlParam('tab') : null;
    if (urlTab) accountingActiveTab = urlTab;
    voucherSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';
    voucherYearFilter = (typeof getUrlParam === 'function' ? getUrlParam('year') : null) || '2026';

    const [tbRes, ledgerRes, vouchersRes, accountsRes, settingsRes, plRes, bsRes, cfRes, vendorsRes, empRes, custRes] = await Promise.all([
      apiFetch('/api/accounting/trial-balance'),
      apiFetch('/api/accounting/ledger'),
      apiFetch('/api/accounting/vouchers'),
      apiFetch('/api/accounting/accounts'),
      apiFetch('/api/settings/vouchers').catch(() => null),
      apiFetch('/api/accounting/reports/profit-loss').catch(() => null),
      apiFetch('/api/accounting/reports/balance-sheet').catch(() => null),
      apiFetch('/api/accounting/reports/cash-flow').catch(() => null),
      apiFetch('/api/purchasing/vendors').catch(() => null),
      apiFetch('/api/payroll/employees').catch(() => null),
      apiFetch('/api/sales/customers').catch(() => null),
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
    if (plRes) {
      try {
        cachedProfitLoss = await plRes.json();
      } catch (e) {}
    }
    if (bsRes) {
      try {
        cachedBalanceSheet = await bsRes.json();
      } catch (e) {}
    }
    if (cfRes) {
      try {
        cachedCashFlow = await cfRes.json();
      } catch (e) {}
    }
    if (vendorsRes) {
      try {
        const vj = await vendorsRes.json();
        cachedVendors = vj.data || [];
      } catch (e) {}
    }
    if (empRes) {
      try {
        const ej = await empRes.json();
        cachedEmployees = ej.data || [];
      } catch (e) {}
    }
    if (custRes) {
      try {
        const cj = await custRes.json();
        cachedCustomers = cj.data || [];
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

function handleVoucherYearFilter(year) {
  voucherYearFilter = year;
  if (typeof setUrlParam === 'function') {
    setUrlParam('year', voucherYearFilter === '2026' ? null : voucherYearFilter);
  }
  const container = document.getElementById('view-accounting');
  if (container && state.trialBalance) {
    renderAccountingContent(container, state.trialBalance, state.trialBalance.accounts || [], cachedLedgerEntries, cachedVouchers, cachedAccounts);
  }
}

function exportVouchersCsv() {
  const headers = ['Voucher #', 'Date', 'Type', 'Payee / Recipient', 'Tag / Category', 'Remarks', 'Payment Method', 'Currency', 'Amount', 'Status'];
  let list = cachedVouchers || [];
  if (voucherYearFilter && voucherYearFilter !== 'ALL') {
    list = list.filter((v) => getVoucherYear(v) === voucherYearFilter);
  }
  const rows = list.map((v) => [
    v.voucherNumber,
    new Date(v.voucherDate || v.createdAt).toISOString().slice(0, 10),
    v.voucherType,
    v.recipient || v.recipientName || '',
    v.tag || (v.referenceType !== 'MANUAL' ? v.referenceType : '') || '',
    v.notes || '',
    v.paymentMethod || 'STANDARD',
    v.currency || 'PHP',
    (v.amountCents / 100).toFixed(2),
    v.status || 'POSTED',
  ]);
  const yrSuffix = voucherYearFilter && voucherYearFilter !== 'ALL' ? '_' + voucherYearFilter : '';
  exportToCsv('vouchers_export' + yrSuffix + '_' + new Date().toISOString().slice(0, 10), headers, rows);
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

function exportProfitLossCsv() {
  if (!cachedProfitLoss) {
    showToast('P&L report is not loaded yet', 'error');
    return;
  }
  const pl = cachedProfitLoss;
  const headers = ['Category', 'Account Code', 'Account Name', 'Amount (PHP)', '% of Revenue'];
  const rows = [];

  rows.push(['OPERATING REVENUES', '', '', '', '']);
  (pl.revenues || []).forEach((r) => {
    const pct = pl.totalRevenueCents > 0 ? ((r.amountCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%';
    rows.push(['Revenue', r.code, r.name, (r.amountCents / 100).toFixed(2), pct]);
  });
  rows.push(['TOTAL OPERATING REVENUE', '', '', (pl.totalRevenueCents / 100).toFixed(2), '100.00%']);

  rows.push(['COST OF GOODS SOLD', '', '', '', '']);
  (pl.cogs || []).forEach((c) => {
    const pct = pl.totalRevenueCents > 0 ? ((c.amountCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%';
    rows.push(['COGS', c.code, c.name, (c.amountCents / 100).toFixed(2), pct]);
  });
  rows.push(['TOTAL COST OF GOODS SOLD', '', '', (pl.totalCogsCents / 100).toFixed(2), pl.totalRevenueCents > 0 ? ((pl.totalCogsCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%']);
  rows.push(['GROSS PROFIT', '', '', (pl.grossProfitCents / 100).toFixed(2), pl.grossMarginPct + '%']);

  rows.push(['OPERATING EXPENSES (OPEX)', '', '', '', '']);
  (pl.operatingExpenses || []).forEach((o) => {
    const pct = pl.totalRevenueCents > 0 ? ((o.amountCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%';
    rows.push(['Operating Expense', o.code, o.name, (o.amountCents / 100).toFixed(2), pct]);
  });
  rows.push(['TOTAL OPERATING EXPENSES', '', '', (pl.totalOpexCents / 100).toFixed(2), pl.totalRevenueCents > 0 ? ((pl.totalOpexCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%']);
  rows.push(['NET INCOME / (LOSS)', '', '', (pl.netIncomeCents / 100).toFixed(2), pl.netMarginPct + '%']);

  exportToCsv('profit_and_loss_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function exportBalanceSheetCsv() {
  if (!cachedBalanceSheet) {
    showToast('Balance sheet is not loaded yet', 'error');
    return;
  }
  const bs = cachedBalanceSheet;
  const headers = ['Category', 'Account Code', 'Account Name', 'Amount (PHP)'];
  const rows = [];

  rows.push(['CURRENT ASSETS', '', '', '']);
  (bs.assets?.current || []).forEach((a) => rows.push(['Current Asset', a.code, a.name, (a.amountCents / 100).toFixed(2)]));
  rows.push(['NON-CURRENT ASSETS', '', '', '']);
  (bs.assets?.nonCurrent || []).forEach((a) => rows.push(['Non-Current Asset', a.code, a.name, (a.amountCents / 100).toFixed(2)]));
  rows.push(['TOTAL ASSETS', '', '', (bs.totalAssetsCents / 100).toFixed(2)]);

  rows.push(['CURRENT LIABILITIES', '', '', '']);
  (bs.liabilities?.current || []).forEach((l) => rows.push(['Current Liability', l.code, l.name, (l.amountCents / 100).toFixed(2)]));
  rows.push(['NON-CURRENT LIABILITIES', '', '', '']);
  (bs.liabilities?.nonCurrent || []).forEach((l) => rows.push(['Non-Current Liability', l.code, l.name, (l.amountCents / 100).toFixed(2)]));
  rows.push(['TOTAL LIABILITIES', '', '', (bs.liabilities?.totalLiabilitiesCents / 100).toFixed(2)]);

  rows.push(['EQUITY', '', '', '']);
  (bs.equity?.items || []).forEach((e) => rows.push(['Equity', e.code, e.name, (e.amountCents / 100).toFixed(2)]));
  rows.push(['Current Period Net Income', '', '', (bs.equity?.currentPeriodNetIncomeCents / 100).toFixed(2)]);
  rows.push(['TOTAL EQUITY', '', '', (bs.equity?.totalEquityCents / 100).toFixed(2)]);
  rows.push(['TOTAL LIABILITIES & EQUITY', '', '', (bs.totalLiabilitiesAndEquityCents / 100).toFixed(2)]);

  exportToCsv('balance_sheet_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function exportCashFlowCsv() {
  if (!cachedCashFlow) {
    showToast('Cash flow report is not loaded yet', 'error');
    return;
  }
  const cf = cachedCashFlow;
  const headers = ['Section', 'Description', 'Date', 'Amount (PHP)'];
  const rows = [];

  rows.push(['OPERATING INFLOWS', '', '', '']);
  (cf.operatingActivities?.inflows || []).forEach((i) => rows.push(['Operating Inflow', i.description, new Date(i.date).toISOString().slice(0, 10), (i.amountCents / 100).toFixed(2)]));
  rows.push(['OPERATING OUTFLOWS', '', '', '']);
  (cf.operatingActivities?.outflows || []).forEach((o) => rows.push(['Operating Outflow', o.description, new Date(o.date).toISOString().slice(0, 10), (o.amountCents / 100).toFixed(2)]));
  rows.push(['NET OPERATING CASH FLOW', '', '', (cf.operatingActivities?.netOperatingCashCents / 100).toFixed(2)]);

  rows.push(['INVESTING ACTIVITIES', '', '', '']);
  (cf.investingActivities?.items || []).forEach((i) => rows.push(['Investing Activity', i.description, new Date(i.date).toISOString().slice(0, 10), (i.amountCents / 100).toFixed(2)]));
  rows.push(['NET INVESTING CASH FLOW', '', '', (cf.investingActivities?.netInvestingCashCents / 100).toFixed(2)]);

  rows.push(['FINANCING ACTIVITIES', '', '', '']);
  (cf.financingActivities?.items || []).forEach((f) => rows.push(['Financing Activity', f.description, new Date(f.date).toISOString().slice(0, 10), (f.amountCents / 100).toFixed(2)]));
  rows.push(['NET FINANCING CASH FLOW', '', '', (cf.financingActivities?.netFinancingCashCents / 100).toFixed(2)]);
  rows.push(['NET CHANGE IN CASH / ENDING CASH', '', '', (cf.closingCashCents / 100).toFixed(2)]);

  exportToCsv('cash_flow_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function renderAccountingContent(container, tbJson, accounts, entries, vouchers, rawAccounts) {
  const isBalanced = tbJson.isBalanced;

  // Extract all available years dynamically from vouchers
  const allYearsSet = new Set(['2026', '2025', '2024', '2023']);
  (vouchers || []).forEach((v) => {
    allYearsSet.add(getVoucherYear(v));
  });
  const availableYears = Array.from(allYearsSet).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  const yearFilterOptions = availableYears
    .map((y) => '<option value="' + y + '"' + (voucherYearFilter === y ? ' selected' : '') + '>' + y + (y === '2026' ? ' (Current)' : '') + '</option>')
    .concat(['<option value="ALL"' + (voucherYearFilter === 'ALL' ? ' selected' : '') + '>All Years</option>'])
    .join('');

  // Filter vouchers according to selected sub-tab, year filter, and search query
  let filteredVouchers = vouchers;
  if (accountingActiveTab === 'vouchers-pv') {
    filteredVouchers = vouchers.filter((v) => v.voucherType === 'PAYMENT');
  } else if (accountingActiveTab === 'vouchers-rv') {
    filteredVouchers = vouchers.filter((v) => v.voucherType === 'RECEIPT');
  } else if (accountingActiveTab === 'vouchers-jv') {
    filteredVouchers = vouchers.filter((v) => v.voucherType === 'JOURNAL');
  } else if (accountingActiveTab === 'vouchers-declined') {
    filteredVouchers = vouchers.filter((v) => v.status === 'VOID' || v.status === 'DECLINED');
  }

  // Apply Year Filter
  if (voucherYearFilter && voucherYearFilter !== 'ALL') {
    filteredVouchers = filteredVouchers.filter((v) => getVoucherYear(v) === voucherYearFilter);
  }

  // Apply Search Query Filter
  if (voucherSearchQuery) {
    filteredVouchers = filteredVouchers.filter((v) => {
      const num = (v.voucherNumber || '').toLowerCase();
      const rec = (v.recipient || v.recipientName || '').toLowerCase();
      const notes = (v.notes || '').toLowerCase();
      const method = (v.paymentMethod || '').toLowerCase();
      return num.includes(voucherSearchQuery) || rec.includes(voucherSearchQuery) || notes.includes(voucherSearchQuery) || method.includes(voucherSearchQuery);
    });
  }

  // Sort by last updated voucher (or created / voucherDate) descending
  filteredVouchers.sort((a, b) => {
    const timeB = new Date(b.updatedAt || b.createdAt || b.voucherDate || 0).getTime();
    const timeA = new Date(a.updatedAt || a.createdAt || a.voucherDate || 0).getTime();
    return timeB - timeA;
  });

  const voucherTypeBadges = {
    PAYMENT: 'badge-danger',
    RECEIPT: 'badge-success',
    JOURNAL: 'badge-primary',
  };

  const isAdmin = state.user && state.user.role === 'ADMIN';

  const voucherRows = filteredVouchers.map((v) => {
    const isPayment = v.voucherType === 'PAYMENT';
    const isReceipt = v.voucherType === 'RECEIPT';
    const amountColor = isPayment ? '#dc2626' : isReceipt ? '#059669' : '#1d4ed8';
    const amountPrefix = isPayment ? '- ' : isReceipt ? '+ ' : '';

    const rawDate = v.voucherDate || v.createdAt;
    let formattedDate = '—';
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    // Extract tag & category
    let tag = v.tag || v.referenceType || '';
    if (tag === 'MANUAL' || tag === 'DIRECT_RECEIPT') tag = '';
    else if (tag === 'PURCHASE_ORDER') tag = 'PO Procurement';
    else if (tag === 'PAYROLL_RUN') tag = 'Payroll';
    else if (tag === 'INVOICE' || tag === 'SALES_INVOICE') tag = 'Sales Invoice';
    else if (tag === 'CONTRA_TRANSFER') tag = 'Contra Transfer';

    let tagBadgeHtml = '<span style="color: #cbd5e1; font-size: 0.82rem;">—</span>';
    if (tag) {
      tagBadgeHtml = \`<span class="badge badge-neutral" style="font-size: 0.72rem; padding: 0.15rem 0.5rem; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; font-weight: 600; white-space: nowrap;"><span style="color: #94a3b8; margin-right: 2px;">#</span>\${tag}</span>\`;
    }

    // Extract remarks / notes with tooltip & ellipsis (...)
    let remarksText = v.notes || '';
    if (!remarksText && v.items && v.items.length > 0) {
      remarksText = v.items.map((it) => it.description).filter(Boolean).join(', ');
    }
    const cleanRemarks = remarksText.trim();
    const remarksHtml = cleanRemarks
      ? \`<div style="max-width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.82rem; color: #64748b;" title="\${cleanRemarks.replace(/"/g, '&quot;')}">\${cleanRemarks}</div>\`
      : \`<span style="color: #cbd5e1; font-size: 0.82rem;">—</span>\`;

    const status = v.status || 'POSTED';
    let statusBadgeClass = 'badge-success';
    let statusLabel = 'Posted';
    if (status === 'VOID' || status === 'DECLINED') {
      statusBadgeClass = 'badge-danger';
      statusLabel = 'Declined';
    } else if (status === 'DRAFT' || status === 'PENDING') {
      statusBadgeClass = 'badge-warning';
      statusLabel = 'Pending Approval';
    }

    let adminButtonsHtml = '';
    const canUpdate = can('accounting', 'update');
    const canDelete = can('accounting', 'delete');

    if (canUpdate) {
      adminButtonsHtml += \`
        <button type="button" class="icon-btn icon-btn-edit has-tooltip" data-tooltip="Edit Voucher" onclick="openEditVoucherModal('\${v.id}')" aria-label="Edit Voucher">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
      \`;

      if (status === 'DRAFT' || status === 'PENDING') {
        adminButtonsHtml += \`
          <button type="button" class="icon-btn icon-btn-approve has-tooltip" data-tooltip="Accept / Approve" onclick="handleApproveVoucher('\${v.id}')" aria-label="Approve Voucher">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <button type="button" class="icon-btn icon-btn-decline has-tooltip" data-tooltip="Decline Voucher" onclick="handleDeclineVoucher('\${v.id}')" aria-label="Decline Voucher">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        \`;
      } else if (status === 'POSTED') {
        adminButtonsHtml += \`
          <button type="button" class="icon-btn icon-btn-decline has-tooltip" data-tooltip="Decline / Void" onclick="handleDeclineVoucher('\${v.id}')" aria-label="Decline Voucher">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        \`;
      } else if (status === 'VOID' || status === 'DECLINED') {
        adminButtonsHtml += \`
          <button type="button" class="icon-btn icon-btn-restore has-tooltip" data-tooltip="Restore Voucher" onclick="handleRestoreVoucher('\${v.id}')" aria-label="Restore Voucher">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          </button>
        \`;
      }
    }

    if (canDelete) {
      adminButtonsHtml += \`
        <button type="button" class="icon-btn icon-btn-delete has-tooltip" data-tooltip="Delete Voucher" onclick="handleDeleteVoucher('\${v.id}', '\${v.voucherNumber}')" aria-label="Delete Voucher">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      \`;
    }

    return \`
      <tr>
        <td><strong style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #0f172a;">\${v.voucherNumber}</strong></td>
        <td><span style="font-size: 0.83rem; color: #334155; font-weight: 500; white-space: nowrap;">\${formattedDate}</span></td>
        <td><span class="badge \${voucherTypeBadges[v.voucherType] || 'badge-neutral'}"><span class="badge-dot"></span>\${v.voucherType}</span></td>
        <td><strong style="font-size: 0.84rem; color: #1e293b;">\${v.recipient || '-'}</strong></td>
        <td>\${tagBadgeHtml}</td>
        <td>\${remarksHtml}</td>
        <td><span style="font-size: 0.8rem; color: #64748b; white-space: nowrap;">\${(v.paymentMethod || 'STANDARD').replace('_', ' ')}</span></td>
        <td style="font-weight: 700; color: \${amountColor}; font-family: 'JetBrains Mono', monospace; font-size: 0.88rem; white-space: nowrap;">
          \${amountPrefix}\${formatCurrency(v.amountCents, v.currency || 'PHP')}
        </td>
        <td><span class="badge \${statusBadgeClass}"><span class="badge-dot"></span>\${statusLabel}</span></td>
        <td>
          <div class="action-btn-group">
            <button type="button" class="icon-btn icon-btn-view has-tooltip" data-tooltip="View Official Slip" onclick="openVoucherSlipModal('\${v.id}')" aria-label="View Official Slip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            \${adminButtonsHtml}
          </div>
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
    { id: 'vouchers-rv', label: '📥 Receipts (RV)', count: vouchers.filter((x) => x.voucherType === 'RECEIPT').length },
    { id: 'vouchers-jv', label: '⚖️ Journals (JV)', count: vouchers.filter((x) => x.voucherType === 'JOURNAL').length },
    { id: 'vouchers-declined', label: '🚫 Declined (Void)', count: vouchers.filter((x) => x.status === 'VOID' || x.status === 'DECLINED').length },
    { id: 'trial-balance', label: '📑 Chart of Accounts & TB', count: accounts.length },
    { id: 'general-ledger', label: '📜 General Ledger Audit', count: entries.length },
    { id: 'reports-pl', label: '📈 Profit & Loss (P&L)', count: 'P&L' },
    { id: 'reports-bs', label: '🏛️ Balance Sheet (BS)', count: 'BS' },
    { id: 'reports-cf', label: '💵 Cash Flow (CF)', count: 'CF' },
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
  } else if (accountingActiveTab === 'reports-pl') {
    exportButtonHtml = \`
      <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print P&L</button>
      <button class="btn btn-secondary btn-sm" onclick="exportProfitLossCsv()">📥 Export P&L CSV</button>
    \`;
  } else if (accountingActiveTab === 'reports-bs') {
    exportButtonHtml = \`
      <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print Balance Sheet</button>
      <button class="btn btn-secondary btn-sm" onclick="exportBalanceSheetCsv()">📥 Export BS CSV</button>
    \`;
  } else if (accountingActiveTab === 'reports-cf') {
    exportButtonHtml = \`
      <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print Cash Flow</button>
      <button class="btn btn-secondary btn-sm" onclick="exportCashFlowCsv()">📥 Export CF CSV</button>
    \`;
  }

  let mainSectionHtml = '';

  if (accountingActiveTab.startsWith('vouchers')) {
    mainSectionHtml = \`
      <div style="padding: 0.75rem 1.35rem 0.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; flex: 1;">
          <div style="flex: 1; max-width: 320px; min-width: 180px;">
            <input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search voucher #, payee, or notes..." value="\${voucherSearchQuery}" oninput="handleVoucherSearch(this.value)" />
          </div>
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <label style="font-size: 0.8rem; font-weight: 700; color: #475569; white-space: nowrap;">📅 Year:</label>
            <select class="form-select" style="padding: 0.42rem 0.75rem; font-size: 0.82rem; font-weight: 600; min-width: 140px; border-radius: 6px;" onchange="handleVoucherYearFilter(this.value)">
              \${yearFilterOptions}
            </select>
          </div>
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
              <th>Payee / Payer</th>
              <th>Tag / Category</th>
              <th>Remarks</th>
              <th>Payment Method</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            \${(voucherRows && voucherRows.length > 0) ? voucherRows.join('') : '<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 2.5rem;">No vouchers found' + (voucherYearFilter !== 'ALL' ? ' for year ' + voucherYearFilter : '') + ' in this category.</td></tr>'}
          </tbody>
        </table>
      </div>
    \`;
  } else if (accountingActiveTab === 'reports-pl') {
    const pl = cachedProfitLoss || {
      totalRevenueCents: 0,
      totalCogsCents: 0,
      grossProfitCents: 0,
      grossMarginPct: 0,
      totalOpexCents: 0,
      netIncomeCents: 0,
      netMarginPct: 0,
      revenues: [],
      cogs: [],
      operatingExpenses: [],
    };

    const isProfitable = pl.netIncomeCents >= 0;

    let revRows = (pl.revenues || []).map((r) => {
      const pct = pl.totalRevenueCents > 0 ? ((r.amountCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%';
      return \`
        <tr>
          <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">\${r.code}</strong> \${r.name}</td>
          <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #059669;">\${formatCurrency(r.amountCents)}</td>
          <td style="text-align: right; color: #64748b; font-size: 0.82rem;">\${pct}</td>
        </tr>
      \`;
    }).join('') || \`<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No revenue entries recorded</td></tr>\`;

    let cogsRows = (pl.cogs || []).map((c) => {
      const pct = pl.totalRevenueCents > 0 ? ((c.amountCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%';
      return \`
        <tr>
          <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">\${c.code}</strong> \${c.name}</td>
          <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #dc2626;">\${formatCurrency(c.amountCents)}</td>
          <td style="text-align: right; color: #64748b; font-size: 0.82rem;">\${pct}</td>
        </tr>
      \`;
    }).join('') || \`<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No direct cost of goods recorded</td></tr>\`;

    let opexRows = (pl.operatingExpenses || []).map((o) => {
      const pct = pl.totalRevenueCents > 0 ? ((o.amountCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%';
      return \`
        <tr>
          <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">\${o.code}</strong> \${o.name}</td>
          <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #d97706;">\${formatCurrency(o.amountCents)}</td>
          <td style="text-align: right; color: #64748b; font-size: 0.82rem;">\${pct}</td>
        </tr>
      \`;
    }).join('') || \`<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No operating expenses recorded</td></tr>\`;

    mainSectionHtml = \`
      <div style="padding: 1rem 1.35rem;">
        <!-- KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Revenue</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #059669; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(pl.totalRevenueCents)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Gross Profit</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #0f172a; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(pl.grossProfitCents)}</div>
            <div style="font-size: 0.75rem; color: #64748b;">Margin: \${pl.grossMarginPct}%</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Operating Expenses</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #dc2626; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(pl.totalOpexCents)}</div>
          </div>
          <div style="background: \${isProfitable ? '#f0fdf4' : '#fef2f2'}; border: 1px solid \${isProfitable ? '#bbf7d0' : '#fecaca'}; border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: \${isProfitable ? '#15803d' : '#b91c1c'}; text-transform: uppercase;">Net \${isProfitable ? 'Profit' : 'Loss'}</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: \${isProfitable ? '#15803d' : '#b91c1c'}; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(pl.netIncomeCents)}</div>
            <div style="font-size: 0.75rem; color: \${isProfitable ? '#15803d' : '#b91c1c'};">Net Margin: \${pl.netMarginPct}%</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Statement of Comprehensive Income (Profit & Loss)</h3>
          <div style="display: flex; gap: 0.5rem;">
            \${exportButtonHtml}
          </div>
        </div>

        <!-- Official Financial Statement Table -->
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: #ffffff;">
          <table class="data-table" style="margin-bottom: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>Line Item / Account Description</th>
                <th style="text-align: right; width: 180px;">Amount (PHP)</th>
                <th style="text-align: right; width: 120px;">% of Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #f1f5f9;"><td colspan="3"><strong>I. OPERATING REVENUES</strong></td></tr>
              \${revRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Operating Revenue</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #059669;">\${formatCurrency(pl.totalRevenueCents)}</td>
                <td style="text-align: right;">100.0%</td>
              </tr>

              <tr style="background: #f1f5f9;"><td colspan="3"><strong>II. COST OF GOODS SOLD (COGS)</strong></td></tr>
              \${cogsRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Cost of Goods Sold</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #dc2626;">(\${formatCurrency(pl.totalCogsCents)})</td>
                <td style="text-align: right;">\${pl.totalRevenueCents > 0 ? ((pl.totalCogsCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%'}</td>
              </tr>

              <tr style="background: #e2e8f0; font-weight: 800; font-size: 0.95rem;">
                <td>GROSS PROFIT</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">\${formatCurrency(pl.grossProfitCents)}</td>
                <td style="text-align: right;">\${pl.grossMarginPct}%</td>
              </tr>

              <tr style="background: #f1f5f9;"><td colspan="3"><strong>III. OPERATING EXPENSES (OPEX)</strong></td></tr>
              \${opexRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Operating Expenses</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #d97706;">(\${formatCurrency(pl.totalOpexCents)})</td>
                <td style="text-align: right;">\${pl.totalRevenueCents > 0 ? ((pl.totalOpexCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%'}</td>
              </tr>

              <tr style="background: \${isProfitable ? '#dcfce7' : '#fee2e2'}; font-weight: 800; font-size: 1rem; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
                <td>NET INCOME / (NET LOSS)</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: \${isProfitable ? '#15803d' : '#b91c1c'};">\${formatCurrency(pl.netIncomeCents)}</td>
                <td style="text-align: right; color: \${isProfitable ? '#15803d' : '#b91c1c'};">\${pl.netMarginPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    \`;
  } else if (accountingActiveTab === 'reports-bs') {
    const bs = cachedBalanceSheet || {
      totalAssetsCents: 0,
      totalLiabilitiesCents: 0,
      totalLiabilitiesAndEquityCents: 0,
      discrepancyCents: 0,
      isBalanced: true,
      assets: { current: [], nonCurrent: [], totalAssetsCents: 0 },
      liabilities: { current: [], nonCurrent: [], totalLiabilitiesCents: 0 },
      equity: { items: [], currentPeriodNetIncomeCents: 0, totalEquityCents: 0 },
    };

    let curAssetRows = (bs.assets?.current || []).map((a) => \`
      <tr>
        <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">\${a.code}</strong> \${a.name}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">\${formatCurrency(a.amountCents)}</td>
      </tr>
    \`).join('') || \`<tr><td colspan="2" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No current asset balances</td></tr>\`;

    let nonCurAssetRows = (bs.assets?.nonCurrent || []).map((a) => \`
      <tr>
        <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">\${a.code}</strong> \${a.name}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">\${formatCurrency(a.amountCents)}</td>
      </tr>
    \`).join('') || \`<tr><td colspan="2" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No non-current asset balances</td></tr>\`;

    let curLiabRows = (bs.liabilities?.current || []).map((l) => \`
      <tr>
        <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">\${l.code}</strong> \${l.name}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">\${formatCurrency(l.amountCents)}</td>
      </tr>
    \`).join('') || \`<tr><td colspan="2" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No current liability balances</td></tr>\`;

    let eqRows = (bs.equity?.items || []).map((e) => \`
      <tr>
        <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">\${e.code}</strong> \${e.name}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">\${formatCurrency(e.amountCents)}</td>
      </tr>
    \`).join('') || \`<tr><td colspan="2" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No base equity entries</td></tr>\`;

    mainSectionHtml = \`
      <div style="padding: 1rem 1.35rem;">
        <!-- KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Assets</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #0284c7; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(bs.totalAssetsCents)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Liabilities</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #dc2626; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(bs.liabilities?.totalLiabilitiesCents || 0)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Equity (incl. Net Profit)</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #059669; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(bs.equity?.totalEquityCents || 0)}</div>
          </div>
          <div style="background: \${bs.isBalanced ? '#f0fdf4' : '#fef2f2'}; border: 1px solid \${bs.isBalanced ? '#bbf7d0' : '#fecaca'}; border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: \${bs.isBalanced ? '#15803d' : '#b91c1c'}; text-transform: uppercase;">Equilibrium Status</div>
            <div style="font-size: 1.15rem; font-weight: 700; color: \${bs.isBalanced ? '#15803d' : '#b91c1c'}; margin-top: 0.25rem;">\${bs.isBalanced ? '✓ Balanced (A = L + E)' : '⚠ Discrepancy'}</div>
            <div style="font-size: 0.75rem; color: #64748b;">Diff: \${formatCurrency(Math.abs(bs.discrepancyCents || 0))}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Statement of Financial Position (Balance Sheet)</h3>
          <div style="display: flex; gap: 0.5rem;">
            \${exportButtonHtml}
          </div>
        </div>

        <!-- Official Balance Sheet Table -->
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: #ffffff;">
          <table class="data-table" style="margin-bottom: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>Account & Classification</th>
                <th style="text-align: right; width: 220px;">Balance (PHP)</th>
              </tr>
            </thead>
            <tbody>
              <!-- ASSETS -->
              <tr style="background: #e0f2fe;"><td colspan="2"><strong style="color: #0369a1;">1. ASSETS</strong></td></tr>
              <tr style="background: #f1f5f9;"><td colspan="2"><strong>Current Assets</strong></td></tr>
              \${curAssetRows}
              <tr style="background: #f1f5f9;"><td colspan="2"><strong>Non-Current & Fixed Assets</strong></td></tr>
              \${nonCurAssetRows}
              <tr style="background: #bae6fd; font-weight: 800; font-size: 0.95rem; border-top: 1px solid #7dd3fc;">
                <td>TOTAL ASSETS</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #0369a1;">\${formatCurrency(bs.totalAssetsCents)}</td>
              </tr>

              <!-- LIABILITIES -->
              <tr style="background: #fee2e2;"><td colspan="2"><strong style="color: #b91c1c;">2. LIABILITIES</strong></td></tr>
              <tr style="background: #f1f5f9;"><td colspan="2"><strong>Current Liabilities</strong></td></tr>
              \${curLiabRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Liabilities</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #dc2626;">\${formatCurrency(bs.liabilities?.totalLiabilitiesCents || 0)}</td>
              </tr>

              <!-- EQUITY -->
              <tr style="background: #dcfce7;"><td colspan="2"><strong style="color: #15803d;">3. OWNER'S EQUITY & RETAINED EARNINGS</strong></td></tr>
              \${eqRows}
              <tr>
                <td style="padding-left: 1.5rem;">Current Period Net Income / (Loss)</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #15803d;">\${formatCurrency(bs.equity?.currentPeriodNetIncomeCents || 0)}</td>
              </tr>
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Equity</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #15803d;">\${formatCurrency(bs.equity?.totalEquityCents || 0)}</td>
              </tr>

              <!-- TOTAL LIABILITIES & EQUITY -->
              <tr style="background: #f8fafc; font-weight: 800; font-size: 1rem; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
                <td>TOTAL LIABILITIES & EQUITY</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #0f172a;">\${formatCurrency(bs.totalLiabilitiesAndEquityCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    \`;
  } else if (accountingActiveTab === 'reports-cf') {
    const cf = cachedCashFlow || {
      operatingActivities: { inflows: [], outflows: [], totalInflowCents: 0, totalOutflowCents: 0, netOperatingCashCents: 0 },
      investingActivities: { items: [], netInvestingCashCents: 0 },
      financingActivities: { items: [], netFinancingCashCents: 0 },
      netCashFlowCents: 0,
      closingCashCents: 0,
    };

    let opInRows = (cf.operatingActivities?.inflows || []).map((i) => \`
      <tr>
        <td style="padding-left: 1.5rem;">\${i.description}</td>
        <td style="color: #64748b; font-size: 0.8rem;">\${new Date(i.date).toLocaleDateString()}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #059669;">+ \${formatCurrency(i.amountCents)}</td>
      </tr>
    \`).join('') || \`<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No operating inflows</td></tr>\`;

    let opOutRows = (cf.operatingActivities?.outflows || []).map((o) => \`
      <tr>
        <td style="padding-left: 1.5rem;">\${o.description}</td>
        <td style="color: #64748b; font-size: 0.8rem;">\${new Date(o.date).toLocaleDateString()}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #dc2626;">- \${formatCurrency(o.amountCents)}</td>
      </tr>
    \`).join('') || \`<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No operating disbursements</td></tr>\`;

    let invRows = (cf.investingActivities?.items || []).map((i) => \`
      <tr>
        <td style="padding-left: 1.5rem;">\${i.description}</td>
        <td style="color: #64748b; font-size: 0.8rem;">\${new Date(i.date).toLocaleDateString()}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">\${formatCurrency(i.amountCents)}</td>
      </tr>
    \`).join('') || \`<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No investing cash flows</td></tr>\`;

    let finRows = (cf.financingActivities?.items || []).map((f) => \`
      <tr>
        <td style="padding-left: 1.5rem;">\${f.description}</td>
        <td style="color: #64748b; font-size: 0.8rem;">\${new Date(f.date).toLocaleDateString()}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">\${formatCurrency(f.amountCents)}</td>
      </tr>
    \`).join('') || \`<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No financing cash flows</td></tr>\`;

    mainSectionHtml = \`
      <div style="padding: 1rem 1.35rem;">
        <!-- KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Net Operating Cash</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #059669; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(cf.operatingActivities?.netOperatingCashCents || 0)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Net Investing Cash</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #0284c7; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(cf.investingActivities?.netInvestingCashCents || 0)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Net Financing Cash</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #7c3aed; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(cf.financingActivities?.netFinancingCashCents || 0)}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #15803d; text-transform: uppercase;">Ending Cash Balance</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #15803d; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">\${formatCurrency(cf.closingCashCents)}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Statement of Cash Flows (Direct Method)</h3>
          <div style="display: flex; gap: 0.5rem;">
            \${exportButtonHtml}
          </div>
        </div>

        <!-- Official Cash Flow Table -->
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: #ffffff;">
          <table class="data-table" style="margin-bottom: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>Cash Flow Activity & Description</th>
                <th style="width: 140px;">Date</th>
                <th style="text-align: right; width: 180px;">Amount (PHP)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Operating Cash Flows -->
              <tr style="background: #f1f5f9;"><td colspan="3"><strong>1. CASH FLOWS FROM OPERATING ACTIVITIES</strong></td></tr>
              <tr><td colspan="3" style="font-weight: 600; color: #059669; padding-left: 1rem;">Cash Receipts & Inflows</td></tr>
              \${opInRows}
              <tr><td colspan="3" style="font-weight: 600; color: #dc2626; padding-left: 1rem;">Cash Disbursements & Outflows</td></tr>
              \${opOutRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700; background: #f8fafc;">
                <td colspan="2">Net Cash Provided by Operating Activities</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #059669;">\${formatCurrency(cf.operatingActivities?.netOperatingCashCents || 0)}</td>
              </tr>

              <!-- Investing Cash Flows -->
              <tr style="background: #f1f5f9;"><td colspan="3"><strong>2. CASH FLOWS FROM INVESTING ACTIVITIES</strong></td></tr>
              \${invRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700; background: #f8fafc;">
                <td colspan="2">Net Cash Provided by / (Used in) Investing Activities</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #0284c7;">\${formatCurrency(cf.investingActivities?.netInvestingCashCents || 0)}</td>
              </tr>

              <!-- Financing Cash Flows -->
              <tr style="background: #f1f5f9;"><td colspan="3"><strong>3. CASH FLOWS FROM FINANCING ACTIVITIES</strong></td></tr>
              \${finRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700; background: #f8fafc;">
                <td colspan="2">Net Cash Provided by / (Used in) Financing Activities</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #7c3aed;">\${formatCurrency(cf.financingActivities?.netFinancingCashCents || 0)}</td>
              </tr>

              <!-- Net Change & Closing Cash -->
              <tr style="background: #dcfce7; font-weight: 800; font-size: 1rem; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
                <td colspan="2">NET CHANGE IN CASH & CLOSING CASH EQUIVALENTS</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #15803d;">\${formatCurrency(cf.closingCashCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
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
    <!-- Accounting Header Panel -->
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">
          Accounting & Financial Reports
          <div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.3rem;">
            General ledger equilibrium, customer receipts (RV), journal adjustments (JV), chart of accounts, and financial statements.
          </div>
        </div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span class="badge \${isBalanced ? 'badge-success' : 'badge-danger'}" style="align-self: center;">
            <span class="badge-dot"></span>
            \${isBalanced ? 'Double-Entry Balanced' : 'Ledger Imbalance ($' + (Math.abs(tbJson.discrepancyCents || 0) / 100).toFixed(2) + ')'}
          </span>
          \${can('accounting', 'create') && accountingActiveTab === 'vouchers-rv' ? '<button class="btn btn-primary btn-sm" onclick="openNewReceiptVoucherModal()">+ Create Receipt Voucher (RV)</button>' : ''}
          \${can('accounting', 'create') && accountingActiveTab === 'vouchers-jv' ? '<button class="btn btn-primary btn-sm" onclick="openNewJournalVoucherModal()">+ Create Journal Voucher (JV)</button><button class="btn btn-secondary btn-sm" onclick="openNewContraVoucherModal()">+ Post Contra (CV)</button>' : ''}
          \${can('accounting', 'create') && accountingActiveTab === 'vouchers-pv' ? '<button class="btn btn-primary btn-sm" onclick="openNewPaymentVoucherModal()">+ New Payment Voucher</button>' : ''}
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
    <form id="form-new-pv" onsubmit="submitNewPaymentVoucher(event)" style="display: flex; flex-direction: column; gap: 1.15rem;">
      <!-- PANEL 1: PAYEE & VOUCHER DETAILS -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.15rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 0.55rem;">
            <div style="width: 26px; height: 26px; border-radius: 6px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 800; border: 1px solid #bfdbfe;">1</div>
            <div>
              <span style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">Payee & Basic Details</span>
              <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.4rem;">• Primary disbursement entity</span>
            </div>
          </div>
          <span class="badge badge-primary" style="font-size: 0.72rem; padding: 0.2rem 0.55rem;">Disbursement</span>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.9rem; margin-bottom: 0.9rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <label class="form-label" style="font-weight: 700; margin-bottom: 0; color: #1e293b; font-size: 0.84rem;">Pay to (Recipient / Payee Name) *</label>
              <span style="font-size: 0.72rem; color: #64748b;">Search or quick-pick</span>
            </div>
            <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 0.45rem;">
              <input type="text" id="pv-recipient-name" class="form-input" list="pv-payees-datalist" placeholder="e.g. Acme Materials or Sarah Connor" oninput="handlePvPayeeInput(this.value)" required style="font-weight: 600;" />
              <select class="form-input" onchange="handlePvQuickPayeeSelect(this.value)" style="font-size: 0.8rem; background-color: #f8fafc; font-weight: 500;">
                <option value="">🔍 Directory Pick...</option>
                <optgroup label="🏢 Vendors / Suppliers (\${cachedVendors.length})">
                  \${cachedVendors.map((v) => \`<option value="VENDOR|\${v.name}">\${v.name} (\${v.vendorCode || 'Vendor'})\</option>\`).join('')}
                </optgroup>
                <optgroup label="👷 Employees / Staff (\${cachedEmployees.length})">
                  \${cachedEmployees.map((e) => \`<option value="EMPLOYEE|\${e.firstName} \${e.lastName}">\${e.firstName} \${e.lastName} (\${e.department || 'Staff'})\</option>\`).join('')}
                </optgroup>
                <optgroup label="🏬 Customers / Companies (\${cachedCustomers.length})">
                  \${cachedCustomers.map((c) => \`<option value="OTHER|\${c.name}">\${c.name} (\${c.customerCode || 'Client'})\</option>\`).join('')}
                </optgroup>
              </select>
            </div>
            <datalist id="pv-payees-datalist">
              \${cachedVendors.map((v) => \`<option value="\${v.name}">Vendor: \${v.name} (\${v.vendorCode || 'Supplier'})\</option>\`).join('')}
              \${cachedEmployees.map((e) => \`<option value="\${e.firstName} \${e.lastName}">Employee: \${e.firstName} \${e.lastName} (\${e.department || 'Staff'})\</option>\`).join('')}
              \${cachedCustomers.map((c) => \`<option value="\${c.name}">Customer: \${c.name} (\${c.customerCode || 'Client'})\</option>\`).join('')}
            </datalist>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Recipient Classification</label>
            <select id="pv-recipient-type" class="form-input" style="font-weight: 500;">
              <option value="VENDOR">Vendor / Supplier</option>
              <option value="EMPLOYEE">Employee / Staff</option>
              <option value="OTHER">Other / Contractor</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Currency</label>
            <select id="pv-currency" class="form-input" onchange="updatePaymentVoucherCurrency()" style="font-weight: 700;">
              <option value="PHP" selected>PHP (₱)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.9rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Voucher Date *</label>
            <input type="date" id="pv-date" class="form-input" value="\${todayStr}" required style="font-weight: 600;" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Expense Tag / Category</label>
            <select id="pv-tag" class="form-input">
              \${tagOptions}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Voucher Number <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">(Auto if blank)</span></label>
            <input type="text" id="pv-voucher-number" class="form-input" placeholder="e.g. 26-000440" style="font-family: 'JetBrains Mono', monospace;" />
          </div>
        </div>
      </div>

      <!-- PANEL 2: ITEMIZED EXPENSE BREAKDOWN -->
      <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 1.15rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.9rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 0.55rem;">
            <div style="width: 26px; height: 26px; border-radius: 6px; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 800; border: 1px solid #fde68a;">2</div>
            <div>
              <span style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">Itemized Breakdown</span>
              <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.4rem;">• Printed on official APEXS voucher slip</span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="addPaymentVoucherItemRow()" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; padding: 0.35rem 0.85rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Line Item
          </button>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 0.9rem;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;" id="pv-items-table">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; text-align: left;">
                <th style="padding: 9px 12px; width: 25%; font-weight: 700; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em;">Invoice / Ref No</th>
                <th style="padding: 9px 12px; width: 45%; font-weight: 700; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em;">Account / Description *</th>
                <th style="padding: 9px 12px; width: 22%; text-align: right; font-weight: 700; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em;">Amount (<span class="pv-cur-symbol">₱</span>) *</th>
                <th style="padding: 9px 12px; width: 8%; text-align: center;"></th>
              </tr>
            </thead>
            <tbody id="pv-items-tbody">
              <!-- Dynamic rows rendered here -->
            </tbody>
          </table>
        </div>

        <!-- Grand Total Summary Card -->
        <div style="display: flex; justify-content: flex-end; align-items: center; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 0.75rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">Total Voucher Amount:</span>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.25rem; font-weight: 800; color: #dc2626; background: #ffffff; padding: 0.35rem 1rem; border-radius: 6px; border: 1.5px solid #fecaca; box-shadow: 0 1px 2px rgba(220, 38, 38, 0.08);" id="pv-total-display">
              ₱ 0.00
            </div>
          </div>
        </div>
      </div>

      <!-- PANEL 3: ACCOUNTING LEDGER & SETTLEMENT -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.15rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 0.55rem;">
            <div style="width: 26px; height: 26px; border-radius: 6px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 800; border: 1px solid #a7f3d0;">3</div>
            <div>
              <span style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">Ledger Accounts & Settlement</span>
              <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.4rem;">• Double-entry general ledger posting</span>
            </div>
          </div>
          <span class="badge badge-success" style="font-size: 0.72rem; padding: 0.2rem 0.55rem;">Balanced G/L</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.9rem;">
          <div class="form-group" style="margin-bottom: 0; background: #fef2f2; padding: 0.9rem; border-radius: 8px; border: 1px solid #fecaca;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
              <label class="form-label" style="color: #991b1b; font-weight: 700; margin-bottom: 0; font-size: 0.82rem;">Debit Account (Expense / A/P) *</label>
              <span class="badge badge-danger" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;">Debit (+)</span>
            </div>
            <select id="pv-exp-acc" class="form-input" required style="font-weight: 600; background: #ffffff;">
              \${accountOptions}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0; background: #f0fdf4; padding: 0.9rem; border-radius: 8px; border: 1px solid #bbf7d0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
              <label class="form-label" style="color: #166534; font-weight: 700; margin-bottom: 0; font-size: 0.82rem;">Credit Account (Cash / Bank) *</label>
              <span class="badge badge-success" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;">Credit (-)</span>
            </div>
            <select id="pv-pay-acc" class="form-input" required style="font-weight: 600; background: #ffffff;">
              \${accountOptions}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Payment Method *</label>
            <select id="pv-payment-method" class="form-input" style="font-weight: 600;">
              \${methodOptions}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Payment Memo / Notes</label>
            <input type="text" id="pv-notes" class="form-input" placeholder="e.g. Kenneth S Brown Corporate Credit Card / Check # / Transfer Ref" />
          </div>
        </div>
      </div>

      <!-- PANEL 4: SIGNATORIES & APPROVALS -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.15rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 0.55rem;">
            <div style="width: 26px; height: 26px; border-radius: 6px; background: #faf5ff; color: #7e22ce; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 800; border: 1px solid #e9d5ff;">4</div>
            <div>
              <span style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">Signatories & Approvals</span>
              <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.4rem;">• Official APEXS 4-point authorization sign-off</span>
            </div>
          </div>
          <span class="badge badge-warning" style="font-size: 0.72rem; padding: 0.2rem 0.55rem;">Slip Sign-off</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.85rem;">
          <div class="form-group" style="margin-bottom: 0; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Prepared by:</label>
            <input type="text" id="pv-sig-prepared" class="form-input" value="\${prepVal}" style="font-size: 0.82rem; background: #ffffff;" placeholder="Administrator / Bookkeeper" />
          </div>
          <div class="form-group" style="margin-bottom: 0; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Certified Correct by:</label>
            <input type="text" id="pv-sig-certified" class="form-input" value="\${certVal}" style="font-size: 0.82rem; background: #ffffff;" placeholder="Joy / Senior Admin" />
          </div>
          <div class="form-group" style="margin-bottom: 0; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Approved by:</label>
            <input type="text" id="pv-sig-approved" class="form-input" value="\${appVal}" style="font-size: 0.82rem; background: #ffffff;" placeholder="Kenneth Brown / CEO" />
          </div>
          <div class="form-group" style="margin-bottom: 0; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Received Payment:</label>
            <input type="text" id="pv-sig-received" class="form-input" value="\${recVal}" style="font-size: 0.82rem; background: #ffffff;" placeholder="Signature / Date" />
          </div>
        </div>
      </div>
    </form>
  \`;

  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-pv').requestSubmit()" style="display: inline-flex; align-items: center; gap: 0.45rem; font-weight: 700; padding: 0.5rem 1.25rem;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Post Payment Voucher
    </button>
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

function handlePvQuickPayeeSelect(val) {
  if (!val) return;
  const parts = val.split('|');
  const type = parts[0];
  const name = parts.slice(1).join('|');
  const nameInput = document.getElementById('pv-recipient-name');
  const typeSelect = document.getElementById('pv-recipient-type');
  if (nameInput) nameInput.value = name;
  if (typeSelect && type) typeSelect.value = type;
}

function handlePvPayeeInput(val) {
  if (!val) return;
  const lower = val.trim().toLowerCase();
  const typeSelect = document.getElementById('pv-recipient-type');
  if (!typeSelect) return;
  if (cachedVendors.some((v) => v.name.toLowerCase() === lower)) {
    typeSelect.value = 'VENDOR';
  } else if (cachedEmployees.some((e) => (e.firstName + ' ' + e.lastName).toLowerCase() === lower)) {
    typeSelect.value = 'EMPLOYEE';
  }
}

function handleRvQuickPayerSelect(name) {
  if (!name) return;
  const nameInput = document.getElementById('rv-payer-name');
  if (nameInput) nameInput.value = name;
}

function addPaymentVoucherItemRow(inv = '', desc = '', amt = '') {
  const tbody = document.getElementById('pv-items-tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'pv-item-row';
  tr.style.borderBottom = '1px solid #f1f5f9';
  tr.innerHTML = \`
    <td style="padding: 6px 8px;">
      <input type="text" class="form-input pv-item-inv" value="\${inv}" placeholder="e.g. INV-10492 / PO #" style="font-size: 0.84rem; padding: 0.4rem 0.65rem;" />
    </td>
    <td style="padding: 6px 8px;">
      <input type="text" class="form-input pv-item-desc" value="\${desc}" placeholder="Item description / Purpose of payment" required style="font-size: 0.84rem; padding: 0.4rem 0.65rem;" />
    </td>
    <td style="padding: 6px 8px;">
      <input type="number" step="0.01" min="0" class="form-input pv-item-amt" value="\${amt}" placeholder="0.00" oninput="calcPaymentVoucherTotal()" required style="font-size: 0.84rem; padding: 0.4rem 0.65rem; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;" />
    </td>
    <td style="padding: 6px 8px; text-align: center;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="removePaymentVoucherItemRow(this)" style="padding: 0.35rem 0.6rem; color: #dc2626; border-color: #fecaca; background: #fff5f5;" title="Remove row">
        ✕
      </button>
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0;">Payer / Customer Name *</label>
          <span style="font-size: 0.72rem; color: #64748b;">Type or pick from directory</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem;">
          <input type="text" id="rv-payer-name" class="form-input" list="rv-payers-datalist" placeholder="e.g. Globex Corporation or Client Deposit" required />
          <select class="form-input" onchange="handleRvQuickPayerSelect(this.value)" style="font-size: 0.8rem; background-color: #f8fafc;">
            <option value="">🔍 Directory Pick...</option>
            <optgroup label="🏬 Customers / Companies (\${cachedCustomers.length})">
              \${cachedCustomers.map((c) => \`<option value="\${c.name}">\${c.name} (\${c.customerCode || 'Client'})\</option>\`).join('')}
            </optgroup>
            <optgroup label="🏢 Vendors / Partners (\${cachedVendors.length})">
              \${cachedVendors.map((v) => \`<option value="\${v.name}">\${v.name} (\${v.vendorCode || 'Vendor'})\</option>\`).join('')}
            </optgroup>
            <optgroup label="👷 Employees / Staff (\${cachedEmployees.length})">
              \${cachedEmployees.map((e) => \`<option value="\${e.firstName} \${e.lastName}">\${e.firstName} \${e.lastName}\</option>\`).join('')}
            </optgroup>
          </select>
        </div>
        <datalist id="rv-payers-datalist">
          \${cachedCustomers.map((c) => \`<option value="\${c.name}">Customer: \${c.name} (\${c.customerCode || 'Client'})\</option>\`).join('')}
          \${cachedVendors.map((v) => \`<option value="\${v.name}">Vendor: \${v.name} (\${v.vendorCode || 'Supplier'})\</option>\`).join('')}
          \${cachedEmployees.map((e) => \`<option value="\${e.firstName} \${e.lastName}">Employee: \${e.firstName} \${e.lastName}\</option>\`).join('')}
        </datalist>
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
      
      <!-- APEXS Header with Official Brand Logo -->
      <div style="display: flex; justify-content: center; align-items: center; gap: 1.5rem; margin-bottom: 0.75rem;">
        <img src="/assets/logo.png" alt="APEXS, INC. Logo" style="height: 78px; width: auto; object-fit: contain; flex-shrink: 0;" />
        <div>
          <div style="font-size: 1.55rem; font-weight: 900; color: #15803d; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px; line-height: 1.1;">APEXS, INC.</div>
          <div style="font-size: 0.88rem; font-weight: 700; font-style: italic; color: #0f172a; line-height: 1.2;">Applied Expert Systems & Software, Inc.</div>
          <div style="font-size: 0.82rem; font-style: italic; color: #0284c7; font-weight: 600; font-family: 'Georgia', serif;">“We put technology to work for you”</div>
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
    </div>
  \`;

  const footer = \`
    <button class="btn btn-secondary" onclick="window.print()">🖨️ Print Official Voucher</button>
    <button class="btn btn-primary" onclick="closeModal()">Close</button>
  \`;

  openModal(\`Official Voucher Slip — \${v.voucherNumber}\`, body, footer, 'xl');
}

/* ========================================================================== */
/* VOUCHER CRUD & ADMIN APPROVAL / DECLINE / RESTORE CONTROLLERS              */
/* ========================================================================== */

function updateEditVoucherTotal() {
  const rows = document.querySelectorAll('#edit-voucher-items-tbody tr.edit-voucher-item-row');
  let totalCents = 0;
  rows.forEach((r) => {
    const amtInput = r.querySelector('.edit-item-amount');
    if (amtInput) {
      const val = parseFloat(amtInput.value || '0');
      if (!isNaN(val) && val > 0) {
        totalCents += Math.round(val * 100);
      }
    }
  });
  const totalDisplay = document.getElementById('edit-voucher-total-display');
  if (totalDisplay) {
    totalDisplay.textContent = formatCurrency(totalCents);
  }
}

function addEditVoucherRow(invoiceNo, description, amount) {
  const tbody = document.getElementById('edit-voucher-items-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'edit-voucher-item-row';
  tr.innerHTML =
    '<td>' +
    '<input type="text" class="form-input edit-item-invoice" style="padding: 0.45rem 0.65rem; font-size: 0.85rem;" placeholder="Inv # / Ref" value="' + (invoiceNo || '') + '" />' +
    '</td>' +
    '<td>' +
    '<input type="text" class="form-input edit-item-desc" style="padding: 0.45rem 0.65rem; font-size: 0.85rem;" placeholder="Account / Description" value="' + (description || '') + '" required />' +
    '</td>' +
    '<td>' +
    '<div style="position: relative;">' +
    '<span style="position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); font-size: 0.82rem; color: #64748b; pointer-events: none;">₱</span>' +
    '<input type="number" step="0.01" min="0" class="form-input edit-item-amount" style="padding: 0.45rem 0.65rem 0.45rem 1.6rem; font-size: 0.85rem; text-align: right; font-family: monospace;" placeholder="0.00" value="' + (amount || '') + '" oninput="updateEditVoucherTotal()" required />' +
    '</div>' +
    '</td>' +
    '<td style="text-align: center;">' +
    '<button type="button" class="icon-btn icon-btn-delete has-tooltip" data-tooltip="Remove Row" onclick="removeEditVoucherRow(this)" aria-label="Remove Row">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
    '</button>' +
    '</td>';
  tbody.appendChild(tr);
  updateEditVoucherTotal();
}

function removeEditVoucherRow(btn) {
  const row = btn.closest('tr');
  const tbody = document.getElementById('edit-voucher-items-tbody');
  if (row && tbody) {
    if (tbody.querySelectorAll('tr.edit-voucher-item-row').length <= 1) {
      showToast('A voucher must have at least one line item', 'warning');
      return;
    }
    row.remove();
    updateEditVoucherTotal();
  }
}

function openEditVoucherModal(voucherId) {
  const v = cachedVouchers.find((x) => x.id === voucherId);
  if (!v) {
    showToast('Voucher not found', 'warning');
    return;
  }

  const rawDate = v.voucherDate || v.createdAt;
  const isoDate = new Date(rawDate).toISOString().split('T')[0];
  
  let items = v.items || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (_) { items = []; }
  }
  if (!items || items.length === 0) {
    items = [{
      invoiceNo: '',
      description: v.notes || (v.recipient ? 'Payment to ' + v.recipient : 'Disbursement Item'),
      amountCents: v.amountCents || 0,
    }];
  }

  let sig = v.signatories || {};
  if (typeof sig === 'string') {
    try { sig = JSON.parse(sig); } catch (_) { sig = {}; }
  }

  let rowsHtml = '';
  items.forEach((it) => {
    const inv = it.invoiceNo || '';
    const desc = it.description || '';
    const amt = ((it.amountCents || 0) / 100).toFixed(2);
    rowsHtml +=
      '<tr class="edit-voucher-item-row">' +
      '<td><input type="text" class="form-input edit-item-invoice" style="padding: 0.45rem 0.65rem; font-size: 0.85rem;" placeholder="Inv # / Ref" value="' + inv + '" /></td>' +
      '<td><input type="text" class="form-input edit-item-desc" style="padding: 0.45rem 0.65rem; font-size: 0.85rem;" placeholder="Account / Description" value="' + desc + '" required /></td>' +
      '<td><div style="position: relative;"><span style="position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); font-size: 0.82rem; color: #64748b; pointer-events: none;">₱</span>' +
      '<input type="number" step="0.01" min="0" class="form-input edit-item-amount" style="padding: 0.45rem 0.65rem 0.45rem 1.6rem; font-size: 0.85rem; text-align: right; font-family: monospace;" placeholder="0.00" value="' + amt + '" oninput="updateEditVoucherTotal()" required /></div></td>' +
      '<td style="text-align: center;">' +
      '<button type="button" class="icon-btn icon-btn-delete has-tooltip" data-tooltip="Remove Row" onclick="removeEditVoucherRow(this)" aria-label="Remove Row">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
      '</button></td>' +
      '</tr>';
  });

  let signatoriesHtml = '';
  if (v.voucherType === 'PAYMENT') {
    signatoriesHtml =
      '<div style="border-top: 1px solid var(--border-color); padding-top: 0.85rem; margin-top: 0.85rem;">' +
      '<div style="font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em;">✍️ Official Slip Signatories</div>' +
      '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">' +
      '<div><label class="form-label" style="font-size: 0.76rem;">Prepared by</label><input type="text" id="edit-sig-prep" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.82rem;" value="' + (sig.preparedBy || '') + '" placeholder="Administrator / Bookkeeper" /></div>' +
      '<div><label class="form-label" style="font-size: 0.76rem;">Certified Correct by</label><input type="text" id="edit-sig-cert" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.82rem;" value="' + (sig.certifiedBy || '') + '" placeholder="Joy / Senior Admin" /></div>' +
      '<div><label class="form-label" style="font-size: 0.76rem;">Approved by</label><input type="text" id="edit-sig-appr" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.82rem;" value="' + (sig.approvedBy || '') + '" placeholder="Kenneth Brown / CEO" /></div>' +
      '<div><label class="form-label" style="font-size: 0.76rem;">Received by</label><input type="text" id="edit-sig-recv" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.82rem;" value="' + (sig.receivedBy || '') + '" placeholder="Signature over printed name / Date" /></div>' +
      '</div></div>';
  }

  const vSettings = window.cachedVoucherSettings || {};
  const editMethods = (vSettings['vouchers.payment_methods'] && Array.isArray(vSettings['vouchers.payment_methods']))
    ? vSettings['vouchers.payment_methods']
    : [
        { id: 'BANK_TRANSFER', name: 'Bank Transfer' },
        { id: 'CHECK', name: 'Check' },
        { id: 'CASH', name: 'Cash' },
        { id: 'CREDIT_CARD', name: 'Credit Card' },
        { id: 'ONLINE', name: 'Online Payment' },
        { id: 'DOUBLE_ENTRY', name: 'Double-Entry Journal' },
      ];
  let editMethodOptions = editMethods
    .map((m) => '<option value="' + m.id + '"' + (v.paymentMethod === m.id ? ' selected' : '') + '>' + m.name + '</option>')
    .join('');
  if (v.paymentMethod && !editMethods.some((m) => m.id === v.paymentMethod)) {
    editMethodOptions += '<option value="' + v.paymentMethod + '" selected>' + v.paymentMethod + '</option>';
  }

  const body =
    '<form id="edit-voucher-form" onsubmit="event.preventDefault(); handleSaveVoucherEdit(\\\'' + v.id + '\\\', \\\'' + v.voucherType + '\\\')">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label">Voucher Number</label>' +
    '<input type="text" class="form-input" value="' + v.voucherNumber + '" disabled style="background: #f1f5f9; cursor: not-allowed; font-weight: 700; font-family: monospace;" /></div>' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" for="edit-v-date">Voucher Date</label>' +
    '<input type="date" id="edit-v-date" class="form-input" value="' + isoDate + '" required /></div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" for="edit-v-recipient">Payee / Recipient / Client</label>' +
    '<input type="text" id="edit-v-recipient" class="form-input" value="' + (v.recipientName || v.recipient || '') + '" required /></div>' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" for="edit-v-method">Payment Method</label>' +
    '<select id="edit-v-method" class="form-select">' +
    editMethodOptions +
    '</select></div>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 1.25rem;">' +
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">' +
    '<label class="form-label" style="margin-bottom: 0; font-weight: 700; font-size: 0.88rem; color: #1e293b;">📋 Line Items Breakdown Table</label>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="addEditVoucherRow()" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; font-size: 0.8rem;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> + Add Line Item</button>' +
    '</div>' +
    '<div class="table-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; background: #ffffff;">' +
    '<table class="table" style="margin-bottom: 0;">' +
    '<thead><tr style="background: #f8fafc;"><th style="width: 26%; font-size: 0.8rem;">Invoice No / Ref</th><th style="width: 46%; font-size: 0.8rem;">Account / Description</th><th style="width: 20%; text-align: right; font-size: 0.8rem;">Amount (₱)</th><th style="width: 8%; text-align: center; font-size: 0.8rem;">Action</th></tr></thead>' +
    '<tbody id="edit-voucher-items-tbody">' + rowsHtml + '</tbody>' +
    '<tfoot><tr style="background: #f8fafc; font-weight: 700; border-top: 1.5px solid var(--border-color);"><td colspan="2" style="text-align: right; font-size: 0.85rem; color: #334155;">Total Summary:</td><td style="text-align: right; font-size: 0.92rem; color: var(--primary); font-family: monospace;" id="edit-voucher-total-display">' + formatCurrency(v.amountCents, v.currency || 'PHP') + '</td><td></td></tr></tfoot>' +
    '</table></div></div>' +
    '<div class="form-group" style="margin-bottom: 1.25rem;"><label class="form-label" for="edit-v-notes">Memo / Remarks</label>' +
    '<textarea id="edit-v-notes" class="form-input" rows="2" placeholder="e.g. Corporate Expense breakdown">' + (v.notes || '') + '</textarea></div>' +
    signatoriesHtml +
    '</form>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="handleSaveVoucherEdit(\\\'' + v.id + '\\\', \\\'' + v.voucherType + '\\\')">Save Changes</button>';

  openModal('Edit Voucher — ' + v.voucherNumber, body, footer, 'lg');
}

async function handleSaveVoucherEdit(voucherId, voucherType) {
  const dateInput = document.getElementById('edit-v-date');
  const recipientInput = document.getElementById('edit-v-recipient');
  const methodInput = document.getElementById('edit-v-method');
  const notesInput = document.getElementById('edit-v-notes');

  const payload = {
    voucherDate: dateInput ? new Date(dateInput.value).toISOString() : undefined,
    recipientName: recipientInput ? recipientInput.value.trim() : undefined,
    paymentMethod: methodInput ? methodInput.value : undefined,
    notes: notesInput ? notesInput.value.trim() : undefined,
  };

  // Parse item rows from the table
  const itemRows = document.querySelectorAll('#edit-voucher-items-tbody tr.edit-voucher-item-row');
  const items = [];
  let totalAmountCents = 0;

  itemRows.forEach((row) => {
    const inv = (row.querySelector('.edit-item-invoice') ? row.querySelector('.edit-item-invoice').value : '').trim();
    const desc = (row.querySelector('.edit-item-desc') ? row.querySelector('.edit-item-desc').value : '').trim();
    const amtInput = row.querySelector('.edit-item-amount');
    const amtVal = parseFloat((amtInput ? amtInput.value : '0') || '0');
    const amtCents = Math.round(amtVal * 100);

    if (desc && amtCents > 0) {
      items.push({
        invoiceNo: inv,
        description: desc,
        amountCents: amtCents,
      });
      totalAmountCents += amtCents;
    }
  });

  if (items.length === 0) {
    showToast('Please provide at least one valid line item with description and amount', 'warning');
    return;
  }

  payload.items = items;
  payload.amountCents = totalAmountCents;

  // Parse signatories if present
  const prepEl = document.getElementById('edit-sig-prep');
  const certEl = document.getElementById('edit-sig-cert');
  const apprEl = document.getElementById('edit-sig-appr');
  const recvEl = document.getElementById('edit-sig-recv');
  if (prepEl || certEl || apprEl || recvEl) {
    payload.signatories = {
      preparedBy: prepEl ? prepEl.value.trim() : '',
      certifiedBy: certEl ? certEl.value.trim() : '',
      approvedBy: apprEl ? apprEl.value.trim() : '',
      receivedBy: recvEl ? recvEl.value.trim() : '',
    };
  }

  try {
    const res = await apiFetch('/api/accounting/vouchers/' + voucherId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Failed to update voucher', 'danger');
      return;
    }
    closeModal();
    showToast('Voucher and line items table updated successfully', 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast('Network error: ' + err.message, 'danger');
  }
}

async function handleApproveVoucher(voucherId) {
  try {
    const res = await apiFetch('/api/accounting/vouchers/' + voucherId + '/approve', { method: 'POST' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Failed to approve voucher', 'danger');
      return;
    }
    showToast('Voucher approved and posted to General Ledger', 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast('Network error: ' + err.message, 'danger');
  }
}

function handleDeclineVoucher(voucherId) {
  openConfirmModal({
    title: 'Decline & Void Voucher',
    message: 'Are you sure you want to decline this voucher?',
    subtext: 'Its double-entry ledger impact will be immediately removed from the General Ledger and financial statements.',
    confirmText: 'Decline Voucher',
    cancelText: 'Cancel',
    type: 'warning',
    onConfirm: async () => {
      const res = await apiFetch('/api/accounting/vouchers/' + voucherId + '/decline', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || 'Failed to decline voucher', 'danger');
        return;
      }
      showToast('Voucher declined and ledger adjusted', 'warning');
      if (typeof loadAccounting === 'function') loadAccounting();
      if (typeof loadVouchers === 'function') loadVouchers();
    },
  });
}

async function handleRestoreVoucher(voucherId) {
  try {
    const res = await apiFetch('/api/accounting/vouchers/' + voucherId + '/restore', { method: 'POST' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Failed to restore voucher', 'danger');
      return;
    }
    showToast('Voucher restored and re-posted to General Ledger', 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast('Network error: ' + err.message, 'danger');
  }
}

function handleDeleteVoucher(voucherId, voucherNumber) {
  openConfirmModal({
    title: 'Permanently Delete Voucher',
    message: 'Are you sure you want to permanently delete voucher <strong>' + (voucherNumber || '') + '</strong>?',
    subtext: 'This action cannot be undone and will permanently remove this voucher record from the system.',
    confirmText: 'Delete Permanently',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: async () => {
      const res = await apiFetch('/api/accounting/vouchers/' + voucherId, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || 'Failed to delete voucher', 'danger');
        return;
      }
      showToast('Voucher deleted permanently', 'info');
      if (typeof loadAccounting === 'function') loadAccounting();
      if (typeof loadVouchers === 'function') loadVouchers();
    },
  });
}

// Global aliases for interoperability across vouchers and accounting views
window.openOfficialVoucherSlipModal = openVoucherSlipModal;
window.openNewJournalVoucherModal = openNewJVModal;
window.openNewContraVoucherModal = openNewContraModal;
window.declineVoucher = handleDeclineVoucher;
window.restoreVoucher = handleRestoreVoucher;
window.deleteVoucherPermanent = handleDeleteVoucher;
`;
