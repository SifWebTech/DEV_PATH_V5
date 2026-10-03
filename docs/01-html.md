# 1. HTML — a estrutura das três telas

O projeto tem três páginas, todas em `public/`:

| Arquivo | Endereço | Quem vê |
|---|---|---|
| `index.html` | `/` ou `/tv` | a TV do estande |
| `m.html` | `/m` | o celular do visitante (aberto pelo QR Code) |
| `admin.html` | `/operador` ou `/admin` | o operador, no notebook |

Quem traduz `/m` para `m.html` é o servidor (`server/http.js`, objeto `ROUTES`). Veja [05-js-servidor.md](05-js-servidor.md).

---

## 1.1 O cabeçalho comum (`<head>`), linha a linha

As três páginas começam praticamente iguais. Exemplo do `index.html`:

```html
<!doctype html>
```
Diz ao navegador: "este é um documento HTML5 moderno". Sem essa linha o navegador entra em **modo de compatibilidade** (*quirks mode*) e calcula tamanhos do jeito antigo dos anos 2000. Precisa ser a **primeira** linha do arquivo, por isso vem antes de tudo.

```html
<html lang="pt-BR">
```
Abre o documento e declara o idioma. Serve para o leitor de tela (acessibilidade) pronunciar em português, para o corretor ortográfico e para o navegador não oferecer "traduzir esta página".

```html
<head>
```
Começa a parte **invisível**: configurações, título, estilos. Nada aqui aparece na tela.

```html
<meta charset="utf-8">
```
A codificação dos caracteres. Sem ela, "Começar" poderia aparecer como "ComeÃ§ar". Deve vir **logo no início** do `<head>` (o navegador só procura essa informação nos primeiros 1024 bytes); se viesse depois do `<title>`, o título já teria sido lido com a codificação errada.

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```
Essencial para celular. Sem isso, o celular finge ter 980 px de largura e mostra a página minúscula. Com isso, 1 px do CSS ≈ 1 ponto da tela do aparelho e o zoom inicial é 100%.
No `m.html` existe um extra: `viewport-fit=cover`, que deixa o conteúdo ocupar a área do "notch" (o recorte da câmera do iPhone). O `mobile.css` compensa com `env(safe-area-inset-top)` para nada ficar escondido atrás do recorte.

```html
<meta name="theme-color" content="#040816">
```
Pinta a barra do navegador do celular com o azul-noite do projeto, para a página parecer um aplicativo.

```html
<title>DEV PATH · TV</title>
```
O texto da aba do navegador.

```html
<meta name="description" content="...">
```
Resumo da página (usado por buscadores e ao compartilhar links).

```html
<link rel="icon" href="data:image/svg+xml,%3Csvg ...">
```
O ícone da aba (*favicon*). Em vez de um arquivo `.ico`, o desenho SVG está **embutido** no próprio endereço (`data:`). Vantagem: zero requisições extras e funciona offline. Os símbolos `%3C`, `%3E`, `%23` são `<`, `>` e `#` "escapados", porque esses caracteres não podem aparecer crus dentro de um endereço. O desenho é o logo `</>`: dois "chevrons" verdes (`#2bff88`) e a barra laranja (`#ff7a1a`).

```html
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/tv.css">
```
Carrega o CSS. **A ordem importa**: `base.css` vem primeiro porque define as variáveis (cores `--green`, fontes `--display`...) e as regras gerais. `tv.css` vem depois porque **usa** essas variáveis e, quando as duas definem a mesma coisa, a regra que vem por último vence (é a "cascata" do CSS — ver [02-css.md](02-css.md)).

O `admin.html` tem um extra:
```html
<meta name="robots" content="noindex">
```
Pede aos buscadores para não indexar o painel. É uma precaução: o painel nunca deveria estar na internet, mas se estivesse, não apareceria no Google.

---

## 1.2 `index.html` — a TV

### Por que a ordem dos elementos é esta

```html
<body>
  <canvas id="circuit" aria-hidden="true"></canvas>
  <div class="scanlines" aria-hidden="true"></div>
  <div id="viewport">
    <div id="stage" data-scene="idle"> ... </div>
  </div>
  <aside id="help" hidden> ... </aside>
  <script ...></script>
</body>
```

