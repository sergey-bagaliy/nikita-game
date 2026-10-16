'use strict';

/* ================= Настройки ================= */
const TRAIN_QUESTIONS = 10;      // примеров в тренировке (один полёт)
const SPEED_TIME = 60000;        // топлива на 60 секунд в режиме «На скорость»
const NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9];
const STORAGE_KEY = 'nikita-multiply-v1';

// Звания: сколько всего очков нужно набрать. По званиям открываются самолёты (planes.js).
const RANKS = [
  { at: 0,    name: 'Пассажир',            icon: '🧳' },
  { at: 100,  name: 'Курсант',             icon: '🎒' },
  { at: 250,  name: 'Пилот-стажёр',        icon: '🪪' },
  { at: 500,  name: 'Второй пилот',        icon: '🧭' },
  { at: 800,  name: 'Командир экипажа',    icon: '👨‍✈️' },
  { at: 1200, name: 'Пилот первого класса', icon: '🎖️' },
  { at: 1800, name: 'Ас',                  icon: '🦅' },
  { at: 2600, name: 'Лётчик-испытатель',   icon: '🧪' },
  { at: 3600, name: 'Капитан неба',        icon: '🌟' },
  { at: 5000, name: 'Легенда неба',        icon: '👑' },
];

// Куда летим в тренировке (вылет всегда из Краснодара)
const CITIES = [
  { to: 'Москва',           at: 'в Москве' },
  { to: 'Сочи',             at: 'в Сочи' },
  { to: 'Санкт-Петербург',  at: 'в Санкт-Петербурге' },
  { to: 'Казань',           at: 'в Казани' },
  { to: 'Калининград',      at: 'в Калининграде' },
  { to: 'Мурманск',         at: 'в Мурманске' },
  { to: 'Новосибирск',      at: 'в Новосибирске' },
  { to: 'Владивосток',      at: 'во Владивостоке' },
  { to: 'Екатеринбург',     at: 'в Екатеринбурге' },
  { to: 'Мин. Воды',        at: 'в Минеральных Водах' },
];

const PRAISE = ['Отличный манёвр!', 'Курс верный!', 'Высший пилотаж!', 'Так держать, пилот!', 'Точно в цель!', 'Полёт нормальный!', 'Супер, капитан!', 'Молодец!'];
const SUPPORT = [
  'Небольшая турбулентность! Разберёмся:',
  'Чуть сбились с курса — сейчас поправим:',
  'Не страшно, пилот! Смотри, как посчитать:',
  'Ошибаться — нормально, так учатся лётчики!',
];
const DOT_COLORS = ['#2f6fed', '#22b07d', '#ff8a3d', '#e05bb5', '#2bb3d6', '#9b6cf0', '#f2b80c', '#ef6461', '#4caf50', '#8d6e63'];

/* ================= Сохранение в браузере ================= */
const DEFAULTS = { points: 0, stars: 0, bestSpeed: 0, bestStreak: 0, games: 0, selected: [2, 3, 4, 5], sound: true, plane: 'biplane' };

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Object.assign({}, DEFAULTS, saved || {});
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}
function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* приватный режим — просто не сохраняем */ }
}

const data = loadData();
data.selected = data.selected.filter(n => NUMBERS.includes(n));
if (!data.selected.length) data.selected = DEFAULTS.selected.slice();

/* ================= Помощники ================= */
const $ = id => document.getElementById(id);
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function plural(n, one, few, many) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}
function rankIndex(points) {
  let i = 0;
  while (i + 1 < RANKS.length && points >= RANKS[i + 1].at) i++;
  return i;
}
function isUnlocked(plane) {
  return rankIndex(data.points) >= plane.rank;
}
function currentPlaneId() {
  const p = planeById(data.plane);
  return isUnlocked(p) ? p.id : PLANES[0].id;
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}
function restartAnimation(el, cls) {
  el.classList.remove('takeoff', 'shake', 'hop');
  void el.offsetWidth; // перезапуск CSS-анимации
  el.classList.add(cls);
}

/* ================= Звуки (синтезируются в браузере, без файлов) ================= */
let audio = null;
let noiseBuf = null;

function ac() {
  if (!data.sound) return null;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  } catch (e) {
    return null;
  }
}

