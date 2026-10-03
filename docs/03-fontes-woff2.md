# 3. Fontes e o formato WOFF2

Arquivos em `public/fonts/`:

| Arquivo | Fonte | Uso no projeto | Tamanho WOFF2 | Tamanho sem compressão | Glifos | Pesos (eixo `wght`) |
|---|---|---|---|---|---|---|
| `unbounded.woff2` | Unbounded | títulos (`--display`) | 50.904 bytes (~50 KB) | 105.212 bytes | 297 | 200 a 900 |
| `jetbrains-mono.woff2` | JetBrains Mono | texto corrido e "código" (`--mono`) | 31.432 bytes (~31 KB) | 78.528 bytes | 394 | 400 a 800 |

*(Os números foram lidos de dentro dos próprios arquivos: cabeçalho WOFF2, tabela `maxp` com a contagem de glifos e tabela `fvar` com os eixos.)*

---

## 3.1 O que é um arquivo de fonte

Uma fonte é um pequeno banco de dados de **desenhos de letras** (*glifos*) e regras de uso. Por dentro, é uma coleção de **tabelas**, cada uma com quatro letras de nome. As principais que existem nos nossos arquivos:

| Tabela | Guarda |
|---|---|
| `glyf` + `loca` | o desenho vetorial de cada letra (curvas) e onde cada desenho começa |
| `cmap` | o mapa "caractere → glifo" (ex.: a letra `ç` usa o desenho nº 112) |
| `hmtx` / `hhea` | largura de cada letra e métricas horizontais |
| `head`, `maxp`, `OS/2`, `post`, `name` | informações gerais: nome, número de glifos, pesos, licença |
| `GSUB` / `GPOS` | substituições (ligaduras como `=>` virando uma seta na JetBrains Mono) e ajustes de espaço entre pares (*kerning*) |
| `fvar`, `gvar`, `avar`, `STAT`, `HVAR`, `MVAR` | dados de **fonte variável** (ver 3.4) |

Os formatos "crus" e antigos são **TTF** (TrueType) e **OTF** (OpenType). O WOFF2 é o mesmo conteúdo, **embalado e comprimido para a web**.

## 3.2 O que é WOFF2

**WOFF** = *Web Open Font Format*. O **2** é a segunda versão (recomendação do W3C, o órgão que padroniza a web, desde 2018).

O que ele faz de diferente de um TTF:
1. **Comprime com Brotli**, um algoritmo de compressão criado pelo Google, mais eficiente que o ZIP/gzip.
2. **Pré-processa as tabelas antes de comprimir**: a tabela `glyf` (os desenhos) é reorganizada separando coordenadas, comandos e contadores em fluxos parecidos entre si, e a `loca` nem é guardada (é recalculada no navegador). Dados parecidos lado a lado comprimem muito melhor.
3. **Junta tudo num fluxo comprimido só**, em vez de comprimir tabela por tabela.

Resultado no nosso projeto:
- Unbounded: 105 KB → **50 KB** (52% menor).
- JetBrains Mono: 78,5 KB → **31 KB** (60% menor).

Dá para reconhecer um WOFF2 pelos 4 primeiros bytes do arquivo, a "assinatura": `77 4F 46 32`, que em texto é **`wOF2`**.

### Comparação dos formatos

| Formato | Compressão | Suporte | Observação |
|---|---|---|---|
| TTF / OTF | nenhuma | tudo | arquivo do sistema operacional; pesado para a web |
| EOT | fraca | só Internet Explorer antigo | obsoleto |
| WOFF (1) | zlib (gzip) | todos os navegadores modernos | ~40% menor que TTF |
| **WOFF2** | Brotli + transformações | todos os navegadores atuais (Chrome, Edge, Firefox, Safari, navegadores de celular) | ~30% menor que o WOFF 1; **é o padrão hoje** |

Por isso o projeto só tem WOFF2: os navegadores usados (Chrome/Edge na TV, qualquer celular de hoje) suportam, e não faz sentido carregar formatos antigos.

## 3.3 Por que as fontes estão **na pasta** e não no Google Fonts

A V3 carregava as fontes do Google Fonts (pela internet). Na V4 elas foram trazidas para dentro do projeto. Motivos:

1. **O estande pode não ter internet.** O servidor roda no notebook e os celulares se conectam pelo Wi-Fi/hotspot dele. Sem internet, uma fonte do Google não carrega, e a TV mostraria Arial no lugar do visual neon.
2. **Velocidade:** o arquivo vem do próprio notebook, na rede local.
3. **Privacidade (LGPD):** carregar do Google envia o IP de cada visitante para um servidor de fora.
4. **O crachá PNG** desenhado no celular precisa da fonte já carregada (ver 3.7).

Licença: Unbounded e JetBrains Mono são distribuídas sob a **SIL Open Font License (OFL)**, que permite usar, embutir e redistribuir as fontes num projeto como este.

## 3.4 Fontes variáveis: por que um arquivo só por família

Antigamente, cada peso era um arquivo: `Unbounded-Light.ttf`, `Unbounded-Regular.ttf`, `Unbounded-Bold.ttf`, `Unbounded-Black.ttf`...
As duas fontes do projeto são **variáveis**: um único arquivo contém o desenho "base" e as **variações** (tabela `gvar`) que dizem como cada ponto da letra se move quando o peso muda. O navegador calcula **qualquer** peso dentro do intervalo, inclusive valores como 650.

