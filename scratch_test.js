    
// ============================================================================
// APEXS ERP - CLIENT CONTROLLER & ROUTER
// ============================================================================

const state = {
  user: null,
  activeTab: 'dashboard',
  products: [],
  productCategories: [],
  vendors: [],
  purchaseOrders: [],
  inboundOrders: [],
  customers: [],
  salesOrders: [],
  outboundOrders: [],
  employees: [],
  payrollRuns: [],
  accounts: [],
  trialBalance: null,
  adminUsers: [],
  adminModules: [],
  adminMatrix: {},
};

// Global Utilities
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(cents, currency) {
  const symbol = currency === 'USD' ? '$' : '₱';
  if (cents === undefined || cents === null) return symbol + '0.00';
  return symbol + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Renders a { USD: cents, PHP: cents } total as "$X + ₱Y" - used for figures
// aggregated across many orders/products that may not share one currency,
// where a single summed number would silently mix units.
function formatCurrencyBreakdown(byCurrency) {
  const entries = Object.entries(byCurrency || {}).filter(([, cents]) => cents);
  if (!entries.length) return formatCurrency(0, 'PHP');
  return entries.map(([cur, cents]) => formatCurrency(cents, cur)).join(' + ');
}

// Attaches the session token to every API call and handles a revoked/expired
// session (401) by bouncing back to the login screen instead of leaving the
// UI in a broken half-authenticated state.
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('apexs_token');
  const headers = Object.assign({}, options.headers, token ? { Authorization: 'Bearer ' + token } : {});
  const res = await fetch(url, Object.assign({}, options, { headers }));

  if (res.status === 401) {
    localStorage.removeItem('apexs_token');
    localStorage.removeItem('apexs_user');
    state.user = null;
    resetAllViewLoads();
    showLogin();
    showToast('Your session has expired. Please sign in again.', 'danger');
  }

  return res;
}

// Every tab view's loadX() blanks its container to a "Loading..." placeholder
// before fetching, then rebuilds it once data arrives. That's fine the first
// time a tab is opened, but doing it again on every reload (e.g. after a
// modal form saves) tears down the whole panel and reads like a hard page
// refresh: the table disappears, then pops back in. beginViewLoad() shows the
// placeholder only once per container so a reload keeps the existing content
// on screen until the fresh render is ready to swap in.
function beginViewLoad(container, loadingHtml) {
  if (!container.dataset.loaded) {
    container.innerHTML = loadingHtml;
  }
  container.dataset.loaded = '1';
}

// Clears the "already loaded" flag on every tab view so a new sign-in (after
// a logout or an expired session) can't briefly flash the previous user's
// cached table before its own fetch completes.
function resetAllViewLoads() {
  document.querySelectorAll('.tab-view').forEach((el) => {
    delete el.dataset.loaded;
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span>' + message + '</span>';
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// URL Query Params Management
function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function setUrlParam(name, value, updateHistory = true) {
  const url = new URL(window.location.href);
  if (value === null || value === undefined || value === '') {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }
  if (updateHistory) {
    window.history.replaceState({ tab: state.activeTab }, '', url.pathname + url.search);
  }
}

function removeUrlParam(name, updateHistory = true) {
  setUrlParam(name, null, updateHistory);
}

// Universal CSV Data Export
function generateCsvString(headers, rows) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return '"' + str + '"';
  };
  return [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join(String.fromCharCode(13, 10));
}

function exportToCsv(filename, headers, rows) {
  const csvContent = generateCsvString(headers, rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : filename + '.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Exported ' + filename, 'success');
}

// Modal Manager
function openModal(title, bodyHtml, footerButtonsHtml = '', size = '') {
  const backdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');
  const modalDialog = backdrop.querySelector('.modal-dialog');

  modalTitle.innerText = title;
  modalBody.innerHTML = bodyHtml;
  modalFooter.innerHTML = footerButtonsHtml || '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';
  if (modalDialog) modalDialog.className = 'modal-dialog' + (size ? ' modal-dialog-' + size : '');
  backdrop.style.display = 'flex';
  document.body.classList.add('modal-open');
}

function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
  document.body.classList.remove('modal-open');
  if (typeof removeUrlParam === 'function' && typeof getUrlParam === 'function' && getUrlParam('slip')) {
    removeUrlParam('slip');
  }
}

function openConfirmModal(options) {
  const title = options.title || 'Confirm Action';
  const message = options.message || 'Are you sure you want to proceed?';
  const subtext = options.subtext || '';
  const confirmText = options.confirmText || 'Confirm';
  const cancelText = options.cancelText || 'Cancel';
  const type = options.type || 'danger';
  const onConfirm = options.onConfirm;
  const onCancel = options.onCancel;

  let iconSvg = options.icon || '';
  if (!iconSvg) {
    if (type === 'danger') {
      iconSvg =
        '<div style="width: 48px; height: 48px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.85rem;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>' +
        '</div>';
    } else if (type === 'warning') {
      iconSvg =
        '<div style="width: 48px; height: 48px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.85rem;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' +
        '</div>';
    } else if (type === 'success') {
      iconSvg =
        '<div style="width: 48px; height: 48px; border-radius: 50%; background: #ccfbf1; color: #0f766e; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.85rem;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' +
        '</div>';
    } else {
      iconSvg =
        '<div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.85rem;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>' +
        '</div>';
    }
  }

  const confirmBtnClass =
    type === 'danger'
      ? 'btn btn-danger'
      : type === 'warning'
      ? 'btn btn-warning'
      : type === 'success'
      ? 'btn btn-success'
      : 'btn btn-primary';

  window.__confirmModalCallback = async () => {
    closeModal();
    if (typeof onConfirm === 'function') {
      try {
        await onConfirm();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  };

  window.__cancelModalCallback = () => {
    closeModal();
    if (typeof onCancel === 'function') {
      onCancel();
    }
  };

  const body =
    '<div style="text-align: center; padding: 0.5rem 0.5rem 0.25rem;">' +
    iconSvg +
    '<h3 style="margin: 0 0 0.5rem; font-size: 1.15rem; color: #1e293b; font-weight: 700;">' +
    title +
    '</h3>' +
    '<p style="margin: 0; color: #475569; font-size: 0.9rem; line-height: 1.5;">' +
    message +
    '</p>' +
    (subtext
      ? '<div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.8rem; color: #64748b;">' +
        subtext +
        '</div>'
      : '') +
    '</div>';

  const footer =
    '<div style="display: flex; gap: 0.75rem; width: 100%; justify-content: flex-end;">' +
    '<button type="button" class="btn btn-secondary" onclick="window.__cancelModalCallback()">' +
    cancelText +
    '</button>' +
    '<button type="button" class="' +
    confirmBtnClass +
    '" onclick="window.__confirmModalCallback()">' +
    confirmText +
    '</button>' +
    '</div>';

  openModal('', body, footer, 'sm');
}

const EYE_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const EYE_OFF_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.innerHTML = showing ? EYE_ICON_SVG : EYE_OFF_ICON_SVG;
  btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
}

// Subsystem Client Logic

function onTurnstileError(code) {
  console.warn('[Cloudflare Turnstile] Challenge notice (handled):', code);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('login-btn');
  const cfTurnstileToken = typeof turnstile !== 'undefined' ? turnstile.getResponse() : undefined;

  submitBtn.disabled = true;
  submitBtn.innerText = 'Signing In...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, cfTurnstileToken }),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      showToast(json.error || 'Authentication failed', 'danger');
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In';
      if (typeof turnstile !== 'undefined') turnstile.reset();
      return;
    }

    localStorage.setItem('apexs_token', json.token);
    localStorage.setItem('apexs_user', JSON.stringify(json.user));
    state.user = json.user;

    showToast('Signed in successfully', 'success');
    showApp();
  } catch (err) {
    showToast('Network error: ' + err.message, 'danger');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Sign In';
  }
}

function handleLogout() {
  openConfirmModal({
    title: 'Sign Out',
    message: 'Are you sure you want to end your current session and sign out of Apexs ERP?',
    confirmText: 'Sign Out',
    cancelText: 'Stay Signed In',
    type: 'warning',
    onConfirm: async () => {
      const token = localStorage.getItem('apexs_token');
      localStorage.removeItem('apexs_token');
      localStorage.removeItem('apexs_user');
      state.user = null;
      resetAllViewLoads();
      showLogin();
      showToast('Signed out successfully', 'info');

      if (token) {
        try {
          await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
        } catch (_) {
          // Local session is already cleared client-side
        }
      }
    },
  });
}

function checkAuth() {
  const savedUser = localStorage.getItem('apexs_user');
  const savedToken = localStorage.getItem('apexs_token');
  if (savedUser && savedToken) {
    try {
      state.user = JSON.parse(savedUser);
      showApp();
      refreshSessionUser();
      return;
    } catch (_) {}
  }
  showLogin();
}

async function refreshSessionUser() {
  const token = localStorage.getItem('apexs_token');
  if (!token) return;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const json = await res.json();
    if (res.ok && json.success && json.user) {
      state.user = json.user;
      localStorage.setItem('apexs_user', JSON.stringify(json.user));
      applyRolePermissions();
    }
  } catch (_) {}
}

function showLogin() {
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');
  const submitBtn = document.getElementById('login-btn');

  if (loginView) loginView.style.display = 'flex';
  if (appView) appView.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Sign In';
  }
}

function showApp() {
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');

  if (loginView) loginView.style.display = 'none';
  if (appView) appView.style.display = 'flex';

  if (state.user) {
    const nameEl = document.getElementById('admin-display-name');
    const roleEl = document.getElementById('admin-display-role');
    if (nameEl) nameEl.innerText = state.user.name;
    if (roleEl) roleEl.innerText = state.user.role;
  }

  const allowedTabs = applyRolePermissions();
  const urlTab = typeof getTabFromUrl === 'function' ? getTabFromUrl() : 'dashboard';
  const initialTab = allowedTabs.includes(urlTab) ? urlTab : (allowedTabs.includes(state.activeTab) ? state.activeTab : (allowedTabs[0] || 'dashboard'));
  switchTab(initialTab, true);
}

// Hides sidebar nav items and section titles the current user isn't permitted to view.
// Checks customized employee permissions first, then falls back to base role matrix.
function applyRolePermissions() {
  const permissions = window.__ROLE_PERMISSIONS__ || {};
  const role = state.user && state.user.role;
  let allowedTabs = [];

  if (role === 'ADMIN') {
    allowedTabs = [
      'dashboard', 'directory', 'inventory', 'purchasing', 'inbound',
      'sales', 'outbound', 'vouchers', 'accounting', 'payroll',
      'staff', 'admin', 'settings'
    ];
  } else if (state.user && state.user.permissions) {
    // Check user's direct customized effective CRUD matrix
    allowedTabs = Object.keys(state.user.permissions).filter(
      (m) => state.user.permissions[m] && Boolean(state.user.permissions[m].read)
    );
  } else if (state.user && Array.isArray(state.user.visibleModules)) {
    allowedTabs = state.user.visibleModules.slice();
  } else {
    allowedTabs = ((role && permissions[role]) || []).slice();
  }

  // Every employee should be able to see the vouchers
  if (!allowedTabs.includes('vouchers')) {
    allowedTabs.push('vouchers');
  }

  // Update nav item visibility in sidebar
  document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
    const tab = item.dataset.tab;
    const isAllowed = allowedTabs.includes(tab);
    item.style.display = isAllowed ? '' : 'none';
  });

  // Automatically hide category section titles if all child nav items in that section are hidden
  document.querySelectorAll('.sidebar-menu .nav-section-title').forEach((titleEl) => {
    let nextEl = titleEl.nextElementSibling;
    let hasVisibleChild = false;
    while (nextEl && !nextEl.classList.contains('nav-section-title')) {
      if (nextEl.classList.contains('nav-item') && nextEl.style.display !== 'none') {
        hasVisibleChild = true;
        break;
      }
      nextEl = nextEl.nextElementSibling;
    }
    titleEl.style.display = hasVisibleChild ? '' : 'none';
  });

  return allowedTabs;
}


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

    const kpis = dashData.kpis || {};

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-content">
            <h3>Inventory Valuation</h3>
            <div class="kpi-value">${formatCurrencyBreakdown(kpis.inventoryValuationByCurrency)}</div>
            <div class="kpi-sub">${kpis.totalProducts || 0} active SKU items</div>
          </div>
          <div class="kpi-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-content">
            <h3>Total Sales Revenue</h3>
            <div class="kpi-value">${formatCurrencyBreakdown(kpis.salesRevenueByCurrency)}</div>
            <div class="kpi-sub">${kpis.totalCustomers || 0} registered clients</div>
          </div>
          <div class="kpi-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-content">
            <h3>Purchase Commitments</h3>
            <div class="kpi-value">${formatCurrencyBreakdown(kpis.purchaseCommitmentByCurrency)}</div>
            <div class="kpi-sub">${kpis.totalVendors || 0} active suppliers</div>
          </div>
          <div class="kpi-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-content">
            <h3>Payroll Disbursed</h3>
            <div class="kpi-value">${formatCurrency(kpis.totalPayrollPaidCents)}</div>
            <div class="kpi-sub">${kpis.activeEmployees || 0} active staff</div>
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
          <button class="btn btn-secondary btn-sm" onclick="openNewPaymentVoucherModal()">New Payment Voucher</button>
        </div>
      </div>

      <!-- Accounting Health Summary -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Double-Entry Ledger Status</div>
          <span class="badge ${tbData.isBalanced ? 'badge-success' : 'badge-danger'}">
            <span class="badge-dot"></span>
            ${tbData.isBalanced ? 'Balanced (Zero Discrepancy)' : 'Ledger Imbalance'}
          </span>
        </div>
        <div style="padding: 1.25rem 1.35rem;">
          <div style="display: flex; gap: 2.5rem; align-items: center; flex-wrap: wrap;">
            <div>
              <span style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Total Debits</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-top: 0.2rem;">${formatCurrency(tbData.totalDebitCents)}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Total Credits</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-top: 0.2rem;">${formatCurrency(tbData.totalCreditCents)}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Net Variance</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: ${tbData.discrepancyCents === 0 ? '#059669' : '#dc2626'}; margin-top: 0.2rem;">
                ${formatCurrency(tbData.discrepancyCents)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading dashboard: ${err.message}</div>`;
  }
}


let directoryActiveTab = 'customers';
let directorySearch = '';
let productsCategoryTab = 'all';

// Directory reads/writes the same /api/sales, /api/inventory, /api/purchasing endpoints
// those modules already use, so a sub-tab only appears if the signed-in role actually
// has that underlying module granted — otherwise its API calls would 403.
function directoryAllowedTabs() {
  const myModules = (window.__ROLE_PERMISSIONS__ && state.user && window.__ROLE_PERMISSIONS__[state.user.role]) || [];
  const tabs = [];
  if (myModules.includes('sales')) tabs.push('customers');
  if (myModules.includes('inventory')) tabs.push('products');
  if (myModules.includes('inventory')) tabs.push('pricelist');
  if (myModules.includes('purchasing')) tabs.push('suppliers');
  return tabs;
}

function directoryTabLabel(tab) {
  return { customers: 'Customers', products: 'Products', pricelist: 'Price List', suppliers: 'Suppliers' }[tab] || tab;
}

function directoryTabCount(tab) {
  if (tab === 'customers') return state.customers.length;
  if (tab === 'products') return state.products.length;
  if (tab === 'pricelist') return state.products.length;
  if (tab === 'suppliers') return state.vendors.length;
  return 0;
}

async function loadDirectory() {
  const container = document.getElementById('view-directory');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading business directory...</div>');

  const allowed = directoryAllowedTabs();
  if (!allowed.length) {
    container.innerHTML = '<div class="panel-card" style="padding: 2rem; text-align: center; color: #64748b;">No directory data available for your role.</div>';
    return;
  }
  if (!allowed.includes(directoryActiveTab)) directoryActiveTab = allowed[0];

  try {
    const fetches = [];
    if (allowed.includes('customers')) {
      fetches.push(apiFetch('/api/sales/customers').then((r) => r.json()).then((j) => { state.customers = j.data || []; }));
    }
    if (allowed.includes('products')) {
      fetches.push(apiFetch('/api/inventory/products').then((r) => r.json()).then((j) => { state.products = j.data || []; }));
      fetches.push(apiFetch('/api/inventory/categories').then((r) => r.json()).then((j) => { state.productCategories = j.data || []; }));
    }
    if (allowed.includes('suppliers')) {
      fetches.push(apiFetch('/api/purchasing/vendors').then((r) => r.json()).then((j) => { state.vendors = j.data || []; }));
    }
    await Promise.all(fetches);

    renderDirectoryContent();
  } catch (err) {
    container.innerHTML = `<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading directory: ${err.message}</div>`;
  }
}

function switchDirectoryTab(tab) {
  directoryActiveTab = tab;
  directorySearch = '';
  productsCategoryTab = 'all';
  renderDirectoryContent();
}

function renderDirectoryContent() {
  const container = document.getElementById('view-directory');
  const allowed = directoryAllowedTabs();

  const tabsHtml = allowed.map((tab) => {
    const active = tab === directoryActiveTab;
    return `
      <button type="button" onclick="switchDirectoryTab('${tab}')" style="padding: 0.5rem 1rem; border-radius: 999px; font-size: 0.82rem; font-weight: 600; border: 1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}; background: ${active ? 'var(--primary)' : '#ffffff'}; color: ${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        ${directoryTabLabel(tab)} <span style="opacity: 0.75;">(${directoryTabCount(tab)})</span>
      </button>
    `;
  }).join('');

  const addButton = can('directory', 'create')
    ? {
        customers: '<button class="btn btn-primary btn-sm" onclick="openNewCustomerModal()">Add Customer</button>',
        products: '<button class="btn btn-primary btn-sm" onclick="openNewProductModal()">Add Product</button>',
        suppliers: '<button class="btn btn-primary btn-sm" onclick="openNewVendorModal()">Add Supplier</button>',
      }[directoryActiveTab] || ''
    : '';

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Business Directory</div>
        <div class="panel-actions">${addButton}</div>
      </div>
      <p style="padding: 0 1.35rem 1rem; font-size: 0.85rem; color: #64748b;">
        The single source of truth for customers, products, and suppliers — referenced by Purchasing, Inbound, and Sales, but managed here.
      </p>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 1.35rem 1rem; flex-wrap: wrap;">
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">${tabsHtml}</div>
        <input
          type="text"
          class="form-input"
          style="max-width: 260px;"
          placeholder="Search ${directoryTabLabel(directoryActiveTab).toLowerCase()}..."
          value="${directorySearch}"
          oninput="directorySearch = this.value; renderDirectoryTable();"
        />
      </div>
      ${directoryActiveTab === 'products' ? '<div id="directory-category-tabs" style="padding: 0 1.35rem 1rem;"></div>' : ''}
      <div id="directory-table-wrap"></div>
    </div>
  `;
  if (directoryActiveTab === 'products') renderProductCategoryTabs();
  renderDirectoryTable();
}

// Category sub-navigation for the Products tab — same pill styling as the
// main Customers/Products/Price List/Suppliers tabs, one level down, so
// browsing by category feels like the same UI the user already knows.
function renderProductCategoryTabs() {
  const wrap = document.getElementById('directory-category-tabs');
  if (!wrap) return;

  const countFor = (catName) => state.products.filter((p) => p.category === catName).length;

  const pills = [
    { key: 'all', label: 'All Products', count: state.products.length },
    ...state.productCategories.map((c) => ({ key: c.name, label: c.name, count: countFor(c.name) })),
  ];

  const pillsHtml = pills.map((p) => {
    const active = productsCategoryTab === p.key;
    return `
      <button type="button" onclick="productsCategoryTab = '${p.key.replace(/'/g, "\\'")}'; renderDirectoryTable();" style="padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}; background: ${active ? 'var(--primary)' : '#f8fafc'}; color: ${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        ${p.label} <span style="opacity: 0.75;">(${p.count})</span>
      </button>
    `;
  }).join('');

  wrap.innerHTML = `
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
      ${pillsHtml}
      <button type="button" onclick="openAddCategoryModal()" style="padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px dashed var(--border-color); background: transparent; color: #64748b; cursor: pointer;">+ Add Category</button>
    </div>
  `;
}

function renderDirectoryTable() {
  const wrap = document.getElementById('directory-table-wrap');
  if (!wrap) return;
  const q = directorySearch.trim().toLowerCase();

  if (directoryActiveTab === 'customers') {
    const rows = state.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Customer Code</th><th>Name</th><th>Email</th><th>Added</th></tr></thead>
          <tbody>
            ${rows.map((c) => `
              <tr>
                <td><strong>${c.customerCode}</strong></td>
                <td>${c.name}</td>
                <td>${c.email || '<span style="color: #94a3b8;">—</span>'}</td>
                <td>${new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align: center; color: #64748b;">No customers found.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } else if (directoryActiveTab === 'products') {
    // renderProductCategoryTabs() may run after state.productCategories loads but
    // before a tab that no longer exists is deselected — fall back to "all".
    if (productsCategoryTab !== 'all' && !state.productCategories.some((c) => c.name === productsCategoryTab)) {
      productsCategoryTab = 'all';
    }
    const rows = state.products.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchesCategory = productsCategoryTab === 'all' || p.category === productsCategoryTab;
      return matchesQuery && matchesCategory;
    });
    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>SKU</th><th>Product Name</th><th>Category</th><th>UOM</th><th>Cost Price</th><th></th></tr></thead>
          <tbody>
            ${rows.map((p) => `
              <tr>
                <td><strong>${p.sku}</strong></td>
                <td>${p.name}</td>
                <td>${p.category || '<span style="color: #94a3b8;">—</span>'}</td>
                <td>${p.unitOfMeasure}</td>
                <td>${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.75rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8;">Not purchased yet</span>'}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="openChangeCategoryModal('${p.id}', '${p.name.replace(/'/g, "\\'")}', '${(p.category || '').replace(/'/g, "\\'")}')">Change Category</button></td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No products found.</td></tr>'}
          </tbody>
        </table>
      </div>
      <p style="padding: 0 1.35rem 1.25rem; font-size: 0.78rem; color: #94a3b8;">Selling prices are managed on the Price List tab. Stock levels, valuation, and movement history live in Inventory & Stock.</p>
    `;
  } else if (directoryActiveTab === 'pricelist') {
    const rows = state.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>SKU</th><th>Product Name</th><th>Cost Price</th><th>Selling Price</th><th></th></tr></thead>
          <tbody>
            ${rows.map((p) => `
              <tr>
                <td><strong>${p.sku}</strong></td>
                <td>${p.name}</td>
                <td>${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.75rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8;">Not purchased yet</span>'}</td>
                <td>${p.sellingPriceCents > 0 ? formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency) : '<span style="color: #94a3b8;">Not set</span>'}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="openSetPriceModal('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.sellingPriceCents}, '${p.sellingPriceCurrency}')">Set Price</button></td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No products found.</td></tr>'}
          </tbody>
        </table>
      </div>
      <p style="padding: 0 1.35rem 1.25rem; font-size: 0.78rem; color: #94a3b8;">Selling prices set here are what Sales Orders and Invoices should quote customers.</p>
    `;
  } else if (directoryActiveTab === 'suppliers') {
    const rows = state.vendors.filter((v) => !q || v.name.toLowerCase().includes(q) || v.vendorCode.toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q));
    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Vendor Code</th><th>Name</th><th>Email</th><th>Payment Terms</th></tr></thead>
          <tbody>
            ${rows.map((v) => `
              <tr>
                <td><strong>${v.vendorCode}</strong></td>
                <td>${v.name}</td>
                <td>${v.email || '<span style="color: #94a3b8;">—</span>'}</td>
                <td>${v.paymentTermsDays} days</td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align: center; color: #64748b;">No suppliers found.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }
}

// ---- Create Customer (moved from Sales) ----

function openNewCustomerModal() {
  const body = `
    <form id="form-new-cust" onsubmit="submitNewCustomer(event)">
      <div class="form-group">
        <label class="form-label">Customer Code *</label>
        <input type="text" id="nc-code" class="form-input" placeholder="e.g. CUST-GLOBEX" required />
      </div>
      <div class="form-group">
        <label class="form-label">Customer Name *</label>
        <input type="text" id="nc-name" class="form-input" placeholder="e.g. Globex Corporation" required />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="nc-email" class="form-input" placeholder="billing@client.com" />
      </div>
    </form>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-cust').requestSubmit()">Save Customer</button>
  `;
  openModal('Add New Customer', body, footer);
}

async function submitNewCustomer(e) {
  e.preventDefault();
  const payload = {
    customerCode: document.getElementById('nc-code').value,
    name: document.getElementById('nc-name').value,
    email: document.getElementById('nc-email').value || undefined,
  };

  try {
    const res = await apiFetch('/api/sales/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create customer');

    closeModal();
    showToast('Customer ' + json.data.name + ' created', 'success');
    directoryActiveTab = 'customers';
    loadDirectory();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ---- Product Categories ----

function productCategoryOptionsHtml(selectedName) {
  return state.productCategories.map((c) => `<option value="${c.name}" ${c.name === selectedName ? 'selected' : ''}>${c.name}</option>`).join('');
}

// Lets the user add a category inline from within the Add Product / Change
// Category modals without stacking a second modal on top of the first.
async function quickAddCategory(selectElId) {
  const name = (window.prompt('New category name:') || '').trim();
  if (!name) return;

  try {
    const res = await apiFetch('/api/inventory/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add category');

    state.productCategories.push(json.data);
    state.productCategories.sort((a, b) => a.name.localeCompare(b.name));

    const select = document.getElementById(selectElId);
    if (select) {
      select.innerHTML = productCategoryOptionsHtml(json.data.name);
    }
    showToast('Category "' + json.data.name + '" added', 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openAddCategoryModal() {
  const body = `
    <form id="form-add-category" onsubmit="submitAddCategory(event)">
      <div class="form-group">
        <label class="form-label">Category Name *</label>
        <input type="text" id="ac-name" class="form-input" placeholder="e.g. Weather Station" required />
      </div>
    </form>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-add-category').requestSubmit()">Save Category</button>
  `;
  openModal('Add Product Category', body, footer);
}

async function submitAddCategory(e) {
  e.preventDefault();
  const payload = { name: document.getElementById('ac-name').value };

  try {
    const res = await apiFetch('/api/inventory/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add category');

    closeModal();
    showToast('Category "' + json.data.name + '" added', 'success');
    directoryActiveTab = 'products';
    productsCategoryTab = json.data.name;
    loadDirectory();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openChangeCategoryModal(productId, name, currentCategory) {
  const body = `
    <form id="form-change-category" onsubmit="submitChangeCategory(event, '${productId}')">
      <p style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b;">Category for <strong>${name}</strong>.</p>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <div style="display: flex; gap: 0.5rem;">
          <select id="cc-category" class="form-select" style="flex: 1;">${productCategoryOptionsHtml(currentCategory)}</select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="quickAddCategory('cc-category')">+ New</button>
        </div>
      </div>
    </form>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-change-category').requestSubmit()">Save Category</button>
  `;
  openModal('Change Product Category', body, footer);
}

async function submitChangeCategory(e, productId) {
  e.preventDefault();
  const payload = { category: document.getElementById('cc-category').value };

  try {
    const res = await apiFetch('/api/inventory/products/' + productId + '/category', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save category');

    closeModal();
    showToast('Category updated for ' + json.data.name, 'success');
    directoryActiveTab = 'products';
    loadDirectory();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ---- Create Product (moved from Inventory) ----

function openNewProductModal() {
  const body = `
    <form id="form-new-product" onsubmit="submitNewProduct(event)">
      <div class="form-group">
        <label class="form-label">Product Number (SKU) *</label>
        <input type="text" id="np-sku" class="form-input" placeholder="e.g. WIDGET-100" required />
      </div>
      <div class="form-group">
        <label class="form-label">Product Name *</label>
        <input type="text" id="np-name" class="form-input" placeholder="e.g. Industrial Widget" required />
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <div style="display: flex; gap: 0.5rem;">
          <select id="np-category" class="form-select" style="flex: 1;" required>${productCategoryOptionsHtml(null)}</select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="quickAddCategory('np-category')">+ New</button>
        </div>
      </div>
      <p style="margin: -0.5rem 0 0; font-size: 0.78rem; color: #94a3b8;">
        Unit of measure, cost price, currency, and quantity are set when you order this product in Purchasing.
        Selling price is set afterwards from the Price List tab.
      </p>
    </form>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-product').requestSubmit()">Save Product</button>
  `;
  openModal('Add New Product', body, footer);
}

async function submitNewProduct(e) {
  e.preventDefault();
  const payload = {
    sku: document.getElementById('np-sku').value,
    name: document.getElementById('np-name').value,
    category: document.getElementById('np-category').value,
  };

  try {
    const res = await apiFetch('/api/inventory/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save product');

    closeModal();
    showToast('Product ' + json.data.name + ' created', 'success');
    directoryActiveTab = 'products';
    loadDirectory();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ---- Set Price (Price List tab) ----

function openSetPriceModal(productId, name, currentSellingPriceCents, currentSellingPriceCurrency) {
  const currency = currentSellingPriceCurrency || 'USD';
  const currentAmount = currentSellingPriceCents ? (currentSellingPriceCents / 100).toFixed(2) : '';
  const body = `
    <form id="form-set-price" onsubmit="submitSetPrice(event, '${productId}')">
      <p style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b;">Selling price for <strong>${name}</strong>.</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Selling Price *</label>
          <input type="number" id="sp-price" class="form-input" placeholder="e.g. 90.00" step="0.01" min="0" value="${currentAmount}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Currency *</label>
          <select id="sp-currency" class="form-select">
            <option value="USD" ${currency === 'USD' ? 'selected' : ''}>USD ($)</option>
            <option value="PHP" ${currency === 'PHP' ? 'selected' : ''}>PHP (₱)</option>
          </select>
        </div>
      </div>
    </form>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-set-price').requestSubmit()">Save Price</button>
  `;
  openModal('Set Price List Entry', body, footer);
}

async function submitSetPrice(e, productId) {
  e.preventDefault();
  const payload = {
    sellingPriceCents: Math.round(parseFloat(document.getElementById('sp-price').value) * 100),
    sellingPriceCurrency: document.getElementById('sp-currency').value,
  };

  try {
    const res = await apiFetch('/api/inventory/products/' + productId + '/price', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save price');

    closeModal();
    showToast('Price updated for ' + json.data.name, 'success');
    directoryActiveTab = 'pricelist';
    loadDirectory();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ---- Create Supplier (moved from Purchasing) ----

function openNewVendorModal() {
  const body = `
    <form id="form-new-vendor" onsubmit="submitNewVendor(event)">
      <div class="form-group">
        <label class="form-label">Vendor Code *</label>
        <input type="text" id="nv-code" class="form-input" placeholder="e.g. VEND-SUPPLY" required />
      </div>
      <div class="form-group">
        <label class="form-label">Vendor Name *</label>
        <input type="text" id="nv-name" class="form-input" placeholder="e.g. Industrial Supply Corp" required />
      </div>
      <div class="form-group">
        <label class="form-label">Contact Email</label>
        <input type="email" id="nv-email" class="form-input" placeholder="orders@supplier.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Payment Terms (Days)</label>
        <input type="number" id="nv-terms" class="form-input" value="30" />
      </div>
    </form>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-vendor').requestSubmit()">Save Vendor</button>
  `;
  openModal('Add New Vendor', body, footer);
}

async function submitNewVendor(e) {
  e.preventDefault();
  const payload = {
    vendorCode: document.getElementById('nv-code').value,
    name: document.getElementById('nv-name').value,
    email: document.getElementById('nv-email').value || undefined,
    paymentTermsDays: parseInt(document.getElementById('nv-terms').value, 10) || 30,
  };

  try {
    const res = await apiFetch('/api/purchasing/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create vendor');

    closeModal();
    showToast('Vendor ' + json.data.name + ' added', 'success');
    directoryActiveTab = 'suppliers';
    loadDirectory();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}


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
    container.innerHTML = `<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading inventory: ${err.message}</div>`;
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
    rowsHtml += `
      <tr>
        <td><strong style="font-family: 'JetBrains Mono', monospace;">${p.sku}</strong></td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category || '<span style="color: #94a3b8;">—</span>'}</td>
        <td>${p.unitOfMeasure}</td>
        <td>${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.75rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8;">Not purchased yet</span>'}</td>
        <td>${p.sellingPriceCents > 0 ? formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency) : '<span style="color: #94a3b8;">Not set</span>'}</td>
        <td>
          <span class="badge ${p.onHandStock > 10 ? 'badge-success' : p.onHandStock > 0 ? 'badge-warning' : 'badge-danger'}">
            <span class="badge-dot"></span>
            ${p.onHandStock} ${p.unitOfMeasure}
          </span>
        </td>
        <td><strong>${formatCurrency(p.inventoryValuationCents)}</strong></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openProductHistoryModal('${p.id}', '${p.name}')">History</button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Product Catalog & Stock Levels</div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="exportInventoryCsv()">📥 Export CSV</button>
          ${can('inventory', 'create') ? '<button class="btn btn-primary btn-sm" onclick="openAddStockModal()">➕ Add Stock</button>' : ''}
          ${can('inventory', 'update') ? '<button class="btn btn-secondary btn-sm" onclick="openStockAdjustmentModal()">Stock Adjustment</button>' : ''}
        </div>
      </div>
      <div style="padding: 0 1.35rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <p style="font-size: 0.85rem; color: #64748b; margin: 0;">
          Add new products from the Business Directory. This view tracks stock levels, valuation, and movement history.
        </p>
        <div style="min-width: 260px;">
          <input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search SKU, product name..." value="${inventorySearchQuery}" oninput="handleInventorySearch(this.value)" />
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
            ${rowsHtml || '<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 2rem;">No products matching search criteria.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
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
    return `
      <button type="button" onclick="inventoryCategoryTab = '${p.key.replace(/'/g, "\\'")}'; renderInventoryContent(document.getElementById('view-inventory'));" style="padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}; background: ${active ? 'var(--primary)' : '#f8fafc'}; color: ${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        ${p.label} <span style="opacity: 0.75;">(${p.count})</span>
      </button>
    `;
  }).join('');

  wrap.innerHTML = `
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
      ${pillsHtml}
    </div>
  `;
}

async function openProductHistoryModal(productId, productName) {
  try {
    const res = await apiFetch('/api/inventory/products/' + productId);
    const json = await res.json();
    const movements = json.data?.stockMovements || [];

    let rowsHtml = '';
    movements.forEach((m) => {
      rowsHtml += `
        <tr>
          <td>${new Date(m.createdAt).toLocaleDateString()} ${new Date(m.createdAt).toLocaleTimeString()}</td>
          <td><span class="badge ${m.type === 'IN' ? 'badge-success' : m.type === 'OUT' ? 'badge-danger' : 'badge-warning'}">${m.type}</span></td>
          <td><strong>${m.quantity}</strong></td>
          <td>${m.referenceType} (${m.referenceId || 'N/A'})</td>
          <td>${m.notes || '-'}</td>
        </tr>
      `;
    });

    const body = `
      <p style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b;">
        Audit movements for <strong>${productName}</strong>. Current On-Hand: <strong>${json.data.onHandStock}</strong>
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
            ${rowsHtml || '<tr><td colspan="5" style="text-align: center;">No movements recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
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
    .map((p) => `<option value="${p.id}">${p.sku} - ${p.name} (Current: ${p.onHandStock})</option>`)
    .join('');
  const body = `
    <form id="form-add-stock" onsubmit="submitAddStock(event)">
      <p style="margin: 0 0 1rem; font-size: 0.85rem; color: #64748b;">
        Use this for stock that isn't coming through a Purchase Order — e.g. legacy products
        already on hand before this system was in use. If the product has no cost price yet,
        set one here so its valuation is accurate.
      </p>
      <div class="form-group">
        <label class="form-label">Select Product *</label>
        <select id="add-stock-product" class="form-select" onchange="handleAddStockProductChange()">${options}</select>
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
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-add-stock').requestSubmit()">Add Stock</button>
  `;
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
  let options = state.products.map((p) => `<option value="${p.id}">${p.sku} - ${p.name} (Current: ${p.onHandStock})</option>`).join('');
  const body = `
    <form id="form-stock-adj" onsubmit="submitStockAdjustment(event)">
      <div class="form-group">
        <label class="form-label">Select Product *</label>
        <select id="adj-product" class="form-select">${options}</select>
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
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-stock-adj').requestSubmit()">Post Adjustment</button>
  `;
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


let npoLineItems = [];
let npoSelectedProductId = null;
let purchasingSearchQuery = '';

async function loadPurchasing() {
  const container = document.getElementById('view-purchasing');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading purchasing data...</div>');

  try {
    purchasingSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';

    const [ordersRes, vendorsRes, productsRes] = await Promise.all([
      apiFetch('/api/purchasing/orders'),
      apiFetch('/api/purchasing/vendors'),
      apiFetch('/api/inventory/products'),
    ]);
    const ordersJson = await ordersRes.json();
    const vendorsJson = await vendorsRes.json();
    const productsJson = await productsRes.json();

    state.purchaseOrders = ordersJson.data || [];
    state.vendors = vendorsJson.data || [];
    state.products = productsJson.data || [];

    renderPurchasingContent(container);
  } catch (err) {
    container.innerHTML = `<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading purchasing: ${err.message}</div>`;
  }
}

function handlePurchasingSearch(query) {
  purchasingSearchQuery = query.toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', purchasingSearchQuery || null);
  }
  const container = document.getElementById('view-purchasing');
  if (container) {
    renderPurchasingContent(container);
  }
}

function exportPurchasingCsv() {
  const headers = ['PO Number', 'Vendor', 'Status', 'Currency', 'Total Amount', 'Ordered Items'];
  const rows = (state.purchaseOrders || []).map((po) => [
    po.poNumber,
    po.vendor?.name || 'Unknown',
    po.status,
    po.currency || 'PHP',
    (po.totalAmountCents / 100).toFixed(2),
    (po.items || []).map((i) => `${i.product?.name || 'Product'} (${i.quantityOrdered} ordered, ${i.quantityReceived} received)`).join('; '),
  ]);
  exportToCsv('purchase_orders_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function renderPurchasingContent(container) {
  const poStatusBadgeClass = {
    DRAFT: 'badge-neutral',
    APPROVED: 'badge-primary',
    DELIVERED: 'badge-warning',
    PARTIALLY_RECEIVED: 'badge-warning',
    RECEIVED: 'badge-success',
    CANCELLED: 'badge-danger',
  };

  let filteredOrders = state.purchaseOrders || [];
  if (purchasingSearchQuery) {
    filteredOrders = filteredOrders.filter((po) => {
      const num = (po.poNumber || '').toLowerCase();
      const vend = (po.vendor?.name || '').toLowerCase();
      const status = (po.status || '').toLowerCase();
      return num.includes(purchasingSearchQuery) || vend.includes(purchasingSearchQuery) || status.includes(purchasingSearchQuery);
    });
  }

  let rowsHtml = '';
  filteredOrders.forEach((po) => {
    const itemsList = (po.items || []).map((i) => `${i.product?.name || 'Product'} (${i.quantityOrdered} ordered, ${i.quantityReceived} received)`).join(', ');
    rowsHtml += `
      <tr class="row-clickable" onclick="goToInboundForPO('${po.id}')">
        <td><strong>${po.poNumber}</strong></td>
        <td>${po.vendor?.name || 'Unknown'}</td>
        <td>
          <span class="badge ${poStatusBadgeClass[po.status] || 'badge-neutral'}">
            <span class="badge-dot"></span>
            ${po.status.replace('_', ' ')}
          </span>
        </td>
        <td><strong>${formatCurrency(po.totalAmountCents, po.currency)}</strong></td>
        <td style="font-size: 0.8rem; color: #64748b;">${itemsList}</td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Purchase Orders & Procurement</div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="exportPurchasingCsv()">📥 Export CSV</button>
          ${can('purchasing', 'create') ? '<button class="btn btn-primary btn-sm" onclick="openNewPOModal()">Create Purchase Order</button>' : ''}
        </div>
      </div>
      <div style="padding: 0 1.35rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <p style="font-size: 0.85rem; color: #64748b; margin: 0;">
          Manage suppliers in the Business Directory. Click a purchase order to open it in Inbound Deliveries.
        </p>
        <div style="min-width: 260px;">
          <input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search PO #, vendor, status..." value="${purchasingSearchQuery}" oninput="handlePurchasingSearch(this.value)" />
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Vendor</th>
              <th>Status</th>
              <th>Total Value</th>
              <th>Ordered Items</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 2rem;">No purchase orders found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openNewPOModal() {
  if (!state.vendors.length) {
    showToast('Please add at least one vendor first', 'warning');
    return;
  }
  if (!state.products.length) {
    showToast('Please add products to your catalog first', 'warning');
    return;
  }

  npoLineItems = [];
  npoSelectedProductId = null;

  let vendorOptions = state.vendors.map((v) => `<option value="${v.id}">${v.name} (${v.vendorCode})</option>`).join('');
  let productDatalist = state.products.map((p) => `<option value="${escapeNpoAttr(p.sku + ' - ' + p.name)}"></option>`).join('');

  const body = `
    <form id="form-new-po" onsubmit="submitNewPO(event)">
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Vendor *</label>
          <select id="npo-vendor" class="form-select">${vendorOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">PO Number</label>
          <input type="text" id="npo-ponumber" class="form-input" placeholder="Auto-generated if blank" />
        </div>
        <div class="form-group">
          <label class="form-label">Currency *</label>
          <select id="npo-currency" class="form-select" onchange="renderNpoItemsTable()">
            <option value="USD" selected>USD ($)</option>
            <option value="PHP">PHP (₱)</option>
          </select>
        </div>
      </div>
      <p style="margin: -0.6rem 0 1rem; font-size: 0.76rem; color: #94a3b8;">Type your own PO number to keep matching your old numbering system - once you stop, new orders will keep counting up from the last one you entered. All line items are priced in the currency selected here.</p>

      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; margin-bottom: 1.1rem; background: #f8fafc;">
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">Add a Product</label>
          <input
            type="text"
            id="npo-product-search"
            class="form-input"
            placeholder="Type a SKU or product name to search..."
            list="npo-product-datalist"
            autocomplete="off"
            oninput="onNpoProductSearchInput()"
            onkeydown="handleNpoStagingKeydown(event)"
          />
          <datalist id="npo-product-datalist">${productDatalist}</datalist>
          <div id="npo-product-info" style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.35rem; min-height: 1.1em;">Search by SKU or name, then set quantity and cost below.</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Qty *</label>
            <input type="number" id="npo-qty" class="form-input" placeholder="e.g. 50" min="1" onkeydown="handleNpoStagingKeydown(event)" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">UOM *</label>
            <input type="text" id="npo-uom" class="form-input" placeholder="e.g. pcs" onkeydown="handleNpoStagingKeydown(event)" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Unit Cost *</label>
            <input type="number" id="npo-unitcost" class="form-input" placeholder="e.g. 45.00" step="0.01" min="0" onkeydown="handleNpoStagingKeydown(event)" />
          </div>
        </div>
        <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 0.65rem;">
          <button type="button" class="btn btn-primary btn-sm" onclick="addNpoLineItem()">+ Add Product to Order</button>
          <span style="font-size: 0.76rem; color: #94a3b8;">Tip: press Enter in any field above to add it</span>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 0.25rem;">
        <label class="form-label">Order Items <span id="npo-items-count" style="font-weight: 400; color: #94a3b8;"></span></label>
        <div id="npo-items-table"></div>
        <p style="margin: 0.6rem 0 0; font-size: 0.76rem; color: #94a3b8;">These values update each product's current cost, currency, and unit of measure in the Business Directory.</p>
      </div>
    </form>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-po').requestSubmit()">Issue Purchase Order</button>
  `;
  openModal('Create Purchase Order', body, footer, 'lg');
  renderNpoItemsTable();
  setTimeout(() => {
    const el = document.getElementById('npo-product-search');
    if (el) el.focus();
  }, 50);
}

function escapeNpoAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Matches the search box text against the catalog and shows the product's
// last known stock/cost as hints (placeholders + info text only - never
// writes into the qty/UOM/cost inputs) so every line is a value the buyer
// deliberately typed, not a stale default carried over from another order.
function onNpoProductSearchInput() {
  const val = document.getElementById('npo-product-search').value;
  const infoEl = document.getElementById('npo-product-info');
  const uomEl = document.getElementById('npo-uom');
  const costEl = document.getElementById('npo-unitcost');
  const product = state.products.find((p) => (p.sku + ' - ' + p.name) === val);

  if (product) {
    npoSelectedProductId = product.id;
    uomEl.placeholder = 'e.g. ' + (product.unitOfMeasure || 'pcs');
    costEl.placeholder = product.costPriceCents ? 'e.g. ' + (product.costPriceCents / 100).toFixed(2) : 'e.g. 45.00';
    const stockNote = 'In stock: ' + (product.onHandStock ?? 0) + ' ' + (product.unitOfMeasure || '');
    const costNote = product.costPriceCents ? ' · Last cost: ' + product.costPriceCurrency + ' ' + (product.costPriceCents / 100).toFixed(2) : '';
    infoEl.textContent = stockNote + costNote;
    infoEl.style.color = '#64748b';
  } else {
    npoSelectedProductId = null;
    uomEl.placeholder = 'e.g. pcs';
    costEl.placeholder = 'e.g. 45.00';
    infoEl.textContent = val ? 'No matching product in catalog' : 'Search by SKU or name, then set quantity and cost below.';
    infoEl.style.color = val ? '#dc2626' : '#94a3b8';
  }
}

// Lets Enter in any staging field add the line item instead of submitting
// the whole order form (the default behavior for Enter inside a <form>).
function handleNpoStagingKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addNpoLineItem();
  }
}

function renderNpoItemsTable() {
  const container = document.getElementById('npo-items-table');
  const countEl = document.getElementById('npo-items-count');
  if (countEl) countEl.textContent = npoLineItems.length ? '(' + npoLineItems.length + ' product' + (npoLineItems.length === 1 ? '' : 's') + ')' : '';
  if (!container) return;

  if (!npoLineItems.length) {
    container.innerHTML = '<p style="font-size: 0.82rem; color: #94a3b8; margin: 0;">No products added yet. Search for a product above and click "Add Product to Order".</p>';
    return;
  }

  const currency = document.getElementById('npo-currency').value;
  let orderTotalCents = 0;

  let rowsHtml = npoLineItems.map((item, idx) => {
    const subtotalCents = item.quantityOrdered * item.unitPriceCents;
    orderTotalCents += subtotalCents;
    return `
      <tr>
        <td>${item.sku} - ${item.name}</td>
        <td>${item.quantityOrdered} ${item.unitOfMeasure}</td>
        <td>${formatCurrency(item.unitPriceCents, currency)}</td>
        <td>${formatCurrency(subtotalCents, currency)}</td>
        <td><button type="button" class="btn btn-secondary btn-sm" onclick="removeNpoLineItem(${idx})">Remove</button></td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th><th></th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align: right; font-weight: 600;">Order Total</td>
          <td colspan="2" style="font-weight: 600;">${formatCurrency(orderTotalCents, currency)}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

function addNpoLineItem() {
  const product = state.products.find((p) => p.id === npoSelectedProductId);
  const quantityOrdered = parseInt(document.getElementById('npo-qty').value, 10);
  const unitOfMeasure = document.getElementById('npo-uom').value.trim();
  // Entered as a normal currency amount (e.g. 45.00), not cents - convert
  // once here so every downstream calculation works in integer cents.
  const unitCostEntered = parseFloat(document.getElementById('npo-unitcost').value);
  const unitPriceCents = Math.round(unitCostEntered * 100);

  if (!product) {
    showToast('Search for and select a product first', 'warning');
    document.getElementById('npo-product-search').focus();
    return;
  }
  if (!quantityOrdered || quantityOrdered < 1) {
    showToast('Enter a valid quantity', 'warning');
    document.getElementById('npo-qty').focus();
    return;
  }
  if (!unitOfMeasure) {
    showToast('Enter a unit of measure', 'warning');
    document.getElementById('npo-uom').focus();
    return;
  }
  if (isNaN(unitCostEntered) || unitCostEntered < 0) {
    showToast('Enter a valid unit cost', 'warning');
    document.getElementById('npo-unitcost').focus();
    return;
  }

  const existingIdx = npoLineItems.findIndex((i) => i.productId === product.id);
  const newItem = { productId: product.id, sku: product.sku, name: product.name, quantityOrdered, unitOfMeasure, unitPriceCents };
  if (existingIdx >= 0) {
    npoLineItems[existingIdx] = newItem;
    showToast('Updated ' + product.name + ' in this order', 'success');
  } else {
    npoLineItems.push(newItem);
    showToast(product.name + ' added', 'success');
  }
  renderNpoItemsTable();

  // Reset the staging fields to blank (placeholders only) for the next
  // product, so repeated Enter presses never silently reuse a stale value.
  npoSelectedProductId = null;
  const searchEl = document.getElementById('npo-product-search');
  searchEl.value = '';
  document.getElementById('npo-qty').value = '';
  document.getElementById('npo-uom').value = '';
  document.getElementById('npo-uom').placeholder = 'e.g. pcs';
  document.getElementById('npo-unitcost').value = '';
  document.getElementById('npo-unitcost').placeholder = 'e.g. 45.00';
  document.getElementById('npo-product-info').textContent = 'Search by SKU or name, then set quantity and cost below.';
  document.getElementById('npo-product-info').style.color = '#94a3b8';
  searchEl.focus();
}

function removeNpoLineItem(idx) {
  npoLineItems.splice(idx, 1);
  renderNpoItemsTable();
}

async function submitNewPO(e) {
  e.preventDefault();

  if (!npoLineItems.length) {
    showToast('Add at least one product to the order', 'warning');
    return;
  }

  const payload = {
    vendorId: document.getElementById('npo-vendor').value,
    poNumber: document.getElementById('npo-ponumber').value.trim() || undefined,
    currency: document.getElementById('npo-currency').value,
    items: npoLineItems.map((item) => ({
      productId: item.productId,
      quantityOrdered: item.quantityOrdered,
      unitOfMeasure: item.unitOfMeasure,
      unitPriceCents: item.unitPriceCents,
    })),
  };

  try {
    const res = await apiFetch('/api/purchasing/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create PO');

    closeModal();
    showToast('Purchase Order ' + json.data.poNumber + ' issued', 'success');
    loadPurchasing();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}


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
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading inbound deliveries...</div>');

  try {
    const res = await apiFetch('/api/inbound/orders');
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load inbound deliveries');

    state.inboundOrders = json.data || [];

    let rowsHtml = state.inboundOrders.map((po) => {
      const itemsList = po.items.map((i) => i.product?.name || 'Product').join(', ');
      const orderedTotal = po.items.reduce((acc, i) => acc + i.quantityOrdered, 0);
      const receivedTotal = po.items.reduce((acc, i) => acc + i.quantityReceived, 0);
      return `
        <tr class="row-clickable" onclick="openInboundDetail('${po.id}')">
          <td><strong>${po.poNumber}</strong></td>
          <td>${po.vendor?.name || 'Unknown'}</td>
          <td>${inboundStatusBadge(po.status)}</td>
          <td>${receivedTotal} / ${orderedTotal}</td>
          <td style="font-size: 0.8rem; color: #64748b;">${itemsList}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
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
              ${rowsHtml || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No purchase orders awaiting inbound tracking.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

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
    container.innerHTML = `<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading inbound deliveries: ${err.message}</div>`;
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
      qtyCell = `<input type="number" class="form-input inbound-qty-input" data-poitemid="${item.id}" value="${remaining}" min="0" max="${remaining}" style="width: 100px;" />`;
    } else if (remaining > 0) {
      qtyCell = '<span style="color: #94a3b8;">—</span>';
    } else {
      qtyCell = '<span class="badge badge-success" style="font-size: 0.7rem;">Complete</span>';
    }
    return `
      <tr>
        <td>${item.product?.name || 'Product'}</td>
        <td>${item.quantityOrdered}</td>
        <td>${item.quantityReceived}</td>
        <td>${qtyCell}</td>
      </tr>
    `;
  }).join('');

  const body = `
    <div style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b; display: flex; align-items: center; gap: 0.6rem;">
      ${inboundStatusBadge(po.status)}
    </div>
    <form id="form-inbound-detail" onsubmit="submitConfirmQuantity(event, '${po.id}')">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Ordered</th>
              <th>Received</th>
              <th>${canConfirmQty ? 'Qty Arrived' : 'Remaining'}</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
    </form>
  `;

  let footer = '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';
  if (canMarkDelivered) {
    footer += `<button type="button" class="btn btn-primary" onclick="markPODelivered('${po.id}')">Mark as Delivered</button>`;
  } else if (canConfirmQty) {
    footer += `<button type="button" class="btn btn-success" onclick="document.getElementById('form-inbound-detail').requestSubmit()">Confirm Quantity Arrived</button>`;
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
    container.innerHTML = `<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading sales: ${err.message}</div>`;
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
  const headers = ['SO Number', 'Customer', 'Status', 'Currency', 'Order Total', 'Invoices'];
  const rows = (state.salesOrders || []).map((so) => [
    so.soNumber,
    so.customer?.name || 'Customer',
    so.status,
    so.currency || 'PHP',
    (so.totalAmountCents / 100).toFixed(2),
    (so.invoices || []).map((inv) => `${inv.invoiceNumber} (${inv.status})`).join('; ') || 'None',
  ]);
  exportToCsv('sales_orders_' + new Date().toISOString().slice(0, 10), headers, rows);
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
      const num = (so.soNumber || '').toLowerCase();
      const cust = (so.customer?.name || '').toLowerCase();
      const status = (so.status || '').toLowerCase();
      return num.includes(salesSearchQuery) || cust.includes(salesSearchQuery) || status.includes(salesSearchQuery);
    });
  }

  let rowsHtml = '';
  filteredOrders.forEach((so) => {
    // 1. Invoices
    const invoices = so.invoices || [];
    const invoicesHtml = invoices
      .map(
        (inv) =>
          '<div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem;">' +
          '<span class="badge ' +
          (inv.status === 'PAID' ? 'badge-success' : inv.status === 'PARTIALLY_PAID' ? 'badge-warning' : 'badge-primary') +
          '" style="font-size: 0.68rem;">' +
          inv.invoiceNumber +
          '</span>' +
          (inv.status !== 'PAID' && (can('sales', 'update') || can('accounting', 'create'))
            ? '<button type="button" class="btn btn-success btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="openRecordReceiptModal(\'' +
              inv.id +
              '\', \'' +
              inv.invoiceNumber +
              '\', ' +
              (inv.totalAmountCents - inv.paidAmountCents) +
              ')">Pay</button>'
            : '') +
          '</div>'
      )
      .join('');

    // 2. Uninvoiced DRs (goods already shipped before invoice was issued)
    const uninvoicedDRs = (so.deliveryReceipts || []).filter((dr) => !dr.invoiceId);
    const uninvoicedHtml = uninvoicedDRs
      .map(
        (dr) =>
          '<div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem;">' +
          '<span class="badge badge-neutral" style="font-size: 0.68rem;">' + dr.drNumber + ' delivered</span>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.45rem; font-size: 0.68rem;" onclick="openDeliveryReceiptSlipModal(\'' + dr.id + '\')">📄 Slip</button>' +
          (can('sales', 'create')
            ? '<button type="button" class="btn btn-primary btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.72rem;" onclick="issueInvoiceForDelivery(\'' + dr.id + '\')">Issue Invoice</button>'
            : '') +
          '</div>'
      )
      .join('');

    // 3. Delivered DRs that already have invoices linked
    const invoicedDRs = (so.deliveryReceipts || []).filter((dr) => Boolean(dr.invoiceId));
    const invoicedDrHtml = invoicedDRs
      .map(
        (dr) =>
          '<div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem;">' +
          '<span class="badge badge-success" style="font-size: 0.68rem;"><span class="badge-dot"></span>' + dr.drNumber + ' delivered</span>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.45rem; font-size: 0.68rem;" onclick="openDeliveryReceiptSlipModal(\'' + dr.id + '\')">📄 Slip</button>' +
          '</div>'
      )
      .join('');

    // 4. Issue Invoice Upfront Button (if order has no invoice yet)
    const canInvoiceOrder = !invoices.length && !uninvoicedDRs.length && can('sales', 'create') &&
      (so.status === 'CONFIRMED' || so.status === 'PACKED' || so.status === 'PARTIALLY_FULFILLED');
    const orderInvoiceBtn = canInvoiceOrder
      ? '<div style="margin-bottom: 0.25rem;">' +
        '<button type="button" class="btn btn-primary btn-sm" style="padding: 0.2rem 0.55rem; font-size: 0.72rem;" onclick="issueInvoiceForOrder(\'' + so.id + '\')">📄 Issue Invoice</button>' +
        '</div>'
      : '';

    // 5. Check if order has remaining undelivered goods to provide direct Create DR action
    const hasRemainingToDeliver = (so.items || []).some((i) => (i.quantity - i.quantityShipped) > 0) &&
      (so.status === 'CONFIRMED' || so.status === 'PACKED' || so.status === 'PARTIALLY_FULFILLED');

    const deliverActionHtml = hasRemainingToDeliver && can('outbound', 'create')
      ? '<div style="margin-top: 0.35rem;">' +
        '<button type="button" class="btn btn-success btn-sm" style="padding: 0.2rem 0.55rem; font-size: 0.72rem; font-weight: 600;" onclick="goToOutboundForSO(\'' + so.id + '\')">📦 + Create DR</button>' +
        '</div>'
      : '';

    const contentList = [invoicesHtml, uninvoicedHtml, invoicedDrHtml, orderInvoiceBtn, deliverActionHtml].filter(Boolean).join('');
    const deliveriesInvoicesHtml = contentList || '<span style="color: #94a3b8; font-size: 0.78rem;">Not yet delivered</span>';

    rowsHtml += `
      <tr>
        <td><strong>${so.soNumber}</strong></td>
        <td>${so.customer?.name || 'Customer'}</td>
        <td>
          <span class="badge ${soStatusBadgeClass[so.status] || 'badge-neutral'}">
            <span class="badge-dot"></span>
            ${so.status.replace('_', ' ')}
          </span>
        </td>
        <td><strong>${formatCurrency(so.totalAmountCents, so.currency)}</strong></td>
        <td>${deliveriesInvoicesHtml}</td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Sales Orders & Invoicing</div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="exportSalesCsv()">📥 Export CSV</button>
          ${can('sales', 'create') ? '<button class="btn btn-primary btn-sm" onclick="openNewSalesOrderModal()">Create Sales Order</button>' : ''}
        </div>
      </div>
      <div style="padding: 0 1.35rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <p style="font-size: 0.85rem; color: #64748b; margin: 0;">
          Manage customers in the Business Directory. Create delivery receipts directly or from Delivery Receipts, then issue invoices once goods are delivered.
        </p>
        <div style="min-width: 260px;">
          <input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search SO #, customer, status..." value="${salesSearchQuery}" oninput="handleSalesSearch(this.value)" />
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>SO Number</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Order Total</th>
              <th>Deliveries & Invoices</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No sales orders found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
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

  let custOptions = state.customers.map((c) => `<option value="${c.id}">${c.name} (${c.customerCode})</option>`).join('');
  let prodOptions = state.products.map((p) => `<option value="${p.id}">${p.sku} - ${p.name} (Stock: ${p.onHandStock})</option>`).join('');

  const body = `
    <form id="form-new-so" onsubmit="submitNewSalesOrder(event)">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Customer *</label>
          <select id="nso-cust" class="form-select">${custOptions}</select>
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
        <select id="nso-product" class="form-select" onchange="handleNewSoProductChange()">${prodOptions}</select>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Quantity *</label>
          <input type="number" id="nso-qty" class="form-input" value="10" min="1" required />
        </div>
        <div class="form-group">
          <label class="form-label">Unit Price * <span id="nso-price-hint" style="color: #94a3b8; font-weight: normal;"></span></label>
          <input type="number" id="nso-price" class="form-input" placeholder="e.g. 90.00" step="0.01" min="0" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" id="nso-notes" class="form-input" placeholder="Standard order" />
      </div>
    </form>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-so').requestSubmit()">Confirm Order</button>
  `;
  openModal('Create Sales Order', body, footer);
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
  const vSettings = window.cachedVoucherSettings || {};
  const sMethods = (vSettings['vouchers.payment_methods'] && Array.isArray(vSettings['vouchers.payment_methods']))
    ? vSettings['vouchers.payment_methods'].filter((m) => m.isActive !== false)
    : [
        { id: 'BANK_TRANSFER', name: 'Bank Wire / Transfer' },
        { id: 'CREDIT_CARD', name: 'Credit Card' },
        { id: 'CHECK', name: 'Check' },
        { id: 'CASH', name: 'Cash' },
        { id: 'ONLINE', name: 'Online / E-Wallet' },
      ];
  const sMethodOptions = sMethods
    .map((m) => `<option value="${m.id}">${m.name}</option>`)
    .join('');

  const body = `
    <form id="form-receipt" onsubmit="submitReceipt(event, '${invoiceId}')">
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
        Recording payment for <strong>${invoiceNumber}</strong> settles Accounts Receivable and credits the account.
      </p>
      <div class="form-group">
        <label class="form-label">Payment Amount (Cents) *</label>
        <input type="number" id="rcpt-amount" class="form-input" value="${totalCents}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Payment Method</label>
        <select id="rcpt-method" class="form-select">
          ${sMethodOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Reference Note</label>
        <input type="text" id="rcpt-notes" class="form-input" placeholder="Payment reference number" />
      </div>
    </form>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-success" onclick="document.getElementById('form-receipt').requestSubmit()">Post Receipt</button>
  `;
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

// Bills a customer for goods already delivered (stock already decremented
// when the Delivery Receipt was issued from Delivery Receipts).
async function issueInvoiceForDelivery(deliveryReceiptId) {
  try {
    const res = await apiFetch('/api/sales/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryReceiptId }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to issue invoice');

    showToast('Invoice ' + json.invoiceNumber + ' issued', 'success');
    loadSales();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Issues an invoice upfront directly for a Sales Order before goods are delivered.
// Inventory stock is NOT decremented here; physical stock deduction happens
// when the Delivery Receipt (DR) is issued in Delivery Receipts (Outbound).
async function issueInvoiceForOrder(salesOrderId) {
  try {
    const res = await apiFetch('/api/sales/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesOrderId }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to issue invoice');

    showToast('Invoice ' + json.invoiceNumber + ' issued — stock remains intact until DR is created', 'success');
    loadSales();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}


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
    container.innerHTML = `<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading delivery receipts: ${err.message}</div>`;
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
  const headers = ['DR Number', 'Delivered Date', 'SO Number', 'Customer', 'Received By', 'Status', 'Delivered Items'];
  const rows = (state.deliveryReceipts || []).map((dr) => [
    dr.drNumber,
    new Date(dr.deliveredAt || dr.createdAt).toLocaleString(),
    dr.salesOrder?.soNumber || 'SO',
    dr.salesOrder?.customer?.name || 'Customer',
    dr.receivedBy || 'N/A',
    dr.invoiceId ? 'Invoiced' : 'Pending Invoicing',
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
      const soNum = (dr.salesOrder?.soNumber || '').toLowerCase();
      const cust = (dr.salesOrder?.customer?.name || '').toLowerCase();
      const rec = (dr.receivedBy || '').toLowerCase();
      const notes = (dr.notes || '').toLowerCase();
      return drNum.includes(outboundSearchQuery) || soNum.includes(outboundSearchQuery) || cust.includes(outboundSearchQuery) || rec.includes(outboundSearchQuery) || notes.includes(outboundSearchQuery);
    });
  }

  // Filter Pending Orders
  const pendingOrders = allOrders.filter((so) => so.status !== 'FULFILLED');
  let filteredPending = pendingOrders;
  if (outboundSearchQuery) {
    filteredPending = filteredPending.filter((so) => {
      const soNum = (so.soNumber || '').toLowerCase();
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
      const dateStr = new Date(dr.deliveredAt || dr.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const itemsList = (dr.items || []).map((i) => `<strong>${i.quantity}x</strong> ${escapeHtml(i.product?.name || 'Product')}`).join(', ');
      const invoiced = Boolean(dr.invoiceId);
      const invoiceNumberStr = dr.invoice && dr.invoice.invoiceNumber ? (' (' + dr.invoice.invoiceNumber + ')') : '';
      const invoiceBadge = invoiced
        ? ('<span class="badge badge-success" style="font-size: 0.72rem;"><span class="badge-dot"></span>Invoiced' + invoiceNumberStr + '</span>')
        : '<span class="badge badge-neutral" style="font-size: 0.72rem;"><span class="badge-dot"></span>Uninvoiced</span>';

      const invoiceAction = !invoiced && can('sales', 'create')
        ? `<button type="button" class="btn btn-primary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="issueInvoiceForDelivery('${dr.id}')">Issue Invoice</button>`
        : '';

      return `
        <tr>
          <td><strong>${dr.drNumber}</strong></td>
          <td>${dateStr}</td>
          <td><span style="font-weight: 600; color: var(--primary);">${dr.salesOrder?.soNumber || 'SO'}</span></td>
          <td>${escapeHtml(dr.salesOrder?.customer?.name || 'Customer')}</td>
          <td style="font-size: 0.8rem; max-width: 260px;">${itemsList}</td>
          <td>${escapeHtml(dr.receivedBy || '—')}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              ${invoiceBadge}
              ${invoiceAction}
            </div>
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="openDeliveryReceiptSlipModal('${dr.id}')">📄 View Slip</button>
          </td>
        </tr>
      `;
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
        return `
          <tr>
            <td>${escapeHtml(item.product?.name || 'Product')}</td>
            <td>${item.quantity}</td>
            <td>${item.quantityShipped}</td>
            <td><strong>${remaining}</strong></td>
            <td>
              <span class="${isSufficient ? 'text-success' : 'text-danger'}" style="font-weight: 600;">
                ${onHand} in stock
              </span>
            </td>
          </tr>
        `;
      }).join('');

      const inv = (so.invoices || []).find((i) => i.status !== 'CANCELLED');
      const invBadge = inv
        ? ('<span class="badge badge-primary" style="font-size: 0.7rem;"><span class="badge-dot"></span>Invoiced: ' + escapeHtml(inv.invoiceNumber) + '</span>')
        : '<span class="badge badge-neutral" style="font-size: 0.7rem;">Not Invoiced</span>';

      return `
        <div class="panel-card" style="margin-bottom: 1rem; border: 1px solid var(--border-color); background: #ffffff;">
          <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding: 0.85rem 1.25rem;">
            <div class="panel-title" style="font-size: 0.95rem;">
              <strong>${so.soNumber}</strong> — ${escapeHtml(so.customer?.name || 'Unknown Customer')}
              <div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <span>Total: ${formatCurrency(so.totalAmountCents, so.currency)}</span>
                ${outboundStatusBadge(so.status)}
                ${invBadge}
              </div>
            </div>
            <div class="panel-actions">
              ${can('outbound', 'create') ? `<button type="button" class="btn btn-success btn-sm" onclick="openCreateDeliveryReceiptModal('${so.id}')">+ Create Delivery Receipt</button>` : ''}
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
              <tbody>${itemRows}</tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
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
          ${can('outbound', 'create') ? '<button type="button" class="btn btn-primary btn-sm" onclick="openCreateDeliveryReceiptModal()">+ Create Delivery Receipt</button>' : ''}
        </div>
      </div>

      <!-- TABS & CONTROLS -->
      <div style="padding: 0 1.25rem 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-sm ${outboundActiveTab === 'receipts' ? 'btn-primary' : 'btn-secondary'}" onclick="switchOutboundSubTab('receipts')">
            Delivery Receipts (${allReceipts.length})
          </button>
          <button type="button" class="btn btn-sm ${outboundActiveTab === 'pending' ? 'btn-primary' : 'btn-secondary'}" onclick="switchOutboundSubTab('pending')">
            Orders Awaiting Delivery (${pendingOrders.length})
          </button>
        </div>
        <div style="min-width: 260px;">
          <input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search DR #, SO #, customer..." value="${escapeHtml(outboundSearchQuery)}" oninput="handleOutboundSearch(this.value)" />
        </div>
      </div>

      <!-- MAIN TAB CONTENT -->
      ${outboundActiveTab === 'receipts' ? `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>DR Number</th>
                <th>Delivered Date</th>
                <th>SO Number</th>
                <th>Customer</th>
                <th>Delivered Items</th>
                <th>Received By</th>
                <th>Invoicing</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>${receiptsTableHtml}</tbody>
          </table>
        </div>
      ` : `
        <div style="padding: 1rem 1.25rem;">
          ${pendingCardsHtml}
        </div>
      `}
    </div>
  `;
}

// Opens the Create Delivery Receipt Modal
function openCreateDeliveryReceiptModal(preselectedSoId) {
  const eligibleOrders = (state.outboundOrders || []).filter((so) => {
    if (so.status === 'CANCELLED' || so.status === 'DRAFT' || so.status === 'FULFILLED') return false;
    const hasRemaining = (so.items || []).some((i) => (i.quantity - i.quantityShipped) > 0);
    return hasRemaining;
  });

  if (!eligibleOrders.length) {
    showToast('No sales orders awaiting delivery. Please create and confirm a sales order first.', 'warning');
    return;
  }

  const selectedSoId = preselectedSoId || eligibleOrders[0].id;
  let soOptions = eligibleOrders.map((so) => {
    const isSel = so.id === selectedSoId ? 'selected' : '';
    const cust = so.customer?.name || 'Customer';
    const inv = (so.invoices || []).find((i) => i.status !== 'CANCELLED');
    const invText = inv ? ` [${inv.invoiceNumber}]` : '';
    return `<option value="${so.id}" ${isSel}>${so.soNumber}${invText} — ${escapeHtml(cust)} (${so.status})</option>`;
  }).join('');

  const body = `
    <form id="form-create-dr" onsubmit="submitCreateDeliveryReceipt(event)">
      <div class="form-group">
        <label class="form-label">Select Sales Order to Deliver *</label>
        <select id="cdr-so-select" class="form-select" onchange="handleDeliveryReceiptSoChange()">
          ${soOptions}
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
          <label class="form-label">Received By (Customer Rep / Consignee)</label>
          <input type="text" id="cdr-received-by" class="form-input" placeholder="e.g. John Doe / Receiving Officer" />
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Notes / Courier / Tracking #</label>
          <input type="text" id="cdr-notes" class="form-input" placeholder="e.g. Waybill #98124, Apexs Fleet Truck #2" />
        </div>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-primary" onclick="document.getElementById('form-create-dr').requestSubmit()">Confirm & Issue Delivery Receipt</button>
  `;

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
    const activeInvoice = (so.invoices || []).find((inv) => inv.status !== 'CANCELLED');
    const invoiceInfoHtml = activeInvoice
      ? ('<span class="badge badge-primary" style="font-size: 0.72rem;"><span class="badge-dot"></span>Linked Invoice: ' + escapeHtml(activeInvoice.invoiceNumber) + ' (' + activeInvoice.status + ')</span>')
      : '<span class="badge badge-neutral" style="font-size: 0.72rem;">No invoice yet (goods delivered prior to invoicing)</span>';

    detailsEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <strong>Customer:</strong> ${escapeHtml(so.customer?.name || 'Customer')}
          ${so.customer?.shippingAddress ? '<span style="color: #64748b;"> — ' + escapeHtml(so.customer.shippingAddress) + '</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span>Order Total: <strong>${formatCurrency(so.totalAmountCents, so.currency)}</strong></span>
          ${outboundStatusBadge(so.status)}
          ${invoiceInfoHtml}
        </div>
      </div>
    `;
  }

  const tbody = document.getElementById('cdr-items-tbody');
  if (!tbody) return;

  tbody.innerHTML = (so.items || []).map((item) => {
    const remaining = item.quantity - item.quantityShipped;
    const onHand = outboundOnHandStock(item.productId);
    const maxDeliverable = Math.max(0, Math.min(remaining, onHand));
    const isCompleted = remaining <= 0;

    let inputHtml = '';
    if (isCompleted) {
      inputHtml = '<span class="badge badge-success" style="font-size: 0.72rem;">Delivered</span>';
    } else if (onHand <= 0) {
      inputHtml = '<span class="badge badge-danger" style="font-size: 0.72rem;">Out of Stock</span>';
    } else {
      inputHtml = `
        <input
          type="number"
          class="form-input cdr-qty-input"
          data-soitemid="${item.id}"
          data-max="${maxDeliverable}"
          value="${maxDeliverable}"
          min="0"
          max="${maxDeliverable}"
          style="padding: 0.35rem 0.5rem; font-size: 0.85rem;"
        />
      `;
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 600;">${escapeHtml(item.product?.name || 'Product')}</div>
          <div style="font-size: 0.74rem; color: #94a3b8;">SKU: ${item.product?.sku || '—'}</div>
        </td>
        <td>${item.quantity}</td>
        <td>${item.quantityShipped}</td>
        <td>
          <span style="font-weight: 600; color: ${onHand >= remaining ? 'var(--text-main)' : '#dc2626'};">
            ${onHand}
          </span>
        </td>
        <td>${inputHtml}</td>
      </tr>
    `;
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

  const payload = {
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
    showToast('Delivery Receipt ' + json.drNumber + ' issued — stock deducted', 'success');
    loadOutbound();
    if (typeof loadSales === 'function' && state.activeTab === 'sales') {
      loadSales();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Vector SVG representing the official APEXS Green Wireframe Stepped Pyramid Logo
const APEXS_GREEN_PYRAMID_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 145" style="width: 140px; height: auto; flex-shrink: 0;">' +
  '<defs>' +
  '<linearGradient id="pyrGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">' +
  '<stop offset="0%" stop-color="#edf7ed" />' +
  '<stop offset="100%" stop-color="#c8e6c9" />' +
  '</linearGradient>' +
  '<linearGradient id="pyrGradRight" x1="0%" y1="0%" x2="100%" y2="100%">' +
  '<stop offset="0%" stop-color="#ffffff" />' +
  '<stop offset="100%" stop-color="#eaf5ea" />' +
  '</linearGradient>' +
  '</defs>' +
  '<!-- Stepped Foundation Tier 3 (Bottom-most terrace) -->' +
  '<polygon points="12,118 108,140 208,98 200,92 108,132 18,112" fill="#dcfce7" stroke="#1b7a30" stroke-width="1.2" stroke-linejoin="round" />' +
  '<polygon points="12,118 108,140 108,144 12,122" fill="#86efac" stroke="#1b7a30" stroke-width="1.2" stroke-linejoin="round" />' +
  '<polygon points="108,140 208,98 208,102 108,144" fill="#4ade80" stroke="#1b7a30" stroke-width="1.2" stroke-linejoin="round" />' +
  '<!-- Stepped Foundation Tier 2 (Middle terrace) -->' +
  '<polygon points="20,108 108,128 198,89 190,83 108,121 26,102" fill="#dcfce7" stroke="#1b7a30" stroke-width="1.2" stroke-linejoin="round" />' +
  '<polygon points="20,108 108,128 108,132 20,112" fill="#86efac" stroke="#1b7a30" stroke-width="1.2" stroke-linejoin="round" />' +
  '<polygon points="108,128 198,89 198,93 108,132" fill="#4ade80" stroke="#1b7a30" stroke-width="1.2" stroke-linejoin="round" />' +
  '<!-- Stepped Foundation Tier 1 (Top terrace of pedestal) -->' +
  '<polygon points="28,98 108,117 188,80 180,75 108,110 34,93" fill="#e2fbe8" stroke="#1b7a30" stroke-width="1.2" stroke-linejoin="round" />' +
  '<polygon points="28,98 108,117 108,121 28,102" fill="#86efac" stroke="#1b7a30" stroke-width="1.2" stroke-linejoin="round" />' +
  '<polygon points="108,117 188,80 188,84 108,121" fill="#4ade80" stroke="#1b7a30" stroke-width="1.2" stroke-linejoin="round" />' +
  '<!-- Main Pyramid Facets Background -->' +
  '<polygon points="108,14 34,93 108,110" fill="url(#pyrGradLeft)" stroke="#1b7a30" stroke-width="1.5" stroke-linejoin="round" />' +
  '<polygon points="108,14 108,110 180,75" fill="url(#pyrGradRight)" stroke="#1b7a30" stroke-width="1.5" stroke-linejoin="round" />' +
  '<!-- Horizontal Contour Lines on Left Facet -->' +
  '<line x1="88" y1="35" x2="108" y2="40" stroke="#1b7a30" stroke-width="1.2" />' +
  '<line x1="70" y1="54" x2="108" y2="63" stroke="#1b7a30" stroke-width="1.2" />' +
  '<line x1="53" y1="73" x2="108" y2="86" stroke="#1b7a30" stroke-width="1.2" />' +
  '<line x1="41" y1="85" x2="108" y2="100" stroke="#1b7a30" stroke-width="1.2" />' +
  '<!-- Horizontal Contour Lines on Right Facet -->' +
  '<line x1="108" y1="40" x2="128" y2="31" stroke="#1b7a30" stroke-width="1.2" />' +
  '<line x1="108" y1="63" x2="147" y2="46" stroke="#1b7a30" stroke-width="1.2" />' +
  '<line x1="108" y1="86" x2="165" y2="62" stroke="#1b7a30" stroke-width="1.2" />' +
  '<line x1="108" y1="100" x2="174" y2="70" stroke="#1b7a30" stroke-width="1.2" />' +
  '<!-- Vertical Wireframe Grid Lines on Left Facet -->' +
  '<line x1="98" y1="37" x2="98" y2="17" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="89" y1="59" x2="89" y2="36" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="99" y1="61" x2="99" y2="38" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="72" y1="78" x2="72" y2="55" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="86" y1="81" x2="86" y2="58" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="98" y1="84" x2="98" y2="61" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="58" y1="89" x2="58" y2="74" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="73" y1="93" x2="73" y2="78" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="87" y1="96" x2="87" y2="81" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="99" y1="98" x2="99" y2="84" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="48" y1="96" x2="48" y2="87" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="63" y1="100" x2="63" y2="90" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="78" y1="104" x2="78" y2="94" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="93" y1="107" x2="93" y2="97" stroke="#1b7a30" stroke-width="1.0" />' +
  '<!-- Vertical Wireframe Grid Lines on Right Facet -->' +
  '<line x1="118" y1="35" x2="118" y2="16" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="118" y1="57" x2="118" y2="36" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="133" y1="52" x2="133" y2="29" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="118" y1="78" x2="118" y2="58" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="134" y1="74" x2="134" y2="51" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="150" y1="67" x2="150" y2="45" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="118" y1="94" x2="118" y2="80" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="135" y1="89" x2="135" y2="75" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="152" y1="83" x2="152" y2="69" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="168" y1="76" x2="168" y2="63" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="118" y1="105" x2="118" y2="95" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="134" y1="100" x2="134" y2="90" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="150" y1="94" x2="150" y2="84" stroke="#1b7a30" stroke-width="1.0" />' +
  '<line x1="166" y1="87" x2="166" y2="78" stroke="#1b7a30" stroke-width="1.0" />' +
  '<!-- Central Ridge Line -->' +
  '<line x1="108" y1="14" x2="108" y2="110" stroke="#1b7a30" stroke-width="1.6" />' +
  '</svg>';

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

  // Extract Customer PO number
  var poNumber = '—';
  if (so.notes) {
    var m = so.notes.match(/PO[#:s]*([A-Z0-9_-]+)/i);
    if (m) poNumber = m[1].toUpperCase();
    else if (/^PO[0-9]+/i.test(so.notes.trim())) poNumber = so.notes.trim().toUpperCase();
  }
  if (poNumber === '—' && dr.notes) {
    var m2 = dr.notes.match(/PO[#:s]*([A-Z0-9_-]+)/i);
    if (m2) poNumber = m2[1].toUpperCase();
    else if (/^PO[0-9]+/i.test(dr.notes.trim())) poNumber = dr.notes.trim().toUpperCase();
  }
  if (poNumber === '—') {
    poNumber = so.soNumber || '—';
  }

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
    '<!-- 1. APEXS Header with Green Wireframe Pyramid Logo & Corporate Typography -->' +
    '<div style="display: flex; justify-content: center; align-items: center; gap: 1.5rem; margin-bottom: 0.5rem;">' +
    APEXS_GREEN_PYRAMID_SVG +
    '<div>' +
    '<div style="font-family: Arial, Helvetica, sans-serif; font-weight: 800; font-style: italic; color: #cc2222; font-size: 1.65rem; letter-spacing: 0.5px; line-height: 1.1;">APEXS, INC.</div>' +
    '<div style="font-family: 'Times New Roman', Times, Georgia, serif; font-weight: 700; font-style: normal; color: #111111; font-size: 1.08rem; line-height: 1.25; margin-top: 3px;">Applied Expert Systems & Software, Inc.</div>' +
    '<div style="font-family: 'Brush Script MT', 'Segoe Script', 'Apple Chancery', 'Lucida Calligraphy', cursive, italic; font-style: italic; font-weight: 600; color: #1d4ed8; font-size: 1.15rem; line-height: 1.2; margin-top: 2px;">We put technology to work for you</div>' +
    '</div>' +
    '</div>' +
    '<!-- 2. Address & Website -->' +
    '<div style="text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 0.78rem; color: #000000; line-height: 1.45; margin-bottom: 1.5rem;">' +
    '<div>Suite 714, EGI City by the Sea, Maribago</div>' +
    '<div>Lapu-Lapu City</div>' +
    '<div style="margin-top: 0.35rem;">' +
    '<a href="http://www.apexvalue.com" target="_blank" style="color: #0000ee; text-decoration: underline; font-weight: 500;">www.apexvalue.com</a>' +
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
    '<span style="font-weight: 700; min-width: 60px;">PO#</span>' +
    '<span style="font-weight: 700; min-width: 140px; border-bottom: 2px solid #000000; padding-bottom: 1px;">' + escapeHtml(poNumber) + '</span>' +
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
    '<button type="button" class="btn btn-secondary" onclick="downloadSingleDeliveryReceiptPdf('' + dr.id + '')">📥 Download PDF</button>' +
    '<button type="button" class="btn btn-primary" onclick="window.print()">🖨️ Print Slip</button>';

  openModal('Delivery Receipt — ' + dr.drNumber, body, footer, 'xl');
}

window.renderOfficialDeliveryReceiptMarkup = renderOfficialDeliveryReceiptMarkup;
window.openDeliveryReceiptSlipModal = openDeliveryReceiptSlipModal;
window.downloadSingleDeliveryReceiptPdf = downloadSingleDeliveryReceiptPdf;


// ============================================================================
// VOUCHERS MODULE CLIENT CONTROLLER (Payment Vouchers - PV)
// ============================================================================

let cachedPVList = [];
let cachedPVAccounts = [];
let cachedPVVendors = [];
let cachedPVEmployees = [];
let pvSearchQuery = '';
let pvYearFilter = '2026';
let pvActiveViewMode = 'table';
let pvShowSummaryCards = true;

function getPvUserStorageKey(prefix) {
  const userId = (typeof state !== 'undefined' && state.user && (state.user.id || state.user.email))
    ? (state.user.id || state.user.email)
    : 'global';
  return prefix + '_' + userId;
}

function loadPvViewModePreference() {
  try {
    const userKey = getPvUserStorageKey('apexs_pv_view_mode');
    const userSaved = localStorage.getItem(userKey);
    if (userSaved === 'cards' || userSaved === 'table') {
      pvActiveViewMode = userSaved;
      return;
    }
    const globalSaved = localStorage.getItem('apexs_pv_view_mode');
    if (globalSaved === 'cards' || globalSaved === 'table') {
      pvActiveViewMode = globalSaved;
      return;
    }
  } catch (e) {}
  pvActiveViewMode = 'table';
}
loadPvViewModePreference();

function loadPvShowCardsPreference() {
  try {
    const userKey = getPvUserStorageKey('apexs_pv_show_summary_cards');
    const userSaved = localStorage.getItem(userKey);
    if (userSaved !== null) {
      pvShowSummaryCards = userSaved === 'true';
      return;
    }
    const globalSaved = localStorage.getItem('apexs_pv_show_summary_cards');
    if (globalSaved !== null) {
      pvShowSummaryCards = globalSaved === 'true';
      return;
    }
  } catch (e) {}
  pvShowSummaryCards = true;
}
loadPvShowCardsPreference();

function getPvYear(v) {
  if (!v) return '2026';
  const rawDate = v.voucherDate || v.createdAt;
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return d.getFullYear().toString();
    }
  }
  if (v.voucherNumber) {
    const match = v.voucherNumber.match(/^(\d{2})-/);
    if (match) {
      return '20' + match[1];
    }
    const match4 = v.voucherNumber.match(/(20\d{2})/);
    if (match4) {
      return match4[1];
    }
  }
  return '2026';
}

function getFilteredVouchersList() {
  let list = cachedPVList || [];
  if (pvYearFilter && pvYearFilter !== 'ALL') {
    list = list.filter((v) => getPvYear(v) === pvYearFilter);
  }
  if (pvSearchQuery) {
    const q = pvSearchQuery.toLowerCase();
    list = list.filter((v) => {
      const num = (v.voucherNumber || '').toLowerCase();
      const rec = (v.recipient || v.recipientName || '').toLowerCase();
      const notes = (v.notes || '').toLowerCase();
      const method = (v.paymentMethod || '').toLowerCase();
      return num.includes(q) || rec.includes(q) || notes.includes(q) || method.includes(q);
    });
  }
  return list;
}

async function loadVouchers() {
  const container = document.getElementById('view-vouchers');
  if (!container) return;
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading payment vouchers...</div>');

  try {
    loadPvShowCardsPreference();
    loadPvViewModePreference();
    pvSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';
    pvYearFilter = (typeof getUrlParam === 'function' ? getUrlParam('year') : null) || '2026';

    const [vouchersRes, accountsRes, settingsRes, vendorsRes, empRes] = await Promise.all([
      apiFetch('/api/accounting/vouchers?type=PAYMENT'),
      apiFetch('/api/accounting/accounts').catch(() => null),
      apiFetch('/api/settings/vouchers').catch(() => null),
      apiFetch('/api/purchasing/vendors').catch(() => null),
      apiFetch('/api/payroll/employees').catch(() => null),
    ]);

    const vouchersJson = await vouchersRes.json();
    cachedPVList = (vouchersJson.data || []).filter((v) => v.voucherType === 'PAYMENT');
    cachedVouchers = vouchersJson.data || [];

    if (accountsRes) {
      try {
        const aj = await accountsRes.json();
        cachedPVAccounts = aj.data || [];
        cachedAccounts = cachedPVAccounts;
      } catch (e) {}
    }
    if (settingsRes) {
      try {
        const sj = await settingsRes.json();
        window.cachedVoucherSettings = sj.data || sj.settings || {};
      } catch (e) {}
    }
    if (vendorsRes) {
      try {
        const vj = await vendorsRes.json();
        cachedPVVendors = vj.data || [];
        cachedVendors = cachedPVVendors;
      } catch (e) {}
    }
    if (empRes) {
      try {
        const ej = await empRes.json();
        cachedPVEmployees = ej.data || [];
        cachedEmployees = cachedPVEmployees;
      } catch (e) {}
    }

    renderVouchersContent(container, cachedPVList);
  } catch (err) {
    console.error('Error loading vouchers:', err);
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #dc2626;">Failed to load payment vouchers. ' + err.message + '</div>';
  }
}

function renderSingleVoucherRow(v, isAdmin) {
  const rawDate = v.voucherDate || v.createdAt;
  let formattedDate = '—';
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  let tag = v.tag || v.referenceType || '';
  if (tag === 'MANUAL') tag = '';
  else if (tag === 'PURCHASE_ORDER') tag = 'PO Procurement';
  else if (tag === 'PAYROLL_RUN') tag = 'Payroll';

  let tagBadgeHtml = '<span style="color: #cbd5e1; font-size: 0.8rem;">—</span>';
  if (tag) {
    const escapedTag = escapeHtml(tag);
    tagBadgeHtml = '<span class="badge badge-neutral" style="font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.4rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; max-width: 95px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;" title="#' + escapedTag + '">#' + escapedTag + '</span>';
  }

  let remarksHtml = '<span style="color: #cbd5e1; font-size: 0.8rem;">—</span>';
  if (v.notes && v.notes.trim()) {
    const escapedNotes = escapeHtml(v.notes.trim());
    remarksHtml = '<div style="max-width: 105px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.78rem; color: #475569;" title="' + escapedNotes + '">' + escapedNotes + '</div>';
  }

  let statusBadge = '<span class="badge badge-success" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;"><span class="badge-dot"></span>POSTED</span>';
  if (v.status === 'VOID' || v.status === 'DECLINED') {
    statusBadge = '<span class="badge badge-danger" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;"><span class="badge-dot"></span>VOID</span>';
  } else if (v.status === 'DRAFT') {
    statusBadge = '<span class="badge badge-neutral" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;"><span class="badge-dot"></span>DRAFT</span>';
  }

  const methodMap = {
    'BANK_TRANSFER': 'Bank',
    'CHECK': 'Check',
    'CASH': 'Cash',
    'CREDIT_CARD': 'Card',
    'DEBIT_CARD': 'Card',
    'ONLINE': 'Online',
    'MANUAL': 'Manual',
    'JOURNAL': 'Journal'
  };
  const rawMethod = v.paymentMethod || 'BANK_TRANSFER';
  const shortMethod = methodMap[rawMethod] || rawMethod.replace('_', ' ');

  let actionButtons = '';
  actionButtons += '<button class="btn btn-secondary btn-sm pv-btn-compact" onclick="openOfficialVoucherSlipModal(&quot;' + v.id + '&quot;)" title="View Official Slip">📄 Slip</button>';
  actionButtons += '<button class="btn btn-secondary btn-sm pv-btn-compact" onclick="downloadSingleVoucherPdf(&quot;' + v.id + '&quot;)" title="Download PDF Slip">📥 PDF</button>';
  actionButtons += '<button class="btn btn-secondary btn-sm pv-btn-compact" onclick="openEditVoucherModal(&quot;' + v.id + '&quot;)" title="Edit Details">✏️ Edit</button>';
  const histCount = v.historyCount || 0;
  const countBadgeClass = histCount > 0 ? 'has-records' : 'zero-records';
  actionButtons += '<button class="btn btn-secondary btn-sm pv-btn-compact btn-history-badge-container" onclick="openVoucherHistoryModal(&quot;' + v.id + '&quot;)" title="View Revision History & Audit Trail (' + histCount + ' record' + (histCount === 1 ? '' : 's') + ')">📜 Hist<span class="history-count-badge ' + countBadgeClass + '">' + histCount + '</span></button>';

  if (v.status === 'VOID' || v.status === 'DECLINED') {
    actionButtons += '<button class="btn btn-success btn-sm pv-btn-compact" onclick="restoreVoucher(&quot;' + v.id + '&quot;)" title="Restore Voucher">♻️</button>';
  } else {
    actionButtons += '<button class="btn btn-warning btn-sm pv-btn-compact" onclick="declineVoucher(&quot;' + v.id + '&quot;)" title="Void / Decline">🚫</button>';
  }

  if (isAdmin) {
    actionButtons += '<button class="btn btn-danger btn-sm pv-btn-compact" onclick="deleteVoucherPermanent(&quot;' + v.id + '&quot;)" title="Delete Permanently">🗑️</button>';
  }

  const recipientName = escapeHtml(v.recipient || v.recipientName || '—');

  return (
    '<tr>' +
    '<td class="td-voucher-num" data-label="Voucher #">' +
    '<div style="display: flex; align-items: center; gap: 0.35rem;">' +
    '<span style="font-size: 0.95rem; line-height: 1;">🧾</span>' +
    '<strong style="font-family: monospace; color: var(--primary); font-size: 0.88rem;">' + v.voucherNumber + '</strong>' +
    '</div>' +
    '<div class="pv-card-amount" style="font-weight: 800; color: #dc2626; font-family: monospace; font-size: 0.95rem; white-space: nowrap;">- ' + formatCurrency(v.amountCents || 0, v.currency || 'PHP') + '</div>' +
    '</td>' +
    '<td class="td-date" data-label="Date" style="white-space: nowrap; font-size: 0.8rem; color: #334155; font-weight: 500;">' + formattedDate + '</td>' +
    '<td class="td-recipient" data-label="Payee / Recipient">' +
    '<div style="max-width: 135px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 0.3rem;" title="' + recipientName + '">' +
    '<span style="color: #64748b; font-size: 0.8rem; flex-shrink: 0;">🏢</span>' +
    '<strong style="color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem;">' + recipientName + '</strong>' +
    '</div>' +
    '</td>' +
    '<td class="td-tag" data-label="Tag / Category">' + tagBadgeHtml + '</td>' +
    '<td class="td-remarks" data-label="Remarks">' + remarksHtml + '</td>' +
    '<td class="td-method" data-label="Payment Method"><span class="badge badge-neutral" style="font-size: 0.72rem; padding: 0.15rem 0.4rem; white-space: nowrap;" title="' + escapeHtml(rawMethod) + '">' + escapeHtml(shortMethod) + '</span></td>' +
    '<td class="td-amount" data-label="Total Amount" style="text-align: right; font-weight: 700; color: #dc2626; font-family: monospace; font-size: 0.84rem; white-space: nowrap;">- ' + formatCurrency(v.amountCents || 0, v.currency || 'PHP') + '</td>' +
    '<td class="td-status" data-label="Status">' + statusBadge + '</td>' +
    '<td class="td-actions" data-label="Actions"><div class="pv-actions-group">' + actionButtons + '</div></td>' +
    '</tr>'
  );
}

function handlePvSearch(query) {
  pvSearchQuery = (query || '').toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', pvSearchQuery || null);
  }

  const tableBody = document.getElementById('pv-table-body');
  const countEl = document.getElementById('pv-header-count');
  if (tableBody && countEl) {
    const filtered = getFilteredVouchersList();
    filtered.sort((a, b) => {
      const timeB = new Date(b.updatedAt || b.createdAt || b.voucherDate || 0).getTime();
      const timeA = new Date(a.updatedAt || a.createdAt || a.voucherDate || 0).getTime();
      return timeB - timeA;
    });

    countEl.innerHTML = 'Showing <strong>' + filtered.length + '</strong> voucher(s)';

    const totalDisbursedCents = filtered.filter((v) => v.status === 'POSTED').reduce((sum, v) => sum + (v.amountCents || 0), 0);
    const postedCount = filtered.filter((v) => v.status === 'POSTED').length;
    const voidedCount = filtered.filter((v) => v.status === 'VOID' || v.status === 'DECLINED').length;
    const draftCount = filtered.filter((v) => v.status === 'DRAFT').length;

    const kpiDisbursed = document.getElementById('pv-kpi-total-disbursed');
    if (kpiDisbursed) kpiDisbursed.textContent = formatCurrency(totalDisbursedCents, 'PHP');
    const kpiPosted = document.getElementById('pv-kpi-posted-count');
    if (kpiPosted) kpiPosted.textContent = String(postedCount);
    const kpiDraft = document.getElementById('pv-kpi-draft-count');
    if (kpiDraft) kpiDraft.textContent = String(draftCount);
    const kpiVoid = document.getElementById('pv-kpi-voided-count');
    if (kpiVoid) kpiVoid.textContent = String(voidedCount);

    const isAdmin = state.user && state.user.role === 'ADMIN';
    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="9" style="text-align: center; color: #64748b; padding: 2.5rem;">No payment vouchers found' + (pvYearFilter !== 'ALL' ? ' for year ' + pvYearFilter : '') + '.</td></tr>';
    } else {
      tableBody.innerHTML = filtered.map((v) => renderSingleVoucherRow(v, isAdmin)).join('');
    }
    return;
  }

  const searchInput = document.getElementById('pv-search-input');
  const selStart = searchInput ? searchInput.selectionStart : null;
  const selEnd = searchInput ? searchInput.selectionEnd : null;

  const container = document.getElementById('view-vouchers');
  if (container) {
    renderVouchersContent(container, cachedPVList);
  }

  const newSearchInput = document.getElementById('pv-search-input');
  if (newSearchInput && selStart !== null) {
    newSearchInput.focus();
    try {
      newSearchInput.setSelectionRange(selStart, selEnd);
    } catch (e) {}
  }
}

function handlePvYearFilter(year) {
  pvYearFilter = year;
  if (typeof setUrlParam === 'function') {
    setUrlParam('year', pvYearFilter === '2026' ? null : pvYearFilter);
  }
  const container = document.getElementById('view-vouchers');
  if (container) {
    renderVouchersContent(container, cachedPVList);
  }
}

function handlePvActiveViewMode(mode) {
  pvActiveViewMode = mode;
  try {
    localStorage.setItem(getPvUserStorageKey('apexs_pv_view_mode'), mode);
    localStorage.setItem('apexs_pv_view_mode', mode);
  } catch (e) {}
  const table = document.getElementById('pv-data-table');
  if (table) {
    table.classList.remove('view-mode-cards', 'view-mode-table');
    if (mode === 'cards') table.classList.add('view-mode-cards');
    else if (mode === 'table') table.classList.add('view-mode-table');
  }
  document.querySelectorAll('#view-vouchers .btn-view-mode').forEach((btn) => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector('#view-vouchers .btn-view-mode[data-mode="' + mode + '"]');
  if (activeBtn) activeBtn.classList.add('active');
}

function handlePvToggleSummaryCards(forceVal) {
  if (typeof forceVal === 'boolean') {
    pvShowSummaryCards = forceVal;
  } else {
    pvShowSummaryCards = !pvShowSummaryCards;
  }
  try {
    localStorage.setItem(getPvUserStorageKey('apexs_pv_show_summary_cards'), String(pvShowSummaryCards));
    localStorage.setItem('apexs_pv_show_summary_cards', String(pvShowSummaryCards));
  } catch (e) {}

  const kpiContainer = document.getElementById('pv-kpi-container');
  if (kpiContainer) {
    kpiContainer.style.display = pvShowSummaryCards ? 'grid' : 'none';
  }

  const toggleBtn = document.getElementById('pv-toggle-summary-btn');
  if (toggleBtn) {
    toggleBtn.innerHTML = pvShowSummaryCards ? '👁️ Hide Cards' : '📊 Show Cards';
    toggleBtn.title = pvShowSummaryCards ? 'Hide summary metric cards' : 'Show summary metric cards';
  }

  const checkbox = document.getElementById('pv-show-cards-checkbox');
  if (checkbox && checkbox.checked !== pvShowSummaryCards) {
    checkbox.checked = pvShowSummaryCards;
  }
}

function getItemizedCsvData(list) {
  const headers = [
    'Voucher #',
    'Voucher Date',
    'Type',
    'Payee / Recipient',
    'Line #',
    'Invoice No / Ref',
    'Line Description / Particulars',
    'Line Amount (PHP)',
    'Voucher Total Amount (PHP)',
    'Payment Method',
    'Status',
    'Tag / Category',
    'Memo / Remarks',
    'Prepared By',
    'Certified By',
    'Approved By',
    'Received By'
  ];

  const rows = [];
  (list || []).forEach((v) => {
    let items = v.items || [];
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (_) { items = []; }
    }
    if (!items || items.length === 0) {
      items = [{
        invoiceNo: v.referenceId || '',
        description: v.notes || (v.recipient ? (v.recipient + ' disbursement') : 'Disbursement'),
        amountCents: v.amountCents || 0,
      }];
    }

    let sig = v.signatories;
    if (typeof sig === 'string') {
      try { sig = JSON.parse(sig); } catch (_) { sig = {}; }
    }
    sig = sig || {};

    const rawDate = v.voucherDate || v.createdAt;
    const isoDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '';
    const vTotal = (((v.amountCents || 0) / 100)).toFixed(2);

    items.forEach((it, idx) => {
      rows.push([
        v.voucherNumber,
        isoDate,
        v.voucherType || 'PAYMENT',
        v.recipient || v.recipientName || '',
        idx + 1,
        it.invoiceNo || '',
        it.description || '',
        (((it.amountCents || 0) / 100)).toFixed(2),
        vTotal,
        v.paymentMethod || 'BANK_TRANSFER',
        v.status || 'POSTED',
        v.tag || v.referenceType || '',
        v.notes || '',
        sig.preparedBy || '',
        sig.certifiedBy || '',
        sig.approvedBy || '',
        sig.receivedBy || ''
      ]);
    });
  });

  return { headers, rows };
}

function getSummaryCsvData(list) {
  const headers = [
    'Voucher #',
    'Date',
    'Type',
    'Payee / Recipient',
    'Line Items Count',
    'Total Amount (PHP)',
    'Payment Method',
    'Status',
    'Tag / Category',
    'Line Items Summary',
    'Memo / Remarks',
    'Prepared By',
    'Approved By'
  ];

  const rows = (list || []).map((v) => {
    let items = v.items || [];
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (_) { items = []; }
    }
    if (!items || items.length === 0) {
      items = [{
        invoiceNo: v.referenceId || '',
        description: v.notes || (v.recipient ? (v.recipient + ' disbursement') : 'Disbursement'),
        amountCents: v.amountCents || 0,
      }];
    }

    let sig = v.signatories;
    if (typeof sig === 'string') {
      try { sig = JSON.parse(sig); } catch (_) { sig = {}; }
    }
    sig = sig || {};

    const itemsSummary = items.map((it, i) => (i + 1) + '. ' + (it.invoiceNo ? '[' + it.invoiceNo + '] ' : '') + (it.description || '') + ' (₱' + (((it.amountCents || 0) / 100)).toFixed(2) + ')').join('; ');
    const rawDate = v.voucherDate || v.createdAt;
    const isoDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '';

    return [
      v.voucherNumber,
      isoDate,
      v.voucherType || 'PAYMENT',
      v.recipient || v.recipientName || '',
      items.length,
      (((v.amountCents || 0) / 100)).toFixed(2),
      v.paymentMethod || 'BANK_TRANSFER',
      v.status || 'POSTED',
      v.tag || v.referenceType || '',
      itemsSummary,
      v.notes || '',
      sig.preparedBy || '',
      sig.approvedBy || ''
    ];
  });

  return { headers, rows };
}

function exportItemizedVouchersCsv() {
  const list = getFilteredVouchersList();
  if (!list || list.length === 0) {
    showToast('No vouchers found to export', 'warning');
    return;
  }
  const data = getItemizedCsvData(list);
  const yrSuffix = pvYearFilter && pvYearFilter !== 'ALL' ? '_' + pvYearFilter : '';
  exportToCsv('vouchers_itemized_ledger' + yrSuffix + '_' + new Date().toISOString().slice(0, 10), data.headers, data.rows);
  showToast('Itemized ledger CSV exported (' + data.rows.length + ' lines)', 'success');
}

function exportSummaryVouchersCsv() {
  const list = getFilteredVouchersList();
  if (!list || list.length === 0) {
    showToast('No vouchers found to export', 'warning');
    return;
  }
  const data = getSummaryCsvData(list);
  const yrSuffix = pvYearFilter && pvYearFilter !== 'ALL' ? '_' + pvYearFilter : '';
  exportToCsv('vouchers_summary' + yrSuffix + '_' + new Date().toISOString().slice(0, 10), data.headers, data.rows);
  showToast('Summary CSV exported (' + data.rows.length + ' vouchers)', 'success');
}

function exportPaymentVouchersCsv() {
  exportItemizedVouchersCsv();
}

async function exportFilteredVouchersZip() {
  if (typeof JSZip === 'undefined') {
    showToast('ZIP library is loading, please try again in a moment', 'warning');
    return;
  }

  const list = getFilteredVouchersList();
  if (!list || list.length === 0) {
    showToast('No payment vouchers found to export', 'warning');
    return;
  }

  const total = list.length;
  window.__cancelZipExport = false;

  const modalBody =
    '<div style="padding: 1.25rem 0.5rem; text-align: center;">' +
    '<div style="font-size: 2.4rem; margin-bottom: 0.65rem;">📦</div>' +
    '<h3 style="margin-bottom: 0.35rem; font-size: 1.15rem; color: #1e293b; font-weight: 700;">Packaging Voucher PDF Archive</h3>' +
    '<p style="color: #64748b; font-size: 0.88rem; margin-bottom: 1.25rem; line-height: 1.45;">' +
    'Generating <strong>' + total + '</strong> individual official PDF slip(s) and packaging them into a ZIP file with CSV summaries...' +
    '</p>' +
    '<div style="background: #e2e8f0; border-radius: 9999px; height: 14px; overflow: hidden; margin-bottom: 0.75rem; width: 100%;">' +
    '<div id="zip-progress-bar" style="background: var(--primary, #0284c7); height: 100%; width: 0%; transition: width 0.15s ease;"></div>' +
    '</div>' +
    '<div id="zip-progress-text" style="font-size: 0.84rem; font-weight: 600; color: #334155;">' +
    'Initializing export queue (0 / ' + total + ')...' +
    '</div>' +
    '</div>';

  const modalFooter =
    '<button type="button" class="btn btn-secondary" onclick="window.__cancelZipExport = true; closeModal();">Cancel Export</button>';

  openModal('Export Vouchers to ZIP', modalBody, modalFooter, 'md');

  const zip = new JSZip();
  const pdfFolder = zip.folder('pdf_slips');
  let successCount = 0;

  for (let i = 0; i < list.length; i++) {
    if (window.__cancelZipExport) {
      showToast('Export cancelled', 'info');
      return;
    }

    const v = list[i];
    const progressBar = document.getElementById('zip-progress-bar');
    const progressText = document.getElementById('zip-progress-text');
    const percent = Math.round(((i + 1) / total) * 90);

    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.innerText = 'Converting (' + (i + 1) + ' / ' + total + '): ' + v.voucherNumber;

    try {
      if (typeof generateVoucherPdfBlob === 'function') {
        const pdfResult = await generateVoucherPdfBlob(v);
        if (pdfResult && pdfResult.blob) {
          pdfFolder.file(pdfResult.filename, pdfResult.blob);
          successCount++;
        }
      }
    } catch (err) {
      console.error('Error generating PDF for voucher:', v.voucherNumber, err);
    }

    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  if (window.__cancelZipExport) return;

  const progressBar = document.getElementById('zip-progress-bar');
  const progressText = document.getElementById('zip-progress-text');
  if (progressBar) progressBar.style.width = '95%';
  if (progressText) progressText.innerText = 'Attaching CSV ledgers and compressing ZIP...';

  try {
    const itemizedData = getItemizedCsvData(list);
    const summaryData = getSummaryCsvData(list);
    if (typeof generateCsvString === 'function') {
      zip.file('vouchers_itemized_ledger.csv', generateCsvString(itemizedData.headers, itemizedData.rows));
      zip.file('vouchers_summary.csv', generateCsvString(summaryData.headers, summaryData.rows));
    }
  } catch (err) {
    console.warn('Could not attach CSV to zip:', err);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  closeModal();

  const yrSuffix = pvYearFilter && pvYearFilter !== 'ALL' ? '_' + pvYearFilter : '';
  const zipName = 'Apexs_Payment_Vouchers' + yrSuffix + '_' + new Date().toISOString().slice(0, 10) + '.zip';

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('ZIP archive (' + successCount + ' PDF slips + CSV) downloaded successfully!', 'success');
}

function openVoucherExportModal() {
  const list = getFilteredVouchersList();
  const count = list.length;
  const yrLabel = pvYearFilter && pvYearFilter !== 'ALL' ? ' (' + pvYearFilter + ')' : ' (All Years)';

  const body =
    '<div style="padding: 0.5rem 0.25rem;">' +
    '<div style="margin-bottom: 1.25rem; font-size: 0.88rem; color: #475569; line-height: 1.5;">' +
    'Select your preferred export format for the <strong>' + count + '</strong> currently filtered payment voucher(s)' + yrLabel + ':' +
    '</div>' +

    '<!-- OPTION 1: ZIP ARCHIVE OF PDF SLIPS -->' +
    '<div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="flex: 1; min-width: 240px;">' +
    '<div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem;">' +
    '<span>📦 Export All to ZIP Archive (Individual PDFs + CSV)</span>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b; line-height: 1.4;">' +
    'Generates a separate official PDF slip for every voucher (half-bond paper format with signatories) bundled into a single compressed .zip file with CSV ledgers.' +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-primary btn-sm" onclick="closeModal(); exportFilteredVouchersZip();" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">' +
    '📦 Download ZIP' +
    '</button>' +
    '</div>' +

    '<!-- OPTION 2: ITEMIZED LEDGER CSV -->' +
    '<div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="flex: 1; min-width: 240px;">' +
    '<div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem;">' +
    '<span>📋 Itemized Ledger CSV (All Breakdown Lines)</span>' +
    '<span class="badge badge-success" style="font-size: 0.7rem; margin-left: 0.35rem;">Recommended</span>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b; line-height: 1.4;">' +
    'Each row represents a specific breakdown line item with Invoice #, Account Description, and Amount. Best for Excel auditing, Pivot Tables, and financial reconciliations.' +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="closeModal(); exportItemizedVouchersCsv();" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">' +
    '📋 Download CSV' +
    '</button>' +
    '</div>' +

    '<!-- OPTION 3: SUMMARY CSV -->' +
    '<div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="flex: 1; min-width: 240px;">' +
    '<div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem;">' +
    '<span>📊 Summary CSV (1 Row per Voucher)</span>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b; line-height: 1.4;">' +
    'High-level summary where each voucher is exactly one row with total amounts, line counts, payment method, remarks, and signatories.' +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="closeModal(); exportSummaryVouchersCsv();" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">' +
    '📊 Download CSV' +
    '</button>' +
    '</div>' +

    '</div>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>';

  openModal('Export Payment Vouchers', body, footer, 'lg');
}

let pendingImportVouchers = [];

function openVoucherImportModal() {
  pendingImportVouchers = [];
  const body =
    '<div style="padding: 0.5rem 0.25rem;">' +
    '<div style="color: #475569; font-size: 0.88rem; margin-bottom: 1.25rem; line-height: 1.45;">' +
    'Import vouchers via <strong>Itemized Ledger CSV</strong> or <strong>Summary CSV</strong>. The ERP system will validate rows, create payment vouchers, and post the double-entry transactions to the General Ledger.' +
    '</div>' +
    '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; margin-bottom: 1.25rem;">' +
    '<div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>' +
    '<label style="display: inline-block; cursor: pointer; background: var(--primary, #0284c7); color: #ffffff; padding: 0.5rem 1.15rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem;">' +
    'Choose CSV File' +
    '<input type="file" id="voucher-csv-input" accept=".csv" style="display: none;" onchange="handleVoucherCsvSelected(this)" />' +
    '</label>' +
    '<div id="voucher-csv-status" style="font-size: 0.82rem; color: #64748b; margin-top: 0.25rem;">Supports Itemized Ledger or Summary CSV format</div>' +
    '</div>' +
    '<div id="voucher-import-preview-box" style="display: none; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem; background: #ffffff; max-height: 220px; overflow-y: auto;">' +
    '<div id="voucher-import-preview-title" style="font-weight: 700; font-size: 0.84rem; color: #0f172a; margin-bottom: 0.45rem;"></div>' +
    '<div id="voucher-import-preview-content" style="font-size: 0.78rem; color: #334155;"></div>' +
    '</div>' +
    '</div>';

  const footer =
    '<button type="button" id="btn-submit-voucher-import" class="btn btn-primary" onclick="submitVoucherCsvImport()" disabled>📤 Import Vouchers</button>' +
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>';

  openModal('Import Payment Vouchers', body, footer, 'lg');
}

function handleVoucherCsvSelected(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const statusEl = document.getElementById('voucher-csv-status');
  if (statusEl) statusEl.innerText = 'Reading ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)...';

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    parseVoucherCsvText(text, file.name);
  };
  reader.readAsText(file);
}

function parseVoucherCsvText(csvText, filename) {
  const lines = (csvText || '').replace(new RegExp('\r', 'g'), '').split(String.fromCharCode(10)).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    showToast('CSV file is empty or missing data rows', 'warning');
    return;
  }

  function parseCsvLine(line) {
    const row = [];
    let inQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === ',' && !inQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += c;
      }
    }
    row.push(entry.trim());
    return row;
  }

  const vouchersMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const r = parseCsvLine(lines[i]);
    if (r.length < 2 || !r[0]) continue;

    const voucherNum = r[0];
    const vDate = r[1] || '';
    const payee = r[3] || '';
    const invNo = r[5] || '';
    const desc = r[6] || '';
    const lineAmt = parseFloat((r[7] || '0').replace(/,/g, '')) || 0;
    const totalAmt = parseFloat((r[8] || '0').replace(/,/g, '')) || 0;
    const method = r[9] || 'BANK_TRANSFER';
    const tag = r[11] || '';
    const remarks = r[12] || '';
    const prep = r[13] || '';
    const cert = r[14] || '';
    const app = r[15] || '';
    const rec = r[16] || '';

    if (!vouchersMap.has(voucherNum)) {
      vouchersMap.set(voucherNum, {
        voucherNumber: voucherNum,
        voucherDate: vDate,
        recipientName: payee,
        amountCents: Math.round(totalAmt * 100),
        paymentMethod: method,
        tag: tag,
        notes: remarks,
        signatories: { preparedBy: prep, certifiedBy: cert, approvedBy: app, receivedBy: rec },
        items: []
      });
    }

    const v = vouchersMap.get(voucherNum);
    if (desc || invNo || lineAmt > 0) {
      v.items.push({
        invoiceNo: invNo,
        description: desc || 'Disbursement',
        amountCents: Math.round(lineAmt * 100)
      });
    }
  }

  pendingImportVouchers = Array.from(vouchersMap.values());
  pendingImportVouchers.forEach((v) => {
    if (v.items.length > 0 && v.amountCents === 0) {
      v.amountCents = v.items.reduce((s, it) => s + it.amountCents, 0);
    }
  });

  const previewBox = document.getElementById('voucher-import-preview-box');
  const previewTitle = document.getElementById('voucher-import-preview-title');
  const previewContent = document.getElementById('voucher-import-preview-content');
  const submitBtn = document.getElementById('btn-submit-voucher-import');
  const statusEl = document.getElementById('voucher-csv-status');

  if (pendingImportVouchers.length > 0) {
    if (statusEl) statusEl.innerText = 'Ready to import ' + pendingImportVouchers.length + ' voucher(s) from ' + filename;
    if (previewTitle) previewTitle.innerText = 'Preview: ' + pendingImportVouchers.length + ' Vouchers Detected';
    if (previewContent) {
      previewContent.innerHTML = pendingImportVouchers.slice(0, 10).map((v) =>
        '<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 2px 0;">' +
        '<span><strong>' + v.voucherNumber + '</strong> — ' + escapeHtml(v.recipientName || 'Payee') + ' (' + v.items.length + ' line(s))</span>' +
        '<span style="font-family: monospace; font-weight: 600;">₱' + (((v.amountCents || 0) / 100).toFixed(2)) + '</span>' +
        '</div>'
      ).join('') + (pendingImportVouchers.length > 10 ? '<div style="font-style: italic; color: #64748b; margin-top: 4px;">... and ' + (pendingImportVouchers.length - 10) + ' more vouchers</div>' : '');
    }
    if (previewBox) previewBox.style.display = 'block';
    if (submitBtn) submitBtn.disabled = false;
  } else {
    showToast('No valid vouchers could be extracted from this CSV', 'warning');
  }
}

async function submitVoucherCsvImport() {
  if (!pendingImportVouchers || pendingImportVouchers.length === 0) {
    showToast('No vouchers to import', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-voucher-import');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Importing...';
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < pendingImportVouchers.length; i++) {
    const v = pendingImportVouchers[i];
    try {
      const res = await apiFetch('/api/accounting/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherType: 'PAYMENT',
          voucherNumber: v.voucherNumber,
          voucherDate: v.voucherDate,
          recipientType: 'OTHER',
          recipientName: v.recipientName || 'Disbursement Payee',
          currency: 'PHP',
          amountCents: v.amountCents,
          paymentMethod: v.paymentMethod || 'BANK_TRANSFER',
          tag: v.tag || '',
          notes: v.notes || '',
          items: v.items,
          signatories: v.signatories
        })
      });
      const json = await res.json();
      if (res.ok && json.success) successCount++;
      else failCount++;
    } catch (e) {
      failCount++;
    }
  }

  closeModal();
  showToast('Import completed: ' + successCount + ' imported' + (failCount > 0 ? ', ' + failCount + ' failed/skipped' : ''), successCount > 0 ? 'success' : 'danger');
  if (typeof loadVouchers === 'function') loadVouchers();
  if (typeof loadAccounting === 'function') loadAccounting();
}

function renderVouchersContent(container, vouchers) {
  // Extract all available years dynamically
  const allYearsSet = new Set(['2026', '2025', '2024', '2023']);
  (vouchers || []).forEach((v) => {
    allYearsSet.add(getPvYear(v));
  });
  const availableYears = Array.from(allYearsSet).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  const yearFilterOptions = availableYears
    .map((y) => '<option value="' + y + '"' + (pvYearFilter === y ? ' selected' : '') + '>' + y + (y === '2026' ? ' (Current)' : '') + '</option>')
    .concat(['<option value="ALL"' + (pvYearFilter === 'ALL' ? ' selected' : '') + '>All Years</option>'])
    .join('');

  // Filter vouchers by year and search query
  let filtered = getFilteredVouchersList();

  // Sort by last updated / created descending
  filtered.sort((a, b) => {
    const timeB = new Date(b.updatedAt || b.createdAt || b.voucherDate || 0).getTime();
    const timeA = new Date(a.updatedAt || a.createdAt || a.voucherDate || 0).getTime();
    return timeB - timeA;
  });

  // Calculate KPIs for current year/filter
  const totalDisbursedCents = filtered.filter((v) => v.status === 'POSTED').reduce((sum, v) => sum + (v.amountCents || 0), 0);
  const postedCount = filtered.filter((v) => v.status === 'POSTED').length;
  const voidedCount = filtered.filter((v) => v.status === 'VOID' || v.status === 'DECLINED').length;
  const draftCount = filtered.filter((v) => v.status === 'DRAFT').length;

  const isAdmin = state.user && state.user.role === 'ADMIN';

  const rowsHtml = filtered.map((v) => renderSingleVoucherRow(v, isAdmin)).join('');

  const pvViewClass = pvActiveViewMode === 'cards' ? ' view-mode-cards' : (pvActiveViewMode === 'table' ? ' view-mode-table' : '');

  container.innerHTML =
    '<div class="card" style="margin-bottom: 1.25rem; border: none; box-shadow: var(--shadow-sm);">' +
    '<div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--border-color);">' +
    '<div>' +
    '<h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.5rem;">' +
    '<span>🧾 Vouchers</span>' +
    '</h2>' +
    '<p style="font-size: 0.84rem; color: #64748b; margin-bottom: 0;">' +
    'Manage and issue official corporate payment vouchers, vendor disbursements, and payout slips.' +
    '</p>' +
    '</div>' +
    '<div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">' +
    '<button type="button" id="pv-toggle-summary-btn" class="btn btn-secondary btn-sm" onclick="handlePvToggleSummaryCards()" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;" title="' + (pvShowSummaryCards ? 'Hide summary metric cards' : 'Show summary metric cards') + '">' +
    (pvShowSummaryCards ? '👁️ Hide Cards' : '📊 Show Cards') +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="openVoucherExportModal()" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;">' +
    '📥 Export Options' +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="exportFilteredVouchersZip()" title="Download ZIP with individual PDFs" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;">' +
    '📦 Export ZIP (PDFs)' +
    '</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="openVoucherImportModal()" title="Import Vouchers from CSV" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.45rem 0.85rem;">' +
    '📤 Import CSV' +
    '</button>' +
    '<button type="button" class="btn btn-primary btn-sm" onclick="openNewPaymentVoucherModal()" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.84rem; padding: 0.45rem 0.95rem;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
    '+ Create Voucher' +
    '</button>' +
    '</div>' +
    '</div>' +

    '<!-- KPI METRIC CARDS -->' +
    '<div id="pv-kpi-container" class="pv-kpi-grid" style="display: ' + (pvShowSummaryCards ? 'grid' : 'none') + '; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; padding: 1.25rem 1.5rem; background: #f8fafc; border-bottom: 1px solid var(--border-color);">' +
    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Total Disbursed (YTD)</div>' +
    '<div id="pv-kpi-total-disbursed" style="font-size: 1.35rem; font-weight: 800; color: #dc2626; margin-top: 0.25rem; font-family: monospace;">' + formatCurrency(totalDisbursedCents, 'PHP') + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Active posted disbursements</div>' +
    '</div>' +
    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Posted Vouchers</div>' +
    '<div id="pv-kpi-posted-count" style="font-size: 1.35rem; font-weight: 800; color: #059669; margin-top: 0.25rem; font-family: monospace;">' + postedCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Official recorded vouchers</div>' +
    '</div>' +
    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Draft / Pending</div>' +
    '<div id="pv-kpi-draft-count" style="font-size: 1.35rem; font-weight: 800; color: #d97706; margin-top: 0.25rem; font-family: monospace;">' + draftCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Awaiting certification</div>' +
    '</div>' +
    '<div class="pv-kpi-item" style="background: #ffffff; padding: 1rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">' +
    '<div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Voided / Cancelled</div>' +
    '<div id="pv-kpi-voided-count" style="font-size: 1.35rem; font-weight: 800; color: #64748b; margin-top: 0.25rem; font-family: monospace;">' + voidedCount + '</div>' +
    '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Reversed from ledger</div>' +
    '</div>' +
    '</div>' +

    '<!-- FILTER & SEARCH BAR -->' +
    '<div style="padding: 0.85rem 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">' +
    '<div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; flex: 1;">' +
    '<div style="flex: 1; max-width: 340px; min-width: 200px;">' +
    '<input id="pv-search-input" type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search voucher #, payee, remarks..." value="' + escapeHtml(pvSearchQuery) + '" oninput="handlePvSearch(this.value)" />' +
    '</div>' +
    '<div style="display: flex; align-items: center; gap: 0.45rem;">' +
    '<label style="font-size: 0.8rem; font-weight: 700; color: #475569; white-space: nowrap;">📅 Year:</label>' +
    '<select class="form-select" style="padding: 0.42rem 0.75rem; font-size: 0.82rem; font-weight: 600; min-width: 140px; border-radius: 6px;" onchange="handlePvYearFilter(this.value)">' +
    yearFilterOptions +
    '</select>' +
    '</div>' +
    '<div class="btn-view-mode-group" title="Switch table display layout">' +
    '<button type="button" class="btn-view-mode' + (pvActiveViewMode === 'table' ? ' active' : '') + '" data-mode="table" onclick="handlePvActiveViewMode(&quot;table&quot;)" title="Compact Table View">' +
    '☰ Table' +
    '</button>' +
    '<button type="button" class="btn-view-mode' + (pvActiveViewMode === 'cards' ? ' active' : '') + '" data-mode="cards" onclick="handlePvActiveViewMode(&quot;cards&quot;)" title="Cascade Wrap Cards View">' +
    '⊞ Wrap Cards' +
    '</button>' +
    '<button type="button" class="btn-view-mode" onclick="loadVouchers()" title="Reload Vouchers" aria-label="Reload Vouchers" style="display: inline-flex; align-items: center; justify-content: center; padding: 0.35rem 0.6rem; font-size: 0.85rem;">' +
    '🔄' +
    '</button>' +
    '</div>' +
    '<label style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; color: #475569; cursor: pointer; user-select: none; padding: 0.35rem 0.65rem; border-radius: 6px; background: #f1f5f9; border: 1px solid #e2e8f0;" title="Show or hide summary metric cards">' +
    '<input type="checkbox" id="pv-show-cards-checkbox" style="cursor: pointer; width: 15px; height: 15px; accent-color: var(--primary); margin: 0;" onchange="handlePvToggleSummaryCards(this.checked)"' + (pvShowSummaryCards ? ' checked' : '') + ' />' +
    '<span>Summary Cards</span>' +
    '</label>' +
    '</div>' +
    '<div id="pv-header-count" style="font-size: 0.8rem; color: #64748b;">' +
    'Showing <strong>' + filtered.length + '</strong> voucher(s)' +
    '</div>' +
    '</div>' +

    '<!-- DATA TABLE -->' +
    '<div class="table-responsive table-responsive-cascade" style="border-top: 1px solid var(--border-color);">' +
    '<table id="pv-data-table" class="data-table responsive-cascade-table pv-compact-table' + pvViewClass + '">' +
    '<thead>' +
    '<tr>' +
    '<th>Voucher #</th>' +
    '<th>Date</th>' +
    '<th>Payee / Recipient</th>' +
    '<th>Tag / Category</th>' +
    '<th>Remarks</th>' +
    '<th>Method</th>' +
    '<th style="text-align: right;">Total Amount</th>' +
    '<th>Status</th>' +
    '<th style="text-align: right;" class="th-actions">Actions</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody id="pv-table-body">' +
    ((rowsHtml && rowsHtml.length > 0) ? rowsHtml : '<tr class="empty-row"><td colspan="9" style="text-align: center; color: #64748b; padding: 2.5rem;">No payment vouchers found' + (pvYearFilter !== 'ALL' ? ' for year ' + pvYearFilter : '') + '.</td></tr>') +
    '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>';
}

window.loadVouchers = loadVouchers;
window.handlePvActiveViewMode = handlePvActiveViewMode;
window.handlePvSearch = handlePvSearch;
window.handlePvYearFilter = handlePvYearFilter;
window.handlePvToggleSummaryCards = handlePvToggleSummaryCards;


let accountingActiveTab = 'vouchers-pv';
let cachedAccounts = [];
let cachedVouchers = [];
let cachedLedgerEntries = [];
let cachedVendors = [];
let cachedEmployees = [];
let cachedCustomers = [];
let cachedProfitLoss = null;
let cachedBalanceSheet = null;
let cachedCashFlow = null;
function getCurrentAccountingYear() {
  return new Date().getFullYear().toString();
}

let voucherSearchQuery = '';
let voucherYearFilter = getCurrentAccountingYear();
let voucherActiveViewMode = 'table';
try {
  const saved = localStorage.getItem('apexs_acc_voucher_view_mode');
  voucherActiveViewMode = (saved === 'cards' || saved === 'table') ? saved : 'table';
} catch (e) {
  voucherActiveViewMode = 'table';
}

function getVoucherYear(v) {
  if (!v) return getCurrentAccountingYear();
  const rawDate = v.voucherDate || v.createdAt;
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return d.getFullYear().toString();
    }
  }
  if (v.voucherNumber) {
    const match = v.voucherNumber.match(/^(d{2})-/);
    if (match) {
      return '20' + match[1];
    }
    const match4 = v.voucherNumber.match(/(20d{2})/);
    if (match4) {
      return match4[1];
    }
  }
  return getCurrentAccountingYear();
}

async function loadAccounting() {
  const container = document.getElementById('view-accounting');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading vouchers, ledger & financial reports...</div>');

  try {
    const urlTab = typeof getUrlParam === 'function' ? getUrlParam('tab') : null;
    if (urlTab) accountingActiveTab = urlTab;
    voucherSearchQuery = (typeof getUrlParam === 'function' ? getUrlParam('search') : '') || '';
    voucherYearFilter = getCurrentAccountingYear();
    if (typeof setUrlParam === 'function') {
      setUrlParam('year', null);
    }

    const [tbRes, ledgerRes, vouchersRes, accountsRes, settingsRes, plRes, bsRes, cfRes, vendorsRes, empRes, custRes] = await Promise.all([
      apiFetch('/api/accounting/trial-balance'),
      apiFetch('/api/accounting/ledger'),
      apiFetch('/api/accounting/vouchers'),
      apiFetch('/api/accounting/accounts'),
      apiFetch('/api/settings/vouchers').catch(() => null),
      apiFetch('/api/accounting/reports/profit-loss').catch(() => null),
      apiFetch('/api/accounting/reports/balance-sheet').catch(() => null),
      apiFetch('/api/accounting/reports/cash-flow').catch(() => null),
      apiFetch('/api/purchasing/vendors').catch(() => null),
      apiFetch('/api/payroll/employees').catch(() => null),
      apiFetch('/api/sales/customers').catch(() => null),
    ]);

    const tbJson = await tbRes.json();
    const ledgerJson = await ledgerRes.json();
    const vouchersJson = await vouchersRes.json();
    const accountsJson = await accountsRes.json();
    if (settingsRes) {
      try {
        const settingsJson = await settingsRes.json();
        window.cachedVoucherSettings = settingsJson.settings || {};
      } catch (e) {}
    }
    if (plRes) {
      try {
        cachedProfitLoss = await plRes.json();
      } catch (e) {}
    }
    if (bsRes) {
      try {
        cachedBalanceSheet = await bsRes.json();
      } catch (e) {}
    }
    if (cfRes) {
      try {
        cachedCashFlow = await cfRes.json();
      } catch (e) {}
    }
    if (vendorsRes) {
      try {
        const vj = await vendorsRes.json();
        cachedVendors = vj.data || [];
      } catch (e) {}
    }
    if (empRes) {
      try {
        const ej = await empRes.json();
        cachedEmployees = ej.data || [];
      } catch (e) {}
    }
    if (custRes) {
      try {
        const cj = await custRes.json();
        cachedCustomers = cj.data || [];
      } catch (e) {}
    }

    state.trialBalance = tbJson;
    cachedAccounts = accountsJson.data || [];
    cachedVouchers = vouchersJson.data || [];
    cachedLedgerEntries = ledgerJson.data || [];
    const accounts = tbJson.accounts || [];
    const entries = ledgerJson.data || [];

    renderAccountingContent(container, tbJson, accounts, entries, cachedVouchers, cachedAccounts);

    const urlSlip = typeof getUrlParam === 'function' ? getUrlParam('slip') : null;
    if (urlSlip) {
      openVoucherSlipModal(urlSlip);
    }
  } catch (err) {
    container.innerHTML = `<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading accounting: ${err.message}</div>`;
  }
}

function switchAccountingTab(tab) {
  accountingActiveTab = tab;
  if (typeof setUrlParam === 'function') {
    setUrlParam('tab', tab);
  }
  const container = document.getElementById('view-accounting');
  if (container && state.trialBalance) {
    renderAccountingContent(container, state.trialBalance, state.trialBalance.accounts || [], cachedLedgerEntries, cachedVouchers, cachedAccounts);
  } else {
    loadAccounting();
  }
}

function handleVoucherSearch(query) {
  voucherSearchQuery = (query || '').toLowerCase();
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', voucherSearchQuery || null);
  }
  const searchInput = document.getElementById('accounting-voucher-search-input');
  const selStart = searchInput ? searchInput.selectionStart : null;
  const selEnd = searchInput ? searchInput.selectionEnd : null;

  const container = document.getElementById('view-accounting');
  if (container && state.trialBalance) {
    renderAccountingContent(container, state.trialBalance, state.trialBalance.accounts || [], cachedLedgerEntries, cachedVouchers, cachedAccounts);
  }

  const newSearchInput = document.getElementById('accounting-voucher-search-input');
  if (newSearchInput && selStart !== null) {
    newSearchInput.focus();
    try {
      newSearchInput.setSelectionRange(selStart, selEnd);
    } catch (e) {}
  }
}

function handleVoucherYearFilter(year) {
  voucherYearFilter = year;
  if (typeof setUrlParam === 'function') {
    setUrlParam('year', voucherYearFilter === getCurrentAccountingYear() ? null : voucherYearFilter);
  }
  const container = document.getElementById('view-accounting');
  if (container && state.trialBalance) {
    renderAccountingContent(container, state.trialBalance, state.trialBalance.accounts || [], cachedLedgerEntries, cachedVouchers, cachedAccounts);
  }
}

function handleVoucherActiveViewMode(mode) {
  voucherActiveViewMode = mode;
  try {
    localStorage.setItem('apexs_acc_voucher_view_mode', mode);
  } catch (e) {}
  const container = document.getElementById('view-accounting');
  if (container && state.trialBalance) {
    renderAccountingContent(container, state.trialBalance, state.trialBalance.accounts || [], cachedLedgerEntries, cachedVouchers, cachedAccounts);
  }
}

function exportVouchersCsv() {
  const headers = ['Voucher #', 'Date', 'Type', 'Payee / Recipient', 'Tag / Category', 'Remarks', 'Payment Method', 'Currency', 'Amount', 'Status'];
  let list = cachedVouchers || [];
  if (voucherYearFilter && voucherYearFilter !== 'ALL') {
    list = list.filter((v) => getVoucherYear(v) === voucherYearFilter);
  }
  const rows = list.map((v) => [
    v.voucherNumber,
    new Date(v.voucherDate || v.createdAt).toISOString().slice(0, 10),
    v.voucherType,
    v.recipient || v.recipientName || '',
    v.tag || (v.referenceType !== 'MANUAL' ? v.referenceType : '') || '',
    v.notes || '',
    v.paymentMethod || 'STANDARD',
    v.currency || 'PHP',
    (v.amountCents / 100).toFixed(2),
    v.status || 'POSTED',
  ]);
  const yrSuffix = voucherYearFilter && voucherYearFilter !== 'ALL' ? '_' + voucherYearFilter : '';
  exportToCsv('vouchers_export' + yrSuffix + '_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function exportLedgerCsv() {
  const headers = ['Entry Date', 'Voucher Type', 'Account Code', 'Account Name', 'Debit (PHP)', 'Credit (PHP)', 'Description'];
  const rows = (cachedLedgerEntries || []).map((e) => [
    new Date(e.createdAt).toISOString().slice(0, 10),
    e.voucherType,
    e.account?.code || '',
    e.account?.name || '',
    (e.debitCents / 100).toFixed(2),
    (e.creditCents / 100).toFixed(2),
    e.description || '',
  ]);
  exportToCsv('general_ledger_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function exportTrialBalanceCsv() {
  const accounts = state.trialBalance?.accounts || cachedAccounts || [];
  const headers = ['Account Code', 'Account Name', 'Type', 'Total Debits (PHP)', 'Total Credits (PHP)', 'Net Balance (PHP)'];
  const rows = accounts.map((a) => [
    a.code,
    a.name,
    a.type,
    ((a.totalDebitCents || 0) / 100).toFixed(2),
    ((a.totalCreditCents || 0) / 100).toFixed(2),
    ((a.netBalanceCents || 0) / 100).toFixed(2),
  ]);
  exportToCsv('trial_balance_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function exportProfitLossCsv() {
  if (!cachedProfitLoss) {
    showToast('P&L report is not loaded yet', 'error');
    return;
  }
  const pl = cachedProfitLoss;
  const headers = ['Category', 'Account Code', 'Account Name', 'Amount (PHP)', '% of Revenue'];
  const rows = [];

  rows.push(['OPERATING REVENUES', '', '', '', '']);
  (pl.revenues || []).forEach((r) => {
    const pct = pl.totalRevenueCents > 0 ? ((r.amountCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%';
    rows.push(['Revenue', r.code, r.name, (r.amountCents / 100).toFixed(2), pct]);
  });
  rows.push(['TOTAL OPERATING REVENUE', '', '', (pl.totalRevenueCents / 100).toFixed(2), '100.00%']);

  rows.push(['COST OF GOODS SOLD', '', '', '', '']);
  (pl.cogs || []).forEach((c) => {
    const pct = pl.totalRevenueCents > 0 ? ((c.amountCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%';
    rows.push(['COGS', c.code, c.name, (c.amountCents / 100).toFixed(2), pct]);
  });
  rows.push(['TOTAL COST OF GOODS SOLD', '', '', (pl.totalCogsCents / 100).toFixed(2), pl.totalRevenueCents > 0 ? ((pl.totalCogsCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%']);
  rows.push(['GROSS PROFIT', '', '', (pl.grossProfitCents / 100).toFixed(2), pl.grossMarginPct + '%']);

  rows.push(['OPERATING EXPENSES (OPEX)', '', '', '', '']);
  (pl.operatingExpenses || []).forEach((o) => {
    const pct = pl.totalRevenueCents > 0 ? ((o.amountCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%';
    rows.push(['Operating Expense', o.code, o.name, (o.amountCents / 100).toFixed(2), pct]);
  });
  rows.push(['TOTAL OPERATING EXPENSES', '', '', (pl.totalOpexCents / 100).toFixed(2), pl.totalRevenueCents > 0 ? ((pl.totalOpexCents / pl.totalRevenueCents) * 100).toFixed(2) + '%' : '0.00%']);
  rows.push(['NET INCOME / (LOSS)', '', '', (pl.netIncomeCents / 100).toFixed(2), pl.netMarginPct + '%']);

  exportToCsv('profit_and_loss_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function exportBalanceSheetCsv() {
  if (!cachedBalanceSheet) {
    showToast('Balance sheet is not loaded yet', 'error');
    return;
  }
  const bs = cachedBalanceSheet;
  const headers = ['Category', 'Account Code', 'Account Name', 'Amount (PHP)'];
  const rows = [];

  rows.push(['CURRENT ASSETS', '', '', '']);
  (bs.assets?.current || []).forEach((a) => rows.push(['Current Asset', a.code, a.name, (a.amountCents / 100).toFixed(2)]));
  rows.push(['NON-CURRENT ASSETS', '', '', '']);
  (bs.assets?.nonCurrent || []).forEach((a) => rows.push(['Non-Current Asset', a.code, a.name, (a.amountCents / 100).toFixed(2)]));
  rows.push(['TOTAL ASSETS', '', '', (bs.totalAssetsCents / 100).toFixed(2)]);

  rows.push(['CURRENT LIABILITIES', '', '', '']);
  (bs.liabilities?.current || []).forEach((l) => rows.push(['Current Liability', l.code, l.name, (l.amountCents / 100).toFixed(2)]));
  rows.push(['NON-CURRENT LIABILITIES', '', '', '']);
  (bs.liabilities?.nonCurrent || []).forEach((l) => rows.push(['Non-Current Liability', l.code, l.name, (l.amountCents / 100).toFixed(2)]));
  rows.push(['TOTAL LIABILITIES', '', '', (bs.liabilities?.totalLiabilitiesCents / 100).toFixed(2)]);

  rows.push(['EQUITY', '', '', '']);
  (bs.equity?.items || []).forEach((e) => rows.push(['Equity', e.code, e.name, (e.amountCents / 100).toFixed(2)]));
  rows.push(['Current Period Net Income', '', '', (bs.equity?.currentPeriodNetIncomeCents / 100).toFixed(2)]);
  rows.push(['TOTAL EQUITY', '', '', (bs.equity?.totalEquityCents / 100).toFixed(2)]);
  rows.push(['TOTAL LIABILITIES & EQUITY', '', '', (bs.totalLiabilitiesAndEquityCents / 100).toFixed(2)]);

  exportToCsv('balance_sheet_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function exportCashFlowCsv() {
  if (!cachedCashFlow) {
    showToast('Cash flow report is not loaded yet', 'error');
    return;
  }
  const cf = cachedCashFlow;
  const headers = ['Section', 'Description', 'Date', 'Amount (PHP)'];
  const rows = [];

  rows.push(['OPERATING INFLOWS', '', '', '']);
  (cf.operatingActivities?.inflows || []).forEach((i) => rows.push(['Operating Inflow', i.description, new Date(i.date).toISOString().slice(0, 10), (i.amountCents / 100).toFixed(2)]));
  rows.push(['OPERATING OUTFLOWS', '', '', '']);
  (cf.operatingActivities?.outflows || []).forEach((o) => rows.push(['Operating Outflow', o.description, new Date(o.date).toISOString().slice(0, 10), (o.amountCents / 100).toFixed(2)]));
  rows.push(['NET OPERATING CASH FLOW', '', '', (cf.operatingActivities?.netOperatingCashCents / 100).toFixed(2)]);

  rows.push(['INVESTING ACTIVITIES', '', '', '']);
  (cf.investingActivities?.items || []).forEach((i) => rows.push(['Investing Activity', i.description, new Date(i.date).toISOString().slice(0, 10), (i.amountCents / 100).toFixed(2)]));
  rows.push(['NET INVESTING CASH FLOW', '', '', (cf.investingActivities?.netInvestingCashCents / 100).toFixed(2)]);

  rows.push(['FINANCING ACTIVITIES', '', '', '']);
  (cf.financingActivities?.items || []).forEach((f) => rows.push(['Financing Activity', f.description, new Date(f.date).toISOString().slice(0, 10), (f.amountCents / 100).toFixed(2)]));
  rows.push(['NET FINANCING CASH FLOW', '', '', (cf.financingActivities?.netFinancingCashCents / 100).toFixed(2)]);
  rows.push(['NET CHANGE IN CASH / ENDING CASH', '', '', (cf.closingCashCents / 100).toFixed(2)]);

  exportToCsv('cash_flow_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function renderAccountingContent(container, tbJson, accounts, entries, vouchers, rawAccounts) {
  const isBalanced = tbJson.isBalanced;

  // Generate years from current year up to 2030 (plus any existing voucher years)
  const currentYear = getCurrentAccountingYear();
  const currentYearNum = parseInt(currentYear, 10);
  const allYearsSet = new Set();
  for (let y = currentYearNum; y <= 2030; y++) {
    allYearsSet.add(y.toString());
  }
  (vouchers || []).forEach((v) => {
    const vy = getVoucherYear(v);
    if (vy) allYearsSet.add(vy);
  });
  const availableYears = Array.from(allYearsSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const yearFilterOptions = availableYears
    .map((y) => '<option value="' + y + '"' + (voucherYearFilter === y ? ' selected' : '') + '>' + y + (y === currentYear ? ' (Current)' : '') + '</option>')
    .concat(['<option value="ALL"' + (voucherYearFilter === 'ALL' ? ' selected' : '') + '>All Years</option>'])
    .join('');

  // Filter vouchers according to selected sub-tab, year filter, and search query
  let filteredVouchers = vouchers;
  if (accountingActiveTab === 'vouchers-pv') {
    filteredVouchers = vouchers.filter((v) => v.voucherType === 'PAYMENT');
  } else if (accountingActiveTab === 'vouchers-rv') {
    filteredVouchers = vouchers.filter((v) => v.voucherType === 'RECEIPT');
  } else if (accountingActiveTab === 'vouchers-jv') {
    filteredVouchers = vouchers.filter((v) => v.voucherType === 'JOURNAL');
  } else if (accountingActiveTab === 'vouchers-declined') {
    filteredVouchers = vouchers.filter((v) => v.status === 'VOID' || v.status === 'DECLINED');
  }

  // Apply Year Filter
  if (voucherYearFilter && voucherYearFilter !== 'ALL') {
    filteredVouchers = filteredVouchers.filter((v) => getVoucherYear(v) === voucherYearFilter);
  }

  // Apply Search Query Filter
  if (voucherSearchQuery) {
    filteredVouchers = filteredVouchers.filter((v) => {
      const num = (v.voucherNumber || '').toLowerCase();
      const rec = (v.recipient || v.recipientName || '').toLowerCase();
      const notes = (v.notes || '').toLowerCase();
      const method = (v.paymentMethod || '').toLowerCase();
      return num.includes(voucherSearchQuery) || rec.includes(voucherSearchQuery) || notes.includes(voucherSearchQuery) || method.includes(voucherSearchQuery);
    });
  }

  // Sort by last updated voucher (or created / voucherDate) descending
  filteredVouchers.sort((a, b) => {
    const timeB = new Date(b.updatedAt || b.createdAt || b.voucherDate || 0).getTime();
    const timeA = new Date(a.updatedAt || a.createdAt || a.voucherDate || 0).getTime();
    return timeB - timeA;
  });

  const voucherTypeBadges = {
    PAYMENT: 'badge-danger',
    RECEIPT: 'badge-success',
    JOURNAL: 'badge-primary',
  };

  const isAdmin = state.user && state.user.role === 'ADMIN';

  const voucherRows = filteredVouchers.map((v) => {
    const isPayment = v.voucherType === 'PAYMENT';
    const isReceipt = v.voucherType === 'RECEIPT';
    const amountColor = isPayment ? '#dc2626' : isReceipt ? '#059669' : '#1d4ed8';
    const amountPrefix = isPayment ? '- ' : isReceipt ? '+ ' : '';

    const rawDate = v.voucherDate || v.createdAt;
    let formattedDate = '—';
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    // Extract tag & category
    let tag = v.tag || v.referenceType || '';
    if (tag === 'MANUAL' || tag === 'DIRECT_RECEIPT') tag = '';
    else if (tag === 'PURCHASE_ORDER') tag = 'PO Procurement';
    else if (tag === 'PAYROLL_RUN') tag = 'Payroll';
    else if (tag === 'INVOICE' || tag === 'SALES_INVOICE') tag = 'Sales Invoice';
    else if (tag === 'CONTRA_TRANSFER') tag = 'Contra Transfer';
    let tagBadgeHtml = '<span style="color: #cbd5e1; font-size: 0.8rem;">—</span>';
    if (tag) {
      tagBadgeHtml = `<span class="badge badge-neutral" style="font-size: 0.7rem; padding: 0.15rem 0.45rem; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; font-weight: 600; white-space: nowrap; max-width: 95px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;" title="#${tag}"><span style="color: #94a3b8; margin-right: 2px;">#</span>${tag}</span>`;
    }

    // Extract remarks / notes with tooltip & ellipsis (...)
    let remarksText = v.notes || '';
    if (!remarksText && v.items && v.items.length > 0) {
      remarksText = v.items.map((it) => it.description).filter(Boolean).join(', ');
    }
    const cleanRemarks = remarksText.trim();
    const remarksHtml = cleanRemarks
      ? `<div style="max-width: 105px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.78rem; color: #64748b;" title="${cleanRemarks.replace(/"/g, '&quot;')}">${cleanRemarks}</div>`
      : `<span style="color: #cbd5e1; font-size: 0.8rem;">—</span>`;

    const status = v.status || 'POSTED';
    let statusBadgeClass = 'badge-success';
    let statusLabel = 'Posted';
    if (status === 'VOID' || status === 'DECLINED') {
      statusBadgeClass = 'badge-danger';
      statusLabel = 'Declined';
    } else if (status === 'DRAFT' || status === 'PENDING') {
      statusBadgeClass = 'badge-warning';
      statusLabel = 'Pending Approval';
    }

    let adminButtonsHtml = '';
    const canUpdate = can('accounting', 'update');
    const canDelete = can('accounting', 'delete');

    if (canUpdate) {
      adminButtonsHtml += `
        <button type="button" class="icon-btn icon-btn-edit has-tooltip" data-tooltip="Edit Voucher" onclick="openEditVoucherModal('${v.id}')" aria-label="Edit Voucher">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
      `;

      if (status === 'DRAFT' || status === 'PENDING') {
        adminButtonsHtml += `
          <button type="button" class="icon-btn icon-btn-approve has-tooltip" data-tooltip="Accept / Approve" onclick="handleApproveVoucher('${v.id}')" aria-label="Approve Voucher">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <button type="button" class="icon-btn icon-btn-decline has-tooltip" data-tooltip="Decline Voucher" onclick="handleDeclineVoucher('${v.id}')" aria-label="Decline Voucher">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `;
      } else if (status === 'POSTED') {
        adminButtonsHtml += `
          <button type="button" class="icon-btn icon-btn-decline has-tooltip" data-tooltip="Decline / Void" onclick="handleDeclineVoucher('${v.id}')" aria-label="Decline Voucher">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `;
      } else if (status === 'VOID' || status === 'DECLINED') {
        adminButtonsHtml += `
          <button type="button" class="icon-btn icon-btn-restore has-tooltip" data-tooltip="Restore Voucher" onclick="handleRestoreVoucher('${v.id}')" aria-label="Restore Voucher">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          </button>
        `;
      }
    }

    if (canDelete) {
      adminButtonsHtml += `
        <button type="button" class="icon-btn icon-btn-delete has-tooltip" data-tooltip="Delete Voucher" onclick="handleDeleteVoucher('${v.id}', '${v.voucherNumber}')" aria-label="Delete Voucher">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;
    }

    return `
      <tr>
        <td class="td-voucher-num" data-label="Voucher #">
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="font-size: 1.05rem; line-height: 1;">🧾</span>
            <strong style="font-family: 'JetBrains Mono', monospace; font-size: 0.88rem; color: #0f172a;">${v.voucherNumber}</strong>
          </div>
          <div class="pv-card-amount" style="font-weight: 800; color: ${amountColor}; font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; white-space: nowrap;">
            ${amountPrefix}${formatCurrency(v.amountCents, v.currency || 'PHP')}
          </div>
        </td>
        <td class="td-date" data-label="Date"><span style="font-size: 0.83rem; color: #334155; font-weight: 500; white-space: nowrap;">${formattedDate}</span></td>
        <td class="td-type" data-label="Type"><span class="badge ${voucherTypeBadges[v.voucherType] || 'badge-neutral'}"><span class="badge-dot"></span>${v.voucherType}</span></td>
        <td class="td-recipient" data-label="Payee / Payer">
          <div style="max-width: 135px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 0.35rem;" title="${escapeHtml(v.recipient || '-')}">
            <span style="color: #64748b; font-size: 0.85rem; flex-shrink: 0;">🏢</span>
            <strong style="font-size: 0.84rem; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(v.recipient || '-')}</strong>
          </div>
        </td>
        <td class="td-tag" data-label="Tag / Category">${tagBadgeHtml}</td>
        <td class="td-remarks" data-label="Remarks">${remarksHtml}</td>
        <td class="td-method" data-label="Payment Method"><span class="badge badge-neutral" style="font-size: 0.74rem; white-space: nowrap;">${(v.paymentMethod || 'STANDARD').replace('_', ' ')}</span></td>
        <td class="td-amount" data-label="Total Amount" style="font-weight: 700; color: ${amountColor}; font-family: 'JetBrains Mono', monospace; font-size: 0.88rem; white-space: nowrap;">
          ${amountPrefix}${formatCurrency(v.amountCents, v.currency || 'PHP')}
        </td>
        <td class="td-status" data-label="Status"><span class="badge ${statusBadgeClass}"><span class="badge-dot"></span>${statusLabel}</span></td>
        <td class="td-actions" data-label="Actions">
          <div class="action-btn-group">
            <button type="button" class="icon-btn icon-btn-view has-tooltip" data-tooltip="View Official Slip" onclick="openVoucherSlipModal('${v.id}')" aria-label="View Official Slip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button type="button" class="icon-btn btn-history-badge-container has-tooltip" data-tooltip="Voucher History & Audit Trail (${v.historyCount || 0} record${(v.historyCount || 0) === 1 ? '' : 's'})" onclick="openVoucherHistoryModal('${v.id}')" aria-label="Voucher History">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span class="history-count-badge ${(v.historyCount || 0) > 0 ? 'has-records' : 'zero-records'}">${v.historyCount || 0}</span>
            </button>
            ${adminButtonsHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  let accRows = '';
  accounts.forEach((acc) => {
    accRows += `
      <tr>
        <td><strong style="font-family: 'JetBrains Mono', monospace;">${acc.code}</strong></td>
        <td>${acc.name}</td>
        <td><span class="badge badge-primary">${acc.type}</span></td>
        <td style="font-family: 'JetBrains Mono', monospace;">${formatCurrency(acc.totalDebitCents)}</td>
        <td style="font-family: 'JetBrains Mono', monospace;">${formatCurrency(acc.totalCreditCents)}</td>
        <td style="font-weight: 700; font-family: 'JetBrains Mono', monospace;">${formatCurrency(acc.netBalanceCents)}</td>
      </tr>
    `;
  });

  let ledgerRows = '';
  entries.slice(0, 50).forEach((e) => {
    ledgerRows += `
      <tr>
        <td>${new Date(e.createdAt).toLocaleDateString()}</td>
        <td><span class="badge badge-neutral"><span class="badge-dot"></span>${e.voucherType}</span></td>
        <td><strong style="font-family: 'JetBrains Mono', monospace;">${e.account?.code}</strong> ${e.account?.name || ''}</td>
        <td style="color: #059669; font-weight: 600; font-family: 'JetBrains Mono', monospace;">${e.debitCents > 0 ? formatCurrency(e.debitCents) : '—'}</td>
        <td style="color: #dc2626; font-weight: 600; font-family: 'JetBrains Mono', monospace;">${e.creditCents > 0 ? formatCurrency(e.creditCents) : '—'}</td>
        <td style="font-size: 0.8rem; color: #64748b;">${e.description || '—'}</td>
      </tr>
    `;
  });

  const tabs = [
    { id: 'vouchers-pv', label: '📤 Payments (PV)', count: vouchers.filter((x) => x.voucherType === 'PAYMENT').length },
    { id: 'vouchers-rv', label: '📥 Receipts (RV)', count: vouchers.filter((x) => x.voucherType === 'RECEIPT').length },
    { id: 'vouchers-jv', label: '⚖️ Journals (JV)', count: vouchers.filter((x) => x.voucherType === 'JOURNAL').length },
    { id: 'vouchers-declined', label: '🚫 Declined (Void)', count: vouchers.filter((x) => x.status === 'VOID' || x.status === 'DECLINED').length },
    { id: 'trial-balance', label: '📑 Chart of Accounts & TB', count: accounts.length },
    { id: 'general-ledger', label: '📜 General Ledger Audit', count: entries.length },
    { id: 'reports-pl', label: '📈 Profit & Loss (P&L)', count: 'P&L' },
    { id: 'reports-bs', label: '🏛️ Balance Sheet (BS)', count: 'BS' },
    { id: 'reports-cf', label: '💵 Cash Flow (CF)', count: 'CF' },
  ];

  const subNavHtml = tabs.map((t) => {
    const active = accountingActiveTab === t.id;
    return `
      <button type="button" onclick="switchAccountingTab('${t.id}')" style="padding: 0.5rem 1rem; border-radius: 999px; font-size: 0.82rem; font-weight: 600; border: 1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}; background: ${active ? 'var(--primary)' : '#ffffff'}; color: ${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        ${t.label} <span style="opacity: 0.75;">(${t.count})</span>
      </button>
    `;
  }).join('');

  let exportButtonHtml = '';
  if (accountingActiveTab.startsWith('vouchers')) {
    exportButtonHtml = `<button class="btn btn-secondary btn-sm" onclick="exportVouchersCsv()">📥 Export Vouchers CSV</button>`;
  } else if (accountingActiveTab === 'trial-balance') {
    exportButtonHtml = `<button class="btn btn-secondary btn-sm" onclick="exportTrialBalanceCsv()">📥 Export TB CSV</button>`;
  } else if (accountingActiveTab === 'general-ledger') {
    exportButtonHtml = `<button class="btn btn-secondary btn-sm" onclick="exportLedgerCsv()">📥 Export Ledger CSV</button>`;
  } else if (accountingActiveTab === 'reports-pl') {
    exportButtonHtml = `
      <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print P&L</button>
      <button class="btn btn-secondary btn-sm" onclick="exportProfitLossCsv()">📥 Export P&L CSV</button>
    `;
  } else if (accountingActiveTab === 'reports-bs') {
    exportButtonHtml = `
      <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print Balance Sheet</button>
      <button class="btn btn-secondary btn-sm" onclick="exportBalanceSheetCsv()">📥 Export BS CSV</button>
    `;
  } else if (accountingActiveTab === 'reports-cf') {
    exportButtonHtml = `
      <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print Cash Flow</button>
      <button class="btn btn-secondary btn-sm" onclick="exportCashFlowCsv()">📥 Export CF CSV</button>
    `;
  }

  let mainSectionHtml = '';

  if (accountingActiveTab.startsWith('vouchers')) {
    const accViewClass = voucherActiveViewMode === 'cards' ? ' view-mode-cards' : (voucherActiveViewMode === 'table' ? ' view-mode-table' : '');
    mainSectionHtml = `
      <div style="padding: 0.75rem 1.35rem 0.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; flex: 1;">
          <div style="flex: 1; max-width: 320px; min-width: 180px;">
            <input id="accounting-voucher-search-input" type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" placeholder="Search voucher #, payee, or notes..." value="${voucherSearchQuery}" oninput="handleVoucherSearch(this.value)" />
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <label style="font-size: 0.8rem; font-weight: 700; color: #475569; white-space: nowrap;">📅 Year:</label>
            <select class="form-select" style="padding: 0.42rem 0.75rem; font-size: 0.82rem; font-weight: 600; min-width: 130px; border-radius: 6px;" onchange="handleVoucherYearFilter(this.value)">
              ${yearFilterOptions}
            </select>
          </div>
          <div class="btn-view-mode-group" title="Switch table display layout">
            <button type="button" class="btn-view-mode${voucherActiveViewMode === 'table' ? ' active' : ''}" onclick="handleVoucherActiveViewMode('table')" title="Compact Table View">
              ☰ Table
            </button>
            <button type="button" class="btn-view-mode${voucherActiveViewMode === 'cards' ? ' active' : ''}" onclick="handleVoucherActiveViewMode('cards')" title="Cascade Wrap Cards View">
              ⊞ Wrap Cards
            </button>
            <button type="button" class="btn-view-mode" onclick="if (typeof loadAccounting === 'function') loadAccounting(); if (typeof loadVouchers === 'function') loadVouchers();" title="Reload Vouchers" aria-label="Reload Vouchers" style="display: inline-flex; align-items: center; justify-content: center; padding: 0.35rem 0.6rem; font-size: 0.85rem;">
              🔄
            </button>
          </div>
        </div>
        <div>
          ${exportButtonHtml}
        </div>
      </div>
      <div class="table-responsive table-responsive-cascade">
        <table class="data-table responsive-cascade-table pv-compact-table${accViewClass}">
          <thead>
            <tr>
              <th>Voucher #</th>
              <th>Date</th>
              <th>Type</th>
              <th>Payee / Payer</th>
              <th>Tag / Category</th>
              <th>Remarks</th>
              <th>Payment Method</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th style="text-align: right;" class="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${(voucherRows && voucherRows.length > 0) ? voucherRows.join('') : '<tr class="empty-row"><td colspan="10" style="text-align: center; color: #64748b; padding: 2.5rem;">No vouchers found' + (voucherYearFilter !== 'ALL' ? ' for year ' + voucherYearFilter : '') + ' in this category.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } else if (accountingActiveTab === 'reports-pl') {
    const pl = cachedProfitLoss || {
      totalRevenueCents: 0,
      totalCogsCents: 0,
      grossProfitCents: 0,
      grossMarginPct: 0,
      totalOpexCents: 0,
      netIncomeCents: 0,
      netMarginPct: 0,
      revenues: [],
      cogs: [],
      operatingExpenses: [],
    };

    const isProfitable = pl.netIncomeCents >= 0;

    let revRows = (pl.revenues || []).map((r) => {
      const pct = pl.totalRevenueCents > 0 ? ((r.amountCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%';
      return `
        <tr>
          <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">${r.code}</strong> ${r.name}</td>
          <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #059669;">${formatCurrency(r.amountCents)}</td>
          <td style="text-align: right; color: #64748b; font-size: 0.82rem;">${pct}</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No revenue entries recorded</td></tr>`;

    let cogsRows = (pl.cogs || []).map((c) => {
      const pct = pl.totalRevenueCents > 0 ? ((c.amountCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%';
      return `
        <tr>
          <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">${c.code}</strong> ${c.name}</td>
          <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #dc2626;">${formatCurrency(c.amountCents)}</td>
          <td style="text-align: right; color: #64748b; font-size: 0.82rem;">${pct}</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No direct cost of goods recorded</td></tr>`;

    let opexRows = (pl.operatingExpenses || []).map((o) => {
      const pct = pl.totalRevenueCents > 0 ? ((o.amountCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%';
      return `
        <tr>
          <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">${o.code}</strong> ${o.name}</td>
          <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #d97706;">${formatCurrency(o.amountCents)}</td>
          <td style="text-align: right; color: #64748b; font-size: 0.82rem;">${pct}</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No operating expenses recorded</td></tr>`;

    mainSectionHtml = `
      <div style="padding: 1rem 1.35rem;">
        <!-- KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Revenue</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #059669; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(pl.totalRevenueCents)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Gross Profit</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #0f172a; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(pl.grossProfitCents)}</div>
            <div style="font-size: 0.75rem; color: #64748b;">Margin: ${pl.grossMarginPct}%</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Operating Expenses</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #dc2626; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(pl.totalOpexCents)}</div>
          </div>
          <div style="background: ${isProfitable ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isProfitable ? '#bbf7d0' : '#fecaca'}; border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: ${isProfitable ? '#15803d' : '#b91c1c'}; text-transform: uppercase;">Net ${isProfitable ? 'Profit' : 'Loss'}</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: ${isProfitable ? '#15803d' : '#b91c1c'}; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(pl.netIncomeCents)}</div>
            <div style="font-size: 0.75rem; color: ${isProfitable ? '#15803d' : '#b91c1c'};">Net Margin: ${pl.netMarginPct}%</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Statement of Comprehensive Income (Profit & Loss)</h3>
          <div style="display: flex; gap: 0.5rem;">
            ${exportButtonHtml}
          </div>
        </div>

        <!-- Official Financial Statement Table -->
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: #ffffff;">
          <table class="data-table" style="margin-bottom: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>Line Item / Account Description</th>
                <th style="text-align: right; width: 180px;">Amount (PHP)</th>
                <th style="text-align: right; width: 120px;">% of Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #f1f5f9;"><td colspan="3"><strong>I. OPERATING REVENUES</strong></td></tr>
              ${revRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Operating Revenue</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #059669;">${formatCurrency(pl.totalRevenueCents)}</td>
                <td style="text-align: right;">100.0%</td>
              </tr>

              <tr style="background: #f1f5f9;"><td colspan="3"><strong>II. COST OF GOODS SOLD (COGS)</strong></td></tr>
              ${cogsRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Cost of Goods Sold</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #dc2626;">(${formatCurrency(pl.totalCogsCents)})</td>
                <td style="text-align: right;">${pl.totalRevenueCents > 0 ? ((pl.totalCogsCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%'}</td>
              </tr>

              <tr style="background: #e2e8f0; font-weight: 800; font-size: 0.95rem;">
                <td>GROSS PROFIT</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">${formatCurrency(pl.grossProfitCents)}</td>
                <td style="text-align: right;">${pl.grossMarginPct}%</td>
              </tr>

              <tr style="background: #f1f5f9;"><td colspan="3"><strong>III. OPERATING EXPENSES (OPEX)</strong></td></tr>
              ${opexRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Operating Expenses</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #d97706;">(${formatCurrency(pl.totalOpexCents)})</td>
                <td style="text-align: right;">${pl.totalRevenueCents > 0 ? ((pl.totalOpexCents / pl.totalRevenueCents) * 100).toFixed(1) + '%' : '0.0%'}</td>
              </tr>

              <tr style="background: ${isProfitable ? '#dcfce7' : '#fee2e2'}; font-weight: 800; font-size: 1rem; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
                <td>NET INCOME / (NET LOSS)</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: ${isProfitable ? '#15803d' : '#b91c1c'};">${formatCurrency(pl.netIncomeCents)}</td>
                <td style="text-align: right; color: ${isProfitable ? '#15803d' : '#b91c1c'};">${pl.netMarginPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (accountingActiveTab === 'reports-bs') {
    const bs = cachedBalanceSheet || {
      totalAssetsCents: 0,
      totalLiabilitiesCents: 0,
      totalLiabilitiesAndEquityCents: 0,
      discrepancyCents: 0,
      isBalanced: true,
      assets: { current: [], nonCurrent: [], totalAssetsCents: 0 },
      liabilities: { current: [], nonCurrent: [], totalLiabilitiesCents: 0 },
      equity: { items: [], currentPeriodNetIncomeCents: 0, totalEquityCents: 0 },
    };

    let curAssetRows = (bs.assets?.current || []).map((a) => `
      <tr>
        <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">${a.code}</strong> ${a.name}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatCurrency(a.amountCents)}</td>
      </tr>
    `).join('') || `<tr><td colspan="2" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No current asset balances</td></tr>`;

    let nonCurAssetRows = (bs.assets?.nonCurrent || []).map((a) => `
      <tr>
        <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">${a.code}</strong> ${a.name}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatCurrency(a.amountCents)}</td>
      </tr>
    `).join('') || `<tr><td colspan="2" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No non-current asset balances</td></tr>`;

    let curLiabRows = (bs.liabilities?.current || []).map((l) => `
      <tr>
        <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">${l.code}</strong> ${l.name}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatCurrency(l.amountCents)}</td>
      </tr>
    `).join('') || `<tr><td colspan="2" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No current liability balances</td></tr>`;

    let eqRows = (bs.equity?.items || []).map((e) => `
      <tr>
        <td style="padding-left: 1.5rem;"><strong style="font-family: 'JetBrains Mono', monospace;">${e.code}</strong> ${e.name}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatCurrency(e.amountCents)}</td>
      </tr>
    `).join('') || `<tr><td colspan="2" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No base equity entries</td></tr>`;

    mainSectionHtml = `
      <div style="padding: 1rem 1.35rem;">
        <!-- KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Assets</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #0284c7; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(bs.totalAssetsCents)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Liabilities</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #dc2626; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(bs.liabilities?.totalLiabilitiesCents || 0)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Equity (incl. Net Profit)</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #059669; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(bs.equity?.totalEquityCents || 0)}</div>
          </div>
          <div style="background: ${bs.isBalanced ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${bs.isBalanced ? '#bbf7d0' : '#fecaca'}; border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: ${bs.isBalanced ? '#15803d' : '#b91c1c'}; text-transform: uppercase;">Equilibrium Status</div>
            <div style="font-size: 1.15rem; font-weight: 700; color: ${bs.isBalanced ? '#15803d' : '#b91c1c'}; margin-top: 0.25rem;">${bs.isBalanced ? '✓ Balanced (A = L + E)' : '⚠ Discrepancy'}</div>
            <div style="font-size: 0.75rem; color: #64748b;">Diff: ${formatCurrency(Math.abs(bs.discrepancyCents || 0))}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Statement of Financial Position (Balance Sheet)</h3>
          <div style="display: flex; gap: 0.5rem;">
            ${exportButtonHtml}
          </div>
        </div>

        <!-- Official Balance Sheet Table -->
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: #ffffff;">
          <table class="data-table" style="margin-bottom: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>Account & Classification</th>
                <th style="text-align: right; width: 220px;">Balance (PHP)</th>
              </tr>
            </thead>
            <tbody>
              <!-- ASSETS -->
              <tr style="background: #e0f2fe;"><td colspan="2"><strong style="color: #0369a1;">1. ASSETS</strong></td></tr>
              <tr style="background: #f1f5f9;"><td colspan="2"><strong>Current Assets</strong></td></tr>
              ${curAssetRows}
              <tr style="background: #f1f5f9;"><td colspan="2"><strong>Non-Current & Fixed Assets</strong></td></tr>
              ${nonCurAssetRows}
              <tr style="background: #bae6fd; font-weight: 800; font-size: 0.95rem; border-top: 1px solid #7dd3fc;">
                <td>TOTAL ASSETS</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #0369a1;">${formatCurrency(bs.totalAssetsCents)}</td>
              </tr>

              <!-- LIABILITIES -->
              <tr style="background: #fee2e2;"><td colspan="2"><strong style="color: #b91c1c;">2. LIABILITIES</strong></td></tr>
              <tr style="background: #f1f5f9;"><td colspan="2"><strong>Current Liabilities</strong></td></tr>
              ${curLiabRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Liabilities</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #dc2626;">${formatCurrency(bs.liabilities?.totalLiabilitiesCents || 0)}</td>
              </tr>

              <!-- EQUITY -->
              <tr style="background: #dcfce7;"><td colspan="2"><strong style="color: #15803d;">3. OWNER'S EQUITY & RETAINED EARNINGS</strong></td></tr>
              ${eqRows}
              <tr>
                <td style="padding-left: 1.5rem;">Current Period Net Income / (Loss)</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #15803d;">${formatCurrency(bs.equity?.currentPeriodNetIncomeCents || 0)}</td>
              </tr>
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700;">
                <td>Total Equity</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #15803d;">${formatCurrency(bs.equity?.totalEquityCents || 0)}</td>
              </tr>

              <!-- TOTAL LIABILITIES & EQUITY -->
              <tr style="background: #f8fafc; font-weight: 800; font-size: 1rem; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
                <td>TOTAL LIABILITIES & EQUITY</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #0f172a;">${formatCurrency(bs.totalLiabilitiesAndEquityCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (accountingActiveTab === 'reports-cf') {
    const cf = cachedCashFlow || {
      operatingActivities: { inflows: [], outflows: [], totalInflowCents: 0, totalOutflowCents: 0, netOperatingCashCents: 0 },
      investingActivities: { items: [], netInvestingCashCents: 0 },
      financingActivities: { items: [], netFinancingCashCents: 0 },
      netCashFlowCents: 0,
      closingCashCents: 0,
    };

    let opInRows = (cf.operatingActivities?.inflows || []).map((i) => `
      <tr>
        <td style="padding-left: 1.5rem;">${i.description}</td>
        <td style="color: #64748b; font-size: 0.8rem;">${new Date(i.date).toLocaleDateString()}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #059669;">+ ${formatCurrency(i.amountCents)}</td>
      </tr>
    `).join('') || `<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No operating inflows</td></tr>`;

    let opOutRows = (cf.operatingActivities?.outflows || []).map((o) => `
      <tr>
        <td style="padding-left: 1.5rem;">${o.description}</td>
        <td style="color: #64748b; font-size: 0.8rem;">${new Date(o.date).toLocaleDateString()}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #dc2626;">- ${formatCurrency(o.amountCents)}</td>
      </tr>
    `).join('') || `<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No operating disbursements</td></tr>`;

    let invRows = (cf.investingActivities?.items || []).map((i) => `
      <tr>
        <td style="padding-left: 1.5rem;">${i.description}</td>
        <td style="color: #64748b; font-size: 0.8rem;">${new Date(i.date).toLocaleDateString()}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatCurrency(i.amountCents)}</td>
      </tr>
    `).join('') || `<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No investing cash flows</td></tr>`;

    let finRows = (cf.financingActivities?.items || []).map((f) => `
      <tr>
        <td style="padding-left: 1.5rem;">${f.description}</td>
        <td style="color: #64748b; font-size: 0.8rem;">${new Date(f.date).toLocaleDateString()}</td>
        <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatCurrency(f.amountCents)}</td>
      </tr>
    `).join('') || `<tr><td colspan="3" style="padding-left: 1.5rem; color: #94a3b8; font-style: italic;">No financing cash flows</td></tr>`;

    mainSectionHtml = `
      <div style="padding: 1rem 1.35rem;">
        <!-- KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Net Operating Cash</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #059669; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(cf.operatingActivities?.netOperatingCashCents || 0)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Net Investing Cash</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #0284c7; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(cf.investingActivities?.netInvestingCashCents || 0)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Net Financing Cash</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #7c3aed; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(cf.financingActivities?.netFinancingCashCents || 0)}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.78rem; font-weight: 600; color: #15803d; text-transform: uppercase;">Ending Cash Balance</div>
            <div style="font-size: 1.35rem; font-weight: 700; color: #15803d; font-family: 'JetBrains Mono', monospace; margin-top: 0.25rem;">${formatCurrency(cf.closingCashCents)}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Statement of Cash Flows (Direct Method)</h3>
          <div style="display: flex; gap: 0.5rem;">
            ${exportButtonHtml}
          </div>
        </div>

        <!-- Official Cash Flow Table -->
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: #ffffff;">
          <table class="data-table" style="margin-bottom: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>Cash Flow Activity & Description</th>
                <th style="width: 140px;">Date</th>
                <th style="text-align: right; width: 180px;">Amount (PHP)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Operating Cash Flows -->
              <tr style="background: #f1f5f9;"><td colspan="3"><strong>1. CASH FLOWS FROM OPERATING ACTIVITIES</strong></td></tr>
              <tr><td colspan="3" style="font-weight: 600; color: #059669; padding-left: 1rem;">Cash Receipts & Inflows</td></tr>
              ${opInRows}
              <tr><td colspan="3" style="font-weight: 600; color: #dc2626; padding-left: 1rem;">Cash Disbursements & Outflows</td></tr>
              ${opOutRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700; background: #f8fafc;">
                <td colspan="2">Net Cash Provided by Operating Activities</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #059669;">${formatCurrency(cf.operatingActivities?.netOperatingCashCents || 0)}</td>
              </tr>

              <!-- Investing Cash Flows -->
              <tr style="background: #f1f5f9;"><td colspan="3"><strong>2. CASH FLOWS FROM INVESTING ACTIVITIES</strong></td></tr>
              ${invRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700; background: #f8fafc;">
                <td colspan="2">Net Cash Provided by / (Used in) Investing Activities</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #0284c7;">${formatCurrency(cf.investingActivities?.netInvestingCashCents || 0)}</td>
              </tr>

              <!-- Financing Cash Flows -->
              <tr style="background: #f1f5f9;"><td colspan="3"><strong>3. CASH FLOWS FROM FINANCING ACTIVITIES</strong></td></tr>
              ${finRows}
              <tr style="border-top: 1px solid var(--border-color); font-weight: 700; background: #f8fafc;">
                <td colspan="2">Net Cash Provided by / (Used in) Financing Activities</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #7c3aed;">${formatCurrency(cf.financingActivities?.netFinancingCashCents || 0)}</td>
              </tr>

              <!-- Net Change & Closing Cash -->
              <tr style="background: #dcfce7; font-weight: 800; font-size: 1rem; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
                <td colspan="2">NET CHANGE IN CASH & CLOSING CASH EQUIVALENTS</td>
                <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #15803d;">${formatCurrency(cf.closingCashCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (accountingActiveTab === 'trial-balance') {
    mainSectionHtml = `
      <div style="padding: 0.75rem 1.35rem 0.5rem; display: flex; justify-content: flex-end;">
        ${exportButtonHtml}
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th>Type</th>
              <th>Total Debits</th>
              <th>Total Credits</th>
              <th>Net Balance</th>
            </tr>
          </thead>
          <tbody>
            ${accRows || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No accounts configured.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } else if (accountingActiveTab === 'general-ledger') {
    mainSectionHtml = `
      <div style="padding: 0.75rem 1.35rem 0.5rem; display: flex; justify-content: flex-end;">
        ${exportButtonHtml}
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Account Code & Title</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Memo / Description</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRows || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No ledger entries yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Accounting Header Panel -->
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">
          Accounting & Financial Reports
          <div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.3rem;">
            General ledger equilibrium, customer receipts (RV), journal adjustments (JV), chart of accounts, and financial statements.
          </div>
        </div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span class="badge ${isBalanced ? 'badge-success' : 'badge-danger'}" style="align-self: center;">
            <span class="badge-dot"></span>
            ${isBalanced ? 'Double-Entry Balanced' : 'Ledger Imbalance ($' + (Math.abs(tbJson.discrepancyCents || 0) / 100).toFixed(2) + ')'}
          </span>
          ${can('accounting', 'create') && accountingActiveTab === 'vouchers-rv' ? '<button class="btn btn-primary btn-sm" onclick="openNewReceiptVoucherModal()">+ Create Receipt Voucher (RV)</button>' : ''}
          ${can('accounting', 'create') && accountingActiveTab === 'vouchers-jv' ? '<button class="btn btn-primary btn-sm" onclick="openNewJournalVoucherModal()">+ Create Journal Voucher (JV)</button><button class="btn btn-secondary btn-sm" onclick="openNewContraVoucherModal()">+ Post Contra (CV)</button>' : ''}
          ${can('accounting', 'create') && accountingActiveTab === 'vouchers-pv' ? '<button class="btn btn-primary btn-sm" onclick="openNewPaymentVoucherModal()">+ New Payment Voucher</button>' : ''}
        </div>
      </div>

      <!-- Sub-Navigation Filters -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 0.5rem 1.35rem 1.25rem; border-bottom: 1px solid var(--border-color);">
        ${subNavHtml}
      </div>

      <!-- Main Section Content -->
      <div style="padding-top: 0.5rem;">
        ${mainSectionHtml}
      </div>
    </div>
  `;
}

/* ========================================================================== */
/* VOUCHER MODALS & ACTIONS                                                   */
/* ========================================================================== */
function openNewPaymentVoucherModal() {
  const accountOptions = cachedAccounts.map((a) => `<option value="${a.code}">${a.code} - ${a.name} (${a.type})</option>`).join('');
  const todayStr = new Date().toISOString().slice(0, 10);

  const vSettings = window.cachedVoucherSettings || {};
  const sign = vSettings['vouchers.signatories'] || {};
  const prepVal = (typeof state !== 'undefined' && state.user && state.user.name) || sign.preparedBy || 'Administrator';
  const certVal = sign.certifiedBy || 'Joy/Admin';
  const appVal = sign.approvedBy || 'Kenneth Brown/CEO';
  const recVal = sign.receivedBy || 'Signature over printed name/Date';

  const methods = (vSettings['vouchers.payment_methods'] && Array.isArray(vSettings['vouchers.payment_methods']))
    ? vSettings['vouchers.payment_methods']
    : [
        { id: 'BANK_TRANSFER', name: 'Bank Wire / ACH', isActive: true },
        { id: 'CHECK', name: 'Company Check', isActive: true },
        { id: 'CASH', name: 'Petty Cash', isActive: true },
        { id: 'CREDIT_CARD', name: 'Corporate Credit Card', isActive: true },
        { id: 'ONLINE', name: 'Online / E-Wallet', isActive: true },
      ];
  const methodOptions = methods
    .filter((m) => m.isActive !== false)
    .map((m) => `<option value="${m.id}">${m.name}</option>`)
    .join('');

  const presetTags = [
    'Operating Expense (OPEX)',
    'Capital Expenditure (CAPEX)',
    'PO Procurement',
    'Payroll',
    'Rent / Lease',
    'Utilities',
    'Utilities & Power',
    'Logistics & Freight',
    'Office Supplies',
    'Software & Subscriptions',
    'Marketing / Advertising',
    'Legal & Professional',
    'Travel & Representation',
    'Repair & Maintenance',
    'Taxes & Licenses',
    'Direct Materials',
    'Subcontracting',
    'Salaries & Compensation',
    'Petty Cash Replenishment',
  ];
  const customTags = (vSettings['vouchers.tags'] && Array.isArray(vSettings['vouchers.tags'])) ? vSettings['vouchers.tags'] : [];
  const allTagsList = Array.from(new Set(customTags.concat(presetTags)));
  const tagOptions = ['<option value="">-- No Tag / General --</option>']
    .concat(allTagsList.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`))
    .join('');

  const defAccounts = vSettings['vouchers.default_accounts'] || {};
  const defaultCash = defAccounts.cashAccountCode || '1010';
  const defaultExp = defAccounts.salariesExpenseCode || '5020';

  const body = `
    <form id="form-new-pv" onsubmit="submitNewPaymentVoucher(event)" style="display: flex; flex-direction: column; gap: 1.15rem;">
      <!-- PANEL 1: PAYEE & VOUCHER DETAILS -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.15rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 0.55rem;">
            <div style="width: 26px; height: 26px; border-radius: 6px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 800; border: 1px solid #bfdbfe;">1</div>
            <div>
              <span style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">Payee & Basic Details</span>
              <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.4rem;">• Primary disbursement entity</span>
            </div>
          </div>
          <span class="badge badge-primary" style="font-size: 0.72rem; padding: 0.2rem 0.55rem;">Disbursement</span>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.9rem; margin-bottom: 0.9rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <label class="form-label" style="font-weight: 700; margin-bottom: 0; color: #1e293b; font-size: 0.84rem;">Pay to (Recipient / Payee Name) *</label>
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <button type="button" class="btn btn-outline" style="padding: 0.12rem 0.45rem; font-size: 0.72rem; height: auto; border-color: #cbd5e1; color: #1d4ed8; font-weight: 600; cursor: pointer;" onclick="handlePvPayToMe()" title="Autofill my own name as payee for expense claim / reimbursement">
                  👤 Pay to Me
                </button>
                <span style="font-size: 0.72rem; color: #64748b;">or pick</span>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 0.45rem;">
              <input type="text" id="pv-recipient-name" class="form-input" list="pv-payees-datalist" placeholder="e.g. Acme Materials or Sarah Connor" oninput="handlePvPayeeInput(this.value)" required style="font-weight: 600;" />
              <select class="form-input" onchange="handlePvQuickPayeeSelect(this.value)" style="font-size: 0.8rem; background-color: #f8fafc; font-weight: 500;">
                <option value="">🔍 Directory Pick...</option>
                <optgroup label="🏢 Vendors / Suppliers (${cachedVendors.length})">
                  ${cachedVendors.map((v) => `<option value="VENDOR|${v.name}">${v.name} (${v.vendorCode || 'Vendor'})</option>`).join('')}
                </optgroup>
                <optgroup label="👷 Employees / Staff (${cachedEmployees.length})">
                  ${cachedEmployees.map((e) => `<option value="EMPLOYEE|${e.firstName} ${e.lastName}">${e.firstName} ${e.lastName} (${e.department || 'Staff'})</option>`).join('')}
                </optgroup>
                <optgroup label="🏬 Customers / Companies (${cachedCustomers.length})">
                  ${cachedCustomers.map((c) => `<option value="OTHER|${c.name}">${c.name} (${c.customerCode || 'Client'})</option>`).join('')}
                </optgroup>
              </select>
            </div>
            <datalist id="pv-payees-datalist">
              ${cachedVendors.map((v) => `<option value="${v.name}">Vendor: ${v.name} (${v.vendorCode || 'Supplier'})</option>`).join('')}
              ${cachedEmployees.map((e) => `<option value="${e.firstName} ${e.lastName}">Employee: ${e.firstName} ${e.lastName} (${e.department || 'Staff'})</option>`).join('')}
              ${cachedCustomers.map((c) => `<option value="${c.name}">Customer: ${c.name} (${c.customerCode || 'Client'})</option>`).join('')}
            </datalist>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Recipient Classification</label>
            <select id="pv-recipient-type" class="form-input" style="font-weight: 500;">
              <option value="VENDOR">Vendor / Supplier</option>
              <option value="EMPLOYEE">Employee / Staff</option>
              <option value="OTHER">Other / Contractor</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Currency</label>
            <select id="pv-currency" class="form-input" onchange="updatePaymentVoucherCurrency()" style="font-weight: 700;">
              <option value="PHP" selected>PHP (₱)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.9rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Voucher Date *</label>
            <input type="date" id="pv-date" class="form-input" value="${todayStr}" required style="font-weight: 600;" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Expense Tag / Category</label>
            <select id="pv-tag" class="form-input">
              ${tagOptions}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Voucher Number <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">(Auto if blank)</span></label>
            <input type="text" id="pv-voucher-number" class="form-input" placeholder="e.g. 26-000440" style="font-family: 'JetBrains Mono', monospace;" />
          </div>
        </div>
      </div>

      <!-- PANEL 2: ITEMIZED EXPENSE BREAKDOWN -->
      <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 1.15rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.9rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 0.55rem;">
            <div style="width: 26px; height: 26px; border-radius: 6px; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 800; border: 1px solid #fde68a;">2</div>
            <div>
              <span style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">Itemized Breakdown</span>
              <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.4rem;">• Printed on official APEXS voucher slip</span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="addPaymentVoucherItemRow()" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; padding: 0.35rem 0.85rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Line Item
          </button>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 0.9rem;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;" id="pv-items-table">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; text-align: left;">
                <th style="padding: 9px 12px; width: 25%; font-weight: 700; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em;">Invoice / Ref No</th>
                <th style="padding: 9px 12px; width: 45%; font-weight: 700; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em;">Account / Description *</th>
                <th style="padding: 9px 12px; width: 22%; text-align: right; font-weight: 700; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em;">Amount (<span class="pv-cur-symbol">₱</span>) *</th>
                <th style="padding: 9px 12px; width: 8%; text-align: center;"></th>
              </tr>
            </thead>
            <tbody id="pv-items-tbody">
              <!-- Dynamic rows rendered here -->
            </tbody>
          </table>
        </div>

        <!-- Grand Total Summary Card -->
        <div style="display: flex; justify-content: flex-end; align-items: center; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 0.75rem 1.15rem; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">Total Voucher Amount:</span>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.25rem; font-weight: 800; color: #dc2626; background: #ffffff; padding: 0.35rem 1rem; border-radius: 6px; border: 1.5px solid #fecaca; box-shadow: 0 1px 2px rgba(220, 38, 38, 0.08);" id="pv-total-display">
              ₱ 0.00
            </div>
          </div>
        </div>
      </div>

      <!-- PANEL 3: ACCOUNTING LEDGER & SETTLEMENT -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.15rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 0.55rem;">
            <div style="width: 26px; height: 26px; border-radius: 6px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 800; border: 1px solid #a7f3d0;">3</div>
            <div>
              <span style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">Ledger Accounts & Settlement</span>
              <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.4rem;">• Double-entry general ledger posting</span>
            </div>
          </div>
          <span class="badge badge-success" style="font-size: 0.72rem; padding: 0.2rem 0.55rem;">Balanced G/L</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.9rem;">
          <div class="form-group" style="margin-bottom: 0; background: #fef2f2; padding: 0.9rem; border-radius: 8px; border: 1px solid #fecaca;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
              <label class="form-label" style="color: #991b1b; font-weight: 700; margin-bottom: 0; font-size: 0.82rem;">Debit Account (Expense / A/P) *</label>
              <span class="badge badge-danger" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;">Debit (+)</span>
            </div>
            <select id="pv-exp-acc" class="form-input" required style="font-weight: 600; background: #ffffff;">
              ${accountOptions}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0; background: #f0fdf4; padding: 0.9rem; border-radius: 8px; border: 1px solid #bbf7d0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
              <label class="form-label" style="color: #166534; font-weight: 700; margin-bottom: 0; font-size: 0.82rem;">Credit Account (Cash / Bank) *</label>
              <span class="badge badge-success" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;">Credit (-)</span>
            </div>
            <select id="pv-pay-acc" class="form-input" required style="font-weight: 600; background: #ffffff;">
              ${accountOptions}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Payment Method *</label>
            <select id="pv-payment-method" class="form-input" style="font-weight: 600;">
              ${methodOptions}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: #334155;">Payment Memo / Notes</label>
            <input type="text" id="pv-notes" class="form-input" placeholder="e.g. Kenneth S Brown Corporate Credit Card / Check # / Transfer Ref" />
          </div>
        </div>
      </div>

      <!-- PANEL 4: SIGNATORIES & APPROVALS -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.15rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 0.55rem;">
            <div style="width: 26px; height: 26px; border-radius: 6px; background: #faf5ff; color: #7e22ce; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 800; border: 1px solid #e9d5ff;">4</div>
            <div>
              <span style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">Signatories & Approvals</span>
              <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.4rem;">• Official APEXS 4-point authorization sign-off</span>
            </div>
          </div>
          <span class="badge badge-warning" style="font-size: 0.72rem; padding: 0.2rem 0.55rem;">Slip Sign-off</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.85rem;">
          <div class="form-group" style="margin-bottom: 0; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Prepared by:</label>
            <input type="text" id="pv-sig-prepared" class="form-input" value="${prepVal}" style="font-size: 0.82rem; background: #ffffff;" placeholder="Administrator / Bookkeeper" />
          </div>
          <div class="form-group" style="margin-bottom: 0; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Certified Correct by:</label>
            <input type="text" id="pv-sig-certified" class="form-input" value="${certVal}" style="font-size: 0.82rem; background: #ffffff;" placeholder="Joy / Senior Admin" />
          </div>
          <div class="form-group" style="margin-bottom: 0; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Approved by:</label>
            <input type="text" id="pv-sig-approved" class="form-input" value="${appVal}" style="font-size: 0.82rem; background: #ffffff;" placeholder="Kenneth Brown / CEO" />
          </div>
          <div class="form-group" style="margin-bottom: 0; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Received Payment:</label>
            <input type="text" id="pv-sig-received" class="form-input" value="${recVal}" style="font-size: 0.82rem; background: #ffffff;" placeholder="Signature / Date" />
          </div>
        </div>
      </div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-pv').requestSubmit()" style="display: inline-flex; align-items: center; gap: 0.45rem; font-weight: 700; padding: 0.5rem 1.25rem;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Post Payment Voucher
    </button>
  `;

  openModal('Create Voucher', body, footer, 'xl');

  // Add initial item row & set intelligent defaults
  setTimeout(() => {
    addPaymentVoucherItemRow('', '', '');
    const expSelect = document.getElementById('pv-exp-acc');
    const paySelect = document.getElementById('pv-pay-acc');
    if (expSelect) expSelect.value = defaultExp;
    if (paySelect) paySelect.value = defaultCash;
  }, 50);
}

function handlePvPayToMe() {
  const currentUserName = (typeof state !== 'undefined' && state.user && state.user.name) ? state.user.name : '';
  if (!currentUserName) {
    showToast('No user profile found', 'warning');
    return;
  }
  const nameInput = document.getElementById('pv-recipient-name');
  const typeSelect = document.getElementById('pv-recipient-type');
  if (nameInput) {
    nameInput.value = currentUserName;
    nameInput.focus();
  }
  if (typeSelect) {
    typeSelect.value = 'EMPLOYEE';
  }
  showToast('Set Payee to your name: ' + currentUserName, 'info');
}

function handlePvQuickPayeeSelect(val) {
  if (!val) return;
  const parts = val.split('|');
  const type = parts[0];
  const name = parts.slice(1).join('|');
  const nameInput = document.getElementById('pv-recipient-name');
  const typeSelect = document.getElementById('pv-recipient-type');
  if (nameInput) nameInput.value = name;
  if (typeSelect && type) typeSelect.value = type;
}

function handlePvPayeeInput(val) {
  if (!val) return;
  const lower = val.trim().toLowerCase();
  const typeSelect = document.getElementById('pv-recipient-type');
  if (!typeSelect) return;
  if (cachedVendors.some((v) => v.name.toLowerCase() === lower)) {
    typeSelect.value = 'VENDOR';
  } else if (cachedEmployees.some((e) => (e.firstName + ' ' + e.lastName).toLowerCase() === lower)) {
    typeSelect.value = 'EMPLOYEE';
  }
}

function handleRvQuickPayerSelect(name) {
  if (!name) return;
  const nameInput = document.getElementById('rv-payer-name');
  if (nameInput) nameInput.value = name;
}

function addPaymentVoucherItemRow(inv = '', desc = '', amt = '') {
  const tbody = document.getElementById('pv-items-tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'pv-item-row';
  tr.style.borderBottom = '1px solid #f1f5f9';
  tr.innerHTML = `
    <td style="padding: 6px 8px;">
      <input type="text" class="form-input pv-item-inv" value="${inv}" placeholder="e.g. INV-10492 / PO #" style="font-size: 0.84rem; padding: 0.4rem 0.65rem;" />
    </td>
    <td style="padding: 6px 8px;">
      <input type="text" class="form-input pv-item-desc" value="${desc}" placeholder="Item description / Purpose of payment" required style="font-size: 0.84rem; padding: 0.4rem 0.65rem;" />
    </td>
    <td style="padding: 6px 8px;">
      <input type="number" step="0.01" min="0" class="form-input pv-item-amt" value="${amt}" placeholder="0.00" oninput="calcPaymentVoucherTotal()" required style="font-size: 0.84rem; padding: 0.4rem 0.65rem; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;" />
    </td>
    <td style="padding: 6px 8px; text-align: center;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="removePaymentVoucherItemRow(this)" style="padding: 0.35rem 0.6rem; color: #dc2626; border-color: #fecaca; background: #fff5f5;" title="Remove row">
        ✕
      </button>
    </td>
  `;
  tbody.appendChild(tr);
  calcPaymentVoucherTotal();
}

function removePaymentVoucherItemRow(btn) {
  const tbody = document.getElementById('pv-items-tbody');
  const row = btn.closest('tr');
  if (tbody && tbody.children.length > 1) {
    row.remove();
    calcPaymentVoucherTotal();
  } else {
    showToast('At least one line item is required', 'warning');
  }
}

function updatePaymentVoucherCurrency() {
  const cur = document.getElementById('pv-currency')?.value || 'PHP';
  const sym = cur === 'USD' ? '$' : '₱';
  document.querySelectorAll('.pv-cur-symbol').forEach((el) => {
    el.innerText = sym;
  });
  calcPaymentVoucherTotal();
}

function calcPaymentVoucherTotal() {
  const cur = document.getElementById('pv-currency')?.value || 'PHP';
  const sym = cur === 'USD' ? '$' : '₱';
  let totalCents = 0;

  document.querySelectorAll('.pv-item-amt').forEach((input) => {
    const val = parseFloat(input.value) || 0;
    totalCents += Math.round(val * 100);
  });

  const totalDisplay = document.getElementById('pv-total-display');
  if (totalDisplay) {
    totalDisplay.innerText = sym + ' ' + (totalCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

async function submitNewPaymentVoucher(e) {
  e.preventDefault();
  const recipientName = document.getElementById('pv-recipient-name').value.trim();
  const recipientType = document.getElementById('pv-recipient-type').value;
  const currency = document.getElementById('pv-currency').value;
  const voucherDate = document.getElementById('pv-date').value;
  const voucherNumber = document.getElementById('pv-voucher-number').value.trim();
  const tagEl = document.getElementById('pv-tag');
  const tag = tagEl ? tagEl.value.trim() : '';
  const paymentMethod = document.getElementById('pv-payment-method').value;
  const expenseAccountCode = document.getElementById('pv-exp-acc').value;
  const paymentAccountCode = document.getElementById('pv-pay-acc').value;
  const notes = document.getElementById('pv-notes').value.trim();

  const signatories = {
    preparedBy: document.getElementById('pv-sig-prepared').value.trim(),
    certifiedBy: document.getElementById('pv-sig-certified').value.trim(),
    approvedBy: document.getElementById('pv-sig-approved').value.trim(),
    receivedBy: document.getElementById('pv-sig-received').value.trim(),
  };

  const rows = document.querySelectorAll('#pv-items-tbody tr.pv-item-row');
  const items = [];
  let totalCents = 0;

  rows.forEach((row) => {
    const invoiceNo = row.querySelector('.pv-item-inv')?.value.trim() || '';
    const description = row.querySelector('.pv-item-desc')?.value.trim() || '';
    const amtVal = parseFloat(row.querySelector('.pv-item-amt')?.value) || 0;
    const amountCents = Math.round(amtVal * 100);

    if (description || amountCents > 0) {
      items.push({ invoiceNo, description, currency, amountCents });
      totalCents += amountCents;
    }
  });

  if (items.length === 0 || totalCents <= 0) {
    showToast('Please add at least one line item with a valid amount', 'warning');
    return;
  }

  try {
    const res = await apiFetch('/api/accounting/vouchers/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voucherNumber: voucherNumber || undefined,
        voucherDate: voucherDate ? new Date(voucherDate).toISOString() : undefined,
        recipientName,
        recipientType,
        currency,
        tag: tag || undefined,
        amountCents: totalCents,
        items,
        signatories,
        paymentMethod,
        expenseAccountCode,
        paymentAccountCode,
        notes: notes || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to post payment voucher');

    closeModal();
    showToast(`Payment Voucher ${json.voucherNumber} posted successfully`, 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openNewReceiptVoucherModal() {
  const accountOptions = cachedAccounts.map((a) => `<option value="${a.code}">${a.code} - ${a.name} (${a.type})</option>`).join('');

  const body = `
    <form id="form-new-rv" onsubmit="submitNewReceiptVoucher(event)">
      <div class="form-group">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0;">Payer / Customer Name *</label>
          <span style="font-size: 0.72rem; color: #64748b;">Type or pick from directory</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem;">
          <input type="text" id="rv-payer-name" class="form-input" list="rv-payers-datalist" placeholder="e.g. Globex Corporation or Client Deposit" required />
          <select class="form-input" onchange="handleRvQuickPayerSelect(this.value)" style="font-size: 0.8rem; background-color: #f8fafc;">
            <option value="">🔍 Directory Pick...</option>
            <optgroup label="🏬 Customers / Companies (${cachedCustomers.length})">
              ${cachedCustomers.map((c) => `<option value="${c.name}">${c.name} (${c.customerCode || 'Client'})</option>`).join('')}
            </optgroup>
            <optgroup label="🏢 Vendors / Partners (${cachedVendors.length})">
              ${cachedVendors.map((v) => `<option value="${v.name}">${v.name} (${v.vendorCode || 'Vendor'})</option>`).join('')}
            </optgroup>
            <optgroup label="👷 Employees / Staff (${cachedEmployees.length})">
              ${cachedEmployees.map((e) => `<option value="${e.firstName} ${e.lastName}">${e.firstName} ${e.lastName}</option>`).join('')}
            </optgroup>
          </select>
        </div>
        <datalist id="rv-payers-datalist">
          ${cachedCustomers.map((c) => `<option value="${c.name}">Customer: ${c.name} (${c.customerCode || 'Client'})</option>`).join('')}
          ${cachedVendors.map((v) => `<option value="${v.name}">Vendor: ${v.name} (${v.vendorCode || 'Supplier'})</option>`).join('')}
          ${cachedEmployees.map((e) => `<option value="${e.firstName} ${e.lastName}">Employee: ${e.firstName} ${e.lastName}</option>`).join('')}
        </datalist>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label class="form-label">Receipt Amount ($) *</label>
          <input type="number" step="0.01" min="0.01" id="rv-amount" class="form-input" placeholder="0.00" required />
        </div>
        <div class="form-group">
          <label class="form-label">Payment Method *</label>
          <select id="rv-payment-method" class="form-input">
            <option value="BANK_TRANSFER">Bank Wire / ACH</option>
            <option value="CHECK">Client Check</option>
            <option value="CASH">Cash Deposit</option>
            <option value="ONLINE">Credit Card / Online</option>
          </select>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.9rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="color: #059669; font-weight: 600;">Debit Account (Cash / Bank In) *</label>
          <select id="rv-dep-acc" class="form-input" required>
            ${accountOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="color: #1d4ed8; font-weight: 600;">Credit Account (Revenue / AR) *</label>
          <select id="rv-crd-acc" class="form-input" required>
            ${accountOptions}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Memo / Reference</label>
        <input type="text" id="rv-notes" class="form-input" placeholder="e.g. Advance retainer for Q3 engineering" />
      </div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-rv').requestSubmit()">Post Receipt Voucher</button>
  `;

  openModal('Create Receipt Voucher (RV)', body, footer);

  setTimeout(() => {
    const depSelect = document.getElementById('rv-dep-acc');
    const crdSelect = document.getElementById('rv-crd-acc');
    if (depSelect) depSelect.value = '1010'; // Cash / Bank
    if (crdSelect) crdSelect.value = '4010'; // Sales Revenue
  }, 50);
}

async function submitNewReceiptVoucher(e) {
  e.preventDefault();
  const payerName = document.getElementById('rv-payer-name').value;
  const paymentMethod = document.getElementById('rv-payment-method').value;
  const amountDollars = parseFloat(document.getElementById('rv-amount').value) || 0;
  const amountCents = Math.round(amountDollars * 100);
  const depositAccountCode = document.getElementById('rv-dep-acc').value;
  const creditAccountCode = document.getElementById('rv-crd-acc').value;
  const notes = document.getElementById('rv-notes').value;

  if (amountCents <= 0) {
    showToast('Amount must be greater than zero', 'warning');
    return;
  }

  try {
    const res = await apiFetch('/api/accounting/vouchers/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payerName,
        paymentMethod,
        amountCents,
        depositAccountCode,
        creditAccountCode,
        notes,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to post receipt voucher');

    closeModal();
    showToast(`Receipt Voucher ${json.voucherNumber} posted successfully`, 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openNewContraModal() {
  const accountOptions = cachedAccounts.map((a) => `<option value="${a.code}">${a.code} - ${a.name} (${a.type})</option>`).join('');

  const body = `
    <form id="form-new-cv" onsubmit="submitNewContraVoucher(event)">
      <div class="form-group">
        <label class="form-label">Transfer Description / Reason *</label>
        <input type="text" id="cv-desc" class="form-input" placeholder="e.g. Cash withdrawal for petty cash replenish" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label class="form-label">From Account (Credit / Out) *</label>
          <select id="cv-from-acc" class="form-input" required>
            ${accountOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">To Account (Debit / In) *</label>
          <select id="cv-to-acc" class="form-input" required>
            ${accountOptions}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Transfer Amount ($) *</label>
        <input type="number" step="0.01" min="0.01" id="cv-amount" class="form-input" placeholder="0.00" required />
      </div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-cv').requestSubmit()">Post Contra Transfer</button>
  `;

  openModal('Post Contra Voucher (Inter-Account Transfer)', body, footer);
}

async function submitNewContraVoucher(e) {
  e.preventDefault();
  const description = document.getElementById('cv-desc').value;
  const fromAccountCode = document.getElementById('cv-from-acc').value;
  const toAccountCode = document.getElementById('cv-to-acc').value;
  const amountDollars = parseFloat(document.getElementById('cv-amount').value) || 0;
  const amountCents = Math.round(amountDollars * 100);

  if (fromAccountCode === toAccountCode) {
    showToast('Source and Destination accounts must be different', 'warning');
    return;
  }
  if (amountCents <= 0) {
    showToast('Amount must be greater than zero', 'warning');
    return;
  }

  try {
    const res = await apiFetch('/api/accounting/vouchers/contra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        fromAccountCode,
        toAccountCode,
        amountCents,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to post contra voucher');

    closeModal();
    showToast(`Contra Voucher ${json.voucherNumber} posted successfully`, 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openNewJVModal() {
  const accountOptions = cachedAccounts.map((a) => `<option value="${a.code}">${a.code} - ${a.name} (${a.type})</option>`).join('');

  const body = `
    <form id="form-new-jv" onsubmit="submitNewJV(event)">
      <div class="form-group">
        <label class="form-label">Description / Memo *</label>
        <input type="text" id="jv-desc" class="form-input" placeholder="e.g. Month-end depreciation adjustment" required />
      </div>

      <div style="background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.9rem;">
        <div style="font-weight: 600; margin-bottom: 0.4rem; font-size: 0.8rem; color: #059669;">Line 1 (Debit Entry)</div>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem;">
          <select id="jv-acc1" class="form-input" required>${accountOptions}</select>
          <input type="number" step="0.01" min="0.01" id="jv-deb1" class="form-input" placeholder="Debit ($)" value="500.00" oninput="updateJVBalanceSummary()" required />
        </div>
      </div>

      <div style="background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.9rem;">
        <div style="font-weight: 600; margin-bottom: 0.4rem; font-size: 0.8rem; color: #dc2626;">Line 2 (Credit Entry)</div>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem;">
          <select id="jv-acc2" class="form-input" required>${accountOptions}</select>
          <input type="number" step="0.01" min="0.01" id="jv-crd2" class="form-input" placeholder="Credit ($)" value="500.00" oninput="updateJVBalanceSummary()" required />
        </div>
      </div>

      <!-- Live Double-Entry Running Balance Indicator -->
      <div id="jv-balance-indicator" style="padding: 0.75rem; border-radius: 6px; background: #ecfdf5; border: 1px solid #a7f3d0; font-size: 0.85rem; color: #065f46; display: flex; justify-content: space-between; align-items: center;">
        <span><strong>Balance Status:</strong> Perfectly Balanced</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">$500.00 / $500.00</span>
      </div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-jv').requestSubmit()">Post Journal Voucher</button>
  `;

  openModal('Create Balanced Journal Voucher (JV)', body, footer);

  setTimeout(() => {
    const acc1 = document.getElementById('jv-acc1');
    const acc2 = document.getElementById('jv-acc2');
    if (acc1) acc1.value = '5020';
    if (acc2) acc2.value = '1010';
  }, 50);
}

function updateJVBalanceSummary() {
  const deb = parseFloat(document.getElementById('jv-deb1')?.value) || 0;
  const crd = parseFloat(document.getElementById('jv-crd2')?.value) || 0;
  const indicator = document.getElementById('jv-balance-indicator');
  if (!indicator) return;

  const isBal = Math.abs(deb - crd) < 0.001 && deb > 0;
  if (isBal) {
    indicator.style.background = '#ecfdf5';
    indicator.style.borderColor = '#a7f3d0';
    indicator.style.color = '#065f46';
    indicator.innerHTML = `<span><strong>Balance Status:</strong> Perfectly Balanced</span><span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">$${deb.toFixed(2)} / $${crd.toFixed(2)}</span>`;
  } else {
    indicator.style.background = '#fef2f2';
    indicator.style.borderColor = '#fecaca';
    indicator.style.color = '#991b1b';
    indicator.innerHTML = `<span><strong>Double-Entry Imbalance:</strong> Delta $${Math.abs(deb - crd).toFixed(2)}</span><span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">$${deb.toFixed(2)} vs $${crd.toFixed(2)}</span>`;
  }
}

async function submitNewJV(e) {
  e.preventDefault();
  const desc = document.getElementById('jv-desc').value;
  const acc1 = document.getElementById('jv-acc1').value;
  const deb1 = Math.round((parseFloat(document.getElementById('jv-deb1').value) || 0) * 100);
  const acc2 = document.getElementById('jv-acc2').value;
  const crd2 = Math.round((parseFloat(document.getElementById('jv-crd2').value) || 0) * 100);

  if (deb1 !== crd2) {
    showToast('Debit and Credit entries must be equal for double-entry validity', 'danger');
    return;
  }

  const payload = {
    description: desc,
    entries: [
      { accountCode: acc1, debitCents: deb1, creditCents: 0, description: desc },
      { accountCode: acc2, debitCents: 0, creditCents: crd2, description: desc },
    ],
  };

  try {
    const res = await apiFetch('/api/accounting/vouchers/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to post JV');

    closeModal();
    showToast('Journal Voucher ' + json.jvNumber + ' posted successfully', 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

/* ========================================================================== */
/* OFFICIAL VOUCHER SLIP PREVIEW & SIGN-OFF                                   */
/* ========================================================================== */

function renderOfficialVoucherSlipMarkup(v) {
  if (!v) return '';
  const cur = v.currency || 'PHP';
  const curSymbol = cur === 'USD' ? '$' : '₱';
  const curLabel = cur === 'USD' ? 'USD' : 'Php';
  const rawDate = v.voucherDate || v.createdAt;
  const formattedDate = new Date(rawDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const defaultSign = (window.cachedVoucherSettings && window.cachedVoucherSettings['vouchers.signatories']) || {};
  let sig = v.signatories;
  if (typeof sig === 'string') {
    try { sig = JSON.parse(sig); } catch (_) { sig = {}; }
  }
  sig = sig || {
    preparedBy: defaultSign.preparedBy || 'Administrator',
    certifiedBy: defaultSign.certifiedBy || 'Joy/Admin',
    approvedBy: defaultSign.approvedBy || 'Kenneth Brown/CEO',
    receivedBy: defaultSign.receivedBy || 'Signature over printed name/Date',
  };

  let items = v.items || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (_) { items = []; }
  }
  if (!items || items.length === 0) {
    items = [
      {
        invoiceNo: v.referenceId || '',
        description: v.notes || (v.recipient ? (v.recipient + ' disbursement') : 'Disbursement'),
        currency: cur,
        amountCents: v.amountCents || 0,
      },
    ];
  }

  let itemRowsHtml = '';
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const amtStr = (((it.amountCents || 0) / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    itemRowsHtml +=
      '<tr style="height: 20px;">' +
      '<td style="border: 1px solid #000000; padding: 2px 6px; text-align: center; font-size: 0.78rem; font-family: Inter, sans-serif;">' + escapeHtml(it.invoiceNo || '') + '</td>' +
      '<td style="border: 1px solid #000000; padding: 2px 6px; text-align: center; font-size: 0.78rem; font-family: Inter, sans-serif;">' + escapeHtml(it.description || '') + '</td>' +
      '<td style="border: 1px solid #000000; padding: 2px 6px; text-align: center; font-size: 0.78rem; font-weight: 600;">' + curSymbol + '</td>' +
      '<td style="border: 1px solid #000000; padding: 2px 6px; text-align: right; font-size: 0.78rem; font-family: JetBrains Mono, monospace;">' + amtStr + '</td>' +
      '</tr>';
  }

  const delimiterRowHtml =
    '<tr style="height: 18px;">' +
    '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
    '<td style="border: 1px solid #000000; padding: 2px 6px; text-align: center; font-size: 0.72rem; font-style: italic; color: #1e293b;">-- End Nothing else --</td>' +
    '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
    '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
    '</tr>';

  const remarks = v.notes ? ('(' + v.notes.toUpperCase() + ')') : v.paymentMethod === 'CREDIT_CARD' ? '(CORPORATE CREDIT CARD PAYMENT)' : '';
  const remarksRowHtml = remarks
    ? '<tr style="height: 18px;">' +
      '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
      '<td style="border: 1px solid #000000; padding: 2px 6px; text-align: center; font-size: 0.72rem; font-weight: 700; color: #000000;">' + escapeHtml(remarks) + '</td>' +
      '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
      '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
      '</tr>'
    : '';

  const renderedCount = items.length + 1 + (remarks ? 1 : 0);
  const fillerCount = Math.max(0, 3 - renderedCount);
  let fillerRowsHtml = '';
  for (let i = 0; i < fillerCount; i++) {
    fillerRowsHtml +=
      '<tr style="height: 18px;">' +
      '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
      '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
      '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
      '<td style="border: 1px solid #000000; padding: 2px 6px;"></td>' +
      '</tr>';
  }

  const totalFormatted = (((v.amountCents || 0) / 100)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    '<div class="official-voucher-sheet" style="background: #ffffff; color: #000000; padding: 1.25rem 1.25rem 1rem 1.25rem; font-family: Inter, Arial, sans-serif; border: none; max-width: 760px; margin: 0 auto; box-shadow: none;">' +
    '<!-- APEXS Header with Official Brand Logo -->' +
    '<div style="display: flex; justify-content: center; align-items: center; gap: 1.15rem; margin-bottom: 0.35rem;">' +
    '<img src="/assets/logo.png" alt="APEXS, INC. Logo" style="height: 48px; width: auto; object-fit: contain; flex-shrink: 0;" />' +
    '<div>' +
    '<div style="font-size: 1.28rem; font-weight: 900; color: #dc2626; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px; line-height: 1.1;">APEXS, INC.</div>' +
    '<div style="font-size: 0.76rem; font-weight: 700; font-style: italic; color: #0f172a; line-height: 1.15;">Applied Expert Systems & Software, Inc.</div>' +
    '<div style="font-size: 0.7rem; font-style: italic; color: #0284c7; font-weight: 600; font-family: Georgia, serif; line-height: 1.15;">“We put technology to work for you”</div>' +
    '</div>' +
    '</div>' +
    '<!-- Address & Contact -->' +
    '<div style="text-align: center; font-size: 0.68rem; font-weight: 600; color: #1e293b; margin-bottom: 0.45rem; line-height: 1.35;">' +
    '<div>Suite 714 EGI City by the Sea, Maribago, Lapu-Lapu City 6015</div>' +
    '<div>Telefax# 495-2106</div>' +
    '</div>' +
    '<!-- Top Voucher Number, Date & Pay to Rows -->' +
    '<div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 0.45rem; font-size: 0.8rem;">' +
    '<div style="display: flex; align-items: baseline; flex: 1; margin-right: 1.25rem;">' +
    '<span style="font-weight: 700; font-size: 0.82rem; margin-right: 0.4rem; white-space: nowrap;">Pay to:</span>' +
    '<span style="border-bottom: 1.5px solid #000000; flex: 1; font-weight: 700; font-size: 0.86rem; text-transform: uppercase; padding-left: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' +
    escapeHtml(v.recipient || v.recipientName || '-') +
    '</span>' +
    '</div>' +
    '<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">' +
    '<div style="display: flex; align-items: baseline;">' +
    '<span style="font-weight: 700; font-size: 0.8rem; margin-right: 0.4rem;">No.</span>' +
    '<span style="border-bottom: 1.5px solid #000000; min-width: 140px; text-align: center; font-weight: 800; font-size: 0.9rem; font-family: JetBrains Mono, Arial, monospace;">' +
    escapeHtml(v.voucherNumber || '') +
    '</span>' +
    '</div>' +
    '<div style="display: flex; align-items: baseline;">' +
    '<span style="font-weight: 700; font-size: 0.78rem; margin-right: 0.4rem;">Date:</span>' +
    '<span style="border-bottom: 1.5px solid #000000; min-width: 140px; text-align: center; font-weight: 700; font-size: 0.78rem;">' +
    formattedDate +
    '</span>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<!-- Official Voucher Line Items Grid -->' +
    '<table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000000; margin-bottom: 0.45rem;">' +
    '<thead>' +
    '<tr style="background: #ffffff; border-bottom: 1.5px solid #000000; height: 22px;">' +
    '<th style="border: 1px solid #000000; width: 20%; padding: 2px 6px; font-weight: 700; font-size: 0.76rem; text-align: center;">Invoice No</th>' +
    '<th style="border: 1px solid #000000; width: 54%; padding: 2px 6px; font-weight: 700; font-size: 0.76rem; text-align: center;">Account/Description</th>' +
    '<th style="border: 1px solid #000000; width: 6%; padding: 2px 6px; font-weight: 700; font-size: 0.76rem; text-align: center;">₱</th>' +
    '<th style="border: 1px solid #000000; width: 20%; padding: 2px 6px; font-weight: 700; font-size: 0.76rem; text-align: center;">Amount</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' +
    itemRowsHtml +
    delimiterRowHtml +
    remarksRowHtml +
    fillerRowsHtml +
    '<!-- Total Summary Row -->' +
    '<tr style="height: 22px; font-weight: 700; border-top: 1.5px solid #000000;">' +
    '<td colspan="2" style="border: 1px solid #000000; border-right: none; padding: 2px 6px;"></td>' +
    '<td style="border: 1px solid #000000; border-left: 1px solid #000000; padding: 2px 6px; text-align: center; font-size: 0.8rem;">' + curLabel + '</td>' +
    '<td style="border: 1px solid #000000; padding: 2px 6px; text-align: right; font-size: 0.84rem; font-family: JetBrains Mono, monospace;">' + totalFormatted + '</td>' +
    '</tr>' +
    '</tbody>' +
    '</table>' +
    '<!-- 4-Column Official Signatories & Audit Section -->' +
    '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-top: 0.35rem; text-align: left; font-size: 0.72rem;">' +
    '<!-- Column 1: Prepared by -->' +
    '<div>' +
    '<div style="font-size: 0.66rem; color: #1e293b; margin-bottom: 0.15rem;">Prepared by:</div>' +
    '<div style="height: 22px; border-bottom: 1.5px solid #000000; margin-bottom: 0.2rem;"></div>' +
    '<div style="font-weight: 700; text-align: center; font-size: 0.72rem; color: #000000;">' + escapeHtml(sig.preparedBy || 'Administrator') + '</div>' +
    '</div>' +
    '<!-- Column 2: Certified Correct by -->' +
    '<div>' +
    '<div style="font-size: 0.66rem; color: #1e293b; margin-bottom: 0.15rem;">Certified Correct by:</div>' +
    '<div style="height: 22px; border-bottom: 1.5px solid #000000; margin-bottom: 0.2rem;"></div>' +
    '<div style="font-weight: 700; text-align: center; font-size: 0.72rem; color: #000000;">' + escapeHtml(sig.certifiedBy || 'Joy/Admin') + '</div>' +
    '</div>' +
    '<!-- Column 3: Approved by -->' +
    '<div>' +
    '<div style="font-size: 0.66rem; color: #1e293b; margin-bottom: 0.15rem;">Approved by:</div>' +
    '<div style="height: 22px; border-bottom: 1.5px solid #000000; margin-bottom: 0.2rem;"></div>' +
    '<div style="font-weight: 700; text-align: center; font-size: 0.72rem; color: #000000;">' + escapeHtml(sig.approvedBy || 'Kenneth Brown/CEO') + '</div>' +
    '</div>' +
    '<!-- Column 4: Received Payment -->' +
    '<div>' +
    '<div style="font-size: 0.66rem; color: #1e293b; margin-bottom: 0.15rem;">Received Payment:</div>' +
    '<div style="height: 22px; border-bottom: 1.5px solid #000000; margin-bottom: 0.2rem;"></div>' +
    '<div style="font-size: 0.62rem; text-align: center; color: #334155;">' + escapeHtml(sig.receivedBy || 'Signature over printed name/Date') + '</div>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

async function generateVoucherPdfBlob(v) {
  const html = renderOfficialVoucherSlipMarkup(v);
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  tempDiv.style.width = '760px';
  tempDiv.style.background = '#ffffff';
  tempDiv.innerHTML = html;
  document.body.appendChild(tempDiv);

  const cleanNum = (v.voucherNumber || 'voucher').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanRecipient = (v.recipient || v.recipientName || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = 'PV_' + cleanNum + (cleanRecipient ? '_' + cleanRecipient : '') + '.pdf';

  const opt = {
    margin: [18, 18, 12, 18], // mm
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
  };

  try {
    if (typeof html2pdf !== 'undefined') {
      const targetEl = tempDiv.querySelector('.official-voucher-sheet') || tempDiv;
      const pdfBlob = await html2pdf().set(opt).from(targetEl).output('blob');
      if (tempDiv.parentNode) document.body.removeChild(tempDiv);
      return { blob: pdfBlob, filename };
    } else {
      if (tempDiv.parentNode) document.body.removeChild(tempDiv);
      return null;
    }
  } catch (err) {
    console.error('PDF generation error for voucher:', v.voucherNumber, err);
    if (tempDiv.parentNode) document.body.removeChild(tempDiv);
    return null;
  }
}

async function downloadSingleVoucherPdf(voucherId) {
  const v = (cachedVouchers || []).find((x) => x.id === voucherId) || (typeof cachedPVList !== 'undefined' ? cachedPVList.find((x) => x.id === voucherId) : null);
  if (!v) {
    showToast('Voucher not found', 'warning');
    return;
  }
  showToast('Generating PDF for ' + v.voucherNumber + '...', 'info');
  try {
    const result = await generateVoucherPdfBlob(v);
    if (result && result.blob) {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('PDF downloaded successfully', 'success');
    } else {
      showToast('Could not generate PDF directly. You can also use Print to PDF.', 'warning');
    }
  } catch (e) {
    showToast('PDF generation failed: ' + e.message, 'danger');
  }
}

function openVoucherSlipModal(voucherId) {
  const v = cachedVouchers.find((x) => x.id === voucherId) || (typeof cachedPVList !== 'undefined' ? cachedPVList.find((x) => x.id === voucherId) : null);
  if (!v) {
    showToast('Voucher not found', 'warning');
    return;
  }

  if (typeof setUrlParam === 'function') {
    setUrlParam('slip', voucherId);
  }

  const body = renderOfficialVoucherSlipMarkup(v);

  const histCount = v.historyCount || 0;
  const countBadgeClass = histCount > 0 ? 'has-records' : 'zero-records';
  const footer =
    '<button type="button" class="btn btn-secondary btn-history-badge-container" onclick="openVoucherHistoryModal(\'' + v.id + '\')" style="margin-right: 0.35rem;">📜 History<span class="history-count-badge ' + countBadgeClass + '">' + histCount + '</span></button>' +
    '<button type="button" id="btn-print-voucher" class="btn btn-primary" onclick="window.print()">🖨️ Print Official Voucher</button>' +
    '<button type="button" class="btn btn-secondary" onclick="downloadSingleVoucherPdf(\'' + v.id + '\')">📥 Download PDF</button>' +
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>';

  openModal('Official Voucher Slip — ' + v.voucherNumber, body, footer, 'xl');

  setTimeout(() => {
    const printBtn = document.getElementById('btn-print-voucher');
    if (printBtn) printBtn.focus();
  }, 60);
}

/* ========================================================================== */
/* VOUCHER CRUD & ADMIN APPROVAL / DECLINE / RESTORE CONTROLLERS              */
/* ========================================================================== */

let currentEditVoucherCurrency = 'PHP';

function updateEditVoucherCurrency() {
  const curSelect = document.getElementById('edit-v-currency');
  if (curSelect) {
    currentEditVoucherCurrency = curSelect.value;
  }
  const sym = currentEditVoucherCurrency === 'USD' ? '$' : '₱';
  document.querySelectorAll('.edit-cur-symbol').forEach((el) => {
    el.textContent = sym;
  });
  const thSym = document.getElementById('edit-voucher-th-symbol');
  if (thSym) thSym.textContent = sym;
  updateEditVoucherTotal();
}

function updateEditVoucherTotal() {
  const rows = document.querySelectorAll('#edit-voucher-items-tbody tr.edit-voucher-item-row');
  let totalCents = 0;
  rows.forEach((r) => {
    const amtInput = r.querySelector('.edit-item-amount');
    if (amtInput) {
      const val = parseFloat(amtInput.value || '0');
      if (!isNaN(val) && val > 0) {
        totalCents += Math.round(val * 100);
      }
    }
  });
  const totalDisplay = document.getElementById('edit-voucher-total-display');
  if (totalDisplay) {
    totalDisplay.textContent = formatCurrency(totalCents, currentEditVoucherCurrency);
  }
}

function addEditVoucherRow(invoiceNo, description, amount) {
  const tbody = document.getElementById('edit-voucher-items-tbody');
  if (!tbody) return;
  const sym = currentEditVoucherCurrency === 'USD' ? '$' : '₱';
  const tr = document.createElement('tr');
  tr.className = 'edit-voucher-item-row';
  tr.innerHTML =
    '<td>' +
    '<input type="text" class="form-input edit-item-invoice" style="padding: 0.45rem 0.65rem; font-size: 0.85rem;" placeholder="Inv # / Ref" value="' + (invoiceNo || '') + '" />' +
    '</td>' +
    '<td>' +
    '<input type="text" class="form-input edit-item-desc" style="padding: 0.45rem 0.65rem; font-size: 0.85rem;" placeholder="Account / Description" value="' + (description || '') + '" required />' +
    '</td>' +
    '<td>' +
    '<div style="position: relative;">' +
    '<span class="edit-cur-symbol" style="position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); font-size: 0.82rem; color: #64748b; pointer-events: none;">' + sym + '</span>' +
    '<input type="number" step="0.01" min="0" class="form-input edit-item-amount" style="padding: 0.45rem 0.65rem 0.45rem 1.6rem; font-size: 0.85rem; text-align: right; font-family: monospace;" placeholder="0.00" value="' + (amount || '') + '" oninput="updateEditVoucherTotal()" required />' +
    '</div>' +
    '</td>' +
    '<td style="text-align: center;">' +
    '<button type="button" class="icon-btn icon-btn-delete has-tooltip" data-tooltip="Remove Row" onclick="removeEditVoucherRow(this)" aria-label="Remove Row">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
    '</button>' +
    '</td>';
  tbody.appendChild(tr);
  updateEditVoucherTotal();
}

function removeEditVoucherRow(btn) {
  const row = btn.closest('tr');
  const tbody = document.getElementById('edit-voucher-items-tbody');
  if (row && tbody) {
    if (tbody.querySelectorAll('tr.edit-voucher-item-row').length <= 1) {
      showToast('A voucher must have at least one line item', 'warning');
      return;
    }
    row.remove();
    updateEditVoucherTotal();
  }
}

function openEditVoucherModal(voucherId) {
  const v = (typeof cachedVouchers !== 'undefined' ? cachedVouchers.find((x) => x.id === voucherId) : null) ||
            (typeof cachedPVList !== 'undefined' ? cachedPVList.find((x) => x.id === voucherId) : null);
  if (!v) {
    showToast('Voucher not found', 'warning');
    return;
  }

  currentEditVoucherCurrency = v.currency || 'PHP';
  const sym = currentEditVoucherCurrency === 'USD' ? '$' : '₱';

  const rawDate = v.voucherDate || v.createdAt;
  const isoDate = new Date(rawDate).toISOString().split('T')[0];

  let items = v.items || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (_) { items = []; }
  }
  if (!items || items.length === 0) {
    items = [{
      invoiceNo: '',
      description: v.notes || (v.recipient ? 'Payment to ' + v.recipient : 'Disbursement Item'),
      amountCents: v.amountCents || 0,
    }];
  }

  let sig = v.signatories || {};
  if (typeof sig === 'string') {
    try { sig = JSON.parse(sig); } catch (_) { sig = {}; }
  }

  let rowsHtml = '';
  items.forEach((it) => {
    const inv = it.invoiceNo || '';
    const desc = it.description || '';
    const amt = ((it.amountCents || 0) / 100).toFixed(2);
    rowsHtml +=
      '<tr class="edit-voucher-item-row">' +
      '<td><input type="text" class="form-input edit-item-invoice" style="padding: 0.45rem 0.65rem; font-size: 0.85rem;" placeholder="Inv # / Ref" value="' + escapeHtml(inv) + '" /></td>' +
      '<td><input type="text" class="form-input edit-item-desc" style="padding: 0.45rem 0.65rem; font-size: 0.85rem;" placeholder="Account / Description" value="' + escapeHtml(desc) + '" required /></td>' +
      '<td><div style="position: relative;"><span class="edit-cur-symbol" style="position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); font-size: 0.82rem; color: #64748b; pointer-events: none;">' + sym + '</span>' +
      '<input type="number" step="0.01" min="0" class="form-input edit-item-amount" style="padding: 0.45rem 0.65rem 0.45rem 1.6rem; font-size: 0.85rem; text-align: right; font-family: monospace;" placeholder="0.00" value="' + amt + '" oninput="updateEditVoucherTotal()" required /></div></td>' +
      '<td style="text-align: center;">' +
      '<button type="button" class="icon-btn icon-btn-delete has-tooltip" data-tooltip="Remove Row" onclick="removeEditVoucherRow(this)" aria-label="Remove Row">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
      '</button></td>' +
      '</tr>';
  });

  let signatoriesHtml = '';
  if (v.voucherType === 'PAYMENT') {
    signatoriesHtml =
      '<div style="border-top: 1px solid var(--border-color); padding-top: 0.85rem; margin-top: 0.85rem;">' +
      '<div style="font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em;">✍️ Official Slip Signatories</div>' +
      '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">' +
      '<div><label class="form-label" style="font-size: 0.76rem;">Prepared by</label><input type="text" id="edit-sig-prep" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.82rem;" value="' + escapeHtml(sig.preparedBy || '') + '" placeholder="Administrator / Bookkeeper" /></div>' +
      '<div><label class="form-label" style="font-size: 0.76rem;">Certified Correct by</label><input type="text" id="edit-sig-cert" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.82rem;" value="' + escapeHtml(sig.certifiedBy || '') + '" placeholder="Joy / Senior Admin" /></div>' +
      '<div><label class="form-label" style="font-size: 0.76rem;">Approved by</label><input type="text" id="edit-sig-appr" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.82rem;" value="' + escapeHtml(sig.approvedBy || '') + '" placeholder="Kenneth Brown / CEO" /></div>' +
      '<div><label class="form-label" style="font-size: 0.76rem;">Received by</label><input type="text" id="edit-sig-recv" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.82rem;" value="' + escapeHtml(sig.receivedBy || '') + '" placeholder="Signature over printed name / Date" /></div>' +
      '</div></div>';
  }

  const vSettings = window.cachedVoucherSettings || {};
  const editMethods = (vSettings['vouchers.payment_methods'] && Array.isArray(vSettings['vouchers.payment_methods']))
    ? vSettings['vouchers.payment_methods']
    : [
        { id: 'BANK_TRANSFER', name: 'Bank Transfer' },
        { id: 'CHECK', name: 'Check' },
        { id: 'CASH', name: 'Cash' },
        { id: 'CREDIT_CARD', name: 'Credit Card' },
        { id: 'ONLINE', name: 'Online Payment' },
        { id: 'DOUBLE_ENTRY', name: 'Double-Entry Journal' },
      ];
  let editMethodOptions = editMethods
    .map((m) => '<option value="' + m.id + '"' + (v.paymentMethod === m.id ? ' selected' : '') + '>' + m.name + '</option>')
    .join('');
  if (v.paymentMethod && !editMethods.some((m) => m.id === v.paymentMethod)) {
    editMethodOptions += '<option value="' + v.paymentMethod + '" selected>' + v.paymentMethod + '</option>';
  }

  // Tag & Clean Notes resolution
  let currentTag = v.tag || '';
  let cleanNotes = v.notes || '';
  if (cleanNotes.startsWith('[') && cleanNotes.includes(']')) {
    if (!currentTag) {
      currentTag = cleanNotes.slice(1, cleanNotes.indexOf(']'));
    }
    cleanNotes = cleanNotes.slice(cleanNotes.indexOf(']') + 1).trim();
  }
  if (currentTag === 'MANUAL' || currentTag === 'DIRECT_RECEIPT') currentTag = '';

  const presetTags = [
    'Utilities & Telecom',
    'Logistics & Freight',
    'Payroll & Wages',
    'Medical / Health',
    'Office Supplies & IT',
    'Travel & Transport',
    'General Expense',
    'PO Procurement',
    'Contra Transfer',
    'Sales Invoice',
  ];
  const customTags = (vSettings['vouchers.tags'] && Array.isArray(vSettings['vouchers.tags'])) ? vSettings['vouchers.tags'] : [];
  const allTagsList = Array.from(new Set(customTags.concat(presetTags)));
  const tagDatalistOptions = allTagsList.map((t) => '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>').join('');

  const currentStatus = v.status || 'POSTED';
  const recipientTypeVal = v.recipientType || 'VENDOR';

  const isDraft = currentStatus === 'DRAFT';
  const voucherNumberFieldHtml = isDraft
    ? '<div class="form-group" style="margin-bottom: 0;">' +
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">' +
      '<label class="form-label" style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0;" for="edit-v-number">Voucher # *</label>' +
      '<span class="badge badge-warning" style="font-size: 0.68rem; padding: 0.1rem 0.35rem; font-weight: 600;">Draft Editable</span>' +
      '</div>' +
      '<input type="text" id="edit-v-number" class="form-input" value="' + escapeHtml(v.voucherNumber) + '" required style="background: #ffffff; border: 1px solid #f59e0b; font-weight: 700; font-family: monospace; font-size: 0.88rem;" placeholder="e.g. 26-000440" /></div>'
    : '<div class="form-group" style="margin-bottom: 0;">' +
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">' +
      '<label class="form-label" style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0;">Voucher Number</label>' +
      '<span style="font-size: 0.7rem; color: #64748b;">(Locked)</span>' +
      '</div>' +
      '<input type="text" id="edit-v-number" class="form-input" value="' + escapeHtml(v.voucherNumber) + '" disabled style="background: #f1f5f9; cursor: not-allowed; font-weight: 700; font-family: monospace; font-size: 0.88rem;" /></div>';

  const body =
    '<form id="edit-voucher-form" onsubmit="event.preventDefault(); handleSaveVoucherEdit(\'' + v.id + '\', \'' + v.voucherType + '\')">' +
    '<!-- SECTION 1: HEADER, DATE & STATUS -->' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.85rem; margin-bottom: 0.95rem;">' +
    voucherNumberFieldHtml +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" style="font-size: 0.8rem; font-weight: 700;" for="edit-v-date">Voucher Date *</label>' +
    '<input type="date" id="edit-v-date" class="form-input" value="' + isoDate + '" required style="font-weight: 600; font-size: 0.85rem;" /></div>' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" style="font-size: 0.8rem; font-weight: 700;" for="edit-v-status">Status</label>' +
    '<select id="edit-v-status" class="form-select" style="font-weight: 600; font-size: 0.85rem;">' +
    '<option value="POSTED"' + (currentStatus === 'POSTED' ? ' selected' : '') + '>POSTED (Official)</option>' +
    '<option value="DRAFT"' + (currentStatus === 'DRAFT' ? ' selected' : '') + '>DRAFT (Pending)</option>' +
    '<option value="VOID"' + (currentStatus === 'VOID' || currentStatus === 'DECLINED' ? ' selected' : '') + '>VOID (Declined / Reversed)</option>' +
    '</select></div>' +
    '</div>' +

    '<!-- SECTION 2: PAYEE, RECIPIENT TYPE & CURRENCY -->' +
    '<div style="display: grid; grid-template-columns: 1.5fr 1fr 0.85fr; gap: 0.85rem; margin-bottom: 0.95rem;">' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" style="font-size: 0.8rem; font-weight: 700;" for="edit-v-recipient">Pay to / Recipient / Client *</label>' +
    '<input type="text" id="edit-v-recipient" class="form-input" value="' + escapeHtml(v.recipientName || v.recipient || '') + '" required style="font-weight: 600; font-size: 0.85rem;" /></div>' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" style="font-size: 0.8rem; font-weight: 700;" for="edit-v-recipient-type">Classification</label>' +
    '<select id="edit-v-recipient-type" class="form-select" style="font-size: 0.84rem;">' +
    '<option value="VENDOR"' + (recipientTypeVal === 'VENDOR' ? ' selected' : '') + '>Vendor / Supplier</option>' +
    '<option value="EMPLOYEE"' + (recipientTypeVal === 'EMPLOYEE' ? ' selected' : '') + '>Employee / Staff</option>' +
    '<option value="OTHER"' + (recipientTypeVal === 'OTHER' ? ' selected' : '') + '>Other / Contractor</option>' +
    '</select></div>' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" style="font-size: 0.8rem; font-weight: 700;" for="edit-v-currency">Currency</label>' +
    '<select id="edit-v-currency" class="form-select" onchange="updateEditVoucherCurrency()" style="font-weight: 700; font-size: 0.84rem;">' +
    '<option value="PHP"' + (currentEditVoucherCurrency === 'PHP' ? ' selected' : '') + '>PHP (₱)</option>' +
    '<option value="USD"' + (currentEditVoucherCurrency === 'USD' ? ' selected' : '') + '>USD ($)</option>' +
    '</select></div>' +
    '</div>' +

    '<!-- SECTION 3: PAYMENT METHOD & EXPENSE TAG / CATEGORY -->' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1.15rem;">' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" style="font-size: 0.8rem; font-weight: 700;" for="edit-v-method">Payment Method</label>' +
    '<select id="edit-v-method" class="form-select" style="font-size: 0.84rem;">' +
    editMethodOptions +
    '</select></div>' +
    '<div class="form-group" style="margin-bottom: 0;"><label class="form-label" style="font-size: 0.8rem; font-weight: 700;" for="edit-v-tag">🏷️ Expense Tag / Category</label>' +
    '<input type="text" id="edit-v-tag" class="form-input" list="edit-v-tags-datalist" value="' + escapeHtml(currentTag) + '" placeholder="e.g. Utilities, Logistics, Medical, Travel..." style="font-size: 0.84rem;" />' +
    '<datalist id="edit-v-tags-datalist">' + tagDatalistOptions + '</datalist>' +
    '</div>' +
    '</div>' +

    '<!-- SECTION 4: LINE ITEMS BREAKDOWN -->' +
    '<div class="form-group" style="margin-bottom: 1.15rem;">' +
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">' +
    '<label class="form-label" style="margin-bottom: 0; font-weight: 700; font-size: 0.86rem; color: #1e293b;">📋 Line Items Breakdown Table</label>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="addEditVoucherRow()" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; font-size: 0.8rem; font-weight: 600;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> + Add Line Item</button>' +
    '</div>' +
    '<div class="table-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; background: #ffffff;">' +
    '<table class="table" style="margin-bottom: 0;">' +
    '<thead><tr style="background: #f8fafc;"><th style="width: 25%; font-size: 0.8rem;">Invoice No / Ref</th><th style="width: 45%; font-size: 0.8rem;">Account / Description</th><th style="width: 22%; text-align: right; font-size: 0.8rem;">Amount (<span id="edit-voucher-th-symbol">' + sym + '</span>)</th><th style="width: 8%; text-align: center; font-size: 0.8rem;"></th></tr></thead>' +
    '<tbody id="edit-voucher-items-tbody">' + rowsHtml + '</tbody>' +
    '<tfoot><tr style="background: #f8fafc; font-weight: 700; border-top: 1.5px solid var(--border-color);"><td colspan="2" style="text-align: right; font-size: 0.85rem; color: #334155;">Total Summary:</td><td style="text-align: right; font-size: 0.92rem; color: var(--primary); font-family: monospace;" id="edit-voucher-total-display">' + formatCurrency(v.amountCents, currentEditVoucherCurrency) + '</td><td></td></tr></tfoot>' +
    '</table></div></div>' +

    '<!-- SECTION 5: MEMO & REMARKS -->' +
    '<div class="form-group" style="margin-bottom: 1.15rem;"><label class="form-label" style="font-size: 0.8rem; font-weight: 700;" for="edit-v-notes">Memo / Remarks</label>' +
    '<textarea id="edit-v-notes" class="form-input" rows="2" placeholder="e.g. Corporate expense remarks..." style="font-size: 0.84rem;">' + escapeHtml(cleanNotes) + '</textarea></div>' +
    signatoriesHtml +
    '</form>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="handleSaveVoucherEdit(\'' + v.id + '\', \'' + v.voucherType + '\')">Save Changes</button>';

  openModal('Edit Voucher — ' + v.voucherNumber, body, footer, 'lg');
}

async function handleSaveVoucherEdit(voucherId, voucherType) {
  const numberInput = document.getElementById('edit-v-number');
  const dateInput = document.getElementById('edit-v-date');
  const recipientInput = document.getElementById('edit-v-recipient');
  const recipientTypeInput = document.getElementById('edit-v-recipient-type');
  const currencyInput = document.getElementById('edit-v-currency');
  const methodInput = document.getElementById('edit-v-method');
  const statusInput = document.getElementById('edit-v-status');
  const tagInput = document.getElementById('edit-v-tag');
  const notesInput = document.getElementById('edit-v-notes');

  const payload = {
    voucherNumber: (numberInput && !numberInput.disabled && numberInput.value.trim()) ? numberInput.value.trim() : undefined,
    voucherDate: dateInput ? new Date(dateInput.value).toISOString() : undefined,
    recipientName: recipientInput ? recipientInput.value.trim() : undefined,
    recipientType: recipientTypeInput ? recipientTypeInput.value : undefined,
    currency: currencyInput ? currencyInput.value : undefined,
    paymentMethod: methodInput ? methodInput.value : undefined,
    status: statusInput ? statusInput.value : undefined,
    tag: tagInput ? tagInput.value.trim() : undefined,
    notes: notesInput ? notesInput.value.trim() : undefined,
  };

  // Parse item rows from the table
  const itemRows = document.querySelectorAll('#edit-voucher-items-tbody tr.edit-voucher-item-row');
  const items = [];
  let totalAmountCents = 0;

  itemRows.forEach((row) => {
    const inv = (row.querySelector('.edit-item-invoice') ? row.querySelector('.edit-item-invoice').value : '').trim();
    const desc = (row.querySelector('.edit-item-desc') ? row.querySelector('.edit-item-desc').value : '').trim();
    const amtInput = row.querySelector('.edit-item-amount');
    const amtVal = parseFloat((amtInput ? amtInput.value : '0') || '0');
    const amtCents = Math.round(amtVal * 100);

    if (desc && amtCents > 0) {
      items.push({
        invoiceNo: inv,
        description: desc,
        amountCents: amtCents,
      });
      totalAmountCents += amtCents;
    }
  });

  if (items.length === 0) {
    showToast('Please provide at least one valid line item with description and amount', 'warning');
    return;
  }

  payload.items = items;
  payload.amountCents = totalAmountCents;

  // Parse signatories if present
  const prepEl = document.getElementById('edit-sig-prep');
  const certEl = document.getElementById('edit-sig-cert');
  const apprEl = document.getElementById('edit-sig-appr');
  const recvEl = document.getElementById('edit-sig-recv');
  if (prepEl || certEl || apprEl || recvEl) {
    payload.signatories = {
      preparedBy: prepEl ? prepEl.value.trim() : '',
      certifiedBy: certEl ? certEl.value.trim() : '',
      approvedBy: apprEl ? apprEl.value.trim() : '',
      receivedBy: recvEl ? recvEl.value.trim() : '',
    };
  }

  try {
    const res = await apiFetch('/api/accounting/vouchers/' + voucherId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Failed to update voucher', 'danger');
      return;
    }
    closeModal();
    showToast('Voucher and line items table updated successfully', 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast('Network error: ' + err.message, 'danger');
  }
}

async function handleApproveVoucher(voucherId) {
  try {
    const res = await apiFetch('/api/accounting/vouchers/' + voucherId + '/approve', { method: 'POST' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Failed to approve voucher', 'danger');
      return;
    }
    showToast('Voucher approved and posted to General Ledger', 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast('Network error: ' + err.message, 'danger');
  }
}

function handleDeclineVoucher(voucherId) {
  openConfirmModal({
    title: 'Decline & Void Voucher',
    message: 'Are you sure you want to decline this voucher?',
    subtext: 'Its double-entry ledger impact will be immediately removed from the General Ledger and financial statements.',
    confirmText: 'Decline Voucher',
    cancelText: 'Cancel',
    type: 'warning',
    onConfirm: async () => {
      const res = await apiFetch('/api/accounting/vouchers/' + voucherId + '/decline', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || 'Failed to decline voucher', 'danger');
        return;
      }
      showToast('Voucher declined and ledger adjusted', 'warning');
      if (typeof loadAccounting === 'function') loadAccounting();
      if (typeof loadVouchers === 'function') loadVouchers();
    },
  });
}

async function handleRestoreVoucher(voucherId) {
  try {
    const res = await apiFetch('/api/accounting/vouchers/' + voucherId + '/restore', { method: 'POST' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Failed to restore voucher', 'danger');
      return;
    }
    showToast('Voucher restored and re-posted to General Ledger', 'success');
    if (typeof loadAccounting === 'function') loadAccounting();
    if (typeof loadVouchers === 'function') loadVouchers();
  } catch (err) {
    showToast('Network error: ' + err.message, 'danger');
  }
}

function handleDeleteVoucher(voucherId, voucherNumber) {
  openConfirmModal({
    title: 'Permanently Delete Voucher',
    message: 'Are you sure you want to permanently delete voucher <strong>' + (voucherNumber || '') + '</strong>?',
    subtext: 'This action cannot be undone and will permanently remove this voucher record from the system.',
    confirmText: 'Delete Permanently',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: async () => {
      const res = await apiFetch('/api/accounting/vouchers/' + voucherId, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || 'Failed to delete voucher', 'danger');
        return;
      }
      showToast('Voucher deleted permanently', 'info');
      if (typeof loadAccounting === 'function') loadAccounting();
      if (typeof loadVouchers === 'function') loadVouchers();
    },
  });
}

// Voucher History & Audit Trail Modal
async function openVoucherHistoryModal(voucherId) {
  const v = (typeof cachedVouchers !== 'undefined' ? cachedVouchers.find((x) => x.id === voucherId) : null) ||
            (typeof cachedPVList !== 'undefined' ? cachedPVList.find((x) => x.id === voucherId) : null);
  const voucherNumber = v ? (v.voucherNumber || v.jvNumber || 'Voucher') : 'Voucher';

  const loadingHtml =
    '<div style="text-align: center; padding: 2.5rem 1rem;">' +
    '<div class="spinner" style="margin: 0 auto 1rem auto; width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>' +
    '<div style="font-weight: 600; color: #475569;">Loading revision history & audit trail...</div>' +
    '</div>';
  openModal('📜 Revision History — ' + voucherNumber, loadingHtml, '<button class="btn btn-secondary" onclick="closeModal()">Close</button>', 'lg');

  try {
    const res = await apiFetch('/api/accounting/vouchers/' + voucherId + '/history');
    const json = await res.json();
    if (!res.ok || !json.success) {
      document.getElementById('modal-body').innerHTML = '<div class="alert alert-danger">Failed to load history: ' + escapeHtml(json.error || 'Unknown error') + '</div>';
      return;
    }

    const historyItems = json.data || [];
    if (v) v.historyCount = historyItems.length;
    if (historyItems.length === 0) {
      document.getElementById('modal-body').innerHTML =
        '<div style="text-align: center; padding: 3rem 1.5rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">' +
        '<div style="font-size: 2.2rem; margin-bottom: 0.65rem;">📜</div>' +
        '<div style="font-weight: 700; font-size: 1.05rem; color: #1e293b; margin-bottom: 0.35rem;">No History Records Found</div>' +
        '<div style="color: #64748b; font-size: 0.88rem; max-width: 440px; margin: 0 auto;">' +
        'Audit trail tracking is active. Any edits, approvals, status reversals, or updates made to <strong>' + escapeHtml(voucherNumber) + '</strong> will be tracked here with author and field-by-field diff details.' +
        '</div></div>';
      return;
    }

    let timelineHtml = '<div class="voucher-history-timeline" style="display: flex; flex-direction: column; gap: 1rem; position: relative; padding-left: 1.5rem; margin-left: 0.5rem; border-left: 2px solid #e2e8f0;">';

    historyItems.forEach((item) => {
      let badgeBg = '#0284c7';
      let badgeLabel = 'UPDATED';
      let badgeIcon = '✏️';

      if (item.action === 'CREATED') {
        badgeBg = '#16a34a';
        badgeLabel = 'CREATED';
        badgeIcon = '✨';
      } else if (item.action === 'APPROVED') {
        badgeBg = '#059669';
        badgeLabel = 'APPROVED';
        badgeIcon = '✅';
      } else if (item.action === 'VOIDED') {
        badgeBg = '#dc2626';
        badgeLabel = 'VOIDED';
        badgeIcon = '🚫';
      } else if (item.action === 'RESTORED') {
        badgeBg = '#d97706';
        badgeLabel = 'RESTORED';
        badgeIcon = '♻️';
      }

      const rawDate = item.createdAt;
      let dateDisplay = '—';
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          dateDisplay = d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
        }
      }

      let changesHtml = '';
      if (item.changes && typeof item.changes === 'object' && Object.keys(item.changes).length > 0) {
        const keys = Object.keys(item.changes);
        let rows = '';
        keys.forEach((k) => {
          const change = item.changes[k];
          let fieldTitle = k;
          if (k === 'amountCents') fieldTitle = 'Total Amount';
          else if (k === 'recipientName') fieldTitle = 'Recipient / Payee';
          else if (k === 'recipientType') fieldTitle = 'Classification';
          else if (k === 'voucherDate') fieldTitle = 'Voucher Date';
          else if (k === 'paymentMethod') fieldTitle = 'Payment Method';
          else if (k === 'status') fieldTitle = 'Status';
          else if (k === 'notes') fieldTitle = 'Memo / Notes';
          else if (k === 'items') fieldTitle = 'Line Items';
          else if (k === 'signatories') fieldTitle = 'Signatories';

          let oldVal = change.old;
          let newVal = change.new;

          if (k === 'amountCents') {
            oldVal = formatCurrency(oldVal, v ? v.currency : 'PHP');
            newVal = formatCurrency(newVal, v ? v.currency : 'PHP');
          } else if (k === 'items' && Array.isArray(newVal)) {
            oldVal = (Array.isArray(oldVal) ? oldVal.length : 0) + ' item(s)';
            newVal = newVal.length + ' item(s)';
          } else if (typeof oldVal === 'object' && oldVal !== null) {
            oldVal = JSON.stringify(oldVal);
            newVal = JSON.stringify(newVal);
          }

          rows +=
            '<tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.8rem;">' +
            '<td style="padding: 0.35rem 0.5rem; font-weight: 600; color: #475569; width: 30%;">' + escapeHtml(fieldTitle) + '</td>' +
            '<td style="padding: 0.35rem 0.5rem; color: #dc2626; width: 35%; text-decoration: line-through; word-break: break-word;">' + escapeHtml(String(oldVal != null ? oldVal : '—')) + '</td>' +
            '<td style="padding: 0.35rem 0.5rem; color: #16a34a; font-weight: 600; width: 35%; word-break: break-word;">' + escapeHtml(String(newVal != null ? newVal : '—')) + '</td>' +
            '</tr>';
        });

        changesHtml =
          '<div style="margin-top: 0.6rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">' +
          '<div style="background: #f8fafc; padding: 0.3rem 0.6rem; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Specific Field Changes</div>' +
          '<table style="width: 100%; border-collapse: collapse;">' +
          '<thead><tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.72rem; color: #64748b;">' +
          '<th style="padding: 0.25rem 0.5rem; text-align: left;">Field</th>' +
          '<th style="padding: 0.25rem 0.5rem; text-align: left;">Previous</th>' +
          '<th style="padding: 0.25rem 0.5rem; text-align: left;">New</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
          '</table></div>';
      }

      const emailPart = item.changedByUserEmail ? ' <span style="font-size: 0.76rem; color: #64748b;">&lt;' + escapeHtml(item.changedByUserEmail) + '&gt;</span>' : '';

      timelineHtml +=
        '<div class="history-item" style="position: relative; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">' +
        '<div style="position: absolute; left: -1.95rem; top: 1rem; width: 14px; height: 14px; border-radius: 50%; background: ' + badgeBg + '; border: 3px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1;"></div>' +
        '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.4rem;">' +
        '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
        '<span class="badge" style="background: ' + badgeBg + '; color: #ffffff; font-size: 0.74rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.3rem;">' +
        badgeIcon + ' ' + badgeLabel + '</span>' +
        '<span style="font-weight: 700; font-size: 0.88rem; color: #1e293b;">' + escapeHtml(item.changedByUserName || 'Staff') + '</span>' +
        emailPart +
        '</div>' +
        '<div style="font-size: 0.78rem; font-family: monospace; color: #64748b;">⏱️ ' + dateDisplay + '</div>' +
        '</div>' +
        '<div style="font-size: 0.85rem; color: #334155; font-weight: 500;">' + escapeHtml(item.summary) + '</div>' +
        changesHtml +
        '</div>';
    });

    timelineHtml += '</div>';

    const headerHtml =
      '<div style="display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.25rem; border: 1px solid #e2e8f0;">' +
      '<div>' +
      '<div style="font-size: 0.76rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Voucher Reference</div>' +
      '<div style="font-weight: 700; font-family: monospace; font-size: 1.05rem; color: var(--primary);">' + escapeHtml(voucherNumber) + '</div>' +
      '</div>' +
      '<div style="text-align: right;">' +
      '<div style="font-size: 0.76rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Revisions</div>' +
      '<div style="font-weight: 700; font-size: 1.05rem; color: #0f172a;">' + historyItems.length + ' record' + (historyItems.length === 1 ? '' : 's') + '</div>' +
      '</div>' +
      '</div>';

    document.getElementById('modal-body').innerHTML = headerHtml + timelineHtml;
  } catch (err) {
    document.getElementById('modal-body').innerHTML = '<div class="alert alert-danger">Network error: ' + escapeHtml(err.message) + '</div>';
  }
}

// Global aliases for interoperability across vouchers and accounting views
window.renderOfficialVoucherSlipMarkup = renderOfficialVoucherSlipMarkup;
window.generateVoucherPdfBlob = generateVoucherPdfBlob;
window.downloadSingleVoucherPdf = downloadSingleVoucherPdf;
window.openOfficialVoucherSlipModal = openVoucherSlipModal;
window.openVoucherHistoryModal = openVoucherHistoryModal;
window.openNewJournalVoucherModal = openNewJVModal;
window.openNewContraVoucherModal = openNewContraModal;
window.declineVoucher = handleDeclineVoucher;
window.restoreVoucher = handleRestoreVoucher;
window.deleteVoucherPermanent = handleDeleteVoucher;
window.openEditVoucherModal = openEditVoucherModal;
window.handleSaveVoucherEdit = handleSaveVoucherEdit;
window.handlePvPayToMe = handlePvPayToMe;
window.handlePvQuickPayeeSelect = handlePvQuickPayeeSelect;
window.handlePvPayeeInput = handlePvPayeeInput;
window.handleVoucherActiveViewMode = handleVoucherActiveViewMode;
window.handleVoucherSearch = handleVoucherSearch;
window.handleVoucherYearFilter = handleVoucherYearFilter;


async function loadPayroll() {
  const container = document.getElementById('view-payroll');
  if (!container) return;
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading payroll runs...</div>');

  try {
    const runsRes = await apiFetch('/api/payroll/runs');
    const runsJson = await runsRes.json();
    state.payrollRuns = runsJson.data || [];

    let runRows = '';
    state.payrollRuns.forEach((run) => {
      const isFinal = run.status === 'FINALIZED';
      runRows +=
        '<tr>' +
        '<td><strong>' + run.runNumber + '</strong></td>' +
        '<td>' + (run.periodStartDate || '') + ' to ' + (run.periodEndDate || '') + '</td>' +
        '<td><span class="badge ' + (isFinal ? 'badge-success' : 'badge-warning') + '"><span class="badge-dot"></span>' + run.status + '</span></td>' +
        '<td><strong>' + formatCurrency(run.totalNetCents) + '</strong></td>' +
        '<td>' + (run.paymentVoucher?.voucherNumber ? '<strong style="font-family: monospace;">' + run.paymentVoucher.voucherNumber + '</strong>' : '<span style="color: #94a3b8;">Pending Finalization</span>') + '</td>' +
        '<td>' + (!isFinal ? (can('payroll', 'update') ? '<button type="button" class="btn btn-success btn-sm" onclick="finalizePayrollRun(\'' + run.id + '\', \'' + run.runNumber + '\')">Finalize & Disburse</button>' : '<span class="badge badge-warning">Pending</span>') : '<span class="badge badge-success">Disbursed</span>') + '</td>' +
        '</tr>';
    });

    container.innerHTML =
      '<div class="panel-card">' +
      '<div class="panel-header">' +
      '<div>' +
      '<div class="panel-title">💵 Payroll Runs & Disbursements</div>' +
      '<div style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-top: 0.3rem;">' +
      'Calculate monthly/bi-monthly compensation runs, finalize payouts, and audit auto-generated payment vouchers.' +
      '</div>' +
      '</div>' +
      '<div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="exportPayrollRunsCsv()">📥 Export Runs CSV</button>' +
      (can('payroll', 'create') ? '<button type="button" class="btn btn-primary btn-sm" onclick="openNewPayrollRunModal()">+ Calculate Payroll</button>' : '') +
      '</div>' +
      '</div>' +
      '<div class="table-responsive">' +
      '<table class="data-table">' +
      '<thead>' +
      '<tr>' +
      '<th>Run ID</th>' +
      '<th>Pay Period</th>' +
      '<th>Status</th>' +
      '<th>Total Net Payout</th>' +
      '<th>Payment Voucher</th>' +
      '<th>Actions</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' +
      (runRows || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No payroll runs calculated yet.</td></tr>') +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>';
  } catch (err) {
    container.innerHTML = '<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading payroll: ' + err.message + '</div>';
  }
}

function exportPayrollRunsCsv() {
  const headers = ['Run ID', 'Period Start', 'Period End', 'Status', 'Total Net Payout (PHP)', 'Payment Voucher'];
  const rows = (state.payrollRuns || []).map((run) => [
    run.runNumber,
    run.periodStartDate,
    run.periodEndDate,
    run.status,
    (run.totalNetCents / 100).toFixed(2),
    run.paymentVoucher?.voucherNumber || 'Pending',
  ]);
  exportToCsv('payroll_runs_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function openNewPayrollRunModal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const start = year + '-' + month + '-01';
  const end = new Date(year, now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const body =
    '<form id="form-new-pr" onsubmit="submitNewPayrollRun(event)">' +
    '<p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem;">' +
    'Calculating a payroll run computes gross pay, allowances, deductions, and net payouts for all active staff.' +
    '</p>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group">' +
    '<label class="form-label">Period Start Date *</label>' +
    '<input type="date" id="npr-start" class="form-input" value="' + start + '" required />' +
    '</div>' +
    '<div class="form-group">' +
    '<label class="form-label">Period End Date *</label>' +
    '<input type="date" id="npr-end" class="form-input" value="' + end + '" required />' +
    '</div>' +
    '</div>' +
    '</form>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="document.getElementById(\'form-new-pr\').requestSubmit()">Calculate Payroll</button>';

  openModal('Run Payroll Calculation', body, footer);
}

async function submitNewPayrollRun(e) {
  e.preventDefault();
  const payload = {
    periodStartDate: document.getElementById('npr-start').value,
    periodEndDate: document.getElementById('npr-end').value,
  };

  try {
    const res = await apiFetch('/api/payroll/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to calculate payroll');

    closeModal();
    showToast('Payroll Run ' + json.data.runNumber + ' calculated', 'success');
    loadPayroll();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function finalizePayrollRun(runId, runNumber) {
  openConfirmModal({
    title: 'Finalize & Disburse Payroll',
    message: 'Finalize and disburse payroll run <strong>' + (runNumber || '') + '</strong>?',
    subtext: 'This will finalize all computed payslips, record staff disbursements, and automatically generate a corresponding Payment Voucher.',
    confirmText: 'Finalize & Disburse',
    cancelText: 'Cancel',
    type: 'success',
    onConfirm: async () => {
      const res = await apiFetch('/api/payroll/runs/' + runId + '/finalize', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to finalize payroll');

      showToast('Payroll Run ' + runNumber + ' finalized and Payment Voucher created', 'success');
      loadPayroll();
    },
  });
}


let staffSearchQuery = '';
let staffStatusFilter = 'ALL';

async function loadStaff() {
  const container = document.getElementById('view-staff');
  if (!container) return;
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading staff directory...</div>');

  try {
    const res = await apiFetch('/api/payroll/employees');
    const json = await res.json();
    state.employees = json.data || [];
    renderStaffContent(container);
  } catch (err) {
    container.innerHTML = '<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading staff directory: ' + err.message + '</div>';
  }
}

function getStaffRoleOptionsHtml(selectedRole = 'STAFF') {
  const roles = (window.__ROLES__ && window.__ROLES__.length > 0)
    ? window.__ROLES__
    : [
        { code: 'STAFF', name: 'General Staff' },
        { code: 'MANAGER', name: 'Operations Manager' },
        { code: 'ADMIN', name: 'System Administrator' },
      ];

  return roles.map((r) => {
    const isSel = r.code === selectedRole;
    return '<option value="' + r.code + '"' + (isSel ? ' selected' : '') + '>' + r.name + ' (' + r.code + ')</option>';
  }).join('');
}

function handleStaffSearch(query) {
  staffSearchQuery = (query || '').toLowerCase().trim();
  const container = document.getElementById('view-staff');
  if (container) renderStaffContent(container);
}

function handleStaffStatusFilter(status) {
  staffStatusFilter = status;
  const container = document.getElementById('view-staff');
  if (container) renderStaffContent(container);
}

function renderStaffContent(container) {
  const allEmployees = state.employees || [];

  const filtered = allEmployees.filter((emp) => {
    // Status filter
    if (staffStatusFilter !== 'ALL' && emp.status !== staffStatusFilter) {
      return false;
    }
    // Search query
    if (!staffSearchQuery) return true;
    const code = (emp.employeeCode || '').toLowerCase();
    const name = ((emp.firstName || '') + ' ' + (emp.lastName || '')).toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    const pos = (emp.position || '').toLowerCase();
    return code.includes(staffSearchQuery) || name.includes(staffSearchQuery) || email.includes(staffSearchQuery) || dept.includes(staffSearchQuery) || pos.includes(staffSearchQuery);
  });

  let empRows = '';
  filtered.forEach((emp) => {
    const salary = emp.salaryStructures?.[0];
    const statusClass = emp.status === 'ACTIVE' ? 'badge-success' : emp.status === 'ON_LEAVE' ? 'badge-warning' : 'badge-danger';
    const hasUser = !!emp.user;

    empRows +=
      '<tr>' +
      '<td><strong style="font-family: monospace; color: var(--primary);">' + emp.employeeCode + '</strong></td>' +
      '<td>' +
      '<div style="font-weight: 600; color: #1e293b;">' + emp.firstName + ' ' + emp.lastName + '</div>' +
      '<div style="font-size: 0.76rem; color: #64748b;">' + emp.email + (emp.phone ? ' • ' + emp.phone : '') + '</div>' +
      (hasUser ? '<div style="margin-top: 0.2rem;"><span class="badge badge-primary" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">🔐 ' + emp.user.role + ' Account</span></div>' : '') +
      '</td>' +
      '<td>' +
      '<div style="font-weight: 500;">' + (emp.department || '—') + '</div>' +
      '<div style="font-size: 0.76rem; color: #64748b;">' + (emp.position || '—') + '</div>' +
      '</td>' +
      '<td style="font-size: 0.82rem; color: #475569;">' + (emp.hireDate ? emp.hireDate.slice(0, 10) : '—') + '</td>' +
      '<td>' + formatCurrency(salary?.baseSalaryCents) + '</td>' +
      '<td>' + formatCurrency(salary?.allowancesCents) + '</td>' +
      '<td>' + formatCurrency(salary?.deductionsCents) + '</td>' +
      '<td><strong style="color: #0f766e;">' + formatCurrency(salary?.netSalaryCents) + '</strong></td>' +
      '<td><span class="badge ' + statusClass + '"><span class="badge-dot"></span>' + (emp.status || 'ACTIVE') + '</span></td>' +
      '<td style="text-align: right; white-space: nowrap;">' +
      '<div style="display: inline-flex; gap: 0.35rem; justify-content: flex-end;">' +
      '<button type="button" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.5rem;" title="View Profile" onclick="openViewEmployeeModal(\'' + emp.id + '\')">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' +
      '</button>' +
      (can('staff', 'update')
        ? '<button type="button" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.5rem;" title="Edit Employee Profile" onclick="openEditEmployeeModal(\'' + emp.id + '\')">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>' +
          '</button>' +
          '<button type="button" class="btn ' + (hasUser ? 'btn-secondary' : 'btn-outline-primary') + ' btn-sm" style="padding: 0.3rem 0.5rem;' + (hasUser ? '' : ' border: 1px dashed #3b82f6;') + '" title="' + (hasUser ? 'Edit Login Account & Reset Password (' + emp.user.role + ')' : '+ Provision Login Account') + '" onclick="openEmployeeAccountModal(\'' + emp.id + '\')">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' +
          '</button>'
        : '') +
      (can('staff', 'delete')
        ? '<button type="button" class="btn btn-danger btn-sm" style="padding: 0.3rem 0.5rem;" title="Delete / Deactivate" onclick="handleDeleteEmployee(\'' + emp.id + '\', \'' + emp.employeeCode + '\')">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
          '</button>'
        : '') +
      '</div>' +
      '</td>' +
      '</tr>';
  });

  container.innerHTML =
    '<div class="panel-card">' +
    '<div class="panel-header">' +
    '<div>' +
    '<div class="panel-title">👥 Staff & Human Resources</div>' +
    '<div style="font-size: 0.78rem; font-weight: 400; color: #64748b; margin-top: 0.25rem;">' +
    'Manage corporate personnel, departmental assignments, base compensation packages, and system login credentials.' +
    '</div>' +
    '</div>' +
    '<div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="exportEmployeesCsv()">📥 Export Staff CSV</button>' +
    (can('staff', 'create') ? '<button type="button" class="btn btn-primary btn-sm" onclick="openNewEmployeeModal()">+ Add Employee</button>' : '') +
    '</div>' +
    '</div>' +
    '<div style="padding: 0 1.25rem 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); margin-bottom: 0.5rem;">' +
    '<div style="display: flex; gap: 0.75rem; flex-wrap: wrap; flex: 1; max-width: 600px;">' +
    '<input type="text" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.82rem; flex: 1; min-width: 220px;" placeholder="Search employee code, name, department, role..." value="' + (staffSearchQuery || '') + '" oninput="handleStaffSearch(this.value)" />' +
    '<select class="form-select" style="padding: 0.45rem 0.75rem; font-size: 0.82rem; width: auto;" onchange="handleStaffStatusFilter(this.value)">' +
    '<option value="ALL"' + (staffStatusFilter === 'ALL' ? ' selected' : '') + '>All Statuses</option>' +
    '<option value="ACTIVE"' + (staffStatusFilter === 'ACTIVE' ? ' selected' : '') + '>Active Only</option>' +
    '<option value="ON_LEAVE"' + (staffStatusFilter === 'ON_LEAVE' ? ' selected' : '') + '>On Leave</option>' +
    '<option value="TERMINATED"' + (staffStatusFilter === 'TERMINATED' ? ' selected' : '') + '>Terminated</option>' +
    '</select>' +
    '</div>' +
    '<div style="font-size: 0.8rem; color: #64748b;">' +
    'Showing <strong>' + filtered.length + '</strong> of <strong>' + allEmployees.length + '</strong> staff members' +
    '</div>' +
    '</div>' +
    '<div class="table-responsive">' +
    '<table class="data-table">' +
    '<thead>' +
    '<tr>' +
    '<th>Code</th>' +
    '<th>Employee Name & Contact</th>' +
    '<th>Department / Position</th>' +
    '<th>Hire Date</th>' +
    '<th>Base Salary</th>' +
    '<th>Allowances</th>' +
    '<th>Deductions</th>' +
    '<th>Net Compensation</th>' +
    '<th>Status</th>' +
    '<th style="text-align: right;">Actions</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' +
    (empRows || '<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 2rem;">No staff records found matching your filters.</td></tr>') +
    '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>';
}

function exportEmployeesCsv() {
  const headers = ['Employee Code', 'Full Name', 'Email', 'Phone', 'Department', 'Position', 'Status', 'Hire Date', 'Base Salary (PHP)', 'Allowances (PHP)', 'Deductions (PHP)', 'Net Salary (PHP)', 'Bank Name', 'Account Number'];
  const rows = (state.employees || []).map((emp) => {
    const salary = emp.salaryStructures?.[0];
    return [
      emp.employeeCode,
      emp.firstName + ' ' + emp.lastName,
      emp.email,
      emp.phone || '',
      emp.department,
      emp.position,
      emp.status || 'ACTIVE',
      emp.hireDate ? emp.hireDate.slice(0, 10) : '',
      salary ? (salary.baseSalaryCents / 100).toFixed(2) : '0.00',
      salary ? (salary.allowancesCents / 100).toFixed(2) : '0.00',
      salary ? (salary.deductionsCents / 100).toFixed(2) : '0.00',
      salary ? (salary.netSalaryCents / 100).toFixed(2) : '0.00',
      emp.bankName || '',
      emp.bankAccountNumber || '',
    ];
  });
  exportToCsv('employees_staff_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function updateModalNetSalaryPreview(prefix) {
  const baseEl = document.getElementById(prefix + '-base');
  const allowEl = document.getElementById(prefix + '-allow');
  const deductEl = document.getElementById(prefix + '-deduct');
  const previewEl = document.getElementById(prefix + '-net-preview');
  if (!baseEl || !previewEl) return;

  const base = parseFloat(baseEl.value || '0');
  const allow = parseFloat(allowEl ? allowEl.value || '0' : '0');
  const deduct = parseFloat(deductEl ? deductEl.value || '0' : '0');
  const net = Math.max(0, base + allow - deduct);
  previewEl.textContent = formatCurrency(Math.round(net * 100));
}

function openNewEmployeeModal() {
  const today = new Date().toISOString().slice(0, 10);
  const body =
    '<form id="form-new-emp" onsubmit="submitNewEmployee(event)">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Employee Code *</label>' +
    '<input type="text" id="nemp-code" class="form-input" placeholder="EMP-002" required style="font-weight: 700; font-family: monospace;" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Hire Date *</label>' +
    '<input type="date" id="nemp-hire-date" class="form-input" value="' + today + '" required />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">First Name *</label>' +
    '<input type="text" id="nemp-first" class="form-input" placeholder="Alex" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Last Name *</label>' +
    '<input type="text" id="nemp-last" class="form-input" placeholder="Smith" required />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Email Address *</label>' +
    '<input type="email" id="nemp-email" class="form-input" placeholder="name@company.com" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Phone Number</label>' +
    '<input type="tel" id="nemp-phone" class="form-input" placeholder="+63 912 345 6789" />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.15rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Department *</label>' +
    '<input type="text" id="nemp-dept" class="form-input" placeholder="Engineering / Logistics / Accounting" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Position / Job Title *</label>' +
    '<input type="text" id="nemp-pos" class="form-input" placeholder="Senior Operations Specialist" required />' +
    '</div>' +
    '</div>' +
    '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
    '<div style="font-size: 0.82rem; font-weight: 700; color: #334155; margin-bottom: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em;">💰 Compensation & Salary Package (PHP)</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.5rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Base Monthly Salary (₱) *</label>' +
    '<input type="number" id="nemp-base" class="form-input" step="0.01" value="25000" oninput="updateModalNetSalaryPreview(\'nemp\')" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Allowances (₱)</label>' +
    '<input type="number" id="nemp-allow" class="form-input" step="0.01" value="2500" oninput="updateModalNetSalaryPreview(\'nemp\')" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Deductions (₱)</label>' +
    '<input type="number" id="nemp-deduct" class="form-input" step="0.01" value="1500" oninput="updateModalNetSalaryPreview(\'nemp\')" />' +
    '</div>' +
    '</div>' +
    '<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.4rem; border-top: 1px solid #e2e8f0; font-size: 0.82rem;">' +
    '<span style="color: #64748b; font-weight: 500;">Calculated Net Compensation:</span>' +
    '<strong id="nemp-net-preview" style="color: #0f766e; font-size: 0.95rem; font-family: monospace;">₱26,000.00</strong>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Bank Name</label>' +
    '<input type="text" id="nemp-bank-name" class="form-input" placeholder="BDO / BPI / Metrobank" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Bank Account Number</label>' +
    '<input type="text" id="nemp-bank-acc" class="form-input" placeholder="0012-3456-7890" />' +
    '</div>' +
    '</div>' +
    '<div style="border-top: 1px solid #e2e8f0; padding-top: 0.85rem;">' +
    '<div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">' +
    '<input type="checkbox" id="nemp-create-account" onchange="toggleNewEmployeeAccountFields()" />' +
    '<label class="form-label" style="margin: 0; font-weight: 600;" for="nemp-create-account">Also create a system login account for this employee</label>' +
    '</div>' +
    '<div id="nemp-account-fields" style="display: none; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-sm); padding: 0.85rem; margin-top: 0.5rem;">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Initial Password *</label>' +
    '<input type="password" id="nemp-password" class="form-input" placeholder="At least 8 chars" minlength="8" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">System Role *</label>' +
    '<select id="nemp-role" class="form-select">' +
    getStaffRoleOptionsHtml('STAFF') +
    '</select>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</form>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="document.getElementById(\'form-new-emp\').requestSubmit()">Save Employee</button>';

  openModal('Add New Employee', body, footer, 'lg');
}

function toggleNewEmployeeAccountFields() {
  const checkbox = document.getElementById('nemp-create-account');
  const fields = document.getElementById('nemp-account-fields');
  const passwordInput = document.getElementById('nemp-password');
  if (!fields || !checkbox) return;
  const show = checkbox.checked;
  fields.style.display = show ? 'block' : 'none';
  if (passwordInput) passwordInput.required = show;
}

async function submitNewEmployee(e) {
  e.preventDefault();
  const createAccount = document.getElementById('nemp-create-account')?.checked;
  const password = document.getElementById('nemp-password')?.value;

  if (createAccount && (!password || password.length < 8)) {
    showToast('Password must be at least 8 characters to create a user account', 'warning');
    return;
  }

  const basePesos = parseFloat(document.getElementById('nemp-base').value || '0');
  const allowPesos = parseFloat(document.getElementById('nemp-allow').value || '0');
  const deductPesos = parseFloat(document.getElementById('nemp-deduct').value || '0');

  const payload = {
    employeeCode: document.getElementById('nemp-code').value.trim(),
    email: document.getElementById('nemp-email').value.trim(),
    firstName: document.getElementById('nemp-first').value.trim(),
    lastName: document.getElementById('nemp-last').value.trim(),
    phone: document.getElementById('nemp-phone')?.value.trim() || undefined,
    department: document.getElementById('nemp-dept').value.trim(),
    position: document.getElementById('nemp-pos').value.trim(),
    hireDate: document.getElementById('nemp-hire-date')?.value || new Date().toISOString().slice(0, 10),
    bankName: document.getElementById('nemp-bank-name')?.value.trim() || undefined,
    bankAccountNumber: document.getElementById('nemp-bank-acc')?.value.trim() || undefined,
    baseSalaryCents: Math.round(basePesos * 100),
    allowancesCents: Math.round(allowPesos * 100),
    deductionsCents: Math.round(deductPesos * 100),
    createAccount: !!createAccount,
    password: createAccount ? password : undefined,
    role: createAccount ? document.getElementById('nemp-role').value : undefined,
  };

  try {
    const res = await apiFetch('/api/payroll/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create employee');

    closeModal();
    const extra = json.userCreated ? ' (login account created with role ' + json.userRole + ')' : '';
    showToast('Employee ' + json.data.employeeCode + ' created' + extra, 'success');
    loadStaff();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openViewEmployeeModal(empId) {
  const emp = (state.employees || []).find((x) => x.id === empId);
  if (!emp) {
    showToast('Employee record not found', 'warning');
    return;
  }

  const salary = emp.salaryStructures?.[0];
  const statusClass = emp.status === 'ACTIVE' ? 'badge-success' : emp.status === 'ON_LEAVE' ? 'badge-warning' : 'badge-danger';
  const hasUser = !!emp.user;

  const body =
    '<div style="display: flex; gap: 1.25rem; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1rem;">' +
    '<div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #3b82f6); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 700;">' +
    (emp.firstName?.[0] || 'E') + (emp.lastName?.[0] || '') +
    '</div>' +
    '<div style="flex: 1;">' +
    '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
    '<h3 style="margin: 0; font-size: 1.1rem; color: #1e293b;">' + emp.firstName + ' ' + emp.lastName + '</h3>' +
    '<span class="badge ' + statusClass + '">' + (emp.status || 'ACTIVE') + '</span>' +
    '</div>' +
    '<div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">' + (emp.position || '—') + ' • ' + (emp.department || '—') + '</div>' +
    '</div>' +
    '<div style="text-align: right;">' +
    '<div style="font-size: 0.75rem; color: #64748b;">Employee Code</div>' +
    '<strong style="font-family: monospace; font-size: 1rem; color: var(--primary);">' + emp.employeeCode + '</strong>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">' +
    '<div>' +
    '<div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Email Address</div>' +
    '<div style="font-weight: 500; color: #334155;">' + emp.email + '</div>' +
    '</div>' +
    '<div>' +
    '<div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Phone Number</div>' +
    '<div style="font-weight: 500; color: #334155;">' + (emp.phone || 'None recorded') + '</div>' +
    '</div>' +
    '<div>' +
    '<div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Hire Date</div>' +
    '<div style="font-weight: 500; color: #334155;">' + (emp.hireDate ? emp.hireDate.slice(0, 10) : '—') + '</div>' +
    '</div>' +
    '<div>' +
    '<div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">System Login Account</div>' +
    '<div style="font-weight: 500; color: #334155;">' +
    (hasUser ? '<span class="badge badge-primary">Role: ' + emp.user.role + (emp.user.isActive ? ' (Active)' : ' (Disabled)') + '</span>' : '<span style="color: #94a3b8;">No account linked</span>') +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
    '<div style="font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em;">💰 Compensation & Salary Breakdown</div>' +
    '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; text-align: center;">' +
    '<div style="background: #ffffff; padding: 0.6rem; border-radius: 4px; border: 1px solid #e2e8f0;"><div style="font-size: 0.72rem; color: #64748b;">Base Salary</div><strong style="color: #1e293b; font-size: 0.9rem;">' + formatCurrency(salary?.baseSalaryCents) + '</strong></div>' +
    '<div style="background: #ffffff; padding: 0.6rem; border-radius: 4px; border: 1px solid #e2e8f0;"><div style="font-size: 0.72rem; color: #64748b;">Allowances</div><strong style="color: #1e293b; font-size: 0.9rem;">' + formatCurrency(salary?.allowancesCents) + '</strong></div>' +
    '<div style="background: #ffffff; padding: 0.6rem; border-radius: 4px; border: 1px solid #e2e8f0;"><div style="font-size: 0.72rem; color: #64748b;">Deductions</div><strong style="color: #dc2626; font-size: 0.9rem;">' + formatCurrency(salary?.deductionsCents) + '</strong></div>' +
    '<div style="background: #ffffff; padding: 0.6rem; border-radius: 4px; border: 1px solid #ccfbf1;"><div style="font-size: 0.72rem; color: #0f766e;">Net Payout</div><strong style="color: #0f766e; font-size: 0.95rem;">' + formatCurrency(salary?.netSalaryCents) + '</strong></div>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div><div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Bank Name</div><div style="font-weight: 500; color: #334155;">' + (emp.bankName || '—') + '</div></div>' +
    '<div><div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.2rem;">Bank Account Number</div><div style="font-weight: 500; color: #334155; font-family: monospace;">' + (emp.bankAccountNumber || '—') + '</div></div>' +
    '</div>';

  const footer =
    '<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">' +
    (can('staff', 'update')
      ? '<button type="button" class="btn btn-secondary btn-sm" onclick="closeModal(); openEmployeeAccountModal(\'' + emp.id + '\')">🔐 ' + (hasUser ? 'Manage Login Account (' + emp.user.role + ')' : '+ Provision Login Account') + '</button>'
      : '<div></div>') +
    '<div style="display: flex; gap: 0.5rem;">' +
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>' +
    (can('staff', 'update')
      ? '<button type="button" class="btn btn-primary" onclick="closeModal(); openEditEmployeeModal(\'' + emp.id + '\')">Edit Profile</button>'
      : '') +
    '</div>' +
    '</div>';

  openModal('Employee Profile — ' + emp.employeeCode, body, footer, 'lg');
}

function openEditEmployeeModal(empId) {
  const emp = (state.employees || []).find((x) => x.id === empId);
  if (!emp) {
    showToast('Employee record not found', 'warning');
    return;
  }

  const salary = emp.salaryStructures?.[0];
  const basePesos = salary ? (salary.baseSalaryCents / 100).toFixed(2) : '0.00';
  const allowPesos = salary ? (salary.allowancesCents / 100).toFixed(2) : '0.00';
  const deductPesos = salary ? (salary.deductionsCents / 100).toFixed(2) : '0.00';
  const hireDateVal = emp.hireDate ? emp.hireDate.slice(0, 10) : '';

  const body =
    '<form id="form-edit-emp" onsubmit="submitEditEmployee(event, \'' + emp.id + '\')">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Employee Code <span style="font-weight: normal; color: #94a3b8; font-size: 0.72rem;">(Permanent)</span></label>' +
    '<input type="text" class="form-input" value="' + emp.employeeCode + '" disabled style="background: #f1f5f9; cursor: not-allowed; font-weight: 700; font-family: monospace; color: #475569;" title="Employee Code cannot be modified once created" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Employment Status *</label>' +
    '<select id="editemp-status" class="form-select">' +
    '<option value="ACTIVE"' + (emp.status === 'ACTIVE' ? ' selected' : '') + '>Active</option>' +
    '<option value="ON_LEAVE"' + (emp.status === 'ON_LEAVE' ? ' selected' : '') + '>On Leave</option>' +
    '<option value="TERMINATED"' + (emp.status === 'TERMINATED' ? ' selected' : '') + '>Terminated (Revoke Access)</option>' +
    '</select>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-first">First Name *</label>' +
    '<input type="text" id="editemp-first" class="form-input" value="' + emp.firstName + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-last">Last Name *</label>' +
    '<input type="text" id="editemp-last" class="form-input" value="' + emp.lastName + '" required />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-email">Email Address *</label>' +
    '<input type="email" id="editemp-email" class="form-input" value="' + emp.email + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-phone">Phone Number</label>' +
    '<input type="tel" id="editemp-phone" class="form-input" value="' + (emp.phone || '') + '" />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-dept">Department *</label>' +
    '<input type="text" id="editemp-dept" class="form-input" value="' + (emp.department || '') + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-pos">Position *</label>' +
    '<input type="text" id="editemp-pos" class="form-input" value="' + (emp.position || '') + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="editemp-hire-date">Hire Date *</label>' +
    '<input type="date" id="editemp-hire-date" class="form-input" value="' + hireDateVal + '" required />' +
    '</div>' +
    '</div>' +
    '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
    '<div style="font-size: 0.82rem; font-weight: 700; color: #334155; margin-bottom: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em;">💰 Update Compensation Package (PHP)</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.5rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Base Monthly Salary (₱) *</label>' +
    '<input type="number" id="editemp-base" class="form-input" step="0.01" value="' + basePesos + '" oninput="updateModalNetSalaryPreview(\'editemp\')" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Allowances (₱)</label>' +
    '<input type="number" id="editemp-allow" class="form-input" step="0.01" value="' + allowPesos + '" oninput="updateModalNetSalaryPreview(\'editemp\')" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" style="font-size: 0.76rem;">Deductions (₱)</label>' +
    '<input type="number" id="editemp-deduct" class="form-input" step="0.01" value="' + deductPesos + '" oninput="updateModalNetSalaryPreview(\'editemp\')" />' +
    '</div>' +
    '</div>' +
    '<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.4rem; border-top: 1px solid #e2e8f0; font-size: 0.82rem;">' +
    '<span style="color: #64748b; font-weight: 500;">Calculated Net Compensation:</span>' +
    '<strong id="editemp-net-preview" style="color: #0f766e; font-size: 0.95rem; font-family: monospace;">' + formatCurrency(salary?.netSalaryCents) + '</strong>' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Bank Name</label>' +
    '<input type="text" id="editemp-bank-name" class="form-input" value="' + (emp.bankName || '') + '" placeholder="BDO / BPI / Metrobank" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label">Bank Account Number</label>' +
    '<input type="text" id="editemp-bank-acc" class="form-input" value="' + (emp.bankAccountNumber || '') + '" placeholder="0012-3456-7890" />' +
    '</div>' +
    '</div>' +
    '</form>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="document.getElementById(\'form-edit-emp\').requestSubmit()">Save Changes</button>';

  openModal('Edit Employee — ' + emp.employeeCode, body, footer, 'lg');
}

async function submitEditEmployee(e, empId) {
  e.preventDefault();

  const basePesos = parseFloat(document.getElementById('editemp-base').value || '0');
  const allowPesos = parseFloat(document.getElementById('editemp-allow').value || '0');
  const deductPesos = parseFloat(document.getElementById('editemp-deduct').value || '0');

  const payload = {
    firstName: document.getElementById('editemp-first').value.trim(),
    lastName: document.getElementById('editemp-last').value.trim(),
    email: document.getElementById('editemp-email').value.trim(),
    phone: document.getElementById('editemp-phone')?.value.trim() || undefined,
    department: document.getElementById('editemp-dept').value.trim(),
    position: document.getElementById('editemp-pos').value.trim(),
    status: document.getElementById('editemp-status').value,
    hireDate: document.getElementById('editemp-hire-date')?.value || undefined,
    bankName: document.getElementById('editemp-bank-name')?.value.trim() || undefined,
    bankAccountNumber: document.getElementById('editemp-bank-acc')?.value.trim() || undefined,
    baseSalaryCents: Math.round(basePesos * 100),
    allowancesCents: Math.round(allowPesos * 100),
    deductionsCents: Math.round(deductPesos * 100),
  };

  try {
    const res = await apiFetch('/api/payroll/employees/' + empId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update employee');

    closeModal();
    showToast('Employee ' + json.data.employeeCode + ' updated successfully', 'success');
    loadStaff();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function handleDeleteEmployee(empId, empCode) {
  openConfirmModal({
    title: 'Delete / Deactivate Employee',
    message: 'Are you sure you want to delete employee <strong>' + (empCode || '') + '</strong>?',
    subtext: 'If historical payroll records exist, status will automatically be set to TERMINATED and system access revoked.',
    confirmText: 'Yes, Delete Employee',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: async () => {
      const res = await apiFetch('/api/payroll/employees/' + empId, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete employee');

      showToast(json.message || 'Employee deleted', json.softDeleted ? 'warning' : 'success');
      loadStaff();
    },
  });
}

function openEmployeeAccountModal(empId) {
  const emp = (state.employees || []).find((x) => x.id === empId);
  if (!emp) {
    showToast('Employee record not found', 'warning');
    return;
  }

  const hasUser = !!emp.user;
  let body = '';
  let footer = '';

  if (hasUser) {
    body =
      '<form id="form-edit-emp-acc" onsubmit="submitEditEmployeeAccount(event, \'' + emp.id + '\')">' +
      '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
      '<div style="display: flex; align-items: center; justify-content: space-between;">' +
      '<div>' +
      '<div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">' + emp.firstName + ' ' + emp.lastName + '</div>' +
      '<div style="font-size: 0.78rem; color: #64748b; font-family: monospace;">' + emp.employeeCode + ' • ' + (emp.department || '') + '</div>' +
      '</div>' +
      '<span class="badge ' + (emp.user.isActive ? 'badge-success' : 'badge-danger') + '">' +
      '<span class="badge-dot"></span>' + (emp.user.isActive ? 'Account Active' : 'Account Disabled') +
      '</span>' +
      '</div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
      '<div class="form-group" style="margin-bottom: 0;">' +
      '<label class="form-label" for="empacc-email">Login Email / Username *</label>' +
      '<input type="email" id="empacc-email" class="form-input" value="' + (emp.user.email || emp.email) + '" required />' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0;">' +
      '<label class="form-label" for="empacc-role">System Access Role *</label>' +
      '<select id="empacc-role" class="form-select">' +
      getStaffRoleOptionsHtml(emp.user.role || 'STAFF') +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0.85rem;">' +
      '<label class="form-label" for="empacc-active">Account Status *</label>' +
      '<select id="empacc-active" class="form-select">' +
      '<option value="true"' + (emp.user.isActive ? ' selected' : '') + '>Active (Can log into ERP)</option>' +
      '<option value="false"' + (!emp.user.isActive ? ' selected' : '') + '>Disabled (Locked out immediately)</option>' +
      '</select>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0.25rem;">' +
      '<label class="form-label" for="empacc-password">Reset Password</label>' +
      '<div style="position: relative;">' +
      '<input type="password" id="empacc-password" class="form-input" placeholder="Leave empty to keep existing password" minlength="8" style="padding-right: 2.5rem;" />' +
      '<button type="button" class="btn btn-secondary btn-sm" style="position: absolute; right: 4px; top: 4px; bottom: 4px; padding: 0 0.5rem; display: flex; align-items: center;" onclick="togglePasswordVisibility(\'empacc-password\', this)">' +
      EYE_ICON_SVG +
      '</button>' +
      '</div>' +
      '<div style="font-size: 0.72rem; color: #64748b; margin-top: 0.35rem;">Enter a new password (min. 8 characters) to reset login access, or leave blank to keep current password.</div>' +
      '</div>' +
      '</form>';

    footer =
      '<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">' +
      '<button type="button" class="btn btn-danger btn-sm" onclick="handleUnlinkEmployeeAccount(\'' + emp.id + '\', \'' + emp.employeeCode + '\')">Unlink / Revoke Access</button>' +
      '<div style="display: flex; gap: 0.5rem;">' +
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="submit" form="form-edit-emp-acc" class="btn btn-primary">Save Account Changes</button>' +
      '</div>' +
      '</div>';
  } else {
    body =
      '<form id="form-create-emp-acc" onsubmit="submitCreateEmployeeAccount(event, \'' + emp.id + '\')">' +
      '<div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">' +
      '<div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">' + emp.firstName + ' ' + emp.lastName + '</div>' +
      '<div style="font-size: 0.78rem; color: #64748b; font-family: monospace;">' + emp.employeeCode + ' • ' + (emp.department || '') + '</div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
      '<div class="form-group" style="margin-bottom: 0;">' +
      '<label class="form-label" for="newacc-email">Login Email *</label>' +
      '<input type="email" id="newacc-email" class="form-input" value="' + emp.email + '" required />' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0;">' +
      '<label class="form-label" for="newacc-role">System Access Role *</label>' +
      '<select id="newacc-role" class="form-select">' +
      getStaffRoleOptionsHtml('STAFF') +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom: 0.25rem;">' +
      '<label class="form-label" for="newacc-password">Initial Password * (min. 8 characters)</label>' +
      '<div style="position: relative;">' +
      '<input type="password" id="newacc-password" class="form-input" placeholder="Create strong temporary password" minlength="8" required style="padding-right: 2.5rem;" />' +
      '<button type="button" class="btn btn-secondary btn-sm" style="position: absolute; right: 4px; top: 4px; bottom: 4px; padding: 0 0.5rem; display: flex; align-items: center;" onclick="togglePasswordVisibility(\'newacc-password\', this)">' +
      EYE_ICON_SVG +
      '</button>' +
      '</div>' +
      '<div style="font-size: 0.72rem; color: #64748b; margin-top: 0.35rem;">This will create an active login account and link it to this employee record.</div>' +
      '</div>' +
      '</form>';

    footer =
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="submit" form="form-create-emp-acc" class="btn btn-primary">+ Provision Login Account</button>';
  }

  openModal((hasUser ? 'Manage Login Account — ' : 'Provision Login Account — ') + emp.employeeCode, body, footer, 'md');
}

async function submitCreateEmployeeAccount(e, empId) {
  e.preventDefault();
  const email = document.getElementById('newacc-email').value.trim();
  const role = document.getElementById('newacc-role').value;
  const password = document.getElementById('newacc-password').value;

  try {
    const res = await apiFetch('/api/payroll/employees/' + empId + '/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create account');

    closeModal();
    showToast(json.message || 'Login account created successfully', 'success');
    loadStaff();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function submitEditEmployeeAccount(e, empId) {
  e.preventDefault();
  const email = document.getElementById('empacc-email').value.trim();
  const role = document.getElementById('empacc-role').value;
  const isActive = document.getElementById('empacc-active').value === 'true';
  const password = document.getElementById('empacc-password')?.value || undefined;

  const payload = {
    email,
    role,
    isActive,
    ...(password && password.trim().length >= 8 ? { password: password.trim() } : {}),
  };

  try {
    const res = await apiFetch('/api/payroll/employees/' + empId + '/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update account');

    closeModal();
    showToast('Login account updated successfully', 'success');
    loadStaff();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function handleUnlinkEmployeeAccount(empId, empCode) {
  openConfirmModal({
    title: 'Unlink / Revoke Login Account',
    message: 'Are you sure you want to revoke and unlink the login account for employee <strong>' + (empCode || '') + '</strong>?',
    subtext: 'The user account will be deactivated and blocked from logging into the platform.',
    confirmText: 'Revoke Access',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: async () => {
      const res = await apiFetch('/api/payroll/employees/' + empId + '/account', {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to unlink account');

      closeModal();
      showToast(json.message || 'Login account revoked', 'warning');
      loadStaff();
    },
  });
}


const MODULE_CONFIG = {"dashboard":{"name":"Dashboard","category":"Operations","route":"/dashboard","description":"Executive KPIs, operational summaries, business metrics, and recent activity"},"directory":{"name":"Business Directory","category":"Operations","route":"/directory","description":"Company entities, branches, departments, job titles, customers & vendor accounts"},"inventory":{"name":"Inventory & Stock","category":"Operations","route":"/inventory","description":"Product master catalog, stock levels, warehouse ledger & inventory adjustments"},"purchasing":{"name":"Purchasing (P2P)","category":"Operations","route":"/purchasing","description":"Purchase Orders (PO), procurement management & vendor purchase commitments"},"inbound":{"name":"Inbound Deliveries","category":"Operations","route":"/inbound","description":"Goods Receipt Notes (GRN), shipment receiving & warehouse physical check-in"},"sales":{"name":"Sales & Invoicing","category":"Operations","route":"/sales","description":"Customer Sales Orders (SO), commercial billing invoices & revenue receipts"},"outbound":{"name":"Delivery Receipts (DR)","category":"Operations","route":"/outbound","description":"Warehouse dispatch, delivery receipts & inventory deduction on confirmed customer delivery"},"vouchers":{"name":"Vouchers","category":"Finance & HR","route":"/vouchers","description":"Corporate disbursements, payment vouchers, official slips & approvals"},"accounting":{"name":"Accounting & Reports","category":"Finance & HR","route":"/accounting","description":"Receipt Vouchers (RV), Journal Vouchers (JV), Void audit, Chart of Accounts, General Ledger, Profit & Loss, Balance Sheet & Cash Flow"},"payroll":{"name":"Payroll","category":"Finance & HR","route":"/payroll","description":"Payroll processing runs, compensation computation, payslips & payment disbursement"},"staff":{"name":"Staff & HR","category":"Finance & HR","route":"/staff","description":"Employee directory, salary compensation packages & ERP login account management"},"settings":{"name":"System Settings","category":"Administration","route":"/settings","description":"Company profiles, voucher signatories, default currencies & system configuration"}};
let adminActiveRoleTab = 'MANAGER';

async function loadAdmin() {
  const container = document.getElementById('view-admin');
  beginViewLoad(container, '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading users, roles & permissions...</div>');

  try {
    const [usersRes, rolesRes, permsRes] = await Promise.all([
      apiFetch('/api/admin/users'),
      apiFetch('/api/admin/roles'),
      apiFetch('/api/admin/role-permissions'),
    ]);
    const usersJson = await usersRes.json();
    const rolesJson = await rolesRes.json();
    const permsJson = await permsRes.json();

    if (!usersRes.ok || !usersJson.success) throw new Error(usersJson.error || 'Failed to load users');
    if (!rolesRes.ok || !rolesJson.success) throw new Error(rolesJson.error || 'Failed to load roles');
    if (!permsRes.ok || !permsJson.success) throw new Error(permsJson.error || 'Failed to load permissions');

    state.adminUsers = usersJson.data || [];
    state.roles = rolesJson.roles || [];
    window.__ROLES__ = state.roles;
    state.adminModules = permsJson.modules || [];
    state.adminMatrix = permsJson.matrix || {};
    state.adminCrudMatrix = permsJson.crudMatrix || {};

    if (!adminActiveRoleTab || !state.roles.some((r) => r.code === adminActiveRoleTab)) {
      adminActiveRoleTab = state.roles.find((r) => r.code !== 'ADMIN')?.code || 'MANAGER';
    }

    renderAdminPanel(container);
  } catch (err) {
    container.innerHTML = `<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading administration: ${err.message}</div>`;
  }
}

function getRoleBadgeClass(roleCode) {
  if (roleCode === 'ADMIN') return 'badge-primary';
  if (roleCode === 'MANAGER') return 'badge-warning';
  if (roleCode === 'STAFF') return 'badge-secondary';
  return 'badge-success';
}

function renderAdminPanel(container) {
  // 1. User Accounts Rows
  let userRows = '';
  state.adminUsers.forEach((u) => {
    const roleItem = (state.roles || []).find((r) => r.code === u.role);
    const roleName = roleItem?.name || u.role;
    const isCustom = Boolean(u.hasCustomPermissions);
    const customCount = u.customPermissionCount || 0;

    userRows += `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>
          <span class="badge ${getRoleBadgeClass(u.role)}" title="${roleName}">
            ${u.role}
          </span>
        </td>
        <td>
          ${
            u.role === 'ADMIN'
              ? '<span class="badge badge-primary" title="System Administrator has full access to all modules">Full Admin</span>'
              : isCustom
              ? `<span class="badge badge-warning" style="cursor: pointer;" onclick="openUserCustomPermissionsModal('${u.id}')" title="Customized module permissions enabled for this employee">⚙️ Custom (${customCount} mods)</span>`
              : `<span class="badge badge-neutral" style="cursor: pointer;" onclick="openUserCustomPermissionsModal('${u.id}')" title="Inheriting base role permissions">Role Default (${u.role})</span>`
          }
        </td>
        <td><span class="badge ${u.isActive ? 'badge-success' : 'badge-danger'}"><span class="badge-dot"></span>${u.isActive ? 'Active' : 'Deactivated'}</span></td>
        <td>
          <div style="display: inline-flex; gap: 0.35rem;">
            ${
              u.role !== 'ADMIN'
                ? `<button class="btn btn-secondary btn-sm" onclick="openUserCustomPermissionsModal('${u.id}')" title="Configure Custom Permissions for this Employee">
                    ⚙️ Permissions
                  </button>`
                : ''
            }
            <button class="btn btn-secondary btn-sm" onclick="openAdminEditUserModal('${u.id}')" title="Edit Role & Reset Password">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Edit
            </button>
            ${u.isActive
              ? `<button class="btn btn-danger btn-sm" onclick="toggleUserActive('${u.id}', false)" ${u.id === state.user.id ? 'disabled title="You cannot deactivate yourself"' : ''}>Deactivate</button>`
              : `<button class="btn btn-secondary btn-sm" onclick="toggleUserActive('${u.id}', true)">Reactivate</button>`
            }
          </div>
        </td>
      </tr>
    `;
  });

  // 2. Roles & Groups Table Rows
  let roleRows = '';
  (state.roles || []).forEach((r) => {
    const isSys = Boolean(r.isSystem || ['ADMIN', 'MANAGER', 'STAFF'].includes(r.code));
    roleRows += `
      <tr>
        <td>
          <div style="font-weight: 700; color: #1e293b;">${r.name}</div>
          <div style="font-size: 0.72rem; font-family: monospace; color: #64748b;">${r.code}</div>
        </td>
        <td>
          <span class="badge ${isSys ? 'badge-primary' : 'badge-neutral'}">
            ${isSys ? 'System Default' : 'Custom Group'}
          </span>
        </td>
        <td style="font-size: 0.83rem; color: #475569; max-width: 320px;">
          ${r.description || '<span style="color: #94a3b8;">—</span>'}
        </td>
        <td>
          <span class="badge ${r.userCount > 0 ? 'badge-success' : 'badge-neutral'}">
            ${r.userCount || 0} user${r.userCount === 1 ? '' : 's'}
          </span>
        </td>
        <td>
          <div style="display: inline-flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" onclick="openEditRoleModal('${r.id}')" title="Edit Name & Description">
              Edit Details
            </button>
            ${!isSys
              ? `<button class="btn btn-danger btn-sm" onclick="deleteCustomRole('${r.id}', '${r.name.replace(/'/g, "\\'")}', ${r.userCount || 0})" title="Delete Custom Role">Delete</button>`
              : '<span style="font-size: 0.72rem; color: #94a3b8; align-self: center; padding: 0 0.4rem;">Protected</span>'
            }
          </div>
        </td>
      </tr>
    `;
  });

  // 3. Role Tabs for CRUD Matrix
  const rolePillsHtml = (state.roles || []).map((r) => {
    const active = adminActiveRoleTab === r.code;
    return `
      <button type="button" onclick="switchAdminRoleTab('${r.code}')" style="padding: 0.45rem 1rem; border-radius: 999px; font-size: 0.82rem; font-weight: 600; border: 1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}; background: ${active ? 'var(--primary)' : '#ffffff'}; color: ${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        ${r.name} (${r.code})
      </button>
    `;
  }).join('');

  // 4. Matrix Rows for Active Role (Grouped by Category)
  const activeRoleObj = (state.roles || []).find((r) => r.code === adminActiveRoleTab) || { code: adminActiveRoleTab, name: adminActiveRoleTab, isSystem: false };
  const isAdminTab = activeRoleObj.code === 'ADMIN';
  const roleCrudMap = (state.adminCrudMatrix || {})[adminActiveRoleTab] || {};

  const categories = ['Operations', 'Finance & HR', 'Administration'];
  let matrixRows = '';

  categories.forEach((cat) => {
    const catModules = (state.adminModules || []).filter((m) => (MODULE_CONFIG[m]?.category || 'Operations') === cat);
    if (catModules.length === 0) return;

    matrixRows += `
      <tr style="background: #f8fafc;">
        <td colspan="5" style="padding: 0.5rem 1rem; font-weight: 700; font-size: 0.75rem; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
          ${cat}
        </td>
      </tr>
    `;

    catModules.forEach((mod) => {
      const info = MODULE_CONFIG[mod] || { name: mod, route: '/' + mod, description: '' };
      const p = roleCrudMap[mod] || { create: false, read: false, update: false, delete: false };

      if (isAdminTab) {
        matrixRows += `
          <tr>
            <td style="padding: 0.75rem 1rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-weight: 700; color: #1e293b; font-size: 0.9rem;">${info.name}</span>
                <span class="badge badge-neutral" style="font-family: monospace; font-size: 0.72rem; padding: 0.15rem 0.4rem;">${info.route}</span>
              </div>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem; line-height: 1.35;">${info.description}</div>
            </td>
            <td style="text-align: center; background: #f8fafc;" colspan="4">
              <span class="badge badge-success" style="font-size: 0.75rem; letter-spacing: 0.04em;">
                C • R • U • D (Full Access Permanently Enabled)
              </span>
            </td>
          </tr>
        `;
      } else {
        matrixRows += `
          <tr>
            <td style="padding: 0.75rem 1rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-weight: 700; color: #1e293b; font-size: 0.9rem;">${info.name}</span>
                <span class="badge badge-neutral" style="font-family: monospace; font-size: 0.72rem; padding: 0.15rem 0.4rem;">${info.route}</span>
              </div>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem; line-height: 1.35;">${info.description}</div>
            </td>
            <td style="text-align: center; vertical-align: middle;">
              <input type="checkbox" id="perm-${adminActiveRoleTab}-${mod}-create" ${p.create ? 'checked' : ''} style="cursor: pointer; width: 17px; height: 17px; accent-color: var(--primary);" />
            </td>
            <td style="text-align: center; vertical-align: middle;">
              <input type="checkbox" id="perm-${adminActiveRoleTab}-${mod}-read" ${p.read ? 'checked' : ''} style="cursor: pointer; width: 17px; height: 17px; accent-color: var(--primary);" />
            </td>
            <td style="text-align: center; vertical-align: middle;">
              <input type="checkbox" id="perm-${adminActiveRoleTab}-${mod}-update" ${p.update ? 'checked' : ''} style="cursor: pointer; width: 17px; height: 17px; accent-color: var(--primary);" />
            </td>
            <td style="text-align: center; vertical-align: middle;">
              <input type="checkbox" id="perm-${adminActiveRoleTab}-${mod}-delete" ${p.delete ? 'checked' : ''} style="cursor: pointer; width: 17px; height: 17px; accent-color: var(--primary);" />
            </td>
          </tr>
        `;
      }
    });
  });

  container.innerHTML = `
    <!-- 1. USER ACCOUNTS CARD -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <div class="panel-title">User Accounts & Logins</div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.2rem;">
            Manage credentials, active status, and assign roles & permission groups to users.
          </div>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Base Role</th>
              <th>Permissions</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${userRows || '<tr><td colspan="6" style="text-align: center;">No users found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 2. ROLES & PERMISSION GROUPS CARD -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <div class="panel-title">Roles & Permission Groups</div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.2rem;">
            Define custom roles (e.g., Accountant, Warehouse Lead, Sales Rep) and customize what employees in each group can do.
          </div>
        </div>
        <div class="panel-actions">
          <button class="btn btn-primary btn-sm" onclick="openNewRoleModal()">+ Add Role / Group</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Role Name & Code</th>
              <th>Type</th>
              <th>Description</th>
              <th>Assigned Users</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${roleRows || '<tr><td colspan="5" style="text-align: center;">No roles defined.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. GRANULAR CRUD MATRIX CARD -->
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <div class="panel-title">Role Permissions — Granular CRUD Matrix</div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.2rem;">
            Select a role to configure exact permissions: <strong>C</strong> (Create), <strong>R</strong> (Read/View), <strong>U</strong> (Update/Edit), <strong>D</strong> (Delete/Void).
          </div>
        </div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; align-items: center;">
          ${!isAdminTab ? `
            <button type="button" class="btn btn-secondary btn-sm" onclick="bulkSetPermissions(true)">Select All</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="bulkSetReadOnly()">Read-Only All</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="bulkSetPermissions(false)">Clear All</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="saveActiveRolePermissions()">Save Permissions</button>
          ` : '<span class="badge badge-success">Full System Access</span>'}
        </div>
      </div>
      
      <!-- Role Tab Pills -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 0 1.35rem 1rem;">
        ${rolePillsHtml}
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="min-width: 280px;">Module & Description</th>
              ${isAdminTab ? '<th style="text-align: center;" colspan="4">Access Authority</th>' : `
                <th style="text-align: center; width: 100px;">Create (C)</th>
                <th style="text-align: center; width: 100px;">Read (R)</th>
                <th style="text-align: center; width: 100px;">Update (U)</th>
                <th style="text-align: center; width: 100px;">Delete (D)</th>
              `}
            </tr>
          </thead>
          <tbody>
            ${matrixRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function switchAdminRoleTab(roleCode) {
  adminActiveRoleTab = roleCode;
  const container = document.getElementById('view-admin');
  if (container) renderAdminPanel(container);
}

function bulkSetPermissions(checked) {
  state.adminModules.forEach((mod) => {
    ['create', 'read', 'update', 'delete'].forEach((act) => {
      const el = document.getElementById('perm-' + adminActiveRoleTab + '-' + mod + '-' + act);
      if (el) el.checked = checked;
    });
  });
}

function bulkSetReadOnly() {
  state.adminModules.forEach((mod) => {
    const rEl = document.getElementById('perm-' + adminActiveRoleTab + '-' + mod + '-read');
    if (rEl) rEl.checked = true;
    ['create', 'update', 'delete'].forEach((act) => {
      const el = document.getElementById('perm-' + adminActiveRoleTab + '-' + mod + '-' + act);
      if (el) el.checked = false;
    });
  });
}

async function saveActiveRolePermissions() {
  const role = adminActiveRoleTab;
  if (!role || role === 'ADMIN') return;

  const permissions = {};
  state.adminModules.forEach((mod) => {
    const createCb = document.getElementById('perm-' + role + '-' + mod + '-create');
    const readCb = document.getElementById('perm-' + role + '-' + mod + '-read');
    const updateCb = document.getElementById('perm-' + role + '-' + mod + '-update');
    const deleteCb = document.getElementById('perm-' + role + '-' + mod + '-delete');

    permissions[mod] = {
      create: createCb ? createCb.checked : false,
      read: readCb ? readCb.checked : false,
      update: updateCb ? updateCb.checked : false,
      delete: deleteCb ? deleteCb.checked : false,
    };
  });

  try {
    const res = await apiFetch('/api/admin/role-permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, permissions }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save permissions');

    showToast('Permissions for ' + role + ' saved successfully', 'success');

    // Update live client matrices
    if (json.crudMatrix) {
      window.__ROLE_PERMISSIONS_CRUD__ = json.crudMatrix;
      state.adminCrudMatrix = json.crudMatrix;
    }
    if (json.matrix) {
      window.__ROLE_PERMISSIONS__ = json.matrix;
      state.adminMatrix = json.matrix;
    }
    applyRolePermissions();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Open New Role Modal
function openNewRoleModal() {
  const categories = ['Operations', 'Finance & HR', 'Administration'];
  let moduleCheckboxes = '';

  categories.forEach((cat) => {
    const catModules = (state.adminModules || []).filter((m) => (MODULE_CONFIG[m]?.category || 'Operations') === cat);
    if (catModules.length === 0) return;

    moduleCheckboxes += `
      <tr style="background: #f8fafc;">
        <td colspan="5" style="padding: 0.35rem 0.65rem; font-weight: 700; font-size: 0.72rem; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
          ${cat}
        </td>
      </tr>
    `;

    catModules.forEach((mod) => {
      const info = MODULE_CONFIG[mod] || { name: mod, route: '/' + mod, description: '' };
      moduleCheckboxes += `
        <tr>
          <td style="padding: 0.45rem 0.65rem;">
            <div style="font-weight: 600; font-size: 0.82rem; color: #1e293b;">${info.name} <span style="font-family: monospace; font-size: 0.7rem; color: #64748b;">(${info.route})</span></div>
          </td>
          <td style="text-align: center;"><input type="checkbox" id="newrole-mod-${mod}-c" /></td>
          <td style="text-align: center;"><input type="checkbox" id="newrole-mod-${mod}-r" checked /></td>
          <td style="text-align: center;"><input type="checkbox" id="newrole-mod-${mod}-u" /></td>
          <td style="text-align: center;"><input type="checkbox" id="newrole-mod-${mod}-d" /></td>
        </tr>
      `;
    });
  });

  const body = `
    <form id="form-new-role" onsubmit="submitNewRole(event)">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="newrole-code">Role Code (Slug) *</label>
          <input type="text" id="newrole-code" class="form-input" placeholder="e.g. ACCOUNTANT, WAREHOUSE_LEAD" style="text-transform: uppercase; font-family: monospace;" required />
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.25rem;">Uppercase alphanumeric identifier (e.g. AUDITOR, SALES_LEAD)</div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="newrole-name">Display Name *</label>
          <input type="text" id="newrole-name" class="form-input" placeholder="e.g. Finance & Accounting Specialist" required />
        </div>
      </div>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label class="form-label" for="newrole-desc">Description</label>
        <textarea id="newrole-desc" class="form-input" rows="2" placeholder="Brief summary of duties and responsibilities for this group"></textarea>
      </div>
      
      <div style="font-weight: 700; font-size: 0.88rem; color: #1e293b; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Initial Module CRUD Permissions</span>
        <div style="display: flex; gap: 0.35rem;">
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="bulkSetNewRoleModal(true)">All</button>
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="bulkSetNewRoleModal(false)">None</button>
        </div>
      </div>
      <div class="table-responsive" style="max-height: 280px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
        <table class="data-table" style="font-size: 0.8rem;">
          <thead>
            <tr>
              <th>Module</th>
              <th style="text-align: center; width: 60px;">C</th>
              <th style="text-align: center; width: 60px;">R</th>
              <th style="text-align: center; width: 60px;">U</th>
              <th style="text-align: center; width: 60px;">D</th>
            </tr>
          </thead>
          <tbody>
            ${moduleCheckboxes}
          </tbody>
        </table>
      </div>
    </form>
  `;

  const footer = `
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end; width: 100%;">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" form="form-new-role" class="btn btn-primary">Create Role & Permissions</button>
    </div>
  `;

  openModal('Add New Role / Permission Group', body, footer, 'lg');
}

function bulkSetNewRoleModal(checked) {
  state.adminModules.forEach((mod) => {
    ['c', 'r', 'u', 'd'].forEach((act) => {
      const el = document.getElementById('newrole-mod-' + mod + '-' + act);
      if (el) el.checked = checked;
    });
  });
}

async function submitNewRole(e) {
  e.preventDefault();
  const code = document.getElementById('newrole-code').value.trim().toUpperCase();
  const name = document.getElementById('newrole-name').value.trim();
  const description = document.getElementById('newrole-desc')?.value.trim() || undefined;

  const permissions = {};
  state.adminModules.forEach((mod) => {
    permissions[mod] = {
      create: Boolean(document.getElementById('newrole-mod-' + mod + '-c')?.checked),
      read: Boolean(document.getElementById('newrole-mod-' + mod + '-r')?.checked),
      update: Boolean(document.getElementById('newrole-mod-' + mod + '-u')?.checked),
      delete: Boolean(document.getElementById('newrole-mod-' + mod + '-d')?.checked),
    };
  });

  try {
    const res = await apiFetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, description, permissions }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create role');

    closeModal();
    showToast('Role "' + name + '" created successfully', 'success');
    adminActiveRoleTab = code;
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Edit Role Details Modal
function openEditRoleModal(roleId) {
  const r = (state.roles || []).find((x) => x.id === roleId);
  if (!r) {
    showToast('Role not found', 'warning');
    return;
  }

  const body = `
    <form id="form-edit-role" onsubmit="submitEditRole(event, '${r.id}')">
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem; margin-bottom: 0.85rem;">
        <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Role Identifier</div>
        <div style="font-family: monospace; font-weight: 700; color: #1e293b; font-size: 0.95rem;">${r.code}</div>
      </div>
      <div class="form-group" style="margin-bottom: 0.85rem;">
        <label class="form-label" for="editrole-name">Display Name *</label>
        <input type="text" id="editrole-name" class="form-input" value="${r.name}" required />
      </div>
      <div class="form-group" style="margin-bottom: 0.25rem;">
        <label class="form-label" for="editrole-desc">Description</label>
        <textarea id="editrole-desc" class="form-input" rows="3">${r.description || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end; width: 100%;">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" form="form-edit-role" class="btn btn-primary">Save Role Details</button>
    </div>
  `;

  openModal('Edit Role Details — ' + r.name, body, footer, 'md');
}

async function submitEditRole(e, roleId) {
  e.preventDefault();
  const name = document.getElementById('editrole-name').value.trim();
  const description = document.getElementById('editrole-desc')?.value.trim();

  try {
    const res = await apiFetch('/api/admin/roles/' + roleId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update role');

    closeModal();
    showToast('Role updated successfully', 'success');
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Delete Custom Role
function deleteCustomRole(roleId, roleName, userCount) {
  if (userCount > 0) {
    showToast('Cannot delete role "' + roleName + '" because ' + userCount + ' user(s) are assigned to it. Please reassign them first.', 'warning');
    return;
  }

  openConfirmModal({
    title: 'Delete Role Group',
    message: 'Are you sure you want to permanently delete the role "' + roleName + '"?',
    subtext: 'This will remove the role and all associated permission rules from the system.',
    confirmText: 'Delete Role',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: async () => {
      const res = await apiFetch('/api/admin/roles/' + roleId, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete role');

      showToast('Role deleted successfully', 'success');
      adminActiveRoleTab = 'MANAGER';
      loadAdmin();
    },
  });
}

function toggleUserActive(userId, makeActive) {
  if (!makeActive) {
    openConfirmModal({
      title: 'Deactivate User Account',
      message: 'Are you sure you want to deactivate this user account?',
      subtext: 'The user will be immediately signed out and blocked from accessing the system.',
      confirmText: 'Deactivate User',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        const res = await apiFetch('/api/admin/users/' + userId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update user');

        showToast('User account deactivated', 'warning');
        loadAdmin();
      },
    });
    return;
  }

  (async () => {
    try {
      const res = await apiFetch('/api/admin/users/' + userId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update user');

      showToast('User account reactivated', 'success');
      loadAdmin();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  })();
}

function openAdminEditUserModal(userId) {
  const u = (state.adminUsers || []).find((x) => x.id === userId);
  if (!u) {
    showToast('User not found', 'warning');
    return;
  }

  const isSelf = u.id === state.user?.id;

  const roleOptionsHtml = (state.roles || []).map((r) => {
    const isSel = r.code === u.role;
    return '<option value="' + r.code + '"' + (isSel ? ' selected' : '') + '>' + r.name + ' (' + r.code + ')</option>';
  }).join('');

  const body =
    '<form id="form-admin-edit-user" onsubmit="submitAdminEditUser(event, \'' + u.id + '\')">' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="admin-user-name">Full Name *</label>' +
    '<input type="text" id="admin-user-name" class="form-input" value="' + u.name + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="admin-user-email">Email / Username</label>' +
    '<input type="email" id="admin-user-email" class="form-input" value="' + u.email + '" disabled style="background: #f1f5f9; cursor: not-allowed;" />' +
    '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.85rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="admin-user-role">Assigned Role / Group *</label>' +
    '<select id="admin-user-role" class="form-select"' + (isSelf ? ' disabled title="You cannot change your own role"' : '') + '>' +
    roleOptionsHtml +
    '</select>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="admin-user-active">Account Status *</label>' +
    '<select id="admin-user-active" class="form-select"' + (isSelf ? ' disabled title="You cannot deactivate your own account"' : '') + '>' +
    '<option value="true"' + (u.isActive ? ' selected' : '') + '>Active (Can log in)</option>' +
    '<option value="false"' + (!u.isActive ? ' selected' : '') + '>Deactivated (Locked out)</option>' +
    '</select>' +
    '</div>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0.25rem;">' +
    '<label class="form-label" for="admin-user-pwd">Reset Password</label>' +
    '<div style="position: relative;">' +
    '<input type="password" id="admin-user-pwd" class="form-input" placeholder="Leave empty to keep existing password" minlength="8" style="padding-right: 2.5rem;" />' +
    '<button type="button" class="btn btn-secondary btn-sm" style="position: absolute; right: 4px; top: 4px; bottom: 4px; padding: 0 0.5rem; display: flex; align-items: center;" onclick="togglePasswordVisibility(\'admin-user-pwd\', this)">' +
    EYE_ICON_SVG +
    '</button>' +
    '</div>' +
    '<div style="font-size: 0.72rem; color: #64748b; margin-top: 0.35rem;">Enter a new password (min. 8 characters) to reset credentials for this account.</div>' +
    '</div>' +
    '</form>';

  const footer =
    '<div style="display: flex; gap: 0.5rem; justify-content: flex-end; width: 100%;">' +
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="submit" form="form-admin-edit-user" class="btn btn-primary">Save User Changes</button>' +
    '</div>';

  openModal('Edit User Account — ' + u.name, body, footer, 'md');
}

async function submitAdminEditUser(e, userId) {
  e.preventDefault();
  const name = document.getElementById('admin-user-name').value.trim();
  const roleEl = document.getElementById('admin-user-role');
  const activeEl = document.getElementById('admin-user-active');
  const pwd = document.getElementById('admin-user-pwd')?.value || undefined;

  const payload = {
    name,
    ...(roleEl && !roleEl.disabled ? { role: roleEl.value } : {}),
    ...(activeEl && !activeEl.disabled ? { isActive: activeEl.value === 'true' } : {}),
    ...(pwd && pwd.trim().length >= 8 ? { password: pwd.trim() } : {}),
  };

  try {
    const res = await apiFetch('/api/admin/users/' + userId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update user');

    closeModal();
    showToast('User account updated successfully', 'success');
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// =============================================================================
// EMPLOYEE-SPECIFIC CUSTOM PERMISSIONS MODAL
// =============================================================================

async function openUserCustomPermissionsModal(userId) {
  const u = (state.adminUsers || []).find((x) => x.id === userId);
  if (!u) {
    showToast('User not found', 'warning');
    return;
  }

  showToast('Loading employee permissions...', 'info');

  try {
    const res = await apiFetch('/api/admin/users/' + userId + '/permissions');
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to fetch user permissions');

    const baseRole = json.baseRole;
    const isCustom = Boolean(json.hasCustomOverrides);
    const effectiveCrud = json.effectivePermissions || {};

    const categories = ['Operations', 'Finance & HR', 'Administration'];
    let matrixRows = '';

    categories.forEach((cat) => {
      const catModules = (state.adminModules || []).filter((m) => (MODULE_CONFIG[m]?.category || 'Operations') === cat);
      if (catModules.length === 0) return;

      matrixRows += `
        <tr style="background: #f8fafc;">
          <td colspan="5" style="padding: 0.4rem 0.75rem; font-weight: 700; font-size: 0.75rem; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
            ${cat}
          </td>
        </tr>
      `;

      catModules.forEach((mod) => {
        const info = MODULE_CONFIG[mod] || { name: mod, route: '/' + mod, description: '' };
        const p = effectiveCrud[mod] || { create: false, read: false, update: false, delete: false };

        matrixRows += `
          <tr>
            <td style="padding: 0.5rem 0.75rem;">
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span style="font-weight: 700; color: #1e293b; font-size: 0.85rem;">${info.name}</span>
                <span class="badge badge-neutral" style="font-family: monospace; font-size: 0.7rem; padding: 0.1rem 0.35rem;">${info.route}</span>
              </div>
              <div style="font-size: 0.72rem; color: #64748b; line-height: 1.3; margin-top: 0.15rem;">${info.description}</div>
            </td>
            <td style="text-align: center; vertical-align: middle; width: 60px;">
              <input type="checkbox" id="userperm-${mod}-c" ${p.create ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--primary);" />
            </td>
            <td style="text-align: center; vertical-align: middle; width: 60px;">
              <input type="checkbox" id="userperm-${mod}-r" ${p.read ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--primary);" />
            </td>
            <td style="text-align: center; vertical-align: middle; width: 60px;">
              <input type="checkbox" id="userperm-${mod}-u" ${p.update ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--primary);" />
            </td>
            <td style="text-align: center; vertical-align: middle; width: 60px;">
              <input type="checkbox" id="userperm-${mod}-d" ${p.delete ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--primary);" />
            </td>
          </tr>
        `;
      });
    });

    const body = `
      <form id="form-user-custom-perms" onsubmit="submitUserCustomPermissions(event, '${userId}')">
        <!-- User Info Header -->
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.95rem; font-weight: 700; color: #1e293b;">${u.name}</div>
            <div style="font-size: 0.78rem; color: #64748b;">${u.email}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 600;">Base Role</div>
            <span class="badge ${getRoleBadgeClass(baseRole)}">${baseRole}</span>
          </div>
        </div>

        <!-- Mode Selection Options -->
        <div style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0.4rem;">Permission Configuration Mode</label>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem;">
            <label style="display: flex; align-items: flex-start; gap: 0.6rem; cursor: pointer;">
              <input type="radio" name="user-perm-mode" value="ROLE" ${!isCustom ? 'checked' : ''} onchange="toggleUserPermMode('ROLE')" style="margin-top: 3px; accent-color: var(--primary);" />
              <div>
                <div style="font-weight: 600; font-size: 0.85rem; color: #1e293b;">Inherit Base Role Permissions (${baseRole})</div>
                <div style="font-size: 0.75rem; color: #64748b;">Automatically follows whatever permissions are configured for the ${baseRole} group.</div>
              </div>
            </label>
            <label style="display: flex; align-items: flex-start; gap: 0.6rem; cursor: pointer;">
              <input type="radio" name="user-perm-mode" value="CUSTOM" ${isCustom ? 'checked' : ''} onchange="toggleUserPermMode('CUSTOM')" style="margin-top: 3px; accent-color: var(--primary);" />
              <div>
                <div style="font-weight: 600; font-size: 0.85rem; color: #1e293b;">Customized Specific Permissions (Employee Override)</div>
                <div style="font-size: 0.75rem; color: #64748b;">Set fine-grained Create, Read, Update, Delete access specifically for this employee without creating or changing a role group.</div>
              </div>
            </label>
          </div>
        </div>

        <!-- Custom CRUD Matrix Wrapper -->
        <div id="user-custom-perm-matrix-wrapper" style="display: ${isCustom ? 'block' : 'none'};">
          <div style="font-weight: 700; font-size: 0.88rem; color: #1e293b; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            <span>Module Access & CRUD Overrides</span>
            <div style="display: flex; gap: 0.35rem;">
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="bulkSetUserPerms('all')">Select All</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="bulkSetUserPerms('readonly')">Read Only</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="copyRolePermsToUser('${baseRole}')">Reset to Role (${baseRole})</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="bulkSetUserPerms('none')">Clear All</button>
            </div>
          </div>
          <div class="table-responsive" style="max-height: 340px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <table class="data-table" style="font-size: 0.8rem;">
              <thead>
                <tr>
                  <th>Module</th>
                  <th style="text-align: center; width: 60px;">C</th>
                  <th style="text-align: center; width: 60px;">R</th>
                  <th style="text-align: center; width: 60px;">U</th>
                  <th style="text-align: center; width: 60px;">D</th>
                </tr>
              </thead>
              <tbody>
                ${matrixRows}
              </tbody>
            </table>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end; width: 100%;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" form="form-user-custom-perms" class="btn btn-primary">Save Employee Permissions</button>
      </div>
    `;

    openModal('Custom Permissions — ' + u.name, body, footer, 'lg');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function toggleUserPermMode(mode) {
  const wrapper = document.getElementById('user-custom-perm-matrix-wrapper');
  if (wrapper) {
    wrapper.style.display = mode === 'CUSTOM' ? 'block' : 'none';
  }
}

function bulkSetUserPerms(action) {
  (state.adminModules || []).forEach((mod) => {
    const c = document.getElementById('userperm-' + mod + '-c');
    const r = document.getElementById('userperm-' + mod + '-r');
    const u = document.getElementById('userperm-' + mod + '-u');
    const d = document.getElementById('userperm-' + mod + '-d');

    if (action === 'all') {
      if (c) c.checked = true;
      if (r) r.checked = true;
      if (u) u.checked = true;
      if (d) d.checked = true;
    } else if (action === 'readonly') {
      if (c) c.checked = false;
      if (r) r.checked = true;
      if (u) u.checked = false;
      if (d) d.checked = false;
    } else if (action === 'none') {
      if (c) c.checked = false;
      if (r) r.checked = false;
      if (u) u.checked = false;
      if (d) d.checked = false;
    }
  });
}

function copyRolePermsToUser(baseRole) {
  const roleCrud = (state.adminCrudMatrix || {})[baseRole] || {};
  (state.adminModules || []).forEach((mod) => {
    const p = roleCrud[mod] || { create: false, read: false, update: false, delete: false };
    const c = document.getElementById('userperm-' + mod + '-c');
    const r = document.getElementById('userperm-' + mod + '-r');
    const u = document.getElementById('userperm-' + mod + '-u');
    const d = document.getElementById('userperm-' + mod + '-d');

    if (c) c.checked = Boolean(p.create);
    if (r) r.checked = Boolean(p.read);
    if (u) u.checked = Boolean(p.update);
    if (d) d.checked = Boolean(p.delete);
  });
}

async function submitUserCustomPermissions(e, userId) {
  e.preventDefault();
  const modeEl = document.querySelector('input[name="user-perm-mode"]:checked');
  const mode = modeEl ? modeEl.value : 'ROLE';

  const permissions = {};
  if (mode === 'CUSTOM') {
    (state.adminModules || []).forEach((mod) => {
      permissions[mod] = {
        create: Boolean(document.getElementById('userperm-' + mod + '-c')?.checked),
        read: Boolean(document.getElementById('userperm-' + mod + '-r')?.checked),
        update: Boolean(document.getElementById('userperm-' + mod + '-u')?.checked),
        delete: Boolean(document.getElementById('userperm-' + mod + '-d')?.checked),
      };
    });
  }

  try {
    const res = await apiFetch('/api/admin/users/' + userId + '/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, permissions }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update employee permissions');

    closeModal();
    showToast(json.message || 'Permissions updated successfully', 'success');
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}


// System Settings State & Controller
let currentSystemSettings = {};
let currentSettingsTags = [];
let currentPaymentMethods = [];

function switchSettingsSubTab(subTabName) {
  document.querySelectorAll('#view-settings .sub-nav-item, #view-settings .settings-tab-btn').forEach((item) => {
    item.classList.toggle('active', item.dataset.subtab === subTabName);
  });
  document.querySelectorAll('.settings-subview').forEach((el) => {
    el.style.display = 'none';
  });
  const activeSubView = document.getElementById('subview-' + subTabName);
  if (activeSubView) activeSubView.style.display = 'block';
}

async function loadSettings() {
  try {
    const [settingsRes, coaRes] = await Promise.all([
      apiFetch('/api/settings'),
      apiFetch('/api/accounting/accounts')
    ]);

    const settingsData = await settingsRes.json();
    const coaData = await coaRes.json();

    if (!settingsData.success) {
      showToast(settingsData.error || 'Failed to load settings', 'danger');
      return;
    }

    currentSystemSettings = settingsData.settings || {};
    window.cachedVoucherSettings = currentSystemSettings.vouchers || {};
    populateCoaDropdowns(coaData.data || []);
    populateSettingsForm(currentSystemSettings);
  } catch (err) {
    console.error('Error loading settings:', err);
    showToast('Failed to load system settings', 'danger');
  }
}

function populateCoaDropdowns(accounts) {
  const selects = ['set-coa-cash', 'set-coa-ap', 'set-coa-ar', 'set-coa-inv'];
  selects.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = accounts
      .map((a) => '<option value="' + a.code + '">' + a.code + ' - ' + a.name + ' (' + a.type + ')</option>')
      .join('');
  });
}

function populateSettingsForm(settings) {
  const v = settings.vouchers || {};
  const org = settings.organization || {};
  const ops = settings.operations || {};
  const pay = settings.payroll || {};

  // 1. Signatories
  const sign = v['vouchers.signatories'] || {};
  if (document.getElementById('set-sign-prepared')) document.getElementById('set-sign-prepared').value = sign.preparedBy || 'Administrator';
  if (document.getElementById('set-sign-certified')) document.getElementById('set-sign-certified').value = sign.certifiedBy || 'Joy/Admin';
  if (document.getElementById('set-sign-approved')) document.getElementById('set-sign-approved').value = sign.approvedBy || 'Kenneth Brown/CEO';
  if (document.getElementById('set-sign-received')) document.getElementById('set-sign-received').value = sign.receivedBy || 'Signature over printed name/Date';

  // 2. Permissions
  const perm = v['vouchers.permissions'] || {};
  if (document.getElementById('set-perm-staff-void')) document.getElementById('set-perm-staff-void').checked = !!perm.allowStaffVoid;
  if (document.getElementById('set-perm-mgr-void')) document.getElementById('set-perm-mgr-void').checked = !!perm.allowManagerVoid;
  if (document.getElementById('set-perm-staff-delete')) document.getElementById('set-perm-staff-delete').checked = !!perm.allowStaffDelete;
  if (document.getElementById('set-perm-mgr-delete')) document.getElementById('set-perm-mgr-delete').checked = !!perm.allowManagerDelete;

  // 3. Numbering
  const types = v['vouchers.types'] || [];
  const pvType = types.find((t) => t.id === 'PAYMENT') || {};
  const rvType = types.find((t) => t.id === 'RECEIPT') || {};
  const jvType = types.find((t) => t.id === 'JOURNAL') || {};
  const cvType = types.find((t) => t.id === 'CONTRA') || {};
  if (document.getElementById('set-pfx-pv')) document.getElementById('set-pfx-pv').value = pvType.prefix || '26-';
  if (document.getElementById('set-pfx-rv')) document.getElementById('set-pfx-rv').value = rvType.prefix || 'RV-';
  if (document.getElementById('set-pfx-jv')) document.getElementById('set-pfx-jv').value = jvType.prefix || 'JV-';
  if (document.getElementById('set-pfx-cv')) document.getElementById('set-pfx-cv').value = cvType.prefix || 'CV-';

  // 4. Default COA
  const coa = v['vouchers.default_accounts'] || {};
  if (coa.cashAccountCode && document.getElementById('set-coa-cash')) document.getElementById('set-coa-cash').value = coa.cashAccountCode;
  if (coa.accountsPayableCode && document.getElementById('set-coa-ap')) document.getElementById('set-coa-ap').value = coa.accountsPayableCode;
  if (coa.accountsReceivableCode && document.getElementById('set-coa-ar')) document.getElementById('set-coa-ar').value = coa.accountsReceivableCode;
  if (coa.inventoryAssetCode && document.getElementById('set-coa-inv')) document.getElementById('set-coa-inv').value = coa.inventoryAssetCode;

  // 5. Tags
  currentSettingsTags = (v['vouchers.tags'] && Array.isArray(v['vouchers.tags'])) ? [...v['vouchers.tags']] : [];
  renderSettingsTags();

  // 6. Payment Methods
  currentPaymentMethods = (v['vouchers.payment_methods'] && Array.isArray(v['vouchers.payment_methods'])) ? [...v['vouchers.payment_methods']] : [];
  renderSettingsPaymentMethods();

  // 7. Organization
  const orgProf = org['organization.profile'] || {};
  if (document.getElementById('set-org-name')) document.getElementById('set-org-name').value = orgProf.companyName || 'APEXS, INC.';
  if (document.getElementById('set-org-tagline')) document.getElementById('set-org-tagline').value = orgProf.tagline || '';
  if (document.getElementById('set-org-motto')) document.getElementById('set-org-motto').value = orgProf.motto || '';
  if (document.getElementById('set-org-address')) document.getElementById('set-org-address').value = orgProf.address || '';
  if (document.getElementById('set-org-telefax')) document.getElementById('set-org-telefax').value = orgProf.telefax || '';
  if (document.getElementById('set-org-taxid')) document.getElementById('set-org-taxid').value = orgProf.taxId || '';
  if (document.getElementById('set-org-currency')) document.getElementById('set-org-currency').value = orgProf.defaultCurrency || 'PHP';

  // 8. Operations
  const opsConf = ops['operations.config'] || {};
  if (document.getElementById('set-ops-lowstock')) document.getElementById('set-ops-lowstock').value = opsConf.lowStockThreshold || 10;
  if (document.getElementById('set-ops-default-uom')) document.getElementById('set-ops-default-uom').value = opsConf.defaultUom || 'pcs';
  if (document.getElementById('set-ops-payment-terms')) document.getElementById('set-ops-payment-terms').value = opsConf.defaultPaymentTermsDays || 30;
  if (document.getElementById('set-ops-pfx-po')) document.getElementById('set-ops-pfx-po').value = opsConf.poPrefix || 'PO-';
  if (document.getElementById('set-ops-pfx-so')) document.getElementById('set-ops-pfx-so').value = opsConf.soPrefix || 'SO-';
  if (document.getElementById('set-ops-pfx-inv')) document.getElementById('set-ops-pfx-inv').value = opsConf.invPrefix || 'INV-';
  if (document.getElementById('set-ops-pfx-grn')) document.getElementById('set-ops-pfx-grn').value = opsConf.grnPrefix || 'GRN-';

  // 9. Payroll
  const payConf = pay['payroll.config'] || {};
  if (document.getElementById('set-pay-workdays')) document.getElementById('set-pay-workdays').value = payConf.standardWorkDaysPerMonth || 22;
  if (document.getElementById('set-pay-pfx-pr')) document.getElementById('set-pay-pfx-pr').value = payConf.payrollRunPrefix || 'PR-';
  if (document.getElementById('set-pay-disburse-method')) document.getElementById('set-pay-disburse-method').value = payConf.defaultDisbursementMethod || 'BANK_TRANSFER';
}

function renderSettingsTags() {
  const container = document.getElementById('settings-tags-container');
  if (!container) return;
  if (!currentSettingsTags || currentSettingsTags.length === 0) {
    container.innerHTML = '<span style="font-size: 0.82rem; color: var(--text-muted);">No custom tags defined.</span>';
    return;
  }
  container.innerHTML = currentSettingsTags
    .map(
      (tag, idx) =>
        '<div class="tag-badge-item">' +
        '<span>' + tag + '</span>' +
        '<button type="button" onclick="removeSettingsTag(' + idx + ')" aria-label="Remove tag">×</button>' +
        '</div>'
    )
    .join('');
}

function addSettingsTag() {
  const input = document.getElementById('new-tag-input');
  if (!input) return;
  const tag = (input.value || '').trim();
  if (!tag) return;
  if (currentSettingsTags.includes(tag)) {
    showToast('Tag already exists', 'warning');
    return;
  }
  currentSettingsTags.push(tag);
  input.value = '';
  renderSettingsTags();
}

function removeSettingsTag(idx) {
  currentSettingsTags.splice(idx, 1);
  renderSettingsTags();
}

const PRESET_PAYMENT_METHODS = {
  GCASH: { id: 'GCASH', name: 'GCash E-Wallet', category: 'E-Wallet', isActive: true },
  MAYA: { id: 'MAYA', name: 'Maya (PayMaya)', category: 'E-Wallet', isActive: true },
  PAYPAL: { id: 'PAYPAL', name: 'PayPal Business', category: 'E-Wallet', isActive: true },
  WIRE: { id: 'WIRE_TRANSFER', name: 'Telegraphic Wire / Swift', category: 'Bank / Wire', isActive: true },
  DEBIT_CARD: { id: 'DEBIT_CARD', name: 'Corporate Debit Card', category: 'Card', isActive: true },
  CRYPTO: { id: 'CRYPTO_USDT', name: 'Cryptocurrency (USDT / BTC)', category: 'Crypto', isActive: true },
  WESTERN_UNION: { id: 'WESTERN_UNION', name: 'Western Union / Remittance', category: 'Remittance', isActive: true },
  PETTY_CASH: { id: 'BRANCH_CASH', name: 'Branch Revolving Cash', category: 'Physical Cash', isActive: true },
};

function guessPaymentMethodCategory(id) {
  const upper = (id || '').toUpperCase();
  if (upper.includes('CASH')) return 'Physical Cash';
  if (upper.includes('CHECK') || upper.includes('CHEQUE')) return 'Check';
  if (upper.includes('CARD')) return 'Card';
  if (upper.includes('BANK') || upper.includes('WIRE') || upper.includes('ACH') || upper.includes('TRANSFER')) return 'Bank / Wire';
  if (upper.includes('WALLET') || upper.includes('GCASH') || upper.includes('MAYA') || upper.includes('PAYPAL') || upper.includes('ONLINE')) return 'E-Wallet';
  if (upper.includes('CRYPTO') || upper.includes('USDT') || upper.includes('BTC')) return 'Crypto';
  if (upper.includes('WESTERN') || upper.includes('REMIT')) return 'Remittance';
  return 'General';
}

function renderSettingsPaymentMethods() {
  const table = document.getElementById('settings-payment-methods-table');
  if (!table) return;
  if (!currentPaymentMethods || currentPaymentMethods.length === 0) {
    table.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b; font-size: 0.85rem;">No payment methods configured. Click "+ Add Method" or a quick preset above.</div>';
    return;
  }
  table.innerHTML =
    '<table class="table" style="margin-bottom: 0;">' +
    '<thead><tr style="background: #f8fafc;">' +
    '<th style="width: 22%; font-size: 0.78rem; text-transform: uppercase;">Method Code</th>' +
    '<th style="width: 32%; font-size: 0.78rem; text-transform: uppercase;">Display Name</th>' +
    '<th style="width: 18%; font-size: 0.78rem; text-transform: uppercase;">Channel / Type</th>' +
    '<th style="width: 12%; font-size: 0.78rem; text-transform: uppercase;">Status</th>' +
    '<th style="width: 16%; text-align: right; font-size: 0.78rem; text-transform: uppercase;">Actions</th>' +
    '</tr></thead>' +
    '<tbody>' +
    currentPaymentMethods
      .map(
        (pm, idx) =>
          '<tr>' +
          '<td><code style="font-family: monospace; font-size: 0.82rem; font-weight: 700; color: #0f172a; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 0.18rem 0.45rem; border-radius: 4px;">' + pm.id + '</code></td>' +
          '<td><strong style="color: #1e293b; font-size: 0.86rem;">' + pm.name + '</strong>' + (pm.description ? '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">' + pm.description + '</div>' : '') + '</td>' +
          '<td><span class="badge badge-neutral" style="font-size: 0.72rem;">' + (pm.category || guessPaymentMethodCategory(pm.id)) + '</span></td>' +
          '<td>' + (pm.isActive !== false ? '<span class="badge badge-success" style="font-size: 0.72rem;"><span class="badge-dot"></span>Active</span>' : '<span class="badge badge-neutral" style="font-size: 0.72rem;">Disabled</span>') + '</td>' +
          '<td style="text-align: right; white-space: nowrap;">' +
          '<div style="display: inline-flex; gap: 0.35rem;">' +
          '<button type="button" class="btn btn-sm btn-secondary" onclick="openEditPaymentMethodModal(' + idx + ')" style="padding: 0.25rem 0.5rem; font-size: 0.76rem;" title="Edit details">✏️ Edit</button>' +
          '<button type="button" class="btn btn-sm ' + (pm.isActive !== false ? 'btn-secondary' : 'btn-primary') + '" onclick="togglePaymentMethodActive(' + idx + ')" style="padding: 0.25rem 0.5rem; font-size: 0.76rem;">' + (pm.isActive !== false ? 'Disable' : 'Enable') + '</button>' +
          '<button type="button" class="btn btn-sm btn-danger" onclick="deletePaymentMethod(' + idx + ')" style="padding: 0.25rem 0.45rem; font-size: 0.76rem;" title="Delete Method">🗑️</button>' +
          '</div>' +
          '</td>' +
          '</tr>'
      )
      .join('') +
    '</tbody></table>';

  const curDisburse = document.getElementById('set-pay-disburse-method') ? document.getElementById('set-pay-disburse-method').value : 'BANK_TRANSFER';
  populatePayrollDisburseDropdown(curDisburse);
}

function populatePayrollDisburseDropdown(selectedVal) {
  const el = document.getElementById('set-pay-disburse-method');
  if (!el) return;
  const activeMethods = (currentPaymentMethods || []).filter((m) => m.isActive !== false);
  const list = activeMethods.length > 0 ? activeMethods : [
    { id: 'BANK_TRANSFER', name: 'Bank Transfer / Direct Deposit' },
    { id: 'CHECK', name: 'Corporate Check' },
    { id: 'CASH', name: 'Petty Cash' },
  ];
  el.innerHTML = list
    .map((m) => '<option value="' + m.id + '"' + (m.id === selectedVal ? ' selected' : '') + '>' + m.name + '</option>')
    .join('');
}

function addPresetPaymentMethod(presetKey) {
  const preset = PRESET_PAYMENT_METHODS[presetKey];
  if (!preset) return;
  const exists = currentPaymentMethods.some((pm) => pm.id === preset.id);
  if (exists) {
    showToast('Payment method "' + preset.name + '" (' + preset.id + ') is already in your list.', 'warning');
    return;
  }
  currentPaymentMethods.push({ ...preset });
  renderSettingsPaymentMethods();
  showToast('Added ' + preset.name + ' to payment methods. Remember to click "Save Changes"!', 'success');
}

function addSettingsPaymentMethodInline() {
  const idInput = document.getElementById('new-pm-id');
  const nameInput = document.getElementById('new-pm-name');
  const catInput = document.getElementById('new-pm-cat');
  if (!idInput || !nameInput) return;

  const code = (idInput.value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const name = (nameInput.value || '').trim();
  const category = (catInput ? catInput.value : 'Other') || 'Other';

  if (!code) {
    showToast('Please specify a Method Code / Identifier (e.g. GCASH)', 'warning');
    idInput.focus();
    return;
  }
  if (!name) {
    showToast('Please specify a Display Name (e.g. GCash E-Wallet)', 'warning');
    nameInput.focus();
    return;
  }

  const exists = currentPaymentMethods.some((pm) => pm.id === code);
  if (exists) {
    showToast('Method Code "' + code + '" already exists. Please choose a distinct code.', 'warning');
    idInput.focus();
    return;
  }

  currentPaymentMethods.push({
    id: code,
    name: name,
    category: category,
    isActive: true,
  });

  idInput.value = '';
  nameInput.value = '';
  renderSettingsPaymentMethods();
  showToast('Added ' + name + ' (' + code + ')! Click "Save Changes" to apply across ERP.', 'success');
}

function openAddPaymentMethodModal() {
  const body =
    '<div style="display: flex; flex-direction: column; gap: 1.15rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="modal-pm-id" style="font-weight: 600;">Method Code / Identifier *</label>' +
    '<input type="text" id="modal-pm-id" class="form-input" placeholder="e.g. GCASH, STRIPE, WIRE" style="text-transform: uppercase; font-family: monospace; font-weight: 600;" oninput="this.value = this.value.toUpperCase()" />' +
    '<p style="font-size: 0.74rem; color: #64748b; margin-top: 4px; margin-bottom: 0;">Uppercase alphanumeric code stored in voucher databases.</p>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="modal-pm-name" style="font-weight: 600;">Display Name *</label>' +
    '<input type="text" id="modal-pm-name" class="form-input" placeholder="e.g. GCash Mobile Wallet / Wire Transfer" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="modal-pm-cat" style="font-weight: 600;">Category / Channel</label>' +
    '<select id="modal-pm-cat" class="form-select">' +
    '<option value="E-Wallet">E-Wallet / Online Wallet</option>' +
    '<option value="Bank / Wire">Bank Transfer / Wire / ACH</option>' +
    '<option value="Physical Cash">Physical Cash / Cash Fund</option>' +
    '<option value="Check">Check / Bank Draft</option>' +
    '<option value="Card">Credit / Debit Card</option>' +
    '<option value="Crypto">Cryptocurrency</option>' +
    '<option value="Remittance">Remittance / Agent Transfer</option>' +
    '<option value="Other">Other Custom Channel</option>' +
    '</select>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="modal-pm-desc" style="font-weight: 600;">Description / Memo Note (Optional)</label>' +
    '<input type="text" id="modal-pm-desc" class="form-input" placeholder="e.g. For instant online settlements and peer-to-peer payout" />' +
    '</div>' +
    '<label class="toggle-option" style="margin-top: 0.25rem;">' +
    '<span>Enable this method immediately for voucher selections</span>' +
    '<input type="checkbox" id="modal-pm-active" checked style="width: 18px; height: 18px; cursor: pointer;" />' +
    '</label>' +
    '</div>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="submitModalAddPaymentMethod()">Add Payment Method</button>';

  openModal('Add Payment & Disbursement Method', body, footer, 'md');
}

function submitModalAddPaymentMethod() {
  const idInput = document.getElementById('modal-pm-id');
  const nameInput = document.getElementById('modal-pm-name');
  const catInput = document.getElementById('modal-pm-cat');
  const descInput = document.getElementById('modal-pm-desc');
  const activeInput = document.getElementById('modal-pm-active');

  const code = (idInput ? idInput.value : '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const name = (nameInput ? nameInput.value : '').trim();
  const category = (catInput ? catInput.value : 'Other') || 'Other';
  const description = (descInput ? descInput.value : '').trim();
  const isActive = activeInput ? activeInput.checked : true;

  if (!code) {
    showToast('Please enter a Method Code', 'warning');
    return;
  }
  if (!name) {
    showToast('Please enter a Display Name', 'warning');
    return;
  }

  const exists = currentPaymentMethods.some((pm) => pm.id === code);
  if (exists) {
    showToast('Method Code "' + code + '" already exists.', 'warning');
    return;
  }

  currentPaymentMethods.push({
    id: code,
    name: name,
    category: category,
    description: description || undefined,
    isActive: isActive,
  });

  closeModal();
  renderSettingsPaymentMethods();
  showToast('Added ' + name + ' (' + code + ') to payment methods.', 'success');
}

function openEditPaymentMethodModal(idx) {
  const pm = currentPaymentMethods[idx];
  if (!pm) return;

  const isSystemDefault = ['BANK_TRANSFER', 'CHECK', 'CASH', 'CREDIT_CARD'].includes(pm.id);

  const body =
    '<div style="display: flex; flex-direction: column; gap: 1.15rem;">' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="edit-pm-id" style="font-weight: 600;">Method Code / Identifier</label>' +
    '<input type="text" id="edit-pm-id" class="form-input" value="' + pm.id + '" ' + (isSystemDefault ? 'disabled style="background: #f1f5f9; cursor: not-allowed; font-family: monospace;"' : 'style="text-transform: uppercase; font-family: monospace;"') + ' />' +
    (isSystemDefault ? '<p style="font-size: 0.74rem; color: #64748b; margin-top: 4px; margin-bottom: 0;">Built-in standard method code is locked to preserve ledger history.</p>' : '') +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="edit-pm-name" style="font-weight: 600;">Display Name *</label>' +
    '<input type="text" id="edit-pm-name" class="form-input" value="' + (pm.name || '') + '" required />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="edit-pm-cat" style="font-weight: 600;">Category / Channel</label>' +
    '<select id="edit-pm-cat" class="form-select">' +
    '<option value="E-Wallet"' + (pm.category === 'E-Wallet' ? ' selected' : '') + '>E-Wallet / Online Wallet</option>' +
    '<option value="Bank / Wire"' + (pm.category === 'Bank / Wire' ? ' selected' : '') + '>Bank Transfer / Wire / ACH</option>' +
    '<option value="Physical Cash"' + (pm.category === 'Physical Cash' ? ' selected' : '') + '>Physical Cash / Cash Fund</option>' +
    '<option value="Check"' + (pm.category === 'Check' ? ' selected' : '') + '>Check / Bank Draft</option>' +
    '<option value="Card"' + (pm.category === 'Card' ? ' selected' : '') + '>Credit / Debit Card</option>' +
    '<option value="Crypto"' + (pm.category === 'Crypto' ? ' selected' : '') + '>Cryptocurrency</option>' +
    '<option value="Remittance"' + (pm.category === 'Remittance' ? ' selected' : '') + '>Remittance / Agent Transfer</option>' +
    '<option value="Other"' + (pm.category === 'Other' ? ' selected' : '') + '>Other Custom Channel</option>' +
    '</select>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom: 0;">' +
    '<label class="form-label" for="edit-pm-desc" style="font-weight: 600;">Description / Memo Note</label>' +
    '<input type="text" id="edit-pm-desc" class="form-input" value="' + (pm.description || '') + '" placeholder="e.g. Direct electronic deposit" />' +
    '</div>' +
    '<label class="toggle-option" style="margin-top: 0.25rem;">' +
    '<span>Method is Active & Available across ERP forms</span>' +
    '<input type="checkbox" id="edit-pm-active" ' + (pm.isActive !== false ? 'checked' : '') + ' style="width: 18px; height: 18px; cursor: pointer;" />' +
    '</label>' +
    '</div>';

  const footer =
    '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button type="button" class="btn btn-primary" onclick="submitModalEditPaymentMethod(' + idx + ')">Save Changes</button>';

  openModal('Edit Payment Method — ' + pm.name, body, footer, 'md');
}

function submitModalEditPaymentMethod(idx) {
  const pm = currentPaymentMethods[idx];
  if (!pm) return;

  const idInput = document.getElementById('edit-pm-id');
  const nameInput = document.getElementById('edit-pm-name');
  const catInput = document.getElementById('edit-pm-cat');
  const descInput = document.getElementById('edit-pm-desc');
  const activeInput = document.getElementById('edit-pm-active');

  const newCode = (idInput ? idInput.value : '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const newName = (nameInput ? nameInput.value : '').trim();
  const newCat = catInput ? catInput.value : 'Other';
  const newDesc = (descInput ? descInput.value : '').trim();
  const isActive = activeInput ? activeInput.checked : true;

  if (!newName) {
    showToast('Display Name cannot be empty', 'warning');
    return;
  }

  if (newCode && newCode !== pm.id) {
    const conflict = currentPaymentMethods.some((m, i) => i !== idx && m.id === newCode);
    if (conflict) {
      showToast('Method Code "' + newCode + '" is already used by another payment method.', 'warning');
      return;
    }
    pm.id = newCode;
  }

  pm.name = newName;
  pm.category = newCat;
  pm.description = newDesc || undefined;
  pm.isActive = isActive;

  closeModal();
  renderSettingsPaymentMethods();
  showToast('Updated payment method "' + newName + '". Remember to click "Save Changes"!', 'success');
}

function deletePaymentMethod(idx) {
  const pm = currentPaymentMethods[idx];
  if (!pm) return;
  if (!confirm('Are you sure you want to remove "' + pm.name + '" (' + pm.id + ')? Existing posted vouchers with this method will still retain their historical records.')) {
    return;
  }
  currentPaymentMethods.splice(idx, 1);
  renderSettingsPaymentMethods();
  showToast('Removed ' + pm.name + ' from payment methods.', 'success');
}

function togglePaymentMethodActive(idx) {
  if (currentPaymentMethods[idx]) {
    currentPaymentMethods[idx].isActive = !currentPaymentMethods[idx].isActive;
    renderSettingsPaymentMethods();
  }
}

async function saveAllCurrentSettings() {
  try {
    const signatories = {
      preparedBy: (document.getElementById('set-sign-prepared') ? document.getElementById('set-sign-prepared').value : '').trim(),
      certifiedBy: (document.getElementById('set-sign-certified') ? document.getElementById('set-sign-certified').value : '').trim(),
      approvedBy: (document.getElementById('set-sign-approved') ? document.getElementById('set-sign-approved').value : '').trim(),
      receivedBy: (document.getElementById('set-sign-received') ? document.getElementById('set-sign-received').value : '').trim(),
    };

    const permissions = {
      allowStaffVoid: document.getElementById('set-perm-staff-void') ? document.getElementById('set-perm-staff-void').checked : false,
      allowManagerVoid: document.getElementById('set-perm-mgr-void') ? document.getElementById('set-perm-mgr-void').checked : false,
      allowStaffDelete: document.getElementById('set-perm-staff-delete') ? document.getElementById('set-perm-staff-delete').checked : false,
      allowManagerDelete: document.getElementById('set-perm-mgr-delete') ? document.getElementById('set-perm-mgr-delete').checked : false,
      allowAdminDelete: true,
      allowAdminVoid: true,
    };

    const types = [
      { id: 'PAYMENT', name: 'Payment Voucher (PV)', prefix: (document.getElementById('set-pfx-pv') ? document.getElementById('set-pfx-pv').value.trim() : '') || '26-' },
      { id: 'RECEIPT', name: 'Receipt Voucher (RV)', prefix: (document.getElementById('set-pfx-rv') ? document.getElementById('set-pfx-rv').value.trim() : '') || 'RV-' },
      { id: 'JOURNAL', name: 'Journal Voucher (JV)', prefix: (document.getElementById('set-pfx-jv') ? document.getElementById('set-pfx-jv').value.trim() : '') || 'JV-' },
      { id: 'CONTRA', name: 'Contra Voucher (CV)', prefix: (document.getElementById('set-pfx-cv') ? document.getElementById('set-pfx-cv').value.trim() : '') || 'CV-' },
    ];

    const defaultAccounts = {
      cashAccountCode: document.getElementById('set-coa-cash') ? document.getElementById('set-coa-cash').value : '1010',
      accountsPayableCode: document.getElementById('set-coa-ap') ? document.getElementById('set-coa-ap').value : '2010',
      accountsReceivableCode: document.getElementById('set-coa-ar') ? document.getElementById('set-coa-ar').value : '1100',
      inventoryAssetCode: document.getElementById('set-coa-inv') ? document.getElementById('set-coa-inv').value : '1200',
    };

    const organization = {
      companyName: (document.getElementById('set-org-name') ? document.getElementById('set-org-name').value.trim() : '') || 'APEXS, INC.',
      tagline: document.getElementById('set-org-tagline') ? document.getElementById('set-org-tagline').value.trim() : '',
      motto: document.getElementById('set-org-motto') ? document.getElementById('set-org-motto').value.trim() : '',
      address: document.getElementById('set-org-address') ? document.getElementById('set-org-address').value.trim() : '',
      telefax: document.getElementById('set-org-telefax') ? document.getElementById('set-org-telefax').value.trim() : '',
      taxId: document.getElementById('set-org-taxid') ? document.getElementById('set-org-taxid').value.trim() : '',
      defaultCurrency: document.getElementById('set-org-currency') ? document.getElementById('set-org-currency').value : 'PHP',
    };

    const operations = {
      lowStockThreshold: parseInt(document.getElementById('set-ops-lowstock') ? document.getElementById('set-ops-lowstock').value : '10', 10) || 10,
      defaultUom: (document.getElementById('set-ops-default-uom') ? document.getElementById('set-ops-default-uom').value.trim() : '') || 'pcs',
      defaultPaymentTermsDays: parseInt(document.getElementById('set-ops-payment-terms') ? document.getElementById('set-ops-payment-terms').value : '30', 10) || 30,
      poPrefix: (document.getElementById('set-ops-pfx-po') ? document.getElementById('set-ops-pfx-po').value.trim() : '') || 'PO-',
      soPrefix: (document.getElementById('set-ops-pfx-so') ? document.getElementById('set-ops-pfx-so').value.trim() : '') || 'SO-',
      invPrefix: (document.getElementById('set-ops-pfx-inv') ? document.getElementById('set-ops-pfx-inv').value.trim() : '') || 'INV-',
      grnPrefix: (document.getElementById('set-ops-pfx-grn') ? document.getElementById('set-ops-pfx-grn').value.trim() : '') || 'GRN-',
    };

    const payroll = {
      standardWorkDaysPerMonth: parseInt(document.getElementById('set-pay-workdays') ? document.getElementById('set-pay-workdays').value : '22', 10) || 22,
      payrollRunPrefix: (document.getElementById('set-pay-pfx-pr') ? document.getElementById('set-pay-pfx-pr').value.trim() : '') || 'PR-',
      defaultDisbursementMethod: document.getElementById('set-pay-disburse-method') ? document.getElementById('set-pay-disburse-method').value : 'BANK_TRANSFER',
    };

    const payload = [
      {
        category: 'vouchers',
        settings: {
          'vouchers.signatories': signatories,
          'vouchers.permissions': permissions,
          'vouchers.types': types,
          'vouchers.default_accounts': defaultAccounts,
          'vouchers.tags': currentSettingsTags,
          'vouchers.payment_methods': currentPaymentMethods,
        },
      },
      {
        category: 'organization',
        settings: {
          'organization.profile': organization,
        },
      },
      {
        category: 'operations',
        settings: {
          'operations.config': operations,
        },
      },
      {
        category: 'payroll',
        settings: {
          'payroll.config': payroll,
        },
      },
    ];

    for (const group of payload) {
      const res = await apiFetch('/api/settings/category/' + group.category, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: group.settings }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to save settings for ' + group.category, 'danger');
        return;
      }
    }

    // Refresh cached voucher settings in memory
    window.cachedVoucherSettings = payload[0].settings;

    showToast('System settings saved successfully!', 'success');
  } catch (err) {
    console.error('Error saving settings:', err);
    showToast('Error saving settings: ' + err.message, 'danger');
  }
}


const ROUTE_TAB_MAP = {
  '': 'dashboard',
  '/': 'dashboard',
  '/app': 'dashboard',
  '/dashboard': 'dashboard',
  '/directory': 'directory',
  '/inventory': 'inventory',
  '/purchasing': 'purchasing',
  '/inbound': 'inbound',
  '/sales': 'sales',
  '/outbound': 'outbound',
  '/vouchers': 'vouchers',
  '/accounting': 'accounting',
  '/payroll': 'payroll',
  '/staff': 'staff',
  '/admin': 'admin',
  '/permissions': 'admin',
  '/settings': 'settings',
};

const TAB_ROUTE_MAP = {
  dashboard: '/dashboard',
  directory: '/directory',
  inventory: '/inventory',
  purchasing: '/purchasing',
  inbound: '/inbound',
  sales: '/sales',
  outbound: '/outbound',
  vouchers: '/vouchers',
  accounting: '/accounting',
  payroll: '/payroll',
  staff: '/staff',
  admin: '/permissions',
  settings: '/settings',
};

function getTabFromUrl() {
  const path = window.location.pathname.toLowerCase().replace(/[/]+$/, '');
  if (ROUTE_TAB_MAP[path]) return ROUTE_TAB_MAP[path];
  const segment = path.split('/')[1];
  if (segment && ROUTE_TAB_MAP['/' + segment]) return ROUTE_TAB_MAP['/' + segment];
  return 'dashboard';
}

// Granular CRUD Permission Checker
function can(moduleName, action = 'read') {
  if (!state.user) return false;
  if (state.user.role === 'ADMIN') return true;
  if (state.user.permissions && state.user.permissions[moduleName]) {
    return Boolean(state.user.permissions[moduleName][action]);
  }
  const crud = window.__ROLE_PERMISSIONS_CRUD__ || {};
  const roleMatrix = crud[state.user.role] || {};
  const modPerms = roleMatrix[moduleName];
  if (!modPerms) return false;
  return Boolean(modPerms[action]);
}

// Mobile Sidebar Navigation Handlers
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (backdrop) backdrop.classList.toggle('active');
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
}

// Global Tab Router
function switchTab(tabName, updateHistory = true, keepQueryParams = true) {
  closeMobileSidebar();
  const allowedTabs = typeof applyRolePermissions === 'function' ? applyRolePermissions() : ['dashboard'];
  if (!allowedTabs.includes(tabName)) {
    showToast('You do not have access to that module', 'danger');
    tabName = allowedTabs[0] || 'dashboard';
  }

  const prevTab = state.activeTab;
  state.activeTab = tabName;

  document.querySelectorAll('.nav-item').forEach((item) => {
    if (item.dataset.tab === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const breadcrumb = document.getElementById('active-breadcrumb');
  const tabTitles = {
    dashboard: 'Executive Dashboard',
    directory: 'Business Directory',
    inventory: 'Inventory & Stock Movements',
    purchasing: 'Purchasing (P2P Procurement)',
    inbound: 'Inbound Deliveries',
    sales: 'Sales (O2C Orders & Invoices)',
    outbound: 'Delivery Receipts (DR)',
    vouchers: 'Vouchers',
    accounting: 'Accounting & Financial Reports',
    payroll: 'Payroll & Compensation',
    staff: 'Staff & Human Resources',
    admin: 'Roles & Permissions',
    settings: 'System Settings',
  };
  const currentTitle = tabTitles[tabName] || tabName;
  if (breadcrumb) breadcrumb.innerText = currentTitle;
  document.title = currentTitle + ' — Apexs ERP';

  // Synchronize browser URL bar and history state
  const targetPath = TAB_ROUTE_MAP[tabName] || ('/' + tabName);
  const targetQuery = (keepQueryParams && prevTab === tabName) ? window.location.search : '';
  const fullTarget = targetPath + targetQuery;

  if (updateHistory && (window.location.pathname !== targetPath || (targetQuery && window.location.search !== targetQuery))) {
    window.history.pushState({ tab: tabName }, '', fullTarget);
  }

  document.querySelectorAll('.tab-view').forEach((el) => (el.style.display = 'none'));

  const activeView = document.getElementById('view-' + tabName);
  if (activeView) {
    activeView.style.display = 'block';
  }

  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'directory') loadDirectory();
  if (tabName === 'inventory') loadInventory();
  if (tabName === 'purchasing') loadPurchasing();
  if (tabName === 'inbound') loadInbound();
  if (tabName === 'sales') loadSales();
  if (tabName === 'outbound') loadOutbound();
  if (tabName === 'vouchers') loadVouchers();
  if (tabName === 'accounting') loadAccounting();
  if (tabName === 'payroll') loadPayroll();
  if (tabName === 'staff') loadStaff();
  if (tabName === 'admin') loadAdmin();
  if (tabName === 'settings') loadSettings();
}

// Live Header Clock (Date with Time Seconds)
function updateLiveClock() {
  const dateEl = document.getElementById('live-system-date');
  const timeEl = document.getElementById('live-system-time');
  const clockEl = document.getElementById('live-system-clock');

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  if (dateEl) dateEl.textContent = dateStr;
  if (timeEl) timeEl.textContent = timeStr;
  if (clockEl) clockEl.textContent = dateStr + ' • ' + timeStr;
}

updateLiveClock();
setInterval(updateLiveClock, 1000);

// Browser back/forward navigation support
window.addEventListener('popstate', (e) => {
  if (state.user) {
    const targetTab = (e.state && e.state.tab) || getTabFromUrl();
    switchTab(targetTab, false);
  }
});

// Initial Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateLiveClock();
    checkAuth();
  });
} else {
  updateLiveClock();
  checkAuth();
}
