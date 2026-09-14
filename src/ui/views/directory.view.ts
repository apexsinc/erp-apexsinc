export function renderDirectoryView(): string {
  return `
    <style>
      .directory-smart-scroll-container {
        position: relative;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        overflow: hidden;
      }
      .directory-smart-scroll {
        max-height: calc(100vh - 280px);
        min-height: 220px;
        overflow-y: auto;
        overflow-x: auto;
        scroll-behavior: smooth;
      }
      .directory-smart-scroll::-webkit-scrollbar {
        width: 7px;
        height: 7px;
      }
      .directory-smart-scroll::-webkit-scrollbar-track {
        background: #f8fafc;
      }
      .directory-smart-scroll::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      .directory-smart-scroll::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
      .directory-smart-scroll table {
        border-collapse: separate;
        border-spacing: 0;
        width: 100%;
        margin: 0;
      }
      .directory-smart-scroll thead th {
        position: sticky;
        top: 0;
        z-index: 10;
        background: #f8fafc;
        border-bottom: 2px solid var(--border-color);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        transition: background-color 0.15s ease;
      }
      .directory-smart-scroll thead th.sortable-th:hover {
        background: #f1f5f9;
      }
      .directory-smart-scroll td {
        border-bottom: 1px solid var(--border-color);
      }
      .directory-smart-scroll tbody tr {
        transition: background-color 0.15s ease;
      }
      .directory-smart-scroll tbody tr:hover {
        background-color: #f8fafc;
      }
      .directory-scroll-pill {
        position: absolute;
        bottom: 1.15rem;
        right: 1.5rem;
        z-index: 25;
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(8px);
        color: #ffffff;
        padding: 0.45rem 0.95rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 600;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.25);
        display: flex;
        align-items: center;
        gap: 0.55rem;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .directory-scroll-pill:hover {
        background: #0f172a;
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.35);
      }
      .directory-scroll-top-arrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        font-size: 0.75rem;
        line-height: 1;
      }
    </style>
    <div id="view-directory" class="tab-view" style="display: none;"></div>
  `;
}

