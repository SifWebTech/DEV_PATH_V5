# 4. JavaScript do navegador

Arquivos que rodam **no navegador** (TV, celular, painel):

| Arquivo | Linhas | Roda em | Papel |
|---|---|---|---|
| `public/js/content.js` | 198 | TV, celular, painel | **só dados**: todos os textos, semestres, disciplinas, perfis |
| `public/js/circuit.js` | 137 | TV | fundo animado de circuito |
| `public/js/tv.js` | 785 | TV | a apresentação: cenas, linha do tempo, conexão com o servidor |
| `public/js/mobile.js` | 406 | celular | cadastro, botão começar, reações, crachá PNG, exclusão |
| `<script>` do `admin.html` | ~195 | painel | login, controles da TV, métricas, leads |
| `public/vendor/qrcode.min.js` | 1 (minificado) | TV | biblioteca de terceiros que gera QR Codes |

---

## 4.1 Padrões que se repetem em todos os arquivos

### A função que se executa sozinha (IIFE)
```js
(() => {
  'use strict';
  ...
})();
```
- `() => { ... }` cria uma função; os parênteses em volta e o `()` no fim **executam** essa função na hora.
- **Por quê?** Tudo que é criado dentro (variáveis, funções) fica **preso** ali dentro. Sem isso, uma variável `S` do `tv.js` poderia colidir com outra de mesmo nome em outro script. Só sai o que for colocado de propósito em `window` (ex.: `window.circuit`).

### `'use strict'`
Liga o "modo rigoroso" do JS: erros que passariam em silêncio viram erros de verdade (ex.: usar uma variável sem declarar). Ajuda a achar bugs.

### Atalhos `$` e `$$`
```js
const $ = (s, r = document) => r.querySelector(s);        // o primeiro elemento que casa com o seletor
const $$ = (s, r = document) => [...r.querySelectorAll(s)]; // todos, já como array
```
Em vez de escrever `document.querySelector('#stage')` toda vez, escreve-se `$('#stage')`. O segundo parâmetro (`r`) permite procurar dentro de um elemento específico. O `[...]` transforma a lista do navegador num array de verdade (para poder usar `.map`, `.forEach`, `.slice`).

### `esc()`: proteção contra código malicioso (XSS)
```js
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
```
O nome do visitante é colocado dentro do HTML (`innerHTML`). Se alguém se cadastrasse com o nome `<img src=x onerror=alert(1)>`, sem `esc` esse código **rodaria na TV**. A função troca os cinco caracteres perigosos por entidades (`<` vira `&lt;`), então o texto aparece literalmente e nunca vira código. **Regra do projeto:** todo texto que veio de fora (nome, contato, evento) passa por `esc()` antes de ir para o `innerHTML`.
- `s ?? ''`: se `s` for `null` ou `undefined`, usa texto vazio.
- `/[&<>"']/g`: expressão regular "qualquer um destes caracteres", `g` = todas as ocorrências.

### `async` / `await`
```js
const res = await fetch('/api/lead', {...});
```
Algumas operações demoram (falar com o servidor, esperar um tempo). `await` **pausa aquela função** até o resultado chegar, sem travar a página. Só pode ser usado dentro de funções marcadas com `async`.

### `fetch`: pedir algo ao servidor (HTTP)
```js
fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
```
- `method: 'POST'`: enviar dados (o `GET` é para buscar).
- `headers`: avisa que o corpo é JSON.
- `JSON.stringify(objeto)`: transforma o objeto JS em texto JSON para viajar pela rede.

### `EventSource`: ouvir o servidor (SSE)
```js
const es = new EventSource('/api/stream?role=tv');
es.addEventListener('start', (e) => { const lead = JSON.parse(e.data); ... });
```
Abre uma conexão que **fica aberta**. Cada vez que o servidor manda um evento com nome (`start`, `lead`, `react`...), a função correspondente roda. Se a conexão cair, o navegador **reconecta sozinho** (o servidor pede espera de 2 s com `retry: 2000`).

### `requestAnimationFrame`: animação suave
```js
const tick = (now) => { ...desenha...; requestAnimationFrame(tick); };
requestAnimationFrame(tick);
```
Pede ao navegador: "chame esta função antes de pintar o próximo quadro". Roda ~60 vezes por segundo, sincronizado com a tela, e **pausa sozinho** quando a aba não está visível (economiza bateria/CPU). `now` é o tempo em milissegundos, usado para calcular quanto a animação deve andar.

---

## 4.2 `content.js` — os dados editáveis

Não tem lógica: cria um único objeto global com todos os textos.

