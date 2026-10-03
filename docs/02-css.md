# 2. CSS — a aparência

Três arquivos em `public/css/`, mais o `<style>` embutido no `admin.html`:

| Arquivo | Linhas | Usado por | Conteúdo |
|---|---|---|---|
| `base.css` | 67 | as três páginas | fontes, paleta de cores, reset, utilidades |
| `tv.css` | 485 | `index.html` | palco 1920×1080, HUD e as 14 cenas |
| `mobile.css` | 138 | `m.html` | formulário, botão começar, reações, crachá |

---

## 2.1 Conceitos que aparecem o tempo todo

### Anatomia de uma regra
```css
.logo-word b { font-weight: 300; color: var(--blue); }
└─seletor──┘   └propriedade┘ └valor┘
```
"Todo `<b>` que está dentro de algo com a classe `logo-word` fica fino e azul."

### Tipos de seletor usados no projeto
| Seletor | Exemplo | Seleciona |
|---|---|---|
| tag | `body`, `button` | toda tag com esse nome |
| classe | `.chip` | elementos com `class="chip"` |
| id | `#stage` | o elemento com `id="stage"` (único) |
| descendente | `.hud-progress li` | `<li>` dentro de `.hud-progress` |
| filho direto | `.scene > *` | só os filhos imediatos de `.scene` |
| atributo | `[aria-checked=true]` | elementos com esse atributo e valor |
| pseudo-classe | `:focus-visible`, `:empty`, `:nth-child(2)`, `:not(...)` | um **estado** ou **posição** |
| pseudo-elemento | `::before`, `::after`, `::placeholder` | uma parte "falsa" criada pelo CSS |
| combinação | `.build.l3 .node-db` | `.node-db` dentro de algo que tem **as duas** classes `build` e `l3` |

### A cascata: por que a ordem dos arquivos e das regras importa
Quando duas regras mandam coisas diferentes para o mesmo elemento, o navegador decide assim:
1. **`!important`** vence tudo (o projeto só usa em `prefers-reduced-motion` e num caso do crachá).
2. **Especificidade**: id (`#x`) > classe/atributo/pseudo-classe (`.x`, `[x]`, `:hover`) > tag (`div`).
3. **Ordem**: com a mesma especificidade, **vence a que vem por último**.

Por isso `base.css` é carregado **antes** de `tv.css`/`mobile.css`: o `base.css` dá o padrão e os outros podem sobrescrever. Exemplo real: `base.css` diz `body { background: var(--ink) }`; `tv.css`, carregado depois, troca por um fundo com gradientes.

Dentro de um arquivo também: a regra "geral" vem primeiro e as variações depois, para poderem sobrescrever:
```css
.hud-progress li i { width: 0; }          /* padrão: tracinho vazio */
.hud-progress li.done i { width: 100%; }  /* cena já passou: cheio */
```

### Variáveis CSS (*custom properties*)
```css
:root { --green: #2bff88; }        /* define */
.c-green { color: var(--green); }  /* usa */
```
- `:root` é o elemento `<html>`: variáveis definidas ali valem na página toda.
- Variáveis **herdam**: se um elemento define `--c: laranja`, todos os filhos que usam `var(--c)` ficam laranja. O projeto usa isso o tempo todo: o `tv.js` coloca `--c` com a cor do semestre na cena da jornada e **tudo** dentro dela (trilha, título, disciplinas em destaque, eletrocardiograma) muda de cor junto.
- Também servem como **parâmetro** vindo do HTML: `<li style="--k:3">` e no CSS `animation-delay: calc(.6s + var(--k) * .22s)`. Cada item da lista entra com um atraso diferente (efeito "cascata"), sem escrever uma regra por item.

### Cores com 8 dígitos (transparência)
`#2bff88` é verde puro. `#2bff8844` é o mesmo verde com transparência: os dois últimos dígitos são o **alfa** em hexadecimal (`00` = invisível, `ff` = opaco; `44` ≈ 27%). O projeto usa muito isso para brilhos suaves.

### `color-mix()`
```css
background: color-mix(in srgb, var(--c) 12%, #081028);
```
Mistura 12% da cor do semestre com o azul-escuro. Assim um único `--c` gera o fundo, a borda e o brilho em tons diferentes.

