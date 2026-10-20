"""
DEV PATH V5 — compõe e renderiza as trilhas de fundo (public/audio/music/).

Músicas originais, feitas por código (sem samples, sem licença de terceiros), três estilos animados:
  opcao-1-synthwave.mp3     118 BPM, Dó maior   — anos 80 moderno: baixo pulsante, caixa com eco, lead com vibrato
  opcao-2-future-house.mp3  124 BPM, Sol maior  — balanço de festa: baixo no contratempo, acordes "stab", palmas
  opcao-3-electro-pop.mp3   128 BPM, Ré maior   — pop eletrônico: acordes sincopados, sinos, energia de abertura
Cada uma tem 32 compassos e fecha em loop perfeito (o final emenda no começo).
A TV toca a que estiver em public/js/narration.js → config.music.

Uso:  python ferramentas/gerar_musica.py            (as três)
      python ferramentas/gerar_musica.py 2          (só a opção 2)
Precisa de numpy e do ffmpeg no PATH. Mude BPM, acordes ou melodia em ESTILOS e rode de novo.
"""
import pathlib
import subprocess
import sys
import wave

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
PASTA = ROOT / 'public' / 'audio' / 'music'
SR = 44100
BARS = 32


def nota(nome):
    """'A4' → 440 Hz, 'F#3' → 185 Hz"""
    nomes = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = nome[:-1], int(nome[-1])
    return 440 * 2 ** ((nomes[n] + 12 * (o + 1) - 69) / 12)


def acorde(baixo, vozes):
    return nota(baixo), [nota(v) for v in vozes.split()]


# Um acorde por compasso (4 compassos se repetem). Melodia: (passo de 1/16, nota, duração em 1/16)
# em 2 compassos; ela usa a escala pentatônica do tom, que soa bem sobre todos os acordes.
ESTILOS = {
    1: dict(
        arquivo='opcao-1-synthwave.mp3', bpm=118, semente=11,
        acordes=[acorde('C2', 'C4 E4 G4 B4'), acorde('G1', 'B3 D4 G4 A4'), acorde('A1', 'A3 C4 E4 G4'), acorde('F1', 'A3 C4 F4 G4')],
        baixo='oitavas16', caixa='eco', acordes_estilo='pad', arpejo='serra', lead='serra',
        melodia=[(0, 'E5', 2), (2, 'G5', 2), (4, 'A5', 4), (8, 'G5', 2), (10, 'E5', 2), (12, 'D5', 4),
                 (16, 'C5', 2), (18, 'D5', 2), (20, 'E5', 4), (24, 'G5', 4), (28, 'E5', 3)],
    ),
    2: dict(
        arquivo='opcao-2-future-house.mp3', bpm=124, semente=23,
        acordes=[acorde('G1', 'B3 D4 G4 A4'), acorde('D2', 'A3 D4 F#4 A4'), acorde('E2', 'G3 B3 E4 F#4'), acorde('C2', 'G3 C4 E4 G4')],
        baixo='contratempo', caixa='palma', acordes_estilo='stab', arpejo='pluck', lead='chop',
        melodia=[(0, 'B5', 1), (3, 'D6', 1), (6, 'E6', 2), (8, 'D6', 1), (10, 'B5', 2), (14, 'A5', 1),
                 (16, 'G5', 1), (19, 'A5', 1), (22, 'B5', 2), (24, 'D6', 1), (26, 'B5', 1), (28, 'A5', 2)],
    ),
    3: dict(
        arquivo='opcao-3-electro-pop.mp3', bpm=128, semente=37,
        acordes=[acorde('D2', 'A3 D4 F#4 A4'), acorde('A1', 'A3 C#4 E4 A4'), acorde('B1', 'B3 D4 F#4 B4'), acorde('G1', 'B3 D4 G4 B4')],
        baixo='rolante8', caixa='caixa_palma', acordes_estilo='sincopado', arpejo='sino', lead='sino',
        melodia=[(0, 'F#5', 2), (2, 'A5', 2), (4, 'B5', 2), (6, 'A5', 2), (8, 'F#5', 4), (12, 'E5', 4),
                 (16, 'D5', 2), (18, 'E5', 2), (20, 'F#5', 2), (22, 'A5', 2), (24, 'B5', 4), (28, 'A5', 3)],
    ),
}


# ---------------- utilidades de sinal ----------------
def t_(n):
    return np.arange(n) / SR


