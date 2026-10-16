'use strict';

/* ================= Настройки ================= */
const KM = 10000;                 // столько «единиц пути» в одном километре
const STORE = 'valera-roads-v1';
const DEF = { career: 0, bank: 0, best: 0, bestKm: 0, bike: 'moped', owned: ['moped'], ach: [], geese: 0, shifts: 0, sound: true, mat: false, tutorial: false };

/* ================= Сохранение ================= */
function load() {
  try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(STORE)) || {}); }
  catch (e) { return Object.assign({}, DEF); }
}
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) { /* без сохранения тоже играем */ }
}
const save = load();

/* ================= Помощники ================= */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const txt = pair => pair[save.mat ? 1 : 0];
const say = key => txt(pick(PHRASES[key]));
const bikeById = id => BIKES.find(b => b.id === id) || BIKES[0];
function careerIndex(xp) {
  let i = 0;
  while (i + 1 < CAREER.length && xp >= CAREER[i + 1].at) i++;
  return i;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}

/* ================= Звуки (синтез, без файлов) ================= */
let audio = null, noiseBuf = null, engine = null;
function ac() {
  if (!save.sound) return null;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  } catch (e) { return null; }
}
function tone(f, start, dur, o = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(start, dur, o = {}) {
  const a = ac(); if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + start;
  const src = a.createBufferSource(); src.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.value = o.freq || 800;
  const g = a.createGain();
  g.gain.setValueAtTime(o.vol || 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t); src.stop(t + dur + 0.05);
}
const sfx = {
  bump()   { noise(0, 0.35, { freq: 500, vol: 0.6 }); tone(140, 0, 0.3, { type: 'square', to: 45, vol: 0.18 }); },
  repair() { noise(0, 0.12, { freq: 300, vol: 0.5 }); tone(1320, 0.08, 0.25, { vol: 0.1 }); tone(1760, 0.14, 0.3, { vol: 0.08 }); },
  coin()   { tone(988, 0, 0.08, { type: 'square', vol: 0.06 }); tone(1319, 0.07, 0.15, { type: 'square', vol: 0.06 }); },
  bucket() { tone(330, 0, 0.18, { type: 'triangle', to: 880, vol: 0.18 }); },
  cone()   { noise(0, 0.15, { freq: 1500, filter: 'bandpass', vol: 0.4 }); tone(500, 0, 0.12, { type: 'triangle', to: 900, vol: 0.1 }); },
  honk()   { [0, 0.2].forEach(s => tone(620, s, 0.15, { type: 'square', to: 470, vol: 0.12 })); },
  lane()   { tone(220, 0, 0.05, { type: 'triangle', vol: 0.05 }); },
  dud()    { tone(150, 0, 0.15, { type: 'square', vol: 0.06 }); },
  heal()   { [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.15, { type: 'triangle', vol: 0.14 })); },
  energy() { tone(200, 0, 0.6, { type: 'sawtooth', to: 1200, vol: 0.08 }); },
  event()  { [0, 0.25].forEach(s => { tone(392, s, 0.2, { type: 'sawtooth', vol: 0.07 }); tone(494, s, 0.2, { type: 'sawtooth', vol: 0.06 }); }); },
  ring()   { for (let i = 0; i < 6; i++) tone(i % 2 ? 1100 : 1400, i * 0.1, 0.09, { type: 'square', vol: 0.05 }); },
  over()   { [466, 440, 415].forEach((f, i) => tone(f, i * 0.45, 0.42, { type: 'sawtooth', vol: 0.08 })); tone(392, 1.35, 1.1, { type: 'sawtooth', to: 370, vol: 0.08 }); },
  stamp()  { noise(0, 0.2, { freq: 300, vol: 0.7 }); },
};
function engineStart() {
  const a = ac(); if (!a || engine) return;
  const osc = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
  osc.type = 'sawtooth'; osc.frequency.value = 55;
  f.type = 'lowpass'; f.frequency.value = 380;
  g.gain.value = 0.035;
  osc.connect(f).connect(g).connect(a.destination);
  osc.start();
  engine = { osc, g };
}
function engineSet(speed) { if (engine && audio) engine.osc.frequency.setTargetAtTime(40 + speed * 0.09, audio.currentTime, 0.2); }
function engineStop() { if (engine) { try { engine.osc.stop(); } catch (e) { /* уже остановлен */ } engine = null; } }

/* ================= Холст ================= */
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, roadX = 0, roadW = 0, laneW = 0, S = 1;

function resize() {
  const oldH = H;
  W = cv.clientWidth; H = cv.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  roadW = Math.min(W * 0.76, 430);
  roadX = (W - roadW) / 2;
  laneW = roadW / 3;
  S = laneW / 86;
  if (g && oldH && oldH !== H) {
    const k = H / oldH;
    g.objs.forEach(o => { o.y *= k; });
    g.decor.forEach(o => { o.y *= k; });
  }
}
window.addEventListener('resize', () => { if ($('game').classList.contains('active')) resize(); });

const laneX = lx => roadX + lx * laneW;
const playerY = () => H * 0.8;

/* ================= Смена (игра) ================= */
let g = null;
let raf = 0, lastT = 0;