```js
window.DEVPATH = {
  links: { vestibular: '...', fatec: '...' },
  profiles: { design: {...}, logic: {...}, apps: {...}, business: {...} },
  semesters: [ {...}, ... 6 itens ],
  creations: [ ['site', 'Sites'], ... ],
  careers: [ 'Front-end', ... ],
  sectors: [ 'indústrias', ... ],
  fatec: [ ['Público e gratuito', '...'], ... ],
  axis: { name: '...', text: '...' },
};
```

**Por que separar os textos?** Para quem não programa conseguir editar uma frase ou uma disciplina sem mexer na lógica da apresentação, e para TV, celular e painel usarem **os mesmos** dados (o painel mostra "Criar aplicativos" lendo o mesmo `profiles.apps.label` que o celular mostra no botão).

### `profiles` (os 4 interesses)
```js
design: {
  label: 'Criar visuais e interfaces',      // texto do botão no celular
  role: 'UX/UI & Front-end',                // cargo no crachá
  product: (n) => `Studio ${n}`,            // nome do produto construído na TV
  stack: ['Design Digital', ...],           // 4 disciplinas que aparecem no crachá
  careers: ['UX/UI', 'Front-end', ...],     // carreiras que brilham em verde na cena de órbitas
},
```
`product` é uma **função**: recebe o primeiro nome e devolve o nome do produto. Para "Ana" com perfil `design`, vira "Studio Ana"; com `logic`, "Ana.dev". A sintaxe `` `Studio ${n}` `` (crase) é um *template string*: o `${n}` é trocado pelo valor de `n`.
As chaves (`design`, `logic`, `apps`, `business`) precisam ser as mesmas de `INTERESTS` em `server/config.js`, senão o servidor recusa o cadastro.

### `semesters` (os 6 semestres)
```js
{
  n: 1,                       // número
  color: 'orange',            // cor do semestre (chave do objeto COLOR do tv.js)
  stage: 'Ideia',             // etapa do produto (aparece no mapa e na trilha)
  title: '...', hook: '...',  // título e frase da cena
  bpm: 72,                    // batimentos do "medidor de paixão" (sobe até 140)
  mood: 'curiosidade',        // palavra ao lado dos bpm
  disciplinas: [
    ['Algoritmos e Lógica de Programação', 'o jeito de pensar por trás de todo app', true],
    ['Bases da Internet', 'como a web funciona por dentro'],
  ],
}
```
Cada disciplina é um array `[nome oficial, tradução, destaque]`. O terceiro valor é opcional: `true` pinta a disciplina com a cor do semestre; sem ele, fica neutra. São 43 disciplinas no total, conferidas com o horário oficial.

---

## 4.3 `circuit.js` — o fundo de circuito

### A ideia
Desenhar 80+ trilhas e centenas de pontos a cada quadro (60 vezes por segundo) seria pesado. Então:
1. as **trilhas e a grade** são desenhadas **uma vez** num canvas invisível (`base`);
2. a cada quadro, copia-se essa imagem pronta (uma operação rápida) e desenham-se **só os pulsos** por cima.

### Linhas 10–16: preparação
```js
const canvas = document.getElementById('circuit');
const ctx = canvas.getContext('2d');                 // o "pincel" 2D do canvas
const COLORS = ['#ff7a1a', '#2bff88', '#22b8ff', '#f3f8ff'];
const GRID = 34;                                     // espaçamento da grade em px
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let W, H, DPR, traces = [], pulses = [], base, energy = 0.15, last = 0;
```
`energy` (0 a 1) controla a quantidade e a velocidade dos pulsos. A TV aumenta a cada semestre.

### Linhas 19–44: `makeTrace()` — inventa uma trilha
1. Escolhe um lado da tela ao acaso (`side` 0 = topo, 1 = direita, 2 = baixo, 3 = esquerda) e um ponto nesse lado.
2. Define a direção inicial **para dentro** da tela.
3. Anda de 4 a 10 segmentos; cada um tem de 2 a 8 casas da grade.
4. Depois de cada segmento, **vira 45°** para um lado ou outro (a tabela `turn` diz, para cada uma das 8 direções, quais são as duas viradas de 45° possíveis). É assim que as trilhas de uma placa de circuito impresso (PCB) são desenhadas: só ângulos de 0°, 45° e 90°.
5. Calcula o comprimento de cada segmento (`Math.hypot` = teorema de Pitágoras) e o total, para os pulsos saberem onde estão.
6. Sorteia uma das 3 primeiras cores (laranja, verde, azul — o branco fica de fora).

