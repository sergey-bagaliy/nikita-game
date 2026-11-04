'use strict';

/* Офлайн-режим: после первого открытия игра хранится в телефоне и запускается без интернета.
   Если есть интернет, файлы тихо обновляются, и новая версия появится при следующем запуске.
   При изменении файлов игры поменяйте номер версии CACHE. */
const CACHE = 'letnaya-shkola-v3';
const FILES = [
  './',
  'index.html',
  'style.css',
  'planes.js',
  'boss.js',
  'game.js',
  'arcade.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', event => {
  // cache: 'reload' — берём свежие файлы с сайта, а не старые из памяти браузера
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
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

  // Сразу отдаём сохранённую копию, а в фоне обновляем её, если есть интернет
  const network = fetch(req).then(res => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
    }
    return res;
  });
  event.waitUntil(network.then(() => undefined, () => undefined));

  event.respondWith(
    caches.open(CACHE)
      .then(cache => cache.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? cache.match('./').then(r => r || cache.match('index.html')) : undefined)))
      .then(cached => cached || network)
  );
});
