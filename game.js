'use strict';

/* ================= Настройки ================= */
const TRAIN_QUESTIONS = 10;      // примеров в тренировке
const SPEED_TIME = 60000;        // 60 секунд в режиме «На скорость»
const NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9];
const STORAGE_KEY = 'nikita-multiply-v1';

// Уровни: сколько всего очков нужно набрать
const LEVELS = [
  { at: 0,    name: 'Новичок',     icon: '🐣' },
  { at: 100,  name: 'Ученик',      icon: '🐥' },
  { at: 250,  name: 'Счетовод',    icon: '🦊' },
  { at: 500,  name: 'Знаток',      icon: '🦉' },
  { at: 800,  name: 'Умножатель',  icon: '🚀' },
  { at: 1200, name: 'Мастер',      icon: '🧙' },
  { at: 1800, name: 'Гений',       icon: '🦁' },
  { at: 2600, name: 'Профессор',   icon: '🎓' },
  { at: 3600, name: 'Чемпион',     icon: '🏆' },
  { at: 5000, name: 'Легенда',     icon: '👑' },
];

const PRAISE = ['Молодец!', 'Отлично!', 'Супер!', 'Так держать!', 'Верно!', 'Здорово!', 'Умница!', 'Класс!'];
const SUPPORT = [
  'Почти! Давай разберёмся 🙂',
  'Не страшно! Смотри, как посчитать:',
  'Ошибаться — нормально, так мы учимся!',
  'Хорошая попытка! Вот подсказка:',
];
const DOT_COLORS = ['#5b6cf0', '#22b07d', '#ff8a3d', '#e05bb5', '#2bb3d6', '#9b6cf0', '#f2b80c', '#ef6461', '#4caf50', '#8d6e63'];

/* ================= Сохранение в браузере ================= */
const DEFAULTS = { points: 0, stars: 0, bestSpeed: 0, bestStreak: 0, games: 0, selected: [2, 3, 4, 5], sound: true };

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
function levelIndex(points) {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].at) i++;
  return i;
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}

/* ================= Звуки (без файлов) ================= */
let audio = null;
function beep(freqs, dur = 0.12, type = 'sine') {
  if (!data.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    freqs.forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      const t = audio.currentTime + i * dur;
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    });
  } catch (e) { /* звук не обязателен */ }
}
const sounds = {
  good: () => beep([660, 880]),
  oops: () => beep([330, 294], 0.16, 'triangle'),
  win: () => beep([523, 659, 784, 1047], 0.14),
};

