export function renderTopbar(): string {
  return `
    <header class="top-bar" style="width: 100% !important; max-width: 100vw !important; border-radius: 0 !important; left: 0 !important; right: 0 !important; top: 0 !important; margin: 0 !important; height: calc(66px + env(safe-area-inset-top, 0px)) !important; min-height: calc(66px + env(safe-area-inset-top, 0px)) !important; padding-top: env(safe-area-inset-top, 0px) !important; padding-bottom: 0 !important; box-sizing: border-box !important;">
      <div class="topbar-left" style="height: 66px; display: flex; align-items: center;">
        <button type="button" class="mobile-menu-btn" onclick="toggleMobileSidebar()" aria-label="Toggle Navigation Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
        </button>

        <div class="mobile-brand-pill" onclick="switchTab('dashboard')" style="cursor: pointer;">
          <img src="/assets/logo.png" alt="Apexs ERP Logo" class="mobile-nav-logo" />
          <div class="mobile-brand-text">
            <span class="mobile-brand-title">Apexs ERP</span>
            <span class="mobile-brand-sub" id="mobile-brand-current">Dashboard</span>
          </div>
        </div>

        <div class="breadcrumbs">
          <span class="breadcrumb-root">Apexs ERP</span>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current current" id="active-breadcrumb">Executive Dashboard</span>
        </div>
      </div>

      <div class="top-actions" style="height: 66px; display: flex; align-items: center;">
        <button type="button" class="btn btn-secondary btn-sm" id="install-app-topbar-btn" onclick="handleInstallAppClick()" style="display: none; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; font-size: 0.8rem; font-weight: 600; border-radius: 8px;" title="Install Apexs ERP on your device">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>Install</span>
        </button>

        <div class="topbar-clock-badge" id="live-clock-badge" title="Live System Date & Time">
          <span class="topbar-clock-dot"></span>
          <span class="topbar-clock-date" id="live-system-date">Loading date...</span>
          <span class="topbar-clock-divider"></span>
          <span class="topbar-clock-time" id="live-system-time">--:--:--</span>
        </div>

        <button type="button" class="mobile-user-avatar-btn" onclick="toggleMobileSidebar()" aria-label="Open Account Menu" title="User Profile">
          <span class="mobile-avatar-text" id="mobile-avatar-initials">AD</span>
        </button>
      </div>
    </header>
  `;
}
