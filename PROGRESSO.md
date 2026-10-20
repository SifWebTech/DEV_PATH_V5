# DEV PATH V5 — onde paramos

> Diário de trabalho do projeto. Quando voltar, peça "onde paramos?" e este arquivo é o ponto de partida.
> Última atualização: **20/10/2026**

## Contexto

- **Projeto:** apresentação interativa de estande (TV + celular) para captar alunos para o curso de **Sistemas para Internet — Fatec Jales**.
- **Matéria:** 5º semestre, Negócio e Marketing (prof.ª Andresa). A V4 já foi apresentada; a V5 é a evolução.
- **Pasta:** `..V4 - APRESENTADO BOER - DEV_PATH_V4\DEV_PATH_V5` (cópia da V4 usada como base da V5).
- **GitHub:** https://github.com/SifWebTech/DEV_PATH_V5, branch `main` (inclui narração + nuvem). As branches `feat/narracao-audio-devpath` e `feat/cloud-multinetwork` também estão no GitHub, como histórico.
- **Publicação:** Render (servidor, `render.yaml`) + Neon (PostgreSQL), plano grátis. Passo a passo: `docs/14-deploy-render.md`. Cada `git push` na `main` publica sozinho no Render (depois que o Blueprint for criado).
- **Dois jeitos de rodar:** no notebook (`INICIAR.bat`, dados em `data/`, celular no mesmo Wi-Fi) ou na nuvem (`INICIAR-NUVEM.bat`, celular em qualquer rede).
- **Fonte das disciplinas:** `..\Horário-SI-2° Sem - 2026SalaseLabs- v2.pdf` (na pasta de cima).
- Como rodar e o que cada parte faz: veja o `README.md`.

## Linha do tempo

