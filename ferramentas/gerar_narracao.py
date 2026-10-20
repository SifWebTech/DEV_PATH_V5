"""
DEV PATH V5 — gera os MP3 da narração com vozes neurais gratuitas (edge-tts).

Lê o manifesto public/js/narration.js (textos, quem fala e nome do arquivo de cada trecho),
fala cada trecho com a voz neural do tipo certo e grava:
  public/audio/narration/<arquivo>.mp3   a narração
  public/js/narration-timing.js          o instante exato de cada palavra (sincroniza legenda e destaques)

Só regera o que mudou (texto, voz ou entonação). Para regerar tudo: --tudo

Uso (precisa de internet só na hora de gerar; na apresentação os MP3 tocam offline):
  python -m pip install edge-tts numpy      (e o ffmpeg no PATH)
  python ferramentas/gerar_narracao.py
  python ferramentas/gerar_narracao.py --amostras   (mesma frase em todas as vozes pt-BR, para comparar)

As vozes são as mesmas "Natural" do leitor em voz alta do Microsoft Edge, sem chave nem custo.
"""
import asyncio
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import unicodedata

import edge_tts
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
TIMING = PUBLIC / 'js' / 'narration-timing.js'

# Vozes neurais do Brasil disponíveis de graça: Francisca e Thalita (narradoras) e Antonio (narrador).
# A narradora é a Francisca: a Thalita é "multilíngue" e pode puxar sotaque de outra língua.
# Para comparar as três: python ferramentas/gerar_narracao.py --amostras
VOZES = {
    'female': 'pt-BR-FranciscaNeural',
    'male': 'pt-BR-AntonioNeural',
}
# Entonação por frase (as vozes grátis não têm "estilo empolgado"): cada frase é gerada com a sua
# própria velocidade, tom e volume, e os pedaços são emendados. Assim a fala sobe e desce, com ênfase
# nas exclamações, em vez de ficar num tom só. Igual a server/voz.js.
ENTONACAO = {
    '!': dict(rate='+16%', pitch='+12Hz', volume='+10%'),   # exclamação: mais rápida, mais aguda e mais forte
    '?': dict(rate='+8%', pitch='+16Hz', volume='+5%'),     # pergunta: sobe
    '.': dict(rate='+10%', pitch='+5Hz', volume='+0%'),     # afirmação: firme, um pouco mais ágil
}
PAUSA = {'!': 0.22, '?': 0.32, '.': 0.26}   # segundos de pausa depois de cada tipo de frase
TAXA = 24000                                 # amostras por segundo das vozes do edge-tts
AMOSTRA = 'Olá! Que bom ter você aqui! No terceiro semestre, o sistema ganha inteligência. E o inglês vira ferramenta de trabalho! Qual vai ser o seu caminho?'


def manifesto():
    """Executa o narration.js no Node (como o navegador faria) e devolve o objeto."""
    js = (
        "global.window = {}; require(process.argv[1]);"
        "process.stdout.write(JSON.stringify(window.DEVPATH_NARRACAO))"
    )
    out = subprocess.run(['node', '-e', js, str(PUBLIC / 'js' / 'narration.js')],
                         capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


def trechos(m):
    """Todos os trechos com arquivo de áudio: (arquivo, texto, tipo de voz)."""
    for scene in m['scenes'].values():
        for seg in scene['segments']:
            voz = seg.get('voice') or scene.get('voice') or 'female'
            if seg.get('audio') and not seg.get('dynamic'):
                yield seg['audio'], seg['text'], voz
            fb = seg.get('fallback') or {}
            if fb.get('audio'):
                yield fb['audio'], fb['text'], voz


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')


def frases(texto):
    """'Olá! Tudo bem? Vamos.' → ['Olá!', 'Tudo bem?', 'Vamos.'] (o sinal do fim decide a entonação)"""
    return [f.strip() for f in re.findall(r'[^.!?]+[.!?]*', texto) if f.strip()]


def decodificar(mp3):
    """MP3 → amostras (float, mono, TAXA Hz) pelo ffmpeg."""
    out = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 's16le', '-ac', '1', '-ar', str(TAXA), 'pipe:1'],
                         input=bytes(mp3), capture_output=True, check=True)
    return np.frombuffer(out.stdout, dtype='<i2').astype(np.float32) / 32768


def fim_da_voz(x):
    """Último instante (s) com voz: o resto do pedaço é silêncio que o serviço acrescenta."""
    janela = int(0.01 * TAXA)
    n = len(x) // janela
    if not n:
        return len(x) / TAXA
    rms = np.sqrt((x[: n * janela].reshape(n, janela) ** 2).mean(axis=1))
    com_voz = np.nonzero(rms > 0.01)[0]
    return ((com_voz[-1] + 1) * janela / TAXA) if len(com_voz) else len(x) / TAXA


