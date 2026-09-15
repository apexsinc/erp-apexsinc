export function renderPurchasingView(): string {
  return `<div id="view-purchasing" class="tab-view" style="display: none;"></div>`;
}

export const PURCHASING_CLIENT_JS = `
let npoLineItems = [];
let npoSelectedProductId = null;
let purchasingSearchQuery = '';

async function loadPurchasing() {
  const container = document.getElementById('view-purchasing');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading purchasing data...</div>');

  try {
    purchasingSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';

    const [ordersRes, vendorsRes, productsRes] = await Promise.all([
      apiFetch('/api/purchasing/orders'),
      apiFetch('/api/purchasing/vendors'),
      apiFetch('/api/inventory/products'),
    ]);
    const ordersJson = await ordersRes.json();
    const vendorsJson = await vendorsRes.json();
    const productsJson = await productsRes.json();

    state.purchaseOrders = ordersJson.data || [];
    state.vendors = vendorsJson.data || [];
    state.products = productsJson.data || [];

    renderPurchasingContent(container);
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading purchasing: \${err.message}</div>\`;
  }
}

function handlePurchasingSearch(query) {
  purchasingSearchQuery = query.toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', purchasingSearchQuery || null);
  }
  const container = document.getElementById('view-purchasing');
  if (container) {
    renderPurchasingContent(container);
  }
}

function exportPurchasingCsv() {
  const headers = ['PO Number', 'Vendor', 'Status', 'Currency', 'Total Amount', 'Ordered Items'];
  const rows = (state.purchaseOrders || []).map((po) => [
    po.poNumber,
    po.vendor?.name || 'Unknown',
    po.status,
    po.currency || 'PHP',
    (po.totalAmountCents / 100).toFixed(2),
    (po.items || []).map((i) => \`\${i.product?.name || 'Product'} (\${i.quantityOrdered} ordered, \${i.quantityReceived} received)\`).join('; '),
  ]);
  exportToCsv('purchase_orders_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function openPurchaseOrderPrintTab(poId) {
  window.open('/purchasing/orders/' + encodeURIComponent(poId) + '/print', '_blank');
}

function renderPurchasingContent(container) {
  const poStatusBadgeClass = {
    DRAFT: 'badge-neutral',
    APPROVED: 'badge-primary',
    DELIVERED: 'badge-warning',
    PARTIALLY_RECEIVED: 'badge-warning',
    RECEIVED: 'badge-success',
    CANCELLED: 'badge-danger',
  };

  let filteredOrders = state.purchaseOrders || [];
  if (purchasingSearchQuery) {
    filteredOrders = filteredOrders.filter((po) => {
      const num = (po.poNumber || '').toLowerCase();
      const vend = (po.vendor?.name || '').toLowerCase();
      const status = (po.status || '').toLowerCase();
      return num.includes(purchasingSearchQuery) || vend.includes(purchasingSearchQuery) || status.includes(purchasingSearchQuery);
    });
  }

  let rowsHtml = '';
  filteredOrders.forEach((po) => {
    const itemsList = (po.items || []).map((i) => \`\${i.product?.name || 'Product'} (\${i.quantityOrdered} ordered, \${i.quantityReceived} received)\`).join(', ');
    rowsHtml += \`
      <tr class="row-clickable" onclick="openPurchaseOrderPrintTab('\${po.id}')" title="Click to view official Purchase Order PDF in a new tab">
        <td style="white-space: nowrap;">
          <a href="/purchasing/orders/\${po.id}/print" target="_blank" onclick="event.stopPropagation();" style="color: #0f172a; font-weight: 700; text-decoration: none !important; font-family: 'JetBrains Mono', 'Segoe UI Mono', monospace; font-size: 0.88rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;" title="Open official Purchase Order in new tab">
            <span>\${po.poNumber}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </td>
        <td style="white-space: nowrap;">\${po.vendor?.name || 'Unknown'}</td>
        <td style="white-space: nowrap;">
          <span class="badge \${poStatusBadgeClass[po.status] || 'badge-neutral'}">
            <span class="badge-dot"></span>
            \${po.status.replace('_', ' ')}
          </span>
        </td>
        <td style="white-space: nowrap;"><strong>\${formatCurrency(po.totalAmountCents, po.currency)}</strong></td>
        <td style="font-size: 0.8rem; color: #64748b;">\${itemsList}</td>
        <td style="text-align: right; white-space: nowrap; padding-right: 1.25rem;" onclick="event.stopPropagation();">
          <div style="display: inline-flex; align-items: center; gap: 0.35rem; justify-content: flex-end;">
            <button
              class="btn-action-icon"
              onclick="openPurchaseOrderPrintTab('\${po.id}')"
              title="View Purchase Order PDF"
              aria-label="View PDF"
              style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #dc2626; box-shadow: 0 1px 2px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.15s ease;"
              onmouseover="this.style.background='#fef2f2'; this.style.borderColor='#fca5a5'; this.style.transform='translateY(-1px)'"
              onmouseout="this.style.background='#ffffff'; this.style.borderColor='#cbd5e1'; this.style.transform='none'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </button>
            <button
              class="btn-action-icon"
              onclick="openEditPOModal('\${po.id}')"
              title="Edit Purchase Order"
              aria-label="Edit"
              style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #2563eb; box-shadow: 0 1px 2px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.15s ease;"
              onmouseover="this.style.background='#eff6ff'; this.style.borderColor='#93c5fd'; this.style.transform='translateY(-1px)'"
              onmouseout="this.style.background='#ffffff'; this.style.borderColor='#cbd5e1'; this.style.transform='none'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button
              class="btn-action-icon"
              onclick="deletePurchaseOrder('\${po.id}')"
              title="Delete Purchase Order"
              aria-label="Delete"
              style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #fecaca; background: #ffffff; color: #dc2626; box-shadow: 0 1px 2px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.15s ease;"
              onmouseover="this.style.background='#fee2e2'; this.style.borderColor='#ef4444'; this.style.color='#b91c1c'; this.style.transform='translateY(-1px)'"
              onmouseout="this.style.background='#ffffff'; this.style.borderColor='#fecaca'; this.style.color='#dc2626'; this.style.transform='none'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
            <button
              class="btn-action-icon"
              onclick="goToInboundForPO('\${po.id}')"
              title="Track in Inbound Deliveries"
              aria-label="Inbound"
              style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; box-shadow: 0 1px 2px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.15s ease;"
              onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#94a3b8'; this.style.color='#0f172a'; this.style.transform='translateY(-1px)'"
              onmouseout="this.style.background='#ffffff'; this.style.borderColor='#cbd5e1'; this.style.color='#475569'; this.style.transform='none'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            </button>
          </div>
        </td>
      </tr>
    \`;
  });

  container.innerHTML = \`
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Purchase Orders & Procurement</div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="exportPurchasingCsv()">📥 Export CSV</button>
          \${can('purchasing', 'create') ? '<button class="btn btn-primary btn-sm" onclick="openNewPOModal()">Create Purchase Order</button>' : ''}
        </div>
      </div>
      <div style="padding: 0 1.35rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <p style="font-size: 0.85rem; color: #64748b; margin: 0; flex: 1 1 260px;">
          Manage suppliers and purchase orders. Click any order or action icon to view PDF, edit, delete, or track inbound shipments.
        </p>
        <div style="max-width: 280px; width: 100%;">
          <input type="text" class="form-input" style="width: 100%; padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search PO #, vendor, status..." value="\${purchasingSearchQuery}" oninput="handlePurchasingSearch(this.value)" />
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="white-space: nowrap; width: 140px;">PO Number</th>
              <th style="white-space: nowrap; width: 150px;">Vendor</th>
              <th style="white-space: nowrap; width: 120px;">Status</th>
              <th style="white-space: nowrap; width: 120px;">Total Value</th>
              <th style="min-width: 280px;">Ordered Items</th>
              <th style="text-align: right; white-space: nowrap; width: 170px; padding-right: 1.25rem;">Actions</th>
            </tr>
          </thead>
          <tbody>
            \${rowsHtml || '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">No purchase orders found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  \`;
}

function openNewPOModal() {
  if (!state.vendors.length) {
    showToast('Please add at least one vendor first', 'warning');
    return;
  }
  if (!state.products.length) {
    showToast('Please add products to your catalog first', 'warning');
    return;
  }

  npoLineItems = [];
  npoSelectedProductId = null;

  let vendorOptions = state.vendors.map((v) => \`<option value="\${v.id}">\${v.name} (\${v.vendorCode})</option>\`).join('');
  let productDatalist = state.products.map((p) => \`<option value="\${escapeNpoAttr(p.sku + ' - ' + p.name)}"></option>\`).join('');

  const body = \`
    <form id="form-new-po" onsubmit="submitNewPO(event)">
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Vendor *</label>
          <select id="npo-vendor" class="form-select">\${vendorOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">PO Number</label>
          <input type="text" id="npo-ponumber" class="form-input" placeholder="Auto-generated if blank" />
        </div>
        <div class="form-group">
          <label class="form-label">Currency *</label>
          <select id="npo-currency" class="form-select" onchange="renderNpoItemsTable()">
            <option value="USD" selected>USD ($)</option>
            <option value="PHP">PHP (₱)</option>
          </select>
        </div>
      </div>
      <p style="margin: -0.6rem 0 1rem; font-size: 0.76rem; color: #94a3b8;">Type your own PO number to keep matching your old numbering system - once you stop, new orders will keep counting up from the last one you entered. All line items are priced in the currency selected here.</p>

      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; margin-bottom: 1.1rem; background: #f8fafc;">
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">Add a Product</label>
          <input
            type="text"
            id="npo-product-search"
            class="form-input"
            placeholder="Type a SKU or product name to search..."
            list="npo-product-datalist"
            autocomplete="off"
            oninput="onNpoProductSearchInput()"
            onkeydown="handleNpoStagingKeydown(event)"
          />
          <datalist id="npo-product-datalist">\${productDatalist}</datalist>
          <div id="npo-product-info" style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.35rem; min-height: 1.1em;">Search by SKU or name, then set quantity and cost below.</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Qty *</label>
            <input type="number" id="npo-qty" class="form-input" placeholder="e.g. 50" min="1" onkeydown="handleNpoStagingKeydown(event)" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">UOM *</label>
            <input type="text" id="npo-uom" class="form-input" placeholder="e.g. pcs" onkeydown="handleNpoStagingKeydown(event)" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Unit Cost *</label>
            <input type="number" id="npo-unitcost" class="form-input" placeholder="e.g. 45.00" step="0.01" min="0" onkeydown="handleNpoStagingKeydown(event)" />
          </div>
        </div>
        <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 0.65rem;">
          <button type="button" class="btn btn-primary btn-sm" onclick="addNpoLineItem()">+ Add Product to Order</button>
          <span style="font-size: 0.76rem; color: #94a3b8;">Tip: press Enter in any field above to add it</span>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 0.25rem;">
        <label class="form-label">Order Items <span id="npo-items-count" style="font-weight: 400; color: #94a3b8;"></span></label>
        <div id="npo-items-table"></div>
        <p style="margin: 0.6rem 0 0; font-size: 0.76rem; color: #94a3b8;">These values update each product's current cost, currency, and unit of measure in the Business Directory.</p>
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-po').requestSubmit()">Issue Purchase Order</button>
  \`;
  openModal('Create Purchase Order', body, footer, 'lg');
  renderNpoItemsTable();
  setTimeout(() => {
    const el = document.getElementById('npo-product-search');
    if (el) el.focus();
  }, 50);
}

function escapeNpoAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Matches the search box text against the catalog and shows the product's
// last known stock/cost as hints (placeholders + info text only - never
// writes into the qty/UOM/cost inputs) so every line is a value the buyer
// deliberately typed, not a stale default carried over from another order.
function onNpoProductSearchInput() {
  const val = document.getElementById('npo-product-search').value;
  const infoEl = document.getElementById('npo-product-info');
  const uomEl = document.getElementById('npo-uom');
  const costEl = document.getElementById('npo-unitcost');
  const product = state.products.find((p) => (p.sku + ' - ' + p.name) === val);

  if (product) {
    npoSelectedProductId = product.id;
    uomEl.placeholder = 'e.g. ' + (product.unitOfMeasure || 'pcs');
    costEl.placeholder = product.costPriceCents ? 'e.g. ' + (product.costPriceCents / 100).toFixed(2) : 'e.g. 45.00';
    const stockNote = 'In stock: ' + (product.onHandStock ?? 0) + ' ' + (product.unitOfMeasure || '');
    const costNote = product.costPriceCents ? ' · Last cost: ' + product.costPriceCurrency + ' ' + (product.costPriceCents / 100).toFixed(2) : '';
    infoEl.textContent = stockNote + costNote;
    infoEl.style.color = '#64748b';
  } else {
    npoSelectedProductId = null;
    uomEl.placeholder = 'e.g. pcs';
    costEl.placeholder = 'e.g. 45.00';
    infoEl.textContent = val ? 'No matching product in catalog' : 'Search by SKU or name, then set quantity and cost below.';
    infoEl.style.color = val ? '#dc2626' : '#94a3b8';
  }
}

// Lets Enter in any staging field add the line item instead of submitting
// the whole order form (the default behavior for Enter inside a <form>).
function handleNpoStagingKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addNpoLineItem();
  }
}

function renderNpoItemsTable() {
  const container = document.getElementById('npo-items-table');
  const countEl = document.getElementById('npo-items-count');
  if (countEl) countEl.textContent = npoLineItems.length ? '(' + npoLineItems.length + ' product' + (npoLineItems.length === 1 ? '' : 's') + ')' : '';
  if (!container) return;

  if (!npoLineItems.length) {
    container.innerHTML = '<p style="font-size: 0.82rem; color: #94a3b8; margin: 0;">No products added yet. Search for a product above and click "Add Product to Order".</p>';
    return;
  }

  const currency = document.getElementById('npo-currency').value;
  let orderTotalCents = 0;

  let rowsHtml = npoLineItems.map((item, idx) => {
    const subtotalCents = item.quantityOrdered * item.unitPriceCents;
    orderTotalCents += subtotalCents;
    return \`
      <tr>
        <td>\${item.sku} - \${item.name}</td>
        <td>\${item.quantityOrdered} \${item.unitOfMeasure}</td>
        <td>\${formatCurrency(item.unitPriceCents, currency)}</td>
        <td>\${formatCurrency(subtotalCents, currency)}</td>
        <td><button type="button" class="btn btn-secondary btn-sm" onclick="removeNpoLineItem(\${idx})">Remove</button></td>
      </tr>
    \`;
  }).join('');

  container.innerHTML = \`
    <table class="data-table">
      <thead>
        <tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th><th></th></tr>
      </thead>
      <tbody>\${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align: right; font-weight: 600;">Order Total</td>
          <td colspan="2" style="font-weight: 600;">\${formatCurrency(orderTotalCents, currency)}</td>
        </tr>
      </tfoot>
    </table>
  \`;
}

function addNpoLineItem() {
  const product = state.products.find((p) => p.id === npoSelectedProductId);
  const quantityOrdered = parseInt(document.getElementById('npo-qty').value, 10);
  const unitOfMeasure = document.getElementById('npo-uom').value.trim();
  // Entered as a normal currency amount (e.g. 45.00), not cents - convert
  // once here so every downstream calculation works in integer cents.
  const unitCostEntered = parseFloat(document.getElementById('npo-unitcost').value);
  const unitPriceCents = Math.round(unitCostEntered * 100);

  if (!product) {
    showToast('Search for and select a product first', 'warning');
    document.getElementById('npo-product-search').focus();
    return;
  }
  if (!quantityOrdered || quantityOrdered < 1) {
    showToast('Enter a valid quantity', 'warning');
    document.getElementById('npo-qty').focus();
    return;
  }
  if (!unitOfMeasure) {
    showToast('Enter a unit of measure', 'warning');
    document.getElementById('npo-uom').focus();
    return;
  }
  if (isNaN(unitCostEntered) || unitCostEntered < 0) {
    showToast('Enter a valid unit cost', 'warning');
    document.getElementById('npo-unitcost').focus();
    return;
  }

  const existingIdx = npoLineItems.findIndex((i) => i.productId === product.id);
  const newItem = { productId: product.id, sku: product.sku, name: product.name, quantityOrdered, unitOfMeasure, unitPriceCents };
  if (existingIdx >= 0) {
    npoLineItems[existingIdx] = newItem;
    showToast('Updated ' + product.name + ' in this order', 'success');
  } else {
    npoLineItems.push(newItem);
    showToast(product.name + ' added', 'success');
  }
  renderNpoItemsTable();

  // Reset the staging fields to blank (placeholders only) for the next
  // product, so repeated Enter presses never silently reuse a stale value.
  npoSelectedProductId = null;
  const searchEl = document.getElementById('npo-product-search');
  searchEl.value = '';
  document.getElementById('npo-qty').value = '';
  document.getElementById('npo-uom').value = '';
  document.getElementById('npo-uom').placeholder = 'e.g. pcs';
  document.getElementById('npo-unitcost').value = '';
  document.getElementById('npo-unitcost').placeholder = 'e.g. 45.00';
  document.getElementById('npo-product-info').textContent = 'Search by SKU or name, then set quantity and cost below.';
  document.getElementById('npo-product-info').style.color = '#94a3b8';
  searchEl.focus();
}

function removeNpoLineItem(idx) {
  npoLineItems.splice(idx, 1);
  renderNpoItemsTable();
}

async function submitNewPO(e) {
  e.preventDefault();

  if (!npoLineItems.length) {
    showToast('Add at least one product to the order', 'warning');
    return;
  }

  const payload = {
    vendorId: document.getElementById('npo-vendor').value,
    poNumber: document.getElementById('npo-ponumber').value.trim() || undefined,
    currency: document.getElementById('npo-currency').value,
    items: npoLineItems.map((item) => ({
      productId: item.productId,
      quantityOrdered: item.quantityOrdered,
      unitOfMeasure: item.unitOfMeasure,
      unitPriceCents: item.unitPriceCents,
    })),
  };

  try {
    const res = await apiFetch('/api/purchasing/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create PO');

    closeModal();
    showToast('Purchase Order ' + json.data.poNumber + ' issued', 'success');
    loadPurchasing();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openEditPOModal(poId) {
  const po = state.purchaseOrders.find((p) => p.id === poId);
  if (!po) {
    showToast('Purchase Order not found', 'danger');
    return;
  }

  npoLineItems = (po.items || []).map((item) => ({
    productId: item.productId,
    sku: item.product?.sku || '',
    name: item.product?.name || '',
    quantityOrdered: item.quantityOrdered,
    unitOfMeasure: item.product?.unitOfMeasure || item.unitOfMeasure || 'pcs',
    unitPriceCents: item.unitPriceCents,
  }));
  npoSelectedProductId = null;

  let vendorOptions = state.vendors
    .map((v) => \`<option value="\${v.id}" \${v.id === po.vendorId ? 'selected' : ''}>\${v.name} (\${v.vendorCode})</option>\`)
    .join('');
  let productDatalist = state.products.map((p) => \`<option value="\${escapeNpoAttr(p.sku + ' - ' + p.name)}"></option>\`).join('');

  const body = \`
    <form id="form-edit-po" onsubmit="submitEditPO(event, '\${po.id}')">
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Vendor *</label>
          <select id="npo-vendor" class="form-select">\${vendorOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">PO Number *</label>
          <input type="text" id="npo-ponumber" class="form-input" value="\${escapeHtml(po.poNumber)}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Currency *</label>
          <select id="npo-currency" class="form-select" onchange="renderNpoItemsTable()">
            <option value="USD" \${po.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
            <option value="PHP" \${po.currency === 'PHP' ? 'selected' : ''}>PHP (₱)</option>
          </select>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: -0.25rem; margin-bottom: 0.85rem;">
        <div class="form-group">
          <label class="form-label">Order Status</label>
          <select id="npo-status" class="form-select">
            <option value="DRAFT" \${po.status === 'DRAFT' ? 'selected' : ''}>DRAFT</option>
            <option value="APPROVED" \${po.status === 'APPROVED' ? 'selected' : ''}>APPROVED</option>
            <option value="DELIVERED" \${po.status === 'DELIVERED' ? 'selected' : ''}>DELIVERED</option>
            <option value="PARTIALLY_RECEIVED" \${po.status === 'PARTIALLY_RECEIVED' ? 'selected' : ''}>PARTIALLY RECEIVED</option>
            <option value="RECEIVED" \${po.status === 'RECEIVED' ? 'selected' : ''}>RECEIVED</option>
            <option value="CANCELLED" \${po.status === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Shipping / Notes</label>
          <input type="text" id="npo-notes" class="form-input" value="\${escapeHtml(po.notes || '')}" placeholder="e.g. Terms, tracking, or notes" />
        </div>
      </div>

      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; margin-bottom: 1.1rem; background: #f8fafc;">
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">Add a Product</label>
          <input
            type="text"
            id="npo-product-search"
            class="form-input"
            placeholder="Type a SKU or product name to search..."
            list="npo-product-datalist"
            autocomplete="off"
            oninput="onNpoProductSearchInput()"
            onkeydown="handleNpoStagingKeydown(event)"
          />
          <datalist id="npo-product-datalist">\${productDatalist}</datalist>
          <div id="npo-product-info" style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.35rem; min-height: 1.1em;">Search by SKU or name, then set quantity and cost below.</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Qty *</label>
            <input type="number" id="npo-qty" class="form-input" placeholder="e.g. 50" min="1" onkeydown="handleNpoStagingKeydown(event)" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">UOM *</label>
            <input type="text" id="npo-uom" class="form-input" placeholder="e.g. pcs" onkeydown="handleNpoStagingKeydown(event)" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Unit Cost *</label>
            <input type="number" id="npo-unitcost" class="form-input" placeholder="e.g. 45.00" step="0.01" min="0" onkeydown="handleNpoStagingKeydown(event)" />
          </div>
        </div>
        <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 0.65rem;">
          <button type="button" class="btn btn-primary btn-sm" onclick="addNpoLineItem()">+ Add Product to Order</button>
          <span style="font-size: 0.76rem; color: #94a3b8;">Tip: press Enter in any field above to add it</span>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 0.25rem;">
        <label class="form-label">Order Items <span id="npo-items-count" style="font-weight: 400; color: #94a3b8;"></span></label>
        <div id="npo-items-table"></div>
      </div>
    </form>
  \`;

  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-edit-po').requestSubmit()">Save Changes</button>
  \`;

  openModal('Edit Purchase Order ' + po.poNumber, body, footer, 'lg');
  renderNpoItemsTable();
}

async function submitEditPO(e, poId) {
  e.preventDefault();

  if (!npoLineItems.length) {
    showToast('Add at least one product to the order', 'warning');
    return;
  }

  const payload = {
    vendorId: document.getElementById('npo-vendor').value,
    poNumber: document.getElementById('npo-ponumber').value.trim() || undefined,
    currency: document.getElementById('npo-currency').value,
    status: document.getElementById('npo-status')?.value || undefined,
    notes: document.getElementById('npo-notes')?.value.trim() || undefined,
    items: npoLineItems.map((item) => ({
      productId: item.productId,
      quantityOrdered: item.quantityOrdered,
      unitOfMeasure: item.unitOfMeasure,
      unitPriceCents: item.unitPriceCents,
    })),
  };

  try {
    const res = await apiFetch('/api/purchasing/orders/' + encodeURIComponent(poId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update PO');

    closeModal();
    showToast('Purchase Order ' + json.data.poNumber + ' updated successfully', 'success');
    loadPurchasing();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function deletePurchaseOrder(poId) {
  const po = state.purchaseOrders.find((p) => p.id === poId);
  if (!po) return;

  openConfirmModal({
    title: 'Delete Purchase Order',
    message: 'Are you sure you want to permanently delete purchase order ' + po.poNumber + '?',
    subtext: 'This will remove the PO and its associated line items. This action cannot be undone.',
    confirmText: 'Delete Order',
    type: 'danger',
    onConfirm: async () => {
      try {
        const res = await apiFetch('/api/purchasing/orders/' + encodeURIComponent(poId), {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete PO');
        showToast('Purchase Order ' + po.poNumber + ' deleted', 'success');
        loadPurchasing();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    },
  });
}
`;
