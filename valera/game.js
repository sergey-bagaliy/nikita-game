'use strict';

/* ================= Настройки ================= */
const KM = 10000;                 // столько «единиц пути» в одном километре
const STORE = 'valera-roads-v1';
const DEF = { career: 0, bank: 0, best: 0, bestKm: 0, bike: 'moped', owned: ['moped'], ach: [], geese: 0, shifts: 0, sound: true, voice: true, mat: false, tutorial: false };

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
  const osc = a.createOscillator(), gn = a.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(o.vol || 0.15, t + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gn).connect(a.destination);
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
  const gn = a.createGain();
  gn.gain.setValueAtTime(o.vol || 0.3, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(gn).connect(a.destination);
  src.start(t); src.stop(t + dur + 0.05);
}
const sfx = {
  bump()   { noise(0, 0.35, { freq: 500, vol: 0.6 }); tone(140, 0, 0.3, { type: 'square', to: 45, vol: 0.18 }); },
  thump()  { noise(0, 0.18, { freq: 250, vol: 0.5 }); },
  repair() { noise(0, 0.12, { freq: 300, vol: 0.5 }); tone(1320, 0.08, 0.25, { vol: 0.1 }); tone(1760, 0.14, 0.3, { vol: 0.08 }); },
  coin()   { tone(988, 0, 0.08, { type: 'square', vol: 0.06 }); tone(1319, 0.07, 0.15, { type: 'square', vol: 0.06 }); },
  bucket() { tone(330, 0, 0.18, { type: 'triangle', to: 880, vol: 0.18 }); },
  cone()   { noise(0, 0.15, { freq: 1500, filter: 'bandpass', vol: 0.4 }); tone(500, 0, 0.12, { type: 'triangle', to: 900, vol: 0.1 }); },
  honk()   { [0, 0.2].forEach(s => tone(620, s, 0.15, { type: 'square', to: 470, vol: 0.12 })); },
  moo()    { tone(170, 0, 0.9, { type: 'sawtooth', to: 120, vol: 0.12 }); },
  meow()   { tone(700, 0, 0.35, { type: 'triangle', to: 1100, vol: 0.1 }); tone(1100, 0.3, 0.3, { type: 'triangle', to: 600, vol: 0.08 }); },
  bark()   { [0, 0.22].forEach(s => { noise(s, 0.12, { freq: 900, filter: 'bandpass', vol: 0.5 }); tone(320, s, 0.12, { type: 'sawtooth', to: 200, vol: 0.12 }); }); },
  squeak() { tone(2400, 0, 0.12, { type: 'square', to: 3200, vol: 0.05 }); },
  glass()  { noise(0, 0.4, { freq: 4000, filter: 'highpass', vol: 0.5 }); tone(2600, 0, 0.2, { vol: 0.05 }); },
  roar()   { tone(70, 0, 1.4, { type: 'sawtooth', to: 160, vol: 0.12 }); noise(0, 1.2, { freq: 400, vol: 0.25 }); },
  lane()   { tone(220, 0, 0.05, { type: 'triangle', vol: 0.05 }); },
  dud()    { tone(150, 0, 0.15, { type: 'square', vol: 0.06 }); },
  heal()   { [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.15, { type: 'triangle', vol: 0.14 })); },
  energy() { tone(200, 0, 0.6, { type: 'sawtooth', to: 1200, vol: 0.08 }); },
  event()  { [0, 0.25].forEach(s => { tone(392, s, 0.2, { type: 'sawtooth', vol: 0.07 }); tone(494, s, 0.2, { type: 'sawtooth', vol: 0.06 }); }); },
  ring()   { for (let i = 0; i < 6; i++) tone(i % 2 ? 1100 : 1400, i * 0.1, 0.09, { type: 'square', vol: 0.05 }); },
  flash()  { noise(0, 0.25, { freq: 3000, filter: 'highpass', vol: 0.3 }); },
  over()   { [466, 440, 415].forEach((f, i) => tone(f, i * 0.45, 0.42, { type: 'sawtooth', vol: 0.08 })); tone(392, 1.35, 1.1, { type: 'sawtooth', to: 370, vol: 0.08 }); },
  stamp()  { noise(0, 0.2, { freq: 300, vol: 0.7 }); },
  beep()   { tone(1000, 0, 0.3, { type: 'sine', vol: 0.12 }); },
};
Voice.beep = () => { if (save.sound) sfx.beep(); };
Voice.enabled = save.voice;
Voice.uncensored = save.mat;

function engineStart() {
  const a = ac(); if (!a || engine) return;
  const osc = a.createOscillator(), f = a.createBiquadFilter(), gn = a.createGain();
  osc.type = 'sawtooth'; osc.frequency.value = 55;
  f.type = 'lowpass'; f.frequency.value = 380;
  gn.gain.value = 0.03;
  osc.connect(f).connect(gn).connect(a.destination);
  osc.start();
  engine = { osc, gn };
}
function engineSet(speed) { if (engine && audio) engine.osc.frequency.setTargetAtTime(40 + speed * 0.09, audio.currentTime, 0.2); }
function engineStop() { if (engine) { try { engine.osc.stop(); } catch (e) { /* уже остановлен */ } engine = null; } }

/* ================= Холст и геометрия дороги ================= */
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, PY = 0, roadW = 0, laneW = 0, S = 1, AMP = 0;
const roadPatterns = {};

function makeRoadPattern(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.06)';
    x.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  return ctx.createPattern(c, 'repeat');
}

function resize() {
  W = cv.clientWidth; H = cv.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const narrow = W < 600;
  roadW = narrow ? W * 0.58 : Math.min(W * 0.66, 420);
  laneW = roadW / 3;
  S = laneW / 86;
  PY = H * 0.8;
  AMP = clamp((W - roadW) / 2 - 14 * S, 0, 240) * (narrow ? 0.45 : 1);
  for (const k of Object.keys(ZONES)) roadPatterns[k] = makeRoadPattern(ZONES[k].road);
}
window.addEventListener('resize', () => { if ($('game').classList.contains('active')) resize(); });

const yOf = d => PY - (d - g.dist) * S;
const dOf = y => g.dist + (PY - y) / S;

function zoneAt(d) {
  const zs = g.zones;
  for (let i = 0; i < zs.length; i++) if (d < zs[i].end) return zs[i];
  return zs[zs.length - 1];
}
function curveFactor(d) {
  const z = zoneAt(d);
  const k = clamp(Math.min(d - z.start, z.end - d) / 800, 0, 1);
  return 0.12 + (ZONES[z.type].curve - 0.12) * k;
}
const curveFn = d => 0.65 * Math.sin(d / 2300) + 0.35 * Math.sin(d / 970 + 1.7);
const offset = d => AMP * curveFactor(d) * curveFn(d);
const roadL = d => (W - roadW) / 2 + offset(d);
const laneX = (lx, d) => roadL(d) + lx * laneW;
function roadAngle(d) {
  const dx = (offset(d + 25) - offset(d - 25)) / 50;
  return Math.atan(dx / S);
}

/* ================= Смена (игра) ================= */
let g = null;
let raf = 0, lastT = 0;

function newGame() {
  const bike = bikeById(save.bike);
  g = {
    bike, t: 0, dist: 0, bonus: 0, coins: 0, fines: 0,
    repairs: 0, holesHit: 0, dodged: 0, cones: 0, animals: 0, grannies: 0, shawarma: 0, motya: 0,
    helmets: bike.helmets, asphalt: 1,
    stage: 0, lane: 1, lx: 1.5, lean: 0,
    hurt: 0, inv: 0, energy: 0, goose: 0, headTilt: 0, shake: 0, splash: 0, splashBlobs: [], flash: 0,
    zones: [], curZone: null, villageN: 0,
    objs: [], scenery: [], cracks: [], parts: [], floats: [],
    nextRowD: 600, nextSceneryD: [0, 0], nextCrackD: 0, nextBannerD: 3500,
    nextShoutD: 2500, nextMotyaD: 4200, nextSupport: rand(25, 40), repairStreak: 0,
    event: null, eventT: 0, nextEvent: rand(22, 32),
    bubbleT: 0, lastSay: -9,
    over: false, overT: 0, paused: false,
    tier: careerIndex(save.career),
  };
  g.zones.push({ type: 'highway', start: -2000, end: 1800, name: 'Трасса' });
  addZoneFixtures(g.zones[0]);
}