function newGame() {
  const bike = bikeById(save.bike);
  g = {
    bike, t: 0, dist: 0, bonus: 0, coins: 0,
    repairs: 0, holesHit: 0, dodged: 0, cones: 0, geese: 0, grannies: 0, shawarma: 0,
    helmets: bike.helmets, asphalt: 1,
    stage: 0, lane: 1, lx: 1.5, lean: 0,
    hurt: 0, inv: 0, energy: 0, goose: 0, headTilt: 0, shake: 0, splash: 0, splashBlobs: [],
    objs: [], decor: [], parts: [], floats: [],
    nextRow: 120, nextDecor: 0, nextBanner: 3500, nextCrack: 0,
    event: null, eventT: 0, nextEvent: rand(22, 32),
    bubbleT: 0, lastSay: -9, eventShownT: 0,
    over: false, overT: 0, paused: false,
  };
}

function startGame() {
  showScreen('game');
  resize();
  newGame();
  $('ovl').classList.add('hidden');
  $('bubble').classList.add('hidden');
  $('eventBanner').classList.add('hidden');
  updateHud(true);
  if (!save.tutorial) {
    showHowTo(true);
  } else {
    engineStart();
  }
  lastT = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (g) {
    if (!g.paused) update(dt);
    draw();
  }
  raf = requestAnimationFrame(loop);
}

function currentSpeed() {
  const st = STAGES[g.stage];
  const km = g.dist / KM;
  let v = st.speed * (1 + Math.min(0.18, (km - st.km) * 0.06));
  if (g.energy > 0) v *= 1.35;
  if (g.over) v *= Math.max(0, 1 - g.overT * 1.5);
  return v;
}

function update(dt) {
  g.t += dt;
  const v = currentSpeed();
  const dy = v * S * dt;
  g.dist += v * dt;
  engineSet(v);
  const km = g.dist / KM;

  // смена этапа — звонит начальник
  const next = STAGES[g.stage + 1];
  if (next && km >= next.km && !g.over) {
    g.stage++;
    bossCall(g.stage);
  }

  // новые ряды препятствий
  g.nextRow -= v * dt;
  if (g.nextRow <= 0 && !g.over) {
    spawnRow();
    g.nextRow = Math.max(175, 270 - g.stage * 18) * rand(0.85, 1.2);
  }
  // обочина
  g.nextDecor -= v * dt;
  if (g.nextDecor <= 0) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const margin = roadX;
    const x = side < 0 ? rand(margin * 0.15, margin * 0.8) : W - rand(margin * 0.15, margin * 0.8);
    g.decor.push({ kind: Math.random() < 0.6 ? 'tree' : 'bush', x, y: -40 * S });
    g.nextDecor = rand(60, 140);
  }
  g.nextCrack -= v * dt;
  if (g.nextCrack <= 0) {
    g.decor.push({ kind: 'crack', x: laneX(rand(0.2, 2.8)), y: -30 * S, a: rand(0, Math.PI), l: rand(14, 30) });
    g.nextCrack = rand(80, 200);
  }
  g.nextBanner -= v * dt;
  if (g.nextBanner <= 0) {
    g.decor.push({ kind: 'banner', y: -60 * S, text: pick(BANNERS) });
    g.nextBanner = rand(9000, 14000);
  }

  // движение объектов
  const py = playerY();
  for (const o of g.objs) {
    o.y += dy * (o.type === 'roller' ? 0.5 : 1);
    if (o.vx) o.lx += o.vx * dt;
    if (o.fly) { o.y += o.fly.vy * dt; o.lx += o.fly.vx * dt; o.spin += dt * 10; }
    if (!o.counted && o.y > py + 40 * S) {
      o.counted = true;
      if ((o.type === 'pothole') && !o.fixed && !o.hitDone) g.dodged++;
    }
  }
  g.objs = g.objs.filter(o => o.y < H + 90 * S && o.y > -400 * S && o.lx > -2 && o.lx < 5);
  for (const d of g.decor) d.y += dy;
  g.decor = g.decor.filter(d => d.y < H + 80 * S);

  // игрок
  const tx = g.lane + 0.5;
  const diff = tx - g.lx;
  g.lx += diff * Math.min(1, dt * g.bike.lane);
  g.lean = clamp(diff * 2.5, -1, 1);
  g.headTilt = g.hurt > 0 ? Math.sin(g.t * 40) * 0.35 * g.hurt : Math.sin(g.t * 3) * 0.06;

  // таймеры
  g.hurt = Math.max(0, g.hurt - dt);
  g.inv = Math.max(0, g.inv - dt);
  g.energy = Math.max(0, g.energy - dt);
  g.goose = Math.max(0, g.goose - dt);
  g.shake = Math.max(0, g.shake - dt);
  g.splash = Math.max(0, g.splash - dt);
  if (g.bubbleT > 0) { g.bubbleT -= dt; if (g.bubbleT <= 0) $('bubble').classList.add('hidden'); }

  // события
  if (g.event) {
    g.eventT -= dt;
    if (g.eventT <= 0) { g.event = null; $('eventBanner').classList.add('hidden'); }
  } else if (!g.over) {
    g.nextEvent -= dt;
    if (g.nextEvent <= 0) startEvent();
  }

  // столкновения
  if (!g.over) {
    const px = laneX(g.lx);
    const phw = (g.bike.special === 'roller' ? 24 : 12) * S, phh = 34 * S, pcy = py - 6 * S;
    for (const o of g.objs) {
      if (o.hitDone || o.fixed) continue;
      const b = hitBox(o);
      if (Math.abs(laneX(o.lx) - px) < b.hw + phw && Math.abs(o.y - pcy) < b.hh + phh) collide(o);
    }
  } else {
    g.overT += dt;
  }

  // частицы и надписи
  for (const p of g.parts) { p.x += p.vx * dt; p.y += p.vy * dt + dy; p.vy += 600 * dt; p.life -= dt; }
  g.parts = g.parts.filter(p => p.life > 0);
  for (const f of g.floats) { f.y -= 50 * dt; f.life -= dt; }
  g.floats = g.floats.filter(f => f.life > 0);

  updateHud();
}