### Linhas 46–57: `pointAt(t, dist)`
Dado "quantos pixels já percorri desde o começo da trilha", devolve as coordenadas x,y. Percorre os segmentos somando comprimentos até achar o segmento certo e faz uma **interpolação** (`a + (b - a) * k`, com `k` entre 0 e 1).

### Linhas 59–82: `resize()` — prepara tudo para o tamanho atual da tela
```js
DPR = Math.min(devicePixelRatio || 1, 2);
canvas.width = W * DPR; canvas.height = H * DPR;
```
`devicePixelRatio` é quantos pixels físicos há em cada pixel do CSS (2 numa tela "retina", 1 numa comum). O canvas é criado com a resolução **física**, senão ficaria borrado. Limitado a 2 para não pesar em TVs 4K.

```js
traces = Array.from({ length: Math.round((W * H) / 26000) }, makeTrace);
```
Uma trilha a cada 26.000 px² de tela: numa tela 1920×1080, cerca de 80 trilhas. Tela maior, mais trilhas — a densidade fica igual.

Depois desenha no canvas invisível `base`:
- cada trilha com a cor + `'1c'` (alfa ≈ 11%, bem apagada) — linha 71;
- uma bolinha no fim de cada trilha com alfa `'30'` (≈ 19%) — linha 76;
- os pontos da grade em azul `#22b8ff14` (≈ 8%) — linha 80.

É nesses valores que se ajusta a intensidade de cada parte (ver `PROGRESSO.md`).

### Linhas 84–87: `spawn()` — cria um pulso
```js
pulses.push({ t, d: 0, speed: 150 + Math.random() * 100 + energy * 100, tail: 50 + energy * 50 });
```
Escolhe uma trilha qualquer e solta um pulso no começo (`d: 0`). Velocidade entre 150 e 250 px/s, mais até 100 conforme a energia; cauda de 50 a 100 px. **Esta é a linha 86 alterada e ainda sem commit** (o original era `160 + Math.random() * 220 + energy * 380` e `tail: 70 + energy * 90`).

### Linhas 89–126: `frame(now)` — o laço de animação
A sequência a cada quadro, e por que é nessa ordem:
1. `dt` = segundos desde o quadro anterior, **limitado a 0,05**. Se a aba ficou escondida por 10 s, sem esse limite os pulsos dariam um salto enorme.
2. `setTransform(1,0,0,1,0,0)` + `clearRect` + `drawImage(base)` — volta à escala normal, limpa e cola as trilhas prontas. Precisa ser em escala 1 porque `base` já está na resolução física.
3. `setTransform(DPR,...)` — agora sim liga a escala, para desenhar os pulsos em coordenadas do CSS.
4. `if (Math.random() < (4 + energy * 26) * dt) spawn();` — sorteio que cria, em média, de 4 (repouso) a 30 (energia máxima) pulsos por segundo. Multiplicar por `dt` garante a mesma média com 30 ou 144 quadros por segundo.
5. `globalCompositeOperation = 'lighter'` — onde dois pulsos se cruzam, as cores **somam** e brilham mais, como luz de verdade.
6. Para cada pulso: anda (`p.d += p.speed * dt`, linha 102 — **é isso que faz os pulsos andarem**); se já saiu do fim da trilha, é descartado (`return false` no `filter`). A cauda é desenhada em 8 pedaços, cada um mais transparente (`a = 1 - s/steps`), e cada pedaço duas vezes: uma linha grossa (7 px) e fraca (alfa × 0,22) = o **brilho**; e uma fina (1,8 px) e forte (alfa × 0,9) = o **núcleo**.
7. Restaura a opacidade e o modo de mistura normais (senão afetaria o próximo quadro).
8. Limita a 90 pulsos simultâneos (remove os mais antigos).
9. `requestAnimationFrame(frame)` — agenda o próximo quadro.

### Linhas 128–136: o que fica público e a partida
```js
window.circuit = {
  setEnergy(v) { energy = Math.max(0, Math.min(1, v)); },  // garante 0..1
  burst(n = 40) { for (let i = 0; i < n; i++) spawn(); },  // rajada de pulsos
};
addEventListener('resize', resize);
resize();
if (reduced) { ctx.drawImage(base, 0, 0); return; }        // sem animação: só o desenho parado
requestAnimationFrame((t) => { last = t; frame(t); });
```
A ordem: primeiro expõe a API (o `tv.js` vai chamá-la), depois prepara o tamanho, e só então inicia o laço. O `last = t` no primeiro quadro evita um `dt` gigante.

---

## 4.4 `tv.js` — a apresentação

