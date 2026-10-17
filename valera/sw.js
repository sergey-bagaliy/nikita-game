'use strict';

/* Офлайн-режим для «Ямщик». При изменении файлов поменяйте номер версии. */
const CACHE = 'valera-yamy-v14';
const FILES = ['./', 'index.html', 'style.css', 'data.js', 'voices.js', 'voice.js', 'art.js', 'game.js', 'valera-face.jpg', 'boss-face.jpg', 'dog-face.jpg', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', event => {
  // cache: 'reload' — мимо HTTP-кэша браузера, чтобы не сохранить старую копию файла
  event.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('valera-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Интернет есть, но еле живой: ждём не дольше 3 секунд, потом берём сохранённое
const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // видео не кэшируем: они большие и грузятся кусками
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/video/')) return;

  const isNav = req.mode === 'navigate';
  const isCode = isNav || /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  // страницу храним под одним ключом, чтобы адреса с ?параметрами не плодили копии
  const key = isNav ? 'index.html' : req;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = () => cache.match(key, { ignoreSearch: true });
    if (isCode) {
      // код и страница: сначала свежая версия из интернета, без интернета — сохранённая
      const net = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' });
      try {
        const res = await Promise.race([net, timeout(3000)]);
        if (res.ok) await cache.put(key, res.clone());
        return res;
      } catch (e) {
        const c = await cached();
        if (c) {
          // ответ из памяти, а свежую версию всё равно сохраним, когда докачается
          event.waitUntil(net.then(res => res.ok && cache.put(key, res)).catch(() => undefined));
          return c;
        }
        return net.catch(() => Response.error());
      }
    }
    const c = await cached();
    // голоса: имя файла меняется вместе с содержимым — из памяти без перепроверки
    if (url.pathname.includes('/voice/')) {
      if (c) return c;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }
    // картинки: сразу из памяти, а в фоне обновляем
    const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => c);
    event.waitUntil(fresh.then(() => undefined, () => undefined));
    return c || fresh;
  }));
});
