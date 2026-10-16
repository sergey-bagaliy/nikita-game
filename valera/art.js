'use strict';

/* ================= Рисунки (всё рисуется кодом на canvas) ================= */

const FACE = new Image();
FACE.src = 'valera-face.jpg';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function blobPath(ctx, x, y, rx, ry, shape) {
  ctx.beginPath();
  const n = shape.length;
  for (let i = 0; i <= n; i++) {
    const a = (i % n) / n * Math.PI * 2;
    const k = shape[i % n];
    const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function randomShape(n = 9) {
  return Array.from({ length: n }, () => 0.78 + Math.random() * 0.3);
}

/* ---------- Лицо Валеры ---------- */
function drawFace(ctx, x, y, rx, ry, tilt = 0, angry = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // тень
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(3, 4, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  if (FACE.complete && FACE.naturalWidth) {
    ctx.save();
    ctx.clip();
    // в файле лицо занимает примерно середину кадра
    const fw = rx * 2.6, fh = ry * 2.55;
    ctx.drawImage(FACE, -fw * 0.47, -fh * 0.52, fw, fh);
    if (angry) { ctx.fillStyle = 'rgba(255,40,40,.28)'; ctx.fillRect(-rx, -ry, rx * 2, ry * 2); }
    ctx.restore();
  } else {
    ctx.fillStyle = '#f0c8a0'; ctx.fill();
  }
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#2b2328';
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/* ---------- Игрок: мотоцикл сверху и большая голова ---------- */
function drawPlayer(ctx, x, y, s, bike, t, st) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(st.lean * 0.18);
  const wob = Math.sin(t * 30) * 0.6 * s;

  if (bike.special === 'roller') {
    // каток
    ctx.fillStyle = '#555'; rr(ctx, -30 * s, -48 * s, 60 * s, 22 * s, 8 * s); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    for (let i = -24; i <= 24; i += 8) { ctx.beginPath(); ctx.moveTo(i * s, -46 * s); ctx.lineTo(i * s, -28 * s); ctx.stroke(); }
    ctx.fillStyle = bike.color; rr(ctx, -26 * s, -28 * s, 52 * s, 64 * s, 10 * s); ctx.fill();
    ctx.fillStyle = '#222'; rr(ctx, -28 * s, 26 * s, 12 * s, 18 * s, 4 * s); ctx.fill(); rr(ctx, 16 * s, 26 * s, 12 * s, 18 * s, 4 * s); ctx.fill();
    ctx.fillStyle = '#333'; ctx.font = `bold ${9 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('КРАСНОАРМЕЙКА', 0, 30 * s, 46 * s);
    drawFace(ctx, 0, -2 * s + wob, 21 * s, 25 * s, st.headTilt, st.hurt > 0);
    ctx.restore();
    return;
  }

  // коляска «Урала»
  if (bike.id === 'ural') {
    ctx.fillStyle = '#222'; rr(ctx, 30 * s, 2 * s, 10 * s, 18 * s, 4 * s); ctx.fill();
    ctx.fillStyle = bike.color; ctx.beginPath(); ctx.ellipse(28 * s, 4 * s, 15 * s, 24 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2a2a2e'; ctx.beginPath(); ctx.ellipse(28 * s, 8 * s, 9 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8c8c8'; ctx.font = `${8 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🪣', 28 * s, 11 * s);
  }

  // колёса
  ctx.fillStyle = '#1d1d1f';
  rr(ctx, -6 * s, -50 * s, 12 * s, 24 * s, 5 * s); ctx.fill();
  rr(ctx, -7 * s, 22 * s, 14 * s, 26 * s, 5 * s); ctx.fill();
  // рама/бак
  ctx.fillStyle = bike.color;
  rr(ctx, -10 * s, -34 * s, 20 * s, 60 * s, 9 * s); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, -4 * s, -28 * s, 4 * s, 20 * s, 2 * s); ctx.fill();
  // фара
  ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(0, -38 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  // руль
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-22 * s, -24 * s); ctx.lineTo(22 * s, -24 * s); ctx.stroke();
  // руки (джерси чёрно-красная)
  ctx.strokeStyle = '#1b1b1f'; ctx.lineWidth = 7 * s;
  ctx.beginPath(); ctx.moveTo(-14 * s, 0); ctx.lineTo(-21 * s, -22 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14 * s, 0); ctx.lineTo(21 * s, -22 * s); ctx.stroke();
  ctx.strokeStyle = '#e0262b'; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.moveTo(-15 * s, -4 * s); ctx.lineTo(-20 * s, -18 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(15 * s, -4 * s); ctx.lineTo(20 * s, -18 * s); ctx.stroke();
  // перчатки
  ctx.fillStyle = '#e0262b';
  ctx.beginPath(); ctx.arc(-22 * s, -24 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(22 * s, -24 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  // спина + рюкзак
  ctx.fillStyle = '#1b1b1f'; ctx.beginPath(); ctx.ellipse(0, 6 * s, 17 * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0262b'; rr(ctx, -17 * s, 2 * s, 34 * s, 4 * s, 2 * s); ctx.fill();
  ctx.fillStyle = '#2a2a2e'; rr(ctx, -10 * s, 4 * s, 20 * s, 16 * s, 5 * s); ctx.fill();
  // голова (крупная, для смеха)
  drawFace(ctx, 0, -12 * s + wob, 19 * s, 23 * s, st.headTilt, st.hurt > 0);
  ctx.restore();
}

/* ---------- Препятствия и бонусы ---------- */
function drawPothole(ctx, o, s) {
  const rx = o.w / 2, ry = o.h / 2;
  if (o.fixed) {
    ctx.fillStyle = '#2f2f34';
    blobPath(ctx, o.x, o.y, rx * 1.05, ry * 1.05, o.shape); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `bold ${10 * s}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('ГОСТ*', o.x, o.y + 4 * s);
    return;
  }
  ctx.fillStyle = '#3b3436';
  blobPath(ctx, o.x, o.y, rx, ry, o.shape); ctx.fill();
  ctx.fillStyle = '#1a1517';
  blobPath(ctx, o.x + 2 * s, o.y + 3 * s, rx * 0.72, ry * 0.68, o.shape); ctx.fill();
  if (o.water) {
    ctx.fillStyle = 'rgba(110,150,180,.55)';
    blobPath(ctx, o.x + 2 * s, o.y + 4 * s, rx * 0.5, ry * 0.45, o.shape); ctx.fill();
  }
  // трещины
  ctx.strokeStyle = '#2a2527'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(o.x - rx, o.y - 2 * s); ctx.lineTo(o.x - rx - 10 * s, o.y - 8 * s); ctx.lineTo(o.x - rx - 16 * s, o.y - 4 * s);
  ctx.moveTo(o.x + rx * 0.7, o.y + ry * 0.6); ctx.lineTo(o.x + rx + 8 * s, o.y + ry + 6 * s);
  ctx.stroke();
}

function drawPuddle(ctx, o, s) {
  ctx.fillStyle = 'rgba(92,120,140,.85)';
  blobPath(ctx, o.x, o.y, o.w / 2, o.h / 2, o.shape); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(o.x - o.w * 0.15, o.y - o.h * 0.15, o.w * 0.18, o.h * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
}

function drawCone(ctx, o, s) {
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.hit) ctx.rotate(o.spin);
  ctx.fillStyle = '#e8590c'; rr(ctx, -13 * s, -13 * s, 26 * s, 26 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(0, 0, 10 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(0, 0, 6 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e8590c'; ctx.beginPath(); ctx.arc(0, 0, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGoose(ctx, o, s, t) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.vx >= 0 ? 1 : -1, 1);
  const step = Math.sin(t * 18) * 3 * s;
  ctx.strokeStyle = '#f08c00'; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.moveTo(-3 * s, 8 * s); ctx.lineTo(-3 * s + step, 16 * s); ctx.moveTo(4 * s, 8 * s); ctx.lineTo(4 * s - step, 16 * s); ctx.stroke();
  ctx.fillStyle = '#f7f7f2'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 2 * s, 16 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10 * s, -2 * s); ctx.quadraticCurveTo(14 * s, -14 * s, 16 * s, -18 * s);
  ctx.lineWidth = 6 * s; ctx.strokeStyle = '#f7f7f2'; ctx.stroke();
  ctx.fillStyle = '#f7f7f2'; ctx.beginPath(); ctx.arc(17 * s, -19 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#f08c00'; ctx.beginPath(); ctx.moveTo(21 * s, -21 * s); ctx.lineTo(29 * s, -18 * s); ctx.lineTo(21 * s, -16 * s); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(18 * s, -20 * s, 1.4 * s, 0, Math.PI * 2); ctx.fill();
  // злая бровь
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(15 * s, -24 * s); ctx.lineTo(20 * s, -22 * s); ctx.stroke();
  ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.ellipse(-4 * s, 0, 9 * s, 5 * s, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGranny(ctx, o, s) {
  ctx.save();
  ctx.translate(o.x, o.y);
  const dir = o.vx >= 0 ? 1 : -1;
  // тележка
  ctx.fillStyle = '#7a4fb5'; rr(ctx, dir * 10 * s - 9 * s, -4 * s, 18 * s, 20 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(dir * 10 * s, 18 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  ctx.font = `${30 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('👵', -dir * 8 * s, 0);
  ctx.restore();
}

function drawRoller(ctx, o, s) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.fillStyle = '#666'; rr(ctx, -28 * s, 16 * s, 56 * s, 20 * s, 8 * s); ctx.fill();
  ctx.fillStyle = '#f2b80c'; rr(ctx, -24 * s, -34 * s, 48 * s, 52 * s, 8 * s); ctx.fill();
  ctx.strokeStyle = '#b5850a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#bfe6ff'; rr(ctx, -16 * s, -26 * s, 32 * s, 18 * s, 4 * s); ctx.fill();
  ctx.fillStyle = '#222'; rr(ctx, -27 * s, -34 * s, 10 * s, 18 * s, 3 * s); ctx.fill(); rr(ctx, 17 * s, -34 * s, 10 * s, 18 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#333'; ctx.font = `bold ${8 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('КРАСНОАРМЕЙКА', 0, 8 * s, 42 * s);
  ctx.restore();
}

function drawBucket(ctx, o, s, t) {
  ctx.save();
  ctx.translate(o.x, o.y + Math.sin(t * 5 + o.seed) * 3 * s);
  ctx.fillStyle = 'rgba(255,230,120,.35)'; ctx.beginPath(); ctx.arc(0, 0, 20 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9aa3ad'; ctx.beginPath();
  ctx.moveTo(-12 * s, -10 * s); ctx.lineTo(12 * s, -10 * s); ctx.lineTo(9 * s, 13 * s); ctx.lineTo(-9 * s, 13 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.ellipse(0, -10 * s, 12 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.arc(0, -10 * s, 12 * s, Math.PI, 0); ctx.stroke();
  ctx.restore();
}

function drawCoin(ctx, o, s, t) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(Math.abs(Math.cos(t * 4 + o.seed)) * 0.7 + 0.3, 1);
  ctx.fillStyle = '#f2b80c'; ctx.beginPath(); ctx.arc(0, 0, 11 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b5850a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#8a5a00'; ctx.font = `bold ${12 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('₽', 0, 1 * s);
  ctx.restore();
}

function drawEmojiItem(ctx, o, s, t, emoji) {
  ctx.save();
  ctx.translate(o.x, o.y + Math.sin(t * 5 + o.seed) * 3 * s);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(0, 0, 19 * s, 0, Math.PI * 2); ctx.fill();
  ctx.font = `${26 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, 1 * s);
  ctx.restore();
}

/* ---------- Обочина ---------- */
function drawTree(ctx, x, y, s, kind) {
  if (kind === 'bush') {
    ctx.fillStyle = '#3f7f34';
    ctx.beginPath(); ctx.arc(x - 6 * s, y, 9 * s, 0, Math.PI * 2); ctx.arc(x + 6 * s, y + 2 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(x + 5 * s, y + 6 * s, 18 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f6b2a'; ctx.beginPath(); ctx.arc(x, y, 18 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3f8a37'; ctx.beginPath(); ctx.arc(x - 5 * s, y - 5 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
}

function drawBanner(ctx, x1, x2, y, s, text) {
  ctx.fillStyle = '#555'; ctx.fillRect(x1 - 3 * s, y - 4 * s, 6 * s, 30 * s); ctx.fillRect(x2 - 3 * s, y - 4 * s, 6 * s, 30 * s);
  ctx.fillStyle = '#c92a2a'; rr(ctx, x1, y - 12 * s, x2 - x1, 22 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${11 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, (x1 + x2) / 2, y - 1 * s, x2 - x1 - 8 * s);
}

/* ---------- Иконка мотоцикла для гаража (вид сбоку, SVG) ---------- */
function bikeSVG(bike) {
  const c = bike.color;
  if (bike.special === 'roller') {
    return `<svg viewBox="0 0 120 70" class="bike-svg"><g stroke="#2b2b2b" stroke-width="2" stroke-linejoin="round">
      <rect x="30" y="14" width="44" height="30" rx="4" fill="${c}"/><rect x="38" y="18" width="20" height="14" rx="2" fill="#bfe6ff"/>
      <circle cx="22" cy="48" r="17" fill="#777"/><circle cx="88" cy="50" r="13" fill="#333"/>
      <rect x="10" y="40" width="70" height="8" fill="${c}"/></g></svg>`;
  }
  const side = bike.id === 'ural'
    ? `<path d="M70 38 Q94 26 112 38 L110 48 L72 48 Z" fill="${c}"/><circle cx="100" cy="54" r="9" fill="#222"/>` : '';
  return `<svg viewBox="0 0 120 70" class="bike-svg"><g stroke="#2b2b2b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
    ${side}
    <circle cx="24" cy="50" r="15" fill="#222"/><circle cx="24" cy="50" r="6" fill="#bbb"/>
    <circle cx="84" cy="50" r="15" fill="#222"/><circle cx="84" cy="50" r="6" fill="#bbb"/>
    <path d="M24 50 L44 34 L70 34 L84 50" fill="none" stroke="#444" stroke-width="4"/>
    <path d="M40 26 Q56 18 72 26 L70 36 L42 36 Z" fill="${c}"/>
    <rect x="30" y="26" width="18" height="6" rx="3" fill="#222"/>
    <path d="M72 26 L80 14 L88 14" fill="none" stroke="#333" stroke-width="3"/>
    <path d="M50 38 L62 38 L58 46 L52 46 Z" fill="#999"/></g></svg>`;
}
