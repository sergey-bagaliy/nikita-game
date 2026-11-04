'use strict';

/* «Аэродром»: 10 мини-игр, по одной на каждый самолёт (planes.js).
   В каждой игре 5 уровней. У уровня своя цель (пролети 8 просветов, спаси 6 человек…),
   и с каждым уровнем появляется что-то новое и становится сложнее.
   Жизни можно терять и находить: летают бонусы ❤️ (+1 жизнь), 🛡️ (щит) и ×2 (двойные очки).
   Игра открывается вместе со своим самолётом (за экзамены). Один полёт стоит 1 билет 🎟️:
   уровни идут один за другим, пока не кончатся жизни. Пройденные уровни запоминаются. */

const TAU = Math.PI * 2;
const LEVELS = 5;
const MAX_LIVES = 5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const chance = p => Math.random() < p;
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
  bonus() { [988, 1319, 1760].forEach((f, i) => tone(f, i * 0.06, 0.16, { type: 'triangle', vol: 0.1 })); },
  thunder() { whoosh(0, 0.9, 900, 80, 0.35); },
};

/* ================= Рисование ================= */
function fillSky(ctx, W, H, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
function drawClouds(ctx, list, color) { list.forEach(c => puff(ctx, c.x, c.y, c.r, color)); }
function makeRain(W, H, n) { return Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, H), v: rnd(380, 520) })); }
function rainStep(list, dt, W, H, slant = 0.15) {
  list.forEach(r => {
    r.y += r.v * dt; r.x -= r.v * slant * dt;
    if (r.y > H) { r.y = -10; r.x = rnd(0, W + 40); }
  });
}
function rainDraw(ctx, list, color = 'rgba(220, 235, 255, .45)') {
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath();
  list.forEach(r => { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 3, r.y + 12); });
  ctx.stroke();
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
function bird(ctx, x, y, size, t, color = '#2b2d42') {
  const f = Math.sin(t * 14 + x * 0.05) * size * 0.45;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y - f);
  ctx.quadraticCurveTo(x - size * 0.4, y - size * 0.5, x, y);
  ctx.quadraticCurveTo(x + size * 0.4, y - size * 0.5, x + size, y - f);
  ctx.stroke();
}
function drawBolt(ctx, x1, y1, x2, y2, width = 4) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const seg = Math.max(4, Math.round(len / 24));
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < seg; i++) {
    const k = i / seg, j = rnd(-9, 9);
    ctx.lineTo(x1 + dx * k + nx * j, y1 + dy * k + ny * j);
  }
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'rgba(255, 236, 140, .95)'; ctx.lineWidth = width; ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = width * 0.4; ctx.stroke();
}
function warnLine(ctx, x1, y1, x2, y2, t) { // мигающее предупреждение перед молнией
  if (Math.floor(t * 8) % 2) return;
  ctx.strokeStyle = 'rgba(255, 210, 63, .85)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);
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
function wrapText(ctx, text, maxW) {
  const out = [];
  text.split('\n').forEach(par => {
    let line = '';
    par.split(' ').forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
  });
  return out;
}
function person(ctx, x, y, t, wave = true) { // человечек ростом ~26 px, y — ноги
  ctx.strokeStyle = '#2b2d42'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const a = wave ? Math.sin(t * 8) * 0.6 : 0;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y - 14);
  ctx.moveTo(x, y - 10); ctx.lineTo(x - 7, y - 4);
  ctx.moveTo(x, y - 10); ctx.lineTo(x + 6 * Math.cos(a - 1), y - 10 - 9 * Math.abs(Math.sin(a + 1.6)));
  ctx.stroke();
  ctx.fillStyle = '#ffcf9e'; ctx.beginPath(); ctx.arc(x, y - 19, 5, 0, TAU); ctx.fill();
}
function chute(ctx, x, y, r, colors = ['#ff8a3d', '#fff']) { // купол парашюта, y — низ строп
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - r, y - r * 1.3); ctx.lineTo(x - 3, y); ctx.moveTo(x + r, y - r * 1.3); ctx.lineTo(x + 3, y); ctx.stroke();
  ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.arc(x, y - r * 1.3, r, Math.PI, 0); ctx.fill();
  ctx.fillStyle = colors[1]; ctx.beginPath(); ctx.moveTo(x, y - r * 1.3); ctx.arc(x, y - r * 1.3, r, Math.PI * 1.4, Math.PI * 1.6); ctx.fill();
}
function angryFace(ctx, x, y, k) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 8 * k, y, 5 * k, 0, TAU); ctx.arc(x + 8 * k, y, 5 * k, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b2d42';
  ctx.beginPath(); ctx.arc(x - 9 * k, y + 1 * k, 2.4 * k, 0, TAU); ctx.arc(x + 7 * k, y + 1 * k, 2.4 * k, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2b2d42'; ctx.lineWidth = 2 * k;
  ctx.beginPath(); ctx.moveTo(x - 14 * k, y - 8 * k); ctx.lineTo(x - 4 * k, y - 5 * k); ctx.moveTo(x + 14 * k, y - 8 * k); ctx.lineTo(x + 4 * k, y - 5 * k); ctx.stroke();
}
function stormColumn(ctx, cx, w, y1, y2, open, angry) {
  if (y2 - y1 < 2) return;
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, angry ? '#7d86a6' : '#9aa5c2'); g.addColorStop(1, angry ? '#4f5878' : '#6d7898');
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, y1, w, y2 - y1);
  const ey = open === 'down' ? y2 : y1;
  ctx.fillStyle = angry ? '#6a7393' : '#8692b2';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const px = cx - w / 2 + w * (i + 0.5) / 3;
    ctx.moveTo(px + w * 0.24, ey);
    ctx.arc(px, ey, w * 0.24, 0, TAU);
  }
  ctx.fill();
}
function petIcon(ctx, x, y, kind) { // котик или пёсик, y — лапы
  const c = kind === 'cat' ? '#f2a144' : '#a8794f';
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.ellipse(x, y - 6, 9, 6, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 8, y - 13, 5.5, 0, TAU); ctx.fill();
  if (kind === 'cat') {
    ctx.beginPath(); ctx.moveTo(x + 4, y - 16); ctx.lineTo(x + 5, y - 22); ctx.lineTo(x + 8, y - 17); ctx.moveTo(x + 9, y - 17); ctx.lineTo(x + 12, y - 22); ctx.lineTo(x + 13, y - 15); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 8, y - 7); ctx.quadraticCurveTo(x - 16, y - 12, x - 12, y - 18); ctx.stroke();
  } else {
    ctx.fillStyle = '#6e4c2f'; ctx.beginPath(); ctx.ellipse(x + 5, y - 13, 2.5, 5, 0.4, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#2b2d42'; ctx.beginPath(); ctx.arc(x + 10, y - 14, 1.3, 0, TAU); ctx.fill();
}
function hare(ctx, x, y) { // зайчик, y — лапы
  ctx.fillStyle = '#b9b2a8';
  ctx.beginPath(); ctx.ellipse(x, y - 6, 8, 6, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 7, y - 11, 4.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - 8, y - 20, 1.8, 6, -0.2, 0, TAU); ctx.ellipse(x - 5, y - 20, 1.8, 6, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 7, y - 7, 2.5, 0, TAU); ctx.fill();
}

/* ================= Общее: жизни, очки, уровни, бонусы ================= */
function base(extra) {
  return Object.assign({
    t: 0, lt: 0, score: 0, lives: 3, inv: 0, over: false, ending: null, parts: [], texts: [],
    level: 1, prog: 0, goal: 1, clear: 0, banner: null, won: false,
    bonuses: [], bonusT: rnd(5, 8), shield: 0, x2: 0, gun: 0,
  }, extra);
}
function burst(s, x, y, color, n = 12, speed = 120) {
  for (let i = 0; i < n; i++) {
    const an = rnd(0, TAU), sp = rnd(speed * 0.3, speed);
    const life = rnd(0.35, 0.8);
    s.parts.push({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life, max: life, color, size: rnd(2, 4.5) });
  }
}
function say(s, x, y, text, color = '#fff') { s.texts.push({ x, y, text, color, life: 1.2 }); }
function addScore(s, n, x, y) {
  const v = n > 0 && s.x2 > 0 ? n * 2 : n;
  s.score = Math.max(0, s.score + v);
  if (x != null) say(s, x, y, (v > 0 ? '+' : '') + v);
  return v;
}
// Шаг к цели уровня. Цель выполнена — уровень пройден.
function progress(s, n = 1) {
  if (s.clear > 0 || s.ending != null) return;
  s.prog = Math.min(s.goal, s.prog + n);
  if (s.prog < s.goal) return;
  const last = s.level >= LEVELS;
  const bonus = addScore(s, s.level * 20);
  s.clear = 2.6;
  s.banner = { title: last ? 'Все 5 уровней пройдены! 🏆' : `Уровень ${s.level} пройден! ⭐`, sub: `Бонус +${bonus} очков`, t: 2.6, max: 2.6 };
  unlockLevel(Math.min(LEVELS, s.level + 1), last);
  sounds.fanfare();
}
// Потеря жизни. force — даже если мигаешь или есть щит (например, упала посылка).
function hurt(s, x, y, force) {
  if (s.ending != null || s.clear > 0) return false;
  if (!force && s.inv > 0) return false;
  if (!force && s.shield > 0) {
    s.shield = 0;
    s.inv = 1;
    say(s, x, y - 24, 'Щит спас! 🛡️', '#d6ecff');
    burst(s, x, y, '#7fc4ff', 14, 130);
    sfx.pick();
    return false;
  }
  s.lives--;
  s.inv = 1.4;
  sfx.hit();
  burst(s, x, y, '#ef6461', 14, 140);
  try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* нет вибрации */ }
  if (s.lives <= 0) s.ending = 1;
  return true;
}