Os intervalos reais lidos da tabela `fvar`:
- Unbounded: eixo `wght` de **200 a 900**;
- JetBrains Mono: eixo `wght` de **400 a 800**.

Por isso 2 arquivos (82 KB juntos) cobrem todos os pesos usados no CSS: 300, 600, 700 e 800 na Unbounded; 500 e 800 na JetBrains Mono.

## 3.5 O `@font-face` do `base.css`, linha a linha

```css
@font-face {
  font-family: 'Unbounded';
  src: url('../fonts/unbounded.woff2') format('woff2');
  font-weight: 200 900;
  font-display: swap;
}
```

| Linha | O que faz | Por quê |
|---|---|---|
| `@font-face {` | declara uma fonte nova para a página | sem isso o navegador só conhece as fontes instaladas no computador |
| `font-family: 'Unbounded';` | o **nome** pelo qual o resto do CSS vai chamar a fonte | é esse nome que aparece em `--display: 'Unbounded', ...` |
| `src: url(...) format('woff2');` | onde está o arquivo e em que formato | o caminho é relativo ao **CSS** (`public/css/`), por isso `../fonts/`. O `format('woff2')` deixa o navegador saber o tipo **antes** de baixar: se não suportasse, nem baixaria |
| `font-weight: 200 900;` | diz que este arquivo atende os pesos de 200 a 900 | com **dois** números, o navegador entende que é uma fonte variável e usa este arquivo para todos esses pesos, sem "engordar" a letra artificialmente (o *falso negrito*) |
| `font-display: swap;` | o que mostrar enquanto a fonte baixa | ver abaixo |

A JetBrains Mono está declarada com `font-weight: 100 800`, mas o arquivo só tem pesos de 400 a 800. Na prática não faz diferença: nenhum lugar do CSS pede menos de 400, e se pedisse, o navegador usaria o 400 (o valor mais próximo disponível).

### `font-display: swap`

Enquanto o arquivo da fonte não chega, o navegador pode:
| Valor | Comportamento |
|---|---|
| `block` | esconde o texto por até 3 s esperando a fonte (texto "invisível") |
| **`swap`** | mostra o texto **na hora** com a fonte reserva (Arial Black / Consolas) e **troca** quando a fonte chega |
| `fallback` / `optional` | espera um pouquinho e, se demorar, desiste da fonte |

`swap` foi escolhido porque o texto nunca pode sumir da TV ou do formulário. Como o arquivo vem do notebook, a troca acontece em milissegundos e quase ninguém percebe.

### Por que a declaração está no `base.css` e no topo

- `base.css` é o único arquivo carregado pelas **três** páginas. Declarar ali evita repetir.
- O `@font-face` só **registra** a fonte; o arquivo só é baixado quando algum elemento visível realmente usa `font-family: 'Unbounded'`. Ou seja: declarar não custa nada; o download acontece sob demanda.
- Por convenção, `@font-face` vem antes das regras que usam a fonte, para quem lê o arquivo entender de onde ela vem.

## 3.6 Como o servidor entrega o WOFF2

Em `server/util.js`:
```js
'.woff2': 'font/woff2',
```
O servidor avisa o tipo correto (`Content-Type: font/woff2`). Com o tipo errado, alguns navegadores recusam a fonte.

Em `server/http.js`:
```js
'Cache-Control': ext === '.woff2' ? 'max-age=31536000' : 'no-cache',
```
- Para fontes: `max-age=31536000` = **1 ano** (60 × 60 × 24 × 365 segundos). O navegador guarda a fonte e nem pergunta de novo ao servidor. Faz sentido porque o arquivo de fonte **nunca muda**.
- Para HTML, CSS e JS: `no-cache` = "sempre confira se mudou". Assim, se você editar um texto no `content.js` e recarregar a TV, a mudança aparece na hora.

Por isso o WOFF2 é o único tipo de arquivo com cache longo.

## 3.7 A fonte dentro do crachá PNG (canvas)

O `mobile.js` desenha o crachá 1080×1920 num `<canvas>`. Um detalhe importante: o canvas **não espera** a fonte carregar. Se mandar escrever com `Unbounded` antes de o arquivo chegar, ele escreve com a fonte reserva e a imagem sai feia. Por isso, antes de desenhar:

```js
await Promise.all(['800 90px Unbounded', '600 52px Unbounded', '500 32px "JetBrains Mono"']
  .map((f) => document.fonts.load(f))).catch(() => {});
```
- `document.fonts.load('800 90px Unbounded')` pede ao navegador: "baixe (se precisar) e prepare esta fonte neste peso" e devolve uma promessa que termina quando ela está pronta.
- `Promise.all` espera as três.
- `.catch(() => {})`: se der erro, desenha assim mesmo com a fonte reserva, em vez de não gerar a imagem.

## 3.8 Como trocar ou adicionar uma fonte (passo a passo)

1. Baixe a fonte em WOFF2 (ex.: no site da fonte ou no Google Fonts; se vier em TTF, converta com uma ferramenta como `woff2_compress` ou um conversor online confiável).
2. Coloque o arquivo em `public/fonts/`.
3. Em `public/css/base.css`, crie um `@font-face` igual aos existentes, com o novo nome e caminho.
4. Troque a variável: `--display: 'NovaFonte', 'Arial Black', system-ui, sans-serif;`.
5. Se for usada no crachá PNG, atualize os nomes em `badgeImage` (`mobile.js`), na linha do `document.fonts.load` e nas constantes `DISPLAY` / `MONO`.
6. Confira a licença (OFL ou parecida permite embutir).
