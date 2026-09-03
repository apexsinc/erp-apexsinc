import { LOGIN_CLIENT_JS } from './views/login.view';
import { DASHBOARD_CLIENT_JS } from './views/dashboard.view';
import { DIRECTORY_CLIENT_JS } from './views/directory.view';
import { INVENTORY_CLIENT_JS } from './views/inventory.view';
import { PURCHASING_CLIENT_JS } from './views/purchasing.view';
import { INBOUND_CLIENT_JS } from './views/inbound.view';
import { SALES_CLIENT_JS } from './views/sales.view';
import { OUTBOUND_CLIENT_JS } from './views/outbound.view';
import { VOUCHERS_CLIENT_JS } from './views/vouchers.view';
import { ACCOUNTING_CLIENT_JS } from './views/accounting.view';
import { PAYROLL_CLIENT_JS } from './views/payroll.view';
import { STAFF_CLIENT_JS } from './views/staff.view';
import { ADMIN_CLIENT_JS } from './views/admin.view';
import { SETTINGS_CLIENT_JS } from './views/settings.view';

export const APP_CLIENT_JS = `
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
function exportToCsv(filename, headers, rows) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return '"' + str + '"';
  };
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\\r\\n');

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
${LOGIN_CLIENT_JS}
${DASHBOARD_CLIENT_JS}
${DIRECTORY_CLIENT_JS}
${INVENTORY_CLIENT_JS}
${PURCHASING_CLIENT_JS}
${INBOUND_CLIENT_JS}
${SALES_CLIENT_JS}
${OUTBOUND_CLIENT_JS}
${VOUCHERS_CLIENT_JS}
${ACCOUNTING_CLIENT_JS}
${PAYROLL_CLIENT_JS}
${STAFF_CLIENT_JS}
${ADMIN_CLIENT_JS}
${SETTINGS_CLIENT_JS}

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
  const crud = window.__ROLE_PERMISSIONS_CRUD__ || {};
  const roleMatrix = crud[state.user.role] || {};
  const modPerms = roleMatrix[moduleName];
  if (!modPerms) return false;
  return Boolean(modPerms[action]);
}

// Global Tab Router
function switchTab(tabName, updateHistory = true, keepQueryParams = true) {
  const permissions = window.__ROLE_PERMISSIONS__ || {};
  const allowedTabs = ((state.user && permissions[state.user.role]) || []).slice();
  if (state.user && state.user.role === 'ADMIN') {
    allowedTabs.push('admin');
    allowedTabs.push('settings');
  }
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
    vouchers: 'Payment Vouchers (PV)',
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
`;
