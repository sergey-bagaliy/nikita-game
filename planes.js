'use strict';

/* Самолёты для ангара: настоящие машины, вид сбоку. Нарисованы здесь же (SVG), без картинок из интернета.
   level — сколько экзаменов по таблице умножения нужно сдать, чтобы самолёт открылся
   (последний открывается за финальный экзамен). С каждым самолётом открывается его мини-игра (arcade.js). */

const INK = '#2b2d42';

// Сделать цвет светлее (f > 0) или темнее (f < 0)
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  const mix = v => Math.round((t - v) * p + v);
  return '#' + ((1 << 24) + (mix(n >> 16) << 16) + (mix((n >> 8) & 255) << 8) + mix(n & 255)).toString(16).slice(1);
}

function planeDefs(u, c) {
  const lg = (id, stops) => `<linearGradient id="${u}${id}" x1="0" y1="0" x2="0" y2="1">` +
    stops.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join('') + '</linearGradient>';
  return '<defs>' +
    lg('b', [[0, shade(c.body, 0.5)], [0.45, c.body], [1, shade(c.body, -0.32)]]) +
    lg('a', [[0, shade(c.accent, 0.25)], [1, shade(c.accent, -0.25)]]) +
    lg('w', [[0, shade(c.wing, 0.35)], [1, shade(c.wing, -0.3)]]) +
    lg('g', [[0, '#eaf7ff'], [0.5, '#8cc3e8'], [1, '#2f5f8a']]) +
    lg('m', [[0, '#d5dae1'], [0.5, '#8a929e'], [1, '#4a515c']]) +
    lg('k', [[0, '#5a6170'], [1, '#1d2028']]) +
    '</defs>';
}

const range = (from, to, step) => { const r = []; for (let x = from; x <= to; x += step) r.push(+x.toFixed(2)); return r; };