/* ---------- Появление препятствий ---------- */
const BANNERS = [
  'РЕМОНТ ДОРОГИ: 2007 — ∞',
  'ЗДЕСЬ МОГЛА БЫТЬ ВАША ДОРОГА',
  'ДОРОГА ГОДА — 2009',
  'СПАСИБО ЗА ТЕРПЕНИЕ (НЕТ)',
  'ОСТОРОЖНО: ВАЛЕРА',
  'ООО «КРАСНОАРМЕЙКА»: МЫ СТАРАЛИСЬ',
  '«КРАСНОАРМЕЙКА» — ДОРОГИ НА ВЕКА*',
  'ВАЛЕРА, ЗАЙДИ В БУХГАЛТЕРИЮ',
  'НАЦПРОЕКТ «ЯМЫ»',
];

function weighted(mix) {
  const entries = Object.entries(mix).filter(([, w]) => w > 0);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[0][0];
}

function makeObj(type, lane, extra = {}) {
  const o = { type, lx: lane + 0.5, y: -70 * S - rand(0, 30) * S, seed: rand(0, 6), shape: randomShape(), spin: 0, ...extra };
  if (type === 'pothole') { o.w = laneW * rand(0.5, 0.74); o.h = o.w * rand(0.55, 0.8); }
  if (type === 'puddle') { o.w = laneW * rand(0.6, 0.82); o.h = o.w * rand(0.5, 0.7); }
  return o;
}

function spawnRow() {
  const st = STAGES[g.stage];
  const mix = Object.assign({}, st.mix);
  if (g.event === 'rain') mix.puddle += 7;
  if (g.event === 'geese') mix.goose += 8;
  if (g.event === 'commission') mix.pothole += 4;
  // полосы, которые ещё занимает медленный каток, считаем занятыми — всегда должен оставаться проезд
  const rollers = g.objs.filter(o => o.type === 'roller' && !o.hitDone && o.y < playerY());
  const blocked = new Set(rollers.map(o => Math.floor(o.lx)));
  if (rollers.length) mix.roller = 0;
  const avail = shuffle([0, 1, 2].filter(l => !blocked.has(l)));
  const maxObs = avail.length - 1;
  const type = weighted(mix);
  let free = avail.slice();

  if (type === 'goose' || (type === 'granny' && !blocked.size)) {
    // переходят дорогу поперёк
    const fromLeft = Math.random() < 0.5;
    const speed = type === 'goose' ? rand(0.9, 1.5) : rand(0.35, 0.55);
    g.objs.push(makeObj(type, 0, { lx: fromLeft ? -0.4 : 3.4, vx: fromLeft ? speed : -speed }));
  } else if (type === 'pothole' && !blocked.size && Math.random() < 0.14) {
    // огромная яма на две полосы
    const start = Math.random() < 0.5 ? 0 : 1;
    const o = makeObj('pothole', start, { lx: start + 1, big: true });
    o.w = laneW * 1.7; o.h = laneW * 0.62;
    g.objs.push(o);
    free = [start === 0 ? 2 : 0];
  } else if (maxObs > 0) {
    const count = Math.min(maxObs, Math.random() < 0.12 + g.stage * 0.1 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      let tp = i === 0 ? type : weighted(mix);
      if (tp === 'goose' || tp === 'granny') tp = 'pothole';
      if (tp === 'roller' && i > 0) tp = 'cone';
      const extra = {};
      if (tp === 'puddle') extra.hidden = Math.random() < (g.event === 'rain' ? 0.7 : 0.4);
      g.objs.push(makeObj(tp, avail[i], extra));
    }
    free = avail.slice(count);
  }

  // бонусы в свободных полосах
  if (free.length) {
    const lane = pick(free);
    const r = Math.random();
    const bucketChance = g.asphalt === 0 ? 0.55 : 0.3;
    if (r < bucketChance) g.objs.push(makeObj('bucket', lane, { y: -120 * S }));
    else if (r < bucketChance + 0.3) {
      for (let i = 0; i < 3; i++) g.objs.push(makeObj('coin', lane, { y: -110 * S - i * 38 * S }));
    } else if (r < bucketChance + 0.34 && g.helmets < g.bike.helmets) g.objs.push(makeObj('shawarma', lane, { y: -120 * S }));
    else if (r < bucketChance + 0.36) g.objs.push(makeObj('energy', lane, { y: -120 * S }));
  }
}