/* ---------- Населённые пункты ---------- */
function ensureZones(dMax) {
  while (g.zones[g.zones.length - 1].end < dMax) {
    const last = g.zones[g.zones.length - 1];
    let type, len, name;
    if (last.type !== 'highway') { type = 'highway'; len = rand(2600, 4000); name = 'Трасса'; }
    else {
      g.villageN++;
      type = g.villageN % 2 === 0 ? 'town' : 'village';
      len = type === 'town' ? rand(3200, 4200) : rand(2200, 3000);
      name = pick(type === 'town' ? TOWNS : VILLAGES);
    }
    const z = { type, start: last.end, end: last.end + len, name };
    g.zones.push(z);
    addZoneFixtures(z);
  }
}

function addFix(kind, d, side, off, extra = {}) {
  g.scenery.push({ kind, d, side, off, ...extra });
}

function addZoneFixtures(z) {
  const Z = ZONES[z.type];
  if (z.type !== 'highway') {
    g.scenery.push({ kind: 'arch', d: z.start + 60, road: true, text: (z.type === 'town' ? 'ДОБРО ПОЖАЛОВАТЬ: ' : 'СТ. ') + z.name.toUpperCase(), town: z.type === 'town' });
    addFix('sign', z.start + 30, 1, 14, { sign: 'city', val: z.name });
    addFix('sign', z.start + 160, 1, 14, { sign: 'limit', val: Z.limit });
    addFix('sign', z.end - 30, 1, 14, { sign: 'cityEnd', val: z.name });
    if (z.type === 'village') {
      addFix('sign', z.start + 320, -1, 14, { sign: 'kids' });
      const bd = rand(z.start + 700, z.end - 600);
      addFix('sign', bd - 140, 1, 14, { sign: 'bump' });
      g.scenery.push({ kind: 'bump', d: bd, road: true });
      const zd = rand(z.start + 450, z.start + 650);
      addFix('sign', zd - 150, 1, 14, { sign: 'crossing' });
      g.scenery.push({ kind: 'zebra', d: zd, road: true, spawned: false });
    } else {
      for (let i = 0; i < 3; i++) {
        const zd = rand(z.start + 450 + i * 1000, z.start + 1000 + i * 1000);
        if (zd > z.end - 400) continue;
        addFix('sign', zd - 150, 1, 14, { sign: 'crossing' });
        g.scenery.push({ kind: 'zebra', d: zd, road: true, spawned: false });
      }
      const cd = rand(z.start + 500, z.end - 500);
      addFix('sign', cd, 1, 16, { sign: 'camera', camera: true, limit: Z.limit });
    }
  } else {
    addFix('sign', z.start + 120, 1, 14, { sign: 'limit', val: Z.limit });
    for (let d = Math.ceil(z.start / 2500) * 2500; d < z.end; d += 2500) addFix('km', d, 1, 22, { km: Math.round(d / 1000) + 137 });
    for (let d = z.start + 700; d < z.end - 300; d += rand(1400, 2200)) {
      const dir = offset(d + 700) - offset(d + 300);
      if (Math.abs(dir) > 4) addFix('sign', d, 1, 14, { sign: dir < 0 ? 'curveL' : 'curveR' });
    }
    if (Math.random() < 0.6) addFix('sign', rand(z.start + 400, z.end - 400), 1, 14, { sign: 'works' });
  }
}

// Сколько места от края дороги до края экрана (в единицах), чтобы дома не уезжали за экран
function sideRoom() { return Math.max(40, ((W - roadW) / 2 - AMP) / S); }

function spawnScenery(side, d) {
  const z = zoneAt(d).type;
  const r = Math.random();
  const room = sideRoom();
  let gap = 60;
  if (z === 'highway') {
    if (r < 0.45) { addFix('tree', d, side, rand(30, 70), { tree: Math.random() < 0.6 ? 'poplar' : 'tree' }); gap = rand(28, 60); }
    else if (r < 0.65) { addFix('field', d, side, rand(60, 90), { w: rand(70, 110) * S, h: rand(80, 140) * S }); gap = rand(150, 220); }
    else if (r < 0.8) { addFix('pole', d, side, 34); gap = rand(60, 100); }
    else { addFix('tree', d, side, rand(28, 50), { tree: 'bush' }); gap = rand(40, 80); }
  } else if (z === 'village') {
    if (r < 0.55) {
      const roofs = [['#b5482f', '#933a26'], ['#4c7a3c', '#3c6230'], ['#5b6b7f', '#4a5868'], ['#7a4b2a', '#613b21']];
      const [roof, roof2] = pick(roofs);
      const hw = Math.min(rand(42, 56), room * 0.75);
      addFix('house', d, side, Math.min(rand(62, 74), 16 + hw * 0.8), { w: hw * S, h: hw * 0.8 * S, roof, roof2, wall: pick(['#efe6d2', '#f6e7c1', '#e8eef5', '#f3d9d0']), fence: pick(['#6d4c2f', '#2e7d32', '#1565c0']) });
      gap = rand(95, 130);
    } else if (r < 0.7) { addFix('tree', d, side, rand(26, 46), { tree: 'fruit' }); gap = rand(40, 70); }
    else if (r < 0.8) { addFix('well', d, side, 30); gap = rand(50, 80); }
    else if (r < 0.9) { addFix('pole', d, side, 22); gap = rand(50, 80); }
    else { addFix('car', d, side, 22, { color: pick(['#c0392b', '#ecf0f1', '#2c3e50', '#7f8c8d', '#27ae60']) }); gap = rand(60, 90); }
  } else {
    if (r < 0.4) { const bw = Math.min(rand(70, 100), room * 1.1); addFix('block', d, side, Math.min(rand(80, 96), 34 + bw * 0.5), { w: bw * S, h: rand(120, 170) * S }); gap = rand(190, 240); }
    else if (r < 0.7) { addFix('shop', d, side, Math.min(60, 36 + 22), { w: 44 * S, h: rand(60, 80) * S, text: pick(SHOPS), color: pick(['#c0392b', '#2471a3', '#27ae60', '#d35400', '#8e44ad']) }); gap = rand(110, 140); }
    else if (r < 0.85) { addFix('car', d, side, 20, { color: pick(['#c0392b', '#ecf0f1', '#2c3e50', '#7f8c8d', '#f1c40f']) }); gap = rand(55, 80); }
    else { addFix('tree', d, side, 40, { tree: 'tree' }); gap = rand(50, 80); }
    if (Math.random() < 0.35) addFix('lamp', d + 20, side, 36);
  }
  spawnFar(side, d, z);
  return gap;
}

