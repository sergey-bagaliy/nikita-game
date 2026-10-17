#!/usr/bin/env python3
"""Озвучка всех фраз «Ямщика» бесплатным синтезатором RHVoice.

Что нужно (Ubuntu/Debian):  sudo apt install rhvoice rhvoice-russian sox lame
Запуск из корня репозитория:
    node tools/export_lines.js > /tmp/lines.json
    python3 tools/build_voices.py /tmp/lines.json

Результат: valera/voice/*.mp3 и valera/voices.js (словарь «роль|фраза» → файл).
Ударения: словарь STRESS ниже, «+» ставится перед ударной гласной.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'valera')
OUT_DIR = os.path.join(ROOT, 'voice')

# Голос RHVoice и обработка sox для каждого персонажа.
# pitch — в центах (100 = полтона), tempo — скорость, fx — дополнительные эффекты sox.
VOICES = {
    'valera':     ('aleksandr-hq', 0,    1.05, []),
    'motya':      ('artemiy',     -150,  1.12, ['overdrive', '4']),
    'chief':      ('yuriy',       -250,  1.12, ['overdrive', '8', 'gain', '-3']),
    'accountant': ('tatiana',      0,    0.88, []),
    'granny':     ('anna',         350,  0.88, ['tremolo', '6', '35']),
    'babka':      ('arina',        300,  1.12, ['overdrive', '6', 'gain', '-3']),
    'passer':     ('mikhail',      0,    1.1,  []),
    'inspector':  ('pavel',       -100,  0.9,  []),
    'brother':    ('vitaliy',      100,  1.0,  []),
    'master':     ('evgeniy-rus', -100,  1.1,  ['overdrive', '5']),
    'prorab':     ('pavel',       -250,  1.15, ['overdrive', '9', 'gain', '-4']),
    'driver':     ('yuriy',       -400,  0.95, []),
    'engineer':   ('mikhail',      80,   1.0,  []),
    'director':   ('aleksandr',   -200,  0.88, ['reverb', '25']),
    'deputy':     ('aleksandr',   -80,   0.85, ['reverb', '55', 'echo', '0.8', '0.7', '60', '0.25']),
    'tax':        ('victoria',     0,    0.85, ['echo', '0.8', '0.7', '40', '0.3']),
    'drunk':      ('vitaliy',     -300,  0.78, ['tremolo', '3', '20']),
    'ded':        ('yuriy',       -150,  0.82, ['tremolo', '5', '15']),
    'taxi':       ('evgeniy-rus',  50,   1.3,  []),
    'friend':     ('evgeniy-rus',  60,   1.12, ['sinc', '350-3200', 'overdrive', '4', 'gain', '-2']),
    'rabochiy':   ('vitaliy',     -50,   1.0,  []),
    'traktorist': ('yuriy',       -200,  0.9,  ['tremolo', '9', '12']),
    'katok':      ('mikhail',     -200,  0.95, []),
    'ukladchik':  ('artemiy',      0,    1.05, []),
    'greyder':    ('evgeniy-rus', -150,  0.95, []),
    'ekskavator': ('pavel',       -150,  1.0,  ['overdrive', '3']),
    'geodezist':  ('aleksandr',    100,  1.05, []),
    'laborant':   ('elena',        0,    1.0,  []),
    'signal':     ('irina',        150,  1.15, ['overdrive', '4', 'gain', '-2']),
    'nachuch':    ('aleksandr',   -200,  1.1,  ['overdrive', '6', 'gain', '-3']),
    'tehnadzor':  ('mikhail',      0,    0.85, ['reverb', '20']),
    'snab':       ('artemiy',      100,  1.25, []),
    'kladovshik': ('victoria',     100,  1.1,  []),
    'mehanik':    ('vitaliy',     -150,  0.95, []),
}
PHONE_FX = ['sinc', '300-3400', 'overdrive', '3', 'gain', '-2']

# Мат для озвучки: на экране со звёздочкой, вслух — полностью
UNCENSOR = {
    'бл*': 'блядь', 'е*ать': 'ебать', 'нах*й': 'нахуй', 'отъе*ись': 'отъебись', 'ох*енно': 'охуенно',
    'е*анулся': 'ебанулся', 'е*учая': 'ебучая', 'е*учий': 'ебучий', 'е*ёт': 'ебёт', 'е*ёшь': 'ебёшь',
    'м*дак': 'мудак', 'м*дила': 'мудила', 'ох*ел': 'охуел', 'п*здец': 'пиздец', 'п*зду': 'пизду',
    'су*а': 'сука', 'су*ин': 'сукин', 'х*ярил': 'хуярил', 'съе*ись': 'съебись', 'х*йня': 'хуйня', 'е*учих': 'ебучих',
}

# Ударения: «+» перед ударной гласной
STRESS = {
    'валера': 'вал+ера', 'валеры': 'вал+еры', 'валерий': 'вал+ерий',
    'мотя': 'м+отя', 'моти': 'м+оти', 'мотю': 'м+отю',
    'петрович': 'петр+ович', 'петровна': 'петр+овна', 'людмила': 'людм+ила',
    'красноармейка': 'красноарм+ейка', 'красноармейки': 'красноарм+ейки', 'красноармейке': 'красноарм+ейке',
    'камаза': 'кам+аза', 'жэк': 'ж+эк', 'гост': 'г+ост', 'госту': 'г+осту', 'брежневе': 'бр+ежневе',
    'нива': 'н+ива', 'ниве': 'н+иве',
    'блядь': 'бл+ядь', 'пиздец': 'пизд+ец', 'пизду': 'пизд+у', 'нахуй': 'н+ахуй',
    'ебучий': 'еб+учий', 'ебучая': 'еб+учая', 'ебать': 'еб+ать', 'отъебись': 'отъеб+ись',
    'охуенно': 'оху+енно', 'охуел': 'оху+ел', 'ебанулся': 'ебан+улся', 'мудак': 'муд+ак', 'мудила': 'муд+ила',
    'сука': 'с+ука', 'ебучих': 'еб+учих', 'сукин': 'с+укин', 'хуярил': 'ху+ярил', 'сраные': 'ср+аные', 'жопа': 'ж+опа',
    'конченый': 'к+онченый', 'ёпта': 'ёпт+а',
    'асфальт': 'асф+альт', 'асфальта': 'асф+альта', 'конус': 'к+онус', 'конусы': 'к+онусы', 'конусами': 'к+онусами',
    'шаурма': 'шаурм+а', 'плов': 'пл+ов', 'смета': 'см+ета', 'подвеска': 'подв+еска', 'подвеске': 'подв+еске',
    'объяснительную': 'объясн+ительную', 'наряд-допуск': 'нар+яд-д+опуск', 'каток': 'кат+ок',
    'зараза': 'зар+аза', 'ирод': '+ирод', 'окаянный': 'ока+янный', 'менингит': 'менинг+ит',
    'декларацию': 'деклар+ацию', 'тарахтелках': 'тарахт+елках', 'понаехали': 'пона+ехали',
    'говядина': 'говяд+ина', 'уклон': 'укл+он', 'губернатор': 'губерн+атор', 'комиссия': 'ком+иссия',
    'бухгалтерия': 'бухгалт+ерия', 'бухгалтерию': 'бухгалт+ерию', 'премию': 'пр+емию', 'премии': 'пр+емии',
    'вокзала': 'вокз+ала', 'вокзальная': 'вокз+альная', 'энергетик': 'энерг+етик', 'навигатор': 'навиг+атор',
    'документики': 'докум+ентики', 'пенальти': 'пен+альти', 'лежачий': 'леж+ачий', 'полицейский': 'полиц+ейский',
    'съебись': 'съеб+ись', 'хуйня': 'х+уйня', 'чмошник': 'чм+ошник', 'красава': 'крас+ава', 'ссут': 'сс+ут',
    'беларусе': 'белар+усе', 'профилировал': 'профил+ировал', 'нивелира': 'нивел+ира', 'пикете': 'пик+ете',
    'керны': 'к+ерны', 'щебень': 'щ+ебень', 'битум': 'бит+ум', 'солярку': 'сол+ярку', 'накладные': 'накладн+ые',
    'гидравлику': 'гидр+авлику', 'толкача': 'толкач+а', 'нормативу': 'нормат+иву',
    'дрейфь': 'др+ейфь', 'исполнительная': 'исполн+ительная', 'кабель': 'к+абель',
    'гора': 'гор+а', 'мою': 'мо+ю', 'тормоза': 'тормоз+а', 'колеса': 'колес+а', 'доски': 'доск+и', 'соплях': 'сопл+ях',
    'заделыванием': 'зад+елыванием', 'кладовщица': 'кладовщ+ица',
    'трёхсотом': 'трёхс+отом', 'отбойник': 'отб+ойник', 'газон': 'газ+он', 'депутат': 'депут+ат',
}

WORD = re.compile(r'[А-Яа-яЁё*-]+')


def keep_case(src, dst):
    return dst[0].upper() + dst[1:] if src[:1].isupper() else dst


def prepare(text):
    t = re.sub(r'[«»"„“]', '', text)
    t = re.sub(r'[\U0001F300-\U0001FAFF☀-➿]', '', t)

    def fix(m):
        w = m.group(0)
        low = w.lower()
        if low in UNCENSOR:
            w = keep_case(w, UNCENSOR[low]); low = w.lower()
        if low in STRESS:
            w = keep_case(w, STRESS[low])
        return w
    return WORD.sub(fix, t).replace('*', '').strip()


def synth(role, text, path):
    phone = role.startswith('phone:')
    base = role.split(':', 1)[1] if phone else role
    voice, pitch, tempo, fx = VOICES.get(base, VOICES['valera'])
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, 'raw.wav')
        fin = os.path.join(tmp, 'fin.wav')
        subprocess.run(['RHVoice-test', '-p', voice, '-o', raw], input=prepare(text).encode('utf-8'),
                       check=True, capture_output=True)
        eff = []
        if pitch:
            eff += ['pitch', str(pitch)]
        if tempo != 1:
            eff += ['tempo', '-s', str(tempo)]
        eff += fx + (PHONE_FX if phone else [])
        eff += ['norm', '-1', 'rate', '22050']
        subprocess.run(['sox', raw, '-c', '1', fin] + eff, check=True, capture_output=True)
        subprocess.run(['lame', '--quiet', '-b', '40', '-m', 'm', fin, path], check=True)


def main():
    lines = json.load(open(sys.argv[1], encoding='utf-8'))
    os.makedirs(OUT_DIR, exist_ok=True)
    mapping, used = {}, set()
    for i, ln in enumerate(lines):
        key = ln['role'] + '|' + ln['text']
        name = hashlib.md5(key.encode('utf-8')).hexdigest()[:10] + '.mp3'
        path = os.path.join(OUT_DIR, name)
        if not os.path.exists(path):
            synth(ln['role'], ln['text'], path)
        mapping[key] = 'voice/' + name
        used.add(name)
        if i % 25 == 0:
            print(f'{i}/{len(lines)}', file=sys.stderr)
    for f in os.listdir(OUT_DIR):
        if f.endswith('.mp3') and f not in used:
            os.remove(os.path.join(OUT_DIR, f))
    js = ('// Создано tools/build_voices.py — не править вручную.\n'
          '// «роль|фраза» → готовый аудиофайл с голосом персонажа.\n'
          'const VOICE_FILES = ' + json.dumps(mapping, ensure_ascii=False, indent=0) + ';\n')
    open(os.path.join(ROOT, 'voices.js'), 'w', encoding='utf-8').write(js)
    print(f'Готово: {len(mapping)} фраз', file=sys.stderr)


if __name__ == '__main__':
    main()
