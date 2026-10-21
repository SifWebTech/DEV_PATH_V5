# Áudios do DEV PATH V5

| Pasta | Conteúdo | Como é feito |
|---|---|---|
| `narration/` | 23 MP3 da narração (narradora **Thalita** e narrador **Antonio**, vozes neurais) | `python ferramentas/gerar_narracao.py` |
| `music/` | 9 trilhas originais; tocam as 3 com solo de bateria, em sequência e em loop | `python ferramentas/gerar_musica.py` |
| `sfx/` | vazio: os efeitos são sintetizados pelo navegador | — |

Se algum arquivo faltar, a TV se vira sozinha:

| Falta… | A TV usa… |
|---|---|
| uma narração | a voz do navegador do mesmo tipo (feminina/masculina), lendo o texto do manifesto (`js/narration.js`) |
| a música | uma trilha discreta sintetizada pelo navegador (`synthMusic: true`) |
| um efeito | um efeito curto sintetizado (`synthSfx: true`) |

Para trocar um arquivo, copie o novo com **o nome exato** e recarregue a TV (F5).

## Música: `music/`

| Arquivo | Estilo |
|---|---|
| `opcao-1-synthwave.mp3` | 118 BPM, Dó maior: synthwave moderno, baixo pulsante, melodia com vibrato |
| `opcao-2-future-house.mp3` | 124 BPM, Sol maior: future house, baixo no contratempo, acordes "stab", palmas |
| `opcao-3-electro-pop.mp3` | 128 BPM, Ré maior: electro-pop, acordes sincopados, sinos |
| `opcao-4-rock-guitarra.mp3` | 140 BPM, Mi menor: rock, guitarra distorcida em galope, **solo de guitarra e solo de baixo** |
| `opcao-5-funk-rock.mp3` | 116 BPM, Lá (blues): funk rock, guitarra "chique-chique", baixo com slap, **solo de guitarra e solo de baixo** |
| `opcao-6-pop-punk.mp3` | 160 BPM, Ré maior: pop punk, power chords em colcheias, **solo rápido de guitarra e solo de baixo** |
| `opcao-7-rock-bateria.mp3` | 132 BPM, Lá menor: hard rock, **solo de bateria** (bumbo duplo, tons, rufada) **e solo de contrabaixo** |
| `opcao-8-funk-groove.mp3` | 108 BPM, Mi (blues): funk, **solo de bateria** sincopado **e solo de contrabaixo** com slap |
| `opcao-9-rock-acelerado.mp3` | 172 BPM, Sol maior: rock acelerado, **solo de bateria** em alta **e solo de contrabaixo** |

Opções 4–6: compassos 1–4 guitarra e bateria, 5–16 banda inteira, 17–24 solo de guitarra, 25–28 solo de baixo e 29–32 todo mundo junto.
Opções 7–9: compassos 1–4 guitarra e bateria, 5–12 banda inteira, 13–20 solo de bateria, 21–28 solo de contrabaixo e 29–32 todo mundo junto.

A trilha em uso é `config.music` em `js/narration.js`. Hoje é uma **lista com as três que têm solo de bateria**: cada música toca inteira e passa para a seguinte com 2 s de transição, e depois da última volta à primeira (ordem: 9, 8 e 7). Para tocar uma só, troque a lista por um nome de arquivo. Todas são composições originais geradas por código: não há licença de terceiros.
Para usar uma música de fora, ela precisa ter licença (feita por vocês, domínio público ou banco com licença de uso); música de streaming não pode. Exporte em volume normal: o código controla o volume (`config.volume.music`) e abaixa durante a narração.

## Efeitos: `sfx/`

| Arquivo | Quando toca |
|---|---|
| `start.mp3` | o visitante tocou em Começar |
| `transition.mp3` | troca de cena |
| `unlock.mp3` | "competência desbloqueada" |
| `final.mp3` | entrada da cena final (crachá) |

Curtos (menos de 1,5 s) e discretos.

## Narração: `narration/`

