'use strict';

/* Офлайн-режим для «Ямщик». При изменении файлов поменяйте номер версии. */
const CACHE = 'valera-yamy-v1';
const FILES = ['./', 'index.html', 'style.css', 'data.js', 'art.js', 'game.js', 'valera-face.jpg', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('valera-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // видео не кэшируем: они большие и грузятся кусками
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/video/')) return;

  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
    const fresh = fetch(req)
      .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => cached);
    event.waitUntil(fresh.then(() => undefined, () => undefined));
    return cached || fresh;
  }));
});
