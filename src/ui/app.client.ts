import { LOGIN_CLIENT_JS } from './views/login.view';
import { DASHBOARD_CLIENT_JS } from './views/dashboard.view';
import { DIRECTORY_CLIENT_JS } from './views/directory.view';
import { INVENTORY_CLIENT_JS } from './views/inventory.view';
import { PURCHASING_CLIENT_JS } from './views/purchasing.view';
import { INBOUND_CLIENT_JS } from './views/inbound.view';
import { SALES_CLIENT_JS } from './views/sales.view';
import { OUTBOUND_CLIENT_JS } from './views/outbound.view';
import { ACCOUNTING_CLIENT_JS } from './views/accounting.view';
import { PAYROLL_CLIENT_JS } from './views/payroll.view';
import { ADMIN_CLIENT_JS } from './views/admin.view';

export const APP_CLIENT_JS = `
// ============================================================================
// APEXS ERP - CLIENT CONTROLLER & ROUTER
// ============================================================================

const state = {
  user: null,
  activeTab: 'dashboard',
  products: [],
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
    showLogin();
    showToast('Your session has expired. Please sign in again.', 'danger');
  }

  return res;
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
}

function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
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
${ACCOUNTING_CLIENT_JS}
${PAYROLL_CLIENT_JS}
${ADMIN_CLIENT_JS}

// Global Tab Router
function switchTab(tabName) {
  const permissions = window.__ROLE_PERMISSIONS__ || {};
  const allowedTabs = ((state.user && permissions[state.user.role]) || []).slice();
  if (state.user && state.user.role === 'ADMIN') allowedTabs.push('admin');
  if (!allowedTabs.includes(tabName)) {
    showToast('You do not have access to that module', 'danger');
    tabName = allowedTabs[0] || tabName;
  }

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
    outbound: 'Outbound Deliveries',
    accounting: 'Vouchers',
    payroll: 'Payroll & Staff',
    admin: 'Roles & Permissions',
  };
  breadcrumb.innerText = tabTitles[tabName] || tabName;

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
  if (tabName === 'accounting') loadAccounting();
  if (tabName === 'payroll') loadPayroll();
  if (tabName === 'admin') loadAdmin();
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
`;
