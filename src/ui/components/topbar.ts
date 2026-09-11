export function renderTopbar(): string {
  return `
    <header class="top-bar">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <button type="button" class="mobile-menu-btn" onclick="toggleMobileSidebar()" aria-label="Toggle Navigation Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width: 20px; height: 20px;"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="breadcrumbs">
          <span>Apexs ERP</span>
          <span>/</span>
          <span class="current" id="active-breadcrumb">Executive Dashboard</span>
        </div>
      </div>

      <div class="top-actions">
        <div class="topbar-clock-badge" id="live-clock-badge" title="Live System Date & Time">
          <span class="topbar-clock-dot"></span>
          <span class="topbar-clock-date" id="live-system-date">Loading date...</span>
          <span class="topbar-clock-divider"></span>
          <span class="topbar-clock-time" id="live-system-time">--:--:--</span>
        </div>
      </div>
    </header>
  `;
}