### Atalhos (*shorthands*) e a ordem obrigatória dos valores
**`font`** — a ordem é fixa: `[peso] tamanho[/altura-da-linha] família`:
```css
font: 800 92px/1.04 var(--display);
/*    peso tam/linha  família  */
```
Tamanho e família são obrigatórios e **a família tem que ser a última**.

**`animation`** — `nome duração [função] [atraso] [repetições] [direção] [preenchimento]`:
```css
animation: unlock .6s calc(.6s + var(--k) * .22s) var(--ease-spring) both;
/*         nome  duração  atraso                   curva            fill */
```
Regra importante: o **primeiro** tempo é sempre a **duração** e o **segundo** é o **atraso**. `both` mantém o estado do primeiro quadro antes de começar (o item fica invisível durante o atraso) e o do último quadro depois de terminar.

**`inset: 0`** é o atalho de `top: 0; right: 0; bottom: 0; left: 0` — "grude nas quatro bordas". `inset: 0 0 auto` = topo, laterais em 0 e base automática (barra presa no topo).

### Posicionamento
- `position: fixed` — preso à **janela** (não rola). Usado no canvas de fundo e no `#viewport`.
- `position: absolute` — posicionado em relação ao ancestral mais próximo que tenha `position` diferente de `static`. Todas as peças das cenas são `absolute` dentro do `#stage`, então coordenadas como `left: 960px; top: 230px` são sempre medidas no palco de 1920×1080.
- `z-index` — quem fica na frente (maior = mais à frente). Só funciona em elementos posicionados.

### Layout: Grid e Flexbox
- **Flexbox** (`display: flex`) organiza numa **linha** (ou coluna). Bom para barras: logo + texto, ícone + rótulo.
- **Grid** (`display: grid`) organiza em **linhas e colunas** ao mesmo tempo. Ex.: `grid-template-columns: 420px 1fr 420px` = coluna fixa, coluna que ocupa o resto (`1fr` = "uma fração do espaço livre"), coluna fixa.
- `place-items: center` (grid) centraliza na horizontal e na vertical com uma linha só.

### Animações: `@keyframes` + `animation`, e `transition`
```css
@keyframes blink { 50% { opacity: .3; } }
.live-dot { animation: blink 1.6s infinite; }
```
`@keyframes` descreve os quadros-chave (aqui: na metade do tempo, 30% de opacidade; começo e fim ficam no valor normal). `animation` aplica.
`transition` é diferente: anima **a mudança** de uma propriedade quando ela troca (ex.: quando o JS adiciona uma classe). Ex.: `.love-bar i { transition: width 1.6s }` faz a barra do "medidor de paixão" crescer devagar quando o JS muda a largura.

### Curvas de velocidade
```css
--ease-out: cubic-bezier(.16, 1, .3, 1);       /* começa rápido e freia suave */
--ease-spring: cubic-bezier(.34, 1.56, .64, 1); /* passa do ponto e volta: efeito "mola" */
```
O `1.56` acima de 1 é o que faz a animação **ultrapassar** o destino e voltar (efeito elástico dos botões e do crachá).

### Unidades
| Unidade | Significado |
|---|---|
| `px` | pixel do CSS |
| `%` | porcentagem do elemento pai |
| `em` | múltiplo do tamanho da fonte do próprio elemento (`min-height: 2.2em` = espaço para 2,2 linhas) |
| `fr` | fração do espaço livre no grid |
| `vh` / `svh` | % da altura da janela; `svh` desconta a barra do navegador do celular |
| `s` / `ms` | segundos / milissegundos |
| `deg` | graus |

---

## 2.2 `base.css` — linha a linha

### Linhas 2–13: as fontes
```css
@font-face {
  font-family: 'Unbounded';
  src: url('../fonts/unbounded.woff2') format('woff2');
  font-weight: 200 900;
  font-display: swap;
}
```
Registra a fonte do arquivo local com o nome "Unbounded". Detalhes em [03-fontes-woff2.md](03-fontes-woff2.md). O caminho começa com `../` porque é **relativo ao arquivo CSS** (`public/css/`), então sobe para `public/` e entra em `fonts/`.