| Data | Commit | O que foi feito |
|---|---|---|
| 02/10/2026 | `cc74e61` | Base da V5 copiada da V4. Disciplinas conferidas com o horário oficial: só "Leitura e Produção de Text**os**" estava errada (corrigida). `leads.csv` fora do Git (LGPD). |
| 02/10/2026 | `a95317e` | Tudo renomeado de V4 para V5 (versão 5.0.0). |
| 02/10/2026 | `b759bfe` | **Semestres mostram todas as 43 disciplinas** na TV (antes só 3 por semestre; o resto passava numa faixa no rodapé). Nome oficial grande + tradução; 3 destaques com a cor do semestre. Cada semestre passou de 13 s para 15 s. |
| 02/10/2026 | `0ad9027` | **Fases 1 a 4 da arquitetura V5** (detalhes abaixo). |
| 03/10/2026 | `a62e081` | Circuito do fundo mais discreto: opacidade .6 e pulsos mais lentos. |
| 03/10/2026 | `9e2c0fc` | **Documentação técnica** em `docs/`: um arquivo por assunto (HTML, CSS, fontes WOFF2, JS do navegador, servidor, JSON/CSV, BAT/PS1, Git), explicando cada comando e o porquê de cada sequência. |
| 13/10/2026 | (fora do Git) | Vídeo da apresentação gravado com narração (`DEV_PATH_VIDEO_COM_NARRACAO_FINAL.mp4`, `.srt`, roteiro). Os `.mp4` ficam fora do Git (`*.mp4` no `.gitignore`: são grandes demais). |
| 19–20/10/2026 | `4cbf80e` | **Narração, música e efeitos na TV** (docs 09, 10, 11): narradora Thalita + narrador Antonio (vozes neurais, MP3 gerados por `ferramentas/gerar_narracao.py`), "Olá, {nome}" pela voz neural do Edge, cena avança no fim da fala, ducking, destaques sincronizados palavra a palavra, "competência desbloqueada", legenda, botão "Ativar áudio", mudo/legenda/narração pelo painel, 3 trilhas animadas originais (`ferramentas/gerar_musica.py`), celular com "DEV PATH CONCLUÍDO ✓" e próximos passos. Testado no Edge e no Chrome (31 verificações). |
| 20/10/2026 | `a3e0087` | **Arquitetura na nuvem** (docs 12, 13, 14): QR público `PUBLIC_BASE_URL/join/<código opaco>`, TV em `/presentation/EVENTO/TELÃO`, vários telões com filas independentes, estados OFFLINE/WAITING/READY/RUNNING/FINISHING, PostgreSQL (com arquivos como alternativa), login assinado, cabeçalhos de segurança, limite de pedidos, reconexão. SSE mantido no lugar de Socket.IO (decisão do usuário). Testes: 41 verificações em arquivos + 41 em PostgreSQL + 10 ponta a ponta no Edge + painel. Preparado para o **Render + Neon** (grátis): `render.yaml`, Node 24, fuso de São Paulo, endereço público automático; ambiente do Render simulado e aprovado. |
| 20/10/2026 | `main` = `a3e0087` | As duas branches juntadas na `main` e enviadas ao GitHub. |
| 20/10/2026 | `c846843` | **Banco Neon criado e conectado**: `DATABASE_URL` (com pooler) no dia a dia e `DATABASE_URL_UNPOOLED` (direta) nas migrations; `.env.local` (do `neon env pull`) lido pelo servidor e pelo `npm run importar`, fora do Git. `INICIAR.bat` liga `DEVPATH_OFFLINE=1` (estande nunca depende da internet); sem banco fora da produção, cai para `data/`. Render roda `npm run build` (checagem). Testado: servidor em modo postgres no Neon (7 cadastros), importação e modo offline. |
| 20/10/2026 | `d6bac05` | **Publicado no Render**: https://devpath-uhhd.onrender.com (`/healthz` → postgres). Endereço da TV no `INICIAR-NUVEM.bat`. |
| 20/10/2026 | `a7d5958` | **Narração animada em todas as telas**: roteiro reescrito com mais empolgação (vozes +12% e +6 Hz), falas novas no mapa e no mercado, fechamento com convite para o vestibular de Sistemas para Internet na Fatec Jales e aviso do crachá e dos links no celular. **"Olá, {nome}!" gerado pelo servidor** (`server/voz.js`, voz Thalita) porque a voz do navegador fica bloqueada na TV aberta sem clique. Música: opção 2. Circuito do fundo vai de 60% a 15% de opacidade ao longo das cenas (velocidade igual). Apresentação parada há mais de 10 min com a TV fechada não recomeça sozinha (o caso "Maria"). Testado no Edge: 14 cenas com fala, MP3 com o nome, opacidade e sem erros. |
| 20/10/2026 | `207249f` | **Painel do operador revisado**: o funil conta a mesma coisa em todas as etapas (o celular) e quem chegou a uma etapa conta nas anteriores, então nenhuma % passa de 100%; "Salvou o crachá" e "Abriu o vestibular" são % de quem tocou em Começar; "cadastros" desconta os excluídos (bate com a tabela); "assistiram até o crachá" conta cadastros, não eventos repetidos; interesses somam 100%; gráfico por hora sem pular horas; "hoje" segue o filtro da tabela. **3 trilhas novas de rock** com solo de guitarra e de baixo (opções 4, 5 e 6). |
| 20/10/2026 | `3e30f14` | **3 trilhas com solo de bateria e de contrabaixo** (opções 7 hard rock, 8 funk, 9 rock acelerado): bateria ganhou tons e um solo de 8 compassos (groove nos tons, bumbo duplo, tercinas, rufada, virada final). |
| 20/10/2026 | `e6a3031` | **As 9 músicas em sequência**: `config.music` virou uma lista; o motor de áudio toca cada uma inteira, emenda na seguinte com 2 s de transição e volta à primeira depois da última (só a atual e a próxima ficam na memória). Ordem 7, 4, 1, 8, 5, 2, 9, 6, 3. Testado no Edge sem som: a troca da 1ª para a 2ª acontece no fim da música e a 3ª já é baixada. |
| 20/10/2026 | `548a903` | **Narração 100% pt-BR, com inglês nos 6 semestres e mais ênfase**: palavras em inglês trocadas por português; narradora Francisca (só pt-BR) no lugar da Thalita multilíngue; entonação por frase (exclamação mais rápida, aguda e forte; pergunta sobe) e silêncios entre frases cortados. Amostras das 3 vozes do Brasil em `ferramentas/amostras-vozes/` (fora do Git). |
| 20/10/2026 | `cb00cc4` | **Documentação para a apresentação e manual de uso**: `docs/15-documentacao-para-professores.md` (problema, solução, estratégias de marketing, métricas, tecnologia, LGPD, testes, custo) e `docs/16-manual-de-uso.md` (passo a passo com 13 capturas reais em `docs/img/`). README atualizado. |
| 20/10/2026 | `30e0d69` | **TV tocava os áudios antigos guardados no navegador**: o servidor manda os MP3 com cache de 1 dia e os arquivos novos têm o mesmo nome, então a TV repetia a narração antiga (sem o inglês, na voz da Thalita) com a legenda nova. Agora cada MP3 é pedido com `?v=<hash>` (de `narration-timing.js`): regravou, o endereço muda e a TV baixa o novo. **Depois de cada atualização, feche e abra a TV de novo.** |
| 20/10/2026 | `cbae4d7` | **Logo oficial da Fatec Jales nas três telas**: `public/img/fatec-jales.png` (recortado e reduzido de `docs/img/logofatecjales.png`, 1,7 MB → 89 KB) numa plaquinha branca no cabeçalho da TV (todas as cenas, 66 px), do celular (38 px) e do painel (42 px); estilo `.fatec-logo` em `base.css`. O servidor passou a entregar a pasta `img/` também em `/presentation/…` e `/join/…`. Capturas do manual refeitas com o logo. |
| 20/10/2026 | `036e09f` | **Logo 20% maior** (TV 79 px, celular 46, painel 50) e **nos crachás** (TV, celular e imagem dos stories). **Circuito: a transparência de cada tela passou para o `tv.css`** (`body[data-cena="1"]` … `"14"`, de .60 a .10 no crachá); o tv.js só marca a tela. **Inteligência artificial**: na narração (3º, 5º e 6º semestres, criar e carreiras), como 9º quadro em "O que você vai poder criar" (Protótipos continua) e nas carreiras; sem dizer que há disciplina de IA (o currículo não tem). |
| 20/10/2026 | `6369d37` | **Pulsos do circuito com a mesma velocidade em todas as telas** (370 a 470 px/s, a da tela do código QR): a energia de cada tela não acelera mais os pulsos; ela só muda a quantidade e a cauda. |
| 20/10/2026 | `ba97c1e` | **Mesma quantidade de pulsos em todas as telas**: ~7 novos por segundo (a da tela do código QR); a onda de 70 pulsos no lançamento (6º semestre) foi desligada. A energia de cada tela agora só muda a cauda dos pulsos. |
| 20/10/2026 | (este commit) | **Circuito some até 5% no crachá** (`tv.css`): últimas telas .27, .20, .14, .09 e .05. |

