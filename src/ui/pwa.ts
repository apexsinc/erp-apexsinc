export const MANIFEST_JSON = JSON.stringify(
  {
    name: 'Apexs ERP — Enterprise Business Management',
    short_name: 'Apexs ERP',
    description: 'Enterprise Resource Planning & Business Management System for Apexs, Inc.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    categories: ['business', 'productivity', 'finance'],
    icons: [
      {
        src: '/assets/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/assets/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/assets/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  },
  null,
  2
);

export const SERVICE_WORKER_JS = `
const CACHE_NAME = 'apexs-erp-v17';

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/assets/logo.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests with HTTP/HTTPS schemes
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  // Let browser natively handle Google fonts (prevents WOFF2 decompression / OTS parsing corruption)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return;
  }

  // API calls are network-first with graceful offline JSON response
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({ success: false, error: 'Offline - Unable to connect to Apexs ERP cloud' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // Navigation & HTML document requests: Network-first with cached shell fallback
  const isHtmlRequest =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    (req.headers.get('accept') && req.headers.get('accept').includes('text/html'));

  if (isHtmlRequest) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          try {
            const cached = await caches.match(req);
            if (cached) return cached;
            const fallback = await caches.match('/');
            if (fallback) return fallback;
          } catch (_) {}
          return new Response(
            '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Apexs ERP - Offline</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:1.5rem}h1{font-size:1.5rem;margin-bottom:0.5rem;font-weight:700}.btn{background:#0284c7;color:#fff;border:none;padding:0.65rem 1.4rem;border-radius:8px;font-weight:600;margin-top:1.25rem;cursor:pointer;font-size:0.95rem}</style></head><body><div><div style="font-size:3.5rem;margin-bottom:1rem">&#9888;</div><h1>You are currently offline</h1><p style="color:#94a3b8;font-size:0.92rem;max-width:320px;line-height:1.5;margin:0 auto">Please check your network connection to access the Apexs ERP platform.</p><button class="btn" onclick="window.location.reload()">Retry Connection</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html' }, status: 200 }
          );
        })
    );
    return;
  }

  // Only intercept same-origin static assets and known CDNs
  const isCdn = url.hostname === 'cdnjs.cloudflare.com';
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin || isCdn) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          fetch(req)
            .then((fresh) => {
              if (fresh && fresh.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh)).catch(() => {});
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(req)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return response;
          })
          .catch(async () => {
            const cached = await caches.match(req);
            if (cached) return cached;
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
          });
      })
    );
  }
});
`;

export const PWA_CLIENT_JS = `
// Register Service Worker
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (typeof showToast === 'function') {
                showToast('Apexs ERP updated! Refresh for the latest version.', 'info');
              }
            }
          });
        }
      });
    }).catch((err) => {
      console.warn('PWA Service Worker registration notice:', err);
    });
  });
}

// Mobile PWA & iOS Home Screen Install Prompt Suite
let deferredInstallPrompt = null;
const isIosDevice = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const isStandaloneApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || Boolean(window.Capacitor);

// Show topbar install button if not running in standalone mode
window.addEventListener('DOMContentLoaded', () => {
  if (!isStandaloneApp) {
    const topbarBtn = document.getElementById('install-app-topbar-btn');
    if (topbarBtn) topbarBtn.style.display = 'inline-flex';
  }
});

// Android / Desktop Chromium Install Event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!isStandaloneApp) {
    showPwaInstallPrompt();
    const topbarBtn = document.getElementById('install-app-topbar-btn');
    if (topbarBtn) topbarBtn.style.display = 'inline-flex';
  }
});

// iOS Safari Auto-Prompt
if (isIosDevice && !isStandaloneApp) {
  window.addEventListener('load', () => {
    const dismissed = sessionStorage.getItem('ios-install-dismissed');
    if (!dismissed) {
      setTimeout(() => {
        showIosInstallPrompt();
      }, 2500);
    }
  });
}

function handleInstallAppClick() {
  if (isStandaloneApp) {
    if (typeof showToast === 'function') {
      showToast('Apexs ERP is already installed and running in App mode!', 'info');
    }
    return;
  }
  if (isIosDevice) {
    showIosInstallPrompt();
  } else if (deferredInstallPrompt) {
    triggerPwaInstall();
  } else {
    showPwaInstallPrompt();
  }
}

function showPwaInstallPrompt() {
  if (document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.innerHTML = \`
    <div style="position: fixed; bottom: max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem)); left: 50%; transform: translateX(-50%); z-index: 99999; background: #0f172a; color: #ffffff; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.4); border-radius: 12px; padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem; max-width: 92vw; width: 400px; animation: slideUp 0.3s ease-out;">
      <img src="/assets/icon-192.png" style="width: 34px; height: 34px; object-fit: contain; border-radius: 8px; background: #1e293b; padding: 2px;" alt="Apexs" />
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 0.85rem; line-height: 1.2;">Install Apexs ERP App</div>
        <div style="font-size: 0.74rem; color: #94a3b8;">Add to your home screen for quick mobile access</div>
      </div>
      <button type="button" onclick="triggerPwaInstall()" class="btn btn-primary btn-sm" style="font-size: 0.78rem; padding: 0.35rem 0.75rem; font-weight: 600; white-space: nowrap;">Install</button>
      <button type="button" onclick="dismissPwaInstallPrompt()" style="background: none; border: none; color: #94a3b8; font-size: 1.1rem; cursor: pointer; padding: 0 0.2rem; line-height: 1;" aria-label="Close">✕</button>
    </div>
  \`;
  document.body.appendChild(banner);
}

function triggerPwaInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult && choiceResult.outcome === 'accepted') {
        dismissPwaInstallPrompt();
      }
      deferredInstallPrompt = null;
    });
  } else if (isIosDevice) {
    showIosInstallPrompt();
  }
}

function dismissPwaInstallPrompt() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
}

// iOS Native "Add to Home Screen" Visual Guide
function showIosInstallPrompt() {
  if (document.getElementById('ios-install-sheet')) return;
  const sheet = document.createElement('div');
  sheet.id = 'ios-install-sheet';
  sheet.innerHTML = \`
    <div style="position: fixed; bottom: max(1.25rem, calc(env(safe-area-inset-bottom) + 0.5rem)); left: 50%; transform: translateX(-50%); z-index: 999999; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 20px 45px rgba(0, 0, 0, 0.55); border-radius: 20px; padding: 1.25rem 1.35rem; max-width: 92vw; width: 390px; animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.95rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="/assets/icon-192.png" style="width: 44px; height: 44px; object-fit: contain; border-radius: 11px; background: #0f172a; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 4px 12px rgba(0,0,0,0.35);" alt="Apexs ERP" />
          <div>
            <div style="font-weight: 700; font-size: 0.98rem; line-height: 1.2; letter-spacing: -0.01em;">Add to Home Screen</div>
            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">Install Apexs ERP on your iPhone / iPad</div>
          </div>
        </div>
        <button type="button" onclick="dismissIosInstallPrompt()" style="background: rgba(255,255,255,0.08); border: none; color: #94a3b8; font-size: 0.95rem; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;" aria-label="Close">✕</button>
      </div>

      <div style="background: rgba(30, 41, 59, 0.75); border-radius: 12px; padding: 0.85rem 0.95rem; font-size: 0.83rem; color: #f1f5f9; line-height: 1.5; margin-bottom: 0.95rem; border: 1px solid rgba(255,255,255,0.06);">
        <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.6rem;">
          <span style="background: #0284c7; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.74rem; flex-shrink: 0;">1</span>
          <span>Tap the <strong>Share</strong> button in Safari's bottom bar:
            <svg style="display: inline-block; vertical-align: -3px; margin-left: 3px; color: #38bdf8;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.6rem;">
          <span style="background: #0284c7; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.74rem; flex-shrink: 0;">2</span>
          <span>Scroll down and tap <strong>"Add to Home Screen"</strong>:
            <svg style="display: inline-block; vertical-align: -3px; margin-left: 3px; color: #38bdf8;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4"></rect>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <span style="background: #0284c7; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.74rem; flex-shrink: 0;">3</span>
          <span>Tap <strong>"Add"</strong> in the top-right corner</span>
        </div>
      </div>

      <button type="button" onclick="dismissIosInstallPrompt()" class="btn btn-primary" style="width: 100%; font-size: 0.86rem; padding: 0.55rem; font-weight: 600; border-radius: 10px; background: #0284c7; border: none; cursor: pointer; color: #fff;">Got It</button>
    </div>
  \`;
  document.body.appendChild(sheet);
}

function dismissIosInstallPrompt() {
  const sheet = document.getElementById('ios-install-sheet');
  if (sheet) sheet.remove();
  sessionStorage.setItem('ios-install-dismissed', 'true');
}

window.showIosInstallGuide = showIosInstallPrompt;
window.handleInstallAppClick = handleInstallAppClick;

// Capacitor Native Mobile App Integration (Status Bar, Splash Screen & Hardware Back-Button)
if (window.Capacitor) {
  const plugins = window.Capacitor.Plugins || {};
  const appPlugin = plugins.App || window.Capacitor.App;
  const statusPlugin = plugins.StatusBar || window.Capacitor.StatusBar;
  const splashPlugin = plugins.SplashScreen || window.Capacitor.SplashScreen;

  // 1. Status Bar Theme
  if (statusPlugin && typeof statusPlugin.setBackgroundColor === 'function') {
    statusPlugin.setBackgroundColor({ color: '#0f172a' }).catch(() => {});
  }

  // 2. Hide Splash Screen cleanly after web shell is active
  if (splashPlugin && typeof splashPlugin.hide === 'function') {
    window.addEventListener('load', () => {
      setTimeout(() => {
        splashPlugin.hide().catch(() => {});
      }, 500);
    });
  }

  // 3. Android Hardware Back-Button navigation handling
  if (appPlugin && typeof appPlugin.addListener === 'function') {
    appPlugin.addListener('backButton', ({ canGoBack }) => {
      const activeModal = document.querySelector('.modal-backdrop');
      if (activeModal) {
        if (typeof closeModal === 'function') {
          closeModal();
        } else {
          activeModal.remove();
        }
        return;
      }
      const sidebar = document.querySelector('.sidebar.mobile-open');
      if (sidebar) {
        if (typeof closeMobileSidebar === 'function') {
          closeMobileSidebar();
        }
        return;
      }
      if (canGoBack) {
        window.history.back();
      } else {
        if (typeof appPlugin.exitApp === 'function') {
          appPlugin.exitApp();
        }
      }
    });
  }
}
`;
