export function renderInboundView(): string {
  return `<div id="view-inbound" class="tab-view" style="display: none;"></div>`;
}

export const INBOUND_CLIENT_JS = `
async function loadInbound() {
  const container = document.getElementById('view-inbound');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading inbound deliveries...</div>';

  try {
    const res = await apiFetch('/api/inbound/orders');
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load inbound deliveries');

    state.inboundOrders = json.data || [];

    if (!state.inboundOrders.length) {
      container.innerHTML = '<div class="panel-card" style="padding: 2rem; text-align: center; color: #64748b;">No purchase orders awaiting inbound tracking. Approved purchase orders appear here automatically.</div>';
      return;
    }

    container.innerHTML = '<div style="display: flex; flex-direction: column; gap: 1.1rem;">' + state.inboundOrders.map(renderInboundCard).join('') + '</div>';
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading inbound deliveries: \${err.message}</div>\`;
  }
}

function inboundStatusBadge(status) {
  const map = {
    APPROVED: 'badge-primary',
    DELIVERED: 'badge-warning',
    PARTIALLY_RECEIVED: 'badge-warning',
    RECEIVED: 'badge-success',
  };
  const cls = map[status] || 'badge-neutral';
  return '<span class="badge ' + cls + '"><span class="badge-dot"></span>' + status.replace('_', ' ') + '</span>';
}

function renderInboundCard(po) {
  const canMarkDelivered = po.status === 'APPROVED';
  const canConfirmQty = po.status === 'DELIVERED' || po.status === 'PARTIALLY_RECEIVED';
  const isFullyReceived = po.status === 'RECEIVED';

  let actionHtml = '';
  if (canMarkDelivered) {
    actionHtml = \`<button type="button" class="btn btn-primary btn-sm" onclick="markPODelivered('\${po.id}')">Mark as Delivered</button>\`;
  } else if (canConfirmQty) {
    actionHtml = '<button type="submit" class="btn btn-success btn-sm">Confirm Quantity Arrived</button>';
  } else if (isFullyReceived) {
    actionHtml = '<span class="badge badge-success">Fully Received</span>';
  }

  const itemRows = po.items.map((item) => {
    const remaining = item.quantityOrdered - item.quantityReceived;
    let qtyCell;
    if (canConfirmQty && remaining > 0) {
      qtyCell = \`<input type="number" class="form-input inbound-qty-input" data-poitemid="\${item.id}" value="\${remaining}" min="0" max="\${remaining}" style="width: 100px;" />\`;
    } else if (remaining > 0) {
      qtyCell = '<span style="color: #94a3b8;">—</span>';
    } else {
      qtyCell = '<span class="badge badge-success" style="font-size: 0.7rem;">Complete</span>';
    }
    return \`
      <tr>
        <td>\${item.product?.name || 'Product'}</td>
        <td>\${item.quantityOrdered}</td>
        <td>\${item.quantityReceived}</td>
        <td>\${qtyCell}</td>
      </tr>
    \`;
  }).join('');

  const cardInner = \`
    <div class="panel-header">
      <div class="panel-title">
        \${po.poNumber} — \${po.vendor?.name || 'Unknown Vendor'}
        <div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.3rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>Expected: \${po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'}</span>
          \${inboundStatusBadge(po.status)}
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
            <th>Received</th>
            <th>\${canConfirmQty ? 'Qty Arrived' : 'Remaining'}</th>
          </tr>
        </thead>
        <tbody>\${itemRows}</tbody>
      </table>
    </div>
  \`;

  if (canConfirmQty) {
    return \`<form class="panel-card" onsubmit="submitConfirmQuantity(event, '\${po.id}')">\${cardInner}</form>\`;
  }
  return \`<div class="panel-card">\${cardInner}</div>\`;
}

async function markPODelivered(poId) {
  try {
    const res = await apiFetch('/api/inbound/orders/' + poId + '/mark-delivered', { method: 'POST' });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to mark as delivered');

    showToast('Purchase Order marked as delivered', 'success');
    loadInbound();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function submitConfirmQuantity(e, poId) {
  e.preventDefault();
  const inputs = e.target.querySelectorAll('.inbound-qty-input');
  const items = [];
  inputs.forEach((inp) => {
    const qty = parseInt(inp.value, 10) || 0;
    if (qty > 0) {
      items.push({ poItemId: inp.dataset.poitemid, quantityReceived: qty });
    }
  });

  if (!items.length) {
    showToast('Enter at least one quantity arrived', 'warning');
    return;
  }

  try {
    const res = await apiFetch('/api/inbound/orders/' + poId + '/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to confirm quantity arrived');

    showToast('Quantity arrived confirmed (' + json.grnNumber + ')', 'success');
    loadInbound();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
