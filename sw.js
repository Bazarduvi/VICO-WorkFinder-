// ============================================
// VICO WorkFinder - Service Worker v2.0
// ============================================

const CACHE_NAME = 'vico-workfinder-v2.0.0';
const STATIC_CACHE = 'vico-static-v2';
const DYNAMIC_CACHE = 'vico-dynamic-v2';

// Archivos a cachear en instalación
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// URLs de APIs externas a cachear dinámicamente
const API_CACHE_URLS = [
  'https://api.groq.com',
  'https://generativelanguage.googleapis.com',
  'https://newsapi.org',
  'https://hk.jobsdb.com'
];

// ============================================
// INSTALL - Cachear assets estáticos
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando VICO WorkFinder v2.0...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Cacheando assets estáticos');
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn('[SW] Algunos assets no se pudieron cachear:', err);
        });
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting();
      })
  );
});

// ============================================
// ACTIVATE - Limpiar caches antiguos
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando nuevo Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => {
              return name !== STATIC_CACHE && 
                     name !== DYNAMIC_CACHE &&
                     name.startsWith('vico-');
            })
            .map(name => {
              console.log('[SW] Eliminando cache antiguo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activación completada');
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH - Estrategia de caché inteligente
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar extensiones de Chrome y requests no-GET
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.hostname === 'localhost' && url.pathname.includes('hot-update')) return;

  // Estrategia según tipo de recurso
  if (isStaticAsset(url)) {
    // Cache First para assets estáticos
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(url)) {
    // Network First para APIs (con fallback a cache)
    event.respondWith(networkFirst(request));
  } else if (isNavigationRequest(request)) {
    // Cache First con fallback a index.html (SPA)
    event.respondWith(navigationHandler(request));
  } else {
    // Stale While Revalidate para el resto
    event.respondWith(staleWhileRevalidate(request));
  }
});

// ============================================
// ESTRATEGIAS DE CACHÉ
// ============================================

// Cache First: sirve desde caché, si no existe va a red
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || offlineFallback();
  }
}

// Network First: intenta red, si falla usa caché
async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  try {
    const networkResponse = await fetch(request, {
      signal: AbortSignal.timeout(8000) // 8s timeout
    });
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Red no disponible, usando caché:', request.url);
    const cached = await cache.match(request);
    return cached || offlineFallback();
  }
}

// Stale While Revalidate: sirve caché y actualiza en background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cached);
  
  return cached || fetchPromise;
}

// Handler para navegación SPA
async function navigationHandler(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    const cached = await caches.match('./index.html');
    return cached || offlineFallback();
  }
}

// ============================================
// HELPERS
// ============================================

function isStaticAsset(url) {
  return url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
}

function isAPIRequest(url) {
  return API_CACHE_URLS.some(apiUrl => url.href.startsWith(apiUrl));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function offlineFallback() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VICO - Sin conexión</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0a0a14;
          color: #f1f5f9;
          font-family: system-ui, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          text-align: center;
          padding: 20px;
        }
        .container { max-width: 320px; }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { font-size: 22px; margin-bottom: 12px; color: #818cf8; }
        p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
        button {
          background: linear-gradient(135deg, #6366f1, #06b6d4);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🏙️</div>
        <h1>VICO WorkFinder</h1>
        <p>Sin conexión a internet. Algunas funciones no están disponibles, pero puedes seguir usando los datos guardados.</p>
        <button onclick="window.location.reload()">🔄 Reintentar</button>
      </div>
    </body>
    </html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

// ============================================
// BACKGROUND SYNC - Sincronizar cuando hay red
// ============================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-jobs') {
    event.waitUntil(syncJobs());
  }
  if (event.tag === 'sync-news') {
    event.waitUntil(syncNews());
  }
});

async function syncJobs() {
  console.log('[SW] Sincronizando empleos en background...');
  // Aquí iría la lógica de sincronización con la API real
}

async function syncNews() {
  console.log('[SW] Sincronizando noticias en background...');
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  let data;
  try {
    data = event.data.json();
  } catch(e) {
    data = { title: 'VICO WorkFinder', body: event.data.text() };
  }
  
  const options = {
    body: data.body || 'Nueva notificación',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'view', title: '👁️ Ver', icon: './icons/icon-72.png' },
      { action: 'close', title: '✕ Cerrar' }
    ],
    tag: data.tag || 'vico-notification',
    renotify: true,
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'VICO WorkFinder', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') return;
  
  const urlToOpen = event.notification.data?.url || './';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================
// PERIODIC BACKGROUND SYNC (Chrome 80+)
// ============================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-jobs') {
    event.waitUntil(syncJobs());
  }
});

// ============================================
// MESSAGE - Comunicación con la app
// ============================================
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch(type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      event.waitUntil(
        caches.open(DYNAMIC_CACHE)
          .then(cache => cache.addAll(payload.urls || []))
      );
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(keys => 
          Promise.all(keys.map(key => caches.delete(key)))
        )
      );
      break;
      
    case 'GET_CACHE_SIZE':
      event.waitUntil(
        getCacheSize().then(size => {
          event.ports[0]?.postMessage({ type: 'CACHE_SIZE', size });
        })
      );
      break;
  }
});

async function getCacheSize() {
  const keys = await caches.keys();
  let total = 0;
  for (const key of keys) {
    const cache = await caches.open(key);
    const requests = await cache.keys();
    total += requests.length;
  }
  return total;
}

console.log('[SW] VICO WorkFinder Service Worker v2.0 cargado ✅');
