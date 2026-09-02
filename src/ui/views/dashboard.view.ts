export function renderDashboardView(): string {
  return `<div id="view-dashboard" class="tab-view"></div>`;
}

export const DASHBOARD_CLIENT_JS = `
async function loadDashboard() {
  const container = document.getElementById('view-dashboard');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading metrics...</div>';

  try {
    const [dashRes, tbRes] = await Promise.all([
      apiFetch('/api/dashboard'),
      apiFetch('/api/accounting/trial-balance'),
    ]);
    const dashData = await dashRes.json();
    const tbData = await tbRes.json();

    const kpis = dashData.kpis || {};

    container.innerHTML = \`
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-content">
            <h3>Inventory Valuation</h3>
            <div class="kpi-value">\${formatCurrencyBreakdown(kpis.inventoryValuationByCurrency)}</div>
            <div class="kpi-sub">\${kpis.totalProducts || 0} active SKU items</div>
          </div>
          <div class="kpi-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-content">
            <h3>Total Sales Revenue</h3>
            <div class="kpi-value">\${formatCurrencyBreakdown(kpis.salesRevenueByCurrency)}</div>
            <div class="kpi-sub">\${kpis.totalCustomers || 0} registered clients</div>
          </div>
          <div class="kpi-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-content">
            <h3>Purchase Commitments</h3>
            <div class="kpi-value">\${formatCurrencyBreakdown(kpis.purchaseCommitmentByCurrency)}</div>
            <div class="kpi-sub">\${kpis.totalVendors || 0} active suppliers</div>
          </div>
          <div class="kpi-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-content">
            <h3>Payroll Disbursed</h3>
            <div class="kpi-value">\${formatCurrency(kpis.totalPayrollPaidCents)}</div>
            <div class="kpi-sub">\${kpis.activeEmployees || 0} active staff</div>
          </div>
          <div class="kpi-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
        </div>
      </div>

      <!-- Quick Action Bar -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Quick Actions</div>
        </div>
        <div style="padding: 1.15rem 1.35rem; display: flex; gap: 0.65rem; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" onclick="openNewProductModal()">Add Product</button>
          <button class="btn btn-primary btn-sm" onclick="openNewPOModal()">Create Purchase Order</button>
          <button class="btn btn-primary btn-sm" onclick="openNewSalesOrderModal()">Create Sales Order</button>
          <button class="btn btn-primary btn-sm" onclick="openNewPayrollRunModal()">Calculate Payroll</button>
          <button class="btn btn-secondary btn-sm" onclick="openNewJVModal()">Post Journal Voucher</button>
        </div>
      </div>

      <!-- Accounting Health Summary -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Double-Entry Ledger Status</div>
          <span class="badge \${tbData.isBalanced ? 'badge-success' : 'badge-danger'}">
            <span class="badge-dot"></span>
            \${tbData.isBalanced ? 'Balanced (Zero Discrepancy)' : 'Ledger Imbalance'}
          </span>
        </div>
        <div style="padding: 1.25rem 1.35rem;">
          <div style="display: flex; gap: 2.5rem; align-items: center; flex-wrap: wrap;">
            <div>
              <span style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Total Debits</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-top: 0.2rem;">\${formatCurrency(tbData.totalDebitCents)}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Total Credits</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-top: 0.2rem;">\${formatCurrency(tbData.totalCreditCents)}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Net Variance</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: \${tbData.discrepancyCents === 0 ? '#059669' : '#dc2626'}; margin-top: 0.2rem;">
                \${formatCurrency(tbData.discrepancyCents)}
              </div>
            </div>
          </div>
        </div>
      </div>
    \`;
  } catch (err) {
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading dashboard: \${err.message}</div>\`;
  }
}
`;
