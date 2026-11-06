'use strict';

/* ================= Настройки ================= */
const TRAIN_QUESTIONS = 10;      // примеров в тренировке (один полёт)
const SPEED_TIME = 60000;        // топлива на 60 секунд в режиме «На скорость»
const BOSS_QUESTIONS = 10;       // столько верных ответов подряд нужно, чтобы победить босса
const FIX_POOL = 4;              // сколько трудных примеров берём в один «повтор ошибок»
const FIX_MAX = 15;              // и не больше стольких вопросов за один повтор
const FIX_RUN = 3;               // решил правильно 3 раза подряд — пример больше не трудный
const KNOWN_RUN = 2;             // решил правильно 2 раза подряд — «знаю»
const HARD_CHANCE = 0.3;         // как часто в обычном полёте попадается трудный пример
const DAILY_GOAL = 20;           // задание дня: столько верных ответов
const DAILY_BONUS = 30;          // очков за задание дня
const BOSS_BONUS = 50;           // очков за победу над боссом
const TICKET_EVERY = 10;         // столько верных ответов = 1 билет на мини-игру
const ADD_QUESTIONS = 10;        // примеров на сложение в одном полёте
const NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9];
const STORAGE_KEY = 'nikita-multiply-v1';

// Звания: одно за каждый сданный экзамен (бой с Боссом на одном числе), последнее — за финальный экзамен.
// С каждым званием открывается новый самолёт (planes.js) и его мини-игра (arcade.js).
const RANKS = [
  { name: 'Пассажир',            icon: '🧳' },
  { name: 'Курсант',             icon: '🎒' },
  { name: 'Пилот-стажёр',        icon: '🪪' },
  { name: 'Второй пилот',        icon: '🧭' },
  { name: 'Командир экипажа',    icon: '👨‍✈️' },
  { name: 'Пилот первого класса', icon: '🎖️' },
  { name: 'Ас',                  icon: '🦅' },
  { name: 'Лётчик-испытатель',   icon: '🧪' },
  { name: 'Капитан неба',        icon: '🌟' },
  { name: 'Легенда неба',        icon: '👑' },
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
const BOSS_PRAISE = ['Бах! Попал!', 'Точный удар!', 'Туче досталось!', 'Ещё удар!', 'Так её!', 'Прямо в цель!'];
const SUPPORT = [
  'Небольшая турбулентность! Разберёмся:',
  'Чуть сбились с курса — сейчас поправим:',
  'Не страшно, пилот! Смотри, как посчитать:',
  'Ошибаться — нормально, так учатся лётчики!',
];
const DOT_COLORS = ['#2f6fed', '#22b07d', '#ff8a3d', '#e05bb5', '#2bb3d6', '#9b6cf0', '#f2b80c', '#ef6461', '#4caf50', '#8d6e63'];

/* ================= Сохранение в браузере ================= */
function defaults() {
  return {
    points: 0, stars: 0, bestSpeed: 0, bestStreak: 0, games: 0,
    selected: [2, 3, 4, 5], sound: true, plane: 'an2',
    exams: [],          // числа, по которым сдан экзамен (по порядку)
    finalExam: false,   // сдан финальный экзамен на всю таблицу
    tickets: 1,         // билеты на мини-игры
    ticketProgress: 0,  // верных ответов к следующему билету
    arcadeBest: {},     // рекорды мини-игр
    arcadeLevel: {},    // до какого уровня открыта каждая мини-игра (1–5)
    arcadeWon: {},      // мини-игры, пройденные целиком
    addLevel: 'two',    // сложение: two / three / mix
    facts: {},          // как решается каждый пример: «3x7»: { ok, bad, run }
    trophies: [],       // кубки за боссов: { b: номер босса, n: [числа], d: дата }
    bossBest: 0,        // лучший результат в бою с боссом (из 10)
    daily: { date: '', correct: 0, done: false },
    dayStreak: 0,       // сколько дней подряд выполнено задание дня
    lastGoalDate: '',
  };
}

function loadData() {
  const d = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') Object.assign(d, saved);
  } catch (e) { /* испорченные данные — начинаем заново */ }
  if (!Array.isArray(d.selected)) d.selected = defaults().selected;
  d.selected = d.selected.filter(n => NUMBERS.includes(n));
  if (!d.selected.length) d.selected = defaults().selected;
  if (!d.facts || typeof d.facts !== 'object') d.facts = {};
  if (!Array.isArray(d.trophies)) d.trophies = [];
  if (!d.daily || typeof d.daily !== 'object') d.daily = defaults().daily;
  if (!Array.isArray(d.exams)) d.exams = [];
  d.exams = d.exams.filter((n, i) => NUMBERS.includes(n) && d.exams.indexOf(n) === i);
  if (!d.arcadeBest || typeof d.arcadeBest !== 'object') d.arcadeBest = {};
  if (!d.arcadeLevel || typeof d.arcadeLevel !== 'object') d.arcadeLevel = {};
  if (!d.arcadeWon || typeof d.arcadeWon !== 'object') d.arcadeWon = {};
  if (!Number.isFinite(d.tickets) || d.tickets < 0) d.tickets = 0;
  if (!Number.isFinite(d.ticketProgress) || d.ticketProgress < 0 || d.ticketProgress >= TICKET_EVERY) d.ticketProgress = 0;
  if (!PLANES.some(p => p.id === d.plane)) d.plane = 'an2'; // старые самолёты заменены новыми
  return d;
}
function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* приватный режим — просто не сохраняем */ }
}

const data = loadData();

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
// Уровень = сколько экзаменов сдано (+1 за финальный). От него зависят звание, самолёты и игры.
function level() {
  return Math.min(RANKS.length - 1, data.exams.length + (data.finalExam ? 1 : 0));
}
function isUnlocked(plane) {
  return level() >= plane.level;
}
// Какой экзамен будет в бою с этими числами: число, 'final' или null (обычный бой за кубок)
function examFor(sel) {
  if (sel.length === 1 && !data.exams.includes(sel[0])) return sel[0];
  if (sel.length === NUMBERS.length && data.exams.length >= NUMBERS.length && !data.finalExam) return 'final';
  return null;
}
// Сколько ещё экзаменов нужно, чтобы открыть уровень lv (самолёт и игру)
function unlockText(lv) {
  if (lv >= RANKS.length - 1) return data.exams.length >= NUMBERS.length ? 'Финальный экзамен' : 'Все 8 экзаменов и финал';
  const need = lv - level();
  return `Сдай ещё ${need} ${plural(need, 'экзамен', 'экзамена', 'экзаменов')}`;
}
// Что делать дальше, чтобы получить следующее звание
function nextStepText() {
  if (data.finalExam) return 'Самое высокое звание! Ты настоящая легенда неба! 👑';
  if (data.exams.length >= NUMBERS.length) return 'Осталось сдать финальный экзамен — кнопка 🏁 ниже';
  return 'Новое звание — за экзамен. Нажми на число в карточке «🎓 Экзамены» ниже';
}
function currentPlaneId() {
  const p = planeById(data.plane);
  return isUnlocked(p) ? p.id : PLANES[0].id;
}
const ANIMS = ['takeoff', 'shake', 'hop', 'fly', 'hurt', 'laugh', 'defeated', 'show'];
function restartAnimation(el, cls) {
  el.classList.remove(...ANIMS);
  void el.offsetWidth; // перезапуск CSS-анимации
  el.classList.add(cls);
}
function sortedSelected() {
  return data.selected.slice().sort((a, b) => a - b);
}