function hitBox(o) {
  switch (o.type) {
    case 'pothole': return { hw: o.w * 0.33, hh: o.h * 0.3 };
    case 'puddle': return { hw: o.w * 0.35, hh: o.h * 0.3 };
    case 'cone': return { hw: 11 * S, hh: 11 * S };
    case 'goose': return { hw: 14 * S, hh: 10 * S };
    case 'granny': return { hw: 18 * S, hh: 16 * S };
    case 'roller': return { hw: 24 * S, hh: 34 * S };
    default: return { hw: 16 * S, hh: 16 * S };
  }
}

/* ---------- Столкновения ---------- */
function collide(o) {
  const x = laneX(o.lx);
  switch (o.type) {
    case 'bucket':
      o.hitDone = true; o.y = H * 3;
      if (g.asphalt < g.bike.asphalt) { g.asphalt++; float(x, o.y, '+🪣'); } else { g.bonus += 20; float(x, playerY() - 60 * S, 'Склад полон +20'); }
      sfx.bucket();
      break;
    case 'coin':
      o.hitDone = true; o.y = H * 3;
      g.coins++; sfx.coin();
      float(x, playerY() - 50 * S, '+10 ₽', '#ffcc00');
      break;
    case 'shawarma':
      o.hitDone = true; o.y = H * 3;
      g.helmets = Math.min(g.bike.helmets, g.helmets + 1); g.shawarma++;
      sfx.heal(); talk(say('shawarma'), true);
      break;
    case 'energy':
      o.hitDone = true; o.y = H * 3;
      g.energy = 5; sfx.energy(); talk(say('energy'), true);
      break;
    case 'pothole':
    case 'puddle':
      if (g.bike.special === 'roller') { fix(o, true); break; }
      o.hitDone = true;
      if (o.type === 'puddle') {
        g.splash = 1.8; g.splashBlobs = makeSplash();
        if (!o.hidden) { talk(say('splash')); noise(0, 0.3, { freq: 1200, filter: 'bandpass', vol: 0.4 }); break; }
      }
      damage('pothole', x, o.y);
      g.holesHit++;
      break;
    case 'cone':
      o.hitDone = true; o.hit = true;
      o.fly = { vx: rand(-4, 4), vy: -rand(500, 800) * S };
      g.cones++; g.bonus = Math.max(-1000, g.bonus - 10);
      sfx.cone();
      if (Math.random() < 0.6) talk(say('cone'));
      float(x, o.y, '−10');
      break;
    case 'goose':
      o.hitDone = true;
      o.fly = { vx: o.vx * 3, vy: -900 * S };
      if (g.energy > 0) { float(x, o.y, 'Гусь улетел'); break; }
      g.goose = 4; g.geese++;
      sfx.honk(); talk(say('goose'), true);
      g.shake = 0.3;
      break;
    case 'granny':
      o.hitDone = true; o.vx *= 0.3;
      if (damage('granny', x, o.y)) g.grannies++;
      break;
    case 'roller':
      o.hitDone = true;
      damage('roller', x, o.y);
      break;
  }
}

function damage(kind, x, y) {
  if (g.inv > 0 || g.energy > 0) return false;
  g.helmets--;
  g.hurt = 0.9; g.inv = 1.4; g.shake = 0.45;
  sfx.bump();
  talk(say(kind), true);
  burst(laneX(g.lx), playerY() - 20 * S, '#2a2a2a', 14);
  if (g.helmets <= 0) {
    g.over = true; g.overT = 0;
    engineStop();
    sfx.over();
    setTimeout(finishGame, 1600);
  }
  return true;
}

/* ---------- Ремонт ---------- */
function fix(o, auto) {
  o.fixed = true;
  g.repairs++;
  const pts = g.event === 'commission' ? 150 : 50;
  g.bonus += pts;
  const x = laneX(o.lx);
  float(x, o.y - 10 * S, '+' + pts, g.event === 'commission' ? '#ffcc00' : '#fff');
  burst(x, o.y, '#222', 10);
  sfx.repair();
  if (o.type === 'puddle') talk(txt(PHRASES.repair[3]));
  else if (!auto && Math.random() < 0.35) talk(say('repair'));
}

function tryRepair(o) {
  if (g.asphalt <= 0) {
    sfx.dud();
    if (g.t - g.lastSay > 1.5) talk(say('noAsphalt'), true);
    return;
  }
  g.asphalt--;
  fix(o, false);
}

function repairTargetAt(x, y) {
  let best = null, bd = Infinity;
  for (const o of g.objs) {
    if ((o.type !== 'pothole' && o.type !== 'puddle') || o.fixed || o.hitDone) continue;
    const ox = laneX(o.lx);
    if (Math.abs(x - ox) < o.w / 2 + 22 * S && Math.abs(y - o.y) < o.h / 2 + 22 * S) {
      const d = Math.hypot(x - ox, y - o.y);
      if (d < bd) { bd = d; best = o; }
    }
  }
  return best;
}

function nearestAhead() {
  const py = playerY();
  let best = null;
  for (const o of g.objs) {
    if ((o.type !== 'pothole' && o.type !== 'puddle') || o.fixed || o.hitDone) continue;
    if (o.y < py - 10 * S && o.y > 0 && (!best || o.y > best.y)) best = o;
  }
  return best;
}

function move(dir) {
  if (!g || g.paused || g.over) return;
  if (g.goose > 0) dir = -dir;
  const nl = clamp(g.lane + dir, 0, 2);
  if (nl !== g.lane) { g.lane = nl; sfx.lane(); }
}

