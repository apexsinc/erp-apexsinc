/**
 * System Settings View (Restricted to System Administrator)
 * Provides comprehensive configuration for Vouchers (Signatories, Tags,
 * Payment Methods, Permissions, Default GL Accounts), Organization Profile,
 * Operations (Stock thresholds, Order prefixes), and Payroll standards.
 */

export function renderSettingsView(): string {
  return `
    <div id="view-settings" class="tab-view" style="display: none;">
      <div class="view-header">
        <div>
          <h2>System Settings & Configuration</h2>
          <p class="subtitle">Configure enterprise defaults, voucher signatories, expense tags, and system policies.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" onclick="saveAllCurrentSettings()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Changes
          </button>
        </div>
      </div>

      <!-- Settings Navigation Sub-Tabs -->
      <div class="sub-nav">
        <button class="sub-nav-item active" data-subtab="settings-vouchers" onclick="switchSettingsSubTab('settings-vouchers')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;margin-right:6px;"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Vouchers & Accounting
        </button>
        <button class="sub-nav-item" data-subtab="settings-org" onclick="switchSettingsSubTab('settings-org')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;margin-right:6px;"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><path d="M9 9v1"></path><path d="M9 13v1"></path><path d="M9 17v1"></path></svg>
          Organization Profile
        </button>
        <button class="sub-nav-item" data-subtab="settings-ops" onclick="switchSettingsSubTab('settings-ops')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;margin-right:6px;"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          Operations & Logistics
        </button>
        <button class="sub-nav-item" data-subtab="settings-payroll" onclick="switchSettingsSubTab('settings-payroll')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;margin-right:6px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          Payroll Standards
        </button>
      </div>

      <!-- TAB 1: VOUCHERS & ACCOUNTING -->
      <div id="subview-settings-vouchers" class="settings-subview">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:20px; margin-bottom:20px;">
          
          <!-- 1. Default Signatories Card -->
          <div class="card" style="padding:20px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
              <span style="font-size:18px;">✍️</span>
              <h3 style="margin:0; font-size:15px; font-weight:600;">Official Slip Signatories (Defaults)</h3>
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
              These names and titles pre-populate on all Payment, Receipt, and Journal vouchers, and are printed on official slips.
            </p>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-size:12px;">Prepared By</label>
              <input type="text" id="set-sign-prepared" class="form-control" placeholder="e.g. Administrator" />
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-size:12px;">Certified Correct By</label>
              <input type="text" id="set-sign-certified" class="form-control" placeholder="e.g. Joy/Admin" />
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-size:12px;">Approved By</label>
              <input type="text" id="set-sign-approved" class="form-control" placeholder="e.g. Kenneth Brown/CEO" />
            </div>
            <div class="form-group" style="margin-bottom:4px;">
              <label class="form-label" style="font-size:12px;">Received Payment Line</label>
              <input type="text" id="set-sign-received" class="form-control" placeholder="e.g. Signature over printed name/Date" />
            </div>
          </div>

          <!-- 2. Voucher Action Permissions & Policies Card -->
          <div class="card" style="padding:20px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
              <span style="font-size:18px;">🛡️</span>
              <h3 style="margin:0; font-size:15px; font-weight:600;">Voucher Governance & Permissions</h3>
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
              Define who is authorized to void, delete, or hide posted financial records and journals.
            </p>

            <div style="display:flex; flex-direction:column; gap:12px;">
              <label style="display:flex; align-items:center; justify-content:space-between; font-size:13px; cursor:pointer; padding:8px 12px; background:var(--bg-app); border-radius:6px; border:1px solid var(--border-color);">
                <span>Staff can Void Vouchers</span>
                <input type="checkbox" id="set-perm-staff-void" style="width:18px; height:18px;" />
              </label>
              <label style="display:flex; align-items:center; justify-content:space-between; font-size:13px; cursor:pointer; padding:8px 12px; background:var(--bg-app); border-radius:6px; border:1px solid var(--border-color);">
                <span>Manager can Void Vouchers</span>
                <input type="checkbox" id="set-perm-mgr-void" style="width:18px; height:18px;" />
              </label>
              <label style="display:flex; align-items:center; justify-content:space-between; font-size:13px; cursor:pointer; padding:8px 12px; background:var(--bg-app); border-radius:6px; border:1px solid var(--border-color);">
                <span>Staff can Delete / Hide Vouchers</span>
                <input type="checkbox" id="set-perm-staff-delete" style="width:18px; height:18px;" />
              </label>
              <label style="display:flex; align-items:center; justify-content:space-between; font-size:13px; cursor:pointer; padding:8px 12px; background:var(--bg-app); border-radius:6px; border:1px solid var(--border-color);">
                <span>Manager can Delete / Hide Vouchers</span>
                <input type="checkbox" id="set-perm-mgr-delete" style="width:18px; height:18px;" />
              </label>
              <label style="display:flex; align-items:center; justify-content:space-between; font-size:13px; cursor:pointer; padding:8px 12px; background:var(--primary-light); border-radius:6px; border:1px solid var(--primary-soft);">
                <span style="font-weight:600; color:var(--primary);">Admin Full Audit Override</span>
                <input type="checkbox" id="set-perm-admin-override" checked disabled style="width:18px; height:18px;" />
              </label>
            </div>
          </div>

          <!-- 3. Voucher Numbering & Type Prefixes Card -->
          <div class="card" style="padding:20px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
              <span style="font-size:18px;">🔢</span>
              <h3 style="margin:0; font-size:15px; font-weight:600;">Voucher Sequences & Numbering</h3>
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
              Standard numbering prefixes for vouchers generated across the business.
            </p>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-size:12px;">Payment Voucher (PV) Prefix</label>
              <input type="text" id="set-pfx-pv" class="form-control" placeholder="26-" />
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-size:12px;">Receipt Voucher (RV) Prefix</label>
              <input type="text" id="set-pfx-rv" class="form-control" placeholder="RV-" />
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-size:12px;">Journal Voucher (JV) Prefix</label>
              <input type="text" id="set-pfx-jv" class="form-control" placeholder="JV-" />
            </div>
            <div class="form-group" style="margin-bottom:4px;">
              <label class="form-label" style="font-size:12px;">Contra Transfer (CV) Prefix</label>
              <input type="text" id="set-pfx-cv" class="form-control" placeholder="CV-" />
            </div>
          </div>

          <!-- 4. Default Chart of Accounts Mapping Card -->
          <div class="card" style="padding:20px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
              <span style="font-size:18px;">📊</span>
              <h3 style="margin:0; font-size:15px; font-weight:600;">Chart of Accounts & TB Defaults</h3>
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
              Default GL Accounts automatically pre-selected when generating vouchers and posting transactions.
            </p>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-size:12px;">Default Cash & Bank Account</label>
              <select id="set-coa-cash" class="form-control"></select>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-size:12px;">Default Accounts Payable (AP)</label>
              <select id="set-coa-ap" class="form-control"></select>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-size:12px;">Default Accounts Receivable (AR)</label>
              <select id="set-coa-ar" class="form-control"></select>
            </div>
            <div class="form-group" style="margin-bottom:4px;">
              <label class="form-label" style="font-size:12px;">Default Inventory Asset</label>
              <select id="set-coa-inv" class="form-control"></select>
            </div>
          </div>

        </div>

        <!-- 5. Voucher Tags & Cost Centers Management -->
        <div class="card" style="padding:20px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <h3 style="margin:0; font-size:15px; font-weight:600;">🏷️ Voucher Expense & Cost Center Tags</h3>
              <p style="font-size:12px; color:var(--text-muted); margin:4px 0 0 0;">
                Tags categorize expenses on payment vouchers and reports (e.g. OPEX, Utilities, Software).
              </p>
            </div>
          </div>
          <div style="display:flex; gap:10px; margin-bottom:14px;">
            <input type="text" id="new-tag-input" class="form-control" style="max-width:320px;" placeholder="Add custom tag (e.g. Equipment Rental)..." onkeydown="if(event.key==='Enter') addSettingsTag()" />
            <button class="btn btn-secondary" onclick="addSettingsTag()">+ Add Tag</button>
          </div>
          <div id="settings-tags-container" style="display:flex; flex-wrap:wrap; gap:8px;">
            <!-- Dynamically populated tags -->
          </div>
        </div>

        <!-- 6. Payment Methods Management -->
        <div class="card" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <h3 style="margin:0; font-size:15px; font-weight:600;">💳 Payment & Disbursement Methods</h3>
              <p style="font-size:12px; color:var(--text-muted); margin:4px 0 0 0;">
                Enabled payment methods shown in voucher drop-downs and disbursement vouchers.
              </p>
            </div>
          </div>
          <div id="settings-payment-methods-table" class="table-responsive">
            <!-- Dynamically populated table -->
          </div>
        </div>
      </div>

      <!-- TAB 2: ORGANIZATION PROFILE -->
      <div id="subview-settings-org" class="settings-subview" style="display:none;">
        <div class="card" style="padding:24px; max-width:800px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:18px;">
            <span style="font-size:22px;">🏢</span>
            <div>
              <h3 style="margin:0; font-size:16px; font-weight:600;">Organization & Header Configuration</h3>
              <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0 0;">
                These parameters populate document headers, official voucher slips, purchase orders, and sales invoices.
              </p>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Legal Corporate Name</label>
              <input type="text" id="set-org-name" class="form-control" placeholder="APEXS, INC." />
            </div>
            <div class="form-group">
              <label class="form-label">Business Tagline</label>
              <input type="text" id="set-org-tagline" class="form-control" placeholder="Applied Expert Systems & Software, Inc." />
            </div>
            <div class="form-group">
              <label class="form-label">Company Motto</label>
              <input type="text" id="set-org-motto" class="form-control" placeholder="We put technology to work for you" />
            </div>
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Principal Business Address</label>
              <input type="text" id="set-org-address" class="form-control" placeholder="Suite 714 EGI City by the Sea, Maribago, Lapu-Lapu City 6015" />
            </div>
            <div class="form-group">
              <label class="form-label">Telefax / Contact</label>
              <input type="text" id="set-org-telefax" class="form-control" placeholder="495-2106" />
            </div>
            <div class="form-group">
              <label class="form-label">Tax ID (TIN)</label>
              <input type="text" id="set-org-taxid" class="form-control" placeholder="000-000-000-000" />
            </div>
            <div class="form-group">
              <label class="form-label">Default Base Currency</label>
              <select id="set-org-currency" class="form-control">
                <option value="PHP">Philippine Peso (₱ / PHP)</option>
                <option value="USD">United States Dollar ($ / USD)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: OPERATIONS & LOGISTICS -->
      <div id="subview-settings-ops" class="settings-subview" style="display:none;">
        <div class="card" style="padding:24px; max-width:800px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:18px;">
            <span style="font-size:22px;">📦</span>
            <div>
              <h3 style="margin:0; font-size:16px; font-weight:600;">Inventory, Purchasing & Order Workflows</h3>
              <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0 0;">
                Thresholds and sequence counters for procurement, inventory valuation, and customer order management.
              </p>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Low Stock Reorder Alert Threshold</label>
              <input type="number" id="set-ops-lowstock" class="form-control" placeholder="10" />
            </div>
            <div class="form-group">
              <label class="form-label">Default Unit of Measure (UOM)</label>
              <input type="text" id="set-ops-default-uom" class="form-control" placeholder="pcs" />
            </div>
            <div class="form-group">
              <label class="form-label">Default Vendor Payment Terms (Days)</label>
              <input type="number" id="set-ops-payment-terms" class="form-control" placeholder="30" />
            </div>
            <div class="form-group">
              <label class="form-label">Purchase Order (PO) Prefix</label>
              <input type="text" id="set-ops-pfx-po" class="form-control" placeholder="PO-" />
            </div>
            <div class="form-group">
              <label class="form-label">Sales Order (SO) Prefix</label>
              <input type="text" id="set-ops-pfx-so" class="form-control" placeholder="SO-" />
            </div>
            <div class="form-group">
              <label class="form-label">Sales Invoice (INV) Prefix</label>
              <input type="text" id="set-ops-pfx-inv" class="form-control" placeholder="INV-" />
            </div>
            <div class="form-group">
              <label class="form-label">Goods Received Note (GRN) Prefix</label>
              <input type="text" id="set-ops-pfx-grn" class="form-control" placeholder="GRN-" />
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: PAYROLL STANDARDS -->
      <div id="subview-settings-payroll" class="settings-subview" style="display:none;">
        <div class="card" style="padding:24px; max-width:800px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:18px;">
            <span style="font-size:22px;">👥</span>
            <div>
              <h3 style="margin:0; font-size:16px; font-weight:600;">Payroll Standards & Schedule</h3>
              <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0 0;">
                Conventions for employee compensation runs and automated disbursement vouchers.
              </p>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Standard Workdays per Month</label>
              <input type="number" id="set-pay-workdays" class="form-control" placeholder="22" />
            </div>
            <div class="form-group">
              <label class="form-label">Payroll Run (PR) Prefix</label>
              <input type="text" id="set-pay-pfx-pr" class="form-control" placeholder="PR-" />
            </div>
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Default Disbursement Payment Method</label>
              <select id="set-pay-disburse-method" class="form-control">
                <option value="BANK_TRANSFER">Bank Transfer / Direct Deposit</option>
                <option value="CHECK">Corporate Check</option>
                <option value="CASH">Cash Payroll</option>
              </select>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;
}

export const SETTINGS_CLIENT_JS = `
// System Settings State & Controller
let currentSystemSettings = {};
let currentSettingsTags = [];
let currentPaymentMethods = [];

function switchSettingsSubTab(subTabName) {
  document.querySelectorAll('#view-settings .sub-nav-item').forEach((item) => {
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
      fetchApi('/api/settings'),
      fetchApi('/api/accounting/accounts')
    ]);

    const settingsData = await settingsRes.json();
    const coaData = await coaRes.json();

    if (!settingsData.success) {
      showToast(settingsData.error || 'Failed to load settings', 'danger');
      return;
    }

    currentSystemSettings = settingsData.settings || {};
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
  document.getElementById('set-sign-prepared').value = sign.preparedBy || 'Administrator';
  document.getElementById('set-sign-certified').value = sign.certifiedBy || 'Joy/Admin';
  document.getElementById('set-sign-approved').value = sign.approvedBy || 'Kenneth Brown/CEO';
  document.getElementById('set-sign-received').value = sign.receivedBy || 'Signature over printed name/Date';

  // 2. Permissions
  const perm = v['vouchers.permissions'] || {};
  document.getElementById('set-perm-staff-void').checked = !!perm.allowStaffVoid;
  document.getElementById('set-perm-mgr-void').checked = !!perm.allowManagerVoid;
  document.getElementById('set-perm-staff-delete').checked = !!perm.allowStaffDelete;
  document.getElementById('set-perm-mgr-delete').checked = !!perm.allowManagerDelete;

  // 3. Numbering
  const types = v['vouchers.types'] || [];
  const pvType = types.find((t) => t.id === 'PAYMENT') || {};
  const rvType = types.find((t) => t.id === 'RECEIPT') || {};
  const jvType = types.find((t) => t.id === 'JOURNAL') || {};
  const cvType = types.find((t) => t.id === 'CONTRA') || {};
  document.getElementById('set-pfx-pv').value = pvType.prefix || '26-';
  document.getElementById('set-pfx-rv').value = rvType.prefix || 'RV-';
  document.getElementById('set-pfx-jv').value = jvType.prefix || 'JV-';
  document.getElementById('set-pfx-cv').value = cvType.prefix || 'CV-';

  // 4. Default COA
  const coa = v['vouchers.default_accounts'] || {};
  if (coa.cashAccountCode) document.getElementById('set-coa-cash').value = coa.cashAccountCode;
  if (coa.accountsPayableCode) document.getElementById('set-coa-ap').value = coa.accountsPayableCode;
  if (coa.accountsReceivableCode) document.getElementById('set-coa-ar').value = coa.accountsReceivableCode;
  if (coa.inventoryAssetCode) document.getElementById('set-coa-inv').value = coa.inventoryAssetCode;

  // 5. Tags
  currentSettingsTags = (v['vouchers.tags'] && Array.isArray(v['vouchers.tags'])) ? [...v['vouchers.tags']] : [];
  renderSettingsTags();

  // 6. Payment Methods
  currentPaymentMethods = (v['vouchers.payment_methods'] && Array.isArray(v['vouchers.payment_methods'])) ? [...v['vouchers.payment_methods']] : [];
  renderSettingsPaymentMethods();

  // 7. Organization
  const orgProf = org['organization.profile'] || {};
  document.getElementById('set-org-name').value = orgProf.companyName || 'APEXS, INC.';
  document.getElementById('set-org-tagline').value = orgProf.tagline || '';
  document.getElementById('set-org-motto').value = orgProf.motto || '';
  document.getElementById('set-org-address').value = orgProf.address || '';
  document.getElementById('set-org-telefax').value = orgProf.telefax || '';
  document.getElementById('set-org-taxid').value = orgProf.taxId || '';
  document.getElementById('set-org-currency').value = orgProf.defaultCurrency || 'PHP';

  // 8. Operations
  const opsConf = ops['operations.config'] || {};
  document.getElementById('set-ops-lowstock').value = opsConf.lowStockThreshold || 10;
  document.getElementById('set-ops-default-uom').value = opsConf.defaultUom || 'pcs';
  document.getElementById('set-ops-payment-terms').value = opsConf.defaultPaymentTermsDays || 30;
  document.getElementById('set-ops-pfx-po').value = opsConf.poPrefix || 'PO-';
  document.getElementById('set-ops-pfx-so').value = opsConf.soPrefix || 'SO-';
  document.getElementById('set-ops-pfx-inv').value = opsConf.invPrefix || 'INV-';
  document.getElementById('set-ops-pfx-grn').value = opsConf.grnPrefix || 'GRN-';

  // 9. Payroll
  const payConf = pay['payroll.config'] || {};
  document.getElementById('set-pay-workdays').value = payConf.standardWorkDaysPerMonth || 22;
  document.getElementById('set-pay-pfx-pr').value = payConf.payrollRunPrefix || 'PR-';
  document.getElementById('set-pay-disburse-method').value = payConf.defaultDisbursementMethod || 'BANK_TRANSFER';
}

function renderSettingsTags() {
  const container = document.getElementById('settings-tags-container');
  if (!container) return;
  if (!currentSettingsTags || currentSettingsTags.length === 0) {
    container.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">No custom tags defined.</span>';
    return;
  }
  container.innerHTML = currentSettingsTags
    .map(
      (tag, idx) =>
        '<div style="display:inline-flex; align-items:center; gap:6px; background:var(--bg-app); border:1px solid var(--border-color); padding:4px 10px; border-radius:20px; font-size:12px; font-weight:500;">' +
        '<span>' + tag + '</span>' +
        '<button type="button" onclick="removeSettingsTag(' + idx + ')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px; line-height:1; padding:0;">×</button>' +
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

function renderSettingsPaymentMethods() {
  const table = document.getElementById('settings-payment-methods-table');
  if (!table) return;
  table.innerHTML =
    '<table class="table">' +
    '<thead><tr><th>Method ID</th><th>Display Name</th><th>Status</th><th>Actions</th></tr></thead>' +
    '<tbody>' +
    currentPaymentMethods
      .map(
        (pm, idx) =>
          '<tr>' +
          '<td><code>' + pm.id + '</code></td>' +
          '<td><strong>' + pm.name + '</strong></td>' +
          '<td>' + (pm.isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Disabled</span>') + '</td>' +
          '<td>' +
          '<button class="btn btn-sm btn-secondary" onclick="togglePaymentMethodActive(' + idx + ')">' + (pm.isActive ? 'Disable' : 'Enable') + '</button>' +
          '</td>' +
          '</tr>'
      )
      .join('') +
    '</tbody></table>';
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
      preparedBy: document.getElementById('set-sign-prepared').value.trim(),
      certifiedBy: document.getElementById('set-sign-certified').value.trim(),
      approvedBy: document.getElementById('set-sign-approved').value.trim(),
      receivedBy: document.getElementById('set-sign-received').value.trim(),
    };

    const permissions = {
      allowStaffVoid: document.getElementById('set-perm-staff-void').checked,
      allowManagerVoid: document.getElementById('set-perm-mgr-void').checked,
      allowStaffDelete: document.getElementById('set-perm-staff-delete').checked,
      allowManagerDelete: document.getElementById('set-perm-mgr-delete').checked,
      allowAdminDelete: true,
      allowAdminVoid: true,
    };

    const types = [
      { id: 'PAYMENT', name: 'Payment Voucher (PV)', prefix: document.getElementById('set-pfx-pv').value.trim() || '26-' },
      { id: 'RECEIPT', name: 'Receipt Voucher (RV)', prefix: document.getElementById('set-pfx-rv').value.trim() || 'RV-' },
      { id: 'JOURNAL', name: 'Journal Voucher (JV)', prefix: document.getElementById('set-pfx-jv').value.trim() || 'JV-' },
      { id: 'CONTRA', name: 'Contra Voucher (CV)', prefix: document.getElementById('set-pfx-cv').value.trim() || 'CV-' },
    ];

    const defaultAccounts = {
      cashAccountCode: document.getElementById('set-coa-cash').value,
      accountsPayableCode: document.getElementById('set-coa-ap').value,
      accountsReceivableCode: document.getElementById('set-coa-ar').value,
      inventoryAssetCode: document.getElementById('set-coa-inv').value,
    };

    const organization = {
      companyName: document.getElementById('set-org-name').value.trim(),
      tagline: document.getElementById('set-org-tagline').value.trim(),
      motto: document.getElementById('set-org-motto').value.trim(),
      address: document.getElementById('set-org-address').value.trim(),
      telefax: document.getElementById('set-org-telefax').value.trim(),
      taxId: document.getElementById('set-org-taxid').value.trim(),
      defaultCurrency: document.getElementById('set-org-currency').value,
    };

    const operations = {
      lowStockThreshold: parseInt(document.getElementById('set-ops-lowstock').value, 10) || 10,
      defaultUom: document.getElementById('set-ops-default-uom').value.trim() || 'pcs',
      defaultPaymentTermsDays: parseInt(document.getElementById('set-ops-payment-terms').value, 10) || 30,
      poPrefix: document.getElementById('set-ops-pfx-po').value.trim() || 'PO-',
      soPrefix: document.getElementById('set-ops-pfx-so').value.trim() || 'SO-',
      invPrefix: document.getElementById('set-ops-pfx-inv').value.trim() || 'INV-',
      grnPrefix: document.getElementById('set-ops-pfx-grn').value.trim() || 'GRN-',
    };

    const payroll = {
      standardWorkDaysPerMonth: parseInt(document.getElementById('set-pay-workdays').value, 10) || 22,
      payrollRunPrefix: document.getElementById('set-pay-pfx-pr').value.trim() || 'PR-',
      defaultDisbursementMethod: document.getElementById('set-pay-disburse-method').value,
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
      const res = await fetchApi('/api/settings/category/' + group.category, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: group.settings }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Failed to save settings for ' + group.category, 'danger');
        return;
      }
    }

    showToast('System settings saved successfully!', 'success');
  } catch (err) {
    console.error('Error saving settings:', err);
    showToast('Error saving settings: ' + err.message, 'danger');
  }
}
`;