// На широком экране (компьютер) по краям много места — добавляем дальний ряд
function spawnFar(side, d, z) {
  const room = ((W - roadW) / 2) / S;
  if (room < 200 || Math.random() < 0.35) return;
  const off = rand(150, room - 30);
  if (z === 'highway') {
    if (Math.random() < 0.5) addFix('field', d, side, off, { w: rand(90, 140) * S, h: rand(90, 160) * S });
    else addFix('tree', d, side, off, { tree: Math.random() < 0.5 ? 'poplar' : 'tree' });
  } else if (z === 'village') {
    if (Math.random() < 0.6) {
      const roofs = [['#b5482f', '#933a26'], ['#4c7a3c', '#3c6230'], ['#5b6b7f', '#4a5868'], ['#7a4b2a', '#613b21']];
      const [roof, roof2] = pick(roofs);
      addFix('house', d, side, off, { w: rand(40, 52) * S, h: rand(32, 42) * S, roof, roof2, wall: '#efe6d2', fence: pick(['#6d4c2f', '#2e7d32', '#1565c0']) });
    } else addFix('tree', d, side, off, { tree: 'fruit' });
  } else {
    addFix('block', d, side, off, { w: rand(80, 120) * S, h: rand(120, 170) * S });
  }
}

/* ---------- Запуск ---------- */
function startGame() {
  showScreen('game');
  resize();
  newGame();
  ensureZones(4000);
  $('ovl').classList.add('hidden');
  $('bubble').classList.add('hidden');
  $('eventBanner').classList.add('hidden');
  Voice.warm();
  setTimeout(() => Voice.prefetch(save.mat), 1500);
  updateHud(true);
  if (!save.tutorial) showHowTo(true);
  else engineStart();
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
const kmh = v => Math.round(v * 0.2);

/* ---------- Кадр ---------- */
function update(dt) {
  g.t += dt;
  const v = currentSpeed();
  const prevDist = g.dist;
  g.dist += v * dt;
  engineSet(v);
  const km = g.dist / KM;
  const ahead = g.dist + PY / S + 140;
  ensureZones(ahead + 4000);

  // смена этапа — звонок
  const next = STAGES[g.stage + 1];
  if (next && km >= next.km && !g.over) { g.stage++; bossCall(g.stage); }

  // въезд в населённый пункт
  const cz = zoneAt(g.dist);
  if (cz !== g.curZone) {
    const first = !g.curZone;
    g.curZone = cz;
    if (!first) {
      announce(cz.type === 'highway' ? '🛣️ Выезд на трассу' : (cz.type === 'town' ? '🏙️ Въезд в город: ' : '🏡 Въезд в станицу: ') + (cz.type === 'highway' ? '' : cz.name));
      if (Math.random() < 0.6) setTimeout(() => { if (g) talk(txt(pick(ZONE_LINES[cz.type])), 'valera', 1); }, 1200);
    }
  }

  if (!g.over) {
    while (g.nextRowD < ahead) {
      spawnRow(g.nextRowD);
      g.nextRowD += Math.max(175, 270 - g.stage * 18) * rand(0.85, 1.2);
    }
    for (const i of [0, 1]) {
      while (g.nextSceneryD[i] < ahead + 200) g.nextSceneryD[i] += spawnScenery(i ? 1 : -1, g.nextSceneryD[i]);
    }
    while (g.nextCrackD < ahead) {
      g.cracks.push({ d: g.nextCrackD, lx: rand(0.2, 2.8), a: rand(0, Math.PI), l: rand(14, 30) });
      g.nextCrackD += rand(80, 200);
    }
    if (g.nextBannerD < ahead) {
      g.scenery.push({ kind: 'banner', d: g.nextBannerD, road: true, text: pick(BANNERS) });
      g.nextBannerD += rand(9000, 14000);
    }
    if (g.nextShoutD < ahead) { spawnShouter(g.nextShoutD); g.nextShoutD += rand(3500, 6000); }
    if (g.nextMotyaD < ahead) { startMotya(g.nextMotyaD); g.nextMotyaD += rand(8000, 13000); }
  }

  // объекты
  for (const o of g.objs) {
    if (o.vd) o.d += o.vd * dt;
    if (o.vx) {
      o.lx += o.vx * dt;
      if (o.zig) o.d += Math.sin(g.t * 9 + o.seed) * 60 * dt;
      if (o.slide) { o.vx *= Math.max(0, 1 - 2.2 * dt); if (Math.abs(o.vx) < 0.05) o.vx = 0; }
    }
    if (o.fly) { o.d += o.fly.vd * dt; o.lx += o.fly.vx * dt; o.spin = (o.spin || 0) + dt * 10; }
    if (o.type === 'bottle') {
      o.t += dt / o.dur;
      if (o.t >= 1) { o.dead = true; sfx.glass(); g.objs.push(makeObj('glass', o.to.lx, o.to.d)); }
    }
    if (o.actor) updateActor(o, dt);
    if (o.line && !o.said) {
      const y = yOf(o.d);
      if (y > H * 0.08 && y < H * 0.75) { o.said = true; talk(o.line.text, o.line.role, o.line.prio || 2); }
    }
    if (!o.counted && o.d < g.dist - 40) {
      o.counted = true;
      if (o.type === 'pothole' && !o.fixed && !o.hitDone) g.dodged++;
    }
  }
  const behind = g.dist - (H - PY) / S - 160;
  g.objs = g.objs.filter(o => !o.dead && o.d > behind && o.lx > -4 && o.lx < 7);
  g.scenery = g.scenery.filter(s => s.d > behind - 200);
  g.cracks = g.cracks.filter(c => c.d > behind);
  g.zones = g.zones.filter((z, i) => z.end > behind - 2000 || i === g.zones.length - 1);

  // переходы, камеры, лежачие полицейские
  for (const s of g.scenery) {
    if (s.kind === 'zebra' && !s.spawned && s.d < ahead) {
      s.spawned = true;
      if (Math.random() < 0.85) {
        const fromLeft = Math.random() < 0.5;
        g.objs.push(makeObj('passer', fromLeft ? -0.6 : 3.6, s.d, { vx: (fromLeft ? 1 : -1) * rand(0.45, 0.65), look: { shirt: pick(['#16a085', '#e67e22', '#2980b9', '#c0392b']), hat: pick(['cap', 'none', 'scarf']) } }));
      }
    }
    if (s.d < g.dist && s.d >= prevDist && !g.over) {
      if (s.camera && kmh(v) > s.limit + 10) {
        g.fines += 100; g.flash = 0.35; sfx.flash();
        float(laneX(g.lx, g.dist), PY - 70 * S, '📷 −100 ₽', '#ff8b8b');
        setTimeout(() => { if (g) talk(say('camera'), 'accountant', 3); }, 500);
      }
      if (s.kind === 'bump') {
        g.shake = 0.3; sfx.thump();
        if (Math.random() < 0.5) talk(say('bump'), 'valera', 1);
      }
    }
  }

  // игрок
  const tx = g.lane + 0.5;
  const diff = tx - g.lx;
  g.lx += diff * Math.min(1, dt * g.bike.lane);
  g.lean = clamp(diff * 2.5, -1, 1);
  g.headTilt = g.hurt > 0 ? Math.sin(g.t * 40) * 0.35 * g.hurt : Math.sin(g.t * 3) * 0.06;

  g.hurt = Math.max(0, g.hurt - dt);
  g.inv = Math.max(0, g.inv - dt);
  g.energy = Math.max(0, g.energy - dt);
  g.goose = Math.max(0, g.goose - dt);
  g.shake = Math.max(0, g.shake - dt);
  g.splash = Math.max(0, g.splash - dt);
  g.flash = Math.max(0, g.flash - dt);
  if (g.bubbleT > 0) { g.bubbleT -= dt; if (g.bubbleT <= 0) $('bubble').classList.add('hidden'); }

  // Серёга по рации иногда подбадривает
  if (!g.over) {
    g.nextSupport -= dt;
    if (g.nextSupport <= 0) { g.nextSupport = rand(35, 55); support('support', 1); }
  }

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
    const phw = (g.bike.special === 'roller' ? 24 : 12) * S, phh = 34 * S;
    for (const o of g.objs) {
      if (o.hitDone || o.fixed || o.noHit || o.fly) continue;
      const b = hitBox(o);
      if (Math.abs(o.lx - g.lx) * laneW < b.hw + phw && Math.abs(o.d - g.dist) * S < b.hh + phh) collide(o);
    }
  } else g.overT += dt;

  for (const p of g.parts) { p.x += p.vx * dt; p.y += p.vy * dt + v * S * dt; p.vy += 600 * dt; p.life -= dt; }
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
  'МОТЯ, ВЕРНИ ПОЛТОС',
];
const CROSSERS = { goose: [0.9, 1.5], cow: [0.25, 0.4], cat: [1.6, 2.2], dog: [1.1, 1.5], rat: [2.2, 2.8], granny: [0.35, 0.55] };

