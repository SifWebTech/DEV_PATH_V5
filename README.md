# DEV PATH V5 — Sistemas para Internet · Fatec Jales

Ação de captação para estande: o visitante escaneia o QR Code na TV, faz o cadastro no próprio celular, toca em **Começar** e a TV apresenta os 6 semestres do curso com o nome dele. No fim, o crachá de futuro tecnólogo aparece na TV e no celular, pronto para os stories.

A V5 mede o estande como uma ação de marketing: cada passo do visitante (abriu o QR, cadastrou, assistiu, salvou o crachá, abriu o vestibular) vira um número no painel do operador.

> **Apresentação do projeto:** [docs/15-documentacao-para-professores.md](docs/15-documentacao-para-professores.md) · **Manual do estande com imagens:** [docs/16-manual-de-uso.md](docs/16-manual-de-uso.md) · **No ar:** https://devpath-uhhd.onrender.com

```
 TV (notebook)                       Celular do visitante
 ┌──────────────────────┐            ┌──────────────────┐
 │ QR Code + headline   │  escaneia  │ 1. nome, contato,│
 │ "Aprenda a criá-la." │ ─────────▶ │    interesse     │
 └──────────────────────┘            │ 2. [ COMEÇAR ]   │
            ▲                        └────────┬─────────┘
            │  servidor local (server.js)     │
            └─────────── inicia ◀─────────────┘
 terminal → gancho → mapa → 6 semestres → criar → carreiras → mercado → Fatec → crachá
                                     celular vira controle de reações 🔥💚🤯🚀
```

## Na nuvem (celular em qualquer rede)

O mesmo código roda num servidor público: o celular do visitante usa o próprio 4G/5G, o notebook da TV usa o Wi-Fi da Fatec, e os dois falam só com o servidor, por HTTPS. O QR vira `https://<seu-endereço>/join/<código>` e a TV abre `https://<seu-endereço>/presentation/FATEC2026/TELAO-01`. Cada telão tem QR, fila e TV próprios; dados no PostgreSQL.

- Configuração: copie `.env.example` (variáveis obrigatórias em produção: `NODE_ENV`, `PUBLIC_BASE_URL`, `SESSION_SECRET`, `ADMIN_KEY`; banco: `DATABASE_URL`).
- No notebook da TV: `INICIAR-NUVEM.bat` (edite o endereço dentro dele).
- Dados de um estande offline para o banco: `DATABASE_URL=… npm run importar`.
- Como funciona: [docs/13-arquitetura-cloud-multirede.md](docs/13-arquitetura-cloud-multirede.md). **Publicar grátis no Render + Neon:** [docs/14-deploy-render.md](docs/14-deploy-render.md) (o `render.yaml` já está pronto).

Sem nenhuma dessas variáveis, tudo funciona como antes no notebook do estande (a seção abaixo).

## Narração, música e efeitos

A TV fala, 100% em português do Brasil: uma **narradora (Francisca)** e um **narrador (Antonio)** se intercalam, com vozes neurais gravadas em MP3 e entonação própria em cada frase; o servidor gera a saudação com o nome do visitante ("Olá, Felipe! Que bom ter você aqui!"), a narração conduz os seis semestres (com a evolução do inglês em todos eles) e cada cena avança quando a fala termina. Enquanto a voz fala, a música de fundo abaixa sozinha (ducking) e os itens citados acendem na tela no instante em que são ditos ("COMPETÊNCIA DESBLOQUEADA ✓" no fim de cada semestre). A legenda mostra o mesmo texto.

| Tecla na TV | Painel `/operador` | Faz |
|---|---|---|
| M | Desligar/Ligar som | mudo |
| L | Legenda | legenda liga/desliga |
| N | Narração | narração liga/desliga (sem voz, cada cena volta a usar o tempo fixo) |

- **Som na TV:** o `INICIAR.bat` abre a TV já com o som liberado. Se a TV mostrar **"ATIVAR ÁUDIO E INICIAR EVENTO"**, clique uma vez nela (ou aperte uma tecla) antes de chamar o público.
- **Volume, textos e música:** `public/js/narration.js` (`config.volume`, `config.music`, `scenes`).
- **Mudou um texto?** Rode `python ferramentas/gerar_narracao.py` (precisa de internet, do ffmpeg e de `python -m pip install edge-tts numpy`): ele regrava só os MP3 que mudaram. Para comparar as três vozes do Brasil: `--amostras`.
- **Música:** `python ferramentas/gerar_musica.py` gera as 9 trilhas originais em `public/audio/music/` (eletrônicas, rock com solo de guitarra e de baixo, rock com solo de bateria e de contrabaixo). Hoje tocam as três com solo de bateria (9, 8 e 7), em sequência e em loop; a lista fica em `config.music`.
- Tudo funciona sem os MP3 (voz do navegador e trilha sintetizada) e sem som nenhum (legenda + tempo fixo).
- Como funciona por dentro: [docs/10-sistema-narracao.md](docs/10-sistema-narracao.md). Roteiro completo: [docs/11-roteiro-narracao.md](docs/11-roteiro-narracao.md).

