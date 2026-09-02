export function renderPurchasingView(): string {
  return `<div id="view-purchasing" class="tab-view" style="display: none;"></div>`;
}

export const PURCHASING_CLIENT_JS = `
let npoLineItems = [];
let npoSelectedProductId = null;

async function loadPurchasing() {
  const container = document.getElementById('view-purchasing');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading purchasing data...</div>';

  try {
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

    const poStatusBadgeClass = {
      DRAFT: 'badge-neutral',
      APPROVED: 'badge-primary',
      DELIVERED: 'badge-warning',
      PARTIALLY_RECEIVED: 'badge-warning',
      RECEIVED: 'badge-success',
      CANCELLED: 'badge-danger',
    };

    let rowsHtml = '';
    state.purchaseOrders.forEach((po) => {
      const itemsList = po.items.map((i) => \`\${i.product?.name || 'Product'} (\${i.quantityOrdered} ordered, \${i.quantityReceived} received)\`).join(', ');
      rowsHtml += \`
        <tr class="row-clickable" onclick="goToInboundForPO('\${po.id}')">
          <td><strong>\${po.poNumber}</strong></td>
          <td>\${po.vendor?.name || 'Unknown'}</td>
          <td>
            <span class="badge \${poStatusBadgeClass[po.status] || 'badge-neutral'}">
              <span class="badge-dot"></span>
              \${po.status.replace('_', ' ')}
            </span>
          </td>
          <td><strong>\${formatCurrency(po.totalAmountCents, po.currency)}</strong></td>
          <td style="font-size: 0.8rem; color: #64748b;">\${itemsList}</td>
        </tr>
      \`;
    });

    container.innerHTML = \`
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Purchase Orders & Procurement</div>
          <div class="panel-actions">
            <button class="btn btn-primary btn-sm" onclick="openNewPOModal()">Create Purchase Order</button>
          </div>
        </div>
        <p style="padding: 0 1.35rem 1rem; font-size: 0.85rem; color: #64748b;">
          Manage suppliers in the Business Directory. Click a purchase order to open it in Inbound Deliveries, where it's marked delivered and its arrived quantities are confirmed.
        </p>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Total Value</th>
                <th>Ordered Items</th>
              </tr>
            </thead>
            <tbody>
              \${rowsHtml || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No purchase orders found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    \`;
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading purchasing: \${err.message}</div>\`;
  }
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
`;
