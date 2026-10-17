#!/usr/bin/env python3
"""Озвучка «Ямщика» нейросетевыми голосами Piper (бесплатно, работает без интернета).

Голоса: Дмитрий, Денис, Руслан (мужские), Ирина (женский) — модели vits-piper-ru_RU-*-medium;
станичные деды и бабки говорят «балачкой» — украинская модель vits-piper-uk_UA-ukrainian_tts-medium
(Лада, Микита, Тетяна); формальные персонажи — vits-mms-rus. Всё из релизов k2-fsa/sherpa-onnx на GitHub.
Произношение — espeak-ng со своим словарём ударений.

Что нужно:
    sudo apt install espeak-ng sox lame
    pip install onnxruntime numpy
    модели: https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
            (vits-piper-ru_RU-dmitri-medium, -denis-, -ruslan-, -irina-), распаковать в MODELS_DIR
Запуск из корня репозитория:
    node tools/export_lines.js > /tmp/lines.json
    python3 tools/build_voices_neural.py /tmp/lines.json /путь/к/моделям
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
import wave

import numpy as np
import onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', 'valera')
OUT_DIR = os.path.join(ROOT, 'voice')
ESPEAK_DIR = os.path.join(tempfile.gettempdir(), 'yamshchik-espeak')
ESPEAK_SRC = 'https://raw.githubusercontent.com/espeak-ng/espeak-ng/1.51/dictsource/'

# Голос персонажа: (модель, скорость речи (>1 медленнее), выразительность, сдвиг высоты в центах, эффекты sox)
VOICES = {
    'valera':     ('dmitri', 0.95, 0.70,    0, []),
    'motya':      ('ruslan', 0.90, 0.80, -100, ['overdrive', '2']),
    'chief':      ('denis',  0.85, 0.80, -200, ['overdrive', '6', 'gain', '-3']),
    'accountant': ('irina',  1.10, 0.60,  -50, []),
    'granny':     ('uk:2',   1.15, 0.70,  150, ['tremolo', '6', '30']),
    'babka':      ('uk:0',   0.90, 0.85,  100, ['overdrive', '3', 'gain', '-2']),
    'passer':     ('denis',  0.95, 0.70,    0, []),
    'inspector':  ('denis',  1.10, 0.60, -150, []),
    'brother':    ('dmitri', 1.00, 0.75,  150, []),
    'master':     ('denis',  0.90, 0.75, -100, ['overdrive', '3']),
    'prorab':     ('ruslan', 0.85, 0.85, -250, ['overdrive', '6', 'gain', '-3']),
    'driver':     ('ruslan', 1.05, 0.70, -300, []),
    'engineer':   ('dmitri', 1.00, 0.65,   60, []),
    'director':   ('denis',  1.15, 0.60, -200, ['reverb', '25']),
    'deputy':     ('dmitri', 1.15, 0.60, -250, ['reverb', '50', 'echo', '0.8', '0.7', '60', '0.2']),
    'tax':        ('irina',  1.20, 0.55,    0, ['echo', '0.8', '0.7', '40', '0.25']),
    'drunk':      ('uk:1',   1.30, 0.90, -250, ['tremolo', '3', '20']),
    'ded':        ('uk:1',   1.15, 0.80, -150, ['tremolo', '5', '12']),
    'taxi':       ('ruslan', 0.80, 0.75,   80, []),
    'friend':     ('ruslan', 0.85, 0.90,  180, ['sinc', '350-3400', 'overdrive', '3', 'gain', '-2']),
    # роботы — нарочно «компьютерные» голоса RHVoice
    'navigator':  ('rh:elena',    1.0, 0, 0, ['highpass', '200']),
    'camerabot':  ('rh:aleksandr', 0.95, 0, -100, ['sinc', '400-4000', 'echo', '0.8', '0.6', '30', '0.3']),
    'autoresp':   ('rh:victoria', 1.0, 0, 0, ['sinc', '300-3400']),
    'rabochiy':   ('ruslan', 1.00, 0.70,    0, []),
    'traktorist': ('uk:1',   1.00, 0.75,  -50, []),
    'katok':      ('dmitri', 1.05, 0.70, -200, []),
    'ukladchik':  ('ruslan', 1.00, 0.70,   50, []),
    'greyder':    ('denis',  1.05, 0.70, -100, []),
    'ekskavator': ('dmitri', 1.00, 0.75, -150, ['overdrive', '2']),
    'geodezist':  ('denis',  1.00, 0.65,  100, []),
    'laborant':   ('irina',  1.00, 0.65,   50, []),
    'signal':     ('uk:0',   0.90, 0.85,  100, ['overdrive', '3', 'gain', '-2']),
    'nachuch':    ('ruslan', 0.90, 0.80, -150, ['overdrive', '5', 'gain', '-3']),
    'tehnadzor':  ('ruslan', 1.15, 0.55, -120, ['reverb', '20']),
    'snab':       ('denis',  0.80, 0.75,  100, []),
    'kladovshik': ('uk:2',   0.95, 0.70,   50, []),
    'mehanik':    ('ruslan', 1.05, 0.70, -200, []),
}
PHONE_FX = ['sinc', '300-3400', 'overdrive', '3', 'gain', '-2']

UNCENSOR = {
    'бл*': 'блядь', 'е*ать': 'ебать', 'нах*й': 'нахуй', 'отъе*ись': 'отъебись', 'ох*енно': 'охуенно',
    'е*анулся': 'ебанулся', 'е*учая': 'ебучая', 'е*учий': 'ебучий', 'е*ёт': 'ебёт', 'е*ёшь': 'ебёшь',
    'м*дак': 'мудак', 'м*дила': 'мудила', 'ох*ел': 'охуел', 'п*здец': 'пиздец', 'п*зду': 'пизду',
    'су*а': 'сука', 'су*ин': 'сукин', 'х*ярил': 'хуярил', 'съе*ись': 'съебись', 'х*йня': 'хуйня', 'е*учих': 'ебучих',
}

# Свой словарь ударений: слово → номер ударного слога (проверено по выводу espeak-ng)
STRESS = {
    'брежневе': 1, 'битум': 2, 'беларусе': 3, 'верну': 2, 'катка': 2, 'крыса': 1, 'машу': 2,
    'нахуй': 2, 'нивелира': 3, 'отбойник': 2, 'петрович': 2, 'проверка': 2, 'прораба': 2,
    'проспись': 2, 'прошлого': 1, 'прошлую': 1, 'разогнаться': 3, 'раньше': 1, 'распишитесь': 3,
    'родная': 2, 'роспись': 1, 'сраные': 1, 'съебись': 2, 'трасса': 1, 'трассы': 1, 'трогай': 1,
    'управление': 3, 'чмошник': 1, 'шаурма': 3, 'толкача': 3, 'мотя': 1, 'валера': 2,
    'красноармейка': 4, 'красноармейки': 4, 'тебе': 2,
    'ведра': 2, 'глаза': 2, 'душа': 2, 'стеклотара': 3, 'таурин': 3, 'технадзор': 3, 'ходу': 2, 'цвета': 2,
    'шаурмой': 3, 'шаурму': 3, 'шаурмы': 3, 'шумахером': 2, 'ебучих': 2,
    'охуенно': 3, 'гора': 2, 'мою': 2, 'тормоза': 3, 'колеса': 3, 'доски': 2, 'соплях': 2,
    'заделыванием': 2, 'кладовщица': 3,
}


def prepare_espeak():
    """Собирает словарь espeak-ng с нашими ударениями в отдельную папку."""
    data = os.path.join(ESPEAK_DIR, 'data')
    stamp = json.dumps(STRESS, ensure_ascii=False, sort_keys=True)
    ok = os.path.join(data, 'ru_dict.ok')
    if os.path.exists(ok) and open(ok, encoding='utf-8').read() == stamp:
        return data
    src = os.path.join(ESPEAK_DIR, 'src')
    os.makedirs(src, exist_ok=True)
    for name, path in [('ru_list', 'ru_list'), ('ru_rules', 'ru_rules'), ('ru_emoji', 'ru_emoji'), ('ru_listx', 'extra/ru_listx')]:
        dst = os.path.join(src, name)
        if not os.path.exists(dst):
            urllib.request.urlretrieve(ESPEAK_SRC + path, dst)
    with open(os.path.join(src, 'ru_extra'), 'w', encoding='utf-8') as f:
        for w, n in STRESS.items():
            f.write(f'{w} ${n}\n')
    sys_data = subprocess.run(['espeak-ng', '--version'], capture_output=True, text=True).stdout.split('Data at:')[-1].strip()
    if os.path.exists(data):
        shutil.rmtree(data)
    shutil.copytree(sys_data, data)
    subprocess.run(['espeak-ng', '--compile=ru'], cwd=src, env={**os.environ, 'ESPEAK_DATA_PATH': data}, check=True, capture_output=True)
    open(ok, 'w', encoding='utf-8').write(stamp)
    return data


def clean_text(text):
    t = re.sub(r'[А-Яа-яЁё]*\*[А-Яа-яЁё]*', lambda m: UNCENSOR.get(m.group(0).lower(), m.group(0).replace('*', '')), text)
    t = re.sub(r'[«»"„“]', '', t)
    t = re.sub(r'[\U0001F300-\U0001FAFF☀-➿]', '', t)
    t = t.replace('…', '...').replace('—', ',').replace('–', ',')
    return re.sub(r'\s+', ' ', t).strip()


def phonemize(text, data):
    """Текст → фонемы IPA (как в Piper): по фразам, с пунктуацией."""
    parts = re.findall(r'[^,.!?;:]+|[,.!?;:]+', text)
    out = []
    for p in parts:
        if re.fullmatch(r'[,.!?;:]+', p):
            if out:
                out[-1] = out[-1].rstrip() + p[-1] + ' '
            continue
        p = p.strip()
        if not p:
            continue
        ipa = subprocess.run(['espeak-ng', '-v', 'ru', '-q', '--ipa'], input=p.encode('utf-8'),
                             env={**os.environ, 'ESPEAK_DATA_PATH': data}, capture_output=True).stdout.decode('utf-8')
        out.append(' '.join(ipa.split()) + ' ')
    return unicodedata.normalize('NFD', ''.join(out).strip())


VOWELS = 'аеёиоуыэюя'
ESPEAK_VOWELS = set('aAVe@EiIoOuUy')


def stressed_index(words, data):
    """Номер ударной гласной (с нуля) в каждом слове — по словарю espeak-ng с нашими ударениями."""
    out = subprocess.run(['espeak-ng', '-v', 'ru', '-q', '-x'], input='\n'.join(words).encode('utf-8'),
                         env={**os.environ, 'ESPEAK_DATA_PATH': data}, capture_output=True).stdout.decode('utf-8').split()
    res = []
    for w, p in zip(words, out):
        if 'ё' in w:
            res.append(sum(1 for c in w[:w.index('ё')] if c in VOWELS))
        elif "'" in p:
            q = p.replace('@-', '')  # «@-» — связка согласных у espeak, это не гласная
            res.append(sum(1 for c in q[:q.index("'")] if c in ESPEAK_VOWELS))
        else:
            res.append(-1)
    return res


def to_balachka(text, data):
    """Русский текст → украинскими буквами со знаками ударения (кубанский выговор)."""
    t = text.lower()
    words = re.findall(r'[а-яё]+', t)
    stress = dict(zip(words, stressed_index(words, data))) if words else {}

    def conv(m):
        w = m.group(0)
        si, vi, out = stress.get(w, -1), 0, ''
        for i, ch in enumerate(w):
            prev = w[i - 1] if i else ''
            soft_start = not prev or prev in VOWELS or prev in 'ъь'
            if ch == 'и': rep = 'і'
            elif ch == 'ы': rep = 'и'
            elif ch == 'э': rep = 'е'
            elif ch == 'е': rep = 'є' if soft_start else 'е'
            elif ch == 'ё': rep = 'йо' if soft_start else 'ьо'
            elif ch == 'ъ': rep = "'"
            else: rep = ch
            out += rep
            if ch in VOWELS:
                if vi == si and sum(1 for c in w if c in VOWELS) > 1:
                    out += '\u0301'
                vi += 1
        return out
    return re.sub(r'[а-яё]+', conv, t)


def rh_text(text):
    """Текст для RHVoice: ударения из нашего словаря ставятся знаком «+» перед ударной гласной."""
    def fix(m):
        w = m.group(0)
        n = STRESS.get(w.lower())
        if not n:
            return w
        k = 0
        for i, ch in enumerate(w):
            if ch.lower() in VOWELS:
                k += 1
                if k == n:
                    return w[:i] + '+' + w[i:]
        return w
    return re.sub(r'[А-Яа-яЁё]+', fix, text)


class UkrVoice:
    """Украинская многоголосая модель Piper (читает буквы, понимает знак ударения)."""
    def __init__(self, models_dir):
        base = os.path.join(models_dir, 'vits-piper-uk_UA-ukrainian_tts-medium', 'uk_UA-ukrainian_tts-medium.onnx')
        self.sess = ort.InferenceSession(base, providers=['CPUExecutionProvider'])
        cfg = json.load(open(base + '.json', encoding='utf-8'))
        self.ids = cfg['phoneme_id_map']
        self.rate = cfg['audio']['sample_rate']

    def synth(self, text, sid, length_scale, noise_scale):
        ids = list(self.ids['^'])
        for ch in unicodedata.normalize('NFC', text).replace('і\u0301', 'і\u0301'):
            for c in unicodedata.normalize('NFD', ch) if ch not in self.ids else [ch]:
                if c in self.ids and c not in ('^', '$', '_'):
                    ids += self.ids[c] + self.ids['_']
        ids += self.ids['$']
        audio = self.sess.run(None, {
            'input': np.array([ids], dtype=np.int64),
            'input_lengths': np.array([len(ids)], dtype=np.int64),
            'scales': np.array([noise_scale, length_scale, 0.8], dtype=np.float32),
            'sid': np.array([sid], dtype=np.int64),
        })[0].squeeze()
        audio = audio / max(0.01, np.abs(audio).max()) * 0.95
        return (audio * 32767).astype(np.int16)


class MmsVoice:
    """Русская модель MMS (Meta): ещё один мужской голос, читает буквы."""
    def __init__(self, models_dir):
        import sherpa_onnx
        d = os.path.join(models_dir, 'vits-mms-rus')
        cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=os.path.join(d, 'model.onnx'), tokens=os.path.join(d, 'tokens.txt')),
            num_threads=2))
        self.tts = sherpa_onnx.OfflineTts(cfg)
        self.rate = 16000

    def synth(self, text, length_scale):
        chunks = [c.strip() for c in re.split(r'[,.!?;:]+', text.lower()) if c.strip()]
        pause = np.zeros(int(self.rate * 0.18), dtype=np.float32)
        parts = []
        for c in chunks:
            a = self.tts.generate(c, sid=0, speed=1.0 / length_scale)
            self.rate = a.sample_rate
            parts += [np.array(a.samples, dtype=np.float32), pause]
        audio = np.concatenate(parts) if parts else np.zeros(1600, dtype=np.float32)
        audio = audio / max(0.01, np.abs(audio).max()) * 0.95
        return (audio * 32767).astype(np.int16)


class Piper:
    def __init__(self, models_dir, name):
        base = os.path.join(models_dir, f'vits-piper-ru_RU-{name}-medium', f'ru_RU-{name}-medium.onnx')
        self.sess = ort.InferenceSession(base, providers=['CPUExecutionProvider'])
        cfg = json.load(open(base + '.json', encoding='utf-8'))
        self.ids = cfg['phoneme_id_map']
        self.rate = cfg['audio']['sample_rate']
        inf = cfg.get('inference', {})
        self.noise_w = inf.get('noise_w', 0.8)

    def synth(self, phonemes, length_scale, noise_scale):
        ids = list(self.ids['^'])
        for ph in phonemes:
            if ph in self.ids and ph not in ('^', '$', '_'):
                ids += self.ids[ph] + self.ids['_']
        ids += self.ids['$']
        audio = self.sess.run(None, {
            'input': np.array([ids], dtype=np.int64),
            'input_lengths': np.array([len(ids)], dtype=np.int64),
            'scales': np.array([noise_scale, length_scale, self.noise_w], dtype=np.float32),
        })[0].squeeze()
        audio = audio / max(0.01, np.abs(audio).max()) * 0.95
        return (audio * 32767).astype(np.int16)


def main():
    lines = json.load(open(sys.argv[1], encoding='utf-8'))
    models_dir = sys.argv[2]
    data = prepare_espeak()
    os.makedirs(OUT_DIR, exist_ok=True)
    engines = {}
    mapping, used = {}, set()
    for i, ln in enumerate(lines):
        role = ln['role']
        phone = role.startswith('phone:')
        base = role.split(':', 1)[1] if phone else role
        model, length, noise, pitch, fx = VOICES.get(base, VOICES['valera'])
        key = role + '|' + ln['text']
        words = re.findall(r'[а-яё]+', clean_text(ln['text']).lower())
        sig = repr((VOICES.get(base), phone, 3, sorted((w, STRESS[w]) for w in set(words) if w in STRESS)))
        name = hashlib.md5(('neural|' + key + sig).encode('utf-8')).hexdigest()[:10] + '.mp3'
        path = os.path.join(OUT_DIR, name)
        if not os.path.exists(path):
            text = clean_text(ln['text'])
            if model.startswith('uk:'):
                eng = engines.get('uk') or engines.setdefault('uk', UkrVoice(models_dir))
                pcm = eng.synth(to_balachka(text, data), int(model[3:]), length, noise)
            elif model.startswith('rh:'):
                pcm = None
            elif model == 'mms':
                eng = engines.get('mms') or engines.setdefault('mms', MmsVoice(models_dir))
                pcm = eng.synth(text, length)
            else:
                eng = engines.get(model) or engines.setdefault(model, Piper(models_dir, model))
                pcm = eng.synth(phonemize(text, data), length, noise)
            with tempfile.TemporaryDirectory() as tmp:
                raw, fin = os.path.join(tmp, 'raw.wav'), os.path.join(tmp, 'fin.wav')
                if pcm is None:
                    subprocess.run(['RHVoice-test', '-p', model[3:], '-r', str(int(100 / length)), '-o', raw],
                                   input=rh_text(text).encode('utf-8'), check=True, capture_output=True)
                else:
                    with wave.open(raw, 'wb') as w:
                        w.setnchannels(1); w.setsampwidth(2); w.setframerate(eng.rate); w.writeframes(pcm.tobytes())
                eff = (['pitch', str(pitch)] if pitch else []) + fx + (PHONE_FX if phone else []) + ['norm', '-1', 'rate', '22050']
                subprocess.run(['sox', raw, fin] + eff, check=True, capture_output=True)
                subprocess.run(['lame', '--quiet', '-b', '48', '-m', 'm', fin, path], check=True)
        mapping[key] = 'voice/' + name
        used.add(name)
        if i % 25 == 0:
            print(f'{i}/{len(lines)}', file=sys.stderr)
    for f in os.listdir(OUT_DIR):
        if f.endswith('.mp3') and f not in used:
            os.remove(os.path.join(OUT_DIR, f))
    js = ('// Создано tools/build_voices_neural.py — не править вручную.\n'
          '// «роль|фраза» → готовый аудиофайл с голосом персонажа.\n'
          'const VOICE_FILES = ' + json.dumps(mapping, ensure_ascii=False, indent=0) + ';\n')
    open(os.path.join(ROOT, 'voices.js'), 'w', encoding='utf-8').write(js)
    print(f'Готово: {len(mapping)} фраз', file=sys.stderr)


if __name__ == '__main__':
    main()