## Como rodar no estande (notebook + TV pelo HDMI)

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou mais nova). Não precisa de `npm install`.
2. Ligue o cabo HDMI na TV, aperte **Windows + P** e escolha **Estender**.
3. Conecte o notebook e os celulares **na mesma rede Wi-Fi**. Sem Wi-Fi no local? Ative o **hotspot do Windows** no notebook (Configurações → Rede → Hotspot móvel).
4. Dê dois cliques em **`INICIAR.bat`**. Ele abre sozinho:
   - **na TV:** a apresentação em tela cheia, com o QR Code;
   - **no notebook:** o **painel do operador** (`/operador`, senha `fatec`).
5. Na primeira vez, o Windows pergunta se o Node pode usar a rede: marque **Redes privadas** e permita.

A janela preta do servidor mostra o endereço do celular e a senha. Não feche essa janela durante o evento.

A TV abre no **Edge** (ele tem as vozes neurais usadas no "Olá, {nome}"); sem Edge, no Chrome.

Para fechar a apresentação na TV: clique nela e aperte **Alt + F4**. Se ela abrir no notebook em vez da TV, arraste a janela para a TV (ou use **Windows + Shift + →**) e aperte **F**.

### Painel do operador (tela do notebook)

Entre com a senha (padrão **`fatec`**, aparece na janela preta). O painel mostra:

- **TV e fila:** quem está na TV, a cena atual e quem espera. Os botões **Voltar, Pausar, Avançar, Encerrar e Demonstração** comandam a TV pelo servidor, então funcionam mesmo com a janela da TV sem foco. Com o painel em foco, os atalhos de teclado também funcionam (← → espaço Esc Enter).
- **Evento:** dê um nome à ação (ex.: "Feira de Profissões 2026") antes de começar. Cada lead e cada métrica ficam marcados com ele, e dá para comparar eventos diferentes.
- **Funil do estande**, ao vivo:

  | Etapa | Como é medida |
  |---|---|
  | Abriu pelo QR Code | a página do celular abriu (uma vez por aparelho) |
  | Começou o cadastro | tocou no formulário |
  | Cadastrou | enviou o formulário |
  | Tocou em Começar | entrou na fila da TV |
  | Assistiu até o crachá | a apresentação chegou ao fim sem ser encerrada |
  | Salvou o crachá | tocou em "Salvar crachá para os stories" |
  | Abriu o vestibular | tocou no link do vestibular no celular |

  Além disso: taxa de conversão de cada etapa, interesses mais escolhidos, cadastros por hora e **reações por cena** (quais partes da apresentação mais empolgam).
- **Leads:** filtro por evento e por interesse. O botão **Baixar planilha** respeita os filtros, então dá para mandar uma mensagem diferente para quem quer "ter o próprio negócio" e para quem quer "criar aplicativos". O botão **Excluir** atende pedidos de exclusão (LGPD).

### Atalhos direto na janela da TV

| Tecla | Ação |
|---|---|
| Enter | inicia uma demonstração sem celular |
| → / ← | avança / volta cena |
| Espaço | pausa / continua |
| Esc | encerra e volta ao QR Code (chama o próximo da fila) |
| M / L / N | som / legenda / narração |
| F | tela cheia |
| H | mostra a ajuda |

### Ensaiar uma cena específica

`http://localhost:8787/?cena=8&nome=Ana%20Souza&perfil=design&pausar`

`cena` vai de 1 a 14 (1 terminal, 2 gancho, 3 mapa, 4–9 semestres, 10 criar, 11 carreiras, 12 mercado, 13 Fatec, 14 crachá). `perfil` aceita `design`, `logic`, `apps` ou `business`.

## Leads e dados

