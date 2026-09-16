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
        min-width: 100%;
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
        padding: 0.7rem 0.85rem;
      }
      .inventory-smart-scroll thead th.sortable-th:hover {
        background: #f1f5f9;
      }
      .inventory-smart-scroll td {
        border-bottom: 1px solid var(--border-color);
        padding: 0.65rem 0.85rem;
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
      /* Autocomplete Product Combobox */
      .product-combobox-container {
        position: relative;
        width: 100%;
      }
      .product-combobox-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        z-index: 1050;
        background: #ffffff;
        border: 1px solid var(--border-color, #cbd5e1);
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
        max-height: 270px;
        overflow: hidden;
        overscroll-behavior: contain;
      }
      .product-combobox-item {
        padding: 0.65rem 0.85rem;
        border-bottom: 1px solid #f1f5f9;
        cursor: pointer;
        transition: background-color 0.12s ease;
      }
      .product-combobox-item:last-child {
        border-bottom: none;
      }
      .product-combobox-item:hover,
      .product-combobox-item.active {
        background-color: #f1f5f9;
      }
      .product-combobox-item.selected {
        background-color: #f0fdf4;
      }
    </style>
    <div id="view-inventory" class="tab-view" style="display: none;"></div>
  `;
}

export const INVENTORY_CLIENT_JS = `
let inventorySearchQuery = '';
let inventoryCategoryTab = 'in_stock';
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
      apiFetch('/api/inventory/products?type=PRODUCT'),
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
    inventorySortOrder = (field === 'onHandStock' || field === 'damagedStock') ? 'desc' : 'asc';
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
    if (inventoryCategoryTab === 'damaged') {
      const hasDmgA = (a.damagedStock || 0) > 0 ? 1 : 0;
      const hasDmgB = (b.damagedStock || 0) > 0 ? 1 : 0;
      if (hasDmgA !== hasDmgB) return hasDmgB - hasDmgA;
    } else {
      const hasStockA = (a.onHandStock || 0) > 0 ? 1 : 0;
      const hasStockB = (b.onHandStock || 0) > 0 ? 1 : 0;
      if (hasStockA !== hasStockB) {
        return hasStockB - hasStockA;
      }
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
  let list = (state.products || []).filter((p) => p.type !== 'SERVICE');
  if (inventoryCategoryTab === 'in_stock') {
    list = list.filter((p) => (p.onHandStock || 0) > 0);
  } else if (inventoryCategoryTab === 'out_of_stock') {
    list = list.filter((p) => (p.onHandStock || 0) <= 0);
  } else if (inventoryCategoryTab === 'damaged') {
    list = list.filter((p) => (p.damagedStock || 0) > 0);
  } else if (inventoryCategoryTab !== 'all') {
    list = list.filter((p) => p.category === inventoryCategoryTab && (p.onHandStock || 0) > 0);
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
  const headers = ['SKU', 'Product Name', 'Category', 'UOM', 'Cost Price', 'Selling Price', 'Available Stock', 'Damaged Stock'];
  let exportList = (state.products || []).filter((p) => p.type !== 'SERVICE');
  if (inventoryCategoryTab === 'in_stock') {
    exportList = exportList.filter((p) => (p.onHandStock || 0) > 0);
  } else if (inventoryCategoryTab === 'out_of_stock') {
    exportList = exportList.filter((p) => (p.onHandStock || 0) <= 0);
  } else if (inventoryCategoryTab === 'damaged') {
    exportList = exportList.filter((p) => (p.damagedStock || 0) > 0);
  } else if (inventoryCategoryTab !== 'all') {
    exportList = exportList.filter((p) => p.category === inventoryCategoryTab && (p.onHandStock || 0) > 0);
  }
  const rows = exportList.map((p) => [
    p.sku,
    p.name,
    p.category || 'General',
    p.unitOfMeasure,
    p.costPriceCents ? (p.costPriceCents / 100).toFixed(2) + ' ' + (p.costPriceCurrency || 'PHP') : '0.00',
    p.sellingPriceCents ? (p.sellingPriceCents / 100).toFixed(2) + ' ' + (p.sellingPriceCurrency || 'PHP') : '0.00',
    p.onHandStock,
    p.damagedStock || 0,
  ]);
  exportToCsv('inventory_stock_' + inventoryCategoryTab + '_' + new Date().toISOString().slice(0, 10), headers, rows);
}

function renderInventoryContent(container) {
  if (!container) container = document.getElementById('view-inventory');
  if (!container) return;

  if (inventoryCategoryTab !== 'all' && inventoryCategoryTab !== 'in_stock' && inventoryCategoryTab !== 'out_of_stock' && inventoryCategoryTab !== 'damaged' && !(state.productCategories || []).some((c) => c.name === inventoryCategoryTab)) {
    inventoryCategoryTab = 'in_stock';
  }

  container.innerHTML = \`
    <div class="panel-card">
      <div class="panel-header">
        <div class="panel-title">Product Catalog & Stock Levels</div>
        <div class="panel-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="exportInventoryCsv()">Export CSV</button>
          \${can('inventory', 'create') ? '<button class="btn btn-primary btn-sm" onclick="openAddStockModal()">Add Stock</button>' : ''}
          \${can('inventory', 'update') ? '<button class="btn btn-secondary btn-sm" onclick="openStockAdjustmentModal()">Stock Adjustment</button>' : ''}
          \${can('inventory', 'update') ? '<button class="btn btn-secondary btn-sm" onclick="openDamagedStockModal()">Damaged Stock</button>' : ''}
        </div>
      </div>
      <div class="inventory-panel-inner" style="padding: 0 1.35rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <p style="font-size: 0.85rem; color: #64748b; margin: 0; flex: 1 1 280px;">
          Showing available physical stock. Master product details and specifications are managed in the Business Directory.
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

function setInventoryCategoryTab(key) {
  inventoryCategoryTab = key;
  inventoryVisibleCount = 50;
  const strip = document.querySelector('#inventory-category-tabs .category-pills-strip');
  const prevScroll = strip ? strip.scrollLeft : 0;
  renderInventoryCategoryTabs(prevScroll, key);
  renderInventoryTable();
}

function renderInventoryCategoryTabs(savedScroll = null, activeKey = null) {
  const wrap = document.getElementById('inventory-category-tabs');
  if (!wrap) return;

  const countFor = (catName) => (state.products || []).filter((p) => p.type !== 'SERVICE' && p.category === catName && (p.onHandStock || 0) > 0).length;
  const inStockCount = (state.products || []).filter((p) => p.type !== 'SERVICE' && (p.onHandStock || 0) > 0).length;
  const outOfStockCount = (state.products || []).filter((p) => p.type !== 'SERVICE' && (p.onHandStock || 0) <= 0).length;
  const damagedCount = (state.products || []).filter((p) => p.type !== 'SERVICE' && (p.damagedStock || 0) > 0).length;
  const totalCatalogCount = (state.products || []).filter((p) => p.type !== 'SERVICE').length;

  const pills = [
    { key: 'in_stock', label: 'In Stock (Available)', count: inStockCount },
    { key: 'out_of_stock', label: 'Out of Stock (0)', count: outOfStockCount },
    { key: 'damaged', label: 'Damaged / Quarantine', count: damagedCount },
    { key: 'all', label: 'All Catalog', count: totalCatalogCount },
    ...(state.productCategories || []).map((c) => ({ key: c.name, label: c.name, count: countFor(c.name) })),
  ];

  const pillsHtml = pills.map((p) => {
    const active = inventoryCategoryTab === p.key;
    return \`
      <button
        type="button"
        class="category-pill-btn \${active ? 'active' : ''}"
        data-category-key="\${p.key}"
        onclick="setInventoryCategoryTab('\${p.key.replace(/'/g, "\\\\'")}')"
      >
        <span>\${p.label}</span>
        <span class="pill-count">\${p.count}</span>
      </button>
    \`;
  }).join('');

  wrap.innerHTML = \`
    <div class="category-pills-strip" style="border-top: 1px dashed var(--border-color); padding-top: 1rem;">
      \${pillsHtml}
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

function renderInventoryTable(keepScroll = false) {
  const wrap = document.getElementById('inventory-table-wrap');
  if (!wrap) return;

  let prevScroll = 0;
  if (keepScroll) {
    const el = document.getElementById('inventory-scroll-viewport');
    if (el) prevScroll = el.scrollTop;
  }

  if (inventoryCategoryTab !== 'all' && inventoryCategoryTab !== 'in_stock' && inventoryCategoryTab !== 'out_of_stock' && inventoryCategoryTab !== 'damaged' && !(state.productCategories || []).some((c) => c.name === inventoryCategoryTab)) {
    inventoryCategoryTab = 'in_stock';
  }

  let filteredProducts = (state.products || []).filter((p) => p.type !== 'SERVICE');
  if (inventoryCategoryTab === 'in_stock') {
    filteredProducts = filteredProducts.filter((p) => (p.onHandStock || 0) > 0);
  } else if (inventoryCategoryTab === 'out_of_stock') {
    filteredProducts = filteredProducts.filter((p) => (p.onHandStock || 0) <= 0);
  } else if (inventoryCategoryTab === 'damaged') {
    filteredProducts = filteredProducts.filter((p) => (p.damagedStock || 0) > 0);
  } else if (inventoryCategoryTab !== 'all') {
    filteredProducts = filteredProducts.filter((p) => p.category === inventoryCategoryTab && (p.onHandStock || 0) > 0);
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
        <td data-label="SKU" class="cell-sku" style="white-space: nowrap; width: 85px;"><strong style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #334155;">\${p.sku}</strong></td>
        <td data-label="Product Name" style="min-width: 180px;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #64748b;" title="Product">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div style="min-width: 0; flex: 1;">
              <div style="font-weight: 600; color: #0f172a; font-size: 0.88rem; line-height: 1.35; word-break: normal; cursor: pointer;" onclick="openProductHistoryModal('\${p.id}', '\${(p.name || '').replace(/'/g, "\\\\'")}')" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='#0f172a'" title="View stock ledger for \${(p.name || '').replace(/"/g, '&quot;')}">
                \${p.name}
              </div>
              \${p.description && !p.description.startsWith('Section:') ? '<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;" title="' + (p.description || '').replace(/"/g, '&quot;') + '">' + p.description + '</div>' : ''}
            </div>
          </div>
        </td>
        <td data-label="Category" style="white-space: nowrap;"><span class="badge badge-neutral" style="font-size: 0.74rem;">\${p.category || '—'}</span></td>
        <td data-label="Cost Price" style="white-space: nowrap;">\${p.costPriceCents > 0 ? formatCurrency(p.costPriceCents, p.costPriceCurrency) + ' <span style="color: #94a3b8; font-size: 0.72rem;">' + p.costPriceCurrency + '</span>' : '<span style="color: #94a3b8; font-size: 0.8rem;">Not purchased yet</span>'}</td>
        <td data-label="Selling Price" style="white-space: nowrap;">\${p.sellingPriceCents > 0 ? '<strong style="font-family: monospace; color: #0f172a;">' + formatCurrency(p.sellingPriceCents, p.sellingPriceCurrency) + '</strong>' : '<span style="color: #94a3b8; font-size: 0.8rem;">Not set</span>'}</td>
        <td data-label="Available Stock" style="text-align: center; white-space: nowrap;">
          <span class="badge \${p.onHandStock > 10 ? 'badge-success' : p.onHandStock > 0 ? 'badge-warning' : 'badge-danger'}" style="font-weight: 600;">
            <span class="badge-dot"></span>
            \${p.onHandStock} \${p.unitOfMeasure}
          </span>
        </td>
        <td data-label="Damaged Stock" style="text-align: center; white-space: nowrap;">
          \${(p.damagedStock || 0) > 0
            ? '<span class="badge badge-warning" style="font-weight: 600; cursor: pointer;" onclick="openDamagedStockModal(\\'' + p.id + '\\')" title="Click to manage damaged stock">' + p.damagedStock + ' ' + p.unitOfMeasure + '</span>'
            : '<span style="color: #cbd5e1; font-size: 0.8rem;">—</span>'
          }
        </td>
        <td data-label="Audit" class="td-actions" style="text-align: center; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openProductHistoryModal('\${p.id}', '\${(p.name || '').replace(/'/g, "\\\\'")}')">History</button>
        </td>
      </tr>
    \`;
  });

  const tableHeaderHtml = \`<thead><tr>
    <th class="sortable-th" style="width: 85px; min-width: 75px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('sku')" title="Sort by SKU">SKU \${inventorySortIndicator('sku')}</th>
    <th class="sortable-th" style="min-width: 180px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('name')" title="Sort by Product Name">Product Name \${inventorySortIndicator('name')}</th>
    <th class="sortable-th" style="width: 130px; min-width: 105px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('category')" title="Sort by Category">Category \${inventorySortIndicator('category')}</th>
    <th class="sortable-th" style="width: 120px; min-width: 100px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('costPriceCents')" title="Sort by Cost Price">Cost Price \${inventorySortIndicator('costPriceCents')}</th>
    <th class="sortable-th" style="width: 120px; min-width: 105px; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('sellingPriceCents')" title="Sort by Selling Price">Selling Price \${inventorySortIndicator('sellingPriceCents')}</th>
    <th class="sortable-th" style="width: 105px; min-width: 90px; text-align: center; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('onHandStock')" title="Sort by Available Stock">Available \${inventorySortIndicator('onHandStock')}</th>
    <th class="sortable-th" style="width: 95px; min-width: 80px; text-align: center; white-space: nowrap; cursor: pointer; user-select: none;" onclick="setInventorySort('damagedStock')" title="Sort by Damaged Stock">Damaged \${inventorySortIndicator('damagedStock')}</th>
    <th style="width: 75px; min-width: 70px; text-align: center; white-space: nowrap;">Audit</th>
  </tr></thead>\`;

  const emptyMsg = inventorySearchQuery
    ? 'No products matching search criteria.'
    : inventoryCategoryTab === 'out_of_stock'
    ? 'No out-of-stock items. All catalog products have positive inventory.'
    : inventoryCategoryTab === 'damaged'
    ? 'No damaged or quarantined items.'
    : inventoryCategoryTab === 'in_stock'
    ? 'No products currently in stock. Receive purchase orders in Inbound Deliveries or click "Add Stock" to add inventory.'
    : 'No products found.';

  const hasMore = visibleRowsCount < allRowsCount;
  const bottomLoader = hasMore
    ? \`<tr><td colspan="8" style="text-align: center; color: #64748b; font-size: 0.8rem; padding: 0.85rem; background: #f8fafc; font-weight: 500;">
        Showing \${visibleRowsCount} of \${allRowsCount} items.
        <span style="color: #cbd5e1; margin: 0 0.5rem;">•</span>
        <a href="javascript:void(0)" onclick="inventoryLoadMoreRows()" style="color: var(--primary); font-weight: 600; text-decoration: none; margin-right: 0.75rem;">Load next \${Math.min(INVENTORY_CHUNK_SIZE, allRowsCount - visibleRowsCount)}</a>
        <a href="javascript:void(0)" onclick="inventoryLoadAllRows()" style="color: #64748b; font-weight: 500; text-decoration: underline;">Load all \${allRowsCount}</a>
      </td></tr>\`
    : (allRowsCount > 25 ? \`<tr><td colspan="8" style="text-align: center; color: #94a3b8; font-size: 0.74rem; padding: 0.65rem;">All \${allRowsCount} items loaded</td></tr>\` : '');

  wrap.innerHTML = \`
    <div class="inventory-smart-scroll-container">
      <div id="inventory-scroll-viewport" class="inventory-smart-scroll" onscroll="handleInventorySmartScroll(this)">
        <table class="data-table">
          \${tableHeaderHtml}
          <tbody>
            \${rowsHtml || '<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 2.5rem 1rem;">' + emptyMsg + '</td></tr>'}
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
    const damagedCount = json.data?.damagedStock || 0;
    const onHandCount = json.data?.onHandStock || 0;
    const uom = json.data?.unitOfMeasure || 'pcs';
    const sku = json.data?.sku || 'N/A';
    const category = json.data?.category || '';

    let rowsHtml = '';
    movements.forEach((m) => {
      let refDisplay = escapeHtml(m.referenceType || 'N/A') + (m.referenceId ? ' (' + escapeHtml(m.referenceId) + ')' : '');
      if (m.referenceType === 'SCRAP') {
        refDisplay = '<span class="badge badge-danger" style="font-size: 0.72rem;">Scrap / Disposal</span>';
      } else if (m.referenceType === 'RETURN') {
        refDisplay = '<span class="badge badge-warning" style="font-size: 0.72rem;">Vendor RMA</span>';
      } else if (m.referenceType === 'PURCHASE_ORDER' || m.referenceType === 'PO') {
        refDisplay = '<span class="badge" style="font-family: monospace; font-size: 0.74rem; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;">PO: ' + escapeHtml(m.referenceId || 'Order') + '</span>';
      } else if (m.referenceType === 'SALES_ORDER' || m.referenceType === 'SO') {
        refDisplay = '<span class="badge" style="font-family: monospace; font-size: 0.74rem; background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;">SO: ' + escapeHtml(m.referenceId || 'Order') + '</span>';
      } else if (m.referenceType === 'INVOICE') {
        refDisplay = '<span class="badge" style="font-family: monospace; font-size: 0.74rem; background: #faf5ff; color: #7e22ce; border: 1px solid #f3e8ff;">INV: ' + escapeHtml(m.referenceId || 'Invoice') + '</span>';
      } else if (m.referenceType === 'ADJUSTMENT') {
        refDisplay = '<span class="badge badge-neutral" style="font-size: 0.74rem; font-weight: 500;">Adjustment</span>';
      }

      const d = new Date(m.createdAt);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const typeBg = m.type === 'IN' ? '#dcfce7' : m.type === 'OUT' ? '#fee2e2' : '#fef3c7';
      const typeColor = m.type === 'IN' ? '#15803d' : m.type === 'OUT' ? '#b91c1c' : '#b45309';
      const typeBorder = m.type === 'IN' ? '#bbf7d0' : m.type === 'OUT' ? '#fecaca' : '#fde68a';
      const typeIcon = m.type === 'IN' ? '↑ IN' : m.type === 'OUT' ? '↓ OUT' : '↕ ADJUST';

      const qtyColor = m.type === 'IN' ? '#16a34a' : m.type === 'OUT' ? '#dc2626' : '#d97706';
      const qtySign = m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : '';

      rowsHtml += \`
        <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;">
          <td style="white-space: nowrap; width: 175px; padding: 0.65rem 0.85rem;">
            <div style="font-weight: 600; font-size: 0.82rem; color: #0f172a; line-height: 1.3;">\${dateStr}</div>
            <div style="font-size: 0.72rem; color: #64748b; font-family: 'JetBrains Mono', monospace; margin-top: 1px;">\${timeStr}</div>
          </td>
          <td style="text-align: center; width: 95px; white-space: nowrap; padding: 0.65rem 0.85rem;">
            <span style="display: inline-flex; align-items: center; justify-content: center; padding: 0.2rem 0.55rem; border-radius: 9999px; font-size: 0.74rem; font-weight: 700; background: \${typeBg}; color: \${typeColor}; border: 1px solid \${typeBorder};">
              \${typeIcon}
            </span>
          </td>
          <td style="text-align: right; width: 110px; white-space: nowrap; padding: 0.65rem 0.85rem;">
            <strong style="font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; color: \${qtyColor};">
              \${qtySign}\${Math.abs(m.quantity)}
            </strong>
            <span style="font-size: 0.74rem; color: #64748b; margin-left: 2px;">\${escapeHtml(uom)}</span>
          </td>
          <td style="width: 150px; white-space: nowrap; padding: 0.65rem 0.85rem;">
            \${refDisplay}
          </td>
          <td style="padding: 0.65rem 0.85rem; font-size: 0.8rem; color: #475569; word-break: break-word;">
            \${escapeHtml(m.notes || '—')}
          </td>
        </tr>
      \`;
    });

    const body = \`
      <div style="margin-bottom: 1.15rem; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.85rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 240px; flex: 1;">
          <div style="width: 38px; height: 38px; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #0284c7; box-shadow: 0 1px 2px rgba(0,0,0,0.04); flex-shrink: 0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div>
            <div style="font-weight: 700; color: #0f172a; font-size: 0.96rem; line-height: 1.3;">\${escapeHtml(productName)}</div>
            <div style="display: flex; align-items: center; gap: 0.45rem; margin-top: 2px;">
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.76rem; font-weight: 600; color: #475569; background: #ffffff; padding: 0.12rem 0.4rem; border-radius: 4px; border: 1px solid #e2e8f0;">SKU: \${escapeHtml(sku)}</span>
              \${category ? '<span class="badge badge-neutral" style="font-size: 0.72rem;">' + escapeHtml(category) + '</span>' : ''}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <div style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.4rem 0.75rem; display: flex; flex-direction: column; align-items: flex-end; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <span style="font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #15803d;">Available Stock</span>
            <span style="font-size: 1.05rem; font-weight: 800; color: #16a34a; font-family: 'JetBrains Mono', monospace; line-height: 1.2;">
              \${onHandCount} <span style="font-size: 0.74rem; font-weight: 600; color: #15803d;">\${escapeHtml(uom)}</span>
            </span>
          </div>
          <div style="background: #ffffff; border: 1px solid \${damagedCount > 0 ? '#fde68a' : '#e2e8f0'}; border-radius: 8px; padding: 0.4rem 0.75rem; display: flex; flex-direction: column; align-items: flex-end; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <span style="font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: \${damagedCount > 0 ? '#b45309' : '#64748b'};">Damaged Stock</span>
            <span style="font-size: 1.05rem; font-weight: 800; color: \${damagedCount > 0 ? '#d97706' : '#64748b'}; font-family: 'JetBrains Mono', monospace; line-height: 1.2;">
              \${damagedCount} <span style="font-size: 0.74rem; font-weight: 600; color: \${damagedCount > 0 ? '#b45309' : '#94a3b8'};">\${escapeHtml(uom)}</span>
            </span>
          </div>
        </div>
      </div>
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="max-height: 380px; overflow-y: auto;">
          <table class="data-table" style="width: 100%; border-collapse: collapse; margin: 0;">
            <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 5; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <tr>
                <th style="width: 175px; padding: 0.65rem 0.85rem; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; text-align: left; border-bottom: 1px solid #e2e8f0;">Timestamp</th>
                <th style="width: 95px; padding: 0.65rem 0.85rem; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; text-align: center; border-bottom: 1px solid #e2e8f0;">Type</th>
                <th style="width: 110px; padding: 0.65rem 0.85rem; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; text-align: right; border-bottom: 1px solid #e2e8f0;">Quantity</th>
                <th style="width: 150px; padding: 0.65rem 0.85rem; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; text-align: left; border-bottom: 1px solid #e2e8f0;">Reference</th>
                <th style="padding: 0.65rem 0.85rem; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; text-align: left; border-bottom: 1px solid #e2e8f0;">Notes</th>
              </tr>
            </thead>
            <tbody>
              \${rowsHtml || '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 2.5rem 1rem;">No stock movements recorded yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    \`;

    const footer = \`
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span style="font-size: 0.8rem; color: #64748b;">
          \${movements.length === 1 ? '1 movement entry' : movements.length + ' movement entries'}
        </span>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    \`;

    openModal('Stock Movement Audit: ' + productName, body, footer, 'lg');
  } catch (err) {
    showToast('Error fetching ledger: ' + err.message, 'danger');
  }
}

function openAddStockModal(defaultProductId) {
  if (!state.products || !state.products.length) {
    showToast('Please add products first', 'warning');
    return;
  }
  const body = \`
    <form id="form-add-stock" onsubmit="submitAddStock(event)">
      <div class="form-group" style="margin-bottom: 1rem;">
        <label class="form-label">Select Product *</label>
        <div id="add-stock-combobox-container" class="product-combobox-container">
          <input type="hidden" id="add-stock-product" value="" required />
          <div style="position: relative; display: flex; align-items: center;">
            <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input
              type="text"
              id="add-stock-search-input"
              class="form-input"
              placeholder="Search by SKU or product name..."
              autocomplete="off"
              style="padding-left: 2.35rem; padding-right: 2.25rem; font-size: 0.88rem;"
              oninput="handleProductSearchInput('add-stock', this.value)"
              onfocus="handleProductSearchFocus('add-stock')"
              onkeydown="handleProductSearchKeydown('add-stock', event)"
            />
            <button
              type="button"
              id="add-stock-clear-btn"
              onclick="clearProductSelection('add-stock')"
              style="display: none; position: absolute; right: 0.65rem; top: 50%; transform: translateY(-50%); background: #f1f5f9; border: none; color: #64748b; cursor: pointer; padding: 0; border-radius: 50%; width: 20px; height: 20px; align-items: center; justify-content: center; transition: all 0.15s ease;"
              title="Clear selection"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 11px; height: 11px; display: block;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div id="add-stock-dropdown" class="product-combobox-dropdown" style="display: none;"></div>
          <div id="add-stock-selected-card"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" style="font-weight: 600; color: #0f172a;">Quantity to Add *</label>
        <input type="number" id="add-stock-qty" class="form-input" placeholder="e.g. 10" min="1" required />
      </div>
      <div class="form-group" style="display: flex; gap: 0.75rem;">
        <div style="flex: 2;">
          <label class="form-label" style="font-weight: 600; color: #0f172a;">Unit Cost <span id="add-stock-cost-hint" style="color: #94a3b8; font-weight: normal; font-size: 0.8rem;"></span></label>
          <input type="number" id="add-stock-cost" class="form-input" placeholder="0.00" min="0" step="0.01" />
        </div>
        <div style="flex: 1;">
          <label class="form-label" style="font-weight: 600; color: #0f172a;">Currency</label>
          <select id="add-stock-currency" class="form-select">
            <option value="PHP">PHP</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" style="font-weight: 600; color: #0f172a;">Reason / Notes</label>
        <input type="text" id="add-stock-notes" class="form-input" placeholder="Legacy stock on hand, no PO on record" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button id="btn-submit-add-stock" class="btn btn-primary" onclick="document.getElementById('form-add-stock').requestSubmit()">Add Stock</button>
  \`;
  openModal('Add Stock (No PO)', body, footer);

  setTimeout(() => {
    if (defaultProductId) {
      selectProductFromSearch('add-stock', defaultProductId);
    } else {
      const input = document.getElementById('add-stock-search-input');
      if (input) {
        input.focus();
        renderProductComboboxDropdown('add-stock', '');
      }
    }
  }, 100);
}

function handleAddStockProductChange() {
  const hidden = document.getElementById('add-stock-product');
  if (!hidden) return;
  const product = (state.products || []).find((p) => p.id === hidden.value);
  if (!product) return;

  const costInput = document.getElementById('add-stock-cost');
  const currencySelect = document.getElementById('add-stock-currency');
  const hint = document.getElementById('add-stock-cost-hint');

  if (currencySelect) currencySelect.value = product.costPriceCurrency || 'PHP';
  if (costInput && hint) {
    if (product.costPriceCents > 0) {
      costInput.value = (product.costPriceCents / 100).toFixed(2);
      hint.textContent = '(currently ' + formatCurrency(product.costPriceCents, product.costPriceCurrency) + ')';
    } else {
      costInput.value = '';
      hint.textContent = '(not set yet)';
    }
  }
}

let isInventorySubmitting = false;

async function submitAddStock(e) {
  e.preventDefault();
  if (isInventorySubmitting) return;

  const productId = document.getElementById('add-stock-product').value;
  if (!productId) {
    showToast('Please search and select a product from the list', 'warning');
    const input = document.getElementById('add-stock-search-input');
    if (input) {
      input.focus();
      renderProductComboboxDropdown('add-stock', input.value || '');
    }
    return;
  }
  const quantity = parseInt(document.getElementById('add-stock-qty').value, 10);
  const costInput = document.getElementById('add-stock-cost').value;
  const currency = document.getElementById('add-stock-currency').value;
  const notes = document.getElementById('add-stock-notes').value || 'Manual stock entry (no PO)';

  if (!quantity || quantity <= 0) {
    showToast('Quantity must be a positive number', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-add-stock');
  isInventorySubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
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
  } finally {
    isInventorySubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Stock';
    }
  }
}

function openStockAdjustmentModal(defaultProductId) {
  if (!state.products || !state.products.length) {
    showToast('Please add products first', 'warning');
    return;
  }
  const body = \`
    <form id="form-stock-adj" onsubmit="submitStockAdjustment(event)">
      <div class="form-group" style="margin-bottom: 1rem;">
        <label class="form-label">Select Product *</label>
        <div id="adj-combobox-container" class="product-combobox-container">
          <input type="hidden" id="adj-product" value="" required />
          <div style="position: relative; display: flex; align-items: center;">
            <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input
              type="text"
              id="adj-search-input"
              class="form-input"
              placeholder="Search by SKU or product name..."
              autocomplete="off"
              style="padding-left: 2.35rem; padding-right: 2.25rem; font-size: 0.88rem;"
              oninput="handleProductSearchInput('adj', this.value)"
              onfocus="handleProductSearchFocus('adj')"
              onkeydown="handleProductSearchKeydown('adj', event)"
            />
            <button
              type="button"
              id="adj-clear-btn"
              onclick="clearProductSelection('adj')"
              style="display: none; position: absolute; right: 0.65rem; top: 50%; transform: translateY(-50%); background: #f1f5f9; border: none; color: #64748b; cursor: pointer; padding: 0; border-radius: 50%; width: 20px; height: 20px; align-items: center; justify-content: center; transition: all 0.15s ease;"
              title="Clear selection"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 11px; height: 11px; display: block;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div id="adj-dropdown" class="product-combobox-dropdown" style="display: none;"></div>
          <div id="adj-selected-card"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" style="font-weight: 600; color: #0f172a;">Adjustment Type *</label>
        <select id="adj-type" class="form-select">
          <option value="IN">IN (Stock Addition)</option>
          <option value="OUT">OUT (Stock Reduction)</option>
          <option value="ADJUST">ADJUST (Inventory Delta)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" style="font-weight: 600; color: #0f172a;">Quantity *</label>
        <input type="number" id="adj-qty" class="form-input" placeholder="e.g. 10" required />
      </div>
      <div class="form-group">
        <label class="form-label" style="font-weight: 600; color: #0f172a;">Reason / Notes</label>
        <input type="text" id="adj-notes" class="form-input" placeholder="Physical inventory reconciliation" />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button id="btn-submit-stock-adj" class="btn btn-primary" onclick="document.getElementById('form-stock-adj').requestSubmit()">Post Adjustment</button>
  \`;
  openModal('Post Stock Adjustment', body, footer);

  setTimeout(() => {
    if (defaultProductId) {
      selectProductFromSearch('adj', defaultProductId);
    } else {
      const input = document.getElementById('adj-search-input');
      if (input) {
        input.focus();
        renderProductComboboxDropdown('adj', '');
      }
    }
  }, 100);
}

async function submitStockAdjustment(e) {
  e.preventDefault();
  if (isInventorySubmitting) return;

  const productId = document.getElementById('adj-product').value;
  if (!productId) {
    showToast('Please search and select a product from the list', 'warning');
    const input = document.getElementById('adj-search-input');
    if (input) {
      input.focus();
      renderProductComboboxDropdown('adj', input.value || '');
    }
    return;
  }
  const payload = {
    productId,
    type: document.getElementById('adj-type').value,
    quantity: parseInt(document.getElementById('adj-qty').value, 10),
    referenceType: 'ADJUSTMENT',
    notes: document.getElementById('adj-notes').value || 'Manual adjustment',
  };

  const submitBtn = document.getElementById('btn-submit-stock-adj');
  isInventorySubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
  }

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
  } finally {
    isInventorySubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Adjustment';
    }
  }
}

function openDamagedStockModal(defaultProductId) {
  if (!state.products || !state.products.length) {
    showToast('Please add products first', 'warning');
    return;
  }
  const body = \`
    <form id="form-damaged-stock" onsubmit="submitDamagedStock(event)">
      <div class="form-group" style="margin-bottom: 1rem;">
        <label class="form-label">Select Product *</label>
        <div id="dmg-combobox-container" class="product-combobox-container">
          <input type="hidden" id="dmg-product" value="" required />
          <div style="position: relative; display: flex; align-items: center;">
            <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input
              type="text"
              id="dmg-search-input"
              class="form-input"
              placeholder="Search by SKU or product name..."
              autocomplete="off"
              style="padding-left: 2.35rem; padding-right: 2.25rem; font-size: 0.88rem;"
              oninput="handleProductSearchInput('dmg', this.value)"
              onfocus="handleProductSearchFocus('dmg')"
              onkeydown="handleProductSearchKeydown('dmg', event)"
            />
            <button
              type="button"
              id="dmg-clear-btn"
              onclick="clearProductSelection('dmg')"
              style="display: none; position: absolute; right: 0.65rem; top: 50%; transform: translateY(-50%); background: #f1f5f9; border: none; color: #64748b; cursor: pointer; padding: 0; border-radius: 50%; width: 20px; height: 20px; align-items: center; justify-content: center; transition: all 0.15s ease;"
              title="Clear selection"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 11px; height: 11px; display: block;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div id="dmg-dropdown" class="product-combobox-dropdown" style="display: none;"></div>
          <div id="dmg-selected-card"></div>
        </div>
      </div>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label class="form-label">Action *</label>
        <select id="dmg-action" class="form-select" onchange="handleDamagedActionChange()">
          <option value="MOVE_TO_DAMAGED">Move to Damaged / Quarantine (from Available)</option>
          <option value="RESTORE_TO_AVAILABLE">Restore to Available (Repaired / Inspected)</option>
          <option value="DISPOSE_SCRAP">Dispose / Write-Off (Scrap)</option>
          <option value="RETURN_TO_SUPPLIER">Return to Supplier (Vendor RMA)</option>
        </select>
      </div>
      <div id="dmg-reason-group" class="form-group" style="margin-bottom: 1rem;">
        <label class="form-label">Damage Reason *</label>
        <select id="dmg-reason" class="form-select">
          <option value="Defective / QC Failed">Defective / QC Failed</option>
          <option value="Damaged in Transit">Damaged in Transit</option>
          <option value="Warehouse Handling Damage">Warehouse Handling Damage</option>
          <option value="Customer Return (Damaged)">Customer Return (Damaged)</option>
          <option value="Expired / Obsolete">Expired / Obsolete</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label class="form-label">Quantity * <span id="dmg-qty-hint" style="color: #94a3b8; font-weight: normal; font-size: 0.8rem;"></span></label>
        <input type="number" id="dmg-qty" class="form-input" placeholder="e.g. 1" min="1" required />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" id="dmg-notes" class="form-input" placeholder="Serial numbers, inspection details, or RMA number..." />
      </div>
    </form>
  \`;
  const footer = \`
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button id="btn-submit-damaged-stock" class="btn btn-primary" onclick="document.getElementById('form-damaged-stock').requestSubmit()">Save</button>
  \`;
  openModal('Damaged & Quarantine Stock', body, footer);

  setTimeout(() => {
    if (defaultProductId) {
      selectProductFromSearch('dmg', defaultProductId);
    } else {
      const input = document.getElementById('dmg-search-input');
      if (input) {
        input.focus();
        renderProductComboboxDropdown('dmg', '');
      }
    }
  }, 100);
}

function handleDamagedActionChange() {
  const hidden = document.getElementById('dmg-product');
  const action = document.getElementById('dmg-action')?.value;
  const reasonGroup = document.getElementById('dmg-reason-group');
  const hintEl = document.getElementById('dmg-qty-hint');
  const qtyInput = document.getElementById('dmg-qty');

  const product = (state.products || []).find((p) => p.id === hidden?.value);

  if (action === 'MOVE_TO_DAMAGED') {
    if (reasonGroup) reasonGroup.style.display = 'block';
    if (hintEl && product) {
      hintEl.textContent = \`(Max available: \${product.onHandStock} \${product.unitOfMeasure})\`;
    }
    if (qtyInput && product) {
      qtyInput.max = product.onHandStock;
    }
  } else {
    if (reasonGroup) reasonGroup.style.display = 'none';
    if (hintEl && product) {
      hintEl.textContent = \`(Current damaged: \${product.damagedStock || 0} \${product.unitOfMeasure})\`;
    }
    if (qtyInput && product) {
      qtyInput.max = product.damagedStock || 0;
    }
  }
}

async function submitDamagedStock(e) {
  e.preventDefault();
  if (isInventorySubmitting) return;

  const productId = document.getElementById('dmg-product').value;
  if (!productId) {
    showToast('Please search and select a product', 'warning');
    document.getElementById('dmg-search-input')?.focus();
    return;
  }
  const action = document.getElementById('dmg-action').value;
  const quantity = parseInt(document.getElementById('dmg-qty').value, 10);
  const reason = document.getElementById('dmg-reason')?.value || '';
  const notes = document.getElementById('dmg-notes')?.value || '';

  if (!quantity || quantity <= 0) {
    showToast('Quantity must be a positive number', 'warning');
    return;
  }

  const product = (state.products || []).find((p) => p.id === productId);
  if (!product) return;

  if (action === 'MOVE_TO_DAMAGED' && quantity > (product.onHandStock || 0)) {
    showToast('Quantity cannot exceed available stock (' + (product.onHandStock || 0) + ')', 'warning');
    return;
  }
  if (action !== 'MOVE_TO_DAMAGED' && quantity > (product.damagedStock || 0)) {
    showToast('Quantity cannot exceed current damaged stock (' + (product.damagedStock || 0) + ')', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-damaged-stock');
  isInventorySubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch('/api/inventory/damaged', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, action, quantity, reason, notes }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update damaged stock');

    closeModal();
    showToast(json.message || 'Damaged stock updated successfully', 'success');
    loadInventory();
  } catch (err) {
    showToast(err.message, 'danger');
  } finally {
    isInventorySubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save';
    }
  }
}

// ---------------------------------------------------------------------------
// Product Search Combobox Helpers (Real-Time Autocomplete)
// ---------------------------------------------------------------------------
let comboboxActiveIndex = -1;

function highlightComboboxMatch(text, query) {
  if (!text) return '';
  const str = String(text);
  if (!query || !query.trim()) return escapeHtml(str);
  const q = query.trim().toLowerCase();
  const lower = str.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return escapeHtml(str);
  const before = escapeHtml(str.slice(0, idx));
  const match = escapeHtml(str.slice(idx, idx + q.length));
  const after = highlightComboboxMatch(str.slice(idx + q.length), query);
  return before + '<mark style="background: #fef08a; color: #854d0e; padding: 0 2px; border-radius: 2px; font-weight: 700;">' + match + '</mark>' + after;
}

function handleProductSearchFocus(prefix) {
  const input = document.getElementById(prefix + '-search-input');
  const val = input ? input.value : '';
  renderProductComboboxDropdown(prefix, val);
  if (input && val) {
    input.select();
  }
}

function handleProductSearchInput(prefix, query) {
  const clearBtn = document.getElementById(prefix + '-clear-btn');
  if (clearBtn) {
    clearBtn.style.display = query && query.length > 0 ? 'inline-flex' : 'none';
  }
  renderProductComboboxDropdown(prefix, query);
}

function renderProductComboboxDropdown(prefix, query) {
  const dropdown = document.getElementById(prefix + '-dropdown');
  if (!dropdown) return;

  comboboxActiveIndex = -1;
  const q = (query || '').toLowerCase().trim();
  const allProducts = state.products || [];

  let matches = allProducts;
  if (q) {
    const terms = q.split(/\\s+/).filter(Boolean);
    matches = allProducts.filter((p) => {
      const sku = (p.sku || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return terms.every((t) => sku.includes(t) || name.includes(t) || cat.includes(t) || desc.includes(t));
    });
  }

  if (q) {
    matches.sort((a, b) => {
      const aSkuStarts = (a.sku || '').toLowerCase().startsWith(q) ? 1 : 0;
      const bSkuStarts = (b.sku || '').toLowerCase().startsWith(q) ? 1 : 0;
      if (aSkuStarts !== bSkuStarts) return bSkuStarts - aSkuStarts;
      const aNameStarts = (a.name || '').toLowerCase().startsWith(q) ? 1 : 0;
      const bNameStarts = (b.name || '').toLowerCase().startsWith(q) ? 1 : 0;
      if (aNameStarts !== bNameStarts) return bNameStarts - aNameStarts;
      return (b.onHandStock || 0) - (a.onHandStock || 0);
    });
  } else {
    matches = matches.slice().sort((a, b) => (b.onHandStock || 0) - (a.onHandStock || 0));
  }

  const limit = 45;
  const visible = matches.slice(0, limit);

  if (matches.length === 0) {
    dropdown.innerHTML = \`
      <div style="padding: 1.25rem 1rem; text-align: center; color: #64748b; font-size: 0.82rem;">
        No products found matching "<strong style="color: #0f172a;">\${escapeHtml(q)}</strong>"
      </div>
    \`;
    dropdown.style.display = 'block';
    return;
  }

  let headerText = q
    ? \`\${matches.length} matching product\${matches.length === 1 ? '' : 's'}\`
    : \`All products (\${matches.length})\`;

  let itemsHtml = '';
  const currentVal = document.getElementById(prefix + '-product')?.value;

  visible.forEach((p, idx) => {
    const isSelected = p.id === currentVal;
    const isStockPositive = (p.onHandStock || 0) > 0;
    const stockBadge = isStockPositive
      ? \`<span class="badge badge-success" style="font-size: 0.7rem; padding: 1px 6px;">\${p.onHandStock} in stock</span>\`
      : \`<span class="badge badge-secondary" style="font-size: 0.7rem; padding: 1px 6px; opacity: 0.85;">0 in stock</span>\`;

    const costDisplay = p.costPriceCents > 0
      ? \`Cost: <strong style="color: #334155;">\${formatCurrency(p.costPriceCents, p.costPriceCurrency)}</strong>\`
      : \`<span style="color: #94a3b8;">Cost: not set</span>\`;

    const categoryDisplay = p.category
      ? \`<span style="background: #f1f5f9; color: #475569; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 500;">\${escapeHtml(p.category)}</span>\`
      : '';

    itemsHtml += \`
      <div class="product-combobox-item \${isSelected ? 'selected' : ''}" 
           data-index="\${idx}" 
           data-product-id="\${p.id}" 
           onclick="selectProductFromSearch('\${prefix}', '\${p.id}')"
           style="padding: 0.65rem 0.85rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.12s ease; \${isSelected ? 'background: #f0fdf4;' : ''}">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 3px;">
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="font-family: monospace; font-size: 0.78rem; font-weight: 700; background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.02em;">
              \${highlightComboboxMatch(p.sku, q)}
            </span>
            \${categoryDisplay}
          </div>
          \${stockBadge}
        </div>
        <div style="font-size: 0.85rem; font-weight: 600; color: #0f172a; line-height: 1.35;">
          \${highlightComboboxMatch(p.name, q)}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.73rem; color: #64748b; margin-top: 3px;">
          <div>\${costDisplay}</div>
          \${isSelected ? '<span style="color: #16a34a; font-weight: 600; font-size: 0.72rem;">Selected</span>' : ''}
        </div>
      </div>
    \`;
  });

  const footerText = matches.length > limit
    ? \`<div style="padding: 0.4rem 0.85rem; font-size: 0.72rem; color: #64748b; background: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9;">Showing \${limit} of \${matches.length} products</div>\`
    : '';

  dropdown.innerHTML = \`
    <div style="padding: 0.4rem 0.85rem; font-size: 0.72rem; color: #64748b; background: #f8fafc; border-bottom: 1px solid #f1f5f9;">
      <span>\${headerText}</span>
    </div>
    <div style="max-height: 230px; overflow-y: auto;">
      \${itemsHtml}
    </div>
    \${footerText}
  \`;
  dropdown.style.display = 'block';
}

function selectProductFromSearch(prefix, productId) {
  const product = (state.products || []).find((p) => p.id === productId);
  if (!product) return;

  const hidden = document.getElementById(prefix + '-product');
  if (hidden) hidden.value = product.id;

  const input = document.getElementById(prefix + '-search-input');
  if (input) input.value = product.sku + ' — ' + product.name;

  const dropdown = document.getElementById(prefix + '-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  const clearBtn = document.getElementById(prefix + '-clear-btn');
  if (clearBtn) clearBtn.style.display = 'inline-flex';

  const card = document.getElementById(prefix + '-selected-card');
  if (card) {
    const isStockPositive = (product.onHandStock || 0) > 0;
    const isDamagedPositive = (product.damagedStock || 0) > 0;
    card.innerHTML = \`
      <div style="margin-top: 0.35rem; font-size: 0.78rem; color: #64748b; display: flex; align-items: center; justify-content: space-between;">
        <span>Available: <strong style="color: \${isStockPositive ? '#16a34a' : '#64748b'};">\${product.onHandStock} \${escapeHtml(product.unitOfMeasure || 'pcs')}</strong> | Damaged: <strong style="color: \${isDamagedPositive ? '#d97706' : '#64748b'};">\${product.damagedStock || 0}</strong></span>
        \${product.category ? \`<span style="color: #94a3b8;">\${escapeHtml(product.category)}</span>\` : ''}
      </div>
    \`;
  }

  if (prefix === 'add-stock') {
    handleAddStockProductChange();
    const qtyInput = document.getElementById('add-stock-qty');
    if (qtyInput) qtyInput.focus();
  } else if (prefix === 'adj') {
    const qtyInput = document.getElementById('adj-qty');
    if (qtyInput) qtyInput.focus();
  } else if (prefix === 'dmg') {
    handleDamagedActionChange();
    const qtyInput = document.getElementById('dmg-qty');
    if (qtyInput) qtyInput.focus();
  }
}

function clearProductSelection(prefix) {
  const hidden = document.getElementById(prefix + '-product');
  if (hidden) hidden.value = '';

  const input = document.getElementById(prefix + '-search-input');
  if (input) {
    input.value = '';
    input.focus();
  }

  const clearBtn = document.getElementById(prefix + '-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  const card = document.getElementById(prefix + '-selected-card');
  if (card) {
    card.innerHTML = '';
  }

  if (prefix === 'add-stock') {
    const hint = document.getElementById('add-stock-cost-hint');
    if (hint) hint.textContent = '';
    const costInput = document.getElementById('add-stock-cost');
    if (costInput) costInput.value = '';
  } else if (prefix === 'dmg') {
    const hintEl = document.getElementById('dmg-qty-hint');
    if (hintEl) hintEl.textContent = '';
  }

  renderProductComboboxDropdown(prefix, '');
}

function handleProductSearchKeydown(prefix, event) {
  const dropdown = document.getElementById(prefix + '-dropdown');
  if (!dropdown || dropdown.style.display === 'none') {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      renderProductComboboxDropdown(prefix, document.getElementById(prefix + '-search-input')?.value || '');
      event.preventDefault();
    }
    return;
  }

  const items = dropdown.querySelectorAll('.product-combobox-item');
  if (!items.length) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    comboboxActiveIndex = (comboboxActiveIndex + 1) % items.length;
    updateComboboxActiveItem(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    comboboxActiveIndex = (comboboxActiveIndex - 1 + items.length) % items.length;
    updateComboboxActiveItem(items);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (comboboxActiveIndex >= 0 && comboboxActiveIndex < items.length) {
      items[comboboxActiveIndex].click();
    } else if (items.length > 0) {
      items[0].click();
    }
  } else if (event.key === 'Escape') {
    dropdown.style.display = 'none';
  }
}

function updateComboboxActiveItem(items) {
  items.forEach((it, idx) => {
    if (idx === comboboxActiveIndex) {
      it.classList.add('active');
      it.style.backgroundColor = '#f1f5f9';
      it.scrollIntoView({ block: 'nearest' });
    } else {
      it.classList.remove('active');
      it.style.backgroundColor = '';
    }
  });
}

if (typeof window !== 'undefined' && !window._inventoryComboboxListenerAdded) {
  window._inventoryComboboxListenerAdded = true;
  document.addEventListener('click', function(e) {
    ['add-stock', 'adj', 'dmg'].forEach((prefix) => {
      const container = document.getElementById(prefix + '-combobox-container');
      const dropdown = document.getElementById(prefix + '-dropdown');
      if (dropdown && container && !container.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  });
}
`;