const BONUS = {
  heart: { icon: '❤️', bg: '#ffd6de' },
  shield: { icon: '🛡️', bg: '#d6ecff' },
  x2: { icon: '×2', bg: '#ffe9a8' },
  gun: { icon: '🔥', bg: '#ffd9c2' },
};
function stepBonuses(s, dt, a) {
  const g = a.game;
  if (!g.bonus) return;
  if ((s.bonusT -= dt) <= 0) {
    s.bonusT = rnd(7, 11);
    const kinds = ['shield', 'x2'].concat(g.extraBonus || []);
    if (s.lives < MAX_LIVES) kinds.push('heart', 'heart', 'heart');
    const pos = g.bonus(s, a);
    if (pos) s.bonuses.push(Object.assign({ kind: pick(kinds), r: 15, ph: rnd(0, TAU) }, pos));
  }
  const box = g.box ? g.box(s, a) : null;
  s.bonuses.forEach(b => {
    b.x += b.vx * dt;
    b.y += b.vy * dt + (b.still ? 0 : Math.sin(s.t * 3 + b.ph) * 12 * dt);
    if (box && Math.abs(b.x - box.x) < box.hw + b.r && Math.abs(b.y - box.y) < box.hh + b.r) grabBonus(s, b);
  });
  s.bonuses = s.bonuses.filter(b => !b.done && b.x > -40 && b.x < a.W + 60 && b.y > -60 && b.y < a.H + 40);
}
function grabBonus(s, b) {
  if (b.done) return;
  b.done = true;
  const msg = {
    heart: s.lives < MAX_LIVES ? '+1 ❤️' : '+10',
    shield: 'Щит! 🛡️',
    x2: 'Очки ×2!',
    gun: 'Двойная пушка!',
  }[b.kind];
  if (b.kind === 'heart') { if (s.lives < MAX_LIVES) s.lives++; else addScore(s, 10); }
  if (b.kind === 'shield') s.shield = 8;
  if (b.kind === 'x2') s.x2 = 10;
  if (b.kind === 'gun') s.gun = 9;
  say(s, b.x, b.y - 22, msg, '#fff6c2');
  burst(s, b.x, b.y, '#ffd23f', 12, 100);
  sfx.bonus();
}
function drawBonuses(ctx, s) {
  s.bonuses.forEach(b => {
    const k = 1 + Math.sin(s.t * 6 + b.ph) * 0.08, info = BONUS[b.kind];
    ctx.fillStyle = info.bg;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * k, 0, TAU); ctx.fill(); ctx.stroke();
    if (b.kind === 'x2') label(ctx, info.icon, b.x, b.y + 1, 14, '#8a5a00');
    else {
      ctx.font = `${Math.round(16 * k)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(info.icon, b.x, b.y + 1);
    }
  });
}

/* ================= 10 мини-игр (по порядку самолётов) ================= */
const ARCADE = [
  /* ---------- 1. Ан-2: «Сквозь облака» ---------- */
  {
    icon: '☁️',
    how: 'Нажимай на экран — самолёт поднимается, отпустишь — снижается. Пролетай в просветы между грозовыми тучами, собирай звёзды. 5 уровней: птицы, движущиеся тучи, молнии.',
    goal: L => `Цель: пролети ${L.goal} просветов`,
    levels: [
      { goal: 6, gap: 0.42, sp: 0.36, birds: 0, move: 0, bolts: 0, news: 'Собирай звёзды в просветах' },
      { goal: 8, gap: 0.4, sp: 0.4, birds: 1, move: 0, bolts: 0, news: 'Появились птицы — облетай их!' },
      { goal: 10, gap: 0.38, sp: 0.43, birds: 1, move: 1, bolts: 0, news: 'Тучи двигаются вверх-вниз!' },
      { goal: 12, gap: 0.36, sp: 0.46, birds: 1, move: 1, bolts: 1, news: 'Молнии в просветах! Жди, пока погаснет жёлтая линия' },
      { goal: 14, gap: 0.34, sp: 0.5, birds: 1.6, move: 1, bolts: 1, news: 'Всё вместе и быстрее!' },
    ],
    skies: [['#5fb2f5', '#dff2ff'], ['#6aa8ee', '#e6f2ff'], ['#7b9fe0', '#ffd9b8'], ['#5a6f9e', '#c7b3d6'], ['#3d4f7c', '#8fa3c7']],
    start(W, H) {
      return base({ x: W * 0.26, y: H * 0.45, vy: 0, pw: pwOf(W), started: false, bg: makeClouds(W, H, 4, 0.08, 0.5), field: 0, cols: [], birds: [] });
    },
    setup(s) { s.cols = []; s.birds = []; s.spawn = 0.5; s.bspawn = 3; },
    box: s => ({ x: s.x, y: s.y, hw: s.pw * 0.36, hh: s.pw * 0.12 }),
    bonus: (s, a) => (s.started ? { x: a.W + 20, y: rnd(a.H * 0.2, a.H * 0.7), vx: -a.W * s.L.sp, vy: 0 } : null),
    step(s, dt, inp, a) {
      const { W, H } = a, G = H * 0.9, L = s.L;
      moveClouds(s.bg, dt, 30, W);
      if (!s.started) {
        s.y = H * 0.45 + Math.sin(s.t * 3) * 6;
        if (inp.taps.length) { s.started = true; s.vy = -H * 0.55; sfx.flap(); }
        return;
      }
      if (inp.taps.length) { s.vy = -H * 0.6; sfx.flap(); }
      s.vy = Math.min(s.vy + H * 1.5 * dt, H * 1.1);
      s.y += s.vy * dt;
      const sp = W * L.sp;
      s.field = (s.field + sp * dt) % 40;
      if ((s.spawn -= dt) <= 0) {
        const gap = H * L.gap, gy = rnd(H * 0.12 + gap / 2, G - H * 0.08 - gap / 2);
        s.cols.push({ x: W + 40, w: 56, gap, base: gy, gy, ph: rnd(0, TAU), passed: false, star: chance(0.65), bolt: L.bolts && chance(0.5), bt: rnd(0, 2.4), phase: 0 });
        s.spawn = 0.63 / L.sp;
      }
      const hw = s.pw * 0.36, hh = s.pw * 0.12;
      s.cols.forEach(c => {
        c.x -= sp * dt;
        if (L.move) c.gy = clamp(c.base + Math.sin(s.lt * 1.6 + c.ph) * H * 0.08, H * 0.08 + c.gap / 2, G - H * 0.05 - c.gap / 2);
        c.phase = (s.lt + c.bt) % 2.4;
        c.strike = c.bolt && c.phase > 2 && c.phase < 2.35;
        if (c.bolt && c.phase > 1.95 && c.phase < 2.1 && !c.rang && c.x < W) { c.rang = true; sfx.thunder(); }
        if (c.phase < 1) c.rang = false;
        if (!c.passed && c.x + c.w / 2 < s.x - hw) { c.passed = true; addScore(s, 1); progress(s); sfx.pick(); }
        const inX = s.x + hw > c.x - c.w / 2 && s.x - hw < c.x + c.w / 2;
        if (inX && (s.y - hh < c.gy - c.gap / 2 || s.y + hh > c.gy + c.gap / 2)) hurt(s, s.x, s.y);
        if (inX && c.strike) hurt(s, s.x, s.y);
        if (c.star && Math.abs(c.x - s.x) < hw && Math.abs(c.gy - s.y) < hh + 14) { c.star = false; addScore(s, 2, c.x, c.gy - 16); burst(s, c.x, c.gy, '#ffd23f', 8, 90); sfx.pick(); }
      });
      s.cols = s.cols.filter(c => c.x > -80);
      if (L.birds && (s.bspawn -= dt) <= 0) {
        s.birds.push({ x: W + 20, y: rnd(H * 0.1, H * 0.8), ph: rnd(0, TAU) });
        s.bspawn = rnd(2.4, 4) / L.birds;
      }
      s.birds.forEach(b => {
        b.x -= (sp + W * 0.25) * dt;
        b.y += Math.sin(s.t * 3 + b.ph) * 30 * dt;
        if (!b.hit && Math.abs(b.x - s.x) < hw + 8 && Math.abs(b.y - s.y) < hh + 8) { b.hit = true; hurt(s, s.x, s.y); }
      });
      s.birds = s.birds.filter(b => b.x > -30);
      if (s.y + hh > G) { s.y = G - hh; s.vy = -H * 0.5; hurt(s, s.x, s.y); }
      if (s.y < hh + 4) { s.y = hh + 4; s.vy = Math.max(0, s.vy); }
    },
    draw(ctx, s, a) {
      const { W, H } = a, G = H * 0.9, sky = this.skies[s.level - 1];
      fillSky(ctx, W, H, [[0, sky[0]], [1, sky[1]]]);
      drawClouds(ctx, s.bg, 'rgba(255, 255, 255, .8)');
      ctx.fillStyle = '#86bb5f'; ctx.fillRect(0, G, W, H - G);
      ctx.fillStyle = '#d9c46a';
      for (let x = -s.field; x < W; x += 40) ctx.fillRect(x, G + 5, 18, H - G);
      s.cols.forEach(c => {
        stormColumn(ctx, c.x, c.w, 0, c.gy - c.gap / 2, 'down', c.bolt);
        stormColumn(ctx, c.x, c.w, c.gy + c.gap / 2, G, 'up', c.bolt);
        if (c.bolt && c.phase > 1.2 && c.phase < 2) warnLine(ctx, c.x, c.gy - c.gap / 2 + 6, c.x, c.gy + c.gap / 2 - 6, s.t);
        if (c.strike) drawBolt(ctx, c.x, c.gy - c.gap / 2, c.x, c.gy + c.gap / 2, 5);
        if (c.star) star(ctx, c.x, c.gy, 11, '#ffd23f', s.t * 2);
      });
      s.birds.forEach(b => bird(ctx, b.x, b.y, 11, s.t));
      drawSprite(ctx, a.img, s.x, s.y, s.pw, clamp(s.vy / (H * 1.4), -0.45, 0.6), false, blink(s));
      if (!s.started && !s.banner) label(ctx, 'Нажми, чтобы взлететь!', W / 2, H * 0.62, 18);
    },
  },

  /* ---------- 2. Як-52: «Звездопад» ---------- */
  {
    icon: '⭐',
    how: 'Води пальцем вверх и вниз — самолёт летит за пальцем. Собирай звёзды, облетай птиц и воздушные шары, пролетай сквозь кольца. На 4-м уровне навстречу летят самолёты!',
    goal: L => `Цель: собери ${L.goal} звёзд`,
    levels: [
      { goal: 12, sp: 0.42, bird: 0.16, balloon: 0, ring: 0, plane: 0, storm: 0, news: 'Золотая звезда — сразу 3!' },
      { goal: 16, sp: 0.46, bird: 0.18, balloon: 1, ring: 0, plane: 0, storm: 0, news: 'Снизу поднимаются воздушные шары' },
      { goal: 20, sp: 0.5, bird: 0.2, balloon: 1, ring: 1, plane: 0, storm: 0, news: 'Пролети сквозь кольцо — +3 звезды!' },
      { goal: 24, sp: 0.55, bird: 0.22, balloon: 1, ring: 1, plane: 1, storm: 0, news: 'Навстречу летят самолёты — смотри на «❗»' },
      { goal: 30, sp: 0.6, bird: 0.25, balloon: 1, ring: 1, plane: 1, storm: 1, news: 'Гроза! Всё вместе' },
    ],
    skies: [['#6fa6f5', '#e8f4ff'], ['#6f9cf5', '#ffe6cf'], ['#7a8fe8', '#f9cfb0'], ['#4f5fa8', '#e7a98f'], ['#2b3456', '#5d6b8f']],
    start(W, H) {
      return base({ x: W * 0.22, y: H / 2, pw: pwOf(W), items: [], bg: makeClouds(W, H, 5, 0.05, 0.95), rain: makeRain(W, H, 50), flash: 0 });
    },
    setup(s) { s.items = []; s.spawn = 0.3; s.pspawn = 4; s.rspawn = 3; s.balspawn = 2; },
    box: s => ({ x: s.x, y: s.y, hw: s.pw * 0.4, hh: s.pw * 0.13 }),
    bonus: (s, a) => ({ x: a.W + 20, y: rnd(a.H * 0.15, a.H * 0.85), vx: -a.W * s.L.sp, vy: 0 }),
    step(s, dt, inp, a) {
      const { W, H } = a, L = s.L;
      if (inp.has) s.y += (clamp(inp.y, s.pw * 0.25, H - s.pw * 0.25) - s.y) * Math.min(1, dt * 9);
      const sp = W * L.sp;
      moveClouds(s.bg, dt, sp * 0.35, W);
      if (L.storm) { rainStep(s.rain, dt, W, H, 0.3); s.flash = Math.max(0, s.flash - dt); if (chance(dt * 0.25)) { s.flash = 0.25; sfx.thunder(); } }
      if ((s.spawn -= dt) <= 0) {
        const r = Math.random();
        const type = r < L.bird ? 'bird' : r < L.bird + 0.08 ? 'gold' : 'star';
        s.items.push({ type, x: W + 20, y: rnd(H * 0.08, H * 0.92), ph: rnd(0, TAU), r: type === 'gold' ? 15 : type === 'bird' ? 13 : 11 });
        s.spawn = 0.62 - L.sp * 0.4;
      }
      if (L.balloon && (s.balspawn -= dt) <= 0) {
        s.items.push({ type: 'balloon', x: W * rnd(0.55, 1.05), y: H + 30, r: 18, ph: rnd(0, TAU), color: pick(['#ef6461', '#22b07d', '#9b6cf0', '#ff8a3d']) });
        s.balspawn = rnd(2.5, 4);
      }
      if (L.ring && (s.rspawn -= dt) <= 0) {
        s.items.push({ type: 'ring', x: W + 30, y: rnd(H * 0.2, H * 0.8), r: 30 });
        s.rspawn = rnd(4, 6);
      }
      if (L.plane && (s.pspawn -= dt) <= 0) {
        s.items.push({ type: 'plane', x: W + 60, y: rnd(H * 0.12, H * 0.88), warn: 0.9, r: 16, img: planeImage(pick(['ssj', 'tu144', 'su27'])) });
        s.pspawn = rnd(3.5, 5.5);
      }
      const hw = s.pw * 0.4, hh = s.pw * 0.13;
      s.items.forEach(it => {
        if (it.type === 'plane') {
          if (it.warn > 0) { it.warn -= dt; return; }
          it.x -= (sp + W * 0.7) * dt;
        } else if (it.type === 'balloon') {
          it.x -= sp * 0.5 * dt; it.y -= H * 0.12 * dt;
        } else {
          it.x -= sp * (it.type === 'bird' ? 1.2 : 1) * dt;
          if (it.type === 'bird') it.y += Math.sin(s.t * 4 + it.ph) * 40 * dt;
        }
        if (it.type === 'ring') {
          if (!it.done && Math.abs(it.x - s.x) < 8) {
            it.done = true;
            if (Math.abs(it.y - s.y) < it.r * 0.75) { addScore(s, 5, it.x, it.y - 30); progress(s, 3); sfx.bonus(); burst(s, it.x, it.y, '#ffd23f', 16, 120); }
          }
          return;
        }
        const near = Math.abs(it.x - s.x) < hw + it.r * 0.6 && Math.abs(it.y - s.y) < hh + it.r * 0.6;
        if (!it.hit && near) {
          it.hit = true;
          if (it.type === 'star' || it.type === 'gold') {
            const v = it.type === 'gold' ? 3 : 1;
            addScore(s, v);
            progress(s, v);
            sfx.pick();
            burst(s, it.x, it.y, '#ffd23f', 8, 90);
            if (v > 1) say(s, it.x, it.y - 12, '+3 ⭐');
          } else hurt(s, it.x, it.y);
        }
      });
      s.items = s.items.filter(it => !(it.hit && (it.type === 'star' || it.type === 'gold')) && it.x > -60 && it.y > -60);
    },
    draw(ctx, s, a) {
      const { W, H } = a, sky = this.skies[s.level - 1];
      fillSky(ctx, W, H, [[0, sky[0]], [1, sky[1]]]);
      drawClouds(ctx, s.bg, s.L.storm ? 'rgba(120, 130, 160, .7)' : 'rgba(255, 240, 245, .8)');
      s.items.forEach(it => {
        if (it.type === 'bird') bird(ctx, it.x, it.y, it.r, s.t);
        else if (it.type === 'star' || it.type === 'gold') star(ctx, it.x, it.y, it.r, it.type === 'gold' ? '#ff9f1c' : '#ffd23f', s.t * 2);
        else if (it.type === 'balloon') {
          ctx.fillStyle = it.color; ctx.beginPath(); ctx.ellipse(it.x, it.y, 16, 20, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, .35)'; ctx.beginPath(); ctx.ellipse(it.x - 5, it.y - 7, 4, 7, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(it.x - 8, it.y + 17); ctx.lineTo(it.x - 4, it.y + 27); ctx.moveTo(it.x + 8, it.y + 17); ctx.lineTo(it.x + 4, it.y + 27); ctx.stroke();
          ctx.fillStyle = '#a0723f'; ctx.fillRect(it.x - 5, it.y + 26, 10, 7);
        } else if (it.type === 'ring') {
          ctx.strokeStyle = it.done ? 'rgba(255, 210, 63, .4)' : '#ffd23f'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.ellipse(it.x, it.y, 9, it.r, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(255, 255, 255, .7)'; ctx.lineWidth = 2; ctx.stroke();
        } else if (it.type === 'plane') {
          if (it.warn > 0) { if (Math.floor(it.warn * 8) % 2 === 0) label(ctx, '❗', W - 18, it.y, 26, '#ff4d3d'); }
          else drawSprite(ctx, it.img, it.x, it.y, s.pw * 0.9, 0, true);
        }
      });
      if (s.L.storm) { rainDraw(ctx, s.rain); if (s.flash > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${s.flash * 1.6})`; ctx.fillRect(0, 0, W, H); } }
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
    },
  },

  /* ---------- 3. Ми-8: «Посылки» ---------- */
  {
    icon: '📦',
    how: 'Грузовой самолёт сбрасывает посылки на парашютах. Води пальцем влево-вправо и лови их вертолётом — не дай упасть на землю! Берегись града, птиц и молний. Парашютистов не задевай.',
    goal: L => `Цель: поймай ${L.goal} посылок`,
    levels: [
      { goal: 8, fall: 0.13, every: 1.3, hail: 0.12, wind: 0, jumpers: 0, birds: 0, bolt: 0, news: 'Золотая посылка — 3 очка' },
      { goal: 10, fall: 0.15, every: 1.2, hail: 0.15, wind: 0.6, jumpers: 1, birds: 0, bolt: 0, news: 'Ветер! И прыгают парашютисты — не задень их' },
      { goal: 12, fall: 0.17, every: 1.1, hail: 0.18, wind: 0.8, jumpers: 1, birds: 1, bolt: 0, news: 'Птицы летают низко!' },
      { goal: 14, fall: 0.19, every: 1, hail: 0.22, wind: 0.9, jumpers: 1, birds: 1, bolt: 1, news: 'Молнии! Уходи из-под жёлтой полосы' },
      { goal: 16, fall: 0.22, every: 0.9, hail: 0.26, wind: 1, jumpers: 1, birds: 1.4, bolt: 1, news: 'Самый сильный шторм!' },
    ],
    start(W, H) {
      return base({ x: W / 2, y: H * 0.62, pw: pwOf(W) * 1.05, dir: 1, items: [], bg: makeClouds(W, H, 3, 0.18, 0.32), cargo: { x: -60, drop: 0.6 }, wind: 0, bolts: [] });
    },
    setup(s) { s.items = []; s.bolts = []; s.cargo = { x: -60, drop: 0.6 }; s.hspawn = 2; s.bspawn = 3; s.boltT = 4; s.windT = 0; s.wind = 0; },
    box: s => ({ x: s.x, y: s.y, hw: s.pw * 0.38, hh: s.pw * 0.2 }),
    bonus: (s, a) => ({ x: rnd(30, a.W - 30), y: -20, vx: 0, vy: a.H * 0.12 }),
    step(s, dt, inp, a) {
      const { W, H } = a, G = H * 0.9, L = s.L;
      if (inp.has) {
        const d = clamp(inp.x, s.pw * 0.45, W - s.pw * 0.45) - s.x;
        s.x += d * Math.min(1, dt * 8);
        if (Math.abs(d) > 3) s.dir = d > 0 ? 1 : -1;
      }
      moveClouds(s.bg, dt, 12, W);
      if (L.wind && (s.windT -= dt) <= 0) { s.wind = (chance(0.5) ? -1 : 1) * L.wind * rnd(0.6, 1); s.windT = rnd(5, 8); }
      // грузовой самолёт пролетает и сбрасывает посылки (иногда — парашютистов)
      const c = s.cargo;
      c.x += W * 0.25 * dt;
      if (c.x > W + 70) c.x = -70;
      if (c.x > 20 && c.x < W - 20 && (c.drop -= dt) <= 0) {
        const jumper = L.jumpers && chance(0.22);
        s.items.push({ kind: jumper ? 'jumper' : chance(0.12) ? 'gold' : 'box', x: c.x, y: H * 0.1 + 10, vy: H * L.fall * (jumper ? 0.8 : 1), ph: rnd(0, TAU) });
        c.drop = L.every * rnd(0.8, 1.2);
      }
      if ((s.hspawn -= dt) <= 0) { s.items.push({ kind: 'hail', x: rnd(20, W - 20), y: H * 0.25, vy: H * 0.42 }); s.hspawn = rnd(0.6, 1.4) / (L.hail * 6); }
      if (L.birds && (s.bspawn -= dt) <= 0) {
        const fromLeft = chance(0.5);
        s.items.push({ kind: 'bird', x: fromLeft ? -20 : W + 20, y: s.y + rnd(-30, 30), vx: (fromLeft ? 1 : -1) * W * 0.32, ph: rnd(0, TAU) });
        s.bspawn = rnd(2.5, 4.5) / L.birds;
      }
      if (L.bolt && (s.boltT -= dt) <= 0) { s.bolts.push({ x: rnd(30, W - 30), warn: 1, strike: 0.3 }); s.boltT = rnd(3, 5); }
      s.bolts.forEach(b => {
        if (b.warn > 0) { b.warn -= dt; if (b.warn <= 0) sfx.thunder(); return; }
        b.strike -= dt;
        if (Math.abs(b.x - s.x) < s.pw * 0.4) hurt(s, s.x, s.y);
      });
      s.bolts = s.bolts.filter(b => b.warn > 0 || b.strike > 0);
      const hw = s.pw * 0.38, hh = s.pw * 0.2;
      s.items.forEach(it => {
        if (it.kind === 'bird') { it.x += it.vx * dt; it.y += Math.sin(s.t * 4 + it.ph) * 20 * dt; }
        else if (!it.landed) {
          it.y += it.vy * dt;
          if (it.kind !== 'hail') it.x = clamp(it.x + (Math.sin(s.t * 2 + it.ph) * 14 + s.wind * W * 0.07) * dt, 12, W - 12);
        }
        const near = Math.abs(it.x - s.x) < hw && Math.abs(it.y - s.y) < hh + (it.kind === 'bird' ? 6 : 0);
        if (!it.done && !it.touched && near) {
          if (it.kind === 'box' || it.kind === 'gold') {
            it.done = true;
            addScore(s, it.kind === 'gold' ? 3 : 1);
            progress(s);
            sfx.pick();
            burst(s, it.x, it.y, it.kind === 'gold' ? '#ffd23f' : '#c28a4a', 8, 80);
            if (it.kind === 'gold') say(s, it.x, it.y - 20, '+3');
          } else if (it.kind === 'jumper') {
            it.touched = true;
            addScore(s, -2);
            say(s, it.x, it.y - 30, 'Ой! Осторожно! −2', '#ffe0e0');
            sfx.hit();
          } else { it.done = true; hurt(s, it.x, it.y); }
        }
        if (!it.done && (it.kind === 'box' || it.kind === 'gold') && it.y > G) {
          it.done = true;
          burst(s, it.x, G, '#8d6e63', 10, 70);
          say(s, it.x, G - 24, 'Упала!', '#ffe0e0');
          hurt(s, it.x, G, true);
        }
        if (it.kind === 'jumper' && it.y > G - 4 && !it.landed) { it.landed = true; it.y = G - 4; it.wait = 2; }
        if (it.landed && (it.wait -= dt) <= 0) it.done = true;
      });
      s.items = s.items.filter(it => !it.done && it.y < H + 30 && it.x > -40 && it.x < W + 40);
    },
    draw(ctx, s, a) {
      const { W, H } = a, G = H * 0.9;
      const dark = s.level >= 4;
      fillSky(ctx, W, H, dark ? [[0, '#5f6f8f'], [1, '#c9d6e6']] : [[0, '#8fd0ff'], [1, '#e9f7ff']]);
      [[0.15, 0.2], [0.5, 0.17], [0.85, 0.21]].forEach(([kx, ky]) => puff(ctx, W * kx, H * ky, 22, dark ? '#7c88a8' : '#ffffff'));
      drawClouds(ctx, s.bg, 'rgba(255, 255, 255, .6)');
      drawSprite(ctx, planeImage('an124'), s.cargo.x, H * 0.08, s.pw * 1.1);
      s.bolts.forEach(b => {
        if (b.warn > 0) warnLine(ctx, b.x, H * 0.24, b.x, G, s.t);
        else drawBolt(ctx, b.x, H * 0.22, b.x, G, 6);
      });
      ctx.fillStyle = '#9ccc72'; ctx.fillRect(0, G, W, H - G);
      for (let i = 0; i < 4; i++) {
        const hx = W * (0.12 + i * 0.26), hw = 34;
        ctx.fillStyle = '#f3e2c2'; ctx.fillRect(hx - hw / 2, G - 18, hw, 18);
        ctx.fillStyle = '#c0533a'; ctx.beginPath(); ctx.moveTo(hx - hw / 2 - 4, G - 18); ctx.lineTo(hx, G - 34); ctx.lineTo(hx + hw / 2 + 4, G - 18); ctx.fill();
        ctx.fillStyle = '#7fb6e0'; ctx.fillRect(hx - 6, G - 13, 12, 8);
      }
      s.items.forEach(it => {
        if (it.kind === 'hail') {
          ctx.fillStyle = '#cfefff'; ctx.strokeStyle = '#7fb6e0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(it.x, it.y, 8, 0, TAU); ctx.fill(); ctx.stroke();
        } else if (it.kind === 'bird') bird(ctx, it.x, it.y, 11, s.t);
        else if (it.kind === 'jumper') {
          if (!it.landed) chute(ctx, it.x, it.y - 20, 14, ['#22b07d', '#ffffff']);
          person(ctx, it.x, it.y + 6, s.t, it.landed);
        } else {
          chute(ctx, it.x, it.y - 6, 17, it.kind === 'gold' ? ['#ffd23f', '#fff'] : ['#ff8a3d', '#fff']);
          ctx.fillStyle = it.kind === 'gold' ? '#f2b80c' : '#c28a4a'; ctx.fillRect(it.x - 9, it.y - 7, 18, 14);
          ctx.fillStyle = it.kind === 'gold' ? '#fff3b0' : '#e8c48a'; ctx.fillRect(it.x - 2, it.y - 7, 4, 14);
        }
      });
      if (s.wind) label(ctx, s.wind > 0 ? 'ветер →' : '← ветер', W - 50, 52, 14);
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, s.dir < 0, blink(s));
    },
  },

  /* ---------- 4. Ка-32: «Спасатель» ---------- */
  {
    icon: '🙋',
    how: 'Половодье! Люди и животные ждут на крышах. Веди вертолёт пальцем влево-вправо и зависни над ними, пока круг не станет зелёным. Не успеешь — человек прыгнет в воду. Дальше: птицы, ветер, гроза.',
    goal: L => `Цель: спаси ${L.goal} жителей`,
    levels: [
      { goal: 4, active: 1, T: 9, pets: 0, birds: 0, wind: 0, bolt: 0, news: 'Зависни над человеком на крыше' },
      { goal: 6, active: 2, T: 8.5, pets: 1, birds: 0, wind: 0, bolt: 0, news: 'На крышах котики и собачки — тоже спасай: +5!' },
      { goal: 8, active: 2, T: 8, pets: 1, birds: 1, wind: 0, bolt: 0, news: 'Птицы! Не столкнись с ними' },
      { goal: 10, active: 3, T: 7.5, pets: 1, birds: 1, wind: 1, bolt: 0, news: 'Сильный ветер сносит вертолёт' },
      { goal: 12, active: 3, T: 7, pets: 1, birds: 1.3, wind: 1, bolt: 1, news: 'Гроза с молниями!' },
    ],
    start(W, H) {
      const roofs = [0.14, 0.38, 0.62, 0.86].map(k => ({ x: W * k, w: Math.min(64, W * 0.19), y: H * rnd(0.64, 0.7) }));
      const logs = Array.from({ length: 3 }, () => ({ x: rnd(0, W), w: rnd(26, 40) }));
      return base({ x: W / 2, y: H * 0.26, pw: pwOf(W) * 1.05, dir: 1, roofs, people: [], birds: [], bolts: [], swimmers: [], rain: makeRain(W, H, 50), waterY: H * 0.8, logs, windF: 0 });
    },
    setup(s) { s.people = []; s.birds = []; s.bolts = []; s.swimmers = []; s.spawn = 0.8; s.bspawn = 3; s.boltT = 4; s.windT = 0; s.windF = 0; },
    box: s => ({ x: s.x, y: s.y, hw: s.pw * 0.4, hh: s.pw * 0.16 }),
    bonus: (s, a) => ({ x: a.W + 20, y: s.y + rnd(-20, 20), vx: -a.W * 0.15, vy: 0 }),
    step(s, dt, inp, a) {
      const { W, H } = a, L = s.L;
      if (inp.has) {
        const d = clamp(inp.x, s.pw * 0.45, W - s.pw * 0.45) - s.x;
        s.x += d * Math.min(1, dt * 7);
        if (Math.abs(d) > 3) s.dir = d > 0 ? 1 : -1;
      }
      if (L.wind) {
        if ((s.windT -= dt) <= 0) { s.windF = (chance(0.5) ? -1 : 1) * W * rnd(0.08, 0.14); s.windT = rnd(3, 5); }
        s.x = clamp(s.x + s.windF * dt, s.pw * 0.45, W - s.pw * 0.45);
      }
      s.y = H * 0.26 + Math.sin(s.t * 2) * 4;
      s.waterY = H * 0.8 + Math.sin(s.t * 1.5) * 3;
      rainStep(s.rain, dt, W, H);
      s.logs.forEach(l => { l.x -= 18 * dt; if (l.x < -50) l.x = W + 30; });
      if ((s.spawn -= dt) <= 0 && s.people.length < L.active) {
        const free = s.roofs.map((r, i) => i).filter(i => !s.people.some(p => p.roof === i));
        if (free.length) s.people.push({ roof: pick(free), timer: L.T, max: L.T, hold: 0, pet: L.pets && chance(0.3) ? pick(['cat', 'dog']) : null });
        s.spawn = rnd(0.8, 2);
      }
      s.people.forEach(p => {
        const r = s.roofs[p.roof];
        p.timer -= dt;
        const over = Math.abs(s.x - r.x) < 26;
        p.hold = over ? p.hold + dt : Math.max(0, p.hold - dt * 2);
        if (p.hold >= 0.9) {
          p.done = true;
          addScore(s, p.pet ? 5 : 3);
          progress(s);
          sfx.pick();
          burst(s, r.x, r.y - 34, '#22b07d', 12, 90);
          say(s, r.x, r.y - 60, p.pet ? (p.pet === 'cat' ? 'Котик спасён! +5' : 'Пёсик спасён! +5') : 'Спасён! +3');
        } else if (p.timer <= 0) {
          p.done = true;
          s.swimmers.push({ x: r.x, y: r.y - 22, vy: -120, vx: 40, pet: p.pet, swim: false }); // прыгает в воду
          say(s, r.x, r.y - 60, 'Не успели…', '#ffe0e0');
          hurt(s, r.x, r.y - 34, true);
        }
      });
      s.people = s.people.filter(p => !p.done);
      s.swimmers.forEach(w => {
        if (!w.swim) {
          w.vy += 500 * dt; w.x += w.vx * dt; w.y += w.vy * dt;
          if (w.y >= s.waterY) { w.swim = true; w.y = s.waterY; burst(s, w.x, w.y, '#9fd3ff', 10, 80); sfx.splash(); }
        } else { w.x += 30 * dt; w.y = s.waterY + Math.sin(s.t * 4) * 2; }
      });
      s.swimmers = s.swimmers.filter(w => w.x < W + 30);
      if (L.birds && (s.bspawn -= dt) <= 0) {
        const fromLeft = chance(0.5);
        s.birds.push({ x: fromLeft ? -20 : W + 20, y: s.y + rnd(-25, 25), vx: (fromLeft ? 1 : -1) * W * 0.3, ph: rnd(0, TAU) });
        s.bspawn = rnd(2.5, 4.5) / L.birds;
      }
      s.birds.forEach(b => {
        b.x += b.vx * dt;
        if (!b.hit && Math.abs(b.x - s.x) < s.pw * 0.4 && Math.abs(b.y - s.y) < s.pw * 0.18) { b.hit = true; hurt(s, s.x, s.y); }
      });
      s.birds = s.birds.filter(b => b.x > -30 && b.x < W + 30);
      if (L.bolt && (s.boltT -= dt) <= 0) { s.bolts.push({ x: rnd(30, W - 30), warn: 1, strike: 0.3 }); s.boltT = rnd(3.5, 5.5); }
      s.bolts.forEach(b => {
        if (b.warn > 0) { b.warn -= dt; if (b.warn <= 0) sfx.thunder(); return; }
        b.strike -= dt;
        if (Math.abs(b.x - s.x) < s.pw * 0.4) hurt(s, s.x, s.y);
      });
      s.bolts = s.bolts.filter(b => b.warn > 0 || b.strike > 0);
    },
    draw(ctx, s, a) {
      const { W, H } = a;
      fillSky(ctx, W, H, s.level >= 5 ? [[0, '#3a4560'], [1, '#7f8ea8']] : [[0, '#56657f'], [1, '#a9b8cc']]);
      rainDraw(ctx, s.rain);
      s.bolts.forEach(b => { if (b.warn > 0) warnLine(ctx, b.x, 0, b.x, s.waterY, s.t); else drawBolt(ctx, b.x, 0, b.x, s.waterY, 6); });
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
      ctx.fillStyle = '#8a5a3c';
      s.logs.forEach(l => { rrect(ctx, l.x, s.waterY + 6, l.w, 7, 3); ctx.fill(); });
      s.swimmers.forEach(w => {
        if (w.pet) petIcon(ctx, w.x, w.y, w.pet);
        else { ctx.fillStyle = '#ffcf9e'; ctx.beginPath(); ctx.arc(w.x, w.y - 4, 5, 0, TAU); ctx.fill(); }
        if (w.swim) { ctx.strokeStyle = '#ff6b35'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w.x, w.y, 9, 0, TAU); ctx.stroke(); }
      });
      s.people.forEach(p => {
        const r = s.roofs[p.roof], px = r.x, py = r.y - 22;
        if (p.pet) petIcon(ctx, px, py - 2, p.pet); else person(ctx, px, py - 2, s.t);
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
      s.birds.forEach(b => bird(ctx, b.x, b.y, 11, s.t));
      if (s.windF) label(ctx, s.windF > 0 ? 'ветер →' : '← ветер', W / 2, 52, 14);
      drawSprite(ctx, a.img, s.x, s.y, s.pw, s.windF * 0.0008, s.dir < 0, blink(s));
    },
  },

  /* ---------- 5. Суперджет 100: «Посадка» ---------- */
  {
    icon: '🛬',
    how: 'Посади самолёт на полосу! Держишь палец — снижаешься медленнее (или набираешь высоту), отпускаешь — быстрее. Огни глиссады: 2 белых и 2 красных — правильная высота. Лети через звёзды на глиссаде. 5 аэропортов: от тихого Краснодара до туманного Владивостока.',
    goal: L => `${L.name}: посади самолёт ${L.goal} ${plural(L.goal, 'раз', 'раза', 'раз')}`,
    levels: [
      { goal: 2, name: 'Краснодар', rwL: 1.2, gust: 0, birds: 0, night: 0, snow: 0, fog: 0, mountains: 0, news: 'Тихая погода. Звёзды показывают глиссаду' },
      { goal: 3, name: 'Сочи', rwL: 1, gust: 12, birds: 0, night: 0, snow: 0, fog: 0, mountains: 1, news: 'Горы и полоса короче' },
      { goal: 3, name: 'Москва', rwL: 1, gust: 20, birds: 1, night: 0, snow: 0, fog: 0, mountains: 0, news: 'Порывы ветра и стаи птиц' },
      { goal: 3, name: 'Мурманск', rwL: 0.95, gust: 24, birds: 1, night: 1, snow: 1, fog: 0, mountains: 0, news: 'Полярная ночь и снег' },
      { goal: 3, name: 'Владивосток', rwL: 0.85, gust: 28, birds: 1, night: 0, snow: 0, fog: 1, mountains: 1, news: 'Туман! Полосу видно только вблизи' },
    ],
    start(W, H) {
      return base({ pw: pwOf(W) * 1.15, flakes: makeRain(W, H, 60) });
    },
    setup(s, a) { this.next(s, a.W, a.H); },
    next(s, W, H) {
      const rw = 950 + rnd(0, 200), G = H * 0.8, y0 = H * 0.22, wheel = s.pw * 0.17;
      const ideal = d => y0 + (G - wheel - y0) * clamp(d / (rw + 40), 0, 1);
      const stars = [];
      for (let d = 220; d < rw - 60; d += 160) stars.push({ d, y: ideal(d), got: false });
      const birds = s.L.birds ? [{ d: rnd(450, rw - 250), y: rnd(H * 0.3, H * 0.6), hit: false }] : [];
      Object.assign(s, { x: W * 0.3, y: y0, vy: 0, dist: 0, phase: 'fly', roll: 0, rw, rwL: Math.max(320, W * s.L.rwL), sp: 125, gust: 1.5, msg: '', goAround: false, landed: false, y0, ideal, stars, birds });
    },
    box: s => ({ x: s.x, y: s.y, hw: s.pw * 0.4, hh: s.pw * 0.12 }),
    bonus: (s, a) => (s.phase === 'fly' && s.dist < s.rw - 500 ? { x: a.W + 20, y: s.ideal(s.dist + a.W + 20 - s.x), vx: -s.sp, vy: 0, still: true } : null),
    step(s, dt, inp, a) {
      const { W, H } = a, G = H * 0.8, wheel = s.pw * 0.17, L = s.L;
      if (L.snow) s.flakes.forEach(f => { f.y += f.v * 0.15 * dt; f.x -= 60 * dt; if (f.y > H) f.y = -5; if (f.x < 0) f.x += W; });
      if (s.phase === 'fly') {
        s.vy += (inp.down ? -80 : 45) * dt;
        if (L.gust && (s.gust -= dt) <= 0) { s.vy += rnd(-L.gust, L.gust); s.gust = rnd(1.2, 2.5); }
        s.vy = clamp(s.vy, -55, 75);
        s.y += s.vy * dt;
        s.dist += s.sp * dt;
        if (s.y < H * 0.08) { s.y = H * 0.08; s.vy = Math.max(0, s.vy); }
        s.stars.forEach(st => {
          const sx = s.x + (st.d - s.dist);
          if (!st.got && Math.abs(sx - s.x) < s.pw * 0.3 && Math.abs(st.y - s.y) < 18) { st.got = true; addScore(s, 2, sx, st.y - 16); sfx.pick(); }
        });
        s.birds.forEach(b => {
          b.d -= 30 * dt;
          const bx = s.x + (b.d - s.dist);
          if (!b.hit && s.phase === 'fly' && Math.abs(bx - s.x) < s.pw * 0.4 && Math.abs(b.y - s.y) < 20) {
            b.hit = true;
            s.msg = 'Птицы! Уход на второй круг';
            s.phase = 'roll'; s.roll = 1.8; s.goAround = true;
            hurt(s, s.x, s.y, true);
          }
        });
        if (s.phase === 'fly' && s.y + wheel >= G) {
          s.y = G - wheel;
          const onRw = s.dist >= s.rw && s.dist <= s.rw + s.rwL;
          let pts = 0, msg;
          if (!onRw) msg = s.dist < s.rw ? 'Мимо полосы!' : 'Полоса закончилась!';
          else if (s.vy < 25) { pts = 30; msg = 'Мягкая посадка! ⭐⭐⭐'; }
          else if (s.vy < 40) { pts = 20; msg = 'Хорошая посадка! ⭐⭐'; }
          else if (s.vy < 56) { pts = 10; msg = 'Жестковато… ⭐'; }
          else msg = 'Жёсткая посадка!';
          if (pts && s.dist < s.rw + s.rwL * 0.35) { pts += 5; msg += ' +5'; }
          s.msg = msg;
          s.phase = 'roll'; s.roll = 2.2; s.vy = 0;
          burst(s, s.x - s.pw * 0.1, G, '#d5dae1', 12, 60);
          if (pts) { addScore(s, pts); sfx.pick(); s.landed = true; } else hurt(s, s.x, s.y, true);
        } else if (s.phase === 'fly' && s.dist > s.rw + s.rwL) {
          s.msg = 'Уход на второй круг';
          s.phase = 'roll'; s.roll = 1.8; s.goAround = true;
          hurt(s, s.x, s.y, true);
        }
      } else {
        s.roll -= dt;
        if (s.goAround) { s.y -= 60 * dt; s.dist += s.sp * dt; }
        else { s.sp = Math.max(0, s.sp - 70 * dt); s.dist += s.sp * dt; }
        if (s.roll <= 0) {
          const ok = s.landed;
          this.next(s, W, H);
          if (ok) progress(s);
        }
      }
    },
    draw(ctx, s, a) {
      const { W, H } = a, G = H * 0.8, L = s.L;
      fillSky(ctx, W, H, L.night ? [[0, '#0d1838'], [1, '#2d3f6b']] : [[0, '#79b8f2'], [1, '#e8f4ff']]);
      if (L.night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 97) % W, (i * 53) % (G * 0.7), 1.5, 1.5); }
      if (L.mountains) {
        ctx.fillStyle = L.night ? '#22304f' : '#9fb3c9';
        ctx.beginPath(); ctx.moveTo(0, G);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, G - 60 - Math.abs(Math.sin((x + s.dist * 0.08) * 0.013)) * 70);
        ctx.lineTo(W, G); ctx.fill();
      }
      ctx.fillStyle = L.night ? '#2c4a33' : L.snow ? '#e8eef5' : '#a9c6a0';
      ctx.beginPath(); ctx.moveTo(0, G);
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, G - 22 - Math.sin((x + s.dist * 0.15) * 0.02) * 12);
      ctx.lineTo(W, G); ctx.fill();
      ctx.fillStyle = L.night ? '#1f3a26' : L.snow ? '#dfe7f0' : '#7fae5e'; ctx.fillRect(0, G, W, H - G);
      const rx = s.x + (s.rw - s.dist);
      ctx.fillStyle = '#5b6170'; ctx.fillRect(rx, G - 2, s.rwL, 9);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) ctx.fillRect(rx + 4 + i * 6, G, 3, 5);
      for (let x = rx + 40; x < rx + s.rwL - 10; x += 34) ctx.fillRect(x, G + 1.5, 16, 2);
      if (L.night) { ctx.fillStyle = '#ffe38a'; for (let x = rx; x < rx + s.rwL; x += 18) { ctx.beginPath(); ctx.arc(x, G - 3, 2, 0, TAU); ctx.fill(); } }
      for (let i = 1; i <= 5; i++) {
        const lx = rx - i * 22;
        ctx.fillStyle = '#9aa3ad'; ctx.fillRect(lx - 1, G - 8, 2, 8);
        ctx.fillStyle = i % 2 ? '#fff6c2' : '#ff6b5b'; ctx.beginPath(); ctx.arc(lx, G - 9, 2.5, 0, TAU); ctx.fill();
      }
      s.stars.forEach(st => { if (!st.got) star(ctx, s.x + (st.d - s.dist), st.y, 9, '#ffd23f', s.t * 2); });
      s.birds.forEach(b => { if (!b.hit) { const bx = s.x + (b.d - s.dist); bird(ctx, bx - 8, b.y - 6, 8, s.t); bird(ctx, bx + 8, b.y, 8, s.t + 1); bird(ctx, bx, b.y + 8, 8, s.t + 2); } });
      if (L.snow) { ctx.fillStyle = '#fff'; s.flakes.forEach(f => { ctx.beginPath(); ctx.arc(f.x, f.y, 1.8, 0, TAU); ctx.fill(); }); }
      if (L.fog) {
        const fg = ctx.createLinearGradient(s.x + 60, 0, W, 0);
        fg.addColorStop(0, 'rgba(235, 240, 245, 0)'); fg.addColorStop(0.45, 'rgba(235, 240, 245, .95)'); fg.addColorStop(1, 'rgba(235, 240, 245, 1)');
        ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
      }
      if (s.phase === 'fly') { // огни глиссады (ПАПИ)
        const whites = clamp(Math.round(2 - (s.y - s.ideal(s.dist)) / (H * 0.035)), 0, 4);
        ctx.fillStyle = 'rgba(20, 30, 60, .55)';
        rrect(ctx, W - 108, 40, 100, 26, 8); ctx.fill();
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i < whites ? '#ffffff' : '#ff4d3d';
          ctx.beginPath(); ctx.arc(W - 93 + i * 23, 53, 6.5, 0, TAU); ctx.fill();
        }
      }
      const ang = s.phase === 'fly' ? (a.inp.down ? -0.1 : clamp(s.vy / 500, -0.05, 0.1)) : s.goAround ? -0.15 : 0;
      drawSprite(ctx, a.img, s.x, s.y, s.pw, ang, false, blink(s));
      if (s.phase === 'roll') label(ctx, s.msg, W / 2, H * 0.6, s.msg.length > 22 ? 16 : 20);
    },
  },

  /* ---------- 6. Бе-200: «Пожар» ---------- */
  {
    icon: '🔥',
    how: 'Лес горит! Нажимай — самолёт сбрасывает воду. Сбрасывай чуть заранее. Вода кончилась — пролети над озером. Из леса выбегают зайцы: потуши огонь рядом с ними — и они спасены. Дальше: ветер, огонь перекидывается, молнии.',
    goal: L => `Цель: потуши ${L.goal} пожаров`,
    levels: [
      { goal: 5, sp: 0.27, every: 1.9, wind: 0, hares: 0, spread: 0, bolt: 0, news: 'Бак — 4 сброса. Над озером наполняется' },
      { goal: 7, sp: 0.29, every: 1.7, wind: 0, hares: 1, spread: 0, bolt: 0, news: 'Из леса выбегают зайцы — спаси их: +3!' },
      { goal: 9, sp: 0.31, every: 1.5, wind: 1, hares: 1, spread: 0, bolt: 0, news: 'Ветер сносит воду — смотри на надпись' },
      { goal: 11, sp: 0.33, every: 1.35, wind: 1, hares: 1, spread: 1, bolt: 0, news: 'Огонь растёт и перекидывается!' },
      { goal: 13, sp: 0.35, every: 1.2, wind: 1, hares: 1, spread: 1, bolt: 1, news: 'Молнии поджигают лес!' },
    ],
    start(W, H) {
      const trees = Array.from({ length: 12 }, (_, i) => ({ x: i * (W / 10) + rnd(0, 14), h: rnd(16, 26) }));
      return base({ x: W * 0.3, y: H * 0.3, pw: pwOf(W) * 1.1, tank: 4, drops: [], fires: [], lakes: [], hares: [], trees, wind: 0 });
    },
    setup(s) { s.drops = []; s.fires = []; s.lakes = []; s.hares = []; s.tank = 4; s.fspawn = 1; s.lspawn = 4; s.windT = 0; s.wind = 0; s.boltT = 5; s.flash = 0; s.strike = null; },
    box: s => ({ x: s.x, y: s.y, hw: s.pw * 0.4, hh: s.pw * 0.14 }),
    bonus: (s, a) => ({ x: a.W + 20, y: s.y + rnd(-15, 15), vx: -a.W * s.L.sp, vy: 0 }),
    newFire(s, x, size = 0.6) {
      const f = { x, size, alive: true, spread: false };
      s.fires.push(f);
      if (s.L.hares && chance(0.55)) s.hares.push({ fire: f, x: x + rnd(-10, 10), hop: rnd(0, TAU), out: false, saved: false });
    },
    step(s, dt, inp, a) {
      const { W, H } = a, G = H * 0.82, L = s.L;
      const sp = W * L.sp;
      s.y = H * 0.3 + Math.sin(s.t * 1.6) * 5;
      s.flash = Math.max(0, s.flash - dt);
      if (L.wind && (s.windT -= dt) <= 0) { s.wind = (chance(0.5) ? -1 : 1) * rnd(0.5, 1); s.windT = rnd(5, 8); }
      s.trees.forEach(t => { t.x -= sp * dt; if (t.x < -20) { t.x += W * 1.2; t.h = rnd(16, 26); } });
      if ((s.lspawn -= dt) <= 0) { s.lakes.push({ x: W + 10, w: 130 }); s.lspawn = rnd(6, 8); }
      if ((s.fspawn -= dt) <= 0) {
        const x = W + 20;
        if (!s.lakes.some(l => x > l.x - 30 && x < l.x + l.w + 30)) this.newFire(s, x);
        s.fspawn = L.every * rnd(0.8, 1.2);
      }
      if (L.bolt && (s.boltT -= dt) <= 0) {
        const x = W * rnd(0.6, 0.95);
        if (!s.lakes.some(l => x > l.x - 20 && x < l.x + l.w + 20)) { s.strike = { x, t: 0.3 }; s.flash = 0.2; sfx.thunder(); this.newFire(s, x, 0.8); }
        s.boltT = rnd(4, 6);
      }
      if (s.strike) { s.strike.x -= sp * dt; if ((s.strike.t -= dt) <= 0) s.strike = null; }
      s.lakes.forEach(l => { l.x -= sp * dt; });
      s.lakes = s.lakes.filter(l => l.x + l.w > -10);
      if (s.tank < 4 && s.lakes.some(l => s.x > l.x && s.x < l.x + l.w)) { s.tank = 4; sfx.splash(); say(s, s.x, s.y + 40, 'Бак полон! 💧'); }
      inp.taps.forEach(() => {
        if (s.tank > 0) {
          s.tank--;
          s.drops.push({ x: s.x - s.pw * 0.05, y: s.y + s.pw * 0.15, vx: -sp * 0.25, vy: 40 });
          sfx.splash();
        } else if (!(s.emptyAt > s.t - 1.3)) { s.emptyAt = s.t; say(s, s.x + 20, s.y + 44, 'Бак пуст! Лети к озеру', '#ffe0e0'); }
      });
      s.drops.forEach(d => {
        d.vy += 520 * dt; d.vx += s.wind * W * 0.12 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        if (chance(0.6)) s.parts.push({ x: d.x + rnd(-4, 4), y: d.y - 6, vx: 0, vy: -20, life: 0.25, max: 0.25, color: '#9fd3ff', size: 2.5 });
        if (d.y >= G - 6) {
          d.done = true;
          burst(s, d.x, G - 4, '#7fc4ff', 10, 90);
          s.fires.forEach(f => {
            if (f.alive && Math.abs(f.x - d.x) < 28 + 10 * f.size) {
              f.alive = false;
              addScore(s, 1);
              progress(s);
              sfx.pick();
              burst(s, f.x, G - 16, '#c9cdd4', 14, 70);
              say(s, f.x, G - 50, 'Потушил!');
              s.hares.forEach(h => { if (h.fire === f && !h.saved) { h.saved = true; addScore(s, 3); say(s, h.x, G - 74, 'Зайчик спасён! +3', '#fff6c2'); } });
            }
          });
        }
      });
      s.drops = s.drops.filter(d => !d.done);
      s.fires.forEach(f => {
        f.x -= sp * dt;
        f.size = Math.min(L.spread ? 1.8 : 1.6, f.size + dt * (L.spread ? 0.2 : 0.12));
        if (L.spread && f.alive && !f.spread && f.size > 1.3 && f.x < W - 40) { f.spread = true; this.newFire(s, f.x + 46); }
        if (f.alive && f.x < -10) { f.alive = false; say(s, 60, G - 50, 'Лес горит!', '#ffe0e0'); hurt(s, 20, G - 20, true); }
      });
      s.fires = s.fires.filter(f => f.x > -40);
      s.hares.forEach(h => {
        h.hop += dt * 10;
        h.x -= (sp + (h.saved ? 20 : 45)) * dt;
        if (!h.out && h.fire.x < W - 10) h.out = true;
      });
      s.hares = s.hares.filter(h => h.x > -20);
    },
    draw(ctx, s, a) {
      const { W, H } = a, G = H * 0.82;
      fillSky(ctx, W, H, s.level >= 5 ? [[0, '#4c5d7a'], [0.7, '#d8a87a'], [1, '#d48b5a']] : [[0, '#87a9cf'], [0.7, '#f3cf9e'], [1, '#f0b37a']]);
      if (s.flash > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${s.flash * 2})`; ctx.fillRect(0, 0, W, H); }
      if (s.strike) drawBolt(ctx, s.strike.x, 0, s.strike.x, G - 10, 6);
      ctx.fillStyle = '#4f7a3a'; ctx.fillRect(0, G, W, H - G);
      s.lakes.forEach(l => { ctx.fillStyle = '#4f9bd9'; ctx.beginPath(); ctx.ellipse(l.x + l.w / 2, G + 4, l.w / 2, 9, 0, 0, TAU); ctx.fill(); });
      s.trees.forEach(t => {
        if (s.lakes.some(l => t.x > l.x - 6 && t.x < l.x + l.w + 6)) return;
        ctx.fillStyle = '#2f5d2a';
        ctx.beginPath(); ctx.moveTo(t.x - 9, G); ctx.lineTo(t.x, G - t.h); ctx.lineTo(t.x + 9, G); ctx.fill();
      });
      s.fires.forEach(f => {
        if (!f.alive) { ctx.fillStyle = 'rgba(120, 120, 130, .35)'; ctx.beginPath(); ctx.arc(f.x, G - 30, 12, 0, TAU); ctx.fill(); return; }
        const k = f.size;
        ctx.fillStyle = 'rgba(90, 90, 100, .3)'; ctx.beginPath(); ctx.arc(f.x + 6, G - 50 * k, 14 * k, 0, TAU); ctx.fill();
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
      s.hares.forEach(h => { if (h.out) hare(ctx, h.x, G - 2 - Math.abs(Math.sin(h.hop)) * 10); });
      s.drops.forEach(d => { ctx.fillStyle = '#3d8fe0'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 6, 9, 0, 0, TAU); ctx.fill(); });
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
      for (let i = 0; i < 4; i++) {
        const x = W - 18 - (3 - i) * 20, y = 52;
        ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.quadraticCurveTo(x + 8, y + 1, x, y + 7); ctx.quadraticCurveTo(x - 8, y + 1, x, y - 9);
        ctx.fillStyle = i < s.tank ? '#3d8fe0' : 'rgba(255, 255, 255, .35)'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      if (s.wind) label(ctx, s.wind > 0 ? 'ветер →' : '← ветер', 46, 52, 14);
    },
  },

  /* ---------- 7. Су-27: «Воздушный бой» ---------- */
  {
    icon: '💥',
    how: 'Води пальцем вверх и вниз — пушка стреляет сама. Сбивай дроны и злые тучки (из них выскакивают тучки-малыши). Лови 🔥 — двойная пушка. На 5-м уровне — Босс, Король Бурь!',
    goal: L => (L.boss ? 'Цель: победи Короля Бурь (30 попаданий)' : `Цель: сбей ${L.goal} врагов`),
    extraBonus: ['gun', 'gun'],
    levels: [
      { goal: 8, every: 1.2, big: 0.1, zig: 0, kami: 0, boss: 0, news: 'Сбивай дроны-хулиганы' },
      { goal: 12, every: 1.05, big: 0.2, zig: 0, kami: 0, boss: 0, news: 'Злые тучки: 3 попадания, внутри тучки-малыши!' },
      { goal: 15, every: 0.95, big: 0.22, zig: 1, kami: 0, boss: 0, news: 'Быстрые дроны летят зигзагом' },
      { goal: 18, every: 0.85, big: 0.25, zig: 1, kami: 1, boss: 0, news: 'Дроны-камикадзе летят прямо на тебя!' },
      { goal: 1, every: 1.8, big: 0, zig: 1, kami: 0, boss: 1, news: 'Босс! Уворачивайся от его молний' },
    ],
    start(W, H) {
      return base({ x: W * 0.2, y: H / 2, pw: pwOf(W), bullets: [], foes: [], bolts: [], bg: makeClouds(W, H, 5, 0.05, 0.95), boss: null });
    },
    setup(s, a) {
      s.bullets = []; s.foes = []; s.bolts = []; s.fire = 0.3; s.spawn = 0.8;
      s.boss = s.L.boss ? { x: a.W + 90, y: a.H / 2, hp: 30, max: 30, shoot: 2, flash: 0 } : null;
    },
    box: s => ({ x: s.x, y: s.y, hw: s.pw * 0.4, hh: s.pw * 0.13 }),
    bonus: (s, a) => ({ x: a.W + 20, y: rnd(a.H * 0.15, a.H * 0.85), vx: -a.W * 0.22, vy: 0 }),
    kill(s, f, a) {
      f.dead = true;
      addScore(s, f.big ? 3 : 1);
      if (!f.baby) progress(s);
      sfx.boom();
      burst(s, f.x, f.y, f.big || f.baby ? '#8b97b8' : '#ff8a3d', 18, 150);
      if (f.big) { // выскакивают тучки-малыши
        [-1, 1].forEach(d => s.foes.push({ baby: true, x: f.x, y: f.y, r: 11, hp: 1, vx: -a.W * 0.35, vy: d * a.H * 0.25, ph: 0 }));
        say(s, f.x, f.y - 26, '+3');
      }
    },
    step(s, dt, inp, a) {
      const { W, H } = a, L = s.L;
      if (inp.has) s.y += (clamp(inp.y, s.pw * 0.25, H - s.pw * 0.25) - s.y) * Math.min(1, dt * 9);
      const sp = W * 0.32;
      moveClouds(s.bg, dt, sp * 1.4, W);
      if ((s.fire -= dt) <= 0) {
        if (s.gun > 0) s.bullets.push({ x: s.x + s.pw * 0.45, y: s.y - 6 }, { x: s.x + s.pw * 0.45, y: s.y + 8 });
        else s.bullets.push({ x: s.x + s.pw * 0.45, y: s.y + s.pw * 0.02 });
        s.fire = 0.22;
        sfx.shoot();
      }
      s.bullets.forEach(b => { b.x += W * 1.5 * dt; });
      if ((s.spawn -= dt) <= 0) {
        const r = Math.random();
        const type = r < L.big ? 'big' : L.kami && r < L.big + 0.2 ? 'kami' : L.zig && r < L.big + 0.45 ? 'zig' : 'drone';
        const big = type === 'big';
        s.foes.push({ type, big, x: W + 30, y: rnd(H * 0.1, H * 0.9), hp: big ? 3 : 1, r: big ? 24 : 15, ph: rnd(0, TAU), shoot: rnd(1, 2) });
        s.spawn = L.every * rnd(0.8, 1.2);
      }
      const b = s.boss;
      if (b) {
        b.x += (W * 0.78 - b.x) * Math.min(1, dt * 1.2);
        b.y = H * 0.5 + Math.sin(s.lt * 0.9) * H * 0.3;
        b.flash = Math.max(0, b.flash - dt);
        if ((b.shoot -= dt) <= 0) {
          [-0.25, 0, 0.25].forEach(k => s.bolts.push({ x: b.x - 40, y: b.y, vx: -W * 0.5, vy: (s.y - b.y) * 0.3 + k * H * 0.5 }));
          b.shoot = rnd(1.6, 2.2);
        }
      }
      s.foes.forEach(f => {
        if (f.baby) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy *= 1 - dt * 1.2; }
        else if (f.type === 'kami') { f.x -= W * 0.42 * dt; f.y += clamp(s.y - f.y, -1, 1) * H * 0.18 * dt; }
        else if (f.type === 'zig') { f.x -= W * 0.45 * dt; f.y += Math.cos(s.t * 6 + f.ph) * H * 0.35 * dt; }
        else { f.x -= sp * (f.big ? 0.7 : 1) * dt; f.y += Math.sin(s.t * 2 + f.ph) * 30 * dt; }
        f.y = clamp(f.y, 14, H - 14);
        if (f.big && f.x < W - 20 && (f.shoot -= dt) <= 0) { s.bolts.push({ x: f.x - f.r, y: f.y, vx: -W * 0.55, vy: (s.y - f.y) * 0.4 }); f.shoot = rnd(1.6, 2.8); }
        s.bullets.forEach(bu => {
          if (!bu.done && !f.dead && Math.hypot(bu.x - f.x, bu.y - f.y) < f.r) {
            bu.done = true; f.hp--;
            burst(s, bu.x, bu.y, '#ffd23f', 4, 60);
            if (f.hp <= 0) this.kill(s, f, a);
          }
        });
        if (!f.dead && Math.abs(f.x - s.x) < s.pw * 0.4 + f.r * 0.6 && Math.abs(f.y - s.y) < s.pw * 0.13 + f.r * 0.6) { f.dead = true; hurt(s, s.x, s.y); }
      });
      if (b) {
        s.bullets.forEach(bu => {
          if (!bu.done && s.boss && Math.abs(bu.x - b.x) < 55 && Math.abs(bu.y - b.y) < 45) {
            bu.done = true; b.hp--; b.flash = 0.12;
            burst(s, bu.x, bu.y, '#ffd23f', 4, 60);
            if (b.hp <= 0) {
              burst(s, b.x, b.y, '#8b97b8', 40, 220); burst(s, b.x, b.y, '#ffd23f', 30, 180);
              sfx.boom(); addScore(s, 50, b.x, b.y - 40); s.boss = null; progress(s);
            }
          }
        });
      }
      s.bolts.forEach(bo => {
        bo.x += bo.vx * dt; bo.y += bo.vy * dt;
        if (Math.abs(bo.x - s.x) < s.pw * 0.38 && Math.abs(bo.y - s.y) < s.pw * 0.14 + 4) { bo.done = true; hurt(s, s.x, s.y); }
      });
      s.bullets = s.bullets.filter(bu => !bu.done && bu.x < W + 20);
      s.foes = s.foes.filter(f => !f.dead && f.x > -40 && f.x < W + 60);
      s.bolts = s.bolts.filter(bo => !bo.done && bo.x > -20 && bo.y > -20 && bo.y < H + 20);
    },
    draw(ctx, s, a) {
      const { W, H } = a;
      fillSky(ctx, W, H, s.level >= 5 ? [[0, '#2a3768'], [1, '#7c8fc0']] : [[0, '#3d7bd6'], [1, '#a8d4ff']]);
      drawClouds(ctx, s.bg, 'rgba(255, 255, 255, .7)');
      ctx.fillStyle = '#ffd23f';
      s.bullets.forEach(bu => ctx.fillRect(bu.x - 6, bu.y - 1.5, 12, 3));
      s.foes.forEach(f => {
        if (f.big || f.baby) {
          puff(ctx, f.x - f.r * 0.7, f.y, f.r * 0.7, f.baby ? '#a3aecb' : '#7c88a8');
          angryFace(ctx, f.x - 1, f.y - 2, f.baby ? 0.6 : 1);
          if (f.big) { ctx.fillStyle = '#ef6461'; for (let i = 0; i < f.hp; i++) ctx.fillRect(f.x - 12 + i * 9, f.y + f.r * 0.8, 7, 4); }
        } else {
          ctx.fillStyle = f.type === 'kami' ? '#7a2a2a' : f.type === 'zig' ? '#3d5a80' : '#4a515c';
          ctx.fillRect(f.x - 12, f.y - 3, 24, 6);
          ctx.fillStyle = f.type === 'kami' ? '#b33a3a' : '#6b7381';
          ctx.beginPath(); ctx.ellipse(f.x, f.y, 9, 6, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(40, 45, 55, .55)';
          const bl = 9 * Math.abs(Math.sin(s.t * 30));
          ctx.fillRect(f.x - 12 - bl, f.y - 7, bl * 2, 2); ctx.fillRect(f.x + 12 - bl, f.y - 7, bl * 2, 2);
          ctx.fillStyle = '#ff4d3d'; ctx.beginPath(); ctx.arc(f.x - 5, f.y, 2.5, 0, TAU); ctx.fill();
        }
      });
      const b = s.boss;
      if (b) {
        ctx.save();
        if (b.flash > 0) ctx.globalAlpha = 0.6;
        puff(ctx, b.x - 50, b.y, 46, '#5d6788');
        angryFace(ctx, b.x - 6, b.y - 4, 2.2);
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(b.x - 40, b.y - 50); ctx.lineTo(b.x - 30, b.y - 74); ctx.lineTo(b.x - 14, b.y - 58); ctx.lineTo(b.x, b.y - 80); ctx.lineTo(b.x + 14, b.y - 58); ctx.lineTo(b.x + 28, b.y - 74); ctx.lineTo(b.x + 36, b.y - 50); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(20, 30, 60, .55)'; rrect(ctx, W * 0.2, 42, W * 0.6, 12, 6); ctx.fill();
        ctx.fillStyle = '#ef6461'; rrect(ctx, W * 0.2 + 2, 44, Math.max(0, (W * 0.6 - 4) * b.hp / b.max), 8, 4); ctx.fill();
      }
      s.bolts.forEach(bo => drawBolt(ctx, bo.x + 10, bo.y - 6, bo.x - 6, bo.y + 6, 3));
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
      if (s.gun > 0) label(ctx, '🔥', s.x - s.pw * 0.55, s.y, 14);
    },
  },

  /* ---------- 8. Ан-124: «Точный сброс» ---------- */
  {
    icon: '🎯',
    how: 'Нажми, когда «Руслан» пролетает, — он сбросит груз на парашюте. Попади на плот: в центр — 10 очков! Мимо — минус жизнь. Смотри на ветер. Дальше: дельфины, чайки толкают парашют, шторм. Попадёшь грузом в спасательный круг с бонусом — он твой!',
    goal: L => `Цель: попади на плот ${L.goal} ${plural(L.goal, 'раз', 'раза', 'раз')}`,
    levels: [
      { goal: 3, raft: 0.06, w: 1, wind: 0, dolphins: 0, gulls: 0, storm: 0, news: 'Тихая погода — целься в центр' },
      { goal: 4, raft: 0.08, w: 1, wind: 0.6, dolphins: 1, gulls: 0, storm: 0, news: 'Подул ветер. Из воды выпрыгивают дельфины!' },
      { goal: 5, raft: 0.1, w: 0.95, wind: 0.9, dolphins: 1, gulls: 1, storm: 0, news: 'Чайки толкают парашют!' },
      { goal: 5, raft: 0.12, w: 0.8, wind: 1.1, dolphins: 1, gulls: 1, storm: 0, news: 'Плот стал меньше и быстрее' },
      { goal: 6, raft: 0.14, w: 0.75, wind: 1.3, dolphins: 1, gulls: 1, storm: 1, news: 'Шторм: ветер меняется прямо в полёте!' },
    ],
    start(W, H) {
      return base({ pw: pwOf(W) * 1.25, plane: null, box: null, wind: 0, raft: { x: W * 0.6, dir: 1, w: Math.min(110, W * 0.3) }, gulls: [], dolphins: [], rain: makeRain(W, H, 50) });
    },
    setup(s, a) {
      s.plane = null; s.box = null; s.delay = 0.4; s.gulls = []; s.dolphins = []; s.gspawn = 2; s.dspawn = 2;
      s.raft.w = Math.min(110, a.W * 0.3) * s.L.w;
    },
    bonus: (s, a) => { const left = chance(0.5); return { x: left ? -20 : a.W + 20, y: a.H * 0.78 - 4, vx: (left ? 1 : -1) * a.W * 0.07, vy: 0, still: true, buoy: true }; },
    step(s, dt, inp, a) {
      const { W, H } = a, sea = H * 0.78, r = s.raft, L = s.L;
      if (L.storm) rainStep(s.rain, dt, W, H, 0.35);
      r.x += r.dir * W * L.raft * dt;
      if (r.x > W - r.w / 2 - 10) r.dir = -1;
      if (r.x < r.w / 2 + 10) r.dir = 1;
      if (!s.plane && !s.box && (s.delay -= dt) <= 0) {
        s.plane = { x: -s.pw, y: H * 0.19, dropped: false };
        s.wind = L.wind ? Math.round(rnd(-1, 1) * L.wind * 10) / 10 : 0;
      }
      if (s.plane) {
        const p = s.plane;
        p.x += W * 0.3 * dt;
        if (inp.taps.length && !p.dropped && p.x > 0 && p.x < W) {
          p.dropped = true;
          s.box = { x: p.x, y: p.y + 14, vx: W * 0.15, vy: 0, t: 0, open: false };
          sfx.flap();
        }
        if (p.x > W + s.pw) { s.plane = null; s.delay = 0.6; }
      }
      if (L.gulls && (s.gspawn -= dt) <= 0) {
        const fromLeft = chance(0.5);
        s.gulls.push({ x: fromLeft ? -20 : W + 20, y: rnd(H * 0.35, H * 0.6), vx: (fromLeft ? 1 : -1) * W * 0.22, ph: rnd(0, TAU) });
        s.gspawn = rnd(2, 3.5);
      }
      s.gulls.forEach(g => { g.x += g.vx * dt; g.y += Math.sin(s.t * 3 + g.ph) * 15 * dt; });
      s.gulls = s.gulls.filter(g => g.x > -40 && g.x < W + 40);
      if (L.dolphins && (s.dspawn -= dt) <= 0) {
        s.dolphins.push({ x: rnd(W * 0.1, W * 0.9), t: 0, dir: chance(0.5) ? 1 : -1 });
        s.dspawn = rnd(2, 4);
      }
      s.dolphins.forEach(d => { d.t += dt; });
      s.dolphins = s.dolphins.filter(d => d.t < 1.4);
      const b = s.box;
      if (b) {
        b.t += dt;
        if (L.storm && b.open && chance(dt * 0.8)) { s.wind = Math.round(rnd(-1, 1) * L.wind * 10) / 10; say(s, W / 2, 96, 'Ветер сменился!', '#fff6c2'); }
        if (b.t > 0.35) {
          b.open = true;
          b.vx += (s.wind * W * 0.09 - b.vx) * Math.min(1, dt * 1.8);
          b.vy += (H * 0.11 - b.vy) * Math.min(1, dt * 3);
        } else { b.vy += 420 * dt; b.vx *= 1 - dt * 0.5; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        s.gulls.forEach(g => {
          if (!g.hit && b.open && Math.abs(g.x - b.x) < 24 && Math.abs(g.y - (b.y - 26)) < 22) {
            g.hit = true; b.vx += Math.sign(g.vx) * W * 0.25; say(s, b.x, b.y - 50, 'Ка-ка!', '#fff'); sfx.flap();
          }
        });
        if (b.y >= sea - 12) {
          s.bonuses.forEach(bo => { if (Math.abs(bo.x - b.x) < 26) grabBonus(s, bo); });
          const d = Math.abs(b.x - r.x);
          const pts = d < r.w * 0.12 ? 10 : d < r.w * 0.3 ? 5 : d < r.w * 0.5 ? 2 : 0;
          if (pts) {
            addScore(s, pts);
            say(s, b.x, sea - 40, pts === 10 ? 'В яблочко! +10' : '+' + pts);
            sfx.pick(); burst(s, b.x, sea - 12, '#ffd23f', 12, 90);
            progress(s);
          } else {
            say(s, b.x, sea - 40, 'Мимо!', '#ffe0e0');
            sfx.splash(); burst(s, b.x, sea, '#7fc4ff', 14, 90);
            hurt(s, b.x, sea, true);
          }
          s.box = null;
        }
      }
    },
    draw(ctx, s, a) {
      const { W, H } = a, sea = H * 0.78, r = s.raft, L = s.L;
      fillSky(ctx, W, H, L.storm ? [[0, '#4a5878'], [1, '#a9b8cc']] : [[0, '#7cc3f5'], [1, '#e6f6ff']]);
      if (L.storm) rainDraw(ctx, s.rain);
      const g = ctx.createLinearGradient(0, sea, 0, H);
      g.addColorStop(0, L.storm ? '#2f6a9e' : '#3f8fd0'); g.addColorStop(1, '#1f5a96');
      ctx.fillStyle = g; ctx.fillRect(0, sea, W, H - sea);
      ctx.strokeStyle = 'rgba(255, 255, 255, .45)'; ctx.lineWidth = 2;
      const amp = L.storm ? 5 : 2;
      for (let row = 0; row < 3; row++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, sea + 10 + row * 16 + Math.sin(x * 0.05 + s.t * 2 + row) * amp);
        ctx.stroke();
      }
      s.dolphins.forEach(d => { // дельфин выпрыгивает дугой
        const k = d.t / 1.4, x = d.x + d.dir * (k - 0.5) * 70, y = sea + 6 - Math.sin(k * Math.PI) * 55;
        ctx.save(); ctx.translate(x, y); ctx.rotate(d.dir * (k - 0.5) * 2.2); if (d.dir < 0) ctx.scale(-1, 1);
        ctx.fillStyle = '#5d7fa3'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 7, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(-8, -14); ctx.lineTo(4, -6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-26, -6); ctx.lineTo(-26, 6); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12, -2, 1.6, 0, TAU); ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = '#a0723f'; ctx.fillRect(r.x - r.w / 2, sea - 8, r.w, 10);
      ctx.fillStyle = '#7a5530';
      for (let x = r.x - r.w / 2 + 10; x < r.x + r.w / 2; x += 14) ctx.fillRect(x, sea - 8, 2, 10);
      [[0.5, '#ef6461'], [0.3, '#ffffff'], [0.12, '#ef6461']].forEach(([k, c]) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(r.x, sea - 9, r.w * k, 4 * k / 0.5 + 1, 0, 0, TAU); ctx.fill();
      });
      s.bonuses.forEach(bo => { ctx.strokeStyle = '#ff6b35'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bo.x, bo.y, bo.r + 5, 0, TAU); ctx.stroke(); });
      s.gulls.forEach(gu => bird(ctx, gu.x, gu.y, 12, s.t, '#f4f6f8'));
      if (s.plane) drawSprite(ctx, a.img, s.plane.x, s.plane.y, s.pw);
      const b = s.box;
      if (b) {
        if (b.open) chute(ctx, b.x, b.y - 6, 19, ['#ffffff', '#ef6461']);
        ctx.fillStyle = '#6b7f4a'; ctx.fillRect(b.x - 9, b.y - 7, 18, 14);
        ctx.strokeStyle = '#3e4a2a'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x - 9, b.y - 7, 18, 14);
      }
      const wl = s.wind * 40;
      label(ctx, 'Ветер', W / 2, 46, 13);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(W / 2 - wl, 64); ctx.lineTo(W / 2 + wl, 64);
      if (Math.abs(wl) > 3) { const d = Math.sign(wl); ctx.moveTo(W / 2 + wl - d * 7, 58); ctx.lineTo(W / 2 + wl, 64); ctx.lineTo(W / 2 + wl - d * 7, 70); }
      ctx.stroke();
      if (Math.abs(wl) <= 3) label(ctx, 'штиль', W / 2, 64, 12);
    },
  },

  /* ---------- 9. Ту-144: «Сверхзвук» ---------- */
  {
    icon: '🚀',
    how: 'Ту-144 разгоняется до двух скоростей звука! Нажимай выше самолёта — он поднимется в верхний коридор, ниже — опустится. Облетай шары, тучи и птиц, собирай звёзды. Дальше: метеозонды прыгают между коридорами, молнии.',
    goal: L => `Цель: пролети ${L.goal} препятствий`,
    levels: [
      { goal: 10, m0: 0.6, m1: 1.1, two: 0.2, mover: 0, bolt: 0, news: 'Собирай звёзды в свободных коридорах' },
      { goal: 14, m0: 0.8, m1: 1.4, two: 0.3, mover: 0, bolt: 0, news: 'Быстрее! Преодолей звуковой барьер' },
      { goal: 18, m0: 1, m1: 1.6, two: 0.35, mover: 1, bolt: 0, news: 'Метеозонды перескакивают в соседний коридор!' },
      { goal: 22, m0: 1.2, m1: 1.8, two: 0.4, mover: 1, bolt: 1, news: 'Молнии в коридоре — смотри на мигание!' },
      { goal: 26, m0: 1.4, m1: 2, two: 0.45, mover: 1, bolt: 1, news: 'Почти две скорости звука!' },
    ],
    start(W, H) {
      const lines = Array.from({ length: 14 }, () => ({ x: rnd(0, W), y: rnd(0, H), l: rnd(20, 60) }));
      return base({ lane: 1, x: W * 0.22, y: H * 0.52, pw: pwOf(W) * 1.15, rows: [], mach: 0.6, boomed: false, boomT: 0, lines });
    },
    setup(s) { s.rows = []; s.spawn = 1.2; s.mach = s.L.m0; s.boltT = 4; s.zap = null; s.boomed = s.mach >= 1; },
    lanes(H) { return [H * 0.3, H * 0.52, H * 0.74]; },
    box: s => ({ x: s.x, y: s.y, hw: s.pw * 0.42, hh: s.pw * 0.15 }),
    bonus(s, a) { return { x: a.W + 20, y: this.lanes(a.H)[Math.floor(rnd(0, 3))], vx: -a.W * (0.35 + s.mach * 0.32), vy: 0, still: true }; },
    step(s, dt, inp, a) {
      const { W, H } = a, LN = this.lanes(H), L = s.L;
      inp.taps.forEach(t => {
        if (t.y < s.y - 8 && s.lane > 0) { s.lane--; sfx.flap(); }
        else if (t.y > s.y + 8 && s.lane < 2) { s.lane++; sfx.flap(); }
      });
      s.y += (LN[s.lane] - s.y) * Math.min(1, dt * 10);
      s.mach = Math.min(L.m1, L.m0 + s.lt * 0.03);
      if (!s.boomed && s.mach >= 1) { s.boomed = true; s.boomT = 1; sfx.boom(); say(s, W / 2, H * 0.2, 'Звуковой барьер! 💥'); }
      s.boomT = Math.max(0, s.boomT - dt);
      const sp = W * (0.35 + s.mach * 0.32);
      s.lines.forEach(l => { l.x -= sp * 1.6 * dt; if (l.x < -l.l) { l.x = W + rnd(0, 40); l.y = rnd(0, H); } });
      if ((s.spawn -= dt) <= 0) {
        const n = chance(L.two) ? 2 : 1;
        const lanes = shuffle([0, 1, 2]);
        const blocked = lanes.slice(0, n), free = lanes.slice(n);
        const mover = L.mover && n === 1 && chance(0.35);
        s.rows.push({
          x: W + 40, lanes: blocked, types: blocked.map(() => (mover ? 'probe' : pick(['balloon', 'cloud', 'birds']))),
          star: chance(0.7) ? free[0] : null, passed: false, hit: false,
          move: mover ? { to: blocked[0] === 1 ? pick([0, 2]) : 1, at: W * rnd(0.45, 0.65), k: 0 } : null,
        });
        s.spawn = Math.max(0.75, 1.5 - s.mach * 0.25);
      }
      if (L.bolt && !s.zap && (s.boltT -= dt) <= 0) s.zap = { lane: Math.floor(rnd(0, 3)), warn: 1.1, strike: 0.35 };
      if (s.zap) {
        const z = s.zap;
        if (z.warn > 0) { z.warn -= dt; if (z.warn <= 0) sfx.thunder(); }
        else { z.strike -= dt; if (Math.abs(s.y - LN[z.lane]) < 20) hurt(s, s.x, s.y); if (z.strike <= 0) { s.zap = null; s.boltT = rnd(3.5, 5.5); } }
      }
      const cur = LN.reduce((best, y, i) => (Math.abs(y - s.y) < Math.abs(LN[best] - s.y) ? i : best), 0);
      s.rows.forEach(r => {
        r.x -= sp * dt;
        if (r.move && r.x < r.move.at && r.move.k < 1) { r.move.k = Math.min(1, r.move.k + dt * 2.5); if (r.move.k >= 1) r.lanes = [r.move.to]; }
        if (!r.passed && r.x < s.x - s.pw * 0.5) { r.passed = true; if (!r.hit) { addScore(s, 1); progress(s); sfx.pick(); } }
        const hitLanes = r.move && r.move.k > 0 && r.move.k < 1 ? [r.lanes[0], r.move.to] : r.lanes;
        if (!r.hit && Math.abs(r.x - s.x) < s.pw * 0.42 + 18 && hitLanes.includes(cur)) { r.hit = true; hurt(s, s.x, s.y); }
        if (r.star != null && Math.abs(r.x - s.x) < s.pw * 0.4 && cur === r.star) { addScore(s, 2, r.x, LN[r.star] - 24); r.star = null; sfx.pick(); }
      });
      s.rows = s.rows.filter(r => r.x > -60);
    },
    draw(ctx, s, a) {
      const { W, H } = a, LN = this.lanes(H);
      const dark = clamp((s.mach - 0.6) / 1.4, 0, 1);
      fillSky(ctx, W, H, [[0, `rgb(${Math.round(15 - dark * 10)}, ${Math.round(47 - dark * 30)}, ${Math.round(107 - dark * 50)})`], [0.55, '#3c7bd0'], [1, '#bfe2ff']]);
      ctx.strokeStyle = 'rgba(255, 255, 255, .35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); s.lines.forEach(l => { ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.l, l.y); }); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, .18)'; ctx.setLineDash([10, 12]); ctx.lineWidth = 2;
      [(LN[0] + LN[1]) / 2, (LN[1] + LN[2]) / 2].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
      ctx.setLineDash([]);
      if (s.zap) {
        const y = LN[s.zap.lane];
        if (s.zap.warn > 0) warnLine(ctx, 0, y, W, y, s.t); else drawBolt(ctx, 0, y, W, y, 6);
      }
      s.rows.forEach(r => {
        if (r.star != null) star(ctx, r.x, LN[r.star], 10, '#ffd23f', s.t * 2);
        r.lanes.forEach((ln, i) => {
          let y = LN[ln];
          if (r.move && r.move.k > 0 && r.move.k < 1) y = LN[ln] + (LN[r.move.to] - LN[ln]) * r.move.k;
          const x = r.x, t = r.types[i];
          if (t === 'probe') { // метеозонд
            ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.arc(x, y - 10, 13, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 14); ctx.stroke();
            ctx.fillStyle = '#ff8a3d'; ctx.fillRect(x - 5, y + 13, 10, 7);
            if (r.move && !r.move.k) label(ctx, r.move.to < ln ? '⬆' : '⬇', x + 20, y - 10, 14, '#ffd23f');
          } else if (t === 'balloon') {
            ctx.fillStyle = '#ef6461'; ctx.beginPath(); ctx.ellipse(x, y - 8, 15, 18, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(x, y - 8, 6, 18, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#a0723f'; ctx.fillRect(x - 5, y + 15, 10, 7);
          } else if (t === 'cloud') puff(ctx, x - 16, y + 4, 14, '#8b97b8');
          else { bird(ctx, x - 10, y - 8, 8, s.t); bird(ctx, x + 8, y, 8, s.t + 1); bird(ctx, x - 6, y + 10, 8, s.t + 2); }
        });
      });
      if (s.boomT > 0) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${s.boomT})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x + s.pw * 0.45, s.y, (1 - s.boomT) * 80 + 20, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
      }
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
      label(ctx, `М ${s.mach.toFixed(2).replace('.', ',')}`, W - 12, 52, 17, s.mach >= 1 ? '#ffd23f' : '#fff', 'right');
    },
  },

  /* ---------- 10. «Буран»: «Метеориты» ---------- */
  {
    icon: '☄️',
    how: '«Буран» на орбите! Нажимай на метеорит — лазер его разобьёт. Большой раскалывается на два. Летающая тарелка — +10 и подарок. Спутники наши — в них не стреляй! На 5-м уровне — астероид-великан.',
    goal: L => (L.boss ? 'Цель: разбей астероид-великан (25 попаданий)' : `Цель: разбей ${L.goal} метеоритов`),
    levels: [
      { goal: 10, sp: 0.18, every: 1.3, big: 0.3, comet: 0, ufo: 0, sat: 0, boss: 0, news: 'Нажимай прямо на метеорит' },
      { goal: 14, sp: 0.21, every: 1.15, big: 0.35, comet: 1, ufo: 0, sat: 0, boss: 0, news: 'Кометы! Они очень быстрые' },
      { goal: 18, sp: 0.24, every: 1.05, big: 0.4, comet: 1, ufo: 1, sat: 0, boss: 0, news: 'Летающие тарелки: попади — +10 и подарок!' },
      { goal: 22, sp: 0.26, every: 0.95, big: 0.4, comet: 1, ufo: 1, sat: 1, boss: 0, news: 'Спутники наши — не стреляй в них!' },
      { goal: 1, sp: 0.2, every: 1.6, big: 0.3, comet: 0, ufo: 1, sat: 0, boss: 1, news: 'Астероид-великан летит на корабль!' },
    ],
    start(W, H) {
      const stars = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.5, 1.8), k: rnd(0.2, 1) }));
      return base({ x: W * 0.16, y: H * 0.5, pw: pwOf(W) * 1.1, rocks: [], beams: [], stars, ufos: [], sats: [], boss: null });
    },
    setup(s, a) {
      s.rocks = []; s.beams = []; s.ufos = []; s.sats = []; s.cd = 0; s.spawn = 0.8; s.uspawn = 5; s.sspawn = 3;
      s.boss = s.L.boss ? { x: a.W + 90, y: a.H * 0.45, r: 62, hp: 25, max: 25, throwT: 2, flash: 0, rot: 0 } : null;
    },
    box: s => ({ x: s.x, y: s.y, hw: s.pw * 0.42, hh: s.pw * 0.14 }),
    bonus: (s, a) => ({ x: a.W + 20, y: rnd(a.H * 0.15, a.H * 0.85), vx: -a.W * 0.16, vy: 0, still: true }),
    rock(x, y, big, vx, vy, comet) {
      const r = comet ? 9 : big ? rnd(22, 27) : rnd(12, 15);
      const pts = Array.from({ length: 9 }, (_, i) => { const an = i / 9 * TAU; return [Math.cos(an) * r * rnd(0.75, 1.05), Math.sin(an) * r * rnd(0.75, 1.05)]; });
      return { x, y, r, big, comet, vx, vy, rot: rnd(0, TAU), vr: rnd(-1.5, 1.5), pts };
    },
    step(s, dt, inp, a) {
      const { W, H } = a, L = s.L;
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
        // что первым попадётся на пути луча
        const targets = [];
        s.rocks.forEach(r => targets.push({ o: r, kind: 'rock', r: r.r }));
        s.ufos.forEach(u => targets.push({ o: u, kind: 'ufo', r: 18 }));
        s.sats.forEach(st => targets.push({ o: st, kind: 'sat', r: 16 }));
        s.bonuses.forEach(b => targets.push({ o: b, kind: 'bonus', r: b.r }));
        if (s.boss) targets.push({ o: s.boss, kind: 'boss', r: s.boss.r });
        let best = null, bestT = Infinity;
        targets.forEach(tg => {
          const px = tg.o.x - ox, py = tg.o.y - oy;
          const along = px * dx + py * dy, perp = Math.abs(px * dy - py * dx);
          if (along > 0 && perp < tg.r + 6 && along < bestT) { best = tg; bestT = along; }
        });
        const reach = best ? bestT : Math.max(W, H) * 1.5;
        s.beams.push({ x1: ox, y1: oy, x2: ox + dx * reach, y2: oy + dy * reach, life: 0.15 });
        sfx.laser();
        if (!best) return;
        const o = best.o;
        if (best.kind === 'rock') {
          o.dead = true;
          addScore(s, o.big ? 2 : 1);
          progress(s);
          burst(s, o.x, o.y, o.comet ? '#9fe6ff' : '#b08060', o.big ? 18 : 10, 130);
          sfx.boom();
          if (o.big) {
            const spd = Math.hypot(o.vx, o.vy);
            s.rocks.push(this.rock(o.x, o.y, false, o.vx * 0.8, -spd * 0.6), this.rock(o.x, o.y, false, o.vx * 0.8, spd * 0.6));
          }
        } else if (best.kind === 'ufo') {
          o.dead = true;
          addScore(s, 10, o.x, o.y - 24);
          burst(s, o.x, o.y, '#9cff9c', 20, 150); sfx.boom();
          s.bonuses.push({ kind: pick(s.lives < MAX_LIVES ? ['heart', 'heart', 'shield', 'x2'] : ['shield', 'x2']), x: o.x, y: o.y, vx: -W * 0.12, vy: 0, r: 15, ph: 0, still: true });
        } else if (best.kind === 'sat') {
          o.dead = true;
          addScore(s, -5);
          say(s, o.x, o.y - 24, 'Это наш спутник! −5', '#ffe0e0');
          burst(s, o.x, o.y, '#7fb6e0', 12, 100); sfx.hit();
        } else if (best.kind === 'bonus') grabBonus(s, o);
        else if (best.kind === 'boss') {
          o.hp--; o.flash = 0.12;
          burst(s, ox + dx * bestT, oy + dy * bestT, '#b08060', 6, 90);
          if (o.hp <= 0) {
            burst(s, o.x, o.y, '#b08060', 50, 240); burst(s, o.x, o.y, '#ffd23f', 30, 200);
            sfx.boom(); addScore(s, 50, o.x, o.y - 40); s.boss = null; progress(s);
          }
        }
      });
      s.beams.forEach(b => { b.life -= dt; });
      s.beams = s.beams.filter(b => b.life > 0);
      const launch = (x0, y0, big, comet, speed) => {
        const ty = s.y + rnd(-H * 0.2, H * 0.2), dx = s.x - x0, dy = ty - y0, len = Math.hypot(dx, dy);
        s.rocks.push(this.rock(x0, y0, big, dx / len * speed, dy / len * speed, comet));
      };
      if ((s.spawn -= dt) <= 0) {
        const comet = L.comet && chance(0.25);
        launch(W + 30, rnd(H * 0.1, H * 0.9), !comet && chance(L.big), comet, W * L.sp * (comet ? 2.6 : 1));
        s.spawn = L.every * rnd(0.8, 1.2);
      }
      if (L.ufo && (s.uspawn -= dt) <= 0) { s.ufos.push({ x: W + 30, y: rnd(H * 0.12, H * 0.35), ph: rnd(0, TAU) }); s.uspawn = rnd(6, 9); }
      s.ufos.forEach(u => { u.x -= W * 0.28 * dt; u.y += Math.sin(s.t * 5 + u.ph) * 40 * dt; });
      s.ufos = s.ufos.filter(u => !u.dead && u.x > -40);
      if (L.sat && (s.sspawn -= dt) <= 0) { s.sats.push({ x: W + 30, y: rnd(H * 0.15, H * 0.85), rot: rnd(0, TAU) }); s.sspawn = rnd(3, 5); }
      s.sats.forEach(st => { st.x -= W * 0.12 * dt; st.rot += dt * 0.6; });
      s.sats = s.sats.filter(st => !st.dead && st.x > -40);
      const b = s.boss;
      if (b) {
        b.x += (W * 0.74 - b.x) * Math.min(1, dt * 0.6);
        b.y = H * 0.45 + Math.sin(s.lt * 0.7) * H * 0.18;
        b.rot += dt * 0.3;
        b.flash = Math.max(0, b.flash - dt);
        if ((b.throwT -= dt) <= 0) { launch(b.x - b.r, b.y, false, false, W * 0.3); b.throwT = rnd(1.3, 1.9); }
      }
      s.rocks.forEach(r => {
        r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt;
        if (!r.dead && Math.abs(r.x - s.x) < s.pw * 0.42 + r.r * 0.7 && Math.abs(r.y - s.y) < s.pw * 0.14 + r.r * 0.7) {
          r.dead = true; burst(s, r.x, r.y, '#b08060', 12, 120); hurt(s, s.x, s.y);
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
      s.sats.forEach(st => {
        ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(st.rot);
        ctx.fillStyle = '#2f5fa8'; ctx.fillRect(-24, -5, 14, 10); ctx.fillRect(10, -5, 14, 10);
        ctx.fillStyle = '#d5dae1'; ctx.fillRect(-8, -7, 16, 14);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(-2, -11, 4, 4);
        ctx.restore();
        label(ctx, 'наш', st.x, st.y - 18, 10, '#bfe6ff');
      });
      s.ufos.forEach(u => {
        ctx.fillStyle = 'rgba(160, 255, 200, .7)'; ctx.beginPath(); ctx.ellipse(u.x, u.y - 6, 9, 8, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#8a929e'; ctx.beginPath(); ctx.ellipse(u.x, u.y, 22, 7, 0, 0, TAU); ctx.fill();
        ['#ff4d3d', '#ffd23f', '#5fffa0'].forEach((c, i) => { ctx.fillStyle = Math.floor(s.t * 6 + i) % 3 === 0 ? '#fff' : c; ctx.beginPath(); ctx.arc(u.x - 12 + i * 12, u.y + 1, 2.2, 0, TAU); ctx.fill(); });
      });
      const drawRock = (r, fill, edge) => {
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
        ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 2;
        ctx.beginPath(); r.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0, 0, 0, .18)';
        ctx.beginPath(); ctx.arc(r.r * 0.25, -r.r * 0.2, r.r * 0.22, 0, TAU); ctx.arc(-r.r * 0.3, r.r * 0.3, r.r * 0.15, 0, TAU); ctx.fill();
        ctx.restore();
      };
      s.rocks.forEach(r => {
        if (r.comet) {
          const g = ctx.createLinearGradient(r.x, r.y, r.x - r.vx * 0.25, r.y - r.vy * 0.25);
          g.addColorStop(0, 'rgba(160, 230, 255, .9)'); g.addColorStop(1, 'rgba(160, 230, 255, 0)');
          ctx.strokeStyle = g; ctx.lineWidth = 10; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.vx * 0.25, r.y - r.vy * 0.25); ctx.stroke();
          ctx.fillStyle = '#e9fbff'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.fill();
        } else drawRock(r, '#8a6a50', '#4e3a2a');
      });
      const b = s.boss;
      if (b) {
        if (!b.pts) b.pts = Array.from({ length: 14 }, (_, i) => { const an = i / 14 * TAU; return [Math.cos(an) * b.r * rnd(0.85, 1.05), Math.sin(an) * b.r * rnd(0.85, 1.05)]; });
        ctx.globalAlpha = b.flash > 0 ? 0.6 : 1;
        drawRock(b, '#7a5c45', '#3e2c20');
        ctx.globalAlpha = 1;
        angryFace(ctx, b.x, b.y - 4, 2);
        ctx.fillStyle = 'rgba(20, 30, 60, .55)'; rrect(ctx, W * 0.2, 42, W * 0.6, 12, 6); ctx.fill();
        ctx.fillStyle = '#ef6461'; rrect(ctx, W * 0.2 + 2, 44, Math.max(0, (W * 0.6 - 4) * b.hp / b.max), 8, 4); ctx.fill();
      }
      s.beams.forEach(bm => {
        ctx.strokeStyle = `rgba(120, 240, 255, ${bm.life / 0.15})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${bm.life / 0.15})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
      });
      drawSprite(ctx, a.img, s.x, s.y, s.pw, 0, false, blink(s));
    },
  },
];

