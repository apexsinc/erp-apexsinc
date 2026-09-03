export function renderDirectoryView(): string {
  return `<div id="view-directory" class="tab-view" style="display: none;"></div>`;
}

export const DIRECTORY_CLIENT_JS = `
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
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading directory: \${err.message}</div>\`;
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
    return \`
      <button type="button" onclick="switchDirectoryTab('\${tab}')" style="padding: 0.5rem 1rem; border-radius: 999px; font-size: 0.82rem; font-weight: 600; border: 1px solid \${active ? 'var(--primary)' : 'var(--border-color)'}; background: \${active ? 'var(--primary)' : '#ffffff'}; color: \${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        \${directoryTabLabel(tab)} <span style="opacity: 0.75;">(\${directoryTabCount(tab)})</span>
      </button>
    \`;
  }).join('');

  const addButton = can('directory', 'create')
    ? {
        customers: '<button class="btn btn-primary btn-sm" onclick="openNewCustomerModal()">Add Customer</button>',
        products: '<button class="btn btn-primary btn-sm" onclick="openNewProductModal()">Add Product</button>',
        suppliers: '<button class="btn btn-primary btn-sm" onclick="openNewVendorModal()">Add Supplier</button>',
      }[directoryActiveTab] || ''
    : '';

  container.innerHTML = \`
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Business Directory</div>
        <div class="panel-actions">\${addButton}</div>
      </div>
      <p style="padding: 0 1.35rem 1rem; font-size: 0.85rem; color: #64748b;">
        The single source of truth for customers, products, and suppliers — referenced by Purchasing, Inbound, and Sales, but managed here.
      </p>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 1.35rem 1rem; flex-wrap: wrap;">
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">\${tabsHtml}</div>
        <input
          type="text"
          class="form-input"
          style="max-width: 260px;"
          placeholder="Search \${directoryTabLabel(directoryActiveTab).toLowerCase()}..."
          value="\${directorySearch}"
          oninput="directorySearch = this.value; renderDirectoryTable();"
        />
      </div>
      \${directoryActiveTab === 'products' ? '<div id="directory-category-tabs" style="padding: 0 1.35rem 1rem;"></div>' : ''}
      <div id="directory-table-wrap"></div>
    </div>
  \`;
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
    return \`
      <button type="button" onclick="productsCategoryTab = '\${p.key.replace(/'/g, "\\\\'")}'; renderDirectoryTable();" style="padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid \${active ? 'var(--primary)' : 'var(--border-color)'}; background: \${active ? 'var(--primary)' : '#f8fafc'}; color: \${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        \${p.label} <span style="opacity: 0.75;">(\${p.count})</span>
      </button>
    \`;
  }).join('');

  wrap.innerHTML = \`
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
      \${pillsHtml}
      <button type="button" onclick="openAddCategoryModal()" style="padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px dashed var(--border-color); background: transparent; color: #64748b; cursor: pointer;">+ Add Category</button>
    </div>
  \`;
}

function renderDirectoryTable() {
  const wrap = document.getElementById('directory-table-wrap');
  if (!wrap) return;
  const q = directorySearch.trim().toLowerCase();

  if (directoryActiveTab === 'customers') {
    const rows = state.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
    wrap.innerHTML = \`
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Customer Code</th><th>Name</th><th>Email</th><th>Added</th></tr></thead>
          <tbody>
            \${rows.map((c) => \`
              <tr>
                <td><strong>\${c.customerCode}</strong></td>
                <td>\${c.name}</td>
                <td>\${c.email || '<span style="color: #94a3b8;">—</span>'}</td>
                <td>\${new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            \`).join('') || '<tr><td colspan="4" style="text-align: center; color: #64748b;">No customers found.</td></tr>'}
          </tbody>
        </table>
      </div>
    \`;
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
    wrap.innerHTML = \`
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>SKU</th><th>Product Name</th><th>Category</th><th>UOM</th><th>Cost Price</th><th></th></tr></thead>
          <tbody>
            \${rows.map((p) => \`
              <tr>
                <td><strong>\${p.sku}</strong></td>
                <td>\${p.name}</td>
                <td>\${p.category || '<span style="color: #94a3b8;">—</span>'}</td>
                <td>\${p.unitOfMeasure}</td>
                <td>\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.75rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8;">Not purchased yet</span>'}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="openChangeCategoryModal('\${p.id}', '\${p.name.replace(/'/g, "\\\\'")}', '\${(p.category || '').replace(/'/g, "\\\\'")}')">Change Category</button></td>
              </tr>
            \`).join('') || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No products found.</td></tr>'}
          </tbody>
        </table>
      </div>
      <p style="padding: 0 1.35rem 1.25rem; font-size: 0.78rem; color: #94a3b8;">Selling prices are managed on the Price List tab. Stock levels, valuation, and movement history live in Inventory & Stock.</p>
    \`;
  } else if (directoryActiveTab === 'pricelist') {
    const rows = state.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    wrap.innerHTML = \`
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>SKU</th><th>Product Name</th><th>Cost Price</th><th>Selling Price</th><th></th></tr></thead>
          <tbody>
            \${rows.map((p) => \`
              <tr>
                <td><strong>\${p.sku}</strong></td>
                <td>\${p.name}</td>
                <td>\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.75rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8;">Not purchased yet</span>'}</td>
                <td>\${p.sellingPriceCents > 0 ? formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency) : '<span style="color: #94a3b8;">Not set</span>'}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="openSetPriceModal('\${p.id}', '\${p.name.replace(/'/g, "\\\\'")}', \${p.sellingPriceCents}, '\${p.sellingPriceCurrency}')">Set Price</button></td>
              </tr>
            \`).join('') || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No products found.</td></tr>'}
          </tbody>
        </table>
      </div>
      <p style="padding: 0 1.35rem 1.25rem; font-size: 0.78rem; color: #94a3b8;">Selling prices set here are what Sales Orders and Invoices should quote customers.</p>
    \`;
  } else if (directoryActiveTab === 'suppliers') {
    const rows = state.vendors.filter((v) => !q || v.name.toLowerCase().includes(q) || v.vendorCode.toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q));
    wrap.innerHTML = \`
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Vendor Code</th><th>Name</th><th>Email</th><th>Payment Terms</th></tr></thead>
          <tbody>
            \${rows.map((v) => \`
              <tr>
                <td><strong>\${v.vendorCode}</strong></td>
                <td>\${v.name}</td>
                <td>\${v.email || '<span style="color: #94a3b8;">—</span>'}</td>
                <td>\${v.paymentTermsDays} days</td>
              </tr>
            \`).join('') || '<tr><td colspan="4" style="text-align: center; color: #64748b;">No suppliers found.</td></tr>'}
          </tbody>
        </table>
      </div>
    \`;
  }
}

// ---- Create Customer (moved from Sales) ----

function openNewCustomerModal() {
  const body = \`
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
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-cust').requestSubmit()">Save Customer</button>
  \`;
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
  return state.productCategories.map((c) => \`<option value="\${c.name}" \${c.name === selectedName ? 'selected' : ''}>\${c.name}</option>\`).join('');
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
  const body = \`
    <form id="form-add-category" onsubmit="submitAddCategory(event)">
      <div class="form-group">
        <label class="form-label">Category Name *</label>
        <input type="text" id="ac-name" class="form-input" placeholder="e.g. Weather Station" required />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-add-category').requestSubmit()">Save Category</button>
  \`;
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
  const body = \`
    <form id="form-change-category" onsubmit="submitChangeCategory(event, '\${productId}')">
      <p style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b;">Category for <strong>\${name}</strong>.</p>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <div style="display: flex; gap: 0.5rem;">
          <select id="cc-category" class="form-select" style="flex: 1;">\${productCategoryOptionsHtml(currentCategory)}</select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="quickAddCategory('cc-category')">+ New</button>
        </div>
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-change-category').requestSubmit()">Save Category</button>
  \`;
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
  const body = \`
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
          <select id="np-category" class="form-select" style="flex: 1;" required>\${productCategoryOptionsHtml(null)}</select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="quickAddCategory('np-category')">+ New</button>
        </div>
      </div>
      <p style="margin: -0.5rem 0 0; font-size: 0.78rem; color: #94a3b8;">
        Unit of measure, cost price, currency, and quantity are set when you order this product in Purchasing.
        Selling price is set afterwards from the Price List tab.
      </p>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-product').requestSubmit()">Save Product</button>
  \`;
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
  const body = \`
    <form id="form-set-price" onsubmit="submitSetPrice(event, '\${productId}')">
      <p style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b;">Selling price for <strong>\${name}</strong>.</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Selling Price *</label>
          <input type="number" id="sp-price" class="form-input" placeholder="e.g. 90.00" step="0.01" min="0" value="\${currentAmount}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Currency *</label>
          <select id="sp-currency" class="form-select">
            <option value="USD" \${currency === 'USD' ? 'selected' : ''}>USD ($)</option>
            <option value="PHP" \${currency === 'PHP' ? 'selected' : ''}>PHP (₱)</option>
          </select>
        </div>
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-set-price').requestSubmit()">Save Price</button>
  \`;
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
  const body = \`
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
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-new-vendor').requestSubmit()">Save Vendor</button>
  \`;
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
`;
