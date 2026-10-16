'use strict';

/* Самолёты для ангара. Все нарисованы здесь же (SVG), без картинок из интернета.
   rank — номер звания (с нуля), на котором самолёт открывается. */

const INK = '#2b2d42';
const GLASS = '#bfe6ff';

const SHAPES = {
  // Кукурузник: два крыла и пропеллер
  biplane: c => `
    <polygon points="14,12 30,28 14,30" fill="${c.wing}"/>
    <rect x="10" y="29" width="22" height="5" rx="2.5" fill="${c.wing}"/>
    <line x1="58" y1="44" x2="56" y2="50"/>
    <circle cx="56" cy="53" r="5" fill="${INK}"/>
    <rect x="20" y="25" width="72" height="15" rx="7.5" fill="${c.body}"/>
    <path d="M30 26 Q36 16 43 26 Z" fill="${GLASS}"/>
    <rect x="44" y="13" width="38" height="6" rx="3" fill="${c.wing}"/>
    <rect x="44" y="40" width="38" height="6" rx="3" fill="${c.wing}"/>
    <line x1="52" y1="19" x2="52" y2="40"/>
    <line x1="74" y1="19" x2="74" y2="40"/>
    <rect x="91" y="28" width="6" height="9" rx="2" fill="${INK}"/>
    <ellipse class="prop" cx="100" cy="32.5" rx="2" ry="15" fill="#6b7088" stroke="none" opacity=".6"/>`,

  // Учебный самолёт: одно крыло и большой фонарь кабины
  prop: c => `
    <polygon points="14,12 30,28 14,30" fill="${c.wing}"/>
    <rect x="10" y="29" width="22" height="5" rx="2.5" fill="${c.wing}"/>
    <line x1="62" y1="42" x2="62" y2="49"/>
    <circle cx="62" cy="52" r="5" fill="${INK}"/>
    <rect x="20" y="25" width="72" height="15" rx="7.5" fill="${c.body}"/>
    <path d="M48 26 Q60 12 74 26 Z" fill="${GLASS}"/>
    <rect x="40" y="33" width="38" height="6" rx="3" fill="${c.wing}"/>
    <rect x="91" y="28" width="6" height="9" rx="2" fill="${INK}"/>
    <ellipse class="prop" cx="100" cy="32.5" rx="2" ry="15" fill="#6b7088" stroke="none" opacity=".6"/>`,

  // Вертолёт
  heli: c => `
    <polygon points="8,27 46,25 46,35 8,31" fill="${c.body}"/>
    <polygon points="4,16 14,27 8,31" fill="${c.wing}"/>
    <circle class="prop" cx="9" cy="21" r="7" fill="#6b7088" stroke="none" opacity=".4"/>
    <line x1="56" y1="44" x2="56" y2="52"/>
    <line x1="80" y1="44" x2="80" y2="52"/>
    <path d="M44 52 H92 Q98 52 98 48" fill="none"/>
    <ellipse cx="68" cy="32" rx="28" ry="15" fill="${c.body}"/>
    <path d="M72 19 Q94 21 95 34 L74 34 Z" fill="${GLASS}"/>
    <rect x="44" y="35" width="24" height="4" rx="2" fill="${c.wing}" stroke="none"/>
    <rect x="64" y="11" width="7" height="7" fill="${INK}"/>
    <rect class="rotor" x="22" y="8" width="92" height="4" rx="2" fill="${INK}"/>`,

  // Воздушный шар
  balloon: c => `
    <path d="M60 2 C86 2 88 30 68 44 L52 44 C32 30 34 2 60 2 Z" fill="${c.body}"/>
    <path d="M60 2 C74 2 76 30 64 44 L56 44 C44 30 46 2 60 2 Z" fill="${c.wing}"/>
    <path d="M60 2 C65 2 66 30 61 44 L59 44 C54 30 55 2 60 2 Z" fill="${c.accent}"/>
    <line x1="53" y1="44" x2="54" y2="51"/>
    <line x1="67" y1="44" x2="66" y2="51"/>
    <rect x="51" y="50" width="18" height="9" rx="2" fill="#c28a4a"/>`,

  // Пассажирский лайнер
  airliner: c => `
    <polygon points="8,5 20,5 34,26 14,26" fill="${c.accent}"/>
    <polygon points="8,30 26,30 20,36 6,36" fill="${c.wing}"/>
    <path d="M12 24 H96 Q112 24 113 32 Q112 38 100 38 H20 Q12 38 12 31 Z" fill="${c.body}"/>
    <rect x="16" y="33" width="84" height="2.5" fill="${c.accent}" stroke="none"/>
    ${[30, 37, 44, 51, 58, 65, 72, 79, 86].map(x => `<circle cx="${x}" cy="29" r="1.8" fill="${GLASS}" stroke="none"/>`).join('')}
    <path d="M100 26 Q108 27 110 31 L101 31 Z" fill="${GLASS}" stroke-width="1"/>
    <polygon points="52,34 68,34 50,55 42,55" fill="${c.wing}"/>
    <rect x="46" y="44" width="16" height="7" rx="3.5" fill="${c.accent}"/>`,

  // Истребитель
  fighter: c => `
    <polygon class="flame" points="14,30 0,33 14,36" fill="#ff8a3d" stroke="none"/>
    <polygon points="16,30 20,9 32,9 42,28" fill="${c.accent}"/>
    <polygon points="14,28 44,25 92,26 117,32 92,38 44,39 14,36" fill="${c.body}"/>
    <path d="M72 26 Q84 17 97 28 Z" fill="${GLASS}"/>
    <polygon points="48,34 80,34 46,55 36,55" fill="${c.wing}"/>
    <polygon points="16,35 30,35 20,45 12,45" fill="${c.wing}"/>
    <circle cx="54" cy="44" r="3" fill="${c.accent}"/>`,

  // Сверхзвуковой (крыло-треугольник)
  supersonic: c => `
    <polygon points="10,7 18,7 32,26 14,26" fill="${c.accent}"/>
    <path d="M8 26 H94 Q114 27 119 33 Q112 37 94 37 H14 Q8 37 8 31 Z" fill="${c.body}"/>
    <rect x="12" y="33" width="84" height="2" fill="${c.accent}" stroke="none"/>
    ${[34, 41, 48, 55, 62, 69, 76, 83].map(x => `<circle cx="${x}" cy="30" r="1.5" fill="${GLASS}" stroke="none"/>`).join('')}
    <polygon points="28,35 88,35 34,53 20,53" fill="${c.wing}"/>
    <rect x="34" y="46" width="22" height="6" rx="3" fill="${c.accent}"/>`,

  // Ракета
  rocket: c => `
    <path class="flame" d="M22 25 L2 32 L22 39 Z" fill="#ff8a3d" stroke="none"/>
    <path class="flame" d="M22 28 L10 32 L22 36 Z" fill="#ffd23f" stroke="none"/>
    <polygon points="22,24 36,24 28,9 16,9" fill="${c.accent}"/>
    <polygon points="22,40 36,40 28,55 16,55" fill="${c.accent}"/>
    <rect x="20" y="22" width="72" height="20" rx="6" fill="${c.body}"/>
    <polygon points="90,22 117,32 90,42" fill="${c.accent}"/>
    <circle cx="72" cy="32" r="6" fill="${GLASS}"/>
    <rect x="40" y="29" width="18" height="6" rx="3" fill="${c.accent}"/>`,
};

