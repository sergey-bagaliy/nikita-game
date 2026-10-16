'use strict';

/* ================= Голоса персонажей =================
   Все фразы заранее озвучены (папка voice/, словарь VOICE_FILES в voices.js):
   у каждого персонажа свой голос, ударения расставлены вручную.
   Если фразы нет в словаре — запасной вариант: встроенный в браузер синтез речи.
   В «режиме прораба» мат на экране со звёздочкой, а вслух — полностью. */

// Как произносить слова со звёздочкой (для запасного синтеза)
const UNCENSOR = {
  'бл*': 'блядь', 'е*ать': 'ебать', 'нах*й': 'нахуй', 'отъе*ись': 'отъебись', 'ох*енно': 'охуенно',
  'е*анулся': 'ебанулся', 'е*учая': 'ебучая', 'е*учий': 'ебучий', 'е*ёт': 'ебёт', 'е*ёшь': 'ебёшь',
  'м*дак': 'мудак', 'м*дила': 'мудила', 'ох*ел': 'охуел', 'п*здец': 'пиздец', 'п*зду': 'пизду',
  'су*а': 'сука', 'су*ин': 'сукин', 'х*ярил': 'хуярил', 'съе*ись': 'съебись', 'х*йня': 'хуйня', 'е*учих': 'ебучих',
};
function uncensor(text) {
  return text.replace(/[А-Яа-яЁё]*\*[А-Яа-яЁё]*/g, w => {
    const full = UNCENSOR[w.toLowerCase()];
    if (!full) return w;
    return w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() ? full[0].toUpperCase() + full.slice(1) : full;
  });
}

