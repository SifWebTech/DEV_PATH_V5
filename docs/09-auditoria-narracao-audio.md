# 9. Auditoria antes da narração e do áudio

> Escrito **antes** de qualquer alteração, na branch `feat/narracao-audio-devpath` (criada a partir de `main`, commit `fa0a5ff`).
> Objetivo: entender a V5 como ela é hoje e decidir onde a narração, a música e os efeitos entram sem quebrar nada.

## 9.1 Estrutura encontrada

| Parte | Arquivos | Observação |
|---|---|---|
| Servidor | `server.js` + `server/` (config, http, sessao, leads, funil, store, auth, util) | Node puro, sem dependências. **Não há Socket.IO nem WebSocket**: o tempo real é **SSE** (`EventSource`) + `POST`. |
| TV | `public/index.html`, `public/js/tv.js`, `public/js/circuit.js`, `public/css/tv.css` | `tv.js` já é ao mesmo tempo o *SceneManager* (funções `render*`) e o *PresentationController* (`begin`, `go`, `schedule`, `togglePause`, `end`). |
| Celular | `public/m.html`, `public/js/mobile.js`, `public/css/mobile.css` | Cadastro → Começar → ao vivo (reações) → crachá. |
| Painel | `public/admin.html` (CSS e JS embutidos) | Comandos da TV via `POST /api/op/cmd` (lista fechada: `next, prev, pause, stop, demo`). |
| Textos | `public/js/content.js` | Fonte única de semestres, disciplinas, perfis, carreiras. Carregado como `<script>` (funciona até aberto direto do arquivo). |
| Dados | `data/` (fora do Git) | `leads.csv`, `eventos.jsonl`, `estado.json`, `.porta`. |

Não existe pasta de áudio, nenhum arquivo de som, nenhum teste automatizado (`package.json` só tem `start`).

## 9.2 Fluxo atual (como funciona hoje)

1. **QR Code**: `tv.js → renderIdle()` desenha o QR (biblioteca local `vendor/qrcode.min.js`) com o endereço `/m` que o servidor manda no evento SSE `hello`.
2. **Cadastro**: `mobile.js` → `POST /api/lead` → `server/leads.js` valida e grava no CSV → `sessao.addLead()` avisa a TV (`lead`).
3. **START**: botão "Começar" → `POST /api/start` → `sessao.start()` põe na fila → `advance()` manda `start` para a TV com `{ id, name, interest }`.
4. **Troca de cenas**: `begin(lead)` → `go(0)`. Cada cena tem duração fixa em `STEPS` e o avanço é um **`setTimeout`** (`schedule()`). `go()` renderiza, atualiza o HUD e informa a cena ao servidor (`POST /api/tv/scene`), que repassa ao celular.
5. **Progresso**: barrinhas no HUD (`#hudProgress`) animadas por CSS com a duração da cena.
6. **Semestres**: a cena `journey` é montada uma vez e atualizada (`updateJourney(n)`) — produto evolui, disciplinas, medidor de paixão.
7. **Fim**: depois do crachá, `end(true)` → volta ao QR, limpa `S.lead` e manda `POST /api/tv/done` → servidor marca o funil e chama o próximo da fila.
8. **Pausa / avançar / voltar / encerrar**: teclado na TV ou painel (`cmd` via SSE).
9. **Persistência**: fila e TV em `data/estado.json`; funil em `eventos.jsonl`.
10. **Mobile x TV**: o celular nunca toca som; só mostra o estado e as reações.

## 9.3 Riscos identificados

| Risco | Por quê | Como evitar |
|---|---|---|
| **Autoplay bloqueado** | Chrome/Edge bloqueiam som e `speechSynthesis` sem um clique na página. A TV é aberta em quiosque e ninguém clica nela. | Abrir a TV com `--autoplay-policy=no-user-gesture-required` (já é o `abrir-telas.ps1` que abre) **e** mostrar o botão "ATIVAR ÁUDIO E INICIAR EVENTO" quando o navegador ainda bloquear. |
| **Relógio duplo** | Hoje o `setTimeout` decide a troca de cena; a narração precisa decidir. Dois relógios = cena trocando no meio da frase. | Quando a cena tem narração, só o fim da narração avança. O `setTimeout` vira apenas o *fallback*. |
| **Duas vozes ao mesmo tempo** | Avançar rápido (→) ou encerrar com Esc no meio da fala. O Chrome dispara `end` de uma fala cancelada **depois** que a próxima começou. | Um contador de reprodução (`token`) no narrador: eventos de falas antigas são ignorados; `stop()` cancela áudio e voz antes de cada cena. |
| **Bug do Chrome com falas longas** | Vozes do Google param sozinhas depois de ~15 s e às vezes não disparam `end`. | Falar frase por frase e ter um "cão de guarda" de tempo por frase. |
| **Arquivos MP3 ainda não existem** | Não há narração gravada nem música licenciada no projeto. | Tudo funciona sem eles: voz do navegador (pt-BR), trilha sintetizada discreta, efeitos sintetizados; e o README de `public/audio/` diz o nome de cada arquivo esperado. |
| **Servidor não conhece `.mp3`** | `server/util.js → MIME` não tem tipos de áudio, nem suporte a `Range` (o Chrome usa para mídia). | Acrescentar os tipos e responder `Range` só para arquivos estáticos. |
| **Painel sem foco na TV** | O operador comanda pelo notebook; mudo e legenda precisam funcionar de lá. | Acrescentar 3 comandos à lista fechada do `/api/op/cmd` (`mute`, `legendas`, `narracao`) e um `POST /api/tv/audio` para o painel ver o estado do som. |
| **Dados do visitante anterior** | Nome no HUD e na legenda. | Ao voltar ao QR: parar a voz, limpar a legenda e o HUD (o `S.lead = null` já existe). |

