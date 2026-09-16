export function renderOutboundView(): string {
  return `<div id="view-outbound" class="tab-view" style="display: none;"></div>`;
}

export const OUTBOUND_CLIENT_JS = `
let outboundSearchQuery = '';
let outboundActiveTab = 'receipts';

async function loadOutbound() {
  const container = document.getElementById('view-outbound');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading delivery receipts...</div>');

  try {
    outboundSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';

    const [receiptsRes, ordersRes, productsRes] = await Promise.all([
      apiFetch('/api/outbound/receipts'),
      apiFetch('/api/outbound/orders'),
      apiFetch('/api/inventory/products'),
    ]);

    const receiptsJson = await receiptsRes.json();
    const ordersJson = await ordersRes.json();
    const productsJson = await productsRes.json();

    state.deliveryReceipts = receiptsJson.data || [];
    state.outboundOrders = ordersJson.data || [];
    state.products = productsJson.data || [];

    renderOutboundContent(container);
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading delivery receipts: \${err.message}</div>\`;
  }
}

function handleOutboundSearch(query) {
  outboundSearchQuery = query.toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', outboundSearchQuery || null);
  }
  const container = document.getElementById('view-outbound');
  if (container) {
    renderOutboundContent(container);
  }
}

function switchOutboundSubTab(tab) {
  outboundActiveTab = tab;
  const container = document.getElementById('view-outbound');
  if (container) {
    renderOutboundContent(container);
  }
}

function exportOutboundCsv() {
  const headers = ['DR Number', 'Delivered Date', 'SI Number', 'Customer', 'Received By', 'Status', 'Delivered Items'];
  const rows = (state.deliveryReceipts || []).map((dr) => [
    dr.drNumber,
    new Date(dr.arrivedAt || dr.deliveredAt || dr.createdAt).toLocaleString(),
    formatSiNumber(dr.salesOrder?.siNumber || dr.salesOrder?.soNumber || 'SI'),
    dr.salesOrder?.customer?.name || 'Customer',
    dr.receivedBy || 'N/A',
    (dr.status === 'COMPLETED' || dr.receivedBy) ? 'Completed' : 'In Transit',
    (dr.items || []).map((i) => (i.product?.name || 'Product') + ' (' + i.quantity + ')').join('; '),
  ]);
  exportToCsv('delivery_receipts_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function outboundOnHandStock(productId) {
  const p = (state.products || []).find((x) => x.id === productId);
  return p ? p.onHandStock : 0;
}

function outboundStatusBadge(status) {
  const map = {
    CONFIRMED: 'badge-primary',
    PACKED: 'badge-warning',
    PARTIALLY_FULFILLED: 'badge-warning',
    FULFILLED: 'badge-success',
  };
  const cls = map[status] || 'badge-neutral';
  return '<span class="badge ' + cls + '"><span class="badge-dot"></span>' + status.replace('_', ' ') + '</span>';
}

function renderOutboundContent(container) {
  const allReceipts = state.deliveryReceipts || [];
  const allOrders = state.outboundOrders || [];

  // Filter Delivery Receipts
  let filteredReceipts = allReceipts;
  if (outboundSearchQuery) {
    filteredReceipts = filteredReceipts.filter((dr) => {
      const drNum = (dr.drNumber || '').toLowerCase();
      const soNum = (dr.salesOrder?.siNumber || dr.salesOrder?.soNumber || '').toLowerCase();
      const cust = (dr.salesOrder?.customer?.name || '').toLowerCase();
      const rec = (dr.receivedBy || '').toLowerCase();
      const notes = (dr.notes || '').toLowerCase();
      return drNum.includes(outboundSearchQuery) || soNum.includes(outboundSearchQuery) || cust.includes(outboundSearchQuery) || rec.includes(outboundSearchQuery) || notes.includes(outboundSearchQuery);
    });
  }

  // Filter Pending Orders (only orders with deliverable physical products)
  const pendingOrders = allOrders.filter((so) => {
    if (so.status === 'FULFILLED' || so.status === 'CANCELLED' || so.status === 'DRAFT') return false;
    return (so.items || []).some((i) => i.product?.type !== 'SERVICE' && (i.quantity - i.quantityShipped) > 0);
  });
  let filteredPending = pendingOrders;
  if (outboundSearchQuery) {
    filteredPending = filteredPending.filter((so) => {
      const soNum = (so.siNumber || so.soNumber || '').toLowerCase();
      const cust = (so.customer?.name || '').toLowerCase();
      const status = (so.status || '').toLowerCase();
      return soNum.includes(outboundSearchQuery) || cust.includes(outboundSearchQuery) || status.includes(outboundSearchQuery);
    });
  }

  // Receipts Table HTML
  let receiptsTableHtml = '';
  if (!filteredReceipts.length) {
    receiptsTableHtml = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">No delivery receipts found.</td></tr>';
  } else {
    receiptsTableHtml = filteredReceipts.map((dr) => {
      const isCompleted = dr.status === 'COMPLETED' || (!dr.status && dr.receivedBy);
      const rawDate = dr.arrivedAt || dr.deliveredAt || dr.createdAt;
      const dateStr = new Date(rawDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const dateSubtext = isCompleted
        ? '<span style="font-size: 0.71rem; color: #16a34a; display: block; font-weight: 600;">✅ Arrived</span>'
        : '<span style="font-size: 0.71rem; color: #d97706; display: block; font-weight: 600;">🚚 In Transit</span>';

      const itemsList = (dr.items || []).map((i) => \`<strong>\${i.quantity}x</strong> \${escapeHtml(i.product?.name || 'Product')}\`).join(', ');
      const statusBadge = isCompleted
        ? '<span class="badge badge-success" style="font-size: 0.72rem;"><span class="badge-dot"></span>Completed</span>'
        : '<span class="badge badge-warning" style="font-size: 0.72rem;"><span class="badge-dot"></span>In Transit</span>';

      const receiverDisplay = dr.receivedBy
        ? escapeHtml(dr.receivedBy)
        : '<span style="color: #94a3b8; font-style: italic; font-size: 0.8rem;">Awaiting arrival</span>';

      const markArrivedBtn = (!isCompleted && can('outbound', 'create'))
        ? '<button type="button" class="btn btn-success btn-sm" style="padding: 0.2rem 0.55rem; font-size: 0.72rem; font-weight: 600;" onclick="openMarkDeliveryArrivedModal(&quot;' + dr.id + '&quot;)">✅ Mark Arrived</button>'
        : '';

      return \`
        <tr>
          <td><strong>\${dr.drNumber}</strong></td>
          <td>\${dateStr}\${dateSubtext}</td>
          <td><span style="font-weight: 600; color: var(--primary);">\${formatSiNumber(dr.salesOrder?.siNumber || dr.salesOrder?.soNumber || 'SI')}</span></td>
          <td>\${escapeHtml(dr.salesOrder?.customer?.name || 'Customer')}</td>
          <td style="font-size: 0.8rem; max-width: 260px;">\${itemsList}</td>
          <td>\${receiverDisplay}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              \${statusBadge}
            </div>
          </td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.35rem;">
              \${markArrivedBtn}
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="openDeliveryReceiptSlipModal(&quot;\${dr.id}&quot;)">📄 View Slip</button>
            </div>
          </td>
        </tr>
      \`;
    }).join('');
  }

  // Pending Orders Cards HTML
  let pendingCardsHtml = '';
  if (!filteredPending.length) {
    pendingCardsHtml = '<div style="padding: 2.5rem; text-align: center; color: #64748b;">No sales orders awaiting delivery. Confirmed orders appear here automatically.</div>';
  } else {
    pendingCardsHtml = filteredPending.map((so) => {
      const itemRows = (so.items || []).map((item) => {
        const remaining = item.quantity - item.quantityShipped;
        const onHand = outboundOnHandStock(item.productId);
        const isSufficient = onHand >= remaining;
        return \`
          <tr>
            <td>\${escapeHtml(item.product?.name || 'Product')}</td>
            <td>\${item.quantity}</td>
            <td>\${item.quantityShipped}</td>
            <td><strong>\${remaining}</strong></td>
            <td>
              <span class="\${isSufficient ? 'text-success' : 'text-danger'}" style="font-weight: 600;">
                \${onHand} in stock
              </span>
            </td>
          </tr>
        \`;
      }).join('');

      const invBadge = '<span class="badge badge-primary" style="font-size: 0.7rem;"><span class="badge-dot"></span>Invoiced (' + formatSiNumber(so.siNumber || so.soNumber) + ')</span>';

      return \`
        <div class="panel-card" style="margin-bottom: 1rem; border: 1px solid var(--border-color); background: #ffffff;">
          <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding: 0.85rem 1.25rem;">
            <div class="panel-title" style="font-size: 0.95rem;">
              <strong>\${formatSiNumber(so.siNumber || so.soNumber)}</strong> — \${escapeHtml(so.customer?.name || 'Unknown Customer')}
              <div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <span>Total: \${formatCurrency(so.totalAmountCents, so.currency)}</span>
                \${outboundStatusBadge(so.status)}
                \${invBadge}
              </div>
            </div>
            <div class="panel-actions">
              \${can('outbound', 'create') ? \`<button type="button" class="btn btn-success btn-sm" onclick="openCreateDeliveryReceiptModal('\${so.id}')">+ Create Delivery Receipt</button>\` : ''}
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Ordered</th>
                  <th>Delivered</th>
                  <th>Remaining</th>
                  <th>On-Hand Stock</th>
                </tr>
              </thead>
              <tbody>\${itemRows}</tbody>
            </table>
          </div>
        </div>
      \`;
    }).join('');
  }

  container.innerHTML = \`
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <div class="panel-title">Delivery Receipts & Outbound Dispatch</div>
          <p style="font-size: 0.84rem; color: #64748b; margin: 0.25rem 0 0;">
            Official warehouse Delivery Receipts (DR), customer goods dispatch, and automatic inventory stock deduction.
          </p>
        </div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="exportOutboundCsv()">📥 Export CSV</button>
          \${can('outbound', 'create') ? '<button type="button" class="btn btn-primary btn-sm" onclick="openCreateDeliveryReceiptModal()">+ Create Delivery Receipt</button>' : ''}
        </div>
      </div>

      <!-- TABS & CONTROLS -->
      <div style="padding: 0 1.25rem 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-sm \${outboundActiveTab === 'receipts' ? 'btn-primary' : 'btn-secondary'}" onclick="switchOutboundSubTab('receipts')">
            Delivery Receipts (\${allReceipts.length})
          </button>
          <button type="button" class="btn btn-sm \${outboundActiveTab === 'pending' ? 'btn-primary' : 'btn-secondary'}" onclick="switchOutboundSubTab('pending')">
            Orders Awaiting Delivery (\${pendingOrders.length})
          </button>
        </div>
        <div style="min-width: 260px;">
          <input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search DR #, SI #, customer..." value="\${escapeHtml(outboundSearchQuery)}" oninput="handleOutboundSearch(this.value)" />
        </div>
      </div>

      <!-- MAIN TAB CONTENT -->
      \${outboundActiveTab === 'receipts' ? \`
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>DR Number</th>
                <th>Delivered Date</th>
                <th>SI Number</th>
                <th>Customer</th>
                <th>Delivered Items</th>
                <th>Received By</th>
                <th>Delivery Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>\${receiptsTableHtml}</tbody>
          </table>
        </div>
      \` : \`
        <div style="padding: 1rem 1.25rem;">
          \${pendingCardsHtml}
        </div>
      \`}
    </div>
  \`;
}

// Opens the Create Delivery Receipt Modal
function openCreateDeliveryReceiptModal(preselectedSoId) {
  const eligibleOrders = (state.outboundOrders || []).filter((so) => {
    if (so.status === 'CANCELLED' || so.status === 'DRAFT' || so.status === 'FULFILLED') return false;
    const hasRemaining = (so.items || []).some((i) => i.product?.type !== 'SERVICE' && (i.quantity - i.quantityShipped) > 0);
    return hasRemaining;
  });

  if (!eligibleOrders.length) {
    showToast('No sales invoices awaiting delivery. Please create and confirm a sales invoice first.', 'warning');
    return;
  }

  const sessionLatestDr = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('last_dr_number') : null;
  const latestDr = sessionLatestDr || ((state.deliveryReceipts && state.deliveryReceipts.length)
    ? state.deliveryReceipts[0].drNumber
    : null);
  const nextDrNumber = generateNextSequence(latestDr, 'DR-');

  let soOptions = eligibleOrders.map((so) => {
    const isSel = so.id === selectedSoId ? 'selected' : '';
    const cust = so.customer?.name || 'Customer';
    return \`<option value="\${so.id}" \${isSel}>\${formatSiNumber(so.siNumber || so.soNumber)} — \${escapeHtml(cust)} (\${so.status})</option>\`;
  }).join('');

  const body = \`
    <form id="form-create-dr" onsubmit="submitCreateDeliveryReceipt(event)">
      <div class="form-group">
        <label class="form-label">DR Number *</label>
        <input type="text" id="cdr-drnumber" class="form-input" value="\${nextDrNumber}" placeholder="e.g. DR-1001" required />
      </div>

      <div class="form-group">
        <label class="form-label">Select Sales Invoice to Deliver *</label>
        <select id="cdr-so-select" class="form-select" onchange="handleDeliveryReceiptSoChange()">
          \${soOptions}
        </select>
      </div>

      <div id="cdr-order-details" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem 1rem; margin-bottom: 1.15rem; font-size: 0.84rem; color: #475569;">
        <!-- Dynamically rendered -->
      </div>

      <div class="form-group">
        <label class="form-label">Items to Deliver *</label>
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
          <table class="data-table" style="margin: 0;">
            <thead>
              <tr>
                <th>Product</th>
                <th style="width: 80px;">Ordered</th>
                <th style="width: 80px;">Delivered</th>
                <th style="width: 90px;">Stock</th>
                <th style="width: 130px;">Qty to Deliver</th>
              </tr>
            </thead>
            <tbody id="cdr-items-tbody">
              <!-- Dynamically rendered -->
            </tbody>
          </table>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Received By (Leave blank if In Transit)</label>
          <input type="text" id="cdr-received-by" class="form-input" placeholder="Leave blank if dispatching, or enter receiver name upon handover" />
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Notes / Courier / Tracking #</label>
          <input type="text" id="cdr-notes" class="form-input" placeholder="e.g. Waybill #98124, Apexs Fleet Truck #2" />
        </div>
      </div>
    </form>
  \`;

  const footer = \`
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="document.getElementById('form-create-dr').requestSubmit()">Confirm & Issue Delivery Receipt</button>
  \`;

  openModal('Create Delivery Receipt', body, footer, 'lg');
  handleDeliveryReceiptSoChange();
}

function handleDeliveryReceiptSoChange() {
  const soSelect = document.getElementById('cdr-so-select');
  if (!soSelect) return;
  const soId = soSelect.value;
  const so = (state.outboundOrders || []).find((o) => o.id === soId);
  if (!so) return;

  const detailsEl = document.getElementById('cdr-order-details');
  if (detailsEl) {
    const invoiceInfoHtml = '<span class="badge badge-primary" style="font-size: 0.72rem;"><span class="badge-dot"></span>Sales Invoice: ' + formatSiNumber(so.siNumber || so.soNumber) + '</span>';

    detailsEl.innerHTML = \`
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <strong>Customer:</strong> \${escapeHtml(so.customer?.name || 'Customer')}
          \${so.customer?.shippingAddress ? '<span style="color: #64748b;"> — ' + escapeHtml(so.customer.shippingAddress) + '</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span>Order Total: <strong>\${formatCurrency(so.totalAmountCents, so.currency)}</strong></span>
          \${outboundStatusBadge(so.status)}
          \${invoiceInfoHtml}
        </div>
      </div>
    \`;
  }

  const tbody = document.getElementById('cdr-items-tbody');
  if (!tbody) return;

  tbody.innerHTML = (so.items || []).map((item) => {
    const isService = item.product?.type === 'SERVICE';
    const remaining = isService ? 0 : (item.quantity - item.quantityShipped);
    const onHand = isService ? 0 : outboundOnHandStock(item.productId);
    const maxDeliverable = isService ? 0 : Math.max(0, Math.min(remaining, onHand));
    const isCompleted = isService || remaining <= 0;

    let inputHtml = '';
    if (isService) {
      inputHtml = '<span class="badge badge-success" style="font-size: 0.72rem;">✓ Service (N/A)</span>';
    } else if (isCompleted) {
      inputHtml = '<span class="badge badge-success" style="font-size: 0.72rem;">Delivered</span>';
    } else if (onHand <= 0) {
      inputHtml = '<span class="badge badge-danger" style="font-size: 0.72rem;">Out of Stock</span>';
    } else {
      inputHtml = \`
        <input
          type="number"
          class="form-input cdr-qty-input"
          data-soitemid="\${item.id}"
          data-max="\${maxDeliverable}"
          value="\${maxDeliverable}"
          min="0"
          max="\${maxDeliverable}"
          style="padding: 0.35rem 0.5rem; font-size: 0.85rem;"
        />
      \`;
    }

    return \`
      <tr>
        <td>
          <div style="font-weight: 600;">\${escapeHtml(item.product?.name || 'Product')}</div>
          <div style="font-size: 0.74rem; color: #94a3b8;">SKU: \${item.product?.sku || '—'}</div>
        </td>
        <td>\${item.quantity}</td>
        <td>\${item.quantityShipped}</td>
        <td>
          <span style="font-weight: 600; color: \${onHand >= remaining ? 'var(--text-main)' : '#dc2626'};">
            \${onHand}
          </span>
        </td>
        <td>\${inputHtml}</td>
      </tr>
    \`;
  }).join('');
}

async function submitCreateDeliveryReceipt(e) {
  e.preventDefault();
  const soSelect = document.getElementById('cdr-so-select');
  if (!soSelect) return;
  const soId = soSelect.value;

  const inputs = document.querySelectorAll('#form-create-dr .cdr-qty-input');
  const items = [];
  inputs.forEach((inp) => {
    const qty = parseInt(inp.value, 10) || 0;
    if (qty > 0) {
      items.push({ soItemId: inp.dataset.soitemid, quantityShipped: qty });
    }
  });

  if (!items.length) {
    showToast('Please enter at least one item quantity to deliver', 'warning');
    return;
  }

  const so = (state.outboundOrders || []).find((o) => o.id === soId);
  const activeInvoice = (so?.invoices || []).find((i) => i.status !== 'CANCELLED');
  const drNumberInput = document.getElementById('cdr-drnumber');
  const drNumber = drNumberInput ? drNumberInput.value.trim() : '';

  const payload = {
    drNumber: drNumber || undefined,
    salesOrderId: soId,
    invoiceId: activeInvoice ? activeInvoice.id : undefined,
    receivedBy: document.getElementById('cdr-received-by').value || undefined,
    notes: document.getElementById('cdr-notes').value || undefined,
    items,
  };

  try {
    const res = await apiFetch('/api/outbound/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create delivery receipt');

    closeModal();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('last_dr_number', json.drNumber);
    }
    if (json) {
      if (!state.deliveryReceipts) state.deliveryReceipts = [];
      state.deliveryReceipts.unshift({
        id: json.deliveryReceiptId,
        drNumber: json.drNumber,
        salesOrderId: soId,
        invoiceId: json.invoiceId,
        receivedBy: document.getElementById('cdr-received-by') ? document.getElementById('cdr-received-by').value : '',
        status: json.deliveryStatus || (document.getElementById('cdr-received-by')?.value ? 'COMPLETED' : 'IN_TRANSIT'),
        arrivedAt: (document.getElementById('cdr-received-by')?.value) ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
      });
    }
    showToast('Delivery Receipt ' + json.drNumber + ' issued — stock deducted', 'success');
    loadOutbound();
    if (typeof loadSales === 'function' && state.activeTab === 'sales') {
      loadSales();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}



// Renders the 100% exact replica official Delivery Receipt markup
function renderOfficialDeliveryReceiptMarkup(dr) {
  if (!dr) return '';

  var so = dr.salesOrder || {};
  var cust = so.customer || (state.customers || []).find(function(c) { return c.id === so.customerId; }) || {};
  var rawDate = dr.deliveredAt || dr.createdAt;
  var dateStr = new Date(rawDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Sales Invoice (SI) Number (PO is for Purchasing only)
  var siNumber = formatSiNumber(so.siNumber || so.soNumber || '—');

  var customerName = (cust.name || 'Customer').toUpperCase();
  var customerAddress = (cust.shippingAddress || cust.billingAddress || 'No address specified').toUpperCase();

  var items = dr.items || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (_) { items = []; }
  }
  var totalAmountCents = 0;
  var itemRowsHtml = '';

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var qty = it.quantity || 1;
    var sku = (it.product && it.product.sku) ? it.product.sku : '';
    var name = (it.product && it.product.name) ? it.product.name : 'Product';

    var unitCents = it.unitPriceCents;
    if (unitCents === undefined || unitCents === null) {
      unitCents = (it.product && it.product.sellingPriceCents) ? it.product.sellingPriceCents : 0;
    }
    var lineAmountCents = qty * unitCents;
    totalAmountCents += lineAmountCents;

    var unitPriceFormatted = ((unitCents / 100)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    var lineAmountFormatted = ((lineAmountCents / 100)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    itemRowsHtml +=
      '<tr style="height: 22px;">' +
      '<td style="border: 1.5px solid #000000; text-align: center; padding: 2px 6px; font-weight: 600;">' + qty + '</td>' +
      '<td style="border: 1.5px solid #000000; text-align: center; padding: 2px 6px; font-weight: 600;">' + escapeHtml(sku) + '</td>' +
      '<td style="border: 1.5px solid #000000; text-align: left; padding: 2px 8px;">' + escapeHtml(name) + '</td>' +
      '<td style="border: 1.5px solid #000000; text-align: right; padding: 2px 8px; font-family: JetBrains Mono, Arial, monospace;">' + unitPriceFormatted + '</td>' +
      '<td style="border: 1.5px solid #000000; text-align: right; padding: 2px 8px; font-family: JetBrains Mono, Arial, monospace;">' + lineAmountFormatted + '</td>' +
      '</tr>';
  }

  // Delimiter row: ~~ Nothing follows~~
  var delimiterRowHtml =
    '<tr style="height: 22px;">' +
    '<td style="border: 1.5px solid #000000; padding: 2px 6px;"></td>' +
    '<td style="border: 1.5px solid #000000; padding: 2px 6px;"></td>' +
    '<td style="border: 1.5px solid #000000; text-align: center; font-style: italic; padding: 2px 6px; font-size: 0.8rem; font-family: Arial, sans-serif;">~~ Nothing follows~~</td>' +
    '<td style="border: 1.5px solid #000000; text-align: right; padding: 2px 8px;">-</td>' +
    '<td style="border: 1.5px solid #000000; text-align: right; padding: 2px 8px;">-</td>' +
    '</tr>';

  // Filler rows: standard 14 rows total (matching the scanned paper form)
  var renderedCount = items.length + 1;
  var fillerCount = Math.max(0, 14 - renderedCount);
  var fillerRowsHtml = '';
  for (var f = 0; f < fillerCount; f++) {
    fillerRowsHtml +=
      '<tr style="height: 22px;">' +
      '<td style="border: 1.5px solid #000000; padding: 2px 6px;"></td>' +
      '<td style="border: 1.5px solid #000000; padding: 2px 6px;"></td>' +
      '<td style="border: 1.5px solid #000000; padding: 2px 6px;"></td>' +
      '<td style="border: 1.5px solid #000000; padding: 2px 8px;"></td>' +
      '<td style="border: 1.5px solid #000000; text-align: right; padding: 2px 8px;">-</td>' +
      '</tr>';
  }

  var totalFormatted = ((totalAmountCents / 100)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    '<div class="official-dr-sheet" id="dr-slip-printable">' +
    '<!-- 1. APEXS Header with Official Brand Logo & Corporate Typography (matching voucher slip) -->' +
    '<div style="display: flex; justify-content: center; align-items: center; gap: 1.15rem; margin-bottom: 0.35rem;">' +
    '<img src="/assets/logo.png" alt="APEXS, INC. Logo" style="height: 52px; width: auto; object-fit: contain; flex-shrink: 0;" />' +
    '<div>' +
    '<div style="font-family: Arial, Helvetica, sans-serif; font-weight: 900; font-style: italic; color: #cc2222; font-size: 1.45rem; letter-spacing: 0.5px; line-height: 1.1;">APEXS, INC.</div>' +
    '<div style="font-family: Times New Roman, Times, Georgia, serif; font-weight: 700; font-style: normal; color: #111111; font-size: 0.95rem; line-height: 1.2; margin-top: 2px;">Applied Expert Systems & Software, Inc.</div>' +
    '<div style="font-family: Brush Script MT, Segoe Script, Apple Chancery, cursive, italic; font-style: italic; font-weight: 600; color: #1d4ed8; font-size: 1.05rem; line-height: 1.2; margin-top: 2px;">We put technology to work for you</div>' +
    '</div>' +
    '</div>' +
    '<!-- 2. Address & Website (Enhanced Placement) -->' +
    '<div style="text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 0.74rem; font-weight: 600; color: #1e293b; line-height: 1.35; margin-bottom: 1.15rem;">' +
    '<div>Suite 714, EGI City by the Sea, Maribago</div>' +
    '<div>Lapu-Lapu City</div>' +
    '<div style="margin-top: 2px;">' +
    '<a href="http://www.apexvalue.com" target="_blank" style="color: #0000ee; text-decoration: underline; font-weight: 600; font-size: 0.74rem;">www.apexvalue.com</a>' +
    '</div>' +
    '</div>' +
    '<!-- 3. Delivery Receipt Number Line -->' +
    '<div style="font-family: Arial, Helvetica, sans-serif; font-size: 0.85rem; font-weight: 700; color: #000000; margin-bottom: 1.25rem; display: flex; align-items: baseline;">' +
    '<span>DELIVERY RECEIPT NO:</span>' +
    '<span style="margin-left: 1.5rem; font-size: 0.95rem; font-weight: 800; font-family: Arial, Helvetica, sans-serif;">' + escapeHtml(dr.drNumber) + '</span>' +
    '</div>' +
    '<!-- 4. Customer & Shipping Reference Details Grid -->' +
    '<div style="display: grid; grid-template-columns: 1.25fr 0.75fr; column-gap: 2rem; row-gap: 0.35rem; font-family: Arial, Helvetica, sans-serif; font-size: 0.82rem; color: #000000;">' +
    '<div style="display: flex; align-items: baseline;">' +
    '<span style="font-weight: 700; min-width: 95px;">DELIVER TO:</span>' +
    '<span style="font-weight: 700; text-transform: uppercase;">' + escapeHtml(customerName) + '</span>' +
    '</div>' +
    '<div style="display: flex; align-items: baseline; justify-content: flex-end;">' +
    '<span style="font-weight: 700; min-width: 60px;">DATE:</span>' +
    '<span style="font-weight: 700; min-width: 140px; text-align: left;">' + dateStr + '</span>' +
    '</div>' +
    '<div style="display: flex; align-items: baseline;">' +
    '<span style="font-weight: 700; min-width: 95px;">ADDRESS:</span>' +
    '<span style="font-weight: 700; text-transform: uppercase; border-bottom: 1.5px solid #000000; flex: 1; padding-bottom: 1px;">' + escapeHtml(customerAddress) + '</span>' +
    '</div>' +
    '<div style="display: flex; align-items: baseline; justify-content: flex-end;">' +
    '<span style="font-weight: 700; min-width: 60px;">SI#</span>' +
    '<span style="font-weight: 700; min-width: 140px; border-bottom: 2px solid #000000; padding-bottom: 1px;">' + escapeHtml(siNumber) + '</span>' +
    '</div>' +
    '</div>' +
    '<!-- 5. Horizontal Accent Bar Above Table Left Columns -->' +
    '<div style="width: 68%; height: 3.5px; background: #000000; margin-top: 0.5rem; margin-bottom: 0.4rem;"></div>' +
    '<!-- 6. Official 5-Column Line Items Grid -->' +
    '<table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000000; font-family: Arial, Helvetica, sans-serif; font-size: 0.82rem; color: #000000;">' +
    '<thead>' +
    '<tr style="height: 26px; border-bottom: 1.5px solid #000000;">' +
    '<th style="border: 1.5px solid #000000; width: 8%; text-align: center; font-weight: 700; padding: 4px 6px;">QTY</th>' +
    '<th style="border: 1.5px solid #000000; width: 12%; text-align: center; font-weight: 700; padding: 4px 6px;">PART #</th>' +
    '<th style="border: 1.5px solid #000000; width: 48%; text-align: center; font-weight: 700; padding: 4px 6px;">DESCRIPTIONS</th>' +
    '<th style="border: 1.5px solid #000000; width: 16%; text-align: center; font-weight: 700; padding: 4px 6px;">UNIT PRICE</th>' +
    '<th style="border: 1.5px solid #000000; width: 16%; text-align: center; font-weight: 700; padding: 4px 6px;">AMOUNT</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' +
    itemRowsHtml +
    delimiterRowHtml +
    fillerRowsHtml +
    '</tbody>' +
    '</table>' +
    '<!-- 7. Total Amount Box with Accounting Double Underline -->' +
    '<div style="display: flex; justify-content: flex-end; margin-top: -1.5px;">' +
    '<div style="width: 16%; border: 1.5px solid #000000; border-top: none; border-bottom: 3px double #000000; padding: 3px 8px; text-align: right; font-weight: 800; font-size: 0.88rem; font-family: JetBrains Mono, Arial, monospace; box-sizing: border-box;">' +
    totalFormatted +
    '</div>' +
    '</div>' +
    '<!-- 8. Received Acknowledgement & Signatures -->' +
    '<div style="margin-top: 2.25rem; font-family: Arial, Helvetica, sans-serif; color: #000000;">' +
    '<div style="font-weight: 700; font-size: 0.82rem; letter-spacing: 0.01em; margin-bottom: 2.25rem;">' +
    'RECEIVED THE ABOVE ITEMS IN GOOD ORDER AND CONDITION:' +
    '</div>' +
    '<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1.65rem; padding-right: 0.5rem;">' +
    '<div style="display: flex; flex-direction: column; align-items: flex-end;">' +
    '<div style="display: flex; align-items: flex-end; gap: 0.75rem;">' +
    '<span style="font-weight: 700; font-size: 0.82rem; min-width: 45px; text-align: right;">BY:</span>' +
    '<div style="width: 290px; border-bottom: 2px solid #000000;"></div>' +
    '</div>' +
    '<div style="width: 290px; text-align: center; font-weight: 700; font-size: 0.72rem; margin-top: 4px; letter-spacing: 0.03em;">' +
    'SIGNATURE OVER PRINTED NAME' +
    '</div>' +
    '</div>' +
    '<div style="display: flex; align-items: flex-end; gap: 0.75rem;">' +
    '<span style="font-weight: 700; font-size: 0.82rem; min-width: 45px; text-align: right;">DATE:</span>' +
    '<div style="width: 290px; border-bottom: 2px solid #000000;"></div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

// Generates official PDF blob using html2pdf
async function generateDeliveryReceiptPdfBlob(dr) {
  if (!dr) return null;
  var tempDiv = document.createElement('div');
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  tempDiv.style.width = '800px';
  tempDiv.style.background = '#ffffff';
  tempDiv.innerHTML = renderOfficialDeliveryReceiptMarkup(dr);
  document.body.appendChild(tempDiv);

  var cleanNum = (dr.drNumber || 'DR').replace(/[^a-zA-Z0-9_-]/g, '_');
  var custName = (dr.salesOrder && dr.salesOrder.customer && dr.salesOrder.customer.name ? dr.salesOrder.customer.name : '').replace(/[^a-zA-Z0-9_-]/g, '_');
  var filename = 'Delivery_Receipt_' + cleanNum + (custName ? '_' + custName : '') + '.pdf';

  var opt = {
    margin: [15, 15, 12, 15],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
  };

  try {
    if (typeof html2pdf !== 'undefined') {
      var targetEl = tempDiv.querySelector('.official-dr-sheet') || tempDiv;
      var pdfBlob = await html2pdf().set(opt).from(targetEl).output('blob');
      if (tempDiv.parentNode) document.body.removeChild(tempDiv);
      return { blob: pdfBlob, filename: filename };
    } else {
      if (tempDiv.parentNode) document.body.removeChild(tempDiv);
      return null;
    }
  } catch (err) {
    console.error('PDF generation error for Delivery Receipt:', dr.drNumber, err);
    if (tempDiv.parentNode) document.body.removeChild(tempDiv);
    return null;
  }
}

async function downloadSingleDeliveryReceiptPdf(drId) {
  var dr = (state.deliveryReceipts || []).find(function(r) { return r.id === drId; });
  if (!dr) {
    showToast('Delivery Receipt not found', 'warning');
    return;
  }
  showToast('Generating PDF for ' + dr.drNumber + '...', 'info');
  try {
    var result = await generateDeliveryReceiptPdfBlob(dr);
    if (result && result.blob) {
      var url = URL.createObjectURL(result.blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 300);
      showToast('PDF downloaded successfully!', 'success');
    } else {
      window.print();
    }
  } catch (err) {
    showToast('Failed to generate PDF: ' + err.message, 'danger');
  }
}

// Modal displaying the 100% exact replica official Delivery Receipt Slip
function openDeliveryReceiptSlipModal(drId) {
  var dr = (state.deliveryReceipts || []).find(function(r) { return r.id === drId; });
  if (!dr && state.salesOrders) {
    for (var s = 0; s < state.salesOrders.length; s++) {
      var found = (state.salesOrders[s].deliveryReceipts || []).find(function(r) { return r.id === drId; });
      if (found) {
        dr = Object.assign({}, found, { salesOrder: state.salesOrders[s] });
        break;
      }
    }
  }
  if (!dr) {
    showToast('Delivery Receipt not found', 'warning');
    return;
  }

  var body = renderOfficialDeliveryReceiptMarkup(dr);

  var footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>' +
    '<button type="button" class="btn btn-secondary" onclick="downloadSingleDeliveryReceiptPdf(&quot;' + dr.id + '&quot;)">📥 Download PDF</button>' +
    '<button type="button" class="btn btn-primary" onclick="window.print()">🖨️ Print Slip</button>';

  openModal('Delivery Receipt — ' + dr.drNumber, body, footer, 'xl');
}

// Modal to mark a Delivery Receipt as Arrived and Completed
function openMarkDeliveryArrivedModal(drId) {
  var dr = (state.deliveryReceipts || []).find(function(r) { return r.id === drId; });
  if (!dr && state.salesOrders) {
    for (var s = 0; s < state.salesOrders.length; s++) {
      var found = (state.salesOrders[s].deliveryReceipts || []).find(function(r) { return r.id === drId; });
      if (found) {
        dr = Object.assign({}, found, { salesOrder: state.salesOrders[s] });
        break;
      }
    }
  }
  if (!dr) {
    showToast('Delivery Receipt not found', 'warning');
    return;
  }

  var custName = (dr.salesOrder && dr.salesOrder.customer && dr.salesOrder.customer.name) ? dr.salesOrder.customer.name : 'Customer';
  var siNum = formatSiNumber(dr.salesOrder ? (dr.salesOrder.siNumber || dr.salesOrder.soNumber || 'SI') : 'SI');
  var d = new Date();
  var pad = function(n) { return (n < 10 ? '0' : '') + n; };
  var localIso = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());

  var itemsListHtml = (dr.items || []).map(function(i) {
    var pName = (i.product && i.product.name) ? i.product.name : 'Product';
    return '<li style="margin-bottom: 0.25rem;"><strong>' + i.quantity + 'x</strong> ' + escapeHtml(pName) + '</li>';
  }).join('');

  var body =
    '<form id="form-mark-arrived" data-drid="' + dr.id + '" onsubmit="submitMarkDeliveryArrived(event)">' +
      '<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-sm); padding: 0.85rem 1rem; margin-bottom: 1.15rem; font-size: 0.84rem; color: #1e40af;">' +
        '<div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.35rem;">Confirming Delivery Arrival for ' + escapeHtml(dr.drNumber) + '</div>' +
        '<div><strong>Customer:</strong> ' + escapeHtml(custName) + '</div>' +
        '<div><strong>Sales Invoice:</strong> ' + escapeHtml(siNum) + '</div>' +
        '<div style="margin-top: 0.5rem; font-weight: 600;">Delivered Goods:</div>' +
        '<ul style="margin: 0.25rem 0 0 1.25rem; padding: 0;">' + itemsListHtml + '</ul>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">Received By (Customer / Consignee Personnel) *</label>' +
        '<input type="text" id="mda-received-by" class="form-input" placeholder="e.g. John Doe / Receiving Officer" required autofocus />' +
        '<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">Name of the customer personnel who signed and accepted the goods.</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">Arrival / Handover Date & Time</label>' +
        '<input type="datetime-local" id="mda-arrived-at" class="form-input" value="' + localIso + '" />' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">Arrival Notes / Remarks (Optional)</label>' +
        '<textarea id="mda-notes" class="form-input" rows="2" placeholder="e.g. Received in good order and condition, signed delivery receipt returned"></textarea>' +
      '</div>' +
    '</form>';

  var footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="submit" form="form-mark-arrived" class="btn btn-success">✅ Confirm Arrival & Complete</button>';

  openModal('Mark Delivery as Arrived — ' + dr.drNumber, body, footer, 'md');
}

async function submitMarkDeliveryArrived(e) {
  if (e && e.preventDefault) e.preventDefault();

  var form = document.getElementById('form-mark-arrived');
  var drId = form ? form.dataset.drid : '';
  if (!drId) {
    showToast('Delivery receipt identifier missing', 'warning');
    return;
  }
  var arrivedAtInput = document.getElementById('mda-arrived-at');
  var notesInput = document.getElementById('mda-notes');

  var receivedBy = receivedByInput ? receivedByInput.value.trim() : '';
  if (!receivedBy) {
    showToast('Please enter the name of the person who received the goods.', 'warning');
    return;
  }

  var arrivedAt = (arrivedAtInput && arrivedAtInput.value) ? new Date(arrivedAtInput.value).toISOString() : new Date().toISOString();
  var notes = notesInput ? notesInput.value.trim() : '';

  try {
    var res = await apiFetch('/api/outbound/receipts/' + encodeURIComponent(drId) + '/mark-arrived', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receivedBy: receivedBy,
        arrivedAt: arrivedAt,
        notes: notes || undefined,
      }),
    });
    var json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update delivery status');

    closeModal();
    showToast('Delivery Receipt marked as Arrived and Completed!', 'success');
    loadOutbound();
    if (typeof loadSales === 'function' && state.activeTab === 'sales') {
      loadSales();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

window.renderOfficialDeliveryReceiptMarkup = renderOfficialDeliveryReceiptMarkup;
window.openDeliveryReceiptSlipModal = openDeliveryReceiptSlipModal;
window.downloadSingleDeliveryReceiptPdf = downloadSingleDeliveryReceiptPdf;
window.openMarkDeliveryArrivedModal = openMarkDeliveryArrivedModal;
window.submitMarkDeliveryArrived = submitMarkDeliveryArrived;
`;