/* ---------- Эффекты ---------- */
function float(x, y, text, color = '#fff') { g.floats.push({ x, y, text, color, life: 1.1 }); }
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) g.parts.push({ x, y, vx: rand(-160, 160), vy: rand(-320, -80), life: rand(0.4, 0.8), color, r: rand(2, 5) * S });
}
function makeSplash() {
  return Array.from({ length: 9 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(40, 110), shape: randomShape(10) }));
}
function talk(text, force) {
  if (!force && g.t - g.lastSay < 1.2) return;
  g.lastSay = g.t;
  const b = $('bubble');
  b.textContent = '🗯️ ' + text;
  b.classList.remove('hidden');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  g.bubbleT = 2.4;
}

function startEvent() {
  const ev = pick(['commission', 'rain', 'geese']);
  g.event = ev;
  g.eventT = ev === 'rain' ? 12 : 10;
  g.nextEvent = rand(28, 42);
  const text = {
    commission: '🕴️ Приехала комиссия! Заплатки ×3',
    rain: '🌧️ Дождь! Ямы прячутся под лужами',
    geese: '🦆 Гусиная миграция!',
  }[ev];
  const banner = $('eventBanner');
  banner.textContent = text;
  banner.classList.remove('hidden');
  sfx.event();
}

/* ---------- Пауза, звонки, обучение ---------- */
function openDialog(html) {
  $('dialog').innerHTML = html;
  $('ovl').classList.remove('hidden');
}
function closeDialog() { $('ovl').classList.add('hidden'); }

function pauseGame() {
  if (!g || g.over || g.paused) return;
  g.paused = true;
  engineStop();
  openDialog(`<h3>🚬 Перекур</h3>
    <p>Смена на паузе. Петрович не видит.</p>
    <button class="btn btn-go" id="resumeBtn" type="button">Работаем дальше</button>
    <button class="btn" id="quitBtn" type="button">Уйти со смены</button>`);
  $('resumeBtn').onclick = resumeGame;
  $('quitBtn').onclick = () => { closeDialog(); g = null; renderMenu(); showScreen('menu'); };
}
function resumeGame() {
  closeDialog();
  if (!g) return;
  g.paused = false;
  lastT = performance.now();
  engineStart();
}

function bossCall(stage) {
  g.paused = true;
  engineStop();
  sfx.ring();
  const st = STAGES[stage];
  openDialog(`<div class="phone">📞</div>
    <div class="caller">Входящий: <b>${CAREER[careerIndex(save.career)].caller}</b></div>
    <p>«${txt(BOSS_CALLS[Math.min(stage - 1, BOSS_CALLS.length - 1)])}»</p>
    <p><b>Этап ${stage + 1}: ${st.name}</b></p>
    <button class="btn btn-go" id="okBoss" type="button">Понял, работаю 🫡</button>`);
  $('okBoss').onclick = resumeGame;
}

function showHowTo(inGame) {
  if (inGame && g) g.paused = true;
  const html = `<h3>Как работать</h3>
    <ul>
      <li>⬅️➡️ <b>Ткни пальцем в левую или правую половину экрана</b> — перестроиться. На компьютере — стрелки ← →.</li>
      <li>🕳️ <b>Ткни пальцем прямо в яму</b> — заделать её. Нужно ведро асфальта 🪣. На компьютере — кликни мышкой по яме или нажми пробел.</li>
      <li>⛑️ Яма, бабушка или каток — минус шлем. Шлемы кончились — смена окончена.</li>
      <li>🦆 Гусь путает лево и право. 🌯 Шаурма лечит. ⚡ Энергетик — неуязвимость.</li>
      <li>💰 Монеты ₽ — на новые мотоциклы в гараже.</li>
    </ul>
    <button class="btn btn-go" id="howOk" type="button">${inGame ? 'Погнали!' : 'Понятно'}</button>`;
  if (inGame) {
    openDialog(html);
    $('howOk').onclick = () => { save.tutorial = true; persist(); resumeGame(); };
  } else {
    // в меню показываем как отдельное окно поверх
    const m = $('videoModal');
    $('videoTitle').textContent = '';
    $('video').classList.add('hidden');
    $('videoMissing').classList.remove('hidden');
    $('videoMissing').innerHTML = `<div class="dialog" style="border-top:none;padding:0;text-align:left">${html.replace(/<button[\s\S]*<\/button>/, '')}</div>`;
    m.classList.remove('hidden');
  }
}

/* ---------- HUD ---------- */
let hudCache = {};
function setText(id, value) { if (hudCache[id] !== value) { hudCache[id] = value; $(id).textContent = value; } }
function score() { return Math.max(0, Math.floor(g.dist / 10) + g.bonus); }
function updateHud(reset) {
  if (reset) hudCache = {};
  setText('hHelmets', '⛑️ ' + Math.max(0, g.helmets));
  setText('hAsphalt', `🪣 ${g.asphalt}/${g.bike.asphalt}`);
  $('hAsphalt').classList.toggle('empty', g.asphalt === 0);
  setText('hScore', score().toLocaleString('ru-RU'));
  setText('hStage', `Этап ${g.stage + 1}: ${STAGES[g.stage].name}`);
  setText('hKm', (g.dist / KM).toFixed(2) + ' км');
  const badges = [];
  if (g.goose > 0) badges.push(`<span class="badge">🦆 ГУСЬ У РУЛЯ ${Math.ceil(g.goose)}</span>`);
  if (g.energy > 0) badges.push(`<span class="badge energy">⚡ НЕУЯЗВИМ ${Math.ceil(g.energy)}</span>`);
  if (g.event) badges.push(`<span class="badge">${{ commission: '🕴️', rain: '🌧️', geese: '🦆' }[g.event]} ${Math.ceil(g.eventT)} с</span>`);
  if (hudCache.badgesHtml !== badges.join('')) { hudCache.badgesHtml = badges.join(''); $('badges').innerHTML = badges.join(''); }
}