function weighted(mix) {
  const entries = Object.entries(mix).filter(([, w]) => w > 0);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[0][0];
}

function makeObj(type, lx, d, extra = {}) {
  const o = { type, lx, d, seed: rand(0, 6), shape: randomShape(), ...extra };
  if (type === 'pothole') { o.w = laneW * rand(0.5, 0.74); o.h = o.w * rand(0.55, 0.8); }
  if (type === 'puddle') { o.w = laneW * rand(0.6, 0.82); o.h = o.w * rand(0.5, 0.7); }
  if (type === 'cat') o.color = Math.random() < 0.7 ? '#151515' : pick(['#e67e22', '#95a5a6']);
  return o;
}

function spawnRow(d) {
  const zt = zoneAt(d).type;
  const mix = Object.assign({}, ZONE_MIX[zt]);
  if (g.event === 'rain') mix.puddle = (mix.puddle || 0) + 7;
  if (g.event === 'herd') { if (zt === 'highway') mix.cow += 6; else if (zt === 'village') mix.goose += 6; else { mix.cat += 4; mix.rat += 4; } }
  if (g.event === 'commission') mix.pothole += 4;
  const rollers = g.objs.filter(o => o.type === 'roller' && !o.hitDone && o.d > g.dist);
  const blocked = new Set(rollers.map(o => Math.floor(o.lx)));
  if (rollers.length) mix.roller = 0;
  const avail = shuffle([0, 1, 2].filter(l => !blocked.has(l)));
  const maxObs = avail.length - 1;
  const type = weighted(mix);
  let free = avail.slice();

  if (CROSSERS[type] && (type !== 'granny' || !blocked.size)) {
    const fromLeft = Math.random() < 0.5;
    const sp = rand(...CROSSERS[type]);
    g.objs.push(makeObj(type, fromLeft ? -0.5 : 3.5, d, { vx: fromLeft ? sp : -sp, zig: type === 'dog' || type === 'rat' }));
  } else if (type === 'pothole' && !blocked.size && Math.random() < 0.14) {
    const start = Math.random() < 0.5 ? 0 : 1;
    const o = makeObj('pothole', start + 1, d, { big: true });
    o.w = laneW * 1.7; o.h = laneW * 0.62;
    g.objs.push(o);
    free = [start === 0 ? 2 : 0];
  } else if (maxObs > 0) {
    const count = Math.min(maxObs, Math.random() < 0.12 + g.stage * 0.1 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      let tp = i === 0 ? type : weighted(mix);
      if (CROSSERS[tp]) tp = 'pothole';
      if (tp === 'roller' && i > 0) tp = 'cone';
      const extra = {};
      if (tp === 'puddle') extra.hidden = Math.random() < (g.event === 'rain' ? 0.7 : 0.4);
      if (tp === 'roller') extra.vd = 140;
      g.objs.push(makeObj(tp, avail[i] + 0.5, d + rand(-20, 20), extra));
    }
    free = avail.slice(count);
  }

  if (free.length) {
    const lane = pick(free) + 0.5;
    const r = Math.random();
    const bucketChance = g.asphalt === 0 ? 0.55 : 0.3;
    if (r < bucketChance) g.objs.push(makeObj('bucket', lane, d + 70));
    else if (r < bucketChance + 0.3) { for (let i = 0; i < 3; i++) g.objs.push(makeObj('coin', lane, d + 60 + i * 38)); }
    else if (r < bucketChance + 0.34 && g.helmets < g.bike.helmets) g.objs.push(makeObj('shawarma', lane, d + 70));
    else if (r < bucketChance + 0.36) g.objs.push(makeObj('energy', lane, d + 70));
  }
}

/* ---------- Крикуны на обочине ---------- */
function spawnShouter(d) {
  const zt = zoneAt(d).type;
  const list = SHOUTERS.filter(s => g.tier >= s.tier[0] && g.tier <= s.tier[1] && s.zones.includes(zt));
  if (!list.length) return;
  const sh = pick(list);
  const side = Math.random() < 0.5 ? -1 : 1;
  g.objs.push(makeObj('shouter', side < 0 ? -1.7 : 4.7, d, {
    actor: true, noHit: true, side, look: sh.look, target: side < 0 ? -0.5 : 3.5,
    line: { text: txt(pick(sh.lines)), role: sh.role, prio: 2 },
  }));
}

/* ---------- Мотя ---------- */
function startMotya(d) {
  const zt = zoneAt(d).type;
  const kinds = { town: ['club', 'club', 'dog', 'bike'], village: ['dog', 'bike', 'kick'], highway: ['lying', 'kick', 'bike'] }[zt];
  const kind = pick(kinds);
  const side = Math.random() < 0.5 ? -1 : 1;
  g.motya++;
  if (g.motya > 0) setTimeout(() => { if (g && !g.over) talk(say('valeraMotya'), 'valera', 1); }, 2600);
  const fromLeft = side < 0;
  switch (kind) {
    case 'club':
      addFix('club', d + 30, side, 70, { w: 70 * S, h: 110 * S });
      g.objs.push(makeObj('motyaThrow', side < 0 ? -1.4 : 4.4, d, { actor: true, noHit: true, side, target: side < 0 ? -0.35 : 3.35, throws: 0, cool: 1.0,
        line: { text: say('motyaThrow'), role: 'motya', prio: 3 } }));
      break;
    case 'bike':
      g.objs.push(makeObj('motyaBike', fromLeft ? -0.8 : 3.8, d, { vx: fromLeft ? 1.9 : -1.9, roar: false,
        line: { text: say('motyaBike'), role: 'motya', prio: 3 } }));
      break;
    case 'kick':
      g.objs.push(makeObj('motyaKick', side < 0 ? -0.55 : 3.55, d, { actor: true, noHit: true, side, vd: 120, kicks: 0, cool: 0.6,
        line: { text: say('motyaKick'), role: 'motya', prio: 3 } }));
      break;
    case 'lying':
      g.objs.push(makeObj('motyaLying', side < 0 ? 0.28 : 2.72, d, {
        line: { text: say('motyaLying'), role: 'motya', prio: 3 } }));
      break;
    case 'dog':
      g.objs.push(makeObj('motyaRun', fromLeft ? -0.9 : 3.9, d, { vx: fromLeft ? 0.85 : -0.85,
        line: { text: say('motyaRun'), role: 'motya', prio: 3 } }));
      g.objs.push(makeObj('motyaDog', fromLeft ? -0.3 : 3.3, d + 25, { vx: fromLeft ? 1.15 : -1.15, zig: true }));
      break;
  }
}

