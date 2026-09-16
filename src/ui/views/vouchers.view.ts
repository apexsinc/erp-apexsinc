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
    tagBadgeHtml = '<span class="badge badge-neutral" style="font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.4rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; max-width: 95px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;" title="#' + escapedTag + '">#' + escapedTag + '</span>';
  }

  let remarksHtml = '<span style="color: #cbd5e1; font-size: 0.8rem;">—</span>';
  if (v.notes && v.notes.trim()) {
    const escapedNotes = escapeHtml(v.notes.trim());
    remarksHtml = '<div style="max-width: 105px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.78rem; color: #475569;" title="' + escapedNotes + '">' + escapedNotes + '</div>';
  }

  let statusBadge = '<span class="badge badge-success" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;"><span class="badge-dot"></span>POSTED</span>';
  if (v.status === 'VOID' || v.status === 'DECLINED') {
    statusBadge = '<span class="badge badge-danger" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;"><span class="badge-dot"></span>VOID</span>';
  } else if (v.status === 'DRAFT') {
    statusBadge = '<span class="badge badge-neutral" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;"><span class="badge-dot"></span>DRAFT</span>';
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

  let actionButtons = '';
  actionButtons += '<button class="btn btn-secondary btn-sm pv-btn-compact" onclick="openOfficialVoucherSlipModal(&quot;' + v.id + '&quot;)" title="View Official Slip">📄 Slip</button>';
  actionButtons += '<button class="btn btn-secondary btn-sm pv-btn-compact" onclick="downloadSingleVoucherPdf(&quot;' + v.id + '&quot;)" title="Download PDF Slip">📥 PDF</button>';
  actionButtons += '<button class="btn btn-secondary btn-sm pv-btn-compact" onclick="openEditVoucherModal(&quot;' + v.id + '&quot;)" title="Edit Details">✏️ Edit</button>';
  const histCount = v.historyCount || 0;
  const countBadgeClass = histCount > 0 ? 'has-records' : 'zero-records';
  actionButtons += '<button class="btn btn-secondary btn-sm pv-btn-compact btn-history-badge-container" onclick="openVoucherHistoryModal(&quot;' + v.id + '&quot;)" title="View Revision History & Audit Trail (' + histCount + ' record' + (histCount === 1 ? '' : 's') + ')">📜 Hist<span class="history-count-badge ' + countBadgeClass + '">' + histCount + '</span></button>';

  if (v.status === 'VOID' || v.status === 'DECLINED') {
    actionButtons += '<button class="btn btn-success btn-sm pv-btn-compact" onclick="restoreVoucher(&quot;' + v.id + '&quot;)" title="Restore Voucher">♻️</button>';
  } else {
    actionButtons += '<button class="btn btn-warning btn-sm pv-btn-compact" onclick="declineVoucher(&quot;' + v.id + '&quot;)" title="Void / Decline">🚫</button>';
  }

  if (isAdmin) {
    actionButtons += '<button class="btn btn-danger btn-sm pv-btn-compact" onclick="deleteVoucherPermanent(&quot;' + v.id + '&quot;)" title="Delete Permanently">🗑️</button>';
  }

  const recipientName = escapeHtml(v.recipient || v.recipientName || '—');

  return (
    '<tr>' +
    '<td class="td-voucher-num" data-label="Voucher #">' +
    '<div style="display: flex; align-items: center; gap: 0.35rem;">' +
    '<span style="font-size: 0.95rem; line-height: 1;">🧾</span>' +
    '<strong style="font-family: monospace; color: var(--primary); font-size: 0.88rem;">' + v.voucherNumber + '</strong>' +
    '</div>' +
    '<div class="pv-card-amount" style="font-weight: 800; color: #dc2626; font-family: monospace; font-size: 0.95rem; white-space: nowrap;">- ' + formatCurrency(v.amountCents || 0, v.currency || 'PHP') + '</div>' +
    '</td>' +
    '<td class="td-date" data-label="Date" style="white-space: nowrap; font-size: 0.8rem; color: #334155; font-weight: 500;">' + formattedDate + '</td>' +
    '<td class="td-recipient" data-label="Payee / Recipient">' +
    '<div style="max-width: 135px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 0.3rem;" title="' + recipientName + '">' +
    '<span style="color: #64748b; font-size: 0.8rem; flex-shrink: 0;">🏢</span>' +
    '<strong style="color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem;">' + recipientName + '</strong>' +
    '</div>' +
    '</td>' +
    '<td class="td-tag" data-label="Tag / Category">' + tagBadgeHtml + '</td>' +
    '<td class="td-remarks" data-label="Remarks">' + remarksHtml + '</td>' +
    '<td class="td-method" data-label="Payment Method"><span class="badge badge-neutral" style="font-size: 0.72rem; padding: 0.15rem 0.4rem; white-space: nowrap;" title="' + escapeHtml(rawMethod) + '">' + escapeHtml(shortMethod) + '</span></td>' +
    '<td class="td-amount" data-label="Total Amount" style="text-align: right; font-weight: 700; color: #dc2626; font-family: monospace; font-size: 0.84rem; white-space: nowrap;">- ' + formatCurrency(v.amountCents || 0, v.currency || 'PHP') + '</td>' +
    '<td class="td-status" data-label="Status">' + statusBadge + '</td>' +
    '<td class="td-actions" data-label="Actions"><div class="pv-actions-group">' + actionButtons + '</div></td>' +
    '</tr>'
  );
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
    toggleBtn.innerHTML = pvShowSummaryCards ? '👁️ Hide Cards' : '📊 Show Cards';
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
    '<div style="font-size: 2.4rem; margin-bottom: 0.65rem;">📦</div>' +
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
    '<div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem;">' +
    '<span>📦 Export All to ZIP Archive (Individual PDFs + CSV)</span>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b; line-height: 1.4;">' +
    'Generates a separate official PDF slip for every voucher (half-bond paper format with signatories) bundled into a single compressed .zip file with CSV ledgers.' +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-primary btn-sm" onclick="closeModal(); exportFilteredVouchersZip();" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">' +
    '📦 Download ZIP' +
    '</button>' +
    '</div>' +

    '<!-- OPTION 2: ITEMIZED LEDGER CSV -->' +
    '<div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="flex: 1; min-width: 240px;">' +
    '<div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem;">' +
    '<span>📋 Itemized Ledger CSV (All Breakdown Lines)</span>' +
    '<span class="badge badge-success" style="font-size: 0.7rem; margin-left: 0.35rem;">Recommended</span>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b; line-height: 1.4;">' +
    'Each row represents a specific breakdown line item with Invoice #, Account Description, and Amount. Best for Excel auditing, Pivot Tables, and financial reconciliations.' +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="closeModal(); exportItemizedVouchersCsv();" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">' +
    '📋 Download CSV' +
    '</button>' +
    '</div>' +

    '<!-- OPTION 3: SUMMARY CSV -->' +
    '<div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="flex: 1; min-width: 240px;">' +
    '<div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem;">' +
    '<span>📊 Summary CSV (1 Row per Voucher)</span>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b; line-height: 1.4;">' +
    'High-level summary where each voucher is exactly one row with total amounts, line counts, payment method, remarks, and signatories.' +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="closeModal(); exportSummaryVouchersCsv();" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">' +
    '📊 Download CSV' +
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
    '<div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>' +
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
    '<button type="button" id="btn-submit-voucher-import" class="btn btn-primary" onclick="submitVoucherCsvImport()" disabled>📤 Import Vouchers</button>' +
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
    '<div class="card" style="margin-bottom: 1.25rem; border: none; box-shadow: var(--shadow-sm);">' +
    '<div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--border-color);">' +
    '<div>' +
    '<h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.5rem;">' +
    '<span>🧾 Vouchers</span>' +
    '</h2>' +
    '<p style="font-size: 0.84rem; color: #64748b; margin-bottom: 0;">' +
    'Manage and issue official corporate payment vouchers, vendor disbursements, and payout slips.' +
    '</p>' +
    '</div>' +
    '<div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">' +
    '<button type="button" id="pv-toggle-summary-btn" class="btn btn-secondary btn-sm" onclick="handlePvToggleSummaryCards()" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;" title="' + (pvShowSummaryCards ? 'Hide summary metric cards' : 'Show summary metric cards') + '">' +
    (pvShowSummaryCards ? '👁️ Hide Cards' : '📊 Show Cards') +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="openVoucherExportModal()" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;">' +
    '📥 Export Options' +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="exportFilteredVouchersZip()" title="Download ZIP with individual PDFs" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;">' +
    '📦 Export ZIP (PDFs)' +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="openVoucherImportModal()" title="Import Vouchers from CSV" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;">' +
    '📤 Import CSV' +
    '</button>' +
    '<button type="button" class="btn btn-primary btn-sm" onclick="openNewPaymentVoucherModal()" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.84rem; padding: 0.45rem 0.95rem;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
    '+ Create Voucher' +
    '</button>' +
    '</div>' +
    '</div>' +

    '<!-- KPI METRIC CARDS -->' +
    '<div id="pv-kpi-container" class="pv-kpi-grid" style="display: ' + (pvShowSummaryCards ? 'grid' : 'none') + '; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; padding: 1.25rem 1.5rem; background: #f8fafc; border-bottom: 1px solid var(--border-color);">' +
    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Total Disbursed (YTD)</div>' +
    '<div id="pv-kpi-total-disbursed" style="font-size: 1.35rem; font-weight: 800; color: #dc2626; margin-top: 0.25rem; font-family: monospace;">' + formatCurrency(totalDisbursedCents, 'PHP') + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Active posted disbursements</div>' +
    '</div>' +
    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Posted Vouchers</div>' +
    '<div id="pv-kpi-posted-count" style="font-size: 1.35rem; font-weight: 800; color: #059669; margin-top: 0.25rem; font-family: monospace;">' + postedCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Official recorded vouchers</div>' +
    '</div>' +
    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Draft / Pending</div>' +
    '<div id="pv-kpi-draft-count" style="font-size: 1.35rem; font-weight: 800; color: #d97706; margin-top: 0.25rem; font-family: monospace;">' + draftCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Awaiting certification</div>' +
    '</div>' +
    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Voided / Cancelled</div>' +
    '<div id="pv-kpi-voided-count" style="font-size: 1.35rem; font-weight: 800; color: #64748b; margin-top: 0.25rem; font-family: monospace;">' + voidedCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Reversed from ledger</div>' +
    '</div>' +
    '</div>' +

    '<!-- FILTER & SEARCH BAR -->' +
    '<div style="padding: 0.85rem 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; flex: 1;">' +
    '<div style="flex: 1; max-width: 340px; min-width: 200px;">' +
    '<input id="pv-search-input" type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search voucher #, payee, remarks..." value="' + escapeHtml(pvSearchQuery) + '" oninput="handlePvSearch(this.value)" />' +
    '</div>' +
    '<div style="display: flex; align-items: center; gap: 0.45rem;">' +
    '<label style="font-size: 0.8rem; font-weight: 700; color: #475569; white-space: nowrap;">📅 Year:</label>' +
    '<select class="form-select" style="padding: 0.42rem 0.75rem; font-size: 0.82rem; font-weight: 600; min-width: 140px; border-radius: 6px;" onchange="handlePvYearFilter(this.value)">' +
    yearFilterOptions +
    '</select>' +
    '</div>' +
    '<div class="btn-view-mode-group" title="Switch table display layout">' +
    '<button type="button" class="btn-view-mode' + (pvActiveViewMode === 'table' ? ' active' : '') + '" data-mode="table" onclick="handlePvActiveViewMode(&quot;table&quot;)" title="Compact Table View">' +
    '☰ Table' +
    '</button>' +
    '<button type="button" class="btn-view-mode' + (pvActiveViewMode === 'cards' ? ' active' : '') + '" data-mode="cards" onclick="handlePvActiveViewMode(&quot;cards&quot;)" title="Cascade Wrap Cards View">' +
    '⊞ Wrap Cards' +
    '</button>' +
    '<button type="button" class="btn-view-mode" onclick="loadVouchers()" title="Reload Vouchers" aria-label="Reload Vouchers" style="display: inline-flex; align-items: center; justify-content: center; padding: 0.35rem 0.6rem; font-size: 0.85rem;">' +
    '🔄' +
    '</button>' +
    '</div>' +
    '<label style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; color: #475569; cursor: pointer; user-select: none; padding: 0.35rem 0.65rem; border-radius: 6px; background: #f1f5f9; border: 1px solid #e2e8f0;" title="Show or hide summary metric cards">' +
    '<input type="checkbox" id="pv-show-cards-checkbox" style="cursor: pointer; width: 15px; height: 15px; accent-color: var(--primary); margin: 0;" onchange="handlePvToggleSummaryCards(this.checked)"' + (pvShowSummaryCards ? ' checked' : '') + ' />' +
    '<span>Summary Cards</span>' +
    '</label>' +
    '</div>' +
    '<div id="pv-header-count" style="font-size: 0.8rem; color: #64748b;">' +
    'Showing <strong>' + filtered.length + '</strong> voucher(s)' +
    '</div>' +
    '</div>' +

    '<!-- DATA TABLE -->' +
    '<div class="table-responsive table-responsive-cascade" style="border-top: 1px solid var(--border-color);">' +
    '<table id="pv-data-table" class="data-table responsive-cascade-table pv-compact-table' + pvViewClass + '">' +
    '<thead>' +
    '<tr>' +
    '<th>Voucher #</th>' +
    '<th>Date</th>' +
    '<th>Payee / Recipient</th>' +
    '<th>Tag / Category</th>' +
    '<th>Remarks</th>' +
    '<th>Method</th>' +
    '<th style="text-align: right;">Total Amount</th>' +
    '<th>Status</th>' +
    '<th style="text-align: right;" class="th-actions">Actions</th>' +
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
`;