/* ================= Рисование ================= */
function draw() {
  const st = STAGES[g.stage];
  ctx.save();
  if (g.shake > 0) ctx.translate(rand(-6, 6) * g.shake * 2, rand(-6, 6) * g.shake * 2);

  // трава с полосами
  ctx.fillStyle = st.grass; ctx.fillRect(-10, -10, W + 20, H + 20);
  const off = (g.dist * S) % 80;
  ctx.fillStyle = 'rgba(0,0,0,.06)';
  for (let y = -80 + off; y < H; y += 80) ctx.fillRect(0, y, W, 40);

  // дорога
  ctx.fillStyle = st.road; ctx.fillRect(roadX, -10, roadW, H + 20);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(roadX + 3, -10, 4, H + 20); ctx.fillRect(roadX + roadW - 7, -10, 4, H + 20);
  ctx.fillStyle = st.line;
  const dash = 44 * S, gap = 34 * S, period = dash + gap, doff = (g.dist * S) % period;
  for (let l = 1; l < 3; l++) {
    const x = roadX + l * laneW - 2;
    for (let y = -period + doff; y < H; y += period) ctx.fillRect(x, y, 4, dash);
  }

  // трещины и обочина
  for (const d of g.decor) {
    if (d.kind === 'crack') {
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(d.a) * d.l * S, d.y + Math.sin(d.a) * d.l * S);
      ctx.lineTo(d.x + Math.cos(d.a + 0.6) * d.l * 1.4 * S, d.y + Math.sin(d.a + 0.6) * d.l * 1.4 * S); ctx.stroke();
    } else if (d.kind !== 'banner') drawTree(ctx, d.x, d.y, S, d.kind);
  }

  // объекты: сначала то, что на асфальте
  const ground = g.objs.filter(o => o.type === 'pothole' || o.type === 'puddle');
  const other = g.objs.filter(o => o.type !== 'pothole' && o.type !== 'puddle');
  for (const o of ground) {
    const oo = Object.assign({}, o, { x: laneX(o.lx) });
    if (o.type === 'puddle') {
      if (o.fixed) drawPothole(ctx, oo, S);
      else drawPuddle(ctx, oo, S);
    } else drawPothole(ctx, oo, S);
  }
  for (const o of other) {
    const oo = Object.assign({}, o, { x: laneX(o.lx) });
    if (o.hitDone && !o.fly && (o.type === 'bucket' || o.type === 'coin' || o.type === 'shawarma' || o.type === 'energy')) continue;
    switch (o.type) {
      case 'cone': drawCone(ctx, oo, S); break;
      case 'goose': drawGoose(ctx, oo, S, g.t); break;
      case 'granny': drawGranny(ctx, oo, S); break;
      case 'roller': drawRoller(ctx, oo, S); break;
      case 'bucket': drawBucket(ctx, oo, S, g.t); break;
      case 'coin': drawCoin(ctx, oo, S, g.t); break;
      case 'shawarma': drawEmojiItem(ctx, oo, S, g.t, '🌯'); break;
      case 'energy': drawEmojiItem(ctx, oo, S, g.t, '⚡'); break;
    }
  }

  // игрок
  const px = laneX(g.lx), py = playerY();
  if (g.energy > 0) {
    ctx.fillStyle = `rgba(150, 80, 255, ${0.25 + Math.sin(g.t * 20) * 0.1})`;
    ctx.beginPath(); ctx.ellipse(px, py - 6 * S, 42 * S, 60 * S, 0, 0, Math.PI * 2); ctx.fill();
  }
  const blink = g.inv > 0 && Math.floor(g.t * 14) % 2 === 0;
  if (!blink || g.over) {
    ctx.save();
    if (g.over) { ctx.translate(px, py); ctx.rotate(g.overT * 6); ctx.translate(-px, -py); }
    drawPlayer(ctx, px, py, S, g.bike, g.t, { lean: g.lean, headTilt: g.headTilt, hurt: g.hurt });
    ctx.restore();
  }

  // растяжки над дорогой
  for (const d of g.decor) if (d.kind === 'banner') drawBanner(ctx, roadX - 6 * S, roadX + roadW + 6 * S, d.y, S, d.text);

  // частицы и надписи
  for (const p of g.parts) { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.r, p.r); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of g.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.font = `900 ${16 * S}px sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // дождь
  if (g.event === 'rain') {
    ctx.strokeStyle = 'rgba(200,220,255,.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const x = (i * 97 + g.t * 300) % W, y = (i * 131 + g.t * 900) % H;
      ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 16);
    }
    ctx.stroke();
  }
  ctx.restore();

  // грязь на экране после лужи
  if (g.splash > 0) {
    ctx.globalAlpha = Math.min(1, g.splash / 1.2) * 0.85;
    ctx.fillStyle = '#5b4a33';
    for (const b of g.splashBlobs) { blobPath(ctx, b.x, b.y, b.r, b.r * 0.8, b.shape); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}

/* ================= Итоги смены ================= */
function finishGame() {
  if (!g) return;
  const r = g;
  g = null;
  const km = r.dist / KM;
  const pts = Math.max(0, Math.floor(r.dist / 10) + r.bonus);
  const money = r.coins * 10;
  const rankBefore = careerIndex(save.career);
  save.career += pts;
  const rankAfter = careerIndex(save.career);
  save.bank += money;
  save.shifts++;
  save.geese += r.geese;
  const newRec = pts > save.best;
  if (newRec) save.best = pts;
  if (km > save.bestKm) save.bestKm = Math.round(km * 100) / 100;

  const unlocked = [];
  const unlock = id => { if (!save.ach.includes(id)) { save.ach.push(id); unlocked.push(id); } };
  if (r.stage >= 1) unlock('stage2');
  if (r.repairs >= 25) unlock('fix25');
  if (save.geese >= 3) unlock('goose3');
  if (km >= 5) unlock('km5');
  if (r.stage >= 3) unlock('stage4');
  persist();

  const sat = r.repairs === 0 ? 0 : clamp(Math.round(100 * r.repairs / (r.repairs + r.holesHit * 2 + r.dodged * 0.5)), 0, 100);
  let verdict = VERDICTS[0][1];
  for (const [min, v] of VERDICTS) if (sat >= min) verdict = v;

  $('actNum').textContent = `№ ${Math.floor(rand(1000, 9999))} от ${new Date().toLocaleDateString('ru-RU')}`;
  const rows = [
    ['Должность', CAREER[rankAfter].name],
    ['Пройдено', km.toFixed(2) + ' км'],
    ['Дошёл до этапа', `${r.stage + 1}. ${STAGES[r.stage].name}`],
    ['Заделано ям', r.repairs],
    ['Пересчитано ям подвеской', r.holesHit],
    ['Объехано ям (а могли заделать)', r.dodged],
    ['Сбито конусов', r.cones],
    ['Встреч с гусём', r.geese],
    ['Обижено бабушек', r.grannies],
    ['Съедено шаурмы', r.shawarma],
    ['Заработано', money + ' ₽'],
    ['ИТОГО ОЧКОВ', pts.toLocaleString('ru-RU')],
  ];
  $('actTable').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  $('actSat').textContent = sat + '%';
  $('actVerdict').textContent = txt(verdict);
  const stamp = $('stamp');
  stamp.textContent = sat >= 50 ? 'ПРИНЯТО' : 'НА ДОРАБОТКУ';
  stamp.style.animation = 'none'; void stamp.offsetWidth; stamp.style.animation = '';
  setTimeout(sfx.stamp, 300);

  $('newRecord').classList.toggle('hidden', !newRec);
  const promo = $('promo');
  if (rankAfter > rankBefore) {
    const c = CAREER[rankAfter];
    promo.innerHTML = `<div class="promo-icon">${c.icon}</div><div>📈 ${txt(pick(PROMO))}</div><div class="promo-rank">Новая должность: <b>${c.name}</b></div>`;
    promo.classList.remove('hidden');
  } else promo.classList.add('hidden');
  const u = $('unlocks');
  if (unlocked.length) {
    u.innerHTML = unlocked.map(id => {
      const a = ACHIEVEMENTS.find(x => x.id === id);
      return `<div>🎬 Открыт «${a.clip}» за «${a.title}»!</div>`;
    }).join('') + '<div style="color:#b3b0a8;font-weight:400">Смотри в меню → Компромат</div>';
    u.classList.remove('hidden');
  } else u.classList.add('hidden');

  showScreen('result');
}

/* ================= Меню, гараж, компромат ================= */
function renderMenu() {
  const ci = careerIndex(save.career), c = CAREER[ci], nx = CAREER[ci + 1];
  $('rankIcon').textContent = c.icon;
  $('rankName').textContent = c.name;
  if (nx) {
    $('rankNext').textContent = `До «${nx.name}»: ${(nx.at - save.career).toLocaleString('ru-RU')} очков стажа`;
    $('rankBar').style.width = ((save.career - c.at) / (nx.at - c.at) * 100) + '%';
  } else {
    $('rankNext').textContent = '«Красноармейка» твоя. Ямы — тоже.';
    $('rankBar').style.width = '100%';
  }
  $('mBest').textContent = save.best.toLocaleString('ru-RU');
  $('mKm').textContent = save.bestKm;
  $('mBank').textContent = save.bank.toLocaleString('ru-RU');
  $('soundBtn').textContent = save.sound ? '🔊 Звук' : '🔇 Звук';
  $('matToggle').checked = save.mat;
  $('tip').textContent = pick(TIPS);
}

function renderGarage() {
  $('gBank').textContent = save.bank.toLocaleString('ru-RU');
  const box = $('bikes');
  box.innerHTML = '';
  BIKES.forEach(b => {
    const owned = save.owned.includes(b.id);
    const chosen = save.bike === b.id;
    const el = document.createElement('div');
    el.className = 'bike' + (chosen ? ' chosen' : '');
    const bar = (label, v, max) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.round(v / max * 100)}%"></i></div></div>`;
    let btn;
    if (chosen) btn = '<button class="btn" type="button" disabled>Выбран ✅</button>';
    else if (owned) btn = '<button class="btn" type="button" data-act="pick">Выбрать</button>';
    else btn = `<button class="btn buy" type="button" data-act="buy" ${save.bank < b.price ? 'disabled' : ''}>Купить за ${b.price.toLocaleString('ru-RU')} ₽</button>`;
    el.innerHTML = `<div>${bikeSVG(b)}</div>
      <div><h3>${b.name}</h3><div class="note">${b.note}</div>
      ${bar('Манёвренность', b.lane, 14)}${bar('Шлемы ⛑️ ' + b.helmets, b.helmets, 6)}${bar('Асфальт 🪣 ' + b.asphalt, b.asphalt, 9)}</div>
      ${btn}`;
    const button = el.querySelector('button[data-act]');
    if (button) button.onclick = () => {
      if (button.dataset.act === 'buy') {
        if (save.bank < b.price) return;
        save.bank -= b.price;
        save.owned.push(b.id);
        sfx.coin();
        if (b.id === 'ural' && !save.ach.includes('ural')) {
          save.ach.push('ural');
          setTimeout(() => alert('🎬 Открыт «Компромат №5»! Смотри в меню → Компромат.'), 50);
        }
      }
      save.bike = b.id;
      persist();
      renderGarage();
    };
    box.appendChild(el);
  });
}