// Один тон с плавным затуханием
function tone(freq, start, dur, opts = {}) {
  const a = ac();
  if (!a) return;
  const { type = 'sine', vol = 0.18, to } = opts;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Шум ветра («вжух»): от низкого к высокому
function whoosh(start, dur, from, to, vol) {
  const a = ac();
  if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + start;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const sounds = {
  // взлёт: нарастающий гул мотора + ветер
  takeoff() {
    tone(90, 0, 1.3, { type: 'sawtooth', vol: 0.05, to: 260 });
    whoosh(0, 1.3, 250, 3000, 0.35);
  },
  // «дзинь» как колокольчик
  ding() {
    tone(1568, 0, 0.6, { vol: 0.16 });
    tone(2349, 0, 0.35, { vol: 0.06 });
  },
  // мягкий сигнал ошибки — не страшный
  oops() {
    tone(392, 0, 0.22, { type: 'triangle', vol: 0.14 });
    tone(330, 0.2, 0.3, { type: 'triangle', vol: 0.14 });
  },
  // гудок «бип-бип» за серию
  horn() {
    [0, 0.18].forEach(s => {
      tone(440, s, 0.14, { type: 'triangle', vol: 0.16 });
      tone(554, s, 0.14, { type: 'triangle', vol: 0.12 });
    });
  },
  // «динь-дон», как в салоне самолёта
  chime(start = 0) {
    tone(1047, start, 0.9, { vol: 0.14 });
    tone(831, start + 0.45, 1.2, { vol: 0.14 });
  },
  // посадка: «динь-дон» и мелодия, если есть звёзды
  landing(stars) {
    sounds.chime();
    if (stars > 0) [523, 659, 784, 1047].slice(0, stars + 1).forEach((f, i) => tone(f, 1.3 + i * 0.15, 0.3, { vol: 0.14 }));
  },
  // новый самолёт в ангаре
  fanfare(start = 0) {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, start + i * 0.12, i === 3 ? 0.6 : 0.2, { type: 'triangle', vol: 0.16 }));
  },
};

/* ================= Меню ================= */
function renderMenu() {
  const ri = rankIndex(data.points);
  const rank = RANKS[ri];
  const next = RANKS[ri + 1];
  $('levelIcon').textContent = rank.icon;
  $('levelName').textContent = rank.name;
  if (next) {
    const need = next.at - data.points;
    $('levelSub').textContent = `До звания «${next.name}»: ${need} ${plural(need, 'очко', 'очка', 'очков')}`;
    $('levelBar').style.width = ((data.points - rank.at) / (next.at - rank.at) * 100) + '%';
  } else {
    $('levelSub').textContent = 'Самое высокое звание! Ты настоящая легенда неба!';
    $('levelBar').style.width = '100%';
  }
  $('statStars').textContent = data.stars;
  $('statPoints').textContent = data.points;
  $('statBest').textContent = data.bestSpeed;
  $('statStreak').textContent = data.bestStreak;
  $('soundBtn').textContent = data.sound ? '🔊' : '🔇';
  $('headerPlane').innerHTML = planeSVG(currentPlaneId());

  const box = $('numbers');
  box.innerHTML = '';
  NUMBERS.forEach(n => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'num-btn' + (data.selected.includes(n) ? ' on' : '');
    b.textContent = n;
    b.setAttribute('aria-pressed', data.selected.includes(n));
    b.addEventListener('click', () => toggleNumber(n));
    box.appendChild(b);
  });
  updateHint();
  renderHangar();
}

function renderHangar() {
  const ri = rankIndex(data.points);
  const chosen = currentPlaneId();
  const box = $('hangar');
  box.innerHTML = '';
  PLANES.forEach(p => {
    const open = ri >= p.rank;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'plane-tile' + (open ? '' : ' locked') + (p.id === chosen ? ' chosen' : '');
    b.innerHTML = planeSVG(p.id) + `<span>${open ? p.name : '🔒 ' + RANKS[p.rank].name}</span>`;
    b.addEventListener('click', () => {
      if (!open) {
        $('hangarHint').textContent = `Этот самолёт откроется на звании «${RANKS[p.rank].name}». Тренируйся — и он будет твоим!`;
        return;
      }
      data.plane = p.id;
      saveData();
      renderMenu();
      sounds.ding();
      $('hangarHint').textContent = `Летим на самолёте «${p.name}»!`;
    });
    box.appendChild(b);
  });
  const nextPlane = PLANES.find(p => p.rank > ri);
  $('hangarHint').textContent = nextPlane
    ? `Следующий самолёт откроется на звании «${RANKS[nextPlane.rank].name}»`
    : 'Все самолёты собраны! 🎉';
}