A ordem segue as **camadas**, de trás para a frente, como folhas de papel empilhadas:

| Camada | Elemento | O que é | `z-index` no CSS |
|---|---|---|---|
| fundo | `<canvas id="circuit">` | trilhas de circuito com pulsos de luz, desenhadas pelo `circuit.js` | 0 |
| meio | `<div class="scanlines">` | listras finas horizontais imitando tela antiga de TV | 1 |
| frente | `<div id="viewport">` com o `#stage` | todo o conteúdo da apresentação | 2 |
| por cima de tudo | `<aside id="help">` | a caixa de atalhos (tecla H) | 30 |

`aria-hidden="true"` diz aos leitores de tela para **ignorar** esses elementos, porque são só decoração.

### O palco (`#viewport` e `#stage`)

```html
<div id="viewport">
  <div id="stage" data-scene="idle">
```
- `#viewport` ocupa a tela inteira, seja qual for o tamanho da TV.
- `#stage` é um retângulo **fixo de 1920×1080** (Full HD). Todo o CSS da TV é escrito pensando nesse tamanho. O `tv.js` (função `fit()`) calcula uma escala e "encolhe" ou "estica" o palco para caber na TV real. Assim a apresentação fica idêntica numa TV 4K, numa HD ou numa janela pequena do notebook.
- `data-scene="idle"` é um atributo personalizado (todo atributo que começa com `data-` é livre para o programador). O `tv.js` troca esse valor a cada cena (`boot`, `journey`, `finale`...), o que permite ao CSS mudar o visual conforme a cena.

### O HUD (barra do topo)

```html
<header class="hud">
  <div class="logo" aria-label="DEV PATH">
    <span class="logo-mark">&lt;<i>/</i>&gt;</span>
    <span class="logo-word">dev<b>path</b></span>
    <span class="logo-sub">Sistemas para Internet<br>Fatec Jales</span>
  </div>
  <ol class="hud-progress" id="hudProgress" aria-label="Progresso da apresentação"></ol>
  <div class="hud-live" id="hudLive"><span class="live-dot"></span><span id="hudLiveText">aguardando conexão</span></div>
</header>
```
- **HUD** (*heads-up display*) é o termo de jogos para a informação fixa na tela.
- `&lt;` e `&gt;` são os caracteres `<` e `>` escritos como **entidades**. Se escrevêssemos `<` cru, o navegador acharia que é o início de uma tag.
- `<i>/</i>`: a barra fica dentro de um `<i>` só para o CSS pintá-la de laranja; o resto do logo é verde.
- `<b>path</b>`: idem, para o CSS pintar "path" de azul e mais fino.
- `<ol id="hudProgress">` começa **vazia**. O `tv.js` preenche com um tracinho por cena (14 tracinhos). É `<ol>` (lista **ordenada**) porque as cenas têm ordem.
- `hud-live` mostra "ao vivo: Ana", "pausado", "modo demonstração"...

### Onde as cenas aparecem

```html
<main id="sceneRoot" aria-live="polite"></main>
```
Fica **vazio** no HTML. Cada cena é criada pelo JavaScript (função `swapScene` em `tv.js`) e colocada aqui. `aria-live="polite"` avisa o leitor de tela para ler o conteúdo novo quando ele mudar, sem interromper o que está lendo.

Por que as cenas não estão escritas no HTML? Porque elas mudam com o **nome** e o **perfil** de cada visitante ("Ana, você usa tecnologia o dia inteiro"). Montar com JS a partir do `content.js` permite personalizar.

### Camadas de efeito

```html
<div id="reactions" aria-hidden="true"></div>   <!-- emojis subindo (🔥💚🤯🚀) -->
<div id="toast" role="status"></div>            <!-- aviso "Ana acabou de se conectar" -->
<div id="flash" aria-hidden="true"></div>       <!-- faixa de luz que varre a tela na troca de cena -->
```
Ficam **depois** do `<main>` porque elementos que vêm depois são desenhados por cima (e o CSS reforça com `z-index`).
`role="status"` é o equivalente acessível de "mensagem de status": o leitor de tela anuncia o aviso.

### A ajuda do operador

