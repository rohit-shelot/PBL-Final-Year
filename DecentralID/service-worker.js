// Increment when an app-shell asset changes so clients cannot keep executing
// a stale JavaScript file from a previous cache.
const CACHE_NAME = 'ssi-wallet-v35';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/app.js',
    '/js/crypto-utils.js',
    '/js/storage.js',
    '/js/did-manager.js',
    '/js/theme.js',
    '/js/role-switcher.js',
    '/js/vendor/ethers.umd.min.js',
    '/js/vendor/qrcode.js',
    '/js/vendor/html5-qrcode.min.js',
    '/js/qr-helper.js',
    '/js/web3-signer.js',
    '/js/credential-manager.js',
    '/js/selective-disclosure.js',
    '/js/api.js',
    '/js/did-auth.js',
    '/js/student-manager.js',
    '/js/components/onboarding.js',
    '/js/components/dashboard.js',
    '/js/components/credential-issuer.js',
    '/js/components/credential-holder.js',
    '/js/components/credential-verifier.js',
    '/js/components/role-selector.js',
    '/js/components/university-login.js',
    '/js/components/verifier-login.js',
    '/js/components/student-login.js',
    '/assets/mit-adt-logo.png',
    '/manifest.json',
    '/icons/favicon.ico',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Install event - cache static assets safely
self.addEventListener('install', event => {
    console.log(`[Service Worker] Installing ${CACHE_NAME}...`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('[Service Worker] Caching app shell');
                // Cache files safely so single file issues never fail the whole installation
                await Promise.allSettled(
                    urlsToCache.map(url =>
                        cache.add(url).catch(err => {
                            console.warn(`[Service Worker] Non-fatal cache failure for ${url}:`, err.message);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Always obtain the current page shell from the server. This lets a new
    // deployment update versioned scripts and styles instead of serving an
    // outdated cached index.html indefinitely.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        caches.open(CACHE_NAME).then(cache => cache.put('/index.html', response.clone()));
                    }
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                }).catch(() => {
                    // Return offline fallback if available
                    return caches.match('/index.html');
                });
            })
    );
});

// Background sync (for future implementation)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-credentials') {
        event.waitUntil(syncCredentials());
    }
});

async function syncCredentials() {
    // Future implementation: sync credentials when online
    console.log('[Service Worker] Background sync triggered');
}