function updateActor(o, dt) {
  if (o.target !== undefined && Math.abs(o.lx - o.target) > 0.02) {
    o.lx += Math.sign(o.target - o.lx) * Math.min(Math.abs(o.target - o.lx), 1.3 * dt);
    o.moving = true;
  } else o.moving = false;
  const y = yOf(o.d);
  const onScreen = y > 0 && y < PY - 60 * S;
  if (o.type === 'motyaThrow' && onScreen && !o.moving && o.throws < 3 && !g.over) {
    o.cool -= dt;
    if (o.cool <= 0) {
      o.cool = 0.85; o.throws++; o.pose = 0.3;
      const toD = g.dist + rand(230, 330);
      g.objs.push(makeObj('bottle', o.lx, o.d, { noHit: true, from: { lx: o.lx, d: o.d }, to: { lx: g.lane + 0.5 + rand(-0.15, 0.15), d: toD }, t: 0, dur: 0.85 }));
      sfx.lane();
    }
  }
  if (o.type === 'motyaKick' && onScreen && o.kicks < 3 && !g.over) {
    o.cool -= dt;
    if (o.cool <= 0) {
      o.cool = 0.9; o.kicks++;
      const dir = o.side < 0 ? 1 : -1;
      g.objs.push(makeObj('cone', o.lx, o.d + 30, { vx: dir * rand(1.4, 2.4), slide: true, spin: 0 }));
      sfx.cone();
    }
  }
  if (o.pose) o.pose = Math.max(0, o.pose - dt);
}

function hitBox(o) {
  switch (o.type) {
    case 'pothole': return { hw: o.w * 0.33, hh: o.h * 0.3 };
    case 'puddle': return { hw: o.w * 0.35, hh: o.h * 0.3 };
    case 'cone': return { hw: 11 * S, hh: 11 * S };
    case 'goose': return { hw: 14 * S, hh: 10 * S };
    case 'cow': return { hw: 30 * S, hh: 14 * S };
    case 'cat': case 'rat': return { hw: 9 * S, hh: 6 * S };
    case 'dog': case 'motyaDog': return { hw: 16 * S, hh: 8 * S };
    case 'granny': case 'passer': case 'motyaRun': return { hw: 14 * S, hh: 12 * S };
    case 'motyaBike': return { hw: 42 * S, hh: 12 * S };
    case 'motyaLying': return { hw: 14 * S, hh: 22 * S };
    case 'glass': return { hw: 14 * S, hh: 10 * S };
    case 'roller': return { hw: 24 * S, hh: 34 * S };
    default: return { hw: 16 * S, hh: 16 * S };
  }
}

/* ---------- Столкновения ---------- */
function collide(o) {
  const x = laneX(o.lx, o.d), y = yOf(o.d);
  switch (o.type) {
    case 'bucket':
      o.hitDone = true; o.dead = true;
      if (g.asphalt < g.bike.asphalt) { g.asphalt++; float(x, y, '+🪣'); } else { g.bonus += 20; float(x, PY - 60 * S, 'Склад полон +20'); }
      sfx.bucket();
      break;
    case 'coin':
      o.hitDone = true; o.dead = true;
      g.coins++; sfx.coin();
      float(x, PY - 50 * S, '+10 ₽', '#ffcc00');
      break;
    case 'shawarma':
      o.hitDone = true; o.dead = true;
      g.helmets = Math.min(g.bike.helmets, g.helmets + 1); g.shawarma++;
      sfx.heal(); talk(say('shawarma'), 'valera', 2, true);
      break;
    case 'energy':
      o.hitDone = true; o.dead = true;
      g.energy = 5; sfx.energy(); talk(say('energy'), 'valera', 2, true);
      if (Math.random() < 0.5) support('support', 2, 1600);
      break;
    case 'pothole':
    case 'puddle':
      if (g.bike.special === 'roller') { fix(o, true); break; }
      o.hitDone = true;
      if (o.type === 'puddle') {
        g.splash = 1.8; g.splashBlobs = makeSplash();
        if (!o.hidden) { talk(say('splash'), 'valera', 1); noise(0, 0.3, { freq: 1200, filter: 'bandpass', vol: 0.4 }); break; }
      }
      if (damage('pothole')) g.holesHit++;
      break;
    case 'cone':
      o.hitDone = true;
      o.fly = { vx: rand(-4, 4), vd: rand(500, 800) };
      g.cones++; g.bonus = Math.max(-1000, g.bonus - 10);
      sfx.cone();
      if (Math.random() < 0.6) talk(say('cone'), 'valera', 1);
      float(x, y, '−10');
      break;
    case 'goose':
      o.hitDone = true; o.fly = { vx: o.vx * 3, vd: 900 };
      if (g.energy > 0) { float(x, y, 'Гусь улетел'); break; }
      g.goose = 4; g.animals++;
      sfx.honk(); talk(say('goose'), 'valera', 2, true);
      g.shake = 0.3;
      break;
    case 'cat':
      o.hitDone = true; o.fly = { vx: o.vx * 2, vd: 600 };
      g.animals++; sfx.meow();
      if (g.asphalt > 0) { g.asphalt--; float(x, y, '−🪣', '#ff8b8b'); }
      talk(say('cat'), 'valera', 2, true);
      break;
    case 'rat':
      o.hitDone = true; o.fly = { vx: o.vx * 2, vd: 700 };
      g.animals++; sfx.squeak(); g.bonus -= 20; float(x, y, '−20');
      talk(say('rat'), 'valera', 1);
      break;
    case 'cow':
      o.hitDone = true; sfx.moo();
      if (damage('cow')) g.animals++;
      break;
    case 'dog':
      o.hitDone = true; sfx.bark();
      if (damage('dog')) g.animals++;
      break;
    case 'granny':
      o.hitDone = true; o.vx *= 0.3;
      if (damage(null)) { g.grannies++; talk(say('granny'), 'granny', 3, true); }
      break;
    case 'passer':
      o.hitDone = true; o.vx *= 0.3;
      if (damage(null)) talk(say('passer'), 'passer', 3, true);
      break;
    case 'glass':
      o.hitDone = true;
      damage('glass');
      break;
    case 'roller':
      o.hitDone = true;
      damage('roller');
      break;
    case 'motyaBike':
    case 'motyaRun':
    case 'motyaLying':
      o.hitDone = true;
      if (damage(null)) talk(say('motyaHit'), 'motya', 3, true);
      break;
    case 'motyaDog':
      o.hitDone = true; sfx.bark();
      if (damage('dog')) g.animals++;
      break;
  }
}

function support(cat, prio, delay = 0) {
  setTimeout(() => { if (g && !g.over && !g.paused) talk(say(cat), 'friend', prio, true); }, delay);
}

function damage(kind) {
  if (g.inv > 0 || g.energy > 0) return false;
  g.helmets--;
  g.repairStreak = 0;
  if (g.helmets > 0 && Math.random() < 0.4) support('supportHit', 2, 1900);
  g.hurt = 0.9; g.inv = 1.4; g.shake = 0.45;
  sfx.bump();
  if (kind) talk(say(kind), 'valera', 2, true);
  burst(laneX(g.lx, g.dist), PY - 20 * S, '#2a2a2a', 14);
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
  const x = laneX(o.lx, o.d), y = yOf(o.d);
  float(x, y - 10 * S, '+' + pts, g.event === 'commission' ? '#ffcc00' : '#fff');
  burst(x, y, '#222', 10);
  sfx.repair();
  if (!auto) g.repairStreak++;
  if (!auto && g.repairStreak % 4 === 0) support('support', 2, 500);
  else if (o.type === 'puddle') talk(txt(PHRASES.repair[3]), 'valera', 1);
  else if (!auto && Math.random() < 0.3) talk(say('repair'), 'valera', 1);
}

function tryRepair(o) {
  if (g.asphalt <= 0) {
    sfx.dud();
    if (g.t - g.lastSay > 1.5) talk(say('noAsphalt'), 'valera', 1, true);
    return;
  }
  g.asphalt--;
  fix(o, false);
}

