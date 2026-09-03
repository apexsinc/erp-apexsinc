export function renderTopbar(): string {
  return `
    <header class="top-bar">
      <div class="breadcrumbs">
        <span>Apexs ERP</span>
        <span>/</span>
        <span class="current" id="active-breadcrumb">Executive Dashboard</span>
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