const SHAPES = {
  // Ан-2: биплан с большим поршневым мотором и неубирающимися колёсами
  an2: F => `
    <path d="M2 31.5 Q3 29.5 8 29.5 L24 30 Q26 31 24 32 L6 33 Q2 33 2 31.5Z" fill="${F('w')}"/>
    <path d="M7 31 L5 12 Q5.5 7 10 7 L13.5 7.4 Q16.5 8.6 17.6 12.6 L24 29.5 Z" fill="${F('b')}"/>
    <path d="M6 31 L58 21.5 L94 20.5 L95 39.5 L62 41 Q36 39 8 34.5 Q5 33 6 31Z" fill="${F('b')}"/>
    <path d="M30 24.5 h6 v11.5 h-6z" fill="none" stroke-width=".5" opacity=".55"/>
    ${[46, 53, 60, 67].map(x => `<circle cx="${x}" cy="28.5" r="1.9" fill="${F('g')}" stroke-width=".5"/>`).join('')}
    <path d="M93 20.5 L103 21.5 Q107 23 107 30 Q107 37 103 38.5 L93 39.5 Z" fill="${F('k')}"/>
    <path d="M95 22 L95 38" stroke="#7b8494" stroke-width=".6"/>
    <ellipse cx="107.5" cy="30" rx="2.2" ry="4" fill="${F('m')}"/>
    <path d="M80 21 L91 20.6 L92 27 L80.5 27.6 Z" fill="${F('g')}"/>
    <path d="M86 20.8 L86.3 27.3" stroke-width=".6"/>
    <path d="M71 13.4 L75 21.2 M82 13 L84 20.8" stroke-width=".9"/>
    <path d="M62 12 Q64 9 73 8.8 L87 9.2 Q90 10 89 11.6 L64 13.6 Q61.5 13.6 62 12Z" fill="${F('w')}"/>
    <path d="M68 41 Q70 39 77 39 L87 39.4 Q89 40.2 88 41.4 L70 42.8 Q67.5 42.6 68 41Z" fill="${F('w')}"/>
    <path d="M77 13.2 L78 39.2" stroke-width="1.3"/>
    <path d="M80.5 42 L78.5 48.5 M85 41.5 L79.5 48.5" stroke-width="1.3"/>
    <circle cx="78.5" cy="51" r="4.6" fill="${F('k')}"/>
    <circle cx="78.5" cy="51" r="1.5" fill="#9aa3ad" stroke="none"/>
    <path d="M10 34.5 L10.5 36" stroke-width="1"/>
    <circle cx="10.5" cy="37.2" r="1.7" fill="${F('k')}"/>
    <ellipse class="prop" cx="109.3" cy="30" rx="1.5" ry="17" fill="#5d6470" stroke="none" opacity=".55"/>`,

  // Як-52: учебно-пилотажный, низкое крыло, кабина на двоих
  yak52: F => `
    <path d="M3 30 Q4 28.5 9 28.6 L22 29.2 Q23.5 30 22 30.8 L8 31.6 Q3 31.6 3 30Z" fill="${F('w')}"/>
    <path d="M8 29 L6 15 Q6.5 11.5 10 11.5 L12.5 11.8 Q15 13 16.5 16 L24 28 Z" fill="${F('a')}"/>
    <path d="M6 29.5 Q24 26.5 50 25.2 L90 24.3 L91 37.6 L56 38.2 Q28 37 7 33 Q4.5 31.5 6 29.5Z" fill="${F('b')}"/>
    <path d="M12 31 L90 29.6 L90 31.6 L12 32.6Z" fill="${F('a')}" stroke="none"/>
    <path d="M89 24.3 L99 25.3 Q103 27 103 31 Q103 35 99 36.8 L89 37.6Z" fill="${F('m')}"/>
    <path d="M102.5 27.2 Q110 31 102.5 34.8 Z" fill="${F('a')}"/>
    <path d="M54 25.3 Q58 17.5 68 17 Q80 16.8 86 24.4 Z" fill="${F('g')}"/>
    <path d="M69 17.1 L69.5 25" stroke-width=".7"/>
    <path d="M94 37 L94 44.5 M69 39 L69 45" stroke-width="1.4"/>
    <path d="M58 37.5 Q60 35.6 68 35.4 L80 35.8 Q82.5 36.6 81 38 L61 39.4 Q57.5 39.3 58 37.5Z" fill="${F('w')}"/>
    <circle cx="94" cy="47" r="2.8" fill="${F('k')}"/>
    <circle cx="69" cy="47.8" r="3.4" fill="${F('k')}"/>
    <ellipse class="prop" cx="105" cy="31" rx="1.4" ry="14" fill="#5d6470" stroke="none" opacity=".55"/>`,

  // Ми-8: большой транспортный вертолёт
  mi8: F => `
    <path d="M46 25.5 L12 22.5 L10.5 26 L46 35.5 Z" fill="${F('b')}"/>
    <path d="M13 23.5 L6 8 Q6.5 6 9 6.5 L11 7 L18 25 Z" fill="${F('b')}"/>
    <path d="M18 27.5 L30 27 L30.5 28.2 L18.5 29.2Z" fill="${F('w')}"/>
    <ellipse class="rotor" cx="7" cy="11" rx="1.4" ry="7.5" fill="#5d6470" stroke="none" opacity=".5"/>
    <path d="M44 24 Q58 18.5 86 19 Q99 19.8 105 28 Q108 34 105.5 39 Q103 42.5 96 42.6 L50 42.6 Q41.5 42.4 41 35 Q40.8 27.5 44 24Z" fill="${F('b')}"/>
    <path d="M41.2 33.5 L107.6 33.5 L107 35.8 L41.3 35.8Z" fill="${F('a')}" stroke="none"/>
    <path d="M52 19.6 Q53 13.5 60 13 L84 13 Q89 13.3 91 19.4 Z" fill="${F('w')}"/>
    <path d="M50 16.6 L55 15.6 L55 19 L51 19.6Z" fill="${F('k')}"/>
    <rect x="68.5" y="8.5" width="4" height="5" fill="${F('k')}"/>
    <path d="M92 21 Q101.5 23 105.6 30 L94.5 30.5 Q93 26 92 21Z" fill="${F('g')}"/>
    <path d="M98.5 22.6 L99.3 30.4" stroke-width=".6"/>
    <path d="M100 37 Q104 37 106 38.6 L101 40 Z" fill="${F('g')}" stroke-width=".5"/>
    ${[55, 62, 69, 76].map(x => `<circle cx="${x}" cy="27.5" r="2.3" fill="${F('g')}" stroke-width=".6"/>`).join('')}
    <rect x="82" y="23" width="7" height="15" rx="1" fill="none" stroke-width=".5" opacity=".6"/>
    <path d="M100 42.4 L100 46 M58 42.4 L57 46.4" stroke-width="1.4"/>
    <circle cx="100" cy="48" r="2.6" fill="${F('k')}"/>
    <circle cx="57" cy="48.4" r="3.4" fill="${F('k')}"/>
    <rect class="rotor" x="8" y="6.6" width="112" height="2.2" rx="1.1" fill="#3a404b" stroke="none" opacity=".75"/>`,

  // Ка-32: вертолёт с двумя винтами один над другим, спасатель
  ka32: F => `
    <path d="M44 26.5 L14 26.5 L14 30.5 L44 36 Z" fill="${F('b')}"/>
    <path d="M9 17 Q9.5 15.5 11.5 15.5 L15 15.5 Q16.5 16 16.8 18 L18.5 38 Q18.5 39.2 17 39.2 L12.5 39.2 Q11 39.2 11 37.8 Z" fill="${F('b')}"/>
    <path d="M12 28 L27 27 L27.5 28.4 L12.5 29.8Z" fill="${F('w')}"/>
    <path d="M42 25 Q56 19 82 19.5 Q96 20.5 103 29 Q106 35 103.5 39.5 Q101 42.5 94 42.6 L48 42.6 Q40 42.4 39.6 35.5 Q39.4 28.5 42 25Z" fill="${F('b')}"/>
    <path d="M39.8 35.5 L105.2 35.5 Q104.8 37.8 103.5 39.5 Q101 42.5 94 42.6 L48 42.6 Q40.4 42.4 39.8 36.5Z" fill="${F('a')}" stroke="none"/>
    <path d="M50 20 Q51 14 58 13.5 L82 13.5 Q87 13.8 89 19.8 Z" fill="${F('w')}"/>
    <rect x="67" y="3.5" width="4" height="10.5" fill="${F('k')}"/>
    <path d="M89 21.3 Q99 23 103.5 30.4 L91.5 30.8 Q90.5 26 89 21.3Z" fill="${F('g')}"/>
    <path d="M96 22.3 L97 30.6" stroke-width=".6"/>
    <rect x="56" y="24" width="6" height="5" rx="1.2" fill="${F('g')}" stroke-width=".6"/>
    <rect x="66" y="24" width="6" height="5" rx="1.2" fill="${F('g')}" stroke-width=".6"/>
    <rect x="76" y="23" width="8" height="14" rx="1" fill="none" stroke-width=".5" opacity=".6"/>
    <path d="M98 42.4 L98 46 M56 42.4 L56 46.4" stroke-width="1.4"/>
    <circle cx="98" cy="47.8" r="2.6" fill="${F('k')}"/>
    <circle cx="56" cy="48.2" r="3.2" fill="${F('k')}"/>
    <rect class="rotor" x="12" y="2.6" width="108" height="2" rx="1" fill="#3a404b" stroke="none" opacity=".75"/>
    <rect class="rotor" x="12" y="8.2" width="108" height="2" rx="1" fill="#3a404b" stroke="none" opacity=".75"/>`,

  // Суперджет 100: пассажирский самолёт, два двигателя под крылом
  ssj: F => `
    <path d="M1.5 25.5 L16 24.2 L19 25.6 L4 27.4Z" fill="${F('w')}"/>
    <path d="M11 23 L4.5 5.5 Q4.6 4 6.4 4 L11.5 4 Q13 4 14 5.2 L30 22.4Z" fill="${F('a')}"/>
    <path d="M8.5 27.5 Q11 22.4 20 22.2 L98 22 Q109 22.2 114.8 28.6 Q116 31 113.5 32.6 Q108.5 35.6 98 35.8 L26 35.8 Q14 35.4 8.5 29.5 Z" fill="${F('b')}"/>
    <path d="M14 29.8 L109 29.6 L107.6 31.2 L16 31.4Z" fill="${F('a')}" stroke="none"/>
    ${range(26, 94, 4.4).map(x => `<rect x="${x}" y="25.2" width="2" height="2.6" rx=".9" fill="#2b3a4f" stroke="none"/>`).join('')}
    <path d="M103.5 24.6 L109.6 26.2 L108.8 27.6 L103 27.2 Z" fill="${F('k')}"/>
    <rect x="98.5" y="23.6" width="3" height="7.6" rx=".8" fill="none" stroke-width=".5"/>
    <rect x="19.5" y="23.8" width="2.6" height="7" rx=".8" fill="none" stroke-width=".5"/>
    <path d="M44 34.8 L74 32.6 L78 33.4 L76.5 34.6 L48 37.2 Z" fill="${F('w')}"/>
    <path d="M64 34 L70 32.8 L72 34Z" fill="${F('w')}" stroke-width=".5"/>
    <path d="M57 37.6 Q57 34 62 34 L76 34 Q80 34.4 80.6 37.4 Q80 40.6 76 41 L62 41 Q57 41 57 38Z" fill="${F('m')}"/>
    <ellipse cx="80" cy="37.5" rx="1.4" ry="3.2" fill="${F('k')}"/>`,

  // Бе-200: самолёт-амфибия, корпус как у лодки, двигатели над крылом
  be200: F => `
    <path d="M11 24 L6 6 L15 6 L30 22.5 Z" fill="${F('a')}"/>
    <path d="M3 6.2 Q4 4.6 8 4.6 L22 4.8 Q24 5.6 22.5 6.6 L6 7.8 Q2.6 7.8 3 6.2Z" fill="${F('w')}"/>
    <path d="M9 26 Q12 22 22 21.6 L94 21.4 Q107 21.8 113 28 Q114.5 31 112 33.6 Q109 37 102 38.6 L64 40.8 L61 38.2 L30 36 Q15 33 9 28.5Z" fill="${F('b')}"/>
    <path d="M14 30.4 Q20 33.4 30 34.2 L61 36.4 L64 38.8 L102 36.8 Q107.5 35.6 111.6 33.2 Q109 37 102 38.6 L64 40.8 L61 38.2 L30 36 Q18 34 14 30.4Z" fill="${F('a')}" stroke="none"/>
    <path d="M18 28.6 L110 28.2" stroke="${'#2d5fa6'}" stroke-width="1.3"/>
    ${range(34, 84, 7).map(x => `<rect x="${x}" y="24.4" width="2.4" height="2.6" rx=".9" fill="#2b3a4f" stroke="none"/>`).join('')}
    <path d="M101 23.6 L108.4 26 L107.4 27.6 L100.6 26.8Z" fill="${F('k')}"/>
    <path d="M50 21.6 Q52 18.2 60 18 L76 18.4 Q79 19.2 78 21.2 Z" fill="${F('w')}"/>
    <path d="M46 18.6 L54 18.6 L54 21.6 L48 21.6Z" fill="${F('w')}" stroke-width=".5"/>
    <path d="M38 15.2 Q38 11.6 44 11.4 L60 11.4 Q63.6 11.8 64 15 Q63.6 18.4 60 18.6 L44 18.6 Q38 18.6 38 15.8Z" fill="${F('m')}"/>
    <ellipse cx="63.8" cy="15" rx="1.2" ry="3" fill="${F('k')}"/>`,

  // Су-27: истребитель с двумя килями
  su27: F => `
    <path d="M17 27 L14 8.5 L19 8.5 L31 26Z" fill="${F('w')}" opacity=".9"/>
    <path d="M3 33 L22 31 L24 33.5 L6 35Z" fill="${F('w')}"/>
    <polygon class="flame" points="8,31.2 -3,33.5 8,35.8" fill="#ff8a3d" stroke="none"/>
    <path d="M8 30.6 L13 30 L13 37 L8 36.4Z" fill="${F('k')}"/>
    <path d="M12 33 L58 33 Q64 33.5 66 37.8 L64.5 38.6 L14 38.6 Q12 38.6 12 36.5Z" fill="${F('m')}"/>
    <path d="M12 29.5 L36 27.4 Q56 25 72 24.4 Q84 24 94 26.6 L117 30.6 L94 32.8 Q82 34.4 66 34.2 L36 34.2 L12 34.6Z" fill="${F('b')}"/>
    <path d="M40 28 Q50 26 58 27.5 Q52 30.5 42 30.6Z M64 29.6 Q72 28 78 30 Q70 32.4 64 31.6Z" fill="${F('a')}" stroke="none" opacity=".45"/>
    <path d="M104 28.3 L117 30.6 L104 32.4 Q103 30.4 104 28.3Z" fill="#7d8794"/>
    <path d="M80 25 Q86 17.8 95.6 25.8 Q88 25.2 80 25Z" fill="${F('g')}"/>
    <path d="M13 28 L9.5 7.5 Q10 6.5 11.5 6.5 L15 6.5 L28 27.4Z" fill="${F('b')}"/>
    <path d="M30 33.6 L66 31 L72 31.6 L36 35.6Z" fill="${F('w')}"/>
    <text x="73" y="31.6" font-size="4.2" font-family="Arial, sans-serif" font-weight="700" fill="#2f4f73" stroke="none">27</text>`,

  // Ан-124 «Руслан»: самый большой серийный грузовой самолёт
  an124: F => `
    <path d="M14 22 L6.5 3 Q6.8 1.6 8.5 1.6 L14 1.6 Q15.6 1.8 16.6 3 L34 19.6Z" fill="${F('a')}"/>
    <path d="M2 21.8 Q3 20.4 7 20.4 L22 20.2 Q24.4 21 23 22.4 L6 23.6 Q1.6 23.6 2 21.8Z" fill="${F('w')}"/>
    <path d="M10 23 L26 19.4 Q40 17.4 60 17.2 L88 17.2 Q94 17 97 14.6 Q100 13 104 14.8 Q110 17.6 113.6 24 Q116 30 113.6 36 Q110 40.8 102 41.2 L52 41.6 Q36 41 24 35.6 Q14 31 10 27Z" fill="${F('b')}"/>
    <path d="M22 31 Q40 30 113.9 29 L114 31 Q50 32.6 25 33Z" fill="${F('a')}" stroke="none"/>
    ${range(40, 90, 8).map(x => `<rect x="${x}" y="22" width="2" height="2.4" rx=".8" fill="#2b3a4f" stroke="none"/>`).join('')}
    <path d="M98 16 Q101 14.4 104.6 16.2 L105.4 18.4 L98.4 18.6Z" fill="${F('k')}"/>
    <path d="M108 22 Q111.5 25 112.6 28 L106 27.4Z" fill="${F('k')}"/>
    <path d="M54 41.4 Q60 44.4 78 44.4 Q92 44.2 96 41.2Z" fill="${F('w')}"/>
    <path d="M54 17.6 Q56 14.6 64 14.4 L80 14.8 Q83 15.6 82 17.4 Z" fill="${F('w')}"/>
    <path d="M48 24.4 Q48 21 54 20.8 L66 20.8 Q69.4 21.2 69.6 24.4 Q69.4 27.8 66 28 L54 28 Q48 28 48 25Z" fill="${F('m')}"/>
    <ellipse cx="69.4" cy="24.4" rx="1.2" ry="3.2" fill="${F('k')}"/>
    <path d="M60 22.6 Q60 19.2 66 19 L78 19 Q81.4 19.4 81.6 22.6 Q81.4 26 78 26.2 L66 26.2 Q60 26.2 60 23.2Z" fill="${F('m')}"/>
    <ellipse cx="81.4" cy="22.6" rx="1.2" ry="3.2" fill="${F('k')}"/>`,

  // Ту-144: первый в мире сверхзвуковой пассажирский самолёт
  tu144: F => `
    <path d="M12 25.6 L6.5 5.5 Q6.8 4.2 8.4 4.2 L11.5 4.2 Q13 4.4 14 6 L38 25Z" fill="${F('w')}"/>
    <path d="M6 28.6 Q8 25.4 16 25.2 L98 25 Q110 25.4 119 30.6 Q110 33.4 98 33.4 L16 33.4 Q8 33 6 30.4Z" fill="${F('b')}"/>
    <path d="M10 29.4 L113 29.3 L111 30.6 L12 30.7Z" fill="${F('a')}" stroke="none"/>
    ${range(28, 92, 3.6).map(x => `<circle cx="${x}" cy="27.4" r=".8" fill="#2b3a4f" stroke="none"/>`).join('')}
    <path d="M100 25.6 L106 26.8 L105.6 27.8 L100 27.4Z" fill="${F('k')}"/>
    <path d="M90 27.4 L98 26.4 L99 27.4 L91 28.6Z" fill="${F('w')}"/>
    <path d="M28 33 L78 31.2 L86 32.2 L36 35.6 Z" fill="${F('w')}"/>
    <polygon class="flame" points="22,36.2 8,38.4 22,40.6" fill="#ff8a3d" stroke="none"/>
    <path d="M24 35 L66 35 L70 36.6 L70 41 L26 41 L22 38.5 Z" fill="${F('m')}"/>
    <path d="M34 35.2 L34 41 M46 35.2 L46 41 M58 35.2 L58 41" stroke-width=".5" opacity=".6"/>
    <rect x="69" y="36.2" width="1.4" height="4.4" fill="${F('k')}"/>`,

  // «Буран»: советский многоразовый космический корабль
  buran: F => `
    <polygon class="flame" points="4,27.2 -7,28.6 4,30" fill="#ffb347" stroke="none"/>
    <path d="M4 26.6 L10 25.8 L10 31 L4 30.4Z" fill="${F('m')}"/>
    <path d="M12 24 L8.5 3.5 Q8.8 2 10.4 2 L14 2 Q15.6 2.2 16.6 4 L34 24Z" fill="${F('b')}"/>
    <path d="M14 2 Q15.6 2.2 16.6 4 L34 24 L31 24 Z" fill="${F('a')}" stroke="none"/>
    <path d="M9 24.4 L88 24 Q104 24.2 113 30 Q116.5 32.6 114 35 Q110 38 98 38.4 L14 38.4 Q9 38.4 9 34Z" fill="${F('b')}"/>
    <path d="M9.2 34.8 L100 34.8 Q108 34.4 114.8 32.8 Q115.4 34.2 114 35 Q110 38 98 38.4 L14 38.4 Q9.2 38.4 9.2 35.4Z" fill="${F('a')}" stroke="none"/>
    <path d="M108.4 27.9 Q113 30 115.2 32.4 L110 33.4 Q109 30.6 108.4 27.9Z" fill="${F('a')}" stroke="none"/>
    <path d="M30 27.4 L84 27.2" stroke-width=".5" opacity=".55"/>
    <path d="M96 25.2 L104 27 L103.4 28.4 L95.6 27.2Z" fill="${F('a')}"/>
    <text x="64" y="32.6" font-size="4" font-family="Arial, sans-serif" font-weight="700" letter-spacing=".4" fill="#22252c" stroke="none">БУРАН</text>
    <path d="M30 36.4 L80 34.6 L88 35.4 L36 39.4Z" fill="${F('a')}"/>`,
};

