'use strict';

/* ================= Голоса персонажей =================
   Встроенный в браузер синтез речи (бесплатно, без интернета на большинстве телефонов).
   Каждый персонаж — свой голос: мужской/женский, высота и скорость.
   Слова со звёздочкой (мат) не произносятся, а запикиваются. */

const Voice = {
  enabled: true,
  ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  ru: [],
  token: 0,
  busyUntil: 0,
  priority: 0,
  beep: null, // функция «пи-и-ип», задаётся из game.js

  init() {
    if (!this.ok) return;
    const load = () => {
      const all = speechSynthesis.getVoices();
      this.ru = all.filter(v => /^ru/i.test(v.lang));
    };
    load();
    speechSynthesis.onvoiceschanged = load;
  },

  // iPhone разрешает говорить только после касания — «прогреваем» голос на кнопке «На смену»
  warm() {
    if (!this.ok) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (e) { /* не страшно */ }
  },

  pickVoice(gender) {
    const list = this.ru;
    if (!list.length) return null;
    const female = /(milena|irina|alena|alyona|katya|katerina|ekaterina|anna|tatyana|svetlana|elena|daria|dariya|female|жен|google)/i;
    const male = /(yuri|pavel|dmitr|maxim|maksim|aleksandr|nikolai|ivan|sergey|male(?!.*female)|муж)/i;
    const want = gender === 'f' ? list.find(v => female.test(v.name)) : list.find(v => male.test(v.name) && !female.test(v.name));
    return want || list[0];
  },

  stop() {
    this.token++;
    this.priority = 0;
    this.busyUntil = 0;
    if (this.ok) speechSynthesis.cancel();
  },

  // text — фраза, roleId — ключ из ROLES, prio — важность (новая важная фраза перебивает старую)
  speak(text, roleId, prio = 1) {
    if (!this.enabled || !this.ok) return;
    const now = performance.now();
    if (now < this.busyUntil && prio <= this.priority) return;
    this.stop();
    const my = this.token;
    this.priority = prio;
    const role = ROLES[roleId] || ROLES.valera;
    const voice = this.pickVoice(role.gender);
    // мужчины с одним «женским» голосом звучат ниже, и наоборот
    let pitch = role.pitch;
    if (voice && role.gender === 'm' && /(milena|irina|alena|google|female)/i.test(voice.name)) pitch = Math.max(0.1, pitch - 0.3);

    const clean = text.replace(/[«»"„“]/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
    const parts = clean.split(/(\S*\*\S*)/).map(p => p.trim()).filter(Boolean);
    // примерная длительность, чтобы мелкие фразы не перебивали
    this.busyUntil = now + Math.min(6000, 300 + clean.length * 70 / role.rate);

    const next = i => {
      if (my !== this.token || i >= parts.length) { if (my === this.token) this.priority = 0; return; }
      const part = parts[i];
      if (part.includes('*')) {
        if (this.beep) this.beep();
        setTimeout(() => next(i + 1), 330);
        return;
      }
      const u = new SpeechSynthesisUtterance(part);
      u.lang = 'ru-RU';
      if (voice) u.voice = voice;
      u.pitch = pitch;
      u.rate = role.rate;
      u.volume = 1;
      u.onend = () => next(i + 1);
      u.onerror = () => next(i + 1);
      speechSynthesis.speak(u);
    };
    next(0);
  },
};

Voice.init();
