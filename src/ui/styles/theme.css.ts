export const THEME_CSS = `
:root {
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  
  /* Refined Corporate Sapphire & Slate Blue Palette */
  --primary: #1d4ed8;
  --primary-hover: #1e40af;
  --primary-light: #eff6ff;
  --primary-soft: #dbeafe;
  --primary-glow: rgba(29, 78, 216, 0.15);
  
  --secondary: #0284c7;
  --accent: #38bdf8;
  
  /* Canvas & Cards */
  --bg-app: #f8fafc;
  --bg-card: #ffffff;
  --bg-card-hover: #f1f5f9;
  --bg-input: #ffffff;
  
  /* Sidebar Deep Slate Blue */
  --sidebar-bg: #0b1528;
  --sidebar-header: #070e1c;
  --sidebar-text: #94a3b8;
  --sidebar-text-hover: #ffffff;
  --sidebar-active: #2563eb;
  --sidebar-active-bg: rgba(37, 99, 235, 0.14);
  --sidebar-border: #172544;

  /* Typography */
  --text-main: #0f172a;
  --text-muted: #64748b;
  --text-light: #94a3b8;
  --text-inverse: #ffffff;

  /* Borders */
  --border-color: #e2e8f0;
  --border-subtle: #f1f5f9;
  --border-focus: #2563eb;

  /* Status Colors */
  --success: #059669;
  --success-bg: #ecfdf5;
  --success-border: #a7f3d0;
  
  --warning: #d97706;
  --warning-bg: #fffbeb;
  --warning-border: #fde68a;
  
  --danger: #dc2626;
  --danger-bg: #fef2f2;
  --danger-border: #fecaca;
  
  --info: #0284c7;
  --info-bg: #f0f9ff;
  --info-border: #bae6fd;

  /* Shadow Elevation */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.07), 0 4px 6px -4px rgba(15, 23, 42, 0.03);
  --shadow-xl: 0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);

  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  
  --transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  background-color: var(--bg-app);
  color: var(--text-main);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;