## Fases da V5 (todas concluídas)

1. **Funil e métricas:** eventos em `data/eventos.jsonl` (sem dados pessoais). O painel `/operador` mostra o funil (QR → cadastro → começou → assistiu → salvou crachá → vestibular) com conversão por etapa, interesses, cadastros por hora e reações por cena. O nome do evento é definido no painel.
2. **Conversão:** crachá 1080×1920 para stories gerado no celular. Link e QR do vestibular com UTM do evento; cliques contados.
3. **Servidor em módulos** (`server/`: config, http, sessao, leads, funil, store, auth, util). Fila e TV salvas em `data/estado.json` e recuperadas após queda.
4. **WhatsApp** como 3ª opção de contato. Exclusão de dados pelo visitante (celular) e pelo operador (painel). Login do painel por cookie (sem senha na URL). CSV filtrado por evento e interesse.

**Testes feitos:** roteiro automático da API (28/28 ok), recuperação após queda, capturas de tela da TV, do celular, do painel e do crachá PNG.
**Não testado:** celular de verdade na rede do estande e TV pelo HDMI.
**Testes da narração e da nuvem:** ver as linhas de 19–20/10 na linha do tempo. Continua sem teste: celular de verdade no 4G/5G com o servidor publicado.

## Pendências (estado atual)

