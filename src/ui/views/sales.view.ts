export function renderSalesView(): string {
  return `<div id="view-sales" class="tab-view" style="display: none;"></div>`;
}

export const SALES_CLIENT_JS = `
let salesSearchQuery = '';

async function loadSales() {
  const container = document.getElementById('view-sales');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading sales data...</div>');

  try {
    salesSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';

    const [soRes, custRes, prodRes] = await Promise.all([
      apiFetch('/api/sales/orders'),
      apiFetch('/api/sales/customers'),
      apiFetch('/api/inventory/products'),
    ]);
    const soJson = await soRes.json();
    const custJson = await custRes.json();
    const prodJson = await prodRes.json();

    state.salesOrders = soJson.data || [];
    state.customers = custJson.data || [];
    state.products = prodJson.data || [];
    state.services = (state.products || []).filter((p) => p.type === 'SERVICE');

    renderSalesContent(container);
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading sales: \${err.message}</div>\`;
  }
}

function handleSalesSearch(query) {
  salesSearchQuery = query.toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', salesSearchQuery || null);
  }
  const container = document.getElementById('view-sales');
  if (container) {
    renderSalesContent(container);
  }
}

function exportSalesCsv() {
  const headers = ['SI Number', 'Customer', 'Items & Remarks', 'Status', 'Currency', 'Order Total', 'Invoices'];
  const rows = (state.salesOrders || []).map((so) => {
    const itemsDesc = (so.items || [])
      .map((i) => (i.quantity || 1) + 'x ' + (i.product?.name || 'Item') + (i.notes ? ' [Remarks: ' + i.notes + ']' : ''))
      .join('; ') + (so.notes ? ' | Order Notes: ' + so.notes : '');
    return [
      formatSiNumber(so.siNumber || so.soNumber),
      so.customer?.name || 'Customer',
      itemsDesc,
      so.status,
      so.currency || 'PHP',
      (so.totalAmountCents / 100).toFixed(2),
      (so.invoices || []).map((inv) => \`\${inv.invoiceNumber} (\${inv.status})\`).join('; ') || 'None',
    ];
  });
  exportToCsv('sales_invoices_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function goToOutboundForSO(soId) {
  switchTab('outbound');
  setTimeout(() => {
    if (typeof openCreateDeliveryReceiptModal === 'function') {
      openCreateDeliveryReceiptModal(soId);
    }
  }, 100);
}

function renderSalesContent(container) {
  const soStatusBadgeClass = {
    DRAFT: 'badge-neutral',
    CONFIRMED: 'badge-primary',
    PACKED: 'badge-warning',
    PARTIALLY_FULFILLED: 'badge-warning',
    FULFILLED: 'badge-success',
    CANCELLED: 'badge-danger',
  };

  let filteredOrders = state.salesOrders || [];
  if (salesSearchQuery) {
    filteredOrders = filteredOrders.filter((so) => {
      const num = (so.siNumber || so.soNumber || '').toLowerCase();
      const cust = (so.customer?.name || '').toLowerCase();
      const status = (so.status || '').toLowerCase();
      const notes = (so.notes || '').toLowerCase();
      const itemsMatch = (so.items || []).some((i) => {
        const pName = (i.product?.name || '').toLowerCase();
        const pSku = (i.product?.sku || '').toLowerCase();
        const iNotes = (i.notes || '').toLowerCase();
        return pName.includes(salesSearchQuery) || pSku.includes(salesSearchQuery) || iNotes.includes(salesSearchQuery);
      });
      return num.includes(salesSearchQuery) || cust.includes(salesSearchQuery) || status.includes(salesSearchQuery) || notes.includes(salesSearchQuery) || itemsMatch;
    });
  }

  let rowsHtml = '';
  filteredOrders.forEach((so) => {
    // Delivery Receipts under this Sales Invoice
    const drs = so.deliveryReceipts || [];
    const isAllServices = (so.items || []).length > 0 && (so.items || []).every((i) => i.product?.type === 'SERVICE');
    const drsHtml = drs
      .map((dr) => {
        const isArr = dr.status === 'COMPLETED' || (!dr.status && dr.receivedBy);
        const badgeClass = isArr ? 'badge-success' : 'badge-warning';
        const label = isArr ? (dr.drNumber + ' arrived') : (dr.drNumber + ' in transit');
        return (
          '<div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem;">' +
          '<span class="badge ' + badgeClass + '" style="font-size: 0.68rem;"><span class="badge-dot"></span>' + label + '</span>' +
          '</div>'
        );
      })
      .join('');

    // Check if order has remaining undelivered goods to provide direct Create DR action
    const hasRemainingToDeliver = (so.items || []).some((i) => i.product?.type !== 'SERVICE' && (i.quantity - i.quantityShipped) > 0) &&
      (so.status === 'CONFIRMED' || so.status === 'PACKED' || so.status === 'PARTIALLY_FULFILLED');

    const deliverActionHtml = hasRemainingToDeliver && can('outbound', 'create')
      ? '<div style="margin-top: 0.35rem;">' +
        '<button type="button" class="btn btn-success btn-sm" style="padding: 0.2rem 0.55rem; font-size: 0.72rem; font-weight: 600;" onclick="goToOutboundForSO(&quot;' + so.id + '&quot;)">📦 + Create DR</button>' +
        '</div>'
      : '';

    let deliveriesHtml = [drsHtml, deliverActionHtml].filter(Boolean).join('');
    if (!deliveriesHtml) {
      if (isAllServices) {
        deliveriesHtml = '<span class="badge badge-success" style="font-size: 0.68rem;"><span class="badge-dot"></span>✓ Service (Non-Stock)</span>';
      } else {
        deliveriesHtml = '<span style="color: #94a3b8; font-size: 0.78rem;">Not yet delivered</span>';
      }
    }

    const itemsSummaryHtml = (so.items && so.items.length)
      ? so.items.map((i) => {
          const isSrv = i.product?.type === 'SERVICE';
          const typeBadge = isSrv
            ? '<span style="background: #e0f2fe; color: #0284c7; padding: 1px 4px; border-radius: 3px; font-size: 0.65rem; font-weight: 700; margin-right: 3px;">💼</span>'
            : '<span style="background: #f1f5f9; color: #475569; padding: 1px 4px; border-radius: 3px; font-size: 0.65rem; font-weight: 700; margin-right: 3px;">📦</span>';
          const notesBadge = i.notes
            ? '<div style="font-size: 0.72rem; color: #0284c7; background: #f0f9ff; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 2px; border: 1px solid #bae6fd; font-weight: 500;">📝 ' + escapeHtml(i.notes) + '</div>'
            : '';
          return (
            '<div style="margin-bottom: 0.35rem;">' +
              '<div style="display: flex; align-items: baseline; gap: 0.35rem; flex-wrap: wrap;">' +
                typeBadge +
                '<span style="font-weight: 700; color: #0f172a;">' + i.quantity + 'x</span>' +
                '<span style="font-weight: 600;">' + escapeHtml(i.product?.name || 'Item') + '</span>' +
                '<span style="font-family: monospace; font-size: 0.7rem; color: #64748b;">(' + escapeHtml(i.product?.sku || '') + ')</span>' +
              '</div>' +
              notesBadge +
            '</div>'
          );
        }).join('') + (so.notes ? '<div style="font-size: 0.72rem; color: #64748b; font-style: italic; margin-top: 0.25rem; border-top: 1px dashed #e2e8f0; padding-top: 2px;">💬 ' + escapeHtml(so.notes) + '</div>' : '')
      : '<span style="color: #94a3b8; font-size: 0.75rem;">No items</span>';

    const canUpdate = can('sales', 'update');
    const canDelete = can('sales', 'delete');
    const editBtnHtml = canUpdate
      ? \`<button
          class="btn-action-icon"
          onclick="openEditSalesOrderModal('\${so.id}')"
          title="Edit Sales Invoice"
          aria-label="Edit"
          style="width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #2563eb; box-shadow: 0 1px 2px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.15s ease;"
          onmouseover="this.style.background='#eff6ff'; this.style.borderColor='#93c5fd'; this.style.transform='translateY(-1px)'"
          onmouseout="this.style.background='#ffffff'; this.style.borderColor='#cbd5e1'; this.style.transform='none'"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>\`
      : '';
    const deleteBtnHtml = canDelete
      ? \`<button
          class="btn-action-icon"
          onclick="deleteSalesOrder('\${so.id}')"
          title="Delete Sales Invoice"
          aria-label="Delete"
          style="width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #fecaca; background: #ffffff; color: #dc2626; box-shadow: 0 1px 2px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.15s ease; margin-left: 4px;"
          onmouseover="this.style.background='#fee2e2'; this.style.borderColor='#ef4444'; this.style.color='#b91c1c'; this.style.transform='translateY(-1px)'"
          onmouseout="this.style.background='#ffffff'; this.style.borderColor='#fecaca'; this.style.color='#dc2626'; this.style.transform='none'"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>\`
      : '';
    const actionsHtml = editBtnHtml || deleteBtnHtml ? (editBtnHtml + deleteBtnHtml) : '';

    rowsHtml += \`
      <tr>
        <td style="vertical-align: top;"><strong>\${formatSiNumber(so.siNumber || so.soNumber)}</strong></td>
        <td style="vertical-align: top;">\${so.customer?.name || 'Customer'}</td>
        <td style="max-width: 320px; font-size: 0.8rem; vertical-align: top;">
          \${itemsSummaryHtml}
        </td>
        <td style="vertical-align: top;">
          <span class="badge \${soStatusBadgeClass[so.status] || 'badge-neutral'}">
            <span class="badge-dot"></span>
            \${so.status.replace('_', ' ')}
          </span>
        </td>
        <td style="vertical-align: top;"><strong>\${formatCurrency(so.totalAmountCents, so.currency)}</strong></td>
        <td style="vertical-align: top;">\${deliveriesHtml}</td>
        <td style="vertical-align: top; text-align: right; white-space: nowrap;">
          \${actionsHtml || '<span style="color: #94a3b8; font-size: 0.75rem;">—</span>'}
        </td>
      </tr>
    \`;
  });

  container.innerHTML = \`
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Sales Invoices</div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="exportSalesCsv()">📥 Export CSV</button>
          \${can('sales', 'create') ? '<button class="btn btn-primary btn-sm" onclick="openNewSalesOrderModal()">Create Sales Invoice</button>' : ''}
        </div>
      </div>
      <div style="padding: 0 1.35rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <p style="font-size: 0.85rem; color: #64748b; margin: 0; flex: 1 1 260px;">
          Manage customers and services in the Business Directory. Confirmed Sales Invoices post directly to Accounts Receivable.
        </p>
        <div style="max-width: 280px; width: 100%;">
          <input type="text" class="form-input" style="width: 100%; padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search SI #, customer, item, remarks..." value="\${salesSearchQuery}" oninput="handleSalesSearch(this.value)" />
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>SI Number</th>
              <th>Customer</th>
              <th>Items & Remarks</th>
              <th>Status</th>
              <th>Order Total</th>
              <th>Deliveries</th>
              <th style="text-align: right; width: 90px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            \${rowsHtml || '<tr><td colspan="7" style="text-align: center; color: #64748b;">No sales invoices found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  \`;
}

let nsoSelectedItems = [];
let salesItemActiveIndex = -1;

function openNewSalesOrderModal() {
  if (!state.customers.length) {
    showToast('Please add a customer first', 'warning');
    return;
  }
  const allItems = state.products || [];
  if (!allItems.length) {
    showToast('Please add a product or service first in Business Directory or Inventory', 'warning');
    return;
  }

  nsoSelectedItems = [];

  const sessionLatestSi = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('last_si_number') : null;
  const latestSi = sessionLatestSi || ((state.salesOrders && state.salesOrders.length)
    ? (state.salesOrders[0].siNumber || state.salesOrders[0].soNumber)
    : null);
  const nextSiNumber = generateNextSequence(latestSi, 'SI-');

  const custOptions = (state.customers || [])
    .map((c) => \`<option value="\${c.id}">\${escapeHtml(c.name)} (\${c.customerCode})</option>\`)
    .join('');

  const body = \`
    <form id="form-new-so" onsubmit="submitNewSalesOrder(event)">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.85rem; margin-bottom: 1.15rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">SI Number *</label>
          <input type="text" id="nso-sinumber" class="form-input" value="\${nextSiNumber}" placeholder="e.g. SI-1001" required />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Customer *</label>
          <select id="nso-cust" class="form-select" required>
            \${custOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Currency *</label>
          <select id="nso-currency" class="form-select" onchange="renderNsoItemsTable()" required>
            <option value="PHP">PHP (₱)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>

      <!-- Autocomplete Multi-Item Search Box -->
      <div class="form-group" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="margin-bottom: 0;">Add Products or Services *</label>
          <span style="font-size: 0.74rem; color: #64748b;">Type SKU, name, or service — select multiple items below</span>
        </div>
        <div id="nso-combobox-container" class="product-combobox-container">
          <div style="position: relative; display: flex; align-items: center;">
            <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input
              type="text"
              id="nso-search-input"
              class="form-input"
              style="padding-left: 2.35rem; padding-right: 2.2rem;"
              placeholder="Search by SKU, product name, service, or category to add..."
              autocomplete="off"
              oninput="handleSalesItemSearchInput(this.value)"
              onfocus="handleSalesItemSearchFocus()"
              onkeydown="handleSalesItemSearchKeydown(event)"
            />
            <button
              type="button"
              id="nso-clear-btn"
              onclick="clearSalesSearchBox()"
              style="display: none; position: absolute; right: 0.65rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 4px; line-height: 1; font-size: 0.85rem;"
              title="Clear search"
            >
              ✕
            </button>
          </div>
          <div id="nso-dropdown" class="product-combobox-dropdown" style="display: none;"></div>
        </div>
      </div>

      <!-- Selected Invoice Items Table -->
      <div class="form-group" style="margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
          <span style="font-size: 0.84rem; font-weight: 600; color: var(--text-main);">
            Invoice Line Items <span id="nso-items-count-badge" class="badge badge-neutral" style="font-size: 0.7rem; margin-left: 0.35rem;">0 items</span>
          </span>
          <span style="font-size: 0.74rem; color: #64748b;">Prices and quantities are editable</span>
        </div>
        <div id="nso-items-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; background: #ffffff;">
          <!-- Dynamically populated by renderNsoItemsTable() -->
        </div>
      </div>
    </form>
  \`;
  const footer = \`
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="document.getElementById('form-new-so').requestSubmit()">Confirm & Issue Invoice</button>
  \`;
  openModal('Create Sales Invoice', body, footer, 'lg');
  renderNsoItemsTable();

  // Close combobox dropdown on outside click
  const handleOutsideClick = (e) => {
    const container = document.getElementById('nso-combobox-container');
    const dropdown = document.getElementById('nso-dropdown');
    if (container && dropdown && !container.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  };
  document.addEventListener('click', handleOutsideClick);

  setTimeout(() => {
    const input = document.getElementById('nso-search-input');
    if (input) input.focus();
  }, 100);
}

// ---------------------------------------------------------------------------
// Sales Item Autocomplete Search Combobox & Multi-Item List Management
// ---------------------------------------------------------------------------
function highlightSalesMatch(text, query) {
  if (!text) return '';
  const str = String(text);
  if (!query || !query.trim()) return escapeHtml(str);
  const q = query.trim().toLowerCase();
  const lower = str.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return escapeHtml(str);
  const before = escapeHtml(str.slice(0, idx));
  const match = escapeHtml(str.slice(idx, idx + q.length));
  const after = highlightSalesMatch(str.slice(idx + q.length), query);
  return before + '<mark style="background: #fef08a; color: #854d0e; padding: 0 2px; border-radius: 2px; font-weight: 700;">' + match + '</mark>' + after;
}

function handleSalesItemSearchFocus() {
  const input = document.getElementById('nso-search-input');
  const val = input ? input.value : '';
  renderSalesItemDropdown(val);
  if (input && val) {
    input.select();
  }
}

function handleSalesItemSearchInput(query) {
  const clearBtn = document.getElementById('nso-clear-btn');
  if (clearBtn) {
    clearBtn.style.display = query && query.length > 0 ? 'inline-flex' : 'none';
  }
  renderSalesItemDropdown(query);
}

function clearSalesSearchBox() {
  const input = document.getElementById('nso-search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  const clearBtn = document.getElementById('nso-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderSalesItemDropdown('');
}

function renderSalesItemDropdown(query) {
  const dropdown = document.getElementById('nso-dropdown');
  if (!dropdown) return;

  salesItemActiveIndex = -1;
  const q = (query || '').toLowerCase().trim();
  const allItems = state.products || [];

  let matches = allItems;
  if (q) {
    const terms = q.split(/\\s+/).filter(Boolean);
    matches = allItems.filter((p) => {
      const sku = (p.sku || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const type = (p.type || 'PRODUCT').toLowerCase();
      return terms.every((t) =>
        sku.includes(t) ||
        name.includes(t) ||
        cat.includes(t) ||
        desc.includes(t) ||
        (t === 'service' && type === 'service') ||
        (t === 'product' && type !== 'service')
      );
    });
  }

  if (q) {
    matches.sort((a, b) => {
      const aSkuStarts = (a.sku || '').toLowerCase().startsWith(q) ? 1 : 0;
      const bSkuStarts = (b.sku || '').toLowerCase().startsWith(q) ? 1 : 0;
      if (aSkuStarts !== bSkuStarts) return bSkuStarts - aSkuStarts;
      const aNameStarts = (a.name || '').toLowerCase().startsWith(q) ? 1 : 0;
      const bNameStarts = (b.name || '').toLowerCase().startsWith(q) ? 1 : 0;
      if (aNameStarts !== bNameStarts) return bNameStarts - aNameStarts;
      return 0;
    });
  }

  const limit = 45;
  const visible = matches.slice(0, limit);

  if (matches.length === 0) {
    dropdown.innerHTML = \`
      <div style="padding: 1.25rem 1rem; text-align: center; color: #64748b; font-size: 0.82rem;">
        No products or services found matching "<strong style="color: #0f172a;">\${escapeHtml(q)}</strong>"
      </div>
    \`;
    dropdown.style.display = 'block';
    return;
  }

  let headerText = q
    ? \`\${matches.length} matching item\${matches.length === 1 ? '' : 's'}\`
    : \`All products & services (\${matches.length})\`;

  let itemsHtml = '';
  visible.forEach((p, idx) => {
    const isService = p.type === 'SERVICE';
    const isAlreadyAdded = nsoSelectedItems.some((it) => it.productId === p.id);

    const typeBadge = isService
      ? '<span style="background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.02em;">💼 SERVICE</span>'
      : '<span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.02em;">📦 PRODUCT</span>';

    const stockBadge = isService
      ? '<span style="color: #0284c7; font-size: 0.72rem; font-weight: 600;">Non-Stock</span>'
      : ((p.onHandStock || 0) > 0
          ? \`<span class="badge badge-success" style="font-size: 0.7rem; padding: 1px 6px;">\${p.onHandStock} in stock</span>\`
          : \`<span class="badge badge-secondary" style="font-size: 0.7rem; padding: 1px 6px; opacity: 0.85;">0 in stock</span>\`);

    const priceDisplay = p.sellingPriceCents > 0
      ? \`Rate/Price: <strong style="color: #0f172a;">\${formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency)}</strong>\`
      : \`<span style="color: #94a3b8;">Rate: not set</span>\`;

    const categoryDisplay = p.category
      ? \`<span style="background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 500;">\${escapeHtml(p.category)}</span>\`
      : '';

    itemsHtml += \`
      <div class="product-combobox-item \${isAlreadyAdded ? 'selected' : ''}"
           data-index="\${idx}"
           data-product-id="\${p.id}"
           onclick="addSalesItemFromSearch('\${p.id}')"
           style="padding: 0.65rem 0.85rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.12s ease; \${isAlreadyAdded ? 'background: #f0fdf4;' : ''}">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 3px;">
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            \${typeBadge}
            <span style="font-family: monospace; font-size: 0.78rem; font-weight: 700; background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.02em;">
              \${highlightSalesMatch(p.sku, q)}
            </span>
            \${categoryDisplay}
          </div>
          \${stockBadge}
        </div>
        <div style="font-size: 0.85rem; font-weight: 600; color: #0f172a; line-height: 1.35;">
          \${highlightSalesMatch(p.name, q)}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.73rem; color: #64748b; margin-top: 3px;">
          <div>\${priceDisplay}</div>
          \${isAlreadyAdded ? '<span style="color: #16a34a; font-weight: 600; font-size: 0.72rem;">✓ In Invoice (Click to +1)</span>' : '<span style="color: #2563eb; font-weight: 500; font-size: 0.72rem;">+ Click to Add</span>'}
        </div>
      </div>
    \`;
  });

  const footerText = matches.length > limit
    ? \`<div style="padding: 0.4rem 0.85rem; font-size: 0.72rem; color: #64748b; background: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9;">Showing \${limit} of \${matches.length} items</div>\`
    : '';

  dropdown.innerHTML = \`
    <div style="padding: 0.4rem 0.85rem; font-size: 0.72rem; color: #64748b; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
      <span>\${headerText}</span>
      <span style="font-size: 0.68rem; color: #94a3b8;">↑↓ Navigate · Enter to add</span>
    </div>
    <div style="max-height: 230px; overflow-y: auto;">
      \${itemsHtml}
    </div>
    \${footerText}
  \`;
  dropdown.style.display = 'block';
}

function addSalesItemFromSearch(productId) {
  const p = (state.products || []).find((item) => item.id === productId);
  if (!p) return;

  const existing = nsoSelectedItems.find((it) => it.productId === p.id);
  if (existing) {
    existing.quantity = (parseInt(existing.quantity, 10) || 0) + 1;
    showToast('Increased quantity for ' + p.name, 'success');
  } else {
    const isService = p.type === 'SERVICE';
    const defaultPrice = p.sellingPriceCents > 0 ? (p.sellingPriceCents / 100) : 0;
    nsoSelectedItems.push({
      productId: p.id,
      sku: p.sku || 'SKU',
      name: p.name || 'Item',
      category: p.category || '',
      type: isService ? 'SERVICE' : 'PRODUCT',
      unitOfMeasure: p.unitOfMeasure || (isService ? 'unit' : 'pcs'),
      quantity: 1,
      unitPrice: defaultPrice,
      notes: '',
    });
    showToast('Added ' + p.name + ' to invoice', 'success');
  }

  // Automatically clear search input and reset combobox
  const input = document.getElementById('nso-search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  const clearBtn = document.getElementById('nso-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  const dropdown = document.getElementById('nso-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  renderNsoItemsTable();
}

function handleSalesItemSearchKeydown(event) {
  const dropdown = document.getElementById('nso-dropdown');
  if (!dropdown || dropdown.style.display === 'none') {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      renderSalesItemDropdown(document.getElementById('nso-search-input')?.value || '');
      event.preventDefault();
    }
    return;
  }

  const items = dropdown.querySelectorAll('.product-combobox-item');
  if (!items.length) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    salesItemActiveIndex = (salesItemActiveIndex + 1) % items.length;
    updateSalesItemActiveItem(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    salesItemActiveIndex = (salesItemActiveIndex - 1 + items.length) % items.length;
    updateSalesItemActiveItem(items);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (salesItemActiveIndex >= 0 && salesItemActiveIndex < items.length) {
      const activeEl = items[salesItemActiveIndex];
      const prodId = activeEl.getAttribute('data-product-id');
      if (prodId) addSalesItemFromSearch(prodId);
    } else if (items.length === 1) {
      const prodId = items[0].getAttribute('data-product-id');
      if (prodId) addSalesItemFromSearch(prodId);
    }
  } else if (event.key === 'Escape') {
    dropdown.style.display = 'none';
  }
}

function updateSalesItemActiveItem(items) {
  items.forEach((it, idx) => {
    if (idx === salesItemActiveIndex) {
      it.classList.add('active');
      it.style.backgroundColor = '#f1f5f9';
      if (typeof it.scrollIntoView === 'function') {
        it.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else {
      it.classList.remove('active');
      it.style.backgroundColor = it.classList.contains('selected') ? '#f0fdf4' : '';
    }
  });
}

function renderNsoItemsTable() {
  const container = document.getElementById('nso-items-container');
  const countBadge = document.getElementById('nso-items-count-badge');
  if (!container) return;

  const currencyEl = document.getElementById('nso-currency');
  const currency = currencyEl ? currencyEl.value : 'PHP';

  if (countBadge) {
    countBadge.textContent = nsoSelectedItems.length + (nsoSelectedItems.length === 1 ? ' item' : ' items');
  }

  if (nsoSelectedItems.length === 0) {
    container.innerHTML = \`
      <div style="padding: 2.2rem 1.5rem; text-align: center; color: #64748b;">
        <div style="font-size: 1.75rem; margin-bottom: 0.4rem;">🛒</div>
        <div style="font-weight: 600; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.25rem;">No items added to this invoice yet</div>
        <p style="font-size: 0.8rem; margin: 0; color: #64748b;">
          Type in the search box above to detect and add multiple products or services.
        </p>
      </div>
    \`;
    return;
  }

  let totalCents = 0;
  let rowsHtml = '';

  nsoSelectedItems.forEach((it, idx) => {
    const qty = parseInt(it.quantity, 10) || 1;
    const price = parseFloat(it.unitPrice) || 0;
    const lineSubtotalCents = Math.round(qty * price * 100);
    totalCents += lineSubtotalCents;

    const isService = it.type === 'SERVICE';
    const typeBadge = isService
      ? '<span style="background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 700;">💼 SERVICE</span>'
      : '<span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 700;">📦 PRODUCT</span>';

    rowsHtml += \`
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 0.65rem 0.85rem; vertical-align: top;">
          <div style="display: flex; align-items: center; gap: 0.45rem; margin-bottom: 2px;">
            \${typeBadge}
            <span style="font-family: monospace; font-size: 0.75rem; font-weight: 700; background: #e2e8f0; color: #0f172a; padding: 1px 5px; border-radius: 3px;">
              \${escapeHtml(it.sku)}
            </span>
            \${it.category ? '<span style="color: #64748b; font-size: 0.72rem;">(' + escapeHtml(it.category) + ')</span>' : ''}
          </div>
          <div style="font-weight: 600; font-size: 0.85rem; color: #0f172a; margin-bottom: 0.35rem;">
            \${escapeHtml(it.name)}
          </div>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span style="font-size: 0.74rem; color: #94a3b8; flex-shrink: 0;">📝</span>
            <input
              type="text"
              class="form-input"
              placeholder="Add item remarks / notes (optional)..."
              value="\${escapeHtml(it.notes || '')}"
              oninput="handleNsoItemNotesChange(\${idx}, this.value)"
              style="padding: 0.25rem 0.5rem; font-size: 0.78rem; width: 100%; border-color: #e2e8f0; background: #f8fafc; border-radius: 4px;"
            />
          </div>
        </td>
        <td style="padding: 0.65rem 0.85rem; width: 105px; vertical-align: top;">
          <input
            type="number"
            class="form-input"
            min="1"
            value="\${qty}"
            oninput="handleNsoItemQtyChange(\${idx}, this.value)"
            style="padding: 0.35rem 0.5rem; font-size: 0.85rem; text-align: center;"
          />
        </td>
        <td style="padding: 0.65rem 0.85rem; width: 130px; vertical-align: top;">
          <input
            type="number"
            class="form-input"
            step="0.01"
            min="0"
            value="\${price.toFixed(2)}"
            oninput="handleNsoItemPriceChange(\${idx}, this.value)"
            style="padding: 0.35rem 0.5rem; font-size: 0.85rem; text-align: right;"
          />
        </td>
        <td style="padding: 0.65rem 0.85rem; width: 130px; text-align: right; vertical-align: top;">
          <strong style="display: inline-block; margin-top: 0.35rem;">\${formatCurrency(lineSubtotalCents, currency)}</strong>
        </td>
        <td style="padding: 0.65rem 0.85rem; width: 45px; text-align: center; vertical-align: top;">
          <button
            type="button"
            onclick="removeNsoItem(\${idx})"
            style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px 6px; border-radius: 4px; font-size: 1rem; line-height: 1; margin-top: 0.2rem;"
            title="Remove item"
          >
            🗑️
          </button>
        </td>
      </tr>
    \`;
  });

  container.innerHTML = \`
    <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
      <table class="data-table" style="margin: 0; width: 100%;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 2px solid var(--border-color);">
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem;">Item Description & Remarks</th>
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem; text-align: center;">Qty / Units</th>
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem; text-align: right;">Unit Price / Rate</th>
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem; text-align: right;">Line Subtotal</th>
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem; text-align: center;"></th>
          </tr>
        </thead>
        <tbody>
          \${rowsHtml}
        </tbody>
      </table>
    </div>
    <div style="padding: 0.75rem 1rem; background: #f8fafc; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
      <span style="font-size: 0.82rem; color: #64748b;">
        Total: <strong>\${nsoSelectedItems.length}</strong> line item\${nsoSelectedItems.length === 1 ? '' : 's'}
      </span>
      <div style="font-size: 0.95rem;">
        Invoice Total: <strong style="font-size: 1.15rem; color: var(--primary);">\${formatCurrency(totalCents, currency)}</strong>
      </div>
    </div>
  \`;
}

function handleNsoItemNotesChange(idx, val) {
  if (nsoSelectedItems[idx]) {
    nsoSelectedItems[idx].notes = val;
  }
}

function handleNsoItemQtyChange(idx, val) {
  const q = parseInt(val, 10);
  if (nsoSelectedItems[idx]) {
    nsoSelectedItems[idx].quantity = isNaN(q) || q < 1 ? 1 : q;
    renderNsoItemsTable();
  }
}

function handleNsoItemPriceChange(idx, val) {
  const p = parseFloat(val);
  if (nsoSelectedItems[idx]) {
    nsoSelectedItems[idx].unitPrice = isNaN(p) || p < 0 ? 0 : p;
    renderNsoItemsTable();
  }
}

function removeNsoItem(idx) {
  if (nsoSelectedItems[idx]) {
    const removed = nsoSelectedItems.splice(idx, 1);
    showToast('Removed ' + (removed[0]?.name || 'item'), 'neutral');
    renderNsoItemsTable();
  }
}

async function submitNewSalesOrder(e) {
  e.preventDefault();

  if (!nsoSelectedItems.length) {
    showToast('Please search and add at least one product or service to the invoice', 'warning');
    document.getElementById('nso-search-input')?.focus();
    return;
  }

  const siNumberInput = document.getElementById('nso-sinumber');
  const siNumber = siNumberInput ? siNumberInput.value.trim() : '';

  const payload = {
    siNumber: siNumber || undefined,
    customerId: document.getElementById('nso-cust').value,
    currency: document.getElementById('nso-currency').value,
    notes: document.getElementById('nso-notes')?.value || undefined,
    items: nsoSelectedItems.map((it) => ({
      productId: it.productId,
      quantity: parseInt(it.quantity, 10) || 1,
      unitPriceCents: Math.round((parseFloat(it.unitPrice) || 0) * 100),
      notes: it.notes ? it.notes.trim() : undefined,
    })),
  };

  try {
    const res = await apiFetch('/api/sales/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create sales order');

    closeModal();
    const confirmedNumber = formatSiNumber(json.data.siNumber || json.data.soNumber);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('last_si_number', confirmedNumber);
    }
    if (json.data) {
      if (!state.salesOrders) state.salesOrders = [];
      state.salesOrders.unshift(json.data);
    }
    showToast('Sales Invoice ' + confirmedNumber + ' confirmed with ' + payload.items.length + ' item(s)', 'success');
    loadSales();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

let editSoSelectedItems = [];
let editSalesItemActiveIndex = -1;

function openEditSalesOrderModal(soId) {
  const so = (state.salesOrders || []).find((o) => o.id === soId);
  if (!so) {
    showToast('Sales Invoice not found', 'danger');
    return;
  }

  editSoSelectedItems = (so.items || []).map((i) => {
    const p = i.product || {};
    const isService = p.type === 'SERVICE';
    return {
      productId: i.productId,
      sku: p.sku || 'SKU',
      name: p.name || 'Item',
      category: p.category || '',
      type: isService ? 'SERVICE' : 'PRODUCT',
      unitOfMeasure: p.unitOfMeasure || (isService ? 'unit' : 'pcs'),
      quantity: i.quantity || 1,
      unitPrice: i.unitPriceCents > 0 ? (i.unitPriceCents / 100) : 0,
      notes: i.notes || '',
    };
  });

  const custOptions = (state.customers || [])
    .map((c) => '<option value="' + c.id + '" ' + (c.id === so.customerId ? 'selected' : '') + '>' + escapeHtml(c.name) + ' (' + c.customerCode + ')</option>')
    .join('');

  const currentSiNumber = formatSiNumber(so.siNumber || so.soNumber);

  const body = \`
    <form id="form-edit-so" onsubmit="submitEditSalesOrder(event, '\${so.id}')">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 1.15rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">SI Number *</label>
          <input type="text" id="eso-sinumber" class="form-input" value="\${escapeHtml(currentSiNumber)}" placeholder="e.g. SI-1001" required />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Customer *</label>
          <select id="eso-cust" class="form-select" required>
            \${custOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Currency *</label>
          <select id="eso-currency" class="form-select" onchange="renderEditSoItemsTable()" required>
            <option value="PHP" \${so.currency === 'PHP' ? 'selected' : ''}>PHP (₱)</option>
            <option value="USD" \${so.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Order Status</label>
          <select id="eso-status" class="form-select">
            <option value="DRAFT" \${so.status === 'DRAFT' ? 'selected' : ''}>DRAFT</option>
            <option value="CONFIRMED" \${so.status === 'CONFIRMED' ? 'selected' : ''}>CONFIRMED</option>
            <option value="FULFILLED" \${so.status === 'FULFILLED' ? 'selected' : ''}>FULFILLED</option>
            <option value="CANCELLED" \${so.status === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
          </select>
        </div>
      </div>

      <!-- Autocomplete Multi-Item Search Box for Edit -->
      <div class="form-group" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="margin-bottom: 0;">Add Products or Services</label>
          <span style="font-size: 0.74rem; color: #64748b;">Search to add more items to this invoice</span>
        </div>
        <div id="eso-combobox-container" class="product-combobox-container">
          <div style="position: relative; display: flex; align-items: center;">
            <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input
              type="text"
              id="eso-search-input"
              class="form-input"
              style="padding-left: 2.35rem; padding-right: 2.2rem;"
              placeholder="Search by SKU, product name, service, or category to add..."
              autocomplete="off"
              oninput="handleEditSalesItemSearchInput(this.value)"
              onfocus="handleEditSalesItemSearchFocus()"
              onkeydown="handleEditSalesItemSearchKeydown(event)"
            />
            <button
              type="button"
              id="eso-clear-btn"
              onclick="clearEditSalesSearchBox()"
              style="display: none; position: absolute; right: 0.65rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 4px; line-height: 1; font-size: 0.85rem;"
              title="Clear search"
            >
              ✕
            </button>
          </div>
          <div id="eso-dropdown" class="product-combobox-dropdown" style="display: none;"></div>
        </div>
      </div>

      <!-- Selected Invoice Items Table -->
      <div class="form-group" style="margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
          <span style="font-size: 0.84rem; font-weight: 600; color: var(--text-main);">
            Invoice Line Items <span id="eso-items-count-badge" class="badge badge-neutral" style="font-size: 0.7rem; margin-left: 0.35rem;">0 items</span>
          </span>
          <span style="font-size: 0.74rem; color: #64748b;">Prices, quantities, and remarks are editable</span>
        </div>
        <div id="eso-items-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; background: #ffffff;">
          <!-- Dynamically populated by renderEditSoItemsTable() -->
        </div>
      </div>
    </form>
  \`;
  const footer = \`
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="document.getElementById('form-edit-so').requestSubmit()">Save Changes</button>
  \`;
  openModal('Edit Sales Invoice ' + currentSiNumber, body, footer, 'lg');
  renderEditSoItemsTable();

  const handleOutsideClick = (e) => {
    const container = document.getElementById('eso-combobox-container');
    const dropdown = document.getElementById('eso-dropdown');
    if (container && dropdown && !container.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  };
  document.addEventListener('click', handleOutsideClick);
}

function renderEditSoItemsTable() {
  const container = document.getElementById('eso-items-container');
  const countBadge = document.getElementById('eso-items-count-badge');
  if (!container) return;

  const currencyEl = document.getElementById('eso-currency');
  const currency = currencyEl ? currencyEl.value : 'PHP';

  if (countBadge) {
    countBadge.textContent = editSoSelectedItems.length + (editSoSelectedItems.length === 1 ? ' item' : ' items');
  }

  if (editSoSelectedItems.length === 0) {
    container.innerHTML = \`
      <div style="padding: 2.2rem 1.5rem; text-align: center; color: #64748b;">
        <div style="font-size: 1.75rem; margin-bottom: 0.4rem;">🛒</div>
        <div style="font-weight: 600; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.25rem;">No items in this invoice</div>
        <p style="font-size: 0.8rem; margin: 0; color: #64748b;">
          Use the search box above to add products or services.
        </p>
      </div>
    \`;
    return;
  }

  let totalCents = 0;
  let rowsHtml = '';

  editSoSelectedItems.forEach((it, idx) => {
    const qty = parseInt(it.quantity, 10) || 1;
    const price = parseFloat(it.unitPrice) || 0;
    const lineSubtotalCents = Math.round(qty * price * 100);
    totalCents += lineSubtotalCents;

    const isService = it.type === 'SERVICE';
    const typeBadge = isService
      ? '<span style="background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 700;">💼 SERVICE</span>'
      : '<span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 700;">📦 PRODUCT</span>';

    rowsHtml += \`
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 0.65rem 0.85rem; vertical-align: top;">
          <div style="display: flex; align-items: center; gap: 0.45rem; margin-bottom: 2px;">
            \${typeBadge}
            <span style="font-family: monospace; font-size: 0.75rem; font-weight: 700; background: #e2e8f0; color: #0f172a; padding: 1px 5px; border-radius: 3px;">
              \${escapeHtml(it.sku)}
            </span>
            \${it.category ? '<span style="color: #64748b; font-size: 0.72rem;">(' + escapeHtml(it.category) + ')</span>' : ''}
          </div>
          <div style="font-weight: 600; font-size: 0.85rem; color: #0f172a; margin-bottom: 0.35rem;">
            \${escapeHtml(it.name)}
          </div>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span style="font-size: 0.74rem; color: #94a3b8; flex-shrink: 0;">📝</span>
            <input
              type="text"
              class="form-input"
              placeholder="Add item remarks / notes (optional)..."
              value="\${escapeHtml(it.notes || '')}"
              oninput="handleEditSoItemNotesChange(\${idx}, this.value)"
              style="padding: 0.25rem 0.5rem; font-size: 0.78rem; width: 100%; border-color: #e2e8f0; background: #f8fafc; border-radius: 4px;"
            />
          </div>
        </td>
        <td style="padding: 0.65rem 0.85rem; width: 105px; vertical-align: top;">
          <input
            type="number"
            class="form-input"
            min="1"
            value="\${qty}"
            oninput="handleEditSoItemQtyChange(\${idx}, this.value)"
            style="padding: 0.35rem 0.5rem; font-size: 0.85rem; text-align: center;"
          />
        </td>
        <td style="padding: 0.65rem 0.85rem; width: 130px; vertical-align: top;">
          <input
            type="number"
            class="form-input"
            step="0.01"
            min="0"
            value="\${price.toFixed(2)}"
            oninput="handleEditSoItemPriceChange(\${idx}, this.value)"
            style="padding: 0.35rem 0.5rem; font-size: 0.85rem; text-align: right;"
          />
        </td>
        <td style="padding: 0.65rem 0.85rem; width: 130px; text-align: right; vertical-align: top;">
          <strong style="display: inline-block; margin-top: 0.35rem;">\${formatCurrency(lineSubtotalCents, currency)}</strong>
        </td>
        <td style="padding: 0.65rem 0.85rem; width: 45px; text-align: center; vertical-align: top;">
          <button
            type="button"
            onclick="removeEditSoItem(\${idx})"
            style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px 6px; border-radius: 4px; font-size: 1rem; line-height: 1; margin-top: 0.2rem;"
            title="Remove item"
          >
            🗑️
          </button>
        </td>
      </tr>
    \`;
  });

  container.innerHTML = \`
    <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
      <table class="data-table" style="margin: 0; width: 100%;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 2px solid var(--border-color);">
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem;">Item Description & Remarks</th>
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem; text-align: center;">Qty / Units</th>
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem; text-align: right;">Unit Price / Rate</th>
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem; text-align: right;">Line Subtotal</th>
            <th style="padding: 0.65rem 0.85rem; font-size: 0.75rem; text-align: center;"></th>
          </tr>
        </thead>
        <tbody>
          \${rowsHtml}
        </tbody>
      </table>
    </div>
    <div style="padding: 0.75rem 1rem; background: #f8fafc; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: gap: 0.5rem;">
      <span style="font-size: 0.82rem; color: #64748b;">
        Total: <strong>\${editSoSelectedItems.length}</strong> line item\${editSoSelectedItems.length === 1 ? '' : 's'}
      </span>
      <div style="font-size: 0.95rem;">
        Invoice Total: <strong style="font-size: 1.15rem; color: var(--primary);">\${formatCurrency(totalCents, currency)}</strong>
      </div>
    </div>
  \`;
}

function handleEditSoItemNotesChange(idx, val) {
  if (editSoSelectedItems[idx]) {
    editSoSelectedItems[idx].notes = val;
  }
}

function handleEditSoItemQtyChange(idx, val) {
  const q = parseInt(val, 10);
  if (editSoSelectedItems[idx]) {
    editSoSelectedItems[idx].quantity = isNaN(q) || q < 1 ? 1 : q;
    renderEditSoItemsTable();
  }
}

function handleEditSoItemPriceChange(idx, val) {
  const p = parseFloat(val);
  if (editSoSelectedItems[idx]) {
    editSoSelectedItems[idx].unitPrice = isNaN(p) || p < 0 ? 0 : p;
    renderEditSoItemsTable();
  }
}

function removeEditSoItem(idx) {
  if (editSoSelectedItems[idx]) {
    const removed = editSoSelectedItems.splice(idx, 1);
    showToast('Removed ' + (removed[0]?.name || 'item'), 'neutral');
    renderEditSoItemsTable();
  }
}

function handleEditSalesItemSearchInput(q) {
  const clearBtn = document.getElementById('eso-clear-btn');
  if (clearBtn) clearBtn.style.display = q && q.trim() ? 'block' : 'none';
  renderEditSalesItemDropdown(q);
}

function handleEditSalesItemSearchFocus() {
  const input = document.getElementById('eso-search-input');
  renderEditSalesItemDropdown(input ? input.value : '');
}

function clearEditSalesSearchBox() {
  const input = document.getElementById('eso-search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  const clearBtn = document.getElementById('eso-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderEditSalesItemDropdown('');
}

function renderEditSalesItemDropdown(rawQ) {
  const dropdown = document.getElementById('eso-dropdown');
  if (!dropdown) return;

  const q = (rawQ || '').trim().toLowerCase();
  const allProducts = state.products || [];

  let matches = allProducts;
  if (q) {
    matches = allProducts.filter((p) => {
      const sku = (p.sku || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      return sku.includes(q) || name.includes(q) || cat.includes(q) || (type === 'service' && q.includes('serv'));
    });
  }

  editSalesItemActiveIndex = -1;

  if (matches.length === 0) {
    dropdown.innerHTML = \`
      <div style="padding: 1.25rem 1rem; text-align: center; color: #64748b; font-size: 0.82rem;">
        No products or services found matching "<strong style="color: #0f172a;">\${escapeHtml(q)}</strong>"
      </div>
    \`;
    dropdown.style.display = 'block';
    return;
  }

  let headerText = q
    ? \`\${matches.length} matching item\${matches.length === 1 ? '' : 's'}\`
    : \`All products & services (\${matches.length})\`;

  const limit = 40;
  const visible = matches.slice(0, limit);

  let itemsHtml = '';
  visible.forEach((p, idx) => {
    const isService = p.type === 'SERVICE';
    const isAlreadyAdded = editSoSelectedItems.some((it) => it.productId === p.id);

    const typeBadge = isService
      ? '<span style="background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.02em;">💼 SERVICE</span>'
      : '<span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.02em;">📦 PRODUCT</span>';

    const stockBadge = isService
      ? '<span style="color: #0284c7; font-size: 0.72rem; font-weight: 600;">Non-Stock</span>'
      : ((p.onHandStock || 0) > 0
          ? \`<span class="badge badge-success" style="font-size: 0.7rem; padding: 1px 6px;">\${p.onHandStock} in stock</span>\`
          : \`<span class="badge badge-secondary" style="font-size: 0.7rem; padding: 1px 6px; opacity: 0.85;">0 in stock</span>\`);

    const priceDisplay = p.sellingPriceCents > 0
      ? \`Rate/Price: <strong style="color: #0f172a;">\${formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency)}</strong>\`
      : '<span style="color: #94a3b8;">Rate: not set</span>';

    const categoryDisplay = p.category
      ? \`<span style="background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 500;">\${escapeHtml(p.category)}</span>\`
      : '';

    itemsHtml += \`
      <div class="product-combobox-item \${isAlreadyAdded ? 'selected' : ''}"
           data-index="\${idx}"
           data-product-id="\${p.id}"
           onclick="addEditSalesItemFromSearch('\${p.id}')"
           style="padding: 0.65rem 0.85rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.12s ease; \${isAlreadyAdded ? 'background: #f0fdf4;' : ''}">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 3px;">
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            \${typeBadge}
            <span style="font-family: monospace; font-size: 0.78rem; font-weight: 700; background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.02em;">
              \${highlightSalesMatch(p.sku, q)}
            </span>
            \${categoryDisplay}
          </div>
          \${stockBadge}
        </div>
        <div style="font-size: 0.85rem; font-weight: 600; color: #0f172a; line-height: 1.35;">
          \${highlightSalesMatch(p.name, q)}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.73rem; color: #64748b; margin-top: 3px;">
          <div>\${priceDisplay}</div>
          \${isAlreadyAdded ? '<span style="color: #16a34a; font-weight: 600; font-size: 0.72rem;">✓ In Invoice (Click to +1)</span>' : '<span style="color: #2563eb; font-weight: 500; font-size: 0.72rem;">+ Click to Add</span>'}
        </div>
      </div>
    \`;
  });

  const footerText = matches.length > limit
    ? \`<div style="padding: 0.4rem 0.85rem; font-size: 0.72rem; color: #64748b; background: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9;">Showing \${limit} of \${matches.length} items</div>\`
    : '';

  dropdown.innerHTML = \`
    <div style="padding: 0.4rem 0.85rem; font-size: 0.72rem; color: #64748b; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
      <span>\${headerText}</span>
      <span style="font-size: 0.68rem; color: #94a3b8;">↑↓ Navigate · Enter to add</span>
    </div>
    <div style="max-height: 230px; overflow-y: auto;">
      \${itemsHtml}
    </div>
    \${footerText}
  \`;
  dropdown.style.display = 'block';
}

function addEditSalesItemFromSearch(productId) {
  const p = (state.products || []).find((item) => item.id === productId);
  if (!p) return;

  const existing = editSoSelectedItems.find((it) => it.productId === p.id);
  if (existing) {
    existing.quantity = (parseInt(existing.quantity, 10) || 0) + 1;
    showToast('Increased quantity for ' + p.name, 'success');
  } else {
    const isService = p.type === 'SERVICE';
    const defaultPrice = p.sellingPriceCents > 0 ? (p.sellingPriceCents / 100) : 0;
    editSoSelectedItems.push({
      productId: p.id,
      sku: p.sku || 'SKU',
      name: p.name || 'Item',
      category: p.category || '',
      type: isService ? 'SERVICE' : 'PRODUCT',
      unitOfMeasure: p.unitOfMeasure || (isService ? 'unit' : 'pcs'),
      quantity: 1,
      unitPrice: defaultPrice,
      notes: '',
    });
    showToast('Added ' + p.name + ' to invoice', 'success');
  }

  const input = document.getElementById('eso-search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  const clearBtn = document.getElementById('eso-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  const dropdown = document.getElementById('eso-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  renderEditSoItemsTable();
}

function handleEditSalesItemSearchKeydown(event) {
  const dropdown = document.getElementById('eso-dropdown');
  if (!dropdown || dropdown.style.display === 'none') {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      renderEditSalesItemDropdown(document.getElementById('eso-search-input')?.value || '');
      event.preventDefault();
    }
    return;
  }

  const items = dropdown.querySelectorAll('.product-combobox-item');
  if (!items.length) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    editSalesItemActiveIndex = (editSalesItemActiveIndex + 1) % items.length;
    updateEditSalesItemActiveItem(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    editSalesItemActiveIndex = (editSalesItemActiveIndex - 1 + items.length) % items.length;
    updateEditSalesItemActiveItem(items);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (editSalesItemActiveIndex >= 0 && editSalesItemActiveIndex < items.length) {
      const activeEl = items[editSalesItemActiveIndex];
      const prodId = activeEl.getAttribute('data-product-id');
      if (prodId) addEditSalesItemFromSearch(prodId);
    } else if (items.length === 1) {
      const prodId = items[0].getAttribute('data-product-id');
      if (prodId) addEditSalesItemFromSearch(prodId);
    }
  } else if (event.key === 'Escape') {
    dropdown.style.display = 'none';
  }
}

function updateEditSalesItemActiveItem(items) {
  items.forEach((it, idx) => {
    if (idx === editSalesItemActiveIndex) {
      it.classList.add('active');
      it.style.backgroundColor = '#f1f5f9';
      if (typeof it.scrollIntoView === 'function') {
        it.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else {
      it.classList.remove('active');
      it.style.backgroundColor = it.classList.contains('selected') ? '#f0fdf4' : '';
    }
  });
}

async function submitEditSalesOrder(e, soId) {
  e.preventDefault();

  if (!editSoSelectedItems.length) {
    showToast('Please add at least one product or service to the invoice', 'warning');
    document.getElementById('eso-search-input')?.focus();
    return;
  }

  const siNumberInput = document.getElementById('eso-sinumber');
  const siNumber = siNumberInput ? siNumberInput.value.trim() : '';

  const payload = {
    siNumber: siNumber || undefined,
    customerId: document.getElementById('eso-cust').value,
    currency: document.getElementById('eso-currency').value,
    status: document.getElementById('eso-status')?.value || undefined,
    items: editSoSelectedItems.map((it) => ({
      productId: it.productId,
      quantity: parseInt(it.quantity, 10) || 1,
      unitPriceCents: Math.round((parseFloat(it.unitPrice) || 0) * 100),
      notes: it.notes ? it.notes.trim() : undefined,
    })),
  };

  try {
    const res = await apiFetch('/api/sales/orders/' + encodeURIComponent(soId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update sales order');

    closeModal();
    const confirmedNumber = formatSiNumber(json.data.siNumber || json.data.soNumber);
    showToast('Sales Invoice ' + confirmedNumber + ' updated successfully', 'success');
    loadSales();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function deleteSalesOrder(soId) {
  const so = (state.salesOrders || []).find((o) => o.id === soId);
  if (!so) return;

  const confirmedNumber = formatSiNumber(so.siNumber || so.soNumber);
  const custName = so.customer?.name || 'Customer';

  openConfirmModal({
    title: 'Delete Sales Invoice',
    message: 'Are you sure you want to permanently delete Sales Invoice ' + confirmedNumber + ' for ' + custName + '?',
    subtext: 'This will remove the sales invoice, its line items, and associated accounting entries. This action cannot be undone.',
    confirmText: 'Delete Invoice',
    type: 'danger',
    onConfirm: async () => {
      try {
        const res = await apiFetch('/api/sales/orders/' + encodeURIComponent(soId), {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete sales order');
        showToast('Sales Invoice ' + confirmedNumber + ' deleted successfully', 'success');
        loadSales();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    },
  });
}

window.openEditSalesOrderModal = openEditSalesOrderModal;
window.deleteSalesOrder = deleteSalesOrder;
`;