function renderArchive() {
  const box = $('achs');
  box.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const open = save.ach.includes(a.id);
    const el = document.createElement('div');
    el.className = 'ach' + (open ? '' : ' locked');
    el.innerHTML = open
      ? `<h3>🎬 ${a.clip}: «${a.title}»</h3><p>${a.desc} — выполнено ✅</p><button class="btn" type="button">▶ Смотреть</button>`
      : `<h3>🔒 ${a.clip}</h3><p>Чтобы открыть: ${a.desc.toLowerCase()}</p>`;
    if (open) el.querySelector('button').onclick = () => openVideo(a);
    box.appendChild(el);
  });
}

function openVideo(a) {
  const v = $('video');
  $('videoTitle').textContent = `${a.clip}: «${a.title}»`;
  $('videoMissing').innerHTML = '📼 Плёнка ещё в проявке. Скоро завезут!';
  $('videoMissing').classList.add('hidden');
  v.classList.remove('hidden');
  v.onerror = () => { v.classList.add('hidden'); $('videoMissing').classList.remove('hidden'); };
  v.src = a.video;
  $('videoModal').classList.remove('hidden');
  v.play().catch(() => { /* автозапуск может быть запрещён — есть кнопка ▶ */ });
}
function closeVideo() {
  const v = $('video');
  v.pause(); v.removeAttribute('src'); v.load();
  $('videoModal').classList.add('hidden');
}

