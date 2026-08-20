export function renderPurchasingView(): string {
  return `<div id="view-purchasing" class="tab-view" style="display: none;"></div>`;
}

export const PURCHASING_CLIENT_JS = `
async function loadPurchasing() {
  const container = document.getElementById('view-purchasing');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading purchasing data...</div>';

  try {
    const [ordersRes, vendorsRes] = await Promise.all([
      fetch('/api/purchasing/orders'),
      fetch('/api/purchasing/vendors'),
    ]);
    const ordersJson = await ordersRes.json();
    const vendorsJson = await vendorsRes.json();

    state.purchaseOrders = ordersJson.data || [];
    state.vendors = vendorsJson.data || [];

    let rowsHtml = '';
    state.purchaseOrders.forEach((po) => {
      const itemsList = po.items.map((i) => \`\${i.product?.name || 'Product'} (\${i.quantityOrdered} ordered, \${i.quantityReceived} received)\`).join(', ');
      rowsHtml += \`
        <tr>
          <td><strong>\${po.poNumber}</strong></td>
          <td>\${po.vendor?.name || 'Unknown'}</td>
          <td>
            <span class="badge \${po.status === 'RECEIVED' ? 'badge-success' : 'badge-primary'}">
              <span class="badge-dot"></span>
              \${po.status}
            </span>
          </td>
          <td><strong>\${formatCurrency(po.totalAmountCents)}</strong></td>
          <td style="font-size: 0.8rem; color: #64748b;">\${itemsList}</td>
          <td>
            \${po.status !== 'RECEIVED'
              ? \`<button class="btn btn-success btn-sm" onclick='openReceivePOModal("\${po.id}", "\${po.poNumber}", \${JSON.stringify(po.items)})'>Receive Goods</button>\`
              : '<span class="badge badge-success">Fulfilled</span>'
            }
          </td>
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
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Total Value</th>
                <th>Ordered Items</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              \${rowsHtml || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No purchase orders found.</td></tr>'}
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
    const res = await fetch('/api/purchasing/vendors', {
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
    const res = await fetch('/api/purchasing/orders', {
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

function openReceivePOModal(poId, poNumber, items) {
  let itemInputs = items.map((item, idx) => \`
    <div style="padding: 0.75rem; background: #f8fafc; border-radius: 6px; margin-bottom: 0.75rem; border: 1px solid #e2e8f0;">
      <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem;">
        \${item.product?.name || 'Product'} (Ordered: \${item.quantityOrdered}, Received: \${item.quantityReceived})
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">Quantity to Receive</label>
        <input type="number" id="grn-qty-\${idx}" data-poitemid="\${item.id}" class="form-input grn-item-input" value="\${item.quantityOrdered - item.quantityReceived}" min="1" max="\${item.quantityOrdered - item.quantityReceived}" required />
      </div>
    </div>
  \`).join('');

  const body = \`
    <form id="form-receive-grn" onsubmit="submitReceivePO(event, '\${poId}')">
      <p style="font-size: 0.84rem; color: #64748b; margin-bottom: 1rem;">
        Receiving inventory against <strong>\${poNumber}</strong> will create a Goods Received Note (GRN) and update the stock ledger.
      </p>
      \${itemInputs}
      <div class="form-group">
        <label class="form-label">Receiving Notes / Location</label>
        <input type="text" id="grn-notes" class="form-input" placeholder="Warehouse Bay 4" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-success" onclick="document.getElementById('form-receive-grn').requestSubmit()">Confirm Receipt</button>
  \`;
  openModal('Receive Goods for ' + poNumber, body, footer);
}

async function submitReceivePO(e, poId) {
  e.preventDefault();
  const itemInputs = document.querySelectorAll('.grn-item-input');
  const items = [];
  itemInputs.forEach((inp) => {
    items.push({
      poItemId: inp.dataset.poitemid,
      quantityReceived: parseInt(inp.value, 10),
    });
  });

  const payload = {
    notes: document.getElementById('grn-notes').value || 'Goods receipt',
    items,
  };

  try {
    const res = await fetch('/api/purchasing/orders/' + poId + '/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to receive goods');

    closeModal();
    showToast('GRN ' + json.grnNumber + ' recorded', 'success');
    loadPurchasing();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
