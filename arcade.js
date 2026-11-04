'use strict';

/* «Аэродром»: 10 мини-игр, по одной на каждый самолёт (planes.js).
   Игра открывается вместе со своим самолётом (за экзамены), одна игра стоит 1 билет 🎟️.
   Билеты дают за правильные ответы (game.js). Рисуется на canvas, управление пальцем. */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pwOf = W => clamp(W * 0.22, 64, 96); // ширина самолёта на экране

/* ---------- Звуки мини-игр (те же синтезаторы, что и в game.js) ---------- */
const sfx = {
  pick() { tone(1320, 0, 0.12, { vol: 0.1 }); tone(1760, 0.06, 0.14, { vol: 0.08 }); },
  hit() { tone(220, 0, 0.28, { type: 'triangle', vol: 0.16, to: 110 }); },
  flap() { whoosh(0, 0.18, 500, 1600, 0.12); },
  shoot() { tone(1100, 0, 0.06, { type: 'square', vol: 0.02, to: 500 }); },
  boom() { whoosh(0, 0.45, 1800, 200, 0.28); },
  splash() { whoosh(0, 0.35, 3000, 600, 0.2); },
  laser() { tone(1800, 0, 0.12, { type: 'sawtooth', vol: 0.04, to: 400 }); },
};

/* ---------- Рисование ---------- */
function fillSky(ctx, W, H, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function puff(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  [[0, 0, 1], [0.9, -0.35, 0.8], [1.7, 0, 0.75], [-0.8, 0.1, 0.7]].forEach(([dx, dy, k]) => {
    ctx.moveTo(x + dx * r + k * r, y + dy * r);
    ctx.arc(x + dx * r, y + dy * r, k * r, 0, TAU);
  });
  ctx.fill();
}
function makeClouds(W, H, n, y0, y1) {
  return Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(H * y0, H * y1), r: rnd(14, 26), k: rnd(0.5, 1) }));
}
function moveClouds(list, dt, speed, W) {
  list.forEach(c => {
    c.x -= speed * c.k * dt;
    if (c.x < -c.r * 3) c.x = W + c.r * 2 + rnd(0, 60);
  });
}
function drawClouds(ctx, list, color) {
  list.forEach(c => puff(ctx, c.x, c.y, c.r, color));
}
function drawSprite(ctx, img, x, y, w, ang = 0, flip = false, alpha = 1) {
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.save();
  ctx.translate(x, y);
  if (ang) ctx.rotate(ang);
  if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, -w / 2, -w / 4, w, w / 2);
  ctx.restore();
}
function blink(s) { return s.inv > 0 && Math.floor(s.t * 10) % 2 ? 0.35 : 1; }
function star(ctx, x, y, r, color, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const an = rot - Math.PI / 2 + i * Math.PI / 5;
    ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(150, 90, 0, .55)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
function bird(ctx, x, y, size, t) {
  const f = Math.sin(t * 14 + x * 0.05) * size * 0.45;
  ctx.strokeStyle = '#2b2d42';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y - f);
  ctx.quadraticCurveTo(x - size * 0.4, y - size * 0.5, x, y);
  ctx.quadraticCurveTo(x + size * 0.4, y - size * 0.5, x + size, y - f);
  ctx.stroke();
}
function label(ctx, text, x, y, size = 18, color = '#fff', align = 'center') {
  ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(20, 30, 60, .65)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
function hint(ctx, W, H, text) {
  ctx.fillStyle = 'rgba(20, 30, 60, .55)';
  const w = Math.min(W - 24, 300);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(W / 2 - w / 2, H * 0.62 - 22, w, 44, 14); else ctx.rect(W / 2 - w / 2, H * 0.62 - 22, w, 44);
  ctx.fill();
  label(ctx, text, W / 2, H * 0.62, 16);
}

/* ---------- Частицы, надписи, жизни ---------- */
function base(extra) {
  return Object.assign({ t: 0, score: 0, lives: 3, inv: 0, over: false, ending: null, parts: [], texts: [] }, extra);
}
function burst(s, x, y, color, n = 12, speed = 120) {
  for (let i = 0; i < n; i++) {
    const an = rnd(0, TAU), sp = rnd(speed * 0.3, speed);
    const life = rnd(0.35, 0.8);
    s.parts.push({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life, max: life, color, size: rnd(2, 4.5) });
  }
}
function say(s, x, y, text, color = '#fff') {
  s.texts.push({ x, y, text, color, life: 1.2 });
}
function hurt(s, x, y, force) {
  if (s.ending != null || (!force && s.inv > 0)) return false;
  s.lives--;
  s.inv = 1.4;
  sfx.hit();
  burst(s, x, y, '#ef6461', 14, 140);
  try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* нет вибрации */ }
  if (s.lives <= 0) s.ending = 1;
  return true;
}
function drawLives(ctx, s) {
  ctx.font = '18px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let t = '';
  for (let i = 0; i < 3; i++) t += i < s.lives ? '❤️' : '🤍';
  ctx.fillText(t, 10, 10);
}