function repairTargetAt(x, y) {
  let best = null, bd = Infinity;
  for (const o of g.objs) {
    if ((o.type !== 'pothole' && o.type !== 'puddle') || o.fixed || o.hitDone) continue;
    const ox = laneX(o.lx, o.d), oy = yOf(o.d);
    if (Math.abs(x - ox) < o.w / 2 + 22 * S && Math.abs(y - oy) < o.h / 2 + 22 * S) {
      const dd = Math.hypot(x - ox, y - oy);
      if (dd < bd) { bd = dd; best = o; }
    }
  }
  return best;
}

function nearestAhead() {
  let best = null;
  for (const o of g.objs) {
    if ((o.type !== 'pothole' && o.type !== 'puddle') || o.fixed || o.hitDone) continue;
    if (o.d > g.dist + 10 && yOf(o.d) > 0 && (!best || o.d < best.d)) best = o;
  }
  return best;
}

function move(dir) {
  if (!g || g.paused || g.over) return;
  if (g.goose > 0) dir = -dir;
  const nl = clamp(g.lane + dir, 0, 2);
  if (nl !== g.lane) { g.lane = nl; sfx.lane(); }
}

/* ---------- Эффекты и речь ---------- */
function float(x, y, text, color = '#fff') { g.floats.push({ x, y, text, color, life: 1.1 }); }
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) g.parts.push({ x, y, vx: rand(-160, 160), vy: rand(-320, -80), life: rand(0.4, 0.8), color, r: rand(2, 5) * S });
}
function makeSplash() {
  return Array.from({ length: 9 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(40, 110), shape: randomShape(10) }));
}
// Облачко с именем + голос. prio: 1 — болтовня, 2 — важное, 3 — очень важное
function talk(text, roleId = 'valera', prio = 1, force = false) {
  if (!g) return;
  if (!force && prio < 2 && g.t - g.lastSay < 1.2) return;
  g.lastSay = g.t;
  const role = ROLES[roleId] || ROLES.valera;
  const b = $('bubble');
  b.className = 'bubble ' + role.cls;
  b.innerHTML = '';
  const who = document.createElement('span'); who.className = 'who'; who.textContent = role.name;
  const t = document.createElement('span'); t.textContent = text;
  b.append(who, t);
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  g.bubbleT = Math.max(2.2, Math.min(4.5, text.length * 0.06));
  Voice.speak(text, roleId, prio);
}

function announce(text) {
  const el = $('zoneBanner');
  el.textContent = text;
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(announce.t);
  announce.t = setTimeout(() => el.classList.add('hidden'), 2600);
  sfx.event();
}

function startEvent() {
  const ev = pick(['commission', 'rain', 'herd']);
  g.event = ev;
  g.eventT = ev === 'rain' ? 12 : 10;
  g.nextEvent = rand(28, 42);
  const zt = zoneAt(g.dist).type;
  const herd = { highway: '🐄 Коровы вышли на трассу!', village: '🦆 Гуси идут стеной!', town: '🐈 Кошачья свадьба и крысиный забег!' }[zt];
  const text = { commission: '🕴️ Приехала комиссия! Заплатки ×3', rain: '🌧️ Дождь! Ямы прячутся под лужами', herd }[ev];
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
  Voice.stop();
  openDialog(`<h3>🚬 Перекур</h3>
    <p>Смена на паузе. Петрович не видит.</p>
    <button class="btn btn-go" id="resumeBtn" type="button">Работаем дальше</button>
    <button class="btn" id="quitBtn" type="button">Уйти со смены</button>`);
  $('resumeBtn').onclick = resumeGame;
  $('quitBtn').onclick = () => { closeDialog(); Voice.stop(); g = null; renderMenu(); showScreen('menu'); };
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
  const [roleId, pair] = BOSS_CALLS[Math.min(stage - 1, BOSS_CALLS.length - 1)];
  const caller = roleId === 'accountant' ? 'Людмила Петровна, бухгалтерия' : CAREER[careerIndex(save.career)].caller;
  const text = txt(pair);
  openDialog(`<div class="phone">📞</div>
    <div class="caller">Входящий: <b>${caller}</b></div>
    <p>«${text}»</p>
    <p><b>Этап ${stage + 1}: ${st.name}</b></p>
    <button class="btn btn-go" id="okBoss" type="button">Понял, работаю 🫡</button>`);
  $('okBoss').onclick = () => { Voice.stop(); resumeGame(); };
  setTimeout(() => { if (g && g.paused) Voice.speak(text, 'phone:' + roleId, 3); }, 700);
}

const HOWTO = `<h3>Как работать</h3>
  <ul>
    <li>⬅️➡️ <b>Ткни пальцем в левую или правую половину экрана</b> — перестроиться. На компьютере — стрелки ← →.</li>
    <li>🕳️ <b>Ткни пальцем прямо в яму</b> — заделать её. Нужно ведро асфальта 🪣. На компьютере — кликни мышкой по яме или нажми пробел.</li>
    <li>⛑️ Яма, корова, собака, бабушка, стекло, каток и Мотя — минус шлем. Шлемы кончились — смена окончена.</li>
    <li>🦆 Гусь путает лево и право. 🐈‍⬛ Кошка крадёт ведро. 🌯 Шаурма лечит. ⚡ Энергетик — неуязвимость.</li>
    <li>📷 В городе камеры: быстро едешь — штраф. 🍾 Увидел клуб — жди Мотю с бутылками.</li>
    <li>💰 Монеты ₽ — на новые мотоциклы в гараже.</li>
  </ul>`;

