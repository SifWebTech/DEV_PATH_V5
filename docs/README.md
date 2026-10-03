# Documentação técnica do DEV PATH V5

Esta pasta explica **cada arquivo do projeto**: o que faz, comando por comando, e **por que as coisas estão nessa ordem**.
O `README.md` da raiz ensina a *usar* o projeto no estande; aqui o assunto é *como ele funciona por dentro*.

## Ordem de leitura sugerida

| # | Arquivo | Assunto |
|---|---|---|
| 0 | este arquivo | mapa geral, o caminho de uma requisição e um glossário |
| 1 | [01-html.md](01-html.md) | `index.html` (TV), `m.html` (celular), `admin.html` (painel) |
| 2 | [02-css.md](02-css.md) | `base.css`, `tv.css`, `mobile.css`: cascata, tokens, layout e animações |
| 3 | [03-fontes-woff2.md](03-fontes-woff2.md) | o formato WOFF2, `@font-face` e por que as fontes ficam na pasta |
| 4 | [04-js-navegador.md](04-js-navegador.md) | `content.js`, `circuit.js`, `tv.js`, `mobile.js`, script do painel, `qrcode.min.js` |
| 5 | [05-js-servidor.md](05-js-servidor.md) | `server.js` e os módulos de `server/` (Node.js) |
| 6 | [06-dados-json-csv.md](06-dados-json-csv.md) | `package.json`, `estado.json`, `eventos.jsonl`, `leads.csv`, `.porta` |
| 7 | [07-bat-ps1.md](07-bat-ps1.md) | `INICIAR.bat` e `abrir-telas.ps1`, linha a linha |
| 8 | [08-git.md](08-git.md) | como salvar o trabalho com Git e mandar para o GitHub |

## Mapa do projeto

```
DEV_PATH_V5/
├── INICIAR.bat            (7)  duplo clique: liga o servidor e chama o .ps1
├── abrir-telas.ps1        (7)  espera o servidor, abre a TV em tela cheia e o painel
├── package.json           (6)  "carteira de identidade" do projeto Node
├── server.js              (5)  ponto de partida do servidor
├── server/                (5)  módulos do servidor
│   ├── config.js               opções (porta, senha, pastas)
│   ├── util.js                 funções pequenas usadas por todos
│   ├── store.js                lê e grava os arquivos de data/
│   ├── funil.js                eventos e métricas de marketing
│   ├── sessao.js               fila, TV atual e tempo real (SSE)
│   ├── leads.js                cadastro, validação e exclusão (LGPD)
│   ├── auth.js                 login do painel
│   └── http.js                 rotas: decide o que responder para cada URL
├── data/                  (6)  criada sozinha; fica FORA do Git (dados pessoais)
│   ├── leads.csv               cadastros (abre no Excel)
│   ├── eventos.jsonl           funil, uma linha JSON por evento
│   ├── estado.json             fila e TV, para voltar após uma queda
│   └── .porta                  número da porta que o servidor abriu
└── public/                     tudo que o navegador baixa
    ├── index.html         (1)  TV
    ├── m.html             (1)  celular
    ├── admin.html         (1)  painel do operador (CSS e JS embutidos)
    ├── css/               (2)  base.css, tv.css, mobile.css
    ├── js/                (4)  content.js, circuit.js, tv.js, mobile.js
    ├── fonts/             (3)  unbounded.woff2, jetbrains-mono.woff2
    └── vendor/            (4)  qrcode.min.js (biblioteca de terceiros)
```

## As três telas e o servidor

```
   NOTEBOOK                                    CELULAR DO VISITANTE
 ┌──────────────────────────────┐            ┌─────────────────────┐
 │ servidor Node (server.js)    │◀── Wi-Fi ──│ m.html + mobile.js  │
 │   porta 8787                 │──── SSE ──▶│ (cadastro, reações) │
 │                              │            └─────────────────────┘
 │  ▲ SSE + POST    ▲ SSE + GET │
 │  │               │           │
 │ TV (HDMI)     painel         │
 │ index.html    admin.html     │
 │ tv.js         (script        │
 │ circuit.js     embutido)     │
 └──────────────────────────────┘
```

