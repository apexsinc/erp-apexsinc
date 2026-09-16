export function renderDashboardView(): string {
  return `<div id="view-dashboard" class="tab-view"></div>`;
}

export const DASHBOARD_CLIENT_JS = `
let dashAnalyticsState = {
  data: null,
  tbData: null,
  currentModule: 'financial',
  currentChartStyle: 'line',
  mainChartInstance: null,
  secondaryChartInstances: []
};

async function loadDashboard() {
  const container = document.getElementById('view-dashboard');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading metrics...</div>');

  try {
    const [dashRes, tbRes] = await Promise.all([
      apiFetch('/api/dashboard'),
      apiFetch('/api/accounting/trial-balance'),
    ]);
    const dashData = await dashRes.json();
    const tbData = await tbRes.json();

    dashAnalyticsState.data = dashData;
    dashAnalyticsState.tbData = tbData;

    const kpis = dashData.kpis || {};

    container.innerHTML = \`
      <!-- 1. EXECUTIVE KPI CARDS -->
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

      <!-- 2. QUICK ACTIONS BAR -->
      <div class="panel-card" style="margin-top: 1.25rem;">
        <div class="panel-header">
          <div class="panel-title">Quick Actions</div>
        </div>
        <div style="padding: 1.15rem 1.35rem; display: flex; gap: 0.65rem; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" onclick="openNewProductModal()">Add Product</button>
          <button class="btn btn-primary btn-sm" onclick="openNewPOModal()">Create Purchase Order</button>
          <button class="btn btn-primary btn-sm" onclick="openNewSalesOrderModal()">Create Sales Invoice</button>
          <button class="btn btn-primary btn-sm" onclick="openNewPayrollRunModal()">Calculate Payroll</button>
          <button class="btn btn-secondary btn-sm" onclick="openNewPaymentVoucherModal()">New Payment Voucher</button>
        </div>
      </div>

      <!-- 3. INTERACTIVE ANALYTICS & GRAPHING SUITE -->
      <div class="dashboard-analytics-section">
        <div class="analytics-explorer-card">
          <div class="chart-toolbar">
            <div class="chart-title-group">
              <div class="chart-title-heading">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; color: var(--primary); flex-shrink: 0;">
                  <path d="M3 3v18h18"></path>
                  <path d="m19 9-5 5-4-4-3 3"></path>
                </svg>
                <span>Interactive Performance Analytics</span>
              </div>
              <div class="chart-title-sub">Select any sidebar module dataset and customize graph visualization mode in real time</div>
            </div>

            <div class="chart-controls-group">
              <!-- Feature / Sidebar Module Selector -->
              <select id="chart-module-picker" class="chart-module-select" onchange="handleDashboardModuleChange(this.value)">
                <option value="financial">🌟 Executive Financial Trajectory</option>
                <option value="inventory">📦 Inventory & Stock Distribution</option>
                <option value="purchasing">🛒 Purchasing & Vendor Spend</option>
                <option value="sales">💼 Sales Performance & Revenue</option>
                <option value="cashFlow">🧾 Cash Flow & Vouchers</option>
                <option value="staff">👥 Workforce & Payroll Allocation</option>
              </select>

              <!-- Graph Style Switcher: Line, Bar, Pie -->
              <div class="chart-style-switcher">
                <button id="btn-chart-style-line" class="chart-style-btn active" onclick="setDashboardChartStyle('line')" title="Line Graph">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; flex-shrink: 0;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                  Line Graph
                </button>
                <button id="btn-chart-style-bar" class="chart-style-btn" onclick="setDashboardChartStyle('bar')" title="Bar Graph">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; flex-shrink: 0;"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
                  Bar Graph
                </button>
                <button id="btn-chart-style-pie" class="chart-style-btn" onclick="setDashboardChartStyle('pie')" title="Pie / Donut Graph">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; flex-shrink: 0;"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                  Pie Graph
                </button>
              </div>
            </div>
          </div>

          <div class="chart-stage-body">
            <div class="chart-stage-container" style="position: relative; height: 380px; width: 100%;">
              <canvas id="dashboard-main-chart"></canvas>
            </div>
          </div>

          <!-- Dynamic Stat Strip for Selected Feature -->
          <div id="dashboard-stat-strip" class="chart-stat-strip"></div>
        </div>

        <!-- 4. CURATED MULTI-WIDGET GRAPH GRID (Sidebar Modules Overview) -->
        <div class="dashboard-secondary-grid">
          <!-- Widget 1: Cash Flow Velocity -->
          <div class="secondary-chart-card">
            <div class="secondary-chart-header">
              <div class="secondary-chart-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: var(--primary); flex-shrink: 0;"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                <span>Cash Flow: Inflow vs Outflow</span>
              </div>
              <span class="badge badge-info" style="font-size: 0.7rem; font-weight: 600;">Vouchers</span>
            </div>
            <div class="secondary-chart-body">
              <canvas id="widget-chart-cashflow"></canvas>
            </div>
          </div>

          <!-- Widget 2: Inventory Distribution -->
          <div class="secondary-chart-card">
            <div class="secondary-chart-header">
              <div class="secondary-chart-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: var(--primary); flex-shrink: 0;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                <span>Inventory Share by Category</span>
              </div>
              <span class="badge badge-primary" style="font-size: 0.7rem; font-weight: 600;">Inventory</span>
            </div>
            <div class="secondary-chart-body">
              <canvas id="widget-chart-inventory"></canvas>
            </div>
          </div>

          <!-- Widget 3: Procurement & Sales Pipeline -->
          <div class="secondary-chart-card">
            <div class="secondary-chart-header">
              <div class="secondary-chart-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: var(--primary); flex-shrink: 0;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                <span>Orders Pipeline: Sales vs Purchasing</span>
              </div>
              <span class="badge badge-warning" style="font-size: 0.7rem; font-weight: 600;">Operations</span>
            </div>
            <div class="secondary-chart-body">
              <canvas id="widget-chart-pipeline"></canvas>
            </div>
          </div>

          <!-- Widget 4: Workforce Allocation -->
          <div class="secondary-chart-card">
            <div class="secondary-chart-header">
              <div class="secondary-chart-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: var(--primary); flex-shrink: 0;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span>Workforce by Department</span>
              </div>
              <span class="badge badge-success" style="font-size: 0.7rem; font-weight: 600;">Staff & HR</span>
            </div>
            <div class="secondary-chart-body">
              <canvas id="widget-chart-staff"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. ACCOUNTING HEALTH SUMMARY -->
      <div class="panel-card" style="margin-top: 1.5rem;">
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

    // Initialize the Chart.js visual telemetry
    initDashboardVisualizations();

  } catch (err) {
    console.error('Error loading dashboard:', err);
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading dashboard: \${err.message}</div>\`;
  }
}

// Chart.js Color Themes
const CHART_PALETTE = {
  blue: '#2563eb',
  blueAlpha: 'rgba(37, 99, 235, 0.15)',
  sky: '#0ea5e9',
  skyAlpha: 'rgba(14, 165, 233, 0.15)',
  emerald: '#10b981',
  emeraldAlpha: 'rgba(16, 185, 129, 0.15)',
  amber: '#f59e0b',
  amberAlpha: 'rgba(245, 158, 11, 0.15)',
  purple: '#8b5cf6',
  purpleAlpha: 'rgba(139, 92, 246, 0.15)',
  rose: '#f43f5e',
  roseAlpha: 'rgba(244, 63, 94, 0.15)',
  slate: '#64748b',
  slices: [
    '#2563eb', '#0ea5e9', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f97316'
  ]
};

function formatPeso(val) {
  if (val === undefined || val === null || isNaN(val)) return '₱0.00';
  return '₱' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initDashboardVisualizations() {
  if (typeof Chart === 'undefined') {
    if (!window._chartLoadAttempts) window._chartLoadAttempts = 0;
    if (window._chartLoadAttempts < 20) {
      window._chartLoadAttempts++;
      setTimeout(initDashboardVisualizations, 150);
      return;
    }
    console.warn('Chart.js library is not available in window after retries');
    return;
  }
  window._chartLoadAttempts = 0;

  // Set global chart defaults
  Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  Chart.defaults.color = '#64748b';

  // Render main dynamic chart & stat strip
  renderMainDashboardChart();
  updateDashboardStatStrip();

  // Render secondary multi-widgets
  renderSecondaryDashboardCharts();
}

function handleDashboardModuleChange(moduleKey) {
  dashAnalyticsState.currentModule = moduleKey;
  renderMainDashboardChart();
  updateDashboardStatStrip();
}

function setDashboardChartStyle(style) {
  dashAnalyticsState.currentChartStyle = style;
  updateChartStyleButtons();
  renderMainDashboardChart();
}

function updateChartStyleButtons() {
  const styles = ['line', 'bar', 'pie'];
  styles.forEach((s) => {
    const btn = document.getElementById('btn-chart-style-' + s);
    if (btn) {
      if (s === dashAnalyticsState.currentChartStyle) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
}

function renderMainDashboardChart() {
  if (typeof Chart === 'undefined') return;

  const canvas = document.getElementById('dashboard-main-chart');
  if (!canvas) return;

  // Safely destroy existing main chart instance to avoid ghost rendering
  if (dashAnalyticsState.mainChartInstance) {
    try {
      dashAnalyticsState.mainChartInstance.destroy();
    } catch (e) {
      console.warn('Error destroying main chart:', e);
    }
    dashAnalyticsState.mainChartInstance = null;
  }

  const { currentModule, currentChartStyle, data } = dashAnalyticsState;
  const analytics = data?.analytics || {};
  const monthlyTrends = analytics.monthlyTrends || [];

  const ctx = canvas.getContext('2d');
  let config = null;

  // Build configuration depending on selected module & chart style
  if (currentModule === 'financial') {
    config = buildFinancialChartConfig(monthlyTrends, currentChartStyle, data?.kpis);
  } else if (currentModule === 'inventory') {
    config = buildInventoryChartConfig(analytics.inventory, currentChartStyle);
  } else if (currentModule === 'purchasing') {
    config = buildPurchasingChartConfig(analytics.purchasing, monthlyTrends, currentChartStyle);
  } else if (currentModule === 'sales') {
    config = buildSalesChartConfig(analytics.sales, monthlyTrends, currentChartStyle);
  } else if (currentModule === 'cashFlow') {
    config = buildCashFlowChartConfig(analytics.cashFlow, monthlyTrends, currentChartStyle);
  } else if (currentModule === 'staff') {
    config = buildStaffChartConfig(analytics.staff, monthlyTrends, currentChartStyle);
  }

  if (config) {
    dashAnalyticsState.mainChartInstance = new Chart(ctx, config);
  }
}

/* ========================================================================== */
/* CONFIG BUILDERS FOR EACH MODULE & STYLE                                    */
/* ========================================================================== */

function buildFinancialChartConfig(trends, style, kpis) {
  const labels = trends.map(t => t.label);

  if (style === 'pie') {
    const totalSales = trends.reduce((acc, t) => acc + t.salesCents, 0) / 100;
    const totalPurchases = trends.reduce((acc, t) => acc + t.purchasesCents, 0) / 100;
    const totalDisbursed = trends.reduce((acc, t) => acc + t.cashOutCents, 0) / 100;
    const totalPayroll = (kpis?.totalPayrollPaidCents || 0) / 100;

    return {
      type: 'doughnut',
      data: {
        labels: ['Sales Revenue', 'Procurement Commitments', 'Voucher Disbursements', 'Payroll Paid'],
        datasets: [{
          data: [totalSales, totalPurchases, totalDisbursed, totalPayroll],
          backgroundColor: [CHART_PALETTE.blue, CHART_PALETTE.amber, CHART_PALETTE.rose, CHART_PALETTE.purple],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { weight: 600 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.label + ': ' + formatPeso(ctx.raw)
            }
          }
        }
      }
    };
  }

  const isBar = style === 'bar';
  return {
    type: isBar ? 'bar' : 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Sales Revenue',
          data: trends.map(t => t.salesCents / 100),
          borderColor: CHART_PALETTE.blue,
          backgroundColor: isBar ? CHART_PALETTE.blue : CHART_PALETTE.blueAlpha,
          borderRadius: isBar ? 5 : 0,
          borderWidth: 2,
          tension: 0.35,
          fill: !isBar
        },
        {
          label: 'Procurement Spend',
          data: trends.map(t => t.purchasesCents / 100),
          borderColor: CHART_PALETTE.amber,
          backgroundColor: isBar ? CHART_PALETTE.amber : CHART_PALETTE.amberAlpha,
          borderRadius: isBar ? 5 : 0,
          borderWidth: 2,
          tension: 0.35,
          fill: !isBar
        },
        {
          label: 'Cash Disbursements',
          data: trends.map(t => t.cashOutCents / 100),
          borderColor: CHART_PALETTE.emerald,
          backgroundColor: isBar ? CHART_PALETTE.emerald : CHART_PALETTE.emeraldAlpha,
          borderRadius: isBar ? 5 : 0,
          borderWidth: 2,
          tension: 0.35,
          fill: !isBar
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { weight: 600 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + ctx.dataset.label + ': ' + formatPeso(ctx.raw)
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          min: 0,
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: (val) => {
              if (val === 0) return '₱0';
              if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return '₱' + (val / 1000).toFixed(0) + 'k';
              return '₱' + val;
            }
          }
        }
      }
    }
  };
}

function buildInventoryChartConfig(inventory, style) {
  inventory = inventory || { byCategory: [], stockHealth: {}, topProducts: [] };
  const categories = inventory.byCategory || [];

  if (style === 'pie') {
    const labels = categories.map(c => c.name);
    const data = categories.map(c => c.count);

    return {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['No Categories'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: CHART_PALETTE.slices,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { weight: 600 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.label + ': ' + ctx.raw + ' items'
            }
          }
        }
      }
    };
  }

  if (style === 'line') {
    const topProds = (inventory.topProducts || []).slice(0, 8);
    return {
      type: 'line',
      data: {
        labels: topProds.map(p => p.sku || p.name),
        datasets: [
          {
            label: 'On-Hand Stock (Units)',
            data: topProds.map(p => p.stock),
            borderColor: CHART_PALETTE.sky,
            backgroundColor: CHART_PALETTE.skyAlpha,
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                const p = topProds[idx];
                return p ? p.sku + ' — ' + p.name : '';
              },
              label: (ctx) => ' ' + ctx.raw + ' units on-hand'
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#f1f5f9' }, beginAtZero: true, min: 0 }
        }
      }
    };
  }

  // Bar Chart: SKU Count and Damaged items per category
  return {
    type: 'bar',
    data: {
      labels: categories.map(c => c.name),
      datasets: [
        {
          label: 'Total Products',
          data: categories.map(c => c.count),
          backgroundColor: CHART_PALETTE.blue,
          borderRadius: 5
        },
        {
          label: 'Damaged / Quarantine',
          data: categories.map(c => c.damagedCount),
          backgroundColor: CHART_PALETTE.rose,
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f1f5f9' }, beginAtZero: true, min: 0 }
      }
    }
  };
}

function buildPurchasingChartConfig(purchasing, trends, style) {
  purchasing = purchasing || { byStatus: {}, topVendors: [] };

  if (style === 'pie') {
    const statuses = Object.keys(purchasing.byStatus || {});
    const counts = Object.values(purchasing.byStatus || {});

    return {
      type: 'pie',
      data: {
        labels: statuses.map(s => s.replace('_', ' ')),
        datasets: [{
          data: counts.length ? counts : [0],
          backgroundColor: [CHART_PALETTE.slate, CHART_PALETTE.blue, CHART_PALETTE.sky, CHART_PALETTE.amber, CHART_PALETTE.emerald, CHART_PALETTE.rose],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }
        }
      }
    };
  }

  if (style === 'bar') {
    const vendors = purchasing.topVendors || [];
    return {
      type: 'bar',
      data: {
        labels: vendors.map(v => v.name),
        datasets: [{
          label: 'Total Spend (₱)',
          data: vendors.map(v => v.spendCents / 100),
          backgroundColor: CHART_PALETTE.amber,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ' Total Spend: ' + formatPeso(ctx.raw)
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            min: 0,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => {
                if (val === 0) return '₱0';
                if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M';
                if (val >= 1000) return '₱' + (val / 1000).toFixed(0) + 'k';
                return '₱' + val;
              }
            }
          }
        }
      }
    };
  }

  // Line Chart: Monthly Purchasing Spend
  return {
    type: 'line',
    data: {
      labels: trends.map(t => t.label),
      datasets: [{
        label: 'Procurement Spend (₱)',
        data: trends.map(t => t.purchasesCents / 100),
        borderColor: CHART_PALETTE.amber,
        backgroundColor: CHART_PALETTE.amberAlpha,
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + ctx.dataset.label + ': ' + formatPeso(ctx.raw)
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          min: 0,
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: (val) => {
              if (val === 0) return '₱0';
              if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return '₱' + (val / 1000).toFixed(0) + 'k';
              return '₱' + val;
            }
          }
        }
      }
    }
  };
}

function buildSalesChartConfig(sales, trends, style) {
  sales = sales || { byStatus: {}, topCustomers: [] };

  if (style === 'pie') {
    const statuses = Object.keys(sales.byStatus || {});
    const counts = Object.values(sales.byStatus || {});

    return {
      type: 'doughnut',
      data: {
        labels: statuses.map(s => s.replace('_', ' ')),
        datasets: [{
          data: counts.length ? counts : [0],
          backgroundColor: [CHART_PALETTE.slate, CHART_PALETTE.blue, CHART_PALETTE.sky, CHART_PALETTE.amber, CHART_PALETTE.emerald, CHART_PALETTE.rose],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }
        }
      }
    };
  }

  if (style === 'bar') {
    const customers = sales.topCustomers || [];
    return {
      type: 'bar',
      data: {
        labels: customers.map(c => c.name),
        datasets: [{
          label: 'Client Revenue (₱)',
          data: customers.map(c => c.revenueCents / 100),
          backgroundColor: CHART_PALETTE.blue,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ' Revenue: ' + formatPeso(ctx.raw)
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            min: 0,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => {
                if (val === 0) return '₱0';
                if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M';
                if (val >= 1000) return '₱' + (val / 1000).toFixed(0) + 'k';
                return '₱' + val;
              }
            }
          }
        }
      }
    };
  }

  // Line Chart: Monthly Sales Revenue
  return {
    type: 'line',
    data: {
      labels: trends.map(t => t.label),
      datasets: [{
        label: 'Invoiced Sales Revenue (₱)',
        data: trends.map(t => t.salesCents / 100),
        borderColor: CHART_PALETTE.blue,
        backgroundColor: CHART_PALETTE.blueAlpha,
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + ctx.dataset.label + ': ' + formatPeso(ctx.raw)
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          min: 0,
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: (val) => {
              if (val === 0) return '₱0';
              if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return '₱' + (val / 1000).toFixed(0) + 'k';
              return '₱' + val;
            }
          }
        }
      }
    }
  };
}

function buildCashFlowChartConfig(cashFlow, trends, style) {
  cashFlow = cashFlow || { byPaymentMethod: [], byRecipientType: [] };

  if (style === 'pie') {
    const methods = cashFlow.byPaymentMethod || [];
    return {
      type: 'doughnut',
      data: {
        labels: methods.map(m => m.method.replace('_', ' ')),
        datasets: [{
          data: methods.map(m => m.outCents / 100),
          backgroundColor: CHART_PALETTE.slices,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.label + ': ' + formatPeso(ctx.raw)
            }
          }
        }
      }
    };
  }

  if (style === 'bar') {
    const methods = cashFlow.byPaymentMethod || [];
    return {
      type: 'bar',
      data: {
        labels: methods.map(m => m.method.replace('_', ' ')),
        datasets: [
          {
            label: 'Disbursements (₱)',
            data: methods.map(m => m.outCents / 100),
            backgroundColor: CHART_PALETTE.rose,
            borderRadius: 6
          },
          {
            label: 'Receipts (₱)',
            data: methods.map(m => m.inCents / 100),
            backgroundColor: CHART_PALETTE.emerald,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.dataset.label + ': ' + formatPeso(ctx.raw)
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            min: 0,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => {
                if (val === 0) return '₱0';
                if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M';
                if (val >= 1000) return '₱' + (val / 1000).toFixed(0) + 'k';
                return '₱' + val;
              }
            }
          }
        }
      }
    };
  }

  // Line Chart: Monthly Inflow vs Outflow
  return {
    type: 'line',
    data: {
      labels: trends.map(t => t.label),
      datasets: [
        {
          label: 'Cash Inflow (Collections)',
          data: trends.map(t => t.cashInCents / 100),
          borderColor: CHART_PALETTE.emerald,
          backgroundColor: CHART_PALETTE.emeraldAlpha,
          fill: false,
          tension: 0.35,
          borderWidth: 2
        },
        {
          label: 'Cash Outflow (Disbursements)',
          data: trends.map(t => t.cashOutCents / 100),
          borderColor: CHART_PALETTE.rose,
          backgroundColor: CHART_PALETTE.roseAlpha,
          fill: false,
          tension: 0.35,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + ctx.dataset.label + ': ' + formatPeso(ctx.raw)
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          min: 0,
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: (val) => {
              if (val === 0) return '₱0';
              if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return '₱' + (val / 1000).toFixed(0) + 'k';
              return '₱' + val;
            }
          }
        }
      }
    }
  };
}

function buildStaffChartConfig(staff, trends, style) {
  staff = staff || { byDepartment: [] };
  const departments = staff.byDepartment || [];

  if (style === 'pie') {
    return {
      type: 'pie',
      data: {
        labels: departments.map(d => d.department),
        datasets: [{
          data: departments.map(d => d.count),
          backgroundColor: CHART_PALETTE.slices,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.label + ': ' + ctx.raw + ' employees'
            }
          }
        }
      }
    };
  }

  if (style === 'line') {
    return {
      type: 'line',
      data: {
        labels: trends.map(t => t.label),
        datasets: [{
          label: 'Payroll Disbursed (₱)',
          data: trends.map(t => t.payrollCents / 100),
          borderColor: CHART_PALETTE.purple,
          backgroundColor: CHART_PALETTE.purpleAlpha,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.dataset.label + ': ' + formatPeso(ctx.raw)
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            min: 0,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => {
                if (val === 0) return '₱0';
                if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M';
                if (val >= 1000) return '₱' + (val / 1000).toFixed(0) + 'k';
                return '₱' + val;
              }
            }
          }
        }
      }
    };
  }

  // Bar Chart: Active vs Total staff per department
  return {
    type: 'bar',
    data: {
      labels: departments.map(d => d.department),
      datasets: [
        {
          label: 'Active Staff',
          data: departments.map(d => d.activeCount),
          backgroundColor: CHART_PALETTE.emerald,
          borderRadius: 5
        },
        {
          label: 'Total Headcount',
          data: departments.map(d => d.count),
          backgroundColor: CHART_PALETTE.blue,
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f1f5f9' }, beginAtZero: true, min: 0 }
      }
    }
  };
}

/* ========================================================================== */
/* DYNAMIC STAT STRIP UPDATER                                                 */
/* ========================================================================== */

function updateDashboardStatStrip() {
  const container = document.getElementById('dashboard-stat-strip');
  if (!container) return;

  const { currentModule, data } = dashAnalyticsState;
  const analytics = data?.analytics || {};
  const trends = analytics.monthlyTrends || [];
  const kpis = data?.kpis || {};

  let statCards = [];

  if (currentModule === 'financial') {
    const totalSales = trends.reduce((acc, t) => acc + t.salesCents, 0);
    const totalSpend = trends.reduce((acc, t) => acc + t.purchasesCents, 0);
    const netCash = trends.reduce((acc, t) => acc + t.netCashFlowCents, 0);
    const totalDisbursed = trends.reduce((acc, t) => acc + t.cashOutCents, 0);

    statCards = [
      { label: '6-Mo Sales Revenue', value: formatPeso(totalSales / 100), hint: 'Across all order channels' },
      { label: '6-Mo Procurement', value: formatPeso(totalSpend / 100), hint: 'Total purchase order commitments' },
      { label: '6-Mo Disbursements', value: formatPeso(totalDisbursed / 100), hint: 'Cleared payment vouchers' },
      { label: 'Net Cash Flow', value: formatPeso(netCash / 100), hint: netCash >= 0 ? 'Positive operating surplus' : 'Net disbursement deficit' },
    ];
  } else if (currentModule === 'inventory') {
    const inv = analytics.inventory || {};
    const stockHealth = inv.stockHealth || {};
    const catCount = (inv.byCategory || []).length;

    statCards = [
      { label: 'Active Catalog SKUs', value: kpis.totalProducts || 0, hint: 'Registered products master' },
      { label: 'Product Categories', value: catCount, hint: 'Active classification groups' },
      { label: 'Stock Health Status', value: stockHealth.healthy + ' In-Stock', hint: (stockHealth.lowStock || 0) + ' items running low' },
      { label: 'Damaged / Quarantine', value: (stockHealth.damaged || 0) + ' Units', hint: 'Segregated from active inventory' },
    ];
  } else if (currentModule === 'purchasing') {
    const pur = analytics.purchasing || {};
    const poCount = Object.values(pur.byStatus || {}).reduce((a, b) => a + b, 0);
    const vendorCount = (pur.topVendors || []).length;

    statCards = [
      { label: 'Purchase Orders', value: poCount, hint: 'Total generated PO documents' },
      { label: 'Active Suppliers', value: kpis.totalVendors || 0, hint: 'Vetted procurement vendors' },
      { label: 'Top Vendor Share', value: pur.topVendors?.[0]?.name || '—', hint: pur.topVendors?.[0] ? formatPeso(pur.topVendors[0].spendCents / 100) : 'No commitments' },
      { label: 'Pending Deliveries', value: (pur.byStatus?.APPROVED || 0) + ' Orders', hint: 'Approved orders awaiting inbound' },
    ];
  } else if (currentModule === 'sales') {
    const sl = analytics.sales || {};
    const soCount = Object.values(sl.byStatus || {}).reduce((a, b) => a + b, 0);

    statCards = [
      { label: 'Registered Clients', value: kpis.totalCustomers || 0, hint: 'Active customer accounts' },
      { label: 'Sales Orders', value: soCount, hint: 'Total issued sales invoices' },
      { label: 'Top Client', value: sl.topCustomers?.[0]?.name || '—', hint: sl.topCustomers?.[0] ? formatPeso(sl.topCustomers[0].revenueCents / 100) : 'No client revenue' },
      { label: 'Completed Deliveries', value: (sl.byStatus?.FULFILLED || 0) + ' Orders', hint: 'Fully fulfilled invoices' },
    ];
  } else if (currentModule === 'cashFlow') {
    const cf = analytics.cashFlow || {};
    const pvCount = kpis.totalPaymentVouchersCount || 0;
    const rvCount = kpis.totalReceiptVouchersCount || 0;

    statCards = [
      { label: 'Payment Vouchers', value: pvCount, hint: 'Outbound cash & bank payouts' },
      { label: 'Receipt Vouchers', value: rvCount, hint: 'Inbound customer collections' },
      { label: 'Primary Payment Rail', value: cf.byPaymentMethod?.[0]?.method ? cf.byPaymentMethod[0].method.replace('_', ' ') : 'Bank Transfer', hint: 'Highest volume transaction method' },
      { label: 'Total Payroll Paid', value: formatCurrency(kpis.totalPayrollPaidCents), hint: 'Disbursed employee compensation' },
    ];
  } else if (currentModule === 'staff') {
    const st = analytics.staff || {};
    const deptCount = (st.byDepartment || []).length;

    statCards = [
      { label: 'Active Workforce', value: kpis.activeEmployees || 0, hint: 'Currently active headcount' },
      { label: 'Total Personnel', value: kpis.totalEmployees || 0, hint: 'All registered employee profiles' },
      { label: 'Active Departments', value: deptCount, hint: 'Functional operational divisions' },
      { label: 'Payroll Outlay', value: formatCurrency(kpis.totalPayrollPaidCents), hint: 'Cumulative finalized net pay' },
    ];
  }

  container.innerHTML = statCards.map(s => \`
    <div class="chart-stat-item">
      <div class="chart-stat-label">\${s.label}</div>
      <div class="chart-stat-value">\${s.value}</div>
      <div class="chart-stat-hint">\${s.hint}</div>
    </div>
  \`).join('');
}

/* ========================================================================== */
/* SECONDARY MULTI-WIDGET CHARTS                                              */
/* ========================================================================== */

function renderSecondaryDashboardCharts() {
  if (typeof Chart === 'undefined') return;

  // Destroy previous instances safely
  if (dashAnalyticsState.secondaryChartInstances?.length) {
    dashAnalyticsState.secondaryChartInstances.forEach(c => {
      try { c.destroy(); } catch (e) {}
    });
    dashAnalyticsState.secondaryChartInstances = [];
  }

  const { data } = dashAnalyticsState;
  const analytics = data?.analytics || {};
  const trends = analytics.monthlyTrends || [];

  // Widget 1: Cash Flow Inflow vs Outflow
  const canvasCash = document.getElementById('widget-chart-cashflow');
  if (canvasCash) {
    const chart = new Chart(canvasCash.getContext('2d'), {
      type: 'bar',
      data: {
        labels: trends.map(t => t.label.split(' ')[0]),
        datasets: [
          {
            label: 'Collections',
            data: trends.map(t => t.cashInCents / 100),
            backgroundColor: CHART_PALETTE.emerald,
            borderRadius: 4
          },
          {
            label: 'Disbursements',
            data: trends.map(t => t.cashOutCents / 100),
            backgroundColor: CHART_PALETTE.rose,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, padding: 8, font: { size: 11 } } },
          tooltip: {
            callbacks: { label: (ctx) => ' ' + ctx.dataset.label + ': ' + formatPeso(ctx.raw) }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            min: 0,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => {
                if (val === 0) return '₱0';
                if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M';
                if (val >= 1000) return '₱' + (val / 1000).toFixed(0) + 'k';
                return '₱' + val;
              }
            }
          }
        }
      }
    });
    dashAnalyticsState.secondaryChartInstances.push(chart);
  }

  // Widget 2: Inventory by Category
  const canvasInv = document.getElementById('widget-chart-inventory');
  if (canvasInv) {
    const cats = analytics.inventory?.byCategory || [];
    const chart = new Chart(canvasInv.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: cats.length ? cats.map(c => c.name) : ['No Categories'],
        datasets: [{
          data: cats.length ? cats.map(c => c.count) : [1],
          backgroundColor: CHART_PALETTE.slices,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 11 } } },
          tooltip: {
            callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + ctx.raw + ' items' }
          }
        }
      }
    });
    dashAnalyticsState.secondaryChartInstances.push(chart);
  }

  // Widget 3: Pipeline Orders (Sales vs POs Statuses)
  const canvasPipe = document.getElementById('widget-chart-pipeline');
  if (canvasPipe) {
    const soStatus = analytics.sales?.byStatus || {};
    const poStatus = analytics.purchasing?.byStatus || {};

    const chart = new Chart(canvasPipe.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Draft', 'Confirmed', 'Processing', 'Fulfilled'],
        datasets: [
          {
            label: 'Sales Orders',
            data: [
              soStatus.DRAFT || 0,
              soStatus.CONFIRMED || 0,
              soStatus.PACKED || 0,
              soStatus.FULFILLED || 0
            ],
            backgroundColor: CHART_PALETTE.blue,
            borderRadius: 4
          },
          {
            label: 'Purchase Orders',
            data: [
              poStatus.DRAFT || 0,
              poStatus.APPROVED || 0,
              (poStatus.DELIVERED || 0) + (poStatus.PARTIALLY_RECEIVED || 0),
              poStatus.RECEIVED || 0
            ],
            backgroundColor: CHART_PALETTE.amber,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, padding: 8, font: { size: 11 } } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#f1f5f9' }, beginAtZero: true, min: 0 }
        }
      }
    });
    dashAnalyticsState.secondaryChartInstances.push(chart);
  }

  // Widget 4: Workforce Allocation
  const canvasStaff = document.getElementById('widget-chart-staff');
  if (canvasStaff) {
    const depts = analytics.staff?.byDepartment || [];
    const chart = new Chart(canvasStaff.getContext('2d'), {
      type: 'pie',
      data: {
        labels: depts.length ? depts.map(d => d.department) : ['Staff'],
        datasets: [{
          data: depts.length ? depts.map(d => d.count) : [1],
          backgroundColor: CHART_PALETTE.slices,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 11 } } },
          tooltip: {
            callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + ctx.raw + ' staff' }
          }
        }
      }
    });
    dashAnalyticsState.secondaryChartInstances.push(chart);
  }
}
`;