### Linhas 14–23: preparação
- `const C = window.DEVPATH;` — os textos do `content.js`.
- `wait(ms)` — uma pausa que pode ser usada com `await` (`await wait(500)` espera meio segundo).
- `COLOR` — traduz `'orange'` para o código `#ff7a1a`.

### Linhas 26–36: `STEPS`, a linha do tempo
```js
const STEPS = [
  { type: 'boot', dur: 8, label: 'Inicializando seu futuro' },
  { type: 'hook', dur: 8, ... },
  { type: 'map', dur: 8, ... },
  ...C.semesters.map((s) => ({ type: 'journey', sem: s.n, dur: 15, label: `${s.n}º semestre: ${s.stage}` })),
  { type: 'create', dur: 10, ... },
  { type: 'careers', dur: 10, ... },
  { type: 'market', dur: 8, ... },
  { type: 'fatec', dur: 10, ... },
  { type: 'finale', dur: 18, ... },
];
```
- O `...` (*spread*) "despeja" os 6 itens gerados a partir dos semestres no meio da lista. Resultado: **14 cenas**.
- Duração total: 8+8+8 + 6×15 + 10+10+8+10+18 = **170 s ≈ 2 min 50 s**.
- `label` é o que aparece no celular ("Agora na TV") e no painel.
- **Para mudar a duração de uma cena, mude o `dur`.**

### Linhas 38–51: `S`, o estado da TV
| Campo | Significado |
|---|---|
| `online` | conectada ao servidor? |
| `mobileUrl` | endereço que vai no QR |
| `vestibular` | link do vestibular com UTM do evento |
| `lead` | quem está assistindo (`null` = tela do QR) |
| `i` | índice da cena atual (`-1` = nenhuma) |
| `timer` | o `setTimeout` que vai passar para a próxima cena |
| `paused`, `stepEnds`, `remaining` | para pausar e retomar do ponto certo |
| `token` | **número que muda a cada troca de cena** (ver abaixo) |

### O "token": cancelar animações antigas
Muitas animações são assíncronas (digitam letra por letra com `await wait(...)`). Se o operador avança a cena no meio, a digitação antiga continuaria escrevendo em elementos que já não existem. Solução:
```js
const token = S.token;           // guarda o número no início
...
if (token !== S.token) return;   // a cada passo: se mudou, outra cena começou → para
```
`swapScene` faz `S.token++`, invalidando tudo o que estava rodando.

### Linhas 53–56: dados derivados do visitante
- `firstName()` — "Ana Souza" → "Ana".
- `profile()` — o perfil escolhido; se não houver (demonstração), usa `apps`.
- `productName()` — ex.: "Ana App".
- `domain()` — "Ana App" → "anaapp.com.br": minúsculas, `normalize('NFD')` separa as letras dos acentos ("é" vira "e" + acento) e o `replace` remove os acentos e tudo que não é letra ou número.

