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

function handlePvSearch(query) {
  pvSearchQuery = query.toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', pvSearchQuery || null);
  }
  const container = document.getElementById('view-vouchers');
  if (container) {
    renderVouchersContent(container, cachedPVList);
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

  const rowsHtml = filtered.map((v) => {
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

    let tagBadgeHtml = '<span style="color: #cbd5e1; font-size: 0.82rem;">—</span>';
    if (tag) {
      tagBadgeHtml = '<span class="badge badge-neutral" style="font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.5rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px;">#' + escapeHtml(tag) + '</span>';
    }

    let remarksHtml = '<span style="color: #cbd5e1; font-size: 0.82rem;">—</span>';
    if (v.notes && v.notes.trim()) {
      const escapedNotes = escapeHtml(v.notes.trim());
      remarksHtml = '<div style="max-width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.82rem; color: #475569;" title="' + escapedNotes + '">' + escapedNotes + '</div>';
    }

    let statusBadge = '<span class="badge badge-success"><span class="badge-dot"></span>POSTED</span>';
    if (v.status === 'VOID' || v.status === 'DECLINED') {
      statusBadge = '<span class="badge badge-danger"><span class="badge-dot"></span>VOID</span>';
    } else if (v.status === 'DRAFT') {
      statusBadge = '<span class="badge badge-neutral"><span class="badge-dot"></span>DRAFT</span>';
    }

    let actionButtons = '';
    actionButtons += '<button class="btn btn-secondary btn-sm" onclick="openOfficialVoucherSlipModal(\\'' + v.id + '\\')" title="View Official Slip" style="padding: 0.25rem 0.55rem; font-size: 0.76rem;">📄 Slip</button> ';
    actionButtons += '<button class="btn btn-secondary btn-sm" onclick="downloadSingleVoucherPdf(\\'' + v.id + '\\')" title="Download PDF Slip" style="padding: 0.25rem 0.55rem; font-size: 0.76rem;">📥 PDF</button> ';
    actionButtons += '<button class="btn btn-secondary btn-sm" onclick="openEditVoucherModal(\\'' + v.id + '\\')" title="Edit Details" style="padding: 0.25rem 0.55rem; font-size: 0.76rem;">✏️ Edit</button> ';

    if (v.status === 'VOID' || v.status === 'DECLINED') {
      actionButtons += '<button class="btn btn-success btn-sm" onclick="restoreVoucher(\\'' + v.id + '\\')" title="Restore Voucher" style="padding: 0.25rem 0.55rem; font-size: 0.76rem;">♻️ Restore</button> ';
    } else {
      actionButtons += '<button class="btn btn-warning btn-sm" onclick="declineVoucher(\\'' + v.id + '\\')" title="Void / Decline" style="padding: 0.25rem 0.55rem; font-size: 0.76rem;">🚫 Void</button> ';
    }

    if (isAdmin) {
      actionButtons += '<button class="btn btn-danger btn-sm" onclick="deleteVoucherPermanent(\\'' + v.id + '\\')" title="Delete Permanently" style="padding: 0.25rem 0.45rem; font-size: 0.76rem;">🗑️</button>';
    }

    return (
      '<tr>' +
      '<td><strong style="font-family: monospace; color: var(--primary);">' + v.voucherNumber + '</strong></td>' +
      '<td style="white-space: nowrap; font-size: 0.82rem; color: #334155;">' + formattedDate + '</td>' +
      '<td><span class="badge badge-danger" style="font-size: 0.72rem;">PV</span></td>' +
      '<td><strong>' + escapeHtml(v.recipient || v.recipientName || '—') + '</strong></td>' +
      '<td>' + tagBadgeHtml + '</td>' +
      '<td>' + remarksHtml + '</td>' +
      '<td><span class="badge badge-neutral" style="font-size: 0.74rem;">' + (v.paymentMethod || 'BANK_TRANSFER') + '</span></td>' +
      '<td style="text-align: right; font-weight: 700; color: #dc2626; font-family: monospace;">- ' + formatCurrency(v.amountCents || 0, v.currency || 'PHP') + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td style="text-align: right; white-space: nowrap;">' + actionButtons + '</td>' +
      '</tr>'
    );
  }).join('');

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
    '<button type="button" class="btn btn-secondary btn-sm" onclick="openVoucherExportModal()" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;">' +
    '📥 Export Options' +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="exportFilteredVouchersZip()" title="Download ZIP with individual PDFs" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;">' +
    '📦 Export ZIP (PDFs)' +
    '</button>' +
    '<button type="button" class="btn btn-primary btn-sm" onclick="openNewPaymentVoucherModal()" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.84rem; padding: 0.45rem 0.95rem;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
    '+ Create Voucher' +
    '</button>' +
    '</div>' +
    '</div>' +

    '<!-- KPI METRIC CARDS -->' +
    '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; padding: 1.25rem 1.5rem; background: #f8fafc; border-bottom: 1px solid var(--border-color);">' +
    '<div style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Total Disbursed (YTD)</div>' +
    '<div style="font-size: 1.35rem; font-weight: 800; color: #dc2626; margin-top: 0.25rem; font-family: monospace;">' + formatCurrency(totalDisbursedCents, 'PHP') + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Active posted disbursements</div>' +
    '</div>' +
    '<div style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Posted Vouchers</div>' +
    '<div style="font-size: 1.35rem; font-weight: 800; color: #059669; margin-top: 0.25rem; font-family: monospace;">' + postedCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Official recorded vouchers</div>' +
    '</div>' +
    '<div style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Draft / Pending</div>' +
    '<div style="font-size: 1.35rem; font-weight: 800; color: #d97706; margin-top: 0.25rem; font-family: monospace;">' + draftCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Awaiting certification</div>' +
    '</div>' +
    '<div style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Voided / Cancelled</div>' +
    '<div style="font-size: 1.35rem; font-weight: 800; color: #64748b; margin-top: 0.25rem; font-family: monospace;">' + voidedCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Reversed from ledger</div>' +
    '</div>' +
    '</div>' +

    '<!-- FILTER & SEARCH BAR -->' +
    '<div style="padding: 0.85rem 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; flex: 1;">' +
    '<div style="flex: 1; max-width: 340px; min-width: 200px;">' +
    '<input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search voucher #, payee, remarks..." value="' + escapeHtml(pvSearchQuery) + '" oninput="handlePvSearch(this.value)" />' +
    '</div>' +
    '<div style="display: flex; align-items: center; gap: 0.45rem;">' +
    '<label style="font-size: 0.8rem; font-weight: 700; color: #475569; white-space: nowrap;">📅 Year:</label>' +
    '<select class="form-select" style="padding: 0.42rem 0.75rem; font-size: 0.82rem; font-weight: 600; min-width: 140px; border-radius: 6px;" onchange="handlePvYearFilter(this.value)">' +
    yearFilterOptions +
    '</select>' +
    '</div>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b;">' +
    'Showing <strong>' + filtered.length + '</strong> voucher(s)' +
    '</div>' +
    '</div>' +

    '<!-- DATA TABLE -->' +
    '<div class="table-responsive" style="border-top: 1px solid var(--border-color);">' +
    '<table class="data-table">' +
    '<thead>' +
    '<tr>' +
    '<th>Voucher #</th>' +
    '<th>Date</th>' +
    '<th>Type</th>' +
    '<th>Payee / Recipient</th>' +
    '<th>Tag / Category</th>' +
    '<th>Remarks</th>' +
    '<th>Payment Method</th>' +
    '<th style="text-align: right;">Total Amount</th>' +
    '<th>Status</th>' +
    '<th style="text-align: right;">Actions</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' +
    ((rowsHtml && rowsHtml.length > 0) ? rowsHtml : '<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 2.5rem;">No payment vouchers found' + (pvYearFilter !== 'ALL' ? ' for year ' + pvYearFilter : '') + '.</td></tr>') +
    '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>';
}
`;