Gerada com vozes neurais gratuitas (as mesmas "Natural" do Microsoft Edge) pelo `ferramentas/gerar_narracao.py`.
Ao mudar um texto em `js/narration.js`, rode o script de novo: ele regrava só o que mudou e atualiza `js/narration-timing.js` (o instante de cada palavra, que sincroniza legenda e destaques).
Para gravar com vozes humanas, substitua os arquivos pelos mesmos nomes; aí a sincronização passa a ser proporcional à duração.

Um arquivo por trecho. O texto de cada um está em `js/narration.js` e, completo, em `docs/11-roteiro-narracao.md`.
São **dois narradores que se intercalam**: uma voz feminina (F) e uma masculina (M). Grave cada arquivo com a voz indicada.

| Arquivo | Voz | Cena | Trecho |
|---|---|---|---|
| `00-espera.mp3` | M | tela do QR Code | "Quer descobrir como uma ideia se transforma em tecnologia?…" |
| `01a-ola-sem-nome.mp3` | F | terminal | "Olá. Seu DEV PATH começa agora." (só quando não dá para dizer o nome) |
| `01-boas-vindas.mp3` | F | terminal | "A partir de agora, você vai percorrer…" |
| `02-interesse-mobile.mp3` | M | gancho | perfil "Criar aplicativos" |
| `02-interesse-web.mp3` | M | gancho | perfil "Criar visuais e interfaces" |
| `02-interesse-dados.mp3` | M | gancho | perfil "Resolver problemas com lógica" |
| `02-interesse-produto.mp3` | M | gancho | perfil "Ter meu próprio negócio" |
| `03-semestre-1.mp3` | F | 1º semestre | "Tudo começa aprendendo a pensar como quem cria…" |
| `04a-transicao-1-2.mp3` | F | 2º semestre | "Agora que você aprendeu a estruturar uma ideia…" |
| `04-semestre-2.mp3` | M | 2º semestre | "Agora a ideia começa a ganhar forma…" |
| `05a-transicao-2-3.mp3` | M | 3º semestre | "A interface já existe…" |
| `05-semestre-3.mp3` | F | 3º semestre | "No terceiro semestre, o sistema começa a ganhar inteligência…" |
| `06a-transicao-3-4.mp3` | F | 4º semestre | "Agora que o sistema funciona…" |
| `06-semestre-4.mp3` | M | 4º semestre | "Chegou a hora de conectar as partes…" |
| `07a-transicao-4-5.mp3` | M | 5º semestre | "A tecnologia já funciona…" |
| `07-semestre-5.mp3` | F | 5º semestre | "No quinto semestre, tecnologia começa a se transformar em produto…" |
| `08a-transicao-5-6.mp3` | F | 6º semestre | "Você já aprendeu a construir as partes…" |
| `08-semestre-6.mp3` | M | 6º semestre | "E no sexto semestre, tudo se conecta…" |
| `09-criar.mp3` | F | o que você vai criar | "E o resultado dessa jornada?…" |
| `10-carreiras.mp3` | M | carreiras | "Esse conhecimento abre diferentes caminhos…" |
| `11-formacao.mp3` | F | Fatec | "Tudo isso em uma formação pública…" |
| `12a-fechamento.mp3` | F | crachá | "Talvez o próximo aplicativo, site ou sistema… seja criado por você." |
| `12b-fechamento.mp3` | M | crachá | "Não apenas use tecnologia. Aprenda a criá-la. Seja Fatec…" |

O "Olá, {nome}." **não tem arquivo**: como não dá para gravar todos os nomes, ele sempre sai pela voz feminina do navegador.
Se só um dos narradores for gravado, tudo bem: os trechos sem MP3 continuam com a voz do navegador do mesmo tipo.

Dicas de gravação: mesma voz, mesmo microfone e mesmo volume em todos; sem música por baixo (a música entra pelo código, com ducking); meio segundo de silêncio no começo e no fim.
Os destaques na tela são sincronizados pela posição das palavras no texto. Se a gravação tiver um ritmo muito diferente, dá para ajustar um marcador com `time` (segundos) no `js/narration.js`.
