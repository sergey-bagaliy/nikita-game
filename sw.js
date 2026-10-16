'use strict';

/* Офлайн-режим: после первого открытия игра хранится в телефоне и запускается без интернета.
   Если есть интернет, файлы тихо обновляются, и новая версия появится при следующем запуске.
   При изменении списка файлов поменяйте номер версии. */
const CACHE = 'letnaya-shkola-v1';
const FILES = [
  './',
  'index.html',
  'style.css',
  'planes.js',
  'game.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('letnaya-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // папка valera/ — отдельная игра со своим офлайн-режимом, её не трогаем
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/valera/')) return;

  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
    // Обновляем копию в фоне, если есть интернет
    const fresh = fetch(req)
      .then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => cached);
    event.waitUntil(fresh.then(() => undefined, () => undefined));
    return cached || fresh;
  }));
});