const Voice = {
  enabled: true,
  uncensored: false,
  ttsOk: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  ru: [],
  token: 0,
  busyUntil: 0,
  priority: 0,
  beep: null,
  actx: null,
  src: null,
  files: {},      // скачанные mp3 (сжатые) — только если нет офлайн-кэша
  decoded: new Map(), // последние разобранные фразы: повтор играет сразу, без повторной распаковки mp3

  init() {
    if (!this.ttsOk) return;
    const load = () => { this.ru = speechSynthesis.getVoices().filter(v => /^ru/i.test(v.lang)); };
    load();
    speechSynthesis.onvoiceschanged = load;
  },

  ctx() {
    try {
      this.actx = this.actx || new (window.AudioContext || window.webkitAudioContext)();
      // iPhone после звонка или сворачивания ставит 'interrupted' — будим из любого состояния
      if (this.actx.state !== 'running') this.actx.resume().catch(() => { /* разбудим при следующем касании */ });
      return this.actx;
    } catch (e) { return null; }
  },

  // Телефоны разрешают звук только после касания — вызываем на каждом нажатии
  warm() {
    this.ctx();
    if (this.ttsOk && !this.warmed) {
      this.warmed = true;
      try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* не страшно */ }
    }
  },

  // Заранее скачиваем фразы текущего режима (обычный / с матом), по две за раз
  prefetch(mat) {
    if (!this.enabled || typeof VOICE_FILES === 'undefined' || this.prefetching) return;
    if (navigator.connection && navigator.connection.saveData) return; // «экономия трафика» — качаем по мере надобности
    this.prefetching = true;
    const want = Object.entries(VOICE_FILES).filter(([k]) => mat || !k.includes('*')).map(([, f]) => f);
    const queue = [...new Set(want)].filter(f => !this.files[f]);
    const worker = () => {
      const f = queue.shift();
      if (!f) { this.prefetching = false; return; }
      this.fetchFile(f).then(worker, worker);
    };
    worker(); worker();
  },

  fetchFile(f) {
    if (this.files[f]) return Promise.resolve(this.files[f]);
    // при офлайн-кэше файл и так лежит в телефоне — в памяти страницы его не держим
    const keep = !(navigator.serviceWorker && navigator.serviceWorker.controller);
    return fetch(f).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => { if (keep) this.files[f] = b; return b; });
  },

  decode(a, file) {
    const hit = this.decoded.get(file);
    if (hit) { this.decoded.delete(file); this.decoded.set(file, hit); return Promise.resolve(hit); }
    return this.fetchFile(file)
      .then(buf => new Promise((res, rej) => a.decodeAudioData(buf.slice(0), res, rej)))
      .then(ab => {
        this.decoded.set(file, ab);
        if (this.decoded.size > 24) this.decoded.delete(this.decoded.keys().next().value);
        return ab;
      });
  },

  stop() {
    this.token++;
    this.priority = 0;
    this.busyUntil = 0;
    if (this.src) { try { this.src.stop(); } catch (e) { /* уже */ } this.src = null; }
    if (this.ttsOk) speechSynthesis.cancel();
  },

  // text — фраза как на экране, roleId — ключ из ROLES (или 'phone:роль' для звонков), prio — важность
  speak(text, roleId, prio = 1) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now < this.busyUntil && prio <= this.priority) return;
    const file = typeof VOICE_FILES !== 'undefined' ? VOICE_FILES[roleId + '|' + text] : null;
    if (file) { this.playFile(file, prio, text, roleId); return; }
    this.speakTts(text, String(roleId).replace(/^phone:/, ''), prio);
  },

  playFile(file, prio, text, roleId) {
    const a = this.ctx();
    if (!a) { this.speakTts(text, String(roleId).replace(/^phone:/, ''), prio); return; }
    this.stop();
    const my = this.token;
    this.priority = prio;
    this.busyUntil = performance.now() + 3000;
    this.decode(a, file)
      .then(audioBuf => {
        if (my !== this.token) return;
        const s = a.createBufferSource();
        const gn = a.createGain();
        gn.gain.value = 1.0;
        s.buffer = audioBuf;
        s.connect(gn).connect(a.destination);
        s.onended = () => { if (this.src === s) { this.src = null; this.priority = 0; this.busyUntil = 0; } };
        s.start();
        this.src = s;
        this.busyUntil = performance.now() + audioBuf.duration * 1000;
      })
      .catch(() => {
        // файл не загрузился (нет сети и нет в памяти) — скажем встроенным голосом браузера
        if (my === this.token) { this.priority = 0; this.busyUntil = 0; this.speakTts(text, String(roleId).replace(/^phone:/, ''), prio); }
      });
  },

  // Запасной вариант — синтез речи браузера
  pickVoice(gender) {
    const list = this.ru;
    if (!list.length) return null;
    const female = /(milena|irina|alena|alyona|katya|katerina|ekaterina|anna|tatyana|svetlana|elena|daria|dariya|female|жен|google)/i;
    const male = /(yuri|pavel|dmitr|maxim|maksim|aleksandr|nikolai|ivan|sergey|муж)/i;
    const want = gender === 'f' ? list.find(v => female.test(v.name)) : list.find(v => male.test(v.name) && !female.test(v.name));
    return want || list[0];
  },

  speakTts(text, roleId, prio) {
    if (!this.ttsOk) return;
    this.stop();
    const my = this.token;
    this.priority = prio;
    const role = ROLES[roleId] || ROLES.valera;
    const voice = this.pickVoice(role.gender);
    let pitch = role.pitch;
    if (voice && role.gender === 'm' && /(milena|irina|alena|google|female)/i.test(voice.name)) pitch = Math.max(0.1, pitch - 0.3);
    const spoken = this.uncensored ? uncensor(text) : text;
    const clean = spoken.replace(/[«»"„“]/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
    const parts = clean.split(/(\S*\*\S*)/).map(p => p.trim()).filter(Boolean);
    this.busyUntil = performance.now() + Math.min(6000, 300 + clean.length * 70 / role.rate);
    const next = i => {
      if (my !== this.token || i >= parts.length) { if (my === this.token) this.priority = 0; return; }
      const part = parts[i];
      if (part.includes('*')) { if (this.beep) this.beep(); setTimeout(() => next(i + 1), 330); return; }
      const u = new SpeechSynthesisUtterance(part);
      u.lang = 'ru-RU';
      if (voice) u.voice = voice;
      u.pitch = pitch; u.rate = role.rate; u.volume = 1;
      u.onend = () => next(i + 1);
      u.onerror = () => next(i + 1);
      speechSynthesis.speak(u);
    };
    next(0);
  },
};

Voice.init();