- [x] **Música**: as nove trilhas tocam em sequência, em loop (`public/js/narration.js → config.music`). Para tirar uma, apague a linha dela na lista.
- [ ] Preencher os links do celular em `public/js/content.js → links` (`curso`, `instagram`, `contato`: estão como TODO, sem URL inventada).
- [x] Migração para a nuvem (multi-rede) implementada, testada e na `main` (docs 12 e 13).
- [x] Provedor escolhido: **Render (servidor) + Neon (PostgreSQL)**, grátis. Projeto pronto (`render.yaml`, docs 14) e no GitHub.
- [x] **Publicar** (com você, seguindo `docs/14-deploy-render.md`):
  1. [x] Neon: projeto criado, conectado e com as tabelas (20/10/2026).
  2. [x] Render: Blueprint criado, deploy **Live** em **https://devpath-uhhd.onrender.com** (20/10/2026).
  3. [x] `/healthz` → `{"ok":true,"banco":"postgres"}`; TV (`/presentation/FATEC2026/TELAO-01`) e painel (`/operador`) respondem.
  4. [x] Endereço da TV no `INICIAR-NUVEM.bat`.
- [ ] Testar com celular **só no 4G/5G** e o notebook no Wi-Fi da Fatec (QR → cadastro → Começar → TV → crachá → QR; e um 2º celular na fila).
- [ ] No dia: abrir a TV uns 5 min antes do público (o plano grátis do Render "dorme" após 15 min sem acesso).

- [x] **Ajuste do circuito salvo** no commit `a62e081` (03/10/2026):
  - `public/css/tv.css`: `#circuit` com `opacity: .6` (circuito do fundo mais transparente).
  - `public/js/circuit.js`, linha 86, alterada pelo usuário: pulsos mais lentos e com cauda menor
    (`speed: 150 + Math.random() * 100 + energy * 100, tail: 50 + energy * 50`;
    o original era `speed: 160 + Math.random() * 220 + energy * 380, tail: 70 + energy * 90`).
  - Para voltar ao original: `git revert a62e081`.
- [ ] **Ensaio completo** no notebook + TV + celular real antes do evento.
- [ ] Na **primeira execução** da V5 com os dados reais, o servidor adiciona a coluna "evento" ao `data/leads.csv` e salva o original em `data/leads-backup-v4.csv`. É automático; só conferir.
- [ ] Antes do evento: dar o **nome do evento** no painel e, se quiser, trocar a senha (`set ADMIN_KEY=...`).
- [x] Comentário "15 = crachá" em `tv.js` corrigido para 14.

## Ajustes rápidos que já foram explicados

- **Transparência do circuito:** `opacity` do `#circuit` em `public/css/tv.css` (1 = original, 0 = invisível). Ajuste fino por parte em `public/js/circuit.js`: trilhas (linha 71, `'1c'`), bolinhas (76, `'30'`), grade (80, `'#22b8ff14'`), brilho do pulso (113, `0.22`), núcleo do pulso (116, `0.9`).
- **Velocidade, quantidade e cauda dos pulsos:** `circuit.js`, linha 88 (`speed`: hoje 370 a 470 px/s, igual em todas as telas; `tail`) e linha 100 (`7` pulsos novos por segundo, igual em todas as telas). A "energia" de cada tela (que acelera os pulsos) vem de `circuit.setEnergy(...)` no `tv.js` (linhas 142, 414, 505, 581 e 646).
- **Transparência do circuito por tela:** `tv.css`, regras `body[data-cena="1"] #circuit` … `"14"` (logo abaixo do `#circuit`).
- **O que faz os pulsos andarem:** `circuit.js`, linha 102 (`p.d += p.speed * dt`), dentro do loop `frame()` com `requestAnimationFrame`.
- **Palco 1920×1080 que se ajusta a qualquer tela:** `#viewport` e `#stage` em `tv.css` + função `fit()` em `tv.js` (escala = menor entre largura/1920 e altura/1080).
- **Textos e disciplinas:** `public/js/content.js` (`disciplinas: [nome oficial, tradução, destaque]`).
- **Duração das cenas:** `STEPS` no topo de `public/js/tv.js` (~2 min 50 s no total).

## Como testar sem mexer nos leads reais

```bat
set DATA_DIR=C:\caminho\para\uma\pasta-de-teste
set PORT=8810
node server.js
```

Com `DATA_DIR`, o servidor grava leads, eventos e estado em outra pasta, e o `data/` real fica intocado.