function showHowTo(inGame) {
  if (inGame) {
    if (g) g.paused = true;
    openDialog(HOWTO + '<button class="btn btn-go" id="howOk" type="button">Погнали!</button>');
    $('howOk').onclick = () => { save.tutorial = true; persist(); resumeGame(); };
  } else {
    $('videoTitle').textContent = '';
    $('video').classList.add('hidden');
    $('videoMissing').classList.remove('hidden');
    $('videoMissing').innerHTML = `<div class="dialog" style="border-top:none;padding:0;text-align:left">${HOWTO}</div>`;
    $('videoModal').classList.remove('hidden');
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
  const z = zoneAt(g.dist);
  setText('hZone', z.type === 'highway' ? '🛣️ Трасса' : '📍 ' + z.name);
  const sp = kmh(currentSpeed()), lim = ZONES[z.type].limit;
  setText('hSpeed', `${sp} км/ч`);
  setText('hLimit', String(lim));
  $('hSpeedBox').classList.toggle('over', sp > lim + 10);
  const badges = [];
  if (g.goose > 0) badges.push(`<span class="badge">🦆 ГУСЬ У РУЛЯ ${Math.ceil(g.goose)}</span>`);
  if (g.energy > 0) badges.push(`<span class="badge energy">⚡ НЕУЯЗВИМ ${Math.ceil(g.energy)}</span>`);
  if (g.event) badges.push(`<span class="badge">${{ commission: '🕴️', rain: '🌧️', herd: '🐾' }[g.event]} ${Math.ceil(g.eventT)} с</span>`);
  const html = badges.join('');
  if (hudCache.badges !== html) { hudCache.badges = html; $('badges').innerHTML = html; }
}

/* ================= Рисование ================= */
function drawRoad() {
  const SL = 8;
  const scroll = (g.dist * S) % 128;
  const canMove = typeof DOMMatrix !== 'undefined';
  for (const k of Object.keys(roadPatterns)) {
    const p = roadPatterns[k];
    if (p && canMove && p.setTransform) p.setTransform(new DOMMatrix().translate(0, scroll));
  }
  for (let y = -SL; y < H + SL; y += SL) {
    const dTop = dOf(y), dBot = dOf(y + SL), d = (dTop + dBot) / 2;
    const z = zoneAt(d), Z = ZONES[z.type];
    const L = roadL(d), R = L + roadW;
    ctx.fillStyle = Math.floor(d / 70) % 2 ? Z.ground : Z.ground2;
    ctx.fillRect(0, y, W, SL + 1);
    if (z.type === 'highway') {
      ctx.fillStyle = '#a39882'; ctx.fillRect(L - 18 * S, y, 18 * S, SL + 1); ctx.fillRect(R, y, 18 * S, SL + 1);
    } else if (z.type === 'village') {
      ctx.fillStyle = '#a08a62'; ctx.fillRect(L - 14 * S, y, 14 * S, SL + 1); ctx.fillRect(R, y, 14 * S, SL + 1);
    } else {
      ctx.fillStyle = Math.floor(d / 22) % 2 ? '#d3cdc1' : '#cbc5b8';
      ctx.fillRect(L - 34 * S, y, 30 * S, SL + 1); ctx.fillRect(R + 4 * S, y, 30 * S, SL + 1);
      ctx.fillStyle = '#efefea'; ctx.fillRect(L - 4 * S, y, 4 * S, SL + 1); ctx.fillRect(R, y, 4 * S, SL + 1);
    }
    ctx.fillStyle = roadPatterns[z.type] || Z.road;
    ctx.fillRect(L, y, roadW, SL + 1);
    if (z.type !== 'village') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(L + 4 * S, y, 3 * S, SL + 1); ctx.fillRect(R - 7 * S, y, 3 * S, SL + 1);
    }
    if (((d % 80) + 80) % 80 < 46) {
      ctx.fillStyle = z.type === 'village' ? 'rgba(216,210,196,.55)' : Z.line;
      ctx.fillRect(L + laneW - 1.5 * S, y, 3 * S, SL + 1); ctx.fillRect(L + 2 * laneW - 1.5 * S, y, 3 * S, SL + 1);
    }
    if (z.type === 'highway') {
      // отбойники
      ctx.fillStyle = '#7d828a'; ctx.fillRect(L - 13 * S, y, 2 * S, SL + 1); ctx.fillRect(R + 13 * S, y, 2 * S, SL + 1);
      ctx.fillStyle = '#c9cdd3'; ctx.fillRect(L - 12 * S, y, 4 * S, SL + 1); ctx.fillRect(R + 8 * S, y, 4 * S, SL + 1);
      if (Math.floor(dTop / 45) !== Math.floor(dBot / 45)) {
        ctx.fillStyle = '#5f646b'; ctx.fillRect(L - 15 * S, y, 5 * S, 5 * S); ctx.fillRect(R + 10 * S, y, 5 * S, 5 * S);
      }
    }
  }
  // разметка поверх: переходы, лежачие полицейские, трещины
  for (const s of g.scenery) {
    if (!s.road) continue;
    const y = yOf(s.d);
    if (y < -60 || y > H + 60) continue;
    const L = roadL(s.d);
    if (s.kind === 'zebra') {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (let x = L + 8 * S; x < L + roadW - 10 * S; x += 22 * S) ctx.fillRect(x, y - 18 * S, 12 * S, 36 * S);
    } else if (s.kind === 'bump') {
      for (let x = L, i = 0; x < L + roadW; x += 14 * S, i++) { ctx.fillStyle = i % 2 ? '#111' : '#f1c40f'; ctx.fillRect(x, y - 5 * S, 14 * S, 10 * S); }
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.5;
  for (const c of g.cracks) {
    const y = yOf(c.d); if (y < -40 || y > H + 40) continue;
    const x = laneX(c.lx, c.d);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(c.a) * c.l * S, y + Math.sin(c.a) * c.l * S);
    ctx.lineTo(x + Math.cos(c.a + 0.6) * c.l * 1.4 * S, y + Math.sin(c.a + 0.6) * c.l * 1.4 * S); ctx.stroke();
  }
}

function sceneryX(s) {
  const L = roadL(s.d);
  return s.side < 0 ? L - s.off * S : L + roadW + s.off * S;
}

function drawScenery() {
  // сначала плоское (поля, дворы), потом высокое
  const order = ['field', 'house', 'block', 'shop', 'club', 'well', 'car', 'pole', 'tree', 'lamp', 'km', 'sign'];
  const visible = g.scenery.filter(s => !s.road && s.kind !== 'banner' && yOf(s.d) > -200 && yOf(s.d) < H + 200);
  visible.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const s of visible) {
    const x = sceneryX(s), y = yOf(s.d);
    switch (s.kind) {
      case 'field': drawSunflowers(ctx, x, y, S, s); break;
      case 'house': drawHouse(ctx, x, y, S, s); break;
      case 'block': drawBlock(ctx, x, y, S, s); break;
      case 'shop': drawShop(ctx, x, y, S, s, s.side); break;
      case 'club': drawClub(ctx, x, y, S, s, s.side, g.t); break;
      case 'well': drawWell(ctx, x, y, S); break;
      case 'car': drawCar(ctx, x, y, S, s.color); break;
      case 'pole': drawPole(ctx, x, y, S); break;
      case 'tree': drawTree(ctx, x, y, S, s.tree); break;
      case 'lamp': drawLamp(ctx, x, y, S, -s.side); break;
      case 'km': drawKmPost(ctx, x, y, S, s.km); break;
      case 'sign': drawSign(ctx, x, y - 16 * S, S, s.sign, s.val); break;
    }
  }
}

function drawObject(o) {
  const x = laneX(o.lx, o.d), y = yOf(o.d);
  const oo = { ...o, x, y };
  const dir = o.vx >= 0 ? 1 : -1;
  switch (o.type) {
    case 'cone': drawCone(ctx, oo, S); break;
    case 'goose': drawGoose(ctx, oo, S, g.t); break;
    case 'cow': drawCow(ctx, x, y, S, g.t, dir); break;
    case 'cat': drawCat(ctx, x, y, S, g.t, dir, o.color); break;
    case 'rat': drawRat(ctx, x, y, S, g.t, dir); break;
    case 'dog': drawDog(ctx, x, y, S, g.t, dir, false); break;
    case 'motyaDog': drawDog(ctx, x, y, S, g.t, dir, true); break;
    case 'granny': drawGranny(ctx, oo, S, g.t); break;
    case 'passer': drawPerson(ctx, x, y, S, g.t, o.look, { run: true }); break;
    case 'roller': drawRoller(ctx, oo, S); break;
    case 'bucket': drawBucket(ctx, oo, S, g.t); break;
    case 'coin': drawCoin(ctx, oo, S, g.t); break;
    case 'shawarma': drawEmojiItem(ctx, oo, S, g.t, '🌯'); break;
    case 'energy': drawEmojiItem(ctx, oo, S, g.t, '⚡'); break;
    case 'shouter': drawPerson(ctx, x, y, S, g.t, o.look, { run: o.moving, wave: !o.moving, scale: 1.15 }); break;
    case 'motyaThrow': drawMotya(ctx, x, y, S * 1.15, g.t, o.pose > 0 ? 'throw' : (o.moving ? 'run' : 'throw')); break;
    case 'motyaKick': drawMotya(ctx, x, y, S * 1.15, g.t, 'kick'); break;
    case 'motyaRun': drawMotya(ctx, x, y, S * 1.15, g.t, 'run'); break;
    case 'motyaLying': drawMotya(ctx, x, y, S * 1.1, g.t, 'lying'); break;
    case 'motyaBike': drawMotyaBike(ctx, x, y, S, g.t, dir); break;
  }
}