const PLANES = [
  { id: 'biplane',    name: 'Кукурузник',         rank: 0, shape: 'biplane',    c: { body: '#ffd23f', wing: '#3bb273' } },
  { id: 'trainer',    name: 'Учебный самолёт',    rank: 1, shape: 'prop',       c: { body: '#ef6461', wing: '#2bb3d6' } },
  { id: 'heli',       name: 'Вертолёт',           rank: 2, shape: 'heli',       c: { body: '#5b6cf0', wing: '#ffd23f' } },
  { id: 'balloon',    name: 'Воздушный шар',      rank: 3, shape: 'balloon',    c: { body: '#ef6461', wing: '#ffd23f', accent: '#22b07d' } },
  { id: 'airliner',   name: 'Пассажирский лайнер', rank: 4, shape: 'airliner',  c: { body: '#ffffff', wing: '#c9d1ff', accent: '#3d5af1' } },
  { id: 'fireheli',   name: 'Пожарный вертолёт',  rank: 5, shape: 'heli',       c: { body: '#ef3b2c', wing: '#ffffff' } },
  { id: 'fighter',    name: 'Истребитель',        rank: 6, shape: 'fighter',    c: { body: '#a3adbf', wing: '#7b8699', accent: '#3d5af1' } },
  { id: 'cargo',      name: 'Грузовой великан',   rank: 7, shape: 'airliner',   c: { body: '#8bc34a', wing: '#5f8f2e', accent: '#ff8a3d' } },
  { id: 'supersonic', name: 'Сверхзвуковой',      rank: 8, shape: 'supersonic', c: { body: '#ffffff', wing: '#dfe5ff', accent: '#ef6461' } },
  { id: 'rocket',     name: 'Ракета',             rank: 9, shape: 'rocket',     c: { body: '#f4f6ff', accent: '#ef6461' } },
];

function planeById(id) {
  return PLANES.find(p => p.id === id) || PLANES[0];
}

function planeSVG(id) {
  const p = planeById(id);
  return `<svg class="plane-svg" viewBox="0 0 120 60" aria-label="${p.name}" role="img">` +
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${SHAPES[p.shape](p.c)}</g></svg>`;
}
