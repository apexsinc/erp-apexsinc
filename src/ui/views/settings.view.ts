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
          <h2>⚙️ System Settings & Configuration</h2>
          <p class="subtitle">Configure enterprise defaults, official voucher signatories, expense categories, and system policies.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn btn-secondary" onclick="loadSettings()" style="display: flex; align-items: center; gap: 0.4rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            Reload
          </button>
          <button type="button" class="btn btn-primary" onclick="saveAllCurrentSettings()" style="display: flex; align-items: center; gap: 0.4rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Changes
          </button>
        </div>
      </div>

      <!-- Settings Navigation Sub-Tabs -->
      <div class="sub-nav">
        <button type="button" class="sub-nav-item active" data-subtab="settings-vouchers" onclick="switchSettingsSubTab('settings-vouchers')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Vouchers & Accounting
        </button>
        <button type="button" class="sub-nav-item" data-subtab="settings-org" onclick="switchSettingsSubTab('settings-org')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><path d="M9 9v1"></path><path d="M9 13v1"></path><path d="M9 17v1"></path></svg>
          Organization Profile
        </button>
        <button type="button" class="sub-nav-item" data-subtab="settings-ops" onclick="switchSettingsSubTab('settings-ops')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          Operations & Logistics
        </button>
        <button type="button" class="sub-nav-item" data-subtab="settings-payroll" onclick="switchSettingsSubTab('settings-payroll')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          Payroll Standards
        </button>
      </div>

      <!-- TAB 1: VOUCHERS & ACCOUNTING -->
      <div id="subview-settings-vouchers" class="settings-subview">
        <div class="settings-grid">
          
          <!-- 1. Default Signatories Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon">✍️</div>
              <div>
                <h3 class="settings-card-title">Official Slip Signatories (Defaults)</h3>
              </div>
            </div>
            <p class="settings-card-desc">
              Pre-populates on all Payment, Receipt, and Journal vouchers, and appears on printed official slips.
            </p>

            <div class="form-group">
              <label class="form-label" for="set-sign-prepared">Prepared By</label>
              <input type="text" id="set-sign-prepared" class="form-input" placeholder="e.g. Administrator / Bookkeeper" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-sign-certified">Certified Correct By</label>
              <input type="text" id="set-sign-certified" class="form-input" placeholder="e.g. Joy / Senior Admin" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-sign-approved">Approved By</label>
              <input type="text" id="set-sign-approved" class="form-input" placeholder="e.g. Kenneth Brown / CEO" />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="set-sign-received">Received Payment Line</label>
              <input type="text" id="set-sign-received" class="form-input" placeholder="e.g. Signature over printed name / Date" />
            </div>
          </div>

          <!-- 2. Voucher Action Permissions & Governance Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon">🛡️</div>
              <div>
                <h3 class="settings-card-title">Voucher Governance & Permissions</h3>
              </div>
            </div>
            <p class="settings-card-desc">
              Configure role authorization for voiding and deleting financial records.
            </p>

            <div style="display: flex; flex-direction: column; gap: 0.65rem;">
              <label class="toggle-option">
                <span>Staff can Void Vouchers</span>
                <input type="checkbox" id="set-perm-staff-void" style="width: 18px; height: 18px; cursor: pointer;" />
              </label>
              <label class="toggle-option">
                <span>Manager can Void Vouchers</span>
                <input type="checkbox" id="set-perm-mgr-void" style="width: 18px; height: 18px; cursor: pointer;" />
              </label>
              <label class="toggle-option">
                <span>Staff can Delete Vouchers</span>
                <input type="checkbox" id="set-perm-staff-delete" style="width: 18px; height: 18px; cursor: pointer;" />
              </label>
              <label class="toggle-option">
                <span>Manager can Delete Vouchers</span>
                <input type="checkbox" id="set-perm-mgr-delete" style="width: 18px; height: 18px; cursor: pointer;" />
              </label>
              <label class="toggle-option" style="background: var(--primary-light); border-color: var(--primary-soft);">
                <span style="font-weight: 600; color: var(--primary);">System Admin Full Override</span>
                <input type="checkbox" id="set-perm-admin-override" checked disabled style="width: 18px; height: 18px; cursor: not-allowed;" />
              </label>
            </div>
          </div>

          <!-- 3. Voucher Numbering & Type Prefixes Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon">🔢</div>
              <div>
                <h3 class="settings-card-title">Voucher Sequences & Numbering</h3>
              </div>
            </div>
            <p class="settings-card-desc">
              Standard numbering prefixes for automated voucher generation.
            </p>

            <div class="form-group">
              <label class="form-label" for="set-pfx-pv">Payment Voucher (PV) Prefix</label>
              <input type="text" id="set-pfx-pv" class="form-input" placeholder="26-" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-pfx-rv">Receipt Voucher (RV) Prefix</label>
              <input type="text" id="set-pfx-rv" class="form-input" placeholder="RV-" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-pfx-jv">Journal Voucher (JV) Prefix</label>
              <input type="text" id="set-pfx-jv" class="form-input" placeholder="JV-" />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="set-pfx-cv">Contra Transfer (CV) Prefix</label>
              <input type="text" id="set-pfx-cv" class="form-input" placeholder="CV-" />
            </div>
          </div>

          <!-- 4. Default Chart of Accounts Mapping Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon">📊</div>
              <div>
                <h3 class="settings-card-title">Chart of Accounts & TB Defaults</h3>
              </div>
            </div>
            <p class="settings-card-desc">
              Default GL Accounts automatically pre-selected when generating vouchers and posting journal entries.
            </p>

            <div class="form-group">
              <label class="form-label" for="set-coa-cash">Default Cash & Bank Account</label>
              <select id="set-coa-cash" class="form-select"></select>
            </div>
            <div class="form-group">
              <label class="form-label" for="set-coa-ap">Default Accounts Payable (AP)</label>
              <select id="set-coa-ap" class="form-select"></select>
            </div>
            <div class="form-group">
              <label class="form-label" for="set-coa-ar">Default Accounts Receivable (AR)</label>
              <select id="set-coa-ar" class="form-select"></select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="set-coa-inv">Default Inventory Asset</label>
              <select id="set-coa-inv" class="form-select"></select>
            </div>
          </div>

        </div>

        <!-- 5. Voucher Tags & Cost Centers Management -->
        <div class="settings-card" style="margin-bottom: 1.5rem;">
          <div class="settings-card-header">
            <div class="settings-card-icon">🏷️</div>
            <div>
              <h3 class="settings-card-title">Voucher Expense & Cost Center Tags</h3>
              <p class="settings-card-desc" style="margin-bottom: 0;">
                Tags categorize expenses across payment vouchers and financial reports (e.g. OPEX, Utilities, Software).
              </p>
            </div>
          </div>
          
          <div style="display: flex; gap: 0.65rem; margin-top: 1rem; margin-bottom: 1rem; max-width: 460px;">
            <input type="text" id="new-tag-input" class="form-input" placeholder="Add custom tag (e.g. Equipment Rental)..." onkeydown="if(event.key==='Enter') addSettingsTag()" />
            <button type="button" class="btn btn-secondary" onclick="addSettingsTag()" style="white-space: nowrap;">+ Add Tag</button>
          </div>
          <div id="settings-tags-container" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <!-- Dynamically populated tags -->
          </div>
        </div>

        <!-- 6. Payment Methods Management -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-icon">💳</div>
            <div>
              <h3 class="settings-card-title">Payment & Disbursement Methods</h3>
              <p class="settings-card-desc" style="margin-bottom: 0;">
                Enabled payment methods shown in voucher drop-downs and disbursement modals.
              </p>
            </div>
          </div>
          <div id="settings-payment-methods-table" class="table-container" style="margin-top: 1rem;">
            <!-- Dynamically populated table -->
          </div>
        </div>
      </div>

      <!-- TAB 2: ORGANIZATION PROFILE -->
      <div id="subview-settings-org" class="settings-subview" style="display: none;">
        <div class="settings-card" style="max-width: 860px; margin: 0 auto;">
          <div class="settings-card-header">
            <div class="settings-card-icon">🏢</div>
            <div>
              <h3 class="settings-card-title">Organization & Header Configuration</h3>
              <p class="settings-card-desc" style="margin-bottom: 0;">
                These parameters populate document headers, official voucher slips, purchase orders, and sales invoices.
              </p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.25rem;">
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label" for="set-org-name">Legal Corporate Name</label>
              <input type="text" id="set-org-name" class="form-input" placeholder="APEXS, INC." />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-org-tagline">Business Tagline</label>
              <input type="text" id="set-org-tagline" class="form-input" placeholder="Applied Expert Systems & Software, Inc." />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-org-motto">Company Motto</label>
              <input type="text" id="set-org-motto" class="form-input" placeholder="“We put technology to work for you”" />
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label" for="set-org-address">Principal Business Address</label>
              <input type="text" id="set-org-address" class="form-input" placeholder="Suite 714 EGI City by the Sea, Maribago, Lapu-Lapu City 6015" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-org-telefax">Telefax / Contact</label>
              <input type="text" id="set-org-telefax" class="form-input" placeholder="495-2106" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-org-taxid">Tax ID (TIN)</label>
              <input type="text" id="set-org-taxid" class="form-input" placeholder="000-000-000-000" />
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label" for="set-org-currency">Default Base Currency</label>
              <select id="set-org-currency" class="form-select">
                <option value="PHP">Philippine Peso (₱ / PHP)</option>
                <option value="USD">United States Dollar ($ / USD)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: OPERATIONS & LOGISTICS -->
      <div id="subview-settings-ops" class="settings-subview" style="display: none;">
        <div class="settings-card" style="max-width: 860px; margin: 0 auto;">
          <div class="settings-card-header">
            <div class="settings-card-icon">📦</div>
            <div>
              <h3 class="settings-card-title">Inventory, Purchasing & Order Workflows</h3>
              <p class="settings-card-desc" style="margin-bottom: 0;">
                Thresholds and sequence counters for procurement, inventory valuation, and customer order management.
              </p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.25rem;">
            <div class="form-group">
              <label class="form-label" for="set-ops-lowstock">Low Stock Reorder Alert Threshold</label>
              <input type="number" id="set-ops-lowstock" class="form-input" placeholder="10" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-ops-default-uom">Default Unit of Measure (UOM)</label>
              <input type="text" id="set-ops-default-uom" class="form-input" placeholder="pcs" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-ops-payment-terms">Default Vendor Payment Terms (Days)</label>
              <input type="number" id="set-ops-payment-terms" class="form-input" placeholder="30" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-ops-pfx-po">Purchase Order (PO) Prefix</label>
              <input type="text" id="set-ops-pfx-po" class="form-input" placeholder="PO-" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-ops-pfx-so">Sales Order (SO) Prefix</label>
              <input type="text" id="set-ops-pfx-so" class="form-input" placeholder="SO-" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-ops-pfx-inv">Sales Invoice (INV) Prefix</label>
              <input type="text" id="set-ops-pfx-inv" class="form-input" placeholder="INV-" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-ops-pfx-grn">Goods Received Note (GRN) Prefix</label>
              <input type="text" id="set-ops-pfx-grn" class="form-input" placeholder="GRN-" />
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: PAYROLL STANDARDS -->
      <div id="subview-settings-payroll" class="settings-subview" style="display: none;">
        <div class="settings-card" style="max-width: 860px; margin: 0 auto;">
          <div class="settings-card-header">
            <div class="settings-card-icon">👥</div>
            <div>
              <h3 class="settings-card-title">Payroll Standards & Schedule</h3>
              <p class="settings-card-desc" style="margin-bottom: 0;">
                Conventions for employee compensation runs and automated disbursement vouchers.
              </p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.25rem;">
            <div class="form-group">
              <label class="form-label" for="set-pay-workdays">Standard Workdays per Month</label>
              <input type="number" id="set-pay-workdays" class="form-input" placeholder="22" />
            </div>
            <div class="form-group">
              <label class="form-label" for="set-pay-pfx-pr">Payroll Run (PR) Prefix</label>
              <input type="text" id="set-pay-pfx-pr" class="form-input" placeholder="PR-" />
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label" for="set-pay-disburse-method">Default Disbursement Payment Method</label>
              <select id="set-pay-disburse-method" class="form-select">
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

function renderSettingsPaymentMethods() {
  const table = document.getElementById('settings-payment-methods-table');
  if (!table) return;
  table.innerHTML =
    '<table class="table">' +
    '<thead><tr><th>Method ID</th><th>Display Name</th><th>Status</th><th style="text-align: right;">Actions</th></tr></thead>' +
    '<tbody>' +
    currentPaymentMethods
      .map(
        (pm, idx) =>
          '<tr>' +
          '<td><strong style="font-family: monospace;">' + pm.id + '</strong></td>' +
          '<td><strong>' + pm.name + '</strong></td>' +
          '<td>' + (pm.isActive ? '<span class="badge badge-success"><span class="badge-dot"></span>Active</span>' : '<span class="badge badge-neutral">Disabled</span>') + '</td>' +
          '<td style="text-align: right;">' +
          '<button type="button" class="btn btn-sm ' + (pm.isActive ? 'btn-secondary' : 'btn-primary') + '" onclick="togglePaymentMethodActive(' + idx + ')">' + (pm.isActive ? 'Disable' : 'Enable') + '</button>' +
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
`;
