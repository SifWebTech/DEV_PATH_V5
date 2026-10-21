# 10. Sistema de narração, música e efeitos

> A imagem mostra. A voz conduz. A animação reage. A música cria atmosfera.

A apresentação não é um vídeo: cada cena é montada ao vivo com o nome e o interesse do visitante, e **a narração decide quando a cena acaba**. Só quando não há voz nenhuma vale a duração fixa de `STEPS`.

## 10.1 Arquitetura

```
 celular ──POST /api/start──▶ servidor ──SSE "start"──▶ TV (tv.js)
                                                         │
          PresentationController / SceneManager (tv.js)  │ begin → go(i) → narrate(step)
                                                         ▼
          Narrator (narrator.js)  ◀── manifesto (narration.js)
            │ para cada trecho: MP3 → voz do navegador (feminina ou masculina) → silencioso
            │ avisa: onSpeaking · onCaption · onMarker · onBlocked
            ▼
          AudioEngine (audio-engine.js)
            música (loop sem emenda) ───────────────────────────────┐
            narração MP3 ─▶ corta-graves ─▶ presença ─▶ compressor ─┼─▶ geral ─▶ compressor geral
            efeitos ────────────────────────────────────────────────┘
```

Antes da apresentação (ferramentas, rodam no notebook com internet):

```
 narration.js ──▶ ferramentas/gerar_narracao.py (edge-tts, vozes neurais) ──▶ audio/narration/*.mp3
                                                                         └──▶ js/narration-timing.js (tempo de cada palavra)
 ferramentas/gerar_musica.py (numpy + ffmpeg) ──▶ audio/music/opcao-1/2/3.mp3
```

| Arquivo | Papel |
|---|---|
| `public/js/narration-timing.js` | Gerado: instante de cada palavra em cada MP3 (sincronização exata). |
| `ferramentas/gerar_narracao.py` | Gera os MP3 da narração com as vozes neurais Thalita e Antonio (grátis, via edge-tts). |
| `ferramentas/gerar_musica.py` | Compõe as 9 trilhas animadas (código, sem licença de terceiros). |
| `public/js/narration.js` | **Manifesto**: textos, MP3, quem fala (F/M), marcadores, volumes. É o único arquivo a editar no dia a dia. |
| `public/js/narrator.js` | Escolhe como falar cada trecho, fala, dispara legenda e marcadores. Único lugar que usa `speechSynthesis`. |
| `public/js/audio-engine.js` | Web Audio: música, narração MP3, efeitos, fades, ducking, mudo. |
| `public/js/tv.js` | Liga tudo às cenas: `narrate()`, `MARK` (reações), `setupAudio()`, botão de ativar áudio, atalhos. |
| `public/audio/` | 23 MP3 de narração + 9 trilhas, das quais tocam a 9, a 8 e a 7 (ver `public/audio/README.md`). |
| `server/http.js` | Serve os áudios (com `Range`), `POST /api/tv/audio` e os comandos `mute`, `legendas`, `narracao`. |

Por que o manifesto é um `.js` e não `data/narration.json`: `data/` fica fora do Git e não é servida ao navegador; um `.js` igual ao `content.js` aceita comentários e funciona até com a TV aberta direto do arquivo.

## 10.2 Fluxo de uma cena

1. `go(i)` para a narração anterior (`Narrator.stop()`), monta a cena, toca o efeito de transição e liga o relógio de `STEPS` como provisório.
2. `narrate(step)` chama `Narrator.play('journey3', { nome, perfil, fallbackSec })`.
3. O narrador monta o **plano**: para cada trecho, `mp3` (se o arquivo existe: consulta `HEAD` uma vez por arquivo), `tts` (voz do navegador) ou `silent`.
4. Se há voz, `tv.js` desliga o relógio de `STEPS`; a barrinha do HUD usa a duração estimada; um **guarda** avança a cena se a narração travar (`estimativa × 2 + 20 s`, contando só o tempo sem pausa).
5. Fim da narração → pausa curta (`hold`, padrão 1,2 s; no crachá, 6 s) → próxima cena.
6. Sem voz: a legenda e os marcadores andam no tempo estimado, encaixados na duração de `STEPS`.

Estados: `AUDIO_LOCKED` (navegador ainda não deixou tocar) → `AUDIO_READY`. Os estados da visita (`WAITING → RUNNING → COMPLETED`) continuam os do servidor (`queued`, `playing`, `done`): o contrato não mudou.