/* ================= Движок: экран «Аэродром» и экран игры ================= */
const arc = {
  i: -1, game: null, s: null, raf: 0, last: 0, running: false, paused: false,
  W: 0, H: 0, ctx: null, img: null, mode: 'intro', startLevel: 1, unlockedNow: 0, newRecord: false,
  inp: { down: false, x: 0, y: 0, has: false, taps: [] },
};

function gameId() { return PLANES[arc.i].id; }
function maxLevel(id) { return clamp(data.arcadeLevel[id] || 1, 1, LEVELS); }
function unlockLevel(n, all) {
  const id = gameId();
  if (n > maxLevel(id)) { data.arcadeLevel[id] = n; arc.unlockedNow = n; }
  if (all) data.arcadeWon[id] = true;
  saveData();
}

function renderArcade() {
  $('ticketCount').textContent = data.tickets;
  const left = TICKET_EVERY - data.ticketProgress;
  $('ticketSub').textContent = `Ещё ${left} ${plural(left, 'верный ответ', 'верных ответа', 'верных ответов')} — и новый билет`;
  $('ticketBar').style.width = (data.ticketProgress / TICKET_EVERY * 100) + '%';
  const lv = level();
  $('games').innerHTML = PLANES.map((p, i) => {
    const open = lv >= p.level;
    const best = data.arcadeBest[p.id];
    const won = data.arcadeWon[p.id];
    const sub = !open ? unlockText(p.level)
      : won ? `🏆 Пройдена! Рекорд: ${best || 0}`
      : `Уровень ${maxLevel(p.id)} из ${LEVELS}` + (best ? ` · рекорд ${best}` : '');
    return `<button class="game-tile${open ? '' : ' locked'}${won ? ' won' : ''}" type="button" data-game="${i}">` +
      `<span class="gt-pic">${planeSVG(p.id)}</span>` +
      `<b>${open ? '' : '🔒 '}${p.game}</b>` +
      `<span class="gt-sub">${sub}</span></button>`;
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

function startLevel(s, n) {
  const g = arc.game, L = g.levels[n - 1];
  s.level = n; s.prog = 0; s.goal = L.goal; s.L = L; s.lt = 0;
  s.inv = Math.max(s.inv, 1.2);
  s.bonuses = []; s.bonusT = rnd(5, 8);
  g.setup(s, arc, L, n);
  s.banner = { title: `Уровень ${n}`, sub: g.goal(L) + '\n' + L.news, t: 2.8, max: 2.8 };
}

function newRun(levelN) {
  arc.s = arc.game.start(arc.W, arc.H);
  startLevel(arc.s, levelN);
}

function openGame(i) {
  const p = PLANES[i];
  if (!p || level() < p.level) return;
  arcadeStop();
  arc.i = i;
  arc.game = ARCADE[i];
  arc.startLevel = maxLevel(p.id);
  showScreen('play');
  $('playTitle').textContent = p.game;
  $('playScore').textContent = '0';
  setupCanvas();
  arc.img = planeImage(p.id);
  newRun(arc.startLevel);
  arc.s.banner = null;
  const redraw = () => { if (!arc.running && arc.s) drawGame(); };
  if (!arc.img.complete) arc.img.addEventListener('load', redraw, { once: true });
  drawGame();
  showOverlay('intro');
}

function renderLevelPicker() {
  const max = maxLevel(gameId());
  $('poLevels').innerHTML = '<span class="po-levels-title">Уровень:</span>' + Array.from({ length: LEVELS }, (_, k) => {
    const n = k + 1, open = n <= max;
    return `<button type="button" class="po-lv${n === arc.startLevel ? ' on' : ''}${open ? '' : ' locked'}" data-lv="${n}"${open ? '' : ' disabled'} aria-label="Уровень ${n}${open ? '' : ' (закрыт)'}">${open ? n : '🔒'}</button>`;
  }).join('');
}

function goText() {
  return data.tickets < 1 ? 'Нет билетов 🎟️' : `Играть: уровень ${arc.startLevel} · 🎟️ 1 из ${data.tickets}`;
}

function showOverlay(mode) {
  arc.mode = mode;
  const p = PLANES[arc.i];
  const best = data.arcadeBest[p.id] || 0;
  $('playOverlay').classList.remove('hidden');
  $('poPic').innerHTML = planeSVG(p.id);
  const go = $('poGo');
  $('poLevels').classList.toggle('hidden', mode === 'pause');
  if (mode === 'pause') {
    $('poTitle').textContent = 'Пауза';
    $('poText').textContent = 'Игра ждёт тебя.';
    $('poNote').textContent = '';
    go.textContent = 'Продолжить ▶';
    go.disabled = false;
    return;
  }
  if (mode === 'intro') {
    $('poTitle').textContent = p.game;
    $('poText').textContent = arc.game.how + (best ? ` Рекорд: ${best}.` : '');
  } else {
    const s = arc.s;
    $('poTitle').textContent = s.won ? 'Все 5 уровней пройдены! 🏆' : arc.newRecord ? 'Новый рекорд! 🎉' : 'Полёт окончен!';
    $('poText').textContent = (s.won ? 'Ты настоящий ас! ' : `Ты дошёл до уровня ${s.level}. `) +
      `Счёт: ${s.score}. Рекорд: ${data.arcadeBest[p.id] || 0}.` +
      (arc.unlockedNow && !s.won ? ` Открыт уровень ${arc.unlockedNow} — теперь можно начинать с него!` : '');
    if (!s.won) arc.startLevel = maxLevel(p.id);
  }
  renderLevelPicker();
  go.disabled = data.tickets < 1;
  go.textContent = goText();
  const need = TICKET_EVERY - data.ticketProgress;
  $('poNote').textContent = data.tickets < 1 ? `Реши ${need} ${plural(need, 'пример', 'примера', 'примеров')} правильно — и получишь билет.` : '';
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
  arc.unlockedNow = 0;
  newRun(arc.startLevel);
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
    if (s.shield > 0) s.shield -= dt;
    if (s.x2 > 0) s.x2 -= dt;
    if (s.gun > 0) s.gun -= dt;
    if (s.banner && (s.banner.t -= dt) <= 0) s.banner = null;
    if (s.ending != null) {
      s.ending -= dt;
      if (s.ending <= 0) s.over = true;
    } else if (s.clear > 0) {
      s.clear -= dt;
      if (s.clear <= 0) {
        s.clear = 0;
        if (s.level >= LEVELS) { s.won = true; s.over = true; } else startLevel(s, s.level + 1);
      }
    } else {
      s.lt += dt;
      arc.game.step(s, dt, arc.inp, arc);
      stepBonuses(s, dt, arc);
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
  const { ctx, s } = arc;
  if (!ctx || !s) return;
  ctx.clearRect(0, 0, arc.W, arc.H);
  arc.game.draw(ctx, s, arc);
  drawBonuses(ctx, s);
  if (s.shield > 0 && arc.game.box) {
    const b = arc.game.box(s, arc);
    ctx.strokeStyle = `rgba(127, 196, 255, ${0.5 + Math.sin(s.t * 8) * 0.3})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.hw * 1.35, b.hh * 2.8, 0, 0, TAU); ctx.stroke();
  }
  s.parts.forEach(p => {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
  });
  ctx.globalAlpha = 1;
  s.texts.forEach(x => {
    ctx.globalAlpha = clamp(x.life, 0, 1);
    label(ctx, x.text, x.x, x.y, 17, x.color);
  });
  ctx.globalAlpha = 1;
  drawHud(ctx, s);
}

function drawHud(ctx, s) {
  const { W, H } = arc;
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let i = 0; i < s.lives; i++) ctx.fillText('❤️', 8 + i * 17, 18);
  const txt = s.L && s.L.boss ? `Ур. ${s.level} · Босс` : `Ур. ${s.level} · ${arc.game.icon} ${s.prog}/${s.goal}`;
  ctx.font = '800 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const w = ctx.measureText(txt).width + 22;
  ctx.fillStyle = 'rgba(20, 30, 60, .55)';
  rrect(ctx, W / 2 - w / 2, 6, w, 24, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(txt, W / 2, 18.5);
  let rx = W - 10;
  if (s.x2 > 0) { label(ctx, '×2', rx, 18, 15, '#ffd23f', 'right'); rx -= 30; }
  if (s.shield > 0) { ctx.font = '15px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('🛡️', rx, 18); }
  if (s.banner) {
    const bn = s.banner, k = clamp(Math.min(bn.t, bn.max - bn.t) * 4, 0, 1);
    ctx.globalAlpha = k;
    ctx.font = '700 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const lines = wrapText(ctx, bn.sub || '', W - 70);
    const bh = 54 + lines.length * 20, top = H * 0.36 - bh / 2;
    ctx.fillStyle = 'rgba(20, 30, 60, .78)';
    rrect(ctx, 20, top, W - 40, bh, 18); ctx.fill();
    label(ctx, bn.title, W / 2, top + 28, 22, '#ffd23f');
    ctx.font = '700 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, top + 58 + i * 20));
    ctx.globalAlpha = 1;
  }
}

function endRound() {
  arc.running = false;
  cancelAnimationFrame(arc.raf);
  const id = gameId();
  const best = data.arcadeBest[id] || 0;
  arc.newRecord = arc.s.score > best;
  if (arc.newRecord) data.arcadeBest[id] = arc.s.score;
  saveData();
  if (arc.s.won) sounds.victory(); else if (arc.newRecord) sounds.fanfare(); else sounds.chime();
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
  $('poLevels').addEventListener('click', e => {
    const b = e.target.closest('[data-lv]');
    if (!b || b.disabled) return;
    arc.startLevel = Number(b.dataset.lv);
    renderLevelPicker();
    $('poGo').textContent = goText();
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
