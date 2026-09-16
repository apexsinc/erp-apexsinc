/**
 * Floating Mobile Bottom Navigation Bar
 * Provides instant 1-tap thumb navigation between key operational modules on mobile devices.
 * Completely hidden on desktop viewports (> 768px).
 */
export function renderMobileBottomNav(): string {
  return `
    <nav class="mobile-bottom-nav" id="mobile-bottom-nav" aria-label="Mobile Navigation">
      <button type="button" class="bottom-nav-item active" data-tab="dashboard" onclick="switchTab('dashboard')" aria-label="Dashboard">
        <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span class="bnav-label">Dashboard</span>
      </button>

      <button type="button" class="bottom-nav-item" data-tab="directory" onclick="switchTab('directory')" aria-label="Business Directory">
        <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <span class="bnav-label">Directory</span>
      </button>

      <button type="button" class="bottom-nav-item" data-tab="inventory" onclick="switchTab('inventory')" aria-label="Inventory and Stock">
        <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <span class="bnav-label">Inventory</span>
      </button>

      <button type="button" class="bottom-nav-item" data-tab="vouchers" onclick="switchTab('vouchers')" aria-label="Payment Vouchers">
        <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <span class="bnav-label">Vouchers</span>
      </button>

      <button type="button" class="bottom-nav-item bottom-nav-menu-btn" onclick="toggleMobileSidebar()" aria-label="More Menu and Modules">
        <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="12" x2="20" y2="12"></line>
          <line x1="4" y1="6" x2="20" y2="6"></line>
          <line x1="4" y1="18" x2="20" y2="18"></line>
        </svg>
        <span class="bnav-label">Menu</span>
      </button>
    </nav>
  `;
}