### Linhas 15–36: `:root`, os *design tokens*
```css
--ink: #040816;      /* fundo azul-noite */
--ink-2: #081028;    /* fundo de cartões */
--panel: #0b1533cc;  /* painel translúcido */
--line: #2b4a8a55;   /* linhas e bordas discretas */
--white: #f3f8ff;    /* "branco" levemente azulado: cansa menos que #fff puro */
--dim: #8fa3c8;      /* texto secundário */
--orange / --green / --blue   /* as três cores neon da marca */
```
**Tokens** são as decisões de design com nome. Mudar `--green` aqui muda o verde do projeto inteiro (TV, celular e painel).

```css
--green-glow: 0 0 6px #2bff88, 0 0 22px #2bff8899, 0 0 60px #2bff8844;
```
O efeito **neon**: três sombras empilhadas, cada uma maior e mais transparente (6 px forte, 22 px média, 60 px fraca). Usado em `text-shadow` e `box-shadow`.

```css
--display: 'Unbounded', 'Arial Black', system-ui, sans-serif;
--mono: 'JetBrains Mono', ui-monospace, Consolas, monospace;
```
Listas de fontes **em ordem de preferência**: se a Unbounded não carregar, usa Arial Black; se não existir, a do sistema; por fim qualquer sem serifa. `--display` é para títulos; `--mono` (monoespaçada, todas as letras com a mesma largura) dá o clima de "código".

```css
color-scheme: dark;
```
Avisa o navegador que a página é escura: barras de rolagem, caixas de seleção e campos nativos ficam escuros também.

### Linhas 38–50: o *reset*
```css
*, *::before, *::after { box-sizing: border-box; }
```
Por padrão, `width: 100px` + `padding: 10px` daria 120 px de largura. Com `border-box`, a largura **inclui** padding e borda: 100 px é 100 px. Aplicado a tudo (`*`) e aos pseudo-elementos. É a primeira regra porque todas as outras medidas dependem dela.

```css
html, body { margin: 0; }
h1, h2, h3, p, ul { margin: 0; }
ul { padding: 0; list-style: none; }
```
Tira as margens e bolinhas que o navegador coloca sozinho, para que **todo** espaçamento seja decidido pelo nosso CSS.

```css
button, input { font: inherit; color: inherit; }
```
Botões e campos, por padrão, **não** herdam a fonte da página (usam a do sistema). Isso corrige.

```css
:focus-visible { outline: 2px solid var(--green); outline-offset: 4px; }
```
Contorno verde em quem está com o foco **quando se navega pelo teclado** (Tab). `:focus-visible` não aparece ao clicar com o mouse, só no teclado — acessível sem poluir o visual.

### Linhas 52–59: utilidades
```css
.c-green { color: var(--green); text-shadow: var(--green-glow); }
```
Classes prontas para pintar uma palavra de neon: `<span class="c-green">aqui.</span>`.

```css
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```
Esconde visualmente, mas mantém para leitores de tela. `display: none` não serviria: esconderia do leitor de tela também.