### Linhas 59–64: `fit()`, o palco que cabe em qualquer tela
```js
const s = Math.min(innerWidth / 1920, innerHeight / 1080);
stage.style.transform = `translate(-50%, -50%) scale(${s})`;
```
Calcula quanto o palco precisa encolher para caber na largura **e** na altura, e usa o **menor** (senão sobraria para fora num dos lados). Roda ao abrir e sempre que a janela muda de tamanho. Ver a explicação do CSS em [02-css.md](02-css.md#linhas-1326-camadas-e-palco).

### Linhas 67–87: `scramble()`, o efeito "decodificar"
Os títulos aparecem como se estivessem sendo decifrados: símbolos aleatórios (`<>/{}[]#$01=+*_;`) vão virando as letras certas, da esquerda para a direita. Em cada quadro, `p` vai de 0 a 1; as primeiras `p × tamanho` letras já estão certas, e as demais são símbolos sorteados. Elementos com o atributo `data-scramble="300"` recebem o efeito automaticamente, com 300 ms de atraso (`scrambleAll`).

### Linhas 90–114: `swapScene()`, a troca de cena
A sequência:
1. `S.token++` — cancela animações da cena anterior.
2. Todas as cenas ainda visíveis ganham `is-out` (animação de saída) e **perdem seus `id`s** (para que `$('#journey')` encontre a cena nova, não a que está saindo). Depois de 600 ms são removidas.
3. `flash()` — dispara a faixa de luz. O truque `remove('go')` → `void f.offsetWidth` → `add('go')` força o navegador a "reparar" que a classe saiu e voltou, reiniciando a animação.
4. Cria a nova cena a partir do texto HTML, coloca no `#sceneRoot`, ativa os `data-scramble` e chama `mount` (a função opcional que completa a cena, ex.: desenhar o QR).

### As cenas (linhas 121–594)
Cada cena é uma função `renderX()` que monta o HTML com *template strings* e chama `swapScene`.

| Função | Cena | Destaques |
|---|---|---|
| `renderIdle` | QR Code | `circuit.setEnergy(0.12)` (calmo); mostra quem está na fila; `drawQR` gera o QR |
| `qrSvg` | — | usa a biblioteca `qrcode()` para saber quais quadradinhos são pretos e escreve um SVG. Cada módulo vira `M{c} {r}h1v1h-1z` (um quadrado de 1×1). `shape-rendering="crispEdges"` deixa as bordas nítidas, sem suavização — importante para o celular conseguir ler |
| `renderBoot` | 1. terminal | digita linha a linha com `type()`; a linha `bar` conta de 0% a 100% |
| `renderHook` | 2. gancho | palavras flutuando com posições pseudoaleatórias: `(k * 157) % 100` espalha os itens sem sortear (fica igual toda vez) |
| `renderMap` | 3. mapa | SVG com os 6 nós em `x = 160 + k × 320`; o desvio laranja entre o 5º e o 6º é o TG |
| `renderJourney` + `updateJourney` | 4–9. semestres | ver abaixo |
| `renderCreate` | 10. criar | ícones SVG do objeto `ICONS` |
| `renderCareers` | 11. órbitas | 5 carreiras na órbita interna e 7 na externa; as do perfil ganham `mine` (verde) |
| `renderMarket` | 12. mercado | `${row(a)}${row(a)}` — lista duplicada para o letreiro infinito |
| `renderFatec` | 13. Fatec | os 4 diferenciais e o eixo tecnológico |
| `renderFinale` | 14. crachá | iniciais, nome, perfil, disciplinas; o "código de barras" usa o código de cada letra do nome (`charCodeAt % 4`) para a largura das barras — cada nome gera um código diferente, mas sempre o mesmo para o mesmo nome |

### A jornada: uma cena que evolui (linhas 259–433)
Os 6 semestres **não** recriam a cena: `renderJourney` monta tudo uma vez e `updateJourney(n)` só atualiza. Isso permite que o produto na tela **evolua** em vez de reaparecer do zero.

`updateJourney(n)`, na ordem:
1. `--c` = cor do semestre; tudo dentro herda.
2. Trilha do topo: semestres anteriores `done`, atual `on`.
3. Título (com `scramble`), frase, e a lista de todas as disciplinas. O `replace(/ ([IVX]+)$/, ' $1')` troca o espaço antes de "I", "II", "IV"... por um **espaço que não quebra**, para o numeral nunca ficar sozinho na linha de baixo.
4. Medidor de paixão: bpm, humor, largura da barra (`n/6`), velocidade do coração (`60 / bpm` segundos por batida) e cor/bpm do eletrocardiograma.
5. Produto: liga as classes `l1`...`ln` no `#build` (o CSS faz o resto), troca o logo, o texto de boas-vindas e o endereço (`rascunho.html` → `localhost:3000` → `https://anaapp.com.br` → `anaapp.com.br`).
6. `typeCode(n)` — digita no editor o código daquele semestre (HTML no 1º, CSS no 2º, SQL no 3º, Node no 4º, React no 5º, `git push` no 6º). O objeto `CODE` guarda cada trecho como pedaços `[tipo, texto]`; o tipo vira a classe de cor (`k-tag`, `k-str`...).
7. `circuit.setEnergy(0.12 + n * 0.14)` — o fundo fica mais agitado a cada semestre.
8. No 6º: `launch()` — rajada de 70 pulsos, 90 confetes e o contador de "pessoas usando" subindo até 1.284 com desaceleração (`1 - (1-p)³`, rápido no começo e devagar no fim).

### Linhas 436–468: o eletrocardiograma
```js
const bump = (c, w, h) => h * Math.exp(-((ph - c) ** 2) / (2 * w * w));
return bump(0.12, ...) - bump(0.28, ...) + bump(0.31, 0.01, 1) - bump(0.34, ...) + bump(0.55, ...);
```
Cada batida é a soma de 5 "sinos" (curvas gaussianas) nas posições das ondas de um ECG real: P (pequena), Q (desce), **R** (o pico alto), S (desce) e T. `ph` é a fase dentro da batida (0 a 1). A linha anda para a esquerda a 220 px/s e a frequência vem do `bpm` do semestre. O laço para sozinho quando o canvas sai da página (`document.body.contains(cv)`).

### Linhas 599–667: controle da linha do tempo
- `begin(lead)` — guarda o visitante e vai para a cena 0.
- `go(i)` — **a função central**:
  1. cancela o timer anterior;
  2. se passou da última cena, chama `end(true)` (assistiu até o fim);
  3. se é um semestre e a cena anterior também era, só atualiza; senão, desenha a cena;
  4. atualiza o HUD, **avisa o servidor** (`reportScene` → `POST /api/tv/scene`) e agenda a próxima (`schedule`).
- `schedule(ms)` — `setTimeout` para `go(i + 1)` e ajusta a duração da animação do tracinho do HUD.
- `togglePause()` — ao pausar, guarda quanto tempo faltava (`stepEnds - agora`); ao continuar, agenda com esse resto. A barrinha do HUD é pausada com `animationPlayState`.
- `end(completo)` — volta ao QR e faz `POST /api/tv/done` com `completo` (o funil diferencia "assistiu até o fim" de "interrompido").

### Linhas 670–700: HUD, reações e avisos
- `updateHud()` — redesenha os 14 tracinhos e o texto "ao vivo: Ana" / "pausado" / "modo demonstração".
- `react({type, name})` — cria o emoji com o primeiro nome embaixo, numa posição horizontal sorteada, e remove depois de 3,2 s (a duração da animação).
- `toast(text)` — aviso no canto (usado quando alguém se cadastra no meio de uma apresentação).

### Linhas 703–759: conexão com o servidor
- `post()` — só envia se estiver online; erros são ignorados (`.catch(() => {})`) porque a apresentação deve continuar mesmo se o servidor piscar.
- `connect()`:
  - Se a página foi aberta direto do arquivo (`file:`), não há servidor → modo demonstração.
  - Abre o SSE com `role=tv` e trata os eventos:

| Evento | O que a TV faz |
|---|---|
| `hello` | guarda endereço do QR, link do vestibular e contador; redesenha o QR |
| `start` | começa a apresentação para o visitante (ignora se já está apresentando para ele — caso de reconexão) |
| `lead` | atualiza o contador e o feed "Ana acabou de se conectar" (ou mostra um aviso, se estiver no meio de uma apresentação) |
| `queue` | guarda os próximos da fila (aparecem na tela do QR) |
| `react` | emoji subindo |
| `evento` | o operador renomeou o evento → novo link com UTM |
| `cmd` | comandos do painel: `demo`, `next`, `prev`, `pause`, `stop` |

  - `onerror` / `onopen` — atualizam o indicador de conexão do HUD.
  - Depois de 1,5 s, se nada foi desenhado (servidor não respondeu), mostra a tela do QR em modo demonstração.

### Linhas 762–770: atalhos de teclado
Enter (demonstração), setas (cenas), Espaço (pausa — `preventDefault` impede a página de rolar), Esc (encerra), F (tela cheia), H (ajuda).

### Linhas 774–784: modo ensaio
`index.html?cena=4&nome=Ana&perfil=design&pausar` abre direto numa cena. Espera 1,7 s (para a conexão e a tela inicial terminarem) antes de pular. Observação: o comentário da linha 775 diz "15 = crachá", mas são **14** cenas; o crachá é a cena 14 (o README está certo).

---

## 4.5 Script do `admin.html`

### Funções base
- `api(url, opts)` — um `fetch` que, se a resposta for **401** (não autorizado), volta para a tela de login. Todas as chamadas do painel passam por ela.
- `pct(a, b)` — porcentagem arredondada, ou "—" se `b` for 0 (evita divisão por zero).

### `loadState()` — TV e fila (roda a cada 1 s)
Busca `/api/op/state` e atualiza: TV conectada ou não, quem está na TV, cena e barra, botões habilitados (os de controle só com apresentação em andamento; o de demonstração só com a TV livre), fila e endereço do QR. O campo do evento só é atualizado se o operador **não** estiver digitando nele (`document.activeElement !== $('#evento')`).

### `loadMetrics()` — o funil
Busca `/api/op/metricas?evento=...` e desenha:
- **KPIs**: cadastros; % de quem abriu o QR e se cadastrou; % que assistiu até o fim (sobre concluídas + interrompidas); cliques no vestibular.
- **Barras do funil** com a % de cada etapa em relação à anterior.
- **Interesses**, **cadastros por hora** e **reações por cena**.
A função `bars()` desenha um gráfico de barras com HTML puro: a largura de cada barra é `total / maior total × 100%`.

### `fillEventSelects()` — listas de eventos
Preenche os dois seletores de evento. Guarda uma "chave" com os nomes (`events`) para **não** redesenhar os seletores a cada 15 s (o que fecharia a lista se o operador estivesse com ela aberta).

### `loadLeads()` — a tabela
Busca os leads com os filtros, monta a tabela e ajusta o link do CSV para baixar **com os mesmos filtros**.

### Exclusão
Um único "ouvinte" de clique na tabela inteira (`#rows`) descobre qual botão foi clicado com `closest('[data-del]')`. Essa técnica (*delegação de eventos*) funciona mesmo com as linhas sendo recriadas o tempo todo. Pede confirmação antes.

### `start()` — a sequência de abertura
1. Tenta carregar estado, métricas e leads. Se der 401, para (fica na tela de login).
2. Esconde o login e mostra o painel.
3. Atualiza o estado a cada 1 s e métricas/leads a cada 15 s.
4. Abre o SSE `role=op`: a cada evento `funil` (alguém avançou no funil), atualiza na hora.

A última linha do script chama `start()`: se o cookie de login ainda vale, o painel abre direto, sem pedir senha.

`refresh()` usa um pequeno atraso de 300 ms: se 5 eventos chegarem juntos, faz **uma** atualização só (técnica chamada *debounce*).

### Atalhos de teclado no painel
Os mesmos da TV, mas enviados pelo servidor (`cmd`). Ignorados quando o foco está num campo de texto ou seletor, para não avançar a cena enquanto o operador digita o nome do evento.

---

## 4.6 `mobile.js` — o celular

### Linhas 14–30: memória do aparelho
```js
const local = (key) => ({ get() {...}, set(v) {...}, clear() {...} });
```
Um embrulho para o `localStorage` (memória do navegador que sobrevive a recarregar a página). Tudo dentro de `try/catch` porque em aba anônima ou com armazenamento bloqueado o `localStorage` pode dar erro, e a página precisa funcionar mesmo assim.

- `devpath-lead` — o cadastro (id, nome, interesse). Por isso **recarregar a página não perde o lugar na fila**.
- `devpath-visitante` — um id aleatório do aparelho (`crypto.randomUUID()`), criado na primeira visita. Serve para o funil não contar duas vezes quem recarrega a página. Não contém dados pessoais.

### Linhas 37–38
- `postJSON` — atalho para `fetch` com POST e JSON.
- `track(tipo)` — manda um evento do funil (`qr_aberto`, `form_inicio`, `compartilhou`) com o id anônimo.

### Linhas 40–43: `show(id)`
Mostra só a `<section>` com aquele id e volta ao topo da página.

### Linhas 46–82: formulário
- Os botões de interesse são criados a partir de `C.profiles`. Um só ouvinte no contêiner (delegação) marca o tocado com `aria-checked="true"` e os outros com `false`.
- Ao trocar E-mail/Instagram/WhatsApp, o objeto `CONTACT` define `type`, `inputMode` (o teclado), `autocomplete`, o exemplo e o tamanho máximo do campo; o campo é limpo e recebe o foco.
- `addEventListener('focusin', ..., { once: true })` — a **primeira** vez que algo do formulário recebe foco, registra `form_inicio`. `once: true` remove o ouvinte depois da primeira vez.

### Linhas 87–120: envio do cadastro
1. `e.preventDefault()` — impede o navegador de recarregar a página (o comportamento padrão de um `<form>`).
2. Limpa as mensagens de erro.
3. Monta o corpo (nome, contato, tipo, interesse, consentimento, id do visitante).
4. Desabilita o botão e mostra "Salvando…" (evita dois cadastros por toque duplo).
5. `POST /api/lead`:
   - **422** (dados inválidos): mostra cada erro embaixo do campo e rola até o primeiro;
   - **ok**: guarda o cadastro no aparelho e vai para a tela "Começar";
   - outro erro ou sem rede: mensagem orientando a conferir o Wi-Fi.
6. `finally` — **sempre** (deu certo ou não) reabilita o botão.

### Linhas 128–142: botão Começar
Marca o botão como apertado, vibra o celular 40 ms (`navigator.vibrate?.` — o `?.` só chama se existir; iPhone não tem), faz `POST /api/start` e começa a ouvir o servidor. Se responder 404 (cadastro não existe mais), apaga o cadastro local e volta ao formulário.

### Linhas 145–174: ao vivo
- `listen()` abre o SSE do celular (`role=phone&id=...`). `encodeURIComponent` protege caracteres especiais na URL.
- Evento `scene`: atualiza "Agora na TV" e a barra de progresso.
- `applyStatus()` — decide a tela pelo estado que o servidor manda:

| `state` | Tela |
|---|---|
| `queued` | ao vivo, aviso laranja: "Você é o próximo!", "posição 3" ou "Aguardando a TV ligar…" |
| `playing` | ao vivo, aviso verde: "Ao vivo na TV com o seu nome" |
| `done` | crachá |
| `unknown` | cadastro apagado → volta ao formulário |

### Linhas 186–190: reações
Cada toque reinicia a animação do botão, vibra 15 ms e manda `POST /api/react`. O servidor limita a uma reação a cada 350 ms por pessoa.

### Linhas 193–209: crachá
Monta o crachá (sempre com `esc` no nome). O link do vestibular aponta para `/ir/vestibular?lead=...` — **passa pelo servidor**, que conta o clique e redireciona para o site com UTM.

### Linhas 212–236: salvar crachá para os stories
1. Gera a imagem (`badgeImage`) como um *Blob* (o arquivo PNG na memória).
2. Registra `compartilhou` no funil.
3. Se o celular permitir compartilhar arquivos (`navigator.canShare`), abre o menu de compartilhar (Instagram, WhatsApp...). **Isso só existe em HTTPS**; na rede do estande (HTTP) não está disponível.
4. Senão, mostra a imagem na página (`URL.createObjectURL` cria um endereço temporário para o Blob) para o visitante tocar e segurar para salvar, e um link de download.

### Linhas 239–248: excluir meus dados (LGPD)
Pede confirmação, `POST /api/lead/excluir`, e volta ao formulário com o aviso "Pronto: seus dados foram excluídos." Um 404 também conta como sucesso (os dados já não existem).

### Linhas 250–394: `badgeImage()` — desenhando o PNG 1080×1920
A sequência:
1. **Espera as fontes** carregarem (ver [03-fontes-woff2.md](03-fontes-woff2.md#37-a-fonte-dentro-do-crachá-png-canvas)).
2. Cria um canvas de 1080×1920 (o formato dos stories, 9:16).
3. Funções auxiliares: `rr()` desenha retângulo com cantos arredondados (com `arcTo`); `wrap()` quebra um texto em linhas que caibam numa largura, medindo cada palavra com `measureText`.
4. Fundo: azul-noite, dois brilhos radiais nos cantos e linhas horizontais.
5. Logo `</>devpath` letra a letra com sombra colorida (o brilho neon do canvas é `shadowBlur`).
6. **Mede antes de desenhar**: diminui o tamanho do nome de 8 em 8 px até caber em no máximo 2 linhas; quebra o cargo; distribui as disciplinas em fileiras de "pílulas". Com isso calcula a **altura do cartão** — por isso o cartão nunca corta um nome comprido.
7. Desenha o cartão, o avatar com o anel de três cores, iniciais, nome, cargo, pílulas, linha tracejada e rodapé.
8. Chamada no fim ("Bora criar tecnologia?" e `vestibularfatec.com.br`).
9. `cv.toBlob(..., 'image/png')` — transforma o desenho num arquivo PNG.

Tudo acontece **no celular**, sem internet e sem enviar a foto para lugar nenhum.

### Linhas 397–405: abertura da página
1. Registra `qr_aberto` (o servidor ignora se o mesmo aparelho já abriu antes).
2. Se já existe um cadastro salvo no aparelho, reconecta e espera o primeiro `status` do servidor: se for `ready`, mostra o botão Começar; se for outro estado, `applyStatus` já leva para a tela certa (fila, ao vivo, crachá).
3. Senão, mostra o formulário.

---

## 4.7 `vendor/qrcode.min.js`

- Biblioteca de terceiros que calcula a matriz de um QR Code. Pela API (`qrcode(tipo, nível)`, `createSvgTag`, `stringToBytes`), é a **qrcode-generator**, de Kazuhiko Arase (licença MIT). O cabeçalho com a licença não está no arquivo minificado; vale recolocá-lo num comentário na primeira linha.
- **"vendor"** é o nome tradicional da pasta para código de terceiros: avisa que **não se edita** esse arquivo.
- **".min"** = minificado: espaços, quebras de linha e nomes longos foram removidos para ficar pequeno (por isso o arquivo inteiro está numa linha só e não é legível).
- Uso no `tv.js`:
  ```js
  const qr = qrcode(0, 'M'); // 0 = escolhe o tamanho automaticamente; 'M' = correção de erro média (~15%)
  qr.addData(text);          // o texto (o endereço do celular)
  qr.make();                 // calcula
  qr.getModuleCount();       // quantos quadradinhos por lado
  qr.isDark(linha, coluna);  // esse quadradinho é preto?
  ```
  A correção de erro **M** permite ler o QR mesmo com até ~15% dele danificado ou com reflexo na TV.
- Está na pasta (e não num CDN) pelo mesmo motivo das fontes: funcionar sem internet.
