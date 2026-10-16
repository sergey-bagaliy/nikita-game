'use strict';

/* Офлайн-режим для «Ямщик». При изменении файлов поменяйте номер версии. */
const CACHE = 'valera-yamy-v7';
const FILES = ['./', 'index.html', 'style.css', 'data.js', 'voices.js', 'voice.js', 'art.js', 'game.js', 'valera-face.jpg', 'boss-face.jpg', 'dog-face.jpg', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

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

  const isCode = req.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = () => cache.match(req, { ignoreSearch: true })
      .then(c => c || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
    if (isCode) {
      // код и страница: сначала свежая версия из интернета, без интернета — сохранённая
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return (await cached()) || Response.error();
      }
    }
    // картинки и голоса: сразу из памяти, а в фоне обновляем
    const c = await cached();
    const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => c);
    event.waitUntil(fresh.then(() => undefined, () => undefined));
    return c || fresh;
  }));
});