def filtro(x, fc, tipo='lp', ordem=2):
    """Filtro Butterworth (só magnitude, fase zero) no domínio da frequência."""
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    with np.errstate(divide='ignore'):
        r = (f / fc) if tipo == 'lp' else (fc / np.maximum(f, 1e-9))
    H = 1 / np.sqrt(1 + r ** (2 * ordem))
    return np.fft.irfft(X * (H[:, None] if x.ndim == 2 else H), n=x.shape[0], axis=0)


class Faixa:
    def __init__(self, est):
        self.e = est
        self.rng = np.random.default_rng(est['semente'])
        self.beat = 60 / est['bpm']
        self.bar = 4 * self.beat
        self.passo = self.beat / 4
        self.L = int(round(BARS * self.bar * SR))
        self.N = self.L + 5 * SR

    # -------- instrumentos --------
    def saw(self, f, n, fase=None):
        ph = ((self.rng.random() if fase is None else fase) + f * t_(n)) % 1.0
        return 2 * ph - 1

    def bumbo(self):
        n = int(0.42 * SR)
        tt = t_(n)
        f = 50 + 110 * np.exp(-tt * 35)
        corpo = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)
        return np.tanh((corpo + self.rng.standard_normal(n) * np.exp(-tt * 450) * 0.3) * 1.6)

    def palma(self):
        n = int(0.3 * SR)
        tt = t_(n)
        s = np.zeros(n)
        for k, off in enumerate((0.0, 0.01, 0.02)):
            i = int(off * SR)
            s[i:] += self.rng.standard_normal(n - i) * np.exp(-tt[: n - i] * (70 if k < 2 else 16))
        return filtro(filtro(s, 1000, 'hp'), 7000)

    def caixa(self):
        n = int(0.3 * SR)
        tt = t_(n)
        tom = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 25)
        ruido = filtro(self.rng.standard_normal(n), 1500, 'hp') * np.exp(-tt * 14)
        return tom * 0.6 + ruido * 0.8

    def chimbal(self, aberto=False):
        n = int((0.25 if aberto else 0.05) * SR)
        return filtro(self.rng.standard_normal(n), 8000, 'hp', 3) * np.exp(-t_(n) * (12 if aberto else 75))

    def prato(self):
        n = int(2.2 * SR)
        return filtro(self.rng.standard_normal(n), 5000, 'hp', 2) * np.exp(-t_(n) * 2.2)

    def baixo(self, f, dur):
        n = int(dur * SR)
        tt = t_(n)
        env = np.minimum(1, tt / 0.004) * np.exp(-tt * 4)
        return (np.sin(2 * np.pi * f * tt) * 0.8 + 0.45 * self.saw(f, n, 0)) * env

    def supersaw(self, freqs, dur, ataque=0.01, solta=0.25):
        n = int((dur + solta * 4) * SR)
        tt = t_(n)
        env = np.minimum(1, tt / ataque) * np.where(tt < dur, 1, np.exp(-(tt - dur) / solta))
        s = np.zeros(n)
        for f in freqs:
            for c in (-16, -7, 0, 8, 17):
                s += self.saw(f * 2 ** (c / 1200), n)
        return s * env / (len(freqs) * 5)

    def pluck(self, f, dur=0.3):
        n = int(dur * SR)
        tt = t_(n)
        s = 0.6 * self.saw(f, n, 0) + 0.4 * np.sign(np.sin(2 * np.pi * f * tt))
        return s * np.minimum(1, tt / 0.002) * np.exp(-tt * 12)

    def sino(self, f, dur=0.9):
        n = int(dur * SR)
        tt = t_(n)
        mod = np.sin(2 * np.pi * f * 3.5 * tt) * 2.2 * np.exp(-tt * 6)   # FM: brilho de sino/teclado
        return np.sin(2 * np.pi * f * tt + mod) * np.minimum(1, tt / 0.002) * np.exp(-tt * 3.5)

    def lead(self, f, dur, tipo):
        n = int((dur + 0.15) * SR)
        tt = t_(n)
        if tipo == 'sino':
            return self.sino(f, dur + 0.6)
        if tipo == 'chop':                  # nota curta e "vocal": soma de seno + quadrada filtrada
            s = np.sin(2 * np.pi * f * tt) + 0.35 * np.sign(np.sin(2 * np.pi * f * 2 * tt))
            return s * np.minimum(1, tt / 0.004) * np.exp(-tt * 9)
        vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * tt) * np.minimum(1, tt / 0.3)
        ph = np.cumsum(f * vib) / SR
        s = (2 * (ph % 1) - 1) + (2 * ((ph * 1.004) % 1) - 1)
        env = np.minimum(1, tt / 0.01) * np.where(tt < dur, 1, np.exp(-(tt - dur) / 0.05))
        return s * env * 0.5

    # -------- mixagem --------
    def stereo(self):
        return np.zeros((self.N, 2))

    def por(self, buf, inicio, sinal, pan=0.0, ganho=1.0):
        i = int(round(inicio * SR))
        if i >= self.N:
            return
        s = sinal[: self.N - i] * ganho
        a = (pan + 1) * np.pi / 4
        buf[i:i + len(s), 0] += s * np.cos(a)
        buf[i:i + len(s), 1] += s * np.sin(a)

    def reverb(self, x, seg=2.2, umido=0.25):
        n = int(seg * SR)
        ir = self.rng.standard_normal((n, 2)) * np.exp(-t_(n) * 6.5 / seg)[:, None]
        ir = filtro(ir, 6000)
        ir /= np.sqrt((ir ** 2).sum(axis=0))
        k = 1 << (x.shape[0] + n - 1).bit_length()
        y = np.fft.irfft(np.fft.rfft(x, k, axis=0) * np.fft.rfft(ir, k, axis=0), k, axis=0)[: x.shape[0]]
        return x + y * umido * 6

    def eco(self, x, atraso, fb=0.35, vezes=5):
        y = x.copy()
        d = int(atraso * SR)
        g = 1.0
        for k in range(1, vezes + 1):
            g *= fb
            y[d * k:, k % 2] += x[: self.N - d * k, :].mean(axis=1) * g
        return y

    # -------- arranjo --------
    def render(self):
        e, B, P = self.e, self.bar, self.passo
        bat, grv, har, arp, mel, fx = (self.stereo() for _ in range(6))
        batidas = []
        for bar in range(BARS):
            b0 = bar * B
            raiz, vozes = e['acordes'][bar % 4]
            cheio = bar >= 8                          # 0–7 abre, 8–15 cresce, 16–31 tudo
            refrao = bar >= 16
            if bar % 8 == 0:
                self.por(fx, b0, self.prato(), pan=0.2, ganho=0.22)
            for beat in range(4):
                tb = b0 + beat * self.beat
                self.por(bat, tb, self.bumbo(), ganho=0.62)
                batidas.append(tb)
                if beat in (1, 3) and (cheio or e['caixa'] != 'eco'):
                    if e['caixa'] in ('palma', 'caixa_palma'):
                        self.por(bat, tb, self.palma(), pan=0.05, ganho=0.4)
                    if e['caixa'] in ('eco', 'caixa_palma'):
                        self.por(bat, tb, self.caixa(), ganho=0.42)
                for k in range(4):
                    vel = (0.34, 0.16, 0.26, 0.16)[k] * (0.8 + 0.4 * self.rng.random())
                    self.por(bat, tb + k * P, self.chimbal(), pan=-0.25, ganho=vel)
                if cheio and e['baixo'] != 'oitavas16':
                    self.por(bat, tb + 2 * P, self.chimbal(True), pan=0.3, ganho=0.2)
                # baixo
                if e['baixo'] == 'oitavas16':
                    for k in range(4):
                        self.por(grv, tb + k * P, self.baixo(raiz * (2 if k % 2 else 1), P * 0.9), ganho=0.42)
                elif e['baixo'] == 'contratempo':
                    self.por(grv, tb + 2 * P, self.baixo(raiz, P * 1.8), ganho=0.55)
                    if beat == 3:
                        self.por(grv, tb + 3 * P, self.baixo(raiz * 2, P * 0.9), ganho=0.35)
                else:  # rolante8
                    for k in (0, 2):
                        self.por(grv, tb + k * P, self.baixo(raiz * (2 if (beat * 2 + k // 2) % 4 == 3 else 1), P * 1.7), ganho=0.48)
            # harmonia
            if e['acordes_estilo'] == 'pad':
                self.por(har, b0, self.supersaw(vozes, B - 0.03, ataque=0.08, solta=0.3), pan=-0.1, ganho=0.85)
            elif e['acordes_estilo'] == 'stab':
                for k in (2, 6, 10, 14):                       # no contratempo de cada tempo
                    self.por(har, b0 + k * P, self.supersaw(vozes, P * 1.3, solta=0.06), ganho=0.75)
            else:  # sincopado 3-3-2 (3+3+2 semicolcheias, duas vezes por compasso)
                for k in (0, 3, 6, 8, 11, 14):
                    self.por(har, b0 + k * P, self.supersaw(vozes, P * 1.6, solta=0.08), ganho=0.7)
                self.por(har, b0, self.supersaw(vozes, B, ataque=0.3, solta=0.4), ganho=0.25)
            # arpejo
            if cheio:
                ordem = [0, 1, 2, 3, 2, 1, 0, 2, 3, 1, 2, 0, 3, 2, 1, 3]
                for k in range(16):
                    f = vozes[ordem[k] % len(vozes)] * 2
                    g = (0.26 if refrao else 0.18) * (1 if k % 4 == 0 else 0.7)
                    if e['arpejo'] == 'sino':
                        if k % 2 == 0:
                            self.por(arp, b0 + k * P, self.sino(f, 0.5), pan=0.3 if k % 4 else -0.3, ganho=g * 1.3)
                    else:
                        s = self.pluck(f) if e['arpejo'] == 'pluck' else self.lead(f, P * 0.8, 'serra')
                        self.por(arp, b0 + k * P, s, ganho=g)
            # melodia: só no refrão (compassos 17–32); a segunda metade repete uma oitava acima nos 4 últimos
            if refrao and bar % 2 == 0:
                for passo, n, dur in e['melodia']:
                    f = nota(n) * (2 if bar >= 28 and e['lead'] != 'chop' else 1)
                    self.por(mel, b0 + passo * P, self.lead(f, dur * P, e['lead']), pan=0.08, ganho=0.36)
        # subidas antes dos compassos 9, 17 e da volta do loop
        for fim in (8, 16, 32):
            n = int(2 * B * SR)
            tt = t_(n)
            sobe = filtro(self.rng.standard_normal(n), 3000, 'hp') * (tt / tt[-1]) ** 3
            self.por(fx, (fim - 2) * B, sobe, ganho=0.13)

        # sidechain: tudo menos a bateria "pulsa" com o bumbo
        tt = t_(self.N)
        sc = np.ones(self.N)
        for tb in batidas:
            i, j = int(tb * SR), min(self.N, int((tb + 0.3) * SR))
            sc[i:j] = np.minimum(sc[i:j], 1 - 0.6 * np.exp(-(tt[i:j] - tb) / 0.08))
        sc = sc[:, None]

        grv = filtro(grv, 420) * sc
        har = filtro(har, 5200) * sc
        arp = self.eco(filtro(arp, 6500), self.beat * 0.75) * sc
        mel = self.eco(filtro(mel, 7000), self.beat * 0.5, fb=0.28) * sc
        bat = filtro(bat, 30, 'hp')
        mix = (bat * 0.95 + grv * 0.9 + self.reverb(har, umido=0.18) * 1.0
               + self.reverb(arp, umido=0.25) * 1.0 + self.reverb(mel, umido=0.25) * 1.05 + self.reverb(fx, umido=0.35))
        loop = mix[: self.L].copy()
        cauda = mix[self.L:]
        loop[: len(cauda)] += cauda                       # loop perfeito: a cauda volta para o começo
        loop = filtro(loop, 28, 'hp')
        loop *= 0.17 / np.sqrt((loop ** 2).mean())        # nível de faixa atual
        loop = np.tanh(loop * 1.15) / np.tanh(1.15)
        return loop * (0.97 / np.abs(loop).max())


def salvar(loop, arquivo, bpm):
    destino = PASTA / arquivo
    wav = destino.with_suffix('.wav')
    PASTA.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((loop * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                    '-codec:a', 'libmp3lame', '-b:a', '192k', str(destino)], check=True)
    wav.unlink()
    print(f'{destino.relative_to(ROOT)}: {len(loop) / SR:.1f} s, {bpm} BPM, {destino.stat().st_size // 1024} KB')


if __name__ == '__main__':
    escolha = [int(a) for a in sys.argv[1:]] or list(ESTILOS)
    for k in escolha:
        est = ESTILOS[k]
        salvar(Faixa(est).render(), est['arquivo'], est['bpm'])
