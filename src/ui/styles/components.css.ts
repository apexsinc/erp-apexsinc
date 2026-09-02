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

.form-input, .form-select, .form-textarea {
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
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
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
  padding: 1.25rem 1.4rem;
  background-color: var(--sidebar-header);
  border-bottom: 1px solid var(--sidebar-border);
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
  overflow-x: auto;
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
/* PRINT STYLING & OFFICIAL VOUCHER SLIP EXPORT                               */
/* ========================================================================== */

@media print {
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }

  html, body {
    background: #ffffff !important;
    color: #000000 !important;
    font-size: 11pt !important;
    margin: 0 !important;
    padding: 0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .sidebar,
  .top-bar,
  .app-sidebar,
  .toast-container,
  .modal-header,
  .modal-footer,
  .modal-close-btn,
  .page-body > div:not(#view-accounting),
  .no-print,
  button {
    display: none !important;
  }

  .modal-backdrop {
    position: static !important;
    background: transparent !important;
    display: block !important;
    padding: 0 !important;
    overflow: visible !important;
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
  }

  .modal-body {
    padding: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }

  .official-voucher-sheet {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    page-break-inside: avoid !important;
  }
}
`;