- **HTTP** (`fetch` com `POST`) é o caminho "de ida": o celular, a TV ou o painel **pedem** algo ao servidor.
- **SSE** (*Server-Sent Events*, `EventSource`) é o caminho "de volta": uma conexão que fica aberta e por onde o **servidor empurra** avisos (ex.: "comece a apresentação", "você é o próximo da fila").

## O caminho completo de um visitante (a sequência mais importante)

| Passo | Quem age | O que acontece | Arquivos |
|---|---|---|---|
| 1 | TV | abre `/`, conecta no SSE `role=tv`, recebe `hello` com o endereço do celular e desenha o QR | `tv.js` → `http.js` (`openStream`) |
| 2 | Celular | escaneia o QR e abre `/m`; envia o evento `qr_aberto` | `mobile.js` → `/api/evento` → `funil.js` |
| 3 | Celular | toca no formulário → evento `form_inicio` | `mobile.js` |
| 4 | Celular | envia o cadastro (`POST /api/lead`) | `http.js` → `leads.js` (valida) → `store.js` (grava CSV) → `funil.js` → `sessao.js` |
| 5 | Celular | toca em **Começar** (`POST /api/start`) → entra na fila | `sessao.start` → `advance` |
| 6 | Servidor | se a TV está livre, manda `start` pelo SSE da TV | `sessao.advance` → `toTV('start')` |
| 7 | TV | roda as 14 cenas; a cada cena faz `POST /api/tv/scene` | `tv.js` (`go`, `reportScene`) |
| 8 | Servidor | repassa a cena ao celular (barra "Agora na TV") | `sessao.setScene` → `toPhone('scene')` |
| 9 | Celular | toca nos emojis → `POST /api/react` → a TV mostra o emoji subindo | `http.js` → `toTV('react')` → `tv.js` (`react`) |
| 10 | TV | termina e faz `POST /api/tv/done` | `sessao.finishCurrent` → celular recebe `status: done` |
| 11 | Celular | mostra o crachá, gera o PNG 1080×1920, link do vestibular | `mobile.js` (`showBadge`, `badgeImage`) |
| 12 | Servidor | chama o próximo da fila | `sessao.advance` |

Por que essa ordem? Porque **o servidor é a única fonte da verdade**. O celular nunca fala direto com a TV: ele avisa o servidor, e o servidor decide (fila, quem está na TV) e avisa a TV. Assim, dois celulares tocando "Começar" ao mesmo tempo não brigam pela TV: o servidor coloca um na fila.

## Glossário rápido

| Termo | Significado |
|---|---|
| **HTML** | a estrutura da página (o "esqueleto"): títulos, botões, formulários |
| **CSS** | a aparência (a "roupa"): cores, tamanhos, posições, animações |
| **JavaScript (JS)** | o comportamento (o "cérebro"): reage a cliques, conversa com o servidor, desenha |
| **Node.js** | programa que roda JavaScript **fora** do navegador; aqui ele é o servidor |
| **Servidor** | programa que fica esperando pedidos e responde com páginas e dados |
| **Rota** | um endereço que o servidor entende, ex.: `/api/lead` |
| **API** | o conjunto de rotas que trocam dados (JSON), não páginas |
| **JSON** | formato de texto para dados: `{"nome": "Ana", "idade": 17}` |
| **CSV** | tabela em texto, uma linha por registro, colunas separadas por `;` |
| **SSE** | conexão aberta em que o servidor manda mensagens quando quiser |
| **DOM** | a página já carregada na memória do navegador, que o JS pode alterar |
| **Canvas** | uma "tela de pintura" em que o JS desenha pixel a pixel (fundo de circuito, eletrocardiograma, crachá PNG) |
| **SVG** | desenho vetorial escrito como texto (ícones, QR Code, mapa dos semestres) |
| **Lead** | um contato interessado (o visitante cadastrado) |
| **Funil** | as etapas do marketing, da primeira visita até a ação final (vestibular) |
| **UTM** | parâmetros no link (`utm_source`, `utm_campaign`) que dizem de onde veio a visita |
| **LGPD** | Lei Geral de Proteção de Dados: exige consentimento e direito de excluir |
| **Git** | programa que guarda o histórico de versões do código |
| **Commit** | uma "foto" do projeto salva no histórico do Git, com uma mensagem |
