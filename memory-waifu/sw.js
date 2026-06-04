/**
 * Service Worker - 离线缓存 & 后台推送
 * 
 * 让 App 能在手机上离线运行，并支持后台定时检查
 */

const CACHE_NAME = 'memory-waifu-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/spaced-repetition.js',
    '/js/database.js',
    '/js/motivation.js',
    '/js/reminder.js',
    '/js/app.js',
    '/manifest.json',
];

// 安装：缓存所有静态资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// 请求拦截：优先缓存，缓存未命中才网络
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});

// 后台定期同步（检查是否有卡片需要复习）
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'review-check') {
        event.waitUntil(checkDueCards());
    }
});

async function checkDueCards() {
    // 简化版：通知用户有卡片到期
    self.registration.showNotification('Memory Waifu', {
        body: '📚 有卡片需要复习了，快来看看！',
        icon: '/assets/icon-192.png',
        tag: 'review-reminder',
        requireInteraction: true,
    });
}

// 推送通知点击处理
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(clients => {
            if (clients.length > 0) {
                clients[0].focus();
            } else {
                self.clients.openWindow('/');
            }
        })
    );
});