```html
<aside id="help" hidden>
  <h2>Atalhos do operador</h2>
  <dl>
    <dt>Enter</dt><dd>iniciar demonstração sem celular</dd>
    ...
  </dl>
</aside>
```
- `hidden` esconde o elemento. O `tv.js` liga e desliga com a tecla H.
- `<dl>`, `<dt>`, `<dd>` formam uma **lista de definições** (termo → descrição). É a tag semanticamente certa para "tecla → o que faz".

### Os scripts e por que estão no fim, nesta ordem

```html
<script src="vendor/qrcode.min.js"></script>
<script src="js/content.js"></script>
<script src="js/circuit.js"></script>
<script src="js/tv.js"></script>
</body>
```

**Por que no fim do `<body>`?** Um `<script>` comum **para** a leitura do HTML até ser baixado e executado. Colocando no fim, todos os elementos (`#stage`, `#circuit`...) já existem quando o JS roda — o `circuit.js` faz `document.getElementById('circuit')` logo na primeira linha e encontraria `null` se rodasse antes.

**Por que nesta ordem?** Cada script depende dos anteriores:

| Ordem | Script | Cria | Quem usa |
|---|---|---|---|
| 1 | `qrcode.min.js` | a função global `qrcode()` | `tv.js` (`qrSvg`) |
| 2 | `content.js` | o objeto global `window.DEVPATH` (todos os textos) | `tv.js` (`const C = window.DEVPATH`) |
| 3 | `circuit.js` | o objeto global `window.circuit` (`setEnergy`, `burst`) | `tv.js` |
| 4 | `tv.js` | a apresentação | — |

Se `tv.js` viesse antes de `content.js`, `C` seria `undefined` e a primeira linha que lê `C.semesters` quebraria tudo.

---

## 1.3 `m.html` — o celular

Mesmo `<head>` (com `viewport-fit=cover`) e o CSS `base.css` + `mobile.css`.

### Uma página, quatro "telas"

```html
<main id="app">
  <section class="view" id="vForm">  ... 1. cadastro
  <section class="view" id="vReady" hidden> ... 2. botão começar
  <section class="view" id="vLive" hidden>  ... 3. ao vivo (reações)
  <section class="view" id="vDone" hidden>  ... 4. crachá
</main>
```
Em vez de quatro arquivos HTML, há quatro `<section>` e só uma fica visível por vez (as outras têm `hidden`). A função `show(id)` do `mobile.js` troca qual aparece. Vantagens: a troca é instantânea, a conexão SSE não cai (trocar de página fecharia a conexão) e funciona com Wi-Fi fraco porque nada novo é baixado.

A ordem das seções segue a ordem da jornada do visitante, o que facilita ler o arquivo.

### O formulário (tela 1)

```html
<p class="form-notice" id="formNotice" role="status"></p>
```
Aviso verde ("Pronto: seus dados foram excluídos."). Fica vazio e escondido pelo CSS (`:empty { display: none }`) até o JS escrever algo.

```html
<form id="leadForm" novalidate>
```
`novalidate` desliga os balões de erro automáticos do navegador. O projeto mostra **suas próprias** mensagens (em português claro, embaixo de cada campo) e quem valida de verdade é o **servidor** (`leads.js`). Validar só no navegador não é seguro: qualquer pessoa pode enviar dados direto para a API.

```html
<label class="field">
  <span>Como você se chama?</span>
  <input name="name" id="fName" autocomplete="name" maxlength="40" placeholder="Seu nome" required>
  <small class="err" data-err="name"></small>
</label>
```
- `<label>` envolvendo o `<input>`: tocar no texto da pergunta já coloca o cursor no campo (bom para dedos no celular).
- `autocomplete="name"`: o celular sugere o nome salvo no aparelho.
- `maxlength="40"`: o mesmo limite que o servidor aceita.
- `<small class="err" data-err="name">`: lugar da mensagem de erro deste campo. O JS acha pelo atributo `data-err`.