## 9.4 O que será alterado

| Arquivo | Alteração |
|---|---|
| `public/js/tv.js` | Duração das cenas passa a vir da narração; marcadores → ações visuais (destacar, competência desbloqueada); efeitos sonoros nas transições; HUD com nome e objetivo; legenda; botão de ativar áudio; comandos novos do painel; correção do comentário "15 = crachá" (são 14 cenas). |
| `public/index.html` | Carregar os scripts novos; caixa de legenda; tela "Ativar áudio"; atalhos novos na ajuda. |
| `public/css/tv.css` | Estilos da legenda, do desbloqueio, do destaque e do botão de áudio (com `prefers-reduced-motion`). |
| `public/js/content.js` | Campo `objetivo` em cada perfil (texto curto do HUD) e links novos do celular (com `TODO` onde não há URL oficial). |
| `public/m.html`, `public/js/mobile.js`, `public/css/mobile.css` | "Sua experiência está acontecendo na TV."; "DEV PATH CONCLUÍDO ✓" e os 4 botões. |
| `public/admin.html` | Linha "Áudio da TV" com estado e botões Som / Legendas / Narração. |
| `server/util.js`, `server/http.js`, `server/sessao.js` | Tipos de áudio, `Range`, 3 comandos novos e o estado do áudio da TV. |
| `abrir-telas.ps1` | Flag de autoplay na janela da TV. |
| `README.md`, `docs/README.md`, `PROGRESSO.md` | Documentar. |

## 9.5 O que NÃO precisa ser alterado

- Cadastro, validação, LGPD, CSV, funil e métricas (`leads.js`, `funil.js`, `store.js`, `auth.js`).
- A fila e a recuperação após queda (`sessao.js` só ganha o estado do áudio).
- O contrato `start` / `scene` / `done` entre TV e servidor.
- As cenas e o visual existentes: a narração **conduz**, não substitui.
- `circuit.js`, fontes, QR Code, crachá PNG.

## 9.6 Proposta de implementação

```
                    ┌──────────────────────────── tv.js ────────────────────────────┐
 SSE "start" ─────▶ │ PresentationController: begin → go(i) → (narração terminou) → go(i+1) │
                    │ SceneManager: render*() — as cenas que já existem                     │
                    │ MarkerActions: highlight / unlock / pulse  (reage aos marcadores)      │
                    └───────┬──────────────────────────────────────────────▲──────────────┘
                            │ play(cena, {nome, perfil})                   │ onMarker / onCaption / done
                    ┌───────▼─────────── narrator.js ──────────────────────┴──────┐
                    │ lê o manifesto (narration.js), escolhe MP3 → voz do navegador │
                    │ → modo silencioso; dispara marcadores e legendas               │
                    └───────┬──────────────────────────────────────────────────────┘
                            │ playNarration(url) / duck() / restore() / playSFX()
                    ┌───────▼────────── audio-engine.js ───────────────────────────┐
                    │ Web Audio: master ─┬─ música (loop, fade, ducking)            │
                    │                    ├─ narração                                │
                    │                    └─ efeitos                                 │
                    └──────────────────────────────────────────────────────────────┘
```

- **Manifesto**: `public/js/narration.js` (e não `data/narration.json`). Motivo: `data/` fica fora do Git e não é servida ao navegador; e um `.js` no mesmo formato do `content.js` funciona até com a TV aberta direto do arquivo, aceita comentários explicando cada campo e não precisa de `fetch`.
- **Ordem das cenas**: continua em `STEPS` (`tv.js`). O manifesto não repete "próxima cena"; a duração de `STEPS` vira o `durationFallback`.
- **Voz**: há um TTS local instalado — *Microsoft Maria Desktop (pt-BR)*, via Windows/SAPI. **Não** vou gerar MP3 com ela: a qualidade é robótica e ficaria parecendo a narração definitiva. Ela (ou a voz natural do Edge, se houver) é usada ao vivo pelo `speechSynthesis` como *fallback*, centralizado no `narrator.js`. Os MP3 definitivos ficam listados para gravação.
- **Música**: sem arquivo licenciado no projeto. O motor espera `public/audio/music/ambient-devpath.mp3`; enquanto não existir, toca uma trilha **sintetizada pelo próprio navegador** (acordes lentos e filtrados, sem nenhum arquivo), que pode ser desligada na configuração.
- **Testes**: não há suíte. Vou usar `node --check`, subir o servidor numa pasta de dados de teste (`DATA_DIR`) e dirigir o Chrome em modo *headless* pelo protocolo de depuração (Node 24 já tem `WebSocket`), conferindo cada item da lista de testes.
