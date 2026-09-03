export function renderInventoryView(): string {
  return `<div id="view-inventory" class="tab-view" style="display: none;"></div>`;
}

export const INVENTORY_CLIENT_JS = `
let inventorySearchQuery = '';
let inventoryCategoryTab = 'all';

async function loadInventory() {
  const container = document.getElementById('view-inventory');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading inventory...</div>');

  try {
    inventorySearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';

    const [productsRes, categoriesRes] = await Promise.all([
      apiFetch('/api/inventory/products'),
      apiFetch('/api/inventory/categories'),
    ]);
    const productsJson = await productsRes.json();
    const categoriesJson = await categoriesRes.json();
    state.products = productsJson.data || [];
    state.productCategories = categoriesJson.data || [];

    renderInventoryContent(container);
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading inventory: \${err.message}</div>\`;
  }
}

function handleInventorySearch(query) {
  inventorySearchQuery = query.toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', inventorySearchQuery || null);
  }
  const container = document.getElementById('view-inventory');
  if (container) {
    renderInventoryContent(container);
  }
}

function exportInventoryCsv() {
  const headers = ['SKU', 'Product Name', 'Category', 'UOM', 'Cost Price', 'Selling Price', 'On-Hand Stock', 'Valuation (PHP)'];
  const rows = (state.products || []).map((p) => [
    p.sku,
    p.name,
    p.category || 'General',
    p.unitOfMeasure,
    p.costPriceCents ? (p.costPriceCents / 100).toFixed(2) + ' ' + (p.costPriceCurrency || 'PHP') : '0.00',
    p.sellingPriceCents ? (p.sellingPriceCents / 100).toFixed(2) + ' ' + (p.sellingPriceCurrency || 'PHP') : '0.00',
    p.onHandStock,
    (p.inventoryValuationCents / 100).toFixed(2),
  ]);
  exportToCsv('inventory_catalog_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function renderInventoryContent(container) {
  // inventoryCategoryTab may point at a category that's since been renamed/removed —
  // fall back to "all" rather than showing an empty table.
  if (inventoryCategoryTab !== 'all' && !(state.productCategories || []).some((c) => c.name === inventoryCategoryTab)) {
    inventoryCategoryTab = 'all';
  }

  let filteredProducts = state.products || [];
  if (inventoryCategoryTab !== 'all') {
    filteredProducts = filteredProducts.filter((p) => p.category === inventoryCategoryTab);
  }
  if (inventorySearchQuery) {
    filteredProducts = filteredProducts.filter((p) => {
      const sku = (p.sku || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const uom = (p.unitOfMeasure || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return sku.includes(inventorySearchQuery) || name.includes(inventorySearchQuery) || uom.includes(inventorySearchQuery) || cat.includes(inventorySearchQuery);
    });
  }

  let rowsHtml = '';
  filteredProducts.forEach((p) => {
    rowsHtml += \`
      <tr>
        <td><strong style="font-family: 'JetBrains Mono', monospace;">\${p.sku}</strong></td>
        <td><strong>\${p.name}</strong></td>
        <td>\${p.category || '<span style="color: #94a3b8;">—</span>'}</td>
        <td>\${p.unitOfMeasure}</td>
        <td>\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.75rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8;">Not purchased yet</span>'}</td>
        <td>\${p.sellingPriceCents > 0 ? formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency) : '<span style="color: #94a3b8;">Not set</span>'}</td>
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
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="exportInventoryCsv()">📥 Export CSV</button>
          \${can('inventory', 'create') ? '<button class="btn btn-primary btn-sm" onclick="openAddStockModal()">➕ Add Stock</button>' : ''}
          \${can('inventory', 'update') ? '<button class="btn btn-secondary btn-sm" onclick="openStockAdjustmentModal()">Stock Adjustment</button>' : ''}
        </div>
      </div>
      <div style="padding: 0 1.35rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <p style="font-size: 0.85rem; color: #64748b; margin: 0;">
          Add new products from the Business Directory. This view tracks stock levels, valuation, and movement history.
        </p>
        <div style="min-width: 260px;">
          <input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search SKU, product name..." value="\${inventorySearchQuery}" oninput="handleInventorySearch(this.value)" />
        </div>
      </div>
      <div id="inventory-category-tabs" style="padding: 0 1.35rem 1rem;"></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>UOM</th>
              <th>Cost Price</th>
              <th>Selling Price</th>
              <th>On-Hand Stock</th>
              <th>Valuation</th>
              <th>Audit</th>
            </tr>
          </thead>
          <tbody>
            \${rowsHtml || '<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 2rem;">No products matching search criteria.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  \`;
  renderInventoryCategoryTabs();
}

// Category pill filter for the Inventory table — view-only browsing by
// category. Adding/changing a product's category is managed exclusively
// from the Business Directory, not here.
function renderInventoryCategoryTabs() {
  const wrap = document.getElementById('inventory-category-tabs');
  if (!wrap) return;

  const countFor = (catName) => (state.products || []).filter((p) => p.category === catName).length;

  const pills = [
    { key: 'all', label: 'All Products', count: (state.products || []).length },
    ...(state.productCategories || []).map((c) => ({ key: c.name, label: c.name, count: countFor(c.name) })),
  ];

  const pillsHtml = pills.map((p) => {
    const active = inventoryCategoryTab === p.key;
    return \`
      <button type="button" onclick="inventoryCategoryTab = '\${p.key.replace(/'/g, "\\\\'")}'; renderInventoryContent(document.getElementById('view-inventory'));" style="padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid \${active ? 'var(--primary)' : 'var(--border-color)'}; background: \${active ? 'var(--primary)' : '#f8fafc'}; color: \${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        \${p.label} <span style="opacity: 0.75;">(\${p.count})</span>
      </button>
    \`;
  }).join('');

  wrap.innerHTML = \`
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
      \${pillsHtml}
    </div>
  \`;
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

function openAddStockModal() {
  if (!state.products.length) {
    showToast('Please add products first', 'warning');
    return;
  }
  let options = state.products
    .map((p) => \`<option value="\${p.id}">\${p.sku} - \${p.name} (Current: \${p.onHandStock})</option>\`)
    .join('');
  const body = \`
    <form id="form-add-stock" onsubmit="submitAddStock(event)">
      <p style="margin: 0 0 1rem; font-size: 0.85rem; color: #64748b;">
        Use this for stock that isn't coming through a Purchase Order — e.g. legacy products
        already on hand before this system was in use. If the product has no cost price yet,
        set one here so its valuation is accurate.
      </p>
      <div class="form-group">
        <label class="form-label">Select Product *</label>
        <select id="add-stock-product" class="form-select" onchange="handleAddStockProductChange()">\${options}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity to Add *</label>
        <input type="number" id="add-stock-qty" class="form-input" placeholder="10" min="1" required />
      </div>
      <div class="form-group" style="display: flex; gap: 0.75rem;">
        <div style="flex: 2;">
          <label class="form-label">Unit Cost <span id="add-stock-cost-hint" style="color: #94a3b8; font-weight: normal;"></span></label>
          <input type="number" id="add-stock-cost" class="form-input" placeholder="0.00" min="0" step="0.01" />
        </div>
        <div style="flex: 1;">
          <label class="form-label">Currency</label>
          <select id="add-stock-currency" class="form-select">
            <option value="PHP">PHP</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Reason / Notes</label>
        <input type="text" id="add-stock-notes" class="form-input" placeholder="Legacy stock on hand, no PO on record" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-add-stock').requestSubmit()">Add Stock</button>
  \`;
  openModal('Add Stock (No PO)', body, footer);
  handleAddStockProductChange();
}

function handleAddStockProductChange() {
  const select = document.getElementById('add-stock-product');
  const product = (state.products || []).find((p) => p.id === select.value);
  if (!product) return;

  const costInput = document.getElementById('add-stock-cost');
  const currencySelect = document.getElementById('add-stock-currency');
  const hint = document.getElementById('add-stock-cost-hint');

  currencySelect.value = product.costPriceCurrency || 'PHP';
  if (product.costPriceCents > 0) {
    costInput.value = (product.costPriceCents / 100).toFixed(2);
    hint.textContent = '(currently ' + formatCurrency(product.costPriceCents, product.costPriceCurrency) + ')';
  } else {
    costInput.value = '';
    hint.textContent = '(not set yet — recommended for accurate valuation)';
  }
}

async function submitAddStock(e) {
  e.preventDefault();
  const productId = document.getElementById('add-stock-product').value;
  const quantity = parseInt(document.getElementById('add-stock-qty').value, 10);
  const costInput = document.getElementById('add-stock-cost').value;
  const currency = document.getElementById('add-stock-currency').value;
  const notes = document.getElementById('add-stock-notes').value || 'Manual stock entry (no PO)';

  if (!quantity || quantity <= 0) {
    showToast('Quantity must be a positive number', 'warning');
    return;
  }

  const unitCostCents = costInput !== '' ? Math.round(parseFloat(costInput) * 100) : undefined;

  try {
    const movementPayload = {
      productId,
      type: 'IN',
      quantity,
      referenceType: 'ADJUSTMENT',
      notes,
    };
    if (unitCostCents !== undefined) movementPayload.unitCostCents = unitCostCents;

    const res = await apiFetch('/api/inventory/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movementPayload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add stock');

    if (unitCostCents !== undefined) {
      const priceRes = await apiFetch('/api/inventory/products/' + productId + '/cost-price', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costPriceCents: unitCostCents, costPriceCurrency: currency }),
      });
      const priceJson = await priceRes.json();
      if (!priceRes.ok || !priceJson.success) throw new Error(priceJson.error || 'Stock added, but failed to update cost price');
    }

    closeModal();
    showToast('Stock added. New balance: ' + json.newOnHandStock, 'success');
    loadInventory();
  } catch (err) {
    showToast(err.message, 'danger');
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