const PLANES = [
  { id: 'an2',   name: 'Ан-2 «Кукурузник»', level: 0, game: 'Сквозь облака', shape: 'an2',   c: { body: '#5f8b46', wing: '#79a35c', accent: '#c63b2f' } },
  { id: 'yak52', name: 'Як-52',             level: 1, game: 'Звездопад', shape: 'yak52', c: { body: '#eef1f5', wing: '#e6eaf0', accent: '#d6372b' } },
  { id: 'mi8',   name: 'Вертолёт Ми-8',     level: 2, game: 'Посылки', shape: 'mi8',   c: { body: '#e3e9f0', wing: '#a3adb9', accent: '#2d5fa6' } },
  { id: 'ka32',  name: 'Вертолёт Ка-32',    level: 3, game: 'Спасатель', shape: 'ka32',  c: { body: '#d8392b', wing: '#a3adb9', accent: '#f4f6f8' } },
  { id: 'ssj',   name: 'Суперджет 100',     level: 4, game: 'Посадка', shape: 'ssj',   c: { body: '#f4f6f9', wing: '#b8c0cc', accent: '#1f5fae' } },
  { id: 'be200', name: 'Амфибия Бе-200',    level: 5, game: 'Пожар', shape: 'be200', c: { body: '#f3f5f8', wing: '#c3cad4', accent: '#e2582c' } },
  { id: 'su27',  name: 'Истребитель Су-27', level: 6, game: 'Воздушный бой', shape: 'su27',  c: { body: '#a7b9cc', wing: '#8a9fb5', accent: '#2f4f73' } },
  { id: 'an124', name: 'Ан-124 «Руслан»',   level: 7, game: 'Точный сброс', shape: 'an124', c: { body: '#f3f5f8', wing: '#c3cad4', accent: '#2d5fa6' } },
  { id: 'tu144', name: 'Ту-144',            level: 8, game: 'Сверхзвук', shape: 'tu144', c: { body: '#f5f7fa', wing: '#c6ccd6', accent: '#24519c' } },
  { id: 'buran', name: '«Буран»',           level: 9, game: 'Метеориты', shape: 'buran', c: { body: '#f6f7f9', wing: '#d0d5dc', accent: '#22252c' } },
];

function planeById(id) {
  return PLANES.find(p => p.id === id) || PLANES[0];
}

let planeUid = 0;
function planeSVG(id, standalone) {
  const p = planeById(id);
  const u = 'pl' + (++planeUid) + '-';
  const F = k => `url(#${u}${k})`;
  const ns = standalone ? ' xmlns="http://www.w3.org/2000/svg" width="240" height="120"' : '';
  return `<svg class="plane-svg"${ns} viewBox="0 0 120 60" aria-label="${p.name}" role="img">` + planeDefs(u, p.c) +
    `<g stroke="${INK}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">${SHAPES[p.shape](F)}</g></svg>`;
}

// Картинка самолёта для мини-игр (рисуется на canvas)
const planeImages = {};
function planeImage(id) {
  if (!planeImages[id]) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(planeSVG(id, true));
    planeImages[id] = img;
  }
  return planeImages[id];
}