- Os cadastros ficam em **`data/leads.csv`** (abre direto no Excel, separador `;`, com acentos) ou na tabela `leads` do banco. Colunas: data e hora, nome, contato, tipo de contato, interesse, consentimento, id, evento e e-mail.
- **WhatsApp é obrigatório** (é por ele que vão as mensagens do vestibular) e o **e-mail é opcional**. O WhatsApp vira link clicável na planilha (`wa.me/5517999990000`). Cadastros antigos podem ter e-mail ou Instagram no lugar do WhatsApp.
- O formulário exige consentimento (LGPD) e informa a finalidade. **O próprio visitante pode excluir os dados** pelo celular ("Excluir meus dados"), e o operador também pode, pelo painel.
- `data/eventos.jsonl` guarda o funil: uma linha por evento, só com ids aleatórios (sem nome nem contato). Por isso as métricas continuam valendo mesmo depois de um lead ser excluído.
- `data/estado.json` guarda a fila e quem está na TV. Se o notebook travar ou a janela preta for fechada, rode o `INICIAR.bat` de novo: o servidor volta com a fila e os celulares reconectam sozinhos.
- Nada disso vai para o GitHub (`.gitignore`).
- Planilha da V4: na primeira execução da V5, o servidor adiciona a coluna "evento" e guarda uma cópia da original em `data/leads-backup-v4.csv`. Os leads antigos aparecem no painel como evento "Antes da V5".
- Senha do painel: `set ADMIN_KEY=outrasenha` antes de `node server.js`. A senha não vai mais na URL: o login cria um cookie que vale por 12 horas. Se o servidor reiniciar, é preciso entrar de novo.

### Link do vestibular com UTM

Os links e o QR Code do vestibular levam `?utm_source=devpath&utm_medium=celular|tv&utm_campaign=<nome-do-evento>`. Quem administra o site do vestibular pode ver nas estatísticas dele quantas visitas vieram do estande. Do nosso lado, o painel conta os cliques feitos pelo celular.

### Crachá para os stories

No fim, o botão **Salvar crachá para os stories** gera no próprio celular uma imagem 1080×1920 com nome, perfil e disciplinas, sem precisar de internet. Na rede do estande (http), o celular mostra a imagem para o visitante tocar e segurar para salvar. Em https, abre direto o menu de compartilhar.

## Editar textos

Tudo que aparece na tela está em **`public/js/content.js`**: semestres, disciplinas, traduções para a linguagem do aluno, batimentos do "medidor de paixão", carreiras, setores, diferenciais da Fatec e os 4 perfis do crachá. Com narração, cada cena dura o tempo da fala (a apresentação inteira leva cerca de 4 minutos); as durações em `STEPS`, no topo de `public/js/tv.js`, valem quando a narração está desligada.

Cada semestre mostra **todas** as disciplinas do horário oficial (43 no total, conferidas com o horário de SI do 2º semestre de 2026), no campo `disciplinas`: `[nome oficial, tradução, destaque]`. As três marcadas com `true` ganham a cor do semestre.

## Estrutura

Como cada arquivo funciona por dentro, comando por comando: veja a pasta [`docs/`](docs/README.md).

```
DEV_PATH_V5/
├── INICIAR.bat          duplo clique: servidor + TV em tela cheia + painel
├── INICIAR-NUVEM.bat    duplo clique: TV e painel apontando para o servidor na nuvem
├── .env.example         variáveis para a nuvem (copie para .env; o .env não vai para o Git)
├── render.yaml          publicação no Render (Blueprint); .node-version = Node 24
├── abrir-telas.ps1      detecta a TV (HDMI) e abre cada tela no lugar certo
├── server.js            liga o servidor (Node puro, sem npm install)
├── ferramentas/         gerar_narracao.py (vozes neurais) e gerar_musica.py (trilhas)
├── server/
│   ├── migrations/      tabelas do PostgreSQL (001_cloud.sql)
│   ├── importar.js      leva os arquivos de data/ para o banco
│   ├── config.js        opções (porta, senha, evento, telões, pastas, nuvem)
│   ├── http.js          rotas da API e arquivos estáticos
│   ├── sessao.js        fila, TV e tempo real (SSE); salva em estado.json
│   ├── leads.js         cadastro, validação e exclusão (LGPD)
│   ├── funil.js         eventos e métricas do funil
│   ├── store.js         leitura e gravação em data/
│   ├── auth.js          login do painel do operador
│   └── util.js          utilidades
├── data/                criada no primeiro uso (fora do Git)
│   ├── leads.csv        cadastros (Excel)
│   ├── eventos.jsonl    funil, sem dados pessoais
│   └── estado.json      fila e TV, para voltar depois de uma queda
└── public/
    ├── index.html       TV (palco 1920×1080 que se ajusta a qualquer tela)
    ├── m.html           celular
    ├── admin.html       painel do operador: TV, funil, leads (/operador)
    ├── css/             base.css (cores e fontes), tv.css, mobile.css
    ├── js/              content.js (textos), tv.js, circuit.js (fundo), mobile.js,
    │                    narration.js (falas), narrator.js, audio-engine.js
    ├── audio/           narração (MP3), música e efeitos
    ├── fonts/           Unbounded + JetBrains Mono (offline)
    └── vendor/          gerador de QR Code (offline)
```

