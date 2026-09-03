export function renderTopbar(): string {
  return `
    <header class="top-bar">
      <div class="breadcrumbs">
        <span>Apexs ERP</span>
        <span>/</span>
        <span class="current" id="active-breadcrumb">Executive Dashboard</span>
      </div>

      <div class="top-actions">
        <span class="badge badge-success" id="live-clock-badge" style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; letter-spacing: 0.02em;">
          <span class="badge-dot"></span>
          <span id="live-system-clock">Loading time...</span>
        </span>
      </div>
    </header>
  `;
}
