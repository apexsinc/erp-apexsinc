export function renderSalesView(): string {
  return `<div id="view-sales" class="tab-view" style="display: none;"></div>`;
}

export const SALES_CLIENT_JS = `
async function loadSales() {
  const container = document.getElementById('view-sales');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading sales data...</div>';

  try {
    const [soRes, custRes] = await Promise.all([
      apiFetch('/api/sales/orders'),
      apiFetch('/api/sales/customers'),
    ]);
    const soJson = await soRes.json();
    const custJson = await custRes.json();

    state.salesOrders = soJson.data || [];
    state.customers = custJson.data || [];

    const soStatusBadgeClass = {
      DRAFT: 'badge-neutral',
      CONFIRMED: 'badge-primary',
      PACKED: 'badge-warning',
      PARTIALLY_FULFILLED: 'badge-warning',
      FULFILLED: 'badge-success',
      CANCELLED: 'badge-danger',
    };

    let rowsHtml = '';
    state.salesOrders.forEach((so) => {
      const invoices = so.invoices || [];
      const invoicesHtml = invoices.length
        ? invoices.map((inv) => \`
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem;">
              <span class="badge \${inv.status === 'PAID' ? 'badge-success' : inv.status === 'PARTIALLY_PAID' ? 'badge-warning' : 'badge-primary'}" style="font-size: 0.68rem;">\${inv.invoiceNumber}</span>
              \${inv.status !== 'PAID'
                ? \`<button class="btn btn-success btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.72rem;" onclick="openRecordReceiptModal('\${inv.id}', '\${inv.invoiceNumber}', \${inv.totalAmountCents - inv.paidAmountCents})">Pay</button>\`
                : ''
              }
            </div>
          \`).join('')
        : '<span style="color: #94a3b8; font-size: 0.78rem;">Not yet invoiced</span>';

      rowsHtml += \`
        <tr>
          <td><strong>\${so.soNumber}</strong></td>
          <td>\${so.customer?.name || 'Customer'}</td>
          <td>
            <span class="badge \${soStatusBadgeClass[so.status] || 'badge-neutral'}">
              <span class="badge-dot"></span>
              \${so.status.replace('_', ' ')}
            </span>
          </td>
          <td><strong>\${formatCurrency(so.totalAmountCents, so.currency)}</strong></td>
          <td>\${invoicesHtml}</td>
        </tr>
      \`;
    });

    container.innerHTML = \`
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Sales Orders & Invoicing</div>
          <div class="panel-actions">
            <button class="btn btn-primary btn-sm" onclick="openNewSalesOrderModal()">Create Sales Order</button>
          </div>
        </div>
        <p style="padding: 0 1.35rem 1rem; font-size: 0.85rem; color: #64748b;">
          Manage customers in the Business Directory. Ship confirmed orders and issue their invoices from Outbound Deliveries.
        </p>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>SO Number</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Order Total</th>
                <th>Invoices & Payment</th>
              </tr>
            </thead>
            <tbody>
              \${rowsHtml || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No sales orders found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    \`;
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading sales: \${err.message}</div>\`;
  }
}

function openNewSalesOrderModal() {
  if (!state.customers.length) {
    showToast('Please add a customer first', 'warning');
    return;
  }
  if (!state.products.length) {
    showToast('Please add products first', 'warning');
    return;
  }

  let custOptions = state.customers.map((c) => \`<option value="\${c.id}">\${c.name} (\${c.customerCode})</option>\`).join('');
  let prodOptions = state.products.map((p) => \`<option value="\${p.id}">\${p.sku} - \${p.name} (Stock: \${p.onHandStock})</option>\`).join('');

  const body = \`
    <form id="form-new-so" onsubmit="submitNewSalesOrder(event)">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Customer *</label>
          <select id="nso-cust" class="form-select">\${custOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Currency *</label>
          <select id="nso-currency" class="form-select">
            <option value="USD" selected>USD ($)</option>
            <option value="PHP">PHP (₱)</option>
          </select>
        </div>
      </div>
      <p style="margin: -0.6rem 0 1rem; font-size: 0.76rem; color: #94a3b8;">All line items on this order are priced in the currency selected here.</p>
      <div class="form-group">
        <label class="form-label">Product *</label>
        <select id="nso-product" class="form-select">\${prodOptions}</select>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Quantity *</label>
          <input type="number" id="nso-qty" class="form-input" value="10" min="1" required />
        </div>
        <div class="form-group">
          <label class="form-label">Unit Price *</label>
          <input type="number" id="nso-price" class="form-input" placeholder="e.g. 90.00" step="0.01" min="0" required />
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
  openModal('Create Sales Order', body, footer);
}

async function submitNewSalesOrder(e) {
  e.preventDefault();
  // Entered as a normal currency amount (e.g. 90.00), not cents - convert
  // once here so every downstream calculation works in integer cents.
  const unitPriceCents = Math.round(parseFloat(document.getElementById('nso-price').value) * 100);
  const payload = {
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
    showToast('Sales Order ' + json.data.soNumber + ' confirmed', 'success');
    loadSales();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openRecordReceiptModal(invoiceId, invoiceNumber, totalCents) {
  const body = \`
    <form id="form-receipt" onsubmit="submitReceipt(event, '\${invoiceId}')">
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
        Recording payment for <strong>\${invoiceNumber}</strong> settles Accounts Receivable and credits the account.
      </p>
      <div class="form-group">
        <label class="form-label">Payment Amount (Cents) *</label>
        <input type="number" id="rcpt-amount" class="form-input" value="\${totalCents}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Payment Method</label>
        <select id="rcpt-method" class="form-select">
          <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
          <option value="CREDIT_CARD">Credit Card</option>
          <option value="CHECK">Check</option>
          <option value="CASH">Cash</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Reference Note</label>
        <input type="text" id="rcpt-notes" class="form-input" placeholder="Payment reference number" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-success" onclick="document.getElementById('form-receipt').requestSubmit()">Post Receipt</button>
  \`;
  openModal('Record Customer Payment', body, footer);
}

async function submitReceipt(e, invoiceId) {
  e.preventDefault();
  const payload = {
    amountCents: parseInt(document.getElementById('rcpt-amount').value, 10),
    paymentMethod: document.getElementById('rcpt-method').value,
    notes: document.getElementById('rcpt-notes').value || 'Customer payment',
  };

  try {
    const res = await apiFetch('/api/sales/invoices/' + invoiceId + '/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to post receipt');

    closeModal();
    showToast('Receipt ' + json.receiptVoucherNumber + ' recorded', 'success');
    loadSales();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
