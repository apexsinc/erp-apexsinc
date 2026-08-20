import { APP_CSS } from './styles';
import { renderSidebar, renderTopbar, renderModalAndToasts } from './components';
import {
  renderLoginView,
  renderDashboardView,
  renderInventoryView,
  renderPurchasingView,
  renderInboundView,
  renderSalesView,
  renderAccountingView,
  renderPayrollView,
  renderAdminView,
} from './views';
import { APP_CLIENT_JS } from './app.client';
import type { Module, Role } from '../lib/permissions';

export * from './styles';
export * from './components';
export * from './views';
export * from './app.client';

/**
 * Renders the complete Single Page Application HTML markup
 * directly for Cloudflare Workers edge delivery.
 *
 * `rolePermissions` (role -> visible module list) is computed server-side
 * from the DB-backed permission matrix (src/lib/permissions.ts) and
 * serialized here so the client router can show/hide sidebar items and
 * tabs without re-implementing the rules.
 */
export function renderAppHtml(rolePermissions: Record<Role, Module[]>, options: { turnstileSiteKey?: string } = {}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apexs ERP — Enterprise Business Management</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    ${APP_CSS}
  </style>
  <script>window.__ROLE_PERMISSIONS__ = ${JSON.stringify(rolePermissions)};</script>
</head>
<body>

  <!-- 1. AUTHENTICATION / LOGIN VIEW -->
  ${renderLoginView(options.turnstileSiteKey)}

  <!-- 2. MAIN APPLICATION SHELL -->
  <div id="app-view" class="app-wrapper" style="display: none;">
    <!-- SIDEBAR NAVIGATION -->
    ${renderSidebar()}

    <!-- MAIN CONTENT VIEWPORT -->
    <main class="main-content">
      <!-- TOP NAVIGATION BAR -->
      ${renderTopbar()}

      <!-- ACTIVE TAB SUBVIEWS -->
      <div class="page-body">
        ${renderDashboardView()}
        ${renderInventoryView()}
        ${renderPurchasingView()}
        ${renderInboundView()}
        ${renderSalesView()}
        ${renderAccountingView()}
        ${renderPayrollView()}
        ${renderAdminView()}
      </div>
    </main>
  </div>

  <!-- REUSABLE MODALS & TOAST NOTIFICATIONS -->
  ${renderModalAndToasts()}

  <!-- COMPILED CLIENT CONTROLLER SCRIPT -->
  <script>
    ${APP_CLIENT_JS}
  </script>
</body>
</html>
`;
}