/* ================= 10 мини-игр (по порядку самолётов) ================= */
const ARCADE = [
  /* 1. Ан-2: «Сквозь облака» — нажимаешь, самолёт подпрыгивает вверх */
  {
    how: 'Нажимай на экран — самолёт поднимается вверх, отпустишь — снижается. Пролетай в просветы между грозовыми тучами и не задевай землю!',
    tip: 'Нажми, чтобы взлететь!',
    start(W, H) {
      return base({ x: W * 0.26, y: H * 0.45, vy: 0, cols: [], spawn: 0.4, started: false, pw: pwOf(W), bg: makeClouds(W, H, 4, 0.08, 0.5), field: 0 });
    },
    step(s, dt, inp, a) {
      const { W, H } = a, G = H * 0.9;
      moveClouds(s.bg, dt, 30, W);
      if (!s.started) {
        s.y = H * 0.45 + Math.sin(s.t * 3) * 6;
        if (inp.taps.length) { s.started = true; s.vy = -H * 0.55; sfx.flap(); }
        return;
      }
      if (inp.taps.length) { s.vy = -H * 0.6; sfx.flap(); }
      s.vy = Math.min(s.vy + H * 1.5 * dt, H * 1.1);
      s.y += s.vy * dt;
      const sp = W * (0.38 + Math.min(0.3, s.t * 0.005));
      s.field = (s.field + sp * dt) % 40;
      if ((s.spawn -= dt) <= 0) {
        const gap = H * Math.max(0.3, 0.42 - s.score * 0.004);
        s.cols.push({ x: W + 40, w: 56, gap, gy: rnd(H * 0.1 + gap / 2, G - H * 0.06 - gap / 2), passed: false });
        s.spawn = 1.75;
      }
      const hw = s.pw * 0.36, hh = s.pw * 0.12;
      s.cols.forEach(c => {
        c.x -= sp * dt;
        if (!c.passed && c.x + c.w / 2 < s.x - hw) { c.passed = true; s.score++; sfx.pick(); }
        const inX = s.x + hw > c.x - c.w / 2 && s.x - hw < c.x + c.w / 2;
        if (inX && (s.y - hh < c.gy - c.gap / 2 || s.y + hh > c.gy + c.gap / 2)) hurt(s, s.x, s.y);
      });
      s.cols = s.cols.filter(c => c.x > -80);
      if (s.y + hh > G) { s.y = G - hh; s.vy = -H * 0.5; hurt(s, s.x, s.y); }
      if (s.y < hh + 4) { s.y = hh + 4; s.vy = Math.max(0, s.vy); }
    },
    draw(ctx, s, a) {
      const { W, H } = a, G = H * 0.9;
      fillSky(ctx, W, H, [[0, '#5fb2f5'], [1, '#dff2ff']]);
      drawClouds(ctx, s.bg, 'rgba(255, 255, 255, .85)');
      ctx.fillStyle = '#86bb5f';
      ctx.fillRect(0, G, W, H - G);
      ctx.fillStyle = '#d9c46a';
      for (let x = -s.field; x < W; x += 40) ctx.fillRect(x, G + 5, 18, H - G);
      s.cols.forEach(c => {
        stormColumn(ctx, c.x, c.w, 0, c.gy - c.gap / 2, 'down');
        stormColumn(ctx, c.x, c.w, c.gy + c.gap / 2, G, 'up');
      });
      drawSprite(ctx, a.img, s.x, s.y, s.pw, clamp(s.vy / (H * 1.4), -0.45, 0.6), false, blink(s));
      if (!s.started) hint(ctx, W, H, this.tip);
    },
  },

  /* 2. Як-52: «Звездопад» — собирай звёзды, уворачивайся от птиц */
  {
    how: 'Води пальцем вверх и вниз — самолёт полетит за ним. Собирай звёзды ⭐ (золотая — сразу 3) и не врезайся в птиц!',
    tip: 'Води пальцем вверх-вниз',
    start(W, H) {
      return base({ x: W * 0.22, y: H / 2, pw: pwOf(W), items: [], spawn: 0.3, bg: makeClouds(W, H, 5, 0.05, 0.95) });
    },
    step(s, dt, inp, a) {
      const { W, H } = a;
      if (inp.has) s.y += (clamp(inp.y, s.pw * 0.25, H - s.pw * 0.25) - s.y) * Math.min(1, dt * 9);
      const sp = W * (0.42 + Math.min(0.4, s.t * 0.006));
      moveClouds(s.bg, dt, sp * 0.35, W);
      if ((s.spawn -= dt) <= 0) {
        const birdP = 0.22 + Math.min(0.25, s.t * 0.004), r = Math.random();
        const type = r < birdP ? 'bird' : r < birdP + 0.08 ? 'gold' : 'star';
        s.items.push({ type, x: W + 20, y: rnd(H * 0.08, H * 0.92), ph: rnd(0, TAU), r: type === 'gold' ? 15 : type === 'bird' ? 13 : 11 });
        s.spawn = Math.max(0.32, 0.75 - s.t * 0.005);
      }
      const hw = s.pw * 0.4, hh = s.pw * 0.13;
      s.items.forEach(it => {
        it.x -= sp * (it.type === 'bird' ? 1.2 : 1) * dt;
        if (it.type === 'bird') it.y += Math.sin(s.t * 4 + it.ph) * 40 * dt;
        if (!it.done && Math.abs(it.x - s.x) < hw + it.r * 0.6 && Math.abs(it.y - s.y) < hh + it.r * 0.6) {
          it.done = true;
          if (it.type === 'bird') hurt(s, it.x, it.y);
          else {
            const v = it.type === 'gold' ? 3 : 1;
            s.score += v;
            sfx.pick();
            burst(s, it.x, it.y, '#ffd23f', 8, 90);
            if (v > 1) say(s, it.x, it.y - 10, '+3');
          }
        }
      });
      s.items = s.items.filter(it => !it.done && it.x > -30);
    },
    draw(ctx, s, a) {
      const { W, H } = a;
      fillSky(ctx, W, H, [[0, '#6f9cf5'], [0.6, '#f9cfb0'], [1, '#ffe6cf']]);
      drawClouds(ctx, s.bg, 'rgba(255, 240, 245, .8)');
      s.items.forEach(it => {
        if (it.type === 'bird') bird(ctx, it.x, it.y, it.r, s.t);
        else star(ctx, it.x, it.y, it.r, it.type === 'gold' ? '#ff9f1c' : '#ffd23f', s.t * 2);
      });
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
      if (s.t < 2.5) hint(ctx, W, H, this.tip);
    },
  },

  /* 3. Ми-8: «Посылки» — лови посылки на парашютах, берегись града */
  {
    how: 'Води пальцем влево и вправо — вертолёт ловит посылки на парашютах. Не дай им упасть на землю и берегись льдинок-градин!',
    tip: 'Води пальцем влево-вправо',
    start(W, H) {
      return base({ x: W / 2, y: H * 0.6, pw: pwOf(W) * 1.05, dir: 1, items: [], spawn: 0.5, bg: makeClouds(W, H, 3, 0.05, 0.3) });
    },
    step(s, dt, inp, a) {
      const { W, H } = a, G = H * 0.9;
      if (inp.has) {
        const d = clamp(inp.x, s.pw * 0.45, W - s.pw * 0.45) - s.x;
        s.x += d * Math.min(1, dt * 8);
        if (Math.abs(d) > 3) s.dir = d > 0 ? 1 : -1;
      }
      moveClouds(s.bg, dt, 12, W);
      if ((s.spawn -= dt) <= 0) {
        const hail = Math.random() < 0.18 + Math.min(0.2, s.t * 0.003);
        s.items.push({ hail, x: rnd(24, W - 24), y: -30, vy: H * (hail ? 0.4 : 0.13) * (1 + Math.min(0.9, s.t * 0.012)), ph: rnd(0, TAU) });
        s.spawn = Math.max(0.5, 1.15 - s.t * 0.008);
      }
      s.items.forEach(it => {
        it.y += it.vy * dt;
        if (!it.hail) it.x += Math.sin(s.t * 2 + it.ph) * 14 * dt;
        if (!it.done && Math.abs(it.x - s.x) < s.pw * 0.38 && Math.abs(it.y - s.y) < s.pw * 0.2) {
          it.done = true;
          if (it.hail) hurt(s, it.x, it.y);
          else { s.score++; sfx.pick(); burst(s, it.x, it.y, '#c28a4a', 8, 80); }
        }
        if (!it.done && !it.hail && it.y > G) {
          it.done = true;
          burst(s, it.x, G, '#8d6e63', 10, 70);
          say(s, it.x, G - 24, 'Упала!', '#ffe0e0');
          hurt(s, it.x, G, true);
        }
        if (it.hail && it.y > H + 20) it.done = true;
      });
      s.items = s.items.filter(it => !it.done);
    },
    draw(ctx, s, a) {
      const { W, H } = a, G = H * 0.9;
      fillSky(ctx, W, H, [[0, '#8fd0ff'], [1, '#e9f7ff']]);
      drawClouds(ctx, s.bg, 'rgba(255, 255, 255, .9)');
      ctx.fillStyle = '#9ccc72';
      ctx.fillRect(0, G, W, H - G);
      for (let i = 0; i < 4; i++) { // домики станицы
        const hx = W * (0.12 + i * 0.26), hw = 34;
        ctx.fillStyle = '#f3e2c2'; ctx.fillRect(hx - hw / 2, G - 18, hw, 18);
        ctx.fillStyle = '#c0533a'; ctx.beginPath(); ctx.moveTo(hx - hw / 2 - 4, G - 18); ctx.lineTo(hx, G - 34); ctx.lineTo(hx + hw / 2 + 4, G - 18); ctx.fill();
        ctx.fillStyle = '#7fb6e0'; ctx.fillRect(hx - 6, G - 13, 12, 8);
      }
      s.items.forEach(it => {
        if (it.hail) {
          ctx.fillStyle = '#cfefff'; ctx.strokeStyle = '#7fb6e0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(it.x, it.y, 9, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(it.x - 3, it.y - 3, 3, 0, TAU); ctx.fill();
        } else {
          ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(it.x - 16, it.y - 22); ctx.lineTo(it.x - 7, it.y - 6); ctx.moveTo(it.x + 16, it.y - 22); ctx.lineTo(it.x + 7, it.y - 6); ctx.stroke();
          ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(it.x, it.y - 22, 17, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(it.x, it.y - 22); ctx.arc(it.x, it.y - 22, 17, Math.PI * 1.4, Math.PI * 1.6); ctx.fill();
          ctx.fillStyle = '#c28a4a'; ctx.fillRect(it.x - 9, it.y - 7, 18, 14);
          ctx.fillStyle = '#e8c48a'; ctx.fillRect(it.x - 2, it.y - 7, 4, 14);
        }
      });
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, s.dir < 0, blink(s));
      if (s.t < 2.5) hint(ctx, W, H * 0.6, this.tip);
    },
  },

  /* 4. Ка-32: «Спасатель» — зависни над человеком на крыше и спаси его */
  {
    how: 'Половодье! Люди ждут на крышах. Веди вертолёт пальцем влево-вправо и зависни над человеком, пока не заполнится зелёный круг. Успей, пока не кончилось время!',
    tip: 'Зависни над человеком',
    start(W, H) {
      const roofs = [0.14, 0.38, 0.62, 0.86].map(k => ({ x: W * k, w: Math.min(64, W * 0.19), y: H * rnd(0.64, 0.7) }));
      const rain = Array.from({ length: 50 }, () => ({ x: rnd(0, W), y: rnd(0, H), v: rnd(380, 520) }));
      return base({ x: W / 2, y: H * 0.26, pw: pwOf(W) * 1.05, dir: 1, roofs, people: [], spawn: 0.6, rain, waterY: H * 0.8 });
    },
    step(s, dt, inp, a) {
      const { W, H } = a;
      if (inp.has) {
        const d = clamp(inp.x, s.pw * 0.45, W - s.pw * 0.45) - s.x;
        s.x += d * Math.min(1, dt * 7);
        if (Math.abs(d) > 3) s.dir = d > 0 ? 1 : -1;
      }
      s.y = H * 0.26 + Math.sin(s.t * 2) * 4;
      s.waterY = H * 0.8 + Math.sin(s.t * 1.5) * 3;
      s.rain.forEach(r => { r.y += r.v * dt; r.x -= r.v * 0.15 * dt; if (r.y > H) { r.y = -10; r.x = rnd(0, W + 40); } });
      const maxActive = s.t < 20 ? 1 : s.t < 45 ? 2 : 3;
      if ((s.spawn -= dt) <= 0 && s.people.length < maxActive) {
        const free = s.roofs.map((r, i) => i).filter(i => !s.people.some(p => p.roof === i));
        if (free.length) {
          const T = Math.max(4.5, 8 - s.t * 0.04);
          s.people.push({ roof: free[Math.floor(Math.random() * free.length)], timer: T, max: T, hold: 0 });
        }
        s.spawn = rnd(0.8, 2);
      }
      s.people.forEach(p => {
        const r = s.roofs[p.roof];
        p.timer -= dt;
        const over = Math.abs(s.x - r.x) < 26;
        p.hold = over ? p.hold + dt : Math.max(0, p.hold - dt * 2);
        if (p.hold >= 0.9) {
          p.done = true;
          s.score++;
          sfx.pick();
          burst(s, r.x, r.y - 34, '#22b07d', 12, 90);
          say(s, r.x, r.y - 60, 'Спасён!');
        } else if (p.timer <= 0) {
          p.done = true;
          say(s, r.x, r.y - 60, 'Не успели…', '#ffe0e0');
          hurt(s, r.x, r.y - 34, true);
        }
      });
      s.people = s.people.filter(p => !p.done);
    },
    draw(ctx, s, a) {
      const { W, H } = a;
      fillSky(ctx, W, H, [[0, '#56657f'], [1, '#a9b8cc']]);
      ctx.strokeStyle = 'rgba(220, 235, 255, .45)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      s.rain.forEach(r => { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 3, r.y + 12); });
      ctx.stroke();
      s.roofs.forEach(r => {
        ctx.fillStyle = '#efe0c4'; ctx.fillRect(r.x - r.w / 2, r.y, r.w, H - r.y);
        ctx.fillStyle = '#9fc3e6'; ctx.fillRect(r.x - 8, r.y + 10, 16, 12);
        ctx.fillStyle = '#b5523b';
        ctx.beginPath(); ctx.moveTo(r.x - r.w / 2 - 6, r.y); ctx.lineTo(r.x, r.y - 22); ctx.lineTo(r.x + r.w / 2 + 6, r.y); ctx.fill();
      });
      const wg = ctx.createLinearGradient(0, s.waterY, 0, H);
      wg.addColorStop(0, 'rgba(70, 130, 190, .92)'); wg.addColorStop(1, 'rgba(30, 70, 130, .95)');
      ctx.fillStyle = wg; ctx.fillRect(0, s.waterY, W, H - s.waterY);
      ctx.strokeStyle = 'rgba(255, 255, 255, .5)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, s.waterY + Math.sin(x * 0.06 + s.t * 3) * 2.5);
      ctx.stroke();
      s.people.forEach(p => {
        const r = s.roofs[p.roof], px = r.x, py = r.y - 22;
        const wave = Math.sin(s.t * 8) * 0.6;
        ctx.strokeStyle = '#2b2d42'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py - 2); ctx.lineTo(px, py - 16);
        ctx.moveTo(px, py - 12); ctx.lineTo(px - 7, py - 6);
        ctx.moveTo(px, py - 12); ctx.lineTo(px + 6 * Math.cos(wave - 1), py - 12 - 9 * Math.abs(Math.sin(wave + 1.6)));
        ctx.stroke();
        ctx.fillStyle = '#ffcf9e'; ctx.beginPath(); ctx.arc(px, py - 21, 5, 0, TAU); ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = p.timer / p.max > 0.35 ? '#ffd23f' : '#ef6461';
        ctx.beginPath(); ctx.arc(px, py - 14, 17, -Math.PI / 2, -Math.PI / 2 + TAU * (p.timer / p.max)); ctx.stroke();
        if (p.hold > 0) {
          ctx.strokeStyle = '#2fbf71'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(px, py - 14, 23, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, p.hold / 0.9)); ctx.stroke();
          ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(s.x, s.y + s.pw * 0.18); ctx.lineTo(px, py - 26); ctx.stroke();
          ctx.setLineDash([]);
        }
      });
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, s.dir < 0, blink(s));
      if (s.t < 2.5) hint(ctx, W, H * 0.7, this.tip);
    },
  },

  /* 5. Суперджет: «Посадка» — держи палец, чтобы снижаться медленнее, и сядь мягко */
  {
    how: 'Посади самолёт на полосу! Держишь палец — самолёт снижается медленнее (или набирает высоту), отпускаешь — снижается быстрее. Огни глиссады: 2 белых и 2 красных — ты на правильной высоте. Садись мягко: 5 посадок.',
    tip: 'Держи палец — медленнее вниз',
    lives: false,
    start(W, H) {
      const s = base({ pw: pwOf(W) * 1.15, n: 0, lives: 0 });
      this.next(s, W, H);
      return s;
    },
    next(s, W, H) {
      Object.assign(s, { x: W * 0.3, y: H * 0.22, vy: 0, dist: 0, phase: 'fly', roll: 0, rw: 950 + rnd(0, 200), rwL: Math.max(380, W * 1.1), sp: 125, gust: 1.5, msg: '', goAround: false, y0: H * 0.22 });
      s.n++;
    },
    step(s, dt, inp, a) {
      const { W, H } = a, G = H * 0.8, wheel = s.pw * 0.17;
      if (s.phase === 'fly') {
        s.vy += (inp.down ? -80 : 45) * dt;
        if (s.n >= 3 && (s.gust -= dt) <= 0) { s.vy += rnd(-22, 22); s.gust = rnd(1.2, 2.5); }
        s.vy = clamp(s.vy, -55, 75);
        s.y += s.vy * dt;
        s.dist += s.sp * dt;
        if (s.y < H * 0.08) { s.y = H * 0.08; s.vy = Math.max(0, s.vy); }
        if (s.y + wheel >= G) {
          s.y = G - wheel;
          const onRw = s.dist >= s.rw && s.dist <= s.rw + s.rwL;
          let pts = 0, msg;
          if (!onRw) msg = s.dist < s.rw ? 'Мимо полосы!' : 'Полоса закончилась!';
          else if (s.vy < 25) { pts = 30; msg = 'Мягкая посадка! ⭐⭐⭐'; }
          else if (s.vy < 40) { pts = 20; msg = 'Хорошая посадка! ⭐⭐'; }
          else if (s.vy < 56) { pts = 10; msg = 'Жестковато… ⭐'; }
          else msg = 'Жёсткая посадка!';
          if (pts && s.dist < s.rw + s.rwL * 0.35) { pts += 5; msg += ' +5 за точность'; }
          s.score += pts;
          s.msg = msg;
          s.phase = 'roll';
          s.roll = 2.2;
          s.vy = 0;
          burst(s, s.x - s.pw * 0.1, G, '#d5dae1', 12, 60);
          if (pts) sfx.pick(); else sfx.hit();
        } else if (s.dist > s.rw + s.rwL) {
          s.msg = 'Уход на второй круг';
          s.phase = 'roll';
          s.roll = 1.8;
          s.goAround = true;
          sfx.hit();
        }
      } else {
        s.roll -= dt;
        if (s.goAround) { s.y -= 60 * dt; s.dist += s.sp * dt; }
        else { s.sp = Math.max(0, s.sp - 70 * dt); s.dist += s.sp * dt; }
        if (s.roll <= 0) {
          if (s.n >= 5) s.over = true;
          else this.next(s, W, H);
        }
      }
    },
    draw(ctx, s, a) {
      const { W, H } = a, G = H * 0.8;
      fillSky(ctx, W, H, [[0, '#79b8f2'], [1, '#e8f4ff']]);
      ctx.fillStyle = '#a9c6a0';
      ctx.beginPath(); ctx.moveTo(0, G);
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, G - 22 - Math.sin((x + s.dist * 0.15) * 0.02) * 12);
      ctx.lineTo(W, G); ctx.fill();
      ctx.fillStyle = '#7fae5e'; ctx.fillRect(0, G, W, H - G);
      const rx = s.x + (s.rw - s.dist);
      ctx.fillStyle = '#5b6170'; ctx.fillRect(rx, G - 2, s.rwL, 9);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) ctx.fillRect(rx + 4 + i * 6, G, 3, 5);
      for (let x = rx + 40; x < rx + s.rwL - 10; x += 34) ctx.fillRect(x, G + 1.5, 16, 2);
      for (let i = 1; i <= 5; i++) { // огни приближения
        const lx = rx - i * 22;
        ctx.fillStyle = '#9aa3ad'; ctx.fillRect(lx - 1, G - 8, 2, 8);
        ctx.fillStyle = i % 2 ? '#fff6c2' : '#ff6b5b'; ctx.beginPath(); ctx.arc(lx, G - 9, 2.5, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#ff8a3d'; // ветроуказатель
      ctx.fillRect(rx + s.rwL + 14, G - 30, 2, 30);
      ctx.beginPath(); ctx.moveTo(rx + s.rwL + 16, G - 30); ctx.lineTo(rx + s.rwL + 32, G - 27); ctx.lineTo(rx + s.rwL + 16, G - 24); ctx.fill();
      if (s.phase === 'fly') { // огни глиссады (ПАПИ)
        const target = s.rw + 40;
        const ideal = s.y0 + (G - s.pw * 0.17 - s.y0) * clamp(s.dist / target, 0, 1);
        const whites = clamp(Math.round(2 - (s.y - ideal) / (H * 0.035)), 0, 4);
        ctx.fillStyle = 'rgba(20, 30, 60, .55)';
        ctx.fillRect(W - 112, 8, 104, 34);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i < whites ? '#ffffff' : '#ff4d3d';
          ctx.beginPath(); ctx.arc(W - 96 + i * 24, 25, 7, 0, TAU); ctx.fill();
        }
      }
      const ang = s.phase === 'fly' ? (a.inp.down ? -0.1 : clamp(s.vy / 500, -0.05, 0.1)) : s.goAround ? -0.15 : 0;
      drawSprite(ctx, a.img, s.x, s.y, s.pw, ang);
      label(ctx, `Посадка ${s.n} из 5`, 12, 24, 15, '#fff', 'left');
      if (s.phase === 'roll') label(ctx, s.msg, W / 2, H * 0.4, s.msg.length > 22 ? 17 : 21);
      else if (s.n === 1 && s.t < 3) hint(ctx, W, H * 0.7, this.tip);
    },
  },

  /* 6. Бе-200: «Пожар» — сбрасывай воду на огонь, бак наполняется над озером */
  {
    how: 'Лес горит! Нажимай на экран — самолёт сбрасывает воду. Сбрасывай чуть заранее: вода летит вниз не сразу. Вода кончилась — пролети над озером, бак наполнится сам.',
    tip: 'Нажми — сбросить воду',
    start(W, H) {
      const trees = Array.from({ length: 12 }, (_, i) => ({ x: i * (W / 10) + rnd(0, 14), h: rnd(16, 26) }));
      return base({ x: W * 0.3, y: H * 0.3, pw: pwOf(W) * 1.1, tank: 4, drops: [], fires: [], lakes: [], trees, fspawn: 1, lspawn: 5 });
    },
    step(s, dt, inp, a) {
      const { W, H } = a, G = H * 0.82;
      const sp = W * (0.28 + Math.min(0.22, s.t * 0.004));
      s.y = H * 0.3 + Math.sin(s.t * 1.6) * 5;
      s.trees.forEach(t => { t.x -= sp * dt; if (t.x < -20) { t.x += W * 1.2; t.h = rnd(16, 26); } });
      if ((s.lspawn -= dt) <= 0) { s.lakes.push({ x: W + 10, w: 130 }); s.lspawn = rnd(6, 8); }
      if ((s.fspawn -= dt) <= 0) {
        const x = W + 20;
        if (!s.lakes.some(l => x > l.x - 30 && x < l.x + l.w + 30)) s.fires.push({ x, size: 0.6, alive: true });
        s.fspawn = Math.max(0.8, rnd(1.2, 2) - s.t * 0.006);
      }
      s.lakes.forEach(l => { l.x -= sp * dt; });
      s.lakes = s.lakes.filter(l => l.x + l.w > -10);
      if (s.tank < 4 && s.lakes.some(l => s.x > l.x && s.x < l.x + l.w)) {
        s.tank = 4;
        sfx.splash();
        say(s, s.x, s.y + 40, 'Бак полон! 💧');
      }
      inp.taps.forEach(() => {
        if (s.tank > 0) {
          s.tank--;
          s.drops.push({ x: s.x - s.pw * 0.05, y: s.y + s.pw * 0.15, vx: -sp * 0.25, vy: 40 });
          sfx.splash();
        } else if (!(s.emptyAt > s.t - 1.3)) {
          s.emptyAt = s.t;
          say(s, s.x + 20, s.y + 44, 'Бак пуст! Лети к озеру', '#ffe0e0');
        }
      });
      s.drops.forEach(d => {
        d.vy += 520 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        if (Math.random() < 0.6) s.parts.push({ x: d.x + rnd(-4, 4), y: d.y - 6, vx: 0, vy: -20, life: 0.25, max: 0.25, color: '#9fd3ff', size: 2.5 });
        if (d.y >= G - 6) {
          d.done = true;
          burst(s, d.x, G - 4, '#7fc4ff', 10, 90);
          s.fires.forEach(f => {
            if (f.alive && Math.abs(f.x - d.x) < 28 + 10 * f.size) {
              f.alive = false;
              s.score++;
              sfx.pick();
              burst(s, f.x, G - 16, '#c9cdd4', 14, 70);
              say(s, f.x, G - 50, 'Потушил!');
            }
          });
        }
      });
      s.drops = s.drops.filter(d => !d.done);
      s.fires.forEach(f => {
        f.x -= sp * dt;
        f.size = Math.min(1.6, f.size + dt * 0.12);
        if (f.alive && f.x < -10) { f.alive = false; say(s, 60, G - 50, 'Лес горит!', '#ffe0e0'); hurt(s, 20, G - 20, true); }
      });
      s.fires = s.fires.filter(f => f.x > -40);
    },
    draw(ctx, s, a) {
      const { W, H } = a, G = H * 0.82;
      fillSky(ctx, W, H, [[0, '#87a9cf'], [0.7, '#f3cf9e'], [1, '#f0b37a']]);
      ctx.fillStyle = '#4f7a3a'; ctx.fillRect(0, G, W, H - G);
      s.lakes.forEach(l => {
        ctx.fillStyle = '#4f9bd9';
        ctx.beginPath(); ctx.ellipse(l.x + l.w / 2, G + 4, l.w / 2, 9, 0, 0, TAU); ctx.fill();
      });
      s.trees.forEach(t => {
        if (s.lakes.some(l => t.x > l.x - 6 && t.x < l.x + l.w + 6)) return;
        ctx.fillStyle = '#2f5d2a';
        ctx.beginPath(); ctx.moveTo(t.x - 9, G); ctx.lineTo(t.x, G - t.h); ctx.lineTo(t.x + 9, G); ctx.fill();
      });
      s.fires.forEach(f => {
        if (!f.alive) {
          ctx.fillStyle = 'rgba(120, 120, 130, .35)';
          ctx.beginPath(); ctx.arc(f.x, G - 30, 12, 0, TAU); ctx.fill();
          return;
        }
        const k = f.size;
        ctx.fillStyle = 'rgba(90, 90, 100, .3)';
        ctx.beginPath(); ctx.arc(f.x + 6, G - 50 * k, 14 * k, 0, TAU); ctx.fill();
        [['#ff6b35', 1], ['#ffb347', 0.7], ['#fff1a8', 0.4]].forEach(([c, m]) => {
          const fl = Math.sin(s.t * 18 + f.x) * 3;
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.moveTo(f.x - 14 * k * m, G);
          ctx.quadraticCurveTo(f.x - 10 * k * m, G - 22 * k * m, f.x + fl * m, G - 36 * k * m);
          ctx.quadraticCurveTo(f.x + 10 * k * m, G - 22 * k * m, f.x + 14 * k * m, G);
          ctx.fill();
        });
      });
      s.drops.forEach(d => {
        ctx.fillStyle = '#3d8fe0';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, 6, 9, 0, 0, TAU); ctx.fill();
      });
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
      for (let i = 0; i < 4; i++) { // запас воды в баке
        const x = W - 18 - (3 - i) * 20, y = 22;
        ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.quadraticCurveTo(x + 8, y + 1, x, y + 7); ctx.quadraticCurveTo(x - 8, y + 1, x, y - 9);
        ctx.fillStyle = i < s.tank ? '#3d8fe0' : 'rgba(255, 255, 255, .35)'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      if (s.t < 2.5) hint(ctx, W, H * 0.75, this.tip);
    },
  },

  /* 7. Су-27: «Воздушный бой» — пушка стреляет сама, уворачивайся и сбивай */
  {
    how: 'Води пальцем вверх и вниз — пушка стреляет сама. Сбивай дроны-хулиганы и злые тучки (у тучки 3 жизни, она стреляет молниями). Уворачивайся!',
    tip: 'Води пальцем — пушка стреляет сама',
    start(W, H) {
      return base({ x: W * 0.2, y: H / 2, pw: pwOf(W), bullets: [], foes: [], bolts: [], fire: 0.3, spawn: 0.8, bg: makeClouds(W, H, 5, 0.05, 0.95) });
    },
    step(s, dt, inp, a) {
      const { W, H } = a;
      if (inp.has) s.y += (clamp(inp.y, s.pw * 0.25, H - s.pw * 0.25) - s.y) * Math.min(1, dt * 9);
      const sp = W * (0.3 + Math.min(0.25, s.t * 0.004));
      moveClouds(s.bg, dt, sp * 1.4, W);
      if ((s.fire -= dt) <= 0) {
        s.bullets.push({ x: s.x + s.pw * 0.45, y: s.y + s.pw * 0.02 });
        s.fire = 0.22;
        sfx.shoot();
      }
      s.bullets.forEach(b => { b.x += W * 1.5 * dt; });
      if ((s.spawn -= dt) <= 0) {
        const big = Math.random() < 0.15 + Math.min(0.2, s.t * 0.003);
        s.foes.push({ big, x: W + 30, y: rnd(H * 0.1, H * 0.9), hp: big ? 3 : 1, r: big ? 24 : 15, ph: rnd(0, TAU), shoot: rnd(1, 2) });
        s.spawn = Math.max(0.45, 1.2 - s.t * 0.008);
      }
      s.foes.forEach(f => {
        f.x -= sp * (f.big ? 0.7 : 1) * dt;
        f.y += Math.sin(s.t * 2 + f.ph) * 30 * dt;
        if (f.big && f.x < W - 20 && (f.shoot -= dt) <= 0) {
          s.bolts.push({ x: f.x - f.r, y: f.y, vx: -W * 0.55, vy: (s.y - f.y) * 0.4 });
          f.shoot = rnd(1.6, 2.8);
        }
        s.bullets.forEach(b => {
          if (!b.done && !f.dead && Math.hypot(b.x - f.x, b.y - f.y) < f.r) {
            b.done = true;
            f.hp--;
            burst(s, b.x, b.y, '#ffd23f', 4, 60);
            if (f.hp <= 0) {
              f.dead = true;
              s.score += f.big ? 3 : 1;
              sfx.boom();
              burst(s, f.x, f.y, f.big ? '#8b97b8' : '#ff8a3d', 18, 150);
              if (f.big) say(s, f.x, f.y - 20, '+3');
            }
          }
        });
        if (!f.dead && Math.abs(f.x - s.x) < s.pw * 0.4 + f.r * 0.6 && Math.abs(f.y - s.y) < s.pw * 0.13 + f.r * 0.6) {
          f.dead = true;
          hurt(s, s.x, s.y);
        }
      });
      s.bolts.forEach(b => {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (Math.abs(b.x - s.x) < s.pw * 0.38 && Math.abs(b.y - s.y) < s.pw * 0.14 + 4) { b.done = true; hurt(s, s.x, s.y); }
      });
      s.bullets = s.bullets.filter(b => !b.done && b.x < W + 20);
      s.foes = s.foes.filter(f => !f.dead && f.x > -40);
      s.bolts = s.bolts.filter(b => !b.done && b.x > -20);
    },
    draw(ctx, s, a) {
      const { W, H } = a;
      fillSky(ctx, W, H, [[0, '#3d7bd6'], [1, '#a8d4ff']]);
      drawClouds(ctx, s.bg, 'rgba(255, 255, 255, .7)');
      ctx.fillStyle = '#ffd23f';
      s.bullets.forEach(b => ctx.fillRect(b.x - 6, b.y - 1.5, 12, 3));
      s.foes.forEach(f => {
        if (f.big) {
          puff(ctx, f.x - f.r * 0.7, f.y, f.r * 0.7, '#7c88a8');
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(f.x - 8, f.y - 2, 5, 0, TAU); ctx.arc(f.x + 6, f.y - 2, 5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2b2d42';
          ctx.beginPath(); ctx.arc(f.x - 9, f.y - 1, 2.4, 0, TAU); ctx.arc(f.x + 5, f.y - 1, 2.4, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#2b2d42'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(f.x - 14, f.y - 10); ctx.lineTo(f.x - 4, f.y - 7); ctx.moveTo(f.x + 12, f.y - 10); ctx.lineTo(f.x + 2, f.y - 7); ctx.stroke();
          ctx.fillStyle = '#ef6461';
          for (let i = 0; i < f.hp; i++) ctx.fillRect(f.x - 12 + i * 9, f.y + f.r * 0.8, 7, 4);
        } else {
          ctx.fillStyle = '#4a515c';
          ctx.fillRect(f.x - 12, f.y - 3, 24, 6);
          ctx.fillStyle = '#6b7381';
          ctx.beginPath(); ctx.ellipse(f.x, f.y, 9, 6, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(40, 45, 55, .55)';
          const bl = 9 * Math.abs(Math.sin(s.t * 30));
          ctx.fillRect(f.x - 12 - bl, f.y - 7, bl * 2, 2);
          ctx.fillRect(f.x + 12 - bl, f.y - 7, bl * 2, 2);
          ctx.fillStyle = '#ff4d3d';
          ctx.beginPath(); ctx.arc(f.x - 5, f.y, 2.5, 0, TAU); ctx.fill();
        }
      });
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      s.bolts.forEach(b => {
        ctx.beginPath(); ctx.moveTo(b.x + 8, b.y - 6); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + 5, b.y + 2); ctx.lineTo(b.x - 6, b.y + 8); ctx.stroke();
      });
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
      if (s.t < 2.5) hint(ctx, W, H * 0.8, this.tip);
    },
  },

  /* 8. Ан-124: «Точный сброс» — сбрось груз на плот, учитывая ветер */
  {
    how: 'Нажми на экран, когда «Руслан» пролетает, — он сбросит груз на парашюте. Попади на плот: в центр — 10 очков! Смотри на ветер: он сносит парашют. Всего 10 грузов.',
    tip: 'Нажми — сбросить груз',
    lives: false,
    start(W, H) {
      return base({ pw: pwOf(W) * 1.25, lives: 0, cargo: 10, plane: null, box: null, wind: 0, raft: { x: W * 0.6, dir: 1, w: Math.min(110, W * 0.3) }, delay: 0.4 });
    },
    step(s, dt, inp, a) {
      const { W, H } = a, sea = H * 0.78, r = s.raft;
      r.x += r.dir * W * (0.08 + 0.012 * (10 - s.cargo)) * dt;
      if (r.x > W - r.w / 2 - 10) r.dir = -1;
      if (r.x < r.w / 2 + 10) r.dir = 1;
      if (!s.plane && !s.box && s.ending == null) {
        if (s.cargo <= 0) { s.ending = 0.8; return; }
        if ((s.delay -= dt) <= 0) {
          s.plane = { x: -s.pw, y: H * 0.17, dropped: false };
          s.wind = Math.round(rnd(-1, 1) * 10) / 10;
        }
      }
      if (s.plane) {
        const p = s.plane;
        p.x += W * 0.3 * dt;
        if (inp.taps.length && !p.dropped && p.x > 0 && p.x < W) {
          p.dropped = true;
          s.cargo--;
          s.box = { x: p.x, y: p.y + 14, vx: W * 0.15, vy: 0, t: 0, open: false };
          sfx.flap();
        }
        if (p.x > W + s.pw) {
          if (!p.dropped) { s.cargo--; say(s, W / 2, H * 0.35, 'Груз не сброшен', '#ffe0e0'); }
          s.plane = null;
          s.delay = 0.6;
        }
      }
      const b = s.box;
      if (b) {
        b.t += dt;
        if (b.t > 0.35) {
          b.open = true;
          b.vx += (s.wind * W * 0.09 - b.vx) * Math.min(1, dt * 1.8);
          b.vy += (H * 0.11 - b.vy) * Math.min(1, dt * 3);
        } else {
          b.vy += 420 * dt;
          b.vx *= 1 - dt * 0.5;
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y >= sea - 12) {
          const d = Math.abs(b.x - r.x);
          const pts = d < r.w * 0.12 ? 10 : d < r.w * 0.3 ? 5 : d < r.w * 0.5 ? 2 : 0;
          s.score += pts;
          say(s, b.x, sea - 40, pts === 10 ? 'В яблочко! +10' : pts ? '+' + pts : 'Мимо!', pts ? '#fff' : '#ffe0e0');
          if (pts) { sfx.pick(); burst(s, b.x, sea - 12, '#ffd23f', 12, 90); } else { sfx.splash(); burst(s, b.x, sea, '#7fc4ff', 14, 90); }
          s.box = null;
        }
      }
    },
    draw(ctx, s, a) {
      const { W, H } = a, sea = H * 0.78, r = s.raft;
      fillSky(ctx, W, H, [[0, '#7cc3f5'], [1, '#e6f6ff']]);
      const g = ctx.createLinearGradient(0, sea, 0, H);
      g.addColorStop(0, '#3f8fd0'); g.addColorStop(1, '#1f5a96');
      ctx.fillStyle = g; ctx.fillRect(0, sea, W, H - sea);
      ctx.strokeStyle = 'rgba(255, 255, 255, .45)'; ctx.lineWidth = 2;
      for (let row = 0; row < 3; row++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, sea + 10 + row * 16 + Math.sin(x * 0.05 + s.t * 2 + row) * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#a0723f'; ctx.fillRect(r.x - r.w / 2, sea - 8, r.w, 10);
      ctx.fillStyle = '#7a5530';
      for (let x = r.x - r.w / 2 + 10; x < r.x + r.w / 2; x += 14) ctx.fillRect(x, sea - 8, 2, 10);
      [[0.5, '#ef6461'], [0.3, '#ffffff'], [0.12, '#ef6461']].forEach(([k, c]) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(r.x, sea - 9, r.w * k, 4 * k / 0.5 + 1, 0, 0, TAU); ctx.fill();
      });
      if (s.plane) drawSprite(ctx, a.img, s.plane.x, s.plane.y, s.pw);
      const b = s.box;
      if (b) {
        if (b.open) {
          ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(b.x - 18, b.y - 26); ctx.lineTo(b.x - 6, b.y - 6); ctx.moveTo(b.x + 18, b.y - 26); ctx.lineTo(b.x + 6, b.y - 6); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y - 26, 19, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#ef6461'; ctx.beginPath(); ctx.moveTo(b.x, b.y - 26); ctx.arc(b.x, b.y - 26, 19, Math.PI * 1.25, Math.PI * 1.5); ctx.moveTo(b.x, b.y - 26); ctx.arc(b.x, b.y - 26, 19, Math.PI * 1.75, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#6b7f4a'; ctx.fillRect(b.x - 9, b.y - 7, 18, 14);
        ctx.strokeStyle = '#3e4a2a'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x - 9, b.y - 7, 18, 14);
      }
      const wl = s.wind * 40;
      label(ctx, 'Ветер', W / 2, 20, 14);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(W / 2 - wl, 40); ctx.lineTo(W / 2 + wl, 40);
      if (Math.abs(wl) > 3) { const d = Math.sign(wl); ctx.moveTo(W / 2 + wl - d * 7, 34); ctx.lineTo(W / 2 + wl, 40); ctx.lineTo(W / 2 + wl - d * 7, 46); }
      ctx.stroke();
      if (Math.abs(wl) <= 3) label(ctx, 'штиль', W / 2, 40, 12);
      label(ctx, `📦 × ${s.cargo}`, 12, 22, 16, '#fff', 'left');
      if (s.t < 3) hint(ctx, W, H * 0.6, this.tip);
    },
  },

  /* 9. Ту-144: «Сверхзвук» — перестраивайся между тремя коридорами */
  {
    how: 'Ту-144 разгоняется до двух скоростей звука! Нажимай выше самолёта — он поднимется в верхний коридор, ниже — опустится. Облетай воздушные шары, тучи и птиц.',
    tip: 'Нажми выше или ниже самолёта',
    start(W, H) {
      const lines = Array.from({ length: 14 }, () => ({ x: rnd(0, W), y: rnd(0, H), l: rnd(20, 60) }));
      return base({ lane: 1, x: W * 0.22, y: H * 0.5, pw: pwOf(W) * 1.15, rows: [], spawn: 1.2, mach: 0.6, boomed: false, boomT: 0, lines });
    },
    lanes(H) { return [H * 0.28, H * 0.5, H * 0.72]; },
    step(s, dt, inp, a) {
      const { W, H } = a, L = this.lanes(H);
      inp.taps.forEach(t => {
        if (t.y < s.y - 8 && s.lane > 0) { s.lane--; sfx.flap(); }
        else if (t.y > s.y + 8 && s.lane < 2) { s.lane++; sfx.flap(); }
      });
      s.y += (L[s.lane] - s.y) * Math.min(1, dt * 10);
      s.mach = Math.min(2, 0.6 + s.t * 0.03);
      if (!s.boomed && s.mach >= 1) {
        s.boomed = true; s.boomT = 1;
        sfx.boom();
        say(s, W / 2, H * 0.12, 'Звуковой барьер! 💥');
      }
      s.boomT = Math.max(0, s.boomT - dt);
      const sp = W * (0.35 + s.mach * 0.32);
      s.lines.forEach(l => { l.x -= sp * 1.6 * dt; if (l.x < -l.l) { l.x = W + rnd(0, 40); l.y = rnd(0, H); } });
      if ((s.spawn -= dt) <= 0) {
        const n = Math.random() < 0.35 + Math.min(0.3, s.t * 0.006) ? 2 : 1;
        const lanes = shuffle([0, 1, 2]).slice(0, n);
        s.rows.push({ x: W + 40, lanes, types: lanes.map(() => ['balloon', 'cloud', 'birds'][Math.floor(Math.random() * 3)]), passed: false, hit: false });
        s.spawn = Math.max(0.75, 1.6 - s.t * 0.012);
      }
      const cur = L.reduce((best, y, i) => Math.abs(y - s.y) < Math.abs(L[best] - s.y) ? i : best, 0);
      s.rows.forEach(r => {
        r.x -= sp * dt;
        if (!r.passed && r.x < s.x - s.pw * 0.5) { r.passed = true; if (!r.hit) { s.score++; sfx.pick(); } }
        if (!r.hit && Math.abs(r.x - s.x) < s.pw * 0.42 + 18 && r.lanes.includes(cur)) { r.hit = true; hurt(s, s.x, s.y); }
      });
      s.rows = s.rows.filter(r => r.x > -60);
    },
    draw(ctx, s, a) {
      const { W, H } = a, L = this.lanes(H);
      fillSky(ctx, W, H, [[0, '#0f2f6b'], [0.55, '#3c7bd0'], [1, '#bfe2ff']]);
      ctx.strokeStyle = 'rgba(255, 255, 255, .35)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      s.lines.forEach(l => { ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.l, l.y); });
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, .18)'; ctx.setLineDash([10, 12]); ctx.lineWidth = 2;
      [L[0] + (L[1] - L[0]) / 2, L[1] + (L[2] - L[1]) / 2].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
      ctx.setLineDash([]);
      s.rows.forEach(r => r.lanes.forEach((ln, i) => {
        const x = r.x, y = L[ln], t = r.types[i];
        if (t === 'balloon') {
          ctx.fillStyle = '#ef6461'; ctx.beginPath(); ctx.ellipse(x, y - 8, 15, 18, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(x, y - 8, 6, 18, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 8, y + 8); ctx.lineTo(x - 4, y + 16); ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + 4, y + 16); ctx.stroke();
          ctx.fillStyle = '#a0723f'; ctx.fillRect(x - 5, y + 15, 10, 7);
        } else if (t === 'cloud') {
          puff(ctx, x - 16, y + 4, 14, '#8b97b8');
        } else {
          bird(ctx, x - 10, y - 8, 8, s.t); bird(ctx, x + 8, y, 8, s.t + 1); bird(ctx, x - 6, y + 10, 8, s.t + 2);
        }
      }));
      if (s.boomT > 0) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${s.boomT})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x + s.pw * 0.45, s.y, (1 - s.boomT) * 80 + 20, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
      }
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
      label(ctx, `М ${s.mach.toFixed(2).replace('.', ',')}`, W - 12, 24, 18, s.mach >= 1 ? '#ffd23f' : '#fff', 'right');
      if (s.t < 2.5) hint(ctx, W, H * 0.9, this.tip);
    },
  },

  /* 10. «Буран»: «Метеориты» — нажимай на метеорит, и лазер его разобьёт */
  {
    how: '«Буран» на орбите! Нажимай прямо на метеорит — лазер его разобьёт. Большой метеорит раскалывается на два маленьких. Не дай метеоритам врезаться в корабль!',
    tip: 'Нажимай на метеориты!',
    start(W, H) {
      const stars = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.5, 1.8), k: rnd(0.2, 1) }));
      return base({ x: W * 0.16, y: H * 0.5, pw: pwOf(W) * 1.1, rocks: [], beams: [], cd: 0, spawn: 0.8, stars });
    },
    rock(x, y, big, vx, vy) {
      const r = big ? rnd(22, 27) : rnd(12, 15);
      const pts = Array.from({ length: 9 }, (_, i) => { const an = i / 9 * TAU; return [Math.cos(an) * r * rnd(0.75, 1.05), Math.sin(an) * r * rnd(0.75, 1.05)]; });
      return { x, y, r, big, vx, vy, rot: rnd(0, TAU), vr: rnd(-1.5, 1.5), pts };
    },
    step(s, dt, inp, a) {
      const { W, H } = a;
      s.y = H * 0.5 + Math.sin(s.t * 0.9) * H * 0.06;
      s.stars.forEach(st => { st.x -= 14 * st.k * dt; if (st.x < 0) st.x += W; });
      s.cd -= dt;
      inp.taps.forEach(t => {
        if (s.cd > 0) return;
        s.cd = 0.15;
        const ox = s.x + s.pw * 0.45, oy = s.y;
        let dx = t.x - ox, dy = t.y - oy;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        let best = null, bestT = Infinity;
        s.rocks.forEach(r => {
          const px = r.x - ox, py = r.y - oy;
          const along = px * dx + py * dy;
          const perp = Math.abs(px * dy - py * dx);
          if (along > 0 && perp < r.r + 6 && along < bestT) { best = r; bestT = along; }
        });
        const reach = best ? bestT : Math.max(W, H) * 1.5;
        s.beams.push({ x1: ox, y1: oy, x2: ox + dx * reach, y2: oy + dy * reach, life: 0.15 });
        sfx.laser();
        if (best) {
          best.dead = true;
          s.score += best.big ? 2 : 1;
          burst(s, best.x, best.y, '#b08060', best.big ? 18 : 10, 130);
          sfx.boom();
          if (best.big) {
            const sp = Math.hypot(best.vx, best.vy);
            s.rocks.push(this.rock(best.x, best.y, false, best.vx * 0.8, -sp * 0.6));
            s.rocks.push(this.rock(best.x, best.y, false, best.vx * 0.8, sp * 0.6));
          }
        }
      });
      s.beams.forEach(b => { b.life -= dt; });
      s.beams = s.beams.filter(b => b.life > 0);
      if ((s.spawn -= dt) <= 0) {
        const big = Math.random() < 0.35;
        const y = rnd(H * 0.1, H * 0.9);
        const ty = s.y + rnd(-H * 0.25, H * 0.25);
        const sp = W * (0.18 + Math.min(0.25, s.t * 0.004));
        const dx = s.x - (W + 30), dy = ty - y, len = Math.hypot(dx, dy);
        s.rocks.push(this.rock(W + 30, y, big, dx / len * sp, dy / len * sp));
        s.spawn = Math.max(0.45, 1.3 - s.t * 0.01);
      }
      s.rocks.forEach(r => {
        r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt;
        if (!r.dead && Math.abs(r.x - s.x) < s.pw * 0.42 + r.r * 0.7 && Math.abs(r.y - s.y) < s.pw * 0.14 + r.r * 0.7) {
          r.dead = true;
          burst(s, r.x, r.y, '#b08060', 12, 120);
          hurt(s, s.x, s.y);
        }
      });
      s.rocks = s.rocks.filter(r => !r.dead && r.x > -60 && r.y > -80 && r.y < H + 80);
    },
    draw(ctx, s, a) {
      const { W, H } = a;
      fillSky(ctx, W, H, [[0, '#05060f'], [1, '#141b3a']]);
      ctx.fillStyle = '#fff';
      s.stars.forEach(st => { ctx.globalAlpha = 0.4 + st.k * 0.6; ctx.fillRect(st.x, st.y, st.r, st.r); });
      ctx.globalAlpha = 1;
      const R = H * 1.2, cx = W * 0.55, cy = H + R * 0.82;
      const eg = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.04);
      eg.addColorStop(0, '#1f6fbf'); eg.addColorStop(0.85, '#5fb0ff'); eg.addColorStop(1, 'rgba(120, 190, 255, 0)');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(80, 160, 90, .55)';
      ctx.beginPath(); ctx.ellipse(cx - R * 0.25, cy - R * 0.93, R * 0.18, R * 0.04, 0.1, 0, TAU); ctx.fill();
      s.rocks.forEach(r => {
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
        ctx.fillStyle = '#8a6a50'; ctx.strokeStyle = '#4e3a2a'; ctx.lineWidth = 2;
        ctx.beginPath(); r.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6e523c';
        ctx.beginPath(); ctx.arc(r.r * 0.25, -r.r * 0.2, r.r * 0.22, 0, TAU); ctx.arc(-r.r * 0.3, r.r * 0.3, r.r * 0.15, 0, TAU); ctx.fill();
        ctx.restore();
      });
      s.beams.forEach(b => {
        ctx.strokeStyle = `rgba(120, 240, 255, ${b.life / 0.15})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.life / 0.15})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      });
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
      if (s.t < 2.5) hint(ctx, W, H * 0.3, this.tip);
    },
  },
];

function stormColumn(ctx, cx, w, y1, y2, open) {
  if (y2 - y1 < 2) return;
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, '#9aa5c2'); g.addColorStop(1, '#6d7898');
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, y1, w, y2 - y1);
  const ey = open === 'down' ? y2 : y1;
  ctx.fillStyle = '#8692b2';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const px = cx - w / 2 + w * (i + 0.5) / 3;
    ctx.moveTo(px + w * 0.24, ey);
    ctx.arc(px, ey, w * 0.24, 0, TAU);
  }
  ctx.fill();
}

/* ================= Движок: экран «Аэродром» и экран игры ================= */
const arc = {
  i: -1, game: null, s: null, raf: 0, last: 0, running: false, paused: false,
  W: 0, H: 0, ctx: null, img: null, mode: 'intro',
  inp: { down: false, x: 0, y: 0, has: false, taps: [] },
};

function renderArcade() {
  $('ticketCount').textContent = data.tickets;
  const left = TICKET_EVERY - data.ticketProgress;
  $('ticketSub').textContent = `Ещё ${left} ${plural(left, 'верный ответ', 'верных ответа', 'верных ответов')} — и новый билет`;
  $('ticketBar').style.width = (data.ticketProgress / TICKET_EVERY * 100) + '%';
  const lv = level();
  $('games').innerHTML = PLANES.map((p, i) => {
    const open = lv >= p.level;
    const best = data.arcadeBest[p.id];
    return `<button class="game-tile${open ? '' : ' locked'}" type="button" data-game="${i}">` +
      `<span class="gt-pic">${planeSVG(p.id)}</span>` +
      `<b>${open ? '' : '🔒 '}${p.game}</b>` +
      `<span class="gt-sub">${open ? (best ? 'Рекорд: ' + best : p.name) : unlockText(p.level)}</span></button>`;
  }).join('');
  const next = PLANES.find(p => p.level > lv);
  $('gamesHint').textContent = next
    ? `Следующая игра «${next.game}» откроется с самолётом ${next.name}: ${unlockText(next.level).toLowerCase()}.`
    : 'Все игры открыты! Ты настоящая легенда неба! 👑';
}

function openArcade() {
  renderArcade();
  showScreen('arcade');
}

function setupCanvas() {
  const stage = $('playStage'), cv = $('playCanvas');
  const W = stage.clientWidth;
  const top = stage.getBoundingClientRect().top;
  const H = Math.round(clamp(window.innerHeight - top - 14, 300, W * 1.7));
  cv.style.height = H + 'px';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  arc.ctx = cv.getContext('2d');
  arc.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  arc.W = W;
  arc.H = H;
}

function openGame(i) {
  const p = PLANES[i];
  if (!p || level() < p.level) return;
  arcadeStop();
  arc.i = i;
  arc.game = ARCADE[i];
  showScreen('play');
  $('playTitle').textContent = p.game;
  $('playScore').textContent = '0';
  setupCanvas();
  arc.img = planeImage(p.id);
  arc.s = arc.game.start(arc.W, arc.H);
  const redraw = () => { if (!arc.running && arc.s) drawGame(); };
  if (!arc.img.complete) arc.img.addEventListener('load', redraw, { once: true });
  drawGame();
  showOverlay('intro');
}

function showOverlay(mode) {
  arc.mode = mode;
  const p = PLANES[arc.i];
  const best = data.arcadeBest[p.id] || 0;
  $('playOverlay').classList.remove('hidden');
  $('poPic').innerHTML = planeSVG(p.id);
  const go = $('poGo');
  const noTickets = data.tickets < 1;
  if (mode === 'pause') {
    $('poTitle').textContent = 'Пауза';
    $('poText').textContent = 'Игра ждёт тебя.';
    go.textContent = 'Продолжить ▶';
    go.disabled = false;
    return;
  }
  if (mode === 'intro') {
    $('poTitle').textContent = p.game;
    $('poText').textContent = arc.game.how + (best ? ` Рекорд: ${best}.` : '');
  } else {
    const score = arc.s.score;
    const record = score > 0 && score >= best && arc.newRecord;
    $('poTitle').textContent = record ? 'Новый рекорд! 🎉' : 'Полёт окончен!';
    $('poText').textContent = `Счёт: ${score}. Рекорд: ${best}.`;
  }
  go.disabled = noTickets;
  go.textContent = noTickets
    ? 'Нет билетов 🎟️'
    : (mode === 'intro' ? 'Играть' : 'Ещё раз') + ` · 🎟️ 1 из ${data.tickets}`;
  $('poNote').textContent = noTickets ? `Реши ${TICKET_EVERY - data.ticketProgress} ${plural(TICKET_EVERY - data.ticketProgress, 'пример', 'примера', 'примеров')} правильно — и получишь билет.` : '';
}

function startRound() {
  if (arc.mode === 'pause') {
    arc.paused = false;
    arc.last = performance.now();
    $('playOverlay').classList.add('hidden');
    return;
  }
  if (data.tickets < 1) return;
  data.tickets--;
  data.arcadePlays = (data.arcadePlays || 0) + 1;
  saveData();
  arc.s = arc.game.start(arc.W, arc.H);
  arc.inp = { down: false, x: 0, y: 0, has: false, taps: [] };
  arc.newRecord = false;
  $('playOverlay').classList.add('hidden');
  $('playScore').textContent = '0';
  arc.running = true;
  arc.paused = false;
  arc.last = performance.now();
  sounds.takeoff();
  arc.raf = requestAnimationFrame(loop);
}

function loop(t) {
  if (!arc.running) return;
  const dt = Math.min(0.05, Math.max(0, (t - arc.last) / 1000));
  arc.last = t;
  const s = arc.s;
  if (!arc.paused) {
    s.t += dt;
    if (s.inv > 0) s.inv -= dt;
    if (s.ending != null) {
      s.ending -= dt;
      if (s.ending <= 0) s.over = true;
    } else {
      arc.game.step(s, dt, arc.inp, arc);
    }
    s.parts = s.parts.filter(p => (p.life -= dt) > 0);
    s.parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; });
    s.texts = s.texts.filter(x => (x.life -= dt) > 0);
    s.texts.forEach(x => { x.y -= 30 * dt; });
  }
  arc.inp.taps.length = 0;
  drawGame();
  $('playScore').textContent = s.score;
  if (s.over) { endRound(); return; }
  arc.raf = requestAnimationFrame(loop);
}

function drawGame() {
  const { ctx, s, W, H } = arc;
  if (!ctx || !s) return;
  ctx.clearRect(0, 0, W, H);
  arc.game.draw(ctx, s, arc);
  s.parts.forEach(p => {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
  });
  ctx.globalAlpha = 1;
  s.texts.forEach(x => {
    ctx.globalAlpha = clamp(x.life, 0, 1);
    label(ctx, x.text, x.x, x.y, 18, x.color);
  });
  ctx.globalAlpha = 1;
  if (arc.game.lives !== false) drawLives(ctx, s);
}

function endRound() {
  arc.running = false;
  cancelAnimationFrame(arc.raf);
  const id = PLANES[arc.i].id;
  const best = data.arcadeBest[id] || 0;
  arc.newRecord = arc.s.score > best;
  if (arc.newRecord) data.arcadeBest[id] = arc.s.score;
  saveData();
  if (arc.newRecord) sounds.fanfare(); else sounds.chime();
  showOverlay('over');
}

function arcadeStop() {
  arc.running = false;
  arc.paused = false;
  cancelAnimationFrame(arc.raf);
}

/* ---------- Управление ---------- */
(function setupArcadeInput() {
  const cv = $('playCanvas');
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = pos(e);
    Object.assign(arc.inp, { down: true, x: p.x, y: p.y, has: true });
    arc.inp.taps.push(p);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* не важно */ }
  });
  cv.addEventListener('pointermove', e => {
    if (!arc.inp.down && e.pointerType !== 'mouse') return;
    const p = pos(e);
    Object.assign(arc.inp, { x: p.x, y: p.y, has: true });
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => cv.addEventListener(ev, () => { arc.inp.down = false; }));
  document.addEventListener('keydown', e => { // на компьютере: пробел = нажатие
    if (!arc.running || screenNow !== 'play') return;
    if (e.code === 'Space' || e.key === 'ArrowUp') {
      e.preventDefault();
      arc.inp.taps.push({ x: arc.s.x || arc.W / 2, y: (arc.s.y || arc.H / 2) - 30 });
      arc.inp.down = true;
    }
  });
  document.addEventListener('keyup', e => { if (e.code === 'Space' || e.key === 'ArrowUp') arc.inp.down = false; });

  $('arcadeBtn').addEventListener('click', openArcade);
  $('games').addEventListener('click', e => {
    const t = e.target.closest('[data-game]');
    if (!t) return;
    const i = Number(t.dataset.game);
    if (level() < PLANES[i].level) {
      $('gamesHint').textContent = `«${PLANES[i].game}» откроется с самолётом ${PLANES[i].name}: ${unlockText(PLANES[i].level).toLowerCase()}. Экзамен — это бой с Боссом на одном числе.`;
      return;
    }
    openGame(i);
  });
  $('poGo').addEventListener('click', startRound);
  $('poBack').addEventListener('click', () => { arcadeStop(); openArcade(); });
  $('playQuit').addEventListener('click', () => { arcadeStop(); openArcade(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && arc.running && !arc.paused) {
      arc.paused = true;
      showOverlay('pause');
    }
  });
})();
