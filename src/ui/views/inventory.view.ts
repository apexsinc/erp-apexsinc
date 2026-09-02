export function renderInventoryView(): string {
  return `<div id="view-inventory" class="tab-view" style="display: none;"></div>`;
}

export const INVENTORY_CLIENT_JS = `
async function loadInventory() {
  const container = document.getElementById('view-inventory');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading inventory...</div>';

  try {
    const res = await apiFetch('/api/inventory/products');
    const json = await res.json();
    state.products = json.data || [];

    let rowsHtml = '';
    state.products.forEach((p) => {
      rowsHtml += \`
        <tr>
          <td><strong>\${p.sku}</strong></td>
          <td>\${p.name}</td>
          <td>\${p.unitOfMeasure}</td>
          <td>\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.75rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8;">Not purchased yet</span>'}</td>
          <td>\${p.sellingPriceCents > 0 ? formatCurrency(p.sellingPriceCents) : '<span style="color: #94a3b8;">Not set</span>'}</td>
          <td>
            <span class="badge \${p.onHandStock > 10 ? 'badge-success' : p.onHandStock > 0 ? 'badge-warning' : 'badge-danger'}">
              <span class="badge-dot"></span>
              \${p.onHandStock} \${p.unitOfMeasure}
            </span>
          </td>
          <td><strong>\${formatCurrency(p.inventoryValuationCents)}</strong></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openProductHistoryModal('\${p.id}', '\${p.name}')">History</button>
          </td>
        </tr>
      \`;
    });

    container.innerHTML = \`
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Product Catalog & Stock Levels</div>
          <div class="panel-actions">
            <button class="btn btn-secondary btn-sm" onclick="openStockAdjustmentModal()">Stock Adjustment</button>
          </div>
        </div>
        <p style="padding: 0 1.35rem 1rem; font-size: 0.85rem; color: #64748b;">
          Add new products from the Business Directory. This view tracks stock levels, valuation, and movement history.
        </p>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>UOM</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>On-Hand Stock</th>
                <th>Valuation</th>
                <th>Audit</th>
              </tr>
            </thead>
            <tbody>
              \${rowsHtml || '<tr><td colspan="8" style="text-align: center; color: #64748b;">No products found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    \`;
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading inventory: \${err.message}</div>\`;
  }
}

async function openProductHistoryModal(productId, productName) {
  try {
    const res = await apiFetch('/api/inventory/products/' + productId);
    const json = await res.json();
    const movements = json.data?.stockMovements || [];

    let rowsHtml = '';
    movements.forEach((m) => {
      rowsHtml += \`
        <tr>
          <td>\${new Date(m.createdAt).toLocaleDateString()} \${new Date(m.createdAt).toLocaleTimeString()}</td>
          <td><span class="badge \${m.type === 'IN' ? 'badge-success' : m.type === 'OUT' ? 'badge-danger' : 'badge-warning'}">\${m.type}</span></td>
          <td><strong>\${m.quantity}</strong></td>
          <td>\${m.referenceType} (\${m.referenceId || 'N/A'})</td>
          <td>\${m.notes || '-'}</td>
        </tr>
      \`;
    });

    const body = \`
      <p style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b;">
        Audit movements for <strong>\${productName}</strong>. Current On-Hand: <strong>\${json.data.onHandStock}</strong>
      </p>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Reference</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            \${rowsHtml || '<tr><td colspan="5" style="text-align: center;">No movements recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    \`;
    openModal('Stock Movement Audit: ' + productName, body);
  } catch (err) {
    showToast('Error fetching ledger: ' + err.message, 'danger');
  }
}

function openStockAdjustmentModal() {
  if (!state.products.length) {
    showToast('Please add products first', 'warning');
    return;
  }
  let options = state.products.map((p) => \`<option value="\${p.id}">\${p.sku} - \${p.name} (Current: \${p.onHandStock})</option>\`).join('');
  const body = \`
    <form id="form-stock-adj" onsubmit="submitStockAdjustment(event)">
      <div class="form-group">
        <label class="form-label">Select Product *</label>
        <select id="adj-product" class="form-select">\${options}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Adjustment Type *</label>
        <select id="adj-type" class="form-select">
          <option value="IN">IN (Stock Addition)</option>
          <option value="OUT">OUT (Stock Reduction)</option>
          <option value="ADJUST">ADJUST (Inventory Delta)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity *</label>
        <input type="number" id="adj-qty" class="form-input" placeholder="10" required />
      </div>
      <div class="form-group">
        <label class="form-label">Reason / Notes</label>
        <input type="text" id="adj-notes" class="form-input" placeholder="Physical inventory reconciliation" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-stock-adj').requestSubmit()">Post Adjustment</button>
  \`;
  openModal('Post Stock Adjustment', body, footer);
}

async function submitStockAdjustment(e) {
  e.preventDefault();
  const payload = {
    productId: document.getElementById('adj-product').value,
    type: document.getElementById('adj-type').value,
    quantity: parseInt(document.getElementById('adj-qty').value, 10),
    referenceType: 'ADJUSTMENT',
    notes: document.getElementById('adj-notes').value || 'Manual adjustment',
  };

  try {
    const res = await apiFetch('/api/inventory/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to adjust stock');

    closeModal();
    showToast('Stock adjustment recorded. Balance: ' + json.newOnHandStock, 'success');
    loadInventory();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