/* ================= Меню ================= */
function renderMenu() {
  const li = levelIndex(data.points);
  const lvl = LEVELS[li];
  const next = LEVELS[li + 1];
  $('levelIcon').textContent = lvl.icon;
  $('levelNum').textContent = li + 1;
  $('levelName').textContent = lvl.name;
  if (next) {
    const need = next.at - data.points;
    $('levelSub').textContent = `До уровня «${next.name}»: ${need} ${plural(need, 'очко', 'очка', 'очков')}`;
    $('levelBar').style.width = ((data.points - lvl.at) / (next.at - lvl.at) * 100) + '%';
  } else {
    $('levelSub').textContent = 'Самый высокий уровень! Ты настоящая легенда!';
    $('levelBar').style.width = '100%';
  }
  $('statStars').textContent = data.stars;
  $('statPoints').textContent = data.points;
  $('statBest').textContent = data.bestSpeed;
  $('statStreak').textContent = data.bestStreak;
  $('soundBtn').textContent = data.sound ? '🔊' : '🔇';

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

/* ================= Игра ================= */
let game = null;

function startGame(mode) {
  game = {
    mode,
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
  const bar = document.querySelector('.game-progress');
  bar.classList.toggle('speed', mode === 'speed');
  bar.classList.remove('hurry');
  $('hudScore').textContent = '0';
  $('streak').innerHTML = '&nbsp;';
  showScreen('game');
  nextQuestion();
  if (mode === 'speed') {
    game.lastTick = performance.now();
    game.timerId = setInterval(tick, 100);
  }
  updateHud();
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
  const bar = $('gameBar');
  if (game.mode === 'speed') {
    const sec = Math.ceil(game.timeLeft / 1000);
    $('hudInfo').textContent = `⏱ ${sec} сек · ✅ ${game.correct}`;
    bar.style.width = (game.timeLeft / SPEED_TIME * 100) + '%';
    document.querySelector('.game-progress').classList.toggle('hurry', sec <= 10);
  } else {
    $('hudInfo').textContent = `Пример ${Math.min(game.asked, TRAIN_QUESTIONS)} из ${TRAIN_QUESTIONS}`;
    bar.style.width = ((game.asked - 1) / TRAIN_QUESTIONS * 100) + '%';
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

  if (value === right) {
    game.correct++;
    game.streak++;
    game.maxStreak = Math.max(game.maxStreak, game.streak);
    const bonus = game.streak >= 3 ? 5 : 0;
    game.score += 10 + bonus;
    btn.classList.add('correct');
    $('feedback').textContent = pick(PRAISE) + (bonus ? ' +' + (10 + bonus) : ' +10');
    $('feedback').className = 'feedback good';
    $('streak').textContent = game.streak >= 3 ? `🔥 ${game.streak} подряд! Бонус +5` : ' ';
    $('hudScore').textContent = game.score;
    sounds.good();
    updateHud();
    game.nextId = setTimeout(nextQuestion, game.mode === 'speed' ? 450 : 800);
  } else {
    game.streak = 0;
    game.paused = true; // пока смотрим объяснение, время не идёт
    game.mistakes.push({ a, b, right });
    btn.classList.add('wrong');
    document.querySelectorAll('.answer').forEach(x => {
      if (Number(x.textContent) === right) x.classList.add('correct');
    });
    $('feedback').textContent = pick(SUPPORT);
    $('feedback').className = 'feedback oops';
    $('streak').innerHTML = '&nbsp;';
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

/* ================= Итоги ================= */
function starsFor(mode, correct) {
  if (mode === 'train') return correct >= 10 ? 3 : correct >= 8 ? 2 : correct >= 5 ? 1 : 0;
  return correct >= 20 ? 3 : correct >= 12 ? 2 : correct >= 6 ? 1 : 0;
}

function finishGame() {
  stopTimers();
  const g = game;
  game = null;

  const stars = starsFor(g.mode, g.correct);
  const levelBefore = levelIndex(data.points);
  data.points += g.score;
  data.stars += stars;
  data.games++;
  const newStreak = g.maxStreak > data.bestStreak;
  if (newStreak) data.bestStreak = g.maxStreak;
  let newRecord = false;
  if (g.mode === 'speed' && g.correct > data.bestSpeed) {
    // первый результат — тоже рекорд, но не хвастаемся нулём
    newRecord = g.correct > 0;
    data.bestSpeed = g.correct;
  }
  const levelAfter = levelIndex(data.points);
  saveData();

  // звёзды
  $('resStars').innerHTML = [0, 1, 2].map(i =>
    `<span class="s${i < stars ? '' : ' off'}" style="animation-delay:${i * 0.2}s">⭐</span>`).join('');

  const titles = [
    'Ты молодец, что тренируешься!',
    'Хорошее начало!',
    'Отлично получилось! 💪',
    'Великолепно, Никита! 🏆',
  ];
  const texts = [
    'С каждым разом будет получаться всё лучше. Попробуем ещё?',
    'Ещё немного практики — и звёзд станет больше!',
    'Совсем чуть-чуть до трёх звёзд!',
    'Три звезды! Ты настоящий мастер умножения!',
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

  const lvl = LEVELS[levelAfter];
  $('resLevel').classList.toggle('hidden', levelAfter === levelBefore);
  $('resLevel').textContent = `${lvl.icon} Новый уровень: ${levelAfter + 1}-й — «${lvl.name}»!`;

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
  if (stars >= 2) sounds.win();
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
$('allBtn').addEventListener('click', () => {
  data.selected = NUMBERS.slice();
  saveData();
  renderMenu();
});
$('soundBtn').addEventListener('click', () => {
  data.sound = !data.sound;
  saveData();
  renderMenu();
  if (data.sound) sounds.good();
});

renderMenu();
