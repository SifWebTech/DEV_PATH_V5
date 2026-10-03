# 5. JavaScript do servidor (Node.js)

O servidor roda **no notebook**, com o Node.js. Ele:
- entrega as páginas (`index.html`, `m.html`, `admin.html`) e seus arquivos;
- recebe cadastros, reações e comandos;
- controla a fila e avisa a TV, os celulares e o painel em tempo real;
- grava tudo em `data/`.

**Não usa nenhuma biblioteca externa**, só módulos que já vêm com o Node (`http`, `fs`, `path`, `os`, `crypto`). Por isso não precisa de `npm install` nem de internet.

## 5.1 Como os módulos se encaixam

```
server.js  (ponto de partida)
   │
   ├── server/config.js   ← não depende de ninguém
   ├── server/util.js     ← config
   ├── server/store.js    ← config
   ├── server/funil.js    ← store, util, config
   ├── server/sessao.js   ← store, funil, util, config
   ├── server/leads.js    ← store, funil, sessao, util, config
   ├── server/auth.js     ← config, util
   └── server/http.js     ← sessao, leads, funil, store, auth, util, config
```
Cada camada só usa as de baixo, e não existe dependência circular (A precisa de B que precisa de A). Isso deixa claro onde cada coisa mora e torna o código mais fácil de testar.

### `require` e `module.exports`
```js
// em util.js
module.exports = { stamp, today, slug, ... };   // o que este arquivo oferece

// em outro arquivo
const { stamp } = require('./util');            // pega só o que precisa
```
- `require('./util')` carrega o arquivo `util.js` da mesma pasta (o `.js` é opcional). Sem o `./`, como em `require('fs')`, é um módulo do próprio Node.
- O Node executa cada arquivo **uma vez só**, na primeira vez que é pedido, e guarda o resultado. Todo mundo que faz `require('./sessao')` recebe **o mesmo** objeto, com a mesma fila. É isso que permite `http.js` e `leads.js` mexerem na mesma fila.
- `const { a, b } = objeto` é a *desestruturação*: cria as variáveis `a` e `b` com as propriedades de mesmo nome.

---

## 5.2 `server.js` — linha a linha

### Linhas 1–26: comentário de cabeçalho
Explica como iniciar, as variáveis de ambiente e o fluxo dos 5 passos (cadastro → começar → TV começa → cenas → crachá). É a "porta de entrada" para quem abre o projeto pela primeira vez.

