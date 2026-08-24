export function renderOutboundView(): string {
  return `<div id="view-outbound" class="tab-view" style="display: none;"></div>`;
}

export const OUTBOUND_CLIENT_JS = `
async function loadOutbound() {
  const container = document.getElementById('view-outbound');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading outbound deliveries...</div>';

  try {
    const [ordersRes, productsRes] = await Promise.all([
      apiFetch('/api/outbound/orders'),
      apiFetch('/api/inventory/products'),
    ]);
    const ordersJson = await ordersRes.json();
    const productsJson = await productsRes.json();
    if (!ordersRes.ok || !ordersJson.success) throw new Error(ordersJson.error || 'Failed to load outbound deliveries');

    state.outboundOrders = ordersJson.data || [];
    state.products = productsJson.data || [];

    if (!state.outboundOrders.length) {
      container.innerHTML = '<div class="panel-card" style="padding: 2rem; text-align: center; color: #64748b;">No sales orders awaiting outbound tracking. Confirmed orders appear here automatically.</div>';
      return;
    }

    container.innerHTML = '<div style="display: flex; flex-direction: column; gap: 1.1rem;">' + state.outboundOrders.map(renderOutboundCard).join('') + '</div>';
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading outbound deliveries: \${err.message}</div>\`;
  }
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

function outboundOnHandStock(productId) {
  const p = state.products.find((x) => x.id === productId);
  return p ? p.onHandStock : 0;
}

function renderOutboundCard(so) {
  const canMarkPacked = so.status === 'CONFIRMED';
  const canConfirmShipped = so.status === 'PACKED' || so.status === 'PARTIALLY_FULFILLED';
  const isFullyShipped = so.status === 'FULFILLED';

  let actionHtml = '';
  if (canMarkPacked) {
    actionHtml = \`<button type="button" class="btn btn-primary btn-sm" onclick="markSOPacked('\${so.id}')">Mark as Packed</button>\`;
  } else if (canConfirmShipped) {
    actionHtml = '<button type="submit" class="btn btn-success btn-sm">Confirm Shipped Quantity</button>';
  } else if (isFullyShipped) {
    actionHtml = '<span class="badge badge-success">Fully Shipped</span>';
  }

  const itemRows = so.items.map((item) => {
    const remaining = item.quantity - item.quantityShipped;
    const onHand = outboundOnHandStock(item.productId);
    let qtyCell;
    if (canConfirmShipped && remaining > 0) {
      const cap = Math.max(0, Math.min(remaining, onHand));
      qtyCell = \`
        <input type="number" class="form-input outbound-qty-input" data-soitemid="\${item.id}" value="\${cap}" min="0" max="\${cap}" style="width: 100px;" />
        <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.2rem;">\${onHand} in stock</div>
      \`;
    } else if (remaining > 0) {
      qtyCell = '<span style="color: #94a3b8;">—</span>';
    } else {
      qtyCell = '<span class="badge badge-success" style="font-size: 0.7rem;">Complete</span>';
    }
    return \`
      <tr>
        <td>\${item.product?.name || 'Product'}</td>
        <td>\${item.quantity}</td>
        <td>\${item.quantityShipped}</td>
        <td>\${qtyCell}</td>
      </tr>
    \`;
  }).join('');

  const cardInner = \`
    <div class="panel-header">
      <div class="panel-title">
        \${so.soNumber} — \${so.customer?.name || 'Unknown Customer'}
        <div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.3rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>Order Total: \${formatCurrency(so.totalAmountCents)}</span>
          \${outboundStatusBadge(so.status)}
        </div>
      </div>
      <div class="panel-actions">\${actionHtml}</div>
    </div>
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Ordered</th>
            <th>Shipped</th>
            <th>\${canConfirmShipped ? 'Qty to Ship' : 'Remaining'}</th>
          </tr>
        </thead>
        <tbody>\${itemRows}</tbody>
      </table>
    </div>
  \`;

  if (canConfirmShipped) {
    return \`<form class="panel-card" onsubmit="submitConfirmShipped(event, '\${so.id}')">\${cardInner}</form>\`;
  }
  return \`<div class="panel-card">\${cardInner}</div>\`;
}

async function markSOPacked(soId) {
  try {
    const res = await apiFetch('/api/outbound/orders/' + soId + '/mark-packed', { method: 'POST' });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to mark as packed');

    showToast('Sales Order marked as packed', 'success');
    loadOutbound();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function submitConfirmShipped(e, soId) {
  e.preventDefault();
  const inputs = e.target.querySelectorAll('.outbound-qty-input');
  const items = [];
  inputs.forEach((inp) => {
    const qty = parseInt(inp.value, 10) || 0;
    if (qty > 0) {
      items.push({ soItemId: inp.dataset.soitemid, quantityShipped: qty });
    }
  });

  if (!items.length) {
    showToast('Enter at least one quantity to ship', 'warning');
    return;
  }

  try {
    const res = await apiFetch('/api/outbound/orders/' + soId + '/ship', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to confirm shipped quantity');

    showToast('Shipment confirmed, invoice ' + json.invoiceNumber + ' issued', 'success');
    loadOutbound();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
