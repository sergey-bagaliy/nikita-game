'use strict';

/* Боссы для режима «Босс». Нарисованы здесь же (SVG), без картинок из интернета.
   После каждой победы приходит следующий босс (по кругу). */

const BOSSES = [
  { name: 'Грозовая Туча',   icon: '⚡', body: '#8b97b8', extra: 'bolt' },
  { name: 'Злой Ураган',     icon: '🌀', body: '#a184e6', extra: 'swirl' },
  { name: 'Ледяной Вихрь',   icon: '❄️', body: '#8fd6f2', extra: 'snow' },
  { name: 'Огненный Смерч',  icon: '🔥', body: '#ff9d63', extra: 'fire' },
  { name: 'Чёрная Буря',     icon: '🌑', body: '#646985', extra: 'bolt', pupil: '#e0302b' },
  { name: 'Король Бурь',     icon: '👑', body: '#7484ea', extra: 'crown' },
];

// Облако из кружков: сначала тёмный контур, сверху — заливка
const BOSS_CLOUD = [[40, 62, 24], [66, 42, 28], [96, 46, 25], [116, 66, 18], [24, 74, 15]];
const BOSS_BASE = { x: 22, y: 60, w: 104, h: 32 };

const BOSS_EXTRAS = {
  bolt: `
    <polygon points="48,86 40,104 49,102 43,120 60,96 51,98 57,86" fill="#ffd23f"/>
    <polygon points="98,86 92,100 100,99 95,114 109,94 101,95 106,86" fill="#ffd23f"/>`,
  swirl: `
    <g fill="none" stroke="#6f52b8" stroke-width="4">
      <path d="M50 96 Q74 104 98 96"/>
      <path d="M58 104 Q74 110 90 104"/>
      <path d="M65 111 Q74 115 83 111"/>
      <path d="M71 117 Q75 119 78 116"/>
    </g>`,
  snow: `
    ${[[44, 104], [72, 112], [100, 104]].map(([x, y]) =>
      `<g stroke="#3d9ad1" stroke-width="3"><line x1="${x - 6}" y1="${y}" x2="${x + 6}" y2="${y}"/>` +
      `<line x1="${x - 4}" y1="${y - 5}" x2="${x + 4}" y2="${y + 5}"/><line x1="${x + 4}" y1="${y - 5}" x2="${x - 4}" y2="${y + 5}"/></g>`).join('')}`,
  fire: `
    <path d="M44 88 q-8 12 0 22 q2 -8 7 -10 q-1 -6 -7 -12 z" fill="#ff6b35"/>
    <path d="M72 88 q-10 14 0 26 q3 -9 8 -12 q-1 -8 -8 -14 z" fill="#ffd23f"/>
    <path d="M100 88 q-8 12 0 22 q2 -8 7 -10 q-1 -6 -7 -12 z" fill="#ff6b35"/>`,
  crown: `
    <polygon points="48,22 54,4 64,16 72,0 80,16 90,4 96,22" fill="#ffd23f"/>
    <circle cx="72" cy="12" r="3" fill="#ef6461" stroke="none"/>`,
};

function bossSVG(index) {
  const b = BOSSES[index % BOSSES.length];
  const circles = (fill, stroke) => BOSS_CLOUD.map(([x, y, r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke ? ` stroke="${INK}" stroke-width="5"` : ''}/>`).join('');
  const base = (fill, stroke) => `<rect x="${BOSS_BASE.x}" y="${BOSS_BASE.y}" width="${BOSS_BASE.w}" height="${BOSS_BASE.h}" rx="16" fill="${fill}"${stroke ? ` stroke="${INK}" stroke-width="5"` : ''}/>`;
  const extraBelow = b.extra === 'crown' ? '' : BOSS_EXTRAS[b.extra];
  const extraAbove = b.extra === 'crown' ? BOSS_EXTRAS.crown : '';
  return `<svg class="boss-svg" viewBox="0 -4 144 128" aria-label="${b.name}" role="img">
    <g stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="boss-extra">${extraBelow}</g>
    ${circles(INK, true)}${base(INK, true)}
    ${circles(b.body, false)}${base(b.body, false)}
    <g stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${extraAbove}</g>
    <g class="boss-face" stroke="${INK}" stroke-linecap="round">
      <line x1="46" y1="46" x2="64" y2="54" stroke-width="4.5"/>
      <line x1="102" y1="46" x2="84" y2="54" stroke-width="4.5"/>
      <g class="eyes">
        <ellipse cx="57" cy="64" rx="8" ry="9" fill="#fff" stroke-width="2"/>
        <ellipse cx="91" cy="64" rx="8" ry="9" fill="#fff" stroke-width="2"/>
        <circle cx="60" cy="66" r="4" fill="${b.pupil || INK}" stroke="none"/>
        <circle cx="88" cy="66" r="4" fill="${b.pupil || INK}" stroke="none"/>
      </g>
      <g class="eyes-hurt" stroke-width="3.5">
        <path d="M51 59 l12 10 M63 59 l-12 10" fill="none"/>
        <path d="M85 59 l12 10 M97 59 l-12 10" fill="none"/>
      </g>
      <path class="mouth" d="M60 82 Q74 76 88 82" fill="none" stroke-width="4"/>
      <g class="mouth-laugh">
        <path d="M58 78 Q74 100 90 78 Z" fill="#7a1f2b" stroke-width="2.5"/>
        <path d="M62 79 H86 L84 83 H64 Z" fill="#fff" stroke="none"/>
      </g>
    </g>
  </svg>`;
}
