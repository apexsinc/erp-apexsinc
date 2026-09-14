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
  const headers = ['SI Number', 'Customer', 'Status', 'Currency', 'Order Total', 'Invoices'];
  const rows = (state.salesOrders || []).map((so) => [
    formatSiNumber(so.siNumber || so.soNumber),
    so.customer?.name || 'Customer',
    so.status,
    so.currency || 'PHP',
    (so.totalAmountCents / 100).toFixed(2),
    (so.invoices || []).map((inv) => \`\${inv.invoiceNumber} (\${inv.status})\`).join('; ') || 'None',
  ]);
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
      return num.includes(salesSearchQuery) || cust.includes(salesSearchQuery) || status.includes(salesSearchQuery);
    });
  }

  let rowsHtml = '';
  filteredOrders.forEach((so) => {
    // Delivery Receipts under this Sales Invoice
    const drs = so.deliveryReceipts || [];
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
    const hasRemainingToDeliver = (so.items || []).some((i) => (i.quantity - i.quantityShipped) > 0) &&
      (so.status === 'CONFIRMED' || so.status === 'PACKED' || so.status === 'PARTIALLY_FULFILLED');

    const deliverActionHtml = hasRemainingToDeliver && can('outbound', 'create')
      ? '<div style="margin-top: 0.35rem;">' +
        '<button type="button" class="btn btn-success btn-sm" style="padding: 0.2rem 0.55rem; font-size: 0.72rem; font-weight: 600;" onclick="goToOutboundForSO(&quot;' + so.id + '&quot;)">📦 + Create DR</button>' +
        '</div>'
      : '';

    const deliveriesHtml = [drsHtml, deliverActionHtml].filter(Boolean).join('') || '<span style="color: #94a3b8; font-size: 0.78rem;">Not yet delivered</span>';

    rowsHtml += \`
      <tr>
        <td><strong>\${formatSiNumber(so.siNumber || so.soNumber)}</strong></td>
        <td>\${so.customer?.name || 'Customer'}</td>
        <td>
          <span class="badge \${soStatusBadgeClass[so.status] || 'badge-neutral'}">
            <span class="badge-dot"></span>
            \${so.status.replace('_', ' ')}
          </span>
        </td>
        <td><strong>\${formatCurrency(so.totalAmountCents, so.currency)}</strong></td>
        <td>\${deliveriesHtml}</td>
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
          Manage customers in the Business Directory. Confirmed Sales Invoices post directly to Accounts Receivable. Issue delivery receipts as goods are fulfilled.
        </p>
        <div style="max-width: 280px; width: 100%;">
          <input type="text" class="form-input" style="width: 100%; padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search SI #, customer, status..." value="\${salesSearchQuery}" oninput="handleSalesSearch(this.value)" />
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>SI Number</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Order Total</th>
              <th>Deliveries</th>
            </tr>
          </thead>
          <tbody>
            \${rowsHtml || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No sales invoices found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  \`;
}

function openNewSalesOrderModal() {
  if (!state.customers.length) {
    showToast('Please add a customer first', 'warning');
    return;
  }
  if (!state.products.length) {
    showToast('Please add a product first', 'warning');
    return;
  }

  const sessionLatestSi = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('last_si_number') : null;
  const latestSi = sessionLatestSi || ((state.salesOrders && state.salesOrders.length)
    ? (state.salesOrders[0].siNumber || state.salesOrders[0].soNumber)
    : null);
  const nextSiNumber = generateNextSequence(latestSi, 'SI-');

  const custOptions = (state.customers || [])
    .map((c) => \`<option value="\${c.id}">\${escapeHtml(c.name)} (\${c.customerCode})</option>\`)
    .join('');
  const prodOptions = (state.products || [])
    .map((p) => \`<option value="\${p.id}">\${escapeHtml(p.name)} (\${p.sku})</option>\`)
    .join('');

  const body = \`
    <form id="form-new-so" onsubmit="submitNewSalesOrder(event)">
      <div class="form-group">
        <label class="form-label">SI Number *</label>
        <input type="text" id="nso-sinumber" class="form-input" value="\${nextSiNumber}" placeholder="e.g. SI-1001" required />
      </div>
      <div class="form-group">
        <label class="form-label">Customer *</label>
        <select id="nso-cust" class="form-select" required>
          \${custOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Currency *</label>
        <select id="nso-currency" class="form-select" required>
          <option value="PHP">PHP (₱)</option>
          <option value="USD">USD ($)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Product *</label>
        <select id="nso-product" class="form-select" onchange="handleNewSoProductChange()" required>
          \${prodOptions}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Quantity *</label>
          <input type="number" id="nso-qty" class="form-input" min="1" value="1" required />
        </div>
        <div class="form-group">
          <label class="form-label">
            Unit Price * <span id="nso-price-hint" style="font-weight: 400; font-size: 0.72rem; color: #64748b;"></span>
          </label>
          <input type="number" id="nso-price" class="form-input" step="0.01" min="0" placeholder="0.00" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" id="nso-notes" class="form-input" placeholder="Standard order" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-so').requestSubmit()">Confirm Order</button>
  \`;
  openModal('Create Sales Invoice', body, footer);
  handleNewSoProductChange();
}

// Unit Price defaults to the product's Business Directory Price List entry
// (set on the Price List tab) so sales orders quote what was decided there
// instead of being retyped by hand each time. Still editable — this is a
// starting point, not a lock.
function handleNewSoProductChange() {
  const productSelect = document.getElementById('nso-product');
  const currencySelect = document.getElementById('nso-currency');
  const priceInput = document.getElementById('nso-price');
  const hint = document.getElementById('nso-price-hint');
  if (!productSelect || !currencySelect || !priceInput || !hint) return;

  const product = (state.products || []).find((p) => p.id === productSelect.value);
  if (!product) return;

  if (product.sellingPriceCents > 0) {
    currencySelect.value = product.sellingPriceCurrency || 'USD';
    priceInput.value = (product.sellingPriceCents / 100).toFixed(2);
    hint.textContent = '(from Price List)';
  } else {
    priceInput.value = '';
    hint.textContent = '(not in Price List yet — set it in Business Directory)';
  }
}

async function submitNewSalesOrder(e) {
  e.preventDefault();
  // Entered as a normal currency amount (e.g. 90.00), not cents - convert
  // once here so every downstream calculation works in integer cents.
  const unitPriceCents = Math.round(parseFloat(document.getElementById('nso-price').value) * 100);
  const siNumberInput = document.getElementById('nso-sinumber');
  const siNumber = siNumberInput ? siNumberInput.value.trim() : '';

  const payload = {
    siNumber: siNumber || undefined,
    customerId: document.getElementById('nso-cust').value,
    currency: document.getElementById('nso-currency').value,
    notes: document.getElementById('nso-notes').value || undefined,
    items: [
      {
        productId: document.getElementById('nso-product').value,
        quantity: parseInt(document.getElementById('nso-qty').value, 10),
        unitPriceCents,
      },
    ],
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
    showToast('Sales Invoice ' + confirmedNumber + ' confirmed', 'success');
    loadSales();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
