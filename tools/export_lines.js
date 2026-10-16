'use strict';
/* Выгружает все фразы «Ямщика», которые произносятся вслух, в JSON:
   [{ role, text }]. Текст — как на экране (мат со звёздочкой).
   Запуск: node tools/export_lines.js > /tmp/lines.json */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'valera', 'data.js'), 'utf8')
  + '\n;({ ROLES, PHRASES, ZONE_LINES, BOSS_CALLS, VERDICTS, SHOUTERS });';
const D = vm.runInNewContext(src, {});

// Кто произносит фразы каждой группы PHRASES
const CATEGORY_ROLE = {
  granny: 'granny', passer: 'passer', camera: 'accountant', support: 'friend', supportHit: 'friend',
  motyaThrow: 'motya', motyaBike: 'motya', motyaKick: 'motya', motyaLying: 'motya', motyaRun: 'motya', motyaHit: 'motya',
};

const out = [];
const add = (role, pair) => pair.forEach(text => out.push({ role, text }));

for (const [cat, list] of Object.entries(D.PHRASES)) list.forEach(p => add(CATEGORY_ROLE[cat] || 'valera', p));
for (const list of Object.values(D.ZONE_LINES)) list.forEach(p => add('valera', p));
D.BOSS_CALLS.forEach(([role, p]) => add('phone:' + role, p));
D.VERDICTS.forEach(([, p]) => add('chief', p));
D.SHOUTERS.forEach(s => s.lines.forEach(p => add(s.role, p)));
// служебные фразы из меню (game.js)
add('valera', ['Голоса включены!', 'Голоса включены, бл*!']);
add('prorab', ['Режим прораба, бл*! Ну всё, п*здец, понеслась!', 'Режим прораба, бл*! Ну всё, п*здец, понеслась!']);

const seen = new Set();
const uniq = out.filter(l => { const k = l.role + '|' + l.text; if (seen.has(k)) return false; seen.add(k); return true; });
process.stdout.write(JSON.stringify(uniq, null, 1));
