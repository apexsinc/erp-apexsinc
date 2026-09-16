export function renderVouchersView(): string {
  return `<div id="view-vouchers" class="tab-view" style="display: none;"></div>`;
}

export const VOUCHERS_CLIENT_JS = `
// ============================================================================
// VOUCHERS MODULE CLIENT CONTROLLER (Payment Vouchers - PV)
// ============================================================================

let cachedPVList = [];
let cachedPVAccounts = [];
let cachedPVVendors = [];
let cachedPVEmployees = [];
let pvSearchQuery = '';
let pvYearFilter = '2026';
let pvActiveViewMode = 'table';
let pvShowSummaryCards = true;

function getPvUserStorageKey(prefix) {
  const userId = (typeof state !== 'undefined' && state.user && (state.user.id || state.user.email))
    ? (state.user.id || state.user.email)
    : 'global';
  return prefix + '_' + userId;
}

function loadPvViewModePreference() {
  try {
    const userKey = getPvUserStorageKey('apexs_pv_view_mode');
    const userSaved = localStorage.getItem(userKey);
    if (userSaved === 'cards' || userSaved === 'table') {
      pvActiveViewMode = userSaved;
      return;
    }
    const globalSaved = localStorage.getItem('apexs_pv_view_mode');
    if (globalSaved === 'cards' || globalSaved === 'table') {
      pvActiveViewMode = globalSaved;
      return;
    }
  } catch (e) {}
  pvActiveViewMode = 'table';
}
loadPvViewModePreference();

function loadPvShowCardsPreference() {
  try {
    const userKey = getPvUserStorageKey('apexs_pv_show_summary_cards');
    const userSaved = localStorage.getItem(userKey);
    if (userSaved !== null) {
      pvShowSummaryCards = userSaved === 'true';
      return;
    }
    const globalSaved = localStorage.getItem('apexs_pv_show_summary_cards');
    if (globalSaved !== null) {
      pvShowSummaryCards = globalSaved === 'true';
      return;
    }
  } catch (e) {}
  pvShowSummaryCards = true;
}
loadPvShowCardsPreference();

function getPvYear(v) {
  if (!v) return '2026';
  const rawDate = v.voucherDate || v.createdAt;
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return d.getFullYear().toString();
    }
  }
  if (v.voucherNumber) {
    const match = v.voucherNumber.match(/^(\\d{2})-/);
    if (match) {
      return '20' + match[1];
    }
    const match4 = v.voucherNumber.match(/(20\\d{2})/);
    if (match4) {
      return match4[1];
    }
  }
  return '2026';
}

function getFilteredVouchersList() {
  let list = cachedPVList || [];
  if (pvYearFilter && pvYearFilter !== 'ALL') {
    list = list.filter((v) => getPvYear(v) === pvYearFilter);
  }
  if (pvSearchQuery) {
    const q = pvSearchQuery.toLowerCase();
    list = list.filter((v) => {
      const num = (v.voucherNumber || '').toLowerCase();
      const rec = (v.recipient || v.recipientName || '').toLowerCase();
      const notes = (v.notes || '').toLowerCase();
      const method = (v.paymentMethod || '').toLowerCase();
      return num.includes(q) || rec.includes(q) || notes.includes(q) || method.includes(q);
    });
  }
  return list;
}

async function loadVouchers() {
  const container = document.getElementById('view-vouchers');
  if (!container) return;
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading payment vouchers...</div>');

  try {
    loadPvShowCardsPreference();
    loadPvViewModePreference();
    pvSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';
    pvYearFilter = (typeof getUrlParam === 'function' ? getUrlParam('year') : null) || '2026';

    const [vouchersRes, accountsRes, settingsRes, vendorsRes, empRes] = await Promise.all([
      apiFetch('/api/accounting/vouchers?type=PAYMENT'),
      apiFetch('/api/accounting/accounts').catch(() => null),
      apiFetch('/api/settings/vouchers').catch(() => null),
      apiFetch('/api/purchasing/vendors').catch(() => null),
      apiFetch('/api/payroll/employees').catch(() => null),
    ]);

    const vouchersJson = await vouchersRes.json();
    cachedPVList = (vouchersJson.data || []).filter((v) => v.voucherType === 'PAYMENT');
    cachedVouchers = vouchersJson.data || [];

    if (accountsRes) {
      try {
        const aj = await accountsRes.json();
        cachedPVAccounts = aj.data || [];
        cachedAccounts = cachedPVAccounts;
      } catch (e) {}
    }
    if (settingsRes) {
      try {
        const sj = await settingsRes.json();
        window.cachedVoucherSettings = sj.data || sj.settings || {};
      } catch (e) {}
    }
    if (vendorsRes) {
      try {
        const vj = await vendorsRes.json();
        cachedPVVendors = vj.data || [];
        cachedVendors = cachedPVVendors;
      } catch (e) {}
    }
    if (empRes) {
      try {
        const ej = await empRes.json();
        cachedPVEmployees = ej.data || [];
        cachedEmployees = cachedPVEmployees;
      } catch (e) {}
    }

    renderVouchersContent(container, cachedPVList);
  } catch (err) {
    console.error('Error loading vouchers:', err);
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #dc2626;">Failed to load payment vouchers. ' + err.message + '</div>';
  }
}

function renderSingleVoucherRow(v, isAdmin) {
  const rawDate = v.voucherDate || v.createdAt;
  let formattedDate = '—';
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  let tag = v.tag || v.referenceType || '';
  if (tag === 'MANUAL') tag = '';
  else if (tag === 'PURCHASE_ORDER') tag = 'PO Procurement';
  else if (tag === 'PAYROLL_RUN') tag = 'Payroll';

  let tagBadgeHtml = '<span style="color: #cbd5e1; font-size: 0.8rem;">—</span>';
  if (tag) {
    const escapedTag = escapeHtml(tag);
    tagBadgeHtml = '<span class="badge badge-neutral" style="font-size: 0.69rem; font-weight: 500; padding: 0.12rem 0.35rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; max-width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;" title="#' + escapedTag + '">#' + escapedTag + '</span>';
  }

  let remarksHtml = '<span style="color: #cbd5e1; font-size: 0.8rem;">—</span>';
  if (v.notes && v.notes.trim()) {
    const escapedNotes = escapeHtml(v.notes.trim());
    remarksHtml = '<div style="max-width: 125px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.78rem; color: #64748b;" title="' + escapedNotes + '">' + escapedNotes + '</div>';
  }

  let statusBadge = '<span class="badge badge-success" style="font-size: 0.69rem; padding: 0.14rem 0.38rem; font-weight: 600;"><span class="badge-dot"></span>POSTED</span>';
  if (v.status === 'VOID' || v.status === 'DECLINED') {
    statusBadge = '<span class="badge badge-danger" style="font-size: 0.69rem; padding: 0.14rem 0.38rem; font-weight: 600;"><span class="badge-dot"></span>VOID</span>';
  } else if (v.status === 'DRAFT') {
    statusBadge = '<span class="badge badge-warning" style="font-size: 0.69rem; padding: 0.14rem 0.38rem; font-weight: 600;"><span class="badge-dot"></span>DRAFT</span>';
  }

  const methodMap = {
    'BANK_TRANSFER': 'Bank',
    'CHECK': 'Check',
    'CASH': 'Cash',
    'CREDIT_CARD': 'Card',
    'DEBIT_CARD': 'Card',
    'ONLINE': 'Online',
    'MANUAL': 'Manual',
    'JOURNAL': 'Journal'
  };
  const rawMethod = v.paymentMethod || 'BANK_TRANSFER';
  const shortMethod = methodMap[rawMethod] || rawMethod.replace('_', ' ');

  const fileTextSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
  const downloadSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
  const editSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
  const histSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
  const restoreSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>';
  const voidSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
  const trashSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

  let actionButtons = '';
  actionButtons += '<button type="button" class="icon-btn icon-btn-view has-tooltip" data-tooltip="View Official Slip" title="View Official Slip" onclick="openOfficialVoucherSlipModal(&quot;' + v.id + '&quot;)" aria-label="View Official Slip">' + fileTextSvg + '</button>';
  actionButtons += '<button type="button" class="icon-btn icon-btn-pdf has-tooltip" data-tooltip="Download PDF Slip" title="Download PDF Slip" onclick="downloadSingleVoucherPdf(&quot;' + v.id + '&quot;)" aria-label="Download PDF Slip">' + downloadSvg + '</button>';
  actionButtons += '<button type="button" class="icon-btn icon-btn-edit has-tooltip" data-tooltip="Edit Voucher" title="Edit Voucher" onclick="openEditVoucherModal(&quot;' + v.id + '&quot;)" aria-label="Edit Voucher">' + editSvg + '</button>';

  const histCount = v.historyCount || 0;
  const countBadgeClass = histCount > 0 ? 'has-records' : 'zero-records';
  const histTooltip = 'Audit History (' + histCount + ')';
  actionButtons += '<button type="button" class="icon-btn icon-btn-view btn-history-badge-container has-tooltip" data-tooltip="' + histTooltip + '" title="View Revision History & Audit Trail (' + histCount + ' record' + (histCount === 1 ? '' : 's') + ')" onclick="openVoucherHistoryModal(&quot;' + v.id + '&quot;)" aria-label="Audit History">' + histSvg + '<span class="history-count-badge ' + countBadgeClass + '">' + histCount + '</span></button>';

  if (v.status === 'VOID' || v.status === 'DECLINED') {
    actionButtons += '<button type="button" class="icon-btn icon-btn-restore has-tooltip" data-tooltip="Restore Voucher" title="Restore Voucher" onclick="restoreVoucher(&quot;' + v.id + '&quot;)" aria-label="Restore Voucher">' + restoreSvg + '</button>';
  } else {
    actionButtons += '<button type="button" class="icon-btn icon-btn-decline has-tooltip" data-tooltip="Void Voucher" title="Void / Decline Voucher" onclick="declineVoucher(&quot;' + v.id + '&quot;)" aria-label="Void Voucher">' + voidSvg + '</button>';
  }

  if (isAdmin) {
    actionButtons += '<button type="button" class="icon-btn icon-btn-delete has-tooltip" data-tooltip="Delete Voucher" title="Delete Permanently" onclick="deleteVoucherPermanent(&quot;' + v.id + '&quot;)" aria-label="Delete Permanently">' + trashSvg + '</button>';
  }

  const recipientName = escapeHtml(v.recipient || v.recipientName || '—');

  return (
    '<tr class="pv-table-row" onclick="openVoucherOverviewModal(&quot;' + v.id + '&quot;)" title="Click to view voucher overview">' +
    '<td class="td-voucher-num" data-label="Voucher #" style="white-space: nowrap;">' +
    '<a href="javascript:void(0)" class="pv-num-link" onclick="openVoucherOverviewModal(&quot;' + v.id + '&quot;)" style="font-family: var(--font-mono, monospace); color: var(--primary, #2563eb); font-size: 0.82rem; font-weight: 600; letter-spacing: -0.01em; text-decoration: none;" title="Click to view voucher overview">' + v.voucherNumber + '</a>' +
    '<div class="pv-card-amount" style="font-weight: 700; color: #dc2626; font-family: var(--font-mono, monospace); font-size: 0.84rem; white-space: nowrap;">- ' + formatCurrency(v.amountCents || 0, v.currency || 'PHP') + '</div>' +
    '</td>' +
    '<td class="td-date" data-label="Date" style="white-space: nowrap; font-size: 0.80rem; color: #475569; font-weight: 500;">' + formattedDate + '</td>' +
    '<td class="td-recipient" data-label="Payee / Recipient">' +
    '<div style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + recipientName + '">' +
    '<strong style="color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem; font-weight: 600;">' + recipientName + '</strong>' +
    '</div>' +
    '</td>' +
    '<td class="td-tag" data-label="Tag / Category" style="white-space: nowrap;">' + tagBadgeHtml + '</td>' +
    '<td class="td-remarks" data-label="Remarks">' + remarksHtml + '</td>' +
    '<td class="td-method" data-label="Method" style="text-align: center; white-space: nowrap;"><span class="badge" style="font-size: 0.69rem; font-weight: 600; padding: 0.12rem 0.35rem; white-space: nowrap; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 4px;" title="' + escapeHtml(rawMethod) + '">' + escapeHtml(shortMethod) + '</span></td>' +
    '<td class="td-amount" data-label="Total Amount" style="text-align: right; font-weight: 700; color: #dc2626; font-family: var(--font-mono, monospace); font-size: 0.84rem; white-space: nowrap; letter-spacing: -0.01em;">- ' + formatCurrency(v.amountCents || 0, v.currency || 'PHP') + '</td>' +
    '<td class="td-status" data-label="Status" style="text-align: center; white-space: nowrap;">' + statusBadge + '</td>' +
    '<td class="td-actions" data-label="Actions" style="text-align: right; white-space: nowrap;" onclick="event.stopPropagation()"><div class="pv-actions-group">' + actionButtons + '</div></td>' +
    '</tr>'
  );
}

function openVoucherOverviewModal(voucherId) {
  const v = (typeof cachedPVList !== 'undefined' ? cachedPVList.find((x) => x.id === voucherId) : null) ||
            (typeof cachedVouchers !== 'undefined' ? cachedVouchers.find((x) => x.id === voucherId) : null);
  if (!v) {
    if (typeof showToast === 'function') showToast('Payment voucher not found', 'warning');
    return;
  }

  const rawDate = v.voucherDate || v.createdAt;
  let formattedDate = '—';
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  let tag = v.tag || v.referenceType || '';
  if (tag === 'MANUAL') tag = '';
  else if (tag === 'PURCHASE_ORDER') tag = 'PO Procurement';
  else if (tag === 'PAYROLL_RUN') tag = 'Payroll';

  let tagBadgeHtml = '<span style="color: #94a3b8; font-size: 0.8rem;">—</span>';
  if (tag) {
    const escapedTag = escapeHtml(tag);
    tagBadgeHtml = '<span class="badge badge-neutral" style="font-size: 0.72rem; font-weight: 500; padding: 0.15rem 0.45rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px;">#' + escapedTag + '</span>';
  }

  let statusBadge = '<span class="badge badge-success" style="font-size: 0.72rem; padding: 0.16rem 0.45rem; font-weight: 600;"><span class="badge-dot"></span>POSTED</span>';
  if (v.status === 'VOID' || v.status === 'DECLINED') {
    statusBadge = '<span class="badge badge-danger" style="font-size: 0.72rem; padding: 0.16rem 0.45rem; font-weight: 600;"><span class="badge-dot"></span>VOID</span>';
  } else if (v.status === 'DRAFT') {
    statusBadge = '<span class="badge badge-warning" style="font-size: 0.72rem; padding: 0.16rem 0.45rem; font-weight: 600;"><span class="badge-dot"></span>DRAFT</span>';
  }

  const methodMap = {
    'BANK_TRANSFER': 'Bank Transfer',
    'CHECK': 'Check Payment',
    'CASH': 'Cash Payment',
    'CREDIT_CARD': 'Credit Card',
    'DEBIT_CARD': 'Debit Card',
    'ONLINE': 'Online Clearing',
    'MANUAL': 'Manual',
    'JOURNAL': 'Journal Entry'
  };
  const rawMethod = v.paymentMethod || 'BANK_TRANSFER';
  const fullMethod = methodMap[rawMethod] || rawMethod.replace(/_/g, ' ');

  let items = v.items || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (_) { items = []; }
  }
  if (!Array.isArray(items) || items.length === 0) {
    items = [{
      invoiceNo: v.referenceId || '',
      description: v.notes || (v.recipient ? (v.recipient + ' disbursement') : 'Disbursement'),
      amountCents: v.amountCents || 0
    }];
  }

  const defaultSign = (window.cachedVoucherSettings && window.cachedVoucherSettings['vouchers.signatories']) || {};
  let sig = v.signatories;
  if (typeof sig === 'string') {
    try { sig = JSON.parse(sig); } catch (_) { sig = {}; }
  }
  sig = sig || {};
  const preparedBy = sig.preparedBy || defaultSign.preparedBy || 'Administrator';
  const certifiedBy = sig.certifiedBy || defaultSign.certifiedBy || 'Joy/Admin';
  const approvedBy = sig.approvedBy || defaultSign.approvedBy || 'Kenneth Brown/CEO';
  const receivedBy = sig.receivedBy || defaultSign.receivedBy || (v.recipient || 'Signature over printed name');

  const recipientName = escapeHtml(v.recipient || v.recipientName || '—');
  const currency = v.currency || 'PHP';

  let itemRowsHtml = '';
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const amtCents = it.amountCents !== undefined ? it.amountCents : Math.round((it.amount || 0) * 100);
    itemRowsHtml +=
      '<tr style="border-bottom: 1px solid #f1f5f9;">' +
      '<td style="padding: 0.55rem 0.75rem; text-align: center; color: #94a3b8; font-size: 0.78rem; font-family: var(--font-mono, monospace);">' + (i + 1) + '</td>' +
      '<td style="padding: 0.55rem 0.75rem; color: #334155; font-size: 0.80rem; font-family: var(--font-mono, monospace); font-weight: 500;">' + (it.invoiceNo ? escapeHtml(it.invoiceNo) : '<span style="color: #cbd5e1;">—</span>') + '</td>' +
      '<td style="padding: 0.55rem 0.75rem; color: #0f172a; font-size: 0.82rem; font-weight: 500;">' + escapeHtml(it.description || '—') + '</td>' +
      '<td style="padding: 0.55rem 0.75rem; text-align: right; color: #0f172a; font-size: 0.82rem; font-family: var(--font-mono, monospace); font-weight: 600;">' + formatCurrency(amtCents, currency) + '</td>' +
      '</tr>';
  }

  const histCount = v.historyCount || 0;
  const countBadgeClass = histCount > 0 ? 'has-records' : 'zero-records';

  const fileTextSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
  const downloadSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
  const editSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
  const histSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';

  const isReceipt = v.voucherType === 'RECEIPT';
  const amountPrefix = isReceipt ? '+ ' : (v.voucherType === 'PAYMENT' ? '- ' : '');
  const amountColor = isReceipt ? '#059669' : (v.voucherType === 'PAYMENT' ? '#dc2626' : '#2563eb');
  const amountCardLabel = isReceipt ? 'Total Received' : (v.voucherType === 'PAYMENT' ? 'Total Disbursed' : 'Voucher Amount');
  const partyCardLabel = isReceipt ? 'Payer / Customer' : 'Payee / Recipient';
  const partyTypeSubtext = escapeHtml(v.recipientType || (isReceipt ? 'Customer' : 'Vendor / Payee'));

  const modalBody =
    '<div class="pv-overview-container" style="display: flex; flex-direction: column; gap: 1rem;">' +

    '<!-- HEADER STRIP -->' +
    '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1.15rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">' +
    '<div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">' +
    '<div style="font-family: var(--font-mono, monospace); font-size: 1.15rem; font-weight: 700; color: #1e293b; letter-spacing: -0.02em;">' + escapeHtml(v.voucherNumber) + '</div>' +
    statusBadge +
    tagBadgeHtml +
    '</div>' +
    '<div style="display: flex; align-items: center; gap: 1rem; font-size: 0.82rem; color: #64748b;">' +
    '<div><span style="color: #94a3b8; font-weight: 500;">Voucher Date:</span> <strong style="color: #334155; margin-left: 0.25rem;">' + formattedDate + '</strong></div>' +
    '<div><span style="color: #94a3b8; font-weight: 500;">Method:</span> <strong style="color: #334155; margin-left: 0.25rem;">' + escapeHtml(fullMethod) + '</strong></div>' +
    '</div>' +
    '</div>' +

    '<!-- 4 KPI SUMMARY CARDS -->' +
    '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem;">' +
    '<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">' +
    '<div style="font-size: 0.70rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 0.25rem;">' + amountCardLabel + '</div>' +
    '<div style="font-size: 1.2rem; font-weight: 800; font-family: var(--font-mono, monospace); color: ' + amountColor + '; letter-spacing: -0.02em;">' + amountPrefix + formatCurrency(v.amountCents || 0, currency) + '</div>' +
    '<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.2rem;">' + currency + ' ' + (isReceipt ? 'Collection' : 'Disbursement') + '</div>' +
    '</div>' +
    '<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">' +
    '<div style="font-size: 0.70rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 0.25rem;">' + partyCardLabel + '</div>' +
    '<div style="font-size: 0.95rem; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + recipientName + '">' + recipientName + '</div>' +
    '<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.2rem;">' + partyTypeSubtext + '</div>' +
    '</div>' +
    '<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">' +
    '<div style="font-size: 0.70rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 0.25rem;">Disbursement Method</div>' +
    '<div style="font-size: 0.95rem; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(fullMethod) + '</div>' +
    '<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.2rem;">' + (v.referenceId ? ('Ref: ' + escapeHtml(v.referenceId)) : 'Standard Settlement') + '</div>' +
    '</div>' +
    '<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">' +
    '<div style="font-size: 0.70rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 0.25rem;">Particulars Breakdown</div>' +
    '<div style="font-size: 1.2rem; font-weight: 800; font-family: var(--font-mono, monospace); color: #2563eb; letter-spacing: -0.02em;">' + items.length + ' ' + (items.length === 1 ? 'Line' : 'Lines') + '</div>' +
    '<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.2rem;">' + histCount + ' Audit Record' + (histCount === 1 ? '' : 's') + '</div>' +
    '</div>' +
    '</div>' +

    '<!-- REMARKS PANEL -->' +
    '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.8rem 1rem;">' +
    '<div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 0.35rem;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
    '<span>Disbursement Purpose & Remarks</span>' +
    '</div>' +
    '<div style="font-size: 0.84rem; color: #1e293b; line-height: 1.5; word-break: break-word;">' +
    (v.notes && v.notes.trim() ? escapeHtml(v.notes.trim()) : '<span style="color: #94a3b8; font-style: italic;">No specific remarks recorded for this voucher.</span>') +
    '</div>' +
    '</div>' +

    '<!-- ITEMIZED TABLE -->' +
    '<div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">' +
    '<div style="background: #f8fafc; padding: 0.6rem 1rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">' +
    '<div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #475569;">Itemized Particulars</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; font-weight: 500;">Currency: <strong style="color: #0f172a;">' + currency + '</strong></div>' +
    '</div>' +
    '<div class="table-responsive" style="margin: 0;">' +
    '<table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">' +
    '<thead>' +
    '<tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">' +
    '<th style="padding: 0.5rem 0.75rem; text-align: center; width: 40px; font-weight: 700; color: #64748b; font-size: 0.70rem; text-transform: uppercase;">#</th>' +
    '<th style="padding: 0.5rem 0.75rem; text-align: left; width: 140px; font-weight: 700; color: #64748b; font-size: 0.70rem; text-transform: uppercase;">Invoice / Ref #</th>' +
    '<th style="padding: 0.5rem 0.75rem; text-align: left; font-weight: 700; color: #64748b; font-size: 0.70rem; text-transform: uppercase;">Description / Particulars</th>' +
    '<th style="padding: 0.5rem 0.75rem; text-align: right; width: 140px; font-weight: 700; color: #64748b; font-size: 0.70rem; text-transform: uppercase;">Amount</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' +
    itemRowsHtml +
    '</tbody>' +
    '<tfoot>' +
    '<tr style="background: #f8fafc; border-top: 2px solid #e2e8f0; font-weight: 700;">' +
    '<td colspan="3" style="padding: 0.65rem 0.75rem; text-align: right; color: #475569; font-size: 0.80rem; text-transform: uppercase; letter-spacing: 0.03em;">Total:</td>' +
    '<td style="padding: 0.65rem 0.75rem; text-align: right; font-family: var(--font-mono, monospace); font-size: 0.92rem; color: ' + amountColor + ';">' + amountPrefix + formatCurrency(v.amountCents || 0, currency) + '</td>' +
    '</tr>' +
    '</tfoot>' +
    '</table>' +
    '</div>' +
    '</div>' +

    '<!-- SIGNATORIES STATUS -->' +
    '<div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">' +
    '<div style="background: #f8fafc; padding: 0.55rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #475569;">Official Signatories</div>' +
    '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); background: #ffffff;">' +
    '<div style="padding: 0.75rem; border-right: 1px solid #f1f5f9; text-align: center;">' +
    '<div style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.2rem;">Prepared By</div>' +
    '<div style="font-size: 0.82rem; font-weight: 600; color: #0f172a; word-break: break-word;">' + escapeHtml(preparedBy) + '</div>' +
    '</div>' +
    '<div style="padding: 0.75rem; border-right: 1px solid #f1f5f9; text-align: center;">' +
    '<div style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.2rem;">Certified Correct</div>' +
    '<div style="font-size: 0.82rem; font-weight: 600; color: #0f172a; word-break: break-word;">' + escapeHtml(certifiedBy) + '</div>' +
    '</div>' +
    '<div style="padding: 0.75rem; border-right: 1px solid #f1f5f9; text-align: center;">' +
    '<div style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.2rem;">Approved By</div>' +
    '<div style="font-size: 0.82rem; font-weight: 600; color: #0f172a; word-break: break-word;">' + escapeHtml(approvedBy) + '</div>' +
    '</div>' +
    '<div style="padding: 0.75rem; text-align: center;">' +
    '<div style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.2rem;">Received By</div>' +
    '<div style="font-size: 0.82rem; font-weight: 600; color: #0f172a; word-break: break-word;">' + escapeHtml(receivedBy) + '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +

    '</div>';

  const modalFooter =
    '<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 0.5rem;">' +
    '<div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">' +
    '<button type="button" class="btn btn-secondary" onclick="openOfficialVoucherSlipModal(&quot;' + v.id + '&quot;)" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.80rem; font-weight: 600; padding: 0.42rem 0.75rem;">' + fileTextSvg + '<span>Official Slip</span></button>' +
    '<button type="button" class="btn btn-secondary" onclick="downloadSingleVoucherPdf(&quot;' + v.id + '&quot;)" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.80rem; font-weight: 600; padding: 0.42rem 0.75rem;">' + downloadSvg + '<span>Download PDF</span></button>' +
    '<button type="button" class="btn btn-secondary" onclick="openEditVoucherModal(&quot;' + v.id + '&quot;)" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.80rem; font-weight: 600; padding: 0.42rem 0.75rem;">' + editSvg + '<span>Edit Voucher</span></button>' +
    '<button type="button" class="btn btn-secondary btn-history-badge-container" onclick="openVoucherHistoryModal(&quot;' + v.id + '&quot;)" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.80rem; font-weight: 600; padding: 0.42rem 0.75rem;">' + histSvg + '<span>Audit History</span><span class="history-count-badge ' + countBadgeClass + '">' + histCount + '</span></button>' +
    '</div>' +
    '<button type="button" class="btn btn-primary" onclick="closeModal()" style="font-size: 0.80rem; font-weight: 600; padding: 0.42rem 1.15rem;">Close</button>' +
    '</div>';

  openModal('Payment Voucher Overview — ' + v.voucherNumber, modalBody, modalFooter, 'lg');
}

function handlePvSearch(query) {
  pvSearchQuery = (query || '').toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', pvSearchQuery || null);
  }

  const tableBody = document.getElementById('pv-table-body');
  const countEl = document.getElementById('pv-header-count');
  if (tableBody && countEl) {
    const filtered = getFilteredVouchersList();
    filtered.sort((a, b) => {
      const timeB = new Date(b.updatedAt || b.createdAt || b.voucherDate || 0).getTime();
      const timeA = new Date(a.updatedAt || a.createdAt || a.voucherDate || 0).getTime();
      return timeB - timeA;
    });

    countEl.innerHTML = 'Showing <strong>' + filtered.length + '</strong> voucher(s)';

    const totalDisbursedCents = filtered.filter((v) => v.status === 'POSTED').reduce((sum, v) => sum + (v.amountCents || 0), 0);
    const postedCount = filtered.filter((v) => v.status === 'POSTED').length;
    const voidedCount = filtered.filter((v) => v.status === 'VOID' || v.status === 'DECLINED').length;
    const draftCount = filtered.filter((v) => v.status === 'DRAFT').length;

    const kpiDisbursed = document.getElementById('pv-kpi-total-disbursed');
    if (kpiDisbursed) kpiDisbursed.textContent = formatCurrency(totalDisbursedCents, 'PHP');
    const kpiPosted = document.getElementById('pv-kpi-posted-count');
    if (kpiPosted) kpiPosted.textContent = String(postedCount);
    const kpiDraft = document.getElementById('pv-kpi-draft-count');
    if (kpiDraft) kpiDraft.textContent = String(draftCount);
    const kpiVoid = document.getElementById('pv-kpi-voided-count');
    if (kpiVoid) kpiVoid.textContent = String(voidedCount);

    const isAdmin = state.user && state.user.role === 'ADMIN';
    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="9" style="text-align: center; color: #64748b; padding: 2.5rem;">No payment vouchers found' + (pvYearFilter !== 'ALL' ? ' for year ' + pvYearFilter : '') + '.</td></tr>';
    } else {
      tableBody.innerHTML = filtered.map((v) => renderSingleVoucherRow(v, isAdmin)).join('');
    }
    return;
  }

  const searchInput = document.getElementById('pv-search-input');
  const selStart = searchInput ? searchInput.selectionStart : null;
  const selEnd = searchInput ? searchInput.selectionEnd : null;

  const container = document.getElementById('view-vouchers');
  if (container) {
    renderVouchersContent(container, cachedPVList);
  }

  const newSearchInput = document.getElementById('pv-search-input');
  if (newSearchInput && selStart !== null) {
    newSearchInput.focus();
    try {
      newSearchInput.setSelectionRange(selStart, selEnd);
    } catch (e) {}
  }
}

function handlePvYearFilter(year) {
  pvYearFilter = year;
  if (typeof setUrlParam === 'function') {
    setUrlParam('year', pvYearFilter === '2026' ? null : pvYearFilter);
  }
  const container = document.getElementById('view-vouchers');
  if (container) {
    renderVouchersContent(container, cachedPVList);
  }
}

function handlePvActiveViewMode(mode) {
  pvActiveViewMode = mode;
  try {
    localStorage.setItem(getPvUserStorageKey('apexs_pv_view_mode'), mode);
    localStorage.setItem('apexs_pv_view_mode', mode);
  } catch (e) {}
  const table = document.getElementById('pv-data-table');
  if (table) {
    table.classList.remove('view-mode-cards', 'view-mode-table');
    if (mode === 'cards') table.classList.add('view-mode-cards');
    else if (mode === 'table') table.classList.add('view-mode-table');
  }
  document.querySelectorAll('#view-vouchers .btn-view-mode').forEach((btn) => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector('#view-vouchers .btn-view-mode[data-mode="' + mode + '"]');
  if (activeBtn) activeBtn.classList.add('active');
}

function handlePvToggleSummaryCards(forceVal) {
  if (typeof forceVal === 'boolean') {
    pvShowSummaryCards = forceVal;
  } else {
    pvShowSummaryCards = !pvShowSummaryCards;
  }
  try {
    localStorage.setItem(getPvUserStorageKey('apexs_pv_show_summary_cards'), String(pvShowSummaryCards));
    localStorage.setItem('apexs_pv_show_summary_cards', String(pvShowSummaryCards));
  } catch (e) {}

  const kpiContainer = document.getElementById('pv-kpi-container');
  if (kpiContainer) {
    kpiContainer.style.display = pvShowSummaryCards ? 'grid' : 'none';
  }

  const toggleBtn = document.getElementById('pv-toggle-summary-btn');
  if (toggleBtn) {
    const iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>';
    toggleBtn.innerHTML = iconSvg + '<span>' + (pvShowSummaryCards ? 'Hide Cards' : 'Show Cards') + '</span>';
    toggleBtn.title = pvShowSummaryCards ? 'Hide summary metric cards' : 'Show summary metric cards';
  }

  const checkbox = document.getElementById('pv-show-cards-checkbox');
  if (checkbox && checkbox.checked !== pvShowSummaryCards) {
    checkbox.checked = pvShowSummaryCards;
  }
}

function getItemizedCsvData(list) {
  const headers = [
    'Voucher #',
    'Voucher Date',
    'Type',
    'Payee / Recipient',
    'Line #',
    'Invoice No / Ref',
    'Line Description / Particulars',
    'Line Amount (PHP)',
    'Voucher Total Amount (PHP)',
    'Payment Method',
    'Status',
    'Tag / Category',
    'Memo / Remarks',
    'Prepared By',
    'Certified By',
    'Approved By',
    'Received By'
  ];

  const rows = [];
  (list || []).forEach((v) => {
    let items = v.items || [];
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (_) { items = []; }
    }
    if (!items || items.length === 0) {
      items = [{
        invoiceNo: v.referenceId || '',
        description: v.notes || (v.recipient ? (v.recipient + ' disbursement') : 'Disbursement'),
        amountCents: v.amountCents || 0,
      }];
    }

    let sig = v.signatories;
    if (typeof sig === 'string') {
      try { sig = JSON.parse(sig); } catch (_) { sig = {}; }
    }
    sig = sig || {};

    const rawDate = v.voucherDate || v.createdAt;
    const isoDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '';
    const vTotal = (((v.amountCents || 0) / 100)).toFixed(2);

    items.forEach((it, idx) => {
      rows.push([
        v.voucherNumber,
        isoDate,
        v.voucherType || 'PAYMENT',
        v.recipient || v.recipientName || '',
        idx + 1,
        it.invoiceNo || '',
        it.description || '',
        (((it.amountCents || 0) / 100)).toFixed(2),
        vTotal,
        v.paymentMethod || 'BANK_TRANSFER',
        v.status || 'POSTED',
        v.tag || v.referenceType || '',
        v.notes || '',
        sig.preparedBy || '',
        sig.certifiedBy || '',
        sig.approvedBy || '',
        sig.receivedBy || ''
      ]);
    });
  });

  return { headers, rows };
}

function getSummaryCsvData(list) {
  const headers = [
    'Voucher #',
    'Date',
    'Type',
    'Payee / Recipient',
    'Line Items Count',
    'Total Amount (PHP)',
    'Payment Method',
    'Status',
    'Tag / Category',
    'Line Items Summary',
    'Memo / Remarks',
    'Prepared By',
    'Approved By'
  ];

  const rows = (list || []).map((v) => {
    let items = v.items || [];
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (_) { items = []; }
    }
    if (!items || items.length === 0) {
      items = [{
        invoiceNo: v.referenceId || '',
        description: v.notes || (v.recipient ? (v.recipient + ' disbursement') : 'Disbursement'),
        amountCents: v.amountCents || 0,
      }];
    }

    let sig = v.signatories;
    if (typeof sig === 'string') {
      try { sig = JSON.parse(sig); } catch (_) { sig = {}; }
    }
    sig = sig || {};

    const itemsSummary = items.map((it, i) => (i + 1) + '. ' + (it.invoiceNo ? '[' + it.invoiceNo + '] ' : '') + (it.description || '') + ' (₱' + (((it.amountCents || 0) / 100)).toFixed(2) + ')').join('; ');
    const rawDate = v.voucherDate || v.createdAt;
    const isoDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '';

    return [
      v.voucherNumber,
      isoDate,
      v.voucherType || 'PAYMENT',
      v.recipient || v.recipientName || '',
      items.length,
      (((v.amountCents || 0) / 100)).toFixed(2),
      v.paymentMethod || 'BANK_TRANSFER',
      v.status || 'POSTED',
      v.tag || v.referenceType || '',
      itemsSummary,
      v.notes || '',
      sig.preparedBy || '',
      sig.approvedBy || ''
    ];
  });

  return { headers, rows };
}

function exportItemizedVouchersCsv() {
  const list = getFilteredVouchersList();
  if (!list || list.length === 0) {
    showToast('No vouchers found to export', 'warning');
    return;
  }
  const data = getItemizedCsvData(list);
  const yrSuffix = pvYearFilter && pvYearFilter !== 'ALL' ? '_' + pvYearFilter : '';
  exportToCsv('vouchers_itemized_ledger' + yrSuffix + '_' + new Date().toISOString().slice(0, 10), data.headers, data.rows);
  showToast('Itemized ledger CSV exported (' + data.rows.length + ' lines)', 'success');
}

function exportSummaryVouchersCsv() {
  const list = getFilteredVouchersList();
  if (!list || list.length === 0) {
    showToast('No vouchers found to export', 'warning');
    return;
  }
  const data = getSummaryCsvData(list);
  const yrSuffix = pvYearFilter && pvYearFilter !== 'ALL' ? '_' + pvYearFilter : '';
  exportToCsv('vouchers_summary' + yrSuffix + '_' + new Date().toISOString().slice(0, 10), data.headers, data.rows);
  showToast('Summary CSV exported (' + data.rows.length + ' vouchers)', 'success');
}

function exportPaymentVouchersCsv() {
  exportItemizedVouchersCsv();
}

async function exportFilteredVouchersZip() {
  if (typeof JSZip === 'undefined') {
    showToast('ZIP library is loading, please try again in a moment', 'warning');
    return;
  }

  const list = getFilteredVouchersList();
  if (!list || list.length === 0) {
    showToast('No payment vouchers found to export', 'warning');
    return;
  }

  const total = list.length;
  window.__cancelZipExport = false;

  const modalBody =
    '<div style="padding: 1.25rem 0.5rem; text-align: center;">' +
    '<div style="width: 48px; height: 48px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 0.75rem; border: 1px solid #dbeafe;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' +
    '</div>' +
    '<h3 style="margin-bottom: 0.35rem; font-size: 1.15rem; color: #1e293b; font-weight: 700;">Packaging Voucher PDF Archive</h3>' +
    '<p style="color: #64748b; font-size: 0.88rem; margin-bottom: 1.25rem; line-height: 1.45;">' +
    'Generating <strong>' + total + '</strong> individual official PDF slip(s) and packaging them into a ZIP file with CSV summaries...' +
    '</p>' +
    '<div style="background: #e2e8f0; border-radius: 9999px; height: 14px; overflow: hidden; margin-bottom: 0.75rem; width: 100%;">' +
    '<div id="zip-progress-bar" style="background: var(--primary, #0284c7); height: 100%; width: 0%; transition: width 0.15s ease;"></div>' +
    '</div>' +
    '<div id="zip-progress-text" style="font-size: 0.84rem; font-weight: 600; color: #334155;">' +
    'Initializing export queue (0 / ' + total + ')...' +
    '</div>' +
    '</div>';

  const modalFooter =
    '<button type="button" class="btn btn-secondary" onclick="window.__cancelZipExport = true; closeModal();">Cancel Export</button>';

  openModal('Export Vouchers to ZIP', modalBody, modalFooter, 'md');

  const zip = new JSZip();
  const pdfFolder = zip.folder('pdf_slips');
  let successCount = 0;

  for (let i = 0; i < list.length; i++) {
    if (window.__cancelZipExport) {
      showToast('Export cancelled', 'info');
      return;
    }

    const v = list[i];
    const progressBar = document.getElementById('zip-progress-bar');
    const progressText = document.getElementById('zip-progress-text');
    const percent = Math.round(((i + 1) / total) * 90);

    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.innerText = 'Converting (' + (i + 1) + ' / ' + total + '): ' + v.voucherNumber;

    try {
      if (typeof generateVoucherPdfBlob === 'function') {
        const pdfResult = await generateVoucherPdfBlob(v);
        if (pdfResult && pdfResult.blob) {
          pdfFolder.file(pdfResult.filename, pdfResult.blob);
          successCount++;
        }
      }
    } catch (err) {
      console.error('Error generating PDF for voucher:', v.voucherNumber, err);
    }

    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  if (window.__cancelZipExport) return;

  const progressBar = document.getElementById('zip-progress-bar');
  const progressText = document.getElementById('zip-progress-text');
  if (progressBar) progressBar.style.width = '95%';
  if (progressText) progressText.innerText = 'Attaching CSV ledgers and compressing ZIP...';

  try {
    const itemizedData = getItemizedCsvData(list);
    const summaryData = getSummaryCsvData(list);
    if (typeof generateCsvString === 'function') {
      zip.file('vouchers_itemized_ledger.csv', generateCsvString(itemizedData.headers, itemizedData.rows));
      zip.file('vouchers_summary.csv', generateCsvString(summaryData.headers, summaryData.rows));
    }
  } catch (err) {
    console.warn('Could not attach CSV to zip:', err);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  closeModal();

  const yrSuffix = pvYearFilter && pvYearFilter !== 'ALL' ? '_' + pvYearFilter : '';
  const zipName = 'Apexs_Payment_Vouchers' + yrSuffix + '_' + new Date().toISOString().slice(0, 10) + '.zip';

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('ZIP archive (' + successCount + ' PDF slips + CSV) downloaded successfully!', 'success');
}

function openVoucherExportModal() {
  const list = getFilteredVouchersList();
  const count = list.length;
  const yrLabel = pvYearFilter && pvYearFilter !== 'ALL' ? ' (' + pvYearFilter + ')' : ' (All Years)';

  const body =
    '<div style="padding: 0.5rem 0.25rem;">' +
    '<div style="margin-bottom: 1.25rem; font-size: 0.88rem; color: #475569; line-height: 1.5;">' +
    'Select your preferred export format for the <strong>' + count + '</strong> currently filtered payment voucher(s)' + yrLabel + ':' +
    '</div>' +

    '<!-- OPTION 1: ZIP ARCHIVE OF PDF SLIPS -->' +
    '<div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="flex: 1; min-width: 240px;">' +
    '<div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">' +
    '<span style="width: 28px; height: 28px; border-radius: 6px; background: #eff6ff; color: #2563eb; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></span>' +
    '<span>Export All to ZIP Archive (Individual PDFs + CSV)</span>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b; line-height: 1.4; padding-left: 2.25rem;">' +
    'Generates a separate official PDF slip for every voucher (half-bond paper format with signatories) bundled into a single compressed .zip file with CSV ledgers.' +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-primary btn-sm" onclick="closeModal(); exportFilteredVouchersZip();" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
    '<span>Download ZIP</span>' +
    '</button>' +
    '</div>' +

    '<!-- OPTION 2: ITEMIZED LEDGER CSV -->' +
    '<div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="flex: 1; min-width: 240px;">' +
    '<div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">' +
    '<span style="width: 28px; height: 28px; border-radius: 6px; background: #f0fdf4; color: #16a34a; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></span>' +
    '<span>Itemized Ledger CSV (All Breakdown Lines)</span>' +
    '<span class="badge badge-success" style="font-size: 0.7rem; margin-left: 0.35rem;">Recommended</span>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b; line-height: 1.4; padding-left: 2.25rem;">' +
    'Each row represents a specific breakdown line item with Invoice #, Account Description, and Amount. Best for Excel auditing, Pivot Tables, and financial reconciliations.' +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="closeModal(); exportItemizedVouchersCsv();" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
    '<span>Download CSV</span>' +
    '</button>' +
    '</div>' +

    '<!-- OPTION 3: SUMMARY CSV -->' +
    '<div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="flex: 1; min-width: 240px;">' +
    '<div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">' +
    '<span style="width: 28px; height: 28px; border-radius: 6px; background: #f8fafc; color: #475569; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #e2e8f0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg></span>' +
    '<span>Summary CSV (1 Row per Voucher)</span>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b; line-height: 1.4; padding-left: 2.25rem;">' +
    'High-level summary where each voucher is exactly one row with total amounts, line counts, payment method, remarks, and signatories.' +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="closeModal(); exportSummaryVouchersCsv();" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
    '<span>Download CSV</span>' +
    '</button>' +
    '</div>' +

    '</div>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>';

  openModal('Export Payment Vouchers', body, footer, 'lg');
}

let pendingImportVouchers = [];

function openVoucherImportModal() {
  pendingImportVouchers = [];
  const body =
    '<div style="padding: 0.5rem 0.25rem;">' +
    '<div style="color: #475569; font-size: 0.88rem; margin-bottom: 1.25rem; line-height: 1.45;">' +
    'Import vouchers via <strong>Itemized Ledger CSV</strong> or <strong>Summary CSV</strong>. The ERP system will validate rows, create payment vouchers, and post the double-entry transactions to the General Ledger.' +
    '</div>' +
    '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; margin-bottom: 1.25rem;">' +
    '<div style="width: 48px; height: 48px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 0.65rem; border: 1px solid #dbeafe;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' +
    '</div><br/>' +
    '<label style="display: inline-block; cursor: pointer; background: var(--primary, #0284c7); color: #ffffff; padding: 0.5rem 1.15rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem;">' +
    'Choose CSV File' +
    '<input type="file" id="voucher-csv-input" accept=".csv" style="display: none;" onchange="handleVoucherCsvSelected(this)" />' +
    '</label>' +
    '<div id="voucher-csv-status" style="font-size: 0.82rem; color: #64748b; margin-top: 0.25rem;">Supports Itemized Ledger or Summary CSV format</div>' +
    '</div>' +
    '<div id="voucher-import-preview-box" style="display: none; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem; background: #ffffff; max-height: 220px; overflow-y: auto;">' +
    '<div id="voucher-import-preview-title" style="font-weight: 700; font-size: 0.84rem; color: #0f172a; margin-bottom: 0.45rem;"></div>' +
    '<div id="voucher-import-preview-content" style="font-size: 0.78rem; color: #334155;"></div>' +
    '</div>' +
    '</div>';

  const footer =
    '<button type="button" id="btn-submit-voucher-import" class="btn btn-primary" onclick="submitVoucherCsvImport()" disabled style="display: inline-flex; align-items: center; gap: 0.4rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg><span>Import Vouchers</span></button>' +
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>';

  openModal('Import Payment Vouchers', body, footer, 'lg');
}

function handleVoucherCsvSelected(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const statusEl = document.getElementById('voucher-csv-status');
  if (statusEl) statusEl.innerText = 'Reading ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)...';

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    parseVoucherCsvText(text, file.name);
  };
  reader.readAsText(file);
}

function parseVoucherCsvText(csvText, filename) {
  const lines = (csvText || '').replace(new RegExp('\\r', 'g'), '').split(String.fromCharCode(10)).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    showToast('CSV file is empty or missing data rows', 'warning');
    return;
  }

  function parseCsvLine(line) {
    const row = [];
    let inQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === ',' && !inQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += c;
      }
    }
    row.push(entry.trim());
    return row;
  }

  const vouchersMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const r = parseCsvLine(lines[i]);
    if (r.length < 2 || !r[0]) continue;

    const voucherNum = r[0];
    const vDate = r[1] || '';
    const payee = r[3] || '';
    const invNo = r[5] || '';
    const desc = r[6] || '';
    const lineAmt = parseFloat((r[7] || '0').replace(/,/g, '')) || 0;
    const totalAmt = parseFloat((r[8] || '0').replace(/,/g, '')) || 0;
    const method = r[9] || 'BANK_TRANSFER';
    const tag = r[11] || '';
    const remarks = r[12] || '';
    const prep = r[13] || '';
    const cert = r[14] || '';
    const app = r[15] || '';
    const rec = r[16] || '';

    if (!vouchersMap.has(voucherNum)) {
      vouchersMap.set(voucherNum, {
        voucherNumber: voucherNum,
        voucherDate: vDate,
        recipientName: payee,
        amountCents: Math.round(totalAmt * 100),
        paymentMethod: method,
        tag: tag,
        notes: remarks,
        signatories: { preparedBy: prep, certifiedBy: cert, approvedBy: app, receivedBy: rec },
        items: []
      });
    }

    const v = vouchersMap.get(voucherNum);
    if (desc || invNo || lineAmt > 0) {
      v.items.push({
        invoiceNo: invNo,
        description: desc || 'Disbursement',
        amountCents: Math.round(lineAmt * 100)
      });
    }
  }

  pendingImportVouchers = Array.from(vouchersMap.values());
  pendingImportVouchers.forEach((v) => {
    if (v.items.length > 0 && v.amountCents === 0) {
      v.amountCents = v.items.reduce((s, it) => s + it.amountCents, 0);
    }
  });

  const previewBox = document.getElementById('voucher-import-preview-box');
  const previewTitle = document.getElementById('voucher-import-preview-title');
  const previewContent = document.getElementById('voucher-import-preview-content');
  const submitBtn = document.getElementById('btn-submit-voucher-import');
  const statusEl = document.getElementById('voucher-csv-status');

  if (pendingImportVouchers.length > 0) {
    if (statusEl) statusEl.innerText = 'Ready to import ' + pendingImportVouchers.length + ' voucher(s) from ' + filename;
    if (previewTitle) previewTitle.innerText = 'Preview: ' + pendingImportVouchers.length + ' Vouchers Detected';
    if (previewContent) {
      previewContent.innerHTML = pendingImportVouchers.slice(0, 10).map((v) =>
        '<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 2px 0;">' +
        '<span><strong>' + v.voucherNumber + '</strong> — ' + escapeHtml(v.recipientName || 'Payee') + ' (' + v.items.length + ' line(s))</span>' +
        '<span style="font-family: monospace; font-weight: 600;">₱' + (((v.amountCents || 0) / 100).toFixed(2)) + '</span>' +
        '</div>'
      ).join('') + (pendingImportVouchers.length > 10 ? '<div style="font-style: italic; color: #64748b; margin-top: 4px;">... and ' + (pendingImportVouchers.length - 10) + ' more vouchers</div>' : '');
    }
    if (previewBox) previewBox.style.display = 'block';
    if (submitBtn) submitBtn.disabled = false;
  } else {
    showToast('No valid vouchers could be extracted from this CSV', 'warning');
  }
}

async function submitVoucherCsvImport() {
  if (!pendingImportVouchers || pendingImportVouchers.length === 0) {
    showToast('No vouchers to import', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-voucher-import');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Importing...';
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < pendingImportVouchers.length; i++) {
    const v = pendingImportVouchers[i];
    try {
      const res = await apiFetch('/api/accounting/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherType: 'PAYMENT',
          voucherNumber: v.voucherNumber,
          voucherDate: v.voucherDate,
          recipientType: 'OTHER',
          recipientName: v.recipientName || 'Disbursement Payee',
          currency: 'PHP',
          amountCents: v.amountCents,
          paymentMethod: v.paymentMethod || 'BANK_TRANSFER',
          tag: v.tag || '',
          notes: v.notes || '',
          items: v.items,
          signatories: v.signatories
        })
      });
      const json = await res.json();
      if (res.ok && json.success) successCount++;
      else failCount++;
    } catch (e) {
      failCount++;
    }
  }

  closeModal();
  showToast('Import completed: ' + successCount + ' imported' + (failCount > 0 ? ', ' + failCount + ' failed/skipped' : ''), successCount > 0 ? 'success' : 'danger');
  if (typeof loadVouchers === 'function') loadVouchers();
  if (typeof loadAccounting === 'function') loadAccounting();
}

function renderVouchersContent(container, vouchers) {
  // Extract all available years dynamically
  const allYearsSet = new Set(['2026', '2025', '2024', '2023']);
  (vouchers || []).forEach((v) => {
    allYearsSet.add(getPvYear(v));
  });
  const availableYears = Array.from(allYearsSet).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  const yearFilterOptions = availableYears
    .map((y) => '<option value="' + y + '"' + (pvYearFilter === y ? ' selected' : '') + '>' + y + (y === '2026' ? ' (Current)' : '') + '</option>')
    .concat(['<option value="ALL"' + (pvYearFilter === 'ALL' ? ' selected' : '') + '>All Years</option>'])
    .join('');

  // Filter vouchers by year and search query
  let filtered = getFilteredVouchersList();

  // Sort by last updated / created descending
  filtered.sort((a, b) => {
    const timeB = new Date(b.updatedAt || b.createdAt || b.voucherDate || 0).getTime();
    const timeA = new Date(a.updatedAt || a.createdAt || a.voucherDate || 0).getTime();
    return timeB - timeA;
  });

  // Calculate KPIs for current year/filter
  const totalDisbursedCents = filtered.filter((v) => v.status === 'POSTED').reduce((sum, v) => sum + (v.amountCents || 0), 0);
  const postedCount = filtered.filter((v) => v.status === 'POSTED').length;
  const voidedCount = filtered.filter((v) => v.status === 'VOID' || v.status === 'DECLINED').length;
  const draftCount = filtered.filter((v) => v.status === 'DRAFT').length;

  const isAdmin = state.user && state.user.role === 'ADMIN';

  const rowsHtml = filtered.map((v) => renderSingleVoucherRow(v, isAdmin)).join('');

  const pvViewClass = pvActiveViewMode === 'cards' ? ' view-mode-cards' : (pvActiveViewMode === 'table' ? ' view-mode-table' : '');

  container.innerHTML =
    '<div class="card pv-card" style="margin-bottom: 1.25rem; border: none; box-shadow: var(--shadow-sm);">' +
    '<div class="pv-header" style="padding: 1.15rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--border-color);">' +
    '<div style="display: flex; align-items: center; gap: 0.75rem;">' +
    '<div style="width: 38px; height: 38px; border-radius: 8px; background: #eff6ff; color: #2563eb; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #dbeafe; flex-shrink: 0;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>' +
    '</div>' +
    '<div>' +
    '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
    '<h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.02em;">Payment Vouchers</h2>' +
    '<span style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #f1f5f9; color: #475569; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #e2e8f0;">DISBURSEMENTS</span>' +
    '</div>' +
    '<p style="font-size: 0.82rem; color: #64748b; margin: 2px 0 0 0;">Manage and issue official corporate payment vouchers, vendor disbursements, and payout slips.</p>' +
    '</div>' +
    '</div>' +

    '<div class="pv-header-actions" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">' +
    '<button type="button" id="pv-toggle-summary-btn" class="btn btn-secondary btn-sm" onclick="handlePvToggleSummaryCards()" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; padding: 0.42rem 0.75rem;" title="' + (pvShowSummaryCards ? 'Hide summary metric cards' : 'Show summary metric cards') + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>' +
    '<span>' + (pvShowSummaryCards ? 'Hide Cards' : 'Show Cards') + '</span>' +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="openVoucherExportModal()" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; padding: 0.42rem 0.75rem;" title="Export Vouchers">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
    '<span>Export Options</span>' +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="exportFilteredVouchersZip()" title="Download ZIP with individual PDFs" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; padding: 0.42rem 0.75rem;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' +
    '<span>Export ZIP</span>' +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="openVoucherImportModal()" title="Import Vouchers from CSV" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; padding: 0.42rem 0.75rem;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' +
    '<span>Import CSV</span>' +
    '</button>' +
    '<button type="button" class="btn btn-primary btn-sm" onclick="openNewPaymentVoucherModal()" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.84rem; font-weight: 600; padding: 0.45rem 0.95rem;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 15px; height: 15px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
    '<span>+ Create Voucher</span>' +
    '</button>' +
    '</div>' +
    '</div>' +

    '<!-- KPI METRIC CARDS -->' +
    '<div id="pv-kpi-container" class="pv-kpi-grid" style="display: ' + (pvShowSummaryCards ? 'grid' : 'none') + '; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; padding: 1.25rem 1.5rem; background: #f8fafc; border-bottom: 1px solid var(--border-color);">' +
    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1.1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">' +
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">' +
    '<span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Total Disbursed (YTD)</span>' +
    '<div style="width: 26px; height: 26px; border-radius: 6px; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>' +
    '</div>' +
    '</div>' +
    '<div id="pv-kpi-total-disbursed" style="font-size: 1.35rem; font-weight: 800; color: #dc2626; font-family: var(--font-mono, monospace); letter-spacing: -0.02em;">' + formatCurrency(totalDisbursedCents, 'PHP') + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">Active posted disbursements</div>' +
    '</div>' +

    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1.1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">' +
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">' +
    '<span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Posted Vouchers</span>' +
    '<div style="width: 26px; height: 26px; border-radius: 6px; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' +
    '</div>' +
    '</div>' +
    '<div id="pv-kpi-posted-count" style="font-size: 1.35rem; font-weight: 800; color: #059669; font-family: var(--font-mono, monospace); letter-spacing: -0.02em;">' + postedCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">Official recorded vouchers</div>' +
    '</div>' +

    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1.1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">' +
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">' +
    '<span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Draft / Pending</span>' +
    '<div style="width: 26px; height: 26px; border-radius: 6px; background: #fffbeb; color: #d97706; display: flex; align-items: center; justify-content: center;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' +
    '</div>' +
    '</div>' +
    '<div id="pv-kpi-draft-count" style="font-size: 1.35rem; font-weight: 800; color: #d97706; font-family: var(--font-mono, monospace); letter-spacing: -0.02em;">' + draftCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">Awaiting certification</div>' +
    '</div>' +

    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1.1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">' +
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">' +
    '<span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Voided / Cancelled</span>' +
    '<div style="width: 26px; height: 26px; border-radius: 6px; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>' +
    '</div>' +
    '</div>' +
    '<div id="pv-kpi-voided-count" style="font-size: 1.35rem; font-weight: 800; color: #64748b; font-family: var(--font-mono, monospace); letter-spacing: -0.02em;">' + voidedCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">Reversed from ledger</div>' +
    '</div>' +
    '</div>' +

    '<!-- FILTER & SEARCH BAR -->' +
    '<div class="pv-filter-bar" style="padding: 0.85rem 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; flex: 1;">' +
    '<div style="flex: 1; max-width: 340px; min-width: 220px; position: relative;">' +
    '<span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 15px; height: 15px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
    '</span>' +
    '<input id="pv-search-input" type="text" class="form-input" style="padding: 0.45rem 0.75rem 0.45rem 2.25rem; font-size: 0.82rem; border-radius: 6px;" placeholder="Search voucher #, payee, remarks..." value="' + escapeHtml(pvSearchQuery) + '" oninput="handlePvSearch(this.value)" />' +
    '</div>' +

    '<div style="display: flex; align-items: center; gap: 0.45rem;">' +
    '<label style="font-size: 0.8rem; font-weight: 700; color: #475569; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: #64748b;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
    '<span>Year:</span>' +
    '</label>' +
    '<select class="form-select" style="padding: 0.42rem 0.75rem; font-size: 0.82rem; font-weight: 600; min-width: 120px; border-radius: 6px;" onchange="handlePvYearFilter(this.value)">' +
    yearFilterOptions +
    '</select>' +
    '</div>' +

    '<div class="btn-view-mode-group" title="Switch display view mode">' +
    '<button type="button" class="btn-view-mode' + (pvActiveViewMode === 'table' ? ' active' : '') + '" data-mode="table" onclick="handlePvActiveViewMode(&quot;table&quot;)" title="Compact Table View" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 600;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>' +
    '<span>Table</span>' +
    '</button>' +
    '<button type="button" class="btn-view-mode' + (pvActiveViewMode === 'cards' ? ' active' : '') + '" data-mode="cards" onclick="handlePvActiveViewMode(&quot;cards&quot;)" title="Card Grid View" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 600;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px;"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>' +
    '<span>Cards</span>' +
    '</button>' +
    '<button type="button" class="btn-view-mode" onclick="loadVouchers()" title="Reload Vouchers" aria-label="Reload Vouchers" style="display: inline-flex; align-items: center; justify-content: center; padding: 0.35rem 0.55rem; color: #475569;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' +
    '</button>' +
    '</div>' +

    '<label style="display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.8rem; font-weight: 600; color: #475569; cursor: pointer; user-select: none; padding: 0.38rem 0.65rem; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0;" title="Show or hide summary metric cards">' +
    '<input type="checkbox" id="pv-show-cards-checkbox" style="cursor: pointer; width: 14px; height: 14px; accent-color: var(--primary); margin: 0;" onchange="handlePvToggleSummaryCards(this.checked)"' + (pvShowSummaryCards ? ' checked' : '') + ' />' +
    '<span>Summary Cards</span>' +
    '</label>' +
    '</div>' +

    '<div id="pv-header-count" style="font-size: 0.8rem; color: #64748b; font-weight: 500;">' +
    'Showing <strong style="color: #0f172a; font-family: var(--font-mono, monospace);">' + filtered.length + '</strong> voucher(s)' +
    '</div>' +
    '</div>' +

    '<!-- DATA TABLE -->' +
    '<div class="table-responsive table-responsive-cascade" style="border-top: 1px solid var(--border-color);">' +
    '<table id="pv-data-table" class="data-table responsive-cascade-table pv-compact-table' + pvViewClass + '">' +
    '<thead>' +
    '<tr>' +
    '<th style="width: 95px; white-space: nowrap;">Voucher #</th>' +
    '<th style="width: 88px; white-space: nowrap;">Date</th>' +
    '<th style="min-width: 120px;">Payee / Recipient</th>' +
    '<th style="width: 95px; white-space: nowrap;">Tag / Category</th>' +
    '<th style="min-width: 100px;">Remarks</th>' +
    '<th style="width: 65px; text-align: center; white-space: nowrap;">Method</th>' +
    '<th style="width: 110px; text-align: right; white-space: nowrap;">Total Amount</th>' +
    '<th style="width: 75px; text-align: center; white-space: nowrap;">Status</th>' +
    '<th style="width: 170px; text-align: right; white-space: nowrap;" class="th-actions">Actions</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody id="pv-table-body">' +
    ((rowsHtml && rowsHtml.length > 0) ? rowsHtml : '<tr class="empty-row"><td colspan="9" style="text-align: center; color: #64748b; padding: 2.5rem;">No payment vouchers found' + (pvYearFilter !== 'ALL' ? ' for year ' + pvYearFilter : '') + '.</td></tr>') +
    '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>';
}

window.loadVouchers = loadVouchers;
window.handlePvActiveViewMode = handlePvActiveViewMode;
window.handlePvSearch = handlePvSearch;
window.handlePvYearFilter = handlePvYearFilter;
window.handlePvToggleSummaryCards = handlePvToggleSummaryCards;
window.openVoucherOverviewModal = openVoucherOverviewModal;
`;
