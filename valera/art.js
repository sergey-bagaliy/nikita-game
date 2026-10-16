'use strict';

/* ================= Рисунки (всё рисуется кодом на canvas) ================= */

function loadImg(src) { const i = new Image(); i.src = src; return i; }
const FACE = loadImg('valera-face.jpg');
const MOTYA_FACE = loadImg('boss-face.jpg');
const DOG_FACE = loadImg('dog-face.jpg');

const INK = '#2b2328';

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

function shadow(ctx, x, y, rx, ry, a = 0.25) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

/* ---------- Голова с фото ---------- */
// fx, fy — где центр лица на фото (доли), k — во сколько раз фото больше овала
function drawPhotoHead(ctx, img, x, y, rx, ry, tilt = 0, tint = null, fx = 0.47, fy = 0.52, k = 2.6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(3, 4, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  if (img.complete && img.naturalWidth) {
    ctx.save();
    ctx.clip();
    const fw = rx * k, fh = fw * img.naturalHeight / img.naturalWidth;
    ctx.drawImage(img, -fw * fx, -fh * fy, fw, fh);
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(-rx, -ry, rx * 2, ry * 2); }
    ctx.restore();
  } else {
    ctx.fillStyle = '#f0c8a0'; ctx.fill();
  }
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
const drawFace = (ctx, x, y, rx, ry, tilt, angry) => drawPhotoHead(ctx, FACE, x, y, rx, ry, tilt, angry ? 'rgba(255,40,40,.28)' : null);
const drawMotyaHead = (ctx, x, y, rx, ry, tilt) => drawPhotoHead(ctx, MOTYA_FACE, x, y, rx, ry, tilt, null, 0.5, 0.5, 2.25);

/* ---------- Мотоцикл сверху (для Валеры и Моти) ---------- */
function drawBikeTop(ctx, s, color, accent, plate) {
  ctx.fillStyle = '#1d1d1f';
  rr(ctx, -6 * s, -50 * s, 12 * s, 24 * s, 5 * s); ctx.fill();
  rr(ctx, -7 * s, 22 * s, 14 * s, 26 * s, 5 * s); ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, -10 * s, -34 * s, 20 * s, 60 * s, 9 * s); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.stroke();
  if (accent) { ctx.fillStyle = accent; rr(ctx, -10 * s, -6 * s, 20 * s, 10 * s, 3 * s); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, -4 * s, -28 * s, 4 * s, 20 * s, 2 * s); ctx.fill();
  ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(0, -38 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  if (plate) {
    ctx.fillStyle = color; rr(ctx, -9 * s, -46 * s, 18 * s, 9 * s, 2 * s); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = `900 ${7 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(plate, 0, -41.5 * s);
  }
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-22 * s, -24 * s); ctx.lineTo(22 * s, -24 * s); ctx.stroke();
}

function drawRiderArms(ctx, s, jersey, stripe) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = jersey; ctx.lineWidth = 7 * s;
  ctx.beginPath(); ctx.moveTo(-14 * s, 0); ctx.lineTo(-21 * s, -22 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14 * s, 0); ctx.lineTo(21 * s, -22 * s); ctx.stroke();
  ctx.strokeStyle = stripe; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.moveTo(-15 * s, -4 * s); ctx.lineTo(-20 * s, -18 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(15 * s, -4 * s); ctx.lineTo(20 * s, -18 * s); ctx.stroke();
  ctx.fillStyle = stripe;
  ctx.beginPath(); ctx.arc(-22 * s, -24 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(22 * s, -24 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = jersey; ctx.beginPath(); ctx.ellipse(0, 6 * s, 17 * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = stripe; rr(ctx, -17 * s, 2 * s, 34 * s, 4 * s, 2 * s); ctx.fill();
}

/* ---------- Игрок ---------- */
function drawPlayer(ctx, x, y, s, bike, t, st) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(st.angle + st.lean * 0.18);
  shadow(ctx, 4 * s, 8 * s, 15 * s, 42 * s, 0.16);
  const wob = Math.sin(t * 30) * 0.6 * s;

  if (bike.special === 'roller') {
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
  if (bike.id === 'ural') {
    ctx.fillStyle = '#222'; rr(ctx, 30 * s, 2 * s, 10 * s, 18 * s, 4 * s); ctx.fill();
    ctx.fillStyle = bike.color; ctx.beginPath(); ctx.ellipse(28 * s, 4 * s, 15 * s, 24 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2a2a2e'; ctx.beginPath(); ctx.ellipse(28 * s, 8 * s, 9 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  drawBikeTop(ctx, s, bike.color);
  drawRiderArms(ctx, s, '#1b1b1f', '#e0262b');
  ctx.fillStyle = '#2a2a2e'; rr(ctx, -10 * s, 4 * s, 20 * s, 16 * s, 5 * s); ctx.fill();
  drawFace(ctx, 0, -12 * s + wob, 19 * s, 23 * s, st.headTilt, st.hurt > 0);
  ctx.restore();
}

/* ---------- Люди ---------- */
// look: { shirt, hat, tool }, opts: { run, wave, dir, head (функция), scale }
function drawPerson(ctx, x, y, s, t, look, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  const k = opts.scale || 1;
  ctx.scale(k, k);
  shadow(ctx, 3 * s, 4 * s, 13 * s, 10 * s, 0.22);
  const sw = Math.sin(t * 14);
  if (opts.run) {
    ctx.fillStyle = '#2b2b33';
    rr(ctx, -7 * s, 2 * s + sw * 5 * s, 5 * s, 10 * s, 2 * s); ctx.fill();
    rr(ctx, 2 * s, 2 * s - sw * 5 * s, 5 * s, 10 * s, 2 * s); ctx.fill();
  }
  // руки
  ctx.strokeStyle = look.shirt; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
  const waveA = opts.wave ? -1.2 + Math.sin(t * 16) * 0.6 : 0.3 + sw * 0.3;
  ctx.beginPath(); ctx.moveTo(-10 * s, -2 * s); ctx.lineTo(-10 * s - Math.cos(waveA) * 10 * s, -2 * s + Math.sin(waveA) * 10 * s - (opts.wave ? 4 * s : 0)); ctx.stroke();
  const handR = { x: 18 * s, y: 4 * s - sw * 3 * s };
  ctx.beginPath(); ctx.moveTo(10 * s, -2 * s); ctx.lineTo(handR.x, handR.y); ctx.stroke();
  // инструмент в руке
  const tool = look.tool;
  if (tool === 'shovel') {
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.moveTo(handR.x, handR.y - 12 * s); ctx.lineTo(handR.x, handR.y + 12 * s); ctx.stroke();
    ctx.fillStyle = '#9aa3ad'; rr(ctx, handR.x - 5 * s, handR.y + 10 * s, 10 * s, 9 * s, 2 * s); ctx.fill();
  } else if (tool === 'bag') {
    const a = Math.sin(t * 12) * 0.9;
    ctx.save(); ctx.translate(handR.x, handR.y); ctx.rotate(a);
    ctx.fillStyle = '#c0392b'; rr(ctx, -6 * s, 0, 12 * s, 11 * s, 3 * s); ctx.fill();
    ctx.strokeStyle = '#7b241c'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  } else if (tool === 'paper') {
    ctx.fillStyle = '#fff'; ctx.fillRect(handR.x - 4 * s, handR.y - 5 * s, 9 * s, 11 * s);
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.strokeRect(handR.x - 4 * s, handR.y - 5 * s, 9 * s, 11 * s);
  } else if (tool === 'phone') {
    ctx.fillStyle = '#111'; rr(ctx, handR.x - 3 * s, handR.y - 5 * s, 6 * s, 10 * s, 1.5 * s); ctx.fill();
  } else if (tool === 'flag') {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(handR.x, handR.y); ctx.lineTo(handR.x, handR.y - 22 * s); ctx.stroke();
    ['#fff', '#2850a8', '#d52b1e'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(handR.x, handR.y - 22 * s + i * 3.5 * s, 14 * s, 3.5 * s); });
  } else if (tool === 'bottle') {
    ctx.fillStyle = '#2e8b57'; rr(ctx, handR.x - 3 * s, handR.y - 9 * s, 6 * s, 14 * s, 2 * s); ctx.fill();
  }
  // туловище
  ctx.fillStyle = look.shirt;
  ctx.beginPath(); ctx.ellipse(0, 0, 12 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (look.stripe) { ctx.fillStyle = look.stripe; ctx.fillRect(-12 * s, -1.5 * s, 24 * s, 3 * s); }
  // голова
  if (opts.head) { opts.head(ctx, 0, -9 * s); }
  else {
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(0, -8 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.stroke();
    const hat = look.hat;
    if (hat === 'cap') { ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.arc(0, -9 * s, 6.5 * s, Math.PI, 0); ctx.fill(); ctx.fillRect(-2 * s, -16 * s, 4 * s, 4 * s); }
    else if (hat === 'helmet' || hat === 'helmet-white') {
      ctx.fillStyle = hat === 'helmet' ? '#ff9f1a' : '#f5f5f5';
      ctx.beginPath(); ctx.arc(0, -9 * s, 7.5 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(7.5 * s, -8 * s); ctx.lineTo(-7.5 * s, -8 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
    } else if (hat === 'scarf') {
      ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(0, -8.5 * s, 8 * s, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      ctx.fillStyle = '#f9e79f'; [[-4, -12], [3, -13], [0, -9]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a * s, b * s, 1.4 * s, 0, Math.PI * 2); ctx.fill(); });
    } else {
      ctx.fillStyle = '#5a4632'; ctx.beginPath(); ctx.arc(0, -9.5 * s, 6.5 * s, Math.PI, 0); ctx.fill();
    }
  }
  ctx.restore();
}

/* ---------- Мотя ---------- */
const MOTYA_LOOK = { shirt: '#1b1b1f', stripe: '#ff6a00' };
function drawMotya(ctx, x, y, s, t, pose) {
  if (pose === 'lying') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2 + Math.sin(t * 2) * 0.03);
    drawPerson(ctx, 0, 0, s, 0, { ...MOTYA_LOOK, tool: 'bottle' }, { head: (c, hx, hy) => drawMotyaHead(c, hx, hy - 4 * s, 13 * s, 15 * s, 0.2) });
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${12 * s}px sans-serif`; ctx.textAlign = 'center';
    const z = (t * 1.2) % 1;
    ctx.globalAlpha = 1 - z;
    ctx.fillText('Z z z', x + 16 * s + z * 10 * s, y - 24 * s - z * 18 * s);
    ctx.globalAlpha = 1;
    return;
  }
  const look = { ...MOTYA_LOOK, tool: pose === 'throw' ? 'bottle' : undefined };
  drawPerson(ctx, x, y, s, t, look, {
    run: true, wave: pose === 'throw' || pose === 'kick',
    head: (c, hx, hy) => drawMotyaHead(c, hx, hy - 4 * s, 14 * s, 17 * s, Math.sin(t * 10) * 0.12),
  });
}

function drawMotyaBike(ctx, x, y, s, t, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  shadow(ctx, 5 * s, 6 * s, 24 * s, 48 * s, 0.22);
  drawBikeTop(ctx, s, '#ff6a00', '#1b1b1f', '300');
  drawRiderArms(ctx, s, '#1b1b1f', '#ff6a00');
  drawMotyaHead(ctx, 0, -12 * s, 18 * s, 21 * s, -Math.PI / 2 * (dir > 0 ? 1 : -1) * 0 + Math.sin(t * 20) * 0.05);
  ctx.restore();
  // выхлоп
  ctx.fillStyle = 'rgba(200,200,200,.5)';
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(x - dir * (40 + i * 12) * s, y + Math.sin(t * 20 + i) * 3 * s, (4 + i * 2) * s, 0, Math.PI * 2); ctx.fill(); }
}

