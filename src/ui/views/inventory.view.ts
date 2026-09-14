export function renderInventoryView(): string {
  return `
    <style>
      .inventory-smart-scroll-container {
        position: relative;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        overflow: hidden;
      }
      .inventory-smart-scroll {
        max-height: calc(100vh - 280px);
        min-height: 220px;
        overflow-y: auto;
        overflow-x: auto;
        scroll-behavior: smooth;
      }
      .inventory-smart-scroll::-webkit-scrollbar {
        width: 7px;
        height: 7px;
      }
      .inventory-smart-scroll::-webkit-scrollbar-track {
        background: #f8fafc;
      }
      .inventory-smart-scroll::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      .inventory-smart-scroll::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
      .inventory-smart-scroll table {
        border-collapse: separate;
        border-spacing: 0;
        width: 100%;
        min-width: 1280px;
        margin: 0;
      }
      .inventory-smart-scroll th,
      .inventory-smart-scroll td {
        vertical-align: middle;
      }
      .inventory-smart-scroll thead th {
        position: sticky;
        top: 0;
        z-index: 10;
        background: #f8fafc;
        border-bottom: 2px solid var(--border-color);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        transition: background-color 0.15s ease;
        padding: 0.75rem 1rem;
      }
      .inventory-smart-scroll thead th.sortable-th:hover {
        background: #f1f5f9;
      }
      .inventory-smart-scroll td {
        border-bottom: 1px solid var(--border-color);
        padding: 0.75rem 1rem;
      }
      .inventory-smart-scroll tbody tr {
        transition: background-color 0.15s ease;
      }
      .inventory-smart-scroll tbody tr:hover {
        background-color: #f8fafc;
      }
      .inventory-scroll-pill {
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
      .inventory-scroll-pill:hover {
        background: #0f172a;
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.35);
      }
      .inventory-scroll-top-arrow {
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
        .inventory-panel-inner {
          padding-left: 0.75rem !important;
          padding-right: 0.75rem !important;
        }
        .inventory-search-box {
          max-width: 100% !important;
        }
      }
      @media (max-width: 480px) {
        .inventory-panel-inner {
          padding-left: 0.5rem !important;
          padding-right: 0.5rem !important;
        }
      }
    </style>
    <div id="view-inventory" class="tab-view" style="display: none;"></div>
  `;
}