```html
<div class="seg" role="radiogroup" aria-labelledby="contactLabel">
  <button type="button" role="radio" aria-checked="true" data-ctype="email">E-mail</button>
  <button type="button" role="radio" aria-checked="false" data-ctype="instagram">Instagram</button>
  <button type="button" role="radio" aria-checked="false" data-ctype="whatsapp">WhatsApp</button>
</div>
<input name="contact" id="fContact" type="email" inputmode="email" ...>
```
- Um **controle segmentado** (três botões grudados, só um ativo).
- `type="button"`: **obrigatório**. Dentro de um `<form>`, um `<button>` sem tipo é `submit` e enviaria o formulário ao ser tocado.
- `role="radio"` + `aria-checked`: dizem ao leitor de tela que funcionam como botões de opção. O CSS usa o mesmo `aria-checked=true` para pintar o ativo de azul — um só atributo serve à acessibilidade e ao visual.
- `inputmode`: escolhe o **teclado** do celular (com `@` para e-mail, numérico para WhatsApp). O JS troca isso quando o visitante muda o tipo de contato.

```html
<fieldset class="field">
  <legend>O que mais chama sua atenção?</legend>
  <div class="chips" id="interestChips"></div>
```
`<fieldset>` + `<legend>` agrupam opções relacionadas com um título. Os 4 botões de interesse são criados pelo JS a partir de `content.js` (`profiles`), para o texto ficar num lugar só.

```html
<label class="consent">
  <input type="checkbox" id="fConsent">
  <span>Autorizo a Fatec Jales a usar esses dados ...</span>
</label>
```
O **consentimento da LGPD**: diz a finalidade (informações sobre curso e vestibular) e o direito de excluir. O servidor recusa o cadastro se `consent` não for `true`.

```html
<button class="btn-main" type="submit" id="saveBtn">Salvar e continuar</button>
<p class="form-error" id="formError" role="alert"></p>
```
`role="alert"` faz o leitor de tela anunciar o erro imediatamente (ex.: sem conexão).

### O botão Começar (tela 2)

```html
<button class="start" id="startBtn" aria-label="Começar a apresentação na TV">
  <span class="start-ring"></span>
  <span class="start-ring r2"></span>
  <span class="start-core">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
    Começar
  </span>
</button>
```
- Dois `start-ring`: anéis que crescem e somem (animação `ring` no CSS). O segundo tem atraso de 1,1 s, por isso parecem "ondas" saindo do botão.
- `start-core` é o círculo laranja, que fica **por cima** dos anéis (`z-index: 2`).
- O SVG é o triângulo de "play": `M8 5` (vai ao ponto 8,5), `v14` (desce 14), `l11-7` (linha até 11 para a direita e 7 para cima), `z` (fecha).
- `aria-label` dá um nome mais completo para o leitor de tela.

### Ao vivo (tela 3)

```html
<div class="reacts">
  <button data-react="fire" aria-label="Fogo">🔥</button>
  ...
</div>
```
O `data-react` guarda o nome que o servidor espera (`fire`, `heart`, `mind`, `rocket` — mesma lista de `config.REACTIONS`). O `aria-label` existe porque o leitor de tela leria o emoji de forma estranha.

### Crachá (tela 4)

```html
<article class="m-badge" id="mBadge"></article>
<button class="btn-main" id="saveBadge" type="button">Salvar crachá para os stories</button>
<div class="shot" id="shot" hidden>
  <img id="shotImg" alt="Imagem do seu crachá para compartilhar">
  <a class="btn-ghost" id="shotDl" download="cracha-devpath.png">Baixar imagem</a>
</div>
<a class="btn-ghost" id="vestLink" target="_blank" rel="noopener">Inscrições no vestibular Fatec</a>
```
- `<article>`: conteúdo independente (o crachá). Preenchido pelo JS com o nome do visitante.
- `download="cracha-devpath.png"`: faz o link **baixar** o arquivo com esse nome em vez de abri-lo.
- `target="_blank"`: abre em nova aba (o visitante não perde a página do crachá).
- `rel="noopener"`: segurança. Impede a página aberta de controlar a nossa aba via `window.opener`.

### Scripts

```html
<script src="js/content.js"></script>
<script src="js/mobile.js"></script>
```
Mesma lógica da TV: `content.js` primeiro porque `mobile.js` lê `window.DEVPATH` (perfis, links). O celular **não** carrega `qrcode.min.js` nem `circuit.js` porque não precisa — menos coisas para baixar no Wi-Fi do estande.

---

## 1.4 `admin.html` — o painel do operador

