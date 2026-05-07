// AI-Бухгалтер — Service Worker
// Стратегии: cache-first для статики, network-first для документа
// Версия меняется при деплое — старые кеши автоматически чистятся

const CACHE_VERSION = 'v1-2026-05-07';
const STATIC_CACHE = `aibuh-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `aibuh-runtime-${CACHE_VERSION}`;

// Ассеты для предкеширования при установке
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.svg',
    '/favicon-32.png',
    '/favicon-16.png',
    '/apple-touch-icon.png',
    '/icon-192.png',
    '/icon-512.png',
    '/og-image.png',
];

// install — кешируем критичную статику
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// activate — чистим старые версии кеша
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => !k.endsWith(CACHE_VERSION))
                    .map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// fetch — стратегии в зависимости от типа запроса
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Только GET и тот же origin
    if (request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    // Skip Vercel insights endpoints (динамика, не кешируем)
    if (url.pathname.startsWith('/_vercel/')) return;

    // HTML-документ: network-first (свежий контент важнее) с fallback в кеш
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request).then((r) => r || caches.match('/')))
        );
        return;
    }

    // Статика: cache-first
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
                }
                return response;
            });
        })
    );
});
