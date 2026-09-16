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
        min-width: 100%;
        margin: 0;
      }
      .directory-smart-scroll th,
      .directory-smart-scroll td {
        vertical-align: middle;
      }
      .directory-smart-scroll thead th {
        position: sticky;
        top: 0;
        z-index: 10;
        background: #f8fafc;
        border-bottom: 2px solid var(--border-color);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        transition: background-color 0.15s ease;
        padding: 0.75rem 1rem;
      }
      .directory-smart-scroll thead th.sortable-th:hover {
        background: #f1f5f9;
      }
      .directory-smart-scroll td {
        border-bottom: 1px solid var(--border-color);
        padding: 0.75rem 1rem;
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
      @media (max-width: 768px) {
        .directory-panel-inner {
          padding-left: 0.75rem !important;
          padding-right: 0.75rem !important;
        }
        .directory-search-box {
          max-width: 100% !important;
        }
      }
      @media (max-width: 480px) {
        .directory-panel-inner {
          padding-left: 0.5rem !important;
          padding-right: 0.5rem !important;
        }
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
      <button type="button" class="category-pill-btn \${active ? 'active' : ''}" onclick="switchDirectoryTab('\${tab}')">
        <span>\${directoryTabLabel(tab)}</span>
        <span class="pill-count">\${directoryTabCount(tab)}</span>
      </button>
    \`;
  }).join('');

  const canManageCatalog = can('directory', 'create') || can('inventory', 'create');
  const addButton = canManageCatalog
    ? {
        customers: '<div style="display: flex; gap: 0.5rem;"><button class="btn btn-secondary btn-sm" onclick="openImportCustomersModal()" style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="font-size: 0.95rem;">📥</span> Import Excel</button><button class="btn btn-primary btn-sm" onclick="openNewCustomerModal()">+ Add Customer</button></div>',
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
      <p class="directory-panel-inner" style="padding: 0 1.35rem 1rem; font-size: 0.85rem; color: #64748b;">
        The single source of truth for customers, products, and suppliers — referenced by Purchasing, Inbound, and Sales, but managed here.
      </p>
      <div class="directory-panel-inner" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 1.35rem 1rem; flex-wrap: wrap;">
        <div class="category-pills-strip" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">\${tabsHtml}</div>
        <div class="directory-search-box" style="position: relative; max-width: 280px; width: 100%;">
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
      \${(directoryActiveTab === 'products' || directoryActiveTab === 'pricelist') ? '<div id="directory-category-tabs" class="directory-panel-inner" style="padding: 0 1.35rem 1rem;"></div>' : ''}
      <div id="directory-table-wrap" class="directory-panel-inner" style="padding: 0 1.35rem 0.5rem;"></div>
    </div>
  \`;
  if (directoryActiveTab === 'products' || directoryActiveTab === 'pricelist') renderProductCategoryTabs();
  renderDirectoryTable();
}

// Category sub-navigation for Products and Price List tabs
function setProductCategoryTab(key) {
  productsCategoryTab = key;
  directoryVisibleCount = 50;
  const strip = document.querySelector('#directory-category-tabs .category-pills-strip');
  const prevScroll = strip ? strip.scrollLeft : 0;
  renderProductCategoryTabs(prevScroll, key);
  renderDirectoryTable();
}

function renderProductCategoryTabs(savedScroll = null, activeKey = null) {
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
      <button
        type="button"
        class="category-pill-btn \${active ? 'active' : ''}"
        data-category-key="\${p.key}"
        onclick="setProductCategoryTab('\${p.key.replace(/'/g, "\\\\'")}')"
      >
        <span>\${p.label}</span>
        <span class="pill-count">\${p.count}</span>
      </button>
    \`;
  }).join('');

  wrap.innerHTML = \`
    <div class="category-pills-strip" style="border-top: 1px dashed var(--border-color); padding-top: 1rem;">
      \${pillsHtml}
      \${can('directory', 'create') || can('inventory', 'create') ? '<button type="button" class="category-pill-btn" onclick="openAddCategoryModal()" style="border-style: dashed; background: transparent; color: #64748b;">+ Add Category</button>' : ''}
    </div>
  \`;

  const strip = wrap.querySelector('.category-pills-strip');
  if (strip) {
    if (activeKey) {
      const activeBtn = strip.querySelector('button.active');
      if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
        activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else if (savedScroll !== null) {
        strip.scrollLeft = savedScroll;
      }
    } else if (savedScroll !== null) {
      strip.scrollLeft = savedScroll;
    }
  }
}

function getDirectoryFilteredTotal() {
  const q = directorySearch.trim().toLowerCase();
  if (directoryActiveTab === 'customers') {
    return state.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.taxId || '').toLowerCase().includes(q)).length;
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
    const filteredRows = state.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.taxId || '').toLowerCase().includes(q));
    const allRows = sortDirectoryRows(filteredRows);
    allRowsCount = allRows.length;
    const rows = allRows.slice(0, directoryVisibleCount);
    visibleRowsCount = rows.length;

    tableHeaderHtml = \`<thead><tr>
      <th class="sortable-th" style="cursor: pointer; user-select: none; width: 140px;" onclick="setDirectorySort('customerCode')" title="Sort by Customer Code">Customer Code \${directorySortIndicator('customerCode')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none;" onclick="setDirectorySort('name')" title="Sort by Name">Customer Name \${directorySortIndicator('name')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none; width: 170px;" onclick="setDirectorySort('taxId')" title="Sort by TIN Number">TIN Number \${directorySortIndicator('taxId')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none; width: 180px;" onclick="setDirectorySort('email')" title="Sort by Email">Email \${directorySortIndicator('email')}</th>
      <th class="sortable-th" style="cursor: pointer; user-select: none; width: 110px;" onclick="setDirectorySort('createdAt')" title="Sort by Date Added">Added \${directorySortIndicator('createdAt')}</th>
      <th style="width: 75px; text-align: center;">Actions</th>
    </tr></thead>\`;
    tbodyHtml = rows.map((c) => \`
      <tr>
        <td data-label="Customer Code"><strong>\${escapeHtml(c.customerCode)}</strong></td>
        <td data-label="Customer Name"><div style="font-weight: 600; color: var(--text-main);">\${escapeHtml(c.name)}</div></td>
        <td data-label="TIN Number">
          \${c.taxId ? '<span class="badge badge-secondary" style="font-family: monospace; font-size: 0.8rem; letter-spacing: 0.04em; background: #f1f5f9; color: #334155; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #e2e8f0;">' + escapeHtml(c.taxId) + '</span>' : '<span style="color: #94a3b8;">—</span>'}
        </td>
        <td data-label="Email">\${c.email ? '<span style="color: var(--text-muted); font-size: 0.85rem;">' + escapeHtml(c.email) + '</span>' : '<span style="color: #94a3b8;">—</span>'}</td>
        <td data-label="Added"><span style="font-size: 0.82rem; color: var(--text-muted);">\${new Date(c.createdAt).toLocaleDateString()}</span></td>
        <td data-label="Actions" class="td-actions" style="text-align: center;">
          <button class="btn btn-secondary btn-sm" onclick="openEditCustomerModal('\${c.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.76rem;" title="Edit Customer & TIN">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        </td>
      </tr>
    \`).join('') || '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2.5rem;">No customers found.</td></tr>';
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
      <th class="sortable-th" style="width: 110px; min-width: 100px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('sku')" title="Sort by SKU">SKU \${directorySortIndicator('sku')}</th>
      <th class="sortable-th" style="width: 360px; min-width: 340px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('name')" title="Sort by Name">Product Name \${directorySortIndicator('name')}</th>
      <th class="sortable-th" style="width: 160px; min-width: 140px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('category')" title="Sort by Category">Category \${directorySortIndicator('category')}</th>
      <th class="sortable-th" style="width: 75px; min-width: 65px; text-align: center; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('unitOfMeasure')" title="Sort by UOM">UOM \${directorySortIndicator('unitOfMeasure')}</th>
      <th class="sortable-th" style="width: 140px; min-width: 130px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('costPriceCents')" title="Sort by Cost Price">Cost Price \${directorySortIndicator('costPriceCents')}</th>
      <th style="width: 110px; text-align: right; white-space: nowrap;">Actions</th>
    </tr></thead>\`;
    tbodyHtml = rows.map((p) => \`
      <tr>
        <td data-label="SKU" style="white-space: nowrap;"><strong style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #334155;">\${p.sku}</strong></td>
        <td data-label="Product Name" style="width: 360px; min-width: 340px; max-width: 520px;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #64748b;" title="Product">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div style="min-width: 0; flex: 1;">
              <div style="font-weight: 600; color: #0f172a; font-size: 0.88rem; line-height: 1.35; word-break: normal;">
                \${p.name}
              </div>
              \${p.description && !p.description.startsWith('Section:') ? '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px;" title="' + (p.description || '').replace(/"/g, '&quot;') + '">' + p.description + '</div>' : ''}
            </div>
          </div>
        </td>
        <td data-label="Category" style="white-space: nowrap;"><span class="badge badge-neutral" style="font-size: 0.74rem;">\${p.category || '—'}</span></td>
        <td data-label="UOM" style="text-align: center; color: #64748b; font-size: 0.82rem; white-space: nowrap;">\${p.unitOfMeasure}</td>
        <td data-label="Cost Price" style="white-space: nowrap;">\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.72rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8; font-size: 0.8rem;">Not purchased yet</span>'}</td>
        <td data-label="Actions" class="td-actions" style="text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" onclick="openChangeCategoryModal('\${p.id}')" style="padding: 0.25rem 0.45rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center;" title="Change Category">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openEditProductModal('\${p.id}')" style="padding: 0.25rem 0.45rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center;" title="Edit Product">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="deleteProduct('\${p.id}')" style="padding: 0.25rem 0.45rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; color: #ef4444;" title="Delete Product">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    \`).join('') || '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">No products found.</td></tr>';

    footerSubtext = '<p style="padding: 0.75rem 0 1rem; font-size: 0.78rem; color: #94a3b8;">Selling prices are managed on the Price List tab. Stock levels and movement history live in Inventory & Stock.</p>';
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
      <th class="sortable-th" style="width: 110px; min-width: 100px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('sku')" title="Sort by SKU">SKU \${directorySortIndicator('sku')}</th>
      <th class="sortable-th" style="width: 360px; min-width: 340px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('name')" title="Sort by Name">Product Name \${directorySortIndicator('name')}</th>
      <th class="sortable-th" style="width: 160px; min-width: 140px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('category')" title="Sort by Category">Category \${directorySortIndicator('category')}</th>
      <th class="sortable-th" style="width: 140px; min-width: 130px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('costPriceCents')" title="Sort by Cost Price">Cost Price \${directorySortIndicator('costPriceCents')}</th>
      <th class="sortable-th" style="width: 150px; min-width: 140px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setDirectorySort('sellingPriceCents')" title="Sort by Selling Price">Selling Price \${directorySortIndicator('sellingPriceCents')}</th>
      <th style="width: 120px; text-align: right; white-space: nowrap;"></th>
    </tr></thead>\`;
    tbodyHtml = rows.map((p) => \`
      <tr>
        <td data-label="SKU" style="white-space: nowrap;"><strong style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #334155;">\${p.sku}</strong></td>
        <td data-label="Product Name" style="width: 360px; min-width: 340px; max-width: 520px;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #64748b;" title="Product">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div style="min-width: 0; flex: 1;">
              <div style="font-weight: 600; color: #0f172a; font-size: 0.88rem; line-height: 1.35; word-break: normal;">
                \${p.name}
              </div>
              \${p.description && !p.description.startsWith('Section:') ? '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px;" title="' + (p.description || '').replace(/"/g, '&quot;') + '">' + p.description + '</div>' : ''}
            </div>
          </div>
        </td>
        <td data-label="Category" style="white-space: nowrap;"><span class="badge badge-neutral" style="font-size: 0.74rem;">\${p.category || '—'}</span></td>
        <td data-label="Cost Price" style="white-space: nowrap;">\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.72rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8; font-size: 0.8rem;">Not purchased yet</span>'}</td>
        <td data-label="Selling Price" style="white-space: nowrap; font-weight: 700; font-family: monospace; color: #0f172a;">\${p.sellingPriceCents > 0 ? formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency) : '<span style="color: #94a3b8; font-weight: normal; font-size: 0.8rem;">Not set</span>'}</td>
        <td data-label="Actions" class="td-actions" style="text-align: right; white-space: nowrap;"><button class="btn btn-secondary btn-sm" onclick="openSetPriceModal('\${p.id}', '\${p.name.replace(/'/g, "\\\\'")}', \${p.sellingPriceCents}, '\${p.sellingPriceCurrency}')">Set Price</button></td>
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
        <td data-label="Vendor Code"><strong>\${v.vendorCode}</strong></td>
        <td data-label="Vendor Name">\${v.name}</td>
        <td data-label="Email">\${v.email || '<span style="color: #94a3b8;">—</span>'}</td>
        <td data-label="Payment Terms">\${v.paymentTermsDays} days</td>
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

// ---- Create & Edit Customer ----

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
        <label class="form-label">TIN Number (Tax ID)</label>
        <input type="text" id="nc-taxid" class="form-input" placeholder="e.g. 000-123-456-000" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="nc-email" class="form-input" placeholder="billing@client.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input type="text" id="nc-phone" class="form-input" placeholder="e.g. +63 917 123 4567" />
      </div>
      <div class="form-group">
        <label class="form-label">Billing Address</label>
        <input type="text" id="nc-address" class="form-input" placeholder="e.g. Makati City, Metro Manila" />
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
    customerCode: document.getElementById('nc-code').value.trim(),
    name: document.getElementById('nc-name').value.trim(),
    taxId: document.getElementById('nc-taxid').value.trim() || undefined,
    email: document.getElementById('nc-email').value.trim() || undefined,
    phone: document.getElementById('nc-phone').value.trim() || undefined,
    billingAddress: document.getElementById('nc-address').value.trim() || undefined,
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

function openEditCustomerModal(id) {
  const cust = (state.customers || []).find((c) => c.id === id);
  if (!cust) return;

  const body = \`
    <form id="form-edit-cust" onsubmit="submitEditCustomer(event, '\${cust.id}')">
      <div class="form-group">
        <label class="form-label">Customer Code *</label>
        <input type="text" id="ec-code" class="form-input" value="\${escapeHtml(cust.customerCode)}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Customer Name *</label>
        <input type="text" id="ec-name" class="form-input" value="\${escapeHtml(cust.name)}" required />
      </div>
      <div class="form-group">
        <label class="form-label">TIN Number (Tax ID)</label>
        <input type="text" id="ec-taxid" class="form-input" value="\${escapeHtml(cust.taxId || '')}" placeholder="e.g. 000-123-456-000" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="ec-email" class="form-input" value="\${escapeHtml(cust.email || '')}" placeholder="billing@client.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input type="text" id="ec-phone" class="form-input" value="\${escapeHtml(cust.phone || '')}" placeholder="e.g. +63 917 123 4567" />
      </div>
      <div class="form-group">
        <label class="form-label">Billing Address</label>
        <input type="text" id="ec-address" class="form-input" value="\${escapeHtml(cust.billingAddress || '')}" placeholder="e.g. Makati City, Metro Manila" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-edit-cust').requestSubmit()">Update Customer</button>
  \`;
  openModal('Edit Customer Details', body, footer);
}

async function submitEditCustomer(e, id) {
  e.preventDefault();
  const payload = {
    customerCode: document.getElementById('ec-code').value.trim(),
    name: document.getElementById('ec-name').value.trim(),
    taxId: document.getElementById('ec-taxid').value.trim() || null,
    email: document.getElementById('ec-email').value.trim() || null,
    phone: document.getElementById('ec-phone').value.trim() || null,
    billingAddress: document.getElementById('ec-address').value.trim() || null,
  };

  try {
    const res = await apiFetch('/api/sales/customers/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update customer');

    closeModal();
    showToast('Customer ' + json.data.name + ' updated successfully', 'success');
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
  const p = (state.products || []).find((item) => item.id === productId);
  const prodName = name || (p ? p.name : 'Product');
  const cat = currentCategory !== undefined ? currentCategory : (p ? p.category : null);
  const body = \`
    <form id="form-change-category" onsubmit="submitChangeCategory(event, '\${productId}')">
      <p style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b;">Category for <strong>\${escapeHtml(prodName)}</strong>.</p>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <div style="display: flex; gap: 0.5rem;">
          <select id="cc-category" class="form-select" style="flex: 1;">\${productCategoryOptionsHtml(cat)}</select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="quickAddCategory('cc-category')">+ New</button>
        </div>
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button id="btn-submit-change-category" class="btn btn-primary" onclick="document.getElementById('form-change-category').requestSubmit()">Save Category</button>
  \`;
  openModal('Change Product Category', body, footer);
}

async function submitChangeCategory(e, productId) {
  e.preventDefault();
  if (isSubmittingProduct) return;

  const category = document.getElementById('cc-category')?.value;
  const submitBtn = document.getElementById('btn-submit-change-category');
  isSubmittingProduct = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch('/api/inventory/products/' + productId + '/category', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save category');

    closeModal();
    showToast('Category updated for ' + json.data.name, 'success');
    directoryActiveTab = 'products';
    loadDirectory();
  } catch (err) {
    showToast(err.message, 'danger');
  } finally {
    isSubmittingProduct = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Category';
    }
  }
}

// ---- Product Management (Create, Edit, Delete) ----

let isSubmittingProduct = false;

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
      <div class="form-group">
        <label class="form-label">Unit of Measure (UOM) *</label>
        <input type="text" id="np-uom" class="form-input" value="pcs" required />
      </div>
      <div class="form-group">
        <label class="form-label">Description (Optional)</label>
        <textarea id="np-description" class="form-input" rows="2" placeholder="Product specifications, notes, or details"></textarea>
      </div>
      <p style="margin: -0.25rem 0 0; font-size: 0.78rem; color: #94a3b8;">
        Unit of measure defaults to pcs. Cost price and stock quantities are tracked when you receive inventory in Purchasing.
      </p>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button id="btn-submit-new-product" class="btn btn-primary" onclick="document.getElementById('form-new-product').requestSubmit()">Save Product</button>
  \`;
  openModal('Add New Product', body, footer);
}

async function submitNewProduct(e) {
  e.preventDefault();
  if (isSubmittingProduct) return;

  const sku = (document.getElementById('np-sku')?.value || '').trim();
  const name = (document.getElementById('np-name')?.value || '').trim();
  const category = (document.getElementById('np-category')?.value || '').trim();
  const unitOfMeasure = (document.getElementById('np-uom')?.value || 'pcs').trim();
  const description = (document.getElementById('np-description')?.value || '').trim();

  if (!sku || !name || !category) {
    showToast('SKU, Name, and Category are required', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-new-product');
  isSubmittingProduct = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch('/api/inventory/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku,
        name,
        category,
        unitOfMeasure: unitOfMeasure || 'pcs',
        description: description || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save product');

    closeModal();
    showToast('Product ' + json.data.name + ' created', 'success');
    directoryActiveTab = 'products';
    loadDirectory();
  } catch (err) {
    showToast(err.message, 'danger');
  } finally {
    isSubmittingProduct = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Product';
    }
  }
}

function openEditProductModal(productId) {
  const p = (state.products || []).find((item) => item.id === productId);
  if (!p) {
    showToast('Product not found', 'danger');
    return;
  }

  const cleanDesc = p.description && !p.description.startsWith('Section:') ? p.description : '';

  const body = \`
    <form id="form-edit-product" onsubmit="submitEditProduct(event, '\${p.id}')">
      <div class="form-group">
        <label class="form-label">Product Number (SKU) *</label>
        <input type="text" id="ep-sku" class="form-input" value="\${escapeHtml(p.sku || '')}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Product Name *</label>
        <input type="text" id="ep-name" class="form-input" value="\${escapeHtml(p.name || '')}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <div style="display: flex; gap: 0.5rem;">
          <select id="ep-category" class="form-select" style="flex: 1;" required>\${productCategoryOptionsHtml(p.category)}</select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="quickAddCategory('ep-category')">+ New</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Unit of Measure (UOM) *</label>
        <input type="text" id="ep-uom" class="form-input" value="\${escapeHtml(p.unitOfMeasure || 'pcs')}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Description (Optional)</label>
        <textarea id="ep-description" class="form-input" rows="2" placeholder="Product specifications, notes, or details">\${escapeHtml(cleanDesc)}</textarea>
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button id="btn-submit-edit-product" class="btn btn-primary" onclick="document.getElementById('form-edit-product').requestSubmit()">Save Changes</button>
  \`;
  openModal('Edit Product', body, footer);
}

async function submitEditProduct(e, productId) {
  e.preventDefault();
  if (isSubmittingProduct) return;

  const sku = (document.getElementById('ep-sku')?.value || '').trim();
  const name = (document.getElementById('ep-name')?.value || '').trim();
  const category = (document.getElementById('ep-category')?.value || '').trim();
  const unitOfMeasure = (document.getElementById('ep-uom')?.value || 'pcs').trim();
  const description = (document.getElementById('ep-description')?.value || '').trim();

  if (!sku || !name || !category) {
    showToast('SKU, Name, and Category are required', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-edit-product');
  isSubmittingProduct = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch('/api/inventory/products/' + productId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku,
        name,
        category,
        unitOfMeasure: unitOfMeasure || 'pcs',
        description,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update product');

    closeModal();
    showToast('Product ' + json.data.name + ' updated successfully', 'success');
    directoryActiveTab = 'products';
    loadDirectory();
  } catch (err) {
    showToast(err.message, 'danger');
  } finally {
    isSubmittingProduct = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  }
}

async function deleteProduct(productId) {
  const p = (state.products || []).find((item) => item.id === productId);
  const name = p ? p.name : 'this product';
  const sku = p && p.sku ? ' (' + p.sku + ')' : '';
  if (!confirm('Are you sure you want to delete ' + name + sku + '?\\n\\nThis will permanently remove the product from the directory.')) {
    return;
  }

  try {
    const res = await apiFetch('/api/inventory/products/' + productId, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete product');

    showToast(json.message || 'Product deleted successfully', 'success');
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
      defaultCategory = 'Weather Station';
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

        // Check if individual product or section belongs to Spare Parts or Weather Station
        let itemCat = defaultCategory;
        const upperSec = (currentSection || '').toUpperCase();
        const upperName = (prodName || '').toUpperCase();
        if (
          upperSheet.includes('PART') ||
          upperSec.includes('PART') ||
          upperSec.includes('ACCESSOR') ||
          upperSec.includes('OPTION') ||
          upperSec.includes('CABLE') ||
          upperSec.includes('SENSOR TRANSMITTER') ||
          upperName.includes('PCBA') ||
          upperName.includes('REPLACEMENT KIT') ||
          upperName.includes('REPAIR KIT') ||
          upperName.includes('HARDWARE KIT') ||
          upperName.includes('SPARE')
        ) {
          itemCat = 'Spare Parts';
        } else if (upperSheet.includes('AWS') || upperSheet.includes('GOV')) {
          itemCat = 'Weather Station';
        }

        const prodObj = {
          sku: pn.toUpperCase(),
          name: (prodName.replace(/\s+/g, ' ').trim()) || ('Part ' + pn),
          category: itemCat,
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
          category: p.category || cat,
        sellingPriceCents: Math.round((p.sellingPrice || 0) * 100),
        sellingPriceCurrency: p.sellingPriceCurrency || 'PHP',
        costPriceCents: Math.round((p.davisPriceUSD || 0) * 100),
        costPriceCurrency: p.costPriceCurrency || 'USD',
        unitOfMeasure: 'pcs',
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

// ==========================================
// Customer Excel / CSV Import Functionality
// ==========================================

let importCustomersState = {
  file: null,
  fileName: '',
  fileSize: '',
  sheets: [],
  activeSheetIdx: 0,
  searchFilter: '',
  isSubmitting: false,
};

function openImportCustomersModal() {
  importCustomersState = {
    file: null,
    fileName: '',
    fileSize: '',
    sheets: [],
    activeSheetIdx: 0,
    searchFilter: '',
    isSubmitting: false,
  };
  renderImportCustomersModal();
}

function toggleImportCustomerSheet(idx, checked) {
  if (importCustomersState.sheets[idx]) {
    importCustomersState.sheets[idx].selected = checked;
    renderImportCustomersModal();
  }
}

function setImportCustomerActiveSheet(idx) {
  importCustomersState.activeSheetIdx = idx;
  renderImportCustomersModal();
}

function renderImportCustomersModal() {
  const { sheets, activeSheetIdx, fileName, fileSize, isSubmitting, searchFilter } = importCustomersState;

  if (!sheets || sheets.length === 0) {
    // 1. Initial State: Upload / Drag & Drop
    const body = \`
      <div style="padding: 1rem 0;">
        <div
          id="customer-dropzone"
          style="border: 2px dashed var(--border-color); border-radius: 12px; padding: 3rem 1.5rem; text-align: center; background: #f8fafc; cursor: pointer; transition: var(--transition);"
          onclick="document.getElementById('customer-file-input').click()"
          ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'; this.style.background='#eff6ff';"
          ondragleave="this.style.borderColor='var(--border-color)'; this.style.background='#f8fafc';"
          ondrop="handleCustomerFileDrop(event)"
        >
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">👥</div>
          <div style="font-weight: 700; font-size: 1.15rem; color: #0f172a; margin-bottom: 0.35rem;">
            Click to select or drag & drop your Customer Excel / CSV File
          </div>
          <p style="font-size: 0.88rem; color: #64748b; max-width: 520px; margin: 0 auto 1.25rem;">
            Upload your spreadsheet (e.g. <code>CUSTOMERS.xlsx</code>). The system automatically detects <strong>Customer Name</strong> and <strong>TIN Number</strong> (Tax ID), along with customer codes, contact info, and addresses.
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" onclick="event.stopPropagation(); document.getElementById('customer-file-input').click()">
              Select Excel / CSV File
            </button>
            <button type="button" class="btn btn-secondary" onclick="event.stopPropagation(); downloadCustomerTemplate()">
              📥 Download Excel Template
            </button>
          </div>
          <input
            type="file"
            id="customer-file-input"
            accept=".xlsx,.xls,.csv"
            style="display: none;"
            onchange="handleCustomerFileSelect(event)"
          />
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 1.25rem; font-size: 0.8rem; color: #64748b; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px; background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem;">
            <strong>🏢 Smart Column Mapping:</strong> Automatically recognizes column headers like <em>Customer Name, Company, Client, TIN, Tax ID, Phone, Email, Address</em>.
          </div>
          <div style="flex: 1; min-width: 200px; background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem;">
            <strong>🔢 Auto Customer Code:</strong> Automatically assigns clean customer codes (e.g. <code>CUST-001</code> or company initials) if not specified in your sheet.
          </div>
          <div style="flex: 1; min-width: 200px; background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem;">
            <strong>🔄 Smart Deduplication:</strong> Automatically detects existing customers by TIN, Code, or Name and updates their record without creating duplicates.
          </div>
        </div>
      </div>
    \`;
    const footer = \`<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>\`;
    openModal('Import Customers & TIN', body, footer, 'xl');
    return;
  }

  // 2. Active State: Sheets & Customer Preview
  const activeSheet = sheets[activeSheetIdx] || sheets[0];
  const q = (searchFilter || '').trim().toLowerCase();

  // Compute totals across all selected sheets
  let totalCustomers = 0;
  let newCustomersCount = 0;
  let updateCustomersCount = 0;

  const existingCustMap = new Map();
  (state.customers || []).forEach((c) => {
    if (c.taxId) existingCustMap.set('tin:' + c.taxId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(), c);
    if (c.customerCode) existingCustMap.set('code:' + c.customerCode.trim().toUpperCase(), c);
    if (c.name) existingCustMap.set('name:' + c.name.trim().toUpperCase(), c);
  });

  sheets.forEach((s) => {
    if (!s.selected) return;
    s.customers.forEach((c) => {
      totalCustomers++;
      const cleanTin = (c.taxId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const cleanCode = (c.customerCode || '').trim().toUpperCase();
      const cleanName = (c.name || '').trim().toUpperCase();

      const isMatch = (cleanTin && existingCustMap.has('tin:' + cleanTin)) ||
                      (cleanCode && existingCustMap.has('code:' + cleanCode)) ||
                      (cleanName && existingCustMap.has('name:' + cleanName));
      if (isMatch) {
        updateCustomersCount++;
      } else {
        newCustomersCount++;
      }
    });
  });

  // Filter customers for active sheet
  const displayCustomers = (activeSheet.customers || []).filter((c) => {
    if (!q) return true;
    return (
      (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.taxId && c.taxId.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  // Sheet navigation pills (if more than 1 sheet)
  let sheetTabsHtml = '';
  if (sheets.length > 1) {
    const pills = sheets.map((s, idx) => {
      const isActive = idx === activeSheetIdx;
      return \`
        <div style="display: inline-flex; align-items: center; background: \${isActive ? '#eff6ff' : '#f8fafc'}; border: 1px solid \${isActive ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 8px; padding: 0.35rem 0.65rem; gap: 0.5rem;">
          <input
            type="checkbox"
            id="cust-sheet-cb-\${idx}"
            \${s.selected ? 'checked' : ''}
            onchange="toggleImportCustomerSheet(\${idx}, this.checked)"
            style="cursor: pointer;"
          />
          <button
            type="button"
            onclick="setImportCustomerActiveSheet(\${idx})"
            style="border: none; background: transparent; font-weight: \${isActive ? '700' : '500'}; color: \${isActive ? 'var(--primary)' : 'var(--text-main)'}; cursor: pointer; padding: 0; font-size: 0.85rem;"
          >
            \${s.name} <span style="font-size: 0.75rem; opacity: 0.8; font-weight: 600;">(\${s.customers.length})</span>
          </button>
        </div>
      \`;
    }).join('');

    sheetTabsHtml = \`
      <div>
        <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 0.4rem;">
          Detected Sheets (Check sheets to include in import):
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          \${pills}
        </div>
      </div>
    \`;
  }

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
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('customer-file-input').click()" style="margin-left: 0.5rem; font-size: 0.75rem; padding: 0.2rem 0.5rem;">Change File</button>
          <input type="file" id="customer-file-input" accept=".xlsx,.xls,.csv" style="display: none;" onchange="handleCustomerFileSelect(event)" />
        </div>
        <div style="display: flex; gap: 0.6rem; align-items: center;">
          <span class="badge" style="background: #e2e8f0; color: #334155; font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 600;">
            👥 \${totalCustomers} Total
          </span>
          <span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 600;">
            ✨ \${newCustomersCount} New
          </span>
          <span class="badge" style="background: #e0f2fe; color: #075985; font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 600;">
            🔄 \${updateCustomersCount} Updates
          </span>
        </div>
      </div>

      \${sheetTabsHtml}

      <!-- Search & Download Template Bar -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.6rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <input
            type="text"
            class="form-input"
            style="padding: 0.35rem 0.75rem; font-size: 0.82rem; width: 260px;"
            placeholder="Search preview rows..."
            value="\${searchFilter}"
            oninput="importCustomersState.searchFilter = this.value; renderImportCustomersModal();"
          />
          <span style="font-size: 0.8rem; color: #64748b;">
            Showing \${displayCustomers.length} of \${activeSheet.customers.length} in \${activeSheet.name}
          </span>
        </div>
        <div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="downloadCustomerTemplate()" style="font-size: 0.76rem; padding: 0.25rem 0.6rem;">
            📥 Download Template
          </button>
        </div>
      </div>

      <!-- Live Preview Table -->
      <div style="border: 1px solid var(--border-color); border-radius: 8px; max-height: 380px; overflow-y: auto; background: #ffffff;">
        <table class="data-table" style="margin: 0; width: 100%; border-collapse: collapse;">
          <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 2; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <tr>
              <th style="width: 75px; padding: 0.6rem 0.75rem;">Status</th>
              <th style="width: 120px; padding: 0.6rem 0.75rem;">Code</th>
              <th style="padding: 0.6rem 0.75rem;">Customer Name</th>
              <th style="width: 170px; padding: 0.6rem 0.75rem;">TIN Number</th>
              <th style="width: 180px; padding: 0.6rem 0.75rem;">Contact</th>
              <th style="width: 220px; padding: 0.6rem 0.75rem;">Billing Address</th>
            </tr>
          </thead>
          <tbody>
            \${
              displayCustomers.length === 0
                ? '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">No matching customer rows found.</td></tr>'
                : displayCustomers.map((c) => {
                    const cleanTin = (c.taxId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    const cleanCode = (c.customerCode || '').trim().toUpperCase();
                    const cleanName = (c.name || '').trim().toUpperCase();

                    const isMatch = (cleanTin && existingCustMap.has('tin:' + cleanTin)) ||
                                    (cleanCode && existingCustMap.has('code:' + cleanCode)) ||
                                    (cleanName && existingCustMap.has('name:' + cleanName));

                    const statusBadge = isMatch
                      ? '<span class="badge" style="background: #e0f2fe; color: #075985; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px;">UPDATE</span>'
                      : '<span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px;">NEW</span>';

                    const tinDisplay = c.taxId
                      ? '<span class="badge badge-secondary" style="font-family: monospace; font-size: 0.8rem; background: #f1f5f9; color: #334155; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #e2e8f0;">' + escapeHtml(c.taxId) + '</span>'
                      : '<span style="color: #94a3b8; font-size: 0.8rem;">—</span>';

                    const contactDisplay = [c.email, c.phone].filter(Boolean).map(escapeHtml).join(' • ') || '<span style="color: #94a3b8;">—</span>';

                    return \`
                      <tr>
                        <td style="padding: 0.55rem 0.75rem;">\${statusBadge}</td>
                        <td style="padding: 0.55rem 0.75rem;"><strong style="font-family: monospace; font-size: 0.82rem; color: #334155;">\${escapeHtml(c.customerCode || 'AUTO')}</strong></td>
                        <td style="padding: 0.55rem 0.75rem; font-weight: 600; color: #0f172a;">\${escapeHtml(c.name)}</td>
                        <td style="padding: 0.55rem 0.75rem;">\${tinDisplay}</td>
                        <td style="padding: 0.55rem 0.75rem; font-size: 0.82rem; color: #64748b;">\${contactDisplay}</td>
                        <td style="padding: 0.55rem 0.75rem; font-size: 0.8rem; color: #64748b;">\${c.billingAddress ? escapeHtml(c.billingAddress) : '<span style="color: #94a3b8;">—</span>'}</td>
                      </tr>
                    \`;
                  }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  \`;

  const footer = isSubmitting
    ? \`
      <button class="btn btn-secondary" disabled>Cancel</button>
      <button class="btn btn-primary" disabled style="display: inline-flex; align-items: center; gap: 0.5rem;">
        <span style="display: inline-block; width: 14px; height: 14px; border: 2px solid #ffffff; border-right-color: transparent; border-radius: 50%; animation: spin 0.75s linear infinite;"></span>
        Importing Customers...
      </button>
    \`
    : \`
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button
        class="btn btn-primary"
        onclick="executeBatchCustomerImport()"
        \${totalCustomers === 0 ? 'disabled' : ''}
        style="display: inline-flex; align-items: center; gap: 0.4rem;"
      >
        <span>📥</span> Import \${totalCustomers} Customer\${totalCustomers === 1 ? '' : 's'}
      </button>
    \`;

  openModal('Import Customers & TIN', body, footer, 'xl');
}

function handleCustomerFileDrop(e) {
  e.preventDefault();
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length > 0) {
    processCustomerFile(dt.files[0]);
  }
}

function handleCustomerFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (file) {
    processCustomerFile(file);
  }
}

function processCustomerFile(file) {
  if (!file) return;

  if (typeof window.XLSX === 'undefined') {
    showToast('Loading spreadsheet parser... Please try again in a moment.', 'info');
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => processCustomerFile(file);
    s.onerror = () => showToast('Failed to load XLSX engine from CDN.', 'danger');
    document.head.appendChild(s);
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = window.XLSX.read(data, { type: 'array' });
      const parsedSheets = parseCustomerWorkbook(wb);

      if (!parsedSheets || parsedSheets.length === 0) {
        showToast('No valid customer names or records detected in this file.', 'warning');
        return;
      }

      importCustomersState.file = file;
      importCustomersState.fileName = file.name;
      importCustomersState.fileSize = (file.size / 1024).toFixed(1) + ' KB';
      importCustomersState.sheets = parsedSheets;
      importCustomersState.activeSheetIdx = 0;
      importCustomersState.searchFilter = '';

      renderImportCustomersModal();
      showToast('Detected ' + parsedSheets.length + ' sheet(s) with customer records.', 'success');
    } catch (err) {
      console.error('Error parsing Customer Excel file:', err);
      showToast('Error reading spreadsheet: ' + err.message, 'danger');
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseCustomerWorkbook(wb) {
  const parsedSheets = [];

  for (let sIdx = 0; sIdx < wb.SheetNames.length; sIdx++) {
    const rawSheetName = wb.SheetNames[sIdx];
    const sName = (rawSheetName || '').trim();
    const sheet = wb.Sheets[rawSheetName];
    if (!sheet) continue;

    const grid = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (!grid || !grid.length) continue;

    let headerRowIdx = -1;
    let nameCol = -1;
    let tinCol = -1;
    let codeCol = -1;
    let emailCol = -1;
    let phoneCol = -1;
    let addressCol = -1;

    // Scan first 15 rows for header row
    for (let r = 0; r < Math.min(15, grid.length); r++) {
      const row = grid[r] || [];
      for (let c = 0; c < row.length; c++) {
        const valStr = String(row[c] || '').trim().toUpperCase();
        if (!valStr) continue;

        // Customer / Company Name
        if (
          nameCol < 0 &&
          ['CUSTOMER', 'CUSTOMER NAME', 'COMPANY', 'COMPANY NAME', 'CLIENT', 'CLIENT NAME', 'ACCOUNT', 'ACCOUNT NAME', 'BILL TO', 'BUYER', 'ORGANIZATION', 'NAME'].includes(valStr)
        ) {
          nameCol = c;
          headerRowIdx = r;
        }

        // TIN / Tax ID
        if (
          tinCol < 0 &&
          (valStr === 'TIN' || valStr.startsWith('TIN ') || valStr === 'TIN#' || valStr === 'TIN NO' || valStr === 'TIN NO.' || valStr === 'TIN NUMBER' || valStr === 'TAX ID' || valStr.includes('TAX IDENTIFICATION') || valStr === 'VAT NO' || valStr === 'VAT NO.' || valStr === 'VAT REG' || valStr === 'VAT REG. TIN' || valStr === 'TIN/VAT')
        ) {
          tinCol = c;
          headerRowIdx = r;
        }

        // Customer Code
        if (
          codeCol < 0 &&
          ['CUSTOMER CODE', 'CUST CODE', 'CODE', 'CUST ID', 'CUSTOMER ID', 'CLIENT ID', 'ACCOUNT NO', 'ACCOUNT #', 'CUST NO'].includes(valStr)
        ) {
          codeCol = c;
          headerRowIdx = r;
        }

        // Email
        if (
          emailCol < 0 &&
          ['EMAIL', 'E-MAIL', 'EMAIL ADDRESS', 'E-MAIL ADDRESS'].includes(valStr)
        ) {
          emailCol = c;
        }

        // Phone
        if (
          phoneCol < 0 &&
          ['PHONE', 'PHONE NO', 'PHONE NO.', 'PHONE NUMBER', 'TEL', 'TEL NO', 'TELEPHONE', 'MOBILE', 'CONTACT NO', 'CONTACT NUMBER', 'CONTACT'].includes(valStr)
        ) {
          phoneCol = c;
        }

        // Address
        if (
          addressCol < 0 &&
          ['ADDRESS', 'BILLING ADDRESS', 'OFFICE ADDRESS', 'LOCATION', 'STREET', 'ADDRESS 1', 'DELIVERY ADDRESS'].includes(valStr)
        ) {
          addressCol = c;
        }
      }
      if (nameCol >= 0 && headerRowIdx >= 0) break;
    }

    // Fallback: If no header found, inspect row 0
    if (nameCol < 0) {
      if (grid.length > 0) {
        headerRowIdx = 0;
        nameCol = 0;
        if (grid[0].length > 1) tinCol = 1;
        if (grid[0].length > 2) codeCol = 2;
      }
    }

    if (nameCol < 0) continue;

    const customers = [];
    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

    for (let r = startRow; r < grid.length; r++) {
      const row = grid[r] || [];
      const rawName = String(row[nameCol] || '').trim();
      if (!rawName || rawName.length < 2) continue;

      // Skip header repeated row or total rows
      const upperName = rawName.toUpperCase();
      if (upperName === 'CUSTOMER NAME' || upperName === 'TOTAL' || upperName === 'GRAND TOTAL') continue;

      const rawTin = tinCol >= 0 ? String(row[tinCol] || '').trim() : '';
      const rawCode = codeCol >= 0 ? String(row[codeCol] || '').trim() : '';
      const rawEmail = emailCol >= 0 ? String(row[emailCol] || '').trim() : '';
      const rawPhone = phoneCol >= 0 ? String(row[phoneCol] || '').trim() : '';
      const rawAddress = addressCol >= 0 ? String(row[addressCol] || '').trim() : '';

      // Normalize TIN: clean up multiple hyphens, or format 9/12 digit numbers
      let formattedTin = rawTin;
      if (formattedTin) {
        const digitsOnly = formattedTin.replace(/[^0-9]/g, '');
        if (digitsOnly.length === 9) {
          formattedTin = digitsOnly.slice(0, 3) + '-' + digitsOnly.slice(3, 6) + '-' + digitsOnly.slice(6, 9) + '-000';
        } else if (digitsOnly.length === 12) {
          formattedTin = digitsOnly.slice(0, 3) + '-' + digitsOnly.slice(3, 6) + '-' + digitsOnly.slice(6, 9) + '-' + digitsOnly.slice(9, 12);
        }
      }

      customers.push({
        customerCode: rawCode || '',
        name: rawName,
        taxId: formattedTin || '',
        email: rawEmail || '',
        phone: rawPhone || '',
        billingAddress: rawAddress || '',
      });
    }

    if (customers.length > 0) {
      parsedSheets.push({
        name: sName,
        selected: true,
        customers,
      });
    }
  }

  return parsedSheets;
}

function downloadCustomerTemplate() {
  if (typeof window.XLSX === 'undefined') {
    showToast('Spreadsheet engine loading, please try again...', 'info');
    return;
  }
  const headers = ['Customer Name', 'TIN Number', 'Customer Code (Optional)', 'Email', 'Phone', 'Billing Address'];
  const sampleData = [
    ['Universal Leaf Philippines, Inc.', '000-123-456-000', 'ULP-001', 'purchasing@ulp.com.ph', '+63 2 8123 4567', 'Agoo, La Union, Philippines'],
    ['Philippine Atmospheric Geophysical & Astronomical Services (PAGASA)', '000-987-654-000', 'PAGASA-001', 'info@pagasa.dost.gov.ph', '+63 2 8284 0800', 'Science Garden Complex, Agham Road, Diliman, Quezon City'],
    ['Department of Agriculture - RFO 1', '001-234-567-000', '', 'procurement@ilocos.da.gov.ph', '+63 72 242 1045', 'San Fernando City, La Union'],
    ['Aero Weather Solutions Corp.', '123-456-789-001', '', 'admin@aeroweather.ph', '+63 2 8900 1234', 'Makati City, Metro Manila'],
  ];

  const ws = window.XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  ws['!cols'] = [
    { wch: 45 },
    { wch: 22 },
    { wch: 25 },
    { wch: 30 },
    { wch: 20 },
    { wch: 45 },
  ];

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Customers');
  window.XLSX.writeFile(wb, 'Apexs_Customer_Import_Template.xlsx');
  showToast('Downloaded Customer Import Template', 'success');
}

async function executeBatchCustomerImport() {
  const selectedSheets = (importCustomersState.sheets || []).filter((s) => s.selected);
  if (!selectedSheets.length) {
    showToast('Please select at least one sheet to import.', 'warning');
    return;
  }

  const payloadCustomers = [];
  selectedSheets.forEach((sheet) => {
    sheet.customers.forEach((c) => {
      payloadCustomers.push({
        customerCode: c.customerCode || undefined,
        name: c.name,
        taxId: c.taxId || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        billingAddress: c.billingAddress || undefined,
      });
    });
  });

  if (!payloadCustomers.length) {
    showToast('No customers found in selected sheets to import.', 'warning');
    return;
  }

  importCustomersState.isSubmitting = true;
  renderImportCustomersModal();

  try {
    const res = await apiFetch('/api/sales/customers/batch-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customers: payloadCustomers }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to import customers');
    }

    const { total, createdCount, updatedCount } = json.data;
    closeModal();

    showToast('Import complete: ' + total + ' customers processed (' + createdCount + ' added, ' + updatedCount + ' updated)', 'success');

    // Reload directory data
    directoryActiveTab = 'customers';
    await loadDirectory();
  } catch (err) {
    importCustomersState.isSubmitting = false;
    renderImportCustomersModal();
    showToast(err.message, 'danger');
  }
}
`;

