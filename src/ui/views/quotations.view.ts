/**
 * Quotations Management View
 * Features quotation authoring, Business Directory customer and services integration,
 * lifecycle management (Draft, Sent, Accepted, Converted), and instant new-tab PDF generation.
 */

export function renderQuotationsView(): string {
  return `<div id="view-quotations" class="tab-view" style="display: none;"></div>`;
}

export const QUOTATIONS_CLIENT_JS = `
let quotationsSearchQuery = '';
let quotationStatusFilter = 'ALL';
let nqSelectedItems = [];
let quotationsActiveSearchIndex = -1;
let isSubmittingQuotation = false;

const QUOTATION_DEFAULT_SIGNATURE_KEY = 'apexs_quotation_signature_png';

function getSavedDefaultSignature() {
  try {
    return localStorage.getItem(QUOTATION_DEFAULT_SIGNATURE_KEY) || '';
  } catch (_) {
    return '';
  }
}

function saveDefaultSignature(dataUrl) {
  try {
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      localStorage.setItem(QUOTATION_DEFAULT_SIGNATURE_KEY, dataUrl);
    }
  } catch (_) {}
}

function autoExpandTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(90, el.scrollHeight + 4) + 'px';
}

function handleSignatureFileUpload(event, prefix) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please upload a valid image file (PNG recommended).', 'warning');
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    showToast('Image file size must be less than 3MB.', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const hiddenInput = document.getElementById(prefix + '-signature-data');
    if (hiddenInput) hiddenInput.value = dataUrl;

    // Automatically save as default signature for future creations
    saveDefaultSignature(dataUrl);

    renderSignaturePreview(prefix, dataUrl, true);
    showToast('E-Signature attached and automatically saved as default for future quotations!', 'success');
  };
  reader.onerror = () => {
    showToast('Failed to read image file.', 'danger');
  };
  reader.readAsDataURL(file);
}

function clearSignatureAttachment(prefix) {
  const hiddenInput = document.getElementById(prefix + '-signature-data');
  if (hiddenInput) hiddenInput.value = '';
  const fileInput = document.getElementById(prefix + '-signature-file');
  if (fileInput) fileInput.value = '';

  renderSignaturePreview(prefix, '', false);
  showToast('E-Signature removed from this quotation.', 'info');
}

function applySavedSignatureToForm(prefix) {
  const saved = getSavedDefaultSignature();
  if (!saved) {
    showToast('No saved default signature found. Please upload a signature PNG.', 'info');
    return;
  }
  const hiddenInput = document.getElementById(prefix + '-signature-data');
  if (hiddenInput) hiddenInput.value = saved;
  renderSignaturePreview(prefix, saved, true);
  showToast('Saved default E-Signature applied!', 'success');
}

function renderSignaturePreview(prefix, dataUrl, isSavedDefault) {
  const container = document.getElementById(prefix + '-sig-preview-container');
  if (!container) return;

  if (dataUrl) {
    container.innerHTML = \`
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: 0.65rem 1rem; background: #f8fafc; border: 1.5px solid #0284c7; border-radius: var(--radius-md);">
        <div style="width: 140px; height: 58px; background: #ffffff url('data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'16\\\' height=\\\'16\\\' fill-opacity=\\\'0.06\\\'><rect width=\\\'8\\\' height=\\\'8\\\' fill=\\\'%23000\\\'/><rect x=\\\'8\\\' y=\\\'8\\\' width=\\\'8\\\' height=\\\'8\\\' fill=\\\'%23000\\\'/></svg>') repeat; border: 1px solid #cbd5e1; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; padding: 4px; overflow: hidden;">
          <img src="\${escapeHtml(dataUrl)}" alt="E-Signature Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;" onclick="document.getElementById('\${prefix}-signature-file').click()">
            🖊️ Change Image
          </button>
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 0.35rem 0.75rem; color: #dc2626;" onclick="clearSignatureAttachment('\${prefix}')">
            ✕ Remove
          </button>
        </div>
      </div>
    \`;
  } else {
    const saved = getSavedDefaultSignature();
    container.innerHTML = \`
      <div style="border: 2px dashed #cbd5e1; border-radius: var(--radius-md); padding: 1.15rem 1.25rem; background: #f8fafc; text-align: center; transition: all 0.2s ease;">
        <div style="color: #475569; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem;">
          Attach E-Signature (PNG with transparent background recommended)
        </div>
        <div style="color: #94a3b8; font-size: 0.75rem; margin-bottom: 0.85rem;">
          Once attached on first creation, it will automatically save and auto-attach to all future quotations unless changed.
        </div>
        <div style="display: flex; gap: 0.65rem; justify-content: center; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary btn-sm" style="font-size: 0.8rem; padding: 0.4rem 0.95rem;" onclick="document.getElementById('\${prefix}-signature-file').click()">
            📤 Upload Signature PNG
          </button>
          \${saved ? \`
            <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.8rem; padding: 0.4rem 0.95rem;" onclick="applySavedSignatureToForm('\${prefix}')">
              ⚡ Use Saved Default Signature
            </button>
          \` : ''}
        </div>
      </div>
    \`;
  }
}

async function loadQuotations() {
  const container = document.getElementById('view-quotations');
  if (!container) return;
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading quotations...</div>');

  try {
    quotationsSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';

    const [qRes, custRes, prodRes] = await Promise.all([
      apiFetch('/api/quotations'),
      apiFetch('/api/sales/customers'),
      apiFetch('/api/inventory/products'),
    ]);

    const qJson = await qRes.json();
    const custJson = await custRes.json();
    const prodJson = await prodRes.json();

    state.quotations = qJson.data || [];
    state.customers = custJson.data || [];
    state.products = prodJson.data || [];
    state.services = (state.products || []).filter((p) => p.type === 'SERVICE');

    renderQuotationsContent(container);
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading quotations: \${err.message}</div>\`;
  }
}

function handleQuotationsSearch(query) {
  quotationsSearchQuery = query.toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', quotationsSearchQuery || null);
  }
  const container = document.getElementById('view-quotations');
  if (container) {
    renderQuotationsContent(container);
  }
}

function handleQuotationStatusFilter(status) {
  quotationStatusFilter = status;
  const container = document.getElementById('view-quotations');
  if (container) {
    renderQuotationsContent(container);
  }
}

function openQuotationPdf(quoteId) {
  if (!quoteId) return;
  window.open('/quotations/' + encodeURIComponent(quoteId) + '/print', '_blank');
}

function exportQuotationsCsv() {
  const headers = ['Quote Number', 'Customer', 'Quote Date', 'Valid Until', 'Currency', 'Total Amount', 'Status', 'Payment Terms', 'Signatory'];
  const rows = (state.quotations || []).map((q) => [
    q.quoteNumber || '',
    q.customer?.name || 'Customer',
    q.quoteDate || '',
    q.validUntil || '',
    q.currency || 'PHP',
    ((q.totalAmountCents || 0) / 100).toFixed(2),
    q.status || 'DRAFT',
    q.paymentTerms || '',
    q.authorizedSignatoryName || '',
  ]);
  exportToCsv('quotations_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function renderQuotationsContent(container) {
  const statusBadgeClass = {
    DRAFT: 'badge-neutral',
    SENT: 'badge-primary',
    ACCEPTED: 'badge-success',
    REJECTED: 'badge-danger',
    CONVERTED: 'badge-warning',
    EXPIRED: 'badge-neutral',
  };

  let filtered = state.quotations || [];
  if (quotationStatusFilter !== 'ALL') {
    filtered = filtered.filter((q) => q.status === quotationStatusFilter);
  }

  if (quotationsSearchQuery) {
    filtered = filtered.filter((q) => {
      const num = (q.quoteNumber || '').toLowerCase();
      const cust = (q.customer?.name || '').toLowerCase();
      const status = (q.status || '').toLowerCase();
      const notes = (q.notes || '').toLowerCase();
      const itemsMatch = (q.items || []).some((i) => {
        const desc = (i.description || '').toLowerCase();
        const part = (i.partNumber || '').toLowerCase();
        const inotes = (i.notes || '').toLowerCase();
        return desc.includes(quotationsSearchQuery) || part.includes(quotationsSearchQuery) || inotes.includes(quotationsSearchQuery);
      });
      return num.includes(quotationsSearchQuery) || cust.includes(quotationsSearchQuery) || status.includes(quotationsSearchQuery) || notes.includes(quotationsSearchQuery) || itemsMatch;
    });
  }

  // Summary Metrics
  const totalCount = (state.quotations || []).length;
  const draftCount = (state.quotations || []).filter((q) => q.status === 'DRAFT').length;
  const acceptedCount = (state.quotations || []).filter((q) => q.status === 'ACCEPTED').length;
  const convertedCount = (state.quotations || []).filter((q) => q.status === 'CONVERTED').length;

  let rowsHtml = '';
  filtered.forEach((q) => {
    const isConverted = q.status === 'CONVERTED';
    const isAccepted = q.status === 'ACCEPTED';
    const itemsCount = (q.items || []).length;
    const itemsSnippet = (q.items || []).map((i) => (i.quantity || 1) + 'x ' + (i.partNumber ? '[' + i.partNumber + '] ' : '') + i.description).slice(0, 2).join(', ') + (itemsCount > 2 ? ' ...' : '');

    const actionsHtml = \`
      <div style="display: flex; justify-content: flex-end; gap: 0.35rem; align-items: center;">
        <button class="btn btn-secondary btn-sm" style="padding: 0.28rem 0.55rem; font-size: 0.85rem; line-height: 1;" onclick="openQuotationPdf('\${q.id}')" title="View PDF">
          📄
        </button>
        \${can('quotations', 'update') ? \`
          <button class="btn btn-secondary btn-sm" style="padding: 0.28rem 0.55rem; font-size: 0.85rem; line-height: 1;" onclick="openEditQuotationModal('\${q.id}')" title="Edit Quotation">
            ✏️
          </button>
        \` : ''}
        \${can('sales', 'create') ? (
          !isConverted ? \`
            <button class="btn btn-primary btn-sm" style="padding: 0.28rem 0.55rem; font-size: 0.85rem; line-height: 1; background: #059669; border-color: #059669;" onclick="promptConvertQuotation('\${q.id}')" title="Convert to Sales Invoice">
              🔄
            </button>
          \` : \`
            <button class="btn btn-secondary btn-sm" style="padding: 0.28rem 0.55rem; font-size: 0.85rem; line-height: 1; opacity: 0.45; cursor: not-allowed;" disabled title="Already Converted to Invoice">
              🔄
            </button>
          \`
        ) : ''}
        \${can('quotations', 'delete') ? \`
          <button class="btn btn-danger btn-sm" style="padding: 0.28rem 0.55rem; font-size: 0.85rem; line-height: 1;" onclick="deleteQuotationPrompt('\${q.id}', '\${escapeHtml(q.quoteNumber)}')" title="Delete Quotation">
            🗑️
          </button>
        \` : ''}
      </div>
    \`;

    rowsHtml += \`
      <tr>
        <td style="vertical-align: top;">
          <a href="javascript:void(0)" onclick="openQuotationPdf('\${q.id}')" style="font-weight: 700; color: #0284c7; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;">
            \${escapeHtml(q.quoteNumber)}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
            Issued: \${escapeHtml(q.quoteDate || '—')}
          </div>
        </td>
        <td style="vertical-align: top;">
          <div style="font-weight: 600; color: var(--text-main);">\${escapeHtml(q.customer?.name || 'Customer')}</div>
          <div style="font-size: 0.75rem; color: #64748b;">\${escapeHtml(q.customer?.customerCode || '')}</div>
        </td>
        <td style="vertical-align: top;">
          <div style="font-size: 0.82rem; color: #334155;">\${escapeHtml(itemsSnippet || 'No items')}</div>
          \${q.validUntil ? \`<div style="font-size: 0.74rem; color: #0369a1; margin-top: 3px;">Valid until: \${escapeHtml(q.validUntil)}</div>\` : ''}
        </td>
        <td style="vertical-align: top; text-align: right; white-space: nowrap;">
          <strong style="font-size: 0.92rem;">\${formatCurrency(q.totalAmountCents, q.currency)}</strong>
        </td>
        <td style="vertical-align: top;">
          <span class="badge \${statusBadgeClass[q.status] || 'badge-neutral'}">
            <span class="badge-dot"></span>
            \${escapeHtml(q.status)}
          </span>
        </td>
        <td style="vertical-align: top; text-align: right; white-space: nowrap;">
          \${actionsHtml}
        </td>
      </tr>
    \`;
  });

  container.innerHTML = \`
    <!-- KPI Summary Row -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
      <div class="panel-card" style="padding: 1rem 1.25rem; border-left: 4px solid #0284c7;">
        <div style="font-size: 0.78rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Total Quotations</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin-top: 4px;">\${totalCount}</div>
      </div>
      <div class="panel-card" style="padding: 1rem 1.25rem; border-left: 4px solid #64748b;">
        <div style="font-size: 0.78rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Draft Proposals</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: #334155; margin-top: 4px;">\${draftCount}</div>
      </div>
      <div class="panel-card" style="padding: 1rem 1.25rem; border-left: 4px solid #d97706;">
        <div style="font-size: 0.78rem; color: #d97706; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Converted to Invoice</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: #d97706; margin-top: 4px;">\${convertedCount}</div>
      </div>
    </div>

    <!-- Main Quotations Panel -->
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title" style="display: flex; align-items: center; gap: 0.6rem;">
          <span>Quotations &amp; Proposals</span>
          <span class="badge badge-neutral" style="font-size: 0.75rem;">\${filtered.length}</span>
        </div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="exportQuotationsCsv()">📥 Export CSV</button>
          \${can('quotations', 'create') ? \`
            <button class="btn btn-primary btn-sm" onclick="openNewQuotationModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Create Quotation
            </button>
          \` : ''}
        </div>
      </div>

      <!-- Controls & Search Bar -->
      <div style="padding: 0 1.35rem 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
          <button class="btn btn-sm \${quotationStatusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}" onclick="handleQuotationStatusFilter('ALL')">All</button>
          <button class="btn btn-sm \${quotationStatusFilter === 'DRAFT' ? 'btn-primary' : 'btn-secondary'}" onclick="handleQuotationStatusFilter('DRAFT')">Drafts</button>
          <button class="btn btn-sm \${quotationStatusFilter === 'CONVERTED' ? 'btn-primary' : 'btn-secondary'}" onclick="handleQuotationStatusFilter('CONVERTED')">Converted</button>
        </div>

        <div style="max-width: 320px; width: 100%;">
          <input
            type="text"
            class="form-input"
            style="width: 100%; padding: 0.45rem 0.75rem; font-size: 0.82rem;"
            placeholder="Search Quote #, customer, service, notes..."
            value="\${escapeHtml(quotationsSearchQuery)}"
            oninput="handleQuotationsSearch(this.value)"
          />
        </div>
      </div>

      <!-- Quotations Table -->
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 170px;">Quote Number</th>
              <th style="width: 200px;">Quoted To</th>
              <th>Items &amp; Scope Remarks</th>
              <th style="text-align: right; width: 130px;">Amount</th>
              <th style="width: 110px;">Status</th>
              <th style="text-align: right; width: 200px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            \${rowsHtml || '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2.5rem 1rem;">No quotations found. Click "Create Quotation" to create one.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  \`;
}

// Generate Quote Number in official APEXS format: YY-APX###### (e.g. 26-APX000450)
function generateNextQuoteNumber() {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const prefix = currentYear + '-APX';

  let highestSeq = 450;
  (state.quotations || []).forEach((q) => {
    const qNum = q.quoteNumber || '';
    if (qNum.startsWith(prefix)) {
      const match = qNum.replace(prefix, '').match(/^\\d+/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (!isNaN(val) && val > highestSeq) highestSeq = val;
      }
    }
  });

  const nextSeq = (highestSeq + 1).toString().padStart(6, '0');
  return prefix + nextSeq;
}

function openNewQuotationModal() {
  if (!state.customers.length) {
    showToast('Please add a customer in Business Directory first', 'warning');
    return;
  }

  nqSelectedItems = [];
  const nextQuoteNumber = generateNextQuoteNumber();
  const todayIso = new Date().toISOString().slice(0, 10);
  const savedSig = getSavedDefaultSignature();
  const defaultCust = (state.customers && state.customers[0]) || null;
  const defaultCustId = defaultCust ? defaultCust.id : '';
  const defaultCustDisplay = defaultCust ? (defaultCust.name + (defaultCust.customerCode ? ' (' + defaultCust.customerCode + ')' : '')) : '';

  const body = \`
    <form id="form-new-quote" onsubmit="submitNewQuotation(event)">
      <style>
        .quote-header-fields {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.85rem;
          margin-bottom: 1.15rem;
        }
        .quote-header-fields .customer-field {
          grid-column: span 2;
        }
        @media (max-width: 768px) {
          .quote-header-fields {
            grid-template-columns: 1fr;
          }
          .quote-header-fields .customer-field {
            grid-column: span 1;
          }
        }
      </style>
      <div class="quote-header-fields">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-weight: 600; margin-bottom: 0.35rem; white-space: nowrap;">Quote Number *</label>
          <input type="text" id="nq-number" class="form-input" value="\${nextQuoteNumber}" required />
        </div>
        <div class="form-group customer-field" style="margin-bottom: 0; position: relative;">
          <label class="form-label" style="font-weight: 600; margin-bottom: 0.35rem; white-space: nowrap;">Quoted To (Customer) *</label>
          <div id="nq-customer-combobox-container" class="product-combobox-container" style="position: relative;">
            <div style="position: relative; display: flex; align-items: center;">
              <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <input
                type="text"
                id="nq-customer-search-input"
                class="form-input"
                style="padding-left: 2.35rem; padding-right: 2.2rem;"
                placeholder="Search customer by name, code, or email..."
                autocomplete="off"
                value="\${escapeHtml(defaultCustDisplay)}"
                oninput="handleQuoteCustomerSearchInput(this.value)"
                onfocus="handleQuoteCustomerSearchFocus()"
                onkeydown="handleQuoteCustomerSearchKeydown(event)"
                onblur="handleQuoteCustomerBlur()"
                required
              />
              <button
                type="button"
                id="nq-customer-clear-btn"
                onclick="clearQuoteCustomerSearchBox()"
                style="display: \${defaultCustId ? 'block' : 'none'}; position: absolute; right: 0.65rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 4px; line-height: 1; font-size: 0.85rem;"
                title="Clear customer"
              >
                ✕
              </button>
            </div>
            <input type="hidden" id="nq-customer" value="\${escapeHtml(defaultCustId)}" required />
            <div id="nq-customer-dropdown" class="product-combobox-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; max-height: 250px; overflow-y: auto; z-index: 1100; background: #ffffff; border: 1px solid #cbd5e1; border-radius: var(--radius-sm); box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05);"></div>
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-weight: 600; margin-bottom: 0.35rem; white-space: nowrap;">Currency *</label>
          <select id="nq-currency" class="form-select" onchange="renderNqItemsTable()" required>
            <option value="PHP">PHP (₱)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-weight: 600; margin-bottom: 0.35rem; white-space: nowrap;">Quote Date *</label>
          <input type="date" id="nq-date" class="form-input" value="\${todayIso}" required />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-weight: 600; margin-bottom: 0.35rem; white-space: nowrap;">Valid Until</label>
          <input type="text" id="nq-valid-until" class="form-input" placeholder="e.g. December 31, 2026 only" value="December 31, 2026 only" />
        </div>
      </div>

      <!-- Autocomplete Multi-Item Search Box from Business Directory -->
      <div class="form-group" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="margin-bottom: 0;">Add Product or Service from Business Directory *</label>
          <span style="font-size: 0.74rem; color: #64748b;">Search by code or service name</span>
        </div>
        <div id="nq-combobox-container" class="product-combobox-container">
          <div style="position: relative; display: flex; align-items: center;">
            <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input
              type="text"
              id="nq-search-input"
              class="form-input"
              style="padding-left: 2.35rem; padding-right: 2.2rem;"
              placeholder="Search Business Directory for services (e.g. Installation, Training) or hardware..."
              autocomplete="off"
              oninput="handleQuoteItemSearchInput(this.value)"
              onfocus="handleQuoteItemSearchFocus()"
              onkeydown="handleQuoteItemSearchKeydown(event)"
            />
            <button
              type="button"
              id="nq-clear-btn"
              onclick="clearQuoteSearchBox()"
              style="display: none; position: absolute; right: 0.65rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 4px; line-height: 1; font-size: 0.85rem;"
              title="Clear search"
            >
              ✕
            </button>
          </div>
          <div id="nq-dropdown" class="product-combobox-dropdown" style="display: none;"></div>
        </div>
      </div>

      <!-- Selected Quotation Line Items Table -->
      <div class="form-group" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
          <span style="font-size: 0.84rem; font-weight: 600; color: var(--text-main);">
            Quotation Items <span id="nq-items-count-badge" class="badge badge-neutral" style="font-size: 0.7rem; margin-left: 0.35rem;">0 items</span>
          </span>
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.2rem 0.55rem;" onclick="addManualQuoteItem()">
            + Add Custom Item
          </button>
        </div>
        <div id="nq-items-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; background: #ffffff;">
          <!-- Populated by renderNqItemsTable() -->
        </div>
      </div>

      <!-- Payment Terms & Signatory Preferences -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.85rem; margin-bottom: 1rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Payment Terms *</label>
          <input type="text" id="nq-payment-terms" class="form-input" value="100% Advance Payment" required />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Authorized Signatory *</label>
          <input type="text" id="nq-sig-name" class="form-input" value="Jeneviev Manatad" required />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Signatory Title *</label>
          <input type="text" id="nq-sig-title" class="form-input" value="General Manager" required />
        </div>
      </div>

      <!-- E-Signature (PNG Attachment) with Auto-Save -->
      <div class="form-group" style="margin-bottom: 1.15rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="margin-bottom: 0; font-weight: 600;">Authorized E-Signature (PNG Image)</label>
          <span style="font-size: 0.74rem; color: #64748b;">Automatically saved for all subsequent quotes</span>
        </div>
        <input type="hidden" id="nq-signature-data" value="\${escapeHtml(savedSig)}" />
        <input type="file" id="nq-signature-file" accept="image/png,image/jpeg,image/webp" style="display: none;" onchange="handleSignatureFileUpload(event, 'nq')" />
        <div id="nq-sig-preview-container"></div>
      </div>

      <!-- Scope & Validity Notes (Auto-expanding large textarea) -->
      <div class="form-group" style="margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="margin-bottom: 0; font-weight: 600;">Scope &amp; Validity Notes (Appears on Quotation)</label>
          <span style="font-size: 0.74rem; color: #64748b;">Displays all typed content without truncation</span>
        </div>
        <textarea
          id="nq-notes"
          class="form-input quotation-auto-notes"
          rows="3"
          style="width: 100%; min-height: 90px; font-size: 0.88rem; line-height: 1.55; resize: vertical; overflow-y: hidden;"
          placeholder="e.g. NOTE: Installation and training fee includes airline tickets, meals, accommodation and local transportation expenses for the Technical Support..."
          oninput="autoExpandTextarea(this)"
        >NOTE: Installation and training fee includes airline tickets, meals, accommodation and local transportation expenses for the Technical Support. Three (3) days inclusive of travel time. Installation of Mounting pole is not included.</textarea>
      </div>
    </form>
  \`;

  const footer = \`
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" id="btn-submit-new-quote" class="btn btn-primary" onclick="document.getElementById('form-new-quote').requestSubmit()">Save Quotation</button>
  \`;

  openModal('Create New Quotation', body, footer, 'xl');
  renderNqItemsTable();
  renderSignaturePreview('nq', savedSig, Boolean(savedSig));

  // Close combobox dropdowns on outside click
  const handleOutsideComboboxClick = (e) => {
    const custContainer = document.getElementById('nq-customer-combobox-container');
    const custDropdown = document.getElementById('nq-customer-dropdown');
    if (custContainer && custDropdown && !custContainer.contains(e.target)) {
      custDropdown.style.display = 'none';
    }
    const itemContainer = document.getElementById('nq-combobox-container');
    const itemDropdown = document.getElementById('nq-dropdown');
    if (itemContainer && itemDropdown && !itemContainer.contains(e.target)) {
      itemDropdown.style.display = 'none';
    }
  };
  document.addEventListener('click', handleOutsideComboboxClick);

  setTimeout(() => {
    autoExpandTextarea(document.getElementById('nq-notes'));
  }, 50);
}

let quotationCustomerActiveIndex = -1;

function handleQuoteCustomerSearchFocus() {
  const input = document.getElementById('nq-customer-search-input');
  handleQuoteCustomerSearchInput(input ? input.value : '');
}

function handleQuoteCustomerSearchInput(val) {
  const dropdown = document.getElementById('nq-customer-dropdown');
  const clearBtn = document.getElementById('nq-customer-clear-btn');
  if (!dropdown) return;

  if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

  const q = (val || '').toLowerCase().trim();
  const allCusts = state.customers || [];

  const matched = allCusts.filter((c) => {
    const name = (c.name || '').toLowerCase();
    const code = (c.customerCode || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const taxId = (c.taxId || '').toLowerCase();
    return !q || name.includes(q) || code.includes(q) || email.includes(q) || taxId.includes(q);
  }).slice(0, 20);

  // If exact match found, auto-link customer ID
  const hiddenInput = document.getElementById('nq-customer');
  const exactMatch = allCusts.find((c) => {
    const full = (c.name + (c.customerCode ? ' (' + c.customerCode + ')' : '')).toLowerCase();
    return c.name.toLowerCase() === q || full === q || (c.customerCode && c.customerCode.toLowerCase() === q);
  });
  if (exactMatch && hiddenInput) {
    hiddenInput.value = exactMatch.id;
  }

  if (!matched.length) {
    dropdown.innerHTML = '<div style="padding: 0.75rem 1rem; color: #94a3b8; font-size: 0.82rem;">No customers found in Business Directory.</div>';
    dropdown.style.display = 'block';
    return;
  }

  quotationCustomerActiveIndex = -1;

  dropdown.innerHTML = matched.map((c, idx) => {
    return \`
      <div
        class="product-combobox-item"
        data-cust-id="\${escapeHtml(c.id)}"
        data-index="\${idx}"
        onmousedown="selectQuoteCustomer('\${c.id}')"
        style="padding: 0.6rem 0.85rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
        onmouseover="highlightQuoteCustomerItem(\${idx})"
      >
        <div>
          <div style="font-weight: 600; font-size: 0.84rem; color: #1e293b;">
            \${escapeHtml(c.name)}
          </div>
          <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px; display: flex; gap: 0.6rem; align-items: center;">
            <span>Code: <strong>\${escapeHtml(c.customerCode || 'N/A')}</strong></span>
            \${c.email ? \`<span style="color: #94a3b8;">•</span> <span>\${escapeHtml(c.email)}</span>\` : ''}
          </div>
        </div>
        <span class="badge badge-neutral" style="font-size: 0.65rem; padding: 0.15rem 0.4rem;">Select</span>
      </div>
    \`;
  }).join('');

  dropdown.style.display = 'block';
}

function highlightQuoteCustomerItem(idx) {
  quotationCustomerActiveIndex = idx;
  const dropdown = document.getElementById('nq-customer-dropdown');
  if (!dropdown) return;
  const items = dropdown.querySelectorAll('.product-combobox-item');
  items.forEach((it, i) => {
    it.style.background = i === idx ? '#f0f9ff' : '#ffffff';
  });
}

function handleQuoteCustomerSearchKeydown(e) {
  const dropdown = document.getElementById('nq-customer-dropdown');
  if (!dropdown || dropdown.style.display === 'none') {
    if (e.key === 'ArrowDown') {
      handleQuoteCustomerSearchFocus();
    }
    return;
  }

  const items = dropdown.querySelectorAll('.product-combobox-item');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    quotationCustomerActiveIndex = Math.min(quotationCustomerActiveIndex + 1, items.length - 1);
    highlightQuoteCustomerItem(quotationCustomerActiveIndex);
    items[quotationCustomerActiveIndex]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    quotationCustomerActiveIndex = Math.max(quotationCustomerActiveIndex - 1, 0);
    highlightQuoteCustomerItem(quotationCustomerActiveIndex);
    items[quotationCustomerActiveIndex]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (quotationCustomerActiveIndex >= 0 && items[quotationCustomerActiveIndex]) {
      const custId = items[quotationCustomerActiveIndex].getAttribute('data-cust-id');
      if (custId) selectQuoteCustomer(custId);
    } else if (items[0]) {
      const custId = items[0].getAttribute('data-cust-id');
      if (custId) selectQuoteCustomer(custId);
    }
  } else if (e.key === 'Escape') {
    dropdown.style.display = 'none';
  }
}

function handleQuoteCustomerBlur() {
  setTimeout(() => {
    const dropdown = document.getElementById('nq-customer-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    const searchInput = document.getElementById('nq-customer-search-input');
    const hiddenInput = document.getElementById('nq-customer');
    if (!searchInput || !hiddenInput) return;

    const val = (searchInput.value || '').trim();
    if (!val) {
      hiddenInput.value = '';
      return;
    }

    // If currently selected customer already matches, nothing to change
    const curCust = (state.customers || []).find((c) => c.id === hiddenInput.value);
    if (curCust) {
      const curDisplay = curCust.name + (curCust.customerCode ? ' (' + curCust.customerCode + ')' : '');
      if (curDisplay.toLowerCase() === val.toLowerCase() || curCust.name.toLowerCase() === val.toLowerCase()) {
        return;
      }
    }

    // Auto-detect match from typed text
    const q = val.toLowerCase();
    const autoMatch = (state.customers || []).find((c) =>
      c.name.toLowerCase() === q ||
      (c.customerCode && c.customerCode.toLowerCase() === q) ||
      c.name.toLowerCase().includes(q) ||
      q.includes(c.name.toLowerCase())
    );
    if (autoMatch) {
      selectQuoteCustomer(autoMatch.id);
    }
  }, 200);
}

function clearQuoteCustomerSearchBox() {
  const input = document.getElementById('nq-customer-search-input');
  const dropdown = document.getElementById('nq-customer-dropdown');
  const clearBtn = document.getElementById('nq-customer-clear-btn');
  const hiddenInput = document.getElementById('nq-customer');

  if (input) {
    input.value = '';
    input.focus();
  }
  if (hiddenInput) hiddenInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  quotationCustomerActiveIndex = -1;
  handleQuoteCustomerSearchInput('');
}

function selectQuoteCustomer(customerId) {
  const cust = (state.customers || []).find((c) => c.id === customerId);
  if (!cust) return;

  const hiddenInput = document.getElementById('nq-customer');
  const searchInput = document.getElementById('nq-customer-search-input');
  const dropdown = document.getElementById('nq-customer-dropdown');
  const clearBtn = document.getElementById('nq-customer-clear-btn');

  if (hiddenInput) hiddenInput.value = cust.id;
  if (searchInput) {
    searchInput.value = cust.name + (cust.customerCode ? ' (' + cust.customerCode + ')' : '');
  }
  if (dropdown) dropdown.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'block';
  quotationCustomerActiveIndex = -1;
}

function handleQuoteItemSearchFocus() {
  const input = document.getElementById('nq-search-input');
  if (input) handleQuoteItemSearchInput(input.value);
}

function handleQuoteItemSearchInput(val) {
  const dropdown = document.getElementById('nq-dropdown');
  const clearBtn = document.getElementById('nq-clear-btn');
  if (!dropdown) return;

  if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

  const q = (val || '').toLowerCase().trim();
  const allItems = state.products || [];

  const matched = allItems.filter((item) => {
    const sku = (item.sku || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const type = (item.type || '').toLowerCase();
    return !q || sku.includes(q) || name.includes(q) || type.includes(q);
  }).slice(0, 15);

  if (!matched.length) {
    dropdown.innerHTML = '<div style="padding: 0.75rem 1rem; color: #94a3b8; font-size: 0.82rem;">No items found in Business Directory. Click "+ Add Custom Item" to type manually.</div>';
    dropdown.style.display = 'block';
    return;
  }

  quotationActiveSearchIndex = -1;
  const currency = document.getElementById('nq-currency')?.value || 'PHP';

  dropdown.innerHTML = matched.map((item, idx) => {
    const isService = item.type === 'SERVICE';
    const tag = isService
      ? '<span class="badge badge-primary" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">SERVICE</span>'
      : '<span class="badge badge-neutral" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">PRODUCT</span>';
    const priceCents = item.sellingPriceCents || item.costPriceCents || 0;
    const priceFormatted = (priceCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return \`
      <div
        class="product-combobox-item"
        data-index="\${idx}"
        onclick="selectQuoteDirectoryItem('\${item.id}')"
        style="padding: 0.6rem 0.85rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; cursor: pointer;"
      >
        <div>
          <div style="font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
            \${tag}
            \${escapeHtml(item.name)}
          </div>
          <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">
            Code: \${escapeHtml(item.sku || 'N/A')}
          </div>
        </div>
        <div style="font-weight: 700; font-size: 0.85rem; color: #0284c7;">
          \${currency} \${priceFormatted}
        </div>
      </div>
    \`;
  }).join('');

  dropdown.style.display = 'block';
}

function handleQuoteItemSearchKeydown(e) {
  const dropdown = document.getElementById('nq-dropdown');
  if (!dropdown || dropdown.style.display === 'none') return;

  const items = dropdown.querySelectorAll('.product-combobox-item');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    quotationActiveSearchIndex = Math.min(quotationActiveSearchIndex + 1, items.length - 1);
    highlightQuoteSearchItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    quotationActiveSearchIndex = Math.max(quotationActiveSearchIndex - 1, 0);
    highlightQuoteSearchItem(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (quotationActiveSearchIndex >= 0 && items[quotationActiveSearchIndex]) {
      items[quotationActiveSearchIndex].click();
    }
  } else if (e.key === 'Escape') {
    clearQuoteSearchBox();
  }
}

function highlightQuoteSearchItem(items) {
  items.forEach((it, idx) => {
    if (idx === quotationActiveSearchIndex) {
      it.style.background = '#f0f9ff';
      it.scrollIntoView({ block: 'nearest' });
    } else {
      it.style.background = '#ffffff';
    }
  });
}

function clearQuoteSearchBox() {
  const input = document.getElementById('nq-search-input');
  const dropdown = document.getElementById('nq-dropdown');
  const clearBtn = document.getElementById('nq-clear-btn');
  if (input) input.value = '';
  if (dropdown) dropdown.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
  quotationActiveSearchIndex = -1;
}

function selectQuoteDirectoryItem(productId) {
  const product = (state.products || []).find((p) => p.id === productId);
  if (!product) return;

  nqSelectedItems.push({
    productId: product.id,
    partNumber: product.sku || '',
    description: product.name || '',
    quantity: 1,
    unitPriceCents: product.sellingPriceCents || product.costPriceCents || 0,
    notes: product.type === 'SERVICE' ? 'VAT Inclusive' : '',
  });

  clearQuoteSearchBox();
  renderNqItemsTable();
}

function addManualQuoteItem() {
  nqSelectedItems.push({
    productId: null,
    partNumber: '',
    description: 'Installation and Training Fee',
    quantity: 1,
    unitPriceCents: 4500000, // 45,000.00
    notes: 'VAT Inclusive',
  });
  renderNqItemsTable();
}

function removeQuoteItem(idx) {
  nqSelectedItems.splice(idx, 1);
  renderNqItemsTable();
}

function updateQuoteItemQuantity(idx, val) {
  const qty = Math.max(1, parseInt(val, 10) || 1);
  if (nqSelectedItems[idx]) {
    nqSelectedItems[idx].quantity = qty;
    renderNqItemsTable();
  }
}

function updateQuoteItemPrice(idx, val) {
  const price = Math.max(0, parseFloat(val) || 0);
  if (nqSelectedItems[idx]) {
    nqSelectedItems[idx].unitPriceCents = Math.round(price * 100);
    renderNqItemsTable();
  }
}

function updateQuoteItemPartNumber(idx, val) {
  if (nqSelectedItems[idx]) nqSelectedItems[idx].partNumber = val;
}

function updateQuoteItemDescription(idx, val) {
  if (nqSelectedItems[idx]) nqSelectedItems[idx].description = val;
}

function updateQuoteItemNotes(idx, val) {
  if (nqSelectedItems[idx]) nqSelectedItems[idx].notes = val;
}

function renderNqItemsTable() {
  const container = document.getElementById('nq-items-container');
  const countBadge = document.getElementById('nq-items-count-badge');
  if (!container) return;

  if (countBadge) countBadge.textContent = nqSelectedItems.length + ' item' + (nqSelectedItems.length === 1 ? '' : 's');

  if (!nqSelectedItems.length) {
    container.innerHTML = \`
      <div style="padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.82rem;">
        No line items added yet. Search a service/product above or click "+ Add Custom Item".
      </div>
    \`;
    return;
  }

  const currency = document.getElementById('nq-currency')?.value || 'PHP';
  let totalCents = 0;

  const rows = nqSelectedItems.map((item, idx) => {
    const subtotalCents = (item.quantity || 1) * (item.unitPriceCents || 0);
    totalCents += subtotalCents;

    const unitPrice = ((item.unitPriceCents || 0) / 100).toFixed(2);
    const subtotal = (subtotalCents / 100).toFixed(2);

    return \`
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="width: 80px; padding: 0.5rem;">
          <input type="number" class="form-input" style="padding: 0.3rem 0.4rem; text-align: center;" min="1" value="\${item.quantity}" onchange="updateQuoteItemQuantity(\${idx}, this.value)" required />
        </td>
        <td style="width: 130px; padding: 0.5rem;">
          <input type="text" class="form-input" style="padding: 0.3rem 0.5rem;" placeholder="Part #" value="\${escapeHtml(item.partNumber || '')}" oninput="updateQuoteItemPartNumber(\${idx}, this.value)" />
        </td>
        <td style="padding: 0.5rem;">
          <input type="text" class="form-input" style="padding: 0.3rem 0.5rem; margin-bottom: 4px;" placeholder="Item / Service Name" value="\${escapeHtml(item.description || '')}" oninput="updateQuoteItemDescription(\${idx}, this.value)" required />
          <input type="text" class="form-input" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #64748b;" placeholder="Remarks (e.g. VAT Inclusive)" value="\${escapeHtml(item.notes || '')}" oninput="updateQuoteItemNotes(\${idx}, this.value)" />
        </td>
        <td style="width: 120px; padding: 0.5rem;">
          <input type="number" class="form-input" style="padding: 0.3rem 0.4rem; text-align: right;" step="0.01" min="0" value="\${unitPrice}" onchange="updateQuoteItemPrice(\${idx}, this.value)" required />
        </td>
        <td style="width: 120px; padding: 0.5rem; text-align: right; font-weight: 700; color: #0284c7;">
          \${currency} \${subtotal}
        </td>
        <td style="width: 40px; padding: 0.5rem; text-align: center;">
          <button type="button" class="btn btn-danger btn-sm" style="padding: 0.2rem 0.4rem;" onclick="removeQuoteItem(\${idx})">✕</button>
        </td>
      </tr>
    \`;
  }).join('');

  const totalFormatted = (totalCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  container.innerHTML = \`
    <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
      <thead style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <tr>
          <th style="padding: 0.4rem 0.5rem; text-align: center;">Qty</th>
          <th style="padding: 0.4rem 0.5rem; text-align: left;">Part Number</th>
          <th style="padding: 0.4rem 0.5rem; text-align: left;">Description &amp; Remarks</th>
          <th style="padding: 0.4rem 0.5rem; text-align: right;">Unit Price</th>
          <th style="padding: 0.4rem 0.5rem; text-align: right;">Amount</th>
          <th style="padding: 0.4rem 0.5rem;"></th>
        </tr>
      </thead>
      <tbody>
        \${rows}
      </tbody>
      <tfoot style="background: #f8fafc; border-top: 2px solid #e2e8f0;">
        <tr>
          <td colspan="4" style="padding: 0.6rem 0.8rem; text-align: right; font-weight: 700;">TOTAL &gt; &gt;</td>
          <td style="padding: 0.6rem 0.5rem; text-align: right; font-weight: 800; font-size: 0.95rem; color: #0284c7;">
            \${currency} \${totalFormatted}
          </td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  \`;
}

async function submitNewQuotation(e) {
  e.preventDefault();
  if (isSubmittingQuotation) return;

  const quoteNumber = (document.getElementById('nq-number')?.value || '').trim();
  let customerId = (document.getElementById('nq-customer')?.value || '').trim();
  const searchInputVal = (document.getElementById('nq-customer-search-input')?.value || '').trim();

  if (!customerId && searchInputVal) {
    const q = searchInputVal.toLowerCase();
    const match = (state.customers || []).find((c) =>
      c.name.toLowerCase() === q ||
      (c.customerCode && c.customerCode.toLowerCase() === q) ||
      c.name.toLowerCase().includes(q) ||
      q.includes(c.name.toLowerCase())
    );
    if (match) {
      customerId = match.id;
      const hiddenInput = document.getElementById('nq-customer');
      if (hiddenInput) hiddenInput.value = match.id;
    }
  }

  const currency = document.getElementById('nq-currency')?.value || 'PHP';
  const quoteDate = document.getElementById('nq-date')?.value || new Date().toISOString().slice(0, 10);
  const validUntil = (document.getElementById('nq-valid-until')?.value || '').trim();
  const paymentTerms = (document.getElementById('nq-payment-terms')?.value || '100% Advance Payment').trim();
  const signatoryName = (document.getElementById('nq-sig-name')?.value || 'Jeneviev Manatad').trim();
  const signatoryTitle = (document.getElementById('nq-sig-title')?.value || 'General Manager').trim();
  const signatureImageData = (document.getElementById('nq-signature-data')?.value || '').trim() || null;
  const notes = (document.getElementById('nq-notes')?.value || '').trim();

  if (signatureImageData) {
    saveDefaultSignature(signatureImageData);
  }

  if (!quoteNumber) {
    showToast('Quote Number is required', 'warning');
    return;
  }
  if (!customerId) {
    showToast('Customer is required. Please select from the dropdown list.', 'warning');
    document.getElementById('nq-customer-search-input')?.focus();
    return;
  }
  if (!nqSelectedItems.length) {
    showToast('Please add at least one line item', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-new-quote');
  isSubmittingQuotation = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteNumber,
        customerId,
        currency,
        quoteDate,
        validUntil,
        paymentTerms,
        authorizedSignatoryName: signatoryName,
        authorizedSignatoryTitle: signatoryTitle,
        signatureImageData,
        notes,
        items: nqSelectedItems,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save quotation');

    closeModal();
    showToast('Quotation ' + json.data.quoteNumber + ' created successfully!', 'success');

    // Refresh view
    await loadQuotations();

    // Automatically offer to open the generated PDF in a new tab
    if (confirm('Quotation ' + json.data.quoteNumber + ' created! Would you like to view/print the official PDF in a new tab now?')) {
      openQuotationPdf(json.data.id);
    }
  } catch (err) {
    showToast(err.message, 'danger');
  } finally {
    isSubmittingQuotation = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Quotation';
    }
  }
}

async function promptConvertQuotation(quoteId) {
  const quote = (state.quotations || []).find((q) => q.id === quoteId);
  if (!quote) return;

  if (!confirm('Convert Quotation ' + quote.quoteNumber + ' to a Sales Invoice? This will automatically create an official Sales Invoice with all line items and customer details.')) {
    return;
  }

  try {
    const res = await apiFetch('/api/quotations/' + encodeURIComponent(quoteId) + '/convert', {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to convert quotation');

    showToast('Quotation converted to Sales Invoice ' + json.data.salesOrder.soNumber + '!', 'success');
    await loadQuotations();

    // Navigate to Sales module to view the new Sales Invoice
    switchTab('sales');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteQuotationPrompt(quoteId, quoteNumber) {
  if (!confirm('Are you sure you want to delete quotation ' + quoteNumber + '?')) return;

  try {
    const res = await apiFetch('/api/quotations/' + encodeURIComponent(quoteId), {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete quotation');

    showToast('Quotation ' + quoteNumber + ' deleted', 'success');
    await loadQuotations();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openEditQuotationModal(quoteId) {
  const quote = (state.quotations || []).find((q) => q.id === quoteId);
  if (!quote) return;

  const currentSig = quote.signatureImageData || '';

  const body = \`
    <form id="form-edit-quote" onsubmit="submitEditQuotation(event, '\${quote.id}')">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.85rem; margin-bottom: 1.15rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Quote Number *</label>
          <input type="text" id="eq-number" class="form-input" value="\${escapeHtml(quote.quoteNumber)}" required />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Status</label>
          <select id="eq-status" class="form-select">
            <option value="DRAFT" \${quote.status === 'DRAFT' ? 'selected' : ''}>DRAFT</option>
            <option value="SENT" \${quote.status === 'SENT' ? 'selected' : ''}>SENT</option>
            <option value="ACCEPTED" \${quote.status === 'ACCEPTED' ? 'selected' : ''}>ACCEPTED</option>
            <option value="REJECTED" \${quote.status === 'REJECTED' ? 'selected' : ''}>REJECTED</option>
            <option value="CONVERTED" \${quote.status === 'CONVERTED' ? 'selected' : ''}>CONVERTED</option>
            <option value="EXPIRED" \${quote.status === 'EXPIRED' ? 'selected' : ''}>EXPIRED</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Quote Date</label>
          <input type="date" id="eq-date" class="form-input" value="\${escapeHtml(quote.quoteDate || '')}" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Valid Until</label>
          <input type="text" id="eq-valid-until" class="form-input" value="\${escapeHtml(quote.validUntil || '')}" />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.85rem; margin-bottom: 1.15rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Payment Terms</label>
          <input type="text" id="eq-payment-terms" class="form-input" value="\${escapeHtml(quote.paymentTerms || '')}" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Authorized Signatory</label>
          <input type="text" id="eq-sig-name" class="form-input" value="\${escapeHtml(quote.authorizedSignatoryName || '')}" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Signatory Title</label>
          <input type="text" id="eq-sig-title" class="form-input" value="\${escapeHtml(quote.authorizedSignatoryTitle || '')}" />
        </div>
      </div>

      <!-- E-Signature (PNG Attachment) with Auto-Save -->
      <div class="form-group" style="margin-bottom: 1.15rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="margin-bottom: 0; font-weight: 600;">Authorized E-Signature (PNG Image)</label>
          <span style="font-size: 0.74rem; color: #64748b;">Renders on official PDF document</span>
        </div>
        <input type="hidden" id="eq-signature-data" value="\${escapeHtml(currentSig)}" />
        <input type="file" id="eq-signature-file" accept="image/png,image/jpeg,image/webp" style="display: none;" onchange="handleSignatureFileUpload(event, 'eq')" />
        <div id="eq-sig-preview-container"></div>
      </div>

      <!-- Scope & Validity Notes (Auto-expanding large textarea) -->
      <div class="form-group" style="margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="margin-bottom: 0; font-weight: 600;">Scope &amp; Validity Notes</label>
          <span style="font-size: 0.74rem; color: #64748b;">Displays all typed content without truncation</span>
        </div>
        <textarea
          id="eq-notes"
          class="form-input quotation-auto-notes"
          rows="4"
          style="width: 100%; min-height: 90px; font-size: 0.88rem; line-height: 1.55; resize: vertical; overflow-y: hidden;"
          placeholder="e.g. Scope of work, deliverables, travel inclusions, exclusions..."
          oninput="autoExpandTextarea(this)"
        >\${escapeHtml(quote.notes || '')}</textarea>
      </div>
    </form>
  \`;

  const footer = \`
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="document.getElementById('form-edit-quote').requestSubmit()">Save Changes</button>
  \`;

  openModal('Edit Quotation ' + quote.quoteNumber, body, footer, 'xl');
  renderSignaturePreview('eq', currentSig, false);
  setTimeout(() => {
    autoExpandTextarea(document.getElementById('eq-notes'));
  }, 50);
}

async function submitEditQuotation(e, quoteId) {
  e.preventDefault();
  const quoteNumber = (document.getElementById('eq-number')?.value || '').trim();
  const status = document.getElementById('eq-status')?.value;
  const quoteDate = document.getElementById('eq-date')?.value;
  const validUntil = (document.getElementById('eq-valid-until')?.value || '').trim();
  const paymentTerms = (document.getElementById('eq-payment-terms')?.value || '').trim();
  const authorizedSignatoryName = (document.getElementById('eq-sig-name')?.value || '').trim();
  const authorizedSignatoryTitle = (document.getElementById('eq-sig-title')?.value || '').trim();
  const signatureImageData = (document.getElementById('eq-signature-data')?.value || '').trim() || null;
  const notes = (document.getElementById('eq-notes')?.value || '').trim();

  if (signatureImageData) {
    saveDefaultSignature(signatureImageData);
  }

  try {
    const res = await apiFetch('/api/quotations/' + encodeURIComponent(quoteId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteNumber,
        status,
        quoteDate,
        validUntil,
        paymentTerms,
        authorizedSignatoryName,
        authorizedSignatoryTitle,
        signatureImageData,
        notes,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update quotation');

    closeModal();
    showToast('Quotation updated successfully', 'success');
    await loadQuotations();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