function updateHint(msg) {
  const sel = data.selected.slice().sort((a, b) => a - b);
  $('numHint').textContent = msg || ('Учим умножение на ' + sel.join(', '));
}

function toggleNumber(n) {
  if (data.selected.includes(n)) {
    if (data.selected.length === 1) {
      updateHint('Нужно оставить хотя бы одно число 🙂');
      return;
    }
    data.selected = data.selected.filter(x => x !== n);
  } else {
    data.selected.push(n);
  }
  saveData();
  renderMenu();
}

/* ================= Полёт (игра) ================= */
let game = null;

function startGame(mode) {
  stopTimers();
  game = {
    mode,
    city: pick(CITIES),
    asked: 0,
    correct: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    mistakes: [],
    lastKey: '',
    locked: false,
    paused: false,
    timeLeft: SPEED_TIME,
    lastTick: 0,
    timerId: null,
    nextId: null,
  };
  const speed = mode === 'speed';
  $('flight').classList.toggle('speed', speed);
  $('fuel').classList.toggle('hidden', !speed);
  $('fuel').classList.remove('low', 'empty');
  $('fromCity').textContent = speed ? '🛫 Взлёт' : 'Краснодар';
  $('toCity').textContent = speed ? 'Посадка 🛬' : game.city.to;
  $('flightPlaneInner').innerHTML = planeSVG(currentPlaneId());
  setFlightProgress(0);
  $('hudScore').textContent = '0';
  $('streak').innerHTML = '&nbsp;';
  showScreen('game');
  restartAnimation($('flightPlane'), 'takeoff');
  sounds.takeoff();
  nextQuestion();
  if (speed) {
    game.lastTick = performance.now();
    game.timerId = setInterval(tick, 100);
  }
  updateHud();
}

function setFlightProgress(p) {
  $('flightPlane').style.setProperty('--p', p);
  $('routeDone').style.width = `calc(${p} * (100% - 72px) + 36px)`;
}

function stopTimers() {
  if (!game) return;
  clearInterval(game.timerId);
  clearTimeout(game.nextId);
}

function tick() {
  const now = performance.now();
  if (!game.paused) game.timeLeft -= now - game.lastTick;
  game.lastTick = now;
  if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    updateHud();
    finishGame();
    return;
  }
  updateHud();
}

function updateHud() {
  if (game.mode === 'speed') {
    const sec = Math.ceil(game.timeLeft / 1000);
    $('hudInfo').textContent = `✅ ${game.correct} верно`;
    $('fuelSec').textContent = sec;
    $('fuelBar').style.width = (game.timeLeft / SPEED_TIME * 100) + '%';
    $('fuel').classList.toggle('low', sec <= 20 && sec > 10);
    $('fuel').classList.toggle('empty', sec <= 10);
    setFlightProgress(1 - game.timeLeft / SPEED_TIME);
  } else {
    $('hudInfo').textContent = `Пример ${Math.min(game.asked, TRAIN_QUESTIONS)} из ${TRAIN_QUESTIONS}`;
  }
}

function makeQuestion() {
  let a, b, key, tries = 0;
  do {
    const n = pick(data.selected);
    const k = rand(1, 10);
    // иногда меняем местами: 7 × 3 и 3 × 7
    if (Math.random() < 0.5) { a = n; b = k; } else { a = k; b = n; }
    key = a + 'x' + b;
    tries++;
  } while (key === game.lastKey && tries < 20);
  game.lastKey = key;
  return { a, b, answer: a * b };
}

function makeOptions(a, b) {
  const ans = a * b;
  const set = new Set([ans]);
  // правдоподобные неправильные ответы: соседи по таблице и ±1, ±2
  const candidates = shuffle([a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10]);
  for (const c of candidates) {
    if (set.size >= 4) break;
    if (c > 0) set.add(c);
  }
  while (set.size < 4) set.add(Math.max(1, ans + rand(-12, 12)));
  return shuffle([...set]);
}

function nextQuestion() {
  if (game.mode === 'train' && game.asked >= TRAIN_QUESTIONS) {
    finishGame();
    return;
  }
  game.asked++;
  game.q = makeQuestion();
  game.locked = false;
  game.paused = false;

  $('question').textContent = `${game.q.a} × ${game.q.b} = ?`;
  $('feedback').innerHTML = '&nbsp;';
  $('feedback').className = 'feedback';
  $('explain').classList.add('hidden');
  $('answers').classList.remove('hidden');

  const options = makeOptions(game.q.a, game.q.b);
  document.querySelectorAll('.answer').forEach((btn, i) => {
    btn.textContent = options[i];
    btn.className = 'answer';
    btn.disabled = false;
  });
  updateHud();
}

