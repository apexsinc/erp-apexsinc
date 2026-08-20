export function renderPurchasingView(): string {
  return `<div id="view-purchasing" class="tab-view" style="display: none;"></div>`;
}

export const PURCHASING_CLIENT_JS = `
async function loadPurchasing() {
  const container = document.getElementById('view-purchasing');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading purchasing data...</div>';

  try {
    const [ordersRes, vendorsRes] = await Promise.all([
      apiFetch('/api/purchasing/orders'),
      apiFetch('/api/purchasing/vendors'),
    ]);
    const ordersJson = await ordersRes.json();
    const vendorsJson = await vendorsRes.json();

    state.purchaseOrders = ordersJson.data || [];
    state.vendors = vendorsJson.data || [];

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
        <tr>
          <td><strong>\${po.poNumber}</strong></td>
          <td>\${po.vendor?.name || 'Unknown'}</td>
          <td>
            <span class="badge \${poStatusBadgeClass[po.status] || 'badge-neutral'}">
              <span class="badge-dot"></span>
              \${po.status.replace('_', ' ')}
            </span>
          </td>
          <td><strong>\${formatCurrency(po.totalAmountCents)}</strong></td>
          <td style="font-size: 0.8rem; color: #64748b;">\${itemsList}</td>
        </tr>
      \`;
    });

    container.innerHTML = \`
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Purchase Orders & Procurement</div>
          <div class="panel-actions">
            <button class="btn btn-secondary btn-sm" onclick="openNewVendorModal()">Add Vendor</button>
            <button class="btn btn-primary btn-sm" onclick="openNewPOModal()">Create Purchase Order</button>
          </div>
        </div>
        <p style="padding: 0 1.35rem 1rem; font-size: 0.85rem; color: #64748b;">
          Once a purchase order is created it moves to Inbound Deliveries, where it's marked delivered and its arrived quantities are confirmed.
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

function openNewVendorModal() {
  const body = \`
    <form id="form-new-vendor" onsubmit="submitNewVendor(event)">
      <div class="form-group">
        <label class="form-label">Vendor Code *</label>
        <input type="text" id="nv-code" class="form-input" placeholder="e.g. VEND-SUPPLY" required />
      </div>
      <div class="form-group">
        <label class="form-label">Vendor Name *</label>
        <input type="text" id="nv-name" class="form-input" placeholder="e.g. Industrial Supply Corp" required />
      </div>
      <div class="form-group">
        <label class="form-label">Contact Email</label>
        <input type="email" id="nv-email" class="form-input" placeholder="orders@supplier.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Payment Terms (Days)</label>
        <input type="number" id="nv-terms" class="form-input" value="30" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-vendor').requestSubmit()">Save Vendor</button>
  \`;
  openModal('Add New Vendor', body, footer);
}

async function submitNewVendor(e) {
  e.preventDefault();
  const payload = {
    vendorCode: document.getElementById('nv-code').value,
    name: document.getElementById('nv-name').value,
    email: document.getElementById('nv-email').value || undefined,
    paymentTermsDays: parseInt(document.getElementById('nv-terms').value, 10) || 30,
  };

  try {
    const res = await apiFetch('/api/purchasing/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create vendor');

    closeModal();
    showToast('Vendor ' + json.data.name + ' added', 'success');
    loadPurchasing();
  } catch (err) {
    showToast(err.message, 'danger');
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

  let vendorOptions = state.vendors.map((v) => \`<option value="\${v.id}">\${v.name} (\${v.vendorCode})</option>\`).join('');
  let productOptions = state.products.map((p) => \`<option value="\${p.id}">\${p.sku} - \${p.name}</option>\`).join('');

  const body = \`
    <form id="form-new-po" onsubmit="submitNewPO(event)">
      <div class="form-group">
        <label class="form-label">Vendor *</label>
        <select id="npo-vendor" class="form-select">\${vendorOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Product *</label>
        <select id="npo-product" class="form-select">\${productOptions}</select>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Quantity to Order *</label>
          <input type="number" id="npo-qty" class="form-input" value="50" min="1" required />
        </div>
        <div class="form-group">
          <label class="form-label">Unit Cost (Cents) *</label>
          <input type="number" id="npo-unitcost" class="form-input" value="4500" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" id="npo-notes" class="form-input" placeholder="Standard replenishment order" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-po').requestSubmit()">Issue Purchase Order</button>
  \`;
  openModal('Create Purchase Order', body, footer);
}

async function submitNewPO(e) {
  e.preventDefault();
  const payload = {
    vendorId: document.getElementById('npo-vendor').value,
    notes: document.getElementById('npo-notes').value || undefined,
    items: [
      {
        productId: document.getElementById('npo-product').value,
        quantityOrdered: parseInt(document.getElementById('npo-qty').value, 10),
        unitPriceCents: parseInt(document.getElementById('npo-unitcost').value, 10),
      },
    ],
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