/* ---------- Животные ---------- */
function drawDog(ctx, x, y, s, t, dir, motyaDog) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir >= 0 ? 1 : -1, 1);
  shadow(ctx, 2 * s, 5 * s, 18 * s, 8 * s, 0.2);
  const run = Math.sin(t * 22) * 4 * s;
  ctx.strokeStyle = motyaDog ? '#111' : '#7a5230'; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10 * s, 4 * s); ctx.lineTo(-12 * s + run, 12 * s); ctx.moveTo(8 * s, 4 * s); ctx.lineTo(10 * s - run, 12 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-15 * s, -2 * s); ctx.quadraticCurveTo(-24 * s, -10 * s + run, -26 * s, -14 * s); ctx.stroke();
  ctx.fillStyle = motyaDog ? '#151515' : '#9c6b3f';
  ctx.beginPath(); ctx.ellipse(0, 0, 17 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
  if (motyaDog) { ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.ellipse(10 * s, 3 * s, 6 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  if (motyaDog) drawPhotoHead(ctx, DOG_FACE, x + (dir >= 0 ? 18 : -18) * s, y - 6 * s, 11 * s, 11 * s, 0, null, 0.55, 0.45, 2.2);
  else {
    ctx.fillStyle = '#9c6b3f'; ctx.beginPath(); ctx.arc(x + (dir >= 0 ? 17 : -17) * s, y - 5 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + (dir >= 0 ? 23 : -23) * s, y - 5 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCow(ctx, x, y, s, t, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir >= 0 ? 1 : -1, 1);
  shadow(ctx, 3 * s, 6 * s, 30 * s, 16 * s, 0.22);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(-26 * s, 0); ctx.quadraticCurveTo(-34 * s, 6 * s + Math.sin(t * 6) * 4 * s, -33 * s, 12 * s); ctx.stroke();
  ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.ellipse(0, 0, 27 * s, 15 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#222';
  [[-10, -5, 7, 5], [6, 4, 8, 6], [14, -7, 5, 4], [-16, 6, 5, 4]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.ellipse(a * s, b * s, c * s, d * s, 0.4, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.ellipse(30 * s, 0, 9 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f5b7b1'; ctx.beginPath(); ctx.ellipse(37 * s, 0, 4 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d5c4a1'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(27 * s, -7 * s); ctx.lineTo(25 * s, -13 * s); ctx.moveTo(27 * s, 7 * s); ctx.lineTo(25 * s, 13 * s); ctx.stroke();
  ctx.restore();
}

function drawCat(ctx, x, y, s, t, dir, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir >= 0 ? 1 : -1, 1);
  shadow(ctx, 2 * s, 4 * s, 11 * s, 5 * s, 0.2);
  ctx.strokeStyle = color; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9 * s, 0); ctx.quadraticCurveTo(-16 * s, -8 * s + Math.sin(t * 15) * 3 * s, -14 * s, -14 * s); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 10 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(10 * s, -2 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(7 * s, -5 * s); ctx.lineTo(8 * s, -11 * s); ctx.lineTo(11 * s, -6 * s); ctx.moveTo(11 * s, -6 * s); ctx.lineTo(14 * s, -10 * s); ctx.lineTo(14 * s, -4 * s); ctx.fill();
  ctx.fillStyle = '#c6f000'; ctx.beginPath(); ctx.arc(12 * s, -3 * s, 1.3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawRat(ctx, x, y, s, t, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir >= 0 ? 1 : -1, 1);
  ctx.strokeStyle = '#e8a0a8'; ctx.lineWidth = 1.5 * s;
  ctx.beginPath(); ctx.moveTo(-6 * s, 0); ctx.quadraticCurveTo(-14 * s, 4 * s * Math.sin(t * 20), -20 * s, 0); ctx.stroke();
  ctx.fillStyle = '#6d6a66'; ctx.beginPath(); ctx.ellipse(0, 0, 8 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6 * s, -3 * s); ctx.lineTo(12 * s, 0); ctx.lineTo(6 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#e8a0a8'; ctx.beginPath(); ctx.arc(5 * s, -4 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGoose(ctx, o, s, t) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.vx >= 0 ? 1 : -1, 1);
  shadow(ctx, 2 * s, 12 * s, 14 * s, 5 * s, 0.2);
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
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(15 * s, -24 * s); ctx.lineTo(20 * s, -22 * s); ctx.stroke();
  ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.ellipse(-4 * s, 0, 9 * s, 5 * s, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ---------- Препятствия и бонусы ---------- */
function drawPothole(ctx, o, s) {
  const rx = o.w / 2, ry = o.h / 2;
  if (o.fixed) {
    ctx.fillStyle = '#2f2f34';
    blobPath(ctx, o.x, o.y, rx * 1.05, ry * 1.05, o.shape); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `bold ${10 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ГОСТ*', o.x, o.y);
    return;
  }
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  blobPath(ctx, o.x, o.y - 2 * s, rx * 1.12, ry * 1.12, o.shape); ctx.fill();
  ctx.fillStyle = '#3b3436';
  blobPath(ctx, o.x, o.y, rx, ry, o.shape); ctx.fill();
  ctx.fillStyle = '#1a1517';
  blobPath(ctx, o.x + 2 * s, o.y + 3 * s, rx * 0.72, ry * 0.68, o.shape); ctx.fill();
  ctx.fillStyle = '#6b6058';
  for (let i = 0; i < 4; i++) { ctx.fillRect(o.x - rx * 0.4 + i * rx * 0.25, o.y + ((i * 7) % 5 - 2) * s, 2.5 * s, 2.5 * s); }
  ctx.strokeStyle = '#2a2527'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(o.x - rx, o.y - 2 * s); ctx.lineTo(o.x - rx - 10 * s, o.y - 8 * s); ctx.lineTo(o.x - rx - 16 * s, o.y - 4 * s);
  ctx.moveTo(o.x + rx * 0.7, o.y + ry * 0.6); ctx.lineTo(o.x + rx + 8 * s, o.y + ry + 6 * s);
  ctx.stroke();
}

function drawPuddle(ctx, o, s, t) {
  ctx.fillStyle = 'rgba(92,120,140,.85)';
  blobPath(ctx, o.x, o.y, o.w / 2, o.h / 2, o.shape); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(o.x - o.w * 0.15, o.y - o.h * 0.15, o.w * 0.18, o.h * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.2;
  const r = ((t * 0.8 + o.seed) % 1) * o.w * 0.3;
  ctx.beginPath(); ctx.ellipse(o.x + o.w * 0.1, o.y + o.h * 0.05, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
}

function drawCone(ctx, o, s) {
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.spin) ctx.rotate(o.spin);
  shadow(ctx, 4 * s, 4 * s, 14 * s, 12 * s, 0.25);
  ctx.fillStyle = '#e8590c'; rr(ctx, -13 * s, -13 * s, 26 * s, 26 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(0, 0, 10 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(0, 0, 6 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e8590c'; ctx.beginPath(); ctx.arc(0, 0, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGranny(ctx, o, s, t) {
  drawPerson(ctx, o.x, o.y, s, t, { shirt: '#6c5ce7', hat: 'scarf', tool: 'bag' }, { run: true });
  ctx.fillStyle = '#7a4fb5'; rr(ctx, o.x + (o.vx >= 0 ? -26 : 14) * s, o.y - 6 * s, 12 * s, 16 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(o.x + (o.vx >= 0 ? -20 : 20) * s, o.y + 11 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
}

function drawRoller(ctx, o, s) {
  ctx.save();
  ctx.translate(o.x, o.y);
  shadow(ctx, 5 * s, 6 * s, 30 * s, 40 * s, 0.25);
  ctx.fillStyle = '#666'; rr(ctx, -28 * s, 16 * s, 56 * s, 20 * s, 8 * s); ctx.fill();
  ctx.fillStyle = '#f2b80c'; rr(ctx, -24 * s, -34 * s, 48 * s, 52 * s, 8 * s); ctx.fill();
  ctx.strokeStyle = '#b5850a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#bfe6ff'; rr(ctx, -16 * s, -26 * s, 32 * s, 18 * s, 4 * s); ctx.fill();
  ctx.fillStyle = '#222'; rr(ctx, -27 * s, -34 * s, 10 * s, 18 * s, 3 * s); ctx.fill(); rr(ctx, 17 * s, -34 * s, 10 * s, 18 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#333'; ctx.font = `bold ${8 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('КРАСНОАРМЕЙКА', 0, 8 * s, 42 * s);
  ctx.restore();
}

function drawBottle(ctx, x, y, s, spin, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#2e8b57'; rr(ctx, -4 * s, -10 * s, 8 * s, 18 * s, 3 * s); ctx.fill();
  ctx.fillRect(-2 * s, -16 * s, 4 * s, 7 * s);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-2 * s, -7 * s, 1.5 * s, 10 * s);
  ctx.fillStyle = '#f4d03f'; ctx.fillRect(-4 * s, -2 * s, 8 * s, 5 * s);
  ctx.restore();
}

function drawGlass(ctx, o, s) {
  ctx.fillStyle = 'rgba(46,139,87,.85)';
  for (let i = 0; i < 7; i++) {
    const a = o.seed + i * 0.9, r = (6 + (i * 5) % 9) * s;
    const x = o.x + Math.cos(a) * r * 1.4, y = o.y + Math.sin(a) * r * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.lineTo(x + 4 * s, y + 2 * s); ctx.lineTo(x - 3 * s, y + 3 * s); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.arc(o.x, o.y, 1.5 * s, 0, Math.PI * 2); ctx.fill();
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
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(0, 0, 19 * s, 0, Math.PI * 2); ctx.fill();
  ctx.font = `${26 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, 1 * s);
  ctx.restore();
}

/* ---------- Обочина: природа ---------- */
function drawTree(ctx, x, y, s, kind) {
  if (kind === 'bush') {
    ctx.fillStyle = '#3f7f34';
    ctx.beginPath(); ctx.arc(x - 6 * s, y, 9 * s, 0, Math.PI * 2); ctx.arc(x + 6 * s, y + 2 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (kind === 'poplar') {
    shadow(ctx, x + 8 * s, y + 6 * s, 10 * s, 24 * s, 0.18);
    ctx.fillStyle = '#2d5f27'; ctx.beginPath(); ctx.ellipse(x, y, 9 * s, 24 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3d7a33'; ctx.beginPath(); ctx.ellipse(x - 2 * s, y - 4 * s, 5 * s, 16 * s, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  shadow(ctx, x + 6 * s, y + 7 * s, 19 * s, 17 * s, 0.18);
  ctx.fillStyle = kind === 'fruit' ? '#3c7d2f' : '#2f6b2a';
  ctx.beginPath(); ctx.arc(x, y, 18 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3f8a37'; ctx.beginPath(); ctx.arc(x - 5 * s, y - 5 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
  if (kind === 'fruit') {
    ctx.fillStyle = '#e74c3c';
    [[6, 4], [-8, 6], [2, -9], [9, -4]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(x + a * s, y + b * s, 2.2 * s, 0, Math.PI * 2); ctx.fill(); });
  }
}

function drawSunflowers(ctx, x, y, s, o) {
  ctx.fillStyle = '#4f7a2a'; ctx.fillRect(x - o.w / 2, y - o.h / 2, o.w, o.h);
  for (let yy = -o.h / 2 + 6 * s; yy < o.h / 2; yy += 11 * s) {
    for (let xx = -o.w / 2 + 6 * s; xx < o.w / 2; xx += 11 * s) {
      ctx.fillStyle = '#f7c600'; ctx.beginPath(); ctx.arc(x + xx, y + yy, 4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b3e12'; ctx.beginPath(); ctx.arc(x + xx, y + yy, 1.8 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/* ---------- Обочина: постройки ---------- */
function drawHouse(ctx, x, y, s, o) {
  const w = o.w, h = o.h;
  // двор с забором
  ctx.fillStyle = '#86a957'; ctx.fillRect(x - w * 0.8, y - h * 0.9, w * 1.6, h * 1.8);
  ctx.strokeStyle = o.fence; ctx.lineWidth = 2 * s; ctx.setLineDash([3 * s, 3 * s]);
  ctx.strokeRect(x - w * 0.8, y - h * 0.9, w * 1.6, h * 1.8); ctx.setLineDash([]);
  shadow(ctx, x + 6 * s, y + 6 * s, w * 0.55, h * 0.55, 0.2);
  ctx.fillStyle = o.wall; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  // двускатная крыша
  ctx.fillStyle = o.roof; ctx.fillRect(x - w / 2 - 3 * s, y - h / 2 - 3 * s, w + 6 * s, h / 2 + 3 * s);
  ctx.fillStyle = o.roof2; ctx.fillRect(x - w / 2 - 3 * s, y, w + 6 * s, h / 2 + 3 * s);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 3 * s, y); ctx.lineTo(x + w / 2 + 3 * s, y); ctx.stroke();
  ctx.fillStyle = '#7f3b28'; ctx.fillRect(x + w * 0.2, y - h * 0.35, 6 * s, 6 * s);
  // жёлтая газовая труба вдоль забора — классика Кубани
  ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2.5 * s;
  ctx.beginPath(); ctx.moveTo(x - w * 0.8, y + h * 0.95); ctx.lineTo(x + w * 0.8, y + h * 0.95); ctx.stroke();
}

function drawWell(ctx, x, y, s) {
  shadow(ctx, x + 3 * s, y + 3 * s, 10 * s, 10 * s, 0.2);
  ctx.fillStyle = '#9b8b7a'; ctx.beginPath(); ctx.arc(x, y, 9 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(x, y, 5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x - 12 * s, y - 2 * s, 24 * s, 4 * s);
}

function drawBlock(ctx, x, y, s, o) {
  shadow(ctx, x + 10 * s, y + 10 * s, o.w * 0.55, o.h * 0.55, 0.25);
  ctx.fillStyle = '#c9c3b6'; ctx.fillRect(x - o.w / 2, y - o.h / 2, o.w, o.h);
  ctx.fillStyle = '#8d8f94'; ctx.fillRect(x - o.w / 2 + 4 * s, y - o.h / 2 + 4 * s, o.w - 8 * s, o.h - 8 * s);
  ctx.fillStyle = '#6e7075';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - o.w / 2 + (12 + i * (o.w / s - 24) / 3) * s, y - 4 * s, 7 * s, 7 * s);
  ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(x + o.w * 0.3, y - o.h * 0.25, 4 * s, 0, Math.PI * 2); ctx.fill();
}

function drawShop(ctx, x, y, s, o, side) {
  shadow(ctx, x + 6 * s, y + 6 * s, o.w * 0.55, o.h * 0.55, 0.22);
  ctx.fillStyle = '#d6d0c4'; ctx.fillRect(x - o.w / 2, y - o.h / 2, o.w, o.h);
  ctx.fillStyle = '#b9b3a6'; ctx.fillRect(x - o.w / 2 + 3 * s, y - o.h / 2 + 3 * s, o.w - 6 * s, o.h - 6 * s);
  // вывеска со стороны дороги
  const sx = side < 0 ? x + o.w / 2 - 12 * s : x - o.w / 2;
  ctx.fillStyle = o.color; ctx.fillRect(sx, y - o.h / 2, 12 * s, o.h);
  ctx.save();
  ctx.translate(sx + 6 * s, y);
  ctx.rotate(side < 0 ? Math.PI / 2 : -Math.PI / 2);
  ctx.fillStyle = '#fff'; ctx.font = `900 ${8 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(o.text, 0, 0, o.h - 6 * s);
  ctx.restore();
}

function drawClub(ctx, x, y, s, o, side, t) {
  shadow(ctx, x + 8 * s, y + 8 * s, o.w * 0.55, o.h * 0.55, 0.25);
  ctx.fillStyle = '#2b1d3a'; ctx.fillRect(x - o.w / 2, y - o.h / 2, o.w, o.h);
  ctx.fillStyle = '#3d2a52'; ctx.fillRect(x - o.w / 2 + 4 * s, y - o.h / 2 + 4 * s, o.w - 8 * s, o.h - 8 * s);
  const sx = side < 0 ? x + o.w / 2 - 14 * s : x - o.w / 2;
  ctx.save();
  ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 12 + Math.sin(t * 10) * 6;
  ctx.fillStyle = Math.sin(t * 7) > -0.7 ? '#ff4fe0' : '#8a2a7c';
  ctx.fillRect(sx, y - o.h / 2 + 4 * s, 14 * s, o.h - 8 * s);
  ctx.restore();
  ctx.save();
  ctx.translate(sx + 7 * s, y);
  ctx.rotate(side < 0 ? Math.PI / 2 : -Math.PI / 2);
  ctx.fillStyle = '#fff'; ctx.font = `900 ${8 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('КЛУБ «ОТБОЙНИК»', 0, 0, o.h - 10 * s);
  ctx.restore();
}

function drawCar(ctx, x, y, s, color) {
  shadow(ctx, x + 3 * s, y + 4 * s, 12 * s, 22 * s, 0.25);
  ctx.fillStyle = color; rr(ctx, x - 10 * s, y - 20 * s, 20 * s, 40 * s, 6 * s); ctx.fill();
  ctx.fillStyle = '#2c3e50'; rr(ctx, x - 8 * s, y - 11 * s, 16 * s, 8 * s, 2 * s); ctx.fill(); rr(ctx, x - 8 * s, y + 7 * s, 16 * s, 6 * s, 2 * s); ctx.fill();
}

function drawLamp(ctx, x, y, s, dirToRoad) {
  ctx.strokeStyle = '#555'; ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dirToRoad * 14 * s, y); ctx.stroke();
  ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(x, y, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,170,.9)'; ctx.beginPath(); ctx.arc(x + dirToRoad * 14 * s, y, 3 * s, 0, Math.PI * 2); ctx.fill();
}

function drawPole(ctx, x, y, s) {
  ctx.fillStyle = '#7b5b3a'; ctx.beginPath(); ctx.arc(x, y, 3.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5b4128'; ctx.fillRect(x - 10 * s, y - 1.5 * s, 20 * s, 3 * s);
}

function drawKmPost(ctx, x, y, s, km) {
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 6 * s, y - 8 * s, 12 * s, 14 * s);
  ctx.fillStyle = '#111'; ctx.fillRect(x - 6 * s, y - 8 * s, 12 * s, 3 * s);
  ctx.font = `bold ${7 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(km, x, y + 1 * s);
}

/* ---------- Дорожные знаки ---------- */
function drawSign(ctx, x, y, s, kind, val) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#777'; ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 16 * s); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(4 * s, 18 * s, 8 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
  const R = 12 * s;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tri = () => {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d0021b'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(0, -R * 1.2); ctx.lineTo(R * 1.1, R * 0.7); ctx.lineTo(-R * 1.1, R * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  switch (kind) {
    case 'limit':
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -4 * s, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d0021b'; ctx.lineWidth = 3.5 * s; ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = `900 ${11 * s}px sans-serif`; ctx.fillText(val, 0, -3.5 * s);
      break;
    case 'curveL': case 'curveR':
      tri();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.moveTo(0, 5 * s); ctx.lineTo(0, -1 * s);
      ctx.quadraticCurveTo(0, -6 * s, (kind === 'curveL' ? -6 : 6) * s, -6 * s); ctx.stroke();
      break;
    case 'works':
      tri();
      ctx.font = `${11 * s}px sans-serif`; ctx.fillText('🚧', 0, 0);
      break;
    case 'kids':
      tri();
      ctx.font = `${10 * s}px sans-serif`; ctx.fillText('🚸', 0, 0);
      break;
    case 'bump':
      tri();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, 3 * s, 6 * s, 3.5 * s, 0, Math.PI, 0); ctx.fill();
      break;
    case 'crossing':
      ctx.fillStyle = '#1565c0'; ctx.fillRect(-R, -R - 4 * s, R * 2, R * 2);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(R * 0.8, R * 0.55 - 4 * s); ctx.lineTo(-R * 0.8, R * 0.55 - 4 * s); ctx.closePath(); ctx.fill();
      ctx.font = `${9 * s}px sans-serif`; ctx.fillText('🚶', 0, -3 * s);
      break;
    case 'camera':
      ctx.fillStyle = '#1565c0'; ctx.fillRect(-R, -R - 4 * s, R * 2, R * 1.6);
      ctx.font = `${12 * s}px sans-serif`; ctx.fillText('📷', 0, -7 * s);
      ctx.fillStyle = '#333'; ctx.fillRect(6 * s, -R - 10 * s, 10 * s, 6 * s);
      break;
    case 'city': case 'cityEnd': {
      ctx.font = `900 ${8 * s}px sans-serif`;
      const w = Math.min(110 * s, ctx.measureText(val).width + 12 * s);
      ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2, -R - 6 * s, w, R * 1.8);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5 * s; ctx.strokeRect(-w / 2 + 2 * s, -R - 4 * s, w - 4 * s, R * 1.8 - 4 * s);
      ctx.fillStyle = '#111'; ctx.fillText(val, 0, -R * 0.1 - 6 * s + R * 0.9 * 0.5 + 2 * s, w - 10 * s);
      if (kind === 'cityEnd') {
        ctx.strokeStyle = '#d0021b'; ctx.lineWidth = 2.5 * s;
        ctx.beginPath(); ctx.moveTo(-w / 2, R * 0.8 - 6 * s); ctx.lineTo(w / 2, -R - 6 * s); ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

// Въездная арка с названием населённого пункта
function drawArch(ctx, x1, x2, y, s, text, town) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x1 + 6 * s, y + 4 * s, x2 - x1, 26 * s);
  ctx.fillStyle = town ? '#7f8c8d' : '#8d6e63';
  ctx.fillRect(x1 - 6 * s, y - 16 * s, 12 * s, 36 * s); ctx.fillRect(x2 - 6 * s, y - 16 * s, 12 * s, 36 * s);
  ctx.fillStyle = town ? '#1565c0' : '#2e7d32'; rr(ctx, x1, y - 14 * s, x2 - x1, 28 * s, 5 * s); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * s; rr(ctx, x1 + 3 * s, y - 11 * s, x2 - x1 - 6 * s, 22 * s, 4 * s); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `900 ${12 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, (x1 + x2) / 2, y, x2 - x1 - 16 * s);
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