function draw() {
  ctx.save();
  if (g.shake > 0) ctx.translate(rand(-6, 6) * g.shake * 2, rand(-6, 6) * g.shake * 2);
  drawRoad();

  // на асфальте
  for (const o of g.objs) {
    if (o.type !== 'pothole' && o.type !== 'puddle' && o.type !== 'glass') continue;
    const y = yOf(o.d); if (y < -80 || y > H + 80) continue;
    const oo = { ...o, x: laneX(o.lx, o.d), y };
    if (o.type === 'glass') drawGlass(ctx, oo, S);
    else if (o.type === 'puddle' && !o.fixed) drawPuddle(ctx, oo, S, g.t);
    else drawPothole(ctx, oo, S);
  }
  drawScenery();

  // всё остальное, дальние раньше ближних
  const rest = g.objs.filter(o => !['pothole', 'puddle', 'glass', 'bottle'].includes(o.type) && !o.dead && yOf(o.d) > -100 && yOf(o.d) < H + 100);
  rest.sort((a, b) => b.d - a.d);
  for (const o of rest) drawObject(o);

  // игрок
  const px = laneX(g.lx, g.dist);
  if (g.energy > 0) {
    ctx.fillStyle = `rgba(150, 80, 255, ${0.25 + Math.sin(g.t * 20) * 0.1})`;
    ctx.beginPath(); ctx.ellipse(px, PY - 6 * S, 42 * S, 60 * S, 0, 0, Math.PI * 2); ctx.fill();
  }
  const blink = g.inv > 0 && Math.floor(g.t * 14) % 2 === 0;
  if (!blink || g.over) {
    ctx.save();
    if (g.over) { ctx.translate(px, PY); ctx.rotate(g.overT * 6); ctx.translate(-px, -PY); }
    drawPlayer(ctx, px, PY, S, g.bike, g.t, { lean: g.lean, headTilt: g.headTilt, hurt: g.hurt, angle: roadAngle(g.dist) });
    ctx.restore();
  }

  // летящие бутылки
  for (const o of g.objs) {
    if (o.type !== 'bottle') continue;
    const k = clamp(o.t, 0, 1);
    const lx = o.from.lx + (o.to.lx - o.from.lx) * k, d = o.from.d + (o.to.d - o.from.d) * k;
    const arc = Math.sin(k * Math.PI);
    drawBottle(ctx, laneX(lx, d), yOf(d) - arc * 60 * S, S, k * 14, 1 + arc * 0.8);
  }

  // растяжки над дорогой
  for (const s of g.scenery) {
    if (s.kind !== 'banner' && s.kind !== 'arch') continue;
    const y = yOf(s.d); if (y < -60 || y > H + 60) continue;
    const L = roadL(s.d);
    if (s.kind === 'arch') drawArch(ctx, L - 16 * S, L + roadW + 16 * S, y, S, s.text, s.town);
    else drawBanner(ctx, L - 6 * S, L + roadW + 6 * S, y, S, s.text);
  }

  for (const p of g.parts) { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.r, p.r); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of g.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.font = `900 ${16 * S}px sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

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

  if (g.splash > 0) {
    ctx.globalAlpha = Math.min(1, g.splash / 1.2) * 0.85;
    ctx.fillStyle = '#5b4a33';
    for (const b of g.splashBlobs) { blobPath(ctx, b.x, b.y, b.r, b.r * 0.8, b.shape); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${g.flash * 2})`; ctx.fillRect(0, 0, W, H); }
}

/* ================= Итоги смены ================= */
function finishGame() {
  if (!g) return;
  const r = g;
  g = null;
  const km = r.dist / KM;
  const pts = Math.max(0, Math.floor(r.dist / 10) + r.bonus);
  const money = Math.max(0, r.coins * 10 - r.fines);
  const rankBefore = careerIndex(save.career);
  save.career += pts;
  const rankAfter = careerIndex(save.career);
  save.bank += money;
  save.shifts++;
  save.geese += r.animals;
  const newRec = pts > save.best;
  if (newRec) save.best = pts;
  if (km > save.bestKm) save.bestKm = Math.round(km * 100) / 100;

  const unlocked = [];
  const unlock = id => { if (!save.ach.includes(id)) { save.ach.push(id); unlocked.push(id); } };
  if (r.stage >= 1) unlock('stage2');
  if (r.repairs >= 25) unlock('fix25');
  if (save.geese >= 5) unlock('goose3');
  if (km >= 5) unlock('km5');
  if (r.stage >= 3) unlock('stage4');
  if (r.motya >= 3) unlock('motya3');
  if (save.shifts >= 10) unlock('shifts10');
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
    ['Встреч с животными', r.animals],
    ['Обижено бабушек', r.grannies],
    ['Встреч с Мотей', r.motya],
    ['Съедено шаурмы', r.shawarma],
    ['Штрафы с камер', r.fines + ' ₽'],
    ['Заработано', money + ' ₽'],
    ['ИТОГО ОЧКОВ', pts.toLocaleString('ru-RU')],
  ];
  $('actTable').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  $('actSat').textContent = sat + '%';
  const vtext = txt(verdict);
  $('actVerdict').textContent = vtext;
  const stamp = $('stamp');
  stamp.textContent = sat >= 50 ? 'ПРИНЯТО' : 'НА ДОРАБОТКУ';
  stamp.style.animation = 'none'; void stamp.offsetWidth; stamp.style.animation = '';
  setTimeout(sfx.stamp, 300);
  setTimeout(() => Voice.speak(vtext, 'chief', 3), 900);

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
  $('voiceBtn').textContent = save.voice ? '🗣️ Голоса' : '🤐 Голоса';
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
    const poster = a.video.replace('.mp4', '.jpg');
    el.innerHTML = open
      ? `<h3>🎬 ${a.clip}: «${a.title}»</h3>${a.caption ? `<div class="ach-thumb"><img src="${poster}" alt="" onerror="this.parentNode.remove()"><span>▶</span></div><p class="ach-cap">${a.caption}</p>` : ''}<p>${a.desc} — выполнено ✅</p><button class="btn" type="button">▶ Смотреть</button>`
      : `<h3>🔒 ${a.clip}</h3><p>Чтобы открыть: ${a.desc.toLowerCase()}</p>`;
    if (open) {
      el.querySelector('button').onclick = () => openVideo(a);
      const th = el.querySelector('.ach-thumb'); if (th) th.onclick = () => openVideo(a);
    }
    box.appendChild(el);
  });
}

function openVideo(a) {
  const v = $('video');
  $('videoTitle').textContent = `${a.clip}: «${a.caption || a.title}»`;
  v.poster = a.video.replace('.mp4', '.jpg');
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
  Voice.warm();
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
$('resGarage').addEventListener('click', () => { Voice.stop(); renderGarage(); showScreen('garage'); });
$('archiveBtn').addEventListener('click', () => { renderArchive(); showScreen('archive'); });
$('resMenu').addEventListener('click', () => { Voice.stop(); renderMenu(); showScreen('menu'); });
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { renderMenu(); showScreen('menu'); }));
$('howBtn').addEventListener('click', () => showHowTo(false));
$('videoClose').addEventListener('click', closeVideo);
$('soundBtn').addEventListener('click', () => { save.sound = !save.sound; persist(); renderMenu(); if (save.sound) sfx.coin(); });
$('voiceBtn').addEventListener('click', () => {
  save.voice = !save.voice; Voice.enabled = save.voice;
Voice.uncensored = save.mat; persist(); renderMenu();
  if (save.voice) { Voice.warm(); Voice.speak(save.mat ? 'Голоса включены, бл*!' : 'Голоса включены!', 'valera', 3); }
  else Voice.stop();
});
$('matToggle').addEventListener('change', e => {
  save.mat = e.target.checked; persist();
  Voice.uncensored = save.mat;
  if (save.mat) { sfx.honk(); $('tip').textContent = 'Режим прораба включён. Валера больше не сдерживается.'; Voice.warm(); Voice.speak('Режим прораба, бл*! Ну всё, п*здец, понеслась!', 'prorab', 3); }
  else $('tip').textContent = 'Режим прораба выключен. Валера снова культурный.';
});

renderMenu();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* без офлайна тоже работает */ }); });
}
