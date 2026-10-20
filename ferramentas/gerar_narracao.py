"""
DEV PATH V5 — gera os MP3 da narração com vozes neurais gratuitas (edge-tts).

Lê o manifesto public/js/narration.js (textos, quem fala e nome do arquivo de cada trecho),
fala cada trecho com a voz neural do tipo certo e grava:
  public/audio/narration/<arquivo>.mp3   a narração
  public/js/narration-timing.js          o instante exato de cada palavra (sincroniza legenda e destaques)

Só regera o que mudou (texto, voz ou velocidade). Para regerar tudo: --tudo

Uso (precisa de internet só na hora de gerar; na apresentação os MP3 tocam offline):
  python -m pip install edge-tts
  python ferramentas/gerar_narracao.py
  python ferramentas/gerar_narracao.py --amostras   (mesma frase em todas as vozes pt-BR, para comparar)

As vozes são as mesmas "Natural" do leitor em voz alta do Microsoft Edge, sem chave nem custo.
"""
import asyncio
import hashlib
import json
import pathlib
import subprocess
import sys
import unicodedata

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
TIMING = PUBLIC / 'js' / 'narration-timing.js'

# Vozes neurais pt-BR disponíveis de graça: Thalita (multilíngue, a mais nova), Francisca e Antonio.
VOZES = {
    'female': 'pt-BR-ThalitaMultilingualNeural',
    'male': 'pt-BR-AntonioNeural',
}
VELOCIDADE = '+4%'   # um pouco mais ágil que o padrão: soa mais atual
AMOSTRA = 'Olá! No terceiro semestre, o sistema começa a ganhar inteligência: banco de dados, programação web e servidores.'


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


async def falar(texto, voz, destino):
    """Grava o MP3 e devolve [[segundos, posição no texto], …] de cada palavra falada."""
    com = edge_tts.Communicate(texto, voz, rate=VELOCIDADE, boundary='WordBoundary')
    audio = bytearray()
    palavras = []
    async for parte in com.stream():
        if parte['type'] == 'audio':
            audio += parte['data']
        elif parte['type'] == 'WordBoundary':
            palavras.append((parte['offset'] / 10_000_000, parte['text']))  # offset vem em 100 ns
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(audio)
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
        assinatura = hashlib.sha1(f'{voz}|{VELOCIDADE}|{texto}'.encode()).hexdigest()[:12]
        destino = PUBLIC / audio
        antigo = tempos.get(audio)
        if not tudo and antigo and antigo.get('hash') == assinatura and destino.exists():
            novos[audio] = antigo
            print('igual   ', audio)
            continue
        marcas = await falar(texto, voz, destino)
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