Diferente das outras duas páginas, o painel tem **CSS e JS dentro do próprio arquivo** (`<style>` e `<script>`). Motivo: é uma tela só, usada só pelo operador, e assim tudo dele fica num lugar.

### Estrutura

```
.wrap
├── .top            título + formulário do evento + botão Sair + formulário de login
├── #msg            mensagens de erro (senha errada, TV desconectada)
└── #panel hidden   (só aparece depois do login)
    ├── .grid
    │   ├── card "Na TV agora": estado, cena, barra, botões Voltar/Pausar/Avançar/Encerrar/Demo
    │   └── card "Fila": lista de nomes + endereço do QR
    ├── Funil do estande: seletor de evento, KPIs, barras do funil, interesses, cadastros por hora
    ├── Reações por cena
    └── Leads: filtros, botão CSV e tabela
```

### Pontos que merecem explicação

```html
<form class="evento" id="eventoForm" hidden>
...
<form class="login" id="loginForm">
  <label class="sr-only" for="key">Senha</label>
  <input id="key" type="password" placeholder="Senha do painel" autocomplete="current-password">
```
- O formulário do evento começa `hidden` e o de login visível. Depois do login o JS inverte.
- `class="sr-only"` (*screen reader only*): o rótulo "Senha" fica invisível na tela mas é lido pelo leitor de tela. A classe está no `base.css`.
- `for="key"` liga o `<label>` ao `<input id="key">`.
- `type="password"` mostra bolinhas no lugar das letras.
- `autocomplete="current-password"` deixa o gerenciador de senhas do navegador preencher.

```html
<button id="bPrev" data-cmd="prev">Voltar<small>←</small></button>
```
Cada botão de controle tem `data-cmd` com o comando que vai para o servidor (`prev`, `pause`, `next`, `stop`, `demo`). Um único trecho de JS liga todos: `document.querySelectorAll('[data-cmd]')`.

```html
<section class="card" aria-labelledby="tvTitle">
  <h2 id="tvTitle" class="sr-only">Na TV agora</h2>
```
`aria-labelledby` dá à seção o nome do título indicado, para quem navega por regiões com leitor de tela.

```html
<table>
  <thead><tr><th>Data e hora</th>...<th><span class="sr-only">Ações</span></th></tr></thead>
  <tbody id="rows"></tbody>
</table>
```
`<thead>` (cabeçalho) e `<tbody>` (corpo) separados: o JS reescreve só o `<tbody>` a cada atualização, sem tocar no cabeçalho.

### Ordem dos scripts no painel

```html
<script src="js/content.js"></script>
<script> ... código do painel ... </script>
```
`content.js` primeiro porque o painel usa `DEVPATH.profiles` para mostrar "Criar aplicativos" em vez de `apps`. O código do painel está explicado em [04-js-navegador.md](04-js-navegador.md#45-script-do-adminhtml).

---

## 1.5 Resumo das tags usadas e por quê

| Tag | Para que serve aqui | Por que não um `<div>` |
|---|---|---|
| `<header>` | barra do topo da TV e do celular | indica "cabeçalho" para leitores de tela |
| `<main>` | conteúdo principal | só existe um por página; atalho "pular para o conteúdo" |
| `<section>` | cada tela do celular, cada card do painel | agrupa um assunto com título |
| `<article>` | o crachá | conteúdo que faz sentido sozinho |
| `<aside>` | ajuda de atalhos | conteúdo secundário |
| `<ol>` / `<ul>` | progresso (ordenado) / disciplinas, fila (não ordenada) | listas são anunciadas como "lista com N itens" |
| `<dl>` `<dt>` `<dd>` | tecla → ação | par termo/definição |
| `<form>` | cadastro, login, evento | Enter envia; validação; teclado "Ir" no celular |
| `<label>` | rótulo dos campos | tocar no texto foca o campo |
| `<fieldset>` `<legend>` | grupo de interesses | agrupa opções com um título |
| `<button>` | toda ação | funciona com teclado e leitor de tela; `<div>` clicável não |
| `<canvas>` | desenhos animados pixel a pixel | o `<div>` não desenha |
| `<svg>` | ícones e QR Code | nítido em qualquer tamanho |
