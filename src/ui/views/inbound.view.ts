export function renderInboundView(): string {
  return `<div id="view-inbound" class="tab-view" style="display: none;"></div>`;
}

export const INBOUND_CLIENT_JS = `
let pendingInboundFocusPOId = null;

// Set by goToInboundForPO() when a purchase order row is clicked in the
// Purchasing tab, so switching into Inbound Deliveries opens straight into
// that PO's detail modal instead of just landing on the list.
function goToInboundForPO(poId) {
  pendingInboundFocusPOId = poId;
  switchTab('inbound');
}

async function loadInbound() {
  const container = document.getElementById('view-inbound');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading inbound deliveries...</div>';

  try {
    const res = await apiFetch('/api/inbound/orders');
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load inbound deliveries');

    state.inboundOrders = json.data || [];

    let rowsHtml = state.inboundOrders.map((po) => {
      const itemsList = po.items.map((i) => i.product?.name || 'Product').join(', ');
      const orderedTotal = po.items.reduce((acc, i) => acc + i.quantityOrdered, 0);
      const receivedTotal = po.items.reduce((acc, i) => acc + i.quantityReceived, 0);
      return \`
        <tr class="row-clickable" onclick="openInboundDetail('\${po.id}')">
          <td><strong>\${po.poNumber}</strong></td>
          <td>\${po.vendor?.name || 'Unknown'}</td>
          <td>\${inboundStatusBadge(po.status)}</td>
          <td>\${receivedTotal} / \${orderedTotal}</td>
          <td style="font-size: 0.8rem; color: #64748b;">\${itemsList}</td>
        </tr>
      \`;
    }).join('');

    container.innerHTML = \`
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Inbound Deliveries</div>
        </div>
        <p style="padding: 0 1.35rem 1rem; font-size: 0.85rem; color: #64748b;">
          Approved purchase orders appear here automatically. Click a purchase order to mark it delivered and confirm the quantities that arrived.
        </p>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Received</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              \${rowsHtml || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No purchase orders awaiting inbound tracking.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    \`;

    if (pendingInboundFocusPOId) {
      const targetId = pendingInboundFocusPOId;
      pendingInboundFocusPOId = null;
      if (state.inboundOrders.some((o) => o.id === targetId)) {
        openInboundDetail(targetId);
      } else {
        showToast('That purchase order has no inbound delivery yet', 'warning');
      }
    }
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

// Opens a purchase order's product details and delivery steps (mark as
// delivered, then confirm arrived quantities) in a modal.
function openInboundDetail(poId) {
  const po = state.inboundOrders.find((o) => o.id === poId);
  if (!po) return;

  const canMarkDelivered = po.status === 'APPROVED';
  const canConfirmQty = po.status === 'DELIVERED' || po.status === 'PARTIALLY_RECEIVED';
  const isFullyReceived = po.status === 'RECEIVED';

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

  const body = \`
    <div style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b; display: flex; align-items: center; gap: 0.6rem;">
      \${inboundStatusBadge(po.status)}
    </div>
    <form id="form-inbound-detail" onsubmit="submitConfirmQuantity(event, '\${po.id}')">
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
    </form>
  \`;

  let footer = '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';
  if (canMarkDelivered) {
    footer += \`<button type="button" class="btn btn-primary" onclick="markPODelivered('\${po.id}')">Mark as Delivered</button>\`;
  } else if (canConfirmQty) {
    footer += \`<button type="button" class="btn btn-success" onclick="document.getElementById('form-inbound-detail').requestSubmit()">Confirm Quantity Arrived</button>\`;
  } else if (isFullyReceived) {
    footer += '<span class="badge badge-success" style="align-self: center;">Fully Received</span>';
  }

  openModal(po.poNumber + ' — ' + (po.vendor?.name || 'Unknown Vendor'), body, footer, 'lg');
}

async function markPODelivered(poId) {
  try {
    const res = await apiFetch('/api/inbound/orders/' + poId + '/mark-delivered', { method: 'POST' });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to mark as delivered');

    closeModal();
    showToast('Purchase Order marked as delivered', 'success');
    loadInbound();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function submitConfirmQuantity(e, poId) {
  e.preventDefault();
  const inputs = document.querySelectorAll('#form-inbound-detail .inbound-qty-input');
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

    closeModal();
    showToast('Quantity arrived confirmed (' + json.grnNumber + ')', 'success');
    loadInbound();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
`;