## 10.3 AudioEngine

| Função | O que faz |
|---|---|
| `init(config)` | Cria o `AudioContext` e os canais. Se o navegador já permite som (flag de autoplay), libera sozinho. |
| `unlock()` | Dentro de um clique/tecla: `ctx.resume()`, começa a música. |
| `playMusic()` / `pauseMusic()` | Música em loop (MP3 decodificado → `AudioBufferSourceNode` com `loop`, sem emenda). |
| `duck()` / `restore()` | Música para `musicDucked` / `music` com rampa (`setTargetAtTime`). |
| `playNarration(url)` | Um `<audio>` reaproveitado, ligado ao canal de narração. Devolve `{ done, pause, resume, stop, time, duration }`. Só uma narração por vez (contador `narrToken`). |
| `playSFX(nome)` | Efeito do MP3; sem arquivo, efeito sintetizado curto. |
| `setMusicVolume`, `setNarrationVolume`, `setSfxVolume`, `setMuted` | Volumes com fade. |
| `exists(url)` | `HEAD` com cache: arquivo que falta não é pedido de novo. |

**Ducking**, medido no teste: música na espera com ganho 0,120 → durante a fala 0,045 → volta a 0,12 depois. A volta espera a pausa entre cenas passar: se a próxima cena já começa falando, a música nem sobe (sem "bombear").

**Trilhas**: três composições originais e animadas em `audio/music/` (synthwave 118 BPM, future house 124, electro-pop 128), escolhidas em `config.music`. Loop sem emenda: o motor ignora o silêncio que o MP3 põe nas pontas (`loopStart`/`loopEnd`). Antes de cada cena, os MP3 da cena seguinte já são baixados (`preload`).

**Voz mais clara**: corta-graves em 90 Hz, realce de presença em 3,2 kHz (+2,5 dB) e compressor (3:1), como em rádio; compressor geral suave para os picos.

**Trilha sintetizada de reserva** (só se o MP3 da música faltar): acordes Am9 → Fmaj7 → C → G6, filtrados e lentos, com notas esparsas e eco. Calibrada para ficar no nível de uma faixa ambiente normal (RMS ≈ 0,1–0,2 antes do volume), então `volume.music` vale igual para ela e para o MP3. Desliga com `synthMusic: false`.

## 10.4 Narrator e as duas vozes

- **A narração são MP3 com vozes neurais**: `pt-BR-ThalitaMultilingualNeural` (narradora) e `pt-BR-AntonioNeural` (narrador), geradas de graça pelo `edge-tts` (o mesmo serviço do "Ler em voz alta" do Edge). Não precisa de chave; precisa de internet só na hora de gerar. `python ferramentas/gerar_narracao.py --amostras` grava a mesma frase em todas as vozes pt-BR para comparar.
- A voz do navegador só entra no **"Olá, {nome}."** e se faltar algum MP3. Por isso a TV abre no **Edge**, que tem as mesmas vozes neurais ("Microsoft Thalita multilíngue Online (Natural)", "Microsoft Antônio Online (Natural)"). A voz do Google nunca é usada (`config.voice.avoid`).
- **Dois narradores se intercalam**: `voice: 'female' | 'male'` em cada cena; um trecho pode trocar (`voice` no trecho). As transições entre semestres são ditas por quem narrou o semestre anterior, e o fechamento é dividido entre os dois.
- Cada tipo tem sua lista de preferência (`config.voice.female.prefer`, `config.voice.male.prefer`). No Edge deste notebook: Thalita e Antônio (neurais, online). Sem internet: Maria e Daniel (do Windows).
- Sem voz de um tipo, a outra fala no lugar. Sem internet, só vozes do computador (Maria, Daniel).
- `speakDynamicWelcome(nome)`: o "Olá, {nome}." é sempre pela voz do navegador (não dá para gravar todos os nomes). Sem voz → "Olá. Seu DEV PATH começa agora." (`01a-ola-sem-nome.mp3`).

Comportamentos medidos no Chrome deste notebook, e o que o narrador faz com eles:

| Medido | Solução |
|---|---|
| Vozes da Microsoft demoram 2–3 s para começar **cada** fala | voz do computador fala o trecho inteiro de uma vez |
| `cancel()` logo antes de `speak()` corta a fala nova ("interrupted") | só cancela se algo está tocando, e espera 250 ms depois |
| Voz do Google não envia eventos de palavra (`boundary`) | posição calculada pelo tempo, com a velocidade real aprendida da voz |
| Vozes online do Edge avisam o fim da fala segundos depois | a saudação com o nome segue depois do tempo estimado |
| O Chrome corta falas online longas | voz online fala uma frase por vez |
| Voz online sem internet dá erro | a voz é marcada como falha e a próxima da lista assume (teste: Google → Maria) |
| `end` às vezes não chega | guarda por frase (`estimativa × 2 + 4 s`) |
| Navegador bloqueia a voz (`not-allowed`) | o trecho segue em modo silencioso e a TV volta a mostrar "Ativar áudio" |

Pausa: a voz do navegador não pausa de forma confiável; o narrador corta e, ao continuar, repete a frase em que parou. MP3 pausa e continua normalmente.

## 10.5 Manifesto e marcadores

```js
journey1: {
  voice: 'female',
  segments: [{
    id: 'semestre-1', audio: 'audio/narration/03-semestre-1.mp3',
    text: 'Tudo começa… você desenvolve raciocínio lógico, conhece os fundamentos da internet…',
    markers: [
      { word: 'raciocínio lógico', action: 'highlight', target: 'Algoritmos' },
      { word: 'primeira estrutura digital', action: 'unlock', label: 'Pensar como quem cria' },
    ],
  }],
},
```

- O marcador é ligado a uma **palavra do texto**, não a um segundo fixo: funciona igual com MP3 (pelo instante exato da palavra em `narration-timing.js`; num MP3 gravado por pessoa, proporcional à duração), com a voz do navegador (eventos de palavra ou tempo) e sem voz. Para um MP3 com ritmo irregular, acrescente `time: 6.2` (segundos).
- `highlight`: acende tudo na cena cujo `data-mark` contém o alvo (disciplinas, peças do produto, carreiras, itens de "criar" e da Fatec). Sem `if` por cena: os `data-mark` são postos ao montar cada cena em `tv.js`.
- `unlock`: selo "COMPETÊNCIA DESBLOQUEADA ✓" + efeito `unlock`.
- Nova ação: acrescente uma função em `MARK` (`tv.js`) e use o nome no manifesto.

## 10.6 Autoplay

O Chrome e o Edge só tocam som depois de um gesto na página. Duas camadas:

1. `abrir-telas.ps1` abre a TV com `--autoplay-policy=no-user-gesture-required` → som liberado sem clique (testado: `AUDIO_READY` direto).
2. Aberta de outro jeito, a TV mostra **"ATIVAR ÁUDIO E INICIAR EVENTO"**. Um clique ou qualquer tecla libera (a primeira tecla só libera; não inicia a demonstração). O botão só aparece na tela do QR Code, nunca por cima de uma apresentação. O painel mostra "Som da TV: bloqueado".

## 10.7 Fallbacks (nada trava a apresentação)

| Falta / falha | Resultado |
|---|---|
| MP3 de narração | voz do navegador do mesmo tipo (F/M) |
| MP3 dá erro ao tocar | voz do navegador a partir daquele trecho |
| voz do navegador | outra voz → modo silencioso (legenda + destaques no tempo de `STEPS`) |
| música / efeitos | sintetizados, ou silêncio (`synthMusic`, `synthSfx`) |
| Web Audio inexistente | `<audio>` direto, sem efeitos |
| narração travada | guarda avança a cena |

## 10.8 Controles

| Onde | Mudo | Legenda | Narração |
|---|---|---|---|
| Teclado na TV | M | L | N |
| Painel `/operador` | Desligar/Ligar som | Legenda | Narração |
| Padrão | — | `config.captions` (a escolha da tecla L fica salva no navegador da TV) | `config.narration` |

Desligar a narração no meio de uma fala: a cena volta a contar pelo tempo de `STEPS`. Ligar: vale a partir da próxima cena.
Chamada na espera: a cada `idleCallEvery` segundos (90) a TV fala "Quer descobrir…" para quem passa (só com som liberado e ligado).

## 10.9 Acessibilidade

Legenda com o mesmo texto do manifesto, contraste alto (fundo quase opaco, 26 px); `prefers-reduced-motion` respeitado (os destaques são estado, não animação); a apresentação funciona sem áudio; botão de ativar com foco visível e acionável por teclado; mudo a um toque.