async def falar(texto, voz, destino):
    """Grava o MP3 (uma entonação por frase) e devolve [[segundos, posição no texto], …] de cada palavra.
    Cada frase vem do serviço com silêncio no começo e no fim: ele é cortado e as frases são emendadas
    com uma pausa curta (PAUSA), senão a fala fica arrastada."""
    pedacos, palavras, t = [], [], 0.0
    for frase in frases(texto):
        mp3, marcas_frase = bytearray(), []
        com = edge_tts.Communicate(frase, voz, boundary='WordBoundary', **ENTONACAO.get(frase[-1], ENTONACAO['.']))
        async for parte in com.stream():
            if parte['type'] == 'audio':
                mp3 += parte['data']
            elif parte['type'] == 'WordBoundary':
                marcas_frase.append((parte['offset'] / 10_000_000, parte['text']))  # offset vem em 100 ns
        if not mp3:
            raise edge_tts.exceptions.NoAudioReceived('sem áudio')
        x = decodificar(mp3)
        ini = max(0.0, (marcas_frase[0][0] if marcas_frase else 0) - 0.04)   # um respiro antes da 1ª palavra
        fim = min(len(x) / TAXA, fim_da_voz(x) + 0.06)
        if pedacos:
            pausa = PAUSA.get(pedacos[-1][1], PAUSA['.'])
            pedacos.append((np.zeros(int(pausa * TAXA), dtype=np.float32), ''))
            t += pausa
        pedacos.append((x[int(ini * TAXA): int(fim * TAXA)], frase[-1]))
        palavras += [(t + s - ini, w) for s, w in marcas_frase]
        t += fim - ini
    pcm = np.concatenate([p for p, _ in pedacos])
    destino.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ac', '1', '-ar', str(TAXA), '-i', 'pipe:0',
                    '-codec:a', 'libmp3lame', '-b:a', '64k', str(destino)],
                   input=(np.clip(pcm, -1, 1) * 32767).astype('<i2').tobytes(), check=True)
    # cada palavra falada → onde ela começa no texto (procura em ordem)
    hay, pos, marcas = norm(texto), 0, []
    for t, w in palavras:
        k = hay.find(norm(w), pos)
        if k >= 0:
            marcas.append([round(t, 3), k])
            pos = k + len(w)
    return marcas


def duracao(arquivo):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(arquivo)],
                         capture_output=True, text=True)
    try:
        return round(float(out.stdout.strip()), 3)
    except ValueError:
        return None


def ler_tempos():
    if not TIMING.exists():
        return {}
    txt = TIMING.read_text(encoding='utf-8')
    return json.loads(txt[txt.index('{'):txt.rindex('}') + 1])


async def main():
    if '--amostras' in sys.argv:
        pasta = ROOT / 'ferramentas' / 'amostras-vozes'
        for v in await edge_tts.list_voices():
            if v['Locale'] == 'pt-BR':
                await falar(AMOSTRA, v['ShortName'], pasta / f"{v['ShortName']}.mp3")
                print('amostra:', pasta / f"{v['ShortName']}.mp3")
        return

    tudo = '--tudo' in sys.argv
    tempos = ler_tempos()
    novos = {}
    for audio, texto, tipo in trechos(manifesto()):
        voz = VOZES[tipo]
        assinatura = hashlib.sha1(f'{voz}|{json.dumps([ENTONACAO, PAUSA], sort_keys=True)}|{texto}'.encode()).hexdigest()[:12]
        destino = PUBLIC / audio
        antigo = tempos.get(audio)
        if not tudo and antigo and antigo.get('hash') == assinatura and destino.exists():
            novos[audio] = antigo
            print('igual   ', audio)
            continue
        for tentativa in range(3):  # o serviço de voz às vezes não devolve áudio: tenta de novo
            try:
                marcas = await falar(texto, voz, destino)
                break
            except edge_tts.exceptions.NoAudioReceived:
                if tentativa == 2:
                    raise
                print('de novo ', audio)
                await asyncio.sleep(2)
        novos[audio] = {'hash': assinatura, 'voz': voz, 'dur': duracao(destino), 'w': marcas}
        print('gerado  ', audio, f"({novos[audio]['dur']} s, {voz})")

    TIMING.write_text(
        '/*\n * GERADO por ferramentas/gerar_narracao.py: não edite à mão.\n'
        ' * Instante (segundos) em que cada palavra começa em cada MP3 da narração, e a posição dela no texto.\n'
        ' * O narrador usa isto para a legenda e os destaques baterem com a voz.\n */\n'
        'window.DEVPATH_NARRACAO_TEMPOS = {\n'
        + ',\n'.join(f' {json.dumps(k)}: {json.dumps(v, separators=(",", ":"))}' for k, v in novos.items())
        + '\n};\n',
        encoding='utf-8', newline='\n')
    print(f'\n{len(novos)} trechos. Tempos em {TIMING.relative_to(ROOT)}')


if __name__ == '__main__':
    asyncio.run(main())
