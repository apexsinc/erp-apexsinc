export const AUTH_CSS = `
/* ========================================================================== */
/* AUTH / LOGIN SCREEN                                                        */
/* ========================================================================== */

.login-container {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #070e1c 0%, #0f1d38 50%, #172d54 100%);
  padding: 1.5rem;
  position: fixed;
  inset: 0;
  z-index: 999;
}

.login-card {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  border-radius: var(--radius-lg);
  padding: 2.75rem 2.25rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 10;
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.85rem;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

.login-icon-box {
  width: 48px;
  height: 48px;
  background: var(--primary);
  color: #ffffff;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.25rem auto;
  font-size: 1.35rem;
  font-weight: 800;
  box-shadow: 0 4px 14px rgba(29, 78, 216, 0.35);
}

.login-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.login-subtitle {
  font-size: 0.88rem;
  color: var(--text-muted);
  margin-top: 0.4rem;
}

.login-card .form-group {
  margin-bottom: 1.25rem;
  text-align: left;
}

.login-card .form-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 0.4rem;
  display: block;
}

.login-card .form-input {
  width: 100%;
  padding: 0.75rem 0.95rem;
  font-size: 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background-color: #ffffff;
  color: var(--text-main);
  transition: var(--transition);
  box-sizing: border-box;
}

.login-card .form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
  outline: none;
}

.login-card .btn-primary {
  padding: 0.8rem 1.25rem;
  font-size: 0.92rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  letter-spacing: 0.01em;
  margin-top: 1.5rem;
}
`;