### Linhas 61–67: respeito a quem não quer movimento
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```
Se a pessoa ativou "reduzir movimento" no sistema (por enjoo, epilepsia, etc.), todas as animações terminam instantaneamente. `!important` é necessário para vencer as centenas de animações definidas em outros arquivos. O JS também verifica isso (`matchMedia('(prefers-reduced-motion: reduce)')`).

---

## 2.3 `tv.css` — por seções

### Linhas 3–11: página da TV
```css
html, body { height: 100%; overflow: hidden; }
```
Sem barras de rolagem: a TV é uma tela fixa.

```css
body { background: radial-gradient(...), radial-gradient(...), var(--ink); cursor: none; }
body:hover { cursor: default; }
```
- Vários fundos separados por vírgula ficam **empilhados**: o primeiro da lista fica por cima. Dois brilhos (azul à direita, laranja embaixo à esquerda) sobre o azul-noite.
- `cursor: none` esconde a setinha do mouse na TV; ao mexer o mouse sobre a página (`:hover`), ela volta.

### Linhas 13–26: camadas e palco
```css
#circuit { position: fixed; inset: 0; ... z-index: 0; opacity: .6; }
```
O canvas do circuito cobre a tela inteira, atrás de tudo. `opacity: .6` (60%) é o ajuste de transparência que ainda está **sem commit** (ver `PROGRESSO.md`).

```css
.scanlines { background: repeating-linear-gradient(0deg, #ffffff05 0 1px, transparent 1px 3px); mix-blend-mode: overlay; pointer-events: none; }
```
Um gradiente que se repete: 1 px quase invisível de branco, 2 px transparente. `mix-blend-mode: overlay` mistura com o que está atrás em vez de só cobrir. `pointer-events: none` faz os cliques "atravessarem" a camada.

```css
#stage {
  position: absolute; left: 50%; top: 50%;
  width: 1920px; height: 1080px;
  transform-origin: center;
  overflow: hidden;
}
```
**A sequência que faz o palco caber em qualquer TV:**
1. `left: 50%; top: 50%` coloca o **canto superior esquerdo** do palco no centro da tela.
2. O `tv.js` aplica `transform: translate(-50%, -50%) scale(s)`. O `translate(-50%, -50%)` puxa o palco de volta metade do próprio tamanho → o **centro** do palco fica no centro da tela.
3. `scale(s)` encolhe/estica a partir do centro (`transform-origin: center`).
4. `overflow: hidden` corta o que sair do retângulo (confetes, por exemplo).

A ordem dentro do `transform` importa: primeiro centraliza, depois escala.

### Linhas 28–53: HUD
```css
.hud { position: absolute; z-index: 10; inset: 0 0 auto; height: 120px; display: grid; grid-template-columns: 420px 1fr 420px; }
```
Três colunas: logo (420 px), progresso (o meio, flexível), "ao vivo" (420 px). As laterais iguais garantem que o progresso fique **exatamente centralizado**.

```css
.hud-progress li.on i { animation: fillbar linear forwards; }
@keyframes fillbar { to { width: 100%; } }
```
O tracinho da cena atual enche da esquerda para a direita. A **duração** não está no CSS: o `tv.js` coloca `animationDuration` com o tempo da cena (8 s, 15 s...). `forwards` mantém cheio no fim. `linear` = velocidade constante (é um relógio).

### Linhas 55–73: troca de cena
```css
.scene.is-out { animation: sceneOut .55s var(--ease-out) forwards; pointer-events: none; }
@keyframes sceneOut { to { opacity: 0; filter: blur(14px) brightness(2); transform: scale(1.04); } }
.scene > * { animation: rise .9s var(--ease-out) both; }
@keyframes rise { from { opacity: 0; transform: translateY(40px); filter: blur(8px); } }
```
A **sequência** de uma troca:
1. O `tv.js` marca a cena antiga com `is-out` → ela some (fica transparente, borrada, clara e cresce 4%) em 0,55 s.
2. Ao mesmo tempo, a nova cena é inserida e cada filho direto **sobe** 40 px desfocado até o lugar.
3. Depois de 600 ms o JS remove a cena antiga do HTML (um pouco mais que os 550 ms da animação, para ela terminar).
4. O `#flash` (faixa de luz diagonal) varre a tela por cima de tudo (`z-index: 20`).

`@keyframes rise` só tem `from`: o `to` é o estado normal do elemento.

### Linhas 75–108: tela ociosa com QR
- `.scene-idle` é um grid de duas colunas: texto à esquerda e QR (560 px) à direita.
- `.idle-feed li:not(:first-child) { opacity: .45 }` — no "feed" de quem acabou de se conectar, só o mais recente fica forte.
- `.corner.tl/.tr/.bl/.br` — as quatro "cantoneiras" laranjas do QR. Cada uma é um quadrado com só **duas** bordas visíveis (ex.: `tl` = top-left tira a direita e a de baixo).
- `.qr-scan` + `@keyframes scan` — a linha verde que desce e sobe sobre o QR (`alternate` = vai e volta).

### Linhas 110–130: cena 1, terminal
- `.term` é a "janela" do terminal; `.term-bar i` são as três bolinhas (laranja, amarela, verde) imitando janelas de Mac.
- `.t-progress i { animation: fillbar 1.4s steps(20) forwards; }` — `steps(20)` faz a barra encher **aos saltos** (20 degraus), como uma barra de progresso de terminal, em vez de suave.
- `.t-cursor { animation: blink 1s steps(1) infinite; }` — `steps(1)` liga/desliga sem fade: cursor piscando de verdade.

### Linhas 132–150: cena 2, gancho
- `.hook-apps span { left: var(--x); top: var(--y); animation: drift 7s calc(var(--k) * .18s) ... }` — as palavras flutuantes ("mensagens", "música"...). A posição e o atraso vêm do JS em variáveis CSS.
- `:nth-child(3n)` (a cada 3) fica laranja; `:nth-child(3n+1)` verde; as demais azuis. Cores alternadas sem classes extras.

### Linhas 152–167: cena 3, mapa
```css
.map-line { stroke-dasharray: 2000; stroke-dashoffset: 2000; animation: draw 2.4s .4s ... forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
```
Truque clássico para **desenhar uma linha SVG**: transforma a linha num tracejado com um traço de 2000 px e um espaço de 2000 px, e começa deslocado 2000 (só o espaço aparece). Animar o deslocamento até 0 faz o traço "entrar", parecendo desenhado na hora.
- `.map-node { animation: pop .7s calc(.6s + var(--k) * .32s) ... }` — os 6 círculos dos semestres aparecem um por um, a cada 0,32 s.
- `transform-box: fill-box; transform-origin: center;` — em SVG, o centro de transformação padrão é o canto da imagem inteira; isso faz cada círculo crescer a partir do **próprio** centro.

### Linhas 169–218: cena 4–9, a jornada (os 6 semestres)
- `.scene-journey { --c: var(--orange); }` — cor padrão; o JS troca a cada semestre.
- `.scene-journey > * { animation: none; }` — desliga o `rise` geral, porque essa cena **não é recriada** a cada semestre (só atualizada), e os elementos não devem subir de novo.
- `.track` — a trilha dos 6 semestres no topo (grid de 6 colunas). `li.done` (já passou) e `li.on` (atual, com brilho na cor `--c`).
- `.j-copy` — o bloco de texto à esquerda (790 px de largura).
- `.unlocks` — as disciplinas em duas colunas; `li.star` (destaques) ganham a cor do semestre. Cada uma entra com `@keyframes unlock` (desliza da esquerda, começa muito clara e borrada) com atraso de `--k`.
- `.love` — o "medidor de paixão": coração que bate (`@keyframes beat` imita o "tum-tum" com dois picos), canvas do eletrocardiograma (`#ekg`) e barra.

### Linhas 220–354: o "produto em construção"
A peça mais elaborada. Um mesmo conjunto de elementos (navegador, celular, banco de dados, servidor, editor de código) evolui por **níveis**: o JS adiciona as classes `l1`, `l2`, ... `l6` ao `.build` conforme o semestre avança, e **as classes se acumulam** (no 4º semestre: `l1 l2 l3 l4`).

| Classe | Semestre | O que muda no CSS |
|---|---|---|
| (base) | 1 | navegador **tracejado e cinza**: um rascunho |
| `.l2` | 2 | bordas sólidas, bolinhas coloridas, faixa principal com gradiente azul→verde (interface ganha cor) |
| `.l3` | 3 | cartões mostram texto real; aparece o **banco de dados** e o fio verde até ele |
| `.l4` | 4 | aparece o **servidor**, o cadeado na barra de endereço (`.lock { width: 14px }`) e o botão "entrar" preenchido (segurança) |
| `.l5` | 5 | entra o **celular** (sobe girando), gráfico desenhado e "mapa de calor" pulsando (usabilidade/negócio) |
| `.l6` | 6 | contador "pessoas usando agora", selo "online", tudo com borda verde (lançamento) |

Por que classes acumuladas e não uma classe por nível? Porque assim cada nível só descreve **o que ele acrescenta**: a regra `.build.l3 .node-db { opacity: 1 }` continua valendo no nível 4, 5 e 6 sem repetir nada. E com `.build > * { transition: ... }` cada mudança acontece com animação suave.

- `.wire { stroke-dasharray: 6 10; animation: flow 1s linear infinite; }` + `@keyframes flow { to { stroke-dashoffset: -32; } }` — os fios tracejados parecem ter **dados correndo**: o tracejado anda 32 px por segundo (32 = 2 × (6+10), um ciclo completo, sem "pulo").
- `.confetti i { animation: confetti 2.4s var(--d) ... }` com `--x`, `--y`, `--r` vindos do JS — cada confete voa numa direção e gira um tanto diferente.
- `.editor` — o editor de código no canto; `.k-tag`, `.k-key`, `.k-str`... são as cores do **realce de sintaxe**. `#eCode::after { content: '▍' }` cria o cursor piscando no fim do texto sem precisar de um elemento no HTML.

### Linhas 356–369: cena 10, "O que você vai poder criar"
Grid 4×2 de cartões. Cada cartão tem **duas** animações separadas por vírgula: `pop` (entra uma vez) e `glowcycle` (brilho que passa de cartão em cartão para sempre, com atrasos diferentes). Os ícones SVG são desenhados com o mesmo truque do `stroke-dasharray`.

### Linhas 371–393: cena 11, carreiras em órbita
```css
.orbit { animation: spin 80s linear infinite; }
.role { transform: rotate(var(--a)) translateX(var(--r)) rotate(calc(var(--a) * -1)); }
.role em { animation: spin 80s linear infinite reverse; }
```
A sequência dentro do `transform` (lida da esquerda para a direita):
1. `rotate(--a)` gira o "braço" até o ângulo do item (ex.: 72°);
2. `translateX(--r)` empurra o item para fora, até o raio da órbita;
3. `rotate(-a)` desgira, para o texto não ficar inclinado.

Depois, a órbita inteira gira (80 s por volta) e cada etiqueta gira **ao contrário** na mesma velocidade — por isso os textos dão a volta sem nunca ficar de cabeça para baixo. A órbita de fora gira no sentido oposto e mais devagar (120 s).

### Linhas 395–405: cena 12, mercado
```css
.m-row > div { display: inline-flex; animation: marquee 22s linear infinite; }
@keyframes marquee { to { transform: translateX(-50%); } }
```
**Letreiro infinito**: o JS escreve a lista de setores **duas vezes** seguidas. A faixa anda até -50% (exatamente o tamanho de uma cópia) e recomeça. Como a segunda cópia está onde a primeira começou, o recomeço é invisível. A segunda linha usa `animation-direction: reverse` para correr ao contrário.
- `-webkit-text-stroke: 2px` + `color: transparent` = letras só com o **contorno**.

### Linhas 407–418: cena 13, Fatec
Quatro colunas com borda superior colorida (`border-top: 4px solid var(--c)`) e a faixa do eixo tecnológico.

### Linhas 420–465: cena 14, final e crachá
```css
.badge-wrap { perspective: 1400px; }
.badge { animation: badgeIn 1.4s .6s ... both, float 6s 2s ease-in-out infinite; transform-style: preserve-3d; }
@keyframes badgeIn { from { opacity: 0; transform: rotateY(-70deg) rotateX(20deg) translateZ(-300px); } }
```
- `perspective` no **pai** cria a profundidade 3D (quanto menor, mais exagerado). Tem que estar no pai, não no próprio crachá.
- O crachá entra **girando** de lado e vindo do fundo; depois flutua suavemente para sempre (`float`, começando 2 s depois, quando a entrada terminou).
- `.badge::after` com `@keyframes sheen` — o **reflexo** de luz que passa sobre o crachá, como num cartão plastificado.
- `.avatar::before` — o anel de três cores girando em volta das iniciais: um círculo com borda transparente em que só três lados têm cor.
- `.barcode i` — o "código de barras": cada barra é um `<i>` com largura calculada pelo JS a partir das letras do nome.

### Linhas 467–485: reações, avisos e ajuda
- `.reaction { animation: floatUp 3.2s ... forwards; }` — o emoji sobe 620 px balançando (`--sway`) e some.
- `#toast.show { animation: toast 3.6s }` — aparece, fica 75% do tempo e some. O JS remove e recoloca a classe para reiniciar a animação.

---

## 2.4 `mobile.css` — por seções

### Corpo
```css
body {
  min-height: 100svh;
  background: radial-gradient(...), radial-gradient(...),
              linear-gradient(#22b8ff0a 1px, transparent 1px) 0 0 / 100% 28px,
              var(--ink);
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}
```
- `100svh`: altura da tela **sem** a barra de endereço do celular (a unidade `vh` antiga contava a barra e cortava o fim da página).
- O terceiro fundo é um gradiente de 1 px de linha + transparente, com tamanho `100% 28px` e repetido: vira um **caderno pautado** azul bem discreto. `0 0 / 100% 28px` = posição / tamanho.
- `env(safe-area-inset-...)`: espaço do notch e da barra de gestos do iPhone (par do `viewport-fit=cover` do HTML).

### Layout
- `#app { max-width: 480px; margin: 0 auto; }` — a coluna nunca passa de 480 px e fica centralizada (`margin: 0 auto`) em tablets.
- `.view { animation: in .6s ... both; }` — cada tela entra subindo suavemente quando o JS a mostra.

### Formulário
- `input:not([type=checkbox])` — estiliza todos os campos **menos** a caixinha de consentimento. Altura de 54 px: alvo grande para o dedo.
- `font-size: 17px` nos campos: com 16 px ou menos, o iPhone dá **zoom automático** ao tocar no campo.
- `input:focus { box-shadow: 0 0 0 4px #22b8ff26, ... }` — um "anel" azul translúcido ao redor do campo ativo (sombra sem desfoque e com espalhamento de 4 px).
- `.err:empty { display: none; }` — a mensagem de erro só ocupa espaço quando tem texto.
- `.seg button[aria-checked=true]` — o botão ativo do seletor E-mail/Instagram/WhatsApp. O mesmo atributo de acessibilidade dirige o visual.
- `.chip:nth-child(1) { --c: var(--orange); }` ... — cada um dos 4 interesses tem uma cor; `.chip[aria-checked=true]` usa `--c` para borda, texto, fundo (`color-mix`) e brilho.
- `.consent input { accent-color: var(--green); }` — pinta a caixinha nativa de verde sem precisar recriá-la.

### Botões
- `.btn-main` verde preenchido; `.btn-ghost` só com contorno azul; `.btn-text` parece um link.
- `.btn-main:active { transform: scale(.98); }` — afunda levemente ao tocar: retorno tátil visual.
- `.btn-main:disabled { opacity: .6; }` — enquanto salva, o botão fica apagado (o JS desabilita para evitar dois envios).

### Botão Começar
- `.start-ring` + `@keyframes ring` — anéis crescem de 75% a 135% e somem. O segundo (`.r2`) tem `animation-delay: 1.1s` (metade dos 2,2 s), então sempre há um anel saindo.
- `.start.pressed .start-core` — depois do toque o JS adiciona `pressed` e o botão fica verde (confirmação).

### Ao vivo e reações
- `.live-status.on` (verde, "Ao vivo na TV") e `.live-status.wait` (laranja, "na fila").
- `.live-bar i { transition: width .8s; }` — a barra de progresso desliza quando muda de cena.
- `.reacts button { aspect-ratio: 1; }` — botões sempre quadrados, qualquer que seja a largura da tela.
- `.reacts button.pop` — "pulo" do emoji ao tocar.

### Crachá
Igual ao da TV em tamanho menor: entra girando (`@keyframes badge`), reflexo (`sheen`), anel girando (`spin`). `overflow-wrap: anywhere` no nome evita que um nome comprido "estoure" o cartão.

---

## 2.5 O `<style>` do `admin.html`

Os pontos que fogem do que já foi explicado:

```css
.login[hidden], .evento[hidden], #logout[hidden] { display: none; }
```
O atributo `hidden` esconde por padrão, mas **perde** para qualquer regra com `display: flex` (como `.login`). Esta regra devolve a prioridade ao `hidden`.

```css
@media (max-width: 860px) { .grid, .grid-2 { grid-template-columns: 1fr; } ... }
```
**Responsivo**: em telas estreitas, as colunas viram uma só.

```css
.bars li { display: grid; grid-template-columns: minmax(140px, 44%) 1fr auto; }
.bars .val { font-variant-numeric: tabular-nums; }
```
Gráfico de barras feito só com CSS: rótulo (no mínimo 140 px, no máximo 44%), trilho com a barra, valor. `tabular-nums` faz todos os algarismos terem a mesma largura, para os números ficarem alinhados em coluna.

```css
.cols { display: flex; align-items: flex-end; height: 160px; }
```
Gráfico de colunas (cadastros por hora): as colunas crescem de baixo para cima porque estão alinhadas ao fim (`flex-end`). A altura de cada uma (`%`) é calculada pelo JS.

```css
.table { overflow-x: auto; }
th, td { white-space: nowrap; }
```
A tabela não quebra linhas; se não couber, ganha rolagem lateral só dentro da caixa, sem quebrar a página.
