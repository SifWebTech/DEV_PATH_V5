"""
DEV PATH V5 — compõe e renderiza as trilhas de fundo (public/audio/music/).

Músicas originais, feitas por código (sem samples, sem licença de terceiros), seis estilos animados:
  opcao-1-synthwave.mp3     118 BPM, Dó maior   — anos 80 moderno: baixo pulsante, caixa com eco, lead com vibrato
  opcao-2-future-house.mp3  124 BPM, Sol maior  — balanço de festa: baixo no contratempo, acordes "stab", palmas
  opcao-3-electro-pop.mp3   128 BPM, Ré maior   — pop eletrônico: acordes sincopados, sinos, energia de abertura
  opcao-4-rock-guitarra.mp3 140 BPM, Mi menor   — rock: guitarra distorcida em galope, solo de guitarra e de baixo
  opcao-5-funk-rock.mp3     116 BPM, Lá (blues) — funk rock: guitarra "chique-chique", baixo com slap, solos
  opcao-6-pop-punk.mp3      160 BPM, Ré maior   — pop punk: power chords em colcheias, solo rápido e solo de baixo
  opcao-7-rock-bateria.mp3  132 BPM, Lá menor   — hard rock: solo de bateria (bumbo duplo, tons) e solo de contrabaixo
  opcao-8-funk-groove.mp3   108 BPM, Mi (blues) — funk: solo de bateria sincopado e contrabaixo com slap
  opcao-9-rock-acelerado.mp3 172 BPM, Sol maior — rock acelerado: solo de bateria em alta e solo de contrabaixo
Nas opções 4–6: compassos 1–4 guitarra e bateria, 5–16 banda inteira, 17–24 solo de guitarra,
25–28 solo de baixo, 29–32 todo mundo junto com a frase final da guitarra.
Nas opções 7–9: compassos 1–4 guitarra e bateria, 5–12 banda inteira, 13–20 solo de bateria,
21–28 solo de contrabaixo, 29–32 todo mundo junto com a frase final da guitarra.
Cada uma tem 32 compassos e fecha em loop perfeito (o final emenda no começo).
A TV toca a que estiver em public/js/narration.js → config.music.

Uso:  python ferramentas/gerar_musica.py            (todas)
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
    # ---- banda de rock: guitarra distorcida, baixo elétrico e bateria, com solo de guitarra e solo de baixo ----
    # acordes = nota grave do power chord de cada compasso (a guitarra toca tônica + quinta + oitava)
    4: dict(
        arquivo='opcao-4-rock-guitarra.mp3', bpm=140, semente=41, rock=True,
        acordes=['E2', 'C3', 'G2', 'D3'], ritmo='galope', bateria='rock', baixo_estilo='oitos',
        escala=('E', 'menor_pent'), distorcao=8,
    ),
    5: dict(
        arquivo='opcao-5-funk-rock.mp3', bpm=116, semente=53, rock=True,
        acordes=['A2', 'A2', 'D3', 'E2'], ritmo='funk', bateria='funk', baixo_estilo='funk',
        escala=('A', 'blues'), distorcao=3,
    ),
    6: dict(
        arquivo='opcao-6-pop-punk.mp3', bpm=160, semente=67, rock=True,
        acordes=['D3', 'A2', 'B2', 'G2'], ritmo='punk', bateria='punk', baixo_estilo='oitos',
        escala=('D', 'maior_pent'), distorcao=9,
    ),
    # ---- banda de rock com solo de bateria e solo de contrabaixo (a guitarra só acompanha e fecha) ----
    7: dict(
        arquivo='opcao-7-rock-bateria.mp3', bpm=132, semente=71, rock=True, solos='bateria',
        acordes=['A2', 'F2', 'G2', 'E2'], ritmo='galope', bateria='rock', baixo_estilo='oitos',
        escala=('A', 'menor_pent'), distorcao=8,
    ),
    8: dict(
        arquivo='opcao-8-funk-groove.mp3', bpm=108, semente=83, rock=True, solos='bateria',
        acordes=['E2', 'E2', 'A2', 'B2'], ritmo='funk', bateria='funk', baixo_estilo='funk',
        escala=('E', 'blues'), distorcao=3,
    ),
    9: dict(
        arquivo='opcao-9-rock-acelerado.mp3', bpm=172, semente=97, rock=True, solos='bateria',
        acordes=['G2', 'D3', 'E2', 'C3'], ritmo='punk', bateria='punk', baixo_estilo='oitos',
        escala=('G', 'maior_pent'), distorcao=9,
    ),
}

INTERVALOS = {'menor_pent': [0, 3, 5, 7, 10], 'maior_pent': [0, 2, 4, 7, 9], 'blues': [0, 3, 5, 6, 7, 10]}


def escala(tonica, tipo, oitava, oitavas=2):
    """Notas da escala (Hz) a partir da tônica na oitava dada, terminando na tônica de cima."""
    f0 = nota(f'{tonica}{oitava}')
    notas = [f0 * 2 ** ((12 * o + i) / 12) for o in range(oitavas) for i in INTERVALOS[tipo]]
    return notas + [f0 * 2 ** oitavas]


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

    # -------- banda de rock --------
    def guitarra(self, freqs, dur, abafada=False, bend=0.0, vibrato=False, dist=8.0):
        """Guitarra elétrica: cordas (duas serras levemente desafinadas) + palhetada, saturadas juntas.
        abafada = palm mute (nota curta e grave); bend = começa N semitons abaixo e sobe até a nota."""
        cauda = 0.03 if abafada else 0.12
        n = int((dur + cauda * 4) * SR)
        tt = t_(n)
        s = np.zeros(n)
        for f in freqs:
            curva = f * 2 ** (-bend * np.maximum(0, 1 - tt / 0.12) / 12)
            if vibrato:
                curva = curva * (1 + 0.012 * np.sin(2 * np.pi * 5.8 * tt) * np.clip((tt - 0.15) / 0.25, 0, 1))
            ph = np.cumsum(curva) / SR + self.rng.random()
            s += (2 * (ph % 1) - 1) + 0.6 * (2 * ((ph * 1.0035) % 1) - 1)
        s /= len(freqs) * 1.6
        decai = 22 if abafada else 1.1
        env = np.minimum(1, tt / 0.002) * np.exp(-tt * decai) * np.where(tt < dur, 1, np.exp(-(tt - dur) / cauda))
        palheta = self.rng.standard_normal(n) * np.exp(-tt * 400) * 0.25
        x = s * env + palheta
        if abafada:
            x = filtro(x, 1400)
        return np.tanh(x * dist) / np.tanh(dist)

    def baixo_eletrico(self, f, dur, slap=False):
        """Baixo de quatro cordas: fundamental + harmônicos que escurecem logo depois do ataque."""
        n = int((dur + 0.08) * SR)
        tt = t_(n)
        brilho = (0.75 if slap else 0.45) * np.exp(-tt * (14 if slap else 7)) + 0.12
        s = np.sin(2 * np.pi * f * tt) + brilho * self.saw(f, n, 0)
        if slap:
            s += np.sin(2 * np.pi * f * 2 * tt) * 0.4 * np.exp(-tt * 10) + self.rng.standard_normal(n) * np.exp(-tt * 250) * 0.5
        env = np.minimum(1, tt / 0.003) * np.exp(-tt * 2.2) * np.where(tt < dur, 1, np.exp(-(tt - dur) / 0.03))
        return np.tanh(s * env * 1.6) * 0.8

    def frase(self, notas, compassos, rapida=False):
        """Solo improvisado na escala: andamento por graus vizinhos, pausas para respirar e,
        no fim, uma nota longa com bend e vibrato na tônica. Devolve [(passo, Hz, duração em 1/16, bend)]."""
        ritmos = [[2, 2, 2, 2], [1, 1, 1, 1, 2, 2], [1, 1, 2, 1, 1, 2], [3, 1, 2, 2], [4, 2, 2], [2, 1, 1, 4]]
        if rapida:
            ritmos += [[1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 2, 1, 1]] * 2
        total = 16 * compassos
        i, pos, out = len(notas) // 2, 0, []
        while pos < total - 6:
            for d in ritmos[self.rng.integers(len(ritmos))]:
                if pos >= total - 6:
                    break
                i = int(np.clip(i + self.rng.choice([-2, -1, -1, 1, 1, 2, 0]), 0, len(notas) - 1))
                if self.rng.random() > 0.1:                       # de vez em quando, uma pausa
                    curva = 1.0 if d >= 3 and self.rng.random() < 0.5 else 0.0
                    out.append((pos, notas[i], d, curva))
                pos += d
        passo = len(INTERVALOS[self.e['escala'][1]])
        raiz = min(range(0, len(notas), passo), key=lambda k: abs(k - i))
        out.append((pos, notas[raiz], total - pos, 2.0))       # fecha na tônica com bend de um tom
        return out

    def tom(self, f):
        """Tom da bateria: pele que afina para baixo logo depois da batida."""
        n = int(0.5 * SR)
        tt = t_(n)
        curva = f * (1 + 0.6 * np.exp(-tt * 25))
        corpo = np.sin(2 * np.pi * np.cumsum(curva) / SR) * np.exp(-tt * 8)
        pele = filtro(self.rng.standard_normal(n), 2000, 'hp') * np.exp(-tt * 60) * 0.25
        return np.tanh((corpo + pele) * 1.4)

    def solo_bateria(self, bat, fx, b0, k):
        """Um compasso do solo de bateria (k = 0…7): cada compasso é uma ideia diferente, o último é a virada final."""
        P = self.passo
        toms = [(240, -0.5), (180, -0.2), (130, 0.2), (95, 0.5)]           # agudo, médio, grave, surdo

        def bate(passo, som, pan=0.0, g=0.5):
            self.por(bat, b0 + passo * P, som, pan=pan, ganho=g)

        def tom(passo, i, g=0.55):
            bate(passo, self.tom(toms[i][0]), toms[i][1], g)

        plano = ['groove_toms', 'duplo_bumbo', 'tercinas', 'caixa_rolo', 'sincopado', 'toms_descendo', 'duplo_bumbo', 'virada_final']
        estilo = plano[k]
        if estilo == 'groove_toms':
            for s in (0, 6, 8):
                bate(s, self.bumbo(), g=0.7)
            for s in (4, 12):
                bate(s, self.caixa(), g=0.6)
            for s, i in ((2, 3), (10, 3), (14, 2), (7, 0), (15, 1)):
                tom(s, i)
        elif estilo == 'duplo_bumbo':
            self.por(fx, b0, self.prato(), pan=-0.25, ganho=0.22)
            for s in range(16):
                bate(s, self.bumbo(), g=0.42)
            for s in (4, 12):
                bate(s, self.caixa(), g=0.62)
        elif estilo == 'tercinas':                     # grupos de 3 sobre o compasso de 4: caixa, tom, tom
            for s in range(16):
                if s % 3 == 0:
                    bate(s, self.bumbo(), g=0.6)
                    bate(s, self.caixa(), g=0.5)
                else:
                    tom(s, 1 if s % 3 == 1 else 2, 0.45)
        elif estilo == 'caixa_rolo':                   # rufada que cresce
            for s in range(16):
                bate(s, self.caixa(), pan=0.05, g=0.18 + 0.42 * s / 15)
            for s in (0, 4, 8, 12):
                bate(s, self.bumbo(), g=0.65)
        elif estilo == 'sincopado':
            for s in (0, 3, 6, 10, 13):
                bate(s, self.bumbo(), g=0.68)
            for s in (4, 12):
                bate(s, self.caixa(), g=0.6)
            for s, i in ((7, 0), (9, 1), (11, 2), (14, 3), (15, 3)):
                tom(s, i)
        elif estilo == 'toms_descendo':
            for s in range(16):
                tom(s, s // 4, 0.42 + 0.04 * (s % 4))
            for s in (0, 4, 8, 12):
                bate(s, self.bumbo(), g=0.6)
        else:  # virada final: rufada na caixa e descida pelos tons até o prato do compasso seguinte
            for s in range(8):
                bate(s, self.caixa(), g=0.25 + 0.05 * s)
            for s in range(8, 16):
                tom(s, (s - 8) // 2, 0.6)
            for s in (0, 4, 8, 12):
                bate(s, self.bumbo(), g=0.65)

    def render_rock(self):
        e, B, P = self.e, self.bar, self.passo
        bat, rit, grv, solo, fx = (self.stereo() for _ in range(5))
        bateria_solo = e.get('solos') == 'bateria'
        tonica, tipo = e['escala']
        notas_guitarra = escala(tonica, tipo, 4)
        notas_baixo = escala(tonica, tipo, 2)
        D = e['distorcao']
        for bar in range(BARS):
            b0 = bar * B
            raiz = nota(e['acordes'][bar % 4])
            power = [raiz, raiz * 1.5, raiz * 2]
            rb = raiz / 2 if raiz / 2 > 38 else raiz
            intro = bar < 4                    # 0–3 guitarra e bateria
            if bateria_solo:                   # 4–11 banda · 12–19 solo de bateria · 20–27 solo de baixo · 28–31 final
                solo_bat = 12 <= bar < 20
                solo_baixo = 20 <= bar < 28
                pratos = (0, 4, 12, 20, 28)
            else:                              # 4–15 banda · 16–23 solo de guitarra · 24–27 solo de baixo · 28–31 final
                solo_bat = False
                solo_baixo = 24 <= bar < 28
                pratos = (0, 4, 8, 16, 24, 28)
            if bar in pratos:
                self.por(fx, b0, self.prato(), pan=0.25, ganho=0.3)
            if solo_bat:                       # só a bateria toca
                self.solo_bateria(bat, fx, b0, bar - 12)
                continue

            # bateria
            if e['bateria'] == 'punk':
                bumbos = [0, 4, 8, 12, 14]
            elif e['bateria'] == 'funk':
                bumbos = [0, 7, 10]
            else:
                bumbos = [0, 6, 8, 10]
            for k in range(16):
                t = b0 + k * P
                if k in bumbos:
                    self.por(bat, t, self.bumbo(), ganho=0.7)
                if k in (4, 12) and not (intro and bar < 2):
                    self.por(bat, t, self.caixa(), ganho=0.6)
                if e['bateria'] == 'funk' or k % 2 == 0:
                    self.por(bat, t, self.chimbal(aberto=(k == 14 and not intro)), pan=-0.3, ganho=(0.3 if k % 4 == 0 else 0.17))
            if bar % 4 == 3:                   # virada no último tempo
                for k in range(12, 16):
                    self.por(bat, b0 + k * P, self.caixa(), pan=0.1 * (k - 13), ganho=0.3 + 0.08 * (k - 12))

            # guitarra base
            g = 0.55 if (20 if bateria_solo else 16) <= bar < 28 else 0.8
            if solo_baixo:
                self.por(rit, b0, self.guitarra(power, self.beat * 1.5, dist=D), pan=-0.35, ganho=g)
            elif e['ritmo'] == 'galope':
                for k in (0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15):
                    aberta = k in (0, 8) and not intro
                    s = self.guitarra(power, P * (3.5 if aberta else 0.9), abafada=not aberta, dist=D)
                    self.por(rit, b0 + k * P, s, pan=-0.35 if k % 2 else 0.35, ganho=g * (1 if aberta else 0.8))
            elif e['ritmo'] == 'punk':
                for k in range(0, 16, 2):
                    s = self.guitarra(power, P * 1.9, abafada=intro, dist=D)
                    self.por(rit, b0 + k * P, s, pan=-0.35 if k % 4 else 0.35, ganho=g * (1 if k % 4 == 0 else 0.85))
            else:  # funk: acordes cheios nos contratempos e "chiques" abafados no resto
                voz = [raiz * 2, raiz * 2 * 1.26, raiz * 3, raiz * 2 * 1.78]   # acorde com sétima, região média
                for k in range(16):
                    if k in (0, 3, 6, 10, 12):
                        self.por(rit, b0 + k * P, self.guitarra(voz, P * 1.4, dist=D), pan=0.3, ganho=g * 0.9)
                    elif not intro:
                        self.por(rit, b0 + k * P, self.guitarra(voz, P * 0.3, abafada=True, dist=D), pan=0.3, ganho=g * 0.35)

            # baixo
            if solo_baixo:
                if bar in ((20, 24) if bateria_solo else (24,)):   # frases de 4 compassos
                    for passo, f, d, _ in self.frase(notas_baixo, 4, rapida=True):
                        self.por(grv, b0 + passo * P, self.baixo_eletrico(f, d * P * 0.95, slap=d <= 1), ganho=0.85)
            elif not intro:
                if e['baixo_estilo'] == 'funk':
                    for k, mult in ((0, 1), (3, 2), (6, 1), (8, 1), (10, 2), (11, 1), (14, 1.5)):
                        self.por(grv, b0 + k * P, self.baixo_eletrico(rb * mult, P * 1.6, slap=mult == 2), ganho=0.7)
                else:
                    for k in range(0, 16, 2):
                        f = rb * (1.5 if k == 14 and bar % 2 else 1)     # nota de passagem no fim do compasso
                        self.por(grv, b0 + k * P, self.baixo_eletrico(f, P * 1.8), ganho=0.7)

            # solo de guitarra (16–23) e frase final mais rápida (28–31)
            if bar in ((28,) if bateria_solo else (16, 20, 28)):
                for passo, f, d, curva in self.frase(notas_guitarra, 4, rapida=bar == 28):
                    s = self.guitarra([f], d * P * 0.95, bend=curva, vibrato=d >= 3, dist=D * 1.6)
                    self.por(solo, b0 + passo * P, s, pan=0.1, ganho=0.5)

        rit = filtro(filtro(rit, 90, 'hp'), 5200)
        solo = self.eco(filtro(filtro(solo, 180, 'hp'), 6500), self.beat * 0.75, fb=0.25)
        grv = filtro(filtro(grv, 35, 'hp'), 3200)
        bat = filtro(bat, 30, 'hp')
        mix = (bat * 1.0 + grv * 1.0 + self.reverb(rit, seg=1.2, umido=0.1) * 0.75
               + self.reverb(solo, umido=0.22) * 0.9 + self.reverb(fx, umido=0.3))
        loop = mix[: self.L].copy()
        cauda = mix[self.L:]
        loop[: len(cauda)] += cauda
        loop = filtro(loop, 28, 'hp')
        loop *= 0.17 / np.sqrt((loop ** 2).mean())
        loop = np.tanh(loop * 1.15) / np.tanh(1.15)
        return loop * (0.97 / np.abs(loop).max())

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
        faixa = Faixa(est)
        salvar(faixa.render_rock() if est.get('rock') else faixa.render(), est['arquivo'], est['bpm'])