export const INVENTORY_CLIENT_JS = `
let inventorySearchQuery = '';
let inventoryCategoryTab = 'all';
let inventoryVisibleCount = 50;
const INVENTORY_CHUNK_SIZE = 50;
let inventorySortField = 'onHandStock';
let inventorySortOrder = 'desc';

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
    container.innerHTML = \`<div class="panel-card" style="padding: 2rem; color: #dc2626;">Error loading inventory: \${err.message}</div>\`;
  }
}

function handleInventorySearch(query) {
  inventorySearchQuery = (query || '').toLowerCase().trim();
  inventoryVisibleCount = 50;
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', inventorySearchQuery || null);
  }
  const clearBtn = document.getElementById('inventory-search-clear-btn');
  if (clearBtn) {
    clearBtn.style.display = query ? 'inline-block' : 'none';
  }
  renderInventoryCategoryTabs();
  renderInventoryTable();
}

function clearInventorySearch() {
  inventorySearchQuery = '';
  inventoryVisibleCount = 50;
  if (typeof setUrlParam === 'function') {
    setUrlParam('search', null);
  }
  const inputEl = document.getElementById('inventory-search-input');
  if (inputEl) inputEl.value = '';
  const clearBtn = document.getElementById('inventory-search-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderInventoryCategoryTabs();
  renderInventoryTable();
}

function setInventorySort(field) {
  if (inventorySortField === field) {
    inventorySortOrder = inventorySortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    inventorySortField = field;
    inventorySortOrder = field === 'onHandStock' ? 'desc' : 'asc';
  }
  inventoryVisibleCount = 50;
  renderInventoryTable();
}

function inventorySortIndicator(field) {
  if (inventorySortField !== field) {
    return '<span style="color: #cbd5e1; font-size: 0.72rem; margin-left: 4px;">↕</span>';
  }
  return inventorySortOrder === 'asc'
    ? '<span style="color: var(--primary); font-size: 0.8rem; font-weight: 700; margin-left: 4px;">↑</span>'
    : '<span style="color: var(--primary); font-size: 0.8rem; font-weight: 700; margin-left: 4px;">↓</span>';
}

function sortInventoryRows(rows) {
  return rows.slice().sort((a, b) => {
    // 1. Products that have stock display first
    const hasStockA = (a.onHandStock || 0) > 0 ? 1 : 0;
    const hasStockB = (b.onHandStock || 0) > 0 ? 1 : 0;
    if (hasStockA !== hasStockB) {
      return hasStockB - hasStockA;
    }

    // 2. Both have stock, or both have 0 stock: apply selected column sort
    let cmp = 0;
    if (inventorySortField) {
      let valA = a[inventorySortField];
      let valB = b[inventorySortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = inventorySortOrder === 'asc' ? valA - valB : valB - valA;
      } else {
        const strA = (valA + '').toLowerCase();
        const strB = (valB + '').toLowerCase();
        cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        if (inventorySortOrder === 'desc') cmp = -cmp;
      }
    }

    // 3. Deterministic tiebreaker by SKU
    if (cmp === 0) {
      const skuA = (a.sku || '').toLowerCase();
      const skuB = (b.sku || '').toLowerCase();
      return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
    }

    return cmp;
  });
}

function getInventoryFilteredTotal() {
  let list = state.products || [];
  if (inventoryCategoryTab === 'in_stock') {
    list = list.filter((p) => (p.onHandStock || 0) > 0);
  } else if (inventoryCategoryTab !== 'all') {
    list = list.filter((p) => p.category === inventoryCategoryTab);
  }
  if (inventorySearchQuery) {
    const q = inventorySearchQuery.toLowerCase();
    list = list.filter((p) => {
      const sku = (p.sku || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const uom = (p.unitOfMeasure || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return sku.includes(q) || name.includes(q) || uom.includes(q) || cat.includes(q);
    });
  }
  return list.length;
}

function handleInventorySmartScroll(el) {
  const pill = document.getElementById('inventory-scroll-pill');
  if (pill) {
    if (el.scrollTop > 120) {
      pill.style.display = 'flex';
    } else {
      pill.style.display = 'none';
    }
  }

  // Auto load next chunk when within 250px of bottom
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 250) {
    inventoryLoadMoreRows();
  }
}

function inventoryLoadMoreRows() {
  const total = getInventoryFilteredTotal();
  if (inventoryVisibleCount < total) {
    inventoryVisibleCount += INVENTORY_CHUNK_SIZE;
    const viewport = document.getElementById('inventory-scroll-viewport');
    const prevScroll = viewport ? viewport.scrollTop : 0;
    renderInventoryTable(true);
    const newViewport = document.getElementById('inventory-scroll-viewport');
    if (newViewport) newViewport.scrollTop = prevScroll;
  }
}

function inventoryLoadAllRows() {
  const total = getInventoryFilteredTotal();
  inventoryVisibleCount = total;
  renderInventoryTable(true);
}

function scrollInventoryToTop() {
  const viewport = document.getElementById('inventory-scroll-viewport');
  if (viewport) {
    viewport.scrollTo({ top: 0, behavior: 'smooth' });
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
  if (!container) container = document.getElementById('view-inventory');
  if (!container) return;

  if (inventoryCategoryTab !== 'all' && inventoryCategoryTab !== 'in_stock' && !(state.productCategories || []).some((c) => c.name === inventoryCategoryTab)) {
    inventoryCategoryTab = 'all';
  }

  container.innerHTML = \`
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Product Catalog & Stock Levels</div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="exportInventoryCsv()">📥 Export CSV</button>
          \${can('inventory', 'create') ? '<button class="btn btn-primary btn-sm" onclick="openAddStockModal()">➕ Add Stock</button>' : ''}
          \${can('inventory', 'update') ? '<button class="btn btn-secondary btn-sm" onclick="openStockAdjustmentModal()">Stock Adjustment</button>' : ''}
        </div>
      </div>
      <div class="inventory-panel-inner" style="padding: 0 1.35rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <p style="font-size: 0.85rem; color: #64748b; margin: 0; flex: 1 1 280px;">
          Add new products from the Business Directory. This view tracks stock levels, valuation, and movement history.
        </p>
        <div class="inventory-search-box" style="position: relative; max-width: 280px; width: 100%;">
          <input
            type="text"
            id="inventory-search-input"
            class="form-input"
            style="width: 100%; padding-right: 2rem; font-size: 0.82rem;"
            placeholder="Search SKU, product name..."
            value="\${inventorySearchQuery}"
            oninput="handleInventorySearch(this.value)"
          />
          <button
            id="inventory-search-clear-btn"
            type="button"
            onclick="clearInventorySearch()"
            style="display: \${inventorySearchQuery ? 'inline-block' : 'none'}; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; background: transparent; color: #94a3b8; font-size: 0.9rem; cursor: pointer; padding: 0.2rem; line-height: 1;"
            title="Clear search"
          >✕</button>
        </div>
      </div>
      <div id="inventory-category-tabs" class="inventory-panel-inner" style="padding: 0 1.35rem 1rem;"></div>
      <div id="inventory-table-wrap" class="inventory-panel-inner" style="padding: 0 1.35rem 0.5rem;"></div>
    </div>
  \`;
  renderInventoryCategoryTabs();
  renderInventoryTable();
}

function renderInventoryCategoryTabs() {
  const wrap = document.getElementById('inventory-category-tabs');
  if (!wrap) return;

  const countFor = (catName) => (state.products || []).filter((p) => p.category === catName).length;
  const inStockCount = (state.products || []).filter((p) => (p.onHandStock || 0) > 0).length;

  const pills = [
    { key: 'all', label: 'All Products', count: (state.products || []).length },
    { key: 'in_stock', label: '🟢 In Stock', count: inStockCount },
    ...(state.productCategories || []).map((c) => ({ key: c.name, label: c.name, count: countFor(c.name) })),
  ];

  const pillsHtml = pills.map((p) => {
    const active = inventoryCategoryTab === p.key;
    return \`
      <button type="button" onclick="inventoryCategoryTab = '\${p.key.replace(/'/g, "\\\\'")}'; inventoryVisibleCount = 50; renderInventoryCategoryTabs(); renderInventoryTable();" style="padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid \${active ? 'var(--primary)' : 'var(--border-color)'}; background: \${active ? 'var(--primary)' : '#f8fafc'}; color: \${active ? '#ffffff' : 'var(--text-main)'}; cursor: pointer; transition: var(--transition);">
        \${p.label} <span style="opacity: 0.75;">(\${p.count})</span>
      </button>
    \`;
  }).join('');

  wrap.innerHTML = \`
    <div class="category-pills-strip" style="border-top: 1px dashed var(--border-color); padding-top: 1rem;">
      \${pillsHtml}
    </div>
  \`;
}

function renderInventoryTable(keepScroll = false) {
  const wrap = document.getElementById('inventory-table-wrap');
  if (!wrap) return;

  let prevScroll = 0;
  if (keepScroll) {
    const el = document.getElementById('inventory-scroll-viewport');
    if (el) prevScroll = el.scrollTop;
  }

  if (inventoryCategoryTab !== 'all' && inventoryCategoryTab !== 'in_stock' && !(state.productCategories || []).some((c) => c.name === inventoryCategoryTab)) {
    inventoryCategoryTab = 'all';
  }

  let filteredProducts = state.products || [];
  if (inventoryCategoryTab === 'in_stock') {
    filteredProducts = filteredProducts.filter((p) => (p.onHandStock || 0) > 0);
  } else if (inventoryCategoryTab !== 'all') {
    filteredProducts = filteredProducts.filter((p) => p.category === inventoryCategoryTab);
  }
  if (inventorySearchQuery) {
    const q = inventorySearchQuery.toLowerCase();
    filteredProducts = filteredProducts.filter((p) => {
      const sku = (p.sku || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const uom = (p.unitOfMeasure || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return sku.includes(q) || name.includes(q) || uom.includes(q) || cat.includes(q);
    });
  }

  const allRows = sortInventoryRows(filteredProducts);
  const allRowsCount = allRows.length;
  const rows = allRows.slice(0, inventoryVisibleCount);
  const visibleRowsCount = rows.length;

  let rowsHtml = '';
  rows.forEach((p) => {
    rowsHtml += \`
      <tr>
        <td style="white-space: nowrap;"><strong style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #334155;">\${p.sku}</strong></td>
        <td style="width: 360px; min-width: 340px; max-width: 540px;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #64748b;" title="Product">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div style="min-width: 0; flex: 1;">
              <div style="font-weight: 600; color: #0f172a; font-size: 0.88rem; line-height: 1.35; word-break: normal; cursor: pointer;" onclick="openProductHistoryModal('\${p.id}', '\${p.name.replace(/'/g, "\\\\'")}')" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='#0f172a'" title="View stock ledger for \${(p.name || '').replace(/"/g, '&quot;')}">
                \${p.name}
              </div>
              \${p.description && !p.description.startsWith('Section:') ? \`<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 380px;" title="\${(p.description || '').replace(/"/g, '&quot;')}">\${p.description}</div>\` : ''}
            </div>
          </div>
        </td>
        <td style="white-space: nowrap;"><span class="badge badge-neutral" style="font-size: 0.74rem;">\${p.category || '—'}</span></td>
        <td style="text-align: center; color: #64748b; font-size: 0.82rem; white-space: nowrap;">\${p.unitOfMeasure}</td>
        <td style="white-space: nowrap;">\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.72rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8; font-size: 0.8rem;">Not purchased yet</span>'}</td>
        <td style="white-space: nowrap;">\${p.sellingPriceCents > 0 ? '<strong style="font-family: monospace; color: #0f172a;">' + formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency) + '</strong>' : '<span style="color: #94a3b8; font-size: 0.8rem;">Not set</span>'}</td>
        <td style="text-align: center; white-space: nowrap;">
          <span class="badge \${p.onHandStock > 10 ? 'badge-success' : p.onHandStock > 0 ? 'badge-warning' : 'badge-danger'}" style="font-weight: 600;">
            <span class="badge-dot"></span>
            \${p.onHandStock} \${p.unitOfMeasure}
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;"><strong style="font-family: monospace; color: #0f172a;">\${formatCurrency(p.inventoryValuationCents)}</strong></td>
        <td style="text-align: center; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openProductHistoryModal('\${p.id}', '\${p.name.replace(/'/g, "\\\\'")}')">History</button>
        </td>
      </tr>
    \`;
  });

  const tableHeaderHtml = \`<thead><tr>
    <th class="sortable-th" style="width: 110px; min-width: 100px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('sku')" title="Sort by SKU">SKU \${inventorySortIndicator('sku')}</th>
    <th class="sortable-th" style="width: 360px; min-width: 340px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('name')" title="Sort by Product Name">Product Name \${inventorySortIndicator('name')}</th>
    <th class="sortable-th" style="width: 160px; min-width: 140px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('category')" title="Sort by Category">Category \${inventorySortIndicator('category')}</th>
    <th class="sortable-th" style="width: 75px; min-width: 65px; text-align: center; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('unitOfMeasure')" title="Sort by UOM">UOM \${inventorySortIndicator('unitOfMeasure')}</th>
    <th class="sortable-th" style="width: 140px; min-width: 130px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('costPriceCents')" title="Sort by Cost Price">Cost Price \${inventorySortIndicator('costPriceCents')}</th>
    <th class="sortable-th" style="width: 140px; min-width: 130px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('sellingPriceCents')" title="Sort by Selling Price">Selling Price \${inventorySortIndicator('sellingPriceCents')}</th>
    <th class="sortable-th" style="width: 140px; min-width: 130px; text-align: center; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('onHandStock')" title="Sort by On-Hand Stock">On-Hand Stock \${inventorySortIndicator('onHandStock')}</th>
    <th class="sortable-th" style="width: 130px; min-width: 120px; text-align: right; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('inventoryValuationCents')" title="Sort by Valuation">Valuation \${inventorySortIndicator('inventoryValuationCents')}</th>
    <th style="width: 80px; min-width: 80px; text-align: center; white-space: nowrap;">Audit</th>
  </tr></thead>\`;

  const hasMore = visibleRowsCount < allRowsCount;
  const bottomLoader = hasMore
    ? \`<tr><td colspan="10" style="text-align: center; color: #64748b; font-size: 0.8rem; padding: 0.85rem; background: #f8fafc; font-weight: 500;">
        Showing \${visibleRowsCount} of \${allRowsCount} items.
        <span style="color: #cbd5e1; margin: 0 0.5rem;">•</span>
        <a href="javascript:void(0)" onclick="inventoryLoadMoreRows()" style="color: var(--primary); font-weight: 600; text-decoration: none; margin-right: 0.75rem;">Load next \${Math.min(INVENTORY_CHUNK_SIZE, allRowsCount - visibleRowsCount)}</a>
        <a href="javascript:void(0)" onclick="inventoryLoadAllRows()" style="color: #64748b; font-weight: 500; text-decoration: underline;">Load all \${allRowsCount}</a>
      </td></tr>\`
    : (allRowsCount > 25 ? \`<tr><td colspan="10" style="text-align: center; color: #94a3b8; font-size: 0.74rem; padding: 0.65rem;">✓ All \${allRowsCount} items loaded</td></tr>\` : '');

  wrap.innerHTML = \`
    <div class="inventory-smart-scroll-container">
      <div id="inventory-scroll-viewport" class="inventory-smart-scroll" onscroll="handleInventorySmartScroll(this)">
        <table class="data-table">
          \${tableHeaderHtml}
          <tbody>
            \${rowsHtml || '<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 2rem;">No products matching search criteria.</td></tr>'}
            \${bottomLoader}
          </tbody>
        </table>
      </div>
      <div id="inventory-scroll-pill" class="inventory-scroll-pill" onclick="scrollInventoryToTop()" style="display: \${prevScroll > 120 ? 'flex' : 'none'};" title="Scroll back to top">
        <span id="inventory-scroll-counter">\${visibleRowsCount} of \${allRowsCount}</span>
        <span style="opacity: 0.75; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em;">Top</span>
        <span class="inventory-scroll-top-arrow">↑</span>
      </div>
    </div>
  \`;

  if (keepScroll) {
    const el = document.getElementById('inventory-scroll-viewport');
    if (el) el.scrollTop = prevScroll;
  }
}

async function openProductHistoryModal(productId, productName) {
  try {
    const res = await apiFetch('/api/inventory/products/' + productId);
    const json = await res.json();
    const movements = json.data?.stockMovements || [];

    let rowsHtml = '';
    movements.forEach((m) => {
      rowsHtml += \`
        <tr>
          <td>\${new Date(m.createdAt).toLocaleDateString()} \${new Date(m.createdAt).toLocaleTimeString()}</td>
          <td><span class="badge \${m.type === 'IN' ? 'badge-success' : m.type === 'OUT' ? 'badge-danger' : 'badge-warning'}">\${m.type}</span></td>
          <td><strong>\${m.quantity}</strong></td>
          <td>\${m.referenceType} (\${m.referenceId || 'N/A'})</td>
          <td>\${m.notes || '-'}</td>
        </tr>
      \`;
    });

    const body = \`
      <p style="margin-bottom: 1rem; font-size: 0.85rem; color: #64748b;">
        Audit movements for <strong>\${productName}</strong>. Current On-Hand: <strong>\${json.data.onHandStock}</strong>
      </p>
      <div class="table-responsive" style="max-height: 380px; overflow-y: auto;">
        <table class="data-table">
          <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 5;">
            <tr>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Reference</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            \${rowsHtml || '<tr><td colspan="5" style="text-align: center;">No movements recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    \`;
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
    .map((p) => \`<option value="\${p.id}">\${p.sku} - \${p.name} (Current: \${p.onHandStock})</option>\`)
    .join('');
  const body = \`
    <form id="form-add-stock" onsubmit="submitAddStock(event)">
      <p style="margin: 0 0 1rem; font-size: 0.85rem; color: #64748b;">
        Use this for stock that isn't coming through a Purchase Order — e.g. legacy products
        already on hand before this system was in use. If the product has no cost price yet,
        set one here so its valuation is accurate.
      </p>
      <div class="form-group">
        <label class="form-label">Select Product *</label>
        <select id="add-stock-product" class="form-select" onchange="handleAddStockProductChange()">\${options}</select>
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
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-add-stock').requestSubmit()">Add Stock</button>
  \`;
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
  let options = state.products.map((p) => \`<option value="\${p.id}">\${p.sku} - \${p.name} (Current: \${p.onHandStock})</option>\`).join('');
  const body = \`
    <form id="form-stock-adj" onsubmit="submitStockAdjustment(event)">
      <div class="form-group">
        <label class="form-label">Select Product *</label>
        <select id="adj-product" class="form-select">\${options}</select>
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
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('form-stock-adj').requestSubmit()">Post Adjustment</button>
  \`;
  openModal('Post Stock Adjustment', body, footer);
  handleAddStockProductChange();
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
`;