export const DIRECTORY_CLIENT_JS = `
let directoryActiveTab = 'customers';
let directorySearch = '';
let productsCategoryTab = 'all';
let directoryVisibleCount = 50;
const DIRECTORY_CHUNK_SIZE = 50;
let directorySortField = 'name';
let directorySortOrder = 'asc';

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
    if (allowed.includes('products') || allowed.includes('pricelist')) {
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
  directoryVisibleCount = 50;
  if (tab === 'customers') directorySortField = 'name';
  else if (tab === 'products') directorySortField = 'sku';
  else if (tab === 'pricelist') directorySortField = 'name';
  else if (tab === 'suppliers') directorySortField = 'name';
  directorySortOrder = 'asc';
  renderDirectoryContent();
}

function setDirectorySort(field) {
  if (directorySortField === field) {
    directorySortOrder = directorySortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    directorySortField = field;
    directorySortOrder = 'asc';
  }
  directoryVisibleCount = 50;
  renderDirectoryTable();
}

function directorySortIndicator(field) {
  if (directorySortField !== field) {
    return '<span style="color: #cbd5e1; font-size: 0.72rem; margin-left: 4px;">↕</span>';
  }
  return directorySortOrder === 'asc'
    ? '<span style="color: var(--primary); font-size: 0.8rem; font-weight: 700; margin-left: 4px;">↑</span>'
    : '<span style="color: var(--primary); font-size: 0.8rem; font-weight: 700; margin-left: 4px;">↓</span>';
}

function sortDirectoryRows(rows) {
  if (!directorySortField) return rows;
  return rows.slice().sort((a, b) => {
    let valA = a[directorySortField];
    let valB = b[directorySortField];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (typeof valA === 'number' && typeof valB === 'number') {
      return directorySortOrder === 'asc' ? valA - valB : valB - valA;
    }

    const strA = (valA + '').toLowerCase();
    const strB = (valB + '').toLowerCase();
    const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
    return directorySortOrder === 'asc' ? cmp : -cmp;
  });
}

function handleDirectorySearchInput(val) {
  directorySearch = val;
  directoryVisibleCount = 50;
  const clearBtn = document.getElementById('directory-search-clear-btn');
  if (clearBtn) {
    clearBtn.style.display = val ? 'inline-block' : 'none';
  }
  renderDirectoryTable();
}

function clearDirectorySearch() {
  directorySearch = '';
  directoryVisibleCount = 50;
  const inputEl = document.getElementById('directory-search-input');
  if (inputEl) inputEl.value = '';
  const clearBtn = document.getElementById('directory-search-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderDirectoryTable();
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

  const canManageCatalog = can('directory', 'create') || can('inventory', 'create');
  const addButton = canManageCatalog
    ? {
        customers: '<button class="btn btn-primary btn-sm" onclick="openNewCustomerModal()">Add Customer</button>',
        products: '<div style="display: flex; gap: 0.5rem;"><button class="btn btn-secondary btn-sm" onclick="openImportPricelistModal()" style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="font-size: 0.95rem;">📥</span> Import Excel</button><button class="btn btn-primary btn-sm" onclick="openNewProductModal()">+ Add Product</button></div>',
        pricelist: '<div style="display: flex; gap: 0.5rem;"><button class="btn btn-secondary btn-sm" onclick="openImportPricelistModal()" style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="font-size: 0.95rem;">📥</span> Import Pricelist</button></div>',
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
        <div style="position: relative; max-width: 280px; width: 100%;">
          <input
            type="text"
            id="directory-search-input"
            class="form-input"
            style="width: 100%; padding-right: 2rem;"
            placeholder="Search \${directoryTabLabel(directoryActiveTab).toLowerCase()}..."
            value="\${directorySearch}"
            oninput="handleDirectorySearchInput(this.value)"
          />
          <button
            id="directory-search-clear-btn"
            type="button"
            onclick="clearDirectorySearch()"
            style="display: \${directorySearch ? 'inline-block' : 'none'}; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; background: transparent; color: #94a3b8; font-size: 0.9rem; cursor: pointer; padding: 0.2rem; line-height: 1;"
            title="Clear search"
          >✕</button>
        </div>
      </div>
      \${(directoryActiveTab === 'products' || directoryActiveTab === 'pricelist') ? '<div id="directory-category-tabs" style="padding: 0 1.35rem 1rem;"></div>' : ''}
      <div id="directory-table-wrap" style="padding: 0 1.35rem 0.5rem;"></div>
    </div>
  \`;
  if (directoryActiveTab === 'products' || directoryActiveTab === 'pricelist') renderProductCategoryTabs();
  renderDirectoryTable();
}

// Category sub-navigation for Products and Price List tabs
function renderProductCategoryTabs() {
  const wrap = document.getElementById('directory-category-tabs');
  if (!wrap) return;

  const countFor = (catName) => state.products.filter((p) => p.category === catName).length;
  const labelPrefix = directoryActiveTab === 'pricelist' ? 'All Items' : 'All Products';

  const pills = [
    { key: 'all', label: labelPrefix, count: state.products.length },
    ...state.productCategories.map((c) => ({ key: c.name, label: c.name, count: countFor(c.name) })),
  ];

  const pillsHtml = pills.map((p) => {
    const active = productsCategoryTab === p.key;
    return \`
      <button type="button" onclick="productsCategoryTab = '\${p.key.replace(/'/g, "\\\\'")}'; directoryVisibleCount = 50; renderProductCategoryTabs(); renderDirectoryTable();" style="padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid \${active ? 'var(--primary)' : 'var(--border-color)'}; background: \${active ? 'var(--primary)' : '#f8fafc'}; color: \${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        \${p.label} <span style="opacity: 0.75;">(\${p.count})</span>
      </button>
    \`;
  }).join('');

  wrap.innerHTML = \`
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
      \${pillsHtml}
      \${can('directory', 'create') || can('inventory', 'create') ? '<button type="button" onclick="openAddCategoryModal()" style="padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px dashed var(--border-color); background: transparent; color: #64748b; cursor: pointer;">+ Add Category</button>' : ''}
    </div>
  \`;
}

function getDirectoryFilteredTotal() {
  const q = directorySearch.trim().toLowerCase();
  if (directoryActiveTab === 'customers') {
    return state.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)).length;
  }
  if (directoryActiveTab === 'products' || directoryActiveTab === 'pricelist') {
    return state.products.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchesCategory = productsCategoryTab === 'all' || p.category === productsCategoryTab;
      return matchesQuery && matchesCategory;
    }).length;
  }
  if (directoryActiveTab === 'suppliers') {
    return state.vendors.filter((v) => !q || v.name.toLowerCase().includes(q) || v.vendorCode.toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q)).length;
  }
  return 0;
}

function handleDirectorySmartScroll(el) {
  const pill = document.getElementById('directory-scroll-pill');
  if (pill) {
    if (el.scrollTop > 120) {
      pill.style.display = 'flex';
    } else {
      pill.style.display = 'none';
    }
  }

  // Auto load next chunk when within 250px of bottom
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 250) {
    directoryLoadMoreRows();
  }
}

function directoryLoadMoreRows() {
  const total = getDirectoryFilteredTotal();
  if (directoryVisibleCount < total) {
    directoryVisibleCount += DIRECTORY_CHUNK_SIZE;
    const viewport = document.getElementById('directory-scroll-viewport');
    const prevScroll = viewport ? viewport.scrollTop : 0;
    renderDirectoryTable(true);
    const newViewport = document.getElementById('directory-scroll-viewport');
    if (newViewport) newViewport.scrollTop = prevScroll;
  }
}

function directoryLoadAllRows() {
  const total = getDirectoryFilteredTotal();
  directoryVisibleCount = total;
  renderDirectoryTable(true);
}

function scrollDirectoryToTop() {
  const viewport = document.getElementById('directory-scroll-viewport');
  if (viewport) {
    viewport.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function renderDirectoryTable(keepScroll = false) {
  const wrap = document.getElementById('directory-table-wrap');
  if (!wrap) return;
  const q = directorySearch.trim().toLowerCase();

  let prevScroll = 0;
  if (keepScroll) {
    const el = document.getElementById('directory-scroll-viewport');
    if (el) prevScroll = el.scrollTop;
  }

  let tableHeaderHtml = '';
  let tbodyHtml = '';
  let footerSubtext = '';
  let allRowsCount = 0;
  let visibleRowsCount = 0;

  if (directoryActiveTab === 'customers') {
    const filteredRows = state.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
    const allRows = sortDirectoryRows(filteredRows);
    allRowsCount = allRows.length;
    const rows = allRows.slice(0, directoryVisibleCount);
    visibleRowsCount = rows.length;

    tableHeaderHtml = \`<thead><tr>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('customerCode')" title="Sort by Customer Code">Customer Code \${directorySortIndicator('customerCode')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('name')" title="Sort by Name">Name \${directorySortIndicator('name')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('email')" title="Sort by Email">Email \${directorySortIndicator('email')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('createdAt')" title="Sort by Date Added">Added \${directorySortIndicator('createdAt')}</th>
    </tr></thead>\`;
    tbodyHtml = rows.map((c) => \`
      <tr>
        <td><strong>\${c.customerCode}</strong></td>
        <td>\${c.name}</td>
        <td>\${c.email || '<span style="color: #94a3b8;">—</span>'}</td>
        <td>\${new Date(c.createdAt).toLocaleDateString()}</td>
      </tr>
    \`).join('') || '<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 2rem;">No customers found.</td></tr>';
  } else if (directoryActiveTab === 'products') {
    if (productsCategoryTab !== 'all' && !state.productCategories.some((c) => c.name === productsCategoryTab)) {
      productsCategoryTab = 'all';
    }
    const filteredRows = state.products.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchesCategory = productsCategoryTab === 'all' || p.category === productsCategoryTab;
      return matchesQuery && matchesCategory;
    });
    const allRows = sortDirectoryRows(filteredRows);
    allRowsCount = allRows.length;
    const rows = allRows.slice(0, directoryVisibleCount);
    visibleRowsCount = rows.length;

    tableHeaderHtml = \`<thead><tr>
      <th class="sortable-th" style="width: 130px; cursor: pointer; user-select: none;" onclick="setDirectorySort('sku')" title="Sort by SKU">SKU \${directorySortIndicator('sku')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('name')" title="Sort by Name">Product Name \${directorySortIndicator('name')}</th>
      <th class="sortable-th" style="width: 170px; cursor: pointer; user-select: none;" onclick="setDirectorySort('category')" title="Sort by Category">Category \${directorySortIndicator('category')}</th>
      <th class="sortable-th" style="width: 90px; cursor: pointer; user-select: none;" onclick="setDirectorySort('unitOfMeasure')" title="Sort by UOM">UOM \${directorySortIndicator('unitOfMeasure')}</th>
      <th class="sortable-th" style="width: 140px; cursor: pointer; user-select: none;" onclick="setDirectorySort('costPriceCents')" title="Sort by Cost Price">Cost Price \${directorySortIndicator('costPriceCents')}</th>
      <th style="width: 140px; text-align: right;"></th>
    </tr></thead>\`;
    tbodyHtml = rows.map((p) => \`
      <tr>
        <td><strong style="font-family: monospace;">\${p.sku}</strong></td>
        <td><strong>\${p.name}</strong></td>
        <td><span class="badge badge-neutral" style="font-size: 0.74rem;">\${p.category || '—'}</span></td>
        <td>\${p.unitOfMeasure}</td>
        <td>\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.75rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8;">Not purchased yet</span>'}</td>
        <td style="text-align: right;"><button class="btn btn-secondary btn-sm" onclick="openChangeCategoryModal('\${p.id}', '\${p.name.replace(/'/g, "\\\\'")}', '\${(p.category || '').replace(/'/g, "\\\\'")}')">Change Category</button></td>
      </tr>
    \`).join('') || '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">No products found.</td></tr>';

    footerSubtext = '<p style="padding: 0.75rem 0 1rem; font-size: 0.78rem; color: #94a3b8;">Selling prices are managed on the Price List tab. Stock levels, valuation, and movement history live in Inventory & Stock.</p>';
  } else if (directoryActiveTab === 'pricelist') {
    if (productsCategoryTab !== 'all' && !state.productCategories.some((c) => c.name === productsCategoryTab)) {
      productsCategoryTab = 'all';
    }
    const filteredRows = state.products.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchesCategory = productsCategoryTab === 'all' || p.category === productsCategoryTab;
      return matchesQuery && matchesCategory;
    });
    const allRows = sortDirectoryRows(filteredRows);
    allRowsCount = allRows.length;
    const rows = allRows.slice(0, directoryVisibleCount);
    visibleRowsCount = rows.length;

    tableHeaderHtml = \`<thead><tr>
      <th class="sortable-th" style="width: 130px; cursor: pointer; user-select: none;" onclick="setDirectorySort('sku')" title="Sort by SKU">SKU \${directorySortIndicator('sku')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('name')" title="Sort by Name">Product Name \${directorySortIndicator('name')}</th>
      <th class="sortable-th" style="width: 170px; cursor: pointer; user-select: none;" onclick="setDirectorySort('category')" title="Sort by Category">Category \${directorySortIndicator('category')}</th>
      <th class="sortable-th" style="width: 140px; cursor: pointer; user-select: none;" onclick="setDirectorySort('costPriceCents')" title="Sort by Cost Price">Cost Price \${directorySortIndicator('costPriceCents')}</th>
      <th class="sortable-th" style="width: 150px; cursor: pointer; user-select: none;" onclick="setDirectorySort('sellingPriceCents')" title="Sort by Selling Price">Selling Price \${directorySortIndicator('sellingPriceCents')}</th>
      <th style="width: 120px; text-align: right;"></th>
    </tr></thead>\`;
    tbodyHtml = rows.map((p) => \`
      <tr>
        <td><strong style="font-family: monospace;">\${p.sku}</strong></td>
        <td><strong>\${p.name}</strong></td>
        <td><span class="badge badge-neutral" style="font-size: 0.74rem;">\${p.category || '—'}</span></td>
        <td>\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.75rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8;">Not purchased yet</span>'}</td>
        <td style="font-weight: 700; font-family: monospace; color: #0f172a;">\${p.sellingPriceCents > 0 ? formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency) : '<span style="color: #94a3b8; font-weight: normal;">Not set</span>'}</td>
        <td style="text-align: right;"><button class="btn btn-secondary btn-sm" onclick="openSetPriceModal('\${p.id}', '\${p.name.replace(/'/g, "\\\\'")}', \${p.sellingPriceCents}, '\${p.sellingPriceCurrency}')">Set Price</button></td>
      </tr>
    \`).join('') || '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">No products found.</td></tr>';

    footerSubtext = '<p style="padding: 0.75rem 0 1rem; font-size: 0.78rem; color: #94a3b8;">Selling prices set here are what Sales Invoices quote customers.</p>';
  } else if (directoryActiveTab === 'suppliers') {
    const filteredRows = state.vendors.filter((v) => !q || v.name.toLowerCase().includes(q) || v.vendorCode.toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q));
    const allRows = sortDirectoryRows(filteredRows);
    allRowsCount = allRows.length;
    const rows = allRows.slice(0, directoryVisibleCount);
    visibleRowsCount = rows.length;

    tableHeaderHtml = \`<thead><tr>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('vendorCode')" title="Sort by Vendor Code">Vendor Code \${directorySortIndicator('vendorCode')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('name')" title="Sort by Name">Name \${directorySortIndicator('name')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('email')" title="Sort by Email">Email \${directorySortIndicator('email')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('paymentTermsDays')" title="Sort by Payment Terms">Payment Terms \${directorySortIndicator('paymentTermsDays')}</th>
    </tr></thead>\`;
    tbodyHtml = rows.map((v) => \`
      <tr>
        <td><strong>\${v.vendorCode}</strong></td>
        <td>\${v.name}</td>
        <td>\${v.email || '<span style="color: #94a3b8;">—</span>'}</td>
        <td>\${v.paymentTermsDays} days</td>
      </tr>
    \`).join('') || '<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 2rem;">No suppliers found.</td></tr>';
  }

  const hasMore = visibleRowsCount < allRowsCount;
  const bottomLoader = hasMore
    ? \`<tr><td colspan="10" style="text-align: center; color: #64748b; font-size: 0.8rem; padding: 0.85rem; background: #f8fafc; font-weight: 500;">
        Showing \${visibleRowsCount} of \${allRowsCount} items.
        <span style="color: #cbd5e1; margin: 0 0.5rem;">•</span>
        <a href="javascript:void(0)" onclick="directoryLoadMoreRows()" style="color: var(--primary); font-weight: 600; text-decoration: none; margin-right: 0.75rem;">Load next \${Math.min(DIRECTORY_CHUNK_SIZE, allRowsCount - visibleRowsCount)}</a>
        <a href="javascript:void(0)" onclick="directoryLoadAllRows()" style="color: #64748b; font-weight: 500; text-decoration: underline;">Load all \${allRowsCount}</a>
      </td></tr>\`
    : (allRowsCount > 25 ? \`<tr><td colspan="10" style="text-align: center; color: #94a3b8; font-size: 0.74rem; padding: 0.65rem;">✓ All \${allRowsCount} items loaded</td></tr>\` : '');

  wrap.innerHTML = \`
    <div class="directory-smart-scroll-container">
      <div id="directory-scroll-viewport" class="directory-smart-scroll" onscroll="handleDirectorySmartScroll(this)">
        <table class="data-table">
          \${tableHeaderHtml}
          <tbody>
            \${tbodyHtml}
            \${bottomLoader}
          </tbody>
        </table>
      </div>
      <div id="directory-scroll-pill" class="directory-scroll-pill" onclick="scrollDirectoryToTop()" style="display: \${prevScroll > 120 ? 'flex' : 'none'};" title="Scroll back to top">
        <span id="directory-scroll-counter">\${visibleRowsCount} of \${allRowsCount}</span>
        <span style="opacity: 0.75; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em;">Top</span>
        <span class="directory-scroll-top-arrow">↑</span>
      </div>
    </div>
    \${footerSubtext}
  \`;

  if (keepScroll) {
    const el = document.getElementById('directory-scroll-viewport');
    if (el) el.scrollTop = prevScroll;
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

// ---- Import Pricelist & Products from Excel ----

let importPricelistState = {
  file: null,
  fileName: '',
  fileSize: '',
  sheets: [],
  activeSheetIdx: 0,
  searchFilter: '',
  isSubmitting: false,
};

function openImportPricelistModal() {
  importPricelistState = {
    file: null,
    fileName: '',
    fileSize: '',
    sheets: [],
    activeSheetIdx: 0,
    searchFilter: '',
    isSubmitting: false,
  };
  renderImportPricelistModal();
}

function renderImportPricelistModal() {
  const { sheets, activeSheetIdx, fileName, fileSize, isSubmitting, searchFilter } = importPricelistState;

  if (!sheets || sheets.length === 0) {
    // 1. Initial State: Upload / Drag & Drop
    const body = \`
      <div style="padding: 1rem 0;">
        <div
          id="pricelist-dropzone"
          style="border: 2px dashed var(--border-color); border-radius: 12px; padding: 3rem 1.5rem; text-align: center; background: #f8fafc; cursor: pointer; transition: var(--transition);"
          onclick="document.getElementById('pricelist-file-input').click()"
          ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'; this.style.background='#eff6ff';"
          ondragleave="this.style.borderColor='var(--border-color)'; this.style.background='#f8fafc';"
          ondrop="handlePricelistDrop(event)"
        >
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">📊</div>
          <div style="font-weight: 700; font-size: 1.15rem; color: #0f172a; margin-bottom: 0.35rem;">
            Click to select or drag & drop your Excel Pricelist
          </div>
          <p style="font-size: 0.88rem; color: #64748b; max-width: 480px; margin: 0 auto 1.25rem;">
            Upload your spreadsheet (e.g. <code>PRICELIST.xlsx</code>). The system automatically detects sheets, products, multi-line descriptions, spare parts, and pricing tiers.
          </p>
          <button type="button" class="btn btn-primary" onclick="event.stopPropagation(); document.getElementById('pricelist-file-input').click()">
            Select Excel / CSV File
          </button>
          <input
            type="file"
            id="pricelist-file-input"
            accept=".xlsx,.xls,.csv"
            style="display: none;"
            onchange="handlePricelistFileSelect(event)"
          />
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 1.25rem; font-size: 0.8rem; color: #64748b;">
          <div style="flex: 1; background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem;">
            <strong>✨ Multi-line Name Detection:</strong> Automatically connects continuation rows (e.g. radiation shields, consoles) into full product names.
          </div>
          <div style="flex: 1; background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem;">
            <strong>📑 Intelligent Category Mapping:</strong> Maps <code>AWS</code> to Weather Station, <code>PARTS</code> to Spare Parts, or custom sheet categories.
          </div>
          <div style="flex: 1; background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem;">
            <strong>💵 Smart Pricelist Resolution:</strong> Detects 2026/2025/base selling prices in PHP and manufacturer Davis prices in USD.
          </div>
        </div>
      </div>
    \`;
    const footer = \`<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>\`;
    openModal('Import Products & Price List', body, footer, 'xl');
    return;
  }

  // 2. Active State: Sheets & Product Preview
  const activeSheet = sheets[activeSheetIdx] || sheets[0];
  const q = (searchFilter || '').trim().toLowerCase();

  // Compute totals across all selected sheets
  let totalProducts = 0;
  let newProductsCount = 0;
  let updateProductsCount = 0;

  const existingSkuSet = new Set((state.products || []).map((p) => (p.sku || '').toUpperCase()));

  sheets.forEach((s) => {
    if (!s.selected) return;
    s.products.forEach((p) => {
      totalProducts++;
      if (existingSkuSet.has(p.sku.toUpperCase())) {
        updateProductsCount++;
      } else {
        newProductsCount++;
      }
    });
  });

  // Filter products for active sheet
  const displayProducts = activeSheet.products.filter((p) => {
    if (!q) return true;
    return (
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.section && p.section.toLowerCase().includes(q))
    );
  });

  // Sheet navigation pills
  const sheetTabsHtml = sheets.map((s, idx) => {
    const isActive = idx === activeSheetIdx;
    return \`
      <div style="display: inline-flex; align-items: center; background: \${isActive ? '#eff6ff' : '#f8fafc'}; border: 1px solid \${isActive ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 8px; padding: 0.35rem 0.65rem; gap: 0.5rem;">
        <input
          type="checkbox"
          id="sheet-cb-\${idx}"
          \${s.selected ? 'checked' : ''}
          onchange="toggleImportSheet(\${idx}, this.checked)"
          style="cursor: pointer;"
        />
        <button
          type="button"
          onclick="setImportActiveSheet(\${idx})"
          style="border: none; background: transparent; font-weight: \${isActive ? '700' : '500'}; color: \${isActive ? 'var(--primary)' : 'var(--text-main)'}; cursor: pointer; padding: 0; font-size: 0.85rem;"
        >
          \${s.name} <span style="font-size: 0.75rem; opacity: 0.8; font-weight: 600;">(\${s.products.length})</span>
        </button>
      </div>
    \`;
  }).join('');

  // Category options for active sheet
  const categoryOptions = state.productCategories.map((cat) => \`
    <option value="\${cat.name}" \${cat.name.toLowerCase() === (activeSheet.category || '').toLowerCase() ? 'selected' : ''}>\${cat.name}</option>
  \`).join('');

  const body = \`
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <!-- File Information & Summary Bar -->
      <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.65rem 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.25rem;">📄</span>
          <div>
            <strong style="font-size: 0.88rem; color: #0f172a;">\${fileName}</strong>
            <span style="font-size: 0.78rem; color: #64748b; margin-left: 0.4rem;">(\${fileSize})</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('pricelist-file-input').click()" style="margin-left: 0.5rem; font-size: 0.75rem; padding: 0.2rem 0.5rem;">Change File</button>
          <input type="file" id="pricelist-file-input" accept=".xlsx,.xls,.csv" style="display: none;" onchange="handlePricelistFileSelect(event)" />
        </div>
        <div style="display: flex; gap: 0.6rem; align-items: center;">
          <span class="badge" style="background: #e2e8f0; color: #334155; font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 600;">
            📦 \${totalProducts} Selected
          </span>
          <span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 600;">
            ✨ \${newProductsCount} New
          </span>
          <span class="badge" style="background: #e0f2fe; color: #075985; font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 600;">
            🔄 \${updateProductsCount} Updates
          </span>
        </div>
      </div>

      <!-- Sheet Tabs Selection -->
      <div>
        <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 0.4rem;">
          Detected Sheets (Check sheets to include in import):
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          \${sheetTabsHtml}
        </div>
      </div>

      <!-- Active Sheet Configuration Settings -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.82rem; font-weight: 600; color: #334155;">Target Category:</label>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              <select
                id="active-sheet-category-select"
                class="form-select"
                style="padding: 0.3rem 0.6rem; font-size: 0.82rem; min-width: 170px;"
                onchange="changeImportSheetCategory(\${activeSheetIdx}, this.value)"
              >
                \${categoryOptions}
              </select>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onclick="quickAddCategoryForImport('active-sheet-category-select', \${activeSheetIdx})"
                style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"
                title="Create a new category"
              >
                + New
              </button>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.82rem; font-weight: 600; color: #334155;">Price Tier:</label>
            <select
              class="form-select"
              style="padding: 0.3rem 0.6rem; font-size: 0.82rem;"
              onchange="changeImportSheetStrategy(\${activeSheetIdx}, this.value)"
            >
              <option value="latest" \${activeSheet.priceStrategy === 'latest' ? 'selected' : ''}>Latest Active (2026 → 2025 → Base)</option>
              <option value="base" \${activeSheet.priceStrategy === 'base' ? 'selected' : ''}>Base Selling Price</option>
              <option value="2026" \${activeSheet.priceStrategy === '2026' ? 'selected' : ''}>Selling Price 2026 Only</option>
              <option value="2025" \${activeSheet.priceStrategy === '2025' ? 'selected' : ''}>Selling Price 2025 Only</option>
            </select>
          </div>
        </div>

        <div>
          <input
            type="text"
            class="form-input"
            style="padding: 0.3rem 0.75rem; font-size: 0.82rem; width: 220px;"
            placeholder="Filter in \${activeSheet.name}..."
            value="\${searchFilter}"
            oninput="importPricelistState.searchFilter = this.value; renderImportPricelistModal();"
          />
        </div>
      </div>

      <!-- Live Preview Table -->
      <div style="border: 1px solid var(--border-color); border-radius: 8px; max-height: 380px; overflow-y: auto; background: #ffffff;">
        <table class="data-table" style="margin: 0; width: 100%; border-collapse: collapse;">
          <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 2; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <tr>
              <th style="width: 75px; padding: 0.6rem 0.75rem;">Status</th>
              <th style="width: 110px; padding: 0.6rem 0.75rem;">SKU / P.N.</th>
              <th style="padding: 0.6rem 0.75rem;">Product Name</th>
              <th style="width: 140px; padding: 0.6rem 0.75rem;">Category</th>
              <th style="width: 130px; text-align: right; padding: 0.6rem 0.75rem;">Selling Price (PHP)</th>
              <th style="width: 120px; text-align: right; padding: 0.6rem 0.75rem;">Cost / Davis ($)</th>
            </tr>
          </thead>
          <tbody>
            \${
              displayProducts.map((p) => {
                const isExisting = existingSkuSet.has(p.sku.toUpperCase());
                const statusBadge = isExisting
                  ? '<span class="badge" style="background: #e0f2fe; color: #075985; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px;">UPDATE</span>'
                  : '<span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px;">NEW</span>';

                const priceDisplay = p.sellingPrice > 0
                  ? formatCurrency(Math.round(p.sellingPrice * 100), 'PHP')
                  : '<span style="color: #94a3b8; font-size: 0.8rem;">—</span>';

                const davisDisplay = p.davisPriceUSD > 0
                  ? formatCurrency(Math.round(p.davisPriceUSD * 100), 'USD')
                  : '<span style="color: #94a3b8; font-size: 0.8rem;">—</span>';

                return \`
                  <tr>
                    <td style="padding: 0.55rem 0.75rem;">\${statusBadge}</td>
                    <td style="padding: 0.55rem 0.75rem;"><strong style="font-family: monospace; color: #0f172a; font-size: 0.84rem;">\${p.sku}</strong></td>
                    <td style="padding: 0.55rem 0.75rem;">
                      <div style="font-weight: 600; color: #0f172a; font-size: 0.84rem;">\${p.name}</div>
                      \${p.section ? '<div style="font-size: 0.72rem; color: #64748b;">Section: ' + p.section + '</div>' : ''}
                    </td>
                    <td style="padding: 0.55rem 0.75rem;"><span class="badge badge-neutral" style="font-size: 0.74rem;">\${activeSheet.category || p.category}</span></td>
                    <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 700; font-family: monospace; font-size: 0.84rem; color: #0f172a;">\${priceDisplay}</td>
                    <td style="padding: 0.55rem 0.75rem; text-align: right; font-family: monospace; font-size: 0.82rem; color: #64748b;">\${davisDisplay}</td>
                  </tr>
                \`;
              }).join('') ||
              '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">No matching products found in this sheet.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  \`;

  const footer = isSubmitting
    ? \`
      <div style="display: flex; align-items: center; gap: 0.75rem; color: var(--primary); font-weight: 600; font-size: 0.88rem;">
        <span style="width: 18px; height: 18px; border: 2px solid #cbd5e1; border-top-color: var(--primary); border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite;"></span>
        Importing \${totalProducts} products and updating price lists...
      </div>
    \`
    : \`
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button
        class="btn btn-primary"
        onclick="executeBatchImport()"
        \${totalProducts === 0 ? 'disabled' : ''}
        style="display: inline-flex; align-items: center; gap: 0.4rem;"
      >
        <span>📥</span> Import \${totalProducts} Product\${totalProducts === 1 ? '' : 's'}
      </button>
    \`;

  openModal('Import Products & Price List', body, footer, 'xl');
}

function handlePricelistDrop(e) {
  e.preventDefault();
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length > 0) {
    processPricelistFile(dt.files[0]);
  }
}

function handlePricelistFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (file) {
    processPricelistFile(file);
  }
}

function processPricelistFile(file) {
  if (!file) return;

  if (typeof window.XLSX === 'undefined') {
    showToast('Loading spreadsheet parser... Please try again in a moment.', 'info');
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => processPricelistFile(file);
    s.onerror = () => showToast('Failed to load XLSX engine from CDN.', 'danger');
    document.head.appendChild(s);
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = window.XLSX.read(data, { type: 'array' });
      const parsedSheets = parseExcelWorkbook(wb);

      if (!parsedSheets || parsedSheets.length === 0) {
        showToast('No valid product sheets or part numbers detected in this file.', 'warning');
        return;
      }

      importPricelistState.file = file;
      importPricelistState.fileName = file.name;
      importPricelistState.fileSize = (file.size / 1024).toFixed(1) + ' KB';
      importPricelistState.sheets = parsedSheets;
      importPricelistState.activeSheetIdx = 0;
      importPricelistState.searchFilter = '';

      renderImportPricelistModal();
      showToast('Detected ' + parsedSheets.length + ' sheets with products.', 'success');
    } catch (err) {
      console.error('Error parsing Excel file:', err);
      showToast('Error reading spreadsheet: ' + err.message, 'danger');
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseExcelWorkbook(wb) {
  const parsedSheets = [];

  for (let sIdx = 0; sIdx < wb.SheetNames.length; sIdx++) {
    const rawSheetName = wb.SheetNames[sIdx];
    const sName = (rawSheetName || '').trim();
    const sheet = wb.Sheets[rawSheetName];
    if (!sheet) continue;

    // header: 1 returns array of row arrays
    const grid = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (!grid || !grid.length) continue;

    // Detect default category
    let defaultCategory = 'Weather Station';
    const upperSheet = sName.toUpperCase();
    if (upperSheet.includes('AWS')) {
      defaultCategory = 'Weather Station';
    } else if (upperSheet.includes('PART')) {
      defaultCategory = 'Spare Parts';
    } else if (upperSheet.includes('GOV')) {
      defaultCategory = 'Government';
    } else {
      defaultCategory = sName.charAt(0).toUpperCase() + sName.slice(1);
    }

    // Match against any existing product category ignoring case
    const matchCat = (state.productCategories || []).find(
      (c) => c.name.toLowerCase() === defaultCategory.toLowerCase()
    );
    if (matchCat) defaultCategory = matchCat.name;

    // Locate header row
    let headerRowIdx = -1;
    let pnCol = -1;
    let sellingPriceCols = {};
    let davisPriceCol = -1;
    let nameCol = 0;

    for (let r = 0; r < Math.min(12, grid.length); r++) {
      const row = grid[r] || [];
      for (let c = 0; c < row.length; c++) {
        const valStr = String(row[c] || '').trim().toUpperCase();
        if (['P.N.', 'P.N', 'PN', 'PART NO', 'PART NO.', 'PART NUMBER', 'SKU', 'ITEM CODE'].includes(valStr)) {
          pnCol = c;
          headerRowIdx = r;
        } else if (valStr.includes('SELLING PRICE') || valStr === 'PRICE' || valStr === 'SRP') {
          sellingPriceCols[valStr] = c;
        } else if (valStr.includes('DAVIS') || valStr.includes('COST')) {
          davisPriceCol = c;
        }
      }
      if (pnCol >= 0) break;
    }

    // Fallback if header didn't have exact P.N. string: check if col 1 has alphanumeric short codes
    if (pnCol < 0) {
      for (let r = 0; r < Math.min(10, grid.length); r++) {
        const row = grid[r] || [];
        if (row[1] && String(row[1]).trim().match(/^[0-9]{4}[A-Z0-9]*$/i)) {
          pnCol = 1;
          headerRowIdx = r > 0 ? r - 1 : 0;
          break;
        }
      }
    }

    if (pnCol < 0) continue;

    const sheetProducts = [];
    let currentSection = '';
    let prevProduct = null;
    let lastBaseName = '';

    for (let r = headerRowIdx + 1; r < grid.length; r++) {
      const row = grid[r] || [];
      const rawColA = String(row[nameCol] || '');
      const colA = rawColA.trim();
      let pn = String(row[pnCol] || '').trim();

      // Check if row has any price values
      let hasPrices = false;
      const allPriceCols = [...Object.values(sellingPriceCols), ...(davisPriceCol >= 0 ? [davisPriceCol] : [])];
      for (const pCol of allPriceCols) {
        const val = String(row[pCol] || '').trim();
        if (val && val !== '0' && val !== '0.00' && val !== '.') {
          hasPrices = true;
          break;
        }
      }

      // Empty spacer row
      if (!colA && !pn && !hasPrices) {
        continue;
      }

      // Continuation check
      const hasLeadingSpace = rawColA.startsWith(' ') || rawColA.startsWith('\t');
      const lowerA = colA.toLowerCase();
      const startsWithCont = (
        lowerA.startsWith('with ') ||
        lowerA.startsWith('w/') ||
        lowerA.startsWith('w/o') ||
        lowerA.startsWith('for ') ||
        lowerA.startsWith('and ') ||
        lowerA.startsWith('+') ||
        lowerA.startsWith('&') ||
        lowerA.startsWith('24-hour') ||
        lowerA.startsWith('24 hr')
      );
      const isContinuation = (
        prevProduct !== null &&
        !pn &&
        !hasPrices &&
        colA.length > 0 &&
        (hasLeadingSpace || startsWithCont || (colA[0] >= 'a' && colA[0] <= 'z'))
      );

      if (isContinuation) {
        prevProduct.name = (prevProduct.name + ' ' + colA).replace(/\s+/g, ' ').trim();
        continue;
      }

      // Section header check
      if (!pn && !hasPrices && colA.length > 0) {
        currentSection = colA;
        prevProduct = null;
        continue;
      }

      // Product row
      if (pn) {
        // Clean float numbers like 7342.2349999999997 -> 7342.235
        if (/^\d+\.\d+$/.test(pn)) {
          const num = parseFloat(pn);
          pn = num.toFixed(3).replace(/\.?0+$/, '');
        }

        let prodName = colA || ('Part ' + pn);
        if (prodName.includes('"') && lastBaseName) {
          prodName = prodName.replace(/"/g, lastBaseName).trim();
        } else if (prodName) {
          const wIdx = prodName.toLowerCase().indexOf(' w/');
          if (wIdx > 0) {
            lastBaseName = prodName.slice(0, wIdx).trim();
          } else {
            lastBaseName = prodName;
          }
        }

        let baseSellingPrice = 0;
        let price2025 = 0;
        let price2026 = 0;

        for (const [key, cIdx] of Object.entries(sellingPriceCols)) {
          const rawP = String(row[cIdx] || '').trim();
          if (!rawP) continue;
          const cleanP = parseFloat(rawP.replace(/[^0-9.]/g, ''));
          if (!isNaN(cleanP) && cleanP > 0) {
            if (key.includes('2026')) price2026 = cleanP;
            else if (key.includes('2025')) price2025 = cleanP;
            else baseSellingPrice = cleanP;
          }
        }

        const sellingPrice = price2026 || price2025 || baseSellingPrice;

        let davisPriceUSD = 0;
        if (davisPriceCol >= 0) {
          const rawD = String(row[davisPriceCol] || '').trim();
          if (rawD) {
            const cleanD = parseFloat(rawD.replace(/[^0-9.]/g, ''));
            if (!isNaN(cleanD) && cleanD > 0) davisPriceUSD = cleanD;
          }
        }

        const prodObj = {
          sku: pn.toUpperCase(),
          name: (prodName.replace(/\s+/g, ' ').trim()) || ('Part ' + pn),
          category: defaultCategory,
          section: currentSection,
          sellingPrice,
          baseSellingPrice,
          price2025,
          price2026,
          davisPriceUSD,
          sellingPriceCurrency: 'PHP',
          costPriceCurrency: 'USD',
        };

        sheetProducts.push(prodObj);
        prevProduct = prodObj;
      } else {
        prevProduct = null;
      }
    }

    if (sheetProducts.length > 0) {
      parsedSheets.push({
        name: sName,
        category: defaultCategory,
        selected: true,
        priceStrategy: 'latest',
        sellingPriceCols,
        hasDavisPrice: davisPriceCol >= 0,
        products: sheetProducts,
      });
    }
  }

  return parsedSheets;
}

function toggleImportSheet(idx, isChecked) {
  if (importPricelistState.sheets[idx]) {
    importPricelistState.sheets[idx].selected = isChecked;
    renderImportPricelistModal();
  }
}

function setImportActiveSheet(idx) {
  importPricelistState.activeSheetIdx = idx;
  importPricelistState.searchFilter = '';
  renderImportPricelistModal();
}

function changeImportSheetCategory(sheetIdx, newCategory) {
  const sheet = importPricelistState.sheets[sheetIdx];
  if (!sheet) return;
  sheet.category = newCategory;
  sheet.products.forEach((p) => {
    p.category = newCategory;
  });
  renderImportPricelistModal();
}

function changeImportSheetStrategy(sheetIdx, newStrategy) {
  const sheet = importPricelistState.sheets[sheetIdx];
  if (!sheet) return;
  sheet.priceStrategy = newStrategy;

  sheet.products.forEach((p) => {
    if (newStrategy === 'latest') {
      p.sellingPrice = p.price2026 || p.price2025 || p.baseSellingPrice;
    } else if (newStrategy === 'base') {
      p.sellingPrice = p.baseSellingPrice || p.price2025 || p.price2026;
    } else if (newStrategy === '2026') {
      p.sellingPrice = p.price2026 || p.baseSellingPrice;
    } else if (newStrategy === '2025') {
      p.sellingPrice = p.price2025 || p.baseSellingPrice;
    }
  });

  renderImportPricelistModal();
}

async function quickAddCategoryForImport(selectElId, sheetIdx) {
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

    changeImportSheetCategory(sheetIdx, json.data.name);
    showToast('Category "' + json.data.name + '" added and assigned', 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function executeBatchImport() {
  const selectedSheets = (importPricelistState.sheets || []).filter((s) => s.selected);
  if (!selectedSheets.length) {
    showToast('Please select at least one sheet to import.', 'warning');
    return;
  }

  const payloadProducts = [];
  selectedSheets.forEach((sheet) => {
    const cat = sheet.category || 'Other';
    sheet.products.forEach((p) => {
      payloadProducts.push({
        sku: p.sku,
        name: p.name,
        category: cat,
        sellingPriceCents: Math.round((p.sellingPrice || 0) * 100),
        sellingPriceCurrency: p.sellingPriceCurrency || 'PHP',
        costPriceCents: Math.round((p.davisPriceUSD || 0) * 100),
        costPriceCurrency: p.costPriceCurrency || 'USD',
        unitOfMeasure: 'unit',
        description: p.section ? 'Section: ' + p.section : undefined,
      });
    });
  });

  if (!payloadProducts.length) {
    showToast('No products to import in the selected sheets.', 'warning');
    return;
  }

  importPricelistState.isSubmitting = true;
  renderImportPricelistModal();

  try {
    const res = await apiFetch('/api/inventory/products/batch-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: payloadProducts }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to import products');
    }

    const { total, createdCount, updatedCount, categoriesCreated } = json.data;
    closeModal();

    let successMsg = 'Import complete: ' + total + ' products processed (' + createdCount + ' added, ' + updatedCount + ' updated)';
    if (categoriesCreated && categoriesCreated.length > 0) {
      successMsg += ' with ' + categoriesCreated.length + ' new categories';
    }
    showToast(successMsg, 'success');

    // Reload directory data
    await loadDirectory();
  } catch (err) {
    importPricelistState.isSubmitting = false;
    renderImportPricelistModal();
    showToast(err.message, 'danger');
  }
}
`;
