export const COMPONENTS_CSS = `
/* ========================================================================== */
/* FORMS & BUTTONS                                                            */
/* ========================================================================== */

.form-group {
  margin-bottom: 1.15rem;
}

.form-label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 0.35rem;
}

.form-input, .form-select, .form-textarea, .form-control {
  width: 100%;
  padding: 0.65rem 0.85rem;
  font-size: 0.88rem;
  font-family: inherit;
  color: var(--text-main);
  background-color: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition: var(--transition);
  outline: none;
  box-sizing: border-box;
}

.form-input:focus, .form-select:focus, .form-textarea:focus, .form-control:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.form-input::placeholder {
  color: var(--text-light);
}

.password-input-wrapper {
  position: relative;
}

.password-input-wrapper .form-input {
  padding-right: 2.5rem;
}

.password-toggle-btn {
  position: absolute;
  top: 50%;
  right: 0.6rem;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: var(--text-light);
  line-height: 0;
}

.password-toggle-btn:hover {
  color: var(--text-muted);
}

.password-toggle-btn svg {
  width: 18px;
  height: 18px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.65rem 1.15rem;
  font-size: 0.86rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: var(--transition);
  text-decoration: none;
  line-height: 1;
}

.btn svg {
  width: 15px;
  height: 15px;
  stroke-width: 2.2;
}

.btn-primary {
  background-color: var(--primary);
  color: #ffffff;
  border-color: var(--primary);
}

.btn-primary:hover {
  background-color: var(--primary-hover);
  border-color: var(--primary-hover);
}

.btn-secondary {
  background-color: #ffffff;
  color: var(--text-main);
  border-color: var(--border-color);
}

.btn-secondary:hover {
  background-color: var(--bg-card-hover);
  border-color: #cbd5e1;
}

.btn-sm {
  padding: 0.45rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.btn-success {
  background-color: var(--success);
  color: #ffffff;
  border-color: var(--success);
}
.btn-success:hover {
  background-color: #047857;
}

.btn-danger {
  background-color: var(--danger);
  color: #ffffff;
  border-color: var(--danger);
}

.btn-block {
  width: 100%;
}

/* ========================================================================== */
/* APP LAYOUT, SIDEBAR & TOPBAR                                               */
/* ========================================================================== */

.app-wrapper {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

.sidebar {
  width: 250px;
  background-color: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 40;
}

.sidebar-brand {
  padding: 1.15rem 1.35rem;
  background-color: var(--sidebar-header);
  border-bottom: 1px solid var(--sidebar-border);
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.brand-logo-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
}

.brand-icon {
  width: 32px;
  height: 32px;
  background: var(--primary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  font-size: 1rem;
}

.brand-text h1 {
  font-size: 0.98rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.2;
}

.brand-text span {
  font-size: 0.68rem;
  color: #60a5fa;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
}

.sidebar-menu {
  padding: 1rem 0.65rem;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/legacy Edge */
}

.sidebar-menu::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Edge Chromium */
}

.nav-section-title {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  font-weight: 700;
  padding: 0.6rem 0.75rem 0.35rem 0.75rem;
  margin-top: 0.4rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
  color: var(--sidebar-text);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  margin-bottom: 0.15rem;
  text-decoration: none;
}

.nav-item:hover {
  color: var(--sidebar-text-hover);
  background-color: rgba(255, 255, 255, 0.04);
}

.nav-item.active {
  color: #ffffff;
  background-color: var(--sidebar-active-bg);
  border-left: 3px solid var(--primary);
  font-weight: 600;
}

.nav-icon {
  width: 17px;
  height: 17px;
  opacity: 0.85;
}

.sidebar-footer {
  padding: 0.9rem 1.15rem;
  background-color: var(--sidebar-header);
  border-top: 1px solid var(--sidebar-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.admin-badge-box {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #1e293b;
  border: 1px solid #334155;
  color: #93c5fd;
  font-weight: 600;
  font-size: 0.78rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-info {
  line-height: 1.2;
}

.admin-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #ffffff;
}

.admin-role {
  font-size: 0.68rem;
  color: #94a3b8;
}

.btn-logout {
  background: transparent;
  border: 1px solid #334155;
  color: #94a3b8;
  padding: 0.35rem 0.55rem;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  align-items: center;
}

.btn-logout:hover {
  color: #ffffff;
  border-color: #64748b;
  background: rgba(255, 255, 255, 0.05);
}

.btn-logout svg {
  width: 14px;
  height: 14px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-x: hidden;
}

.top-bar {
  height: 58px;
  background-color: #ffffff;
  border-bottom: 1px solid var(--border-color);
  padding: 0 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 30;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.84rem;
  color: var(--text-muted);
}

.breadcrumbs span.current {
  color: var(--text-main);
  font-weight: 600;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.topbar-clock-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
  border: 1.5px solid #cbd5e1;
  border-radius: 9999px;
  padding: 0.4rem 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  user-select: none;
  transition: all 0.2s ease;
}

.topbar-clock-badge:hover {
  border-color: #94a3b8;
  background: #ffffff;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
}

.topbar-clock-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
  animation: pulse-clock-dot 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
  flex-shrink: 0;
}

@keyframes pulse-clock-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.35);
  }
  50% {
    opacity: 0.75;
    transform: scale(1.2);
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
}

.topbar-clock-date {
  font-weight: 700;
  font-size: 0.84rem;
  color: #1e293b;
  letter-spacing: -0.01em;
}

.topbar-clock-divider {
  width: 1.5px;
  height: 14px;
  background-color: #cbd5e1;
  border-radius: 1px;
}

.topbar-clock-time {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-weight: 800;
  font-size: 0.9rem;
  color: #0f172a;
  letter-spacing: 0.03em;
}

.page-body {
  padding: 1.75rem;
  flex: 1;
}

/* ========================================================================== */
/* KPI CARDS & GRID                                                           */
/* ========================================================================== */

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.kpi-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.2rem 1.35rem;
  box-shadow: var(--shadow-xs);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  transition: var(--transition);
}

.kpi-card:hover {
  border-color: #cbd5e1;
  box-shadow: var(--shadow-sm);
}

.kpi-content h3 {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
}

.kpi-value {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.02em;
}

.kpi-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
  font-weight: 500;
}

.kpi-icon-box {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--primary-light);
  color: var(--primary);
}

.kpi-icon-box svg {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

/* ========================================================================== */
/* DATA TABLES & PANELS                                                       */
/* ========================================================================== */

.panel-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
  margin-bottom: 1.25rem;
  overflow: hidden;
}

.panel-header {
  padding: 1rem 1.35rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
}

.panel-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.table-responsive {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.table-responsive table,
.table-responsive .data-table {
  min-width: 680px;
}

.category-pills-strip {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

.data-table th {
  background-color: #f8fafc;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.65rem 1.15rem;
  border-bottom: 1px solid var(--border-color);
}

.data-table td {
  padding: 0.75rem 1.15rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-main);
  vertical-align: middle;
}

.data-table tbody tr:hover {
  background-color: #f8fafc;
}

.data-table tbody tr.row-clickable {
  cursor: pointer;
}

.data-table tbody tr.row-clickable:hover {
  background-color: #eef2ff;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

/* ========================================================================== */
/* RESPONSIVE CASCADING & WRAP TABLES (VOUCHERS & DATA MODULES)               */
/* ========================================================================== */

/* Mobile Menu Button & Drawer Backdrop */
.mobile-menu-btn {
  display: none;
  background: #ffffff;
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  line-height: 0;
  transition: var(--transition);
}

.mobile-menu-btn:hover {
  background: var(--bg-card-hover);
  color: var(--primary);
  border-color: #cbd5e1;
}

.sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 998;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  transition: opacity 0.2s ease;
}

.sidebar-backdrop.active {
  display: block;
}

/* Voucher Module Containers */
.pv-card {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin-bottom: 1.25rem;
  border: none;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.pv-header {
  padding: 1.25rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  border-bottom: 1px solid var(--border-color);
  width: 100%;
  box-sizing: border-box;
}

.pv-header-actions {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  flex-wrap: wrap;
}

.pv-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-color);
  width: 100%;
  box-sizing: border-box;
}

.pv-kpi-item {
  background: #ffffff;
  padding: 1rem 1.15rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-sizing: border-box;
  min-width: 0;
}

.pv-filter-bar {
  padding: 0.85rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  width: 100%;
  box-sizing: border-box;
}

.pv-actions-group {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  flex-wrap: nowrap;
}

.pv-btn-compact {
  padding: 0.2rem 0.42rem !important;
  font-size: 0.72rem !important;
  line-height: 1.15 !important;
  border-radius: 4px !important;
  white-space: nowrap !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.2rem !important;
  box-shadow: none !important;
  height: auto !important;
}

.btn-history-badge-container {
  position: relative !important;
  overflow: visible !important;
}

.history-count-badge {
  position: absolute !important;
  top: -6px !important;
  right: -6px !important;
  min-width: 15px !important;
  height: 15px !important;
  border-radius: 9999px !important;
  font-size: 0.62rem !important;
  font-weight: 800 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 3px !important;
  line-height: 1 !important;
  border: 1.5px solid #ffffff !important;
  pointer-events: none !important;
  z-index: 2 !important;
  box-sizing: border-box !important;
}

.history-count-badge.has-records {
  background: #2563eb !important;
  color: #ffffff !important;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.45) !important;
}

.history-count-badge.zero-records {
  background: #94a3b8 !important;
  color: #ffffff !important;
}

.table-responsive-cascade {
  width: 100%;
  max-width: 100%;
  overflow-x: auto !important;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
}

.pv-compact-table {
  width: 100%;
  border-collapse: collapse;
}

.pv-compact-table th {
  padding: 0.42rem 0.55rem !important;
  font-size: 0.74rem !important;
  white-space: nowrap !important;
}

.pv-compact-table td {
  padding: 0.36rem 0.55rem !important;
  font-size: 0.81rem !important;
  vertical-align: middle !important;
}

/* Sticky right Actions column so buttons are always visible on small screens */
.pv-compact-table th.th-actions,
.pv-compact-table td.td-actions {
  position: sticky !important;
  right: 0 !important;
  background: #ffffff !important;
  z-index: 2 !important;
  box-shadow: -4px 0 8px -2px rgba(0, 0, 0, 0.08) !important;
  text-align: right !important;
  white-space: nowrap !important;
}

.pv-compact-table thead th.th-actions {
  background: #f8fafc !important;
  z-index: 3 !important;
}

.pv-compact-table tbody tr:hover td.td-actions {
  background: #f8fafc !important;
}

.btn-view-mode-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: #f1f5f9;
  padding: 3px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.btn-view-mode {
  background: transparent;
  border: none;
  padding: 0.32rem 0.6rem;
  font-size: 0.76rem;
  font-weight: 600;
  color: #64748b;
  border-radius: 4px;
  cursor: pointer;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  line-height: 1;
}

.btn-view-mode:hover {
  color: #0f172a;
  background: #e2e8f0;
}

.btn-view-mode.active {
  background: #ffffff;
  color: var(--primary);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* Explicit Card View Mode (.view-mode-cards) */
.responsive-cascade-table.view-mode-cards {
  display: block;
  width: 100%;
  border: none;
}

.responsive-cascade-table.view-mode-cards thead {
  display: none;
}

.responsive-cascade-table.view-mode-cards tbody {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
  padding: 1.25rem;
  background: #f8fafc;
}

.responsive-cascade-table.view-mode-cards tbody tr {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.15rem;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
  position: relative;
  gap: 0.45rem;
}

.responsive-cascade-table.view-mode-cards tbody tr:hover {
  border-color: #cbd5e1;
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  background: #ffffff;
}

.responsive-cascade-table.view-mode-cards tbody tr.empty-row {
  grid-column: 1 / -1;
  display: block;
  border: none;
  box-shadow: none;
  background: transparent;
  transform: none;
  padding: 2rem 0;
}

.responsive-cascade-table.view-mode-cards tbody tr.empty-row td {
  display: block;
  text-align: center !important;
  padding: 2rem;
  color: #64748b;
  border: none;
}

.responsive-cascade-table.view-mode-cards tbody tr.empty-row td::before {
  display: none;
}

.responsive-cascade-table.view-mode-cards td {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.84rem;
  text-align: left !important;
  min-height: 28px;
}

.responsive-cascade-table.view-mode-cards td:last-child {
  border-bottom: none;
}

.responsive-cascade-table.view-mode-cards td::before {
  content: attr(data-label);
  font-weight: 700;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.responsive-cascade-table.view-mode-cards td.td-voucher-num {
  order: 1;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.65rem;
  margin-bottom: 0.25rem;
  font-size: 1.05rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.responsive-cascade-table.view-mode-cards td.td-voucher-num::before {
  display: none;
}

.pv-card-amount {
  display: none;
}

.responsive-cascade-table.view-mode-cards .pv-card-amount {
  display: inline-flex !important;
  align-items: center !important;
}

.responsive-cascade-table.view-mode-cards td.td-amount {
  display: none !important;
}

.responsive-cascade-table.view-mode-cards td.td-recipient {
  order: 3;
  font-size: 0.92rem;
}

.responsive-cascade-table.view-mode-cards td.td-date {
  order: 4;
}

.responsive-cascade-table.view-mode-cards td.td-type {
  order: 5;
}

.responsive-cascade-table.view-mode-cards td.td-status {
  order: 6;
}

.responsive-cascade-table.view-mode-cards td.td-method {
  order: 7;
}

.responsive-cascade-table.view-mode-cards td.td-tag {
  order: 8;
}

.responsive-cascade-table.view-mode-cards td.td-remarks {
  order: 9;
}

.responsive-cascade-table.view-mode-cards td.td-remarks div {
  max-width: 100% !important;
  white-space: normal !important;
  word-break: break-word;
  text-align: right;
}

.responsive-cascade-table.view-mode-cards td.td-actions {
  order: 10;
  border-top: 1px solid #e2e8f0;
  border-bottom: none;
  padding-top: 0.75rem;
  margin-top: 0.4rem;
  justify-content: flex-end;
  gap: 0.4rem;
  flex-wrap: wrap;
  white-space: normal !important;
}

.responsive-cascade-table.view-mode-cards td.td-actions::before {
  display: none;
}

/* ========================================================================== */
/* UNIVERSAL RESPONSIVE ENGINE & BREAKPOINTS                                  */
/* ========================================================================== */

@media (min-width: 1600px) {
  .page-body {
    max-width: 1780px;
    margin: 0 auto;
    width: 100%;
  }
}

@media (min-width: 993px) and (max-width: 1280px) {
  .sidebar {
    width: 235px !important;
  }
  .page-body {
    padding: 1.25rem 1.35rem !important;
  }
}

/* Responsive Auto-Cascade & Tablet/Mobile Optimization (Screen Width <= 992px) */
@media (max-width: 992px) {
  /* Mobile Sidebar Off-Canvas Navigation */
  .mobile-menu-btn {
    display: inline-flex !important;
  }

  .sidebar {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    bottom: 0 !important;
    width: 275px !important;
    max-width: 84vw !important;
    z-index: 1000 !important;
    transform: translateX(-100%);
    transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4) !important;
  }

  .sidebar.mobile-open {
    transform: translateX(0) !important;
  }

  .app-wrapper {
    width: 100% !important;
    max-width: 100vw !important;
    overflow-x: hidden !important;
  }

  .main-content {
    width: 100% !important;
    max-width: 100vw !important;
    min-width: 0 !important;
    overflow-x: hidden !important;
  }

  .top-bar {
    padding: 0 1rem !important;
    gap: 0.5rem !important;
  }

  .topbar-clock-badge {
    padding: 0.25rem 0.6rem !important;
    font-size: 0.76rem !important;
  }

  .breadcrumbs {
    font-size: 0.82rem !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .page-body {
    padding: 1rem 0.85rem !important;
    width: 100% !important;
    max-width: 100vw !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
  }

  .kpi-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 0.85rem !important;
  }

  .inventory-smart-scroll,
  .directory-smart-scroll {
    max-height: calc(100vh - 240px) !important;
  }

  /* Voucher module container responsive wrapping */
  .pv-header {
    padding: 0.85rem !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0.75rem !important;
  }

  .pv-header-actions {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 0.45rem !important;
    width: 100% !important;
  }

  .pv-header-actions button {
    width: 100% !important;
    justify-content: center !important;
    padding: 0.42rem 0.55rem !important;
    font-size: 0.78rem !important;
  }

  .pv-kpi-grid {
    padding: 0.75rem !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 0.55rem !important;
  }

  .pv-kpi-item {
    padding: 0.75rem 0.85rem !important;
  }

  .pv-filter-bar {
    padding: 0.75rem !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0.65rem !important;
  }

  .pv-filter-bar > div:first-child {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0.55rem !important;
    width: 100% !important;
  }

  .pv-filter-bar input[type="text"] {
    max-width: 100% !important;
    width: 100% !important;
  }

  .pv-filter-bar .btn-view-mode-group {
    width: 100% !important;
    display: flex !important;
  }

  .pv-filter-bar .btn-view-mode-group .btn-view-mode {
    flex: 1 !important;
    justify-content: center !important;
    text-align: center !important;
  }

  /* RESPONSIVE SCROLLING & ADAPTIVE COMPACT */
  .table-responsive-cascade {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    overflow-y: visible !important;
    box-sizing: border-box !important;
  }

  .responsive-cascade-table:not(.view-mode-table),
  .responsive-cascade-table.view-mode-cards {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    border: none !important;
    box-sizing: border-box !important;
  }

  .responsive-cascade-table:not(.view-mode-table) thead,
  .responsive-cascade-table.view-mode-cards thead {
    display: none !important;
  }

  .responsive-cascade-table:not(.view-mode-table) tbody,
  .responsive-cascade-table.view-mode-cards tbody {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0.65rem 0.35rem !important;
    gap: 0.75rem !important;
    background: #f8fafc !important;
    box-sizing: border-box !important;
  }

  .responsive-cascade-table:not(.view-mode-table) tbody tr,
  .responsive-cascade-table.view-mode-cards tbody tr {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    background: #ffffff !important;
    border: 1px solid var(--border-color) !important;
    border-radius: var(--radius-md) !important;
    padding: 0.85rem 0.95rem !important;
    box-shadow: var(--shadow-sm) !important;
    gap: 0.4rem !important;
    overflow: hidden !important;
    margin: 0 !important;
  }

  .responsive-cascade-table:not(.view-mode-table) tbody tr.empty-row,
  .responsive-cascade-table.view-mode-cards tbody tr.empty-row {
    display: block !important;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 1.5rem 0 !important;
  }

  .responsive-cascade-table:not(.view-mode-table) tbody tr.empty-row td,
  .responsive-cascade-table.view-mode-cards tbody tr.empty-row td {
    display: block !important;
    text-align: center !important;
    padding: 1.5rem !important;
    color: #64748b !important;
    border: none !important;
  }

  .responsive-cascade-table:not(.view-mode-table) tbody tr.empty-row td::before,
  .responsive-cascade-table.view-mode-cards tbody tr.empty-row td::before {
    display: none !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td,
  .responsive-cascade-table.view-mode-cards td {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 0.32rem 0 !important;
    border-bottom: 1px solid #f1f5f9 !important;
    font-size: 0.84rem !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    min-height: 26px !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    text-align: left !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td:last-child,
  .responsive-cascade-table.view-mode-cards td:last-child {
    border-bottom: none !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td::before,
  .responsive-cascade-table.view-mode-cards td::before {
    content: attr(data-label) !important;
    font-weight: 700 !important;
    font-size: 0.72rem !important;
    text-transform: uppercase !important;
    letter-spacing: 0.04em !important;
    color: #64748b !important;
    margin-right: 0.6rem !important;
    flex-shrink: 0 !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-voucher-num,
  .responsive-cascade-table.view-mode-cards td.td-voucher-num {
    order: 1 !important;
    border-bottom: 1.5px solid #e2e8f0 !important;
    padding-bottom: 0.55rem !important;
    margin-bottom: 0.2rem !important;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    width: 100% !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-voucher-num::before,
  .responsive-cascade-table.view-mode-cards td.td-voucher-num::before {
    display: none !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-amount,
  .responsive-cascade-table.view-mode-cards td.td-amount {
    display: none !important;
  }

  .responsive-cascade-table:not(.view-mode-table) .pv-card-amount,
  .responsive-cascade-table.view-mode-cards .pv-card-amount {
    display: inline-flex !important;
    align-items: center !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-recipient,
  .responsive-cascade-table.view-mode-cards td.td-recipient {
    order: 3 !important;
    font-size: 0.9rem !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-date,
  .responsive-cascade-table.view-mode-cards td.td-date {
    order: 4 !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-type,
  .responsive-cascade-table.view-mode-cards td.td-type {
    order: 5 !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-status,
  .responsive-cascade-table.view-mode-cards td.td-status {
    order: 6 !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-method,
  .responsive-cascade-table.view-mode-cards td.td-method {
    order: 7 !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-tag,
  .responsive-cascade-table.view-mode-cards td.td-tag {
    order: 8 !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-remarks,
  .responsive-cascade-table.view-mode-cards td.td-remarks {
    order: 9 !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-remarks div,
  .responsive-cascade-table.view-mode-cards td.td-remarks div {
    max-width: 100% !important;
    white-space: normal !important;
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
    text-align: right !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-actions,
  .responsive-cascade-table.view-mode-cards td.td-actions {
    order: 10 !important;
    border-top: 1px solid #e2e8f0 !important;
    border-bottom: none !important;
    padding-top: 0.65rem !important;
    margin-top: 0.3rem !important;
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 0.35rem !important;
    justify-content: flex-start !important;
    width: 100% !important;
    white-space: normal !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-actions::before,
  .responsive-cascade-table.view-mode-cards td.td-actions::before {
    display: none !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-actions .pv-actions-group,
  .responsive-cascade-table.view-mode-cards td.td-actions .pv-actions-group {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 0.35rem !important;
    width: 100% !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-actions button,
  .responsive-cascade-table.view-mode-cards td.td-actions button {
    flex: 1 1 calc(33.3% - 0.35rem) !important;
    min-width: 55px !important;
    max-width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
    padding: 0.35rem 0.45rem !important;
    font-size: 0.74rem !important;
  }
}

/* Responsive Tablet & Mobile System (Screen Width <= 768px) */
@media (max-width: 768px) {
  .breadcrumb-root,
  .breadcrumb-sep {
    display: none !important;
  }

  .breadcrumbs {
    font-size: 0.86rem !important;
    font-weight: 600 !important;
    max-width: 60vw;
  }

  .topbar-clock-date,
  .topbar-clock-divider {
    display: none !important;
  }

  .topbar-clock-badge {
    padding: 0.28rem 0.65rem !important;
  }

  .panel-header {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0.75rem !important;
    padding: 0.9rem 1rem !important;
  }

  .panel-actions {
    display: flex !important;
    flex-wrap: wrap !important;
    width: 100% !important;
    gap: 0.45rem !important;
  }

  .panel-actions .btn,
  .panel-actions button,
  .panel-actions a {
    flex: 1 1 auto !important;
    justify-content: center !important;
  }

  .category-pills-strip {
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    scrollbar-width: none !important;
    padding-bottom: 6px !important;
  }

  .category-pills-strip::-webkit-scrollbar {
    display: none !important;
  }

  .category-pills-strip button {
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }

  .modal-backdrop {
    padding: 0.5rem !important;
    align-items: center !important;
  }

  .modal-dialog,
  .modal-dialog-sm,
  .modal-dialog-lg,
  .modal-dialog-xl {
    max-width: 100% !important;
    width: 100% !important;
    max-height: calc(100dvh - 1rem) !important;
    margin: 0 auto !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .modal-body {
    max-height: calc(100dvh - 125px) !important;
    padding: 1rem !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }

  .modal-header {
    padding: 0.95rem 1.15rem !important;
  }
}

/* Responsive Grid Auto-Collapse & Mobile Ergonomics (Screen Width <= 640px) */
@media (max-width: 640px) {
  /* Automatically collapse multi-column form grids inside modals and views into single column */
  .modal-body form div[style*="grid-template-columns"],
  .modal-dialog form div[style*="grid-template-columns"],
  form div[style*="grid-template-columns: 1fr 1fr"],
  form div[style*="grid-template-columns: 1fr 1fr 1fr"],
  form div[style*="grid-template-columns: 1.25fr 0.75fr"],
  form div[style*="grid-template-columns: 2fr 1fr"],
  form div[style*="grid-template-columns: 1fr 2fr"],
  form div[style*="grid-template-columns: repeat(2"],
  form div[style*="grid-template-columns: repeat(3"],
  form div[style*="grid-template-columns: repeat(4"] {
    grid-template-columns: 1fr !important;
    gap: 0.75rem !important;
  }

  .kpi-grid {
    grid-template-columns: 1fr !important;
    gap: 0.65rem !important;
  }

  .kpi-value {
    font-size: 1.3rem !important;
  }

  .inventory-scroll-pill,
  .directory-scroll-pill {
    bottom: 0.75rem !important;
    right: 0.75rem !important;
    padding: 0.35rem 0.75rem !important;
    font-size: 0.72rem !important;
  }
}

/* Small Smartphone Optimization (Screen Width <= 480px) */
@media (max-width: 480px) {
  .page-body {
    padding: 0.65rem 0.45rem !important;
  }

  .top-bar {
    padding: 0 0.65rem !important;
  }

  .topbar-clock-badge {
    padding: 0.2rem 0.45rem !important;
  }

  .topbar-clock-time {
    font-size: 0.78rem !important;
  }

  .pv-header-actions {
    grid-template-columns: 1fr !important;
  }

  .pv-kpi-grid {
    grid-template-columns: 1fr !important;
  }

  .responsive-cascade-table:not(.view-mode-table) td.td-actions button,
  .responsive-cascade-table.view-mode-cards td.td-actions button {
    flex: 1 1 calc(50% - 0.35rem) !important;
  }

  .modal-footer {
    flex-direction: column-reverse !important;
    gap: 0.5rem !important;
    padding: 0.75rem 1rem !important;
  }

  .modal-footer button,
  .modal-footer .btn {
    width: 100% !important;
    justify-content: center !important;
  }

  .toast-container {
    bottom: 0.75rem !important;
    right: 0.75rem !important;
    left: 0.75rem !important;
  }

  .toast {
    max-width: 100% !important;
  }
}

/* Micro-screen fallback (Screen Width <= 360px) */
@media (max-width: 360px) {
  .topbar-clock-badge {
    display: none !important;
  }
  .breadcrumbs {
    font-size: 0.8rem !important;
  }
}

/* Status Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1;
  border: 1px solid transparent;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.badge-success { background: var(--success-bg); color: var(--success); border-color: var(--success-border); }
.badge-primary { background: var(--primary-light); color: var(--primary); border-color: var(--primary-soft); }
.badge-warning { background: var(--warning-bg); color: var(--warning); border-color: var(--warning-border); }
.badge-danger { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-border); }
.badge-info { background: var(--info-bg); color: var(--info); border-color: var(--info-border); }
.badge-neutral { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }

/* ========================================================================== */
/* MODALS & DIALOGS                                                           */
/* ========================================================================== */

.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
  animation: fadeIn 0.15s ease;
}

.modal-dialog {
  background: #ffffff;
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 540px;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  border: 1px solid var(--border-color);
  animation: slideUp 0.2s ease-out;
}

.modal-dialog-sm {
  max-width: 440px;
}

.modal-dialog-lg {
  max-width: 760px;
}

.modal-dialog-xl {
  max-width: 920px;
}

.modal-header {
  padding: 1.15rem 1.35rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
}

.modal-header h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-main);
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 1.15rem;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 0.2rem;
  border-radius: var(--radius-xs);
}

.modal-close-btn:hover {
  color: var(--text-main);
  background: var(--bg-card-hover);
}

.modal-body {
  padding: 1.35rem;
  max-height: 72vh;
  overflow-y: auto;
}

.modal-footer {
  padding: 0.9rem 1.35rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  background: #f8fafc;
}

/* ========================================================================== */
/* TOAST NOTIFICATION                                                         */
/* ========================================================================== */

.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toast {
  background: #0f172a;
  color: #ffffff;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  font-size: 0.84rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  animation: slideInRight 0.25s ease;
  min-width: 260px;
}

.toast.toast-success { border-left: 3px solid var(--success); }
.toast.toast-danger { border-left: 3px solid var(--danger); }
.toast.toast-info { border-left: 3px solid var(--primary); }

/* Keyframe Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(25px); }
  to { opacity: 1; transform: translateX(0); }
}

/* ========================================================================== */
/* ACTION BUTTONS & HOVER TOOLTIPS                                            */
/* ========================================================================== */

.action-btn-group {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: nowrap;
}

.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  padding: 0;
  text-decoration: none;
}

.icon-btn svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  pointer-events: none;
}

.icon-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
}

.icon-btn-view:hover {
  background: #f1f5f9;
  color: #1e293b;
  border-color: #cbd5e1;
}

.icon-btn-edit:hover {
  background: #eff6ff;
  color: #2563eb;
  border-color: #93c5fd;
}

.icon-btn-approve:hover {
  background: #f0fdf4;
  color: #16a34a;
  border-color: #86efac;
}

.icon-btn-decline:hover {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fca5a5;
}

.icon-btn-restore:hover {
  background: #f0fdfa;
  color: #0d9488;
  border-color: #5eead4;
}

.icon-btn-delete:hover {
  background: #fff1f2;
  color: #e11d48;
  border-color: #fda4af;
}

/* Tooltip on hover */
.has-tooltip {
  position: relative;
}

.has-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 7px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  background: #0f172a;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
  z-index: 100;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  line-height: 1.2;
}

.has-tooltip::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  border-width: 5px 5px 0 5px;
  border-style: solid;
  border-color: #0f172a transparent transparent transparent;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
  z-index: 100;
}

.has-tooltip:hover::after,
.has-tooltip:hover::before {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

/* ========================================================================== */
/* SUB-NAV TABS & SETTINGS LAYOUT                                             */
/* ========================================================================== */

.sub-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
}

.sub-nav-item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.15rem;
  border-radius: 999px;
  font-size: 0.84rem;
  font-weight: 600;
  border: 1px solid var(--border-color);
  background: #ffffff;
  color: var(--text-main);
  cursor: pointer;
  transition: var(--transition);
  text-decoration: none;
}

.sub-nav-item:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}

.sub-nav-item.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
  box-shadow: 0 2px 5px rgba(29, 78, 216, 0.25);
}

.sub-nav-item svg {
  flex-shrink: 0;
}

/* SETTINGS 4-TAB BAR & HEADER LAYOUT */
.settings-tab-bar {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.settings-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.52rem 1.15rem;
  border-radius: 7px;
  font-size: 0.84rem;
  font-weight: 600;
  border: 1px solid transparent;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  white-space: nowrap;
}

.settings-tab-btn:hover {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.7);
}

.settings-tab-btn.active {
  background: #ffffff;
  color: var(--primary);
  font-weight: 700;
  border-color: #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.settings-tab-btn svg {
  flex-shrink: 0;
  color: inherit;
}

.settings-tab-btn.active svg {
  color: var(--primary);
}

@media (max-width: 768px) {
  .settings-header-top {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0.85rem !important;
  }
  .settings-header-actions {
    width: 100% !important;
    justify-content: flex-end !important;
  }
  .settings-tabs-strip {
    padding: 0.65rem 0.85rem !important;
  }
  .settings-tab-bar {
    width: 100% !important;
    overflow-x: auto !important;
    justify-content: flex-start !important;
  }
  .settings-tab-btn {
    padding: 0.45rem 0.85rem !important;
    font-size: 0.78rem !important;
  }
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.settings-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: var(--transition);
}

.settings-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.settings-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.settings-card-icon {
  width: 36px;
  height: 36px;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  flex-shrink: 0;
}

.settings-card-title {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--text-main);
}

.settings-card-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 1.25rem;
  line-height: 1.4;
}

.toggle-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.9rem;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.toggle-option:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.tag-badge-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-main);
  transition: var(--transition);
}

.tag-badge-item:hover {
  background: #e2e8f0;
}

.tag-badge-item button {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
}

.tag-badge-item button:hover {
  color: #dc2626;
}

/* ========================================================================== */
/* OFFICIAL DELIVERY RECEIPT (DR) SHEET STYLING                              */
/* ========================================================================== */

.official-dr-sheet {
  background: #ffffff;
  color: #000000;
  padding: 2.25rem 2.5rem;
  font-family: Arial, Helvetica, sans-serif;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  max-width: 820px;
  margin: 0 auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}

.official-dr-sheet table {
  border-collapse: collapse;
  width: 100%;
}

.official-dr-sheet th,
.official-dr-sheet td {
  border: 1.5px solid #000000;
}

/* ========================================================================== */
/* PRINT STYLING & OFFICIAL VOUCHER / DR SLIP EXPORT                          */
/* ========================================================================== */

@media print {
  @page {
    size: auto;
    margin: 18mm 18mm 12mm 18mm;
  }

  html, body {
    background: #ffffff !important;
    color: #000000 !important;
    font-size: 10pt !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Universal hide for non-printable navigation, chrome, headers and buttons */
  #login-view,
  .sidebar,
  .top-bar,
  .app-sidebar,
  .toast-container,
  .modal-header,
  .modal-footer,
  .modal-close-btn,
  .no-print,
  button,
  input,
  select {
    display: none !important;
  }

  /* When printing an open modal (e.g. Official Voucher Slip or Delivery Receipt), completely hide the underlying app shell */
  body.modal-open #app-view,
  body:has(#modal-backdrop:not([style*="display: none"])) #app-view {
    display: none !important;
  }

  /* When modal is closed / not open, hide the modal container */
  body:not(.modal-open) #modal-backdrop,
  #modal-backdrop[style*="display: none"] {
    display: none !important;
  }

  /* Clean modal print formatting */
  .modal-backdrop {
    position: static !important;
    background: transparent !important;
    display: block !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: visible !important;
    inset: auto !important;
    animation: none !important;
  }

  .modal-dialog,
  .modal-dialog-lg,
  .modal-dialog-xl {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    background: transparent !important;
    animation: none !important;
  }

  .modal-body {
    padding: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }

  .official-voucher-sheet,
  .official-dr-sheet {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 auto !important;
    width: 100% !important;
    max-width: 100% !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    font-size: 8.5pt !important;
    box-sizing: border-box !important;
  }

  .official-voucher-sheet table,
  .official-dr-sheet table {
    border-collapse: collapse !important;
    width: 100% !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  .official-voucher-sheet th,
  .official-voucher-sheet td,
  .official-dr-sheet th,
  .official-dr-sheet td {
    border: 1.5px solid #000000 !important;
    padding: 2px 5px !important;
  }

  /* When printing financial reports directly from the main view (no modal) */
  body:not(.modal-open) .page-body > div:not(#view-accounting) {
    display: none !important;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #cbd5e1;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: middle;
}

.pv-load-more-btn {
  transition: var(--transition);
}

.pv-load-more-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
`;