Tudo roda **sem internet**: fontes e biblioteca de QR estão na pasta.

## O que mudou da V4 para a V5

| V4 | V5 |
|---|---|
| Cada semestre destacava 3 disciplinas; o resto passava numa faixa pequena no rodapé | Todas as 43 disciplinas aparecem na tela, com nome oficial e tradução |
| Painel mostrava só a lista de leads | Funil completo com conversão por etapa, interesses, cadastros por hora e reações por cena |
| Sem noção de evento | Cada lead e métrica ficam marcados com o evento; dá para comparar ações |
| Crachá só por print da tela | Imagem 1080×1920 para stories gerada no celular |
| Link do vestibular sem rastreio | Link e QR com UTM do evento; cliques contados no painel |
| Contato por e-mail ou Instagram | E-mail, Instagram ou WhatsApp |
| Exclusão de dados só manual, na planilha | Visitante exclui pelo celular; operador exclui pelo painel |
| Senha do painel na URL (`?key=fatec`) | Login com cookie de sessão e limite de tentativas |
| Fila em memória: perdida se o servidor caísse | Fila e TV salvas em disco e recuperadas ao reiniciar |
| `server.js` único com tudo | Servidor dividido em módulos em `server/` |
| Planilha exportada inteira | Exportação filtrada por evento e interesse |

## Histórico: o que mudou da V3 para a V4

| V3 | V4 |
|---|---|
| QR estático; o README admitia que não controlava a TV | Celular inicia a TV de verdade, com fila para vários visitantes |
| Sem captação de leads | Cadastro com nome, e-mail ou Instagram, interesse e consentimento; CSV + painel |
| Código minificado em uma linha (difícil editar) | Código comentado, textos isolados em `content.js` |
| Navegação por cliques, cada semestre era um "slide" | Apresentação automática; um produto real é construído na tela ao longo dos 6 semestres |
| Roxo no 5º semestre, fora da paleta | Paleta neon laranja, verde, azul e branco em tudo |
| Fontes do Google (falham sem internet) | Fontes locais |
| Disciplinas com nomes técnicos | Cada destaque traduzido ("o back-end que faz tudo funcionar") com o nome oficial embaixo |
| — | Medidor de paixão: batimento sobe de 72 para 140 bpm a cada semestre |
| — | Reações do celular aparecem na TV; crachá final no celular para print/stories |

## Problemas comuns

- **O celular não abre a página do QR**: celular e notebook não estão na mesma rede, ou o firewall bloqueou o Node. Rode `INICIAR.bat` de novo e permita o acesso em redes privadas. Redes de visitantes de escolas costumam isolar aparelhos; nesse caso use o hotspot do notebook.
- **A TV mostra "modo demonstração"**: a página foi aberta direto do arquivo, sem o servidor. Abra pelo `INICIAR.bat`.
- **O QR mostra um IP errado** (notebook com várias redes): `set PUBLIC_URL=http://192.168.x.x:8787/m` antes de `node server.js`.
- **Alguém saiu da fila e a TV começou para ninguém**: pressione Esc para chamar o próximo.
- **O painel pede a senha de novo**: o servidor foi reiniciado (o login fica na memória). Entre de novo; a fila e as métricas continuam lá.
- **"Salvou o crachá" parece baixo**: quem tira print em vez de tocar no botão não é contado. Vale incentivar o botão na conversa do estande.
- A oferta curricular vigente deve ser confirmada com a Fatec Jales.
- **Abriu o painel de outro programa (ex.: AdGuard Home) em vez da apresentação**: outro programa ocupa a porta. O DEV PATH usa a 8787 e, se ela estiver ocupada, pula sozinho para a próxima livre (veja a porta na janela preta do servidor). Feche as janelas antigas e rode o `INICIAR.bat` de novo.