/* ---- Дни и задание дня ---- */
function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function today() { return dateKey(new Date()); }
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}
function dailyState() {
  if (data.daily.date !== today()) data.daily = { date: today(), correct: 0, done: false };
  return data.daily;
}
function currentDayStreak() {
  return data.lastGoalDate === today() || data.lastGoalDate === yesterday() ? data.dayStreak : 0;
}
function completeDaily() {
  if (data.lastGoalDate === today()) return;
  data.dayStreak = data.lastGoalDate === yesterday() ? data.dayStreak + 1 : 1;
  data.lastGoalDate = today();
  data.points += DAILY_BONUS;
}

/* ---- Как решается каждый пример (для «Моих ошибок» и таблицы) ---- */
function factKey(a, b) { return Math.min(a, b) + 'x' + Math.max(a, b); }
function getFact(a, b) { return data.facts[factKey(a, b)]; }
function isHard(f) { return !!f && f.bad > 0 && f.run < FIX_RUN; }
function factState(f) {
  if (!f || f.ok + f.bad === 0) return 'new';
  if (isHard(f)) return 'hard';
  return f.run >= KNOWN_RUN ? 'known' : 'learning';
}
function splitKey(key) { return key.split('x').map(Number); }

// Записываем ответ. Возвращает true, если трудный пример только что «исправлен».
function recordAnswer(a, b, ok) {
  const key = factKey(a, b);
  const f = data.facts[key] || (data.facts[key] = { ok: 0, bad: 0, run: 0 });
  if (ok) {
    const wasHard = isHard(f);
    f.ok++;
    f.run = Math.min(f.run + 1, 99);
    return wasHard && !isHard(f);
  }
  f.bad++;
  f.run = 0;
  f.a = a; f.b = b; // запомним, как пример выглядел, когда ошибся
  f.t = Date.now();
  return false;
}

// Трудные примеры: сначала те, где ошибок больше всего
function hardList() {
  return Object.keys(data.facts)
    .map(key => Object.assign({ key }, data.facts[key]))
    .filter(isHard)
    .sort((x, y) => (y.bad - x.bad) || (x.run - y.run) || ((y.t || 0) - (x.t || 0)));
}
function hardForSelection() {
  return hardList().filter(f => splitKey(f.key).some(n => data.selected.includes(n)));
}
function showFact(f) {
  if (f.a && f.b) return [f.a, f.b];
  const [lo, hi] = splitKey(f.key);
  return [hi, lo];
}

/* ================= Звуки (синтезируются в браузере, без файлов) ================= */
let audio = null;
let noiseBuf = null;

function ac() {
  if (!data.sound) return null;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state !== 'running') audio.resume();
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

// Шум ветра («вжух»)
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
  // правильно: «дзинь» как колокольчик
  ding() {
    tone(1568, 0, 0.6, { vol: 0.16 });
    tone(2349, 0, 0.35, { vol: 0.06 });
  },
  // ошибка: мягкий сигнал — не страшный
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
  // ошибка исправлена: искорки
  sparkle() {
    [1319, 1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.07, 0.3, { vol: 0.09 }));
  },
  // удар по боссу: «вжик» и молния
  zap() {
    whoosh(0, 0.25, 900, 5000, 0.25);
    tone(1400, 0.05, 0.22, { type: 'square', vol: 0.05, to: 160 });
  },
  // босс смеётся: «ха-ха-ха»
  laugh() {
    [0, 0.17, 0.34, 0.51].forEach((s, i) => tone(300 - i * 22, s, 0.14, { type: 'sawtooth', vol: 0.07, to: 200 - i * 18 }));
  },
  // босс лопнул
  boom() {
    whoosh(0, 0.9, 2500, 120, 0.45);
    tone(140, 0, 0.8, { type: 'triangle', vol: 0.2, to: 40 });
  },
  // кубок!
  victory(start = 0) {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, start + i * 0.13, i === 5 ? 0.9 : 0.18, { type: 'triangle', vol: 0.16 }));
    [523, 659, 784].forEach(f => tone(f, start + 0.8, 1.1, { vol: 0.08 }));
  },
};

/* ================= Экраны ================= */
let screenNow = 'menu';

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
  // Кнопка «Назад» на телефоне возвращает в меню, а не закрывает игру
  try {
    if (id !== 'menu' && screenNow === 'menu') history.pushState({ s: 1 }, '');
    if (id === 'menu' && screenNow !== 'menu' && history.state && history.state.s) history.back();
  } catch (e) { /* без истории тоже работает */ }
  screenNow = id;
}

function goMenu() {
  if (typeof arcadeStop === 'function') arcadeStop();
  stopTimers();
  game = null;
  renderMenu();
  showScreen('menu');
}

/* ================= Меню ================= */
function renderSoundButtons() {
  document.querySelectorAll('.sound-btn').forEach(b => {
    b.textContent = data.sound ? '🔊' : '🔇';
    b.setAttribute('aria-label', data.sound ? 'Выключить звук' : 'Включить звук');
  });
}

function renderMenu() {
  const lv = level();
  const rank = RANKS[lv];
  $('levelIcon').textContent = rank.icon;
  $('levelName').textContent = rank.name;
  $('levelSub').textContent = nextStepText();
  $('levelBar').style.width = (lv / (RANKS.length - 1) * 100) + '%';
  renderExams();
  $('storageWarn').classList.toggle('hidden', storageOK);
  $('statStars').textContent = data.stars;
  $('statPoints').textContent = data.points;
  $('statCups').textContent = data.trophies.length;
  $('statDays').textContent = currentDayStreak();

  const day = dailyState();
  $('daily').classList.toggle('done', day.done);
  $('dailyText').textContent = day.done
    ? '🎯 Задание дня выполнено! Приходи завтра 😊'
    : `🎯 Задание дня: ${day.correct} из ${DAILY_GOAL} верных ответов (+${DAILY_BONUS} очков)`;
  $('dailyBar').style.width = Math.min(100, day.correct / DAILY_GOAL * 100) + '%';

  renderSoundButtons();
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

  $('speedDesc').textContent = data.bestSpeed
    ? `60 секунд. Рекорд: ${data.bestSpeed}`
    : 'Топлива на 60 секунд — сколько успеешь?';
  $('bossDesc').textContent = 'Бой за кубок 🏆 на выбранных числах';
  $('arcadeDesc').textContent = `🎟️ Билетов: ${data.tickets}. Ещё ${TICKET_EVERY - data.ticketProgress} верных — и новый билет`;
  document.querySelectorAll('.add-btn').forEach(b => b.classList.toggle('on', b.dataset.add === data.addLevel));
  const hard = hardList().length;
  $('mistakesBadge').textContent = hard;
  $('mistakesBadge').classList.toggle('hidden', !hard);
  $('mistakesDesc').textContent = hard
    ? `Трудных: ${hard}. Повтори их!`
    : 'Ошибок нет! 🎉';

  let known = 0;
  NUMBERS.forEach(n => { for (let k = 1; k <= 10; k++) if (factState(getFact(n, k)) === 'known') known++; });
  $('progressDesc').textContent = `Знаю ${known} из ${NUMBERS.length * 10} примеров`;

  renderHangar();
  renderInstall();
}