function answer(btn) {
  if (!game || game.locked) return;
  game.locked = true;
  const value = Number(btn.textContent);
  const { a, b, answer: right } = game.q;
  document.querySelectorAll('.answer').forEach(x => { x.disabled = true; });
  $('question').innerHTML = `${a} × ${b} = <span class="ans">${right}</span>`;
  // в тренировке самолёт продвигается после каждого примера
  if (game.mode === 'train') setFlightProgress(game.asked / TRAIN_QUESTIONS);

  if (value === right) {
    game.correct++;
    game.streak++;
    game.maxStreak = Math.max(game.maxStreak, game.streak);
    const bonus = game.streak >= 3 ? 5 : 0;
    game.score += 10 + bonus;
    btn.classList.add('correct');
    $('feedback').textContent = pick(PRAISE) + ' +' + (10 + bonus);
    $('feedback').className = 'feedback good';
    $('streak').textContent = game.streak >= 3 ? `🔥 ${game.streak} подряд! Бонус +5` : ' ';
    $('hudScore').textContent = game.score;
    if (game.streak >= 3) {
      sounds.horn();
      restartAnimation($('flightPlane'), 'hop');
    } else {
      sounds.ding();
    }
    updateHud();
    game.nextId = setTimeout(nextQuestion, game.mode === 'speed' ? 450 : 800);
  } else {
    game.streak = 0;
    game.paused = true; // пока смотрим объяснение, топливо не тратится
    game.mistakes.push({ a, b, right });
    btn.classList.add('wrong');
    document.querySelectorAll('.answer').forEach(x => {
      if (Number(x.textContent) === right) x.classList.add('correct');
    });
    $('feedback').textContent = pick(SUPPORT);
    $('feedback').className = 'feedback oops';
    $('streak').innerHTML = '&nbsp;';
    restartAnimation($('flightPlane'), 'shake');
    sounds.oops();
    game.nextId = setTimeout(() => showExplain(a, b, right), 700);
  }
}

function showExplain(a, b, right) {
  $('answers').classList.add('hidden');
  const times = plural(a, 'раз', 'раза', 'раз');
  $('explainTitle').textContent = `${a} × ${b} — это ${a} ${times} по ${b}:`;
  const parts = Array(a).fill(b);
  $('explainSum').textContent = a === 1 ? `${b} = ${right}` : `${parts.join(' + ')} = ${right}`;
  // считаем по шагам: 4, 8, 12
  const steps = [];
  for (let i = 1; i <= a; i++) steps.push(b * i);
  $('explainSteps').textContent = a > 1 ? 'Считаем: ' + steps.join(' → ') : '';

  // картинка из кружочков: a рядов по b кружков
  const dots = $('dots');
  dots.innerHTML = '';
  const size = b > 8 || a > 8 ? 14 : 18;
  for (let r = 0; r < a; r++) {
    const row = document.createElement('div');
    row.className = 'dot-row';
    for (let c = 0; c < b; c++) {
      const d = document.createElement('span');
      d.className = 'dot';
      d.style.background = DOT_COLORS[r % DOT_COLORS.length];
      d.style.width = d.style.height = size + 'px';
      row.appendChild(d);
    }
    dots.appendChild(row);
  }
  $('explain').classList.remove('hidden');
  $('nextBtn').focus({ preventScroll: true });
}

function continueAfterExplain() {
  if (!game) return;
  if (game.mode === 'speed') game.lastTick = performance.now();
  nextQuestion();
}

/* ================= Посадка (итоги) ================= */
function starsFor(mode, correct) {
  if (mode === 'train') return correct >= 10 ? 3 : correct >= 8 ? 2 : correct >= 5 ? 1 : 0;
  return correct >= 20 ? 3 : correct >= 12 ? 2 : correct >= 6 ? 1 : 0;
}