/* ================= Управление ================= */
cv.addEventListener('pointerdown', e => {
  if (!g || g.paused || g.over) return;
  e.preventDefault();
  const r = cv.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const target = repairTargetAt(x, y);
  if (target) { tryRepair(target); return; }
  move(x < W / 2 ? -1 : 1);
});

document.addEventListener('keydown', e => {
  if (!g || !$('game').classList.contains('active')) return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'з') { g.paused ? resumeGame() : pauseGame(); return; }
  if (g.paused) { if (e.key === 'Enter' || e.key === ' ') { const b = $('dialog').querySelector('.btn-go'); if (b) b.click(); e.preventDefault(); } return; }
  if (['ArrowLeft', 'a', 'A', 'ф', 'Ф'].includes(e.key)) { move(-1); e.preventDefault(); }
  if (['ArrowRight', 'd', 'D', 'в', 'В'].includes(e.key)) { move(1); e.preventDefault(); }
  if ([' ', 'ArrowUp', 'w', 'W', 'ц', 'Ц'].includes(e.key)) {
    e.preventDefault();
    const o = nearestAhead();
    if (o) tryRepair(o); else if (g.asphalt === 0) sfx.dud();
  }
});

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

$('pauseBtn').addEventListener('click', pauseGame);
$('playBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);
$('garageBtn').addEventListener('click', () => { renderGarage(); showScreen('garage'); });
$('resGarage').addEventListener('click', () => { renderGarage(); showScreen('garage'); });
$('archiveBtn').addEventListener('click', () => { renderArchive(); showScreen('archive'); });
$('resMenu').addEventListener('click', () => { renderMenu(); showScreen('menu'); });
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { renderMenu(); showScreen('menu'); }));
$('howBtn').addEventListener('click', () => showHowTo(false));
$('videoClose').addEventListener('click', closeVideo);
$('soundBtn').addEventListener('click', () => { save.sound = !save.sound; persist(); renderMenu(); if (save.sound) sfx.coin(); });
$('matToggle').addEventListener('change', e => {
  save.mat = e.target.checked; persist();
  if (save.mat) { sfx.honk(); $('tip').textContent = 'Режим прораба включён. Валера больше не сдерживается.'; }
  else $('tip').textContent = 'Режим прораба выключен. Валера снова культурный.';
});

renderMenu();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* без офлайна тоже работает */ }); });
}