function renderHangar() {
  const lv = level();
  const chosen = currentPlaneId();
  const box = $('hangar');
  box.innerHTML = '';
  PLANES.forEach(p => {
    const open = lv >= p.level;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'plane-tile' + (open ? '' : ' locked') + (p.id === chosen ? ' chosen' : '');
    b.innerHTML = planeSVG(p.id) + `<span>${open ? p.name : '🔒 ' + unlockText(p.level)}</span>`;
    b.addEventListener('click', () => {
      if (!open) {
        $('hangarHint').textContent = `${p.name} и игра «${p.game}» откроются на звании «${RANKS[p.level].name}»: ${unlockText(p.level).toLowerCase()}.`;
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
  const nextPlane = PLANES.find(p => p.level > lv);
  $('hangarHint').textContent = nextPlane
    ? `Следующий: ${nextPlane.name} и игра «${nextPlane.game}». ${unlockText(nextPlane.level)}.`
    : 'Все самолёты собраны! 🎉';
}

function updateHint(msg) {
  $('numHint').textContent = msg || ('Учим умножение на ' + sortedSelected().join(', '));
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

/* ================= Экзамены ================= */
// Сохраняется ли прогресс в этом окне (в некоторых встроенных окнах браузера — нет)
const storageOK = (() => {
  try {
    localStorage.setItem('__check', '1');
    const ok = localStorage.getItem('__check') === '1';
    localStorage.removeItem('__check');
    return ok;
  } catch (e) { return false; }
})();

function renderExams() {
  const done = data.exams.length;
  $('examGrid').innerHTML = NUMBERS.map(n => {
    const ok = data.exams.includes(n);
    return `<button type="button" class="exam-btn${ok ? ' done' : ''}" data-exam="${n}" aria-label="Экзамен по числу ${n}${ok ? ' — сдан' : ''}">×${n}<small>${ok ? 'сдан ✓' : 'сдать'}</small></button>`;
  }).join('') +
    `<button type="button" class="exam-btn final${data.finalExam ? ' done' : ''}${done < NUMBERS.length ? ' locked' : ''}" data-exam="final" aria-label="Финальный экзамен">🏁<small>${data.finalExam ? 'сдан ✓' : 'финал'}</small></button>`;
  const next = PLANES.find(p => p.level > level());
  $('examHint').textContent = `Сдано: ${done} из ${NUMBERS.length}` + (data.finalExam ? ' и финал! 👑' : next ? `. Следующий экзамен откроет ${next.name} и игру «${next.game}»` : '');
}

// Экзамен по числу n (или финальный): 10 разных примеров подряд без ошибок
function startExam(n) {
  if (n === 'final') {
    if (data.exams.length < NUMBERS.length) { $('examHint').textContent = 'Финальный экзамен откроется, когда сдашь все 8 чисел.'; return; }
    startGame('boss', data.finalExam ? { nums: NUMBERS } : { nums: NUMBERS, exam: 'final' });
    return;
  }
  startGame('boss', data.exams.includes(n) ? { nums: [n], exam: null } : { nums: [n], exam: n });
}

function openExams() {
  goMenu();
  setTimeout(() => $('examCard').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
}

/* ================= Мои ошибки ================= */
function renderMistakes() {
  const list = hardList();
  $('mistakesLead').textContent = list.length
    ? `Здесь примеры, в которых ты ошибался. Реши каждый ${FIX_RUN} раза подряд правильно — и он улетит из списка ✈️`
    : 'Ошибок нет — ты молодец! 🎉 Если ошибёшься в полёте, пример появится здесь, чтобы его повторить.';
  $('mistakeList').innerHTML = list.map(f => {
    const [a, b] = showFact(f);
    const dots = Array.from({ length: FIX_RUN }, (_, i) => `<i class="${i < f.run ? 'on' : ''}"></i>`).join('');
    return `<div class="mistake-item"><span class="m-expr">${a} × ${b} = <b>${a * b}</b></span>` +
      `<span class="m-dots" title="Решено подряд: ${f.run} из ${FIX_RUN}">${dots}</span></div>`;
  }).join('');
  const btn = $('fixBtn');
  btn.classList.toggle('hidden', !list.length);
  btn.textContent = list.length > FIX_POOL
    ? `🔁 Повторить ${FIX_POOL} самых трудных`
    : '🔁 Повторить трудные';
}

function openMistakes() {
  renderMistakes();
  showScreen('mistakes');
}

/* ================= Таблица прогресса ================= */
let openRow = 0;

function renderTable() {
  let known = 0;
  const rows = NUMBERS.map(n => {
    let rowKnown = 0;
    const cells = [];
    for (let k = 1; k <= 10; k++) {
      const st = factState(getFact(n, k));
      if (st === 'known') rowKnown++;
      cells.push(`<span class="cell ${st}" title="${n} × ${k} = ${n * k}">${st === 'new' ? '?' : n * k}</span>`);
    }
    known += rowKnown;
    const cups = data.trophies.filter(t => Array.isArray(t.n) && t.n.includes(n)).length;
    const crown = rowKnown === 10 ? ' 👑' : '';
    const passed = data.exams.includes(n);
    const actions = openRow === n
      ? `<div class="trow-actions"><button class="small-btn" type="button" data-go="train" data-n="${n}">🗺️ Учить ×${n}</button>` +
        `<button class="small-btn boss" type="button" data-go="boss" data-n="${n}">${passed ? '👾 Босс' : '🎓 Экзамен'} ×${n}</button></div>`
      : '';
    return `<div class="trow${openRow === n ? ' open' : ''}">` +
      `<button class="trow-btn" type="button" data-row="${n}" aria-expanded="${openRow === n}">` +
      `<span class="trow-head"><span class="tnum">× ${n}</span>` +
      `<span class="tcount">знаю ${rowKnown} из 10${crown}</span>` +
      `<span class="tcups">${passed ? '🎓' : ''}${cups ? '🏆' + (cups > 1 ? '×' + cups : '') : ''}</span></span>` +
      `<span class="tcells">${cells.join('')}</span></button>${actions}</div>`;
  });
  $('table').innerHTML = rows.join('');
  const total = NUMBERS.length * 10;
  $('tableLead').textContent = known === total
    ? 'Вся таблица умножения собрана! Ты настоящий ас! 👑'
    : `Знаешь ${known} из ${total} примеров. Решай примеры — и таблица заполнится ответами!`;

  // Полка с кубками
  const t = data.trophies;
  $('trophies').innerHTML = t.length
    ? t.map((c, i) => `<div class="trophy" title="Кубок №${i + 1}"><span class="t-cup">🏆</span>` +
        `<span class="t-boss">${BOSSES[c.b % BOSSES.length].icon}</span><span class="t-nums">×${(c.n || []).join(", ")}</span></div>`).join('')
    : '<p class="empty">Пока кубков нет. Победи босса — и здесь появится первый кубок!</p>';
  const nb = BOSSES[t.length % BOSSES.length];
  $('trophyHint').textContent = `Следующий босс: ${nb.icon} «${nb.name}»` +
    (data.bossBest && data.bossBest < BOSS_QUESTIONS ? `. Твой рекорд в бою: ${data.bossBest} из ${BOSS_QUESTIONS}` : '');
}

function openProgress() {
  openRow = 0;
  renderTable();
  showScreen('progress');
}

/* ================= Полёт (игра) ================= */
let game = null;

let lastOpts = {};
function startGame(mode, opts = {}) {
  lastOpts = opts;
  stopTimers();
  if (mode === 'fix' && !hardList().length) { openMistakes(); return; }
  game = {
    mode,
    city: pick(CITIES),
    asked: 0,
    correct: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    mistakes: [],
    fixed: [],
    lastKey: '',
    locked: false,
    paused: false,
    lost: false,
    progress: 0,
    levelBefore: level(),
    dailyDone: false,
    tickets: 0,
    input: '',
    timeLeft: SPEED_TIME,
    lastTick: 0,
    timerId: null,
    nextId: null,
    timeouts: [],
  };

  if (mode === 'boss') {
    // 10 разных примеров из выбранных чисел
    const keys = new Set();
    const nums = opts.nums || data.selected;
    nums.forEach(n => { for (let k = 1; k <= 10; k++) keys.add(factKey(n, k)); });
    game.deck = shuffle([...keys]).slice(0, BOSS_QUESTIONS).map(key => {
      const [lo, hi] = splitKey(key);
      return Math.random() < 0.5 ? [lo, hi] : [hi, lo];
    });
    game.nums = nums.slice().sort((a, b) => a - b);
    game.bossIndex = data.trophies.length % BOSSES.length;
    game.exam = 'exam' in opts ? opts.exam : examFor(nums);
  }
  if (mode === 'add') game.addLevel = data.addLevel;
  if (mode === 'fix') {
    game.pool = hardList().slice(0, FIX_POOL).map(f => f.key);
    game.need = game.pool.reduce((s, key) => s + FIX_RUN - data.facts[key].run, 0);
  }

  const speed = mode === 'speed';
  const boss = mode === 'boss';
  $('flight').classList.toggle('hidden', boss);
  $('arena').classList.toggle('hidden', !boss);
  $('flight').classList.toggle('speed', speed);
  $('fuel').classList.toggle('hidden', !speed);
  $('fuel').classList.remove('low', 'empty');
  const labels = {
    train: ['Краснодар', game.city.to],
    speed: ['🛫 Взлёт', 'Посадка 🛬'],
    fix: ['📝 Ошибки', 'Исправлено ✅'],
    add: ['Краснодар', game.city.to],
  };
  if (!boss) {
    $('fromCity').textContent = labels[mode][0];
    $('toCity').textContent = labels[mode][1];
    $('flightPlaneInner').innerHTML = planeSVG(currentPlaneId());
    setFlightProgress(0);
  } else {
    renderArena();
  }
  $('hudScore').textContent = '0';
  $('streak').innerHTML = '&nbsp;';
  $('nextBtn').textContent = 'Понятно, летим дальше ➜';
  renderSoundButtons();
  showScreen('game');
  if (boss) {
    restartAnimation($('boss'), 'show');
    sounds.laugh();
  } else {
    restartAnimation($('flightPlane'), 'takeoff');
    sounds.takeoff();
  }
  nextQuestion();
  if (speed) {
    game.lastTick = performance.now();
    game.timerId = setInterval(tick, 100);
  }
  updateHud();
}

function later(fn, ms) {
  if (!game) return;
  const g = game;
  g.timeouts.push(setTimeout(() => { if (game === g) fn(); }, ms));
}

function setFlightProgress(p) {
  $('flightPlane').style.setProperty('--p', p);
  $('routeDone').style.width = `calc(${p} * (100% - 72px) + 36px)`;
}

function stopTimers() {
  if (!game) return;
  clearInterval(game.timerId);
  game.timeouts.forEach(clearTimeout);
}

function tick() {
  if (!game) return;
  const now = performance.now();
  if (!game.paused && !document.hidden) game.timeLeft -= now - game.lastTick;
  game.lastTick = now;
  if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    updateHud();
    finishGame();
    return;
  }
  updateHud();
}

function fixRemaining() {
  return game.pool.filter(key => isHard(data.facts[key]));
}

function updateHud() {
  if (!game) return;
  if (game.mode === 'speed') {
    const sec = Math.ceil(game.timeLeft / 1000);
    $('hudInfo').textContent = `✅ ${game.correct} верно`;
    $('fuelSec').textContent = sec;
    $('fuelBar').style.width = (game.timeLeft / SPEED_TIME * 100) + '%';
    $('fuel').classList.toggle('low', sec <= 20 && sec > 10);
    $('fuel').classList.toggle('empty', sec <= 10);
    setFlightProgress(1 - game.timeLeft / SPEED_TIME);
  } else if (game.mode === 'boss') {
    const ex = game.exam === 'final' ? '🎓 Финал' : game.exam ? `🎓 Экзамен ×${game.exam}` : '👊';
    $('hudInfo').textContent = `${ex} · ${game.correct} из ${BOSS_QUESTIONS}`;
  } else if (game.mode === 'add') {
    $('hudInfo').textContent = `➕ Пример ${Math.min(game.asked, ADD_QUESTIONS)} из ${ADD_QUESTIONS}`;
  } else if (game.mode === 'fix') {
    const left = fixRemaining().length;
    $('hudInfo').textContent = left ? `Осталось исправить: ${left}` : 'Всё исправлено! ✨';
  } else {
    $('hudInfo').textContent = `Пример ${Math.min(game.asked, TRAIN_QUESTIONS)} из ${TRAIN_QUESTIONS}`;
  }
}

function makeQuestion() {
  if (game.mode === 'boss') {
    const [a, b] = game.deck[game.asked];
    return { a, b, answer: a * b, op: '×' };
  }
  if (game.mode === 'add') return makeAddition(game.addLevel);
  let a, b, tries = 0;
  do {
    if (game.mode === 'fix') {
      const left = fixRemaining();
      const choices = left.length > 1 ? left.filter(k => k !== game.lastKey) : left;
      [a, b] = splitKey(pick(choices));
    } else {
      const hard = hardForSelection();
      if (hard.length && Math.random() < HARD_CHANCE) {
        [a, b] = splitKey(pick(hard).key);
      } else {
        a = pick(data.selected);
        b = rand(1, 10);
      }
    }
    if (Math.random() < 0.5) [a, b] = [b, a]; // иногда меняем местами: 7 × 3 и 3 × 7
    tries++;
  } while (game.mode !== 'fix' && factKey(a, b) === game.lastKey && tries < 20);
  game.lastKey = factKey(a, b);
  return { a, b, answer: a * b, op: '×' };
}

// Сложение: двузначные, трёхзначные или вперемешку (как 275 + 986)
function makeAddition(lv) {
  const two = () => rand(10, 99), three = () => rand(100, 999);
  let a, b;
  if (lv === 'two') { a = two(); b = two(); }
  else if (lv === 'three') { a = three(); b = three(); }
  else {
    const r = Math.random();
    if (r < 0.35) { a = three(); b = two(); }
    else if (r < 0.6) { a = two(); b = three(); }
    else { a = three(); b = three(); }
  }
  return { a, b, answer: a + b, op: '+' };
}

function renderTyped() {
  const q = game.q;
  $('question').innerHTML = `${q.a} + ${q.b} = <span class="typed${game.input ? '' : ' empty'}">${game.input || '?'}</span>`;
}

function keypadPress(k) {
  if (!game || game.mode !== 'add' || game.locked) return;
  if (k === 'ok') {
    if (game.input) submitAnswer(Number(game.input), null);
    return;
  }
  if (k === 'del') game.input = game.input.slice(0, -1);
  else if (game.input.length < 4) game.input = (game.input === '0' ? '' : game.input) + k;
  renderTyped();
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
  if (!game) return;
  if (game.mode === 'train' && game.asked >= TRAIN_QUESTIONS) return finishGame();
  if (game.mode === 'boss' && (game.lost || game.correct >= BOSS_QUESTIONS)) return finishGame();
  if (game.mode === 'fix' && (!fixRemaining().length || game.asked >= FIX_MAX)) return finishGame();
  if (game.mode === 'add' && game.asked >= ADD_QUESTIONS) return finishGame();

  game.q = makeQuestion();
  game.asked++;
  game.locked = false;
  game.paused = false;

  const add = game.mode === 'add';
  $('question').classList.toggle('long', add);
  $('feedback').innerHTML = '&nbsp;';
  $('feedback').className = 'feedback';
  $('explain').classList.add('hidden');
  $('answers').classList.toggle('hidden', add);
  $('keypad').classList.toggle('hidden', !add);
  if (add) {
    game.input = '';
    renderTyped();
    updateHud();
    return;
  }
  $('question').textContent = `${game.q.a} × ${game.q.b} = ?`;

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
  submitAnswer(Number(btn.textContent), btn);
}

function submitAnswer(value, btn) {
  game.locked = true;
  const { a, b, answer: right, op } = game.q;
  const ok = value === right;
  const mult = op === '×';
  document.querySelectorAll('.answer').forEach(x => { x.disabled = true; });
  $('question').innerHTML = `${a} ${op} ${b} = <span class="ans">${right}</span>`;

  const fixedNow = mult ? recordAnswer(a, b, ok) : false;
  if (fixedNow && !game.fixed.includes(factKey(a, b))) game.fixed.push(factKey(a, b));

  // в тренировке и сложении самолёт продвигается после каждого примера
  if (game.mode === 'train') setFlightProgress(game.asked / TRAIN_QUESTIONS);
  if (game.mode === 'add') setFlightProgress(game.asked / ADD_QUESTIONS);

  if (ok) {
    game.correct++;
    game.streak++;
    game.maxStreak = Math.max(game.maxStreak, game.streak);
    const bonus = game.streak >= 3 ? 5 : 0;
    game.score += 10 + bonus;

    const day = dailyState();
    day.correct++;
    let dailyNow = false;
    if (!day.done && day.correct >= DAILY_GOAL) {
      day.done = true;
      dailyNow = true;
      game.dailyDone = true;
      completeDaily();
    }
    // билеты на мини-игры
    let ticketNow = false;
    data.ticketProgress++;
    if (data.ticketProgress >= TICKET_EVERY) {
      data.ticketProgress = 0;
      data.tickets++;
      game.tickets++;
      ticketNow = true;
    }
    saveData();

    if (btn) btn.classList.add('correct');
    const praise = game.mode === 'boss' ? pick(BOSS_PRAISE) : pick(PRAISE);
    $('feedback').textContent = fixedNow ? `✨ Ошибка исправлена! +${10 + bonus}` : `${praise} +${10 + bonus}`;
    $('feedback').className = 'feedback good';
    $('streak').textContent = dailyNow
      ? `🎯 Задание дня выполнено! +${DAILY_BONUS}`
      : ticketNow ? '🎟️ +1 билет на мини-игру!'
      : game.streak >= 3 ? `🔥 ${game.streak} подряд! Бонус +5` : ' ';
    $('hudScore').textContent = game.score;

    if (game.mode === 'boss') {
      hitBoss();
    } else {
      if (game.mode === 'fix') {
        const left = fixRemaining().reduce((s, key) => s + FIX_RUN - data.facts[key].run, 0);
        game.progress = Math.max(game.progress, 1 - left / game.need);
        setFlightProgress(game.progress);
      }
      if (fixedNow || dailyNow || ticketNow) {
        sounds.sparkle();
        restartAnimation($('flightPlane'), 'hop');
      } else if (game.streak >= 3) {
        sounds.horn();
        restartAnimation($('flightPlane'), 'hop');
      } else {
        sounds.ding();
      }
    }
    updateHud();
    const wait = game.mode === 'speed' ? 450 : game.mode === 'boss' && game.correct >= BOSS_QUESTIONS ? 1500 : 800;
    later(nextQuestion, wait);
  } else {
    game.streak = 0;
    game.paused = true; // пока смотрим объяснение, топливо не тратится
    game.mistakes.push({ a, b, right, op });
    saveData();
    if (btn) btn.classList.add('wrong');
    document.querySelectorAll('.answer').forEach(x => {
      if (Number(x.textContent) === right) x.classList.add('correct');
    });
    $('streak').innerHTML = '&nbsp;';
    if (game.mode === 'boss') {
      game.lost = true;
      $('feedback').textContent = 'Ха-ха! Туча увернулась! Смотри, как правильно:';
      $('nextBtn').textContent = 'Понятно, к итогам ➜';
      restartAnimation($('boss'), 'laugh');
      sounds.laugh();
    } else {
      $('feedback').textContent = mult ? pick(SUPPORT) : `Не ${value}. Давай посчитаем столбиком:`;
      restartAnimation($('flightPlane'), 'shake');
      sounds.oops();
    }
    $('feedback').className = 'feedback oops';
    later(() => (mult ? showExplain(a, b, right) : showAddExplain(a, b, right)), 700);
  }
}

/* ---- Бой с боссом ---- */
function renderArena() {
  const b = BOSSES[game.bossIndex];
  $('bossName').textContent = `${b.icon} ${b.name}`;
  $('boss').innerHTML = bossSVG(game.bossIndex);
  $('boss').className = 'boss';
  $('arenaPlane').innerHTML = planeSVG(currentPlaneId());
  $('bossHp').innerHTML = Array.from({ length: BOSS_QUESTIONS }, () => '<i></i>').join('');
  $('bossHit').className = 'boss-hit';
}

function hitBoss() {
  restartAnimation($('shot'), 'fly');
  sounds.zap();
  const n = game.correct;
  later(() => {
    const seg = $('bossHp').children[BOSS_QUESTIONS - n];
    if (seg) seg.classList.add('lost');
    restartAnimation($('bossHit'), 'show');
    if (n >= BOSS_QUESTIONS) {
      restartAnimation($('boss'), 'defeated');
      sounds.boom();
    } else {
      restartAnimation($('boss'), 'hurt');
    }
  }, 280);
}

/* ---- Объяснение ошибки ---- */
function showExplain(a, b, right) {
  $('answers').classList.add('hidden');
  $('keypad').classList.add('hidden');
  const count = Math.min(a, b);   // сколько раз складываем
  const part = Math.max(a, b);    // что складываем
  const swapped = a > b ? `${a} × ${b} = ${b} × ${a}, а ` : '';
  const times = plural(count, 'раз', 'раза', 'раз');
  let title, sum, steps = '';
  if (count === 1) {
    title = `Умножить на 1 — число не меняется:`;
    sum = `${a} × ${b} = ${right}`;
  } else if (part === 10) {
    title = `Умножить на 10 — просто приписать нолик:`;
    sum = `${count} → ${right}`;
  } else {
    title = `${swapped}${count} × ${part} — это ${count} ${times} по ${part}:`;
    sum = `${Array(count).fill(part).join(' + ')} = ${right}`;
    const s = [];
    for (let i = 1; i <= count; i++) s.push(part * i);
    steps = 'Считаем: ' + s.join(' → ');
  }
  $('explainTitle').textContent = title;
  $('explainSum').textContent = sum;
  $('explainSteps').textContent = steps;

  // картинка из кружочков: count рядов по part кружков
  const dots = $('dots');
  dots.innerHTML = '';
  const size = part > 8 ? 14 : 18;
  for (let r = 0; r < count; r++) {
    const row = document.createElement('div');
    row.className = 'dot-row';
    for (let c = 0; c < part; c++) {
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

// Сложение столбиком: показываем разряды и переносы
function showAddExplain(a, b, right) {
  $('answers').classList.add('hidden');
  $('keypad').classList.add('hidden');
  const R = String(right), len = R.length;
  const da = String(a).split('').reverse().map(Number);
  const db = String(b).split('').reverse().map(Number);
  const n = Math.max(da.length, db.length);
  const names = ['Единицы', 'Десятки', 'Сотни', 'Тысячи'];
  const carries = [];
  const steps = [];
  let carry = 0;
  for (let i = 0; i < n; i++) {
    const terms = [];
    if (i < da.length) terms.push(da[i]);
    if (i < db.length) terms.push(db[i]);
    if (carry) terms.push(carry);
    const sum = terms.reduce((x, y) => x + y, 0);
    const last = i === n - 1;
    let tail = '';
    if (last) tail = ` → пишем ${sum}`;
    else if (sum >= 10) tail = ` → пишем ${sum % 10}, а 1 запоминаем`;
    else tail = ` → пишем ${sum}`;
    steps.push(`<div><b>${names[i]}:</b> ${terms.join(' + ')} = ${sum}${tail}</div>`);
    carry = sum >= 10 ? 1 : 0;
    carries[i + 1] = carry;
  }
  const cell = (ch, cls = '') => `<span class="cc${cls ? ' ' + cls : ''}">${ch}</span>`;
  const row = (str, i0 = 0) => {
    let h = '';
    for (let j = 0; j < len; j++) {
      const i = len - 1 - j; // разряд
      const ch = str.length - 1 - i >= 0 ? str[str.length - 1 - i] : '';
      h += cell(ch);
    }
    return h;
  };
  let carryRow = '';
  for (let j = 0; j < len; j++) carryRow += cell(carries[len - 1 - j] ? '1' : '', 'carry');
  const html = `<div class="column" style="--cols:${len + 1}">` +
    cell('') + carryRow +
    cell('') + row(String(a)) +
    cell('+', 'op') + row(String(b)) +
    '<span class="cline"></span>' +
    cell('') + row(R) + '</div>';
  $('explainTitle').textContent = 'Считаем столбиком, начиная с единиц:';
  $('explainSum').innerHTML = html;
  $('explainSteps').innerHTML = steps.join('');
  $('dots').innerHTML = '';
  $('explain').classList.remove('hidden');
  $('nextBtn').focus({ preventScroll: true });
}

function continueAfterExplain() {
  if (!game) return;
  if (game.mode === 'speed') game.lastTick = performance.now();
  nextQuestion();
}

/* ================= Посадка (итоги) ================= */
function starsFor(g) {
  const c = g.correct;
  if (g.mode === 'train' || g.mode === 'add') return c >= 10 ? 3 : c >= 8 ? 2 : c >= 5 ? 1 : 0;
  if (g.mode === 'speed') return c >= 20 ? 3 : c >= 12 ? 2 : c >= 6 ? 1 : 0;
  if (g.mode === 'boss') return g.correct >= BOSS_QUESTIONS ? 3 : 0;
  const f = g.fixed.length;
  return f >= g.pool.length ? 3 : f * 2 >= g.pool.length ? 2 : f ? 1 : 0;
}

function finishGame() {
  if (!game) return;
  stopTimers();
  const g = game;
  game = null;

  const won = g.mode === 'boss' && !g.lost && g.correct >= BOSS_QUESTIONS;
  if (won) g.score += BOSS_BONUS;
  const stars = starsFor(g);
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
  let bossRecord = false;
  if (g.mode === 'boss') {
    if (g.correct > data.bossBest) { bossRecord = !won && data.bossBest > 0; data.bossBest = g.correct; }
    if (won) data.trophies.push({ b: g.bossIndex, n: g.nums, d: today() });
    // экзамен сдан: новое звание, самолёт, игра и подарочный билет
    if (won && g.exam) {
      if (g.exam === 'final') data.finalExam = true;
      else if (!data.exams.includes(g.exam)) data.exams.push(g.exam);
      data.tickets++;
      g.tickets++;
    }
  }
  const levelAfter = level();
  saveData();

  const boss = BOSSES[g.bossIndex || 0];
  const nextBoss = BOSSES[data.trophies.length % BOSSES.length];
  const hardLeft = hardList().length;

  // Заголовок, звёзды или кубок
  $('resStars').classList.toggle('hidden', g.mode === 'boss');
  $('resStars').innerHTML = [0, 1, 2].map(i =>
    `<span class="s${i < stars ? '' : ' off'}" style="animation-delay:${i * 0.2}s">⭐</span>`).join('');
  $('resCup').classList.toggle('hidden', !won);
  const lost = g.mode === 'boss' && !won;
  $('resBoss').innerHTML = lost ? bossSVG(g.bossIndex) : '';
  $('resBoss').className = 'res-boss' + (lost ? ' laugh' : ' hidden');

  let place, title, text, stats;
  if (g.mode === 'train' || g.mode === 'speed' || g.mode === 'add') {
    place = g.mode === 'speed' ? '⛽ Топливо закончилось — мягкая посадка!' : `🛬 Посадка ${g.city.at}!`;
    title = ['Ты молодец, что тренируешься!', 'Хороший полёт!', 'Отличный полёт! 💪', 'Высший пилотаж, Никита! 🏆'][stars];
    text = [
      'Каждый лётчик начинал с учебных полётов. Полетим ещё раз?',
      'Ещё немного тренировок — и звёзд станет больше!',
      'Совсем чуть-чуть до трёх звёзд!',
      g.mode === 'add' ? 'Три звезды! Ты считаешь как настоящий штурман!' : 'Три звезды! Ты настоящий ас умножения!',
    ][stars];
    stats = [
      [g.correct, g.mode === 'speed' ? 'верно за 60 сек' : 'верно из ' + (g.mode === 'add' ? ADD_QUESTIONS : TRAIN_QUESTIONS)],
      ['+' + g.score, 'очков'],
      [g.maxStreak, '🔥 лучшая серия'],
    ];
  } else if (g.mode === 'boss') {
    const examName = g.exam === 'final' ? 'Финальный экзамен' : g.exam ? `Экзамен ×${g.exam}` : '';
    place = examName ? `🎓 ${examName} · бой с «${boss.name}»` : `👾 Бой с боссом «${boss.name}»`;
    if (won && g.exam) {
      title = g.exam === 'final' ? 'Финальный экзамен сдан! 👑' : `Экзамен ×${g.exam} сдан! 🎓`;
      text = g.exam === 'final'
        ? 'Вся таблица умножения покорена! Ты — Легенда неба!'
        : `10 примеров на ×${g.exam} без единой ошибки! Кубок №${data.trophies.length}, новое звание, самолёт и игра — смотри ниже.`;
    } else if (won) {
      title = `Победа! Кубок №${data.trophies.length}! 🏆`;
      text = `10 примеров без единой ошибки! Это был бой за кубок. Новый самолёт и игру даёт экзамен: в меню нажми на число в карточке «🎓 Экзамены».`;
    } else {
      title = examName ? `${examName} пока не сдан` : `${boss.name} пока сильнее…`;
      text = g.correct >= 7
        ? `Ты почти победил: ${g.correct} из ${BOSS_QUESTIONS}! Ещё чуть-чуть — и всё получится!`
        : `Ты нанёс ${g.correct} ${plural(g.correct, 'удар', 'удара', 'ударов')} из ${BOSS_QUESTIONS}. ` +
          (g.exam && g.exam !== 'final' ? `Потренируй ×${g.exam} и попробуй снова!` : 'Попробуй ещё — у тебя получится!');
    }
    stats = [
      [g.correct + ' / ' + BOSS_QUESTIONS, 'ударов'],
      ['+' + g.score, 'очков'],
      [won ? data.trophies.length : data.bossBest, won ? '🏆 кубков' : '⚡ рекорд'],
    ];
  } else {
    place = '📝 Работа над ошибками';
    const f = g.fixed.length;
    title = f >= g.pool.length
      ? 'Все примеры исправлены! 🎉'
      : f ? `Исправлено: ${f} ${plural(f, 'пример', 'примера', 'примеров')}! ✨` : 'Хорошая тренировка!';
    text = hardLeft
      ? `В «Моих ошибках» ${plural(hardLeft, 'остался', 'осталось', 'осталось')} ${hardLeft} ${plural(hardLeft, 'пример', 'примера', 'примеров')}. Повторим ещё?`
      : 'Список ошибок пуст — ты молодец! Можно лететь дальше 🛫';
    stats = [
      [g.correct, 'верно из ' + g.asked],
      ['+' + g.score, 'очков'],
      [f, '✨ исправлено'],
    ];
  }
  $('resPlace').textContent = place;
  $('resTitle').textContent = title;
  $('resText').textContent = text;
  $('resStats').innerHTML = stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');

  // Баннеры
  const recordText = newRecord ? `🎉 Новый рекорд на скорость: ${g.correct}!`
    : bossRecord ? `🎉 Новый рекорд в бою с боссом: ${g.correct} из ${BOSS_QUESTIONS}!`
    : newStreak ? `🎉 Новый рекорд серии: ${g.maxStreak} подряд!` : '';
  $('resRecord').classList.toggle('hidden', !recordText);
  $('resRecord').textContent = recordText;

  $('resDaily').classList.toggle('hidden', !g.dailyDone);
  $('resDaily').textContent = `🎯 Задание дня выполнено! +${DAILY_BONUS} очков. Дней подряд: ${currentDayStreak()} 📅`;

  const fixedCount = g.fixed.length;
  $('resFixed').classList.toggle('hidden', !fixedCount || g.mode === 'fix');
  $('resFixed').textContent = `✨ Исправлено ${plural(fixedCount, 'ошибка', 'ошибки', 'ошибок')}: ${fixedCount} — ${plural(fixedCount, 'она улетела', 'они улетели', 'они улетели')} из списка!`;

  $('resTickets').classList.toggle('hidden', !g.tickets);
  $('resTicketsText').textContent = `🎟️ +${g.tickets} ${plural(g.tickets, 'билет', 'билета', 'билетов')} на мини-игры! Всего: ${data.tickets}`;

  const rank = RANKS[levelAfter];
  $('resLevel').classList.toggle('hidden', levelAfter === g.levelBefore);
  $('resLevel').textContent = `${rank.icon} Новое звание: «${rank.name}»!`;

  // новый самолёт в ангаре и его мини-игра
  const fresh = PLANES.filter(p => p.level > g.levelBefore && p.level <= levelAfter);
  const box = $('resPlane');
  if (fresh.length) {
    const p = fresh[fresh.length - 1];
    $('resPlanePic').innerHTML = planeSVG(p.id);
    $('resPlaneText').textContent = `🎁 Новый самолёт: ${p.name}! И новая игра на аэродроме: «${p.game}»!`;
    const btn = $('resPlaneBtn');
    btn.dataset.id = p.id;
    btn.disabled = false;
    btn.textContent = '✈️ Лететь на нём';
    $('resGameBtn').dataset.game = PLANES.indexOf(p);
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }

  // какие примеры стоит повторить
  const seen = new Set();
  const uniq = g.mistakes.filter(m => {
    const k = m.op === '+' ? m.a + '+' + m.b : factKey(m.a, m.b);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const mBox = $('resMistakes');
  if (uniq.length) {
    mBox.innerHTML = '<b>Давай запомним:</b>' + uniq.map(m => `<div>${m.a} ${m.op || '×'} ${m.b} = ${m.right}</div>`).join('') +
      (g.mode === 'fix' || g.mode === 'add' ? '' : '<p>Эти примеры попали в «Мои ошибки». Повтори их — и они улетят из списка.</p>' +
        '<button class="small-btn" type="button" data-open-mistakes>📝 Открыть «Мои ошибки»</button>');
    mBox.classList.remove('hidden');
  } else {
    mBox.classList.add('hidden');
  }

  // Кнопка «ещё раз»
  const again = $('againBtn');
  const examPassed = won && g.exam;
  again.dataset.mode = examPassed ? 'exams' : g.mode;
  again.classList.toggle('hidden', g.mode === 'fix' && !hardLeft);
  again.textContent = {
    train: 'Ещё полёт 🔁',
    speed: 'Ещё раз на скорость 🔁',
    boss: examPassed ? (data.finalExam ? 'В меню ✈️' : 'Следующий экзамен 🎓') : won ? `Следующий босс ${nextBoss.icon}` : g.exam ? 'Попробовать снова 🎓' : 'Ещё бой ⚔️',
    fix: 'Повторить ещё 🔁',
    add: 'Ещё полёт 🔁',
  }[g.mode];

  showScreen('result');
  if (won) {
    restartAnimation($('resCup'), 'show');
    sounds.victory();
  } else if (g.mode === 'boss') {
    sounds.laugh();
  } else {
    sounds.landing(stars);
  }
  if (fresh.length) sounds.fanfare(2.2);
}

/* ================= Установка на телефон ================= */
let installPrompt = null;
const canInstallHere = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function renderInstall() {
  $('installCard').classList.toggle('hidden', !canInstallHere || isStandalone());
}

function showModal(title, html) {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = html;
  $('modal').classList.remove('hidden');
  $('modalClose').focus({ preventScroll: true });
}
function closeModal() {
  $('modal').classList.add('hidden');
}

function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    installPrompt.userChoice.then(() => { installPrompt = null; renderInstall(); }, () => {});
    return;
  }
  const steps = isIOS()
    ? ['Откройте эту страницу в <b>Safari</b>.',
       'Нажмите кнопку <b>«Поделиться»</b> — квадрат со стрелкой вверх ⬆️. Если её не видно, сначала нажмите <b>«⋯»</b>.',
       'Выберите <b>«На экран „Домой“»</b>.',
       'Нажмите <b>«Добавить»</b>. На экране появится значок с самолётиком.']
    : ['Откройте эту страницу в <b>Chrome</b>.',
       'Нажмите <b>⋮</b> (три точки вверху справа).',
       'Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.',
       'Подтвердите. На экране появится значок с самолётиком.'];
  showModal('Как установить игру 📲',
    '<ol class="steps">' + steps.map(s => `<li>${s}</li>`).join('') + '</ol>' +
    '<p class="modal-note">После установки игра открывается с главного экрана и работает без интернета.</p>');
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  renderInstall();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  renderInstall();
});

/* ================= Кнопки ================= */
document.querySelectorAll('.answer').forEach(btn => btn.addEventListener('click', () => answer(btn)));
document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => btn.addEventListener('click', () => startGame(btn.dataset.mode)));
document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', goMenu));
document.querySelectorAll('.sound-btn').forEach(btn => btn.addEventListener('click', () => {
  data.sound = !data.sound;
  saveData();
  renderSoundButtons();
  if (data.sound) sounds.chime();
}));
$('mistakesBtn').addEventListener('click', openMistakes);
$('examGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-exam]');
  if (b) startExam(b.dataset.exam === 'final' ? 'final' : Number(b.dataset.exam));
});
$('progressBtn').addEventListener('click', openProgress);
$('fixBtn').addEventListener('click', () => startGame('fix'));
$('nextBtn').addEventListener('click', continueAfterExplain);
$('quitBtn').addEventListener('click', goMenu);
$('againBtn').addEventListener('click', e => {
  const mode = e.currentTarget.dataset.mode || 'train';
  if (mode === 'exams') { openExams(); return; }
  startGame(mode, mode === 'boss' ? lastOpts : {});
});
$('menuBtn').addEventListener('click', goMenu);
$('resMistakes').addEventListener('click', e => { if (e.target.closest('[data-open-mistakes]')) openMistakes(); });
$('resPlaneBtn').addEventListener('click', e => {
  data.plane = e.currentTarget.dataset.id;
  saveData();
  e.currentTarget.disabled = true;
  e.currentTarget.textContent = 'Выбран ✅';
  sounds.ding();
});
document.querySelectorAll('.kp').forEach(b => b.addEventListener('click', () => keypadPress(b.dataset.k)));
document.addEventListener('keydown', e => { // клавиатура компьютера в режиме сложения
  if (!game || game.mode !== 'add' || screenNow !== 'game') return;
  if (/^[0-9]$/.test(e.key)) keypadPress(e.key);
  else if (e.key === 'Backspace') keypadPress('del');
  else if (e.key === 'Enter') { e.preventDefault(); if (!$('explain').classList.contains('hidden')) continueAfterExplain(); else keypadPress('ok'); }
});
document.querySelectorAll('.add-btn').forEach(b => b.addEventListener('click', () => {
  data.addLevel = b.dataset.add;
  saveData();
  startGame('add');
}));
$('resGameBtn').addEventListener('click', e => openGame(Number(e.currentTarget.dataset.game)));
$('resTicketsBtn').addEventListener('click', () => openArcade());
$('allBtn').addEventListener('click', () => {
  data.selected = NUMBERS.slice();
  saveData();
  renderMenu();
});
$('table').addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go) {
    const n = Number(go.dataset.n);
    if (go.dataset.go === 'boss') { startExam(n); return; }
    data.selected = [n];
    saveData();
    startGame(go.dataset.go);
    return;
  }
  const row = e.target.closest('[data-row]');
  if (row) {
    const n = Number(row.dataset.row);
    openRow = openRow === n ? 0 : n;
    renderTable();
  }
});
$('installBtn').addEventListener('click', installApp);
$('modalClose').addEventListener('click', closeModal);
$('modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) closeModal();
});
// Кнопка «Назад» телефона: из любого экрана — в меню
window.addEventListener('popstate', () => {
  closeModal();
  if (screenNow !== 'menu') goMenu();
});
// Свернули игру — топливо в режиме «На скорость» не тратится
document.addEventListener('visibilitychange', () => {
  if (game) game.lastTick = performance.now();
});

if (history.state && history.state.s) history.replaceState(null, '');
renderMenu();

// Офлайн-режим (работает только на сайте с https, при открытии файла с диска не нужен)
if ('serviceWorker' in navigator && canInstallHere) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* без офлайна игра тоже работает */ });
  });
  navigator.serviceWorker.ready.then(() => $('offlineNote').classList.remove('hidden'));
}
