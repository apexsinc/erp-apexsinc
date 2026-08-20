export function renderTopbar(): string {
  return `
    <header class="top-bar">
      <div class="breadcrumbs">
        <span>Apexs ERP</span>
        <span>/</span>
        <span class="current" id="active-breadcrumb">Executive Dashboard</span>
      </div>

      <div class="top-actions">
        <span class="badge badge-success">
          <span class="badge-dot"></span>
          System Online
        </span>
      </div>
    </header>
  `;
}