function finishGame() {
  stopTimers();
  const g = game;
  game = null;

  const stars = starsFor(g.mode, g.correct);
  const rankBefore = rankIndex(data.points);
  data.points += g.score;
  data.stars += stars;
  data.games++;
  const newStreak = g.maxStreak > data.bestStreak;
  if (newStreak) data.bestStreak = g.maxStreak;
  let newRecord = false;
  if (g.mode === 'speed' && g.correct > data.bestSpeed) {
    newRecord = true;
    data.bestSpeed = g.correct;
  }
  const rankAfter = rankIndex(data.points);
  saveData();

  $('resPlace').textContent = g.mode === 'train'
    ? `🛬 Посадка ${g.city.at}!`
    : '⛽ Топливо закончилось — мягкая посадка!';

  $('resStars').innerHTML = [0, 1, 2].map(i =>
    `<span class="s${i < stars ? '' : ' off'}" style="animation-delay:${i * 0.2}s">⭐</span>`).join('');

  const titles = [
    'Ты молодец, что тренируешься!',
    'Хороший полёт!',
    'Отличный полёт! 💪',
    'Высший пилотаж, Никита! 🏆',
  ];
  const texts = [
    'Каждый лётчик начинал с учебных полётов. Полетим ещё раз?',
    'Ещё немного тренировок — и звёзд станет больше!',
    'Совсем чуть-чуть до трёх звёзд!',
    'Три звезды! Ты настоящий ас умножения!',
  ];
  $('resTitle').textContent = titles[stars];
  $('resText').textContent = texts[stars];

  $('resStats').innerHTML =
    `<div><b>${g.correct}</b><span>${g.mode === 'train' ? 'верно из ' + TRAIN_QUESTIONS : 'верно за 60 сек'}</span></div>` +
    `<div><b>+${g.score}</b><span>очков</span></div>` +
    `<div><b>${g.maxStreak}</b><span>🔥 лучшая серия</span></div>`;

  $('resRecord').classList.toggle('hidden', !(newRecord || newStreak));
  $('resRecord').textContent = newRecord
    ? `🎉 Новый рекорд на скорость: ${g.correct}!`
    : `🎉 Новый рекорд серии: ${g.maxStreak} подряд!`;

  const rank = RANKS[rankAfter];
  $('resLevel').classList.toggle('hidden', rankAfter === rankBefore);
  $('resLevel').textContent = `${rank.icon} Новое звание: «${rank.name}»!`;

  // новый самолёт в ангаре
  const fresh = PLANES.filter(p => p.rank > rankBefore && p.rank <= rankAfter);
  const box = $('resPlane');
  if (fresh.length) {
    const p = fresh[fresh.length - 1];
    $('resPlanePic').innerHTML = planeSVG(p.id);
    $('resPlaneText').textContent = `🎁 Новый самолёт в ангаре: «${p.name}»!`;
    const btn = $('resPlaneBtn');
    btn.dataset.id = p.id;
    btn.disabled = false;
    btn.textContent = '✈️ Лететь на нём';
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }

  // какие примеры стоит повторить
  const seen = new Set();
  const uniq = g.mistakes.filter(m => {
    const k = m.a + 'x' + m.b;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const mBox = $('resMistakes');
  if (uniq.length) {
    mBox.innerHTML = '<b>Давай запомним:</b>' + uniq.map(m => `<div>${m.a} × ${m.b} = ${m.right}</div>`).join('');
    mBox.classList.remove('hidden');
  } else {
    mBox.classList.add('hidden');
  }

  $('againBtn').dataset.mode = g.mode;
  showScreen('result');
  sounds.landing(stars);
  if (fresh.length) sounds.fanfare(2.2);
}

/* ================= Кнопки ================= */
document.querySelectorAll('.answer').forEach(btn => btn.addEventListener('click', () => answer(btn)));
document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', () => startGame(btn.dataset.mode)));
$('nextBtn').addEventListener('click', continueAfterExplain);
$('quitBtn').addEventListener('click', () => {
  stopTimers();
  game = null;
  renderMenu();
  showScreen('menu');
});
$('againBtn').addEventListener('click', e => startGame(e.currentTarget.dataset.mode || 'train'));
$('menuBtn').addEventListener('click', () => { renderMenu(); showScreen('menu'); });
$('resPlaneBtn').addEventListener('click', e => {
  data.plane = e.currentTarget.dataset.id;
  saveData();
  e.currentTarget.disabled = true;
  e.currentTarget.textContent = 'Выбран ✅';
  sounds.ding();
});
$('allBtn').addEventListener('click', () => {
  data.selected = NUMBERS.slice();
  saveData();
  renderMenu();
});
$('soundBtn').addEventListener('click', () => {
  data.sound = !data.sound;
  saveData();
  renderMenu();
  if (data.sound) sounds.chime();
});

renderMenu();