### Linha 27
```js
'use strict';
```
Modo rigoroso (ver [04-js-navegador.md](04-js-navegador.md#use-strict)).

### Linhas 29–36: carregar módulos
```js
const http = require('http');                 // criar o servidor web
const fs = require('fs');                     // ler e gravar arquivos (file system)
const config = require('./server/config');
const store = require('./server/store');
const funil = require('./server/funil');
const sessao = require('./server/sessao');
const routes = require('./server/http');
const { lanAddress } = require('./server/util');
```
Ao carregar o `store.js`, ele já cria a pasta `data/` (linha 17 dele), antes de qualquer outra coisa tentar gravar.

### Linhas 38–40: preparar os dados — **a ordem é obrigatória**
```js
store.initCsv();   // 1
funil.init();      // 2
sessao.restore();  // 3
```
1. **`initCsv`** garante que `leads.csv` existe e está no formato da V5 (se for uma planilha da V4, faz backup e acrescenta a coluna `evento`).
2. **`funil.init`** carrega o histórico de eventos. Na primeira execução da V5 (sem `eventos.jsonl`), **lê os leads da planilha** para importá-los no funil como "Antes da V5" — por isso precisa vir **depois** do passo 1, com a planilha já no formato certo.
3. **`sessao.restore`** recupera a fila e quem estava na TV do `estado.json`, mas **só** os leads que ainda estão na planilha (um lead excluído não volta). Também conta os cadastros de hoje a partir da planilha.

Tudo isso acontece **antes** de o servidor começar a aceitar conexões: nenhum celular consegue chegar antes de a fila estar restaurada.

### Linha 42
```js
const server = http.createServer(routes.handle);
```
Cria o servidor e diz: "para **cada** pedido que chegar, chame `routes.handle(req, res)`". `req` (*request*) é o pedido; `res` (*response*) é onde escrevemos a resposta. O servidor ainda **não** está ouvindo nenhuma porta.

### Linhas 45–58: abrir a porta, pulando as ocupadas
```js
let port = config.PORT;     // 8787
let tries = 0;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && !config.FIXED_PORT && tries < 20) {
    console.log(`  Porta ${port} ocupada por outro programa, tentando ${port + 1}...`);
    tries += 1;
    port += 1;
    server.listen(port, '::');
  } else {
    console.error(`\n  Não foi possível abrir a porta ...`);
    process.exit(1);
  }
});
server.listen(port, '::');
```
- **Porta** é como o "número do apartamento" num prédio (o computador): o mesmo computador tem vários programas ouvindo, cada um numa porta.
- `server.on('error', ...)` é registrado **antes** de `server.listen`: se o `listen` falhar, o tratador já precisa existir.
- `EADDRINUSE` = "endereço em uso": outro programa já está nessa porta. Tenta a próxima (8788, 8789...) até 20 vezes.
- Se a porta foi fixada pelo usuário (`set PORT=9000`, `FIXED_PORT`), **não** pula: ele pediu aquela porta, então mostra o erro.
- `process.exit(1)` encerra o programa com código 1 (erro).
- `'::'` = ouvir em **todos** os endereços, IPv4 e IPv6 juntos. Ouvir só em IPv4 deixaria passar despercebido um programa ocupando a mesma porta em IPv6 (o caso do AdGuard Home na porta 3000, citado no código).

### Linhas 60–70: quando a porta abriu
```js
server.on('listening', () => {
  routes.setPort(port);                              // http.js precisa saber a porta para montar o endereço do QR
  fs.writeFileSync(config.PORT_FILE, String(port));  // grava data/.porta — o abrir-telas.ps1 está esperando por esse arquivo
  console.log(...);                                  // mostra endereços e senha na janela preta
  if (lanAddress() === 'localhost') console.log('  ⚠ Nenhuma rede Wi-Fi encontrada...');
});
```
A gravação do `.porta` é a "ponte" entre o Node e o PowerShell: o `.ps1` não sabe em que porta o servidor abriu (pode ter sido 8788 se a 8787 estava ocupada) e descobre lendo esse arquivo. Ver [07-bat-ps1.md](07-bat-ps1.md).

`writeFileSync` (síncrono, espera terminar) é usado de propósito: é uma gravação minúscula, feita uma vez, e precisa estar pronta antes de qualquer outra coisa.

---

## 5.3 `server/config.js` — as opções

```js
const ROOT = path.join(__dirname, '..');
```
`__dirname` é a pasta do arquivo atual (`server/`); `..` sobe uma: a raiz do projeto. `path.join` monta caminhos com a barra certa do sistema (`\` no Windows).

```js
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
```
`process.env` são as **variáveis de ambiente** (configurações passadas por fora, com `set NOME=valor` no Windows). Se `DATA_DIR` existe, usa essa pasta (ótimo para testar sem mexer nos leads reais); senão, `data/`.

| Opção | Padrão | Como mudar | Para quê |
|---|---|---|---|
| `PORT` | 8787 | `set PORT=9000` | porta (8787 porque a 3000 vive ocupada) |
| `FIXED_PORT` | `false` | (automático) | `true` quando `PORT` foi definido → não pula para outra |
| `ADMIN_KEY` | `fatec` | `set ADMIN_KEY=outra` | senha do painel |
| `PUBLIC_URL` | vazio | `set PUBLIC_URL=http://...` | força o endereço do QR (notebook com várias redes) |
| `EVENTO` | vazio | `set EVENTO=Feira X` | nome do evento (também dá para trocar no painel) |
| `EVENTO_LEGADO` | `Antes da V5` | no código | nome dado aos leads antigos sem evento |
| `VESTIBULAR_URL` | site do vestibular | no código | base do link com UTM |
| `INTERESTS` | 4 perfis | no código | precisa bater com `content.js` |
| `REACTIONS` | 4 emojis | no código | precisa bater com `m.html` |

`!!process.env.PORT` — o duplo `!` transforma qualquer valor em `true`/`false`.
`Number(process.env.PORT) || 8787` — se não for um número válido, usa 8787.

---

## 5.4 `server/util.js` — ferramentas pequenas

| Função | O que faz | Detalhe |
|---|---|---|
| `stamp()` | `"2026-10-03 14:05:09"` | usa a hora **local** do notebook (não UTC, que daria 3 h a mais). `padStart(2, '0')` põe o zero à esquerda (`5` → `05`) |
| `today()` | `"2026-10-03"` | os 10 primeiros caracteres do `stamp` |
| `slug(s)` | `"Feira de Profissões 2026"` → `"feira-de-profissoes-2026"` | minúsculas, tira acentos (`normalize('NFD')` + remove os sinais `̀–ͯ`), troca tudo que não é letra/número por `-` e tira `-` das pontas. Se sobrar vazio, `"estande"` |
| `vestibularUrl(meio, evento)` | link com `utm_source=devpath&utm_medium=tv\|celular&utm_campaign=<slug>` | usa a classe `URL`, que cuida dos `?`, `&` e caracteres especiais sozinha |
| `firstName(nome)` | primeiro nome | |
| `lanAddress()` | o IP do notebook na rede (ex.: `192.168.0.15`) | lista as placas de rede, fica com IPv4 que não é interna e **prefere** `192.168.*` (Wi-Fi doméstico/hotspot), depois `10.*`, depois `172.*`. Sem rede: `localhost` |
| `MIME` | extensão → tipo do conteúdo | o navegador precisa saber se o arquivo é HTML, CSS, JS, fonte... |
| `send(res, status, body, headers)` | responde | se `body` é objeto, envia JSON; senão, texto. Sempre `Cache-Control: no-store` (respostas da API nunca são guardadas) |
| `readBody(req)` | lê o corpo de um POST e transforma JSON em objeto | o corpo chega em **pedaços** (`data`), juntados até o fim (`end`). **Limite de 4 KB**: se passar, rejeita e corta a conexão (proteção contra alguém mandando dados gigantes) |
| `parseCookies(req)` | `"a=1; b=2"` → `{ a: '1', b: '2' }` | usado pelo login |

---

## 5.5 `server/store.js` — os arquivos de `data/`

### Linhas 13–17
```js
const BOM = '﻿';   // no arquivo aparece como um caractere invisível
const CSV_HEADER = ['data_hora', 'nome', 'contato', 'tipo_contato', 'interesse', 'consentimento', 'id', 'evento'];
const ID_COL = CSV_HEADER.indexOf('id');   // 6 — calculado, para não quebrar se a ordem mudar
fs.mkdirSync(DATA_DIR, { recursive: true }); // cria data/ (e pastas no caminho); não reclama se já existe
```
O **BOM** (*Byte Order Mark*) é um caractere invisível no início do arquivo que avisa ao **Excel**: "isto é UTF-8". Sem ele, o Excel abre "João" como "JoÃ£o". Ver [06-dados-json-csv.md](06-dados-json-csv.md).

### `writeAtomic(file, text)` — gravar sem risco de arquivo pela metade
```js
const tmp = file + '.tmp';
fs.writeFileSync(tmp, text);                 // 1. grava tudo num arquivo temporário
try { fs.renameSync(tmp, file); }            // 2. troca o nome (operação instantânea)
catch { fs.writeFileSync(file, text); fs.rmSync(tmp, { force: true }); }  // plano B
```
Se a energia cair no meio da gravação, quem fica pela metade é o `.tmp`; o arquivo original continua inteiro. Renomear é praticamente instantâneo. O plano B existe porque no Windows o `rename` pode falhar se outro programa (ex.: o Excel com a planilha aberta) estiver segurando o arquivo.

### `csvCell(v)` — proteção contra "injeção de fórmula"
```js
let s = String(v ?? '').replace(/[\r\n;]+/g, ' ').trim();  // tira quebras de linha e ; (quebrariam as colunas)
if (/^[=+\-@\t]/.test(s)) s = "'" + s;                      // começa com = + - @ ? prefixa com '
return s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;  // aspas viram "" e o valor vai entre aspas
```
Se alguém se cadastrar com o nome `=HYPERLINK("http://site-malicioso")`, o Excel executaria isso como **fórmula** ao abrir a planilha. O apóstrofo na frente faz o Excel tratar como texto. É por isso também que Instagram e WhatsApp são gravados como `instagram.com/perfil` e `wa.me/55...` (sem `@` ou `+` no começo).
`uncell` faz o caminho inverso na leitura.

### `initCsv()` — preparar a planilha
- Se não existe: cria com BOM + cabeçalho.
- Se o cabeçalho já é o da V5: não faz nada.
- Se é a planilha da V4: copia para `leads-backup-v4.csv` (só se a cópia ainda não existir, para nunca sobrescrever o backup) e troca **só** a primeira linha.

### Leads
| Função | O que faz |
|---|---|
| `appendLead(lead, contactCell)` | acrescenta uma linha no fim (`appendFileSync`) — rápido, não reescreve o arquivo |
| `readLeads()` | lê todas as linhas (pula o cabeçalho com `slice(1)` e linhas vazias com `filter(Boolean)`), separa por `;` e monta objetos. Lead sem evento recebe "Antes da V5" |
| `csvText(rows)` | monta o texto de um CSV (para o download filtrado do painel) |
| `deleteLead(id)` | reescreve a planilha **sem** a linha daquele id (com `writeAtomic`). Retorna `false` se não achou |

### Eventos do funil (`eventos.jsonl`)
- `readEvents()` — lê linha por linha; cada linha é um JSON. Uma linha corrompida (queda de energia no meio da gravação) é **ignorada** em vez de travar tudo (`try/catch` dentro do `flatMap`: devolve `[objeto]` ou `[]`).
- `appendEvents(list)` — acrescenta linhas no fim.

### Estado (`estado.json`)
- `loadState()` — lê; se não existir ou estiver corrompido, `null`.
- `saveState(getState)` — **espera 150 ms** antes de gravar e, se outro pedido de gravação chegar nesse meio-tempo, cancela o anterior (`clearTimeout`). Se 10 coisas mudarem em sequência, grava **uma** vez (*debounce*). Recebe uma **função** (`getState`) e não os dados, para pegar o estado mais atual no momento em que de fato grava.

---

## 5.6 `server/funil.js` — métricas de marketing

### As etapas
```js
const ETAPAS = [
  { tipo: 'qr_aberto', nome: 'Abriu pelo QR Code', chave: 'visitante' },
  { tipo: 'form_inicio', nome: 'Começou o cadastro', chave: 'visitante' },
  { tipo: 'lead', nome: 'Cadastrou', chave: 'lead' },
  { tipo: 'inicio', nome: 'Tocou em Começar', chave: 'lead' },
  { tipo: 'concluido', nome: 'Assistiu até o crachá', chave: 'lead' },
  { tipo: 'compartilhou', nome: 'Salvou o crachá', chave: 'lead' },
  { tipo: 'vestibular_clique', nome: 'Abriu o vestibular', chave: 'lead' },
];
```
A **ordem do array é a ordem do funil**, e é assim que o painel desenha. `chave` diz como contar **pessoas** e não cliques: antes do cadastro, a pessoa é identificada pelo id do aparelho (`visitante`); depois, pelo id do lead.

`DO_CELULAR = ['qr_aberto', 'form_inicio', 'compartilhou']` — os **únicos** eventos que o celular pode mandar. Os outros (`lead`, `inicio`, `concluido`...) só o servidor registra, então ninguém consegue inflar os números de "cadastros" mandando requisições falsas.

### `init()`
Carrega os eventos do arquivo. Se o arquivo não existe (primeira vez na V5), cria eventos `lead` para cada lead da planilha, marcados com `importado: true`. Preenche o conjunto `seen`.

### `track(tipo, evento, dados)`
Cria `{ quando, tipo, evento, ...dados }`, guarda na memória e no arquivo. Para `qr_aberto` e `form_inicio`, se o mesmo visitante já tem esse evento naquele evento, **ignora** (quem recarrega a página 5 vezes conta uma). O `seen` é um `Set` (conjunto sem repetição) com chaves `"evento|tipo|visitante"` — consultar um `Set` é instantâneo, mesmo com milhares de eventos.

### `resumo(evento)`
Calcula tudo o que o painel mostra, filtrando pelo evento escolhido:
- **funil**: para cada etapa, quantas **pessoas diferentes** (um `Set` de ids) têm aquele tipo de evento;
- **interesses**: contagem por perfil;
- **porHora**: `quando.slice(11, 13)` pega a hora de `"2026-10-03 14:05:09"` → `"14"`;
- **cenas**: reações agrupadas por cena, ordenadas pela ordem da apresentação;
- **interrompidos**: apresentações encerradas antes do fim;
- **eventos**: a lista de todos os eventos já registrados, com o número de cadastros de cada um (para o seletor do painel).

Os eventos guardam só ids aleatórios, **nunca nome ou contato**. Por isso as métricas continuam válidas mesmo depois de um lead pedir exclusão (LGPD).

---

## 5.7 `server/sessao.js` — fila, TV e tempo real

### O estado em memória
```js
const leads = new Map();        // id → dados do lead (só desta sessão)
const queue = [];               // ids esperando a TV, em ordem
let current = null;             // id de quem está na TV
let eventoManual = '';          // nome do evento definido no painel
const tvClients = new Set();    // conexões SSE abertas pelas TVs
const phoneClients = new Map(); // id do lead → conexões SSE dos celulares dele
const opClients = new Set();    // conexões SSE dos painéis
let tvScene = null;             // cena que a TV está mostrando
let todayCount = 0;             // cadastros de hoje
```
`Map` é um dicionário (chave → valor) e `Set` uma coleção sem repetição. `phoneClients` guarda um **conjunto** por lead porque a mesma pessoa pode estar com a página aberta em duas abas.

### `evento()` — o nome do evento atual
Prioridade: o do painel → o da variável `EVENTO` → `"Estande 03/10/2026"` (data de hoje).

### `persist()` e `restore()`
- `persist()` grava (com o atraso de 150 ms do `store.saveState`) evento, quem está na TV, fila e leads da sessão. É chamado **depois de toda mudança**.
- `restore()` faz o inverso ao iniciar o servidor (ver 5.2).

### SSE: como o servidor "empurra" mensagens
```js
function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
```
O formato do SSE é texto puro: uma linha `event:` com o nome, uma linha `data:` com o conteúdo e **uma linha em branco** para terminar a mensagem (por isso o `\n\n`). A resposta HTTP nunca é finalizada (`res.end()` não é chamado), então a conexão fica aberta e dá para continuar escrevendo.
- `toTV` — manda para todas as TVs conectadas;
- `toPhone(id)` — para os celulares de um lead;
- `toOp` — para os painéis.

`publicLead(l)` devolve só `{ id, name, interest }` — a TV **nunca** recebe o contato do visitante.

### `phoneStatus(id)` — em que situação está um celular
`playing` (na TV), `queued` (na fila, com a posição e se a TV está ligada), `done` (já assistiu) ou `ready` (cadastrado, ainda não tocou em Começar).

### `advance()` — a regra da fila (o coração do sistema)
```js
function advance() {
  if (current || !queue.length || !tvClients.size) return broadcastQueue();
  current = queue.shift();
  persist();
  toTV('start', publicLead(leads.get(current)));
  toPhone(current, 'status', phoneStatus(current));
  broadcastQueue();
}
```
"Se a TV está livre, há alguém esperando e existe uma TV conectada: tire o primeiro da fila (`shift`), salve, mande a TV começar, avise o celular dele que está ao vivo e atualize as posições dos demais." Caso contrário, só atualiza as posições.
A ordem é importante: **salva antes de avisar**, para que, se o servidor cair logo depois, ele volte sabendo quem estava na TV.

É chamada sempre que algo pode liberar a TV: alguém entrou na fila, a TV terminou, a TV (re)conectou.

### `finishCurrent(completo)`
Marca o lead como `done`, registra `concluido` ou `interrompido` no funil, avisa o celular (`done` → mostra o crachá), libera a TV, salva e chama `advance()` para o próximo.

### Outras ações
| Função | Quando | O que faz |
|---|---|---|
| `addLead(lead)` | novo cadastro | guarda, soma em `todayCount`, avisa a TV (feed "acabou de se conectar") e o painel |
| `start(id)` | tocou em Começar | se não está na fila nem na TV, entra no **fim** da fila e registra `inicio`; depois `advance()` |
| `forget(id)` | exclusão LGPD | tira da sessão e da fila; se estava na TV, manda a TV parar; avisa o celular (`unknown`); recalcula `todayCount` |
| `setEvento(nome)` | painel renomeou | limpa espaços, corta em 60 caracteres, salva e manda à TV o novo link do vestibular |
| `setScene(scene)` | TV trocou de cena | guarda e repassa ao celular de quem está assistindo |

### O `module.exports` com *getters*
```js
get current() { return current; },
```
`current`, `tvScene` e `todayCount` são variáveis que **mudam de valor** (`let`). Se fossem exportadas diretamente, quem importou guardaria o valor do momento da importação, para sempre. Com `get`, cada leitura de `sessao.current` busca o valor **atual**. Já `leads`, `queue` e os `Set`/`Map` podem ser exportados direto porque o objeto é sempre o mesmo (só o conteúdo muda).

---

## 5.8 `server/leads.js` — cadastro e LGPD

### `normalizePhone(raw)`
```js
let d = String(raw || '').replace(/\D/g, '');          // só os dígitos: "(17) 99999-0000" → "17999990000"
if (d.length >= 12 && d.startsWith('55')) d = d.slice(2); // tira o código do Brasil, se veio
return /^[1-9]{2}9?\d{8}$/.test(d) ? '55' + d : null;    // DDD + (9 opcional) + 8 dígitos
```
A expressão regular: `[1-9]{2}` = DDD com dois dígitos de 1 a 9; `9?` = o nono dígito opcional (aceita fixo e celular); `\d{8}` = oito dígitos. Sempre devolve com `55` na frente, o formato do `wa.me`.

### `validateLead(b)` — validação no servidor
| Campo | Regra | Mensagem |
|---|---|---|
| nome | junta espaços repetidos; 2 a 40 caracteres | "Digite seu nome (2 a 40 letras)." |
| e-mail | `algo@algo.xx` e até 80 caracteres | "Digite um e-mail válido." |
| Instagram | `@` opcional + 2 a 30 letras, números, `.` ou `_`; sempre gravado com `@` | "Digite seu @ do Instagram." |
| WhatsApp | `normalizePhone` | "Digite o WhatsApp com DDD..." |
| interesse | um dos 4 de `INTERESTS` | "Escolha o que mais chama sua atenção." |
| consentimento | **exatamente** `true` | "Precisamos da sua autorização..." |

Se a página antiga (V4) não mandar o tipo de contato, deduz: tem `@` no meio → e-mail; senão → Instagram.
**Por que validar de novo no servidor**, se o celular já tem o formulário? Porque qualquer pessoa pode mandar um POST direto para `/api/lead` sem usar a página. A validação do servidor é a que vale.

### `contactCell(lead)`
Instagram vira `instagram.com/perfil` e WhatsApp `wa.me/5517...` na planilha: links clicáveis e sem `@`/`+` no começo (que o Excel trataria como fórmula).

### `create(body)` — a sequência de um cadastro
1. valida (se houver erro, devolve os erros e para);
2. gera o id com `crypto.randomUUID()` — 122 bits aleatórios, impossível de adivinhar (o id funciona como "senha" do celular para começar, reagir e excluir);
3. carimba data/hora e evento;
4. aceita o id do visitante só se tiver o formato esperado (`VISITOR_RE`: 8 a 40 letras, números ou hífen);
5. **grava na planilha** (primeiro o dado mais importante);
6. registra `lead` no funil (sem nome/contato);
7. coloca na sessão (avisa TV e painel).

### `remove(id, quem)`
Apaga da planilha; se não achou, `false`. Depois tira da sessão e registra `lead_excluido` no funil com quem pediu (`visitante` ou `operador`) — o funil fica só com o id anônimo.

---

## 5.9 `server/auth.js` — login do painel

```js
const COOKIE = 'devpath_op';
const VALIDADE = 12 * 60 * 60 * 1000;   // 12 horas em milissegundos
const sessions = new Map();             // token → quando expira
const failures = new Map();             // IP → { n: tentativas, ate: até quando conta }
```

### Comparação segura da senha
```js
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sameKey = (a) => crypto.timingSafeEqual(hash(a), hash(ADMIN_KEY));
```
Uma comparação comum (`a === b`) para no **primeiro** caractere diferente, então senhas "quase certas" demoram um pouquinho mais para serem recusadas — medindo o tempo, dá para descobrir a senha letra por letra (*ataque de tempo*). `timingSafeEqual` sempre leva o mesmo tempo. Como ela exige dois valores do **mesmo tamanho**, as duas senhas passam antes pelo SHA-256 (que sempre gera 32 bytes).

### `login(key, ip)`
1. 5 erros seguidos do mesmo IP → bloqueado por 1 minuto (resposta 429, "muitas tentativas").
2. Senha errada → soma uma falha (401).
3. Senha certa → limpa as falhas, cria um **token** aleatório de 24 bytes (48 caracteres hexadecimais) e devolve o cookie:
```
devpath_op=<token>; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200
```
| Atributo | Significado |
|---|---|
| `HttpOnly` | o JavaScript da página **não consegue ler** o cookie (protege contra roubo por script malicioso) |
| `SameSite=Strict` | o navegador só envia o cookie para pedidos feitos **a partir do próprio site** (protege contra outro site mandar comandos ao painel em seu nome) |
| `Path=/` | vale para o site todo |
| `Max-Age=43200` | expira em 12 horas (43.200 segundos) |

Na V4 a senha ia na URL (`?key=fatec`) e ficava no histórico do navegador e em qualquer link copiado; o cookie resolve isso.

### `isAuthed(req)` e `logout(req)`
- `isAuthed` lê o cookie, procura o token em `sessions` e confere a validade (apaga se venceu).
- `logout` apaga o token e devolve um cookie vazio com `Max-Age=0` (o navegador apaga).

As sessões ficam **só na memória**: se o servidor reiniciar, o operador precisa entrar de novo (a fila e as métricas, que estão em disco, continuam).

---

## 5.10 `server/http.js` — as rotas

### `handle(req, res)` — a porta de entrada de todo pedido
```js
const url = new URL(req.url, 'http://local');
try {
  if (url.pathname.startsWith('/api/')) await api(req, res, url);
  else if (url.pathname === '/ir/vestibular') goVestibular(res, url);
  else serveStatic(req, res, url);
} catch (err) {
  if (!res.headersSent) send(res, 400, { error: 'Requisição inválida.' });
}
```
- `req.url` vem só com o caminho (`/api/lead?x=1`); o `URL` precisa de um endereço base qualquer (`http://local`) para conseguir separar caminho e parâmetros.
- Ordem: **API → redirecionamento → arquivos**. Tudo que não é API nem o link do vestibular é tratado como arquivo da pasta `public/`.
- O `try/catch` em volta de tudo garante que um JSON malformado ou corpo grande demais vire uma resposta 400, em vez de derrubar o servidor.

### Mapa das rotas da API

| Método | Rota | Quem usa | O que faz | Respostas |
|---|---|---|---|---|
| GET | `/api/info` | `abrir-telas.ps1` | informações básicas (endereço do QR, fila, evento) | 200 |
| GET | `/api/stream?role=tv` | TV | abre o SSE da TV | — |
| GET | `/api/stream?role=phone&id=...` | celular | abre o SSE do celular | — |
| GET | `/api/stream?role=op` | painel | abre o SSE do painel (exige login) | — |
| POST | `/api/lead` | celular | cadastra | 201, 422 |
| POST | `/api/lead/excluir` | celular | exclui o próprio cadastro | 204, 404 |
| POST | `/api/start` | celular | entra na fila | 200, 404 |
| POST | `/api/react` | celular | reação | 204, 400, 429 |
| POST | `/api/evento` | celular | evento do funil (`qr_aberto`, `form_inicio`, `compartilhou`) | 204, 400 |
| POST | `/api/tv/scene` | TV | informa a cena atual | 204 |
| POST | `/api/tv/done` | TV | terminou | 204 |
| POST | `/api/op/login` | painel | entra | 204 (+ cookie), 401, 429 |
| — | `/api/op/logout` | painel | sai | 204 |
| GET | `/api/op/state` | painel | TV, cena, fila | 200 |
| GET | `/api/op/metricas?evento=` | painel | funil | 200 |
| GET | `/api/op/leads?evento=&interesse=` | painel | tabela | 200 |
| GET | `/api/op/leads.csv?evento=&interesse=` | painel | download da planilha | 200 |
| POST | `/api/op/cmd` | painel | comando para a TV | 204, 400, 409 |
| POST | `/api/op/evento` | painel | renomeia o evento | 200 |
| POST | `/api/op/leads/excluir` | painel | exclui um lead | 204, 404 |
| GET | `/ir/vestibular?lead=` | celular | conta o clique e redireciona | 302 |

### Códigos HTTP usados
| Código | Nome | Quando |
|---|---|---|
| 200 | OK | deu certo e há dados na resposta |
| 201 | Created | cadastro criado |
| 204 | No Content | deu certo e não há nada para devolver |
| 302 | Found | redirecionamento (link do vestibular) |
| 400 | Bad Request | dados inválidos |
| 401 | Unauthorized | sem login ou senha errada |
| 403 | Forbidden | tentativa de ler arquivo fora de `public/` |
| 404 | Not Found | rota, arquivo ou lead inexistente |
| 405 | Method Not Allowed | GET numa rota que só aceita POST |
| 409 | Conflict | comando para a TV com a TV desconectada |
| 422 | Unprocessable Entity | cadastro com campos errados (com a lista de erros) |
| 429 | Too Many Requests | muitas tentativas de senha ou reações rápidas demais |

### `openStream()` — abrir o SSE
```js
res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
res.write('retry: 2000\n\n');
```
`text/event-stream` é o tipo que o `EventSource` do navegador espera. `retry: 2000` diz ao navegador para tentar reconectar 2 s depois de uma queda.

Conforme o `role`:
- **TV**: entra em `tvClients`, recebe `hello` e, se alguém já estava na TV (reconexão), recebe `start` de novo. Ao desconectar, sai do conjunto (e limpa a cena se não sobrou TV). Chama `advance()` porque pode haver gente esperando a TV conectar.
- **painel**: sem login, recebe `auth` e a conexão é fechada.
- **celular**: precisa de um id que exista; recebe o `status` atual na hora.
- id desconhecido: recebe `status: unknown` (o celular volta ao formulário).

```js
const ping = setInterval(() => res.write(': ping\n\n'), 20000);
```
A cada 20 s envia um **comentário** (linhas que começam com `:` são ignoradas pelo navegador). Serve para manter a conexão viva: alguns roteadores e o próprio Windows derrubam conexões paradas por muito tempo. `req.on('close', ...)` limpa o intervalo quando a conexão cai.

### Rotas do painel
Todas começam com `/api/op/`. Login e logout ficam **antes** da verificação `isAuthed` (senão seria impossível entrar). Todas as outras exigem o cookie.
`/api/op/cmd` só aceita os 5 comandos conhecidos (lista branca) e responde 409 se não houver TV.
O download do CSV ganha um nome descritivo: `leads-devpath-<evento>-<interesse>-<data>.csv`, com `Content-Disposition: attachment` (o navegador baixa em vez de mostrar).

### Rotas do celular e da TV
- `if (req.method !== 'POST') return send(res, 405, ...)` — depois do bloco do painel, todas as rotas restantes da API são POST.
- `/api/react` — confere o lead e o tipo de reação, aplica o limite de 350 ms, manda à TV o emoji com o **primeiro nome** (nunca o nome completo), registra no funil com a cena atual.
- `/api/tv/scene` — limpa os dados recebidos (`Number(...)`, rótulo cortado em 60 caracteres) antes de repassar ao celular.
- `/api/tv/done` — se havia alguém na TV, `finishCurrent`; se era uma demonstração (ninguém), só `advance()`. `body.completo !== false` trata "não informado" como completo.

### `goVestibular()`
Registra `vestibular_clique` (se o id existe) e responde **302** com o cabeçalho `Location:` apontando para o vestibular com UTM. O navegador do celular segue o redirecionamento sozinho. Assim o clique é contado **sem** que o celular precise fazer nada especial.

### `serveStatic()` — entregar arquivos
```js
const ROUTES = { '/': '/index.html', '/tv': '/index.html', '/m': '/m.html', '/admin': '/admin.html', '/operador': '/admin.html' };
const rel = ROUTES[url.pathname] || decodeURIComponent(url.pathname);
const file = path.normalize(path.join(config.PUBLIC_DIR, rel));
if (!file.startsWith(config.PUBLIC_DIR)) return send(res, 403, 'forbidden');
```
1. Traduz endereços amigáveis (`/m`) para arquivos.
2. Monta o caminho completo e **normaliza** (resolve `..`).
3. **Segurança:** se o caminho final não estiver dentro de `public/`, recusa. Sem isso, um pedido como `/..%2Fdata%2Fleads.csv` (as barras escritas como `%2F`, que o `decodeURIComponent` transforma em `/../data/leads.csv`) leria a planilha de leads (*path traversal*).
4. Lê o arquivo e responde com o tipo certo (`MIME`) e o cache (1 ano para fontes, `no-cache` para o resto — ver [03-fontes-woff2.md](03-fontes-woff2.md#36-como-o-servidor-entrega-o-woff2)).

`fs.readFile` (assíncrono, com função de retorno) é usado aqui em vez de `readFileSync`: enquanto o disco lê o arquivo, o servidor continua atendendo outros pedidos.
